const test = require("node:test");
const assert = require("node:assert/strict");

const {
  CHAT_FEATURE_IDS,
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
