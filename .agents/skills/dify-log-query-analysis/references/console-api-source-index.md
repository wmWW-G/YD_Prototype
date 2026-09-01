# Dify Console 查询接口源码索引

本索引于 2026-08-19 核对 Dify 官方仓库 `langgenius/dify` 的 `main` 分支。这里列的是 Console 内部接口，不是公开稳定 API；不同部署版本可能改变参数、权限或响应结构。真实诊断时应以目标环境页面成功发出的 Network 请求为准。

## 会话与用户 ID

- 官方源码：[api/controllers/console/app/conversation.py](https://github.com/langgenius/dify/blob/main/api/controllers/console/app/conversation.py)
- 响应字段：[api/fields/conversation_fields.py](https://github.com/langgenius/dify/blob/main/api/fields/conversation_fields.py)

`GET /console/api/apps/{app_id}/chat-conversations` 支持 `keyword`、`start`、`end`、`page`、`limit`、`annotation_status` 和 `sort_by`。`keyword` 会通过 `ILIKE` 模糊匹配消息 query/answer、会话名称/简介和 `EndUser.session_id`；按用户 ID 查询时必须在响应中再次严格比较 `from_end_user_session_id`。

`start/end` 会按当前 Console 用户时区解释。目标 Cloud 页面现场使用 `YYYY-MM-DD HH:mm`；带秒的 `YYYY-MM-DD HH:mm:ss` 在 2026-08-19 实测返回 400。`sort_by=-created_at` 时按创建时间过滤和倒序；不要把本地字符串时间当 UTC 直接拼接，响应返回后仍要按用户的精确起止时间本地裁剪。

## 失败 workflow run

- 路由与参数：[api/controllers/console/app/workflow_run.py](https://github.com/langgenius/dify/blob/main/api/controllers/console/app/workflow_run.py)
- 服务层关联：[api/services/workflow_run_service.py](https://github.com/langgenius/dify/blob/main/api/services/workflow_run_service.py)
- SQL 分页与过滤：[api/repositories/sqlalchemy_api_workflow_run_repository.py](https://github.com/langgenius/dify/blob/main/api/repositories/sqlalchemy_api_workflow_run_repository.py)

`GET /console/api/apps/{app_id}/advanced-chat/workflow-runs` 支持：

- `status`: `running`、`succeeded`、`failed`、`stopped`、`partial-succeeded`
- `triggered_from`: `debugging` 或 `app-run`
- `limit`: 1–100
- `last_id`: 下一页游标

列表没有绝对 `start/end` 参数。仓储层按 `created_at DESC` 排序，并用 `last_id` 对应记录的创建时间继续向更早数据翻页。因此指定时间查询应本地过滤 `created_at`；当整页全部早于起点时可安全停止，达到最大页数仍有后续页时必须报告截断。

`GET /console/api/apps/{app_id}/advanced-chat/workflow-runs/count` 支持 `status`、`triggered_from` 和相对 `time_range`，可用于状态概览，但不能精确表示任意绝对起止窗口。

每个匹配 run 继续读取：

- `GET /console/api/apps/{app_id}/workflow-runs/{run_id}`
- `GET /console/api/apps/{app_id}/workflow-runs/{run_id}/node-executions`

只有实际取得这些响应后，才能报告 run 详情或失败节点。

## 页面鉴权

- 官方 Web 请求封装：[web/service/fetch.ts](https://github.com/langgenius/dify/blob/main/web/service/fetch.ts)

Dify 页面请求会携带 Cookie，并从 CSRF Cookie 写入对应请求头。页面自己的 Network 请求成功、缺少 CSRF 的同源 `fetch` 失败，表示鉴权上下文不完整，并不表示接口不可用。页面没有目标筛选控件时，可从一条成功的 Console GET 中只取得当前 `X-CSRF-Token`，在同一页面内配合 `credentials: "include"` 调用白名单 GET；令牌只留在浏览器内存，不输出或持久化。
