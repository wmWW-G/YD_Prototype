# 赢单本地 Agent 实验室 - 编码助手规则

## 项目定位

这个目录用于设计并落地「赢单」从静态 UI 原型,升级成外贸业务员本地 Agent 工作台的方案。
这里不是线上原型主工程,也不是正式生产代码;作用是先把 Agent 底座、Skill、模型入口、本地文件读写、客户记忆和任务循环跑通,再决定是否迁移到正式工程。

当前核心判断:

- 现在的赢单原型更像「外贸场景包装过的 AI Chatbot + 资料工具入口 + 客户上下文雏形」。
- 目标不是继续加聊天入口,而是做成「外贸业务员的 AI 作战台」——像 Accio 的骨架,但更业务、更轻。
- 真正价值:Agent 能读资料、用工具、维护客户状态、生成下一步动作,并把结果沉淀回客户档案。

## 产品定位与最新框架（2026-06-27 收窄，最重要）

- 一句话:**外贸业务员 AI 作战台**,覆盖 `找线索 → 开发 → 成交 → 客户管理` 全链路。
- 三层:**Agent = 底座**(产品,保证"智能") / **Runtime Skill = 可执行任务包**(可插拔,保证"对路") / **Tool = 连接器**。赢单 UI 里的市场调研、开发信、询盘分析回复等是现有 chatbot 业务入口,不等于 Runtime 验收 Skill。
- **第一刀验收**:能执行外部 Accio skill 包 `alibaba-inquiry-meeting`,并产出合格 XLSX。当前真实验收入口有两层:命令行 `npm run acceptance:alibaba-inquiry-meeting:real`;前台「新对话」输入 `执行Skill：alibaba-inquiry-meeting` 后调用 `POST /api/agent/message`。落地细节以 `BUILD_SPEC.md` 为准。
- **"底座做得好" = 智能感四件套**:①过程看得见 ②自动用上客户档案/记忆 ③判断有含金量 ④跨任务记得你。智能来自这四件,**不来自自主程度**。
- 最不要变成:普通 Chatbot / 复杂 CRM / 工具集合页 / MCP 控制台。

## 技术方向（2026-06-27 已换路线，旧路线作废）

第一刀已拍死(见 `BUILD_SPEC.md`):

- **前端**:React/Vite 本地网页。
- **后端**:Node/Express 本地小服务(`localhost`),负责调模型、读写文件、跑 Runtime、查 policy。第一刀临时用 Node;未来背调、爬虫、PDF/XLSX/OCR 变重时再评估 Python/FastAPI sidecar。
- **数据**:文件优先,`workbench/{agents,customers,skills,registry,runs,artifacts}`。SQLite 后置为索引层,不是第一版事实来源。
- **模型**:DeepSeek V4(`deepseek-v4-pro` / `deepseek-v4-flash`),统一入口 `callModel`,Key 只在后端 `.env`。多模型可替换的理念保留(以后可接通义/豆包/Kimi/本地),但都走 `callModel` 一个口。
- **桌面壳**:Electron 后置,本地网页跑顺再做。第一刀不碰 Electron/Tauri/打包。
- **工具协议**:MCP / API / CLI 都收敛到一个 Tool 代理;第一刀只允许只读工具和白名单本地脚本。`alibaba-inquiry-meeting` 需要的 Alibaba 只读数据链路是最终验收对象;外部付费工具(Apify/ContactOut/Snov.io)放第二刀。

> ⚠️ 旧文档里的 **Tauri 优先 / Python FastAPI sidecar 作第一版默认 / LangGraph / 本地向量库 / 主语言 Python** 都已**作废**,不要再按那套做。

## 自主程度：受控的 C（绝不做 D）

- 第一刀做**最小 Runtime loop**,但自主上限卡"受控的 C":能连续走多步、用多个动作,**但**只读动作自动、付费/写入/外发卡 policy 确认、有步数上限 `MAX_STEPS`。
- **绝不做 D**(定期监控、后台定时任务)。
- 记住:**自主高 ≠ 智能高**。

## Agent 循环设计原则

赢单 Agent 是可观察、可恢复的循环,不是一次性 prompt。每轮至少:

1. 读取当前任务状态。
2. 在**当前 Skill 的 `allowedActions + finish`** 这个小动作空间里决定下一步。
3. 选择工具或模型。
4. 执行工具调用,记录 observation。
5. 更新 run/step 状态。
6. 判断是否需要用户确认。
7. 写入客户档案或生成产物。
8. checkpoint。

> 第一刀动作空间小、playbook 强引导,行为接近固定步骤但保留最小自主;**不是**放开让模型在全局工具池里乱决定。当前验收动作围绕 `alibaba-inquiry-meeting`:读 skill、采集只读数据、生成主持材料 JSON、调用 XLSX builder、校验 artifact。builder-only smoke 不能当最终验收,必须看 `real-bridge` manifest 和 run log。

必须暂停让用户确认:写/覆盖本地文件、删文件或客户记录、敏感资料发云模型、批量处理、付费 API 调用。

## 安全红线

- `policy.jsonl` 是**唯一硬执行**来源,`persona.md` 红线只是模型提醒。
- **不硬编码**密钥、Token、Cookie、客户隐私、真实 DID(阿里 bridge 的 entitlement 值只能从环境变量读)。
- 第一版禁止:自动发邮件/WhatsApp/站内信、自动下单付款、删客户资料、读本机任意目录、Agent 自己装插件或执行命令。

## 参考 Accio 的方式

参考 `/Users/garden/YD/ReverseAccio`,不盲目照搬。

重点学:`agent-core/*.md` 文件化定义、`tool-registry` 权限边界、`sessions/*.messages.jsonl` 持久化、`tasks/*` 产物、MCP gateway 统一代理。
不要照搬或泄漏:Alibaba 专属 entitlement、Accio 私有目录结构、真实 DID、token、cookie、网关密码、强绑定某个模型或云端工具集。

## Tool 设计原则

工具小而稳定,不做万能黑箱。每个工具说明:作用、输入、输出、是否读/写本地文件、是否联网、是否发模型、失败返回结构。

> 工具清单(`customer.read_profile`、`artifact.write_xlsx`、`alibaba.read_only_tool` 等)是未来方向;第一刀只围绕 `alibaba-inquiry-meeting` 开放只读采集和本地 XLSX 产物写入。

## 模型路由原则

不要在 Agent 逻辑里写死某家模型。Agent 只调 `callModel(taskType, messages)`,由它决定具体模型。第一批就是 DeepSeek V4(`deep` → pro + thinking;`fast` → flash)。模型调用必须记录:模型名、taskType、输入摘要、输出摘要、reasoning_effort、thinking 状态、失败原因。

## 开发方式

- 开发新功能前先问用户前端/后端用什么(并用简洁中文说利弊);只补文档、设计 schema、写伪代码或 mock 可直接做。
- 函数写清注释(作用/参数/返回/异常),复杂逻辑注释"为什么"。
- 第一刀主力是 Node(后端)+ React(前端);未来重文件处理再引 Python 工具进程。
- 不硬编码密钥;本地文件写入保守、优先确认;关键操作有日志。

## 文档维护规则

核心文档只剩 5 份:

- `CONTEXT.md`:产品判断、架构方案、当前状态。
- `AGENTS.md`:助手工作规则(本文件)。
- `DEV_LOG.md`:每次创建/修改/验证了什么。
- `RUNTIME_ARCHITECTURE.md`:总架构。
- `BUILD_SPEC.md`:第一刀执行规格(`alibaba-inquiry-meeting` 验收)。

上下文变更优先同步 `CONTEXT.md` / `AGENTS.md` / `DEV_LOG.md`。

> `PLAN.md` / `TODO.md` / `RUNTIME_IMPROVEMENT.md` 已于 2026-06-27 删除:旧大计划与过程稿,内容已并入上述文档。

## 沟通规则

- 使用中文。
- 先看本地真实文件,再下结论。
- 用户短句通常代表要执行,不要停在概念建议。
- 如果用户说"先别改",严格只评估不改文件。
- 修改完成后提醒用户:记得提交 git 喔。
