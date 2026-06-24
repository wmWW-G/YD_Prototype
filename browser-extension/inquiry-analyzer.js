/* global globalThis */

/**
 * 赢单询盘分析的本地规则引擎。
 *
 * 为什么第一版先放本地：
 * - 浏览器插件不能把真实 API Token 放在前端代码里。
 * - 当前目标是把“网页询盘 -> 赢单分析界面 -> 可复制建议”的流程跑通。
 * - 后续接 Coze 或 Python 后端时，只需要替换 analyzeInquiry 这一层。
 */
(function initInquiryAnalyzer(globalScope) {
  /**
   * 询盘分析时用于识别字段的关键词。
   *
   * @type {{
   *   product: string[],
   *   price: string[],
   *   quantity: string[],
   *   delivery: string[],
   *   certification: string[],
   *   payment: string[],
   *   sample: string[],
   *   competitor: string[]
   * }}
   */
  const KEYWORDS = {
    product: ["product", "item", "model", "spec", "specification", "solar", "inverter", "battery", "panel", "mounting", "material", "产品", "型号", "规格"],
    price: ["price", "quote", "quotation", "offer", "best price", "报价", "价格", "单价"],
    quantity: ["quantity", "qty", "moq", "pcs", "pieces", "units", "sets", "container", "数量", "起订量"],
    delivery: ["lead time", "delivery", "shipment", "port", "fob", "cif", "ddp", "交期", "港口", "发货", "运输"],
    certification: ["certificate", "certification", "ce", "ul", "rohs", "iec", "iso", "认证", "证书"],
    payment: ["payment", "terms", "t/t", "lc", "l/c", "付款", "账期"],
    sample: ["sample", "trial order", "样品", "试单"],
    competitor: ["compare", "supplier", "best price", "cheaper", "lowest", "比价", "供应商"]
  };

  /**
   * 字段缺失时建议补问的问题。
   *
   * @type {Record<string, string>}
   */
  const QUESTION_BY_FIELD = {
    product: "Could you share the exact product model, specification or application scenario?",
    quantity: "What is your target quantity for the first order or trial order?",
    delivery: "Which delivery port or destination city should we use for the shipping estimate?",
    certification: "Do you need any specific certificates or compliance documents for this market?",
    payment: "Do you have a preferred payment term for this order?",
    targetPrice: "Do you already have a target price range or current supplier benchmark?"
  };

  /**
   * 把任意输入转成可分析的普通文本。
   *
   * @param {unknown} value - 用户粘贴、页面提取或选中的原始内容。
   * @returns {string} 去掉多余空白后的文本。
   * @throws {Error} 本函数不主动抛异常；无法识别的值会转成空字符串。
   */
  function normalizeText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  /**
   * 判断一段文本里是否包含任意关键词。
   *
   * @param {string} lowerText - 已经转成小写的询盘文本。
   * @param {string[]} words - 待匹配关键词列表。
   * @returns {boolean} 只要命中一个关键词就返回 true。
   * @throws {Error} 本函数不主动抛异常。
   */
  function hasAny(lowerText, words) {
    return words.some((word) => lowerText.includes(word.toLowerCase()));
  }

  /**
   * 从询盘里粗略提取数量表达。
   *
   * @param {string} text - 原始询盘文本。
   * @returns {string} 找到的数量片段；找不到时返回空字符串。
   * @throws {Error} 本函数不主动抛异常。
   */
  function extractQuantity(text) {
    const match = text.match(/\b\d[\d,.\s]*(pcs|pieces|units|sets|containers?|cartons?|tons?|mt|kg|sqm|m2|kw|mw)\b/i);
    return match ? match[0].replace(/\s+/g, " ").trim() : "";
  }

  /**
   * 从询盘里粗略提取客户提到的产品线索。
   *
   * @param {string} text - 原始询盘文本。
   * @returns {string} 产品线索；找不到时返回通用占位。
   * @throws {Error} 本函数不主动抛异常。
   */
  function extractProductHint(text) {
    const cleanText = normalizeText(text);
    const productMatch = cleanText.match(/\b(solar panels?|hybrid inverter|inverters?|battery storage|mounting system|led lights?|steel structure|packaging machine|the product|your product)\b/i);

    if (productMatch) {
      return productMatch[0];
    }

    const firstUsefulLine = cleanText
      .split(/\n|\.|\?|!/g)
      .map((line) => line.trim())
      .find((line) => line.length >= 12 && line.length <= 120);

    return firstUsefulLine || "the product";
  }

  /**
   * 推断客户当前更像哪一种询盘意图。
   *
   * @param {string} lowerText - 小写询盘文本。
   * @returns {string} 意图标签。
   * @throws {Error} 本函数不主动抛异常。
   */
  function detectIntent(lowerText) {
    if (hasAny(lowerText, ["sample", "trial order", "样品", "试单"])) {
      return "样品/试单";
    }

    if (hasAny(lowerText, ["project", "tender", "installation", "commercial", "rooftop", "工程", "项目", "招标"])) {
      return "项目采购";
    }

    if (hasAny(lowerText, KEYWORDS.competitor)) {
      return "比价询盘";
    }

    if (hasAny(lowerText, ["catalog", "brochure", "datasheet", "资料", "目录", "参数"])) {
      return "资料索取";
    }

    return "常规询价";
  }

  /**
   * 根据字段完整度给询盘打 A/B/C 等级。
   *
   * @param {{ hasProduct: boolean, hasQuantity: boolean, hasDelivery: boolean, hasCertification: boolean, hasPrice: boolean, isShort: boolean, intent: string }} signals - 询盘字段信号。
   * @returns {{ grade: string, gradeReason: string }} 等级和判断理由。
   * @throws {Error} 本函数不主动抛异常。
   */
  function scoreInquiry(signals) {
    let score = 0;

    if (signals.hasProduct) score += 2;
    if (signals.hasQuantity) score += 2;
    if (signals.hasDelivery) score += 1;
    if (signals.hasCertification) score += 1;
    if (signals.hasPrice) score += 1;
    if (signals.intent === "项目采购") score += 1;
    if (signals.intent === "比价询盘") score -= 1;
    if (signals.isShort) score -= 1;

    if (score >= 5) {
      return { grade: "A", gradeReason: "需求字段较完整，建议当天优先跟进并争取会议或明确报价条件。" };
    }

    if (score >= 2) {
      return { grade: "B", gradeReason: "有明确采购兴趣，但关键条件还不够完整，适合先补问再报价。" };
    }

    return { grade: "C", gradeReason: "信息较少或比价倾向明显，先低成本确认身份和真实需求。" };
  }

  /**
   * 找出询盘缺失的关键字段。
   *
   * @param {{ hasProduct: boolean, hasQuantity: boolean, hasDelivery: boolean, hasCertification: boolean, hasPayment: boolean, hasPrice: boolean }} signals - 询盘字段信号。
   * @returns {Array<{ id: string, label: string }>} 缺失字段列表。
   * @throws {Error} 本函数不主动抛异常。
   */
  function getMissingFields(signals) {
    const missing = [];

    if (!signals.hasProduct) missing.push({ id: "product", label: "产品型号/规格" });
    if (!signals.hasQuantity) missing.push({ id: "quantity", label: "采购数量/MOQ" });
    if (!signals.hasDelivery) missing.push({ id: "delivery", label: "目标港口/交期" });
    if (!signals.hasCertification) missing.push({ id: "certification", label: "认证要求" });
    if (!signals.hasPayment) missing.push({ id: "payment", label: "付款方式" });
    if (!signals.hasPrice) missing.push({ id: "targetPrice", label: "目标价格/价格区间" });

    return missing;
  }

  /**
   * 生成首回邮件草稿。
   *
   * @param {{ productHint: string, missingFields: Array<{ id: string, label: string }>, intent: string, extraContext: string }} data - 邮件所需上下文。
   * @returns {string} 英文首回邮件草稿。
   * @throws {Error} 本函数不主动抛异常。
   */
  function buildReplyDraft(data) {
    const questions = data.missingFields
      .slice(0, 4)
      .map((field, index) => `${index + 1}. ${QUESTION_BY_FIELD[field.id]}`)
      .join("\n");

    const contextLine = data.extraContext
      ? "I also noted your additional requirements and will keep them in mind when preparing the proposal."
      : "To make sure the proposal is accurate, I would like to confirm a few details first.";

    return [
      "Hi,",
      "",
      `Thanks for your inquiry about ${data.productHint}.`,
      contextLine,
      "",
      questions || "Could you confirm the target quantity, destination and expected delivery time?",
      "",
      "Once I have these details, I can come back with a more useful recommendation, suitable options and a clear quotation boundary.",
      "",
      "Best regards,"
    ].join("\n");
  }

  /**
   * 生成下一步动作建议。
   *
   * @param {{ grade: string, intent: string, missingFields: Array<{ id: string, label: string }> }} data - 询盘等级和缺失字段。
   * @returns {string[]} 下一步建议列表。
   * @throws {Error} 本函数不主动抛异常。
   */
  function buildNextSteps(data) {
    if (data.grade === "A") {
      return [
        "当天回复，先复述需求，再补问关键报价条件。",
        "同步准备产品参数、认证文件和相似市场案例。",
        "如果客户回复完整，推进视频会议或正式报价。"
      ];
    }

    if (data.grade === "B") {
      return [
        "先问回 3-4 个关键缺失字段，不急着报最低价。",
        "用一个短案例或交付证明建立专业感。",
        "客户补齐数量/港口/认证后，再进入报价。"
      ];
    }

    return [
      "先确认客户身份、采购角色和公司背景。",
      "只给轻量信息，不投入过多定制报价时间。",
      "如果连续两轮不补充信息，降级为低优先级跟进。"
    ];
  }

  /**
   * 把角色标识转成赢单分析里更容易读懂的中文称呼。
   *
   * @param {unknown} role - 国际站消息方向，例如 buyer / seller。
   * @returns {string} 展示在聊天记录里的角色名称。
   * @throws {Error} 本函数不主动抛异常。
   */
  function normalizeAlibabaRole(role) {
    if (role === "buyer") {
      return "客户";
    }

    if (role === "seller") {
      return "我方";
    }

    return "未知";
  }

  /**
   * 把国际站聊天记录格式化成适合发送给 AI 的完整上下文。
   *
   * 为什么要在这里倒序：
   * - 国际站消息 DOM 里常见顺序是“最新在前、历史在后”。
   * - AI 分析谈判上下文时，需要按真实对话发生顺序阅读，也就是“最早到最新”。
   *
   * @param {Array<{ role?: string, sender?: string, time?: string, original?: string, translated?: string }>} records - 从页面 DOM 抽取的聊天记录，通常是最新到最早。
   * @param {{ sourceTitle?: string, sourceUrl?: string, loadRounds?: number, reachedStableEnd?: boolean }} [metadata] - 页面来源和历史回溯状态。
   * @returns {string} 可直接发给 AI 的聊天记录文本。
   * @throws {Error} 本函数不主动抛异常。
   */
  function formatAlibabaChatRecords(records, metadata = {}) {
    const safeRecords = Array.isArray(records) ? records : [];
    const orderedRecords = safeRecords
      .slice()
      .reverse()
      .filter((record) => normalizeText(record && (record.original || record.translated)));

    const lines = [
      "【国际站聊天记录】",
      `来源：${normalizeText(metadata.sourceTitle) || "Alibaba 国际站询盘详情"}`,
      `链接：${normalizeText(metadata.sourceUrl) || "未提供"}`,
      `共读取 ${orderedRecords.length} 条消息`,
      `回溯轮次：${Number(metadata.loadRounds || 0)}`,
      `回溯状态：${metadata.reachedStableEnd ? "连续多轮没有新增消息，已尽量回溯到最早记录。" : "达到保护上限或仍可能存在更早记录。"}`,
      "顺序：从最早到最新",
      ""
    ];

    orderedRecords.forEach((record) => {
      const role = normalizeAlibabaRole(record.role);
      const sender = normalizeText(record.sender);
      const time = normalizeText(record.time) || "时间未知";
      const original = normalizeText(record.original);
      const translated = normalizeText(record.translated);
      const displayName = role === "客户" && sender ? `${role} ${sender}` : role;

      lines.push(`[${time}] ${displayName}：`);

      if (original) {
        lines.push(`原文：${original}`);
      }

      if (translated && translated !== original) {
        lines.push(`翻译：${translated}`);
      }

      lines.push("");
    });

    return lines.join("\n").trim();
  }

  /**
   * 判断国际站历史聊天是否还需要继续向上加载。
   *
   * 为什么不用 scrollTop 判断结束：
   * - 国际站历史分页加载后会自动回填 scrollTop，用来保持用户视口位置。
   * - 因此更可靠的信号是“消息数量是否连续几轮不再增长”。
   *
   * @param {{ previousCount: number, currentCount: number, stableRounds: number, round: number, maxRounds: number, stableRoundLimit: number, maxMessages: number }} state - 当前加载状态。
   * @returns {{ nextStableRounds: number, reason: string, shouldContinue: boolean }} 下一轮判断结果。
   * @throws {Error} 本函数不主动抛异常。
   */
  function shouldContinueAlibabaHistoryLoad(state) {
    const previousCount = Number(state && state.previousCount) || 0;
    const currentCount = Number(state && state.currentCount) || 0;
    const stableRounds = Number(state && state.stableRounds) || 0;
    const round = Number(state && state.round) || 0;
    const maxRounds = Number(state && state.maxRounds) || 0;
    const stableRoundLimit = Number(state && state.stableRoundLimit) || 2;
    const maxMessages = Number(state && state.maxMessages) || 0;
    const nextStableRounds = currentCount > previousCount ? 0 : stableRounds + 1;

    if (maxMessages > 0 && currentCount >= maxMessages) {
      return {
        nextStableRounds,
        reason: "max-messages",
        shouldContinue: false
      };
    }

    if (maxRounds > 0 && round >= maxRounds) {
      return {
        nextStableRounds,
        reason: "max-rounds",
        shouldContinue: false
      };
    }

    if (nextStableRounds >= stableRoundLimit) {
      return {
        nextStableRounds,
        reason: "stable",
        shouldContinue: false
      };
    }

    return {
      nextStableRounds,
      reason: currentCount > previousCount ? "grew" : "waiting",
      shouldContinue: true
    };
  }

  /**
   * 分析询盘内容并返回结构化结果。
   *
   * @param {{ inquiryText: string, extraContext?: string, pageTitle?: string, pageUrl?: string }} input - 询盘文本和页面上下文。
   * @returns {{
   *   ok: boolean,
   *   error?: string,
   *   grade?: string,
   *   gradeReason?: string,
   *   intent?: string,
   *   productHint?: string,
   *   missingFields?: string[],
   *   questions?: string[],
   *   risks?: string[],
   *   nextSteps?: string[],
   *   replyDraft?: string,
   *   source?: { title: string, url: string }
   * }} 询盘分析结果。
   * @throws {Error} 本函数不主动抛异常；异常情况用 ok=false 表达。
   */
  function analyzeInquiry(input) {
    const inquiryText = normalizeText(input && input.inquiryText);
    const extraContext = normalizeText(input && input.extraContext);

    if (inquiryText.length < 8) {
      return {
        ok: false,
        error: "请先粘贴或选中一段客户询盘内容。"
      };
    }

    const lowerText = inquiryText.toLowerCase();
    const quantity = extractQuantity(inquiryText);
    const intent = detectIntent(lowerText);
    const signals = {
      hasProduct: hasAny(lowerText, KEYWORDS.product),
      hasQuantity: Boolean(quantity) || hasAny(lowerText, KEYWORDS.quantity),
      hasDelivery: hasAny(lowerText, KEYWORDS.delivery),
      hasCertification: hasAny(lowerText, KEYWORDS.certification),
      hasPayment: hasAny(lowerText, KEYWORDS.payment),
      hasPrice: hasAny(lowerText, KEYWORDS.price),
      isShort: inquiryText.length < 80,
      intent
    };
    const scored = scoreInquiry(signals);
    const productHint = extractProductHint(inquiryText);
    const missingFieldObjects = getMissingFields(signals);
    const risks = [];

    if (intent === "比价询盘") {
      risks.push("客户可能正在多供应商比价，不建议直接给最低价。");
    }

    if (!signals.hasQuantity) {
      risks.push("缺少数量，报价容易失真。");
    }

    if (!signals.hasDelivery) {
      risks.push("缺少交付地或港口，物流和贸易条款边界不清。");
    }

    return {
      ok: true,
      grade: scored.grade,
      gradeReason: scored.gradeReason,
      intent,
      productHint,
      missingFields: missingFieldObjects.map((field) => field.label),
      questions: missingFieldObjects.slice(0, 4).map((field) => QUESTION_BY_FIELD[field.id]),
      risks,
      nextSteps: buildNextSteps({ grade: scored.grade, intent, missingFields: missingFieldObjects }),
      replyDraft: buildReplyDraft({ productHint, missingFields: missingFieldObjects, intent, extraContext }),
      source: {
        title: normalizeText(input && input.pageTitle),
        url: normalizeText(input && input.pageUrl)
      }
    };
  }

  globalScope.YingdanInquiryAnalyzer = {
    analyzeInquiry,
    formatAlibabaChatRecords,
    shouldContinueAlibabaHistoryLoad,
    normalizeText
  };
})(globalThis);
