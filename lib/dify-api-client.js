const {
  assertModeMatchesAppType,
  buildChatPayload,
  parseDifyStream
} = require("./dify-core");

const DIFY_API_BASE_URL = "https://api.dify.ai/v1";

/**
 * 删除错误文本中可能出现的 Dify API Key。
 *
 * @param {unknown} value - Dify 或网络层返回的错误内容。
 * @returns {string} 适合日志和前端展示的脱敏文本。
 * @throws {Error} 本函数不主动抛异常。
 */
function sanitizeDifyError(value) {
  return String(value || "")
    .replace(/app-[A-Za-z0-9_-]{8,}/g, "app-***")
    .slice(0, 600);
}

/**
 * 把 Dify 非成功响应转换成稳定的中文错误。
 *
 * @param {Response} response - fetch 返回的响应对象。
 * @param {string} rawText - 已读取的响应正文。
 * @returns {Error} 不包含 API Key 的错误实例。
 * @throws {Error} 本函数只构造错误，不主动抛出。
 */
function createDifyHttpError(response, rawText) {
  if (response.status === 401 || response.status === 403) {
    return new Error("Dify API Key 无效或当前应用无权访问。");
  }

  if (response.status === 429) {
    return new Error("Dify 调用次数过多或额度不足，请稍后重试。");
  }

  let payload = null;
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch (_error) {
    payload = null;
  }

  const detail = sanitizeDifyError(payload?.message || payload?.error || rawText);
  return new Error(detail || `Dify 返回 HTTP ${response.status}`);
}

/**
 * 使用 API Key 获取 Dify 应用 JSON 资料。
 *
 * @param {{ path: string, apiKey: string, fetchImpl: typeof fetch }} options - 请求参数。
 * @returns {Promise<object>} Dify JSON 对象。
 * @throws {Error} 网络失败、鉴权失败或 JSON 损坏时抛出脱敏错误。
 */
async function fetchDifyJson({ path, apiKey, fetchImpl }) {
  const response = await fetchImpl(`${DIFY_API_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json"
    }
  });
  const rawText = await response.text();

  if (!response.ok) {
    throw createDifyHttpError(response, rawText);
  }

  try {
    return rawText ? JSON.parse(rawText) : {};
  } catch (_error) {
    throw new Error("Dify 返回了无法识别的应用信息。");
  }
}

/**
 * 检查 API Key 对应的应用名称、真实模式和输入参数。
 *
 * 为什么保存前检查：
 * - Dify 通过 API Key 自动识别 App，页面不需要用户填写 App ID。
 * - `/info` 可以防止把 Chatflow Key 错存成普通对话应用。
 * - `/parameters` 让后续请求知道 inputs 和文件能力，而不是把字段写死。
 *
 * @param {{ apiKey: unknown, selectedAppType: unknown, fetchImpl?: typeof fetch }} options - 待检查配置。
 * @returns {Promise<{ info: object, parameters: object }>} 应用资料和参数。
 * @throws {Error} Key 无效、类型不匹配或接口异常时抛出。
 */
async function inspectDifyApp({ apiKey, selectedAppType, fetchImpl = global.fetch }) {
  const cleanKey = String(apiKey || "").trim();
  if (!cleanKey.startsWith("app-")) {
    throw new Error("Dify API Key 必须以 app- 开头。");
  }

  const info = await fetchDifyJson({ path: "/info", apiKey: cleanKey, fetchImpl });
  assertModeMatchesAppType(selectedAppType, info.mode);
  const parameters = await fetchDifyJson({ path: "/parameters", apiKey: cleanKey, fetchImpl });

  return { info, parameters };
}

/**
 * 调用 Dify 对话接口并统一解析 Chatbot、Agent 和 Chatflow 的响应。
 *
 * @param {{ apiKey: unknown, query: unknown, conversationId?: unknown, user: unknown, inputs?: object, files?: unknown[], fetchImpl?: typeof fetch }} options - 对话参数。
 * @returns {Promise<object>} 包含 answer、conversation_id、usage 和工作流追踪的统一结果。
 * @throws {Error} 参数、网络、Dify 业务错误或 SSE 解析失败时抛出。
 */
async function sendDifyChat({
  apiKey,
  query,
  conversationId = "",
  user,
  inputs = {},
  files = [],
  fetchImpl = global.fetch
}) {
  const cleanKey = String(apiKey || "").trim();
  if (!cleanKey.startsWith("app-")) {
    throw new Error("当前页面还没有配置有效的 Dify API Key。");
  }

  const payload = buildChatPayload({ query, conversationId, user, inputs, files });
  const response = await fetchImpl(`${DIFY_API_BASE_URL}/chat-messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cleanKey}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream"
    },
    body: JSON.stringify(payload)
  });
  const rawText = await response.text();

  if (!response.ok) {
    throw createDifyHttpError(response, rawText);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    let json;
    try {
      json = JSON.parse(rawText);
    } catch (_error) {
      throw new Error("Dify 返回了无法识别的 JSON 响应。");
    }

    return {
      ...json,
      billing_trace: json.billing_trace || {
        workflow_run_id: json.workflow_run_id || "",
        event_counts: { message: 1 },
        nodes: [],
        agent_logs: [],
        workflow_finished: null
      }
    };
  }

  return parseDifyStream(rawText);
}

module.exports = {
  inspectDifyApp,
  sanitizeDifyError,
  sendDifyChat
};
