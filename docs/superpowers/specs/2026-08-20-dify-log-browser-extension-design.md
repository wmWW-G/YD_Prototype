# Dify 日志浏览器插件设计

## 目标

在用户已经登录 Dify Cloud、并打开某个应用的日志页面时，通过独立 Chrome Side Panel 插件完成 `dify-log-query-analysis` Skill 已定义的只读日志查询。插件要消除手工打开 F12、复制 Cookie/CSRF、维护 `.env` 或反复让自动化工具操作 Chrome 的步骤，同时保留 Skill 的接口白名单、时间裁剪、严格用户匹配、覆盖率声明和脱敏边界。

第一版只支持 `https://cloud.dify.ai/app/{app_id}/logs`，不支持自托管域名，不发送测试消息，不运行或重试 Chatflow，也不修改 Dify 线上数据。

## 技术选择与目录边界

- 新建独立目录 `dify-log-browser-extension/`，不修改或复用现有 `browser-extension/` 询盘分析插件的权限、后台脚本和发布包。
- 使用原生 JavaScript、Chrome Manifest V3 和 Side Panel API，最低 Chrome 版本为 114。
- 不使用 React、TypeScript、第三方运行时或后端服务；解压目录可直接通过 Chrome“加载已解压的扩展程序”。
- 使用 Token Mind 品牌资源：工具栏图标采用黑底圆形标志，侧边栏标题采用透明底标志。源文件来自 `tokenmind-skill-hub/public/brand/`，交付目录内保存自包含副本和扩展所需 PNG 尺寸。

## 用户界面

插件仅在当前活动标签页符合 `/app/{uuid}/logs` 时进入可查询状态。侧边栏顶部明确展示当前应用 ID，避免静默使用旧应用或其他标签页的上下文。用户点击“开始查询”即确认向当前应用提交筛选条件。

查询模式有三种：

1. 用户失败：必填终端用户 ID 和时间范围，固定查询 `status=failed`。
2. 应用失败：只填时间范围，查询当前应用全部 `status=failed` 运行。
3. 精确诊断：必填终端用户 ID、marker 和时间范围，只在用户主动提供 marker 时启用。

时间范围支持“今天”“最近 1 小时”“最近 4 小时”和自定义起止时间。所有输入都按 `Asia/Shanghai` 解释，并在结果中回显明确起止时间。高级区提供保守的最大分页数设置，默认 30 页；达到上限且仍有后续数据时必须显示“覆盖可能截断”。

查询过程中展示当前阶段、已读取页数和已匹配数量。结果区先显示覆盖摘要，再按运行展示脱敏字段和失败节点。没有匹配时只能说明“在当前应用、时间窗、筛选条件和分页覆盖内未匹配”。

## 浏览器鉴权与请求路径

后台 Service Worker 使用 `chrome.webRequest` 观察 `https://cloud.dify.ai/console/api/*` 的 GET 请求。它只从 `onBeforeSendHeaders` 中暂存 `X-CSRF-Token`，再通过同一 request ID 的 2xx 完成事件确认该令牌来自成功请求。不得读取、记录或返回 Cookie、Authorization 和其他鉴权头。

确认后的 CSRF 按 Dify origin 存入 `chrome.storage.session`。该存储只存在于浏览器内存，浏览器重启、扩展重载或停用后自动清除，并保持默认的 trusted-context-only 访问级别。

查询由 Service Worker 发起，使用 `credentials: "include"` 让 Chrome 自动携带 Dify 登录 Cookie，并显式添加当前 CSRF。允许的请求必须同时满足：

- 方法严格为 GET。
- origin 严格为 `https://cloud.dify.ai`。
- 路径以当前活动页解析出的 `/console/api/apps/{app_id}/` 开头。
- 路径匹配以下白名单之一：会话列表、会话消息、失败运行、失败运行计数、run 详情、节点执行。

侧边栏不能把任意 URL、方法或请求头传给后台。后台根据结构化查询动作自行构造 URL，避免把扩展变成可被滥用的带登录态请求代理。

如果没有可用 CSRF，界面提示用户刷新当前 Dify 日志页以取得页面成功请求。遇到 401/403 时清除旧 CSRF、刷新当前日志页并只重试一次；第二次仍失败则停止并提示重新登录或检查权限。402 不重试，任何真实复测都不属于本插件能力。

## 查询和脱敏规则

用户失败模式先分页读取 `chat-conversations`，传入 `keyword`、分钟精度 `start/end` 和 `sort_by=-created_at`。服务端 keyword 只用于缩小候选集，返回后必须严格比较 `from_end_user_session_id === userId`。随后分页读取 `advanced-chat/workflow-runs`，固定使用 `triggered_from=app-run`、`status=failed` 和 `limit=100`，再按 conversation ID 和精确时间窗交叉过滤。

应用失败模式直接分页读取失败运行。列表使用 `last_id` 游标并按 `created_at` 本地裁剪；只有整页所有可解析时间均早于起点时才能提前结束。游标缺失、不前进或达到分页上限时保守标记截断。

精确诊断模式在严格匹配会话后读取 `chat-messages`，只在内存中检查 marker，提取 workflow run ID。marker、消息和原始响应均不进入日志或最终结果。

匹配 run 使用最多 3 个并发请求读取详情和 node executions。原始对象返回后立即转换成白名单结构：

- Run：ID、conversation ID、状态、来源、创建/结束时间、耗时、步骤数、Token 数和归类错误。
- 失败节点：ID、node ID、标题、类型、状态、耗时、创建/结束时间、重试序号和归类错误。

禁止输出或持久化 inputs、outputs、query、prompt、answer、工具输入输出、原始 error、完整堆栈和任何鉴权值。普通开发日志只记录无敏感信息的阶段开始/结束、页数、数量和错误类别。

## 组件与文件

- `manifest.json`：最小权限、Side Panel、Service Worker、Token Mind 图标和 Dify Cloud 主机范围。
- `background.js`：Side Panel 行为、活动页验证、CSRF 成功请求关联、白名单 GET 客户端和消息入口。
- `query-engine.js`：纯函数和查询编排，包括时间解析、分页、严格匹配、marker、错误分类与脱敏。
- `sidepanel.html` / `sidepanel.css` / `sidepanel.js`：查询表单、进度、错误状态、覆盖摘要和运行结果。
- `tests/query-engine.test.js`：使用 Node 内置测试运行器，不发送网络请求。
- `icons/`：Token Mind SVG/PNG 自包含资源。

## 验证与交付

离线测试至少覆盖：

- Dify 日志 URL 与 App ID 解析。
- 北京时间快捷窗口和自定义时间。
- 用户 ID 模糊候选后的严格相等筛选。
- `last_id` 分页、时间提前停止和截断声明。
- marker 到 workflow run ID 的关联。
- 错误分类和原始错误脱敏。
- 请求路径白名单拒绝非 GET、错误 origin、其他 App ID 和任意路径。
- 最终结果不包含禁止字段或鉴权值。

完成后执行 Node 测试、Manifest JSON 校验、静态敏感词扫描，并在真实 Chrome 中加载未打包扩展：打开已登录的 Dify 日志页、确认工具栏点击可打开侧栏、确认当前应用识别和表单状态。只有实际完成一次登录态只读查询后，才能声明线上链路验证成功；若本次没有合适的现场筛选条件，则只声明离线与加载验证。

交付包含可直接加载的 `dify-log-browser-extension/` 和一个版本化 ZIP。项目级 `CONTEXT.md` 增加该独立插件的入口、用途、权限和验证说明。
