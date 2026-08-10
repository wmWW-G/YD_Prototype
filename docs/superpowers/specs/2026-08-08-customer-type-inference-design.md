# PDL 客户类型推测匹配设计

状态：已实施并通过真实数据验证

日期：2026-08-08

范围：客户开发页面的 PDL 公司候选排序与客户类型证据展示

## 1. 背景与目标

PDL Free Company Dataset 只提供公司名称、网站、规模、成立年份、行业、总部位置和 LinkedIn 公司页，不提供“进口商、经销商、品牌商”等结构化客户类型字段。当前页面虽然允许用户选择客户类型，但只是把部分角色映射为宽口径行业并与产品行业合并查询，无法证明返回公司真的属于用户选择的客户类型。

本设计的目标是：在不爬官网、不调用大模型、不引入新的收费数据源的前提下，利用 PDL 已有的 `industry`、`name` 和 `website` 信号，对用户选择的客户类型进行准确优先、可解释的软匹配和排序。

算法输出的是“高度疑似、可能匹配、弱匹配、无法判断”，不是经过企业官方信息确认的客户类型。

## 2. 非目标

- 不验证公司是否真实采购用户选择的具体产品。
- 不推测联系人、邮箱、电话或采购意图。
- 不把用户选择的客户类型直接写入公司的事实字段。
- 不为了提高召回率而调用官网、LinkedIn 页面、大模型或第三方 enrichment。
- 不承诺返回的目标数量全部属于所选客户类型。

## 3. 产品口径

首页字段使用“优先客户类型（可选）”，默认值为“不限 / 智能推荐”。该字段影响候选公司的排序，不是严格过滤条件。

结果页保留 PDL 原始行业，同时新增客户类型推测标签和证据。例如：

> 高度疑似分销商
>
> 依据：PDL 行业为 wholesale；公司名称包含 Distribution
>
> 尚未经过公司官方资料核验

结果汇总使用“20 家候选公司，其中 5 家高度疑似、8 家可能匹配、7 家类型待核验”，不得使用“找到 20 家经销商”之类的确定性表述。

如果用户选择的类型无法由现有字段可靠判断，页面仍返回产品行业候选，但明确提示“PDL 现有字段无法可靠判断此客户类型”。

## 4. 方案选择

### 方案 A：只按行业映射

实现最简单，但单个公司行业不能表达供应链角色。例如 `renewables & environment` 可能同时包含制造商、开发商、EPC 和经销商，误判率不可接受。

### 方案 B：可解释的多信号规则评分

综合行业、公司名称和域名，要求高置信度至少有两个独立证据家族，输出证据和置信等级。免费、稳定、可测试，适合当前数据边界。

### 方案 C：使用大模型分类

大模型拿到的仍是相同的少量字段，没有新增事实来源，却会增加成本、延迟和不可复现的猜测，因此不采用。

最终采用方案 B。

## 5. 输入数据与证据家族

### 5.1 精确条件

- `country`：继续作为精确过滤条件。
- `limit`：只控制最终返回数量，单次最多 500 家。

### 5.2 产品相关条件

- 当前产品大类到 PDL 行业的映射继续用于宽口径产品相关度。
- 本阶段不新增 432 个具体产品的多语言关键词库，避免把产品名称改造成另一个不可控分类系统。
- PDL 行业命中产品大类时，产品相关度为 100；未命中为 0。该分数只表达行业相关，不表达采购意图。

### 5.3 客户类型证据家族

客户类型只使用两个独立证据家族：

1. 行业证据：PDL `industry` 是否命中角色允许的行业集合；或在出现强身份词时，是否命中本轮产品行业。产品行业单独命中不能形成角色结论。
2. 身份文本证据：公司 `name` 或 `website` 是否包含角色关键词。

公司名称与域名通常来自同一品牌名称，因此二者共同命中仍只算一个“身份文本证据家族”，不能冒充两条独立证据。

## 6. 客户类型支持矩阵

“高”表示允许在行业和身份文本同时命中时输出“高度疑似”；“中”表示最多输出“可能匹配”；“无”表示现有字段不能形成客户类型结论。

| 客户类型 | 支持级别 | 主要行业信号 | 高精度身份关键词示例 | 最高输出 |
|---|---|---|---|---|
| 进口商 | 高 | `import and export`、`international trade and development` | importer、imports、import/export、importadora、importaciones、importateur、进出口 | 高度疑似 |
| 批发商 | 高 | `wholesale` | wholesale、wholesaler、cash and carry、mayorista、atacado、grosshandel、批发 | 高度疑似 |
| 分销商 | 高 | `wholesale`、`import and export` | distributor、distribution、distributora、distribuidora、distributeur、分销 | 高度疑似 |
| 经销商 | 高 | `wholesale`、`retail` | dealer、dealership、authorized dealer、经销 | 高度疑似 |
| 代理商 | 中 | `wholesale`、`import and export` | authorized agent、sales agent、representative、代理 | 可能匹配 |
| 贸易公司 | 高 | `import and export`、`international trade and development` | trading、trading company、commercial trading、comercializadora、贸易 | 高度疑似 |
| 品牌商 | 无 | 无可靠行业 | `brand` 只能作为弱提示，不能证明品牌所有权 | 无法判断 |
| 制造商 | 高 | 行业名称包含 `manufacturing`，或产品映射中的生产型行业 | manufacturer、manufacturing、factory、works、fabrication、制造、工厂 | 高度疑似 |
| OEM / ODM 采购商 | 无 | 无可靠行业 | OEM/ODM 更可能描述供应能力，不能证明其采购角色 | 无法判断 |
| 零售商 | 高 | `retail`、`supermarkets` | retailer、retail、store、supermarket、hypermarket、零售、超市 | 高度疑似 |
| 连锁零售商 | 中 | `retail`、`supermarkets` | chain、stores、retail group、supermarket group、连锁 | 可能匹配 |
| 电商卖家 | 中 | `retail`、`internet` | ecommerce、e-commerce、online store、online shop、marketplace、电商 | 可能匹配 |
| 工程承包商 | 高 | `construction`、`civil engineering` | contractor、contracting、engineering and construction、工程承包 | 高度疑似 |
| EPC 承包商 | 高 | `construction`、`civil engineering`、`mechanical or industrial engineering` | EPC、engineering procurement construction、turnkey contractor | 高度疑似 |
| 系统集成商 | 高 | `industrial automation`、`information technology and services` | system integrator、systems integration、integration services、系统集成 | 高度疑似 |
| 项目开发商 | 中 | `renewables & environment`、`real estate`、`construction` | project developer、project development、development projects、项目开发 | 可能匹配 |
| 采购服务商 | 中 | `logistics and supply chain`、`outsourcing/offshoring` | procurement services、sourcing company、buying office、purchasing services、采购服务 | 可能匹配 |
| 最终用户企业 | 无 | 所有企业都可能是相对某产品的最终用户 | 无法由公司名称或行业证明 | 无法判断 |
| 政府 / 公共机构 | 高 | `government administration`、`public policy`、`public safety` | government、ministry、municipality、city council、public authority、政府、市政 | 高度疑似 |
| 设计院 / 顾问公司 | 高 | `architecture & planning`、`civil engineering`、`design`、`management consulting` | design institute、consulting engineers、engineering consultant、architects、设计院、顾问 | 高度疑似 |

所有关键词使用词边界匹配，不能用无边界子串。`store` 不得命中 `restore`，`agent` 不得命中 `management`。弱词如 `international`、`global`、`solutions`、`group`、`supply` 不能独立形成“可能匹配”。

## 7. 评分规则

### 7.1 客户类型分数

客户类型原始分数限制在 0–100：

- 行业命中角色行业集合：+45。
- 公司名称命中高精度身份关键词：+40。
- 名称未命中但域名命中高精度关键词：+25。
- 名称或域名只命中弱关键词：+10。
- 出现明确冲突信号：-40。

名称命中和域名命中不叠加，只取两者中的最高身份文本分。明确冲突信号只用于降低置信度，不直接删除公司。例如用户选择经销商，但公司名称明确包含 `manufacturer` 或 `factory`，则扣 40 分；企业可能兼具制造和经销身份，所以结果仍可作为待核验候选。

### 7.2 置信等级

- 高度疑似：75–100，并且行业证据和身份文本证据同时存在。
- 可能匹配：45–74，至少有一个强证据。
- 弱匹配：20–44。
- 无法判断：0–19。

支持级别为“中”的类型最高只能输出“可能匹配”。支持级别为“无”的类型始终输出“无法判断”，即使公司名称中出现相似词也只将该词作为人工核验提示。

### 7.3 综合排序

内部综合分用于同一客户类型置信等级内的排序，不直接展示给用户：

```text
综合分 = 客户类型分 × 50%
       + 产品行业相关度 × 40%
       + 数据完整度 × 10%
```

数据完整度只按字段是否存在计算：网站 40、LinkedIn 30、行业 20、公司规模 10。数据完整度不能提高客户类型置信等级。

整体先按“高度疑似 → 可能匹配 → 弱匹配 → 无法判断”排序，再比较综合分。这样产品行业命中但客户类型证据很弱的公司，不会挤到客户类型证据完整的公司前面。同等级同分时依次按以下顺序排序：有网站、有 LinkedIn、公司名称升序。

## 8. 候选召回与查询流程

1. 国家始终作为精确 SQL 条件。
2. 用户未选择客户类型时，保持现有产品行业宽口径查询。
3. 用户选择可推测类型时，候选条件为：产品行业命中、角色行业命中、名称关键词命中或域名关键词命中，满足任一即可进入候选集合。产品行业与强角色身份词同时命中时，视为两类独立证据，使产品相关公司优先于只有通用角色行业的公司。
4. DuckDB 对整个候选集合计算客户类型分、产品行业相关度、数据完整度和综合分。
5. 排序完成后再应用 `LIMIT`，不能先任意取 500 家后在浏览器中打分。
6. 用户选择无法判断的类型时，不执行虚假的角色过滤，只按国家和产品行业返回，并携带“不支持可靠判断”状态。

SQL 中的行业和关键词只能来自服务端白名单配置。用户输入通过枚举查表，不能直接拼接为 SQL 或正则表达式；动态值继续使用 DuckDB 参数绑定。

## 9. 服务端与前端边界

### 9.1 服务端

`pdl_local.py` 是客户类型推测的唯一规则来源，负责：

- 定义20种客户类型的支持级别、行业集合、强关键词、弱关键词和冲突关键词。
- 接收枚举化的 `role` 和独立的产品行业参数。
- 在 DuckDB 查询中完成召回、评分、排序和分页。
- 返回结构化证据，不返回无法解释的黑盒结论。

### 9.2 前端

`src/app.js` 只负责：

- 发送用户选择的客户类型和产品行业。
- 显示置信等级、证据和“未经核验”声明。
- 保留 PDL 原始行业，不能用推测客户类型覆盖原始字段。
- 汇总每个置信等级的数量。

`src/data.js` 继续维护用户可见的20个客户类型。自动化测试必须保证每一个前端类型在服务端都有对应配置，避免两边漂移。

## 10. API 返回结构

每家公司新增以下字段：

```json
{
  "requested_role": "分销商",
  "role_support": "high",
  "role_match_score": 85,
  "role_match_level": "high",
  "role_match_label": "高度疑似分销商",
  "role_match_evidence": [
    {
      "field": "industry",
      "value": "wholesale",
      "message": "PDL 行业属于分销商常见行业"
    },
    {
      "field": "name",
      "value": "Distribution",
      "message": "公司名称包含分销身份关键词"
    }
  ],
  "role_verified": false,
  "product_industry_match": true,
  "match_score": 82
}
```

当类型不受支持或证据不足时，`role_match_evidence` 可以为空，但字段必须存在，前端统一显示“客户类型待核验”。

## 11. 错误处理与降级

- 未知客户类型：返回 HTTP 400 和明确错误码，不静默套用其它角色。
- 数据库缺失：沿用现有 `dataset_not_imported` 错误。
- 行业为空：只允许名称或域名产生最多“弱匹配”；不能输出高度疑似。
- 名称和域名为空：客户类型分为 0。
- 查询评分异常：整次请求返回错误，不能退回到把用户选择值写成公司类型的旧行为。
- 没有高度疑似结果：仍返回排序后的候选公司，并明确显示各置信等级数量。

## 12. 性能策略

- 评分必须在 DuckDB 中完成，前端不拉取大候选集。
- 先用国家条件缩小扫描范围，再在该国家内执行“产品行业、角色行业、名称关键词、域名关键词”四类 OR 召回；不能先只保留行业候选，否则会漏掉行业缺失但名称证据很强的公司。
- 初版不新增大型派生表或全文搜索索引，避免让2.3 GB数据库显著膨胀。
- 以现有2.4秒搜索状态为体验边界；德国、美国和印度各选一个高覆盖产品进行基准验证，接口计算应在搜索动画结束前完成。
- 如果基准验证无法达到该边界，再在下一次全量导入时增加规范化名称字段；本设计不预先增加重复文本列。

## 13. 验收标准

1. 同一国家和产品下切换客户类型，候选公司的排序和证据会发生可解释的变化。
2. 高度疑似结果必须同时具有行业和身份文本两类证据。
3. 仅有 `wholesale` 行业的公司最多显示“可能匹配批发商/分销商”，不能显示高度疑似。
4. 名称和域名重复出现同一关键词只能算一个身份文本证据家族。
5. 品牌商、OEM/ODM采购商和最终用户企业永远不会产生高度疑似或可能匹配结论。
6. PDL 原始 `industry` 始终保留，推测类型不会覆盖它。
7. 页面不会宣称所有返回公司都属于用户选择的类型。
8. 缺失行业的公司不能仅凭域名达到高度疑似。
9. 所有20个前端客户类型均有服务端配置和自动化测试。
10. 参数继续使用白名单和参数绑定，不引入 SQL 注入或正则注入。
11. 现有国家、产品、数量查询以及“不生成联系人”的边界不回归。
12. 美国、德国、印度的基准查询均能在现有搜索动画结束前完成。

## 14. 实施范围

后续实施只需要修改现有文件：

- `customer-development-data-sources/pdl/pdl_local.py`
- `src/app.js`
- `src/data.js`（仅在文案或默认选项需要调整时）
- `tests/test_pdl_local.py`
- `tests/customer-development-flow.test.js`
- `CONTEXT.md`（同步已经落地的产品事实和验证步骤）

不新增外部依赖，不新增收费接口，不访问官网，不引入大模型分类。
