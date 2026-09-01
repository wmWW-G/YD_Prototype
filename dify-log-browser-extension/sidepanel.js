/* global chrome, DifyLogQueryEngine, document, crypto */

/**
 * TokenMind Dify 日志查询 Side Panel。
 *
 * Side Panel 只负责收集结构化条件和渲染后台已经脱敏的白名单字段。
 * 它不直接访问网络，也不接受或生成任意 URL、请求头和 HTTP 动作。
 */

"use strict";

const engine = globalThis.DifyLogQueryEngine;

/**
 * 四个入口分别对应四个独立查询场景。
 *
 * 把场景配置集中在这里，可以保证首页文案、详情页标题和必填字段始终一致，
 * 避免以后新增字段时又把所有条件堆回同一个页面。
 */
const SCENARIO_CONFIG = {
  "user-failed": {
    title: "查指定用户的失败",
    description: "输入终端用户 ID，再选择时间范围。",
    needsUser: true,
    needsMarker: false
  },
  "app-failed": {
    title: "查当前 App 的失败",
    description: "选择时间范围即可，不限定用户。",
    needsUser: false,
    needsMarker: false
  },
  marker: {
    title: "精确定位一次运行",
    description: "选择按对话内容查找，或者直接粘贴 Run ID。",
    needsUser: true,
    needsMarker: true
  },
  cost: {
    title: "查询成本",
    description: "填写 Conversation ID，用户 ID 可选用于严格校验，再选择时间范围。",
    needsUser: true,
    needsMarker: false
  }
};

const elements = {
  advancedSection: document.getElementById("advanced-section"),
  appId: document.getElementById("app-id"),
  authGuidance: document.getElementById("auth-guidance"),
  backButton: document.getElementById("back-button"),
  cancelQueryButton: document.getElementById("cancel-query-button"),
  conversationField: document.getElementById("conversation-field"),
  conversationId: document.getElementById("conversation-id"),
  costSummary: document.getElementById("cost-summary"),
  coverageBadge: document.getElementById("coverage-badge"),
  coverageCards: document.getElementById("coverage-cards"),
  coverageNote: document.getElementById("coverage-note"),
  coverageRegion: document.getElementById("coverage-region"),
  customTimeFields: document.getElementById("custom-time-fields"),
  emptyStateCopy: document.getElementById("empty-state-copy"),
  emptyStateTitle: document.getElementById("empty-state-title"),
  emptyState: document.getElementById("empty-state"),
  endTime: document.getElementById("end-time"),
  errorSummary: document.getElementById("error-summary"),
  form: document.getElementById("query-form"),
  formError: document.getElementById("form-error"),
  homeView: document.getElementById("home-view"),
  locatorHelp: document.getElementById("locator-help"),
  locatorLabel: document.getElementById("locator-label"),
  locatorModeField: document.getElementById("locator-mode-field"),
  marker: document.getElementById("marker"),
  markerField: document.getElementById("marker-field"),
  maxPages: document.getElementById("max-pages"),
  pageGuidance: document.getElementById("page-guidance"),
  pageStatus: document.getElementById("page-status"),
  pageStatusText: document.getElementById("page-status-text"),
  progressDetail: document.getElementById("progress-detail"),
  queryProgress: document.getElementById("query-progress"),
  progressRegion: document.getElementById("progress-region"),
  progressTitle: document.getElementById("progress-title"),
  queryButton: document.getElementById("query-button"),
  refreshAuthButton: document.getElementById("refresh-auth-button"),
  reloadContextButton: document.getElementById("reload-context-button"),
  resultsRegion: document.getElementById("results-region"),
  resultsTitle: document.getElementById("results-title"),
  runCount: document.getElementById("run-count"),
  runList: document.getElementById("run-list"),
  scenarioDescription: document.getElementById("scenario-description"),
  scenarioTitle: document.getElementById("scenario-title"),
  scenarioView: document.getElementById("scenario-view"),
  startTime: document.getElementById("start-time"),
  timeFieldset: document.getElementById("time-fieldset"),
  userField: document.getElementById("user-field"),
  userHelp: document.getElementById("user-help"),
  userId: document.getElementById("user-id"),
  userLabel: document.getElementById("user-label"),
  windowSummary: document.getElementById("window-summary")
};

const state = {
  context: null,
  busy: false,
  activeQueryId: null,
  activeScenario: null,
  reportQueryId: null,
  latestReport: null,
  categoryDetails: new Map(),
  categoryLoading: new Set(),
  categoryLoadedCounts: new Map(),
  categoryUncovered: new Map(),
  openCategories: new Set(),
  hasRenderedPartial: false
};

/**
 * 读取指定单选组当前值。
 *
 * @param {string} name - radio 的 name。
 * @returns {string} 已选值；没有选择时返回空字符串。
 * @throws {Error} 本函数不主动抛异常。
 */
function selectedRadioValue(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value || "";
}

/**
 * 安全创建一个只包含文本的 DOM 元素。
 *
 * @param {string} tagName - HTML 标签名。
 * @param {string} className - 可选 CSS 类名。
 * @param {unknown} text - 作为 textContent 插入的值。
 * @returns {HTMLElement} 新建元素。
 * @throws {Error} tagName 非法时由浏览器抛出。
 */
function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  element.textContent = text === null || text === undefined || text === "" ? "—" : String(text);
  return element;
}

/**
 * 格式化数字，空值显示破折号。
 *
 * @param {unknown} value - 数字候选值。
 * @param {string} suffix - 可选单位。
 * @returns {string} 可展示文本。
 * @throws {Error} 本函数不主动抛异常。
 */
function displayNumber(value, suffix = "") {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toLocaleString("zh-CN")}${suffix}` : "—";
}

/**
 * 格式化耗时字段。
 *
 * @param {unknown} value - Dify elapsed_time 值，通常为秒。
 * @returns {string} 带秒单位的安全文本。
 * @throws {Error} 本函数不主动抛异常。
 */
function displayDuration(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(number < 10 ? 2 : 1)} 秒` : "—";
}

/**
 * 格式化成本数字，兼顾总额和模型调用常见的小数单价。
 *
 * @param {unknown} value - 成本数字候选值。
 * @returns {string} 最多十二位小数的本地化文本。
 * @throws {Error} 本函数不主动抛异常。
 */
function displayCost(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString("zh-CN", { maximumFractionDigits: 12 })
    : "—";
}

/**
 * 把常见币种显示为中文名称，同时保留原始代码。
 *
 * 未知币种直接显示大写代码，避免把未来出现的币种遗漏或误判成美元。
 *
 * @param {unknown} value - 查询引擎返回的安全币种代码。
 * @returns {string} 面向用户的币种名称。
 * @throws {Error} 本函数不主动抛异常。
 */
function displayCurrency(value) {
  const currency = String(value || "").toUpperCase();
  const labels = {
    USD: "美元（USD）",
    RMB: "人民币（RMB）",
    CNY: "人民币（CNY）"
  };
  return labels[currency] || currency || "未知币种";
}

/**
 * 把一次运行可能包含的多个原币种成本串成简短文本。
 *
 * @param {Array<Record<string, unknown>>} costs - 单次运行的成本汇总。
 * @returns {string} 例如 `0.003 USD · 0.5 RMB`；没有记录返回破折号。
 * @throws {Error} 本函数不主动抛异常。
 */
function displayRunCosts(costs) {
  if (!Array.isArray(costs) || !costs.length) {
    return "—";
  }
  return costs
    .map((cost) => `${displayCost(cost.total_price)} ${cost.currency}`)
    .join(" · ");
}

/**
 * 确定运行在错误聚合中所属的唯一分类。
 *
 * @param {Record<string, unknown>} run - 已脱敏运行摘要。
 * @returns {string} 运行级错误、首个失败节点错误或未分类兜底。
 * @throws {Error} 本函数不主动抛异常。
 */
function runErrorCategory(run) {
  return String(
    run?.error_category
    || (Array.isArray(run?.failed_nodes) ? run.failed_nodes[0]?.error_category : "")
    || "未分类运行错误"
  );
}

/**
 * 显示或清空表单错误。
 *
 * @param {unknown} message - 面向用户的安全错误或状态文本。
 * @param {"error"|"info"} kind - 提示语义；取消属于普通状态而不是错误。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function setFormError(message, kind = "error") {
  const text = String(message || "").trim();
  elements.formError.textContent = text;
  elements.formError.dataset.kind = kind;
  elements.formError.hidden = !text;
}

/**
 * 统一更新查询按钮和刷新按钮的忙碌状态。
 *
 * @param {boolean} busy - 是否正在查询或刷新。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function setBusy(busy) {
  state.busy = busy;
  const canCancel = busy && Boolean(state.activeQueryId);
  elements.queryButton.disabled = busy || !state.activeScenario || !state.context?.hasAuthContext;
  elements.backButton.disabled = busy;
  elements.cancelQueryButton.hidden = !canCancel;
  elements.cancelQueryButton.disabled = !canCancel;
  elements.cancelQueryButton.textContent = "取消";
  elements.refreshAuthButton.disabled = busy || !state.context;
  elements.reloadContextButton.disabled = busy;
  elements.queryButton.querySelector(".button-label").textContent = busy ? "正在查询…" : "开始查询";
}

/**
 * 根据当前模式切换用户 ID 与 marker 输入。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function syncModeFields() {
  const config = SCENARIO_CONFIG[state.activeScenario];
  const isLocatorScenario = state.activeScenario === "marker";
  const isCostScenario = state.activeScenario === "cost";
  const locatorMode = selectedRadioValue("locator-mode") || "marker";
  const usesRunId = isLocatorScenario && locatorMode === "run-id";
  const showsUser = Boolean(config?.needsUser) && !usesRunId;
  const requiresUser = state.activeScenario === "user-failed";
  const needsMarker = Boolean(config?.needsMarker);

  elements.locatorModeField.hidden = !isLocatorScenario;
  elements.userField.hidden = !showsUser;
  elements.userId.required = requiresUser;
  elements.conversationField.hidden = !isCostScenario;
  elements.conversationId.required = isCostScenario;
  elements.markerField.hidden = !needsMarker;
  elements.marker.required = needsMarker;
  elements.timeFieldset.hidden = usesRunId;
  elements.advancedSection.hidden = usesRunId;

  if (usesRunId) {
    elements.locatorLabel.textContent = "Run ID";
    elements.marker.placeholder = "粘贴完整 Run ID";
    elements.locatorHelp.textContent = "直接读取这一次运行，无需填写用户 ID 或时间范围。";
  } else {
    elements.locatorLabel.textContent = "对话关键词或特征文本";
    elements.marker.placeholder = "输入一句有辨识度的对话原文";
    elements.locatorHelp.textContent = "匹配到多个 Run 时会全部列出，并按创建时间从新到旧排列。";
  }

  if (isCostScenario) {
    elements.userLabel.textContent = "终端用户 ID（可选）";
    elements.userId.placeholder = "有的话可填写完整用户 ID";
    elements.userHelp.textContent = "填写后会严格确认该 Conversation 是否属于这个用户。";
  } else if (isLocatorScenario && !usesRunId) {
    elements.userLabel.textContent = "终端用户 ID（可选）";
    elements.userId.placeholder = "有的话可填写完整用户 ID";
    elements.userHelp.textContent = "不填写时会在所选时间范围内查找；填写后可缩小范围。";
  } else {
    elements.userLabel.textContent = "终端用户 ID";
    elements.userId.placeholder = "输入完整用户 ID";
    elements.userHelp.textContent = "搜索候选后，插件会再次严格比对完整 ID。";
  }

  syncTimeFields();
  setFormError("");
}

/**
 * 从首页进入一个独立查询场景。
 *
 * @param {string} scenario - SCENARIO_CONFIG 中定义的场景代码。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常；未知场景会被安全忽略。
 */
function selectScenario(scenario) {
  const config = SCENARIO_CONFIG[scenario];
  if (!config || state.busy) {
    return;
  }

  state.activeScenario = scenario;
  elements.scenarioTitle.textContent = config.title;
  elements.scenarioDescription.textContent = config.description;
  elements.homeView.hidden = true;
  elements.scenarioView.hidden = false;

  // 每次进入场景都从干净的反馈状态开始，但保留用户已输入的查询条件，
  // 这样误触返回后不需要重新粘贴较长的用户 ID 或 marker。
  elements.progressRegion.hidden = true;
  elements.coverageRegion.hidden = true;
  elements.resultsRegion.hidden = true;
  setFormError("");
  syncModeFields();
  setBusy(false);
  elements.scenarioView.scrollIntoView({ block: "start" });
}

/**
 * 返回场景首页。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function returnHome() {
  if (state.busy) {
    return;
  }

  state.activeScenario = null;
  elements.scenarioView.hidden = true;
  elements.homeView.hidden = false;
  elements.progressRegion.hidden = true;
  elements.coverageRegion.hidden = true;
  elements.resultsRegion.hidden = true;
  setFormError("");
  syncModeFields();
  setBusy(false);
  elements.homeView.scrollIntoView({ block: "start" });
}

/**
 * 根据当前时间选项显示自定义时间输入，并填入合理默认值。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function syncTimeFields() {
  const usesRunId = state.activeScenario === "marker"
    && selectedRadioValue("locator-mode") === "run-id";
  const isCustom = !usesRunId && selectedRadioValue("preset") === "custom";
  elements.customTimeFields.hidden = !isCustom;
  elements.startTime.required = isCustom;
  elements.endTime.required = isCustom;

  if (isCustom && (!elements.startTime.value || !elements.endTime.value)) {
    const now = new Date();
    const start = new Date(now.getTime() - 60 * 60 * 1000);
    const toShanghaiLocal = (date) => engine.buildTimeWindow(
      { preset: "recent-1h" },
      date
    ).end.slice(0, 16);
    elements.startTime.value = toShanghaiLocal(start);
    elements.endTime.value = toShanghaiLocal(now);
  }
  setFormError("");
}

/**
 * 向后台发送扩展内部消息并统一处理安全错误结构。
 *
 * @param {Record<string, unknown>} message - 仅包含结构化查询字段的消息。
 * @returns {Promise<Record<string, unknown>>} 后台成功响应。
 * @throws {Error} Chrome 通道或后台返回错误时抛出仅含安全文本的异常。
 */
async function sendExtensionMessage(message) {
  let response;
  try {
    response = await chrome.runtime.sendMessage(message);
  } catch (error) {
    throw new Error("扩展后台暂时不可用，请重新打开侧边栏。", { cause: error });
  }
  if (!response?.ok) {
    const safeError = new Error(response?.error?.message || "查询失败，请稍后重试。");
    safeError.code = response?.error?.code || "QUERY_ERROR";
    throw safeError;
  }
  return response;
}

/**
 * 把当前活动标签页状态渲染到顶部上下文卡片。
 *
 * @param {Record<string, unknown>|null} context - 后台验证后的 Dify 日志页上下文。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function renderContext(context) {
  state.context = context;

  if (!context) {
    elements.appId.textContent = "未识别";
    elements.pageStatus.dataset.status = "error";
    elements.pageStatusText.textContent = "页面不匹配";
    elements.pageGuidance.textContent = "请先打开 Dify Cloud 中某个 App 的日志页面。";
    elements.pageGuidance.hidden = false;
    elements.authGuidance.hidden = true;
    setBusy(false);
    return;
  }

  elements.appId.textContent = context.appId;
  elements.pageGuidance.hidden = true;
  elements.pageStatus.dataset.status = context.hasAuthContext ? "ready" : "waiting";
  elements.pageStatusText.textContent = context.hasAuthContext ? "登录态就绪" : "等待登录态";
  elements.authGuidance.hidden = Boolean(context.hasAuthContext);
  setBusy(false);
}

/**
 * 重新向后台读取当前活动 Dify 日志页。
 *
 * @returns {Promise<void>} 上下文渲染结束时完成。
 * @throws {Error} 错误在函数内转换为页面提示，不继续抛出。
 */
async function loadActiveContext() {
  try {
    const response = await sendExtensionMessage({ type: "GET_ACTIVE_CONTEXT" });
    renderContext(response.context);
  } catch (error) {
    renderContext(null);
    setFormError(error.message);
  }
}

/**
 * 用户切换到另一个 Dify 日志标签页后，重新读取当前活动页面。
 *
 * 这个动作只调用 GET_ACTIVE_CONTEXT，不刷新网页，也不读取 Cookie；它解决
 * Side Panel 保持打开时上下文不会自动随活动标签页变化的问题。
 *
 * @returns {Promise<void>} 新页面上下文渲染完成时结束。
 * @throws {Error} 所有错误均转换为页面提示，不继续抛出。
 */
async function handleReloadContext() {
  if (state.busy) {
    return;
  }

  setFormError("");
  elements.progressRegion.hidden = true;
  elements.coverageRegion.hidden = true;
  elements.resultsRegion.hidden = true;
  elements.reloadContextButton.textContent = "读取中…";
  setBusy(true);

  try {
    const response = await sendExtensionMessage({ type: "GET_ACTIVE_CONTEXT" });
    renderContext(response.context);
  } catch (error) {
    renderContext(null);
    setFormError(error.message);
  } finally {
    elements.reloadContextButton.textContent = "重新读取";
    setBusy(false);
  }
}

/**
 * 从表单创建固定字段的查询消息。
 *
 * @returns {Record<string, unknown>} 可发送给后台的结构化查询条件。
 * @throws {DifyLogQueryEngine.QueryError|Error} 输入缺失或时间错误时抛出。
 */
function buildQueryMessage() {
  if (!state.context) {
    throw new Error("请先打开有效的 Dify 日志页。");
  }

  let mode = state.activeScenario;
  if (!SCENARIO_CONFIG[mode]) {
    throw new Error("请先选择一个查询场景。");
  }
  if (mode === "marker" && selectedRadioValue("locator-mode") === "run-id") {
    mode = "run-id";
  }
  const userId = elements.userId.value.trim();
  const conversationId = elements.conversationId.value.trim();
  const locatorValue = elements.marker.value.trim();
  if (mode === "user-failed" && !userId) {
    throw new Error("请填写完整的终端用户 ID。");
  }
  if (mode === "marker" && !locatorValue) {
    throw new Error("请填写对话关键词或特征文本。");
  }
  if (mode === "run-id" && !locatorValue) {
    throw new Error("请填写完整的 Run ID。");
  }
  if (mode === "cost" && !conversationId) {
    throw new Error("请填写完整的 Conversation ID。");
  }

  const preset = mode === "run-id" ? "" : selectedRadioValue("preset");
  const window = mode === "run-id" ? null : engine.buildTimeWindow({
      preset,
      start: elements.startTime.value,
      end: elements.endTime.value
    });
  const maxPages = Number(elements.maxPages.value);
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 100) {
    throw new Error("最大分页数必须是 1 到 100 的整数。");
  }

  return {
    type: "RUN_QUERY",
    queryId: crypto.randomUUID(),
    tabId: state.context.tabId,
    appId: state.context.appId,
    mode,
    userId: ["app-failed", "run-id"].includes(mode) ? "" : userId,
    conversationId: mode === "cost" ? conversationId : "",
    marker: mode === "marker" ? locatorValue : "",
    runId: mode === "run-id" ? locatorValue : "",
    preset,
    start: window?.start || null,
    end: window?.end || null,
    maxPages
  };
}

/**
 * 把进度阶段转换成简短中文，不展示业务输入。
 *
 * @param {string} stage - 查询引擎阶段代码。
 * @returns {{title: string, detail: string}} 进度标题和解释。
 * @throws {Error} 本函数不主动抛异常。
 */
function progressCopy(stage) {
  const copies = {
    start: { title: "正在准备查询", detail: "已确认当前 App，开始读取只读日志索引。" },
    conversations: { title: "正在筛选用户会话", detail: "候选会话将在本地再次严格匹配用户 ID。" },
    "failed-runs": { title: "正在读取失败运行", detail: "按北京时间窗口裁剪并检查分页覆盖。" },
    "workflow-runs": { title: "正在读取运行成本", detail: "正在扫描时间范围内的全部运行，不限定成功或失败状态。" },
    details: { title: "正在读取运行详情", detail: "仅保留运行摘要与失败节点白名单字段。" },
    complete: { title: "正在整理结果", detail: "正在生成脱敏覆盖摘要。" }
  };
  return copies[stage] || { title: "正在只读查询", detail: "请保持当前 Dify 日志页面打开。" };
}

/**
 * 渲染来自后台的安全进度事件。
 *
 * @param {Record<string, unknown>} message - QUERY_PROGRESS 消息。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function renderProgress(message) {
  if (!state.busy || message.queryId !== state.activeQueryId) {
    return;
  }
  const copy = progressCopy(message.stage);
  const counts = message.counts || {};
  let current = null;
  let total = null;
  let countCopy = "";
  if (message.stage === "details") {
    current = Number(counts.detailCompleted || 0);
    total = Number(counts.detailTotal || 0);
    countCopy = total > 0 ? ` 已处理 ${current}/${total}。` : "";
  } else if (message.stage === "conversations") {
    countCopy = ` 已读取 ${displayNumber(counts.conversationPages || 0)} 页，找到 ${displayNumber(counts.candidateConversations || 0)} 个候选会话。`;
  } else if (message.stage === "failed-runs") {
    countCopy = ` 已读取 ${displayNumber(counts.failedRunPages || 0)} 页，找到 ${displayNumber(counts.failedListRecords || 0)} 条失败记录。`;
  } else if (message.stage === "workflow-runs") {
    countCopy = ` 已读取 ${displayNumber(counts.workflowRunPages || 0)} 页，找到 ${displayNumber(counts.workflowListRecords || 0)} 条运行。`;
  } else if (message.stage === "complete") {
    current = 1;
    total = 1;
    countCopy = ` 已匹配 ${displayNumber(counts.matchedRuns || 0)} 个 Run。`;
  }
  elements.progressTitle.textContent = copy.title;
  elements.progressDetail.textContent = `${copy.detail}${countCopy}`;
  if (total > 0) {
    elements.queryProgress.max = total;
    elements.queryProgress.value = Math.min(total, Math.max(0, current));
  } else {
    // 不知道分页总量时保留浏览器原生不确定进度；详情阶段拿到总量后自动切换。
    elements.queryProgress.removeAttribute("value");
  }
}

/**
 * 添加一张覆盖指标卡。
 *
 * @param {DocumentFragment} fragment - 待追加的覆盖卡片容器。
 * @param {string} label - 指标名称。
 * @param {unknown} value - 已脱敏数字。
 * @returns {void}
 * @throws {Error} DOM 创建失败时由浏览器抛出。
 */
function appendCoverageCard(fragment, label, value) {
  const card = document.createElement("div");
  card.className = "coverage-card";
  card.append(createTextElement("strong", "", displayNumber(value)));
  card.append(createTextElement("span", "", label));
  fragment.append(card);
}

/**
 * 渲染按原币种拆开的成本总览。
 *
 * 每个币种独占一张卡片，界面没有“合计所有币种”的入口，避免把 USD、RMB
 * 或未来出现的币种直接相加成没有业务意义的数字。
 *
 * @param {Array<Record<string, unknown>>} entries - 查询引擎按币种汇总的安全数据。
 * @returns {void}
 * @throws {Error} DOM 创建失败时由浏览器抛出。
 */
function renderCostSummary(entries) {
  elements.costSummary.replaceChildren();
  const costs = Array.isArray(entries) ? entries : [];
  if (!costs.length) {
    elements.costSummary.append(createTextElement(
      "p",
      "cost-empty",
      "当前覆盖内没有读取到带币种的节点成本记录。"
    ));
    return;
  }

  const fragment = document.createDocumentFragment();
  costs.forEach((cost) => {
    const card = document.createElement("article");
    card.className = "cost-card";
    card.append(createTextElement("span", "cost-currency", displayCurrency(cost.currency)));
    card.append(createTextElement("strong", "cost-amount", displayCost(cost.total_price)));
    card.append(createTextElement(
      "small",
      "cost-detail",
      `${displayNumber(cost.run_count)} 个 Run · ${displayNumber(cost.node_count)} 个计费节点`
    ));
    fragment.append(card);
  });
  elements.costSummary.append(fragment);
}

/**
 * 渲染错误类型聚合；具体运行默认折叠，用户点击分类后才展开。
 *
 * @param {Array<Record<string, unknown>>} categories - 错误类型数量和占比。
 * @returns {void}
 * @throws {Error} DOM 创建失败时由浏览器抛出。
 */
function renderErrorSummary(categories) {
  elements.errorSummary.replaceChildren();
  const safeCategories = Array.isArray(categories) ? categories : [];
  const fragment = document.createDocumentFragment();

  safeCategories.forEach((category) => {
    const categoryName = String(category.category || "未分类运行错误");
    const group = document.createElement("details");
    group.className = "error-group";
    group.open = state.openCategories.has(categoryName);

    const heading = document.createElement("summary");
    heading.className = "error-group-heading";
    const copy = document.createElement("span");
    copy.className = "error-group-copy";
    copy.append(createTextElement("strong", "", categoryName));
    copy.append(createTextElement(
      "small",
      "",
      `${displayNumber(category.count)} 次 · ${displayNumber(category.percentage)}%`
    ));
    const share = document.createElement("progress");
    share.className = "error-share";
    share.max = 100;
    share.value = Math.min(100, Math.max(0, Number(category.percentage) || 0));
    share.setAttribute("aria-label", `${categoryName} 占比`);
    heading.append(copy, share);
    group.append(heading);

    const groupRuns = document.createElement("div");
    groupRuns.className = "error-run-list";
    const loadedRuns = state.categoryDetails.get(categoryName);
    const loadedCount = Number(state.categoryLoadedCounts.get(categoryName) || 0);
    const uncovered = Number(state.categoryUncovered.get(categoryName) || 0);
    if (state.categoryLoading.has(categoryName)) {
      groupRuns.append(createTextElement(
        "p",
        "category-detail-status",
        `正在加载该类型的节点明细… 已请求 ${displayNumber(category.count)} 个 Run。`
      ));
    } else if (Array.isArray(loadedRuns)) {
      if (loadedRuns.length) {
        loadedRuns.forEach((run) => groupRuns.append(createRunCard(run)));
      } else {
        groupRuns.append(createTextElement(
          "p",
          "category-detail-status",
          "已读取该类型，但没有可展示的 Run 明细。"
        ));
      }
      if (uncovered > 0) {
        groupRuns.append(createTextElement(
          "p",
          "category-detail-status",
          `${displayNumber(uncovered)} 个 Run 的节点明细未能覆盖。`
        ));
      }
    } else {
      groupRuns.append(createTextElement(
        "p",
        "category-detail-status",
        "点击展开后加载该错误类型的节点明细。"
      ));
    }
    group.append(groupRuns);
    group.addEventListener("toggle", () => {
      if (group.open) {
        state.openCategories.add(categoryName);
        if (loadedCount < Number(category.count || 0)) {
          void handleLoadErrorCategory(categoryName, Number(category.count || 0));
        }
      } else {
        state.openCategories.delete(categoryName);
      }
    });
    if (
      group.open
      && !state.categoryLoading.has(categoryName)
      && loadedCount < Number(category.count || 0)
    ) {
      void Promise.resolve().then(() => handleLoadErrorCategory(
        categoryName,
        Number(category.count || 0)
      ));
    }
    fragment.append(group);
  });

  elements.errorSummary.append(fragment);
}

/**
 * 用户展开错误分类后，请后台按当前查询会话允许的 Run ID 加载节点明细。
 *
 * Side Panel 只发送 queryId 和分类名称，不发送 URL 或任意 Run ID；后台会用
 * 自己保存的安全分类映射做二次授权。已加载 Run 会命中五分钟脱敏缓存。
 *
 * @param {string} category - 当前聚合结果中的错误分类。
 * @param {number} expectedCount - 发起请求时该分类已出现的 Run 数。
 * @returns {Promise<void>} 明细渲染或安全错误提示完成时结束。
 * @throws {Error} 错误在函数内转换为页面提示，不继续抛出。
 */
async function handleLoadErrorCategory(category, expectedCount) {
  if (
    !state.reportQueryId
    || state.categoryLoading.has(category)
    || Number(state.categoryLoadedCounts.get(category) || 0) >= expectedCount
  ) {
    return;
  }

  state.categoryLoading.add(category);
  if (state.latestReport) {
    renderReport(state.latestReport, { scroll: false });
  }
  try {
    const response = await sendExtensionMessage({
      type: "LOAD_ERROR_CATEGORY",
      queryId: state.reportQueryId,
      category
    });
    state.categoryDetails.set(category, Array.isArray(response.runs) ? response.runs : []);
    // 这里记录“后台已经尝试过的分类数量”，而不是成功返回数量。若个别 Run
    // 暂时不可读，会展示覆盖缺口，但不会形成无限自动重试。
    state.categoryLoadedCounts.set(category, expectedCount);
    state.categoryUncovered.set(category, Number(response.uncovered_run_details || 0));
  } catch (error) {
    setFormError(error.message, error.code === "QUERY_CANCELLED" ? "info" : "error");
  } finally {
    state.categoryLoading.delete(category);
    if (state.latestReport) {
      renderReport(state.latestReport, { scroll: false });
    }

    const latestCategory = state.latestReport?.summary?.errors_by_category
      ?.find((entry) => entry.category === category);
    const latestCount = Number(latestCategory?.count || 0);
    if (
      state.openCategories.has(category)
      && Number(state.categoryLoadedCounts.get(category) || 0) < latestCount
    ) {
      void handleLoadErrorCategory(category, latestCount);
    }
  }
}

/**
 * 创建一项运行元数据。
 *
 * @param {string} label - 字段名称。
 * @param {unknown} value - 脱敏字段值。
 * @returns {HTMLElement} 元数据元素。
 * @throws {Error} DOM 创建失败时由浏览器抛出。
 */
function createMetaItem(label, value) {
  const item = document.createElement("div");
  item.className = "meta-item";
  item.append(createTextElement("span", "", label));
  item.append(createTextElement("strong", "", value));
  return item;
}

/**
 * 创建一个失败节点行，只读取 query-engine 白名单字段。
 *
 * @param {Record<string, unknown>} node - 已脱敏失败节点。
 * @returns {HTMLElement} 节点行。
 * @throws {Error} DOM 创建失败时由浏览器抛出。
 */
function createNodeRow(node) {
  const row = document.createElement("div");
  row.className = "node-row";
  row.append(createTextElement("strong", "", node.title || node.node_id || "未命名失败节点"));
  row.append(createTextElement(
    "p",
    "",
    `${node.node_type || "未知类型"} · ${node.error_category || "未分类运行错误"} · ${displayDuration(node.elapsed_time)}`
  ));
  if (node.node_id) {
    row.append(createTextElement("code", "", node.node_id));
  }
  return row;
}

/**
 * 创建一张失败运行卡片，只展示白名单字段。
 *
 * @param {Record<string, unknown>} run - 已脱敏运行摘要。
 * @returns {HTMLElement} 运行卡片。
 * @throws {Error} DOM 创建失败时由浏览器抛出。
 */
function createRunCard(run) {
  const card = document.createElement("article");
  card.className = "run-card";

  const header = document.createElement("header");
  header.className = "run-card-header";
  header.append(createTextElement("code", "", run.id || "未知运行 ID"));
  header.append(createTextElement("span", "status-chip", run.status || "failed"));
  card.append(header);

  const meta = document.createElement("div");
  meta.className = "run-meta";
  meta.append(createMetaItem("错误类别", run.error_category));
  meta.append(createMetaItem("耗时", displayDuration(run.elapsed_time)));
  meta.append(createMetaItem("创建时间", run.created_at));
  meta.append(createMetaItem("结束时间", run.finished_at));
  meta.append(createMetaItem("步骤数", displayNumber(run.total_steps)));
  meta.append(createMetaItem("Token 数", displayNumber(run.total_tokens)));
  if (Array.isArray(run.costs) && run.costs.length) {
    meta.append(createMetaItem("费用", displayRunCosts(run.costs)));
  }
  meta.append(createMetaItem("触发来源", run.triggered_from));
  meta.append(createMetaItem("Conversation ID", run.conversation_id));
  card.append(meta);

  const failedNodes = Array.isArray(run.failed_nodes) ? run.failed_nodes : [];
  if (failedNodes.length) {
    const nodeSection = document.createElement("section");
    nodeSection.className = "node-section";
    nodeSection.append(createTextElement("div", "node-section-title", `失败节点 · ${failedNodes.length}`));
    failedNodes.forEach((node) => nodeSection.append(createNodeRow(node)));
    card.append(nodeSection);
  }
  return card;
}

/**
 * 渲染查询引擎返回的脱敏报告。
 *
 * @param {Record<string, unknown>} report - 只包含白名单字段和覆盖统计的报告。
 * @param {{scroll?: boolean}} options - 是否把第一次结果滚动到可见区域。
 * @returns {void}
 * @throws {Error} 报告结构异常时由调用方显示通用错误。
 */
function renderReport(report, options = {}) {
  const summary = report?.summary || {};
  const runs = Array.isArray(summary.runs) ? summary.runs : [];
  const isCost = report.mode === "cost";
  const isFailureAggregate = ["user-failed", "app-failed"].includes(report.mode);
  const isPartial = Boolean(report.partial);
  state.latestReport = report;
  const truncated = Boolean(
    summary.conversation_pages_truncated
    || summary.failed_run_pages_truncated
    || summary.workflow_run_pages_truncated
    || summary.uncovered_run_details
  );

  elements.windowSummary.textContent = report.mode === "run-id"
    ? "按完整 Run ID 直接查询"
    : report.mode === "cost"
      ? `Conversation ${summary.conversation_id || "—"} · ${report.window?.start || "—"} 至 ${report.window?.end || "—"} · Asia/Shanghai`
      : `${report.window?.start || "—"} 至 ${report.window?.end || "—"} · Asia/Shanghai`;
  elements.coverageBadge.textContent = isPartial
    ? "正在加载"
    : truncated ? "覆盖可能截断" : "当前覆盖完整";
  elements.coverageBadge.dataset.truncated = String(!isPartial && truncated);
  if (isPartial && isFailureAggregate) {
    elements.coverageNote.textContent = `已分类 ${displayNumber(summary.classified_runs || 0)}/${displayNumber(summary.matched_runs || 0)} 个 Run，错误分布会继续追加。`;
  } else if (isPartial && isCost) {
    elements.coverageNote.textContent = `已处理 ${displayNumber(summary.processed_runs || 0)}/${displayNumber(summary.matched_runs || 0)} 个 Run，成本会按原币种继续累计。`;
  } else if (isPartial && report.mode === "marker") {
    elements.coverageNote.textContent = `已加载 ${displayNumber(summary.loaded_runs || 0)}/${displayNumber(summary.matched_runs || 0)} 个匹配 Run。`;
  } else {
    elements.coverageNote.textContent = report.mode === "marker" && runs.length > 1
      ? `匹配到 ${runs.length} 个 Run，已全部列出，并按创建时间从新到旧排列。`
      : report.coverage_note || "结果仅代表当前查询覆盖。";
  }

  elements.coverageCards.replaceChildren();
  const coverageFragment = document.createDocumentFragment();
  if (isCost) {
    appendCoverageCard(coverageFragment, "发现运行", summary.matched_runs || 0);
    appendCoverageCard(coverageFragment, "已处理", summary.processed_runs ?? runs.length);
    appendCoverageCard(coverageFragment, "有成本记录", summary.priced_runs || 0);
    appendCoverageCard(coverageFragment, "无成本记录", summary.unpriced_runs || 0);
  } else if (isFailureAggregate) {
    appendCoverageCard(coverageFragment, "匹配运行", summary.matched_runs || 0);
    appendCoverageCard(coverageFragment, "已分类", summary.classified_runs ?? runs.length);
    appendCoverageCard(coverageFragment, "未覆盖详情", summary.uncovered_run_details || 0);
  } else if (report.mode === "marker") {
    appendCoverageCard(coverageFragment, "匹配运行", summary.matched_runs || 0);
    appendCoverageCard(coverageFragment, "已加载", summary.loaded_runs ?? runs.length);
    appendCoverageCard(coverageFragment, "未覆盖详情", summary.uncovered_run_details || 0);
  } else {
    appendCoverageCard(coverageFragment, "匹配运行", summary.matched_runs || 0);
    appendCoverageCard(
      coverageFragment,
      report.mode === "run-id" ? "直接读取" : report.mode === "marker" ? "会话页" : "失败运行页",
      report.mode === "run-id" ? 1 : summary.failed_run_pages ?? summary.conversation_pages ?? 0
    );
    appendCoverageCard(
      coverageFragment,
      "未覆盖详情",
      summary.uncovered_run_details || 0
    );
  }
  elements.coverageCards.append(coverageFragment);

  elements.costSummary.hidden = !isCost;
  if (isCost) {
    renderCostSummary(summary.cost_by_currency);
  } else {
    elements.costSummary.replaceChildren();
  }

  elements.runList.replaceChildren();
  elements.errorSummary.replaceChildren();
  if (isFailureAggregate && Array.isArray(summary.errors_by_category) && summary.errors_by_category.length) {
    renderErrorSummary(summary.errors_by_category);
    elements.errorSummary.hidden = false;
    elements.runList.hidden = true;
  } else {
    const runFragment = document.createDocumentFragment();
    runs.forEach((run) => runFragment.append(createRunCard(run)));
    elements.runList.append(runFragment);
    elements.errorSummary.hidden = true;
    elements.runList.hidden = false;
  }

  elements.resultsTitle.textContent = isCost
    ? "成本运行明细"
    : isFailureAggregate
      ? "错误类型分布"
      : "运行结果";
  const currentRunCount = isFailureAggregate
    ? summary.classified_runs ?? runs.length
    : isCost
      ? summary.processed_runs ?? runs.length
      : report.mode === "marker"
        ? summary.loaded_runs ?? runs.length
        : runs.length;
  elements.runCount.textContent = isPartial
    ? `${displayNumber(currentRunCount)}/${displayNumber(summary.matched_runs || 0)} 个 Run`
    : `${displayNumber(runs.length)} 个 Run`;
  elements.emptyStateTitle.textContent = isCost
    ? "当前覆盖内没有可展示的运行"
    : "在当前应用、时间窗、筛选条件和分页覆盖内未匹配";
  elements.emptyStateCopy.textContent = isCost
    ? "请确认 Conversation ID，或扩大时间范围和分页覆盖后再查。"
    : "这不代表线上没有失败，可以扩大时间范围或分页覆盖后再查。";
  elements.emptyState.hidden = isPartial || runs.length !== 0;
  elements.coverageRegion.hidden = false;
  elements.resultsRegion.hidden = false;
  if (options.scroll) {
    elements.resultsRegion.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/**
 * 提交一次显式只读查询。
 *
 * @param {SubmitEvent} event - 表单提交事件。
 * @returns {Promise<void>} 查询和渲染结束时完成。
 * @throws {Error} 所有错误均转换成界面提示，不继续抛出。
 */
async function handleQuerySubmit(event) {
  event.preventDefault();
  setFormError("");

  let message;
  try {
    message = buildQueryMessage();
  } catch (error) {
    setFormError(error.message);
    return;
  }

  state.activeQueryId = message.queryId;
  state.reportQueryId = message.queryId;
  state.latestReport = null;
  state.categoryDetails.clear();
  state.categoryLoading.clear();
  state.categoryLoadedCounts.clear();
  state.categoryUncovered.clear();
  state.openCategories.clear();
  state.hasRenderedPartial = false;
  elements.progressRegion.hidden = false;
  elements.coverageRegion.hidden = true;
  elements.resultsRegion.hidden = true;
  elements.progressTitle.textContent = "正在准备查询";
  elements.progressDetail.textContent = "正在确认当前 App 和登录状态…";
  elements.queryProgress.max = 100;
  elements.queryProgress.removeAttribute("value");
  setBusy(true);

  try {
    const response = await sendExtensionMessage(message);
    renderReport(response.report, { scroll: !state.hasRenderedPartial });
  } catch (error) {
    const cancelled = error.code === "QUERY_CANCELLED";
    setFormError(
      cancelled && state.latestReport
        ? "查询已取消，已保留当前已加载结果。"
        : error.message,
      cancelled ? "info" : "error"
    );
    if (["AUTH_CONTEXT_MISSING", "AUTH_CAPTURE_TIMEOUT", "AUTH_EXPIRED"].includes(error.code)) {
      state.context = { ...state.context, hasAuthContext: false };
      renderContext(state.context);
    }
  } finally {
    elements.progressRegion.hidden = true;
    state.activeQueryId = null;
    setBusy(false);
  }
}

/**
 * 取消当前查询，并让后台中止尚未完成的只读请求。
 *
 * @returns {Promise<void>} 后台确认收到取消信号时结束。
 * @throws {Error} 错误会转换成界面提示，不继续抛出。
 */
async function handleCancelQuery() {
  const queryId = state.activeQueryId;
  if (!state.busy || !queryId) {
    return;
  }

  elements.cancelQueryButton.disabled = true;
  elements.cancelQueryButton.textContent = "取消中…";
  elements.progressTitle.textContent = "正在取消查询";
  elements.progressDetail.textContent = "已停止继续翻页和读取后续详情。";

  try {
    const response = await sendExtensionMessage({ type: "CANCEL_QUERY", queryId });
    if (!response.cancelled) {
      setFormError("查询已经结束，无需取消。", "info");
    }
  } catch (error) {
    setFormError(error.message);
    elements.cancelQueryButton.disabled = false;
    elements.cancelQueryButton.textContent = "取消";
  }
}

/**
 * 用户明确点击后刷新当前 Dify 日志页并等待新的临时 CSRF。
 *
 * @returns {Promise<void>} 刷新完成或错误提示渲染结束时完成。
 * @throws {Error} 所有错误均转换成界面提示，不继续抛出。
 */
async function handleRefreshAuth() {
  if (!state.context) {
    return;
  }
  setFormError("");
  setBusy(true);
  elements.refreshAuthButton.textContent = "正在刷新…";
  try {
    const response = await sendExtensionMessage({
      type: "REFRESH_AUTH_CONTEXT",
      tabId: state.context.tabId
    });
    renderContext(response.context);
  } catch (error) {
    setFormError(error.message);
  } finally {
    elements.refreshAuthButton.textContent = "刷新日志页";
    setBusy(false);
  }
}

document.querySelectorAll("[data-scenario]").forEach((button) => {
  button.addEventListener("click", () => selectScenario(button.dataset.scenario));
});
elements.backButton.addEventListener("click", returnHome);
document.querySelectorAll('input[name="preset"]').forEach((input) => {
  input.addEventListener("change", syncTimeFields);
});
document.querySelectorAll('input[name="locator-mode"]').forEach((input) => {
  input.addEventListener("change", () => {
    // 两种定位值含义完全不同，切换时清空可避免把一句对话误当成 Run ID 提交。
    elements.marker.value = "";
    syncModeFields();
  });
});
elements.form.addEventListener("submit", (event) => {
  void handleQuerySubmit(event);
});
elements.refreshAuthButton.addEventListener("click", () => {
  void handleRefreshAuth();
});
elements.reloadContextButton.addEventListener("click", () => {
  void handleReloadContext();
});
elements.cancelQueryButton.addEventListener("click", () => {
  void handleCancelQuery();
});
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "QUERY_PROGRESS") {
    renderProgress(message);
    return;
  }
  if (
    message?.type === "QUERY_PARTIAL"
    && state.busy
    && message.queryId === state.activeQueryId
    && message.report
  ) {
    const shouldScroll = !state.hasRenderedPartial;
    state.hasRenderedPartial = true;
    state.reportQueryId = message.queryId;
    renderReport(message.report, { scroll: shouldScroll });
  }
});

syncModeFields();
syncTimeFields();
void loadActiveContext();
