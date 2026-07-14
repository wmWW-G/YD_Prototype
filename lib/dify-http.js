const DEFAULT_ALLOWED_ORIGINS = [
  "https://wmww-g.github.io",
  "http://localhost:8765",
  "http://127.0.0.1:8765",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
];

/**
 * 获取当前部署允许访问 Dify 代理的前端来源。
 *
 * @param {NodeJS.ProcessEnv | Record<string, string>} env - 服务端环境变量。
 * @returns {string[]} 明确允许的 Origin 列表。
 * @throws {Error} 本函数不主动抛异常。
 */
function getAllowedOrigins(env = process.env) {
  const configured = String(env.DIFY_PROXY_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS;
}

/**
 * 设置 Vercel Dify 接口共用的 CORS 响应头。
 *
 * @param {object} req - Vercel 请求对象。
 * @param {object} res - Vercel 响应对象。
 * @param {NodeJS.ProcessEnv | Record<string, string>} env - 服务端环境变量。
 * @returns {boolean} 当前来源允许访问时返回 true。
 * @throws {Error} 本函数不主动抛异常。
 */
function applyCors(req, res, env = process.env) {
  const origin = String(req?.headers?.origin || "");
  const allowedOrigins = getAllowedOrigins(env);
  const allowedOrigin = !origin ? allowedOrigins[0] : (allowedOrigins.includes(origin) ? origin : "");

  if (allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");

  return Boolean(allowedOrigin);
}

/**
 * 返回统一 JSON 响应。
 *
 * @param {object} res - Vercel 响应对象。
 * @param {number} statusCode - HTTP 状态码。
 * @param {object} payload - 可序列化的响应体。
 * @returns {void}
 * @throws {Error} payload 存在循环引用时 JSON.stringify 可能抛出。
 */
function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

/**
 * 根据业务错误文本选择对前端更准确的 HTTP 状态码。
 *
 * @param {unknown} error - 捕获到的错误。
 * @returns {number} HTTP 状态码。
 * @throws {Error} 本函数不主动抛异常。
 */
function getStatusForError(error) {
  const message = error instanceof Error ? error.message : String(error || "");

  if (/还没有配置|暂时不能持久保存/.test(message)) return 409;
  if (/API Key 无效|无权访问/.test(message)) return 401;
  if (/请输入|请选择|功能标识|必须以 app-|实际是|暂不支持/.test(message)) return 400;
  if (/次数过多|额度不足/.test(message)) return 429;
  return 502;
}

module.exports = {
  applyCors,
  getStatusForError,
  sendJson
};
