const { timingSafeEqual } = require("node:crypto");
const { createDifyConfigStore } = require("../lib/dify-config-store");
const { normalizeFeatureId } = require("../lib/dify-core");
const { sendJson } = require("../lib/dify-http");

/**
 * 使用固定时间比较校验 Cloudflare Worker 的内部令牌。
 *
 * 为什么不用普通字符串相等：固定时间比较可以降低攻击者根据响应耗时逐字符猜令牌的风险。
 * 长度不同会直接失败，因为 timingSafeEqual 要求两个 Buffer 长度一致。
 *
 * @param {unknown} authorizationHeader - HTTP Authorization 请求头。
 * @param {unknown} expectedToken - Vercel 环境变量中的内部共享令牌。
 * @returns {boolean} Bearer 令牌完整匹配时返回 true。
 * @throws {Error} 本函数会吸收 Buffer 比较异常并返回 false，不向外抛出。
 */
function isAuthorizedBridgeRequest(authorizationHeader, expectedToken) {
  const expected = String(expectedToken || "").trim();
  const provided = String(authorizationHeader || "").replace(/^Bearer\s+/i, "").trim();

  if (!expected || !provided) return false;

  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");
  if (expectedBuffer.length !== providedBuffer.length) return false;

  try {
    return timingSafeEqual(expectedBuffer, providedBuffer);
  } catch (_error) {
    return false;
  }
}

/**
 * 创建仅供 Cloudflare Worker 调用的 Dify 运行时配置接口。
 *
 * 该接口解决 Vercel 敏感环境变量不可导出的问题：
 * - Vercel 继续读取并解密原有 Redis 配置，也继续兼容客户背调旧环境变量。
 * - Cloudflare 仅凭随机内部令牌，在每次对话开始时取一次运行时配置。
 * - 浏览器拿不到内部令牌，因此无法读取原始 Dify API Key。
 *
 * @param {{ env?: NodeJS.ProcessEnv | Record<string, string>, fetchImpl?: typeof fetch, createConfigStore?: Function }} options - 可注入环境、网络和存储工厂，便于测试。
 * @returns {Function} Vercel Node Handler。
 * @throws {Error} 创建本身不抛异常；请求异常会转换成安全 JSON 响应。
 */
function createRuntimeConfigHandler({
  env = process.env,
  fetchImpl = global.fetch,
  createConfigStore = createDifyConfigStore
} = {}) {
  const store = createConfigStore({ env, fetchImpl });

  return async function difyRuntimeConfigHandler(req, res) {
    // 运行时配置包含原始 API Key，任何响应都禁止浏览器或 CDN 缓存。
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "POST") {
      sendJson(res, 405, { message: "只支持 POST 请求。" });
      return;
    }

    const bridgeToken = String(env.DIFY_WORKER_BRIDGE_TOKEN || "").trim();
    if (!bridgeToken) {
      sendJson(res, 503, { message: "Dify 内部配置桥接尚未启用。" });
      return;
    }

    const authorization = req.headers?.authorization || req.headers?.Authorization || "";
    if (!isAuthorizedBridgeRequest(authorization, bridgeToken)) {
      sendJson(res, 401, { message: "无权读取 Dify 运行时配置。" });
      return;
    }

    try {
      const featureId = normalizeFeatureId(req.body?.feature_id);
      const config = await store.read(featureId);

      if (!config) {
        sendJson(res, 404, { message: "当前对话页面还没有配置 Dify API Key。" });
        return;
      }

      console.info("[dify-runtime-config] read", {
        featureId,
        appType: config.appType,
        source: config.source || "unknown"
      });
      sendJson(res, 200, {
        featureId,
        appType: config.appType,
        apiKey: config.apiKey,
        skillKey: config.skillKey || "",
        appName: config.appName || "Dify 应用",
        appMode: config.appMode || "",
        parameters: config.parameters || {}
      });
    } catch (error) {
      // 只返回稳定错误文本，避免 Redis 内容、密钥或内部实现出现在响应里。
      console.error("[dify-runtime-config] failed", {
        message: error instanceof Error ? error.message : "unknown"
      });
      sendJson(res, 502, { message: "Dify 运行时配置读取失败。" });
    }
  };
}

const handler = createRuntimeConfigHandler();

module.exports = handler;
module.exports.createRuntimeConfigHandler = createRuntimeConfigHandler;
module.exports.isAuthorizedBridgeRequest = isAuthorizedBridgeRequest;
