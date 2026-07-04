# API 测试记录

## 2026-07-04 连通性测试

### 测试目标

验证 Dify Chatflow `客户背调DeepSeek` 的 Service API 是否可以通过 API Key 正常调用，并记录最小可用请求结构。

### 测试接口

```text
POST https://api.dify.ai/v1/chat-messages
```

### 测试请求摘要

本次只发送虚拟连通性测试文本，没有发送真实客户资料。

```json
{
  "inputs": {},
  "query": "这是一条赢单项目的 API 连通性测试。请只用一句中文回复：Dify Chatflow API 连通成功。",
  "response_mode": "blocking",
  "conversation_id": "",
  "user": "yd-prototype-api-smoke-20260704",
  "files": []
}
```

鉴权 header 使用：

```text
Authorization: Bearer <DIFY_API_KEY>
```

真实 API Key 由用户当次提供，只用于现场测试；项目文件中不保存真实值。

### 第一次测试

- HTTP 状态：`401`
- 结论：失败原因是 shell 写法问题。把 `DIFY_API_KEY=...` 放在同一条命令前缀时，header 字符串展开发生在临时环境变量生效前，导致实际 header 没有带到 key。
- 处理：改用 `export DIFY_API_KEY=...` 后复跑。

### 第二次测试

- HTTP 状态：`200`
- 总耗时：约 `4.22s`
- 返回事件：`message`
- 返回包含会话 ID：是
- 返回包含消息 ID：是
- 返回包含创建时间：是

返回顶层字段：

```json
[
  "answer",
  "conversation_id",
  "created_at",
  "event",
  "id",
  "message_id",
  "metadata",
  "mode",
  "task_id"
]
```

`metadata` 字段：

```json
[
  "annotation_reply",
  "reasoning",
  "retriever_resources",
  "usage"
]
```

`metadata.usage` 字段：

```json
[
  "completion_price",
  "completion_price_unit",
  "completion_tokens",
  "completion_unit_price",
  "currency",
  "latency",
  "prompt_price",
  "prompt_price_unit",
  "prompt_tokens",
  "prompt_unit_price",
  "time_to_first_token",
  "time_to_generate",
  "total_price",
  "total_tokens"
]
```

回答摘要：

```text
Dify Chatflow API 连通成功。
```

注意：本次完整 `answer` 中出现 `<think>...</think>` 思考标签。正式接入赢单页面前，建议后端或前端过滤该标签，只展示用户可读结论。

## 2026-07-04 参数接口测试

### 测试接口

```text
GET https://api.dify.ai/v1/parameters
```

### 测试结果

- HTTP 状态：`200`
- 总耗时：约 `0.87s`
- `user_input_form`：空数组
- `file_upload.enabled`：`false`
- `suggested_questions_count`：`0`

完整参数摘要见 `parameters.snapshot.json`。

## 2026-07-04 代理接口测试

### 测试接口

```text
POST https://yd-prototype-dify-proxy.vercel.app/api/dify-customer-research
```

### 测试请求摘要

使用 GitHub Pages 的 Origin 模拟线上原型页面请求：

```text
Origin: https://wmww-g.github.io
```

请求体只包含前端需要传给代理的最小字段：

```json
{
  "query": "这是一条赢单代理连通性测试。请只用一句中文回复：客户背调代理连通成功。",
  "conversation_id": "",
  "user": "yd-prototype-proxy-smoke-20260704"
}
```

### 测试结果

- HTTP 状态：`200`
- CORS：`access-control-allow-origin: https://wmww-g.github.io`
- 返回包含会话 ID：是
- 返回包含消息 ID：是
- 回答摘要：`客户背调代理连通成功。`

### 结论

- GitHub Pages 页面可以跨域请求代理。
- 代理可以从后端环境变量读取 Dify API Key 并调用 `POST /chat-messages`。
- 前端不需要再要求用户手动填写 Dify API Key。

## 当前结论

- API Key 可用。
- `POST /chat-messages` 可通。
- `GET /parameters` 可通。
- 当前 Chatflow 没有暴露额外表单变量，先传 `inputs: {}` 即可。
- 文件上传当前未启用，客户背调首版应以纯文本 `query` 调用。
- 当前原型已新增 `api/dify-customer-research.js` 代理，GitHub Pages 前端默认请求该代理，代理再调用 Dify。
- 正式接入时必须继续走赢单后端代理，不要把 Dify Key 放进前端或浏览器插件。
