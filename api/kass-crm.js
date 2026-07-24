const { KassCrmGatewayError, createKassCrmGateway } = require("../lib/kass-crm-gateway");
const { applyCors, sendJson } = require("../lib/dify-http");

/**
 * 创建供原型页面和 Dify HTTP Tool 共用的 KASS CRM 沙箱网关。
 *
 * 该接口只读写 Upstash 中按随机 workspace_id 隔离的虚拟客户快照，
 * 不读取赢单 Access Token，也不会访问真实赢单 CRM。
 *
 * @param {{ env?: NodeJS.ProcessEnv | Record<string, string>, fetchImpl?: typeof fetch }} options - 可注入依赖，便于测试。
 * @returns {Function} Vercel Node Handler。
 * @throws {Error} 创建本身不主动抛异常。
 */
function createKassCrmHandler({ env = process.env, fetchImpl = global.fetch } = {}) {
  const gateway = createKassCrmGateway({ env, fetchImpl });

  return async function kassCrmHandler(req, res) {
    const originAllowed = applyCors(req, res, env);

    if (req.method === "OPTIONS") {
      res.statusCode = originAllowed ? 204 : 403;
      res.end();
      return;
    }

    // Dify 服务端请求通常没有 Origin；浏览器请求必须来自现有原型白名单。
    if (!originAllowed) {
      sendJson(res, 403, {
        ok: false,
        code: "origin_not_allowed",
        message: "当前页面来源不允许访问 KASS 原型数据。"
      });
      return;
    }

    if (req.method !== "GET" && req.method !== "POST") {
      sendJson(res, 405, {
        ok: false,
        code: "method_not_allowed",
        message: "KASS CRM 原型网关只支持 GET 和 POST。"
      });
      return;
    }

    const action = String(
      req.method === "GET" ? req.query?.action : req.body?.action
    ).trim();

    try {
      console.info("[kass-crm] started", { method: req.method, action });
      const result = await gateway.execute({
        method: req.method,
        query: req.query || {},
        body: req.body || {}
      });
      console.info("[kass-crm] completed", { method: req.method, action: result.action });
      sendJson(res, 200, result);
    } catch (error) {
      const safeError = error instanceof KassCrmGatewayError
        ? error
        : new KassCrmGatewayError("KASS CRM 原型网关执行失败，请稍后重试。", 500, "internal_error");
      console.error("[kass-crm] failed", {
        method: req.method,
        action,
        code: safeError.code
      });
      sendJson(res, safeError.statusCode, {
        ok: false,
        code: safeError.code,
        message: safeError.message
      });
    }
  };
}

const handler = createKassCrmHandler();

module.exports = handler;
module.exports.createKassCrmHandler = createKassCrmHandler;
