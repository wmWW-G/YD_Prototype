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

本项目只复刻界面结构和交互手感，不接真实接口，不写入真实客户资料，不复制线上历史记录和账号隐私。

## 入口在哪里

主入口是：

```text
index.html
```

浏览器直接打开即可查看。如果需要更稳定地测试本地资源，也可以在本目录启动一个静态服务器。

## 文件结构

```text
reverse-yingdan/
  CONTEXT.md
  index.html
  assets/
    icons/
  src/
    app.js
    data.js
    styles.css
```

各文件职责：

- `index.html`：页面骨架，只放必要容器和脚本引用。
- `src/styles.css`：全部视觉样式、响应式规则和动效。
- `src/data.js`：导航、销售准备标签、成交阶段等静态数据。
- `src/app.js`：渲染函数、事件绑定、抽屉、toast 和状态切换。
- `assets/icons/`：本地 SVG 图标。后续新增图标时优先复制进这里，再在 `src/data.js` 引用相对路径。

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
- `popup`：当前打开的轻量弹层，例如附件、模型、顶部历史、设置。
- `historySearchOpen` / `historySearchQuery`：侧边栏历史搜索状态。
- `selectedModel`：当前模型选择。
- `chatDraft` / `isGenerating` / `generatedResult`：聊天输入、模拟生成和结果状态。

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

## URL 路由

为了方便每个界面单独维护、刷新和分享，原型用 hash 路由（不依赖任何静态服务器 rewrite），全部映射定义在 `src/app.js` 顶部的 `ROUTES` 数组里。

| Hash 路径 | 对应界面 |
| --- | --- |
| `#/ask` | 问一下（默认首屏） |
| `#/sales-prep/flow` | 销售准备 > 外贸流程（基础版） |
| `#/sales-prep/flow/a` | 外贸流程 · A 变体：阶段进度条 + 可勾选 checklist + 键盘 ← / → |
| `#/sales-prep/flow/b` | 外贸流程 · B 变体：问 AI 按钮 + 本阶段客户 mini 列表 + 资料预览卡 |
| `#/sales-prep/flow/c` | 外贸流程 · C 变体：KPI chip + 常见错误 + 上下阶段卡 |
| `#/sales-prep/flow/d` | 外贸流程 · D 变体：教学视频 + 私房笔记 + 阶段对比 |
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

新增页面的步骤：

1. 在 `src/data.js` 的 `NAV_GROUPS` 里加一条导航。
2. 在 `src/app.js` 的 `ROUTES` 数组里加一条 `{ hash, main, tab? }`。
3. 在 `getChatLabels` 或对应的 `renderXxxView()` 里给这个 `main` 加返回内容（如果是聊天壳，只要加 labels；如果是工作台，要新写一个 render 函数）。

URL 切换：点击侧边栏会自动用 `history.replaceState` 把 URL 同步成对应 hash；用户改地址栏触发 `hashchange`，会从 `ROUTES` 反查到 state 并整页重绘。两边都不走真实路由，因此原型可以直接 `file://` 打开也能工作。

## 新需求通常改哪里

- 改左侧导航：优先改 `src/data.js` 的 `NAV_GROUPS`。
- 改销售准备标签：优先改 `src/data.js` 的 `SALES_TABS`。
- 改外贸流程阶段：优先改 `src/data.js` 的 `TRADE_STAGES`。
- 改了解公司资料模块：优先改 `src/data.js` 的 `COMPANY_MODULES`。
- 改产品与市场表格：优先改 `src/data.js` 的 `PRODUCT_ROWS`。
- 改案例知识库：优先改 `src/data.js` 的 `CASE_CATEGORIES` 和 `CASE_ITEMS`。
- 改客户Kass：优先改 `src/data.js` 的 `KASS_GROUPS` 和 `KASS_FLOW_STAGES`。
- 改界面样式和动效：改 `src/styles.css`。
- 改点击行为、抽屉、toast：改 `src/app.js`。

## 哪些地方别碰

- 不要写入真实 Token、Cookie、手机号、邮箱或客户隐私。
- 不要把真实线上历史记录复制到 `HISTORY_ITEMS`。
- 不要在原型里接真实删除、发送、保存、导出接口。
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
11. 调整到窄屏，确认文字不重叠、不溢出。
