# Dify 对话应用与 Chatflow 资料库

这个目录用于记录「赢单」项目里在 Dify 创建的对话型应用、Agent 对话应用和 Chatflow，以及对应的 API 调用方式、参数快照和真实测试结果。

这里记录的是后端/工作流对接资料，不是页面原型代码。主静态原型仍然优先修改根目录的 `index.html`、`src/data.js`、`src/app.js` 和 `src/styles.css`。

## 目录命名

每个 Dify 应用单独建一个子目录，建议使用下面格式：

```text
dify-chatflows/<一级功能区>-<二级模块>-<chatflow名称>/
```

示例：

```text
dify-chatflows/Chatflow-全技能总控示例/
dify-chatflows/Chatflow-不需要知识库的总库/
dify-chatflows/客户Kass-客户管理-KASS-Agent/
```

如果同一个赢单功能会调用多个独立 Dify 应用，就为每个应用建独立目录，不要把多个应用混在一个文件里。已经收进总控 Chatflow 的业务 Skill 直接维护总控里的路由和 Prompt，不再保留重复的独立 Chatflow YML。

## 应用类型和接口适配

两类应用都由 `app-` 开头的 API Key 唯一绑定具体 App，聊天请求都调用 `POST /v1/chat-messages`。保存配置前，后端会用该 Key 调用 `GET /v1/info` 识别真实模式，并校验是否和页面下拉选择一致：

| 页面类型 | Dify `/info` mode | 说明 |
| --- | --- | --- |
| `对话型应用` | `chat`、`agent-chat` | 普通 Chatbot 和 Agent 对话都归入这一类 |
| `Chatflow` | `advanced-chat` | 工作流编排对话型应用 |

`workflow` 文本生成工作流不属于本项目的对话页接入范围。两类对话应用都必须在连续追问时复用 Dify 返回的 `conversation_id`，切换 API Key 后必须清空旧会话。

## 已记录应用

| 赢单功能路径 | Chatflow 目录 | Dify 应用 | 状态 |
| --- | --- | --- | --- |
| `成交顾问 > 客户背调顾问` | `Chatflow-不需要知识库的总库/` | `赢单｜不需要知识库的总库` | 通过固定 `skill_key=customer-research` 路由；使用通用 Dify 流式代理，不再保留早期独立背调 App 资料 |
| `技能Skill > YD Artifact` | `技能Skill-YD-Artifact/` | `YD Artifact` | `prompt.md` 提供可直接替换的 LLM System Prompt，支持交互式 `html-artifact` 及现有 Mermaid、ECharts、SVG 输出 |
| `技能Skill > 市场调研` | `Chatflow-不需要知识库的总库/` | `赢单｜不需要知识库的总库` | 通过固定 `skill_key=market-research` 路由；API Key 由后端读取或加密保存，不写入仓库 |
| `总控 > 需要共享知识库` | `Chatflow-全技能总控示例/` | `赢单｜全技能总控 Chatflow` | 汇总 14 个需要共享知识库的业务 Skill；Prompt 已直接内置，不依赖独立 Skill Chatflow |
| `总控 > 不需要知识库` | `Chatflow-不需要知识库的总库/` | `赢单｜不需要知识库的总库` | 只包含客户背调和市场调研，不创建或注入知识库检索链路 |
| `客户Kass > 客户管理` | `客户Kass-客户管理-KASS-Agent/` | `赢单｜客户 KASS CRM Agent` | 本地 DSL 已生成；Agent 使用 `yingdan-kass` Tool Plugin 的 12 个非文件工具，支持页面当前客户线索与受控 Artifact，导入前需先安装插件并配置 Provider 凭证 |

## 每个应用目录应包含

- `chatflow.md`：人类可读的完整说明，记录赢单功能路径、Dify 应用入口、基础 URL、主要接口、字段映射和维护状态。
- `call-function.md`：脱敏后的调用函数或 curl，说明鉴权占位、请求体、返回字段和后端封装建议。
- `developer-handoff.md`：给开发同事的接入交接，说明前端、代理、Dify、上下文会话和正式产品建议。
- `parameters.snapshot.json`：从 `GET /parameters` 读取的应用参数快照，不能包含 API Key。
- `api-test.md`：真实试跑记录，包括测试时间、请求摘要、HTTP 状态、返回结构、异常和结论。
- `prompt.md`：需要人工粘贴到 Dify LLM 节点的系统提示词；必须记录对应输出协议和前端安全边界，不包含真实 Key。

## 维护流程

1. 先确认应用属于哪个赢单功能路径，并记录它是对话型应用还是 Chatflow。
2. 在 `dify-chatflows/` 下创建对应子目录。
3. 用 `chatflow.md` 记录 Dify 页面链接、应用名称、应用类型、用途和维护状态；文件名沿用历史约定。
4. 用 `call-function.md` 记录脱敏调用方式，真实 API Key 只能写成环境变量占位。
5. 用 `GET /parameters` 保存参数快照，判断是否有表单变量、文件上传或语音能力。
6. 用最小虚拟输入做 API smoke test，把 HTTP 状态、耗时、返回字段和问题写入 `api-test.md`。

## 安全规则

- 不要写入真实 API Key、Token、Cookie、密码或账号密钥。
- 不要把 Dify API Key 放进前端、浏览器插件、`src/app.js` 或任何用户可见页面。
- 调用样例统一使用 `<DIFY_API_KEY>` 或环境变量 `$DIFY_API_KEY`。
- 测试时不要发送真实客户资料、真实聊天记录、手机号、邮箱或其他隐私。
- 如果需要接入正式产品，必须由后端代理调用 Dify，前端只请求赢单自己的后端接口。
- 页面保存的 Key 由服务端使用 AES-256-GCM 加密后写入 Upstash Redis；读取配置时只能返回掩码和应用摘要，不能返回原始 Key。
