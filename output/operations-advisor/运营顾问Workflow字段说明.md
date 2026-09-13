# 运营顾问 Workflow / Chatflow 字段说明

文档版本：1.1 · 2026-09-11\
字段状态：候选，尚未正式冻结；现有报告 `schema_version` 仍为 "1.0"。\
应用：来搜运营顾问｜workflow首次诊断、来搜运营顾问｜chatflow多轮问答。\
范围：8 个板块、32 个 function 的输入、输出、子字段、页面映射和开发接入边界。

> 本文记录当前导出文件和本地接入代码的实际字段。标记为“待统一”的内容尚未实施，本文不是已冻结的正式接口规范。文档不包含 API Key。

配套查看：[V1 单 HTML 字段对照](运营顾问-v1字段说明.html)。最左侧逐项展示字段并连接到中间原稿报告，右侧保留原运营入口；所有内容均为本地说明示例。

后续维护：[运营顾问字段冻结与升级机制](运营顾问字段冻结与升级机制.md)，说明首次冻结、后续修改、版本管理、发布验证、迁移与回退。

计数勘误：重新核对导出的八个顾问及修复模型，均为 **11 个业务字段 + 4 个身份字段 = 15 个字段**。此前文档的 12 / 16 是计数错误，实际字段定义没有改变。

## 0. 从这里查字段、维护字段

**本文就是需要随 Workflow 一起维护的字段字典。** 每个字段叫什么、是什么类型、是否必有、来自哪里、用在哪里、有哪些限制，查本文；决定这些定义以后如何修改，查配套机制文档。

| 要查什么 | 直接阅读 |
|---|---|
| Workflow 接收的 4 个字段及请求示例 | [公共输入](#workflow-inputs) |
| 32 个 function 各用什么表头、多少条摘要 | [功能与原 HTML 映射](#function-fields) |
| 成功报告的 15 个字段、证据和行动子字段 | [完整报告字段](#report-fields) |
| 15 个字段放在一起是什么样 | [完整 JSON 示例](#report-example) |
| 四个结束节点分别输出什么 | [结束分支](#end-fields) |
| rows 为什么有字符串和数组两种类型 | [传输与还原](#rows-transport) |
| Workflow 怎样把报告交给 Chatflow | [追问交接字段](#chat-handoff) |
| 前端实际向后端传什么、收到什么 | [页面代理接口](#proxy-fields) |
| 代码节点内部参数，以及尚未定好的字段 | [内部字段](#internal-fields)、[待统一清单](#pending-fields) |

同名字段必须结合所在层次阅读。例如 `inputs.module` 是 Workflow 开始输入，`report.module` 是报告身份，`chat_inputs.module` 是追问交接。它们语义关联，但不是同一个对象路径；不能因名字相同就随意改掉其中一处。

本页所有已列字段默认状态为“已登记、未冻结”；标为“待统一 / 待定义”的项目不能当成已实现字段。类型、枚举、必填、空值和限制属于接口约定；示例仅帮助理解，不能取代这些规则。名称、计数或说明文字的勘误也必须在文末留记录，不能假称业务接口已升级。

### 本文必须怎样随升级维护

1. 每次修改前核对本文、现有机器定义和准确的 DSL/代码版本。字段有变，逐项记录旧定义、新定义、来源、消费位置、样例、当前状态和影响版本；不知道的内容明确写待定义。
2. 同一候选交付中，字段字典、Schema、DSL、后端、对应 UI 映射及样例必须互相一致。只改机制文档、只改 Workflow 或只更新截图，均不算字段维护完成。某文件确实不受影响时，要记录核对结论。
3. 正式冻结时，把本字段文档的准确快照与机器可读契约放进同一个版本包，并在确认记录中注明对应版本。后续版本另存，旧文档保留；当前阅读入口指向哪一版由 CONTEXT.md 记录。
4. 维护者更新字段定义和示例，产品确认业务含义，开发核对类型、校验与消费方式。AI 不得自行把候选字段标为双方已确认，也不能只改文字来掩盖代码与契约的差异。

文档版本 1.1 表示本次补齐阅读入口、示例及维护要求，不表示接口版本发生变化；正式版本包目前仍未建立。

## 1. 接入关系与统一程度

```text
页面点击 function
  → 本地后端校验入口、补齐 module 和 report_id
  → Dify Workflow 接收四个公共输入
  → 按 module 进入一个顾问，由 function_name 确定具体任务
  → 校验报告，必要时修复一次
  → 后端识别返回分支、还原 rows、核对报告与追问上下文
  → 页面用 name / sub / points / rows 填入原 HTML
```

| 项目 | 当前情况 |
|---|---|
| 32 个 function 的外层输入字段 | 已统一，都是 `module / function_name / report_id / business_context` |
| 八个顾问及修复模型的报告 Schema | 已统一，共用 11 个业务字段 |
| 成功报告的身份字段 | 已统一，由校验节点补入 4 个字段，合计 15 个字段 |
| 四个结束节点的字段名 | 使用不同前缀，后端识别归一化 |
| 正常与修复分支的 `rows` 传输类型 | **待统一**：正常为 JSON 字符串，修复节点仍为二维数组 |
| `business_context` 内部业务字段 | **待定义**：目前是自由文本，没有按 function 固定的数据 Schema |
| 表头和摘要限制 | 本地后端已配置 28 份模板；**尚未同步到 Workflow 校验节点** |
| 标题、发品、报价等实际业务产物 | 主要放在 `content_markdown`，**尚无独立、逐对象的业务结果 Schema** |

<a id="workflow-inputs"></a>

## 2. Dify Workflow 公共输入

所有 function 共用下列字段，不为每个 function 新增一套顶层变量。

| 字段名 | 类型 | 必填 | 当前限制 | 含义与来源 |
|---|---|---|---|---|
| `module` | string；Dify 界面为 select | 是 | 八个板块之一，最长 48 字符 | 所属业务板块；本地后端根据 function_name 推导 |
| `function_name` | string | 是 | 最长 120 字符；必须在该板块的白名单内 | 本次执行的具体功能，规范值见第 3 节 |
| `report_id` | string | 是 | 非空，最长 120 字符 | 本次报告标识；由调用方生成，本地后端使用 `yd-operations-` 加 UUID |
| `business_context` | string | 是 | 非空，最长 48,000 字符 | 店铺背景、任务对象、周期、数据和约束；当前没有固定内部字段 |

输入校验节点会对四个字符串执行首尾空白清理。当前没有对 report_id 做去重存储或幂等检查，因此“报告 ID”不等于“重复请求不执行”。

业务数据缺失不应伪造为零。可以提供已知部分，由报告通过 `data_status` 和 `missing_data` 说明缺口。

### 2.1 Dify Service API 请求体

以下是虚构示例，不含真实商家数据；`inputs` 内才是 Workflow 的四个输入。`user` 与 `response_mode` 是 API 请求层字段。

```json
{
  "inputs": {
    "module": "优爆品提升",
    "function_name": "优爆品提升",
    "report_id": "example-report-001",
    "business_context": "虚构示例：仅提供商品目录，尚未提供商品级经营明细。"
  },
  "response_mode": "streaming",
  "user": "example-user"
}
```

当前本地后端调用 `/v1/workflows/run`，使用 `response_mode=streaming`；当前原型的 user 固定为 `yingdan-operations-prototype`。正式账号关联应另行约定，不能把这个演示值当成正式用户标识。

### 2.2 business_context 的边界

目前模型提示词以自然语言描述各板块所需资料，没有定义诸如商品 ID、时间区间、曝光量、询盘量等固定键名和类型。把任意 JSON 字符串传入也不会触发内部业务字段的 Schema 校验。

**待统一**：保留外层 `business_context` 字段，在其内部约定公共背景、周期、对象 ID、来源和各 function 的业务数据结构。具体字段尚未定稿，不应由前后端各自命名。

<a id="function-fields"></a>

## 3. 全部 function 与原 HTML 表格映射

下表中的 function_name 是 Dify 接受的规范值。所有行共用第 2 节输入和第 4 节报告结构。

“摘要上限 / 数据行上限”来自当前本地后端模板，数据行不含表头；Workflow 自身目前仅统一限制 points 最多 5 条，尚未校验这些逐功能限制。

| 序号 | module | function_name | 原 HTML 表头 | 摘要上限 / 数据行上限 |
|---|---|---|---|---|
| 1 | 数据看板 | 数据看板 | 当前为独立看板，未配置 AI 摘要模板 | — |
| 2 | 数据看板 | 日经营概览 | 当前为独立看板，未配置 AI 摘要模板 | — |
| 3 | 数据看板 | 周经营概览 | 当前为独立看板，未配置 AI 摘要模板 | — |
| 4 | 数据看板 | 月经营概览 | 当前为独立看板，未配置 AI 摘要模板 | — |
| 5 | 运营规划 | 运营规划清单 | 阶段 / 落地项目 / 周期/节奏 | 5 条 / 5 行 |
| 6 | 运营规划 | 老店运营诊断规划 | 步骤 / 项目 / 要点 | 5 条 / 2 行 |
| 7 | 运营规划 | 3月新贸节作战计划 | 阶段 / 时间 / 关键动作 | 4 条 / 4 行 |
| 8 | 运营规划 | 9月采购节作战计划 | 动作 / 负责人 / 时间 | 4 条 / 4 行 |
| 9 | 营销定位 | 市场&客群定位 | 维度 / 分析 / 结论 | 4 条 / 3 行 |
| 10 | 营销定位 | 公司定位 | 卖点维度 / 内容 / 状态 | 5 条 / 4 行 |
| 11 | 营销定位 | 产品定位 | 定位维度 / 动作 / 作用 | 4 条 / 3 行 |
| 12 | 营销定位 | 店铺装修文案 | 装修区块 / 文案要点 / 状态 | 5 条 / 4 行 |
| 13 | 营销定位 | 详情页装修文案 | 详情区块 / 文案要点 / 状态 | 5 条 / 4 行 |
| 14 | 运营基建 | 一键选品 | 选品源 / 产出 / 状态 | 5 条 / 4 行 |
| 15 | 运营基建 | 一键整理关键词 | 词库 / 数量 / 用途 | 3 条 / 3 行 |
| 16 | 运营基建 | 批量标题 | 能力 / 支持 / 状态 | 4 条 / 3 行 |
| 17 | 运营基建 | 批量发品 | 指标 / 数值 / 状态 | 3 条 / 3 行 |
| 18 | 运营推广 | 广告策略 | 阶段 / 推广方式 / 预算 | 5 条 / 3 行 |
| 19 | 运营推广 | 广告诊断优化 | 维度 / 数量 / 动作 | 5 条 / 3 行 |
| 20 | 运营推广 | 品广诊断优化 | 类型 / 数量 / 状态 | 3 条 / 3 行 |
| 21 | 优爆品提升 | 优爆品提升 | 分层 / 数量 / 策略 | 5 条 / 3 行 |
| 22 | 优爆品提升 | 核心品跟进 | 优先级 / 动作 / 目标 | 3 条 / 3 行 |
| 23 | 优爆品提升 | 单品历史数据 | 规则 / 周期 / 动作 | 5 条 / 3 行 |
| 24 | 数据分析与优化 | 店铺诊断 | 维度 / 评分 / 状态 | 3 条 / 3 行 |
| 25 | 数据分析与优化 | 产品诊断 | 分层 / 产品数 / 询盘 | 3 条 / 3 行 |
| 26 | 数据分析与优化 | 广告诊断 | 指标 / 数值 / 状态 | 3 条 / 3 行 |
| 27 | 数据分析与优化 | 品广诊断 | 类型 / ROI / 建议 | 2 条 / 2 行 |
| 28 | 商机转化 | 优质RFQ信息采集 | 采集项 / 数量 / 状态 | 3 条 / 3 行 |
| 29 | 商机转化 | RFQ报价跟进表 | 状态 / 数量 / 占比 | 3 条 / 4 行 |
| 30 | 商机转化 | 询盘明细采集分析 | 维度 / 数量 / 状态 | 3 条 / 3 行 |
| 31 | 商机转化 | 客户列表采集分析 | 客户类型 / 占比 / 数量 | 3 条 / 3 行 |
| 32 | 商机转化 | 询盘登录表 | 客户 / 国家 / 状态 | 3 条 / 3 行 |

### 3.1 页面名称别名

当前后端支持以下别名；直接调用 Dify 时应使用上表的规范名称。module 的规范值是“数据分析与优化”，页面“数据分析&优化”只是显示文案。

| 页面/旧入口名称 | 实际 function_name |
|---|---|
| 运营规划 | 运营规划清单 |
| 市场定位、市场定位SOP | 市场&客群定位 |
| 公司定位SOP | 公司定位 |
| 产品定位SOP | 产品定位 |
| 关键词库 | 一键整理关键词 |
| 产品发布 | 批量发品 |
| 推广策略 | 广告策略 |
| 问鼎/顶展/聚量诊断 | 品广诊断优化 |
| 核心品资源跟进 | 核心品跟进 |
| 店铺诊断与落地规划 | 老店运营诊断规划 |
| 产品优化 | 产品诊断 |

**待统一**：当前 function_name 同时承担显示名称和路由标识。后续如需调整文案，建议增加稳定功能编号映射；编号本身尚未创建。

<a id="report-fields"></a>

## 4. 成功报告 report 字段

### 原稿示例与当前容量的差异

制作字段对照页时，核对到以下原稿样例超过当前每份报告最多 5 条要点的限制：运营规划清单 22 条、老店运营诊断规划 15 条、店铺装修文案 6 条、详情页装修文案 6 条、单品历史数据 7 条；前两个原稿还有单条超过 90 字的情况。28 个原稿表头均与本地模板一致。

对照页保留这些原稿内容并标注冲突；这些功能的成功响应 JSON 样例为 `null`，原稿仅放在导出文档的 `documentation.source_sample` 中，不能当成有效接口响应。确认正式契约前，需要决定如何把完整内容放入既有正文等字段、摘要保留多少条，或是否显式升级容量限制。本次没有更改 Workflow、后端容量或原 HTML 内容。

以下 15 个字段只适用于业务成功报告。业务失败时当前返回 `report={}`，不能按成功报告读取字段。模型生成前 11 个业务字段，代码补入最后 4 个身份字段；模型 Schema 不接受额外字段。本节字段路径以 `report` 为根；前端实际读取 `result.report`，Dify 修复分支原始对象名为 `repaired_report`，见第 5、8 节。

| 字段 | 业务类型 | 必有 | 含义与约束 | 当前用途 | 虚构示例 |
|---|---|---|---|---|---|
| `name` | string | 是 | 必须等于规范 function_name，非空白 | 原 HTML 报告标题 | `"优爆品提升"` |
| `sub` | string | 是 | 对象、范围、周期说明，非空白；本地模板最多 60 字符 | 原 HTML 副标题 | `"样例商品；统计周期未提供"` |
| `data_status` | string 枚举 | 是 | sufficient / partial / insufficient，见第 4.1 节 | 描述资料是否足够 | `"insufficient"` |
| `conclusion` | string | 是 | 非空白的主要结论 | 完整报告、下载与追问 | `"缺少经营明细，暂不能判断商品分层。"` |
| `points` | string[] | 是 | Workflow 最多 5 条、允许 []；本地 28 份模板要求至少一条，并按功能限制条数、每条最多 90 字符 | 原 HTML 编号要点 | `["先补齐商品经营明细，再判断是否晋级。"]` |
| `rows` | string[][] | 是 | 首行固定表头、各行列数一致；本地每格最多 60 字符，数据行上限按功能；传输类型见第 6 节 | 原 HTML 表格 | `[["分层","数量","策略"],["待判断","未提供","补齐明细"]]` |
| `content_markdown` | string | 是 | 非空白的完整分析或业务成品正文 | 下载与追问，不作为主窗口长文渲染 | `"先收集同一周期的数据，再形成分层建议。"` |
| `evidence` | object[] | 是 | 证据条目，允许 []；sufficient 时至少一条；子字段见第 4.2 节 | 结论与行动依据 | 第 4.5 节中的 `e-demo-001` 条目 |
| `actions` | object[] | 是 | 行动条目，允许 []；子字段见第 4.3 节 | 建议、执行步骤与验收 | 第 4.5 节中的 `a-demo-001` 条目 |
| `missing_data` | string[] | 是 | 每条非空白；资料不足或部分充足时至少一项 | 数据缺口 | `["统计周期","商品经营明细"]` |
| `follow_up_questions` | string[] | 是 | 最多 3 条；每条非空白；允许 [] | 后续追问建议 | `["准备分析哪个统计周期？"]` |
| `schema_version` | string | 是 | 当前固定为 "1.0"，代码补入；不是冻结确认记录 | 报告契约版本 | `"1.0"` |
| `module` | string | 是 | 代码取自校验后的输入 | 报告所属板块 | `"优爆品提升"` |
| `function_name` | string | 是 | 代码取自校验后的输入 | 报告对应任务 | `"优爆品提升"` |
| `report_id` | string | 是 | 代码取自校验后的输入，不能另造新 ID | 报告与追问会话关联 | `"example-report-001"` |

以上字段没有自动补齐的业务默认值，除身份字段由代码按规则补入外，缺字段应报错。列表字段必须存在；允许为空的列表无内容用 []，不能用 null；本地有模板时 points 不得为空，rows 至少保留表头。rows 中的数值也必须转为字符串，例如 "24"；未知可写“未提供”，不能擅自填 "0"。需要单位时应在已约定表头或内容中明确，当前没有独立的数值单位字段。

当前校验节点限制模型结果文本不超过 100,000 字符；注入身份后的 diagnosis_context 报告封装不超过 64,000 字符。两者限制的是不同内容，后者可能先触发。

### 4.1 data_status

| 值 | 含义 | 相关要求 |
|---|---|---|
| `sufficient` | 当前任务必要事实足够 | evidence 至少有一条；有证据条目不等于证据已被程序验证真实 |
| `partial` | 可完成一部分，仍有影响判断的缺口 | missing_data 必须非空 |
| `insufficient` | 无法形成针对当前对象的可靠判断 | missing_data 必须非空，不能把通用建议伪装成实际诊断 |

`status=ok` 与 `data_status=insufficient` 可以同时出现：表示报告结构有效，但业务资料不足。

### 4.2 evidence[] 子字段

数组中的每个证据对象都必须包含以下三个子字段，由模型生成、校验节点检查。完整路径如 `report.evidence[].id`。

| 字段 | 类型 | 规则 | 虚构示例 |
|---|---|---|---|
| `id` | string | 非空白，在本报告中唯一；被 actions[].evidence_ids 引用 | `"e-demo-001"` |
| `source` | string | 非空白，描述输入数据或检索来源 | `"本次虚构 business_context"` |
| `fact` | string | 非空白，说明支持判断的观察或引用 | `"只提供了样例商品目录，未提供经营明细。"` |

当前 source 是描述性文本，没有结构化的 source_type、document_id、record_id 等来源字段。

### 4.3 actions[] 子字段

数组中的每个行动对象都必须包含以下九个子字段，由模型生成、校验节点检查。完整路径如 `report.actions[].target`；这些字段目前用于报告内容和追问，不是已接入执行系统的指令。

| 字段 | 类型 | 规则 | 虚构示例 |
|---|---|---|---|
| `id` | string | 非空白，在本报告中唯一 | `"a-demo-001"` |
| `target` | string | 非空白，行动对象描述；不是独立的商品/客户 ID 字段 | `"样例商品"` |
| `decision` | string | 非空白，建议作出的决定 | `"先补资料，暂不调整分层"` |
| `steps` | string[] | 至少一项，每项非空白 | `["确定周期","补充商品经营明细"]` |
| `priority` | string 枚举 | P0 / P1 / P2；当前 Schema 检查允许的枚举值 | `"P1"` |
| `owner` | string | 非空白，负责人或岗位描述；没有固定 owner_id | `"运营负责人"` |
| `acceptance` | string[] | 至少一项，每项非空白，定义交付验收标准 | `["统计周期一致，关键明细已提供"]` |
| `review` | string | 非空白，复查条件与继续/调整/停止判据 | `"资料补齐后重新诊断。"` |
| `evidence_ids` | string[] | 可以为空；不能重复，只能引用本报告已有 evidence.id | `["e-demo-001"]` |

提示词要求突出最多三项首要动作，但当前 Python 校验器未限制 actions 的条数。actions 表示建议，不表示已经执行、已保存或已通过验收。

### 4.4 业务成品字段的待定义项

当前没有独立的逐商品标题数组、商品发布字段数组或 RFQ 报价条目数组。批量标题、批量发品、装修文案和报价等具体成品主要由 content_markdown 承载。

若开发需要自动回填或继续提交，应为各 function 约定结构化业务结果，至少保留对象 ID、实际内容、处理状态和缺口。新增字段名及 Schema 尚未定稿，当前不能直接给 report 添加额外键。

<a id="report-example"></a>

### 4.5 一份包含全部字段的报告示例

以下是后端归一化后的 `result.report`，不是 Dify 原始响应包。共 15 个顶层字段，证据与行动子字段均展开；对应“优爆品提升”。全部资料均为虚构，仅演示结构，不是实际模型运行结果。

```json
{
  "name": "优爆品提升",
  "sub": "样例商品；统计周期未提供",
  "data_status": "insufficient",
  "conclusion": "缺少经营明细，暂不能判断商品分层。",
  "points": ["先补齐商品经营明细，再判断是否晋级。"],
  "rows": [
    ["分层", "数量", "策略"],
    ["待判断", "未提供", "补齐明细"]
  ],
  "content_markdown": "先收集同一周期的数据，再形成分层建议。当前仅有样例商品目录，不能据此推断实际表现。",
  "evidence": [
    {
      "id": "e-demo-001",
      "source": "本次虚构 business_context",
      "fact": "只提供了样例商品目录，未提供经营明细。"
    }
  ],
  "actions": [
    {
      "id": "a-demo-001",
      "target": "样例商品",
      "decision": "先补资料，暂不调整分层",
      "steps": ["确定周期", "补充商品经营明细"],
      "priority": "P1",
      "owner": "运营负责人",
      "acceptance": ["统计周期一致，关键明细已提供"],
      "review": "资料补齐后重新诊断。",
      "evidence_ids": ["e-demo-001"]
    }
  ],
  "missing_data": ["统计周期", "商品经营明细"],
  "follow_up_questions": ["准备分析哪个统计周期？"],
  "schema_version": "1.0",
  "module": "优爆品提升",
  "function_name": "优爆品提升",
  "report_id": "example-report-001"
}
```

其他 function 复用同一套字段，替换已登记的 module、function_name/name 和该功能的固定表头，并遵守第 3 节容量。不能从这个示例推导出允许增删字段，也不能把“优爆品提升”的表头复制给全部功能。

<a id="end-fields"></a>

## 5. Dify 四个结束分支

每个结束节点输出四个业务字段，变量名全局不重复。不要把四个节点的输出名字直接改成同一套名称。

| 分支 | 状态字段 | 报告字段 | 追问字段 | 错误字段 |
|---|---|---|---|---|
| 正常 | `status` | `report` | `chat_inputs` | `error` |
| 修复 | `repaired_status` | `repaired_report` | `repaired_chat_inputs` | `repaired_error` |
| 输入错误 | `invalid_status` | `invalid_report` | `invalid_chat_inputs` | `invalid_error` |
| 生成失败 | `failed_status` | `failed_report` | `failed_chat_inputs` | `failed_error` |

| 字段角色 | 类型 | 当前值与含义 |
|---|---|---|
| 状态 | string | 正常成功为 ok；修复校验为 ok 或 invalid_output；输入错误为 invalid_input；统一生成失败为 invalid_output |
| 报告 | object | 成功为第 4 节报告，失败为 {} |
| 追问输入 | object | 成功为第 7 节字段，失败为 {} |
| 错误说明 | string | 成功为空串，失败为中文说明；当前没有统一 error_code |

这里的业务状态不同于 Dify 运行状态。Dify 的一次运行即使为 succeeded，也可能执行了业务错误出口。消费方需要先检查运行状态，再检查对应业务状态。

知识检索服务异常等情况可能在结束节点前终止运行，不保证有上述四字段结果。本地代理会将运行失败转成公开错误事件；直接对接 Dify 的开发也必须处理这种情况。

<a id="rows-transport"></a>

## 6. rows 的传输与还原

| 所在位置 | 当前真实类型 | 消费方式 |
|---|---|---|
| 模型结构化 Schema 内 | string[][] | 二维字符串数组 |
| 正常出口 report.rows | string，内容为二维数组的 JSON | 先 JSON.parse，再按二维数组读取 |
| 修复出口 repaired_report.rows | string[][] | 当前仍是旧代码；可能触发此前的 Dify Code 输出兼容问题 |
| chat_inputs.diagnosis_context 解码后的 report.rows | string[][] | 外层 diagnosis_context 解码一次后即可读取 |
| 本地后端归一化后的 result.report.rows | string[][] | 前端统一按数组渲染 |

以下两个片段表达同一张虚构示例表格，但类型不同。

正常分支的传输字段：

```json
{
  "rows": "[[\"分层\",\"数量\",\"策略\"],[\"优品\",\"未提供\",\"待核实明细\"]]"
}
```

后端还原后的业务字段：

```json
{
  "rows": [
    ["分层", "数量", "策略"],
    ["优品", "未提供", "待核实明细"]
  ]
}
```

**待统一**：validate_report 与 validate_repaired 必须使用同一份传输转换和校验代码；业务层只约定一种二维数组结构，传输兼容处理集中在后端边界。

<a id="chat-handoff"></a>

## 7. 交给 Chatflow 的字段

成功时 chat_inputs 包含以下三个字段。2026-09-11 通过已发布 Chatflow 的 Service API 核验，应用为“来搜运营顾问｜chatflow多轮问答”，mode 为 advanced-chat；线上开始节点的字段名、类型与容量均与下表匹配。

| 字段 | 类型 | 来源、含义与限制 | 必填与空值 | 示例 |
|---|---|---|---|---|
| `module` | string | Workflow 校验后的当前板块，最长 48 字符；Chatflow 按它路由 | Workflow 成功交接和本地追问均必须有；Dify 开始节点必填 | `"优爆品提升"` |
| `business_context` | string | Workflow 校验后的业务资料，最长 48,000 字符；后端检查与当前报告输入一致 | Workflow 成功交接和本地追问要求非空白；Dify 开始节点本身标为可选 | `"虚构示例：只提供样例商品目录，未提供经营明细。"` |
| `diagnosis_context` | string | 代码序列化后的报告封装 JSON，最长 64,000 字符；供追问消费 | Workflow 成功交接和本地追问均必须有、可解码且身份一致；Dify 开始节点本身标为可选 | 对下表五字段封装执行 `JSON.stringify(...)` 后的字符串 |

这里必须区分 Dify 应用表单的可选配置和当前项目代理的接入要求。走本项目“先诊断、再追问”流程时，不能因为 Dify 标为可选就省略已有报告上下文。

`diagnosis_context` 解码后包含：

| 字段 | 类型 | 含义 |
|---|---|---|
| `schema_version` | string | 当前 "1.0" |
| `report_id` | string | 本次报告标识 |
| `module` | string | 所属板块 |
| `function_name` | string | 具体 function |
| `report` | object | 完整业务报告，rows 为二维数组，含第 4 节全部字段 |

调用 Chatflow 时将这三个字段放入 inputs，另在 Chatflow API 请求层传本轮 query、user 等字段。每份新报告应新建对应会话，后续追问沿用该会话的 conversation_id；不要把旧报告的会话与新报告混用。

当前本地页面已接入追问：报告成功且服务配置有效时启用输入与发送；报告生成中或失败时禁用。回复沿用原 HTML 的对话气泡，不改变报告摘要版式。正式环境尚未部署此接入。

<a id="proxy-fields"></a>

## 8. 当前网页代理 API

该层接口与 Dify 原始接口不同。前端只对接代理，不需要识别四套 Dify 输出前缀。

### 8.1 页面请求

`POST /api/operations-diagnosis`

| 字段 | 类型 | 规则 |
|---|---|---|
| `function_name` | string | 必填；规范名称或第 3.1 节已支持别名 |
| `business_context` | string | 必填；当前最多 44,000 字符，后端会附加演示来源说明和模板要求 |
| `data_source` | string | 必填；当前只能是 demo |

module 由后端推导，report_id 由后端生成。页面不传真实 Key。当前接口是演示接入，尚未定义真实店铺数据采集接口。

### 8.2 SSE 事件

| 事件 | 结构 | 含义 |
|---|---|---|
| 进度 | `{ "type": "progress", "message": "公开阶段" }` | 仅展示公开阶段 |
| 成功 | `{ "type": "done", "result": { … } }` | result 字段见下表 |
| 失败 | `{ "type": "error", "message": "公开错误说明" }` | 当前没有 error_code 或报告对象 |

成功事件的 result：

| 字段 | 类型 | 含义 |
|---|---|---|
| `report` | object | 已校验、rows 已还原的成功报告 |
| `chat_inputs` | object | 第 7 节的三个交接字段 |
| `branch` | string | 当前为 normal 或 repaired_；注意 repaired_ 有末尾下划线 |
| `workflow_run_id` | string | Dify 实际运行 ID，与 report_id 不同 |
| `data_source` | string | 当前固定 demo |

成功事件的 result 中没有另外的 status/error 四字段封装，不能直接照搬 Dify 原始结果读取路径。进入 SSE 前失败的请求通常返回非 2xx HTTP 状态与 `{ "message": "…" }`。

`GET /api/operations-diagnosis` 当前只返回 configured 布尔值和 data_source，不返回凭据。

### 8.3 页面追问请求

`POST /api/operations-chat`

| 字段 | 类型 | 规则 |
|---|---|---|
| `report_id` | string | 必填，沿用当前成功报告 ID，最长 120 字符 |
| `chat_inputs` | object | 必填，原样传入第 7 节的三个字段；后端重新核对报告身份和结构 |
| `query` | string | 必填，本轮问题，清理首尾空白后 1–4000 字符 |
| `conversation_id` | string | 首次为空字符串，后续使用上一轮返回的 UUID |
| `data_source` | string | 必填，当前只能是 demo |

后端传给 Dify 的 inputs 仍只有 module、business_context、diagnosis_context。query、conversation_id、user、response_mode、auto_generate_name 属于 Dify 请求层；user 根据报告和上下文在服务端生成，不接收浏览器自定义值。每份报告隔离会话归属，切换或重新生成报告后清空当前页面会话。

追问 SSE 事件：

| type | 附加字段 | 含义 |
|---|---|---|
| `progress` | `message: string` | 公开处理阶段 |
| `session` | `conversation_id: string`、`report_id: string` | 首次获取会话标识后立即传回，供本报告续问 |
| `answer_delta` | `delta: string` | 已过滤隐藏思考标签内容的增量文本 |
| `answer_replace` | `answer: string` | 上游内容审核替换时，覆盖旧回复 |
| `done` | `result: object` | 成功结束，字段见下表 |
| `error` | `message: string` | 公开失败提示，未完成片段不作为成功答案 |

追问成功的 result：

| 字段 | 类型 | 含义 |
|---|---|---|
| `answer` | string | 本轮完整公开回复；它是对话文本，不是首次报告 report 对象 |
| `conversation_id` | string | 该报告后续追问沿用的会话 ID |
| `message_id` | string | 本轮 Dify 消息 ID |
| `workflow_run_id` | string | 本轮 Chatflow 运行 ID；不是首次诊断运行 ID |
| `report_id` | string | 该轮回答所属的首次报告 ID |

`GET /api/operations-chat` 返回 configured 布尔值和 data_source。两条 API 的 Key 独立配置，均只留在服务端。追问期间发送按钮变为停止；关闭面板或切换功能也会取消当前请求，并尽力停止上游生成。

## 9. 前端使用与当前模板限制

| report 字段 | 原 HTML 区域 | 渲染方式 |
|---|---|---|
| name | `.ai-name` | 报告标题 |
| sub | `.ai-sub` | 副标题，页面附加生成时间与演示标识 |
| points | `.ai-point > .pt-dot / .pt-text` | 顺序编号的要点 |
| rows | `.ai-table-wrap > table.report-table` | 首行使用 tr.report-th，其余为数据行 |

其余字段保留在完整报告、下载和追问上下文中，不在主报告窗口增加长文区、结论卡或折叠区。动态内容使用安全文本节点，不执行模型返回的 HTML。

本地后端对第 3 节有模板的 28 个入口额外要求：sub 不超过 60 字符；points 至少一条、每条不超过 90 字符，并符合逐功能条数；表头逐字一致、至少保留表头、数据行不超限、每格不超过 60 字符。

**当前差异**：上述模板检查不在 Workflow 内。错误表头、空摘要或过长字段，可能在 Workflow 内返回 ok，而在后端被拒绝，且不会进入 Workflow 的修复节点。生成、校验、修复和后端需要同步这份规则。

<a id="internal-fields"></a>

## 10. 代码节点内部字段（后端排查用）

这些字段用于 Workflow 内部连线，不属于页面新增请求字段。

| 节点 | main 输入参数 | 声明的输出字段 |
|---|---|---|
| `prepare` | `module`、`function_name`、`report_id`、`business_context` | `business_context`、`chat_inputs`、`error`、`fallback_query`、`function_name`、`module`、`report`、`report_id`、`status`、`topics`、`valid` |
| `query_guard` | `rewritten`、`fallback` | `query`、`query_source` |
| `validate_report` | `text`、`module`、`function_name`、`report_id`、`business_context` | `chat_inputs`、`error`、`report`、`status` |
| `validate_repaired` | `text`、`module`、`function_name`、`report_id`、`business_context` | `chat_inputs`、`error`、`report`、`status` |
| `generation_error` | 无 | `chat_inputs`、`error`、`report`、`status` |

prepare.valid 为字符串 yes/no；prepare.status 为 ok/invalid_input。query_guard.query_source 为 rewrite/fallback。merge 当前汇合八个顾问的 text 字符串，再由 validate_report 解析 JSON；没有把完整模型流直接发送给前端。

<a id="pending-fields"></a>

## 11. 待统一清单

| 优先顺序 | 待统一项 | 当前缺口 | 建议验收标准 |
|---|---|---|---|
| 1 | 正常与修复校验代码 | rows 传输类型不同；修复节点保留 warning 日志 | 相同输入经两条分支得到相同字段类型，错误时不向 stderr 写业务日志 |
| 2 | HTML 模板与 Workflow 校验 | 模板约束只在本地代理 | 同一份模板用于生成、校验、修复及前端；Workflow ok 的结果能通过后端同版本校验 |
| 3 | 各 function 业务输入 | business_context 无固定内部 Schema | 32 个 function 均明确数据字段、类型、对象 ID、周期、单位与缺失表示 |
| 4 | 实际业务产物 | 主要放在 Markdown | 需要回填/后续处理的 function 提供逐对象结果 Schema，保留 ID 和处理状态 |
| 5 | 对外状态与错误 | 四个分支前缀；错误为自由文本；运行失败可能无业务结果 | 前端只面对一套后端协议，明确定义错误码、报告 ID、运行 ID 和可重试状态 |
| 6 | 功能标识与契约版本 | 中文显示名称承担路由，输入无版本字段 | 明确稳定功能编号映射与接口版本管理规则；新增内容需同步模型及校验 Schema |

本文中的建议没有直接新增到 Workflow 字段中。讨论确认后，应同时更新 DSL、后端适配、类型/Schema、示例和契约测试，再冻结为正式交付版。

## 12. 核对依据与验证范围

- [用户最新导出的 Workflow](</Users/garden/Downloads/来搜运营顾问｜workflow首次诊断 (1).yml>)。
- [字段清单 JSON](</Users/garden/.codex/worktrees/33b5/Prototype/output/operations-advisor/workflow-audit-20260911/contract-inventory.json>)。
- [离线检查结果](</Users/garden/.codex/worktrees/33b5/Prototype/output/operations-advisor/workflow-audit-20260911/offline-summary.json>)。
- [后端字段适配与校验](</Users/garden/.codex/worktrees/33b5/Prototype/lib/operations-workflow.js>)。
- [前端报告渲染](</Users/garden/.codex/worktrees/33b5/Prototype/prototypes/operations-advisor/workflow-client.js>)。
- [后端 Chatflow 接入](</Users/garden/.codex/worktrees/33b5/Prototype/lib/operations-chat.js>)。
- [本地 Chatflow 定义](</Users/garden/YD/l-sou/dify-workflows/来搜八板块运营顾问.chatflow.yaml>)。
- [Dify 官方 Chatflow API 模板](https://github.com/langgenius/dify/blob/main/web/app/components/develop/template/template_advanced_chat.en.mdx)。多轮通过 conversation_id 沿用会话，问题与 inputs 属于不同请求层字段。

本轮检查覆盖 32 个入口的离线输入与报告字段、两条校验分支、后端归一化和本地 Chatflow 输入。离线样例不代表 32 个 function 的实际模型输出均已线上验收。未修改或发布 Workflow。

2026-09-11 接入追问后的补充验收：线上元数据字段核验通过；从本地页面生成“优爆品提升”报告，再连续追问两轮，两轮使用同一个 conversation_id，第二轮准确记住第一轮测试代号。完整自动测试 173 项通过，包含 32 个 function 的离线交接和取消/失败场景。真实模型调用覆盖该功能两轮问答，未逐一执行全部 32 个功能。证据见 [Chatflow 接入验收记录](</Users/garden/.codex/worktrees/33b5/Prototype/output/operations-advisor/chatflow-integration/live-verification.json>)。

## 13. 字段文档修订记录

文档 1.1 校核：第 4.5 节 JSON 已通过现有 `normalizeOutputs` 的正常/修复分支归一化及 `buildChatRequest` 的追问交接检查；15 个顶层字段、3 个证据子字段、9 个行动子字段与当前 Schema 对应，32 个功能与 28 份表头/容量逐项匹配。该次为本地文档样例检查，未调用真实模型，也不代表自动冻结检查器已建立。

| 日期 | 文档版本 | 修改范围 | 接口影响 |
|---|---|---|---|
| 2026-09-11 | 初始核对稿 | 盘点输入、32 个功能、报告、分支、Chatflow 和代理；后续修正字段总数为 15，补充原稿容量差异 | 记录当前实现，未冻结 |
| 2026-09-11 | 1.1 | 明确字段字典地位与同步维护要求；增加定位目录、逐字段示例、完整 15 字段 JSON，区分 Dify 可选配置与本地交接必填要求 | 只补充说明，无新增、删除或改名；`schema_version` 不变 |
