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
