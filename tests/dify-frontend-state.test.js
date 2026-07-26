const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const {
  CHAT_FEATURE_IDS,
  applyDifyStreamEventToMessage,
  buildKassCrudMotionPlan,
  createDifySseEventParser,
  createFeatureConfigState,
  createFeatureSessionState,
  formatDifyThinkingDuration,
  getKassCrudMotionPhases,
  getKassStreamRenderPlan,
  getKassProcessPresentation,
  getFriendlyConfigError,
  isDifyChatFeature
} = require("../src/dify-config");

test("classifies every visible KASS CRM CRUD change for cross-column motion", () => {
  assert.equal(
    typeof buildKassCrudMotionPlan,
    "function",
    "KASS 前端状态层应提供完整 CRUD 动画差异规划器"
  );

  const before = {
    customer: {
      summary: {
        name: "Nordic Trail GmbH",
        level: "B",
        country: "德国",
        stage: "报价跟进"
      },
      profile: {
        overview: "德国户外零售商",
        companySize: "51–100 人"
      }
    },
    followups: [
      {
        id: "followup-edit",
        title: "报价沟通",
        summary: "客户正在比较报价",
        tasks: [
          { id: "task-complete", title: "发送报价", dueDate: "7/26", status: "待处理" },
          { id: "task-reopen", title: "确认 Logo", dueDate: "7/27", status: "已完成" },
          { id: "task-update", title: "准备样品", dueDate: "7/28", status: "待处理" },
          { id: "task-remove", title: "旧待办", dueDate: "7/25", status: "待处理" }
        ]
      },
      {
        id: "followup-remove",
        title: "过期沟通",
        summary: "这条记录应删除",
        tasks: [
          { id: "nested-remove", title: "随记录删除", dueDate: "7/25", status: "待处理" }
        ]
      }
    ]
  };
  const after = {
    customer: {
      summary: {
        name: "Nordic Trail GmbH",
        level: "A",
        country: "德国",
        stage: "待客户确认"
      },
      profile: {
        overview: "德国户外生活方式零售商",
        companySize: "101–200 人"
      }
    },
    followups: [
      {
        id: "followup-edit",
        title: "更新后的报价沟通",
        summary: "客户已确认 MOQ，等待最终报价",
        tasks: [
          { id: "task-complete", title: "发送报价", dueDate: "7/26", status: "已完成" },
          { id: "task-reopen", title: "确认 Logo", dueDate: "7/27", status: "待处理" },
          { id: "task-update", title: "准备打样方案", dueDate: "7/29", status: "待处理" },
          { id: "task-add", title: "预约复盘", dueDate: "7/30", status: "待处理" }
        ]
      },
      {
        id: "followup-add",
        title: "电话复盘",
        summary: "客户确认下一步安排",
        tasks: [
          { id: "nested-add", title: "随记录新增", dueDate: "7/31", status: "待处理" }
        ]
      }
    ]
  };

  assert.deepEqual(buildKassCrudMotionPlan(before, after), {
    customerUpdates: [
      { id: "customer-summary", title: "客户资料", target: "summary" },
      { id: "customer-profile", title: "背调资料", target: "profile" }
    ],
    completedTasks: [
      { id: "task-complete", title: "发送报价", followupId: "followup-edit" }
    ],
    reopenedTasks: [
      { id: "task-reopen", title: "确认 Logo", followupId: "followup-edit" }
    ],
    addedTasks: [
      { id: "task-add", title: "预约复盘", followupId: "followup-edit" }
    ],
    updatedTasks: [
      { id: "task-update", title: "准备打样方案", followupId: "followup-edit" }
    ],
    removedTasks: [
      { id: "task-remove", title: "旧待办", followupId: "followup-edit" }
    ],
    addedFollowups: [
      { id: "followup-add", title: "电话复盘" }
    ],
    updatedFollowups: [
      { id: "followup-edit", title: "更新后的报价沟通" }
    ],
    removedFollowups: [
      { id: "followup-remove", title: "过期沟通" }
    ]
  });
});

test("does not double-animate tasks inside an added or removed followup", () => {
  assert.equal(
    typeof buildKassCrudMotionPlan,
    "function",
    "KASS 前端状态层应提供完整 CRUD 动画差异规划器"
  );

  const before = {
    customer: { summary: {}, profile: {} },
    followups: [
      {
        id: "followup-remove",
        title: "删除整条",
        tasks: [{ id: "task-remove-with-parent", title: "随父记录删除", status: "待处理" }]
      }
    ]
  };
  const after = {
    customer: { summary: {}, profile: {} },
    followups: [
      {
        id: "followup-add",
        title: "新增整条",
        tasks: [{ id: "task-add-with-parent", title: "随父记录新增", status: "待处理" }]
      }
    ]
  };

  const plan = buildKassCrudMotionPlan(before, after);

  assert.deepEqual(plan.addedFollowups, [{ id: "followup-add", title: "新增整条" }]);
  assert.deepEqual(plan.removedFollowups, [{ id: "followup-remove", title: "删除整条" }]);
  assert.deepEqual(plan.addedTasks, []);
  assert.deepEqual(plan.removedTasks, []);
});

test("plays removals before the right pane refresh and all surviving CRUD feedback after it", () => {
  assert.equal(
    typeof getKassCrudMotionPhases,
    "function",
    "KASS 动画应提供删除前和刷新后的两段编排"
  );

  const phases = getKassCrudMotionPhases({
    customerUpdates: [
      { id: "customer-summary", title: "客户资料", target: "summary" },
      { id: "customer-profile", title: "背调资料", target: "profile" }
    ],
    completedTasks: [{ id: "task-done", title: "完成报价", followupId: "followup-1" }],
    reopenedTasks: [{ id: "task-reopen", title: "重新确认", followupId: "followup-1" }],
    addedTasks: [{ id: "task-add", title: "新增复盘", followupId: "followup-1" }],
    updatedTasks: [{ id: "task-update", title: "更新样品", followupId: "followup-1" }],
    removedTasks: [{ id: "task-remove", title: "旧待办", followupId: "followup-1" }],
    addedFollowups: [{ id: "followup-add", title: "新增电话记录" }],
    updatedFollowups: [{ id: "followup-update", title: "更新邮件记录" }],
    removedFollowups: [{ id: "followup-remove", title: "删除过期记录" }]
  });

  assert.deepEqual(phases.beforeRefresh, [
    {
      id: "task-remove",
      title: "旧待办",
      followupId: "followup-1",
      entity: "task",
      operation: "remove",
      label: "移除待办 · 旧待办"
    },
    {
      id: "followup-remove",
      title: "删除过期记录",
      entity: "followup",
      operation: "remove",
      label: "删除跟进 · 删除过期记录"
    }
  ]);
  assert.deepEqual(
    phases.afterRefresh.map(({ entity, operation, label }) => ({ entity, operation, label })),
    [
      { entity: "customer", operation: "update", label: "客户资料 · 已更新" },
      { entity: "profile", operation: "update", label: "背调资料 · 已更新" },
      { entity: "task", operation: "complete", label: "✓" },
      { entity: "task", operation: "reopen", label: "重新打开 · 重新确认" },
      { entity: "task", operation: "add", label: "新增待办 · 新增复盘" },
      { entity: "task", operation: "update", label: "更新待办 · 更新样品" },
      { entity: "followup", operation: "add", label: "新跟进 · 新增电话记录" },
      { entity: "followup", operation: "update", label: "更新跟进 · 更新邮件记录" }
    ]
  );
});

test("marks only real conversation pages as Dify-configurable", () => {
  assert.equal(isDifyChatFeature("ask"), true);
  assert.equal(isDifyChatFeature("customer-research"), true);
  assert.equal(isDifyChatFeature("yd-artifact"), true);
  assert.equal(isDifyChatFeature("market-research"), true);
  assert.equal(isDifyChatFeature("trade-show"), true);
  assert.equal(isDifyChatFeature("admin-cost-kb"), true);
  assert.equal(isDifyChatFeature("admin-cost-no-kb"), true);
  assert.equal(isDifyChatFeature("sales-prep"), false);
  assert.equal(isDifyChatFeature("customer-development"), false);
  assert.equal(isDifyChatFeature("customer-kass-a"), false);
  assert.equal(isDifyChatFeature("admin-home"), false);
  assert.equal(CHAT_FEATURE_IDS.includes("cold-email"), true);
});

test("defaults the total-controller skill pages to Chatflow while keeping Ask flexible", () => {
  assert.equal(createFeatureConfigState("customer-research").appType, "chatflow");
  assert.equal(createFeatureConfigState("yd-artifact").appType, "chatflow");
  assert.equal(createFeatureConfigState("market-research").appType, "chatflow");
  assert.equal(createFeatureConfigState("cold-email").appType, "chatflow");
  assert.equal(createFeatureConfigState("admin-cost-kb").appType, "chatflow");
  assert.equal(createFeatureConfigState("admin-cost-no-kb").appType, "chatflow");
  assert.equal(createFeatureConfigState("ask").appType, "dialogue");
  assert.equal(createFeatureConfigState("market-research").skillKey, "");
  assert.equal(createFeatureConfigState("market-research").skillKeyDraft, "");
});

test("renders the two real model choices and sends the selected model_key only for routed skills", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/app.js"), "utf8");

  assert.match(source, /DeepSeek V4 Flash/);
  assert.match(source, /Gemini 3\.5 Flash/);
  assert.match(source, /data-dify-skill-key/);
  assert.match(source, /inputs: config\.skillKey \? \{ model_key:/);
});

test("creates independent message and conversation state for every page", () => {
  const market = createFeatureSessionState("market-research", "fixed-seed");
  const coldEmail = createFeatureSessionState("cold-email", "fixed-seed");

  market.messages.push({ role: "user", content: "市场问题" });
  market.conversationId = "conv-market";

  assert.equal(coldEmail.messages.length, 0);
  assert.equal(coldEmail.conversationId, "");
  assert.equal(coldEmail.isGenerating, false);
  assert.notEqual(market.userId, coldEmail.userId);
});

test("turns browser network errors into clear Chinese configuration feedback", () => {
  assert.equal(getFriendlyConfigError(new Error("Failed to fetch")), "配置服务暂未连接，请稍后重试。");
  assert.equal(getFriendlyConfigError(new TypeError("Load failed")), "配置服务暂未连接，请稍后重试。");
  assert.equal(getFriendlyConfigError(new Error("API Key 无效")), "API Key 无效");
});

test("formats the completed thinking time in minutes and seconds", () => {
  assert.equal(formatDifyThinkingDuration(1_000, 9_000), "思考了 8 秒");
  assert.equal(formatDifyThinkingDuration(1_000, 130_999), "思考了 2 分 9 秒");
  assert.equal(formatDifyThinkingDuration(1_000, null, 9_000), "思考了 8 秒");
  assert.equal(formatDifyThinkingDuration(5_000, 4_000), "思考了 0 秒");
  assert.equal(formatDifyThinkingDuration(null, 9_000), "");
});

test("stops counting thinking time when the first visible answer arrives", () => {
  let message = {
    id: "assistant-timer",
    role: "assistant",
    content: "正在生成...",
    status: "loading",
    processSteps: [],
    currentProcess: null,
    processCollapsed: false,
    processExpanded: false,
    answerStarted: false,
    thinkingStartedAt: 1_000,
    thinkingEndedAt: null
  };

  message = applyDifyStreamEventToMessage(message, { type: "answer_delta", delta: "\n" }, 8_000);
  assert.equal(message.thinkingEndedAt, null);

  message = applyDifyStreamEventToMessage(message, { type: "answer_delta", delta: "正式结论" }, 130_999);
  assert.equal(message.thinkingEndedAt, 130_999);

  message = applyDifyStreamEventToMessage(message, { type: "done", result: {} }, 180_000);
  assert.equal(message.thinkingEndedAt, 130_999);
  assert.equal(formatDifyThinkingDuration(message.thinkingStartedAt, message.thinkingEndedAt), "思考了 2 分 9 秒");
});

test("shows the completed thinking time beside the process step count", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/app.js"), "utf8");
  const formatterStart = source.indexOf("function getDifyProcessSummary");
  const formatterEnd = source.indexOf("\n/**", formatterStart + 1);
  const sandbox = {
    message: { thinkingStartedAt: 1_000, thinkingEndedAt: 130_999 },
    renderedSummary: "",
    window: { YD_DIFY: { formatDifyThinkingDuration } }
  };

  assert.ok(formatterStart >= 0 && formatterEnd > formatterStart, "应找到过程摘要格式化函数");
  vm.runInNewContext(
    `${source.slice(formatterStart, formatterEnd)}\nrenderedSummary = getDifyProcessSummary(message, 8, false);`,
    sandbox
  );

  assert.equal(sandbox.renderedSummary, "8 个步骤 · 思考了 2 分 9 秒");
});

test("updates the visible thinking duration every second without rebuilding the page", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/app.js"), "utf8");
  const panelStart = source.indexOf("function renderDifyProcessPanel");
  const panelEnd = source.indexOf("\n/**", panelStart + 1);
  const tickerStart = source.indexOf("function startDifyThinkingDurationTicker");
  const tickerEnd = source.indexOf("\n/**", tickerStart + 1);
  const panelSource = source.slice(panelStart, panelEnd);
  const tickerSource = source.slice(tickerStart, tickerEnd);

  assert.ok(panelStart >= 0 && panelEnd > panelStart, "应找到过程区渲染函数");
  assert.ok(tickerStart >= 0 && tickerEnd > tickerStart, "应找到动态计时器函数");
  assert.match(panelSource, /data-dify-thinking-duration/);
  assert.match(tickerSource, /window\.setInterval\(/);
  assert.match(tickerSource, /refreshDifyThinkingDurationDom\(/);
  assert.doesNotMatch(tickerSource, /renderApp\(/);
});

test("starts the dynamic thinking ticker only for the pending Dify answer", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/app.js"), "utf8");
  const newChatStart = source.indexOf("function startNewChatConversation");
  const newChatEnd = source.indexOf("\n/**", newChatStart + 1);
  const senderStart = source.indexOf("async function sendDifyFeatureDraft");
  const senderEnd = source.indexOf("\n/**", senderStart + 1);
  const newChatSource = source.slice(newChatStart, newChatEnd);
  const senderSource = source.slice(senderStart, senderEnd);

  assert.doesNotMatch(newChatSource, /startDifyThinkingDurationTicker\(/);
  assert.match(senderSource, /renderApp\(\);\s*startDifyThinkingDurationTicker\(featureId, pendingAnswerId\);/);
});

test("replaces the visible process step while preserving expandable history", () => {
  let message = {
    id: "assistant-1",
    role: "assistant",
    content: "正在生成...",
    status: "loading",
    processSteps: [],
    currentProcess: null,
    processCollapsed: false,
    processExpanded: false,
    answerStarted: false
  };

  message = applyDifyStreamEventToMessage(message, {
    type: "process",
    step: { id: "reason-1", kind: "reasoning", label: "正在分析问题", detail: "", status: "running" }
  });
  message = applyDifyStreamEventToMessage(message, {
    type: "process",
    step: { id: "tool-1", kind: "tool", label: "正在调用 Tavily Search", detail: "德国储能市场", status: "running" }
  });

  assert.equal(message.currentProcess.label, "正在调用 Tavily Search");
  assert.equal(message.currentProcess.detail, "德国储能市场");
  assert.equal(message.processSteps.length, 2);
  assert.equal(message.processCollapsed, false);
});

test("collapses process history when the first final answer chunk arrives", () => {
  let message = {
    id: "assistant-2",
    role: "assistant",
    content: "正在生成...",
    status: "loading",
    processSteps: [{ id: "node-1", kind: "node", label: "正在执行搜索", detail: "", status: "running" }],
    currentProcess: { id: "node-1", kind: "node", label: "正在执行搜索", detail: "", status: "running" },
    processCollapsed: false,
    processExpanded: true,
    answerStarted: false
  };

  message = applyDifyStreamEventToMessage(message, { type: "answer_delta", delta: "正式" });
  message = applyDifyStreamEventToMessage(message, { type: "answer_delta", delta: "结论" });
  message = applyDifyStreamEventToMessage(message, {
    type: "done",
    result: { conversation_id: "conv-2", metadata: { usage: { total_tokens: 9 } }, billing_trace: {} }
  });

  assert.equal(message.content, "正式结论");
  assert.equal(message.answerStarted, true);
  assert.equal(message.processCollapsed, true);
  assert.equal(message.processExpanded, false);
  assert.equal(message.status, "done");
  assert.equal(message.conversationId, "conv-2");
});

test("keeps the live process open when Dify only streams leading whitespace", () => {
  const message = applyDifyStreamEventToMessage({
    id: "assistant-whitespace",
    role: "assistant",
    content: "正在生成...",
    status: "loading",
    processSteps: [{ id: "node-1", kind: "node", label: "正在搜索", detail: "", status: "running" }],
    currentProcess: { id: "node-1", kind: "node", label: "正在搜索", detail: "", status: "running" },
    processCollapsed: false,
    processExpanded: false,
    answerStarted: false
  }, { type: "answer_delta", delta: "\n\n" });

  assert.equal(message.content, "正在生成...");
  assert.equal(message.answerStarted, false);
  assert.equal(message.processCollapsed, false);
  assert.equal(message.currentProcess.label, "正在搜索");
});

test("KASS presents the current reasoning or tool step as muted process copy", () => {
  const presentation = getKassProcessPresentation?.({
    status: "loading",
    answerStarted: false,
    processSteps: [
      {
        id: "tool-1",
        kind: "tool",
        label: "正在调用 update_followup",
        detail: "同步客户待办",
        status: "running"
      }
    ],
    currentProcess: {
      id: "tool-1",
      kind: "tool",
      label: "正在调用 update_followup",
      detail: "同步客户待办",
      status: "running"
    }
  });

  assert.deepEqual(presentation, {
    visible: true,
    complete: false,
    label: "正在调用 update_followup",
    detail: "同步客户待办",
    count: 1
  });
});

test("KASS keeps a quiet completed-step summary after the final answer", () => {
  const presentation = getKassProcessPresentation?.({
    status: "done",
    answerStarted: true,
    processSteps: [
      { id: "reason-1", label: "正在分析客户资料", status: "done" },
      { id: "tool-1", label: "update_followup 已完成", status: "done" }
    ],
    currentProcess: {
      id: "tool-1",
      label: "update_followup 已完成",
      status: "done"
    }
  });

  assert.deepEqual(presentation, {
    visible: true,
    complete: true,
    label: "已完成 2 个步骤",
    detail: "",
    count: 2
  });
});

test("KASS keeps the completed-step summary when the current step is cleared", () => {
  const presentation = getKassProcessPresentation?.({
    status: "done",
    answerStarted: true,
    processSteps: [
      { id: "reason-1", label: "分析完成", status: "done" }
    ],
    currentProcess: null
  });

  assert.equal(presentation.visible, true);
  assert.equal(presentation.label, "已完成 1 个步骤");
});

test("KASS process-only events do not rebuild unchanged visible content", () => {
  const plan = getKassStreamRenderPlan?.(
    {
      status: "loading",
      answerStarted: false,
      content: "正在结合客户档案分析…"
    },
    "loading",
    "正在结合客户档案分析…"
  );

  assert.deepEqual(plan, {
    mode: "none",
    phase: "loading",
    content: "正在结合客户档案分析…"
  });
});

test("KASS answer deltas morph the existing rich-content tree", () => {
  const plan = getKassStreamRenderPlan?.(
    {
      status: "loading",
      answerStarted: true,
      content: "已完成第一项，并创建下一步待办。"
    },
    "streaming",
    "已完成第一项，"
  );

  assert.deepEqual(plan, {
    mode: "morph",
    phase: "streaming",
    content: "已完成第一项，并创建下一步待办。"
  });
});

test("KASS completion keeps the answer tree when the final content is unchanged", () => {
  const plan = getKassStreamRenderPlan?.(
    {
      status: "done",
      answerStarted: true,
      content: "**两项待办已完成**"
    },
    "streaming",
    "**两项待办已完成**"
  );

  assert.deepEqual(plan, {
    mode: "none",
    phase: "complete",
    content: "**两项待办已完成**"
  });
});

test("removes the promoted Agent final segment from process history", () => {
  const message = applyDifyStreamEventToMessage({
    id: "assistant-agent",
    role: "assistant",
    content: "正在生成...",
    status: "loading",
    processSteps: [
      { id: "tool-1", kind: "tool", label: "搜索完成", detail: "德国储能", status: "done" },
      { id: "agent-message-2", kind: "reasoning", label: "正在分析问题", detail: "正式结论", status: "running" }
    ],
    currentProcess: { id: "agent-message-2", kind: "reasoning", label: "正在分析问题", detail: "正式结论", status: "running" },
    processCollapsed: false,
    processExpanded: false,
    answerStarted: false
  }, {
    type: "answer_replace",
    answer: "正式结论",
    remove_process_id: "agent-message-2"
  });

  assert.equal(message.content, "正式结论");
  assert.equal(message.processSteps.length, 1);
  assert.equal(message.currentProcess.id, "tool-1");
  assert.equal(message.processCollapsed, true);
});

test("marks the latest process step interrupted when a streamed request fails", () => {
  const message = applyDifyStreamEventToMessage({
    id: "assistant-3",
    role: "assistant",
    content: "正在生成...",
    status: "loading",
    processSteps: [{ id: "tool-3", kind: "tool", label: "正在调用搜索", detail: "法国市场", status: "running" }],
    currentProcess: { id: "tool-3", kind: "tool", label: "正在调用搜索", detail: "法国市场", status: "running" },
    processCollapsed: false,
    processExpanded: false,
    answerStarted: false
  }, { type: "error", message: "上游连接中断" });

  assert.equal(message.status, "error");
  assert.equal(message.content, "上游连接中断");
  assert.equal(message.currentProcess.status, "error");
  assert.match(message.currentProcess.label, /已中断/);
  assert.equal(message.processCollapsed, true);
});

test("replaces the loading placeholder when Dify completes without an answer", () => {
  const message = applyDifyStreamEventToMessage({
    id: "assistant-empty",
    role: "assistant",
    content: "正在生成市场调研结果...",
    status: "loading",
    processSteps: [],
    currentProcess: null,
    processCollapsed: false,
    processExpanded: false,
    answerStarted: false
  }, { type: "done", result: { answer: "" } });

  assert.equal(message.status, "done");
  assert.equal(message.content, "Dify 已完成执行，但没有返回可展示的 answer。");
});

test("parses proxy SSE events even when JSON is split across browser chunks", () => {
  const events = [];
  const parser = createDifySseEventParser((event) => events.push(event));

  parser.push('data: {"type":"process","step":{"id":"one","label":"正在搜');
  parser.push('索"}}\n\ndata: {"type":"answer_delta","delta":"结论"}\n\n');
  parser.finish();

  assert.equal(events.length, 2);
  assert.equal(events[0].step.label, "正在搜索");
  assert.equal(events[1].delta, "结论");
});

test("stream scheduler patches only the active message instead of rebuilding the whole app", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/app.js"), "utf8");
  const schedulerStart = source.indexOf("function scheduleDifyStreamRender");
  const schedulerEnd = source.indexOf("\n/**", schedulerStart + 1);
  const schedulerSource = source.slice(schedulerStart, schedulerEnd);

  assert.ok(schedulerStart >= 0, "应找到流式渲染调度函数");
  assert.match(schedulerSource, /patchDifyStreamMessageDom\(/);
  assert.doesNotMatch(schedulerSource, /renderApp\(/);
});

test("does not abort a healthy Dify stream after a fixed absolute duration", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/app.js"), "utf8");
  const senderStart = source.indexOf("async function sendDifyFeatureDraft");
  const senderEnd = source.indexOf("\n/**", senderStart + 1);
  const senderSource = source.slice(senderStart, senderEnd);

  assert.ok(senderStart >= 0 && senderEnd > senderStart, "应找到真实 Dify 发送函数");
  assert.doesNotMatch(senderSource, /new AbortController\(/);
  assert.doesNotMatch(senderSource, /DIFY_REQUEST_TIMEOUT_MS/);
  assert.doesNotMatch(senderSource, /240 秒/);
});

test("uses Cloudflare for long chat streams while keeping config saves on Vercel", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/app.js"), "utf8");
  const endpointsStart = source.indexOf("const DIFY_PROXY_ENDPOINTS");
  const endpointsEnd = source.indexOf("});", endpointsStart) + 3;
  const endpointsSource = source.slice(endpointsStart, endpointsEnd);

  assert.ok(endpointsStart >= 0 && endpointsEnd > endpointsStart, "应找到 Dify 代理地址配置");
  assert.match(endpointsSource, /config:\s*"https:\/\/yd-prototype-dify-proxy\.vercel\.app\/api\/dify-config"/);
  assert.match(endpointsSource, /chat:\s*"https:\/\/yd-prototype-dify-chat\.gardengaoo\.workers\.dev\/api\/dify-chat"/);
  assert.doesNotMatch(endpointsSource, /chat:\s*"https:\/\/yd-prototype-dify-proxy\.vercel\.app/);
});

test("renders GFM-style Markdown tables as safe semantic table HTML", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/app.js"), "utf8");
  const rendererStart = source.indexOf("function escapeHtml");
  const rendererEnd = source.indexOf("\n/**\n * 移除模型思考标签", rendererStart);
  const sandbox = {
    markdownInput: [
      "| 工具 | 用途 |",
      "| :--- | :---: |",
      "| **Tavily Search** | 深度搜索 `advanced` |",
      "| <img src=x onerror=alert(1)> | [官网](https://example.com) |"
    ].join("\n"),
    renderedMarkdown: ""
  };

  assert.ok(rendererStart >= 0 && rendererEnd > rendererStart, "应找到真实 Markdown 渲染函数");
  vm.runInNewContext(
    `${source.slice(rendererStart, rendererEnd)}\nrenderedMarkdown = renderMarkdown(markdownInput);`,
    sandbox
  );

  assert.match(sandbox.renderedMarkdown, /<table>/);
  assert.match(sandbox.renderedMarkdown, /<thead>/);
  assert.match(sandbox.renderedMarkdown, /<th class="align-left">工具<\/th>/);
  assert.match(sandbox.renderedMarkdown, /<th class="align-center">用途<\/th>/);
  assert.match(sandbox.renderedMarkdown, /<strong>Tavily Search<\/strong>/);
  assert.match(sandbox.renderedMarkdown, /<code>advanced<\/code>/);
  assert.match(sandbox.renderedMarkdown, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(sandbox.renderedMarkdown, /<img\s/i);
});
