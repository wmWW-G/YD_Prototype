const crypto = require("node:crypto");

/**
 * 原型配置栏允许选择的 Dify 应用类型。
 *
 * 为什么不直接使用 Dify 返回的 mode：
 * - 产品界面只需要“对话型应用”和“Chatflow”两个容易理解的选项。
 * - Dify 的 `chat`、`agent-chat` 都属于普通对话应用，但流式事件略有不同。
 */
const APP_TYPES = Object.freeze({
  DIALOGUE: "dialogue",
  CHATFLOW: "chatflow"
});

/**
 * 默认使用 Chatflow 的前端功能 ID。
 *
 * 为什么放在服务端核心层：
 * - 未保存 Key 时，配置接口仍要返回正确的默认类型。
 * - 环境变量兼容路径也必须和浏览器默认值一致，否则首次打开会被错误切回“对话型应用”。
 *
 * @type {ReadonlySet<string>}
 */
const DEFAULT_CHATFLOW_FEATURE_IDS = new Set([
  "customer-research",
  "negotiation-scene",
  "inquiry-reply",
  "yd-artifact",
  "market-research",
  "cold-email",
  "complaint",
  "reactivation",
  "relationship",
  "phone-sales",
  "video-meeting",
  "field-visit",
  "visit-reception",
  "title-combo",
  "trade-show"
]);

/**
 * 获取某个页面未配置时应该展示的 Dify 应用类型。
 *
 * @param {unknown} featureId - 页面功能 ID。
 * @returns {"dialogue" | "chatflow"} 默认应用类型。
 * @throws {Error} 本函数不主动抛异常。
 */
function getDefaultAppTypeForFeature(featureId) {
  return DEFAULT_CHATFLOW_FEATURE_IDS.has(String(featureId || "").trim())
    ? APP_TYPES.CHATFLOW
    : APP_TYPES.DIALOGUE;
}

/**
 * 把 Dify `/info` 返回的 mode 映射成产品配置栏的应用类型。
 *
 * @param {unknown} mode - Dify 应用模式，例如 chat、agent-chat、advanced-chat。
 * @returns {"dialogue" | "chatflow" | null} 可识别的应用类型；不支持时返回 null。
 * @throws {Error} 本函数不主动抛异常。
 */
function getAppTypeForMode(mode) {
  const normalized = String(mode || "").trim().toLowerCase();

  if (normalized === "chat" || normalized === "agent-chat") {
    return APP_TYPES.DIALOGUE;
  }

  if (normalized === "advanced-chat") {
    return APP_TYPES.CHATFLOW;
  }

  return null;
}

/**
 * 校验用户选择的应用类型是否和 API Key 实际绑定的 Dify App 一致。
 *
 * @param {unknown} selectedType - 页面下拉框选择的应用类型。
 * @param {unknown} actualMode - Dify `GET /info` 返回的 mode。
 * @returns {void}
 * @throws {Error} 类型不一致或 Dify mode 不受支持时抛出中文错误。
 */
function assertModeMatchesAppType(selectedType, actualMode) {
  const expectedType = String(selectedType || "").trim();
  const actualType = getAppTypeForMode(actualMode);

  if (!actualType) {
    throw new Error(`当前 Key 对应的 Dify 应用模式「${String(actualMode || "未知") }」暂不支持。`);
  }

  if (expectedType !== actualType) {
    const actualLabel = actualType === APP_TYPES.CHATFLOW ? "Chatflow" : "对话型应用";
    throw new Error(`当前 API Key 实际是 ${actualLabel}，请修改应用类型后再保存。`);
  }
}

/**
 * 清理并校验页面功能标识。
 *
 * 为什么限制字符：
 * - featureId 会参与 Redis key 和后端日志，不能允许路径穿越或控制字符。
 * - 当前路由 ID 只使用小写字母、数字和连字符，收紧规则不会影响现有页面。
 *
 * @param {unknown} value - 页面传入的 activeMain。
 * @returns {string} 清理后的功能标识。
 * @throws {Error} 标识为空或包含不安全字符时抛出。
 */
function normalizeFeatureId(value) {
  const featureId = String(value || "").trim();

  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(featureId)) {
    throw new Error("功能标识无效，请刷新页面后重试。");
  }

  return featureId;
}

/**
 * 清理后台为总控 Chatflow 配置的业务 Skill ID。
 *
 * 为什么允许空值：
 * - 现有两个总控 Chatflow 需要 skill_key；独立 Dify App 可能不声明这个输入。
 * - 空值表示“独立应用模式”，后端不会替它注入 skill_key。
 *
 * @param {unknown} value - 后台手动填写的 Skill ID。
 * @returns {string} 原样保留大小写的安全 Skill ID；空输入返回空字符串。
 * @throws {Error} 非空 ID 含空格、中文或其它不适合作为路由值的字符时抛出。
 */
function normalizeDifySkillKey(value) {
  const skillKey = String(value || "").trim();

  if (!skillKey) {
    return "";
  }

  if (!/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(skillKey)) {
    throw new Error("Skill ID 只能包含字母、数字、点、下划线和连字符。");
  }

  return skillKey;
}

/**
 * 把后台保存的 Skill ID 注入本轮 Dify inputs。
 *
 * 安全边界：
 * - 浏览器不能通过 inputs.skill_key 临时切换到其它业务 Skill。
 * - 服务端会先移除浏览器传入的 skill_key，再使用当前人设已保存的值。
 * - model_key 仍来自聊天框模型选择，因为用户可以逐轮切换生成模型。
 *
 * @param {{ inputs?: unknown, skillKey?: unknown }} options - 浏览器 inputs 与服务端配置。
 * @returns {Record<string, unknown>} 可安全传给 Dify 的 inputs。
 * @throws {Error} 已保存的 Skill ID 不合法时抛出，避免把损坏配置发给 Dify。
 */
function buildConfiguredChatInputs({ inputs = {}, skillKey = "" } = {}) {
  const configuredInputs = inputs && typeof inputs === "object" && !Array.isArray(inputs)
    ? { ...inputs }
    : {};
  const cleanSkillKey = normalizeDifySkillKey(skillKey);

  delete configuredInputs.skill_key;
  if (cleanSkillKey) {
    configuredInputs.skill_key = cleanSkillKey;
  }

  return configuredInputs;
}

/**
 * 生成 Dify `/chat-messages` 的共用请求体。
 *
 * @param {{ query: unknown, conversationId?: unknown, user: unknown, inputs?: object, files?: unknown[] }} options - 对话参数。
 * @returns {{ inputs: object, query: string, response_mode: "streaming", conversation_id: string, user: string, files: unknown[] }} Dify 请求体。
 * @throws {Error} query 或 user 为空时抛出，避免产生无意义调用。
 */
function buildChatPayload({ query, conversationId = "", user, inputs = {}, files = [] }) {
  const cleanQuery = String(query || "").trim();
  const cleanUser = String(user || "").trim();

  if (!cleanQuery) {
    throw new Error("请输入内容后再发送。");
  }

  if (!cleanUser) {
    throw new Error("缺少 Dify 用户标识，请刷新页面后重试。");
  }

  return {
    inputs: inputs && typeof inputs === "object" && !Array.isArray(inputs) ? inputs : {},
    query: cleanQuery,
    response_mode: "streaming",
    conversation_id: String(conversationId || ""),
    user: cleanUser,
    files: Array.isArray(files) ? files : []
  };
}

/**
 * 把任意值压缩成适合内部计费日志的安全摘要。
 *
 * @param {unknown} value - Dify 事件中的任意字段。
 * @param {number} depth - 当前递归深度，防止超大对象拖垮响应。
 * @returns {unknown} 截断后的纯 JSON 值。
 * @throws {Error} 本函数不主动抛异常。
 */
function compactTraceValue(value, depth = 0) {
  if (value === null || value === undefined || typeof value === "boolean" || typeof value === "number") {
    return value ?? null;
  }

  if (typeof value === "string") {
    return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }

  if (depth >= 3) {
    return "[已截断]";
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => compactTraceValue(item, depth + 1));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !/api.?key|authorization|cookie|token/i.test(key))
        .slice(0, 30)
        .map(([key, item]) => [key, compactTraceValue(item, depth + 1)])
    );
  }

  return String(value);
}

/**
 * 判断流式事件中是否出现 Tavily 工具标识。
 *
 * @param {unknown} value - 节点、Agent 日志或工具事件。
 * @returns {boolean} JSON 摘要包含 tavily 时返回 true。
 * @throws {Error} 循环引用等序列化异常会被捕获，不向外抛出。
 */
function includesTavily(value) {
  try {
    return JSON.stringify(value).toLowerCase().includes("tavily");
  } catch (_error) {
    return false;
  }
}

/**
 * 在嵌套对象中查找第一个匹配字段，用于兼容不同 Dify 版本的工具参数结构。
 *
 * @param {unknown} value - 需要遍历的对象。
 * @param {string[]} candidateKeys - 可能的字段名，比较时忽略大小写。
 * @returns {unknown} 第一个匹配值；没有时返回 undefined。
 * @throws {Error} 本函数不主动抛异常。
 */
function findNestedField(value, candidateKeys) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const wanted = new Set(candidateKeys.map((key) => key.toLowerCase()));
  const stack = [value];
  const visited = new Set();

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object" || visited.has(current)) {
      continue;
    }

    visited.add(current);
    for (const [key, item] of Object.entries(current)) {
      if (wanted.has(key.toLowerCase())) {
        return item;
      }
      if (item && typeof item === "object") {
        stack.push(item);
      }
    }
  }

  return undefined;
}

/**
 * 根据 Tavily search_depth 推断一次搜索消耗，保持旧客户背调成本面板的数据口径。
 *
 * @param {unknown} eventData - Dify 节点或工具调用事件。
 * @returns {{ search_depth: string, estimated_credits: number | null, basis: string }} 成本推断摘要。
 * @throws {Error} 本函数不主动抛异常。
 */
function inferTavilyBilling(eventData) {
  const depth = String(findNestedField(eventData, ["search_depth", "searchDepth", "depth"]) || "").toLowerCase();

  if (depth.includes("advanced")) {
    return { search_depth: "advanced", estimated_credits: 2, basis: "search_depth=advanced" };
  }
  if (depth.includes("basic")) {
    return { search_depth: "basic", estimated_credits: 1, basis: "search_depth=basic" };
  }

  return { search_depth: "unknown", estimated_credits: null, basis: "Dify 事件未暴露 search_depth" };
}

/**
 * 解析 Dify streaming 模式返回的 SSE 文本。
 *
 * 适配策略：
 * - 普通 Chatbot 使用 `message`。
 * - Agent 使用 `agent_message`，`agent_thought` 只进入脱敏追踪，不拼进答案。
 * - Chatflow 会夹带工作流/节点事件，统一记录事件计数和工作流 ID。
 * - 内容审查后的 `message_replace` 必须覆盖旧答案，而不是继续追加。
 *
 * @param {string} rawText - Dify 返回的 text/event-stream 原文。
 * @returns {{ event: string, answer: string, conversation_id: string, message_id: string, task_id: string, workflow_run_id: string, metadata: object, mode: string, billing_trace: object }} 归一化响应。
 * @throws {Error} Dify 返回 error 事件或整个流无法解析时抛出。
 */
function parseDifyStream(rawText) {
  const result = {
    event: "message",
    answer: "",
    conversation_id: "",
    message_id: "",
    task_id: "",
    workflow_run_id: "",
    metadata: {},
    mode: "",
    billing_trace: {
      workflow_run_id: "",
      event_counts: {},
      nodes: [],
      agent_logs: [],
      tool_calls: [],
      tavily: {
        call_count: 0,
        estimated_credits: null,
        tool_config: null,
        calls: []
      },
      workflow_finished: null
    }
  };
  let parsedCount = 0;

  String(rawText || "").split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) {
      return;
    }

    const jsonText = trimmed.slice(5).trim();
    if (!jsonText || jsonText === "[DONE]") {
      return;
    }

    let payload;
    try {
      payload = JSON.parse(jsonText);
    } catch (_error) {
      return;
    }

    parsedCount += 1;
    const eventName = String(payload.event || "unknown");
    result.billing_trace.event_counts[eventName] = (result.billing_trace.event_counts[eventName] || 0) + 1;

    if (eventName === "error") {
      throw new Error(payload.message || payload.error || "Dify 流式响应返回错误。");
    }

    result.conversation_id = payload.conversation_id || result.conversation_id;
    result.message_id = payload.message_id || payload.id || result.message_id;
    result.task_id = payload.task_id || result.task_id;
    result.workflow_run_id = payload.workflow_run_id || result.workflow_run_id;
    result.mode = payload.mode || result.mode;

    if (payload.metadata && typeof payload.metadata === "object") {
      result.metadata = payload.metadata;
    }

    if ((eventName === "message" || eventName === "agent_message") && typeof payload.answer === "string") {
      result.answer += payload.answer;
    }

    if (eventName === "message_replace" && typeof payload.answer === "string") {
      result.answer = payload.answer;
    }

    if (eventName === "node_started" || eventName === "node_finished") {
      const nodeTrace = {
        event: eventName,
        data: compactTraceValue(payload.data || {})
      };
      result.billing_trace.nodes.push(nodeTrace);

      if (eventName === "node_finished" && includesTavily(payload)) {
        result.billing_trace.tavily.tool_config = {
          node_id: payload.data?.node_id || "",
          title: payload.data?.title || payload.data?.node_title || "",
          status: payload.data?.status || "",
          ...inferTavilyBilling(payload.data || payload)
        };
      }
    }

    if (eventName === "agent_log" || eventName === "agent_thought") {
      result.billing_trace.agent_logs.push({
        event: eventName,
        data: compactTraceValue(payload.data || {
          position: payload.position,
          tool: payload.tool,
          tool_input: payload.tool_input
        })
      });

      if (includesTavily(payload)) {
        const toolCall = {
          event: eventName,
          log_id: payload.id || payload.data?.id || "",
          label: payload.data?.label || payload.label || "",
          status: payload.data?.status || payload.status || "",
          provider: payload.data?.metadata?.provider || "",
          tool: compactTraceValue(payload.data?.data?.output?.tool_call_name || payload.tool || payload.tool_name || ""),
          tool_input: compactTraceValue(payload.data?.data?.output?.tool_call_input || payload.tool_input || payload.data?.inputs || {}),
          ...inferTavilyBilling(payload)
        };
        result.billing_trace.tool_calls.push(toolCall);

        // agent_log 只在工具成功完成时计费；agent_thought 则按一条显式工具事件计数。
        const status = String(toolCall.status || "").toLowerCase();
        if (eventName === "agent_thought" || status === "success" || status === "succeeded") {
          result.billing_trace.tavily.calls.push(toolCall);
        }
      }
    }

    if (eventName === "workflow_finished") {
      result.billing_trace.workflow_finished = compactTraceValue(payload.data || {});
    }
  });

  if (parsedCount === 0) {
    throw new Error("Dify 没有返回可识别的流式数据。");
  }

  result.billing_trace.workflow_run_id = result.workflow_run_id;
  const defaultTavilyBilling = result.billing_trace.tavily.tool_config || {};
  result.billing_trace.tavily.calls = result.billing_trace.tavily.calls.map((call) => {
    if (typeof call.estimated_credits === "number" || typeof defaultTavilyBilling.estimated_credits !== "number") {
      return call;
    }

    return {
      ...call,
      search_depth: defaultTavilyBilling.search_depth,
      estimated_credits: defaultTavilyBilling.estimated_credits,
      basis: `按 Tavily 工具默认配置推断：${defaultTavilyBilling.basis}`
    };
  });
  result.billing_trace.tavily.call_count = result.billing_trace.tavily.calls.length;
  const tavilyCredits = result.billing_trace.tavily.calls
    .map((call) => call.estimated_credits)
    .filter((credits) => typeof credits === "number");
  result.billing_trace.tavily.estimated_credits = tavilyCredits.length > 0
    ? tavilyCredits.reduce((sum, credits) => sum + credits, 0)
    : null;
  return result;
}

/**
 * 把环境变量中的主密钥稳定转换成 32 字节 AES 密钥。
 *
 * @param {unknown} masterKey - Vercel 环境变量 DIFY_CONFIG_ENCRYPTION_KEY。
 * @returns {Buffer} 32 字节密钥。
 * @throws {Error} 主密钥为空或过短时抛出。
 */
function deriveEncryptionKey(masterKey) {
  const text = String(masterKey || "").trim();

  if (text.length < 32) {
    throw new Error("Dify 配置加密密钥未配置或长度不足。");
  }

  if (/^[a-f0-9]{64}$/i.test(text)) {
    return Buffer.from(text, "hex");
  }

  return crypto.createHash("sha256").update(text, "utf8").digest();
}

/**
 * 使用 AES-256-GCM 加密 Dify API Key。
 *
 * @param {unknown} apiKey - 需要保存的 app- 开头密钥。
 * @param {unknown} masterKey - 服务端主加密密钥。
 * @returns {string} 带版本号、随机 IV 和认证标签的密文。
 * @throws {Error} API Key 或主密钥无效时抛出。
 */
function encryptApiKey(apiKey, masterKey) {
  const cleanKey = String(apiKey || "").trim();
  if (!cleanKey.startsWith("app-")) {
    throw new Error("Dify API Key 必须以 app- 开头。");
  }

  const key = deriveEncryptionKey(masterKey);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(cleanKey, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

/**
 * 解密 Redis 中保存的 Dify API Key。
 *
 * @param {unknown} token - encryptApiKey 生成的密文。
 * @param {unknown} masterKey - 服务端主加密密钥。
 * @returns {string} 原始 Dify API Key。
 * @throws {Error} 密文损坏、版本不支持或主密钥不一致时抛出。
 */
function decryptApiKey(token, masterKey) {
  try {
    const [version, ivText, tagText, encryptedText] = String(token || "").split(".");
    if (version !== "v1" || !ivText || !tagText || !encryptedText) {
      throw new Error("invalid encrypted token");
    }

    const decipher = crypto.createDecipheriv("aes-256-gcm", deriveEncryptionKey(masterKey), Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedText, "base64url")),
      decipher.final()
    ]).toString("utf8");

    if (!decrypted.startsWith("app-")) {
      throw new Error("invalid decrypted key");
    }

    return decrypted;
  } catch (_error) {
    throw new Error("Dify API Key 解密失败，请重新保存配置。");
  }
}

module.exports = {
  APP_TYPES,
  assertModeMatchesAppType,
  buildChatPayload,
  buildConfiguredChatInputs,
  decryptApiKey,
  encryptApiKey,
  getAppTypeForMode,
  getDefaultAppTypeForFeature,
  normalizeDifySkillKey,
  normalizeFeatureId,
  parseDifyStream
};
