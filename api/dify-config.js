const { inspectDifyApp, sanitizeDifyError } = require("../lib/dify-api-client");
const { createDifyConfigStore } = require("../lib/dify-config-store");
const { applyCors, getStatusForError, sendJson } = require("../lib/dify-http");

/**
 * 创建 Dify 页面配置接口。
 *
 * 支持：
 * - GET：只返回当前页面是否已配置、应用类型、应用名称和掩码状态。
 * - POST：用 `/info` 和 `/parameters` 校验 Key 后，加密覆盖保存到 Upstash。
 *
 * @param {{ env?: NodeJS.ProcessEnv | Record<string, string>, fetchImpl?: typeof fetch }} options - 可注入依赖，便于单元测试。
 * @returns {Function} Vercel Node Handler。
 * @throws {Error} 创建本身不抛异常；请求错误会转换成 JSON 响应。
 */
function createConfigHandler({ env = process.env, fetchImpl = global.fetch } = {}) {
  const store = createDifyConfigStore({ env, fetchImpl });

  return async function difyConfigHandler(req, res) {
    const originAllowed = applyCors(req, res, env);

    if (req.method === "OPTIONS") {
      res.statusCode = originAllowed ? 204 : 403;
      res.end();
      return;
    }

    if (!originAllowed) {
      sendJson(res, 403, { message: "当前页面来源不允许修改 Dify 配置。" });
      return;
    }

    try {
      if (req.method === "GET") {
        const featureId = req.query?.feature_id;
        sendJson(res, 200, await store.readMetadata(featureId));
        return;
      }

      if (req.method !== "POST") {
        sendJson(res, 405, { message: "只支持 GET、POST 和 OPTIONS 请求。" });
        return;
      }

      const featureId = req.body?.feature_id;
      const appType = req.body?.app_type;
      const submittedApiKey = String(req.body?.api_key || "").trim();
      // 已保存过 Key 时，管理员可以只修改 Skill ID，不需要再次粘贴密钥。
      // 原始 Key 仍只在服务端读取和重新加密，不会返回浏览器。
      const existingConfig = submittedApiKey ? null : await store.read(featureId);
      const apiKey = submittedApiKey || existingConfig?.apiKey || "";
      const inspected = await inspectDifyApp({
        apiKey,
        selectedAppType: appType,
        fetchImpl
      });
      const metadata = await store.save({
        featureId,
        appType,
        apiKey,
        skillKey: req.body?.skill_key,
        appInfo: inspected.info,
        parameters: inspected.parameters
      });

      console.info("[dify-config] saved", {
        featureId: metadata.featureId,
        appType: metadata.appType,
        appMode: metadata.appMode,
        hasSkillKey: Boolean(metadata.skillKey),
        source: metadata.source
      });
      sendJson(res, 200, metadata);
    } catch (error) {
      const message = sanitizeDifyError(error instanceof Error ? error.message : "Dify 配置保存失败。");
      console.error("[dify-config] failed", { message });
      sendJson(res, getStatusForError(error), { message });
    }
  };
}

const handler = createConfigHandler();

module.exports = handler;
module.exports.createConfigHandler = createConfigHandler;
