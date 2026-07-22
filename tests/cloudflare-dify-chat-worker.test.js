const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const WORKER_PATH = path.join(__dirname, "../cloudflare-worker/dify-chat-worker.mjs");

/**
 * 加载真实 Cloudflare Worker 模块。
 *
 * @returns {Promise<object>} Worker 模块导出的工厂和默认处理器。
 * @throws {AssertionError} 迁移实现尚未创建时给出清晰的测试失败原因。
 */
async function loadWorkerModule() {
  assert.equal(fs.existsSync(WORKER_PATH), true, "应先实现 Cloudflare Dify 长流式代理");
  return import(`${pathToFileURL(WORKER_PATH).href}?test=${Date.now()}`);
}

test("Cloudflare Worker streams normalized Dify events with the existing Redis config", async () => {
  const { createDifyChatWorker } = await loadWorkerModule();
  const calls = [];
  const pendingTasks = [];
  const worker = createDifyChatWorker({
    createConfigStore() {
      return {
        async read(featureId) {
          calls.push({ type: "read", featureId });
          return { featureId, appType: "dialogue", apiKey: "app-test-key", skillKey: "market-research" };
        }
      };
    },
    async streamChat(options) {
      calls.push({ type: "stream", query: options.query, user: options.user, inputs: options.inputs });
      await options.onEvent({ type: "process", step: { id: "search-1", label: "正在搜索" } });
      await options.onEvent({ type: "answer_delta", delta: "市场" });
      await options.onEvent({ type: "done", result: { answer: "市场", conversation_id: "conversation-1" } });
    },
    heartbeatMs: 1000
  });
  const request = new Request("https://worker.example/api/dify-chat", {
    method: "POST",
    headers: {
      Origin: "https://wmww-g.github.io",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      feature_id: "market-research",
      query: "调研泰国储能市场",
      conversation_id: "",
      user: "yd-test-user",
      inputs: { skill_key: "tampered-skill", model_key: "deepseek-v4-pro" },
      files: []
    })
  });

  const response = await worker.fetch(request, {}, { waitUntil(task) { pendingTasks.push(task); } });
  const streamText = await response.text();
  await Promise.all(pendingTasks);

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /text\/event-stream/);
  assert.equal(response.headers.get("cache-control"), "no-cache, no-transform");
  assert.equal(response.headers.get("access-control-allow-origin"), "https://wmww-g.github.io");
  assert.deepEqual(calls, [
    { type: "read", featureId: "market-research" },
    {
      type: "stream",
      query: "调研泰国储能市场",
      user: "yd-test-user",
      inputs: { skill_key: "market-research", model_key: "deepseek-v4-pro" }
    }
  ]);
  assert.match(streamText, /"type":"process"/);
  assert.match(streamText, /"type":"answer_delta"/);
  assert.match(streamText, /"type":"done"/);
});

test("Cloudflare Worker keeps a quiet long stream alive with SSE comments", async () => {
  const { createDifyChatWorker } = await loadWorkerModule();
  const worker = createDifyChatWorker({
    createConfigStore() {
      return { async read() { return { appType: "chatflow", apiKey: "app-test-key" }; } };
    },
    async streamChat(options) {
      await new Promise((resolve) => setTimeout(resolve, 12));
      await options.onEvent({ type: "done", result: { answer: "完成" } });
    },
    heartbeatMs: 2
  });
  const request = new Request("https://worker.example/api/dify-chat", {
    method: "POST",
    headers: { Origin: "http://127.0.0.1:8765", "Content-Type": "application/json" },
    body: JSON.stringify({ feature_id: "customer-research", query: "长任务", user: "yd-test-user" })
  });

  const response = await worker.fetch(request, {}, { waitUntil() {} });
  const streamText = await response.text();

  assert.match(streamText, /: keep-alive/);
  assert.match(streamText, /"type":"done"/);
});

test("Cloudflare Worker keeps response-dependent streaming work out of waitUntil", async () => {
  const { createDifyChatWorker } = await loadWorkerModule();
  let waitUntilCalls = 0;
  const worker = createDifyChatWorker({
    createConfigStore() {
      return { async read() { return { appType: "dialogue", apiKey: "app-test-key" }; } };
    },
    async streamChat(options) {
      await options.onEvent({ type: "done", result: { answer: "完成" } });
    }
  });
  const request = new Request("https://worker.example/api/dify-chat", {
    method: "POST",
    headers: { Origin: "https://wmww-g.github.io", "Content-Type": "application/json" },
    body: JSON.stringify({ feature_id: "market-research", query: "长流生命周期", user: "yd-test-user" })
  });

  const response = await worker.fetch(request, {}, {
    waitUntil() {
      waitUntilCalls += 1;
    }
  });
  await response.text();

  assert.equal(waitUntilCalls, 0, "响应内容依赖的长流不能注册为 30 秒后台任务");
});

test("Cloudflare Worker rejects disallowed origins before reading stored API keys", async () => {
  const { createDifyChatWorker } = await loadWorkerModule();
  let storeCreated = false;
  const worker = createDifyChatWorker({
    createConfigStore() {
      storeCreated = true;
      return { async read() { return null; } };
    },
    async streamChat() {}
  });
  const request = new Request("https://worker.example/api/dify-chat", {
    method: "POST",
    headers: { Origin: "https://attacker.example", "Content-Type": "application/json" },
    body: JSON.stringify({ feature_id: "market-research", query: "测试", user: "yd-test-user" })
  });

  const response = await worker.fetch(request, {}, { waitUntil() {} });

  assert.equal(response.status, 403);
  assert.equal(storeCreated, false);
});

test("Cloudflare Worker returns 409 when the selected page has no saved Dify key", async () => {
  const { createDifyChatWorker } = await loadWorkerModule();
  const worker = createDifyChatWorker({
    createConfigStore() {
      return { async read() { return null; } };
    },
    async streamChat() {}
  });
  const request = new Request("https://worker.example/api/dify-chat", {
    method: "POST",
    headers: { Origin: "https://wmww-g.github.io", "Content-Type": "application/json" },
    body: JSON.stringify({ feature_id: "market-research", query: "测试", user: "yd-test-user" })
  });

  const response = await worker.fetch(request, {}, { waitUntil() {} });
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.match(payload.message, /还没有配置 Dify API Key/);
});

test("Cloudflare Worker reads runtime config from the private Vercel bridge", async () => {
  const { createDifyChatWorker } = await loadWorkerModule();
  const fetchCalls = [];
  const worker = createDifyChatWorker({
    async streamChat(options) {
      assert.equal(options.apiKey, "app-runtime-secret");
      assert.deepEqual(options.inputs, {
        skill_key: "market-research",
        model_key: "gemini-3.5-flash"
      });
      await options.onEvent({ type: "done", result: { answer: "桥接成功" } });
    },
    fetchImpl: async (url, options = {}) => {
      fetchCalls.push({
        url: String(url),
        authorization: options.headers?.Authorization,
        body: JSON.parse(options.body)
      });
      return new Response(JSON.stringify({
        featureId: "market-research",
        appType: "dialogue",
        apiKey: "app-runtime-secret",
        skillKey: "market-research"
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  });
  const request = new Request("https://worker.example/api/dify-chat", {
    method: "POST",
    headers: { Origin: "https://wmww-g.github.io", "Content-Type": "application/json" },
    body: JSON.stringify({
      feature_id: "market-research",
      query: "测试桥接",
      user: "yd-test-user",
      inputs: { model_key: "gemini-3.5-flash" }
    })
  });

  const response = await worker.fetch(request, {
    DIFY_RUNTIME_CONFIG_URL: "https://proxy.example/api/dify-runtime-config",
    DIFY_WORKER_BRIDGE_TOKEN: "private-bridge-token"
  }, { waitUntil() {} });
  const streamText = await response.text();

  assert.equal(response.status, 200);
  assert.deepEqual(fetchCalls, [{
    url: "https://proxy.example/api/dify-runtime-config",
    authorization: "Bearer private-bridge-token",
    body: { feature_id: "market-research" }
  }]);
  assert.match(streamText, /桥接成功/);
  assert.doesNotMatch(streamText, /app-runtime-secret/);
});
