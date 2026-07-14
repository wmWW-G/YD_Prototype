const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  CHAT_FEATURE_IDS,
  applyDifyStreamEventToMessage,
  createDifySseEventParser,
  createFeatureConfigState,
  createFeatureSessionState,
  getFriendlyConfigError,
  isDifyChatFeature
} = require("../src/dify-config");

test("marks only real conversation pages as Dify-configurable", () => {
  assert.equal(isDifyChatFeature("ask"), true);
  assert.equal(isDifyChatFeature("customer-research"), true);
  assert.equal(isDifyChatFeature("market-research"), true);
  assert.equal(isDifyChatFeature("trade-show"), true);
  assert.equal(isDifyChatFeature("sales-prep"), false);
  assert.equal(isDifyChatFeature("customer-development"), false);
  assert.equal(isDifyChatFeature("customer-kass-a"), false);
  assert.equal(isDifyChatFeature("admin-home"), false);
  assert.equal(CHAT_FEATURE_IDS.includes("cold-email"), true);
});

test("defaults customer research to Chatflow and other pages to dialogue apps", () => {
  assert.equal(createFeatureConfigState("customer-research").appType, "chatflow");
  assert.equal(createFeatureConfigState("market-research").appType, "dialogue");
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
