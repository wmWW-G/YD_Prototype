const test = require("node:test");
const assert = require("node:assert/strict");

const {
  applyEvent,
  beginRun,
  calculateSessionSummary,
  calculateSummary,
  createState,
  getModelAudit
} = require("../src/cost-monitor");
const { streamDifyChat } = require("../lib/dify-api-client");

test("calculates mixed-currency model costs line by line instead of adding native amounts", () => {
  const monitor = createState();
  monitor.source = "no-kb";
  monitor.modelKey = "deepseek-v4-pro";
  beginRun(monitor, "识别图片并回复", 1_000);

  applyEvent(monitor, {
    type: "cost_update",
    item: {
      id: "vision",
      category: "llm",
      role: "vision",
      label: "视觉模型",
      model: "gemini-3.5-flash",
      promptTokens: 1205,
      completionTokens: 283,
      totalTokens: 1488
    }
  }, 2_000);
  applyEvent(monitor, {
    type: "cost_update",
    item: {
      id: "agent",
      category: "llm",
      role: "agent",
      label: "Agent 模型",
      model: "deepseek-v4-pro",
      promptTokens: 3718,
      completionTokens: 118,
      totalTokens: 3836
    }
  }, 3_000);

  const summary = calculateSummary(monitor);

  // Gemini 原生美元成本 0.0043545 先乘 7.2，再加 DeepSeek 人民币成本和平台摊销。
  assert.equal(Number(summary.knownCostRmb.toFixed(7)), 0.1788004);
  assert.equal(summary.isComplete, true);
  assert.equal(summary.tokenTotal, 5324);
  assert.equal(getModelAudit(monitor).mismatch, false);
});

test("flags a selected Pro model when the completed Agent event reports Flash", () => {
  const monitor = createState();
  monitor.source = "kb";
  monitor.modelKey = "deepseek-v4-pro";
  beginRun(monitor, "客户说价格太高怎么办", 1_000);

  applyEvent(monitor, {
    type: "cost_update",
    item: {
      id: "agent-flash",
      category: "llm",
      role: "agent",
      model: "deepseek-v4-flash",
      promptTokens: 14693,
      completionTokens: 61,
      totalTokens: 14754
    }
  }, 2_000);
  applyEvent(monitor, {
    type: "cost_update",
    item: {
      id: "embedding",
      category: "embedding",
      role: "knowledge",
      quantity: 30,
      unit: "token"
    }
  }, 2_500);

  const audit = getModelAudit(monitor);
  const summary = calculateSummary(monitor);

  assert.equal(audit.requested, "deepseek-v4-pro");
  assert.equal(audit.actual, "deepseek-v4-flash");
  assert.equal(audit.mismatch, true);
  assert.equal(summary.isComplete, false, "Embedding 单价为 0 时必须暂停最终结算");
  assert.match(summary.missingLines[0].calculation.reason, /Embedding/);
});

test("does not guess a price when the actual model name is absent", () => {
  const monitor = createState();
  beginRun(monitor, "测试未知模型", 1_000);
  applyEvent(monitor, {
    type: "cost_update",
    item: {
      id: "unknown-model",
      category: "llm",
      role: "agent",
      model: "",
      promptTokens: 100,
      completionTokens: 20,
      totalTokens: 120
    }
  }, 2_000);

  const summary = calculateSummary(monitor);
  assert.equal(summary.isComplete, false);
  assert.match(summary.missingLines[0].calculation.reason, /实际模型名尚未返回/);
});

test("blocks settlement when a run ends without any final Agent usage event", () => {
  const monitor = createState();
  beginRun(monitor, "旧代理没有返回 cost_update", 1_000);
  applyEvent(monitor, {
    type: "done",
    result: { conversation_id: "conv-without-cost-items" }
  }, 2_000);

  const summary = calculateSummary(monitor);
  assert.equal(summary.isComplete, false);
  assert.equal(summary.salePriceRmb, null);
  assert.equal(summary.vbeans, null);
  assert.match(summary.missingLines.at(-1).calculation.reason, /尚未收到最终 Agent 模型与 Token/);
});

test("does not treat a knowledge retrieval with missing embedding usage as free", () => {
  const monitor = createState();
  monitor.source = "kb";
  // 即使财务已经填写了 Embedding 单价，没有实际用量也不能得出 0 元结论。
  monitor.prices.embedding.amount = 0.2;
  beginRun(monitor, "查询知识库", 1_000);
  applyEvent(monitor, {
    type: "cost_update",
    item: {
      id: "embedding-usage-missing",
      category: "embedding",
      role: "knowledge",
      quantity: 0,
      unit: "token",
      pricingStatus: "unpriced"
    }
  }, 2_000);

  const summary = calculateSummary(monitor);
  assert.equal(summary.isComplete, false);
  assert.match(summary.missingLines[0].calculation.reason, /用量尚未返回/);
});

test("keeps node start and finish evidence in strict arrival-time order", () => {
  const monitor = createState();
  beginRun(monitor, "检查事件顺序", 1_000);

  applyEvent(monitor, {
    type: "process",
    step: { id: "vision", label: "识别开始", status: "running" }
  }, 1_100);
  applyEvent(monitor, {
    type: "cost_update",
    item: { id: "vision-cost", category: "llm", role: "vision", label: "视觉模型", model: "gemini-3.5-flash", promptTokens: 10, completionTokens: 2 }
  }, 1_150);
  applyEvent(monitor, {
    type: "process",
    step: { id: "vision", label: "识别完成", status: "done" }
  }, 1_200);

  assert.deepEqual(monitor.timeline.map((entry) => entry.label), ["识别开始", "视觉模型已入账", "识别完成"]);
  assert.deepEqual(monitor.timeline.map((entry) => entry.elapsedMs), [100, 150, 200]);
});

test("keeps the session total open until the current run receives done", () => {
  const monitor = createState();
  beginRun(monitor, "等待最终完成事件", 1_000);
  applyEvent(monitor, {
    type: "cost_update",
    item: {
      id: "agent-before-done",
      category: "llm",
      role: "agent",
      model: "deepseek-v4-pro",
      promptTokens: 100,
      completionTokens: 20,
      totalTokens: 120
    }
  }, 1_500);

  assert.equal(calculateSummary(monitor).isComplete, true, "已收到的明细自身可以完成定价");
  assert.equal(calculateSessionSummary(monitor).hasMissing, true, "done 前仍要保留会话总额加号");

  applyEvent(monitor, { type: "done", result: {} }, 2_000);
  assert.equal(calculateSessionSummary(monitor).hasMissing, false);
});

test("streams sanitized per-node cost events, de-duplicates IDs, and keeps the global total as checksum only", async () => {
  const encoder = new TextEncoder();
  const upstreamChunks = [
    'data: {"event":"node_finished","id":"vision-event","data":{"id":"vision-node","title":"图片识别","node_type":"llm","outputs":{"prompt":"SECRET_PROMPT_MUST_NOT_LEAK","usage":{"model":"gemini-3.5-flash","provider":"google","prompt_tokens":1205,"completion_tokens":283,"total_tokens":1488,"total_price":0.0043545,"currency":"USD"}}}}\n\n',
    'data: {"event":"node_finished","id":"vision-event","data":{"id":"vision-node","title":"图片识别","node_type":"llm","outputs":{"usage":{"model":"gemini-3.5-flash","prompt_tokens":1205,"completion_tokens":283,"total_tokens":1488,"total_price":0.0043545,"currency":"USD"}}}}\n\n',
    'data: {"event":"node_finished","id":"agent-event","data":{"id":"agent-node","title":"DeepSeek Agent","node_type":"agent","outputs":{"usage":{"model_name":"deepseek-v4-pro","provider_name":"deepseek","prompt_tokens":3718,"completion_tokens":118,"total_tokens":3836,"total_price":0.047448,"currency":"RMB"}}}}\n\n',
    'data: {"event":"message_end","conversation_id":"conv-cost","workflow_run_id":"run-cost","metadata":{"usage":{"prompt_tokens":4923,"completion_tokens":401,"total_tokens":5324,"total_price":0.0518025,"currency":"RMB"}}}\n\n'
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
    apiKey: "app-cost-test",
    query: "识别图片",
    user: "cost-test-user",
    fetchImpl,
    onEvent(event) {
      emitted.push(event);
    }
  });

  const costEvents = emitted.filter((event) => event.type === "cost_update");
  const checksum = emitted.find((event) => event.type === "cost_checksum");

  assert.equal(costEvents.length, 2, "重复 node_finished ID 只能入账一次");
  assert.deepEqual(costEvents.map((event) => event.item.model), ["gemini-3.5-flash", "deepseek-v4-pro"]);
  assert.deepEqual(costEvents.map((event) => event.item.reportedCurrency), ["USD", "RMB"]);
  assert.equal(checksum.usage.totalTokens, 5324);
  assert.equal(JSON.stringify(emitted).includes("SECRET_PROMPT_MUST_NOT_LEAK"), false);
  assert.equal(result.billing_trace.cost_items.length, 2);
  assert.equal(result.metadata.usage.total_price, 0.0518025, "Dify 全局金额仍保留作审计，但不属于 cost_update 明细");
});

test("classifies knowledge-node token usage as embedding instead of an LLM", async () => {
  const streamText = [
    'data: {"event":"node_finished","id":"knowledge-event","data":{"id":"knowledge-node","title":"检索赢单外贸共享知识库","node_type":"knowledge-retrieval","outputs":{"usage":{"model":"text-embedding-3-large","provider":"openai","prompt_tokens":30,"completion_tokens":0,"total_tokens":30}}}}',
    'data: {"event":"message_end","conversation_id":"conv-knowledge"}'
  ].join("\n\n");
  const emitted = [];

  await streamDifyChat({
    apiKey: "app-knowledge-test",
    query: "查询知识库",
    user: "knowledge-test-user",
    fetchImpl: async () => new Response(streamText, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" }
    }),
    onEvent(event) {
      emitted.push(event);
    }
  });

  const embeddingItem = emitted.find((event) => event.type === "cost_update")?.item;
  assert.equal(embeddingItem.category, "embedding");
  assert.equal(embeddingItem.model, "text-embedding-3-large");
  assert.equal(embeddingItem.quantity, 30);
  assert.equal(embeddingItem.pricingStatus, "exact_usage");
});

test("keeps separate retry executions even when they belong to the same workflow node", async () => {
  const streamText = [
    'data: {"event":"node_finished","id":"agent-attempt-1","data":{"node_id":"agent-node","title":"DeepSeek Agent","node_type":"agent","status":"failed","outputs":{"usage":{"model":"deepseek-v4-pro","prompt_tokens":100,"completion_tokens":10,"total_tokens":110}}}}',
    'data: {"event":"node_finished","id":"agent-attempt-2","data":{"node_id":"agent-node","title":"DeepSeek Agent","node_type":"agent","status":"succeeded","outputs":{"usage":{"model":"deepseek-v4-pro","prompt_tokens":120,"completion_tokens":20,"total_tokens":140}}}}',
    'data: {"event":"message_end","conversation_id":"conv-retry"}'
  ].join("\n\n");
  const emitted = [];

  await streamDifyChat({
    apiKey: "app-retry-test",
    query: "测试重试",
    user: "retry-test-user",
    fetchImpl: async () => new Response(streamText, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" }
    }),
    onEvent(event) {
      emitted.push(event);
    }
  });

  const retryItems = emitted.filter((event) => event.type === "cost_update").map((event) => event.item);
  assert.deepEqual(retryItems.map((item) => item.id), ["node-agent-attempt-1", "node-agent-attempt-2"]);
  assert.equal(retryItems.reduce((sum, item) => sum + item.totalTokens, 0), 250);
});

test("marks Tavily Extract as unresolved when the successful URL count is absent", async () => {
  const streamText = [
    'data: {"event":"agent_log","id":"search-log","data":{"label":"Tavily Search","status":"success"}}',
    'data: {"event":"agent_log","id":"extract-log","data":{"label":"Tavily Extract","status":"success"}}',
    'data: {"event":"message_end","conversation_id":"conv-tools"}'
  ].join("\n\n");
  const emitted = [];

  await streamDifyChat({
    apiKey: "app-tool-test",
    query: "联网研究",
    user: "tool-test-user",
    fetchImpl: async () => new Response(streamText, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" }
    }),
    onEvent(event) {
      emitted.push(event);
    }
  });

  const toolItems = emitted.filter((event) => event.type === "cost_update").map((event) => event.item);
  const search = toolItems.find((item) => item.service.includes("search"));
  const extract = toolItems.find((item) => item.service.includes("extract"));

  assert.equal(search.quantity, 1);
  assert.equal(extract.quantity, null);
  assert.equal(extract.requiresQuantity, true);
  assert.equal(extract.pricingStatus, "quantity_unresolved");
});
