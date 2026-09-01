const assert = require("node:assert/strict");
const test = require("node:test");

/**
 * 加载待实现的查询引擎。
 *
 * 为什么要捕获模块不存在的异常：测试必须先于生产代码创建。第一次执行时，
 * 查询引擎还不存在；这里把“模块不存在”转换成普通断言失败，确保红灯来自
 * 缺少功能，而不是测试文件自身崩溃。
 *
 * @returns {Record<string, Function>} 查询引擎导出的函数集合。
 * @throws {Error} 本函数不主动抛异常；模块缺失时返回空对象。
 */
function loadEngine() {
  try {
    return require("../query-engine.js");
  } catch (error) {
    if (error && error.code === "MODULE_NOT_FOUND") {
      return {};
    }
    throw error;
  }
}

const engine = loadEngine();
const APP_ID = "11111111-1111-4111-8111-111111111111";

/**
 * 创建只按预设顺序返回 JSON 的离线客户端。
 *
 * 这个假客户端不接触网络，只记录查询引擎真正构造出的路径和参数。测试由此
 * 验证我们自己的分页、筛选和白名单合同，而不是验证一个虚构的 HTTP mock。
 *
 * @param {Array<unknown>} responses - 每次 GET 依次返回的完整 Dify 风格响应。
 * @returns {{ getJson: Function, calls: Array<{ path: string, params: Record<string, unknown> }> }} 客户端函数和调用记录。
 * @throws {Error} 预设响应耗尽时抛出，表示查询引擎发出了未预期请求。
 */
function createRecordingClient(responses) {
  const queue = [...responses];
  const calls = [];

  return {
    calls,
    async getJson(path, params = {}) {
      calls.push({ path, params: { ...params } });
      if (!queue.length) {
        throw new Error(`未预期的离线 GET：${path}`);
      }
      return queue.shift();
    }
  };
}

test("parseDifyLogsUrl 只接受 Dify Cloud 的应用日志页", () => {
  assert.equal(typeof engine.parseDifyLogsUrl, "function");

  assert.deepEqual(
    engine.parseDifyLogsUrl(`https://cloud.dify.ai/app/${APP_ID}/logs`),
    {
      origin: "https://cloud.dify.ai",
      appId: APP_ID
    }
  );
  assert.equal(
    engine.parseDifyLogsUrl(`https://cloud.dify.ai/app/${APP_ID}/workflow`),
    null
  );
  assert.equal(
    engine.parseDifyLogsUrl(`https://evil.example/app/${APP_ID}/logs`),
    null
  );
  assert.equal(engine.parseDifyLogsUrl("not-a-url"), null);
});

test("buildTimeWindow 把今天和自定义输入固定解释为北京时间", () => {
  assert.equal(typeof engine.buildTimeWindow, "function");

  const now = new Date("2026-08-20T02:30:00.000Z");
  assert.deepEqual(engine.buildTimeWindow({ preset: "today" }, now), {
    start: "2026-08-20T00:00:00+08:00",
    end: "2026-08-20T10:30:00+08:00",
    timezone: "Asia/Shanghai"
  });
  assert.deepEqual(engine.buildTimeWindow({ preset: "recent-1h" }, now), {
    start: "2026-08-20T09:30:00+08:00",
    end: "2026-08-20T10:30:00+08:00",
    timezone: "Asia/Shanghai"
  });
  assert.deepEqual(
    engine.buildTimeWindow({
      preset: "custom",
      start: "2026-08-20T08:15",
      end: "2026-08-20T09:45"
    }, now),
    {
      start: "2026-08-20T08:15:00+08:00",
      end: "2026-08-20T09:45:00+08:00",
      timezone: "Asia/Shanghai"
    }
  );
  assert.throws(
    () => engine.buildTimeWindow({ preset: "custom", start: "", end: "" }, now),
    /起止时间/
  );
});

test("isAllowedConsoleUrl 只允许当前应用的六类 Console GET 路径", () => {
  assert.equal(typeof engine.isAllowedConsoleUrl, "function");

  const base = `https://cloud.dify.ai/console/api/apps/${APP_ID}`;
  const allowed = [
    `${base}/chat-conversations`,
    `${base}/chat-messages`,
    `${base}/advanced-chat/workflow-runs`,
    `${base}/advanced-chat/workflow-runs/count`,
    `${base}/workflow-runs/run-1`,
    `${base}/workflow-runs/run-1/node-executions`
  ];

  allowed.forEach((url) => assert.equal(engine.isAllowedConsoleUrl(url, APP_ID), true, url));
  assert.equal(engine.isAllowedConsoleUrl(`${base}/delete`, APP_ID), false);
  assert.equal(
    engine.isAllowedConsoleUrl(
      "https://cloud.dify.ai/console/api/apps/22222222-2222-4222-8222-222222222222/chat-conversations",
      APP_ID
    ),
    false
  );
  assert.equal(
    engine.isAllowedConsoleUrl(`https://evil.example/console/api/apps/${APP_ID}/chat-conversations`, APP_ID),
    false
  );
});

test("safeRun 只保留运维白名单并把原始错误归类", () => {
  assert.equal(typeof engine.safeRun, "function");

  const safe = engine.safeRun(
    {
      id: "run-1",
      conversation_id: "conversation-1",
      status: "failed",
      triggered_from: "app-run",
      created_at: "2026-08-20T08:00:00+08:00",
      finished_at: "2026-08-20T08:00:05+08:00",
      elapsed_time: 5,
      total_steps: 2,
      total_tokens: 88,
      error: "HTTP 402 private account detail",
      inputs: { secret: "never-render" },
      outputs: { answer: "never-render" }
    },
    [{
      id: "node-1",
      node_id: "model-node",
      title: "Agent",
      node_type: "llm",
      status: "failed",
      error_category: "余额或计费边界"
    }]
  );

  assert.deepEqual(Object.keys(safe).sort(), [
    "conversation_id",
    "created_at",
    "elapsed_time",
    "error_category",
    "failed_nodes",
    "finished_at",
    "id",
    "status",
    "total_steps",
    "total_tokens",
    "triggered_from"
  ]);
  assert.equal(safe.error_category, "余额或计费边界");
  assert.equal(JSON.stringify(safe).includes("private account detail"), false);
  assert.equal(JSON.stringify(safe).includes("never-render"), false);
});

test("queryLogs 对 keyword 候选再次严格匹配用户 ID", async () => {
  assert.equal(typeof engine.queryLogs, "function");

  const client = createRecordingClient([
    {
      data: [
        {
          id: "conversation-exact",
          from_end_user_session_id: "129155",
          created_at: "2026-08-20T09:00:00+08:00"
        },
        {
          id: "conversation-fuzzy",
          from_end_user_session_id: "1291550",
          created_at: "2026-08-20T09:01:00+08:00"
        }
      ],
      has_more: false
    },
    {
      data: [
        {
          id: "run-exact",
          conversation_id: "conversation-exact",
          status: "failed",
          created_at: "2026-08-20T09:05:00+08:00"
        },
        {
          id: "run-fuzzy",
          conversation_id: "conversation-fuzzy",
          status: "failed",
          created_at: "2026-08-20T09:06:00+08:00"
        }
      ],
      has_more: false
    },
    {
      data: {
        id: "run-exact",
        conversation_id: "conversation-exact",
        status: "failed",
        triggered_from: "app-run",
        created_at: "2026-08-20T09:05:00+08:00",
        finished_at: "2026-08-20T09:05:03+08:00",
        elapsed_time: 3,
        total_steps: 1,
        total_tokens: 25,
        error: "Plugin Daemon private original error",
        inputs: { query: "customer content" }
      }
    },
    {
      data: [{
        id: "node-1",
        node_id: "tool-node",
        title: "工具调用",
        node_type: "tool",
        status: "failed",
        elapsed_time: 2,
        created_at: "2026-08-20T09:05:00+08:00",
        finished_at: "2026-08-20T09:05:02+08:00",
        retry_index: 0,
        error: "Plugin Daemon private node error",
        inputs: { private: true },
        outputs: { private: true }
      }]
    }
  ]);

  const report = await engine.queryLogs({
    getJson: client.getJson,
    appId: APP_ID,
    mode: "user-failed",
    userId: "129155",
    start: "2026-08-20T08:00:00+08:00",
    end: "2026-08-20T10:00:00+08:00",
    maxPages: 30
  });

  assert.equal(report.read_only, true);
  assert.equal(report.summary.candidate_conversations, 1);
  assert.equal(report.summary.failed_list_records, 1);
  assert.equal(report.summary.matched_runs, 1);
  assert.equal(report.summary.runs[0].id, "run-exact");
  assert.equal(report.summary.runs[0].error_category, "Plugin Daemon 异常");
  assert.deepEqual(report.summary.runs[0].failed_nodes, []);
  assert.deepEqual(report.summary.errors_by_category, [
    { category: "Plugin Daemon 异常", count: 1, percentage: 100 }
  ]);
  assert.equal(JSON.stringify(report).includes("customer content"), false);
  assert.equal(JSON.stringify(report).includes("private original error"), false);
  assert.deepEqual(client.calls[0].params, {
    keyword: "129155",
    page: 1,
    limit: 100,
    start: "2026-08-20 08:00",
    end: "2026-08-20 10:00",
    sort_by: "-created_at",
    annotation_status: "all"
  });
  assert.deepEqual(client.calls[1].params, {
    triggered_from: "app-run",
    status: "failed",
    limit: 100
  });
  assert.equal(client.calls.some((call) => call.path.endsWith("node-executions")), false);

  const categoryResult = await engine.loadErrorCategory({
    getJson: client.getJson,
    appId: APP_ID,
    runIds: ["run-exact"]
  });
  assert.equal(categoryResult.runs[0].failed_nodes[0].error_category, "Plugin Daemon 异常");

  // 第二次展开同一分类必须命中五分钟脱敏内存缓存，不再发送详情或节点请求。
  const callsAfterFirstExpansion = client.calls.length;
  await engine.loadErrorCategory({
    getJson: client.getJson,
    appId: APP_ID,
    runIds: ["run-exact"]
  });
  assert.equal(client.calls.length, callsAfterFirstExpansion);
});

test("queryLogs 使用 last_id 分页并在整页早于起点后完整停止", async () => {
  assert.equal(typeof engine.queryLogs, "function");

  const client = createRecordingClient([
    {
      data: [{
        id: "run-in-window",
        conversation_id: "conversation-1",
        status: "failed",
        created_at: "2026-08-20T09:00:00+08:00"
      }],
      has_more: true
    },
    {
      data: [{
        id: "run-before-window",
        conversation_id: "conversation-old",
        status: "failed",
        created_at: "2026-08-20T06:00:00+08:00"
      }],
      has_more: true
    },
    {
      data: {
        id: "run-in-window",
        conversation_id: "conversation-1",
        status: "failed",
        created_at: "2026-08-20T09:00:00+08:00",
        error: "timeout private"
      }
    },
    { data: [] }
  ]);

  const report = await engine.queryLogs({
    getJson: client.getJson,
    appId: APP_ID,
    mode: "app-failed",
    start: "2026-08-20T08:00:00+08:00",
    end: "2026-08-20T10:00:00+08:00",
    maxPages: 30
  });

  assert.equal(client.calls[1].params.last_id, "run-in-window");
  assert.equal(report.summary.failed_run_pages, 2);
  assert.equal(report.summary.failed_run_window_complete, true);
  assert.equal(report.summary.failed_run_pages_truncated, false);
  assert.equal(report.summary.matched_runs, 1);
});

test("queryLogs 按每个失败 Run 的主要错误类型聚合数量和占比", async () => {
  const calls = [];
  const getJson = async (requestPath) => {
    calls.push(requestPath);
    if (requestPath.endsWith("advanced-chat/workflow-runs")) {
      return {
        data: [
          { id: "run-timeout-1", status: "failed", created_at: "2026-08-20T09:10:00+08:00" },
          { id: "run-timeout-2", status: "failed", created_at: "2026-08-20T09:08:00+08:00" },
          { id: "run-limit", status: "failed", created_at: "2026-08-20T09:06:00+08:00" }
        ],
        has_more: false
      };
    }
    const runMatch = requestPath.match(/workflow-runs\/(run-[^/]+)$/);
    if (runMatch) {
      const error = runMatch[1] === "run-limit" ? "429 private detail" : "request timeout private detail";
      return { data: { id: runMatch[1], status: "failed", created_at: "2026-08-20T09:05:00+08:00", error } };
    }
    if (requestPath.endsWith("node-executions")) {
      return { data: [] };
    }
    throw new Error(`未预期的离线 GET：${requestPath}`);
  };

  const report = await engine.queryLogs({
    getJson,
    appId: APP_ID,
    mode: "app-failed",
    start: "2026-08-20T08:00:00+08:00",
    end: "2026-08-20T10:00:00+08:00"
  });

  assert.deepEqual(report.summary.errors_by_category, [
    { category: "请求超时", count: 2, percentage: 66.7 },
    { category: "限流", count: 1, percentage: 33.3 }
  ]);
  assert.equal(calls.some((requestPath) => requestPath.endsWith("node-executions")), false);
  assert.equal(JSON.stringify(report).includes("private detail"), false);
});

test("失败查询以六并发加载 Run 详情，并在完成前持续输出脱敏聚合快照", async () => {
  const runCount = 12;
  const partialReports = [];
  let activeDetails = 0;
  let maxActiveDetails = 0;
  const getJson = async (requestPath) => {
    if (requestPath.endsWith("advanced-chat/workflow-runs")) {
      return {
        data: Array.from({ length: runCount }, (_, index) => ({
          id: `run-progress-${index}`,
          status: "failed",
          conversation_id: `conversation-${index}`,
          created_at: `2026-08-20T09:${String(index).padStart(2, "0")}:00+08:00`
        })),
        has_more: false
      };
    }
    if (/workflow-runs\/run-progress-\d+$/.test(requestPath)) {
      activeDetails += 1;
      maxActiveDetails = Math.max(maxActiveDetails, activeDetails);
      await new Promise((resolve) => setTimeout(resolve, 10));
      activeDetails -= 1;
      return {
        data: {
          id: requestPath.split("/").at(-1),
          status: "failed",
          error: requestPath.endsWith("-0") ? "429 private detail" : "timeout private detail",
          created_at: "2026-08-20T09:00:00+08:00"
        }
      };
    }
    throw new Error(`未预期的离线 GET：${requestPath}`);
  };

  const report = await engine.queryLogs({
    getJson,
    appId: APP_ID,
    mode: "app-failed",
    start: "2026-08-20T08:00:00+08:00",
    end: "2026-08-20T10:00:00+08:00",
    onPartial(partial) {
      partialReports.push(partial);
    }
  });

  assert.equal(maxActiveDetails, 6);
  assert.equal(report.summary.classified_runs, runCount);
  assert.equal(report.summary.matched_runs, runCount);
  assert.equal(partialReports.some((partial) => (
    partial.partial === true
    && partial.summary.classified_runs > 0
    && partial.summary.classified_runs < runCount
  )), true);
  assert.equal(partialReports.every((partial) => JSON.stringify(partial).includes("private detail") === false), true);
});

test("queryLogs 的成本模式只汇总指定 Conversation，并且不会只查询失败运行", async () => {
  assert.equal(typeof engine.queryLogs, "function");

  const calls = [];
  const getJson = async (requestPath, params = {}) => {
    calls.push({ path: requestPath, params: { ...params } });

    if (requestPath.endsWith("advanced-chat/workflow-runs")) {
      return {
        data: [
          { id: "run-usd", conversation_id: "conversation-cost", status: "succeeded", created_at: "2026-08-20T09:10:00+08:00" },
          { id: "run-rmb", conversation_id: "conversation-cost", status: "failed", created_at: "2026-08-20T09:08:00+08:00" },
          { id: "run-eur", conversation_id: "conversation-other", status: "succeeded", created_at: "2026-08-20T09:06:00+08:00" },
          { id: "run-unpriced", conversation_id: "conversation-cost", status: "succeeded", created_at: "2026-08-20T09:04:00+08:00" }
        ],
        has_more: false
      };
    }

    if (requestPath.endsWith("workflow-runs/run-usd/node-executions")) {
      return {
        data: [
          { id: "node-usd-1", status: "succeeded", execution_metadata: { total_price: "0.001", currency: "USD" } },
          { id: "node-usd-2", status: "succeeded", total_price: 0.002, currency: "usd" }
        ]
      };
    }
    if (requestPath.endsWith("workflow-runs/run-rmb/node-executions")) {
      return {
        data: [{ id: "node-rmb", status: "failed", execution_metadata: { total_price: "0.5", currency: "RMB" } }]
      };
    }
    if (requestPath.endsWith("workflow-runs/run-eur/node-executions")) {
      return {
        data: [{ id: "node-eur", status: "succeeded", execution_metadata: { total_price: "0.03", currency: "EUR" } }]
      };
    }
    if (requestPath.endsWith("workflow-runs/run-unpriced/node-executions")) {
      return { data: [{ id: "node-no-price", status: "succeeded" }] };
    }
    throw new Error(`未预期的离线 GET：${requestPath}`);
  };

  const report = await engine.queryLogs({
    getJson,
    appId: APP_ID,
    mode: "cost",
    conversationId: "conversation-cost",
    start: "2026-08-20T08:00:00+08:00",
    end: "2026-08-20T10:00:00+08:00",
    maxPages: 30,
    onPartial(partial) {
      assert.equal(JSON.stringify(partial).includes("execution_metadata"), false);
    }
  });

  const listCall = calls.find((call) => call.path.endsWith("advanced-chat/workflow-runs"));
  assert.deepEqual(listCall.params, { triggered_from: "app-run", limit: 100 });
  assert.equal(calls.some((call) => /workflow-runs\/run-[^/]+$/.test(call.path)), false);
  assert.equal(calls.some((call) => call.path.endsWith("run-eur/node-executions")), false);
  assert.equal(report.summary.conversation_id, "conversation-cost");
  assert.equal(report.summary.matched_runs, 3);
  assert.equal(report.summary.priced_runs, 2);
  assert.equal(report.summary.unpriced_runs, 1);
  assert.deepEqual(report.summary.cost_by_currency, [
    { currency: "RMB", total_price: 0.5, run_count: 1, node_count: 1 },
    { currency: "USD", total_price: 0.003, run_count: 1, node_count: 2 }
  ]);
  assert.deepEqual(
    report.summary.runs.find((run) => run.id === "run-usd").costs,
    [{ currency: "USD", total_price: 0.003, node_count: 2 }]
  );
  assert.equal(JSON.stringify(report).includes("execution_metadata"), false);
});

test("queryLogs 的成本模式可用用户 ID 严格交叉校验指定 Conversation", async () => {
  const calls = [];
  const getJson = async (requestPath, params = {}) => {
    calls.push({ path: requestPath, params: { ...params } });
    if (requestPath.endsWith("chat-conversations")) {
      return {
        data: [
          {
            id: "conversation-cost-verified",
            from_end_user_session_id: "user-cost",
            created_at: "2026-01-01T09:00:00+08:00"
          },
          {
            id: "conversation-fuzzy",
            from_end_user_session_id: "user-cost-other",
            created_at: "2026-08-20T09:00:00+08:00"
          }
        ],
        has_more: false
      };
    }
    if (requestPath.endsWith("advanced-chat/workflow-runs")) {
      return {
        data: [
          {
            id: "run-cost-verified",
            conversation_id: "conversation-cost-verified",
            status: "succeeded",
            created_at: "2026-08-20T09:10:00+08:00"
          },
          {
            id: "run-cost-other",
            conversation_id: "conversation-cost-other",
            status: "succeeded",
            created_at: "2026-08-20T09:08:00+08:00"
          }
        ],
        has_more: false
      };
    }
    if (requestPath.endsWith("run-cost-verified/node-executions")) {
      return {
        data: [{
          id: "node-cost-verified",
          status: "succeeded",
          execution_metadata: { total_price: "0.01", currency: "USD" }
        }]
      };
    }
    throw new Error(`未预期的离线 GET：${requestPath}`);
  };

  const report = await engine.queryLogs({
    getJson,
    appId: APP_ID,
    mode: "cost",
    userId: "user-cost",
    conversationId: "conversation-cost-verified",
    start: "2026-08-20T08:00:00+08:00",
    end: "2026-08-20T10:00:00+08:00",
    maxPages: 30
  });

  const conversationCall = calls.find((call) => call.path.endsWith("chat-conversations"));
  assert.equal(conversationCall.params.keyword, "user-cost");
  assert.equal(Object.hasOwn(conversationCall.params, "start"), false);
  assert.equal(Object.hasOwn(conversationCall.params, "end"), false);
  assert.equal(report.user, "user-cost");
  assert.equal(report.summary.conversation_id, "conversation-cost-verified");
  assert.equal(report.summary.conversation_user_verified, true);
  assert.deepEqual(report.summary.runs.map((run) => run.id), ["run-cost-verified"]);
  assert.equal(calls.some((call) => call.path.endsWith("run-cost-other/node-executions")), false);
});

test("queryLogs 的成本模式必须填写 Conversation ID", async () => {
  await assert.rejects(
    () => engine.queryLogs({
      getJson: async () => ({ data: [], has_more: false }),
      appId: APP_ID,
      mode: "cost",
      start: "2026-08-20T08:00:00+08:00",
      end: "2026-08-20T10:00:00+08:00"
    }),
    (error) => error.code === "MISSING_CONVERSATION_ID"
  );
});

test("queryLogs 的 marker 模式只返回包含 marker 的 workflow run", async () => {
  assert.equal(typeof engine.queryLogs, "function");

  const marker = "TRACE-20260820-XYZ";
  const client = createRecordingClient([
    {
      data: [{
        id: "conversation-marker",
        from_end_user_session_id: "129155",
        created_at: "2026-08-20T09:00:00+08:00"
      }],
      has_more: false
    },
    {
      data: [
        { id: "message-1", query: `诊断 ${marker}`, workflow_run_id: "run-marker" },
        { id: "message-2", query: "其他请求", workflow_run_id: "run-other" }
      ]
    },
    {
      data: {
        id: "run-marker",
        conversation_id: "conversation-marker",
        status: "failed",
        created_at: "2026-08-20T09:02:00+08:00",
        error: "503 private service detail"
      }
    },
    { data: [] }
  ]);

  const report = await engine.queryLogs({
    getJson: client.getJson,
    appId: APP_ID,
    mode: "marker",
    userId: "129155",
    marker,
    start: "2026-08-20T08:00:00+08:00",
    end: "2026-08-20T10:00:00+08:00",
    maxPages: 30
  });

  assert.equal(report.summary.matched_messages, 1);
  assert.equal(report.summary.matched_runs, 1);
  assert.equal(report.summary.runs[0].id, "run-marker");
  assert.equal(JSON.stringify(report).includes(marker), false);
  assert.equal(JSON.stringify(report).includes("private service detail"), false);
});

test("queryLogs 的 marker 模式返回全部匹配 run，并按创建时间从新到旧排列", async () => {
  const marker = "一段可识别的对话内容";
  const calls = [];
  const getJson = async (requestPath) => {
    calls.push(requestPath);
    if (requestPath.endsWith("chat-conversations")) {
      return {
        data: [{
          id: "conversation-multiple",
          from_end_user_session_id: "129155",
          created_at: "2026-08-20T09:00:00+08:00"
        }],
        has_more: false
      };
    }
    if (requestPath.endsWith("chat-messages")) {
      return {
        data: [
          { query: marker, workflow_run_id: "run-older" },
          { answer: `再次提到：${marker}`, workflow_run_id: "run-newer" }
        ]
      };
    }
    if (requestPath.endsWith("workflow-runs/run-older")) {
      return { data: { id: "run-older", status: "failed", created_at: "2026-08-20T09:01:00+08:00" } };
    }
    if (requestPath.endsWith("workflow-runs/run-newer")) {
      return { data: { id: "run-newer", status: "failed", created_at: "2026-08-20T09:08:00+08:00" } };
    }
    if (requestPath.endsWith("node-executions")) {
      return { data: [] };
    }
    throw new Error(`未预期的离线 GET：${requestPath}`);
  };

  const report = await engine.queryLogs({
    getJson,
    appId: APP_ID,
    mode: "marker",
    userId: "129155",
    marker,
    start: "2026-08-20T08:00:00+08:00",
    end: "2026-08-20T10:00:00+08:00"
  });

  assert.equal(report.summary.matched_runs, 2);
  assert.deepEqual(report.summary.runs.map((run) => run.id), ["run-newer", "run-older"]);
  assert.equal(calls.filter((path) => path.endsWith("node-executions")).length, 2);
});

test("queryLogs 的 marker 模式允许不填用户 ID，并在时间范围内扫描会话", async () => {
  const marker = "一段有辨识度的对话原文";
  const client = createRecordingClient([
    {
      data: [{
        id: "conversation-without-user-filter",
        from_end_user_session_id: "unknown-user",
        created_at: "2026-08-20T09:00:00+08:00"
      }],
      has_more: false
    },
    {
      data: [{ query: marker, workflow_run_id: "run-without-user-filter" }]
    },
    {
      data: {
        id: "run-without-user-filter",
        status: "failed",
        created_at: "2026-08-20T09:03:00+08:00"
      }
    },
    { data: [] }
  ]);

  const report = await engine.queryLogs({
    getJson: client.getJson,
    appId: APP_ID,
    mode: "marker",
    marker,
    start: "2026-08-20T08:00:00+08:00",
    end: "2026-08-20T10:00:00+08:00"
  });

  assert.equal(Object.hasOwn(client.calls[0].params, "keyword"), false);
  assert.equal(report.user, null);
  assert.equal(report.summary.candidate_conversations, 1);
  assert.equal(report.summary.runs[0].id, "run-without-user-filter");
});

test("queryLogs 可以只凭 Run ID 直接读取一次运行，不查询用户会话或时间窗口", async () => {
  const calls = [];
  const getJson = async (requestPath) => {
    calls.push(requestPath);
    if (requestPath.endsWith("workflow-runs/run-direct")) {
      return {
        data: {
          id: "run-direct",
          status: "failed",
          created_at: "2026-08-20T09:08:00+08:00",
          error: "timeout private detail"
        }
      };
    }
    if (requestPath.endsWith("workflow-runs/run-direct/node-executions")) {
      return { data: [] };
    }
    throw new Error(`未预期的离线 GET：${requestPath}`);
  };

  const report = await engine.queryLogs({
    getJson,
    appId: APP_ID,
    mode: "run-id",
    runId: "run-direct"
  });

  assert.equal(report.mode, "run-id");
  assert.equal(report.window, null);
  assert.equal(report.summary.matched_runs, 1);
  assert.equal(report.summary.runs[0].id, "run-direct");
  assert.deepEqual(calls, [
    `/apps/${APP_ID}/workflow-runs/run-direct`,
    `/apps/${APP_ID}/workflow-runs/run-direct/node-executions`
  ]);
});

test("queryLogs 不把详情阶段的鉴权或 402 错误降级成普通覆盖缺口", async () => {
  const fatalCodes = [
    "AUTH_EXPIRED",
    "AUTH_CONTEXT_MISSING",
    "DIFY_PAYMENT_REQUIRED",
    "QUERY_CANCELLED"
  ];

  for (const code of fatalCodes) {
    const getJson = async (requestPath) => {
      if (requestPath.endsWith("advanced-chat/workflow-runs")) {
        return {
          data: [{
            id: "run-auth",
            status: "failed",
            created_at: "2026-08-20T09:00:00+08:00"
          }],
          has_more: false
        };
      }
      throw new engine.QueryError("安全错误", code);
    };

    await assert.rejects(
      () => engine.queryLogs({
        getJson,
        appId: APP_ID,
        mode: "app-failed",
        start: "2026-08-20T08:00:00+08:00",
        end: "2026-08-20T10:00:00+08:00",
        maxPages: 1
      }),
      (error) => error.code === code,
      `${code} 必须冒泡给后台执行明确的刷新、停止或提示策略`
    );
  }
});
