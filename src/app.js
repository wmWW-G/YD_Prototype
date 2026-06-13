/* global NAV_GROUPS, HISTORY_ITEMS, SALES_TABS, TRADE_STAGES, COMPANY_MODULES, PRODUCT_ROWS, CASE_CATEGORIES, CASE_ITEMS, CUSTOMERS, CUSTOMER_TIMELINE, KASS_GROUPS, KASS_FLOW_STAGES, UPGRADE_PLANS, USAGE_RECORDS, ADMIN_NAV_ITEMS, ADMIN_KNOWLEDGE_ROWS, ADMIN_USER_ROWS, ADMIN_CHARACTER_ROWS, ADMIN_MENU_ROWS, ADMIN_MODEL_ROWS */

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
 *   popup: null | "attachment" | "model" | "topHistory" | "customerSettings" | "accountSettings",
 *   historySearchOpen: boolean,
 *   historySearchQuery: string,
 *   selectedModel: string,
 *   chatDraft: string,
 *   isGenerating: boolean,
 *   generatedResult: string,
 *   adminDialog: null | string,
 *   adminMenuOpen: boolean,
 *   adminUserFilterOpen: boolean
 * }}
 */
const state = {
  activeMain: "ask",
  expandedGroups: new Set(["deal-advisor"]),
  activeSalesTab: "flow",
  activeStageId: "lead",
  flowVariant: null,
  flowChecklist: {},
  flowNotes: {},
  flowCompareStageId: "background",
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
  adminDialog: null,
  adminMenuOpen: false,
  adminUserFilterOpen: true
};

/**
 * 当前 toast 自动关闭计时器。
 *
 * @type {number | null}
 */
let toastTimer = null;

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
    throw new Error("页面缺少 #app 容器，无法渲染赢单逆向原型。");
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
  return `
    <aside class="admin-sidebar" aria-label="赢单管理系统后台菜单">
      <a class="admin-brand" href="#/admin/home" data-admin-route="admin-home">
        <span class="admin-brand-dot" aria-hidden="true"></span>
        <h2>赢单管理系统</h2>
      </a>
      <nav class="admin-menu" aria-label="后台导航">
        ${renderAdminMenuItem("admin-home")}
        <div class="admin-menu-group">
          <button class="admin-menu-parent" type="button" data-admin-action="系统管理菜单已展开。">
            <span class="admin-menu-icon" aria-hidden="true">⚙</span>
            <span>系统管理</span>
            <span class="admin-menu-caret" aria-hidden="true">⌃</span>
          </button>
          <div class="admin-menu-children">
            ${["admin-knowledge", "admin-user", "admin-character", "admin-model"].map(renderAdminMenuItem).join("")}
          </div>
        </div>
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
  if (state.activeMain === "admin-knowledge") return renderAdminKnowledge();
  if (state.activeMain === "admin-user") return renderAdminUsers();
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
 * 用户管理页面。
 *
 * @returns {string} 用户管理 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderAdminUsers() {
  return `
    <article class="admin-card">
      <header class="admin-card-head">
        <h3>用户列表</h3>
        <div class="admin-head-actions">
          <button class="admin-outline-btn" type="button" data-admin-dialog="token-rank">查看Token排行</button>
          <button class="admin-primary-btn" type="button" data-admin-dialog="user-add">新增用户</button>
        </div>
      </header>
      <section class="admin-filter ${state.adminUserFilterOpen ? "open" : ""}" aria-label="注册时间筛选">
        <label>
          <span>注册时间：</span>
          <input type="text" placeholder="开始日期" />
        </label>
        <span class="admin-filter-to">至</span>
        <label>
          <input type="text" placeholder="结束日期" />
        </label>
        <button class="admin-primary-btn small" type="button" data-admin-action="已按注册时间执行模拟查询。">查 询</button>
        <button class="admin-ghost-btn small" type="button" data-admin-action="已重置筛选条件。">重 置</button>
      </section>
      <div class="admin-table-scroll">
        <table class="admin-table user-table">
          <thead>
            <tr>
              <th>序号</th>
              <th>用户名</th>
              <th>注册时间</th>
              <th>账户信息</th>
              <th>消息/Token统计</th>
              <th>Token使用详情</th>
              <th>用户状态</th>
              <th>账户操作</th>
            </tr>
          </thead>
          <tbody>
            ${ADMIN_USER_ROWS.map((row) => `
              <tr>
                <td>${row.id}</td>
                <td>${escapeHtml(row.username)}</td>
                <td>${escapeHtml(row.registeredAt)}</td>
                <td>
                  <div class="admin-cell-stack">
                    <span>积分: <strong>${row.credits}</strong></span>
                    <span>子账号: <strong>${escapeHtml(row.subAccounts)}</strong></span>
                    <em>无可用积分</em>
                  </div>
                </td>
                <td>
                  <div class="admin-cell-stack">
                    <span>消息总数: <strong>${row.messageCount}</strong></span>
                    <span>Token总数: <strong>${row.tokenCount}</strong></span>
                  </div>
                </td>
                <td><button class="admin-link" type="button" data-admin-action="Token详情是原型反馈。">查看详情</button></td>
                <td>${renderAdminSwitch(row.enabled)}</td>
                <td>
                  <div class="admin-row-actions">
                    <button class="admin-link" type="button" data-admin-dialog="points-add">加积分</button>
                    <button class="admin-link" type="button" data-admin-dialog="sub-account">调整子账号</button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      ${renderAdminPagination(2130, 213, true)}
    </article>
  `;
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
    "sub-account": renderAdminSubAccountDialog,
    "character-add": () => renderAdminCharacterDialog("新增AI人设"),
    "character-edit": () => renderAdminCharacterDialog("编辑AI人设"),
    "character-extend": renderAdminCharacterExtendDialog,
    "menu-manage": renderAdminMenuDialog,
    "model-edit": renderAdminModelDialog
  };

  const renderer = dialogMap[dialog];
  if (!renderer) return "";

  return `
    <div class="admin-dialog-backdrop" data-admin-close="true">
      <section class="admin-dialog ${dialog === "menu-manage" ? "wide" : ""} ${dialog === "token-rank" ? "rank" : ""}" role="dialog" aria-modal="true">
        <button class="admin-dialog-close" type="button" data-admin-close="true" aria-label="关闭">×</button>
        ${renderer()}
      </section>
    </div>
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
    <div class="admin-form-grid">
      ${renderAdminInput("增加积分", "请输入积分数量", true)}
      ${renderAdminInput("备注", "请输入操作备注", false)}
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
  return `
    <h3>调整子账号</h3>
    <div class="admin-form-grid">
      ${renderAdminInput("子账号数量", "请输入子账号数量", true)}
      ${renderAdminInput("备注", "请输入操作备注", false)}
    </div>
    ${renderAdminDialogActions("确 定")}
  `;
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

  // 复用 C 变体的"消耗最多的场景"逻辑：按 scene 聚合，取 Top 5。
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
 * 渲染 A 变体的指标卡。
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
  const variant = state.flowVariant;

  return `
    <div class="flow-view ${variant ? `flow-variant-${escapeHtml(variant)}` : "flow-variant-baseline"}">
      ${variant === "a" ? renderFlowProgressBar(activeIndex) : `
        <article class="intro-card">
          <h3 class="intro-title"><span class="orange-bar"></span>成交流程</h3>
          <p>让业务员知道外贸成交有哪些阶段、每个阶段要做什么动作、需要哪些资料表格，以及应该重点跟单里的哪个功能继续推进</p>
        </article>
      `}

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
            ${TRADE_STAGES.map((stage, index) => renderStageButton(stage, index, variant)).join("")}
          </div>
        </aside>

        <section class="stage-detail-panel ${variant ? `stage-detail-variant-${escapeHtml(variant)}` : ""}" aria-label="阶段详情">
          <header class="stage-detail-head">
            <div class="stage-detail-head-text">
              <h3 class="stage-title">阶段${activeIndex + 1}：${escapeHtml(activeStage.title)}</h3>
              <p class="stage-subtitle">${escapeHtml(activeStage.desc)}</p>
              ${variant === "c" ? renderFlowKpiRow(activeStage) : ""}
            </div>
            ${variant === "b" ? renderFlowAskAiButton(activeStage) : ""}
          </header>

          ${variant === "b" ? renderFlowAiCard(activeStage) : ""}

          <div class="top-info-grid">
            ${renderTopInfo("判断目标", activeStage.goal)}
            ${renderTopInfo("关键产出", activeStage.output)}
            ${renderTopInfo("下一步动作", activeStage.next)}
          </div>

          ${variant === "a" ? renderFlowChecklist(activeStage) : renderListBlock("这个阶段要做什么", activeStage.actions)}
          ${renderListBlock("注意事项", activeStage.tips)}
          ${variant === "c" ? renderFlowMistakes(activeStage) : ""}
          ${variant === "b" ? renderFlowMaterialPreviews(activeStage) : renderMaterials(activeStage.materials)}
          ${variant === "b" || variant === "d" ? renderFlowVideoCard(activeStage) : ""}
          ${variant === "d" ? renderFlowNotes(activeStage) : ""}
          ${variant === "b" ? renderFlowCustomerMiniList(activeStage) : renderFunctions(activeStage.functions)}
          ${variant === "c" ? renderFlowPrevNext(activeIndex) : ""}
          ${variant === "d" ? renderFlowCompareTray(activeStage) : ""}
        </section>
      </section>
    </div>
  `;
}

/**
 * 在每个阶段右上角加上勾选完成度（仅 A 变体使用）。
 *
 * @param {typeof TRADE_STAGES[number]} stage - 当前阶段。
 * @returns {{done: number, total: number}} 已勾选数 / 总动作数。
 * @throws {Error} 本函数不主动抛异常。
 */
function getChecklistProgress(stage) {
  const total = (stage.actions || []).length;
  const checked = state.flowChecklist[stage.id] || [];
  return { done: checked.filter((v) => v).length, total };
}

/**
 * 渲染顶部 12 阶段横向进度条（A 变体）。
 *
 * @param {number} activeIndex - 当前阶段下标。
 * @returns {string} 进度条 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderFlowProgressBar(activeIndex) {
  return `
    <article class="flow-progress" aria-label="阶段进度">
      <header class="flow-progress-head">
        <div>
          <h3><span class="orange-bar"></span>阶段进度</h3>
          <p>键盘 ← / → 可在阶段间切换；点节点直接跳到对应阶段</p>
        </div>
        <div class="flow-progress-counter">
          <strong>${activeIndex + 1}</strong> / 12
        </div>
      </header>
      <ol class="flow-progress-track">
        ${TRADE_STAGES.map((stage, index) => {
          const status = index < activeIndex ? "done" : index === activeIndex ? "current" : "upcoming";
          const short = (window.FLOW_STAGE_SHORT || {})[stage.id] || stage.title.slice(0, 2);
          return `
            <li class="flow-progress-node ${status}">
              <button type="button" data-stage="${escapeHtml(stage.id)}" title="${escapeHtml(stage.title)}">
                <span class="flow-progress-dot" aria-hidden="true">${index + 1}</span>
                <span class="flow-progress-label">${escapeHtml(short)}</span>
              </button>
              ${index < TRADE_STAGES.length - 1 ? `<span class="flow-progress-link" aria-hidden="true"></span>` : ""}
            </li>
          `;
        }).join("")}
      </ol>
    </article>
  `;
}

/**
 * 渲染可勾选 checklist（A 变体替换"这个阶段要做什么"）。
 *
 * @param {typeof TRADE_STAGES[number]} stage - 当前阶段。
 * @returns {string} checklist HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderFlowChecklist(stage) {
  const checks = state.flowChecklist[stage.id] || [];
  const { done, total } = getChecklistProgress(stage);

  return `
    <article class="detail-block flow-checklist">
      <header class="flow-checklist-head">
        <h4>这个阶段要做什么</h4>
        <span class="flow-checklist-counter">${done} / ${total}</span>
      </header>
      <ul class="flow-checklist-list">
        ${(stage.actions || []).map((action, index) => {
          const checked = Boolean(checks[index]);
          return `
            <li class="${checked ? "checked" : ""}">
              <button type="button" class="flow-checklist-check" data-checklist-stage="${escapeHtml(stage.id)}" data-checklist-index="${index}" aria-pressed="${checked}">
                <span class="flow-checklist-box" aria-hidden="true">${checked ? "✓" : ""}</span>
                <span>${escapeHtml(action)}</span>
              </button>
            </li>
          `;
        }).join("")}
      </ul>
      <p class="flow-checklist-tip">勾选状态保存在浏览器本地，刷新和切换阶段都保留。</p>
    </article>
  `;
}

/**
 * 渲染右上角"问 AI"按钮（B 变体）。
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
 * 渲染 B 变体的 AI 顾问展开卡。
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
 * 渲染"我在该阶段的客户"侧块（B 变体替换 functions）。
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
 * 渲染资料 / 表格 mini 预览卡（B 变体替换原 materials 按钮行）。
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
 * 渲染 KPI / 标杆值 chip 行（C 变体）。
 *
 * @param {typeof TRADE_STAGES[number]} stage - 当前阶段。
 * @returns {string} chip 行 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderFlowKpiRow(stage) {
  const kpis = stage.kpi || [];
  if (!kpis.length) return "";
  return `
    <div class="flow-kpi-row" aria-label="阶段 KPI">
      ${kpis.map((k) => `<span class="flow-kpi-chip">${escapeHtml(k)}</span>`).join("")}
    </div>
  `;
}

/**
 * 渲染"常见错误"反例列表（C 变体）。
 *
 * @param {typeof TRADE_STAGES[number]} stage - 当前阶段。
 * @returns {string} 错例 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderFlowMistakes(stage) {
  const mistakes = stage.mistakes || [];
  if (!mistakes.length) return "";
  return `
    <article class="detail-block flow-mistakes">
      <h4>常见错误（千万别这样）</h4>
      <ul class="flow-mistakes-list">
        ${mistakes.map((m) => `<li><span class="flow-mistake-mark" aria-hidden="true">✕</span><span>${escapeHtml(m)}</span></li>`).join("")}
      </ul>
    </article>
  `;
}

/**
 * 渲染上一阶段 / 下一阶段切换卡（C 变体）。
 *
 * @param {number} activeIndex - 当前阶段下标。
 * @returns {string} 上下阶段 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderFlowPrevNext(activeIndex) {
  const prev = activeIndex > 0 ? TRADE_STAGES[activeIndex - 1] : null;
  const next = activeIndex < TRADE_STAGES.length - 1 ? TRADE_STAGES[activeIndex + 1] : null;

  return `
    <nav class="flow-prev-next" aria-label="阶段串联">
      ${prev ? `
        <button class="flow-step-card prev" type="button" data-stage="${escapeHtml(prev.id)}">
          <span class="flow-step-arrow" aria-hidden="true">←</span>
          <span class="flow-step-meta">
            <em>上一阶段</em>
            <strong>${escapeHtml(prev.title)}</strong>
            <small>${escapeHtml(prev.desc)}</small>
          </span>
        </button>
      ` : `<span class="flow-step-card placeholder">已经是第一阶段</span>`}
      ${next ? `
        <button class="flow-step-card next" type="button" data-stage="${escapeHtml(next.id)}">
          <span class="flow-step-meta">
            <em>下一阶段</em>
            <strong>${escapeHtml(next.title)}</strong>
            <small>${escapeHtml(next.desc)}</small>
          </span>
          <span class="flow-step-arrow" aria-hidden="true">→</span>
        </button>
      ` : `<span class="flow-step-card placeholder">已经是最后一阶段</span>`}
    </nav>
  `;
}

/**
 * 渲染阶段教学视频卡（D 变体）。
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
 * 渲染个人笔记 textarea（D 变体）。
 *
 * @param {typeof TRADE_STAGES[number]} stage - 当前阶段。
 * @returns {string} 笔记区 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderFlowNotes(stage) {
  const note = (state.flowNotes && state.flowNotes[stage.id]) || "";
  return `
    <article class="detail-block flow-notes">
      <h4>我的私房笔记</h4>
      <p class="flow-notes-tip">写下你自己跑这一步的经验、客户原话、雷区。仅保存在你这台浏览器。</p>
      <textarea data-flow-notes-stage="${escapeHtml(stage.id)}" placeholder="例如：上次报价后客户压了 5%，我用免运费 + 提前 5 天交期换回来。">${escapeHtml(note)}</textarea>
    </article>
  `;
}

/**
 * 渲染双阶段对比抽屉（D 变体）。
 *
 * @param {typeof TRADE_STAGES[number]} stage - 当前阶段。
 * @returns {string} 对比区 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderFlowCompareTray(stage) {
  const compareStage = getStageById(state.flowCompareStageId || TRADE_STAGES[0].id);

  return `
    <article class="detail-block flow-compare">
      <header class="flow-compare-head">
        <h4>阶段对比</h4>
        <label>
          <span>对比目标</span>
          <select data-flow-compare>
            ${TRADE_STAGES.map((s) => `
              <option value="${escapeHtml(s.id)}" ${s.id === compareStage.id ? "selected" : ""}>${escapeHtml(s.title)}</option>
            `).join("")}
          </select>
        </label>
      </header>
      <div class="flow-compare-grid">
        ${renderFlowCompareColumn(stage, "当前阶段")}
        ${renderFlowCompareColumn(compareStage, "对比阶段")}
      </div>
    </article>
  `;
}

/**
 * 渲染对比表中的一列。
 *
 * @param {typeof TRADE_STAGES[number]} stage - 阶段数据。
 * @param {string} label - 列标签。
 * @returns {string} 列 HTML。
 * @throws {Error} 本函数不主动抛异常。
 */
function renderFlowCompareColumn(stage, label) {
  return `
    <section class="flow-compare-col">
      <header>
        <em>${escapeHtml(label)}</em>
        <strong>${escapeHtml(stage.title)}</strong>
      </header>
      <dl>
        <div><dt>判断目标</dt><dd>${escapeHtml(stage.goal)}</dd></div>
        <div><dt>关键产出</dt><dd>${escapeHtml(stage.output)}</dd></div>
        <div><dt>下一步</dt><dd>${escapeHtml(stage.next)}</dd></div>
        <div><dt>核心动作</dt><dd>${escapeHtml((stage.actions || []).join("；"))}</dd></div>
      </dl>
    </section>
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
function renderStageButton(stage, index, variant) {
  const number = String(index + 1).padStart(2, "0");
  const isActive = state.activeStageId === stage.id;
  const progress = variant === "a" ? getChecklistProgress(stage) : null;

  return `
    <button class="stage-item ${isActive ? "active" : ""}" type="button" data-stage="${escapeHtml(stage.id)}">
      <span class="stage-index">${number}</span>
      <span class="stage-item-text">
        <strong class="stage-name">${escapeHtml(stage.title)}</strong>
        <span class="stage-brief">${escapeHtml(stage.desc)}</span>
      </span>
      ${progress && progress.total ? `<span class="stage-progress-chip ${progress.done === progress.total ? "full" : ""}">${progress.done}/${progress.total}</span>` : ""}
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
  return `
    <section class="floating-popover account-popover" data-popup-surface="true">
      <button class="account-pop-head" type="button" data-toast="账号详情是原型反馈。">
        <span class="avatar" aria-hidden="true"></span>
        <span class="account-pop-id">
          <strong>Tina · 外贸业务</strong>
          <span>180****9154 · 个人空间</span>
        </span>
        <span class="account-pop-caret" aria-hidden="true">›</span>
      </button>

      <section class="account-pop-plan">
        <div class="account-pop-plan-row">
          <span class="account-pop-plan-tier">免费版</span>
          <a class="account-pop-plan-detail" href="#/account/usage" data-account-go="true">用量明细</a>
        </div>
        <div class="account-pop-plan-bar"><span style="width: 86%"></span></div>
        <div class="account-pop-plan-meta">还剩 <strong>75</strong> 积分 · 月底重置</div>
        <button class="account-pop-upgrade-cta" type="button" data-popup="upgrade">
          <span aria-hidden="true">✦</span> 升级解锁更多积分
        </button>
      </section>

      <ul class="account-pop-menu">
        <li><button type="button" data-toast="切换空间是原型反馈。"><span class="acc-i" aria-hidden="true">👥</span><span class="acc-label">切换空间</span><span class="acc-r" aria-hidden="true">›</span></button></li>
        <li><button type="button" data-toast="帮助中心是原型反馈。"><span class="acc-i" aria-hidden="true">?</span><span class="acc-label">帮助中心</span></button></li>
        <li><button type="button" data-toast="账号设置是原型入口，不修改真实账号。"><span class="acc-i" aria-hidden="true">⚙</span><span class="acc-label">设置</span></button></li>
        <li><button type="button" data-toast="关于页是原型反馈。"><span class="acc-i" aria-hidden="true">ⓘ</span><span class="acc-label">关于</span></button></li>
        <li><button class="danger" type="button" data-toast="退出登录是高风险动作，当前原型不执行。"><span class="acc-i" aria-hidden="true">↪</span><span class="acc-label">退出登录</span></button></li>
      </ul>
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

  document.querySelectorAll("[data-admin-dialog]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      state.adminDialog = button.getAttribute("data-admin-dialog");
      renderApp();
    });
  });

  document.querySelectorAll("[data-admin-close]").forEach((node) => {
    node.addEventListener("click", (event) => {
      const isBackdrop = node.classList.contains("admin-dialog-backdrop");
      if (isBackdrop && event.target !== node) {
        return;
      }

      state.adminDialog = null;
      renderApp();
    });
  });

  document.querySelectorAll(".admin-dialog").forEach((node) => {
    node.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  });

  document.querySelectorAll("[data-admin-action]").forEach((node) => {
    node.addEventListener("click", () => {
      const message = node.getAttribute("data-admin-action") || "后台操作已触发。";
      showToast(message);
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

  // 变体 A：勾选 checklist。
  document.querySelectorAll("[data-checklist-stage]").forEach((button) => {
    button.addEventListener("click", () => {
      const stageId = button.getAttribute("data-checklist-stage");
      const idx = Number(button.getAttribute("data-checklist-index"));

      if (!stageId || Number.isNaN(idx)) {
        return;
      }

      const list = (state.flowChecklist[stageId] || []).slice();
      list[idx] = !list[idx];
      state.flowChecklist[stageId] = list;
      persistFlowChecklist();
      renderApp();
    });
  });

  // 变体 D：私房笔记输入。
  document.querySelectorAll("[data-flow-notes-stage]").forEach((textarea) => {
    textarea.addEventListener("input", () => {
      const stageId = textarea.getAttribute("data-flow-notes-stage");
      if (!stageId) return;
      state.flowNotes[stageId] = textarea.value;
      persistFlowNotes();
    });
  });

  // 变体 D：对比阶段选择。
  document.querySelectorAll("[data-flow-compare]").forEach((select) => {
    select.addEventListener("change", () => {
      state.flowCompareStageId = select.value;
      renderApp();
    });
  });

  // 变体 B：原地展开 AI 顾问卡。
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
 * localStorage key 前缀。集中起来避免散落。
 */
const STORAGE_KEYS = {
  checklist: "reverse-yingdan-flow-checklist",
  notes: "reverse-yingdan-flow-notes"
};

/**
 * 把当前 checklist 写回 localStorage。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常；写入失败时静默忽略，避免影响渲染。
 */
function persistFlowChecklist() {
  try {
    window.localStorage.setItem(STORAGE_KEYS.checklist, JSON.stringify(state.flowChecklist));
  } catch (err) {
    /* ignore quota errors */
  }
}

/**
 * 把当前笔记写回 localStorage。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function persistFlowNotes() {
  try {
    window.localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(state.flowNotes));
  } catch (err) {
    /* ignore quota errors */
  }
}

/**
 * 启动时读取 checklist / notes，让用户上次的勾选和笔记不丢。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常；解析失败时回退到空对象。
 */
function hydrateFlowStorage() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.checklist);
    if (raw) state.flowChecklist = JSON.parse(raw) || {};
  } catch (err) {
    state.flowChecklist = {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.notes);
    if (raw) state.flowNotes = JSON.parse(raw) || {};
  } catch (err) {
    state.flowNotes = {};
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
  { hash: "/admin/ai-character", main: "admin-character" },
  { hash: "/admin/ai-model", main: "admin-model" },
  { hash: "/sales-prep", main: "sales-prep", tab: "flow" },
  { hash: "/sales-prep/flow", main: "sales-prep", tab: "flow", flowVariant: null },
  { hash: "/sales-prep/flow/a", main: "sales-prep", tab: "flow", flowVariant: "a" },
  { hash: "/sales-prep/flow/b", main: "sales-prep", tab: "flow", flowVariant: "b" },
  { hash: "/sales-prep/flow/c", main: "sales-prep", tab: "flow", flowVariant: "c" },
  { hash: "/sales-prep/flow/d", main: "sales-prep", tab: "flow", flowVariant: "d" },
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
    if (tab === "flow" && state.flowVariant) {
      return `#/sales-prep/flow/${state.flowVariant}`;
    }
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

  // flow 变体允许显式设为 null（基础版）或某个字母（增强版）。
  if (Object.prototype.hasOwnProperty.call(route, "flowVariant")) {
    state.flowVariant = route.flowVariant;
  }


  // 来自变体 B"问 AI"按钮的预填，进入 ask 页时消费一下。
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
  console.log("[reverse-yingdan] 初始化静态逆向原型");
  hydrateFlowStorage();
  consumePrefillPromptIfAny();
  installFlowKeyboardShortcuts();

  if (window.location.hash) {
    applyRoute();
  } else {
    renderApp();
  }
}

/**
 * 如果上一屏是变体 B 的"问 AI"按钮，把它存的 prompt 取回来塞进 chatDraft。
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
 * 安装全局键盘快捷键：变体 A 下 ←/→ 切换上一/下一阶段。
 *
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常。
 */
function installFlowKeyboardShortcuts() {
  document.addEventListener("keydown", (event) => {
    if (state.flowVariant !== "a") return;
    if (state.activeMain !== "sales-prep" || state.activeSalesTab !== "flow") return;

    // 输入框聚焦时不抢键盘。
    const target = event.target;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
      return;
    }

    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    const idx = TRADE_STAGES.findIndex((s) => s.id === state.activeStageId);
    const nextIdx = event.key === "ArrowRight"
      ? Math.min(TRADE_STAGES.length - 1, idx + 1)
      : Math.max(0, idx - 1);

    if (nextIdx === idx) return;

    state.activeStageId = TRADE_STAGES[nextIdx].id;
    renderApp();
    event.preventDefault();
  });
}

window.reverseYingdanToggleHistorySearch = toggleHistorySearch;
init();
