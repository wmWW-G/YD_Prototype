# Dify Chatflow 资料库

这个目录用于记录「赢单」项目里在 Dify 创建的 Chatflow 应用、API 调用方式、参数快照和真实测试结果。

这里记录的是后端/工作流对接资料，不是页面原型代码。主静态原型仍然优先修改根目录的 `index.html`、`src/data.js`、`src/app.js` 和 `src/styles.css`。

## 目录命名

每个 Dify Chatflow 单独建一个子目录，建议使用下面格式：

```text
dify-chatflows/<一级功能区>-<二级模块>-<chatflow名称>/
```

示例：

```text
dify-chatflows/成交顾问-客户背调顾问-客户背调DeepSeek/
dify-chatflows/成交顾问-询盘分析回复-询盘分析DeepSeek/
dify-chatflows/客户Kass-客户档案-跟进建议/
```

如果同一个赢单功能会调用多个 Dify Chatflow，就为每个 Chatflow 建独立目录，不要把多个应用混在一个文件里。

## 已记录 Chatflow

| 赢单功能路径 | Chatflow 目录 | Dify 应用 | 状态 |
| --- | --- | --- | --- |
| `成交顾问 > 客户背调顾问` | `成交顾问-客户背调顾问-客户背调DeepSeek/` | `客户背调DeepSeek` | 已完成 2026-07-04 API 连通性测试，`POST /chat-messages` 和 `GET /parameters` 均返回 `200` |

## 每个 Chatflow 目录应包含

- `chatflow.md`：人类可读的完整说明，记录赢单功能路径、Dify 应用入口、基础 URL、主要接口、字段映射和维护状态。
- `call-function.md`：脱敏后的调用函数或 curl，说明鉴权占位、请求体、返回字段和后端封装建议。
- `parameters.snapshot.json`：从 `GET /parameters` 读取的应用参数快照，不能包含 API Key。
- `api-test.md`：真实试跑记录，包括测试时间、请求摘要、HTTP 状态、返回结构、异常和结论。

## 维护流程

1. 先确认 Chatflow 属于哪个赢单功能路径，例如 `成交顾问 > 客户背调顾问`。
2. 在 `dify-chatflows/` 下创建对应子目录。
3. 用 `chatflow.md` 记录 Dify 页面链接、应用名称、用途和维护状态。
4. 用 `call-function.md` 记录脱敏调用方式，真实 API Key 只能写成环境变量占位。
5. 用 `GET /parameters` 保存参数快照，判断是否有表单变量、文件上传或语音能力。
6. 用最小虚拟输入做 API smoke test，把 HTTP 状态、耗时、返回字段和问题写入 `api-test.md`。

## 安全规则

- 不要写入真实 API Key、Token、Cookie、密码或账号密钥。
- 不要把 Dify API Key 放进前端、浏览器插件、`src/app.js` 或任何用户可见页面。
- 调用样例统一使用 `<DIFY_API_KEY>` 或环境变量 `$DIFY_API_KEY`。
- 测试时不要发送真实客户资料、真实聊天记录、手机号、邮箱或其他隐私。
- 如果需要接入正式产品，必须由后端代理调用 Dify，前端只请求赢单自己的后端接口。
