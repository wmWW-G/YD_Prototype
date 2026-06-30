# Winco Agent Runtime v0 架构设计

## 1. 最终判断

赢单第一版 Runtime 采用：

```text
Web-first 外贸成交工作台
+ 文件优先的 Accio-like Agent Runtime
+ 运行时组装 Agent
+ DeepSeek V4 Pro / Flash 模型入口
+ policy.jsonl 权限规则
+ append-only runs/*.jsonl 运行记录
+ 客户 memory 一等公民
```

它不是普通 chatbot，也不是一开始造完整 Agent 平台。

核心判断：之前的 9 个后端盒子更像通用 LLM 应用分层，真正值得借鉴 Accio 的，是「agent 目录化、运行时组装、memory、policy、append-only trace」这几件事。

最新框架（2026-06-27 修正）：

```text
Agent = 底座(产品,保证"智能") / Skill = 场景包(可插拔,保证"对路") / Tool = 连接器
赢单 UI 里的市场调研/开发信/询盘分析回复等,属于现有 chatbot 业务入口。
Runtime 验收 Skill = 可执行外部任务包,例如 alibaba-inquiry-meeting。
第一刀验收 = 能执行 alibaba-inquiry-meeting,并产出合格 XLSX。
```

第一刀的落地细节以 `BUILD_SPEC.md` 为准;本文件是总架构和第二刀以后的蓝图。

这里说的“学 Accio Work”，不是让业务用户去理解 JSON、Schema、MCP 或 Tool call。赢单要学的是 Accio 的运行时骨架：能力放在目录和文件里，运行时按需组装，执行过程可追溯，危险动作必须确认。JSON / Schema 只是系统内部契约，由开发者和模板生成器维护；用户侧只看到表单、按钮、业务进度和结果。

## 2. 采纳与保留

### 采纳

- Agent 不用每个都有全局 DID，赢单内部用可读 slug。
- Agent 是一个目录，不只是一条数据库记录。
- Agent 运行时从 `persona.md`、`playbook.md`、工具清单、memory 和当前客户上下文组装。
- 客户 memory 是一等公民，不只是客户档案里的“最近摘要”字段。
- 权限从 L0-L6 概念表落成可执行的 `policy.jsonl` 规则。
- 一次任务优先写 append-only `runs/<run_id>.jsonl`，SQLite 后置为索引层。
- 工具、阿里 bridge、未来 MCP 都收敛到一个工具代理和 `tools.json` registry。

### 保留

- 前台只展示外贸业务语言，后台保留运行骨架。
- 所有高风险动作必须业务化确认。
- 第一版只生成草稿，不自动发送邮件、WhatsApp、LinkedIn 或阿里站内信。
- Web 本地网页先跑顺，Electron 后置。
- 外部 Skill 包可以带自己的脚本、evals 和产物格式，Runtime 要能读取、执行、记录和校验。

### 暂不采纳

- 不做复杂多 Agent 协作。
- 不做完整插件市场。
- 不做官方阿里开放平台接入，第一版只做内部只读验证；产品化版本再走官方 API。
- 不做完整 SQLite 关系库建模，先用文件和 jsonl 跑通闭环。

## 3. 产品目标

第一版先跑通一个可交付 skill 的窄闭环：

```text
用户要求开询盘分析会
-> Runtime 识别 alibaba-inquiry-meeting
-> 读取外部 skill 包的 SKILL.md / openai.yaml / evals
-> 解析周期和输出要求
-> 发现并调用 Alibaba 只读工具
-> 生成管理复盘主持材料 JSON
-> 调用 skill 自带 XLSX builder
-> 通过 XLSX 安全校验
-> 写 run log、artifact 和 manifest
-> 返回 XLSX 路径
```

当前第一刀前台触发语是自然语言目标:

```text
帮我开上周询盘分析会
```

明确命令 `执行Skill：alibaba-inquiry-meeting` 作为兼容入口保留,但不再是唯一硬验收入口。

这个闭环必须证明三件事：

- 赢单不是一个只会回答问题的聊天框。
- Runtime 能执行真实外部 skill，而不是只跑赢单内置 prompt 模板。
- 每次读取 skill、调用模型、调用工具、生成结果、保存产物都有记录。

### 3.1 "底座做得好" = 智能感四件套

长期验收"像不像 Agent"，仍然盯这四件（这是"智能"的来源，**不来自自主程度**）：

```text
1. 过程看得见它在干活：分步业务进度,不是啪一下吐结果。
2. 自动用上客户档案/记忆：真去读了该客户 profile/memory,不是对着输入空想。
3. 判断有含金量：用 deepseek-v4-pro 深度思考,给依据。
4. 记得你：任务结束回写客户记忆,下次同一客户能接上。
```

对 `alibaba-inquiry-meeting` 来说，最朴素的验收尺子变成：**它有没有真的生成老板能看的询盘复盘 XLSX，并且数据缺口、责任动作、复查方式都可追溯。** 只给五段聊天建议 = 不合格。

## 4. 前台和后台分工

### 前台只说外贸业务语言

用户界面应该出现：

```text
客户Kass
我的Agent
技能Skill
外接生态
询盘分析回复
客户背景
产品资料
历史跟进
回复草稿
风险提醒
缺失信息
下一步动作
本次引用资料
本次操作记录
快速分析
深度分析
```

用户界面不要默认出现：

```text
Agent Runtime
Tool call
MCP
Trace
Prompt
Token
Session ID
profile / memory
Skill slug
Model Router
Function calling
policy scope
Audit log
LangGraph
```

技术概念要翻译成业务语言：

```text
tool call -> 正在查看产品资料 / 正在核对客户档案
trace / audit -> 本次操作记录
model routing -> 快速分析 / 深度分析
MCP / bridge -> 已连接资料来源
permission scope -> 可访问资料范围
```

### 后台保留运行骨架

后台必须稳定记录：

```text
agents/<agent_slug>/
customers/<customer_slug>/
registry/tools.json
registry/policy.jsonl
runs/<run_id>.jsonl
artifacts/<run_id>/
```

前台是业务体验，文件和 jsonl 是第一版 Runtime 的事实来源。

## 5. 总体架构

```text
React/Vite Web 工作台
  -> Runtime API
  -> Skill Registry
  -> Skill Runner
  -> Skill Adapter
  -> Agent Assembler
  -> Context + Memory Loader
  -> Model Gateway
  -> Tool Proxy + Registry
  -> Policy Engine
  -> Run Logger
  -> Artifact Writer
```

这张图只表示模块关系，不表示一次性线性流水线。

`Policy Engine` 是贯穿式关卡，不是第 6 步跑一次就结束。每次调用模型、调用工具、写客户 memory、导出文件、外发消息或触发 bridge 前，都必须先过 policy。

### 5.1 通用 Skill Runtime（2026-06-29 已落地）

当前已把 `alibaba-inquiry-meeting` 专线抽成最小通用 Runtime:

```text
Skill Registry
  workbench/registry/skills.json
  workbench/skills/<skill>/skill.json

Skill Runner
  goal.received
  skill.matched
  skill.loaded
  plan.created
  policy.checked
  action.executed
  observation.recorded
  artifact.verified
  run.completed

Skill Adapter
  alibaba-inquiry-meeting adapter
  mock-artifact adapter
```

关键边界:

- `skill-agent.mjs` 不再写死 `alibaba-inquiry-meeting`;它只负责新对话任务线程、前台响应和追问。
- 新增 Skill 优先写 `workbench/skills/<skill>/skill.json` 或注册到 `workbench/registry/skills.json`。
- 具体 Skill 的特殊执行逻辑放 adapter,不要塞回 `skill-agent.mjs`。
- Alibaba real-bridge 仍由 `server/alibaba-real-runner.mjs` 负责,但通过 `server/skill-adapters/alibaba-inquiry-meeting.mjs` 接入通用 Runner。
- Runtime 层统一跑 policy 和产物校验;XLSX 必须重新检查 zip、openpyxl、必需 sheet、禁止 sheet、table/drawing 残留。

第二个轻量 Skill `supplier-brief` 已用 `mock-artifact` adapter 接入,用于证明 registry + runner 能接新 Skill,而不是继续写专线。

### 模块说明

`React/Vite Web 工作台`

- 第一阶段产品入口。
- 负责新对话、赢单外贸顾问、我的Agent、技能Skill、外接生态、客户Kass。
- 「新对话」必须是 Agent 任务线程,不是一次性任务执行面板。
- 线程里展示用户/Agent 消息、可展开「本次操作记录」、产物卡和继续追问输入;内部 Session ID 默认不展示。
- 只展示业务状态，不展示完整底层日志。

`Runtime API`

- Web 前台只调用这一层。
- 负责创建任务、继续任务、取消任务、确认高风险动作、读取任务结果。
- 第一版可以先是本地 API / mock API，后续再接真实服务。

`Skill Registry`

- 负责读取可执行 Skill 清单。
- 当前来源是 `workbench/registry/skills.json` 和 `workbench/skills/<skill>/skill.json`。
- 目标匹配、命令别名、policy 动作、产物类型和业务计划都优先放在 registry,不要写死在新对话入口。

`Skill Runner`

- 负责统一执行 Skill Runtime loop。
- 当前固定链路是 `goal.received -> skill.matched -> skill.loaded -> plan.created -> policy.checked -> action.executed -> observation.recorded -> artifact.verified -> run.completed`。
- 每轮都会写 append-only run log,供前台操作记录和同任务追问读取。

`Skill Adapter`

- 负责不同 Skill 的特殊执行方式。
- `alibaba-inquiry-meeting` adapter 复用已跑通的 real-bridge 执行器。
- `mock-artifact` adapter 用于轻量本地 Skill,验证新增 Skill 可以只靠文件注册接入。
- adapter 只做具体执行,policy 和产物最终校验仍由 Runner 统一处理。

`Agent Assembler`

- 运行时组装 Agent。
- 从 agent 目录读取 `persona.md`、`playbook.md`、`skills.json`、`tools.json`、`memory.md`。
- 再叠加客户 memory、当前 Skill 的紧凑定义、当前询盘和用户输入。
- 普通 Agent 不把所有 Snov.io、ContactOut、Apify、阿里 bridge、CRM、邮件等底层工具全部塞进上下文；这些能力优先由 Skill 封装，运行时只展开当前 Skill 需要的少量动作和工具契约。
- 受控的 C 下，每一轮都要重新组装（因为对话历史在增长），不是开头组装一次。
- 目标是避免“Agent 只是一段泛泛提示词”。
- 固定组装顺序如下：

```text
1. agents/<slug>/persona.md
2. agents/<slug>/playbook.md
3. agents/<slug>/skills.json + agents/<slug>/tools.json   # 只作为能力上限
4. agents/<slug>/memory.md
5. customers/<slug>/profile.md
6. customers/<slug>/memory.md
7. customers/<slug>/diary-summary.md + 最近 N 条 diary
8. 当前 Skill 定义 + 当前 Skill 允许的动作/工具摘要
9. 当前任务输入 + 到目前为止的对话历史
```

顺序要固定，因为越靠后的内容越贴近当前任务，但不能覆盖前面的安全边界。

`Context + Memory Loader`

- 负责取数：读取客户Kass轻量档案、客户 memory、客户 diary、产品资料、历史任务摘要，交给 Agent Assembler 拼装。
- 任务结束后回写客户 memory 和 diary，并负责压缩摘要，避免长期客户把 prompt 撑爆。
- memory 是主动推进型 Agent 的底座。

`Model Gateway`

- 统一调用模型。
- 第一批模型：

```text
deepseek-v4-pro：复杂判断、任务规划、询盘质量判断、最终整合
deepseek-v4-flash：轻量分类、摘要、字段提取、改写、草稿润色
```

- 前台包装为：

```text
快速分析 -> deepseek-v4-flash
深度分析 -> deepseek-v4-pro
```

`Tool Proxy + Registry`

- 所有内部函数、第三方 API、CLI、阿里 bridge、未来 MCP 都走一个调用口。
- 工具能力由 `registry/tools.json` 声明，Agent 只声明能力上限，Skill 声明本任务实际需要的工具子集。
- 业务页面不能到处直接调用外部工具。
- 模型上下文里不展开全量工具清单，只展开当前 Skill 的动作名、必要参数和风险摘要，避免普通 Agent 被巨大的 tool schema 拖垮。
- 第一版默认只开放只读工具和白名单本地脚本；`alibaba-inquiry-meeting` 需要的 Alibaba 只读工具是最终验收对象。

`Policy Engine`

- 执行 `registry/policy.jsonl` 和 `agents/<slug>/policy.jsonl`。
- 输出 `allow`、`ask`、`deny`。
- `ask` 触发业务化确认弹窗。
- `deny` 直接阻断并写入 run log。

`Run Logger`

- 一次任务一个 `runs/<run_id>.jsonl`。
- 每一步追加一行，绝不覆盖历史。
- 记录输入摘要、模型调用、工具调用、权限判断、产物、错误、用户确认。

`Artifact Writer`

- 管理 Agent 产物。
- 第一版至少支持：`alibaba-inquiry-meeting` 生成的 XLSX、标准化主持材料 JSON、manifest 和必要日志。
- 产物可以保存为 XLSX / Markdown / JSON / TXT；XLSX 必须通过固定安全流程后才能交付。

## 6. 文件目录结构

第一版建议目录：

```text
yingdan-workbench/
  agents/
    inquiry-meeting-host/
      persona.md
      playbook.md
      memory.md
      tools.json
      policy.jsonl

  customers/
    global-sourcing-inc/
      profile.md
      memory.md
      diary/
        2026-06-26.md

  skills/
    alibaba-inquiry-meeting/
      SKILL.md
      agents/openai.yaml
      evals/evals.json
      scripts/build_inquiry_meeting_xlsx.py
      input.schema.json
      output.schema.json

  registry/
    tools.json
    policy.jsonl

  runs/
    alibaba-meeting-<timestamp>.jsonl
    run-<timestamp>.checkpoint.json

  artifacts/
    alibaba-inquiry-meeting-real/
      host-material.json
      raw/<run_id>/*.json
      alibaba-inquiry-meeting/
        manifest.json
        询盘分析会_<start>_<end>.xlsx

    run-<run_id>/
      询盘分析会_2026-06-01_2026-06-07.xlsx
      manifest.json
```

### 主键规则

赢单内部不要先学 Accio 的 DID / MID。

```text
agent 主键：agent_slug，例如 inquiry-meeting-host
customer 主键：customer_slug，例如 global-sourcing-inc
run 主键：run_id，例如 run-20260627-143105-a7f3
```

`run_id` 不用每日序号，避免多 Agent 或并发任务撞号。建议格式是 `run-YYYYMMDD-HHMMSS-<4到6位随机后缀>`，第一版本地网页也按这个规则做。

唯一例外是阿里 bridge，见第 13 节。

## 7. Agent 目录定义

每个 Agent 至少包含：

```text
persona.md
playbook.md
memory.md
tools.json
policy.jsonl
```

### persona.md

记录顾问人设、语气、业务红线。

注意：`persona.md` 里的红线只做语气和行为提醒，不是安全依据。真正能拦截动作的唯一硬规则是 `policy.jsonl`，运行时必须以 policy 的 `allow` / `ask` / `deny` 为准。

示例职责：

```text
你是赢单外贸成交顾问。
你帮助业务员判断客户意向、整理缺失信息、生成英文回复和跟进计划。
你不能自动发送邮件，不能承诺价格，不能编造产品参数。
```

### playbook.md

记录该 Agent 的通用业务打法、判断习惯、沟通节奏和输出偏好。

`playbook.md` 不负责定义某个具体任务的输入输出契约。Agent 执行 Skill 时，Skill 管“交付物长什么样”，playbook 管“用什么节奏、判断方式和口吻完成”。

受控的 C 下，playbook 同时充当模型决定 `next_action` 的**强引导**：正常情况下模型按这套步骤推进，但保留遇到异常时应变的自主权。

询盘复盘会 Agent 的 playbook 可以包含：

```text
1. 先解析复盘周期和会议对象。
2. 读取当前 Runtime Skill 的 SKILL.md、openai.yaml 和 evals。
3. 先做 Alibaba 只读工具发现,再采集业务员、店铺、质检和必要会话证据。
4. 把事实整理成主持材料 JSON,缺数据必须标注。
5. 调用 skill 自带 XLSX builder。
6. 校验 XLSX 并返回产物路径、管理风险数量和整改动作数量。
```

### memory.md

记录 Agent 自己长期积累的偏好、经验和注意事项。

例如：

```text
用户更喜欢先确认关键信息，不喜欢一上来直接报价。
用户常卖不锈钢水杯，默认需要关注容量、材质、Logo、MOQ、FOB条款。
```

### skills.json

声明当前 Agent 可以使用哪些 Skill。普通任务 Agent 应该主要通过 Skill 获得业务能力，而不是直接暴露大量底层工具。

例如：

```json
{
  "allowedSkills": [
    "lead-research",
    "customer-background-check",
    "contact-enrichment",
    "cold-email",
    "alibaba-inquiry-meeting"
  ]
}
```

### tools.json

声明当前 Agent 能直接看见哪些底层工具。`tools.json` 是这个 Agent 的工具上限，但第一版不建议普通 Agent 直接拥有大量外部工具；Snov.io、ContactOut、Apify、阿里 bridge、CRM、邮件等底层能力优先放进 Skill 的工具链里。

Skill 想用的工具必须同时满足两个条件：

1. 在全局 `registry/tools.json` 里存在。
2. 没有超过 Agent 的能力上限和 policy 边界。

模型在受控的 C 下只能选择当前 Skill 暴露出来的动作；不能直接从全局工具池随便挑工具。越界动作视为非法动作驳回。

例如：

```json
{
  "allowedTools": [
    "customer.read_profile",
    "customer.read_memory",
    "product.search",
    "artifact.write_markdown",
    "bridge.alibaba.read_only"
  ]
}
```

### policy.jsonl

声明当前 Agent 的权限覆盖规则。

没有特殊规则时可以不建，默认走 `registry/policy.jsonl`。

## 8. 客户 Memory

客户Kass 第一版不做完整 CRM，但必须把客户 memory 做成一等公民。

每个客户建议包含：

```text
profile.md
memory.md
diary/YYYY-MM-DD.md
```

`profile.md`

- 客户名称。
- 国家/地区。
- 来源平台。
- 当前等级。
- 关键标签。

`memory.md`

- 客户长期偏好。
- 历史采购方向。
- 报价敏感点。
- 风险点。
- 当前推进阶段。
- 下一步建议。

客户 `memory.md` 不是无限追加日志。它只保留长期有效的信息，建议固定成少数几段：

```text
长期偏好
当前阶段
关键风险 / 禁忌
下一步动作
累计摘要
```

第一版可以把 `memory.md` 控制在 2-4 KB 左右，超过就由 Memory Writer 做滚动改写。它的目标是让 Agent 下次接着推进，不是保存所有历史细节。

`diary/YYYY-MM-DD.md`

- 每次任务结束后追加。
- 记录这次发生了什么、产出了什么、用户确认了什么、下一步是什么。

`diary/` 是 append-only 历史，但运行时不能全量读取。Assembler 只读取：

```text
diary-summary.md
最近 N 条 diary，第一版建议 N=10
```

每次任务完成后，Memory Writer 先追加当天 diary，再更新 `diary-summary.md` 和 `memory.md`。这样老客户跟进半年后，Agent 仍能拿到有效上下文，而不是把所有历史塞进 prompt。

这比“最近一次 AI 摘要”更有价值，因为它能支撑长期成交推进。

## 9. DealOps Runtime Loop v2

本节是赢单 Runtime 的完整目标形态。它不是照搬 Accio Work 的通用 Agent 平台，而是把 Accio 的文件化、运行时组装、policy、trace 和 session/task 思想，改造成外贸成交场景的 **DealOps Runtime**。

当前阶段的产品落点只在「新对话」。也就是说,先把「新对话」做成外贸版 Codex / Claude Code:用户交代一个业务目标,系统自己拆任务、查资料、调用工具、生成产物、检查结果,遇到风险再停下来问。其他入口可以继续是普通业务页面、资料页或功能入口,不要因为本节的完整 Runtime 设计而立刻扩散成全站重构。

显著优于 Accio Work 的判断标准不是“更像框架”，而是：

```text
Accio Work 更强: 通用 agent / prompt assembly / tool registry / session-task / gateway / policy。
赢单必须更强: 客户和商机对象 / 依据和缺口 / 交付物质量门 / 外贸推进动作 / 记忆确认 / 用户可读进度。
```

所以 Runtime v2 同时有两套语言：

- 内部语言：`run`、`phase`、`action`、`observation`、`evidence`、`policy`、`checkpoint`、`artifact`。
- 前台语言：客户、询盘、产品资料、历史跟进、依据、缺口、风险、下一步、待确认、交付物。

前台永远不默认展示 `Runtime`、`Tool call`、`MCP`、`Trace`、`Prompt`、`Token`、`policy scope`、`Session ID`、`profile/memory`、`alibaba-inquiry-meeting` 这些词。它们必须翻译为“本次任务”“正在核对资料来源”“客户档案/历史跟进”“询盘复盘会材料”等业务语言。

### 9.0 核心对象

v2 的核心不是对话，而是一次可追溯的成交任务：

```text
Run              一次任务执行,可暂停、恢复、失败、完成
Goal             用户的自然语言业务目标
BusinessObject   客户、商机、询盘、产品、会议、跟进行动
Skill            可执行任务包,定义动作空间、产物契约和质量门
Plan             当前 Skill 下的有界步骤,第一刀仍可由 registry plan 驱动
Action           运行时动作,例如读取 Skill、只读采集、生成主持材料、写 XLSX
Observation      工具或内部动作的归一化结果
EvidenceItem     支撑判断的依据,绑定来源、可信度、覆盖度、缺口和新鲜度
Artifact         交付物,例如 XLSX、回复草稿、背调报告、会议材料
QualityGate      类型化校验器,决定产物能否交付
PolicyDecision   allow / ask / deny / degrade
MemoryCandidate  任务结束后候选写入客户档案或 diary 的摘要
Checkpoint       可恢复快照,不是审计事实
```

最关键的区别：Accio 的 session/task 更偏通用执行记录；赢单的 run 必须围绕客户、询盘、依据、缺口、交付物和下一步动作组织。

### 9.1 状态和 phase

状态不要爆炸。工程上用少量 `status`，再用 `phase` 表达当前位置：

```text
status:
  running
  waiting
  resuming
  completed
  failed
  cancelled

phase:
  preflight
  assembling_context
  planning
  executing
  validating
  committing
```

`waiting` 必须带业务原因：

```text
waiting.user_input          还缺关键信息
waiting.user_confirmation   等用户确认保存、导出、外发或扣费
waiting.tool_auth           等用户连接资料来源
waiting.budget              等用户确认付费调用
waiting.external_service    资料来源或 bridge 暂时不可用
```

系统自愈不交还 UI，仍写事件：

```text
retrying.model
retrying.tool
```

终止状态必须写清 `reason`，不能只写 failed：

```text
step_or_cost_limit
too_many_denied
quality_gate_failed
evidence_missing
tool_unavailable
user_cancelled
```

### 9.2 Agent Assembler 协议

v2 不能只说“组装上下文”，必须固定顺序，避免每次运行随缘：

```text
1. system safety and product rules
2. agent persona
3. agent playbook
4. current Skill contract
5. allowedActions and tool summaries
6. policy summary
7. customer profile
8. customer memory
9. diary-summary and recent diary entries
10. current run checkpoint summary
11. current user input and attachments
12. evidence budget and output contract
```

约束：

- 只展开当前 Skill 需要的动作空间和工具摘要，不把所有工具 schema 塞进 prompt。
- `memory.md`、`diary-summary.md` 和最近 N 条 diary 要压缩后进入上下文，不能无限读历史。
- promptMode 必须明确：`fast_diagnosis`、`deep_analysis`、`artifact_builder`、`critic_review` 等，前台翻译成“快速分析 / 深度分析”。
- Context 过长时先压缩 diary 和 observation，再降级非关键资料，不能丢 policy 和 Skill contract。
- 每次组装写 `context.assembled`，记录输入来源摘要，不写敏感原文。

### 9.3 Skill / Tool Registry 验证链

每个 action 执行前都要过四层：

```text
registration -> capability -> policy -> execution
```

含义：

- `registration`：Skill 和 Tool 必须在 registry 注册，不能让模型编一个动作。
- `capability`：当前 agent / skill / customer 是否允许看到这个能力。
- `policy`：这次具体 action 是 allow、ask、deny 还是 degrade。
- `execution`：由 adapter 或 Tool Proxy 执行，并归一化成 observation。

Skill registry 至少要补这些内部字段：

```json
{
  "allowedActions": [],
  "businessObjects": ["customer", "inquiry", "artifact"],
  "evidenceRequirements": [],
  "qualityGates": [],
  "artifactContract": {},
  "sideEffects": {
    "read": [],
    "write": [],
    "external": []
  }
}
```

Tool observation 必须统一，不能让每个 adapter 自说自话：

```json
{
  "action": "alibaba.read_inquiry_metrics",
  "status": "completed",
  "source": "alibaba_read_only",
  "confidence": 0.88,
  "coverage": "2026-06-15..2026-06-21",
  "freshness": "same_week",
  "summary": "已读取本周询盘质量指标。",
  "gaps": [],
  "dataRef": "artifacts/run-xxx/raw/inquiry_metrics.json"
}
```

### 9.4 Evidence Ledger

Evidence Ledger 是内部结构，前台叫“依据 / 缺口 / 下一步”。它不是可选的日志，而是进入 `validating` 的门槛。

最小结构：

```json
{
  "evidenceId": "ev-001",
  "businessObject": "inquiry",
  "sourceType": "inquiry_text",
  "sourceLabel": "询盘原文",
  "sourceRef": "artifacts/run-xxx/raw/inquiry-42.json",
  "claim": "客户明确询问 MOQ、FOB 和 lead time，意向等级偏高。",
  "confidence": 0.84,
  "coverage": "single_inquiry",
  "freshness": "current_run",
  "gaps": ["缺目标交期", "缺包装要求"],
  "risk": "报价前不能直接承诺交期"
}
```

强制规则：

- 每个关键判断必须引用至少一个 `evidenceId`。
- 每个 artifact 的关键区块必须引用 `evidenceId`，例如 XLSX 重点询盘、共性问题、整改动作。
- 每个 next action 必须说明来自哪些 evidence 或 gap。
- 没有证据的判断只能标为“待确认”，不能写成确定结论。
- 证据覆盖不足时不能进入 `run.completed`，只能 `waiting.user_input`、`degrade` 或 `failed(evidence_missing)`。

前台展示时只显示：

```text
依据：来自询盘原文 / 客户档案 / 产品资料 / 历史跟进
缺口：缺价格底线、目标交期、包装要求、认证要求、付款条件
风险：资料不足导致判断不稳、客户诚意不足、条款风险
下一步：今天要问什么、发什么、让谁确认什么
```

### 9.5 Policy Engine

Policy 不只管工具调用，也管模型、资料、写入、导出、外发和扣费。统一输出：

```text
allow    直接执行,前台不打扰用户
ask      暂停,说明确认什么、影响哪里、能否撤回
deny     拒绝,给出安全替代路径
degrade  降级执行,例如只生成草稿、不写入、不外发
```

policy 层级：

```text
global policy
agent policy
skill policy
customer / workspace policy
run override from user confirmation
```

前台文案规则：

```text
ask  -> 这一步会影响客户资料/费用/外发内容，需要你确认。
deny -> 这一步暂时不能做。可以先生成草稿给你检查。
waiting.user_input -> 还缺 2 个关键信息，补完我再继续。
waiting.tool_auth -> 需要先连接资料来源。
waiting.external_service -> 资料来源暂时不可用，稍后可继续本次任务。
```

### 9.6 Typed Evaluator 和 Quality Gate

`Critic Loop` 不是泛泛“再看一眼”，而是类型化 evaluator：

```text
XLSX evaluator
  文件结构、安全残留、必需 sheet、禁止内部词、证据覆盖、业务字段完整度

Email evaluator
  语气、语言、事实依据、是否承诺过度、是否包含敏感信息、是否需要人工确认

Customer report evaluator
  公司/联系人/采购意向/风险/下一步是否都有 evidence

Meeting material evaluator
  会后复盘是否有责任人、整改动作、复查指标,是否可直接给老板看
```

Evaluator 输出固定为：

```json
{
  "status": "pass",
  "score": 0.91,
  "blockingIssues": [],
  "repairableIssues": [],
  "nextRuntimeDecision": "commit"
}
```

可选 decision：

```text
commit
repair_once
replan
wait_for_user
fail
```

每类产物要限制自动修复次数，避免 evaluator 和 builder 来回空转。

### 9.7 完整 loop

目标形态：

```text
create_run(goal, customer?, skill?)
append run.started
status=running; phase=preflight

preflight:
  resolve goal and business objects
  check skill registration and tool availability
  check auth / entitlement / budget / idempotency
  append run.preflighted
  checkpoint

assemble_context:
  assemble by fixed order
  append context.assembled
  checkpoint

planning:
  create bounded plan from registry plan or model
  plan only uses currentSkill.allowedActions + finish
  append plan.created
  checkpoint

executing:
  for each step until finish / waiting / failed:
    enforce MAX_STEPS, MAX_COST, MAX_DENIED
    choose or read next_action
    append runtime.tick

    verify registration and capability
    if invalid:
      append action.rejected
      feed rejection back to planner
      continue

    check policy
    append policy.checked

    if policy == deny:
      append action.denied
      feed denial back to planner
      if denied_count >= MAX_DENIED: fail
      checkpoint
      continue

    if policy == ask:
      append permission.requested
      append run.waiting(reason, resume_from)
      checkpoint(status=waiting)
      return control to UI

    if policy == degrade:
      rewrite action to safe alternative
      append action.degraded

    execute action through adapter / Tool Proxy
    normalize observation
    append action.executed
    append observation.recorded
    update evidence ledger
    append evidence.added
    checkpoint

    if observation requires user input or tool auth:
      append run.waiting(reason, resume_from)
      checkpoint(status=waiting)
      return control to UI

validating:
  run typed evaluator and quality gates
  append critic.reviewed
  append artifact.validated or artifact.rejected
  if repairable and repair_count < limit: go executing
  if needs user: waiting
  if blocking: failed

committing:
  create memory candidates and diary entry
  ask policy before writing durable customer memory
  append memory.candidate_created
  append memory.updated only after confirmation or allow policy
  append run.completed
```

### 9.8 Resume

恢复不是重跑整条 adapter，而是从 checkpoint 继续：

```text
resume_run(run_id, resume_token, user_decision_or_input)
-> load runs/<run_id>.jsonl as fact source
-> load checkpoint as cache
-> validate resume_token_hash
-> append run.resumed
-> inject decision/input into pending action
-> set status=resuming
-> continue from resume_from
```

约束：

- `runs/<run_id>.jsonl` 是事实来源，必须 append-only。
- `runs/<run_id>.checkpoint.json` 是可覆盖缓存，每次覆盖都要写 `run.checkpointed`。
- checkpoint 必须记录已完成 phase、已完成 action、pending action、evidence ledger 摘要、artifact refs 和 memory candidates。
- resume 后不得重复执行已完成的外部 action，尤其是付费、写入、导出、外发类动作。

### 9.9 第一刀落地顺序

完整 v2 不能一口气重写。当前已有 `skill-runner.mjs`、`runtime.mjs`、`alibaba-real-runner.mjs` 和 `artifact-validator.mjs`，正确做法是把真实 loop 补进骨架：

```text
1. 让 skill-runner 支持 status + phase、checkpoint、policy ask、resume_from。
2. 把 runtime.mjs 的 confirmRun 思路抽象成通用 resumeRun。
3. 把 alibaba adapter 拆成 discover_tools / collect_observations / build_artifact / validate_artifact 四个 phase。
4. 给 alibaba real runner 输出最小 evidenceLedger,先覆盖 coverage、priority_inquiries、common_issues、corrective_actions。
5. 给 XLSX 和 host-material 加 typed evaluator,不先追求全类型产物。
6. 前台活动流改成业务化进度: 识别任务 / 核对资料 / 生成材料 / 检查结果 / 等待确认。
7. 最后再做 SQLite 索引、完整 DAG、复杂多 Agent 和后台长期任务。
```

第一刀可以继续用 registry plan 驱动，不急着让模型完全自主选 action。能暂停、能恢复、能写证据、能挡风险、能校验交付物，就已经比普通 Accio 式黑盒工具执行更适合外贸成交。

## 10. Skill 最小定义

Skill 仍然需要保留，但它不是 Agent 本体。

```text
Agent = 执行者，包含 persona、playbook、memory、可用工具、权限覆盖。
Skill = 业务动作包，定义某类任务的输入、输出、产物、可用动作和底层工具链。
Tool = 底层连接器，负责调用 API / MCP / CLI / 内部函数，不直接代表完整业务能力。
```

职责边界：

```text
playbook：Agent 的通用打法、节奏、判断习惯和口吻。
Skill：具体任务的输入字段、输出结构、可用动作、工具链和产物契约。
Tool：低层能力，例如查公司、查联系人、查邮箱、读网页、调用 bridge、导出文件。
```

这个边界很重要：赢单后续会接入 Apify、ContactOut、Snov.io、阿里国际站、小满 CRM、邮件系统、表格导出等能力，但普通 Agent 不应该在每次运行时加载所有工具 schema。Agent 只知道自己可以使用哪些 Skill；当前执行哪个 Skill，Runtime 才把该 Skill 的紧凑动作空间和必要工具摘要放进上下文。

### 10.1 用户不设计 JSON

第一版不要要求业务用户、产品经理或老板理解 `schema`。对用户来说：

```text
input.schema.json  = 这个 Skill 要填哪些信息
output.schema.json = 这个 Skill 会产出哪些结果
skill.json         = 这个 Skill 内部能做哪些动作、会用哪些底层工具
```

用户看到的是：

```text
询盘文本
客户
产品资料
报价底线
开始分析
确认保存
```

开发者和 Runtime 看到的才是：

```text
skill.json
input.schema.json
output.schema.json
allowedActions
toolChain
riskPolicy
```

所以 Schema 的设计原则是：先用赢单预设模板，不让用户手写；后续高级用户最多在界面里点选字段、改名称、开关某些输出块，由系统生成 JSON。这样既学 Accio 的文件化能力，又不把技术复杂度丢给用户。

如果二者冲突，第一版按这个优先级处理：

```text
policy.jsonl 安全规则
-> Skill 输入输出契约
-> playbook 通用打法
-> persona 语气偏好
```

每个强 schema Skill 至少要有：

```text
SKILL.md
skill.json
input.schema.json
output.schema.json
```

`skill.json` 负责给 Runtime 读，不给普通用户看。它不是让用户填写的配置表，第一版由赢单预设模板直接提供。它至少包含：

```json
{
  "id": "contact-enrichment",
  "name": "联系人补全",
  "category": "客户开发",
  "allowedActions": [
    "company.search_web",
    "contact.find_people",
    "contact.find_email",
    "customer.write_candidate_data",
    "finish"
  ],
  "toolChain": [
    {
      "tool": "apify.google_search",
      "kind": "mcp_or_api",
      "exposeToModel": "summary"
    },
    {
      "tool": "contactout.find_people",
      "kind": "api_or_cli",
      "exposeToModel": "summary"
    },
    {
      "tool": "snovio.find_email",
      "kind": "api_or_mcp",
      "exposeToModel": "summary"
    }
  ],
  "riskPolicy": {
    "paidApiCall": "ask_or_budget",
    "writeCustomerData": "allow_candidate_or_ask",
    "sendMessage": "deny"
  }
}
```

`exposeToModel` 默认使用 `summary`，表示模型只看到动作名称、用途、参数摘要和风险级别，不看到完整 API 文档、SDK 细节或大段工具 schema。

验收示例：`alibaba-inquiry-meeting`

```text
业务目标：为老板/销售主管完成一次阿里国际站询盘复盘会,输出会后结果 XLSX。
输入：用户请求、复盘周期、外部 skill 包、Alibaba 只读工具返回的数据。
输出：主持材料 JSON、询盘分析会 XLSX、manifest、run log。
工具：skill.read_external_package、alibaba.read_only_tool、artifact.write_xlsx、artifact.validate_xlsx。
风险：只读采集允许；发送消息、改配置、发品、上传、扣费全部禁止。
模型：可用 deepseek-v4-pro 生成管理诊断 JSON,但不能编造未采集到的数据。
```

示例：`客户背调和联系人补全`

```text
业务目标：从一个公司名、官网、询盘或目标市场出发，完成客户背调、联系人补全和开发优先级判断。
输入：公司名、官网、国家/地区、目标产品、客户类型、已有线索。
输出：公司画像、采购可能性、联系人列表、邮箱可信度、开发优先级、开发信建议、是否写入客户Kass。
底层工具：Apify 搜索/抓取、ContactOut 联系人、Snov.io 邮箱验证、web.read_page、customer.write_candidate_data。
风险：付费 API 调用需要预算或确认；邮箱和联系人可进入候选资料；发送邮件必须确认；写入正式 CRM 需要确认或走用户设置。
```

第一版不要贪多，先把 `alibaba-inquiry-meeting` 这一个真实交付型 Skill 跑通。它比五段聊天结果更能证明 Runtime 是否能执行任务、调工具、写产物并自检。

未来可以预留轻量 Skill 模式：

```text
SKILL.md only
无 input.schema.json / output.schema.json
只允许内部实验和低风险只读任务
不能调用写入、导出、外发、bridge 写操作等高风险工具
稳定后再升级为强 schema Skill
```

这样第一版保持可控，但不把未来“用户或 Agent 自己沉淀轻量 Skill”的路堵死。

### Skill 工具返回状态

所有底层工具都必须返回统一 observation，交给 Runtime 记录和判断下一步动作。不要让每个 API / MCP / CLI 返回自己的一套散乱结构。

最小结构：

```json
{
  "action": "contact.find_email",
  "status": "completed",
  "source": "snovio",
  "confidence": 0.92,
  "riskLevel": "L2",
  "writePolicy": "candidate_auto",
  "needsUserConfirmation": false,
  "summary": "找到 2 个联系人邮箱，最高可信度 92%。",
  "dataToWrite": {}
}
```

常见 `status`：

```text
completed
partial
no_result
waiting_user_confirmation
waiting_tool_auth
waiting_budget_confirmation
denied
failed
```

常见 `writePolicy`：

```text
none                    # 只用于本次 run，不写入
candidate_auto          # 写入候选资料，可后续由用户确认
ask_before_write        # 写入客户Kass前必须确认
ask_before_external     # 外发、同步 CRM、付费调用前必须确认
deny                    # 第一版禁止
```

这个状态由 Tool Proxy 和 Policy Engine 共同决定，不能只相信模型输出。模型可以提出动作，Runtime 负责执行、归一化结果、判定是否等待用户确认，并把 observation 追加到 `runs/<run_id>.jsonl`。

## 11. 权限和 policy.jsonl

第一版权限不要只停在 L0-L6 表，而要落成可执行规则。

`policy.jsonl` 是唯一硬执行来源。

- `persona.md` 可以写“不要自动发邮件”这种提醒，但只影响模型语气和自我约束。
- `policy.jsonl` 才负责真正拦截动作。
- 任何工具、模型、写入、导出、外发、bridge 调用，只要触发风险动作，都必须先查 policy。
- 如果 persona 和 policy 冲突，以 policy 为准。

全局默认规则放：

```text
registry/policy.jsonl
```

Agent 覆盖规则放：

```text
agents/<agent_slug>/policy.jsonl
```

规则格式：

```jsonl
{"action":"customer.read_profile","decision":"allow","why":"读取当前客户轻量档案"}
{"action":"customer.write_memory","decision":"ask","why":"写入客户记忆需确认"}
{"action":"artifact.export_file","decision":"ask","why":"导出可能外泄底价或客户隐私"}
{"action":"message.send_email","decision":"deny","why":"第一版禁止自动外发邮件"}
{"action":"system.run_shell","decision":"deny","why":"第一版禁止执行命令"}
```

### L0-L6 映射

```text
L0：纯展示或纯格式化 -> allow
L1：读取当前任务输入 -> allow + 记录
L2：读取客户Kass或产品资料 -> allow/ask + 记录
L3：把客户资料发送给云模型 -> ask 或记录提示
L4：保存到客户Kass、导出文件 -> ask
L5：发送邮件、站内信、WhatsApp、修改外部系统 -> deny
L6：执行命令、读取任意本机目录、安装插件 -> deny
```

第一版只允许：

- 生成草稿。
- 保存用户确认过的摘要或任务记录。
- 调用只读工具。
- 导出低风险产物。

第一版禁止：

- 自动发送邮件、WhatsApp、LinkedIn、阿里站内信。
- 自动下单、付款、退款、开票。
- 自动删除客户资料。
- 批量覆盖知识库。
- 读取本机任意目录。
- Agent 自己安装插件或执行命令。
- 绕过确认批量导出。
- 后台静默长期运行任务。

## 12. Run Log 事件格式

第一版不先建 14 张关系表。

一次任务就是一个 append-only 文件：

```text
runs/<run_id>.jsonl
```

每一行是一条事件。

示例：

```jsonl
{"type":"run.started","runId":"run-20260627-143105-a7f3","agent":"inquiry-meeting-host","skill":"alibaba-inquiry-meeting","at":"2026-06-27T14:31:05+08:00"}
{"type":"skill.loaded","path":"/Users/garden/Coding_Project/SkillCreateSpace/AccioSkillCreate/skills-by-category/accio-alibaba/管理/会议与行动闭环/alibaba-inquiry-meeting","files":["SKILL.md","agents/openai.yaml","evals/evals.json","scripts/build_inquiry_meeting_xlsx.py"]}
{"type":"eval.selected","prompt":"执行Skill：alibaba-inquiry-meeting","period":"上一个完整自然周"}
{"type":"period.resolved","start":"2026-06-01","end":"2026-06-07","label":"上周完整自然周"}
{"type":"tool.discovery","scope":"alibaba.read_only","status":"completed","summary":"确认询盘复盘所需只读工具可用"}
{"type":"policy.checked","action":"alibaba.read_only_tool","decision":"allow","why":"只读采集询盘复盘需要的数据"}
{"type":"tool.called","tool":"subaccount_query","status":"completed","summary":"获取业务员/子账号清单"}
{"type":"tool.called","tool":"query_seller_chat_quality_check_detail","status":"partial","summary":"部分日期未返回,已记录数据缺口"}
{"type":"diagnosis.generated","artifact":"artifacts/run-20260627-143105-a7f3/inquiry-meeting-payload.json","summary":"生成管理复盘主持材料 JSON"}
{"type":"artifact.written","artifact":"artifacts/run-20260627-143105-a7f3/询盘分析会_2026-06-01_2026-06-07.xlsx","kind":"xlsx"}
{"type":"artifact.validated","artifact":"artifacts/run-20260627-143105-a7f3/询盘分析会_2026-06-01_2026-06-07.xlsx","checks":["libreoffice_resave","unzip_t","openpyxl_load_workbook","residue_scan"]}
{"type":"run.completed","summary":"生成询盘分析会 XLSX,包含管理风险和整改动作"}
```

受控的 C 下，模型每轮决定的动作也要落进 run log：`runtime.tick` 记 `nextAction`，被驳回 / 拒绝的动作记 `action.rejected` / `action.denied`，撞上限记 `run.failed` 的 `reason`。这样既能复盘模型怎么决策，也能定位它为什么停。

SQLite 可以后置，只做索引：

```text
run_id
customer_slug
agent_slug
skill_slug
status
waiting_reason
resume_from
resume_token_hash
created_at
updated_at
artifact_count
```

也就是说，第一版事实记录在 jsonl，SQLite 只是为了搜索和列表更快。

## 13. 阿里 Bridge 决策

> 第一刀最终验收需要能执行 `alibaba-inquiry-meeting` 所需的阿里只读数据链路。本节只说明内部验证边界和脱敏要求,不是产品化 API 方案。

内部验证版调用阿里 bridge 工具时，带上 Accio 国际站生意助手的 entitlement 门禁值：

```text
ACCIO_AGENT_ID = <从环境变量读，绝不写进文档 / 代码 / 日志>
```

这个值代表 Accio 在阿里后端的 entitlement 门禁，不等于赢单内部的 Agent 主键；它是别人产品的门禁卡，只能放在 bridge 调用上下文里、从环境变量注入。

赢单内部仍然使用：

```text
agent_slug = inquiry-meeting-host
```

### 内部验证版定位

第一版只把本地 bridge 当内部验证链路：

```text
赢单本地网页
-> bridge adapter
-> Accio 本地网关
-> 阿里 Phoenix 后端
-> 有 entitlement 的工具
```

前置依赖必须写清楚：

- 必须开着 Accio Desktop。
- 必须已登录阿里账号。
- 本地网关 token 可能轮换，过期会 401。
- Accio 进程关闭会导致 bridge 连接失败。

所以这条链路能验证工具效果和 Skill 可执行性，不能作为正式商业依赖。

### 产品化版本

后置里程碑再做：

```text
阿里国际站开放平台官方 API
+ 赢单自己的 appKey
+ 商家 OAuth 授权
```

产品化版本不再依赖 Accio 的 agentId，但能拿到的工具范围可能少于 Accio 内部工具，需要单独评估。

## 14. 业务化确认弹窗

不要写：

```text
是否允许 tool call 写入 customer_context？
```

要写：

```text
确认导出询盘分析会 XLSX？

赢单将把本次复盘结果保存为本地 XLSX。
不会自动发送消息、修改国际站配置、发品、上传文件或扣费。
```

按钮：

```text
确认导出
先不导出
```

导出时：

```text
确认导出这份客户报告？

导出后，报告文件可能被转发给团队外的人。
请确认内容不包含不该外发的客户隐私、底价或内部策略。
```

按钮：

```text
确认导出
取消
```

## 15. 第一版落地优先级

### 第一刀：最小闭环

做这几件事：

```text
1. 一个可识别的外部 Skill 包：
   /Users/garden/Coding_Project/SkillCreateSpace/AccioSkillCreate/skills-by-category/accio-alibaba/管理/会议与行动闭环/alibaba-inquiry-meeting/

2. 一个 agent 目录：
   agents/inquiry-meeting-host/persona.md
   agents/inquiry-meeting-host/playbook.md

3. 一个模型入口：
   callModel(taskType, messages)
   没有 DEEPSEEK_API_KEY 时返回未配置或 demo,不能冒充真实判断

4. 一个有界 ReAct 循环：
   第一刀可以继续由 registry plan 驱动,不急着放开模型自主选所有动作
   每个 phase 后写 checkpoint,policy ask 时进入 waiting
   resume 后从 resume_from 继续,不重复执行已完成外部动作
   第一刀 phase 围绕：读取 Skill、工具发现、只读采集、生成 JSON、执行 XLSX builder、校验产物

5. 一个任务日志：
   runs/<run_id>.jsonl
   保存 run.started、skill.loaded、policy.checked、action.executed、observation.recorded、evidence.added、artifact.validated、run.waiting/run.resumed、run.completed/run.failed

6. 一个 evidence ledger + XLSX artifact：
   artifacts/<run_id>/evidence-ledger.json
   artifacts/<run_id>/inquiry-meeting-payload.json
   artifacts/<run_id>/询盘分析会_<start>_<end>.xlsx
   artifacts/<run_id>/manifest.json
```

第一刀也要遵守几个底线：

- `run_id` 用 `run-YYYYMMDD-HHMMSS-<random>`，不要用每日序号。
- 模型调用、工具调用、保存和导出前都先走 `policy.jsonl`；只读采集可 allow,外发/修改/发品/上传/扣费必须 deny。
- 循环必须有 `MAX_STEPS`（建议 8~10）、`MAX_COST` 和连续 deny 上限，撞上限安全落 `run.failed`，绝不无上限跑。
- `checkpoint.json` 第一刀只保证能恢复“等待用户确认导出或工具授权”这类节点,但必须做到 resume 后不重跑已完成的 adapter phase。
- 关键判断和关键 sheet 行至少有 `evidenceId`、来源、可信度、覆盖度、缺口和新鲜度;缺证据不能当确定结论交付。

第一刀通过后，才能继续扩。

### 第二刀：记忆控量、工具和更多暂停恢复

```text
customers/<slug>/diary-summary.md
registry/tools.json
registry/policy.jsonl
waiting.tool_auth / waiting.budget_confirmation / waiting.bridge_ready
更完整的 resume_run / checkpoint 重建
```

第二刀把第一刀的“确认保存”扩展成完整暂停恢复能力：工具授权、预算确认、bridge 未就绪、用户补充信息等都可以进入 `waiting`。同时实现 memory 控量：`memory.md` 保留长期有效信息，`diary/` 追加历史，运行时只读 `diary-summary.md` 和最近 N 条 diary。

### 第三刀：官方 API 和索引

```text
阿里国际站开放平台官方 API
商家 OAuth 授权
SQLite run index
```

### 暂不做

```text
subagent / 多 Agent 编排
官方阿里 API
完整 SQLite 关系库
可视化工作流编辑器
长期后台自动任务
```

## 16. 第一版验收方式

### 产品验收

```text
用户在「新对话」输入“帮我开上周询盘分析会”
-> Runtime 识别自然语言目标
-> 内部自动匹配询盘复盘会材料 Skill
-> 创建本次询盘复盘任务,默认不展示内部 Session ID
-> 看到 Agent 回复、可展开“本次操作记录”和业务化进度
-> 活动流使用业务词: 识别任务 / 核对资料 / 生成材料 / 检查结果 / 等待确认
-> 后端 loop 真实执行 preflight / assemble_context / plan / execute / validate / commit
-> 得到“询盘复盘会材料”产物卡和 XLSX 路径
-> 在同一次任务里继续追问,不重新采集只读数据
-> 打开工作簿看到 8 张固定 sheet
-> 管理层能直接看到风险、责任人、整改动作和下次复查方式
-> 关键结论旁边能看到依据、缺口和下一步
```

XLSX 必须包含：

- 本次会议总览。
- 本周询盘概览。
- 业务员询盘复盘。
- 重点询盘逐条分析。
- 共性问题归因。
- 会议主持提问。
- 下周跟进行动表。
- 会后追踪项。

XLSX 禁止包含：

- `数据质量检查` sheet。
- 工具名、JSON 字段、token、bridge、网关、内部报错码。
- 编造客户、人员、指标或漂亮但无来源的管理结论。

### 工程验收

当前真实验收命令：

```bash
npm run acceptance:alibaba-inquiry-meeting:real
```

2026-06-27 已跑通一次 `real-bridge` 验收：周期 `2026-06-15 ~ 2026-06-21`，`tool.called=38`，`tool.degraded=0`，产物在 `workbench/artifacts/alibaba-inquiry-meeting-real/alibaba-inquiry-meeting/询盘分析会_2026-06-15_2026-06-21.xlsx`。

```text
Runtime API 能创建 run
Runtime API 能把 run 从 running 切到 waiting，并通过 resume_run 回到 resuming/running
Agent Assembler 能按固定顺序读取 persona.md、playbook.md、tools、agent memory、客户 memory、diary-summary、Skill 和当前输入
模型能自主决定 next_action（受控的 C），且只能选 currentSkill.allowedActions + finish
撞 MAX_STEPS / MAX_COST 或连续 deny 超限时，run 能安全落 failed
非法或越权动作被驳回后能回灌模型，不直接崩
单程 ReAct 循环能从 running 跑到 completed
Model Gateway 没有 Key 时返回演示模式
Model Gateway 有 Key 时能调用 deepseek-v4-pro / deepseek-v4-flash
Policy Engine 能作为唯一硬执行来源，在模型、工具、写入、导出和 bridge 调用前拦截高风险动作
Tool Proxy 能发现并调用 alibaba-inquiry-meeting 需要的 Alibaba 只读工具
Run Logger 能写入 runs/<run_id>.jsonl
Run Logger 能写入 run.waiting、run.resumed、run.checkpointed 事件
Checkpoint 能保存 resume_from，并能从 runs/<run_id>.jsonl 重建
Evidence Ledger 能为关键判断和关键 sheet 行保存 source、confidence、coverage、gap、freshness
Typed Evaluator 能拒绝证据不足、内部词泄漏或 XLSX 结构不合格的产物
Artifact Writer 能生成并保存主持材料 JSON、XLSX 和 manifest
XLSX Builder 能通过 LibreOffice 重存、清包、unzip -t、openpyxl.load_workbook 和残留扫描
```

## 17. 和 Electron 的关系

Electron 不是第一步。

正确顺序：

```text
React/Vite 本地网页跑顺产品闭环
-> Runtime API 和文件结构稳定
-> Agent 目录、Skill、Bridge、policy、run log 稳定
-> 再把同一套工作台包进 Electron
```

Electron 后续只负责增强：

- 桌面窗口。
- 本地文件访问。
- 本地凭证代理。
- 系统托盘。
- 和浏览器插件更深的通信。

Electron 不应该改变 Runtime 的核心设计。

## 18. 最终目标

赢单要借鉴 Accio 的不是完整私有 runtime，而是这些底层思想：

- Agent 是可组装、可成长的目录。
- 任务不是一次聊天，而是可追溯的 run。
- memory 是成交推进的底座。
- policy 不是说明文档，而是运行时执行规则。
- Tool / Bridge 不是随便调用，而是经过 registry 和 policy。
- 结果不是一段回答，而是能保存、导出、复用的业务产物。
- 前台越业务化，后台越要结构化。

第一版目标是：

```text
像 Accio 的骨架
不像 Accio 的平台工程黑洞
像外贸业务工具
不像开发者控制台
```
