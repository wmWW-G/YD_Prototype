# Dify Chatflow 内部 API 索引

这份文档记录 Dify 开源代码中已经存在、但没有完整出现在公开 Chatflow Service API 文档里的接口。用途是后续排障、监控、备份和内部运维，不是面向客户的稳定集成合同。

收录范围是与 Chatflow 应用运行、编辑、发布和运营直接相关的接口；工作区成员、账单、知识库管理、插件市场等其他 Console 模块不在本文逐项展开。需要完整清单时，以第 1 节的 Console Swagger 为准。

## 结论

Dify 不只有公开的 `/v1` Service API。源码里至少还有两套接口：

| 接口面 | 前缀 | 鉴权 | 主要用途 | 稳定性 |
|---|---|---|---|---|
| Service API | `/v1` | App API Key | 给外部程序调用已发布应用 | 官方公开、优先使用 |
| Console API | `/console/api` | 控制台登录会话、CSRF、RBAC | 日志、编辑器、版本、统计、导入导出、后台管理 | 内部接口，可能随版本变化 |
| WebApp API | `/api` | WebApp 会话或访问上下文 | Dify 自带 WebApp 页面运行 | 内部接口，不适合作为后台管理 API |

刚才用于查询失败运行的接口属于 **Console API**，不是公开 `/v1` API。App API Key 不能代替 Console 登录态。

三套接口的源码注册入口：

- [Service API `/v1`](https://github.com/langgenius/dify/blob/d94314627f2c0cacb20620ca973f1b9b6e46b4b9/api/controllers/service_api/__init__.py)
- [Console API `/console/api`](https://github.com/langgenius/dify/blob/d94314627f2c0cacb20620ca973f1b9b6e46b4b9/api/controllers/console/__init__.py)
- [WebApp API `/api`](https://github.com/langgenius/dify/blob/d94314627f2c0cacb20620ca973f1b9b6e46b4b9/api/controllers/web/__init__.py)

## 核对范围与标记

- 核对日期：2026-07-28
- 核对源码：Dify GitHub `main`
- 核对时提交：`d94314627f2c0cacb20620ca973f1b9b6e46b4b9`
- `✅ 已验证`：已在 Dify Cloud 正式环境做过只读调用。
- `🔎 源码确认`：路由和实现已在源码确认，但没有逐个调用正式环境。
- `⚠️ 执行/写入`：会运行模型、消耗费用或修改配置。
- `🛑 高风险`：会删除数据、覆盖应用或轮换令牌。

> Dify Cloud 部署版本可能落后于 GitHub `main`。调用任何内部接口前，应先看当前环境的 Swagger 或浏览器网络请求，不要只凭本文永久假定路径不变。

## 1. 隐藏的接口总目录

### Console Swagger

Dify 的 `ExternalApi` 会在 `SWAGGER_UI_ENABLED=true` 时生成 Swagger。Console API 对应地址通常是：

```text
GET /console/api/swagger-ui.html
GET /console/api/swagger.json
```

用途：

- `swagger-ui.html`：交互式查看当前部署版本实际注册的 Console API。
- `swagger.json`：机器可读的全部路由、请求参数和响应结构，最适合后续自动生成接口清单。

限制：

- Dify Cloud 或生产环境可能关闭 Swagger，出现 404 不代表接口不存在。
- Swagger 是否开启由部署配置决定，不能用 App API Key 强行访问。

另有：

```text
GET /console/api/spec/schema-definitions
```

它返回前端组件使用的 JSON Schema 定义，**不是完整接口目录**。

对应源码：

- [Console API 注册入口](https://github.com/langgenius/dify/blob/d94314627f2c0cacb20620ca973f1b9b6e46b4b9/api/controllers/console/__init__.py)
- [Swagger 生成逻辑](https://github.com/langgenius/dify/blob/d94314627f2c0cacb20620ca973f1b9b6e46b4b9/api/libs/external_api.py)
- [Swagger 环境变量](https://github.com/langgenius/dify/blob/d94314627f2c0cacb20620ca973f1b9b6e46b4b9/api/.env.example)
- [Schema Definitions 接口](https://github.com/langgenius/dify/blob/d94314627f2c0cacb20620ca973f1b9b6e46b4b9/api/controllers/console/spec.py)

## 2. 失败运行、节点错误和运行日志

这是目前最有价值、也已经验证过的一组接口。

| 方法与路径 | 能做什么 | 标记 |
|---|---|---|
| `GET /console/api/apps/{app_id}/advanced-chat/workflow-runs` | 查询 Chatflow 运行；可按 `status`、`triggered_from` 分页筛选 | ✅ 已验证 |
| `GET /console/api/apps/{app_id}/advanced-chat/workflow-runs/count` | 按相对时间窗口统计成功、失败、运行中等数量 | ✅ 已验证 |
| `GET /console/api/apps/{app_id}/workflow-runs` | 查询 Workflow 或 Advanced Chat 运行列表 | 🔎 源码确认 |
| `GET /console/api/apps/{app_id}/workflow-runs/count` | 统计 Workflow 或 Advanced Chat 运行数量 | 🔎 源码确认 |
| `GET /console/api/apps/{app_id}/workflow-runs/{run_id}` | 获取单次运行的状态、错误、输入输出摘要、耗时和用量 | ✅ 已验证 |
| `GET /console/api/apps/{app_id}/workflow-runs/{run_id}/node-executions` | 获取每个节点的状态、错误、耗时、模型和重试配置 | ✅ 已验证 |
| `GET /console/api/apps/{app_id}/workflow-runs/{run_id}/export` | 获取归档运行包的临时下载地址；依赖归档存储配置 | 🔎 源码确认 |
| `GET /console/api/workflow/{run_id}/pause-details` | 查看运行暂停在哪个人工输入节点、表单和恢复入口 | 🔎 源码确认 |
| `POST /console/api/apps/{app_id}/workflow-runs/tasks/{task_id}/stop` | 停止控制台调试任务 | ⚠️ 执行/写入 |

筛选失败 Chatflow 的关键参数：

```text
triggered_from=app-run
status=failed
limit=100
last_id={上一页最后一个运行ID}
```

详细查询流程、分页、时区和错误归类见 [Dify-Chatflow失败日志查询.md](./Dify-Chatflow失败日志查询.md)。

以下两组接口只适用于 Workflow 应用，不能替代 Advanced Chat 的失败运行接口：

| 方法与路径 | 能做什么 | 标记 |
|---|---|---|
| `GET /console/api/apps/{app_id}/workflow-app-logs` | 查询 Workflow 应用日志，可按关键词、状态、时间、用户和账号筛选 | 🔎 源码确认 |
| `GET /console/api/apps/{app_id}/workflow-archived-logs` | 查询已归档的 Workflow 执行日志 | 🔎 源码确认 |

对应源码：

- [Workflow Run 控制器](https://github.com/langgenius/dify/blob/d94314627f2c0cacb20620ca973f1b9b6e46b4b9/api/controllers/console/app/workflow_run.py)
- [Workflow App Log 控制器](https://github.com/langgenius/dify/blob/d94314627f2c0cacb20620ca973f1b9b6e46b4b9/api/controllers/console/app/workflow_app_log.py)

## 3. 草稿、单节点调试、发布和版本

这组接口就是 Dify 可视化编辑器背后使用的能力。

| 方法与路径 | 能做什么 | 标记 |
|---|---|---|
| `GET /console/api/apps/{app_id}/workflows/draft` | 读取草稿图、功能配置、Hash 和变量 | 🔎 源码确认 |
| `POST /console/api/apps/{app_id}/workflows/draft` | 保存或同步草稿图、功能和变量 | ⚠️ 执行/写入 |
| `POST /console/api/apps/{app_id}/advanced-chat/workflows/draft/run` | 运行 Chatflow 草稿，不必先发布 | ⚠️ 会调用模型 |
| `POST /console/api/apps/{app_id}/workflows/draft/run` | 运行 Workflow 草稿 | ⚠️ 会调用模型 |
| `POST /console/api/apps/{app_id}/workflows/draft/nodes/{node_id}/run` | 单独运行一个节点做调试 | ⚠️ 可能调用模型或工具 |
| `GET /console/api/apps/{app_id}/workflows/draft/nodes/{node_id}/last-run` | 读取该节点最近一次调试结果 | 🔎 源码确认 |
| `POST /console/api/apps/{app_id}/advanced-chat/workflows/draft/iteration/nodes/{node_id}/run` | 调试 Chatflow 的迭代节点 | ⚠️ 可能产生多次调用 |
| `POST /console/api/apps/{app_id}/advanced-chat/workflows/draft/loop/nodes/{node_id}/run` | 调试 Chatflow 的循环节点 | ⚠️ 可能产生多次调用 |
| `POST /console/api/apps/{app_id}/advanced-chat/workflows/draft/human-input/nodes/{node_id}/form/preview` | 预览人工输入表单 | 🔎 源码确认 |
| `POST /console/api/apps/{app_id}/advanced-chat/workflows/draft/human-input/nodes/{node_id}/form/run` | 调试人工输入节点 | ⚠️ 执行/写入 |
| `POST /console/api/apps/{app_id}/workflows/draft/human-input/nodes/{node_id}/delivery-test` | 测试人工输入通知投递 | ⚠️ 可能向外部渠道发测试通知 |
| `GET /console/api/apps/{app_id}/workflows/publish` | 获取当前已发布版本 | 🔎 源码确认 |
| `POST /console/api/apps/{app_id}/workflows/publish` | 发布当前草稿，可附版本名称和备注 | ⚠️ 修改线上应用 |
| `GET /console/api/apps/{app_id}/workflows` | 查询历史版本列表 | 🔎 源码确认 |
| `POST /console/api/apps/{app_id}/workflows/{workflow_id}/restore` | 把历史版本恢复成草稿 | ⚠️ 覆盖当前草稿 |
| `PATCH /console/api/apps/{app_id}/workflows/{workflow_id}` | 修改版本名称或备注 | ⚠️ 执行/写入 |
| `DELETE /console/api/apps/{app_id}/workflows/{workflow_id}` | 删除未被引用的非草稿版本 | 🛑 删除 |
| `POST /console/api/apps/{app_id}/workflows/draft/features` | 更新草稿功能开关 | ⚠️ 执行/写入 |
| `POST /console/api/apps/{app_id}/convert-to-workflow` | 把 Chat/Completion 应用转换并创建为 Workflow 应用 | ⚠️ 新建应用 |

编辑器默认节点配置：

```text
GET /console/api/apps/{app_id}/workflows/default-workflow-block-configs
GET /console/api/apps/{app_id}/workflows/default-workflow-block-configs/{block_type}
```

另外，源码里还有 Draft Trigger 的事件轮询和批量触发调试接口。其路径和方法在不同版本变化较快，使用时应直接查当前环境的 `swagger.json`，不在这里固定成长期合同。

对应源码：[Workflow 编辑与发布控制器](https://github.com/langgenius/dify/blob/d94314627f2c0cacb20620ca973f1b9b6e46b4b9/api/controllers/console/app/workflow.py)

## 4. 草稿运行变量

这些是编辑器调试状态，不等同于公开 API 里的线上会话变量。

| 方法与路径 | 能做什么 | 标记 |
|---|---|---|
| `GET /console/api/apps/{app_id}/workflows/draft/variables` | 列出草稿运行时变量 | 🔎 源码确认 |
| `DELETE /console/api/apps/{app_id}/workflows/draft/variables` | 清空当前用户缓存的草稿变量 | 🛑 删除调试状态 |
| `GET /console/api/apps/{app_id}/workflows/draft/nodes/{node_id}/variables` | 查看某节点的草稿变量 | 🔎 源码确认 |
| `DELETE /console/api/apps/{app_id}/workflows/draft/nodes/{node_id}/variables` | 清空某节点的草稿变量 | 🛑 删除调试状态 |
| `GET/PATCH/DELETE /console/api/apps/{app_id}/workflows/draft/variables/{variable_id}` | 读取、修改或删除单个草稿变量 | ⚠️ 写入；DELETE 为高风险 |
| `PUT /console/api/apps/{app_id}/workflows/draft/variables/{variable_id}/reset` | 把变量重置到初始值 | ⚠️ 执行/写入 |
| `GET/POST /console/api/apps/{app_id}/workflows/draft/conversation-variables` | 读取或写入草稿会话变量 | ⚠️ POST 会写入 |
| `GET /console/api/apps/{app_id}/workflows/draft/system-variables` | 读取草稿可用的系统变量 | 🔎 源码确认 |
| `GET/POST /console/api/apps/{app_id}/workflows/draft/environment-variables` | 读取或写入草稿环境变量 | ⚠️ 可能含敏感配置 |

大变量和文件变量的响应可能带临时签名下载地址，不应把完整响应写入日志或提交 Git。

对应源码：[Workflow Draft Variable 控制器](https://github.com/langgenius/dify/blob/d94314627f2c0cacb20620ca973f1b9b6e46b4b9/api/controllers/console/app/workflow_draft_variable.py)

## 5. 后台会话、消息和反馈

公开 Chatflow API 主要面向单个终端用户；下面这些 Console API 可跨终端用户做后台检索和运营。

| 方法与路径 | 能做什么 | 标记 |
|---|---|---|
| `GET /console/api/apps/{app_id}/chat-conversations` | 后台搜索会话；可按内容、名称、时间、终端用户、标注状态排序和分页 | 🔎 源码确认 |
| `GET /console/api/apps/{app_id}/chat-conversations/{conversation_id}` | 获取会话详情，并在控制台语义下标记已读 | 🔎 源码确认 |
| `DELETE /console/api/apps/{app_id}/chat-conversations/{conversation_id}` | 删除会话 | 🛑 删除 |
| `GET /console/api/apps/{app_id}/chat-messages` | 按 `conversation_id` 分页读取后台消息历史 | 🔎 源码确认 |
| `GET /console/api/apps/{app_id}/messages/{message_id}` | 获取单条消息及执行附加内容 | 🔎 源码确认 |
| `POST /console/api/apps/{app_id}/feedbacks` | 管理员写入消息反馈 | ⚠️ 执行/写入 |
| `GET /console/api/apps/{app_id}/feedbacks/export` | 按来源、评分、是否评论和日期导出反馈 | 🔎 源码确认 |
| `GET /console/api/apps/{app_id}/annotations/count` | 统计应用标注数量 | 🔎 源码确认 |
| `GET /console/api/apps/{app_id}/chat-messages/{message_id}/suggested-questions` | 为调试消息生成下一轮建议问题 | ⚠️ 会调用模型 |

注意：`chat-conversations` 不支持可靠的 `status=failed` 运行筛选；查故障应使用第 2 节的 `workflow-runs`。

对应源码：

- [Conversation 控制器](https://github.com/langgenius/dify/blob/d94314627f2c0cacb20620ca973f1b9b6e46b4b9/api/controllers/console/app/conversation.py)
- [Message 控制器](https://github.com/langgenius/dify/blob/d94314627f2c0cacb20620ca973f1b9b6e46b4b9/api/controllers/console/app/message.py)

## 6. 监控统计

这些接口使用账号时区的 `start`、`end` 范围，并受控制台监控权限控制。

### Chatflow / Chat 及通用应用统计

```text
GET /console/api/apps/{app_id}/statistics/daily-messages
GET /console/api/apps/{app_id}/statistics/daily-conversations
GET /console/api/apps/{app_id}/statistics/daily-end-users
GET /console/api/apps/{app_id}/statistics/token-costs
GET /console/api/apps/{app_id}/statistics/average-session-interactions
GET /console/api/apps/{app_id}/statistics/user-satisfaction-rate
GET /console/api/apps/{app_id}/statistics/tokens-per-second
```

可用于按天查看消息、会话、终端用户、Token 成本、平均轮数、满意率和生成速度。

源码里还有：

```text
GET /console/api/apps/{app_id}/statistics/average-response-time
```

但当前实现只允许 Completion 应用，不能把它当作 Chatflow 的平均响应时间接口。

### Workflow 应用

```text
GET /console/api/apps/{app_id}/workflow/statistics/daily-conversations
GET /console/api/apps/{app_id}/workflow/statistics/daily-terminals
GET /console/api/apps/{app_id}/workflow/statistics/token-costs
GET /console/api/apps/{app_id}/workflow/statistics/average-app-interactions
```

这些统计会排除编辑器调试运行，主要统计 `triggered_from=app-run` 的正式调用。

对应源码：

- [Chat/通用统计控制器](https://github.com/langgenius/dify/blob/d94314627f2c0cacb20620ca973f1b9b6e46b4b9/api/controllers/console/app/statistic.py)
- [Workflow 统计控制器](https://github.com/langgenius/dify/blob/d94314627f2c0cacb20620ca973f1b9b6e46b4b9/api/controllers/console/app/workflow_statistic.py)

## 7. 应用管理、备份、导入和部署

| 方法与路径 | 能做什么 | 标记 |
|---|---|---|
| `GET/POST /console/api/apps` | 查询应用列表或创建应用 | ⚠️ POST 会新建 |
| `GET/PUT/DELETE /console/api/apps/{app_id}` | 获取、更新或删除应用 | 🛑 DELETE 会删除应用 |
| `POST /console/api/apps/{app_id}/copy` | 复制应用及其 DSL，并复制 WebApp 权限配置 | ⚠️ 新建应用 |
| `GET /console/api/apps/{app_id}/export` | 导出应用 DSL；可指定 `workflow_id` | 🔎 源码确认 |
| `POST /console/api/apps/imports` | 从 YAML 内容或 URL 新建、覆盖或升级应用 | 🛑 可能覆盖应用 |
| `POST /console/api/apps/imports/{import_id}/confirm` | 确认需要人工处理的导入 | ⚠️ 执行/写入 |
| `GET /console/api/apps/imports/{app_id}/check-dependencies` | 检查 DSL 依赖是否满足 | 🔎 源码确认 |
| `POST /console/api/apps/{app_id}/site-enable` | 启用或关闭 WebApp | ⚠️ 影响线上入口 |
| `POST /console/api/apps/{app_id}/api-enable` | 启用或关闭应用 API | ⚠️ 影响线上调用 |
| `POST /console/api/apps/{app_id}/site` | 更新 WebApp 标题、描述、语言、主题等设置 | ⚠️ 修改线上页面 |
| `POST /console/api/apps/{app_id}/site/access-token-reset` | 重置 WebApp 访问令牌 | 🛑 会使旧令牌失效 |
| `POST /console/api/apps/{app_id}/name` | 修改应用名称 | ⚠️ 执行/写入 |
| `POST /console/api/apps/{app_id}/icon` | 修改应用图标和颜色 | ⚠️ 执行/写入 |

应用 Service API Key 也由 Console API 管理：

| 方法与路径 | 能做什么 | 标记 |
|---|---|---|
| `GET /console/api/apps/{app_id}/api-keys` | 列出应用 API Key、创建时间和最后使用时间；响应包含完整 Token | 🛑 高敏感读取 |
| `POST /console/api/apps/{app_id}/api-keys` | 创建新的 `app-` API Key；当前源码每个应用最多 10 个 | 🛑 创建密钥 |
| `DELETE /console/api/apps/{app_id}/api-keys/{api_key_id}` | 撤销指定 API Key，并清理缓存 | 🛑 会使该 Key 立即失效 |

导出接口可能支持 `include_secret=true`。除非做受控迁移，否则应保持 `false`；任何包含密钥的 DSL 都不能写入日志、文档或 Git。

对应源码：

- [App 管理控制器](https://github.com/langgenius/dify/blob/d94314627f2c0cacb20620ca973f1b9b6e46b4b9/api/controllers/console/app/app.py)
- [App Import 控制器](https://github.com/langgenius/dify/blob/d94314627f2c0cacb20620ca973f1b9b6e46b4b9/api/controllers/console/app/app_import.py)
- [WebApp Site 控制器](https://github.com/langgenius/dify/blob/d94314627f2c0cacb20620ca973f1b9b6e46b4b9/api/controllers/console/app/site.py)
- [API Key 控制器](https://github.com/langgenius/dify/blob/d94314627f2c0cacb20620ca973f1b9b6e46b4b9/api/controllers/console/apikey.py)

## 8. 链路追踪

```text
GET/POST/PATCH/DELETE /console/api/apps/{app_id}/trace-config
GET/POST /console/api/apps/{app_id}/trace
```

用途：

- `trace-config`：管理 LangSmith、Langfuse 等追踪供应商配置。
- `trace`：查看或切换应用当前启用的追踪供应商。

风险：

- 追踪配置可能包含访问密钥。
- 开启后，输入、输出或元数据可能被发送给第三方追踪平台。
- 不应把接口完整响应写入诊断报告。

对应源码：

- [Trace Config 控制器](https://github.com/langgenius/dify/blob/d94314627f2c0cacb20620ca973f1b9b6e46b4b9/api/controllers/console/app/ops_trace.py)
- [App Trace 开关](https://github.com/langgenius/dify/blob/d94314627f2c0cacb20620ca973f1b9b6e46b4b9/api/controllers/console/app/app.py)

## 9. Trigger、标注批处理、MCP Server 和 AI 生成助手

### Trigger 管理

```text
GET  /console/api/apps/{app_id}/triggers
POST /console/api/apps/{app_id}/trigger-enable
GET  /console/api/apps/{app_id}/workflows/triggers/webhook?node_id={node_id}
```

- 查询应用的计划、插件等 Trigger。
- 启用或关闭 Trigger。
- 获取 Workflow Webhook 节点信息；Webhook 路由主要面向 Workflow，不应默认认为 Chatflow 可用。

对应源码：[Workflow Trigger 控制器](https://github.com/langgenius/dify/blob/d94314627f2c0cacb20620ca973f1b9b6e46b4b9/api/controllers/console/app/workflow_trigger.py)

### 标注的额外运维能力

公开文档已有标注 CRUD，但源码还提供：

```text
GET    /console/api/apps/{app_id}/annotations/export
POST   /console/api/apps/{app_id}/annotations/batch-import
GET    /console/api/apps/{app_id}/annotations/batch-import-status/{job_id}
GET    /console/api/apps/{app_id}/annotations/{annotation_id}/hit-histories
DELETE /console/api/apps/{app_id}/annotations
POST   /console/api/apps/{app_id}/annotation-reply/{enable|disable}
GET    /console/api/apps/{app_id}/annotation-reply/{action}/status/{job_id}
```

可导出、批量导入、检查任务状态、查看命中历史、清空全部标注，以及异步启停标注回复。清空全部标注属于高风险删除操作。

对应源码：[Annotation 控制器](https://github.com/langgenius/dify/blob/d94314627f2c0cacb20620ca973f1b9b6e46b4b9/api/controllers/console/app/annotation.py)

### 把应用配置成 MCP Server

```text
GET  /console/api/apps/{app_id}/server
POST /console/api/apps/{app_id}/server
PUT  /console/api/apps/{app_id}/server
GET  /console/api/apps/{server_id}/server/refresh
```

可查看、创建或更新应用的 MCP Server 名称、描述、参数、状态和 `server_code`。`refresh` 会重新生成 `server_code`，可能使依赖旧地址的调用失效，属于高风险操作。

这是较新的能力，Dify Cloud 当前环境未必已经部署。

对应源码：[MCP Server 控制器](https://github.com/langgenius/dify/blob/d94314627f2c0cacb20620ca973f1b9b6e46b4b9/api/controllers/console/app/mcp_server.py)

### AI 生成编辑器内容

```text
POST /console/api/rule-generate
POST /console/api/rule-code-generate
POST /console/api/rule-structured-output-generate
POST /console/api/instruction-generate
POST /console/api/instruction-generate/template
POST /console/api/workflow-generate
POST /console/api/workflow-generate/suggestions
POST /console/api/workflow-generate/stream
```

这些接口可让模型生成规则、代码、结构化输出 Schema、节点指令、模板和完整 Workflow/Chatflow 草稿。`workflow-generate/stream` 使用事件流返回规划和结果。

它们会消耗模型额度；生成结果通常还需要通过草稿保存接口写入，不等于自动发布。

对应源码：[Generator 控制器](https://github.com/langgenius/dify/blob/d94314627f2c0cacb20620ca973f1b9b6e46b4b9/api/controllers/console/app/generator.py)

## 10. 后续查询和使用顺序

以后遇到“公开文档没有，但控制台能做到”的功能，按这个顺序查：

1. 先确认 Dify Cloud 或自托管实例的实际版本。
2. 尝试读取 `/console/api/swagger.json`；能读取时，以它为当前环境的第一准据。
3. Swagger 关闭时，在已登录控制台中打开浏览器开发者工具，操作一次对应功能并观察 Network。
4. 回到相同版本的 GitHub 源码，搜索路由片段或控制器名称，确认参数、权限和副作用。
5. 先做只读调用；写入、运行、发布、删除和令牌轮换必须单独确认。
6. 把验证日期、部署版本、HTTP 状态和关键返回字段补到本文，不能只记录猜测。

建议优先级：

- 正式业务集成：优先使用公开 `/v1` API。
- 故障排查和监控：使用只读 Console API。
- 自动备份：可考虑 `export`，但默认 `include_secret=false`。
- 编辑、发布、导入、删除：只在受控内部工具里使用，不直接暴露给普通终端用户。

## 11. 安全边界

- Console API 必须依赖登录会话、CSRF 和 RBAC；不要保存或硬编码 Cookie、CSRF Token。
- App API Key 只能按其公开用途调用 `/v1`，不能用于冒充 Console 身份。
- 不输出客户消息全文、完整输入输出、文件签名 URL、供应商密钥或追踪配置。
- 不把 GitHub `main` 的接口存在，等同于当前正式环境已经部署。
- 未经明确确认，不调用本文中标记为写入、发布、覆盖、删除或令牌轮换的接口。
- Dify 升级后，应重新读取 Swagger 或控制台 Network，再更新本文。
