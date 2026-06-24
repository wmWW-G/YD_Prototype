/* global chrome, document, navigator, window, YingdanInquiryAnalyzer */

(function initYingdanContentScript() {
  const SCRIPT_VERSION = "2026-06-24-alibaba-history-capture";

  if (window.__YINGDAN_INQUIRY_ASSISTANT_LOADED__ === SCRIPT_VERSION) {
    return;
  }

  window.__YINGDAN_INQUIRY_ASSISTANT_LOADED__ = SCRIPT_VERSION;

  const PANEL_ID = "yingdan-inquiry-analyzer-host";
  const MAX_PAGE_TEXT_LENGTH = 60000;
  const MAX_VISIBLE_USER_TEXT_LENGTH = 520;
  const MAX_START_PREVIEW_LENGTH = 360;
  const ALIBABA_CHAT_CONTAINER_SELECTOR = ".common-load-more";
  const ALIBABA_MESSAGE_SELECTOR = ".common-load-more .message-item-wrapper";
  const ALIBABA_HISTORY_MAX_ROUNDS = 100;
  const ALIBABA_HISTORY_STABLE_ROUNDS = 3;
  const ALIBABA_HISTORY_MAX_MESSAGES = 2000;
  const ALIBABA_HISTORY_WAIT_MS = 1800;
  const pendingAnalysisByRoot = new WeakMap();

  /**
   * 安全地截断长文本。
   *
   * @param {string} value - 需要截断的文本。
   * @param {number} maxLength - 最大字符数。
   * @returns {string} 截断后的文本。
   * @throws {Error} 本函数不主动抛异常。
   */
  function limitText(value, maxLength) {
    const text = YingdanInquiryAnalyzer.normalizeText(value);
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  }

  /**
   * 等待一小段时间。
   *
   * @param {number} ms - 等待毫秒数。
   * @returns {Promise<void>} 时间到后 resolve。
   * @throws {Error} 本函数不主动抛异常。
   */
  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  /**
   * 判断当前页面是不是阿里国际站询盘详情页。
   *
   * @returns {boolean} 命中阿里国际站消息详情页时返回 true。
   * @throws {Error} 本函数不主动抛异常。
   */
  function isAlibabaInquiryDetailPage() {
    return window.location.hostname === "message.alibaba.com"
      && window.location.pathname.includes("/message/maDetail.htm")
      && window.location.hash.includes("/feedback/detail/");
  }

  /**
   * 获取阿里国际站聊天记录滚动容器。
   *
   * @returns {HTMLElement | null} 聊天滚动容器；找不到时返回 null。
   * @throws {Error} 本函数不主动抛异常。
   */
  function getAlibabaChatContainer() {
    return document.querySelector(ALIBABA_CHAT_CONTAINER_SELECTOR);
  }

  /**
   * 统计当前已经渲染出来的国际站聊天消息条数。
   *
   * @returns {number} 当前 DOM 中的消息条数。
   * @throws {Error} 本函数不主动抛异常。
   */
  function getAlibabaMessageCount() {
    return document.querySelectorAll(ALIBABA_MESSAGE_SELECTOR).length;
  }

  /**
   * 等待国际站历史消息加载发生变化。
   *
   * 为什么同时看数量和高度：
   * - 文本消息新增时，消息数量会增长。
   * - 部分图片、文件或翻译内容异步补齐时，高度可能先变化。
   *
   * @param {number} previousCount - 滚动前消息条数。
   * @param {number} previousHeight - 滚动前容器内容高度。
   * @returns {Promise<void>} 有变化或超时后 resolve。
   * @throws {Error} 本函数不主动抛异常。
   */
  function waitForAlibabaHistoryChange(previousCount, previousHeight) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const timerId = window.setInterval(() => {
        const container = getAlibabaChatContainer();
        const currentCount = getAlibabaMessageCount();
        const currentHeight = container ? container.scrollHeight : 0;
        const changed = currentCount > previousCount || currentHeight > previousHeight;
        const timedOut = Date.now() - startTime >= ALIBABA_HISTORY_WAIT_MS;

        if (changed || timedOut) {
          window.clearInterval(timerId);
          resolve();
        }
      }, 120);
    });
  }

  /**
   * 把国际站聊天容器滚到顶部以触发历史消息懒加载。
   *
   * 为什么不是点“查看更多历史消息”：
   * - 实测该入口只是提示位，真正加载由聊天容器向上滚动触发。
   * - 国际站加载后会回填 scrollTop，因此必须多轮重复滚动。
   *
   * @param {HTMLElement} container - `.common-load-more` 聊天滚动容器。
   * @returns {void}
   * @throws {Error} DOM 滚动异常时由浏览器抛出。
   */
  function scrollAlibabaChatToTop(container) {
    container.scrollTop = 0;
    container.dispatchEvent(new Event("scroll", { bubbles: true }));
    container.dispatchEvent(new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: -6000
    }));
  }

  /**
   * 回溯加载国际站聊天历史。
   *
   * @param {(state: { round: number, messageCount: number, reason?: string }) => void} [onProgress] - 加载进度回调。
   * @returns {Promise<{ loadRounds: number, messageCount: number, reachedStableEnd: boolean, stopReason: string }>} 加载结果。
   * @throws {Error} 本函数内部尽量降级，异常会被调用方捕获。
   */
  async function loadAlibabaChatHistory(onProgress) {
    const container = getAlibabaChatContainer();

    if (!container) {
      return {
        loadRounds: 0,
        messageCount: 0,
        reachedStableEnd: false,
        stopReason: "missing-container"
      };
    }

    let previousCount = getAlibabaMessageCount();
    let stableRounds = 0;
    let stopReason = "not-started";
    let loadRounds = 0;

    for (let round = 1; round <= ALIBABA_HISTORY_MAX_ROUNDS; round += 1) {
      const previousHeight = container.scrollHeight;

      loadRounds = round;
      scrollAlibabaChatToTop(container);
      await waitForAlibabaHistoryChange(previousCount, previousHeight);
      await wait(80);

      const currentCount = getAlibabaMessageCount();
      const decision = YingdanInquiryAnalyzer.shouldContinueAlibabaHistoryLoad({
        previousCount,
        currentCount,
        stableRounds,
        round,
        maxRounds: ALIBABA_HISTORY_MAX_ROUNDS,
        stableRoundLimit: ALIBABA_HISTORY_STABLE_ROUNDS,
        maxMessages: ALIBABA_HISTORY_MAX_MESSAGES
      });

      stableRounds = decision.nextStableRounds;
      stopReason = decision.reason;

      if (typeof onProgress === "function") {
        onProgress({
          messageCount: currentCount,
          reason: stopReason,
          round
        });
      }

      if (!decision.shouldContinue) {
        break;
      }

      previousCount = currentCount;
    }

    return {
      loadRounds,
      messageCount: getAlibabaMessageCount(),
      reachedStableEnd: stopReason === "stable",
      stopReason
    };
  }

  /**
   * 从一段文本里提取国际站时间字符串。
   *
   * @param {string} value - 包含时间和可能的客户名的文本。
   * @returns {string} 形如 `2026-06-24 18:59` 的时间；找不到时返回空字符串。
   * @throws {Error} 本函数不主动抛异常。
   */
  function extractAlibabaTime(value) {
    const match = String(value || "").match(/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/);
    return match ? match[0] : "";
  }

  /**
   * 从国际站消息基础信息里提取客户名。
   *
   * @param {string} baseText - `.item-base-info` 文本。
   * @param {"buyer" | "seller" | "unknown"} role - 消息方向。
   * @returns {string} 客户名或我方标识。
   * @throws {Error} 本函数不主动抛异常。
   */
  function extractAlibabaSender(baseText, role) {
    if (role !== "buyer") {
      return "我方";
    }

    const time = extractAlibabaTime(baseText);

    if (!time) {
      return "";
    }

    return YingdanInquiryAnalyzer.normalizeText(baseText.replace(time, ""));
  }

  /**
   * 读取指定子节点的可见文本。
   *
   * @param {Element} root - 查询起点。
   * @param {string} selector - 子节点选择器。
   * @returns {string} 归一化后的文本。
   * @throws {Error} 本函数不主动抛异常。
   */
  function getChildText(root, selector) {
    const node = root.querySelector(selector);
    return YingdanInquiryAnalyzer.normalizeText(node ? node.innerText || node.textContent || "" : "");
  }

  /**
   * 从国际站消息节点中提取原文。
   *
   * @param {Element} item - `.message-item-wrapper` 消息节点。
   * @returns {string} 消息原文、文件名或兜底文本。
   * @throws {Error} 本函数不主动抛异常。
   */
  function extractAlibabaOriginalText(item) {
    const directText = getChildText(item, ".session-rich-content.text");

    if (directText) {
      return directText;
    }

    const userContent = item.querySelector(".user-content");

    if (!userContent) {
      return "";
    }

    const clone = userContent.cloneNode(true);
    clone.querySelectorAll(".session-avatar, .session-translate, .message-flow-menu-box, .item-base-info").forEach((node) => {
      node.remove();
    });

    return YingdanInquiryAnalyzer.normalizeText(clone.innerText || clone.textContent || "");
  }

  /**
   * 抽取当前已加载的国际站聊天消息。
   *
   * @returns {Array<{ role: "buyer" | "seller" | "unknown", sender: string, time: string, original: string, translated: string }>} 消息记录，顺序保持国际站 DOM 的最新到最早。
   * @throws {Error} 本函数不主动抛异常。
   */
  function extractAlibabaChatRecords() {
    const seen = new Set();

    return Array.from(document.querySelectorAll(ALIBABA_MESSAGE_SELECTOR)).map((item) => {
      const className = typeof item.className === "string" ? item.className : "";
      const role = className.includes("item-left")
        ? "buyer"
        : className.includes("item-right")
          ? "seller"
          : "unknown";
      const baseText = getChildText(item, ".item-base-info");
      const original = extractAlibabaOriginalText(item);
      const translated = getChildText(item, ".target-content");
      const record = {
        role,
        sender: extractAlibabaSender(baseText, role),
        time: extractAlibabaTime(baseText),
        original,
        translated
      };
      const key = [record.role, record.sender, record.time, record.original, record.translated].join("|");

      if (!YingdanInquiryAnalyzer.normalizeText(record.original || record.translated) || seen.has(key)) {
        return null;
      }

      seen.add(key);
      return record;
    }).filter(Boolean);
  }

  /**
   * 回溯并格式化国际站聊天记录。
   *
   * @param {(state: { round: number, messageCount: number, reason?: string }) => void} [onProgress] - 加载进度回调。
   * @returns {Promise<{ text: string, messageCount: number, loadRounds: number, reachedStableEnd: boolean, stopReason: string } | null>} 抽取结果。
   * @throws {Error} 本函数内部捕获异常，失败时返回 null。
   */
  async function captureAlibabaInquiryChat(onProgress) {
    if (!isAlibabaInquiryDetailPage()) {
      return null;
    }

    try {
      const loadResult = await loadAlibabaChatHistory(onProgress);
      const records = extractAlibabaChatRecords();
      const text = YingdanInquiryAnalyzer.formatAlibabaChatRecords(records, {
        loadRounds: loadResult.loadRounds,
        reachedStableEnd: loadResult.reachedStableEnd,
        sourceTitle: document.title || "Alibaba 国际站询盘详情",
        sourceUrl: window.location.href
      });

      return {
        loadRounds: loadResult.loadRounds,
        messageCount: records.length,
        reachedStableEnd: loadResult.reachedStableEnd,
        stopReason: loadResult.stopReason,
        text: limitText(text, MAX_PAGE_TEXT_LENGTH)
      };
    } catch (error) {
      console.warn("[赢单插件] 回溯国际站聊天记录失败：", error);
      return null;
    }
  }

  /**
   * 获取当前页面被用户选中的文字。
   *
   * @returns {string} 页面选中文本。
   * @throws {Error} 某些页面禁止读取 selection 时返回空字符串。
   */
  function getSelectedText() {
    try {
      return limitText(window.getSelection().toString(), MAX_PAGE_TEXT_LENGTH);
    } catch (error) {
      console.warn("[赢单插件] 读取选中文本失败：", error);
      return "";
    }
  }

  /**
   * 从页面表单或正文中提取可能的询盘内容。
   *
   * 为什么优先看 textarea/contenteditable：
   * - 询盘或聊天页通常把客户原话放在输入框、聊天区或可复制区域。
   * - 直接读 body 会混入大量导航和菜单，所以先找更像业务文本的区域。
   *
   * @returns {string} 页面中最像询盘的文本。
   * @throws {Error} 本函数内部捕获异常，失败时返回空字符串。
   */
  function getBestPageInquiryText() {
    try {
      const formCandidates = Array.from(document.querySelectorAll("textarea, input[type='text'], [contenteditable='true']"))
        .map((node) => node.value || node.innerText || node.textContent || "")
        .map((text) => YingdanInquiryAnalyzer.normalizeText(text))
        .filter((text) => text.length >= 20)
        .sort((a, b) => b.length - a.length);

      if (formCandidates.length > 0) {
        return limitText(formCandidates[0], MAX_PAGE_TEXT_LENGTH);
      }

      const textBlocks = Array.from(document.querySelectorAll("main, article, section, [role='main'], body"))
        .map((node) => node.innerText || node.textContent || "")
        .map((text) => YingdanInquiryAnalyzer.normalizeText(text))
        .filter((text) => text.length >= 40)
        .sort((a, b) => b.length - a.length);

      return limitText(textBlocks[0] || "", MAX_PAGE_TEXT_LENGTH);
    } catch (error) {
      console.warn("[赢单插件] 读取页面正文失败：", error);
      return "";
    }
  }

  /**
   * 异步提取页面询盘内容。
   *
   * 为什么需要异步版本：
   * - 国际站聊天历史需要多轮向上滚动和等待懒加载。
   * - 普通网页仍走原来的同步正文提取，避免影响其他站点。
   *
   * @param {(state: { round: number, messageCount: number, reason?: string }) => void} [onProgress] - 国际站历史加载进度回调。
   * @returns {Promise<{ pageText: string, captureMeta: null | { messageCount: number, loadRounds: number, reachedStableEnd: boolean, stopReason: string } }>} 页面文本和抽取元信息。
   * @throws {Error} 本函数不主动抛异常。
   */
  async function getBestPageInquiryTextAsync(onProgress) {
    const alibabaCapture = await captureAlibabaInquiryChat(onProgress);

    if (alibabaCapture && alibabaCapture.text) {
      return {
        captureMeta: {
          loadRounds: alibabaCapture.loadRounds,
          messageCount: alibabaCapture.messageCount,
          reachedStableEnd: alibabaCapture.reachedStableEnd,
          stopReason: alibabaCapture.stopReason
        },
        pageText: alibabaCapture.text
      };
    }

    return {
      captureMeta: null,
      pageText: getBestPageInquiryText()
    };
  }

  /**
   * 获取当前页面上下文。
   *
   * @returns {{ selectedText: string, pageText: string, pageTitle: string, pageUrl: string }} 页面上下文。
   * @throws {Error} 本函数不主动抛异常。
   */
  function getPageContext() {
    return {
      selectedText: getSelectedText(),
      pageText: getBestPageInquiryText(),
      pageTitle: document.title || "",
      pageUrl: window.location.href
    };
  }

  /**
   * 异步获取当前页面上下文。
   *
   * @param {(state: { round: number, messageCount: number, reason?: string }) => void} [onProgress] - 国际站历史加载进度回调。
   * @returns {Promise<{ selectedText: string, pageText: string, pageTitle: string, pageUrl: string, captureMeta: null | { messageCount: number, loadRounds: number, reachedStableEnd: boolean, stopReason: string } }>} 页面上下文。
   * @throws {Error} 本函数不主动抛异常。
   */
  async function getPageContextAsync(onProgress) {
    const selectedText = getSelectedText();
    const asyncPageText = selectedText
      ? { captureMeta: null, pageText: getBestPageInquiryText() }
      : await getBestPageInquiryTextAsync(onProgress);

    return {
      captureMeta: asyncPageText.captureMeta,
      pageText: asyncPageText.pageText,
      pageTitle: document.title || "",
      pageUrl: window.location.href,
      selectedText
    };
  }

  /**
   * 生成安全 HTML 文本。
   *
   * @param {string} value - 原始文本。
   * @returns {string} 转义后的 HTML。
   * @throws {Error} 本函数不主动抛异常。
   */
  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /**
   * 把多行纯文本渲染为安全 HTML。
   *
   * @param {string} value - Coze 返回或用户输入的文本。
   * @returns {string} 保留换行后的安全 HTML。
   * @throws {Error} 本函数不主动抛异常。
   */
  function renderMultilineText(value) {
    return escapeHtml(value).replace(/\n/g, "<br />");
  }

  /**
   * 渲染 Markdown 行内语法。
   *
   * 为什么这里不直接使用 innerHTML：
   * - AI 返回内容来自外部接口，理论上可能包含 HTML 标签。
   * - 插件运行在用户当前网页里，必须先转义 HTML，再开放少量 Markdown 语法。
   * - 这样既能显示 `**粗体**`、链接和代码，又不会执行脚本或污染页面。
   *
   * @param {string} value - 单行 Markdown 文本。
   * @returns {string} 已转义并带有安全 Markdown 标签的 HTML。
   * @throws {Error} 本函数不主动抛异常。
   */
  function renderInlineMarkdown(value) {
    const segments = String(value || "").split(/(`[^`]*`)/g);

    return segments.map((segment) => {
      if (segment.startsWith("`") && segment.endsWith("`") && segment.length >= 2) {
        return `<code>${escapeHtml(segment.slice(1, -1))}</code>`;
      }

      let html = escapeHtml(segment);

      // 有些模型会把 Markdown 星号写成 \*\*xxx\*\*，这里先恢复常见转义，
      // 再按安全 Markdown 规则渲染，避免用户看到裸露的反斜杠和星号。
      html = html.replace(/\\([*_`[\]()])/g, "$1");
      html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label, href) => (
        `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`
      ));
      html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");
      html = html.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
      html = html.replace(/(^|[\s(])_([^_\n]+)_/g, "$1<em>$2</em>");

      return html;
    }).join("");
  }

  /**
   * 把 AI 返回的 Markdown 转成安全 HTML。
   *
   * 支持范围刻意控制在询盘分析最常见的结构：
   * - 标题：# / ## / ### / ####
   * - 列表：-、*、+、1.、1)
   * - 段落、引用、分割线、代码块
   * - 行内粗体、斜体、代码和 http/https 链接
   *
   * @param {string} value - AI 返回的 Markdown 文本。
   * @returns {string} 安全的 Markdown HTML。
   * @throws {Error} 本函数不主动抛异常。
   */
  function renderMarkdown(value) {
    const lines = String(value || "").replace(/\r\n/g, "\n").split("\n");
    const html = [];
    let paragraphLines = [];
    let activeListType = "";
    let inCodeBlock = false;
    let codeLines = [];

    /**
     * 结束当前段落。
     *
     * @returns {void}
     * @throws {Error} 本函数不主动抛异常。
     */
    function flushParagraph() {
      if (paragraphLines.length === 0) {
        return;
      }

      html.push(`<p>${paragraphLines.map(renderInlineMarkdown).join("<br />")}</p>`);
      paragraphLines = [];
    }

    /**
     * 结束当前列表。
     *
     * @returns {void}
     * @throws {Error} 本函数不主动抛异常。
     */
    function closeList() {
      if (!activeListType) {
        return;
      }

      html.push(`</${activeListType}>`);
      activeListType = "";
    }

    /**
     * 确保列表容器已打开。
     *
     * @param {"ul" | "ol"} type - 列表类型。
     * @returns {void}
     * @throws {Error} 本函数不主动抛异常。
     */
    function ensureList(type) {
      if (activeListType === type) {
        return;
      }

      closeList();
      html.push(`<${type}>`);
      activeListType = type;
    }

    /**
     * 结束当前代码块。
     *
     * @returns {void}
     * @throws {Error} 本函数不主动抛异常。
     */
    function flushCodeBlock() {
      html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      codeLines = [];
      inCodeBlock = false;
    }

    lines.forEach((line) => {
      const trimmed = line.trim();

      if (trimmed.startsWith("```")) {
        flushParagraph();
        closeList();

        if (inCodeBlock) {
          flushCodeBlock();
          return;
        }

        inCodeBlock = true;
        codeLines = [];
        return;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        return;
      }

      if (!trimmed) {
        flushParagraph();
        closeList();
        return;
      }

      const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
      const unorderedMatch = trimmed.match(/^[-*+]\s+(.+)$/);
      const orderedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
      const quoteMatch = trimmed.match(/^>\s?(.+)$/);

      if (/^-{3,}$/.test(trimmed)) {
        flushParagraph();
        closeList();
        html.push("<hr />");
        return;
      }

      if (headingMatch) {
        flushParagraph();
        closeList();
        const level = Math.min(4, headingMatch[1].length + 1);
        html.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
        return;
      }

      if (orderedMatch) {
        flushParagraph();
        ensureList("ol");
        html.push(`<li>${renderInlineMarkdown(orderedMatch[1])}</li>`);
        return;
      }

      if (unorderedMatch) {
        flushParagraph();
        ensureList("ul");
        html.push(`<li>${renderInlineMarkdown(unorderedMatch[1])}</li>`);
        return;
      }

      if (quoteMatch) {
        flushParagraph();
        closeList();
        html.push(`<blockquote>${renderInlineMarkdown(quoteMatch[1])}</blockquote>`);
        return;
      }

      closeList();
      paragraphLines.push(trimmed);
    });

    if (inCodeBlock) {
      flushCodeBlock();
    }

    flushParagraph();
    closeList();

    return `<div class="yd-markdown">${html.join("")}</div>`;
  }

  /**
   * 根据消息角色决定正文渲染方式。
   *
   * @param {"user" | "assistant" | "system"} role - 消息角色。
   * @param {string} text - 消息正文。
   * @param {boolean} loading - 是否是加载态。
   * @returns {string} 可写入气泡的安全 HTML。
   * @throws {Error} 本函数不主动抛异常。
   */
  function renderMessageBody(role, text, loading) {
    if (loading) {
      return `<span class="yd-loading">${renderMultilineText(text)}</span>`;
    }

    if (role === "assistant") {
      return renderMarkdown(text);
    }

    return `<span>${renderMultilineText(text)}</span>`;
  }

  /**
   * 生成适合展示在用户气泡里的短文本。
   *
   * @param {string} value - 用户问题或当前页面抓取文本。
   * @returns {string} 适合放进聊天气泡的文本。
   * @throws {Error} 本函数不主动抛异常。
   */
  function getVisibleUserText(value) {
    return limitText(value, MAX_VISIBLE_USER_TEXT_LENGTH);
  }

  /**
   * 调用后台脚本，请 Coze bot 生成真实回答。
   *
   * @param {{ inquiryText?: string, rawMessage?: string, pageTitle?: string, pageUrl?: string, resetConversation?: boolean }} payload - 询盘、追问和页面上下文。
   * @returns {Promise<Record<string, unknown>>} Coze 返回结果。
   * @throws {Error} 后台返回错误或通信失败时抛出错误。
   */
  async function requestCozeChat(payload) {
    const response = await chrome.runtime.sendMessage({
      type: "YD_COZE_CHAT",
      payload
    });

    if (!response || response.ok === false) {
      throw new Error((response && response.error) || "赢单 AI 暂时没有返回结果。");
    }

    return response;
  }

  /**
   * 创建或复用页面内聊天侧边栏。
   *
   * @returns {{ host: HTMLDivElement, root: ShadowRoot }} 面板宿主和 Shadow DOM。
   * @throws {Error} DOM 创建失败时由浏览器抛出异常。
   */
  function ensurePanel() {
    const existingHost = document.getElementById(PANEL_ID);

    if (existingHost && existingHost.shadowRoot) {
      return { host: existingHost, root: existingHost.shadowRoot };
    }

    const host = document.createElement("div");
    host.id = PANEL_ID;
    document.documentElement.appendChild(host);

    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          all: initial;
          color: #24211f;
          font-family: "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          letter-spacing: 0;
        }

        .yd-panel {
          position: fixed;
          top: 16px;
          right: 16px;
          z-index: 2147483647;
          display: grid;
          grid-template-rows: auto 1fr auto;
          width: min(440px, calc(100vw - 32px));
          height: min(720px, calc(100vh - 32px));
          overflow: hidden;
          border: 1px solid #f0e5dc;
          border-radius: 10px;
          background: #fffdf9;
          box-shadow: 0 24px 60px rgba(92, 57, 28, 0.22);
        }

        .yd-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 16px;
          border-bottom: 1px solid #f0e5dc;
          background: #fff7f0;
        }

        .yd-title {
          display: grid;
          gap: 3px;
          min-width: 0;
        }

        .yd-title strong {
          font-size: 16px;
          line-height: 1.2;
        }

        .yd-title span {
          max-width: 330px;
          overflow: hidden;
          color: #746d67;
          font-size: 12px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .yd-close {
          display: grid;
          flex: 0 0 auto;
          place-items: center;
          width: 32px;
          height: 32px;
          border: 0;
          border-radius: 8px;
          color: #746d67;
          background: transparent;
          font: inherit;
          cursor: pointer;
        }

        .yd-close:hover {
          color: #e65000;
          background: rgba(255, 92, 0, 0.1);
        }

        .yd-chat {
          display: grid;
          align-content: start;
          gap: 12px;
          min-height: 0;
          overflow: auto;
          padding: 14px 16px 18px;
          background: #fffdf9;
        }

        .yd-message {
          display: grid;
          gap: 6px;
          max-width: 92%;
        }

        .yd-message[data-role="user"] {
          justify-self: end;
        }

        .yd-message[data-role="assistant"],
        .yd-message[data-role="system"] {
          justify-self: start;
        }

        .yd-bubble {
          border: 1px solid #f0e5dc;
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 13px;
          line-height: 1.65;
          white-space: normal;
        }

        .yd-message[data-role="user"] .yd-bubble {
          color: #ffffff;
          border-color: #ff5c00;
          background: #ff5c00;
        }

        .yd-message[data-role="assistant"] .yd-bubble {
          color: #2e2925;
          background: #ffffff;
        }

        .yd-markdown {
          display: grid;
          gap: 8px;
        }

        .yd-markdown :is(h2, h3, h4, p, ul, ol, blockquote, pre) {
          margin: 0;
        }

        .yd-markdown h2,
        .yd-markdown h3,
        .yd-markdown h4 {
          color: #241f1b;
          font-weight: 800;
          line-height: 1.35;
        }

        .yd-markdown h2 {
          margin-top: 2px;
          font-size: 15px;
        }

        .yd-markdown h3 {
          margin-top: 2px;
          font-size: 14px;
        }

        .yd-markdown h4 {
          font-size: 13px;
        }

        .yd-markdown ul,
        .yd-markdown ol {
          display: grid;
          gap: 4px;
          padding-left: 20px;
        }

        .yd-markdown li {
          padding-left: 2px;
        }

        .yd-markdown strong {
          font-weight: 800;
        }

        .yd-markdown em {
          font-style: italic;
        }

        .yd-markdown code {
          border-radius: 5px;
          padding: 1px 5px;
          color: #7a2d00;
          background: #fff0e6;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 12px;
        }

        .yd-markdown pre {
          overflow: auto;
          border-radius: 8px;
          padding: 10px;
          color: #fff9f2;
          background: #2d2723;
          white-space: pre-wrap;
        }

        .yd-markdown pre code {
          padding: 0;
          color: inherit;
          background: transparent;
        }

        .yd-markdown blockquote {
          border-left: 3px solid #ff7a1a;
          padding-left: 10px;
          color: #5d534b;
          background: #fff8f2;
        }

        .yd-markdown hr {
          width: 100%;
          height: 1px;
          border: 0;
          background: #f0e5dc;
        }

        .yd-markdown a {
          color: #e65000;
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .yd-message[data-role="system"] .yd-bubble {
          color: #746d67;
          background: #ffffff;
        }

        .yd-message-label {
          color: #8a8179;
          font-size: 11px;
        }

        .yd-message[data-role="user"] .yd-message-label {
          text-align: right;
        }

        .yd-loading {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .yd-loading::after {
          content: "";
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: #ff5c00;
          animation: yd-pulse 900ms infinite ease-in-out;
        }

        @keyframes yd-pulse {
          0%, 100% { opacity: 0.25; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.15); }
        }

        .yd-follow-row {
          display: grid;
          gap: 6px;
          margin-top: 8px;
        }

        .yd-follow-row button {
          border: 1px solid #f0e5dc;
          border-radius: 8px;
          padding: 8px;
          color: #4a3d35;
          background: #fffdf9;
          font: inherit;
          font-size: 12px;
          line-height: 1.4;
          text-align: left;
          cursor: pointer;
        }

        .yd-follow-row button:hover {
          border-color: #ff5c00;
          background: #fff0e6;
        }

        .yd-start-card {
          display: grid;
          gap: 10px;
          width: 100%;
          border: 1px solid #f0e5dc;
          border-radius: 10px;
          padding: 12px;
          background: #ffffff;
          box-sizing: border-box;
        }

        .yd-start-title {
          color: #241f1b;
          font-size: 14px;
          font-weight: 800;
          line-height: 1.35;
        }

        .yd-start-meta {
          color: #746d67;
          font-size: 12px;
          line-height: 1.5;
        }

        .yd-start-preview {
          overflow: hidden;
          border-radius: 8px;
          padding: 10px;
          color: #3d342d;
          background: #fff8f2;
          font-size: 12px;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .yd-start-actions {
          display: flex;
          justify-content: flex-end;
        }

        .yd-start {
          min-width: 104px;
          min-height: 38px;
          border: 0;
          border-radius: 10px;
          color: #ffffff;
          background: #ff5c00;
          font: inherit;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
        }

        .yd-start:disabled {
          cursor: not-allowed;
          opacity: 0.48;
        }

        .yd-composer {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
          align-items: end;
          padding: 12px 16px 14px;
          border-top: 1px solid #f0e5dc;
          background: #ffffff;
        }

        .yd-input {
          min-height: 42px;
          max-height: 120px;
          width: 100%;
          border: 1px solid #ead5c5;
          border-radius: 10px;
          padding: 10px;
          color: #24211f;
          background: #fffdf9;
          font: inherit;
          font-size: 13px;
          line-height: 1.5;
          outline: none;
          resize: vertical;
        }

        .yd-input:focus {
          border-color: #ff5c00;
          box-shadow: 0 0 0 3px rgba(255, 92, 0, 0.12);
        }

        .yd-send {
          display: grid;
          place-items: center;
          min-width: 64px;
          min-height: 42px;
          border: 0;
          border-radius: 10px;
          color: #ffffff;
          background: #ff5c00;
          font: inherit;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .yd-send:disabled {
          cursor: wait;
          opacity: 0.62;
        }

        @media (max-width: 520px) {
          .yd-panel {
            inset: 8px;
            width: auto;
            height: auto;
            max-height: calc(100vh - 16px);
          }
        }
      </style>
      <aside class="yd-panel" role="dialog" aria-label="赢单询盘分析">
        <header class="yd-header">
          <div class="yd-title">
            <strong>赢单询盘分析</strong>
            <span data-yd-source>当前页面</span>
          </div>
          <button class="yd-close" type="button" title="关闭" data-yd-close>×</button>
        </header>
        <section class="yd-chat" data-yd-chat aria-live="polite"></section>
        <section class="yd-composer">
          <textarea class="yd-input" data-yd-input placeholder="继续追问，例如：帮我生成英文回复"></textarea>
          <button class="yd-send" type="button" data-yd-send>发送</button>
        </section>
      </aside>
    `;

    bindPanelEvents(root, host);
    return { host, root };
  }

  /**
   * 绑定聊天侧边栏内的事件。
   *
   * @param {ShadowRoot} root - 面板 Shadow DOM。
   * @param {HTMLDivElement} host - 面板宿主元素。
   * @returns {void}
   * @throws {Error} 本函数不主动抛异常。
   */
  function bindPanelEvents(root, host) {
    root.querySelector("[data-yd-close]").addEventListener("click", () => {
      host.remove();
      console.log("[赢单插件] 询盘分析面板已关闭。");
    });

    root.querySelector("[data-yd-send]").addEventListener("click", () => {
      sendComposerMessage(root);
    });

    root.querySelector("[data-yd-input]").addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendComposerMessage(root);
      }
    });

    root.addEventListener("click", (event) => {
      const target = event.target;

      if (target && target.matches("[data-yd-start-analysis]")) {
        startPendingAnalysis(root);
        return;
      }

      if (!target || !target.matches("[data-yd-follow-up]")) {
        return;
      }

      sendChatMessage(root, {
        rawMessage: target.getAttribute("data-yd-follow-up") || "",
        visibleText: target.textContent || "继续追问"
      });
    });
  }

  /**
   * 清空聊天区并展示“开始分析”确认卡片。
   *
   * 为什么点击插件后不直接请求 AI：
   * - 用户可能只想先打开侧边栏看看抓到的内容。
   * - 当前网页正文可能很长或包含无关内容，先确认能减少误发。
   * - 这也符合用户要求：点击图标只打开侧边栏，按钮确认后才分析。
   *
   * @param {ShadowRoot} root - 面板 Shadow DOM。
   * @param {{ inquiryText: string, visibleText: string, pageTitle: string, pageUrl: string, resetConversation: boolean }} payload - 待分析内容。
   * @returns {void}
   * @throws {Error} DOM 写入失败时由浏览器抛出异常。
   */
  function showStartAnalysisCard(root, payload) {
    const chat = root.querySelector("[data-yd-chat]");
    const hasInquiryText = Boolean(payload.inquiryText);
    const captureMeta = payload.captureMeta || null;
    const startTitle = captureMeta && captureMeta.messageCount
      ? `已抓取国际站聊天记录（${captureMeta.messageCount} 条）`
      : hasInquiryText
        ? "已抓取当前页面内容"
        : "未抓到可分析内容";
    const startMeta = captureMeta && captureMeta.loadRounds
      ? `${payload.pageTitle || "当前页面"} · 已回溯 ${captureMeta.loadRounds} 轮`
      : payload.pageTitle || "当前页面";
    const previewText = hasInquiryText
      ? limitText(payload.inquiryText, MAX_START_PREVIEW_LENGTH)
      : "当前页面没有抓到可分析的询盘内容。你可以在底部输入框粘贴客户原话后发送。";

    pendingAnalysisByRoot.set(root, payload);
    chat.innerHTML = "";

    const card = document.createElement("article");
    card.className = "yd-start-card";
    card.dataset.ydStartCard = "true";
    card.innerHTML = `
      <div class="yd-start-title">${escapeHtml(startTitle)}</div>
      <div class="yd-start-meta">${escapeHtml(startMeta)}</div>
      <div class="yd-start-preview">${renderMultilineText(previewText)}</div>
      <div class="yd-start-actions">
        <button class="yd-start" type="button" data-yd-start-analysis ${hasInquiryText ? "" : "disabled"}>开始分析</button>
      </div>
    `;

    chat.appendChild(card);
    chat.scrollTop = 0;
    root.querySelector("[data-yd-input]").disabled = false;
    root.querySelector("[data-yd-send]").disabled = false;
  }

  /**
   * 展示国际站聊天记录回溯中的加载卡片。
   *
   * @param {ShadowRoot} root - 面板 Shadow DOM。
   * @returns {void}
   * @throws {Error} DOM 写入失败时由浏览器抛出异常。
   */
  function showCaptureLoadingCard(root) {
    const chat = root.querySelector("[data-yd-chat]");

    chat.innerHTML = `
      <article class="yd-start-card" data-yd-capture-loading>
        <div class="yd-start-title">正在回溯国际站聊天记录...</div>
        <div class="yd-start-meta" data-yd-capture-progress>正在定位聊天区</div>
        <div class="yd-start-preview">正在向上加载历史消息，完成后再开始分析。</div>
      </article>
    `;
    root.querySelector("[data-yd-input]").disabled = true;
    root.querySelector("[data-yd-send]").disabled = true;
  }

  /**
   * 更新国际站聊天记录回溯进度。
   *
   * @param {ShadowRoot} root - 面板 Shadow DOM。
   * @param {{ round: number, messageCount: number }} state - 当前加载轮次和消息数。
   * @returns {void}
   * @throws {Error} 本函数不主动抛异常。
   */
  function updateCaptureLoadingCard(root, state) {
    const progress = root.querySelector("[data-yd-capture-progress]");

    if (!progress) {
      return;
    }

    progress.textContent = `已回溯 ${state.round} 轮，当前读取 ${state.messageCount} 条消息`;
  }

  /**
   * 用户点击“开始分析”后发送待分析内容。
   *
   * @param {ShadowRoot} root - 面板 Shadow DOM。
   * @returns {void}
   * @throws {Error} 本函数不主动抛异常；异常由 sendChatMessage 展示。
   */
  function startPendingAnalysis(root) {
    const payload = pendingAnalysisByRoot.get(root);

    if (!payload || !payload.inquiryText) {
      appendMessage(root, "system", "当前没有可分析的询盘内容，请在底部输入框粘贴客户原话。");
      return;
    }

    pendingAnalysisByRoot.delete(root);
    root.querySelector("[data-yd-chat]").innerHTML = "";
    sendChatMessage(root, payload);
  }

  /**
   * 把消息追加到聊天区域。
   *
   * @param {ShadowRoot} root - 面板 Shadow DOM。
   * @param {"user" | "assistant" | "system"} role - 消息角色。
   * @param {string} text - 消息正文。
   * @param {{ loading?: boolean, followUps?: string[] }} [options] - 加载态和追问建议。
   * @returns {HTMLElement} 新增的消息节点。
   * @throws {Error} DOM 写入失败时由浏览器抛出异常。
   */
  function appendMessage(root, role, text, options = {}) {
    const chat = root.querySelector("[data-yd-chat]");
    const message = document.createElement("article");
    message.className = "yd-message";
    message.dataset.role = role;

    const label = role === "user" ? "你" : role === "assistant" ? "赢单 AI" : "系统";
    const followUps = Array.isArray(options.followUps) ? options.followUps : [];

    message.innerHTML = `
      <div class="yd-message-label">${escapeHtml(label)}</div>
      <div class="yd-bubble">
        ${renderMessageBody(role, text, Boolean(options.loading))}
        ${followUps.length > 0 ? `
          <div class="yd-follow-row">
            ${followUps.map((item) => `<button type="button" data-yd-follow-up="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join("")}
          </div>
        ` : ""}
      </div>
    `;

    chat.appendChild(message);
    chat.scrollTop = chat.scrollHeight;
    return message;
  }

  /**
   * 更新已有消息节点。
   *
   * @param {HTMLElement} message - appendMessage 返回的消息节点。
   * @param {"assistant" | "system"} role - 更新后的角色。
   * @param {string} text - 新消息内容。
   * @param {string[]} [followUps] - 可继续追问的问题。
   * @returns {void}
   * @throws {Error} DOM 更新失败时由浏览器抛出异常。
   */
  function updateMessage(message, role, text, followUps = []) {
    message.dataset.role = role;
    const label = role === "assistant" ? "赢单 AI" : "系统";
    message.innerHTML = `
      <div class="yd-message-label">${escapeHtml(label)}</div>
      <div class="yd-bubble">
        ${renderMessageBody(role, text, false)}
        ${followUps.length > 0 ? `
          <div class="yd-follow-row">
            ${followUps.map((item) => `<button type="button" data-yd-follow-up="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join("")}
          </div>
        ` : ""}
      </div>
    `;
  }

  /**
   * 控制发送按钮和输入框的忙碌状态。
   *
   * @param {ShadowRoot} root - 面板 Shadow DOM。
   * @param {boolean} busy - 是否正在请求 AI。
   * @returns {void}
   * @throws {Error} DOM 更新失败时由浏览器抛出异常。
   */
  function setBusy(root, busy) {
    root.querySelector("[data-yd-send]").disabled = busy;
    root.querySelector("[data-yd-input]").disabled = busy;
  }

  /**
   * 发送聊天消息给 Coze。
   *
   * @param {ShadowRoot} root - 面板 Shadow DOM。
   * @param {{ inquiryText?: string, rawMessage?: string, visibleText: string, pageTitle?: string, pageUrl?: string, resetConversation?: boolean }} payload - 聊天请求。
   * @returns {Promise<void>} AI 回答完成后 resolve。
   * @throws {Error} 函数内部捕获错误并展示在聊天区。
   */
  async function sendChatMessage(root, payload) {
    const visibleText = getVisibleUserText(payload.visibleText || payload.rawMessage || payload.inquiryText || "");

    if (!visibleText) {
      appendMessage(root, "system", "当前页面没有抓到可分析的询盘内容，你可以在底部输入框直接粘贴客户原话。");
      return;
    }

    appendMessage(root, "user", visibleText);
    const loadingMessage = appendMessage(root, "assistant", "正在分析...", { loading: true });

    try {
      setBusy(root, true);
      const result = await requestCozeChat({
        inquiryText: payload.inquiryText,
        rawMessage: payload.rawMessage,
        pageTitle: payload.pageTitle || document.title || "",
        pageUrl: payload.pageUrl || window.location.href,
        resetConversation: Boolean(payload.resetConversation)
      });
      updateMessage(loadingMessage, "assistant", result.answer || "", result.followUps || []);
      console.log("[赢单插件] Coze 真实对话已完成。");
    } catch (error) {
      updateMessage(loadingMessage, "system", `分析失败：${error.message || String(error)}`);
      console.error("[赢单插件] Coze 对话失败：", error);
    } finally {
      setBusy(root, false);
      root.querySelector("[data-yd-input]").focus();
    }
  }

  /**
   * 发送底部输入框里的追问。
   *
   * @param {ShadowRoot} root - 面板 Shadow DOM。
   * @returns {void}
   * @throws {Error} 本函数不主动抛异常。
   */
  function sendComposerMessage(root) {
    const input = root.querySelector("[data-yd-input]");
    const text = YingdanInquiryAnalyzer.normalizeText(input.value);

    if (!text) {
      return;
    }

    input.value = "";
    sendChatMessage(root, {
      rawMessage: text,
      visibleText: text
    });
  }

  /**
   * 打开分析面板并等待用户点击“开始分析”。
   *
   * @param {{ inquiryText?: string, source?: string, pageTitle?: string, pageUrl?: string }} payload - 来自图标或右键菜单的上下文。
   * @returns {{ ok: boolean }} 打开结果。
   * @throws {Error} DOM 操作失败时由浏览器抛出异常。
   */
  async function openAnalyzer(payload) {
    const { root } = ensurePanel();
    const inquiryText = YingdanInquiryAnalyzer.normalizeText(payload && payload.inquiryText);
    const titleFromPayload = (payload && payload.pageTitle) || document.title || "当前页面";

    root.querySelector("[data-yd-source]").textContent = titleFromPayload;
    showCaptureLoadingCard(root);

    const context = await getPageContextAsync((state) => updateCaptureLoadingCard(root, state));
    const capturedText = inquiryText || context.selectedText || context.pageText;
    const title = (payload && payload.pageTitle) || context.pageTitle || "当前页面";

    root.querySelector("[data-yd-source]").textContent = title;
    showStartAnalysisCard(root, {
      captureMeta: context.captureMeta,
      inquiryText: capturedText,
      visibleText: capturedText ? `请分析当前页面内容：\n${capturedText}` : "",
      pageTitle: title,
      pageUrl: (payload && payload.pageUrl) || context.pageUrl,
      resetConversation: true
    });

    return { ok: true };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) {
      return false;
    }

    if (message.type === "YD_GET_PAGE_CONTEXT") {
      sendResponse({ ok: true, context: getPageContext() });
      return true;
    }

    if (message.type === "YD_OPEN_ANALYZER") {
      openAnalyzer(message.payload || {})
        .then((response) => sendResponse(response))
        .catch((error) => {
          console.error("[赢单插件] 打开分析面板失败：", error);
          sendResponse({
            error: error.message || String(error),
            ok: false
          });
        });
      return true;
    }

    return false;
  });

  console.log("[赢单插件] 内容脚本已就绪。");
})();
