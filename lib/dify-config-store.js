const {
  APP_TYPES,
  decryptApiKey,
  encryptApiKey,
  getDefaultAppTypeForFeature,
  normalizeDifySkillKey,
  normalizeFeatureId
} = require("./dify-core");

const REDIS_KEY_PREFIX = "yd-prototype:dify-config:";

/**
 * 根据功能 ID 生成兼容旧部署的环境变量名称。
 *
 * @param {string} featureId - 已经过 normalizeFeatureId 校验的页面 ID。
 * @returns {string} 例如 DIFY_MARKET_RESEARCH_API_KEY。
 * @throws {Error} 本函数不主动抛异常。
 */
function getFeatureEnvironmentName(featureId) {
  return `DIFY_${featureId.replace(/-/g, "_").toUpperCase()}_API_KEY`;
}

/**
 * 创建 Dify 页面配置存储。
 *
 * 存储规则：
 * - 优先从 Upstash Redis 读取用户在页面保存的新配置。
 * - Redis 没有记录时，普通功能页可兼容现有 Vercel 环境变量。
 * - 客户背调已使用总控路由，必须读取同时包含 API Key 和固定 Skill ID 的持久化配置。
 * - Redis 只保存 AES-GCM 密文；任何返回给浏览器的 metadata 都不包含原始 Key。
 *
 * @param {{ env?: NodeJS.ProcessEnv | Record<string, string>, fetchImpl?: typeof fetch }} options - 可注入环境变量和 fetch，便于测试。
 * @returns {{ read: Function, readMetadata: Function, save: Function }} 配置存储接口。
 * @throws {Error} 创建本身不抛异常；缺配置会在具体读写时返回明确错误。
 */
function createDifyConfigStore({ env = process.env, fetchImpl = global.fetch } = {}) {
  // Vercel Marketplace 当前默认注入 KV_REST_API_*；直接从 Upstash 控制台接入时
  // 常见的是 UPSTASH_REDIS_REST_*。两套名称指向同一种 REST API，必须同时兼容，
  // 否则控制台看似已经连接资源，运行时却会一直判断为“存储未就绪”。
  const redisUrl = String(env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL || "").replace(/\/$/, "");
  const redisToken = String(env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN || "");
  const encryptionKey = String(env.DIFY_CONFIG_ENCRYPTION_KEY || "");

  /**
   * 判断当前部署是否具备可写的持久化配置。
   *
   * @returns {boolean} Redis URL、Token 和主加密密钥均存在时返回 true。
   */
  function hasPersistentStorage() {
    return Boolean(redisUrl && redisToken && encryptionKey);
  }

  /**
   * 调用 Upstash Redis REST API。
   *
   * @param {string[]} command - Redis 命令，例如 ["GET", key] 或 ["SET", key, value]。
   * @returns {Promise<unknown>} Upstash 返回的 result 字段。
   * @throws {Error} 网络失败或 Upstash 返回非 2xx 时抛出，不泄露 Token。
   */
  async function runRedis(command) {
    const response = await fetchImpl(redisUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(command)
    });
    const rawText = await response.text();
    let payload = null;

    try {
      payload = rawText ? JSON.parse(rawText) : null;
    } catch (_error) {
      payload = null;
    }

    if (!response.ok || payload?.error) {
      throw new Error(`Upstash Redis 配置读写失败（HTTP ${response.status}）。`);
    }

    return payload?.result ?? null;
  }

  /**
   * 获取旧环境变量里的兼容配置。
   *
   * @param {string} featureId - 页面功能 ID。
   * @returns {{ featureId: string, appType: string, apiKey: string, skillKey: string, appName: string, appMode: string, parameters: object, source: string } | null} 兼容配置。
   */
  function readEnvironmentFallback(featureId) {
    // 旧客户背调环境变量只保存独立 App Key，没有总控必需的 skill_key。
    // 继续兜底会把请求错误地送入无 Skill ID 的旧协议，因此迁移完成后必须明确停用。
    if (featureId === "customer-research") {
      return null;
    }

    const environmentName = getFeatureEnvironmentName(featureId);
    const apiKey = String(env[environmentName] || "").trim();
    const appType = getDefaultAppTypeForFeature(featureId);

    if (!apiKey.startsWith("app-")) {
      return null;
    }

    return {
      featureId,
      appType,
      apiKey,
      skillKey: "",
      appName: "Dify 对话应用",
      appMode: appType === APP_TYPES.CHATFLOW ? "advanced-chat" : "chat",
      parameters: {},
      source: "environment"
    };
  }

  /**
   * 读取某个页面的完整服务端配置。
   *
   * @param {unknown} featureIdValue - 页面功能 ID。
   * @returns {Promise<object | null>} 包含解密后 apiKey 的服务端对象；未配置时返回 null。
   * @throws {Error} Redis 内容损坏或解密失败时抛出。
   */
  async function read(featureIdValue) {
    const featureId = normalizeFeatureId(featureIdValue);

    if (hasPersistentStorage()) {
      const storedText = await runRedis(["GET", `${REDIS_KEY_PREFIX}${featureId}`]);

      if (storedText) {
        const record = JSON.parse(String(storedText));
        return {
          featureId,
          appType: record.appType,
          apiKey: decryptApiKey(record.encryptedApiKey, encryptionKey),
          skillKey: normalizeDifySkillKey(record.skillKey || ""),
          appName: record.appName || "Dify 应用",
          appMode: record.appMode || "",
          parameters: record.parameters || {},
          updatedAt: record.updatedAt || "",
          source: "redis"
        };
      }
    }

    return readEnvironmentFallback(featureId);
  }

  /**
   * 读取可安全返回给浏览器的配置摘要。
   *
   * @param {unknown} featureIdValue - 页面功能 ID。
   * @returns {Promise<object>} 不包含原始 API Key 的摘要。
   * @throws {Error} 底层存储读取失败时抛出。
   */
  async function readMetadata(featureIdValue) {
    const featureId = normalizeFeatureId(featureIdValue);
    const config = await read(featureId);

    if (!config) {
      return {
        featureId,
        appType: getDefaultAppTypeForFeature(featureId),
        hasKey: false,
        maskedKey: "",
        skillKey: "",
        appName: "",
        appMode: "",
        source: "none",
        storageReady: hasPersistentStorage()
      };
    }

    return {
      featureId,
      appType: config.appType,
      hasKey: true,
      maskedKey: "app-••••••••••••••••••••••••••••••",
      skillKey: config.skillKey || "",
      appName: config.appName,
      appMode: config.appMode,
      updatedAt: config.updatedAt || "",
      source: config.source,
      storageReady: hasPersistentStorage()
    };
  }

  /**
   * 加密并覆盖保存某个页面的 Dify 配置。
   *
   * @param {{ featureId: unknown, appType: unknown, apiKey: unknown, skillKey?: unknown, appInfo?: object, parameters?: object }} config - 已由 Dify `/info` 校验过的配置。
   * @returns {Promise<object>} 保存后的安全 metadata。
   * @throws {Error} Redis 未配置、类型无效或保存失败时抛出。
   */
  async function save({ featureId: featureIdValue, appType, apiKey, skillKey = "", appInfo = {}, parameters = {} }) {
    if (!hasPersistentStorage()) {
      throw new Error("当前 Vercel 项目还没有配置 Upstash Redis 和 Dify 加密密钥，暂时不能持久保存。");
    }

    const featureId = normalizeFeatureId(featureIdValue);
    const cleanType = String(appType || "");
    if (cleanType !== APP_TYPES.DIALOGUE && cleanType !== APP_TYPES.CHATFLOW) {
      throw new Error("请选择有效的 Dify 应用类型。");
    }

    const record = {
      version: 2,
      featureId,
      appType: cleanType,
      encryptedApiKey: encryptApiKey(apiKey, encryptionKey),
      skillKey: normalizeDifySkillKey(skillKey),
      appName: String(appInfo.name || "Dify 应用"),
      appMode: String(appInfo.mode || ""),
      parameters: parameters && typeof parameters === "object" ? parameters : {},
      updatedAt: new Date().toISOString()
    };

    await runRedis(["SET", `${REDIS_KEY_PREFIX}${featureId}`, JSON.stringify(record)]);
    return readMetadata(featureId);
  }

  return { read, readMetadata, save };
}

module.exports = {
  createDifyConfigStore,
  getFeatureEnvironmentName
};
