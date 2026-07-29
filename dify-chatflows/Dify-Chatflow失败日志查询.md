# Dify Chatflow 失败日志查询

用于在 Dify Cloud 正式环境中直接找出 Chatflow 失败运行，并定位失败节点和原始错误。不要只依赖 Dify 日志列表界面判断原因。

## 接口从哪里发现

这些不是 Dify 公开的 Service API，而是登录 Dify Cloud 控制台后使用的内部 Console API。发现和确认过程如下：

1. 在已登录的 Dify Cloud 中抓取日志页网络请求，确认 Console API 路径格式及 CSRF 鉴权方式。
2. 在 Dify 开源代码和 OpenAPI 资料中搜索 `advanced-chat/workflow-runs`，确定候选路由。
3. 在正式环境登录态下只读测试候选接口，以 HTTP 200、失败数量和返回字段互相校验。

因此，Dify Cloud 升级后如果接口失效，应重新抓取控制台网络请求并验证，不能假定内部接口永久不变。

## 已验证接口

### 1. 获取失败运行

```text
GET /console/api/apps/{app_id}/advanced-chat/workflow-runs
    ?triggered_from=app-run
    &status=failed
    &limit=100
```

主要返回字段：

- `id`：`workflow_run_id`
- `conversation_id`
- `message_id`
- `elapsed_time`
- `created_at`
- `finished_at`
- `has_more`

分页时，如果 `has_more=true`，把本页最后一条的 `id` 作为下一页 `last_id`，直到 `has_more=false`。

### 2. 统计时间窗口内的失败数

```text
GET /console/api/apps/{app_id}/advanced-chat/workflow-runs/count
    ?triggered_from=app-run
    &status=failed
    &time_range=2d
```

`time_range` 是相对时间。查询“昨天和今天”时，还要把 `created_at` 转换为 `Asia/Shanghai`，再按北京时间自然日过滤。

### 3. 获取单次运行详情

```text
GET /console/api/apps/{app_id}/workflow-runs/{workflow_run_id}
```

用于读取运行状态、总错误、耗时、步骤数和运行时间。

### 4. 获取失败节点

```text
GET /console/api/apps/{app_id}/workflow-runs/{workflow_run_id}/node-executions
```

从 `data[]` 中筛选 `status == "failed"`，保留：

- `node_id`
- `node_type`
- `title`
- `error`
- `elapsed_time`
- 模型 `provider` / `model`
- 节点 `retry_config` / `error_strategy`

## 推荐查询顺序

```text
失败运行列表
  → workflow_run_id
  → 运行详情
  → node-executions
  → 筛选 failed 节点
  → 按错误特征归类和计数
```

常用错误归类：

- `402 Insufficient Balance`：供应商余额问题，不应重试。
- `503 UNAVAILABLE`：模型供应商临时不可用，可有限重试。
- Plugin Daemon `500`、serverless `502`、`management/tools` 或 `management/list` 失败：Dify Plugin 基础设施异常，可有限重试并提交 Dify 工单。
- `closed network connection` / `failed to read system header`：调用链读取响应时连接被关闭；结合耗时判断长请求风险，但不能仅凭该日志断言是哪一端主动关闭。

## 容易走错的路径

- `chat-conversations` 可以读取会话，但实测附加 `status=failed`、`failure` 或 `error` 会被忽略，不能直接筛选失败运行。
- 公开 Service API `/v1/workflows/logs` 在 Chatflow 场景中可能返回空列表，不能据此判断没有失败记录。
- Dify 日志列表界面只显示 `FAILURE` 时，应继续查询运行详情和失败节点，不能只看界面名称猜原因。

## 鉴权与安全

- Console API 需要 Dify Cloud 登录会话和 CSRF Token，不能只用 App API Key 调用。
- 不保存或输出 Cookie、CSRF Token、App API Key。
- 不在诊断结果中输出客户输入、完整 `inputs`、`outputs`、`graph` 或工具原始返回。
- 对外只保留运行 ID、时间、节点名称、脱敏错误、模型名称和重试配置。
