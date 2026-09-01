const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const engine = require("../query-engine.js");
const extensionRoot = path.resolve(__dirname, "..");
const APP_ID = "11111111-1111-4111-8111-111111111111";
const LOGS_URL = `https://cloud.dify.ai/app/${APP_ID}/logs`;

/**
 * 创建一个只记录监听器的 Chrome 事件替身。
 *
 * @returns {{ listeners: Function[], registrations: unknown[][], addListener: Function }} 可手动触发的事件对象。
 * @throws {Error} 本函数不主动抛异常。
 */
function createChromeEvent() {
  const listeners = [];
  const registrations = [];
  return {
    listeners,
    registrations,
    addListener(listener, ...args) {
      listeners.push(listener);
      registrations.push(args);
    }
  };
}

/**
 * 在隔离 VM 中运行真实 background.js，并注入最小 Chrome API。
 *
 * 这里没有模拟查询引擎行为；生产 background 会使用真实 query-engine.js。
 * 只替换浏览器和网络边界，使测试可以观察注册事件、session 写入和 fetch 参数。
 *
 * @returns {{ chrome: Record<string, unknown>, events: Record<string, ReturnType<typeof createChromeEvent>>, sessionValues: Record<string, unknown>, sessionWrites: unknown[], fetchCalls: unknown[], runMessage: Function }} 后台测试环境。
 * @throws {Error} background.js 缺失或执行异常时抛出。
 */
function loadBackground(config = {}) {
  const backgroundPath = path.join(extensionRoot, "background.js");
  assert.equal(fs.existsSync(backgroundPath), true, "background.js 应存在");

  const events = {
    onBeforeSendHeaders: createChromeEvent(),
    onCompleted: createChromeEvent(),
    onErrorOccurred: createChromeEvent(),
    onInstalled: createChromeEvent(),
    onMessage: createChromeEvent()
  };
  const sessionValues = {};
  const sessionWrites = [];
  const fetchCalls = [];
  const progressMessages = [];
  const tab = { id: 7, url: LOGS_URL, windowId: 3 };

  const chrome = {
    sidePanel: {
      async setPanelBehavior() {}
    },
    runtime: {
      onInstalled: events.onInstalled,
      onMessage: events.onMessage,
      async sendMessage(message) {
        progressMessages.push(message);
      }
    },
    webRequest: {
      onBeforeSendHeaders: events.onBeforeSendHeaders,
      onCompleted: events.onCompleted,
      onErrorOccurred: events.onErrorOccurred
    },
    storage: {
      session: {
        async set(values) {
          Object.assign(sessionValues, values);
          sessionWrites.push(structuredClone(values));
        },
        async get(keys) {
          const selected = {};
          const requested = Array.isArray(keys) ? keys : [keys];
          requested.forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(sessionValues, key)) {
              selected[key] = sessionValues[key];
            }
          });
          return selected;
        },
        async remove(keys) {
          const requested = Array.isArray(keys) ? keys : [keys];
          requested.forEach((key) => delete sessionValues[key]);
        }
      }
    },
    tabs: {
      async query() {
        return [tab];
      },
      async get(tabId) {
        return tabId === tab.id ? tab : null;
      },
      async reload() {}
    }
  };

  const sandbox = {
    AbortController,
    chrome,
    console,
    URL,
    setTimeout,
    clearTimeout,
    structuredClone,
    DifyLogQueryEngine: engine,
    importScripts() {},
    async fetch(url, options) {
      fetchCalls.push({
        url,
        options: {
          ...options,
          headers: { ...(options.headers || {}) },
          signal: options.signal
        }
      });
      if (typeof config.fetch === "function") {
        return config.fetch(url, options);
      }
      return {
        ok: true,
        status: 200,
        async json() {
          return { data: [], has_more: false };
        }
      };
    }
  };
  sandbox.globalThis = sandbox;

  vm.runInNewContext(fs.readFileSync(backgroundPath, "utf8"), sandbox, {
    filename: backgroundPath
  });

  /**
   * 调用 background 注册的 runtime.onMessage 监听器。
   *
   * @param {Record<string, unknown>} message - Side Panel 风格消息。
   * @returns {Promise<Record<string, unknown>>} background 的安全响应。
   * @throws {Error} background 没有注册消息监听器或超时时抛出。
   */
  async function runMessage(message) {
    const listener = events.onMessage.listeners[0];
    assert.equal(typeof listener, "function", "background 应注册 runtime.onMessage");

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("等待 background 响应超时")), 1000);
      const keepOpen = listener(message, {}, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });
      assert.equal(keepOpen, true, "异步消息必须保持 sendResponse 通道开启");
    });
  }

  return {
    chrome,
    events,
    sessionValues,
    sessionWrites,
    fetchCalls,
    progressMessages,
    runMessage
  };
}

test("manifest 只授权 Dify Cloud，并且不申请 Cookie 权限", () => {
  const manifestPath = path.join(extensionRoot, "manifest.json");
  assert.equal(fs.existsSync(manifestPath), true, "manifest.json 应存在");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.minimum_chrome_version, "114");
  assert.deepEqual(manifest.host_permissions, ["https://cloud.dify.ai/*"]);
  assert.equal(manifest.permissions.includes("cookies"), false);
  assert.equal(manifest.permissions.includes("webRequest"), true);
  assert.equal(manifest.permissions.includes("sidePanel"), true);
  assert.equal(manifest.side_panel.default_path, "sidepanel.html");
  assert.equal(manifest.icons[128], "icons/icon-128.png");
});

test("background 只在成功 GET 完成后把 CSRF 写入 session 内存", async () => {
  const runtime = loadBackground();
  const beforeListener = runtime.events.onBeforeSendHeaders.listeners[0];
  const completedListener = runtime.events.onCompleted.listeners[0];

  assert.equal(typeof beforeListener, "function");
  assert.equal(typeof completedListener, "function");

  beforeListener({
    requestId: "request-1",
    method: "GET",
    url: "https://cloud.dify.ai/console/api/apps/list",
    requestHeaders: [
      { name: "Cookie", value: "access_token=do-not-store" },
      { name: "X-CSRF-Token", value: "csrf-current-value" },
      { name: "Authorization", value: "Bearer do-not-store" }
    ]
  });
  assert.equal(runtime.sessionWrites.length, 0, "请求尚未成功时不能确认 CSRF");

  completedListener({
    requestId: "request-1",
    method: "GET",
    url: "https://cloud.dify.ai/console/api/apps/list",
    statusCode: 200
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(runtime.sessionWrites.length, 1);
  assert.equal(runtime.sessionValues.difyCsrfContext.csrfToken, "csrf-current-value");
  assert.equal(runtime.sessionValues.difyCsrfContext.origin, "https://cloud.dify.ai");
  const serialized = JSON.stringify(runtime.sessionValues);
  assert.equal(serialized.includes("do-not-store"), false);
});

test("background 忽略失败响应和非 GET 请求中的 CSRF", async () => {
  const runtime = loadBackground();
  const beforeListener = runtime.events.onBeforeSendHeaders.listeners[0];
  const completedListener = runtime.events.onCompleted.listeners[0];

  beforeListener({
    requestId: "failed-request",
    method: "GET",
    url: "https://cloud.dify.ai/console/api/apps/list",
    requestHeaders: [{ name: "X-CSRF-Token", value: "failed-token" }]
  });
  completedListener({
    requestId: "failed-request",
    method: "GET",
    url: "https://cloud.dify.ai/console/api/apps/list",
    statusCode: 401
  });

  beforeListener({
    requestId: "write-request",
    method: "POST",
    url: "https://cloud.dify.ai/console/api/apps/list",
    requestHeaders: [{ name: "X-CSRF-Token", value: "write-token" }]
  });
  completedListener({
    requestId: "write-request",
    method: "POST",
    url: "https://cloud.dify.ai/console/api/apps/list",
    statusCode: 200
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(runtime.sessionWrites.length, 0);
});

test("GET_ACTIVE_CONTEXT 只接受当前活动的 Dify 日志页", async () => {
  const runtime = loadBackground();
  const response = await runtime.runMessage({ type: "GET_ACTIVE_CONTEXT" });

  assert.deepEqual(JSON.parse(JSON.stringify(response)), {
    ok: true,
    context: {
      tabId: 7,
      windowId: 3,
      origin: "https://cloud.dify.ai",
      appId: APP_ID,
      url: LOGS_URL,
      hasAuthContext: false
    }
  });
});

test("RUN_QUERY 使用 credentials include 和 CSRF，但不构造 Cookie 或 Authorization", async () => {
  const runtime = loadBackground();
  runtime.sessionValues.difyCsrfContext = {
    csrfToken: "csrf-runtime-value",
    capturedAt: Date.now(),
    origin: "https://cloud.dify.ai"
  };

  const response = await runtime.runMessage({
    type: "RUN_QUERY",
    queryId: "query-1",
    tabId: 7,
    appId: APP_ID,
    mode: "app-failed",
    start: "2026-08-20T08:00:00+08:00",
    end: "2026-08-20T10:00:00+08:00",
    maxPages: 1
  });

  assert.equal(response.ok, true);
  assert.equal(response.report.read_only, true);
  assert.equal(runtime.fetchCalls.length, 1);
  assert.equal(runtime.fetchCalls[0].options.method, "GET");
  assert.equal(runtime.fetchCalls[0].options.credentials, "include");
  assert.equal(runtime.fetchCalls[0].options.headers["X-CSRF-Token"], "csrf-runtime-value");
  assert.equal(Object.prototype.hasOwnProperty.call(runtime.fetchCalls[0].options.headers, "Cookie"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(runtime.fetchCalls[0].options.headers, "Authorization"), false);
  assert.match(runtime.fetchCalls[0].url, new RegExp(`/console/api/apps/${APP_ID}/advanced-chat/workflow-runs`));
});

test("成本查询只为指定 Conversation 读取节点执行", async () => {
  const runtime = loadBackground({
    async fetch(url) {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith("advanced-chat/workflow-runs")) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              data: [
                {
                  id: "run-cost-target",
                  conversation_id: "conversation-cost-target",
                  status: "succeeded",
                  created_at: "2026-08-20T09:00:00+08:00"
                },
                {
                  id: "run-cost-other",
                  conversation_id: "conversation-cost-other",
                  status: "succeeded",
                  created_at: "2026-08-20T09:00:00+08:00"
                }
              ],
              has_more: false
            };
          }
        };
      }
      if (parsed.pathname.endsWith("run-cost-target/node-executions")) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              data: [{
                id: "node-cost-target",
                status: "succeeded",
                execution_metadata: { total_price: "0.02", currency: "USD" }
              }]
            };
          }
        };
      }
      throw new Error(`未预期 URL：${url}`);
    }
  });
  runtime.sessionValues.difyCsrfContext = {
    csrfToken: "csrf-runtime-value",
    capturedAt: Date.now(),
    origin: "https://cloud.dify.ai"
  };

  const response = await runtime.runMessage({
    type: "RUN_QUERY",
    queryId: "query-cost-conversation",
    tabId: 7,
    appId: APP_ID,
    mode: "cost",
    conversationId: "conversation-cost-target",
    start: "2026-08-20T08:00:00+08:00",
    end: "2026-08-20T10:00:00+08:00",
    maxPages: 1
  });

  assert.equal(response.ok, true);
  assert.equal(response.report.summary.conversation_id, "conversation-cost-target");
  assert.deepEqual(
    JSON.parse(JSON.stringify(response.report.summary.cost_by_currency)),
    [{ currency: "USD", total_price: 0.02, run_count: 1, node_count: 1 }]
  );
  assert.equal(runtime.fetchCalls.some((call) => call.url.includes("run-cost-other/node-executions")), false);
});

test("RUN_QUERY 会持续发送脱敏快照，错误分类只在点击后加载节点", async () => {
  const runId = "run-background-lazy";
  const runtime = loadBackground({
    async fetch(url) {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith("advanced-chat/workflow-runs")) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              data: [{
                id: runId,
                conversation_id: "conversation-background",
                status: "failed",
                created_at: "2026-08-20T09:00:00+08:00"
              }],
              has_more: false
            };
          }
        };
      }
      if (parsed.pathname.endsWith(`workflow-runs/${runId}`)) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              data: {
                id: runId,
                status: "failed",
                created_at: "2026-08-20T09:00:00+08:00",
                error: "timeout private detail"
              }
            };
          }
        };
      }
      if (parsed.pathname.endsWith(`workflow-runs/${runId}/node-executions`)) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              data: [{
                id: "node-background",
                node_id: "llm-node",
                title: "模型节点",
                node_type: "llm",
                status: "failed",
                error: "timeout private node detail"
              }]
            };
          }
        };
      }
      throw new Error(`未预期 URL：${url}`);
    }
  });
  runtime.sessionValues.difyCsrfContext = {
    csrfToken: "csrf-runtime-value",
    capturedAt: Date.now(),
    origin: "https://cloud.dify.ai"
  };

  const response = await runtime.runMessage({
    type: "RUN_QUERY",
    queryId: "query-progressive",
    tabId: 7,
    appId: APP_ID,
    mode: "app-failed",
    start: "2026-08-20T08:00:00+08:00",
    end: "2026-08-20T10:00:00+08:00",
    maxPages: 1
  });

  assert.equal(response.ok, true);
  assert.equal(runtime.fetchCalls.some((call) => call.url.endsWith("node-executions")), false);
  const partials = runtime.progressMessages.filter((message) => message.type === "QUERY_PARTIAL");
  assert.equal(partials.length > 0, true);
  assert.equal(partials.every((message) => message.queryId === "query-progressive"), true);
  assert.equal(JSON.stringify(partials).includes("private detail"), false);

  const categoryResponse = await runtime.runMessage({
    type: "LOAD_ERROR_CATEGORY",
    queryId: "query-progressive",
    category: "请求超时"
  });
  assert.equal(categoryResponse.ok, true);
  assert.equal(categoryResponse.runs.length, 1);
  assert.equal(categoryResponse.runs[0].failed_nodes[0].error_category, "请求超时");
  assert.equal(runtime.fetchCalls.filter((call) => call.url.endsWith("node-executions")).length, 1);
  assert.equal(JSON.stringify(categoryResponse).includes("private node detail"), false);
});

test("CANCEL_QUERY 会中止对应查询，且后台返回明确的已取消错误", async () => {
  let notifyFetchStarted;
  const fetchStarted = new Promise((resolve) => {
    notifyFetchStarted = resolve;
  });
  const runtime = loadBackground({
    fetch(url, options) {
      notifyFetchStarted();
      return new Promise((resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        }, { once: true });
      });
    }
  });
  runtime.sessionValues.difyCsrfContext = {
    csrfToken: "csrf-runtime-value",
    capturedAt: Date.now(),
    origin: "https://cloud.dify.ai"
  };

  const queryResponsePromise = runtime.runMessage({
    type: "RUN_QUERY",
    queryId: "query-to-cancel",
    tabId: 7,
    appId: APP_ID,
    mode: "app-failed",
    start: "2026-08-20T08:00:00+08:00",
    end: "2026-08-20T10:00:00+08:00",
    maxPages: 1
  });
  await fetchStarted;

  const cancelResponse = await runtime.runMessage({
    type: "CANCEL_QUERY",
    queryId: "query-to-cancel"
  });
  const queryResponse = await queryResponsePromise;

  assert.deepEqual(JSON.parse(JSON.stringify(cancelResponse)), { ok: true, cancelled: true });
  assert.equal(runtime.fetchCalls[0].options.signal.aborted, true);
  assert.equal(queryResponse.ok, false);
  assert.equal(queryResponse.error.code, "QUERY_CANCELLED");
});
