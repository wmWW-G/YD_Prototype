/* global chrome, document, navigator, window, YingdanInquiryAnalyzer */

(function initYingdanContentScript() {
  const SCRIPT_VERSION = "2026-06-25-refetch-capture";

  if (window.__YINGDAN_INQUIRY_ASSISTANT_LOADED__ === SCRIPT_VERSION) {
    return;
  }

  window.__YINGDAN_INQUIRY_ASSISTANT_LOADED__ = SCRIPT_VERSION;

  const PANEL_ID = "yingdan-inquiry-analyzer-host";
  const MAX_PAGE_TEXT_LENGTH = 120000;
  const MAX_VISIBLE_USER_TEXT_LENGTH = 520;
  const MAX_START_PREVIEW_LENGTH = 360;
  const MAX_HISTORY_PREVIEW_LENGTH = 160;
  const MAX_ANALYSIS_HISTORY_RECORDS = 30;
  const YD_ANALYSIS_HISTORY_KEY = "yingdanAnalysisHistory";
  const ALIBABA_CHAT_CONTAINER_SELECTOR = ".common-load-more";
  const ALIBABA_MESSAGE_SELECTOR = ".common-load-more .message-item-wrapper";
  const ALIBABA_SEND_HEADER_MENU_SELECTOR = ".send-header-menu";
  const ALIBABA_HISTORY_MAX_ROUNDS = 100;
  const ALIBABA_HISTORY_STABLE_ROUNDS = 3;
  const ALIBABA_HISTORY_MAX_MESSAGES = 2000;
  const ALIBABA_HISTORY_WAIT_MS = 1800;
  const WHATSAPP_CHAT_CONTAINER_SELECTOR = "#main [data-testid='conversation-panel-messages'], #main [data-scrolltracepolicy='wa.web.conversation.messages']";
  const WHATSAPP_MESSAGE_SELECTOR = "#main [data-pre-plain-text]";
  const WHATSAPP_HISTORY_MAX_ROUNDS = 80;
  const WHATSAPP_HISTORY_STABLE_ROUNDS = 3;
  const WHATSAPP_HISTORY_MAX_MESSAGES = 3000;
  const WHATSAPP_HISTORY_WAIT_MS = 1400;
  const WHATSAPP_PHONE_HISTORY_WAIT_MS = 10000;
  const pendingAnalysisByRoot = new WeakMap();
  const currentConversationSnapshotByRoot = new WeakMap();

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
   * @param {{ isStopped?: () => boolean }} [captureControl] - 回溯停止控制器；用户点击停止时提前结束等待。
   * @returns {Promise<void>} 时间到后 resolve。
   * @throws {Error} 本函数不主动抛异常。
   */
  function wait(ms, captureControl) {
    if (!captureControl) {
      return new Promise((resolve) => window.setTimeout(resolve, ms));
    }

    return new Promise((resolve) => {
      const startTime = Date.now();
      const timerId = window.setInterval(() => {
        const timedOut = Date.now() - startTime >= ms;

        if (timedOut || isCaptureStopped(captureControl)) {
          window.clearInterval(timerId);
          resolve();
        }
      }, 80);
    });
  }

  /**
   * 创建聊天历史回溯的停止控制器。
   *
   * 为什么不用全局变量：
   * - 用户可能在不同页面多次打开插件面板。
   * - 每次回溯都应该有独立状态，避免上一次停止影响下一次分析。
   *
   * @returns {{ stop: () => void, isStopped: () => boolean }} 可停止当前回溯的控制器。
   * @throws {Error} 本函数不主动抛异常。
   */
  function createCaptureControl() {
    let stopped = false;

    return {
      isStopped() {
        return stopped;
      },
      stop() {
        stopped = true;
      }
    };
  }

  /**
   * 判断当前回溯是否已被用户手动停止。
   *
   * @param {{ isStopped?: () => boolean } | null | undefined} captureControl - 回溯停止控制器。
   * @returns {boolean} 已停止时返回 true。
   * @throws {Error} 控制器异常时按未停止处理。
   */
  function isCaptureStopped(captureControl) {
    try {
      return Boolean(captureControl && typeof captureControl.isStopped === "function" && captureControl.isStopped());
    } catch (error) {
      return false;
    }
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
   * 注入国际站聊天工具栏按钮样式。
   *
   * 为什么样式放在页面 DOM 而不是 Shadow DOM：
   * - 这两个按钮需要出现在国际站原页面的 `.send-header-menu` 里。
   * - Shadow DOM 里的样式无法影响页面正文里的按钮。
   *
   * @returns {void}
   * @throws {Error} DOM 写入失败时由浏览器抛出异常。
   */
  function ensureAlibabaToolbarStyle() {
    if (document.getElementById("yingdan-alibaba-toolbar-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "yingdan-alibaba-toolbar-style";
    style.textContent = `
      .yingdan-alibaba-toolbar-actions {
        display: inline-flex;
        gap: 10px;
        align-items: center;
        margin-left: 10px;
        vertical-align: top;
      }

      .yingdan-alibaba-toolbar-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 85px;
        height: 24px;
        border: 0;
        border-radius: 12px;
        padding: 0 14px;
        color: #241f1b;
        background: #ffffff;
        box-shadow: 0 1px 1px #ccc;
        font-family: "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
        font-size: 12px;
        line-height: 24px;
        cursor: pointer;
      }

      .yingdan-alibaba-toolbar-button:hover {
        color: #ff5c00;
        box-shadow: 0 1px 4px rgba(255, 92, 0, 0.28);
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * 处理国际站页面内的赢单快捷按钮点击。
   *
   * @param {"inquiry-analysis" | "customer-research"} action - 用户点击的快捷动作。
   * @returns {void}
   * @throws {Error} 本函数内部捕获并展示错误。
   */
  function handleInlineToolbarAction(action) {
    if (action === "inquiry-analysis") {
      openAnalyzer({
        pageTitle: document.title || "当前页面",
        pageUrl: window.location.href,
        source: "alibaba-toolbar"
      }).catch((error) => {
        console.error("[赢单插件] 打开询盘分析失败：", error);
      });
      return;
    }

    if (action === "customer-research") {
      openCustomerResearch({
        pageTitle: document.title || "当前页面",
        pageUrl: window.location.href,
        source: "alibaba-toolbar"
      });
    }
  }

  /**
   * 往国际站聊天输入区上方注入赢单快捷按钮。
   *
   * 为什么用独立容器：
   * - 不覆盖国际站原有“立即报价/音视频通话”。
   * - 也不影响其他插件已经注入的 iframe 按钮。
   *
   * @returns {void}
   * @throws {Error} 本函数内部捕获异常，失败时只打印日志。
   */
  function injectAlibabaToolbarActions() {
    if (!isAlibabaInquiryDetailPage()) {
      return;
    }

    try {
      const toolbar = document.querySelector(ALIBABA_SEND_HEADER_MENU_SELECTOR);

      if (!toolbar || toolbar.querySelector("[data-yd-alibaba-toolbar]")) {
        return;
      }

      ensureAlibabaToolbarStyle();

      const actions = document.createElement("span");
      actions.className = "yingdan-alibaba-toolbar-actions";
      actions.setAttribute("data-yd-alibaba-toolbar", "true");
      actions.innerHTML = `
        <button class="yingdan-alibaba-toolbar-button" type="button" data-yd-inline-action="inquiry-analysis">询盘分析</button>
        <button class="yingdan-alibaba-toolbar-button" type="button" data-yd-inline-action="customer-research">客户背调</button>
      `;
      actions.addEventListener("click", (event) => {
        const target = event.target;
        const button = target && typeof target.closest === "function"
          ? target.closest("[data-yd-inline-action]")
          : null;

        if (!button) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        handleInlineToolbarAction(button.getAttribute("data-yd-inline-action"));
      });

      toolbar.appendChild(actions);
    } catch (error) {
      console.warn("[赢单插件] 注入国际站快捷按钮失败：", error);
    }
  }

  /**
   * 持续观察国际站聊天工具栏，确保按钮在页面局部重渲染后还在。
   *
   * @returns {void}
   * @throws {Error} 本函数内部捕获异常。
   */
  function setupAlibabaToolbarActions() {
    if (!window.location.hostname.includes("alibaba.com")) {
      return;
    }

    injectAlibabaToolbarActions();

    try {
      const observer = new MutationObserver(() => {
        injectAlibabaToolbarActions();
      });
      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
      });
    } catch (error) {
      console.warn("[赢单插件] 监听国际站工具栏失败：", error);
    }
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
   * @param {{ isStopped?: () => boolean }} [captureControl] - 回溯停止控制器。
   * @returns {Promise<void>} 有变化或超时后 resolve。
   * @throws {Error} 本函数不主动抛异常。
   */
  function waitForAlibabaHistoryChange(previousCount, previousHeight, captureControl) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const timerId = window.setInterval(() => {
        const container = getAlibabaChatContainer();
        const currentCount = getAlibabaMessageCount();
        const currentHeight = container ? container.scrollHeight : 0;
        const changed = currentCount > previousCount || currentHeight > previousHeight;
        const timedOut = Date.now() - startTime >= ALIBABA_HISTORY_WAIT_MS;
        const stopped = isCaptureStopped(captureControl);

        if (changed || timedOut || stopped) {
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
   * @param {{ isStopped?: () => boolean }} [captureControl] - 回溯停止控制器。
   * @returns {Promise<{ loadRounds: number, messageCount: number, reachedStableEnd: boolean, stopReason: string }>} 加载结果。
   * @throws {Error} 本函数内部尽量降级，异常会被调用方捕获。
   */
  async function loadAlibabaChatHistory(onProgress, captureControl) {
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
      if (isCaptureStopped(captureControl)) {
        stopReason = "manual-stop";
        break;
      }

      const previousHeight = container.scrollHeight;

      loadRounds = round;
      scrollAlibabaChatToTop(container);
      await waitForAlibabaHistoryChange(previousCount, previousHeight, captureControl);
      await wait(80, captureControl);

      const currentCount = getAlibabaMessageCount();

      if (isCaptureStopped(captureControl)) {
        stopReason = "manual-stop";

        if (typeof onProgress === "function") {
          onProgress({
            messageCount: currentCount,
            reason: stopReason,
            round
          });
        }

        break;
      }

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
   * @param {{ isStopped?: () => boolean }} [captureControl] - 回溯停止控制器。
   * @returns {Promise<{ text: string, messageCount: number, loadRounds: number, reachedStableEnd: boolean, stopReason: string } | null>} 抽取结果。
   * @throws {Error} 本函数内部捕获异常，失败时返回 null。
   */
  async function captureAlibabaInquiryChat(onProgress, captureControl) {
    if (!isAlibabaInquiryDetailPage()) {
      return null;
    }

    try {
      const loadResult = await loadAlibabaChatHistory(onProgress, captureControl);
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
   * 判断当前页面是不是已经打开聊天的 WhatsApp Web 页面。
   *
   * @returns {boolean} 当前页面是 WhatsApp Web 且已存在聊天区时返回 true。
   * @throws {Error} 本函数不主动抛异常。
   */
  function isWhatsAppChatPage() {
    return window.location.hostname === "web.whatsapp.com"
      && Boolean(document.querySelector(WHATSAPP_CHAT_CONTAINER_SELECTOR))
      && Boolean(document.querySelector(WHATSAPP_MESSAGE_SELECTOR));
  }

  /**
   * 获取 WhatsApp Web 当前聊天的消息滚动容器。
   *
   * @returns {HTMLElement | null} 聊天滚动容器；找不到时返回 null。
   * @throws {Error} 本函数不主动抛异常。
   */
  function getWhatsAppChatContainer() {
    return document.querySelector(WHATSAPP_CHAT_CONTAINER_SELECTOR);
  }

  /**
   * 统计当前 WhatsApp DOM 里已经渲染出来的消息条数。
   *
   * @returns {number} 当前可读取的 WhatsApp 消息条数。
   * @throws {Error} 本函数不主动抛异常。
   */
  function getWhatsAppMessageCount() {
    return document.querySelectorAll(WHATSAPP_MESSAGE_SELECTOR).length;
  }

  /**
   * 等待 WhatsApp 历史消息加载发生变化。
   *
   * @param {number} previousCount - 滚动前消息条数。
   * @param {number} previousHeight - 滚动前容器内容高度。
   * @param {number} [timeoutMs=WHATSAPP_HISTORY_WAIT_MS] - 最长等待毫秒数；点手机旧消息按钮后需要更久。
   * @param {{ isStopped?: () => boolean }} [captureControl] - 回溯停止控制器。
   * @returns {Promise<void>} 有变化或超时后 resolve。
   * @throws {Error} 本函数不主动抛异常。
   */
  function waitForWhatsAppHistoryChange(previousCount, previousHeight, timeoutMs = WHATSAPP_HISTORY_WAIT_MS, captureControl) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const timerId = window.setInterval(() => {
        const container = getWhatsAppChatContainer();
        const currentCount = getWhatsAppMessageCount();
        const currentHeight = container ? container.scrollHeight : 0;
        const changed = currentCount > previousCount || currentHeight > previousHeight;
        const timedOut = Date.now() - startTime >= timeoutMs;
        const stopped = isCaptureStopped(captureControl);

        if (changed || timedOut || stopped) {
          window.clearInterval(timerId);
          resolve();
        }
      }, 120);
    });
  }

  /**
   * 把 WhatsApp 聊天容器滚到顶部以触发更早消息加载。
   *
   * @param {HTMLElement} container - WhatsApp 聊天滚动容器。
   * @returns {void}
   * @throws {Error} DOM 滚动异常时由浏览器抛出。
   */
  function scrollWhatsAppChatToTop(container) {
    container.scrollTop = 0;
    container.dispatchEvent(new Event("scroll", { bubbles: true }));
    container.dispatchEvent(new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: -6000
    }));
  }

  /**
   * 点击 WhatsApp Web 顶部的“从手机获取更早消息”按钮。
   *
   * 为什么要单独处理：
   * - WhatsApp 有些旧聊天不会因滚动直接回填历史。
   * - 页面会出现 `Click here to get older messages from your phone.` 按钮，需要先点它向手机端请求旧消息。
   * - 点击后消息回填比普通懒加载慢，所以调用方会使用更长的等待时间。
   *
   * @returns {boolean} 找到并点击按钮时返回 true；找不到或不可点击时返回 false。
   * @throws {Error} 本函数内部捕获异常，失败时返回 false。
   */
  function clickWhatsAppOlderMessagesButton() {
    try {
      const container = getWhatsAppChatContainer();

      if (!container) {
        return false;
      }

      const olderMessagesButton = Array.from(container.querySelectorAll("button, [role='button']")).find((node) => {
        const text = YingdanInquiryAnalyzer.normalizeText(node.innerText || node.textContent || "").toLowerCase();
        return text.includes("older messages from your phone");
      });

      if (!olderMessagesButton || typeof olderMessagesButton.click !== "function") {
        return false;
      }

      olderMessagesButton.click();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 回溯加载 WhatsApp 当前聊天历史。
   *
   * @param {(state: { round: number, messageCount: number, reason?: string }) => void} [onProgress] - 加载进度回调。
   * @param {{ isStopped?: () => boolean }} [captureControl] - 回溯停止控制器。
   * @returns {Promise<{ loadRounds: number, messageCount: number, reachedStableEnd: boolean, stopReason: string }>} 加载结果。
   * @throws {Error} 本函数内部尽量降级，异常会被调用方捕获。
   */
  async function loadWhatsAppChatHistory(onProgress, captureControl) {
    const container = getWhatsAppChatContainer();

    if (!container) {
      return {
        loadRounds: 0,
        messageCount: 0,
        reachedStableEnd: false,
        stopReason: "missing-container"
      };
    }

    let previousCount = getWhatsAppMessageCount();
    let stableRounds = 0;
    let stopReason = "not-started";
    let loadRounds = 0;

    for (let round = 1; round <= WHATSAPP_HISTORY_MAX_ROUNDS; round += 1) {
      if (isCaptureStopped(captureControl)) {
        stopReason = "manual-stop";
        break;
      }

      const previousHeight = container.scrollHeight;

      loadRounds = round;
      const clickedOlderButton = clickWhatsAppOlderMessagesButton();

      if (clickedOlderButton) {
        await waitForWhatsAppHistoryChange(previousCount, previousHeight, WHATSAPP_PHONE_HISTORY_WAIT_MS, captureControl);
        await wait(300, captureControl);
      }

      scrollWhatsAppChatToTop(container);
      await waitForWhatsAppHistoryChange(previousCount, previousHeight, WHATSAPP_HISTORY_WAIT_MS, captureControl);
      await wait(80, captureControl);

      const currentCount = getWhatsAppMessageCount();

      if (isCaptureStopped(captureControl)) {
        stopReason = "manual-stop";

        if (typeof onProgress === "function") {
          onProgress({
            messageCount: currentCount,
            reason: stopReason,
            round
          });
        }

        break;
      }

      const decision = YingdanInquiryAnalyzer.shouldContinueAlibabaHistoryLoad({
        previousCount,
        currentCount,
        stableRounds,
        round,
        maxRounds: WHATSAPP_HISTORY_MAX_ROUNDS,
        stableRoundLimit: WHATSAPP_HISTORY_STABLE_ROUNDS,
        maxMessages: WHATSAPP_HISTORY_MAX_MESSAGES
      });

      stableRounds = decision.nextStableRounds;
      stopReason = decision.reason;

      if (typeof onProgress === "function") {
        onProgress({
          messageCount: currentCount,
          reason: clickedOlderButton ? "phone-history-requested" : stopReason,
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
      messageCount: getWhatsAppMessageCount(),
      reachedStableEnd: stopReason === "stable",
      stopReason
    };
  }

  /**
   * 解析 WhatsApp 的 `data-pre-plain-text` 头信息。
   *
   * @param {string} value - 形如 `[11:46 PM, 11/25/2025] Sender: ` 的文本。
   * @returns {{ time: string, sender: string }} 时间和发送方。
   * @throws {Error} 本函数不主动抛异常。
   */
  function parseWhatsAppPrePlainText(value) {
    const match = String(value || "").match(/^\[([^\]]+)\]\s*(.*?):\s*$/);

    if (!match) {
      return {
        sender: "",
        time: ""
      };
    }

    return {
      sender: YingdanInquiryAnalyzer.normalizeText(match[2]),
      time: YingdanInquiryAnalyzer.normalizeText(match[1])
    };
  }

  /**
   * 通过气泡位置判断 WhatsApp 消息方向。
   *
   * 为什么用位置：
   * - WhatsApp Web 的 class 名经常混淆变化。
   * - 当前实测入站消息靠左，我方消息靠右，这个视觉规则更稳定。
   *
   * @param {Element} node - 带 `data-pre-plain-text` 的消息节点。
   * @returns {"buyer" | "seller" | "unknown"} 消息方向。
   * @throws {Error} 读取布局异常时返回 unknown。
   */
  function getWhatsAppMessageRole(node) {
    try {
      const container = getWhatsAppChatContainer();
      const messageContainer = node.closest("[data-testid='msg-container']") || node;

      if (!container || !messageContainer.getBoundingClientRect) {
        return "unknown";
      }

      const containerRect = container.getBoundingClientRect();
      const messageRect = messageContainer.getBoundingClientRect();
      const containerMidX = containerRect.left + (containerRect.width / 2);
      const messageMidX = messageRect.left + (messageRect.width / 2);

      return messageMidX >= containerMidX ? "seller" : "buyer";
    } catch (error) {
      return "unknown";
    }
  }

  /**
   * 提取 WhatsApp 单条消息正文。
   *
   * @param {Element} node - 带 `data-pre-plain-text` 的消息节点。
   * @returns {string} 消息正文；媒体消息返回占位说明。
   * @throws {Error} 本函数不主动抛异常。
   */
  function extractWhatsAppMessageText(node) {
    const selectableText = getChildText(node, ".selectable-text");

    if (selectableText) {
      return selectableText;
    }

    const mediaCount = node.querySelectorAll("img, video, audio").length;

    if (mediaCount > 0) {
      return `[图片/附件消息，包含 ${mediaCount} 个媒体元素]`;
    }

    return YingdanInquiryAnalyzer.normalizeText(node.innerText || node.textContent || "");
  }

  /**
   * 抽取当前已加载的 WhatsApp 聊天消息。
   *
   * @returns {Array<{ role: "buyer" | "seller" | "unknown", sender: string, time: string, original: string }>} WhatsApp 消息记录，顺序保持屏幕从上到下。
   * @throws {Error} 本函数不主动抛异常。
   */
  function extractWhatsAppChatRecords() {
    return Array.from(document.querySelectorAll(WHATSAPP_MESSAGE_SELECTOR)).map((node) => {
      const meta = parseWhatsAppPrePlainText(node.getAttribute("data-pre-plain-text"));
      const role = getWhatsAppMessageRole(node);
      const original = extractWhatsAppMessageText(node);

      if (!YingdanInquiryAnalyzer.normalizeText(original)) {
        return null;
      }

      return {
        role,
        sender: role === "seller" ? "我方" : meta.sender,
        time: meta.time,
        original
      };
    }).filter(Boolean);
  }

  /**
   * 回溯并格式化 WhatsApp 当前聊天记录。
   *
   * @param {(state: { round: number, messageCount: number, reason?: string }) => void} [onProgress] - 加载进度回调。
   * @param {{ isStopped?: () => boolean }} [captureControl] - 回溯停止控制器。
   * @returns {Promise<{ text: string, messageCount: number, loadRounds: number, reachedStableEnd: boolean, stopReason: string, platformName: string } | null>} 抽取结果。
   * @throws {Error} 本函数内部捕获异常，失败时返回 null。
   */
  async function captureWhatsAppChat(onProgress, captureControl) {
    if (!isWhatsAppChatPage()) {
      return null;
    }

    try {
      const loadResult = await loadWhatsAppChatHistory(onProgress, captureControl);
      const records = extractWhatsAppChatRecords();
      const text = YingdanInquiryAnalyzer.formatWhatsAppChatRecords(records, {
        loadRounds: loadResult.loadRounds,
        reachedStableEnd: loadResult.reachedStableEnd,
        sourceTitle: document.title || "WhatsApp Web",
        sourceUrl: window.location.href
      });

      return {
        loadRounds: loadResult.loadRounds,
        messageCount: records.length,
        platformName: "WhatsApp",
        reachedStableEnd: loadResult.reachedStableEnd,
        stopReason: loadResult.stopReason,
        text: limitText(text, MAX_PAGE_TEXT_LENGTH)
      };
    } catch (error) {
      console.warn("[赢单插件] 回溯 WhatsApp 聊天记录失败：", error);
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
   * - 国际站和 WhatsApp 聊天历史都需要多轮向上滚动和等待懒加载。
   * - 普通网页仍走原来的同步正文提取，避免影响其他站点。
   *
   * @param {(state: { round: number, messageCount: number, reason?: string }) => void} [onProgress] - 聊天历史加载进度回调。
   * @param {{ isStopped?: () => boolean }} [captureControl] - 回溯停止控制器。
   * @returns {Promise<{ pageText: string, captureMeta: null | { platformName?: string, messageCount: number, loadRounds: number, reachedStableEnd: boolean, stopReason: string } }>} 页面文本和抽取元信息。
   * @throws {Error} 本函数不主动抛异常。
   */
  async function getBestPageInquiryTextAsync(onProgress, captureControl) {
    const alibabaCapture = await captureAlibabaInquiryChat(onProgress, captureControl);

    if (alibabaCapture && alibabaCapture.text) {
      return {
        captureMeta: {
          loadRounds: alibabaCapture.loadRounds,
          messageCount: alibabaCapture.messageCount,
          platformName: "国际站",
          reachedStableEnd: alibabaCapture.reachedStableEnd,
          stopReason: alibabaCapture.stopReason
        },
        pageText: alibabaCapture.text
      };
    }

    const whatsAppCapture = await captureWhatsAppChat(onProgress, captureControl);

    if (whatsAppCapture && whatsAppCapture.text) {
      return {
        captureMeta: {
          loadRounds: whatsAppCapture.loadRounds,
          messageCount: whatsAppCapture.messageCount,
          platformName: whatsAppCapture.platformName,
          reachedStableEnd: whatsAppCapture.reachedStableEnd,
          stopReason: whatsAppCapture.stopReason
        },
        pageText: whatsAppCapture.text
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
   * @param {(state: { round: number, messageCount: number, reason?: string }) => void} [onProgress] - 聊天历史加载进度回调。
   * @param {{ isStopped?: () => boolean }} [captureControl] - 回溯停止控制器。
   * @returns {Promise<{ selectedText: string, pageText: string, pageTitle: string, pageUrl: string, captureMeta: null | { platformName?: string, messageCount: number, loadRounds: number, reachedStableEnd: boolean, stopReason: string } }>} 页面上下文。
   * @throws {Error} 本函数不主动抛异常。
   */
  async function getPageContextAsync(onProgress, captureControl) {
    const selectedText = getSelectedText();
    const asyncPageText = selectedText
      ? { captureMeta: null, pageText: getBestPageInquiryText() }
      : await getBestPageInquiryTextAsync(onProgress, captureControl);

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
   * 从已抓取的聊天上下文中提取客户名，用作历史记录名称。
   *
   * 为什么从正文提取：
   * - 国际站和 WhatsApp 格式化后的记录都会保留 `客户 xxx：`。
   * - 页面标题经常是平台通用标题，不能当客户名。
   *
   * @param {{ inquiryText?: string, visibleText?: string, customerName?: string }} payload - 待分析上下文。
   * @returns {string} 客户名；无法识别时返回“未知客户”。
   * @throws {Error} 本函数不主动抛异常。
   */
  function extractCustomerNameFromAnalysisPayload(payload) {
    const explicitName = YingdanInquiryAnalyzer.normalizeText(payload && payload.customerName);

    if (explicitName && explicitName !== "客户" && explicitName !== "我方") {
      return explicitName;
    }

    const text = String((payload && (payload.inquiryText || payload.visibleText)) || "");
    const customerLineMatch = text.match(/(?:^|\n)\[[^\]]+\]\s*客户\s+([^：:\n]{2,80})[：:]/);
    const fallbackMatch = customerLineMatch || text.match(/客户\s+([^：:\n]{2,80})[：:]/);
    const rawName = fallbackMatch ? fallbackMatch[1] : "";
    const cleanName = YingdanInquiryAnalyzer.normalizeText(rawName)
      .replace(/\s+/g, " ")
      .replace(/[，,。.;；]+$/g, "")
      .trim();

    if (!cleanName || cleanName === "客户" || cleanName === "我方" || cleanName === "未知") {
      return "未知客户";
    }

    return cleanName;
  }

  /**
   * 读取本地历史分析记录。
   *
   * @returns {Promise<Array<Record<string, unknown>>>} 最近保存的分析记录。
   * @throws {Error} 本函数内部捕获 storage 异常，失败时返回空数组。
   */
  async function readAnalysisHistoryRecords() {
    try {
      const stored = await chrome.storage.local.get([YD_ANALYSIS_HISTORY_KEY]);
      const records = stored && stored[YD_ANALYSIS_HISTORY_KEY];

      return Array.isArray(records) ? records.filter((record) => record && record.id) : [];
    } catch (error) {
      console.warn("[赢单插件] 读取历史分析记录失败：", error);
      return [];
    }
  }

  /**
   * 写入本地历史分析记录。
   *
   * @param {Array<Record<string, unknown>>} records - 待保存记录。
   * @returns {Promise<void>} 保存完成后 resolve。
   * @throws {Error} 本函数内部捕获 storage 异常。
   */
  async function writeAnalysisHistoryRecords(records) {
    try {
      await chrome.storage.local.set({
        [YD_ANALYSIS_HISTORY_KEY]: records.slice(0, MAX_ANALYSIS_HISTORY_RECORDS)
      });
    } catch (error) {
      console.warn("[赢单插件] 保存历史分析记录失败：", error);
    }
  }

  /**
   * 保存一次真实完成的询盘分析。
   *
   * @param {{ payload: Record<string, unknown>, result: Record<string, unknown> }} input - 本次请求上下文和 AI 返回结果。
   * @returns {Promise<void>} 保存完成后 resolve。
   * @throws {Error} 本函数内部捕获 storage 异常。
   */
  async function saveAnalysisHistoryRecord({ payload, result }) {
    const safePayload = payload || {};
    const safeResult = result || {};
    const customerName = extractCustomerNameFromAnalysisPayload(safePayload);
    const records = await readAnalysisHistoryRecords();
    const record = {
      answer: String(safeResult.answer || ""),
      createdAt: new Date().toISOString(),
      customerName,
      followUps: Array.isArray(safeResult.followUps) ? safeResult.followUps : [],
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      inquiryText: String(safePayload.inquiryText || ""),
      messageCount: safePayload.captureMeta && safePayload.captureMeta.messageCount ? safePayload.captureMeta.messageCount : 0,
      pageTitle: String(safePayload.pageTitle || document.title || ""),
      pageUrl: String(safePayload.pageUrl || window.location.href || ""),
      platformName: safePayload.captureMeta && safePayload.captureMeta.platformName ? safePayload.captureMeta.platformName : "",
      visibleText: String(safePayload.visibleText || safePayload.inquiryText || "")
    };

    await writeAnalysisHistoryRecords([record, ...records.filter((item) => item.id !== record.id)]);
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

        .yd-panel,
        .yd-panel *,
        .yd-panel *::before,
        .yd-panel *::after {
          box-sizing: border-box;
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

        .yd-header-actions {
          display: inline-flex;
          flex: 0 0 auto;
          gap: 6px;
          align-items: center;
        }

        .yd-history-toggle {
          min-height: 32px;
          border: 1px solid #ead5c5;
          border-radius: 8px;
          padding: 0 10px;
          color: #5f5148;
          background: #fffdf9;
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .yd-history-toggle:hover {
          color: #e65000;
          border-color: #ff5c00;
          background: #fff0e6;
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
          overflow-x: hidden;
          padding: 14px 16px 18px;
          background: #fffdf9;
        }

        .yd-message {
          display: grid;
          gap: 6px;
          min-width: 0;
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
          max-width: 100%;
          min-width: 0;
          overflow-wrap: anywhere;
          white-space: normal;
          word-break: break-word;
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
          min-width: 0;
          max-width: 100%;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .yd-markdown :is(h2, h3, h4, p, ul, ol, blockquote, pre) {
          margin: 0;
          min-width: 0;
          max-width: 100%;
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
          overflow-wrap: anywhere;
          white-space: pre-wrap;
          word-break: break-word;
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
          overflow-wrap: anywhere;
          text-decoration: underline;
          text-underline-offset: 2px;
          word-break: break-word;
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
          overflow-wrap: anywhere;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .yd-capture-control-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          align-items: center;
          border-radius: 8px;
          padding: 10px;
          background: #fff8f2;
        }

        .yd-capture-hint {
          min-width: 0;
          color: #3d342d;
          font-size: 12px;
          line-height: 1.6;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .yd-stop-capture {
          min-width: 84px;
          min-height: 32px;
          border: 1px solid #ff5c00;
          border-radius: 8px;
          padding: 0 10px;
          color: #ff5c00;
          background: #fffdf9;
          font: inherit;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .yd-stop-capture:hover {
          background: #fff0e6;
        }

        .yd-stop-capture:disabled {
          cursor: wait;
          opacity: 0.58;
        }

        .yd-start-actions {
          display: flex;
          gap: 8px;
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

        .yd-secondary {
          min-width: 92px;
          min-height: 38px;
          border: 1px solid #ead5c5;
          border-radius: 10px;
          padding: 0 12px;
          color: #5f5148;
          background: #fffdf9;
          font: inherit;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
        }

        .yd-secondary:hover {
          color: #e65000;
          border-color: #ff5c00;
          background: #fff0e6;
        }

        .yd-history-head {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          justify-content: space-between;
          min-width: 0;
        }

        .yd-history-head > div {
          min-width: 0;
        }

        .yd-history-head .yd-secondary {
          min-width: 84px;
          min-height: 30px;
          border-radius: 8px;
          padding: 0 9px;
          font-size: 12px;
          white-space: nowrap;
        }

        .yd-history-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          justify-content: flex-end;
        }

        .yd-history-sticky-actions {
          position: sticky;
          bottom: 0;
          z-index: 2;
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          margin-top: -2px;
          padding: 8px 0 0;
          background: linear-gradient(180deg, rgba(255, 253, 249, 0), #fffdf9 42%);
        }

        .yd-history-sticky-actions .yd-secondary {
          min-height: 34px;
          border-color: #ff5c00;
          color: #e65000;
          background: #fffaf5;
          box-shadow: 0 4px 12px rgba(86, 45, 10, 0.12);
        }

        .yd-history-list {
          display: grid;
          gap: 6px;
        }

        .yd-history-item {
          display: grid;
          gap: 3px;
          width: 100%;
          border: 1px solid #f0e5dc;
          border-radius: 10px;
          padding: 7px 9px;
          color: #2e2925;
          background: #ffffff;
          font: inherit;
          text-align: left;
          cursor: pointer;
        }

        .yd-history-item:hover {
          border-color: #ff5c00;
          background: #fff8f2;
        }

        .yd-history-name {
          color: #241f1b;
          font-size: 13px;
          font-weight: 800;
          line-height: 1.25;
        }

        .yd-history-meta,
        .yd-history-preview {
          color: #746d67;
          font-size: 12px;
          line-height: 1.3;
          overflow-wrap: anywhere;
        }

        .yd-history-preview {
          display: -webkit-box;
          overflow: hidden;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
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

          .yd-capture-control-row {
            grid-template-columns: 1fr;
          }

          .yd-stop-capture {
            justify-self: end;
          }
        }
      </style>
      <aside class="yd-panel" role="dialog" aria-label="赢单询盘分析">
        <header class="yd-header">
          <div class="yd-title">
            <strong data-yd-panel-title>赢单询盘分析</strong>
            <span data-yd-source>当前页面</span>
          </div>
          <div class="yd-header-actions">
            <button class="yd-history-toggle" type="button" data-yd-open-history>历史</button>
            <button class="yd-close" type="button" title="关闭" data-yd-close>×</button>
          </div>
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

    root.querySelector("[data-yd-open-history]").addEventListener("click", () => {
      showAnalysisHistoryList(root);
    });

    root.querySelector("[data-yd-input]").addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendComposerMessage(root);
      }
    });

    root.addEventListener("click", (event) => {
      const target = event.target;
      const actionTarget = target && typeof target.closest === "function"
        ? target.closest("[data-yd-start-analysis], [data-yd-refetch-chat], [data-yd-fetch-chat], [data-yd-open-history], [data-yd-back-current], [data-yd-history-item], [data-yd-history-back], [data-yd-follow-up]")
        : target;

      if (actionTarget && actionTarget.matches("[data-yd-start-analysis]")) {
        startPendingAnalysis(root, actionTarget);
        return;
      }

      if (actionTarget && actionTarget.matches("[data-yd-fetch-chat]")) {
        startChatCapture(root, actionTarget.__yingdanCapturePayload || {});
        return;
      }

      if (actionTarget && actionTarget.matches("[data-yd-refetch-chat]")) {
        startChatCapture(root, actionTarget.__yingdanCapturePayload || {});
        return;
      }

      if (actionTarget && actionTarget.matches("[data-yd-open-history]")) {
        showAnalysisHistoryList(root);
        return;
      }

      if (actionTarget && actionTarget.matches("[data-yd-back-current]")) {
        restoreCurrentConversation(root);
        return;
      }

      if (actionTarget && actionTarget.matches("[data-yd-history-item]")) {
        showAnalysisHistoryDetail(root, actionTarget.getAttribute("data-yd-history-item") || "");
        return;
      }

      if (actionTarget && actionTarget.matches("[data-yd-history-back]")) {
        showAnalysisHistoryList(root, { preserveCurrent: false });
        return;
      }

      if (!actionTarget || !actionTarget.matches("[data-yd-follow-up]")) {
        return;
      }

      sendChatMessage(root, {
        rawMessage: actionTarget.getAttribute("data-yd-follow-up") || "",
        visibleText: actionTarget.textContent || "继续追问"
      });
    });
  }

  /**
   * 标记聊天区正在展示“当前对话”。
   *
   * 为什么要区分当前对话和历史页：
   * - 历史页会临时占用聊天区。
   * - 进入历史前需要保存当前界面，避免用户回不来刚才抓取或分析的内容。
   *
   * @param {ShadowRoot} root - 面板 Shadow DOM。
   * @returns {void}
   * @throws {Error} 本函数不主动抛异常。
   */
  function markCurrentConversation(root) {
    const chat = root.querySelector("[data-yd-chat]");

    if (chat) {
      chat.dataset.ydView = "current";
    }
  }

  /**
   * 保存当前对话快照，供用户从历史记录页返回。
   *
   * 为什么只保存 HTML 快照：
   * - 面板内按钮大多走事件代理，恢复 HTML 后仍可点击。
   * - “开始分析”所需的 payload 仍在 WeakMap 里，按钮恢复后也能继续分析。
   *
   * @param {ShadowRoot} root - 面板 Shadow DOM。
   * @returns {void}
   * @throws {Error} 本函数不主动抛异常。
   */
  function saveCurrentConversationSnapshot(root) {
    const chat = root.querySelector("[data-yd-chat]");

    if (!chat || chat.dataset.ydView === "history") {
      return;
    }

    currentConversationSnapshotByRoot.set(root, {
      html: chat.innerHTML,
      inputDisabled: Boolean(root.querySelector("[data-yd-input]").disabled),
      scrollTop: chat.scrollTop,
      sendDisabled: Boolean(root.querySelector("[data-yd-send]").disabled)
    });
  }

  /**
   * 从历史记录页回到当前对话。
   *
   * @param {ShadowRoot} root - 面板 Shadow DOM。
   * @returns {void}
   * @throws {Error} DOM 写入失败时由浏览器抛出异常。
   */
  function restoreCurrentConversation(root) {
    const chat = root.querySelector("[data-yd-chat]");
    const snapshot = currentConversationSnapshotByRoot.get(root);

    if (!chat || !snapshot) {
      showCaptureReadyCard(root, {
        pageTitle: document.title || "当前页面",
        pageUrl: window.location.href
      });
      return;
    }

    chat.innerHTML = snapshot.html;
    chat.dataset.ydView = "current";
    chat.scrollTop = snapshot.scrollTop || 0;
    root.querySelector("[data-yd-input]").disabled = Boolean(snapshot.inputDisabled);
    root.querySelector("[data-yd-send]").disabled = Boolean(snapshot.sendDisabled);
  }

  /**
   * 展示“等待用户获取聊天记录”的起始卡片。
   *
   * 为什么要先停在这里：
   * - 国际站和 WhatsApp 回溯可能很长，用户应当明确触发。
   * - 用户也可能只是想先查看历史分析记录。
   *
   * @param {ShadowRoot} root - 面板 Shadow DOM。
   * @param {{ pageTitle?: string, pageUrl?: string, inquiryText?: string, source?: string }} payload - 当前页面上下文。
   * @returns {void}
   * @throws {Error} DOM 写入失败时由浏览器抛出异常。
   */
  function showCaptureReadyCard(root, payload) {
    const chat = root.querySelector("[data-yd-chat]");
    const title = YingdanInquiryAnalyzer.normalizeText(payload && payload.pageTitle) || document.title || "当前页面";

    markCurrentConversation(root);
    chat.innerHTML = `
      <article class="yd-start-card" data-yd-capture-ready>
        <div class="yd-start-title">获取当前聊天记录</div>
        <div class="yd-start-meta">${escapeHtml(title)}</div>
        <div class="yd-start-preview">点击后开始读取当前页面聊天记录；如果页面需要向上加载历史消息，插件会自动回溯。</div>
        <div class="yd-start-actions">
          <button class="yd-secondary" type="button" data-yd-open-history>查看历史</button>
          <button class="yd-start" type="button" data-yd-fetch-chat>获取聊天记录</button>
        </div>
      </article>
    `;

    const fetchButton = root.querySelector("[data-yd-fetch-chat]");

    if (fetchButton) {
      fetchButton.__yingdanCapturePayload = payload || {};
      fetchButton.addEventListener("click", (event) => {
        event.stopPropagation();
        startChatCapture(root, payload || {});
      });
    }

    root.querySelector("[data-yd-input]").disabled = false;
    root.querySelector("[data-yd-send]").disabled = false;
  }

  /**
   * 格式化历史记录时间。
   *
   * @param {unknown} value - ISO 时间字符串。
   * @returns {string} 面向用户的本地时间。
   * @throws {Error} 日期异常时返回空字符串。
   */
  function formatHistoryTime(value) {
    const date = new Date(String(value || ""));

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleString();
  }

  /**
   * 展示已分析聊天记录列表。
   *
   * @param {ShadowRoot} root - 面板 Shadow DOM。
   * @param {{ preserveCurrent?: boolean }} [options] - 是否在进入历史前保存当前对话；从历史详情返回列表时不需要重复保存。
   * @returns {Promise<void>} 渲染完成后 resolve。
   * @throws {Error} 本函数内部捕获 storage 异常。
   */
  async function showAnalysisHistoryList(root, options = {}) {
    const chat = root.querySelector("[data-yd-chat]");
    const records = await readAnalysisHistoryRecords();
    const shouldPreserveCurrent = options.preserveCurrent !== false;

    if (shouldPreserveCurrent) {
      saveCurrentConversationSnapshot(root);
    }

    chat.dataset.ydView = "history";

    if (records.length === 0) {
      chat.innerHTML = `
        <article class="yd-start-card">
          <div class="yd-history-head">
            <div>
              <div class="yd-start-title">历史记录</div>
              <div class="yd-start-meta">暂无已分析过的聊天记录</div>
            </div>
            <button class="yd-secondary" type="button" data-yd-back-current>回到当前对话</button>
          </div>
          <div class="yd-start-preview">完成一次询盘分析后，这里会按客户名保存记录。</div>
        </article>
      `;
      appendHistoryBottomActions(root, { showHistoryBack: false });
      return;
    }

    chat.innerHTML = `
      <article class="yd-start-card">
        <div class="yd-history-head">
          <div>
            <div class="yd-start-title">历史记录</div>
            <div class="yd-start-meta">按客户名保存最近 ${Math.min(records.length, MAX_ANALYSIS_HISTORY_RECORDS)} 条分析</div>
          </div>
          <button class="yd-secondary" type="button" data-yd-back-current>回到当前对话</button>
        </div>
        <div class="yd-history-list">
          ${records.map((record) => {
            const customerName = YingdanInquiryAnalyzer.normalizeText(record.customerName) || "未知客户";
            const metaParts = [
              formatHistoryTime(record.createdAt),
              YingdanInquiryAnalyzer.normalizeText(record.platformName),
              record.messageCount ? `${record.messageCount} 条消息` : ""
            ].filter(Boolean);
            const preview = limitText(record.answer || record.inquiryText || "", MAX_HISTORY_PREVIEW_LENGTH);

            return `
              <button class="yd-history-item" type="button" data-yd-history-item="${escapeHtml(record.id)}">
                <span class="yd-history-name">${escapeHtml(customerName)}</span>
                <span class="yd-history-meta">${escapeHtml(metaParts.join(" · ") || "时间未知")}</span>
                <span class="yd-history-preview">${escapeHtml(preview || "暂无预览")}</span>
              </button>
            `;
          }).join("")}
        </div>
      </article>
    `;
    appendHistoryBottomActions(root, { showHistoryBack: false });
  }

  /**
   * 在历史页底部追加更顺手的返回操作。
   *
   * 为什么底部也要放：
   * - 用户点进历史详情后，主要视线和鼠标都在内容下方。
   * - 只在顶部放“回到当前对话”，看完历史后要再回到上方，不符合顺手操作。
   *
   * @param {ShadowRoot} root - 面板 Shadow DOM。
   * @param {{ showHistoryBack?: boolean }} [options] - 是否同时显示“返回历史”。
   * @returns {void}
   * @throws {Error} DOM 写入失败时由浏览器抛出异常。
   */
  function appendHistoryBottomActions(root, options = {}) {
    const chat = root.querySelector("[data-yd-chat]");

    if (!chat) {
      return;
    }

    chat.insertAdjacentHTML("beforeend", `
      <div class="yd-history-sticky-actions">
        ${options.showHistoryBack ? `<button class="yd-secondary" type="button" data-yd-history-back>返回历史</button>` : ""}
        <button class="yd-secondary" type="button" data-yd-back-current>回到当前对话</button>
      </div>
    `);
  }

  /**
   * 更新侧边面板标题。
   *
   * @param {ShadowRoot} root - 面板 Shadow DOM。
   * @param {string} title - 面板标题。
   * @returns {void}
   * @throws {Error} 本函数不主动抛异常。
   */
  function setPanelTitle(root, title) {
    const titleNode = root.querySelector("[data-yd-panel-title]");

    if (titleNode) {
      titleNode.textContent = title;
    }
  }

  /**
   * 展示单条历史分析详情。
   *
   * @param {ShadowRoot} root - 面板 Shadow DOM。
   * @param {string} recordId - 历史记录 ID。
   * @returns {Promise<void>} 渲染完成后 resolve。
   * @throws {Error} 本函数内部捕获 storage 异常。
   */
  async function showAnalysisHistoryDetail(root, recordId) {
    const chat = root.querySelector("[data-yd-chat]");
    const records = await readAnalysisHistoryRecords();
    const record = records.find((item) => item.id === recordId);
    chat.dataset.ydView = "history";

    if (!record) {
      await showAnalysisHistoryList(root, { preserveCurrent: false });
      return;
    }

    chat.innerHTML = `
      <article class="yd-start-card">
        <div class="yd-history-head">
          <div>
            <div class="yd-start-title">${escapeHtml(record.customerName || "未知客户")}</div>
            <div class="yd-start-meta">${escapeHtml([formatHistoryTime(record.createdAt), record.pageTitle].filter(Boolean).join(" · "))}</div>
          </div>
          <div class="yd-history-actions">
            <button class="yd-secondary" type="button" data-yd-history-back>返回历史</button>
            <button class="yd-secondary" type="button" data-yd-back-current>回到当前对话</button>
          </div>
        </div>
      </article>
    `;
    appendMessage(root, "user", record.visibleText || record.inquiryText || "历史聊天记录");
    appendMessage(root, "assistant", record.answer || "暂无分析内容");
    appendHistoryBottomActions(root, { showHistoryBack: true });
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
   * @param {{ inquiryText: string, visibleText: string, pageTitle: string, pageUrl: string, resetConversation: boolean, captureRequest?: Record<string, unknown> }} payload - 待分析内容。
   * @returns {void}
   * @throws {Error} DOM 写入失败时由浏览器抛出异常。
   */
  function showStartAnalysisCard(root, payload) {
    const chat = root.querySelector("[data-yd-chat]");
    const hasInquiryText = Boolean(payload.inquiryText);
    const captureMeta = payload.captureMeta || null;
    const platformName = captureMeta && captureMeta.platformName ? captureMeta.platformName : "当前页面";
    const startTitle = captureMeta && captureMeta.messageCount
      ? `已抓取${platformName}聊天记录（${captureMeta.messageCount} 条）`
      : hasInquiryText
        ? "已抓取当前页面内容"
        : "未抓到可分析内容";
    const startMeta = captureMeta && captureMeta.loadRounds
      ? `${payload.pageTitle || "当前页面"} · ${captureMeta.stopReason === "manual-stop" ? "已手动停止回溯" : "已回溯"} ${captureMeta.loadRounds} 轮`
      : payload.pageTitle || "当前页面";
    const previewText = hasInquiryText
      ? limitText(payload.inquiryText, MAX_START_PREVIEW_LENGTH)
      : "当前页面没有抓到可分析的询盘内容。你可以在底部输入框粘贴客户原话后发送。";
    const refetchPayload = payload.captureRequest || {
      pageTitle: payload.pageTitle || document.title || "当前页面",
      pageUrl: payload.pageUrl || window.location.href,
      source: "refetch"
    };

    pendingAnalysisByRoot.set(root, payload);
    markCurrentConversation(root);
    chat.innerHTML = "";

    const card = document.createElement("article");
    card.className = "yd-start-card";
    card.dataset.ydStartCard = "true";
    card.__yingdanPendingPayload = payload;
    card.innerHTML = `
      <div class="yd-start-title">${escapeHtml(startTitle)}</div>
      <div class="yd-start-meta">${escapeHtml(startMeta)}</div>
      <div class="yd-start-preview">${renderMultilineText(previewText)}</div>
      <div class="yd-start-actions">
        <button class="yd-secondary" type="button" data-yd-refetch-chat>重新获取</button>
        <button class="yd-start" type="button" data-yd-start-analysis ${hasInquiryText ? "" : "disabled"}>开始分析</button>
      </div>
    `;

    const startButton = card.querySelector("[data-yd-start-analysis]");
    const refetchButton = card.querySelector("[data-yd-refetch-chat]");

    if (startButton) {
      startButton.__yingdanPendingPayload = payload;
      startButton.addEventListener("click", (event) => {
        event.stopPropagation();
        startPendingAnalysis(root, startButton);
      });
    }

    if (refetchButton) {
      refetchButton.__yingdanCapturePayload = refetchPayload;
      refetchButton.addEventListener("click", (event) => {
        event.stopPropagation();
        startChatCapture(root, refetchPayload);
      });
    }

    chat.appendChild(card);
    chat.scrollTop = 0;
    root.querySelector("[data-yd-input]").disabled = false;
    root.querySelector("[data-yd-send]").disabled = false;
  }

  /**
   * 展示聊天记录回溯中的加载卡片。
   *
   * @param {ShadowRoot} root - 面板 Shadow DOM。
   * @param {string} platformName - 当前正在尝试抓取的平台名称。
   * @param {{ stop?: () => void }} [captureControl] - 回溯停止控制器。
   * @returns {void}
   * @throws {Error} DOM 写入失败时由浏览器抛出异常。
   */
  function showCaptureLoadingCard(root, platformName, captureControl) {
    const chat = root.querySelector("[data-yd-chat]");
    const safePlatformName = YingdanInquiryAnalyzer.normalizeText(platformName) || "当前页面";

    markCurrentConversation(root);
    chat.innerHTML = `
      <article class="yd-start-card" data-yd-capture-loading>
        <div class="yd-start-title">正在回溯${escapeHtml(safePlatformName)}聊天记录...</div>
        <div class="yd-start-meta" data-yd-capture-progress>正在定位聊天区</div>
        <div class="yd-capture-control-row">
          <div class="yd-capture-hint">正在向上加载历史消息，完成后再开始分析。</div>
          <button class="yd-stop-capture" type="button" data-yd-stop-capture>停止回溯</button>
        </div>
      </article>
    `;

    const stopButton = root.querySelector("[data-yd-stop-capture]");

    if (stopButton && captureControl && typeof captureControl.stop === "function") {
      stopButton.addEventListener("click", () => {
        captureControl.stop();
        stopButton.disabled = true;
        stopButton.textContent = "正在停止";

        const progress = root.querySelector("[data-yd-capture-progress]");

        if (progress) {
          progress.textContent = `${progress.textContent} · 正在停止`;
        }
      });
    }

    root.querySelector("[data-yd-input]").disabled = true;
    root.querySelector("[data-yd-send]").disabled = true;
  }

  /**
   * 更新聊天记录回溯进度。
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

    if (state.reason === "manual-stop") {
      progress.textContent = `已停止回溯，当前读取 ${state.messageCount} 条消息`;
      return;
    }

    progress.textContent = `已回溯 ${state.round} 轮，当前读取 ${state.messageCount} 条消息`;
  }

  /**
   * 获取当前页面最可能使用的聊天抓取平台名。
   *
   * @returns {string} 平台显示名。
   * @throws {Error} 本函数不主动抛异常。
   */
  function getActiveCapturePlatformName() {
    if (isWhatsAppChatPage()) {
      return "WhatsApp";
    }

    if (isAlibabaInquiryDetailPage()) {
      return "国际站";
    }

    return "当前页面";
  }

  /**
   * 获取“开始分析”确认卡片绑定的待分析内容。
   *
   * @param {ShadowRoot} root - 面板 Shadow DOM。
   * @param {Element} [trigger] - 用户点击的开始分析按钮。
   * @returns {{ inquiryText?: string, rawMessage?: string, visibleText?: string, pageTitle?: string, pageUrl?: string, resetConversation?: boolean } | undefined} 待分析内容。
   * @throws {Error} 本函数不主动抛异常。
   */
  function getPendingAnalysisPayload(root, trigger) {
    const mapPayload = pendingAnalysisByRoot.get(root);

    if (mapPayload && mapPayload.inquiryText) {
      return mapPayload;
    }

    const triggerPayload = trigger && trigger.__yingdanPendingPayload;

    if (triggerPayload && triggerPayload.inquiryText) {
      return triggerPayload;
    }

    const startCard = trigger && typeof trigger.closest === "function"
      ? trigger.closest("[data-yd-start-card]")
      : root.querySelector("[data-yd-start-card]");
    const cardPayload = startCard && startCard.__yingdanPendingPayload;

    if (cardPayload && cardPayload.inquiryText) {
      return cardPayload;
    }

    const rootCard = root.querySelector("[data-yd-start-card]");
    const rootCardPayload = rootCard && rootCard.__yingdanPendingPayload;

    return rootCardPayload && rootCardPayload.inquiryText ? rootCardPayload : undefined;
  }

  /**
   * 用户点击“开始分析”后发送待分析内容。
   *
   * @param {ShadowRoot} root - 面板 Shadow DOM。
   * @param {Element} [trigger] - 用户点击的开始分析按钮。
   * @returns {void}
   * @throws {Error} 本函数不主动抛异常；异常由 sendChatMessage 展示。
   */
  function startPendingAnalysis(root, trigger) {
    const payload = getPendingAnalysisPayload(root, trigger);

    if (!payload || !payload.inquiryText) {
      appendMessage(root, "system", "当前没有可分析的询盘内容，请在底部输入框粘贴客户原话。");
      return;
    }

    pendingAnalysisByRoot.delete(root);
    markCurrentConversation(root);
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
   * @param {{ inquiryText?: string, rawMessage?: string, visibleText: string, pageTitle?: string, pageUrl?: string, resetConversation?: boolean, captureMeta?: Record<string, unknown> }} payload - 聊天请求。
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
      if (payload.inquiryText && !payload.rawMessage) {
        await saveAnalysisHistoryRecord({
          payload,
          result
        });
      }
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
   * 用户点击“获取聊天记录”后开始读取当前页面上下文。
   *
   * @param {ShadowRoot} root - 面板 Shadow DOM。
   * @param {{ inquiryText?: string, source?: string, pageTitle?: string, pageUrl?: string }} payload - 来自图标或右键菜单的上下文。
   * @returns {Promise<void>} 抓取完成并展示确认卡片后 resolve。
   * @throws {Error} DOM 或页面抓取异常会由上层消息回调展示。
   */
  async function startChatCapture(root, payload) {
    const safePayload = payload || {};
    const inquiryText = YingdanInquiryAnalyzer.normalizeText(safePayload.inquiryText);
    const titleFromPayload = safePayload.pageTitle || document.title || "当前页面";
    const captureRequest = {
      pageTitle: titleFromPayload,
      pageUrl: safePayload.pageUrl || window.location.href,
      source: safePayload.source || "manual-capture"
    };
    const captureControl = createCaptureControl();

    root.querySelector("[data-yd-source]").textContent = titleFromPayload;
    showCaptureLoadingCard(root, getActiveCapturePlatformName(), captureControl);

    const context = await getPageContextAsync((state) => updateCaptureLoadingCard(root, state), captureControl);
    const capturedText = inquiryText || context.selectedText || context.pageText;
    const title = safePayload.pageTitle || context.pageTitle || "当前页面";

    root.querySelector("[data-yd-source]").textContent = title;
    showStartAnalysisCard(root, {
      captureMeta: context.captureMeta,
      captureRequest,
      inquiryText: capturedText,
      visibleText: capturedText ? `请分析当前页面内容：\n${capturedText}` : "",
      pageTitle: title,
      pageUrl: safePayload.pageUrl || context.pageUrl,
      resetConversation: true
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
    const messagePayload = {
      ...(payload || {}),
      pageTitle: titleFromPayload,
      pageUrl: (payload && payload.pageUrl) || window.location.href
    };

    setPanelTitle(root, "赢单询盘分析");
    root.querySelector("[data-yd-source]").textContent = titleFromPayload;

    if (inquiryText) {
      showStartAnalysisCard(root, {
        captureMeta: null,
        inquiryText,
        visibleText: `请分析当前页面内容：\n${inquiryText}`,
        pageTitle: titleFromPayload,
        pageUrl: messagePayload.pageUrl,
        resetConversation: true
      });
      return { ok: true };
    }

    showCaptureReadyCard(root, messagePayload);

    return { ok: true };
  }

  /**
   * 打开客户背调占位面板。
   *
   * 目前背调工作流还没接入，所以这里只先提供入口和清晰状态。
   * 后续可以在这里改成：读取客户信息 -> 匹配客户Kass -> 调用背调工作流。
   *
   * @param {{ pageTitle?: string, pageUrl?: string, source?: string }} payload - 当前页面上下文。
   * @returns {{ ok: boolean }} 打开结果。
   * @throws {Error} DOM 操作失败时由浏览器抛出异常。
   */
  function openCustomerResearch(payload) {
    const { root } = ensurePanel();
    const titleFromPayload = (payload && payload.pageTitle) || document.title || "当前页面";
    const chat = root.querySelector("[data-yd-chat]");

    setPanelTitle(root, "赢单客户背调");
    root.querySelector("[data-yd-source]").textContent = titleFromPayload;
    markCurrentConversation(root);
    pendingAnalysisByRoot.delete(root);

    chat.innerHTML = `
      <article class="yd-start-card">
        <div class="yd-start-title">客户背调功能正在接入</div>
        <div class="yd-start-meta">${escapeHtml(titleFromPayload)}</div>
        <div class="yd-start-preview">后续这里会读取当前国际站客户信息，关联客户Kass，并生成客户背景、采购可能性、风险点和沟通建议。</div>
      </article>
    `;
    chat.scrollTop = 0;
    root.querySelector("[data-yd-input]").disabled = true;
    root.querySelector("[data-yd-send]").disabled = true;

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

  setupAlibabaToolbarActions();

  console.log("[赢单插件] 内容脚本已就绪。");
})();
