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
    "customer-kass",
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
    "customer-kass",
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
   * 把单轮 thinking 耗时格式化为带一位小数的秒数。
   *
   * 与整轮任务的“思考了 2 分 9 秒”不同，单轮通常只有几秒，保留 0.1 秒
   * 才能让用户看出每次思考确实重新开始，而不是同一个总计时器继续累加。
   *
   * @param {unknown} startedAt - 该轮 `<think>` 开始到达浏览器的 Unix 毫秒时间戳。
   * @param {unknown} endedAt - 该轮 `</think>` 到达浏览器的 Unix 毫秒时间戳；运行中为空。
   * @param {unknown} [currentTime=Date.now()] - 运行中用于动态计算的当前 Unix 毫秒时间戳。
   * @returns {string} 例如 `3.3s`；时间缺失或无效时返回空字符串。
   * @throws {Error} 本函数不主动抛异常。
   */
  function formatDifyThinkingRoundDuration(startedAt, endedAt, currentTime = Date.now()) {
    if (startedAt === null || startedAt === undefined) {
      return "";
    }

    const start = Number(startedAt);
    const effectiveEnd = endedAt === null || endedAt === undefined ? currentTime : endedAt;
    const end = Number(effectiveEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return "";
    }

    const elapsedTenths = Math.max(0, Math.floor((end - start) / 100));
    return `${(elapsedTenths / 10).toFixed(1)}s`;
  }

  /**
   * 把扁平的公开过程步骤整理成“thinking → 安全过程详情 → 本轮小结”的时间线。
   *
   * 这里只消费后端已经脱敏的步骤：原始 `<think>` 正文、prompt、observation 和工具结果
   * 从未进入浏览器。`details` 只会包含公开 thought、工具名、搜索词和节点状态。
   *
   * @param {object} message - 当前助手消息，包含 processSteps。
   * @param {number} [currentTime=Date.now()] - 当前 Unix 毫秒时间戳，用于运行中轮次计时。
   * @returns {Array<{id: string, status: string, title: string, duration: string, details: Array<{id: string, kind: string, label: string, detail: string, status: string}>, summary: {id: string, content: string, status: string} | null}>} 可直接渲染的思考轮次。
   * @throws {Error} 本函数不主动抛异常。
   */
  function getDifyReasoningTimeline(message, currentTime = Date.now()) {
    const steps = Array.isArray(message?.processSteps) ? message.processSteps : [];
    const rounds = [];
    const roundsById = new Map();

    steps.forEach((step) => {
      if (!step || typeof step !== "object" || String(step.kind || "") !== "thinking") {
        return;
      }

      const id = String(step.id || "");
      if (!id) {
        return;
      }

      const status = String(step.status || "running");
      const round = {
        id,
        status,
        title: String(step.label || (status === "running" ? "正在深度思考" : "已深度思考")),
        duration: formatDifyThinkingRoundDuration(step.startedAt, step.endedAt, currentTime),
        details: [],
        summary: null
      };
      rounds.push(round);
      roundsById.set(id, round);
    });

    steps.forEach((step) => {
      if (!step || typeof step !== "object" || String(step.kind || "") === "thinking") {
        return;
      }

      const roundId = String(step.roundId || "");
      const round = roundsById.get(roundId);
      if (!round) {
        return;
      }

      if (String(step.kind || "") === "summary") {
        round.summary = {
          id: String(step.id || ""),
          content: String(step.detail || ""),
          status: String(step.status || "running")
        };
        return;
      }

      round.details.push({
        id: String(step.id || ""),
        kind: String(step.kind || "reasoning"),
        label: String(step.label || "正在分析问题"),
        detail: String(step.detail || ""),
        status: String(step.status || "running")
      });
    });

    return rounds;
  }

  /**
   * 生成分轮思考时间线的轻量 DOM 结构签名。
   *
   * 新步骤或状态切换会改变标签、折叠状态和层级，需要重画本轮时间线；
   * 同一阶段小结继续追加文字时签名保持不变，前端只更新对应内容节点，避免闪烁。
   *
   * @param {object} message - 当前助手消息，包含 processSteps。
   * @returns {string} 由步骤 ID、类型和状态组成的稳定签名。
   * @throws {Error} 本函数不主动抛异常。
   */
  function getDifyReasoningTimelineSignature(message) {
    const steps = Array.isArray(message?.processSteps) ? message.processSteps : [];

    return steps
      .filter((step) => (
        step
        && typeof step === "object"
        && (String(step.kind || "") === "thinking" || Boolean(step.roundId))
      ))
      .map((step) => `${String(step.id || "")}:${String(step.kind || "")}:${String(step.status || "")}`)
      .join("|");
  }

  /**
   * 裁剪普通过程日志，同时永久保留当前回答中的 thinking 轮次与阶段小结。
   *
   * 工具和节点日志可能有几十条，直接 `slice(-40)` 会先删掉用户正在回看的前几轮思考。
   * 因此先为核心时间线步骤保留位置，再用最近的普通日志填满 40 条预算；如果单是核心
   * 时间线就超过预算，则以“轮次完整”优先，不拆掉已经显示过的思考与小结。
   *
   * @param {object[]} steps - 按到达顺序排列的公开过程步骤。
   * @param {number} [maxSteps=40] - 普通过程历史的目标上限。
   * @returns {object[]} 保持原始顺序的裁剪结果。
   * @throws {Error} 本函数不主动抛异常。
   */
  function trimDifyProcessSteps(steps, maxSteps = 40) {
    const semanticSteps = steps.filter((step) => ["thinking", "summary"].includes(String(step?.kind || "")));
    const supportingSteps = steps.filter((step) => !["thinking", "summary"].includes(String(step?.kind || "")));
    const supportingBudget = Math.max(0, maxSteps - semanticSteps.length);
    const retainedSupportingSteps = new Set(
      supportingBudget > 0 ? supportingSteps.slice(-supportingBudget) : []
    );

    return steps.filter((step) => (
      ["thinking", "summary"].includes(String(step?.kind || ""))
      || retainedSupportingSteps.has(step)
    ));
  }

  /**
   * 在流结束或失败时关闭仍处于 running 的 thinking 轮次。
   *
   * 正常协议会先收到同一 thinking ID 的 done 事件；但网络断流、旧版 Dify
   * 或异常节点可能直接发送终止事件。此处作为浏览器端兜底，确保独立计时不会永远增长。
   *
   * @param {object[]} steps - 当前公开过程步骤。
   * @param {"done" | "error"} terminalStatus - 本次流的终止状态。
   * @param {number} endedAt - 终止事件到达浏览器的 Unix 毫秒时间戳。
   * @returns {object[]} 关闭运行中 thinking 后的新步骤数组。
   * @throws {Error} 本函数不主动抛异常。
   */
  function closeRunningThinkingSteps(steps, terminalStatus, endedAt) {
    return steps.map((step) => {
      if (
        String(step?.kind || "") !== "thinking"
        || ["done", "error"].includes(String(step?.status || ""))
      ) {
        return step;
      }

      return {
        ...step,
        label: terminalStatus === "done" ? "已深度思考" : String(step.label || "深度思考"),
        status: terminalStatus,
        endedAt: step.endedAt ?? endedAt
      };
    });
  }

  /**
   * 将一条代理 SSE 事件应用到当前助手消息。
   *
   * 这个纯函数集中维护过程区的产品规则：
   * - 新过程覆盖 `currentProcess`，供旧版单步骤过程区展示最新一步。
   * - 普通过程日志保留最近 40 步；显式 thinking 与阶段小结始终保留为完整时间线。
   * - 旧版过程在首个 answer 到达后折叠；显式多轮时间线仍保留在最终正文上方。
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
      const incomingStep = { ...event.step };
      const matchingIndex = existingSteps.findIndex((step) => (
        incomingStep.id && step?.id && String(step.id) === String(incomingStep.id)
      ));
      const nextSteps = [...existingSteps];
      const previousStep = matchingIndex >= 0 && existingSteps[matchingIndex]
        ? existingSteps[matchingIndex]
        : {};
      const nextStep = {
        ...previousStep,
        ...incomingStep
      };

      // Agent 的阶段小结可能按几十个字符分批到达。这里只追加代理明确标记的 detailDelta，
      // 普通节点/工具事件仍保持原有的整段覆盖语义，避免重复拼接状态文案。
      if (Object.prototype.hasOwnProperty.call(incomingStep, "detailDelta")) {
        nextStep.detail = `${String(previousStep.detail || "")}${String(incomingStep.detailDelta || "")}`;
        delete nextStep.detailDelta;
      } else if (!Object.prototype.hasOwnProperty.call(incomingStep, "detail") && previousStep.detail !== undefined) {
        nextStep.detail = previousStep.detail;
      }

      // 每个显式 thinking 轮次独立计时；更新同一 ID 时必须保留最初开始时间，
      // 并且只在该轮第一次变为 done/error 时冻结结束时间。
      if (String(nextStep.kind || "") === "thinking") {
        nextStep.startedAt = previousStep.startedAt ?? safeReceivedAt;
        if (["done", "error"].includes(String(nextStep.status || ""))) {
          nextStep.endedAt = previousStep.endedAt ?? safeReceivedAt;
        } else {
          nextStep.endedAt = previousStep.endedAt ?? null;
        }
      }

      if (matchingIndex >= 0) {
        nextSteps[matchingIndex] = nextStep;
      } else {
        nextSteps.push(nextStep);
      }

      return {
        ...currentMessage,
        processSteps: trimDifyProcessSteps(nextSteps),
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
      const nextSteps = closeRunningThinkingSteps(existingSteps, "done", safeReceivedAt);
      const nextCurrentProcess = currentMessage.currentProcess?.id
        ? nextSteps.find((step) => String(step?.id || "") === String(currentMessage.currentProcess.id))
          || currentMessage.currentProcess
        : (currentMessage.currentProcess || null);

      return {
        ...currentMessage,
        content: finalAnswer,
        status: "done",
        answerStarted: Boolean(finalAnswer) || Boolean(currentMessage.answerStarted),
        thinkingEndedAt: currentMessage.thinkingEndedAt ?? safeReceivedAt,
        processSteps: nextSteps,
        currentProcess: nextCurrentProcess,
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
      const closedSteps = closeRunningThinkingSteps(existingSteps, "error", safeReceivedAt);
      const currentStep = currentMessage.currentProcess?.id
        ? closedSteps.find((step) => String(step?.id || "") === String(currentMessage.currentProcess.id))
          || currentMessage.currentProcess
        : (currentMessage.currentProcess || null);
      const interruptedStep = currentStep
        ? {
            ...currentStep,
            label: String(currentStep.label || "当前步骤").replace(/（已中断）$/, "") + "（已中断）",
            status: "error"
          }
        : null;
      const nextSteps = interruptedStep
        ? closedSteps.map((step) => (
            step?.id && interruptedStep.id && String(step.id) === String(interruptedStep.id)
              ? interruptedStep
              : step
          ))
        : closedSteps;

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
   * 决定 KASS 流式消息下一帧应该怎样更新。
   *
   * 过程事件可能连续到达，但在正式答案出现前，用户看到的占位文字通常完全相同。
   * 如果仍然重建这段 DOM，就会反复触发布局与动画，表现为整块内容闪烁。
   *
   * @param {object} message - 当前助手消息。
   * @param {string} currentPhase - DOM 当前记录的渲染阶段。
   * @param {string} renderedContent - DOM 当前已经展示的原始文本。
   * @returns {{ mode: "none" | "morph" | "structure", phase: string, content: string }} 本帧更新计划。
   * @throws {Error} 本函数不主动抛异常。
   */
  function getKassStreamRenderPlan(message, currentPhase, renderedContent) {
    const content = String(message?.content || "");
    const status = String(message?.status || "");
    const phase = status === "done" || status === "error"
      ? "complete"
      : (message?.answerStarted ? "streaming" : "loading");

    if (content === String(renderedContent || "")) {
      return { mode: "none", phase, content };
    }

    if (phase === "streaming" || phase === "complete") {
      return { mode: "morph", phase, content };
    }

    return { mode: "structure", phase, content };
  }

  /**
   * 把公开的 KASS 过程状态整理成稳定、可直接显示的浅灰提示。
   *
   * @param {object} message - 当前助手消息。
   * @returns {{ visible: boolean, complete: boolean, label: string, detail: string, count: number }} 过程区视图模型。
   * @throws {Error} 本函数不主动抛异常。
   */
  function getKassProcessPresentation(message) {
    const steps = Array.isArray(message?.processSteps) ? message.processSteps : [];
    const current = message?.currentProcess && typeof message.currentProcess === "object"
      ? message.currentProcess
      : null;
    const complete = ["done", "error"].includes(String(message?.status || ""));
    const completedLabel = String(message?.status || "") === "error"
      ? "执行已中断"
      : `已完成 ${steps.length} 个步骤`;

    return {
      visible: Boolean(current)
        || (complete && steps.length > 0)
        || (!complete && String(message?.status || "") === "loading"),
      complete,
      label: complete
        ? completedLabel
        : String(current?.label || "正在结合客户资料分析"),
      detail: complete ? "" : String(current?.detail || ""),
      count: steps.length
    };
  }

  /**
   * 判断 KASS 待办状态是否表示已经完成。
   *
   * 这个判断放在纯状态层，是为了让动画差异规划器可以在浏览器和 Node 测试中
   * 使用完全相同的完成口径，不依赖页面 DOM 或 app.js 中的渲染函数。
   *
   * @param {unknown} status - Plugin 返回的待办状态。
   * @returns {boolean} 中文或英文状态表示完成时返回 true。
   * @throws {Error} 本函数不主动抛异常。
   */
  function isKassMotionCompletedStatus(status) {
    return [
      "已完成",
      "完成",
      "已办结",
      "done",
      "completed",
      "closed"
    ].includes(String(status || "").trim().toLowerCase());
  }

  /**
   * 比较两个动画快照片段是否相同。
   *
   * 快照由前端按固定字段顺序创建，因此 JSON 序列化既能覆盖数组内容，也不会把
   * 对象引用变化误判成业务变化。空值会统一为普通空对象，兼容旧浏览器状态。
   *
   * @param {unknown} beforeValue - 写入前的字段组。
   * @param {unknown} afterValue - 写入后的字段组。
   * @returns {boolean} 两组可见数据相同则返回 true。
   * @throws {TypeError} 仅在传入无法 JSON 序列化的循环对象时可能抛出。
   */
  function areKassMotionValuesEqual(beforeValue, afterValue) {
    return JSON.stringify(beforeValue ?? {}) === JSON.stringify(afterValue ?? {});
  }

  /**
   * 为 Agent 到右侧 CRM 面板的完整 CRUD 反馈生成纯数据动画计划。
   *
   * 规划器只比较 Plugin 回读前后的真实快照，不读取 Agent 自然语言：
   * - 客户摘要与背调资料按两个稳定区域分别反馈。
   * - 已存在的跟进和待办支持新增、修改、删除。
   * - 待办完成与重开使用独立语义，避免被笼统归为“修改”。
   * - 整条跟进新增或删除时，不再重复播放其内部待办动画。
   *
   * @param {{
   *   customer?: { summary?: object, profile?: object },
   *   followups?: Array<{ id?: string, title?: string, tasks?: Array<object> }>
   * }} before - Plugin 写入前的可见 CRM 快照。
   * @param {{
   *   customer?: { summary?: object, profile?: object },
   *   followups?: Array<{ id?: string, title?: string, tasks?: Array<object> }>
   * }} after - Plugin 写入后的可见 CRM 快照。
   * @returns {{
   *   customerUpdates: Array<{ id: string, title: string, target: string }>,
   *   completedTasks: Array<{ id: string, title: string, followupId: string }>,
   *   reopenedTasks: Array<{ id: string, title: string, followupId: string }>,
   *   addedTasks: Array<{ id: string, title: string, followupId: string }>,
   *   updatedTasks: Array<{ id: string, title: string, followupId: string }>,
   *   removedTasks: Array<{ id: string, title: string, followupId: string }>,
   *   addedFollowups: Array<{ id: string, title: string }>,
   *   updatedFollowups: Array<{ id: string, title: string }>,
   *   removedFollowups: Array<{ id: string, title: string }>
   * }} 可分成删除前与刷新后两段播放的动画计划。
   * @throws {TypeError} 快照包含循环引用时可能由 JSON 序列化抛出。
   */
  function buildKassCrudMotionPlan(before, after) {
    const beforeCustomer = before?.customer && typeof before.customer === "object"
      ? before.customer
      : {};
    const afterCustomer = after?.customer && typeof after.customer === "object"
      ? after.customer
      : {};
    const beforeFollowups = Array.isArray(before?.followups) ? before.followups : [];
    const afterFollowups = Array.isArray(after?.followups) ? after.followups : [];
    const beforeFollowupMap = new Map(
      beforeFollowups.map((record) => [String(record?.id || ""), record || {}])
    );
    const afterFollowupMap = new Map(
      afterFollowups.map((record) => [String(record?.id || ""), record || {}])
    );
    const plan = {
      customerUpdates: [],
      completedTasks: [],
      reopenedTasks: [],
      addedTasks: [],
      updatedTasks: [],
      removedTasks: [],
      addedFollowups: [],
      updatedFollowups: [],
      removedFollowups: []
    };

    if (!areKassMotionValuesEqual(beforeCustomer.summary, afterCustomer.summary)) {
      plan.customerUpdates.push({
        id: "customer-summary",
        title: "客户资料",
        target: "summary"
      });
    }
    if (!areKassMotionValuesEqual(beforeCustomer.profile, afterCustomer.profile)) {
      plan.customerUpdates.push({
        id: "customer-profile",
        title: "背调资料",
        target: "profile"
      });
    }

    afterFollowups.forEach((record) => {
      const followupId = String(record?.id || "");
      const title = String(record?.title || "客户跟进记录");
      const previousRecord = beforeFollowupMap.get(followupId);

      if (!previousRecord) {
        plan.addedFollowups.push({ id: followupId, title });
        return;
      }

      const { tasks: _beforeTasks, ...beforeRecordFields } = previousRecord;
      const { tasks: _afterTasks, ...afterRecordFields } = record || {};
      if (!areKassMotionValuesEqual(beforeRecordFields, afterRecordFields)) {
        plan.updatedFollowups.push({ id: followupId, title });
      }

      const previousTasks = Array.isArray(previousRecord.tasks) ? previousRecord.tasks : [];
      const nextTasks = Array.isArray(record?.tasks) ? record.tasks : [];
      const previousTaskMap = new Map(
        previousTasks.map((task) => [String(task?.id || ""), task || {}])
      );
      const nextTaskMap = new Map(
        nextTasks.map((task) => [String(task?.id || ""), task || {}])
      );

      nextTasks.forEach((task) => {
        const taskId = String(task?.id || "");
        const taskTitle = String(task?.title || "待补充事项");
        const previousTask = previousTaskMap.get(taskId);
        const motionTask = { id: taskId, title: taskTitle, followupId };

        if (!previousTask) {
          plan.addedTasks.push(motionTask);
          return;
        }

        const wasCompleted = isKassMotionCompletedStatus(previousTask.status);
        const isCompleted = isKassMotionCompletedStatus(task?.status);
        if (!wasCompleted && isCompleted) {
          plan.completedTasks.push(motionTask);
          return;
        }
        if (wasCompleted && !isCompleted) {
          plan.reopenedTasks.push(motionTask);
          return;
        }
        if (!areKassMotionValuesEqual(previousTask, task)) {
          plan.updatedTasks.push(motionTask);
        }
      });

      previousTasks.forEach((task) => {
        const taskId = String(task?.id || "");
        if (!nextTaskMap.has(taskId)) {
          plan.removedTasks.push({
            id: taskId,
            title: String(task?.title || "待补充事项"),
            followupId
          });
        }
      });
    });

    beforeFollowups.forEach((record) => {
      const followupId = String(record?.id || "");
      if (!afterFollowupMap.has(followupId)) {
        plan.removedFollowups.push({
          id: followupId,
          title: String(record?.title || "客户跟进记录")
        });
      }
    });

    return plan;
  }

  /**
   * 把 CRUD 差异拆成“右栏刷新前”和“右栏刷新后”两个动画阶段。
   *
   * 删除目标只存在于旧 DOM，所以必须先让令牌抵达并完成退场，再刷新右栏。
   * 新增、修改、完成和重开则必须等新 DOM 出现后播放，才能准确落到更新后的节点。
   *
   * @param {ReturnType<typeof buildKassCrudMotionPlan>} plan - 完整 CRUD 差异计划。
   * @returns {{
   *   beforeRefresh: Array<{ id: string, title: string, entity: string, operation: string, label: string }>,
   *   afterRefresh: Array<{ id: string, title: string, entity: string, operation: string, label: string, target?: string }>
   * }} 可由页面按顺序执行的两个阶段。
   * @throws {Error} 本函数不主动抛异常。
   */
  function getKassCrudMotionPhases(plan) {
    const safePlan = plan && typeof plan === "object" ? plan : {};
    const list = (key) => (Array.isArray(safePlan[key]) ? safePlan[key] : []);
    const beforeRefresh = [
      ...list("removedTasks").map((task) => ({
        ...task,
        entity: "task",
        operation: "remove",
        label: `移除待办 · ${task.title}`
      })),
      ...list("removedFollowups").map((record) => ({
        ...record,
        entity: "followup",
        operation: "remove",
        label: `删除跟进 · ${record.title}`
      }))
    ];
    const afterRefresh = [
      ...list("customerUpdates").map((item) => ({
        ...item,
        entity: item.target === "profile" ? "profile" : "customer",
        operation: "update",
        label: item.target === "profile" ? "背调资料 · 已更新" : "客户资料 · 已更新"
      })),
      ...list("completedTasks").map((task) => ({
        ...task,
        entity: "task",
        operation: "complete",
        label: "✓"
      })),
      ...list("reopenedTasks").map((task) => ({
        ...task,
        entity: "task",
        operation: "reopen",
        label: `重新打开 · ${task.title}`
      })),
      ...list("addedTasks").map((task) => ({
        ...task,
        entity: "task",
        operation: "add",
        label: `新增待办 · ${task.title}`
      })),
      ...list("updatedTasks").map((task) => ({
        ...task,
        entity: "task",
        operation: "update",
        label: `更新待办 · ${task.title}`
      })),
      ...list("addedFollowups").map((record) => ({
        ...record,
        entity: "followup",
        operation: "add",
        label: `新跟进 · ${record.title}`
      })),
      ...list("updatedFollowups").map((record) => ({
        ...record,
        entity: "followup",
        operation: "update",
        label: `更新跟进 · ${record.title}`
      }))
    ];

    return { beforeRefresh, afterRefresh };
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
    buildKassCrudMotionPlan,
    createDifySseEventParser,
    createFeatureConfigState,
    createFeatureSessionState,
    formatDifyThinkingDuration,
    formatDifyThinkingRoundDuration,
    getDifyReasoningTimeline,
    getDifyReasoningTimelineSignature,
    getKassCrudMotionPhases,
    getKassProcessPresentation,
    getKassStreamRenderPlan,
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
