const test = require("node:test");
const assert = require("node:assert/strict");

const RUNTIME_CONFIG_MODULE = "../api/dify-runtime-config";

/**
 * 创建兼容 Vercel Node Handler 的最小响应假对象。
 *
 * @returns {{ statusCode: number, headers: object, body: string, setHeader: Function, end: Function }} 可断言的响应对象。
 */
function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = String(value);
    },
    end(value = "") {
      this.body += String(value);
    }
  };
}

test("runtime config endpoint rejects browsers without the private bridge token", async () => {
  const { createRuntimeConfigHandler } = require(RUNTIME_CONFIG_MODULE);
  let storeRead = false;
  const handler = createRuntimeConfigHandler({
    env: { DIFY_WORKER_BRIDGE_TOKEN: "private-bridge-token" },
    createConfigStore() {
      return { async read() { storeRead = true; return null; } };
    }
  });
  const response = createResponse();

  await handler({
    method: "POST",
    headers: {},
    body: { feature_id: "market-research" }
  }, response);

  assert.equal(response.statusCode, 401);
  assert.equal(storeRead, false);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.doesNotMatch(response.body, /private-bridge-token/);
});

test("runtime config endpoint returns a decrypted config only to the authorized Worker", async () => {
  const { createRuntimeConfigHandler } = require(RUNTIME_CONFIG_MODULE);
  const reads = [];
  const handler = createRuntimeConfigHandler({
    env: { DIFY_WORKER_BRIDGE_TOKEN: "private-bridge-token" },
    createConfigStore() {
      return {
        async read(featureId) {
          reads.push(featureId);
          return {
            featureId,
            appType: "dialogue",
            apiKey: "app-runtime-secret",
            appName: "市场调研",
            appMode: "chat",
            parameters: {}
          };
        }
      };
    }
  });
  const response = createResponse();

  await handler({
    method: "POST",
    headers: { authorization: "Bearer private-bridge-token" },
    body: { feature_id: "market-research" }
  }, response);

  const payload = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(reads, ["market-research"]);
  assert.equal(payload.apiKey, "app-runtime-secret");
  assert.equal(payload.appType, "dialogue");
  assert.equal(response.headers["cache-control"], "no-store");
});
