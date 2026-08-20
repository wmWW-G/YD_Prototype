/* global globalThis */

/**
 * Dify Console 日志查询的纯 JavaScript 引擎。
 *
 * 这个文件刻意不引用任何 Chrome API，也不直接发送网络请求。线上请求由
 * background.js 注入经过白名单校验的 getJson 函数；测试则注入离线客户端。
 * 这样可以独立验证分页、时间、严格用户匹配和脱敏，不让鉴权逻辑渗入结果。
 */
(function initDifyLogQueryEngine(globalScope) {
  "use strict";

  const DIFY_ORIGIN = "https://cloud.dify.ai";
  const SHANGHAI_TIMEZONE = "Asia/Shanghai";
  const SHANGHAI_OFFSET = "+08:00";
  const DEFAULT_MAX_PAGES = 30;
  const PAGE_LIMIT = 100;
  const DETAIL_CONCURRENCY = 3;
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const ALLOWED_SUFFIX_PATTERNS = [
    /^chat-conversations$/,
    /^chat-messages$/,
    /^advanced-chat\/workflow-runs$/,
    /^advanced-chat\/workflow-runs\/count$/,
    /^workflow-runs\/[^/]+$/,
    /^workflow-runs\/[^/]+\/node-executions$/
  ];

  /**
   * 表示可以安全展示、不包含原始业务内容的查询错误。
   */
  class QueryError extends Error {
    /**
     * 创建安全查询错误。
     *
     * @param {string} message - 面向操作者的简短中文错误。
     * @param {string} code - 稳定错误代码，供后台和侧边栏分支处理。
     */
    constructor(message, code = "QUERY_ERROR") {
      super(message);
      this.name = "QueryError";
      this.code = code;
    }
  }

  /**
   * 安全解析 URL。
   *
   * @param {unknown} value - 任意候选 URL。
   * @returns {URL|null} 可解析 URL；非法输入返回 null。
   * @throws {Error} 本函数吞掉 URL 格式异常，不向调用方抛出。
   */
  function safeUrl(value) {
    try {
      return new URL(String(value || ""));
    } catch (error) {
      return null;
    }
  }

  /**
   * 从 Dify Cloud 日志页 URL 提取当前应用。
   *
   * 为什么必须精确检查 origin、UUID 和 `/logs`：插件不能因为当前标签页里
   * 恰好出现一个 UUID，就把带登录态的查询发往错误应用或其他站点。
   *
   * @param {unknown} value - 当前标签页 URL。
   * @returns {{ origin: string, appId: string }|null} 有效上下文；否则返回 null。
   * @throws {Error} 本函数不主动抛异常。
   */
  function parseDifyLogsUrl(value) {
    const url = safeUrl(value);
    if (!url || url.origin !== DIFY_ORIGIN) {
      return null;
    }

    const match = url.pathname.match(/^\/app\/([^/]+)\/logs\/?$/);
    if (!match || !UUID_PATTERN.test(match[1])) {
      return null;
    }

    return {
      origin: DIFY_ORIGIN,
      appId: match[1]
    };
  }

  /**
   * 判断完整 Console URL 是否属于当前应用的只读白名单。
   *
   * @param {unknown} value - 待校验完整 URL。
   * @param {string} appId - 当前日志页确认过的 App UUID。
   * @returns {boolean} 只有 origin、App ID 和路径族全部正确时返回 true。
   * @throws {Error} 本函数不主动抛异常。
   */
  function isAllowedConsoleUrl(value, appId) {
    const url = safeUrl(value);
    const normalizedAppId = String(appId || "").trim();
    if (!url || url.origin !== DIFY_ORIGIN || !UUID_PATTERN.test(normalizedAppId)) {
      return false;
    }

    const basePath = `/console/api/apps/${encodeURIComponent(normalizedAppId)}/`;
    if (!url.pathname.startsWith(basePath)) {
      return false;
    }

    const suffix = url.pathname.slice(basePath.length);
    return ALLOWED_SUFFIX_PATTERNS.some((pattern) => pattern.test(suffix));
  }

  /**
   * 读取某个 Date 在北京时间下的数字字段。
   *
   * @param {Date} date - 有效日期对象。
   * @returns {{ year: string, month: string, day: string, hour: string, minute: string, second: string }} 北京时间字段。
   * @throws {RangeError} date 无效时 Intl.DateTimeFormat 会抛出异常。
   */
  function shanghaiParts(date) {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: SHANGHAI_TIMEZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    const entries = formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]);
    return Object.fromEntries(entries);
  }

  /**
   * 把 Date 格式化成带 `+08:00` 的北京时间 ISO 字符串。
   *
   * @param {Date} date - 有效日期对象。
   * @returns {string} `YYYY-MM-DDTHH:mm:ss+08:00`。
   * @throws {RangeError} date 无效时抛出。
   */
  function formatShanghaiIso(date) {
    const parts = shanghaiParts(date);
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${SHANGHAI_OFFSET}`;
  }

  /**
   * 把 `datetime-local` 输入明确解释为北京时间。
   *
   * @param {unknown} value - `YYYY-MM-DDTHH:mm` 或带秒的同类字符串。
   * @returns {Date|null} 对应绝对时间；非法输入返回 null。
   * @throws {Error} 本函数不主动抛异常。
   */
  function parseShanghaiLocalInput(value) {
    const text = String(value || "").trim();
    const match = text.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/);
    if (!match) {
      return null;
    }

    const date = new Date(`${match[1]}T${match[2]}:${match[3] || "00"}${SHANGHAI_OFFSET}`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  /**
   * 按预设或自定义输入生成北京时间窗口。
   *
   * @param {{ preset?: string, start?: string, end?: string }} input - 时间预设和可选自定义输入。
   * @param {Date} now - 当前时间，测试可传固定值。
   * @returns {{ start: string, end: string, timezone: string }} 明确的北京时间窗口。
   * @throws {QueryError} 自定义时间缺失、格式错误或起点晚于终点时抛出。
   */
  function buildTimeWindow(input = {}, now = new Date()) {
    const preset = String(input.preset || "today");
    const nowDate = new Date(now);
    if (Number.isNaN(nowDate.getTime())) {
      throw new QueryError("当前时间无效，请重新打开插件。", "INVALID_TIME");
    }

    let startDate;
    let endDate = nowDate;

    if (preset === "today") {
      const parts = shanghaiParts(nowDate);
      startDate = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00${SHANGHAI_OFFSET}`);
    } else if (preset === "recent-1h") {
      startDate = new Date(nowDate.getTime() - 60 * 60 * 1000);
    } else if (preset === "recent-4h") {
      startDate = new Date(nowDate.getTime() - 4 * 60 * 60 * 1000);
    } else if (preset === "custom") {
      startDate = parseShanghaiLocalInput(input.start);
      endDate = parseShanghaiLocalInput(input.end);
      if (!startDate || !endDate) {
        throw new QueryError("请填写有效的自定义起止时间。", "INVALID_TIME");
      }
    } else {
      throw new QueryError("未知时间范围，请重新选择。", "INVALID_TIME_PRESET");
    }

    if (startDate.getTime() > endDate.getTime()) {
      throw new QueryError("起始时间不能晚于结束时间。", "INVALID_TIME_ORDER");
    }

    return {
      start: formatShanghaiIso(startDate),
      end: formatShanghaiIso(endDate),
      timezone: SHANGHAI_TIMEZONE
    };
  }

  /**
   * 解析 Dify 常见时间字段。
   *
   * @param {unknown} value - 秒/毫秒 epoch、ISO 字符串或本地时间字符串。
   * @returns {Date|null} 有效绝对时间；无法解析返回 null。
   * @throws {Error} 本函数不主动抛异常。
   */
  function parseDate(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    if (typeof value === "number") {
      const milliseconds = value > 10_000_000_000 ? value : value * 1000;
      const parsed = new Date(milliseconds);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const text = String(value).trim();
    if (/^\d+(?:\.\d+)?$/.test(text)) {
      return parseDate(Number(text));
    }

    const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(text)
      ? `${text}${SHANGHAI_OFFSET}`
      : text;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  /**
   * 把时间字段安全格式化为北京时间 ISO。
   *
   * @param {unknown} value - Dify 原始时间字段。
   * @returns {string|null} 北京时间 ISO；无法解析返回 null。
   * @throws {Error} 本函数不主动抛异常。
   */
  function safeTime(value) {
    const parsed = parseDate(value);
    return parsed ? formatShanghaiIso(parsed) : null;
  }

  /**
   * 生成 Console 分钟精度查询参数。
   *
   * @param {string|Date|number} value - 可解析时间。
   * @returns {string} `YYYY-MM-DD HH:mm`。
   * @throws {QueryError} 时间无法解析时抛出。
   */
  function formatConsoleMinute(value) {
    const date = parseDate(value);
    if (!date) {
      throw new QueryError("查询时间无法解析。", "INVALID_TIME");
    }
    const parts = shanghaiParts(date);
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
  }

  /**
   * 从 Dify 常见响应结构提取字典记录。
   *
   * @param {unknown} payload - Console JSON 响应。
   * @returns {Array<Record<string, unknown>>} 字典记录列表。
   * @throws {Error} 本函数不主动抛异常。
   */
  function extractItems(payload) {
    if (Array.isArray(payload)) {
      return payload.filter((item) => item && typeof item === "object" && !Array.isArray(item));
    }
    if (!payload || typeof payload !== "object") {
      return [];
    }

    for (const key of ["data", "items", "list", "rows"]) {
      const value = payload[key];
      if (Array.isArray(value)) {
        return value.filter((item) => item && typeof item === "object" && !Array.isArray(item));
      }
      if (value && typeof value === "object") {
        const nested = extractItems(value);
        if (nested.length) {
          return nested;
        }
      }
    }
    return [];
  }

  /**
   * 判断分页响应是否明确或保守地存在下一页。
   *
   * @param {unknown} payload - 当前页响应。
   * @param {number} itemCount - 当前页记录数。
   * @param {number} limit - 当前页大小。
   * @returns {boolean} 有下一页返回 true。
   * @throws {Error} 本函数不主动抛异常。
   */
  function hasMore(payload, itemCount, limit) {
    if (payload && typeof payload === "object") {
      for (const container of [payload, payload.data]) {
        if (!container || typeof container !== "object") {
          continue;
        }
        for (const key of ["has_more", "hasMore"]) {
          if (Object.prototype.hasOwnProperty.call(container, key)) {
            return Boolean(container[key]);
          }
        }
      }
    }
    return itemCount >= limit;
  }

  /**
   * 按候选点路径读取第一个非空值。
   *
   * @param {Record<string, unknown>} payload - 待读取对象。
   * @param {string[]} paths - 点分隔候选路径。
   * @returns {string|null} 首个非空值的字符串；不存在返回 null。
   * @throws {Error} 本函数不主动抛异常。
   */
  function firstString(payload, paths) {
    for (const path of paths) {
      let current = payload;
      for (const segment of path.split(".")) {
        if (!current || typeof current !== "object" || !(segment in current)) {
          current = null;
          break;
        }
        current = current[segment];
      }
      if (current !== null && current !== undefined && current !== "") {
        return String(current);
      }
    }
    return null;
  }

  /**
   * 判断记录创建时间是否落在闭区间内。
   *
   * @param {Record<string, unknown>} item - Dify 记录。
   * @param {Date} start - 起点。
   * @param {Date} end - 终点。
   * @returns {boolean} 时间缺失时保守保留，否则按区间判断。
   * @throws {Error} 本函数不主动抛异常。
   */
  function inWindow(item, start, end) {
    const createdAt = parseDate(item.created_at);
    return createdAt ? createdAt >= start && createdAt <= end : true;
  }

  /**
   * 判断倒序分页是否已经完整越过查询起点。
   *
   * @param {Array<Record<string, unknown>>} items - 当前页记录。
   * @param {Date} start - 查询起点。
   * @returns {boolean} 只有每条时间都可解析且早于起点时返回 true。
   * @throws {Error} 本函数不主动抛异常。
   */
  function pageBeforeStart(items, start) {
    if (!items.length) {
      return false;
    }
    const times = items.map((item) => parseDate(item.created_at));
    return times.every((time) => time && time < start);
  }

  /**
   * 把原始错误转换成稳定类别。
   *
   * @param {unknown} value - 原始错误，仅在当前调用栈内短暂存在。
   * @returns {string} 不包含原文的错误类别。
   * @throws {Error} 本函数不主动抛异常。
   */
  function classifyError(value) {
    const text = String(value || "").toLowerCase();
    const rules = [
      [["402", "insufficient", "balance", "quota exceeded"], "余额或计费边界"],
      [["429", "rate limit", "too many requests"], "限流"],
      [["503", "service unavailable"], "上游服务暂不可用"],
      [["plugin daemon"], "Plugin Daemon 异常"],
      [["502", "bad gateway", "serverless"], "网关或 serverless 上游异常"],
      [["413", "request too large", "payload too large"], "请求载荷过大"],
      [["timeout", "timed out"], "请求超时"],
      [["connection closed", "closed network connection", "connection reset", "broken pipe"], "连接中断"],
      [["incomplete chunked read"], "响应分块读取不完整"],
      [["invalid json", "llmresultchunk"], "响应解析或模型流格式异常"]
    ];

    for (const [needles, category] of rules) {
      if (needles.some((needle) => text.includes(needle))) {
        return category;
      }
    }
    return text.trim() ? "未分类运行错误" : "失败边界已确认，具体错误为空";
  }

  /**
   * 把单个失败节点缩减为字段白名单。
   *
   * @param {Record<string, unknown>} node - 原始节点执行记录。
   * @returns {Record<string, unknown>|null} 脱敏失败节点；成功节点返回 null。
   * @throws {Error} 本函数不主动抛异常。
   */
  function safeNode(node) {
    const status = String(node.status || "");
    const rawError = node.error;
    if (!rawError && !["failed", "error"].includes(status.toLowerCase())) {
      return null;
    }
    return {
      id: firstString(node, ["id"]),
      node_id: firstString(node, ["node_id", "nodeId"]),
      title: firstString(node, ["title", "node_title"]),
      node_type: firstString(node, ["node_type", "nodeType"]),
      status: status || null,
      elapsed_time: node.elapsed_time ?? null,
      created_at: safeTime(node.created_at),
      finished_at: safeTime(node.finished_at),
      retry_index: node.retry_index ?? null,
      error_category: classifyError(rawError)
    };
  }

  /**
   * 把 run 详情缩减成最终可展示白名单。
   *
   * @param {Record<string, unknown>} run - 原始 run 详情。
   * @param {Array<Record<string, unknown>>} nodes - 已脱敏失败节点。
   * @returns {Record<string, unknown>} 不含业务内容和原始错误的运行摘要。
   * @throws {Error} 本函数不主动抛异常。
   */
  function safeRun(run, nodes) {
    const status = String(run.status || "");
    const rawError = run.error;
    return {
      id: firstString(run, ["id", "workflow_run_id"]),
      conversation_id: firstString(run, ["conversation_id", "conversation.id"]),
      status: status || null,
      triggered_from: run.triggered_from ?? null,
      created_at: safeTime(run.created_at),
      finished_at: safeTime(run.finished_at),
      elapsed_time: run.elapsed_time ?? null,
      total_steps: run.total_steps ?? null,
      total_tokens: run.total_tokens ?? null,
      error_category: rawError || ["failed", "error"].includes(status.toLowerCase())
        ? classifyError(rawError)
        : null,
      failed_nodes: Array.isArray(nodes) ? nodes.map((node) => ({
        id: node.id ?? null,
        node_id: node.node_id ?? null,
        title: node.title ?? null,
        node_type: node.node_type ?? null,
        status: node.status ?? null,
        elapsed_time: node.elapsed_time ?? null,
        created_at: node.created_at ?? null,
        finished_at: node.finished_at ?? null,
        retry_index: node.retry_index ?? null,
        error_category: node.error_category ?? null
      })) : []
    };
  }

  /**
   * 构造应用级相对路径。
   *
   * @param {string} appId - Dify App UUID。
   * @param {string} suffix - `/apps/{id}/` 后的接口片段。
   * @returns {string} 安全转义的相对路径。
   * @throws {QueryError} App ID 无效时抛出。
   */
  function appPath(appId, suffix) {
    const normalizedAppId = String(appId || "").trim();
    if (!UUID_PATTERN.test(normalizedAppId)) {
      throw new QueryError("当前页面没有有效的 Dify App ID。", "INVALID_APP");
    }
    return `/apps/${encodeURIComponent(normalizedAppId)}/${String(suffix || "").replace(/^\/+/, "")}`;
  }

  /**
   * 递归判断 JSON 是否包含用户主动提供的 marker。
   *
   * @param {unknown} value - 消息 JSON。
   * @param {string} marker - 用户提供的精确诊断标记。
   * @returns {boolean} 任一字符串包含 marker 时返回 true。
   * @throws {Error} 本函数不主动抛异常。
   */
  function containsMarker(value, marker) {
    if (typeof value === "string") {
      return value.includes(marker);
    }
    if (Array.isArray(value)) {
      return value.some((item) => containsMarker(item, marker));
    }
    if (value && typeof value === "object") {
      return Object.values(value).some((item) => containsMarker(item, marker));
    }
    return false;
  }

  /**
   * 从不同版本消息结构提取 workflow run ID。
   *
   * @param {Record<string, unknown>} message - 单条 Dify 消息。
   * @returns {string|null} workflow run ID；找不到返回 null。
   * @throws {Error} 本函数不主动抛异常。
   */
  function workflowRunId(message) {
    const direct = firstString(message, [
      "workflow_run_id",
      "workflow_run.id",
      "metadata.workflow_run_id",
      "metadata.workflow_run.id"
    ]);
    if (direct) {
      return direct;
    }

    const stack = [message];
    while (stack.length) {
      const current = stack.pop();
      if (!current || typeof current !== "object") {
        continue;
      }
      if (!Array.isArray(current)) {
        for (const key of ["workflow_run_id", "workflowRunId"]) {
          if (current[key] !== null && current[key] !== undefined && current[key] !== "") {
            return String(current[key]);
          }
        }
      }
      stack.push(...Object.values(current));
    }
    return null;
  }

  /**
   * 向界面发送不含业务内容的查询进度。
   *
   * @param {Function|undefined} callback - 可选进度回调。
   * @param {string} stage - 稳定阶段名称。
   * @param {Record<string, number|boolean>} details - 页数和数量等安全统计。
   * @returns {void}
   * @throws {Error} 回调异常会被吞掉，不能中断查询。
   */
  function emitProgress(callback, stage, details = {}) {
    if (typeof callback !== "function") {
      return;
    }
    try {
      callback({ stage, ...details });
    } catch (error) {
      // 进度只是辅助界面；渲染端异常不应该破坏只读查询本身。
    }
  }

  /**
   * 分页读取并严格匹配终端用户会话。
   *
   * @param {Function} getJson - 只读 JSON 客户端。
   * @param {string} appId - Dify App UUID。
   * @param {string} userId - 终端用户 session ID。
   * @param {Date} start - 查询起点。
   * @param {Date} end - 查询终点。
   * @param {number} maxPages - 最大页数。
   * @param {Function|undefined} onProgress - 安全进度回调。
   * @returns {Promise<{ conversations: Array<Record<string, unknown>>, pages: number, truncated: boolean }>} 匹配会话和覆盖信息。
   * @throws {Error} getJson 的安全错误原样抛出。
   */
  async function fetchConversations(getJson, appId, userId, start, end, maxPages, onProgress) {
    const conversations = [];
    let pages = 0;
    let truncated = false;

    for (let page = 1; page <= maxPages; page += 1) {
      const payload = await getJson(appPath(appId, "chat-conversations"), {
        keyword: userId,
        page,
        limit: PAGE_LIMIT,
        start: formatConsoleMinute(start),
        end: formatConsoleMinute(end),
        sort_by: "-created_at",
        annotation_status: "all"
      });
      pages += 1;
      const items = extractItems(payload);
      conversations.push(...items.filter((item) => (
        String(item.from_end_user_session_id ?? "") === userId && inWindow(item, start, end)
      )));

      emitProgress(onProgress, "conversations", {
        conversationPages: pages,
        candidateConversations: conversations.length
      });

      const more = hasMore(payload, items.length, PAGE_LIMIT);
      if (!more) {
        break;
      }
      if (page === maxPages) {
        truncated = true;
      }
    }

    return { conversations, pages, truncated };
  }

  /**
   * 以固定并发数处理数组，避免瞬时打爆 Console API。
   *
   * @param {unknown[]} items - 待处理项。
   * @param {number} concurrency - 最大并发 worker 数。
   * @param {Function} worker - 处理单项的异步函数。
   * @returns {Promise<unknown[]>} 保持输入顺序的结果数组。
   * @throws {Error} worker 未自行处理的异常会向调用方抛出。
   */
  async function mapWithConcurrency(items, concurrency, worker) {
    const results = new Array(items.length);
    let nextIndex = 0;

    async function runWorker() {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await worker(items[currentIndex], currentIndex);
      }
    }

    const workerCount = Math.min(Math.max(1, concurrency), items.length || 1);
    await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
    return results;
  }

  /**
   * 读取单个 run 详情和节点，并立即脱敏。
   *
   * @param {Function} getJson - 只读 JSON 客户端。
   * @param {string} appId - Dify App UUID。
   * @param {string} runId - workflow run ID。
   * @returns {Promise<Record<string, unknown>>} 脱敏运行摘要。
   * @throws {QueryError} run 详情不是对象时抛出。
   */
  async function loadSafeRun(getJson, appId, runId) {
    const encodedRunId = encodeURIComponent(runId);
    const detailPayload = await getJson(appPath(appId, `workflow-runs/${encodedRunId}`));
    const detail = detailPayload && typeof detailPayload === "object" && detailPayload.data
      && typeof detailPayload.data === "object" && !Array.isArray(detailPayload.data)
      ? detailPayload.data
      : detailPayload;
    if (!detail || typeof detail !== "object" || Array.isArray(detail)) {
      throw new QueryError("workflow run 详情格式无法识别。", "INVALID_RUN_DETAIL");
    }

    const nodePayload = await getJson(appPath(appId, `workflow-runs/${encodedRunId}/node-executions`));
    const nodes = extractItems(nodePayload)
      .map(safeNode)
      .filter(Boolean);
    return safeRun(detail, nodes);
  }

  /**
   * 读取一组 run，并把个别详情覆盖缺口留在统计中。
   *
   * @param {Function} getJson - 只读 JSON 客户端。
   * @param {string} appId - Dify App UUID。
   * @param {string[]} runIds - 去重后的 run ID。
   * @param {Function|undefined} onProgress - 安全进度回调。
   * @returns {Promise<{ runs: Array<Record<string, unknown>>, uncoveredRunDetails: number }>} 脱敏运行与未覆盖数。
   * @throws {Error} 本函数捕获单个 run 错误，不因个别详情失败中止整体报告。
   */
  async function loadSafeRuns(getJson, appId, runIds, onProgress) {
    let completed = 0;
    let uncoveredRunDetails = 0;
    const loaded = await mapWithConcurrency(runIds, DETAIL_CONCURRENCY, async (runId) => {
      try {
        return await loadSafeRun(getJson, appId, runId);
      } catch (error) {
        uncoveredRunDetails += 1;
        return null;
      } finally {
        completed += 1;
        emitProgress(onProgress, "details", {
          detailCompleted: completed,
          detailTotal: runIds.length
        });
      }
    });

    const runs = loaded.filter(Boolean);
    runs.sort((left, right) => String(left.created_at || left.id || "").localeCompare(
      String(right.created_at || right.id || "")
    ));
    return { runs, uncoveredRunDetails };
  }

  /**
   * 分页读取 Advanced Chat 失败运行并按窗口与会话筛选。
   *
   * @param {Function} getJson - 只读 JSON 客户端。
   * @param {string} appId - Dify App UUID。
   * @param {Set<string>|null} allowedConversationIds - 用户模式的允许会话集合；应用模式传 null。
   * @param {Date} start - 查询起点。
   * @param {Date} end - 查询终点。
   * @param {number} maxPages - 最大页数。
   * @param {Function|undefined} onProgress - 安全进度回调。
   * @returns {Promise<Record<string, unknown>>} 原始记录 ID 与覆盖统计，不含业务内容。
   * @throws {Error} getJson 的安全错误原样抛出。
   */
  async function fetchFailedRuns(
    getJson,
    appId,
    allowedConversationIds,
    start,
    end,
    maxPages,
    onProgress
  ) {
    const records = [];
    let lastId = null;
    let pages = 0;
    let truncated = false;
    let windowComplete = false;

    for (let page = 1; page <= maxPages; page += 1) {
      const params = {
        triggered_from: "app-run",
        status: "failed",
        limit: PAGE_LIMIT
      };
      if (lastId) {
        params.last_id = lastId;
      }

      const payload = await getJson(appPath(appId, "advanced-chat/workflow-runs"), params);
      pages += 1;
      const items = extractItems(payload);
      records.push(...items.filter((item) => {
        const conversationId = firstString(item, ["conversation_id", "conversation.id"]);
        const conversationAllowed = allowedConversationIds === null
          || (conversationId && allowedConversationIds.has(conversationId));
        return conversationAllowed && inWindow(item, start, end);
      }));

      emitProgress(onProgress, "failed-runs", {
        failedRunPages: pages,
        failedListRecords: records.length
      });

      const more = hasMore(payload, items.length, PAGE_LIMIT);
      if (pageBeforeStart(items, start) || !more || !items.length) {
        windowComplete = true;
        break;
      }

      const nextLastId = firstString(items[items.length - 1], ["id", "workflow_run_id"]);
      if (!nextLastId || nextLastId === lastId) {
        truncated = true;
        break;
      }
      lastId = nextLastId;
      if (page === maxPages) {
        truncated = true;
      }
    }

    const runIds = [...new Set(records
      .map((item) => firstString(item, ["id", "workflow_run_id"]))
      .filter(Boolean))].sort();
    return {
      records,
      runIds,
      pages,
      truncated,
      windowComplete
    };
  }

  /**
   * 组装最终脱敏报告。
   *
   * @param {Record<string, unknown>} input - 模式、应用、用户、窗口和摘要。
   * @returns {Record<string, unknown>} 可安全传给侧边栏的结果。
   * @throws {Error} 本函数不主动抛异常。
   */
  function buildReport(input) {
    return {
      tool: "dify-log-query-analysis",
      read_only: true,
      mode: input.mode,
      app_id: input.appId,
      user: input.userId || null,
      window: {
        start: formatShanghaiIso(input.start),
        end: formatShanghaiIso(input.end),
        timezone: SHANGHAI_TIMEZONE
      },
      coverage_note: "零匹配仅表示本应用、时间窗、筛选条件和分页覆盖内未匹配，不能扩大为线上没有失败。",
      summary: input.summary
    };
  }

  /**
   * 执行用户失败、应用失败或 marker 精确诊断。
   *
   * @param {{ getJson: Function, appId: string, mode: string, userId?: string, marker?: string, start: string|Date|number, end: string|Date|number, maxPages?: number, onProgress?: Function }} options - 结构化查询参数。
   * @returns {Promise<Record<string, unknown>>} 完整脱敏报告。
   * @throws {QueryError} 输入无效时抛出；网络错误由安全客户端转换后抛出。
   */
  async function queryLogs(options = {}) {
    if (typeof options.getJson !== "function") {
      throw new QueryError("缺少只读查询客户端。", "INVALID_CLIENT");
    }

    const appId = String(options.appId || "").trim();
    if (!UUID_PATTERN.test(appId)) {
      throw new QueryError("当前页面没有有效的 Dify App ID。", "INVALID_APP");
    }

    const mode = String(options.mode || "");
    if (!["user-failed", "app-failed", "marker"].includes(mode)) {
      throw new QueryError("请选择有效的查询模式。", "INVALID_MODE");
    }

    const userId = String(options.userId || "").trim();
    const marker = String(options.marker || "").trim();
    if (["user-failed", "marker"].includes(mode) && !userId) {
      throw new QueryError("该查询模式必须填写用户 ID。", "MISSING_USER_ID");
    }
    if (mode === "marker" && !marker) {
      throw new QueryError("精确诊断必须填写 marker。", "MISSING_MARKER");
    }

    const start = parseDate(options.start);
    const end = parseDate(options.end);
    if (!start || !end || start > end) {
      throw new QueryError("查询起止时间无效。", "INVALID_TIME");
    }

    const requestedMaxPages = Number(options.maxPages || DEFAULT_MAX_PAGES);
    const maxPages = Number.isInteger(requestedMaxPages)
      ? Math.min(100, Math.max(1, requestedMaxPages))
      : DEFAULT_MAX_PAGES;
    emitProgress(options.onProgress, "start", { conversationPages: 0, failedRunPages: 0 });

    const conversationResult = mode === "app-failed"
      ? { conversations: [], pages: 0, truncated: false }
      : await fetchConversations(
        options.getJson,
        appId,
        userId,
        start,
        end,
        maxPages,
        options.onProgress
      );

    if (mode === "marker") {
      const runIds = new Set();
      let matchedMessages = 0;
      let messagesWithoutWorkflowRunId = 0;

      for (const conversation of conversationResult.conversations) {
        const conversationId = firstString(conversation, ["id", "conversation_id"]);
        if (!conversationId) {
          continue;
        }
        const payload = await options.getJson(appPath(appId, "chat-messages"), {
          conversation_id: conversationId,
          limit: PAGE_LIMIT
        });
        for (const message of extractItems(payload)) {
          if (!containsMarker(message, marker)) {
            continue;
          }
          matchedMessages += 1;
          const runId = workflowRunId(message);
          if (runId) {
            runIds.add(runId);
          } else {
            messagesWithoutWorkflowRunId += 1;
          }
        }
      }

      const detailResult = await loadSafeRuns(
        options.getJson,
        appId,
        [...runIds].sort(),
        options.onProgress
      );
      emitProgress(options.onProgress, "complete", { matchedRuns: detailResult.runs.length });
      return buildReport({
        mode,
        appId,
        userId,
        start,
        end,
        summary: {
          candidate_conversations: conversationResult.conversations.length,
          conversation_pages: conversationResult.pages,
          conversation_pages_truncated: conversationResult.truncated,
          matched_messages: matchedMessages,
          messages_without_workflow_run_id: messagesWithoutWorkflowRunId,
          uncovered_run_details: detailResult.uncoveredRunDetails,
          matched_runs: detailResult.runs.length,
          runs: detailResult.runs
        }
      });
    }

    const allowedConversationIds = mode === "user-failed"
      ? new Set(conversationResult.conversations
        .map((conversation) => firstString(conversation, ["id", "conversation_id"]))
        .filter(Boolean))
      : null;
    const failedResult = await fetchFailedRuns(
      options.getJson,
      appId,
      allowedConversationIds,
      start,
      end,
      maxPages,
      options.onProgress
    );
    const detailResult = await loadSafeRuns(
      options.getJson,
      appId,
      failedResult.runIds,
      options.onProgress
    );
    emitProgress(options.onProgress, "complete", { matchedRuns: detailResult.runs.length });

    return buildReport({
      mode,
      appId,
      userId: mode === "user-failed" ? userId : null,
      start,
      end,
      summary: {
        queried_status: "failed",
        candidate_conversations: mode === "user-failed"
          ? conversationResult.conversations.length
          : null,
        conversation_pages: conversationResult.pages,
        conversation_pages_truncated: conversationResult.truncated,
        failed_run_pages: failedResult.pages,
        failed_run_pages_truncated: failedResult.truncated,
        failed_run_window_complete: failedResult.windowComplete,
        failed_list_records: failedResult.records.length,
        uncovered_run_details: detailResult.uncoveredRunDetails,
        matched_runs: detailResult.runs.length,
        runs: detailResult.runs
      }
    });
  }

  const api = {
    QueryError,
    buildTimeWindow,
    classifyError,
    isAllowedConsoleUrl,
    parseDifyLogsUrl,
    queryLogs,
    safeRun
  };

  globalScope.DifyLogQueryEngine = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

