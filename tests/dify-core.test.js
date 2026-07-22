const test = require("node:test");
const assert = require("node:assert/strict");

const {
  APP_TYPES,
  assertModeMatchesAppType,
  buildChatPayload,
  buildConfiguredChatInputs,
  decryptApiKey,
  encryptApiKey,
  getAppTypeForMode,
  getDefaultAppTypeForFeature,
  normalizeDifySkillKey,
  normalizeFeatureId,
  parseDifyStream
} = require("../lib/dify-core");

test("maps Dify app modes to the two selectable application types", () => {
  assert.equal(getAppTypeForMode("chat"), APP_TYPES.DIALOGUE);
  assert.equal(getAppTypeForMode("agent-chat"), APP_TYPES.DIALOGUE);
  assert.equal(getAppTypeForMode("advanced-chat"), APP_TYPES.CHATFLOW);
  assert.equal(getAppTypeForMode("workflow"), null);
});

test("keeps Chatflow defaults aligned for dedicated workflow pages", () => {
  assert.equal(getDefaultAppTypeForFeature("customer-research"), APP_TYPES.CHATFLOW);
  assert.equal(getDefaultAppTypeForFeature("yd-artifact"), APP_TYPES.CHATFLOW);
  assert.equal(getDefaultAppTypeForFeature("market-research"), APP_TYPES.CHATFLOW);
  assert.equal(getDefaultAppTypeForFeature("cold-email"), APP_TYPES.CHATFLOW);
  assert.equal(getDefaultAppTypeForFeature("ask"), APP_TYPES.DIALOGUE);
});

test("rejects a saved application type that disagrees with Dify app info", () => {
  assert.doesNotThrow(() => assertModeMatchesAppType(APP_TYPES.DIALOGUE, "chat"));
  assert.doesNotThrow(() => assertModeMatchesAppType(APP_TYPES.CHATFLOW, "advanced-chat"));
  assert.throws(
    () => assertModeMatchesAppType(APP_TYPES.DIALOGUE, "advanced-chat"),
    /实际是 Chatflow/
  );
});

test("normalizes only known-safe feature identifiers", () => {
  assert.equal(normalizeFeatureId(" market-research "), "market-research");
  assert.throws(() => normalizeFeatureId("../market-research"), /功能标识/);
  assert.throws(() => normalizeFeatureId(""), /功能标识/);
});

test("keeps the saved Skill ID authoritative when building total-controller inputs", () => {
  assert.equal(normalizeDifySkillKey(" inquiry-reply "), "inquiry-reply");
  assert.equal(normalizeDifySkillKey(""), "");
  assert.throws(() => normalizeDifySkillKey("询盘 分析"), /Skill ID/);

  assert.deepEqual(buildConfiguredChatInputs({
    inputs: { skill_key: "tampered-skill", model_key: "gemini-3.5-flash" },
    skillKey: "inquiry-reply"
  }), {
    skill_key: "inquiry-reply",
    model_key: "gemini-3.5-flash"
  });
});

test("builds the shared chat-messages payload with conversation continuity", () => {
  assert.deepEqual(buildChatPayload({
    query: "继续分析墨西哥市场",
    conversationId: "conv-123",
    user: "yd-user-1",
    inputs: { country: "MX" },
    files: []
  }), {
    inputs: { country: "MX" },
    query: "继续分析墨西哥市场",
    response_mode: "streaming",
    conversation_id: "conv-123",
    user: "yd-user-1",
    files: []
  });
});

test("parses ordinary chat streaming events into one normalized answer", () => {
  const rawText = [
    'data: {"event":"message","answer":"墨西哥","conversation_id":"conv-chat","message_id":"msg-1"}',
    'data: {"event":"message","answer":"市场增长。","conversation_id":"conv-chat","message_id":"msg-1"}',
    'data: {"event":"message_end","conversation_id":"conv-chat","message_id":"msg-1","metadata":{"usage":{"total_tokens":42}}}'
  ].join("\n\n");

  const result = parseDifyStream(rawText);

  assert.equal(result.answer, "墨西哥市场增长。");
  assert.equal(result.conversation_id, "conv-chat");
  assert.equal(result.message_id, "msg-1");
  assert.equal(result.metadata.usage.total_tokens, 42);
  assert.equal(result.billing_trace.event_counts.message, 2);
});

test("parses Agent and Chatflow events without leaking thought text into the answer", () => {
  const rawText = [
    'data: {"event":"workflow_started","workflow_run_id":"run-1","conversation_id":"conv-flow"}',
    'data: {"event":"agent_thought","thought":"内部思考","conversation_id":"conv-flow"}',
    'data: {"event":"agent_message","answer":"结论一。","conversation_id":"conv-flow"}',
    'data: {"event":"message","answer":"结论二。","conversation_id":"conv-flow"}',
    'data: {"event":"workflow_finished","workflow_run_id":"run-1","data":{"status":"succeeded"}}',
    'data: {"event":"message_end","conversation_id":"conv-flow","metadata":{"usage":{"total_tokens":99}}}'
  ].join("\n\n");

  const result = parseDifyStream(rawText);

  assert.equal(result.answer, "结论一。结论二。");
  assert.equal(result.workflow_run_id, "run-1");
  assert.equal(result.answer.includes("内部思考"), false);
  assert.equal(result.billing_trace.event_counts.workflow_started, 1);
  assert.equal(result.billing_trace.event_counts.agent_thought, 1);
});

test("uses message_replace as the final reviewed answer", () => {
  const rawText = [
    'data: {"event":"message","answer":"旧答案","conversation_id":"conv-1"}',
    'data: {"event":"message_replace","answer":"审查后的答案","conversation_id":"conv-1"}'
  ].join("\n\n");

  assert.equal(parseDifyStream(rawText).answer, "审查后的答案");
});

test("keeps Tavily billing details used by the existing customer-research debug panel", () => {
  const rawText = [
    'data: {"event":"node_finished","workflow_run_id":"run-tavily","data":{"node_id":"agent","title":"Tavily Agent","status":"succeeded","inputs":{"search_depth":"advanced"}}}',
    'data: {"event":"agent_log","id":"log-1","data":{"label":"Call Tavily Search","status":"success","metadata":{"provider":"tavily","elapsed_time":1.2},"data":{"output":{"tool_call_name":"tavily_search","tool_call_input":{"query":"墨西哥 PVC 地板市场"}}}}}',
    'data: {"event":"message","answer":"调研完成","conversation_id":"conv-tavily"}'
  ].join("\n\n");

  const trace = parseDifyStream(rawText).billing_trace;

  assert.equal(trace.tavily.call_count, 1);
  assert.equal(trace.tavily.estimated_credits, 2);
  assert.equal(trace.tavily.tool_config.search_depth, "advanced");
  assert.equal(trace.tavily.calls[0].tool_input.query, "墨西哥 PVC 地板市场");
});

test("encrypts API keys with a random IV and decrypts only with the same master key", () => {
  const masterKey = "a".repeat(64);
  const first = encryptApiKey("app-example-secret", masterKey);
  const second = encryptApiKey("app-example-secret", masterKey);

  assert.notEqual(first, second);
  assert.equal(decryptApiKey(first, masterKey), "app-example-secret");
  assert.throws(() => decryptApiKey(first, "b".repeat(64)), /解密/);
});
