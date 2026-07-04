/**
 * Dify 客户背调代理接口。
 *
 * 为什么需要代理：
 * - GitHub Pages 上的静态页面直接请求 Dify 时，用户浏览器插件、公司网络或安全策略可能拦截 api.dify.ai。
 * - Dify API Key 不能写进前端代码，否则任何人打开网页都能看到密钥。
 * - 代理把密钥放在 Vercel 环境变量里，浏览器只请求本接口。
 *
 * 需要的环境变量：
 * - DIFY_CUSTOMER_RESEARCH_API_KEY：客户背调 Chatflow 的 app- 开头 API Key。
 * - DIFY_PROXY_ALLOWED_ORIGINS：可选，逗号分隔的允许来源；不填时默认允许赢单 GitHub Pages 和本地调试地址。
 */

const DIFY_CHAT_MESSAGES_URL = "https://api.dify.ai/v1/chat-messages";
const DEFAULT_ALLOWED_ORIGINS = [
  "https://wmww-g.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
];

/**
 * 读取允许跨域访问代理的来源。
 *
 * @returns {string[]} 允许的 Origin 列表。
 * @throws {Error} 本函数不主动抛异常。
 */
function getAllowedOrigins() {
  const configured = process.env.DIFY_PROXY_ALLOWED_ORIGINS || "";
  const origins = configured
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : DEFAULT_ALLOWED_ORIGINS;
}

/**
 * 判断当前请求来源是否可以访问代理。
 *
 * @param {string | undefined} origin - 浏览器请求头里的 Origin。
 * @returns {string} 允许写回 CORS 头的 Origin；空字符串表示不允许。
 * @throws {Error} 本函数不主动抛异常。
 */
function resolveAllowedOrigin(origin) {
  if (!origin) {
    return DEFAULT_ALLOWED_ORIGINS[0];
  }

  return getAllowedOrigins().includes(origin) ? origin : "";
}

/**
 * 设置 CORS 响应头。
 *
 * @param {import("http").ServerResponse} res - Vercel 传入的响应对象。
 * @param {string} origin - 已确认允许的 Origin。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function setCorsHeaders(res, origin) {
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

/**
 * 从前端请求里整理 Dify 所需的 payload。
 *
 * @param {{ query?: unknown, conversation_id?: unknown, user?: unknown }} body - 前端传来的请求体。
 * @returns {{ inputs: object, query: string, response_mode: string, conversation_id: string, user: string, files: unknown[] }} Dify chat-messages 请求体。
 * @throws {Error} 当 query 为空时抛出错误，避免无意义消耗 Dify 调用额度。
 */
function buildDifyPayload(body) {
  const query = String(body?.query || "").trim();

  if (!query) {
    throw new Error("请输入客户信息后再开始背调。");
  }

  return {
    inputs: {},
    query,
    response_mode: "blocking",
    conversation_id: String(body?.conversation_id || ""),
    user: String(body?.user || `yd-prototype-${Date.now()}`),
    files: []
  };
}

/**
 * Vercel Serverless Function 入口。
 *
 * @param {import("http").IncomingMessage & { body?: unknown, method?: string, headers: Record<string, string | string[] | undefined> }} req - Vercel 请求对象。
 * @param {import("http").ServerResponse} res - Vercel 响应对象。
 * @returns {Promise<void>} 请求处理完成后结束响应。
 * @throws {Error} 本函数内部捕获并转成 JSON 错误，不向外抛出。
 */
module.exports = async function handler(req, res) {
  const requestOrigin = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin;
  const allowedOrigin = resolveAllowedOrigin(requestOrigin);
  setCorsHeaders(res, allowedOrigin);

  if (!allowedOrigin) {
    res.statusCode = 403;
    res.end(JSON.stringify({ message: "当前页面来源不允许访问背调代理。" }));
    return;
  }

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ message: "只支持 POST 请求。" }));
    return;
  }

  const apiKey = process.env.DIFY_CUSTOMER_RESEARCH_API_KEY || process.env.DIFY_API_KEY || "";

  if (!apiKey.startsWith("app-")) {
    res.statusCode = 500;
    res.end(JSON.stringify({ message: "背调代理没有配置 Dify API Key。" }));
    return;
  }

  try {
    const difyPayload = buildDifyPayload(req.body || {});
    const difyResponse = await fetch(DIFY_CHAT_MESSAGES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(difyPayload)
    });
    const rawText = await difyResponse.text();

    res.statusCode = difyResponse.status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(rawText || JSON.stringify({ message: `Dify 返回空响应，HTTP ${difyResponse.status}` }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "背调代理调用失败。";
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ message }));
  }
};
