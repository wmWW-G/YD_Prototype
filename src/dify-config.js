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
    "trade-show"
  ]);

  const CHAT_FEATURE_SET = new Set(CHAT_FEATURE_IDS);

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
   * @returns {{ appType: "dialogue" | "chatflow", apiKeyDraft: string, hasKey: boolean, maskedKey: string, appName: string, appMode: string, loaded: boolean, loading: boolean, saving: boolean, error: string, storageReady: boolean }} 前端配置状态。
   * @throws {Error} 本函数不主动抛异常。
   */
  function createFeatureConfigState(featureId) {
    return {
      appType: String(featureId || "") === "customer-research" ? "chatflow" : "dialogue",
      apiKeyDraft: "",
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
   * @returns {{ messages: object[], conversationId: string, userId: string, error: string, isGenerating: boolean }} 页面会话状态。
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

  const publicApi = {
    CHAT_FEATURE_IDS,
    createFeatureConfigState,
    createFeatureSessionState,
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
