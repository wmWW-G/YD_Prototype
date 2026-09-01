---
name: dify-log-query-analysis
description: 只读查询和分析 Dify Chatflow 或 Advanced Chat 的 Console 日志。用户要按终端用户 ID、失败状态或指定时间段查询错误、运行记录、失败 workflow run、失败节点时使用；也适用于解释 Dify Console 请求为何 401。默认复用 Chrome 已登录态，不发送测试流量、不重试任务、不修改线上数据。
---

# Dify 日志查询分析

## 核心合同

只执行 Dify Console 的 GET 查询，沿“会话 → 失败 run → run 详情 → node executions”定位错误，并只输出脱敏运维字段。允许直接复用当前 Chrome 登录态和页面成功请求中的当前 CSRF，在浏览器内存中完成查询；不得触发 Chatflow、重试失败任务或修改线上配置。

先确定目标应用、北京时间范围，以及查询模式：

- 用户错误：终端用户 ID + 时间范围，返回该用户在窗口内的失败 run。
- 应用失败：`status=failed` + 时间范围，返回应用在窗口内的失败 run。
- 精确诊断：终端用户 ID + marker + 时间范围，仅在用户已经提供 marker 时使用。

“今天”“刚才”按 `Asia/Shanghai` 展开成明确起止时间，并在结果中回显。不要复用旧任务的 App ID、用户 ID 或时间窗口。

## 默认应用

用户未指定应用时，对以下两个应用使用同一筛选条件并分别报告：

1. 不需要知识库的总库：`f68ca6a0-5b51-47ef-8d29-effb5b974ad0`
2. 全技能总控 Chatflow：`c50fba61-a7e8-4175-b25b-2e46c8dad5b1`

用户给出应用链接、App ID 或明确名称时只查该应用；不要拿当前标签页猜目标。

## 浏览器默认路径

调用本 Skill 后直接使用 `chrome:control-chrome` 和当前 Dify 登录态：

1. 打开 `https://cloud.dify.ai/app/{app_id}/logs`，确认页面已登录，并在查询前启用 CDP Network 采集。
2. 通过翻页、搜索或刷新触发任意一条页面自身成功返回 200 的同源 Console GET，从该请求中只取得当前 `X-CSRF-Token`；令牌只保留在本次浏览器内存中，不输出、不落盘。
3. 页面控件能产生目标请求时直接读取其响应；页面没有状态、来源或分页控件时，不要停在 UI，使用 CDP `Runtime.evaluate` 在同一 Dify 页面内发出白名单 Console GET，并同时传 `credentials: "include"` 与刚取得的 CSRF。
4. 浏览器内精确 GET 只允许本 Skill 列出的会话、消息、失败运行、run 详情和节点执行接口。原始响应在内存中立即缩减为白名单字段，不输出客户内容或鉴权值。
5. 若精确 GET 返回 401/403，刷新日志页、重新捕获当前 CSRF 后只重试一次；仍失败才报告鉴权覆盖缺口。页面请求为 200 而缺少 CSRF 的额外请求为 401，不代表账号无权或没有日志。

Chrome 未连接时，请用户连接 Chrome 扩展；Dify 未登录时，请用户先登录。不要要求操作者打开 F12、复制 Cookie 或维护 `.env`。详细的受控 CDP 执行合同见 [references/diagnostic-contract.md](references/diagnostic-contract.md)。

## 查询规则

### 按用户 ID 查询失败

1. 请求 `chat-conversations` 时传 `keyword={user_id}`、`start`、`end`、`sort_by=-created_at`；`start/end` 必须使用页面实际采用的 `YYYY-MM-DD HH:mm`，不要带秒，否则当前 Cloud 环境会返回 400。
2. `keyword` 在 Dify 服务端是模糊搜索，返回后必须再验证 `from_end_user_session_id === user_id`，不能把部分匹配算作目标用户。
3. 收集严格匹配会话的 ID，再与时间窗内 `status=failed` 的 run 按 `conversation_id` 交叉筛选。
4. 读取每个匹配 run 的详情和 node executions；没有实际取到节点详情时，不得声称已经定位失败节点。

### 按失败状态查询

页面显示词是 `Failure`，Console API 的真实枚举值是 `status=failed`。

1. 分页读取 `advanced-chat/workflow-runs`，固定传 `triggered_from=app-run`、`status=failed`、`limit=100`。
2. 该列表没有绝对 `start/end` 参数；使用 `last_id` 分页，并按 `created_at` 在本地严格裁剪用户指定窗口。
3. 列表按创建时间倒序。当整页可解析时间都早于窗口起点时停止；达到页数上限仍有后续页时标记覆盖可能截断。
4. 不要用 `chat-conversations?status=failed`，也不要用空的 `/v1/workflows/logs` 断言“没有失败”。

内部 Console API 的参数、排序、鉴权和官方源码证据见 [references/console-api-source-index.md](references/console-api-source-index.md)。字段白名单与覆盖率规则见 [references/diagnostic-contract.md](references/diagnostic-contract.md)。这些接口不是稳定公开 API；若源码与现场 Network 不一致，以目标环境的页面成功请求为准，并记录差异。

## 离线验证脚本

[scripts/dify_log_query_analysis.py](scripts/dify_log_query_analysis.py) 只作为解析、分类、脱敏和离线自测工具，不作为线上鉴权备用路径。调用本 Skill 查询线上日志时只使用 Chrome 当前登录态，不要求操作者提供或保存 Cookie、CSRF、Authorization 或凭据文件。

## 输出与停止规则

结果必须包含应用、实际时间窗、筛选条件、分页数、是否截断、候选会话数、失败列表记录数、匹配 run 数和未覆盖项。单条记录只保留 run/conversation ID、状态、时间、耗时、步骤、token、失败节点标题/类型/状态/重试序号，以及归类后的错误。

禁止输出用户问题、模型回答、工作流 inputs/outputs、工具原始结果、原始 error、完整堆栈或任何凭据。没有匹配只能表述为“在本次应用、时间窗、筛选条件和分页覆盖内未匹配”。402 不自动重试；任何真实复测都需用户另行明确授权。

## 验证

```bash
python3 scripts/dify_log_query_analysis.py self-test
python3 /Users/garden/.codex/skills/.system/skill-creator/scripts/quick_validate.py .
```

离线自测不等于线上查询成功；没有实际读取登录态请求时，不得声称线上日志已验证。
