# Dify 客户背调调用说明

## 目标

接入 Dify Chatflow `客户背调DeepSeek`，用于根据客户公司、官网、国家、行业、业务背景或追问内容，生成客户背调分析结果。

推荐调用链路：

```text
业务前端
  -> 业务后端接口
  -> Dify Service API /v1/chat-messages
  -> 业务后端整理返回
  -> 业务前端展示结果
```

核心原则：Dify API Key 只放在后端环境变量里，前端不要直接保存或发送 Dify API Key。

## Dify 接口

Dify Service API 地址：

```text
POST https://api.dify.ai/v1/chat-messages
```

请求头：

```http
Authorization: Bearer <DIFY_API_KEY>
Content-Type: application/json
```

请求体：

```json
{
  "inputs": {},
  "query": "客户公司、官网、国家、行业、业务背景或追问内容",
  "response_mode": "streaming",
  "conversation_id": "",
  "user": "yingdan-user-123",
  "files": []
}
```

字段说明：

| 字段 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| `inputs` | object | 否 | 当前 Dify 应用没有额外表单变量，传 `{}` 即可 |
| `query` | string | 是 | 本轮用户输入内容，首轮通常是完整客户背景，后续可以是追问 |
| `response_mode` | string | 是 | 建议使用 `streaming`，长背调任务更不容易被上游网关超时中断 |
| `conversation_id` | string | 否 | 首轮传空字符串；后续追问传上一轮返回的 `conversation_id` |
| `user` | string | 是 | 终端用户标识，建议传业务系统用户 ID 或匿名会话 ID |
| `files` | array | 否 | 当前客户背调不启用文件上传，传 `[]` |

## 后端接口建议

业务后端可以对外提供一个接口，例如：

```text
POST /api/ai/customer-research/messages
```

前端请求业务后端时，只需要传业务字段：

```json
{
  "message": "请背调 Yellow Door Energy，官网 https://www.yellowdoorenergy.com，我卖工商业储能方案。",
  "conversation_id": ""
}
```

后端处理步骤：

1. 校验用户登录态和接口权限。
2. 校验 `message` 不能为空。
3. 根据当前用户找到或创建业务会话。
4. 读取已保存的 Dify `conversation_id`；首轮为空。
5. 调用 Dify `POST /chat-messages`。
6. 保存 Dify 返回的 `conversation_id`、`message_id`、`task_id` 和必要用量信息。
7. 返回前端需要展示的 `answer`。

后端返回前端的建议格式：

```json
{
  "answer": "客户背调分析结果",
  "conversation_id": "Dify 返回的会话 ID",
  "message_id": "Dify 消息 ID",
  "task_id": "Dify 任务 ID"
}
```

## 上下文记忆

Dify 的连续对话上下文依赖两个字段：

1. `conversation_id`
2. `user`

首轮调用时：

```json
{
  "query": "请背调 Yellow Door Energy...",
  "conversation_id": "",
  "user": "yingdan-user-123"
}
```

Dify 返回：

```json
{
  "answer": "...",
  "conversation_id": "conv-xxxx"
}
```

后续追问时，继续传同一个 `conversation_id` 和同一个 `user`：

```json
{
  "query": "那我第一封开发信应该怎么写？",
  "conversation_id": "conv-xxxx",
  "user": "yingdan-user-123"
}
```

这样 Dify 会把后续问题放进同一轮会话里理解，实现类似普通 AI 聊天的上下文效果。

建议业务后端保存一张会话表：

| 字段 | 说明 |
| --- | --- |
| `id` | 业务系统自己的会话 ID |
| `user_id` | 业务系统用户 ID |
| `scene` | 业务场景，例如 `customer_research` |
| `dify_conversation_id` | Dify 返回的 `conversation_id` |
| `title` | 会话标题，可用客户公司名或首轮问题生成 |
| `created_at` | 创建时间 |
| `updated_at` | 最近追问时间 |

## Streaming 返回处理

建议使用 `response_mode: "streaming"`。Dify 会返回 `text/event-stream`，每个分片里通常是 `data: {...}`。

后端需要做的事情：

1. 按 SSE 分片读取 Dify 返回。
2. 解析每个 `data:` 后面的 JSON。
3. 遇到 `payload.answer` 时累积到最终 `answer`。
4. 保存最新的 `conversation_id`、`message_id`、`task_id`。
5. 如果遇到 `event: "error"`，转成业务接口错误返回。

整理后的返回结构可以是：

```json
{
  "answer": "累积后的完整回答",
  "conversation_id": "conv-xxxx",
  "message_id": "msg-xxxx",
  "task_id": "task-xxxx"
}
```

如果业务前端要做打字机效果，后端也可以把 Dify 的 streaming 分片继续转发给前端；如果先做简单版本，后端累积完整 `answer` 后一次性返回即可。

## Python 后端示例

下面是最小 `blocking` 示例，便于理解字段。生产环境建议按上一节改成 `streaming`。

```python
import os
from typing import Any

import requests


DIFY_CHAT_MESSAGES_URL = "https://api.dify.ai/v1/chat-messages"


def call_dify_customer_research(
    query: str,
    user_id: str,
    conversation_id: str = "",
) -> dict[str, Any]:
    """调用 Dify 客户背调 Chatflow。

    作用:
        把客户背调内容发送给 Dify，并返回 Dify 生成的结果。

    参数:
        query: str，本轮客户背调内容或追问内容。
        user_id: str，业务系统用户 ID；Dify 用它区分不同终端用户。
        conversation_id: str，可选；首轮为空，后续追问传上一轮 Dify 返回值。

    返回:
        dict[str, Any]，Dify 返回的 JSON 数据，通常包含 answer、conversation_id、message_id 等字段。

    可能抛出的异常:
        ValueError: query 或 user_id 为空时抛出。
        RuntimeError: 后端环境变量里没有配置 Dify API Key 时抛出。
        requests.HTTPError: Dify 返回非 2xx 状态码时抛出。
        requests.RequestException: 网络、超时、TLS 等请求层异常。
    """
    if not query.strip():
        raise ValueError("query 不能为空")
    if not user_id.strip():
        raise ValueError("user_id 不能为空")

    api_key = os.getenv("DIFY_CUSTOMER_RESEARCH_API_KEY") or os.getenv("DIFY_API_KEY")
    if not api_key:
        raise RuntimeError("缺少 Dify API Key 环境变量")

    response = requests.post(
        DIFY_CHAT_MESSAGES_URL,
        headers={
            # Dify API Key 属于服务端密钥，只能从后端环境变量读取。
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "inputs": {},
            "query": query,
            "response_mode": "blocking",
            "conversation_id": conversation_id,
            "user": user_id,
            "files": [],
        },
        timeout=60,
    )
    response.raise_for_status()
    return response.json()
```

## Node.js Serverless 示例

下面示例展示如何把 Dify streaming 返回累积成普通 JSON。

```js
const DIFY_CHAT_MESSAGES_URL = "https://api.dify.ai/v1/chat-messages";

function parseDifyStream(rawText) {
  const result = {
    answer: "",
    conversation_id: "",
    message_id: "",
    task_id: ""
  };

  rawText.split(/\n\n+/).forEach((block) => {
    block
      .split(/\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.replace(/^data:\s?/, ""))
      .forEach((line) => {
        if (!line || line === "[DONE]") {
          return;
        }

        const payload = JSON.parse(line);

        if (payload.event === "error") {
          throw new Error(payload.message || payload.error || "Dify 返回错误");
        }

        if (payload.answer) {
          result.answer += payload.answer;
        }

        result.conversation_id = payload.conversation_id || result.conversation_id;
        result.message_id = payload.message_id || payload.id || result.message_id;
        result.task_id = payload.task_id || result.task_id;
      });
  });

  return result;
}

async function callDifyCustomerResearch({ query, user, conversationId }) {
  const apiKey = process.env.DIFY_CUSTOMER_RESEARCH_API_KEY || process.env.DIFY_API_KEY;

  if (!apiKey) {
    throw new Error("缺少 Dify API Key 环境变量");
  }

  const response = await fetch(DIFY_CHAT_MESSAGES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      inputs: {},
      query,
      response_mode: "streaming",
      conversation_id: conversationId || "",
      user,
      files: []
    })
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(rawText || `Dify 返回 HTTP ${response.status}`);
  }

  return parseDifyStream(rawText);
}
```

## 环境变量

建议后端配置：

```text
DIFY_CUSTOMER_RESEARCH_API_KEY=<Dify app-开头的 API Key>
```

如果还有其他 Dify 应用，建议每个应用单独配置环境变量，避免多个业务共用一个 key 后不好排查。

## 安全注意事项

- 不要把真实 Dify API Key 写进前端代码、文档、提交信息或日志。
- 不要把真实客户资料完整写进普通日志。
- 日志建议只记录必要 ID、状态码、耗时、错误摘要和 token 用量。
- Dify 返回的 `answer` 可能包含 `<think>...</think>`，正式展示前要过滤。
- Dify 返回内容不能直接当 HTML 插入 DOM，要先做 HTML 转义或安全 Markdown 渲染，避免 XSS。
- 如果要统计成本，可以读取 `metadata.usage`，但不要把内部成本字段直接暴露给普通用户。

## Smoke Test

直接测试 Dify Service API：

```bash
export DIFY_CUSTOMER_RESEARCH_API_KEY='<DIFY_API_KEY>'

curl -sS -X POST 'https://api.dify.ai/v1/chat-messages' \
  -H "Authorization: Bearer ${DIFY_CUSTOMER_RESEARCH_API_KEY}" \
  -H 'Content-Type: application/json' \
  --data '{
    "inputs": {},
    "query": "这是一条客户背调连通性测试。请只回复：Dify 连通成功。",
    "response_mode": "blocking",
    "conversation_id": "",
    "user": "yd-dev-smoke-test",
    "files": []
  }'
```

预期：

- HTTP 状态为 `200`。
- 返回 JSON 中包含 `answer`。
- 返回 JSON 中包含 `conversation_id`，后续追问要继续传这个值。
- 如果返回 `401` 或 `403`，优先检查 API Key 和 Dify 应用权限。
