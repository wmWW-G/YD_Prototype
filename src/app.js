/* global NAV_GROUPS, HISTORY_ITEMS, CUSTOMER_RESEARCH_FLOW, CUSTOMER_DEVELOPMENT, SALES_TABS, TRADE_STAGES, COMPANY_MODULES, PRODUCT_ROWS, CASE_CATEGORIES, CASE_ITEMS, CUSTOMERS, CUSTOMER_TIMELINE, KASS_GROUPS, KASS_FLOW_STAGES, UPGRADE_PLANS, USAGE_RECORDS, ADMIN_NAV_ITEMS, ADMIN_KNOWLEDGE_ROWS, ADMIN_USER_ROWS, ADMIN_USER_PREVIEW_METRICS, ADMIN_USER_PREVIEW_FUNCTION_SUMMARY, ADMIN_USER_PREVIEW_FIELDS, ADMIN_USER_PREVIEW_USERS, ADMIN_USER_PREVIEW_SUB_ACCOUNTS, ADMIN_INVITE_ROWS, ADMIN_CHARACTER_ROWS, ADMIN_MENU_ROWS, ADMIN_MODEL_ROWS, YD_DIFY, YD_ARTIFACT, YD_COST_MONITOR */

/**
 * 页面级状态对象。
 *
 * 为什么集中存状态：
 * - 原型虽然不接接口，但导航、标签、阶段、抽屉都需要同步变化。
 * - 集中状态可以避免多个 DOM 区域各自记一份状态，后续改动更不容易乱。
 *
 * @type {{
 *   activeMain: string,
 *   expandedGroups: Set<string>,
 *   activeSalesTab: string,
 *   activeStageId: string,
 *   activeCompanyModule: string,
 *   selectedProductId: string,
 *   activeCaseCategory: string,
 *   activeCaseTag: string,
 *   caseSearchQuery: string,
 *   activeCustomerId: string,
 *   activeCustomerPanel: string,
 *   activeKassTab: "conversation" | "profile" | "followups",
 *   activeKassView: "workbench" | "online",
 *   kassExpandedGrades: Set<string>,
 *   kassWorkbenchGroupId: string,
 *   kassCustomerDirectoryOpen: boolean,
 *   kassDirectoryGroupId: string | null,
 *   kassCustomerQuery: string,
 *   kassAgentDraft: string,
 *   kassAgentMessages: Array<{ id: string, role: "user" | "assistant", content: string }>,
 *   kassAgentThinking: boolean,
 *   kassPrototypeHydratedCustomerIds: Set<string>,
 *   kassPrototypeHydratingCustomerIds: Set<string>,
 *   kassRecordFormOpen: boolean,
 *   kassResearchOpen: boolean,
 *   kassCompletedTaskIds: Set<string>,
 *   kassAssistantOpen: boolean,
 *   customerDevPhase: "brief" | "searching" | "results" | "contacts",
 *   customerDevBrief: { market: string, product: string, role: string, quantity: string },
 *   customerDevPicker: null | "market" | "product",
 *   customerDevContinent: string,
 *   customerDevProductCategory: string,
 *   customerDevSelectedLeadId: string,
 *   customerDevRevealedEmails: Set<string>,
 *   customerDraft: string,
 *   isCustomerGenerating: boolean,
 *   customerResult: string,
 *   drawer: null | "teaching" | "history",
 *   popup: null | "attachment" | "model" | "topHistory" | "customerSettings" | "accountSettings" | "inviteRedeem",
 *   historySearchOpen: boolean,
 *   historySearchQuery: string,
 *   selectedModel: string,
 *   chatDraft: string,
 *   chatQuestion: string,
 *   isGenerating: boolean,
 *   generatedResult: string,
 *   difyFeatureConfigs: Record<string, { appType: "dialogue" | "chatflow", apiKeyDraft: string, skillKey: string, skillKeyDraft: string, hasKey: boolean, maskedKey: string, appName: string, appMode: string, loaded: boolean, loading: boolean, saving: boolean, error: string, storageReady: boolean }>,
 *   difyFeatureSessions: Record<string, { messages: Array<{ id: string, role: "user" | "assistant", content: string, status: "loading" | "error" | "done", processSteps?: object[], currentProcess?: object | null, processCollapsed?: boolean, processExpanded?: boolean, answerStarted?: boolean }>, conversationId: string, userId: string, error: string, isGenerating: boolean }>,
 *   inviteCodeDraft: string,
 *   inviteRedeemResult: string,
 *   adminInvitePreview: null | string,
 *   userPreviewFields: Set<string>,
 *   userPreviewFieldOrder: string[],
 *   userPreviewTimePreset: "today" | "week" | "month" | "custom",
 *   userPreviewStartDate: string,
 *   userPreviewEndDate: string,
 *   adminDialog: null | string,
 *   activeUserPreviewDetailId: string,
 *   activeUserPreviewOperationId: string,
 *   adminMenuOpen: boolean,
 *   adminUserFilterOpen: boolean,
 *   costMonitor: ReturnType<typeof YD_COST_MONITOR.createState>
 * }}
 */
const USER_PREVIEW_DEFAULT_FIELD_IDS = ["logIndex", "usedAt", "userContact", "lastActiveAt", "activeDays", "calledFeature", "calledModel", "callCount", "inputToken", "outputToken", "totalToken", "creditBalance", "runStatus", "estimatedCost", "operationLog", "trialDetails"];

/**
 * 客户开发搜索动画的可见时长。
 *
 * 为什么不能太短：
 * - 900ms 在页面跳转和浏览器绘制后几乎不可见，用户会误以为动画被删掉。
 * - 2.4 秒足够看清搜索状态，同时不会让静态原型显得拖沓。
 *
 * @type {number}
 */
const CUSTOMER_DEV_SEARCH_DURATION_MS = 2400;

/**
 * 所有对话功能页面共用的 Dify 配置与对话服务。
 *
 * 为什么使用两个服务端接口：
 * - Vercel 配置接口负责校验并加密保存 Key，继续复用现有 Redis 数据。
 * - Cloudflare 聊天接口负责长 SSE，避免 Vercel 300 秒函数时限中断长任务。
 * - 浏览器永远拿不到已保存的原始 Key，只能看到“已配置”和应用名称。
 *
 * @type {{ config: string, chat: string, kassCrm: string }}
 */
const DIFY_PROXY_ENDPOINTS = Object.freeze({
  config: "https://yd-prototype-dify-proxy.vercel.app/api/dify-config",
  chat: "https://yd-prototype-dify-chat.gardengaoo.workers.dev/api/dify-chat",
  kassCrm: "https://yd-prototype-dify-proxy.vercel.app/api/kass-crm"
});

/**
 * 浏览器保存 KASS 原型工作区 ID 使用的键名。
 *
 * 工作区 ID 只隔离不同浏览器的虚拟 CRM 数据，不代表真实账号，也不具备访问
 * 真实赢单接口的能力。
 *
 * @type {string}
 */
const KASS_PROTOTYPE_WORKSPACE_STORAGE_KEY = "yd-kass-prototype-workspace-id";

/**
 * A、B 两套 KASS 界面共用的 Dify 配置槽位。
 *
 * URL 的 customer-kass-a / customer-kass-b 只是 UI 方案，不能各自保存一套 Key，
 * 否则同一个 KASS Agent 会产生两份会话和配置。服务端环境变量名称因此固定为
 * DIFY_CUSTOMER_KASS_API_KEY，真实 Key 不进入浏览器源码。
 *
 * @type {string}
 */
const KASS_DIFY_FEATURE_ID = "customer-kass";

/**
 * 聊天框允许用户实际选择的两个总控模型。
 *
 * label 是产品界面展示名；value 必须严格匹配两个 Dify Chatflow 的 model_key。
 * DeepSeek 的当前路由值沿用已发布 Workflow 中的 `deepseek-v4-pro`，避免只改前端后调用落入错误分支。
 *
 * @type {ReadonlyArray<{ value: string, label: string, badge: string }>}
 */
const DIFY_CHAT_MODELS = Object.freeze([
  Object.freeze({ value: "deepseek-v4-pro", label: "DeepSeek V4 Flash", badge: "DS" }),
  Object.freeze({ value: "gemini-3.5-flash", label: "Gemini 3.5 Flash", badge: "G" })
]);

/**
 * AI 成本监控使用的两个服务端配置槽位。
 *
 * 为什么不共用一个 feature_id：两个总控 Chatflow 使用不同 App API Key，
 * 分开保存可以避免切换“含知识库 / 无知识库”时串 Key 或串 conversation_id。
 */
const COST_MONITOR_CONFIG_FEATURES = Object.freeze({
  kb: "admin-cost-kb",
  "no-kb": "admin-cost-no-kb"
});

/**
 * 成本监控的 Chatflow 来源文案。
 */
const COST_MONITOR_SOURCE_LABELS = Object.freeze({
  kb: "全技能总控（含知识库）",
  "no-kb": "无知识库总控"
});

/**
 * 根据 model_key 获取聊天框显示资料。
 *
 * @param {unknown} modelKey - 当前 state.selectedModel。
 * @returns {{ value: string, label: string, badge: string }} 已匹配的模型；无效值回退到第一项。
 * @throws {Error} 本函数不主动抛异常。
 */
function getDifyChatModel(modelKey) {
  return DIFY_CHAT_MODELS.find((model) => model.value === String(modelKey || "")) || DIFY_CHAT_MODELS[0];
}

/**
 * User Preview 报表需要横向冻结的字段。
 *
 * 为什么单独定义：
 * - 后台同事左右滑动宽表时，序号、使用时间、手机号是定位一行数据的锚点。
 * - 这 3 列固定在最左侧，可以减少横向滚动时“看不清这行是谁”的问题。
 *
 * @type {string[]}
 */
const USER_PREVIEW_FROZEN_FIELD_IDS = ["logIndex", "usedAt", "userContact"];

const state = {
  activeMain: "ask",
  expandedGroups: new Set(["deal-advisor"]),
  activeSalesTab: "flow",
  activeStageId: "lead",
  flowAi: { open: false, phase: "idle", followUp: "" },
  payCycle: "annual",
  payMethod: "wechat",
  payAgreed: true,
  payPhase: "form",
  activeCompanyModule: "tagline",
  selectedProductId: "solar-kit",
  activeCaseCategory: "client",
  activeCaseTag: "全部",
  caseSearchQuery: "",
  activeCustomerId: "kass-a-1",
  activeCustomerPanel: "overview",
  activeKassTab: "conversation",
  activeKassView: "workbench",
  kassExpandedGrades: new Set(["customer-kass-a"]),
  kassWorkbenchGroupId: "customer-kass-a",
  kassCustomerDirectoryOpen: false,
  kassDirectoryGroupId: null,
  kassCustomerQuery: "",
  kassAgentDraft: "",
  kassAgentMessages: [],
  kassAgentThinking: false,
  kassPrototypeWorkspaceId: "",
  kassPrototypeSyncing: false,
  kassPrototypeHydratedCustomerIds: new Set(),
  kassPrototypeHydratingCustomerIds: new Set(),
  kassRecordFormOpen: false,
  kassResearchOpen: false,
  kassCompletedTaskIds: new Set(),
  kassAssistantOpen: false,
  customerDevPhase: "brief",
  customerDevBrief: {
    market: "德国",
    product: "光伏组件",
    role: "EPC 承包商",
    quantity: "100"
  },
  customerDevPicker: null,
  customerDevContinent: "europe",
  customerDevProductCategory: "energy",
  customerDevSelectedLeadId: "solartech",
  customerDevRevealedEmails: new Set(),
  customerDraft: "Hi,\nWe are looking for 50,000 pcs of 500ml 不锈钢保温杯.\nPlease share price for FOB Shanghai, lead time, and MOQ.\nLogo printing needed.\nThanks.",
  isCustomerGenerating: false,
  customerResult: "",
  drawer: null,
  popup: null,
  historySearchOpen: false,
  historySearchQuery: "",
  selectedModel: "deepseek-v4-pro",
  chatDraft: "",
  chatQuestion: "",
  isGenerating: false,
  generatedResult: "",
  difyFeatureConfigs: Object.create(null),
  difyFeatureSessions: Object.create(null),
  inviteCodeDraft: "",
  inviteRedeemResult: "",
  adminInvitePreview: null,
  userPreviewFields: new Set(USER_PREVIEW_DEFAULT_FIELD_IDS),
  userPreviewFieldOrder: [...USER_PREVIEW_DEFAULT_FIELD_IDS],
  userPreviewTimePreset: "today",
  userPreviewStartDate: "2026-06-13",
  userPreviewEndDate: "2026-06-13",
  adminDialog: null,
  activeUserPreviewDetailId: "U-10001",
  activeUserPreviewOperationId: "U-10001",
  adminMenuOpen: false,
  adminUserFilterOpen: true,
  accountSpaceSwitcherOpen: false,
  activeBusinessTab: "dashboard",
  businessRole: "admin",
  businessTimePreset: "month",
  costMonitor: window.YD_COST_MONITOR.createState()
};

/**
 * 当前 toast 自动关闭计时器。
 *
 * @type {number | null}
 */
let toastTimer = null;

/**
 * Dify 流式回答的下一次页面重绘帧。
 *
 * 模型 token 可能非常密集；把同一动画帧内的多次事件合并，可以避免整页原型每个字符都重建 DOM。
 *
 * @type {number | null}
 */
let difyStreamRenderFrame = null;

/**
 * KASS Agent 流式回答的下一次局部更新帧。
 *
 * KASS 页面同时包含客户侧栏、对话和资料工作纸，不能复用普通 Dify 页的
 * activeMain 判断；单独维护帧 ID 可以把高频 token 合并，又不会影响其它对话页。
 *
 * @type {number | null}
 */
let kassStreamRenderFrame = null;

/**
 * 当前 Dify 思考耗时的每秒刷新计时器。
 *
 * 这里只更新一处文字节点，不触发 `renderApp`，避免长任务重新出现整屏闪烁。
 *
 * @type {number | null}
 */
let difyThinkingDurationTimer = null;

/**
 * AI 成本监控“实测回放”的所有计时器。
 *
 * 切换页面、切换场景或开始下一轮前必须统一清理，避免上一轮迟到事件写进新账单。
 *
 * @type {number[]}
 */
let costMonitorReplayTimers = [];

/**
 * 后台弹窗打开前的滚动位置快照。
 *
 * 为什么用 mousedown 提前记录：
 * - 浏览器可能在 click 事件前先调整滚动位置，让被点击按钮进入焦点区域。
 * - 如果 click 时才记录，拿到的已经是“跳过以后”的位置。
 *
 * @type {{ top: number, left: number } | null}
 */
let adminWorkspaceScrollSnapshot = null;

/**
 * User Preview 字段弹窗打开时的后台滚动位置。
 *
 * @type {{ top: number, left: number } | null}
 */
let userPreviewDialogWorkspaceScrollSnapshot = null;

/**
 * 生成 HTML 安全文本。
 *
 * 作用：
 * - 防止数据里的尖括号被浏览器当成 HTML 解析。
 * - 虽然当前都是本地假数据，也保持这个习惯，避免后续接接口时引入 XSS 风险。
 *
 * @param {string} value - 需要展示到页面上的原始文本。
 * @returns {string} 转义后的安全 HTML 字符串。
 * @throws {Error} 本函数不会主动抛异常；传入非字符串时会先转成字符串。
 */
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * 把普通文本转换成可以保留换行的安全 HTML。
 *
 * 作用：
 * - Dify 返回的是模型生成文本，不能直接作为 HTML 插入页面。
 * - 先用 escapeHtml 转义，再把换行换成 <br>，既安全又能保留报告段落。
 *
 * @param {string} value - 原始文本。
 * @returns {string} 可安全插入 HTML 的文本。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderMultilineText(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

/**
 * 渲染 Markdown 行内语法。
 *
 * 为什么先转义再替换：
 * - Dify 返回内容属于外部模型输出，不能直接作为 HTML 放进页面。
 * - 先转义可以挡住脚本和任意标签，再只开放少量可控 Markdown 标签。
 *
 * @param {string} value - 单行 Markdown 文本。
 * @returns {string} 安全的行内 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderInlineMarkdown(value) {
  const segments = String(value || "").split(/(`[^`]*`)/g);

  return segments.map((segment) => {
    if (segment.startsWith("`") && segment.endsWith("`") && segment.length >= 2) {
      return `<code>${escapeHtml(segment.slice(1, -1))}</code>`;
    }

    let html = escapeHtml(segment);

    // 有些模型会输出 \*\*重点\*\* 这种转义写法，先恢复常见 Markdown 转义。
    html = html.replace(/\\([*_`[\]()])/g, "$1");
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label, href) => (
      `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`
    ));
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    html = html.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    html = html.replace(/(^|[\s(])_([^_\n]+)_/g, "$1<em>$2</em>");

    return html;
  }).join("");
}

/**
 * 将 Markdown 表格的一行拆成单元格。
 *
 * 为什么不用简单的 split("|")：
 * - 行内代码可能包含竖线，例如 `a|b`，这时竖线属于内容而不是分栏符。
 * - 模型也可能输出转义竖线 `\|`，需要保留为普通字符。
 *
 * @param {string} value - Markdown 表头、分隔行或数据行。
 * @returns {string[]} 清理两侧空格后的单元格数组。
 * @throws {Error} 本函数不主动抛异常。
 */
function splitMarkdownTableRow(value) {
  let source = String(value || "").trim();
  const cells = [];
  let current = "";
  let inInlineCode = false;
  let escaped = false;

  if (source.startsWith("|")) {
    source = source.slice(1);
  }
  if (source.endsWith("|") && !source.endsWith("\\|")) {
    source = source.slice(0, -1);
  }

  for (const character of source) {
    if (escaped) {
      current += character === "|" ? "|" : `\\${character}`;
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === "`") {
      inInlineCode = !inInlineCode;
      current += character;
      continue;
    }
    if (character === "|" && !inInlineCode) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }

  if (escaped) {
    current += "\\";
  }
  cells.push(current.trim());
  return cells;
}

/**
 * 判断一行是否是 GFM 表格分隔行。
 *
 * @param {string} value - 待判断的 Markdown 行。
 * @returns {boolean} 至少两个单元格且每格符合 `---`、`:---`、`---:` 或 `:---:` 时返回 true。
 * @throws {Error} 本函数不主动抛异常。
 */
function isMarkdownTableSeparator(value) {
  const cells = splitMarkdownTableRow(value);
  return cells.length >= 2 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, "")));
}

/**
 * 把已经识别出的 Markdown 表格渲染成安全、可横向滚动的语义 HTML。
 *
 * @param {string} headerLine - 表头行。
 * @param {string} separatorLine - 包含列对齐信息的分隔行。
 * @param {string[]} rowLines - 后续数据行。
 * @returns {string} table HTML；所有单元格仍经过受控行内 Markdown 渲染和 HTML 转义。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderMarkdownTable(headerLine, separatorLine, rowLines) {
  const headers = splitMarkdownTableRow(headerLine);
  const separators = splitMarkdownTableRow(separatorLine);
  const alignments = headers.map((_header, index) => {
    const marker = String(separators[index] || "").replace(/\s+/g, "");
    if (marker.startsWith(":") && marker.endsWith(":")) return "center";
    if (marker.endsWith(":")) return "right";
    return "left";
  });
  const rows = rowLines.map((line) => {
    const cells = splitMarkdownTableRow(line);
    return headers.map((_header, index) => cells[index] || "");
  });

  return `
    <div class="yd-markdown-table-wrap" role="region" aria-label="Markdown 表格" tabindex="0">
      <table>
        <thead><tr>${headers.map((header, index) => `<th class="align-${alignments[index]}">${renderInlineMarkdown(header)}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((cells) => `<tr>${cells.map((cell, index) => `<td class="align-${alignments[index]}">${renderInlineMarkdown(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </div>
  `;
}

/**
 * 把 AI 返回的 Markdown 转成安全 HTML。
 *
 * 支持范围：
 * - 标题：# / ## / ### / ####
 * - 列表：-、*、+、1.、1)
 * - GFM 风格表格、段落、引用、分割线、代码块
 * - 行内粗体、斜体、代码和 http/https 链接
 *
 * @param {string} value - AI 返回的 Markdown 文本。
 * @param {{ renderCodeBlock?: (block: { language: string, code: string, isComplete: boolean }) => string | null }} [options={}] - 可选的受控代码块渲染器。
 * @returns {string} 安全 Markdown HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderMarkdown(value, options = {}) {
  const lines = String(value || "").replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let paragraphLines = [];
  let activeListType = "";
  let inCodeBlock = false;
  let codeLanguage = "";
  let codeLines = [];
  const consumedTableLines = new Set();

  /**
   * 结束当前段落。
   *
   * @returns {void}
   * @throws {Error} 本函数不主动抛异常。
   */
  function flushParagraph() {
    if (paragraphLines.length === 0) {
      return;
    }

    html.push(`<p>${paragraphLines.map(renderInlineMarkdown).join("<br>")}</p>`);
    paragraphLines = [];
  }

  /**
   * 结束当前列表。
   *
   * @returns {void}
   * @throws {Error} 本函数不主动抛异常。
   */
  function closeList() {
    if (!activeListType) {
      return;
    }

    html.push(`</${activeListType}>`);
    activeListType = "";
  }

  /**
   * 确保列表容器存在。
   *
   * @param {"ul" | "ol"} type - 列表类型。
   * @returns {void}
   * @throws {Error} 本函数不主动抛异常。
   */
  function ensureList(type) {
    if (activeListType === type) {
      return;
    }

    closeList();
    html.push(`<${type}>`);
    activeListType = type;
  }

  /**
   * 结束代码块。
   *
   * @param {boolean} [isComplete=true] - fenced block 是否已经收到闭合标记。
   * @returns {void}
   * @throws {Error} 本函数不主动抛异常。
   */
  function flushCodeBlock(isComplete = true) {
    const code = codeLines.join("\n");
    const customRenderer = typeof options.renderCodeBlock === "function" ? options.renderCodeBlock : null;
    let customHtml = null;

    try {
      customHtml = customRenderer
        ? customRenderer({ language: codeLanguage, code, isComplete })
        : null;
    } catch (error) {
      console.warn("[reverse-yingdan] 自定义代码块渲染失败，已降级为安全源码", {
        language: codeLanguage,
        message: error instanceof Error ? error.message : "未知错误"
      });
    }

    if (typeof customHtml === "string") {
      html.push(customHtml);
    } else {
      const languageClass = codeLanguage ? ` class="language-${escapeHtml(codeLanguage)}"` : "";
      html.push(`<pre><code${languageClass}>${escapeHtml(code)}</code></pre>`);
    }
    codeLines = [];
    codeLanguage = "";
    inCodeBlock = false;
  }

  lines.forEach((line, lineIndex) => {
    if (consumedTableLines.has(lineIndex)) {
      return;
    }

    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      flushParagraph();
      closeList();

      if (inCodeBlock) {
        flushCodeBlock(true);
        return;
      }

      inCodeBlock = true;
      codeLanguage = trimmed.slice(3).trim().split(/\s+/)[0] || "";
      codeLines = [];
      return;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }

    const nextLine = lines[lineIndex + 1] || "";
    if (trimmed.includes("|") && isMarkdownTableSeparator(nextLine)) {
      const headerCells = splitMarkdownTableRow(trimmed);
      const separatorCells = splitMarkdownTableRow(nextLine);

      if (headerCells.length === separatorCells.length) {
        const tableRows = [];
        let rowIndex = lineIndex + 2;

        consumedTableLines.add(lineIndex + 1);
        while (rowIndex < lines.length) {
          const row = lines[rowIndex];
          const rowTrimmed = row.trim();
          const rowCells = splitMarkdownTableRow(rowTrimmed);

          if (!rowTrimmed || !rowTrimmed.includes("|") || rowCells.length < 2) {
            break;
          }

          tableRows.push(row);
          consumedTableLines.add(rowIndex);
          rowIndex += 1;
        }

        flushParagraph();
        closeList();
        html.push(renderMarkdownTable(trimmed, nextLine, tableRows));
        return;
      }
    }

    if (!trimmed) {
      flushParagraph();
      closeList();
      return;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    const unorderedMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    const orderedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    const quoteMatch = trimmed.match(/^>\s?(.+)$/);

    if (/^-{3,}$/.test(trimmed)) {
      flushParagraph();
      closeList();
      html.push("<hr>");
      return;
    }

    if (headingMatch) {
      flushParagraph();
      closeList();
      const level = Math.min(4, headingMatch[1].length + 1);
      html.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
      return;
    }

    if (orderedMatch) {
      flushParagraph();
      ensureList("ol");
      html.push(`<li>${renderInlineMarkdown(orderedMatch[1])}</li>`);
      return;
    }

    if (unorderedMatch) {
      flushParagraph();
      ensureList("ul");
      html.push(`<li>${renderInlineMarkdown(unorderedMatch[1])}</li>`);
      return;
    }

    if (quoteMatch) {
      flushParagraph();
      closeList();
      html.push(`<blockquote>${renderInlineMarkdown(quoteMatch[1])}</blockquote>`);
      return;
    }

    closeList();
    paragraphLines.push(trimmed);
  });

  if (inCodeBlock) {
    // 流式回答可能暂时只有半个 fenced block。专用渲染器会先显示骨架，
    // 普通代码块仍安全地展示当前已收到的源码。
    flushCodeBlock(false);
  }

  flushParagraph();
  closeList();

  return `<div class="yd-markdown">${html.join("")}</div>`;
}

/**
 * 根据当前 Dify 页面选择正式回答渲染方式。
 *
 * YD Artifact 才会把 mermaid、echarts、svg、ui 和显式 artifact 代码块交给
 * 专用适配器；其它功能页继续使用原来的安全 Markdown，普通 HTML 永远不会被执行。
 *
 * @param {object} message - 当前助手消息。
 * @returns {string} 可插入回答区的安全 HTML。
 * @throws {Error} 缺少 Artifact 模块时自动退回普通 Markdown，不影响对话。
 */
function renderDifyAnswerContent(message) {
  const artifactRenderer = state.activeMain === "yd-artifact"
    ? window.YD_ARTIFACT?.renderArtifactCodeBlock
    : null;

  return renderMarkdown(message?.content || "", artifactRenderer ? { renderCodeBlock: artifactRenderer } : {});
}

/**
 * 读取 KASS 消息当前应该处于的渲染阶段。
 *
 * @param {object} message - 当前助手消息。
 * @returns {"loading" | "streaming" | "complete"} 加载、纯文本流式或最终富文本阶段。
 * @throws {Error} 本函数不主动抛异常。
 */
function getKassAgentMessageRenderPhase(message) {
  return window.YD_DIFY.getKassStreamRenderPlan(message, "", "").phase;
}

/**
 * 把 KASS 助手正文渲染为受控富文本。
 *
 * @param {object} message - 当前助手消息。
 * @returns {string} 已经过安全 Markdown / Artifact 适配器处理的 HTML。
 * @throws {Error} Artifact 模块缺失时由 Markdown 渲染器安全降级。
 */
function renderKassAgentAnswerHtml(message) {
  const content = String(message?.content || "");
  const artifactRenderer = window.YD_ARTIFACT?.renderArtifactCodeBlock;
  return renderMarkdown(
    content,
    artifactRenderer ? { renderCodeBlock: artifactRenderer } : {}
  );
}

/**
 * 渲染客户 KASS 对话中的单条新增消息。
 *
 * 作用：
 * - 用户消息始终只作为纯文本显示，避免把用户输入误当成 Markdown 或可执行内容。
 * - CRM Agent 的回答复用现有安全 Markdown，并把显式 `ui`、Mermaid、ECharts、SVG
 *   或 `html-artifact` 代码块交给同一个受控 Artifact 渲染器。
 *
 * 为什么不直接使用 innerHTML：
 * - KASS 回答未来会来自 Dify，模型输出不能直接信任。
 * - 统一复用已测试的渲染器，可以继续保留 HTML 转义、沙箱、CSP 和失败降级边界。
 *
 * @param {{ role?: unknown, content?: unknown }} message - 当前用户或 CRM Agent 消息。
 * @returns {string} 可安全插入 KASS 对话区的 HTML。
 * @throws {Error} Artifact 模块缺失时自动回退安全 Markdown，不影响普通回答。
 */
function renderKassAgentMessageContent(message) {
  const content = String(message?.content || "");

  if (message?.role === "user") {
    return `<p class="kass-agent-message-plain">${escapeHtml(content)}</p>`;
  }

  const process = window.YD_DIFY.getKassProcessPresentation(message);
  const phase = getKassAgentMessageRenderPhase(message);
  const answer = phase === "loading" ? "" : renderKassAgentAnswerHtml(message);

  return `
    <section
      class="kass-agent-process ${process.complete ? "is-complete" : ""}"
      data-kass-process-panel="true"
      ${process.visible ? "" : "hidden"}
    >
      <span class="kass-agent-process-mark" aria-hidden="true"></span>
      <div>
        <small data-kass-process-kicker="true">${process.complete ? "处理完成" : "Agent 处理过程"}</small>
        <p data-kass-process-label="true">${escapeHtml(process.label)}</p>
        <span data-kass-process-detail="true" ${process.detail ? "" : "hidden"}>${escapeHtml(process.detail)}</span>
      </div>
      <em data-kass-process-count="true">${process.count ? `${process.count} 步` : ""}</em>
    </section>
    <div class="kass-agent-message-text" data-kass-answer-shell="true">${answer}</div>
  `;
}

/**
 * 移除模型思考标签。
 *
 * 为什么要过滤：
 * - 之前真实 Dify smoke test 观察到 DeepSeek 可能把 <think>...</think> 放进 answer。
 * - 原型用户只需要看背调结论，不应该看到模型内部思考。
 *
 * @param {string} answer - Dify 返回的 answer 字段。
 * @returns {string} 去掉思考标签后的用户可读文本。
 * @throws {Error} 本函数不主动抛异常。
 */
function stripThinkingTags(answer) {
  return String(answer || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

/**
 * 从用户粘贴内容里提取 Dify API Key。
 *
 * 为什么要做提取：
 * - 用户经常会连同中文括号、说明文字或 `Authorization: Bearer` 一起复制。
 * - 浏览器 fetch 的 Header 不能包含中文括号这类非 latin-1 字符，否则可能直接变成网络失败。
 * - 这里只保留 `app-` 开头的一段 key，避免把多余字符放进 Authorization Header。
 *
 * @param {string} value - 用户输入或粘贴的原始 key 文本。
 * @returns {string} 提取后的 Dify API Key；找不到时返回清理空白后的原文。
 * @throws {Error} 本函数不主动抛异常。
 */
function normalizeDifyApiKey(value) {
  const raw = String(value || "").trim();
  const matched = raw.match(/app-[A-Za-z0-9_-]+/);
  return matched ? matched[0] : raw.replace(/\s+/g, "");
}

/**
 * 判断是否展示客户背调成本追踪面板。
 *
 * 为什么使用独立调试参数：
 * - 通用 Dify 代理会返回脱敏后的 billing_trace，成本面板只负责展示这份内部排障数据。
 * - 普通用户不应该看到 workflow、token、工具调用等内部信息。
 *
 * @returns {boolean} URL 上带 ?costDebug=1 或 ?difyTrace=1 时返回 true。
 * @throws {Error} 本函数不主动抛异常；URL 解析失败时默认关闭。
 */
function isCustomerResearchCostDebugMode() {
  try {
    const params = new URLSearchParams(window.location.search);

    return params.get("costDebug") === "1" || params.get("difyTrace") === "1";
  } catch (error) {
    return false;
  }
}

/**
 * 渲染导航图标。
 *
 * 作用：
 * - 支持真实 SVG 图标文件，也兼容少量临时文本符号。
 * - 后续用户继续提供图标时，只要在 data.js 里换路径即可。
 *
 * @param {string} icon - 图标路径或文本符号。
 * @param {string} label - 图标对应的业务名称，用于图片 alt。
 * @returns {string} 图标 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderIcon(icon, label) {
  if (icon.endsWith(".svg")) {
    return `<img class="nav-svg" src="${escapeHtml(icon)}" alt="${escapeHtml(label)}" />`;
  }

  return escapeHtml(icon);
}

/**
 * 根据 ID 查找当前阶段。
 *
 * @param {string} id - 成交阶段 ID。
 * @returns {typeof TRADE_STAGES[number]} 找到的阶段；找不到时返回第一个阶段，保证界面不空白。
 * @throws {Error} 本函数不会主动抛异常；数据为空时会返回 undefined，但当前数据固定非空。
 */
function getStageById(id) {
  return TRADE_STAGES.find((stage) => stage.id === id) || TRADE_STAGES[0];
}

/**
 * 根据 ID 获取公司资料模块。
 *
 * @param {string} id - 公司模块 ID。
 * @returns {typeof COMPANY_MODULES[number]} 找到的模块；找不到时返回第一个模块，避免详情区空白。
 * @throws {Error} 本函数不主动抛异常。
 */
function getCompanyModuleById(id) {
  return COMPANY_MODULES.find((module) => module.id === id) || COMPANY_MODULES[0];
}

/**
 * 根据 ID 获取产品行。
 *
 * @param {string} id - 产品 ID。
 * @returns {typeof PRODUCT_ROWS[number]} 找到的产品；找不到时返回第一行产品。
 * @throws {Error} 本函数不主动抛异常。
 */
function getProductById(id) {
  return PRODUCT_ROWS.find((product) => product.id === id) || PRODUCT_ROWS[0];
}

/**
 * 获取当前选中的客户。
 *
 * @returns {typeof CUSTOMERS[number]} 当前客户；找不到时返回第一个客户。
 * @throws {Error} 本函数不主动抛异常。
 */
function getActiveCustomer() {
  return CUSTOMERS.find((customer) => customer.id === state.activeCustomerId) || CUSTOMERS[0];
}

/**
 * 获取当前客户Kass分组。
 *
 * 线上客户Kass的 URL 是 `/customer-kass/A`、`/customer-kass/B` 这种分组页。
 * 本地原型用 `activeMain` 表示当前分组，避免真的依赖路由。
 *
 * @returns {typeof KASS_GROUPS[number]} 当前分组；找不到时返回 A 分组。
 * @throws {Error} 本函数不主动抛异常。
 */
function getActiveKassGroup() {
  return KASS_GROUPS.find((group) => group.id === state.activeMain) || KASS_GROUPS[0];
}

/**
 * 获取当前客户Kass分组下选中的客户。
 *
 * @returns {typeof KASS_GROUPS[number]["customers"][number]} 当前客户；找不到时返回分组第一个客户。
 * @throws {Error} 本函数不主动抛异常。
 */
function getActiveKassCustomer() {
  const group = getActiveKassGroup();
  return group.customers.find((customer) => customer.id === state.activeCustomerId) || group.customers[0];
}

/**
 * 判断当前是否处于客户 Kass 的 A / B 方案工作台。
 *
 * URL 中的 A / B 只代表界面方案；客户等级由 `kassWorkbenchGroupId` 单独维护。
 * 线上复刻页仍沿用原有的路由分组逻辑，不进入这里。
 *
 * @returns {boolean} 当前是 A / B 方案工作台时返回 true。
 * @throws {Error} 本函数不主动抛异常。
 */
function isKassWorkbenchView() {
  return state.activeMain.startsWith("customer-kass-") && state.activeKassView === "workbench";
}

/**
 * 判断当前是否正在展示用于方案对比的 B 版客户 Kass。
 *
 * B 路由被产品用作第二套信息架构的固定演示入口，因此它内部切换 A/B/C/D
 * 客户等级时不能改写 URL；否则点击 A 级客户会误跳回旧版 A 页面。
 *
 * @returns {boolean} 当前是 B 版工作台时返回 true。
 * @throws {Error} 本函数不主动抛异常。
 */
function isKassComparisonView() {
  return state.activeMain === "customer-kass-b" && state.activeKassView === "workbench";
}

/**
 * 获取当前方案工作台里选中的客户等级。
 *
 * A / B 两套方案必须使用同一份等级状态，切换方案后才能继续对照同一客户。
 *
 * @returns {typeof KASS_GROUPS[number]} 当前客户等级；无效时回退到 A 级。
 * @throws {Error} 本函数不主动抛异常。
 */
function getKassWorkbenchGroup() {
  return KASS_GROUPS.find((group) => group.id === state.kassWorkbenchGroupId) || KASS_GROUPS[0];
}

/**
 * 按客户 ID 和等级找到当前方案工作台客户。
 *
 * @param {typeof KASS_GROUPS[number]} group - 当前选中的客户等级。
 * @returns {typeof KASS_GROUPS[number]["customers"][number] | null} 当前客户；空分组返回 null。
 * @throws {Error} 本函数不主动抛异常。
 */
function getKassWorkbenchCustomer(group) {
  return group.customers.find((customer) => customer.id === state.activeCustomerId)
    || group.customers[0]
    || null;
}

/**
 * 根据案例分类、标签和搜索词过滤案例。
 *
 * @returns {typeof CASE_ITEMS} 当前筛选条件下的案例列表。
 * @throws {Error} 本函数不主动抛异常。
 */
function getFilteredCaseItems() {
  const query = state.caseSearchQuery.trim().toLowerCase();

  return CASE_ITEMS.filter((item) => {
    const matchCategory = item.category === state.activeCaseCategory;
    const matchTag = state.activeCaseTag === "全部" || item.tags.includes(state.activeCaseTag);
    const matchQuery = !query || `${item.title} ${item.meta} ${item.excerpt}`.toLowerCase().includes(query);

    return matchCategory && matchTag && matchQuery;
  });
}

/**
 * 获取按搜索词过滤后的历史记录。
 *
 * 为什么单独写函数：
 * - 侧边栏历史和顶部历史下拉都会用到同一批数据。
 * - 搜索逻辑集中后，后续如果改成真实接口返回，也只需要替换这里。
 *
 * @returns {string[]} 当前应该展示的历史记录。
 * @throws {Error} 本函数不主动抛异常；搜索词为空时返回全部历史。
 */
function getFilteredHistoryItems() {
  const query = state.historySearchQuery.trim().toLowerCase();

  if (!query) {
    return HISTORY_ITEMS;
  }

  return HISTORY_ITEMS.filter((item) => item.toLowerCase().includes(query));
}

/**
 * 根据当前入口获取聊天页标题和占位提示。
 *
 * @returns {[string, string, string]} 依次为标题、描述、输入框占位符。
 * @throws {Error} 本函数不主动抛异常。
 */
function getChatLabels() {
  const labels = {
    ask: ["问一下", "请输入关于外贸相关的问题", "请输入查询内容[例如：3月新贸节老板 运营 业务要做什么工作？/ 新手外贸要准备什么]"],
    "customer-research": ["客户背调顾问", "输入「复制你的客户信息或输入客户所在国家/地区 + 行业/标签 + 公司名称（可选加官网链接），用于做客户背景调研。", "背调：中东·新能源行业·Yellow Door Energy"],
    "negotiation-scene": ["场景谈判顾问", "选择常见的谈判场景", "在右下角选择谈判场景，附带你的问题详情"],
    "inquiry-reply": ["询盘分析回复", "直接粘贴「客户询盘/聊天记录全文」，可补充「你的产品基本信息、价格区间、底线要求」，用于分析询盘质量并生成回复。", "询盘分析：这是客户的英文询盘内容…… 帮我判断客户诚意并给一封回复建议"],
    "yd-artifact": ["YD Artifact", "直接提问；回答会把流程图、数据图和结构图自然穿插在文字中。", "用户注册到完成付款的流程是怎样的？"],
    "market-research": ["市场调研", "输入「核心产品」为主，可选加上「目标国家/地区」和「目标客户类型」，用于整体市场调研与选品推荐。", "市场调研：墨西哥·建筑材料行业·PVC地板·目标客户是工程采购商和批发商"],
    "customer-development": ["客户开发", "输入「目标国家 + 客户类型 + 主推产品 + 开发目标」，AI 会帮你拆客户画像、开发渠道和多轮触达动作。", "客户开发：中东·新能源经销商·主推 5kW 户储套件·想找 20 个高匹配客户"],
    "cold-email": ["新客开发信", "输入「目标客户类型 + 产品 + 国家/地区」，AI 会帮你生成一封针对性的开发信。", "新客开发信：中东·光伏经销商·要主推 5kW 户用储能套件"],
    "complaint": ["客诉处理", "粘贴客户投诉原文，并补充「你已经掌握的事实和可让步空间」，用于生成专业回复。", "客诉处理：客户反馈到货数量少了 2 台，希望免费补寄并赔偿运费"],
    "reactivation": ["客户激活", "输入「客户名称 + 沉睡时长 + 上次成交/沟通线索」，用于设计激活动作和邮件。", "客户激活：UAE·Yellow Door Energy·上次询盘 6 个月前·关注交付节奏"],
    "relationship": ["关系维护", "输入「客户名称 + 当前阶段 + 你想巩固的关系点」，AI 会给一组关系维护动作。", "关系维护：欧洲项目商·已成交一次·想推进复购"],
    "phone-sales": ["海外电销", "输入「目标国家 + 客户类型 + 沟通目标」，AI 会准备一份电销对话脚本。", "海外电销：墨西哥·建筑材料分销商·想约一次产品介绍会议"],
    "video-meeting": ["视频会议", "输入「会议目标 + 客户阶段 + 关键议题」，AI 会准备会议大纲和话术。", "视频会议：报价后跟进·客户重点关注交期和质保·我方目标是确认 PI"],
    "field-visit": ["地推陌拜", "输入「拜访目的 + 客户类型 + 区域」，AI 会准备拜访动线、话术和资料清单。", "地推陌拜：深圳福田·建筑材料采购商·目标是留下样品并约二次见面"],
    "visit-reception": ["来访接待", "输入「来访客户名称 + 行程时间 + 我方目标」，AI 会准备接待议程、礼宾动作和谈判要点。", "来访接待：UAE Yellow Door Energy·两天行程·想签 LOI"],
    "title-combo": ["标题组合", "输入「目标客户 + 主推产品 + 卖点关键词」，AI 会组合一批高点击率邮件主题。", "标题组合：欧洲零售连锁·智能戒指·主打健康监测"],
    "trade-show": ["展会成交", "输入「展会名称 + 我方目标 + 重点客户线索」，AI 会准备展前/展中/展后三段动作。", "展会成交：广交会春季·主推光伏支架·想锁中东 3 个 KA"],
    "customer-kass": ["客户Kass", "查看客户档案、背调、询盘、沟通和 AI 记录", "输入你想继续追问的客户上下文问题"],
    default: ["市场调研", "输入当前外贸业务场景所需资料", "粘贴客户信息、产品资料、谈判背景或业务目标"]
  };

  return labels[state.activeMain] || labels.default;
}

/**
 * 判断指定页面是否属于本次接入的 Dify 对话功能页。
 *
 * @param {string} featureId - 页面路由 ID；默认使用当前 activeMain。
 * @returns {boolean} 只有明确登记的对话页返回 true。
 * @throws {Error} 本函数不主动抛异常。
 */
function isDifyChatFeaturePage(featureId = state.activeMain) {
  return Boolean(window.YD_DIFY?.isDifyChatFeature(featureId));
}

/**
 * 获取或创建某个页面独立的 Dify 配置状态。
 *
 * @param {string} featureId - 对话页面 ID。
 * @returns {ReturnType<typeof YD_DIFY.createFeatureConfigState>} 页面配置状态。
 * @throws {Error} 缺少 src/dify-config.js 时抛出，便于发现 HTML 引用错误。
 */
function getDifyFeatureConfig(featureId = state.activeMain) {
  if (!window.YD_DIFY) {
    throw new Error("缺少 Dify 前端配置模块，请刷新页面。");
  }

  if (!state.difyFeatureConfigs[featureId]) {
    state.difyFeatureConfigs[featureId] = window.YD_DIFY.createFeatureConfigState(featureId);
  }

  return state.difyFeatureConfigs[featureId];
}

/**
 * 获取或创建某个页面独立的多轮会话状态。
 *
 * @param {string} featureId - 对话页面 ID。
 * @returns {ReturnType<typeof YD_DIFY.createFeatureSessionState>} 页面会话状态。
 * @throws {Error} 缺少 src/dify-config.js 时抛出。
 */
function getDifyFeatureSession(featureId = state.activeMain) {
  if (!window.YD_DIFY) {
    throw new Error("缺少 Dify 前端会话模块，请刷新页面。");
  }

  if (!state.difyFeatureSessions[featureId]) {
    state.difyFeatureSessions[featureId] = window.YD_DIFY.createFeatureSessionState(featureId);
  }

  return state.difyFeatureSessions[featureId];
}

/**
 * 将一批 Dify 流事件合并到下一动画帧，并只更新当前助手消息。
 *
 * 为什么不能调用 renderApp：
 * - renderApp 会替换整个 #app.innerHTML，导致导航、输入区、回答区和 CSS 动画全部被销毁重建。
 * - SSE 可能每几个字就来一个事件，全量重建会表现成整屏持续闪烁。
 * - 局部补丁保留现有 DOM 和动画实例，只在结构阶段变化时替换单条回答。
 *
 * @param {string} featureId - 发起本轮请求的页面 ID；切换页面后不再重绘旧页面。
 * @param {string} messageId - 当前流式助手消息的稳定 ID。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function scheduleDifyStreamRender(featureId, messageId) {
  if (state.activeMain !== featureId || difyStreamRenderFrame !== null) {
    return;
  }

  difyStreamRenderFrame = window.requestAnimationFrame(() => {
    difyStreamRenderFrame = null;
    if (state.activeMain !== featureId) {
      return;
    }

    const workspace = document.querySelector(".workspace");
    const previousScrollTop = workspace ? workspace.scrollTop : 0;
    const nearBottom = workspace
      ? workspace.scrollHeight - workspace.clientHeight - workspace.scrollTop < 80
      : true;

    patchDifyStreamMessageDom(featureId, messageId);

    const nextWorkspace = document.querySelector(".workspace");
    if (nextWorkspace) {
      nextWorkspace.scrollTop = nearBottom ? nextWorkspace.scrollHeight : previousScrollTop;
    }
  });
}

/**
 * 获取配置或聊天代理地址。
 *
 * 为什么允许运行时覆盖：
 * - 正式 GitHub Pages 的配置请求走 Vercel，聊天长流走 Cloudflare。
 * - 本地开发时可设置 window.YD_DIFY_PROXY_ENDPOINTS，分别覆盖两个接口地址。
 *
 * @param {"config" | "chat" | "kassCrm"} kind - 需要的代理类型。
 * @returns {string} 完整接口地址。
 * @throws {Error} kind 不存在时抛出。
 */
function getDifyProxyEndpoint(kind) {
  const injected = window.YD_DIFY_PROXY_ENDPOINTS?.[kind];
  const endpoint = typeof injected === "string" && injected.trim()
    ? injected.trim()
    : DIFY_PROXY_ENDPOINTS[kind];

  if (!endpoint) {
    throw new Error("Dify 代理地址未配置。");
  }

  return endpoint;
}

/**
 * 把后端返回的安全 metadata 合并进页面配置状态。
 *
 * @param {object} config - 当前页面配置状态。
 * @param {object} payload - `/api/dify-config` 返回的摘要，不包含原始 Key。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常；缺字段时保留当前默认值。
 */
function applyDifyConfigMetadata(config, payload) {
  config.hasKey = Boolean(payload?.hasKey);
  // 老版本配置服务对“未配置页面”统一返回 dialogue。没有 Key 时保留前端页面默认值，
  // 让新增的 YD Artifact 即使在灰度部署期间也仍默认显示 Chatflow。
  if (config.hasKey) {
    config.appType = payload?.appType === "chatflow" ? "chatflow" : "dialogue";
  }
  config.maskedKey = String(payload?.maskedKey || "");
  config.skillKey = String(payload?.skillKey || "");
  config.skillKeyDraft = config.skillKey;
  config.appName = String(payload?.appName || "");
  config.appMode = String(payload?.appMode || "");
  config.storageReady = Boolean(payload?.storageReady);
  config.loaded = true;
  config.error = "";
}

/**
 * 从 Vercel 后端读取当前页面的已保存配置状态。
 *
 * @param {string} featureId - 对话页面 ID。
 * @returns {Promise<void>} 完成后按需重绘当前页。
 * @throws {Error} 网络异常会被捕获并写入 config.error，不向外抛出。
 */
async function loadDifyFeatureConfig(featureId = state.activeMain) {
  if (!isDifyChatFeaturePage(featureId)) {
    return;
  }

  const config = getDifyFeatureConfig(featureId);
  if (config.loaded || config.loading) {
    return;
  }

  config.loading = true;

  try {
    const endpoint = new URL(getDifyProxyEndpoint("config"));
    endpoint.searchParams.set("feature_id", featureId);
    const response = await fetch(endpoint.toString(), { headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.message || `配置读取失败（HTTP ${response.status}）`);
    }

    applyDifyConfigMetadata(config, payload);
  } catch (error) {
    config.loaded = true;
    config.error = window.YD_DIFY.getFriendlyConfigError(error);
    console.error("[reverse-yingdan] Dify 配置读取失败", { featureId, message: config.error });
  } finally {
    config.loading = false;
    if (state.activeMain === featureId) {
      renderApp();
    }
  }
}

/**
 * 保存并覆盖当前页面的 Dify 应用配置。
 *
 * 保存成功后清空旧 conversation_id：新 Key 可能绑定另一个 App，继续传旧会话会导致 404 或串上下文。
 *
 * @param {string} featureId - 对话页面 ID。
 * @returns {Promise<void>} 保存完成后重绘并显示 toast。
 * @throws {Error} 网络和校验错误会被捕获并展示在配置栏。
 */
async function saveDifyFeatureConfig(featureId = state.activeMain) {
  const config = getDifyFeatureConfig(featureId);
  const apiKey = normalizeDifyApiKey(config.apiKeyDraft);
  const skillKey = String(config.skillKeyDraft || "").trim();

  if (!apiKey && !config.hasKey) {
    config.error = "请填写 app- 开头的 Dify API Key。";
    renderApp();
    document.querySelector("[data-dify-api-key]")?.focus();
    return;
  }

  config.saving = true;
  config.error = "";
  renderApp();

  try {
    const response = await fetch(getDifyProxyEndpoint("config"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feature_id: featureId,
        app_type: config.appType,
        api_key: apiKey,
        skill_key: skillKey
      })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.message || `配置保存失败（HTTP ${response.status}）`);
    }

    applyDifyConfigMetadata(config, payload);
    config.apiKeyDraft = "";
    state.difyFeatureSessions[featureId] = window.YD_DIFY.createFeatureSessionState(featureId);
    showToast(`已保存 ${config.appName || "Dify 应用"}，新配置立即生效。`);
  } catch (error) {
    config.error = window.YD_DIFY.getFriendlyConfigError(error);
    console.error("[reverse-yingdan] Dify 配置保存失败", { featureId, message: config.error });
  } finally {
    config.saving = false;
    renderApp();
  }
}

/**
 * 渲染用户标注的顶部 Dify 配置栏。
 *
 * @returns {string} 应用类型、Key、保存按钮和安全状态提示。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderDifyConfigBar() {
  const config = getDifyFeatureConfig(state.activeMain);
  const skillStatus = config.skillKey ? ` · Skill ${config.skillKey}` : " · 独立应用";
  const statusText = config.loading
    ? "正在读取配置…"
    : config.saving
      ? "正在校验并保存…"
      : config.error
        ? config.error
        : config.hasKey
          ? `已配置 · ${config.appName || (config.appType === "chatflow" ? "Chatflow" : "对话型应用")}${skillStatus}`
          : "尚未配置";

  return `
    <section class="dify-config-bar ${config.error ? "error" : ""}" aria-label="当前对话应用配置">
      <select data-dify-app-type="true" aria-label="Dify 应用类型" ${config.saving ? "disabled" : ""}>
        <option value="dialogue" ${config.appType === "dialogue" ? "selected" : ""}>对话型应用</option>
        <option value="chatflow" ${config.appType === "chatflow" ? "selected" : ""}>Chatflow</option>
      </select>
      <input type="password" value="${escapeHtml(config.apiKeyDraft)}" placeholder="${escapeHtml(config.hasKey ? config.maskedKey : "填写 app- 开头的 API Key")}" data-dify-api-key="true" autocomplete="off" aria-label="Dify API Key" ${config.saving ? "disabled" : ""} />
      <input type="text" value="${escapeHtml(config.skillKeyDraft)}" placeholder="Skill ID（独立 App 可留空）" data-dify-skill-key="true" autocomplete="off" aria-label="业务 Skill ID" ${config.saving ? "disabled" : ""} />
      <button type="button" data-save-dify-config="true" ${config.saving || (!config.apiKeyDraft.trim() && !config.hasKey) ? "disabled" : ""}>
        ${config.saving ? "保存中" : config.hasKey ? "覆盖更新" : "保存"}
      </button>
      <span class="dify-config-status" title="${escapeHtml(statusText)}">${escapeHtml(statusText)}</span>
    </section>
  `;
}

/**
 * 渲染整个应用。
 *
 * 作用：
 * - 根据当前 state 重新生成页面结构。
 * - 原型体量不大，整页重绘比手动维护很多局部 DOM 更简单可靠。
 *
 * @returns {void}
 * @throws {Error} 如果页面缺少 #app 容器，会抛出错误，方便尽早发现 HTML 骨架问题。
 */
function renderApp() {
  const app = document.querySelector("#app");

  if (!app) {
    throw new Error("页面缺少 #app 容器，无法渲染赢单原型。");
  }

  if (state.popup !== "accountSettings") {
    state.accountSpaceSwitcherOpen = false;
  }

  if (state.activeMain.startsWith("admin-")) {
    app.innerHTML = renderAdminApp();
    bindEvents();
    syncHashFromState();
    if (state.activeMain === "admin-ai-cost") {
      void ensureCostMonitorConfigsLoaded();
    }
    console.log("[reverse-yingdan] 后台原型已渲染", {
      activeMain: state.activeMain,
      dialog: state.adminDialog,
      hash: window.location.hash
    });
    return;
  }

  /*
   * 线上版复刻使用原项目的全局侧栏和顶部栏，目的是让它与当前重点推进版并存。
   * 两个页面共享样例客户状态，但使用独立 hash，方便评审时直接复制链接对照。
   */
  if (state.activeMain.startsWith("customer-kass") && state.activeKassView === "online") {
    app.innerHTML = `
      <div class="layout kass-online-layout">
        ${renderSidebar()}
        <main class="main kass-online-main-shell">
          ${renderTopbar()}
          <section class="workspace kass-online-workspace">
            ${renderCustomerKassOnlineView()}
          </section>
        </main>
      </div>
      ${renderDrawer()}
      ${renderPopupLayer()}
      <div id="toast" class="toast" role="status" aria-live="polite"></div>
    `;

    bindEvents();
    syncHashFromState();
    console.log("[reverse-yingdan] 客户 Kass 线上版复刻页已渲染", {
      activeMain: state.activeMain,
      activeCustomerId: state.activeCustomerId,
      hash: window.location.hash
    });
    return;
  }

  /*
   * 客户 Kass 工作台复用赢单全局侧栏。
   * A 版保留“工作区客户栏 + 信息页签”；B 版在相同外壳里改为“侧栏客户子菜单 +
   * Agent 对话 + 客户上下文”，两套方案用独立路由直接对照。
   */
  if (state.activeMain.startsWith("customer-kass")) {
    app.innerHTML = `
      <div class="layout kass-workbench-layout">
        ${renderSidebar()}
        <main class="main kass-workbench-main">
          <section class="workspace kass-workbench-workspace">
            ${renderCustomerKassView()}
          </section>
        </main>
      </div>
      ${renderKassCustomerDirectoryModal()}
      ${renderDrawer()}
      ${renderPopupLayer()}
      <div id="toast" class="toast" role="status" aria-live="polite"></div>
    `;

    bindEvents();
    syncHashFromState();
    // KASS 没有把配置表单暴露在产品界面，但仍需在后台读取“是否已配置”状态。
    // API Key 由环境变量或加密配置存储提供，浏览器只能得到掩码元数据。
    void loadDifyFeatureConfig(KASS_DIFY_FEATURE_ID);
    const currentKassCustomer = getKassWorkbenchCustomer(getKassWorkbenchGroup());
    void hydrateKassPrototypeCustomer(currentKassCustomer);
    console.log("[reverse-yingdan] 客户 Kass 作战台已渲染", {
      activeMain: state.activeMain,
      activeCustomerId: state.activeCustomerId,
      customerDirectoryOpen: state.kassCustomerDirectoryOpen,
      hash: window.location.hash
    });
    return;
  }

  app.innerHTML = `
    <div class="layout">
      ${renderSidebar()}
      <main class="main">
        ${renderTopbar()}
        <section class="workspace">
          ${renderWorkspace()}
        </section>
      </main>
    </div>
    ${renderDrawer()}
    ${renderPopupLayer()}
    <div id="toast" class="toast" role="status" aria-live="polite"></div>
  `;

  bindEvents();
  syncHashFromState();
  scrollFlowAiToBottom();
  // 配置读取是异步的；先把页面画出来，再在后台读取掩码状态，避免首屏被网络阻塞。
  void loadDifyFeatureConfig(state.activeMain);
  console.log("[reverse-yingdan] 页面已渲染", {
    activeMain: state.activeMain,
    activeSalesTab: state.activeSalesTab,
    activeStageId: state.activeStageId,
    hash: window.location.hash
  });
}

/**
 * 重画后台页面并恢复工作区滚动位置。
 *
 * 为什么需要这个函数：
 * - 后台弹窗打开/关闭会调用 renderApp()。
 * - renderApp() 会替换整棵 DOM，如果不记录滚动位置，页面会回到顶部。
 * - User Preview 的字段配置在页面较下方，跳回顶部会让用户以为界面失控。
 *
 * @returns {void}
 * @throws {Error} renderApp() 找不到 #app 时仍会抛出原始错误。
 */
function renderAdminAppPreservingScroll() {
  const workspace = document.querySelector(".admin-workspace");
  const scrollTop = workspace ? workspace.scrollTop : 0;
  const scrollLeft = workspace ? workspace.scrollLeft : 0;

  renderApp();

  const nextWorkspace = document.querySelector(".admin-workspace");

  if (nextWorkspace) {
    nextWorkspace.scrollTop = scrollTop;
    nextWorkspace.scrollLeft = scrollLeft;

    window.requestAnimationFrame(() => {
      nextWorkspace.scrollTop = scrollTop;
      nextWorkspace.scrollLeft = scrollLeft;
    });

    window.setTimeout(() => {
      nextWorkspace.scrollTop = scrollTop;
      nextWorkspace.scrollLeft = scrollLeft;
    }, 0);
  }
}

/**
 * 在当前后台 DOM 上直接打开弹窗。
 *
 * 为什么不用 renderApp：
 * - 打开弹窗不应该改变后台页面内容。
 * - 直接插入弹窗可以保持后台工作区滚动位置、表格横向位置和弹窗内列表位置。
 *
 * @param {string | null} dialog - 要打开的弹窗类型。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function openAdminDialog(dialog, scrollSnapshot = null) {
  if (!dialog) {
    return;
  }

  const snapshot = scrollSnapshot || getAdminWorkspaceScrollSnapshot();
  state.adminDialog = dialog;

  if (dialog === "user-preview-fields") {
    userPreviewDialogWorkspaceScrollSnapshot = snapshot;
  }

  document.querySelector(".admin-dialog-backdrop")?.remove();

  const host = document.querySelector(".admin-main") || document.querySelector("#app");

  if (!host) {
    renderApp();
    return;
  }

  host.insertAdjacentHTML("beforeend", renderAdminDialog());
  restoreAdminWorkspaceScroll(snapshot);
  bindAdminDialogSurfaceEvents();
  bindAdminActionControls();
  bindAdminSubAccountControls();
  bindUserPreviewReportControls();
}

/**
 * 读取后台工作区当前滚动位置。
 *
 * @returns {{ top: number, left: number }} 当前滚动位置。
 * @throws {Error} 本函数不主动抛异常。
 */
function getAdminWorkspaceScrollSnapshot() {
  const workspace = document.querySelector(".admin-workspace");
  return {
    top: workspace ? workspace.scrollTop : 0,
    left: workspace ? workspace.scrollLeft : 0
  };
}

/**
 * 恢复后台工作区滚动位置。
 *
 * @param {{ top: number, left: number }} snapshot - 需要恢复的滚动位置。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function restoreAdminWorkspaceScroll(snapshot) {
  const workspace = document.querySelector(".admin-workspace");

  if (!workspace) {
    return;
  }

  workspace.scrollTop = snapshot.top;
  workspace.scrollLeft = snapshot.left;

  window.requestAnimationFrame(() => {
    workspace.scrollTop = snapshot.top;
    workspace.scrollLeft = snapshot.left;
  });

  window.setTimeout(() => {
    workspace.scrollTop = snapshot.top;
    workspace.scrollLeft = snapshot.left;
  }, 0);
}

/**
 * 关闭当前后台弹窗。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function closeAdminDialog() {
  const shouldRefreshUserPreviewReport = state.adminDialog === "user-preview-fields";

  state.adminDialog = null;
  document.querySelector(".admin-dialog-backdrop")?.remove();

  if (shouldRefreshUserPreviewReport) {
    refreshUserPreviewReport();
  }

  userPreviewDialogWorkspaceScrollSnapshot = null;
}

/**
 * 绑定后台弹窗自身事件。
 *
 * 为什么单独绑定：
 * - 弹窗现在可以直接插入 DOM，不一定经过 bindEvents() 的整页事件绑定。
 * - 关闭、阻止冒泡这些弹窗基础行为仍然需要立即可用。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function bindAdminDialogSurfaceEvents() {
  document.querySelectorAll("[data-admin-close]").forEach((node) => {
    if (node.dataset.adminCloseBound === "true") {
      return;
    }

    node.dataset.adminCloseBound = "true";
    node.addEventListener("click", (event) => {
      const isBackdrop = node.classList.contains("admin-dialog-backdrop");

      if (isBackdrop && event.target !== node) {
        return;
      }

      closeAdminDialog();
    });
  });

  document.querySelectorAll(".admin-dialog").forEach((node) => {
    if (node.dataset.adminDialogBound === "true") {
      return;
    }

    node.dataset.adminDialogBound = "true";
    node.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  });
}

/**
 * 绑定后台弹窗打开按钮。
 *
 * 为什么单独拆出来：
 * - User Preview 报表会局部替换“字段配置”按钮。
 * - 替换后的新按钮不经过整页 bindEvents()，必须单独重新绑定打开弹窗事件。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function bindAdminDialogOpenControls() {
  document.querySelectorAll("[data-admin-dialog]").forEach((button) => {
    if (button.dataset.adminDialogOpenBound === "true") {
      return;
    }

    button.dataset.adminDialogOpenBound = "true";
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      const operationUserId = button.getAttribute("data-user-preview-operation");
      if (operationUserId) {
        state.activeUserPreviewOperationId = operationUserId;
      }
      adminWorkspaceScrollSnapshot = getAdminWorkspaceScrollSnapshot();
    });

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const operationUserId = button.getAttribute("data-user-preview-operation");
      if (operationUserId) {
        state.activeUserPreviewOperationId = operationUserId;
      }
      openAdminDialog(button.getAttribute("data-admin-dialog"), adminWorkspaceScrollSnapshot);
      adminWorkspaceScrollSnapshot = null;
    });
  });
}

/**
 * 绑定后台原型反馈按钮。
 *
 * 为什么单独拆出来：
 * - User Preview 字段报表会局部替换表格 HTML。
 * - 局部替换后，新出现的启用/关闭等反馈按钮也需要重新绑定。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function bindAdminActionControls() {
  document.querySelectorAll("[data-admin-action]").forEach((node) => {
    if (node.dataset.adminActionBound === "true") {
      return;
    }

    node.dataset.adminActionBound = "true";
    node.addEventListener("click", () => {
      const message = node.getAttribute("data-admin-action") || "后台操作已触发。";
      showToast(message);
    });
  });
}

/**
 * 绑定子账号管理弹窗里的原型交互。
 *
 * 为什么用弹窗内的临时表单：
 * - 当前后台是静态原型，不写入真实数据。
 * - 但“新增子账号”至少应该收集手机号和初始分配积分，避免看起来像空操作。
 * - 确认后再插入临时行，能表达后台管理的真实操作节奏。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function bindAdminSubAccountControls() {
  document.querySelectorAll("[data-sub-account-add]").forEach((button) => {
    if (button.dataset.subAccountAddBound === "true") {
      return;
    }

    button.dataset.subAccountAddBound = "true";
    button.addEventListener("click", () => {
      const panel = button.closest(".sub-account-usage-panel");
      const existingForm = panel?.querySelector("[data-sub-account-add-form]");
      const panelHeader = panel?.querySelector(":scope > header");

      if (!panel || !panelHeader) {
        showToast("新增子账号是原型反馈，不创建真实账号。");
        return;
      }

      if (existingForm) {
        existingForm.querySelector("[data-sub-account-phone-input]")?.focus();
        return;
      }

      panelHeader.insertAdjacentHTML("afterend", renderAdminSubAccountAddForm());
      bindAdminSubAccountFormControls(panel);
      panel.querySelector("[data-sub-account-phone-input]")?.focus();
    });
  });
}

/**
 * 绑定新增子账号表单里的确认和取消。
 *
 * 为什么确认时只插入临时行：
 * - 当前后台仍是可操作原型，没有真实接口。
 * - 运营评审时重点是看清“填什么、确认后会出现什么”，不需要真正写入后端。
 *
 * @param {Element} panel - 当前子账号管理面板，内部包含表格和新增表单。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function bindAdminSubAccountFormControls(panel) {
  const form = panel.querySelector("[data-sub-account-add-form]");
  const cancelButton = panel.querySelector("[data-sub-account-cancel]");
  const confirmButton = panel.querySelector("[data-sub-account-confirm]");

  cancelButton?.addEventListener("click", () => {
    form?.remove();
  });

  confirmButton?.addEventListener("click", () => {
    const phoneInput = panel.querySelector("[data-sub-account-phone-input]");
    const creditInput = panel.querySelector("[data-sub-account-credit-input]");
    const phone = String(phoneInput?.value || "").trim();
    const allocatedCredit = parseAdminCreditInput(creditInput?.value);
    const tbody = panel.querySelector(".sub-account-usage-table tbody");

    if (!phone) {
      showToast("请先输入子账号手机号。");
      phoneInput?.focus();
      return;
    }

    if (!tbody) {
      showToast("新增子账号是原型反馈，不创建真实账号。");
      return;
    }

    tbody.querySelector(".sub-account-added-row")?.remove();
    tbody.insertAdjacentHTML("afterbegin", renderAdminSubAccountAddedRow(phone, allocatedCredit));
    form?.remove();
    bindAdminActionControls();
    showToast("已模拟新增子账号，临时行已加入列表。");
  });
}

/**
 * 渲染后台管理系统整体壳。
 *
 * 作用：
 * - 复刻真实后台的 SoybeanAdmin 结构：左侧菜单、顶部面包屑、右侧管理表格。
 * - 后台和前台原型互不混用，方便后续单独扩展管理端。
 *
 * @returns {string} 后台管理系统 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminApp() {
  return `
    <div class="admin-shell ${state.adminMenuOpen ? "mobile-menu-open" : ""}">
      ${renderAdminSidebar()}
      <main class="admin-main">
        ${renderAdminTopbar()}
        <section class="admin-workspace">
          ${renderAdminWorkspace()}
        </section>
      </main>
      ${renderAdminDialog()}
      <div id="toast" class="toast" role="status" aria-live="polite"></div>
    </div>
  `;
}

/**
 * 渲染后台左侧菜单。
 *
 * @returns {string} 后台侧边栏 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminSidebar() {
  const topLevelItems = ADMIN_NAV_ITEMS.filter((item) => !item.parent);
  const groupOrder = [];
  const groupMap = new Map();
  ADMIN_NAV_ITEMS.forEach((item) => {
    if (!item.parent) return;
    if (!groupMap.has(item.parent)) {
      groupOrder.push(item.parent);
      groupMap.set(item.parent, []);
    }
    groupMap.get(item.parent).push(item.id);
  });

  const parentIcon = { "用户": "👥", "代理": "⚑", "系统管理": "⚙" };

  return `
    <aside class="admin-sidebar" aria-label="赢单管理系统后台菜单">
      <a class="admin-brand" href="#/admin/home" data-admin-route="admin-home">
        <span class="admin-brand-dot" aria-hidden="true"></span>
        <h2>赢单管理系统</h2>
      </a>
      <nav class="admin-menu" aria-label="后台导航">
        ${topLevelItems.map((item) => renderAdminMenuItem(item.id)).join("")}
        ${groupOrder.map((parent) => `
          <div class="admin-menu-group">
            <button class="admin-menu-parent" type="button" data-admin-action="${escapeHtml(parent)}菜单已展开。">
              <span class="admin-menu-icon" aria-hidden="true">${escapeHtml(parentIcon[parent] || "•")}</span>
              <span>${escapeHtml(parent)}</span>
              <span class="admin-menu-caret" aria-hidden="true">⌃</span>
            </button>
            <div class="admin-menu-children">
              ${groupMap.get(parent).map(renderAdminMenuItem).join("")}
            </div>
          </div>
        `).join("")}
      </nav>
    </aside>
  `;
}

/**
 * 渲染一个后台菜单项。
 *
 * @param {string} id - 菜单对应的 activeMain。
 * @returns {string} 菜单项 HTML。
 * @throws {Error} 本函数不主动抛异常；找不到菜单时返回空字符串。
 */
function renderAdminMenuItem(id) {
  const item = ADMIN_NAV_ITEMS.find((nav) => nav.id === id);
  if (!item) return "";

  return `
    <a class="admin-menu-item ${state.activeMain === id ? "active" : ""}" href="${escapeHtml(hashForAdminMain(id))}" data-admin-route="${escapeHtml(id)}">
      <span class="admin-menu-icon" aria-hidden="true">${escapeHtml(item.icon)}</span>
      <span>${escapeHtml(item.label)}</span>
    </a>
  `;
}

/**
 * 渲染后台顶部栏。
 *
 * @returns {string} 顶部栏 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminTopbar() {
  const title = getAdminTitle(state.activeMain);
  const group = state.activeMain === "admin-home" ? "" : `<span>系统管理</span><span class="admin-crumb-sep">/</span>`;

  return `
    <header class="admin-topbar">
      <button class="admin-icon-btn" type="button" data-admin-menu-toggle="true" aria-label="展开后台菜单">☰</button>
      <nav class="admin-breadcrumb" aria-label="后台面包屑">
        ${group}
        <strong>${escapeHtml(title)}</strong>
      </nav>
      <div class="admin-top-actions">
        <a class="admin-user-interface-btn" href="#/ask">用户界面</a>
        <button class="admin-icon-btn" type="button" data-admin-action="全屏是原型反馈。">⛶</button>
        <button class="admin-user-pill" type="button" data-admin-action="Admin 用户菜单是原型反馈。">
          <span class="admin-user-avatar" aria-hidden="true">◎</span>
          <span>Admin</span>
        </button>
      </div>
    </header>
  `;
}

/**
 * 根据后台路由渲染右侧工作区。
 *
 * @returns {string} 当前后台页面 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminWorkspace() {
  if (state.activeMain === "admin-home") return renderAdminHome();
  if (state.activeMain === "admin-business") return renderAdminBusiness();
  if (state.activeMain === "admin-knowledge") return renderAdminKnowledge();
  if (state.activeMain === "admin-user") return renderAdminUserPreview();
  if (state.activeMain === "admin-user-pool") return renderAdminUserPool();
  if (state.activeMain === "admin-paid-pool") return renderAdminPaidPool();
  if (state.activeMain === "admin-user-sales") return renderAdminUserSales();
  if (state.activeMain === "admin-user-active") return renderAdminActiveUsers();
  if (state.activeMain === "admin-user-paid") return renderAdminPaidUsers();
  if (state.activeMain === "admin-agent") return renderAdminAgents();
  if (state.activeMain === "admin-invite") return renderAdminInviteCodes();
  if (state.activeMain === "admin-model") return renderAdminModels();
  if (state.activeMain === "admin-ai-cost") return renderAdminCostMonitor();
  return renderAdminCharacters();
}

/**
 * 后台首页。
 *
 * @returns {string} 首页 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminHome() {
  return `
    <section class="admin-empty-page">
      <h3>敬请期待</h3>
    </section>
  `;
}

/**
 * 获取当前成本监控来源对应的服务端配置 ID。
 *
 * @param {unknown} source - kb 或 no-kb；默认读取当前页面状态。
 * @returns {string} admin-cost-kb 或 admin-cost-no-kb。
 * @throws {Error} 本函数不主动抛异常；无效值回退到无知识库配置。
 */
function getCostMonitorConfigFeatureId(source = state.costMonitor.source) {
  return COST_MONITOR_CONFIG_FEATURES[String(source || "")] || COST_MONITOR_CONFIG_FEATURES["no-kb"];
}

/**
 * 在后台成本页首次打开时读取两个 Chatflow 的掩码配置。
 *
 * 原始 API Key 永远不会返回浏览器；这里只读取 hasKey、应用名称和已保存 Skill ID。
 *
 * @returns {Promise<void>} 读取完成后重画成本页。
 * @throws {Error} 单个读取错误已由 loadDifyFeatureConfig 写入状态，本函数不继续抛出。
 */
async function ensureCostMonitorConfigsLoaded() {
  const featureIds = Object.values(COST_MONITOR_CONFIG_FEATURES);
  const pendingFeatureIds = featureIds.filter((featureId) => {
    const config = getDifyFeatureConfig(featureId);
    return !config.loaded && !config.loading;
  });

  if (!pendingFeatureIds.length) {
    return;
  }

  await Promise.all(pendingFeatureIds.map((featureId) => loadDifyFeatureConfig(featureId)));
  if (state.activeMain === "admin-ai-cost") {
    renderApp();
  }
}

/**
 * 格式化成本页人民币金额。
 *
 * @param {unknown} value - 人民币数字。
 * @param {number} [digits=4] - 小数位数。
 * @returns {string} 例如 ¥0.1788。
 * @throws {Error} 本函数不主动抛异常。
 */
function formatCostMonitorMoney(value, digits = 4) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `¥${amount.toFixed(digits)}` : "-";
}

/**
 * 格式化 token 或工具数量。
 *
 * @param {unknown} value - 数字。
 * @returns {string} 本地化数字；无效值返回 -。
 * @throws {Error} 本函数不主动抛异常。
 */
function formatCostMonitorNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue.toLocaleString("zh-CN", { maximumFractionDigits: 4 }) : "-";
}

/**
 * 格式化时间轴相对耗时。
 *
 * @param {unknown} elapsedMs - 相对本轮开始的毫秒数。
 * @returns {string} 例如 1.3s。
 * @throws {Error} 本函数不主动抛异常。
 */
function formatCostMonitorElapsed(elapsedMs) {
  const milliseconds = Math.max(0, Number(elapsedMs) || 0);
  return `${(milliseconds / 1000).toFixed(1)}s`;
}

/**
 * 获取成本页当前状态的产品文案。
 *
 * @returns {{ label: string, detail: string, tone: string }} 状态标签。
 * @throws {Error} 本函数不主动抛异常。
 */
function getCostMonitorStatusMeta() {
  const monitor = state.costMonitor;

  if (monitor.status === "running") {
    return { label: "实时接收中", detail: "成本会随完成事件逐项入账", tone: "running" };
  }
  if (monitor.status === "done") {
    return { label: "本句已结算", detail: "等待日终供应商账单对账", tone: "done" };
  }
  if (monitor.status === "error") {
    return { label: "调用已中断", detail: monitor.error || "请检查配置后重试", tone: "error" };
  }
  return { label: "等待发送", detail: "发送后从 0 元开始逐项变化", tone: "idle" };
}

/**
 * 渲染成本监控页顶部控制区。
 *
 * @returns {string} 模式、Chatflow、场景和模型选择 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCostMonitorCommandBar() {
  const monitor = state.costMonitor;
  const status = getCostMonitorStatusMeta();
  const replayScenarios = Object.values(window.YD_COST_MONITOR.REPLAY_SCENARIOS);

  return `
    <header class="cost-monitor-command">
      <div class="cost-monitor-command-intro">
        <span class="cost-monitor-eyebrow">CHATFLOW COST TAPE</span>
        <strong>一句话，从发送到扣费</strong>
        <p>认完成事件、认实际模型、每条成本只入账一次。</p>
      </div>

      <div class="cost-monitor-mode-switch" role="group" aria-label="成本监控模式">
        <button class="${monitor.mode === "replay" ? "active" : ""}" type="button" data-cost-monitor-mode="replay">
          <span>实测回放</span>
          <small>不发送请求</small>
        </button>
        <button class="${monitor.mode === "live" ? "active" : ""}" type="button" data-cost-monitor-mode="live">
          <span>真实调用</span>
          <small>读取真实 SSE</small>
        </button>
      </div>

      <div class="cost-monitor-run-status ${escapeHtml(status.tone)}" data-cost-monitor-run-status>
        <span class="cost-monitor-status-dot" aria-hidden="true"></span>
        <div>
          <strong>${escapeHtml(status.label)}</strong>
          <small>${escapeHtml(status.detail)}</small>
        </div>
      </div>

      <div class="cost-monitor-selectors">
        ${monitor.mode === "replay" ? `
          <label>
            <span>实测场景</span>
            <select data-cost-monitor-scenario ${monitor.status === "running" ? "disabled" : ""}>
              ${replayScenarios.map((scenario) => `
                <option value="${escapeHtml(scenario.id)}" ${monitor.replayScenario === scenario.id ? "selected" : ""}>${escapeHtml(scenario.label)}</option>
              `).join("")}
            </select>
          </label>
        ` : `
          <label>
            <span>Chatflow</span>
            <select data-cost-monitor-source ${monitor.status === "running" ? "disabled" : ""}>
              <option value="no-kb" ${monitor.source === "no-kb" ? "selected" : ""}>无知识库总控</option>
              <option value="kb" ${monitor.source === "kb" ? "selected" : ""}>全技能总控（含知识库）</option>
            </select>
          </label>
        `}
        <label>
          <span>用户选择模型</span>
          <select data-cost-monitor-model ${monitor.mode === "replay" || monitor.status === "running" ? "disabled" : ""}>
            <option value="deepseek-v4-pro" ${monitor.modelKey === "deepseek-v4-pro" ? "selected" : ""}>DeepSeek Pro 路由</option>
            <option value="gemini-3.5-flash" ${monitor.modelKey === "gemini-3.5-flash" ? "selected" : ""}>Gemini 3.5 Flash</option>
          </select>
        </label>
      </div>
    </header>
  `;
}

/**
 * 渲染当前 Chatflow 的安全连接栏。
 *
 * @returns {string} 回放说明或真实连接配置 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCostMonitorConnectionPanel() {
  const monitor = state.costMonitor;

  if (monitor.mode === "replay") {
    return `
      <section class="cost-monitor-notice replay" aria-label="实测回放说明">
        <strong>当前是实测记录回放</strong>
        <span>下方用量来自已经完成的真实 API 测试；你输入的新文字不会发送到 Dify。</span>
        <button type="button" data-cost-monitor-mode="live">切到真实调用</button>
      </section>
    `;
  }

  const featureId = getCostMonitorConfigFeatureId();
  const config = getDifyFeatureConfig(featureId);
  const statusText = config.loading
    ? "正在读取安全配置…"
    : config.saving
      ? "正在校验并保存…"
      : config.error
        ? config.error
        : config.hasKey
          ? `已连接 ${config.appName || COST_MONITOR_SOURCE_LABELS[monitor.source]}`
          : "尚未保存这个 Chatflow 的 API Key";

  return `
    <section class="cost-monitor-connection ${monitor.showConnection ? "expanded" : ""} ${config.error ? "error" : ""}" aria-label="真实 Chatflow 连接">
      <div class="cost-monitor-connection-summary">
        <span class="cost-monitor-connection-mark ${config.hasKey ? "ready" : ""}" aria-hidden="true">${config.hasKey ? "✓" : "!"}</span>
        <div>
          <strong>${escapeHtml(COST_MONITOR_SOURCE_LABELS[monitor.source])}</strong>
          <small>${escapeHtml(statusText)}</small>
        </div>
        <button type="button" data-cost-monitor-toggle-connection>${monitor.showConnection ? "收起连接设置" : "配置真实连接"}</button>
      </div>
      <div class="cost-monitor-connection-detail">
        <label>
          <span>App API Key</span>
          <input type="password" value="${escapeHtml(config.apiKeyDraft)}" placeholder="${config.hasKey ? `已保存 ${escapeHtml(config.maskedKey || "app-••••")}` : "粘贴 app- 开头的 Key"}" data-cost-monitor-config-key autocomplete="off" />
        </label>
        <label>
          <span>Skill ID</span>
          <input type="text" value="${escapeHtml(config.skillKeyDraft)}" placeholder="例如 market-research；独立 App 可留空" data-cost-monitor-config-skill />
        </label>
        <button class="cost-monitor-save-config" type="button" data-cost-monitor-config-save ${config.saving ? "disabled" : ""}>
          ${config.saving ? "正在保存…" : "校验并保存连接"}
        </button>
        <p>Key 只经后端加密保存，浏览器只能读取掩码。</p>
      </div>
    </section>
  `;
}

/**
 * 渲染成本页的多轮对话内容。
 *
 * @returns {string} 用户问题与流式答案 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCostMonitorTurns() {
  const turns = state.costMonitor.turns;

  if (!turns.length) {
    return `
      <div class="cost-monitor-chat-empty">
        <span aria-hidden="true">01</span>
        <strong>先发出一句话</strong>
        <p>左边出现回答，中间出现节点事件，右边成本从 0 开始跳动。</p>
      </div>
    `;
  }

  return turns.map((turn, index) => `
    <article class="cost-monitor-turn ${turn.status}" data-cost-monitor-turn="${escapeHtml(turn.id)}">
      <div class="cost-monitor-message user">
        <span>${index + 1}</span>
        <div>
          <small>你发送</small>
          <p>${renderMultilineText(turn.question)}</p>
        </div>
      </div>
      <div class="cost-monitor-message assistant">
        <span aria-hidden="true">AI</span>
        <div>
          <small>Chatflow 返回</small>
          ${turn.answer
            ? `<div class="cost-monitor-answer">${renderMarkdown(turn.answer)}</div>`
            : `<p class="cost-monitor-answer-wait">${turn.status === "error" ? "调用中断" : "正在等待正式答案…"}</p>`}
        </div>
      </div>
    </article>
  `).join("");
}

/**
 * 渲染成本监控的聊天与输入栏。
 *
 * @returns {string} 左侧聊天列 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCostMonitorChatColumn() {
  const monitor = state.costMonitor;
  const isRunning = monitor.status === "running";
  const buttonLabel = monitor.mode === "live" ? "发送到 Chatflow" : "开始实测回放";

  return `
    <section class="cost-monitor-chat-column" aria-label="对话输入与返回">
      <header class="cost-column-heading">
        <span>01</span>
        <div>
          <strong>每一句对话</strong>
          <small>${monitor.mode === "live" ? "真实发送并持续读取 SSE" : "回放已核对的真实测试记录"}</small>
        </div>
      </header>
      <div class="cost-monitor-chat-log" data-cost-monitor-chat-list>
        ${renderCostMonitorTurns()}
      </div>
      <div class="cost-monitor-composer">
        <label for="cost-monitor-draft">本轮消息</label>
        <textarea id="cost-monitor-draft" data-cost-monitor-draft placeholder="输入一句你准备发送给 Chatflow 的话" ${isRunning ? "disabled" : ""}>${escapeHtml(monitor.draft)}</textarea>
        <div class="cost-monitor-composer-foot">
          <span>${monitor.mode === "live" ? "真实模式会发送这句话" : "回放模式不会发送这句话"}</span>
          <button type="button" data-cost-monitor-send ${isRunning || !monitor.draft.trim() ? "disabled" : ""}>
            ${isRunning ? "正在接收事件…" : buttonLabel}
          </button>
        </div>
      </div>
    </section>
  `;
}

/**
 * 渲染当前一轮的事件时间轴。
 *
 * @returns {string} 中间 Chatflow 事件带 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCostMonitorTimeline() {
  const timeline = state.costMonitor.timeline;

  if (!timeline.length) {
    return `
      <div class="cost-event-empty">
        <i></i><i></i><i></i>
        <strong>等待 Chatflow 事件</strong>
        <p>节点开始不计费；节点完成、工具成功后才写入右侧账单。</p>
      </div>
    `;
  }

  return `
    <ol class="cost-event-list">
      ${timeline.map((entry, index) => `
        <li class="${escapeHtml(entry.kind)} ${escapeHtml(entry.status)}" style="--cost-event-index:${Math.min(index, 8)}">
          <time>${escapeHtml(formatCostMonitorElapsed(entry.elapsedMs))}</time>
          <span class="cost-event-node" aria-hidden="true"></span>
          <div>
            <strong>${escapeHtml(entry.label)}</strong>
            ${entry.detail ? `<p>${escapeHtml(entry.detail)}</p>` : ""}
          </div>
        </li>
      `).join("")}
    </ol>
  `;
}

/**
 * 渲染中间的 Chatflow 事件带。
 *
 * @returns {string} 中间列 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCostMonitorEventColumn() {
  return `
    <section class="cost-monitor-event-column" aria-label="Chatflow 实时事件">
      <header class="cost-column-heading">
        <span>02</span>
        <div>
          <strong>Chatflow 事件带</strong>
          <small>按事件到达顺序留证</small>
        </div>
      </header>
      <div class="cost-event-tape" data-cost-monitor-timeline>
        ${renderCostMonitorTimeline()}
      </div>
    </section>
  `;
}

/**
 * 格式化成本明细的用量说明。
 *
 * @param {object} item - 成本项。
 * @returns {string} 适合显示在账单里的短文本。
 * @throws {Error} 本函数不主动抛异常。
 */
function formatCostMonitorUsage(item) {
  if (item.category === "llm") {
    return `输入 ${formatCostMonitorNumber(item.promptTokens)} · 输出 ${formatCostMonitorNumber(item.completionTokens)} tokens`;
  }
  if (item.category === "embedding") {
    return `${formatCostMonitorNumber(item.quantity)} tokens`;
  }
  if (item.category === "tool") {
    return item.quantity === null || item.quantity === undefined
      ? "计费数量待供应商返回"
      : `${formatCostMonitorNumber(item.quantity)} ${item.unit || "次"}`;
  }
  if (item.category === "document") {
    return `${formatCostMonitorNumber(item.quantity)} 份文档`;
  }
  if (item.category === "required") {
    return "等待完成态模型用量事件";
  }
  return `${formatCostMonitorNumber(item.quantity)} 次任务`;
}

/**
 * 格式化供应商回传金额，仅作核对，不替代管理员单价计算。
 *
 * @param {object} item - 成本项。
 * @returns {string} 原生币种金额或空字符串。
 * @throws {Error} 本函数不主动抛异常。
 */
function formatCostMonitorReportedAmount(item) {
  const amount = Number(item?.reportedAmount);
  if (!Number.isFinite(amount)) {
    return "";
  }
  const currency = String(item?.reportedCurrency || "").toUpperCase();
  return `供应商回传 ${currency || "原币"} ${amount.toFixed(7)}`;
}

/**
 * 渲染严格模型核对条。
 *
 * @returns {string} 用户选择与实际模型对照 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCostMonitorModelAudit() {
  const audit = window.YD_COST_MONITOR.getModelAudit(state.costMonitor);
  const requestedLabel = audit.requested || "未选择";

  if (audit.unresolved) {
    return `
      <div class="cost-model-audit waiting">
        <span>模型核对</span>
        <strong>${escapeHtml(requestedLabel)}</strong>
        <b aria-hidden="true">→</b>
        <em>等待 Agent 完成事件</em>
      </div>
    `;
  }

  return `
    <div class="cost-model-audit ${audit.mismatch ? "mismatch" : "matched"}">
      <span>${audit.mismatch ? "发现不一致，已纠正" : "实际模型已核对"}</span>
      <strong>${escapeHtml(requestedLabel)}</strong>
      <b aria-hidden="true">→</b>
      <em>${escapeHtml(audit.actual)}</em>
    </div>
  `;
}

/**
 * 渲染一条实时成本明细。
 *
 * @param {{ item: object, calculation: object }} line - 成本项及计算结果。
 * @returns {string} 账单行 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCostMonitorLedgerLine(line) {
  const item = line.item;
  const calculation = line.calculation;
  const identity = item.model || item.service || item.nodeLabel || item.provider || "待识别";
  const evidenceLabels = {
    exact: "实际返回",
    allocated: "按规则分摊",
    estimated: "估算",
    configured: "固定摊销",
    unpriced: "待定价"
  };

  return `
    <li class="cost-ledger-line ${calculation.missing ? "missing" : "priced"}">
      <span class="cost-ledger-index" aria-hidden="true"></span>
      <div class="cost-ledger-main">
        <div>
          <strong>${escapeHtml(item.label || "成本项")}</strong>
          <span class="cost-evidence ${escapeHtml(item.evidence || "configured")}">${escapeHtml(evidenceLabels[item.evidence] || "待核对")}</span>
        </div>
        <p>${escapeHtml(identity)}</p>
        <small>${escapeHtml(formatCostMonitorUsage(item))}</small>
        ${formatCostMonitorReportedAmount(item) ? `<small>${escapeHtml(formatCostMonitorReportedAmount(item))}</small>` : ""}
        ${calculation.missing ? `<small class="cost-ledger-reason">${escapeHtml(calculation.reason)}</small>` : ""}
      </div>
      <strong class="cost-ledger-amount">${calculation.missing ? "待补" : escapeHtml(formatCostMonitorMoney(calculation.amountRmb))}</strong>
    </li>
  `;
}

/**
 * 渲染后台单价编辑器。
 *
 * @returns {string} 可编辑单价、汇率、毛利率和 V豆参数 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCostMonitorPriceEditor() {
  const monitor = state.costMonitor;

  return `
    <section class="cost-price-editor ${monitor.showPrices ? "expanded" : ""}" aria-label="成本单价设置">
      <button class="cost-price-editor-toggle" type="button" data-cost-monitor-toggle-prices>
        <span>
          <strong>我的成本单价</strong>
          <small>示例值，可直接修改</small>
        </span>
        <b aria-hidden="true">${monitor.showPrices ? "−" : "+"}</b>
      </button>
      <div class="cost-price-editor-body">
        <div class="cost-price-global-grid">
          <label><span>美元汇率</span><input type="number" min="0" step="0.01" value="${escapeHtml(monitor.exchangeUsdRmb)}" data-cost-monitor-global-price="exchangeUsdRmb" /></label>
          <label><span>目标毛利率</span><input type="number" min="0" max="95" step="1" value="${escapeHtml(monitor.marginPercent)}" data-cost-monitor-global-price="marginPercent" /><em>%</em></label>
          <label><span>每元 V豆</span><input type="number" min="0" step="0.01" value="${escapeHtml(monitor.vbeansPerRmb)}" data-cost-monitor-global-price="vbeansPerRmb" /></label>
        </div>
        <div class="cost-price-list">
          ${window.YD_COST_MONITOR.PRICE_DEFINITIONS.map((definition) => {
            const price = monitor.prices[definition.id] || definition;
            return `
              <label class="cost-price-row">
                <span><strong>${escapeHtml(definition.label)}</strong><small>${escapeHtml(definition.unitLabel)}</small></span>
                <input type="number" min="0" step="0.001" value="${escapeHtml(price.amount)}" data-cost-monitor-price="${escapeHtml(definition.id)}" />
                <select data-cost-monitor-price-currency="${escapeHtml(definition.id)}">
                  <option value="RMB" ${price.currency === "RMB" ? "selected" : ""}>人民币</option>
                  <option value="USD" ${price.currency === "USD" ? "selected" : ""}>美元</option>
                </select>
              </label>
            `;
          }).join("")}
        </div>
      </div>
    </section>
  `;
}

/**
 * 渲染实时成本账单。
 *
 * @returns {string} 右侧总成本、销售价、V豆、明细和单价编辑器 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCostMonitorLedger() {
  const monitor = state.costMonitor;
  const summary = window.YD_COST_MONITOR.calculateSummary(monitor);
  const sessionSummary = window.YD_COST_MONITOR.calculateSessionSummary(monitor);
  const checksum = monitor.checksum;
  const hasStarted = monitor.status !== "idle";
  // Agent 用量到达后仍可能继续发生工具调用或重试；必须等 done 才能把“已知成本”冻结成最终结算。
  const canSettle = monitor.status === "done" && summary.isComplete;
  const totalHint = !hasStarted
    ? "发送后成本会随完成事件逐项变化"
    : monitor.status === "running"
      ? "调用未完成，后续事件仍可能增加成本"
      : monitor.status === "error"
        ? "调用已中断，需按供应商账单复核后再结算"
      : summary.isComplete
        ? "所有成本项已匹配单价"
        : `${summary.missingLines.length} 项等待单价或真实用量`;

  return `
    <div class="cost-ledger-receipt">
      <div class="cost-ledger-kicker">
        <span>LIVE COST</span>
        <small>${escapeHtml(COST_MONITOR_SOURCE_LABELS[monitor.source])}</small>
      </div>
      ${renderCostMonitorModelAudit()}
      <div class="cost-ledger-total ${canSettle ? "complete" : "incomplete"}">
        <span>本句话已知成本</span>
        <strong>${escapeHtml(formatCostMonitorMoney(summary.knownCostRmb))}${hasStarted && !canSettle ? "+" : ""}</strong>
        <small>${escapeHtml(totalHint)}</small>
      </div>
      <div class="cost-ledger-outcome">
        <div>
          <span>建议销售价</span>
          <strong>${!hasStarted ? "等待发送" : !canSettle || summary.salePriceRmb === null ? "暂停结算" : escapeHtml(formatCostMonitorMoney(summary.salePriceRmb))}</strong>
        </div>
        <div>
          <span>建议扣除</span>
          <strong>${!hasStarted ? "等待发送" : !canSettle || summary.vbeans === null ? "暂停扣费" : `${formatCostMonitorNumber(summary.vbeans)} V豆`}</strong>
        </div>
      </div>
      <div class="cost-ledger-session">
        <span>本会话 ${sessionSummary.turnCount} 句话</span>
        <strong>${escapeHtml(formatCostMonitorMoney(sessionSummary.knownCostRmb))}${sessionSummary.hasMissing ? "+" : ""}</strong>
      </div>
      <ol class="cost-ledger-lines">
        ${summary.lines.length
          ? summary.lines.map(renderCostMonitorLedgerLine).join("")
          : `<li class="cost-ledger-empty"><strong>¥0.0000</strong><span>发送后逐项入账</span></li>`}
      </ol>
      ${checksum ? `
        <div class="cost-ledger-checksum">
          <span>Token 校验</span>
          <strong>${formatCostMonitorNumber(checksum.totalTokens)} tokens</strong>
          <small>${escapeHtml(checksum.note)}</small>
        </div>
      ` : ""}
      <p class="cost-ledger-formula">售价 = 实际成本 ÷（1 − ${formatCostMonitorNumber(summary.marginPercent)}% 毛利率）</p>
    </div>
    ${renderCostMonitorPriceEditor()}
  `;
}

/**
 * 渲染右侧成本账单列。
 *
 * @returns {string} 右侧列 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCostMonitorLedgerColumn() {
  return `
    <aside class="cost-monitor-ledger-column" aria-label="实时成本账单">
      <header class="cost-column-heading inverse">
        <span>03</span>
        <div>
          <strong>成本实时入账</strong>
          <small>按实际模型与币种逐行计算</small>
        </div>
      </header>
      <div class="cost-monitor-ledger-body" data-cost-monitor-ledger>
        ${renderCostMonitorLedger()}
      </div>
    </aside>
  `;
}

/**
 * 后台 AI 成本监控独立页面。
 *
 * 页面采用“对话 / 事件带 / 成本账单”三段式结构，让非技术人员可以顺着一次真实调用阅读。
 *
 * @returns {string} 完整成本监控页 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminCostMonitor() {
  return `
    <section class="cost-monitor-page" aria-label="AI 成本实时监控">
      ${renderCostMonitorCommandBar()}
      ${renderCostMonitorConnectionPanel()}
      <div class="cost-monitor-stage">
        ${renderCostMonitorChatColumn()}
        ${renderCostMonitorEventColumn()}
        ${renderCostMonitorLedgerColumn()}
      </div>
      <footer class="cost-monitor-rulebook">
        <span>完成事件才入账</span>
        <span>实际模型精确匹配</span>
        <span>重试保留、重复去除</span>
        <span>混合币种逐行换汇</span>
        <span>未知成本暂停扣费</span>
        <span>日终供应商账单对账</span>
      </footer>
    </section>
  `;
}

/**
 * 知识库管理页面。
 *
 * @returns {string} 知识库页面 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminKnowledge() {
  return `
    <article class="admin-card">
      <header class="admin-card-head">
        <h3>知识库列表</h3>
        <button class="admin-primary-btn" type="button" data-admin-dialog="knowledge-add">＋ 新增</button>
      </header>
      <div class="admin-table-scroll">
        <table class="admin-table">
          <thead>
            <tr>
              <th>序号</th>
              <th>知识库名称</th>
              <th>文件URL</th>
              <th>MIME类型</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${ADMIN_KNOWLEDGE_ROWS.map((row) => `
              <tr>
                <td>${row.id}</td>
                <td>${escapeHtml(row.name)}</td>
                <td><span class="admin-url">${escapeHtml(row.url)}</span></td>
                <td>${escapeHtml(row.mime)}</td>
                <td><button class="admin-danger-link" type="button" data-admin-action="删除知识库需要二次确认，当前原型不删除。">删除</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      ${renderAdminPagination(13, 1, false)}
    </article>
  `;
}

/**
 * User Preview 页面 (同时承担「用户 > 用户总表」/admin/user 的渲染)。
 *
 * 为什么两个路由都走它:
 * - 用户运营需要看到的所有字段都在 User Preview 里 (KPI、功能调用看板、用户字段流水)。
 * - 「用户总表」就是用户运营的入口, 拆两套界面只会维护两份分歧。
 * - 旧 renderAdminUsers() 已删除; renderUserPreviewOperationContext() 也已放开,
 *   让两个路由的弹窗反馈一致。
 *
 * @returns {string} User Preview HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminUserPreview() {
  const headlineMetrics = ADMIN_USER_PREVIEW_METRICS.filter((item) => [
    "total-users",
    "total-deal-amount",
    "new-today",
    "active-today",
    "paid-today",
    "paid-total",
    "deal-amount-today",
    "token-today",
    "token-cost-today"
  ].includes(item.id));

  return `
    <article class="admin-card user-preview-page">
      <header class="admin-card-head">
        <div>
          <h3>User Preview</h3>
          <p class="admin-card-subtitle">用户增长、成交金额、活跃、付费和 Token 成本的运营看板。</p>
        </div>
        <div class="admin-head-actions">
          <button class="admin-outline-btn" type="button" data-admin-action="已模拟刷新 User Preview 数据。">刷新数据</button>
          <button class="admin-primary-btn" type="button" data-admin-action="已模拟导出下方用户字段报表。">导出报表</button>
        </div>
      </header>

      ${renderUserPreviewTimeFilter()}

      <section class="user-preview-kpis" aria-label="User Preview 核心指标">
        ${headlineMetrics.map((item) => `
          <article class="user-preview-kpi">
            <span>${escapeHtml(item.metric)}</span>
            <strong>${escapeHtml(item.value)}</strong>
            ${item.amount && item.amount !== "-" ? `<em>${escapeHtml(item.amount)}</em>` : ""}
          </article>
        `).join("")}
      </section>

      ${renderUserPreviewFunctionSummary()}

      ${renderUserPreviewReportBuilder()}
    </article>
  `;
}

/**
 * 渲染功能调用总看板。
 *
 * @returns {string} 功能调用排行表格 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderUserPreviewFunctionSummary() {
  return `
    <section class="user-preview-function-board" aria-label="功能调用总看板">
      <header>
        <h4>功能调用总看板</h4>
        <p>大家都用什么功能，用于观察功能调用、使用人数、Token 消耗和成本分布。</p>
      </header>
      <div class="admin-table-scroll flat">
        <table class="admin-table user-preview-function-table">
          <thead>
            <tr>
              <th>排行</th>
              <th>功能调用排行</th>
              <th>调用总次数</th>
              <th>使用人数</th>
              <th>人均使用时长/次数</th>
              <th>模型分配</th>
              <th>功能价值判断</th>
              <th>Token 总消耗</th>
              <th>占总消耗比例</th>
              <th>成本(估算)</th>
            </tr>
          </thead>
          <tbody>
            ${ADMIN_USER_PREVIEW_FUNCTION_SUMMARY.map((row) => `
              <tr>
                <td>${row.rank}</td>
                <td><strong>${escapeHtml(row.feature)}</strong></td>
                <td>${escapeHtml(row.calls)}</td>
                <td>${escapeHtml(row.users)}</td>
                <td>
                  <div class="admin-cell-stack compact">
                    <span>${escapeHtml(row.avgDuration)}</span>
                    <em>${escapeHtml(row.avgUse)}</em>
                  </div>
                </td>
                <td>${escapeHtml(row.modelSplit)}</td>
                <td>${renderUserPreviewValueSignal(row.valueSignal)}</td>
                <td>${escapeHtml(row.token)}</td>
                <td>${escapeHtml(row.tokenShare)}</td>
                <td class="admin-money-cell">${escapeHtml(row.cost)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

/**
 * 渲染功能价值判断标签。
 *
 * @param {string} signal - 功能价值判断，例如“刚需”“鸡肋”“需优化”。
 * @returns {string} 标签 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderUserPreviewValueSignal(signal) {
  const className = signal === "刚需" ? "must" : signal === "鸡肋" ? "weak" : signal === "需优化" ? "optimize" : "watch";
  return `<span class="user-preview-value-signal ${className}">${escapeHtml(signal || "观察")}</span>`;
}

/**
 * 渲染 User Preview 的时间范围筛选。
 *
 * 为什么放在 KPI 上方：
 * - KPI、用户明细和导出报表都应该共享同一套时间口径。
 * - 用户先选时间，再看数据，更符合运营看板的使用习惯。
 *
 * @returns {string} 时间筛选区 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderUserPreviewTimeFilter() {
  const presets = [
    { id: "today", label: "今日" },
    { id: "week", label: "本周" },
    { id: "month", label: "本月" }
  ];

  return `
    <section class="user-preview-timebar" aria-label="数据时间范围">
      <div>
        <span class="user-preview-time-label">时间范围</span>
        <strong>${escapeHtml(getUserPreviewTimeRangeLabel())}</strong>
      </div>
      <div class="user-preview-time-controls">
        <div class="user-preview-time-presets" role="group" aria-label="快捷时间">
          ${presets.map((preset) => `
            <button class="${state.userPreviewTimePreset === preset.id ? "active" : ""}" type="button" data-user-preview-time-preset="${escapeHtml(preset.id)}">
              ${escapeHtml(preset.label)}
            </button>
          `).join("")}
        </div>
        <label>
          <span>开始</span>
          <input type="date" value="${escapeHtml(state.userPreviewStartDate)}" data-user-preview-date="start" />
        </label>
        <label>
          <span>结束</span>
          <input type="date" value="${escapeHtml(state.userPreviewEndDate)}" data-user-preview-date="end" />
        </label>
        <button class="admin-outline-btn small" type="button" data-user-preview-apply-date="true">应用时间</button>
      </div>
    </section>
  `;
}

/**
 * 把 Date 对象转成 input[type=date] 需要的 yyyy-mm-dd。
 *
 * 为什么不用 toISOString：
 * - toISOString 会按 UTC 转换，东八区凌晨附近可能错一天。
 * - 这里用本地年月日拼接，和用户在浏览器看到的日期一致。
 *
 * @param {Date} date - 要格式化的日期对象。
 * @returns {string} yyyy-mm-dd 格式日期。
 * @throws {Error} 本函数不主动抛异常。
 */
function formatDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 把 yyyy-mm-dd 转成页面里更易扫读的 yyyy/mm/dd。
 *
 * @param {string} value - input[type=date] 的日期值。
 * @returns {string} 页面展示用日期。
 * @throws {Error} 本函数不主动抛异常。
 */
function formatDateDisplayValue(value) {
  return value ? value.replaceAll("-", "/") : "-";
}

/**
 * 根据快捷时间计算开始和结束日期。
 *
 * @param {"today" | "week" | "month"} preset - 快捷时间类型。
 * @returns {{ start: string, end: string }} 计算后的起止日期。
 * @throws {Error} 本函数不主动抛异常。
 */
function getUserPreviewPresetRange(preset) {
  const today = new Date();
  const start = new Date(today);

  if (preset === "week") {
    const day = today.getDay() || 7;
    start.setDate(today.getDate() - day + 1);
  }

  if (preset === "month") {
    start.setDate(1);
  }

  return {
    start: formatDateInputValue(start),
    end: formatDateInputValue(today)
  };
}

/**
 * 读取当前 User Preview 时间范围展示文案。
 *
 * @returns {string} 当前起止日期文案。
 * @throws {Error} 本函数不主动抛异常。
 */
function getUserPreviewTimeRangeLabel() {
  return `${formatDateDisplayValue(state.userPreviewStartDate)} - ${formatDateDisplayValue(state.userPreviewEndDate)}`;
}

/**
 * 设置 User Preview 快捷时间。
 *
 * @param {"today" | "week" | "month"} preset - 快捷时间类型。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function setUserPreviewTimePreset(preset) {
  const range = getUserPreviewPresetRange(preset);
  state.userPreviewTimePreset = preset;
  state.userPreviewStartDate = range.start;
  state.userPreviewEndDate = range.end;
}

/**
 * 应用用户手动输入的时间范围。
 *
 * 为什么要做顺序修正：
 * - 用户可能先选结束日期再选开始日期，导致开始晚于结束。
 * - 原型里自动交换，避免出现一个明显不可用的时间段。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function applyUserPreviewCustomDateRange() {
  state.userPreviewTimePreset = "custom";

  if (state.userPreviewStartDate && state.userPreviewEndDate && state.userPreviewStartDate > state.userPreviewEndDate) {
    const nextStart = state.userPreviewEndDate;
    state.userPreviewEndDate = state.userPreviewStartDate;
    state.userPreviewStartDate = nextStart;
  }
}

/**
 * 渲染 User Preview 字段选择器和用户报表。
 *
 * @returns {string} 字段配置区和报表表格 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderUserPreviewReportBuilder() {
  const selectedFields = getUserPreviewSelectedFields();

  return `
    <section class="user-preview-report" aria-label="用户字段报表">
      <header class="user-preview-report-head">
        <div>
          <h4>用户字段报表</h4>
          <p>默认展示用户功能调用记录；需要改字段时打开字段配置。</p>
        </div>
        <div class="user-preview-field-actions">
          <button type="button" data-user-preview-preset="default">默认字段</button>
        </div>
      </header>

      <button class="user-preview-field-collapsed" type="button" data-admin-dialog="user-preview-fields">
        <span>字段配置</span>
        <strong>${selectedFields.length} 个字段</strong>
        <em>点击展开</em>
      </button>

      <div class="admin-table-scroll user-preview-report-scroll">
        <table class="admin-table user-preview-user-table" style="min-width: ${Math.max(980, selectedFields.length * 148)}px">
          <colgroup>
            ${selectedFields.map((field) => {
              const widthMap = {
                logIndex: 96,
                usedAt: 190,
                userContact: 170
              };
              return `<col style="width: ${widthMap[field.id] || 148}px" />`;
            }).join("")}
          </colgroup>
          <thead>
            <tr>
              ${selectedFields.map((field) => `<th class="${getUserPreviewStickyClass(field.id)}">${escapeHtml(field.label)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${ADMIN_USER_PREVIEW_USERS.map((user) => `
              <tr>
                ${selectedFields.map((field) => renderUserPreviewUserCell(user, field)).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

/**
 * 渲染 User Preview 用户报表里的单个单元格。
 *
 * @param {Record<string, string>} user - 当前行用户数据。
 * @param {{ id: string, label: string, group: string }} field - 当前字段配置。
 * @returns {string} 单元格 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderUserPreviewUserCell(user, field) {
  const stickyClass = getUserPreviewStickyClass(field.id);
  const moneyClass = field.id === "amount" || field.id === "estimatedCost" || field.id === "rechargeAmount" ? "admin-money-cell" : "";

  if (field.id === "trialDetails") {
    return `
      <td class="${stickyClass}">
        <button class="admin-link user-preview-detail-link" type="button" data-user-preview-detail="${escapeHtml(user.userId || "")}">
          查看详情
        </button>
      </td>
    `;
  }

  if (field.id === "accountStatus") {
    return `
      <td class="${stickyClass}">
        ${renderUserPreviewAccountStatus(user.accountStatus || "启用")}
      </td>
    `;
  }

  if (field.id === "operationLog") {
    return renderUserPreviewOperationDropdown(user, stickyClass);
  }

  if (field.id === "accountActions") {
    return `
      <td class="${stickyClass}">
        ${renderUserPreviewOperationSelect(user)}
      </td>
    `;
  }

  return `
    <td class="${stickyClass} ${moneyClass}">${escapeHtml(user[field.id] || "-")}</td>
  `;
}

/**
 * 渲染 User Preview 宽表里的账号操作下拉。
 *
 * 为什么把原来的日志列改成下拉：
 * - 产品运营在用户总表里需要直接处理账号，而不是只看日志入口。
 * - 操作项继续通过弹窗模拟，不会真的启停账号或改积分，避免演示时产生副作用。
 *
 * @param {Record<string, string>} user - 当前行用户数据。
 * @param {string} stickyClass - 当前字段需要继承的冻结列样式。
 * @returns {string} 操作单元格 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderUserPreviewOperationDropdown(user, stickyClass) {
  return `
    <td class="${stickyClass}">
      <div class="user-preview-operation-dropdown">
        ${renderUserPreviewOperationSelect(user)}
      </div>
    </td>
  `;
}

/**
 * 渲染用户总表里复用的操作下拉。
 *
 * 为什么单独拆出来：
 * - 默认“操作”列和可选的“账户操作”字段都应该是一套入口。
 * - 统一 value 后，事件绑定可以稳定地映射到不同弹窗，不依赖中文文案判断。
 *
 * @param {Record<string, string>} user - 当前行用户数据。
 * @returns {string} 下拉框 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderUserPreviewOperationSelect(user) {
  const userId = user.userId || "";
  const userLabel = user.userContact || user.username || userId || "用户";
  const options = getUserPreviewOperationOptions(user);

  return `
    <select class="user-preview-account-action-select" data-user-preview-operation-select="${escapeHtml(userId)}" aria-label="${escapeHtml(userLabel)}账户操作">
      <option value="">选择操作</option>
      ${options.map((option) => `
        <option value="${escapeHtml(option.value)}" data-user-preview-operation-action="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>
      `).join("")}
    </select>
  `;
}

/**
 * 生成用户总表的账号操作列表。
 *
 * 为什么根据状态生成第一项：
 * - 启用中的账号最常见动作是关闭。
 * - 已关闭或禁用的账号最常见动作是重新启用。
 *
 * @param {Record<string, string>} user - 当前行用户数据。
 * @returns {Array<{ value: string, label: string }>} 下拉选项配置。
 * @throws {Error} 本函数不主动抛异常。
 */
function getUserPreviewOperationOptions(user) {
  const isEnabled = (user.accountStatus || "启用") === "启用";
  const statusOption = isEnabled
    ? { value: "status-close", label: "关闭账号" }
    : { value: "status-enable", label: "启用账号" };

  return [
    statusOption,
    { value: "points-add", label: "加积分" },
    { value: "points-close", label: "减积分" },
    { value: "sub-account", label: "调整子账号" },
    { value: "status-disable", label: "禁用账号" }
  ];
}

/**
 * 渲染 User Preview 用户状态标签。
 *
 * @param {string} status - 用户状态。
 * @returns {string} 状态标签 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderUserPreviewAccountStatus(status) {
  const className = status === "启用" ? "on" : status === "关闭" ? "off" : "disabled";
  return `<span class="user-preview-account-status ${className}">${escapeHtml(status)}</span>`;
}

/**
 * 读取当前被选中的 User Preview 字段。
 *
 * 为什么至少保留一个字段：
 * - 表格完全空白会让用户误以为数据丢了。
 * - 如果用户取消全部字段，就自动回退到“用户”字段。
 *
 * @returns {typeof ADMIN_USER_PREVIEW_FIELDS} 已选择的字段配置。
 * @throws {Error} 本函数不主动抛异常。
 */
function getUserPreviewSelectedFields() {
  const orderedIds = getUserPreviewOrderedFieldIds();
  const selected = orderedIds
    .map((fieldId) => getUserPreviewFieldById(fieldId))
    .filter(Boolean);

  return selected.length ? selected : ADMIN_USER_PREVIEW_FIELDS.slice(0, 1);
}

/**
 * 根据字段 ID 读取字段配置。
 *
 * @param {string} fieldId - 字段唯一 ID。
 * @returns {{ id: string, label: string, group: string } | undefined} 字段配置；找不到时返回 undefined。
 * @throws {Error} 本函数不主动抛异常。
 */
function getUserPreviewFieldById(fieldId) {
  return ADMIN_USER_PREVIEW_FIELDS.find((field) => field.id === fieldId);
}

/**
 * 读取 User Preview 字段的最终展示顺序。
 *
 * 为什么冻结字段永远排在前面：
 * - 横向冻结列依赖明确的 left 偏移量。
 * - 允许冻结列拖到中后段会造成滚动时列叠在一起，反而不利于后台看数。
 *
 * @returns {string[]} 已选字段 ID，冻结字段在前，其他字段按用户拖拽顺序排列。
 * @throws {Error} 本函数不主动抛异常。
 */
function getUserPreviewOrderedFieldIds() {
  const knownIds = ADMIN_USER_PREVIEW_FIELDS.map((field) => field.id);
  const selectedKnownIds = knownIds.filter((fieldId) => state.userPreviewFields.has(fieldId));
  const orderedKnownIds = state.userPreviewFieldOrder.filter((fieldId) => selectedKnownIds.includes(fieldId));
  const missingSelectedIds = selectedKnownIds.filter((fieldId) => !orderedKnownIds.includes(fieldId));
  const combinedIds = [...orderedKnownIds, ...missingSelectedIds];
  const frozenIds = USER_PREVIEW_FROZEN_FIELD_IDS.filter((fieldId) => state.userPreviewFields.has(fieldId));
  const movableIds = combinedIds.filter((fieldId) => !USER_PREVIEW_FROZEN_FIELD_IDS.includes(fieldId));

  return [...frozenIds, ...movableIds];
}

/**
 * 生成表格冻结列的 CSS 类名。
 *
 * @param {string} fieldId - 字段唯一 ID。
 * @returns {string} sticky 类名；非冻结字段返回空字符串。
 * @throws {Error} 本函数不主动抛异常。
 */
function getUserPreviewStickyClass(fieldId) {
  if (fieldId === "logIndex") return "user-preview-sticky-col sticky-log-index";
  if (fieldId === "usedAt") return "user-preview-sticky-col sticky-used-at";
  if (fieldId === "userContact") return "user-preview-sticky-col sticky-user-contact";
  return "";
}

/**
 * 局部刷新 User Preview 的字段报表区。
 *
 * 为什么不用 renderApp：
 * - renderApp 会重画整个后台页面，浏览器滚动位置会被重置。
 * - 用户在字段区勾选时只需要更新这一张报表，所以局部替换更稳定。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常；找不到报表节点时会退回整页渲染。
 */
function refreshUserPreviewReport() {
  const report = document.querySelector(".user-preview-report");

  if (!report) {
    renderApp();
    return;
  }

  const workspace = document.querySelector(".admin-workspace");
  const scrollTop = userPreviewDialogWorkspaceScrollSnapshot?.top ?? (workspace ? workspace.scrollTop : 0);
  const scrollLeft = userPreviewDialogWorkspaceScrollSnapshot?.left ?? (workspace ? workspace.scrollLeft : 0);

  report.outerHTML = renderUserPreviewReportBuilder();
  bindAdminDialogOpenControls();
  bindAdminActionControls();
  bindUserPreviewReportControls();

  if (workspace) {
    workspace.scrollTop = scrollTop;
    workspace.scrollLeft = scrollLeft;

    window.requestAnimationFrame(() => {
      workspace.scrollTop = scrollTop;
      workspace.scrollLeft = scrollLeft;
    });

    window.setTimeout(() => {
      workspace.scrollTop = scrollTop;
      workspace.scrollLeft = scrollLeft;
    }, 0);
  }
}

/**
 * 局部刷新 User Preview 字段配置弹窗和下方报表。
 *
 * 为什么不用 renderApp：
 * - renderApp 会重新创建整个弹窗，视觉上就像“闪一下”。
 * - 字段配置只是本地原型状态变化，局部替换列表和表格更安静。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function refreshUserPreviewFieldConfig() {
  const optionList = document.querySelector("[data-user-preview-option-list]");
  const selectedList = document.querySelector("[data-user-preview-selected-list]");
  const fieldCount = document.querySelector("[data-user-preview-field-count]");
  const optionScrollTop = optionList ? optionList.scrollTop : 0;
  const selectedScrollTop = selectedList ? selectedList.scrollTop : 0;

  if (optionList) {
    optionList.innerHTML = renderUserPreviewFieldOptionList();
    optionList.scrollTop = optionScrollTop;
  }

  if (selectedList) {
    selectedList.innerHTML = renderUserPreviewSelectedFieldList();
    selectedList.scrollTop = selectedScrollTop;
  }

  if (fieldCount) {
    fieldCount.textContent = `${state.userPreviewFields.size} / ${ADMIN_USER_PREVIEW_FIELDS.length}`;
  }

  const collapsedCount = document.querySelector(".user-preview-field-collapsed strong");

  if (collapsedCount) {
    collapsedCount.textContent = `${state.userPreviewFields.size} 个字段`;
  }

  window.requestAnimationFrame(() => {
    if (optionList) optionList.scrollTop = optionScrollTop;
    if (selectedList) selectedList.scrollTop = selectedScrollTop;
  });

  window.setTimeout(() => {
    if (optionList) optionList.scrollTop = optionScrollTop;
    if (selectedList) selectedList.scrollTop = selectedScrollTop;
  }, 0);
}

/**
 * 字段勾选后只刷新右侧已展示字段区。
 *
 * 为什么不刷新左侧列表：
 * - 用户点击的字段按钮就在左侧列表里。
 * - 如果把左侧列表整体重建，浏览器会丢失当前焦点并可能把滚动拉回顶部。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function refreshUserPreviewSelectedFieldsOnly() {
  const selectedList = document.querySelector("[data-user-preview-selected-list]");
  const fieldCount = document.querySelector("[data-user-preview-field-count]");
  const collapsedCount = document.querySelector(".user-preview-field-collapsed strong");
  const selectedScrollTop = selectedList ? selectedList.scrollTop : 0;

  if (selectedList) {
    selectedList.innerHTML = renderUserPreviewSelectedFieldList();
    selectedList.scrollTop = selectedScrollTop;
  }

  if (fieldCount) {
    fieldCount.textContent = `${state.userPreviewFields.size} / ${ADMIN_USER_PREVIEW_FIELDS.length}`;
  }

  if (collapsedCount) {
    collapsedCount.textContent = `${state.userPreviewFields.size} 个字段`;
  }

  window.requestAnimationFrame(() => {
    if (selectedList) selectedList.scrollTop = selectedScrollTop;
  });

  window.setTimeout(() => {
    if (selectedList) selectedList.scrollTop = selectedScrollTop;
  }, 0);

  bindUserPreviewReportControls();
}

/**
 * 渲染经营分析页 (角色化运营驾驶舱)。
 *
 * 为什么不在 User Preview 上改:
 * - User Preview 是字段流水的自由报表, 用户已有使用习惯, 不能因为重构破坏。
 * - 这里走完全独立的菜单, 走完全独立的数据 (ADMIN_BUSINESS_*),
 *   未来要不要把 User Preview 收口到这里, 等线上验证经营分析效果再说。
 *
 * @returns {string} 经营分析页 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminBusiness() {
  const tabs = getBusinessVisibleTabs();
  if (tabs.length && !tabs.some((t) => t.id === state.activeBusinessTab)) {
    state.activeBusinessTab = tabs[0].id;
  }

  return `
    <article class="admin-card business-page">
      <header class="admin-card-head business-card-head">
        <div>
          <h3>经营分析</h3>
          <p class="admin-card-subtitle">以角色为中心的运营驾驶舱:今日大盘 + 功能 ROI。用户运营请去左侧"用户"分组。</p>
        </div>
        <div class="admin-head-actions business-head-actions">
          ${renderBusinessRoleSwitcher()}
          <button class="admin-outline-btn" type="button" data-admin-action="已模拟刷新经营分析数据。">刷新数据</button>
        </div>
      </header>

      ${tabs.length ? renderBusinessTimeFilter() : ""}

      ${tabs.length ? `
        <nav class="business-tabs" role="tablist" aria-label="经营分析模块">
          ${tabs.map((t) => `
            <button class="${state.activeBusinessTab === t.id ? "active" : ""}" type="button" role="tab" data-business-tab="${escapeHtml(t.id)}">
              <strong>${escapeHtml(t.label)}</strong>
              <em>${escapeHtml(t.hint)}</em>
            </button>
          `).join("")}
        </nav>
      ` : `
        <section class="business-empty-role">
          <strong>当前角色 (客服) 不开放经营分析。</strong>
          <p>客服日常操作请使用左侧"用户"分组下的活跃用户 / 付费用户 / 公海客户。</p>
        </section>
      `}

      ${state.activeBusinessTab === "dashboard" && tabs.some((t) => t.id === "dashboard") ? renderBusinessDashboardTab() : ""}
      ${state.activeBusinessTab === "feature" && tabs.some((t) => t.id === "feature") ? renderBusinessFeatureTab() : ""}
    </article>
  `;
}

/**
 * 按当前角色返回可见的 Tab 列表。
 *
 * 为什么写成数据驱动:
 * - 后续接 RBAC 时只需要换 roles 数组, 不必动渲染逻辑。
 *
 * @returns {Array<{ id: string, label: string, hint: string, roles: string[] }>} 可见 Tab。
 * @throws {Error} 本函数不主动抛异常。
 */
function getBusinessVisibleTabs() {
  const all = [
    { id: "dashboard", label: "经营看板", hint: "趋势 · 漏斗 · 渠道", roles: ["admin","ops"] },
    { id: "feature", label: "功能洞察", hint: "ROI · 留存 · 象限", roles: ["admin","ops"] }
  ];
  return all.filter((t) => t.roles.includes(state.businessRole));
}

/**
 * 渲染顶部角色切换器 (管理员 / 运营 / 客服)。
 *
 * @returns {string} 角色切换器 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderBusinessRoleSwitcher() {
  const roles = [
    { id: "admin", label: "管理员" },
    { id: "ops", label: "运营" },
    { id: "support", label: "客服" }
  ];
  return `
    <div class="business-role-switcher" role="group" aria-label="当前角色">
      <span class="business-role-label">当前视角</span>
      ${roles.map((r) => `
        <button class="${state.businessRole === r.id ? "active" : ""}" type="button" data-business-role="${escapeHtml(r.id)}">${escapeHtml(r.label)}</button>
      `).join("")}
    </div>
  `;
}

/**
 * 渲染经营分析的时间范围条。
 *
 * @returns {string} 时间条 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderBusinessTimeFilter() {
  const presets = [
    { id: "today", label: "今日" },
    { id: "week", label: "近 7 日" },
    { id: "month", label: "近 30 日" }
  ];
  return `
    <section class="business-timebar" aria-label="时间范围">
      <div class="business-time-presets" role="group" aria-label="快捷时间">
        ${presets.map((p) => `
          <button class="${state.businessTimePreset === p.id ? "active" : ""}" type="button" data-business-time-preset="${escapeHtml(p.id)}">${escapeHtml(p.label)}</button>
        `).join("")}
      </div>
      <span class="business-time-hint">当前口径:<strong>${escapeHtml(getBusinessTimeLabel())}</strong></span>
    </section>
  `;
}

/**
 * 经营分析时间范围展示文案。
 *
 * 原型里只复用 User Preview 已有的"今日 = 2026/06/13"假口径,
 * 不联动 ADMIN_BUSINESS_TREND 截断。
 *
 * @returns {string} 时间文案。
 * @throws {Error} 本函数不主动抛异常。
 */
function getBusinessTimeLabel() {
  if (state.businessTimePreset === "today") return "2026/06/13 (今日)";
  if (state.businessTimePreset === "week") return "2026/06/07 - 2026/06/13";
  return "2026/05/15 - 2026/06/13";
}

/**
 * 渲染 Tab1 · 经营看板。
 *
 * @returns {string} 经营看板 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderBusinessDashboardTab() {
  return `
    <section class="business-dashboard" aria-label="经营看板">
      <div class="business-headline">
        ${ADMIN_BUSINESS_HEADLINE.map((item) => `
          <article class="business-headline-card">
            <span class="business-headline-label">${escapeHtml(item.metric)}</span>
            <strong>${escapeHtml(item.value)}</strong>
            <em class="business-delta ${escapeHtml(item.trend)}">${item.trend === "up" ? "▲" : "▼"} ${escapeHtml(item.delta)} <small>vs 昨日</small></em>
          </article>
        `).join("")}
      </div>

      <div class="business-sub-metrics">
        ${ADMIN_BUSINESS_SUB_METRICS.map((item) => `
          <article class="business-sub-card">
            <span>${escapeHtml(item.metric)}</span>
            <strong>${escapeHtml(item.value)}</strong>
          </article>
        `).join("")}
      </div>

      <section class="business-trend">
        <header>
          <h4>近 30 日增长趋势</h4>
          <p>注册 / 付费 / 成交金额每日变化, 拐点直观可见。</p>
        </header>
        <div class="business-trend-charts">
          ${renderBusinessTrendChart("注册数", ADMIN_BUSINESS_TREND.register, "#646cff", "")}
          ${renderBusinessTrendChart("付费数", ADMIN_BUSINESS_TREND.paid, "#10b981", "")}
          ${renderBusinessTrendChart("成交金额", ADMIN_BUSINESS_TREND.amount, "#f59e0b", "¥")}
        </div>
      </section>

      <section class="business-funnel">
        <header>
          <h4>新用户转化漏斗</h4>
          <p>注册 → 首用 → 回访 → 付费 → 续费, 哪一步最漏水。</p>
        </header>
        ${renderBusinessFunnelStages()}
      </section>

      <div class="business-grid-2col">
        <section class="business-channel">
          <header>
            <h4>渠道效率对比</h4>
            <p>看 LTV / CPA 比, 决定下一笔预算投哪。</p>
          </header>
          <div class="admin-table-scroll flat">
            <table class="admin-table business-channel-table">
              <thead>
                <tr><th>渠道</th><th>注册数</th><th>激活率</th><th>付费率</th><th>CPA</th><th>LTV</th></tr>
              </thead>
              <tbody>
                ${ADMIN_BUSINESS_CHANNELS.map((c) => `
                  <tr>
                    <td><span class="business-channel-tag ${escapeHtml(c.rating)}">${escapeHtml(c.channel)}</span></td>
                    <td>${c.register}</td>
                    <td>${escapeHtml(c.activateRate)}</td>
                    <td>${escapeHtml(c.paidRate)}</td>
                    <td>${escapeHtml(c.cpa)}</td>
                    <td><strong>${escapeHtml(c.ltv)}</strong></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </section>

        <section class="business-top-sales">
          <header>
            <h4>销售业绩 TOP 3</h4>
            <p>邀请码带来的注册和付费贡献, 直接可截图发周报。</p>
          </header>
          <ul class="business-sales-list">
            ${ADMIN_BUSINESS_TOP_SALES.map((s) => `
              <li>
                <span class="business-sales-rank">${s.rank}</span>
                <div class="business-sales-meta">
                  <strong>${escapeHtml(s.name)}</strong>
                  <em>邀请 ${s.invited} · 付费 ${s.paid}</em>
                </div>
                <span class="business-sales-amount">${escapeHtml(s.amount)}</span>
              </li>
            `).join("")}
          </ul>
        </section>
      </div>
    </section>
  `;
}

/**
 * 渲染单张趋势卡 (含 sparkline)。
 *
 * @param {string} label - 指标名。
 * @param {number[]} data - 30 天数据序列。
 * @param {string} color - 折线颜色。
 * @param {string} prefix - 数值前缀, 例如 "¥"。
 * @returns {string} 趋势卡 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderBusinessTrendChart(label, data, color, prefix) {
  const last = data[data.length - 1];
  const prev = data[data.length - 2] || 1;
  const change = Math.round((last - prev) / prev * 100);
  const trendClass = change >= 0 ? "up" : "down";
  const arrow = change >= 0 ? "▲" : "▼";
  return `
    <article class="business-trend-card">
      <header>
        <span>${escapeHtml(label)}</span>
        <div>
          <strong>${prefix || ""}${last.toLocaleString()}</strong>
          <em class="business-delta ${trendClass}">${arrow} ${Math.abs(change)}%</em>
        </div>
      </header>
      ${renderBusinessSparkline(data, color)}
    </article>
  `;
}

/**
 * 用 SVG 渲染一条迷你折线。
 *
 * 为什么自己拼 path:
 * - 原型规则:不引入 chart 库, 不加构建步骤。
 * - 一段 path + 一段 area 填充足够表达趋势, 不需要坐标轴 / tooltip。
 *
 * @param {number[]} values - 数据序列。
 * @param {string} color - 折线颜色。
 * @returns {string} SVG HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderBusinessSparkline(values, color) {
  const w = 320;
  const h = 60;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = (max - min) || 1;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = i * step;
    const y = h - 6 - ((v - min) / range) * (h - 14);
    return [x.toFixed(1), y.toFixed(1)];
  });
  const linePath = "M " + pts.map((p) => p.join(",")).join(" L ");
  const areaPath = `M 0,${h} L ${pts.map((p) => p.join(",")).join(" L ")} L ${w},${h} Z`;
  const last = pts[pts.length - 1];
  return `
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="business-sparkline" aria-hidden="true">
      <path d="${areaPath}" fill="${color}" opacity="0.12" />
      <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="${last[0]}" cy="${last[1]}" r="3" fill="${color}" />
    </svg>
  `;
}

/**
 * 渲染转化漏斗的各阶段。
 *
 * @returns {string} 漏斗阶段 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderBusinessFunnelStages() {
  const total = ADMIN_BUSINESS_FUNNEL[0].value || 1;
  return `
    <div class="business-funnel-stages">
      ${ADMIN_BUSINESS_FUNNEL.map((stage) => {
        const pct = Math.round(stage.value / total * 100);
        return `
          <div class="business-funnel-stage">
            <div class="business-funnel-stage-head">
              <strong>${escapeHtml(stage.stage)}</strong>
              ${stage.conversion
                ? `<span class="business-funnel-conv">↳ 上一步 ${escapeHtml(stage.conversion)}</span>`
                : `<span class="business-funnel-hint">${escapeHtml(stage.hint || "")}</span>`}
            </div>
            <div class="business-funnel-bar">
              <div class="business-funnel-bar-fill" style="width:${pct}%"></div>
              <span>${stage.value} 人 · ${pct}%</span>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

/**
 * 渲染 Tab2 · 功能洞察。
 *
 * @returns {string} 功能洞察 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderBusinessFeatureTab() {
  return `
    <section class="business-feature" aria-label="功能洞察">
      <section class="business-quadrant">
        <header>
          <h4>功能价值象限</h4>
          <p>用使用人数 × 留存贡献分类:高价值 / 明星潜力 / 需优化 / 鸡肋。一眼看出该砍 / 该投入哪个。</p>
        </header>
        <div class="business-quadrant-grid">
          ${ADMIN_BUSINESS_QUADRANTS.map((q) => `
            <article class="business-quadrant-cell ${escapeHtml(q.color)}">
              <header>
                <strong>${escapeHtml(q.label)}</strong>
                <span>${escapeHtml(q.hint)}</span>
              </header>
              <ul>${q.features.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>
            </article>
          `).join("")}
        </div>
      </section>

      <section class="business-feature-table-wrap">
        <header>
          <h4>功能 ROI 明细</h4>
          <p>比 User Preview 的调用看板多两列:7 日回访率 (留存) + 付费提升, 这才是判断功能价值的金标准。</p>
        </header>
        <div class="admin-table-scroll flat">
          <table class="admin-table business-feature-table">
            <thead>
              <tr><th>功能</th><th>使用人数</th><th>7 日回访率</th><th>付费提升</th><th>成本(估算)</th><th>价值标签</th></tr>
            </thead>
            <tbody>
              ${ADMIN_BUSINESS_FEATURE_INSIGHTS.map((row) => `
                <tr>
                  <td><strong>${escapeHtml(row.feature)}</strong></td>
                  <td>${row.users}</td>
                  <td>${escapeHtml(row.retention7)}</td>
                  <td><span class="business-paid-lift ${row.paidLift.startsWith("-") ? "down" : "up"}">${escapeHtml(row.paidLift)}</span></td>
                  <td class="admin-money-cell">${escapeHtml(row.cost)}</td>
                  <td>${renderBusinessRoiTag(row.roi)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  `;
}

/**
 * 渲染功能 ROI 价值标签。
 *
 * @param {string} roi - 标签文案 (高价值 / 明星 / 优化 / 观察 / 鸡肋)。
 * @returns {string} 标签 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderBusinessRoiTag(roi) {
  const cls = roi === "高价值" ? "must"
    : roi === "明星" ? "star"
    : roi === "鸡肋" ? "weak"
    : roi === "优化" ? "optimize"
    : "watch";
  return `<span class="business-roi-tag ${cls}">${escapeHtml(roi)}</span>`;
}

/**
 * 渲染一组顶部统计小卡片。
 *
 * 为什么单独抽这个 helper:
 * - 7 个用户子页都有"顶部 3-4 个关键数字"的共同结构。
 * - 不需要 KPI 折线/趋势,只要数字 + 文案 + 可选着色,因此比经营分析的 KPI 更轻量。
 *
 * @param {Array<{ label: string, value: string, tone?: "default"|"warn"|"good" }>} stats - 卡片数据。
 * @returns {string} 卡片网格 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminPageStats(stats) {
  return `
    <section class="admin-page-stats" aria-label="分类统计">
      ${stats.map((s) => `
        <article class="admin-page-stat ${s.tone || "default"}">
          <span>${escapeHtml(s.label)}</span>
          <strong>${escapeHtml(s.value)}</strong>
        </article>
      `).join("")}
    </section>
  `;
}

/**
 * 渲染一段通用筛选条 (注册时间 / 关键词等)。
 *
 * @param {{ keywordPlaceholder?: string, extraFields?: Array<{ label: string, placeholder: string }> }} opts - 配置。
 * @returns {string} 筛选条 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminSegmentFilter(opts) {
  const extra = (opts.extraFields || []).map((f) => `
    <label>
      <span>${escapeHtml(f.label)}</span>
      <input type="text" placeholder="${escapeHtml(f.placeholder)}" />
    </label>
  `).join("");
  return `
    <section class="admin-filter open" aria-label="筛选条件">
      <label>
        <span>注册时间:</span>
        <input type="text" placeholder="开始日期" />
      </label>
      <span class="admin-filter-to">至</span>
      <label>
        <input type="text" placeholder="结束日期" />
      </label>
      ${extra}
      ${opts.keywordPlaceholder ? `
        <label>
          <input type="text" placeholder="${escapeHtml(opts.keywordPlaceholder)}" />
        </label>
      ` : ""}
      <button class="admin-primary-btn small" type="button" data-admin-action="已按筛选条件执行模拟查询。">查 询</button>
      <button class="admin-ghost-btn small" type="button" data-admin-action="已重置筛选条件。">重 置</button>
    </section>
  `;
}

/**
 * 公海客户 (未分配销售的免费用户) 页面。
 *
 * @returns {string} 页面 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminUserPool() {
  const stats = [
    { label: "待分配用户", value: String(ADMIN_USER_POOL_ROWS.length), tone: "default" },
    { label: "今日新增", value: "12", tone: "good" },
    { label: "沉默 7+ 天", value: "3", tone: "warn" },
    { label: "失败异常", value: "2", tone: "warn" }
  ];
  return `
    <article class="admin-card">
      <header class="admin-card-head">
        <div>
          <h3>公海客户</h3>
          <p class="admin-card-subtitle">注册后尚未分配销售的免费用户,运营和销售可在此挑选跟进。</p>
        </div>
        <div class="admin-head-actions">
          <button class="admin-outline-btn" type="button" data-admin-action="已模拟导出公海客户名单。">导出名单</button>
          <button class="admin-primary-btn" type="button" data-admin-action="已模拟批量分配销售。">批量分配销售</button>
        </div>
      </header>
      ${renderAdminPageStats(stats)}
      ${renderAdminSegmentFilter({ keywordPlaceholder: "搜索手机号 / 来源" })}
      <div class="admin-table-scroll">
        <table class="admin-table">
          <thead>
            <tr><th>序号</th><th>用户</th><th>注册时间</th><th>注册来源</th><th>最近活跃</th><th>累计调用</th><th>状态</th><th>操作</th></tr>
          </thead>
          <tbody>
            ${ADMIN_USER_POOL_ROWS.map((row) => `
              <tr>
                <td>${row.id}</td>
                <td>${escapeHtml(row.username)}</td>
                <td>${escapeHtml(row.registeredAt)}</td>
                <td>${escapeHtml(row.source)}</td>
                <td>${escapeHtml(row.lastActiveAt)}</td>
                <td>${row.calls}</td>
                <td>${renderAdminTag(row.status)}</td>
                <td>
                  <div class="admin-row-actions">
                    <button class="admin-link" type="button" data-admin-action="已分配销售归属 (原型反馈)。">分配销售</button>
                    <button class="admin-link" type="button" data-admin-action="已标记备注 (原型反馈)。">标记</button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      ${renderAdminPagination(ADMIN_USER_POOL_ROWS.length, 1, false)}
    </article>
  `;
}

/**
 * 付费公海 (已付费但未分配销售) 页面。
 *
 * @returns {string} 页面 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminPaidPool() {
  const stats = [
    { label: "付费公海", value: String(ADMIN_PAID_POOL_ROWS.length), tone: "default" },
    { label: "累计消费", value: "¥1,392", tone: "good" },
    { label: "30 日内续费", value: "2", tone: "warn" },
    { label: "团队版", value: "2", tone: "default" }
  ];
  return `
    <article class="admin-card">
      <header class="admin-card-head">
        <div>
          <h3>付费公海</h3>
          <p class="admin-card-subtitle">已付费但还没绑定销售的用户,续费临近时务必转交销售跟进。</p>
        </div>
        <div class="admin-head-actions">
          <button class="admin-outline-btn" type="button" data-admin-action="已模拟导出付费公海名单。">导出名单</button>
          <button class="admin-primary-btn" type="button" data-admin-action="已模拟转交销售。">转交销售</button>
        </div>
      </header>
      ${renderAdminPageStats(stats)}
      ${renderAdminSegmentFilter({ keywordPlaceholder: "搜索手机号 / 套餐", extraFields: [{ label: "套餐:", placeholder: "全部套餐" }] })}
      <div class="admin-table-scroll">
        <table class="admin-table">
          <thead>
            <tr><th>序号</th><th>用户</th><th>套餐</th><th>累计消费</th><th>最近活跃</th><th>续费倒计时</th><th>操作</th></tr>
          </thead>
          <tbody>
            ${ADMIN_PAID_POOL_ROWS.map((row) => `
              <tr>
                <td>${row.id}</td>
                <td>${escapeHtml(row.username)}</td>
                <td>${escapeHtml(row.plan)}</td>
                <td><strong>${escapeHtml(row.totalSpent)}</strong></td>
                <td>${escapeHtml(row.lastActiveAt)}</td>
                <td>${escapeHtml(row.renewalCountdown)}</td>
                <td>
                  <div class="admin-row-actions">
                    <button class="admin-link" type="button" data-admin-action="已转交销售 (原型反馈)。">转交销售</button>
                    <button class="admin-link" type="button" data-admin-action="已发送续费提醒 (原型反馈)。">续费提醒</button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      ${renderAdminPagination(ADMIN_PAID_POOL_ROWS.length, 1, false)}
    </article>
  `;
}

/**
 * 销售信息 (按销售维度统计业绩) 页面。
 *
 * @returns {string} 页面 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminUserSales() {
  const totalAmount = ADMIN_SALES_ROWS.reduce((sum, r) => sum + Number(r.totalAmount.replace(/[¥,]/g, "")), 0);
  const totalUsers = ADMIN_SALES_ROWS.reduce((sum, r) => sum + r.ownedUsers, 0);
  const totalPaid = ADMIN_SALES_ROWS.reduce((sum, r) => sum + r.paidUsers, 0);
  const stats = [
    { label: "销售人数", value: String(ADMIN_SALES_ROWS.length), tone: "default" },
    { label: "名下用户", value: String(totalUsers), tone: "default" },
    { label: "付费用户", value: String(totalPaid), tone: "good" },
    { label: "累计成交", value: `¥${totalAmount.toLocaleString()}`, tone: "good" }
  ];
  return `
    <article class="admin-card">
      <header class="admin-card-head">
        <div>
          <h3>销售信息</h3>
          <p class="admin-card-subtitle">按销售维度统计业绩,直接拿来发周报或月度激励。</p>
        </div>
        <div class="admin-head-actions">
          <button class="admin-outline-btn" type="button" data-admin-action="已模拟导出销售业绩表。">导出业绩表</button>
          <button class="admin-primary-btn" type="button" data-admin-action="已模拟下发激励通知。">下发激励</button>
        </div>
      </header>
      ${renderAdminPageStats(stats)}
      <div class="admin-table-scroll">
        <table class="admin-table">
          <thead>
            <tr><th>排名</th><th>销售姓名</th><th>名下用户</th><th>付费用户</th><th>累计成交</th><th>平均 LTV</th><th>付费转化率</th><th>操作</th></tr>
          </thead>
          <tbody>
            ${ADMIN_SALES_ROWS.map((row) => `
              <tr>
                <td>${row.id}</td>
                <td><strong>${escapeHtml(row.name)}</strong></td>
                <td>${row.ownedUsers}</td>
                <td>${row.paidUsers}</td>
                <td><strong>${escapeHtml(row.totalAmount)}</strong></td>
                <td>${escapeHtml(row.avgLtv)}</td>
                <td>${escapeHtml(row.conversion)}</td>
                <td>
                  <div class="admin-row-actions">
                    <button class="admin-link" type="button" data-admin-action="已查看该销售名下用户 (原型反馈)。">查看用户</button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      ${renderAdminPagination(ADMIN_SALES_ROWS.length, 1, false)}
    </article>
  `;
}

/**
 * 活跃用户 (近 7 日有调用) 页面。
 *
 * @returns {string} 页面 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminActiveUsers() {
  const totalCalls = ADMIN_ACTIVE_USER_ROWS.reduce((sum, r) => sum + r.weekCalls, 0);
  const stats = [
    { label: "近 7 日活跃", value: String(ADMIN_ACTIVE_USER_ROWS.length), tone: "default" },
    { label: "7 日总调用", value: totalCalls.toLocaleString(), tone: "default" },
    { label: "付费占比", value: `${Math.round(ADMIN_ACTIVE_USER_ROWS.filter((r) => r.plan !== "免费版").length / ADMIN_ACTIVE_USER_ROWS.length * 100)}%`, tone: "good" },
    { label: "高频用户 (>20 次)", value: String(ADMIN_ACTIVE_USER_ROWS.filter((r) => r.weekCalls > 20).length), tone: "good" }
  ];
  return `
    <article class="admin-card">
      <header class="admin-card-head">
        <div>
          <h3>活跃用户</h3>
          <p class="admin-card-subtitle">近 7 日有调用的用户,客服优先维护这部分用户体验。</p>
        </div>
        <div class="admin-head-actions">
          <button class="admin-outline-btn" type="button" data-admin-action="已模拟导出活跃名单。">导出名单</button>
          <button class="admin-primary-btn" type="button" data-admin-action="已发送活跃用户问卷 (原型反馈)。">发送问卷</button>
        </div>
      </header>
      ${renderAdminPageStats(stats)}
      ${renderAdminSegmentFilter({ keywordPlaceholder: "搜索手机号 / 功能", extraFields: [{ label: "套餐:", placeholder: "全部" }] })}
      <div class="admin-table-scroll">
        <table class="admin-table">
          <thead>
            <tr><th>序号</th><th>用户</th><th>最近活跃</th><th>7 日调用</th><th>主要功能</th><th>当前套餐</th><th>操作</th></tr>
          </thead>
          <tbody>
            ${ADMIN_ACTIVE_USER_ROWS.map((row) => `
              <tr>
                <td>${row.id}</td>
                <td>${escapeHtml(row.username)}</td>
                <td>${escapeHtml(row.lastActiveAt)}</td>
                <td><strong>${row.weekCalls}</strong></td>
                <td>${escapeHtml(row.topFeature)}</td>
                <td>${renderAdminTag(row.plan)}</td>
                <td>
                  <div class="admin-row-actions">
                    <button class="admin-link" type="button" data-admin-action="已查看该用户使用详情 (原型反馈)。">详情</button>
                    <button class="admin-link" type="button" data-admin-action="已加 500 积分 (原型反馈)。">加积分</button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      ${renderAdminPagination(ADMIN_ACTIVE_USER_ROWS.length, 1, false)}
    </article>
  `;
}

/**
 * 付费用户 (当前付费会员) 页面。
 *
 * @returns {string} 页面 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminPaidUsers() {
  const renewals = ADMIN_PAID_USER_ROWS.filter((r) => r.status === "续费提醒").length;
  const stats = [
    { label: "付费会员", value: String(ADMIN_PAID_USER_ROWS.length), tone: "good" },
    { label: "团队版", value: String(ADMIN_PAID_USER_ROWS.filter((r) => r.plan.includes("团队")).length), tone: "default" },
    { label: "30 日内到期", value: String(renewals), tone: "warn" },
    { label: "今日新增付费", value: "9", tone: "good" }
  ];
  return `
    <article class="admin-card">
      <header class="admin-card-head">
        <div>
          <h3>付费用户</h3>
          <p class="admin-card-subtitle">当前付费会员名单,续费临近的用户重点提醒。</p>
        </div>
        <div class="admin-head-actions">
          <button class="admin-outline-btn" type="button" data-admin-action="已模拟导出付费用户名单。">导出名单</button>
          <button class="admin-primary-btn" type="button" data-admin-action="已发送续费提醒 (原型反馈)。">续费提醒模板</button>
        </div>
      </header>
      ${renderAdminPageStats(stats)}
      ${renderAdminSegmentFilter({ keywordPlaceholder: "搜索手机号", extraFields: [{ label: "套餐:", placeholder: "全部" }] })}
      <div class="admin-table-scroll">
        <table class="admin-table">
          <thead>
            <tr><th>序号</th><th>用户</th><th>套餐</th><th>充值时间</th><th>到期日</th><th>续费倒计时</th><th>状态</th><th>操作</th></tr>
          </thead>
          <tbody>
            ${ADMIN_PAID_USER_ROWS.map((row) => `
              <tr>
                <td>${row.id}</td>
                <td>${escapeHtml(row.username)}</td>
                <td>${escapeHtml(row.plan)}</td>
                <td>${escapeHtml(row.paidAt)}</td>
                <td>${escapeHtml(row.expireAt)}</td>
                <td>${escapeHtml(row.renewalCountdown)}</td>
                <td>${renderAdminTag(row.status)}</td>
                <td>
                  <div class="admin-row-actions">
                    <button class="admin-link" type="button" data-admin-action="已延长有效期 30 天 (原型反馈)。">延期</button>
                    <button class="admin-link" type="button" data-admin-action="已发起退款审核 (原型反馈)。">退款</button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      ${renderAdminPagination(ADMIN_PAID_USER_ROWS.length, 1, false)}
    </article>
  `;
}

/**
 * 代理总览 (经销代理列表) 页面。
 *
 * @returns {string} 页面 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminAgents() {
  const totalNew = ADMIN_AGENT_ROWS.reduce((sum, r) => sum + r.newUsers, 0);
  const totalPaid = ADMIN_AGENT_ROWS.reduce((sum, r) => sum + r.paidUsers, 0);
  const totalCommission = ADMIN_AGENT_ROWS.reduce((sum, r) => sum + Number(r.totalCommission.replace(/[¥,]/g, "")), 0);
  const stats = [
    { label: "代理总数", value: String(ADMIN_AGENT_ROWS.length), tone: "default" },
    { label: "拉新累计", value: String(totalNew), tone: "good" },
    { label: "付费累计", value: String(totalPaid), tone: "good" },
    { label: "累计分成", value: `¥${totalCommission.toLocaleString()}`, tone: "good" }
  ];
  return `
    <article class="admin-card">
      <header class="admin-card-head">
        <div>
          <h3>代理总览</h3>
          <p class="admin-card-subtitle">渠道代理拉新、付费转化和分成结算的全量看板。</p>
        </div>
        <div class="admin-head-actions">
          <button class="admin-outline-btn" type="button" data-admin-action="已模拟导出代理结算表。">导出结算表</button>
          <button class="admin-primary-btn" type="button" data-admin-action="已打开新增代理表单 (原型反馈)。">新增代理</button>
        </div>
      </header>
      ${renderAdminPageStats(stats)}
      <div class="admin-table-scroll">
        <table class="admin-table">
          <thead>
            <tr><th>序号</th><th>代理名</th><th>渠道码</th><th>拉新数</th><th>付费数</th><th>累计分成</th><th>状态</th><th>操作</th></tr>
          </thead>
          <tbody>
            ${ADMIN_AGENT_ROWS.map((row) => `
              <tr>
                <td>${row.id}</td>
                <td><strong>${escapeHtml(row.name)}</strong></td>
                <td><code>${escapeHtml(row.channelCode)}</code></td>
                <td>${row.newUsers}</td>
                <td>${row.paidUsers}</td>
                <td><strong>${escapeHtml(row.totalCommission)}</strong></td>
                <td>${renderAdminTag(row.status)}</td>
                <td>
                  <div class="admin-row-actions">
                    <button class="admin-link" type="button" data-admin-action="已查看代理拉新明细 (原型反馈)。">明细</button>
                    <button class="admin-link" type="button" data-admin-action="已调整分成比例 (原型反馈)。">调整分成</button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      ${renderAdminPagination(ADMIN_AGENT_ROWS.length, 1, false)}
    </article>
  `;
}

/**
 * 邀请码管理页面。
 *
 * 这个后台页面用于给销售同事生成试用福利码:
 * - 生成表单只做原型交互, 不真正创建数据库记录。
 * - 表格展示字段边界:码、积分、批次、销售归属、状态、兑换人和有效期。
 *
 * @returns {string} 邀请码管理页面 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminInviteCodes() {
  return `
    <article class="admin-card invite-admin-card">
      <header class="admin-card-head">
        <h3>邀请码管理</h3>
        <div class="admin-head-actions">
          <button class="admin-outline-btn" type="button" data-admin-action="已模拟导出邀请码批次。">导出批次</button>
        </div>
      </header>

      <section class="admin-invite-builder" aria-label="生成邀请码">
        <div class="admin-invite-builder-head">
          <div>
            <strong>生成试用福利码</strong>
            <span>给销售同事发放，用于用户侧兑换积分。</span>
          </div>
          <span class="admin-invite-badge">兑换 1 次后失效</span>
        </div>

        <div class="admin-invite-form">
          <label>
            <span>批次名称</span>
            <input type="text" value="6月销售试用福利" data-admin-invite-batch="true" />
          </label>
          <label>
            <span>单码积分</span>
            <select data-admin-invite-credit="true">
              <option value="200">200 积分</option>
              <option value="500" selected>500 积分</option>
              <option value="1000">1000 积分</option>
            </select>
          </label>
          <label>
            <span>生成数量</span>
            <input type="number" value="20" min="1" max="200" data-admin-invite-count="true" />
          </label>
          <label>
            <span>有效期</span>
            <input type="text" value="2026/07/31" data-admin-invite-expire="true" />
          </label>
          <label>
            <span>销售归属</span>
            <select data-admin-invite-owner="true">
              <option>销售A</option>
              <option>销售B</option>
              <option>销售主管</option>
            </select>
          </label>
          <button class="admin-primary-btn admin-invite-generate" type="button" data-admin-invite-generate="true">生成邀请码</button>
        </div>

        ${state.adminInvitePreview ? `
          <div class="admin-invite-preview" aria-live="polite">
            <span>最新生成</span>
            <strong>${escapeHtml(state.adminInvitePreview)}</strong>
            <em>原型预览，不写入真实后台。</em>
          </div>
        ` : ""}
      </section>

      <div class="admin-table-scroll">
        <table class="admin-table invite-table">
          <thead>
            <tr>
              <th>序号</th>
              <th>邀请码</th>
              <th>积分</th>
              <th>批次</th>
              <th>销售归属</th>
              <th>状态</th>
              <th>兑换用户</th>
              <th>兑换时间</th>
              <th>有效期</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${ADMIN_INVITE_ROWS.map((row) => `
              <tr>
                <td>${row.id}</td>
                <td><span class="admin-invite-code">${escapeHtml(row.code)}</span></td>
                <td><strong>${row.credits}</strong></td>
                <td>${escapeHtml(row.batch)}</td>
                <td>${escapeHtml(row.owner)}</td>
                <td>${renderAdminInviteStatus(row.status)}</td>
                <td>${escapeHtml(row.redeemedBy)}</td>
                <td>${escapeHtml(row.redeemedAt)}</td>
                <td>${escapeHtml(row.expiresAt)}</td>
                <td>${escapeHtml(row.createdAt)}</td>
                <td>
                  <div class="admin-row-actions">
                    <button class="admin-link" type="button" data-admin-action="复制邀请码是原型反馈。">复制</button>
                    <button class="admin-danger-link" type="button" data-admin-action="作废邀请码需要二次确认，当前原型不作废。">作废</button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      ${renderAdminPagination(4, 1, false)}
    </article>
  `;
}

/**
 * 渲染邀请码状态标签。
 *
 * @param {string} status - 邀请码状态。
 * @returns {string} 状态标签 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminInviteStatus(status) {
  const className = status === "未兑换" ? "ready" : status === "已兑换" ? "used" : "expired";
  return `<span class="admin-invite-status ${className}">${escapeHtml(status)}</span>`;
}

/**
 * AI 人设管理页面。
 *
 * @returns {string} AI 人设页面 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminCharacters() {
  return `
    <article class="admin-card">
      <header class="admin-card-head">
        <h3>人设列表</h3>
        <div class="admin-head-actions">
          <button class="admin-outline-btn" type="button" data-admin-dialog="menu-manage">☰ 菜单管理</button>
          <button class="admin-primary-btn" type="button" data-admin-dialog="character-add">＋ 新增</button>
        </div>
      </header>
      <div class="admin-table-scroll">
        <table class="admin-table character-table">
          <thead>
            <tr>
              <th>序号</th>
              <th>人设名称</th>
              <th>人设等级</th>
              <th>人设描述</th>
              <th>输入提示词</th>
              <th>人设提问说明</th>
              <th>状态</th>
              <th>排序</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${ADMIN_CHARACTER_ROWS.map((row) => `
              <tr>
                <td>${row.id}</td>
                <td>${escapeHtml(row.name)}</td>
                <td>${renderAdminTag(row.level)}</td>
                <td><span class="admin-ellipsis">${escapeHtml(row.description || "-")}</span></td>
                <td><span class="admin-ellipsis wide">${escapeHtml(row.prompt || "-")}</span></td>
                <td><span class="admin-ellipsis wide">${escapeHtml(row.guide || "-")}</span></td>
                <td>${renderAdminStatus(row.enabled)}</td>
                <td>${row.sort}</td>
                <td>
                  <div class="admin-row-actions">
                    <button class="admin-link" type="button" data-admin-dialog="character-edit">编辑</button>
                    <button class="admin-link" type="button" data-admin-dialog="character-extend">拓展</button>
                    <button class="admin-success-link" type="button" data-admin-action="${row.enabled ? "禁用" : "启用"}人设是原型反馈，不修改线上状态。">${row.enabled ? "禁用" : "启用"}</button>
                    <button class="admin-danger-link" type="button" data-admin-action="删除人设需要二次确认，当前原型不删除。">删除</button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

/**
 * AI 模型管理页面。
 *
 * @returns {string} AI 模型页面 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminModels() {
  return `
    <article class="admin-card compact">
      <header class="admin-card-head">
        <h3>AI模型列表</h3>
      </header>
      <div class="admin-table-scroll">
        <table class="admin-table model-table">
          <thead>
            <tr>
              <th>序号</th>
              <th>模型ID</th>
              <th>思考层级</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${ADMIN_MODEL_ROWS.map((row) => `
              <tr>
                <td>${row.id}</td>
                <td><span class="admin-model-id">${escapeHtml(row.modelId)}</span></td>
                <td>${renderAdminTag(row.thinking)}</td>
                <td><button class="admin-link" type="button" data-admin-dialog="model-edit">编辑</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

/**
 * 渲染后台弹窗。
 *
 * @returns {string} 当前弹窗 HTML；没有弹窗时返回空字符串。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminDialog() {
  const dialog = state.adminDialog;
  if (!dialog) return "";

  const dialogMap = {
    "knowledge-add": renderAdminKnowledgeDialog,
    "user-add": renderAdminUserDialog,
    "token-rank": renderAdminTokenRankDialog,
    "points-add": renderAdminPointsDialog,
    "points-close": renderAdminClosePointsDialog,
    "sub-account": renderAdminSubAccountDialog,
    "status-enable": () => renderAdminAccountStatusDialog("启用账号", "启用后，该用户可以继续登录并使用账号额度。", "启用原因", "请输入启用原因"),
    "status-close": () => renderAdminAccountStatusDialog("关闭账号", "关闭后，该用户暂时不可继续使用账号；后台可再次启用。", "关闭原因", "请输入关闭原因"),
    "status-disable": () => renderAdminAccountStatusDialog("禁用账号", "禁用用于处理异常账号；建议备注触发原因和后续处理人。", "禁用原因", "请输入禁用原因"),
    "character-add": () => renderAdminCharacterDialog("新增AI人设"),
    "character-edit": () => renderAdminCharacterDialog("编辑AI人设"),
    "character-extend": renderAdminCharacterExtendDialog,
    "menu-manage": renderAdminMenuDialog,
    "model-edit": renderAdminModelDialog,
    "user-preview-fields": renderUserPreviewFieldDialog,
    "user-preview-detail": renderUserPreviewDetailDialog
  };

  const renderer = dialogMap[dialog];
  if (!renderer) return "";

  return `
    <div class="admin-dialog-backdrop" data-admin-close="true">
      <section class="admin-dialog ${dialog === "menu-manage" || dialog === "user-preview-fields" || dialog === "user-preview-detail" ? "wide" : ""} ${dialog === "token-rank" ? "rank" : ""} ${dialog === "user-preview-fields" ? "field-config" : ""} ${dialog === "user-preview-detail" ? "trial-detail" : ""}" role="dialog" aria-modal="true">
        <button class="admin-dialog-close" type="button" data-admin-close="true" aria-label="关闭">×</button>
        ${renderer()}
      </section>
    </div>
  `;
}

/**
 * 渲染单个用户使用详情弹窗。
 *
 * @returns {string} 使用详情弹窗 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderUserPreviewDetailDialog() {
  const user = ADMIN_USER_PREVIEW_USERS.find((item) => item.userId === state.activeUserPreviewDetailId) || ADMIN_USER_PREVIEW_USERS[0];
  const detailRows = buildUserPreviewDetailRows(user);
  const totalCalls = detailRows.reduce((sum, row) => sum + Number(row.callCount.replaceAll(",", "")), 0);
  const totalInput = detailRows.reduce((sum, row) => sum + Number(row.inputToken.replaceAll(",", "")), 0);
  const totalOutput = detailRows.reduce((sum, row) => sum + Number(row.outputToken.replaceAll(",", "")), 0);

  return `
    <header class="trial-detail-head">
      <div>
        <h3>单个用户使用详情</h3>
        <p>${escapeHtml(user.userId || "-")} · ${escapeHtml(user.userContact || user.username || "-")}</p>
      </div>
      <span class="trial-detail-status">${escapeHtml(user.paidStatus || "免费版")}</span>
    </header>

    <section class="trial-detail-filterbar" aria-label="使用详情筛选">
      <label>
        <span>时间筛选</span>
        <select>
          <option>${escapeHtml(getUserPreviewTimeRangeLabel())}</option>
          <option>今天</option>
          <option>本周</option>
          <option>本月</option>
        </select>
      </label>
      <label>
        <span>功能筛选</span>
        <select>
          <option>全部功能</option>
          ${[...new Set(detailRows.map((row) => row.feature))].map((feature) => `<option>${escapeHtml(feature)}</option>`).join("")}
        </select>
      </label>
      <button class="admin-outline-btn small" type="button" data-admin-action="已模拟按筛选条件查看该用户明细。">查看明细</button>
    </section>

    <section class="trial-detail-summary" aria-label="功能使用次数汇总">
      <div>
        <span>调用功能</span>
        <strong>${escapeHtml(detailRows[0]?.feature || "-")}</strong>
      </div>
      <div>
        <span>调用次数</span>
        <strong>${totalCalls.toLocaleString()}</strong>
      </div>
      <div>
        <span>输入 Token</span>
        <strong>${totalInput.toLocaleString()}</strong>
      </div>
      <div>
        <span>输出 Token</span>
        <strong>${totalOutput.toLocaleString()}</strong>
      </div>
    </section>

    <section class="trial-detail-summary" aria-label="用户来源和邀请信息">
      <div>
        <span>注册来源</span>
        <strong>${escapeHtml(user.registerSource || "-")}</strong>
      </div>
      <div>
        <span>邀请码</span>
        <strong>${escapeHtml(user.inviteCode || "-")}</strong>
      </div>
      <div>
        <span>所属销售</span>
        <strong>${escapeHtml(user.salesOwner || "-")}</strong>
      </div>
      <div>
        <span>兑换时间</span>
        <strong>${escapeHtml(user.redeemedInviteAt || "-")}</strong>
      </div>
    </section>

    <div class="admin-table-scroll trial-detail-scroll">
      <table class="admin-table trial-detail-table">
        <thead>
          <tr>
            <th>时间</th>
            <th>用户ID/手机号</th>
            <th>调用功能</th>
            <th>调用模型</th>
            <th>使用次数</th>
            <th>输入 Token</th>
            <th>输出 Token</th>
            <th>消耗总计</th>
            <th>状态</th>
            <th>本次成本（估算）</th>
          </tr>
        </thead>
        <tbody>
          ${detailRows.map((row) => `
            <tr>
              <td>${escapeHtml(row.time)}</td>
              <td>${escapeHtml(row.user)}</td>
              <td>${escapeHtml(row.feature)}</td>
              <td>${escapeHtml(row.model)}</td>
              <td>${escapeHtml(row.callCount)}</td>
              <td>${escapeHtml(row.inputToken)}</td>
              <td>${escapeHtml(row.outputToken)}</td>
              <td>${escapeHtml(row.totalToken)}</td>
              <td>${escapeHtml(row.status)}</td>
              <td class="admin-money-cell">${escapeHtml(row.cost)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * 生成单个用户使用详情的明细行。
 *
 * @param {Record<string, string>} user - 当前用户。
 * @returns {Array<{ time: string, user: string, feature: string, model: string, callCount: string, inputToken: string, outputToken: string, totalToken: string, status: string, cost: string }>} 详情行。
 * @throws {Error} 本函数不主动抛异常。
 */
function buildUserPreviewDetailRows(user) {
  const baseTime = (user.usedAt || "2026/06/13 10:05").split(" ")[1] || "10:05";
  const userLabel = `${user.userId || "-"} / ${user.userContact || user.username || "-"}`;

  return [
    {
      time: `${baseTime}:01`,
      user: userLabel,
      feature: user.calledFeature || "问一下",
      model: user.calledModel || "标准",
      callCount: user.callCount || "1",
      inputToken: user.inputToken || "200",
      outputToken: user.outputToken || "500",
      totalToken: user.totalToken || "700",
      status: user.runStatus || "成功",
      cost: user.estimatedCost || "¥0.01"
    },
    {
      time: `${baseTime}:30`,
      user: userLabel,
      feature: user.lastFeature || user.topFeature || "询盘分析回复",
      model: user.modelSplit?.includes("Plus") ? "Plus" : (user.calledModel || "标准"),
      callCount: user.usageCount || user.callCount || "1",
      inputToken: user.tokenUsed?.replace("K", ",000") || user.inputToken || "1,500",
      outputToken: user.outputToken || "2,000",
      totalToken: user.totalToken || "3,500",
      status: user.runStatus || "成功",
      cost: user.estimatedCost || "¥0.07"
    }
  ];
}

/**
 * 渲染 User Preview 字段配置弹窗。
 *
 * 交互分成左右两栏：
 * - 左侧负责决定字段是否展示，用 ✅ 表示已选中。
 * - 右侧负责展示当前列顺序，非冻结字段支持拖拽排序。
 *
 * @returns {string} 字段配置弹窗 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderUserPreviewFieldDialog() {
  return `
    <h3>字段配置</h3>
    <p class="user-preview-field-dialog-desc">选择要展示的字段，右侧可调整展示顺序。</p>

    <div class="user-preview-field-dialog-grid">
      <section class="user-preview-field-panel" aria-label="选择展示字段">
        <header>
          <strong>全部字段</strong>
          <span data-user-preview-field-count>${state.userPreviewFields.size} / ${ADMIN_USER_PREVIEW_FIELDS.length}</span>
        </header>
        <div class="user-preview-field-option-list" data-user-preview-option-list>
          ${renderUserPreviewFieldOptionList()}
        </div>
      </section>

      <section class="user-preview-field-panel" aria-label="已展示字段排序">
        <header>
          <strong>已展示字段</strong>
          <span>拖拽排序</span>
        </header>
        <div class="user-preview-selected-list" data-user-preview-selected-list>
          ${renderUserPreviewSelectedFieldList()}
        </div>
      </section>
    </div>

    <footer class="admin-dialog-actions">
      <button class="admin-outline-btn" type="button" data-user-preview-preset="default">恢复默认字段</button>
      <button class="admin-primary-btn" type="button" data-admin-close="true">完成</button>
    </footer>
  `;
}

/**
 * 渲染字段配置弹窗左侧的字段选择列表。
 *
 * 为什么单独拆出来：
 * - 点击字段时只需要刷新弹窗里的列表，不需要重画整个后台页面。
 * - 这样弹窗不会闪烁，用户也不会感觉点一下就“跳一下”。
 *
 * @returns {string} 字段按钮 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderUserPreviewFieldOptionList() {
  return ADMIN_USER_PREVIEW_FIELDS.map((field) => {
    const isChecked = state.userPreviewFields.has(field.id);
    return `
      <button class="user-preview-field-option ${isChecked ? "checked" : ""}" type="button" data-user-preview-field-option="${escapeHtml(field.id)}" aria-pressed="${isChecked ? "true" : "false"}">
        <span class="user-preview-field-check" aria-hidden="true"></span>
        <span class="user-preview-field-name">
          <strong>${escapeHtml(field.label)}</strong>
          <em>${escapeHtml(field.group)}</em>
        </span>
      </button>
    `;
  }).join("");
}

/**
 * 渲染字段配置弹窗右侧的已展示字段列表。
 *
 * @returns {string} 已展示字段 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderUserPreviewSelectedFieldList() {
  const selectedIds = getUserPreviewOrderedFieldIds();
  const frozenFields = selectedIds
    .filter((fieldId) => USER_PREVIEW_FROZEN_FIELD_IDS.includes(fieldId))
    .map((fieldId) => getUserPreviewFieldById(fieldId))
    .filter(Boolean);
  const movableFields = selectedIds
    .filter((fieldId) => !USER_PREVIEW_FROZEN_FIELD_IDS.includes(fieldId))
    .map((fieldId) => getUserPreviewFieldById(fieldId))
    .filter(Boolean);

  return `
    ${frozenFields.map((field) => `
      <div class="user-preview-selected-item frozen" data-user-preview-selected="${escapeHtml(field.id)}">
        <span class="drag-handle"></span>
        <strong>${escapeHtml(field.label)}</strong>
      </div>
    `).join("")}

    ${movableFields.length ? movableFields.map((field) => `
      <button class="user-preview-selected-item" type="button" draggable="true" data-user-preview-selected="${escapeHtml(field.id)}">
        <span class="drag-handle">⋮⋮</span>
        <strong>${escapeHtml(field.label)}</strong>
        <span class="field-sort-actions">
          <span data-user-preview-move="${escapeHtml(field.id)}" data-user-preview-move-direction="up" aria-label="上移字段">↑</span>
          <span data-user-preview-move="${escapeHtml(field.id)}" data-user-preview-move-direction="down" aria-label="下移字段">↓</span>
        </span>
      </button>
    `).join("") : `
      <div class="user-preview-selected-empty">先在左侧勾选更多字段</div>
    `}
  `;
}

/**
 * 知识库新增弹窗。
 *
 * @returns {string} 弹窗内容 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminKnowledgeDialog() {
  return `
    <h3>新增知识库</h3>
    <div class="admin-form-grid">
      ${renderAdminInput("知识库名称", "请输入知识库名称", true, "0 / 100")}
      ${renderAdminSelect("MIME类型", ["application/pdf (PDF文档)", "text/plain (TXT文档)"], true)}
      <label class="admin-form-field full">
        <span><strong>*</strong> 文件</span>
        <button class="admin-upload-box" type="button" data-admin-action="文件上传是原型反馈，不读取本地文件。">⇧ 点击上传文件</button>
        <em>支持 PDF、TXT 格式文件，最大 50MB</em>
      </label>
    </div>
    ${renderAdminDialogActions("确 定")}
  `;
}

/**
 * 用户新增弹窗。
 *
 * @returns {string} 弹窗内容 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminUserDialog() {
  return `
    <h3>新增用户</h3>
    <div class="admin-form-grid two">
      ${renderAdminInput("用户名", "请输入用户名", true)}
      ${renderAdminRadio("性别", ["男", "女"], "男")}
      ${renderAdminInput("昵称", "请输入昵称", false)}
      ${renderAdminInput("手机号", "请输入手机号", false)}
      ${renderAdminInput("邮箱", "请输入邮箱", false)}
      ${renderAdminRadio("用户状态", ["启用", "禁用"], "启用", true)}
      ${renderAdminSelect("用户角色", ["请选择用户角色", "超级管理员", "运营管理员", "客服"], false)}
    </div>
    ${renderAdminDialogActions("确 认")}
  `;
}

/**
 * Token 排行弹窗。
 *
 * @returns {string} 弹窗内容 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminTokenRankDialog() {
  return `
    <h3>用户Token消费排行</h3>
    <section class="admin-filter dialog-filter">
      <label><span>开始日期：</span><input type="text" /></label>
      <label><span>结束日期：</span><input type="text" /></label>
      <button class="admin-primary-btn small" type="button" data-admin-action="Token排行查询是原型反馈。">查 询</button>
      <button class="admin-ghost-btn small" type="button" data-admin-action="已重置Token排行筛选。">重 置</button>
    </section>
    <div class="admin-table-scroll">
      <table class="admin-table">
        <thead>
          <tr><th>排名</th><th>用户ID</th><th>用户名</th><th>昵称</th><th>消息总数</th><th>Token总数</th><th>用户Token</th><th>AI Token</th></tr>
        </thead>
        <tbody><tr><td colspan="8" class="admin-empty-cell">暂无数据</td></tr></tbody>
      </table>
    </div>
    ${renderAdminPagination(0, 1, false)}
  `;
}

/**
 * 加积分弹窗。
 *
 * @returns {string} 弹窗内容 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminPointsDialog() {
  return `
    <h3>加积分</h3>
    ${renderUserPreviewOperationContext()}
    <div class="admin-form-grid">
      ${renderAdminInput("增加积分", "请输入积分数量", true)}
      ${renderAdminInput("备注", "请输入操作备注", false)}
    </div>
    ${renderAdminDialogActions("确 定")}
  `;
}

/**
 * 减积分弹窗。
 *
 * @returns {string} 弹窗内容 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminClosePointsDialog() {
  return `
    <h3>减积分</h3>
    ${renderUserPreviewOperationContext()}
    <div class="admin-form-grid">
      ${renderAdminInput("扣减积分", "请输入要扣减或关闭的积分数量", true)}
      ${renderAdminInput("备注", "请输入减积分原因", false)}
    </div>
    ${renderAdminDialogActions("确 定")}
  `;
}

/**
 * 调整子账号弹窗。
 *
 * @returns {string} 弹窗内容 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminSubAccountDialog() {
  const user = getActiveUserPreviewOperationUser();
  const subAccounts = getActiveUserPreviewSubAccounts();

  return `
    <h3>子账号管理</h3>
    ${renderUserPreviewOperationContext()}
    <p class="admin-dialog-hint">用于查看现有子账号、各子账号积分使用情况，并对单个子账号执行停用、调积分等管理动作；当前仍是原型反馈，不会修改真实账号。</p>
    ${renderAdminSubAccountSeatOverview(user, subAccounts)}
    ${renderAdminSubAccountUsageTable(subAccounts)}
    ${renderAdminDialogActions("确 定")}
  `;
}

/**
 * 渲染子账号管理弹窗里的当前席位概览。
 *
 * 为什么这里按子账号数据汇总：
 * - 当前项目是静态原型，没有真实团队席位接口。
 * - 但运营评审时需要看到“现有子账号 + 积分使用情况”的管理口径。
 *
 * @param {Record<string, string> | undefined} user - 当前操作用户。
 * @param {Array<Record<string, string | number>>} subAccounts - 当前用户名下子账号。
 * @returns {string} 席位概览 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminSubAccountSeatOverview(user, subAccounts) {
  const paidStatus = user?.paidStatus || "免费版";
  const activeCount = subAccounts.filter((item) => item.status === "启用").length;
  const summary = getSubAccountCreditSummary(subAccounts);

  return `
    <section class="sub-account-seat-overview" aria-label="当前席位概览">
      <header>
        <span>现有子账号</span>
        <strong>${escapeHtml(paidStatus)}</strong>
      </header>
      <div class="sub-account-seat-grid">
        <div><span>主账号保留</span><strong>${escapeHtml(user?.userContact || user?.username || "-")}</strong></div>
        <div><span>启用子账号</span><strong>${activeCount} / ${subAccounts.length} 个</strong></div>
        <div><span>分配积分</span><strong>${formatAdminCredit(summary.allocated)}</strong></div>
        <div><span>已用积分</span><strong>${formatAdminCredit(summary.used)}</strong></div>
        <div><span>剩余积分</span><strong>${formatAdminCredit(summary.remaining)}</strong></div>
        <div><span>最近活跃</span><strong>${escapeHtml(subAccounts[0]?.lastActiveAt || "-")}</strong></div>
      </div>
    </section>
  `;
}

/**
 * 渲染子账号积分使用情况表。
 *
 * @param {Array<Record<string, string | number>>} subAccounts - 当前用户名下子账号。
 * @returns {string} 子账号用量表 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminSubAccountUsageTable(subAccounts) {
  if (!subAccounts.length) {
    return `
      <section class="sub-account-usage-panel" aria-label="子账号积分使用情况">
      <header>
        <strong>子账号积分使用情况</strong>
        <button class="admin-primary-btn small" type="button" data-sub-account-add="true">新增子账号</button>
      </header>
      ${renderAdminSubAccountEmptyTable()}
      <div class="admin-empty-cell">当前主账号下暂无子账号。</div>
    </section>
  `;
  }

  return `
    <section class="sub-account-usage-panel" aria-label="子账号积分使用情况">
      <header>
        <strong>子账号积分使用情况</strong>
        <button class="admin-primary-btn small" type="button" data-sub-account-add="true">新增子账号</button>
      </header>
      <div class="admin-table-scroll">
        <table class="admin-table sub-account-usage-table">
          <thead>
            <tr>
              <th>子账号</th>
              <th>状态</th>
              <th>分配积分</th>
              <th>已用积分</th>
              <th>剩余积分</th>
              <th>最近活跃</th>
              <th>管理动作</th>
            </tr>
          </thead>
          <tbody>
            ${subAccounts.map((item) => `
              <tr>
                <td>
                  <strong>${escapeHtml(item.name)}</strong>
                  <em>${escapeHtml(item.phone)}</em>
                </td>
                <td>${renderUserPreviewAccountStatus(String(item.status || "启用"))}</td>
                <td>${formatAdminCredit(item.allocatedCredit)}</td>
                <td class="admin-money-cell">${formatAdminCredit(item.usedCredit)}</td>
                <td>${formatAdminCredit(item.remainingCredit)}</td>
                <td>${escapeHtml(item.lastActiveAt)}</td>
                <td>
                  <div class="sub-account-row-actions">
                    <button class="admin-danger-link" type="button" data-admin-action="已模拟停用 ${escapeHtml(item.name)}。">停用</button>
                    <button class="admin-success-link" type="button" data-admin-action="已打开 ${escapeHtml(item.name)} 的积分调整入口。">调积分</button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

/**
 * 渲染空状态下也可承接新增子账号的表格。
 *
 * 为什么空状态也保留表格：
 * - 新增表单确认后需要一个稳定的插入位置。
 * - 这样有无历史子账号时，新增动画和管理动作都保持同一套交互。
 *
 * @returns {string} 空表格 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminSubAccountEmptyTable() {
  return `
    <div class="admin-table-scroll">
      <table class="admin-table sub-account-usage-table">
        <thead>
          <tr>
            <th>子账号</th>
            <th>状态</th>
            <th>分配积分</th>
            <th>已用积分</th>
            <th>剩余积分</th>
            <th>最近活跃</th>
            <th>管理动作</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;
}

/**
 * 渲染新增子账号表单。
 *
 * @returns {string} 表单 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminSubAccountAddForm() {
  return `
    <section class="sub-account-add-form" data-sub-account-add-form="true" aria-label="新增子账号信息">
      <label>
        <span>子账号手机号</span>
        <input type="tel" inputmode="tel" placeholder="请输入手机号" data-sub-account-phone-input="true" />
      </label>
      <label>
        <span>初始分配积分</span>
        <input type="number" min="0" step="100" placeholder="例如 1000" data-sub-account-credit-input="true" />
      </label>
      <div class="sub-account-add-actions">
        <button class="admin-ghost-btn small" type="button" data-sub-account-cancel="true">取消</button>
        <button class="admin-primary-btn small" type="button" data-sub-account-confirm="true">确认新增</button>
      </div>
    </section>
  `;
}

/**
 * 渲染新增子账号的临时动画行。
 *
 * @param {string} phone - 管理员输入的子账号手机号。
 * @param {number} allocatedCredit - 管理员输入的初始分配积分。
 * @returns {string} 临时子账号行 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminSubAccountAddedRow(phone, allocatedCredit) {
  const safeCredit = Number.isFinite(allocatedCredit) ? Math.max(0, allocatedCredit) : 0;
  const displayPhone = maskAdminPhone(phone);

  return `
    <tr class="sub-account-added-row">
      <td>
        <strong>新增子账号</strong>
        <em>${escapeHtml(displayPhone)}</em>
      </td>
      <td>${renderUserPreviewAccountStatus("启用")}</td>
      <td>${formatAdminCredit(safeCredit)}</td>
      <td class="admin-money-cell">0 分</td>
      <td>${formatAdminCredit(safeCredit)}</td>
      <td>刚刚</td>
      <td>
        <div class="sub-account-row-actions">
          <button class="admin-danger-link" type="button" data-admin-action="已模拟停用新增子账号。">停用</button>
          <button class="admin-success-link" type="button" data-admin-action="已打开新增子账号的积分调整入口。">调积分</button>
        </div>
      </td>
    </tr>
  `;
}

/**
 * 解析积分输入。
 *
 * 为什么要单独解析：
 * - 用户可能输入逗号、空格或非数字内容。
 * - 原型里只需要保留一个非负整数，避免表格里出现 NaN。
 *
 * @param {unknown} rawValue - 输入框原始值。
 * @returns {number} 可用于展示的非负积分数。
 * @throws {Error} 本函数不主动抛异常。
 */
function parseAdminCreditInput(rawValue) {
  const normalized = String(rawValue || "").replace(/[^\d]/g, "");
  const parsed = Number.parseInt(normalized, 10);

  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * 将手机号做展示脱敏。
 *
 * 为什么新增时也脱敏：
 * - 原有子账号列表就是脱敏展示。
 * - 保持一致可以避免原型里不小心暴露完整手机号。
 *
 * @param {string} phone - 管理员输入的手机号。
 * @returns {string} 脱敏后的手机号；格式不符合时返回原输入。
 * @throws {Error} 本函数不主动抛异常。
 */
function maskAdminPhone(phone) {
  const trimmed = String(phone || "").trim();

  if (/^\d{7,}$/.test(trimmed)) {
    return trimmed.replace(/^(\d{3})\d+(\d{4})$/, "$1****$2");
  }

  return trimmed;
}

/**
 * 渲染账号状态操作弹窗。
 *
 * 为什么状态操作也做弹窗：
 * - 启用、关闭、禁用都会影响用户能否继续使用账号。
 * - 原型阶段先让运营看到“需要确认和备注”的后台动作形态。
 *
 * @param {string} title - 弹窗标题。
 * @param {string} description - 状态操作说明。
 * @param {string} reasonLabel - 原因输入框标题。
 * @param {string} reasonPlaceholder - 原因输入框占位提示。
 * @returns {string} 状态操作弹窗 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminAccountStatusDialog(title, description, reasonLabel, reasonPlaceholder) {
  return `
    <h3>${escapeHtml(title)}</h3>
    ${renderUserPreviewOperationContext()}
    <p class="admin-dialog-hint">${escapeHtml(description)}</p>
    <div class="admin-form-grid">
      ${renderAdminInput(reasonLabel, reasonPlaceholder, true)}
      ${renderAdminInput("备注", "请输入内部备注", false)}
    </div>
    ${renderAdminDialogActions("确 定")}
  `;
}

/**
 * 渲染 User Preview 账户操作弹窗里的用户上下文。
 *
 * 为什么只在 User Preview 里显示：
 * - 原有用户管理页也复用“加积分 / 调整子账号”弹窗。
 * - 只有从 User Preview 宽表下拉进入时，才需要明确展示当前操作对象。
 *
 * @returns {string} 用户上下文 HTML；非 User Preview 场景返回空字符串。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderUserPreviewOperationContext() {
  if (state.activeMain !== "admin-user") {
    return "";
  }

  const user = getActiveUserPreviewOperationUser();

  if (!user) {
    return "";
  }

  return `
    <div class="user-preview-operation-context">
      <span>当前用户</span>
      <strong>${escapeHtml(user.userContact || user.username || user.userId || "-")}</strong>
      <em>${escapeHtml(user.userId || "-")} · ${escapeHtml(user.paidStatus || "免费版")}</em>
    </div>
  `;
}

/**
 * 读取当前正在操作的 User Preview 用户。
 *
 * @returns {Record<string, string> | undefined} 当前用户数据；找不到时返回 undefined。
 * @throws {Error} 本函数不主动抛异常。
 */
function getActiveUserPreviewOperationUser() {
  return ADMIN_USER_PREVIEW_USERS.find((item) => item.userId === state.activeUserPreviewOperationId);
}

/**
 * 读取当前主账号名下的子账号。
 *
 * @returns {Array<Record<string, string | number>>} 当前用户的子账号列表。
 * @throws {Error} 本函数不主动抛异常。
 */
function getActiveUserPreviewSubAccounts() {
  const user = getActiveUserPreviewOperationUser();
  const userId = user?.userId || "";
  return ADMIN_USER_PREVIEW_SUB_ACCOUNTS[userId] || [];
}

/**
 * 汇总子账号积分。
 *
 * 为什么单独汇总：
 * - 弹窗顶部需要给运营一个快速判断：总共分了多少、用了多少、还剩多少。
 * - 表格继续保留单个子账号明细，避免汇总数字失去来源。
 *
 * @param {Array<Record<string, string | number>>} subAccounts - 当前主账号名下子账号。
 * @returns {{ allocated: number, used: number, remaining: number }} 积分汇总。
 * @throws {Error} 本函数不主动抛异常。
 */
function getSubAccountCreditSummary(subAccounts) {
  return subAccounts.reduce((summary, item) => {
    summary.allocated += Number(item.allocatedCredit || 0);
    summary.used += Number(item.usedCredit || 0);
    summary.remaining += Number(item.remainingCredit || 0);
    return summary;
  }, { allocated: 0, used: 0, remaining: 0 });
}

/**
 * 格式化后台积分数字。
 *
 * @param {string | number | undefined} value - 积分数。
 * @returns {string} 带千分位的积分文本。
 * @throws {Error} 本函数不主动抛异常。
 */
function formatAdminCredit(value) {
  const number = Number(value || 0);
  return `${number.toLocaleString()} 分`;
}

/**
 * AI 人设新增/编辑弹窗。
 *
 * @param {string} title - 弹窗标题。
 * @returns {string} 弹窗内容 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminCharacterDialog(title) {
  return `
    <h3>${escapeHtml(title)}</h3>
    <div class="admin-form-grid two">
      ${renderAdminSelect("人设等级", ["一级人设", "二级人设"], true)}
      ${renderAdminInput("人设名称", "请输入人设名称", true, "0 / 50")}
      ${renderAdminSelect("选择知识库", ["请选择知识库（可选），最多选择8个", "询盘分析回复", "新客开发信", "场景谈判顾问"], false)}
      ${renderAdminInput("排序", "请输入排序", false)}
      ${renderAdminSelect("角色模型", ["Dify"], true)}
      <span aria-hidden="true"></span>
      ${renderAdminPasswordInput("APP API Key", "请输入 app- 开头的 Dify App API Key", true)}
      ${renderAdminInput("Skill ID", "总控 Chatflow 填写；独立 App 可留空", false)}
      ${renderAdminTextarea("人设描述", "请输入人设描述", false)}
      <label class="admin-form-field">
        <span>Logo</span>
        <button class="admin-upload-box small" type="button" data-admin-action="Logo上传是原型反馈。">上传Logo</button>
        <em>支持 jpg、png、gif 等常见图片格式，最大 5MB，建议尺寸 200x200</em>
      </label>
      <label class="admin-form-field full">
        <span>视频</span>
        <button class="admin-upload-box" type="button" data-admin-action="视频上传是原型反馈。">点击上传视频</button>
        <em>支持 mp4、avi、mov 等常见视频格式，最大 100MB</em>
      </label>
      ${renderAdminInput("输入提示", "请输入输入提示词", false, "0 / 100")}
      ${renderAdminInput("人设提问说明", "请输入人设提问说明", false, "0 / 100")}
    </div>
    ${renderAdminDialogActions("保 存")}
  `;
}

/**
 * AI 人设拓展弹窗。
 *
 * @returns {string} 弹窗内容 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminCharacterExtendDialog() {
  return `
    <h3>拓展人设</h3>
    <div class="admin-form-grid">
      ${renderAdminInput("父级人设", "B2B销售准备", false)}
      ${renderAdminInput("拓展名称", "请输入二级人设名称", true)}
      ${renderAdminTextarea("拓展说明", "请输入拓展说明", false)}
    </div>
    ${renderAdminDialogActions("保 存")}
  `;
}

/**
 * 菜单管理弹窗。
 *
 * @returns {string} 弹窗内容 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminMenuDialog() {
  return `
    <h3>菜单管理</h3>
    <div class="admin-dialog-toolbar">
      <button class="admin-primary-btn" type="button" data-admin-action="新增菜单表单是原型反馈。">新增菜单</button>
    </div>
    <div class="admin-table-scroll menu">
      <table class="admin-table">
        <thead>
          <tr><th>ID</th><th>菜单名称</th><th>菜单等级</th><th>所属父菜单</th><th>Logo</th><th>排序</th><th>创建时间</th><th>操作</th></tr>
        </thead>
        <tbody>
          ${ADMIN_MENU_ROWS.map((row) => `
            <tr>
              <td>${row.id}</td>
              <td>${escapeHtml(row.name)}</td>
              <td>${escapeHtml(row.level)}</td>
              <td>${escapeHtml(row.parent)}</td>
              <td>${escapeHtml(row.logo)}</td>
              <td>${row.sort}</td>
              <td>${escapeHtml(row.createdAt)}</td>
              <td>
                <button class="admin-link" type="button" data-admin-action="编辑菜单是原型反馈。">编辑</button>
                <button class="admin-danger-link" type="button" data-admin-action="删除菜单需要二次确认，当前原型不删除。">删除</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * AI 模型编辑弹窗。
 *
 * @returns {string} 弹窗内容 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminModelDialog() {
  return `
    <h3>编辑AI模型</h3>
    <div class="admin-form-grid">
      ${renderAdminInput("模型ID", "gemini-3.0-pro-preview", false)}
      ${renderAdminRadio("思考层级", ["低", "中", "高"], "高")}
    </div>
    ${renderAdminDialogActions("确 定")}
  `;
}

/**
 * 渲染后台输入框。
 *
 * @param {string} label - 字段名。
 * @param {string} placeholder - 占位符。
 * @param {boolean} required - 是否必填。
 * @param {string=} counter - 字数计数文本。
 * @returns {string} 表单字段 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminInput(label, placeholder, required, counter) {
  return `
    <label class="admin-form-field">
      <span>${required ? "<strong>*</strong> " : ""}${escapeHtml(label)}</span>
      <input type="text" placeholder="${escapeHtml(placeholder)}" />
      ${counter ? `<em>${escapeHtml(counter)}</em>` : ""}
    </label>
  `;
}

/**
 * 渲染后台密钥输入框。
 *
 * 为什么单独封装：APP API Key 不能使用普通文本框明文展示；独立函数也方便开发同事替换成真实掩码回填。
 *
 * @param {string} label - 字段名。
 * @param {string} placeholder - 占位提示。
 * @param {boolean} required - 是否显示必填标记。
 * @returns {string} 密码输入框 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminPasswordInput(label, placeholder, required) {
  return `
    <label class="admin-form-field">
      <span>${required ? "<strong>*</strong> " : ""}${escapeHtml(label)}</span>
      <input type="password" placeholder="${escapeHtml(placeholder)}" autocomplete="new-password" />
    </label>
  `;
}

/**
 * 渲染后台文本域。
 *
 * @param {string} label - 字段名。
 * @param {string} placeholder - 占位符。
 * @param {boolean} required - 是否必填。
 * @returns {string} 表单字段 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminTextarea(label, placeholder, required) {
  return `
    <label class="admin-form-field full">
      <span>${required ? "<strong>*</strong> " : ""}${escapeHtml(label)}</span>
      <textarea placeholder="${escapeHtml(placeholder)}"></textarea>
    </label>
  `;
}

/**
 * 渲染后台下拉框。
 *
 * @param {string} label - 字段名。
 * @param {string[]} options - 下拉选项。
 * @param {boolean} required - 是否必填。
 * @returns {string} 表单字段 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminSelect(label, options, required) {
  return `
    <label class="admin-form-field">
      <span>${required ? "<strong>*</strong> " : ""}${escapeHtml(label)}</span>
      <select>
        ${options.map((option) => `<option>${escapeHtml(option)}</option>`).join("")}
      </select>
    </label>
  `;
}

/**
 * 渲染带说明文字的后台下拉框。
 *
 * @param {string} label - 字段名。
 * @param {string[]} options - 下拉选项。
 * @param {boolean} required - 是否必填。
 * @param {string} hint - 字段下方说明文字。
 * @returns {string} 表单字段 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminSelectField(label, options, required, hint) {
  return `
    <label class="admin-form-field">
      <span>${required ? "<strong>*</strong> " : ""}${escapeHtml(label)}</span>
      <select>
        ${options.map((option) => `<option>${escapeHtml(option)}</option>`).join("")}
      </select>
      ${renderAdminFieldHint(hint)}
    </label>
  `;
}

/**
 * 渲染后台表单字段说明。
 *
 * @param {string} hint - 字段说明文字。
 * @returns {string} 字段说明 HTML；没有说明时返回空字符串。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminFieldHint(hint) {
  return hint ? `<em>${escapeHtml(hint)}</em>` : "";
}

/**
 * 渲染后台单选组。
 *
 * @param {string} label - 字段名。
 * @param {string[]} options - 选项。
 * @param {string} active - 默认选中项。
 * @param {boolean=} required - 是否必填。
 * @returns {string} 单选组 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminRadio(label, options, active, required) {
  return `
    <fieldset class="admin-form-field">
      <legend>${required ? "<strong>*</strong> " : ""}${escapeHtml(label)}</legend>
      <div class="admin-radio-row">
        ${options.map((option) => `
          <label>
            <input type="radio" name="${escapeHtml(label)}" ${option === active ? "checked" : ""} />
            <span>${escapeHtml(option)}</span>
          </label>
        `).join("")}
      </div>
    </fieldset>
  `;
}

/**
 * 渲染弹窗底部按钮。
 *
 * @param {string} confirmText - 确认按钮文案。
 * @returns {string} 按钮区 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminDialogActions(confirmText) {
  return `
    <footer class="admin-dialog-actions">
      <button class="admin-ghost-btn" type="button" data-admin-close="true">取 消</button>
      <button class="admin-primary-btn" type="button" data-admin-action="保存是原型反馈，不提交真实后台。">${escapeHtml(confirmText)}</button>
    </footer>
  `;
}

/**
 * 渲染后台分页。
 *
 * @param {number} total - 总条数。
 * @param {number} lastPage - 最后一页页码。
 * @param {boolean} longPager - 是否展示长分页。
 * @returns {string} 分页 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminPagination(total, lastPage, longPager) {
  if (total <= 0) {
    return `<div class="admin-pagination"><span>1</span><span>10 条/页</span></div>`;
  }

  return `
    <div class="admin-pagination">
      <span>共 ${total} 条</span>
      <button disabled>‹</button>
      <button class="active">1</button>
      ${longPager ? `<button>2</button><button>3</button><button>4</button><button>5</button><span>•••</span><button>${lastPage}</button>` : ""}
      <button ${longPager ? "" : "disabled"}>›</button>
      ${longPager ? `<select><option>10 条/页</option></select><span>跳至</span><input value="" /><span>页</span>` : ""}
    </div>
  `;
}

/**
 * 后台标签。
 *
 * @param {string} label - 标签文本。
 * @returns {string} 标签 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminTag(label) {
  return `<span class="admin-tag">${escapeHtml(label)}</span>`;
}

/**
 * 后台状态标签。
 *
 * @param {boolean} enabled - 是否启用。
 * @returns {string} 状态 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminStatus(enabled) {
  return `<span class="admin-status ${enabled ? "on" : "off"}">${enabled ? "启用" : "禁用"}</span>`;
}

/**
 * 后台开关。
 *
 * @param {boolean} enabled - 是否启用。
 * @returns {string} 开关 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminSwitch(enabled) {
  return `
    <button class="admin-switch ${enabled ? "on" : ""}" type="button" data-admin-action="用户状态开关是原型反馈，不修改真实账号。">
      <span>${enabled ? "启用" : "禁用"}</span>
    </button>
  `;
}

/**
 * 获取后台页面标题。
 *
 * @param {string} main - activeMain。
 * @returns {string} 页面标题。
 * @throws {Error} 本函数不主动抛异常。
 */
function getAdminTitle(main) {
  const item = ADMIN_NAV_ITEMS.find((nav) => nav.id === main);
  return item ? item.label : "AI人设管理";
}

/**
 * 后台 main → hash。
 *
 * @param {string} main - activeMain。
 * @returns {string} hash。
 * @throws {Error} 本函数不主动抛异常。
 */
function hashForAdminMain(main) {
  const map = {
    "admin-home": "#/admin/home",
    "admin-knowledge": "#/admin/knowledge-base",
    "admin-user": "#/admin/user",
    "admin-business": "#/admin/business",
    "admin-user-pool": "#/admin/user-pool",
    "admin-paid-pool": "#/admin/paid-pool",
    "admin-user-sales": "#/admin/sales",
    "admin-user-active": "#/admin/active-user",
    "admin-user-paid": "#/admin/paid-user",
    "admin-agent": "#/admin/agent",
    "admin-invite": "#/admin/invite-code",
    "admin-character": "#/admin/ai-character",
    "admin-model": "#/admin/ai-model",
    "admin-ai-cost": "#/admin/ai-cost"
  };

  return map[main] || "#/admin/ai-character";
}

/**
 * 渲染左侧导航。
 *
 * @returns {string} 左侧导航 HTML。
 * @throws {Error} 本函数不主动抛异常；依赖 NAV_GROUPS 和 HISTORY_ITEMS 全局数据。
 */
function renderSidebar() {
  const historyItems = getFilteredHistoryItems();
  const isKassPage = state.activeMain.startsWith("customer-kass");

  return `
    <aside class="sidebar" aria-label="左侧导航">
      <header class="brand" aria-label="Vinco Order 外贸成交顾问">
        <span class="brand-logo" aria-hidden="true">
          <svg viewBox="0 0 28 22" width="22" height="20" fill="none">
            <path d="M2 4l6 14L14 4" stroke="#1a1614" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
            <path d="M20 4l4 12 2-6" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" fill="none"/>
          </svg>
        </span>
        <div class="brand-mark">Vinco <span class="brand-dot">Order</span></div>
        <div class="brand-divider"></div>
        <div class="brand-subtitle">外贸成交顾问</div>
      </header>

      <div class="sidebar-scroll">
        <nav aria-label="主导航">
          ${NAV_GROUPS.map(renderNavGroup).join("")}
        </nav>

        <section class="history-block ${isKassPage ? "kass-history-collapsed" : ""}" aria-label="历史记录">
          <div class="history-head">
            <span class="history-head-caret" aria-hidden="true">⌃</span>
            <span class="history-head-label">历史记录</span>
            ${isKassPage ? "" : `<button class="history-head-search ${state.historySearchOpen ? "active" : ""}" type="button" onclick="window.reverseYingdanToggleHistorySearch()" aria-label="搜索会话">⌕</button>`}
          </div>
          ${!isKassPage && state.historySearchOpen ? `
            <input class="history-search-input" type="search" placeholder="搜索会话标题" value="${escapeHtml(state.historySearchQuery)}" data-history-search="true" />
          ` : ""}
          ${isKassPage ? "" : `<div class="history-list">
            ${historyItems.length ? historyItems.map(renderHistoryItem).join("") : `<div class="history-empty">没有匹配的会话</div>`}
          </div>
          <button class="load-more" type="button" data-toast="这里仅展示加载更多的交互反馈，不读取真实历史。">加载更多</button>`}
        </section>
      </div>

      <footer class="sidebar-bottom">
        <button class="consultant-switch" type="button" data-popup="customerSettings">
          <span class="info-mark" aria-hidden="true">?</span>
          <span class="nav-label">Vinco Order 外贸成交顾问</span>
        </button>
        <button class="account-card" type="button" data-popup="accountSettings">
          <span class="avatar" aria-hidden="true"></span>
          <span class="account-block">
            <span class="account-phone">180****9154</span>
            <span class="account-tokens">
              <span class="account-tokens-text">445 / 520 积分 · 已用 86%</span>
              <span class="account-tokens-bar"><span class="account-tokens-fill" style="width: 86%"></span></span>
            </span>
          </span>
          <span class="account-caret" aria-hidden="true">⌃</span>
        </button>
      </footer>
    </aside>
  `;
}

/**
 * 渲染单条侧边栏历史。
 *
 * 作用：
 * - 复刻线上历史项右侧的编辑和删除小图标。
 * - 删除按钮只显示原型确认提示，不操作真实数据。
 *
 * @param {string} item - 历史标题。
 * @returns {string} 历史项 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderHistoryItem(item) {
  return `
    <div class="history-item-row">
      <button class="history-item" type="button" data-toast="已选中会话「${escapeHtml(item)}」，当前原型不读取真实会话。">${escapeHtml(item)}</button>
      <button class="history-action-btn" type="button" data-toast="编辑会话标题是原型反馈，不修改真实历史。" aria-label="编辑会话">✎</button>
      <button class="history-action-btn" type="button" data-toast="删除会话需要真实确认，当前原型不删除数据。" aria-label="删除会话">⌫</button>
    </div>
  `;
}

/**
 * 渲染客户 Kass 在全局侧栏里的等级与客户快捷入口。
 *
 * 产品已确认只对外展示 A 版：侧边栏直接显示 A/B/C/D 客户等级，
 * 客户名单留在工作区内，不再让用户选择界面方案。
 *
 * @param {typeof NAV_GROUPS[number]} group - 客户 Kass 导航配置。
 * @returns {string} 客户 Kass 侧栏 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderKassNavGroup(group) {
  const isExpanded = state.expandedGroups.has(group.id);
  const isActive = state.activeMain.startsWith("customer-kass");
  const isWorkbench = isKassWorkbenchView();
  const isComparison = isKassComparisonView();
  const workbenchGroup = isWorkbench ? getKassWorkbenchGroup() : getActiveKassGroup();

  return `
    <div class="nav-section kass-nav-section">
      <div class="kass-nav-heading">
        <button class="nav-group-trigger ${isExpanded ? "expanded" : ""} ${isActive ? "active" : ""}" type="button" data-toggle-group="${escapeHtml(group.id)}">
          <span class="nav-icon">${renderIcon(group.icon, group.label)}</span>
          <span class="nav-label">${escapeHtml(group.label)}</span>
        </button>
        <button class="kass-nav-utility" type="button" data-toast="新增客户是原型入口，不创建真实客户。" aria-label="新增客户">新增</button>
      </div>
      <div class="nav-children ${isExpanded ? "expanded" : ""}">
        <div class="nav-children-inner kass-grade-list">
          ${KASS_GROUPS.map((kassGroup) => {
            const totalCount = Number(kassGroup.totalCount || kassGroup.customers.length);
            const isSelected = workbenchGroup?.id === kassGroup.id;
            const isGradeExpanded = isComparison && state.kassExpandedGrades.has(kassGroup.id);
            const visibleCustomers = kassGroup.customers.slice(0, 5);

            return `
              <section class="kass-grade-section">
                <button
                  class="kass-grade-trigger ${isSelected ? "active" : ""}"
                  type="button"
                  ${isWorkbench
                    ? `data-kass-workbench-grade="${escapeHtml(kassGroup.id)}"${isComparison ? ` aria-expanded="${isGradeExpanded ? "true" : "false"}"` : ""}`
                    : `data-main="${escapeHtml(kassGroup.id)}"`}
                >
                  <span class="kass-grade-caret" aria-hidden="true">${isComparison ? (isGradeExpanded ? "⌄" : "›") : (isSelected ? "−" : "+")}</span>
                  <strong>${escapeHtml(kassGroup.label)}</strong>
                  <small>(${totalCount})</small>
                </button>
                ${isComparison ? `
                  <div class="kass-grade-customers ${isGradeExpanded ? "expanded" : ""}">
                    ${visibleCustomers.map((customer) => `
                      <button
                        class="kass-sidebar-customer ${state.activeCustomerId === customer.id ? "active" : ""}"
                        type="button"
                        data-customer="${escapeHtml(customer.id)}"
                        data-customer-group="${escapeHtml(kassGroup.id)}"
                        data-kass-workbench-customer="true"
                        title="${escapeHtml(customer.name)}"
                      ><span>${escapeHtml(customer.name)}</span></button>
                    `).join("")}
                    ${visibleCustomers.length ? "" : `<span class="kass-sidebar-empty">${escapeHtml(kassGroup.label)} 级暂无客户</span>`}
                    <button class="kass-view-all" type="button" data-kass-directory-open="${escapeHtml(kassGroup.id)}">
                      查看全部 ${totalCount} 个 →
                    </button>
                  </div>
                ` : ""}
              </section>
            `;
          }).join("")}
        </div>
      </div>
    </div>
  `;
}

/**
 * 渲染一个导航入口或导航分组。
 *
 * @param {typeof NAV_GROUPS[number]} group - 导航配置。
 * @returns {string} 导航 HTML。
 * @throws {Error} 本函数不主动抛异常；group.children 缺失时按空数组处理。
 */
function renderNavGroup(group) {
  if (group.id === "customer-kass") {
    return renderKassNavGroup(group);
  }

  if (group.type === "single") {
    const isActive = state.activeMain === group.id;

    return `
      <div class="nav-section">
        <button class="nav-item ${isActive ? "active" : ""}" type="button" data-main="${escapeHtml(group.id)}">
          <span class="nav-icon">${renderIcon(group.icon, group.label)}</span>
          <span class="nav-label">${escapeHtml(group.label)}</span>
        </button>
      </div>
    `;
  }

  const isExpanded = state.expandedGroups.has(group.id);
  const hasActiveChild = (group.children || []).some((child) => state.activeMain === child.id);

  let trailing = `<span class="nav-caret">›</span>`;
  if (group.id === "deal-advisor") {
    trailing = `<span class="nav-action-mark" aria-hidden="true">+</span>`;
  } else if (group.id === "customer-kass") {
    trailing = `<span class="nav-action-mark" aria-hidden="true">⚙</span>`;
  }

  return `
    <div class="nav-section">
      <button class="nav-group-trigger ${isExpanded ? "expanded" : ""} ${hasActiveChild ? "active" : ""}" type="button" data-toggle-group="${escapeHtml(group.id)}">
        <span class="nav-icon">${renderIcon(group.icon, group.label)}</span>
        <span class="nav-label">${escapeHtml(group.label)}</span>
        ${trailing}
      </button>
      <div class="nav-children ${isExpanded ? "expanded" : ""}">
        <div class="nav-children-inner">
          ${(group.children || []).map((child) => `
            <button class="nav-item nav-child ${state.activeMain === child.id ? "active" : ""}" type="button" data-main="${escapeHtml(child.id)}">
              <span class="nav-icon">${renderIcon(child.icon, child.label)}</span>
              <span class="nav-label">${escapeHtml(child.label)}</span>
            </button>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

/**
 * 渲染顶部导航栏。
 *
 * @returns {string} 顶部栏 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderTopbar() {
  if (state.activeMain.startsWith("customer-kass")) {
    const group = getActiveKassGroup();

    return `
      <header class="topbar">
        <nav class="sales-tabs kass-top-tabs" aria-label="客户Kass分组">
          <button class="sales-tab active" type="button">
            <span class="sales-tab-icon" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="8" cy="8" r="6"/>
                <path d="M2 8h12"/>
                <path d="M8 2c2.5 2.5 2.5 9.5 0 12c-2.5-2.5-2.5-9.5 0-12z"/>
              </svg>
            </span>
            <span>${escapeHtml(group.label)}</span>
          </button>
        </nav>
        ${renderTopActions()}
      </header>
    `;
  }

  if (state.activeMain !== "sales-prep") {
    const [title] = getChatLabels();
    const shouldShowChatTab = ["ask", "negotiation-scene", "inquiry-reply"].includes(state.activeMain);
    const topbarLeading = isDifyChatFeaturePage()
      ? renderDifyConfigBar()
      : shouldShowChatTab
        ? `
          <nav class="sales-tabs chat-top-tabs" aria-label="${escapeHtml(title)}">
            <button class="sales-tab active" type="button">
              <span class="sales-tab-icon" aria-hidden="true">?</span>
              <span>${escapeHtml(title)}</span>
            </button>
          </nav>
        `
        : `<div></div>`;

    return `
      <header class="topbar">
        ${topbarLeading}
        ${renderTopActions()}
      </header>
    `;
  }

  return `
    <header class="topbar">
      <nav class="sales-tabs" aria-label="销售准备子导航">
        ${SALES_TABS.map((tab) => `
          <button class="sales-tab ${state.activeSalesTab === tab.id ? "active" : ""}" type="button" data-sales-tab="${escapeHtml(tab.id)}">
            <span class="sales-tab-icon" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="8" cy="8" r="6"/>
                <path d="M2 8h12"/>
                <path d="M8 2c2.5 2.5 2.5 9.5 0 12c-2.5-2.5-2.5-9.5 0-12z"/>
              </svg>
            </span>
            <span>${escapeHtml(tab.label)}</span>
          </button>
        `).join("")}
      </nav>
      ${renderTopActions()}
    </header>
  `;
}

/**
 * 渲染右上角操作区。
 *
 * @returns {string} 操作按钮 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderTopActions() {
  const canExport = state.activeMain === "ask" || state.activeMain === "sales-prep" || state.activeMain.startsWith("customer-kass");

  return `
    <div class="top-actions">
      <a class="admin-ghost-entry" href="#/admin/home" aria-label="进入后台管理"></a>
      ${state.activeMain.startsWith("customer-kass") && state.activeKassView === "online"
        ? `<button class="kass-online-back-button" type="button" data-kass-view="workbench">返回重点推进</button>`
        : ""}
      <button class="service-pill" type="button" data-toast="客服入口是原型反馈，当前不打开真实客服。">
        <span class="service-pill-icon" aria-hidden="true">◎</span>
        <span>客服</span>
      </button>
      <button class="teach-pill" type="button" data-toast="无教学视频资源">
        <span class="teach-play" aria-hidden="true">▶</span>
        <span>教学视频</span>
      </button>
      ${canExport ? `<button class="text-action" type="button" data-toast="导出文件是原型反馈，不会下载或上传真实文件。"><span class="text-action-glyph" aria-hidden="true">⇩</span>导出文件</button>` : ""}
      <button class="text-action ${state.popup === "topHistory" ? "active" : ""}" type="button" data-popup="topHistory"><span class="text-action-glyph" aria-hidden="true">▤</span>历史</button>
    </div>
  `;
}

/**
 * 根据当前入口渲染主工作区。
 *
 * @returns {string} 工作区 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderWorkspace() {
  if (state.activeMain === "sales-prep") {
    if (state.activeSalesTab === "flow") {
      return renderFlowView();
    }

    if (state.activeSalesTab === "company") {
      return renderCompanyView();
    }

    if (state.activeSalesTab === "market") {
      return renderProductMarketView();
    }

    return renderCaseLibraryView();
  }

  if (state.activeMain.startsWith("customer-kass")) {
    return renderCustomerKassView();
  }

  if (state.activeMain.startsWith("pay-")) {
    return renderPaymentView();
  }

  if (state.activeMain === "account-usage") {
    return renderAccountUsageView();
  }

  if (state.activeMain === "customer-development") {
    return renderCustomerDevelopmentView();
  }

  return renderChatView();
}

/**
 * 渲染客户开发工作台。
 *
 * 作用：
 * - 把“客户开发”从单封开发信升级成一个完整业务界面。
 * - 用户可以先看目标客户、渠道、线索和开发节奏，再在底部输入具体开发任务。
 *
 * @returns {string} 客户开发页面 HTML。
 * @throws {Error} 本函数不主动抛异常；如果示例数据缺失，会用空数组兜底。
 */
function renderCustomerDevelopmentView() {
  const leads = CUSTOMER_DEVELOPMENT.leads || [];
  const selectedLead = leads.find((lead) => lead.id === state.customerDevSelectedLeadId) || leads[0];
  const isBrief = state.customerDevPhase === "brief";
  const isSearching = state.customerDevPhase === "searching";
  const isResults = state.customerDevPhase === "results";
  const isContacts = state.customerDevPhase === "contacts";

  return `
    <section class="customer-dev-view customer-dev-view-${escapeHtml(state.customerDevPhase)}" aria-label="客户开发">
      ${isBrief ? renderCustomerDevBriefPanel() : ""}
      ${isSearching ? renderCustomerDevSearchingPanel() : ""}
      ${isResults ? renderCustomerDevResultsWorkspace(leads, selectedLead) : ""}
      ${isContacts ? renderCustomerDevContactsWorkspace(selectedLead) : ""}
      ${isBrief ? renderCustomerDevPicker() : ""}
    </section>
  `;
}

/**
 * 渲染客户开发的目标输入区。
 *
 * 作用：
 * - 回答“客户名单从哪里来”这个产品问题。
 * - 用户先填目标市场、产品、客户角色和开发目标，再进入 AI 找客户。
 *
 * @returns {string} 目标输入区 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCustomerDevBriefPanel() {
  const brief = state.customerDevBrief;
  const customerTypes = CUSTOMER_DEVELOPMENT.customerTypes || [];
  const quantities = CUSTOMER_DEVELOPMENT.quantities || [];
  const selectedProductGroup = (CUSTOMER_DEVELOPMENT.productGroups || []).find((group) => group.products.includes(brief.product));

  return `
    <section class="customer-dev-brief-panel" aria-label="输入客户开发目标">
      <article class="customer-dev-enrichment-home">
        <header class="customer-dev-enrichment-hero">
          <span class="customer-dev-enrichment-kicker">Lead Enrichment&nbsp;&nbsp;·&nbsp;&nbsp;客户情报补全</span>
          <h1>从一条线索，补全成可行动的客户情报</h1>
          <p>全网多源数据自动搜集与验证，生成完整公司与联系人画像，助你更快触达、更高转化。</p>
        </header>

        <div class="customer-dev-brief-fields">
          <div class="customer-dev-brief-field">
            <span class="customer-dev-field-label"><small>01</small>目标国家 / 地区</span>
            <button class="customer-dev-select-trigger" type="button" data-customer-dev-picker="market" aria-haspopup="dialog">
              <span><strong>${escapeHtml(brief.market)}</strong><em>按大洲选择 · 单选</em></span>
              <b aria-hidden="true">⌄</b>
            </button>
          </div>

          <div class="customer-dev-brief-field">
            <span class="customer-dev-field-label"><small>02</small>行业产品</span>
            <button class="customer-dev-select-trigger" type="button" data-customer-dev-picker="product" aria-haspopup="dialog">
              <span><strong>${escapeHtml(brief.product)}</strong><em>${escapeHtml(selectedProductGroup?.label || "按行业大类选择")}</em></span>
              <b aria-hidden="true">⌄</b>
            </button>
          </div>

          <label class="customer-dev-brief-field">
            <span class="customer-dev-field-label"><small>03</small>客户类型</span>
            <select class="customer-dev-field-select" data-customer-dev-field="role" aria-label="客户类型">
              ${[...new Set([brief.role, ...customerTypes])].map((option) => `
                <option value="${escapeHtml(option)}" ${option === brief.role ? "selected" : ""}>${escapeHtml(option)}</option>
              `).join("")}
            </select>
          </label>

          <label class="customer-dev-brief-field">
            <span class="customer-dev-field-label"><small>04</small>目标客户数量</span>
            <select class="customer-dev-field-select" data-customer-dev-field="quantity" aria-label="目标客户数量">
              ${[...new Set([Number(brief.quantity), ...quantities])].map((quantity) => `
                <option value="${escapeHtml(quantity)}" ${String(quantity) === brief.quantity ? "selected" : ""}>${escapeHtml(quantity)} 家</option>
              `).join("")}
            </select>
          </label>
        </div>

        <div class="customer-dev-enrichment-action">
          <div class="customer-dev-engine-ready">
            <i aria-hidden="true"></i>
            <span>
              <small>全球获客引擎已就绪</small>
              <strong>${escapeHtml(brief.market)} · ${escapeHtml(brief.product)} · ${escapeHtml(brief.quantity)} 家</strong>
            </span>
          </div>
          <a class="customer-dev-launch" href="#/customer-development/searching" data-customer-dev-start>
            <span>
              <small>AI 全网搜索 · 即刻生成名单</small>
              <strong>启动搜索，锁定成交机会</strong>
            </span>
            <b aria-hidden="true">↗</b>
          </a>
        </div>

        <footer class="customer-dev-recent-searches" aria-label="最近搜索模板">
          <span>最近搜索模板：</span>
          <button type="button" data-customer-dev-preset="德国光伏储能">德国 · 光伏组件 · EPC 承包商 · 100 家</button>
          <button type="button" data-customer-dev-preset="阿联酋逆变器分销">阿联酋 · 光伏逆变器 · 分销商 · 80 家</button>
          <button type="button" data-customer-dev-preset="沙特工商业储能">沙特阿拉伯 · 工商业储能 · 系统集成商 · 120 家</button>
          <button type="button" class="customer-dev-clear-recent" data-customer-dev-clear-history>清空历史</button>
        </footer>
      </article>
    </section>
  `;
}

/**
 * 渲染客户开发的国家或行业产品选择弹窗。
 *
 * 作用：
 * - 国家按大洲分组，产品按行业大类分组，避免把大量选项塞进原生下拉框。
 * - 两类选择都保持单选；点击具体选项后立即写入条件并关闭弹窗。
 *
 * @returns {string} 选择器弹窗 HTML；未打开选择器时返回空字符串。
 * @throws {Error} 本函数不主动抛异常；数据为空时使用空数组兜底。
 */
function renderCustomerDevPicker() {
  const picker = state.customerDevPicker;

  if (!picker) {
    return "";
  }

  const isMarket = picker === "market";
  const groups = isMarket
    ? (CUSTOMER_DEVELOPMENT.countryGroups || [])
    : (CUSTOMER_DEVELOPMENT.productGroups || []);
  const activeGroupId = isMarket ? state.customerDevContinent : state.customerDevProductCategory;
  const activeGroup = groups.find((group) => group.id === activeGroupId) || groups[0];
  const options = isMarket ? (activeGroup?.countries || []) : (activeGroup?.products || []);
  const selectedValue = isMarket ? state.customerDevBrief.market : state.customerDevBrief.product;
  const totalOptions = groups.reduce((total, group) => {
    const groupOptions = isMarket ? (group.countries || []) : (group.products || []);
    return total + groupOptions.length;
  }, 0);

  return `
    <div class="customer-dev-picker-layer">
      <button class="customer-dev-picker-backdrop" type="button" data-customer-dev-picker-close aria-label="关闭选择弹窗"></button>
      <section class="customer-dev-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="customer-dev-picker-title" tabindex="-1">
        <header>
          <div>
            <span>${isMarket ? "GLOBAL MARKET" : "INDUSTRY PRODUCT"}</span>
            <h2 id="customer-dev-picker-title">${isMarket ? "选择一个目标国家 / 地区" : "选择一个行业产品"}</h2>
            <p>${isMarket
              ? `按七大洲浏览，共收录 ${totalOptions} 个国家 / 地区；当前为单选。`
              : `按 ${groups.length} 个行业大类浏览，共收录 ${totalOptions} 个产品；选择后用于匹配目标客户。`
            }</p>
          </div>
          <button class="customer-dev-picker-close" type="button" data-customer-dev-picker-close aria-label="关闭">×</button>
        </header>

        <div class="customer-dev-picker-content">
          <nav aria-label="${isMarket ? "大洲" : "行业大类"}">
            ${groups.map((group) => {
              const groupOptions = isMarket ? (group.countries || []) : (group.products || []);
              return `
                <button class="${group.id === activeGroup?.id ? "active" : ""}" type="button" ${isMarket ? "data-customer-dev-continent" : "data-customer-dev-product-category"}="${escapeHtml(group.id)}" aria-pressed="${group.id === activeGroup?.id}">
                  <span>${escapeHtml(group.label)}</span>
                  <small>${groupOptions.length}</small>
                </button>
              `;
            }).join("")}
          </nav>

          <div class="customer-dev-picker-options">
            <div class="customer-dev-picker-options-head">
              <div>
                <small>${isMarket ? "按大洲浏览" : "按行业大类浏览"}</small>
                <h3>${escapeHtml(activeGroup?.label || "请选择")}</h3>
              </div>
              <span><i aria-hidden="true"></i> 单选 · 选择后自动返回</span>
            </div>
            <div class="customer-dev-picker-option-grid ${isMarket ? "is-country" : "is-product"}">
              ${renderCustomerDevPickerOptions(options, isMarket, selectedValue)}
            </div>
          </div>
        </div>
      </section>
    </div>
  `;
}

/**
 * 生成客户开发弹窗里的具体国家或产品按钮。
 *
 * 为什么独立成函数：
 * - 首次打开弹窗和切换大洲 / 行业大类时需要生成完全一致的按钮结构。
 * - 共用一份模板可避免局部刷新后丢失选中态、无障碍属性或事件数据属性。
 *
 * @param {string[]} options - 当前大洲的国家列表，或当前行业大类的产品列表。
 * @param {boolean} isMarket - `true` 表示国家模式，`false` 表示行业产品模式。
 * @param {string} selectedValue - 当前已经写入获客条件的单选值。
 * @returns {string} 可写入选项网格的按钮 HTML。
 * @throws {Error} 本函数不主动抛异常；所有动态文本都会先进行 HTML 转义。
 */
function renderCustomerDevPickerOptions(options, isMarket, selectedValue) {
  return options.map((option) => {
    const selected = option === selectedValue;

    return `
      <button class="${selected ? "selected" : ""}" type="button" ${isMarket ? "data-customer-dev-country" : "data-customer-dev-product"}="${escapeHtml(option)}" aria-pressed="${selected}">
        <span>${escapeHtml(option)}</span>
        <b aria-hidden="true">${selected ? "✓" : "→"}</b>
      </button>
    `;
  }).join("");
}

/**
 * 在已打开的客户开发弹窗内切换大洲或行业大类。
 *
 * 为什么只更新弹窗内部：
 * - 旧实现会调用 renderApp 重建整页，弹窗入场动画也会被重新播放，因此视觉上会闪一下。
 * - 这里保留同一个弹窗 DOM，只替换导航选中态、分组标题和具体选项，切换会立即完成且不抖动。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常；弹窗或分组数据不存在时直接返回。
 */
function refreshCustomerDevPickerGroup() {
  const picker = state.customerDevPicker;
  const dialog = document.querySelector(".customer-dev-picker-dialog");

  if (!picker || !dialog) {
    return;
  }

  const isMarket = picker === "market";
  const groups = isMarket
    ? (CUSTOMER_DEVELOPMENT.countryGroups || [])
    : (CUSTOMER_DEVELOPMENT.productGroups || []);
  const activeGroupId = isMarket ? state.customerDevContinent : state.customerDevProductCategory;
  const activeGroup = groups.find((group) => group.id === activeGroupId) || groups[0];

  if (!activeGroup) {
    return;
  }

  const options = isMarket ? (activeGroup.countries || []) : (activeGroup.products || []);
  const selectedValue = isMarket ? state.customerDevBrief.market : state.customerDevBrief.product;
  const groupAttribute = isMarket ? "data-customer-dev-continent" : "data-customer-dev-product-category";

  dialog.querySelectorAll(`[${groupAttribute}]`).forEach((button) => {
    const active = button.getAttribute(groupAttribute) === activeGroup.id;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  const groupTitle = dialog.querySelector(".customer-dev-picker-options-head h3");
  const optionGrid = dialog.querySelector(".customer-dev-picker-option-grid");
  const optionPanel = dialog.querySelector(".customer-dev-picker-options");

  if (groupTitle) {
    groupTitle.textContent = activeGroup.label;
  }

  if (optionGrid) {
    optionGrid.classList.toggle("is-country", isMarket);
    optionGrid.classList.toggle("is-product", !isMarket);
    optionGrid.innerHTML = renderCustomerDevPickerOptions(options, isMarket, selectedValue);
  }

  // 用户切到新分组时，从第一项开始浏览，避免继承上一个长列表的滚动位置。
  if (optionPanel) {
    optionPanel.scrollTop = 0;
  }
}

/**
 * 同步客户开发首页“获客引擎已就绪”的条件摘要。
 *
 * 为什么局部更新：
 * - 客户类型和数量使用原生下拉框，不需要因为一次选择重绘整页。
 * - 局部更新既能立即反馈数量变化，也不会让用户正在操作的下拉框失去焦点。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常；摘要节点不存在时直接返回。
 */
function syncCustomerDevEngineSummary() {
  const summary = document.querySelector(".customer-dev-engine-ready strong");

  if (!summary) {
    return;
  }

  const { market, product, quantity } = state.customerDevBrief;
  summary.textContent = `${market} · ${product} · ${quantity} 家`;
}

/**
 * 渲染 AI 找客户的处理中状态。
 *
 * @returns {string} 搜索中状态 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCustomerDevSearchingPanel() {
  const brief = state.customerDevBrief;

  return `
    <section class="customer-dev-searching" aria-label="AI 正在找客户">
      <article>
        <span class="customer-dev-search-live"><i aria-hidden="true"></i> 全球客户信号接入中</span>
        <div class="customer-dev-orbit" aria-hidden="true"><span></span><span></span><span></span></div>
        <h2>获客引擎已启动，正在锁定成交机会</h2>
        <p>${escapeHtml(brief.market)} · ${escapeHtml(brief.product)} · ${escapeHtml(brief.role)} · ${escapeHtml(brief.quantity)} 家</p>
        <div class="customer-dev-search-log">
          ${[
            "目标市场与采购画像已确认",
            "正在扫描官网、商业目录与公开贸易信号",
        "符合当前筛选条件的企业正在进入候选名单",
            "即将打开公司画像与联系人入口"
          ].map((text, index) => `
            <span class="${index < 3 ? "done" : "active"}">${escapeHtml(text)}</span>
          `).join("")}
        </div>
      </article>
    </section>
  `;
}

/**
 * 渲染客户开发结果工作台。
 *
 * 设计说明：
 * - 结果页只保留一个自然语言搜索框，避免目标国家、产品、渠道等筛选按钮争夺注意力。
 * - 当前获客目标、线索总量和本页数量放在同一个标题区，让用户先确认战役目标，再进入客户名单。
 *
 * @param {typeof CUSTOMER_DEVELOPMENT.leads} leads - 客户线索列表。
 * @param {typeof CUSTOMER_DEVELOPMENT.leads[number]} selectedLead - 当前选中客户。
 * @returns {string} 结果工作台 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCustomerDevResultsWorkspace(leads, selectedLead) {
  const brief = state.customerDevBrief;

  return `
    <section class="customer-dev-brief-summary">
      <div>
        <span>本轮获客目标</span>
        <strong>${escapeHtml(brief.market)} · ${escapeHtml(brief.product)} · ${escapeHtml(brief.role)}</strong>
        <p>126 条线索 · 本页 ${leads.length} 家</p>
      </div>
      <a href="#/customer-development" data-customer-dev-reset>重新配置目标</a>
    </section>

    <div class="customer-dev-list-toolbar">
      <strong>客户列表 <span>${leads.length}</span></strong>
      <div class="customer-dev-table-actions">
        <button type="button" data-toast="已模拟导出客户列表。">导出</button>
        <button type="button" data-toast="已模拟刷新客户池。">刷新</button>
      </div>
    </div>

    <section class="customer-dev-console">
      <article class="customer-dev-table-panel">
        <table class="customer-dev-table">
          <thead>
              <tr>
                <th><input type="checkbox" aria-label="全选客户" /></th>
                <th>公司</th>
                <th>国家</th>
                <th>客户类型</th>
                <th>来源</th>
                <th>线索说明</th>
                <th>联系人</th>
                <th>更新时间</th>
              </tr>
            </thead>
            <tbody>
              ${leads.map((lead) => renderCustomerDevLeadRow(lead, selectedLead)).join("")}
            </tbody>
          </table>
        <footer class="customer-dev-pagination">
          <span>共 126 条</span>
          <div>
            <button type="button" data-toast="已在第 1 页。">‹</button>
            <button class="active" type="button">1</button>
            <button type="button" data-toast="已模拟切到第 2 页。">2</button>
            <button type="button" data-toast="已模拟切到第 3 页。">3</button>
            <button type="button" data-toast="已模拟切到第 4 页。">4</button>
            <span>...</span>
            <button type="button" data-toast="已模拟切到第 9 页。">9</button>
            <button type="button" data-toast="已模拟下一页。">›</button>
          </div>
          <button type="button" data-toast="已模拟切换每页 20 条。">20 条/页⌄</button>
        </footer>
      </article>

      ${renderCustomerDevDetail(selectedLead)}
    </section>
  `;
}

/**
 * 渲染单个客户列表行。
 *
 * @param {typeof CUSTOMER_DEVELOPMENT.leads[number]} lead - 客户线索。
 * @param {typeof CUSTOMER_DEVELOPMENT.leads[number]} selectedLead - 当前右侧详情客户。
 * @returns {string} 单行 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCustomerDevLeadRow(lead, selectedLead) {
  return `
    <tr class="customer-dev-data-row ${selectedLead && lead.id === selectedLead.id ? "selected" : ""}" data-dev-lead="${escapeHtml(lead.id)}">
      <td><input type="checkbox" ${selectedLead && lead.id === selectedLead.id ? "checked" : ""} aria-label="选择${escapeHtml(lead.company)}" /></td>
      <td><button type="button" data-dev-lead="${escapeHtml(lead.id)}">${escapeHtml(lead.company)}</button></td>
      <td>${escapeHtml(lead.countryName)}</td>
      <td>${escapeHtml(lead.type)}</td>
      <td>${escapeHtml(lead.source)}</td>
      <td>${escapeHtml(lead.reason)}</td>
      <td>${escapeHtml(lead.contact)}</td>
      <td>${escapeHtml(lead.updated)}</td>
    </tr>
  `;
}

/**
 * 渲染右侧客户情报抽屉。
 *
 * @param {typeof CUSTOMER_DEVELOPMENT.leads[number]} lead - 当前选中的客户。
 * @returns {string} 情报抽屉 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCustomerDevDetail(lead) {
  if (!lead) {
    return "";
  }

  return `
    <aside class="customer-dev-detail" aria-label="${escapeHtml(lead.company)} 客户详情">
      <header class="customer-dev-detail-hero">
        <div class="customer-dev-detail-heading">
          <span class="customer-dev-detail-kicker">客户情报</span>
          <h2>${escapeHtml(lead.company)}</h2>
          <p class="customer-dev-detail-tags">
            <span>${escapeHtml(lead.type)}</span>
            <span>${escapeHtml(lead.countryName)}</span>
          </p>
        </div>
        <button class="customer-dev-detail-close" type="button" aria-label="关闭客户详情" data-toast="已模拟关闭客户详情。">关闭</button>
        <dl class="customer-dev-detail-meta">
          <div>
            <dt>线索来源</dt>
            <dd>${escapeHtml(lead.source)}</dd>
          </div>
          <div>
            <dt>最近更新</dt>
            <dd>${escapeHtml(lead.updated)}</dd>
          </div>
        </dl>
      </header>

      ${renderCustomerDevCompanyPanel(lead)}
    </aside>
  `;
}

/**
 * 为当前公司生成联系人原型数据。
 *
 * @param {typeof CUSTOMER_DEVELOPMENT.leads[number]} lead - 当前公司线索。
 * @returns {Array<{ name: string, title: string, source: string, email: string, linkedin: string, whatsapp: string }>} 联系人列表。
 * @throws {Error} 本函数不主动抛异常。
 */
function buildCustomerDevContacts(lead) {
  const primaryName = lead.contact === "待确认" ? "采购负责人待确认" : lead.contact;
  const domain = lead.website.replace(/^www\./, "");

  return [
    {
      name: primaryName,
      title: lead.role,
      source: "官网 + LinkedIn",
      email: `purchase@${domain}`,
      linkedin: `linkedin.com/company/${lead.id}`,
      whatsapp: "+00 000 000 000"
    },
    {
      name: "Business Development",
      title: "业务开发",
      source: "LinkedIn",
      email: `bd@${domain}`,
      linkedin: `linkedin.com/search/results/people/?keywords=${encodeURIComponent(lead.company)}`,
      whatsapp: "待获取"
    },
    {
      name: "Procurement Team",
      title: "采购团队",
      source: "官网表单",
      email: `info@${domain}`,
      linkedin: "待获取",
      whatsapp: "待获取"
    }
  ];
}

/**
 * 渲染公司信息面板。
 *
 * @param {typeof CUSTOMER_DEVELOPMENT.leads[number]} lead - 当前公司线索。
 * @returns {string} 公司信息 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCustomerDevCompanyPanel(lead) {
  return `
    <div class="customer-dev-panel-slide">
      <nav class="customer-dev-detail-tabs" aria-label="客户情报分类" role="tablist">
        <button class="active" type="button" role="tab" aria-selected="true" data-customer-dev-detail-tab="overview">公司资料</button>
        <button type="button" role="tab" aria-selected="false" data-customer-dev-detail-tab="signals">公开动态 <span>${lead.evidence.length}</span></button>
        <button type="button" role="tab" aria-selected="false" data-customer-dev-detail-tab="contact">已知联系人</button>
      </nav>
      <div class="customer-dev-detail-panels">
        <section class="customer-dev-info-list customer-dev-detail-pane" role="tabpanel" data-customer-dev-detail-panel="overview">
          <div class="customer-dev-section-head">
            <div>
              <span class="customer-dev-section-kicker">基本档案</span>
              <h3>公司信息</h3>
            </div>
          </div>
          <dl class="customer-dev-facts-grid">
            <div class="customer-dev-fact customer-dev-fact-wide">
              <dt>官网</dt>
              <dd>${escapeHtml(lead.website)}</dd>
            </div>
            <div class="customer-dev-fact customer-dev-fact-wide">
              <dt>总部</dt>
              <dd>${escapeHtml(lead.location)}</dd>
            </div>
            <div class="customer-dev-fact">
              <dt>公司规模</dt>
              <dd>${escapeHtml(lead.size)}</dd>
            </div>
            <div class="customer-dev-fact">
              <dt>成立时间</dt>
              <dd>${escapeHtml(lead.founded)}</dd>
            </div>
          </dl>
        </section>
        <section class="customer-dev-evidence customer-dev-detail-pane" role="tabpanel" data-customer-dev-detail-panel="signals" hidden>
          <div class="customer-dev-section-head">
            <div>
              <span class="customer-dev-section-kicker">公开来源</span>
              <h3>公开动态</h3>
            </div>
            <span>更新于 ${escapeHtml(lead.updated)}</span>
          </div>
          <div class="customer-dev-evidence-list">
            ${lead.evidence.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
          </div>
        </section>
        <section class="customer-dev-info-list customer-dev-detail-pane" role="tabpanel" data-customer-dev-detail-panel="contact" hidden>
          <div class="customer-dev-section-head">
            <div>
              <span class="customer-dev-section-kicker">公开记录</span>
              <h3>已知联系人</h3>
            </div>
          </div>
          <dl class="customer-dev-facts-grid">
            <div class="customer-dev-fact customer-dev-fact-wide">
              <dt>姓名</dt>
              <dd>${escapeHtml(lead.contact)}</dd>
            </div>
            <div class="customer-dev-fact customer-dev-fact-wide">
              <dt>职位</dt>
              <dd>${escapeHtml(lead.role)}</dd>
            </div>
            <div class="customer-dev-fact">
              <dt>发现来源</dt>
              <dd>${escapeHtml(lead.source)}</dd>
            </div>
            <div class="customer-dev-fact">
              <dt>更新时间</dt>
              <dd>${escapeHtml(lead.updated)}</dd>
            </div>
          </dl>
        </section>
      </div>
      <section class="customer-dev-detail-action">
        <div class="customer-dev-detail-action-copy">
          <strong>联系人资料</strong>
          <span>查看姓名、职位与公开联系方式</span>
        </div>
        <a href="#/customer-development/contacts" data-customer-dev-open-contacts>查看联系人资料</a>
      </section>
    </div>
  `;
}

/**
 * 渲染客户开发联系人整页。
 *
 * @param {typeof CUSTOMER_DEVELOPMENT.leads[number]} lead - 当前公司线索。
 * @returns {string} 联系人整页 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCustomerDevContactsWorkspace(lead) {
  const contacts = buildCustomerDevContacts(lead);

  return `
    <section class="customer-dev-contact-workspace">
      <header class="customer-dev-contact-hero">
        <a href="#/customer-development/results" data-customer-dev-back-results>返回客户列表</a>
        <div>
          <span>公司信息</span>
          <h2>${escapeHtml(lead.company)}</h2>
          <p>${escapeHtml(lead.type)} · ${escapeHtml(lead.countryName)} · ${escapeHtml(lead.source)}</p>
        </div>
      </header>

      <section class="customer-dev-contact-company">
        ${[
          ["官网", lead.website],
          ["总部", lead.location],
          ["公司规模", lead.size],
          ["成立时间", lead.founded],
          ["线索说明", lead.reason]
        ].map(([label, value]) => `
          <p><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></p>
        `).join("")}
      </section>

      <section class="customer-dev-contact-table-card">
        <header>
          <h3>联系人</h3>
          <span>邮箱默认隐藏，点击后获取单个联系人邮箱</span>
        </header>
        <div class="customer-dev-contact-table">
          <div class="customer-dev-contact-row head">
            <span>姓名</span>
            <span>岗位职位</span>
            <span>邮箱</span>
            <span></span>
          </div>
          ${contacts.map((contact, index) => {
            const key = `${lead.id}-${index}`;
            const revealed = state.customerDevRevealedEmails.has(key);

            return `
              <div class="customer-dev-contact-row ${revealed ? "revealed" : ""}">
                <strong>${escapeHtml(contact.name)}</strong>
                <span>${escapeHtml(contact.title)}</span>
                <em>${revealed ? escapeHtml(contact.email) : "待获取"}</em>
                <a href="#/customer-development/contacts/${index}" data-customer-dev-reveal-email="${index}">
                  ${revealed ? "已获取" : "获取邮箱"}
                </a>
              </div>
            `;
          }).join("")}
        </div>
      </section>
    </section>
  `;
}

/**
 * 用量明细页：免费版套餐 + 升级 + 两个 tab（使用详情 / 账单）。
 *
 * @returns {string} 页面 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAccountUsageView() {
  const total = 520;
  const used = 445;
  const remain = total - used;
  const pct = Math.round((used / total) * 100);

  const r = 64;
  const C = 2 * Math.PI * r;
  const offset = C * (1 - used / total);

  const topRecords = USAGE_RECORDS.slice(0, 5);

  // 按 scene 聚合积分消耗，取 Top 5 展示最常用场景。
  const byScene = {};
  USAGE_RECORDS.forEach((r) => {
    byScene[r.scene] = (byScene[r.scene] || 0) + parseFloat(r.credits);
  });
  const sceneEntries = Object.entries(byScene).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const sceneMax = sceneEntries.length ? sceneEntries[0][1] : 1;

  return `
    <section class="usage-view" aria-label="用量明细">
    <section class="usage-a">
      <header class="usage-a-hero">
        <div class="usage-a-ring" aria-label="积分使用进度">
          <svg viewBox="0 0 160 160" width="180" height="180">
            <circle cx="80" cy="80" r="${r}" stroke="#f0e6dd" stroke-width="12" fill="none"/>
            <circle cx="80" cy="80" r="${r}" stroke="url(#usageRingGrad)" stroke-width="12" fill="none"
              stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
              stroke-linecap="round" transform="rotate(-90 80 80)"/>
            <defs>
              <linearGradient id="usageRingGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#ff7a2b"/>
                <stop offset="100%" stop-color="#ff9a5a"/>
              </linearGradient>
            </defs>
          </svg>
          <div class="usage-a-ring-text">
            <strong>${remain}</strong>
            <span>剩余积分</span>
            <em>/ ${total}</em>
          </div>
        </div>

        <div class="usage-a-side">
          <h2>免费版 · 你还能再用 ${remain} 次</h2>
          <p>本周期 <strong>2026.6.7 – 7.7</strong> · 已用 ${pct}%</p>
          <a class="usage-a-upgrade" href="#/upgrade/pay/pro">
            ✦ 升级专业版，立刻多 9,480 积分
          </a>
        </div>

        <aside class="usage-a-rank">
          <h3>消耗最多的场景</h3>
          <ol>
            ${sceneEntries.map(([name, val], i) => `
              <li>
                <span class="usage-a-rank-num">${i + 1}</span>
                <span class="usage-a-rank-name">${escapeHtml(name)}</span>
                <span class="usage-a-rank-bar"><span style="width: ${(val / sceneMax * 100).toFixed(0)}%"></span></span>
                <span class="usage-a-rank-val">${val.toFixed(2)}</span>
              </li>
            `).join("")}
          </ol>
        </aside>
      </header>

      <div class="usage-a-stats">
        ${renderUsageStatCard("本月已用", `${used}`, "积分", "占额度 86%")}
        ${renderUsageStatCard("今天", "0", "积分", "20 / 天的基础额度还没用")}
        ${renderUsageStatCard("最常用场景", "客户背调顾问", "", "本月跑了 3 次")}
        ${renderUsageStatCard("下次重置", "29 天后", "", "2026 年 7 月 7 日")}
      </div>

      <article class="usage-a-records">
        <header><h3>最近 ${topRecords.length} 条记录</h3></header>
        <ul>
          ${topRecords.map((r) => `
            <li>
              <span class="usage-a-rec-time">${escapeHtml(r.time.slice(5, 16))}</span>
              <span class="usage-a-rec-scene">${escapeHtml(r.scene)}</span>
              <span class="usage-a-rec-credits">${escapeHtml(r.credits)}</span>
            </li>
          `).join("")}
        </ul>
      </article>
    </section>
    </section>
  `;
}

/**
 * 渲染用量明细指标卡。
 *
 * @param {string} label - 指标名。
 * @param {string} value - 主数值。
 * @param {string} unit - 单位。
 * @param {string} sub - 副说明。
 * @returns {string} 卡片 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderUsageStatCard(label, value, unit, sub) {
  return `
    <article class="usage-a-stat">
      <span class="usage-a-stat-label">${escapeHtml(label)}</span>
      <span class="usage-a-stat-value">${escapeHtml(value)}${unit ? `<small>${escapeHtml(unit)}</small>` : ""}</span>
      <span class="usage-a-stat-sub">${escapeHtml(sub)}</span>
    </article>
  `;
}


/**
 * 渲染升级支付页（专业版 / 团队版各一份 URL）。
 *
 * 字段说明：
 * - state.payCycle：annual / monthly。
 * - state.payMethod：wechat / alipay / card。
 * - state.payAgreed：是否勾选了订阅协议。
 * - state.payPhase：form / processing / success，控制三段式状态切换。
 *
 * @returns {string} 支付页 HTML。
 * @throws {Error} 本函数不主动抛异常；找不到套餐时回退到专业版。
 */
function renderPaymentView() {
  const main = state.activeMain;
  const planId = main.includes("pro") ? "pro" : "team";
  const plan = UPGRADE_PLANS.find((p) => p.id === planId) || UPGRADE_PLANS[1];
  const billing = getPaymentBilling(planId, state.payCycle);

  if (main.endsWith("-done")) {
    return renderPaymentSuccess(plan, billing, planId);
  }

  if (main.endsWith("-checkout")) {
    return renderPaymentCheckout(plan, billing, planId);
  }

  return renderPaymentFormView(plan, billing, planId);
}

/**
 * 渲染"确认订单"页（默认进入支付页时的第一屏）。
 *
 * @param {typeof UPGRADE_PLANS[number]} plan - 当前套餐。
 * @param {ReturnType<typeof getPaymentBilling>} billing - 金额。
 * @param {string} planId - 套餐 ID（"pro" / "team"）。
 * @returns {string} 表单页 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderPaymentFormView(plan, billing, planId) {
  return `
    <section class="pay-view" aria-label="升级支付">
      <a class="pay-back" href="#/ask" data-pay-back="true">
        <span aria-hidden="true">‹</span>
        <span>返回升级方案</span>
      </a>

      <article class="pay-card">
        <header class="pay-card-head">
          <h2>确认订阅</h2>
          <p>即将订阅 <strong>${escapeHtml(plan.name)}</strong>${plan.badge ? ` · <span class="pay-badge">${escapeHtml(plan.badge)}</span>` : ""}</p>
        </header>

        <section class="pay-section">
          <h3>计费周期</h3>
          <div class="pay-cycle-row">
            ${renderPayCycleOption(planId, "annual", state.payCycle === "annual")}
            ${renderPayCycleOption(planId, "monthly", state.payCycle === "monthly")}
          </div>
        </section>

        <section class="pay-section">
          <h3>支付方式</h3>
          <div class="pay-method-list">
            ${renderPayMethodRow("wechat", "微信支付", "🟢", state.payMethod === "wechat")}
            ${renderPayMethodRow("alipay", "支付宝", "🔵", state.payMethod === "alipay")}
            ${renderPayMethodRow("card", "信用卡 / 借记卡", "💳", state.payMethod === "card")}
          </div>
        </section>

        <section class="pay-summary">
          <div class="pay-summary-row">
            <span>套餐金额</span>
            <span>${escapeHtml(billing.gross)}</span>
          </div>
          ${billing.discount ? `
            <div class="pay-summary-row discount">
              <span>${escapeHtml(billing.discountLabel)}</span>
              <span>-${escapeHtml(billing.discount)}</span>
            </div>
          ` : ""}
          <div class="pay-summary-row total">
            <span>实付金额</span>
            <span>${escapeHtml(billing.total)}</span>
          </div>
        </section>

        <label class="pay-agree">
          <input type="checkbox" data-pay-agree="true" ${state.payAgreed ? "checked" : ""} />
          <span>我已阅读并同意 <a href="#" data-toast="《订阅协议》是原型反馈，不打开真实条款页。">《订阅协议》</a> 和 <a href="#" data-toast="《自动续费规则》是原型反馈。">《自动续费规则》</a></span>
        </label>

        <a class="pay-cta ${state.payAgreed ? "" : "disabled"}" href="#/upgrade/pay/${escapeHtml(planId)}/checkout" data-pay-go-checkout="true" ${state.payAgreed ? "" : "aria-disabled=\"true\""}>
          立即支付 ${escapeHtml(billing.total)}
        </a>

        <p class="pay-trust">🔒 7 天无理由退款 · 随时取消订阅 · 支付加密 by 微信 / 支付宝</p>
      </article>
    </section>
  `;
}

/**
 * 渲染独立的"支付界面"，按选中的支付方式分支：
 * - wechat / alipay → 扫码页（二维码 + 倒计时 + 我已支付 / 换支付方式）
 * - card → 卡信息表单
 *
 * @param {typeof UPGRADE_PLANS[number]} plan - 当前套餐。
 * @param {ReturnType<typeof getPaymentBilling>} billing - 金额。
 * @param {string} planId - 套餐 ID。
 * @returns {string} 支付界面 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderPaymentCheckout(plan, billing, planId) {
  const method = state.payMethod;
  const summary = `
    <aside class="checkout-summary">
      <header>
        <strong>${escapeHtml(plan.name)}</strong>
        <span>${escapeHtml(state.payCycle === "annual" ? "年付" : "月付")} · ${escapeHtml(plan.id === "team" ? "5 席起" : "个人订阅")}</span>
      </header>
      <dl>
        <div><dt>套餐金额</dt><dd>${escapeHtml(billing.gross)}</dd></div>
        ${billing.discount ? `<div class="discount"><dt>${escapeHtml(billing.discountLabel)}</dt><dd>-${escapeHtml(billing.discount)}</dd></div>` : ""}
      </dl>
      <div class="checkout-summary-total">
        <span>应付</span>
        <strong>${escapeHtml(billing.total)}</strong>
      </div>
      <footer>
        <span aria-hidden="true">🔒</span> 7 天无理由退款，正式版会按选中方式真实扣款
      </footer>
    </aside>
  `;

  const mainPanel = method === "card"
    ? renderCheckoutCardPanel(billing)
    : renderCheckoutScanPanel(method, billing);

  return `
    <section class="pay-view checkout-view" aria-label="支付界面">
      <a class="pay-back" href="#/upgrade/pay/${escapeHtml(planId)}" data-pay-back="true">
        <span aria-hidden="true">‹</span>
        <span>返回订单</span>
      </a>

      <div class="checkout-layout">
        ${mainPanel}
        ${summary}
      </div>
    </section>
  `;
}

/**
 * 微信 / 支付宝扫码面板（QR + 倒计时 + 操作按钮）。
 *
 * @param {string} method - "wechat" | "alipay"
 * @param {ReturnType<typeof getPaymentBilling>} billing - 金额。
 * @returns {string} 面板 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCheckoutScanPanel(method, billing) {
  const isWechat = method === "wechat";
  const themeClass = isWechat ? "wechat" : "alipay";
  const brand = isWechat ? "微信支付" : "支付宝";
  const brandHint = isWechat ? "打开微信扫一扫，完成支付" : "打开支付宝扫一扫，完成支付";

  return `
    <article class="checkout-panel ${themeClass}">
      <header class="checkout-panel-head">
        <span class="checkout-brand">
          <span class="checkout-brand-dot" aria-hidden="true"></span>
          ${escapeHtml(brand)}
        </span>
        <span class="checkout-amount">${escapeHtml(billing.total)}</span>
      </header>

      <div class="checkout-qr-wrap">
        <div class="checkout-qr" aria-label="模拟${escapeHtml(brand)}二维码">
          ${renderFakeQrSvg(themeClass)}
        </div>
        <div class="checkout-phone" aria-hidden="true">
          <div class="checkout-phone-screen">
            <span class="checkout-phone-amount">${escapeHtml(billing.total)}</span>
            <span class="checkout-phone-merchant">赢单 · ${escapeHtml(brand)}</span>
          </div>
        </div>
      </div>

      <p class="checkout-hint">${escapeHtml(brandHint)}</p>
      <p class="checkout-countdown">
        二维码 <strong data-pay-countdown="true">14:32</strong> 后失效
      </p>

      <div class="checkout-actions">
        <button class="checkout-paid" type="button" data-pay-mark-paid="true">我已完成支付</button>
        <a class="checkout-switch" href="#/upgrade/pay/${escapeHtml(state.activeMain.includes("pro") ? "pro" : "team")}" data-pay-back="true">换个支付方式</a>
      </div>
    </article>
  `;
}

/**
 * 信用卡 / 借记卡面板。
 *
 * @param {ReturnType<typeof getPaymentBilling>} billing - 金额。
 * @returns {string} 面板 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCheckoutCardPanel(billing) {
  return `
    <article class="checkout-panel card">
      <header class="checkout-panel-head">
        <span class="checkout-brand">
          <span class="checkout-brand-dot card" aria-hidden="true">💳</span>
          信用卡 / 借记卡
        </span>
        <span class="checkout-amount">${escapeHtml(billing.total)}</span>
      </header>

      <form class="checkout-card-form" autocomplete="off">
        <label>
          <span>持卡人姓名</span>
          <input type="text" placeholder="Tina Wang" data-toast="持卡人字段为原型反馈。" />
        </label>
        <label>
          <span>卡号</span>
          <input type="text" placeholder="1234  5678  9012  3456" maxlength="23" data-toast="卡号字段为原型反馈，不提交真实信息。" />
        </label>
        <div class="checkout-card-row">
          <label>
            <span>有效期</span>
            <input type="text" placeholder="MM / YY" maxlength="7" data-toast="有效期为原型反馈。" />
          </label>
          <label>
            <span>CVV</span>
            <input type="text" placeholder="•••" maxlength="4" data-toast="CVV 为原型反馈。" />
          </label>
        </div>
      </form>

      <div class="checkout-actions">
        <button class="checkout-paid" type="button" data-pay-mark-paid="true">确认支付 ${escapeHtml(billing.total)}</button>
        <a class="checkout-switch" href="#/upgrade/pay/${escapeHtml(state.activeMain.includes("pro") ? "pro" : "team")}" data-pay-back="true">换个支付方式</a>
      </div>

      <footer class="checkout-card-foot">
        <span aria-hidden="true">🔒</span> 通过 Stripe 安全加密 · 原型不提交也不存储任何卡信息
      </footer>
    </article>
  `;
}

/**
 * 生成一个仿真的二维码（角标 + 数据点阵），不是真的二维码。
 *
 * 仅用于视觉，扫描不会得到任何内容。
 *
 * @param {string} themeClass - "wechat" / "alipay" / "card"，用来取主色。
 * @returns {string} SVG HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderFakeQrSvg(themeClass) {
  // 用一个稳定 pseudo-pattern，避免每次 render 时点阵跳变（用 stage id 哈希也行，简单点固定一组）。
  const tint = themeClass === "wechat" ? "#1aad19" : themeClass === "alipay" ? "#1677ff" : "#1a1614";
  const grid = 21;
  const cells = [];
  const seed = 0xC0FFEE;
  let x = seed;

  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      // 三个角的 finder pattern。
      const inFinder = (
        (i < 7 && j < 7) ||
        (i < 7 && j >= grid - 7) ||
        (i >= grid - 7 && j < 7)
      );
      let isOn = false;

      if (inFinder) {
        const li = i < 7 ? i : i - (grid - 7);
        const lj = j < 7 ? j : j - (grid - 7);
        isOn = li === 0 || li === 6 || lj === 0 || lj === 6 || (li >= 2 && li <= 4 && lj >= 2 && lj <= 4);
      } else {
        x = (x * 1664525 + 1013904223) >>> 0;
        isOn = (x & 1) === 1;
      }

      if (isOn) {
        cells.push(`<rect x="${j}" y="${i}" width="1" height="1" fill="${tint}"/>`);
      }
    }
  }

  return `
    <svg viewBox="0 0 ${grid} ${grid}" width="160" height="160" shape-rendering="crispEdges" aria-hidden="true">
      <rect width="${grid}" height="${grid}" fill="#ffffff"/>
      ${cells.join("")}
      <circle cx="${grid / 2}" cy="${grid / 2}" r="2.6" fill="#ffffff" stroke="${tint}" stroke-width="0.6"/>
      <text x="${grid / 2}" y="${grid / 2 + 0.6}" font-size="2.6" text-anchor="middle" fill="${tint}" font-weight="900">赢</text>
    </svg>
  `;
}

/**
 * 计算订单金额。
 *
 * @param {string} planId - "pro" | "team"
 * @param {string} cycle - "annual" | "monthly"
 * @returns {{ gross: string, discount: string, discountLabel: string, total: string, cycle: string }}
 */
function getPaymentBilling(planId, cycle) {
  const annual = planId === "pro"
    ? { gross: "¥1,188", discount: "¥198", discountLabel: "年付优惠 (立省 2 个月)", total: "¥990", cycle: "首期 / 年" }
    : { gross: "¥5,988", discount: "¥998", discountLabel: "年付优惠 (立省 2 个月)", total: "¥4,990", cycle: "5 席 · 首期 / 年" };

  const monthly = planId === "pro"
    ? { gross: "¥99", discount: "", discountLabel: "", total: "¥99", cycle: "首期 / 月" }
    : { gross: "¥499", discount: "", discountLabel: "", total: "¥499", cycle: "5 席 · 首期 / 月" };

  return cycle === "annual" ? annual : monthly;
}

/**
 * 渲染计费周期单选项。
 *
 * @param {string} planId - 套餐 ID。
 * @param {string} cycle - "annual" | "monthly"
 * @param {boolean} selected - 是否被选中。
 * @returns {string} 选项 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderPayCycleOption(planId, cycle, selected) {
  const detail = getPaymentBilling(planId, cycle);
  const labelMap = { annual: "年付", monthly: "月付" };
  const helper = cycle === "annual" ? "立省 2 个月" : "随时取消";

  return `
    <button class="pay-cycle-option ${selected ? "active" : ""}" type="button" data-pay-cycle="${escapeHtml(cycle)}">
      <span class="pay-cycle-radio" aria-hidden="true"></span>
      <span class="pay-cycle-text">
        <strong>${escapeHtml(labelMap[cycle])}</strong>
        <em>${escapeHtml(helper)}</em>
      </span>
      <span class="pay-cycle-price">${escapeHtml(detail.total)}<small>${escapeHtml(detail.cycle.startsWith("5 席") ? " / 年 · 5 席" : detail.cycle.includes("年") ? " / 年" : " / 月")}</small></span>
    </button>
  `;
}

/**
 * 渲染支付方式行。
 *
 * @param {string} id - 方式 ID。
 * @param {string} label - 显示名。
 * @param {string} icon - 图标 emoji。
 * @param {boolean} selected - 是否被选中。
 * @returns {string} 行 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderPayMethodRow(id, label, icon, selected) {
  return `
    <button class="pay-method-row ${selected ? "active" : ""}" type="button" data-pay-method="${escapeHtml(id)}">
      <span class="pay-method-icon" aria-hidden="true">${escapeHtml(icon)}</span>
      <span class="pay-method-label">${escapeHtml(label)}</span>
      <span class="pay-method-radio" aria-hidden="true"></span>
    </button>
  `;
}

/**
 * 支付成功页（URL: /upgrade/pay/{planId}/done）。
 *
 * @param {typeof UPGRADE_PLANS[number]} plan - 套餐。
 * @param {ReturnType<typeof getPaymentBilling>} billing - 金额。
 * @param {string} planId - 套餐 ID。
 * @returns {string} 成功页 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderPaymentSuccess(plan, billing, planId) {
  const orderHash = (planId.length * 37 + 123456) >>> 0;
  return `
    <section class="pay-view pay-state">
      <article class="pay-state-card success">
        <div class="pay-state-check" aria-hidden="true">✓</div>
        <h2>升级成功</h2>
        <p>欢迎使用 <strong>${escapeHtml(plan.name)}</strong>，本期已扣 <strong>${escapeHtml(billing.total)}</strong></p>
        <p class="pay-state-hint">订单号 RY-${orderHash}-${escapeHtml(planId.toUpperCase())}（演示）· 支付方式 ${escapeHtml(payMethodLabel(state.payMethod))}</p>
        <div class="pay-state-actions">
          <a class="pay-state-cta primary" href="#/ask" data-pay-back="true">开始使用</a>
          <a class="pay-state-cta" href="#/customer-kass/A" data-pay-back="true">先去客户Kass看看</a>
        </div>
      </article>
    </section>
  `;
}

/**
 * 支付方式 ID → 用户可见的中文名。
 *
 * @param {string} id - "wechat" | "alipay" | "card"
 * @returns {string} 中文名。
 * @throws {Error} 本函数不主动抛异常。
 */
function payMethodLabel(id) {
  return { wechat: "微信支付", alipay: "支付宝", card: "银行卡支付" }[id] || "支付";
}

/**
 * 渲染销售准备 > 外贸流程。
 *
 * @returns {string} 外贸流程 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderFlowView() {
  const activeStage = getStageById(state.activeStageId);
  const activeIndex = TRADE_STAGES.findIndex((stage) => stage.id === activeStage.id);

  return `
    <div class="flow-view flow-variant-flow">
      <article class="intro-card">
        <h3 class="intro-title"><span class="orange-bar"></span>成交流程</h3>
        <p>让业务员知道外贸成交有哪些阶段、每个阶段要做什么动作、需要哪些资料表格，以及应该重点跟单里的哪个功能继续推进</p>
      </article>

      <section class="process-board" aria-label="外贸成交阶段">
        <aside class="stage-list-panel">
          <header class="stage-list-header">
            <div class="stage-list-row">
              <h4 class="stage-list-title"><span class="orange-bar"></span>外贸成交阶段</h4>
              <span class="stage-count">12 个阶段</span>
            </div>
            <p class="stage-list-desc">左侧选择成交阶段，右侧查看这个阶段的动作、资料表格和赢单功能入口</p>
          </header>

          <div class="stage-list">
            ${TRADE_STAGES.map((stage, index) => renderStageButton(stage, index)).join("")}
          </div>
        </aside>

        <section class="stage-detail-panel" aria-label="阶段详情">
          <header class="stage-detail-head">
            <div class="stage-detail-head-text">
              <h3 class="stage-title">阶段${activeIndex + 1}：${escapeHtml(activeStage.title)}</h3>
              <p class="stage-subtitle">${escapeHtml(activeStage.desc)}</p>
            </div>
            ${renderFlowAskAiButton(activeStage)}
          </header>

          ${renderFlowAiCard(activeStage)}

          <div class="top-info-grid">
            ${renderTopInfo("判断目标", activeStage.goal)}
            ${renderTopInfo("关键产出", activeStage.output)}
            ${renderTopInfo("下一步动作", activeStage.next)}
          </div>

          ${renderListBlock("这个阶段要做什么", activeStage.actions)}
          ${renderListBlock("注意事项", activeStage.tips)}
          ${renderFlowMaterialPreviews(activeStage)}
          ${renderFlowVideoCard(activeStage)}
        </section>
      </section>
    </div>
  `;
}

/**
 * 渲染右上角"问 AI"按钮。
 *
 * @param {typeof TRADE_STAGES[number]} stage - 当前阶段。
 * @returns {string} 按钮 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderFlowAskAiButton(stage) {
  const isOpen = state.flowAi.open;
  return `
    <button class="flow-ask-ai ${isOpen ? "active" : ""}" type="button" data-flow-ask-ai-toggle="${escapeHtml(stage.id)}" aria-expanded="${isOpen ? "true" : "false"}">
      <span class="flow-ask-ai-mark" aria-hidden="true">✦</span>
      <span>${isOpen ? "AI 顾问已展开" : "问 AI 这一阶段怎么做"}</span>
    </button>
  `;
}

/**
 * 根据阶段数据组装一个结构化的"AI 回答"。
 *
 * 为什么本地组装：
 * - 原型不接真实 AI，这里把回答拆成 4 段是为了展示一种好的回答样式。
 * - 字段都来自 TRADE_STAGES 已有内容，便于在所有阶段都"言之有物"。
 *
 * @param {typeof TRADE_STAGES[number]} stage - 当前阶段。
 * @returns {{ headline: string, suggestions: string[], pitfalls: string[], quote: string, nextStep: string }} 结构化回答。
 * @throws {Error} 本函数不主动抛异常。
 */
function buildFlowAiAnswer(stage) {
  const quotes = {
    lead: "Hi, thanks for reaching out. Before I share pricing, could you let me know your country, target market and the model you're sourcing? I want to line up the right info before we talk numbers.",
    background: "Hi, before I send a formal quote, I'd like to learn more about your typical projects and the markets you serve. Could you share a quick intro of your team and a recent case?",
    inquiry: "Hi, I want to make sure we send the most useful proposal. Could you confirm the target quantity, certification version and delivery port? With those I can come back with a sharp number.",
    opportunity: "Hi, to move this forward properly, could you let me know whether you'd like a quote, a sample, or a video call as the next step? Either is fine — I just want to set the right pace.",
    "first-reply": "Hi, thanks again for the inquiry. To make sure my reply is useful, could you confirm 3 things: target quantity, your top spec, and your expected lead time? I'll come back with options.",
    "follow-up": "Hi, hope your week is going well. We've added a new case study from a similar market — would it be helpful if I shared a 1-page summary? Happy to also jump on a 15-min call.",
    trust: "Hi, attached are two short references from clients in your region with similar project size. Let me know which one is closer to your scenario and I'll prepare a more tailored proposal.",
    check: "Hi, before I lock the quote I want to double-check a few items: spec, quantity, packaging, lead time, target port and preferred payment. Could you confirm so the number stays valid?",
    quote: "Hi, attached is our proposal with two scenarios. I've kept the price valid for 21 days and included two reference cases. Could we plan a 20-min call next week to walk through it?",
    sample: "Hi, samples will leave the factory this Friday with tracking. Could we agree on a feedback date within 14 days so we can plan the bulk order if everything looks good?",
    "bulk-order": "Hi, the PI is attached. Production will start once the deposit clears; we'll share photos at each QC milestone. Could you confirm the inspection date and target shipping window?",
    repurchase: "Hi, glad the first batch landed well. Based on the feedback, we'd suggest adding the [new SKU] to the next order — happy to share a short sample plan and a small loyalty discount."
  };

  return {
    headline: stage.goal.replace(/^阶段\d+：/, ""),
    suggestions: stage.actions || [],
    pitfalls: (stage.mistakes || []).slice(0, 2),
    quote: quotes[stage.id] || "Hi, before we go further, could you share a bit more about your project size, target market and key deliverables?",
    nextStep: stage.next
  };
}

/**
 * 渲染 Flow 的 AI 顾问展开卡。
 *
 * 状态机：
 * - state.flowAi.open === false → 不渲染。
 * - phase === "loading" → 显示头像 + 3 个跳动小点 + "AI 顾问正在分析这一步..."。
 * - phase === "answered" → 显示结构化回答，4 个分区依次淡入，底部有复制 / 追问 / 关闭。
 *
 * @param {typeof TRADE_STAGES[number]} stage - 当前阶段。
 * @returns {string} AI 卡片 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderFlowAiCard(stage) {
  if (!state.flowAi.open) {
    return "";
  }

  const answer = buildFlowAiAnswer(stage);
  const phase = state.flowAi.phase;
  const followUp = state.flowAi.followUp || "";
  const canSend = phase === "answered" && followUp.trim().length > 0;

  return `
    <article class="flow-ai-chat phase-${escapeHtml(phase)}" aria-live="polite">
      <header class="flow-ai-chat-head">
        <span class="flow-ai-head-avatar" aria-hidden="true">${renderAiBotMark(28)}</span>
        <div class="flow-ai-head-text">
          <strong>AI 外贸顾问</strong>
          <span>${phase === "loading" ? "正在思考中…" : `已就『${escapeHtml(stage.title)}』给你拆完`}</span>
        </div>
        <button class="flow-ai-close" type="button" aria-label="关闭 AI 顾问" data-flow-ai-close="true">×</button>
      </header>

      <div class="flow-ai-conversation" data-flow-ai-scroll="true">
        ${renderAiBubbleUser(`帮我看看『${stage.title}』这一阶段该怎么做。`, "0ms")}

        ${phase === "loading" ? renderAiTypingBubble() : `
          ${renderAiBubbleBot("0ms", `
            <div class="ai-bubble-block">
              <span class="ai-bubble-tag">🎯 这一步的关键</span>
              <p>${escapeHtml(answer.headline)}。配合「${escapeHtml(stage.output)}」这份产出，做完这一步你就具备进入下一阶段的条件。</p>
            </div>

            <div class="ai-bubble-block">
              <span class="ai-bubble-tag">✅ 我建议做这 ${answer.suggestions.length} 件事</span>
              <ul class="ai-bubble-list">
                ${answer.suggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
              </ul>
            </div>

            ${answer.pitfalls.length ? `
              <div class="ai-bubble-block pitfall">
                <span class="ai-bubble-tag pitfall">⚠️ 千万别这样</span>
                <ul class="ai-bubble-list pitfall">
                  ${answer.pitfalls.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
                </ul>
              </div>
            ` : ""}

            <div class="ai-bubble-block quote">
              <span class="ai-bubble-tag">💬 一段可直接复制给客户的开场</span>
              <blockquote class="ai-bubble-quote">${escapeHtml(answer.quote)}</blockquote>
            </div>

            <div class="ai-bubble-block">
              <span class="ai-bubble-tag">🚦 做完后请你</span>
              <p>${escapeHtml(answer.nextStep)}</p>
            </div>
          `, "full")}
        `}
      </div>

      <footer class="flow-ai-input-bar">
        <span class="ai-input-attach" aria-hidden="true">＋</span>
        <input
          type="text"
          placeholder="${phase === "loading" ? "AI 正在回答..." : "继续追问，比如：客户压了同行价怎么办？"}"
          data-flow-ai-followup-input="true"
          value="${escapeHtml(followUp)}"
          ${phase === "loading" ? "disabled" : ""}
        />
        <button
          type="button"
          class="ai-send-btn ${canSend ? "enabled" : ""}"
          data-flow-ai-followup-send="true"
          ${canSend ? "" : "disabled"}
          aria-label="发送追问"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M3.4 11.2 20.2 4.1c.6-.3 1.2.3.9.9l-7.1 16.8c-.3.6-1.1.6-1.4 0l-3-6.1-6.1-3c-.6-.3-.6-1.1-.1-1.5z"/>
          </svg>
        </button>
      </footer>
    </article>
  `;
}

/**
 * 渲染一个机器人头像 SVG，AI 气泡左侧用。
 *
 * @param {number} size - 头像的像素尺寸。
 * @returns {string} SVG HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAiBotMark(size) {
  return `
    <svg viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true">
      <defs>
        <linearGradient id="aiBotBg-${size}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ff7a2b"/>
          <stop offset="100%" stop-color="#ff9a5a"/>
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="28" height="28" rx="9" fill="url(#aiBotBg-${size})"/>
      <circle cx="12" cy="14" r="2.2" fill="#ffffff"/>
      <circle cx="20" cy="14" r="2.2" fill="#ffffff"/>
      <path d="M11 21 Q16 24 21 21" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" fill="none"/>
      <circle cx="16" cy="7" r="1.5" fill="#ffffff"/>
      <path d="M16 8.5 V11" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/>
    </svg>
  `;
}

/**
 * 渲染一条用户消息气泡（右对齐 + 我 字头像）。
 *
 * @param {string} text - 气泡正文。
 * @param {string} delay - CSS 入场动画延迟。
 * @returns {string} 气泡 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAiBubbleUser(text, delay) {
  return `
    <div class="ai-msg user" style="--ai-delay: ${delay}">
      <div class="ai-bubble user">${escapeHtml(text)}</div>
      <div class="ai-avatar user" aria-hidden="true">我</div>
    </div>
  `;
}

/**
 * 渲染一条机器人消息气泡。
 *
 * @param {string} delay - CSS 入场动画延迟。
 * @param {string} inner - 气泡内的 HTML 内容（已经被 escape 处理）。
 * @param {string} [tone] - 可选语气标记（pitfall / quote），影响气泡描边。
 * @returns {string} 气泡 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAiBubbleBot(delay, inner, tone = "") {
  return `
    <div class="ai-msg bot" style="--ai-delay: ${delay}">
      <div class="ai-avatar bot" aria-hidden="true">${renderAiBotMark(28)}</div>
      <div class="ai-bubble bot ${tone}">${inner}</div>
    </div>
  `;
}

/**
 * 渲染机器人"正在输入"气泡（3 个跳动点）。
 *
 * @returns {string} 气泡 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAiTypingBubble() {
  return `
    <div class="ai-msg bot" style="--ai-delay: 0ms">
      <div class="ai-avatar bot" aria-hidden="true">${renderAiBotMark(28)}</div>
      <div class="ai-bubble bot typing" aria-label="AI 正在输入">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    </div>
  `;
}

/**
 * 渲染资料 / 表格 mini 预览卡。
 *
 * @param {typeof TRADE_STAGES[number]} stage - 当前阶段。
 * @returns {string} 资料预览 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderFlowMaterialPreviews(stage) {
  const previews = stage.materialFields || [];

  return `
    <article class="detail-block flow-material-previews">
      <h4>资料 / 表格</h4>
      <div class="flow-material-grid">
        ${previews.map(([name, fields]) => `
          <article class="flow-material-card" data-toast="${escapeHtml(name)} 是原型预览卡，不真实下载。">
            <header>
              <strong>${escapeHtml(name)}</strong>
              <span class="flow-material-icon" aria-hidden="true">⇩</span>
            </header>
            <ul>
              ${fields.map((field) => `<li>${escapeHtml(field)}</li>`).join("")}
            </ul>
          </article>
        `).join("")}
      </div>
    </article>
  `;
}

/**
 * 渲染阶段教学视频卡。
 *
 * @param {typeof TRADE_STAGES[number]} stage - 当前阶段。
 * @returns {string} 视频卡 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderFlowVideoCard(stage) {
  const video = stage.video || { title: "教学视频准备中", duration: "--:--" };
  return `
    <article class="detail-block flow-video-card" data-toast="原型阶段视频不真实播放。">
      <span class="flow-video-play" aria-hidden="true">▶</span>
      <div class="flow-video-text">
        <strong>${escapeHtml(video.title)}</strong>
        <span>${escapeHtml(video.duration)} · 与当前阶段绑定</span>
      </div>
      <span class="flow-video-cta">立即观看</span>
    </article>
  `;
}

/**
 * 渲染一个阶段按钮。
 *
 * @param {typeof TRADE_STAGES[number]} stage - 阶段数据。
 * @param {number} index - 阶段下标，从 0 开始。
 * @returns {string} 阶段按钮 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderStageButton(stage, index) {
  const number = String(index + 1).padStart(2, "0");
  const isActive = state.activeStageId === stage.id;

  return `
    <button class="stage-item ${isActive ? "active" : ""}" type="button" data-stage="${escapeHtml(stage.id)}">
      <span class="stage-index">${number}</span>
      <span class="stage-item-text">
        <strong class="stage-name">${escapeHtml(stage.title)}</strong>
        <span class="stage-brief">${escapeHtml(stage.desc)}</span>
      </span>
    </button>
  `;
}

/**
 * 渲染顶部信息卡片。
 *
 * @param {string} title - 卡片标题。
 * @param {string} text - 卡片内容。
 * @returns {string} 信息卡片 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderTopInfo(title, text) {
  return `
    <article class="top-info-item">
      <h4>${escapeHtml(title)}</h4>
      <p>${escapeHtml(text)}</p>
    </article>
  `;
}

/**
 * 渲染列表型详情块。
 *
 * @param {string} title - 区块标题。
 * @param {string[]} items - 列表项文本。
 * @returns {string} 详情块 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderListBlock(title, items) {
  return `
    <article class="detail-block">
      <h4>${escapeHtml(title)}</h4>
      <ul class="detail-list">
        ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </article>
  `;
}

/**
 * 渲染资料 / 表格按钮。
 *
 * @param {string[]} materials - 资料按钮文本。
 * @returns {string} 资料区 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderMaterials(materials) {
  return `
    <article class="detail-block">
      <h4>资料 / 表格</h4>
      <div class="material-row">
        ${materials.map((material, index) => `
          <button class="action-btn ${index === 0 ? "primary" : ""}" type="button" data-toast="${escapeHtml(material)} 是原型按钮，不会真实下载文件。">
            ${escapeHtml(material)}
          </button>
        `).join("")}
      </div>
    </article>
  `;
}

/**
 * 渲染阶段关联功能入口。
 *
 * @param {string[]} functions - 功能按钮文本。
 * @returns {string} 功能入口 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderFunctions(functions) {
  return `
    <div class="function-row">
      ${functions.map((name, index) => `
        <button class="tag-btn ${index === 0 ? "active" : ""}" type="button" data-toast="已定位到「${escapeHtml(name)}」入口，当前静态原型不跳转真实线上页面。">
          ${escapeHtml(name)}
        </button>
      `).join("")}
    </div>
  `;
}

/**
 * 渲染销售准备 > 了解公司。
 *
 * @returns {string} 公司资料维护 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCompanyView() {
  const activeModule = getCompanyModuleById(state.activeCompanyModule);

  return `
    <section class="prep-view company-prep">
      <article class="prep-hero company-hero">
        <div>
          <h2><span class="orange-bar"></span>公司资料维护</h2>
          <p class="hero-sub-orange">补充资料与 AI 提炼</p>
          <p class="hero-sub-text">左侧选择要维护的公司模块，右侧直接修改内容。已有公司画册或定位资料，也可以上传文档导入</p>
        </div>
        <button class="upload-pill" type="button" data-prep-upload="company">
          <span class="upload-pill-icon" aria-hidden="true">⇧</span>
          <span>上传文档</span>
        </button>
      </article>

      <section class="company-layout workbench-enter" aria-label="公司资料维护">
        <aside class="company-modules">
          <header class="company-modules-head">
            <h3><span class="orange-bar"></span>公司资料模块</h3>
          </header>
          <div class="company-toolbar">
            <button class="company-tool primary" type="button" data-toast="新增模块是原型反馈，不创建真实模块。">
              <span aria-hidden="true">⊕</span> 新增
            </button>
            <button class="company-tool" type="button" data-toast="查看资料是原型反馈。">
              <span aria-hidden="true">◉</span> 查看
            </button>
            <button class="company-tool" type="button" data-toast="改名是原型反馈，不修改真实资料。">
              <span aria-hidden="true">✎</span> 改名
            </button>
            <button class="company-tool" type="button" data-toast="删除资料需要真实确认，当前原型不删除。">
              <span aria-hidden="true">⌫</span> 删除
            </button>
          </div>
          <div class="module-list">
            ${COMPANY_MODULES.map((module, index) => `
              <button class="module-card ${state.activeCompanyModule === module.id ? "active" : ""}" type="button" data-company-module="${escapeHtml(module.id)}">
                <span class="module-card-index">${String(index + 1).padStart(2, "0")}</span>
                <span class="module-card-text">
                  <strong>${escapeHtml(module.title)}</strong>
                  <em>${escapeHtml(module.summary)}</em>
                </span>
                <span class="module-card-status ${module.status === "已完成" ? "done" : "draft"}">${escapeHtml(module.status)}</span>
              </button>
            `).join("")}
          </div>
        </aside>

        <article class="company-editor">
          <header class="editor-head">
            <div>
              <h3>当前编辑：${escapeHtml(activeModule.title)}</h3>
              <p>${escapeHtml(activeModule.detail)}</p>
            </div>
            <button class="ai-polish-pill" type="button" data-toast="已模拟用 AI 提炼当前模块表达。">
              <span aria-hidden="true">✦</span>
              <span>AI 提炼</span>
            </button>
          </header>
          <div class="company-tag-row">
            ${(activeModule.tags || []).map((tag) => `<span class="company-tag">${escapeHtml(tag)}</span>`).join("")}
          </div>
          <div class="company-editor-area">
            <textarea aria-label="模块内容">${escapeHtml(activeModule.fields.join("\n"))}</textarea>
          </div>
          <div class="company-editor-save">
            <button type="button" data-toast="已模拟保存当前模块的最新内容。">保存当前模块</button>
          </div>
        </article>
      </section>
    </section>
  `;
}

/**
 * 渲染销售准备 > 产品&市场。
 *
 * @returns {string} 产品与市场全景表 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderProductMarketView() {
  const totalProducts = PRODUCT_ROWS.length;
  const selectedCount = state.selectedProductId ? 1 : 0;

  return `
    <section class="prep-view product-prep">
      <article class="prep-hero product-hero">
        <div>
          <h2><span class="orange-bar"></span>产品与市场全景表</h2>
          <p class="hero-sub-text">把产品目录、图片素材、市场、客户画像、竞品分析和核心卖点整合进一张业务员随查随读的表</p>
        </div>
      </article>

      <section class="product-board workbench-enter">
        <div class="product-toolbar product-toolbar-row">
          <p>上传产品目录、图片、市场笔记或客户反馈后，AI 会把信息整理到这张表。</p>
          <div class="product-toolbar-actions">
            <button class="upload-pill" type="button" data-prep-upload="product">
              <span class="upload-pill-icon" aria-hidden="true">⇧</span>
              <span>上传资料</span>
            </button>
            <button class="export-pill" type="button" data-toast="导出为产品目录是原型反馈，不生成真实文件。">
              <span aria-hidden="true">↗</span>
              <span>导出为产品目录</span>
            </button>
          </div>
        </div>

        <div class="product-filter-bar">
          <button class="product-filter-chip active" type="button">全部产品：${totalProducts}</button>
          <span class="product-filter-meta">已跨分类选中 <strong>${selectedCount}</strong> 个产品</span>
        </div>

        <div class="table-wrap" aria-label="产品与市场全景表">
          <table class="product-table">
            <thead>
              <tr>
                <th class="col-check"><span class="cell-check" aria-hidden="true"></span> 选择</th>
                <th>分类</th>
                <th>产品 / 图片</th>
                <th>功能</th>
                <th>参数</th>
                <th>卖点</th>
                <th>缺点</th>
                <th>使用场景</th>
              </tr>
            </thead>
            <tbody>
              ${totalProducts ? PRODUCT_ROWS.map((product) => `
                <tr class="${state.selectedProductId === product.id ? "selected" : ""}" data-product-row="${escapeHtml(product.id)}">
                  <td><button class="row-check ${state.selectedProductId === product.id ? "checked" : ""}" type="button" data-product="${escapeHtml(product.id)}" aria-label="选择 ${escapeHtml(product.name)}"></button></td>
                  <td>${escapeHtml(product.category)}</td>
                  <td><span class="product-avatar">${escapeHtml(product.image)}</span>${escapeHtml(product.name)}</td>
                  <td>${escapeHtml(product.function)}</td>
                  <td>${escapeHtml(product.params)}</td>
                  <td>${escapeHtml(product.selling)}</td>
                  <td>${escapeHtml(product.weakness)}</td>
                  <td>${escapeHtml(product.scenario)}</td>
                </tr>
              `).join("") : `<tr><td colspan="8" class="product-empty">暂无数据</td></tr>`}
            </tbody>
          </table>
        </div>

        <footer class="product-pagination">
          <span>当前 ${totalProducts} 数据，共 1 页</span>
          <div class="product-pager">
            <button type="button" disabled aria-label="上一页">‹</button>
            <button type="button" class="active">1</button>
            <button type="button" disabled aria-label="下一页">›</button>
          </div>
        </footer>
      </section>
    </section>
  `;
}

/**
 * 渲染销售准备 > 案例知识库。
 *
 * @returns {string} 案例知识库 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCaseLibraryView() {
  const filteredItems = getFilteredCaseItems();
  const tags = ["全部", "报价", "MOQ", "交付证据", "售后"];
  const categoryIcons = { client: "▦", review: "◎", faq: "?" };

  return `
    <section class="prep-view case-prep">
      <article class="prep-hero case-hero">
        <div>
          <h2><span class="orange-bar"></span>案例知识库</h2>
          <p class="hero-sub-text">快速查找客户案例、内部复盘和百问百答。AI 会先给每个文件做概览，再判断适合在哪个业务场景调用</p>
        </div>
        <button class="upload-pill" type="button" data-prep-upload="case">
          <span class="upload-pill-icon" aria-hidden="true">⇧</span>
          <span>上传资料</span>
        </button>
      </article>

      <section class="case-layout workbench-enter">
        <aside class="case-category-panel">
          <h3><span class="orange-bar"></span>资料分类</h3>
          <div class="case-category-list">
            ${CASE_CATEGORIES.map((category) => `
              <button class="case-category-card ${state.activeCaseCategory === category.id ? "active" : ""}" type="button" data-case-category="${escapeHtml(category.id)}">
                <span class="case-category-icon" aria-hidden="true">${escapeHtml(categoryIcons[category.id] || "▦")}</span>
                <span class="case-category-body">
                  <strong>${escapeHtml(category.title)}</strong>
                  <em>${escapeHtml(category.desc)}</em>
                </span>
                <span class="case-category-count">${category.count} 个</span>
              </button>
            `).join("")}
          </div>

          <p class="case-quick-label">快捷筛选</p>
          <div class="case-quick-tags">
            ${tags.map((tag) => `
              <button class="case-quick-tag ${state.activeCaseTag === tag ? "active" : ""}" type="button" data-case-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>
            `).join("")}
          </div>
        </aside>

        <section class="case-results">
          <div class="case-search-row">
            <div class="case-search-box">
              <span class="case-search-icon" aria-hidden="true">⌕</span>
              <input type="search" placeholder="搜索国家、行业、产品、客户问题、成交关键词" value="${escapeHtml(state.caseSearchQuery)}" data-case-search="true" />
              <button class="case-search-btn" type="button" data-toast="搜索已在当前原型内筛选。">
                <span class="case-search-btn-icon" aria-hidden="true">⌕</span>
                <span>搜索</span>
              </button>
            </div>
          </div>

          <h4 class="case-section-title">可用知识文件</h4>
          <div class="case-list">
            ${filteredItems.length ? filteredItems.map((item) => `
              <article class="case-card">
                <div>
                  <h3>${escapeHtml(item.title)}</h3>
                  <p>${escapeHtml(item.meta)}</p>
                </div>
                <p>${escapeHtml(item.excerpt)}</p>
                <div class="filter-row">
                  ${item.tags.map((tag) => `<span class="mini-tag">${escapeHtml(tag)}</span>`).join("")}
                </div>
              </article>
            `).join("") : `<article class="case-empty">正在加载知识文件...</article>`}
          </div>
        </section>
      </section>
    </section>
  `;
}

/**
 * 渲染 B 版右侧的客户资料与跟进上下文。
 *
 * B 版只改变“客户列表在侧栏、Agent 与资料左右并列”的信息架构；
 * 具体客户资料和跟进内容复用 A 版的同一个工作纸，避免两套方案出现不同字段、
 * 不同交互或不同的“跟进记录 → 关联待办”关系。
 *
 * @param {typeof KASS_GROUPS[number]["customers"][number]} customer - 当前客户。
 * @returns {string} 右侧上下文栏 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderKassComparisonContext(customer) {
  return `
    <aside class="kass-compare-context" aria-label="${escapeHtml(customer.name)} 客户上下文">
      <header class="kass-compare-customer-head" data-kass-customer-summary-target="true">
        <div>
          <small>${escapeHtml(customer.level)} 级客户</small>
          <h1>${escapeHtml(customer.name)}</h1>
          <p>${escapeHtml(customer.country)} · Alibaba.com 询盘 · ${escapeHtml(customer.stage)}</p>
        </div>
      </header>
      ${renderKassCustomerHub(customer)}
    </aside>
  `;
}

/**
 * 渲染 B 版 CRM Agent 对话主区。
 *
 * @param {typeof KASS_GROUPS[number]["customers"][number]} customer - 当前客户。
 * @returns {string} CRM Agent 对话 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderKassComparisonConversation(customer) {
  const profile = getKassBackgroundProfile(customer);

  return `
    <main class="kass-compare-agent" aria-label="CRM Agent 对话">
      <header class="kass-compare-agent-head">
        <span class="kass-agent-mark" aria-hidden="true">A</span>
        <div>
          <h1>CRM Agent</h1>
          <p>结合客户背调、跟进记录与关联待办持续分析</p>
        </div>
      </header>

      <div class="kass-crm-scroll" data-kass-agent-scroll="true">
        <article class="kass-chat-turn kass-chat-turn-user">
          <div class="kass-chat-avatar">我</div>
          <div class="kass-chat-content">
            <header><strong>我</strong><time>14:31</time></header>
            <p>分析这个客户，帮我判断下一步怎么跟进</p>
          </div>
        </article>

        <article class="kass-chat-turn kass-chat-turn-agent">
          <div class="kass-agent-mark" aria-hidden="true">A</div>
          <div class="kass-chat-content">
            <header><strong>CRM Agent</strong><time>14:31</time></header>
            <section class="kass-agent-analysis">
              <h2>客户分析</h2>
              <ul>
                <li>${escapeHtml(customer.name)} 当前处于“${escapeHtml(customer.stage)}”，关注 ${escapeHtml(customer.product || "待确认产品")}，采购量 ${escapeHtml(customer.quantity || "待确认")}。</li>
                <li>背调显示其采购角色为${escapeHtml(profile.purchasingRole)}，主要渠道包括${escapeHtml(profile.marketChannels)}。</li>
                <li>${escapeHtml(customer.summary || "现阶段应先补齐需求与决策链，再判断投入优先级。")}</li>
              </ul>
            </section>
            <section class="kass-agent-next">
              <h2>下一步建议</h2>
              <ol>
                <li><span>1</span><p>${escapeHtml(customer.nextAction || "确认关键需求与采购计划。")}</p></li>
                <li><span>2</span><p>围绕客户渠道准备匹配的产品组合、认证资料和差异化案例。</p></li>
                <li><span>3</span><p>锁定下一次沟通时间，并把承诺事项直接记录为这次跟进的待办。</p></li>
              </ol>
            </section>
          </div>
        </article>

        ${state.kassAgentMessages.map((message) => `
          <article class="kass-chat-turn ${message.role === "user" ? "kass-chat-turn-user" : "kass-chat-turn-agent"}" data-kass-message-id="${escapeHtml(message.id || "")}">
            <div class="${message.role === "user" ? "kass-chat-avatar" : "kass-agent-mark"}" aria-hidden="true">${message.role === "user" ? "我" : "A"}</div>
            <div class="kass-chat-content">
              <header><strong>${message.role === "user" ? "我" : "CRM Agent"}</strong><time>刚刚</time></header>
              <div
                data-kass-message-body="true"
                data-kass-render-phase="${getKassAgentMessageRenderPhase(message)}"
              >${renderKassAgentMessageContent(message)}</div>
            </div>
          </article>
        `).join("")}

      </div>

      <footer class="kass-agent-composer">
        <button type="button" class="kass-agent-attach" data-toast="附件入口为原型反馈，不读取本地文件。" aria-label="添加附件">附件</button>
        <textarea rows="1" data-kass-agent-input="true" placeholder="告诉 Agent 你想处理什么…">${escapeHtml(state.kassAgentDraft)}</textarea>
        <button class="kass-agent-send" type="button" data-kass-agent-send="true" ${state.kassAgentDraft.trim() && !state.kassAgentThinking ? "" : "disabled"}>发送</button>
      </footer>
    </main>
  `;
}

/**
 * 渲染 B 路由专用的“侧栏客户 + 对话 + 客户上下文”比较方案。
 *
 * @returns {string} B 版客户 Kass HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCustomerKassComparisonView() {
  const group = getKassWorkbenchGroup();
  const customer = getKassWorkbenchCustomer(group);

  if (!customer) {
    return `
      <section class="kass-compare-page workbench-enter">
        <div class="kass-crm-empty">
          <span class="kass-agent-mark" aria-hidden="true">A</span>
          <h1>${escapeHtml(group.label)} 级客户暂为空</h1>
          <p>从左侧展开其他等级并选择客户。</p>
        </div>
      </section>
    `;
  }

  const profile = getKassBackgroundProfile(customer);

  return `
    <section class="kass-compare-page workbench-enter" aria-label="客户 Kass B 版对照方案">
      ${renderKassComparisonConversation(customer)}
      ${renderKassComparisonContext(customer)}
    </section>
    ${renderKassResearchPanel(customer, profile)}
  `;
}

/**
 * 渲染客户Kass作战室。
 *
 * @returns {string} 客户Kass HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCustomerKassView() {
  if (isKassComparisonView()) {
    return renderCustomerKassComparisonView();
  }

  const group = getKassWorkbenchGroup();
  const customer = getKassWorkbenchCustomer(group);

  return `
    <section class="kass-crm-page workbench-enter" aria-label="客户 Kass CRM Agent">
      ${renderKassCustomerRoster(group)}
      ${customer ? `
        <main class="kass-crm-thread" aria-label="CRM Agent 对话">
          <header class="kass-customer-workspace-head">
            <div>
              <h1>${escapeHtml(customer.name)}</h1>
              <p>${escapeHtml(customer.country)} · Alibaba.com 询盘 · ${escapeHtml(customer.stage)}</p>
            </div>
          </header>

          <nav class="kass-workspace-tabs" aria-label="客户工作区">
            <button class="${state.activeKassTab === "conversation" ? "active" : ""}" type="button" data-kass-tab="conversation">成交顾问</button>
            <button class="${state.activeKassTab === "profile" ? "active" : ""}" type="button" data-kass-tab="profile">客户信息</button>
            <button class="${state.activeKassTab === "followups" ? "active" : ""}" type="button" data-kass-tab="followups">跟进记录</button>
          </nav>

          ${state.activeKassTab === "conversation" ? `
          <div class="kass-crm-scroll" data-kass-agent-scroll="true">
            <article class="kass-chat-turn kass-chat-turn-user">
              <div class="kass-chat-avatar">我</div>
              <div class="kass-chat-content">
                <header><strong>我</strong><time>14:31</time></header>
                <p>分析这个客户，帮我判断下一步怎么跟进</p>
              </div>
            </article>

            <article class="kass-chat-turn kass-chat-turn-agent">
              <div class="kass-agent-mark" aria-hidden="true">A</div>
              <div class="kass-chat-content">
                <header><strong>CRM Agent</strong><time>14:31</time></header>
                <section class="kass-agent-analysis">
                  <h2>客户分析</h2>
                  <ul>
                    <li>来自 Alibaba.com 的${escapeHtml(customer.stage)}，需求为 ${escapeHtml(customer.product || "待确认产品")}，数量 ${escapeHtml(customer.quantity || "待确认")}。</li>
                    <li>采购数量较大，符合供应能力与最小起订要求，具备较高转化潜力。</li>
                    <li>当前关注点可能在价格、交期与定制工艺，需要快速建立信任并推进报价。</li>
                  </ul>
                </section>
                <section class="kass-agent-next">
                  <h2>下一步建议</h2>
                  <ol>
                    <li><span>1</span><p>快速确认需求细节：材质、杯盖款式、包装、Logo 工艺与颜色数量等。</p></li>
                    <li><span>2</span><p>提供具备竞争力的报价与交期方案，争取 24 小时内给到初版报价。</p></li>
                    <li><span>3</span><p>准备样品方案与案例资料，安排寄样并锁定下次沟通时间。</p></li>
                  </ol>
                </section>
              </div>
            </article>

            ${state.kassAgentMessages.map((message) => `
              <article class="kass-chat-turn ${message.role === "user" ? "kass-chat-turn-user" : "kass-chat-turn-agent"}" data-kass-message-id="${escapeHtml(message.id || "")}">
                <div class="${message.role === "user" ? "kass-chat-avatar" : "kass-agent-mark"}" aria-hidden="true">${message.role === "user" ? "我" : "A"}</div>
                <div class="kass-chat-content">
                  <header><strong>${message.role === "user" ? "我" : "CRM Agent"}</strong><time>刚刚</time></header>
                  <div
                    data-kass-message-body="true"
                    data-kass-render-phase="${getKassAgentMessageRenderPhase(message)}"
                  >${renderKassAgentMessageContent(message)}</div>
                </div>
              </article>
            `).join("")}

          </div>

          <footer class="kass-agent-composer">
            <button type="button" class="kass-agent-attach" data-toast="附件入口为原型反馈，不读取本地文件。" aria-label="添加附件">附件</button>
            <textarea rows="1" data-kass-agent-input="true" placeholder="告诉 Agent 你想处理什么…">${escapeHtml(state.kassAgentDraft)}</textarea>
            <button class="kass-agent-send" type="button" data-kass-agent-send="true" ${state.kassAgentDraft.trim() && !state.kassAgentThinking ? "" : "disabled"}>发送</button>
          </footer>
          ` : state.activeKassTab === "profile" ? `
            <section class="kass-workspace-tab-body">
              ${renderKassWorkspaceTab(customer)}
            </section>
          ` : `
            <section class="kass-workspace-tab-body">
              ${renderKassFollowupTab(customer)}
            </section>
          `}
        </main>
      ` : `
        <div class="kass-crm-empty">
          <span class="kass-agent-mark" aria-hidden="true">A</span>
          <h1>${escapeHtml(group.label)} 级客户暂为空</h1>
          <p>从左侧选择其他等级，或新增客户后开始使用 CRM Agent。</p>
          <button type="button" data-toast="新增客户是原型入口，不创建真实客户。">新增客户</button>
        </div>
      `}
    </section>
  `;
}

/**
 * 渲染工作区内的客户列表栏。
 *
 * 为什么恢复独立客户栏：
 * - 用户需要在同一等级的客户之间快速切换，独立业务栏比塞进全局导航更易扫读。
 * - 右侧常驻详情卡已经移除，因此现在可以把空间重新分配给客户列表和 Agent 主区。
 * - 列表自身滚动，客户再多也不会把页面整体撑长；搜索按钮继续打开完整客户库浮层。
 *
 * @param {typeof KASS_GROUPS[number]} group - 当前 A/B/C 客户等级。
 * @returns {string} 客户列表栏 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderKassCustomerRoster(group) {
  const totalCount = Number(group.totalCount || group.customers.length);

  return `
    <aside class="kass-roster kass-crm-roster" aria-label="${escapeHtml(group.label)} 级客户列表">
      <header class="kass-roster-head">
        <div>
          <h2>${escapeHtml(group.label)} 重点推进</h2>
          <p>${escapeHtml(group.desc || "按等级查看当前客户")}</p>
        </div>
        <button class="kass-search-action" type="button" data-kass-directory-open="${escapeHtml(group.id)}" aria-label="搜索${escapeHtml(group.label)}级客户">搜索</button>
      </header>
      <div class="kass-roster-list">
        ${group.customers.length ? group.customers.map((customer) => `
          <button class="kass-roster-item ${state.activeCustomerId === customer.id ? "active" : ""}" type="button" data-customer="${escapeHtml(customer.id)}" data-customer-group="${escapeHtml(group.id)}" data-kass-workbench-customer="true">
            <strong>${escapeHtml(customer.name)}</strong>
            <small>${escapeHtml(customer.country)}</small>
          </button>
        `).join("") : `<div class="kass-roster-empty">${escapeHtml(group.label)} 级暂无客户</div>`}
      </div>
      <button class="kass-roster-refresh" type="button" data-toast="已刷新 ${escapeHtml(group.label)} 级客户，本地样例没有变化。">刷新客户 · ${totalCount}</button>
    </aside>
  `;
}

/**
 * 渲染一条由跟进记录产生的待办。
 *
 * 待办没有再放进独立卡片：它必须和产生它的那次沟通保持在同一个视觉容器中，
 * 这样业务员才能快速理解“为什么要做这件事”，而不只看到一个脱离上下文的任务名。
 *
 * @param {unknown} status - 待办状态。
 * @returns {boolean} 状态表示已完成时返回 true。
 * @throws {Error} 本函数不主动抛异常。
 */
function isKassTaskCompletedStatus(status) {
  return [
    "已完成",
    "完成",
    "已办结",
    "done",
    "completed",
    "closed"
  ].includes(String(status || "").trim().toLowerCase());
}

/**
 * 渲染一条由跟进记录产生的待办。
 *
 * @param {{ id?: string, title?: string, dueDate?: string, status?: string }} task - 当前待办数据。
 * @returns {string} 待办行 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderKassFollowupTask(task) {
  const taskId = String(task.id || `kass-task-${task.title || "untitled"}`);
  /*
   * Agent 通过 Plugin 更新的状态保存在 task.status 中，不能只依赖当前页面内存里的 Set。
   * 否则接口明明已经把任务改成“已完成”，重新回读后右栏仍会显示成“待处理”。
   *
   * Set 继续保留给原型里的手动勾选反馈；持久化状态则兼容中文和常见英文枚举。
   */
  const isCompleted = state.kassCompletedTaskIds.has(taskId)
    || isKassTaskCompletedStatus(task.status);
  const isAgentSuggested = taskId.startsWith("agent-next-");

  return `
    <label
      class="kass-linked-task ${isCompleted ? "completed" : ""}"
      data-kass-task-row="${escapeHtml(taskId)}"
    >
      <input
        type="checkbox"
        data-kass-task-toggle="${escapeHtml(taskId)}"
        data-kass-task-status="${escapeHtml(task.status || "待处理")}"
        data-kass-task-due="${escapeHtml(task.dueDate || "待定")}"
        ${isCompleted ? "checked" : ""}
      />
      <span class="kass-linked-task-copy">
        <strong>
          <span class="kass-task-title">${escapeHtml(task.title || "待补充事项")}</span>
          ${isAgentSuggested ? '<span class="kass-task-origin">AI 建议</span>' : ""}
        </strong>
        <small>${isCompleted ? "已完成" : `${escapeHtml(task.status || "待处理")} · 截止 ${escapeHtml(task.dueDate || "待定")}`}</small>
      </span>
    </label>
  `;
}

/**
 * 渲染一条可展开的跟进记录，并把其产生的待办嵌套在正文下方。
 *
 * @param {{ id?: string, date?: string, dayLabel?: string, time?: string, owner?: string, channel?: string, title?: string, summary?: string, text?: string, tasks?: Array<object> }} record - 当前跟进记录。
 * @param {number} index - 记录在时间线中的顺序；第一条默认展开。
 * @returns {string} 跟进记录 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderKassFollowupRecord(record, index) {
  const recordId = String(record.id || `kass-followup-${record.date || index}`);
  const tasks = Array.isArray(record.tasks) ? record.tasks : [];
  const dateLabel = [record.dayLabel, record.date].filter(Boolean).join(" · ") || "最近";
  const recordMeta = [record.time, record.owner, record.channel].filter(Boolean).join(" · ");

  return `
    <article class="kass-followup-entry" data-kass-followup-id="${escapeHtml(recordId)}">
      <div class="kass-followup-date">
        <strong>${escapeHtml(dateLabel)}</strong>
        <small>${escapeHtml(record.time || "")}</small>
      </div>
      <details class="kass-followup-details" ${index === 0 ? "open" : ""}>
        <summary>
          <span>
            <strong>${escapeHtml(record.title || record.summary || "客户跟进记录")}</strong>
            <small>${escapeHtml(recordMeta || "已记录本次沟通")}</small>
          </span>
          ${tasks.length ? `<em>${tasks.length} 项待办</em>` : `<em>查看记录</em>`}
        </summary>
        <div class="kass-followup-content">
          <p>${escapeHtml(record.summary || record.text || "已记录本次客户沟通。")}</p>
          ${tasks.length ? `
            <section class="kass-linked-tasks" aria-label="本次跟进产生的待办">
              <header><strong>本次跟进产生的待办</strong><span>${tasks.length} 项</span></header>
              <div>${tasks.map(renderKassFollowupTask).join("")}</div>
            </section>
          ` : ""}
        </div>
      </details>
    </article>
  `;
}

/**
 * 整理客户的稳定背调资料，确保客户信息页不会误用询盘、跟进或待办数据。
 *
 * 旧样例和其它客户可能还没有结构化背调，因此这里提供“待补充”兜底。兜底只使用国家等
 * 稳定基础信息，不读取 `summary`、`nextAction` 或本次询盘条件，避免与下方跟进时间线重复。
 *
 * @param {typeof KASS_GROUPS[number]["customers"][number]} customer - 当前客户。
 * @returns {{
 *   overview: string,
 *   companyBackground: string,
 *   mainBusiness: string,
 *   enteredAt: string,
 *   foundedYear: string,
 *   companySize: string,
 *   companyType: string,
 *   organization: string,
 *   purchasingRole: string,
 *   marketChannels: string,
 *   contactName: string,
 *   contactRole: string,
 *   socialMedia: string,
 *   contactEmail: string,
 *   whatsapp: string,
 *   annualRevenue: string,
 *   cooperationStage: string,
 *   purchaseCycle: string,
 *   purchasePotential: string,
 *   productPreference: string,
 *   purchasePreference: string,
 *   expandableProducts: string,
 *   paymentTerms: string,
 *   finalConsignee: string,
 *   creditStatus: string,
 *   cooperationValue: string,
 *   competitors: string,
 *   competitiveAdvantage: string,
 *   currentSuppliers: string,
 *   sources: string[],
 *   updatedAt: string,
 *   incompleteItems: string[]
 * }} 可直接渲染的稳定客户档案。
 * @throws {Error} 本函数不主动抛异常。
 */
function getKassBackgroundProfile(customer) {
  const profile = customer.backgroundProfile || {};
  const sources = Array.isArray(profile.sources)
    ? profile.sources.filter(Boolean)
    : [];
  const incompleteItems = Array.isArray(profile.incompleteItems)
    ? profile.incompleteItems.filter(Boolean)
    : ["公司规模", "采购角色"];
  const countryLabel = customer.country ? `${customer.country}企业` : "该企业";

  return {
    overview: profile.overview || `${countryLabel}的公司背景与主营业务仍待补充。`,
    companyBackground: profile.companyBackground || `${countryLabel}，详细背景待补充`,
    mainBusiness: profile.mainBusiness || "待补充",
    enteredAt: profile.enteredAt || profile.updatedAt || "待补充",
    foundedYear: profile.foundedYear || "待补充",
    companySize: profile.companySize || "待补充",
    companyType: profile.companyType || "待补充",
    organization: profile.organization || "待补充",
    purchasingRole: profile.purchasingRole || "待补充",
    marketChannels: profile.marketChannels || "待补充",
    contactName: profile.contactName || customer.contact || "待补充",
    contactRole: profile.contactRole || "待补充",
    socialMedia: profile.socialMedia || "待补充",
    contactEmail: profile.contactEmail || "待补充",
    whatsapp: profile.whatsapp || "待补充",
    annualRevenue: profile.annualRevenue || "待补充",
    cooperationStage: profile.cooperationStage || "待补充",
    purchaseCycle: profile.purchaseCycle || "待补充",
    purchasePotential: profile.purchasePotential || "待补充",
    productPreference: profile.productPreference || profile.mainBusiness || "待补充",
    purchasePreference: profile.purchasePreference || "待补充",
    expandableProducts: profile.expandableProducts || "待补充",
    paymentTerms: profile.paymentTerms || "待补充",
    finalConsignee: profile.finalConsignee || "待补充",
    creditStatus: profile.creditStatus || "待核验",
    cooperationValue: profile.cooperationValue || "待补充背调后判断",
    competitors: profile.competitors || "待补充",
    competitiveAdvantage: profile.competitiveAdvantage || "待补充",
    currentSuppliers: profile.currentSuppliers || "待补充",
    sources: sources.length ? sources : ["业务员录入"],
    updatedAt: profile.updatedAt || "最近",
    incompleteItems
  };
}

/**
 * 渲染客户详细档案中的一个标签和值。
 *
 * 参考界面使用“灰色标签格 + 白色内容格”的表格式结构。这里统一生成字段，
 * 让桌面双列和窄屏单列使用同一套语义，并对确实缺失的值提供轻量提示。
 *
 * @param {string} label - 字段名称。
 * @param {string | number | undefined | null} value - 字段内容；空值显示“待补充”。
 * @param {{ wide?: boolean, missing?: boolean }} [options] - `wide` 表示横跨整行，`missing` 表示需要补充。
 * @returns {string} 单个字段的 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderKassDetailField(label, value, options = {}) {
  const displayValue = value === undefined || value === null || value === ""
    ? "待补充"
    : String(value);
  const isMissing = Boolean(options.missing || displayValue === "待补充");

  return `
    <div class="kass-detail-field ${options.wide ? "is-wide" : ""} ${isMissing ? "is-missing" : ""}">
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(displayValue)}</dd>
    </div>
  `;
}

/**
 * 渲染客户完整档案的五组字段。
 *
 * 客户信息页和 B 版抽屉必须展示同一份资料，因此把字段结构集中在这里。
 * 后续增删字段时只改一处，可避免“页面有、抽屉没有”或字段顺序不一致。
 *
 * @param {typeof KASS_GROUPS[number]["customers"][number]} customer - 当前客户。
 * @param {ReturnType<typeof getKassBackgroundProfile>} profile - 已归一化的稳定客户档案。
 * @returns {string} 完整档案分组 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderKassDetailedProfileSections(customer, profile) {
  const sourceLabel = profile.sources.join(" + ");
  const incompleteItems = profile.incompleteItems;

  return `
    <section class="kass-detail-section">
      <h3>基础信息</h3>
      <dl class="kass-detail-grid">
        ${renderKassDetailField("客户来源", sourceLabel)}
        ${renderKassDetailField("入档日期", profile.enteredAt)}
        ${renderKassDetailField("客户名称", customer.name)}
        ${renderKassDetailField("国家 / 地区", customer.country)}
        ${renderKassDetailField("官网", customer.website)}
        ${renderKassDetailField("成立年份", profile.foundedYear)}
        ${renderKassDetailField("公司规模", profile.companySize)}
        ${renderKassDetailField("客户类型", profile.companyType)}
        ${renderKassDetailField("公司背景", profile.companyBackground, { wide: true })}
        ${renderKassDetailField("主营业务", profile.mainBusiness, { wide: true })}
        ${renderKassDetailField("组织架构", profile.organization, { wide: true })}
      </dl>
    </section>

    <section class="kass-detail-section">
      <h3>主要联系人信息</h3>
      <dl class="kass-detail-grid">
        ${renderKassDetailField("姓名", profile.contactName)}
        ${renderKassDetailField("岗位", profile.contactRole)}
        ${renderKassDetailField("联系渠道", profile.contactEmail)}
        ${renderKassDetailField("WhatsApp", profile.whatsapp)}
        ${renderKassDetailField("社媒", profile.socialMedia, { wide: true })}
        ${renderKassDetailField("采购角色", profile.purchasingRole, { wide: true })}
      </dl>
    </section>

    <section class="kass-detail-section">
      <h3>采购 / 市场汇总</h3>
      <dl class="kass-detail-grid">
        ${renderKassDetailField("合作阶段", profile.cooperationStage)}
        ${renderKassDetailField("采购周期", profile.purchaseCycle)}
        ${renderKassDetailField("年营业额", profile.annualRevenue)}
        ${renderKassDetailField("采购潜力", profile.purchasePotential)}
        ${renderKassDetailField("市场渠道", profile.marketChannels, { wide: true })}
        ${renderKassDetailField("产品偏好", profile.productPreference, { wide: true })}
        ${renderKassDetailField("采购偏好", profile.purchasePreference, { wide: true })}
        ${renderKassDetailField("可拓展产品", profile.expandableProducts, { wide: true })}
      </dl>
    </section>

    <section class="kass-detail-section">
      <h3>资信与合作判断</h3>
      <dl class="kass-detail-grid">
        ${renderKassDetailField("付款条件", profile.paymentTerms, { missing: incompleteItems.includes("付款条件") })}
        ${renderKassDetailField("最终收货主体", profile.finalConsignee, { missing: incompleteItems.includes("最终收货主体") })}
        ${renderKassDetailField("资信情况", profile.creditStatus, { wide: true })}
        ${renderKassDetailField("合作价值", profile.cooperationValue, { wide: true })}
      </dl>
    </section>

    <section class="kass-detail-section">
      <h3>竞对信息</h3>
      <dl class="kass-detail-grid">
        ${renderKassDetailField("主要竞对", profile.competitors, { wide: true })}
        ${renderKassDetailField("竞争优势", profile.competitiveAdvantage, { wide: true })}
        ${renderKassDetailField("现有供应商", profile.currentSuppliers, { wide: true })}
      </dl>
    </section>
  `;
}

/**
 * 渲染“查看完整资料”抽屉。
 *
 * 主页面只展示一眼可回忆的客户档案；详细档案参考用户提供的分组表格，
 * 展开基础信息、联系人、采购市场、资信合作和竞对信息。当前跟进、待办与下一步
 * 不进入这里，继续和下方时间线保持清晰边界。
 *
 * @param {typeof KASS_GROUPS[number]["customers"][number]} customer - 当前客户。
 * @param {ReturnType<typeof getKassBackgroundProfile>} profile - 已归一化的稳定客户档案。
 * @returns {string} 打开时返回抽屉 HTML，关闭时返回空字符串。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderKassResearchPanel(customer, profile) {
  if (!state.kassResearchOpen) {
    return "";
  }

  const sourceLabel = profile.sources.join(" + ");
  const incompleteItems = profile.incompleteItems;

  return `
    <div class="kass-research-backdrop" data-kass-research-close="backdrop">
      <aside class="kass-research-drawer" role="dialog" aria-modal="true" aria-label="${escapeHtml(customer.name)} 客户详细档案">
        <header>
          <div>
            <h2>客户详细档案</h2>
            <p>查看客户背景、关键联系人、采购市场与合作判断。</p>
          </div>
          <button type="button" data-kass-research-close="button" aria-label="关闭客户详细档案">关闭</button>
        </header>
        <div class="kass-research-body">
          <div class="kass-detail-intro">
            <p>资料来自客户背调顾问与国际站询盘，已合并为一份稳定客户档案。</p>
            ${incompleteItems.length ? `<strong>${incompleteItems.length} 项待完善</strong>` : `<strong class="is-complete">资料完整</strong>`}
          </div>
          ${renderKassDetailedProfileSections(customer, profile)}
        </div>
        <footer>
          <div>
            <span>资料已合并：${escapeHtml(sourceLabel)}</span>
            <span>更新于 ${escapeHtml(profile.updatedAt)}</span>
          </div>
          ${incompleteItems.length ? `<button type="button" data-toast="已记录补充背调需求（原型反馈）。">补充背调</button>` : ""}
        </footer>
      </aside>
    </div>
  `;
}

/**
 * 渲染独立的“跟进记录”页签内容。
 *
 * 跟进记录和它产生的待办继续放在同一条时间线记录里，不能拆成两个互不关联的列表。
 * 新增入口也放在本页顶部，让“查看历史”和“记录新沟通”在同一个工作上下文完成。
 *
 * @param {typeof KASS_GROUPS[number]["customers"][number]} customer - 当前客户。
 * @returns {string} 跟进记录页签 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderKassFollowupWorkspace(customer) {
  const records = Array.isArray(customer.followupRecords) ? customer.followupRecords : [];

  return `
    <section class="kass-followup-workspace">
      <header class="kass-followup-heading">
        <div><small>沟通记录与行动闭环</small><h2>跟进记录</h2></div>
        <button type="button" data-kass-record-open="true">新增跟进记录</button>
      </header>

      ${state.kassRecordFormOpen ? `
        <section class="kass-record-form kass-record-form-wide kass-hub-record-form">
          <div class="kass-record-form-title"><strong>新增跟进记录</strong><button type="button" data-kass-record-cancel="true">取消</button></div>
          <div class="kass-record-form-grid">
            <label><span>跟进方式</span><select><option>邮件</option><option>电话</option><option>视频会议</option></select></label>
            <label><span>日期</span><input type="date" value="2026-07-23" /></label>
            <label><span>客户阶段</span><select><option>${escapeHtml(customer.stage || "待补充")}</option><option>谈判中</option><option>待报价</option></select></label>
          </div>
          <label><span>本次沟通内容</span><textarea placeholder="粘贴客户消息、电话纪要、报价反馈或会议结论…"></textarea></label>
          <footer><button type="button" data-toast="AI 整理为原型反馈。">AI 整理成记录</button><button class="primary" type="button" data-kass-record-save="true">保存记录</button></footer>
        </section>
      ` : ""}

      ${records.length ? `
        <div class="kass-followup-timeline">
          ${records.map(renderKassFollowupRecord).join("")}
        </div>
      ` : `
        <div class="kass-followup-empty">
          <strong>暂无跟进记录</strong>
          <p>新增一次客户沟通后，可在记录下方继续关联待办。</p>
          <button type="button" data-kass-record-open="true">新增第一条跟进</button>
        </div>
      `}
    </section>
  `;
}

/**
 * 渲染 A、B 两套方案共用的客户资料工作纸。
 *
 * 页面信息结构遵循两层阅读节奏：
 * - 顶部左侧只说明资料来源与完善状态，右侧帮助销售回忆稳定背景；
 *   两边不重复近期互动、当前进展或下一步。
 * - 下方时间线把每次沟通与它产生的待办放在一起，保留完整因果关系。
 *
 * @param {typeof KASS_GROUPS[number]["customers"][number]} customer - 当前客户。
 * @returns {string} 可同时嵌入 A 版页签和 B 版右栏的工作纸 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderKassCustomerHub(customer) {
  const profile = getKassBackgroundProfile(customer);
  const incompleteCount = profile.incompleteItems.length;
  const sourceRows = profile.sources
    .map((source) => `
      <span class="kass-profile-source-row">
        <span>${escapeHtml(source)}</span>
        <small>已纳入</small>
      </span>
    `)
    .join("");

  return `
    <div class="kass-customer-hub" data-kass-customer-summary-target="true">
      <section
        class="kass-background-card"
        aria-labelledby="kass-background-title"
        data-kass-profile-target="true"
      >
        <button class="kass-profile-file" type="button" data-kass-research-open="true">
          <span class="kass-profile-file-head">
            <small>资料状态</small>
            <span class="kass-profile-file-count">${incompleteCount ? `${incompleteCount} 项待完善` : "资料完整"}</span>
          </span>
          <strong id="kass-background-title">已汇总 ${profile.sources.length} 个来源</strong>
          <span class="kass-profile-file-caption">当前客户资料来自</span>
          <span class="kass-profile-source-list">${sourceRows}</span>
          <span class="kass-profile-file-action">查看完整资料</span>
        </button>

        <div class="kass-profile-memory">
          <header>
            <span>帮助快速回忆客户</span>
            <time datetime="${escapeHtml(profile.updatedAt)}">更新于 ${escapeHtml(profile.updatedAt)}</time>
          </header>
          <p class="kass-background-summary">${escapeHtml(profile.overview)}</p>
          <dl class="kass-background-facts">
            <div><dt>公司规模</dt><dd>${escapeHtml(profile.companySize)}</dd></div>
            <div><dt>采购角色</dt><dd>${escapeHtml(profile.purchasingRole)}</dd></div>
            <div><dt>市场渠道</dt><dd>${escapeHtml(profile.marketChannels)}</dd></div>
            <div><dt>资信情况</dt><dd>${escapeHtml(profile.creditStatus)}</dd></div>
          </dl>
          ${incompleteCount ? `
            <footer>
              <button class="kass-background-supplement" type="button" data-kass-research-open="true">
                补充背调
              </button>
            </footer>
          ` : ""}
        </div>
      </section>

      ${renderKassFollowupWorkspace(customer)}
    </div>
  `;
}

/**
 * 渲染 A 版“客户信息”页签。
 *
 * 完整档案直接铺在当前界面，不再要求用户点击“查看完整资料”打开抽屉。
 * 跟进和待办已迁移到独立页签，本页只保留稳定客户资料。
 *
 * @param {typeof KASS_GROUPS[number]["customers"][number]} customer - 当前客户。
 * @returns {string} A 版客户信息页签 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderKassWorkspaceTab(customer) {
  const profile = getKassBackgroundProfile(customer);
  const sourceLabel = profile.sources.join(" + ");
  const incompleteItems = profile.incompleteItems;

  return `
    <article
      class="kass-inline-profile"
      data-kass-customer-summary-target="true"
      data-kass-profile-target="true"
      aria-labelledby="kass-inline-profile-title"
    >
      <header class="kass-inline-profile-head">
        <div>
          <small>客户资料</small>
          <h2 id="kass-inline-profile-title">客户详细档案</h2>
          <p>${escapeHtml(profile.overview)}</p>
        </div>
        ${incompleteItems.length
          ? `<strong>${incompleteItems.length} 项待完善</strong>`
          : `<strong class="is-complete">资料完整</strong>`}
      </header>
      <div class="kass-inline-profile-body">
        ${renderKassDetailedProfileSections(customer, profile)}
      </div>
      <footer class="kass-inline-profile-foot">
        <div>
          <span>资料已合并：${escapeHtml(sourceLabel)}</span>
          <span>更新于 ${escapeHtml(profile.updatedAt)}</span>
        </div>
        ${incompleteItems.length ? `<button type="button" data-toast="已记录补充背调需求（原型反馈）。">补充背调</button>` : ""}
      </footer>
    </article>
  `;
}

/**
 * 渲染 A 版“跟进记录”页签。
 *
 * @param {typeof KASS_GROUPS[number]["customers"][number]} customer - 当前客户。
 * @returns {string} 跟进记录与关联待办 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderKassFollowupTab(customer) {
  return `
    <div class="kass-followup-tab-sheet" data-kass-customer-summary-target="true">
      ${renderKassFollowupWorkspace(customer)}
    </div>
  `;
}

/**
 * 返回客户库浮层中符合搜索词的客户。
 *
 * @param {typeof KASS_GROUPS[number]} group - 当前浮层展示的客户等级。
 * @returns {typeof group.customers} 筛选后的本地样例客户。
 * @throws {Error} 本函数不主动抛异常。
 */
function getFilteredKassDirectoryCustomers(group) {
  const query = state.kassCustomerQuery.trim().toLowerCase();

  return group.customers.filter((customer) => {
    const searchable = `${customer.name} ${customer.country} ${customer.stage} ${customer.intent || ""}`.toLowerCase();
    return !query || searchable.includes(query);
  });
}

/**
 * 渲染侧边栏“查看全部客户”浮层。
 *
 * 为什么是浮层而不是继续把名单塞进侧边栏：
 * - 侧边栏只承担高频快捷入口，最多保留五个客户。
 * - 搜索和长列表需要更稳定的宽度与独立滚动区域。
 *
 * @returns {string} 浮层 HTML；关闭时返回空字符串。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderKassCustomerDirectoryModal() {
  if (!state.kassCustomerDirectoryOpen) {
    return "";
  }

  const fallbackGroup = isKassWorkbenchView() ? getKassWorkbenchGroup() : getActiveKassGroup();
  const group = KASS_GROUPS.find((item) => item.id === state.kassDirectoryGroupId) || fallbackGroup;
  const workbenchAttribute = isKassWorkbenchView() ? `data-kass-workbench-customer="true"` : "";
  const customers = getFilteredKassDirectoryCustomers(group);

  return `
    <div class="kass-directory-backdrop" data-kass-directory-close="backdrop">
      <aside class="kass-directory-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(group.label)}级客户列表">
        <header class="kass-directory-head">
          <div><strong>${escapeHtml(group.label)} 级客户</strong><small>快速查找并切换当前客户</small></div>
          <button type="button" data-kass-directory-close="button" aria-label="关闭客户列表">关闭</button>
        </header>
        <label class="kass-directory-search">
          <span>搜索</span>
          <input type="search" value="${escapeHtml(state.kassCustomerQuery)}" placeholder="搜索客户名称" data-kass-directory-search="true" />
        </label>
        <p class="kass-directory-count">共 ${Number(group.totalCount || group.customers.length)} 个客户</p>
        <div class="kass-directory-list">
          ${customers.length ? customers.map((customer) => `
            <button class="kass-directory-customer ${state.activeCustomerId === customer.id ? "active" : ""}" type="button" data-customer="${escapeHtml(customer.id)}" data-customer-group="${escapeHtml(group.id)}" ${workbenchAttribute}>
              <span class="kass-directory-avatar">${escapeHtml(customer.shortName || customer.name.slice(0, 1))}</span>
              <span class="kass-directory-copy"><strong>${escapeHtml(customer.name)}</strong><small>${escapeHtml(customer.country)}　·　${escapeHtml(customer.stage)}</small></span>
              <em>${escapeHtml(customer.intent || `${customer.level}意向`)}</em>
            </button>
          `).join("") : `<div class="kass-directory-empty">没有找到符合条件的客户</div>`}
        </div>
      </aside>
    </div>
  `;
}

/**
 * 渲染线上 `/customer-kass/A` 的独立复刻页。
 *
 * 为什么单独保留一个渲染函数：
 * - 当前“重点推进”页已经形成新的产品方案，不能为了复刻线上页而覆盖它。
 * - 线上复刻页继续使用全局侧栏和顶部栏，用于和线上产品逐项对照。
 * - 客户名称、询盘和历史只读取本地样例数据，不把线上真实客户隐私写入原型。
 *
 * @returns {string} 线上版客户 Kass 页面 HTML。
 * @throws {Error} 本函数不主动抛异常；没有客户时会渲染空白会话区。
 */
function renderCustomerKassOnlineView() {
  const group = getActiveKassGroup();
  const customer = group.customers.length ? getActiveKassCustomer() : null;
  const activeStageIndex = getKassOnlineStageIndex(customer);

  return `
    <section class="kass-online-page workbench-enter" aria-label="客户 Kass 线上版复刻">
      <aside class="kass-online-directory" aria-label="${escapeHtml(group.label)} 分组客户列表">
        <header class="kass-online-directory-head">
          <div>
            <h1><span aria-hidden="true"></span>${escapeHtml(group.label)}</h1>
            <p>这里展示客户 Kass 下 ${escapeHtml(group.label)} 的所有客户</p>
          </div>
          <div class="kass-online-directory-actions">
            <button class="kass-online-icon-button" type="button" aria-label="搜索客户" data-toast="搜索客户是原型入口。">
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
                <circle cx="9" cy="9" r="5.5"></circle><path d="m13.3 13.3 3.4 3.4"></path>
              </svg>
            </button>
            <button class="kass-online-new-button" type="button" data-toast="新增客户是原型入口，不创建真实客户。"><span aria-hidden="true">⊕</span>新增</button>
          </div>
        </header>

        <div class="kass-online-customer-list">
          <button class="kass-online-customer-item placeholder" type="button" data-toast="这是用于还原线上列表密度的待补充样例。">
            <span class="kass-online-pin" aria-hidden="true">⌖</span>
            <strong>待补充客户</strong>
            <small>· 待补充</small>
            <span class="kass-online-item-actions" aria-hidden="true">▣　♲</span>
          </button>
          ${(group.customers || []).map((item) => `
            <button class="kass-online-customer-item ${state.activeCustomerId === item.id ? "active" : ""}" type="button" data-customer="${escapeHtml(item.id)}">
              <span class="kass-online-pin" aria-hidden="true">⌖</span>
              <strong>${escapeHtml(item.name)}</strong>
              <small>· ${escapeHtml(item.country)}</small>
              <span class="kass-online-item-actions" aria-hidden="true">▣　♲</span>
            </button>
          `).join("")}
        </div>
      </aside>

      <main class="kass-online-conversation">
        ${customer ? `
          <header class="kass-online-customer-head">
            <div>
              <h2><span aria-hidden="true"></span>${escapeHtml(customer.name)}</h2>
              <p>展示从线索到签约的跟进阶段，高亮为当前节点</p>
            </div>
            <div class="kass-online-customer-actions">
              <span>当前：${escapeHtml(KASS_FLOW_STAGES[activeStageIndex])}</span>
              <button type="button" data-toast="跟进记录是原型入口。"><b aria-hidden="true">↻</b>跟进记录</button>
            </div>
          </header>

          <div class="kass-online-stage-track" aria-label="客户跟进阶段">
            ${KASS_FLOW_STAGES.map((stage, index) => `
              <button class="kass-online-stage ${index === activeStageIndex ? "active" : ""}" type="button" data-toast="已定位到「${escapeHtml(stage)}」阶段。">${escapeHtml(stage)}</button>
              ${index < KASS_FLOW_STAGES.length - 1 ? `<span class="kass-online-stage-arrow" aria-hidden="true">▶</span>` : ""}
            `).join("")}
          </div>

          <div class="kass-online-chat-canvas" aria-label="客户对话记录"></div>

          <section class="kass-online-composer" aria-label="客户对话输入区">
            <textarea aria-label="输入对话内容" placeholder="请输入内容进行对话..."></textarea>
            <footer>
              <div class="kass-online-composer-left">
                <button class="kass-online-tool-button" type="button" aria-label="选择工具" data-toast="工具选择是原型入口。">⌁</button>
                <button class="kass-online-model-button" type="button" data-toast="模型选择是原型入口。"><span>${escapeHtml(group.label)}</span><b aria-hidden="true">⌄</b></button>
              </div>
              <div class="kass-online-composer-right">
                <button class="kass-online-mic-button" type="button" aria-label="语音输入" data-toast="语音输入是原型入口。">♩</button>
                <i aria-hidden="true"></i>
                <button class="kass-online-send-button" type="button" aria-label="发送" data-toast="发送是原型反馈，不会调用真实接口。">➤</button>
              </div>
            </footer>
          </section>
        ` : `
          <div class="kass-online-empty">新增或选择客户后开始跟进</div>
        `}
      </main>
    </section>
  `;
}

/**
 * 把本地样例客户的阶段转换成线上 12 阶段流程的下标。
 *
 * @param {typeof KASS_GROUPS[number]["customers"][number] | null} customer - 当前客户；允许为空。
 * @returns {number} `KASS_FLOW_STAGES` 中的下标；无法识别时回退到线索到达。
 * @throws {Error} 本函数不主动抛异常。
 */
function getKassOnlineStageIndex(customer) {
  if (!customer) {
    return 0;
  }

  const stageText = String(customer.stage || "");
  const matchedIndex = KASS_FLOW_STAGES.findIndex((stage) => stage.includes(stageText) || stageText.includes(stage.replace(/^\d+-/, "")));

  if (matchedIndex >= 0) {
    return matchedIndex;
  }

  if (stageText.includes("询盘")) return 0;
  if (stageText.includes("寄样") || stageText.includes("样品")) return 9;
  if (stageText.includes("报价")) return 8;
  if (stageText.includes("成交") || stageText.includes("复购")) return 11;
  return 0;
}

/**
 * 渲染选中客户的顶部信息、标签页和当前标签内容。
 *
 * @param {typeof KASS_GROUPS[number]["customers"][number]} customer - 当前选中的客户。
 * @returns {string} 客户工作区 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderKassClientWorkspace(customer) {
  const tabs = [
    { id: "conversation", label: "对话线程" },
    { id: "profile", label: "详情档案" },
    { id: "tasks", label: "事项" },
    { id: "records", label: "任务记录" }
  ];

  return `
    <header class="kass-client-header">
      <div>
        <h2>${escapeHtml(customer.name)}</h2>
        <p>${escapeHtml(customer.country)} · ${escapeHtml(customer.industry)} · ${escapeHtml(customer.stage)}</p>
      </div>
      <div class="kass-client-status">
        <span>${escapeHtml(customer.intent || `${customer.level}级客户`)}</span>
        <button type="button" data-toast="已同步当前客户的样例消息。">同步最近消息</button>
      </div>
    </header>
    <nav class="kass-client-tabs" aria-label="客户详情标签">
      ${tabs.map((tab) => `
        <button class="${state.activeKassTab === tab.id ? "active" : ""}" type="button" data-kass-tab="${escapeHtml(tab.id)}">${escapeHtml(tab.label)}</button>
      `).join("")}
    </nav>
    <section class="kass-client-content">
      ${renderKassActiveTab(customer)}
    </section>
  `;
}

/**
 * 根据客户 Kass 当前标签渲染内容。
 *
 * @param {typeof KASS_GROUPS[number]["customers"][number]} customer - 当前选中的客户。
 * @returns {string} 当前标签 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderKassActiveTab(customer) {
  if (state.activeKassTab === "profile") {
    return `
      <div class="kass-simple-grid">
        ${renderKassInfoCell("客户名称", customer.name)}
        ${renderKassInfoCell("国家 / 地区", customer.country)}
        ${renderKassInfoCell("行业", customer.industry)}
        ${renderKassInfoCell("联系人", customer.contact)}
        ${renderKassInfoCell("官网", customer.website)}
        ${renderKassInfoCell("客户评级", `${customer.level} · 风险${customer.risk}`)}
      </div>
    `;
  }

  if (state.activeKassTab === "tasks") {
    return `
      <div class="kass-task-board">
        <article><span>今天</span><strong>${escapeHtml(customer.nextAction || "补齐客户上下文")}</strong><small>优先级：高</small></article>
        <article><span>本周</span><strong>补齐包装、Logo 文件和目标交期</strong><small>等待客户反馈</small></article>
        <button type="button" data-toast="新增事项是原型入口。">新增事项</button>
      </div>
    `;
  }

  if (state.activeKassTab === "records") {
    return `
      <div class="kass-record-timeline">
        <article><time>14:31</time><div><strong>收到 Alibaba.com 新询盘</strong><p>${escapeHtml(customer.summary || "已录入客户原始询盘。")}</p></div></article>
        <article><time>14:36</time><div><strong>系统生成客户摘要</strong><p>已提取采购产品、数量、贸易条款和定制需求。</p></div></article>
        <article><time>待处理</time><div><strong>${escapeHtml(customer.nextAction || "创建下一步动作")}</strong><p>完成后可沉淀为客户跟进记录。</p></div></article>
      </div>
    `;
  }

  return renderKassConversationTab(customer);
}

/**
 * 渲染截图对应的对话线程主工作区。
 *
 * @param {typeof KASS_GROUPS[number]["customers"][number]} customer - 当前选中的客户。
 * @returns {string} 对话线程 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderKassConversationTab(customer) {
  return `
    <div class="kass-conversation-layout">
      <div class="kass-conversation-main">
        <article class="kass-section-card kass-summary-card">
          <header><h3>客户自动摘要</h3><span>样例摘要</span></header>
          <div class="kass-summary-metrics">
            ${renderKassInfoCell("阶段", customer.stage)}
            ${renderKassInfoCell("优先级", customer.intent || `${customer.level}级客户`)}
          </div>
          <p>${escapeHtml(customer.summary || "暂未生成客户摘要。")}</p>
          <strong>${escapeHtml(customer.nextAction || "先补齐客户上下文")}</strong>
        </article>

        <article class="kass-section-card">
          <header><h3>客户上下文</h3><span>样例上下文</span></header>
          <div class="kass-context-metrics">
            ${renderKassInfoCell(customer.name, customer.stage)}
            ${renderKassInfoCell(String(customer.recentActivities || 0), "近期活动")}
            ${renderKassInfoCell(String(customer.openTasks || 0), "未完成事项")}
          </div>
          <p>暂无明显风险信号。</p>
          <strong>${escapeHtml(customer.nextAction || "生成下一步动作")}</strong>
        </article>

        <article class="kass-section-card kass-inquiry-card">
          <header><h3>客户询盘原文</h3><span>来自 ${escapeHtml(customer.industry)}</span><time>14:31</time></header>
          <textarea data-customer-input="true" aria-label="客户询盘原文">${escapeHtml(state.customerDraft || customer.inquiry || "")}</textarea>
          <footer>
            <span>使用 DeepSeek flash 真实分析</span>
            <button class="kass-analyze-button enabled" type="button" data-send-customer="true" ${state.isCustomerGenerating ? "disabled" : ""}>
              ${state.isCustomerGenerating ? "正在分析" : "开始分析"}
            </button>
          </footer>
        </article>

        ${renderKassAnalysisState(customer)}

        <article class="kass-section-card kass-agent-card">
          <header><h3>客户跟进 Agent</h3><span>绑定当前客户上下文</span></header>
          <p>${state.customerResult ? escapeHtml(state.customerResult) : "输入客户问题后，这里会显示基于客户档案的回复。"}</p>
          <textarea data-customer-input="true" placeholder="继续追问，或输入要调整的回复语气…">${state.customerResult ? "" : ""}</textarea>
          <footer>
            <div class="kass-agent-tools">
              <button type="button" data-toast="引用资料是原型入口。">引用资料</button>
              <button type="button" data-toast="切换 Skill 是原型入口。">切换Skill</button>
              <button type="button" data-toast="已模拟导出草稿。">导出草稿</button>
            </div>
            <button class="kass-send-button" type="button" data-send-customer="true">发送</button>
          </footer>
        </article>
      </div>

      ${renderKassCustomerCard(customer)}
    </div>
  `;
}

/**
 * 渲染询盘分析的等待态或结果预览。
 *
 * @param {typeof KASS_GROUPS[number]["customers"][number]} customer - 当前选中的客户。
 * @returns {string} 分析状态 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderKassAnalysisState(customer) {
  if (state.isCustomerGenerating) {
    return `
      <article class="kass-section-card kass-progress-card active">
        <header><h3>处理进度</h3><span>分析中</span></header>
        <div class="kass-progress-line"><i></i></div>
        <p>正在提取采购数量、贸易条款、定制需求和信息缺口…</p>
      </article>
    `;
  }

  if (state.customerResult) {
    return `
      <article class="kass-section-card kass-result-card">
        <header><h3>分析结果预览</h3><span>已完成</span></header>
        <div class="kass-result-grid">
          <div><small>意向判断</small><strong>${escapeHtml(customer.intent || "中意向")}</strong></div>
          <div><small>信息缺口</small><strong>包装、Logo 文件、目标交期</strong></div>
          <div><small>风险提醒</small><strong>报价前需确认规格与交付条件</strong></div>
          <div><small>下一步</small><strong>${escapeHtml(customer.nextAction || "生成澄清回复")}</strong></div>
        </div>
      </article>
    `;
  }

  return `
    <article class="kass-section-card kass-progress-card">
      <header><h3>处理进度</h3><span>未开始</span></header>
      <p>点击开始分析后显示处理步骤。</p>
    </article>
    <article class="kass-section-card kass-result-card empty">
      <header><h3>分析结果预览</h3><span>等待真实模型返回</span></header>
      <p>这里会显示意向判断、信息缺口、风险提醒、英文回复草稿和下一步跟进。</p>
    </article>
  `;
}

/**
 * 渲染右侧客户卡片。
 *
 * @param {typeof KASS_GROUPS[number]["customers"][number]} customer - 当前选中的客户。
 * @returns {string} 右侧客户卡片 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderKassCustomerCard(customer) {
  // 只有拿到可展示的记录正文才进入列表态；单独的数量字段不应伪造一条跟进内容。
  const hasRecords = Array.isArray(customer.followupRecords) && customer.followupRecords.length > 0;

  return `
    <aside class="kass-customer-card kass-crm-customer-card" aria-label="当前客户信息">
      <header class="kass-crm-customer-head">
        <div><small>当前客户</small><h2>${escapeHtml(customer.name)}</h2></div>
        <button type="button" data-toast="客户卡片折叠是原型反馈。" aria-label="收起客户卡片">收起</button>
      </header>
      <div class="kass-customer-meta">
        <span>${escapeHtml(customer.country)}</span>
        <div><em>${escapeHtml(customer.intent || `${customer.level}意向`)}</em><em class="stage">${escapeHtml(customer.stage)}</em></div>
      </div>
      <div class="kass-customer-facts">
        ${renderKassInfoCell("采购产品", customer.product || "待补充")}
        ${renderKassInfoCell("采购数量", customer.quantity || "待补充")}
        ${renderKassInfoCell("询价条款", customer.tradeTerm || "待补充")}
        ${renderKassInfoCell("定制需求", customer.customization || "待补充")}
      </div>
      <article class="kass-customer-summary"><header><strong>AI 摘要</strong><time>2026-07-21 14:31</time></header><p>${escapeHtml(customer.summary || "等待生成摘要。")}</p></article>
      <section class="kass-followup-section">
        <header><h3>跟进记录</h3><button type="button" data-kass-record-open="true">新增记录</button></header>
        ${state.kassRecordFormOpen ? `
          <div class="kass-record-form">
            <div class="kass-record-form-title"><strong>新增跟进记录</strong><button type="button" data-kass-record-cancel="true">取消</button></div>
            <div class="kass-record-form-grid">
              <label><span>跟进方式</span><select><option>邮件</option><option>电话</option><option>视频会议</option></select></label>
              <label><span>客户阶段</span><select><option>${escapeHtml(customer.stage)}</option><option>谈判中</option><option>待报价</option></select></label>
            </div>
            <label><span>本次沟通内容</span><textarea placeholder="粘贴客户消息、报价反馈或会议结论…"></textarea></label>
            <footer><button type="button" data-toast="AI 整理为原型反馈。">AI 整理</button><button class="primary" type="button" data-kass-record-save="true">保存记录</button></footer>
          </div>
        ` : hasRecords ? `
          <div class="kass-followup-list"><article><time>最近</time><p>${escapeHtml(customer.nextAction || "继续推进客户需求")}</p></article></div>
        ` : `
          <div class="kass-followup-empty">
            <span aria-hidden="true">记录</span>
            <strong>暂无记录</strong>
            <p>Agent 的分析和沟通结果可以沉淀到这里</p>
            <button type="button" data-kass-record-open="true">新增记录</button>
          </div>
        `}
      </section>
    </aside>
  `;
}

/**
 * 渲染通用信息格，统一客户摘要和档案字段的视觉结构。
 *
 * @param {string | number} label - 字段标题。
 * @param {string | number} value - 字段值。
 * @returns {string} 信息格 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderKassInfoCell(label, value) {
  return `<div class="kass-info-cell"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>`;
}

/**
 * 根据客户跟进记录生成今日推进提醒。
 *
 * 为什么只看跟进记录：
 * - 用户已经明确：今日提醒应该来自真实跟进内容，而不是销售准备里的标准流程。
 * - 未来接后端时，这里可以直接替换为“读取该客户跟进记录 → AI 提炼下一步”的结果。
 * - 当前样例客户没有跟进记录时，提醒用户先补记录，这是更真实的空状态。
 *
 * @param {typeof KASS_GROUPS[number]["customers"][number]} customer - 当前客户。
 * @returns {{ source: string, priority: string, title: string, reason: string, action: string, chips: string[], sourceNote: string }} 今日推进提醒。
 * @throws {Error} 本函数不主动抛异常；缺少跟进记录时返回补记录提醒。
 */
function buildKassTodayReminder(customer) {
  const records = customer.followupRecords || customer.followups || [];
  const latestRecord = records[0] || null;

  if (!latestRecord) {
    return {
      source: `客户跟进记录 ${customer.records || 0} 条`,
      priority: "高",
      title: "先补一条跟进记录",
      reason: "这位客户还没有跟进记录。先补原始询盘、上次沟通结果和约定下一步。",
      action: "新增首次跟进记录",
      chips: ["原始询盘", "上次沟通结果", "约定下一步"],
      sourceNote: "依据：暂无跟进记录，今天先把客户上下文补齐。"
    };
  }

  return {
    source: latestRecord.time || "最近一条跟进记录",
    priority: latestRecord.priority || "中",
    title: latestRecord.nextAction || "确认下一步动作",
    reason: latestRecord.summary || "最近记录里已经出现下一步线索，今天应优先处理这条客户。",
    action: latestRecord.nextAction || "补充下一步动作",
    chips: latestRecord.tags || ["跟进记录", "下一步动作"],
    sourceNote: `判断依据：${latestRecord.text || latestRecord.summary || "最近跟进记录"}`
  };
}

/**
 * 渲染客户 Kass 分组层级的今日推进提醒。
 *
 * 为什么放在分组层级：
 * - A/B 是客户分层，不是某个客户详情。
 * - 今日该推进要先回答“这一组客户里今天先处理谁”，再让用户点进具体客户。
 *
 * @param {typeof KASS_GROUPS[number]} group - 当前客户 Kass 分组。
 * @returns {string} 分组今日推进 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderKassGroupTodayCard(group) {
  const reminders = group.customers.map((customer) => ({
    customer,
    reminder: buildKassTodayReminder(customer)
  }));
  const highCount = reminders.filter(({ reminder }) => reminder.priority === "高").length;
  const noRecordCount = group.customers.filter((customer) => (customer.records || 0) === 0).length;

  return `
    <article class="kass-today-card kass-group-today-card" aria-label="${escapeHtml(group.label)}级今日该推进">
      <header>
        <div>
          <h3><span class="orange-bar"></span>${escapeHtml(group.label)}级今日该推进</h3>
          <p>按这一组客户的跟进记录汇总</p>
        </div>
        <span class="kass-group-today-count">${group.customers.length} 个客户</span>
      </header>

      <div class="kass-group-today-metrics" aria-label="分组推进概览">
        <span><strong>${highCount}</strong> 高优先级</span>
        <span><strong>${noRecordCount}</strong> 缺记录</span>
      </div>

      ${reminders.length ? `
        <div class="kass-group-today-list">
          ${reminders.map(({ customer, reminder }) => `
            <button class="kass-group-today-item" type="button" data-customer="${escapeHtml(customer.id)}" aria-label="查看${escapeHtml(customer.name)}今日推进">
              <span class="kass-group-today-title">
                <em>${escapeHtml(reminder.priority)}</em>
                <strong>${escapeHtml(customer.name)}</strong>
              </span>
              <span class="kass-group-today-action">${escapeHtml(reminder.title)}</span>
              <span class="kass-group-today-source">${escapeHtml(reminder.source)}</span>
            </button>
          `).join("")}
        </div>
      ` : `
        <div class="kass-today-empty-state">这一组暂无客户，新增客户后再生成今日推进。</div>
      `}
    </article>
  `;
}

/**
 * 渲染客户档案 + 跟进流程 + 跟进记录三块详情，1:1 复刻线上 /customer-kass/A。
 *
 * @param {typeof KASS_GROUPS[number]["customers"][number]} customer - 当前客户。
 * @param {number} activeStageIndex - 当前阶段下标。
 * @returns {string} 详情区 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderKassDetail(customer, activeStageIndex) {
  return `
    <article class="kass-info-card">
      <header class="kass-info-head">
        <div class="kass-info-head-text">
          <h3><span class="orange-bar"></span>客户档案</h3>
          <p>${escapeHtml(customer.name)} · ${escapeHtml(customer.country)} · ${escapeHtml(customer.industry)}</p>
          <div class="kass-tag-row">
            ${customer.tags.map((tag) => `<span class="kass-tag-hash">#${escapeHtml(tag)}</span>`).join("")}
          </div>
          <dl class="kass-profile-grid">
            <div><dt>客户名称:</dt><dd>${escapeHtml(customer.name)}</dd></div>
            <div><dt>国家 / 地区:</dt><dd>${escapeHtml(customer.country)}</dd></div>
            <div><dt>行业类型:</dt><dd>${escapeHtml(customer.industry)}</dd></div>
            <div><dt>官网:</dt><dd>${escapeHtml(customer.website)}</dd></div>
            <div><dt>联系人:</dt><dd>${escapeHtml(customer.contact)}</dd></div>
            <div><dt>客户等级:</dt><dd>${escapeHtml(customer.level)}</dd></div>
          </dl>
        </div>
        <aside class="kass-rating-card">
          <div class="kass-rating-avatar" aria-hidden="true">${escapeHtml(customer.level)}</div>
          <small>客户评级</small>
          <button class="kass-detail-btn" type="button" data-toast="详细档案是原型入口。">
            <span class="kass-detail-icon" aria-hidden="true">▣</span>
            <span>详细档案</span>
          </button>
        </aside>
      </header>
    </article>

    <article class="kass-flow-card">
      <header>
        <div>
          <h3><span class="orange-bar"></span>跟进流程图</h3>
          <p>展示从线索到签约的跟进阶段，高亮为当前节点</p>
        </div>
        <span class="kass-flow-current">当前：${escapeHtml(KASS_FLOW_STAGES[activeStageIndex])}</span>
      </header>
      <div class="kass-flow-steps">
        ${KASS_FLOW_STAGES.map((stage, index) => `
          <button class="kass-flow-step ${index === activeStageIndex ? "active" : ""}" type="button" data-toast="已定位到「${escapeHtml(stage)}」阶段。">${escapeHtml(stage)}</button>
          ${index < KASS_FLOW_STAGES.length - 1 ? `<span class="kass-flow-arrow" aria-hidden="true">›</span>` : ""}
        `).join("")}
      </div>
    </article>

    <article class="kass-record-card">
      <header>
        <div>
          <h3><span class="orange-bar"></span>客户跟进记录</h3>
          <p>集中记录询盘、沟通、报价、AI 分析和建议下一步动作</p>
        </div>
        <div class="kass-record-actions">
          <button class="kass-date-btn" type="button" data-toast="日期筛选是原型反馈。">
            <span class="kass-date-icon" aria-hidden="true">▣</span>
            <span>日期： 全部日期</span>
            <span class="kass-date-caret" aria-hidden="true">⌄</span>
          </button>
          <button class="kass-new-record" type="button" data-toast="新增记录是原型入口，不创建真实记录。">
            <span aria-hidden="true">⊕</span>
            <span>新增记录</span>
          </button>
        </div>
      </header>
      <div class="kass-empty-record"></div>
    </article>
  `;
}

/**
 * 渲染没有客户时的右侧空白详情。
 *
 * @returns {string} 空态详情 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderKassDetailEmpty() {
  return `
    <article class="kass-info-card">
      <header class="kass-info-head">
        <div class="kass-info-head-text">
          <h3><span class="orange-bar"></span>客户档案</h3>
          <p>—</p>
          <div class="kass-tag-row">
            <span class="kass-tag-hash">#项目型采购</span>
            <span class="kass-tag-hash">#重视交付证明</span>
            <span class="kass-tag-hash">#价格敏感度 中等</span>
          </div>
          <dl class="kass-profile-grid">
            <div><dt>客户名称:</dt><dd>—</dd></div>
            <div><dt>国家 / 地区:</dt><dd>—</dd></div>
            <div><dt>行业类型:</dt><dd>—</dd></div>
            <div><dt>官网:</dt><dd>—</dd></div>
            <div><dt>联系人:</dt><dd>—</dd></div>
            <div><dt>客户等级:</dt><dd>B</dd></div>
          </dl>
        </div>
        <aside class="kass-rating-card">
          <div class="kass-rating-avatar empty" aria-hidden="true">A</div>
          <small>客户评级</small>
          <button class="kass-detail-btn" type="button" data-toast="详细档案是原型入口。">
            <span class="kass-detail-icon" aria-hidden="true">▣</span>
            <span>详细档案</span>
          </button>
        </aside>
      </header>
    </article>

    <article class="kass-flow-card">
      <header>
        <div>
          <h3><span class="orange-bar"></span>跟进流程图</h3>
          <p>展示从线索到签约的跟进阶段，高亮为当前节点</p>
        </div>
        <span class="kass-flow-current">当前：${escapeHtml(KASS_FLOW_STAGES[0])}</span>
      </header>
      <div class="kass-flow-steps">
        ${KASS_FLOW_STAGES.map((stage, index) => `
          <button class="kass-flow-step ${index === 0 ? "active" : ""}" type="button" data-toast="已定位到「${escapeHtml(stage)}」阶段。">${escapeHtml(stage)}</button>
          ${index < KASS_FLOW_STAGES.length - 1 ? `<span class="kass-flow-arrow" aria-hidden="true">›</span>` : ""}
        `).join("")}
      </div>
    </article>

    <article class="kass-record-card">
      <header>
        <div>
          <h3><span class="orange-bar"></span>客户跟进记录</h3>
          <p>集中记录询盘、沟通、报价、AI 分析和建议下一步动作</p>
        </div>
        <div class="kass-record-actions">
          <button class="kass-date-btn" type="button" data-toast="日期筛选是原型反馈。">
            <span class="kass-date-icon" aria-hidden="true">▣</span>
            <span>日期： 全部日期</span>
            <span class="kass-date-caret" aria-hidden="true">⌄</span>
          </button>
          <button class="kass-new-record" type="button" data-toast="新增记录是原型入口，不创建真实记录。">
            <span aria-hidden="true">⊕</span>
            <span>新增记录</span>
          </button>
        </div>
      </header>
      <div class="kass-empty-record"></div>
    </article>
  `;
}

/**
 * 渲染右下角 Kass AI 助手浮窗。
 *
 * @param {typeof KASS_GROUPS[number]["customers"][number]} customer - 当前客户。
 * @returns {string} 右下角浮窗 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderKassAssistant(customer) {
  if (!state.kassAssistantOpen) {
    return "";
  }

  const customerName = customer ? customer.name : "—";
  const customerLevel = customer ? customer.level : "A";
  const customerStage = customer ? customer.stage : "线索到达";
  const customerRecords = customer ? customer.records : 0;
  const hasCustomer = Boolean(customer);

  return `
    <aside class="kass-assistant-popover" aria-label="客户 AI 助手浮窗">
      <header class="kass-assistant-head">
        <div class="kass-assistant-head-text">
          <h3>客户 AI 助手</h3>
          <p>AI 会结合档案信息、知识库与历史摘要进行分析</p>
        </div>
        <div class="kass-assistant-mascot" aria-hidden="true">
          <svg viewBox="0 0 80 80" width="84" height="84" fill="none" stroke="none">
            <rect x="20" y="22" width="40" height="34" rx="10" fill="#ffffff" opacity="0.16"/>
            <rect x="22" y="24" width="36" height="30" rx="9" fill="#ffd9b5"/>
            <circle cx="32" cy="38" r="3.6" fill="#5a2d00"/>
            <circle cx="48" cy="38" r="3.6" fill="#5a2d00"/>
            <rect x="34" y="46" width="12" height="3.5" rx="1.5" fill="#5a2d00"/>
            <path d="M40 14v8" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round"/>
            <circle cx="40" cy="12" r="3" fill="#ffffff"/>
            <rect x="28" y="56" width="24" height="6" rx="3" fill="#ffffff" opacity="0.7"/>
          </svg>
        </div>
        <button class="kass-assistant-close" type="button" aria-label="关闭" data-kass-assistant="close">×</button>
      </header>
      <section class="kass-assistant-context">
        <div class="kass-assistant-current">当前客户：<strong>${escapeHtml(customerName)}</strong></div>
        <div class="kass-assistant-chips">
          <span>客户等级: ${escapeHtml(customerLevel)}</span>
          <span>阶段: ${escapeHtml(customerStage)}</span>
          <span>跟进条数: ${customerRecords} 条</span>
        </div>
      </section>
      <div class="kass-assistant-body">
        ${hasCustomer ? `
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <p>加载会话记录中...</p>
        ` : `<p class="kass-assistant-hint">请在左侧选择客户后再开始对话</p>`}
      </div>
      <footer class="kass-assistant-input">
        <textarea placeholder="${hasCustomer ? "继续对话：围绕样品周期和付款方式生成谈判策略" : "请在左侧选择客户后再输入问题"}" ${hasCustomer ? "" : "disabled"}></textarea>
        <button type="button" ${hasCustomer ? "" : "disabled"} data-toast="发送是原型反馈，不调用真实 AI。">发送</button>
      </footer>
    </aside>
  `;
}

/**
 * 根据客户Kass当前标签渲染右侧详情。
 *
 * @param {typeof CUSTOMERS[number]} customer - 当前客户。
 * @returns {string} 客户详情 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCustomerPanel(customer) {
  if (state.activeCustomerPanel === "inquiry") {
    return `
      <h3>最新询盘</h3>
      <p class="quote-text">${escapeHtml(customer.inquiry)}</p>
      ${renderListBlock("关键信息缺口", ["数量 / 目标规格", "认证版本", "目标交付地", "付款预期"])}
    `;
  }

  if (state.activeCustomerPanel === "follow") {
    return `
      <h3>下一步动作</h3>
      ${renderListBlock("建议跟进", customer.nextActions)}
      ${renderListBlock("风险提醒", customer.risk)}
    `;
  }

  if (state.activeCustomerPanel === "ai") {
    return `
      <h3>AI 分析记录</h3>
      <div class="ai-record-list">
        ${CUSTOMER_TIMELINE.map((item) => `
          <article>
            <strong>${escapeHtml(item.title)}</strong>
            <p>${escapeHtml(item.text)}</p>
          </article>
        `).join("")}
      </div>
    `;
  }

  return `
    <h3>客户基础信息</h3>
    <p>${escapeHtml(customer.profile)}</p>
    ${renderListBlock("风险点", customer.risk)}
  `;
}

/**
 * 渲染客户Kass AI生成态。
 *
 * @returns {string} 生成态或结果 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCustomerGeneration() {
  if (state.isCustomerGenerating) {
    return `
      <article class="generation-panel loading kass-loading">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <p>正在读取客户档案和历史沟通...</p>
      </article>
    `;
  }

  if (!state.customerResult) {
    return "";
  }

  return `
    <article class="generation-panel">
      <h3>客户Kass 建议</h3>
      <p>${escapeHtml(state.customerResult)}</p>
      <div class="result-actions">
        <button type="button" data-toast="已模拟沉淀到客户AI记录。">沉淀到AI记录</button>
        <button type="button" data-toast="已模拟生成下一封跟进邮件。">生成跟进邮件</button>
      </div>
    </article>
  `;
}

/**
 * 渲染通用问答 / 成交顾问 / Skill 的输入壳。
 *
 * @returns {string} 输入工作台 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderChatView() {
  const [title, desc, placeholder] = getChatLabels();
  const hasDraft = state.chatDraft.trim().length > 0;
  const needsScenePicker = state.activeMain === "negotiation-scene";
  const session = getDifyFeatureSession();
  const hasConversation = session.messages.length > 0;
  const isGenerating = session.isGenerating;
  const selectedModel = getDifyChatModel(state.selectedModel);

  if (hasConversation) {
    return renderChatConversationView(title, placeholder, hasDraft, needsScenePicker);
  }

  return `
    <section class="chat-view">
      <div class="chat-center">
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(desc)}</p>
        <div class="chat-box">
          <textarea placeholder="${escapeHtml(placeholder)}" data-chat-input="true">${escapeHtml(state.chatDraft)}</textarea>
          <div class="chat-tools">
            <button class="tool-round" type="button" data-popup="attachment" aria-label="附件">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M10.5 13.5a3 3 0 0 0 4.24 0l3.18-3.18a3 3 0 1 0-4.24-4.24l-1.06 1.06"/>
                <path d="M13.5 10.5a3 3 0 0 0-4.24 0L6.08 13.68a3 3 0 1 0 4.24 4.24l1.06-1.06"/>
              </svg>
            </button>
            <button class="model-pill ${state.popup === "model" ? "active" : ""}" type="button" data-popup="model">
              <span class="model-pill-label">${escapeHtml(selectedModel.label)}</span>
              <span class="model-pill-caret" aria-hidden="true">⌄</span>
            </button>
            <span class="chat-tools-spacer"></span>
            ${needsScenePicker ? `
              <button class="scene-picker" type="button" data-toast="谈判场景选择是原型反馈，不接真实场景库。">
                <span>请选择谈判场景</span>
                <span class="scene-picker-caret" aria-hidden="true">⌄</span>
              </button>
            ` : ""}
            <button class="voice-btn" type="button" aria-label="语音输入" data-toast="语音输入是原型入口，不录音。">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="9" y="3" width="6" height="11" rx="3"/>
                <path d="M5 11a7 7 0 0 0 14 0"/>
                <path d="M12 18v3"/>
              </svg>
            </button>
            <span class="chat-tools-divider" aria-hidden="true"></span>
            <button class="send-btn ${hasDraft ? "enabled" : ""}" type="button" data-send-chat="true" ${hasDraft && !isGenerating ? "" : "disabled"} aria-label="发送">
              ${isGenerating ? `<span>…</span>` : `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M3.4 11.2 20.2 4.1c.6-.3 1.2.3.9.9l-7.1 16.8c-.3.6-1.1.6-1.4 0l-3-6.1-6.1-3c-.6-.3-.6-1.1-.1-1.5z"/></svg>`}
            </button>
          </div>
        </div>
        ${renderGenerationPanel()}
      </div>
    </section>
  `;
}

/**
 * 渲染用户输入后的左右分栏对话态。
 *
 * 作用：
 * - 对齐线上截图里的“左边问题、右边回答”结构。
 * - 用户问题单独留在左侧，输入框清空后继续接受下一轮追问。
 * - 右侧回答用正文排版承载长内容，避免旧结果卡片把答案压得太窄。
 *
 * @param {string} title - 当前功能标题，例如“问一下”。
 * @param {string} placeholder - 当前输入框占位文案。
 * @param {boolean} hasDraft - 输入框里是否已有新内容，用于控制生成按钮状态。
 * @param {boolean} needsScenePicker - 场景谈判顾问是否需要展示场景选择入口。
 * @returns {string} 左右分栏对话态 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderChatConversationView(title, placeholder, hasDraft, needsScenePicker) {
  const session = getDifyFeatureSession();
  const isGenerating = session.isGenerating;
  const selectedModel = getDifyChatModel(state.selectedModel);

  return `
    <section class="chat-conversation-view workbench-enter ${state.activeMain === "yd-artifact" ? "yd-artifact-conversation" : ""}" aria-label="${escapeHtml(title)}对话">
      <aside class="chat-question-pane">
        ${renderCustomerResearchQuestionThread()}

        <div class="chat-compose-panel">
          <label class="chat-compose-box">
            <span class="sr-only">继续输入问题</span>
            <textarea placeholder="${escapeHtml(placeholder)}" data-chat-input="true">${escapeHtml(state.chatDraft)}</textarea>
            <button class="compose-attach" type="button" data-popup="attachment" aria-label="附件">⌘</button>
          </label>
          <div class="chat-compose-tools">
            <button class="model-pill compact ${state.popup === "model" ? "active" : ""}" type="button" data-popup="model">
              <span class="model-pill-label">${escapeHtml(selectedModel.label)}</span>
              <span class="model-pill-caret" aria-hidden="true">⌄</span>
            </button>
            <button class="new-chat-btn" type="button" data-new-chat="true">
              <span aria-hidden="true">＋</span>
              <span>开启新对话</span>
            </button>
            <span class="chat-tools-spacer"></span>
            ${needsScenePicker ? `
              <button class="scene-picker" type="button" data-toast="谈判场景选择是原型反馈，不接真实场景库。">
                <span>请选择谈判场景</span>
                <span class="scene-picker-caret" aria-hidden="true">⌄</span>
              </button>
            ` : ""}
          </div>
          <button class="generate-report-btn ${hasDraft ? "enabled" : ""}" type="button" data-send-chat="true" ${hasDraft && !isGenerating ? "" : "disabled"}>
            ${isGenerating ? "AI 正在生成..." : "立即由AI生成报告"}
          </button>
          <p class="chat-compose-note">本回答由AI生成，内容仅供参考，请仔细甄别</p>
        </div>
      </aside>

      <main class="chat-answer-pane">
        ${renderConversationAnswer()}
      </main>
    </section>
  `;
}

/**
 * 创建客户背调消息 ID。
 *
 * 为什么不用数组下标当 ID：
 * - 多轮对话后续可能会支持重试、删除或插入系统提示。
 * - 稳定 ID 可以降低 DOM key/定位混乱风险。
 *
 * @returns {string} 客户背调消息 ID。
 * @throws {Error} 本函数不主动抛异常。
 */
function createCustomerResearchMessageId() {
  return `research-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 获取当前 Dify 对话页里的用户消息。
 *
 * @returns {Array<{ id: string, role: "user" | "assistant", content: string, status?: "loading" | "error" | "done", usage?: object | null, billingTrace?: object | null, workflowRunId?: string }>} 用户消息列表。
 * @throws {Error} 本函数不主动抛异常。
 */
function getCustomerResearchUserMessages() {
  return getDifyFeatureSession().messages.filter((message) => message.role === "user");
}

/**
 * 获取当前 Dify 对话页里的助手消息。
 *
 * @returns {Array<{ id: string, role: "user" | "assistant", content: string, status?: "loading" | "error" | "done", usage?: object | null, billingTrace?: object | null, workflowRunId?: string }>} 助手消息列表。
 * @throws {Error} 本函数不主动抛异常。
 */
function getCustomerResearchAssistantMessages() {
  return getDifyFeatureSession().messages.filter((message) => message.role === "assistant");
}

/**
 * 渲染当前 Dify 对话页左侧多轮问题列表。
 *
 * 作用：
 * - 解决旧实现只显示最后一个问题、让用户误以为前文丢失的问题。
 * - 左侧继续保持“问题列表”的产品形态，不把回答和问题混在一起。
 *
 * @returns {string} 客户背调问题列表 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCustomerResearchQuestionThread() {
  const userMessages = getCustomerResearchUserMessages();

  return `
    <div class="chat-question-scroll customer-research-question-thread">
      ${userMessages.map((message, index) => `
        <section class="chat-question-turn">
          <div class="chat-thread-heading muted">
            <span>问题 ${index + 1}</span>
            <i aria-hidden="true"></i>
          </div>
          <div class="chat-user-row">
            <div class="chat-user-bubble">${renderMultilineText(message.content)}</div>
          </div>
        </section>
      `).join("")}
      <button class="chat-copy-question" type="button" data-toast="复制问题是原型反馈，当前不写入剪贴板。">
        <span aria-hidden="true">⧉</span>
        <span>复制</span>
      </button>
    </div>
  `;
}

/**
 * 把计费追踪里的数字格式化为易读文本。
 *
 * @param {unknown} value - 可能来自 Dify metadata 或 billing_trace 的数字。
 * @returns {string} 格式化后的数字；无法解析时返回 `-`。
 * @throws {Error} 本函数不主动抛异常。
 */
function formatTraceNumber(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "-";
  }

  return numberValue.toLocaleString();
}

/**
 * 把 Dify 返回的金额字段格式化为人民币文本。
 *
 * @param {unknown} value - 金额数值或字符串。
 * @param {unknown} currency - Dify 返回的币种，当前通常是 RMB。
 * @returns {string} 格式化后的金额。
 * @throws {Error} 本函数不主动抛异常。
 */
function formatTraceMoney(value, currency = "RMB") {
  const numberValue = Number(value);
  const prefix = String(currency || "RMB").toUpperCase() === "RMB" ? "¥" : `${currency} `;

  if (!Number.isFinite(numberValue)) {
    return "-";
  }

  return `${prefix}${numberValue.toFixed(6)}`;
}

/**
 * 渲染成本追踪面板中的单个指标。
 *
 * @param {string} label - 指标名称。
 * @param {string} value - 指标值。
 * @returns {string} 指标 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderTraceMetric(label, value) {
  return `
    <div class="research-cost-metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

/**
 * 渲染客户背调的内部成本追踪面板。
 *
 * 作用：
 * - 只在 URL 带 `?costDebug=1` 或 `?difyTrace=1` 时显示。
 * - 让内部人员能直接核对模型 token、Dify 金额、Tavily 调用次数和档位。
 * - 不把完整工具输出、网页正文或 Dify API Key 展示出来，避免把排障信息变成用户界面。
 *
 * @param {{ usage?: object | null, billingTrace?: object | null, workflowRunId?: string }} message - 当前助手消息。
 * @returns {string} 成本追踪面板 HTML；非调试模式或无数据时返回空字符串。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCustomerResearchBillingTracePanel(message) {
  if (!isCustomerResearchCostDebugMode()) {
    return "";
  }

  const usage = message?.usage || {};
  const trace = message?.billingTrace || {};
  const tavily = trace?.tavily || {};
  const tavilyCalls = Array.isArray(tavily.calls) ? tavily.calls : [];
  const toolConfig = tavily.tool_config || {};
  const workflowRunId = message?.workflowRunId || trace.workflow_run_id || "-";
  const eventCounts = trace.event_counts || {};
  const searchDepth = toolConfig.search_depth || [...new Set(tavilyCalls.map((call) => call.search_depth).filter(Boolean))].join(" / ") || "-";
  const tavilyCallCount = tavily.call_count ?? tavilyCalls.length;
  const tavilyCredits = tavily.estimated_credits ?? "-";
  const queryRows = tavilyCalls.slice(0, 8).map((call, index) => `
    <li>
      <span>${index + 1}</span>
      <p>${escapeHtml(call?.tool_input?.query || call?.query || call?.tool || "tavily_search")}</p>
      <b>${escapeHtml(call?.search_depth || searchDepth || "-")}</b>
    </li>
  `).join("");

  return `
    <section class="research-cost-panel" aria-label="内部成本追踪">
      <header>
        <strong>成本追踪</strong>
        <span>workflow ${escapeHtml(workflowRunId)}</span>
      </header>
      <div class="research-cost-grid">
        ${renderTraceMetric("输入 Token", formatTraceNumber(usage.prompt_tokens))}
        ${renderTraceMetric("输出 Token", formatTraceNumber(usage.completion_tokens))}
        ${renderTraceMetric("总 Token", formatTraceNumber(usage.total_tokens))}
        ${renderTraceMetric("模型费用", formatTraceMoney(usage.total_price, usage.currency))}
        ${renderTraceMetric("Tavily 次数", formatTraceNumber(tavilyCallCount))}
        ${renderTraceMetric("Tavily credits", formatTraceNumber(tavilyCredits))}
        ${renderTraceMetric("搜索档位", String(searchDepth || "-"))}
        ${renderTraceMetric("Agent 日志", formatTraceNumber(eventCounts.agent_log))}
      </div>
      ${queryRows ? `
        <ol class="research-cost-query-list">
          ${queryRows}
        </ol>
      ` : ""}
    </section>
  `;
}

/**
 * 渲染聊天生成结果区域。
 *
 * @returns {string} 生成态或结果 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderGenerationPanel() {
  if (state.isGenerating) {
    return `
      <article class="generation-panel loading" aria-live="polite">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <p>正在整理当前业务场景...</p>
      </article>
    `;
  }

  if (!state.generatedResult) {
    return "";
  }

  return `
    <article class="generation-panel">
      <h3>生成结果</h3>
      <p>${escapeHtml(state.generatedResult)}</p>
      <div class="result-actions">
        <button type="button" data-toast="复制结果是原型反馈，当前不写入剪贴板。">复制</button>
        <button type="button" data-toast="已模拟保存到当前会话。">保存到历史</button>
      </div>
    </article>
  `;
}

/**
 * 渲染对话态右侧回答区。
 *
 * 作用：
 * - 生成中显示三点动效，让用户知道发送动作已经触发。
 * - 生成完成后展示接近截图的长回答结构，便于对齐真实产品样式。
 *
 * @returns {string} 回答区 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderConversationAnswer() {
  return renderCustomerResearchConversationAnswer();
}

/**
 * 组合折叠过程栏里的步骤数量和最终思考耗时。
 *
 * @param {object} message - 当前助手消息，包含思考开始和结束时间。
 * @param {number} stepCount - 本轮保留下来的公开过程步骤数。
 * @param {boolean} interrupted - 本轮是否因错误而中断。
 * @returns {string} 例如“8 个步骤 · 思考了 2 分 9 秒”。
 * @throws {Error} 本函数不主动抛异常；计时字段缺失时只返回原步骤摘要。
 */
function getDifyProcessSummary(message, stepCount, interrupted) {
  const stepSummary = interrupted ? "执行中断" : `${stepCount} 个步骤`;
  const thinkingDuration = window.YD_DIFY?.formatDifyThinkingDuration(
    message?.thinkingStartedAt,
    message?.thinkingEndedAt
  ) || "";

  return thinkingDuration ? `${stepSummary} · ${thinkingDuration}` : stepSummary;
}

/**
 * 获取某条消息此刻应该显示的思考耗时。
 *
 * @param {object} message - 当前助手消息。
 * @param {number} [currentTime=Date.now()] - 当前 Unix 毫秒时间戳；测试或定时刷新可显式传入。
 * @returns {string} 动态或已冻结的思考耗时文案。
 * @throws {Error} 本函数不主动抛异常。
 */
function getDifyThinkingDurationText(message, currentTime = Date.now()) {
  return window.YD_DIFY?.formatDifyThinkingDuration(
    message?.thinkingStartedAt,
    message?.thinkingEndedAt,
    currentTime
  ) || "";
}

/**
 * 渲染 Dify 的安全执行过程。
 *
 * 生成期间只画 `currentProcess`，新事件到达后自然覆盖上一条；正式答案开始后默认折叠，用户点击后才查看完整步骤。
 * 这里展示节点、工具、搜索词，以及 Dify API 明确公开的 `agent_thought.thought`；模型隐藏的 `<think>` 内容仍不展示。
 * 完成后在步骤数量旁显示从发送到第一段正式答案之间的思考耗时。
 *
 * @param {object} message - 当前助手消息，包含 currentProcess、processSteps、展开状态和思考计时。
 * @returns {string} 过程区 HTML；没有过程事件时返回空字符串。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderDifyProcessPanel(message) {
  const steps = Array.isArray(message?.processSteps) ? message.processSteps : [];
  const currentStep = message?.currentProcess || steps[steps.length - 1] || null;
  const isLive = message?.status === "loading" && !message?.answerStarted;

  if (!isLive && (!currentStep || steps.length === 0)) {
    return "";
  }

  if (isLive) {
    const thinkingDuration = getDifyThinkingDurationText(message);

    return `
      <section class="dify-process-panel live" aria-live="polite" aria-label="AI 当前执行过程">
        <span class="dify-process-pulse" aria-hidden="true"></span>
        <div class="dify-process-current">
          <div class="dify-process-live-summary">
            <strong>分析过程</strong>
            <small data-dify-thinking-duration="true">${escapeHtml(thinkingDuration)}</small>
          </div>
          <p>${escapeHtml(currentStep?.label || "正在分析问题")}</p>
          <small data-dify-process-detail="true" ${currentStep?.detail ? "" : "hidden"}>${escapeHtml(currentStep?.detail || "")}</small>
        </div>
      </section>
    `;
  }

  const expanded = Boolean(message.processExpanded);
  const interrupted = message.status === "error" || currentStep.status === "error";
  const summary = getDifyProcessSummary(message, steps.length, interrupted);

  return `
    <section class="dify-process-panel settled ${expanded ? "expanded" : ""}">
      <button type="button" class="dify-process-toggle" data-dify-process-toggle="${escapeHtml(message.id || "")}" aria-expanded="${expanded ? "true" : "false"}">
        <span class="dify-process-mark ${interrupted ? "error" : ""}" aria-hidden="true"></span>
        <span>分析过程</span>
        <small data-dify-process-count="true">${escapeHtml(summary)}</small>
        <span class="dify-process-chevron" aria-hidden="true">⌄</span>
      </button>
      ${expanded ? `
        <ol class="dify-process-history">
          ${steps.map((step) => `
            <li class="${step.status === "error" ? "error" : ""}">
              <span aria-hidden="true"></span>
              <div>
                <p>${escapeHtml(step.label || "分析步骤")}</p>
                ${step.detail ? `<small>${escapeHtml(step.detail)}</small>` : ""}
              </div>
            </li>
          `).join("")}
        </ol>
      ` : ""}
    </section>
  `;
}

/**
 * 停止当前思考耗时刷新器。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function stopDifyThinkingDurationTicker() {
  if (difyThinkingDurationTimer !== null) {
    window.clearInterval(difyThinkingDurationTimer);
    difyThinkingDurationTimer = null;
  }
}

/**
 * 只刷新当前回答里的“思考了 X 秒”文字节点。
 *
 * @param {string} featureId - 本轮请求所属的对话页面 ID。
 * @param {string} messageId - 当前助手消息 ID。
 * @returns {boolean} 找到并刷新计时文字时返回 true。
 * @throws {Error} 本函数不主动抛异常。
 */
function refreshDifyThinkingDurationDom(featureId, messageId) {
  if (state.activeMain !== featureId || !messageId) {
    return false;
  }

  const message = getDifyFeatureSession(featureId).messages.find((item) => item.id === messageId);
  const turn = Array.from(document.querySelectorAll("[data-dify-message-id]")).find((node) => (
    node.getAttribute("data-dify-message-id") === messageId
  ));
  const durationNode = turn?.querySelector("[data-dify-thinking-duration]");

  if (!message || !durationNode) {
    return false;
  }

  const nextText = getDifyThinkingDurationText(message);
  if (durationNode.textContent !== nextText) {
    durationNode.textContent = nextText;
  }
  return true;
}

/**
 * 启动当前 Dify 回答的动态思考计时。
 *
 * 每秒只调用局部文字刷新函数。正式答案、失败或完成后由请求 `finally` 统一停止，
 * 因此计时不会在后台持续运行，也不会影响其它对话页面。
 *
 * @param {string} featureId - 本轮请求所属的对话页面 ID。
 * @param {string} messageId - 当前助手消息 ID。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function startDifyThinkingDurationTicker(featureId, messageId) {
  stopDifyThinkingDurationTicker();
  refreshDifyThinkingDurationDom(featureId, messageId);
  difyThinkingDurationTimer = window.setInterval(() => {
    refreshDifyThinkingDurationDom(featureId, messageId);
  }, 1000);
}

/**
 * 判断一条 Dify 助手消息当前需要哪种 DOM 结构。
 *
 * @param {object} message - 当前助手消息。
 * @returns {"loading" | "process" | "answer" | "done" | "error"} 用于局部 DOM 补丁的结构阶段。
 * @throws {Error} 本函数不主动抛异常。
 */
function getDifyAnswerRenderPhase(message) {
  if (message?.status === "error") return "error";
  if (message?.status === "done") return "done";
  if (message?.answerStarted) return "answer";
  if (message?.currentProcess || (Array.isArray(message?.processSteps) && message.processSteps.length > 0)) return "process";
  return "loading";
}

/**
 * 渲染单轮 Dify 助手回答。
 *
 * 单独抽出这一层，是为了让 SSE 更新只替换当前回答，而不是重建整个 #app。
 * 同一阶段内会进一步只修改文字节点；只有 loading/process/answer/done 结构切换时才替换本轮 section。
 *
 * @param {object} message - 当前助手消息。
 * @param {number} index - 助手回答在当前会话中的序号。
 * @param {string} title - 当前功能名称，用于生成中占位文案。
 * @returns {string} 单轮回答 section HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderDifyAnswerTurn(message, index, title) {
  const isLoading = message.status === "loading";
  const isError = message.status === "error";
  const processPanel = renderDifyProcessPanel(message);
  const hasStreamingAnswer = isLoading && message.answerStarted;
  const renderPhase = getDifyAnswerRenderPhase(message);

  return `
    <section class="customer-research-answer-turn ${isError ? "error" : ""}" data-dify-message-id="${escapeHtml(message.id || "")}" data-dify-render-phase="${renderPhase}">
      <div class="chat-thread-heading accent">
        <span>回答 ${index + 1}</span>
        <i aria-hidden="true"></i>
      </div>
      ${processPanel}
      ${isLoading && !hasStreamingAnswer ? (processPanel ? "" : `
        <div class="conversation-loading-row">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <p>${escapeHtml(message.content || `正在生成${title}结果...`)}</p>
        </div>
      `) : `
        <div class="conversation-answer-body customer-research-answer ${isError ? "error" : ""}">
          ${isError ? `
            <h2>生成失败</h2>
            <p>${escapeHtml(message.content)}</p>
            <div class="result-actions">
              <button type="button" data-toast="请检查顶部应用配置、当前网络或 Dify 执行耗时后重新发送。">查看处理建议</button>
            </div>
          ` : `
            <div class="research-live-answer ${hasStreamingAnswer ? "streaming" : ""}">
              ${renderDifyAnswerContent(message)}
            </div>
            ${hasStreamingAnswer ? "" : `
              <div class="result-actions">
                ${state.activeMain === "customer-research" ? `
                  <button type="button" data-toast="已模拟保存到客户Kass背调记录。">保存到客户Kass</button>
                  <button type="button" data-toast="已模拟生成首次开发邮件。">生成开发邮件</button>
                ` : `<button type="button" data-toast="已模拟保存到当前会话历史。">保存到历史</button>`}
                <button type="button" data-toast="复制结果是原型反馈，当前不写入剪贴板。">复制结果</button>
              </div>
              ${state.activeMain === "customer-research" ? renderCustomerResearchBillingTracePanel(message) : ""}
            `}
          `}
        </div>
      `}
    </section>
  `;
}

/**
 * 为局部插入的回答节点补上过程折叠和结果按钮事件。
 *
 * @param {Element} turn - 刚插入 DOM 的单轮回答节点。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function bindDifyInsertedTurnEvents(turn) {
  turn.querySelectorAll("[data-dify-process-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const messageId = button.getAttribute("data-dify-process-toggle") || "";
      const session = getDifyFeatureSession();
      session.messages = session.messages.map((message) => (
        message.id === messageId
          ? { ...message, processExpanded: !message.processExpanded }
          : message
      ));
      patchDifyStreamMessageDom(state.activeMain, messageId, true);
    });
  });

  turn.querySelectorAll("[data-toast]").forEach((node) => {
    node.addEventListener("click", () => {
      state.popup = null;
      renderApp();
      showToast(node.getAttribute("data-toast") || "操作已触发。");
    });
  });
}

/**
 * 在现有页面上局部更新一条 Dify 助手消息。
 *
 * 更新策略：
 * 1. 同处“过程”阶段时只改标题和详情的 textContent，呼吸点不会重启。
 * 2. 同处“答案流”阶段时只更新答案容器，侧栏、输入框和过程按钮保持不动。
 * 3. 只有结构阶段变化或用户展开历史时才替换当前回答 section。
 *
 * @param {string} featureId - 消息所属的页面 ID。
 * @param {string} messageId - 助手消息稳定 ID。
 * @param {boolean} [forceStructure=false] - 是否强制重画本轮，用于展开/折叠历史。
 * @returns {boolean} 找到并更新目标节点时返回 true。
 * @throws {Error} 本函数不主动抛异常。
 */
function patchDifyStreamMessageDom(featureId, messageId, forceStructure = false) {
  if (state.activeMain !== featureId || !messageId) {
    return false;
  }

  const assistantMessages = getCustomerResearchAssistantMessages();
  const messageIndex = assistantMessages.findIndex((message) => message.id === messageId);
  const message = assistantMessages[messageIndex];
  const turn = Array.from(document.querySelectorAll("[data-dify-message-id]")).find((node) => (
    node.getAttribute("data-dify-message-id") === messageId
  ));

  if (!message || !turn) {
    return false;
  }

  const nextPhase = getDifyAnswerRenderPhase(message);
  if (forceStructure || turn.getAttribute("data-dify-render-phase") !== nextPhase) {
    const template = document.createElement("template");
    template.innerHTML = renderDifyAnswerTurn(message, messageIndex, getChatLabels()[0]).trim();
    const nextTurn = template.content.firstElementChild;

    if (!nextTurn) {
      return false;
    }

    turn.replaceWith(nextTurn);
    bindDifyInsertedTurnEvents(nextTurn);
    return true;
  }

  if (nextPhase === "process") {
    const currentStep = message.currentProcess || message.processSteps?.[message.processSteps.length - 1] || {};
    const label = turn.querySelector(".dify-process-current p");
    const detail = turn.querySelector("[data-dify-process-detail]");

    if (label) label.textContent = currentStep.label || "正在分析问题";
    if (detail) {
      detail.textContent = currentStep.detail || "";
      detail.hidden = !currentStep.detail;
    }
    refreshDifyThinkingDurationDom(featureId, messageId);
    return true;
  }

  if (nextPhase === "answer") {
    const answer = turn.querySelector(".research-live-answer");
    const count = turn.querySelector("[data-dify-process-count]");
    if (answer) answer.innerHTML = renderDifyAnswerContent(message);
    if (count) {
      const steps = Array.isArray(message.processSteps) ? message.processSteps : [];
      count.textContent = getDifyProcessSummary(message, steps.length, false);
    }
    return true;
  }

  if (nextPhase === "loading") {
    const loadingText = turn.querySelector(".conversation-loading-row p");
    if (loadingText) loadingText.textContent = message.content || `正在生成${getChatLabels()[0]}结果...`;
    refreshDifyThinkingDurationDom(featureId, messageId);
    return true;
  }

  return true;
}

/**
 * 渲染所有 Dify 对话功能页的右侧多轮回答。
 *
 * 作用：
 * - 页面结构复用普通 AI 对话 UI，保证和其它成交顾问入口一致。
 * - 内容层统一适配 Dify：生成中、失败和实时 answer 都按轮次展示。
 * - 正式答案先过滤隐藏 think 标签，再用安全 Markdown 渲染；Dify 明确公开的 Agent 思考放在独立过程区。
 *
 * @returns {string} 客户背调回答区 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCustomerResearchConversationAnswer() {
  const assistantMessages = getCustomerResearchAssistantMessages();
  const [title] = getChatLabels();

  if (assistantMessages.length > 0) {
    return `
      <article class="conversation-answer customer-research-answer-list" aria-live="polite">
        ${assistantMessages.map((message, index) => renderDifyAnswerTurn(message, index, title)).join("")}
      </article>
    `;
  }

  return "";
}

/**
 * 把客户背调本地样例整理成通用对话回答内容。
 *
 * 作用：
 * - 当没有真实 Dify answer 时，页面仍有稳定的样例结果可评审。
 * - 这里不再用旧的大报告卡片，避免和通用对话界面割裂。
 *
 * @returns {string} 样例回答 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCustomerResearchSampleAnswer() {
  const report = CUSTOMER_RESEARCH_FLOW.report;

  return `
    <h2>${escapeHtml(report.company)} 客户背调报告</h2>
    <p>${escapeHtml(report.country)} · ${escapeHtml(report.industry)} · 匹配度 ${escapeHtml(report.fitScore)}</p>
    <p>${escapeHtml(report.summary)}</p>
    ${(report.sections || []).map((section) => `
      <p><strong>${escapeHtml(section.title)}：</strong>${(section.items || []).map((item) => escapeHtml(item)).join(" ")}</p>
    `).join("")}
    <p><strong>风险点：</strong>${(report.risks || []).map((risk) => `${escapeHtml(risk.level)}：${escapeHtml(risk.text)}`).join(" ")}</p>
    <ol>
      ${(report.nextActions || []).map((action) => `<li>${escapeHtml(action)}</li>`).join("")}
    </ol>
    <button class="answer-copy-icon" type="button" data-toast="复制回答是原型反馈，当前不写入剪贴板。" aria-label="复制回答">⧉</button>
  `;
}

/**
 * 渲染右侧抽屉。
 *
 * @returns {string} 抽屉 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderDrawer() {
  const isOpen = Boolean(state.drawer);
  const title = state.drawer === "history" ? "历史" : "教学视频";
  const cards = state.drawer === "history"
    ? HISTORY_ITEMS.map((item) => ({ title: item, text: "这是一条假历史记录，用于复刻线上历史抽屉结构。" }))
    : [
        { title: "当前场景教学", text: "线上这里用于展示当前场景教学资源；当前静态原型只复刻入口和抽屉动效。" },
        { title: "无教学视频资源", text: "观察到的短反馈会以 toast 形式出现，避免页面堆说明文字。" }
      ];

  return `
    <div class="drawer-backdrop ${isOpen ? "open" : ""}" data-close-drawer="${isOpen ? "true" : "false"}">
      <aside class="drawer" aria-hidden="${isOpen ? "false" : "true"}">
        <header class="drawer-head">
          <h2>${escapeHtml(title)}</h2>
          <button class="drawer-close" type="button" data-close-drawer="true">×</button>
        </header>
        <div class="drawer-list">
          ${cards.map((card) => `
            <article class="drawer-card">
              <h3>${escapeHtml(card.title)}</h3>
              <p>${escapeHtml(card.text)}</p>
            </article>
          `).join("")}
        </div>
      </aside>
    </div>
  `;
}

/**
 * 渲染全局轻量弹层。
 *
 * 作用：
 * - 复刻线上 Ant Design 下拉 / popover 的交互手感。
 * - 这些弹层都不触发真实副作用，只展示可操作状态和短反馈。
 *
 * @returns {string} 弹层 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderPopupLayer() {
  if (!state.popup) {
    return "";
  }

  const popupContent = {
    attachment: renderAttachmentPopup,
    model: renderModelPopup,
    topHistory: renderTopHistoryPopup,
    customerSettings: renderCustomerSettingsPopup,
    accountSettings: renderAccountSettingsPopup,
    inviteRedeem: renderInviteRedeemModal,
    upgrade: renderUpgradeModal
  }[state.popup];

  if (!popupContent) {
    return "";
  }

  return `
    <div class="popup-layer" data-close-popup="true">
      ${popupContent()}
    </div>
  `;
}

/**
 * 渲染附件弹层。
 *
 * @returns {string} 附件弹层 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAttachmentPopup() {
  return `
    <section class="floating-popover attachment-popover" data-popup-surface="true">
      <button type="button" data-toast="本地文件上传是原型入口，不读取你的文件。">上传文件</button>
      <button type="button" data-toast="图片上传是原型入口，不读取你的图片。">上传图片</button>
      <button type="button" data-toast="粘贴链接会在正式版里进入解析流程。">粘贴链接</button>
    </section>
  `;
}

/**
 * 渲染模型下拉。
 *
 * @returns {string} 模型下拉 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderModelPopup() {
  return `
    <section class="floating-popover model-popover" data-popup-surface="true">
      ${DIFY_CHAT_MODELS.map((model) => `
        <button class="model-option ${state.selectedModel === model.value ? "active" : ""}" type="button" data-model="${escapeHtml(model.value)}">
          <span class="model-option-badge">${escapeHtml(model.badge)}</span>
          <strong>${escapeHtml(model.label)}</strong>
          <small>${escapeHtml(model.value)}</small>
        </button>
      `).join("")}
    </section>
  `;
}

/**
 * 渲染顶部历史下拉。
 *
 * @returns {string} 历史下拉 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderTopHistoryPopup() {
  return `
    <section class="floating-popover top-history-popover" data-popup-surface="true">
      <div class="top-history-empty" aria-label="暂无历史对话">
        <svg viewBox="0 0 80 80" width="64" height="64" fill="none" stroke="#d4cbc4" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="14" y="20" width="52" height="40" rx="4"/>
          <path d="M14 30h52"/>
          <circle cx="20" cy="25" r="1.5" fill="#d4cbc4"/>
          <circle cx="25" cy="25" r="1.5" fill="#d4cbc4"/>
          <circle cx="30" cy="25" r="1.5" fill="#d4cbc4"/>
          <path d="M24 42h32M24 50h22"/>
        </svg>
        <p>暂无历史对话</p>
      </div>
    </section>
  `;
}

/**
 * 渲染客户Kass设置弹层。
 *
 * @returns {string} 客户设置 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCustomerSettingsPopup() {
  return `
    <section class="floating-popover settings-popover" data-popup-surface="true">
      <h3>客户Kass</h3>
      <button type="button" data-toast="新建客户是原型入口，不创建真实客户。">新建客户</button>
      <button type="button" data-toast="管理客户分组是原型入口。">管理分组</button>
      <button type="button" data-toast="客户导入是原型入口，不上传文件。">导入客户</button>
    </section>
  `;
}

/**
 * 渲染账号设置弹层。
 *
 * @returns {string} 账号设置 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAccountSettingsPopup() {
  const switcherOpen = state.accountSpaceSwitcherOpen;

  return `
    <section class="floating-popover account-popover ${switcherOpen ? "switcher-open" : ""}" data-popup-surface="true">
      <button
        class="account-pop-head ${switcherOpen ? "open" : ""}"
        type="button"
        data-account-space-toggle="true"
        aria-expanded="${switcherOpen ? "true" : "false"}"
      >
        <span class="avatar" aria-hidden="true"></span>
        <span class="account-pop-id">
          <strong>Tina · 外贸业务<i class="account-pop-id-badge" aria-hidden="true">VIP</i></strong>
          <span>个人账号 · 180****9154</span>
        </span>
        <span class="account-pop-head-switch" aria-hidden="true">
          <i>⇄</i>切换
        </span>
      </button>

      <aside class="account-pop-space-flyout" data-popup-surface="true" aria-label="切换空间" aria-hidden="${switcherOpen ? "false" : "true"}">
        <header class="account-pop-space-head">
          <span>切换空间</span>
          <button type="button" class="account-pop-space-close" data-account-space-toggle="true" aria-label="关闭">×</button>
        </header>
        <ul class="account-pop-space-list">
          <li>
            <button type="button" class="active" data-toast="当前已在 Tina · 外贸业务 个人空间。">
              <span class="avatar small" aria-hidden="true"></span>
              <span class="account-pop-space-text">
                <strong>Tina · 外贸业务</strong>
                <em>个人账号 · 180****9154</em>
              </span>
              <span class="account-pop-space-check" aria-hidden="true">✓</span>
            </button>
          </li>
          <li>
            <button type="button" data-toast="已切换到 鸡公网络 团队空间（原型反馈）。">
              <span class="account-pop-space-team" aria-hidden="true">鸡</span>
              <span class="account-pop-space-text">
                <strong>鸡公网络</strong>
                <em>团队空间 · 8 人协作</em>
              </span>
              <span class="account-pop-space-action" aria-hidden="true">切换 ›</span>
            </button>
          </li>
        </ul>
      </aside>

      <section class="account-pop-banner" aria-label="当前套餐">
        <div class="account-pop-banner-text">
          <div class="account-pop-banner-row">
            <span class="account-pop-banner-tier">免费版</span>
            <strong>升级解锁更多积分</strong>
          </div>
          <p>200+ 成交顾问能力 · 月底自动重置</p>
        </div>
        <button class="account-pop-banner-cta" type="button" data-popup="upgrade">立即升级</button>
      </section>

      <section class="account-pop-quota" aria-label="本月积分">
        <header>
          <span class="account-pop-quota-icon" aria-hidden="true">◆</span>
          <span class="account-pop-quota-title">本月积分</span>
          <a class="account-pop-quota-link" href="#/account/usage" data-account-go="true">
            使用明细 <span aria-hidden="true">›</span>
          </a>
        </header>
        <div class="account-pop-quota-row">
          <span class="account-pop-quota-value"><strong>75</strong><em>/ 520</em></span>
          <span class="account-pop-quota-percent">已用 <i>86%</i> · 1.2k Token</span>
        </div>
        <div class="account-pop-stat-bar"><span style="width: 86%"></span></div>
      </section>

      <nav class="account-pop-grid" aria-label="账号快捷动作">
        <button type="button" data-popup="inviteRedeem">
          <span class="account-pop-grid-icon" aria-hidden="true">◇</span>
          <em>邀请兑换</em>
        </button>
        <button type="button" data-toast="订单记录是原型反馈。">
          <span class="account-pop-grid-icon" aria-hidden="true">▦</span>
          <em>订单记录</em>
        </button>
        <button type="button" data-toast="帮助中心是原型反馈。">
          <span class="account-pop-grid-icon" aria-hidden="true">?</span>
          <em>帮助中心</em>
        </button>
        <button type="button" data-toast="账号设置是原型入口，不修改真实账号。">
          <span class="account-pop-grid-icon" aria-hidden="true">⚙</span>
          <em>设置</em>
        </button>
        <button type="button" data-toast="关于页是原型反馈。">
          <span class="account-pop-grid-icon" aria-hidden="true">ⓘ</span>
          <em>关于</em>
        </button>
      </nav>

      <button class="account-pop-logout" type="button" data-toast="退出登录是高风险动作，当前原型不执行。">
        <span aria-hidden="true">↪</span> 退出登录
      </button>
    </section>
  `;
}

/**
 * 渲染邀请码兑换弹窗。
 *
 * 这是前台用户侧的原型入口：
 * - 用户输入销售给的邀请码。
 * - 点击兑换后只更新当前页面的模拟成功状态，不调用真实接口，也不写入本地存储。
 *
 * @returns {string} 邀请码兑换弹窗 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderInviteRedeemModal() {
  const draft = state.inviteCodeDraft || "";
  const result = state.inviteRedeemResult || "";
  const canRedeem = draft.trim().length >= 4;

  return `
    <section class="invite-redeem-modal" data-popup-surface="true" role="dialog" aria-label="邀请码兑换积分">
      <header class="invite-redeem-head">
        <div>
          <span class="invite-redeem-kicker">试用福利</span>
          <h3>邀请码兑换积分</h3>
          <p>输入销售同事给你的邀请码，兑换后积分会进入当前个人空间。</p>
        </div>
        <button class="invite-redeem-close" type="button" data-close-modal="true" aria-label="关闭">×</button>
      </header>

      <div class="invite-redeem-body">
        <label class="invite-code-field">
          <span>邀请码</span>
          <input
            type="text"
            value="${escapeHtml(draft)}"
            placeholder="例如：YD-TRY-8K2P"
            data-invite-code-input="true"
          />
        </label>
        <button class="invite-redeem-submit ${canRedeem ? "enabled" : ""}" type="button" data-invite-redeem-submit="true" ${canRedeem ? "" : "disabled"}>
          兑换积分
        </button>
      </div>

      ${result ? `
        <article class="invite-redeem-result" aria-live="polite">
          <strong>${escapeHtml(result)}</strong>
          <span>本次为原型演示，正式版会校验有效期、兑换次数和绑定用户。</span>
        </article>
      ` : `
        <div class="invite-redeem-hints">
          <span>适合销售发放新用户试用、展会现场体验和老客户激活福利。</span>
          <span>每个邀请码通常只能兑换一次。</span>
        </div>
      `}
    </section>
  `;
}

/**
 * 升级套餐 modal —— 弹出居中卡，里面 3 个套餐列。
 *
 * @returns {string} modal HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderUpgradeModal() {
  return `
    <section class="upgrade-modal" data-popup-surface="true" role="dialog" aria-label="升级套餐">
      <header class="upgrade-modal-head">
        <div>
          <h3>选择适合你的方案</h3>
          <p>当前 <strong>445 / 520</strong> 积分已用 86%，升级解锁更多额度和高级能力</p>
        </div>
        <button class="upgrade-modal-close" type="button" data-close-modal="true" aria-label="关闭">×</button>
      </header>

      <div class="upgrade-plans">
        ${UPGRADE_PLANS.map(renderUpgradePlan).join("")}
      </div>

      <footer class="upgrade-modal-foot">
        <span aria-hidden="true">💡</span>
        <span>年付立省两个月；团队版 5 席起，加席可联系销售。所有套餐都包含 7 天无理由退款。</span>
      </footer>
    </section>
  `;
}

/**
 * 渲染单个升级套餐卡。
 *
 * @param {typeof UPGRADE_PLANS[number]} plan - 套餐数据。
 * @returns {string} 套餐卡 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderUpgradePlan(plan) {
  const stateClass = [
    plan.highlighted ? "highlighted" : "",
    plan.current ? "current" : ""
  ].filter(Boolean).join(" ");

  return `
    <article class="upgrade-plan ${stateClass}">
      ${plan.badge ? `<span class="upgrade-plan-badge">${escapeHtml(plan.badge)}</span>` : ""}
      <header class="upgrade-plan-head">
        <h4>${escapeHtml(plan.name)}</h4>
        <p class="upgrade-plan-tagline">${escapeHtml(plan.tagline)}</p>
      </header>
      <div class="upgrade-plan-price">
        <span class="upgrade-plan-price-num">${escapeHtml(plan.price)}</span>
        <span class="upgrade-plan-price-unit">${escapeHtml(plan.unit)}</span>
      </div>
      <ul class="upgrade-plan-features">
        ${plan.features.map((f) => `
          <li><span class="upgrade-plan-check" aria-hidden="true">✓</span>${escapeHtml(f)}</li>
        `).join("")}
      </ul>
      ${plan.current
        ? `<button class="upgrade-plan-cta" type="button" disabled>${escapeHtml(plan.cta)}</button>`
        : `<a class="upgrade-plan-cta" href="#/upgrade/pay/${escapeHtml(plan.id)}" data-upgrade-go="true">${escapeHtml(plan.cta)}</a>`
      }
    </article>
  `;
}

/**
 * 绑定页面事件。
 *
 * 为什么每次 render 后重新绑定：
 * - renderApp 会替换 #app 内部 HTML。
 * - 旧 DOM 的事件会随节点一起消失，所以需要在新 DOM 上重新绑定。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
/**
 * 处理客户开发页面里的点击交互。
 *
 * 为什么用事件委托：
 * - 客户开发页面会频繁在“目标输入 / 客户列表 / 联系人页”之间重绘。
 * - 直接给每个按钮单独绑定，重绘后容易漏绑；挂在 #app 上更稳。
 *
 * @param {MouseEvent} event - 浏览器点击事件。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function handleCustomerDevClick(event) {
  const target = event.target instanceof Element ? event.target : null;

  if (!target) {
    return;
  }

  const pickerTrigger = target.closest("[data-customer-dev-picker]");
  if (pickerTrigger) {
    const picker = pickerTrigger.getAttribute("data-customer-dev-picker");

    if (picker === "market" || picker === "product") {
      state.customerDevPicker = picker;

      if (picker === "market") {
        const selectedGroup = (CUSTOMER_DEVELOPMENT.countryGroups || []).find((group) => group.countries.includes(state.customerDevBrief.market));
        state.customerDevContinent = selectedGroup?.id || state.customerDevContinent;
      } else {
        const selectedGroup = (CUSTOMER_DEVELOPMENT.productGroups || []).find((group) => group.products.includes(state.customerDevBrief.product));
        state.customerDevProductCategory = selectedGroup?.id || state.customerDevProductCategory;
      }

      renderApp();
      window.requestAnimationFrame(() => document.querySelector(".customer-dev-picker-dialog")?.focus());
    }
    return;
  }

  const closePickerButton = target.closest("[data-customer-dev-picker-close]");
  if (closePickerButton) {
    state.customerDevPicker = null;
    renderApp();
    return;
  }

  const continentButton = target.closest("[data-customer-dev-continent]");
  if (continentButton) {
    state.customerDevContinent = continentButton.getAttribute("data-customer-dev-continent") || state.customerDevContinent;
    refreshCustomerDevPickerGroup();
    return;
  }

  const productCategoryButton = target.closest("[data-customer-dev-product-category]");
  if (productCategoryButton) {
    state.customerDevProductCategory = productCategoryButton.getAttribute("data-customer-dev-product-category") || state.customerDevProductCategory;
    refreshCustomerDevPickerGroup();
    return;
  }

  const countryButton = target.closest("[data-customer-dev-country]");
  if (countryButton) {
    state.customerDevBrief.market = countryButton.getAttribute("data-customer-dev-country") || state.customerDevBrief.market;
    state.customerDevPicker = null;
    renderApp();
    return;
  }

  const productButton = target.closest("[data-customer-dev-product]");
  if (productButton) {
    state.customerDevBrief.product = productButton.getAttribute("data-customer-dev-product") || state.customerDevBrief.product;
    state.customerDevPicker = null;
    renderApp();
    return;
  }

  const presetButton = target.closest("[data-customer-dev-preset]");
  if (presetButton) {
    const preset = presetButton.getAttribute("data-customer-dev-preset") || "";
    const presetMap = {
      "德国光伏储能": ["德国", "光伏组件", "EPC 承包商", "100"],
      "阿联酋逆变器分销": ["阿联酋", "光伏逆变器", "分销商", "80"],
      "沙特工商业储能": ["沙特阿拉伯", "工商业储能", "系统集成商", "120"]
    };
    const [market, product, role, quantity] = presetMap[preset] || presetMap["德国光伏储能"];
    const selectedCountryGroup = (CUSTOMER_DEVELOPMENT.countryGroups || []).find((group) => group.countries.includes(market));
    const selectedProductGroup = (CUSTOMER_DEVELOPMENT.productGroups || []).find((group) => group.products.includes(product));
    state.customerDevBrief = { market, product, role, quantity };
    state.customerDevContinent = selectedCountryGroup?.id || state.customerDevContinent;
    state.customerDevProductCategory = selectedProductGroup?.id || state.customerDevProductCategory;
    renderApp();
    return;
  }

  const clearHistoryButton = target.closest("[data-customer-dev-clear-history]");
  if (clearHistoryButton) {
    const history = clearHistoryButton.closest(".customer-dev-recent-searches");
    history?.classList.add("is-cleared");
    showToast("最近搜索记录已清空");
    return;
  }

  const revealButton = target.closest("[data-customer-dev-reveal-email]");
  if (revealButton) {
    const index = revealButton.getAttribute("data-customer-dev-reveal-email") || "0";
    state.customerDevRevealedEmails.add(`${state.customerDevSelectedLeadId}-${index}`);
    renderApp();
    return;
  }

  const leadNode = target.closest("[data-dev-lead]");
  if (leadNode) {
    state.customerDevSelectedLeadId = leadNode.getAttribute("data-dev-lead") || "solartech";
    state.popup = null;
    renderApp();
  }
}

/**
 * 处理客户开发选择弹窗的键盘关闭操作。
 *
 * @param {KeyboardEvent} event - 页面键盘事件。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function handleCustomerDevKeydown(event) {
  if (event.key !== "Escape" || !state.customerDevPicker) {
    return;
  }

  state.customerDevPicker = null;
  renderApp();
}

/**
 * 获取当前浏览器专属的 KASS 原型工作区 ID。
 *
 * 为什么保存到 localStorage：
 * - 页面刷新后仍能看到上一轮 Agent 修改的虚拟客户资料。
 * - 不同浏览器使用不同随机 ID，互不覆盖原型数据。
 * - 该 ID 只能访问对应的虚拟快照，不能访问任何真实赢单账号。
 *
 * @returns {string} 以 workspace- 开头的随机工作区 ID。
 * @throws {Error} localStorage 不可用时自动回退到当前内存状态，不向外抛出。
 */
function getKassPrototypeWorkspaceId() {
  if (state.kassPrototypeWorkspaceId) {
    return state.kassPrototypeWorkspaceId;
  }

  try {
    const stored = window.localStorage.getItem(KASS_PROTOTYPE_WORKSPACE_STORAGE_KEY) || "";
    if (/^[A-Za-z0-9._-]{16,80}$/.test(stored)) {
      state.kassPrototypeWorkspaceId = stored;
      return stored;
    }
  } catch (_error) {
    // 某些隐私模式禁用 localStorage；后面继续使用当前页面内存 ID 即可。
  }

  const randomPart = typeof window.crypto?.randomUUID === "function"
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
  state.kassPrototypeWorkspaceId = `workspace-${randomPart}`;

  try {
    window.localStorage.setItem(
      KASS_PROTOTYPE_WORKSPACE_STORAGE_KEY,
      state.kassPrototypeWorkspaceId
    );
  } catch (_error) {
    // 存储失败不影响当前页面继续使用内存中的工作区。
  }

  return state.kassPrototypeWorkspaceId;
}

/**
 * 把当前页面客户复制成原型 API 的初始化快照。
 *
 * @param {typeof KASS_GROUPS[number]["customers"][number]} customer - 当前客户。
 * @returns {object} 只包含可序列化原型字段的客户快照。
 * @throws {Error} JSON 序列化失败时由调用方捕获。
 */
function serializeKassPrototypeCustomer(customer) {
  return JSON.parse(JSON.stringify({
    ...customer,
    customerRef: customer.id,
    backgroundProfile: getKassBackgroundProfile(customer),
    followupRecords: Array.isArray(customer.followupRecords) ? customer.followupRecords : []
  }));
}

/**
 * 调用 KASS 原型 CRM API。
 *
 * @param {"GET" | "POST"} method - 请求方法。
 * @param {Record<string, unknown>} payload - action、workspace_id 和业务参数。
 * @returns {Promise<object>} API 的 data。
 * @throws {Error} 网络、HTTP 或业务失败时抛出安全错误。
 */
async function callKassPrototypeApi(method, payload) {
  const endpoint = new URL(getDifyProxyEndpoint("kassCrm"));
  const requestOptions = {
    method,
    headers: { "Content-Type": "application/json" }
  };

  if (method === "GET") {
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value) !== "") {
        endpoint.searchParams.set(key, String(value));
      }
    });
  } else {
    requestOptions.body = JSON.stringify(payload);
  }

  const response = await fetch(endpoint, requestOptions);
  const rawText = await response.text();
  let result = null;
  try {
    result = rawText ? JSON.parse(rawText) : null;
  } catch (_error) {
    result = null;
  }

  if (!response.ok || result?.ok !== true) {
    throw new Error(
      result?.message || `KASS 原型数据接口返回 HTTP ${response.status}`
    );
  }

  return result.data;
}

/**
 * 把原型 API 返回的客户合并回 KASS_GROUPS。
 *
 * KASS_GROUPS 是 A/B 两套界面共同读取的数据源，因此只要在原对象上合并，
 * 当前对话页、右侧资料、详细档案和跟进时间线会同时刷新。
 *
 * @param {string} customerRef - 页面客户引用。
 * @param {object} storedCustomer - API 返回的客户快照。
 * @returns {boolean} 找到并完成合并时返回 true。
 * @throws {Error} 本函数不主动抛异常。
 */
function mergeKassPrototypeCustomer(customerRef, storedCustomer) {
  for (const group of KASS_GROUPS) {
    const customer = group.customers.find((item) => item.id === customerRef);
    if (!customer) continue;

    Object.assign(customer, storedCustomer, {
      id: customerRef,
      customerRef,
      backgroundProfile: {
        ...(customer.backgroundProfile || {}),
        ...(storedCustomer.backgroundProfile || {})
      },
      followupRecords: Array.isArray(storedCustomer.followupRecords)
        ? storedCustomer.followupRecords
        : customer.followupRecords
    });
    return true;
  }
  return false;
}

/**
 * 首次使用客户时把静态样例写入当前浏览器的原型工作区。
 *
 * 已存在的客户不会被静态样例覆盖，保证 Agent 修改在刷新和下一轮对话中持续生效。
 *
 * @param {typeof KASS_GROUPS[number]["customers"][number]} customer - 当前客户。
 * @returns {Promise<object>} 当前存储中的客户快照。
 * @throws {Error} 原型 API 不可用时抛出。
 */
async function ensureKassPrototypeCustomer(customer) {
  const data = await callKassPrototypeApi("POST", {
    action: "bootstrap_customer",
    workspace_id: getKassPrototypeWorkspaceId(),
    customer: serializeKassPrototypeCustomer(customer)
  });
  if (data?.customer) {
    mergeKassPrototypeCustomer(customer.id, data.customer);
  }
  return data?.customer || customer;
}

/**
 * 把异步恢复后的客户数据原位同步到当前可见区域。
 *
 * 为什么不能再调用 renderApp：
 * - renderApp 会替换整个 #app，侧栏、页签、对话和客户资料会同时销毁重建。
 * - 原型接口通常需要数秒才返回，延迟整页重建会形成非常明显的“又闪一下”。
 * - 这里只更新当前客户的数据区域；现有页签和对话 DOM 保持不动。
 *
 * @param {typeof KASS_GROUPS[number]["customers"][number]} customer - 已完成恢复的客户。
 * @returns {boolean} 找到并更新当前可见客户区域时返回 true。
 * @throws {Error} DOM 模板解析错误继续抛出，便于开发环境发现结构问题。
 */
function refreshKassHydratedCustomerRegion(customer) {
  if (
    !isKassWorkbenchView()
    || !customer
    || state.activeCustomerId !== customer.id
  ) {
    return false;
  }

  if (isKassComparisonView()) {
    const currentContext = document.querySelector(".kass-compare-context");
    if (!currentContext) {
      return false;
    }

    const template = document.createElement("template");
    template.innerHTML = renderKassComparisonContext(customer).trim();
    const nextContext = template.content.firstElementChild;
    if (!nextContext) {
      return false;
    }

    const updatedContext = morphKassStreamNode(currentContext, nextContext);
    bindKassTaskToggleEvents(updatedContext);
    return true;
  }

  if (!["profile", "followups"].includes(state.activeKassTab)) {
    // 成交顾问页没有客户资料正文；下次切换页签时会直接读取已合并的数据。
    return false;
  }

  const tabBody = document.querySelector(".kass-workspace-tab-body");
  if (!tabBody) {
    return false;
  }

  const nextHtml = state.activeKassTab === "profile"
    ? renderKassWorkspaceTab(customer)
    : renderKassFollowupTab(customer);
  morphKassStreamHtml(tabBody, nextHtml);
  bindKassTaskToggleEvents(tabBody);
  return true;
}

/**
 * 在进入 KASS 页面或切换客户后恢复该浏览器上次保存的原型状态。
 *
 * @param {typeof KASS_GROUPS[number]["customers"][number] | null | undefined} customer - 当前客户。
 * @returns {Promise<void>} 同步完成后重画页面。
 * @throws {Error} 错误会在函数内记录，不阻断静态原型浏览。
 */
async function hydrateKassPrototypeCustomer(customer) {
  const customerRef = String(customer?.id || "");
  if (
    !customerRef
    || state.kassPrototypeSyncing
    || state.kassPrototypeHydratedCustomerIds.has(customerRef)
    || state.kassPrototypeHydratingCustomerIds.has(customerRef)
  ) {
    return;
  }

  state.kassPrototypeHydratingCustomerIds.add(customerRef);
  const beforeSnapshot = createKassSyncMotionSnapshot(customer);
  try {
    await ensureKassPrototypeCustomer(customer);
    state.kassPrototypeHydratedCustomerIds.add(customerRef);

    const afterSnapshot = createKassSyncMotionSnapshot(customer);
    if (JSON.stringify(beforeSnapshot) !== JSON.stringify(afterSnapshot)) {
      refreshKassHydratedCustomerRegion(customer);
    }
  } catch (error) {
    console.warn("[reverse-yingdan] KASS 原型客户恢复失败", {
      customerRef,
      message: error instanceof Error ? error.message : "unknown"
    });
  } finally {
    state.kassPrototypeHydratingCustomerIds.delete(customerRef);
  }
}

/**
 * 复制一份只用于比较动画变化的客户 CRM 快照。
 *
 * 快照只保留右侧界面实际消费的字段。这样每次 Plugin 写入完成后，可以根据真实
 * 回读结果识别客户资料、背调、跟进和待办的增删改查，而不是根据 Agent 文案猜测。
 *
 * @param {typeof KASS_GROUPS[number]["customers"][number]} customer - 当前客户。
 * @returns {{
 *   customer: { summary: object, profile: object },
 *   followups: Array<{ id: string, title: string, summary: string, date: string, dayLabel: string, time: string, owner: string, channel: string, tasks: Array<{ id: string, title: string, dueDate: string, status: string }> }>
 * }} 动画比较快照。
 * @throws {Error} 本函数不主动抛异常。
 */
function createKassSyncMotionSnapshot(customer) {
  const followups = Array.isArray(customer?.followupRecords)
    ? customer.followupRecords
    : [];
  const profile = getKassBackgroundProfile(customer || {});

  return {
    customer: {
      /*
       * 顶层客户字段统一落到客户摘要区域。即使当前折叠视图只露出名称、等级、
       * 国家和阶段，详细档案与 Agent 上下文仍会消费其它字段。
       */
      summary: {
        name: String(customer?.name || ""),
        country: String(customer?.country || ""),
        level: String(customer?.level || ""),
        stage: String(customer?.stage || ""),
        intent: String(customer?.intent || ""),
        product: String(customer?.product || ""),
        quantity: String(customer?.quantity || ""),
        tradeTerm: String(customer?.tradeTerm || ""),
        customization: String(customer?.customization || ""),
        inquiry: String(customer?.inquiry || ""),
        summary: String(customer?.summary || ""),
        nextAction: String(customer?.nextAction || ""),
        website: String(customer?.website || ""),
        contact: String(customer?.contact || "")
      },
      /*
       * 使用归一化后的资料快照，确保来源、待完善项和所有详细档案字段都能触发反馈；
       * 不能只比较首页当前可见的四个事实，否则抽屉里的修改会悄悄发生。
       */
      profile: { ...profile }
    },
    followups: followups.map((record, recordIndex) => ({
      id: String(record.id || `kass-followup-${record.date || recordIndex}`),
      title: String(record.title || record.summary || "客户跟进记录"),
      summary: String(record.summary || record.text || ""),
      date: String(record.date || ""),
      dayLabel: String(record.dayLabel || ""),
      time: String(record.time || ""),
      owner: String(record.owner || ""),
      channel: String(record.channel || ""),
      tasks: (Array.isArray(record.tasks) ? record.tasks : []).map((task) => ({
        id: String(task.id || `kass-task-${task.title || "untitled"}`),
        title: String(task.title || "待补充事项"),
        dueDate: String(task.dueDate || ""),
        status: String(task.status || "")
      }))
    }))
  };
}

/**
 * 比较 Plugin 写入前后的 CRM 快照，生成完整动画计划。
 *
 * 纯差异判断集中在 `src/dify-config.js`，便于用 Node 测试覆盖所有 CRUD 分支；
 * 页面层只负责创建当前客户快照与执行 DOM 动画。
 *
 * @param {ReturnType<typeof createKassSyncMotionSnapshot>} before - 写入前快照。
 * @param {ReturnType<typeof createKassSyncMotionSnapshot>} after - 写入后快照。
 * @returns {ReturnType<typeof window.YD_DIFY.buildKassCrudMotionPlan>} 动画计划。
 * @throws {Error} Dify 前端状态模块未加载时抛出，便于开发环境发现脚本顺序问题。
 */
function buildKassSyncMotionPlan(before, after) {
  if (typeof window.YD_DIFY?.buildKassCrudMotionPlan !== "function") {
    throw new Error("KASS CRUD 动画差异规划器未加载。");
  }
  return window.YD_DIFY.buildKassCrudMotionPlan(before, after);
}

/**
 * 按 data 属性的完整值寻找一个 KASS 动画目标。
 *
 * 不把模型或接口返回的 ID 拼进 CSS selector，可避免特殊字符导致选择器解析失败。
 *
 * @param {string} attributeName - data 属性名。
 * @param {string} attributeValue - 需要完整匹配的属性值。
 * @returns {HTMLElement | null} 匹配节点。
 * @throws {Error} 本函数不主动抛异常。
 */
function findKassMotionElement(attributeName, attributeValue) {
  return Array.from(document.querySelectorAll(`[${attributeName}]`)).find((node) => (
    node.getAttribute(attributeName) === attributeValue
  )) || null;
}

/**
 * 根据动画条目的业务实体找到右侧稳定目标。
 *
 * @param {{ id: string, entity: "customer" | "profile" | "task" | "followup" }} entry - 动画条目。
 * @returns {HTMLElement | null} 当前 DOM 中的目标；该区域未显示时返回 null。
 * @throws {Error} 本函数不主动抛异常。
 */
function getKassSyncMotionTarget(entry) {
  if (entry.entity === "customer") {
    return document.querySelector("[data-kass-customer-summary-target]");
  }
  if (entry.entity === "profile") {
    return document.querySelector("[data-kass-profile-target]");
  }
  if (entry.entity === "task") {
    return findKassMotionElement("data-kass-task-row", entry.id);
  }
  if (entry.entity === "followup") {
    return findKassMotionElement("data-kass-followup-id", entry.id);
  }
  return null;
}

/**
 * 返回令牌真正应抵达的视觉节点。
 *
 * 完成/重开需要落到复选框；跟进操作落到记录正文；客户资料操作则使用整个稳定区域。
 *
 * @param {HTMLElement} target - 业务实体的稳定目标。
 * @param {{ entity: string, operation: string }} entry - 动画条目。
 * @returns {HTMLElement} 用于计算终点坐标的节点。
 * @throws {Error} 本函数不主动抛异常。
 */
function getKassSyncMotionAnchor(target, entry) {
  if (
    entry.entity === "task"
    && ["complete", "reopen"].includes(entry.operation)
  ) {
    return target.querySelector('input[type="checkbox"]') || target;
  }
  if (entry.entity === "followup") {
    return target.querySelector(".kass-followup-details") || target;
  }
  return target;
}

/**
 * 在飞行开始前准备新状态目标。
 *
 * 只有“新增”实体需要整体暂时收起；完成操作只隐藏新勾选状态。修改和重开保留
 * 当前内容，避免右栏发生不必要的布局跳动。
 *
 * @param {HTMLElement} target - 当前动画目标。
 * @param {{ entity: string, operation: string }} entry - 动画条目。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function prepareKassSyncMotionTarget(target, entry) {
  target.setAttribute("data-kass-sync-operation", entry.operation);

  if (entry.entity === "task" && entry.operation === "complete") {
    target.classList.add("kass-task-awaiting-sync");
    const checkbox = target.querySelector('input[type="checkbox"]');
    if (checkbox) {
      checkbox.checked = false;
    }
  }
  if (entry.entity === "task" && entry.operation === "add") {
    target.classList.add("kass-entity-awaiting-sync");
  }
  if (entry.entity === "followup" && entry.operation === "add") {
    target.classList.add("kass-followup-awaiting-sync");
  }
}

/**
 * 让新增、修改、完成或重开目标在抵达时显现并短暂强调。
 *
 * @param {HTMLElement} target - 右侧资料、跟进或待办目标。
 * @param {{ entity: string, operation: string }} entry - 动画条目。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function revealKassSyncMotionTarget(target, entry) {
  target.classList.remove(
    "kass-task-awaiting-sync",
    "kass-followup-awaiting-sync",
    "kass-entity-awaiting-sync"
  );
  if (entry.entity === "task") {
    const checkbox = target.querySelector('input[type="checkbox"]');
    if (checkbox && entry.operation === "complete") {
      checkbox.checked = true;
    }
    if (checkbox && entry.operation === "reopen") {
      checkbox.checked = false;
    }
  }

  target.classList.add("kass-sync-arrived");
  window.setTimeout(() => {
    target.classList.remove("kass-sync-arrived");
    if (target.getAttribute("data-kass-sync-operation") === entry.operation) {
      target.removeAttribute("data-kass-sync-operation");
    }
  }, 680);
}

/**
 * 在右栏刷新前让即将删除的旧目标退场。
 *
 * @param {HTMLElement} target - 仍存在于旧 DOM 的待办或跟进记录。
 * @returns {Promise<void>} 退场完成后结束，随后才允许刷新右栏。
 * @throws {Error} Web Animations API 异常会安全降级为立即刷新。
 */
function departKassSyncMotionTarget(target) {
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (reduceMotion) {
    return Promise.resolve();
  }

  target.classList.add("kass-sync-departing");
  if (typeof target.animate !== "function") {
    return new Promise((resolve) => {
      window.setTimeout(resolve, 220);
    });
  }

  const animation = target.animate(
    [
      { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
      { opacity: 0.18, transform: "translate3d(8px, 0, 0) scale(0.985)" }
    ],
    {
      duration: 220,
      easing: "cubic-bezier(0.4, 0, 1, 1)",
      fill: "forwards"
    }
  );

  return animation.finished.catch(() => undefined).then(() => undefined);
}

/**
 * 创建一枚从 Agent 对话飞向右侧资料的同步令牌。
 *
 * 只使用 transform 和 opacity 做运动，避免重排；元素是 pointer-events:none，
 * 不会阻塞用户在动画期间继续滚动或操作页面。
 *
 * @param {{
 *   source: HTMLElement,
 *   target: HTMLElement,
 *   entry: { entity: "customer" | "profile" | "task" | "followup", operation: string, label: string },
 *   delay: number
 * }} options - 飞行起点、终点和展示内容。
 * @returns {Promise<void>} 令牌抵达并显现目标后完成。
 * @throws {Error} Web Animations API 不可用时直接显示目标状态。
 */
function animateKassSyncFlight({ source, target, entry, delay }) {
  const sourceRect = source.getBoundingClientRect();
  const targetNode = getKassSyncMotionAnchor(target, entry);
  const targetRect = targetNode.getBoundingClientRect();
  const startX = Math.min(sourceRect.right - 18, window.innerWidth - 42);
  const startY = sourceRect.top + Math.min(sourceRect.height * 0.5, 64);
  const endX = targetRect.left + Math.min(targetRect.width * 0.5, 34);
  const endY = targetRect.top + Math.min(targetRect.height * 0.5, 30);
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const token = document.createElement("span");

  token.className = [
    "kass-sync-flight",
    `kass-sync-flight-${entry.entity}`,
    `kass-sync-flight-${entry.operation}`
  ].join(" ");
  token.setAttribute("aria-hidden", "true");
  token.style.left = `${startX}px`;
  token.style.top = `${startY}px`;
  token.textContent = entry.label;
  document.body.appendChild(token);

  if (typeof token.animate !== "function") {
    token.remove();
    return entry.operation === "remove"
      ? departKassSyncMotionTarget(target)
      : Promise.resolve(revealKassSyncMotionTarget(target, entry));
  }

  const animation = token.animate(
    [
      {
        opacity: 0,
        transform: "translate3d(0, 0, 0) scale(0.72)"
      },
      {
        opacity: 1,
        transform: `translate3d(${deltaX * 0.46}px, ${deltaY - 24}px, 0) scale(1)`,
        offset: 0.42
      },
      {
        opacity: 0.18,
        transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${entry.operation === "complete" ? 0.7 : 0.82})`
      }
    ],
    {
      duration: 480,
      delay,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "both"
    }
  );

  return animation.finished
    .then(async () => {
      token.remove();
      if (entry.operation === "remove") {
        await departKassSyncMotionTarget(target);
      } else {
        revealKassSyncMotionTarget(target, entry);
      }
    })
    .catch(async () => {
      token.remove();
      if (entry.operation === "remove") {
        await departKassSyncMotionTarget(target);
      } else {
        revealKassSyncMotionTarget(target, entry);
      }
    });
}

/**
 * 播放同一阶段的一组 CRM 同步动画。
 *
 * @param {Array<{ id: string, entity: "customer" | "profile" | "task" | "followup", operation: string, label: string }>} entries - 当前阶段的动画条目。
 * @param {string} sourceMessageId - 当前 Agent 消息 ID。
 * @returns {Promise<void>} 本轮所有同步令牌完成后结束。
 * @throws {Error} 缺少起点或目标时安全降级为普通实时刷新。
 */
function playKassSyncMotionEntries(entries, sourceMessageId) {
  if (!state.activeMain.startsWith("customer-kass")) {
    return Promise.resolve();
  }

  const source = findKassMotionElement("data-kass-message-id", sourceMessageId);
  const targets = entries
    .map((entry) => ({
      entry,
      target: getKassSyncMotionTarget(entry)
    }))
    .filter(({ target }) => target);

  targets.forEach(({ target, entry }) => {
    prepareKassSyncMotionTarget(target, entry);
  });

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (!source || reduceMotion) {
    return Promise.all(targets.map(({ target, entry }) => (
      entry.operation === "remove"
        ? departKassSyncMotionTarget(target)
        : Promise.resolve(revealKassSyncMotionTarget(target, entry))
    ))).then(() => undefined);
  }

  const flights = targets.map(({ target, entry }, index) => (
    animateKassSyncFlight({
      source,
      target,
      entry,
      delay: index * 90
    })
  ));

  return Promise.all(flights).then(() => undefined);
}

/**
 * 等待当前 DOM 布局稳定后播放一组动画条目。
 *
 * @param {Array<object>} entries - 当前阶段动画条目。
 * @param {string} sourceMessageId - 当前 Agent 消息 ID。
 * @param {{ doubleFrame?: boolean }} [options] - 右栏刚刷新时使用双帧等待布局完成。
 * @returns {Promise<void>} 布局稳定且动画完成后结束。
 * @throws {Error} 本函数不主动抛异常。
 */
function scheduleKassSyncMotionEntries(
  entries,
  sourceMessageId,
  { doubleFrame = false } = {}
) {
  if (!entries.length) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      const play = () => playKassSyncMotionEntries(entries, sourceMessageId).finally(resolve);
      if (doubleFrame) {
        window.requestAnimationFrame(play);
        return;
      }
      play();
    });
  });
}

/**
 * 在右栏刷新前播放删除类动画。
 *
 * @param {ReturnType<typeof buildKassSyncMotionPlan>} plan - 完整 CRUD 差异。
 * @param {string} sourceMessageId - 当前 Agent 消息 ID。
 * @returns {Promise<void>} 所有旧目标退场后结束。
 * @throws {Error} Dify 动画阶段规划器未加载时抛出。
 */
function scheduleKassPreRefreshMotion(plan, sourceMessageId) {
  const phases = window.YD_DIFY.getKassCrudMotionPhases(plan);
  return scheduleKassSyncMotionEntries(phases.beforeRefresh, sourceMessageId);
}

/**
 * 在右栏刷新后播放新增、修改、完成与重开动画。
 *
 * 保留原函数名，兼容现有浏览器验收脚本和其它调用点。
 *
 * @param {ReturnType<typeof buildKassSyncMotionPlan>} plan - 完整 CRUD 差异。
 * @param {string} sourceMessageId - 当前 Agent 消息 ID。
 * @returns {Promise<void>} 新状态反馈全部结束后完成。
 * @throws {Error} Dify 动画阶段规划器未加载时抛出。
 */
function scheduleKassSyncMotion(plan, sourceMessageId) {
  const phases = window.YD_DIFY.getKassCrudMotionPhases(plan);
  return scheduleKassSyncMotionEntries(
    phases.afterRefresh,
    sourceMessageId,
    { doubleFrame: true }
  );
}

/**
 * 从原型 API 重新读取客户与跟进记录并刷新右侧界面。
 *
 * @param {typeof KASS_GROUPS[number]["customers"][number]} customer - 当前客户。
 * @param {{ render?: boolean, motionSourceMessageId?: string }} [options] - 是否重画页面，以及动画从哪条 Agent 消息起飞。
 * @returns {Promise<object>} 最新客户快照。
 * @throws {Error} 原型 API 不可用或客户未初始化时抛出。
 */
async function syncKassPrototypeCustomer(
  customer,
  { render = true, motionSourceMessageId = "" } = {}
) {
  const beforeMotionSnapshot = createKassSyncMotionSnapshot(customer);
  state.kassPrototypeSyncing = true;
  try {
    const data = await callKassPrototypeApi("GET", {
      action: "context",
      workspace_id: getKassPrototypeWorkspaceId(),
      customer_ref: customer.id
    });
    if (data?.customer) {
      mergeKassPrototypeCustomer(customer.id, {
        ...data.customer,
        followupRecords: Array.isArray(data.followups)
          ? data.followups
          : data.customer.followupRecords
      });
    }
    if (render) {
      const afterMotionSnapshot = createKassSyncMotionSnapshot(customer);
      const motionPlan = buildKassSyncMotionPlan(
        beforeMotionSnapshot,
        afterMotionSnapshot
      );
      /*
       * 删除目标只存在于旧右栏：先让它退场，再重画出新状态。其余动画必须等
       * 新右栏完成布局后播放，才能落到新增或更新后的真实节点。
       */
      await scheduleKassPreRefreshMotion(motionPlan, motionSourceMessageId);
      renderKassAgentStream();
      await scheduleKassSyncMotion(motionPlan, motionSourceMessageId);
    }
    return data?.customer || customer;
  } finally {
    state.kassPrototypeSyncing = false;
  }
}

/**
 * 从 Agent 最终回答中提取一个受控原型 CRUD 指令。
 *
 * 当 Dify App 尚未挂载 HTTP Tool 时，System Prompt 会输出一个
 * `kass-crm-action` fenced block；前端只允许四种当前客户操作，并强制覆盖
 * workspace_id/customer_ref，模型不能越权修改其它工作区或客户。
 *
 * @param {unknown} content - Agent 最终回答。
 * @returns {{ action: object, visibleContent: string } | null} 指令和移除代码块后的可见回答。
 * @throws {Error} JSON 无法解析时抛出。
 */
function extractKassPrototypeAction(content) {
  const text = String(content || "");
  const match = text.match(/```kass-crm-action\s*([\s\S]*?)```/i);
  if (!match) return null;

  const action = JSON.parse(match[1].trim());
  const allowedActions = new Set([
    "update_customer",
    "create_followup",
    "update_followup",
    "delete_followup"
  ]);
  if (!action || typeof action !== "object" || !allowedActions.has(action.action)) {
    throw new Error("Agent 返回了不支持的 KASS 原型操作。");
  }

  return {
    action,
    visibleContent: text.replace(match[0], "").trim()
  };
}

/**
 * 执行 Agent 回答中的原型 CRUD 指令，并把结果同步到右侧客户资料。
 *
 * @param {string} messageId - 当前助手消息 ID。
 * @param {typeof KASS_GROUPS[number]["customers"][number]} customer - 当前客户。
 * @returns {Promise<boolean>} 执行了动作时返回 true；普通分析回答返回 false。
 * @throws {Error} 指令解析或 API 执行失败时抛出。
 */
async function applyKassPrototypeActionFromMessage(messageId, customer) {
  const message = state.kassAgentMessages.find((item) => item.id === messageId);
  const extracted = extractKassPrototypeAction(message?.content);
  if (!extracted) return false;

  const payload = {
    ...extracted.action,
    workspace_id: getKassPrototypeWorkspaceId(),
    customer_ref: customer.id
  };
  const data = await callKassPrototypeApi("POST", payload);

  if (data?.customer) {
    mergeKassPrototypeCustomer(customer.id, data.customer);
  } else if (Array.isArray(data?.followups)) {
    mergeKassPrototypeCustomer(customer.id, {
      ...customer,
      followupRecords: data.followups
    });
  }

  state.kassAgentMessages = state.kassAgentMessages.map((item) => (
    item.id === messageId
      ? {
        ...item,
        content: `${extracted.visibleContent}\n\n已同步到右侧原型客户资料。`.trim()
      }
      : item
  ));
  console.info("[reverse-yingdan] KASS 原型 CRUD 已完成", {
    action: extracted.action.action,
    customerRef: customer.id
  });
  return true;
}

/**
 * 把当前页面客户整理为 KASS Agent Chatflow 的受控输入上下文。
 *
 * 作用：
 * - 让 Agent 理解用户所说的“这个客户”，并能在没有真实数字 customer_id 的原型阶段
 *   先分析页面样例；需要执行真实 CRM 查询或写入时，System Prompt 仍要求通过工具核验。
 * - 只发送当前客户，不发送其它等级的整库数据，减少无关隐私和 token 消耗。
 *
 * @param {typeof KASS_GROUPS[number]["customers"][number]} customer - 当前选中的客户。
 * @returns {string} 不超过 18,000 字符的 JSON 上下文。
 * @throws {Error} JSON.stringify 失败时返回最小客户线索，不中断对话。
 */
function buildKassAgentCustomerContext(customer) {
  const profile = getKassBackgroundProfile(customer);
  const payload = {
    context_type: "prototype_customer_snapshot",
    workspace_id: getKassPrototypeWorkspaceId(),
    local_customer_ref: customer.id,
    category: customer.level,
    company_name: customer.name,
    country_region: customer.country,
    current_stage: customer.stage,
    intent: customer.intent,
    product: customer.product,
    quantity: customer.quantity,
    trade_term: customer.tradeTerm,
    customization: customer.customization,
    inquiry: customer.inquiry,
    profile,
    followups: Array.isArray(customer.followupRecords)
      ? customer.followupRecords.slice(0, 10)
      : []
  };

  try {
    return JSON.stringify(payload).slice(0, 18000);
  } catch (_error) {
    return JSON.stringify({
      context_type: "prototype_customer_snapshot",
      local_customer_ref: customer.id,
      company_name: customer.name,
      category: customer.level
    });
  }
}

/**
 * 完整重画 KASS 页面，并把对话滚动位置保持在最新消息。
 *
 * 本函数只用于发送前插入新消息，以及流结束后同步右侧 CRM 资料。流式事件到达时
 * 必须使用 scheduleKassAgentStreamRender，不能再次整页重建。
 *
 * @returns {void}
 * @throws {Error} renderApp 原有错误会继续抛出，便于开发环境发现模板问题。
 */
function renderKassAgentStream() {
  renderApp();
  window.requestAnimationFrame(() => {
    const scrollArea = document.querySelector("[data-kass-agent-scroll]");
    if (scrollArea) {
      scrollArea.scrollTop = scrollArea.scrollHeight;
    }
  });
}

/**
 * 刷新客户资料区，同时保留当前 Agent 对话节点。
 *
 * `renderApp` 负责给新生成的右栏绑定全部既有交互；随后在浏览器绘制下一帧之前，
 * 把原来的对话节点放回去。这样右栏获得最新数据和事件，正在流式输出的左栏不会
 * 被销毁，也不会重新播放入场动画或跳动滚动位置。
 *
 * @returns {void}
 * @throws {Error} renderApp 原有错误会继续抛出。
 */
function renderKassContextPreservingConversation() {
  const selector = isKassComparisonView()
    ? ".kass-compare-agent"
    : ".kass-crm-thread";
  const preservedConversation = document.querySelector(selector);

  if (!preservedConversation) {
    renderApp();
    return;
  }

  renderApp();
  const replacementConversation = document.querySelector(selector);
  if (replacementConversation) {
    replacementConversation.replaceWith(preservedConversation);
  }
}

/**
 * 原位同步两个同类型 DOM 节点。
 *
 * 作用是保留已经存在的段落、列表和 Artifact 外壳，只更新真正变化的文本、属性或
 * 子节点。这样流式 Markdown 不再通过 innerHTML 整体销毁后重建。
 *
 * @param {Node} currentNode - 页面上当前节点。
 * @param {Node} nextNode - 从安全 HTML 模板解析出的下一状态节点。
 * @returns {Node} 同步后仍在页面中的节点。
 * @throws {Error} DOM API 异常会继续抛出，便于开发环境发现结构问题。
 */
function morphKassStreamNode(currentNode, nextNode) {
  if (
    currentNode.nodeType !== nextNode.nodeType
    || (
      currentNode.nodeType === Node.ELEMENT_NODE
      && currentNode.nodeName !== nextNode.nodeName
    )
  ) {
    const replacement = nextNode.cloneNode(true);
    currentNode.replaceWith(replacement);
    return replacement;
  }

  if (currentNode.nodeType === Node.TEXT_NODE) {
    if (currentNode.nodeValue !== nextNode.nodeValue) {
      currentNode.nodeValue = nextNode.nodeValue;
    }
    return currentNode;
  }

  if (currentNode.nodeType !== Node.ELEMENT_NODE) {
    return currentNode;
  }

  const currentElement = /** @type {Element} */ (currentNode);
  const nextElement = /** @type {Element} */ (nextNode);

  Array.from(currentElement.attributes).forEach((attribute) => {
    if (!nextElement.hasAttribute(attribute.name)) {
      currentElement.removeAttribute(attribute.name);
    }
  });
  Array.from(nextElement.attributes).forEach((attribute) => {
    if (currentElement.getAttribute(attribute.name) !== attribute.value) {
      currentElement.setAttribute(attribute.name, attribute.value);
    }
  });

  const nextChildren = Array.from(nextElement.childNodes);
  nextChildren.forEach((nextChild, index) => {
    const currentChild = currentElement.childNodes[index];
    if (currentChild) {
      morphKassStreamNode(currentChild, nextChild);
    } else {
      currentElement.appendChild(nextChild.cloneNode(true));
    }
  });
  while (currentElement.childNodes.length > nextChildren.length) {
    currentElement.lastChild?.remove();
  }

  return currentElement;
}

/**
 * 用安全渲染结果原位更新 KASS 回答容器。
 *
 * @param {HTMLElement} container - 稳定的回答容器。
 * @param {string} nextHtml - `renderKassAgentAnswerHtml` 生成的安全 HTML。
 * @returns {void}
 * @throws {Error} 模板解析或 DOM 同步失败时继续抛出。
 */
function morphKassStreamHtml(container, nextHtml) {
  const template = document.createElement("template");
  template.innerHTML = String(nextHtml || "");
  const nextChildren = Array.from(template.content.childNodes);
  nextChildren.forEach((nextChild, index) => {
    const currentChild = container.childNodes[index];
    if (currentChild) {
      morphKassStreamNode(currentChild, nextChild);
    } else {
      container.appendChild(nextChild.cloneNode(true));
    }
  });
  while (container.childNodes.length > nextChildren.length) {
    container.lastChild?.remove();
  }
}

/**
 * 只更新 KASS 消息内的浅灰过程提示。
 *
 * @param {HTMLElement} body - 当前助手消息正文。
 * @param {object} message - 当前助手消息状态。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function patchKassProcessPanelDom(body, message) {
  const panel = body.querySelector("[data-kass-process-panel]");
  if (!panel) {
    return;
  }

  const process = window.YD_DIFY.getKassProcessPresentation(message);
  const kicker = panel.querySelector("[data-kass-process-kicker]");
  const label = panel.querySelector("[data-kass-process-label]");
  const detail = panel.querySelector("[data-kass-process-detail]");
  const count = panel.querySelector("[data-kass-process-count]");

  panel.hidden = !process.visible;
  panel.classList.toggle("is-complete", process.complete);
  if (kicker) kicker.textContent = process.complete ? "处理完成" : "Agent 处理过程";
  if (label) label.textContent = process.label;
  if (detail) {
    detail.textContent = process.detail;
    detail.hidden = !process.detail;
  }
  if (count) count.textContent = process.count ? `${process.count} 步` : "";
}

/**
 * 只更新一条 KASS Agent 消息的正文。
 *
 * 更新策略：
 * - 过程事件没有改变可见文字时不操作 DOM。
 * - 正文流式返回期间只修改稳定文本节点的 textContent。
 * - 只有进入流式阶段或执行完成时才重建一次正文；最终 Artifact 仍由安全适配器生成。
 *
 * @param {string} messageId - 当前流式助手消息的稳定 ID。
 * @returns {boolean} 找到并更新目标消息时返回 true。
 * @throws {Error} 本函数不主动抛异常。
 */
function patchKassAgentStreamMessageDom(messageId) {
  if (!state.activeMain.startsWith("customer-kass") || !messageId) {
    return false;
  }

  const message = state.kassAgentMessages.find((item) => item.id === messageId);
  const turn = Array.from(document.querySelectorAll("[data-kass-message-id]")).find((node) => (
    node.getAttribute("data-kass-message-id") === messageId
  ));
  const body = turn?.querySelector("[data-kass-message-body]");

  if (!message || !body) {
    return false;
  }

  patchKassProcessPanelDom(body, message);

  const currentPhase = body.getAttribute("data-kass-render-phase") || "";
  const answerShell = body.querySelector("[data-kass-answer-shell]");
  if (!answerShell) {
    return false;
  }
  const renderedContent = typeof answerShell.__kassRenderedContent === "string"
    ? answerShell.__kassRenderedContent
    : "";
  const plan = window.YD_DIFY.getKassStreamRenderPlan(
    message,
    currentPhase,
    renderedContent
  );
  body.setAttribute("data-kass-render-phase", plan.phase);

  if (plan.mode === "none") {
    return true;
  }

  if (plan.mode === "morph") {
    morphKassStreamHtml(answerShell, renderKassAgentAnswerHtml(message));
    answerShell.__kassRenderedContent = plan.content;
    return true;
  }

  return true;
}

/**
 * 把同一动画帧中的 KASS SSE 事件合并为一次局部 DOM 更新。
 *
 * @param {string} messageId - 当前流式助手消息的稳定 ID。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function scheduleKassAgentStreamRender(messageId) {
  if (!state.activeMain.startsWith("customer-kass") || kassStreamRenderFrame !== null) {
    return;
  }

  kassStreamRenderFrame = window.requestAnimationFrame(() => {
    kassStreamRenderFrame = null;
    if (!state.activeMain.startsWith("customer-kass")) {
      return;
    }

    patchKassAgentStreamMessageDom(messageId);
    const scrollArea = document.querySelector("[data-kass-agent-scroll]");
    if (scrollArea) {
      scrollArea.scrollTop = scrollArea.scrollHeight;
    }
  });
}

/**
 * 在 KASS 流结束后局部恢复对话控件。
 *
 * 过去这里会再次调用 renderApp，导致流式回答刚稳定时整页又闪一次。现在只完成：
 * 渲染最终富文本、移除思考占位、恢复输入区，并保持滚动位置。
 *
 * @param {string} messageId - 刚完成的助手消息 ID。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function finalizeKassAgentStreamDom(messageId) {
  patchKassAgentStreamMessageDom(messageId);
  document.querySelectorAll("[data-kass-thinking-row]").forEach((node) => {
    node.remove();
  });

  const input = document.querySelector("[data-kass-agent-input]");
  const sendButton = document.querySelector("[data-kass-agent-send]");
  if (input) {
    input.disabled = false;
  }
  if (sendButton) {
    sendButton.disabled = !state.kassAgentDraft.trim();
  }

  const scrollArea = document.querySelector("[data-kass-agent-scroll]");
  if (scrollArea) {
    scrollArea.scrollTop = scrollArea.scrollHeight;
  }
}

/**
 * 从公开的 Dify 过程事件中识别已经成功结束的 KASS 写 Tool。
 *
 * 为什么只看写 Tool：
 * - get_context 是只读查询，不需要刷新右栏。
 * - update/create/delete 完成后，原型 CRM 已经发生变化，应立即回读，不能等用户刷新页面。
 * - 只使用公开 step.kind/status/label，不读取 Tool 参数、返回体或隐藏思考。
 *
 * @param {object} event - Cloudflare 代理公开的 process 事件。
 * @returns {string} 命中的 Tool 名；不是已完成写操作时返回空字符串。
 * @throws {Error} 本函数不主动抛异常。
 */
function getCompletedKassMutationToolName(event) {
  if (
    event?.type !== "process"
    || event?.step?.kind !== "tool"
    || event?.step?.status !== "done"
  ) {
    return "";
  }

  const label = String(event.step.label || "");
  return [
    "update_customer",
    "create_followup",
    "update_followup",
    "delete_followup"
  ].find((toolName) => label.includes(toolName)) || "";
}

/**
 * 通过通用安全代理调用 KASS Agent Chatflow。
 *
 * 数据流：
 * 1. 浏览器只发送稳定 feature_id、当前客户线索和用户问题。
 * 2. Cloudflare / Vercel 从服务端配置读取 Dify App API Key。
 * 3. 当前客户先写入独立原型工作区；Dify 只处理这份虚拟快照。
 * 4. Agent 通过固定地址、无真实凭证的 KASS 原型 CRM Plugin 执行增删改查。
 * 5. 完成后重新读取原型 API，右侧资料和跟进记录立即刷新。
 * 6. 回答中的受控 Artifact 继续由当前页面沙箱渲染器处理。
 *
 * @returns {Promise<void>} 流结束后恢复输入状态并保留 conversation_id。
 * @throws {Error} 网络和协议错误会转换为对话内失败消息，不向点击事件继续抛出。
 */
async function sendKassAgentDraft() {
  const content = state.kassAgentDraft.trim();

  if (!content || state.kassAgentThinking) {
    return;
  }

  const customer = isKassWorkbenchView()
    ? getKassWorkbenchCustomer(getKassWorkbenchGroup())
    : getActiveKassCustomer();

  if (!customer) {
    showToast("请先选择一个客户。");
    return;
  }

  const config = getDifyFeatureConfig(KASS_DIFY_FEATURE_ID);
  if (!config.loaded && !config.loading) {
    await loadDifyFeatureConfig(KASS_DIFY_FEATURE_ID);
  }
  if (config.loading) {
    showToast("正在读取 KASS Agent 配置，请稍后再试。");
    return;
  }
  if (!config.hasKey) {
    showToast("KASS Agent Chatflow API Key 尚未配置。");
    return;
  }

  try {
    await ensureKassPrototypeCustomer(customer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "KASS 原型数据初始化失败。";
    showToast(message);
    console.error("[reverse-yingdan] KASS 原型客户初始化失败", {
      customerRef: customer.id,
      message
    });
    return;
  }

  // 新客户或页面刚清空消息时必须开启新会话，避免 conversation_id 把另一位客户的
  // 上下文带进当前客户；同一客户连续追问则继续复用会话。
  let session = getDifyFeatureSession(KASS_DIFY_FEATURE_ID);
  if (session.customerId !== customer.id || state.kassAgentMessages.length === 0) {
    state.difyFeatureSessions[KASS_DIFY_FEATURE_ID] = window.YD_DIFY.createFeatureSessionState(KASS_DIFY_FEATURE_ID);
    session = state.difyFeatureSessions[KASS_DIFY_FEATURE_ID];
    session.customerId = customer.id;
  }

  const now = Date.now();
  const pendingAnswerId = `kass-agent-${now}`;
  state.kassAgentMessages.push(
    { id: `kass-user-${now}`, role: "user", content, status: "done" },
    {
      id: pendingAnswerId,
      role: "assistant",
      content: `正在结合 ${customer.name} 的档案与 CRM 数据分析…`,
      status: "loading",
      processSteps: [],
      currentProcess: null,
      answerStarted: false,
      thinkingStartedAt: now,
      thinkingEndedAt: null
    }
  );
  state.kassAgentDraft = "";
  state.kassAgentThinking = true;
  console.info("[reverse-yingdan] KASS Agent Chatflow 调用开始", {
    customerRef: customer.id,
    workspaceReady: Boolean(getKassPrototypeWorkspaceId()),
    hasConversation: Boolean(session.conversationId)
  });
  renderKassAgentStream();

  const motionBeforeSnapshot = createKassSyncMotionSnapshot(customer);
  let didKassMutation = false;

  try {
    let doneReceived = false;
    /*
     * 同一写 Tool 会产生“开始 / 完成”等多条过程事件；这里只为每个完成 step 同步一次。
     * Promise 串行化可以避免 Agent 连续调用 update_followup 与 update_customer 时，
     * 两次 GET 回读交叉返回，导致较旧的快照覆盖较新的客户状态。
     */
    const syncedMutationStepIds = new Set();
    let mutationSyncPromise = Promise.resolve();

    /**
     * 把一条公开 SSE 事件合并到当前 KASS 助手消息。
     *
     * @param {object} event - 通用代理公开的 process、answer 或 done/error 事件。
     * @returns {void}
     * @throws {Error} 协议内 error 事件会转成异常交给外层统一处理。
     */
    const applyStreamEvent = (event) => {
      if (event?.type === "error") {
        throw new Error(event.message || "KASS Agent 流式响应中断。");
      }

      state.kassAgentMessages = state.kassAgentMessages.map((message) => (
        message.id === pendingAnswerId
          ? window.YD_DIFY.applyDifyStreamEventToMessage(message, event)
          : message
      ));

      if (event?.type === "done") {
        doneReceived = true;
        session.conversationId = event.result?.conversation_id || session.conversationId;
      }

      const mutationToolName = getCompletedKassMutationToolName(event);
      const mutationStepId = String(event?.step?.id || mutationToolName);
      if (mutationToolName && !syncedMutationStepIds.has(mutationStepId)) {
        syncedMutationStepIds.add(mutationStepId);
        didKassMutation = true;
        mutationSyncPromise = mutationSyncPromise.then(async () => {
          try {
            await syncKassPrototypeCustomer(customer, {
              render: false
            });
            console.info("[reverse-yingdan] KASS 写操作已回读，等待 Agent 完成后刷新右侧资料", {
              customerRef: customer.id,
              toolName: mutationToolName
            });
          } catch (syncError) {
            console.warn("[reverse-yingdan] KASS 写操作实时回读失败，将在回答结束后重试", {
              customerRef: customer.id,
              toolName: mutationToolName,
              message: syncError instanceof Error ? syncError.message : "unknown"
            });
          }
        });
      }

      scheduleKassAgentStreamRender(pendingAnswerId);
    };

    const response = await fetch(getDifyProxyEndpoint("chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feature_id: KASS_DIFY_FEATURE_ID,
        query: content,
        conversation_id: session.conversationId,
        user: session.userId,
        inputs: {
          current_customer_id: customer.id,
          current_customer_name: customer.name,
          current_customer_context: buildKassAgentCustomerContext(customer)
        },
        files: []
      })
    });

    const contentType = response.headers.get("content-type") || "";
    if (!response.ok) {
      const errorText = await response.text();
      let payload = null;
      try {
        payload = errorText ? JSON.parse(errorText) : null;
      } catch (_error) {
        payload = null;
      }
      throw new Error(payload?.message || errorText || `KASS Agent 代理返回 HTTP ${response.status}`);
    }

    if (contentType.includes("text/event-stream")) {
      if (!response.body) {
        throw new Error("KASS Agent 代理没有返回可读取的流式响应。");
      }
      const parser = window.YD_DIFY.createDifySseEventParser(applyStreamEvent);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }));
      }
      const remainingText = decoder.decode();
      if (remainingText) parser.push(remainingText);
      parser.finish();

      if (!doneReceived) {
        throw new Error("KASS Agent 流式响应提前结束，请重新发送。");
      }
    } else {
      const rawText = await response.text();
      let payload = null;
      try {
        payload = rawText ? JSON.parse(rawText) : null;
      } catch (_error) {
        payload = null;
      }
      if (!payload) {
        throw new Error("KASS Agent 代理返回了无法识别的响应。");
      }
      applyStreamEvent({
        type: "done",
        result: { ...payload, answer: stripThinkingTags(payload.answer || "") }
      });
    }

    // 等待过程事件触发的实时回读结束，再做最终一致性校验，避免两个快照交叉覆盖。
    await mutationSyncPromise;

    /*
     * 新版 Chatflow 必须由 KASS 原型 CRM Plugin 直接写入。这里保留一次旧版
     * kass-crm-action 解析，仅用于用户尚未把新版 DSL 发布到 Dify Cloud 时的
     * 向后兼容；新版 System Prompt 已明确禁止再输出该代码块。
     *
     * 无论响应来自新旧版本，最后都重新读取服务端快照，确保右侧资料显示的是
    * 实际持久化结果，绝不把 Agent 的自然语言回答当作写入成功证据。
     */
    try {
      const legacyActionApplied = await applyKassPrototypeActionFromMessage(
        pendingAnswerId,
        customer
      );
      didKassMutation = didKassMutation || legacyActionApplied;
      await syncKassPrototypeCustomer(customer, { render: false });

      if (didKassMutation && state.activeMain.startsWith("customer-kass")) {
        const motionAfterSnapshot = createKassSyncMotionSnapshot(customer);
        const motionPlan = buildKassSyncMotionPlan(
          motionBeforeSnapshot,
          motionAfterSnapshot
        );

        /*
         * 先补齐最终回答，再只刷新客户资料区。原来的对话节点会跨 renderApp 保留，
         * 所以工具完成和右栏动画不会销毁回答、输入框或对话滚动位置。
         */
        patchKassAgentStreamMessageDom(pendingAnswerId);
        await scheduleKassPreRefreshMotion(motionPlan, pendingAnswerId);
        renderKassContextPreservingConversation();
        await scheduleKassSyncMotion(motionPlan, pendingAnswerId);
      }
    } catch (actionError) {
      const actionMessage = actionError instanceof Error
        ? actionError.message
        : "KASS 原型数据同步失败。";
      state.kassAgentMessages = state.kassAgentMessages.map((messageItem) => (
        messageItem.id === pendingAnswerId
          ? {
            ...messageItem,
            content: `${messageItem.content}\n\n原型客户资料未完成同步：${actionMessage}`
          }
          : messageItem
      ));
      console.error("[reverse-yingdan] KASS 原型 CRUD 同步失败", {
        customerRef: customer.id,
        message: actionMessage
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "KASS Agent 调用失败，请稍后重试。";
    const safeMessage = message === "Failed to fetch"
      ? "KASS Agent 代理请求失败，请检查部署或网络后重试。"
      : message;

    state.kassAgentMessages = state.kassAgentMessages.map((messageItem) => (
      messageItem.id === pendingAnswerId
        ? window.YD_DIFY.applyDifyStreamEventToMessage(
          messageItem,
          { type: "error", message: safeMessage }
        )
        : messageItem
    ));
    console.error("[reverse-yingdan] KASS Agent Chatflow 调用失败", {
      customerRef: customer.id,
      message: safeMessage
    });
  } finally {
    state.kassAgentThinking = false;
    if (kassStreamRenderFrame !== null) {
      window.cancelAnimationFrame(kassStreamRenderFrame);
      kassStreamRenderFrame = null;
    }
    // 最终只更新当前消息和输入区，避免流结束时整页再次闪动。
    finalizeKassAgentStreamDom(pendingAnswerId);
  }
}

/**
 * 清理成本监控实测回放的全部计时器。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function cancelCostMonitorReplay() {
  costMonitorReplayTimers.forEach((timerId) => window.clearTimeout(timerId));
  costMonitorReplayTimers = [];
}

/**
 * 把当前成本运行状态恢复成“等待发送”。
 *
 * 切换模式、Chatflow 或回放场景时使用，历史对话仍保留，但当前事件和账单清空，
 * 防止上一轮明细被误认为新选择下的账单。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function resetCostMonitorCurrentRun() {
  const monitor = state.costMonitor;
  cancelCostMonitorReplay();
  monitor.status = "idle";
  monitor.startedAt = null;
  monitor.endedAt = null;
  monitor.activeRunId = "";
  monitor.workflowRunId = "";
  monitor.timeline = [];
  monitor.costItems = [];
  monitor.checksum = null;
  monitor.error = "";
}

/**
 * 只重画成本账单区域，并重新绑定单价编辑器。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常；页面已经切走时直接返回。
 */
function refreshCostMonitorLedgerDom() {
  if (state.activeMain !== "admin-ai-cost") {
    return;
  }

  const ledger = document.querySelector("[data-cost-monitor-ledger]");
  if (!ledger) {
    return;
  }

  ledger.innerHTML = renderCostMonitorLedger();
  bindCostMonitorPriceControls();
}

/**
 * 用当前内存状态刷新聊天、事件带、成本账单和运行状态。
 *
 * 为什么不调用 renderApp：流事件可能非常密集，整页重建会让输入区、侧栏和动画持续闪烁。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function refreshCostMonitorRunDom() {
  if (state.activeMain !== "admin-ai-cost") {
    return;
  }

  const monitor = state.costMonitor;
  const chatList = document.querySelector("[data-cost-monitor-chat-list]");
  const timeline = document.querySelector("[data-cost-monitor-timeline]");
  const statusNode = document.querySelector("[data-cost-monitor-run-status]");
  const sendButton = document.querySelector("[data-cost-monitor-send]");
  const draftInput = document.querySelector("[data-cost-monitor-draft]");
  const scenarioSelect = document.querySelector("[data-cost-monitor-scenario]");
  const sourceSelect = document.querySelector("[data-cost-monitor-source]");
  const modelSelect = document.querySelector("[data-cost-monitor-model]");
  const status = getCostMonitorStatusMeta();

  if (chatList) {
    chatList.innerHTML = renderCostMonitorTurns();
    chatList.scrollTop = chatList.scrollHeight;
  }
  if (timeline) {
    timeline.innerHTML = renderCostMonitorTimeline();
    timeline.scrollTop = timeline.scrollHeight;
  }
  if (statusNode) {
    statusNode.className = `cost-monitor-run-status ${status.tone}`;
    statusNode.innerHTML = `
      <span class="cost-monitor-status-dot" aria-hidden="true"></span>
      <div><strong>${escapeHtml(status.label)}</strong><small>${escapeHtml(status.detail)}</small></div>
    `;
  }
  if (sendButton) {
    sendButton.disabled = monitor.status === "running" || !monitor.draft.trim();
    sendButton.textContent = monitor.status === "running"
      ? "正在接收事件…"
      : monitor.mode === "live" ? "发送到 Chatflow" : "开始实测回放";
  }
  if (draftInput) {
    draftInput.disabled = monitor.status === "running";
  }
  // 流式过程中锁住路由条件，完成后立即恢复场景/Chatflow 选择。
  // 回放使用的是已核对记录，模型属于记录证据，所以回放模式下始终不可手改。
  if (scenarioSelect) {
    scenarioSelect.disabled = monitor.status === "running";
  }
  if (sourceSelect) {
    sourceSelect.disabled = monitor.status === "running";
  }
  if (modelSelect) {
    modelSelect.disabled = monitor.mode === "replay" || monitor.status === "running";
  }

  refreshCostMonitorLedgerDom();
}

/**
 * 把代理或回放事件应用到成本页，并兼容旧代理只在 done 返回最终 trace 的情况。
 *
 * @param {object} event - 浏览器收到的归一化 SSE 事件。
 * @param {number} [receivedAt=Date.now()] - 事件到达时间。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function applyCostMonitorStreamEvent(event, receivedAt = Date.now()) {
  const monitor = state.costMonitor;

  if (event?.type === "done") {
    const result = event.result && typeof event.result === "object" ? event.result : {};
    const finalItems = Array.isArray(result?.billing_trace?.cost_items) ? result.billing_trace.cost_items : [];
    finalItems.forEach((item) => {
      window.YD_COST_MONITOR.applyEvent(monitor, { type: "cost_update", item }, receivedAt);
    });

    const usage = result?.metadata?.usage;
    if (usage && !monitor.checksum) {
      window.YD_COST_MONITOR.applyEvent(monitor, {
        type: "cost_checksum",
        usage,
        note: "最终 usage 只核对 tokens，不把可能混币种的总价直接入账"
      }, receivedAt);
    }

    const activeTurn = window.YD_COST_MONITOR.getActiveTurn(monitor);
    if (result.answer && activeTurn && !activeTurn.answer) {
      window.YD_COST_MONITOR.applyEvent(monitor, { type: "answer_replace", answer: result.answer }, receivedAt);
    }
  }

  window.YD_COST_MONITOR.applyEvent(monitor, event, receivedAt);
  refreshCostMonitorRunDom();
}

/**
 * 启动一轮已验证真实记录的可视化回放。
 *
 * @param {string} question - 页面本轮显示的用户输入；不会发送到 Dify。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function runCostMonitorReplay(question) {
  const monitor = state.costMonitor;
  const scenario = window.YD_COST_MONITOR.getReplayScenario(monitor.replayScenario);
  const startedAt = Date.now();

  cancelCostMonitorReplay();
  monitor.source = scenario.source;
  monitor.modelKey = scenario.modelKey;
  window.YD_COST_MONITOR.beginRun(monitor, question, startedAt);
  console.info("[reverse-yingdan] AI 成本实测回放开始", { scenario: scenario.id });
  renderApp();

  window.YD_COST_MONITOR.getReplayEvents(scenario.id).forEach((entry) => {
    const timerId = window.setTimeout(() => {
      applyCostMonitorStreamEvent(entry.event, startedAt + entry.delay);
      if (entry.event.type === "done") {
        costMonitorReplayTimers = [];
        console.info("[reverse-yingdan] AI 成本实测回放完成", { scenario: scenario.id });
      }
    }, entry.delay);
    costMonitorReplayTimers.push(timerId);
  });
}

/**
 * 使用已保存的服务端 Key 发起真实 Chatflow，并逐条消费成本事件。
 *
 * @param {string} question - 用户本轮输入。
 * @returns {Promise<void>} 请求结束后完成本轮结算状态。
 * @throws {Error} 网络和上游异常会转成页面 error 事件，不继续抛出。
 */
async function runCostMonitorLive(question) {
  const monitor = state.costMonitor;
  const featureId = getCostMonitorConfigFeatureId();
  const config = getDifyFeatureConfig(featureId);

  if (!config.hasKey) {
    monitor.showConnection = true;
    config.error = "请先保存当前 Chatflow 的 App API Key。";
    renderApp();
    document.querySelector("[data-cost-monitor-config-key]")?.focus();
    return;
  }

  const startedAt = Date.now();
  let doneReceived = false;
  window.YD_COST_MONITOR.beginRun(monitor, question, startedAt);
  console.info("[reverse-yingdan] AI 成本真实调用开始", {
    featureId,
    source: monitor.source,
    selectedModel: monitor.modelKey,
    hasSkillKey: Boolean(config.skillKey)
  });
  renderApp();

  try {
    const response = await fetch(getDifyProxyEndpoint("chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feature_id: featureId,
        query: question,
        conversation_id: monitor.conversationIds[monitor.source] || "",
        user: `yd-cost-monitor-${monitor.source}`,
        // skill_key 仍由后端读取已保存配置并注入，浏览器只传允许用户选择的模型路由。
        inputs: config.skillKey ? { model_key: monitor.modelKey } : {},
        files: []
      })
    });
    const contentType = response.headers.get("content-type") || "";

    if (!response.ok) {
      const rawError = await response.text();
      let payload = null;
      try {
        payload = rawError ? JSON.parse(rawError) : null;
      } catch (_error) {
        payload = null;
      }
      throw new Error(payload?.message || rawError || `Chatflow 代理返回 HTTP ${response.status}`);
    }

    if (contentType.includes("text/event-stream")) {
      if (!response.body) {
        throw new Error("Chatflow 代理没有返回可读取的事件流。");
      }

      const parser = window.YD_DIFY.createDifySseEventParser((event) => {
        if (event?.type === "done") {
          doneReceived = true;
        }
        applyCostMonitorStreamEvent(event);
      });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }));
      }

      const remaining = decoder.decode();
      if (remaining) parser.push(remaining);
      parser.finish();

      if (!doneReceived) {
        throw new Error("Chatflow 事件流提前结束，未收到完成事件。");
      }
    } else {
      const rawText = await response.text();
      let payload = null;
      try {
        payload = rawText ? JSON.parse(rawText) : null;
      } catch (_error) {
        payload = null;
      }
      if (!payload) {
        throw new Error("Chatflow 代理返回了无法识别的响应。");
      }
      applyCostMonitorStreamEvent({ type: "done", result: payload });
      doneReceived = true;
    }

    console.info("[reverse-yingdan] AI 成本真实调用完成", {
      featureId,
      workflowRunId: monitor.workflowRunId,
      costItemCount: monitor.costItems.length
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chatflow 调用失败，请稍后重试。";
    console.error("[reverse-yingdan] AI 成本真实调用失败", { featureId, message });
    applyCostMonitorStreamEvent({ type: "error", message });
  }
}

/**
 * 根据当前模式发送或回放一轮消息。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function sendCostMonitorDraft() {
  const monitor = state.costMonitor;
  const question = String(monitor.draft || "").trim();

  if (monitor.status === "running") {
    return;
  }
  if (!question) {
    showToast("请先输入这一轮要发送的话。");
    document.querySelector("[data-cost-monitor-draft]")?.focus();
    return;
  }

  if (monitor.mode === "live") {
    void runCostMonitorLive(question);
    return;
  }

  runCostMonitorReplay(question);
}

/**
 * 绑定成本单价编辑器；账单局部重绘后可重复调用。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function bindCostMonitorPriceControls() {
  const monitor = state.costMonitor;
  const toggle = document.querySelector("[data-cost-monitor-toggle-prices]");
  if (toggle && toggle.dataset.costMonitorBound !== "true") {
    toggle.dataset.costMonitorBound = "true";
    toggle.addEventListener("click", () => {
      monitor.showPrices = !monitor.showPrices;
      refreshCostMonitorLedgerDom();
    });
  }

  document.querySelectorAll("[data-cost-monitor-price]").forEach((input) => {
    if (input.dataset.costMonitorBound === "true") return;
    input.dataset.costMonitorBound = "true";
    input.addEventListener("change", () => {
      const priceId = input.getAttribute("data-cost-monitor-price");
      if (!priceId || !monitor.prices[priceId]) return;
      monitor.prices[priceId].amount = Math.max(0, Number(input.value) || 0);
      refreshCostMonitorLedgerDom();
    });
  });

  document.querySelectorAll("[data-cost-monitor-price-currency]").forEach((select) => {
    if (select.dataset.costMonitorBound === "true") return;
    select.dataset.costMonitorBound = "true";
    select.addEventListener("change", () => {
      const priceId = select.getAttribute("data-cost-monitor-price-currency");
      if (!priceId || !monitor.prices[priceId]) return;
      monitor.prices[priceId].currency = select.value === "USD" ? "USD" : "RMB";
      refreshCostMonitorLedgerDom();
    });
  });

  document.querySelectorAll("[data-cost-monitor-global-price]").forEach((input) => {
    if (input.dataset.costMonitorBound === "true") return;
    input.dataset.costMonitorBound = "true";
    input.addEventListener("change", () => {
      const field = input.getAttribute("data-cost-monitor-global-price");
      if (!field || !["exchangeUsdRmb", "marginPercent", "vbeansPerRmb"].includes(field)) return;
      const max = field === "marginPercent" ? 95 : Number.POSITIVE_INFINITY;
      monitor[field] = Math.min(max, Math.max(0, Number(input.value) || 0));
      refreshCostMonitorLedgerDom();
    });
  });
}

/**
 * 绑定 AI 成本监控页的模式、配置、输入和发送交互。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function bindCostMonitorEvents() {
  if (state.activeMain !== "admin-ai-cost") {
    return;
  }

  const monitor = state.costMonitor;

  document.querySelectorAll("[data-cost-monitor-mode]").forEach((button) => {
    if (button.dataset.costMonitorBound === "true") return;
    button.dataset.costMonitorBound = "true";
    button.addEventListener("click", () => {
      const mode = button.getAttribute("data-cost-monitor-mode");
      if (mode !== "replay" && mode !== "live") return;
      resetCostMonitorCurrentRun();
      monitor.mode = mode;
      if (mode === "replay") {
        const scenario = window.YD_COST_MONITOR.getReplayScenario(monitor.replayScenario);
        monitor.source = scenario.source;
        monitor.modelKey = scenario.modelKey;
        monitor.draft = scenario.prompt;
      }
      renderApp();
    });
  });

  const sourceSelect = document.querySelector("[data-cost-monitor-source]");
  sourceSelect?.addEventListener("change", () => {
    resetCostMonitorCurrentRun();
    monitor.source = sourceSelect.value === "kb" ? "kb" : "no-kb";
    renderApp();
  });

  const scenarioSelect = document.querySelector("[data-cost-monitor-scenario]");
  scenarioSelect?.addEventListener("change", () => {
    const scenario = window.YD_COST_MONITOR.getReplayScenario(scenarioSelect.value);
    resetCostMonitorCurrentRun();
    monitor.replayScenario = scenario.id;
    monitor.source = scenario.source;
    monitor.modelKey = scenario.modelKey;
    monitor.draft = scenario.prompt;
    renderApp();
  });

  const modelSelect = document.querySelector("[data-cost-monitor-model]");
  modelSelect?.addEventListener("change", () => {
    monitor.modelKey = modelSelect.value === "gemini-3.5-flash" ? "gemini-3.5-flash" : "deepseek-v4-pro";
    refreshCostMonitorLedgerDom();
  });

  const connectionToggle = document.querySelector("[data-cost-monitor-toggle-connection]");
  connectionToggle?.addEventListener("click", () => {
    monitor.showConnection = !monitor.showConnection;
    renderApp();
  });

  const featureId = getCostMonitorConfigFeatureId();
  const config = getDifyFeatureConfig(featureId);
  const keyInput = document.querySelector("[data-cost-monitor-config-key]");
  const skillInput = document.querySelector("[data-cost-monitor-config-skill]");
  keyInput?.addEventListener("input", () => {
    config.apiKeyDraft = keyInput.value;
    config.error = "";
  });
  skillInput?.addEventListener("input", () => {
    config.skillKeyDraft = skillInput.value;
    config.error = "";
  });
  document.querySelector("[data-cost-monitor-config-save]")?.addEventListener("click", () => {
    config.appType = "chatflow";
    void saveDifyFeatureConfig(featureId);
  });

  const draftInput = document.querySelector("[data-cost-monitor-draft]");
  const sendButton = document.querySelector("[data-cost-monitor-send]");
  draftInput?.addEventListener("input", () => {
    monitor.draft = draftInput.value;
    if (sendButton) {
      sendButton.disabled = monitor.status === "running" || !monitor.draft.trim();
    }
  });
  draftInput?.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      sendCostMonitorDraft();
    }
  });
  sendButton?.addEventListener("click", sendCostMonitorDraft);

  bindCostMonitorPriceControls();
}

/**
 * 给客户跟进区域中的待办复选框绑定一次状态切换事件。
 *
 * 异步恢复客户数据时会原位补充新的跟进与待办节点，因此这里支持传入局部根节点。
 * `__kassTaskToggleBound` 防止同一个复选框重复绑定，避免一次点击执行多次状态更新。
 *
 * @param {Document | Element} [root=document] - 需要扫描的页面或客户局部区域。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function bindKassTaskToggleEvents(root = document) {
  root.querySelectorAll("[data-kass-task-toggle]").forEach((checkbox) => {
    if (checkbox.__kassTaskToggleBound) {
      return;
    }

    checkbox.__kassTaskToggleBound = true;
    checkbox.addEventListener("change", () => {
      const taskId = checkbox.getAttribute("data-kass-task-toggle");

      if (!taskId) {
        return;
      }

      if (checkbox.checked) {
        state.kassCompletedTaskIds.add(taskId);
      } else {
        state.kassCompletedTaskIds.delete(taskId);
      }

      console.log("[reverse-yingdan] 已更新跟进关联待办状态", {
        customerId: state.activeCustomerId,
        taskId,
        completed: checkbox.checked
      });

      // 这里只局部更新当前待办，避免整页重绘把用户正在展开的历史记录重新折叠。
      const taskRow = checkbox.closest(".kass-linked-task");
      const statusNode = taskRow?.querySelector(".kass-linked-task-copy small");
      taskRow?.classList.toggle("completed", checkbox.checked);
      if (statusNode) {
        const status = checkbox.getAttribute("data-kass-task-status") || "待处理";
        const dueDate = checkbox.getAttribute("data-kass-task-due") || "待定";
        statusNode.textContent = checkbox.checked ? "已完成" : `${status} · 截止 ${dueDate}`;
      }
    });
  });
}

/**
 * 绑定当前页面所有静态原型交互。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function bindEvents() {
  const app = document.querySelector("#app");
  if (app && !app.dataset.customerDevDelegated) {
    app.dataset.customerDevDelegated = "true";
    app.addEventListener("click", handleCustomerDevClick);
    app.addEventListener("keydown", handleCustomerDevKeydown);
  }

  document.querySelectorAll("[data-admin-route]").forEach((node) => {
    node.addEventListener("click", (event) => {
      const main = node.getAttribute("data-admin-route");

      if (!main) {
        return;
      }

      event.preventDefault();
      if (main !== "admin-ai-cost") {
        cancelCostMonitorReplay();
      }
      state.activeMain = main;
      state.adminDialog = null;
      state.adminMenuOpen = false;
      renderApp();
    });
  });

  document.querySelectorAll("[data-admin-menu-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      state.adminMenuOpen = !state.adminMenuOpen;
      renderApp();
    });
  });

  bindAdminDialogOpenControls();

  document.querySelectorAll("[data-admin-close]").forEach((node) => {
    node.addEventListener("click", (event) => {
      const isBackdrop = node.classList.contains("admin-dialog-backdrop");
      if (isBackdrop && event.target !== node) {
        return;
      }

      closeAdminDialog();
    });
  });

  document.querySelectorAll(".admin-dialog").forEach((node) => {
    node.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  });

  bindAdminActionControls();
  bindCostMonitorEvents();

  document.querySelectorAll("[data-admin-invite-generate]").forEach((button) => {
    button.addEventListener("click", () => {
      const credit = document.querySelector("[data-admin-invite-credit]")?.value || "500";
      const count = document.querySelector("[data-admin-invite-count]")?.value || "20";
      const owner = document.querySelector("[data-admin-invite-owner]")?.value || "销售A";
      const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
      state.adminInvitePreview = `YD-TRY-${suffix} · ${credit} 积分 · ${count} 个 · ${owner}`;
      showToast("已模拟生成邀请码批次。");
      renderApp();
    });
  });

  document.querySelectorAll("[data-user-preview-time-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const preset = button.getAttribute("data-user-preview-time-preset");

      if (preset !== "today" && preset !== "week" && preset !== "month") {
        return;
      }

      setUserPreviewTimePreset(preset);
      renderApp();
    });
  });

  document.querySelectorAll("[data-user-preview-date]").forEach((input) => {
    input.addEventListener("change", () => {
      const type = input.getAttribute("data-user-preview-date");

      if (type === "start") {
        state.userPreviewStartDate = input.value;
      }

      if (type === "end") {
        state.userPreviewEndDate = input.value;
      }

      state.userPreviewTimePreset = "custom";
    });
  });

  document.querySelectorAll("[data-user-preview-apply-date]").forEach((button) => {
    button.addEventListener("click", () => {
      applyUserPreviewCustomDateRange();
      showToast(`已应用时间范围：${getUserPreviewTimeRangeLabel()}`);
      renderApp();
    });
  });

  bindUserPreviewReportControls();

  document.querySelectorAll("[data-business-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.getAttribute("data-business-tab");
      if (!next) return;
      state.activeBusinessTab = next;
      renderApp();
    });
  });

  document.querySelectorAll("[data-business-role]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const role = btn.getAttribute("data-business-role");
      if (role !== "admin" && role !== "ops" && role !== "support") return;
      state.businessRole = role;
      renderApp();
    });
  });

  document.querySelectorAll("[data-business-time-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const preset = btn.getAttribute("data-business-time-preset");
      if (preset !== "today" && preset !== "week" && preset !== "month") return;
      state.businessTimePreset = preset;
      renderApp();
    });
  });

  document.querySelectorAll("[data-account-space-toggle]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      state.accountSpaceSwitcherOpen = !state.accountSpaceSwitcherOpen;
      const popover = document.querySelector(".account-popover");
      const head = popover?.querySelector(".account-pop-head");
      const flyout = popover?.querySelector(".account-pop-space-flyout");
      popover?.classList.toggle("switcher-open", state.accountSpaceSwitcherOpen);
      head?.classList.toggle("open", state.accountSpaceSwitcherOpen);
      if (flyout) {
        flyout.setAttribute("aria-hidden", state.accountSpaceSwitcherOpen ? "false" : "true");
      }
    });
  });

  document.querySelectorAll("[data-account-go][data-href]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const target = button.getAttribute("data-href");
      state.popup = null;
      if (target) {
        window.location.hash = target;
      } else {
        renderApp();
      }
    });
  });

  document.querySelectorAll("[data-main]").forEach((button) => {
    button.addEventListener("click", () => {
      const previousMain = state.activeMain;
      state.activeMain = button.getAttribute("data-main") || "sales-prep";
      state.popup = null;
      state.generatedResult = "";

      // 从其它业务入口进入客户 Kass 时默认打开现有“重点推进”版；
      // 只有在线上复刻页内切换 A/B 时才继续保持线上版，避免用户下次误入错误版本。
      if (!state.activeMain.startsWith("customer-kass") || !previousMain.startsWith("customer-kass")) {
        state.activeKassView = "workbench";
      }

      if (state.activeMain === "sales-prep") {
        state.activeSalesTab = "flow";
      }

      if (state.activeMain.startsWith("customer-kass")) {
        const group = getActiveKassGroup();
        if (state.activeKassView === "workbench") {
          state.kassWorkbenchGroupId = "customer-kass-a";
          state.kassExpandedGrades = new Set(["customer-kass-a"]);
          state.expandedGroups = new Set(["customer-kass"]);
        }
        const customerGroup = state.activeKassView === "workbench" ? getKassWorkbenchGroup() : group;
        state.activeCustomerId = customerGroup.customers[0]?.id || null;
        state.activeKassTab = "conversation";
        state.kassAgentDraft = "";
        state.kassAgentMessages = [];
        state.kassAgentThinking = false;
        state.kassRecordFormOpen = false;
        state.kassResearchOpen = false;
        state.kassCompletedTaskIds.clear();
        state.kassAssistantOpen = false;
        state.kassDirectoryGroupId = null;
      }

      renderApp();
    });
  });

  document.querySelectorAll("[data-kass-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextView = button.getAttribute("data-kass-view");

      if (nextView !== "workbench" && nextView !== "online") {
        return;
      }

      state.activeKassView = nextView;
      state.popup = null;
      renderApp();
    });
  });

  document.querySelectorAll("[data-toggle-group]").forEach((button) => {
    button.addEventListener("click", () => {
      const groupId = button.getAttribute("data-toggle-group");

      if (!groupId) {
        return;
      }

      if (state.expandedGroups.has(groupId)) {
        state.expandedGroups.delete(groupId);
      } else {
        state.expandedGroups.add(groupId);
      }

      renderApp();
    });
  });

  document.querySelectorAll("[data-kass-workbench-grade]").forEach((button) => {
    button.addEventListener("click", () => {
      const groupId = button.getAttribute("data-kass-workbench-grade");
      const group = KASS_GROUPS.find((item) => item.id === groupId);

      if (!group) {
        return;
      }

      if (isKassComparisonView()) {
        // B 版使用手风琴式子菜单：同一时间只展开一个等级，保证 A/B/C/D
        // 在常见笔记本高度下都能看到，不让长客户名单把其它等级推到屏幕外。
        state.kassExpandedGrades = state.kassExpandedGrades.has(groupId)
          ? new Set()
          : new Set([groupId]);
      }

      state.kassWorkbenchGroupId = groupId;
      state.activeCustomerId = group.customers[0]?.id || null;
      state.kassCustomerDirectoryOpen = false;
      state.kassDirectoryGroupId = null;
      state.kassAgentDraft = "";
      state.kassAgentMessages = [];
      state.kassAgentThinking = false;
      state.kassRecordFormOpen = false;
      state.kassResearchOpen = false;
      state.kassCompletedTaskIds.clear();
      console.log("[reverse-yingdan] 当前方案已切换客户等级", {
        version: state.activeMain,
        groupId
      });
      renderApp();
    });
  });

  document.querySelectorAll("[data-kass-directory-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const requestedGroup = button.getAttribute("data-kass-directory-open");

      if (requestedGroup && requestedGroup !== "true" && KASS_GROUPS.some((group) => group.id === requestedGroup)) {
        state.kassDirectoryGroupId = requestedGroup;

        if (isKassWorkbenchView()) {
          const workbenchGroup = KASS_GROUPS.find((group) => group.id === requestedGroup);
          state.kassWorkbenchGroupId = requestedGroup;
          state.activeCustomerId = workbenchGroup?.customers[0]?.id || null;
          if (isKassComparisonView()) {
            state.kassExpandedGrades = new Set([requestedGroup]);
          }
        } else {
          state.activeMain = requestedGroup;
          const group = getActiveKassGroup();
          state.activeCustomerId = group.customers[0]?.id || null;
          state.kassExpandedGrades.add(requestedGroup);
        }
      }

      state.kassCustomerDirectoryOpen = true;
      state.kassCustomerQuery = "";
      console.log("[reverse-yingdan] 已打开客户库浮层", { group: state.activeMain });
      renderApp();
    });
  });

  document.querySelectorAll("[data-kass-directory-close]").forEach((node) => {
    node.addEventListener("click", (event) => {
      const closeType = node.getAttribute("data-kass-directory-close");
      if (closeType === "backdrop" && event.target !== node) {
        return;
      }
      state.kassCustomerDirectoryOpen = false;
      state.kassDirectoryGroupId = null;
      renderApp();
    });
  });

  document.querySelectorAll("[data-kass-directory-search]").forEach((input) => {
    input.addEventListener("input", () => {
      state.kassCustomerQuery = input.value;
      renderApp();
      const nextInput = document.querySelector("[data-kass-directory-search]");
      nextInput?.focus();
      if (typeof nextInput?.setSelectionRange === "function") {
        nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
      }
    });
  });

  document.querySelectorAll("[data-sales-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeSalesTab = button.getAttribute("data-sales-tab") || "flow";
      state.popup = null;
      renderApp();
    });
  });

  document.querySelectorAll("[data-stage]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeStageId = button.getAttribute("data-stage") || "lead";
      state.popup = null;
      // 切阶段不自动续命 AI 卡：关掉、取消正在排队的"出答案"计时器。
      // 用户想看新阶段的 AI，应该自己再点一次"问 AI"。
      if (state.flowAi.open) {
        cancelFlowAiSimulation();
        state.flowAi = { open: false, phase: "idle", followUp: "" };
      }
      renderApp();
    });
  });

  document.querySelectorAll("[data-company-module]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeCompanyModule = button.getAttribute("data-company-module") || "profile";
      state.popup = null;
      renderApp();
    });
  });

  document.querySelectorAll("[data-product]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedProductId = button.getAttribute("data-product") || "solar-kit";
      state.popup = null;
      renderApp();
    });
  });

  document.querySelectorAll("[data-product-row]").forEach((row) => {
    row.addEventListener("click", () => {
      state.selectedProductId = row.getAttribute("data-product-row") || "solar-kit";
      state.popup = null;
      renderApp();
    });
  });

  document.querySelectorAll("[data-case-category]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeCaseCategory = button.getAttribute("data-case-category") || "client";
      state.popup = null;
      renderApp();
    });
  });

  document.querySelectorAll("[data-case-tag]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeCaseTag = button.getAttribute("data-case-tag") || "全部";
      state.popup = null;
      renderApp();
    });
  });

  document.querySelectorAll("[data-case-search]").forEach((input) => {
    input.addEventListener("input", () => {
      state.caseSearchQuery = input.value;
      renderApp();
      focusCaseSearch();
    });
  });

  document.querySelectorAll("[data-prep-upload]").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.getAttribute("data-prep-upload") || "资料";
      state.popup = null;
      renderApp();
      showToast(`${type} 上传是原型入口，不读取本地文件。`);
      pulseWorkbench();
    });
  });

  document.querySelectorAll("[data-customer]").forEach((button) => {
    button.addEventListener("click", () => {
      const customerGroup = button.getAttribute("data-customer-group");
      const targetGroup = KASS_GROUPS.find((group) => group.id === customerGroup);
      const isWorkbenchCustomer = button.hasAttribute("data-kass-workbench-customer") && isKassWorkbenchView();

      if (customerGroup && targetGroup && isWorkbenchCustomer) {
        /*
         * 方案路由与客户等级必须完全独立：
         * - activeMain 只保留当前 A / B 界面方案。
         * - kassWorkbenchGroupId 只记录 A / B / C / D 客户等级。
         *
         * 这样在方案 A 中点击 B 级客户，只会换客户数据，不会把页面跳成方案 B。
         */
        state.kassWorkbenchGroupId = customerGroup;
        if (isKassComparisonView()) {
          state.kassExpandedGrades = new Set([customerGroup]);
        }
      } else if (customerGroup && targetGroup) {
        // 线上复刻页仍以路由代表客户等级，保留原有独立查看方式。
        state.activeMain = customerGroup;
        state.kassExpandedGrades.add(customerGroup);
      }

      state.activeCustomerId = button.getAttribute("data-customer")
        || (isWorkbenchCustomer ? targetGroup?.customers[0]?.id : getActiveKassGroup().customers[0]?.id)
        || null;
      const nextCustomer = isWorkbenchCustomer
        ? targetGroup?.customers.find((customer) => customer.id === state.activeCustomerId) || targetGroup?.customers[0]
        : getActiveKassCustomer();
      state.activeCustomerPanel = "overview";
      state.activeKassTab = "conversation";
      state.customerDraft = nextCustomer?.inquiry || "";
      state.isCustomerGenerating = false;
      state.customerResult = "";
      state.kassCustomerDirectoryOpen = false;
      state.kassDirectoryGroupId = null;
      state.kassAgentDraft = "";
      state.kassAgentMessages = [];
      state.kassAgentThinking = false;
      state.kassRecordFormOpen = false;
      state.kassResearchOpen = false;
      state.kassCompletedTaskIds.clear();
      state.popup = null;
      renderApp();
    });
  });

  document.querySelectorAll("[data-kass-agent-input]").forEach((input) => {
    input.addEventListener("input", () => {
      state.kassAgentDraft = input.value;
      const sendButton = document.querySelector("[data-kass-agent-send]");
      if (sendButton) {
        sendButton.disabled = !state.kassAgentDraft.trim() || state.kassAgentThinking;
      }
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendKassAgentDraft();
      }
    });
  });

  document.querySelectorAll("[data-kass-agent-send]").forEach((button) => {
    button.addEventListener("click", sendKassAgentDraft);
  });

  document.querySelectorAll("[data-kass-record-open]").forEach((button) => {
    button.addEventListener("click", () => {
      state.kassRecordFormOpen = true;
      console.log("[reverse-yingdan] 已打开新增客户跟进记录表单", { customerId: state.activeCustomerId });
      renderApp();
    });
  });

  document.querySelectorAll("[data-kass-research-open]").forEach((button) => {
    button.addEventListener("click", () => {
      state.kassResearchOpen = true;
      console.log("[reverse-yingdan] 已打开客户详细档案", { customerId: state.activeCustomerId });
      renderApp();
    });
  });

  document.querySelectorAll("[data-kass-research-close]").forEach((node) => {
    node.addEventListener("click", (event) => {
      const closeType = node.getAttribute("data-kass-research-close");

      // 点击抽屉正文时不能误关；只有真正点击遮罩空白处才关闭。
      if (closeType === "backdrop" && event.target !== node) {
        return;
      }

      state.kassResearchOpen = false;
      console.log("[reverse-yingdan] 已关闭客户详细档案", { customerId: state.activeCustomerId });
      renderApp();
    });
  });

  bindKassTaskToggleEvents();

  document.querySelectorAll("[data-kass-record-cancel]").forEach((button) => {
    button.addEventListener("click", () => {
      state.kassRecordFormOpen = false;
      renderApp();
    });
  });

  document.querySelectorAll("[data-kass-record-save]").forEach((button) => {
    button.addEventListener("click", () => {
      state.kassRecordFormOpen = false;
      renderApp();
      showToast("跟进记录已保存为本地原型反馈。未写入真实客户数据。");
      console.log("[reverse-yingdan] 已模拟保存客户跟进记录", { customerId: state.activeCustomerId });
    });
  });

  document.querySelectorAll("[data-kass-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextTab = button.getAttribute("data-kass-tab");
      if (!["conversation", "profile", "followups"].includes(nextTab)) {
        return;
      }
      state.activeKassTab = nextTab;
      state.kassResearchOpen = false;
      state.popup = null;
      renderApp();
    });
  });

  document.querySelectorAll("[data-kass-assistant]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.getAttribute("data-kass-assistant");
      state.kassAssistantOpen = action === "toggle" ? !state.kassAssistantOpen : false;
      state.popup = null;
      renderApp();
    });
  });

  document.querySelectorAll("[data-customer-panel]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeCustomerPanel = button.getAttribute("data-customer-panel") || "overview";
      state.popup = null;
      renderApp();
    });
  });

  document.querySelectorAll("[data-drawer]").forEach((button) => {
    button.addEventListener("click", () => {
      state.drawer = button.getAttribute("data-drawer");
      renderApp();

      if (state.drawer === "teaching") {
        showToast("无教学视频资源。");
      }
    });
  });

  document.querySelectorAll("[data-popup]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const popup = button.getAttribute("data-popup");
      if (popup === "inviteRedeem" && state.popup !== "inviteRedeem") {
        state.inviteCodeDraft = "";
        state.inviteRedeemResult = "";
      }
      state.popup = state.popup === popup ? null : popup;
      renderApp();
    });
  });

  document.querySelectorAll("[data-close-popup]").forEach((node) => {
    node.addEventListener("click", (event) => {
      if (event.target !== node) {
        return;
      }

      state.popup = null;
      renderApp();
    });
  });

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      state.popup = null;
      renderApp();
    });
  });

  document.querySelectorAll("[data-invite-code-input]").forEach((input) => {
    input.addEventListener("input", () => {
      state.inviteCodeDraft = input.value.toUpperCase();
      state.inviteRedeemResult = "";
      const submit = document.querySelector("[data-invite-redeem-submit]");
      const canRedeem = state.inviteCodeDraft.trim().length >= 4;
      if (submit) {
        submit.disabled = !canRedeem;
        submit.classList.toggle("enabled", canRedeem);
      }
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        const submit = document.querySelector("[data-invite-redeem-submit]");
        if (submit && !submit.disabled) {
          submit.click();
        }
      }
    });
  });

  document.querySelectorAll("[data-invite-redeem-submit]").forEach((button) => {
    button.addEventListener("click", () => {
      const code = state.inviteCodeDraft.trim() || "YD-TRY-8K2P";
      state.inviteCodeDraft = code;
      state.inviteRedeemResult = `已模拟兑换 ${code}，获得 500 积分`;
      showToast("邀请码兑换成功，已模拟增加 500 积分。");
      renderApp();
    });
  });

  // 升级 modal 里点 "立即升级" / "联系销售" — 是 <a>，浏览器会跟随 hash 跳转，
  // hashchange 会触发 applyRoute；这里额外做一次"立刻关 modal"，避免 a 上的 stopPropagation 影响动画。
  document.querySelectorAll("[data-upgrade-go]").forEach((link) => {
    link.addEventListener("click", () => {
      state.popup = null;
    });
  });

  document.querySelectorAll("[data-pay-back]").forEach((link) => {
    link.addEventListener("click", () => {
      state.payPhase = "form";
    });
  });

  document.querySelectorAll("[data-pay-cycle]").forEach((button) => {
    button.addEventListener("click", () => {
      state.payCycle = button.getAttribute("data-pay-cycle") || "annual";
      renderApp();
    });
  });

  document.querySelectorAll("[data-pay-method]").forEach((button) => {
    button.addEventListener("click", () => {
      state.payMethod = button.getAttribute("data-pay-method") || "wechat";
      renderApp();
    });
  });

  document.querySelectorAll("[data-pay-agree]").forEach((input) => {
    input.addEventListener("change", () => {
      state.payAgreed = input.checked;
      const submit = document.querySelector("[data-pay-submit]");
      if (submit) submit.disabled = !input.checked;
    });
  });

  // 老的 data-pay-submit 替换为 <a href> 自然跳转到 /checkout。这里只拦截一下"未勾选协议"。
  document.querySelectorAll("[data-pay-go-checkout]").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (!state.payAgreed) {
        event.preventDefault();
        showToast("请先勾选订阅协议");
      }
    });
  });

  // 支付界面"我已完成支付" / "确认支付" → /done。
  document.querySelectorAll("[data-pay-mark-paid]").forEach((button) => {
    button.addEventListener("click", () => {
      const planId = state.activeMain.includes("pro") ? "pro" : "team";
      window.location.hash = `#/upgrade/pay/${planId}/done`;
    });
  });

  // 启动一个简单的二维码倒计时（如果 checkout 页有这个节点）。
  const countdownEl = document.querySelector("[data-pay-countdown]");
  if (countdownEl) {
    startPayCountdown(countdownEl);
  }

  document.querySelectorAll("[data-popup-surface]").forEach((node) => {
    node.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  });

  document.querySelectorAll("[data-history-search]").forEach((input) => {
    input.addEventListener("input", () => {
      state.historySearchQuery = input.value;
      renderApp();
      focusHistorySearch();
    });
  });

  document.querySelectorAll("[data-model]").forEach((button) => {
    button.addEventListener("click", () => {
      const requestedModel = button.getAttribute("data-model") || DIFY_CHAT_MODELS[0].value;
      state.selectedModel = getDifyChatModel(requestedModel).value;
      state.popup = null;
      renderApp();
      showToast(`已选择 ${getDifyChatModel(state.selectedModel).label}`);
    });
  });

  document.querySelectorAll("[data-chat-input]").forEach((textarea) => {
    textarea.addEventListener("input", () => {
      state.chatDraft = textarea.value;
      syncSendButton();
    });
  });

  document.querySelectorAll("[data-dify-app-type]").forEach((select) => {
    select.addEventListener("change", () => {
      const config = getDifyFeatureConfig();
      config.appType = select.value === "chatflow" ? "chatflow" : "dialogue";
      config.error = "";
    });
  });

  document.querySelectorAll("[data-dify-api-key]").forEach((input) => {
    input.addEventListener("input", () => {
      const nextKey = normalizeDifyApiKey(input.value);
      const config = getDifyFeatureConfig();
      config.apiKeyDraft = nextKey;
      config.error = "";
      if (nextKey && input.value !== nextKey) {
        input.value = nextKey;
      }

      const saveButton = document.querySelector("[data-save-dify-config]");
      if (saveButton) {
        saveButton.disabled = !nextKey || config.saving;
      }
    });
  });

  document.querySelectorAll("[data-dify-skill-key]").forEach((input) => {
    input.addEventListener("input", () => {
      const config = getDifyFeatureConfig();
      config.skillKeyDraft = input.value;
      config.error = "";
    });
  });

  document.querySelectorAll("[data-save-dify-config]").forEach((button) => {
    button.addEventListener("click", () => {
      void saveDifyFeatureConfig(state.activeMain);
    });
  });

  document.querySelectorAll("[data-dify-process-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const messageId = button.getAttribute("data-dify-process-toggle") || "";
      const session = getDifyFeatureSession();
      session.messages = session.messages.map((message) => (
        message.id === messageId
          ? { ...message, processExpanded: !message.processExpanded }
          : message
      ));
      renderApp();
    });
  });

  document.querySelectorAll("[data-dev-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      state.chatDraft = button.getAttribute("data-dev-prompt") || "";
      state.generatedResult = "";
      renderApp();
    });
  });

  document.querySelectorAll("[data-customer-dev-field]").forEach((select) => {
    select.addEventListener("change", () => {
      const field = select.getAttribute("data-customer-dev-field");
      if (!field || !Object.prototype.hasOwnProperty.call(state.customerDevBrief, field)) {
        return;
      }
      state.customerDevBrief[field] = select.value;
      syncCustomerDevEngineSummary();
    });
  });

  /*
   * 右侧客户情报使用页签切换，避免为了展示更多内容把面板无限拉长。
   * 这里仅切换当前客户面板内的 DOM，不修改全局状态；用户切换客户后会自然回到“概览”。
   */
  document.querySelectorAll("[data-customer-dev-detail-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const targetPanel = button.getAttribute("data-customer-dev-detail-tab");
      const detail = button.closest(".customer-dev-panel-slide");

      if (!targetPanel || !detail) {
        return;
      }

      detail.querySelectorAll("[data-customer-dev-detail-tab]").forEach((tab) => {
        const isActive = tab === button;
        tab.classList.toggle("active", isActive);
        tab.setAttribute("aria-selected", String(isActive));
      });

      detail.querySelectorAll("[data-customer-dev-detail-panel]").forEach((panel) => {
        panel.hidden = panel.getAttribute("data-customer-dev-detail-panel") !== targetPanel;
      });
    });
  });

  document.querySelectorAll("[data-customer-input]").forEach((textarea) => {
    textarea.addEventListener("input", () => {
      state.customerDraft = textarea.value;
      syncCustomerSendButton();
    });
  });

  document.querySelectorAll("[data-send-chat]").forEach((button) => {
    button.addEventListener("click", () => {
      sendChatDraft();
    });
  });

  document.querySelectorAll("[data-new-chat]").forEach((button) => {
    button.addEventListener("click", () => {
      startNewChatConversation();
    });
  });

  document.querySelectorAll("[data-send-customer]").forEach((button) => {
    button.addEventListener("click", () => {
      sendCustomerDraft();
    });
  });

  document.querySelectorAll("[data-close-drawer]").forEach((node) => {
    node.addEventListener("click", (event) => {
      if (event.target !== node && node.classList.contains("drawer-backdrop")) {
        return;
      }

      state.drawer = null;
      renderApp();
    });
  });

  document.querySelectorAll("[data-toast]").forEach((node) => {
    node.addEventListener("click", () => {
      state.popup = null;
      renderApp();
      showToast(node.getAttribute("data-toast") || "操作已触发。");
    });
  });

  // 外贸流程：原地展开 AI 顾问卡。
  document.querySelectorAll("[data-flow-ask-ai-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.flowAi.open) {
        cancelFlowAiSimulation();
        state.flowAi = { open: false, phase: "idle", followUp: "" };
      } else {
        state.flowAi = { open: true, phase: "loading", followUp: "" };
        scheduleFlowAiAnswered();
      }
      renderApp();
    });
  });

  document.querySelectorAll("[data-flow-ai-close]").forEach((button) => {
    button.addEventListener("click", () => {
      cancelFlowAiSimulation();
      state.flowAi = { open: false, phase: "idle", followUp: "" };
      renderApp();
    });
  });

  document.querySelectorAll("[data-flow-ai-followup-input]").forEach((input) => {
    input.addEventListener("input", () => {
      state.flowAi.followUp = input.value;
      const sendBtn = document.querySelector("[data-flow-ai-followup-send]");
      if (sendBtn) {
        const canSend = state.flowAi.phase === "answered" && input.value.trim().length > 0;
        sendBtn.disabled = !canSend;
        sendBtn.classList.toggle("enabled", canSend);
      }
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        const sendBtn = document.querySelector("[data-flow-ai-followup-send]");
        if (sendBtn && !sendBtn.disabled) {
          sendBtn.click();
        }
      }
    });
  });

  document.querySelectorAll("[data-flow-ai-followup-send]").forEach((button) => {
    button.addEventListener("click", () => {
      const draft = state.flowAi.followUp.trim();
      if (!draft) return;
      showToast(`已记录追问：${draft}（原型不调用真实 AI，演示一次模拟回复）`);
      state.flowAi.followUp = "";
      state.flowAi.phase = "loading";
      scheduleFlowAiAnswered();
      renderApp();
    });
  });
}

/**
 * 绑定 User Preview 字段报表里的控件。
 *
 * 这个函数会在整页渲染后调用，也会在字段区局部刷新后调用。
 * 这样字段区可以独立更新，不需要每次勾选都重画整个后台页面。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function bindUserPreviewReportControls() {
  document.querySelectorAll("[data-user-preview-operation-select]").forEach((select) => {
    if (select.dataset.userPreviewOperationBound === "true") {
      return;
    }

    select.dataset.userPreviewOperationBound = "true";
    select.addEventListener("change", () => {
      const action = select.value;
      const userId = select.getAttribute("data-user-preview-operation-select") || "U-10001";

      if (!action) {
        return;
      }

      state.activeUserPreviewOperationId = userId;
      select.value = "";
      openUserPreviewOperationDialog(action);
    });
  });

  document.querySelectorAll("[data-user-preview-detail]").forEach((button) => {
    if (button.dataset.userPreviewDetailBound === "true") {
      return;
    }

    button.dataset.userPreviewDetailBound = "true";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      state.activeUserPreviewDetailId = button.getAttribute("data-user-preview-detail") || "U-10001";
      openAdminDialog("user-preview-detail", getAdminWorkspaceScrollSnapshot());
    });
  });

  document.querySelectorAll("[data-user-preview-field-option]").forEach((button) => {
    if (button.dataset.userPreviewBound === "true") {
      return;
    }

    button.dataset.userPreviewBound = "true";
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const field = button.getAttribute("data-user-preview-field-option");

      if (!field) {
        return;
      }

      if (state.userPreviewFields.has(field)) {
        if (state.userPreviewFields.size <= 1) {
          showToast("至少保留 1 个字段。");
          return;
        }

        state.userPreviewFields.delete(field);
      } else {
        state.userPreviewFields.add(field);

        if (!state.userPreviewFieldOrder.includes(field)) {
          state.userPreviewFieldOrder.push(field);
        }
      }

      button.classList.toggle("checked", state.userPreviewFields.has(field));
      button.setAttribute("aria-pressed", state.userPreviewFields.has(field) ? "true" : "false");
      refreshUserPreviewSelectedFieldsOnly();
    });
  });

  document.querySelectorAll("[data-user-preview-selected][draggable='true']").forEach((item) => {
    if (item.dataset.userPreviewBound === "true") {
      return;
    }

    item.dataset.userPreviewBound = "true";
    item.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });

    item.addEventListener("dragstart", (event) => {
      const field = item.getAttribute("data-user-preview-selected") || "";
      event.dataTransfer?.setData("text/plain", field);
      item.classList.add("dragging");
    });

    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
    });

    item.addEventListener("dragover", (event) => {
      event.preventDefault();
      item.classList.add("drag-over");
    });

    item.addEventListener("dragleave", () => {
      item.classList.remove("drag-over");
    });

    item.addEventListener("drop", (event) => {
      event.preventDefault();
      item.classList.remove("drag-over");

      const draggedField = event.dataTransfer?.getData("text/plain") || "";
      const targetField = item.getAttribute("data-user-preview-selected") || "";

      moveUserPreviewFieldBefore(draggedField, targetField);
      refreshUserPreviewFieldConfig();
    });
  });

  document.querySelectorAll("[data-user-preview-move]").forEach((button) => {
    if (button.dataset.userPreviewBound === "true") {
      return;
    }

    button.dataset.userPreviewBound = "true";
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const field = button.getAttribute("data-user-preview-move") || "";
      const direction = button.getAttribute("data-user-preview-move-direction") || "up";

      moveUserPreviewFieldByStep(field, direction === "down" ? 1 : -1);
      refreshUserPreviewFieldConfig();
    });
  });

  document.querySelectorAll("[data-user-preview-preset]").forEach((button) => {
    if (button.dataset.userPreviewBound === "true") {
      return;
    }

    button.dataset.userPreviewBound = "true";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const preset = button.getAttribute("data-user-preview-preset");
      const presets = {
        default: USER_PREVIEW_DEFAULT_FIELD_IDS
      };

      state.userPreviewFields = new Set(presets[preset] || presets.default);
      state.userPreviewFieldOrder = [...(presets[preset] || presets.default)];

      if (state.adminDialog === "user-preview-fields") {
        refreshUserPreviewFieldConfig();
        return;
      }

      refreshUserPreviewReport();
    });
  });
}

/**
 * 根据用户总表操作下拉的 value 打开对应弹窗。
 *
 * 为什么使用 value 映射：
 * - 下拉文案后续可能会继续调整，例如“关闭账号”改为“暂停账号”。
 * - 稳定的 value 可以让交互逻辑不跟着中文文案一起改。
 *
 * @param {string} action - 操作下拉的稳定 value。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function openUserPreviewOperationDialog(action) {
  const dialogMap = {
    "status-enable": "status-enable",
    "status-close": "status-close",
    "status-disable": "status-disable",
    "points-add": "points-add",
    "points-close": "points-close",
    "sub-account": "sub-account"
  };
  const dialog = dialogMap[action];

  if (!dialog) {
    showToast("该操作暂未配置弹窗。");
    return;
  }

  openAdminDialog(dialog, getAdminWorkspaceScrollSnapshot());
}

/**
 * 把一个 User Preview 字段移动到另一个字段前面。
 *
 * @param {string} draggedField - 被拖动的字段 ID。
 * @param {string} targetField - 拖拽释放位置所在的目标字段 ID。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function moveUserPreviewFieldBefore(draggedField, targetField) {
  if (!draggedField || !targetField || draggedField === targetField) {
    return;
  }

  if (USER_PREVIEW_FROZEN_FIELD_IDS.includes(draggedField) || USER_PREVIEW_FROZEN_FIELD_IDS.includes(targetField)) {
    return;
  }

  const orderedIds = getUserPreviewOrderedFieldIds();
  const frozenIds = orderedIds.filter((fieldId) => USER_PREVIEW_FROZEN_FIELD_IDS.includes(fieldId));
  const movableIds = orderedIds.filter((fieldId) => !USER_PREVIEW_FROZEN_FIELD_IDS.includes(fieldId));
  const draggedIndex = movableIds.indexOf(draggedField);
  const targetIndex = movableIds.indexOf(targetField);

  if (draggedIndex === -1 || targetIndex === -1) {
    return;
  }

  const nextMovableIds = [...movableIds];
  const [movedField] = nextMovableIds.splice(draggedIndex, 1);
  const nextTargetIndex = nextMovableIds.indexOf(targetField);
  nextMovableIds.splice(nextTargetIndex, 0, movedField);

  const selectedOrder = [...frozenIds, ...nextMovableIds];
  const hiddenOrder = state.userPreviewFieldOrder.filter((fieldId) => !selectedOrder.includes(fieldId));

  state.userPreviewFieldOrder = [...selectedOrder, ...hiddenOrder];
}

/**
 * 将一个可排序字段上移或下移一格。
 *
 * @param {string} field - 要移动的字段 ID。
 * @param {number} step - 移动方向；-1 表示上移，1 表示下移。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function moveUserPreviewFieldByStep(field, step) {
  if (!field || USER_PREVIEW_FROZEN_FIELD_IDS.includes(field)) {
    return;
  }

  const orderedIds = getUserPreviewOrderedFieldIds();
  const frozenIds = orderedIds.filter((fieldId) => USER_PREVIEW_FROZEN_FIELD_IDS.includes(fieldId));
  const movableIds = orderedIds.filter((fieldId) => !USER_PREVIEW_FROZEN_FIELD_IDS.includes(fieldId));
  const currentIndex = movableIds.indexOf(field);
  const nextIndex = currentIndex + step;

  if (currentIndex === -1 || nextIndex < 0 || nextIndex >= movableIds.length) {
    return;
  }

  const nextMovableIds = [...movableIds];
  const [movedField] = nextMovableIds.splice(currentIndex, 1);
  nextMovableIds.splice(nextIndex, 0, movedField);

  const selectedOrder = [...frozenIds, ...nextMovableIds];
  const hiddenOrder = state.userPreviewFieldOrder.filter((fieldId) => !selectedOrder.includes(fieldId));

  state.userPreviewFieldOrder = [...selectedOrder, ...hiddenOrder];
}

/**
 * 二维码倒计时计时器（每秒减 1）。
 *
 * @type {number | null}
 */
let payCountdownTimer = null;

/**
 * 启动一个 14 分 32 秒倒计时，挂到指定 DOM 节点上每秒刷新。
 *
 * 页面重绘后旧节点失效，所以会清掉前一个 interval。
 *
 * @param {HTMLElement} el - 要刷新文字的节点。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function startPayCountdown(el) {
  if (payCountdownTimer !== null) {
    window.clearInterval(payCountdownTimer);
    payCountdownTimer = null;
  }

  let total = 14 * 60 + 32;

  const tick = () => {
    const live = document.querySelector("[data-pay-countdown]");
    if (!live) {
      window.clearInterval(payCountdownTimer);
      payCountdownTimer = null;
      return;
    }

    const m = Math.floor(total / 60);
    const s = total % 60;
    live.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

    if (total <= 0) {
      window.clearInterval(payCountdownTimer);
      payCountdownTimer = null;
      return;
    }
    total -= 1;
  };

  tick();
  payCountdownTimer = window.setInterval(tick, 1000);
}

/**
 * AI 对话气泡"出答案"的模拟计时器。
 *
 * @type {number | null}
 */
let flowAiTimer = null;

/**
 * 重绘后把 AI 对话滚到底部，让最新气泡自然进入视野。
 *
 * 注意：因为气泡是带 stagger 动画的，单次滚动不够；这里在 0/300/700/1400ms 三次补滚，
 * 覆盖 stream 中所有气泡的入场时间。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function scrollFlowAiToBottom() {
  if (!state.flowAi.open) return;

  const stops = [0, 320, 700, 1500];
  stops.forEach((delay) => {
    window.setTimeout(() => {
      const list = document.querySelector("[data-flow-ai-scroll]");
      if (list) {
        list.scrollTop = list.scrollHeight;
      }
    }, delay);
  });
}

/**
 * 安排一次 AI 出答案的模拟，1 秒后把 phase 切换到 answered 并重绘。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function scheduleFlowAiAnswered() {
  cancelFlowAiSimulation();
  flowAiTimer = window.setTimeout(() => {
    flowAiTimer = null;
    if (state.flowAi.open) {
      state.flowAi.phase = "answered";
      renderApp();
    }
  }, 1100);
}

/**
 * 取消正在排队的 AI 模拟，避免关闭后还冒答案。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function cancelFlowAiSimulation() {
  if (flowAiTimer !== null) {
    window.clearTimeout(flowAiTimer);
    flowAiTimer = null;
  }
}

/**
 * 搜索框展开或输入后重新聚焦。
 *
 * 为什么需要这个函数：
 * - 当前原型使用整页重绘，输入搜索词后 DOM 会重建。
 * - 重建后主动聚焦，用户继续输入时手感才接近真实应用。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常；找不到搜索框时静默跳过。
 */
function focusHistorySearch() {
  window.setTimeout(() => {
    const input = document.querySelector("[data-history-search]");

    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }, 0);
}

/**
 * 案例搜索输入重绘后保持焦点。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function focusCaseSearch() {
  window.setTimeout(() => {
    const input = document.querySelector("[data-case-search]");

    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }, 0);
}

/**
 * 上传入口点击后给工作台一个轻量脉冲动画。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function pulseWorkbench() {
  window.setTimeout(() => {
    const board = document.querySelector(".workbench-enter");

    if (!board) {
      return;
    }

    board.classList.remove("pulse-once");
    void board.offsetWidth;
    board.classList.add("pulse-once");
  }, 0);
}

/**
 * 切换侧边栏历史搜索框。
 *
 * 作用：
 * - 这个函数挂到 window 上，给搜索按钮的显式 onclick 使用。
 * - 这样即使页面重绘或弹层状态变化，搜索入口也能稳定触发。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function toggleHistorySearch() {
  state.historySearchOpen = !state.historySearchOpen;
  state.popup = null;
  renderApp();
  focusHistorySearch();
}

/**
 * 同步发送按钮状态。
 *
 * 作用：
 * - 复刻线上“输入为空时发送按钮不可用”的交互。
 * - 只更新按钮 DOM，不重绘整个页面，避免打断用户输入。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function syncSendButton() {
  const button = document.querySelector("[data-send-chat]");
  const hasDraft = state.chatDraft.trim().length > 0;
  const isGenerating = isDifyChatFeaturePage() ? getDifyFeatureSession().isGenerating : state.isGenerating;

  if (!button) {
    return;
  }

  button.disabled = !hasDraft || isGenerating;
  button.classList.toggle("enabled", hasDraft);
}

/**
 * 在 Dify 流结束后恢复当前对话页的生成按钮，而不重绘整页。
 *
 * @param {string} featureId - 本轮请求所属页面；用户已切页时不更新其它页面的 DOM。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function syncDifyGenerationControls(featureId) {
  if (state.activeMain !== featureId) {
    return;
  }

  const button = document.querySelector("[data-send-chat]");
  if (button) {
    button.textContent = getDifyFeatureSession(featureId).isGenerating
      ? "AI 正在生成..."
      : "立即由AI生成报告";
  }
  syncSendButton();
}

/**
 * 同步客户Kass发送按钮状态。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function syncCustomerSendButton() {
  const button = document.querySelector("[data-send-customer]");
  const hasDraft = state.customerDraft.trim().length > 0;

  if (!button) {
    return;
  }

  button.disabled = !hasDraft && !state.isCustomerGenerating;
  button.classList.toggle("enabled", hasDraft);
}

/**
 * 模拟发送当前输入。
 *
 * 为什么只模拟：
 * - 这是逆向 UI 原型，不能调用真实 AI，也不能把用户输入发到线上。
 * - 用生成态和结果卡片表达真实流程，足够给开发同事对齐交互。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常；输入为空时只给 toast。
 */
function sendChatDraft() {
  const draft = state.chatDraft.trim();

  if (!draft) {
    showToast("请输入内容后再发送。");
    return;
  }

  if (isDifyChatFeaturePage()) {
    void sendDifyFeatureDraft(draft);
    return;
  }

  state.isGenerating = true;
  state.chatQuestion = draft;
  state.chatDraft = "";
  state.generatedResult = "";
  state.popup = null;
  renderApp();

  window.setTimeout(() => {
    const [title] = getChatLabels();
    state.isGenerating = false;
    if (state.activeMain === "customer-development") {
      state.generatedResult = "已生成客户开发方案：优先开发 UAE 新能源经销商，首轮用公司一句话定位 + 中东案例建立信任，第二轮补认证和交付能力，第三轮切 WhatsApp 或 LinkedIn 确认采购角色；有回复的客户进入客户Kass A/B 分组继续推进。";
    } else {
      state.generatedResult = `${title} 已根据你的输入整理出一版可继续编辑的业务建议。正式版这里会展示 AI 生成内容、引用资料和下一步动作。`;
    }
    renderApp();
  }, 900);
}

/**
 * 开启一轮新的通用对话。
 *
 * 作用：
 * - 清空上一轮问题和回答，回到输入首屏。
 * - 只影响当前静态原型的内存状态，不删除真实历史记录。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function startNewChatConversation() {
  stopDifyThinkingDurationTicker();
  state.chatDraft = "";
  state.chatQuestion = "";
  state.isGenerating = false;
  state.generatedResult = "";

  if (isDifyChatFeaturePage()) {
    state.difyFeatureSessions[state.activeMain] = window.YD_DIFY.createFeatureSessionState(state.activeMain);
  }

  state.popup = null;
  renderApp();
}

/**
 * 通过统一 Vercel 代理调用当前页面绑定的 Dify 应用。
 *
 * 作用：
 * - 普通对话应用、Agent 和 Chatflow 都走同一个前端数据结构。
 * - 每个页面维护独立 conversation_id 和稳定 user，避免跨 App 串上下文。
 * - 浏览器只发送 feature_id，已保存的 API Key 由后端从 Redis 解密使用。
 *
 * @param {string} draft - 当前对话页的用户输入。
 * @returns {Promise<void>} 完成后更新当前页面的多轮消息并重绘。
 * @throws {Error} 本函数捕获网络和业务异常，不向事件监听器继续抛出。
 */
async function sendDifyFeatureDraft(draft) {
  const featureId = state.activeMain;
  const config = getDifyFeatureConfig(featureId);
  const session = getDifyFeatureSession(featureId);
  const [title] = getChatLabels();

  if (!config.hasKey) {
    showToast("请先在顶部填写并保存 Dify API Key。");
    document.querySelector("[data-dify-api-key]")?.focus();
    return;
  }

  session.isGenerating = true;
  session.error = "";
  state.isGenerating = true;
  state.chatQuestion = draft;
  state.chatDraft = "";
  state.generatedResult = "";
  const pendingAnswerId = createCustomerResearchMessageId();
  session.messages.push(
    {
      id: createCustomerResearchMessageId(),
      role: "user",
      content: draft,
      status: "done"
    },
    {
      id: pendingAnswerId,
      role: "assistant",
      content: `正在生成${title}结果...`,
      status: "loading",
      processSteps: [],
      currentProcess: null,
      processCollapsed: false,
      processExpanded: false,
      answerStarted: false,
      // 从用户点击发送开始计时；第一段正式答案、完成或失败事件到达时由状态归并函数停止。
      thinkingStartedAt: Date.now(),
      thinkingEndedAt: null
    }
  );
  state.popup = null;
  renderApp();
  startDifyThinkingDurationTicker(featureId, pendingAnswerId);

  try {
    let doneReceived = false;

    /**
     * 把一条公开 SSE 事件合并进本轮助手消息。
     *
     * @param {object} event - process、answer_delta、answer_replace 或 done 事件。
     * @returns {void}
     * @throws {Error} error 事件会转换成异常，交给外层统一显示失败态。
     */
    const applyStreamEvent = (event) => {
      if (event?.type === "error") {
        throw new Error(event.message || "Dify 流式响应中断。");
      }

      session.messages = session.messages.map((message) => (
        message.id === pendingAnswerId
          ? window.YD_DIFY.applyDifyStreamEventToMessage(message, event)
          : message
      ));

      if (event?.type === "done") {
        doneReceived = true;
        session.conversationId = event.result?.conversation_id || session.conversationId;
      }

      scheduleDifyStreamRender(featureId, pendingAnswerId);
    };

    const response = await fetch(getDifyProxyEndpoint("chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feature_id: featureId,
        query: draft,
        conversation_id: session.conversationId,
        user: session.userId,
        // 只有配置了 Skill ID 的总控 App 才接收模型路由值；独立 App 保持自己的输入协议。
        // skill_key 不从浏览器发送，而由代理按后台已保存配置注入，避免临时切换到其它 Skill。
        inputs: config.skillKey ? { model_key: getDifyChatModel(state.selectedModel).value } : {},
        files: []
      })
    });

    const contentType = response.headers.get("content-type") || "";
    if (!response.ok) {
      const errorText = await response.text();
      let errorPayload = null;
      try {
        errorPayload = errorText ? JSON.parse(errorText) : null;
      } catch (_error) {
        errorPayload = null;
      }
      throw new Error(errorPayload?.message || errorText || `Dify 代理返回 HTTP ${response.status}`);
    }

    if (contentType.includes("text/event-stream")) {
      if (!response.body) {
        throw new Error("Dify 代理没有返回可读取的流式响应。");
      }

      const parser = window.YD_DIFY.createDifySseEventParser(applyStreamEvent);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        parser.push(decoder.decode(value, { stream: true }));
      }

      const remainingText = decoder.decode();
      if (remainingText) {
        parser.push(remainingText);
      }
      parser.finish();

      if (!doneReceived) {
        throw new Error("Dify 流式响应提前结束，请重新发送。");
      }
    } else {
      // 兼容 Vercel 新版本部署完成前的旧 JSON 代理，部署切换期间不会让正在使用的页面突然报错。
      const rawText = await response.text();
      let payload = null;
      try {
        payload = rawText ? JSON.parse(rawText) : null;
      } catch (_error) {
        payload = null;
      }

      if (!payload) {
        throw new Error("Dify 代理返回了无法识别的响应。");
      }
      applyStreamEvent({
        type: "done",
        result: { ...payload, answer: stripThinkingTags(payload.answer || "") }
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dify 调用失败，请稍后重试。";

    if (message === "Failed to fetch") {
      session.error = "Dify 代理请求失败。请检查当前网络、代理部署或 CORS 配置后重试。";
    } else {
      session.error = message;
    }

    session.messages = session.messages.map((messageItem) => (
      messageItem.id === pendingAnswerId
        ? window.YD_DIFY.applyDifyStreamEventToMessage(messageItem, { type: "error", message: session.error })
        : messageItem
    ));
  } finally {
    stopDifyThinkingDurationTicker();
    session.isGenerating = false;
    state.isGenerating = false;
    if (state.activeMain === featureId) {
      if (difyStreamRenderFrame !== null) {
        window.cancelAnimationFrame(difyStreamRenderFrame);
        difyStreamRenderFrame = null;
      }
      // 把最后一个 done/error 状态直接补到当前回答，避免流结束时再闪一次整页。
      patchDifyStreamMessageDom(featureId, pendingAnswerId);
      syncDifyGenerationControls(featureId);
    }
  }
}

/**
 * 模拟客户Kass基于客户档案生成建议。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常；输入为空时给出 toast。
 */
function sendCustomerDraft() {
  const draft = state.customerDraft.trim();

  if (!draft) {
    showToast("请输入客户上下文问题后再发送。");
    return;
  }

  const customer = state.activeMain.startsWith("customer-kass")
    ? (isKassWorkbenchView() ? getKassWorkbenchCustomer(getKassWorkbenchGroup()) : getActiveKassCustomer())
    : getActiveCustomer();
  state.isCustomerGenerating = true;
  state.customerResult = "";
  state.popup = null;
  renderApp();

  window.setTimeout(() => {
    state.isCustomerGenerating = false;
    state.customerResult = `已结合 ${customer.name} 的国家、阶段、最新询盘和历史沟通，建议${customer.nextAction || "先补齐认证、数量和交付地信息，再生成短回复"}。`;
    renderApp();
  }, 900);
}

/**
 * 展示短提示。
 *
 * @param {string} message - 提示文案。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常；找不到 toast 容器时直接忽略。
 */
function showToast(message) {
  const toast = document.querySelector("#toast");

  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");

  if (toastTimer) {
    window.clearTimeout(toastTimer);
  }

  toastTimer = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);

  console.log("[reverse-yingdan] toast", message);
}

/**
 * 路由表：把 URL hash 路径映射到内部 state（activeMain，可选 activeSalesTab）。
 *
 * 为什么用 hash 路由：
 * - 单文件原型，不依赖任何静态服务器 rewrite 规则。
 * - 直接 `index.html#/customer-kass/A` 就能进任意一屏，方便收藏、分享、对照线上。
 *
 * 改新页面只要：
 * 1. 在 NAV_GROUPS 里加一条导航。
 * 2. 在这里加一条 `{ hash, main }` 映射。
 * 3. 不用动渲染逻辑，因为 renderWorkspace 已经按 activeMain 分发。
 *
 * @type {Array<{ hash: string, main: string, tab?: string, kassView?: "workbench" | "online", customerDevPhase?: string, revealEmailIndex?: number }>}
 */
const ROUTES = [
  { hash: "/ask", main: "ask" },
  { hash: "/admin/home", main: "admin-home" },
  { hash: "/admin/knowledge-base", main: "admin-knowledge" },
  { hash: "/admin/user", main: "admin-user" },
  // 旧入口兼容：User Preview 已合并进「用户 > 用户总表」，老链接重定向到 admin-user。
  { hash: "/admin/user-preview", main: "admin-user" },
  { hash: "/admin/business", main: "admin-business" },
  { hash: "/admin/user-pool", main: "admin-user-pool" },
  { hash: "/admin/paid-pool", main: "admin-paid-pool" },
  { hash: "/admin/sales", main: "admin-user-sales" },
  { hash: "/admin/active-user", main: "admin-user-active" },
  { hash: "/admin/paid-user", main: "admin-user-paid" },
  { hash: "/admin/agent", main: "admin-agent" },
  { hash: "/admin/invite-code", main: "admin-invite" },
  { hash: "/admin/ai-character", main: "admin-character" },
  { hash: "/admin/ai-model", main: "admin-model" },
  { hash: "/admin/ai-cost", main: "admin-ai-cost" },
  { hash: "/sales-prep", main: "sales-prep", tab: "flow" },
  { hash: "/sales-prep/flow", main: "sales-prep", tab: "flow" },
  { hash: "/sales-prep/company", main: "sales-prep", tab: "company" },
  { hash: "/sales-prep/market", main: "sales-prep", tab: "market" },
  { hash: "/sales-prep/cases", main: "sales-prep", tab: "cases" },
  { hash: "/customer-development", main: "customer-development", customerDevPhase: "brief" },
  { hash: "/customer-development/searching", main: "customer-development", customerDevPhase: "searching" },
  { hash: "/customer-development/results", main: "customer-development", customerDevPhase: "results" },
  { hash: "/customer-development/contacts", main: "customer-development", customerDevPhase: "contacts" },
  { hash: "/customer-development/contacts/0", main: "customer-development", customerDevPhase: "contacts", revealEmailIndex: 0 },
  { hash: "/customer-development/contacts/1", main: "customer-development", customerDevPhase: "contacts", revealEmailIndex: 1 },
  { hash: "/customer-development/contacts/2", main: "customer-development", customerDevPhase: "contacts", revealEmailIndex: 2 },
  { hash: "/agents/customer-research", main: "customer-research" },
  { hash: "/agents/negotiation-scene", main: "negotiation-scene" },
  { hash: "/agents/inquiry-reply", main: "inquiry-reply" },
  { hash: "/skills/yd-artifact", main: "yd-artifact" },
  { hash: "/skills/market-research", main: "market-research" },
  // 旧入口兼容：客户开发已升为一级入口，老链接仍可打开同一个页面。
  { hash: "/skills/customer-development", main: "customer-development" },
  { hash: "/skills/cold-email", main: "cold-email" },
  { hash: "/skills/complaint", main: "complaint" },
  { hash: "/skills/reactivation", main: "reactivation" },
  { hash: "/skills/relationship", main: "relationship" },
  { hash: "/skills/phone-sales", main: "phone-sales" },
  { hash: "/skills/video-meeting", main: "video-meeting" },
  { hash: "/skills/field-visit", main: "field-visit" },
  { hash: "/skills/visit-reception", main: "visit-reception" },
  { hash: "/skills/title-combo", main: "title-combo" },
  { hash: "/skills/trade-show", main: "trade-show" },
  { hash: "/customer-kass/A", main: "customer-kass-a" },
  { hash: "/customer-kass/B", main: "customer-kass-b" },
  { hash: "/customer-kass/C", main: "customer-kass-c" },
  { hash: "/customer-kass/D", main: "customer-kass-d" },
  { hash: "/customer-kass/A/online", main: "customer-kass-a", kassView: "online" },
  { hash: "/customer-kass/B/online", main: "customer-kass-b", kassView: "online" },
  { hash: "/upgrade/pay/pro", main: "pay-pro" },
  { hash: "/upgrade/pay/pro/checkout", main: "pay-pro-checkout" },
  { hash: "/upgrade/pay/pro/done", main: "pay-pro-done" },
  { hash: "/upgrade/pay/team", main: "pay-team" },
  { hash: "/upgrade/pay/team/checkout", main: "pay-team-checkout" },
  { hash: "/upgrade/pay/team/done", main: "pay-team-done" },
  { hash: "/account/usage", main: "account-usage" }
];

/**
 * `isApplyingRoute` 防止 hash → state 与 state → hash 之间发生回环。
 *
 * @type {boolean}
 */
let isApplyingRoute = false;

/**
 * 根据当前 state 推出对应的 URL hash。
 *
 * @returns {string} 形如 `#/sales-prep/flow` 的 hash。
 * @throws {Error} 本函数不主动抛异常；遇到未知 activeMain 时回退到 `#/ask`。
 */
function hashForState() {
  const main = state.activeMain;

  if (main.startsWith("admin-")) {
    return hashForAdminMain(main);
  }

  if (main === "ask") {
    return "#/ask";
  }

  if (main === "sales-prep") {
    const tab = state.activeSalesTab || "flow";
    return `#/sales-prep/${tab}`;
  }

  if (main.startsWith("customer-kass-")) {
    const groupLabel = main.slice("customer-kass-".length).toUpperCase();
    return state.activeKassView === "online"
      ? `#/customer-kass/${groupLabel}/online`
      : `#/customer-kass/${groupLabel}`;
  }

  if (main === "customer-development") {
    if (state.customerDevPhase === "contacts") return "#/customer-development/contacts";
    if (state.customerDevPhase === "results") return "#/customer-development/results";
    if (state.customerDevPhase === "searching") return "#/customer-development/searching";
    return "#/customer-development";
  }

  if (main === "customer-research" || main === "negotiation-scene" || main === "inquiry-reply") {
    return `#/agents/${main}`;
  }

  if (main === "pay-pro") return "#/upgrade/pay/pro";
  if (main === "pay-pro-checkout") return "#/upgrade/pay/pro/checkout";
  if (main === "pay-pro-done") return "#/upgrade/pay/pro/done";
  if (main === "pay-team") return "#/upgrade/pay/team";
  if (main === "pay-team-checkout") return "#/upgrade/pay/team/checkout";
  if (main === "pay-team-done") return "#/upgrade/pay/team/done";
  if (main === "account-usage") return "#/account/usage";

  // 其它都视为 Skill。
  const explicit = ROUTES.find((route) => route.main === main);
  return explicit ? `#${explicit.hash}` : `#/skills/${main}`;
}

/**
 * 把当前 state 同步到地址栏。
 *
 * 用 `history.replaceState`，不会再触发 hashchange，避免回环。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function syncHashFromState() {
  if (isApplyingRoute) {
    return;
  }

  const next = hashForState();

  if (window.location.hash !== next) {
    try {
      window.history.replaceState(null, "", next);
    } catch (err) {
      window.location.hash = next;
    }
  }
}

/**
 * 根据当前 hash 找到对应路由配置；找不到时回退到首屏（ask）。
 *
 * @returns {typeof ROUTES[number]} 对应的路由配置。
 * @throws {Error} 本函数不主动抛异常。
 */
function findCurrentRoute() {
  const raw = window.location.hash || "";
  const pure = (raw.startsWith("#") ? raw.slice(1) : raw).split("?")[0] || "/ask";
  const deprecatedFlowRoutes = new Set(["/sales-prep/flow/a", "/sales-prep/flow/b", "/sales-prep/flow/c", "/sales-prep/flow/d"]);
  const deprecatedKassRoutes = new Map([
    ["/customer-kass/B", "/customer-kass/A"],
    ["/customer-kass/B/online", "/customer-kass/A/online"]
  ]);

  if (deprecatedFlowRoutes.has(pure)) {
    try {
      window.history.replaceState(null, "", "#/sales-prep/flow");
    } catch (err) {
      window.location.hash = "#/sales-prep/flow";
    }

    return ROUTES.find((route) => route.hash === "/sales-prep/flow") || ROUTES[0];
  }

  /*
   * 方案 A 已成为唯一正式界面。旧 B 链接仍可能存在于书签或评审记录中，
   * 所以在路由入口直接改写为 A，避免先渲染 B 再跳转造成界面闪烁。
   */
  if (deprecatedKassRoutes.has(pure)) {
    const canonicalPath = deprecatedKassRoutes.get(pure);

    try {
      window.history.replaceState(null, "", `#${canonicalPath}`);
    } catch (err) {
      window.location.hash = `#${canonicalPath}`;
    }

    return ROUTES.find((route) => route.hash === canonicalPath) || ROUTES[0];
  }

  return ROUTES.find((route) => route.hash === pure) || ROUTES[0];
}

/**
 * URL hash 变化时把内部 state 切到对应入口，然后整页重绘。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function applyRoute() {
  const route = findCurrentRoute();

  isApplyingRoute = true;
  state.activeMain = route.main;

  if (route.main !== "admin-ai-cost") {
    cancelCostMonitorReplay();
  }

  // 离开客户开发页时收起选择弹窗；同一个首页的迟到路由事件不能误关刚打开的弹窗。
  if (route.main !== "customer-development") {
    state.customerDevPicker = null;
  }

  if (route.tab) {
    state.activeSalesTab = route.tab;
  }

  if (route.main === "customer-development") {
    state.customerDevPhase = route.customerDevPhase || "brief";
    if (state.customerDevPhase !== "brief") {
      state.customerDevPicker = null;
    }
    if (state.customerDevPhase === "brief") {
      state.customerDevRevealedEmails = new Set();
    }
    if (typeof route.revealEmailIndex === "number") {
      state.customerDevRevealedEmails.add(`${state.customerDevSelectedLeadId}-${route.revealEmailIndex}`);
    }
  }

  // 来自外贸流程"问 AI"按钮的预填，进入 ask 页时消费一下。
  if (route.main === "ask") {
    consumePrefillPromptIfAny();
  }

  // 进入支付页时重置流程状态，避免上一次"支付成功"残留。
  if (route.main === "pay-pro" || route.main === "pay-team") {
    state.payPhase = "form";
    state.payAgreed = true;
  }

  // 路由变化时强制收掉之前的 popup（升级 modal、账号设置等），避免漂浮在新页上。
  state.popup = null;
  state.adminDialog = null;
  state.adminMenuOpen = false;

  // 直接进入某个子项时，自动把它所属的导航分组展开，让侧栏跟 URL 状态一致。
  const parent = NAV_GROUPS.find((group) => group.type === "group" && (group.children || []).some((child) => child.id === state.activeMain));
  if (parent) {
    state.expandedGroups.add(parent.id);
  }

  if (state.activeMain.startsWith("customer-kass-")) {
    state.activeKassView = route.kassView || "workbench";
    const routeGroup = getActiveKassGroup();
    let group = routeGroup;

    if (state.activeKassView === "workbench") {
      /*
       * `/customer-kass/A` 与 `/customer-kass/B` 只代表两套 UI 方案。
       * 两个入口都从同一个 A 级客户开始，评审时才能对照相同数据。
       *
       * C / D 是旧的等级深链：继续打开对应等级，但统一落到方案 A，
       * 避免出现既不是方案 A 也不是方案 B 的第三种工作台状态。
       */
      const legacyGradeId = ["customer-kass-c", "customer-kass-d"].includes(route.main)
        ? route.main
        : "customer-kass-a";

      if (legacyGradeId !== "customer-kass-a") {
        state.activeMain = "customer-kass-a";
        try {
          window.history.replaceState(null, "", "#/customer-kass/A");
        } catch (err) {
          window.location.hash = "#/customer-kass/A";
        }
      }

      state.kassWorkbenchGroupId = legacyGradeId;
      group = getKassWorkbenchGroup();
      state.kassExpandedGrades = new Set([group.id]);
      state.expandedGroups = new Set(["customer-kass"]);
    } else {
      // 线上复刻仍按 URL 中的等级读取客户，避免影响已有对照入口。
      state.kassExpandedGrades.add(group.id);
    }

    state.activeCustomerId = group.customers[0] ? group.customers[0].id : null;
    state.activeKassTab = "conversation";
    state.customerDraft = group.customers[0]?.inquiry || "";
    state.isCustomerGenerating = false;
    state.customerResult = "";
    state.kassAssistantOpen = false;
    state.kassCustomerDirectoryOpen = false;
    state.kassDirectoryGroupId = null;
    state.kassCustomerQuery = "";
    state.kassAgentDraft = "";
    state.kassAgentMessages = [];
    state.kassAgentThinking = false;
    state.kassRecordFormOpen = false;
    state.kassResearchOpen = false;
    state.kassCompletedTaskIds.clear();
  }

  state.popup = null;
  state.generatedResult = "";
  renderApp();
  isApplyingRoute = false;

  if (route.main === "customer-development" && route.customerDevPhase === "searching") {
    window.setTimeout(() => {
      // 用户在动画结束前离开搜索页时，迟到的计时器不能强行把页面拉回结果页。
      if (window.location.hash !== "#/customer-development/searching") {
        return;
      }

      // 结果页必须由 URL 路由进入，刷新、前进和后退时才能保持一致状态。
      window.location.hash = "#/customer-development/results";
    }, CUSTOMER_DEV_SEARCH_DURATION_MS);
  }
}

window.addEventListener("hashchange", applyRoute);

/**
 * 初始化页面。
 *
 * 如果 URL 里已经有 hash，按 hash 决定首屏；否则用默认 state（activeMain=ask）。
 *
 * @returns {void}
 * @throws {Error} renderApp 内部会在缺少 #app 时抛出错误。
 */
function init() {
  console.log("[reverse-yingdan] 初始化静态原型");
  installAutoRefreshWorker();
  consumePrefillPromptIfAny();

  if (window.location.hash) {
    applyRoute();
  } else {
    renderApp();
  }
}

/**
 * 如果上一屏是外贸流程的"问 AI"按钮，把它存的 prompt 取回来塞进 chatDraft。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常；sessionStorage 不可用时静默回退。
 */
function consumePrefillPromptIfAny() {
  try {
    const raw = window.sessionStorage.getItem("reverse-yingdan-prefill-ask");
    if (raw) {
      state.chatDraft = raw;
      window.sessionStorage.removeItem("reverse-yingdan-prefill-ask");
    }
  } catch (err) {
    /* ignore */
  }
}

/**
 * 注册自动刷新 Service Worker。
 *
 * 为什么要加这个：
 * - GitHub Pages 的静态资源会被浏览器缓存。
 * - 同事拿到同一个链接时，可能仍在看旧 index.html 和旧 JS。
 * - Service Worker 接管后，后续页面、JS、CSS 会优先走网络，减少“推了但别人看不到”的情况。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常；注册失败只写 warning，不影响原型打开。
 */
function installAutoRefreshWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  if (window.location.protocol === "file:") {
    return;
  }

  const hadController = Boolean(navigator.serviceWorker.controller);
  let hasReloadedForNewWorker = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || hasReloadedForNewWorker) {
      return;
    }

    hasReloadedForNewWorker = true;
    window.location.reload();
  });

  navigator.serviceWorker.register("./sw.js", {
    scope: "./",
    updateViaCache: "none"
  }).then((registration) => {
    registration.update();

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        registration.update();
      }
    });
  }).catch((error) => {
    console.warn("[reverse-yingdan] 自动刷新 Service Worker 注册失败", error);
  });
}

window.reverseYingdanToggleHistorySearch = toggleHistorySearch;
init();
