const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.join(__dirname, "..");
const appSource = fs.readFileSync(path.join(projectRoot, "src/app.js"), "utf8");
const dataSource = fs.readFileSync(path.join(projectRoot, "src/data.js"), "utf8");
const indexSource = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
const stylesSource = fs.readFileSync(path.join(projectRoot, "src/styles.css"), "utf8");
const mapCategoryCatalog = JSON.parse(
  fs.readFileSync(
    path.join(projectRoot, "customer-development-data-sources/foursquare/category-catalog.json"),
    "utf8"
  )
);
const mapRawCategoryCatalog = JSON.parse(
  fs.readFileSync(
    path.join(projectRoot, "customer-development-data-sources/foursquare/raw-category-catalog.json"),
    "utf8"
  )
);

test("客户搜索页调用真实 PDL 本地接口并保持最短可见时间", () => {
  assert.match(appSource, /const CUSTOMER_DEV_SEARCH_DURATION_MS = 2400;/);
  assert.match(
    appSource,
    /new URL\("\/api\/pdl\/companies", window\.location\.origin\)/
  );
  assert.match(appSource, /await Promise\.allSettled\(/);
  assert.match(
    appSource,
    /void runCustomerDevSearch\(\)/
  );
  assert.match(appSource, /await runCustomerDevPdlSearch\(\)/);
});

test("GitHub Pages 使用明确标注的演示公司且不请求不存在的 PDL 接口", () => {
  assert.match(appSource, /function isCustomerDevGitHubDemoHost\(\)/);
  assert.match(appSource, /\.endsWith\("\.github\.io"\)/);
  assert.match(appSource, /function buildCustomerDevGitHubDemoResult\(brief, sortMode/);
  assert.match(appSource, /if \(isCustomerDevGitHubDemoHost\(\)\) \{\s*return buildCustomerDevGitHubDemoResult/s);
  assert.match(appSource, /GitHub Pages 演示数据/);
  assert.match(appSource, /enterprise-\$\{paddedNumber\}\.example\.com/);
  assert.match(appSource, /function buildCustomerDevMockCompanyName\(config, market, index\)/);
  assert.match(appSource, /const resultDataBadge = isMockSource \? "模拟数据" : isDemo \? "演示数据" : "";/);
  assert.match(appSource, /\["results", "contacts"\]\.includes\(state\.customerDevPhase\)/);
});

test("主原型使用当前前端缓存键", () => {
  assert.match(
    indexSource,
    /src\/app\.js\?v=20260825-customer-dev-map-toolbar-v14/
  );
  assert.match(
    indexSource,
    /src\/styles\.css\?v=20260825-customer-dev-map-toolbar-v14/
  );
  assert.match(
    indexSource,
    /src\/dify-config\.js\?v=20260803-dify-thinking-rounds-v1/
  );
  assert.match(
    indexSource,
    /src\/data\.js\?v=20260825-customer-dev-map-toolbar-v14/
  );
});

test("客户 Kass 只展示方案 A 并兼容旧 B 链接", () => {
  assert.doesNotMatch(appSource, /class="kass-version-switch"/);
  assert.doesNotMatch(appSource, /data-kass-version=/);
  assert.match(appSource, /\["\/customer-kass\/B", "\/customer-kass\/A"\]/);
  assert.match(appSource, /\["\/customer-kass\/B\/online", "\/customer-kass\/A\/online"\]/);
});

test("搜索动画只描述处理进度，不输出主观匹配判断", () => {
  assert.doesNotMatch(appSource, /高匹配企业正在进入候选名单/);
  assert.match(appSource, /符合当前宽口径筛选条件的公司正在进入候选名单/);
});

test("PDL 公司数据不会按域名伪造联系人邮箱", () => {
  assert.match(appSource, /PDL 免费公司数据集没有人员记录/);
  assert.doesNotMatch(appSource, /`purchase@\$\{domain\}`/);
  assert.doesNotMatch(appSource, /`bd@\$\{domain\}`/);
  assert.doesNotMatch(appSource, /`info@\$\{domain\}`/);
});

test("联系人按钮默认生成明确标注的模拟数据且不调用真实域名", () => {
  assert.match(appSource, /const CUSTOMER_DEV_USE_MOCK_CONTACTS = true;/);
  assert.match(appSource, /function fetchCustomerDevMockContacts\(lead\)/);
  assert.match(appSource, /@example\.com/);
  assert.match(appSource, /Lena Hoffmann/);
  assert.match(appSource, /Tobias Weber/);
  assert.doesNotMatch(appSource, /@\$\{lead\.companyDomain\}/);
  assert.match(appSource, /new URL\("\/api\/hunter\/domain-search", window\.location\.origin\)/);
  assert.match(appSource, /new URL\("\/api\/hunter\/email-count", window\.location\.origin\)/);
  assert.match(appSource, /function hydrateCustomerDevContactCounts\(leadIds\)/);
  assert.match(appSource, /endpoint\.searchParams\.set\("domain", lead\.companyDomain\)/);
  assert.match(appSource, /endpoint\.searchParams\.set\("limit", "10"\)/);
  assert.match(appSource, /function runCustomerDevHunterLookup\(leadId, options = \{\}\)/);
  assert.match(appSource, /CUSTOMER_DEV_USE_MOCK_CONTACTS[\s\S]*fetchCustomerDevMockContacts\(lead\)[\s\S]*fetchCustomerDevHunterContacts\(lead\)/);
  assert.match(appSource, /data-customer-dev-hunter-lookup/);
  assert.match(appSource, /Hunter Domain Search/);
  assert.match(appSource, />\s*获取联系人\s*</);
  assert.match(appSource, /显示邮箱/);
  assert.match(appSource, /lead\.displayCompany \|\| lead\.company/);
  assert.match(appSource, /renderCustomerDevExternalLink\(lead\.websiteUrl, "访问官方网站", "官网待补充"\)/);
  assert.doesNotMatch(appSource, /HUNTER_API_KEY/);

  const actionSource = appSource.slice(
    appSource.indexOf("function renderCustomerDevHunterAction"),
    appSource.indexOf("function renderCustomerDevCompanyPanel")
  );
  assert.doesNotMatch(actionSource, /用 Hunter|重新查询 Hunter|Hunter 查询中|Hunter 已返回|Hunter 暂未|消耗 Hunter/);

  const companyPanelSource = appSource.slice(
    appSource.indexOf("function renderCustomerDevCompanyPanel"),
    appSource.indexOf("function renderCustomerDevContactChannels")
  );
  assert.match(companyPanelSource, /\$\{contacts\.length \? `[\s\S]*已知联系人/);
  assert.match(companyPanelSource, /已知联系人 <span>\$\{contacts\.length\}<\/span>/);
  assert.match(appSource, /已生成 \$\{result\.contacts\.length\} 位模拟联系人/);
  assert.match(appSource, /仅用于原型演示/);
  assert.match(appSource, /<dt>姓名<\/dt>[\s\S]*<dt>岗位<\/dt>[\s\S]*<dt>邮箱<\/dt>[\s\S]*<dt>电话<\/dt>/);
  assert.match(appSource, /contact\.phone \|\| "未提供"/);
  assert.match(appSource, /\+49 30 0000/);
  assert.match(appSource, /Head of Procurement/);
  assert.match(appSource, /Business Development Director/);
  assert.match(appSource, /Supply Chain Manager/);
  assert.match(appSource, /customer-dev-contact-compact-row/);
  assert.doesNotMatch(appSource, /customer-dev-contact-card/);
  assert.match(appSource, /<button type="button" data-customer-dev-open-contacts data-customer-dev-detail-tab="contact">查看联系人资料<\/button>/);
  assert.doesNotMatch(appSource, /href="#\/customer-development\/contacts" data-customer-dev-open-contacts/);
  assert.match(appSource, /customerDevDetailTab: "overview"/);
  assert.match(appSource, /state\.customerDevDetailTab = "contact";\s*renderApp\(\);/);
  assert.match(
    appSource,
    /if \(result\.contacts\.length\) \{[\s\S]*state\.customerDevDetailTab = "contact";[\s\S]*renderApp\(\);/
  );
  assert.match(appSource, /activeDetailTab === "contact" \? "" : " hidden"/);
  assert.match(stylesSource, /\.customer-dev-contact-compact-row dl\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/s);
  assert.match(stylesSource, /\.customer-dev-contact-compact-row\s*\{[^}]*border-bottom:\s*1px solid #eee5de;/s);

  const pdlFetchSource = appSource.slice(
    appSource.indexOf("async function fetchCustomerDevPdlCompanies"),
    appSource.indexOf("/**\n * 把本地 Hunter 代理返回")
  );
  assert.doesNotMatch(pdlFetchSource, /hunter/i);
});

test("客户类型作为可选偏好单独发送给 PDL", () => {
  assert.match(dataSource, /"不限 \/ 智能推荐"/);
  assert.match(appSource, /endpoint\.searchParams\.set\("role", brief\.role\)/);
  assert.match(appSource, /function getCustomerDevPdlProductIndustries\(brief\)/);
  assert.doesNotMatch(appSource, /CUSTOMER_DEV_PDL_ROLE_INDUSTRIES/);
});

test("结果页提供三种服务端排序并默认使用可解释推荐分", () => {
  assert.match(appSource, /customerDevSort: "recommended"/);
  assert.match(appSource, /endpoint\.searchParams\.set\("sort", sortMode\)/);
  assert.match(appSource, /data-customer-dev-sort/);
  assert.match(appSource, /value: "recommended", label: "推荐排序"/);
  assert.match(appSource, /value: "complete", label: "资料最完整"/);
  assert.match(appSource, /value: "size_desc", label: "公司规模"/);
  assert.match(appSource, /function refreshCustomerDevPdlSort\(nextSort\)/);
  assert.match(appSource, /推荐依据：/);
  assert.match(stylesSource, /\.customer-dev-sort-control/);
});

test("客户公司表支持行内邮箱加载、独立勾选和批量加载", () => {
  const workspaceSource = appSource.slice(
    appSource.indexOf("function renderCustomerDevResultsWorkspace"),
    appSource.indexOf("function renderCustomerDevDetail")
  );

  assert.match(workspaceSource, /isMap \? "场所类别" : "行业"/);
  assert.match(workspaceSource, /isMap \? "数据更新" : "公司规模"/);
  assert.match(workspaceSource, /isMap \? "公开联系方式" : "联系人"/);
  assert.doesNotMatch(workspaceSource, /<th>客户编号<\/th>/);
  assert.doesNotMatch(workspaceSource, /<th>电话<\/th>/);
  assert.doesNotMatch(workspaceSource, /<th>优先级<\/th>/);
  assert.doesNotMatch(workspaceSource, /<th>线索来源<\/th>/);
  assert.match(workspaceSource, /<th>跟进状态<\/th>/);
  assert.match(workspaceSource, /<th>操作<\/th>/);
  assert.match(workspaceSource, /data-customer-dev-select-all/);
  assert.match(workspaceSource, /data-customer-dev-batch-email/);
  assert.doesNotMatch(workspaceSource, /<th>客户类型<\/th>/);
  assert.doesNotMatch(workspaceSource, /<th>PDL 行业<\/th>/);
  assert.doesNotMatch(workspaceSource, /<th>客户类型推测<\/th>/);
  assert.doesNotMatch(workspaceSource, /<th>线索说明<\/th>/);
  assert.doesNotMatch(workspaceSource, /<th>邮箱<\/th>/);
  assert.match(workspaceSource, /位可获取/);
  assert.match(workspaceSource, /数量免费 · 获取后扣点/);
  assert.match(workspaceSource, /获取联系人/);
  assert.doesNotMatch(workspaceSource, /<th>更新时间<\/th>/);
  assert.doesNotMatch(workspaceSource, /escapeHtml\(lead\.(reason|contact|updated)\)/);
  assert.match(workspaceSource, /colspan="7"/);
  assert.match(workspaceSource, /href="#\/agents\/customer-research"[^>]*>背调<\/a>/);
  assert.match(appSource, /data-customer-dev-select-lead/);
  assert.match(appSource, /data-customer-dev-email-lookup/);
  assert.match(appSource, /runCustomerDevHunterLookup\(leadId, \{ openDetail: false, expandInline: true \}\)/);
  assert.match(appSource, /function runCustomerDevBatchEmailLookup\(\)/);
  assert.match(appSource, /for \(const leadId of leadIds\)/);
  assert.match(appSource, /customerDevExpandedContactLeadIds: new Set\(\)/);
  assert.match(appSource, /data-customer-dev-toggle-contacts/);
  assert.match(appSource, /customer-dev-contact-child-row/);
  assert.match(appSource, /contact\.name \|\| "未提供"/);
  assert.match(appSource, /contact\.title \|\| "未提供"/);
  assert.match(appSource, /contact\.email \|\| "未提供"/);
  assert.match(appSource, /contact\.phone \|\| "未提供"/);
  assert.match(stylesSource, /\.customer-dev-email-cell/);
  assert.match(stylesSource, /\.customer-dev-contact-child-row/);
  assert.match(stylesSource, /\.customer-dev-contact-child/);
  assert.match(stylesSource, /\.customer-dev-row-actions/);
  assert.match(stylesSource, /\.customer-dev-detail-layer/);
});

test("地图获客使用外贸业务字段且不保留地推半径", () => {
  assert.match(dataSource, /quantities: \[20, 50, 100, 200\]/);
  assert.doesNotMatch(dataSource, /quantities: \[[^\]]*(?:80|120|500)[^\]]*\]/);
  assert.match(appSource, /customerDevSource: "google"/);
  assert.match(appSource, /value: "map", label: "地图获客"/);
  assert.match(appSource, /data-customer-dev-source="\$\{escapeHtml\(source\.value\)\}"/);
  assert.match(appSource, /data-customer-dev-map-field="city"/);
  assert.match(appSource, /data-customer-dev-picker="product"/);
  assert.match(appSource, /resolveCustomerDevMapCategoryFromProduct\(state\.customerDevBrief\.product\)/);
  assert.doesNotMatch(appSource, /data-customer-dev-map-category-open/);
  assert.doesNotMatch(appSource, /data-customer-dev-map-field="category"/);
  assert.doesNotMatch(appSource, /data-customer-dev-map-field="radius"/);
  assert.match(appSource, /data-customer-dev-map-field="contact"/);
  assert.doesNotMatch(appSource, /data-customer-dev-map-field="quantity"/);
  assert.match(appSource, /quantity: state\.customerDevBrief\.quantity/);
  assert.doesNotMatch(appSource, /quantities\.filter\(\(quantity\) => quantity <= 200\)/);
  assert.match(appSource, /单次最多 200 家/);
  assert.doesNotMatch(appSource, /endpoint\.searchParams\.set\("radius_km"/);
  assert.match(appSource, /new URL\("\/api\/foursquare\/places", window\.location\.origin\)/);
  assert.match(appSource, /new Intl\.Locale\(`und-\$\{code\}`\)\.region !== code/);
  assert.match(appSource, /function normalizeCustomerDevFoursquarePlace\(place, brief\)/);
  assert.match(appSource, /mode: "foursquare"/);
  assert.match(appSource, /function buildCustomerDevMapPrototypeResult\(brief\)/);
  assert.match(appSource, /mode: "foursquare-demo"/);
  assert.match(appSource, /Foursquare OS Places · 原型预览/);
  assert.match(appSource, /不提供客户角色、公司规模或采购意向/);
  assert.match(appSource, /if \(brief\.contact === "有官网"\) hasWebsite = true/);
  assert.match(appSource, /function renderCustomerDevMapPlacePanel\(lead\)/);
  assert.doesNotMatch(appSource, /批量加入客户库/);
  assert.doesNotMatch(appSource, /资料完整度优先/);
  assert.doesNotMatch(stylesSource, /\.customer-dev-map-sort-note/);
  assert.match(stylesSource, /\.customer-dev-source-switch/);
  assert.match(stylesSource, /\.customer-dev-map-channels/);
});

test("客户开发按业务方式展示数据来源且不暴露供应商", () => {
  assert.match(appSource, /label: "Google 搜索获客"/);
  assert.match(appSource, /label: "TikTok 获客"/);
  assert.match(appSource, /label: "企业数据库"/);
  assert.match(appSource, /label: "地图获客"/);
  assert.match(appSource, /label: "海关获客"/);
  assert.match(appSource, /label: "社媒获客"/);
  assert.match(appSource, /label: "领英获客"/);
  assert.match(appSource, /label: "展会获客"/);
  assert.match(appSource, /"联系人获取"/);
  assert.match(appSource, /"贸易记录"/);
  assert.match(appSource, /"工商信息"/);
  assert.match(appSource, /"产品信息"/);
  assert.match(appSource, /"商业关系"/);
  assert.match(appSource, /"知识产权"/);
  assert.match(appSource, /"新闻舆情"/);
  assert.match(appSource, /customer-dev-intelligence-canvas/);
  assert.match(appSource, /用自然语言描述你的目标客户/);
  assert.doesNotMatch(appSource, /<aside class="customer-dev-intelligence-aside"/);
  assert.match(appSource, /activeSource\.value === "ai" \? "开始企业数据库获客"/);
  assert.doesNotMatch(appSource, /腾道|Tendata|tendata/);
  assert.match(stylesSource, /\.customer-dev-intelligence-canvas\s*\{/);
  assert.match(stylesSource, /customer-development-global-network\.png/);
  assert.match(stylesSource, /\.customer-dev-intelligence-canvas \.customer-dev-source-switch\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(150px, 1fr\)\)/);
  assert.match(stylesSource, /\.customer-dev-enrichment-options/);
});

test("未接入来源使用明确标注的纯前端模拟流程", () => {
  assert.match(appSource, /const CUSTOMER_DEV_MOCK_SOURCE_CONFIG = Object\.freeze\(\{/);
  assert.match(appSource, /mode: "mock-google"/);
  assert.match(appSource, /mode: "mock-tiktok"/);
  assert.match(appSource, /mode: "mock-customs"/);
  assert.match(appSource, /mode: "mock-social"/);
  assert.match(appSource, /mode: "mock-linkedin"/);
  assert.match(appSource, /mode: "mock-exhibition"/);
  assert.match(appSource, /function buildCustomerDevMockSourceResult\(sourceValue, brief\)/);
  assert.match(appSource, /`https:\/\/\$\{sourceValue\}-lead-\$\{paddedNumber\}\.example\.com`/);
  assert.match(appSource, /原型模拟数据，不代表真实企业、贸易、社媒、职位或参展记录/);
  assert.match(appSource, /function runCustomerDevMockSourceSearch\(\)/);
  assert.match(appSource, /if \(CUSTOMER_DEV_MOCK_SOURCE_CONFIG\[state\.customerDevSource\]\) \{\s*await runCustomerDevMockSourceSearch\(\);/s);
  assert.match(appSource, /mockSourceConfig\.steps/);
  assert.match(appSource, /全部为模拟数据/);
  assert.doesNotMatch(appSource, /模拟推荐排序/);
  assert.doesNotMatch(appSource, /重新生成\$\{escapeHtml/);
  assert.doesNotMatch(appSource, /data-customer-dev-source-unavailable/);
  assert.doesNotMatch(appSource, /当前数据服务暂不可用/);
});

test("产品选择器支持输入、近似推荐和保留自定义产品", () => {
  assert.match(appSource, /customerDevProductQuery: ""/);
  assert.match(appSource, /const CUSTOMER_DEV_PRODUCT_ALIASES = Object\.freeze\(\{/);
  assert.match(appSource, /"光伏组件": Object\.freeze\(\["太阳能板"/);
  assert.match(appSource, /function scoreCustomerDevProductText\(query, candidate\)/);
  assert.match(appSource, /function getCustomerDevProductMatches\(query, limit = 8\)/);
  assert.match(appSource, /\.filter\(\(match\) => match\.score >= 24\)/);
  assert.match(appSource, /data-customer-dev-product-search/);
  assert.match(appSource, /输入产品名称/);
  assert.match(appSource, /近似匹配/);
  assert.match(appSource, /data-customer-dev-product-custom=/);
  assert.match(appSource, /保留自定义产品/);
  assert.match(appSource, /宽口径匹配，结果需要人工核验/);
  assert.match(appSource, /function refreshCustomerDevProductSearch\(\)/);
  assert.match(appSource, /state\.customerDevBrief\.product = customProduct/);
  assert.match(appSource, /state\.customerDevProductCategory = categoryId/);
  assert.match(appSource, /function getCustomerDevProductGroup\(brief\)/);
  assert.match(stylesSource, /\.customer-dev-product-search/);
  assert.match(stylesSource, /\.customer-dev-product-custom/);
});

test("商户行业展示 64 项 B2B 聚合目录并在后台保留 1,274 条原始映射", () => {
  const businessItems = mapCategoryCatalog.groups.flatMap((group) => group.items);
  const rawItems = mapRawCategoryCatalog.groups.flatMap((group) => group.items);

  assert.equal(mapCategoryCatalog.groups.length, 10);
  assert.equal(businessItems.length, 64);
  assert.equal(mapRawCategoryCatalog.groups.length, 11);
  assert.equal(rawItems.length, 1274);
  assert.deepEqual(
    Object.fromEntries(mapRawCategoryCatalog.groups.map((group) => [group.official_label, group.items.length])),
    {
      "Arts and Entertainment": 73,
      "Business and Professional Services": 196,
      "Community and Government": 128,
      "Dining and Drinking": 392,
      Event: 17,
      "Health and Medicine": 59,
      "Landmarks and Outdoors": 96,
      "Nightlife Spot": 1,
      Retail: 151,
      "Sports and Recreation": 87,
      "Travel and Transportation": 74,
    }
  );
  assert.match(appSource, /customer-development-data-sources\/foursquare\/category-catalog\.json/);
  assert.match(appSource, /function resolveCustomerDevMapCategoryFromProduct\(product\)/);
  assert.doesNotMatch(appSource, /data-customer-dev-map-category-search/);
  assert.doesNotMatch(appSource, /data-customer-dev-map-category-group/);
  assert.doesNotMatch(appSource, /data-customer-dev-map-category-mode/);
  assert.doesNotMatch(appSource, /查看全部 1,274 条原始分类/);
  assert.doesNotMatch(appSource, /FOURSQUARE CATEGORY DIRECTORY/);
  assert.ok(businessItems.some((item) => item.value === "汽车零部件与配件渠道"));
  assert.ok(businessItems.some((item) => item.value === "餐饮与连锁门店" && item.category_terms.includes("dining and drinking")));
  assert.ok(rawItems.some((item) => item.value === "Retail > Automotive Retail > Car Parts and Accessories"));
  assert.ok(rawItems.every((item) => item.path && item.label && item.category_terms.length === 1));
  assert.ok(mapCategoryCatalog.groups.every((group) => !["地标与户外", "夜生活"].includes(group.label)));
});

test("结果页获客目标区域保持紧凑且不展示数据来源行", () => {
  const workspaceSource = appSource.slice(
    appSource.indexOf("function renderCustomerDevResultsWorkspace"),
    appSource.indexOf("function renderCustomerDevDetail")
  );

  assert.doesNotMatch(workspaceSource, /customer-dev-data-attribution/);
  assert.doesNotMatch(workspaceSource, /People Data Labs Free Company Dataset/);
  assert.match(stylesSource, /\.customer-dev-brief-summary\s*\{[^}]*min-height:\s*84px;[^}]*padding:\s*4px 2px 10px;/s);
  assert.match(stylesSource, /\.customer-dev-brief-summary strong\s*\{[^}]*font-size:\s*clamp\(24px, 2\.4vw, 32px\);/s);
});

test("用户界面展示自然英文业务行业而不是 PDL 原始行业", () => {
  assert.match(appSource, /energy: "Renewable Energy & Power"/);
  assert.doesNotMatch(appSource, /energy: "RENEWABLE ENERGY & ENVIRONMENT"/);
  assert.match(appSource, /function getCustomerDevProductIndustryLabel\(brief\)/);
  assert.match(appSource, /const displayIndustry = getCustomerDevProductIndustryLabel\(brief\)/);
  assert.match(appSource, /type: displayIndustry/);
  assert.match(appSource, /industry: displayIndustry/);
  assert.match(appSource, /pdlIndustry: industry/);
  assert.match(appSource, /业务行业：\$\{displayIndustry\}/);
  assert.match(appSource, /class="customer-dev-industry-cell"/);
  assert.match(stylesSource, /\.customer-dev-industry-cell\s*\{[^}]*font-size:\s*14px;[^}]*font-weight:\s*750;/s);
  assert.doesNotMatch(stylesSource, /\.customer-dev-industry-cell\s*\{[^}]*text-transform:\s*uppercase;/s);
});

test("客户类型推测仍保留后台证据与核验状态", () => {
  assert.match(appSource, /优先客户类型（可选）/);
  assert.match(appSource, /role_match_evidence/);
  assert.match(appSource, /roleVerified/);
  assert.match(appSource, /高度疑似/);
  assert.match(appSource, /类型待核验/);
  assert.match(stylesSource, /\.customer-dev-role-badge\.is-high/);
});

test("客户详情卡先展示四项宫格，再展示官网和 LinkedIn", () => {
  const detailSource = appSource.slice(
    appSource.indexOf("function renderCustomerDevDetail"),
    appSource.indexOf("function renderCustomerDevContactsView")
  );

  assert.match(appSource, /customer-dev-detail-kicker/);
  assert.match(appSource, /customer-dev-detail-meta/);
  assert.match(detailSource, /customer-dev-facts-grid/);
  assert.match(
    detailSource,
    /<dt>公司规模<\/dt>[\s\S]*<dt>成立时间<\/dt>[\s\S]*<dt>地点<\/dt>[\s\S]*<dt>行业<\/dt>[\s\S]*<dt>官网<\/dt>[\s\S]*<dt>LinkedIn 公司页<\/dt>/
  );
  assert.doesNotMatch(detailSource, /<dt>客户类型<\/dt>/);
  assert.doesNotMatch(detailSource, /renderCustomerDevRoleBadge\(lead\)/);
  assert.doesNotMatch(detailSource, /data-customer-dev-detail-tab="signals"/);
  assert.doesNotMatch(detailSource, /data-customer-dev-detail-panel="signals"/);
  assert.doesNotMatch(detailSource, />公开动态/);
  assert.match(stylesSource, /\.customer-dev-detail-tabs\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/s);
  assert.match(
    stylesSource,
    /\.customer-dev-detail\s*\{[^}]*border-radius:\s*14px;/s
  );
  assert.doesNotMatch(
    stylesSource,
    /\.customer-dev-detail\s*\{[^}]*border-top:\s*3px solid/s
  );
});

test("PDL 公司名称以可追溯的双层身份信息展示", () => {
  assert.match(appSource, /function getCustomerDevCompanyIdentity\(name, website\)/);
  assert.match(appSource, /displayCompany: companyIdentity\.displayName/);
  assert.match(appSource, /companyDomain: companyIdentity\.domain/);
  assert.match(appSource, /原始名称：\$\{lead\.company\}/);
  assert.match(appSource, /customer-dev-company-mark/);
  assert.match(appSource, /官网已收录/);
  assert.match(stylesSource, /\.customer-dev-company-copy strong/);
  assert.match(stylesSource, /\.customer-dev-company-copy small/);
});

test("官网和 LinkedIn 使用规范化安全外链且不裸露 URL", () => {
  assert.match(appSource, /function normalizeCustomerDevExternalUrl\(value, kind\)/);
  assert.match(appSource, /hostname === "linkedin\.com"/);
  assert.match(appSource, /\/\^\\\/company\\\/\[\^\/\]\+\/i/);
  assert.match(appSource, /target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer"/);
  assert.match(appSource, /访问官方网站/);
  assert.match(appSource, /查看 LinkedIn 公司页/);
  assert.doesNotMatch(appSource, /<dd>\$\{escapeHtml\(lead\.website\)\}<\/dd>/);
  assert.doesNotMatch(appSource, /<dd>\$\{escapeHtml\(lead\.linkedin/);
  assert.match(stylesSource, /\.customer-dev-fact-link/);
});
