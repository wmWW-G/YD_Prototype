# Dify Console 日志诊断合同

## 只读接口

默认根地址为 `https://cloud.dify.ai/console/api`，只允许 GET：

| 用途 | 路径 | 关键筛选 |
| --- | --- | --- |
| 会话列表 | `/apps/{app_id}/chat-conversations` | `keyword`、`page`、`limit`、`start`、`end`、`sort_by` |
| 会话消息 | `/apps/{app_id}/chat-messages` | `conversation_id`、`limit` |
| 失败运行 | `/apps/{app_id}/advanced-chat/workflow-runs` | `triggered_from=app-run`、`status=failed`、`limit`、`last_id` |
| 状态计数 | `/apps/{app_id}/advanced-chat/workflow-runs/count` | `status`、相对 `time_range`、`triggered_from` |
| Run 详情 | `/apps/{app_id}/workflow-runs/{run_id}` | 无 |
| 节点执行 | `/apps/{app_id}/workflow-runs/{run_id}/node-executions` | 无 |

`chat-conversations.keyword` 会模糊匹配消息、会话名称和终端用户 session ID。按用户 ID 查询时，它只用于缩小服务端候选集；最终必须严格比较 `from_end_user_session_id`。

`chat-conversations.start/end` 使用当前 Console 用户时区，按页面请求格式传 `YYYY-MM-DD HH:mm`。不要附加秒；当前 Cloud 环境会对 `YYYY-MM-DD HH:mm:ss` 返回 400。若用户的结束时间包含秒，查询参数向上覆盖到对应分钟，响应返回后再按精确时间戳做本地裁剪。

失败运行列表支持 `status=failed`，但不支持绝对 `start/end`。它按创建时间倒序返回；调用方要用 `last_id` 翻页、在本地过滤 `created_at`，整页均早于起点时方可提前停止。计数接口的 `time_range` 是 `7d`、`4h` 一类相对区间，只能辅助核对，不能替代用户指定的绝对时间窗。

不要用 `chat-conversations?status=failed` 代替失败运行接口，不要用空的 Service API `/v1/workflows/logs` 断言没有失败。

## Chrome 登录态

浏览器路径利用页面已有登录态，不要求操作者复制或保存凭据。当前验证过的执行链是：

1. 打开目标日志页并启用 CDP Network。
2. 通过搜索、翻页或刷新触发一条页面自身成功的 Console GET。
3. 按 request ID 关联成功响应与请求事件，只读取该请求的 `X-CSRF-Token`；不要读取或返回 `Cookie`、`Authorization` 等其他请求头。
4. 将 CSRF 只保存在当前浏览器运行时变量中。通过 CDP `Runtime.evaluate` 在同一页面发出白名单 GET，使用 `credentials: "include"` 让 Chrome 自行携带登录 Cookie，并显式添加当前 CSRF。
5. 请求完成后只返回分页状态、白名单运维字段和脱敏错误分类；不要把原始响应、请求头或令牌带出浏览器运行时。

Dify Web 的请求封装会自动把当前 CSRF 加到页面请求中，因此只有 Cookie 而缺少 CSRF 的原始 `fetch` 可能返回 401。遇到 401/403 时先刷新页面并重新捕获当前 CSRF，只允许一次重试，避免使用过期令牌反复查询。

页面没有 `status`、`triggered_from` 或分页控件不构成阻塞。此时直接使用上述浏览器内白名单 GET；不要退回会话页 Failure 徽标，也不要把无参数调试历史当成 `app-run` 失败列表。

允许的浏览器内路径必须以当前 Dify origin 的 `/console/api/apps/{app_id}/` 开头，并且仅限本文件“只读接口”表中的 GET。禁止读取 Cookie、Local Storage、密码、浏览器 profile 或隐藏会话存储，也禁止把 CSRF 输出、保存或提交。

## 脱敏字段白名单

Run 允许输出：

- `id` / `workflow_run_id`、`conversation_id`
- `status`、`triggered_from`
- `created_at`、`finished_at`、`elapsed_time`
- `total_steps`、`total_tokens`
- 归类后的 `error_category`

失败节点允许输出：

- `id`、`node_id`
- `title`、`node_type`
- `status`、`elapsed_time`
- `created_at`、`finished_at`
- `retry_index`
- 归类后的 `error_category`

禁止输出 `inputs`、`outputs`、`query`、`prompt`、`answer`、工具输入输出、原始 error、Cookie、Token 或 Authorization。

## 覆盖率声明

每份报告至少说明：

- 实际起止时间、时区、目标应用、用户 ID（若有）与 `status=failed`。
- 会话页数、失败 run 页数，以及是否达到页数上限。
- 候选会话数、失败列表记录数、匹配 run 数。
- 消息无 run ID、详情或节点读取失败等未覆盖项。
- 每个结论属于已核验事实、证据推断还是待核验项。

“没有匹配记录”只能解释为“在本次应用、时间窗、筛选条件和分页覆盖内未匹配”。
