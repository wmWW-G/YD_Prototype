# CONTEXT.md

## 项目目标

本项目用于逆向复刻线上「赢单外贸成交顾问」界面，产出一个可以直接打开、演示、提交 git、交给开发同事继续实现的静态前端原型。

当前目录还包含一个「赢单询盘分析助手」Chrome 浏览器插件内测包，用于把网页里的客户询盘抓取到右侧分析面板，并通过 Coze 生成询盘分析和回复建议。它是独立于主原型页面的内测交付物，不是 GitHub Pages 静态原型的一部分。

当前目录还包含独立的 `dify-log-browser-extension/`：这是 TokenMind 品牌的 Dify Cloud 日志只读查询 Side Panel。它只在用户已经登录并打开 `/app/{uuid}/logs` 时工作，复用浏览器登录态查询用户失败、应用失败或 marker 精确诊断，不复制 Cookie、不保存 API Key，也不运行或修改工作流。它和「赢单询盘分析助手」不共享代码、权限或发布包。

当前目录还新增了 `dify-chatflows/`，用于记录用户在 Dify 创建、并准备应用于赢单业务的对话型应用和 Chatflow。它和 `coze-workflows/` 一样属于工作流资料库，不是主静态原型代码。

当前目录还包含 `dify-plugins/yingdan-kass/`：这是使用 Dify Plugin CLI 和 Python 3.12 开发的固定账号 Tool Plugin MVP。它把赢单客户 KASS 的客户分层、客户档案、跟进记录、文件上传和带二次确认的删除能力提供给 Chatflow Agent 节点，不属于主静态原型代码。

当前目录还包含 `dify-plugins/kass-prototype-crm/`：这是专供当前 KASS 原型 Chatflow 使用的隔离 Tool Plugin。它只连接固定的 `api/kass-crm` 原型沙箱，不读取 Access Token、不接收任意 API 地址，也不会访问真实赢单账号。

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
- `客户Kass`：产品最终只展示方案 A，侧栏不再提供“方案 A / 方案 B”切换；旧 `/customer-kass/B` 与 `/customer-kass/B/online` 链接会分别规范到 `/customer-kass/A` 与 `/customer-kass/A/online`，B 版实现仅作为内部历史保留。A 版保留工作区内独立滚动的「重点推进」客户栏，并把工作区拆为「成交顾问 / 客户信息 / 跟进记录」三个页签；客户信息页不套整页卡片，直接在页签正文中展示基础信息、主要联系人、采购 / 市场汇总、资信与合作判断、竞对信息五组完整档案；跟进记录页统一承载新增入口、历史沟通和每条沟通产生的关联待办。Agent 正式回答使用连续正文、标题和列表，不额外包裹大面积色块。旧 `/customer-kass/C`、`/customer-kass/D` 深链会分别以 C/D 客户等级进入方案 A。
- 抽屉、toast、菜单展开和阶段切换动效。
- 本地 SVG 导航图标，来源为 `/Users/garden/Desktop/1/vinco-icons`，已复制到 `assets/icons/`。
- 侧边栏历史搜索、历史项编辑/删除图标、顶部历史下拉。
- 通用聊天输入框的附件弹层、模型下拉、输入后发送按钮启用；用户输入后切到左右分栏对话态，左侧保留问题和继续输入区，右侧展示回答正文和复制入口。
- 客户Kass入口设置弹层和账号设置弹层。
- 账号弹层里的邀请码兑换积分、团队/企业空间切换飞出层、用量明细跳转和升级入口。
- 透明后台入口：`#/ask` 顶部右侧有一个 hover 才轻微显色的圆形按钮，点击进入后台管理。
- 后台管理壳：左侧后台菜单、顶部面包屑、用户界面返回按钮、首页、知识库管理、用户总表（即原 User Preview 看板）、邀请码管理、AI 人设管理、AI 模型管理。
- `后台管理 > AI成本监控`：独立三栏界面，按“本句话 / Chatflow 事件带 / 成本实时入账”展示一次调用。默认可回放四组已核对的真实测试记录；切到真实调用后，分别读取“全技能总控（含知识库）”和“无知识库总控”的安全配置并消费真实 SSE。管理员可填写模型输入/输出、Embedding、Tavily、文档解析、知识库与平台摊销单价，以及汇率、目标毛利率和 V豆换算。未知模型、缺失用量或未填单价必须暂停销售价与扣费，不能按 0 元放行。
- `hyperframes/chatflow-cost-animation`：独立动画子项目，用一张固定画布模拟「全技能总控」的一次节点运行。动画按文件、RAG、Skill Prompt 三条真实支路逐步点亮节点，只在 Embedding、实际 Agent 模型和实际工具调用发生时点亮右侧账本；它是产品与开发沟通素材，不参与线上计费。
- `后台管理 > User Preview`：时间范围筛选、数据概览 KPI、功能调用总看板、可折叠字段配置、用户字段流水账报表和子账号管理；子账号管理只保留手机号、积分、启停和调积分口径，不设计角色权限。
- `后台管理 > 经营分析`：角色化运营驾驶舱（管理员/运营/客服三种视角），含经营看板、功能洞察两个 Tab。User Preview 仍保留作为字段流水自由报表，不被替代。
- `后台管理 > 用户` 分组：参考同事截图重构出的用户分类菜单，含经营分析、用户总表（沿用旧 `/admin/user`）、公海客户、付费公海、销售信息、活跃用户、付费用户和邀请码管理；受邀来源信息统一进入用户总表的使用详情。
- `后台管理 > 代理` 分组：经销代理总览，含拉新数、付费数、累计分成和状态。
- `后台管理 > 邀请码管理`：生成邀请码表单、预览提示和邀请码列表，用于表达销售同事发放试用福利的原型流程。
- `客户开发`：一级业务入口，不归入 `技能Skill` 子菜单；首页以 `Lead Enrichment / 客户情报补全` 为核心定位。目标国家/地区通过「七大洲 → 国家/地区」弹窗从 249 项中单选，行业产品通过「36 个行业大类 → 432 个具体产品」弹窗单选；切换大洲或行业大类只更新弹窗内部选项，不重新渲染页面和弹窗动画。客户类型使用跨行业通用 B2B 类型，开发目标只填写客户数量。2026-08-07 起，本地模式的启动按钮真实调用 `/api/pdl/companies`，从 PDL Free Company Dataset 的 DuckDB 索引返回公司名、域名、总部、行业、规模、成立时间和 LinkedIn；中文国家通过浏览器 ISO 显示名转换，产品大类继续映射为宽口径 PDL 行业。2026-08-08 起，“优先客户类型（可选）”与产品行业分开发送：服务端利用 PDL 行业、公司名称和域名生成高度疑似、可能匹配、弱匹配或无法判断的可解释排序，高度疑似必须同时具备行业与身份文本两类证据；强身份词与本轮产品行业同时命中也构成两类证据，因此产品相关公司优先于只有通用角色行业的公司，但产品行业单独命中不会产生角色结论。所有推测均标记为未经公司官方资料核验；品牌商、OEM / ODM 采购商和终端用户在现有字段下保持无法判断。2026-08-09 起，结果页默认使用确定性“推荐排序”，并可切换“资料最完整”和“公司规模”：不限客户类型时推荐分由产品行业 45 分、官网/LinkedIn 可行动性 25 分、档案完整度 20 分组成；支持推测客户类型时改为产品行业 25 分、角色证据 20 分、可行动性 25 分、完整度 20 分。同分使用稳定哈希而非公司名称，因此不会再按数字、A、B 顺序机械展示；三种排序都在全量候选上完成后再分页。2026-08-11 起，公司结果改成占满工作区的高密度表格，列内直接展示公司、国家/地区、行业、公司规模、联系人数量/状态和操作；用户可以逐家公司点击“获取联系人”，也可以独立勾选多家公司后批量获取，批量查询按顺序执行以避免瞬时并发消耗联系人服务额度。公司资料不再常驻挤压表格，通过“详情”按需打开右侧抽屉；联系人获取成功后可以直接从行内展开联系人明细。客户类型推测、推荐依据和更新时间不在列表及详情中重复展示。详情中的公司信息先以 2×2 宫格展示规模、成立时间、地点和行业，再纵向展示官网与 LinkedIn 入口。具体产品匹配仍明确标记为待官网核验。PDL 免费公司库不含人员、邮箱和电话，前端不得按域名生成虚构联系人。Email Count 可以在公司信息阶段自动查询免费数量，但已知公司域名只有在用户明确执行单条或批量动作后，才通过服务端 Hunter Domain Search 按需补充最多 10 位联系人；PDL 搜索、翻页和打开详情均不得自动调用付费的 Domain Search，Key 只从服务端 `HUNTER_API_KEY` 读取。返回联系人只保存在当前浏览器内存中，邮箱显示动作不重复请求；没有域名、未配置 Key、额度耗尽和无结果都显示明确状态，不用假数据兜底。公司列表保留 PDL 原始名称用于追溯，但展示层会移除无意义的前导符号、保守整理全小写名称，并以文字标识和官网收录状态组成双层公司身份。官网与 LinkedIn 地址统一规范为只允许 HTTP(S) 的安全外链，界面只显示“访问官方网站 / 查看 LinkedIn 公司页”等动作，不裸露原始 URL；结构无效时显示待核验状态。先保持轻量，不做客户分级、状态分栏和复杂推进流。
- 客户开发的行业展示使用用户所选产品所属的英文标题式业务行业，例如“光伏组件”统一显示“Renewable Energy & Power”。PDL 原始英文行业只保存在 `pdlIndustry` 并用于后台召回、评分与审计，不得出现在公司列表或右侧档案中。右侧详情初始直接展示公司资料；只有用户点击“获取联系人”并成功取得数据后，才出现“公司资料 / 已知联系人”页签。用户界面不展示 Hunter 名称、密钥或额度等供应商实现信息。
- 客户开发首页的数据来源按用户任务展示为“Google 搜索获客、地图获客、领英获客、社媒获客、TikTok 获客、海关获客、企业数据库、展会获客”，不在界面暴露底层供应商品牌。页面采用铺满主区的“获客来源 → 自然语言目标句 → 开始获客”工作区，不显示右侧情报补全说明栏。背景使用 `assets/generated/customer-development-global-network.png` 的低对比全球点阵、连接轨迹和右侧暖橙光带增加空间层次，并直接铺满整个工作区，不形成矩形卡片或四周留白。企业数据库和地图获客继续连接现有查询流程；Google 搜索获客、领英获客、社媒获客、TikTok 获客、海关获客和展会获客暂用纯前端模拟数据补全搜索、结果列表、详情、联系人、批量获取与导出原型流程。模拟名单使用自然的虚构公司名、目标市场常见城市和来源对应的业务证据，官网只使用 `example.com`，结果页持续标注“模拟数据”，不会发起外部请求，也不代表真实企业、搜索、贸易、社媒、职位、视频账号或参展记录。
- 客户开发八种获客来源共用同一套国家、产品和数量输入状态，切换来源不会出现另一套同名字段。数量下拉固定为 `20 / 50 / 100 / 200` 四档，所有来源使用相同选项、顺序、宽度和单次最多 200 家的规则，不再为地图获客删减选项或保留 80、120、500 等零散档位。产品选择器默认先提供可输入的产品搜索，再允许按 36 个行业大类浏览 432 个标准产品；地图获客不再展示独立的“商户行业选择器”，也使用这套产品输入、近似推荐与自定义产品流程，只额外保留地图查询必需的目标城市和公开联系方式。输入后前端按规范化字符相似度和少量高频业务别名给出最多 8 个近似项，用户必须自行确认；没有准确对应时可以保留最长 80 字的自定义产品，并明确按最接近或当前行业大类做宽口径召回、结果需要人工核验。自定义输入不能被包装成目录中的精确产品匹配；地图搜索提交前才在底层 64 项聚合行业中选择最接近项，低置信度时沿用上一次合法分类，不在界面伪装成精确映射。
- 客户开发结果页顶部的“本轮获客目标”使用紧凑标题、目标组合和候选数量三层信息，不再重复展示 PDL 数据来源与许可链接；数据来源边界继续记录在项目资料中。
- 客户开发结果表沿用原有公司、地区、行业、规模、联系人和操作结构，只新增“跟进状态”字段；每行操作末尾固定提供“背调”，点击后进入客户背调顾问。
- 客户开发“获取联系人”当前暂用纯前端模拟模式：公司列表先展示确定性的“可获取联系人数量”，模拟 GitHub Pages 不调用接口；真实模式则通过免费的 Hunter Email Count 接口 `/api/hunter/email-count` 只取得数量，不提前返回姓名、岗位或邮箱。用户点击“获取联系人”后等待约 450ms，在当前结果页生成 3 位明确标注为模拟数据的联系人并显示“已知联系人（3）”页签；真实模式此时才调用 Domain Search 并按实际返回邮箱数消耗点数。联系人使用无卡片背景的紧凑分隔列表，每人以 2×2 字段排列姓名、岗位、邮箱和电话；这四类字段与 Hunter Domain Search 当前返回的 `first_name` / `last_name`、`position`、邮箱值和 `phone_number` 对齐，岗位直接展示接口英文原文，不做中文翻译，电话缺失时显示“未提供”。模拟邮箱只使用 `example.com` 保留域名，模拟电话使用虚构的 `555-01xx` 号段，不拼接真实公司域名，也不会调用 Hunter 或消耗额度；恢复真实接口前必须关闭模拟开关并重新验收安全与额度边界。
- 公司表内点击“加载邮箱”成功后，会在该公司行下方自动展开二级联系人明细，每位联系人单独一行展示姓名、英文原岗位、邮箱和电话；公司行只保留联系人数量以及展开/收起入口。批量加载不会同时展开全部公司，避免大量联系人把公司列表冲散；批量完成后由用户按公司逐组展开。
- GitHub Pages (`*.github.io`) 只承担静态原型演示，不请求无法托管的 Python/PDL 接口：搜索、排序以及直接打开结果页时均生成自然但完全虚构的公司名称、`example.com` 保留域名和“演示数据”标识的确定性公司名单。`127.0.0.1:8788` 等非 GitHub Pages 环境继续请求真实 `/api/pdl/companies`；真实接口失败时不得用演示数据掩盖错误。
- 右侧公司详情点击“获取联系人”并成功取得数据后，立即在当前右侧详情内自动切换到“已知联系人”面板，不需要用户再点一次“查看联系人资料”，也不跳转到独立联系人整页。顶部“公司资料 / 已知联系人”页签仍可往返切换；若用户稍后切回公司资料，已有的“查看联系人资料”按钮仍可再次进入联系人面板。
- 所有通用 AI 对话功能页：顶部左侧固定显示 Dify 应用类型、App API Key 和可选 Skill ID 配置栏，支持选择「对话型应用」或「Chatflow」。每个功能页独立保存配置，重复保存会覆盖更新；前端只能读取掩码，原始 Key 由后端加密保存。填写 Skill ID 时进入两个总控 Chatflow 的路由模式，后端从已保存配置注入 `inputs.skill_key`，浏览器不能临时改成其它 Skill；Skill ID 留空时保持独立 Dify App 模式。聊天框模型下拉只显示 `DeepSeek V4 Flash` 与 `Gemini 3.5 Flash`，总控模式分别传入 `deepseek-v4-pro` 与 `gemini-3.5-flash` 的 `inputs.model_key`。发送后左侧按轮次保留问题，右侧通过真实 SSE 实时展示最新过程和 Markdown 答案，并按页面独立复用 `conversation_id`。过程区展示节点、工具名、显式搜索词，以及 Dify API 明确定义为公开步骤的 `agent_thought.thought`。旧协议仍显示最新步骤并在正式答案开始后折叠；带显式 `<think>` 边界的 Agent 则按“独立 thinking 计时 → 可展开的公开过程 → 阶段 message 小结”组成时间线，下一次 `<think>` 到达时结束上一段小结并重新从 0.0 秒计时，直到最后正文出现。每轮耗时以 0.1 秒粒度局部刷新，完成或失败时单独冻结；生成期间完整展示各轮过程，正式正文开始后整条时间线自动收进默认关闭的「已完成深度思考 · N 轮」入口，点击仍可回看全部轮次和小结。模型隐藏的 `<think>` 正文、prompt、observation 和工具输出仍不会发给浏览器。流式期间只局部更新当前回答 DOM，不再重建整个 `#app`，避免每个字符到达时整屏闪烁。
- `成交顾问 > 客户背调顾问`：默认类型为 Chatflow，继续沿用现有背调 Dify 配置和成本追踪能力。
- `技能Skill > YD Artifact`：默认类型为 Chatflow，沿用通用 Dify 对话、SSE 和多轮上下文；回答中的受控代码块会在正文原位置转换为流程图、时间线、数据图、指标卡或隔离预览。已适配 `mermaid`、`echarts`、`svg`、受控 `ui` JSON 和显式 `html-artifact`。共享 Artifact 渲染器统一使用无 Logo 的“中性几何业务画布”主题：灰米白承载信息、深墨建立层级、`#ff7830` 标记关键动作、`#b84700` 用于小字强调；YD Artifact 与 KASS 内的同类内容保持一致。思考阶段使用 `/Users/garden/YD/logo/effect.html` 第 7 个“卫星环绕”标志作为可点击入口，收起时只显示动效、耗时和展开箭头，展开后直接显示公开步骤，不重复显示“分析过程/思考过程”标题。正式界面不显示“动态生成”“正在构建 Artifact”或生成源码，源码仅在 `?artifactDebug=1` 内部调试时出现。`html-artifact` 可在 opaque-origin iframe 内运行本地 HTML/CSS/JavaScript，但只授予 `allow-scripts`，并通过 CSP、源码预检和宿主桥接阻断联网、外部资源、存储、表单提交、弹窗和越界导航；普通 `html` 代码块仍不会执行。
- `技能Skill > 市场调研`：默认类型为对话型应用，已适配普通 Chatbot/Agent 的流式事件和多轮上下文。

- 客户开发数据源、历史验证结果和接入边界统一记录在 `customer-development-data-sources/README.md`。其中 PDL Free Company Dataset 已有本地导入与搜索实现，Hunter Domain Search 已有单家公司按需联系人补全；Foursquare OS Places 已完成本地全量下载、行数验收与真实地点查询接入，本地客户开发页通过同一 Python 服务查询 Parquet。地图获客在后台读取 `customer-development-data-sources/foursquare/category-catalog.json` 的 10 个 B2B 大类、64 个聚合行业，把统一产品输入转换成地点查询分类；`raw-category-catalog.json` 的 11 个官方一级大类、1,274 条完整分类路径仅作为后台映射，不在界面暴露“地标与户外、夜生活”等本地生活分类。后端合并两层目录生成真实查询规则。GitHub Pages 无法托管本地大数据，地图获客在该环境仍必须明确标注为原型预览；Overture、GLEIF 等仍是候选资料。

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

浏览器直接打开仍可查看大多数静态页面。客户开发的真实 PDL 搜索必须由 `customer-development-data-sources/pdl/pdl_local.py serve` 提供同源页面和接口，直接双击 `index.html` 时不会假装返回公司数据。

浏览器插件入口是：

```text
browser-extension/manifest.json
```

Dify 日志查询插件入口是：

```text
dify-log-browser-extension/manifest.json
```

其内部测试包是 `dify-log-browser-extension-v0.1.0.zip`；Chrome 114+ 可直接加载 `dify-log-browser-extension/` 目录。

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
    dify-runtime-config.js
    kass-crm.js
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
  dify-log-browser-extension/
    manifest.json
    background.js
    query-engine.js
    sidepanel.html
    sidepanel.css
    sidepanel.js
    icons/
    tests/
  coze-workflows/
  dify-chatflows/
  dify-plugins/
    kass-prototype-crm/
    yingdan-kass/
  hyperframes/
    chatflow-cost-animation/
  源代码/
    Codeup-Demo/
    yd-ai-service/
  src/
    app.js
    cost-monitor.js
    data.js
    dify-artifact.js
    dify-config.js
    styles.css
  tests/
```

各文件职责：

- `index.html`：页面骨架，只放必要容器和脚本引用。
- `sw.js`：自动刷新 Service Worker，让 GitHub Pages 上的 HTML、JS、CSS 优先走网络，减少同事看到旧缓存的概率；由 `src/app.js` 注册。
- `vercel.json`：Vercel Serverless 配置，用于设置 Dify 配置、通用回滚聊天代理、KASS CRM Agent 网关和内部配置桥接的最大执行时间。
- `wrangler.jsonc`：Cloudflare Worker 部署配置；声明长流式 Worker 入口和 Vercel 内部配置接口地址，不包含 Secret。
- `api/dify-config.js`：Dify 配置接口；GET 只返回掩码和应用摘要，POST 校验 Key 对应的真实 App 类型并覆盖保存。
- `api/dify-runtime-config.js`：仅供 Cloudflare Worker 调用的私有配置桥接；使用固定时间比较校验内部 Bearer Token，在 Vercel 内读取现有 Redis/环境变量配置，不开放 CORS、不允许缓存。
- `api/dify-chat.js`：原 Vercel 通用聊天代理，保留为回滚入口；正式前端聊天已切到 Cloudflare Worker。
- `api/kass-crm.js`：KASS 页面专用的原型 CRM 沙箱，只开放固定 GET / POST action。它按浏览器生成的 `workspace_id` 把虚拟客户资料和虚拟跟进记录隔离保存在现有 Redis 中，不连接真实赢单接口，也不接收 Access Token。网关不提供任意 URL 转发，客户与跟进写入字段由 `lib/kass-crm-gateway.js` 白名单控制。
- `cloudflare-worker/dify-chat-worker.mjs`：正式 Dify 长流式代理；先通过私有桥接读取当前页面配置，再直接连接 Dify，发送 15 秒 SSE 心跳并复用现有事件归一化逻辑。
- `lib/dify-*.js`：Dify 模式识别、增量 SSE 解析、跨分块 `<think>` 过滤、公开过程摘要、加解密、Upstash Redis 存储和 HTTP 共用逻辑。
- `src/styles.css`：全部视觉样式、响应式规则和动效。
- `src/data.js`：用户侧导航、销售准备标签、成交阶段、后台菜单、User Preview 报表、邀请码、AI 人设和模型等静态数据。
- `src/app.js`：渲染函数、hash 路由、事件绑定、抽屉、toast、弹层、账号弹层、后台管理和状态切换。
- `src/cost-monitor.js`：AI 成本监控的纯数据与计算层；维护可编辑单价、实际模型精确映射、事件去重、重试保留、逐行换汇、利润/V豆公式和四组实测回放。真实调用与回放共用同一套计算函数。
- `src/dify-artifact.js`：YD Artifact 的前端富内容适配层；识别特殊 fenced code block，生成安全的本地 SVG/结构化卡片，或把静态 SVG、显式交互式 HTML Artifact 放入受 CSP 和 `sandbox` 约束的 iframe。主题令牌在这里作为 Mermaid、ECharts 与隔离 iframe 的共同颜色来源，宿主样式在 `src/styles.css` 的 `.yd-artifact-*` 区块中消费同一语义。交互式 iframe 通过受校验的 `postMessage` 只向宿主回报内容高度，不获得宿主数据或 API。
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
- `dify-log-browser-extension/`：独立 TokenMind Dify 日志查询插件。只授权 `https://cloud.dify.ai/*`，使用 Side Panel、成功 GET 的 CSRF 关联和 `chrome.storage.session`；侧边栏提交固定结构条件，后台只调用当前 App 的 Console GET 白名单，结果在查询引擎内立即脱敏并分批显示。失败 Run 先聚合、点击分类再加载节点；成本查询以 Conversation ID 为必填范围、用户 ID 为可选严格校验，并跳过 Run 详情。完整职责和加载方法看目录内 `CONTEXT.md`。
- `dify-log-browser-extension-v0.1.0.zip`：上述 Dify 日志查询插件的版本化内部测试包，根目录直接包含 `manifest.json`。
- `package.json`：轻量仓库元信息和验证脚本；`npm run check:cloudflare` 做 Worker dry-run，`npm run deploy:cloudflare` 发布 Worker。
- `AI板块统计.md`：统计客户Kass、销售准备等区域的 AI 能力现状和后续整理建议。
- `赢单api.md`：赢单后端接口文档快照，用于查阅 auth、账号、邀请码、计费、积分等接口路径、请求参数和字段口径。它是接口参考资料，不是主静态原型代码；涉及线上真实行为、安全暴露或返回字段时，必须重新做 live 验证，不能只按文档下结论。
- `coze-workflows/`：扣子工作流资料库，记录工作流用途、schema、调用函数、字段映射和验证状态。
- `dify-chatflows/`：Dify 对话应用与 Chatflow 资料库，记录应用类型、入口、参数快照、调用函数、API 测试记录和赢单字段映射。`客户Kass-客户管理-KASS-Agent/workflow.yml` 是可导入的 KASS 原型 CRM Chatflow DSL；Agent 节点只挂载 `garden/kass-prototype-crm/kass-prototype-crm` 的五个原型 Tool，写操作由 Plugin 真正执行，不再依赖通用 HTTP Tool 或前端 `kass-crm-action` 兜底。用户确认现有待办完成后，Agent 通过 `update_followup` 传回完整最终任务数组，默认追加 1–2 项 `agent-next-` 下一步待办并用 `update_customer` 同步 `next_action`；用户说某项“不算待办”时，从完整任务数组中移除准确任务，不删除整条跟进。前端只在 Plugin 写 Tool 完成且回读差异确认后播放跨栏同步动画：客户摘要、完整背调资料、跟进记录和关联待办都支持新增、修改、完成、重开与删除反馈；整条跟进新增/删除时不会重复播放其内部待办。删除类先从 Agent 飞向旧目标并退场，右栏刷新后再播放其余飞入或高亮，因此不会因目标提前消失而落空；`prefers-reduced-motion` 下直接显现最终状态。KASS 的公开思考与 Tool 事件显示在消息内的浅灰过程区，只通过 `textContent` 更新；流式 Markdown / Artifact 使用原位 DOM morph 保留既有节点。写 Tool 完成时只回读原型数据，等整轮 Agent 完成后才刷新右栏，并在同一绘制帧内把原对话节点放回，避免过程阶段和最终输出发生整页闪烁。进入页面或切换客户时，每个客户只恢复一次原型数据；异步恢复完成后仅原位更新当前客户资料或跟进区域，不再调用整页 `renderApp()`。分析型回答仍可输出受控 `ui` / ECharts / `html-artifact`，一轮最多一个 Artifact；结构化组件的围栏语言必须精确为 `ui`，JSON 第一项必须包含 `component`，不能降级成普通 `json` 代码块。
- `customer-development-data-sources/pdl/pdl_local.py`：客户开发共用的 Python + DuckDB 本地数据服务。PDL `import` 接受 ZIP、CSV、PSV、JSON 或同格式分片目录；`serve` 默认只监听 `127.0.0.1:8788`，提供静态原型、PDL 公司搜索、Foursquare 地点搜索和 Hunter 按需联系人接口。Foursquare 部分同时读取 64 项 B2B 聚合目录与 1,274 项官方原始映射，并直接只读查询 `customer-development-data-sources/foursquare/data/places_os_raw/*.parquet`；按国家、城市行政字段、业务行业和公开联系方式筛选，优先返回公开资料更完整且更新较新的地点，单次最多 200 条，不生成客户角色、公司规模或采购意向，也不采用市中心半径或距离排序。Hunter Key 只来自服务端环境。原始文件、DuckDB、虚拟环境和滚动日志均被 `.gitignore` 排除。
- `dify-plugins/kass-prototype-crm/`：KASS 原型 CRM Dify Tool Plugin。固定连接 `https://yd-prototype-dify-proxy.vercel.app/api/kass-crm`，无 Provider 凭证和 Authorization；只开放读取上下文、更新客户、新增跟进、更新跟进和删除跟进五个 Tool。字段、客户 ID、工作区 ID 和跟进 ID 均在 Plugin 内校验；发布包位于 `dist/kass-prototype-crm-0.1.1.difypkg`。
- `dify-plugins/yingdan-kass/`：赢单客户 KASS 固定账号 Dify Tool Plugin。Provider 保存 `api_base_url`、`user_id` 和 `access_token`；`lib/client.py` 负责 Bearer 鉴权、字段白名单、账号归属校验和 HTTP 错误归一化；`tools/` 暴露 13 个 Agent Tool；删除必须先 `prepare_delete` 再用五分钟一次性令牌调用 `execute_delete`。2026-07-22 已用临时分层、客户和跟进记录完成线上 CRUD 与最终清理实测，确认分层更新使用 `PUT`、客户更新不发送 `customerCategory` 且合作次数使用非负整数。本地包输出在插件目录的 `dist/`，其中不包含真实凭证。
- `.agents/skills/yingdan-dify-high-concurrency-test/`：`赢单 Dify 高并发测试` Skill。它从带 `subId` 的正式功能链接读取实时角色配置，对赢单后端执行带单请求预检的可配置并发 SSE 测试，可选执行较小规模的 Dify Service API 直连对照，并通过只读 Console API 按 `user` 与唯一 marker 关联会话、workflow run 和失败节点。Chrome 只用于缺少 Console 信息时的一次性登录态引导，压测、分页和日志对账均由脚本完成；POST 不自动重试，输出不包含 Prompt、回答、工作流输入输出或原始错误。密钥只从被本目录 `.gitignore` 排除且权限为 `600` 的 Skill 本地 `.env`、进程环境变量或隐藏输入读取；仓库中的 `.env` 不得填写或提交真实值。
- `hyperframes/chatflow-cost-animation/`：基于「全技能总控」真实 YML 制作的 39 秒单画布节点运行动画。`index.html` 是逐节点 GSAP 时间线，`index.motion.json` 约束节点与账本的先后顺序，`DESIGN.md` 记录暖纸张账本视觉，`snapshots-node-run/` 保存 8 个关键成本时刻的验收抽帧。当前先通过 HyperFrames Studio 预览确认，确认后再生成最终 MP4；动画不包含 Dify API Key。
- `源代码/`：从当前云效组织通过 HTTPS 完整克隆的两个 Codeup 仓库，分别位于 `Codeup-Demo/` 与 `yd-ai-service/`。两个目录都保留自己的 `.git`、提交历史和远端分支，是独立 Git 仓库；远端 URL 不保存克隆账号或密码。不要在父项目中直接批量暂存这个目录，需要提交或拉取时进入对应子仓库单独操作。
- `backups/`：历史备份，只用于查旧实现或回看改动前状态，不主动修改。
- `.claude/`、`audits/`、`workbench/`：工具运行、截图审计或临时运行记录目录，默认不作为主工程编辑目标。

## 当前技术栈

主原型当前使用 `HTML + CSS + 原生 JavaScript`。

选择理由：

- 优点：不用构建工具，方便直接打开和 git 交付。
- 优点：适合逆向 UI 原型，开发同事能快速看结构和业务数据。
- 缺点：后续如果要做大量真实业务状态、接口和权限，建议再迁移到 React 或 Vue。

客户开发 PDL 本地模式使用 `Python 3.11 + DuckDB`：

- 优点：无需购买数据库服务，适合批量导入千万级 CSV，并支持多个只读查询线程。
- 优点：数据和日志只留在本机，第一阶段容易核验字段、去重和筛选口径。
- 缺点：目前只适合这台电脑本地使用；团队在线访问时需要迁移到有持久存储的服务端数据库。
- 缺点：PDL 行业是公司级宽分类，不代表具体产品采购意图；客户类型只是基于行业、名称和域名的未核验推测；Hunter 联系人补全依赖账户额度，不能当作无限免费数据源。

浏览器插件当前使用 Chrome Manifest V3 + 原生 JavaScript：

- 优点：不需要构建工具，方便打 zip 给同事加载已解压扩展。
- 优点：可以直接在客户询盘所在网页上打开右侧面板，贴近真实业务动作。
- 缺点：当前内测版有内置 Coze 测试 Token，不能作为公开上架版本。
- 缺点：`host_permissions` 覆盖 `http://*/*` 和 `https://*/*`，公开上架前需要重新评估最小权限、隐私政策和登录方案。

Dify 日志查询插件同样使用 Chrome Manifest V3 + 原生 JavaScript，但权限和状态完全独立：

- 优点：仅授权 Dify Cloud，Chrome 114+ 可直接加载，不需要后端、构建工具或手工凭据。
- 优点：CSRF 只存在 `chrome.storage.session`，Cookie 由 Chrome 自动附带；查询路径和结果字段均为硬编码白名单。
- 缺点：第一版不支持自托管 Dify；浏览器或插件重启后需要刷新一次日志页重新确认 CSRF。
- 缺点：这是内部效率工具，不等同于经过隐私政策和商店审核的公开上架版本。

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
- `activeKassView`：客户Kass当前页面版本，`workbench` 为 CRM Agent 工作台，`online` 为线上版复刻。
- `kassExpandedGrades` / `kassWorkbenchGroupId`：B 版侧边栏当前展开等级，以及 A/B 两套方案共用的当前客户等级；等级切换不改写方案 URL。
- `kassCustomerDirectoryOpen` / `kassDirectoryGroupId` / `kassCustomerQuery`：完整客户库浮层、浮层所属等级和搜索词。
- `kassAgentDraft` / `kassAgentMessages` / `kassAgentThinking`：CRM Agent 本地原型对话状态。
- `kassRecordFormOpen`：A 版「跟进记录」页签（以及 B 版右侧客户工作纸）内新增跟进记录表单的开关。
- `kassAssistantOpen`：右下角 Kass AI 助手浮窗开关。
- `customerDraft` / `isCustomerGenerating` / `customerResult`：旧客户输入壳保留状态，当前客户等级页主要使用右下角助手浮窗。
- `drawer`：当前打开的右侧抽屉类型。
- `popup`：当前打开的轻量弹层，例如附件、模型、顶部历史、设置、账号设置、邀请码兑换。
- `historySearchOpen` / `historySearchQuery`：侧边栏历史搜索状态。
- `selectedModel`：当前模型选择。
- `chatDraft` / `isGenerating` / `generatedResult`：聊天输入、模拟生成和结果状态。
- `difyFeatureConfigs`：按功能页 ID 保存顶栏的应用类型、掩码、Skill ID、应用摘要、加载和保存状态；不保存原始 API Key。Skill ID 为空代表独立 App，非空代表总控路由模式。
- `difyFeatureSessions`：按功能页 ID 保存 `messages`、`conversationId`、`userId`、错误和生成状态，避免不同 Dify App 串上下文。助手消息还保存 `processSteps`、`currentProcess`、`processCollapsed`、`processExpanded` 和 `answerStarted`，用于“最新过程覆盖显示、最终答案折叠、按需展开历史”。
- `costMonitor`：后台 AI 成本监控状态，包含回放/真实模式、当前 Chatflow、用户选择模型、每轮消息、事件时间轴、成本项、Token 校验、两套 `conversation_id`、管理员单价、美元汇率、目标毛利率与 V豆换算。API Key 仍只存在 `difyFeatureConfigs` 的安全后端配置里，不进入此状态。
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
- `KASS_GROUPS` / `KASS_FLOW_STAGES`：客户Kass A/B/C/D 等级、客户卡片和跟进流程阶段。所有本地样例客户都归一化为完整背景档案、跟进记录和关联待办；未手工背调的字段明确标注为原型样例或未接入真实征信，不能当线上客户事实。
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
| `#/admin/ai-cost` | 后台管理 > AI成本监控（实测回放 / 真实 Chatflow 成本流） |
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
| `#/customer-kass/A` | 客户Kass 正式界面（独立客户栏 + 成交顾问 / 客户信息 / 跟进记录） |
| `#/customer-kass/B` | 旧方案 B 链接：自动规范到 `#/customer-kass/A` |
| `#/customer-kass/C` | 旧等级深链：以 C 级客户进入方案 A |
| `#/customer-kass/D` | 旧等级深链：以 D 级客户进入方案 A |
| `#/customer-kass/A/online` | 客户Kass > A 分组线上版复刻 |
| `#/customer-kass/B/online` | 旧方案 B 线上链接：自动规范到 `#/customer-kass/A/online` |
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
- 改客户开发：它是一级入口，不是 `技能Skill` 子菜单；国家、产品和静态选项优先改 `src/data.js` 的 `CUSTOMER_DEVELOPMENT`；页面结构、PDL 映射、Foursquare 地图条件与结果规范化、客户类型展示、Hunter 按需联系人改 `src/app.js`；地图获客的外贸常用行业与映射改 `customer-development-data-sources/foursquare/category-catalog.json`，官方原始分类改同目录的 `raw-category-catalog.json`；样式改 `src/styles.css` 的 `.customer-dev-*`；PDL 导入、地点查询、排序、Hunter 代理和本地 HTTP 服务改 `customer-development-data-sources/pdl/pdl_local.py`。PDL 免费库没有联系人，不得恢复按域名猜邮箱；Foursquare 地点不得包装成采购商或高意向客户；Hunter 只能由用户点击单家公司后调用。
- 改通用 Dify 对话页：页面白名单和默认类型改 `src/dify-config.js`；顶栏配置看 `renderDifyConfigBar()`、`loadDifyFeatureConfig()`、`saveDifyFeatureConfig()`；多轮消息存在 `state.difyFeatureSessions[featureId]`；真实调用和浏览器流读取看 `sendDifyFeatureDraft()`；过程 UI 看 `renderDifyProcessPanel()`；Markdown 渲染看 `renderMarkdown()` / `renderInlineMarkdown()`。配置保存看 `api/dify-config.js`，Cloudflare 长流看 `cloudflare-worker/dify-chat-worker.mjs`，私有配置桥接看 `api/dify-runtime-config.js`，上游增量流和过程脱敏看 `lib/dify-api-client.js`；`api/dify-chat.js` 仅保留回滚。
- 改 YD Artifact：入口、Dify 配置和会话仍走上述通用链路；特殊代码块识别、Mermaid/ECharts 本地渲染、受控 `ui` 组件、共享主题令牌和沙箱策略改 `src/dify-artifact.js`，页面视觉改 `src/styles.css` 的 `.yd-artifact-*`；Dify LLM System Prompt 改 `dify-chatflows/技能Skill-YD-Artifact/prompt.md`。默认用户视图不渲染源码入口，内部排障通过 `?artifactDebug=1` 开启。不要执行普通 `html`、远程脚本或未经校验的 SVG；交互代码只能放在显式 `html-artifact` 中，并保持 `sandbox="allow-scripts"`、无 `allow-same-origin` 的边界。
- 改客户背调顾问：数据改 `src/data.js` 的 `CUSTOMER_RESEARCH_FLOW`；它复用上述通用 Dify 对话壳，但默认应用类型是 Chatflow，内部成本面板仍由 `renderCustomerResearchBillingTracePanel()` 控制。
- 改客户Kass：优先改 `src/data.js` 的 `KASS_GROUPS`。A 版看 `renderKassCustomerRoster()`、`renderCustomerKassView()` 和 `renderKassWorkspaceTab()`；B 版看 `renderKassNavGroup()`、`renderCustomerKassComparisonView()`、`renderKassComparisonConversation()` 与 `renderKassComparisonContext()`；两版共用的客户工作纸看 `renderKassCustomerHub()` 和 `renderKassFollowupRecord()`，完整客户浮层看 `renderKassCustomerDirectoryModal()`。视觉分别看 `.kass-crm-*` / `.kass-workspace-*` / `.kass-profile-file` / `.kass-profile-memory` / `.kass-background-*` / `.kass-followup-*` / `.kass-roster-*`，以及 B 版 `.kass-compare-*`、侧栏 `.kass-grade-*` 和浮层 `.kass-directory-*`；线上复刻版结构看 `renderCustomerKassOnlineView()`，视觉看 `.kass-online-*`。稳定背调、动态跟进和关联待办必须保持边界，线上真实客户身份和历史不得写入本地样例数据。
- 改账号弹层、邀请码兑换、团队/企业切换：优先改 `src/app.js` 的 `renderAccountSettingsPopup()`、`renderInviteRedeemModal()` 和相关事件绑定。
- 改后台菜单：优先改 `src/data.js` 的 `ADMIN_NAV_ITEMS`，再看 `src/app.js` 的后台路由映射。
- 改后台 User Preview 指标和表格字段：优先改 `src/data.js` 的 `ADMIN_USER_PREVIEW_*` 数据；交互改 `src/app.js` 的 `renderAdminUserPreview()`、`renderUserPreviewReportBuilder()`、`bindUserPreviewReportControls()`。
- 改后台经营分析（角色化驾驶舱）：数据改 `src/data.js` 的 `ADMIN_BUSINESS_*`；渲染和交互改 `src/app.js` 的 `renderAdminBusiness()`、`renderBusinessDashboardTab()`、`renderBusinessFeatureTab()` 和 `bindEvents()` 里的 `data-business-*` 绑定。
- 改后台 `用户` / `代理` 子菜单：先在 `src/data.js` 的 `ADMIN_NAV_ITEMS` 改菜单（`parent` 字段决定 group），数据改 `ADMIN_USER_POOL_ROWS` / `ADMIN_PAID_POOL_ROWS` / `ADMIN_SALES_ROWS` / `ADMIN_ACTIVE_USER_ROWS` / `ADMIN_PAID_USER_ROWS` / `ADMIN_AGENT_ROWS`；页面渲染改 `src/app.js` 的 `renderAdminUserPool()` / `renderAdminPaidPool()` / `renderAdminUserSales()` / `renderAdminActiveUsers()` / `renderAdminPaidUsers()` / `renderAdminAgents()`，共用 helper：`renderAdminPageStats()`、`renderAdminSegmentFilter()`。`renderAdminSidebar()` 已改为按 `ADMIN_NAV_ITEMS.parent` 自动聚合 group，新增 group 只改数据即可。
- 改后台邀请码管理：优先改 `src/data.js` 的 `ADMIN_INVITE_ROWS`；生成邀请码表单和反馈改 `src/app.js` 的 `renderAdminInviteCodes()` 和相关事件绑定。
- 改后台 AI 人设/模型管理：优先改 `src/data.js` 的 `ADMIN_CHARACTER_ROWS`、`ADMIN_MODEL_ROWS`；弹窗和表格行为改 `src/app.js`。
- 改后台 AI 成本监控：计费字段、实测回放、模型到单价的精确映射和汇总公式改 `src/cost-monitor.js`；三栏页面与真实调用交互改 `src/app.js` 的 `renderAdminCostMonitor()`、`runCostMonitorLive()` 和 `bindCostMonitorEvents()`；视觉改 `src/styles.css` 的 `.cost-*`。上游安全成本事件改 `lib/dify-api-client.js` 的 `createPublicCostEvent()`，同时补 `tests/cost-monitor.test.js`，不要从节点标题猜模型，也不要把 Dify 全局混币种金额直接当总成本。
- 新增或更新 Coze/扣子工作流资料：优先维护 `coze-workflows/`，不要把 schema、调用函数或真实返回样例塞进页面文案。
- 新增或更新 Dify 对话应用或 Chatflow 资料：优先维护 `dify-chatflows/`，每个 App 单独建目录，记录应用类型、`chatflow.md`、`call-function.md`、`parameters.snapshot.json` 和 `api-test.md`。
- 查赢单后端账号、邀请码、计费或积分接口：可先看 `赢单api.md` 的接口路径和参数说明；如果要判断线上是否真的可用、是否需要鉴权、返回哪些敏感字段，必须用当前环境重新验证。
- 改界面样式和动效：改 `src/styles.css`。
- 改点击行为、抽屉、toast：改 `src/app.js`。
- 改浏览器插件：优先改 `browser-extension/content-script.js` 的面板体验、`browser-extension/background.js` 的 Coze 调用和消息分发、`browser-extension/inquiry-analyzer.js` 的本地询盘判断、`browser-extension/manifest.json` 的权限和图标声明。改完要重新打包 `yingdan-inquiry-extension-v0.2.0.zip`。
- 改 Dify 日志查询插件：只改 `dify-log-browser-extension/`。查询和脱敏改 `query-engine.js`，鉴权观察和只读桥改 `background.js`，界面改 `sidepanel.*`；先补对应 Node 失败测试，再运行全部扩展测试和 `package-extension.sh`。不得把它并入原有询盘分析插件。

## 哪些地方别碰

- 不要写入真实 Token、Cookie、手机号、邮箱或客户隐私。
- 不要把浏览器插件里的内测 Coze Token 值复述到文档、聊天回复、截图说明或公开材料里。当前内置 Token 只是为了内部测试；公开上架前必须改成赢单登录或后端代理换取 Token。
- 不要把 Dify API Key 写入 `dify-chatflows/`、`CONTEXT.md`、`AGENTS.md`、前端代码、插件代码、提交信息或聊天回复。Dify 调用样例统一使用 `<DIFY_API_KEY>` 或 `$DIFY_API_KEY`。
- 不要把真实线上历史记录复制到 `HISTORY_ITEMS`。
- 不要在原型里接真实删除、发送、保存、导出接口。
- 不要把 `browser-extension/` 当作正式生产插件直接上架 Chrome Web Store；上架前必须先做权限收敛、隐私说明、登录/鉴权改造和 Token 移除。
- 不要给 `dify-log-browser-extension/` 增加 `cookies`、`<all_urls>`、任意 URL 代理、Dify 写请求或原始响应展示；它也只能作为内部工具，公开上架前必须补隐私说明和商店审核资料。
- 后台刷新数据、导出报表、生成邀请码、AI 人设保存、AI 模型保存、账号团队/企业切换都必须保持为原型反馈。
- 不要在页面里写开发说明；说明写在 `CONTEXT.md` 或代码注释中。
- `backups/` 只用于查历史，不主动改里面的旧 HTML。
- `.claude/worktrees/` 是工具生成的工作树副本，不要把其中的文件当作当前主工程来更新。
- `.claude/`、`audits/`、`workbench/` 默认不主动修改、不主动提交。

## Dify 对话应用与 Chatflow 资料库

`dify-chatflows/` 用于记录用户在 Dify 里创建的、准备应用到赢单业务的对话型应用和 Chatflow。它与 `coze-workflows/` 平行维护：Coze 资料放 `coze-workflows/`，Dify 资料放 `dify-chatflows/`，不要混写。

当前已记录：

- `技能Skill > YD Artifact`：默认使用 Chatflow，通过页面顶栏绑定 Key。`dify-chatflows/技能Skill-YD-Artifact/prompt.md` 是完整替换提示词，约定 `mermaid`、`echarts`、`svg`、必须使用 `html-artifact` 的交互场景，以及无 Logo 的赢单共享主题令牌。该文件需要完整粘贴到 Dify LLM 节点并重新发布后才会影响线上回答。
- `技能Skill > 市场调研`：当前由“不需要知识库的总库”通过固定 `skill_key=market-research` 执行；具体 Key 只保存在后端环境变量或加密后的 Upstash Redis 中，不进入资料库。
- `Chatflow-全技能总控示例/赢单｜全技能总控 Chatflow.yml`：汇总当前 14 份需要共享知识库的业务 Skill 提示词；前端通过 `skill_key` 选择业务 Skill、通过 `model_key` 选择最终模型，共用一次知识库检索、文件解析与 Tavily 工具配置。14 份 Prompt 已全部内置在总控图中，不依赖独立 Skill Chatflow；客户背调和市场调研已移出此总控。
- `Chatflow-不需要知识库的总库/赢单｜不需要知识库的总库.yml`：只汇总客户背调与市场调研两个不需要共享知识库的 Skill；客户背调固定使用 `skill_key=customer-research`，市场调研固定使用 `skill_key=market-research`。该总控保留图片/文档解析、Tavily 和 Gemini/DeepSeek 路由，不包含检索问题节点、知识库节点、知识库连线或知识库 Prompt 注入。
- 2026-07-24 已移除 12 份重复的 `技能Skill-*/workflow.yml` 及空目录；这些 Skill 的 Prompt 均已收进“全技能总控”，后续只维护总控内的 selector、条件路由、Prompt 节点、变量汇总和两条模型分支。

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
- 2026-07-23 成本监控链路新增 `cost_update` 与 `cost_checksum`：模型成本只在 `node_finished` 后按 `outputs.usage`、`process_data.usage`、`execution_metadata.usage` 的优先级提取；Agent 采用节点汇总，不重复累加内部轮次；工具只在成功日志后入账；同一事件 ID 去重，不同重试事件 ID 分别保留。`message_end` 的全局 usage 只生成 Token 校验，不把可能混合 USD/RMB 的总价当结算金额。事件只保留模型、供应商、Token、原币金额和计费数量，不向浏览器发送 prompt、inputs、observation 或工具结果。
- Agent 的 `agent_message` 可能既包含“换关键词继续搜索”这类中间话术，也包含最后结论；Chatflow 内运行的 Agent 节点还可能把同类内容发成通用 `message`。代理会结合 Agent 节点的 `node_started` / `node_finished` 生命周期和新的工具/思考步骤 ID 分段：中间段作为浅色 `process` 覆盖显示，只在 `message_end` 时把最后一段提升为正式 `answer_replace`；不在 Agent 节点内的普通 Chatbot/Chatflow `message` 仍按 `answer_delta` 逐块展示。
- 2026-08-03 Agent 显式 `<think>` 协议新增有序轮次事件：代理只公开 thinking 的开始/结束边界，不公开标签内部正文；边界之间可公开的 `agent_thought`、工具名、搜索词和节点状态关联到该轮，`</think>` 后的可见 message 以增量“阶段小结”展示。下一次 `<think>` 会先定稿上一轮小结、再开启新轮计时；`message_end` 或正常 EOF 将最后一段提升为正式正文。浏览器为每个 thinking ID 独立记录 `startedAt` / `endedAt`，完成、报错和异常断流都会冻结尚未结束的轮次。
- 2026-07-14 增加跨事件 `<think>` 过滤器，标签即使被拆在两个网络块中也不会短暂泄露；最终返回的 `billing_trace` 同样移除了 Agent thought、节点 inputs/outputs 和工具输出，只保留成本面板需要的事件计数、Tavily 查询和 credits。
- 2026-07-14 修复 SSE 每次到达都重建 `#app.innerHTML` 引发的整屏闪烁：同一过程阶段只更新 label/detail 文本，同一答案阶段只更新当前 Markdown 容器，结构切换也仅替换本轮回答。恢复展示 Dify 对话 API 明确公开的 `agent_thought.thought`，继续过滤 `<think>` 等隐藏思考；没有公开 thought、工具名或搜索词的空 Agent 协议步骤不再生成通用占位。
- 2026-07-14 安全 Markdown 渲染增加 GFM 风格表格：识别表头、分隔行、列对齐和数据行，单元格继续支持粗体、行内代码与链接，并保持先转义后渲染；窄屏表格只在自身容器横向滚动。
- 2026-07-20 新增 `技能Skill > YD Artifact`：沿用归一化 SSE 与安全 Markdown，只在该页面识别特殊 fenced code block；流式代码块未闭合时显示无技术文字的稳定骨架，闭合后在原位置替换为图形。Mermaid/ECharts 在本地解析为静态、安全 SVG；原始 SVG 继续使用无脚本 iframe；显式 `html-artifact` 使用只授予 `allow-scripts` 的 opaque-origin iframe，并以 CSP 阻断网络、外部资源、Worker、表单和子 frame。宿主只接受来源 iframe 匹配的限幅高度消息；KASS 复用同一安全 Artifact 适配层和主题，其它 Dify 页面渲染路径保持不变。
- 2026-07-15 移除通用 Dify 对话页前端自设的 240 秒绝对超时：浏览器不再用 `AbortController` 提前中止仍在正常输出的 SSE，流保持到代理或 Dify 明确结束。
- 2026-07-15 正式聊天代理迁移到 `yd-prototype-dify-chat.gardengaoo.workers.dev`：Cloudflare 直接维持 Dify SSE，并每 15 秒发送注释心跳；Vercel 只承担毫秒级配置读写和受保护的运行时配置桥接，因此其 300 秒函数上限不再截断聊天回答。迁移时未导出、复制或提交原始 Dify Key；真实市场调研 smoke test 收到 `process`、`answer_replace`、`done`，HTTP 200 且成功创建 `conversation_id`。
- 2026-07-15 长 Agent 任务复核发现第一版 Worker 把响应依赖的流任务注册进 `ctx.waitUntil()`，约 30 秒后触发 `Network connection lost`；现已移除该调用，由仍在输出的 `TransformStream` 自身维持请求生命周期。随后又发现逐 token 过程事件和结束时二次解析整段 SSE 会触发 Workers Free 10 ms CPU 压力；现改为同一 Agent 段落最多发送少量覆盖更新，并在第一次解析时增量累计最终 ID、usage 和精简计费追踪，不再缓存后二次解析完整原文。
- 2026-07-15 使用“欧洲手持小风扇市场与销量”做最终长流验收：跨过原 30 秒断点并收到 8 次心跳，最终事件序列包含 `process`、`answer_replace`、`done`；正式答案 6188 字、成功创建 `conversation_id`、无 `error`。优化前同类流约 1.5 MB / 4106 个事件且没有 `done`，优化后约 19 KB / 19 个事件并完整结束。
- 配置存储所需环境变量：`DIFY_CONFIG_ENCRYPTION_KEY`、`KV_REST_API_URL`、`KV_REST_API_TOKEN`；也兼容 Upstash 常见的 `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`。
- KASS Agent Chatflow 可使用环境变量 `DIFY_CUSTOMER_KASS_API_KEY`，或在加密配置存储中使用固定 `feature_id=customer-kass`。A/B 只是界面方案，必须共用这一份 Key 和配置。浏览器发送当前原型客户引用、名称、完整页面上下文和随机 `workspace_id`；后者只用于隔离当前浏览器的虚拟数据。
- KASS 原型 CRM 的固定入口为 `https://yd-prototype-dify-proxy.vercel.app/api/kass-crm`。它复用配置存储已有的 Redis 环境变量，不需要 `KASS_CRM_AGENT_TOKEN`、`YINGDAN_ACCESS_TOKEN` 或 `YINGDAN_USER_ID`，也禁止接入真实赢单接口。支持 `bootstrap_customer`、`update_customer`、`create_followup`、`update_followup`、`delete_followup` 和对应 GET 查询；每次对话结束后，前端重新拉取 `context` 并刷新右侧客户资料与跟进记录。
- YD Artifact 兜底 Key 使用 `DIFY_YD_ARTIFACT_API_KEY`；市场调研兜底 Key 使用 `DIFY_MARKET_RESEARCH_API_KEY`。客户背调总控必须通过页面配置保存 API Key 和固定 `skill_key=customer-research`，不再读取早期独立 App 的 `DIFY_CUSTOMER_RESEARCH_API_KEY` 或 `DIFY_API_KEY`。任何环境变量值都不能写入仓库或日志。
- 2026-07-24 已删除早期独立客户背调资料、`api/dify-customer-research.js` 专用代理、Vercel 函数声明、独立环境变量兜底和前端直连调试遗留；客户背调统一走 Cloudflare 通用流式代理。脱敏后的 `billing_trace` 继续由 `lib/dify-api-client.js` 和 `lib/dify-core.js` 在通用链路中生成。
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
8. 打开 `客户Kass` 的 `A` 或 `B`，确认独立“重点推进”客户栏仍存在；切换「AI 助理 / 客户信息」，检查「客户档案」是否只展示稳定背景资料、来源合并状态和待完善数量；点击「查看完整资料」，确认宽幅「客户详细档案」可打开、关闭和纵向滚动，五组表格字段没有横向溢出，底部「补充背调」有原型反馈。在「跟进与待办」中展开记录、勾选关联待办，并检查新增跟进表单能否打开和取消。再点「线上原版复刻」，确认进入带全局侧栏、顶部栏、客户列表、12 阶段流程和底部输入框的独立页面，并能通过「返回重点推进」切回。
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
19. 进入 `#/admin/ai-cost`：先在“实测回放”依次检查四个场景，确认事件按到达时间变化、模型核对条使用实际 Agent 模型、右侧逐项入账；知识库场景因 Embedding 单价默认为 0，必须显示“暂停结算”。展开“我的成本单价”填写后，确认成本、销售价和 V豆立即重算。再切到“真实调用”，仅使用虚拟问题验证两个 Chatflow 的安全连接、SSE 成本事件与各自独立的 `conversation_id`。
20. 逐一打开 `src/dify-config.js` 白名单中的对话页，确认顶栏左侧都有应用类型、API Key、保存按钮和状态，销售准备、客户开发、客户Kass和普通后台页不出现该配置栏。
21. 在 `#/skills/market-research` 选择「对话型应用」并保存有效 Key，确认显示应用摘要；刷新后只显示掩码，不回传原始 Key。发送两轮消息，确认第二轮复用 `conversation_id`。
22. 在 `#/agents/customer-research` 选择「Chatflow」验证同样流程；故意选错类型时，保存应提示 Key 实际对应的应用类型，且不落库。
23. 进入 `#/skills/yd-artifact`，确认默认类型为「Chatflow」；用脱敏测试回答检查普通 Markdown、Mermaid、ECharts、SVG 在正文中的顺序、无技术文字的流式骨架、`#ff7830` 关键高亮和窄屏布局，正式视图不得出现“动态生成”“正在构建 Artifact”或“查看生成源码”。再带 `?artifactDebug=1` 确认内部源码区可用；用 `html-artifact` 检查按钮、Tab 或筛选交互真实生效、iframe 高度自适应，同时确认普通 `html` 只显示源码，外链/联网/跳转代码会降级为错误卡而不执行。
24. 运行 `npm run test:dify`，确认成本计算、重试/去重、Dify 模式识别、加密存储、API handler、SSE 解析、YD Artifact 渲染与前端状态测试全部通过。
25. 运行 `npm run check:cloudflare`，确认 Worker 能完整打包且没有把 Secret 写进 `wrangler.jsonc`。
26. 无内部令牌 POST `https://yd-prototype-dify-proxy.vercel.app/api/dify-runtime-config`，应返回 401；从正式对话页发送消息，应由 Cloudflare 返回 `process` / 正式答案 / `done`。
27. 调整到窄屏，确认顶栏配置项、正文和按钮不重叠、不溢出。
28. 进入 `hyperframes/chatflow-cost-animation/` 运行 `npm run check`，确认 Runtime、Layout、Motion 均为 0 问题且 509/509 项文字对比度通过；再打开 HyperFrames Studio 播放 39 秒单画布时间线，并抽查 `snapshots-node-run/contact-sheet.jpg` 中 10.5 秒的 Embedding、22.5 秒的实际 Agent 模型、26 / 29 秒的两个 Tavily 工具和 35.5 秒的最终四项汇总。用户确认预览后再渲染最终 MP4。
29. KASS 改动先运行 `node --test tests/kass-crm-gateway.test.js`，再运行完整 `npm test`。使用假 fetch 验证网关令牌、客户归属、字段白名单和 GET / POST action；不得在自动测试中调用真实赢单账号。
30. 进入 `dify-plugins/kass-prototype-crm/`，先运行 `../nano-banana-dynamic/.venv/bin/python -m unittest discover -s tests -v`，再用 Dify Plugin CLI 执行 `dify plugin package . -o dist/kass-prototype-crm-0.1.1.difypkg` 并检查压缩包。随后对 `dify-chatflows/客户Kass-客户管理-KASS-Agent/workflow.yml` 依次运行 `dify-workflow validate --strict`、`dify-workflow checklist` 和 `dify-workflow import -o /dev/null --validate-only`。浏览器打开 `#/customer-kass/A`，切换多个等级/客户，确认档案、跟进和待办完整；再打开旧 `#/customer-kass/B` 确认地址与界面均自动归一到 A。安装 Plugin、发布更新后的 KASS Chatflow 后，再配置其 App API Key 并验证 Plugin CRUD、SSE、多轮 `conversation_id` 与 Artifact。
31. `赢单 Dify 高并发测试` Skill 改动后，运行 `PYTHONDONTWRITEBYTECODE=1 python3 .agents/skills/yingdan-dify-high-concurrency-test/scripts/dify_production_diagnostics.py self-test`，再运行 `python3 /Users/garden/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/yingdan-dify-high-concurrency-test`。只有用户明确授权正式 URL 和并发数后，才可使用带 `--confirm-production` 的 `load` 或 `both`；离线验证不得调用真实账号或 Dify。
32. 客户开发本地模式运行 `python -m unittest tests/test_pdl_local.py -v` 后启动 `pdl_local.py serve`，打开 `http://127.0.0.1:8788/index.html#/customer-development`。PDL 应返回真实公司字段且不猜联系人邮箱。地图获客只显示目标国家、目标城市、商户行业、目标数量和公开联系方式，不得出现市中心半径、距离排序或经纬度；商户行业选择器应显示 10 个 B2B 业务大类、64 个聚合行业，并能搜索“太阳能、机械、汽配、建材、物流”等中英文业务词。1,274 条 Foursquare 原始分类仅用于后台映射，界面不得出现“地标与户外、夜生活”或细分酒吧目录；餐饮原始分类统一聚合为“餐饮与连锁门店”。查询结果应标注 Foursquare 真实地点，优先显示资料完整且更新较新的商户，详情展示类别、地址、更新时间和公开渠道，并说明不具备客户角色、公司规模或采购意向。GitHub Pages 必须保持演示标识。Hunter 仍只能在用户点击后按域名查询，Key 只存在于服务端环境。2026-08-19 Foursquare OS Places 本地 28 个 Parquet、109,255,094 条地点已接入真实查询。

浏览器插件验证方式：

1. 语法检查：`node --check browser-extension/content-script.js`、`node --check browser-extension/background.js`、`node --check browser-extension/inquiry-analyzer.js`。
2. 清单检查：`python3 -m json.tool browser-extension/manifest.json >/dev/null`。
3. 打包检查：重新生成 zip 后执行 `unzip -t yingdan-inquiry-extension-v0.2.0.zip >/dev/null`。
4. 回归检查：确认 `browser-extension/` 里没有 `default_popup`、`popup.html`、`popup.js`、`popup.css`、`补充产品/底线`、`Coze 连接`、`开启新会话` 这些旧弹窗残留。
5. 浏览器检查：在当前 Chrome 扩展管理页点击重新加载插件，打开含客户询盘的网页，点击插件图标后应先出现右侧面板和「开始分析」按钮；只有用户点击「开始分析」后才调用 Coze。
6. Markdown 检查：AI 返回的标题、列表、加粗、代码块、链接和 `| 表头 |` 表格应按安全 Markdown 渲染，不显示裸露的 `###`、`**` 或表格分隔线。

Dify 日志查询插件验证方式：

1. 运行 `node --test dify-log-browser-extension/tests/*.test.js`，测试必须全部离线通过。
2. 对 `background.js`、`query-engine.js` 和 `sidepanel.js` 运行 `node --check`，并用 `python3 -m json.tool` 校验清单。
3. 运行 `sh dify-log-browser-extension/package-extension.sh`，再用 `unzip -t dify-log-browser-extension-v0.1.0.zip` 验证；ZIP 根目录必须直接包含 `manifest.json`，不得包含 `tests/` 和 `CONTEXT.md`。
4. Chrome 114+ 加载 `/Users/garden/YD/Prototype/dify-log-browser-extension`，在已登录的 Dify Cloud App 日志页确认 Token Mind 图标、当前 App ID、三种模式和北京时间选项。
5. 只用短时间窗执行一次“应用失败”只读查询；若缺少 CSRF，只通过插件的“刷新日志页”取得，不复制 Cookie 或其他凭据。整个验证不得发送 Dify 写请求或测试消息。

Excel 交付验证方式：

1. 直接保存生成或修改后的 `.xlsx`。
2. 通过 `unzip -t` 验证 OOXML 包结构。
3. 分别用 `openpyxl.load_workbook(data_only=False)` 和 `data_only=True` 重开验证。
4. 检查代表性公式、引用、常见错误值和视觉可读性。
5. 保留合法的 table、drawing、图表及 relationships；只有出现已证实的文件级兼容问题时才定向修复。

任一步失败都不能交付 `.xlsx`。

## Dify 在用应用同步约定（2026-09-09）

用户确认当前在用两项：`f68ca6a0-5b51-47ef-8d29-effb5b974ad0`（不需要知识库的总库）与 `c50fba61-a7e8-4175-b25b-2e46c8dad5b1`（全技能总控）。后续“更新工作流/拉最新 DSL/这两个工作流”默认指这两项，用户说的 dify workflow 目录沿用 `dify-chatflows/`。具体链接、文件映射和同步记录见 `dify-chatflows/README.md` 的“当前在用工作流与同步约定”。本次已从 Dify 页面导出当前已保存版本并验证落盘，未发布或试跑。

2026-09-09 用户在生产画布修改并确认发布后，已重新导出当前保存版本覆盖本地 DSL（32 节点、39 连线）。标题条件为 title-combo OR title-sellpoint；标题分支实际保留模型选择，DeepSeek 关闭思考、Gemini 为 Low；其他功能 DeepSeek 为开启思考且 low。以本次线上导出为准，之前固定 DeepSeek 的本地方案已被替换。详情见 dify-chatflows/README.md。未单独比对发布版本、未试跑或实测耗时。

## 2026-09-11：AI作图与 ALI运营顾问原型

本次参考任务「盘点项目中的 Dify Flow」（01a08a73-d2c3-7420-b3c1-98c9a64e03dc）对应 `/Users/garden/YD/批图匠`。读取当前代码并打开参考页面后，在赢单现有原生 HTML/CSS/JavaScript 原型内新增两个一级业务入口，没有引入前后端服务或接通真实图片模型。

- 「AI作图」子菜单直接提供 `#/image-studio/main`（主图）、`#/image-studio/set`（套图）、`#/image-studio/listing`（详情图）、`#/image-studio/poster`（海报）、`#/image-studio/retouch`（批量AI修图）和 `#/image-studio/outfit`（批量模特换装）。`#/image-studio` 默认进入主图；旧 `#/image-studio/generate` 兼容打开套图。已移除批量生图菜单和四个生图页内的图片类型切换，窄屏页内导航同步提供六个入口。
- 作图实现位于 `src/image-studio.js`、`src/image-studio.css`，本地图片在 `assets/image-studio/`；从批图匠参考资产复制，模板含高信息量套图、极简套图、B2B详情图。`window.YD_IMAGE_STUDIO.mount` 由 `src/app.js` 调用。主图/套图/详情图/海报保留用户选定图 1 的轻量输入，结果按后续反馈改为 200px 小图网格，按日期和时间倒序展示当前会话记录，点击图片可放大；画面风格和内容结构放在按需打开的抽屉内；“更多设置”在按钮下方展开尺寸、版数、清晰度以及商品信息、Logo 和模型，点击“开始作图”直接模拟生成。修图与换装仍保留逐张方案确认流程。支持本地素材、单张调整演示、大图切换及当前会话历史。
- 作图状态按六个入口分别保留在模块内存中；`src/image-studio.js` 的 `GENERATION_TYPES` 把四个生图入口映射为固定图片类型，默认每版分别为 1 / 6 / 8 / 1 张，详情图默认使用 B2B采购详情图模板，新建任务保留入口类型及该入口的历史。`phase` 为 `empty/results/planning/review/generating`，`plans` 保存逐张方案，`results` 保存本地示例图片，`history` 保存本次页面会话完成的任务；刷新后重置。生图在准备、生成与单张调整期间锁定输入；修图与换装在方案确认阶段也锁定表单。跨入口的异步任务显式传入开始时的会话和模式，不串写其它入口。
- 商品图片在主图入口限制为 1 张，上传后可更换；套图、详情图和海报仍最多 10 张。图片通过 FileReader 读入当前浏览器，PNG/JPEG/WebP 每张不超过 10 MB；不上传文件，不调用模型，不扣费。结果标记为「演示结果」，导出仅给出原型反馈。清晰度、模型等参数用于演示选择过程，不代表实际处理后的图片属性。
- `#/operations-advisor`：在赢单导航内以 iframe 承载 `prototypes/operations-advisor/index.html`，也可独立打开该文档。来源是 `/Users/garden/YD/l-sou/来搜运营顾问plugin-panel-分享版(1).html`，交互含义参照同目录《来搜ALI运营顾问-业务与交互说明.md》。仅提取运营顾问八个模块，移除原插件其他业务页签、推广、品牌与账号外壳。
- 运营顾问原始样式表和八模块 HTML 均保留；允许差异为初始激活状态、两处跨业务入口改为赢单既有背调/询盘分析路由、宿主布局及小屏抽屉位置。原有静态分析、关键词匹配追问、模拟下载和原本没有事件的入口均保持原语义，不包装为真实运营能力。`paDone_` 状态加 `yd-operations:` 前缀隔离本地存储；用户聊天输入改为 `textContent` 防止 HTML 注入，内置报告排版不变。
- 子页面通过 `yd-operations-navigate` 消息传递固定业务标识，宿主验证发送 iframe、同源和功能白名单后跳转。不会传递客户数据或执行询盘发送。
- 路由与宿主在 `src/app.js`，导航在 `src/data.js`，样式和脚本在 `index.html` 引用。浏览器控制台的 `[yingdan-image-studio]` / `[yingdan-operations]` 日志记录加载、方案就绪、演示完成和图片读取异常，不记录用户素材内容。

### 本次视觉与交互验证

使用 Product Design 的参考复刻与设计核验流程。遵循项目“不主动创建额外文档”约定，把核验记录放在本节；截图留在已忽略的 `outputs/product-design-20260911/`，不作为主工程提交。

- 本地预览：`python3 -m http.server 8891 --bind 127.0.0.1 --directory /Users/garden/YD/Prototype`。桌面视口 1280×900，小屏 390×844。最终按 DPR 2 统一采集，桌面整屏 2560×1800；运营模块内容为 356×510.78125 CSS px，截图为 712×1020 px。
- 来源截图：`studio-reference-desktop-final.png`、`operations-home-reference-2x.png`。实现截图：`studio-implementation-desktop-final.png`、`operations-home-implementation-2x-final.png`。并排比较证据：`studio-final-comparison.png`、`operations-final-comparison.png`。作图示例作品用于比对，参考页“正在生成4/6”为既有模拟状态；赢单明确显示示例作品。
- 字体、字重和文字层级：运营顾问复用原值；作图沿用赢单字体并保留参考界面的表单/结果层级。布局与间距：运营八宫格内部尺寸一致；作图保留左右工作区，外部导航适配赢单。颜色：运营原样式完全相同，作图使用相近橙色与米白底。资产：复用真实参考素材，未生成替代占位图，已检查已展示图片无加载失败。文案：运营模块原文一致，作图说明按原型范围调整。
- 发现并修复的 P2：手机窄导航栏中的品牌文字截断及“新增客户”挤出；隐藏该文字、保留品牌图标，并提供手机作图导航。修复后 `studio-mobile-final.png` 已重新采集，DOM 宽度 390、页面滚动宽度 390。运营手机报告证据为 `operations-mobile-report.png`，关闭、下载、追问入口可见。
- 浏览器实测：运营八模块进入/返回；看板日/周/月花费切换；新店方案报告与追问；营销定位周/月清单切换、勾选并恢复；广告诊断报告与下载按钮状态。作图模板切换、本地文件导入、三个作图入口、逐张方案、单张修改、确认生成、预览翻页、历史查看与图片数量计算均已检查；详情图10版共80张，主图/海报每版1张。用户输入 `<b>测试文本</b>` 只作为文字显示，未产生 HTML 子节点。
- `node --check src/app.js`、`node --check src/image-studio.js`、提取的运营脚本语法检查和 `git diff --check` 通过。`npm test` 为 158/158，通过；作图与独立运营页面未见 error 级控制台错误。赢单内嵌运营页的八个入口与报告已实测；该内嵌页有一条 Codex 浏览器自身 `browser-page-preload.js` 的 MutationObserver 异常，经调试栈和脚本来源核验，与项目脚本无关，未阻断模块操作。没有真实接口或发布验收。
- final result: passed。作图为参考适配，运营内部视觉保真；剩余的固定报告、模拟下载和不可点击“下一步”属于来源原型既有行为。

### 独立作图入口调整与验证（2026-09-11，45f9 worktree）

- 按用户要求把主图、套图、详情图、海报提升为「AI作图」子菜单入口。名称仍为「AI作图」，沿用原有 HTML/CSS/JavaScript 和演示流程。仅修改作图实现、导航路由及资源缓存键；未调整 ALI运营顾问。现有缓存键检查已随 `index.html` 中 `app.js` / `data.js` 的版本同步。
- 本 worktree 预览使用 `python3 -m http.server 8901 --bind 127.0.0.1 --directory /Users/garden/.codex/worktrees/45f9/Prototype`，入口 `http://127.0.0.1:8901/#/image-studio/main`；8891 仍是主目录的独立预览。
- Product Design 核验沿用本文件记录，未新增设计文档。原界面 `/tmp/yingdan-image-entries-20260911/before.png`、新套图界面 `after.png`、左右并排证据 `comparison.png`、手机证据 `mobile.png` 均位于同一临时目录。桌面源图和实现均为 1280×900 CSS px / 1280×900 图片，密度为 1，无需缩放；对照状态均为套图示例结果、空白表单。移动端为 390×844。
- 字体与文字层级、橙色和米白色、素材质量与图片裁切沿用原页面；左右分栏宽度与结果区域一致。布局变化为侧栏增加独立入口、表单移除类型选择后上移，以及手机导航分两行。文案仅对应入口和空态调整。整屏并排证据能清楚辨认菜单、表单和结果，没有需要额外局部对照的视觉偏差；无 P0/P1/P2 问题，无视觉修复迭代。
- 浏览器已实测四个入口的地址、标题、默认张数、示例数量、模板、表单无类型切换、输入各自保留；四类逐张方案分别为 1 / 6 / 8 / 1 张，方案确认时表单锁定。海报确认生成后切至套图，套图方案不受影响；返回海报能查看已完成结果及独立生成记录。新建海报/详情图任务保持对应类型，详情图选择 10 版显示 80 张。手机六个入口可切换且当前项高亮，六页的文档宽度/滚动宽度均为 390，无横向溢出。控制台未见 error 日志。
- `node --check src/data.js`、`node --check src/app.js`、`node --check src/image-studio.js`、`git diff --check` 通过；`npm test` 为 158/158。首次全量测试发现缓存键断言仍使用旧值，同步现有断言后复跑通过。以上为静态原型验证，图片仍是模拟结果。
- final result: passed。


### 图 1 轻量作图工作台（2026-09-11，45f9 worktree）

- 用户选择前三张设计稿中的第 1 张，并在暂停后明确恢复实施。四个生图入口统一采用“商品图片 → 想怎么拍 → 画面风格 → 开始作图”，首屏只保留一个简短输入框；右侧为大图、调整这张和下载，多图任务通过下方缩略图切换。现有赢单导航外壳与 ALI运营顾问保持原实现。
- `renderCreative` / `renderCanvas` 负责新工作台；`renderCreativeDialog` / `settingDrawer` 负责风格、更多设置及单张调整。`visualStyle` 保存风格选项，`dialog` 新增 `styles/settings/adjust`。模板结构随图片类型筛选；比例、版数、清晰度和可选商品资料收在更多设置，模型再收进高级设置。
- 初始左侧放入带“示例”标记的商品，便于直接体验。上传自己的商品后替换示例；新建任务清空商品、要求与结果，保留本入口历史和默认类型。仍仅通过 FileReader 在浏览器内读取文件，不上传图片。
- 生图使用 `plan(true)` 直接衔接 `generate(session,currentMode)`，不要求用户确认 Prompt；修图与换装仍用 `plan()` 和确认按钮。生成结果选择索引归零，防止张数变少后选中越界。`saveRecord` 保存独立快照；历史恢复时也克隆结果，避免后续修改影响旧记录。
- “调整这张”只演示对当前图片记录修改要求，其他图片保持原样；界面明确提示当前仍是示例图片，没有接入真实生图或修图服务。生成、改单图和错误反馈沿用 `[yingdan-image-studio]` 开发日志，不记录素材内容。
- 大图素材 `assets/image-studio/mug-studio-main.png` 由所选设计稿生成，1254×1254；图标从官方 `@tabler/icons` 3.46.0 包抽取到 `assets/image-studio/icons/`，MIT 许可保存在该目录。两项作图资源缓存键为 `20260911-light-studio`。

#### 图 1 的视觉与交互验收

- source visual truth：`/Users/garden/.codex/generated_images/01a08e60-5827-7192-8d36-8bfb388883bc/exec-4347518a-844b-4e21-9991-e151ce219578.png`。原图为 1487×1058，按比例取整归一到 1440×1024；桌面实现截图为 1440×1024 CSS px / 同像素尺寸，密度为 1。
- implementation：`/tmp/yingdan-studio-redesign/desktop-final.png`；整屏并排证据 `comparison-final.png`；输入区域局部并排证据 `input-comparison.png`；手机截图 `mobile.png` 与抽屉截图 `mobile-settings.png`，均在同一临时目录。对照状态为主图、示例商品、自然光、默认要求、单张示例效果。
- 字体与层级：使用项目 PingFang / 微软雅黑字体栈，输入正文 14px、标题 17–23px；输入、画面风格、主按钮、更多设置层级对应所选图。间距与布局：保留 260px 原应用侧栏，工作台输入区 350px，大图在剩余空间展开；外壳宽度与设计稿有意不同，避免改变全站导航。输入区四项操作完整可见，去掉嵌套卡片。颜色：白色主体、浅灰分隔和橙色操作；图片：生成独立杯子素材，以等比例方式展示，无破图；文字：按图 1 使用“想怎么拍”“开始作图”等业务文案，并保留示例标识。原站侧栏的密度、选中颜色与账号区域保留，属于现有产品约束。
- 初次整屏与局部对比未发现 P0/P1/P2；完成交互检查后的最终截图再次与来源并排核验，无视觉修复迭代。允许的 P3 差异为生成素材的叶影和细小颗粒纹理，以及界面未显示设计稿的字数计数。
- 浏览器已验证：四个入口分别直接完成主图（测试 2 版）、套图 6 张、详情图 8 张、海报 1 张，首屏不显示 Prompt；主图生成期间切到套图不会串写。风格切换、更多设置的比例/数量、历史记录、新建空态、空输入提示、FileReader 上传并替换示例、缩略图选择、放大后翻页、改单张及其他图片保持、用户文本 HTML 转义均通过。当前操作仍为模拟生成/下载。
- 手机 390×844 下六个入口都能切换，页面宽度与滚动宽度均为 390；抽屉宽约 366.6px，按钮可操作。修图和换装保留原入口与“生成 Prompt”按钮。所检查的图片没有加载失败，控制台 error 日志为空。
- `node --check src/image-studio.js`、`node --check src/app.js`、`git diff --check` 通过；现有 `npm test` 为 158/158。QA 记录依项目约定写在 CONTEXT.md，没有新建设计文档。
- final result: passed。


### 示例效果缩小（2026-09-11，45f9 worktree）

- 用户要求示例效果减少占位。四个生图入口的 `.studio-canvas` 统一限制为 320px 并靠左，图片随容器收缩；标题改为 18px、辅助文字 12px，调整与下载按钮移到图片下方，多图缩略图缩为 56px。示例与生成结果采用同一尺寸，切换状态不会重新铺满工作区；点击图片仍打开原有大图预览。
- 修改 `src/image-studio.css` 与 `renderCanvas` 的布局，未修改输入和生成逻辑；`index.html` 的两项作图资源缓存键更新为 `20260911-compact-preview`。
- 本次 QA：桌面 1440×1024，手机 390×844。调整前后相同主图示例状态截图 `before.png` / `after.png`、整屏并排 `comparison.png` 和手机 `mobile.png` 位于 `/tmp/yingdan-studio-compact-preview/`。对照确认左侧输入、字体栈、颜色和图片素材沿用现状，右侧预览按要求缩小且操作靠近图片，无裁切或溢出；未发现 P0/P1/P2 问题。
- 浏览器实测四类图片预览均为 320×320px；手机自动收至 290px，页面宽度/滚动宽度均为 390px。桌面和手机放大/关闭、套图末张缩略图切换通过，控制台 error 为空。`node --check src/image-studio.js`、`git diff --check` 通过；本次只调整样式和按钮布局，未重复运行此前已通过的全量测试。final result: passed。


### 小图按日期排列（2026-09-11，45f9 worktree）

- 根据用户“再小一点、按照日期排”的反馈，主图/套图/详情图/海报的预览从 320px 缩至 200px。结果改为图片网格，同一天归到一个日期标题下，日期和当日任务均从新到旧排列；每张图片下方提供调整、下载，点击放大后仍可在同一任务内翻页。
- `resultCreatedAt` 保存毫秒时间戳，`resultId` 标识任务快照；显示文本 `resultTime` 不参与排序。`saveRecord` 分配时间和标识，`groupRecordsByDate` 按浏览器本地日期分组，`galleryRecords` 合并当前结果与历史并去重。初始示例按本次打开日期展示且保留示例标识，没有虚构过往生成记录。
- 连续生成保留旧任务，生成过程中可继续看到已有图片；新建任务清空输入和当前结果后仍显示会话历史。`selectRecord` 仅切换用于放大或调整的结果，不覆盖输入参数。单张调整保存新快照，原有历史内容保持独立。刷新仍清空本页会话，没有新增服务端或持久化存储。
- 修改范围：`src/image-studio.js`、`src/image-studio.css`、`index.html` 与本记录；资源缓存键为 `20260911-date-gallery`。未修改 ALI运营顾问或真实图片服务。
- 视觉 QA：`/tmp/yingdan-studio-date-gallery/before.png`、`after-matched.png` 为同一套图示例、1199×1024 CSS px / 同像素截图，整屏并排为 `comparison-matched.png`；额外桌面 `after.png` 为 1440×1024，手机 `mobile.png` 为 390×844，连续生成记录为 `main-history.png`。左侧表单、字体栈、颜色和素材沿用已有实现；图片尺寸及日期分组为本次指定变化，未发现 P0/P1/P2。
- 浏览器实测四类默认 1/6/8/1 张，预览均 200px；连续生成两次保留两条且最新在前，旧图查看不重复插入；套图末张放大及上一张、关闭、单张调整均通过。调整后的备注只在对应图片出现。手机宽度/滚动宽度均 390，放大和关闭可操作；控制台 error 为空。
- 离线 VM 验证（`check-date-gallery.cjs`，位于上述临时目录）分别用 Asia/Shanghai 和 America/Los_Angeles 时区检查跨年、跨月、午夜分组、同日排序、同毫秒唯一标识、去重、旧快照隔离和新任务保留历史，均通过。`node --check src/image-studio.js`、`git diff --check`、现有 `npm test` 158/158 通过。final result: passed。


### 更多设置在下方展开（2026-09-11，45f9 worktree）

- 按用户对“更多设置”的标注，将四个生图入口的设置抽屉改为左侧按钮下方展开，再次点击收起。原有参数和可选字段完整保留，画面风格仍使用原抽屉。
- `renderInlineSettings` 渲染原位设置，`toggleSettings` 更新面板 `hidden` 和按钮 `aria-expanded`，避免展开时重绘整个页面或丢失焦点。`settingsOpen` 保存各入口的展开状态；`productInfoOpen` / `advancedSettingsOpen` 保留内层折叠状态，改变参数或上传引起重绘时仍维持展开。已选值收起后保留；新建任务按原规则重置。
- 设置面板位于原有 fieldset 内，生成期间参数同样锁定，完成后可继续修改。修改作图脚本、样式、入口缓存键（`20260911-inline-settings`）和本记录。
- 浏览器实测四个入口均在按钮下方显示设置，未出现 dialog；版数及总张数更新、模型变更、收起重开和高级设置状态保留均通过。手机 390×844 下设置宽 290px，页面宽度/滚动宽度均 390；生成两张海报期间锁定参数，完成后设置保持展开并恢复可编辑，控制台 error 为空。
- 视觉 QA：`/tmp/yingdan-studio-inline-settings/` 中 `before.png` / `collapsed.png` 均为 1094×934，整屏并排为 `comparison.png`，确认收起时主工作台布局沿用原样；`expanded.png` 与 `mobile.png` 记录展开效果。字体、颜色、字段间距沿用现有表单，没有裁切或横向溢出，未发现 P0/P1/P2。`node --check src/image-studio.js`、`git diff --check` 通过；本次局部交互调整未重复全量测试。final result: passed。


### 主图只上传一张商品图片（2026-09-11，45f9 worktree）

- 按用户要求，只有主图入口限制一张商品图片。`renderProductUpload` 在主图去掉 file input 的 `multiple`，有图时展示“更换图片”，空态提示“上传或拖入 1 张商品图片”；其余三个生图入口继续保留多选和最多 10 张。
- `addFiles` 对主图的商品素材采用替换模式，多文件拖入或粘贴只读第一张有效图片并提示。读取成功后再替换旧图，超大文件或读取失败保留旧图；`productUploadRevision` 避免连续更换时旧读取覆盖最新选择，移除时也作废尚未完成的读取。
- 修改范围为作图脚本、样式、资源缓存键（`20260911-single-product`）与本记录。主图仍可基于同一张商品图生成多版，默认模型仍为 PTJ-1。
- 浏览器验证：实际通过文件选择器先后更换两张本地素材，始终只有一张；移除后回到单图上传空态，其他三个入口仍为 `multiple=true`。手机 390×844 无横向溢出，控制台 error 为空。截图在 `/tmp/yingdan-studio-single-upload/`：`before.png` / `after.png` 为空态对照，`with-image.png` 显示更换入口，`mobile.png` 为窄屏。
- 离线验证 `check-upload.cjs` 位于同一临时目录，覆盖多文件取第一张、替换不叠加、超大/读取失败保留旧图、并发更换优先最新选择、套图仍支持多图及 10 张上限，全部通过。`node --check src/image-studio.js`、`git diff --check` 通过；本次未重复全量测试。


### 主图右侧增加视觉层次（2026-09-11，45f9 worktree）

- 用户反馈主图右侧过于空白。仅在主图结果区添加 `studio-gallery-surface`：暖灰底色、浅色作品卡、日期标签与分隔线，并把调整/下载收进卡片底部。内图仍为 200px，含边框和留边的卡片为 224px；其他作图入口保留原视觉。
- 修改 `renderCreative` 的主图样式作用域、局部 CSS 和资源缓存键 `20260911-warm-gallery`。单张商品上传、PTJ-1 默认值、下方展开的更多设置、日期排序及生成逻辑沿用现状。
- 使用 frontend-design 做局部视觉整理，沿用赢单字体、暖色和既有图片素材。`/tmp/yingdan-studio-warm-gallery/` 的 `before.png` / `after.png` 均为 1094×934，同一主图空上传/示例结果状态；`comparison.png` 为整屏并排，确认左侧布局一致，右侧底色、卡片和文字层次符合此次修改。`mobile.png` 为 390×844，页面宽度与滚动宽度均 390，图片 200px、卡片 224px，无横向溢出。
- 浏览器验证桌面与手机的图片放大/关闭、卡片下载原型反馈；控制台 error 为空。`node --check src/image-studio.js`、`git diff --check` 通过；本次样式调整未新增测试或重复全量测试。


### 主图输入区改为独立卡片（2026-09-11，45f9 worktree）

- 用户反馈输入区贯穿整页的窄白栏不美观。主图通过 `studio-main-page` 作用域改为暖灰工作底上的独立输入卡：桌面宽 360px，1050px 以下使用 320px，内容结束即收尾；横向单图上传区与暖色输入控件统一，压紧各项操作间距。
- 桌面设置展开后卡片最高为视口减 112px，可在卡片内滚动；900px 以下改为单列整页滚动，避免手机出现嵌套滚动框。更多设置仍原位展开，上传上限、默认 PTJ-1、生成逻辑与右侧 200px 小图/日期分组沿用现状。
- 修改仅涉及 `renderCreative` 的主图 class、局部 CSS、资源缓存键 `20260911-input-card` 和本记录，其他生图页面不使用该样式。
- 视觉对照在 `/tmp/yingdan-studio-input-card/`：`before.png` / `after.png` 均为 1094×935 的同一主图空上传/示例结果状态，整屏并排为 `comparison.png`；输入卡宽 360px、高约 534.5px，在页面 y=622.5 处收尾。`settings.png` 记录展开设置，卡片在 y=911 处结束，没有超出 935px 视口。
- `mobile.png` 为 390×844，输入卡宽 302px、内容采用自然高度，页面宽度/滚动宽度均 390，预览仍 200px。浏览器检查展开设置、版数/比例选择、收起，以及新横向上传控件。`node --check src/image-studio.js`、`git diff --check` 通过，本次样式调整未新增或重复全量测试。


### 主图采用批图匠参考图的视觉风格（2026-09-11，45f9 worktree）

- 用户提供原批图匠页面截图，要求参考其观感。主图改为浅暖灰工作底 `#f8f7f5`、两侧独立白色面板、淡橙描边与鲜橙按钮；输入区桌面宽 360px，常规宽 390px，1400px 以上宽 420px，两侧面板随内容收尾。
- `renderMainComposer` 将单张商品上传、文字要求和简短提示合并在一个橙色边框内，上传行采用淡橙背景。空态显示上传图标和 `0/1 张`，有图后改为 64px 缩略图、更换入口及 `1/1 张`。沿用原 `data-upload`、`data-drop`、`data-field` 和移除事件，不修改上传校验、生成或日期排序逻辑。其余三个生图入口仍使用原上传区。
- 参考图中的批量入口、密集参数和大图网格不属于这次视觉要求；沿用用户已确认的独立入口、主图单张上传、PTJ-1 默认、200px 结果图片和下方展开设置。950px 以下两面板改为单列整页滚动，移动端缩略图显式固定最小宽度，避免受到其他入口的 88px 规则影响。
- 修改 `src/image-studio.js`、`src/image-studio.css` 和 `index.html` 的资源缓存键 `20260911-reference-style`。本次替换原主图样式块，未叠加另一套覆盖规则，未涉及 ALI 运营顾问或其他模块。
- 视觉 QA 位于 `/tmp/yingdan-studio-reference-style/`：`before.png`、`after.png` 是同为 1094×935、主图空上传与示例结果的前后状态；`desktop-1440.png` 为大屏，`mobile.png`、`mobile-uploaded.png` 为 390×844 的空态/有图态，`settings.png` 为桌面设置展开。已将用户参考和实现截图放入同一视觉检查输入，对照了面板、配色、边框、上传和文字组合。参考为套图模式且截图尺寸不同，此处仅继承视觉风格，内容密度差异是保留既有产品决策所需，不作像素级复刻结论。
- 浏览器验证单张上传、更换不叠加、提示计数、文字保留、风格选择、设置展开/收起、默认 PTJ-1，以及生成两张演示结果后的解锁和图片放大/关闭。三个其他入口保持 6/8/1 张示例和多选上传。1094px/1440px/390px 下均无横向溢出，结果内图均为 200px；最终常规输入面板为 360×528.1px，控制台 error 为空。`node --check src/image-studio.js` 和 `git diff --check` 通过，本次展示层调整未新增或重复全量测试。


### 画面风格原位展开、主图两侧面板到底对齐（2026-09-11，45f9 worktree）

- 按用户三处浏览器标注，四个生图入口的画面风格改为按钮下方展开，再次点击收起。`stylesOpen` 独立保存在各入口会话中，`renderInlineStyles` 沿用四种风格、单张风格参考图以及套图/详情图的内容结构选择；`toggleStyles` 只更新 `hidden` 与 `aria-expanded`，不再打开右侧抽屉。
- 风格选择、参考图上传、参数重绘及生成后保持展开状态，和更多设置可以同时展开。风格内容位于原 fieldset 内，生成期间同样锁定。主图在重绘前后保存 fieldset 的 `scrollTop`，避免上传参考图后跳回顶部；移除了已无入口的风格抽屉渲染函数。
- 主图桌面工作区使用单行可收缩网格，两侧面板延伸至视口底部留边并同高。左侧 fieldset 独立滚动，底部增加淡橙色“主图小贴士”卡片，卡片位于滚动区外，不覆盖输入和操作。右侧结果独立滚动，图片仍为 200px，日期分组沿用原逻辑。
- 950px 以下使用 `max-content` 行高和自然内容高度，整页滚动；避免桌面 `min-height:0` 导致窄屏两行被压缩、面板互相覆盖。主图面板改动限于 `studio-main-page`，其余生图入口仅更新风格展开方式。
- 浏览器检查：四个入口都在按钮下展开且 dialog 数量为 0，套图/详情图保留 2/1 种内容结构；选择风格、参考图上传、展开/收起、两组设置共存、生成锁定及完成解锁均通过。参考图上传前后左侧滚动值同为 224.5px。1094×935 下两面板底部同为 915px，1375×935 下同为 913px，1375×640 下同为 618px，较矮窗口中的参数仍能滚动操作，底卡不遮挡字段。
- 390×844 下风格和更多设置可展开，提示卡在字段后、结果面板在表单后，没有重叠；页面宽度与滚动宽度均为 390。截图保存在 `/tmp/yingdan-studio-inline-style/`：`before.png` / `after.png` 为 1094×935 的同状态对照，`desktop-1375.png`、`expanded-upload.png`、`mobile-expanded.png` 覆盖桌面与展开态。控制台 error 为空；`node --check src/image-studio.js`、`git diff --check` 通过。资源缓存键更新为 `20260911-inline-style-panels`，本次局部交互调整未新增测试或重复全量测试。


### 四个通用画面方向与参考图互斥（2026-09-11，45f9 worktree）

- 用户确认改为跨行业的四个方向：简洁展示、场景应用、质感展示、创意表达。`VISUAL_DIRECTIONS` 用名称与一句说明定义，删除旧风格卡片中的杯子缩略图；入口文案改为“画面方向”。默认使用简洁展示，沿用 `visualStyle` 会话字段保存所选方向。
- 仅当风格参考图 `style` 存在时，四个方向按钮使用原生 `disabled` 置灰，全部 `aria-pressed=false`；提示“已使用风格参考图，移除后可选择方向”，入口显示“画面方向 · 风格参考图”。商品图片 `uploads` 不会禁用方向。移除风格参考图后重新启用，并恢复之前记住的方向。
- `chooseDirection` 除原生按钮禁用外，还校验参考图及生成状态，避免旧回调清空参考图或改写方向。套图/详情图的内容结构选项仍独立可选。`directionGuidance` 在本地演示方案中只带入参考图要求或通用方向之一，参考图生效时不叠加已记住的方向；结果仍是现有演示图片，没有真实模型请求。
- 风格参考图改为读取成功后原子替换，失败或超大文件保留旧图及禁用状态；`styleUploadRevision` 保证并发替换时最后一次选择生效，移除图时作废未完成的读取。有图时上传区显示“更换参考图”。主图单张上传和其他入口多图上限沿用原逻辑。
- 修改作图 JS/CSS、入口缓存键 `20260911-universal-directions` 和本记录。四个生图入口都显示四个通用方向，旧杯子预览数量为 0。浏览器实测：商品示例图存在时方向可选；选中场景应用后上传参考图，四项均禁用且无选中强调；移除后恢复场景应用，再切换质感展示和生成两张演示结果均通过；套图上传参考图时仅禁用方向，内容结构仍可选。
- 桌面和 390×844 手机分别检查启用/禁用状态，手机页面宽度/滚动宽度均为 390，分区无重叠，结果图片仍为 200px。最终 1094×935 下两侧底部同为 915px，控制台 error 为空。截图及 `check-directions.cjs` 位于 `/tmp/yingdan-studio-directions/`；离线 VM 验证四方向选择、参考图优先、禁止切换、恢复之前选择、读取失败/超大文件保留、并发替换和生成期间锁定。既有 `/tmp/yingdan-studio-single-upload/check-upload.cjs` 回归通过；`node --check src/image-studio.js`、`git diff --check` 通过，未重复全量测试。


### 画面方向改下拉框、移除生图模型选择（2026-09-11，45f9 worktree）

- 用户反馈四张方向卡片占位过大，改为 42px 高的原生下拉框，四个方向选项与默认简洁展示沿用现状。`renderDirectionControl` 在同一行放置下拉框和“参考图”按钮；参考图及套图/详情图的内容结构继续在按钮下方展开，方向选择不再需要先展开面板。
- 下拉框通过独立的 `data-direction` / `change` 事件进入原 `chooseDirection`，避免通用字段绑定绕过参考图互斥保护。有风格参考图时原生禁用下拉框，并在行下提示原因；移除后恢复先前选项。方向卡片 HTML/CSS 和旧按钮事件已删除。
- 四个生图入口的更多设置移除“生图模型”，同时删除仅包含该字段的“高级设置”分组及 `advancedSettingsOpen` 状态。当前保留画面比例、生成版数、清晰度和选填商品信息；内部默认模型仍为 PTJ-1，批量修图/换装原有独立流程不属于此次修改范围。
- 浏览器实测四个生图入口都有四项下拉选择，模型控件和高级分组均为 0；主图选择场景应用、上传参考图禁用、移除后恢复场景应用、设置版数及生成两张演示结果均通过。生成期间下拉框锁定，完成后恢复。手机 390×844 可选择创意表达，下拉框高度 42px，页面宽度/滚动宽度均为 390，左右分区转为上下排列且无重叠。
- 截图位于 `/tmp/yingdan-studio-direction-select/`：`before.png`、`after.png`、`disabled.png`、`settings.png`、`mobile.png`。`node --check src/image-studio.js`、`git diff --check` 和既有 `check-directions.cjs` 互斥逻辑回归通过，未重复全量测试。缓存键更新为 `20260911-direction-select`。


### 直接上传参考图、图片参数小标与生成同款（2026-09-11，45f9 worktree）

- 按用户新标注，在四个生图入口恢复方向下拉框下的一句浅色说明。参考图取消折叠按钮，改为同一行 88px 的“＋参考图 / 点击或拖拽上传”方块；上传后显示缩略图、更换和移除入口，继续沿用单图校验及方向互斥。套图/详情图的内容结构改为独立的原位折叠项 `structureOpen`。
- 每张结果图片左上角新增比例小标，悬停、键盘聚焦或点击可展开生成信息，展示当时的比例、方向或参考图缩略图。`resultContext` 通过 `copyGenerationContext` 保存商品、文字、素材、方向与生成参数的独立快照；`pendingContext` 在任务开始时固定输入，异步生成、切换入口和后续编辑均不会改写历史。旧数据缺少的字段显示“未记录”。
- 结果卡片新增“生成同款”，打开紧凑数量弹窗后填写 1–10 的整数并点击“开始创建”。`repeatSource` 保存所点记录及图片索引；新任务沿用该记录的商品和比例，将所选结果图作为风格参考，记录 `sourceRecordId` / `sourceIndex`。数量始终按张计，套图不会乘以每版张数；保留原图、历史和当前左侧输入，生成期间防止重复提交。
- 本模块仍是纯浏览器演示：同款结果复用所选图片素材以验证操作流程，不调用模型、不上传文件、不扣费。默认 PTJ-1、主图单张商品、200px 图片预览、日期排序以及桌面两侧面板到底对齐沿用现状。修改作图 JS/CSS、入口缓存键 `20260911-repeat-image`，新增状态逻辑测试 `tests/image-studio.test.js`。
- 浏览器实测：直接上传参考图后禁用方向，移除后恢复场景应用；0 张被原生数量校验阻止，主图填写 3 后得到 3 张加原图，左侧 4:5 / 场景应用保持不变，结果信息仍来自原图 1:1。套图选择居家场景后创建 2 张，原 6 张仍保留；四个入口的新上传块和同款入口均可用。手机数量弹窗取消后焦点返回原按钮，信息浮层可点击开关，图片放大/关闭正常。
- 1375×935 桌面两面板底部同为 913px，图片宽 200px；390×844 手机页面与滚动宽度均 390px，参考图块宽 88px，输入区与结果区无重叠，数量弹窗宽约 359px。截图在 `/tmp/yingdan-studio-repeat/`，包括 `before.png`、`after.png`、`reference.png`、`dialog.png`、`results.png`、`desktop-1375.png`、`mobile.png`、`mobile-dialog.png`、`mobile-info.png`。
- 5 项新测试覆盖参数快照隔离、按张创建/源图保留/左侧输入不变、数量边界/重复提交、跨入口异步隔离及信息来源/转义/缺失参数。`npm test` 163/163 通过；既有方向互斥、单图上传和日期分组 VM 回归通过，`node --check src/image-studio.js` 与 `git diff --check` 通过。

- 同日文案微调：按用户“加个批量”的标注，卡片按钮、数量弹窗标题及无障碍标签统一为“批量生成同款”；数量和生成交互沿用现状。脚本缓存键更新为 `20260911-batch-repeat-label`。


### 主图精简设置与附带信息（2026-09-11，45f9 worktree）

- 按三处主图标注，仅主图移除“补充商品信息（选填）”整组，包括商品名称、卖点、目标客户及品牌 Logo，并移除输出清晰度控件。更多设置保留画面比例、生成版数及新建任务。主图新任务和批量同款均固定中等清晰度；新任务不带入已移除字段的旧值。其他入口沿用原设置。
- 主图下拉框增加第五项“附带信息”。选择后用紧凑弹窗引导填写图片上需要展示的文字，支持分行，校验非空且最多 500 字；确认后才切换方向，取消/关闭不改动原方向或原文字。选中后提供“编辑信息”入口，弹窗自动聚焦文本框，关闭后返回触发控件。
- `attachedInfo` 保存已确认文字，`attachedInfoDraft` 是弹窗独立草稿；`imageText` 是每次生成真正生效的文字快照。上传参考图仍禁用方向，已记住的附带文字暂停生效，移除后恢复；切换其他方向也不会混入文字。生成记录保存原文字，批量同款根据该记录复用，不读取左侧后改的文字。仍是现有本地图片演示，无真实模型调用。
- 桌面验收发现原参考图移除图标伸出缩略图后会碰到内层滚动条；将其移到缩略图内侧 4px，一次点击即可移除并恢复附带信息。四个参考图上传块共用该点击区域修复。
- 浏览器实测主图只剩比例、版数两个参数，五个方向可用；空白校验、首次填写取消、保存、编辑回显、编辑取消、参考图互斥与移除恢复、生成后方向记录均通过。套图保持四方向及原商品信息/清晰度设置。390×844 手机弹窗宽约 359px，页面和滚动宽度均 390px；主图输入与结果面板间隔 16px，无重叠，控制台 error 为空。
- 截图保存在 `/tmp/yingdan-studio-main-info/`：`before.png`、`settings.png`、`dialog.png`、`result.png`、`mobile.png`、`mobile-dialog.png` 和最终 `after.png`。新增 5 项状态测试检查确认/取消、空白/长度边界、历史文字及同款复用、参考图优先、主图固定清晰度与其他入口隔离；`npm test` 168/168 通过，日志为该目录 `tests.log`。`node --check src/image-studio.js`、`git diff --check` 通过。JS 缓存键为 `20260911-main-info`，CSS 为 `20260911-main-info-v2`。


### 主图参数直接展示、恢复 Logo（2026-09-11，45f9 worktree）

- 按用户纠正恢复主图 Logo；`renderMainLogoUpload` 在“商品图片”标题右侧提供紧凑的“添加 Logo”入口，支持点击/拖入单张图片、更换、缩略图预览和移除，沿用 PNG/JPG/WebP、单张 10 MB 校验。Logo 独立于风格参考图，不会禁用画面方向。
- 主图去掉“更多设置”标题、折叠按钮及分隔线，`studio-main-options` 始终直接显示比例、生成版数；保留原计数及新建任务。移除整个“主图小贴士”卡片及对应 CSS。桌面两侧面板仍延伸到底对齐，手机自然上下排列；其他入口保留原折叠设置。
- 主图任务不再清空 `context.logo`，生成方案加入品牌标识要求，历史快照及批量同款继续沿用所选原记录的 Logo。单张 Logo 读取成功后才原子替换，失败保留旧图；`logoUploadRevision` 与参考图计数独立，最后一次选择优先，移除会作废尚未完成的读取。
- 浏览器实测主图设置标题/分隔线/小贴士均已移除，比例与数量常显且可修改；Logo 上传、更换、移除、生成锁定和完成后保留均通过。选择 4:5、2 版后生成 2 张演示结果，Logo 不影响方向选择；套图继续保留更多设置及 Logo。390×844 页面/滚动宽度均为 390px，Logo 有图态约 122px 宽，上传和移除可用，输入与结果之间保留 16px 间距，无重叠；控制台 error 为空。
- 截图及测试日志在 `/tmp/yingdan-studio-logo-options/`：`before.png`、`after.png`、`uploaded.png`、`mobile.png`、`mobile-uploaded.png`、`tests.log`。更新主图参数测试的 Logo 预期，增加 Logo 历史/同款快照以及替换失败/并发/参考图隔离测试；`npm test` 170/170 通过，`node --check src/image-studio.js`、`git diff --check` 通过。作图 JS/CSS 缓存键均为 `20260911-main-logo-options`。


### 套图改为商品主副图工作台（2026-09-11，45f9 worktree）

- 套图入口仍是 `#/image-studio/set`，页内标题改为“商品主副图”，使用独立 `renderSetStudio`。用户无需先去主图入口生成，默认直接制作一整套。左侧只保留商品多角度图片、Logo、整套要求、画面方向/参考图、比例和生成套数；输出清晰度固定中、模型默认 PTJ-1。详情图和海报沿用原设置。
- `SET_ROLES` 定义通用用途，`setSlots` 保存图位 ID、用途和说明。默认 1 张商品全貌主图，5 张副图分别为核心卖点、细节展示、应用场景、其他角度、组合展示。右侧首先呈现“1 张主图＋5 张副图”和六张带用途标签的小图，`setContentOpen` 控制“调整套图内容”原位展开；`setNotesOpen` 保存逐图说明的展开状态。
- 主图固定保留；副图可更换用途、补充说明及增删，每套共 2–10 张。选项另含规格信息、包装展示。选择规格信息立即展开必填框，未提供参数时阻止生成并聚焦该框；其他说明选填，不要求用户逐张配置。生成张数按实际图位乘以套数计算，按钮实时显示“生成整套 · N 张”。
- 同一商品支持最多 10 张素材，第一张标为主体图，点击其他素材可切换主体图。Logo 使用主图同款紧凑入口。只有风格参考图禁用画面方向，商品素材和 Logo 不影响方向；上传、更换和移除沿用现有本地校验。
- `copyGenerationContext` 深拷贝图位列表和素材，`buildSetPlans` 按图位和套号生成本地方案。结果保留套号、用途、图位和逐图说明；按日期与任务展示，多套分别标记。每张可调整、重做，同一组原位更新，避免改单张产生重复整套。`repeatSet` 沿用历史安排和素材，以该记录第一张结果作风格参考，再生成一套，保留原记录和左侧未提交输入。新建空任务的临时示例通过 `setGalleryRecords` 统一渲染及预览，不写入历史。
- 套图沿用主图的暖灰底、白色面板和桌面到底对齐，作用域为 `studio-set-page`；主图单图上传与既有交互保留。1375×935 下两侧底部均为 913px，六张示例可完整展示；1094px 窗口为两列图片。390×844 下自然上下排列，编辑区无横向溢出，两侧面板间隔 16px。
- 浏览器验收：默认直接生成、6 图×2 套共 12 图、多素材上传与主体切换、Logo/风格图互斥、规格空白校验及填写保留、副图增删、单张调整/重做、再生成一套、下载原型反馈和历史查看均通过。主图仍单选商品、5 个方向、无更多设置和小贴士；详情图/海报保持 8/1 张示例。控制台 error 为空，最终恢复套图干净示例和浏览器原尺寸。
- 7 项新增状态测试覆盖套数计数、图位边界、规格输入/转义、快照与跨入口隔离、历史整套重生成、单张重做以及调整不复制整组；更新原测试以详情图验证保留的清晰度选项。`npm test` 177/177 通过，`node --check src/image-studio.js`、`git diff --check` 通过。截图和测试日志位于 `/tmp/yingdan-studio-product-set/`，包含 `before.png`、`after.png`、`desktop-1375.png`、`editor.png`、`mobile-editor.png`、`main-mobile.png`、`results.png`、`tests.log`。JS/CSS 缓存键为 `20260911-product-set`。
- 本次只落交互原型：生成、重做仍复用本地杯子素材，下载显示原型反馈，无真实模型请求、上传或扣费。


### 套图单图输入、每次一套与左侧内容安排（2026-09-12，45f9 worktree）

- 按用户确认的 ASCII 布局，套图与主图共用 `renderMainComposer` 单张商品输入：图片可更换、移除、粘贴或拖入，保留标题旁的 Logo。`addFiles` 对两个入口均使用单图原子替换与 `productUploadRevision`；多文件只取第一张，读取失败和超大文件保留旧图，并发最后一次选择优先。删除原套图多角度上传区、主体图切换事件和对应 CSS，详情图仍允许多图。
- 套图文字改为“整套统一要求”，浅色提示为“作用于整套图片，各张内容按所选用途生成。” `prompt` 在任务开始时冻结，`buildSetPlans` 给每张方案带入同一份统一要求，再叠加对应图位的用途和 `brief`。其他图位的说明不会串入本图；生成后的历史统一要求不随左侧修改变化。原型仍复用本地示例素材，未接入真实生图。
- `renderSetOptions` 将“套图内容 / 1 张主图＋N 张副图”移到左侧画面方向下方，默认收起，点击整行原位展开并推下比例和生成按钮。副图用途、说明、增删、规格必填与已有边界沿用原逻辑。右侧移除内容安排和重复标题，只保留整套示例/生成结果及日期、图片操作。
- 移除生成套数与重复计数提示，画面比例保留为单列。`count` 直接返回图位数，`buildSetPlans` 每次只生成一套；开始任务和“再生成一套”均固定 `quantity=1`、商品参考取第一张，旧会话的数量值不会放大输出。主图数量设置保持原样。
- 浏览器验收通过：单选文件框、连续更换始终 1/1、左侧唯一内容编辑区、展开收起、增删副图、规格空白提示与焦点、说明保留、4:5 生成一套共 6 张、生成时输入锁定。390×844 下展开区无横向溢出，页面宽度和滚动宽度均 390px，两面板间隔 16px；主图仍为“想怎么拍”、有数量控件且单图，详情图仍多图。预览服务停止后已恢复本 worktree 的 8901 本地服务，日志在 `/tmp/yingdan-studio-set-simple/server.log`。
- 增补套图单图替换/失败/并发测试，更新固定一套预期，并验证所有逐图方案包含冻结的统一要求、各图说明互不混入。`npm test` 178/178 通过，`node --check src/image-studio.js`、`git diff --check` 通过。截图和日志位于 `/tmp/yingdan-studio-set-simple/`：`before.png`、`after.png`、`results.png`、`mobile-expanded.png`、`tests.log`。资源缓存键为 `20260912-set-simple`。

### 套图合并画面方向与内容（2026-09-12，45f9 worktree）

- 用户要求两个设置合并。`renderSetOptions` 改为唯一的“画面与内容”入口，继续由 `setContentOpen` 控制；摘要显示当前方向或“使用参考图”，以及 1 张主图＋N 张副图。展开后先呈现方向下拉框和参考图，再呈现固定主图与可编辑副图用途。移除原先独立的方向行，比例与生成按钮仍在合并区下方。
- 摘要与展开内容共用连续边框；参考图局部缩为 78px，给窄屏下拉框留出空间。方向说明、参考图互斥、增删图位、规格必填、生成锁定及主图页面的原方向入口沿用现有逻辑。
- 浏览器验收：展开/收起、方向和张数摘要同步、上传参考图后禁用方向、移除后恢复之前选择、规格缺失时自动展开并聚焦说明均通过。390×844 页面与滚动宽度均为 390px，合并区与方向行无横向溢出，已恢复桌面尺寸和六张默认示例；控制台 error 为空。
- `node --test tests/image-studio.test.js` 20/20 通过，`node --check src/image-studio.js`、`git diff --check` 通过。截图位于 `/tmp/yingdan-studio-set-merged/`：`collapsed.png`、`mobile-expanded.png`、`after.png`。JS/CSS 缓存键为 `20260912-set-merged`。本次仅调整本地原型布局，未调用真实生图。

### 套图方向与副图并排常显、参考图外置（2026-09-12，45f9 worktree）

- 按用户最新调整，取消“画面与内容”的展开/收起入口与 `setContentOpen` 状态。`renderSetContentEditor` 使用两列网格，画面方向和副图用途按同样的字段尺寸直接并排选择；单张说明仍按需显示，规格说明必填。保留主副图数量、增加/移除副图以及固定一张主图的限制。
- 将共用方向行拆成 `renderDirectionSelect` 和 `renderReferenceTile`；套图参考图置于选择区外，和比例控件并排，常显点击/拖拽上传。其他入口继续由 `renderDirectionControl` 组合两个控件，原布局不变。
- 浏览器检查：参考图上传后仅禁用方向，副图选择仍可用；移除后恢复此前方向；缺少规格时定位说明输入。390×844 下页面宽度/滚动宽度均为 390px，所有并排字段无横向溢出。主图方向、参考图与单张布局正常，已恢复桌面套图示例，控制台 error 为空。
- 更新既有规格测试中已移除的折叠状态断言，20 项作图测试全部通过；`node --check src/image-studio.js`、`git diff --check` 通过。截图在 `/tmp/yingdan-studio-set-inline-choices/`，入口缓存键为 `20260912-set-inline-choices`。

### 套图恢复单一下拉入口（2026-09-12，45f9 worktree）

- 用户纠正上一轮“全部平铺”的理解：外层应保持一个下拉框，打开后在同一面板内并排选择方向及副图。恢复 `setContentOpen` 与单一 `set-content` 事件；外层摘要显示当前方向或“使用参考图”以及主副图数量。参考图从比例行移至下拉入口旁，始终可点击/拖拽上传，位于可折叠面板之外。
- 保留内层两列方向/副图布局、说明、增删、规格必填及生成锁定。规格缺失会打开面板并定位输入；恢复对应测试的展开状态断言。
- 浏览器检查展开/收起、方向与数量摘要、收起时上传参考图、参考图仅禁用方向且副图仍可选均通过。390×844 页面与滚动宽度均 390px，下拉面板宽度与滚动宽度均 266px，无横向溢出；已恢复桌面和默认六图收起状态。作图测试 20/20、语法检查与 diff 空白检查通过。截图目录 `/tmp/yingdan-studio-set-dropdown/`，资源缓存键 `20260912-set-dropdown`。

### 详情图复用整套工作台（2026-09-12，45f9 worktree）

- `#/image-studio/listing` 按用户要求复用套图最终交互：单张商品输入、标题旁 Logo、整套统一要求、单一“画面与内容”下拉框、外置参考图拖拽块、比例与生成整套按钮。移除详情图原有独立内容模板、更多设置、数量与清晰度控件，默认 PTJ-1、固定中等清晰度，每次一套。桌面沿用两侧到底对齐的面板，结果仍按日期排列小图。
- `isSuiteMode` 将套图与详情图接到同一渲染、图位编辑、生成和结果操作流程。新增 `LISTING_ROLES`，默认八张依次为产品介绍、结构与细节、核心卖点、应用场景、规格选择、工艺与定制、品质保障、包装与合作。详情图每张均可调整或移除，最少 1 张、最多 10 张；套图仍固定一张主图。`setSlots`、`setContentOpen`、`setNotesOpen` 保存在各入口独立会话中。
- 详情图规格页需要实际参数，缺失时打开下拉面板并定位输入；用户可换为其他内容。`buildSetPlans` 根据冻结输入的类型解析用途，每张带入相同的整套要求及 Logo/方向或参考图，再叠加本张说明；不以演示素材推断参数或认证、合作承诺。上传沿用单图原子替换，海报仍允许多图。
- 结果以“详情 1…N”及对应内容标注，提供下载演示、再生成一套、逐张调整和重做。重生成沿用历史配置，调整/重做只更新该图位；记录模式不匹配时拒绝重生成和重做。新任务示例 ID 按入口生成，避免共用主副图 ID。当前仍为本地素材演示，无真实模型调用或文件上传。
- 浏览器检查：八张默认内容、规格空白提示与填入、增加/移除图位、下拉框内并排选择、收起时上传参考图、方向禁用但内容可选、4:5 生成八张及输入锁定/解锁、结果参数小标均通过。切换套图仍是六张且无详情历史，主图仍单图；详情记录返回后仍存在。390×844 页面/滚动宽度均 390px，展开面板宽度/滚动宽度均 266px；控制台 error 为空。已恢复桌面和详情图默认示例。
- 增加详情图四项测试覆盖图位边界、规格校验、统一要求与逐图说明冻结、跨入口隔离、历史重生成/单图更新、单图上传失败及并发；原多图及可选清晰度回归移至海报。`npm test` 182/182 通过，语法与 diff 检查通过。截图和 `tests.log` 位于 `/tmp/yingdan-studio-listing-workspace/`，缓存键 `20260912-listing-workspace`。

### 整套下载与示例单图调整入口（2026-09-12，45f9 worktree）

- 用户指出套图应能一键整套下载、单张也应可修改。此前 `renderSetRecord` 只给生成结果显示操作，默认示例没有入口。现在每套上方常显橙色“下载整套 / N 张”，示例和结果的每张下方都有与主图相同的“调整 / 下载”；生成结果保留“再生成一套”和“重做这张”。详情图共用同一调整。
- `downloadRecord(record,index)` 明确作用于所点记录，单张操作传入该图索引；左侧改变图位数量不会改掉旧记录的下载张数。遵守项目的原型边界，目前只显示相应张数的下载演示反馈并记录开发日志，不打包、不触发真实文件下载。
- 单张调整复用主图弹层，输入要求后只更新当前图的备注，图片仍是本地示例。`refreshSetExample` 按稳定图位 ID 与用途保留调整记录，修改其他图位不会清空已调整的图片；当前图换用途时才清掉不再适用的备注。
- 浏览器检查：套图默认 1 个整套下载按钮、6 个调整和 6 个单张下载按钮；整套点击反馈 6 张，详情图反馈 8 张且 8 张均可调整。仅第二张输入调整后，其余 5 张与总张数保持不变。390×844 页面与滚动宽度均 390px，下载按钮及单图操作无溢出；已恢复桌面套图默认示例。
- 新增 3 项测试覆盖入口可见、记录下载范围、示例调整隔离及保留；作图测试 27/27 通过，语法与 diff 检查通过。截图和 `tests.log` 在 `/tmp/yingdan-studio-suite-actions/`，缓存键 `20260912-suite-actions`。

### 套图左右副图编号对应（2026-09-12，45f9 worktree）

- 右侧套图卡片由“副图”改为“副图 1…N”，与下拉框的逐张用途一一对应，主图仍单独标注。示例、生成方案标题与预览名称共用 `suiteImageLabel`；历史多套记录按每套内部位置重新编号。
- 浏览器核对默认副图 1–5 与用途对应；移除副图 3 后两侧均连续重排为 1–4。手机 390×844 无横向溢出，带编号的图片预览正常。作图测试 27/27、语法及 diff 检查通过；缓存键 `20260912-suite-numbers`。

## Dify 在用应用同步约定（2026-09-09）

用户确认当前在用两项：`f68ca6a0-5b51-47ef-8d29-effb5b974ad0`（不需要知识库的总库）与 `c50fba61-a7e8-4175-b25b-2e46c8dad5b1`（全技能总控）。后续“更新工作流/拉最新 DSL/这两个工作流”默认指这两项，用户说的 dify workflow 目录沿用 `dify-chatflows/`。具体链接、文件映射和同步记录见 `dify-chatflows/README.md` 的“当前在用工作流与同步约定”。本次已从 Dify 页面导出当前已保存版本并验证落盘，未发布或试跑。

2026-09-09 用户在生产画布修改并确认发布后，已重新导出当前保存版本覆盖本地 DSL（32 节点、39 连线）。标题条件为 title-combo OR title-sellpoint；标题分支实际保留模型选择，DeepSeek 关闭思考、Gemini 为 Low；其他功能 DeepSeek 为开启思考且 low。以本次线上导出为准，之前固定 DeepSeek 的本地方案已被替换。详情见 dify-chatflows/README.md。未单独比对发布版本、未试跑或实测耗时。

## 2026-09-11：AI作图与 ALI运营顾问原型

本次参考任务「盘点项目中的 Dify Flow」（01a08a73-d2c3-7420-b3c1-98c9a64e03dc）对应 `/Users/garden/YD/批图匠`。读取当前代码并打开参考页面后，在赢单现有原生 HTML/CSS/JavaScript 原型内新增两个一级业务入口，没有引入前后端服务或接通真实图片模型。

- `#/image-studio`（兼容 `#/image-studio/generate`）：批量生图。`#/image-studio/retouch`：批量AI修图。`#/image-studio/outfit`：批量模特换装。三个入口在侧栏「AI作图」分组下，窄屏另有作图页内导航。
- 作图实现位于 `src/image-studio.js`、`src/image-studio.css`，本地图片在 `assets/image-studio/`；从批图匠参考资产复制，模板含高信息量套图、极简套图、B2B详情图。`window.YD_IMAGE_STUDIO.mount` 由 `src/app.js` 调用。支持主图/套图/详情图/海报、模板抽屉、本地素材与Logo、逐张方案、单张修改、确认后模拟生成、大图切换及当前会话历史。
- 作图状态按入口保留在模块内存中：`phase` 为 `empty/results/planning/review/generating`，`plans` 保存逐张方案，`results` 保存本地示例图片，`history` 保存本次页面会话完成的任务；刷新后重置。生成前确认方案时锁定表单，避免设置与已确认方案不一致。跨入口的异步任务使用其开始时的模式，不串写其它入口。
- 图片通过 FileReader 读入当前浏览器，PNG/JPEG/WebP 每张不超过 10 MB；不上传文件，不调用模型，不扣费。结果标记为「演示结果」，导出仅给出原型反馈。清晰度、模型等参数用于演示选择过程，不代表实际处理后的图片属性。
- `#/operations-advisor`：在赢单导航内以 iframe 承载 `prototypes/operations-advisor/index.html`，也可独立打开该文档。来源是 `/Users/garden/YD/l-sou/来搜运营顾问plugin-panel-分享版(1).html`，交互含义参照同目录《来搜ALI运营顾问-业务与交互说明.md》。仅提取运营顾问八个模块，移除原插件其他业务页签、推广、品牌与账号外壳。
- 运营顾问原始样式表和八模块 HTML 均保留；允许差异为初始激活状态、两处跨业务入口改为赢单既有背调/询盘分析路由、宿主布局及小屏抽屉位置。初次移植保留静态分析和模拟追问；本 worktree 后续已按用户授权接入首次诊断 Workflow，当前真实调用与待修复项见下方“运营顾问首次诊断接入”。`paDone_` 状态加 `yd-operations:` 前缀隔离本地存储；用户聊天输入改为 `textContent` 防止 HTML 注入，内置报告排版不变。
- 子页面通过 `yd-operations-navigate` 消息传递固定业务标识，宿主验证发送 iframe、同源和功能白名单后跳转。不会传递客户数据或执行询盘发送。
- 路由与宿主在 `src/app.js`，导航在 `src/data.js`，样式和脚本在 `index.html` 引用。浏览器控制台的 `[yingdan-image-studio]` / `[yingdan-operations]` 日志记录加载、方案就绪、演示完成和图片读取异常，不记录用户素材内容。

### 本次视觉与交互验证

使用 Product Design 的参考复刻与设计核验流程。遵循项目“不主动创建额外文档”约定，把核验记录放在本节；截图留在已忽略的 `outputs/product-design-20260911/`，不作为主工程提交。

- 本地预览：`python3 -m http.server 8891 --bind 127.0.0.1 --directory /Users/garden/YD/Prototype`。桌面视口 1280×900，小屏 390×844。最终按 DPR 2 统一采集，桌面整屏 2560×1800；运营模块内容为 356×510.78125 CSS px，截图为 712×1020 px。
- 来源截图：`studio-reference-desktop-final.png`、`operations-home-reference-2x.png`。实现截图：`studio-implementation-desktop-final.png`、`operations-home-implementation-2x-final.png`。并排比较证据：`studio-final-comparison.png`、`operations-final-comparison.png`。作图示例作品用于比对，参考页“正在生成4/6”为既有模拟状态；赢单明确显示示例作品。
- 字体、字重和文字层级：运营顾问复用原值；作图沿用赢单字体并保留参考界面的表单/结果层级。布局与间距：运营八宫格内部尺寸一致；作图保留左右工作区，外部导航适配赢单。颜色：运营原样式完全相同，作图使用相近橙色与米白底。资产：复用真实参考素材，未生成替代占位图，已检查已展示图片无加载失败。文案：运营模块原文一致，作图说明按原型范围调整。
- 发现并修复的 P2：手机窄导航栏中的品牌文字截断及“新增客户”挤出；隐藏该文字、保留品牌图标，并提供手机作图导航。修复后 `studio-mobile-final.png` 已重新采集，DOM 宽度 390、页面滚动宽度 390。运营手机报告证据为 `operations-mobile-report.png`，关闭、下载、追问入口可见。
- 浏览器实测：运营八模块进入/返回；看板日/周/月花费切换；新店方案报告与追问；营销定位周/月清单切换、勾选并恢复；广告诊断报告与下载按钮状态。作图模板切换、本地文件导入、三个作图入口、逐张方案、单张修改、确认生成、预览翻页、历史查看与图片数量计算均已检查；详情图10版共80张，主图/海报每版1张。用户输入 `<b>测试文本</b>` 只作为文字显示，未产生 HTML 子节点。
- `node --check src/app.js`、`node --check src/image-studio.js`、提取的运营脚本语法检查和 `git diff --check` 通过。`npm test` 为 158/158，通过；作图与独立运营页面未见 error 级控制台错误。赢单内嵌运营页的八个入口与报告已实测；该内嵌页有一条 Codex 浏览器自身 `browser-page-preload.js` 的 MutationObserver 异常，经调试栈和脚本来源核验，与项目脚本无关，未阻断模块操作。没有真实接口或发布验收。
- final result: passed。作图为参考适配，运营内部视觉保真；剩余的固定报告、模拟下载和不可点击“下一步”属于来源原型既有行为。

### 首次诊断 Workflow 凭据与独立 API 测试（2026-09-11）

- 用户授权保存并测试首次诊断 Workflow。凭据保存在本机 macOS 钥匙串，service 为 `com.yingdan.prototype.operations-advisor.workflow`，account 为 `first-diagnosis`；读取时只捕获到调用进程内存，不在终端打印。仓库、浏览器和测试记录均不包含明文 Key。当前没有写入 Vercel/Upstash；本 worktree 后续已接入原型页面，见下方“运营顾问首次诊断接入”。
- 通过 `https://api.dify.ai/v1/info` 与 `/parameters` 实测确认应用名为 `来搜运营顾问｜workflow首次诊断`、mode 为 `workflow`，四个必填输入是 `module`、`function_name`、`report_id`、`business_context`。本机 Python urllib 默认请求收到 HTTP 403 / 1010，改用 curl 后两个接口均返回 HTTP 200；不能把前者判断为 Key 无效。
- 虚构商品诊断测试 run `563bbf3c-d3a1-40b3-a15b-26f29a5094bb`：输入校验、查询改写、知识检索节点、数据分析与优化顾问及汇合节点完成，但 `validate_report` 返回 `Unknown error`，随后 `generation_error` 失败，错误为 `ERROR:root:diagnosis_generation failed after retry`。Workflow 最终为 `failed`、outputs 为空，耗时约 54 秒；未得到可交给 Chatflow 的报告。已读取本地失败处理代码中的 `logging.error`，但当前证据不足以确认线上校验节点的根因。安全记录：`output/operations-advisor/workflow-test-codex-synthetic-752a5bc9ebf1.json`。
- 无效功能入口测试 run `49eede6b-eced-4655-9f86-c9485f488d9d`：正确进入输入错误分支，返回 `invalid_status=invalid_input`、`invalid_report`、`invalid_chat_inputs`、`invalid_error`，Token 用量为 0，确认该分支的重命名已在线生效；正常、修复和生成失败输出分支仍未通过返回值验收。安全记录：`output/operations-advisor/workflow-test-codex-invalid-1834a2488d65.json`。

### 运营顾问分析抽屉裁切修复（2026-09-11）

- 用户标注的问题在本 worktree 中已复现：关闭的抽屉仍可见。`translateX(-100%)` 只减去抽屉自身宽度，居中或贴边定位后仍会残留在 iframe 内；旧的 1100px 媒体查询也未覆盖所有左侧空间不足的宽度。
- 只修改 `prototypes/operations-advisor/index.html`：关闭状态加入 `visibility:hidden` 与 `pointer-events:none`；打开后恢复可见和交互。`positionAiDrawer()` 按 iframe 的实际可见尺寸判断贴左侧或居中，并限制上下位置；正文增加 `min-height:0` 以独立滚动，保留标题和底部操作区。
- 独立预览使用 `python3 -m http.server 8895 --bind 127.0.0.1 --directory /Users/garden/.codex/worktrees/33b5/Prototype`，入口为 `http://127.0.0.1:8895/#/operations-advisor`。8891 仍指向主目录 `/Users/garden/YD/Prototype`，本轮未修改其文件或重启其服务。内置浏览器已切至 8895；普通刷新曾保留旧 iframe 缓存，强制刷新后确认新样式生效。
- 视觉验证以同一 worktree 修复前后的 1094×934 首页为对比，截图均为 1 倍像素密度，已放在同一比较输入中检查。标题字体、字号、颜色、图标和业务文案保持一致，预期差异只有关闭抽屉消失；打开状态保留原报告排版，空间不足时改为居中。整个弹窗在截图中清晰可见，无需额外裁剪。
- 当前浏览器实测通过：1094×934、1400×900、1728×934、390×844 下打开完整弹窗；390×600 下输入虚构追问、得到原有模拟回复、滚动正文及点击右上角关闭，关闭后无残留；最终恢复默认视口并保留打开的报告供用户检查。内联脚本 `node --check` 和 `git diff --check` 通过；控制台保留了一条修改前已经出现的 `MutationObserver.observe` 异常，未通过产品代码隐藏该异常。
- 证据目录：`output/operations-advisor/drawer-fix/`。`before-1094.jpg` 与 `after-home-1094.jpg` 为同状态对比，`open-1094.jpg`、`open-1400.jpg`、`open-1728.jpg`、`open-390.jpg` 为打开状态，`chat-390x600.jpg` 与 `closed-390x600.jpg` 为矮屏交互证据。final result: passed。

### 用户纠正：两个面板互不覆盖（2026-09-11，当前布局规则）

- 用户明确要求运营面板和 AI 顾问都完整显示，不接受首轮修复中的居中覆盖方案。此节替代上一节的浮层定位规则。
- `prototypes/operations-advisor/index.html` 已移除 AI 遮罩和固定定位。打开时给 `body` 添加 `ai-open`，两个面板在正常 Flex 布局中整体居中，AI 在左、运营入口在右，间距 16px；运营面板保留 380px 宽度，AI 面板最多 430px 并使用剩余宽度。iframe 宽度不超过 760px 时改为上下排列，通过页面滚动查看，两个面板不会重叠。
- 关闭时 AI 面板 `display:none`，移除 `ai-open`，运营面板恢复原先居中布局。`positionAiDrawer()` 现在只同步高度，不再设置坐标；正文保留独立滚动和固定在面板底部的操作区。右侧运营入口可以在报告打开时继续点击，切换左侧报告；后续首次诊断接入替换了固定报告、模拟追问和模拟下载，布局规则不变。
- 当前验收：1094×934、1400×900、1020×768、390×844 四种视口的实时 DOM 矩形均确认无重叠、无横向溢出；1094 视口中 iframe 宽 834px，AI 面板宽 398px，运营面板宽 380px，均完整处于边界内。实测从右侧切换到「核心品跟进」、窄屏滚动到报告底部和关闭后恢复均通过；最终恢复默认视口并打开并排报告。内联脚本语法检查、`git diff --check` 通过。
- 证据目录：`output/operations-advisor/paired-layout/`。`before-overlay-1094.jpg` 与 `after-paired-1094.jpg` 是相同视口和报告的对比，字体、字号、原报告内容和配色延续，预期变化是取消遮罩、并排占位和 AI 面板四角圆角。`geometry.json` 保存四种尺寸的边界检查；`paired-*.jpg`、`mobile-report-bottom.jpg` 保存当前界面。final result: passed。


### 运营顾问首次诊断接入（2026-09-11，当前运行事实）

- 用户要求“把 Workflow 接进来”。沿用原生 HTML/JavaScript 前端与现有 Node.js API；当前业务资料明确标记为原型演示数据，仅读取本 iframe 的当前运营模块，不读取宿主账号或浏览器存储。未接真实店铺采集，目录名称不作为已获取的报表明细。
- 本 worktree 启动命令为 `npm run dev:operations`，预览 `http://127.0.0.1:8895/#/operations-advisor`。`operations-dev-server.cjs` 替代本 worktree 原来的 Python 静态服务，提供静态页面与 `/api/operations-diagnosis`；其它工作区的 8891、8893 服务未修改。仅绑定 127.0.0.1，校验 Host/Origin，静态白名单不公开 .env、API 源码、日志、仓库内部目录及根目录外链接。
- Key 启动时由上述 macOS 钥匙串读取到服务端内存；也支持服务端环境变量 `DIFY_OPERATIONS_WORKFLOW_API_KEY`。`GET /api/operations-diagnosis` 仅返回 configured 和 data_source。没有在 HTML、JS、localStorage 或测试样例写入真实凭据；安全运维日志为 `output/operations-advisor/local-server.log`。
- `api/operations-diagnosis.js` 处理同源 JSON POST 和 SSE，`lib/operations-workflow.js` 调用 Dify `/v1/workflows/run`。`lib/operations-entry-map.json`、`lib/operations-report-schema.json` 同步 l-sou 已有入口和报告契约；原型 SOP 别名在 `resolveEntry` 映射到 8 板块的 32 个规范入口。后续部署需要显式配置 `OPERATIONS_ALLOWED_ORIGINS`，本次没有部署或写远端配置。
- 支持正常 `status/report/chat_inputs/error`、`repaired_*`、`invalid_*`、`failed_*` 四类互斥输出。只有成功状态、报告结构/身份、行动证据引用、追问上下文均一致时才向页面交付报告；失败不回退静态内容。Dify 的原始模型片段、内部思考、节点输入输出不转发至浏览器。读取超时上限 240 秒，关闭或切换功能时取消请求，并尽力停止上游任务。
- `prototypes/operations-advisor/workflow-client.js` 提交演示资料并消费 progress/done/error；报告通过安全 DOM 显示，表格支持局部横向滚动，成功后可下载 Markdown 文件。去掉原静态 AI_ANALYSIS 和关键词回复；未提供 Chatflow Key，追问输入/发送保持禁用。下载不再自动把 SOP 标成已执行。AI 与运营面板继续并排，窄屏上下排列；返回模块首页会关闭/取消诊断。
- 浏览器真实调用：应用 `来搜运营顾问｜workflow首次诊断`，App ID `b7303dd0-9852-412d-a3b0-db05422f9e83`，北京时间 2026-09-11 12:03:58–12:04:21，请求“优爆品提升”。run `bac54bd1-eb39-4221-ab1b-1b26ce9bd79d`，Dify 耗时 21.61 秒、12798 tokens、11 步；模型 `advisor_6` 与 merge 成功，`validate_report` 异常，`generation_error` 失败，未产生成功报告。
- 复用当前 Chrome 登录态做只读 Console GET 精确核验上述 run 与 node-executions：读取 1 个 run 和全部 11 个节点，无会话/列表分页，无截断；不做用户维度查询，候选会话数不适用。原始 error 在浏览器内分类，未输出/保存鉴权或客户内容。`validate_report` 具体错误分类为 `list_used_as_dictionary_items`；之前 SSE 仅显示 Unknown error。官方 Dify 1.12.0 的 CodeNode 输出检查方法也可复现：对象中的二维 rows 被当作字典递归处理并调用 items。该版本是复现参考，不代表已确认当前 Cloud 版本。
- 待用户在 Dify 手工替换的代码已准备于 `output/operations-advisor/workflow-integration/`：`dify-code-validate-report.py` 同时用于 `validate_report`（校验报告结构、证据引用与交接容量）和 `validate_repaired`（修复后的校验节点）；只在传输副本将 rows 编码为 JSON 文本，原始 diagnosis_context 保留二维数组；本站在边界恢复表格并重新校验。`dify-code-generation-error.py` 用于 `generation_error`，移除会写入 stderr 的 logging.error；校验代码同样移除 warning/error 级日志，业务失败通过结构化返回值表达。输入/输出变量名和输出类型配置均无需改动，保留用户已做的输出节点重命名。没有改动/发布 Dify 线上流程，也没有改 l-sou 原文件。
- 验证：`npm test` 共 165 项通过，含新增 7 项运营接入检查（真实 HTTP 往返用注入响应，不发付费请求）。本地使用官方纯输出检查方法复现原问题，替换代码通过，JSON 非法/失败路径返回结构化结果且 stderr 为空；这是离线验证，不等于线上修复已生效。
- 浏览器验收：真实失败提示和重试按钮可见，下载禁用；隔离 8896 测试服务使用明确标记“接入测试样例 · 非 Dify 生成”的结果核验成功报告、二维表格、右侧切换、HTML 字符转义及下载。两次实际 Markdown 文件已在本机 Downloads 验证包含演示标记与表格；工具的 download 事件等待未捕获，但文件实际落盘。隔离服务/测试标签页验收后关闭。1094×934 下 iframe 宽 834px，两个面板完整并排；390×844 下 iframe 宽 326px，上下排列且无横向溢出；临时视口覆盖已撤销。证据目录同上，`live-node-diagnosis.json`、`live-error-category.json`、`code-fix-offline-check.json`、`download-check.json`、`mobile-geometry.json` 和截图区分真实结果与测试样例。
- 接入首轮状态：本地页面与代理接入完成，线上曾等待三个代码节点替换和发布；后续真实成功验收见下一节。此前 165 项自动检查及成功样例截图仅代表本地验证。


### 用户发布修复后的真实成功验收（2026-09-11）

- 用户确认已替换代码并发布。2026-09-11 北京时间 13:26:56 从现有页面点击“重新生成”，使用相同“优爆品提升”演示资料；13:27:30 页面收到真实报告，本地代理完成结构、身份、表格与追问上下文一致性校验。
- Service API GET 再次确认 run `01e6f974-f5be-4dd7-9848-2cd714c3d76e` 为 `succeeded`，正常分支 `status=ok`，workflow_id `85d7a7ef-a98d-4f77-b366-ab4081cc5a5f`，耗时 31.33 秒、12 步、13699 tokens。report_id 为 `yd-operations-8f6a687c-e713-4bce-aa26-7dd39e38a4ea`；rows 在 Dify 输出中为字符串，在本站还原为 4 行 × 9 列，并确认原始追问上下文中的二维表格完全一致。此次已不再出现先前的代码节点输出异常。
- 浏览器真实显示诊断正文、资料缺口、要点/行动/依据和表格，下载按钮启用。两个面板保持完整并排；报告仍正确标记演示资料，`data_status=insufficient` 表示缺少真实商品数据，不表示执行失败。当前只验收“优爆品提升”正常分支，未遍历全部 32 入口/修复分支；Chatflow 多轮追问仍未接入。
- 原本地服务随前一执行会话退出而停止；本次已在当前 worktree 用 detached Node 子进程重启（只监听 127.0.0.1:8895，钥匙串凭据仍仅在内存），不改其它端口服务。常规人工启动仍用 `npm run dev:operations`。
- 本次证据：`output/operations-advisor/workflow-integration/published-fix-live-success.json` 记录脱敏运行状态与表格统计，`published-fix-live-success.jpg` 是真实报告界面。没有再修改或发布线上流程，没有把测试样例充当此次结果。

### 结构化报告恢复原 HTML 版式（2026-09-11）

- 用户指出前次成功页的展示与原稿不一致。前次只证明 Workflow 能执行成功：`workflow-client.js` 错将 `content_markdown` 作为主界面，并添加结论卡、资料缺口、行动与依据折叠区。当前全部移除，严格恢复原 `ai-name → ai-sub → ai-point(.pt-dot/.pt-text) → ai-table-wrap > table.report-table` 顺序；表头沿用 `tr.report-th > td`，字号、虚线、颜色和间距沿用原 HTML。模型文本通过 `textContent` 填充；要点的短标题冒号前缀可用原 `.em` 样式强调，不解析任意 HTML 或 Markdown。
- `lib/operations-report-templates.json` 从原文件最后实际生效的 `AI_ANALYSIS` 提取 28 个 AI 报告入口的表头、要点容量和表格摘要行数，不复制样例经营数字。`lib/operations-workflow.js` 在既有 `business_context` 内附加摘要展示要求（不改 Dify 输入变量），并校验返回表头、列数、要点数量、字数及行数。比如优爆品提升固定为“分层 / 数量 / 策略”，不接受先前九列表格。数据看板的日/周/月界面继续使用原独立交互，没有替换成 AI 报告。
- `name/sub/points/rows` 用于原有报告窗口；`conclusion/content_markdown/evidence/actions/missing_data/follow_up_questions` 保留在完整报告和下载文件内。下载增加原有摘要表格、行动与依据，按钮文案恢复“下载分析报表”。保持“演示数据”标识；未知数据写未提供，不能填回原稿样例数字。追问尚未接入，输入/发送继续禁用。
- 原已验收的并排布局不变：1094px 宿主下两个面板完整显示；390px 宿主下 iframe 326px，两个面板均为 302px 宽，x=12，运营面板 y=12，报告面板 y=555.5，页面无横向溢出。报告正文单独滚动，标题和底部按钮保留。
- 真实验收：从当前页面点击优爆品提升，run `095786dc-ca0b-460b-ab41-9128d961a8b4` 返回 `succeeded`、正常分支 `ok`，耗时 39.19 秒、12 步。输出为 5 条短要点、4 行 × 3 列表格；副标题 37 字，要点分别为 27/36/29/30/32 字。结构校验、原稿表头校验和 Chatflow 交接一致性检查通过。此次未修改或发布线上 Dify 流程，只做一次真实生成；其余入口仅校验配置来源，未逐项调用收费模型。
- 下载验收：文件实际落入本机 Downloads，包含原表头、所有要点、表格、完整分析与依据。自动检查 `npm test` 为 166 项通过，新增回归覆盖错误表头、自由扩列、过长字段和空摘要的拒绝；28 份模板的表头均逐字匹配原 HTML。
- 设计对照记录（按项目规则写入本文件，不另建 QA 文档）：源文件为 `/Users/garden/YD/l-sou/来搜运营顾问plugin-panel-分享版(1).html`；同一份真实演示报告分别交给原文件渲染器和当前客户端。原文件只在临时浏览器页内替换测试数据、统一时间和外框宽高/位置，未写回源文件；两份全图 `structured-ui/ref-natural.png`、`structured-ui/target-natural.png` 均为 1094×934 CSS px / 图像像素，来源 DPR=1、实现 DPR=2 的截图已按 CSS 尺寸归一，报告区域统一为 398×527.5。聚焦对照 `structured-ui/comparison-report.png` 左原稿、右当前实现；正文排版、字体、配色、表格和原有图标一致。允许差异为此前授权的圆角/并排外框、演示标识，以及尚未接入的追问禁用状态。原稿中的经营样例不作为本次真实输入事实。
- 设计修复历史：P1 长文/结论卡/折叠区偏离原稿、P2 表头与表格样式偏离，均已恢复并重新截图。必检五项：字体字号/行高与原稿一致；间距和组件顺序一致；沿用原颜色令牌；无新增替代图像；固定按钮/表头文案一致、经营内容来自此次结构化报告。移动端 `mobile-top.png`、`mobile-footer.png`、`mobile-table.png` 核验上下布局、操作可达和表格滚动。浏览器重载时出现一次无 URL 的注入脚本 MutationObserver 异常（栈含 Electron sandbox），报告生成/渲染/下载过程中未新增此错误；未宣称整宿主控制台无错误。final result: passed。
- 本轮证据目录：`output/operations-advisor/structured-ui/`，含 `before.jpg`、上述对照图、`live-success.json`、仅含本次虚构资料的 `demo-report.json`、`browser-checks.json`、`download-check.json`、`automated-checks.log`。临时原稿服务器已关闭，浏览器尺寸已恢复，当前 8895 页面保留真实报告；未调整其它工作区、端口或提交 Git。

### 运营顾问 Chatflow 多轮追问接入（2026-09-11，替代此前追问禁用状态）

- 用户提供已发布的 Chatflow Key 并授权接入测试。Service API `/info`、`/parameters` 确认应用为 `来搜运营顾问｜chatflow多轮问答`，mode 为 `advanced-chat`；线上输入是 module（必填，八板块、48 字符）、business_context（可选，48000 字符）、diagnosis_context（可选，64000 字符），与 Workflow 交接字段一致。
- 凭据独立保存在 macOS 钥匙串：service `com.yingdan.prototype.operations-advisor.chatflow`、account `report-followup`，启动时仅捕获到后端进程内存；环境变量为 `DIFY_OPERATIONS_CHATFLOW_API_KEY`。首次诊断凭据和配置方式不变，没有把明文 Key 写入源码、文档、日志或浏览器。
- 新增 `lib/operations-chat.js` 与 `api/operations-chat.js`。后者复用 `api/operations-diagnosis.js` 的同源检查、SSE 心跳、断连取消和脱敏日志，通过 `kind=chat` 切换请求校验与执行器。`operations-dev-server.cjs` 在 8895 同时提供诊断和追问接口；追问请求体上限 400000 字节，容纳报告与中文背景，首次诊断仍为 200000 字节。`vercel.json` 补充追问超时配置，但本次未部署。
- 追问 POST 字段为 `report_id/chat_inputs/query/conversation_id/data_source`，query 为 1–4000 字符，data_source 当前只能为 demo。后端复用 `normalizeOutputs` 校验当前报告和交接封装，再固定三个 inputs 调用 `/v1/chat-messages`；使用 streaming，auto_generate_name=false，不上传文件。报告与上下文的 SHA-256 摘要在服务端生成 Dify user，绑定该报告会话归属，不接受前端自定义 user。首次 conversation_id 为空，后续沿用上轮返回值；新的报告使用新的 user 和会话，避免跨功能串上下文。
- 公开 SSE 为 progress/session/answer_delta/answer_replace/done/error；成功 result 包含 answer、conversation_id、message_id、workflow_run_id、report_id。只消费正式 message 文本，并复用 `lib/dify-api-client.js` 的隐藏 think 内容过滤器；不转发节点输入输出、查询改写内容及原始上游错误。必须收到 message_end、非空回答和会话/消息标识才算完整；中断或失败不以半条答案代替成功。240 秒超时，取消时尽力调用同一任务的 `/chat-messages/{task_id}/stop`。
- `workflow-client.js` 只在当前成功报告且追问服务已配置时启用原输入框。原稿 `.ai-chat/.ai-chat-msgs/.chat-msg/.chat-bubble` 在报告下方展示安全文本气泡；保留 name/sub/points/rows 的报告区和两面板布局。发送中按钮变为停止，失败恢复问题文本；关闭/切换/重新生成报告清空当前会话并使旧回调失效。状态仅放在页面内存，刷新不会恢复会话；下载仍为首次结构化报告，暂不包含追问记录。
- 真实浏览器验收使用“优爆品提升”演示资料：首次诊断 run `8cbaec01-e014-4ffa-a2fd-d9a00e64e2b3`，report_id `yd-operations-45a3fd85-59ab-4665-9e7a-6d01fd6d55cb`。Chatflow 首问 run `b61f6353-6baa-4c1b-bc3a-d8f9bc5315f1`、续问 run `67435e2a-9e35-4307-9031-8f0c765fb614` 均成功，conversation_id 均为 `0ec90cf8-36b8-44f3-be19-061bc6687b17`。首问引用该报告的缺口，第二轮准确回忆上一轮“海鸥42”测试代号并继续给出台账字段，证明报告交接和多轮记忆实际工作。
- `npm test` 为 173/173 通过；新增 7 项检查覆盖全部 32 function 的离线交接、报告错配、会话隔离、流式过滤、审核替换、失败、取消和 HTTP 往返。真实模型只验收该功能两轮，没有声称全部功能或全部线上错误分支通过。已有 Workflow 修复分支 rows 差异、business_context 内部数据契约等诊断问题，本次未改动或发布。
- UI 验收：默认 1094×934，iframe 834px，报告 x=20/w=398 与运营面板 x=434/w=380，无重叠或横向溢出；390×844 下 iframe 326px，两面板均宽 302px，上下排列，能够滚动到真实回复、输入和发送按钮。原有报告仍为 4×3 表格。浏览器保留此前已出现的 MutationObserver.observe 异常，未阻断此次真实流程；不宣称控制台零错误。临时尺寸覆盖已撤销，页面保留两轮真实回复。
- 验收证据在 `output/operations-advisor/chatflow-integration/`：`live-verification.json`、`live-replies.json`、桌面/窄屏截图与几何检查；开发日志继续写 `output/operations-advisor/local-server.log`，只记录报告/运行/会话/消息 ID 及错误分类。用户要求的 `output/operations-advisor/运营顾问Workflow字段说明.md` 已同步第 7 节和第 8.3 节的追问字段及当前状态。没有改动线上 DSL、其它工作区服务或提交 Git。

### 字段冻结规则与 V1 字段标注页草图（2026-09-11）

- 用户要求将字段冻结/升级机制写进项目规则，并制作基于原版运营顾问界面的独立单 HTML 字段交付页；先提供 ASCII 确认理解。本轮只写入 `AGENTS.md` 规则及本节事实，并在答复中提供 V1 ASCII，不提前制作 HTML、改动运行页面或发布 Dify。
- `AGENTS.md` 新增 Workflow / Chatflow 字段冻结与升级规则：读取既有契约、候选/冻结区分、字段变更显式审查、禁止静默改基线消除错误、接口与实现独立版本、发布前检查及可回退记录。允许用户明确要求的独立字段交付页展示开发说明，正式产品页面仍保持原有边界。
- 当前字段盘点为 `output/operations-advisor/运营顾问Workflow字段说明.md`，现有机器定义为 `lib/operations-report-schema.json`、`lib/operations-entry-map.json`、`lib/operations-report-templates.json`；后端边界分别在 `lib/operations-workflow.js` 和 `lib/operations-chat.js`。这些是核对依据，尚不是经双方确认的完整冻结契约；尚无正式冻结基线、专用 DSL 契约差异检查或发布 CI。不得把报告中的 `schema_version=1.0` 与正式冻结状态混同。
- V1 是字段标注页的第一版候选展示：只取 `/Users/garden/YD/l-sou/来搜运营顾问plugin-panel-分享版(1).html` 的八板块运营顾问内容，保留原稿内部样式和报告结构，不带赢单宿主导航及原文件其它业务外壳。布局拟为左侧原 AI 报告、中间原运营入口、右侧新增字段说明，均占正常布局空间，窄屏顺序排列，不互相覆盖。
- 交互拟为各 Workflow 入口增加独立字段按钮；查看字段不触发真实调用。切换入口同步字段页，点击报告标题/副标题/要点/表格标记定位对应字段，反向点击说明定位界面；字段说明涵盖页面请求、代理补齐、Dify 输入、各结束分支、归一化报告、下载消费及 Chatflow 交接，提供类型、必填、来源、示例、约束、消费位置和当前/待统一状态。
- 展示范围需逐项核对：32 个规范 function 都列入字段目录；原 HTML 已映射的 28 个 AI 报告模板标注各自表头和容量，数据看板及日/周/月四个规范入口标为当前独立看板/未接首次诊断交互。下载是消费现有报告，不再调用 Workflow；追问按实际 Chatflow 字段独立说明，暂不加入此前讨论的 Workflow-as-Tool 或对话改报告方案。尚未定义的 business_context 内部业务字段及逐对象结果结构必须标注待定义，不由标注页发明并宣称已实现。

### V1 单 HTML 字段对照页（2026-09-11，按用户草图调整）

- 用户最新草图明确将字段说明放到最左侧。本节替代上节拟定的左右顺序：**左侧字段卡片 → 中间原稿报告 → 右侧原运营入口**。产物为 `output/operations-advisor/运营顾问-v1字段说明.html`，内含全部 CSS、JavaScript、原稿样例及契约快照，可独立打开；临时本地预览为 `http://127.0.0.1:8897/`。8895 原应用及真实 Workflow/Chatflow 接入代码未改。
- 取材于 `/Users/garden/YD/l-sou/来搜运营顾问plugin-panel-分享版(1).html` 的原样式、运营顾问八板块 DOM、28 个报告样例及日/周/月看板静态值；不包含宿主导航和其它业务页面。桌面三栏各自占位并滚动，880px 及以下依次上下排列；连线只连接可见字段与实际报告位置，移动端隐藏连线。
- 32 个规范功能可切换；28 个原稿 AI 入口增加独立“字段”按钮，另四个看板入口标为未接首次诊断。左侧分为界面映射、调用入参、完整输出、分支/追问；字段可展开完整示例，点击可双向定位。正常布局、加载、关闭、修复及失败状态均为本地示例；追问只展示字段交接，不调用 Dify。JSON 示例及 Blob 下载均使用本页虚构数据，无外部依赖、网络 API 或凭据。页面控制台记录初始化与功能选择，便于定位本地交互问题。
- 字段数勘误：当前本地 Schema 及导出的 9 个相关模型 Schema 均为 11 个业务字段，补入 4 个身份字段后为 15 个；此前文档中的 12 / 16 是计数错误，已更正 `运营顾问Workflow字段说明.md`，没有修改任何业务字段。V1 仍是候选说明页，不是正式冻结基线；此前规则未因此变成 CI 拦截。
- 原稿与容量存在五处冲突：运营规划清单 22 条、老店运营诊断规划 15 条、店铺装修文案 6 条、详情页装修文案 6 条、单品历史数据 7 条，当前各模板上限均为 5 条；前两项还有超长要点。字段页保持原稿并显示差异，不暗改模板或 Workflow；这些功能不生成成功响应 JSON 样例，原稿值仅放入文档元数据。全部 28 个原稿表头与本地模板一致。
- 浏览器验证逐项切换全部 32 个功能，核对标题、原稿表头和所属模块；另验证字段按钮、双向定位、完整报告 15 字段、错误/关闭/重新查看、修复分支 rows、冲突提示、日看板数值切换及本地追问。1094×934、900×768、390×844 均无横向溢出和三栏重叠；手机宽度为 358px，三个区块可依次滚动访问。临时视口已撤销，单 HTML 预览保留。页面未记录 error/warn，内联脚本语法和依赖/凭据模式检查通过。未运行真实 Dify 调用，未重跑与本独立说明页无关的整套后端测试。
- 设计验收：`output/operations-advisor/field-guide-qa/reference-desktop.png` 与 `guide-desktop.png` 在 1094×934、相同报告样例、相同面板宽度下对照；参考只规范化外层位置和高度。原报告字体、强调、要点间距、表头/表格及右侧八宫格保持一致；新增字段列、连线、候选/示例标识、状态选择和并排圆角为本次明确变化。已修复字段卡片过高、关闭误显示加载、包装要点带来的末条分隔线差异及按钮继承样式偏差。最终设计结果：passed。QA 写入已有 CONTEXT，不另建项目根目录说明文档。
- 证据目录同时保存 `static-checks.json`、`browser-checks.json`、`mobile-fields.png`、`mobile-report.png`。下载按钮处理和本地提示已触发，但当前内置浏览器未捕获 download 事件，在 Downloads 未找到对应文件，不能声称下载落盘已验收；独立 HTML 主产物本身已实际落盘。未提交 Git、部署或改动远端 Dify。

### 独立字段冻结与升级机制文档（2026-09-11）

- 用户要求机制单独成文。新增 `output/operations-advisor/运营顾问字段冻结与升级机制.md`，作为产品、开发和 AI 维护 Workflow / Chatflow 的共同操作文档；`AGENTS.md` 加入必读链接，已有字段说明加入维护入口。
- 文档覆盖首次冻结范围及确认、版本包归档、契约与实现版本区分、变更分类、测试应用验证、调用方迁移、旧报告/会话兼容、发布与回退、维护记录模板、交给 AI 的任务模板和当前待办。明确当前严格 Schema 下新增可选字段也不能默认兼容；`contracts/operations-advisor/1.0/` 仅为未来归档位置建议，尚未创建。
- 文档版本 1.0 不等于接口已冻结。本轮仅新增文档并更新引用，未改动报告 `schema_version`、任何业务字段、后端代码、HTML 或远端 Dify；正式基线、确认记录、专用差异检查和自动发布拦截仍待建立。

### 字段字典与维护机制同步（2026-09-11）

- 用户要求字段文档也纳入维护，并能看到各字段的具体定义。继续维护现有 `output/operations-advisor/运营顾问Workflow字段说明.md`，不创建另一份重复字典；标题明确覆盖 Workflow / Chatflow，文档版本为 1.1，接口仍为候选且报告 `schema_version="1.0"` 未改变。
- 字段文档补充直接定位目录、字段字典维护责任、完整路径阅读规则、15 个报告字段及 3 个证据/9 个行动子字段的示例、一份完整虚构 JSON，以及 Dify Chatflow 可选字段与本地交接必填要求的区别。保留全部 32 个功能、28 份表头、四个结束分支、代理和内部节点说明；未定义业务字段继续标为待办。
- 机制文档同步到 1.1，明确字段字典是必交付材料，随契约保存版本快照，并与 Schema、DSL、调用代码、UI 映射和样例一起核对。AGENTS.md 同时直接链接机制与字段字典，防止以后只维护流程却遗漏具体字段。
- 本次为文档说明补全，没有增删或改名任何业务字段，没有修改机器定义、调用代码、HTML、Dify 发布版或建立正式冻结基线；原 HTML 字段路径与 Schema 未因此变化。
- 文档验证：完整虚构报告通过现有 `normalizeOutputs` 的正常/修复分支检查及 `buildChatRequest` 交接检查；报告 15 个顶层字段、3 个证据子字段、9 个行动子字段符合现有定义；32 个功能及 28 份表头/容量匹配本地机器文件。文档内部锚点、文件链接与 Markdown 代码块检查通过，`git diff --check` 通过；无真实 API 调用，未将此验证宣称为自动冻结工具。

### 运营顾问本地 Git 保存（2026-09-13）

- 用户要求先将当前工作保存到分支。原 worktree 为 detached HEAD，已新建 `codex/operations-advisor`；保存当前导航及其页面依赖、Workflow / Chatflow 接入、Schema / 映射、测试、字段字典、冻结升级机制、单 HTML 字段对照及脱敏 JSON 验证记录。没有切换或覆盖其它工作区的分支。
- 提交前重跑 `npm test`：173/173 通过；暂存区空白检查通过，新增文本的凭据模式扫描未发现真实 Key。仅清理说明页行尾空白、保留 Markdown 强制换行，并同步说明页文件哈希；业务字段与候选状态不变。
- 运行日志、浏览器截图和临时参考服务器脚本保留在本机，不纳入此次提交。仅本地 Git 保存，不包含推送、部署、Dify 发布或正式字段冻结。

### 两分支试合并验证（2026-09-14）

- 独立验证分支 `codex/verify-advisor-image-merge` 整合 `codex/ai-image-studio`（790f6358）与 `codex/operations-advisor`（85841329）。作图 JS/CSS、主导航、路由、资源缓存标记采用作图分支；运营顾问 HTML、Workflow / Chatflow 客户端、代理、字段定义和文档采用运营顾问分支。两边 CONTEXT 历史追加段完整保留；涉及作图旧入口的历史描述，以当前独立主图/套图/详情图/海报入口为准。
- 7 个冲突均已解决。`npm test` 200/200 通过，暂存区空白检查通过。测试包括受控 HTTP/SSE 和运营报告契约校验，不代表线上服务的当前可用性。
- 无凭据隔离服务在 127.0.0.1:18947 验证。浏览器通过四个作图菜单切换、6 张整套下载演示、仅第二张调整；运营顾问模块可打开，未配置时正确展示错误并禁用下载与追问。控制台无 error；390px 宿主与 326px 运营 iframe 均无横向溢出，桌面双面板可完整显示。未读取钥匙串或重跑线上 Dify。
- main 与原有工作区未修改、未合并、未推送。main 尚有独立的 Dify 工作流及旧页面未提交内容，正式合并时须保留并区分处理。自动测试原始输出在 `/tmp/yd-merge-tests.log`。
