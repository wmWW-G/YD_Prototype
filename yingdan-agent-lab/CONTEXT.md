# 赢单 Agent 工作台 Context

## 这个目录干嘛

`yingdan-agent-lab/` 是「赢单外贸业务员 AI 作战台」的规划和设计目录,同时含一个可运行的 React/Vite UI 原型 `agent-thread-prototype/`。

它回答一个问题:

```text
赢单怎么从「外贸 AI 问答」,升级成「能创建 Agent、用 Skill、调工具,把一个客户线索一步步推进到成交」的外贸作战台?
```

## 当前最新方向（2026-06-30）

```text
先在本地网页跑顺「第一刀」,再谈扩展和 Electron。
第一刀验收 = 能执行真实外部 Accio skill 包 alibaba-inquiry-meeting,并产出合格 XLSX。
当前 Runtime 方向升级为 DealOps Runtime Loop v2: 业务对象优先、依据优先、质量门优先、可暂停恢复。
当前本地已新增 real-bridge 验收命令,并把它接进「新对话」任务线程。
前台线程必须支持自然语言目标输入、用户/Agent 消息、可展开的业务化操作记录和同一次任务继续追问。
当前阶段只要求「新对话」先做成外贸版 Codex / Claude Code 的任务入口,不要求六个一级入口同时升级。
DeepSeek V4 只是诊断生成入口之一,不能替代真实 Skill 执行和真实工具数据。
```

- 第一刀的落地细节以 `BUILD_SPEC.md` 为准;总架构以 `RUNTIME_ARCHITECTURE.md` 为准。
- 旧方向 `Tauri + Python FastAPI sidecar + LangGraph` 已废弃。
- Electron 仍是最终桌面壳方向,但后置;现有 chatbot 类能力继续复用赢单后端接口。
- 原型里的 6 个一级入口是 UI 基线;其中「赢单外贸顾问」和「技能Skill」里的市场调研、开发信、询盘分析回复等,属于现有 chatbot 的业务内容入口,不等于 Runtime 验收 Skill。
- 当前第一阶段的体验目标只落在「新对话」:用户像用 Codex / Claude Code 一样交代一个外贸业务目标,系统自己拆任务、核对资料、生成产物、检查结果、遇到风险再问确认。
- 当前旧的 `inquiry-reply` 代码只能算本地纵向 demo;不能再作为第一刀完成标准。

## 新对话第一阶段目标

「新对话」先做成外贸业务员的 Codex / Claude Code:

```text
用户只输入业务目标
→ 系统理解要做什么
→ 自动匹配合适 Skill
→ 读取相关客户、产品、历史跟进和外部只读数据
→ 边做边显示业务化进度
→ 生成真实业务产物
→ 检查质量和依据
→ 遇到保存、导出、外发、付费或敏感动作时先问用户
→ 用户补充后继续同一次任务,不从头重跑
```

第一阶段不追求把「赢单外贸顾问」「我的Agent」「技能Skill」「外接生态」「客户Kass」全部改成这种形态。它们可以继续作为普通页面或业务入口存在;真正的 Codex / Claude Code 式执行感,先集中在「新对话」里打透。

## 当前通用 Runtime 进展（2026-06-29）

第一刀已经从 `alibaba-inquiry-meeting` 专线,抽成最小可扩展的通用 Skill Runtime:

```text
用户输入
→ skill-registry 匹配 Skill
→ skill-runner 执行 goal / skill.match / skill.load / plan / action / observation / artifact.verify / finish
→ adapter 执行具体 Skill
→ Runtime 统一写 run log、跑 policy、校验产物
→ 前台新对话展示业务化活动流和产物卡
```

注意:这仍是第一刀骨架,不是完整 DealOps Runtime Loop。当前已补上 Runtime 层 policy ask / checkpoint / resumeGoal 的最小硬边界,并给 `server/skill-runner.mjs` 的 run log 与 loop steps 补上 `status + phase`;Markdown 业务产物和 `alibaba-inquiry-meeting` 真实 XLSX 链路都会写入内部 `evidence-ledger.json`;`alibaba-inquiry-meeting` 真实 runner 已有最小 typed evaluator,会在证据账本或 XLSX validation 不合格时阻止 `run.completed`。下一步要继续补更完整的 resume_from、更广的 XLSX typed evaluator 和跨 Skill 的 evidence ledger 标准。

当前已落地:

- `server/skill-registry.mjs`:读取 `workbench/registry/skills.json` 和 `workbench/skills/<skill>/skill.json`,所以新增轻量 Skill 不需要改 `skill-agent.mjs`。
- `server/skill-runner.mjs`:通用 loop、policy 检查、adapter 调度、run log 和产物校验。
- `server/skill-runner.mjs` 的 run log 事件和 `loop.steps` 必须带 Runtime phase: `preflight / assembling_context / planning / executing / validating / committing`。这是内部结构化字段,用于恢复、评估和排查;前台仍只展示业务化的 `识别任务 / 核对资料 / 生成材料 / 检查结果`。
- `server/skill-runner.mjs` 的 policy `ask` 已经是 Runtime 硬边界:遇到 `ask` 会写 `run.checkpointed` / `run.waiting` 和 `<runId>.checkpoint.json`,不执行 adapter;checkpoint 记录 `completedActions`、`completedPhases`、`pendingAction`、`artifactRefs`、`evidenceSummary` 和 `memoryCandidates`。用户确认后 `resumeGoal()` 会从同一 runId 的 `resume_from` 继续,只追加 `run.resumed / policy.checked / action.executed / observation.recorded / artifact.verified / run.completed`,不再重复写 `goal.received / skill.matched / skill.loaded / plan.created`。
- Runtime policy 暂停确认时如果同轮已经有业务产物,响应必须继续保留 `artifact` 和 `context.artifact`;确认或取消期间不能丢当前产物,否则后续预览、保存、导出或同任务续改会断上下文。
- 缺资料等待态也必须写 Runtime 风格 checkpoint:进入 `needs-input` 时后端写 `workbench/runs/<runId>.jsonl` 和 `<runId>.checkpoint.json`,run log 至少包含 `goal.received / skill.matched / skill.loaded / run.checkpointed / run.needs_input`;用户补资料足够后用同一个 runId 从 `needs-input:<skillId>` 继续,不再重复写 `goal.received / skill.matched / skill.loaded / plan.created`。续跑仍要重新执行 policy 检查:允许时继续 `action.executed / observation.recorded / evidence.added / artifact.verified / run.completed`;需要确认时停在 `policy.checked / run.checkpointed / run.waiting`。公开 HTTP/SSE payload 仍不能暴露 runId、checkpointPath、runLogPath 或本地路径。
- `server/skill-adapters/alibaba-inquiry-meeting.mjs`:把已跑通的 Alibaba real-bridge 链路包装成第一个 adapter,保留原真实验收能力。
- `server/artifact-validator.mjs`:Runtime 层复核 XLSX,包括 LibreOffice headless 重存、清理 `xl/tables/`、`xl/drawings/`、tableParts 和 drawing relationships 残留,再执行 `unzip -t`、`openpyxl.load_workbook()`、必需 sheet、禁止 sheet 和残留扫描。
- `workbench/registry/skills.json`:注册 `alibaba-inquiry-meeting` 的目标匹配、policy、产物要求和计划。
- `workbench/skills/supplier-brief/skill.json`:第二个轻量 mock Skill,用于证明 registry + runner 可接新 Skill。
- `business-draft` adapter:用于开发信草稿、客户推进分析和询盘回复草稿这类轻量 Markdown 业务产物。
- `quotation-sheet` adapter:用于报价单任务,根据产品、数量、单价和贸易条款生成 `报价单.xlsx`,并走 Runtime XLSX 校验。
- `workbench/skills/cold-email-draft/skill.json`:新对话可用自然语言触发开发信草稿,支持 `follow up`、德国客户、MOQ、交期等口语输入归一化。
- `workbench/skills/customer-followup-plan/skill.json`:新对话可生成客户推进判断、信息缺口、风险和下一步跟进行动。
- `workbench/skills/inquiry-reply-draft/skill.json`:新对话可生成询盘回复草稿,但仍不自动外发。
- `workbench/skills/quotation-sheet/skill.json`:新对话可生成报价单 XLSX;支持 `做报价`、`生成报价`、`报价给客户`、`客户问报价` 这类口语说法;缺产品、数量、单价、币种或贸易条款时先追问,不编造报价。
- 自然语言路由必须区分相近业务意图:`帮我开上周询盘分析会` 应匹配询盘复盘 XLSX,`客户发来价格和交期问题,帮我回一下` 才应匹配询盘回复草稿。不要把单独的 `询盘` 归一化成回复意图。
- `agent-thread-prototype` 的新对话线程会把待确认状态、产物上下文和消息轻量保存到浏览器本地,刷新后不立刻丢任务。
- 新对话顶部标题会显示当前识别出的业务任务名,例如 `开发信草稿`、`客户推进分析` 或 `询盘分析会`;浏览器本地恢复和后端 session 恢复都要保留 `taskTitle`,不能把 sessionId、skillId、runId 或文件路径暴露给用户。
- 如果用户第一句就是外发、付费、保存或导出这类风险动作,且当前还没有业务任务标题,新对话顶部会用确认卡标题兜底,例如 `外发前需要你确认`;状态 chip 显示 `等待确认`,不是 `等待补充`;已有业务任务标题时不被风险确认标题覆盖。比如当前任务是 `客户推进分析`,用户再说 `保存当前文件`,标题仍应保持 `客户推进分析`,不能变成 `写入客户档案前需要确认`。
- 新对话恢复旧任务后必须提供明确的 `新任务` 入口:点击后清空当前 session、消息、上下文、任务标题、产物预览和输入框,避免新的业务需求被误当成旧任务追问;后端旧 session 文件保留作排查证据。
- 新对话还必须能回到最近任务线程:顶部 `历史` 按钮读取 `GET /api/agent/sessions`,只展示任务标题、最近用户输入、状态和产物名;点击某条历史任务后再读取 `GET /api/agent/session/:sessionId` 恢复消息、等待态、产物和标题。历史列表不能暴露 runId、session 文件路径、outputPath、checkpointPath 或内部 context。
- 前台新对话状态必须区分 `waiting` 和 `completed`:后端返回 `needs-input` 或 `needs-input-followup` 时,线程 chip 显示 `等待补充`,输入按钮显示 `继续补充`;后端返回 `confirmation-required` 且最新确认卡可操作时,线程 chip 显示 `等待确认`,输入框提示 `补充确认信息`,按钮显示 `补充说明`,不能把等待用户补资料/确认误标成已完成。
- `agent-thread-prototype/src/agentThreadComposerState.js` 是新对话顶部 chip、输入框 placeholder 和发送按钮文案的统一来源;不要在 `App.jsx` 里重新散写确认/补资料状态判断。
- 新对话已有 session 后,输入区要显式提示正在续接的任务或产物:如果当前 session 有 artifact,显示 `正在接着：<产物名>` 并提示可继续修改这份材料;如果只有任务标题,显示 `当前任务：<任务名>`。这条规则在等待确认期间也成立,确认态仍显示 `等待确认` 和补充确认 placeholder,但不能藏掉当前产物上下文。这用于强化“补一句话后接着做”,不是让用户重新开新聊天。
- 新对话空态只能用业务任务口吻引导,例如“今天想推进哪件外贸成交任务？”;不要写“无需配置流程 / 不用选流程 / 不用填配置”这类解释产品机制的说明文案。
- 新对话 composer 默认必须为空;示例任务只能放在示例按钮或 placeholder 里,不能预填进输入框,避免第一屏像 demo 表单而不是用户主动交代任务的 agent thread。
- `server/agent-session-store.mjs`:后端保存新对话 session 文件,前端刷新或只传 `sessionId` 时可以恢复 pending task、pending confirmation、artifact 和消息。
- `server/agent-session-store.mjs` 保存新回合时必须区分“历史消息里的旧产物”和“当前可续接产物”:如果本轮 response 显式携带新的 `context` 且里面没有 artifact,说明当前任务已经切到新的 waiting/needs-input 状态,必须清掉 session 顶层 `artifact`、`skillAgentResult`、`period` 和旧 summary;历史消息仍可保留旧产物卡,但前端恢复后不能把旧文件当成当前任务继续修改或导出。
- 前端请求 context 和 `server/agent-request-context.mjs` 必须遵守同一条当前产物规则:只要后端 session context 已经接管了当前状态,就不能从前端本地 `skillAgentResult` 或 client context 回捞旧 artifact / period。新 waiting 任务没有 artifact 时,旧文件只能留在历史消息卡里,不能继续显示为输入区当前产物,也不能参与下一句保存/导出确认。
- 前端 SSE / 网络异常兜底同样不能保留旧产物:进入本地 recoverable waiting 时,只保留 pendingTask 等待信息,必须清掉 `artifact`、`period` 和 `skillAgentResult`;否则下一句 `保存一下 / 导出文件` 会误绑异常前的旧文件。
- `GET /api/agent/session/:sessionId`:前端恢复线程的后端接口;localStorage 只作为兜底,不再是唯一连续性来源。
- `GET /api/agent/sessions`:前端最近任务列表接口,按更新时间倒序返回最多 50 条安全摘要;只包含 sessionId、taskTitle、status、kind、preview、artifactName、createdAt、updatedAt。
- `GET /api/agent/session/:sessionId` 恢复 payload 里的消息正文、summary、taskTitle 和 artifact name 也必须净化;即使后端 session 文件保存了 `quotation-sheet-skill-runtime-...xlsx`、本机路径或 runtime action 名,前台也只能看到 `报价单.xlsx`、`修订版表格` 这类业务化文案。
- 前端标题栏、历史列表、输入区、产物卡、预览面板、缺资料卡、确认卡和展开的运行记录也必须有最后一道展示净化:即使旧 localStorage、异常 payload 或旧 session 摘要里带有 `skill-runtime`、`workbench/`、`runId`、`outputPath`、`action.executed` 或 `tool_call`,页面 h1、composer 上下文 chip、placeholder、历史摘要、产物名称、缺资料标题/条目/提示、确认标题/正文/按钮、`本次操作记录` 和 `执行过程` 都只能显示 `报价单.xlsx`、`业务材料.md`、`本次任务` 或业务化兜底文案,不能把内部文件名和工具字段穿透给用户。正常业务标题里偶然提到 `schema` 这类词时不要过度降级,除非同时命中明确 runtime 字段。
- pending task 续跑:用户第一次说得太模糊时返回 `needs-input`;补一句话后,后端会用“原始任务 + 新补充”恢复执行文本,并从原 `needs-input:<skillId>` checkpoint 继续。内部可以恢复 Skill 和 plan,但 run log、最终 process、活动流和 SSE 首条可见进度都不能像新任务一样重播 `识别任务 / 核对资料 / 拆解任务`;如果 policy 允许,展示 `继续执行 / 生成材料 / 整理发现 / 检查结果 / 完成`;如果 policy 需要确认,展示 `继续执行 / 核对权限 / 等待确认`。
- pending task 必须累积多轮补充:用户分多句补客户、询盘、产品、下一步目标时,后端用“原始任务 + 全部 supplements + 当前输入”重新匹配和执行,不能只保留最后一句补充。
- 同一线程里的新匹配任务也要能沿用最近真实用户资料:例如先生成 `开发信草稿.md`,上一轮用户已经说清 `德国采购商 / 太阳能路灯 / MOQ和交期`;下一句 `再做一个客户下一步推进计划` 应把这些用户说过的事实带入 `客户推进分析`,不能像失忆一样重新追问。只允许复用最近用户消息里的事实,不能把 Agent 生成的推测、内部 runId、路径或 tool 信息当作业务事实;复用后仍缺资料时继续追问。用户明确说 `另一个客户 / 新客户 / 换个买家` 时必须视为新客户对象,不能套用上一位客户的国家、产品和问题。用户明确说 `重新开始 / 从头开始 / 新任务 / 不要沿用上一个任务` 时也必须切断旧线程事实、旧 pending task、旧确认卡和旧产物上下文;如果新任务本身缺客户资料或当前卡点,应回到 `needs-input / waiting`,而不是把上一轮客户资料粘过去。但 `不要重新开始 / 先别从头开始` 这类否定重开话术表示继续当前任务,不能误清上下文。
- 前端可恢复异常也必须保留续接上下文:如果 SSE 或网络在后端返回 sessionId 前中断,前端会生成 `agent-session-local-*` 兜底 ID,并把原始任务写入 `context.pendingTask`;用户下一句补充资料时,后端仍能按同一任务续跑,不能把补充句当成全新任务。
- 业务产物缺资料 gate:即使已经匹配到 `开发信草稿`、`客户推进分析`、`询盘回复草稿` 或 `报价单`,如果缺客户、产品、目标市场、询盘原文、当前卡点、数量、单价或贸易条款等关键上下文,新对话也必须先追问并进入 `waiting`,不能生成空泛产物;这条路径也必须返回可见过程,至少包含 `识别任务 / 核对资料 / 等待补充`。询盘回复里单独出现 `MOQ/交期` 只能算客户问题,不能冒充产品资料;报价单里单独出现 `报价/价格` 只能算任务意图,不能冒充产品资料;`客户是德国买家` 这类身份描述也不能因为出现“买家”就被当成采购动作;如果没有产品资料或报价边界,必须先追问。
- 引用资料属于用户提供的业务上下文,不能被当成装饰文本丢掉。用户说 `帮我做报价单` 并引用 txt/md/csv 内容时,后端要从 `产品,太阳能路灯`、`数量,500套`、`单价,USD 35`、`贸易条款,FOB Shanghai` 这类 CSV 行里识别产品、数量、单价和贸易条款;字段齐全时直接生成 `报价单.xlsx`,不能继续追问单价或产品资料。报价/PI 任务里的口语金额也算单价,例如 `帮我做PI，太阳能路灯500套，35美金，FOB上海` 应直接生成报价单;但 `样品费,USD 35`、`样品费,35 USD`、`运费,USD 35` 这类金额不是单价,不能让报价单绕过单价追问。
- 业务草稿产物必须吸收用户补充里的关键业务事实:产品、国家、MOQ、交期、样品时间、议价/折扣压力、已读不回/客户沉默、客户观望/决策拖延、采购意向/购买意向、付款/账期压力、质量/售后风险、样品/费用压力、物流/运费压力、小单/MOQ压力、独家代理/渠道合作等不能只藏在 `任务来源` 引用里,应进入邮件正文、依据、客户关注点或下一步动作;例如 `产品太阳能路灯,想下周先拿样品` 的询盘回复正文要明确出现 solar street lights 和 sample plan for next week,`客户砍价，产品是家具，怎么谈` 的客户推进分析要明确出现 `客户关注点: 议价/折扣压力`,`客户已读不回，产品是家具，怎么跟` 要明确出现 `客户关注点: 客户沉默/未回复`,`客户说再考虑一下，产品是家具，怎么跟` 要明确出现 `客户关注点: 客户观望/决策拖延`,`客户想购买500套太阳能灯，帮我做下一步推进计划` 要明确出现 `客户关注点: 采购意向/购买意向`、`产品: 太阳能灯` 和 `数量: 500套`,`客户要求60天账期，产品是设备，怎么处理` 要明确出现 `客户关注点: 付款/账期压力`,`客户抱怨质量不行，产品是灯具，怎么处理` 要明确出现 `客户关注点: 质量/售后风险`,`客户要免费样品，产品是灯具` 要明确出现 `客户关注点: 样品/费用压力`,`客户嫌运费太贵，产品是灯具，怎么处理` 要明确出现 `客户关注点: 物流/运费压力`,`客户只想小批量试单，产品是灯具，怎么处理` 要明确出现 `客户关注点: 小单/MOQ压力`,`客户想做独家代理，产品是灯具，怎么谈` 要明确出现 `客户关注点: 独家代理/渠道合作`。
- 常见售前问题也必须进入业务产物关注点,不能只停留在 `任务来源`。例如 `客户问质保多久，产品太阳能灯，帮我回一下` 要在询盘回复里出现 `客户关注点: 质保/售后承诺` 和 warranty/after-sales 相关正文;`客户问能不能定制logo，产品太阳能灯，帮我回一下` 要出现 `客户关注点: OEM/定制贴牌`;同类的安装说明、FBA 发货、中性包装也要提炼成 `安装/使用资料`、`FBA/发货渠道`、`包装/中性包装`。但这些词本身仍不是产品资料,`客户问能不能做中性包装，帮我回一下` 和 `写一封开发信给德国客户，重点讲包装` 仍要追问产品或核心卖点;同句带 `价格/MOQ/交期/样品` 也不能绕过这条追问。裸 `产品`、`规格`、`型号`、`卖点` 这类字段名也不算产品资料,必须带具体值;例如 `客户问产品质保多久`、`客户问 product warranty` 仍要追问具体产品或核心卖点。`包装要求/package-requirements` 是售前问题,但 `产品是包装盒`、`产品是 packaging tape` 这类真实产品名要算产品上下文。
- 认证、合规和验厂也属于可直接执行的外贸上下文,不能机械追问“询盘原文”或“当前卡点”。`客户要CE认证，产品太阳能灯，帮我回一下` 应直接生成 `询盘回复草稿.md`,产物依据里要出现 `产品: 太阳能灯` 和 `客户关注点: 认证/合规要求`;`客户要验厂，产品太阳能灯，下一步怎么推进` 应直接生成 `客户推进分析.md`,产物依据里要出现 `产品: 太阳能灯` 和 `客户关注点: 验厂/资质审核`。但认证、合规、证书、验厂和资质本身不是产品资料,`客户要CE认证，帮我回一下`、`客户要验厂，帮我回一下` 仍要先追问 `产品资料或报价边界`;`客户要，产品太阳能灯，下一步怎么推进` 这种空壳表达也不能冒充当前卡点。
- 用户明确要跟进节奏时,客户推进分析不能只输出通用下一步行动。已有产品和当前卡点后,`客户已读不回，产品是家具，帮我做一个7天跟进计划` 这类输入必须在产物中追加 `7天跟进节奏`,并按第1天、第3天、第5天、第7天拆成可执行动作。若只说 `客户已读不回，帮我做一个7天跟进计划` 而没有产品或核心卖点,必须先进入 `needs-input / waiting` 追问 `产品或核心卖点`,不能生成泛泛计划。
- 客户分析类请求必须防止空泛生成:`客户是德国采购商,帮我做客户分析`、`客户是德国买家,帮我做客户分析`、`客户是德国采购商,产品是太阳能灯,帮我做客户分析`、`这个买家怎么推进`、`帮我判断这个客户优先级` 这类只有客户类型、产品或任务意图的输入,应先追问询盘、聊天记录或当前卡点;`有个询盘`、`有需求` 这种空壳词也不能算足够依据;补一句 `他问MOQ和交期,产品是太阳能灯` 后再接着同一任务生成 `客户推进分析.md`。但 `客户说/客户问/客户提到/客户要求/客户抱怨/客户投诉 + 具体问题或异议 + 产品/业务目标` 已经是足够的当前卡点,例如 `客户说价格太高，帮我想下一步怎么谈，产品太阳能路灯` 应直接生成客户推进分析,不能继续机械追问客户类型。业务员常用的代称、议价口语、沉默跟进口语、观望/拖延决策口语、采购意向口语、付款口语、售后口语、样品费口语、小单试单口语、渠道合作口语和验厂/资质审核口语也要识别,例如 `买家嫌贵，产品是家具，帮我想下一步怎么谈`、`对方嫌贵，产品是家具，下一步怎么推进`、`客户砍价，产品是家具，怎么谈`、`买家要折扣，产品是太阳能灯，怎么谈`、`客户已读不回，产品是家具，怎么跟`、`买家一直没回复，产品太阳能灯，下一步怎么办`、`客户说再考虑一下，产品是家具，怎么跟`、`买家说先看看，产品是太阳能灯，下一步怎么办`、`客户想购买500套太阳能灯，帮我做下一步推进计划`、`客户想买500套太阳能灯，帮我做下一步推进计划`、`客户要求60天账期，产品是设备，怎么处理`、`客户抱怨质量不行，产品是灯具，怎么处理`、`客户要免费样品，产品是灯具`、`客户只想小批量试单，产品是灯具，怎么处理`、`客户想做独家代理，产品是灯具，怎么谈`、`客户要验厂，产品太阳能灯，下一步怎么推进` 应直接进入客户推进分析,不能因为没写“客户说”就追问。观望/拖延决策词必须能看出是客户、买家、对方的原话或反馈;`我先看看`、`之后再说` 这类用户自己的操作语气不能冒充客户当前卡点。
- 渠道/代理词不能冒充产品资料:`渠道代理 / 经销代理 / 独家代理 / exclusive distributor` 表示客户类型或合作模式,不是产品或核心卖点。`写一封开发信给德国渠道代理` 应先追问 `产品或核心卖点`;`客户想做独家代理，怎么谈` 应先追问产品,用户补 `产品是灯具` 后再接着同一 session 生成 `客户推进分析.md`。
- 相近路由必须区分开发信、客户跟进和询盘回复:`写个 follow up 给德国客户...`、`准备一封跟进开发信...` 属于开发信/跟进邮件;`帮我跟进这个德国客户,他问MOQ和交期...` 属于客户推进分析/跟进计划;`客户发来询盘,帮我回一封邮件...` 属于询盘回复草稿,不能因为出现“跟进”或“邮件”就被错误抢路由。
- 报价单路由必须区别于报价邮件和外发动作:`客户问报价...帮我做报价`、`帮我生成报价`、`帮我报价给德国客户` 属于 `quotation-sheet`;`帮我写报价邮件` 仍属于邮件草稿/回复草稿;`把报价发给德国客户` 必须先停在外发确认。不要因为出现“报价”就强行生成 XLSX,也不要因为出现客户名就绕过确认。
- 缺资料等待态必须结构化展示:后端消息要带 `needsInput.items`,前台在 agent thread 里渲染为「缺少资料」清单;公开 `context.pendingTask` 只保留任务名、原始诉求和缺失项,不能暴露 `skillId`、runId、路径或工具名。
- Markdown 产物续改:用户已生成 `开发信草稿.md`、`客户推进分析.md` 这类文本产物后,再补一句“语气更礼貌一点 / 加一句可以寄样品”,后端会安全更新同一份 `workbench/artifacts/` 产物,而不是重开任务或只返回摘要。
- 已有产物的同线程明显改稿请求必须优先于新任务路由:如果当前 session 有 `客户推进分析.md`、`开发信草稿.md` 等 artifact,用户再说 `继续 / 优化 / 修改 / 改成 / 写成 / 两版 / 第1天话术 / 补一句`,应先按当前产物 follow-up 处理。只有用户明确说 `新任务 / 重新开始 / 另一个客户 / 再做一个报价单` 或输入不带改稿意图的完整新目标,才重新匹配新的 Skill。
- XLSX 产物续改:用户已生成 `询盘分析会.xlsx`、`报价单.xlsx` 这类表格产物后,再补一句“按负责人补一列下周动作 / 加一列有效期30天”,后端会在同一任务下生成一份 `已续改` 修订版 XLSX,保留原工作表并新增 `本次追问` sheet;原文件不被覆盖,修订版必须通过 Runtime XLSX 校验。公开 `taskTitle`、artifact 名和消息内容必须使用 `报价单-已续改-*.xlsx` 这类业务友好名称,不能暴露 `quotation-sheet`、`skill-runtime` 等内部文件名。
- 导出确认不能打断同任务续改:导出的 `workbench/exports/<sessionId>/...` 文件只是交付副本;用户导出后继续说“再改一下 / 加一列 / 语气更礼貌”时,后端必须通过 `exportedFrom` 回到原始 `workbench/artifacts/` 产物继续修改。修改后的新版本需要用户再次导出才会生成新的可交付副本,不能偷偷改已经导出的文件。
- `server/agent-message-stream.mjs` 和 `POST /api/agent/message/stream`:把 Runtime 真实 run events 翻译成 `progress` SSE 事件,前端运行中气泡会逐步显示“识别任务 / 核对资料 / 生成材料 / 检查结果”,最后收到 `result` 再落正式 Agent 回复。普通新任务的首条 progress 是 `识别任务`;已有 pending task 或 pending confirmation 的 checkpoint 续跑首条 progress 必须是 `继续执行`,不能先闪一下 `识别任务`;但用户明确说 `重新开始 / 新任务 / 从头开始` 时,即使旧 session 仍有 pending runtime,首条 progress 也必须按新任务回到 `识别任务`。公开 progress 可以带 `phase`,但必须是 `识别 / 核对资料 / 拆步骤 / 执行 / 检查 / 收尾` 这类中文短标签,不能把 `preflight / validating` 等内部 phase key 暴露给业务用户。
- typed evaluator 失败也必须翻译成业务化检查暂停:`artifact.typed_evaluated` 对前台展示为 `检查结果`,如果失败则提示“检查结果没有通过,我已先停下,避免交付可能误导的材料”。HTTP/SSE recoverable result 也要保持 `waiting`,标题用 `检查结果需要处理`,不能暴露 `typed evaluator`、`artifact.typed_evaluated`、skill slug、runId、路径或 evidence ledger。
- 真实外部数据源失败不能伪装成缺业务资料:例如 `alibaba-inquiry-meeting` 真实 runner 没有任何必需只读工具成功时,公开线程必须显示 `连接数据源 / 等待处理`,提示确认 Alibaba bridge 已启动、账号已登录、只读工具有权限;不能泛化成 `更多业务资料`,也不能编造 XLSX。用户处理好后说 `我已处理，继续` 应沿用原任务重新读取真实数据。
- `artifact.verified` 对 Markdown 业务产物不再只是检查文件非空;Runtime 会生成机器可读 `validation.evidence`,并在同一产物目录写入内部 `evidence-ledger.json`,核对产物是否包含依据段、用户来源、产品、客户/市场、关注点、数量、价格、贸易条款、付款条件、样品计划和下一步动作。run log 会追加 `evidence.added`;SSE 的 `检查结果` 在 evidence 通过时显示 `已核对产物里的业务依据和用户事实覆盖`,失败时阻止任务完成。
- SSE 展示层会合并连续重复的 progress,例如多个内部 `policy.checked` 只展示一次 `核对权限`;后台 run log 仍保留完整审计事件。
- 前端实时进度合并只允许“连续同名步骤”更新同一步,例如 `识别任务 running → 识别任务 complete`;非连续同名步骤必须保留为新阶段,例如先核对产物权限,生成材料后再核对保存权限。不能按 label 全局覆盖,否则后面的确认步骤会被挪到前面旧位置。
- 前台进度和展开的「本次操作记录」不能出现 `匹配处理方式` 这类流程配置语言;内部 `skill.matched` / `skill.match` 应翻译成 `确认任务类型`、`核对资料` 等业务动作,避免重复显示“识别任务”。
- 「本次操作记录」里的 `下一步` 只能展示真实业务动作;后端必须净化 `none / finish / done / null / undefined` 这类终止占位,不能让前台出现 `下一步：none`。
- 新对话 stream / JSON 接口的后端异常或 `ok:false` 结果也必须回到任务线程:返回 `needs-input / waiting` 助手消息,过程显示 `识别任务 / 处理卡住 / 等待补充`,并尽量保存 session;不要把 raw error、runId、action 名或底层工具名暴露给前台。
- 新对话 SSE `error` 事件也不能直接展示 `message/error` 字段;前台只提示任务中途卡住、未生成业务材料、可补充资料后继续或稍后重试。
- 新对话前端自己的网络异常也必须留在业务语言里:线程和 toast 只能提示任务进度暂时没连上、未生成业务材料、可继续补充或稍后重试;不要显示 `本地后端`、底层异常文本或 `error.message`。
- 新对话前端遇到 SSE `error` 事件或网络异常时仍要保留 `waiting` 状态,清空红色 `agentError` 横条,只把可恢复说明作为 Agent 线程消息;按钮应继续显示 `继续补充`,不能让用户以为这次任务已经终止。
- 同任务 follow-up / 产物续改也必须发业务化 progress,不能只返回最终 result;当前追问续改会依次推送 `识别任务 / 核对资料 / 拆解任务 / 生成材料 / 检查结果 / 完成`。
- 同任务 follow-up / 产物续改的最终助手消息也必须保留可展开的 `本次操作记录` 和 `同任务追问处理过程`,让用户回看时能看到这次补充如何沿用当前产物、拆解要求、生成修订和检查结果;不能只在流式运行中短暂显示进度。
- 同任务 follow-up 如果当前产物类型不能直接续改,必须返回 `waiting / needs-input-followup`,提示用户提供可编辑的邮件、表格或跟进计划要求;不能把未生成修订产物的情况标成完成。
- 同任务 follow-up 的最终用户可见消息不能出现 `前端 / 日志 / 脚本 / run log / manifest` 等内部实现词;上一轮依据要翻成业务口吻,例如“已沿用当前线程里的产物和上下文继续处理”。
- 同任务 follow-up 要能把用户补充转成真实可用内容,不能只记录“用户要求”。例如当前产物是带 `7天跟进节奏` 的 `客户推进分析.md` 时,用户补 `把第1天/第3天话术写成英文 WhatsApp 和邮件两版`,后端应在同一 Markdown 里追加对应天数的 WhatsApp 和 Email 草稿,包含 Subject 和产品语境;用户补 `第5天` 或 `Day 5` 也应生成对应话术,不能只支持第1/3/7天;这仍只是草稿,不会自动外发。
- 渠道草稿和外发动作必须区分:用户说 `WhatsApp / 邮件 / Email` 不等于要发送;如果同时出现 `话术 / 文案 / 草稿 / 两版 / 写成` 这类版本编辑词,应按同任务 follow-up 续改当前产物。只有明确说 `发给客户 / 发送给买家 / 外发 / 直接发 / 发到客户 / 然后发送 / 然后发客户 / send it / send now` 时,才进入外发确认。`用于开发客户` 这类业务用途不是外发动作,不能因为包含 `发客户` 三个字就误拦。
- 同一线程同一时刻只能有一个明确等待原因:如果缺资料 pending task 的补充已经足够、但同一句又包含外发/付费/保存/导出等风险动作,应先清掉 `pendingTask`,再创建 `pendingConfirmation`;确认卡里的 `originalText` 保存原任务和本次补充的合并文本。前台不能同时认为“缺资料”和“等待确认”都在挂起。
- 最近任务历史也要区分等待原因:`confirmation-required + waiting` 显示 `等待确认`;`needs-input / needs-input-followup + waiting` 才显示 `等待补充`。不要只看 `status=waiting`,否则用户会把导出/外发确认误解成还缺业务资料。
- 普通新任务成功执行的公开主进度必须从 `识别任务` 开始,然后是 `核对资料 / 拆解任务 / 生成材料 / 检查结果`;checkpoint 续跑成功执行的公开主进度必须从 `继续执行` 开始,不能只在折叠活动流里出现任务识别或续跑状态。
- 对外 Agent payload 会先净化:前台接口只返回 `taskTitle`、业务化进度、消息、产物摘要和上下文摘要,不暴露 `goal/loop/plan/skillId/runId/mode`、真实 `outputPath/manifestPath` 或 `goal.classify/action.execute` 这类内部 runtime 名。
- 即时 Agent result 只返回助手消息;用户消息由前端用用户原始输入本地追加。后端为了续接任务拼出的 `产出类型: ...；补充资料: ...` 这类内部恢复文本不能进入公开 result messages,否则前台会像在展示系统拼接记录而不是自然 agent thread。刷新恢复时再从 session store 返回真实用户消息。
- 业务产物本身也不能泄露内部恢复文本:Markdown 里的 `任务来源 / 用户目标 / 用户补充` 应还原成自然业务资料,不能出现 `产出类型`、`补充资料`、`原始需求` 这类 Runtime 拼接痕迹。比如缺产品等待后,用户补 `产品太阳能路灯，发给客户`,确认只生成草稿后,`询盘回复草稿.md` 的任务来源应类似 `客户问MOQ和交期，帮我回一下；产品太阳能路灯，发给客户`。
- `GET /api/agent/session/:sessionId` 是前台恢复接口,也必须返回净化 session;后端 session 文件可以保留真实路径和 pendingConfirmation,但 HTTP 恢复 payload 不返回这些内部执行字段。
- `server/agent-artifact-preview.mjs` 和 `GET /api/agent/session/:sessionId/artifact`:只允许预览当前 session 绑定的 `workbench/artifacts/` 产物;Markdown 草稿/客户分析可在前台线程内打开,XLSX 返回工作簿摘要。
- 产物预览 payload 的 `name` 也必须净化;历史 session 里即使保存了 `quotation-sheet-skill-runtime-...xlsx` 这种内部 basename,前台查看文件时也只能显示 `报价单.xlsx`、`修订版表格.xlsx` 等业务化名称。
- Markdown 业务产物预览必须把 Runtime 的 `validation.evidence` 转成安全的 `quality` 摘要,前台显示 `依据检查 / 已覆盖 / 待复核` 和已核对的业务事实;事实必须先收敛成 `product / market / concern / quantity / price / trade_term / payment / sample / next_action` 这类业务白名单结构,不能直接渲染自由字符串。不能暴露 validation 原文、runId、run_id、checkpoint、outputPath、output_path、本地路径、schema、JSON、tool call、tool_call、toolCall 或 `workbench/artifacts`。
- XLSX 的 `查看文件` 不能只提示“表格文件已生成”;预览 payload 至少要包含工作表数量、sheet 名、行数和列数,让用户能在 agent thread 里确认真实产物结构。
- 前台收到 XLSX workbook 摘要后要渲染为结构化工作表列表,不是把所有 sheet 信息塞进一段长提示里。
- 产物预览接口只返回内容、文件名、类型、大小和预览提示,不返回真实本地路径。
- 新对话产物预览失败时也必须留在业务语言里:只提示文件暂时无法预览、原文件未改动、可稍后重试或重新生成;不要把 `payload.error`、底层异常或本地路径展示给用户。
- `agent-thread-prototype` 的产物卡现在是真按钮:点击 `查看` 会读取后端预览接口,在当前线程展示 Markdown 内容或文件摘要;点击 `导出` 会向同一条 Agent 线程发送 `导出文件`,先进入导出确认,不会前端直接下载或复制文件。Agent 正在执行时,产物卡的查看和导出按钮都要禁用,避免并发触发同一线程动作。
- `server/agent-artifact-export.mjs`:导出确认后才会把当前 session 产物复制到 `workbench/exports/<sessionId>/`;未确认时只返回确认卡,不会生成导出副本。用户说 `下载文件`、`下载`、`导出`、`保存一下到桌面`、`保存当前文件到桌面` 或 `保存一下并下载文件` 也属于导出意图,不能当成普通追问、客户档案保存或泛泛任务。
- 空线程不能直接导出或保存:如果当前 session 没有 artifact,用户说 `导出文件` 或 `保存到客户档案` 时返回 `needs-input`,提示先生成或选择业务产物,不能弹确认卡假装可执行。这类空副作用请求也不能创建 pending task;用户下一句给出完整业务任务时,应按干净的新任务执行,不能把 `导出文件`、`保存一下` 拼进任务来源或生成内容。
- 首轮完整业务任务里如果同时带 `保存一下` 或 `导出文件`,后端必须先生成安全业务产物,再停在保存/导出确认。比如 `帮我生成报价单并导出文件，产品太阳能路灯，数量500套，单价USD 35，FOB Shanghai` 应先生成 `报价单.xlsx`,随后进入 `导出文件前需要确认`;如果同一句缺数量、单价或贸易条款,则继续追问缺失字段,不能提示“还没有可导出的业务产物”。
- 旧线程已有 artifact 时也要先判断本轮是不是新的业务产物任务:如果用户说 `帮我生成报价单并导出文件...` 或 `帮我生成报价单并保存一下...`,不能因为 session 里挂着旧 `客户推进分析.md` 就直接确认导出/保存旧文件;必须先生成本轮新的 `报价单.xlsx`,再进入导出/保存确认。只有 `导出文件`、`导出报价单`、`导出一份报价单`、`保存当前`、`保存当前文件`、`把当前报价单写入客户档案` 这类纯当前产物动作才直接对当前 artifact 弹确认。
- 缺资料等待态里如果用户补资料时顺手说 `保存一下` 或 `导出文件`,后端必须先判断补充后原 pending task 是否已经能生成安全业务产物。资料已足够时,先沿用原始任务生成草稿、分析或表格产物,再进入保存/导出确认;资料仍不够时才返回 `needs-input-followup` 并保留原 pending task。不能因为保存/导出的前置条件不满足,就把 `客户问MOQ和交期，帮我回一下` 这类原始任务丢掉或改成一条全新的保存请求。
- 如果同一轮里先生成了安全产物、随后因为保存/导出进入确认等待,SSE 公开进度必须过滤本轮 Runtime 的 `run.completed`,最后以 `核对权限 / 等待确认` 收束。前台不能先显示“完成”再显示“等待确认”,否则用户会误以为副作用动作已经执行或任务状态来回跳。
- 同一轮先生成产物再等待保存/导出确认时,最终助手消息里的「本次操作记录」也必须在 `检查结果` 后追加第二次 `核对权限`,再进入 `等待确认`。不能只修流式进度,否则用户回看线程时会像是检查结果后突然要求确认。
- 导出后的 artifact 会写回 session context,所以导出文件也能继续通过 `GET /api/agent/session/:sessionId/artifact` 预览。
- 保存、外发、导出这类口语动作必须优先识别为风险/确认动作,不能被同任务追问吞掉。用户说 `保存一下`、`保存当前`、`保存当前文件`、`保存起来` 时,没有当前产物就提示先生成可保存材料;已有产物就进入 `写入客户档案前需要确认`。只有保存表达里明确带 `桌面`、`下载` 或 `导出` 时才走导出确认。
- 外发确认不是绕过资料 gate 的通行证:用户说“发给客户”“发给德国客户”“发送给这个买家”“发到某个采购商”等带外发含义的说法时先停在确认卡;确认“先生成草稿”后,如果原始请求仍缺客户、产品或目标市场,继续返回 `needs-input`,不生成泛泛开发信。
- 外发确认后必须保留原始业务意图:如果原始请求是 `客户发来询盘,帮我回一封邮件发给客户,产品太阳能路灯`,确认 `先生成草稿` 后应生成 `询盘回复草稿.md`,不能因为确认动作里出现“邮件/草稿”就改路由成 `开发信草稿.md`。
- 外发确认后如果原始请求是在续改当前产物,必须回到同一份 artifact 继续处理。例如当前已有 `客户推进分析.md`,用户说 `把第1天话术写成英文 WhatsApp 和邮件两版，然后发送` 时先进入外发确认;确认 `先生成草稿` 后应在当前 `客户推进分析.md` 里追加 Day 1 WhatsApp/Email 草稿和外发前确认提醒,不能改路由成新的 `开发信草稿.md`,也不能丢失当前产物上下文。
- 缺资料等待态里补充的话如果带外发动作,也必须先停在外发确认,并且确认后继续原来的 pending task。比如先说 `客户问MOQ和交期，帮我回一下` 后,系统追问产品资料;用户补 `产品太阳能路灯，发给客户` 时应先返回 `外发前需要你确认`;确认 `先生成草稿` 后仍生成 `询盘回复草稿.md`,不能丢掉上一轮客户问题或改成开发信。
- 确认等待态要听懂自然口语:用户说 `可以，先生成草稿`、`好的，确认导出` 这类带确认前缀且包含当前动作的话,应视为确认;用户说 `先不要生成草稿`、`不用导出文件` 这类否定当前动作的话,应视为取消。不能因为一句话里包含 `生成草稿` 就把否定句误当确认,也不能把 `不要太正式`、`不要写成草稿格式，正式一点` 这类内容调整误当取消。
- 用户把确认和补资料写在同一句里时,补充资料必须进入同一次恢复任务。例如 `可以，产品是太阳能路灯，先生成草稿` 应确认外发前只生成草稿,同时把 `产品是太阳能路灯` 并入本次询盘回复任务,不能确认后又追问产品资料。
- 外发、付费或 runtime policy 确认期间,用户补充客户/产品/询盘信息只能记录进 pending confirmation supplements,不能清掉确认卡或执行风险动作;之后确认时用原始请求 + supplements 生成可检查草稿或继续运行。
- 导出文件、保存到客户档案确认期间,如果用户改成“继续优化/调整内容”,则取消本次确认并进入同任务 follow-up,不能误当成确认,也不能导出或写入。
- 用户明确取消导出、保存、外发或付费确认时,只取消该风险动作,不能清掉当前 artifact 或任务上下文;下一句“继续优化/调整”仍应按同一任务续改。
- Runtime policy 层返回 `customer.write_memory`、`artifact.export_file` 或 `paid_api.call` 等确认卡时,也遵守同一条上下文规则:确认卡可以等待,但当前业务产物不能从 response、session context 或取消后的 context 里消失。
- 前台确认卡只能让最新待确认动作可点击;确认、取消或后续消息出现后,历史确认卡必须显示为已处理状态,不能继续露出可执行按钮。
- 确认卡的展示文案和点击后回传给 Agent 的文案必须分开:展示字段可以被净化或降级成 `确认继续`,但按钮点击时要使用公开 payload 里的安全 `confirmActionText / cancelActionText`,例如导出回传 `确认导出`,写入客户档案回传 `确认写入`,外发草稿回传 `先生成草稿`。不要把 `confirmation.type` 暴露给前台,也不要把净化后的 fallback 当作真实确认动作传回去。
- 确认卡按钮不能显示路径清洗后的占位词,例如 `当前任务文件.xlsx`、`取消 当前任务文件.json`。后端公开 payload 和前端确认卡按钮兜底都要把这类按钮降级为 `确认导出 / 确认写入 / 确认继续 / 取消这一步 / 取消` 这类自然动作文案,避免新对话看起来像文件系统或工具台;前端不要把该占位词做成所有文案的全局替换规则,以免误伤普通业务说明。
- 新对话线程必须自动跟随最新进展:用户消息、Agent 消息、流式进度和产物预览出现时,视图应滚到当前任务位置,避免用户手动找“现在进行到哪一步”。
- 新对话 `引用资料` 不能是空按钮:第一阶段支持选择 `.txt/.md/.csv` 文本资料,把内容以 `引用资料：` 的自然语言块追加进当前输入框并随下一次任务一起发送;单份资料会截断在前 6000 字符并提示已截断。不支持的 PDF/XLSX 等文件必须提示先转成 `txt/md/csv` 或直接粘贴关键内容,不能把二进制内容塞进输入框,也不能假装已经解析。
- 风险动作确认也必须有过程感:外发、保存、导出和扣费类请求在返回确认卡前,流式进度和最终助手消息都要包含 `识别任务 / 核对权限 / 等待确认`。
- 即使用户在自然语言里写了“调用付费数据”“扣费也可以”,新对话也必须先进入 `付费能力需要你确认` 的等待态;确认前不能调用付费能力,前台运行中提示也要持续明确包含导出、保存、外发、扣费都会停下来问,不能因为流式进度出现就消失。
- 付费/扣费识别只针对平台能力或外部收费工具,例如 `收费接口`、`付费接口`、`花钱也可以`、`消耗额度/积分/点数`、`购买套餐/积分/额度`、`买套餐/积分/额度`、`订购额度`。外贸客户的采购意向不是平台扣费动作,例如 `客户说想购买500套太阳能灯` 应继续进入客户推进分析,不能因为出现 `购买` 就弹付费确认。
- 付费确认不是任务终点:用户确认 `确认继续` 后,后端必须用原始请求和确认期间 supplements 继续匹配业务任务;资料足够时继续生成客户分析、邮件草稿、报价单等产物,资料不足时回到 `needs-input`。不能只回复一句“已确认”就结束。
- `server/agent-customer-memory.mjs`:写入客户档案确认后,只把当前 session 绑定产物的摘要写入 `workbench/customers/<customerSlug>/memory.md`,并追加 `diary/agent-saves.jsonl`。`customerSlug` 必须来自当前客户上下文或用户明确补充;没有客户绑定时必须继续追问写入哪个客户档案,不能默认写入 `global-sourcing-inc`。
- 保存确认成功后会清掉 `pendingConfirmation`,但保留 artifact、customerSlug 和 lastCustomerSave;用户再补一句「继续优化」会进入同任务 follow-up,不会重复保存。
- 保存确认成功后的公开 `context.lastCustomerSave` 只能包含客户标识和可读摘要,不能把 `memoryPath`、`diaryPath`、`memory.md`、`agent-saves.jsonl` 或任何本地绝对路径返回给前台;后端 session 文件和内部日志可以保留排查用路径,但 HTTP result、SSE result 和 session 恢复 payload 必须净化。
- 保存、导出、外发等确认卡标题只是暂停点标题,不能污染业务任务标题。比如 `客户推进分析.md` 生成后用户说 `保存到客户档案`,确认卡可显示 `写入客户档案前需要确认`;用户确认写入后,即时 result 和 `GET /api/agent/session/:sessionId` 恢复标题都应回到 `客户推进分析`,不能变成 `本次外贸任务` 或继续停在确认卡标题。

`server/skill-agent.mjs` 现在只负责新对话的任务线程包装、同任务追问和前台响应格式,不再直接写死单个 Alibaba runner。

## 产品定位（作战台 + 三层 + 四件套）

一句话:**外贸业务员 AI 作战台** = Accio 式的"真在帮你干活"的智能 + 一层**轻**客户管理,覆盖 `找线索 → 开发 → 成交 → 客户管理`。

三层结构:

```text
Agent  = 底座(产品本体,保证"智能") —— 第一刀 99% 的活在这层
Skill  = Runtime 可执行任务包,例如 alibaba-inquiry-meeting
Tool   = 底层连接器
客户作战档案 = AI 维护的、偏"判断 + 下一步动作"的档案,不是偏记录的 CRM
```

- **核心对象 = 一个「客户」对象**,联系人、询盘、商机、任务、产出都挂它下面。
- **"底座做得好" = 智能感四件套**:①过程看得见 ②自动用上客户档案/记忆 ③判断有含金量(`deepseek-v4-pro` 深度思考) ④跨任务记得你。智能来自这四件,不来自自主程度。
- 客户界面 Agent = 跟询盘 Agent **同一个底座、不同实例**(自动带该客户档案/记忆 + 打开客户档案时自动 brief 近况和跟进建议),列**第二刀**。
- 最不要变成:普通 Chatbot / 复杂 CRM / 工具集合页 / MCP 控制台。

## Skill 口径修正

```text
赢单 UI 里的「技能Skill」= 用户可见的业务功能分类。
Runtime 里的 Skill = 可执行任务包,有 SKILL.md / openai.yaml / evals / scripts / 产物要求。
```

本轮指定的验收 Skill:

```text
/Users/garden/Coding_Project/SkillCreateSpace/AccioSkillCreate/
  skills-by-category/accio-alibaba/管理/会议与行动闭环/
    alibaba-inquiry-meeting/
```

该 skill 的目标是生成管理层询盘复盘会后 `.xlsx`,不是生成一封询盘回复邮件。

## 当前不做（第一刀）

```text
完整客户 CRM、自动外发(邮件/WhatsApp/站内信)、用户写代码型 Skill、复杂多 Agent、
外部付费工具(ContactOut/Snov.io/Apify → 第二刀)、
SQLite / Electron / MCP / 浏览器插件、diary 压缩、复杂 resume 续跑。
```

注意:阿里/Accio 只读工具不再笼统列为第一刀不做。最终验收必须能使用 `alibaba-inquiry-meeting` 需要的只读数据链路;但仍禁止写入、发送、发品、上传、扣费和泄漏内部鉴权细节。

## 推荐技术栈

第一刀(已拍死,见 `BUILD_SPEC.md`):

```text
前端：React/Vite 本地网页
后端：Node/Express 本地小服务(localhost),调模型 + 读写文件 + 跑 Runtime + 查 policy + 调度外部 skill 脚本
数据：文件优先,workbench/{agents,customers,skills,registry,runs,artifacts}
模型：DeepSeek V4,统一入口 callModel,Key 只在后端 .env
脚本：外部 skill 自带 Python builder,例如 build_inquiry_meeting_xlsx.py
```

后置(第二刀及以后,第一刀不碰):

```text
Electron 桌面壳、SQLite 索引层、Python 工具进程(PDF/XLSX/OCR)、
产品化阿里官方 API、MCP 插件中心、浏览器插件联动、Native Messaging
```

非技术解释:

- `React/Vite`:先把界面、流程、状态跑顺,不急着打包桌面软件。
- `Node/Express 本地后端`:躲在后面的小服务,藏 API Key、读写文件、跑 Runtime。不是 Electron,不打包,只在 localhost。
- `文件优先`:第一版事实来源是 `workbench/` 下的目录和 jsonl,SQLite 以后只做搜索索引。
- `Skill / Schema`:系统内部契约,由赢单预设模板、外部 Skill 包和开发者维护,不让业务用户手写 JSON。

## 当前 Runtime 方向

总架构以 `RUNTIME_ARCHITECTURE.md` 为准,第一刀落地以 `BUILD_SPEC.md` 为准。定位:

```text
像 Accio 的骨架,不像 Accio 的平台工程黑洞
像外贸业务工具,不像开发者控制台
```

关键边界:

- `policy.jsonl` 是唯一硬执行来源,`persona.md` 红线只是提醒。
- `Agent Assembler` 固定组装顺序以 `RUNTIME_ARCHITECTURE.md` 为准:system/product rules、persona、playbook、当前 Skill contract、allowedActions/tool summaries、policy summary、客户 profile/memory、diary summary、checkpoint summary、当前输入和 evidence budget。
- 普通 Agent 不直接加载所有外部工具;外部能力封装进 Skill,运行时只展开当前 Skill 的动作空间和工具摘要。
- 自主程度 = **受控的 C**:最小 Runtime loop,但只读自动、付费/写入卡确认、有步数上限;不是放开让模型自主决定。
- DealOps Runtime Loop v2 的状态用 `running / waiting / resuming / completed / failed / cancelled`,用 `phase` 表示 `preflight / assembling_context / planning / executing / validating / committing`。
- 下一步最小 `waiting/resume/checkpoint`:先覆盖导出确认、工具授权、预算确认、bridge 不可用和用户补充信息;resume 后不能重跑已完成 adapter phase。
- Evidence Ledger 是进入交付前的门槛:关键判断、关键 sheet 行和下一步动作必须有来源、可信度、覆盖度、缺口和新鲜度。
- Typed Evaluator 已先覆盖 `alibaba-inquiry-meeting` 真实 XLSX 链路的最小门槛:builder validation、evidence ledger 分区、字段完整性和内部词泄漏;后续再扩到更细的 sheet 行级检查。
- 客户 memory 控量;`run_id` 用时间戳 + 随机后缀,不用每日序号。
- 当前最终验收锚点是 `alibaba-inquiry-meeting`:读取外部 skill 包、发现并调用只读 Alibaba 工具、生成主持材料 JSON、调用 XLSX builder、写 artifact、manifest 和内部 evidence ledger。
- 当前真实执行入口分两层:
  - 命令行验收: `server/alibaba-real-runner.mjs` 和 `npm run acceptance:alibaba-inquiry-meeting:real`。
  - 前台验收:「新对话」输入 `帮我开上周询盘分析会`,调用 `POST /api/agent/message`,自动匹配 `alibaba-inquiry-meeting`,生成一个业务化任务线程。内部 Session ID 可以存在,但默认不要暴露给业务用户。
- 前台不是一次性任务执行面板:
  - 首次执行会生成用户消息、Agent 消息、折叠的「本次操作记录」和 XLSX 产物卡。
  - 点击「本次操作记录」后看到业务化节点:识别任务、核对资料、生成材料、检查结果、等待确认。
  - 后端第一刀目前按 `goal.classify → skill.match → plan.create → skill.execute → artifact.verify → finish` 执行有界 loop;v2 目标是升级为 `preflight → assemble_context → planning → executing → validating → committing`。
  - 同一次任务继续追问时只追加 Agent 回复,不重新采集 Alibaba 只读数据。
- builder-only smoke 只用于证明外部 XLSX builder 可用,不算最终验收。

前台必须隐藏或翻译这些内部词:`Runtime`、`Tool call`、`MCP`、`Trace`、`Prompt`、`Token`、`policy scope`、`Session ID`、`profile/memory`、`alibaba-inquiry-meeting`、底层模型名。业务用户只看到客户、询盘、产品资料、历史跟进、依据、缺口、风险、下一步、待确认和具体交付物。

## 当前模型选择（已对官方核实）

```text
主模型：deepseek-v4-pro    快模型：deepseek-v4-flash
base_url：https://api.deepseek.com   (OpenAI 兼容)
开思考：extra_body {"thinking":{"type":"enabled"}}    reasoning_effort：max(合法值 high/max)
API Key：DEEPSEEK_API_KEY,只在后端 .env,前端永远拿不到
```

- 没有 Key 时页面显示「模型未配置」,不假装成功;演示数据必须标 `demo=true`。

## 和现有赢单的关系

- 普通 chatbot / 场景问答 → 继续调赢单现有后端接口,界面统一叫 `赢单外贸顾问`,不叫 Chatbot。
- Agent / Skill / 工具能力 → 在作战台新增,避免重复建设。

## 和 Accio 的关系

可借鉴:文件化 Agent 定义、tool registry、本地 trace、执行过程可见、左对象列表+中线程+右上下文的布局。
不能照搬:Accio 私有 runtime / 权限体系、把内部 bridge、token、DID、网关密码暴露给用户。

## 阿里 / Accio 边界（脱敏）

- 第一刀的最终验收需要能执行 `alibaba-inquiry-meeting` 所需的阿里只读数据链路。
- 产品化版本仍应走阿里国际站开放平台官方 API;本地 bridge 只能作为内部验证路径。
- 文档和代码里不暴露真实 Token、Cookie、账号密钥、DID;entitlement 值只能从环境变量读。

## 客户档案（原"客户Kass"）当前边界

作为 Agent 任务的客户上下文容器,不做完整 CRM。原型已表达:客户等级(A/B/C)分组 + 客户列表 + 客户详情(对话线程 / 详情档案 / 事项 / 任务记录,任务记录并入客户详情,不再是左侧一级入口)。

## 当前文件说明

```text
AGENTS.md              助手工作规则和项目背景
CONTEXT.md             上下文和技术方向(本文件)
DEV_LOG.md             开发/文档变更记录
RUNTIME_ARCHITECTURE.md 总架构(第二刀以后蓝图也在这)
BUILD_SPEC.md          第一刀执行规格(alibaba-inquiry-meeting 验收,给 Codex 照着做)
agent-thread-prototype/ React/Vite UI 原型,含 6 入口多视图
agent-thread-prototype/src/agentThreadComposerState.js 新对话确认/补资料等待态的输入区文案状态机
server/alibaba-skill.mjs 外部 alibaba-inquiry-meeting skill 包识别和 XLSX builder 调用适配
server/alibaba-real-runner.mjs 真实 Accio/Alibaba 只读工具采集、主持材料 JSON 和 real-bridge 验收执行器
server/skill-registry.mjs 通用 Skill 注册表加载和目标匹配
server/skill-runner.mjs 通用 Skill Runtime loop、policy、adapter 调度、run log 和产物校验
server/skill-adapters/alibaba-inquiry-meeting.mjs alibaba-inquiry-meeting 第一个 adapter
server/artifact-validator.mjs XLSX Runtime 级安全校验
server/agent-session-store.mjs 新对话 session 文件恢复和消息/上下文持久化
server/agent-message-stream.mjs Runtime 事件到前台 SSE progress 的业务化翻译
server/agent-artifact-preview.mjs 当前 session 产物预览读取
server/agent-artifact-export.mjs 确认后复制当前 session 产物到 exports
server/agent-artifact-revision.mjs 同一 session Markdown/Text 产物的安全续改
server/agent-customer-memory.mjs 确认后写入客户 memory 和 diary
server/skill-agent.mjs 新对话任务线程、业务化操作记录/产物响应和同任务追问封装
server/index.mjs 本地 Runtime API,含 POST /api/agent/message
server/acceptance-alibaba-inquiry-meeting-real.mjs 真实验收命令入口
```

> `PLAN.md` / `TODO.md` / `RUNTIME_IMPROVEMENT.md` 已于 2026-06-27 删除(旧大计划与过程稿,内容并入上述文档)。

## 怎么本地跑通和验证

原型 UI:

```text
进入 agent-thread-prototype/ → npm run build → 打开本地预览
确认左侧有:新对话、赢单外贸顾问、我的Agent、技能Skill、外接生态、客户Kass
```

当前 builder-only smoke:

```text
npm run smoke:alibaba-inquiry-meeting
→ 读取真实 alibaba-inquiry-meeting skill 包
→ 用业务化 fixture payload 调用 build_inquiry_meeting_xlsx.py
→ 在 workbench/artifacts/alibaba-inquiry-meeting-smoke/ 产出 XLSX 和 manifest
```

通用 Runtime 单元验收:

```bash
npm test
```

其中 `server/skill-runtime.test.mjs` 证明:

```text
registry 文件 + skill 目录会合并
自然语言和明确命令都由 registry 匹配
自然语言路由能区分“询盘分析会”和“帮我回客户”这两类相近意图
新增 supplier-brief 这类轻量 Skill 后,不改主 Runtime 逻辑也能执行、写日志、校验产物
```

真实验收命令:

```bash
npm run acceptance:alibaba-inquiry-meeting:real
```

真实前台验收:

```text
启动后端: npm start
启动前端: cd agent-thread-prototype && npm run dev -- --host 127.0.0.1 --port 5176
打开 http://127.0.0.1:5176/
在「新对话」输入: 执行Skill：alibaba-inquiry-meeting
或输入: 帮我开上周询盘分析会
点击「开始对话」
页面应显示 Agent 任务线程、询盘复盘会材料回复、XLSX 文件名和本地路径
自然语言目标路径下,内部自动匹配 alibaba-inquiry-meeting,前台默认不展示 skill slug
点击 Agent 消息里的「本次操作记录」应展开业务节点:普通成功路径通常是识别任务、核对资料、生成材料、检查结果;保存、导出、外发或付费确认路径才会继续出现核对权限、等待确认
操作记录每一步应来自真实 Runtime 事件,不是执行结束后拼静态文案
继续输入追问后,页面应沿用同一次任务,并提示不会重新采集 Alibaba 只读数据
流式接口验收: `POST /api/agent/message/stream` 应先返回多段 progress;普通新任务首个可见步骤必须是 `识别任务`,例如 识别任务、确认任务类型、核对资料、拆解任务、生成材料、检查结果,最后返回 result;checkpoint 续跑首个可见步骤必须是 `继续执行`,不能先闪现 `识别任务`;旧 pending session 里用户明确说 `重新开始 / 新任务 / 从头开始` 时,首个可见步骤必须重新回到 `识别任务`
普通成功 result 的 `progress` 和助手消息 `process.steps` 应包含 `识别任务 / 核对资料 / 拆解任务 / 生成材料 / 检查结果`,并保留用户可见中文 `phase` 标签用于前台回看
对外 payload 验收:普通 JSON、SSE result、session 恢复和 artifact preview 不应包含 `goal/loop/plan/skillId/runId/mode` 顶层字段,也不应包含 `outputPath/manifestPath`、`memoryPath/diaryPath`、`memory.md/agent-saves.jsonl`、`skill-runtime`、`goal.classify/action.execute/artifact.verify` 这类内部名或本地绝对路径
历史列表验收:`GET /api/agent/sessions` 应按 updatedAt 倒序返回最近任务摘要;前台 `历史` 面板显示 `最近任务`,可点击恢复对应线程;列表和恢复 payload 不展示本地路径、runId、checkpointPath、runLogPath 或 outputPath
```

新对话缺资料 gate 验收:

```text
输入: 写一封开发信
→ 返回 needs-input / waiting,不返回产物
→ 追问客户名称或客户类型、产品或核心卖点、目标市场或客户所在国家
→ SSE progress 和最终助手消息都包含 识别任务、核对资料、等待补充
同一个 session 输入: 客户是德国采购商，产品是太阳能路灯，重点问MOQ和交期
→ 返回 开发信草稿.md
直接输入: 写一封开发信给德国采购商，产品是太阳能路灯，重点问MOQ和交期
→ 返回 开发信草稿.md
输入: 客户是德国采购商，帮我做客户分析
→ 返回 needs-input / waiting,任务标题为 客户推进分析,追问 询盘、聊天记录或当前卡点
输入: 客户是德国买家，帮我做客户分析
→ 返回 needs-input / waiting,不能把“买家”里的“买”当成客户采购意向
同一个 session 输入: 他问MOQ和交期，产品是太阳能灯
→ 返回 客户推进分析.md
输入: 帮我判断这个客户优先级
→ 识别为 客户推进分析,但先追问客户名称或客户类型、询盘/聊天记录/当前卡点
输入: 客户是德国采购商，有个询盘，帮我做客户分析
→ 返回 needs-input / waiting,不能生成空泛客户分析
输入: 客户说价格太高，帮我想下一步怎么谈，产品太阳能路灯
→ 返回 customer-followup-plan 和 客户推进分析.md,产物应包含价格异议和太阳能路灯
输入: 客户已读不回，产品是家具，帮我做一个7天跟进计划
→ 返回 customer-followup-plan 和 客户推进分析.md,产物应包含 `客户关注点: 客户沉默/未回复` 和按第1天、第3天、第5天、第7天拆开的 `7天跟进节奏`
输入: 客户已读不回，帮我做一个7天跟进计划
→ 返回 needs-input / waiting,任务标题为 客户推进分析,只追问 产品或核心卖点
同一个 session 输入: 产品是家具
→ 返回 customer-followup-plan 和 客户推进分析.md,产物应包含 `7天跟进节奏`
输入: 客户想做独家代理，产品是灯具，怎么谈
→ 返回 customer-followup-plan 和 客户推进分析.md,产物应包含 `客户关注点: 独家代理/渠道合作`、区域边界、销量承诺、价格体系和试运行条件
输入: 客户想做独家代理，怎么谈
→ 返回 needs-input / waiting,任务标题为 客户推进分析,只追问 产品或核心卖点
同一个 session 输入: 产品是灯具
→ 返回 customer-followup-plan 和 客户推进分析.md
输入: 客户想购买500套太阳能灯，帮我做下一步推进计划
→ 返回 customer-followup-plan 和 客户推进分析.md,产物应包含 `客户关注点: 采购意向/购买意向`、`产品: 太阳能灯` 和 `数量: 500套`
输入: 客户想买套餐，帮我做下一步推进计划
→ 返回 confirmation-required / waiting,标题为 付费能力需要你确认,不能生成客户推进分析
输入: 写一封开发信给德国渠道代理
→ 返回 needs-input / waiting,任务标题为 开发信草稿,只追问 产品或核心卖点,不能把“渠道代理”当成产品
输入: 客户发来询盘，帮我回一封邮件，产品太阳能路灯
→ 返回 inquiry-reply-draft 和 询盘回复草稿.md
输入: 客户问MOQ和交期，帮我回一下
→ 返回 needs-input / waiting,任务标题为 询盘回复草稿,只追问 产品资料或报价边界
同一个 session 输入: 产品太阳能路灯
→ 返回 inquiry-reply-draft 和 询盘回复草稿.md
→ 后端旧 run log 追加 run.resumed、action.executed、artifact.verified;SSE 进度包含 继续执行、生成材料、检查结果
输入: 客户要报价，帮我做报价单
→ 返回 needs-input / waiting,任务标题为 报价单,追问 产品资料、数量、单价或报价区间、币种和贸易条款
输入: 客户问报价，产品太阳能路灯，数量500套，帮我做一份报价单
→ 返回 needs-input / waiting,任务标题为 报价单,只追问 单价或报价区间、币种和贸易条款
同一个 session 输入: 单价20美元，FOB深圳
→ 返回 quotation-sheet 和 报价单.xlsx
→ 预览接口显示 2 个工作表: 报价单、待确认项
输入: 帮我做PI，太阳能路灯500套，35美金，FOB上海
→ 返回 quotation-sheet 和 报价单.xlsx,报价单行级字段应包含 `产品=太阳能路灯`、`数量=500套`、`单价/报价=35美金`、`贸易条款=FOB上海`
输入: 客户问报价，产品太阳能路灯，数量500套，单价20美元，FOB深圳，帮我做报价
→ 返回 quotation-sheet 和 报价单.xlsx
输入: 客户问报价，产品太阳能路灯，数量500套，单价20美元，FOB深圳，帮我报价给德国客户
→ 返回 quotation-sheet 和 报价单.xlsx,不自动外发
输入: 帮我生成报价，产品太阳能路灯，数量500套，单价20美元，FOB深圳
→ 返回 quotation-sheet 和 报价单.xlsx
输入: 帮我写报价邮件，客户是德国采购商，产品太阳能路灯，数量500套，单价20美元，FOB深圳
→ 返回 cold-email-draft 和 开发信草稿.md
输入: 把报价发给德国客户，产品太阳能路灯，数量500套，单价20美元，FOB深圳
→ 返回 confirmation-required / 外发前需要你确认,不生成外发副作用
输入: 客户发来询盘，帮我回一封邮件发给客户，产品太阳能路灯
→ 返回 confirmation-required / 外发前需要你确认
同一个 session 输入: 先生成草稿
→ 返回 confirmation-accepted 和 询盘回复草稿.md,不会改成开发信草稿
```

新对话确认动作接口验收:

```text
输入: 客户是德国采购商，询盘问MOQ和交期，做下一步推进计划
→ 返回 customer-followup-plan 和 客户推进分析.md
输入: 保存到客户档案
→ 返回 confirmation-required / customer_write,只显示确认卡,不立刻写入
输入: 保存一下
→ 如果当前已有业务产物,返回 confirmation-required / customer_write;如果还没有产物,返回 needs-input,提示先生成客户分析、跟进计划或邮件草稿
输入: 保存当前文件
→ 如果当前已有业务产物,返回 confirmation-required / customer_write,不能误判为导出
输入: 确认写入
→ 如果当前线程已有明确 customerSlug,追加 workbench/customers/<customerSlug>/memory.md 和 diary/agent-saves.jsonl
→ 如果当前线程没有明确 customerSlug,继续等待用户补充客户档案名称或客户标识,不能默认写入 global-sourcing-inc
→ 真正写入成功后 session context 不再保留 pendingConfirmation;如果还缺客户档案目标,则继续保留 pendingConfirmation 等待补充
→ 公开 result 和 session 恢复 payload 里的 lastCustomerSave 只保留 customerSlug 和 savedSummary,不暴露 memoryPath、diaryPath、本地绝对路径、memory.md 或 agent-saves.jsonl
→ 即时 result.taskTitle 和 GET /api/agent/session/:sessionId 恢复标题仍为 客户推进分析,不能变成 本次外贸任务 或 写入客户档案前需要确认
输入: 继续优化一下下一步动作
→ 返回同任务 follow-up,不会重复写客户 memory
输入: 导出文件
→ 返回 confirmation-required / export_file,只显示确认卡,不立刻复制文件
输入: 下载文件
→ 如果当前已有业务产物,返回 confirmation-required / export_file,只显示确认卡;如果还没有产物,返回 needs-input,提示先生成或选择要导出的文件
输入: 保存一下到桌面 / 保存当前文件到桌面 / 保存一下并下载文件
→ 如果当前已有业务产物,返回 confirmation-required / export_file;如果还没有产物,返回 needs-input,提示先生成或选择要导出的文件
输入: 继续优化一下，语气更礼貌
→ 返回同任务 follow-up,不会生成 exports 文件
空线程输入: 导出文件 / 保存到客户档案
→ 返回 needs-input,提示还没有可导出或可保存的业务产物
输入: 把这封开发信发给客户
→ 返回 confirmation-required / external_send,不会外发
→ SSE progress 和最终助手消息都包含 识别任务、核对权限、等待确认
输入: 先生成草稿
→ 如果仍缺客户、产品或目标市场,返回 needs-input,不会生成泛泛开发信
输入: 帮我写一封邮件发给德国客户，产品太阳能路灯，问MOQ和交期
→ 返回 confirmation-required / 外发前需要你确认
同一个 session 输入: 先生成草稿
→ 返回 开发信草稿.md
```

新对话 Markdown 产物续改验收:

```text
输入: 写个 follow up 给德国客户，问 MOQ 和交期
→ 返回 开发信草稿.md
同一个 session 输入: 语气更礼貌一点，加一句可以寄样品
→ 返回 followup,artifact 仍是同一份 开发信草稿.md
→ 预览接口内容包含 本次补充优化、用户补充、sample 句和外发前确认提醒
输入: 客户已读不回，产品是家具，帮我做一个7天跟进计划
→ 返回 客户推进分析.md
同一个 session 输入: 把第1天/第3天话术写成英文 WhatsApp 和邮件两版
→ 返回 followup,artifact 仍是同一份 客户推进分析.md
→ 预览接口内容包含 Day 1 WhatsApp、Day 1 Email、Day 3 WhatsApp、Day 3 Email、Subject 和 furniture
```

新对话 XLSX 产物续改验收:

```text
已有 session 绑定 询盘分析会.xlsx
同一个 session 输入: 按负责人补一列下周动作
→ 返回 followup,artifact 变为 询盘分析会-已续改-*.xlsx
→ 后端 session 指向新的修订版 XLSX,原文件不覆盖
→ 修订版包含原工作表和 本次追问 sheet
→ 本次追问 sheet 包含用户补充和交付提醒
报价单续改输入: 加一列有效期30天
→ 返回 followup,artifact 显示为 报价单-已续改-*.xlsx
→ 公开 result 不包含 quotation-sheet 或 skill-runtime
→ SSE progress 包含 识别任务、核对资料、拆解任务、生成材料、检查结果、完成
→ 公开 result/session/preview 不返回 outputPath、manifestPath、runId、skillId 或 skill-runtime
```

当前已跑通的真实产物:

```text
workbench/artifacts/alibaba-inquiry-meeting-real/alibaba-inquiry-meeting/
  询盘分析会_2026-06-15_2026-06-21.xlsx

workbench/artifacts/alibaba-inquiry-meeting-real/alibaba-inquiry-meeting/
  manifest.json

workbench/artifacts/alibaba-inquiry-meeting-real/
  host-material.json
  raw/<run_id>/*.json

workbench/runs/<run_id>.jsonl
```

最终用户侧真实验收:

```text
输入“帮我开上周询盘分析会”
→ Runtime 识别自然语言目标
→ 内部自动匹配并执行询盘复盘会材料 Skill
→ 当前第一刀按有界 loop 执行 goal.classify / skill.match / plan.create / skill.execute / artifact.verify / finish
→ 发现并调用 Alibaba 只读工具
→ 生成主持材料 JSON
→ 调用 skill 自带 XLSX builder
→ 通过固定 XLSX 安全流程
→ 返回合格 .xlsx 路径,且 run log / artifact / manifest 可追溯
→ 前台保留同一次任务,后续追问基于本次产物继续回答
```

固定命令 `执行Skill：alibaba-inquiry-meeting` 仍作为兼容入口保留；当前首个前台硬验收以自然语言目标 `帮我开上周询盘分析会` 为准。
