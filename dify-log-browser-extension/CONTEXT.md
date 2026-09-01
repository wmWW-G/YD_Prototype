# TokenMind Dify 日志查询扩展

## 这个项目做什么

这是一个独立的 Chrome Manifest V3 Side Panel 扩展。用户已经登录 Dify Cloud，并打开 `https://cloud.dify.ai/app/{app_id}/logs` 后，可以按用户 ID、当前应用、对话特征文本、Run ID 和北京时间范围查询运行日志，也可以按指定 Conversation 汇总原币种运行成本。扩展复用浏览器现有登录态，不需要复制 Cookie、CSRF、API Key 或维护本地凭据文件。

当前版本为 `0.1.0`，只支持 Dify Cloud，不支持自托管 Dify。它与项目原有的 `browser-extension/` 赢单询盘分析插件完全独立，不共享权限、状态、代码或打包产物。

## 入口和请求流

Chrome 加载入口是 `manifest.json`，工具栏图标打开 `sidepanel.html`。请求链如下：

1. `background.js` 验证当前活动标签页严格匹配 `/app/{uuid}/logs`。
2. 页面正常发出 Console GET 时，后台只暂存 `X-CSRF-Token`，并在同一个请求收到 2xx 后写入 `chrome.storage.session`。
3. Side Panel 保持打开时，用户可以点击当前 App 卡片里的“重新读取”，再次识别当前活动的 Dify 日志页，不需要关闭插件。随后用户选择四种查询场景之一，进入独立操作页并点击“开始查询”。查询过程中会用 `QUERY_PARTIAL` 一边加载一边展示脱敏结果和真实 `已处理 X/Y` 进度；点击“取消”后，后台用 `AbortController` 中止尚未完成的 GET，界面保留已经加载的安全结果。`sidepanel.js` 只提交 App ID、标签页 ID、模式、用户 ID、Conversation ID、marker、时间和最大分页数等结构化条件。
4. `background.js` 自行构造 URL，使用 `credentials: "include"` 让 Chrome 自动携带登录 Cookie，并显式加入当前 CSRF。
5. `query-engine.js` 编排分页、严格用户匹配、对话特征文本定位、Run ID 直查、运行详情和节点查询，随后立即生成脱敏白名单结果。失败查询初始阶段只用六并发读取 Run 详情并持续更新错误占比，节点执行在点击分类后才读取；成本查询要求 Conversation ID，只保留这个对话在时间窗内的 Run，再从节点执行元数据读取 `total_price` 与 `currency`，不再额外读取 Run 详情。用户 ID 可选；一旦填写，必须先通过会话列表严格确认该 Conversation 归属于该用户。两类详情都使用五分钟、最多 2000 条的脱敏内存缓存，缓存不保存原始响应。
6. `sidepanel.js` 只通过 `textContent` 展示覆盖摘要。失败查询默认展示错误类型聚合，点击分类后通过 `LOAD_ERROR_CATEGORY` 加载该类 Run 和失败节点；成本查询分别展示 USD、RMB 或接口以后返回的其他币种，不执行汇率换算。特征文本匹配多个 Run 时也会逐步追加，并按创建时间从新到旧排列。

## 关键文件

- `manifest.json`：Chrome 114+、Side Panel、后台 Worker、Token Mind 图标和 `https://cloud.dify.ai/*` 最小主机范围。
- `background.js`：活动页验证、成功 GET 的 CSRF 关联、`chrome.storage.session`、只读请求白名单、流式快照、错误分类会话授权、查询中止和消息入口。
- `query-engine.js`：北京时间、分页、严格用户 ID 匹配、对话特征文本定位、Run ID 直查、六并发详情读取、五分钟脱敏缓存、错误归类与聚合、按币种成本累计和结果脱敏。
- `sidepanel.html` / `sidepanel.css` / `sidepanel.js`：白底场景首页、四个独立查询页、确定/不确定进度、流式结果、取消、认证提示、覆盖摘要、按需加载的错误类型折叠组和成本卡片。
- `icons/`：从 Token Mind 品牌资源复制并自包含的 SVG 与 PNG 图标。
- `tests/`：Node 内置测试运行器使用的离线测试，不发送网络请求。
- `package-extension.sh`：在项目根目录生成 `dify-log-browser-extension-v0.1.0.zip`，ZIP 根目录直接包含 `manifest.json`。

## 状态、消息和数据边界

后台唯一鉴权状态键是 `difyCsrfContext`，只写入 `chrome.storage.session`，结构为 `{ csrfToken, capturedAt, origin }`。它不会持久化到磁盘，并在浏览器重启、扩展重载或停用后清空。

内部消息为：

- `GET_ACTIVE_CONTEXT`：读取并验证当前 Dify 日志页。
- `REFRESH_AUTH_CONTEXT`：用户明确点击后刷新当前日志页，并等待一次新的成功 Console GET。
- `RUN_QUERY`：提交固定字段的只读查询。
- `CANCEL_QUERY`：按当前 `queryId` 中止仍在进行的查询请求。
- `QUERY_PROGRESS`：只传阶段和页数/数量，不传用户 ID、marker 或业务内容。
- `QUERY_PARTIAL`：后台向 Side Panel 推送查询引擎已经脱敏的阶段性报告。
- `LOAD_ERROR_CATEGORY`：Side Panel 只提交当前 `queryId` 和分类名称；后台根据自己保存的分类到 Run ID 映射读取节点，不接受面板提供任意 Run ID。

查询模式为 `user-failed`、`app-failed`、`marker`、`run-id` 和 `cost`。`marker` 在界面中称为“对话关键词或特征文本”，需要时间范围，用户 ID 只是可选的缩小范围条件；不填用户 ID 时扫描时间窗和分页覆盖内的会话。`run-id` 直接读取单次运行，不需要用户 ID 或时间范围。`cost` 必须填写 Conversation ID，用户 ID 可选用于严格归属校验；它不发送状态过滤，只读取目标 Conversation 在时间窗内成功和失败 Run 的节点成本，跳过 Run 详情，并保留任意合法币种代码。时间选项为 `today`、`recent-1h`、`recent-4h` 和 `custom`，全部按 `Asia/Shanghai` 解释；默认最大分页数为 30。

允许的线上请求必须是当前 App 下的 Console GET，路径族仅包括会话列表、会话消息、运行列表、运行计数、运行详情和节点执行。扩展不得读取、保存、记录或展示 Cookie、Authorization、输入、输出、Prompt、回答、工具载荷、原始错误和堆栈，也不得运行、重试、停止或修改任何 Dify 工作流。界面里的“取消”只中止插件自己的读取请求，不会停止 Dify 工作流。401/403 只允许刷新页面并整体重试一次，402 不重试。

## 新需求通常改哪里

- 改查询字段、分页、错误分类或脱敏白名单：先在 `tests/query-engine.test.js` 写失败测试，再改 `query-engine.js`。
- 改登录态捕获、请求白名单或消息：先在 `tests/background-policy.test.js` 写失败测试，再改 `background.js` 和必要的 `manifest.json`。
- 改侧边栏交互或视觉：先补 `tests/sidepanel-contract.test.js`，再改 `sidepanel.html`、`sidepanel.css`、`sidepanel.js`。
- 改分发文件：先补 `tests/package-contract.test.js`，再改 `package-extension.sh`。

不要把任意 URL、请求动作或请求头参数开放给 Side Panel，也不要新增 `cookies`、`<all_urls>` 或自托管主机权限。公开上架 Chrome Web Store 前，仍需单独完成隐私说明、商店审核资料和版本发布流程。

## 本地运行和验证

在项目根目录运行：

```bash
node --test dify-log-browser-extension/tests/*.test.js
node --check dify-log-browser-extension/background.js
node --check dify-log-browser-extension/query-engine.js
node --check dify-log-browser-extension/sidepanel.js
python3 -m json.tool dify-log-browser-extension/manifest.json >/dev/null
sh dify-log-browser-extension/package-extension.sh
unzip -t dify-log-browser-extension-v0.1.0.zip
```

Chrome 手工加载：打开 `chrome://extensions`，开启开发者模式，选择“加载已解压的扩展程序”，选中本目录。随后在同一 Chrome 配置中打开已经登录的 Dify App 日志页，点击 Token Mind 图标打开侧边栏。若显示“等待登录态”，点击“刷新日志页”；不要打开开发者工具复制凭据。

如果页面无法识别，确认 URL 是否严格为 Dify Cloud 的 `/app/{uuid}/logs`。如果刷新后仍无法取得登录上下文，确认该 Chrome 配置已经登录且有当前 App 权限。任何浏览器验证都只能使用短时间窗的只读查询，不发送测试消息。
