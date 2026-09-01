/* global chrome, DifyLogQueryEngine, importScripts, fetch */

/**
 * TokenMind Dify 日志查询扩展的后台 Service Worker。
 *
 * 安全边界：
 * 1. 只观察 Dify Cloud Console 的 GET 请求；
 * 2. 只提取 X-CSRF-Token，不读取、不保存 Cookie 或 Authorization；
 * 3. 只允许 query-engine.js 明确列出的只读 Console GET 路径；
 * 4. 所有鉴权上下文仅写入 chrome.storage.session，浏览器重启或扩展重载后清空。
 */

"use strict";

if (typeof DifyLogQueryEngine === "undefined") {
  importScripts("query-engine.js");
}

const engine = globalThis.DifyLogQueryEngine;
const DIFY_ORIGIN = "https://cloud.dify.ai";
const CONSOLE_API_PREFIX = `${DIFY_ORIGIN}/console/api`;
const SESSION_KEY = "difyCsrfContext";
const AUTH_WAIT_TIMEOUT_MS = 12000;
const AUTH_POLL_INTERVAL_MS = 250;
const QUERY_SESSION_TTL_MS = 10 * 60 * 1000;
const observedCsrfByRequestId = new Map();
const activeQueries = new Map();
const activeDetailQueries = new Map();
// 查询会话只保存 App/Tab、错误分类和 Run ID，用于限制“展开分类”只能读取
// 当前结果已经出现过的 Run。原始错误、用户输入和业务正文不会存入这里。
const querySessions = new Map();

/**
 * 创建统一的用户取消错误，避免把 AbortError 暴露到界面。
 *
 * @returns {DifyLogQueryEngine.QueryError} 可安全展示的取消错误。
 * @throws {Error} 本函数不主动抛异常。
 */
function createCancelledError() {
  return new engine.QueryError("查询已取消。", "QUERY_CANCELLED");
}

/**
 * 在每个可能继续发请求的边界检查取消信号。
 *
 * @param {AbortSignal|undefined} signal - 当前查询的取消信号。
 * @returns {void}
 * @throws {DifyLogQueryEngine.QueryError} 用户已经取消时立即停止。
 */
function throwIfCancelled(signal) {
  if (signal?.aborted) {
    throw createCancelledError();
  }
}

/**
 * 让点击浏览器工具栏图标时直接打开侧边栏。
 *
 * @returns {Promise<void>} Chrome 完成设置后结束。
 * @throws {Error} Chrome API 不可用时可能拒绝；这里仅记录不含隐私的错误类别。
 */
async function configureSidePanel() {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (error) {
    console.warn("[TokenMind Dify Logs] 无法设置侧边栏点击行为。", error?.name || "Error");
  }
}

void configureSidePanel();
chrome.runtime.onInstalled.addListener(() => {
  void configureSidePanel();
});

/**
 * 判断 webRequest 事件是否属于允许观察的 Dify Console GET 请求。
 *
 * @param {Record<string, unknown>} details - Chrome webRequest 事件详情。
 * @returns {boolean} 只有目标域名下的 Console GET 才返回 true。
 * @throws {Error} 本函数不主动抛异常。
 */
function isObservableConsoleGet(details) {
  return details?.method === "GET"
    && typeof details.url === "string"
    && details.url.startsWith(`${CONSOLE_API_PREFIX}/`);
}

/**
 * 在请求发送前暂存 CSRF 候选值。
 *
 * 候选值先放在 Service Worker 内存 Map 中，只有响应成功后才写入 session。
 * 这样不会把已经失效并返回 401/403 的 CSRF 当成当前有效上下文。
 *
 * @param {Record<string, unknown>} details - onBeforeSendHeaders 事件详情。
 * @returns {void}
 * @throws {Error} URL 异常时直接忽略，不向 Chrome 事件循环抛出。
 */
function observeCsrfCandidate(details) {
  if (!isObservableConsoleGet(details)) {
    return;
  }

  const csrfHeader = (details.requestHeaders || []).find((header) => (
    String(header?.name || "").toLowerCase() === "x-csrf-token"
  ));
  const csrfToken = typeof csrfHeader?.value === "string" ? csrfHeader.value.trim() : "";
  if (!csrfToken) {
    return;
  }

  try {
    const origin = new URL(details.url).origin;
    if (origin !== DIFY_ORIGIN) {
      return;
    }
    observedCsrfByRequestId.set(details.requestId, { csrfToken, origin });
  } catch (error) {
    // URL 来自 Chrome，但仍保持防御式处理，避免单个异常事件终止 Service Worker。
  }
}

/**
 * 在请求 2xx 成功后确认 CSRF，并写入仅内存的 session 存储。
 *
 * @param {Record<string, unknown>} details - onCompleted 事件详情。
 * @returns {void}
 * @throws {Error} storage 写入失败只记录安全错误类别，不会泄露 CSRF。
 */
function confirmCsrfCandidate(details) {
  const candidate = observedCsrfByRequestId.get(details?.requestId);
  observedCsrfByRequestId.delete(details?.requestId);

  const succeeded = isObservableConsoleGet(details)
    && Number(details?.statusCode) >= 200
    && Number(details?.statusCode) < 300;
  if (!candidate || !succeeded) {
    return;
  }

  void chrome.storage.session.set({
    [SESSION_KEY]: {
      csrfToken: candidate.csrfToken,
      capturedAt: Date.now(),
      origin: candidate.origin
    }
  }).catch((error) => {
    console.warn("[TokenMind Dify Logs] 无法保存临时鉴权上下文。", error?.name || "Error");
  });
}

/**
 * 网络请求失败时丢弃尚未确认的 CSRF 候选值。
 *
 * @param {Record<string, unknown>} details - onErrorOccurred 事件详情。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function discardCsrfCandidate(details) {
  observedCsrfByRequestId.delete(details?.requestId);
}

chrome.webRequest.onBeforeSendHeaders.addListener(
  observeCsrfCandidate,
  { urls: [`${CONSOLE_API_PREFIX}/*`] },
  ["requestHeaders", "extraHeaders"]
);
chrome.webRequest.onCompleted.addListener(
  confirmCsrfCandidate,
  { urls: [`${CONSOLE_API_PREFIX}/*`] }
);
chrome.webRequest.onErrorOccurred.addListener(
  discardCsrfCandidate,
  { urls: [`${CONSOLE_API_PREFIX}/*`] }
);

/**
 * 读取当前 Service Worker 会话中的 CSRF 上下文。
 *
 * @returns {Promise<{csrfToken: string, capturedAt: number, origin: string}|null>} 有效上下文或 null。
 * @throws {Error} Chrome storage API 异常会向调用方抛出并由统一消息处理器脱敏。
 */
async function getAuthContext() {
  const stored = await chrome.storage.session.get(SESSION_KEY);
  const context = stored?.[SESSION_KEY];
  if (
    !context
    || context.origin !== DIFY_ORIGIN
    || typeof context.csrfToken !== "string"
    || !context.csrfToken
  ) {
    return null;
  }
  return context;
}

/**
 * 获取当前活动标签页并验证它正是 Dify Cloud 的某个 App 日志页。
 *
 * @param {number|undefined} requestedTabId - 可选的明确标签页 ID。
 * @returns {Promise<Record<string, unknown>>} 侧边栏可展示的安全页面上下文。
 * @throws {DifyLogQueryEngine.QueryError} 页面不匹配或标签页不存在时抛安全错误。
 */
async function getActiveContext(requestedTabId) {
  let tab = null;
  if (Number.isInteger(requestedTabId)) {
    tab = await chrome.tabs.get(requestedTabId);
  } else {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    tab = tabs[0] || null;
  }

  const parsed = engine.parseDifyLogsUrl(tab?.url);
  if (!tab || !Number.isInteger(tab.id) || !parsed) {
    throw new engine.QueryError(
      "请先打开 Dify Cloud 中某个 App 的日志页面。",
      "INVALID_DIFY_LOG_PAGE"
    );
  }

  const authContext = await getAuthContext();
  return {
    tabId: tab.id,
    windowId: tab.windowId,
    origin: parsed.origin,
    appId: parsed.appId,
    url: tab.url,
    hasAuthContext: Boolean(authContext)
  };
}

/**
 * 把查询参数追加到只读 Console 路径。
 *
 * @param {string} path - query-engine 生成的 `/apps/{appId}/...` 路径。
 * @param {Record<string, unknown>|undefined} params - 查询字符串键值。
 * @returns {string} 完整的 Dify Console URL。
 * @throws {Error} URL 构造失败时抛出。
 */
function buildConsoleUrl(path, params) {
  const url = new URL(`${CONSOLE_API_PREFIX}${path}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

/**
 * 创建一个绑定当前 App 的只读 JSON 客户端。
 *
 * @param {string} appId - 当前日志页确认过的 App UUID。
 * @param {AbortSignal|undefined} signal - 当前查询的取消信号。
 * @returns {(path: string, params?: Record<string, unknown>) => Promise<unknown>} 查询引擎使用的 GET 客户端。
 * @throws {DifyLogQueryEngine.QueryError} 缺失登录态、越过白名单、网络或 HTTP 错误时抛出安全错误。
 */
function createReadOnlyGetJson(appId, signal) {
  return async (path, params) => {
    throwIfCancelled(signal);
    const url = buildConsoleUrl(path, params);
    if (!engine.isAllowedConsoleUrl(url, appId)) {
      throw new engine.QueryError("查询请求不在只读白名单内。", "READ_ONLY_POLICY_BLOCKED");
    }

    const authContext = await getAuthContext();
    throwIfCancelled(signal);
    if (!authContext) {
      throw new engine.QueryError(
        "还没有捕获到当前 Dify 登录态，请刷新日志页后重试。",
        "AUTH_CONTEXT_MISSING"
      );
    }

    let response;
    try {
      response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "X-CSRF-Token": authContext.csrfToken
        },
        cache: "no-store",
        signal
      });
    } catch (error) {
      if (signal?.aborted || error?.name === "AbortError") {
        throw createCancelledError();
      }
      throw new engine.QueryError("连接 Dify 失败，请检查网络后重试。", "NETWORK_ERROR");
    }

    if (response.status === 401 || response.status === 403) {
      await chrome.storage.session.remove(SESSION_KEY);
      throw new engine.QueryError("Dify 登录态已经失效，将刷新页面后重试一次。", "AUTH_EXPIRED");
    }
    if (response.status === 402) {
      throw new engine.QueryError("Dify 返回 402，可能触及余额或计费边界；插件不会自动重试。", "DIFY_PAYMENT_REQUIRED");
    }
    if (!response.ok) {
      throw new engine.QueryError(`Dify 查询失败（HTTP ${response.status}）。`, "DIFY_HTTP_ERROR");
    }

    try {
      return await response.json();
    } catch (error) {
      if (signal?.aborted || error?.name === "AbortError") {
        throw createCancelledError();
      }
      throw new engine.QueryError("Dify 返回了无法解析的查询结果。", "INVALID_DIFY_RESPONSE");
    }
  };
}

/**
 * 等待刷新后的 Dify 页面发出一次成功 Console GET，从而捕获新的 CSRF。
 *
 * @param {number} previousCapturedAt - 刷新前上下文时间戳；没有旧值时传 0。
 * @param {AbortSignal|undefined} signal - 可选查询取消信号。
 * @returns {Promise<void>} 捕获到更新上下文时结束。
 * @throws {DifyLogQueryEngine.QueryError} 超时仍没有新上下文时抛安全错误。
 */
async function waitForFreshAuth(previousCapturedAt, signal) {
  const deadline = Date.now() + AUTH_WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    throwIfCancelled(signal);
    const context = await getAuthContext();
    if (context && Number(context.capturedAt || 0) > Number(previousCapturedAt || 0)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, AUTH_POLL_INTERVAL_MS));
  }
  throw new engine.QueryError(
    "刷新后仍未捕获到 Dify 登录态，请确认页面已登录并再次刷新。",
    "AUTH_CAPTURE_TIMEOUT"
  );
}

/**
 * 刷新明确的 Dify 日志标签页，并等待新的临时 CSRF 上下文。
 *
 * @param {number} tabId - 已验证的 Dify 日志标签页 ID。
 * @param {AbortSignal|undefined} signal - 可选查询取消信号。
 * @returns {Promise<void>} 页面刷新且捕获成功时结束。
 * @throws {DifyLogQueryEngine.QueryError} 页面无效或捕获超时时抛安全错误。
 */
async function refreshAuthContext(tabId, signal) {
  throwIfCancelled(signal);
  await getActiveContext(tabId);
  const previous = await getAuthContext();
  throwIfCancelled(signal);
  await chrome.tabs.reload(tabId);
  await waitForFreshAuth(Number(previous?.capturedAt || 0), signal);
}

/**
 * 从脱敏 Run 摘要中读取用于错误聚合的稳定类别。
 *
 * @param {Record<string, unknown>} run - query-engine 返回的白名单 Run。
 * @returns {string} 运行级类别、首个失败节点类别或兜底类别。
 * @throws {Error} 本函数不主动抛异常。
 */
function safeRunCategory(run) {
  return String(
    run?.error_category
    || (Array.isArray(run?.failed_nodes) ? run.failed_nodes[0]?.error_category : "")
    || "未分类运行错误"
  );
}

/**
 * 清理过期的错误分类会话，避免 Service Worker 长时间运行时无界增长。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function pruneQuerySessions() {
  const now = Date.now();
  for (const [queryId, session] of querySessions.entries()) {
    if (Number(session?.expiresAt || 0) <= now) {
      querySessions.delete(queryId);
    }
  }
}

/**
 * 用最新脱敏快照更新允许展开的错误分类和 Run ID。
 *
 * 每次快照都包含截至当前已分类的完整安全 Run 集，因此可以重建 Map，不需要
 * 保存任何原始响应。成本和 marker 报告不会生成可展开的错误分类。
 *
 * @param {Record<string, unknown>} message - 当前查询消息。
 * @param {Record<string, unknown>} report - query-engine 脱敏报告。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function updateQuerySession(message, report) {
  pruneQuerySessions();
  const categories = new Map();
  if (["user-failed", "app-failed"].includes(report?.mode)) {
    const runs = Array.isArray(report?.summary?.runs) ? report.summary.runs : [];
    for (const run of runs) {
      const runId = String(run?.id || "").trim();
      if (!runId) {
        continue;
      }
      const category = safeRunCategory(run);
      const ids = categories.get(category) || new Set();
      ids.add(runId);
      categories.set(category, ids);
    }
  }
  querySessions.set(String(message.queryId), {
    appId: String(message.appId || ""),
    tabId: Number(message.tabId),
    categories,
    expiresAt: Date.now() + QUERY_SESSION_TTL_MS
  });
}

/**
 * 读取一个仍有效的查询会话。
 *
 * @param {string} queryId - Side Panel 生成的内部查询 ID。
 * @returns {Record<string, unknown>|null} 有效会话或 null。
 * @throws {Error} 本函数不主动抛异常。
 */
function getQuerySession(queryId) {
  pruneQuerySessions();
  return querySessions.get(queryId) || null;
}

/**
 * 登记分类明细请求，使“取消”可以同时中止主查询和点击后加载的节点请求。
 *
 * @param {string} queryId - 所属查询 ID。
 * @param {AbortController} controller - 分类请求控制器。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function registerDetailController(queryId, controller) {
  const controllers = activeDetailQueries.get(queryId) || new Set();
  controllers.add(controller);
  activeDetailQueries.set(queryId, controllers);
}

/**
 * 移除已经结束的分类明细控制器。
 *
 * @param {string} queryId - 所属查询 ID。
 * @param {AbortController} controller - 已完成控制器。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function unregisterDetailController(queryId, controller) {
  const controllers = activeDetailQueries.get(queryId);
  if (!controllers) {
    return;
  }
  controllers.delete(controller);
  if (!controllers.size) {
    activeDetailQueries.delete(queryId);
  }
}

/**
 * 执行一次完整的只读查询。
 *
 * @param {Record<string, unknown>} message - 侧边栏已经结构化的查询条件。
 * @param {AbortSignal} signal - 当前查询的取消信号。
 * @returns {Promise<Record<string, unknown>>} 脱敏查询报告。
 * @throws {DifyLogQueryEngine.QueryError} 页面、输入、鉴权或查询失败时抛安全错误。
 */
async function runQueryOnce(message, signal) {
  throwIfCancelled(signal);
  const context = await getActiveContext(message.tabId);
  if (context.appId !== message.appId) {
    throw new engine.QueryError("日志页面已经切换，请重新读取当前 App。", "APP_CONTEXT_CHANGED");
  }

  const report = await engine.queryLogs({
    getJson: createReadOnlyGetJson(context.appId, signal),
    appId: context.appId,
    mode: message.mode,
    userId: message.userId,
    conversationId: message.conversationId,
    marker: message.marker,
    runId: message.runId,
    start: message.start,
    end: message.end,
    maxPages: message.maxPages,
    onProgress(progress) {
      // 进度消息仅包含阶段和计数，不带用户 ID、marker、原始错误或业务正文。
      void chrome.runtime.sendMessage({
        type: "QUERY_PROGRESS",
        queryId: message.queryId,
        stage: progress.stage,
        counts: progress
      }).catch(() => {});
    },
    onPartial(partialReport) {
      // query-engine 在回调前已经做完字段白名单化。先同步更新允许展开的
      // Run 集合，再通知面板，避免用户快速点击分类时出现会话竞态。
      updateQuerySession(message, partialReport);
      void chrome.runtime.sendMessage({
        type: "QUERY_PARTIAL",
        queryId: message.queryId,
        report: partialReport
      }).catch(() => {});
    }
  });
  updateQuerySession(message, report);
  return report;
}

/**
 * 执行查询；只有 401/403 才刷新页面并整体重试一次。
 *
 * @param {Record<string, unknown>} message - 侧边栏查询消息。
 * @param {AbortSignal} signal - 当前查询的取消信号。
 * @returns {Promise<Record<string, unknown>>} 脱敏报告。
 * @throws {DifyLogQueryEngine.QueryError} 第二次仍失败或其他错误时抛出。
 */
async function runQuery(message, signal) {
  try {
    return await runQueryOnce(message, signal);
  } catch (error) {
    if (error?.code !== "AUTH_EXPIRED") {
      throw error;
    }
    await refreshAuthContext(message.tabId, signal);
    return runQueryOnce(message, signal);
  }
}

/**
 * 加载一个已经出现在查询会话中的错误分类节点明细。
 *
 * @param {Record<string, unknown>} session - 后台保存的安全查询会话。
 * @param {string[]} runIds - 该分类下由后台保存的 Run ID。
 * @param {AbortSignal} signal - 分类请求取消信号。
 * @returns {Promise<Record<string, unknown>>} query-engine 的脱敏分类明细。
 * @throws {DifyLogQueryEngine.QueryError} 页面切换或只读查询失败时抛出。
 */
async function loadErrorCategoryOnce(session, runIds, signal) {
  throwIfCancelled(signal);
  const context = await getActiveContext(session.tabId);
  if (context.appId !== session.appId) {
    throw new engine.QueryError("日志页面已经切换，请重新查询当前 App。", "APP_CONTEXT_CHANGED");
  }
  return engine.loadErrorCategory({
    getJson: createReadOnlyGetJson(context.appId, signal),
    appId: context.appId,
    runIds
  });
}

/**
 * 分类明细和主查询采用相同鉴权恢复策略：仅 401/403 刷新并重试一次。
 *
 * @param {Record<string, unknown>} session - 后台安全查询会话。
 * @param {string[]} runIds - 后台允许的 Run ID。
 * @param {AbortSignal} signal - 分类请求取消信号。
 * @returns {Promise<Record<string, unknown>>} 脱敏分类明细。
 * @throws {DifyLogQueryEngine.QueryError} 第二次失败或其他错误时抛出。
 */
async function runErrorCategory(session, runIds, signal) {
  try {
    return await loadErrorCategoryOnce(session, runIds, signal);
  } catch (error) {
    if (error?.code !== "AUTH_EXPIRED") {
      throw error;
    }
    await refreshAuthContext(session.tabId, signal);
    return loadErrorCategoryOnce(session, runIds, signal);
  }
}

/**
 * 把任意异常转换为侧边栏可以展示的安全错误。
 *
 * 绝不回传堆栈、请求头、URL 查询值或 Dify 原始响应正文。
 *
 * @param {unknown} error - 捕获到的任意异常。
 * @returns {{code: string, message: string}} 白名单化错误。
 * @throws {Error} 本函数不主动抛异常。
 */
function toSafeError(error) {
  if (error instanceof engine.QueryError) {
    return {
      code: String(error.code || "QUERY_ERROR"),
      message: String(error.message || "查询失败。")
    };
  }
  return {
    code: "EXTENSION_ERROR",
    message: "扩展执行失败，请重新打开侧边栏后重试。"
  };
}

/**
 * 处理来自 Side Panel 的有限消息集合。
 *
 * @param {Record<string, unknown>} message - Side Panel 消息。
 * @returns {Promise<Record<string, unknown>>} 结构化成功响应。
 * @throws {DifyLogQueryEngine.QueryError} 消息类型不受支持时抛安全错误。
 */
async function handleMessage(message) {
  switch (message?.type) {
    case "GET_ACTIVE_CONTEXT":
      return { ok: true, context: await getActiveContext() };
    case "REFRESH_AUTH_CONTEXT":
      await refreshAuthContext(message.tabId);
      return { ok: true, context: await getActiveContext(message.tabId) };
    case "CANCEL_QUERY": {
      const queryId = String(message.queryId || "");
      const controller = activeQueries.get(queryId);
      if (controller) {
        controller.abort();
      }
      const detailControllers = activeDetailQueries.get(queryId);
      if (detailControllers) {
        detailControllers.forEach((detailController) => detailController.abort());
      }
      return {
        ok: true,
        cancelled: Boolean(controller || detailControllers?.size)
      };
    }
    case "LOAD_ERROR_CATEGORY": {
      const queryId = String(message.queryId || "").trim();
      const category = String(message.category || "").trim();
      const session = getQuerySession(queryId);
      if (!queryId || !category || !session) {
        throw new engine.QueryError(
          "这次查询结果已经失效，请重新查询后再展开分类。",
          "QUERY_SESSION_EXPIRED"
        );
      }
      const allowedRunIds = session.categories.get(category);
      if (!allowedRunIds?.size) {
        throw new engine.QueryError(
          "该错误分类不属于当前查询结果。",
          "ERROR_CATEGORY_NOT_ALLOWED"
        );
      }

      const controller = new AbortController();
      registerDetailController(queryId, controller);
      try {
        const result = await runErrorCategory(
          session,
          [...allowedRunIds],
          controller.signal
        );
        return { ok: true, ...result };
      } finally {
        unregisterDetailController(queryId, controller);
      }
    }
    case "RUN_QUERY": {
      const queryId = String(message.queryId || "");
      if (!queryId) {
        throw new engine.QueryError("查询缺少内部任务 ID。", "INVALID_QUERY_ID");
      }
      const controller = new AbortController();
      querySessions.delete(queryId);
      activeQueries.set(queryId, controller);
      try {
        return { ok: true, report: await runQuery(message, controller.signal) };
      } finally {
        if (activeQueries.get(queryId) === controller) {
          activeQueries.delete(queryId);
        }
      }
    }
    default:
      throw new engine.QueryError("扩展收到了不支持的操作。", "UNSUPPORTED_MESSAGE");
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void handleMessage(message)
    .then((response) => sendResponse(response))
    .catch((error) => sendResponse({ ok: false, error: toSafeError(error) }));

  // 返回 true，告诉 Chrome 在异步任务完成前保持 sendResponse 通道开启。
  return true;
});
