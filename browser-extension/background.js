/* global chrome */

const CONTEXT_MENU_ID = "yingdan-analyze-inquiry-selection";
const COZE_API_URL = "https://api.coze.cn/v3/chat";
const COZE_BOT_ID = "7652274409218670626";
const DEFAULT_COZE_API_TOKEN = "pat_7pQejcfJt4QXYJdzlcWhXm1al5pIYPOguOVAQEBbQrg4dKSOFCjF060us2bhf7Gy";
const COZE_STORAGE_KEYS = {
  apiToken: "cozeApiToken",
  userId: "cozeUserId",
  conversationId: "cozeConversationId"
};

/**
 * 获取当前真正用于请求 Coze 的 Token。
 *
 * 为什么要特殊处理：
 * - 这版是给同事内测的浏览器插件，用户安装后应当能直接对话。
 * - 如果浏览器里曾经保存过旧 Token，继续使用旧值会导致内测包看起来“不可用”。
 * - 手动保存的新 PAT 仍允许覆盖内置值，方便后续灰度或排障。
 * - 后续接赢单登录时，只需要把这个函数改成从登录态或后端换取 Token。
 *
 * @param {unknown} storedToken - Chrome 本地存储里用户手动保存过的 Token。
 * @returns {{ token: string, source: "built-in" | "storage" | "missing" }} Token 和来源。
 * @throws {Error} 本函数不主动抛异常。
 */
function getEffectiveCozeToken(storedToken) {
  const savedToken = String(storedToken || "").trim();

  if (savedToken.startsWith("pat_")) {
    return {
      token: savedToken,
      source: "storage"
    };
  }

  const builtInToken = DEFAULT_COZE_API_TOKEN.trim();

  if (builtInToken) {
    return {
      token: builtInToken,
      source: "built-in"
    };
  }

  return {
    token: "",
    source: "missing"
  };
}

/**
 * 从 Chrome 本地存储读取指定字段。
 *
 * @param {string[]} keys - 需要读取的 storage key。
 * @returns {Promise<Record<string, unknown>>} Chrome storage 返回的键值对象。
 * @throws {Error} Chrome storage 异常时抛出错误。
 */
async function getStorage(keys) {
  return chrome.storage.local.get(keys);
}

/**
 * 写入 Chrome 本地存储。
 *
 * @param {Record<string, unknown>} values - 要保存到 storage 的数据。
 * @returns {Promise<void>} 保存完成后 resolve。
 * @throws {Error} Chrome storage 异常时抛出错误。
 */
async function setStorage(values) {
  await chrome.storage.local.set(values);
}

/**
 * 删除 Chrome 本地存储字段。
 *
 * @param {string | string[]} keys - 要删除的 storage key。
 * @returns {Promise<void>} 删除完成后 resolve。
 * @throws {Error} Chrome storage 异常时抛出错误。
 */
async function removeStorage(keys) {
  await chrome.storage.local.remove(keys);
}

/**
 * 生成或复用 Coze 用户 ID。
 *
 * 为什么要稳定 user_id：
 * - Coze 会用 user_id 区分不同终端用户。
 * - 插件没有登录体系，所以用本地随机 ID 即可，避免所有同事共用同一个 123456789。
 *
 * @returns {Promise<string>} 当前浏览器扩展实例使用的 Coze user_id。
 * @throws {Error} Chrome storage 异常时抛出错误。
 */
async function getOrCreateCozeUserId() {
  const stored = await getStorage([COZE_STORAGE_KEYS.userId]);
  const existingUserId = String(stored[COZE_STORAGE_KEYS.userId] || "").trim();

  if (existingUserId) {
    return existingUserId;
  }

  const randomPart = Math.random().toString(36).slice(2, 12);
  const userId = `yd_extension_${Date.now()}_${randomPart}`;
  await setStorage({ [COZE_STORAGE_KEYS.userId]: userId });
  return userId;
}

/**
 * 生成发给 Coze 的用户消息。
 *
 * @param {{ inquiryText?: string, extraContext?: string, pageTitle?: string, pageUrl?: string, rawMessage?: string }} payload - 插件页面传来的询盘和上下文。
 * @returns {string} 发给 Coze bot 的最终文本。
 * @throws {Error} 文本为空时抛出错误，避免浪费 API 调用。
 */
function buildCozeUserMessage(payload) {
  const rawMessage = String(payload.rawMessage || "").trim();

  if (rawMessage) {
    return rawMessage;
  }

  const inquiryText = String(payload.inquiryText || "").trim();
  const extraContext = String(payload.extraContext || "").trim();
  const pageTitle = String(payload.pageTitle || "").trim();
  const pageUrl = String(payload.pageUrl || "").trim();

  if (inquiryText.length < 2 && extraContext.length < 2) {
    throw new Error("请先粘贴客户询盘、聊天记录或要问赢单的问题。");
  }

  return [
    "请作为赢单外贸成交顾问，分析下面的客户询盘或沟通背景。",
    "",
    "请输出：",
    "1. 客户意图和优先级判断",
    "2. 当前信息缺口",
    "3. 建议补问的问题",
    "4. 下一步成交动作",
    "5. 可直接复制给客户的回复话术",
    "",
    "【询盘/聊天原文】",
    inquiryText || "未提供",
    "",
    "【补充上下文】",
    extraContext || "未提供",
    "",
    "【页面来源】",
    pageTitle || "未提供",
    pageUrl || "未提供"
  ].join("\n");
}

/**
 * 把 fetch 收到的 SSE 文本块拆成事件对象。
 *
 * @param {string} block - 以空行分隔的一段 SSE 原文。
 * @returns {{ event: string, data: string }} 事件名和 data 字符串。
 * @throws {Error} 本函数不主动抛异常；无法解析的数据由上层忽略。
 */
function parseSseBlock(block) {
  const eventParts = [];
  const dataParts = [];

  block.split(/\r?\n/).forEach((line) => {
    if (line.startsWith("event:")) {
      eventParts.push(line.slice(6).trim());
    }

    if (line.startsWith("data:")) {
      dataParts.push(line.slice(5).trim());
    }
  });

  return {
    event: eventParts.join("\n"),
    data: dataParts.join("\n")
  };
}

/**
 * 处理 Coze 的单个 SSE 事件。
 *
 * @param {{ event: string, data: string }} sseEvent - 解析后的 SSE 事件。
 * @param {{ answerParts: string[], completedAnswer: string, followUps: string[], conversationId: string, chatId: string, status: string, lastError: null | { code?: number, msg?: string }, rawPreview: string[] }} state - 当前流式解析状态。
 * @returns {void}
 * @throws {Error} 本函数不主动抛异常；非法 JSON 会被忽略。
 */
function consumeCozeEvent(sseEvent, state) {
  if (!sseEvent.data || sseEvent.data === "[DONE]") {
    return;
  }

  let parsed;

  try {
    parsed = JSON.parse(sseEvent.data);
  } catch (error) {
    console.warn("[赢单插件] 忽略无法解析的 Coze SSE 数据。");
    return;
  }

  if (parsed.conversation_id) {
    state.conversationId = String(parsed.conversation_id);
  }

  if (parsed.id && sseEvent.event.startsWith("conversation.chat.")) {
    state.chatId = String(parsed.id);
  }

  if (parsed.status) {
    state.status = String(parsed.status);
  }

  if (parsed.last_error && parsed.last_error.code) {
    state.lastError = parsed.last_error;
  }

  if (parsed.code && parsed.msg) {
    state.lastError = {
      code: parsed.code,
      msg: parsed.msg
    };
  }

  if (parsed.type === "answer" && (!parsed.content_type || parsed.content_type === "text") && parsed.content) {
    if (!sseEvent.event || sseEvent.event.includes("delta")) {
      state.answerParts.push(parsed.content || "");
      return;
    }

    if (sseEvent.event.includes("completed")) {
      state.completedAnswer = parsed.content || state.completedAnswer;
    }
  }

  if (parsed.type === "follow_up" && parsed.content) {
    state.followUps.push(parsed.content);
  }
}

/**
 * 从 Coze API 读取完整流式回答。
 *
 * @param {Response} response - fetch 返回的响应对象。
 * @returns {Promise<{ answer: string, conversationId: string, chatId: string, followUps: string[], status: string, lastError: null | { code?: number, msg?: string } }>} 解析后的 Coze 回答。
 * @throws {Error} 读取流失败时抛出错误。
 */
async function readCozeStream(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const streamState = {
    answerParts: [],
    completedAnswer: "",
    followUps: [],
    conversationId: "",
    chatId: "",
    status: "",
    lastError: null,
    rawPreview: []
  };
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || "";

    blocks.forEach((block) => {
      if (streamState.rawPreview.join("\n").length < 1200) {
        streamState.rawPreview.push(block.slice(0, 400));
      }
      consumeCozeEvent(parseSseBlock(block), streamState);
    });
  }

  if (buffer.trim()) {
    if (streamState.rawPreview.join("\n").length < 1200) {
      streamState.rawPreview.push(buffer.slice(0, 400));
    }
    consumeCozeEvent(parseSseBlock(buffer), streamState);
  }

  return {
    answer: streamState.answerParts.join("") || streamState.completedAnswer,
    conversationId: streamState.conversationId,
    chatId: streamState.chatId,
    followUps: streamState.followUps,
    status: streamState.status,
    lastError: streamState.lastError,
    rawPreview: streamState.rawPreview.join("\n\n")
  };
}

/**
 * 调用 Coze bot 生成真实成交顾问回答。
 *
 * @param {{ inquiryText?: string, extraContext?: string, pageTitle?: string, pageUrl?: string, rawMessage?: string, resetConversation?: boolean }} payload - 询盘和上下文。
 * @returns {Promise<{ ok: boolean, answer: string, conversationId: string, chatId: string, followUps: string[] }>} Coze 回答结果。
 * @throws {Error} Token 缺失、网络失败或 API 返回错误时抛出错误。
 */
async function chatWithCoze(payload) {
  const stored = await getStorage([
    COZE_STORAGE_KEYS.apiToken,
    COZE_STORAGE_KEYS.conversationId
  ]);
  const tokenInfo = getEffectiveCozeToken(stored[COZE_STORAGE_KEYS.apiToken]);
  const apiToken = tokenInfo.token;

  if (!apiToken) {
    throw new Error("当前内测包没有可用的 Coze API Token。");
  }

  const userId = await getOrCreateCozeUserId();
  const userMessage = buildCozeUserMessage(payload || {});
  const previousConversationId = payload && payload.resetConversation
    ? ""
    : String(stored[COZE_STORAGE_KEYS.conversationId] || "").trim();
  const url = previousConversationId
    ? `${COZE_API_URL}?conversation_id=${encodeURIComponent(previousConversationId)}`
    : `${COZE_API_URL}?`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      bot_id: COZE_BOT_ID,
      user_id: userId,
      stream: true,
      additional_messages: [
        {
          content: userMessage,
          content_type: "text",
          role: "user",
          type: "question"
        }
      ],
      parameters: {}
    })
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text();
    throw new Error(`Coze 请求失败：${response.status} ${errorText}`);
  }

  const result = await readCozeStream(response);

  if (result.lastError && result.lastError.code) {
    throw new Error(result.lastError.msg || `Coze 返回错误码：${result.lastError.code}`);
  }

  if (!result.answer.trim()) {
    throw new Error(`Coze 没有返回可显示的回答。流片段：${result.rawPreview || "空"}`);
  }

  if (result.conversationId) {
    await setStorage({ [COZE_STORAGE_KEYS.conversationId]: result.conversationId });
  }

  return {
    ok: true,
    answer: result.answer.trim(),
    conversationId: result.conversationId || previousConversationId,
    chatId: result.chatId,
    followUps: result.followUps,
    tokenSource: tokenInfo.source
  };
}

/**
 * 保存 Coze API Token。
 *
 * @param {{ apiToken?: string }} payload - 后续登录或调试入口传来的 Token 数据。
 * @returns {Promise<{ ok: boolean, hasToken: boolean }>} 保存状态。
 * @throws {Error} Chrome storage 异常时抛出错误。
 */
async function saveCozeToken(payload) {
  const apiToken = String(payload && payload.apiToken ? payload.apiToken : "").trim();

  if (!apiToken) {
    await removeStorage([
      COZE_STORAGE_KEYS.apiToken,
      COZE_STORAGE_KEYS.conversationId
    ]);
    return { ok: true, hasToken: false };
  }

  await setStorage({ [COZE_STORAGE_KEYS.apiToken]: apiToken });
  return { ok: true, hasToken: true };
}

/**
 * 返回 Coze 配置状态。
 *
 * @returns {Promise<{ ok: boolean, hasToken: boolean, conversationId: string }>} 配置状态。
 * @throws {Error} Chrome storage 异常时抛出错误。
 */
async function getCozeSettings() {
  const stored = await getStorage([
    COZE_STORAGE_KEYS.apiToken,
    COZE_STORAGE_KEYS.conversationId
  ]);
  const tokenInfo = getEffectiveCozeToken(stored[COZE_STORAGE_KEYS.apiToken]);

  return {
    ok: true,
    hasToken: Boolean(tokenInfo.token),
    tokenSource: tokenInfo.source,
    conversationId: String(stored[COZE_STORAGE_KEYS.conversationId] || "")
  };
}

/**
 * 清空当前 Coze 会话 ID。
 *
 * @returns {Promise<{ ok: boolean }>} 清空状态。
 * @throws {Error} Chrome storage 异常时抛出错误。
 */
async function resetCozeConversation() {
  await removeStorage(COZE_STORAGE_KEYS.conversationId);
  return { ok: true };
}

/**
 * 初始化右键菜单。
 *
 * 作用：
 * - 让业务员在询盘页面选中文字后，可以直接右键唤起赢单分析。
 * - 这里不做真实 API 调用，只负责把选中文本交给页面内侧边面板。
 *
 * @returns {void}
 * @throws {Error} Chrome 扩展环境异常时，错误会由 runtime.lastError 暴露。
 */
function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: "用赢单分析这段询盘",
      contexts: ["selection"]
    });
  });
}

/**
 * 判断当前标签页是否允许注入内容脚本。
 *
 * 为什么要判断：
 * - Chrome 内置页面、扩展商店等页面禁止普通扩展注入。
 * - 提前判断可以避免用户点了以后没有反馈。
 *
 * @param {chrome.tabs.Tab | undefined} tab - 当前浏览器标签页。
 * @returns {boolean} 可以注入时返回 true。
 * @throws {Error} 本函数不主动抛异常。
 */
function canInjectIntoTab(tab) {
  return Boolean(tab && tab.id && tab.url && /^https?:\/\//.test(tab.url));
}

/**
 * 确保内容脚本已经在页面里可用。
 *
 * @param {number} tabId - Chrome 标签页 ID。
 * @returns {Promise<void>} 注入完成后 resolve。
 * @throws {Error} 注入失败时抛出错误，通常是页面不允许扩展访问。
 */
async function ensureContentScripts(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["inquiry-analyzer.js", "content-script.js"]
  });
}

/**
 * 向内容脚本发送消息，失败时尝试补注入一次。
 *
 * @param {number} tabId - Chrome 标签页 ID。
 * @param {Record<string, unknown>} message - 要发送给内容脚本的消息。
 * @returns {Promise<unknown>} 内容脚本返回值。
 * @throws {Error} 二次发送仍失败时抛出错误。
 */
async function sendMessageWithInjection(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (firstError) {
    await ensureContentScripts(tabId);
    return chrome.tabs.sendMessage(tabId, message);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  setupContextMenu();
  console.log("[赢单插件] 右键询盘分析菜单已初始化。");
});

chrome.runtime.onStartup.addListener(() => {
  setupContextMenu();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) {
    return;
  }

  if (!canInjectIntoTab(tab)) {
    console.warn("[赢单插件] 当前页面不支持询盘分析面板。");
    return;
  }

  sendMessageWithInjection(tab.id, {
    type: "YD_OPEN_ANALYZER",
    payload: {
      inquiryText: info.selectionText || "",
      source: "selection",
      pageTitle: tab.title || "",
      pageUrl: tab.url || ""
    }
  }).catch((error) => {
    console.error("[赢单插件] 打开询盘分析面板失败：", error);
  });
});

chrome.action.onClicked.addListener((tab) => {
  if (!canInjectIntoTab(tab)) {
    console.warn("[赢单插件] 当前页面不支持打开侧边对话栏。");
    return;
  }

  sendMessageWithInjection(tab.id, {
    type: "YD_OPEN_ANALYZER",
    payload: {
      inquiryText: "",
      source: "action",
      pageTitle: tab.title || "",
      pageUrl: tab.url || ""
    }
  }).catch((error) => {
    console.error("[赢单插件] 点击图标打开侧边对话栏失败：", error);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }

  const respond = async () => {
    if (message.type === "YD_COZE_CHAT") {
      return chatWithCoze(message.payload || {});
    }

    if (message.type === "YD_SAVE_COZE_TOKEN") {
      return saveCozeToken(message.payload || {});
    }

    if (message.type === "YD_GET_COZE_SETTINGS") {
      return getCozeSettings();
    }

    if (message.type === "YD_RESET_COZE_CONVERSATION") {
      return resetCozeConversation();
    }

    return { ok: false, error: "未知的插件消息类型。" };
  };

  respond()
    .then((result) => {
      sendResponse(result);
    })
    .catch((error) => {
      console.error("[赢单插件] 后台任务失败：", error);
      sendResponse({
        ok: false,
        error: error.message || String(error)
      });
    });

  return true;
});
