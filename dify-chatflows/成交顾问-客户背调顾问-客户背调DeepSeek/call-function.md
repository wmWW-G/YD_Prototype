# 调用函数

## 基本信息

- 函数名：待开发同事封装
- 语言/框架：建议后端封装，避免前端暴露 Dify API Key
- 运行位置：赢单后端服务
- 依赖包：HTTP client
- API 基础 URL：`https://api.dify.ai/v1`
- 主要接口：`POST /chat-messages`
- 鉴权方式：`Authorization: Bearer <DIFY_API_KEY>`

## 脱敏 curl 示例

真实 API Key 不要写入项目文件。测试或后端运行时从环境变量读取。

```bash
export DIFY_API_KEY='<DIFY_API_KEY>'

curl -sS -X POST 'https://api.dify.ai/v1/chat-messages' \
  -H "Authorization: Bearer ${DIFY_API_KEY}" \
  -H 'Content-Type: application/json' \
  --data '{
    "inputs": {},
    "query": "请根据以下客户背景做背调：<CUSTOMER_CONTEXT>",
    "response_mode": "blocking",
    "conversation_id": "",
    "user": "<YINGDAN_USER_ID>",
    "files": []
  }'
```

## 请求参数说明

| 参数 | 类型 | 来源 | 说明 |
| --- | --- | --- | --- |
| `inputs` | object | Dify 应用变量 | 当前参数快照中没有表单变量，可先传 `{}` |
| `query` | string | 客户背调输入区 | 用户要背调的客户信息和问题 |
| `response_mode` | string | 后端配置 | `blocking` 便于测试；正式产品更适合 `streaming` |
| `conversation_id` | string | 后端会话状态 | 首轮为空，连续追问时传上一轮返回值 |
| `user` | string | 赢单用户 ID | 用于 Dify 侧区分终端用户 |
| `files` | array | 文件输入 | 当前文件上传未启用，传空数组 |

## 返回说明

| 返回字段 | 类型 | 去向 | 说明 |
| --- | --- | --- | --- |
| `event` | string | 后端解析 | blocking 模式本次观察为 `message` |
| `answer` | string | 客户背调结果 | 模型生成内容；本次观察包含 `<think>` 标签，正式展示前建议过滤 |
| `conversation_id` | string | 后端会话状态 | 用于后续追问 |
| `message_id` | string | 后端日志 | 可用于问题追踪 |
| `task_id` | string | 后端日志 | 可用于任务追踪 |
| `metadata.usage` | object | 成本/用量统计 | 包含 tokens、价格、耗时等字段 |

## 后端封装建议

```python
import os
from typing import Any

import requests


def call_dify_customer_research(
    customer_context: str,
    user_id: str,
    conversation_id: str = "",
) -> dict[str, Any]:
    """调用 Dify 客户背调 Chatflow。

    参数:
        customer_context: str，用户输入的客户背景、官网、国家、行业或背调问题。
        user_id: str，赢单系统里的用户标识，传给 Dify 的 user 字段。
        conversation_id: str，可选；上一轮 Dify 返回的会话 ID，用于连续追问。

    返回:
        dict[str, Any]，Dify 返回的 JSON 对象，通常包含 answer、conversation_id、message_id 等字段。

    可能抛出的异常:
        ValueError: 当 customer_context 或 user_id 为空时抛出，避免无意义调用。
        RuntimeError: 当环境变量 DIFY_API_KEY 未配置时抛出。
        requests.HTTPError: 当 Dify 返回非 2xx 状态码时抛出。
        requests.RequestException: 当网络连接、超时或 TLS 等请求层问题发生时抛出。
    """
    if not customer_context.strip():
        raise ValueError("customer_context 不能为空")
    if not user_id.strip():
        raise ValueError("user_id 不能为空")

    api_key = os.getenv("DIFY_API_KEY")
    if not api_key:
        raise RuntimeError("缺少环境变量 DIFY_API_KEY")

    response = requests.post(
        "https://api.dify.ai/v1/chat-messages",
        headers={
            # API Key 只从后端环境变量读取，不能写进前端代码。
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "inputs": {},
            "query": customer_context,
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

## 调用注意事项

- 不要在前端写入真实 API Key，正式产品应由后端代理调用。
- `user` 要稳定且唯一，便于 Dify 侧统计和排查。
- 连续追问时要保存 `conversation_id`，否则 Dify 不会带上上一轮上下文。
- 测试记录里只保存返回结构和必要摘要，不保存真实客户原文。
- 正式展示前建议过滤 `<think>...</think>` 这类模型思考标签。
