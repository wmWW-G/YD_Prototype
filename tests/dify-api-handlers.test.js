const test = require("node:test");
const assert = require("node:assert/strict");

const { createConfigHandler } = require("../api/dify-config");
const { createChatHandler } = require("../api/dify-chat");

/**
 * 创建兼容 Vercel Node Handler 的响应假对象。
 *
 * @returns {{ statusCode: number, headers: object, body: string, setHeader: Function, end: Function }} 可读取最终响应的对象。
 */
function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value;
    },
    end(value = "") {
      this.body = String(value);
    }
  };
}

/**
 * 创建同时模拟 Upstash 和 Dify 的 fetch。
 *
 * @returns {{ fetchImpl: Function, redis: Map<string, string> }} 测试网络层。
 */
function createBackendFetch() {
  const redis = new Map();

  return {
    redis,
    fetchImpl: async (url, options = {}) => {
      if (url === "https://redis.example.test") {
        const [command, key, value] = JSON.parse(options.body);
        if (command === "GET") {
          return new Response(JSON.stringify({ result: redis.get(key) ?? null }), { status: 200 });
        }
        if (command === "SET") {
          redis.set(key, value);
          return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
        }
      }

      if (url.endsWith("/info")) {
        return new Response(JSON.stringify({ name: "外贸市场调研", mode: "chat" }), { status: 200 });
      }

      if (url.endsWith("/parameters")) {
        return new Response(JSON.stringify({ user_input_form: [] }), { status: 200 });
      }

      if (url.endsWith("/chat-messages")) {
        return new Response([
          'data: {"event":"message","answer":"真实市场调研结果","conversation_id":"conv-market"}',
          'data: {"event":"message_end","conversation_id":"conv-market","metadata":{"usage":{"total_tokens":12}}}'
        ].join("\n\n"), {
          status: 200,
          headers: { "Content-Type": "text/event-stream" }
        });
      }

      return new Response("not found", { status: 404 });
    }
  };
}

test("config endpoint validates, saves, and returns only masked metadata", async () => {
  const backend = createBackendFetch();
  const env = {
    UPSTASH_REDIS_REST_URL: "https://redis.example.test",
    UPSTASH_REDIS_REST_TOKEN: "redis-token",
    DIFY_CONFIG_ENCRYPTION_KEY: "d".repeat(64)
  };
  const handler = createConfigHandler({ env, fetchImpl: backend.fetchImpl });
  const saveResponse = createResponse();

  await handler({
    method: "POST",
    headers: { origin: "http://127.0.0.1:8765" },
    body: {
      feature_id: "market-research",
      app_type: "dialogue",
      api_key: "app-market-secret"
    }
  }, saveResponse);

  const saved = JSON.parse(saveResponse.body);
  assert.equal(saveResponse.statusCode, 200);
  assert.equal(saved.hasKey, true);
  assert.equal(saved.appName, "外贸市场调研");
  assert.equal(saveResponse.body.includes("app-market-secret"), false);

  const readResponse = createResponse();
  await handler({
    method: "GET",
    headers: { origin: "http://127.0.0.1:8765" },
    query: { feature_id: "market-research" }
  }, readResponse);

  assert.equal(JSON.parse(readResponse.body).maskedKey.startsWith("app-"), true);
  assert.equal(readResponse.body.includes("app-market-secret"), false);
});

test("chat endpoint loads the saved feature key and returns a normalized conversation response", async () => {
  const backend = createBackendFetch();
  const env = {
    UPSTASH_REDIS_REST_URL: "https://redis.example.test",
    UPSTASH_REDIS_REST_TOKEN: "redis-token",
    DIFY_CONFIG_ENCRYPTION_KEY: "e".repeat(64)
  };
  const configHandler = createConfigHandler({ env, fetchImpl: backend.fetchImpl });
  const saveResponse = createResponse();
  await configHandler({
    method: "POST",
    headers: {},
    body: { feature_id: "market-research", app_type: "dialogue", api_key: "app-market-secret" }
  }, saveResponse);

  const chatHandler = createChatHandler({ env, fetchImpl: backend.fetchImpl });
  const chatResponse = createResponse();
  await chatHandler({
    method: "POST",
    headers: {},
    body: {
      feature_id: "market-research",
      query: "分析墨西哥市场",
      conversation_id: "",
      user: "yd-user-1"
    }
  }, chatResponse);

  const payload = JSON.parse(chatResponse.body);
  assert.equal(chatResponse.statusCode, 200);
  assert.equal(payload.answer, "真实市场调研结果");
  assert.equal(payload.conversation_id, "conv-market");
  assert.equal(payload.app_type, "dialogue");
});

test("chat endpoint returns a clear 409 when the current page has no saved key", async () => {
  const handler = createChatHandler({ env: {}, fetchImpl: global.fetch });
  const response = createResponse();

  await handler({
    method: "POST",
    headers: {},
    body: { feature_id: "cold-email", query: "写一封开发信", user: "yd-user-1" }
  }, response);

  assert.equal(response.statusCode, 409);
  assert.match(JSON.parse(response.body).message, /还没有配置/);
});
