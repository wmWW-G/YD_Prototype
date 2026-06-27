# 赢单 Agent 工作台 Context

## 这个目录干嘛

`yingdan-agent-lab/` 是「赢单外贸业务员 AI 作战台」的规划和设计目录,同时含一个可运行的 React/Vite UI 原型 `agent-thread-prototype/`。

它回答一个问题:

```text
赢单怎么从「外贸 AI 问答」,升级成「能创建 Agent、用 Skill、调工具,把一个客户线索一步步推进到成交」的外贸作战台?
```

## 当前最新方向（2026-06-27）

```text
先在本地网页跑顺「第一刀」,再谈扩展和 Electron。
第一刀验收 = 能执行真实外部 Accio skill 包 alibaba-inquiry-meeting,并产出合格 XLSX。
当前本地已新增 real-bridge 验收命令,并把它接进「新对话」入口。
DeepSeek V4 只是诊断生成入口之一,不能替代真实 Skill 执行和真实工具数据。
```

- 第一刀的落地细节以 `BUILD_SPEC.md` 为准;总架构以 `RUNTIME_ARCHITECTURE.md` 为准。
- 旧方向 `Tauri + Python FastAPI sidecar + LangGraph` 已废弃。
- Electron 仍是最终桌面壳方向,但后置;现有 chatbot 类能力继续复用赢单后端接口。
- 原型里的 6 个一级入口是 UI 基线;其中「赢单外贸顾问」和「技能Skill」里的市场调研、开发信、询盘分析回复等,属于现有 chatbot 的业务内容入口,不等于 Runtime 验收 Skill。
- 当前旧的 `inquiry-reply` 代码只能算本地纵向 demo;不能再作为第一刀完成标准。

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
- `Agent Assembler` 固定组装顺序:persona、playbook、能力上限、agent memory、客户 profile/memory、diary summary、当前 Skill、当前输入。
- 普通 Agent 不直接加载所有外部工具;外部能力封装进 Skill,运行时只展开当前 Skill 的动作空间和工具摘要。
- 自主程度 = **受控的 C**:最小 Runtime loop,但只读自动、付费/写入卡确认、有步数上限;不是放开让模型自主决定。
- 最小 `waiting/resume/checkpoint`:只覆盖"保存到客户档案/写客户 memory 前确认"这一种;更复杂的暂停恢复后置。
- 客户 memory 控量;`run_id` 用时间戳 + 随机后缀,不用每日序号。
- 当前最终验收锚点是 `alibaba-inquiry-meeting`:读取外部 skill 包、发现并调用只读 Alibaba 工具、生成主持材料 JSON、调用 XLSX builder、写 artifact 和 manifest。
- 当前真实执行入口分两层:
  - 命令行验收: `server/alibaba-real-runner.mjs` 和 `npm run acceptance:alibaba-inquiry-meeting:real`。
  - 前台验收:「新对话」输入 `执行Skill：alibaba-inquiry-meeting`,调用 `POST /api/agent/message`。
- builder-only smoke 只用于证明外部 XLSX builder 可用,不算最终验收。

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
server/alibaba-skill.mjs 外部 alibaba-inquiry-meeting skill 包识别和 XLSX builder 调用适配
server/alibaba-real-runner.mjs 真实 Accio/Alibaba 只读工具采集、主持材料 JSON 和 real-bridge 验收执行器
server/skill-agent.mjs 新对话 Skill 指令识别和前台进度/产物响应封装
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
点击「开始对话」
页面应显示 alibaba-inquiry-meeting Agent、6 个进度节点、XLSX 文件名和本地路径
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
输入“执行Skill：alibaba-inquiry-meeting”
→ Runtime 执行 alibaba-inquiry-meeting
→ 发现并调用 Alibaba 只读工具
→ 生成主持材料 JSON
→ 调用 skill 自带 XLSX builder
→ 通过固定 XLSX 安全流程
→ 返回合格 .xlsx 路径,且 run log / artifact / manifest 可追溯
```

自然语言如“帮我开上周询盘分析会”可以作为后续意图识别扩展;当前第一刀硬验收以 `执行Skill：alibaba-inquiry-meeting` 为准。
