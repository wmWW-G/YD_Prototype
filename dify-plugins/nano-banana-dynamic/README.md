# Dynamic Image Generator（Dify Tool Plugin）

由 Dify Plugin CLI 生成的 Python Tool Plugin，可在 Dify Workflow / Chatflow 中动态调用：

- Nano Banana 2：gemini-3.1-flash-image
- Nano Banana Pro：gemini-3-pro-image
- OpenRouter GPT Image 2：openai/gpt-image-2

模型、画面比例和分辨率是 Dify 原生下拉框；提示词与视觉参考图可绑定上游变量。模型列表只包含上述三个，不包含老版 Nano Banana。

## 参数

| 参数 | 必填 | 示例 | 说明 |
| --- | --- | --- | --- |
| prompt | 是 | 生成白底产品主图 | 生成或编辑指令 |
| model | 是 | Nano Banana 2 | 原生下拉框，只有 Nano Banana 2 / Pro / GPT Image 2 |
| aspect_ratio | 否 | 16:9 | 原生下拉框；用于 Nano Banana 2 / Pro，默认 auto |
| resolution | 否 | 2K | 原生下拉框；用于 Nano Banana 2 / Pro |
| images | 否 | 上游图片文件变量 | Nano Banana 2 / Pro 最多 14 张，GPT Image 2 最多 16 张 |

Nano Banana Pro 支持的比例：1:1、2:3、3:2、3:4、4:3、4:5、5:4、9:16、16:9、21:9。

Nano Banana 2 在上述比例之外，还支持 1:4、4:1、1:8、8:1。

Nano Banana 2 与 Nano Banana Pro 的 Gemini Interactions 请求使用 `image/jpeg` 输出，插件会将结果作为 `.jpg` 文件返回给 Dify。

### GPT Image 2 尺寸说明

OpenRouter 当前的 `openai/gpt-image-2` endpoint 能力没有声明 `aspect_ratio`、`resolution` 或 `size`。因此选择 GPT Image 2 时，插件不会把这三个字段发给 OpenRouter，避免产生 400 错误；输出尺寸由供应商自动选择。工具的 JSON 元数据会返回 `dimension_control_applied: false` 和请求值，便于工作流判断。

GPT Image 2 的图片质量不再单独显示。插件固定发送 `quality: auto`，让模型自动选择。

### Dify 条件显示限制

当前 Dify Tool Plugin 参数规范尚不支持根据另一个 Tool 参数实时隐藏字段。因此模型、比例和分辨率都会保持可见；选择 GPT Image 2 时，比例和分辨率会被安全忽略。

## 安装

已经有 .difypkg 时，在 Dify 中打开“插件 → 安装插件 → 通过本地文件”，上传插件包即可。

安装完成后，在“工具 → 动态生图 → 授权”中配置：

- 使用 Nano Banana 2 或 Nano Banana Pro：填写 Google AI Studio 创建的 Gemini API Key。
- 使用 GPT Image 2：填写 OpenRouter API Key。
- 两个密钥均为可选字段，但至少填写一个；要在同一个工具节点中切换三个模型时，请两个都填。

## 本地调试

要求 Python 3.12 与 Dify Plugin CLI：

~~~bash
cp .env.example .env
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m main
~~~

.env 中填写 Dify 插件调试页面提供的真实值：

~~~env
INSTALL_METHOD=remote
REMOTE_INSTALL_URL=debug-plugin.dify.dev:5003
REMOTE_INSTALL_KEY=<你的调试密钥>
~~~

不要提交 .env，不要把 Gemini API Key、OpenRouter API Key 或 Dify 调试密钥写进代码与 README。

## 工作流绑定示例

~~~text
开始节点（prompt / images）
  → Dynamic Image Generator 工具节点
      └─ 在节点内下拉选择 model / aspect_ratio / resolution
  → 使用工具输出的图片文件
~~~

本插件根据模型调用 Google Gemini Interactions API 或 OpenRouter Image API，不经过自建中转服务。
