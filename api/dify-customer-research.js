/**
 * Dify 客户背调代理接口。
 *
 * 为什么需要代理：
 * - GitHub Pages 上的静态页面直接请求 Dify 时，用户浏览器插件、公司网络或安全策略可能拦截 api.dify.ai。
 * - Dify API Key 不能写进前端代码，否则任何人打开网页都能看到密钥。
 * - 代理把密钥放在 Vercel 环境变量里，浏览器只请求本接口。
 *
 * 需要的环境变量：
 * - DIFY_CUSTOMER_RESEARCH_API_KEY：客户背调 Chatflow 的 app- 开头 API Key。
 * - DIFY_PROXY_ALLOWED_ORIGINS：可选，逗号分隔的允许来源；不填时默认允许赢单 GitHub Pages 和本地调试地址。
 */

const DIFY_CHAT_MESSAGES_URL = "https://api.dify.ai/v1/chat-messages";
const TRACE_TEXT_LIMIT = 800;
const TRACE_ARRAY_LIMIT = 20;
const TRACE_OBJECT_DEPTH_LIMIT = 4;
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
 * 读取允许跨域访问代理的来源。
 *
 * @returns {string[]} 允许的 Origin 列表。
 * @throws {Error} 本函数不主动抛异常。
 */
function getAllowedOrigins() {
  const configured = process.env.DIFY_PROXY_ALLOWED_ORIGINS || "";
  const origins = configured
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : DEFAULT_ALLOWED_ORIGINS;
}

/**
 * 判断当前请求来源是否可以访问代理。
 *
 * @param {string | undefined} origin - 浏览器请求头里的 Origin。
 * @returns {string} 允许写回 CORS 头的 Origin；空字符串表示不允许。
 * @throws {Error} 本函数不主动抛异常。
 */
function resolveAllowedOrigin(origin) {
  if (!origin) {
    return DEFAULT_ALLOWED_ORIGINS[0];
  }

  return getAllowedOrigins().includes(origin) ? origin : "";
}

/**
 * 设置 CORS 响应头。
 *
 * @param {import("http").ServerResponse} res - Vercel 传入的响应对象。
 * @param {string} origin - 已确认允许的 Origin。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function setCorsHeaders(res, origin) {
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

/**
 * 从前端请求里整理 Dify 所需的 payload。
 *
 * @param {{ query?: unknown, conversation_id?: unknown, user?: unknown }} body - 前端传来的请求体。
 * @returns {{ inputs: object, query: string, response_mode: string, conversation_id: string, user: string, files: unknown[] }} Dify chat-messages 请求体。
 * @throws {Error} 当 query 为空时抛出错误，避免无意义消耗 Dify 调用额度。
 */
function buildDifyPayload(body) {
  const query = String(body?.query || "").trim();

  if (!query) {
    throw new Error("请输入客户信息后再开始背调。");
  }

  return {
    inputs: {},
    query,
    response_mode: "streaming",
    conversation_id: String(body?.conversation_id || ""),
    user: String(body?.user || `yd-prototype-${Date.now()}`),
    files: []
  };
}

/**
 * 把 Dify 节点事件里的大对象压缩成适合计费排查的摘要。
 *
 * 为什么要压缩:
 * - Tavily / 搜索节点可能返回整页内容或大量搜索结果, 直接透传会让响应变大。
 * - 工具输出里未来可能夹带客户输入或内部上下文, 只保留排查所需字段更稳。
 * - 计费只需要知道节点、工具、参数、耗时和 token/价格, 不需要完整网页正文。
 *
 * @param {unknown} value - 需要压缩的任意 Dify 事件字段。
 * @param {number} depth - 当前递归深度, 外部调用时不需要传。
 * @returns {unknown} 压缩后的值。
 * @throws {Error} 本函数不主动抛异常。
 */
function compactTraceValue(value, depth = 0) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return value.length > TRACE_TEXT_LIMIT
      ? `${value.slice(0, TRACE_TEXT_LIMIT)}... [truncated ${value.length - TRACE_TEXT_LIMIT} chars]`
      : value;
  }

  if (typeof value !== "object") {
    return value;
  }

  if (depth >= TRACE_OBJECT_DEPTH_LIMIT) {
    return Array.isArray(value) ? `[array:${value.length}]` : "[object]";
  }

  if (Array.isArray(value)) {
    const items = value.slice(0, TRACE_ARRAY_LIMIT).map((item) => compactTraceValue(item, depth + 1));

    if (value.length > TRACE_ARRAY_LIMIT) {
      items.push(`[truncated ${value.length - TRACE_ARRAY_LIMIT} items]`);
    }

    return items;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, compactTraceValue(item, depth + 1)])
  );
}

/**
 * 判断一个 Dify 事件或节点数据里是否出现 Tavily。
 *
 * @param {unknown} value - Dify streaming 事件、节点 data、inputs 或 outputs。
 * @returns {boolean} 包含 tavily 字样时返回 true。
 * @throws {Error} 本函数不主动抛异常。
 */
function includesTavily(value) {
  try {
    return JSON.stringify(value).toLowerCase().includes("tavily");
  } catch (error) {
    return false;
  }
}

/**
 * 从对象里递归查找常见字段。
 *
 * @param {unknown} value - 需要查找的对象。
 * @param {string[]} candidateKeys - 可能的字段名, 会忽略大小写。
 * @returns {unknown} 找到的字段值；找不到时返回 undefined。
 * @throws {Error} 本函数不主动抛异常。
 */
function findNestedField(value, candidateKeys) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const wanted = candidateKeys.map((key) => key.toLowerCase());
  const stack = [value];
  const visited = new Set();

  while (stack.length > 0) {
    const current = stack.pop();

    if (!current || typeof current !== "object" || visited.has(current)) {
      continue;
    }

    visited.add(current);

    if (Array.isArray(current)) {
      current.forEach((item) => stack.push(item));
      continue;
    }

    for (const [key, item] of Object.entries(current)) {
      if (wanted.includes(key.toLowerCase())) {
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
 * 根据 Tavily 节点参数推断搜索档位和 credits。
 *
 * @param {unknown} nodeData - Dify node_finished 或 agent_thought 事件中的 data。
 * @returns {{ search_depth: string, estimated_credits: number | null, basis: string }} Tavily 计费推断。
 * @throws {Error} 本函数不主动抛异常。
 */
function inferTavilyBilling(nodeData) {
  const searchDepth = findNestedField(nodeData, ["search_depth", "searchDepth", "depth"]);
  const toolName = String(findNestedField(nodeData, ["tool_name", "tool", "provider", "provider_name"]) || "").toLowerCase();
  const normalizedDepth = String(searchDepth || "").toLowerCase();

  if (normalizedDepth.includes("advanced")) {
    return { search_depth: "advanced", estimated_credits: 2, basis: "search_depth=advanced" };
  }

  if (normalizedDepth.includes("basic")) {
    return { search_depth: "basic", estimated_credits: 1, basis: "search_depth=basic" };
  }

  if (toolName.includes("extract")) {
    return { search_depth: "unknown", estimated_credits: null, basis: "tavily extract/map/crawl 类工具需按 Tavily 原始返回或控制台核算" };
  }

  return { search_depth: "unknown", estimated_credits: null, basis: "Dify 事件未暴露 search_depth, 只能确认调用了 Tavily" };
}

/**
 * 提取单个 Dify 节点事件的计费摘要。
 *
 * @param {object} payload - Dify streaming 里的单条 JSON 事件。
 * @returns {object} 节点计费摘要。
 * @throws {Error} 本函数不主动抛异常。
 */
function buildNodeTrace(payload) {
  const data = payload.data || {};

  return {
    event: payload.event || "",
    workflow_run_id: payload.workflow_run_id || "",
    node_event_id: data.id || "",
    node_id: data.node_id || "",
    node_type: data.node_type || "",
    title: data.title || data.node_title || "",
    index: data.index,
    status: data.status || "",
    elapsed_time: data.elapsed_time,
    created_at: data.created_at || payload.created_at,
    finished_at: data.finished_at,
    error: data.error || payload.error || null,
    execution_metadata: compactTraceValue(data.execution_metadata || data.metadata || {}),
    inputs: compactTraceValue(data.inputs || data.process_data?.inputs || {}),
    outputs: compactTraceValue(data.outputs || data.process_data?.outputs || {})
  };
}

/**
 * 将 Dify 的 SSE 流式响应整理成前端现有页面能消费的 JSON。
 *
 * 为什么代理里做这一步：
 * - Dify blocking 模式的完整背调容易超过上游网关 60 秒限制并返回 504。
 * - streaming 模式可以让上游连接持续产出分片，避免长时间无响应。
 * - 当前原型前端已经按 JSON answer 渲染；代理累积流式分片后返回 JSON，可以不改页面结构。
 *
 * @param {string} rawText - Dify 返回的 text/event-stream 原文。
 * @returns {{ event: string, answer: string, conversation_id: string, message_id: string, id: string, task_id: string, workflow_run_id: string, metadata: object, mode: string, billing_trace: object }} 合并后的响应对象。
 * @throws {Error} 当 Dify 流中返回 error 事件时抛出，便于前端显示明确失败原因。
 */
function parseDifyStream(rawText) {
  const result = {
    event: "message",
    answer: "",
    conversation_id: "",
    message_id: "",
    id: "",
    task_id: "",
    workflow_run_id: "",
    metadata: {},
    mode: "advanced-chat",
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

  rawText.split(/\n\n+/).forEach((block) => {
    const dataLines = block
      .split(/\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.replace(/^data:\s?/, ""));

    dataLines.forEach((line) => {
      if (!line || line === "[DONE]") {
        return;
      }

      let payload = null;

      try {
        payload = JSON.parse(line);
      } catch (error) {
        return;
      }

      if (payload.event === "error") {
        throw new Error(payload.message || payload.error || "Dify 流式响应返回错误。");
      }

      if (payload.event) {
        result.billing_trace.event_counts[payload.event] = (result.billing_trace.event_counts[payload.event] || 0) + 1;
      }

      if (payload.answer) {
        result.answer += payload.answer;
      }

      result.conversation_id = payload.conversation_id || result.conversation_id;
      result.message_id = payload.message_id || payload.id || result.message_id;
      result.id = payload.id || result.id;
      result.task_id = payload.task_id || result.task_id;
      result.workflow_run_id = payload.workflow_run_id || result.workflow_run_id;
      result.billing_trace.workflow_run_id = payload.workflow_run_id || result.billing_trace.workflow_run_id;
      result.mode = payload.mode || result.mode;

      if (payload.metadata) {
        result.metadata = payload.metadata;
      }

      if (payload.event === "node_started" || payload.event === "node_finished") {
        const nodeTrace = buildNodeTrace(payload);
        result.billing_trace.nodes.push(nodeTrace);

        if (payload.event === "node_finished" && includesTavily(payload)) {
          result.billing_trace.tavily.tool_config = {
            node_id: nodeTrace.node_id,
            title: nodeTrace.title,
            node_type: nodeTrace.node_type,
            status: nodeTrace.status,
            elapsed_time: nodeTrace.elapsed_time,
            ...inferTavilyBilling(payload.data || payload)
          };
        }
      }

      if (payload.event === "agent_log") {
        const compactLog = compactTraceValue(payload);
        result.billing_trace.agent_logs.push(compactLog);

        const agentLogLabel = String(payload.data?.label || payload.label || "").toLowerCase();
        const agentLogStatus = String(payload.data?.status || payload.status || "").toLowerCase();
        const agentToolName = String(payload.data?.data?.output?.tool_call_name || "").toLowerCase();
        const agentProvider = String(payload.data?.metadata?.provider || "").toLowerCase();
        const isCompletedTavilyCall = agentLogStatus === "success" && (
          agentLogLabel.includes("call tavily") ||
          agentToolName.includes("tavily") ||
          (agentProvider.includes("tavily") && agentLogLabel.includes("call"))
        );

        if (isCompletedTavilyCall) {
          const tavilyBilling = inferTavilyBilling(payload);
          const tavilyCall = {
            event: payload.event,
            log_id: payload.id || payload.data?.id || "",
            node_id: payload.data?.node_id || payload.data?.node_execution_id || "",
            label: payload.data?.label || payload.label || "",
            status: payload.data?.status || payload.status || "",
            provider: payload.data?.metadata?.provider || "",
            elapsed_time: payload.data?.metadata?.elapsed_time,
            tool: compactTraceValue(payload.data?.data?.output?.tool_call_name || payload.data?.data?.tool_name || payload.tool_name || ""),
            tool_input: compactTraceValue(payload.data?.data?.output?.tool_call_input || payload.data?.data?.tool_input || payload.data?.inputs || payload.tool_input || {}),
            ...tavilyBilling
          };

          result.billing_trace.tool_calls.push(tavilyCall);
          result.billing_trace.tavily.calls.push(tavilyCall);
        }
      }

      if (payload.event === "agent_thought" || payload.event === "tool_call" || payload.event === "tool_response") {
        const compactEvent = compactTraceValue(payload);
        result.billing_trace.tool_calls.push(compactEvent);

        if (includesTavily(payload)) {
          const tavilyBilling = inferTavilyBilling(payload);
          const tavilyCall = {
            event: payload.event,
            tool: compactTraceValue(payload.tool || payload.tool_name || payload.data?.tool || payload.data?.tool_name || ""),
            tool_input: compactTraceValue(payload.tool_input || payload.data?.tool_input || payload.data?.inputs || {}),
            ...tavilyBilling
          };

          result.billing_trace.tavily.calls.push(tavilyCall);
        }
      }

      if (payload.event === "workflow_finished") {
        result.billing_trace.workflow_finished = compactTraceValue(payload.data || {});
      }
    });
  });

  const defaultTavilyBilling = result.billing_trace.tavily.tool_config || {};
  result.billing_trace.tavily.calls = result.billing_trace.tavily.calls.map((call) => {
    if (typeof call.estimated_credits === "number") {
      return call;
    }

    if (typeof defaultTavilyBilling.estimated_credits === "number") {
      return {
        ...call,
        search_depth: defaultTavilyBilling.search_depth,
        estimated_credits: defaultTavilyBilling.estimated_credits,
        basis: `按 Agent Tavily 工具默认配置推断: ${defaultTavilyBilling.basis}`
      };
    }

    return call;
  });
  result.billing_trace.tool_calls = result.billing_trace.tool_calls.map((call) => {
    if (call.event !== "agent_log" || typeof call.estimated_credits === "number") {
      return call;
    }

    if (typeof defaultTavilyBilling.estimated_credits === "number") {
      return {
        ...call,
        search_depth: defaultTavilyBilling.search_depth,
        estimated_credits: defaultTavilyBilling.estimated_credits,
        basis: `按 Agent Tavily 工具默认配置推断: ${defaultTavilyBilling.basis}`
      };
    }

    return call;
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
 * Vercel Serverless Function 入口。
 *
 * @param {import("http").IncomingMessage & { body?: unknown, method?: string, headers: Record<string, string | string[] | undefined> }} req - Vercel 请求对象。
 * @param {import("http").ServerResponse} res - Vercel 响应对象。
 * @returns {Promise<void>} 请求处理完成后结束响应。
 * @throws {Error} 本函数内部捕获并转成 JSON 错误，不向外抛出。
 */
module.exports = async function handler(req, res) {
  const requestOrigin = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin;
  const allowedOrigin = resolveAllowedOrigin(requestOrigin);
  setCorsHeaders(res, allowedOrigin);

  if (!allowedOrigin) {
    res.statusCode = 403;
    res.end(JSON.stringify({ message: "当前页面来源不允许访问背调代理。" }));
    return;
  }

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ message: "只支持 POST 请求。" }));
    return;
  }

  const apiKey = process.env.DIFY_CUSTOMER_RESEARCH_API_KEY || process.env.DIFY_API_KEY || "";

  if (!apiKey.startsWith("app-")) {
    res.statusCode = 500;
    res.end(JSON.stringify({ message: "背调代理没有配置 Dify API Key。" }));
    return;
  }

  try {
    const difyPayload = buildDifyPayload(req.body || {});
    const difyResponse = await fetch(DIFY_CHAT_MESSAGES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(difyPayload)
    });
    const rawText = await difyResponse.text();

    if (!difyResponse.ok) {
      res.statusCode = difyResponse.status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ message: rawText || `Dify 返回 HTTP ${difyResponse.status}` }));
      return;
    }

    const contentType = difyResponse.headers.get("content-type") || "";
    const responseBody = contentType.includes("text/event-stream")
      ? JSON.stringify(parseDifyStream(rawText))
      : rawText;

    res.statusCode = difyResponse.status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(responseBody || JSON.stringify({ message: `Dify 返回空响应，HTTP ${difyResponse.status}` }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "背调代理调用失败。";
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ message }));
  }
};
