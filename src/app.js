/* global NAV_GROUPS, HISTORY_ITEMS, SALES_TABS, TRADE_STAGES, COMPANY_MODULES, PRODUCT_ROWS, CASE_CATEGORIES, CASE_ITEMS, CUSTOMERS, CUSTOMER_TIMELINE, KASS_GROUPS, KASS_FLOW_STAGES, UPGRADE_PLANS, USAGE_RECORDS, ADMIN_NAV_ITEMS, ADMIN_KNOWLEDGE_ROWS, ADMIN_USER_ROWS, ADMIN_USER_PREVIEW_METRICS, ADMIN_USER_PREVIEW_FUNCTION_SUMMARY, ADMIN_USER_PREVIEW_FIELDS, ADMIN_USER_PREVIEW_USERS, ADMIN_USER_PREVIEW_SUB_ACCOUNTS, ADMIN_INVITE_ROWS, ADMIN_CHARACTER_ROWS, ADMIN_MENU_ROWS, ADMIN_MODEL_ROWS */

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
 *   kassAssistantOpen: boolean,
 *   customerDraft: string,
 *   isCustomerGenerating: boolean,
 *   customerResult: string,
 *   drawer: null | "teaching" | "history",
 *   popup: null | "attachment" | "model" | "topHistory" | "customerSettings" | "accountSettings" | "inviteRedeem",
 *   historySearchOpen: boolean,
 *   historySearchQuery: string,
 *   selectedModel: string,
 *   chatDraft: string,
 *   isGenerating: boolean,
 *   generatedResult: string,
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
 *   adminUserFilterOpen: boolean
 * }}
 */
const USER_PREVIEW_DEFAULT_FIELD_IDS = ["logIndex", "usedAt", "userContact", "lastActiveAt", "activeDays", "calledFeature", "calledModel", "callCount", "inputToken", "outputToken", "totalToken", "creditBalance", "runStatus", "estimatedCost", "operationLog", "trialDetails"];

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
  kassAssistantOpen: false,
  customerDraft: "",
  isCustomerGenerating: false,
  customerResult: "",
  drawer: null,
  popup: null,
  historySearchOpen: false,
  historySearchQuery: "",
  selectedModel: "A",
  chatDraft: "",
  isGenerating: false,
  generatedResult: "",
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
  businessTimePreset: "month"
};

/**
 * 当前 toast 自动关闭计时器。
 *
 * @type {number | null}
 */
let toastTimer = null;

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
    "market-research": ["市场调研", "输入「核心产品」为主，可选加上「目标国家/地区」和「目标客户类型」，用于整体市场调研与选品推荐。", "市场调研：墨西哥·建筑材料行业·PVC地板·目标客户是工程采购商和批发商"],
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
    console.log("[reverse-yingdan] 后台原型已渲染", {
      activeMain: state.activeMain,
      dialog: state.adminDialog,
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
 * 为什么只做 DOM 动画：
 * - 当前后台是静态原型，不写入真实数据。
 * - 点击“新增子账号”后插入一条临时行，能表达新增后的视觉反馈和管理入口。
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
      const tbody = document.querySelector(".sub-account-usage-table tbody");

      if (!tbody) {
        showToast("新增子账号是原型反馈，不创建真实账号。");
        return;
      }

      tbody.querySelector(".sub-account-added-row")?.remove();
      tbody.insertAdjacentHTML("afterbegin", renderAdminSubAccountAddedRow());
      bindAdminActionControls();
      showToast("已模拟新增子账号，临时行已加入列表。");
    });
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
 * 渲染新增子账号的临时动画行。
 *
 * @returns {string} 临时子账号行 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminSubAccountAddedRow() {
  return `
    <tr class="sub-account-added-row">
      <td>
        <strong>新增子账号</strong>
        <em>待绑定手机号</em>
      </td>
      <td>${renderUserPreviewAccountStatus("启用")}</td>
      <td>0 分</td>
      <td class="admin-money-cell">0 分</td>
      <td>0 分</td>
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
    "admin-model": "#/admin/ai-model"
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

        <section class="history-block" aria-label="历史记录">
          <div class="history-head">
            <span class="history-head-caret" aria-hidden="true">⌃</span>
            <span class="history-head-label">历史记录</span>
            <button class="history-head-search ${state.historySearchOpen ? "active" : ""}" type="button" onclick="window.reverseYingdanToggleHistorySearch()" aria-label="搜索会话">⌕</button>
          </div>
          ${state.historySearchOpen ? `
            <input class="history-search-input" type="search" placeholder="搜索会话标题" value="${escapeHtml(state.historySearchQuery)}" data-history-search="true" />
          ` : ""}
          <div class="history-list">
            ${historyItems.length ? historyItems.map(renderHistoryItem).join("") : `<div class="history-empty">没有匹配的会话</div>`}
          </div>
          <button class="load-more" type="button" data-toast="这里仅展示加载更多的交互反馈，不读取真实历史。">加载更多</button>
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
 * 渲染一个导航入口或导航分组。
 *
 * @param {typeof NAV_GROUPS[number]} group - 导航配置。
 * @returns {string} 导航 HTML。
 * @throws {Error} 本函数不主动抛异常；group.children 缺失时按空数组处理。
 */
function renderNavGroup(group) {
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
    return `
      <header class="topbar">
        <div></div>
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
  const canExport = state.activeMain === "sales-prep" || state.activeMain.startsWith("customer-kass");

  return `
    <div class="top-actions">
      <a class="admin-ghost-entry" href="#/admin/home" aria-label="进入后台管理"></a>
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

  return renderChatView();
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
          ${renderFlowCustomerMiniList(activeStage)}
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
 * 渲染"我在该阶段的客户"侧块。
 *
 * @param {typeof TRADE_STAGES[number]} stage - 当前阶段。
 * @returns {string} 客户列表 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderFlowCustomerMiniList(stage) {
  const customers = (window.FLOW_STAGE_CUSTOMERS || {})[stage.id] || [];

  return `
    <article class="detail-block flow-customer-mini">
      <header class="flow-customer-mini-head">
        <h4>我在「${escapeHtml(stage.title)}」阶段的客户</h4>
        <span class="flow-customer-mini-count">${customers.length} 个客户</span>
      </header>
      ${customers.length ? `
        <ul class="flow-customer-mini-list">
          ${customers.map((c) => `
            <li>
              <a class="flow-customer-mini-row" href="#/customer-kass/${escapeHtml(c.group)}">
                <span class="flow-customer-mini-name">${escapeHtml(c.name)}</span>
                <span class="flow-customer-mini-meta">${escapeHtml(c.country)} · ${escapeHtml(c.industry)}</span>
                <span class="flow-customer-mini-group">Kass ${escapeHtml(c.group)} →</span>
              </a>
            </li>
          `).join("")}
        </ul>
      ` : `<p class="flow-customer-mini-empty">这个阶段暂时没有你跟进中的客户。</p>`}
    </article>
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
 * 渲染客户Kass作战室。
 *
 * @returns {string} 客户Kass HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderCustomerKassView() {
  const group = getActiveKassGroup();
  const customer = group.customers.length ? getActiveKassCustomer() : null;
  const activeStageIndex = customer
    ? Math.max(0, KASS_FLOW_STAGES.findIndex((stage) => stage.includes(customer.stage)))
    : 0;

  return `
    <section class="kass-directory workbench-enter">
      <aside class="kass-directory-list" aria-label="客户Kass客户列表">
        <header class="kass-directory-head">
          <div>
            <h2><span class="orange-bar"></span>${escapeHtml(group.label)}</h2>
            <p>${escapeHtml(group.desc)}</p>
          </div>
          <div class="kass-head-actions">
            <button class="kass-icon-btn" type="button" aria-label="搜索客户" data-toast="搜索客户是原型反馈。">⌕</button>
            <button class="kass-add-btn" type="button" data-toast="新增客户是原型入口，不创建真实客户。">
              <span class="kass-add-glyph" aria-hidden="true">⊕</span>
              <span>新增</span>
            </button>
          </div>
        </header>

        ${group.customers.length ? `
          <div class="kass-customer-stack">
            ${group.customers.map((item) => `
              <article class="kass-list-card ${state.activeCustomerId === item.id ? "active" : ""}">
                <button class="kass-card-main" type="button" data-customer="${escapeHtml(item.id)}">
                  <div class="kass-card-line1">
                    <span class="kass-card-title">${escapeHtml(item.name)}</span>
                    <span class="kass-card-delete" aria-hidden="true">✕</span>
                    <span class="kass-stage-chip">· ${escapeHtml(item.stage)}</span>
                  </div>
                  <div class="kass-card-line2">
                    <span class="kass-card-meta">${escapeHtml(item.country)} · ${escapeHtml(item.industry)}</span>
                    <span class="kass-card-badges">
                      <b>评级: ${escapeHtml(item.level)}</b>
                      <b>风险: ${escapeHtml(item.risk)}</b>
                    </span>
                  </div>
                </button>
                <button class="kass-mini-add" type="button" aria-label="新增" data-toast="已模拟新增一条跟进动作。">⊕</button>
              </article>
            `).join("")}
          </div>
        ` : `
          <div class="kass-empty-list">
            <div class="kass-empty-illus" aria-hidden="true">
              <svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="#c9bfb6" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <rect x="10" y="22" width="44" height="30" rx="3"/>
                <path d="M10 32h44"/>
                <path d="M22 22v-6h20v6"/>
                <circle cx="48" cy="18" r="6" fill="#ffffff"/>
                <path d="M46 18l1.5 1.5L50 17" stroke="#f0a36b"/>
              </svg>
            </div>
            <p>暂无客户</p>
          </div>
        `}
      </aside>

      <section class="kass-directory-main">
        ${customer ? renderKassDetail(customer, activeStageIndex) : renderKassDetailEmpty()}
      </section>

      <button class="kass-assistant-button" type="button" title="客户 AI 助手" aria-label="客户 AI 助手" data-kass-assistant="toggle">
        <span class="kass-assistant-mark">V</span>
      </button>
      ${renderKassAssistant(customer)}
    </section>
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
              <span class="model-pill-label">${escapeHtml(state.selectedModel)}</span>
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
            <button class="send-btn ${hasDraft ? "enabled" : ""}" type="button" data-send-chat="true" ${hasDraft || state.isGenerating ? "" : "disabled"} aria-label="发送">
              ${state.isGenerating ? `<span>…</span>` : `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M3.4 11.2 20.2 4.1c.6-.3 1.2.3.9.9l-7.1 16.8c-.3.6-1.1.6-1.4 0l-3-6.1-6.1-3c-.6-.3-.6-1.1-.1-1.5z"/></svg>`}
            </button>
          </div>
        </div>
        ${renderGenerationPanel()}
      </div>
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
      <button class="model-option active" type="button" data-model="A">
        <span>1</span>
        <strong>A</strong>
      </button>
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
function bindEvents() {
  document.querySelectorAll("[data-admin-route]").forEach((node) => {
    node.addEventListener("click", (event) => {
      const main = node.getAttribute("data-admin-route");

      if (!main) {
        return;
      }

      event.preventDefault();
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
      state.activeMain = button.getAttribute("data-main") || "sales-prep";
      state.popup = null;
      state.generatedResult = "";

      if (state.activeMain === "sales-prep") {
        state.activeSalesTab = "flow";
      }

      if (state.activeMain.startsWith("customer-kass")) {
        const group = getActiveKassGroup();
        state.activeCustomerId = group.customers[0].id;
        state.kassAssistantOpen = false;
      }

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
      state.activeCustomerId = button.getAttribute("data-customer") || getActiveKassGroup().customers[0].id;
      state.activeCustomerPanel = "overview";
      state.customerResult = "";
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
      state.selectedModel = button.getAttribute("data-model") || "A";
      state.popup = null;
      renderApp();
      showToast(`已选择模型 ${state.selectedModel}`);
    });
  });

  document.querySelectorAll("[data-chat-input]").forEach((textarea) => {
    textarea.addEventListener("input", () => {
      state.chatDraft = textarea.value;
      syncSendButton();
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

  if (!button) {
    return;
  }

  button.disabled = !hasDraft && !state.isGenerating;
  button.classList.toggle("enabled", hasDraft);
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

  state.isGenerating = true;
  state.generatedResult = "";
  state.popup = null;
  renderApp();

  window.setTimeout(() => {
    const [title] = getChatLabels();
    state.isGenerating = false;
    state.generatedResult = `${title} 已根据你的输入整理出一版可继续编辑的业务建议。正式版这里会展示 AI 生成内容、引用资料和下一步动作。`;
    renderApp();
  }, 900);
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

  const customer = getActiveCustomer();
  state.isCustomerGenerating = true;
  state.customerResult = "";
  state.popup = null;
  renderApp();

  window.setTimeout(() => {
    state.isCustomerGenerating = false;
    state.customerResult = `已结合 ${customer.name} 的国家、阶段、最新询盘和历史沟通，建议先补齐认证/数量/交付地信息，再用一封短邮件把报价边界和视频会议邀约一起发出。`;
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
 * @type {Array<{ hash: string, main: string, tab?: string }>}
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
  { hash: "/sales-prep", main: "sales-prep", tab: "flow" },
  { hash: "/sales-prep/flow", main: "sales-prep", tab: "flow" },
  { hash: "/sales-prep/company", main: "sales-prep", tab: "company" },
  { hash: "/sales-prep/market", main: "sales-prep", tab: "market" },
  { hash: "/sales-prep/cases", main: "sales-prep", tab: "cases" },
  { hash: "/agents/customer-research", main: "customer-research" },
  { hash: "/agents/negotiation-scene", main: "negotiation-scene" },
  { hash: "/agents/inquiry-reply", main: "inquiry-reply" },
  { hash: "/skills/market-research", main: "market-research" },
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
    return `#/customer-kass/${main.slice("customer-kass-".length).toUpperCase()}`;
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

  if (deprecatedFlowRoutes.has(pure)) {
    try {
      window.history.replaceState(null, "", "#/sales-prep/flow");
    } catch (err) {
      window.location.hash = "#/sales-prep/flow";
    }

    return ROUTES.find((route) => route.hash === "/sales-prep/flow") || ROUTES[0];
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

  if (route.tab) {
    state.activeSalesTab = route.tab;
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
    const group = getActiveKassGroup();
    state.activeCustomerId = group.customers[0] ? group.customers[0].id : null;
    state.kassAssistantOpen = false;
  }

  state.popup = null;
  state.generatedResult = "";
  renderApp();
  isApplyingRoute = false;
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
