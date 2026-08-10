# 客户开发免费数据源备忘

## 用途与边界

本目录记录 `客户开发 / Lead Enrichment` 已接入及后续可能采用的数据来源，方便产品规划、技术选型和再次验收。

当前状态：

- 当前主项目已接入 PDL Free Company Dataset 的本地公司搜索，以及 Hunter Domain Search 的单家公司按需联系人补全；其余来源仍是候选，不能把历史验收状态写成当前线上能力。
- 2026-07-24 曾在独立 worktree 中完成一版 18 源只读 adapter、确定性路由器和 live smoke，但该实现没有合并进当前主目录。
- 历史状态只代表当时的真实验证结果。正式使用前必须重新核对许可证、商业使用条款、接口版本、限流和连通状态。
- “免费”不代表无限调用，也不代表包含联系人邮箱、手机号等 enrichment 数据。

## 无需 Key 的开放来源

| 来源 | 国家/范围 | 主要用途 | 历史验收状态 |
| --- | --- | --- | --- |
| Overture Places | 全球 | POI、企业地点、分类和官网 | `verified_live` |
| OpenStreetMap / Overpass | 全球 | 本地商家和地点补充 | 首轮取得过数据；最终复验公共实例连续 504，按 `temporarily_unavailable` 记录 |
| GLEIF API | 全球 | 法人、LEI、注册地址和企业关系 | `verified_live` |
| France SIRENE Open Search | 法国 | 企业、SIREN 和地址 | `verified_live` |
| TED Search API v3 | 欧盟/欧洲经济区 | 采购和招投标公告 | `verified_live` |
| SEC EDGAR | 美国 | 上市公司、CIK 和申报记录 | `verified_live` |
| USAspending API v2 | 美国 | 政府采购、合同和获奖方 | `verified_live` |
| Contracts Finder OCDS | 英国 | 公共采购 release / record | `verified_live` |
| Wikidata | 全球 | 企业别名、官网和关系补全 | 当时官方入口连接超时，`temporarily_unavailable` |
| Common Crawl | 全球 | 已知企业域名的历史网页和官网补全 | `verified_live`；完成过 CDXJ、Range 和 WARC 内容验证 |
| GDELT DOC 2 | 全球 | 企业新闻和行业信号 | 当时连续 HTTP 429，`temporarily_unavailable` |
| IANA Bootstrap / Registry RDAP | 全球 | 域名注册和权威注册局信息 | `verified_live` |
| EU VIES | 欧盟 | VAT 号码验证 | `verified_live` |
| World Bank Procurement Notices | 全球 | 世界银行采购公告和项目信号 | `verified_live` |
| World Bank GPPD | 全球/国家级 | 公共采购制度背景数据 | `dataset_only_verified`；不能当作实时企业搜索 API |

## 免费注册后需要服务端凭证的来源

| 来源 | 国家/范围 | 服务端环境变量 | 主要用途 | 历史验收状态 |
| --- | --- | --- | --- | --- |
| Companies House | 英国 | `COMPANIES_HOUSE_API_KEY` | 工商、企业和申报记录 | `credential_required` |
| SAM.gov Get Opportunities Public API | 美国 | `SAM_GOV_API_KEY` | 政府采购机会 | `credential_required` |
| ABN Lookup Web Services | 澳大利亚 | `ABN_LOOKUP_GUID` | 企业和 ABN 信息 | `credential_required` |
| Hunter Domain Search | 全球 | `HUNTER_API_KEY` | 已知公司域名补充姓名、职位、邮箱、电话和 LinkedIn | `integrated_live_verified`；2026-08-10 单域名真实返回 10 位联系人 |

法国完整 INSEE Sirene API 还可选用 `INSEE_SIRENE_API_KEY`。没有该 Key 时，可继续使用上表中已经验证过的法国政府开放企业搜索接口。

## 单独评估过、尚未加入 18 源登记表

### People Data Labs Free Company Dataset

- 2026-08-07 已在主项目接入本地 Python + DuckDB 版本，代码位于 `pdl/`。
- 当前已用确定性 CSV 小样本验证域名去重、国家/行业/规模/成立时间查询、线程化 HTTP 接口和前端结果展示；导入器同时接受 ZIP、PSV、JSON 和同格式分片目录。
- 2026-08-07 实际下载文件名为 `free_company_dataset.csv.zip`，内容是有效的 GZIP 压缩 CSV，而不是普通 ZIP。导入器按文件签名识别并交给 DuckDB 流式读取，不在本地额外解压出完整 CSV。
- 同日已完成真实全量导入验收：压缩文件 2,307,595,146 字节，流式解压后 5,629,540,965 字节、35,829,088 行（含表头）；最终按域名等标识去重得到 35,828,987 家公司，DuckDB 约 2.3 GB。页面以“德国 · 光伏组件”实测返回 68,844 条宽口径候选，本页 100 家，浏览器控制台无错误。
- 数据集提供公司名、域名、总部、行业、规模、成立时间和 LinkedIn，不提供员工联系人、个人邮箱、公司公开电话或具体采购意图。
- 当前官方页面将该数据集标记为 CC0 1.0；产品仍展示 People Data Labs 数据来源。原始下载文件、DuckDB、虚拟环境和日志均不进入 Git。

### Hunter Domain Search

- 2026-08-10 已接入 `pdl/pdl_local.py`：PDL 先返回带域名的公司，用户在单家公司详情中点击「用 Hunter 获取联系人」后，浏览器才调用同源 `/api/hunter/domain-search`，本地服务再访问 Hunter 官方 Domain Search API。
- 单次最多返回 10 位联系人，优先展示决策人、实名邮箱和高置信度记录；可用字段包括姓名、职位、邮箱类型、置信度、部门、职级、决策人标记、邮箱验证状态、电话和 LinkedIn。产品不根据域名生成或猜测邮箱。
- Hunter 查询可能消耗额度，因此严禁在 PDL 搜索、翻页或打开结果页时自动批量调用。联系人只保存在当前浏览器内存中；点击「显示邮箱」只显示已取回的结果，不会再次请求 Hunter。
- `HUNTER_API_KEY` 只从本地服务进程环境读取，不进入前端、访问日志或 Git。当前已用模拟上游响应验证字段归一化、排序和错误状态，并用用户提供的临时进程环境完成一次真实调用：单个德国公司域名返回 10 位联系人，约 4.0 秒；随后点击「显示邮箱」没有产生第二次 Hunter 请求。真实 Key 没有写入项目文件。
- 当前规则以 Hunter 官方 [API 文档](https://hunter.io/api-documentation) 和 [额度说明](https://help.hunter.io/en/articles/1911617-how-do-credits-work-in-hunter) 为准。免费计划和不同产品套餐的计费口径可能变化，正式长期使用前应重新核对。

### Foursquare OS Places

- 全球超过一亿个 POI，适合下载后建立本地地点与企业候选库。
- 后续若采用，应重新验证最新开放数据许可、下载方式、更新机制和字段覆盖。
- 可以评估作为 Overture Places 的主源或补充源，但不能仅凭数据量决定。

## 不计入“免费开放数据源”的项目

- `LinkedIn`：没有免费开放的人员搜索 API，也不应依赖未授权抓取。
- `Google Places`：属于计费 API。
- `OpenSanctions`：商业用途不能按完全免费来源处理。
- `Firecrawl / Fire Enrich`：不属于免费开放企业数据库。
- `Hunter`：属于需要账户额度的联系人 enrichment 服务；本项目虽已接入，但不能把它记作无限免费开放数据源。
- `DuckDB`、`OpenSearch`、`ClickHouse`、`libphonenumber` 等属于实现组件，不是外部数据来源。

## 后续接入原则

1. 按国家和查询意图选择 1～3 个主要来源，不让一次用户查询同时请求全部来源。
2. 主来源失败时按确定顺序降级到备用来源，并允许返回部分结果。
3. 企业地点库、工商库、采购库、新闻库和联系人 enrichment 分层处理。
4. 数据集适合提前下载、本地索引和定期增量更新；实时 API 适合核验和补充。
5. 联系人姓名、职位、邮箱和手机号不能从公司级开放数据中凭空生成，需要单独的公开网页核验或合规 enrichment 来源。

## 历史实现线索

2026-07-24 的独立 worktree 曾保留：

- 18 源 source registry。
- 统一 adapter 与标准化结果。
- 普通查询最多并发 3 个、增强查询最多并发 5 个的确定性路由器。
- 超时、有限重试、退避、部分结果、错误分类和安全日志。
- 单源及 `all` 模式的 live smoke。

如果以后要重新启用，应先从本文件确定候选来源，再重新联网验证，不应直接把历史状态写成当前可用。
