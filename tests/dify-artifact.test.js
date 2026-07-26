const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const {
  isArtifactLanguage,
  parseMermaidFlowchart,
  parseMermaidTimeline,
  renderArtifactCodeBlock,
  renderEchartsArtifact,
  renderHtmlArtifact,
  renderMermaidArtifact,
  renderSvgArtifact,
  renderUiArtifact
} = require("../src/dify-artifact");

test("recognizes only explicit YD Artifact fenced block languages", () => {
  assert.equal(isArtifactLanguage("mermaid"), true);
  assert.equal(isArtifactLanguage("ECharts"), true);
  assert.equal(isArtifactLanguage("html-artifact"), true);
  assert.equal(isArtifactLanguage("html"), false);
  assert.equal(isArtifactLanguage("javascript"), false);
});

test("keeps the replacement Chatflow prompt aligned with the interactive renderer contract", () => {
  const prompt = fs.readFileSync(
    path.join(__dirname, "../dify-chatflows/技能Skill-YD-Artifact/prompt.md"),
    "utf8"
  );

  assert.match(prompt, /必须使用 `html-artifact`/);
  assert.match(prompt, /完整、自包含、可直接运行的 HTML/);
  assert.match(prompt, /至少实现一个与用户任务有关的真实交互/);
  assert.match(prompt, /禁止外部 CDN、外部脚本、外部样式/);
  assert.doesNotMatch(prompt, /不能生成 HTML/);
});

test("keeps the KASS Agent workflow aligned with prototype CRUD and Artifact contracts", () => {
  const workflow = fs.readFileSync(
    path.join(__dirname, "../dify-chatflows/客户Kass-客户管理-KASS-Agent/workflow.yml"),
    "utf8"
  );

  assert.match(workflow, /KASS 原型 CRM Plugin/);
  assert.match(workflow, /【回答与 Artifact】/);
  assert.match(workflow, /provider_name: garden\/kass-prototype-crm\/kass-prototype-crm/);
  assert.match(workflow, /tool_name: get_context/);
  assert.match(workflow, /tool_name: update_customer/);
  assert.match(workflow, /tool_name: create_followup/);
  assert.match(workflow, /tool_name: update_followup/);
  assert.match(workflow, /tool_name: delete_followup/);
  assert.match(workflow, /不输出 kass-crm-action/);
  assert.match(workflow, /通用 HTTP Tool/);
  assert.match(workflow, /真实赢单 API/);
  assert.match(workflow, /current_customer_id/);
  assert.match(workflow, /结构化静态 Artifact/);
  assert.match(workflow, /代码围栏语言必须精确写成 ui，绝对不能写成 json/);
  assert.match(workflow, /"component":"metrics"/);
  assert.match(workflow, /结构化组件只能使用 ui，不能使用 json/);
  assert.match(workflow, /【待办闭环】/);
  assert.match(workflow, /默认闭环规则/);
  assert.match(workflow, /agent-next-/);
  assert.match(workflow, /这些不算待办/);
  assert.match(workflow, /完整最终 tasks 数组/);
  assert.match(workflow, /一轮最多输出一个受控 Artifact/);
  assert.match(workflow, /不得编造数值/);
  assert.doesNotMatch(workflow, /provider_name: garden\/yingdan-kass/);
});

test("morphs KASS streaming Markdown while keeping the safe Artifact adapter", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/app.js"), "utf8");
  const answerRendererStart = source.indexOf("function renderKassAgentAnswerHtml");
  const answerRendererEnd = source.indexOf("\n/**", answerRendererStart + 1);
  const answerRendererSource = source.slice(answerRendererStart, answerRendererEnd);
  const rendererStart = source.indexOf("function renderKassAgentMessageContent");
  const rendererEnd = source.indexOf("\n/**", rendererStart + 1);
  const rendererSource = source.slice(rendererStart, rendererEnd);
  const senderStart = source.indexOf("function sendKassAgentDraft");
  const senderEnd = source.indexOf("\n/**", senderStart + 1);
  const senderSource = source.slice(senderStart, senderEnd);

  assert.ok(rendererStart >= 0 && rendererEnd > rendererStart, "应找到 KASS 消息渲染函数");
  assert.match(rendererSource, /message\?\.role === "user"/);
  assert.match(answerRendererSource, /window\.YD_ARTIFACT\?\.renderArtifactCodeBlock/);
  assert.match(answerRendererSource, /renderMarkdown\(/);
  assert.match(senderSource, /feature_id: KASS_DIFY_FEATURE_ID/);
  assert.match(senderSource, /current_customer_context: buildKassAgentCustomerContext\(customer\)/);
  assert.match(senderSource, /createDifySseEventParser\(applyStreamEvent\)/);
  assert.match(senderSource, /scheduleKassAgentStreamRender\(pendingAnswerId\)/);
  assert.match(senderSource, /applyKassPrototypeActionFromMessage/);
  assert.match(senderSource, /syncKassPrototypeCustomer/);
  assert.match(senderSource, /getCompletedKassMutationToolName\(event\)/);
  assert.match(senderSource, /mutationSyncPromise/);
  assert.match(senderSource, /等待 Agent 完成后刷新右侧资料/);
  assert.doesNotMatch(senderSource, /component: "step-flow"/);
  assert.equal(
    (senderSource.match(/renderKassAgentStream\(\)/g) || []).length,
    1,
    "一次流式调用只允许在发送前完整渲染 KASS 页面"
  );
  assert.match(senderSource, /finalizeKassAgentStreamDom\(pendingAnswerId\)/);
  assert.match(source, /function patchKassAgentStreamMessageDom\(messageId\)/);
  assert.match(source, /function scheduleKassAgentStreamRender\(messageId\)/);
  assert.match(source, /function finalizeKassAgentStreamDom\(messageId\)/);
  assert.match(source, /data-kass-message-id=/);
  assert.match(source, /data-kass-process-panel=/);
  assert.match(source, /data-kass-answer-shell=/);
  assert.match(source, /function morphKassStreamHtml\(container, nextHtml\)/);
  assert.doesNotMatch(source, /body\.innerHTML = renderKassAgentMessageContent\(message\)/);
  assert.match(source, /window\.requestAnimationFrame/);
  assert.match(source, /function isKassTaskCompletedStatus/);
  assert.match(source, /isKassTaskCompletedStatus\(task\.status\)/);
  assert.match(source, /"已完成"/);
  assert.match(source, /taskId\.startsWith\("agent-next-"\)/);
  assert.match(source, /AI 建议/);
  assert.match(source, /function buildKassSyncMotionPlan/);
  assert.match(source, /function animateKassSyncFlight/);
  assert.match(source, /scheduleKassSyncMotion\(motionPlan, pendingAnswerId\)/);
  assert.match(source, /data-kass-task-row=/);
  assert.match(source, /data-kass-followup-id=/);
  assert.match(source, /prefers-reduced-motion: reduce/);
});

test("defers KASS customer-pane rendering until the Agent run is complete", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/app.js"), "utf8");
  const senderStart = source.indexOf("async function sendKassAgentDraft");
  const senderEnd = source.indexOf("\n/**", senderStart + 1);
  const senderSource = source.slice(senderStart, senderEnd);
  const mutationStart = senderSource.indexOf("mutationSyncPromise = mutationSyncPromise.then");
  const mutationEnd = senderSource.indexOf("scheduleKassAgentStreamRender", mutationStart);
  const mutationSource = senderSource.slice(mutationStart, mutationEnd);

  assert.match(mutationSource, /render: false/);
  assert.doesNotMatch(mutationSource, /motionSourceMessageId/);
  assert.match(senderSource, /renderKassContextPreservingConversation\(\)/);
  assert.match(senderSource, /scheduleKassSyncMotion\(motionPlan, pendingAnswerId\)/);
});

test("keeps the KASS prototype plugin isolated from real CRM credentials", () => {
  const pluginRoot = path.join(__dirname, "../dify-plugins/kass-prototype-crm");
  const manifest = fs.readFileSync(path.join(pluginRoot, "manifest.yaml"), "utf8");
  const provider = fs.readFileSync(
    path.join(pluginRoot, "provider/kass-prototype-crm.yaml"),
    "utf8"
  );
  const client = fs.readFileSync(path.join(pluginRoot, "lib/client.py"), "utf8");

  assert.match(manifest, /name: kass-prototype-crm/);
  assert.match(provider, /tools\/get_context\.yaml/);
  assert.match(provider, /tools\/update_customer\.yaml/);
  assert.match(provider, /tools\/create_followup\.yaml/);
  assert.match(provider, /tools\/update_followup\.yaml/);
  assert.match(provider, /tools\/delete_followup\.yaml/);
  assert.match(client, /yd-prototype-dify-proxy\.vercel\.app\/api\/kass-crm/);
  assert.doesNotMatch(provider, /credentials_for_provider/);
  assert.doesNotMatch(client, /access_token|api\.top-yd\.com|Authorization/);
});

test("parses and renders the published Chatflow Mermaid flowchart contract", () => {
  const source = [
    "flowchart LR",
    "A[\"用户输入\"] --> B[\"分析处理\"]",
    "B --> C[\"输出结果\"]"
  ].join("\n");
  const graph = parseMermaidFlowchart(source);
  const html = renderMermaidArtifact(source);

  assert.equal(graph.direction, "LR");
  assert.equal(graph.nodes.length, 3);
  assert.equal(graph.edges.length, 2);
  assert.equal(graph.nodes[0].label, "用户输入");
  assert.match(html, /class="yd-artifact-diagram"/);
  assert.match(html, /用户输入/);
  assert.match(html, /输出结果/);
  assert.match(html, /左右滑动查看完整流程/);
  assert.doesNotMatch(html, /<script/i);
});

test("renders Mermaid timeline as a responsive semantic timeline", () => {
  const source = [
    "timeline",
    "title 客户成交阶段",
    "第 1 周 : 建立联系 : 确认采购角色",
    "第 2 周 : 方案沟通 : 对齐预算和交期"
  ].join("\n");
  const timeline = parseMermaidTimeline(source);
  const html = renderMermaidArtifact(source);

  assert.equal(timeline.items.length, 2);
  assert.equal(timeline.title, "客户成交阶段");
  assert.match(html, /yd-artifact-timeline/);
  assert.match(html, /确认采购角色/);
});

test("renders the published Chatflow mindmap option as a safe relationship graph", () => {
  const source = [
    "mindmap",
    "  root((成交准备))",
    "    市场信息",
    "      国家数据",
    "    客户信息",
    "      决策角色"
  ].join("\n");
  const html = renderMermaidArtifact(source);

  assert.match(html, /结构关系/);
  assert.match(html, /成交准备/);
  assert.match(html, /决策角色/);
  assert.doesNotMatch(html, /<script/i);
});

test("renders ECharts bar and line JSON without executing arbitrary JavaScript", () => {
  const source = JSON.stringify({
    title: { text: "季度询盘" },
    xAxis: { type: "category", data: ["Q1", "Q2", "Q3"] },
    yAxis: { type: "value" },
    series: [
      { name: "询盘", type: "bar", data: [12, 20, 15] },
      { name: "成交", type: "line", data: [3, 7, 6] }
    ]
  });
  const html = renderEchartsArtifact(source);

  assert.match(html, /季度询盘/);
  assert.match(html, /class="yd-artifact-chart"/);
  assert.match(html, /class="chart-bars"/);
  assert.match(html, /class="chart-lines"/);
  assert.doesNotMatch(html, /eval\(|new Function|<script/i);
});

test("renders the published Chatflow pie chart option as a safe donut chart", () => {
  const source = JSON.stringify({
    title: { text: "询盘来源占比" },
    series: [{
      name: "询盘来源",
      type: "pie",
      radius: ["45%", "70%"],
      data: [
        { name: "阿里国际站", value: 62 },
        { name: "官网", value: 24 },
        { name: "展会", value: 14 }
      ]
    }]
  });
  const html = renderEchartsArtifact(source);

  assert.match(html, /询盘来源占比/);
  assert.match(html, /chart-total/);
  assert.match(html, /阿里国际站/);
  assert.doesNotMatch(html, /<script/i);
});

test("renders stable ui JSON components and escapes model-provided labels", () => {
  const html = renderUiArtifact(JSON.stringify({
    component: "step-flow",
    title: "付款流程",
    steps: [
      { title: "注册账号", description: "手机号 / 邮箱" },
      { title: "<img src=x onerror=alert(1)>", description: "身份验证" },
      { title: "完成付款", description: "支付结果" }
    ]
  }));

  assert.match(html, /yd-artifact-step-flow/);
  assert.match(html, /付款流程/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img\s/i);
});

test("keeps SVG scriptless while allowing interactive HTML only inside an opaque sandbox", () => {
  const svgHtml = renderSvgArtifact('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300"><rect width="600" height="300" fill="#f5f2ea"/><text x="40" y="80">结构图</text></svg>');
  const artifactHtml = renderHtmlArtifact('<main><h1>交互内容</h1><button id="next">下一步</button><output id="result">第 1 步</output><script>document.querySelector("#next").addEventListener("click", function () { document.querySelector("#result").textContent = "第 2 步"; });</script></main>');

  assert.match(svgHtml, /sandbox=""/);
  assert.match(svgHtml, /Content-Security-Policy/);
  assert.match(svgHtml, /script-src &#039;none&#039;/);
  assert.match(svgHtml, /结构图/);
  assert.match(artifactHtml, /sandbox="allow-scripts"/);
  assert.doesNotMatch(artifactHtml, /allow-same-origin|allow-forms|allow-popups|allow-top-navigation/);
  assert.match(artifactHtml, /script-src &#039;unsafe-inline&#039;/);
  assert.match(artifactHtml, /connect-src &#039;none&#039;/);
  assert.match(artifactHtml, /worker-src &#039;none&#039;/);
  assert.match(artifactHtml, /data-yd-artifact-frame="yd-artifact-frame-/);
  assert.match(artifactHtml, /yd-artifact:resize/);
  assert.doesNotMatch(artifactHtml, /<script>/i);
});

test("rejects interactive HTML that tries to load resources or navigate away", () => {
  const remoteResourceHtml = renderArtifactCodeBlock({
    language: "html-artifact",
    code: '<main><img src="https://example.com/customer.png" alt="客户资料"></main>',
    isComplete: true
  });
  const navigationHtml = renderArtifactCodeBlock({
    language: "html-artifact",
    code: '<main><button>继续</button><script>window.location.href = "https://example.com";</script></main>',
    isComplete: true
  });

  assert.match(remoteResourceHtml, /不允许加载外部资源或提交到其它地址/);
  assert.match(navigationHtml, /不允许的联网、跳转、跨页面或动态执行能力/);
  assert.doesNotMatch(remoteResourceHtml, /<iframe/i);
  assert.doesNotMatch(navigationHtml, /<iframe/i);
});

test("rejects dangerous SVG content and keeps it escaped inside a visible fallback", () => {
  const html = renderArtifactCodeBlock({
    language: "svg",
    code: '<svg><script>alert(1)</script><foreignObject>bad</foreignObject></svg>',
    isComplete: true
  });

  assert.match(html, /可视化未完成/);
  assert.match(html, /不允许的可执行或嵌入元素/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/i);
});

test("allows the SVG namespace declaration but still rejects real remote references", () => {
  const html = renderArtifactCodeBlock({
    language: "svg",
    code: '<svg xmlns="http://www.w3.org/2000/svg"><use href="https://example.com/icons.svg#mark" /></svg>',
    isComplete: true
  });

  assert.match(html, /不允许加载外部图片或远程资源/);
  assert.doesNotMatch(html, /<iframe/i);
});

test("shows a stable skeleton while a streamed visual fence is incomplete", () => {
  const html = renderArtifactCodeBlock({
    language: "mermaid",
    code: "flowchart LR\nA -->",
    isComplete: false
  });

  assert.match(html, /yd-artifact-loading/);
  assert.match(html, /正在绘制流程图/);
  assert.doesNotMatch(html, /可视化未完成/);
});

test("integrates special fences into the existing safe Markdown renderer only when requested", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/app.js"), "utf8");
  const rendererStart = source.indexOf("function escapeHtml");
  const rendererEnd = source.indexOf("\n/**\n * 移除模型思考标签", rendererStart);
  const markdownInput = [
    "先看这条流程：",
    "",
    "```mermaid",
    "flowchart LR",
    "A[\"提问\"] --> B[\"回答\"]",
    "```",
    "",
    "然后继续解释。"
  ].join("\n");
  const sandbox = {
    console,
    markdownInput,
    renderedMarkdown: "",
    artifactRenderer: renderArtifactCodeBlock
  };

  assert.ok(rendererStart >= 0 && rendererEnd > rendererStart, "应找到 Markdown 渲染函数");
  vm.runInNewContext(
    `${source.slice(rendererStart, rendererEnd)}\nrenderedMarkdown = renderMarkdown(markdownInput, { renderCodeBlock: artifactRenderer });`,
    sandbox
  );

  assert.match(sandbox.renderedMarkdown, /先看这条流程/);
  assert.match(sandbox.renderedMarkdown, /yd-artifact-diagram/);
  assert.match(sandbox.renderedMarkdown, /然后继续解释/);
});
