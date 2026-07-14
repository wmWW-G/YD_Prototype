const { sanitizeDifyError, streamDifyChat } = require("../lib/dify-api-client");
const { createDifyConfigStore } = require("../lib/dify-config-store");
const { normalizeFeatureId } = require("../lib/dify-core");
const { applyCors, getStatusForError, sendJson, sendSseEvent, startSse } = require("../lib/dify-http");

/**
 * 创建所有对话功能页面共用的 Dify 代理。
 *
 * 数据流：
 * 1. 根据 feature_id 从 Redis 或兼容环境变量读取配置。
 * 2. API Key 只在当前服务端函数内解密使用，不返回浏览器、不写日志。
 * 3. 调用 Dify streaming `/chat-messages`，把不同应用模式实时转发成安全 SSE。
 *
 * @param {{ env?: NodeJS.ProcessEnv | Record<string, string>, fetchImpl?: typeof fetch }} options - 可注入依赖，便于单元测试。
 * @returns {Function} Vercel Node Handler。
 * @throws {Error} 创建本身不抛异常；请求错误会转换成 JSON 响应。
 */
function createChatHandler({ env = process.env, fetchImpl = global.fetch } = {}) {
  const store = createDifyConfigStore({ env, fetchImpl });

  return async function difyChatHandler(req, res) {
    const originAllowed = applyCors(req, res, env);
    let sseStarted = false;

    if (req.method === "OPTIONS") {
      res.statusCode = originAllowed ? 204 : 403;
      res.end();
      return;
    }

    if (!originAllowed) {
      sendJson(res, 403, { message: "当前页面来源不允许调用 Dify。" });
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { message: "只支持 POST 和 OPTIONS 请求。" });
      return;
    }

    try {
      const featureId = normalizeFeatureId(req.body?.feature_id);
      const config = await store.read(featureId);

      if (!config) {
        sendJson(res, 409, { message: "当前对话页面还没有配置 Dify API Key，请先在顶部保存配置。" });
        return;
      }

      console.info("[dify-chat] started", {
        featureId,
        appType: config.appType,
        hasConversation: Boolean(req.body?.conversation_id)
      });

      startSse(res);
      sseStarted = true;
      const result = await streamDifyChat({
        apiKey: config.apiKey,
        query: req.body?.query,
        conversationId: req.body?.conversation_id,
        user: req.body?.user,
        inputs: req.body?.inputs,
        files: req.body?.files,
        fetchImpl,
        onEvent(event) {
          // app_type 属于赢单自己的页面配置，不是 Dify 上游事件；只在 done 时补入，方便前端记录实际适配类型。
          const publicEvent = event.type === "done"
            ? { ...event, result: { ...event.result, app_type: config.appType } }
            : event;
          sendSseEvent(res, publicEvent);
        }
      });

      console.info("[dify-chat] completed", {
        featureId,
        appType: config.appType,
        workflowRunId: result.workflow_run_id || "",
        hasAnswer: Boolean(result.answer)
      });
      res.end();
    } catch (error) {
      const message = sanitizeDifyError(error instanceof Error ? error.message : "Dify 调用失败，请稍后重试。");
      console.error("[dify-chat] failed", { message });
      if (sseStarted) {
        // 响应头已经发送后不能再切回 JSON/错误状态码，因此用协议内 error 事件结束本次流。
        try {
          sendSseEvent(res, { type: "error", message });
        } finally {
          res.end();
        }
        return;
      }
      sendJson(res, getStatusForError(error), { message });
    }
  };
}

const handler = createChatHandler();

module.exports = handler;
module.exports.createChatHandler = createChatHandler;
