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
 * 创建一个可跨 SSE 分块工作的 `<think>` 过滤器。
 *
 * 为什么不能只在最终文本上用正则：
 * - 真实流里 `<think>` 可能被拆成 `<thi` 和 `nk>` 两个 answer 事件。
 * - 如果前端先收到第一块，隐藏推理会在最终清理前短暂出现在页面上。
 * - 这个过滤器会暂存不完整标签，并在思考区间内直接丢弃内容。
 *
 * @returns {{ push: (chunk: unknown) => string, didStartThinking: () => boolean, finish: () => string }} push 返回当前可公开的文本；didStartThinking 标记本块是否进入思考区；finish 清理暂存状态。
 * @throws {Error} 本函数不主动抛异常。
 */
function createThinkContentFilter() {
  let insideThinking = false;
  let pendingTag = "";
  let startedThinkingInLastPush = false;

  /**
   * 查找文本末尾与目标标签开头重合的最长部分。
   *
   * @param {string} text - 当前尚未处理完的文本。
   * @param {string} targetTag - `<think>` 或 `</think>`。
   * @returns {number} 需要留到下一块继续判断的字符数。
   * @throws {Error} 本函数不主动抛异常。
   */
  function getPartialTagLength(text, targetTag) {
    const lowerText = text.toLowerCase();
    const maxLength = Math.min(lowerText.length, targetTag.length - 1);

    for (let length = maxLength; length > 0; length -= 1) {
      if (targetTag.startsWith(lowerText.slice(-length))) {
        return length;
      }
    }

    return 0;
  }

  return {
    /**
     * 过滤一块新的 answer 文本。
     *
     * @param {unknown} chunk - Dify 当前 message/agent_message 的 answer 字段。
     * @returns {string} 可以立即发送给浏览器的公开文本。
     * @throws {Error} 本函数不主动抛异常。
     */
    push(chunk) {
      let remaining = `${pendingTag}${String(chunk || "")}`;
      let visible = "";
      pendingTag = "";
      startedThinkingInLastPush = false;

      while (remaining) {
        const targetTag = insideThinking ? "</think>" : "<think>";
        const tagIndex = remaining.toLowerCase().indexOf(targetTag);

        if (tagIndex >= 0) {
          if (!insideThinking) {
            visible += remaining.slice(0, tagIndex);
            startedThinkingInLastPush = true;
          }
          remaining = remaining.slice(tagIndex + targetTag.length);
          insideThinking = !insideThinking;
          continue;
        }

        const partialLength = getPartialTagLength(remaining, targetTag);
        if (!insideThinking) {
          visible += remaining.slice(0, remaining.length - partialLength);
        }
        pendingTag = partialLength > 0 ? remaining.slice(-partialLength) : "";
        break;
      }

      return visible;
    },

    /**
     * 判断最近一次 push 是否遇到了完整 `<think>` 开始标签。
     *
     * @returns {boolean} 本块开始过隐藏思考区时返回 true。
     * @throws {Error} 本函数不主动抛异常。
     */
    didStartThinking() {
      return startedThinkingInLastPush;
    },

    /**
     * 结束过滤。
     *
     * @returns {string} 始终返回空字符串；不完整标签按安全优先原则丢弃。
     * @throws {Error} 本函数不主动抛异常。
     */
    finish() {
      pendingTag = "";
      return "";
    }
  };
}

/**
 * 在嵌套对象中寻找第一个指定字段。
 *
 * 这里只查找工具名和搜索词，不读取 `thought`、节点输出或网页正文，避免把内部推理误发给浏览器。
 *
 * @param {unknown} value - Dify 事件对象。
 * @param {string[]} keys - 允许读取的字段名。
 * @returns {unknown} 第一个匹配值；没有时返回 undefined。
 * @throws {Error} 本函数不主动抛异常。
 */
function findAllowedNestedField(value, keys) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const wanted = new Set(keys.map((key) => key.toLowerCase()));
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
 * 把工具名、节点名或搜索词压缩成单行安全摘要。
 *
 * @param {unknown} value - 待展示字段。
 * @param {number} maxLength - 最长字符数。
 * @returns {string} 去标签、去控制字符并截断后的文本。
 * @throws {Error} 本函数不主动抛异常。
 */
function sanitizeProcessText(value, maxLength = 160) {
  const text = typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";

  return text
    .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, maxLength);
}

/**
 * 提取工具事件里的显式搜索词。
 *
 * Dify 不同版本可能把 `tool_call_input` 返回成对象，也可能返回 JSON 字符串；这里只读取其中白名单字段，绝不把整段工具参数直接展示。
 *
 * @param {object} payload - Agent 工具事件。
 * @returns {string} 清理后的 query/keyword；没有明确字段时返回空字符串。
 * @throws {Error} JSON 字符串损坏时会被捕获，不向外抛出。
 */
function extractSearchQuery(payload) {
  const directQuery = findAllowedNestedField(payload, ["query", "search_query", "keyword", "keywords"]);
  if (directQuery !== undefined) {
    return sanitizeProcessText(directQuery, 160);
  }

  const serializedInput = findAllowedNestedField(payload, ["tool_call_input", "tool_input"]);
  if (typeof serializedInput !== "string") {
    return "";
  }

  try {
    const parsedInput = JSON.parse(serializedInput);
    return sanitizeProcessText(
      findAllowedNestedField(parsedInput, ["query", "search_query", "keyword", "keywords"]),
      160
    );
  } catch (_error) {
    return "";
  }
}

/**
 * 清理 Dify Agent 日志里重复拼接的工具名。
 *
 * 部分 Agent 会把并行工具写成 `google_search;google_search`；相同名称只显示一次，不同名称用斜杠保留。
 *
 * @param {unknown} value - Dify label 或 tool_call_name。
 * @returns {string} 去重后的工具名称。
 * @throws {Error} 本函数不主动抛异常。
 */
function normalizeProcessToolName(value) {
  const tokens = sanitizeProcessText(value, 120)
    .split(/[;,]+/)
    // `CALL` / `TOOL` 是 Agent 日志里的机器动作类型，不是工具名称的一部分。
    // 去掉它们后，界面可显示“正在调用 tavily_search”，而不是生硬的“正在调用 CALL tavily_search”。
    .map((token) => token.trim().replace(/^(?:CALL|TOOL)\s*[:：-]?\s+/i, ""))
    .filter(Boolean);
  const seen = new Set();

  return tokens.filter((token) => {
    const key = token.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  }).join(" / ");
}

/**
 * 将 Dify 原始事件转换成用户可见的过程摘要。
 *
 * 安全约束：只展示执行阶段、节点标题、工具名和显式搜索词，不转发 `thought`、prompt、节点输入输出或网页正文。
 *
 * @param {object} payload - 已解析的 Dify SSE data JSON。
 * @param {number} sequence - 当前公开步骤序号。
 * @returns {{ type: "process", step: { id: string, kind: "reasoning" | "tool" | "node", label: string, detail: string, status: "running" | "done" } } | null} 可公开过程事件。
 * @throws {Error} 本函数不主动抛异常。
 */
function createPublicProcessEvent(payload, sequence) {
  const eventName = String(payload?.event || "");
  const data = payload?.data && typeof payload.data === "object" ? payload.data : {};
  const eventId = sanitizeProcessText(payload?.id || data.id || data.node_id || `${eventName}-${sequence}`, 80);
  const baseStep = {
    id: eventId || `step-${sequence}`,
    kind: "reasoning",
    label: "正在分析问题",
    detail: "",
    status: "running"
  };

  if (eventName === "workflow_started") {
    return { type: "process", step: { ...baseStep, label: "正在规划执行步骤" } };
  }

  if (eventName === "workflow_finished") {
    return { type: "process", step: { ...baseStep, label: "分析流程已完成", status: "done" } };
  }

  if (eventName === "node_started" || eventName === "node_finished") {
    const nodeTitle = sanitizeProcessText(data.title || data.node_title || data.label || data.node_type || "分析节点", 80);
    const finished = eventName === "node_finished";
    return {
      type: "process",
      step: {
        ...baseStep,
        kind: "node",
        label: finished ? `${nodeTitle}已完成` : `正在执行${nodeTitle}`,
        status: finished ? "done" : "running"
      }
    };
  }

  if (eventName === "agent_thought" || eventName === "agent_log") {
    const toolName = normalizeProcessToolName(
      data.label || payload.label || findAllowedNestedField(payload, ["tool_call_name", "tool_name", "tool"])
    );
    const searchQuery = extractSearchQuery(payload);
    const statusText = String(data.status || payload.status || "").toLowerCase();
    const finished = ["success", "succeeded", "done", "completed"].includes(statusText);

    if (toolName) {
      return {
        type: "process",
        step: {
          ...baseStep,
          kind: "tool",
          label: finished ? `${toolName}调用完成` : `正在调用${toolName}`,
          detail: searchQuery,
          status: finished ? "done" : "running"
        }
      };
    }

    return { type: "process", step: baseStep };
  }

  return null;
}

/**
 * 创建增量 SSE data 解析器。
 *
 * @param {(payload: object) => void} onPayload - 每解析出一个 JSON 事件时调用。
 * @returns {{ push: (chunk: string) => void, finish: () => void }} 增量解析接口。
 * @throws {Error} onPayload 主动抛错时会继续向外抛出。
 */
function createSsePayloadParser(onPayload) {
  let buffer = "";

  /**
   * 解析一个完整 SSE 事件块。
   *
   * @param {string} block - 由空行分隔的 SSE 事件块。
   * @returns {void}
   * @throws {Error} Dify error 事件由上层处理。
   */
  function parseBlock(block) {
    const dataText = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n")
      .trim();

    if (!dataText || dataText === "[DONE]") {
      return;
    }

    try {
      onPayload(JSON.parse(dataText));
    } catch (error) {
      if (error instanceof SyntaxError) {
        return;
      }
      throw error;
    }
  }

  return {
    /**
     * 写入一块新的 SSE 文本。
     *
     * @param {string} chunk - TextDecoder 解码后的上游文本块。
     * @returns {void}
     * @throws {Error} 事件回调抛错时继续抛出。
     */
    push(chunk) {
      buffer += String(chunk || "");
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() || "";
      blocks.forEach(parseBlock);
    },

    /**
     * 处理流结束时没有尾随空行的最后一个事件。
     *
     * @returns {void}
     * @throws {Error} 事件回调抛错时继续抛出。
     */
    finish() {
      if (buffer.trim()) {
        parseBlock(buffer);
      }
      buffer = "";
    }
  };
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

/**
 * 生成允许返回浏览器的计费追踪。
 *
 * 为什么要再次收窄字段：
 * - `parseDifyStream` 的完整 trace 用于服务端排障，节点 inputs/outputs 里可能包含 prompt、网页正文或模型推理。
 * - 浏览器成本面板只需要事件计数、Tavily 查询与 credits，不需要完整内部日志。
 *
 * @param {unknown} trace - 服务端聚合出的 billing_trace。
 * @returns {object} 不含 Agent thought 和节点正文的公开追踪。
 * @throws {Error} 本函数不主动抛异常。
 */
function createPublicBillingTrace(trace) {
  const source = trace && typeof trace === "object" ? trace : {};
  const tavily = source.tavily && typeof source.tavily === "object" ? source.tavily : {};
  const toolConfig = tavily.tool_config && typeof tavily.tool_config === "object" ? tavily.tool_config : {};
  const calls = Array.isArray(tavily.calls) ? tavily.calls : [];

  return {
    workflow_run_id: sanitizeProcessText(source.workflow_run_id, 100),
    event_counts: source.event_counts && typeof source.event_counts === "object" ? source.event_counts : {},
    nodes: [],
    agent_logs: [],
    tool_calls: [],
    tavily: {
      call_count: Number.isFinite(Number(tavily.call_count)) ? Number(tavily.call_count) : calls.length,
      estimated_credits: typeof tavily.estimated_credits === "number" ? tavily.estimated_credits : null,
      tool_config: {
        node_id: sanitizeProcessText(toolConfig.node_id, 100),
        title: sanitizeProcessText(toolConfig.title, 100),
        status: sanitizeProcessText(toolConfig.status, 40),
        search_depth: sanitizeProcessText(toolConfig.search_depth, 40),
        estimated_credits: typeof toolConfig.estimated_credits === "number" ? toolConfig.estimated_credits : null,
        basis: sanitizeProcessText(toolConfig.basis, 120)
      },
      calls: calls.slice(0, 30).map((call) => ({
        event: sanitizeProcessText(call?.event, 40),
        log_id: sanitizeProcessText(call?.log_id, 100),
        label: sanitizeProcessText(call?.label, 100),
        status: sanitizeProcessText(call?.status, 40),
        provider: sanitizeProcessText(call?.provider, 80),
        tool: sanitizeProcessText(call?.tool, 100),
        tool_input: {
          query: sanitizeProcessText(findAllowedNestedField(call?.tool_input, ["query", "search_query", "keyword", "keywords"]), 240)
        },
        search_depth: sanitizeProcessText(call?.search_depth, 40),
        estimated_credits: typeof call?.estimated_credits === "number" ? call.estimated_credits : null,
        basis: sanitizeProcessText(call?.basis, 120)
      })),
    },
    workflow_finished: source.workflow_finished && typeof source.workflow_finished === "object"
      ? { status: sanitizeProcessText(source.workflow_finished.status, 40) }
      : null
  };
}

/**
 * 把服务端聚合结果转换成可发送给浏览器的最终元数据。
 *
 * @param {object} result - parseDifyStream 或 JSON 模式返回值。
 * @param {string} publicAnswer - 已由增量过滤器确认可公开的最终答案。
 * @returns {object} 安全的最终结果。
 * @throws {Error} 本函数不主动抛异常。
 */
function createPublicDifyResult(result, publicAnswer) {
  return {
    event: "message",
    answer: String(publicAnswer || ""),
    conversation_id: sanitizeProcessText(result?.conversation_id, 160),
    message_id: sanitizeProcessText(result?.message_id || result?.id, 160),
    task_id: sanitizeProcessText(result?.task_id, 160),
    workflow_run_id: sanitizeProcessText(result?.workflow_run_id, 160),
    metadata: result?.metadata && typeof result.metadata === "object" ? result.metadata : {},
    mode: sanitizeProcessText(result?.mode, 80),
    billing_trace: createPublicBillingTrace(result?.billing_trace)
  };
}

/**
 * 真正按上游节奏读取 Dify SSE，并把安全事件逐条交给 Vercel Handler。
 *
 * 对话型应用、Agent 和 Chatflow 都使用 `/chat-messages`，差异只体现在事件名：
 * - `message` / `agent_message` 变成 `answer_delta`。
 * - `node_*` / `agent_*` 变成不含内部思维的 `process` 摘要。
 * - 完整流结束后发送一次 `done`，携带 conversation_id、usage 和精简计费追踪。
 *
 * @param {{ apiKey: unknown, query: unknown, conversationId?: unknown, user: unknown, inputs?: object, files?: unknown[], fetchImpl?: typeof fetch, onEvent?: (event: object) => void | Promise<void> }} options - 对话和事件回调参数。
 * @returns {Promise<object>} 安全归一化后的最终结果。
 * @throws {Error} 参数、网络、Dify HTTP/SSE 错误或无法解析响应时抛出。
 */
async function streamDifyChat({
  apiKey,
  query,
  conversationId = "",
  user,
  inputs = {},
  files = [],
  fetchImpl = global.fetch,
  onEvent = () => {}
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

  if (!response.ok) {
    const errorText = await response.text();
    throw createDifyHttpError(response, errorText);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const rawText = await response.text();
    let json;
    try {
      json = rawText ? JSON.parse(rawText) : {};
    } catch (_error) {
      throw new Error("Dify 返回了无法识别的 JSON 响应。");
    }

    const answerFilter = createThinkContentFilter();
    const publicAnswer = `${answerFilter.push(json.answer || "")}${answerFilter.finish()}`;
    const result = createPublicDifyResult({
      ...json,
      billing_trace: json.billing_trace || {
        workflow_run_id: json.workflow_run_id || "",
        event_counts: { message: 1 },
        tavily: { calls: [] }
      }
    }, publicAnswer);

    if (publicAnswer) {
      await onEvent({ type: "answer_replace", answer: publicAnswer });
    }
    await onEvent({ type: "done", result });
    return result;
  }

  if (!response.body) {
    throw new Error("Dify 没有返回可读取的流式响应。");
  }

  const decoder = new TextDecoder();
  const answerFilter = createThinkContentFilter();
  const agentAnswerFilter = createThinkContentFilter();
  const pendingPublicEvents = [];
  const rawChunks = [];
  const seenProcessIds = new Set();
  let publicAnswer = "";
  let processSequence = 0;
  let agentSegmentIndex = 1;
  let agentSegment = "";
  let agentProcessId = "";
  let lastCompletedAgentSegment = "";
  let lastCompletedAgentProcessId = "";
  const parser = createSsePayloadParser((difyEvent) => {
    const eventName = String(difyEvent?.event || "");

    if (eventName === "error") {
      throw new Error(sanitizeDifyError(difyEvent.message || difyEvent.error || "Dify 流式响应返回错误。"));
    }

    const processEvent = createPublicProcessEvent(difyEvent, processSequence + 1);
    if (processEvent) {
      const processId = String(processEvent.step?.id || "");
      const isNewProcess = processId && !seenProcessIds.has(processId);

      // Agent 可能先输出“换关键词继续搜”等中间话术，再进入一个新工具步骤。
      // 新的过程 ID 是分段边界；相同 ID 通常只是状态更新，不能误把最终答案切走。
      if (isNewProcess && agentSegment) {
        lastCompletedAgentSegment = agentSegment;
        lastCompletedAgentProcessId = agentProcessId;
        agentSegment = "";
        agentProcessId = "";
        agentSegmentIndex += 1;
      }

      if (processId) {
        seenProcessIds.add(processId);
      }
      processSequence += 1;
      pendingPublicEvents.push(processEvent);
    }

    if (eventName === "message" && typeof difyEvent.answer === "string") {
      const delta = answerFilter.push(difyEvent.answer);
      if (answerFilter.didStartThinking()) {
        processSequence += 1;
        pendingPublicEvents.push({
          type: "process",
          step: {
            id: `thinking-${processSequence}`,
            kind: "reasoning",
            label: "正在分析问题",
            detail: "",
            status: "running"
          }
        });
      }
      if (delta) {
        publicAnswer += delta;
        pendingPublicEvents.push({ type: "answer_delta", delta });
      }
    }

    if (eventName === "agent_message" && typeof difyEvent.answer === "string") {
      const delta = agentAnswerFilter.push(difyEvent.answer);
      if (agentAnswerFilter.didStartThinking()) {
        processSequence += 1;
        pendingPublicEvents.push({
          type: "process",
          step: {
            id: `thinking-${processSequence}`,
            kind: "reasoning",
            label: "正在分析问题",
            detail: "",
            status: "running"
          }
        });
      }

      if (delta) {
        agentSegment += delta;
        agentProcessId = agentProcessId || `agent-message-${agentSegmentIndex}`;
        pendingPublicEvents.push({
          type: "process",
          step: {
            id: agentProcessId,
            kind: "reasoning",
            label: "正在分析问题",
            detail: sanitizeProcessText(agentSegment, 240),
            status: "running"
          }
        });
      }
    }

    if (eventName === "message_replace" && typeof difyEvent.answer === "string") {
      const replacementFilter = createThinkContentFilter();
      const replacement = `${replacementFilter.push(difyEvent.answer)}${replacementFilter.finish()}`;
      publicAnswer = replacement;
      pendingPublicEvents.push({ type: "answer_replace", answer: replacement });
    }

    if (eventName === "message_end" && !publicAnswer) {
      const finalAgentSegment = agentSegment || lastCompletedAgentSegment;
      const finalAgentProcessId = agentSegment ? agentProcessId : lastCompletedAgentProcessId;
      if (finalAgentSegment) {
        publicAnswer = finalAgentSegment;
        pendingPublicEvents.push({
          type: "answer_replace",
          answer: finalAgentSegment,
          remove_process_id: finalAgentProcessId
        });
      }
    }
  });
  const reader = response.body.getReader();

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    const decoded = decoder.decode(value, { stream: true });
    rawChunks.push(decoded);
    parser.push(decoded);

    while (pendingPublicEvents.length > 0) {
      await onEvent(pendingPublicEvents.shift());
    }
  }

  const finalDecoded = decoder.decode();
  if (finalDecoded) {
    rawChunks.push(finalDecoded);
    parser.push(finalDecoded);
  }
  parser.finish();
  answerFilter.finish();
  agentAnswerFilter.finish();
  while (pendingPublicEvents.length > 0) {
    await onEvent(pendingPublicEvents.shift());
  }

  const parsed = parseDifyStream(rawChunks.join(""));
  const result = createPublicDifyResult(parsed, publicAnswer);
  await onEvent({ type: "done", result });
  return result;
}

module.exports = {
  inspectDifyApp,
  sanitizeDifyError,
  sendDifyChat,
  streamDifyChat
};
