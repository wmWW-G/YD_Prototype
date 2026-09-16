# 五个生图 Workflow · Input / Output Schema

日期：2026-09-16。依据当前本地五份 YAML 的 Start/End 定义及嵌入运行代码整理，版本为 `image-studio-302-v3-candidate`，是候选契约，尚未正式冻结。本文记录现状，不修改 Workflow，不代表已发布或已接入前后端。

## 阅读说明

Input指Dify调用的`inputs`对象；Output指结束节点输出对象（API响应中的业务outputs），不包含Dify的workflow_run_id、运行状态、SSE事件等外层封装。五个流程均无task_id，也无Legacy文件列表输入。密钥与IMAGE_MODEL是环境配置，不是业务Input。

下方先列五份字段表，再提供一份包含全部定义的JSON Schema（Draft 2020-12）。每份输入/输出通过`$defs`中的对应名称定位，引用都在同一个代码块内。它是调用方规范化后的文档Schema，不是声称Dify已部署这份Schema校验器。省略选填字段是推荐写法；JSON Schema的default是说明，不会替调用端自动补值。

文件用Dify的单文件引用对象传入，不能把文件路径或base64字符串直接当作file字段。local_file先上传取upload_file_id；remote_url提供可被Dify读取的URL。运行节点读取Dify解析后的type/mime_type/size进行检查，调用方无需自己伪造这些元数据。

## 公共规则与已知差异

- 所有图片选填；缺少商品身份图/原图时必须有非空instruction。仅Logo或风格图不能替代商品描述。编辑的instruction始终必填。
- 任意图片存在走图生图；全无图片走文生图。套图、详情每个图位都接收全部已上传素材，通过提示词说明哪些素材应忽略。
- language默认英语；direction为开放语义文本，支持新方向；请传有意义的名称。方向负责引导内容，不能替代商品或企业事实。
- Start界面language最多100字符，运行代码最多40；image_text界面4000、运行2000；retry_slot_ids_json界面4000、运行2000。本文Schema采用运行上限，未擅自修改现有定义。
- 代码会去除文本首尾空白；instruction/role/id必填检查针对去空白后的内容。可选文本代码接受null并归一为空，language/visual_direction空值回落默认；调用方建议省略，不依赖不同Dify版本对null的处理。brief键必须存在，代码接受null并转成空字符串。
- quantity在界面是number，代码要求1–10整数，布尔值、小数无效；null在代码回落1。套图与详情不提供quantity，以图位数量为准。
- 比例为创作要求；部分比例底层请求使用auto，不能由此保证生成图片的精确像素比例。

## 主图 · Product Main Image Generation

源文件：[Product_Main_Image_Generation.yaml](/Users/garden/YD/Prototype/dify-workflows/image-studio-302/Product_Main_Image_Generation.yaml)；业务kind=`main`。

| Input | 含义 | 类型 | 必填性 | 默认 | 运行约束 |
|---|---|---|---|---|---|
| `product_image` | 商品图片 | File | 选填 | "—" | 单张 PNG/JPEG/WebP，≤10 MiB |
| `style_image` | 风格参考图 | File | 选填 | "—" | 单张 PNG/JPEG/WebP，≤10 MiB |
| `logo_image` | 品牌 Logo | File | 选填 | "—" | 单张 PNG/JPEG/WebP，≤10 MiB |
| `visual_direction` | 画面方向 | string | 选填 | "简洁展示" | 最多 100 字符 |
| `instruction` | 画面要求 | string | 条件必填，见下文 | "—" | 最多 4000 字符 |
| `language` | 目标语言 | string | 选填 | "英语" | 最多 40 字符 |
| `aspect_ratio` | 画面比例 | string | 选填 | "1:1" | 1:1 / 2:3 / 3:2 / 3:4 / 4:3 / 4:5 / 5:4 / 9:16 / 16:9 |
| `image_text` | 附带信息文字 | string | 条件必填，见下文 | "—" | 最多 2000 字符 |
| `quantity` | 生成数量 | integer | 选填 | 1 | 整数 1–10 |

未传 product_image 时 instruction 必须非空，即使传了风格图或Logo也一样。visual_direction=附带信息 且无 style_image 时 image_text 必须非空；其他方向不使用 image_text，有风格图时忽略附带信息文字。quantity是同一主图创作方向的版数。

Input Schema：`#/$defs/Product_Main_Image_GenerationInput`；Output Schema：`#/$defs/Product_Main_Image_GenerationOutput`。

实际结束节点字段：`result`: object。

源文件 SHA-256：`47ef8283db5d54febbf34970b256b9f06fd2c95c9362d9affe812b88c4272a1a`。

## 套图 · Product Image Set Generation

源文件：[Product_Image_Set_Generation.yaml](/Users/garden/YD/Prototype/dify-workflows/image-studio-302/Product_Image_Set_Generation.yaml)；业务kind=`set`。

| Input | 含义 | 类型 | 必填性 | 默认 | 运行约束 |
|---|---|---|---|---|---|
| `product_image` | 商品图片 | File | 选填 | "—" | 单张 PNG/JPEG/WebP，≤10 MiB |
| `style_image` | 风格参考图 | File | 选填 | "—" | 单张 PNG/JPEG/WebP，≤10 MiB |
| `logo_image` | 品牌 Logo | File | 选填 | "—" | 单张 PNG/JPEG/WebP，≤10 MiB |
| `visual_direction` | 画面方向 | string | 选填 | "简洁展示" | 最多 100 字符 |
| `instruction` | 整套统一要求 | string | 条件必填，见下文 | "—" | 最多 4000 字符 |
| `language` | 目标语言 | string | 选填 | "英语" | 最多 40 字符 |
| `aspect_ratio` | 画面比例 | string | 选填 | "1:1" | 1:1 / 2:3 / 3:2 / 3:4 / 4:3 / 4:5 / 5:4 / 9:16 / 16:9 |
| `slots_json` | 逐张内容 JSON | string | 必填 | "—" | 最多 12000 字符 |
| `retry_slot_ids_json` | 仅重试这些图位（JSON 数组，选填） | string | 选填 | "—" | 最多 2000 字符 |

slots_json必须是2–10个图位；不要求首张是main。没有product_image时instruction必须非空；仅图位brief不能替代此检查。没有quantity输入。

Input Schema：`#/$defs/Product_Image_Set_GenerationInput`；Output Schema：`#/$defs/Product_Image_Set_GenerationOutput`。

实际结束节点字段：`result`: object, `result_json`: string, `plan`: array[object]。

源文件 SHA-256：`1184b6c9ef206f82a30f68dfbfc42af05335c928697e8e0fe05f2eca7ac12ec3`。

## 详情图 · Product Detail Image Generation

源文件：[Product_Detail_Image_Generation.yaml](/Users/garden/YD/Prototype/dify-workflows/image-studio-302/Product_Detail_Image_Generation.yaml)；业务kind=`listing`。

| Input | 含义 | 类型 | 必填性 | 默认 | 运行约束 |
|---|---|---|---|---|---|
| `product_image` | 商品图片 | File | 选填 | "—" | 单张 PNG/JPEG/WebP，≤10 MiB |
| `style_image` | 风格参考图 | File | 选填 | "—" | 单张 PNG/JPEG/WebP，≤10 MiB |
| `logo_image` | 品牌 Logo | File | 选填 | "—" | 单张 PNG/JPEG/WebP，≤10 MiB |
| `visual_direction` | 画面方向 | string | 选填 | "简洁展示" | 最多 100 字符 |
| `instruction` | 整套统一要求 | string | 条件必填，见下文 | "—" | 最多 4000 字符 |
| `language` | 目标语言 | string | 选填 | "英语" | 最多 40 字符 |
| `aspect_ratio` | 画面比例 | string | 选填 | "1:1" | 1:1 / 2:3 / 3:2 / 3:4 / 4:3 / 4:5 / 5:4 / 9:16 / 16:9 |
| `slots_json` | 逐张内容 JSON | string | 必填 | "—" | 最多 12000 字符 |
| `retry_slot_ids_json` | 仅重试这些图位（JSON 数组，选填） | string | 选填 | "—" | 最多 2000 字符 |

slots_json必须是1–10个图位；按输入顺序生成。没有product_image时instruction必须非空；仅图位brief不能替代此检查。没有quantity输入。

Input Schema：`#/$defs/Product_Detail_Image_GenerationInput`；Output Schema：`#/$defs/Product_Detail_Image_GenerationOutput`。

实际结束节点字段：`result`: object, `result_json`: string, `plan`: array[object]。

源文件 SHA-256：`d510ccd9cb64d8be86f28e8e8d1bd46fbcbc942fb8dd8a0c85b2819b89ba1e34`。

## 图片调整 · Generated Image Editing

源文件：[Generated_Image_Editing.yaml](/Users/garden/YD/Prototype/dify-workflows/image-studio-302/Generated_Image_Editing.yaml)；业务kind=`edit`。

| Input | 含义 | 类型 | 必填性 | 默认 | 运行约束 |
|---|---|---|---|---|---|
| `source_image` | 待修改原图 | File | 选填 | "—" | 单张 PNG/JPEG/WebP，≤10 MiB |
| `instruction` | 修改或生成要求 | string | 必填 | "—" | 最多 4000 字符 |
| `language` | 目标语言 | string | 选填 | "英语" | 最多 40 字符 |
| `aspect_ratio` | 画面比例 | string | 选填 | "auto" | 1:1 / 2:3 / 3:2 / 3:4 / 4:3 / 4:5 / 5:4 / 9:16 / 16:9 / auto |

instruction始终必须非空。有source_image时按要求编辑；无图按描述新建。固定1张，无quantity、logo_image、visual_direction输入。language不意味着自动翻译原图文字。

Input Schema：`#/$defs/Generated_Image_EditingInput`；Output Schema：`#/$defs/Generated_Image_EditingOutput`。

实际结束节点字段：`result`: object。

源文件 SHA-256：`1b87d650214c11b6497abde4e383f557eddcbf6de6f25f07ace259e0f8e0020b`。

## 同款扩展 · Similar Product Image Batch Generation

源文件：[Similar_Product_Image_Batch_Generation.yaml](/Users/garden/YD/Prototype/dify-workflows/image-studio-302/Similar_Product_Image_Batch_Generation.yaml)；业务kind=`similar`。

| Input | 含义 | 类型 | 必填性 | 默认 | 运行约束 |
|---|---|---|---|---|---|
| `product_image` | 商品图片 | File | 选填 | "—" | 单张 PNG/JPEG/WebP，≤10 MiB |
| `source_image` | 选中的同款结果图 | File | 选填 | "—" | 单张 PNG/JPEG/WebP，≤10 MiB |
| `instruction` | 画面要求 | string | 条件必填，见下文 | "—" | 最多 4000 字符 |
| `language` | 目标语言 | string | 选填 | "英语" | 最多 40 字符 |
| `aspect_ratio` | 画面比例 | string | 选填 | "1:1" | 1:1 / 2:3 / 3:2 / 3:4 / 4:3 / 4:5 / 5:4 / 9:16 / 16:9 |
| `quantity` | 生成数量 | integer | 选填 | 1 | 整数 1–10 |

product_image和source_image都缺失时instruction必须非空。双图分别提供商品身份和同款风格；单图也可运行。无独立logo_image或visual_direction输入。quantity为同款图片数量。

Input Schema：`#/$defs/Similar_Product_Image_Batch_GenerationInput`；Output Schema：`#/$defs/Similar_Product_Image_Batch_GenerationOutput`。

实际结束节点字段：`result`: object。

源文件 SHA-256：`aaf5143bd902e4c1601e6a58524b59f508e61bae7b404a6b57daab1c78f4ec6b`。

## 套图 / 详情图：字符串内部的 Schema

`slots_json`和`retry_slot_ids_json`在实际Input中都是**JSON字符串，不是原生数组**。

slots_json解析后是有序数组，每项必须且只能包含id、role、brief三个键。id全套唯一，role最长100字符、非空；brief可为空，最长500字符。没有固定方向枚举，旧main/selling/scene等作为兼容别名映射title；新名称直接作为title。套图与详情旧别名对应的title可能不同，不应把title当稳定ID。

```json
[
  {"id":"selling","role":"核心卖点","brief":""},
  {"id":"scene","role":"应用场景","brief":""}
]
```

传入时：`"slots_json": "[{\"id\":\"selling\",\"role\":\"核心卖点\",\"brief\":\"\"},{\"id\":\"scene\",\"role\":\"应用场景\",\"brief\":\"\"}]"`。

retry_slot_ids_json省略或空字符串表示全套执行；非空时须解析为非空、无重复的字符串数组，所有ID必须属于完整slots_json。不能传`[]`表示不重试。重试仍保留完整slots_json、重新规划全套，再只执行指定图位；不是复用上次Prompt。

## Output字段含义与所有分支

| 字段 | 说明 |
|---|---|
| result.kind | main / set / listing / edit / similar，由Workflow固定 |
| contract_version | 当前固定image-studio-302-v3-candidate |
| status | 单次图片响应为succeeded/partial/failed/unknown；整套汇总只有succeeded/partial/failed |
| images | 对象数组，每项是index与HTTPS url；不是字符串URL数组 |
| expected | 主图/同款预期图片数量；调整固定1；整套为本次执行图位数，重试时为子集数量 |
| model | 实际配置的2.5模型ID |
| error_code / retry_advice | 单图结果和items中存在，整套顶层没有这两个字段 |
| items | 本次执行图位结果，按原始顺序排列；不是自动合并历史结果 |
| succeeded_count | status恰好为succeeded的图位数，不是图片数量 |
| failed_slot_ids | 所有非succeeded图位，包含partial和unknown |
| plan | 本次执行图位的最终规划对象数组，含brief与合并约束后的prompt；不是LLM原始visual_summary/style/images结构 |
| result_json | result的JSON字符串副本，不包含plan |

单张images[].index从0开始。图位items[].index与plan[].index保留完整slots_json中的0起始序号，重试可能不连续；图位里的images[].index是该次图片响应内的序号。通常一个图位1张，但供应商数量异常时可能保留多张并标partial。

整套items有两种真实形状：正常归一化结果含kind、contract_version、expected、model等；迭代没有结果的回退项只含slot_id/index/role/title/status/images/error_code/retry_advice。下方oneOf明确保留这个差异，没有把不存在的字段写成必填。

| 场景 | 返回方式 |
|---|---|
| 图片数量正确 | status=succeeded，error_code为空，retry_advice=none |
| 有图片但数量不符 | status=partial，IMAGE_COUNT_MISMATCH，保留已得到的图片 |
| HTTP401/403 | failed / AUTH_OR_PERMISSION |
| HTTP429 | failed / RATE_LIMIT |
| 其他非2xx HTTP | failed / UPSTREAM_HTTP_ERROR |
| HTTP节点默认status_code=0 | unknown / TRANSPORT_OR_TIMEOUT；可能是网络、超时或节点配置异常，不代表一定没生成 |
| 2xx正文含error | failed / PROVIDER_ERROR |
| 响应JSON/图片URL非法或data为空 | failed / INVALID_IMAGE_RESPONSE，images=[] |
| 迭代缺项 | items中unknown / ITERATION_RESULT_MISSING |
| 输入或LLM规划校验抛异常 | Workflow失败，可能根本没有业务outputs；调用方必须另外处理Dify失败状态，不能假设总能读到result |

整套status：全部图位succeeded则succeeded；至少一个succeeded且不是全部则partial；没有任何succeeded则failed。因此即使有partial图位保留图片，整套也可能是failed。所有异常须先核对供应商状态再决定重试，Workflow没有自动付费重试。

## 完整JSON Schema定义

下列根结构仅作为定义容器。验证某一流程时，选用对应`$defs`中的Input或Output作为根，同时保留整个`$defs`。additionalProperties=false表示约定的调用字段集合，不宣称当前Dify会拒绝每个未知字段。

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Image Studio 302 candidate v3 input and output definitions",
  "$defs": {
    "ImageFile": {
      "type": "object",
      "properties": {
        "type": {
          "const": "image"
        },
        "transfer_method": {
          "enum": [
            "local_file",
            "remote_url"
          ]
        },
        "upload_file_id": {
          "type": "string",
          "minLength": 1
        },
        "url": {
          "type": "string",
          "format": "uri"
        }
      },
      "required": [
        "type",
        "transfer_method"
      ],
      "additionalProperties": false,
      "oneOf": [
        {
          "properties": {
            "transfer_method": {
              "const": "local_file"
            }
          },
          "required": [
            "upload_file_id"
          ]
        },
        {
          "properties": {
            "transfer_method": {
              "const": "remote_url"
            }
          },
          "required": [
            "url"
          ]
        }
      ],
      "description": "调用 inputs 时的单文件引用；本地上传ID或远程URL二选一。Dify解析后的文件必须为PNG/JPEG/WebP、0<size<=10485760字节。"
    },
    "Image": {
      "type": "object",
      "properties": {
        "index": {
          "type": "integer",
          "minimum": 0
        },
        "url": {
          "type": "string",
          "format": "uri",
          "pattern": "^https://"
        }
      },
      "required": [
        "index",
        "url"
      ],
      "additionalProperties": false
    },
    "NormalResult": {
      "type": "object",
      "properties": {
        "kind": {
          "enum": [
            "main",
            "set",
            "listing",
            "edit",
            "similar"
          ]
        },
        "contract_version": {
          "const": "image-studio-302-v3-candidate"
        },
        "status": {
          "enum": [
            "succeeded",
            "partial",
            "failed",
            "unknown"
          ]
        },
        "images": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/Image"
          }
        },
        "expected": {
          "type": "integer",
          "minimum": 1,
          "maximum": 10
        },
        "error_code": {
          "enum": [
            "",
            "UPSTREAM_HTTP_ERROR",
            "TRANSPORT_OR_TIMEOUT",
            "AUTH_OR_PERMISSION",
            "RATE_LIMIT",
            "PROVIDER_ERROR",
            "IMAGE_COUNT_MISMATCH",
            "INVALID_IMAGE_RESPONSE"
          ]
        },
        "retry_advice": {
          "enum": [
            "none",
            "check_provider_before_retry"
          ]
        },
        "model": {
          "enum": [
            "gpt-image-2.5-flare",
            "gpt-image-2.5-sunburst"
          ]
        }
      },
      "required": [
        "kind",
        "contract_version",
        "status",
        "images",
        "expected",
        "error_code",
        "retry_advice",
        "model"
      ],
      "additionalProperties": false
    },
    "RenderedSlot": {
      "type": "object",
      "properties": {
        "kind": {
          "enum": [
            "main",
            "set",
            "listing",
            "edit",
            "similar"
          ]
        },
        "contract_version": {
          "const": "image-studio-302-v3-candidate"
        },
        "status": {
          "enum": [
            "succeeded",
            "partial",
            "failed",
            "unknown"
          ]
        },
        "images": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/Image"
          }
        },
        "expected": {
          "const": 1
        },
        "error_code": {
          "enum": [
            "",
            "UPSTREAM_HTTP_ERROR",
            "TRANSPORT_OR_TIMEOUT",
            "AUTH_OR_PERMISSION",
            "RATE_LIMIT",
            "PROVIDER_ERROR",
            "IMAGE_COUNT_MISMATCH",
            "INVALID_IMAGE_RESPONSE"
          ]
        },
        "retry_advice": {
          "enum": [
            "none",
            "check_provider_before_retry"
          ]
        },
        "model": {
          "enum": [
            "gpt-image-2.5-flare",
            "gpt-image-2.5-sunburst"
          ]
        },
        "slot_id": {
          "type": "string",
          "pattern": "^[A-Za-z0-9_-]{1,80}$"
        },
        "index": {
          "type": "integer",
          "minimum": 0,
          "maximum": 9
        },
        "role": {
          "type": "string",
          "minLength": 1,
          "maxLength": 100
        },
        "title": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "kind",
        "contract_version",
        "status",
        "images",
        "expected",
        "error_code",
        "retry_advice",
        "model",
        "slot_id",
        "index",
        "role",
        "title"
      ],
      "additionalProperties": false
    },
    "MissingSlot": {
      "type": "object",
      "properties": {
        "slot_id": {
          "type": "string",
          "pattern": "^[A-Za-z0-9_-]{1,80}$"
        },
        "index": {
          "type": "integer",
          "minimum": 0,
          "maximum": 9
        },
        "role": {
          "type": "string",
          "minLength": 1,
          "maxLength": 100
        },
        "title": {
          "type": "string",
          "minLength": 1
        },
        "status": {
          "const": "unknown"
        },
        "images": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/Image"
          },
          "maxItems": 0
        },
        "error_code": {
          "const": "ITERATION_RESULT_MISSING"
        },
        "retry_advice": {
          "const": "check_provider_before_retry"
        }
      },
      "required": [
        "slot_id",
        "index",
        "role",
        "title",
        "status",
        "images",
        "error_code",
        "retry_advice"
      ],
      "additionalProperties": false
    },
    "SlotInput": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[A-Za-z0-9_-]{1,80}$"
        },
        "role": {
          "type": "string",
          "minLength": 1,
          "maxLength": 100
        },
        "brief": {
          "type": [
            "string",
            "null"
          ],
          "maxLength": 500
        }
      },
      "required": [
        "id",
        "role",
        "brief"
      ],
      "additionalProperties": false
    },
    "PlanItem": {
      "type": "object",
      "properties": {
        "slot_id": {
          "type": "string",
          "pattern": "^[A-Za-z0-9_-]{1,80}$"
        },
        "index": {
          "type": "integer",
          "minimum": 0,
          "maximum": 9
        },
        "role": {
          "type": "string",
          "minLength": 1,
          "maxLength": 100
        },
        "title": {
          "type": "string",
          "minLength": 1
        },
        "brief": {
          "type": "string",
          "maxLength": 500
        },
        "prompt": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "slot_id",
        "index",
        "role",
        "title",
        "brief",
        "prompt"
      ],
      "additionalProperties": false
    },
    "SuiteResult": {
      "type": "object",
      "properties": {
        "kind": {
          "enum": [
            "set",
            "listing"
          ]
        },
        "language": {
          "type": "string",
          "maxLength": 40
        },
        "aspect_ratio": {
          "enum": [
            "1:1",
            "2:3",
            "3:2",
            "3:4",
            "4:3",
            "4:5",
            "5:4",
            "9:16",
            "16:9"
          ]
        },
        "expected": {
          "type": "integer",
          "minimum": 1,
          "maximum": 10
        },
        "model": {
          "enum": [
            "gpt-image-2.5-flare",
            "gpt-image-2.5-sunburst"
          ]
        },
        "contract_version": {
          "const": "image-studio-302-v3-candidate"
        },
        "status": {
          "enum": [
            "succeeded",
            "partial",
            "failed"
          ]
        },
        "items": {
          "type": "array",
          "items": {
            "oneOf": [
              {
                "$ref": "#/$defs/RenderedSlot"
              },
              {
                "$ref": "#/$defs/MissingSlot"
              }
            ]
          },
          "minItems": 1,
          "maxItems": 10
        },
        "succeeded_count": {
          "type": "integer",
          "minimum": 0,
          "maximum": 10
        },
        "failed_slot_ids": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[A-Za-z0-9_-]{1,80}$"
          },
          "uniqueItems": true
        }
      },
      "required": [
        "kind",
        "language",
        "aspect_ratio",
        "expected",
        "model",
        "contract_version",
        "status",
        "items",
        "succeeded_count",
        "failed_slot_ids"
      ],
      "additionalProperties": false
    },
    "Product_Main_Image_GenerationInput": {
      "type": "object",
      "properties": {
        "product_image": {
          "$ref": "#/$defs/ImageFile"
        },
        "style_image": {
          "$ref": "#/$defs/ImageFile"
        },
        "logo_image": {
          "$ref": "#/$defs/ImageFile"
        },
        "visual_direction": {
          "type": "string",
          "maxLength": 100,
          "default": "简洁展示"
        },
        "instruction": {
          "type": "string",
          "maxLength": 4000
        },
        "language": {
          "type": "string",
          "maxLength": 40,
          "default": "英语"
        },
        "aspect_ratio": {
          "type": "string",
          "enum": [
            "1:1",
            "2:3",
            "3:2",
            "3:4",
            "4:3",
            "4:5",
            "5:4",
            "9:16",
            "16:9"
          ],
          "default": "1:1"
        },
        "image_text": {
          "type": "string",
          "maxLength": 2000
        },
        "quantity": {
          "type": "integer",
          "minimum": 1,
          "maximum": 10,
          "default": 1
        }
      },
      "required": [],
      "additionalProperties": false
    },
    "Product_Main_Image_GenerationOutput": {
      "type": "object",
      "properties": {
        "result": {
          "allOf": [
            {
              "$ref": "#/$defs/NormalResult"
            },
            {
              "properties": {
                "kind": {
                  "const": "main"
                }
              }
            }
          ]
        }
      },
      "required": [
        "result"
      ],
      "additionalProperties": false
    },
    "Product_Image_Set_GenerationInput": {
      "type": "object",
      "properties": {
        "product_image": {
          "$ref": "#/$defs/ImageFile"
        },
        "style_image": {
          "$ref": "#/$defs/ImageFile"
        },
        "logo_image": {
          "$ref": "#/$defs/ImageFile"
        },
        "visual_direction": {
          "type": "string",
          "maxLength": 100,
          "default": "简洁展示"
        },
        "instruction": {
          "type": "string",
          "maxLength": 4000
        },
        "language": {
          "type": "string",
          "maxLength": 40,
          "default": "英语"
        },
        "aspect_ratio": {
          "type": "string",
          "enum": [
            "1:1",
            "2:3",
            "3:2",
            "3:4",
            "4:3",
            "4:5",
            "5:4",
            "9:16",
            "16:9"
          ],
          "default": "1:1"
        },
        "slots_json": {
          "type": "string",
          "maxLength": 12000,
          "minLength": 1
        },
        "retry_slot_ids_json": {
          "type": "string",
          "maxLength": 2000
        }
      },
      "required": [
        "slots_json"
      ],
      "additionalProperties": false
    },
    "Product_Image_Set_GenerationSlots": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/SlotInput"
      },
      "minItems": 2,
      "maxItems": 10
    },
    "Product_Image_Set_GenerationOutput": {
      "type": "object",
      "properties": {
        "result": {
          "allOf": [
            {
              "$ref": "#/$defs/SuiteResult"
            },
            {
              "properties": {
                "kind": {
                  "const": "set"
                }
              }
            }
          ]
        },
        "result_json": {
          "type": "string",
          "description": "JSON.parse(result_json) 与 result 内容一致"
        },
        "plan": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/PlanItem"
          },
          "minItems": 1,
          "maxItems": 10
        }
      },
      "required": [
        "result",
        "result_json",
        "plan"
      ],
      "additionalProperties": false
    },
    "Product_Detail_Image_GenerationInput": {
      "type": "object",
      "properties": {
        "product_image": {
          "$ref": "#/$defs/ImageFile"
        },
        "style_image": {
          "$ref": "#/$defs/ImageFile"
        },
        "logo_image": {
          "$ref": "#/$defs/ImageFile"
        },
        "visual_direction": {
          "type": "string",
          "maxLength": 100,
          "default": "简洁展示"
        },
        "instruction": {
          "type": "string",
          "maxLength": 4000
        },
        "language": {
          "type": "string",
          "maxLength": 40,
          "default": "英语"
        },
        "aspect_ratio": {
          "type": "string",
          "enum": [
            "1:1",
            "2:3",
            "3:2",
            "3:4",
            "4:3",
            "4:5",
            "5:4",
            "9:16",
            "16:9"
          ],
          "default": "1:1"
        },
        "slots_json": {
          "type": "string",
          "maxLength": 12000,
          "minLength": 1
        },
        "retry_slot_ids_json": {
          "type": "string",
          "maxLength": 2000
        }
      },
      "required": [
        "slots_json"
      ],
      "additionalProperties": false
    },
    "Product_Detail_Image_GenerationSlots": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/SlotInput"
      },
      "minItems": 1,
      "maxItems": 10
    },
    "Product_Detail_Image_GenerationOutput": {
      "type": "object",
      "properties": {
        "result": {
          "allOf": [
            {
              "$ref": "#/$defs/SuiteResult"
            },
            {
              "properties": {
                "kind": {
                  "const": "listing"
                }
              }
            }
          ]
        },
        "result_json": {
          "type": "string",
          "description": "JSON.parse(result_json) 与 result 内容一致"
        },
        "plan": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/PlanItem"
          },
          "minItems": 1,
          "maxItems": 10
        }
      },
      "required": [
        "result",
        "result_json",
        "plan"
      ],
      "additionalProperties": false
    },
    "Generated_Image_EditingInput": {
      "type": "object",
      "properties": {
        "source_image": {
          "$ref": "#/$defs/ImageFile"
        },
        "instruction": {
          "type": "string",
          "maxLength": 4000,
          "minLength": 1
        },
        "language": {
          "type": "string",
          "maxLength": 40,
          "default": "英语"
        },
        "aspect_ratio": {
          "type": "string",
          "enum": [
            "1:1",
            "2:3",
            "3:2",
            "3:4",
            "4:3",
            "4:5",
            "5:4",
            "9:16",
            "16:9",
            "auto"
          ],
          "default": "auto"
        }
      },
      "required": [
        "instruction"
      ],
      "additionalProperties": false
    },
    "Generated_Image_EditingOutput": {
      "type": "object",
      "properties": {
        "result": {
          "allOf": [
            {
              "$ref": "#/$defs/NormalResult"
            },
            {
              "properties": {
                "kind": {
                  "const": "edit"
                },
                "expected": {
                  "const": 1
                }
              }
            }
          ]
        }
      },
      "required": [
        "result"
      ],
      "additionalProperties": false
    },
    "Similar_Product_Image_Batch_GenerationInput": {
      "type": "object",
      "properties": {
        "product_image": {
          "$ref": "#/$defs/ImageFile"
        },
        "source_image": {
          "$ref": "#/$defs/ImageFile"
        },
        "instruction": {
          "type": "string",
          "maxLength": 4000
        },
        "language": {
          "type": "string",
          "maxLength": 40,
          "default": "英语"
        },
        "aspect_ratio": {
          "type": "string",
          "enum": [
            "1:1",
            "2:3",
            "3:2",
            "3:4",
            "4:3",
            "4:5",
            "5:4",
            "9:16",
            "16:9"
          ],
          "default": "1:1"
        },
        "quantity": {
          "type": "integer",
          "minimum": 1,
          "maximum": 10,
          "default": 1
        }
      },
      "required": [],
      "additionalProperties": false
    },
    "Similar_Product_Image_Batch_GenerationOutput": {
      "type": "object",
      "properties": {
        "result": {
          "allOf": [
            {
              "$ref": "#/$defs/NormalResult"
            },
            {
              "properties": {
                "kind": {
                  "const": "similar"
                }
              }
            }
          ]
        }
      },
      "required": [
        "result"
      ],
      "additionalProperties": false
    }
  }
}
```
