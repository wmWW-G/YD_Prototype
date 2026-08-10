const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.join(__dirname, "..");
const appSource = fs.readFileSync(path.join(projectRoot, "src/app.js"), "utf8");
const dataSource = fs.readFileSync(path.join(projectRoot, "src/data.js"), "utf8");
const indexSource = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
const stylesSource = fs.readFileSync(path.join(projectRoot, "src/styles.css"), "utf8");

test("客户搜索页调用真实 PDL 本地接口并保持最短可见时间", () => {
  assert.match(appSource, /const CUSTOMER_DEV_SEARCH_DURATION_MS = 2400;/);
  assert.match(
    appSource,
    /new URL\("\/api\/pdl\/companies", window\.location\.origin\)/
  );
  assert.match(appSource, /await Promise\.allSettled\(/);
  assert.match(
    appSource,
    /void runCustomerDevPdlSearch\(\)/
  );
});

test("主原型使用当前前端缓存键", () => {
  assert.match(
    indexSource,
    /src\/app\.js\?v=20260810-contact-compact-v1/
  );
  assert.match(
    indexSource,
    /src\/styles\.css\?v=20260810-contact-compact-v1/
  );
  assert.match(
    indexSource,
    /src\/dify-config\.js\?v=20260803-dify-thinking-rounds-v1/
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
  assert.match(appSource, /alex\.morgan@example\.com/);
  assert.match(appSource, /jamie\.lee@example\.com/);
  assert.match(appSource, /taylor\.chen@example\.com/);
  assert.doesNotMatch(appSource, /@\$\{lead\.companyDomain\}/);
  assert.match(appSource, /new URL\("\/api\/hunter\/domain-search", window\.location\.origin\)/);
  assert.match(appSource, /endpoint\.searchParams\.set\("domain", lead\.companyDomain\)/);
  assert.match(appSource, /endpoint\.searchParams\.set\("limit", "10"\)/);
  assert.match(appSource, /function runCustomerDevHunterLookup\(leadId\)/);
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
  assert.match(appSource, /\+1 202-555-0101（模拟）/);
  assert.match(appSource, /Head of Procurement/);
  assert.match(appSource, /Business Development Manager/);
  assert.match(appSource, /Supply Chain Specialist/);
  assert.match(appSource, /customer-dev-contact-compact-row/);
  assert.doesNotMatch(appSource, /customer-dev-contact-card/);
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

test("客户公司表只保留勾选、公司、国家和行业", () => {
  const workspaceSource = appSource.slice(
    appSource.indexOf("function renderCustomerDevResultsWorkspace"),
    appSource.indexOf("function renderCustomerDevDetail")
  );

  assert.match(workspaceSource, /<th>行业<\/th>/);
  assert.doesNotMatch(workspaceSource, /<th>客户类型<\/th>/);
  assert.doesNotMatch(workspaceSource, /<th>PDL 行业<\/th>/);
  assert.doesNotMatch(workspaceSource, /<th>客户类型推测<\/th>/);
  assert.doesNotMatch(workspaceSource, /<th>线索说明<\/th>/);
  assert.doesNotMatch(workspaceSource, /<th>联系人<\/th>/);
  assert.doesNotMatch(workspaceSource, /<th>更新时间<\/th>/);
  assert.doesNotMatch(workspaceSource, /escapeHtml\(lead\.(reason|contact|updated)\)/);
  assert.match(workspaceSource, /colspan="4"/);
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
