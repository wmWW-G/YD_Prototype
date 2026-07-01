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

test("formatWhatsAppChatRecords keeps WhatsApp top-to-bottom records in oldest-first transcript", () => {
  const analyzer = loadAnalyzer();

  const transcript = analyzer.formatWhatsAppChatRecords([
    {
      role: "buyer",
      sender: "+1 555 0100",
      time: "11:46 PM, 11/25/2025",
      original: "Can you share price?"
    },
    {
      role: "seller",
      sender: "Garden",
      time: "11:48 PM, 11/25/2025",
      original: "Yes, I will check it."
    }
  ], {
    sourceTitle: "WhatsApp Business",
    sourceUrl: "https://web.whatsapp.com/",
    loadRounds: 2,
    reachedStableEnd: true
  });

  assert.match(transcript, /【WhatsApp聊天记录】/);
  assert.match(transcript, /共读取 2 条消息/);
  assert.ok(
    transcript.indexOf("[11:46 PM, 11/25/2025] 客户 +1 555 0100") < transcript.indexOf("[11:48 PM, 11/25/2025] 我方"),
    "WhatsApp transcript should keep DOM top-to-bottom order as oldest to newest"
  );
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

test("content script wires WhatsApp capture into the same page-context flow", () => {
  const sourcePath = path.join(__dirname, "content-script.js");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /web\.whatsapp\.com/);
  assert.match(source, /conversation-panel-messages/);
  assert.match(source, /captureWhatsAppChat/);
  assert.match(source, /formatWhatsAppChatRecords/);
});

test("content script clicks the WhatsApp older-messages phone button before relying on scroll", () => {
  const sourcePath = path.join(__dirname, "content-script.js");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /clickWhatsAppOlderMessagesButton/);
  assert.match(source, /older messages from your phone/);
  assert.match(source, /WHATSAPP_PHONE_HISTORY_WAIT_MS/);
});

test("content script keeps long captured transcripts inside the side panel", () => {
  const sourcePath = path.join(__dirname, "content-script.js");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /\.yd-chat\s*{[^}]*overflow-x:\s*hidden/s);
  assert.match(source, /\.yd-message\s*{[^}]*min-width:\s*0/s);
  assert.match(source, /\.yd-bubble\s*{[^}]*max-width:\s*100%[^}]*overflow-wrap:\s*anywhere/s);
  assert.match(source, /\.yd-markdown\s*{[^}]*min-width:\s*0[^}]*overflow-wrap:\s*anywhere/s);
});

test("content script shows a manual stop button in the capture loading hint row", () => {
  const sourcePath = path.join(__dirname, "content-script.js");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /data-yd-stop-capture/);
  assert.match(source, /停止回溯/);
  assert.match(source, /\.yd-capture-control-row\s*{[^}]*grid-template-columns:\s*1fr auto/s);
  assert.match(source, /\.yd-stop-capture\s*{[^}]*min-width:\s*84px/s);
});

test("content script threads manual stop control through chat history capture", () => {
  const sourcePath = path.join(__dirname, "content-script.js");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /function createCaptureControl/);
  assert.match(source, /function isCaptureStopped/);
  assert.match(source, /manual-stop/);
  assert.match(source, /loadAlibabaChatHistory\(onProgress,\s*captureControl/);
  assert.match(source, /loadWhatsAppChatHistory\(onProgress,\s*captureControl/);
  assert.match(source, /getPageContextAsync\([^)]*captureControl/);
  assert.match(source, /showCaptureLoadingCard\(root,\s*getActiveCapturePlatformName\(\),\s*captureControl\)/);
});

test("content script can recover captured inquiry payload from the start card when transient state is missing", () => {
  const sourcePath = path.join(__dirname, "content-script.js");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /function getPendingAnalysisPayload/);
  assert.match(source, /__yingdanPendingPayload/);
  assert.match(source, /pendingAnalysisByRoot\.get\(root\)/);
  assert.match(source, /startPendingAnalysis\(root,\s*actionTarget\)/);
  assert.match(source, /card\.__yingdanPendingPayload\s*=\s*payload/);
  assert.match(source, /startButton\.__yingdanPendingPayload\s*=\s*payload/);
  assert.match(source, /startButton\.addEventListener\("click"/);
  assert.match(source, /event\.stopPropagation\(\)/);
});

test("content script waits for the user to fetch chat records before history capture starts", () => {
  const sourcePath = path.join(__dirname, "content-script.js");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /function showCaptureReadyCard/);
  assert.match(source, /data-yd-fetch-chat/);
  assert.match(source, /获取聊天记录/);
  assert.match(source, /function startChatCapture/);
  assert.match(source, /startChatCapture\(root,\s*payload/);
  assert.match(source, /showCaptureReadyCard\(root,\s*messagePayload/);
});

test("content script lets users refetch chat after a wrong capture result", () => {
  const sourcePath = path.join(__dirname, "content-script.js");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /data-yd-refetch-chat/);
  assert.match(source, /重新获取/);
  assert.match(source, /captureRequest/);
  assert.match(source, /const refetchPayload = payload\.captureRequest/);
  assert.match(source, /refetchButton\.__yingdanCapturePayload\s*=\s*refetchPayload/);
  assert.match(source, /startChatCapture\(root,\s*refetchPayload\)/);
  assert.match(source, /data-yd-start-analysis\][^"]*data-yd-refetch-chat/s);
});

test("content script saves analyzed chats and lets users view history named by customer", () => {
  const sourcePath = path.join(__dirname, "content-script.js");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /YD_ANALYSIS_HISTORY_KEY/);
  assert.match(source, /function extractCustomerNameFromAnalysisPayload/);
  assert.match(source, /function saveAnalysisHistoryRecord/);
  assert.match(source, /function showAnalysisHistoryList/);
  assert.match(source, /function showAnalysisHistoryDetail/);
  assert.match(source, /data-yd-open-history/);
  assert.match(source, /closest\("\[data-yd-start-analysis\][^"]*data-yd-open-history/s);
  assert.match(source, /data-yd-history-item/);
  assert.match(source, /customerName/);
  assert.match(source, /saveAnalysisHistoryRecord\(\{\s*payload,\s*result/s);
});

test("content script lets users return from history to the current conversation", () => {
  const sourcePath = path.join(__dirname, "content-script.js");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /function saveCurrentConversationSnapshot/);
  assert.match(source, /function restoreCurrentConversation/);
  assert.match(source, /data-yd-back-current/);
  assert.match(source, /回到当前对话/);
  assert.match(source, /showAnalysisHistoryList\(root,\s*\{\s*preserveCurrent:\s*false\s*\}\)/);
});

test("content script renders compact history cards", () => {
  const sourcePath = path.join(__dirname, "content-script.js");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /MAX_HISTORY_PREVIEW_LENGTH\s*=\s*160/);
  assert.match(source, /\.yd-history-list\s*{[^}]*gap:\s*6px/s);
  assert.match(source, /\.yd-history-item\s*{[^}]*gap:\s*3px[^}]*padding:\s*7px 9px/s);
  assert.match(source, /\.yd-history-preview\s*{[^}]*-webkit-line-clamp:\s*2/s);
});

test("content script keeps return-to-current action reachable at the bottom of history views", () => {
  const sourcePath = path.join(__dirname, "content-script.js");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /function appendHistoryBottomActions/);
  assert.match(source, /\.yd-history-sticky-actions\s*{[^}]*position:\s*sticky[^}]*bottom:\s*0/s);
  assert.match(source, /appendHistoryBottomActions\(root,\s*\{\s*showHistoryBack:\s*false\s*\}\)/);
  assert.match(source, /appendHistoryBottomActions\(root,\s*\{\s*showHistoryBack:\s*true\s*\}\)/);
});

test("content script injects Yingdan inquiry and customer research buttons into Alibaba chat toolbar", () => {
  const sourcePath = path.join(__dirname, "content-script.js");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /ALIBABA_SEND_HEADER_MENU_SELECTOR\s*=\s*"\.send-header-menu"/);
  assert.match(source, /function injectAlibabaToolbarActions/);
  assert.match(source, /data-yd-alibaba-toolbar/);
  assert.match(source, /data-yd-inline-action="inquiry-analysis"/);
  assert.match(source, /data-yd-inline-action="customer-research"/);
  assert.match(source, /询盘分析/);
  assert.match(source, /客户背调/);
});

test("content script routes Alibaba inline actions to inquiry analysis and customer research placeholder", () => {
  const sourcePath = path.join(__dirname, "content-script.js");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /function handleInlineToolbarAction/);
  assert.match(source, /openAnalyzer\(\{\s*pageTitle:\s*document\.title/s);
  assert.match(source, /function openCustomerResearch/);
  assert.match(source, /客户背调功能正在接入/);
  assert.match(source, /MutationObserver/);
  assert.match(source, /injectAlibabaToolbarActions\(\)/);
});
