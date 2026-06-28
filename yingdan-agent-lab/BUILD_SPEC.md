# 赢单 Agent 工作台 · 第一刀执行规格（修正版）

> 修正日期：2026-06-27。
>
> 这版修正一个关键错误：赢单现有 `技能Skill` 里的市场调研、新客开发信、询盘分析回复等，是「赢单外贸顾问」chatbot 的业务入口，不等于 Runtime 架构里的验收 Skill。
>
> 第一刀验收标准改为：**能执行真实外部 Accio skill 包 `alibaba-inquiry-meeting`，并产出合格 XLSX。**

---

## 0. 给 Codex 的执行守则

1. 先读 `CONTEXT.md`、`RUNTIME_ARCHITECTURE.md` 和本文件，再动代码。
2. 不要再把「询盘分析回复」当成第一刀验收目标；它只是之前误切出来的本地纵向 demo。
3. 这次真正要验证的是：赢单 Runtime 能不能承接一个真实、可交付、带脚本和评测的外部 skill。
4. 任何 demo、fixture、builder-only smoke 都必须显著标记，不能冒充真实 Alibaba/Accio 数据采集。
5. XLSX 交付必须走固定安全流程：LibreOffice headless 重存、清理 `xl/tables/` 和空 `xl/drawings/`、清理 tableParts 和 drawing/table relationships、`unzip -t`、`openpyxl.load_workbook()`、包内 table/drawing 残留扫描。任一步失败都禁止交付。

---

## 1. 产品和概念分层

正确分层如下：

```text
赢单产品层
新对话 / 赢单外贸顾问 / 我的Agent / 技能Skill / 外接生态 / 客户Kass

赢单外贸顾问内容层
市场调研 / 新客开发信 / 客诉处理 / 询盘分析回复 / 展会成交 ...
这些是现有 chatbot 的业务场景入口。

Agent Runtime 层
读取任务、组装上下文、调用模型、调用工具、执行 skill 脚本、写 artifact、
记录 run log、做 policy 检查、等待确认和恢复。

外部 Skill 包层
可执行 skill 目录，例如 alibaba-inquiry-meeting。
包含 SKILL.md、agents/openai.yaml、evals/evals.json、scripts/*.py。
```

所以：

- 赢单 UI 里的 `技能Skill` 是用户看到的功能分类。
- Runtime 里的 `Skill` 是可执行任务包。
- 第一刀不能拿赢单 chatbot 里的「询盘分析回复」自嗨，必须跑通用户指定的外部 Skill 包。

---

## 2. 第一刀验收 Skill

验收目标：

```text
/Users/garden/Coding_Project/SkillCreateSpace/AccioSkillCreate/
  skills-by-category/accio-alibaba/管理/会议与行动闭环/
    alibaba-inquiry-meeting/
```

该 skill 的真实结构：

```text
alibaba-inquiry-meeting/
  SKILL.md
  agents/openai.yaml
  evals/evals.json
  scripts/build_inquiry_meeting_xlsx.py
```

它的业务目标不是“分析一条询盘并回邮件”，而是：

```text
给老板/销售主管完成一次阿里国际站询盘复盘会，
输出会后结果 XLSX：
风险、责任人、管理判断、整改动作、下次复查指标。
```

历史可参考交付证据：

```text
/Users/garden/Coding_Project/SkillCreateSpace/AccioSkillCreate/outputs/
  skill_complete_subagents_20260613_144316/management/
    alibaba-inquiry-meeting/final/询盘分析会_2026-06-01_2026-06-07.xlsx
```

该历史 manifest 显示这个 skill 曾经通过真实 bridge 工具调用和 XLSX 安全校验；本项目后续验收要复现这种级别，而不是只跑聊天结果。

---

## 3. 什么才算“能执行这个 skill”

最终验收必须完成这条链路：

```text
用户请求“开上周询盘分析会”
-> Runtime 识别 alibaba-inquiry-meeting
-> 读取外部 skill 的 SKILL.md / openai.yaml / evals
-> 解析周期、对象、输出目录
-> 先做工具发现，不凭记忆调用
-> 调用 Alibaba 只读工具采集业务员、店铺、询盘、IM 质检和必要会话证据
-> 生成标准化主持材料 JSON
-> 调用 scripts/build_inquiry_meeting_xlsx.py
-> 通过 XLSX 固定安全流程
-> 写入 workbench/runs 和 workbench/artifacts
-> 返回 XLSX 路径、周期、管理风险数量、整改动作数量
```

最低通过条件：

1. 真实读取目标 skill 包，而不是复制一段 prompt。
2. 真实执行 `scripts/build_inquiry_meeting_xlsx.py`。
3. 最终产物是 `.xlsx`，不是 Markdown、聊天回复或普通 JSON。
4. 工作簿包含 8 个固定 sheet：
   - `本次会议总览`
   - `本周询盘概览`
   - `业务员询盘复盘`
   - `重点询盘逐条分析`
   - `共性问题归因`
   - `会议主持提问`
   - `下周跟进行动表`
   - `会后追踪项`
5. 不创建 `数据质量检查` sheet。
6. 正文不泄漏工具名、JSON 字段、网关、token、bridge、报错码等内部技术内容。
7. 只调用只读工具，不发送消息、不改配置、不发布、不上传、不扣费。
8. 数据缺失时写“未返回 / 不可判断 / 仅覆盖已获取日期”，不得编造客户、人员和指标。

---

## 4. 当前代码状态

已存在但不能当最终验收：

```text
server/runtime.mjs
server/e2e-real.mjs
workbench/skills/inquiry-reply/
agent-thread-prototype/src/App.jsx 中的询盘分析接入
```

这些只证明过：

- 能调 DeepSeek flash。
- 能跑一个本地询盘 demo。
- 能写 run log、checkpoint、reply artifact 和 memory。

它们没有证明：

- 能执行外部 Accio skill 包。
- 能调用 Alibaba 只读工具。
- 能产出安全 XLSX。
- 能完成管理层询盘复盘会。

本次已新增的相关适配：

```text
server/alibaba-skill.mjs
server/alibaba-skill.test.mjs
server/smoke-alibaba-inquiry-meeting.mjs
npm run smoke:alibaba-inquiry-meeting
```

这条 smoke 只验证：

```text
读取真实 alibaba-inquiry-meeting skill 包
-> 用业务化 fixture payload 调用它自己的 XLSX builder
-> 通过 builder 内置安全流程
-> 在 workbench/artifacts/alibaba-inquiry-meeting-smoke/ 产出 XLSX
```

它是 `builder-only-fixture`，**不是最终验收**。

当前已新增并通过真实验收的执行链：

```text
server/alibaba-real-runner.mjs
server/alibaba-real-runner.test.mjs
server/acceptance-alibaba-inquiry-meeting-real.mjs
npm run acceptance:alibaba-inquiry-meeting:real
```

这条 real 命令会：

```text
读取真实 alibaba-inquiry-meeting skill 包
-> 发现 Accio/Alibaba 工具目录
-> 调用必采 Alibaba 只读工具和补充只读工具
-> 生成 host-material.json
-> 调用 build_inquiry_meeting_xlsx.py
-> 产出 real-bridge manifest、raw 工具响应、run log 和 XLSX
```

2026-06-27 已跑通一次真实验收：

```text
周期: 2026-06-15 ~ 2026-06-21
mode: real-bridge
tool.called: 38
tool.degraded: 0
XLSX:
workbench/artifacts/alibaba-inquiry-meeting-real/alibaba-inquiry-meeting/
  询盘分析会_2026-06-15_2026-06-21.xlsx
```

---

## 5. 技术形态

本实验室继续保留 Web-first 形态：

| 层 | 当前选择 | 说明 |
|---|---|---|
| 前端 | React/Vite | 用来展示任务、进度、产物和确认动作 |
| 本地后端 | Node/Express | 统一 Runtime API、run log、policy、模型入口、调度外部脚本 |
| 脚本执行 | Python | 外部 skill 自带 XLSX builder 使用 Python |
| 数据 | `workbench/` 文件夹 | runs、artifacts、policy、客户上下文、skill smoke 产物 |
| 模型 | DeepSeek V4 flash/pro | 用于生成诊断 JSON，不能替代真实工具数据 |
| 外部数据 | Accio/Alibaba 只读工具 | 最终验收必须接入 |

为什么 Node 后端还保留：

- 前端不能拿 API Key。
- 前端不能直接读写本机文件。
- Runtime 要统一记录 run log、policy 和 artifact。
- 外部 skill 的 Python 脚本可以由 Node 调度，不必把整个后端立刻换成 Python。

---

## 6. Runtime 执行流程（修正版）

真实执行 `alibaba-inquiry-meeting` 时，run log 至少要包含：

```text
run.started
skill.loaded
eval.selected
period.resolved
tool.discovery
policy.checked
tool.called            # 只读 Alibaba 工具，可多次
tool.degraded          # 某日期或某工具失败时记录降级
diagnosis.generated    # 标准化主持材料 JSON
artifact.input_written # payload JSON
artifact.written       # XLSX
artifact.validated     # XLSX 安全流程通过
run.completed
```

如果需要用户确认，比如导出到指定目录、调用付费工具、外发消息：

```text
policy.checked -> ask/deny
run.waiting
run.resumed
```

但本 skill 默认只读采集 + 本地生成 XLSX，不允许自动发送和修改。

---

## 7. policy 边界

必须允许：

```jsonl
{"action":"skill.read_external_package","decision":"allow","why":"读取指定外部 skill 包"}
{"action":"artifact.write_xlsx","decision":"allow","why":"写入本地 XLSX 产物"}
{"action":"artifact.validate_xlsx","decision":"allow","why":"执行交付前 XLSX 安全校验"}
{"action":"alibaba.read_only_tool","decision":"allow","why":"只读采集询盘复盘需要的数据"}
```

必须询问：

```jsonl
{"action":"artifact.export_file","decision":"ask","why":"导出到用户指定位置可能包含业务数据"}
{"action":"paid_api.call","decision":"ask","why":"付费 API 调用需用户确认"}
```

必须拒绝：

```jsonl
{"action":"message.send_email","decision":"deny","why":"第一版禁止自动外发邮件"}
{"action":"alibaba.send_message","decision":"deny","why":"询盘复盘只生成待人工确认动作"}
{"action":"alibaba.update_config","decision":"deny","why":"禁止自动修改国际站配置"}
{"action":"alibaba.publish_product","decision":"deny","why":"禁止自动发布或编辑商品"}
{"action":"system.run_unapproved_shell","decision":"deny","why":"只允许白名单 builder 和校验命令"}
```

---

## 8. 自验命令

当前 builder-only smoke：

```bash
npm run smoke:alibaba-inquiry-meeting
```

通过后应看到：

```text
ok: true
mode: builder-only-fixture
skillName: alibaba-inquiry-meeting
outputPath: .../询盘分析会_2026-06-01_2026-06-07.xlsx
```

常规测试：

```bash
npm test
```

前端构建：

```bash
npm run build:web
```

最终真实验收命令：

```bash
npm run acceptance:alibaba-inquiry-meeting:real
```

这个命令只有在 Accio/Alibaba 只读工具可用、登录态和权限有效时才算能跑。它必须产出真实 XLSX，不能只跑 fixture。
当前已验证该命令会写入 `workbench/runs/`、`workbench/artifacts/alibaba-inquiry-meeting-real/`、`host-material.json`、`manifest.json` 和最终 XLSX。

前台真实验收入口：

```text
「新对话」输入：帮我开上周询盘分析会
-> POST /api/agent/message
-> server/skill-agent.mjs 识别自然语言目标并匹配 alibaba-inquiry-meeting
-> goal-agent loop 逐步执行 goal.classify / skill.match / plan.create / skill.execute / artifact.verify / finish
-> server/alibaba-real-runner.mjs 执行真实只读采集和 XLSX builder
-> 前台创建 Agent 对话线程,显示 Session ID、Agent 回复、可展开活动流和 XLSX 路径
-> 同一个 Session 继续追问时只追加回答,不重新跑只读采集
```

---

## 9. 用户最终验收

用户不用看代码，最终只看这些：

1. 在「新对话」输入 `帮我开上周询盘分析会`。
2. 页面从空白输入态变成 Agent 对话线程,能看到一个 `agent-session-...` Session ID。
3. Agent 回复里写明已自动匹配 `alibaba-inquiry-meeting`。
4. Agent 回复里有「活动流」按钮,展开后能看到：收到目标、匹配任务、执行计划、action、observation、nextAction 和 artifact.ready。
5. 最终返回一个 `.xlsx` 路径。
6. 在同一个输入框继续追问,页面沿用同一个 Session ID,只追加回答,不重新采集 Alibaba 只读数据。
7. 打开 XLSX 后有 8 张固定 sheet。
8. 里面是老板/销售主管能直接看的会后复盘，不是会前提纲，不是聊天回答。
9. 没有工具名、JSON、token、bridge、内部报错。
10. 没有自动发消息、改配置、发品、上传或扣费。
11. 如果数据缺失，缺口写清楚，不能编造漂亮数据。

---

## 10. 明确不做

第一刀不做这些：

- 不把赢单外贸顾问里的普通场景入口当最终验收。
- 不把 `inquiry-reply` 本地 demo 当最终验收。
- 不让业务用户编辑 JSON / Schema。
- 不自动发送邮件、WhatsApp、站内信。
- 不自动修改 Alibaba 配置、发品、上传文件或消耗点数。
- 不用 fixture 冒充真实 Alibaba 数据。
- 不做完整插件市场、完整 CRM、复杂多 Agent、后台定时任务。
- 不把真实 token、cookie、DID、网关密码写进文档、代码、日志或聊天回复。

---

## 11. 人话总结

这次修正后的第一刀不是“做询盘分析回复”，而是：

```text
让赢单 Runtime 能执行一个真实外部 skill：
alibaba-inquiry-meeting。
```

能跑通这个 skill，才说明赢单开始具备“像 Accio 一样执行任务并交付结果”的底座能力。只生成五段询盘建议，不算验收通过。

自然语言触发 `帮我开上周询盘分析会` 已是当前第一刀前台验收入口；明确命令 `执行Skill：alibaba-inquiry-meeting` 只作为兼容入口保留。
