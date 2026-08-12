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
  formatDifyThinkingRoundDuration,
  getDifyReasoningTimeline,
  getDifyReasoningTimelineSignature,
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

test("tracks every thinking round independently and appends its visible stage summary", () => {
  // 生产状态如果只保留全局 thinkingStartedAt，或者用后一块小结覆盖前一块，
  // 就无法还原“思考 3.3 秒 → 小结 → 再思考 2.7 秒”的真实时间线。
  let message = {
    id: "assistant-rounds",
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

  message = applyDifyStreamEventToMessage(message, {
    type: "process",
    step: {
      id: "agent-thinking-1",
      kind: "thinking",
      label: "正在深度思考",
      detail: "",
      status: "running"
    }
  }, 1_000);
  message = applyDifyStreamEventToMessage(message, {
    type: "process",
    step: {
      id: "agent-thinking-1",
      kind: "thinking",
      label: "已深度思考",
      detail: "",
      status: "done"
    }
  }, 4_300);
  message = applyDifyStreamEventToMessage(message, {
    type: "process",
    step: {
      id: "agent-message-1",
      kind: "summary",
      label: "阶段小结",
      detailDelta: "已确认客户",
      roundId: "agent-thinking-1",
      status: "running"
    }
  }, 4_400);
  message = applyDifyStreamEventToMessage(message, {
    type: "process",
    step: {
      id: "agent-message-1",
      kind: "summary",
      label: "阶段小结",
      detailDelta: "身份。",
      roundId: "agent-thinking-1",
      status: "running"
    }
  }, 4_500);
  message = applyDifyStreamEventToMessage(message, {
    type: "process",
    step: {
      id: "agent-message-1",
      kind: "summary",
      label: "阶段小结",
      detailDelta: "",
      roundId: "agent-thinking-1",
      status: "done"
    }
  }, 4_600);
  message = applyDifyStreamEventToMessage(message, {
    type: "process",
    step: {
      id: "agent-thinking-2",
      kind: "thinking",
      label: "正在深度思考",
      detail: "",
      status: "running"
    }
  }, 5_000);
  message = applyDifyStreamEventToMessage(message, {
    type: "process",
    step: {
      id: "agent-thinking-2",
      kind: "thinking",
      label: "已深度思考",
      detail: "",
      status: "done"
    }
  }, 7_700);

  assert.deepEqual(
    message.processSteps.map((step) => ({
      id: step.id,
      detail: step.detail,
      status: step.status,
      startedAt: step.startedAt ?? null,
      endedAt: step.endedAt ?? null
    })),
    [
      { id: "agent-thinking-1", detail: "", status: "done", startedAt: 1_000, endedAt: 4_300 },
      { id: "agent-message-1", detail: "已确认客户身份。", status: "done", startedAt: null, endedAt: null },
      { id: "agent-thinking-2", detail: "", status: "done", startedAt: 5_000, endedAt: 7_700 }
    ]
  );
  assert.equal(message.answerStarted, false);
  assert.equal(message.thinkingEndedAt, null);

  message = applyDifyStreamEventToMessage(message, {
    type: "process",
    step: {
      id: "agent-message-2",
      kind: "summary",
      label: "阶段小结",
      detailDelta: "## 最终报告",
      roundId: "agent-thinking-2",
      status: "running"
    }
  }, 7_800);
  message = applyDifyStreamEventToMessage(message, {
    type: "answer_replace",
    answer: "## 最终报告",
    remove_process_id: "agent-message-2"
  }, 8_000);

  assert.equal(message.content, "## 最终报告");
  assert.equal(message.answerStarted, true);
  assert.equal(message.thinkingEndedAt, 8_000);
  assert.equal(message.processSteps.some((step) => step.id === "agent-message-2"), false);
  assert.equal(message.processSteps.some((step) => step.id === "agent-message-1" && step.detail === "已确认客户身份。"), true);
});

test("freezes a still-running thinking round when the stream finishes or fails", () => {
  const baseMessage = applyDifyStreamEventToMessage({
    id: "assistant-open-round",
    role: "assistant",
    content: "正在生成...",
    status: "loading",
    processSteps: [],
    currentProcess: null,
    answerStarted: false,
    thinkingStartedAt: 1_000,
    thinkingEndedAt: null
  }, {
    type: "process",
    step: {
      id: "agent-thinking-1",
      kind: "thinking",
      label: "正在深度思考",
      status: "running"
    }
  }, 1_000);

  const completed = applyDifyStreamEventToMessage(baseMessage, {
    type: "done",
    result: { answer: "最终答案", conversation_id: "conv-terminal-round" }
  }, 4_300);
  const failed = applyDifyStreamEventToMessage(baseMessage, {
    type: "error",
    message: "上游连接中断"
  }, 2_700);

  assert.deepEqual(
    {
      status: completed.processSteps[0].status,
      label: completed.processSteps[0].label,
      endedAt: completed.processSteps[0].endedAt,
      currentStatus: completed.currentProcess.status
    },
    {
      status: "done",
      label: "已深度思考",
      endedAt: 4_300,
      currentStatus: "done"
    }
  );
  assert.deepEqual(
    {
      status: failed.processSteps[0].status,
      endedAt: failed.processSteps[0].endedAt,
      currentStatus: failed.currentProcess.status
    },
    {
      status: "error",
      endedAt: 2_700,
      currentStatus: "error"
    }
  );
});

test("keeps thinking rounds and summaries when long tool traces reach the history limit", () => {
  let message = {
    id: "assistant-long-round",
    role: "assistant",
    content: "正在生成...",
    status: "loading",
    processSteps: [],
    currentProcess: null,
    answerStarted: false
  };
  const coreSteps = [
    {
      id: "agent-thinking-1",
      kind: "thinking",
      label: "已深度思考",
      status: "done"
    },
    {
      id: "agent-message-1",
      kind: "summary",
      label: "阶段小结",
      detail: "已确认客户身份。",
      roundId: "agent-thinking-1",
      status: "done"
    }
  ];

  coreSteps.forEach((step, index) => {
    message = applyDifyStreamEventToMessage(message, { type: "process", step }, 1_000 + index * 100);
  });
  Array.from({ length: 45 }, (_, index) => index + 1).forEach((index) => {
    message = applyDifyStreamEventToMessage(message, {
      type: "process",
      step: {
        id: `tool-${index}`,
        kind: "tool",
        label: `工具步骤 ${index}`,
        status: "done"
      }
    }, 2_000 + index * 100);
  });

  assert.equal(message.processSteps.length, 40);
  assert.equal(message.processSteps.some((step) => step.id === "agent-thinking-1"), true);
  assert.equal(message.processSteps.some((step) => step.id === "agent-message-1"), true);
  assert.equal(message.processSteps.some((step) => step.id === "tool-1"), false);
  assert.equal(message.processSteps.some((step) => step.id === "tool-45"), true);
  assert.equal(message.processSteps.findIndex((step) => step.id === "agent-thinking-1") < message.processSteps.findIndex((step) => step.id === "agent-message-1"), true);
});

test("groups safe process details and the following message under each timed thinking round", () => {
  const message = {
    status: "loading",
    processSteps: [
      {
        id: "agent-thinking-1",
        kind: "thinking",
        label: "已深度思考",
        status: "done",
        startedAt: 1_000,
        endedAt: 4_300
      },
      {
        id: "tool-1",
        kind: "tool",
        label: "Tavily Search调用完成",
        detail: "Tearrible Instincts 公司注册信息",
        status: "done",
        roundId: "agent-thinking-1"
      },
      {
        id: "agent-message-1",
        kind: "summary",
        label: "阶段小结",
        detail: "已确认客户身份，继续深挖创始团队。",
        status: "done",
        roundId: "agent-thinking-1"
      },
      {
        id: "agent-thinking-2",
        kind: "thinking",
        label: "正在深度思考",
        status: "running",
        startedAt: 5_000,
        endedAt: null
      }
    ]
  };

  assert.equal(formatDifyThinkingRoundDuration(1_000, 4_300), "3.3s");
  assert.equal(formatDifyThinkingRoundDuration(5_000, null, 6_200), "1.2s");
  assert.deepEqual(getDifyReasoningTimeline(message, 6_200), [
    {
      id: "agent-thinking-1",
      status: "done",
      title: "已深度思考",
      duration: "3.3s",
      details: [
        {
          id: "tool-1",
          kind: "tool",
          label: "Tavily Search调用完成",
          detail: "Tearrible Instincts 公司注册信息",
          status: "done"
        }
      ],
      summary: {
        id: "agent-message-1",
        content: "已确认客户身份，继续深挖创始团队。",
        status: "done"
      }
    },
    {
      id: "agent-thinking-2",
      status: "running",
      title: "正在深度思考",
      duration: "1.2s",
      details: [],
      summary: null
    }
  ]);
});

test("changes the timeline structure signature only when a step or its status changes", () => {
  const baseMessage = {
    processSteps: [
      { id: "agent-thinking-1", kind: "thinking", status: "done", detail: "" },
      {
        id: "agent-message-1",
        kind: "summary",
        status: "running",
        roundId: "agent-thinking-1",
        detail: "第一块"
      }
    ]
  };
  const sameStructureWithMoreText = {
    processSteps: [
      baseMessage.processSteps[0],
      { ...baseMessage.processSteps[1], detail: "第一块和第二块" }
    ]
  };
  const completedSummary = {
    processSteps: [
      baseMessage.processSteps[0],
      { ...baseMessage.processSteps[1], detail: "第一块和第二块", status: "done" }
    ]
  };

  assert.equal(
    getDifyReasoningTimelineSignature(baseMessage),
    "agent-thinking-1:thinking:done|agent-message-1:summary:running"
  );
  assert.equal(
    getDifyReasoningTimelineSignature(sameStructureWithMoreText),
    getDifyReasoningTimelineSignature(baseMessage)
  );
  assert.notEqual(
    getDifyReasoningTimelineSignature(completedSummary),
    getDifyReasoningTimelineSignature(baseMessage)
  );
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

test("updates visible thinking durations without rebuilding the page", () => {
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

test("refreshes every visible thinking round with its own frozen or live duration", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/app.js"), "utf8");
  const refreshStart = source.indexOf("function refreshDifyThinkingDurationDom");
  const refreshEnd = source.indexOf("\n/**", refreshStart + 1);
  const firstDurationNode = {
    textContent: "",
    getAttribute() {
      return "agent-thinking-1";
    }
  };
  const secondDurationNode = {
    textContent: "",
    getAttribute() {
      return "agent-thinking-2";
    }
  };
  const turn = {
    getAttribute(name) {
      return name === "data-dify-message-id" ? "assistant-round-timer" : "";
    },
    querySelector() {
      return firstDurationNode;
    },
    querySelectorAll() {
      return [firstDurationNode, secondDurationNode];
    }
  };
  const message = {
    id: "assistant-round-timer",
    processSteps: [
      { id: "agent-thinking-1", kind: "thinking", startedAt: 1_000, endedAt: 4_300 },
      { id: "agent-thinking-2", kind: "thinking", startedAt: 5_000, endedAt: null }
    ]
  };
  const sandbox = {
    refreshed: false,
    state: { activeMain: "customer-research" },
    document: { querySelectorAll: () => [turn] },
    getDifyFeatureSession: () => ({ messages: [message] }),
    getDifyThinkingDurationText: () => "思考了 5 秒",
    window: {
      YD_DIFY: {
        formatDifyThinkingRoundDuration(startedAt, endedAt) {
          return formatDifyThinkingRoundDuration(startedAt, endedAt, 6_200);
        }
      }
    }
  };

  assert.ok(refreshStart >= 0 && refreshEnd > refreshStart, "应找到局部思考计时刷新函数");
  vm.runInNewContext(
    `${source.slice(refreshStart, refreshEnd)}\nrefreshed = refreshDifyThinkingDurationDom("customer-research", "assistant-round-timer");`,
    sandbox
  );

  assert.equal(sandbox.refreshed, true);
  assert.equal(firstDurationNode.textContent, "(3.3s)");
  assert.equal(secondDurationNode.textContent, "(1.2s)");
});

test("ticks at one tenth of a second so each live thinking round visibly counts", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/app.js"), "utf8");
  const tickerStart = source.indexOf("function startDifyThinkingDurationTicker");
  const tickerEnd = source.indexOf("\n/**", tickerStart + 1);
  const sandbox = {
    scheduledDelay: null,
    difyThinkingDurationTimer: null,
    stopDifyThinkingDurationTicker: () => {},
    refreshDifyThinkingDurationDom: () => true,
    window: {
      setInterval(_callback, delay) {
        sandbox.scheduledDelay = delay;
        return 1;
      }
    }
  };

  assert.ok(tickerStart >= 0 && tickerEnd > tickerStart, "应找到动态思考计时器函数");
  vm.runInNewContext(
    `${source.slice(tickerStart, tickerEnd)}\nstartDifyThinkingDurationTicker("customer-research", "assistant-round-timer");`,
    sandbox
  );

  assert.equal(sandbox.scheduledDelay, 100);
});

test("renders completed thinking rounds, live round timing, safe details, and stage summaries in order", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/app.js"), "utf8");
  const rendererStart = source.indexOf("function renderDifyReasoningTimeline");
  const rendererEnd = source.indexOf("\n/**", rendererStart + 1);
  const sandbox = {
    message: { id: "assistant-timeline" },
    rendered: "",
    escapeHtml: (value) => String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;"),
    renderMarkdown: (value) => `<p>${String(value || "")}</p>`,
    window: {
      YD_DIFY: {
        getDifyReasoningTimeline() {
          return [
            {
              id: "agent-thinking-1",
              status: "done",
              title: "已深度思考",
              duration: "3.3s",
              details: [
                {
                  id: "thought-1",
                  kind: "reasoning",
                  label: "思考过程",
                  detail: "正在核对官网与注册信息",
                  status: "running"
                }
              ],
              summary: {
                id: "agent-message-1",
                content: "已确认客户身份，继续深挖创始团队。",
                status: "done"
              }
            },
            {
              id: "agent-thinking-2",
              status: "running",
              title: "正在深度思考",
              duration: "1.2s",
              details: [],
              summary: null
            }
          ];
        },
        getDifyReasoningTimelineSignature() {
          return "agent-thinking-1:thinking:done|agent-thinking-2:thinking:running";
        }
      }
    }
  };

  assert.ok(rendererStart >= 0 && rendererEnd > rendererStart, "应找到分轮思考时间线渲染函数");
  vm.runInNewContext(
    `${source.slice(rendererStart, rendererEnd)}\nrendered = renderDifyReasoningTimeline(message, 6_200);`,
    sandbox
  );

  assert.match(sandbox.rendered, /data-dify-thinking-round-id="agent-thinking-1"/);
  assert.match(sandbox.rendered, /data-dify-timeline-signature="agent-thinking-1:thinking:done\|agent-thinking-2:thinking:running"/);
  assert.match(sandbox.rendered, /已深度思考/);
  assert.match(sandbox.rendered, /3\.3s/);
  assert.match(sandbox.rendered, /正在核对官网与注册信息/);
  assert.match(sandbox.rendered, /已确认客户身份，继续深挖创始团队。/);
  assert.match(sandbox.rendered, /data-dify-thinking-round-id="agent-thinking-2"[^>]*open/);
  assert.match(sandbox.rendered, /正在深度思考/);
  assert.match(sandbox.rendered, /1\.2s/);
  assert.match(sandbox.rendered, /正在检索、核对并整理当前阶段信息/);
});

test("uses the multi-round timeline during generation and keeps it above the final answer", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/app.js"), "utf8");
  const panelStart = source.indexOf("function renderDifyProcessPanel");
  const panelEnd = source.indexOf("\n/**", panelStart + 1);
  const sandbox = {
    liveMessage: {
      id: "assistant-live-rounds",
      status: "loading",
      answerStarted: false,
      processSteps: [{ id: "agent-thinking-1", kind: "thinking", status: "running" }],
      currentProcess: { id: "agent-thinking-1", kind: "thinking", status: "running" }
    },
    answerMessage: {
      id: "assistant-live-rounds",
      status: "loading",
      answerStarted: true,
      processSteps: [{ id: "agent-thinking-1", kind: "thinking", status: "done" }],
      currentProcess: { id: "agent-thinking-1", kind: "thinking", status: "done" }
    },
    liveRendered: "",
    answerRendered: "",
    state: { activeMain: "customer-research" },
    renderDifyReasoningTimeline: () => '<div data-test="round-timeline"></div>',
    renderYdArtifactProcessPanel: () => "",
    getDifyThinkingDurationText: () => "思考了 1 秒",
    getDifyProcessSummary: () => "1 个步骤",
    escapeHtml: (value) => String(value ?? "")
  };

  assert.ok(panelStart >= 0 && panelEnd > panelStart, "应找到通用 Dify 过程区函数");
  vm.runInNewContext(
    `${source.slice(panelStart, panelEnd)}
liveRendered = renderDifyProcessPanel(liveMessage);
answerRendered = renderDifyProcessPanel(answerMessage);`,
    sandbox
  );

  assert.match(sandbox.liveRendered, /data-test="round-timeline"/);
  assert.match(sandbox.answerRendered, /data-test="round-timeline"/);
});

test("collapses the whole reasoning timeline when the final answer starts", () => {
  // 这个用例防止只折叠单个 thinking，却把所有阶段小结继续铺在正文上方。
  // 生产代码如果漏掉 answerStarted 分支，或错误地给总容器添加 open，本测试都会失败。
  const source = fs.readFileSync(path.join(__dirname, "../src/app.js"), "utf8");
  const panelStart = source.indexOf("function renderDifyProcessPanel");
  const panelEnd = source.indexOf("\n/**", panelStart + 1);
  const sandbox = {
    liveMessage: {
      id: "assistant-reasoning-live",
      status: "loading",
      answerStarted: false,
      processSteps: [
        { id: "agent-thinking-1", kind: "thinking", status: "done" },
        { id: "agent-thinking-2", kind: "thinking", status: "running" }
      ],
      currentProcess: { id: "agent-thinking-2", kind: "thinking", status: "running" }
    },
    answerMessage: {
      id: "assistant-reasoning-answer",
      status: "loading",
      answerStarted: true,
      processSteps: [
        { id: "agent-thinking-1", kind: "thinking", status: "done" },
        { id: "agent-message-1", kind: "summary", status: "done", roundId: "agent-thinking-1" },
        { id: "agent-thinking-2", kind: "thinking", status: "done" }
      ],
      currentProcess: { id: "agent-thinking-2", kind: "thinking", status: "done" }
    },
    liveRendered: "",
    answerRendered: "",
    state: { activeMain: "customer-research" },
    renderDifyReasoningTimeline: () => '<div data-test="complete-reasoning-timeline"></div>',
    renderYdArtifactProcessPanel: () => "",
    getDifyThinkingDurationText: () => "思考了 5 秒",
    getDifyProcessSummary: () => "3 个步骤",
    escapeHtml: (value) => String(value ?? "")
  };

  assert.ok(panelStart >= 0 && panelEnd > panelStart, "应找到通用 Dify 过程区函数");
  vm.runInNewContext(
    `${source.slice(panelStart, panelEnd)}
liveRendered = renderDifyProcessPanel(liveMessage);
answerRendered = renderDifyProcessPanel(answerMessage);`,
    sandbox
  );

  assert.doesNotMatch(sandbox.liveRendered, /data-dify-reasoning-history/);
  assert.match(sandbox.answerRendered, /<details[^>]*data-dify-reasoning-history="true"[^>]*>/);
  assert.doesNotMatch(
    sandbox.answerRendered.match(/<details[^>]*data-dify-reasoning-history="true"[^>]*>/)?.[0] || "",
    /\sopen(?:\s|>|=)/
  );
  assert.match(sandbox.answerRendered, /已完成深度思考/);
  assert.match(sandbox.answerRendered, /2 轮/);
  assert.match(sandbox.answerRendered, /data-test="complete-reasoning-timeline"/);
});

test("YD Artifact uses the seventh orbit effect as an expandable process entry without a visible process title", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/app.js"), "utf8");
  const styleSource = fs.readFileSync(path.join(__dirname, "../src/styles.css"), "utf8");
  const orbitStart = source.indexOf("function renderYdArtifactThinkingOrbit");
  const orbitEnd = source.indexOf("\n/**", orbitStart + 1);
  const panelStart = source.indexOf("function renderYdArtifactProcessPanel");
  const panelEnd = source.indexOf("\n/**", panelStart + 1);
  const orbitSource = source.slice(orbitStart, orbitEnd);
  const panelSource = source.slice(panelStart, panelEnd);
  const sandbox = {
    message: {
      id: "artifact-process-1",
      status: "loading",
      processExpanded: true,
      thinkingStartedAt: 1_000,
      thinkingEndedAt: null
    },
    steps: [
      { id: "step-1", label: "正在检索付款流程", detail: "注册与支付规则", status: "running" }
    ],
    rendered: "",
    escapeHtml: (value) => String(value ?? ""),
    getDifyThinkingDurationText: () => "思考了 8 秒",
    getDifyProcessSummary: () => "1 个步骤 · 思考了 8 秒"
  };

  assert.ok(orbitStart >= 0 && orbitEnd > orbitStart, "应找到卫星环绕标志函数");
  assert.ok(panelStart >= 0 && panelEnd > panelStart, "应找到 YD Artifact 过程区函数");
  assert.match(orbitSource, /class="orange-dot"/);
  assert.match(panelSource, /data-dify-process-toggle/);
  assert.match(panelSource, /dify-process-history/);
  assert.doesNotMatch(panelSource, />分析过程</);
  assert.doesNotMatch(panelSource, />思考过程</);
  assert.match(styleSource, /@keyframes dify-thinking-dot-orbit/);
  assert.match(styleSource, /transform-origin:\s*-150px 150px/);

  vm.runInNewContext(
    `${orbitSource}\n${panelSource}\nrendered = renderYdArtifactProcessPanel(message, steps, steps[0], true);`,
    sandbox
  );

  assert.match(sandbox.rendered, /aria-expanded="true"/);
  assert.match(sandbox.rendered, /正在检索付款流程/);
  assert.match(sandbox.rendered, /注册与支付规则/);
  assert.doesNotMatch(sandbox.rendered, /<strong>[^<]*(分析过程|思考过程)/);
  assert.doesNotMatch(sandbox.rendered, /<span>[^<]*(分析过程|思考过程)/);
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
