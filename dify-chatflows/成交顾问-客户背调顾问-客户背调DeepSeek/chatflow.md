# Chatflow 名称：客户背调DeepSeek

## 基本信息

- 赢单功能路径：`成交顾问 > 客户背调顾问`
- Dify 应用名称：`客户背调DeepSeek`
- Dify 应用类型：Chatflow
- Dify 页面链接：`https://cloud.dify.ai/app/3be20d63-70a6-4f11-98d2-8e61e1c85d2c/develop`
- Dify 应用 ID：`3be20d63-70a6-4f11-98d2-8e61e1c85d2c`
- API 基础 URL：`https://api.dify.ai/v1`
- 主要调用接口：`POST /chat-messages`
- 参数快照文件：`parameters.snapshot.json`
- 调用函数文件：`call-function.md`
- API 测试记录：`api-test.md`
- 维护状态：已完成 2026-07-04 API 连通性测试，并已接入 `成交顾问 > 客户背调顾问` 原型页；当前原型页可前端直连内测
- 最近更新：2026-07-04

## 业务用途

用于「赢单」里的客户背调场景。用户输入客户公司、官网、国家、行业、客户背景或沟通上下文后，Dify Chatflow 返回客户背景分析、采购可能性、风险点和下一步沟通建议。

当前记录已经对应主静态原型里的 `成交顾问 > 客户背调顾问` 页面。当前原型页支持前端直连内测：首次点击背调时由用户临时输入 API Key，仅保存在当前页面内存中，刷新后消失。正式接入时仍建议由赢单后端代理调用 Dify。

## Dify API 页面观察

2026-07-04 通过 Chrome 读取 Dify `访问 API` 页面，页面显示：

- API 服务器：`https://api.dify.ai/v1`
- 鉴权方式：`Authorization: Bearer {API_KEY}`
- 发送对话消息：`POST /chat-messages`
- 支持 `streaming` 和 `blocking` 两种 `response_mode`
- `query` 是用户输入内容
- `inputs` 是应用定义变量，默认 `{}`
- `user` 是终端用户标识，需要在应用内唯一
- `conversation_id` 可选，用于继续上一轮会话
- `files` 可选，用于传文件；当前参数快照显示文件上传未启用

## 请求字段摘要

| 字段 | 类型 | 是否必填 | 赢单来源 | 说明 |
| --- | --- | --- | --- | --- |
| `query` | string | 是 | 客户背调输入区 | 用户输入的客户公司、官网、国家、业务背景或问题 |
| `inputs` | object | 否 | 预留变量 | 当前 `GET /parameters` 返回 `user_input_form: []`，可先传 `{}` |
| `response_mode` | string | 是 | 后端配置 | 建议后端使用 `streaming` 做真实产品体验；smoke test 使用 `blocking` 便于校验 |
| `conversation_id` | string | 否 | 后端会话状态 | 继续追问时传上一轮返回的 `conversation_id` |
| `user` | string | 是 | 赢单用户 ID 或匿名测试 ID | 服务 API 的终端用户标识 |
| `files` | array | 否 | 文件输入 | 当前参数快照显示文件上传未启用，测试时传 `[]` |

## 返回字段摘要

2026-07-04 `blocking` 模式真实调用返回顶层字段：

- `answer`
- `conversation_id`
- `created_at`
- `event`
- `id`
- `message_id`
- `metadata`
- `mode`
- `task_id`

`metadata` 中观察到：

- `usage`
- `retriever_resources`
- `annotation_reply`
- `reasoning`

## 赢单字段映射

| 赢单界面/数据字段 | Dify 请求字段 | 处理规则 |
| --- | --- | --- |
| 客户公司名、官网、国家、行业、询盘背景 | `query` | 可以先拼成一段结构化文本，由后端发送给 Dify |
| 当前登录用户或测试用户 | `user` | 正式产品用赢单后端用户 ID；测试可用固定 smoke ID |
| 连续追问会话 ID | `conversation_id` | 首轮为空字符串；后端保存返回值用于下一轮 |

| Dify 返回字段 | 赢单展示位置/数据字段 | 处理规则 |
| --- | --- | --- |
| `answer` | 客户背调结果预览区 | 可直接展示，但正式产品应先做安全 Markdown 渲染 |
| `conversation_id` | 后端会话状态 | 用于连续追问，不写入浏览器本地存储里的真实客户上下文 |
| `message_id` / `task_id` | 后端调试日志 | 只保存必要 ID，避免把完整客户原文写进日志 |
| `metadata.usage` | 用量统计 | 可用于后端成本统计，不在原型页面直接展示 |

## 异常和边界

- 鉴权失败：检查后端环境变量 `DIFY_API_KEY`，不要把真实 key 写进前端或文档。
- 空输入：不要调用 Dify，先提示用户补充客户公司或背景。
- 真实客户资料：正式接入前要评估日志脱敏、数据留存和权限边界。
- DeepSeek thinking 内容：本次返回 `answer` 中包含 `<think>...</think>`，正式展示前建议后端或前端过滤思考标签，只展示用户可读答案。

## 版本记录

| 日期 | 版本 | 变更内容 | 依据 |
| --- | --- | --- | --- |
| 2026-07-04 | v0.1 | 新建 Dify Chatflow 记录，并完成 `POST /chat-messages` 与 `GET /parameters` 真实调用验证 | 用户提供 Dify 应用链接和 API Key |
| 2026-07-04 | v0.2 | 将 `客户背调DeepSeek` 放进 `成交顾问 > 客户背调顾问` 原型页，页面展示输入、快捷样例、生成态和结构化报告 | 用户要求把背调放进真实原型 |
| 2026-07-04 | v0.3 | 客户背调原型页改为可直接调用 Dify，API Key 通过运行时 prompt 临时输入，不写入代码或本地存储 | 用户要求原型里能直接用 |
