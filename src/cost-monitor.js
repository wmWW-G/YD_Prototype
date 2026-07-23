/* global window */

/**
 * AI 成本监控页的纯数据与计算模块。
 *
 * 为什么单独放在这个文件：
 * - 页面需要同时支持“实测记录回放”和“真实 Chatflow SSE”，两种模式必须使用同一套计费规则。
 * - 把价格、模型映射和去重逻辑从页面渲染代码里拆开，更容易写测试，也能避免界面改版时误改结算公式。
 * - 本文件不保存 API Key，也不发网络请求；真实请求仍由现有 Cloudflare/Vercel 代理负责。
 */
(function exposeCostMonitor(globalObject) {
  /**
   * 后台可维护的成本单价字段。
   *
   * amount 是“当前合同单价”，currency 是供应商结算币种，unit 决定数量如何换算。
   * 这里的默认值只用于原型演示，正式上线必须由管理员按真实账单修改。
   */
  const PRICE_DEFINITIONS = Object.freeze([
    Object.freeze({ id: "gemini-input", label: "Gemini 3.5 Flash 输入", amount: 1.5, currency: "USD", unit: "million_tokens", unitLabel: "每 100 万 tokens" }),
    Object.freeze({ id: "gemini-output", label: "Gemini 3.5 Flash 输出", amount: 9, currency: "USD", unit: "million_tokens", unitLabel: "每 100 万 tokens" }),
    Object.freeze({ id: "deepseek-flash-input", label: "DeepSeek V4 Flash 输入", amount: 1, currency: "RMB", unit: "million_tokens", unitLabel: "每 100 万 tokens" }),
    Object.freeze({ id: "deepseek-flash-output", label: "DeepSeek V4 Flash 输出", amount: 2, currency: "RMB", unit: "million_tokens", unitLabel: "每 100 万 tokens" }),
    Object.freeze({ id: "deepseek-pro-input", label: "DeepSeek V4 Pro 输入", amount: 12, currency: "RMB", unit: "million_tokens", unitLabel: "每 100 万 tokens" }),
    Object.freeze({ id: "deepseek-pro-output", label: "DeepSeek V4 Pro 输出", amount: 24, currency: "RMB", unit: "million_tokens", unitLabel: "每 100 万 tokens" }),
    Object.freeze({ id: "embedding", label: "OpenAI text-embedding-3-large", amount: 0, currency: "USD", unit: "million_tokens", unitLabel: "每 100 万 tokens" }),
    Object.freeze({ id: "tavily", label: "Tavily credit", amount: 0.008, currency: "USD", unit: "credit", unitLabel: "每 1 credit" }),
    Object.freeze({ id: "document", label: "文档解析", amount: 0.03, currency: "RMB", unit: "document", unitLabel: "每 1 份文档" }),
    Object.freeze({ id: "knowledge-fixed", label: "知识库入库与存储摊销", amount: 0.05, currency: "RMB", unit: "run", unitLabel: "每 1 次知识库任务" }),
    Object.freeze({ id: "platform", label: "平台、网关与日志摊销", amount: 0.1, currency: "RMB", unit: "run", unitLabel: "每 1 次任务" })
  ]);

  /**
   * 只有这里列出的“实际模型名”才允许自动套用单价。
   *
   * 为什么必须精确匹配：
   * - 页面按钮写着 DeepSeek Pro，并不代表 Dify 最终真的调用了 Pro。
   * - 如果收到未知模型名，系统必须显示“待确认模型”，不能用字符串猜测后强行计费。
   */
  const MODEL_PRICE_KEYS = Object.freeze({
    "gemini-3.5-flash": Object.freeze({ input: "gemini-input", output: "gemini-output" }),
    "deepseek-v4-flash": Object.freeze({ input: "deepseek-flash-input", output: "deepseek-flash-output" }),
    "deepseek-v4-pro": Object.freeze({ input: "deepseek-pro-input", output: "deepseek-pro-output" })
  });

  /**
   * 已真实调用并核对过的回放场景。
   *
   * 注意：回放只复现真实测试中记录到的事件和用量，不会把用户本次输入发送到 Dify。
   * 页面会显著展示“实测回放”标识，防止把它误认为本次实时账单。
   */
  const REPLAY_SCENARIOS = Object.freeze({
    "mixed-image": Object.freeze({
      id: "mixed-image",
      label: "图片识别 + DeepSeek Pro",
      source: "no-kb",
      modelKey: "deepseek-v4-pro",
      prompt: "请识别这张产品图片，并给我一份简短的客户回复建议。",
      events: Object.freeze([
        Object.freeze({ delay: 180, event: { type: "process", step: { id: "workflow-start", kind: "node", label: "请求已进入无知识库总控", detail: "正在判断是否包含图片或文档", status: "running" } } }),
        Object.freeze({ delay: 650, event: { type: "process", step: { id: "vision-start", kind: "node", label: "正在执行图片识别", detail: "视觉模型：Gemini 3.5 Flash", status: "running" } } }),
        Object.freeze({ delay: 1250, event: { type: "cost_update", item: { id: "vision-gemini", category: "llm", role: "vision", label: "图片识别模型", nodeLabel: "图片与文档识别", provider: "Google", model: "gemini-3.5-flash", promptTokens: 1205, completionTokens: 283, totalTokens: 1488, reportedAmount: 0.0043545, reportedCurrency: "USD", evidence: "exact", pricingStatus: "exact_usage" } } }),
        Object.freeze({ delay: 1550, event: { type: "process", step: { id: "vision-start", kind: "node", label: "图片识别已完成", detail: "已提取产品外观与可见文字", status: "done" } } }),
        Object.freeze({ delay: 2050, event: { type: "process", step: { id: "agent-start", kind: "node", label: "正在执行成交顾问 Agent", detail: "已把图片识别结果加入当前问题", status: "running" } } }),
        Object.freeze({ delay: 2850, event: { type: "cost_update", item: { id: "agent-deepseek-pro", category: "llm", role: "agent", label: "Agent 模型", nodeLabel: "DeepSeek Agent", provider: "DeepSeek", model: "deepseek-v4-pro", promptTokens: 3718, completionTokens: 118, totalTokens: 3836, reportedAmount: 0.047448, reportedCurrency: "RMB", evidence: "exact", pricingStatus: "exact_usage" } } }),
        Object.freeze({ delay: 3250, event: { type: "answer_delta", delta: "从图片看，这是一款适合礼赠与零售渠道的产品。" } }),
        Object.freeze({ delay: 3650, event: { type: "answer_delta", delta: "\n\n建议回复客户时先确认数量、定制位置和目标交期，再给出分档报价。" } }),
        Object.freeze({ delay: 4050, event: { type: "cost_checksum", usage: { promptTokens: 4923, completionTokens: 401, totalTokens: 5324 }, note: "只核对 tokens，不采用混合币种总价" } }),
        Object.freeze({ delay: 4350, event: { type: "done", result: { conversation_id: "replay-mixed-image", workflow_run_id: "verified-replay-mixed-image" } } })
      ])
    }),
    "network-research": Object.freeze({
      id: "network-research",
      label: "联网研究 + DeepSeek Pro",
      source: "no-kb",
      modelKey: "deepseek-v4-pro",
      prompt: "查一下德国储能市场的近期买家信号，并给我三条结论。",
      events: Object.freeze([
        Object.freeze({ delay: 180, event: { type: "process", step: { id: "workflow-start", kind: "node", label: "请求已进入无知识库总控", detail: "正在选择联网研究 Skill", status: "running" } } }),
        Object.freeze({ delay: 720, event: { type: "process", step: { id: "tavily-search", kind: "tool", label: "正在调用 Tavily Search", detail: "德国储能市场近期买家信号", status: "running" } } }),
        Object.freeze({ delay: 1350, event: { type: "cost_update", item: { id: "tavily-search", category: "tool", role: "tool", label: "网页搜索", nodeLabel: "Tavily Search", provider: "Tavily", service: "tavily_search", quantity: 1, unit: "credit", evidence: "exact", pricingStatus: "unit_usage" } } }),
        Object.freeze({ delay: 1700, event: { type: "process", step: { id: "tavily-search", kind: "tool", label: "Tavily Search 调用完成", detail: "获得候选网页", status: "done" } } }),
        Object.freeze({ delay: 2150, event: { type: "process", step: { id: "tavily-extract", kind: "tool", label: "正在调用 Tavily Extract", detail: "提取 1 个成功网址", status: "running" } } }),
        Object.freeze({ delay: 2700, event: { type: "cost_update", item: { id: "tavily-extract", category: "tool", role: "tool", label: "网页提取", nodeLabel: "Tavily Extract", provider: "Tavily", service: "tavily_extract", quantity: 0.2, unit: "credit", evidence: "allocated", pricingStatus: "unit_usage" } } }),
        Object.freeze({ delay: 3200, event: { type: "cost_update", item: { id: "agent-deepseek-pro", category: "llm", role: "agent", label: "Agent 模型", nodeLabel: "DeepSeek Agent", provider: "DeepSeek", model: "deepseek-v4-pro", promptTokens: 23078, completionTokens: 339, totalTokens: 23417, reportedAmount: 0.285072, reportedCurrency: "RMB", evidence: "exact", pricingStatus: "exact_usage" } } }),
        Object.freeze({ delay: 3500, event: { type: "answer_delta", delta: "近期信号主要来自工商业储能扩容、能源价格波动和渠道商库存调整。" } }),
        Object.freeze({ delay: 3950, event: { type: "answer_delta", delta: "\n\n建议优先开发有安装能力的系统集成商，并按项目规模准备不同交付方案。" } }),
        Object.freeze({ delay: 4350, event: { type: "cost_checksum", usage: { promptTokens: 23078, completionTokens: 339, totalTokens: 23417 }, note: "Agent 节点汇总，不再重复累加内部轮次" } }),
        Object.freeze({ delay: 4650, event: { type: "done", result: { conversation_id: "replay-network-research", workflow_run_id: "verified-replay-network-research" } } })
      ])
    }),
    "kb-model-mismatch": Object.freeze({
      id: "kb-model-mismatch",
      label: "知识库 + 模型不一致校验",
      source: "kb",
      modelKey: "deepseek-v4-pro",
      prompt: "客户说价格太高，应该怎样回应？",
      events: Object.freeze([
        Object.freeze({ delay: 180, event: { type: "process", step: { id: "workflow-start", kind: "node", label: "请求已进入全技能总控", detail: "用户选择 DeepSeek Pro", status: "running" } } }),
        Object.freeze({ delay: 760, event: { type: "process", step: { id: "knowledge", kind: "node", label: "正在检索外贸成交知识库", detail: "Hybrid Retrieval · Top K 5", status: "running" } } }),
        Object.freeze({ delay: 1350, event: { type: "cost_update", item: { id: "query-embedding", category: "embedding", role: "knowledge", label: "知识库查询向量", nodeLabel: "text-embedding-3-large", provider: "OpenAI", service: "text-embedding-3-large", quantity: 30, unit: "token", evidence: "estimated", pricingStatus: "unpriced" } } }),
        Object.freeze({ delay: 1700, event: { type: "process", step: { id: "knowledge", kind: "node", label: "知识库检索已完成", detail: "召回 5 条候选内容", status: "done" } } }),
        Object.freeze({ delay: 2250, event: { type: "process", step: { id: "agent-start", kind: "node", label: "正在执行 DeepSeek Agent", detail: "核对实际返回模型", status: "running" } } }),
        Object.freeze({ delay: 3050, event: { type: "cost_update", item: { id: "agent-deepseek-flash", category: "llm", role: "agent", label: "Agent 模型", nodeLabel: "DeepSeek Agent", provider: "DeepSeek", model: "deepseek-v4-flash", promptTokens: 14693, completionTokens: 61, totalTokens: 14754, reportedAmount: 0.014815, reportedCurrency: "RMB", evidence: "exact", pricingStatus: "exact_usage" } } }),
        Object.freeze({ delay: 3400, event: { type: "answer_delta", delta: "先不要立即降价，应确认客户认为“贵”的比较基准。" } }),
        Object.freeze({ delay: 3850, event: { type: "answer_delta", delta: "\n\n可以从交付稳定性、售后、认证和总采购成本四个角度重新建立价值。" } }),
        Object.freeze({ delay: 4250, event: { type: "cost_checksum", usage: { promptTokens: 14693, completionTokens: 61, totalTokens: 14754 }, note: "页面按实际 Flash 归类，不按用户选择的 Pro 归类" } }),
        Object.freeze({ delay: 4550, event: { type: "done", result: { conversation_id: "replay-kb-mismatch", workflow_run_id: "verified-replay-kb-mismatch" } } })
      ])
    }),
    "image-document": Object.freeze({
      id: "image-document",
      label: "图片与文档 + Gemini",
      source: "no-kb",
      modelKey: "gemini-3.5-flash",
      prompt: "结合产品图片和规格文档，整理客户最关心的三个卖点。",
      events: Object.freeze([
        Object.freeze({ delay: 180, event: { type: "process", step: { id: "workflow-start", kind: "node", label: "图片与文档已进入 Chatflow", detail: "正在拆分文件处理路径", status: "running" } } }),
        Object.freeze({ delay: 700, event: { type: "process", step: { id: "document", kind: "node", label: "正在解析规格文档", detail: "Document Extractor", status: "running" } } }),
        Object.freeze({ delay: 1150, event: { type: "cost_update", item: { id: "document-parser", category: "document", role: "document", label: "文档解析", nodeLabel: "Document Extractor", provider: "Dify", service: "document_parser", quantity: 1, unit: "document", evidence: "exact", pricingStatus: "unit_usage" } } }),
        Object.freeze({ delay: 1650, event: { type: "cost_update", item: { id: "vision-gemini", category: "llm", role: "vision", label: "视觉模型", nodeLabel: "图片识别", provider: "Google", model: "gemini-3.5-flash", promptTokens: 1223, completionTokens: 177, totalTokens: 1400, reportedAmount: 0.0034275, reportedCurrency: "USD", evidence: "exact", pricingStatus: "exact_usage" } } }),
        Object.freeze({ delay: 2250, event: { type: "process", step: { id: "agent-start", kind: "node", label: "正在合并图片与文档上下文", detail: "Gemini Agent", status: "running" } } }),
        Object.freeze({ delay: 3050, event: { type: "cost_update", item: { id: "agent-gemini", category: "llm", role: "agent", label: "Agent 模型", nodeLabel: "Gemini Agent", provider: "Google", model: "gemini-3.5-flash", promptTokens: 3776, completionTokens: 282, totalTokens: 4058, reportedAmount: 0.008202, reportedCurrency: "USD", evidence: "exact", pricingStatus: "exact_usage" } } }),
        Object.freeze({ delay: 3450, event: { type: "answer_delta", delta: "客户最关心的三个卖点是：规格稳定、定制灵活和交付可预期。" } }),
        Object.freeze({ delay: 3900, event: { type: "answer_delta", delta: "\n\n建议在报价中同时展示参数依据、定制边界和可执行交期。" } }),
        Object.freeze({ delay: 4300, event: { type: "cost_checksum", usage: { promptTokens: 4999, completionTokens: 459, totalTokens: 5458 }, note: "视觉与 Agent 两个模型节点分别入账" } }),
        Object.freeze({ delay: 4600, event: { type: "done", result: { conversation_id: "replay-image-document", workflow_run_id: "verified-replay-image-document" } } })
      ])
    })
  });

  /**
   * 创建管理员可编辑的单价表副本。
   *
   * @returns {Record<string, { amount: number, currency: "USD" | "RMB", unit: string }>} 可安全修改的价格对象。
   * @throws {Error} 本函数不主动抛异常。
   */
  function createDefaultPrices() {
    return PRICE_DEFINITIONS.reduce((result, definition) => {
      result[definition.id] = {
        amount: Number(definition.amount),
        currency: definition.currency,
        unit: definition.unit
      };
      return result;
    }, {});
  }

  /**
   * 创建成本监控页状态。
   *
   * @returns {object} 页面初始状态。
   * @throws {Error} 本函数不主动抛异常。
   */
  function createState() {
    const firstScenario = REPLAY_SCENARIOS["mixed-image"];

    return {
      mode: "replay",
      source: firstScenario.source,
      replayScenario: firstScenario.id,
      modelKey: firstScenario.modelKey,
      draft: firstScenario.prompt,
      status: "idle",
      startedAt: null,
      endedAt: null,
      activeRunId: "",
      workflowRunId: "",
      conversationIds: { kb: "", "no-kb": "" },
      turns: [],
      timeline: [],
      costItems: [],
      checksum: null,
      error: "",
      showConnection: false,
      showPrices: false,
      exchangeUsdRmb: 7.2,
      marginPercent: 65,
      vbeansPerRmb: 33.09,
      prices: createDefaultPrices()
    };
  }

  /**
   * 获取一个回放场景；无效 ID 回退到第一个场景。
   *
   * @param {unknown} scenarioId - 场景 ID。
   * @returns {typeof REPLAY_SCENARIOS[string]} 场景数据。
   * @throws {Error} 本函数不主动抛异常。
   */
  function getReplayScenario(scenarioId) {
    return REPLAY_SCENARIOS[String(scenarioId || "")] || REPLAY_SCENARIOS["mixed-image"];
  }

  /**
   * 创建每轮都会发生的平台固定成本。
   *
   * @param {"kb" | "no-kb"} source - 当前 Chatflow 类型。
   * @returns {object[]} 平台固定摊销；知识库模式会多一条知识库周期成本。
   * @throws {Error} 本函数不主动抛异常。
   */
  function createBaseCostItems(source) {
    const items = [{
      id: "platform-run",
      category: "platform",
      role: "platform",
      label: "平台固定摊销",
      nodeLabel: "Dify / 网关 / 日志",
      provider: "赢单平台",
      service: "platform",
      quantity: 1,
      unit: "run",
      evidence: "configured",
      pricingStatus: "unit_usage"
    }];

    if (source === "kb") {
      items.push({
        id: "knowledge-fixed-run",
        category: "knowledge-fixed",
        role: "knowledge",
        label: "知识库固定摊销",
        nodeLabel: "入库 Embedding / 向量存储",
        provider: "知识库",
        service: "knowledge-fixed",
        quantity: 1,
        unit: "run",
        evidence: "configured",
        pricingStatus: "unit_usage"
      });
    }

    return items;
  }

  /**
   * 开始一轮新消息。
   *
   * @param {object} monitorState - createState 创建的页面状态。
   * @param {string} question - 用户本轮输入。
   * @param {number} [startedAt=Date.now()] - 开始时间，测试可传固定值。
   * @returns {object} 新创建的对话轮次。
   * @throws {Error} 本函数不主动抛异常。
   */
  function beginRun(monitorState, question, startedAt = Date.now()) {
    const safeStartedAt = Number.isFinite(Number(startedAt)) ? Number(startedAt) : Date.now();
    const runId = `cost-run-${safeStartedAt}-${Math.random().toString(36).slice(2, 7)}`;
    const turn = {
      id: runId,
      question: String(question || "").trim(),
      answer: "",
      status: "running",
      startedAt: safeStartedAt,
      endedAt: null,
      costItems: []
    };

    monitorState.status = "running";
    monitorState.startedAt = safeStartedAt;
    monitorState.endedAt = null;
    monitorState.activeRunId = runId;
    monitorState.workflowRunId = "";
    monitorState.timeline = [];
    monitorState.costItems = createBaseCostItems(monitorState.source);
    monitorState.checksum = null;
    monitorState.error = "";
    monitorState.turns = [...monitorState.turns.slice(-7), turn];

    return turn;
  }

  /**
   * 获取当前正在执行或刚完成的轮次。
   *
   * @param {object} monitorState - 成本监控页状态。
   * @returns {object | null} 当前轮次。
   * @throws {Error} 本函数不主动抛异常。
   */
  function getActiveTurn(monitorState) {
    return monitorState.turns.find((turn) => turn.id === monitorState.activeRunId)
      || monitorState.turns[monitorState.turns.length - 1]
      || null;
  }

  /**
   * 把事件加入时间轴；相同事件会覆盖更新，并始终按真实到达时间排序。
   *
   * 同一节点的“开始”和“完成”会使用不同 ID，因此用户能看到完整过程；
   * 同一条 SSE 被代理重复推送时仍会覆盖而不会制造重复记录。
   *
   * @param {object} monitorState - 页面状态。
   * @param {object} entry - 时间轴条目。
   * @returns {void}
   * @throws {Error} 本函数不主动抛异常。
   */
  function upsertTimelineEntry(monitorState, entry) {
    const existingIndex = monitorState.timeline.findIndex((item) => item.id === entry.id);
    const nextTimeline = existingIndex >= 0
      ? monitorState.timeline.map((item, index) => index === existingIndex ? entry : item)
      : [...monitorState.timeline, entry];

    monitorState.timeline = nextTimeline
      .sort((left, right) => Number(left.elapsedMs || 0) - Number(right.elapsedMs || 0))
      .slice(-30);
  }

  /**
   * 把一条成本事件应用到当前页面状态。
   *
   * 真实调用与实测回放都走这个函数，因此两种模式看到的“成本跳动”规则完全一致。
   *
   * @param {object} monitorState - 页面状态。
   * @param {object} event - process、cost_update、cost_checksum、answer_delta、answer_replace、done 或 error。
   * @param {number} [receivedAt=Date.now()] - 事件到达时间。
   * @returns {object} 更新后的同一个页面状态对象。
   * @throws {Error} 本函数不主动抛异常；未知事件会被忽略。
   */
  function applyEvent(monitorState, event, receivedAt = Date.now()) {
    const eventType = String(event?.type || "");
    const safeReceivedAt = Number.isFinite(Number(receivedAt)) ? Number(receivedAt) : Date.now();
    const elapsedMs = monitorState.startedAt === null
      ? 0
      : Math.max(0, safeReceivedAt - Number(monitorState.startedAt));
    const activeTurn = getActiveTurn(monitorState);

    if (eventType === "process" && event.step && typeof event.step === "object") {
      const step = event.step;
      upsertTimelineEntry(monitorState, {
        id: `process-${String(step.id || monitorState.timeline.length + 1)}-${String(step.status || "running")}`,
        kind: String(step.kind || "node"),
        label: String(step.label || "正在执行 Chatflow 节点"),
        detail: String(step.detail || ""),
        status: String(step.status || "running"),
        elapsedMs
      });
      return monitorState;
    }

    if (eventType === "cost_update" && event.item && typeof event.item === "object") {
      const item = { ...event.item };
      const itemId = String(item.id || `cost-${monitorState.costItems.length + 1}`);
      const existingIndex = monitorState.costItems.findIndex((costItem) => String(costItem.id) === itemId);

      item.id = itemId;
      item.receivedAt = safeReceivedAt;
      if (existingIndex >= 0) {
        monitorState.costItems = monitorState.costItems.map((costItem, index) => index === existingIndex ? item : costItem);
      } else {
        monitorState.costItems = [...monitorState.costItems, item];
      }

      upsertTimelineEntry(monitorState, {
        id: `cost-${itemId}`,
        kind: "cost",
        label: `${String(item.label || item.nodeLabel || "成本项")}已入账`,
        detail: String(item.model || item.service || item.provider || "等待单价匹配"),
        status: "done",
        elapsedMs
      });
      return monitorState;
    }

    if (eventType === "cost_checksum") {
      monitorState.checksum = {
        promptTokens: Number(event?.usage?.promptTokens || event?.usage?.prompt_tokens || 0),
        completionTokens: Number(event?.usage?.completionTokens || event?.usage?.completion_tokens || 0),
        totalTokens: Number(event?.usage?.totalTokens || event?.usage?.total_tokens || 0),
        note: String(event?.note || "全局总量只做核对，不重复计费")
      };
      upsertTimelineEntry(monitorState, {
        id: "cost-checksum",
        kind: "check",
        label: "全局 Token 校验完成",
        detail: monitorState.checksum.note,
        status: "done",
        elapsedMs
      });
      return monitorState;
    }

    if (eventType === "answer_delta" && activeTurn) {
      activeTurn.answer += String(event.delta || "");
      activeTurn.status = "streaming";
      upsertTimelineEntry(monitorState, {
        id: "answer-stream",
        kind: "answer",
        label: "正式答案正在返回",
        detail: "回答内容与成本明细同步更新",
        status: "running",
        elapsedMs
      });
      return monitorState;
    }

    if (eventType === "answer_replace" && activeTurn) {
      activeTurn.answer = String(event.answer || "");
      activeTurn.status = "streaming";
      return monitorState;
    }

    if (eventType === "done") {
      monitorState.status = "done";
      monitorState.endedAt = safeReceivedAt;
      monitorState.workflowRunId = String(event?.result?.workflow_run_id || "");
      const conversationId = String(event?.result?.conversation_id || "");
      if (conversationId) {
        monitorState.conversationIds[monitorState.source] = conversationId;
      }
      if (activeTurn) {
        activeTurn.status = "done";
        activeTurn.endedAt = safeReceivedAt;
        activeTurn.costItems = monitorState.costItems.map((item) => ({ ...item }));
      }
      upsertTimelineEntry(monitorState, {
        id: "run-done",
        kind: "done",
        label: "本句话已完成结算",
        detail: "成本明细已冻结，等待日终账单对账",
        status: "done",
        elapsedMs
      });
      return monitorState;
    }

    if (eventType === "error") {
      monitorState.status = "error";
      monitorState.endedAt = safeReceivedAt;
      monitorState.error = String(event.message || "Chatflow 调用失败，请稍后重试。");
      if (activeTurn) {
        activeTurn.status = "error";
        activeTurn.endedAt = safeReceivedAt;
        activeTurn.answer = monitorState.error;
        activeTurn.costItems = monitorState.costItems.map((item) => ({ ...item }));
      }
      upsertTimelineEntry(monitorState, {
        id: "run-error",
        kind: "error",
        label: "本轮调用已中断",
        detail: monitorState.error,
        status: "error",
        elapsedMs
      });
    }

    return monitorState;
  }

  /**
   * 把一个原生币种金额换算成人民币。
   *
   * @param {number} amount - 原生币种金额。
   * @param {string} currency - USD 或 RMB。
   * @param {number} usdRate - 美元兑人民币汇率。
   * @returns {number} 人民币金额。
   * @throws {Error} 本函数不主动抛异常；无效数字按 0 处理。
   */
  function convertToRmb(amount, currency, usdRate) {
    const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
    return String(currency || "RMB").toUpperCase() === "USD"
      ? safeAmount * Math.max(0, Number(usdRate) || 0)
      : safeAmount;
  }

  /**
   * 按单价字段计算一段数量的人民币成本。
   *
   * @param {object} monitorState - 页面状态，包含 prices 和汇率。
   * @param {string} priceId - PRICE_DEFINITIONS 中的字段 ID。
   * @param {number} quantity - token、credit、文档或任务数量。
   * @param {"token" | "unit"} quantityMode - token 需要除以 100 万，其它单位直接相乘。
   * @returns {{ amountRmb: number, missing: boolean, priceId: string }} 计算结果。
   * @throws {Error} 本函数不主动抛异常。
   */
  function calculateWithPrice(monitorState, priceId, quantity, quantityMode) {
    const price = monitorState.prices?.[priceId];
    const amount = Number(price?.amount || 0);
    const safeQuantity = Math.max(0, Number(quantity) || 0);
    const nativeCost = quantityMode === "token"
      ? (safeQuantity / 1000000) * amount
      : safeQuantity * amount;

    return {
      amountRmb: convertToRmb(nativeCost, price?.currency, monitorState.exchangeUsdRmb),
      missing: safeQuantity > 0 && amount <= 0,
      priceId
    };
  }

  /**
   * 计算单个成本明细。
   *
   * @param {object} monitorState - 页面状态。
   * @param {object} item - 当前成本项。
   * @returns {{ amountRmb: number, missing: boolean, reason: string, inputAmountRmb?: number, outputAmountRmb?: number }} 明细计算结果。
   * @throws {Error} 本函数不主动抛异常；无法识别的模型返回 missing=true。
   */
  function calculateCostItem(monitorState, item) {
    const category = String(item?.category || "");

    if (category === "llm") {
      const model = String(item?.model || "");
      const keys = MODEL_PRICE_KEYS[model];
      if (!keys) {
        return { amountRmb: 0, missing: true, reason: model ? `模型 ${model} 尚未配置精确映射` : "实际模型名尚未返回" };
      }

      const input = calculateWithPrice(monitorState, keys.input, item.promptTokens, "token");
      const output = calculateWithPrice(monitorState, keys.output, item.completionTokens, "token");
      return {
        amountRmb: input.amountRmb + output.amountRmb,
        inputAmountRmb: input.amountRmb,
        outputAmountRmb: output.amountRmb,
        missing: input.missing || output.missing,
        reason: input.missing || output.missing ? "该实际模型的输入或输出单价尚未填写" : ""
      };
    }

    if (category === "embedding") {
      // 知识库节点有时只告诉我们“发生过检索”，却不给本次向量化 Token。
      // 这种情况绝不能因为 quantity 被清洗成 0 就误判为免费；必须等后端补齐
      // 用量，或由财务明确填写一条可审计的估算数量后，才能继续结算。
      const embeddingQuantity = Number(item?.quantity);
      if (!Number.isFinite(embeddingQuantity) || embeddingQuantity <= 0) {
        return { amountRmb: 0, missing: true, reason: "知识库已调用，但 Embedding 用量尚未返回" };
      }
      const result = calculateWithPrice(monitorState, "embedding", item.quantity, "token");
      return { ...result, reason: result.missing ? "Embedding 单价尚未填写" : "" };
    }

    if (category === "tool") {
      const service = String(item?.service || "").toLowerCase();
      if (item?.requiresQuantity || item?.quantity === null || item?.quantity === undefined) {
        return { amountRmb: 0, missing: true, reason: "工具已调用，但供应商计费数量尚未返回" };
      }
      if (!service.includes("tavily")) {
        return { amountRmb: 0, missing: true, reason: `工具 ${item?.service || item?.label || "未知"} 尚未配置单价` };
      }
      const result = calculateWithPrice(monitorState, "tavily", item.quantity, "unit");
      return { ...result, reason: result.missing ? "Tavily credit 单价尚未填写" : "" };
    }

    if (category === "document") {
      const result = calculateWithPrice(monitorState, "document", item.quantity, "unit");
      return { ...result, reason: result.missing ? "文档解析单价尚未填写" : "" };
    }

    if (category === "knowledge-fixed") {
      const result = calculateWithPrice(monitorState, "knowledge-fixed", item.quantity, "unit");
      return { ...result, reason: result.missing ? "知识库固定摊销尚未填写" : "" };
    }

    if (category === "platform") {
      const result = calculateWithPrice(monitorState, "platform", item.quantity, "unit");
      return { ...result, reason: result.missing ? "平台固定摊销尚未填写" : "" };
    }

    return { amountRmb: 0, missing: true, reason: "该计费项尚未配置计算规则" };
  }

  /**
   * 汇总当前一句话的成本、建议售价和 V豆。
   *
   * 售价使用目标毛利率公式：售价 = 成本 ÷ (1 - 毛利率)。
   * 任何启用中的成本项缺少单价时，售价与扣费会暂停，防止把未知成本当作免费。
   *
   * @param {object} monitorState - 页面状态。
   * @param {object[]} [items=monitorState.costItems] - 可选成本项，计算历史轮次时使用。
   * @returns {object} 已知成本、缺失项、售价、V豆和带计算结果的明细。
   * @throws {Error} 本函数不主动抛异常。
   */
  function calculateSummary(monitorState, items = monitorState.costItems) {
    const safeItems = Array.isArray(items) ? items : [];
    const lines = safeItems.map((item) => ({
      item,
      calculation: calculateCostItem(monitorState, item)
    }));
    const hasExpectedAgentUsage = safeItems.some((item) => item?.category === "llm" && item?.role === "agent");

    // 一轮开始后，仅有平台固定摊销绝不代表已经算全。
    // 这条结算闸门也保护“前端已更新、线上 Worker 尚未发布 cost_update”的过渡期：
    // 即使收到 done，只要缺少实际 Agent 模型和 Token，就必须继续显示待补，不能收取错误金额。
    if (safeItems.length > 0 && !hasExpectedAgentUsage) {
      lines.push({
        item: {
          id: "agent-usage-required",
          category: "required",
          role: "agent",
          label: "Agent 实际模型与用量",
          nodeLabel: "等待 node_finished 成本事件",
          quantity: null,
          evidence: "unpriced"
        },
        calculation: {
          amountRmb: 0,
          missing: true,
          reason: "尚未收到最终 Agent 模型与 Token，用量不能按 0 元结算"
        }
      });
    }
    const knownCostRmb = lines.reduce((sum, line) => sum + line.calculation.amountRmb, 0);
    const missingLines = lines.filter((line) => line.calculation.missing);
    const margin = Math.min(95, Math.max(0, Number(monitorState.marginPercent) || 0));
    const salePriceRmb = missingLines.length ? null : knownCostRmb / (1 - margin / 100);
    const vbeans = salePriceRmb === null
      ? null
      : Math.ceil((salePriceRmb * Math.max(0, Number(monitorState.vbeansPerRmb) || 0)) / 5) * 5;
    const tokenTotal = lines.reduce((sum, line) => sum + Math.max(0, Number(line.item.totalTokens) || 0), 0);

    return {
      lines,
      knownCostRmb,
      missingLines,
      isComplete: missingLines.length === 0,
      salePriceRmb,
      vbeans,
      tokenTotal,
      marginPercent: margin
    };
  }

  /**
   * 汇总当前会话中每一句已经发生的成本。
   *
   * @param {object} monitorState - 页面状态。
   * @returns {{ knownCostRmb: number, hasMissing: boolean, turnCount: number }} 会话累计结果。
   * @throws {Error} 本函数不主动抛异常。
   */
  function calculateSessionSummary(monitorState) {
    let knownCostRmb = 0;
    let hasMissing = false;

    monitorState.turns.forEach((turn) => {
      const items = turn.id === monitorState.activeRunId
        ? monitorState.costItems
        : (Array.isArray(turn.costItems) ? turn.costItems : []);
      const summary = calculateSummary(monitorState, items);
      knownCostRmb += summary.knownCostRmb;
      // 当前轮即使已经收到 Agent 用量，done 之前仍可能继续出现工具、重试或后处理成本。
      // 会话总计必须保留“+”号，直到该轮真正完成并且所有明细都已定价。
      hasMissing = hasMissing || turn.status !== "done" || !summary.isComplete;
    });

    return { knownCostRmb, hasMissing, turnCount: monitorState.turns.length };
  }

  /**
   * 查找用户选择模型与 Agent 实际模型是否不一致。
   *
   * 视觉模型是独立前置节点，不应被误判为用户选择的 Agent 模型，所以这里只比较 role=agent。
   *
   * @param {object} monitorState - 页面状态。
   * @returns {{ requested: string, actual: string, mismatch: boolean, unresolved: boolean }} 模型核对结果。
   * @throws {Error} 本函数不主动抛异常。
   */
  function getModelAudit(monitorState) {
    const agentItem = monitorState.costItems.find((item) => item.role === "agent" && item.category === "llm");
    const actual = String(agentItem?.model || "");
    const requested = String(monitorState.modelKey || "");

    return {
      requested,
      actual,
      mismatch: Boolean(actual && requested && actual !== requested),
      unresolved: !actual
    };
  }

  /**
   * 取得回放事件的可修改副本。
   *
   * @param {unknown} scenarioId - 场景 ID。
   * @returns {Array<{ delay: number, event: object }>} 事件副本。
   * @throws {Error} 本函数不主动抛异常。
   */
  function getReplayEvents(scenarioId) {
    return getReplayScenario(scenarioId).events.map((entry) => ({
      delay: Number(entry.delay) || 0,
      event: JSON.parse(JSON.stringify(entry.event))
    }));
  }

  const publicApi = {
    MODEL_PRICE_KEYS,
    PRICE_DEFINITIONS,
    REPLAY_SCENARIOS,
    applyEvent,
    beginRun,
    calculateCostItem,
    calculateSessionSummary,
    calculateSummary,
    createDefaultPrices,
    createState,
    getActiveTurn,
    getModelAudit,
    getReplayEvents,
    getReplayScenario
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = publicApi;
  }

  if (globalObject) {
    globalObject.YD_COST_MONITOR = publicApi;
  }
}(typeof window !== "undefined" ? window : globalThis));
