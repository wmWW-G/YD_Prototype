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
  // 六并发能明显缩短大量 Run 的等待时间，同时仍给 Dify Console API 留出余量。
  // 所有详情读取都经过同一个固定 worker 池，不会随 Run 数量无限放大请求数。
  const DETAIL_CONCURRENCY = 6;
  const SAFE_CACHE_TTL_MS = 5 * 60 * 1000;
  const SAFE_CACHE_MAX_ENTRIES = 2000;
  // 缓存中只放 safeRun/safeNodeCost 处理后的白名单对象。原始输入、输出、错误
  // 和 execution_metadata 从不进入 Map，避免用性能优化扩大隐私数据驻留范围。
  const safeRunSummaryCache = new Map();
  const safeRunNodeCache = new Map();
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
   * 把接口中的币种代码缩减为可安全展示的标准形式。
   *
   * 为什么不只允许 USD/RMB：Dify 的模型供应商以后可能返回其他币种，
   * 成本查询必须保留接口原币种，不能静默丢弃或擅自换汇。
   *
   * @param {unknown} value - 节点执行元数据中的币种。
   * @returns {string|null} 大写币种代码；格式异常时返回 null。
   * @throws {Error} 本函数不主动抛异常。
   */
  function normalizeCurrency(value) {
    const currency = String(value || "").trim().toUpperCase();
    return /^[A-Z][A-Z0-9_-]{0,11}$/.test(currency) ? currency : null;
  }

  /**
   * 把单个价格值转换为可累计的有限非负数字。
   *
   * @param {unknown} value - Dify 返回的数字或数字字符串。
   * @returns {number|null} 有效价格；缺失、负数和无限值返回 null。
   * @throws {Error} 本函数不主动抛异常。
   */
  function safePrice(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const price = Number(value);
    return Number.isFinite(price) && price >= 0 ? price : null;
  }

  /**
   * 控制浮点累计误差，保留足够覆盖模型微小单价的精度。
   *
   * @param {number} value - 待归一化的成本累计值。
   * @returns {number} 最多保留十二位小数的有限数字。
   * @throws {Error} 本函数不主动抛异常。
   */
  function roundCost(value) {
    return Number(Number(value || 0).toFixed(12));
  }

  /**
   * 从一个节点执行记录中只提取币种和总价。
   *
   * Dify 不同版本可能把字段放在顶层或 execution_metadata 中，因此同时
   * 兼容两种结构；其他模型、输入输出和业务内容一律不进入最终报告。
   *
   * @param {Record<string, unknown>} node - 原始节点执行记录。
   * @returns {{ currency: string, total_price: number }|null} 脱敏成本记录。
   * @throws {Error} 本函数不主动抛异常。
   */
  function safeNodeCost(node) {
    const currency = normalizeCurrency(firstString(node, [
      "currency",
      "execution_metadata.currency"
    ]));
    const rawPrice = firstString(node, [
      "total_price",
      "execution_metadata.total_price"
    ]);
    const totalPrice = safePrice(rawPrice);
    return currency && totalPrice !== null
      ? { currency, total_price: totalPrice }
      : null;
  }

  /**
   * 把同一次运行的节点成本按原币种分别合计。
   *
   * @param {Array<{ currency: string, total_price: number }>} nodeCosts - 已脱敏节点成本。
   * @returns {Array<{ currency: string, total_price: number, node_count: number }>} 按币种排序的运行成本。
   * @throws {Error} 本函数不主动抛异常。
   */
  function summarizeNodeCosts(nodeCosts) {
    const totals = new Map();
    for (const item of Array.isArray(nodeCosts) ? nodeCosts : []) {
      const current = totals.get(item.currency) || { total_price: 0, node_count: 0 };
      current.total_price = roundCost(current.total_price + item.total_price);
      current.node_count += 1;
      totals.set(item.currency, current);
    }
    return [...totals.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([currency, value]) => ({ currency, ...value }));
  }

  /**
   * 把多次运行的成本按原币种分别汇总，绝不跨币种换算或相加。
   *
   * @param {Array<Record<string, unknown>>} runs - 已脱敏运行摘要。
   * @returns {Array<{ currency: string, total_price: number, run_count: number, node_count: number }>} 应用成本汇总。
   * @throws {Error} 本函数不主动抛异常。
   */
  function summarizeRunCosts(runs) {
    const totals = new Map();
    for (const run of Array.isArray(runs) ? runs : []) {
      for (const cost of Array.isArray(run.costs) ? run.costs : []) {
        const current = totals.get(cost.currency) || {
          total_price: 0,
          run_count: 0,
          node_count: 0
        };
        current.total_price = roundCost(current.total_price + cost.total_price);
        current.run_count += 1;
        current.node_count += cost.node_count;
        totals.set(cost.currency, current);
      }
    }
    return [...totals.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([currency, value]) => ({ currency, ...value }));
  }

  /**
   * 确定一次失败运行用于聚合的主要错误类型。
   *
   * 优先使用运行级错误；运行级错误为空时再取第一个失败节点的分类。这样每个
   * Run 只进入一个分组，占比的分母和“匹配运行”数量始终一致。
   *
   * @param {Record<string, unknown>} run - 已脱敏运行摘要。
   * @returns {string} 稳定的错误分类名称。
   * @throws {Error} 本函数不主动抛异常。
   */
  function primaryErrorCategory(run) {
    const runCategory = String(run?.error_category || "").trim();
    if (runCategory) {
      return runCategory;
    }
    const nodeCategory = Array.isArray(run?.failed_nodes)
      ? String(run.failed_nodes[0]?.error_category || "").trim()
      : "";
    return nodeCategory || "未分类运行错误";
  }

  /**
   * 按主要错误类型统计失败 Run 数量和占比。
   *
   * @param {Array<Record<string, unknown>>} runs - 已脱敏失败运行。
   * @returns {Array<{ category: string, count: number, percentage: number }>} 数量降序的错误分布。
   * @throws {Error} 本函数不主动抛异常。
   */
  function summarizeErrorCategories(runs) {
    const safeRuns = Array.isArray(runs) ? runs : [];
    const totals = new Map();
    for (const run of safeRuns) {
      const category = primaryErrorCategory(run);
      totals.set(category, (totals.get(category) || 0) + 1);
    }
    return [...totals.entries()]
      .sort(([leftCategory, leftCount], [rightCategory, rightCount]) => (
        rightCount - leftCount || leftCategory.localeCompare(rightCategory)
      ))
      .map(([category, count]) => ({
        category,
        count,
        percentage: safeRuns.length
          ? Number(((count / safeRuns.length) * 100).toFixed(1))
          : 0
      }));
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
   * @param {Array<{ currency: string, total_price: number }>} nodeCosts - 已脱敏节点成本。
   * @returns {Record<string, unknown>} 不含业务内容和原始错误的运行摘要。
   * @throws {Error} 本函数不主动抛异常。
   */
  function safeRun(run, nodes, nodeCosts = []) {
    const status = String(run.status || "");
    const rawError = run.error;
    const safe = {
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
    const costs = summarizeNodeCosts(nodeCosts);
    // 为兼容现有日志报告，没有价格记录时不增加空字段；成本模式仍会把该
    // 运行计入“无成本记录”，从而让覆盖情况可见。
    if (costs.length) {
      safe.costs = costs;
    }
    return safe;
  }

  /**
   * 深拷贝一个已经脱敏的 JSON 对象，避免调用方修改缓存中的共享引用。
   *
   * @param {unknown} value - 只允许传入已经白名单化、可 JSON 序列化的数据。
   * @returns {unknown} 与缓存对象断开引用的副本。
   * @throws {Error} 数据不可序列化时 JSON 方法会抛出；当前调用点只传安全对象。
   */
  function cloneSafeValue(value) {
    return JSON.parse(JSON.stringify(value));
  }

  /**
   * 生成当前 App 内某个 Run 的缓存键。
   *
   * @param {string} appId - 已验证的 Dify App UUID。
   * @param {string} runId - workflow run ID。
   * @returns {string} 只在 Service Worker 当前内存生命周期内使用的键。
   * @throws {Error} 本函数不主动抛异常。
   */
  function safeCacheKey(appId, runId) {
    return `${appId}:${runId}`;
  }

  /**
   * 从短时内存缓存读取一个已脱敏值。
   *
   * @param {Map<string, {expiresAt: number, value: unknown}>} cache - 摘要或节点缓存。
   * @param {string} key - App 与 Run 组成的缓存键。
   * @returns {unknown|null} 命中且未过期时返回副本，否则返回 null。
   * @throws {Error} 缓存值不可克隆时抛出；当前缓存只接收白名单 JSON。
   */
  function getSafeCache(cache, key) {
    const entry = cache.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      cache.delete(key);
      return null;
    }
    // Map 的插入顺序兼作简单 LRU：命中后移到末尾，优先保留常用 Run。
    cache.delete(key);
    cache.set(key, entry);
    return cloneSafeValue(entry.value);
  }

  /**
   * 把已脱敏值写入五分钟缓存，并限制缓存条数。
   *
   * @param {Map<string, {expiresAt: number, value: unknown}>} cache - 摘要或节点缓存。
   * @param {string} key - App 与 Run 组成的缓存键。
   * @param {unknown} value - 已经白名单化的数据。
   * @returns {void}
   * @throws {Error} value 不可克隆时抛出；当前调用点只传安全 JSON。
   */
  function setSafeCache(cache, key, value) {
    cache.delete(key);
    cache.set(key, {
      expiresAt: Date.now() + SAFE_CACHE_TTL_MS,
      value: cloneSafeValue(value)
    });
    while (cache.size > SAFE_CACHE_MAX_ENTRIES) {
      cache.delete(cache.keys().next().value);
    }
  }

  /**
   * 用列表页的安全字段补齐详情摘要中可能缺失的 conversation_id 等元数据。
   *
   * @param {Record<string, unknown>} summary - 已脱敏 Run 详情摘要。
   * @param {Record<string, unknown>} baseRecord - Advanced Chat 列表中的 Run 记录。
   * @returns {Record<string, unknown>} 仍然只包含 safeRun 白名单的合并摘要。
   * @throws {Error} 本函数不主动抛异常。
   */
  function mergeSafeRunContext(summary, baseRecord = {}) {
    const base = safeRun(baseRecord, [], []);
    const merged = { ...base, ...summary, failed_nodes: [] };
    for (const key of [
      "id",
      "conversation_id",
      "status",
      "triggered_from",
      "created_at",
      "finished_at",
      "elapsed_time",
      "total_steps",
      "total_tokens",
      "error_category"
    ]) {
      if (summary?.[key] === null || summary?.[key] === undefined || summary?.[key] === "") {
        merged[key] = base[key] ?? null;
      }
    }
    return merged;
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
   * 把一个已经脱敏的中间报告交给 Side Panel。
   *
   * @param {Function|undefined} callback - 可选流式结果回调。
   * @param {Record<string, unknown>} report - 仅含白名单字段的阶段性报告。
   * @returns {void}
   * @throws {Error} 回调异常会被吞掉，不能中断查询。
   */
  function emitPartial(callback, report) {
    if (typeof callback !== "function") {
      return;
    }
    try {
      callback(report);
    } catch (error) {
      // 侧边栏被关闭或重载时，实际只读查询仍应按既定安全边界正常收束。
    }
  }

  /**
   * 分页读取时间范围内的会话；提供用户 ID 时再严格匹配该用户。
   *
   * @param {Function} getJson - 只读 JSON 客户端。
   * @param {string} appId - Dify App UUID。
   * @param {string} userId - 可选终端用户 session ID；空字符串表示不限定用户。
   * @param {Date} start - 查询起点。
   * @param {Date} end - 查询终点。
   * @param {number} maxPages - 最大页数。
   * @param {Function|undefined} onProgress - 安全进度回调。
   * @param {boolean} filterByWindow - 是否按会话创建时间裁剪；成本交叉校验传 false。
   * @returns {Promise<{ conversations: Array<Record<string, unknown>>, pages: number, truncated: boolean }>} 匹配会话和覆盖信息。
   * @throws {Error} getJson 的安全错误原样抛出。
   */
  async function fetchConversations(
    getJson,
    appId,
    userId,
    start,
    end,
    maxPages,
    onProgress,
    filterByWindow = true
  ) {
    const conversations = [];
    let pages = 0;
    let truncated = false;

    for (let page = 1; page <= maxPages; page += 1) {
      const params = {
        page,
        limit: PAGE_LIMIT,
        sort_by: "-created_at",
        annotation_status: "all"
      };
      // 成本查询用用户 ID 交叉核验一个明确 Conversation。该 Conversation
      // 可能早于本次成本时间窗创建，所以核验时不能用创建时间误删它。
      if (filterByWindow) {
        params.start = formatConsoleMinute(start);
        params.end = formatConsoleMinute(end);
      }
      // keyword 在 Dify 端是模糊搜索，只在用户确实提供 ID 时发送；
      // 返回后仍做完整 ID 严格比较。未提供 ID 时则扫描时间窗内的会话。
      if (userId) {
        params.keyword = userId;
      }
      const payload = await getJson(appPath(appId, "chat-conversations"), params);
      pages += 1;
      const items = extractItems(payload);
      conversations.push(...items.filter((item) => (
        (!userId || String(item.from_end_user_session_id ?? "") === userId)
        && (!filterByWindow || inWindow(item, start, end))
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
   * 读取一个 Run 的详情并立即缩减为白名单摘要。
   *
   * @param {Function} getJson - 只读 JSON 客户端。
   * @param {string} appId - Dify App UUID。
   * @param {string} runId - workflow run ID。
   * @param {Record<string, unknown>} baseRecord - 可选列表页安全元数据。
   * @returns {Promise<Record<string, unknown>>} 不含原始错误和业务正文的摘要。
   * @throws {QueryError} Run 详情结构无法识别时抛出。
   */
  async function loadSafeRunSummary(getJson, appId, runId, baseRecord = {}) {
    const key = safeCacheKey(appId, runId);
    const cached = getSafeCache(safeRunSummaryCache, key);
    if (cached) {
      return mergeSafeRunContext(cached, baseRecord);
    }

    const encodedRunId = encodeURIComponent(runId);
    const detailPayload = await getJson(appPath(appId, `workflow-runs/${encodedRunId}`));
    const detail = detailPayload && typeof detailPayload === "object" && detailPayload.data
      && typeof detailPayload.data === "object" && !Array.isArray(detailPayload.data)
      ? detailPayload.data
      : detailPayload;
    if (!detail || typeof detail !== "object" || Array.isArray(detail)) {
      throw new QueryError("workflow run 详情格式无法识别。", "INVALID_RUN_DETAIL");
    }

    // 合并只发生在 safeRun 之后；即便列表和详情含 inputs/outputs，也不会进入缓存。
    const summary = mergeSafeRunContext(safeRun(detail, [], []), baseRecord);
    setSafeCache(safeRunSummaryCache, key, summary);
    return cloneSafeValue(summary);
  }

  /**
   * 读取一个 Run 的节点执行，并只缓存失败节点白名单和按币种汇总的成本。
   *
   * @param {Function} getJson - 只读 JSON 客户端。
   * @param {string} appId - Dify App UUID。
   * @param {string} runId - workflow run ID。
   * @returns {Promise<{failed_nodes: Array<Record<string, unknown>>, costs: Array<Record<string, unknown>>}>} 脱敏节点信息。
   * @throws {Error} getJson 的安全错误原样抛出。
   */
  async function loadSafeRunNodes(getJson, appId, runId) {
    const key = safeCacheKey(appId, runId);
    const cached = getSafeCache(safeRunNodeCache, key);
    if (cached) {
      return cached;
    }

    const encodedRunId = encodeURIComponent(runId);
    const nodePayload = await getJson(appPath(appId, `workflow-runs/${encodedRunId}/node-executions`));
    const rawNodes = extractItems(nodePayload);
    const result = {
      failed_nodes: rawNodes.map(safeNode).filter(Boolean),
      costs: summarizeNodeCosts(rawNodes.map(safeNodeCost).filter(Boolean))
    };
    setSafeCache(safeRunNodeCache, key, result);
    return cloneSafeValue(result);
  }

  /**
   * 合并两个已经脱敏的 Run 摘要与节点摘要。
   *
   * @param {Record<string, unknown>} summary - safeRun 生成的 Run 摘要。
   * @param {{failed_nodes?: Array<Record<string, unknown>>, costs?: Array<Record<string, unknown>>}} nodeData - 脱敏节点数据。
   * @returns {Record<string, unknown>} 可展示的完整 Run 白名单。
   * @throws {Error} 本函数不主动抛异常。
   */
  function combineSafeRun(summary, nodeData) {
    const combined = {
      ...summary,
      failed_nodes: Array.isArray(nodeData?.failed_nodes)
        ? cloneSafeValue(nodeData.failed_nodes)
        : []
    };
    if (Array.isArray(nodeData?.costs) && nodeData.costs.length) {
      combined.costs = cloneSafeValue(nodeData.costs);
    }
    return combined;
  }

  /**
   * 读取单个 Run 的摘要和节点。两条 GET 并行发出，缩短精确定位等待时间。
   *
   * @param {Function} getJson - 只读 JSON 客户端。
   * @param {string} appId - Dify App UUID。
   * @param {string} runId - workflow run ID。
   * @param {Record<string, unknown>} baseRecord - 可选列表页安全元数据。
   * @returns {Promise<Record<string, unknown>>} 完整脱敏 Run。
   * @throws {Error} 任一只读请求失败时向上抛出。
   */
  async function loadSafeRun(getJson, appId, runId, baseRecord = {}) {
    const [summary, nodeData] = await Promise.all([
      loadSafeRunSummary(getJson, appId, runId, baseRecord),
      loadSafeRunNodes(getJson, appId, runId)
    ]);
    return combineSafeRun(summary, nodeData);
  }

  const FATAL_DETAIL_CODES = new Set([
    "AUTH_EXPIRED",
    "AUTH_CONTEXT_MISSING",
    "DIFY_PAYMENT_REQUIRED",
    "QUERY_CANCELLED"
  ]);

  /**
   * 使用统一六并发池读取 Run，并把单个非致命缺口计入覆盖统计。
   *
   * @param {Array<Record<string, unknown>>} items - 至少包含 runId 的待处理项。
   * @param {Function} loader - 单项异步读取函数。
   * @param {Function|undefined} onProgress - 安全进度回调。
   * @param {Function|undefined} onItem - 单个安全结果完成后的回调。
   * @returns {Promise<{runs: Array<Record<string, unknown>>, uncoveredRunDetails: number}>} 已加载结果和缺口。
   * @throws {Error} 鉴权、402 或取消等致命错误会完整冒泡。
   */
  async function loadRunItems(items, loader, onProgress, onItem) {
    let completed = 0;
    let uncoveredRunDetails = 0;
    let fatalError = null;
    const loaded = await mapWithConcurrency(items, DETAIL_CONCURRENCY, async (item) => {
      let safeItem = null;
      // 一旦任一 worker 确认致命边界，其他 worker 不再领取新的网络请求。
      // 此时最多只有六条已经在途的只读 GET，数量仍受固定 worker 池约束。
      if (fatalError) {
        return null;
      }
      try {
        safeItem = await loader(item);
      } catch (error) {
        if (FATAL_DETAIL_CODES.has(error?.code)) {
          fatalError = fatalError || error;
        } else {
          uncoveredRunDetails += 1;
        }
      }

      completed += 1;
      emitProgress(onProgress, "details", {
        detailCompleted: completed,
        detailTotal: items.length
      });
      if (safeItem && typeof onItem === "function") {
        try {
          onItem(safeItem, {
            detailCompleted: completed,
            detailTotal: items.length,
            uncoveredRunDetails
          });
        } catch (error) {
          // 流式界面渲染只是辅助回调；异常不能破坏实际查询。
        }
      }
      return safeItem;
    });

    if (fatalError) {
      throw fatalError;
    }

    const runs = loaded.filter(Boolean);
    // Marker 命中多个 Run 时全部保留，并统一按创建时间从新到旧展示。
    runs.sort((left, right) => String(right.created_at || right.id || "").localeCompare(
      String(left.created_at || left.id || "")
    ));
    return { runs, uncoveredRunDetails };
  }

  /**
   * 读取一组 Run 的完整摘要和节点。
   *
   * @param {Function} getJson - 只读 JSON 客户端。
   * @param {string} appId - Dify App UUID。
   * @param {string[]} runIds - 去重后的 Run ID。
   * @param {Function|undefined} onProgress - 安全进度回调。
   * @param {Function|undefined} onItem - 单个结果回调。
   * @returns {Promise<{runs: Array<Record<string, unknown>>, uncoveredRunDetails: number}>} 完整脱敏 Run。
   * @throws {Error} 致命安全错误向上冒泡。
   */
  async function loadSafeRuns(getJson, appId, runIds, onProgress, onItem) {
    const items = [...new Set(runIds.map((value) => String(value || "")).filter(Boolean))]
      .map((id) => ({ id }));
    return loadRunItems(
      items,
      (item) => loadSafeRun(getJson, appId, item.id),
      onProgress,
      onItem
    );
  }

  /**
   * 初始错误聚合只读取 Run 详情，不读取节点执行。
   *
   * @param {Function} getJson - 只读 JSON 客户端。
   * @param {string} appId - Dify App UUID。
   * @param {Array<Record<string, unknown>>} records - Advanced Chat Run 列表记录。
   * @param {Function|undefined} onProgress - 安全进度回调。
   * @param {Function|undefined} onItem - 单个摘要回调。
   * @returns {Promise<{runs: Array<Record<string, unknown>>, uncoveredRunDetails: number}>} 已分类 Run。
   * @throws {Error} 致命安全错误向上冒泡。
   */
  async function loadSafeRunSummaries(getJson, appId, records, onProgress, onItem) {
    const recordById = new Map();
    for (const record of records) {
      const id = firstString(record, ["id", "workflow_run_id"]);
      if (id && !recordById.has(id)) {
        recordById.set(id, record);
      }
    }
    const items = [...recordById.entries()].map(([id, record]) => ({ id, record }));
    return loadRunItems(
      items,
      (item) => loadSafeRunSummary(getJson, appId, item.id, item.record),
      onProgress,
      onItem
    );
  }

  /**
   * 成本模式直接使用列表页 Run 元数据并读取节点价格，跳过 Run 详情 GET。
   *
   * @param {Function} getJson - 只读 JSON 客户端。
   * @param {string} appId - Dify App UUID。
   * @param {Array<Record<string, unknown>>} records - Advanced Chat Run 列表记录。
   * @param {Function|undefined} onProgress - 安全进度回调。
   * @param {Function|undefined} onItem - 单个成本 Run 回调。
   * @returns {Promise<{runs: Array<Record<string, unknown>>, uncoveredRunDetails: number}>} 成本 Run。
   * @throws {Error} 致命安全错误向上冒泡。
   */
  async function loadSafeCostRuns(getJson, appId, records, onProgress, onItem) {
    const recordById = new Map();
    for (const record of records) {
      const id = firstString(record, ["id", "workflow_run_id"]);
      if (id && !recordById.has(id)) {
        recordById.set(id, record);
      }
    }
    const items = [...recordById.entries()].map(([id, record]) => ({ id, record }));
    return loadRunItems(
      items,
      async (item) => combineSafeRun(
        safeRun(item.record, [], []),
        await loadSafeRunNodes(getJson, appId, item.id)
      ),
      onProgress,
      onItem
    );
  }

  /**
   * 分页读取 Advanced Chat 运行，并按可选状态、窗口与会话筛选。
   *
   * @param {Function} getJson - 只读 JSON 客户端。
   * @param {string} appId - Dify App UUID。
   * @param {Set<string>|null} allowedConversationIds - 用户模式的允许会话集合；应用模式传 null。
   * @param {string|null} status - 失败排查传 failed；成本查询传 null 读取全部状态。
   * @param {Date} start - 查询起点。
   * @param {Date} end - 查询终点。
   * @param {number} maxPages - 最大页数。
   * @param {Function|undefined} onProgress - 安全进度回调。
   * @returns {Promise<Record<string, unknown>>} 原始记录 ID 与覆盖统计，不含业务内容。
   * @throws {Error} getJson 的安全错误原样抛出。
   */
  async function fetchWorkflowRuns(
    getJson,
    appId,
    allowedConversationIds,
    status,
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
        limit: PAGE_LIMIT
      };
      // 失败排查显式发送 failed；成本查询不发送 status，确保成功和失败运行
      // 都会进入时间窗，否则成本汇总会天然漏掉大多数正常调用。
      if (status) {
        params.status = status;
      }
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

      emitProgress(onProgress, status ? "failed-runs" : "workflow-runs", status
        ? { failedRunPages: pages, failedListRecords: records.length }
        : { workflowRunPages: pages, workflowListRecords: records.length });

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
    const hasTimeWindow = input.start && input.end;
    return {
      tool: "dify-log-query-analysis",
      read_only: true,
      partial: Boolean(input.partial),
      mode: input.mode,
      app_id: input.appId,
      user: input.userId || null,
      window: hasTimeWindow ? {
        start: formatShanghaiIso(input.start),
        end: formatShanghaiIso(input.end),
        timezone: SHANGHAI_TIMEZONE
      } : null,
      coverage_note: input.mode === "run-id"
        ? "已按完整 Run ID 直接读取该次运行，不经过用户、关键词或时间范围筛选。"
        : input.mode === "cost"
          ? "成本只汇总指定 Conversation 在时间窗内的 Run，来自节点执行元数据，并按接口返回的原币种分别展示；不同币种不会换算或混合相加。"
          : "零匹配仅表示本应用、时间窗、筛选条件和分页覆盖内未匹配，不能扩大为线上没有失败。",
      summary: input.summary
    };
  }

  /**
   * 按创建时间倒序复制 Run 列表，供流式快照稳定展示。
   *
   * @param {Array<Record<string, unknown>>} runs - 已脱敏 Run。
   * @returns {Array<Record<string, unknown>>} 不修改原数组的倒序副本。
   * @throws {Error} 本函数不主动抛异常。
   */
  function sortedSafeRuns(runs) {
    return [...runs].sort((left, right) => String(
      right.created_at || right.id || ""
    ).localeCompare(String(left.created_at || left.id || "")));
  }

  /**
   * 用户点击某个错误分类后，按允许的 Run ID 加载节点明细。
   *
   * 该入口仍只返回 query-engine 白名单字段。正常情况下 Run 摘要会命中初始
   * 聚合阶段的五分钟缓存，因此这里只新增节点执行 GET。
   *
   * @param {{getJson: Function, appId: string, runIds: string[], onProgress?: Function}} options - 后台验证后的有限参数。
   * @returns {Promise<{runs: Array<Record<string, unknown>>, uncovered_run_details: number}>} 分类下的脱敏 Run 明细。
   * @throws {QueryError|Error} 输入无效或只读请求失败时抛出。
   */
  async function loadErrorCategory(options = {}) {
    if (typeof options.getJson !== "function") {
      throw new QueryError("缺少只读查询客户端。", "INVALID_CLIENT");
    }
    const appId = String(options.appId || "").trim();
    if (!UUID_PATTERN.test(appId)) {
      throw new QueryError("当前页面没有有效的 Dify App ID。", "INVALID_APP");
    }
    const runIds = [...new Set((Array.isArray(options.runIds) ? options.runIds : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean))];
    if (!runIds.length) {
      return { runs: [], uncovered_run_details: 0 };
    }
    const result = await loadSafeRuns(
      options.getJson,
      appId,
      runIds,
      options.onProgress
    );
    return {
      runs: result.runs,
      uncovered_run_details: result.uncoveredRunDetails
    };
  }

  /**
   * 执行用户失败、应用失败、对话特征文本定位、Run ID 直查或成本汇总。
   *
   * @param {{ getJson: Function, appId: string, mode: string, userId?: string, conversationId?: string, marker?: string, runId?: string, start?: string|Date|number, end?: string|Date|number, maxPages?: number, onProgress?: Function, onPartial?: Function }} options - 结构化查询参数。
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
    if (!["user-failed", "app-failed", "marker", "run-id", "cost"].includes(mode)) {
      throw new QueryError("请选择有效的查询模式。", "INVALID_MODE");
    }

    const userId = String(options.userId || "").trim();
    const conversationId = String(options.conversationId || "").trim();
    const marker = String(options.marker || "").trim();
    const runId = String(options.runId || "").trim();
    if (mode === "user-failed" && !userId) {
      throw new QueryError("该查询模式必须填写用户 ID。", "MISSING_USER_ID");
    }
    if (mode === "marker" && !marker) {
      throw new QueryError("精确诊断必须填写 marker。", "MISSING_MARKER");
    }
    if (mode === "run-id" && !runId) {
      throw new QueryError("请填写完整的 Run ID。", "MISSING_RUN_ID");
    }
    if (mode === "cost" && !conversationId) {
      throw new QueryError("查询成本必须填写完整的 Conversation ID。", "MISSING_CONVERSATION_ID");
    }

    // Run ID 已经唯一指向一次运行，因此无需先扫描用户会话或时间窗口。
    // 这里仍复用同一条白名单详情链路，读取 run 详情与失败节点后立即脱敏。
    if (mode === "run-id") {
      emitProgress(options.onProgress, "start", { directRun: 1 });
      const run = await loadSafeRun(options.getJson, appId, runId);
      emitProgress(options.onProgress, "details", { detailCompleted: 1, detailTotal: 1 });
      emitProgress(options.onProgress, "complete", { matchedRuns: 1 });
      return buildReport({
        mode,
        appId,
        userId: null,
        start: null,
        end: null,
        summary: {
          direct_run_lookup: true,
          uncovered_run_details: 0,
          matched_runs: 1,
          runs: [run]
        }
      });
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

    const skipsConversationLookup = mode === "app-failed" || (mode === "cost" && !userId);
    const conversationResult = skipsConversationLookup
      ? { conversations: [], pages: 0, truncated: false }
      : await fetchConversations(
        options.getJson,
        appId,
        userId,
        start,
        end,
        maxPages,
        options.onProgress,
        // 成本场景的用户 ID 只用于确认 Conversation 归属；旧对话也可能在
        // 当前时间窗产生新 Run，因此不能按会话创建时间把它排除。
        mode !== "cost"
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

      const sortedRunIds = [...runIds].sort();
      const partialRuns = [];
      const partialStride = Math.max(1, Math.ceil(sortedRunIds.length / 20));
      const makeMarkerReport = (partial, uncoveredRunDetails) => buildReport({
        partial,
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
          uncovered_run_details: uncoveredRunDetails,
          matched_runs: sortedRunIds.length,
          loaded_runs: partialRuns.length,
          runs: sortedSafeRuns(partialRuns)
        }
      });
      emitPartial(options.onPartial, makeMarkerReport(true, 0));
      const detailResult = await loadSafeRuns(
        options.getJson,
        appId,
        sortedRunIds,
        options.onProgress,
        (safeRunItem, progress) => {
          partialRuns.push(safeRunItem);
          if (
            partialRuns.length % partialStride === 0
            || progress.detailCompleted === progress.detailTotal
          ) {
            emitPartial(
              options.onPartial,
              makeMarkerReport(true, progress.uncoveredRunDetails)
            );
          }
        }
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

    if (mode === "cost") {
      const conversationUserVerified = userId
        ? conversationResult.conversations.some((conversation) => (
          firstString(conversation, ["id", "conversation_id"]) === conversationId
        ))
        : null;
      if (userId && !conversationUserVerified) {
        throw new QueryError(
          "在当前分页覆盖内，未能确认该 Conversation ID 属于所填用户 ID。",
          "CONVERSATION_USER_NOT_VERIFIED"
        );
      }

      const workflowResult = await fetchWorkflowRuns(
        options.getJson,
        appId,
        new Set([conversationId]),
        null,
        start,
        end,
        maxPages,
        options.onProgress
      );
      const totalRuns = workflowResult.runIds.length;
      const partialRuns = [];
      const partialStride = Math.max(1, Math.ceil(totalRuns / 20));
      const makeCostReport = (partial, uncoveredRunDetails) => {
        const currentRuns = sortedSafeRuns(partialRuns);
        const pricedRuns = currentRuns.filter((run) => (
          Array.isArray(run.costs) && run.costs.length > 0
        )).length;
        return buildReport({
          partial,
          mode,
          appId,
          userId,
          start,
          end,
          summary: {
            conversation_id: conversationId,
            conversation_user_verified: conversationUserVerified,
            candidate_conversations: userId ? conversationResult.conversations.length : null,
            conversation_pages: conversationResult.pages,
            conversation_pages_truncated: conversationResult.truncated,
            queried_status: null,
            workflow_run_pages: workflowResult.pages,
            workflow_run_pages_truncated: workflowResult.truncated,
            workflow_run_window_complete: workflowResult.windowComplete,
            workflow_run_list_records: workflowResult.records.length,
            uncovered_run_details: uncoveredRunDetails,
            matched_runs: totalRuns,
            processed_runs: currentRuns.length,
            priced_runs: pricedRuns,
            unpriced_runs: currentRuns.length - pricedRuns,
            cost_by_currency: summarizeRunCosts(currentRuns),
            runs: currentRuns
          }
        });
      };
      emitPartial(options.onPartial, makeCostReport(true, 0));
      const detailResult = await loadSafeCostRuns(
        options.getJson,
        appId,
        workflowResult.records,
        options.onProgress,
        (safeRunItem, progress) => {
          partialRuns.push(safeRunItem);
          if (
            partialRuns.length % partialStride === 0
            || progress.detailCompleted === progress.detailTotal
          ) {
            emitPartial(
              options.onPartial,
              makeCostReport(true, progress.uncoveredRunDetails)
            );
          }
        }
      );
      const costByCurrency = summarizeRunCosts(detailResult.runs);
      const pricedRuns = detailResult.runs.filter((run) => (
        Array.isArray(run.costs) && run.costs.length > 0
      )).length;
      emitProgress(options.onProgress, "complete", { matchedRuns: totalRuns });

      return buildReport({
        mode,
        appId,
        userId,
        start,
        end,
        summary: {
          conversation_id: conversationId,
          conversation_user_verified: conversationUserVerified,
          candidate_conversations: userId ? conversationResult.conversations.length : null,
          conversation_pages: conversationResult.pages,
          conversation_pages_truncated: conversationResult.truncated,
          queried_status: null,
          workflow_run_pages: workflowResult.pages,
          workflow_run_pages_truncated: workflowResult.truncated,
          workflow_run_window_complete: workflowResult.windowComplete,
          workflow_run_list_records: workflowResult.records.length,
          uncovered_run_details: detailResult.uncoveredRunDetails,
          matched_runs: totalRuns,
          processed_runs: detailResult.runs.length,
          priced_runs: pricedRuns,
          unpriced_runs: detailResult.runs.length - pricedRuns,
          cost_by_currency: costByCurrency,
          runs: detailResult.runs
        }
      });
    }

    const allowedConversationIds = mode === "user-failed"
      ? new Set(conversationResult.conversations
        .map((conversation) => firstString(conversation, ["id", "conversation_id"]))
        .filter(Boolean))
      : null;
    const failedResult = await fetchWorkflowRuns(
      options.getJson,
      appId,
      allowedConversationIds,
      "failed",
      start,
      end,
      maxPages,
      options.onProgress
    );
    const totalRuns = failedResult.runIds.length;
    const partialRuns = [];
    const partialStride = Math.max(1, Math.ceil(totalRuns / 20));
    const makeFailureReport = (partial, uncoveredRunDetails) => {
      const classifiedRuns = sortedSafeRuns(partialRuns);
      return buildReport({
        partial,
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
          uncovered_run_details: uncoveredRunDetails,
          matched_runs: totalRuns,
          classified_runs: classifiedRuns.length,
          errors_by_category: summarizeErrorCategories(classifiedRuns),
          runs: classifiedRuns
        }
      });
    };
    emitPartial(options.onPartial, makeFailureReport(true, 0));
    const detailResult = await loadSafeRunSummaries(
      options.getJson,
      appId,
      failedResult.records,
      options.onProgress,
      (safeRunItem, progress) => {
        partialRuns.push(safeRunItem);
        if (
          partialRuns.length % partialStride === 0
          || progress.detailCompleted === progress.detailTotal
        ) {
          emitPartial(
            options.onPartial,
            makeFailureReport(true, progress.uncoveredRunDetails)
          );
        }
      }
    );
    emitProgress(options.onProgress, "complete", { matchedRuns: totalRuns });

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
        matched_runs: totalRuns,
        classified_runs: detailResult.runs.length,
        errors_by_category: summarizeErrorCategories(detailResult.runs),
        runs: detailResult.runs
      }
    });
  }

  const api = {
    QueryError,
    buildTimeWindow,
    classifyError,
    isAllowedConsoleUrl,
    loadErrorCategory,
    parseDifyLogsUrl,
    queryLogs,
    safeRun
  };

  globalScope.DifyLogQueryEngine = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
