# 项目上下文

## 项目目标

这是一个由 Dify Plugin CLI 生成的 Python Tool Plugin。它只将 Nano Banana 2、Nano Banana Pro 和 GPT Image 2 封装为同一个 Dify 工具。模型、比例、分辨率使用 Dify 原生下拉框；提示词与视觉参考图可引用上游变量。

## 入口与数据流

- 进程入口：main.py
- 插件声明：manifest.yaml
- 供应商授权入口：provider/nano-banana-dynamic.yaml
- API Key 校验：provider/nano-banana-dynamic.py
- 工具参数声明：tools/nano-banana-dynamic.yaml
- 生图请求与结果解析：tools/nano-banana-dynamic.py

请求路径：Dify Tool 节点 → 参数校验/标准化 → 按模型分发到 Google Gemini Interactions API 或 OpenRouter Image API → 解析 Base64 图片 → Dify BLOB 图片与 JSON 元数据。

## 关键状态与结构

- 正式模型 ID：gemini-3.1-flash-image、gemini-3-pro-image、openai/gpt-image-2
- 参数名：prompt、images、model、aspect_ratio、resolution
- 上游变量参数：prompt、images
- 下拉配置参数：model、aspect_ratio、resolution
- API 凭证名：gemini_api_key、openrouter_api_key；两者至少配置一个
- Nano Banana 2 / Pro 实际应用 aspect_ratio 和 resolution；GPT Image 2 的 quality 内部固定为 auto
- Nano Banana 2 / Pro 的 Interactions API 输出 MIME 固定请求 image/jpeg；Dify BLOB 文件名应为 .jpg
- OpenRouter GPT Image 2 当前能力未包含 aspect_ratio / resolution / size，所以这两个请求值只记录到元数据，不发送给 API
- 当前 dify-plugin 0.6.2 的 ToolParameter 没有 show_on，不能根据 model 在前端实时隐藏比例/分辨率字段
- 输出：零到多条文本、一到多张 BLOB 图片、一条 JSON 请求元数据
- 日志：Python 标准库 logging，通过 Dify SDK 日志处理器输出；不记录提示词、图片或密钥

## 新需求通常改哪里

- 增加参数：同时修改 tools/nano-banana-dynamic.yaml 和对应 Python 校验/请求体
- 增加模型或比例：修改工具 Python 文件中的模型、比例和分辨率常量
- 调整凭证：修改 provider YAML 与 provider Python
- 调整 Dify 兼容版本或运行时：修改 manifest.yaml

不要把 Gemini API Key、OpenRouter API Key 或 Dify Remote Install Key 写进仓库；不要把 API 地址改成用户可控变量，以免引入 SSRF 风险。

## 本地运行与验证

运行环境是 Python 3.12。安装 requirements.txt 后，复制 .env.example 为 .env，填写 Dify 调试地址和密钥，然后执行 python -m main。

静态检查与打包：

~~~bash
python -m compileall main.py provider tools tests
python -m unittest discover -s tests -v
dify plugin package ./nano-banana-dynamic
~~~

最终端到端验证需要用户提供 Dify Remote Install Key 和相应供应商密钥；密钥只放入本地 .env 或 Dify 授权界面。
