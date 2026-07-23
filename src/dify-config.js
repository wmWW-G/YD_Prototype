/* global window */

(function exposeDifyFeatureState(globalObject) {
  /**
   * 当前会进入通用 AI 对话壳的功能页面。
   *
   * 为什么维护白名单：
   * - 销售准备、客户开发、客户 Kass、支付和后台都有专属工作台，不能误加 Dify 配置栏。
   * - 新增对话功能时，开发同事只需在这里显式登记，影响范围容易复核。
   *
   * @type {string[]}
   */
  const CHAT_FEATURE_IDS = Object.freeze([
    "ask",
    "customer-research",
    "negotiation-scene",
    "inquiry-reply",
    "yd-artifact",
    "market-research",
    "cold-email",
    "complaint",
    "reactivation",
    "relationship",
    "phone-sales",
    "video-meeting",
    "field-visit",
    "visit-reception",
    "title-combo",
    "trade-show",
    // 后台成本监控分别保存两个总控 Chatflow，避免知识库版与无知识库版串 Key。
    "admin-cost-kb",
    "admin-cost-no-kb"
  ]);

  const CHAT_FEATURE_SET = new Set(CHAT_FEATURE_IDS);

  /**
   * 默认绑定 Chatflow 的功能页。
   *
   * 两个总控应用覆盖的成交顾问和技能页都默认使用 Dify `advanced-chat`；
   * `问一下` 保持普通对话型应用默认值，所有页面仍允许管理员手动切换。
   *
   * @type {ReadonlySet<string>}
   */
  const DEFAULT_CHATFLOW_FEATURE_IDS = new Set([
    "customer-research",
    "negotiation-scene",
    "inquiry-reply",
    "yd-artifact",
    "market-research",
    "cold-email",
    "complaint",
    "reactivation",
    "relationship",
    "phone-sales",
    "video-meeting",
    "field-visit",
    "visit-reception",
    "title-combo",
    "trade-show",
    "admin-cost-kb",
    "admin-cost-no-kb"
  ]);

  /**
   * 判断某个路由是否属于可配置 Dify 的对话功能页。
   *
   * @param {unknown} featureId - state.activeMain 或路由 main。
   * @returns {boolean} 在明确白名单中时返回 true。
   * @throws {Error} 本函数不主动抛异常。
   */
  function isDifyChatFeature(featureId) {
    return CHAT_FEATURE_SET.has(String(featureId || ""));
  }

  /**
   * 创建一个页面独立的配置状态。
   *
   * @param {unknown} featureId - 对话页面 ID。
   * @returns {{ appType: "dialogue" | "chatflow", apiKeyDraft: string, skillKey: string, skillKeyDraft: string, hasKey: boolean, maskedKey: string, appName: string, appMode: string, loaded: boolean, loading: boolean, saving: boolean, error: string, storageReady: boolean }} 前端配置状态。
   * @throws {Error} 本函数不主动抛异常。
   */
  function createFeatureConfigState(featureId) {
    return {
      appType: DEFAULT_CHATFLOW_FEATURE_IDS.has(String(featureId || "")) ? "chatflow" : "dialogue",
      apiKeyDraft: "",
      skillKey: "",
      skillKeyDraft: "",
      hasKey: false,
      maskedKey: "",
      appName: "",
      appMode: "",
      loaded: false,
      loading: false,
      saving: false,
      error: "",
      storageReady: false
    };
  }

  /**
   * 创建一个页面独立的 Dify 会话状态。
   *
   * 为什么每页独立：
   * - Dify API Key 绑定不同 App，跨页面复用 conversation_id 会串上下文。
   * - 独立 messages 能保证市场调研、开发信、客诉等页面切换后互不覆盖。
   *
   * @param {unknown} featureId - 对话页面 ID。
   * @param {unknown} seed - 当前浏览器会话种子；测试可传固定值。
   * @returns {{ messages: Array<{ id: string, role: string, content: string, status: string, processSteps?: object[], currentProcess?: object | null, processCollapsed?: boolean, processExpanded?: boolean, answerStarted?: boolean }>, conversationId: string, userId: string, error: string, isGenerating: boolean }} 页面会话状态。
   * @throws {Error} 本函数不主动抛异常。
   */
  function createFeatureSessionState(featureId, seed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`) {
    const cleanFeatureId = String(featureId || "chat").replace(/[^a-z0-9-]/gi, "-");

    return {
      messages: [],
      conversationId: "",
      userId: `yd-prototype-${cleanFeatureId}-${String(seed)}`,
      error: "",
      isGenerating: false
    };
  }

  /**
   * 把浏览器底层网络错误转换成普通用户能理解的配置提示。
   *
   * 为什么在前端统一处理：
   * - 直接用静态服务器打开原型时，没有本地 Vercel Function，浏览器通常只给出英文错误。
   * - Dify 返回的业务校验错误仍要原样保留，方便内部人员修正应用类型或 API Key。
   *
   * @param {unknown} error - fetch 或后端校验抛出的异常。
   * @returns {string} 适合显示在顶栏的简短中文信息。
   * @throws {Error} 本函数不主动抛异常。
   */
  function getFriendlyConfigError(error) {
    const message = error instanceof Error ? error.message : String(error || "");

    if (message === "Failed to fetch" || message === "Load failed" || message === "NetworkError when attempting to fetch resource.") {
      return "配置服务暂未连接，请稍后重试。";
    }

    return message || "Dify 配置操作失败。";
  }

  /**
   * 把一轮 Dify 分析耗时格式化为用户可读的“分、秒”。
   *
   * 为什么只取整秒：
   * - 毫秒对用户判断任务快慢没有帮助，反而会让过程标题持续抖动。
   * - 开始时间缺失时返回空字符串，兼容升级前已经存在的历史消息。
   * - 结束时间为空时使用当前时间，供生成中的界面每秒刷新；结束后则固定使用真实结束时间。
   *
   * @param {unknown} startedAt - 用户发送问题时记录的 Unix 毫秒时间戳。
   * @param {unknown} endedAt - 第一段正式答案、完成或失败事件到达时的 Unix 毫秒时间戳。
   * @param {unknown} [currentTime=Date.now()] - 仍在思考时用于动态计算的当前 Unix 毫秒时间戳。
   * @returns {string} 例如“思考了 8 秒”或“思考了 2 分 9 秒”；时间不完整时返回空字符串。
   * @throws {Error} 本函数不主动抛异常。
   */
  function formatDifyThinkingDuration(startedAt, endedAt, currentTime = Date.now()) {
    if (startedAt === null || startedAt === undefined) {
      return "";
    }

    const start = Number(startedAt);
    const effectiveEnd = endedAt === null || endedAt === undefined ? currentTime : endedAt;
    const end = Number(effectiveEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return "";
    }

    const totalSeconds = Math.max(0, Math.floor((end - start) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return minutes > 0
      ? `思考了 ${minutes} 分 ${seconds} 秒`
      : `思考了 ${seconds} 秒`;
  }

  /**
   * 将一条代理 SSE 事件应用到当前助手消息。
   *
   * 这个纯函数集中维护过程区的产品规则：
   * - 新过程覆盖 `currentProcess`，所以生成中永远只看到最新一步。
   * - `processSteps` 保留最多 40 步，正式答案出现后可由用户展开回看。
   * - 第一个 answer 事件到达时自动折叠过程，避免过程信息抢占最终结论。
   *
   * @param {object} message - 当前助手消息对象。
   * @param {object} event - 后端公开 SSE 事件。
   * @param {number} [receivedAt=Date.now()] - 当前事件到达浏览器的时间；测试可传固定值。
   * @returns {object} 更新后的新消息对象，不直接修改传入对象。
   * @throws {Error} 本函数不主动抛异常；未知事件原样返回消息副本。
   */
  function applyDifyStreamEventToMessage(message, event, receivedAt = Date.now()) {
    const currentMessage = message && typeof message === "object" ? message : {};
    const eventType = String(event?.type || "");
    const existingSteps = Array.isArray(currentMessage.processSteps) ? currentMessage.processSteps : [];
    const safeReceivedAt = Number.isFinite(Number(receivedAt)) ? Number(receivedAt) : Date.now();

    if (eventType === "process" && event.step && typeof event.step === "object") {
      const nextStep = { ...event.step };
      const matchingIndex = existingSteps.findIndex((step) => (
        nextStep.id && step?.id && String(step.id) === String(nextStep.id)
      ));
      const nextSteps = [...existingSteps];

      if (matchingIndex >= 0) {
        nextSteps[matchingIndex] = nextStep;
      } else {
        nextSteps.push(nextStep);
      }

      return {
        ...currentMessage,
        processSteps: nextSteps.slice(-40),
        currentProcess: nextStep,
        processCollapsed: Boolean(currentMessage.answerStarted),
        processExpanded: currentMessage.answerStarted ? false : Boolean(currentMessage.processExpanded)
      };
    }

    if (eventType === "answer_delta") {
      const delta = String(event.delta || "");

      // Dify 的部分 Chatflow 会在正式正文前先发送换行符。
      // 这些空白不是用户能看到的答案；如果据此切换 `answerStarted`，过程区会在正文尚未出现时提前折叠。
      // 正文已经开始后仍保留空白增量，避免破坏 Markdown 段落和列表格式。
      if (!currentMessage.answerStarted && !delta.trim()) {
        return { ...currentMessage };
      }

      return {
        ...currentMessage,
        content: currentMessage.answerStarted ? `${String(currentMessage.content || "")}${delta}` : delta,
        answerStarted: true,
        thinkingEndedAt: currentMessage.thinkingEndedAt ?? safeReceivedAt,
        processCollapsed: true,
        processExpanded: false
      };
    }

    if (eventType === "answer_replace") {
      const removeProcessId = String(event.remove_process_id || "");
      const nextSteps = removeProcessId
        ? existingSteps.filter((step) => String(step?.id || "") !== removeProcessId)
        : existingSteps;
      const nextCurrentProcess = removeProcessId && String(currentMessage.currentProcess?.id || "") === removeProcessId
        ? (nextSteps[nextSteps.length - 1] || null)
        : (currentMessage.currentProcess || null);

      return {
        ...currentMessage,
        content: String(event.answer || ""),
        answerStarted: true,
        thinkingEndedAt: currentMessage.thinkingEndedAt ?? safeReceivedAt,
        processSteps: nextSteps,
        currentProcess: nextCurrentProcess,
        processCollapsed: true,
        processExpanded: false
      };
    }

    if (eventType === "done") {
      const result = event.result && typeof event.result === "object" ? event.result : {};
      const finalAnswer = currentMessage.answerStarted
        ? String(currentMessage.content || "")
        : String(result.answer || "Dify 已完成执行，但没有返回可展示的 answer。");

      return {
        ...currentMessage,
        content: finalAnswer,
        status: "done",
        answerStarted: Boolean(finalAnswer) || Boolean(currentMessage.answerStarted),
        thinkingEndedAt: currentMessage.thinkingEndedAt ?? safeReceivedAt,
        processCollapsed: true,
        processExpanded: false,
        conversationId: String(result.conversation_id || ""),
        usage: result.metadata?.usage || null,
        billingTrace: result.billing_trace || null,
        workflowRunId: String(result.workflow_run_id || result.billing_trace?.workflow_run_id || ""),
        appType: String(result.app_type || "")
      };
    }

    if (eventType === "error") {
      const interruptedStep = currentMessage.currentProcess
        ? {
            ...currentMessage.currentProcess,
            label: String(currentMessage.currentProcess.label || "当前步骤").replace(/（已中断）$/, "") + "（已中断）",
            status: "error"
          }
        : null;
      const nextSteps = interruptedStep
        ? existingSteps.map((step) => (
            step?.id && interruptedStep.id && String(step.id) === String(interruptedStep.id)
              ? interruptedStep
              : step
          ))
        : existingSteps;

      return {
        ...currentMessage,
        content: String(event.message || "Dify 调用失败，请稍后重试。"),
        status: "error",
        thinkingEndedAt: currentMessage.thinkingEndedAt ?? safeReceivedAt,
        processSteps: nextSteps,
        currentProcess: interruptedStep,
        processCollapsed: true,
        processExpanded: false
      };
    }

    return { ...currentMessage };
  }

  /**
   * 创建浏览器端增量 SSE 解析器。
   *
   * fetch 的 ReadableStream 分块位置和 SSE 事件边界无关，因此 JSON 可能被切在任意字符中间。
   * 解析器先缓存到空行，再提取 data 字段，确保不会因为网络分块而丢事件。
   *
   * @param {(event: object) => void} onEvent - 每获得一条完整公开事件时调用。
   * @returns {{ push: (chunk: string) => void, finish: () => void }} 增量写入和结束接口。
   * @throws {Error} 完整 data JSON 损坏，或 onEvent 回调抛错时向外抛出。
   */
  function createDifySseEventParser(onEvent) {
    let buffer = "";

    /**
     * 解析一个由空行分隔的完整 SSE 事件块。
     *
     * @param {string} block - 完整 SSE 事件块。
     * @returns {void}
     * @throws {Error} data 不是合法 JSON 时抛出。
     */
    function parseBlock(block) {
      const dataText = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n")
        .trim();

      if (!dataText || dataText === "[DONE]") {
        return;
      }

      onEvent(JSON.parse(dataText));
    }

    return {
      /**
       * 写入新读取到的响应文本。
       *
       * @param {string} chunk - TextDecoder 解码后的文本块。
       * @returns {void}
       * @throws {Error} 完整事件解析失败时抛出。
       */
      push(chunk) {
        buffer += String(chunk || "");
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() || "";
        blocks.forEach(parseBlock);
      },

      /**
       * 处理没有尾随空行的最后一个事件。
       *
       * @returns {void}
       * @throws {Error} 最后一个完整事件解析失败时抛出。
       */
      finish() {
        if (buffer.trim()) {
          parseBlock(buffer);
        }
        buffer = "";
      }
    };
  }

  const publicApi = {
    CHAT_FEATURE_IDS,
    applyDifyStreamEventToMessage,
    createDifySseEventParser,
    createFeatureConfigState,
    createFeatureSessionState,
    formatDifyThinkingDuration,
    getFriendlyConfigError,
    isDifyChatFeature
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = publicApi;
  }

  if (globalObject) {
    globalObject.YD_DIFY = publicApi;
  }
}(typeof window !== "undefined" ? window : globalThis));
