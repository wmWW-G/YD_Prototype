# CONTEXT.md

## 项目目标

本项目用于逆向复刻线上「赢单外贸成交顾问」界面，产出一个可以直接打开、演示、提交 git、交给开发同事继续实现的静态前端原型。

当前版本重点复刻销售准备和客户Kass两块核心工作台，包括：

- 左侧固定导航。
- 顶部销售准备子标签。
- 右上角教学视频、导出文件、历史入口。
- 成交流程说明卡片。
- 12 个外贸成交阶段列表。
- 当前阶段详情区。
- `销售准备 > 了解公司`：公司资料维护、左侧资料模块、右侧编辑器、AI 提炼结果、上传文档反馈。
- `销售准备 > 产品&市场`：产品与市场全景表、分类筛选、产品表格、选中行、产品侧边摘要、上传/导出反馈。
- `销售准备 > 案例知识库`：资料分类、快捷筛选、搜索框、案例卡片和空态。
- `客户Kass`：复刻 `/customer-kass/A` 这种分组页结构，包括左侧 A/B 分组、分组客户列表、客户档案、跟进流程图、客户跟进记录、右下角 Kass AI 助手按钮和展开浮窗。
- 抽屉、toast、菜单展开和阶段切换动效。
- 本地 SVG 导航图标，来源为 `/Users/garden/Desktop/1/vinco-icons`，已复制到 `assets/icons/`。
- 侧边栏历史搜索、历史项编辑/删除图标、顶部历史下拉。
- 通用聊天输入框的附件弹层、模型下拉、输入后发送按钮启用、模拟生成态和结果卡片。
- 客户Kass入口设置弹层和账号设置弹层。
- 账号弹层里的邀请码兑换积分、团队/企业空间切换飞出层、用量明细跳转和升级入口。
- 透明后台入口：`#/ask` 顶部右侧有一个 hover 才轻微显色的圆形按钮，点击进入后台管理。
- 后台管理壳：左侧后台菜单、顶部面包屑、用户界面返回按钮、首页、知识库管理、用户总表（即原 User Preview 看板）、邀请码管理、AI 人设管理、AI 模型管理。
- `后台管理 > User Preview`：时间范围筛选、数据概览 KPI、功能调用总看板、可折叠字段配置、用户字段流水账报表和子账号管理；子账号管理只保留手机号、积分、启停和调积分口径，不设计角色权限。
- `后台管理 > 经营分析`：角色化运营驾驶舱（管理员/运营/客服三种视角），含经营看板、功能洞察两个 Tab。User Preview 仍保留作为字段流水自由报表，不被替代。
- `后台管理 > 用户` 分组：参考同事截图重构出的用户分类菜单，含经营分析、用户总表（沿用旧 `/admin/user`）、公海客户、付费公海、销售信息、活跃用户、付费用户和邀请码管理；受邀来源信息统一进入用户总表的使用详情。
- `后台管理 > 代理` 分组：经销代理总览，含拉新数、付费数、累计分成和状态。
- `后台管理 > 邀请码管理`：生成邀请码表单、预览提示和邀请码列表，用于表达销售同事发放试用福利的原型流程。

本项目只复刻界面结构和交互手感，不接真实接口，不写入真实客户资料，不复制线上历史记录和账号隐私。

## 项目负责人和工作方式

本项目的产品方向、功能路径、UI 原型和 AI 工作流设计主要由用户负责。用户在这个项目里的角色不是单纯的代码使用方，而是：

- 产品经理：决定赢单应用要覆盖哪些外贸业务场景、功能入口、字段和用户流程。
- 原型图 UI 设计者：判断页面信息架构、布局优先级、交互方式和视觉反馈是否符合真实产品使用。
- AI 工作流设计者：设计各功能背后的 AI 生成、提炼、归类、判断和成交建议逻辑。
- 扣子工作流维护者：提供、验证和整理 Coze/扣子工作流的调用链接、schema、调用函数、节点画布和真实测试结果。

因此后续协作时，代码修改要服务于用户的产品原型判断。界面上只呈现用户真实会操作的内容；产品意图、技术说明、扣子调用细节和后续开发注意事项，应沉淀在 `CONTEXT.md`、`AGENTS.md` 或 `coze-workflows/`，不要写进用户可见的原型页面。

AI 和扣子工作流是本项目的重要组成部分，但当前主原型仍保持静态前端形态。真实工作流资料统一维护在 `coze-workflows/`，页面中只表现入口、字段、状态和模拟反馈；除非用户明确要求接真实接口，否则不要把真实 API 调用写进 `src/app.js`。

## 入口在哪里

主入口是：

```text
index.html
```

浏览器直接打开即可查看。如果需要更稳定地测试本地资源，也可以在本目录启动一个静态服务器。

线上预览地址：

```text
https://wmww-g.github.io/YD_Prototype/#/ask
```

发布同步可以通过 `github-b` SSH alias push。若用户说明当前开了 TUN，先不要 push；这个环境下 GitHub SSH 可能无法 connect。

## 文件结构

```text
reverse-yingdan/
  CONTEXT.md
  AGENTS.md
  AI板块统计.md
  index.html
  assets/
    icons/
    generated/
  coze-workflows/
  src/
    app.js
    data.js
    styles.css
```

各文件职责：

- `index.html`：页面骨架，只放必要容器和脚本引用。
- `src/styles.css`：全部视觉样式、响应式规则和动效。
- `src/data.js`：用户侧导航、销售准备标签、成交阶段、后台菜单、User Preview 报表、邀请码、AI 人设和模型等静态数据。
- `src/app.js`：渲染函数、hash 路由、事件绑定、抽屉、toast、弹层、账号弹层、后台管理和状态切换。
- `assets/icons/`：本地 SVG 图标。后续新增图标时优先复制进这里，再在 `src/data.js` 引用相对路径。
- `assets/generated/`：当前原型使用的本地视觉素材。
- `AI板块统计.md`：统计客户Kass、销售准备等区域的 AI 能力现状和后续整理建议。
- `coze-workflows/`：扣子工作流资料库，记录工作流用途、schema、调用函数、字段映射和验证状态。

## 当前技术栈

当前使用 `HTML + CSS + 原生 JavaScript`。

选择理由：

- 优点：不用构建工具，方便直接打开和 git 交付。
- 优点：适合逆向 UI 原型，开发同事能快速看结构和业务数据。
- 缺点：后续如果要做大量真实业务状态、接口和权限，建议再迁移到 React 或 Vue。

## 状态和数据结构

当前状态在 `src/app.js` 的 `state` 对象中维护：

- `activeMain`：当前左侧一级入口。
- `expandedGroups`：左侧分组展开状态。
- `activeSalesTab`：销售准备顶部标签。
- `activeStageId`：外贸流程当前选中的成交阶段。
- `activeCompanyModule`：公司资料维护当前选中的模块。
- `selectedProductId`：产品与市场表格当前选中的产品行。
- `activeCaseCategory` / `activeCaseTag` / `caseSearchQuery`：案例知识库分类、标签和搜索词。
- `activeCustomerId`：客户Kass当前选中的客户。
- `kassAssistantOpen`：右下角 Kass AI 助手浮窗开关。
- `customerDraft` / `isCustomerGenerating` / `customerResult`：旧客户输入壳保留状态，当前 A/B 分组页主要使用右下角助手浮窗。
- `drawer`：当前打开的右侧抽屉类型。
- `popup`：当前打开的轻量弹层，例如附件、模型、顶部历史、设置、账号设置、邀请码兑换。
- `historySearchOpen` / `historySearchQuery`：侧边栏历史搜索状态。
- `selectedModel`：当前模型选择。
- `chatDraft` / `isGenerating` / `generatedResult`：聊天输入、模拟生成和结果状态。
- `inviteCodeDraft` / `inviteRedeemResult`：账号弹层里的邀请码输入和模拟兑换结果。
- `adminInvitePreview`：后台邀请码管理里点击生成后的预览文案。
- `userPreviewFields` / `userPreviewFieldsOpen`：后台 User Preview 用户字段报表显示哪些列，以及字段配置是否展开。
- `userPreviewTimePreset` / `userPreviewStartDate` / `userPreviewEndDate`：后台 User Preview 的今日、本周、本月和自定义时间范围。
- `activeBusinessTab` / `businessRole` / `businessTimePreset`：经营分析当前 Tab（dashboard/feature）、角色（admin/ops/support）、时间范围预设。
- `adminDialog` / `adminMenuOpen` / `adminUserFilterOpen`：后台管理弹窗、菜单和用户筛选状态。
- `accountSpaceSwitcherOpen`：账号弹层中团队/企业空间切换飞出层是否打开。

静态数据在 `src/data.js` 中维护：

- `NAV_GROUPS`：左侧导航分组。
- `HISTORY_ITEMS`：假历史记录。
- `SALES_TABS`：销售准备顶部标签。
- `TRADE_STAGES`：12 个成交阶段。
- `COMPANY_MODULES`：公司资料维护模块数据。
- `PRODUCT_ROWS`：产品与市场全景表行数据。
- `CASE_CATEGORIES` / `CASE_ITEMS`：案例知识库分类和案例数据。
- `KASS_GROUPS` / `KASS_FLOW_STAGES`：客户Kass A/B 分组、客户卡片和跟进流程阶段。
- `CUSTOMERS` / `CUSTOMER_TIMELINE`：早期客户作战室示例数据，当前主页面已改用 `KASS_GROUPS`。
- `ADMIN_NAV_ITEMS`：后台管理左侧菜单。
- `ADMIN_KNOWLEDGE_ROWS` / `ADMIN_USER_ROWS`：后台知识库和用户管理表格样例。
- `ADMIN_USER_PREVIEW_METRICS` / `ADMIN_USER_PREVIEW_FUNCTION_SUMMARY` / `ADMIN_USER_PREVIEW_FIELDS` / `ADMIN_USER_PREVIEW_USERS` / `ADMIN_USER_PREVIEW_SUB_ACCOUNTS`：User Preview 的指标、功能调用总看板、字段配置、用户流水账和子账号积分使用数据；新增子账号交互在 `src/app.js` 中通过手机号 + 初始分配积分的临时表单模拟。
- `ADMIN_BUSINESS_HEADLINE` / `ADMIN_BUSINESS_SUB_METRICS` / `ADMIN_BUSINESS_TREND` / `ADMIN_BUSINESS_FUNNEL` / `ADMIN_BUSINESS_CHANNELS` / `ADMIN_BUSINESS_TOP_SALES` / `ADMIN_BUSINESS_FEATURE_INSIGHTS` / `ADMIN_BUSINESS_QUADRANTS`：经营分析两个 Tab（经营看板/功能洞察）所需的全部模拟数据。
- `ADMIN_USER_POOL_ROWS` / `ADMIN_PAID_POOL_ROWS` / `ADMIN_SALES_ROWS` / `ADMIN_ACTIVE_USER_ROWS` / `ADMIN_PAID_USER_ROWS` / `ADMIN_AGENT_ROWS`：后台 `用户` 分组用户列表 + `代理` 分组 1 个子页的样例数据；邀请来源字段在 `ADMIN_USER_PREVIEW_USERS` 中维护。
- `ADMIN_INVITE_ROWS`：后台邀请码列表数据。
- `ADMIN_CHARACTER_ROWS` / `ADMIN_MODEL_ROWS`：后台 AI 人设和模型管理表格数据。
- `UPGRADE_PLANS` / `USAGE_RECORDS`：账号用量和升级支付原型数据。

## URL 路由

为了方便每个界面单独维护、刷新和分享，原型用 hash 路由（不依赖任何静态服务器 rewrite），全部映射定义在 `src/app.js` 顶部的 `ROUTES` 数组里。

| Hash 路径 | 对应界面 |
| --- | --- |
| `#/ask` | 问一下（默认首屏） |
| `#/admin/home` | 后台管理 > 首页 |
| `#/admin/knowledge-base` | 后台管理 > 知识库管理 |
| `#/admin/user` | 后台管理 > 用户 > 用户总表（User Preview 看板） |
| `#/admin/user-preview` | 旧入口，已合并，自动重定向到 `#/admin/user` |
| `#/admin/business` | 后台管理 > 经营分析（角色化运营驾驶舱） |
| `#/admin/user-pool` | 后台管理 > 用户 > 公海客户 |
| `#/admin/paid-pool` | 后台管理 > 用户 > 付费公海 |
| `#/admin/sales` | 后台管理 > 用户 > 销售信息 |
| `#/admin/active-user` | 后台管理 > 用户 > 活跃用户 |
| `#/admin/paid-user` | 后台管理 > 用户 > 付费用户 |
| `#/admin/agent` | 后台管理 > 代理 > 代理总览 |
| `#/admin/invite-code` | 后台管理 > 邀请码管理 |
| `#/admin/ai-character` | 后台管理 > AI 人设管理 |
| `#/admin/ai-model` | 后台管理 > AI 模型管理 |
| `#/sales-prep/flow` | 销售准备 > 外贸流程 Flow：问 AI 按钮 + 资料预览卡 + 教学视频 |
| `#/sales-prep/company` | 销售准备 > 了解公司 |
| `#/sales-prep/market` | 销售准备 > 产品&市场 |
| `#/sales-prep/cases` | 销售准备 > 案例知识库 |
| `#/agents/customer-research` | 成交顾问 > 客户背调顾问 |
| `#/agents/negotiation-scene` | 成交顾问 > 场景谈判顾问 |
| `#/agents/inquiry-reply` | 成交顾问 > 询盘分析回复 |
| `#/skills/market-research` | 技能 > 市场调研 |
| `#/skills/cold-email` | 技能 > 新客开发信 |
| `#/skills/complaint` | 技能 > 客诉处理 |
| `#/skills/reactivation` | 技能 > 客户激活 |
| `#/skills/relationship` | 技能 > 关系维护 |
| `#/skills/phone-sales` | 技能 > 海外电销 |
| `#/skills/video-meeting` | 技能 > 视频会议 |
| `#/skills/field-visit` | 技能 > 地推陌拜 |
| `#/skills/visit-reception` | 技能 > 来访接待 |
| `#/skills/title-combo` | 技能 > 标题组合 |
| `#/skills/trade-show` | 技能 > 展会成交 |
| `#/customer-kass/A` | 客户Kass > A 分组 |
| `#/customer-kass/B` | 客户Kass > B 分组 |
| `#/account/usage` | 账号 > 用量明细 |
| `#/upgrade/pay/pro`、`#/upgrade/pay/pro/checkout`、`#/upgrade/pay/pro/done` | 专业版支付三步原型 |
| `#/upgrade/pay/team`、`#/upgrade/pay/team/checkout`、`#/upgrade/pay/team/done` | 团队版支付三步原型 |

新增页面的步骤：

1. 在 `src/data.js` 的 `NAV_GROUPS` 里加一条导航。
2. 如果新增后台页面，在 `src/data.js` 的 `ADMIN_NAV_ITEMS` 里加后台菜单，并在 `src/app.js` 的 `renderAdminWorkspace()` 与 `hashForAdminMain()` 里同步。
3. 在 `src/app.js` 的 `ROUTES` 数组里加一条 `{ hash, main, tab? }`。
4. 在 `getChatLabels`、`renderWorkspace()`、`renderAdminWorkspace()` 或对应的 `renderXxxView()` 里给这个 `main` 加返回内容。
5. 修改 `index.html` 里 CSS/JS 的 `?v=` 资源版本号，降低同事打开线上预览时看到旧缓存的概率。

URL 切换：点击侧边栏会自动用 `history.replaceState` 把 URL 同步成对应 hash；用户改地址栏触发 `hashchange`，会从 `ROUTES` 反查到 state 并整页重绘。两边都不走真实路由，因此原型可以直接 `file://` 打开也能工作。

## 新需求通常改哪里

- 改左侧导航：优先改 `src/data.js` 的 `NAV_GROUPS`。
- 改销售准备标签：优先改 `src/data.js` 的 `SALES_TABS`。
- 改外贸流程阶段：优先改 `src/data.js` 的 `TRADE_STAGES`。
- 改了解公司资料模块：优先改 `src/data.js` 的 `COMPANY_MODULES`。
- 改产品与市场表格：优先改 `src/data.js` 的 `PRODUCT_ROWS`。
- 改案例知识库：优先改 `src/data.js` 的 `CASE_CATEGORIES` 和 `CASE_ITEMS`。
- 改客户Kass：优先改 `src/data.js` 的 `KASS_GROUPS` 和 `KASS_FLOW_STAGES`。
- 改账号弹层、邀请码兑换、团队/企业切换：优先改 `src/app.js` 的 `renderAccountSettingsPopup()`、`renderInviteRedeemModal()` 和相关事件绑定。
- 改后台菜单：优先改 `src/data.js` 的 `ADMIN_NAV_ITEMS`，再看 `src/app.js` 的后台路由映射。
- 改后台 User Preview 指标和表格字段：优先改 `src/data.js` 的 `ADMIN_USER_PREVIEW_*` 数据；交互改 `src/app.js` 的 `renderAdminUserPreview()`、`renderUserPreviewReportBuilder()`、`bindUserPreviewReportControls()`。
- 改后台经营分析（角色化驾驶舱）：数据改 `src/data.js` 的 `ADMIN_BUSINESS_*`；渲染和交互改 `src/app.js` 的 `renderAdminBusiness()`、`renderBusinessDashboardTab()`、`renderBusinessFeatureTab()` 和 `bindEvents()` 里的 `data-business-*` 绑定。
- 改后台 `用户` / `代理` 子菜单：先在 `src/data.js` 的 `ADMIN_NAV_ITEMS` 改菜单（`parent` 字段决定 group），数据改 `ADMIN_USER_POOL_ROWS` / `ADMIN_PAID_POOL_ROWS` / `ADMIN_SALES_ROWS` / `ADMIN_ACTIVE_USER_ROWS` / `ADMIN_PAID_USER_ROWS` / `ADMIN_AGENT_ROWS`；页面渲染改 `src/app.js` 的 `renderAdminUserPool()` / `renderAdminPaidPool()` / `renderAdminUserSales()` / `renderAdminActiveUsers()` / `renderAdminPaidUsers()` / `renderAdminAgents()`，共用 helper：`renderAdminPageStats()`、`renderAdminSegmentFilter()`。`renderAdminSidebar()` 已改为按 `ADMIN_NAV_ITEMS.parent` 自动聚合 group，新增 group 只改数据即可。
- 改后台邀请码管理：优先改 `src/data.js` 的 `ADMIN_INVITE_ROWS`；生成邀请码表单和反馈改 `src/app.js` 的 `renderAdminInviteCodes()` 和相关事件绑定。
- 改后台 AI 人设/模型管理：优先改 `src/data.js` 的 `ADMIN_CHARACTER_ROWS`、`ADMIN_MODEL_ROWS`；弹窗和表格行为改 `src/app.js`。
- 改界面样式和动效：改 `src/styles.css`。
- 改点击行为、抽屉、toast：改 `src/app.js`。

## 哪些地方别碰

- 不要写入真实 Token、Cookie、手机号、邮箱或客户隐私。
- 不要把真实线上历史记录复制到 `HISTORY_ITEMS`。
- 不要在原型里接真实删除、发送、保存、导出接口。
- 后台刷新数据、导出报表、生成邀请码、AI 人设保存、AI 模型保存、账号团队/企业切换都必须保持为原型反馈。
- 不要在页面里写开发说明；说明写在 `CONTEXT.md` 或代码注释中。

## 如何验证

推荐验证方式：

1. 打开 `index.html`。
2. 检查左侧导航是否可展开和切换。
3. 检查 `销售准备 > 外贸流程` 是否默认展示。
4. 点击 12 个阶段，确认右侧详情随之切换。
5. 点击 `了解公司`，切换公司资料模块，确认右侧编辑器随之切换。
6. 点击 `产品&市场`，选择不同产品行，确认下方摘要随之切换。
7. 点击 `案例知识库`，切换资料分类、标签和搜索词，确认案例列表变化。
8. 展开 `客户Kass`，点击 `A` 或 `B`，确认分组页、客户档案、跟进流程图和客户跟进记录出现。
9. 点击右下角 `Kass AI 助手` 圆形按钮，确认浮窗展开，包含当前客户、客户等级、阶段、跟进条数、加载会话记录和禁用输入区。
10. 点击 `教学视频`、`导出文件`、`历史`，确认抽屉或 toast 正常出现。
11. 点击账号卡，确认账号弹层、邀请兑换、团队/企业飞出层、用量明细跳转和退出登录原型反馈正常。
12. 进入 `#/admin/user`（用户总表 = User Preview 看板），检查时间范围、数据概览、功能调用总看板、用户字段报表、字段展开/收起、手机号列、`使用时间` / `最后活跃时间` 格式，以及子账号管理里新增子账号必须先输入手机号和初始分配积分。
13. 进入 `#/admin/business`，切换管理员/运营/客服三种角色：管理员/运营可见 2 个 Tab（经营看板：趋势/漏斗/渠道/销售榜；功能洞察：四象限/ROI 表）；客服角色应看到「客服不开放经营分析」占位提示。
14. 逐一打开 `#/admin/user-pool`、`#/admin/paid-pool`、`#/admin/sales`、`#/admin/active-user`、`#/admin/paid-user`，确认每页都有 4 张顶部统计卡片 + 筛选条 + 表格（6-8 行数据）+ 分页；行内操作按钮点击触发 toast。
15. 进入 `#/admin/agent`，确认代理总览 4 张统计 + 列表 + 调整分成等操作按钮。
16. 进入 `#/admin/user`（原用户总表），确认页面与之前一致、未被破坏。
17. 进入 `#/admin/invite-code`，检查生成邀请码表单和邀请码列表。
18. 进入 `#/admin/knowledge-base`、`#/admin/ai-character`、`#/admin/ai-model`，确认后台菜单切换和表格布局正常。
19. 调整到窄屏，确认文字不重叠、不溢出。
