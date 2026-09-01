const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const extensionRoot = path.resolve(__dirname, "..");

/**
 * 读取侧边栏交付文件。
 *
 * @param {string} filename - 扩展目录下的文件名。
 * @returns {string} UTF-8 文件正文。
 * @throws {Error} 文件不存在时抛出，让测试明确失败。
 */
function readPanelFile(filename) {
  const filePath = path.join(extensionRoot, filename);
  assert.equal(fs.existsSync(filePath), true, `${filename} 应存在`);
  return fs.readFileSync(filePath, "utf8");
}

test("Side Panel 把四个使用场景拆成首页入口和独立操作页", () => {
  const html = readPanelFile("sidepanel.html");

  ["user-failed", "app-failed", "marker", "cost"].forEach((mode) => {
    assert.match(html, new RegExp(`data-scenario=["']${mode}["']`));
  });
  assert.match(html, /id=["']home-view["']/);
  assert.match(html, /id=["']scenario-view["']/);
  assert.match(html, /id=["']back-button["']/);
  assert.match(html, /id=["']scenario-title["']/);
  assert.match(html, /id=["']scenario-description["']/);
  assert.match(html, /name=["']locator-mode["'][^>]+value=["']marker["']/);
  assert.match(html, /name=["']locator-mode["'][^>]+value=["']run-id["']/);
  assert.match(html, /对话关键词或特征文本/);
  assert.match(html, /Run ID/);
  assert.match(html, /终端用户 ID（可选）/);
  assert.match(html, /id=["']conversation-field["']/);
  assert.match(html, /id=["']conversation-id["']/);
  assert.match(html, /Conversation ID/);
  assert.doesNotMatch(html, /大便好不好吃/);

  ["today", "recent-1h", "recent-4h", "custom"].forEach((preset) => {
    assert.match(html, new RegExp(`value=["']${preset}["']`));
  });
  assert.match(html, /id=["']app-id["']/);
  assert.match(html, /id=["']query-button["']/);
  assert.match(html, /id=["']cancel-query-button["']/);
  assert.match(html, /id=["']refresh-auth-button["']/);
  assert.match(html, /id=["']reload-context-button["']/);
  assert.match(html, /id=["']cost-summary["']/);
  assert.match(html, /id=["']error-summary["']/);
  assert.match(html, /id=["']query-progress["']/);
  assert.match(html, /全部币种/);
});

test("Side Panel 只向后台发送结构化消息，不接收任意 URL、方法或请求头", () => {
  const source = readPanelFile("sidepanel.js");

  assert.match(source, /GET_ACTIVE_CONTEXT/);
  assert.match(source, /RUN_QUERY/);
  assert.match(source, /REFRESH_AUTH_CONTEXT/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /headers\s*:/);
  assert.doesNotMatch(source, /method\s*:/);
  assert.doesNotMatch(source, /console\.(?:log|debug|info)\s*\(/);
  assert.match(source, /activeScenario/);
  assert.match(source, /selectScenario/);
  assert.match(source, /returnHome/);
  assert.match(source, /handleReloadContext/);
  assert.match(source, /handleCancelQuery/);
  assert.match(source, /CANCEL_QUERY/);
  assert.match(source, /QUERY_PARTIAL/);
  assert.match(source, /LOAD_ERROR_CATEGORY/);
  assert.match(source, /detailCompleted/);
  assert.match(source, /detailTotal/);
  assert.match(source, /categoryDetails/);
  assert.match(source, /cost_by_currency/);
  assert.match(source, /人民币（RMB）/);
  assert.match(source, /美元（USD）/);
  assert.match(source, /errors_by_category/);
  assert.match(source, /createElement\(["']details["']\)/);
  assert.match(source, /percentage/);
  assert.match(source, /mode\s*=\s*["']run-id["']/);
  assert.match(source, /runId/);
  assert.match(source, /conversationId/);
  assert.match(source, /MISSING_CONVERSATION_ID|请填写完整的 Conversation ID/);
  assert.match(source, /已全部列出/);
  assert.doesNotMatch(source, /大便好不好吃/);
});

test("查询结果只用 textContent 渲染，禁止 innerHTML 和原始 JSON 对象", () => {
  const source = readPanelFile("sidepanel.js");

  assert.match(source, /\.textContent\s*=/);
  assert.doesNotMatch(source, /\.innerHTML\s*=/);
  assert.doesNotMatch(source, /insertAdjacentHTML/);
  assert.doesNotMatch(source, /JSON\.stringify\s*\(\s*report/);
  assert.doesNotMatch(source, /eval\s*\(/);
});

test("页面包含认证指导、覆盖声明、进度和空状态容器", () => {
  const html = readPanelFile("sidepanel.html");

  assert.match(html, /请先打开 Dify Cloud 中某个 App 的日志页面/);
  assert.match(html, /刷新日志页/);
  assert.match(html, /id=["']progress-region["']/);
  assert.match(html, /id=["']coverage-region["']/);
  assert.match(html, /id=["']results-region["']/);
  assert.match(html, /在当前应用、时间窗、筛选条件和分页覆盖内未匹配/);
});

test("样式改为简约白底，并保留 TokenMind 品牌和窄栏边界", () => {
  const html = readPanelFile("sidepanel.html");
  const css = readPanelFile("sidepanel.css");

  assert.match(html, /icons\/tokenmind-logo\.svg/);
  assert.match(css, /--color-bg:\s*#fff(?:fff)?/i);
  assert.match(css, /--color-accent:/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient/);
  assert.doesNotMatch(css, /#080808|#e9bc58/i);
  assert.match(css, /@media\s*\(max-width:/);
  assert.match(css, /overflow-wrap/);
});
