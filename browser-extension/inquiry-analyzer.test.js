const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

/**
 * 在一个干净的 VM 环境里加载浏览器插件的本地分析 helper。
 *
 * 为什么不用 require：
 * - `inquiry-analyzer.js` 是浏览器 IIFE，不是 CommonJS 模块。
 * - 用 VM 可以模拟浏览器里的 `globalThis`，同时不需要引入额外依赖。
 *
 * @returns {Record<string, Function>} 插件暴露出来的 YingdanInquiryAnalyzer。
 * @throws {Error} 文件读取失败或脚本执行失败时抛出。
 */
function loadAnalyzer() {
  const sourcePath = path.join(__dirname, "inquiry-analyzer.js");
  const source = fs.readFileSync(sourcePath, "utf8");
  const sandbox = {};

  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: sourcePath });

  return sandbox.YingdanInquiryAnalyzer;
}

test("formatAlibabaChatRecords reverses Alibaba newest-first DOM records into readable oldest-first transcript", () => {
  const analyzer = loadAnalyzer();

  const transcript = analyzer.formatAlibabaChatRecords([
    {
      role: "buyer",
      sender: "Folaranmi Fashina",
      time: "2026-06-24 18:59",
      original: "yes",
      translated: "是的"
    },
    {
      role: "seller",
      sender: "我方",
      time: "2026-06-24 18:58",
      original: "Please confirm the box design.",
      translated: ""
    }
  ], {
    sourceTitle: "Inquiry from TM",
    sourceUrl: "https://message.alibaba.com/message/maDetail.htm",
    loadRounds: 3,
    reachedStableEnd: true
  });

  assert.match(transcript, /共读取 2 条消息/);
  assert.match(transcript, /回溯轮次：3/);
  assert.ok(
    transcript.indexOf("[2026-06-24 18:58] 我方") < transcript.indexOf("[2026-06-24 18:59] 客户 Folaranmi Fashina"),
    "transcript should present older seller message before newer buyer message"
  );
  assert.match(transcript, /翻译：是的/);
});

test("shouldContinueAlibabaHistoryLoad keeps loading while records grow and stops after stable rounds", () => {
  const analyzer = loadAnalyzer();

  assert.equal(analyzer.shouldContinueAlibabaHistoryLoad({
    previousCount: 20,
    currentCount: 38,
    stableRounds: 0,
    round: 2,
    maxRounds: 40,
    stableRoundLimit: 2,
    maxMessages: 800
  }).shouldContinue, true);

  assert.deepEqual({ ...analyzer.shouldContinueAlibabaHistoryLoad({
    previousCount: 528,
    currentCount: 528,
    stableRounds: 1,
    round: 20,
    maxRounds: 40,
    stableRoundLimit: 2,
    maxMessages: 800
  }) }, {
    nextStableRounds: 2,
    reason: "stable",
    shouldContinue: false
  });
});
