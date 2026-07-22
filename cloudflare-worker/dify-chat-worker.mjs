import configStorePackage from "../lib/dify-config-store.js";
import difyApiClientPackage from "../lib/dify-api-client.js";
import difyCorePackage from "../lib/dify-core.js";

const { createDifyConfigStore } = configStorePackage;
const { sanitizeDifyError, streamDifyChat } = difyApiClientPackage;
const { buildConfiguredChatInputs } = difyCorePackage;

const DEFAULT_ALLOWED_ORIGINS = Object.freeze([
  "https://wmww-g.github.io",
  "http://localhost:8765",
  "http://127.0.0.1:8765",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
]);

/**
 * 读取 Cloudflare Worker 允许访问聊天代理的前端来源。
 *
 * @param {Record<string, unknown>} env - Worker 环境变量和 Secret 绑定。
 * @returns {string[]} 明确允许的 Origin 列表。
 * @throws {Error} 本函数不主动抛异常。
 */
function getAllowedOrigins(env) {
  const configured = String(env?.DIFY_PROXY_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configured.length > 0 ? configured : [...DEFAULT_ALLOWED_ORIGINS];
}

/**
 * 判断当前请求来源是否可以读取 Dify 配置并发起真实调用。
 *
 * @param {Request} request - 浏览器或本地验收发来的标准 Request。
 * @param {Record<string, unknown>} env - Worker 环境变量和 Secret 绑定。
 * @returns {string} 允许回写到 CORS 头的 Origin；不允许时返回空字符串。
 * @throws {Error} 本函数不主动抛异常。
 */
function resolveAllowedOrigin(request, env) {
  const allowedOrigins = getAllowedOrigins(env);
  const origin = String(request.headers.get("origin") || "");

  // 没有 Origin 的服务端 smoke test 仍允许执行，但响应只声明默认可信站点。
  return origin ? (allowedOrigins.includes(origin) ? origin : "") : allowedOrigins[0];
}

/**
 * 创建 Worker 所有响应共用的 CORS 头。
 *
 * @param {string} allowedOrigin - 已校验通过的前端 Origin。
 * @returns {Headers} 可以直接合并到 Response 的标准 Headers。
 * @throws {Error} Headers 构造失败时由运行时抛出。
 */
function createCorsHeaders(allowedOrigin) {
  const headers = new Headers({
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  });

  if (allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
  }
  return headers;
}

/**
 * 返回带统一 CORS 的 JSON 响应。
 *
 * @param {object} payload - 返回给浏览器的安全 JSON 数据。
 * @param {number} status - HTTP 状态码。
 * @param {string} allowedOrigin - 已校验通过的 Origin。
 * @returns {Response} Worker 标准 JSON Response。
 * @throws {TypeError} payload 无法序列化时由 JSON.stringify 抛出。
 */
function createJsonResponse(payload, status, allowedOrigin) {
  const headers = createCorsHeaders(allowedOrigin);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(payload), { status, headers });
}

/**
 * 根据安全错误文本选择和原 Vercel 代理一致的 HTTP 状态码。
 *
 * @param {unknown} error - 配置读取、参数校验或上游请求错误。
 * @returns {number} 适合浏览器判断的状态码。
 * @throws {Error} 本函数不主动抛异常。
 */
function getStatusForError(error) {
  const message = error instanceof Error ? error.message : String(error || "");

  if (/还没有配置|暂时不能持久保存/.test(message)) return 409;
  if (/API Key 无效|无权访问/.test(message)) return 401;
  if (/请输入|请选择|功能标识|必须以 app-|实际是|暂不支持|JSON/.test(message)) return 400;
  if (/次数过多|额度不足/.test(message)) return 429;
  return 502;
}

/**
 * 把一条公开事件编码为浏览器现有解析器可以消费的 SSE data 块。
 *
 * @param {object} payload - process、answer_delta、answer_replace、done 或 error。
 * @returns {Uint8Array} UTF-8 编码后的 SSE 数据。
 * @throws {TypeError} payload 无法序列化时由 JSON.stringify 抛出。
 */
function encodeSseEvent(payload) {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

/**
 * 从受保护的 Vercel 内部接口读取当前页面的运行时配置。
 *
 * Vercel 的敏感环境变量无法被 CLI 导出，因此不能把已有加密主密钥直接复制到
 * Cloudflare。这个短请求只负责读取配置，不承载 Dify 长流，因而不受 300 秒问题影响。
 *
 * @param {{ featureId: unknown, env: Record<string, unknown>, fetchImpl: typeof fetch }} options - 页面 ID、Worker 绑定和网络实现。
 * @returns {Promise<object | null>} 完整服务端配置；页面未配置时返回 null。
 * @throws {Error} 桥接配置缺失、鉴权失败、响应损坏或网络失败时抛出安全错误。
 */
async function readRuntimeConfigFromBridge({ featureId, env, fetchImpl }) {
  const bridgeUrl = String(env?.DIFY_RUNTIME_CONFIG_URL || "").trim();
  const bridgeToken = String(env?.DIFY_WORKER_BRIDGE_TOKEN || "").trim();

  if (!bridgeUrl || !bridgeToken) {
    throw new Error("Cloudflare Dify 配置桥接尚未完成。请联系管理员检查部署配置。");
  }

  const response = await fetchImpl(bridgeUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bridgeToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ feature_id: featureId })
  });
  const rawText = await response.text();
  let payload = null;

  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch (_error) {
    throw new Error("Dify 配置服务返回了无法解析的数据。");
  }

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(payload?.message || `Dify 配置服务暂时不可用（HTTP ${response.status}）。`);
  }
  if (!String(payload?.apiKey || "").startsWith("app-")) {
    throw new Error("Dify 配置服务没有返回有效的应用凭据。");
  }

  return payload;
}

/**
 * 创建 Cloudflare Dify 长流式代理。
 *
 * 为什么使用依赖注入：
 * - 生产环境默认复用现有 Redis 配置存储与 Dify SSE 解析器。
 * - 测试环境可以替换网络依赖，验证真实 Worker Request/Response 和流式行为。
 *
 * @param {{ createConfigStore?: Function, streamChat?: Function, sanitizeError?: Function, fetchImpl?: typeof fetch, logger?: Pick<Console, "info" | "error">, heartbeatMs?: number }} dependencies - 可替换的存储、流解析、脱敏、网络、日志和心跳依赖。
 * @returns {{ fetch: (request: Request, env: Record<string, unknown>, ctx: { waitUntil?: Function }) => Promise<Response> }} Worker 模块处理器。
 * @throws {Error} 工厂本身不主动抛异常；请求错误会转换成 JSON 或 SSE error。
 */
function createDifyChatWorker({
  createConfigStore = createDifyConfigStore,
  streamChat = streamDifyChat,
  sanitizeError = sanitizeDifyError,
  fetchImpl = globalThis.fetch,
  logger = console,
  heartbeatMs = 15000
} = {}) {
  return {
    /**
     * 处理 Cloudflare Worker HTTP 请求。
     *
     * @param {Request} request - OPTIONS 或 POST `/api/dify-chat` 请求。
     * @param {Record<string, unknown>} env - 私有配置桥接、CORS 等 Worker 绑定。
     * @param {{ waitUntil?: Function }} _ctx - Worker 生命周期上下文；长流不能放进 30 秒后台任务，因此当前不调用 waitUntil。
     * @returns {Promise<Response>} JSON 错误或持续输出的 SSE Response。
     * @throws {Error} 已开始 SSE 后的异常会被协议内 error 事件吸收，不继续抛给 Worker 平台。
     */
    async fetch(request, env = {}, _ctx = {}) {
      const url = new URL(request.url);
      const allowedOrigin = resolveAllowedOrigin(request, env);

      if (url.pathname !== "/" && url.pathname !== "/api/dify-chat") {
        return createJsonResponse({ message: "接口不存在。" }, 404, allowedOrigin);
      }

      if (request.method === "OPTIONS") {
        return allowedOrigin
          ? new Response(null, { status: 204, headers: createCorsHeaders(allowedOrigin) })
          : createJsonResponse({ message: "当前页面来源不允许调用 Dify。" }, 403, "");
      }

      if (!allowedOrigin) {
        return createJsonResponse({ message: "当前页面来源不允许调用 Dify。" }, 403, "");
      }

      if (request.method !== "POST") {
        return createJsonResponse({ message: "只支持 POST 和 OPTIONS 请求。" }, 405, allowedOrigin);
      }

      let body;
      try {
        body = await request.json();
      } catch (_error) {
        return createJsonResponse({ message: "请求 JSON 无法解析。" }, 400, allowedOrigin);
      }

      try {
        // 生产部署使用受保护的 Vercel 桥接，保留本地存储分支是为了离线测试和回滚。
        const config = env?.DIFY_RUNTIME_CONFIG_URL || env?.DIFY_WORKER_BRIDGE_TOKEN
          ? await readRuntimeConfigFromBridge({ featureId: body?.feature_id, env, fetchImpl })
          : await createConfigStore({ env, fetchImpl }).read(body?.feature_id);

        if (!config) {
          return createJsonResponse(
            { message: "当前对话页面还没有配置 Dify API Key，请先在顶部保存配置。" },
            409,
            allowedOrigin
          );
        }

        logger.info("[cloudflare-dify-chat] started", {
          featureId: config.featureId || String(body?.feature_id || ""),
          appType: config.appType,
          hasSkillKey: Boolean(config.skillKey),
          hasConversation: Boolean(body?.conversation_id)
        });

        const transform = new TransformStream();
        const writer = transform.writable.getWriter();
        const headers = createCorsHeaders(allowedOrigin);
        headers.set("Content-Type", "text/event-stream; charset=utf-8");
        headers.set("Cache-Control", "no-cache, no-transform");
        headers.set("X-Accel-Buffering", "no");

        const streamTask = (async () => {
          const heartbeatId = setInterval(() => {
            // SSE 注释不会进入前端事件解析，但会让代理链知道连接仍然健康。
            void writer.write(new TextEncoder().encode(": keep-alive\n\n")).catch(() => {});
          }, Math.max(1, Number(heartbeatMs) || 15000));

          try {
            await streamChat({
              apiKey: config.apiKey,
              query: body?.query,
              conversationId: body?.conversation_id,
              user: body?.user,
              inputs: buildConfiguredChatInputs({ inputs: body?.inputs, skillKey: config.skillKey }),
              files: body?.files,
              fetchImpl,
              async onEvent(event) {
                const publicEvent = event?.type === "done"
                  ? { ...event, result: { ...event.result, app_type: config.appType } }
                  : event;
                await writer.write(encodeSseEvent(publicEvent));
              }
            });

            logger.info("[cloudflare-dify-chat] completed", {
              featureId: config.featureId || String(body?.feature_id || ""),
              appType: config.appType
            });
          } catch (error) {
            const message = sanitizeError(error instanceof Error ? error.message : "Dify 调用失败，请稍后重试。");
            logger.error("[cloudflare-dify-chat] failed", { message });
            try {
              await writer.write(encodeSseEvent({ type: "error", message }));
            } catch (_writeError) {
              // 浏览器主动关闭页面时 writer 可能已断开；此时不能把 Key 或上游错误继续写到日志。
            }
          } finally {
            clearInterval(heartbeatId);
            try {
              await writer.close();
            } catch (_closeError) {
              // 客户端中途断开属于正常网络状态，不把它升级成新的业务错误。
            }
          }
        })();

        // 不调用 ctx.waitUntil：这项任务直接决定响应内容，TransformStream 本身会让
        // Worker 在客户端保持连接期间继续运行；waitUntil 只适合响应后的后台工作。
        return new Response(transform.readable, { status: 200, headers });
      } catch (error) {
        const message = sanitizeError(error instanceof Error ? error.message : "Dify 调用失败，请稍后重试。");
        logger.error("[cloudflare-dify-chat] setup failed", { message });
        return createJsonResponse({ message }, getStatusForError(error), allowedOrigin);
      }
    }
  };
}

const worker = createDifyChatWorker();

export { createDifyChatWorker };
export default worker;
