const test = require("node:test");
const assert = require("node:assert/strict");

const { APP_TYPES } = require("../lib/dify-core");
const { createDifyConfigStore } = require("../lib/dify-config-store");

/**
 * 创建一个最小 Upstash REST 假服务。
 *
 * 作用：
 * - 测试真实发送给 Redis REST API 的 GET/SET 命令结构。
 * - 数据只保存在当前测试进程内，不接触外部网络或真实密钥。
 *
 * @returns {{ fetchImpl: Function, records: Map<string, string> }} 假 fetch 和底层记录容器。
 */
function createFakeRedis() {
  const records = new Map();

  return {
    records,
    fetchImpl: async (_url, options) => {
      const [command, key, value] = JSON.parse(options.body);

      if (command === "GET") {
        return new Response(JSON.stringify({ result: records.get(key) ?? null }), { status: 200 });
      }

      if (command === "SET") {
        records.set(key, value);
        return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
      }

      return new Response(JSON.stringify({ error: "unsupported command" }), { status: 400 });
    }
  };
}

test("saves one encrypted configuration per feature and never returns the original key in metadata", async () => {
  const fakeRedis = createFakeRedis();
  const store = createDifyConfigStore({
    fetchImpl: fakeRedis.fetchImpl,
    env: {
      UPSTASH_REDIS_REST_URL: "https://redis.example.test",
      UPSTASH_REDIS_REST_TOKEN: "redis-test-token",
      DIFY_CONFIG_ENCRYPTION_KEY: "c".repeat(64)
    }
  });

  await store.save({
    featureId: "market-research",
    appType: APP_TYPES.DIALOGUE,
    apiKey: "app-market-secret",
    appInfo: { name: "外贸市场调研", mode: "chat" },
    parameters: { user_input_form: [] }
  });

  const storedText = [...fakeRedis.records.values()][0];
  const resolved = await store.read("market-research");
  const metadata = await store.readMetadata("market-research");

  assert.equal(storedText.includes("app-market-secret"), false);
  assert.equal(resolved.apiKey, "app-market-secret");
  assert.equal(metadata.hasKey, true);
  assert.equal(metadata.maskedKey, "app-••••••••••••••••••••••••••••••");
  assert.equal(JSON.stringify(metadata).includes("app-market-secret"), false);
  assert.equal(metadata.appName, "外贸市场调研");
});

test("uses existing Vercel environment keys as a compatibility fallback", async () => {
  const store = createDifyConfigStore({
    fetchImpl: async () => new Response(JSON.stringify({ result: null }), { status: 200 }),
    env: {
      DIFY_CUSTOMER_RESEARCH_API_KEY: "app-customer-secret",
      DIFY_YD_ARTIFACT_API_KEY: "app-artifact-secret",
      DIFY_MARKET_RESEARCH_API_KEY: "app-market-secret"
    }
  });

  const customerResearch = await store.read("customer-research");
  const ydArtifact = await store.read("yd-artifact");
  const marketResearch = await store.read("market-research");

  assert.equal(customerResearch.appType, APP_TYPES.CHATFLOW);
  assert.equal(customerResearch.apiKey, "app-customer-secret");
  assert.equal(ydArtifact.appType, APP_TYPES.CHATFLOW);
  assert.equal(ydArtifact.apiKey, "app-artifact-secret");
  assert.equal(marketResearch.appType, APP_TYPES.DIALOGUE);
  assert.equal(marketResearch.apiKey, "app-market-secret");
});

test("accepts the KV_REST_API variables injected by Vercel Marketplace", async () => {
  const fakeRedis = createFakeRedis();
  const store = createDifyConfigStore({
    fetchImpl: fakeRedis.fetchImpl,
    env: {
      KV_REST_API_URL: "https://redis.example.test",
      KV_REST_API_TOKEN: "vercel-kv-test-token",
      DIFY_CONFIG_ENCRYPTION_KEY: "v".repeat(64)
    }
  });

  const saved = await store.save({
    featureId: "market-research",
    appType: APP_TYPES.DIALOGUE,
    apiKey: "app-market-secret",
    appInfo: { name: "市场调研", mode: "agent-chat" },
    parameters: {}
  });

  assert.equal(saved.storageReady, true);
  assert.equal(saved.source, "redis");
  assert.equal(saved.appMode, "agent-chat");
});

test("refuses browser saves until persistent Redis and encryption settings exist", async () => {
  const store = createDifyConfigStore({ env: {}, fetchImpl: global.fetch });

  await assert.rejects(() => store.save({
    featureId: "market-research",
    appType: APP_TYPES.DIALOGUE,
    apiKey: "app-market-secret",
    appInfo: { name: "市场调研", mode: "chat" },
    parameters: {}
  }), /Upstash Redis/);
});
