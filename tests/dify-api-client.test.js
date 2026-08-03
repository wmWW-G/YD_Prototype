const test = require("node:test");
const assert = require("node:assert/strict");

const { APP_TYPES } = require("../lib/dify-core");
const { inspectDifyApp, sendDifyChat, streamDifyChat } = require("../lib/dify-api-client");

test("inspects app info and parameters before accepting a saved key", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });

    if (url.endsWith("/info")) {
      return new Response(JSON.stringify({ name: "外贸市场调研", mode: "chat" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ user_input_form: [{ "text-input": { variable: "country" } }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  const inspected = await inspectDifyApp({
    apiKey: "app-inspection-secret",
    selectedAppType: APP_TYPES.DIALOGUE,
    fetchImpl
  });

  assert.equal(inspected.info.name, "外贸市场调研");
  assert.equal(inspected.info.mode, "chat");
  assert.equal(inspected.parameters.user_input_form[0]["text-input"].variable, "country");
  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), ["/v1/info", "/v1/parameters"]);
  assert.equal(calls.every((call) => call.options.headers.Authorization === "Bearer app-inspection-secret"), true);
});

test("rejects a key when the selected type does not match the real app mode", async () => {
  const fetchImpl = async (url) => new Response(JSON.stringify(
    url.endsWith("/info")
      ? { name: "背调工作流", mode: "advanced-chat" }
      : { user_input_form: [] }
  ), { status: 200 });

  await assert.rejects(() => inspectDifyApp({
    apiKey: "app-chatflow-secret",
    selectedAppType: APP_TYPES.DIALOGUE,
    fetchImpl
  }), /实际是 Chatflow/);
});

test("sends a streaming chat request and returns the normalized result", async () => {
  let sentBody = null;
  const fetchImpl = async (_url, options) => {
    sentBody = JSON.parse(options.body);
    return new Response([
      'data: {"event":"message","answer":"市场","conversation_id":"conv-market"}',
      'data: {"event":"message","answer":"结论","conversation_id":"conv-market"}',
      'data: {"event":"message_end","conversation_id":"conv-market","metadata":{"usage":{"total_tokens":18}}}'
    ].join("\n\n"), {
      status: 200,
      headers: { "Content-Type": "text/event-stream" }
    });
  };

  const result = await sendDifyChat({
    apiKey: "app-market-secret",
    query: "分析墨西哥市场",
    conversationId: "",
    user: "yd-user-1",
    fetchImpl
  });

  assert.equal(sentBody.response_mode, "streaming");
  assert.equal(sentBody.query, "分析墨西哥市场");
  assert.equal(result.answer, "市场结论");
  assert.equal(result.conversation_id, "conv-market");
});

test("turns Dify HTTP errors into safe Chinese messages without echoing the API key", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ message: "invalid token app-do-not-leak" }), { status: 401 });

  await assert.rejects(async () => {
    try {
      await sendDifyChat({
        apiKey: "app-do-not-leak",
        query: "测试",
        user: "yd-user-1",
        fetchImpl
      });
    } catch (error) {
      assert.equal(error.message.includes("app-do-not-leak"), false);
      throw error;
    }
  }, /API Key 无效/);
});

test("streams safe process summaries and visible answer chunks as Dify emits them", async () => {
  const encoder = new TextEncoder();
  const upstreamChunks = [
    'data: {"event":"workflow_started","workflow_run_id":"run-live","conversation_id":"conv-live"}\n\n',
    'data: {"event":"agent_thought","id":"thought-empty","thought":"","tool":"","conversation_id":"conv-live"}\n\n',
    'data: {"event":"agent_thought","id":"thought-public","thought":"先确认市场规模，再核对政策与买家信号。","conversation_id":"conv-live"}\n\n',
    'data: {"event":"agent_log","id":"log-search","data":{"label":"CALL Tavily Search;CALL Tavily Search","status":"running","data":{"output":{"tool_call_name":"tavily_search","tool_call_input":"{\\"query\\":\\"墨西哥储能市场规模\\"}"}}}}\n\n',
    'data: {"event":"message","answer":"<thi","conversation_id":"conv-live"}\n\n',
    'data: {"event":"message","answer":"nk>不能展示的思考</think>公开","conversation_id":"conv-live"}\n\n',
    'data: {"event":"message","answer":"结论","conversation_id":"conv-live"}\n\n',
    'data: {"event":"message_end","conversation_id":"conv-live","metadata":{"usage":{"total_tokens":23}}}\n\n'
  ];
  const fetchImpl = async () => new Response(new ReadableStream({
    start(controller) {
      upstreamChunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    }
  }), {
    status: 200,
    headers: { "Content-Type": "text/event-stream" }
  });
  const emitted = [];

  const result = await streamDifyChat({
    apiKey: "app-live-secret",
    query: "分析墨西哥市场",
    user: "yd-user-live",
    fetchImpl,
    onEvent(event) {
      emitted.push(event);
    }
  });

  assert.equal(emitted[0].type, "process");
  assert.equal(emitted.some((event) => event.type === "process" && event.step.kind === "reasoning"), true);
  assert.equal(emitted.some((event) => (
    event.type === "process"
    && event.step.id === "thought-public"
    && event.step.label === "思考过程"
    && event.step.detail === "先确认市场规模，再核对政策与买家信号。"
  )), true);
  assert.equal(emitted.some((event) => event.type === "process" && event.step.id === "thought-empty"), false);
  assert.equal(emitted.some((event) => (
    event.type === "process"
    && event.step.kind === "tool"
    && event.step.label === "正在调用Tavily Search"
    && event.step.detail === "墨西哥储能市场规模"
  )), true);
  assert.deepEqual(
    emitted.filter((event) => event.type === "answer_delta").map((event) => event.delta),
    ["公开", "结论"]
  );
  assert.equal(result.answer, "公开结论");
  assert.equal(result.conversation_id, "conv-live");
  assert.equal(emitted.filter((event) => event.type === "answer_delta").some((event) => (
    String(event.delta || "").includes("先确认市场规模")
  )), false);
  assert.equal(JSON.stringify(emitted).includes("不能展示的思考"), false);
});

test("emits a generic reasoning step when a chatbot only exposes split think tags", async () => {
  const streamText = [
    'data: {"event":"message","answer":"<thi","conversation_id":"conv-think"}',
    'data: {"event":"message","answer":"nk>隐藏内容</think>公开答案","conversation_id":"conv-think"}',
    'data: {"event":"message_end","conversation_id":"conv-think"}'
  ].join("\n\n");
  const fetchImpl = async () => new Response(streamText, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" }
  });
  const emitted = [];

  await streamDifyChat({
    apiKey: "app-think-secret",
    query: "分析",
    user: "yd-user-think",
    fetchImpl,
    onEvent(event) {
      emitted.push(event);
    }
  });

  assert.equal(emitted.some((event) => (
    event.type === "process"
    && event.step.kind === "reasoning"
    && event.step.label === "正在分析问题"
  )), true);
  assert.equal(JSON.stringify(emitted).includes("隐藏内容"), false);
});

test("keeps Agent interim messages in the process stream and promotes only the last segment", async () => {
  const streamText = [
    'data: {"event":"agent_thought","id":"reason-a","thought":"隐藏思考"}',
    'data: {"event":"agent_message","answer":"Google 限流，换关键词继续搜索。","conversation_id":"conv-agent"}',
    'data: {"event":"agent_log","id":"tool-b","data":{"label":"Tavily Search","status":"running","data":{"output":{"tool_call_name":"tavily_search","tool_call_input":{"query":"德国储能"}}}}}',
    'data: {"event":"agent_message","answer":"正式","conversation_id":"conv-agent"}',
    'data: {"event":"agent_message","answer":"结论","conversation_id":"conv-agent"}',
    'data: {"event":"agent_log","id":"tool-b","data":{"label":"Tavily Search","status":"success"}}',
    'data: {"event":"message_end","conversation_id":"conv-agent"}'
  ].join("\n\n");
  const fetchImpl = async () => new Response(streamText, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" }
  });
  const emitted = [];

  const result = await streamDifyChat({
    apiKey: "app-agent-secret",
    query: "调研",
    user: "yd-user-agent",
    fetchImpl,
    onEvent(event) {
      emitted.push(event);
    }
  });

  assert.equal(emitted.some((event) => (
    event.type === "process"
    && event.step.kind === "reasoning"
    && event.step.detail.includes("Google 限流")
  )), true);
  assert.equal(emitted.some((event) => event.type === "answer_delta"), false);
  assert.equal(emitted.find((event) => event.type === "answer_replace").answer, "正式结论");
  assert.equal(result.answer, "正式结论");
});

test("keeps Chatflow Agent message chunks in process until the Agent node finishes", async () => {
  // 真实 Dify Chatflow 中，Agent 节点仍会使用 `message`，而不是 `agent_message`。
  // 第一轮可见文字只是阶段播报；只有最后一轮、Agent 节点结束前的文字才是正式报告。
  const streamText = [
    'data: {"event":"workflow_started","workflow_run_id":"run-chatflow-agent","conversation_id":"conv-chatflow-agent"}',
    'data: {"event":"node_started","workflow_run_id":"run-chatflow-agent","data":{"node_id":"agent-node","node_type":"agent","title":"联网背调 Agent"}}',
    'data: {"event":"agent_log","id":"round-1","data":{"node_id":"agent-node","label":"ROUND 1","status":"start"}}',
    'data: {"event":"message","answer":"<think>内部检索计划</think>已确认客户身份，接下来继续深挖。","conversation_id":"conv-chatflow-agent","mode":"advanced-chat"}',
    'data: {"event":"agent_log","id":"tool-1","data":{"node_id":"agent-node","label":"CALL tavily_search","status":"success"}}',
    'data: {"event":"agent_log","id":"round-2","data":{"node_id":"agent-node","label":"ROUND 2","status":"start"}}',
    'data: {"event":"message","answer":"<think>内部汇总过程</think>## 正式","conversation_id":"conv-chatflow-agent","mode":"advanced-chat"}',
    'data: {"event":"message","answer":"报告","conversation_id":"conv-chatflow-agent","mode":"advanced-chat"}',
    'data: {"event":"node_finished","workflow_run_id":"run-chatflow-agent","data":{"node_id":"agent-node","node_type":"agent","title":"联网背调 Agent","status":"succeeded"}}',
    'data: {"event":"node_started","workflow_run_id":"run-chatflow-agent","data":{"node_id":"answer-node","node_type":"answer","title":"回答"}}',
    'data: {"event":"node_finished","workflow_run_id":"run-chatflow-agent","data":{"node_id":"answer-node","node_type":"answer","title":"回答","status":"succeeded"}}',
    'data: {"event":"message_end","conversation_id":"conv-chatflow-agent"}',
    'data: {"event":"workflow_finished","workflow_run_id":"run-chatflow-agent","data":{"status":"succeeded"}}'
  ].join("\n\n");
  const fetchImpl = async () => new Response(streamText, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" }
  });
  const emitted = [];

  const result = await streamDifyChat({
    apiKey: "app-chatflow-agent-secret",
    query: "背调客户",
    user: "yd-user-chatflow-agent",
    fetchImpl,
    onEvent(event) {
      emitted.push(event);
    }
  });

  assert.equal(emitted.some((event) => (
    event.type === "process"
    && event.step.kind === "summary"
    && event.step.detailDelta.includes("已确认客户身份")
  )), true);
  assert.equal(emitted.some((event) => event.type === "answer_delta"), false);
  assert.equal(emitted.find((event) => event.type === "answer_replace").answer, "## 正式报告");
  assert.equal(result.answer, "## 正式报告");
  assert.equal(JSON.stringify(emitted).includes("内部检索计划"), false);
  assert.equal(JSON.stringify(emitted).includes("内部汇总过程"), false);
});

test("emits a timed thinking round and its visible summary before starting the next round", async () => {
  // 这条夹具复刻真实 Chatflow Agent 的关键顺序：
  // `<think>` 在流里持续一段时间，闭合后出现本轮小结，然后下一轮 `<think>` 再开始。
  // 生产代码如果再次只发一个全局“正在分析”，本测试会因为缺少稳定轮次 ID、结束事件和增量小结而失败。
  const streamText = [
    'data: {"event":"node_started","data":{"node_id":"agent-node","node_type":"agent","title":"联网背调 Agent"}}',
    'data: {"event":"message","answer":"<think>第一轮隐藏推理","conversation_id":"conv-rounds","mode":"advanced-chat"}',
    'data: {"event":"agent_thought","id":"public-thought-1","thought":"正在核对官网与注册信息","conversation_id":"conv-rounds"}',
    'data: {"event":"message","answer":"仍在推理</think>已确认客户","conversation_id":"conv-rounds","mode":"advanced-chat"}',
    'data: {"event":"message","answer":"身份。","conversation_id":"conv-rounds","mode":"advanced-chat"}',
    'data: {"event":"message","answer":"<think>第二轮隐藏推理","conversation_id":"conv-rounds","mode":"advanced-chat"}',
    'data: {"event":"message","answer":"继续推理</think>## 完整报告","conversation_id":"conv-rounds","mode":"advanced-chat"}',
    'data: {"event":"message","answer":"正文","conversation_id":"conv-rounds","mode":"advanced-chat"}',
    'data: {"event":"node_finished","data":{"node_id":"agent-node","node_type":"agent","title":"联网背调 Agent","status":"succeeded"}}',
    'data: {"event":"message_end","conversation_id":"conv-rounds"}'
  ].join("\n\n");
  const fetchImpl = async () => new Response(streamText, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" }
  });
  const emitted = [];

  const result = await streamDifyChat({
    apiKey: "app-rounds-secret",
    query: "背调客户",
    user: "yd-user-rounds",
    fetchImpl,
    onEvent(event) {
      emitted.push(event);
    }
  });

  const roundEvents = emitted.filter((event) => event.type === "process" && event.step?.kind === "thinking");
  const summaryEvents = emitted.filter((event) => event.type === "process" && event.step?.kind === "summary");

  assert.deepEqual(
    roundEvents.map((event) => ({ id: event.step.id, label: event.step.label, status: event.step.status })),
    [
      { id: "agent-thinking-1", label: "正在深度思考", status: "running" },
      { id: "agent-thinking-1", label: "已深度思考", status: "done" },
      { id: "agent-thinking-2", label: "正在深度思考", status: "running" },
      { id: "agent-thinking-2", label: "已深度思考", status: "done" }
    ]
  );
  assert.deepEqual(
    emitted.find((event) => event.type === "process" && event.step?.id === "public-thought-1")?.step,
    {
      id: "public-thought-1",
      kind: "reasoning",
      label: "思考过程",
      detail: "正在核对官网与注册信息",
      status: "running",
      roundId: "agent-thinking-1"
    }
  );
  assert.deepEqual(
    summaryEvents.map((event) => ({
      id: event.step.id,
      roundId: event.step.roundId,
      detailDelta: event.step.detailDelta || "",
      status: event.step.status
    })),
    [
      { id: "agent-message-1", roundId: "agent-thinking-1", detailDelta: "已确认客户", status: "running" },
      { id: "agent-message-1", roundId: "agent-thinking-1", detailDelta: "身份。", status: "running" },
      { id: "agent-message-1", roundId: "agent-thinking-1", detailDelta: "", status: "done" },
      { id: "agent-message-2", roundId: "agent-thinking-2", detailDelta: "## 完整报告", status: "running" },
      { id: "agent-message-2", roundId: "agent-thinking-2", detailDelta: "正文", status: "running" }
    ]
  );
  assert.deepEqual(
    emitted.find((event) => event.type === "answer_replace"),
    {
      type: "answer_replace",
      answer: "## 完整报告正文",
      remove_process_id: "agent-message-2"
    }
  );
  assert.equal(result.answer, "## 完整报告正文");
  assert.equal(JSON.stringify(emitted).includes("隐藏推理"), false);
  assert.equal(JSON.stringify(emitted).includes("仍在推理"), false);
  assert.equal(JSON.stringify(emitted).includes("继续推理"), false);
});

test("coalesces token-heavy Agent messages instead of emitting one process event per token", async () => {
  const tokenEvents = Array.from({ length: 1200 }, () => (
    'data: {"event":"agent_message","answer":"字","conversation_id":"conv-heavy"}'
  ));
  const streamText = [...tokenEvents, 'data: {"event":"message_end","conversation_id":"conv-heavy"}'].join("\n\n");
  const fetchImpl = async () => new Response(streamText, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" }
  });
  const emitted = [];

  const result = await streamDifyChat({
    apiKey: "app-heavy-secret",
    query: "长任务",
    user: "yd-user-heavy",
    fetchImpl,
    onEvent(event) {
      emitted.push(event);
    }
  });

  const agentProcessEvents = emitted.filter((event) => (
    event.type === "process" && String(event.step?.id || "").startsWith("agent-message-")
  ));
  assert.equal(agentProcessEvents.length <= 8, true, "同一 Agent 段落只能发送少量覆盖更新");
  assert.equal(emitted.find((event) => event.type === "answer_replace").answer.length, 1200);
  assert.equal(result.answer.length, 1200);
});

test("promotes the last Agent segment when a clean upstream EOF has no message_end event", async () => {
  const fetchImpl = async () => new Response([
    'data: {"event":"agent_message","answer":"最终市场","conversation_id":"conv-eof"}',
    'data: {"event":"agent_message","answer":"报告","conversation_id":"conv-eof"}'
  ].join("\n\n"), {
    status: 200,
    headers: { "Content-Type": "text/event-stream" }
  });
  const emitted = [];

  const result = await streamDifyChat({
    apiKey: "app-eof-secret",
    query: "长任务",
    user: "yd-user-eof",
    fetchImpl,
    onEvent(event) {
      emitted.push(event);
    }
  });

  assert.equal(emitted.find((event) => event.type === "answer_replace").answer, "最终市场报告");
  assert.equal(emitted.at(-1).type, "done");
  assert.equal(result.answer, "最终市场报告");
  assert.equal(result.conversation_id, "conv-eof");
});

test("flushes the last visible thinking summary before promoting an EOF Agent answer", async () => {
  const fetchImpl = async () => new Response([
    'data: {"event":"agent_message","answer":"<think>隐藏推理</think>最终","conversation_id":"conv-eof-round"}',
    'data: {"event":"agent_message","answer":"结论","conversation_id":"conv-eof-round"}'
  ].join("\n\n"), {
    status: 200,
    headers: { "Content-Type": "text/event-stream" }
  });
  const emitted = [];

  const result = await streamDifyChat({
    apiKey: "app-eof-round-secret",
    query: "长任务",
    user: "yd-user-eof-round",
    fetchImpl,
    onEvent(event) {
      emitted.push(event);
    }
  });

  const summaryDeltas = emitted
    .filter((event) => event.type === "process" && event.step?.id === "agent-message-1")
    .map((event) => String(event.step.detailDelta || ""))
    .join("");
  const lastSummaryIndex = emitted.findLastIndex((event) => (
    event.type === "process" && event.step?.id === "agent-message-1"
  ));
  const answerIndex = emitted.findIndex((event) => event.type === "answer_replace");

  assert.equal(summaryDeltas, "最终结论");
  assert.equal(lastSummaryIndex < answerIndex, true, "阶段小结尾部必须先于正式正文到达");
  assert.equal(result.answer, "最终结论");
  assert.equal(JSON.stringify(emitted).includes("隐藏推理"), false);
});
