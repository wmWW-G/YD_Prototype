const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.join(__dirname, "..");
const appSource = fs.readFileSync(path.join(projectRoot, "src/app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
const stylesSource = fs.readFileSync(path.join(projectRoot, "src/styles.css"), "utf8");

test("客户搜索页保持可见后再通过 URL 进入结果页", () => {
  assert.match(appSource, /const CUSTOMER_DEV_SEARCH_DURATION_MS = 2400;/);
  assert.match(
    appSource,
    /window\.location\.hash !== "#\/customer-development\/searching"/
  );
  assert.match(
    appSource,
    /window\.location\.hash = "#\/customer-development\/results"/
  );
});

test("主原型使用当前前端缓存键", () => {
  assert.match(
    indexSource,
    /src\/app\.js\?v=20260803-dify-thinking-rounds-v1/
  );
  assert.match(
    indexSource,
    /src\/styles\.css\?v=20260803-dify-thinking-rounds-v1/
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
  assert.match(appSource, /符合当前筛选条件的企业正在进入候选名单/);
});

test("客户详情卡用分组事实层级替代扁平键值列表", () => {
  assert.match(appSource, /customer-dev-detail-kicker/);
  assert.match(appSource, /customer-dev-detail-meta/);
  assert.match(appSource, /customer-dev-facts-grid/);
  assert.match(appSource, /customer-dev-fact customer-dev-fact-wide/);
  assert.match(
    stylesSource,
    /\.customer-dev-detail\s*\{[^}]*border-radius:\s*14px;/s
  );
  assert.doesNotMatch(
    stylesSource,
    /\.customer-dev-detail\s*\{[^}]*border-top:\s*3px solid/s
  );
});
