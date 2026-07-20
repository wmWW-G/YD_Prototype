# CONTEXT.md

## 项目目标

本项目用于逆向复刻线上「赢单外贸成交顾问」界面，产出一个可以直接打开、演示、提交 git、交给开发同事继续实现的静态前端原型。

当前目录还包含一个「赢单询盘分析助手」Chrome 浏览器插件内测包，用于把网页里的客户询盘抓取到右侧分析面板，并通过 Coze 生成询盘分析和回复建议。它是独立于主原型页面的内测交付物，不是 GitHub Pages 静态原型的一部分。

当前目录还新增了 `dify-chatflows/`，用于记录用户在 Dify 创建、并准备应用于赢单业务的对话型应用和 Chatflow。它和 `coze-workflows/` 一样属于工作流资料库，不是主静态原型代码。

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
- `客户Kass`：复刻 `/customer-kass/A` 这种分组页结构，包括 A/B 分组、分组顶部「今日该推进」提醒、客户列表、客户档案、跟进流程图、客户跟进记录、右下角 Kass AI 助手按钮和展开浮窗。
- 抽屉、toast、菜单展开和阶段切换动效。
- 本地 SVG 导航图标，来源为 `/Users/garden/Desktop/1/vinco-icons`，已复制到 `assets/icons/`。
- 侧边栏历史搜索、历史项编辑/删除图标、顶部历史下拉。
- 通用聊天输入框的附件弹层、模型下拉、输入后发送按钮启用；用户输入后切到左右分栏对话态，左侧保留问题和继续输入区，右侧展示回答正文和复制入口。
- 客户Kass入口设置弹层和账号设置弹层。
- 账号弹层里的邀请码兑换积分、团队/企业空间切换飞出层、用量明细跳转和升级入口。
- 透明后台入口：`#/ask` 顶部右侧有一个 hover 才轻微显色的圆形按钮，点击进入后台管理。
- 后台管理壳：左侧后台菜单、顶部面包屑、用户界面返回按钮、首页、知识库管理、用户总表（即原 User Preview 看板）、邀请码管理、AI 人设管理、AI 模型管理。
- `后台管理 > User Preview`：时间范围筛选、数据概览 KPI、功能调用总看板、可折叠字段配置、用户字段流水账报表和子账号管理；子账号管理只保留手机号、积分、启停和调积分口径，不设计角色权限。
- `后台管理 > 经营分析`：角色化运营驾驶舱（管理员/运营/客服三种视角），含经营看板、功能洞察两个 Tab。User Preview 仍保留作为字段流水自由报表，不被替代。
- `后台管理 > 用户` 分组：参考同事截图重构出的用户分类菜单，含经营分析、用户总表（沿用旧 `/admin/user`）、公海客户、付费公海、销售信息、活跃用户、付费用户和邀请码管理；受邀来源信息统一进入用户总表的使用详情。
- `后台管理 > 代理` 分组：经销代理总览，含拉新数、付费数、累计分成和状态。
- `后台管理 > 邀请码管理`：生成邀请码表单、预览提示和邀请码列表，用于表达销售同事发放试用福利的原型流程。
- `客户开发`：一级业务入口，用于通过 AI 获客目标生成候选客户名单，不归入 `技能Skill` 子菜单；当前原型链路为「输入开发目标/产品/国家/客户类型 → AI 找客户中 → 生成客户列表 → 点公司只看右侧公司信息 → 点获取联系人信息跳到联系人新界面 → 在联系人表里点某个人获取邮箱」。先保持轻量，不做客户分级、状态分栏和复杂推进流。
- 所有通用 AI 对话功能页：顶部左侧固定显示 Dify 应用类型和 API Key 配置栏，支持选择「对话型应用」或「Chatflow」。每个功能页独立保存配置，重复保存会覆盖更新；前端只能读取掩码，原始 Key 由后端加密保存。发送后左侧按轮次保留问题，右侧通过真实 SSE 实时展示最新过程和 Markdown 答案，并按页面独立复用 `conversation_id`。过程区展示节点、工具名、显式搜索词，以及 Dify API 明确定义为公开步骤的 `agent_thought.thought`；新步骤覆盖当前可见步骤，正式答案开始后自动折叠，用户可展开历史。思考耗时从发送开始就每秒动态更新，正式答案、完成或失败事件到达后冻结；折叠标题继续显示“步骤数 · 思考了 X 分 X 秒”。计时只更新对应文字节点，不触发整页重绘。模型隐藏的 `<think>`、prompt、observation 和工具输出仍不会发给浏览器。流式期间只局部更新当前回答 DOM，不再重建整个 `#app`，避免每个字符到达时整屏闪烁。
- `成交顾问 > 客户背调顾问`：默认类型为 Chatflow，继续沿用现有背调 Dify 配置和成本追踪能力。
- `技能Skill > YD Artifact`：默认类型为 Chatflow，沿用通用 Dify 对话、SSE 和多轮上下文；回答中的受控代码块会在正文原位置转换为流程图、时间线、数据图、指标卡或隔离预览。已适配 `mermaid`、`echarts`、`svg`、受控 `ui` JSON 和显式 `html-artifact`。`html-artifact` 可在 opaque-origin iframe 内运行本地 HTML/CSS/JavaScript，但只授予 `allow-scripts`，并通过 CSP、源码预检和宿主桥接阻断联网、外部资源、存储、表单提交、弹窗和越界导航；普通 `html` 代码块仍不会执行。
- `技能Skill > 市场调研`：默认类型为对话型应用，已适配普通 Chatbot/Agent 的流式事件和多轮上下文。

主原型大部分只复刻界面结构和交互手感，不写入真实客户资料，不复制线上历史记录和账号隐私。当前真实调用例外包括：白名单内的通用对话页会通过 Dify 代理调用各自保存的应用，浏览器插件内测包会调用 Coze 接口验证真实询盘分析链路。它们都只能作为内部验证或原型验证使用，不能当作公开生产能力直接发布。

## 项目负责人和工作方式

本项目的产品方向、功能路径、UI 原型和 AI 工作流设计主要由用户负责。用户在这个项目里的角色不是单纯的代码使用方，而是：

- 产品经理：决定赢单应用要覆盖哪些外贸业务场景、功能入口、字段和用户流程。
- 原型图 UI 设计者：判断页面信息架构、布局优先级、交互方式和视觉反馈是否符合真实产品使用。
- AI 工作流设计者：设计各功能背后的 AI 生成、提炼、归类、判断和成交建议逻辑。
- AI 工作流维护者：提供、验证和整理 Coze/扣子工作流、Dify Chatflow 的调用链接、schema/参数、调用函数、节点画布和真实测试结果。

因此后续协作时，代码修改要服务于用户的产品原型判断。界面上只呈现用户真实会操作的内容；产品意图、技术说明、扣子调用细节、Dify 调用细节和后续开发注意事项，应沉淀在 `CONTEXT.md`、代码注释、`coze-workflows/` 或 `dify-chatflows/`，不要写进用户可见的原型页面。

AI 工作流是本项目的重要组成部分，但当前主原型仍保持静态前端形态。Coze/扣子工作流资料统一维护在 `coze-workflows/`，Dify 对话应用与 Chatflow 资料统一维护在 `dify-chatflows/`。页面中只表现用户真实会操作的入口、字段和状态；Dify 配置保存继续经 Vercel + Upstash Redis，聊天长 SSE 经 Cloudflare Worker 调用 Dify。新增其它真实 API 前仍必须先确认安全边界和代理方案。

## 入口在哪里

主入口是：

```text
index.html
```

浏览器直接打开即可查看。如果需要更稳定地测试本地资源，也可以在本目录启动一个静态服务器。

浏览器插件入口是：

```text
browser-extension/manifest.json
```

内测分发包是：

```text
yingdan-inquiry-extension-v0.2.0.zip
```

同事测试插件时，解压 zip 后在 Chrome 的 `chrome://extensions` 里开启开发者模式，选择「加载已解压的扩展程序」，再选解压后的插件目录。

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
  赢单api.md
  index.html
  package.json
  vercel.json
  wrangler.jsonc
  sw.js
  yingdan-inquiry-extension-v0.2.0.zip
  api/
    dify-chat.js
    dify-config.js
    dify-customer-research.js
    dify-runtime-config.js
  cloudflare-worker/
    dify-chat-worker.mjs
  lib/
    dify-api-client.js
    dify-config-store.js
    dify-core.js
    dify-http.js
  assets/
    icons/
    generated/
  browser-extension/
    manifest.json
    background.js
    content-script.js
    inquiry-analyzer.js
    inquiry-analyzer.test.js
    icons/
  coze-workflows/
  dify-chatflows/
  src/
    app.js
    data.js
    dify-artifact.js
    dify-config.js
    styles.css
  tests/
```

各文件职责：

- `index.html`：页面骨架，只放必要容器和脚本引用。
- `sw.js`：自动刷新 Service Worker，让 GitHub Pages 上的 HTML、JS、CSS 优先走网络，减少同事看到旧缓存的概率；由 `src/app.js` 注册。
- `vercel.json`：Vercel Serverless 配置，用于设置 Dify 配置、兼容聊天代理和内部配置桥接的最大执行时间。
- `wrangler.jsonc`：Cloudflare Worker 部署配置；声明长流式 Worker 入口和 Vercel 内部配置接口地址，不包含 Secret。
- `api/dify-config.js`：Dify 配置接口；GET 只返回掩码和应用摘要，POST 校验 Key 对应的真实 App 类型并覆盖保存。
- `api/dify-runtime-config.js`：仅供 Cloudflare Worker 调用的私有配置桥接；使用固定时间比较校验内部 Bearer Token，在 Vercel 内读取现有 Redis/环境变量配置，不开放 CORS、不允许缓存。
- `api/dify-chat.js`：原 Vercel 通用聊天代理，保留为回滚入口；正式前端聊天已切到 Cloudflare Worker。
- `cloudflare-worker/dify-chat-worker.mjs`：正式 Dify 长流式代理；先通过私有桥接读取当前页面配置，再直接连接 Dify，发送 15 秒 SSE 心跳并复用现有事件归一化逻辑。
- `api/dify-customer-research.js`：旧客户背调专用代理，保留兼容和排障用途。
- `lib/dify-*.js`：Dify 模式识别、增量 SSE 解析、跨分块 `<think>` 过滤、公开过程摘要、加解密、Upstash Redis 存储和 HTTP 共用逻辑。
- `src/styles.css`：全部视觉样式、响应式规则和动效。
- `src/data.js`：用户侧导航、销售准备标签、成交阶段、后台菜单、User Preview 报表、邀请码、AI 人设和模型等静态数据。
- `src/app.js`：渲染函数、hash 路由、事件绑定、抽屉、toast、弹层、账号弹层、后台管理和状态切换。
- `src/dify-artifact.js`：YD Artifact 的前端富内容适配层；识别特殊 fenced code block，生成安全的本地 SVG/结构化卡片，或把静态 SVG、显式交互式 HTML Artifact 放入受 CSP 和 `sandbox` 约束的 iframe。交互式 iframe 通过受校验的 `postMessage` 只向宿主回报内容高度，不获得宿主数据或 API。
- `src/dify-config.js`：Dify 对话页白名单、每页独立配置状态和会话状态、浏览器 SSE 增量解析器，以及过程覆盖/历史/折叠状态归并函数。
- `assets/icons/`：本地 SVG 图标。后续新增图标时优先复制进这里，再在 `src/data.js` 引用相对路径。
- `assets/generated/`：当前原型使用的本地视觉素材。
- `browser-extension/manifest.json`：Chrome MV3 插件清单，定义 action、background service worker、content script、权限和图标。
- `browser-extension/background.js`：插件后台逻辑，负责右键菜单、点击插件图标打开分析面板、调用 Coze `/v3/chat`、解析 SSE、保存本地 conversation/user id。
- `browser-extension/content-script.js`：注入网页的右侧询盘分析面板，负责抓取页面文本、展示「开始分析」、发送追问、渲染安全 Markdown。
- `browser-extension/inquiry-analyzer.js`：本地询盘提取和初步分析 helper，content script 依赖它做文本归一化和页面内容判断。
- `browser-extension/inquiry-analyzer.test.js`：本地询盘提取 helper 的 Node 测试。
- `browser-extension/icons/`：插件图标，当前来自 `/Users/garden/YD/logo/logo1.svg`，已处理透明底。
- `yingdan-inquiry-extension-v0.2.0.zip`：当前内部测试用插件压缩包。
- `package.json`：轻量仓库元信息和验证脚本；`npm run check:cloudflare` 做 Worker dry-run，`npm run deploy:cloudflare` 发布 Worker。
- `AI板块统计.md`：统计客户Kass、销售准备等区域的 AI 能力现状和后续整理建议。
- `赢单api.md`：赢单后端接口文档快照，用于查阅 auth、账号、邀请码、计费、积分等接口路径、请求参数和字段口径。它是接口参考资料，不是主静态原型代码；涉及线上真实行为、安全暴露或返回字段时，必须重新做 live 验证，不能只按文档下结论。
- `coze-workflows/`：扣子工作流资料库，记录工作流用途、schema、调用函数、字段映射和验证状态。
- `dify-chatflows/`：Dify 对话应用与 Chatflow 资料库，记录应用类型、入口、参数快照、调用函数、API 测试记录和赢单字段映射。
- `backups/`：历史备份，只用于查旧实现或回看改动前状态，不主动修改。
- `.claude/`、`audits/`、`workbench/`：工具运行、截图审计或临时运行记录目录，默认不作为主工程编辑目标。

## 当前技术栈

主原型当前使用 `HTML + CSS + 原生 JavaScript`。

选择理由：

- 优点：不用构建工具，方便直接打开和 git 交付。
- 优点：适合逆向 UI 原型，开发同事能快速看结构和业务数据。
- 缺点：后续如果要做大量真实业务状态、接口和权限，建议再迁移到 React 或 Vue。

浏览器插件当前使用 Chrome Manifest V3 + 原生 JavaScript：

- 优点：不需要构建工具，方便打 zip 给同事加载已解压扩展。
- 优点：可以直接在客户询盘所在网页上打开右侧面板，贴近真实业务动作。
- 缺点：当前内测版有内置 Coze 测试 Token，不能作为公开上架版本。
- 缺点：`host_permissions` 覆盖 `http://*/*` 和 `https://*/*`，公开上架前需要重新评估最小权限、隐私政策和登录方案。

## 界面和原型设计规则

- 第一屏直接展示可操作界面，不做营销式落地页。
- 优先复刻赢单的真实信息架构：左侧导航 + 右侧任务工作区。
- 原型要能表达用户流程，不只是静态好看的图。
- 原型不是功能讲解稿，界面里不要出现解释产品能力、说明设计目的、介绍开发计划或指导用户如何理解原型的文字。
- 如果某段文案不能直接帮助用户完成当前业务动作，就不要放进界面；尤其避免大段说明卡片、流程教学卡片、功能介绍卡片和“这里用于……”式占位文字。
- 动画必须服务功能理解和操作手感，不要做无意义装饰；优先使用轻量的 hover、active、loading、展开收起、结果生成、卡片进入和状态切换动画。
- 新增交互或动画时，只实现用户明确要求的对应流程和反馈，不要擅自增加保存、发送、生成、同步、待办等额外功能入口，避免原型交付给开发时产生多余需求坑。
- 每个页面必须能看出当前是什么业务场景、用户要输入什么、有哪些可选条件、点击后预期会生成什么、下一步可以去哪里。
- 新增功能时，优先补齐用户流程，再考虑视觉细节。
- 不要为了炫技引入复杂动画、复杂框架或过多视觉装饰。
- 操作型界面要安静、清晰、适合反复使用。
- 卡片、按钮、输入框要有稳定尺寸，避免文字挤压和布局跳动。
- 移动端和桌面端都要检查文字不重叠、不溢出。

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
- `difyFeatureConfigs`：按功能页 ID 保存顶栏的应用类型、掩码、应用摘要、加载和保存状态；不保存原始 API Key。
- `difyFeatureSessions`：按功能页 ID 保存 `messages`、`conversationId`、`userId`、错误和生成状态，避免不同 Dify App 串上下文。助手消息还保存 `processSteps`、`currentProcess`、`processCollapsed`、`processExpanded` 和 `answerStarted`，用于“最新过程覆盖显示、最终答案折叠、按需展开历史”。
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

浏览器插件状态主要在 Chrome local storage 中维护：

- `cozeUserId`：当前浏览器插件实例的 Coze 用户 ID。
- `cozeConversationId`：连续追问时复用的 Coze 会话 ID。
- `cozeApiToken`：用户手动覆盖的 Coze Token；如果没有有效 `pat_` Token，内测版会走内置测试 Token。

浏览器插件内部消息名：

- `YD_OPEN_ANALYZER`：background 通知 content script 打开右侧分析面板。
- `YD_COZE_CHAT`：content script 请求 background 调用 Coze。
- `YD_GET_PAGE_CONTEXT`：background 或 content script 获取当前网页可分析文本。
- `YD_SAVE_COZE_TOKEN` / `YD_GET_COZE_SETTINGS` / `YD_RESET_COZE_CONVERSATION`：保留的设置和会话管理消息，当前主 UI 不暴露 Token 输入。

## 功能区域命名约定

后续讨论和修改需求时，统一使用下面这套命名，避免“页面、模块、区域”混用导致定位不清。

一级功能区是左侧主导航里的大入口：

- `问一下`：通用外贸问答。
- `销售准备`：成交前资料准备、外贸流程、公司资料、产品市场和案例知识库。
- `客户开发`：一级获客入口，不属于 `技能Skill`；负责找客户、筛线索、生成触达动作和入客户Kass。
- `成交顾问`：围绕具体客户和成交动作的顾问。
- `技能Skill`：更细的外贸工作流工具。
- `客户Kass`：客户档案/客户上下文。
- `历史记录`：历史会话和历史任务。
- `账号/用量/升级`：通过账号卡、用量页和升级支付路径进入，不是左侧一级导航。
- `后台管理`：通过隐藏后台入口或后台路径进入，不是用户侧左侧导航。

`销售准备` 下的二级模块：

- `外贸流程`
- `了解公司`
- `产品&市场`
- `案例知识库`

历史资料里出现过 `了解产品和市场`、`公司资产`、`外贸全流程 SOP` 等叫法。实现时以当前 `src/data.js` 的 `SALES_TABS` 和 `src/app.js` 的路由为准；如果要恢复旧模块，必须同步补导航、路由、渲染函数和样式。

`成交顾问` 下的二级模块：

- `客户背调顾问`
- `场景谈判顾问`
- `询盘分析回复`

`技能Skill` 下的二级模块：

- `YD Artifact`
- `市场调研`
- `新客开发信`
- `客诉处理`
- `客户激活`
- `关系维护`
- `海外电销`
- `视频会议`
- `地推陌拜`
- `来访接待`
- `展会成交`
- `组合标题`

当前代码里没有独立的 `技能Skill > 谈判` 左侧入口；谈判能力主要体现在 `成交顾问 > 场景谈判顾问`、`技能Skill > 展会成交` 和外贸流程阶段按钮中。

右侧主内容区域统一叫 `工作区`。工作区内固定区域命名：

- `输入区`：大文本框、附件、模型选择、语音、发送按钮。
- `筛选条件区`：国家、客户类型、谈判场景、开发目的等 chip 或下拉项。
- `推荐动作区`：输入区下方的快捷任务卡片，例如客户画像、报价邮件、现场话术。
- `流程说明区`：用 1、2、3 卡片说明这个功能怎么走的区域。
- `结果预览区`：点击发送或 AI 生成后出现的结果内容。
- `抽屉`：右侧滑出的面板，例如历史、教学视频。
- `弹窗`：居中弹出的面板，例如附件、账号设置、客户编辑。
- `插件侧边面板`：浏览器插件注入到网页右侧的 Shadow DOM 面板，不属于主原型工作区。

需求描述优先按这个格式：

```text
一级功能区 > 二级模块 > 子流程/子页面 > 具体区域
```

示例：`销售准备 > 了解公司 > 输入区`、`技能Skill > 展会成交 > 展中客户接待 > 结果预览区`。

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
| `#/sales-prep` | 销售准备默认入口，等同外贸流程 |
| `#/sales-prep/flow` | 销售准备 > 外贸流程 Flow：问 AI 按钮 + 资料预览卡 + 教学视频 |
| `#/sales-prep/company` | 销售准备 > 了解公司 |
| `#/sales-prep/market` | 销售准备 > 产品&市场 |
| `#/sales-prep/cases` | 销售准备 > 案例知识库 |
| `#/agents/customer-research` | 成交顾问 > 客户背调顾问 |
| `#/agents/negotiation-scene` | 成交顾问 > 场景谈判顾问 |
| `#/agents/inquiry-reply` | 成交顾问 > 询盘分析回复 |
| `#/skills/yd-artifact` | 技能 > YD Artifact |
| `#/skills/market-research` | 技能 > 市场调研 |
| `#/customer-development` | 客户开发 |
| `#/customer-development/searching` | 客户开发 > AI 找客户中 |
| `#/customer-development/results` | 客户开发 > 候选客户列表 |
| `#/customer-development/contacts` | 客户开发 > 联系人信息 |
| `#/customer-development/contacts/0`、`#/customer-development/contacts/1`、`#/customer-development/contacts/2` | 客户开发 > 联系人邮箱揭示状态 |
| `#/skills/customer-development` | 客户开发旧兼容入口，仍打开一级客户开发页面 |
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
- 改外贸流程 Flow 页面结构：优先改 `src/app.js` 的 `renderFlowView()`、`renderFlowMaterialPreviews()`、`renderFlowVideoCard()` 和 `renderFlowAiCard()`；当前已删除「我在该阶段的客户」mini 列表，不再维护 `FLOW_STAGE_CUSTOMERS`。
- 改了解公司资料模块：优先改 `src/data.js` 的 `COMPANY_MODULES`。
- 改产品与市场表格：优先改 `src/data.js` 的 `PRODUCT_ROWS`。
- 改案例知识库：优先改 `src/data.js` 的 `CASE_CATEGORIES` 和 `CASE_ITEMS`。
- 改客户开发：它是一级入口，不是 `技能Skill` 子菜单；优先改 `src/data.js` 的 `CUSTOMER_DEVELOPMENT`；页面结构改 `src/app.js` 的 `renderCustomerDevelopmentView()`；样式改 `src/styles.css` 的 `.customer-dev-*`。
- 改通用 Dify 对话页：页面白名单和默认类型改 `src/dify-config.js`；顶栏配置看 `renderDifyConfigBar()`、`loadDifyFeatureConfig()`、`saveDifyFeatureConfig()`；多轮消息存在 `state.difyFeatureSessions[featureId]`；真实调用和浏览器流读取看 `sendDifyFeatureDraft()`；过程 UI 看 `renderDifyProcessPanel()`；Markdown 渲染看 `renderMarkdown()` / `renderInlineMarkdown()`。配置保存看 `api/dify-config.js`，Cloudflare 长流看 `cloudflare-worker/dify-chat-worker.mjs`，私有配置桥接看 `api/dify-runtime-config.js`，上游增量流和过程脱敏看 `lib/dify-api-client.js`；`api/dify-chat.js` 仅保留回滚。
- 改 YD Artifact：入口、Dify 配置和会话仍走上述通用链路；特殊代码块识别、Mermaid/ECharts 本地渲染、受控 `ui` 组件和沙箱策略改 `src/dify-artifact.js`，页面视觉改 `src/styles.css` 的 `.yd-artifact-*`；Dify LLM System Prompt 改 `dify-chatflows/技能Skill-YD-Artifact/prompt.md`。不要执行普通 `html`、远程脚本或未经校验的 SVG；交互代码只能放在显式 `html-artifact` 中，并保持 `sandbox="allow-scripts"`、无 `allow-same-origin` 的边界。
- 改客户背调顾问：数据改 `src/data.js` 的 `CUSTOMER_RESEARCH_FLOW`；它复用上述通用 Dify 对话壳，但默认应用类型是 Chatflow，内部成本面板仍由 `renderCustomerResearchBillingTracePanel()` 控制。
- 改客户Kass：优先改 `src/data.js` 的 `KASS_GROUPS` 和 `KASS_FLOW_STAGES`。如果改分组顶部「今日该推进」，看 `src/app.js` 的 `buildKassTodayReminder()` / `renderKassGroupTodayCard()` 和 `src/styles.css` 的 `.kass-today-*` / `.kass-group-today-*`。
- 改账号弹层、邀请码兑换、团队/企业切换：优先改 `src/app.js` 的 `renderAccountSettingsPopup()`、`renderInviteRedeemModal()` 和相关事件绑定。
- 改后台菜单：优先改 `src/data.js` 的 `ADMIN_NAV_ITEMS`，再看 `src/app.js` 的后台路由映射。
- 改后台 User Preview 指标和表格字段：优先改 `src/data.js` 的 `ADMIN_USER_PREVIEW_*` 数据；交互改 `src/app.js` 的 `renderAdminUserPreview()`、`renderUserPreviewReportBuilder()`、`bindUserPreviewReportControls()`。
- 改后台经营分析（角色化驾驶舱）：数据改 `src/data.js` 的 `ADMIN_BUSINESS_*`；渲染和交互改 `src/app.js` 的 `renderAdminBusiness()`、`renderBusinessDashboardTab()`、`renderBusinessFeatureTab()` 和 `bindEvents()` 里的 `data-business-*` 绑定。
- 改后台 `用户` / `代理` 子菜单：先在 `src/data.js` 的 `ADMIN_NAV_ITEMS` 改菜单（`parent` 字段决定 group），数据改 `ADMIN_USER_POOL_ROWS` / `ADMIN_PAID_POOL_ROWS` / `ADMIN_SALES_ROWS` / `ADMIN_ACTIVE_USER_ROWS` / `ADMIN_PAID_USER_ROWS` / `ADMIN_AGENT_ROWS`；页面渲染改 `src/app.js` 的 `renderAdminUserPool()` / `renderAdminPaidPool()` / `renderAdminUserSales()` / `renderAdminActiveUsers()` / `renderAdminPaidUsers()` / `renderAdminAgents()`，共用 helper：`renderAdminPageStats()`、`renderAdminSegmentFilter()`。`renderAdminSidebar()` 已改为按 `ADMIN_NAV_ITEMS.parent` 自动聚合 group，新增 group 只改数据即可。
- 改后台邀请码管理：优先改 `src/data.js` 的 `ADMIN_INVITE_ROWS`；生成邀请码表单和反馈改 `src/app.js` 的 `renderAdminInviteCodes()` 和相关事件绑定。
- 改后台 AI 人设/模型管理：优先改 `src/data.js` 的 `ADMIN_CHARACTER_ROWS`、`ADMIN_MODEL_ROWS`；弹窗和表格行为改 `src/app.js`。
- 新增或更新 Coze/扣子工作流资料：优先维护 `coze-workflows/`，不要把 schema、调用函数或真实返回样例塞进页面文案。
- 新增或更新 Dify 对话应用或 Chatflow 资料：优先维护 `dify-chatflows/`，每个 App 单独建目录，记录应用类型、`chatflow.md`、`call-function.md`、`parameters.snapshot.json` 和 `api-test.md`。
- 查赢单后端账号、邀请码、计费或积分接口：可先看 `赢单api.md` 的接口路径和参数说明；如果要判断线上是否真的可用、是否需要鉴权、返回哪些敏感字段，必须用当前环境重新验证。
- 改界面样式和动效：改 `src/styles.css`。
- 改点击行为、抽屉、toast：改 `src/app.js`。
- 改浏览器插件：优先改 `browser-extension/content-script.js` 的面板体验、`browser-extension/background.js` 的 Coze 调用和消息分发、`browser-extension/inquiry-analyzer.js` 的本地询盘判断、`browser-extension/manifest.json` 的权限和图标声明。改完要重新打包 `yingdan-inquiry-extension-v0.2.0.zip`。

## 哪些地方别碰

- 不要写入真实 Token、Cookie、手机号、邮箱或客户隐私。
- 不要把浏览器插件里的内测 Coze Token 值复述到文档、聊天回复、截图说明或公开材料里。当前内置 Token 只是为了内部测试；公开上架前必须改成赢单登录或后端代理换取 Token。
- 不要把 Dify API Key 写入 `dify-chatflows/`、`CONTEXT.md`、`AGENTS.md`、前端代码、插件代码、提交信息或聊天回复。Dify 调用样例统一使用 `<DIFY_API_KEY>` 或 `$DIFY_API_KEY`。
- 不要把真实线上历史记录复制到 `HISTORY_ITEMS`。
- 不要在原型里接真实删除、发送、保存、导出接口。
- 不要把 `browser-extension/` 当作正式生产插件直接上架 Chrome Web Store；上架前必须先做权限收敛、隐私说明、登录/鉴权改造和 Token 移除。
- 后台刷新数据、导出报表、生成邀请码、AI 人设保存、AI 模型保存、账号团队/企业切换都必须保持为原型反馈。
- 不要在页面里写开发说明；说明写在 `CONTEXT.md` 或代码注释中。
- `backups/` 只用于查历史，不主动改里面的旧 HTML。
- `.claude/worktrees/` 是工具生成的工作树副本，不要把其中的文件当作当前主工程来更新。
- `.claude/`、`audits/`、`workbench/` 默认不主动修改、不主动提交。

## Dify 对话应用与 Chatflow 资料库

`dify-chatflows/` 用于记录用户在 Dify 里创建的、准备应用到赢单业务的对话型应用和 Chatflow。它与 `coze-workflows/` 平行维护：Coze 资料放 `coze-workflows/`，Dify 资料放 `dify-chatflows/`，不要混写。

当前已记录：

- `成交顾问 > 客户背调顾问 > 客户背调DeepSeek`：目录为 `dify-chatflows/成交顾问-客户背调顾问-客户背调DeepSeek/`。2026-07-04 已完成 `POST /chat-messages` 连通性测试和 `GET /parameters` 参数快照测试，均返回 HTTP `200`。
- `技能Skill > YD Artifact`：默认使用 Chatflow，通过页面顶栏绑定 Key。原发布版只约定 `mermaid`、`echarts`、`svg`；2026-07-20 已在 `dify-chatflows/技能Skill-YD-Artifact/prompt.md` 准备完整替换提示词，新增必须使用 `html-artifact` 的交互场景与自包含 HTML/CSS/原生 JavaScript 约束。该文件需要粘贴到 Dify LLM 节点并重新发布后才会影响线上回答。
- `技能Skill > 市场调研`：使用对话型应用模式，通过页面顶栏绑定 Key；具体 Key 只保存在 Vercel 环境变量或加密后的 Upstash Redis 中，不进入资料库。

类型识别规则：Dify `/info` 的 `chat`、`agent-chat` 对应页面「对话型应用」，`advanced-chat` 对应「Chatflow」。两类都由 API Key 识别具体 App，并调用 `/chat-messages`；`workflow` 不属于当前对话页适配范围。

每个 Dify Chatflow 目录建议包含：

- `chatflow.md`：记录赢单功能路径、Dify 应用名称、页面链接、基础 URL、主要接口、字段映射和维护状态。
- `call-function.md`：记录脱敏 curl 或后端封装示例，真实 API Key 必须用 `<DIFY_API_KEY>` 或 `$DIFY_API_KEY` 占位。
- `developer-handoff.md`：给开发同事的接入交接，说明前端、代理、Dify、上下文会话和正式产品建议。
- `parameters.snapshot.json`：记录 `GET /parameters` 的参数快照，不包含 API Key。
- `api-test.md`：记录真实试跑的 HTTP 状态、耗时、返回字段、异常和结论。

维护规则：

- 只用虚拟输入做连通性测试，不发送真实客户资料。
- 真实 API Key 只允许临时用于本机命令或后端环境变量，不落盘。
- 如果返回包含 `<think>...</think>` 等模型思考标签，正式展示前应过滤，只保留用户可读答案。
- 顶栏配置仍通过 Vercel `/api/dify-config` 保存：先请求 Dify `/info` 校验类型，再用 AES-256-GCM 加密 Key 并写入 Upstash Redis；GET 只返回掩码和应用摘要。正式聊天通过 Cloudflare Worker 调用 Dify；Worker 使用内部随机 Bearer Token 从 Vercel `/api/dify-runtime-config` 短请求读取运行时配置，普通浏览器无令牌时只能得到 401。未配置 Redis 时，Vercel 仍可读取对应环境变量作为兼容兜底。
- 2026-07-14 通用 `/api/dify-chat` 已改为端到端真流式 SSE：Vercel 边读 Dify 边写浏览器，不再等待完整 answer 后返回 JSON。公开事件为 `process`、`answer_delta`、`answer_replace`、`done` 和 `error`；`process` 包含节点、工具、搜索词和 Dify 明确公开的 Agent thought。前端收到新 `process` 时覆盖当前显示并保留最多 40 步历史，收到首个正式答案时自动折叠过程。
- Agent 的 `agent_message` 可能既包含“换关键词继续搜索”这类中间话术，也包含最后结论。代理会按新的工具/思考步骤 ID 分段：中间段作为浅色 `process` 覆盖显示，只在 `message_end` 时把最后一段提升为正式 `answer_replace`；普通 Chatbot/Chatflow 的 `message` 仍按 `answer_delta` 逐块展示。
- 2026-07-14 增加跨事件 `<think>` 过滤器，标签即使被拆在两个网络块中也不会短暂泄露；最终返回的 `billing_trace` 同样移除了 Agent thought、节点 inputs/outputs 和工具输出，只保留成本面板需要的事件计数、Tavily 查询和 credits。
- 2026-07-14 修复 SSE 每次到达都重建 `#app.innerHTML` 引发的整屏闪烁：同一过程阶段只更新 label/detail 文本，同一答案阶段只更新当前 Markdown 容器，结构切换也仅替换本轮回答。恢复展示 Dify 对话 API 明确公开的 `agent_thought.thought`，继续过滤 `<think>` 等隐藏思考；没有公开 thought、工具名或搜索词的空 Agent 协议步骤不再生成通用占位。
- 2026-07-14 安全 Markdown 渲染增加 GFM 风格表格：识别表头、分隔行、列对齐和数据行，单元格继续支持粗体、行内代码与链接，并保持先转义后渲染；窄屏表格只在自身容器横向滚动。
- 2026-07-20 新增 `技能Skill > YD Artifact`：沿用归一化 SSE 与安全 Markdown，只在该页面识别特殊 fenced code block；流式代码块未闭合时显示稳定骨架，闭合后在原位置替换为图形。Mermaid/ECharts 在本地解析为静态、安全 SVG；原始 SVG 继续使用无脚本 iframe；显式 `html-artifact` 使用只授予 `allow-scripts` 的 opaque-origin iframe，并以 CSP 阻断网络、外部资源、Worker、表单和子 frame。宿主只接受来源 iframe 匹配的限幅高度消息；其它 Dify 页面渲染路径保持不变。
- 2026-07-15 移除通用 Dify 对话页前端自设的 240 秒绝对超时：浏览器不再用 `AbortController` 提前中止仍在正常输出的 SSE，流保持到代理或 Dify 明确结束。
- 2026-07-15 正式聊天代理迁移到 `yd-prototype-dify-chat.gardengaoo.workers.dev`：Cloudflare 直接维持 Dify SSE，并每 15 秒发送注释心跳；Vercel 只承担毫秒级配置读写和受保护的运行时配置桥接，因此其 300 秒函数上限不再截断聊天回答。迁移时未导出、复制或提交原始 Dify Key；真实市场调研 smoke test 收到 `process`、`answer_replace`、`done`，HTTP 200 且成功创建 `conversation_id`。
- 2026-07-15 长 Agent 任务复核发现第一版 Worker 把响应依赖的流任务注册进 `ctx.waitUntil()`，约 30 秒后触发 `Network connection lost`；现已移除该调用，由仍在输出的 `TransformStream` 自身维持请求生命周期。随后又发现逐 token 过程事件和结束时二次解析整段 SSE 会触发 Workers Free 10 ms CPU 压力；现改为同一 Agent 段落最多发送少量覆盖更新，并在第一次解析时增量累计最终 ID、usage 和精简计费追踪，不再缓存后二次解析完整原文。
- 2026-07-15 使用“欧洲手持小风扇市场与销量”做最终长流验收：跨过原 30 秒断点并收到 8 次心跳，最终事件序列包含 `process`、`answer_replace`、`done`；正式答案 6188 字、成功创建 `conversation_id`、无 `error`。优化前同类流约 1.5 MB / 4106 个事件且没有 `done`，优化后约 19 KB / 19 个事件并完整结束。
- 配置存储所需环境变量：`DIFY_CONFIG_ENCRYPTION_KEY`、`KV_REST_API_URL`、`KV_REST_API_TOKEN`；也兼容 Upstash 常见的 `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`。
- YD Artifact 兜底 Key 使用 `DIFY_YD_ARTIFACT_API_KEY`；市场调研兜底 Key 使用 `DIFY_MARKET_RESEARCH_API_KEY`；客户背调兼容 `DIFY_CUSTOMER_RESEARCH_API_KEY` 或 `DIFY_API_KEY`。任何环境变量值都不能写入仓库或日志。
- 2026-07-08 已把本地静态服务 `http://localhost:8765`、`http://127.0.0.1:8765` 加入背调代理默认 CORS 白名单，并部署到 `yd-prototype-dify-proxy.vercel.app`；如果仍长时间无结果，优先排查 Dify Chatflow 执行耗时，而不是先怀疑浏览器没连上代理。
- 2026-07-08 已让 `api/dify-customer-research.js` 在聚合 Dify streaming 响应时保留 `billing_trace`，用于内部查看 `workflow_run_id`、节点事件、Agent 日志、Tavily 调用次数、`search_depth` 和估算 credits；这些字段只用于成本核算和排障，不应直接展示给普通用户。
- 2026-07-08 已在客户背调前端增加内部成本面板：URL 带 `?costDebug=1` 或 `?difyTrace=1` 时，每轮 Dify 回答下方会展示 `metadata.usage` 和 `billing_trace` 摘要，包括 token、模型费用、Tavily 调用次数、credits、搜索档位和 `workflow_run_id`。

## 如何验证

推荐验证方式：

1. 打开 `index.html`。
2. 检查左侧导航是否可展开和切换。
3. 检查 `销售准备 > 外贸流程` 是否默认展示。
4. 点击 12 个阶段，确认右侧详情随之切换，并确认右侧不再出现「我在该阶段的客户」mini 列表。
5. 点击 `了解公司`，切换公司资料模块，确认右侧编辑器随之切换。
6. 点击 `产品&市场`，选择不同产品行，确认下方摘要随之切换。
7. 点击 `案例知识库`，切换资料分类、标签和搜索词，确认案例列表变化。
8. 展开 `客户Kass`，点击 `A` 或 `B`，确认分组页、顶部「今日该推进」、客户档案、跟进流程图和客户跟进记录出现。
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
19. 逐一打开 `src/dify-config.js` 白名单中的对话页，确认顶栏左侧都有应用类型、API Key、保存按钮和状态，销售准备、客户开发、客户Kass和后台页不出现该配置栏。
20. 在 `#/skills/market-research` 选择「对话型应用」并保存有效 Key，确认显示应用摘要；刷新后只显示掩码，不回传原始 Key。发送两轮消息，确认第二轮复用 `conversation_id`。
21. 在 `#/agents/customer-research` 选择「Chatflow」验证同样流程；故意选错类型时，保存应提示 Key 实际对应的应用类型，且不落库。
22. 进入 `#/skills/yd-artifact`，确认默认类型为「Chatflow」；用脱敏测试回答检查普通 Markdown、Mermaid、ECharts、SVG 在正文中的顺序、流式骨架和窄屏布局。再用 `html-artifact` 检查按钮、Tab 或筛选交互真实生效、iframe 高度自适应，同时确认普通 `html` 只显示源码，外链/联网/跳转代码会降级为错误卡而不执行。
23. 运行 `npm test`，确认浏览器插件和 Dify 的模式识别、加密存储、API handler、SSE 解析、YD Artifact 渲染与前端状态测试全部通过。
24. 运行 `npm run check:cloudflare`，确认 Worker 能完整打包且没有把 Secret 写进 `wrangler.jsonc`。
25. 无内部令牌 POST `https://yd-prototype-dify-proxy.vercel.app/api/dify-runtime-config`，应返回 401；从正式对话页发送消息，应由 Cloudflare 返回 `process` / 正式答案 / `done`。
26. 调整到窄屏，确认顶栏配置项、正文和按钮不重叠、不溢出。

浏览器插件验证方式：

1. 语法检查：`node --check browser-extension/content-script.js`、`node --check browser-extension/background.js`、`node --check browser-extension/inquiry-analyzer.js`。
2. 清单检查：`python3 -m json.tool browser-extension/manifest.json >/dev/null`。
3. 打包检查：重新生成 zip 后执行 `unzip -t yingdan-inquiry-extension-v0.2.0.zip >/dev/null`。
4. 回归检查：确认 `browser-extension/` 里没有 `default_popup`、`popup.html`、`popup.js`、`popup.css`、`补充产品/底线`、`Coze 连接`、`开启新会话` 这些旧弹窗残留。
5. 浏览器检查：在当前 Chrome 扩展管理页点击重新加载插件，打开含客户询盘的网页，点击插件图标后应先出现右侧面板和「开始分析」按钮；只有用户点击「开始分析」后才调用 Coze。
6. Markdown 检查：AI 返回的标题、列表、加粗、代码块、链接和 `| 表头 |` 表格应按安全 Markdown 渲染，不显示裸露的 `###`、`**` 或表格分隔线。

Excel 交付验证方式：

1. 先用 LibreOffice headless 重存。
2. 清理 `xl/tables/`。
3. 清理空 `xl/drawings/`。
4. 清理 `tableParts`。
5. 清理 drawing/table relationships。
6. 通过 `unzip -t` 验证。
7. 通过 `openpyxl.load_workbook()` 验证。
8. 扫描包内 table/drawing 残留。

任一步失败都不能交付 `.xlsx`。
