const test = require("node:test");
const assert = require("node:assert/strict");

const { APP_TYPES } = require("../lib/dify-core");
const { inspectDifyApp, sendDifyChat } = require("../lib/dify-api-client");

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
