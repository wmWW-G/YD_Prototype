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
 * @returns {{ push: (chunk: unknown) => string, didStartThinking: () => boolean, takeEvents: () => Array<{type: "text", text: string} | {type: "thinking_start"} | {type: "thinking_end"}>, finish: () => string }} push 返回当前可公开的文本；takeEvents 保留标签与公开文本的原始先后顺序；finish 清理暂存状态。
 * @throws {Error} 本函数不主动抛异常。
 */
function createThinkContentFilter() {
  let insideThinking = false;
  let pendingTag = "";
  let startedThinkingInLastPush = false;
  let semanticEventsInLastPush = [];

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
      semanticEventsInLastPush = [];

      while (remaining) {
        const targetTag = insideThinking ? "</think>" : "<think>";
        const tagIndex = remaining.toLowerCase().indexOf(targetTag);

        if (tagIndex >= 0) {
          if (!insideThinking) {
            const visibleBeforeTag = remaining.slice(0, tagIndex);
            if (visibleBeforeTag) {
              visible += visibleBeforeTag;
              semanticEventsInLastPush.push({ type: "text", text: visibleBeforeTag });
            }
            startedThinkingInLastPush = true;
            semanticEventsInLastPush.push({ type: "thinking_start" });
          } else {
            semanticEventsInLastPush.push({ type: "thinking_end" });
          }
          remaining = remaining.slice(tagIndex + targetTag.length);
          insideThinking = !insideThinking;
          continue;
        }

        const partialLength = getPartialTagLength(remaining, targetTag);
        if (!insideThinking) {
          const visibleText = remaining.slice(0, remaining.length - partialLength);
          if (visibleText) {
            visible += visibleText;
            semanticEventsInLastPush.push({ type: "text", text: visibleText });
          }
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
     * 取出最近一块中按原始顺序识别出的公开语义事件。
     *
     * `<think>` 内部正文从不进入事件；这里只告诉上层“本轮开始/结束”，
     * 让界面可以独立计时，同时继续遵守不公开隐藏推理的安全边界。
     *
     * @returns {Array<{type: "text", text: string} | {type: "thinking_start"} | {type: "thinking_end"}>} 当前块的语义事件副本。
     * @throws {Error} 本函数不主动抛异常。
     */
    takeEvents() {
      return semanticEventsInLastPush.map((event) => ({ ...event }));
    },

    /**
     * 结束过滤。
     *
     * @returns {string} 始终返回空字符串；不完整标签按安全优先原则丢弃。
     * @throws {Error} 本函数不主动抛异常。
     */
    finish() {
      pendingTag = "";
      semanticEventsInLastPush = [];
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
 * 安全约束：展示 Dify API 明确定义为公开过程的 `agent_thought.thought`，但不转发 prompt、observation、节点输入输出或网页正文。
 * `<think>` 标签仍由 sanitizeProcessText 过滤，避免把模型隐藏思考误当成公开过程。
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
    // Dify 对话应用文档明确把 agent_thought.thought 定义为可消费的 Agent 思考步骤。
    // 这里只读取事件顶层或 data 顶层字段，绝不从 observation、工具输出或节点正文里递归寻找“思考”。
    const publicThought = sanitizeProcessText(payload.thought ?? data.thought, 600);
    const statusText = String(data.status || payload.status || "").toLowerCase();
    const finished = ["success", "succeeded", "done", "completed"].includes(statusText);

    if (toolName) {
      const detail = publicThought && searchQuery
        ? `${publicThought} · 搜索：${searchQuery}`
        : (publicThought || searchQuery);
      return {
        type: "process",
        step: {
          ...baseStep,
          kind: "tool",
          label: finished ? `${toolName}调用完成` : `正在调用${toolName}`,
          detail,
          status: finished ? "done" : "running"
        }
      };
    }

    if (publicThought) {
      return {
        type: "process",
        step: {
          ...baseStep,
          label: "思考过程",
          detail: publicThought
        }
      };
    }

    // 空的 Agent 轮次只是协议占位；既没有公开思考也没有工具信息时不发给前端，
    // 避免大量“正在分析问题”把真正有信息量的过程淹没。
    return null;
  }

  return null;
}

/**
 * 把 Dify usage 字段收窄成成本监控需要的数字。
 *
 * 为什么只保留这些字段：
 * - 节点 outputs/process_data 可能包含 prompt、网页正文和业务数据，不能直接发给浏览器。
 * - 成本页只需要 token、供应商回传金额、币种和实际模型名。
 *
 * @param {unknown} value - Dify 节点中的 usage 或 execution_metadata。
 * @returns {{ promptTokens: number, completionTokens: number, totalTokens: number, reportedAmount: number | null, reportedCurrency: string, model: string, provider: string }} 安全用量。
 * @throws {Error} 本函数不主动抛异常。
 */
function sanitizeCostUsage(value) {
  const usage = value && typeof value === "object" ? value : {};

  /**
   * 将未知值转换成非负数字。
   *
   * @param {unknown} numberValue - Dify 数字或数字字符串。
   * @returns {number} 有效非负数字；否则返回 0。
   */
  const toNonNegativeNumber = (numberValue) => {
    const parsed = Number(numberValue);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  };

  /**
   * 将供应商金额转换成数字，同时保留“没有返回”与“明确返回 0”的区别。
   *
   * @param {unknown} amountValue - 金额字段。
   * @returns {number | null} 金额或 null。
   */
  const toOptionalAmount = (amountValue) => {
    if (amountValue === null || amountValue === undefined || amountValue === "") {
      return null;
    }
    const parsed = Number(amountValue);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };

  const promptTokens = toNonNegativeNumber(usage.prompt_tokens ?? usage.promptTokens ?? usage.input_tokens ?? usage.inputTokens);
  const completionTokens = toNonNegativeNumber(usage.completion_tokens ?? usage.completionTokens ?? usage.output_tokens ?? usage.outputTokens);
  const explicitTotal = toNonNegativeNumber(usage.total_tokens ?? usage.totalTokens);

  return {
    promptTokens,
    completionTokens,
    totalTokens: explicitTotal || promptTokens + completionTokens,
    reportedAmount: toOptionalAmount(usage.total_price ?? usage.totalPrice ?? usage.price ?? usage.cost),
    reportedCurrency: sanitizeProcessText(usage.currency ?? usage.price_currency ?? usage.priceCurrency, 16).toUpperCase(),
    model: sanitizeProcessText(usage.model_name ?? usage.modelName ?? usage.model, 120),
    provider: sanitizeProcessText(usage.provider_name ?? usage.providerName ?? usage.provider, 100)
  };
}

/**
 * 从 node_finished 中按稳定优先级选择 usage。
 *
 * 优先级来自当前两个 Chatflow 的真实返回：outputs.usage 最接近节点最终汇总，
 * process_data.usage 和 execution_metadata 只用于兼容不同节点/插件版本。
 *
 * @param {object} data - Dify node_finished.data。
 * @returns {{ usage: object, source: string }} 原始 usage 对象与证据位置。
 * @throws {Error} 本函数不主动抛异常。
 */
function getNodeCostUsage(data) {
  const candidates = [
    [data?.outputs?.usage, "outputs.usage"],
    [data?.process_data?.usage, "process_data.usage"],
    [data?.execution_metadata?.usage, "execution_metadata.usage"],
    [data?.usage, "data.usage"],
    [data?.execution_metadata, "execution_metadata"]
  ];
  const matched = candidates.find(([candidate]) => candidate && typeof candidate === "object");

  return matched
    ? { usage: matched[0], source: matched[1] }
    : { usage: {}, source: "node_finished" };
}

/**
 * 将 Dify 原始事件转换成可公开的实时成本事件。
 *
 * 安全与准确性规则：
 * - 只处理完成态 node_finished 和成功态工具日志，node_started 永不计费。
 * - 不从节点标题猜模型；实际模型名缺失时明确标记 model_unresolved。
 * - message_end 只生成 Token 校验事件，不把可能混币种的 total_price 当最终成本。
 *
 * @param {object} payload - Dify SSE data JSON。
 * @param {object | null} processEvent - 同一原始事件生成的公开过程事件。
 * @returns {{ type: "cost_update", item: object } | { type: "cost_checksum", usage: object, note: string } | null} 安全成本事件。
 * @throws {Error} 本函数不主动抛异常。
 */
function createPublicCostEvent(payload, processEvent) {
  const eventName = String(payload?.event || "");
  const data = payload?.data && typeof payload.data === "object" ? payload.data : {};

  if (eventName === "message_end") {
    const usage = sanitizeCostUsage(payload?.metadata?.usage);
    if (!usage.totalTokens && !usage.promptTokens && !usage.completionTokens) {
      return null;
    }

    return {
      type: "cost_checksum",
      usage,
      note: "全局 usage 只核对 Token；不同币种必须按成本明细逐行换算"
    };
  }

  if (eventName === "node_finished") {
    const nodeType = sanitizeProcessText(data.node_type || data.type || data.node_type_name, 80);
    const nodeLabel = sanitizeProcessText(data.title || data.node_title || data.label || nodeType || "Chatflow 节点", 120);
    const nodeTypeLower = nodeType.toLowerCase();
    const nodeLabelLower = nodeLabel.toLowerCase();
    const isKnowledge = /knowledge|retrieval|知识库|检索/.test(`${nodeTypeLower} ${nodeLabelLower}`);
    const isDocument = /document|extractor|文档/.test(`${nodeTypeLower} ${nodeLabelLower}`);
    const isAgent = /agent/.test(`${nodeTypeLower} ${nodeLabelLower}`);
    const isVision = /vision|image|图片|视觉/.test(`${nodeTypeLower} ${nodeLabelLower}`);
    const { usage: rawUsage, source } = getNodeCostUsage(data);
    const usage = sanitizeCostUsage(rawUsage);
    const outputs = data.outputs && typeof data.outputs === "object" ? data.outputs : {};
    const processData = data.process_data && typeof data.process_data === "object" ? data.process_data : {};
    const executionMetadata = data.execution_metadata && typeof data.execution_metadata === "object" ? data.execution_metadata : {};
    const model = usage.model || sanitizeProcessText(
      outputs.model_name || outputs.model || processData.model_name || processData.model || executionMetadata.model_name || executionMetadata.model || data.model_name || data.model,
      120
    );
    const provider = usage.provider || sanitizeProcessText(
      outputs.provider_name || outputs.provider || processData.provider_name || processData.provider || executionMetadata.provider_name || executionMetadata.provider || data.provider_name || data.provider,
      100
    );
    const hasModelUsage = usage.totalTokens > 0 || usage.promptTokens > 0 || usage.completionTokens > 0 || usage.reportedAmount !== null;

    // 普通分支、模板、变量聚合节点没有独立供应商成本，不需要制造大量 0 元明细。
    if (!hasModelUsage && !isKnowledge && !isDocument) {
      return null;
    }

    // 知识库检索节点返回的模型用量属于 Embedding，不是对话 LLM。
    // 即使字段层级和普通 LLM usage 一样，也必须先按节点真实类型归类，
    // 否则会把 text-embedding-3-large 错套到 Gemini/DeepSeek 单价。
    const category = isKnowledge
      ? "embedding"
      : isDocument && !hasModelUsage
        ? "document"
        : "llm";
    const role = isAgent ? "agent" : isVision ? "vision" : isKnowledge ? "knowledge" : isDocument ? "document" : "model-node";
    // 优先使用“本次执行事件 ID”，而不是稳定的流程节点 ID。
    // 同一个 Agent 节点发生重试时，node_id 往往相同，但每次执行都可能已经产生供应商费用；
    // 用事件 ID 入账才能既去掉重复推送，又保留真实重试成本。
    const nodeId = sanitizeProcessText(payload.id || data.id || data.node_id || `${nodeType}-${nodeLabel}`, 120);

    return {
      type: "cost_update",
      item: {
        id: `node-${nodeId || "unknown"}`,
        category,
        role,
        label: category === "llm" ? (isAgent ? "Agent 模型" : isVision ? "视觉模型" : "模型节点") : (isKnowledge ? "知识库查询向量" : "文档解析"),
        nodeLabel,
        nodeType,
        provider,
        model,
        service: category === "embedding" ? sanitizeProcessText(model || nodeLabel, 120) : category === "document" ? "document_parser" : "",
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        quantity: category === "embedding" ? usage.totalTokens : category === "document" ? 1 : null,
        unit: category === "embedding" ? "token" : category === "document" ? "document" : "token",
        reportedAmount: usage.reportedAmount,
        reportedCurrency: usage.reportedCurrency,
        evidence: hasModelUsage ? "exact" : "unpriced",
        evidenceSource: source,
        pricingStatus: category === "llm"
          ? (model ? "exact_usage" : "model_unresolved")
          : category === "embedding"
            ? (usage.totalTokens > 0 ? "exact_usage" : "quantity_unresolved")
            : "unit_usage"
      }
    };
  }

  if ((eventName === "agent_log" || eventName === "agent_thought") && processEvent?.step?.kind === "tool") {
    const statusText = String(data.status || payload.status || "").toLowerCase();
    if (!["success", "succeeded", "done", "completed"].includes(statusText)) {
      return null;
    }

    const rawToolName = findAllowedNestedField(payload, ["tool_call_name", "tool_name", "tool"])
      || data.label
      || payload.label
      || processEvent.step.label;
    const toolName = normalizeProcessToolName(rawToolName).toLowerCase().replace(/\s+/g, "_");
    const isTavily = toolName.includes("tavily");
    const isExtract = toolName.includes("extract");
    const successfulUrlCountRaw = findAllowedNestedField(payload, ["successful_url_count", "success_count", "url_count"]);
    const successfulUrlCount = Number(successfulUrlCountRaw);
    const hasSuccessfulUrlCount = Number.isFinite(successfulUrlCount) && successfulUrlCount >= 0;
    const quantity = isTavily && isExtract
      ? (hasSuccessfulUrlCount ? successfulUrlCount / 5 : null)
      : 1;
    const eventId = sanitizeProcessText(payload.id || data.id || processEvent.step.id || `${toolName}-${Date.now()}`, 120);

    return {
      type: "cost_update",
      item: {
        id: `tool-${eventId || "unknown"}`,
        category: "tool",
        role: "tool",
        label: isExtract ? "网页提取" : isTavily ? "网页搜索" : "工具调用",
        nodeLabel: sanitizeProcessText(processEvent.step.label, 120),
        nodeType: "agent_tool",
        provider: isTavily ? "Tavily" : "",
        model: "",
        service: toolName,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        quantity,
        unit: isTavily ? "credit" : "call",
        reportedAmount: null,
        reportedCurrency: "",
        evidence: quantity === null ? "unpriced" : (isExtract ? "allocated" : "exact"),
        evidenceSource: eventName,
        pricingStatus: quantity === null ? "quantity_unresolved" : "unit_usage",
        requiresQuantity: quantity === null
      }
    };
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
  const costItems = Array.isArray(source.cost_items) ? source.cost_items : [];

  return {
    workflow_run_id: sanitizeProcessText(source.workflow_run_id, 100),
    event_counts: source.event_counts && typeof source.event_counts === "object" ? source.event_counts : {},
    nodes: [],
    agent_logs: [],
    tool_calls: [],
    // 只保留已脱敏的模型、token、工具次数和金额；节点输入输出仍不会进入浏览器。
    cost_items: costItems.slice(0, 80).map((item) => ({
      id: sanitizeProcessText(item?.id, 120),
      category: sanitizeProcessText(item?.category, 40),
      role: sanitizeProcessText(item?.role, 40),
      label: sanitizeProcessText(item?.label, 120),
      nodeLabel: sanitizeProcessText(item?.nodeLabel, 120),
      nodeType: sanitizeProcessText(item?.nodeType, 80),
      provider: sanitizeProcessText(item?.provider, 100),
      model: sanitizeProcessText(item?.model, 120),
      service: sanitizeProcessText(item?.service, 120),
      promptTokens: Number.isFinite(Number(item?.promptTokens)) ? Number(item.promptTokens) : 0,
      completionTokens: Number.isFinite(Number(item?.completionTokens)) ? Number(item.completionTokens) : 0,
      totalTokens: Number.isFinite(Number(item?.totalTokens)) ? Number(item.totalTokens) : 0,
      quantity: item?.quantity === null || item?.quantity === undefined
        ? null
        : (Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : null),
      unit: sanitizeProcessText(item?.unit, 40),
      reportedAmount: item?.reportedAmount === null || item?.reportedAmount === undefined
        ? null
        : (Number.isFinite(Number(item.reportedAmount)) ? Number(item.reportedAmount) : null),
      reportedCurrency: sanitizeProcessText(item?.reportedCurrency, 16).toUpperCase(),
      evidence: sanitizeProcessText(item?.evidence, 40),
      evidenceSource: sanitizeProcessText(item?.evidenceSource, 80),
      pricingStatus: sanitizeProcessText(item?.pricingStatus, 40),
      requiresQuantity: Boolean(item?.requiresQuantity)
    })),
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
 * 创建流式读取期间同步维护的轻量结果对象。
 *
 * 为什么不能在结束时重新解析全部 SSE：Agent 长任务可能产生数千个 token 事件；
 * 在 Cloudflare Free 的 10 ms CPU 限额下，结尾再次 JSON.parse 整段文本会形成 CPU 尖峰。
 * 这里在第一次解析事件时只保留最终响应必需的 ID、usage 和精简计费字段。
 *
 * @returns {object} 可直接交给 createPublicDifyResult 的增量结果。
 * @throws {Error} 本函数不主动抛异常。
 */
function createIncrementalStreamResult() {
  return {
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
      cost_items: [],
      tavily: {
        call_count: 0,
        estimated_credits: null,
        tool_config: {},
        calls: []
      },
      workflow_finished: null
    }
  };
}

/**
 * 把一条已解析 Dify 事件合并进轻量最终结果。
 *
 * @param {object} result - createIncrementalStreamResult 创建的可变结果。
 * @param {object} difyEvent - 当前 Dify SSE data 对象。
 * @param {object | null} processEvent - 已脱敏的公开过程事件。
 * @param {Set<string>} seenToolTraceIds - 已记录的工具步骤 ID，避免 running/success 重复计数。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function updateIncrementalStreamResult(result, difyEvent, processEvent, seenToolTraceIds) {
  const eventName = String(difyEvent?.event || "unknown");
  const trace = result.billing_trace;
  trace.event_counts[eventName] = (trace.event_counts[eventName] || 0) + 1;

  result.conversation_id = difyEvent?.conversation_id || result.conversation_id;
  result.message_id = difyEvent?.message_id || difyEvent?.id || result.message_id;
  result.task_id = difyEvent?.task_id || result.task_id;
  result.workflow_run_id = difyEvent?.workflow_run_id || result.workflow_run_id;
  result.mode = difyEvent?.mode || result.mode;
  if (difyEvent?.metadata && typeof difyEvent.metadata === "object") {
    result.metadata = difyEvent.metadata;
  }

  if (eventName === "workflow_finished") {
    trace.workflow_finished = {
      status: String(difyEvent?.data?.status || "")
    };
  }

  const step = processEvent?.step;
  if (step?.kind !== "tool" || !/tavily/i.test(`${step.label || ""} ${step.detail || ""}`)) {
    return;
  }

  const traceId = String(step.id || `tavily-${trace.tavily.calls.length + 1}`);
  const existingCall = trace.tavily.calls.find((call) => call.log_id === traceId);
  if (existingCall) {
    existingCall.status = step.status;
    return;
  }
  if (seenToolTraceIds.has(traceId) || trace.tavily.calls.length >= 30) {
    return;
  }

  seenToolTraceIds.add(traceId);
  trace.tavily.calls.push({
    event: eventName,
    log_id: traceId,
    label: String(step.label || ""),
    status: String(step.status || ""),
    provider: "",
    tool: "tavily_search",
    tool_input: { query: String(step.detail || "") },
    search_depth: "",
    estimated_credits: null,
    basis: ""
  });
  trace.tavily.call_count = trace.tavily.calls.length;
}

/**
 * 把实时成本事件保存进最终 billing_trace，并判断是否需要立即发给浏览器。
 *
 * @param {object} result - createIncrementalStreamResult 创建的结果对象。
 * @param {object | null} costEvent - createPublicCostEvent 返回的安全事件。
 * @param {Set<string>} seenCostItemIds - 已入账明细 ID，防止同一节点/工具重复计算。
 * @returns {boolean} true 表示这条事件是新的，应发送给浏览器。
 * @throws {Error} 本函数不主动抛异常。
 */
function storeIncrementalCostEvent(result, costEvent, seenCostItemIds) {
  if (!costEvent || typeof costEvent !== "object") {
    return false;
  }

  if (costEvent.type === "cost_checksum") {
    return true;
  }

  if (costEvent.type !== "cost_update" || !costEvent.item || typeof costEvent.item !== "object") {
    return false;
  }

  const costItemId = String(costEvent.item.id || "");
  if (!costItemId || seenCostItemIds.has(costItemId)) {
    return false;
  }

  seenCostItemIds.add(costItemId);
  result.billing_trace.cost_items.push({ ...costEvent.item });
  return true;
}

/**
 * 真正按上游节奏读取 Dify SSE，并把安全事件逐条交给 Vercel Handler。
 *
 * 对话型应用、Agent 和 Chatflow 都使用 `/chat-messages`，但不能只按事件名判断答案：
 * - 普通 `message` 变成 `answer_delta`。
 * - Chatflow 的 Agent 节点也可能用 `message` 发送多轮阶段播报；这类文本先进入过程区，节点结束后只提升最后一段为答案。
 * - Agent 应用的 `agent_message` 同样先按轮次进入过程区，只提升最后一段为答案。
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
  const seenProcessIds = new Set();
  const seenToolTraceIds = new Set();
  const seenCostItemIds = new Set();
  // Dify 的 Chatflow Agent 节点在真实流里仍可能使用通用 `message` 事件。
  // 记录正在运行的 Agent 节点，才能避免把“已确认身份，接下来继续搜索”误当正式答案。
  const activeChatflowAgentNodeIds = new Set();
  const incrementalResult = createIncrementalStreamResult();
  let publicAnswer = "";
  let processSequence = 0;
  let agentSegmentIndex = 1;
  let agentSegment = "";
  let agentProcessId = "";
  let lastAgentProcessEmitLength = 0;
  let lastCompletedAgentSegment = "";
  let lastCompletedAgentProcessId = "";
  let activeAgentThinkingId = "";
  let lastAgentThinkingId = "";
  let agentThinkingRoundIndex = 0;
  let agentSegmentRoundId = "";
  let agentSegmentEmitOffset = 0;
  let hasSeenAgentThinking = false;

  /**
   * 把当前 Agent 可见段落尚未发送的部分增量送入过程区。
   *
   * 只有检测到显式 `<think>` 轮次后才使用增量小结协议；没有 think 标签的旧 Agent
   * 继续走原有 240 字覆盖式摘要，避免长回答产生过多公开事件。
   *
   * @param {boolean} force - true 时立即发送不足节流阈值的尾部文本。
   * @returns {void}
   * @throws {Error} 本函数不主动抛异常。
   */
  function flushAgentSummaryDelta(force) {
    if (!hasSeenAgentThinking || !agentSegment || !agentProcessId) {
      return;
    }

    const pendingDelta = agentSegment.slice(agentSegmentEmitOffset);
    const shouldEmit = pendingDelta
      && (force || agentSegmentEmitOffset === 0 || pendingDelta.length >= 48 || pendingDelta.includes("\n"));
    if (!shouldEmit) {
      return;
    }

    agentSegmentEmitOffset = agentSegment.length;
    pendingPublicEvents.push({
      type: "process",
      step: {
        id: agentProcessId,
        kind: "summary",
        label: "阶段小结",
        detailDelta: pendingDelta,
        roundId: agentSegmentRoundId || lastAgentThinkingId,
        status: "running"
      }
    });
  }

  /**
   * 将当前 Agent 可见段落定稿为一轮历史小结，并准备接收下一轮文本。
   *
   * @returns {void}
   * @throws {Error} 本函数不主动抛异常。
   */
  function completeAgentSegment() {
    if (!agentSegment) {
      return;
    }

    flushAgentSummaryDelta(true);
    if (hasSeenAgentThinking && agentProcessId) {
      pendingPublicEvents.push({
        type: "process",
        step: {
          id: agentProcessId,
          kind: "summary",
          label: "阶段小结",
          detailDelta: "",
          roundId: agentSegmentRoundId || lastAgentThinkingId,
          status: "done"
        }
      });
    }

    lastCompletedAgentSegment = agentSegment;
    lastCompletedAgentProcessId = agentProcessId;
    agentSegment = "";
    agentProcessId = "";
    agentSegmentRoundId = "";
    agentSegmentEmitOffset = 0;
    lastAgentProcessEmitLength = 0;
    agentSegmentIndex += 1;
  }

  /**
   * 开启一轮新的显式 thinking 计时。
   *
   * 新一轮开始本身就是上一条可见 message 已经结束的可靠边界，
   * 因此先定稿上一轮小结，再发出新的 running 步骤。
   *
   * @returns {void}
   * @throws {Error} 本函数不主动抛异常。
   */
  function startAgentThinkingRound() {
    completeAgentSegment();
    hasSeenAgentThinking = true;
    agentThinkingRoundIndex += 1;
    activeAgentThinkingId = `agent-thinking-${agentThinkingRoundIndex}`;
    lastAgentThinkingId = activeAgentThinkingId;
    pendingPublicEvents.push({
      type: "process",
      step: {
        id: activeAgentThinkingId,
        kind: "thinking",
        label: "正在深度思考",
        detail: "",
        status: "running"
      }
    });
  }

  /**
   * 结束当前显式 thinking 计时。
   *
   * @returns {void}
   * @throws {Error} 本函数不主动抛异常。
   */
  function finishAgentThinkingRound() {
    if (!activeAgentThinkingId) {
      return;
    }

    pendingPublicEvents.push({
      type: "process",
      step: {
        id: activeAgentThinkingId,
        kind: "thinking",
        label: "已深度思考",
        detail: "",
        status: "done"
      }
    });
    activeAgentThinkingId = "";
  }

  const parser = createSsePayloadParser((difyEvent) => {
    const eventName = String(difyEvent?.event || "");
    const nodeData = difyEvent?.data && typeof difyEvent.data === "object" ? difyEvent.data : {};
    const nodeType = String(nodeData.node_type || "").toLowerCase();
    const nodeId = String(nodeData.node_id || nodeData.id || difyEvent?.id || "");

    if (eventName === "node_started" && nodeType === "agent") {
      // 同一 Chatflow 理论上也可能并行执行多个 Agent，因此使用 Set，而不是单个布尔值。
      activeChatflowAgentNodeIds.add(nodeId || "anonymous-agent");
    }

    if (eventName === "error") {
      throw new Error(sanitizeDifyError(difyEvent.message || difyEvent.error || "Dify 流式响应返回错误。"));
    }

    const processEvent = createPublicProcessEvent(difyEvent, processSequence + 1);
    if (
      processEvent?.step
      && lastAgentThinkingId
      && ["agent_thought", "agent_log"].includes(eventName)
    ) {
      // 公开 thought、工具名和搜索词归入当前 thinking 轮次，供展开后查看。
      // 这里只增加关联 ID，不会把隐藏 `<think>`、observation 或工具结果带到浏览器。
      processEvent.step.roundId = activeAgentThinkingId || lastAgentThinkingId;
    }
    const costEvent = createPublicCostEvent(difyEvent, processEvent);
    const shouldEmitCostEvent = storeIncrementalCostEvent(incrementalResult, costEvent, seenCostItemIds);
    updateIncrementalStreamResult(incrementalResult, difyEvent, processEvent, seenToolTraceIds);
    if (processEvent) {
      const processId = String(processEvent.step?.id || "");
      const isNewProcess = processId && !seenProcessIds.has(processId);

      // Agent 可能先输出“换关键词继续搜”等中间话术，再进入一个新工具步骤。
      // 新的过程 ID 是分段边界；相同 ID 通常只是状态更新，不能误把最终答案切走。
      if (isNewProcess && agentSegment && !hasSeenAgentThinking) {
        completeAgentSegment();
      }

      if (processId) {
        seenProcessIds.add(processId);
      }
      processSequence += 1;
      pendingPublicEvents.push(processEvent);
    }

    // 成本事件放在对应的过程事件之后，让页面先看到“节点完成”，再看到该节点金额入账。
    if (shouldEmitCostEvent) {
      pendingPublicEvents.push(costEvent);
    }

    const messageBelongsToRunningChatflowAgent = eventName === "message"
      && activeChatflowAgentNodeIds.size > 0;

    if (eventName === "message" && !messageBelongsToRunningChatflowAgent && typeof difyEvent.answer === "string") {
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

    if ((eventName === "agent_message" || messageBelongsToRunningChatflowAgent) && typeof difyEvent.answer === "string") {
      agentAnswerFilter.push(difyEvent.answer);
      const semanticEvents = agentAnswerFilter.takeEvents();

      semanticEvents.forEach((semanticEvent) => {
        if (semanticEvent.type === "thinking_start") {
          startAgentThinkingRound();
          return;
        }

        if (semanticEvent.type === "thinking_end") {
          finishAgentThinkingRound();
          return;
        }

        const delta = semanticEvent.type === "text" ? semanticEvent.text : "";
        if (!delta) {
          return;
        }

        agentSegment += delta;
        agentProcessId = agentProcessId || `agent-message-${agentSegmentIndex}`;
        agentSegmentRoundId = agentSegmentRoundId || lastAgentThinkingId;

        if (hasSeenAgentThinking) {
          flushAgentSummaryDelta(false);
          return;
        }

        const visibleLength = Math.min(agentSegment.length, 240);
        const shouldEmitProcess = lastAgentProcessEmitLength === 0
          || visibleLength - lastAgentProcessEmitLength >= 48
          || (visibleLength === 240 && lastAgentProcessEmitLength < 240);

        // 没有显式 think 标签的旧 Agent 段落继续使用覆盖式节流摘要。
        if (shouldEmitProcess) {
          lastAgentProcessEmitLength = visibleLength;
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
      });
    }

    if (eventName === "message_replace" && typeof difyEvent.answer === "string") {
      const replacementFilter = createThinkContentFilter();
      const replacement = `${replacementFilter.push(difyEvent.answer)}${replacementFilter.finish()}`;
      publicAnswer = replacement;
      pendingPublicEvents.push({ type: "answer_replace", answer: replacement });
    }

    if (eventName === "message_end" && !publicAnswer) {
      flushAgentSummaryDelta(true);
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

    if (eventName === "node_finished" && nodeType === "agent") {
      finishAgentThinkingRound();
      // 必须在本事件的过程分段完成后再移除：node_finished 本身正是最后一轮答案的边界。
      if (nodeId) {
        activeChatflowAgentNodeIds.delete(nodeId);
      } else {
        activeChatflowAgentNodeIds.delete("anonymous-agent");
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
    parser.push(decoded);

    while (pendingPublicEvents.length > 0) {
      await onEvent(pendingPublicEvents.shift());
    }
  }

  const finalDecoded = decoder.decode();
  if (finalDecoded) {
    parser.push(finalDecoded);
  }
  parser.finish();
  answerFilter.finish();
  agentAnswerFilter.finish();
  while (pendingPublicEvents.length > 0) {
    await onEvent(pendingPublicEvents.shift());
  }

  // 某些 Agent 流会在最终 agent_message 后直接 EOF，不再附 message_end。
  // 此时最后一段已经是用户可见报告，应提升为正式答案而不是误报“流提前结束”。
  if (!publicAnswer) {
    flushAgentSummaryDelta(true);
    // `flushAgentSummaryDelta` 只把尾部加入公开事件队列。必须先真正发送这段小结，
    // 再提升同一文本为正式正文，否则前端会先切到答案阶段并遗漏最后几个字。
    while (pendingPublicEvents.length > 0) {
      await onEvent(pendingPublicEvents.shift());
    }
    const finalAgentSegment = agentSegment || lastCompletedAgentSegment;
    const finalAgentProcessId = agentSegment ? agentProcessId : lastCompletedAgentProcessId;
    if (finalAgentSegment) {
      publicAnswer = finalAgentSegment;
      await onEvent({
        type: "answer_replace",
        answer: finalAgentSegment,
        remove_process_id: finalAgentProcessId
      });
    }
  }

  incrementalResult.billing_trace.workflow_run_id = incrementalResult.workflow_run_id;
  const result = createPublicDifyResult(incrementalResult, publicAnswer);
  await onEvent({ type: "done", result });
  return result;
}

module.exports = {
  inspectDifyApp,
  sanitizeDifyError,
  sendDifyChat,
  streamDifyChat
};
