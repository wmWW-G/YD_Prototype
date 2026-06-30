import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * createAgentSessionStore 创建新对话线程的轻量持久化仓库。
 *
 * 作用：
 * - 把新对话的 sessionId、消息、等待确认状态、产物上下文写入 `workbench/agent-sessions/`。
 * - 让前端刷新后只要还记得 sessionId，就能从后端恢复任务线程。
 * - 这是原型阶段的文件存储；正式版可把同一接口迁移到 SQLite 或服务端会话表。
 *
 * 参数：
 * - options.projectRoot：项目根目录，字符串。
 *
 * 返回值：包含 read() 和 saveTurn() 的仓库对象。
 * 可能抛出的异常：读写文件失败时抛出；调用方负责转成 HTTP 错误。
 */
export function createAgentSessionStore(options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const sessionsRoot = path.join(projectRoot, 'workbench', 'agent-sessions');

  return {
    /**
     * read 读取一个新对话线程。
     *
     * 参数：
     * - sessionId：前端传回的任务线程 ID。
     *
     * 返回值：线程状态对象；不存在或 ID 不合法时返回 null。
     * 可能抛出的异常：文件存在但 JSON 损坏时抛出，便于尽早发现存储问题。
     */
    async read(sessionId) {
      const safeSessionId = normalizeSessionId(sessionId);
      if (!safeSessionId) {
        return null;
      }

      try {
        const content = await readFile(getSessionPath(sessionsRoot, safeSessionId), 'utf8');
        const parsed = JSON.parse(content);
        return parsed && typeof parsed === 'object' ? sanitizeSessionForRead(parsed) : null;
      } catch (error) {
        if (error.code === 'ENOENT') {
          return null;
        }
        throw error;
      }
    },

    /**
     * list 列出最近的新对话线程摘要。
     *
     * 作用：
     * - 让前台可以像 Codex / Claude Code 一样回到最近任务线程。
     * - 只返回业务标题、状态、产物名和最近用户诉求,不暴露 runId、路径或内部 context。
     *
     * 参数：
     * - input.limit：最多返回多少条,默认 20。
     *
     * 返回值：线程摘要数组,按 updatedAt 从新到旧排序。
     * 可能抛出的异常：目录读取或 JSON 解析失败时抛出；目录不存在时返回空数组。
     */
    async list(input = {}) {
      const limit = normalizeListLimit(input.limit);
      let entries = [];
      try {
        entries = await readdir(sessionsRoot, { withFileTypes: true });
      } catch (error) {
        if (error.code === 'ENOENT') {
          return [];
        }
        throw error;
      }

      const sessions = [];
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.json')) {
          continue;
        }
        const sessionId = entry.name.replace(/\.json$/u, '');
        if (!normalizeSessionId(sessionId)) {
          continue;
        }
        const raw = await readFile(path.join(sessionsRoot, entry.name), 'utf8');
        const session = sanitizeSessionForRead(JSON.parse(raw));
        const summary = toSessionListItem(session);
        if (summary) {
          sessions.push(summary);
        }
      }

      return sessions
        .sort(compareSessionListItemsByRecency)
        .slice(0, limit);
    },

    /**
     * saveTurn 保存一次用户消息和 Agent 响应后的线程状态。
     *
     * 参数：
     * - input.sessionId：本轮响应里的 sessionId。
     * - input.userText：用户本轮输入。
     * - input.requestContext：执行前使用的上下文。
     * - input.response：runNewConversationAgent 返回给前端的响应对象。
     *
     * 返回值：写入后的线程状态对象；sessionId 不合法时返回 null。
     * 可能抛出的异常：目录创建或文件写入失败时抛出。
     */
    async saveTurn(input = {}) {
      const safeSessionId = normalizeSessionId(input.sessionId || input.response?.sessionId);
      if (!safeSessionId) {
        return null;
      }

      const previous = (await this.read(safeSessionId)) || {
        createdAt: new Date().toISOString(),
        messages: [],
        sessionId: safeSessionId,
      };
      const response = input.response || {};
      const now = new Date().toISOString();
      const context = Object.prototype.hasOwnProperty.call(response, 'context')
        ? response.context || {}
        : input.requestContext || previous.context || {};
      const messages = mergeTurnMessages(previous.messages || [], input.userText, response.messages || []);
      const taskTitle = pickTaskTitle(response, previous);
      const state = {
        ...previous,
        artifact: response.artifact || previous.artifact || null,
        context,
        expandedProcessMessageId: findLatestProcessMessageId(messages) || previous.expandedProcessMessageId || '',
        kind: response.kind || previous.kind || '',
        messages,
        period: response.period || previous.period || {},
        sessionId: safeSessionId,
        skillAgentResult: response.artifact ? toStoredAgentResult(response) : previous.skillAgentResult || null,
        status: response.status || previous.status || 'waiting',
        summary: response.summary || previous.summary || '',
        taskTitle,
        updatedAt: now,
      };

      await mkdir(sessionsRoot, { recursive: true });
      await writeFile(getSessionPath(sessionsRoot, safeSessionId), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
      return state;
    },
  };
}

/**
 * sanitizeSessionForRead 清理历史 session 里的过期待确认状态。
 *
 * 作用：
 * - 早期实现里,确认保存成功后可能仍把 `pendingConfirmation` 留在 context。
 * - 读取时如果状态已经 completed / confirmation-accepted,就忽略这类旧标记,
 *   避免用户刷新后再说一句话时被误当成再次确认。
 *
 * 参数：
 * - session：从磁盘读取出的 session 对象。
 *
 * 返回值：清理后的 session 对象。
 * 可能抛出的异常：无。
 */
function sanitizeSessionForRead(session = {}) {
  const isCompletedConfirmation = session.status === 'completed' || session.kind === 'confirmation-accepted';
  if (!isCompletedConfirmation || !session.context?.pendingConfirmation) {
    return session;
  }

  const { pendingConfirmation: _stalePendingConfirmation, ...context } = session.context;
  return {
    ...session,
    context,
  };
}

/**
 * normalizeSessionId 校验并标准化 sessionId。
 *
 * 参数：
 * - sessionId：任意输入值。
 *
 * 返回值：安全的 sessionId；不合法时返回空字符串。
 * 可能抛出的异常：无。
 */
function normalizeSessionId(sessionId) {
  const value = String(sessionId || '').trim();
  if (!/^agent-session-[A-Za-z0-9T_-]+$/.test(value)) {
    return '';
  }
  return value;
}

function getSessionPath(sessionsRoot, sessionId) {
  return path.join(sessionsRoot, `${sessionId}.json`);
}

/**
 * normalizeListLimit 规整 session 列表数量。
 *
 * 参数：
 * - value：调用方传入的 limit。
 *
 * 返回值：1 到 50 之间的整数。
 * 可能抛出的异常：无。
 */
function normalizeListLimit(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 20;
  }
  return Math.max(1, Math.min(50, Math.floor(number)));
}

/**
 * toSessionListItem 把完整 session 转成前台历史列表摘要。
 *
 * 作用：
 * - 历史列表只用于用户识别和切回任务,不需要内部 context、runId、路径或消息全文。
 * - 预览优先取最近一条用户消息,比摘要更接近用户当时交代的任务。
 *
 * 参数：
 * - session：完整 session 状态。
 *
 * 返回值：安全摘要对象；无 sessionId 时返回 null。
 * 可能抛出的异常：无。
 */
function toSessionListItem(session = {}) {
  const sessionId = normalizeSessionId(session.sessionId);
  if (!sessionId) {
    return null;
  }

  const artifact = session.artifact || session.context?.artifact || session.skillAgentResult?.artifact || {};
  return compactObject({
    artifactName: safeDisplayText(artifact.workbookName || artifact.name),
    createdAt: session.createdAt,
    kind: safeDisplayText(session.kind),
    preview: latestUserMessagePreview(session.messages),
    sessionId,
    status: safeDisplayText(session.status || 'waiting'),
    taskTitle: safeDisplayText(session.taskTitle || session.skillAgentResult?.taskTitle || artifact.workbookName || artifact.name || '外贸任务'),
    updatedAt: session.updatedAt || session.createdAt,
  });
}

/**
 * compareSessionListItemsByRecency 按最近更新时间排序 session 摘要。
 *
 * 作用：
 * - 两次保存可能发生在同一毫秒,只按 updatedAt 排序会退回文件系统读取顺序。
 * - sessionId 本身带创建时间戳,可作为稳定兜底,让历史列表更像真实最近任务。
 *
 * 参数：
 * - left/right：toSessionListItem() 生成的 session 摘要。
 *
 * 返回值：Array.sort 兼容的比较结果；越新的 session 排在越前。
 * 可能抛出的异常：无。
 */
function compareSessionListItemsByRecency(left = {}, right = {}) {
  const rightTime = String(right.updatedAt || right.createdAt || '');
  const leftTime = String(left.updatedAt || left.createdAt || '');
  const timeOrder = rightTime.localeCompare(leftTime);
  if (timeOrder !== 0) {
    return timeOrder;
  }
  return String(right.sessionId || '').localeCompare(String(left.sessionId || ''));
}

function latestUserMessagePreview(messages = []) {
  const message = [...(Array.isArray(messages) ? messages : [])].reverse().find((item) => item?.role === 'user' && item.content);
  return safeDisplayText(message?.content || '').slice(0, 90);
}

function safeDisplayText(value = '') {
  const text = String(value || '');
  if (looksLikeInternalText(text)) {
    return '';
  }
  return text;
}

function looksLikeInternalText(value = '') {
  return /(?:\/Users\/|\\Users\\|workbench\/runs|workbench\\runs|skill-runtime-|checkpointPath|runLogPath|outputPath|manifestPath)/u.test(String(value || ''));
}

function compactObject(value = {}) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ''));
}

/**
 * mergeTurnMessages 合并线程消息。
 *
 * 作用：
 * - 前端每次发送前都会显示用户消息；后端存储也要保存同样的用户输入。
 * - response.messages 里可能包含内部构造的 user 消息，存储时只取 assistant 消息，避免重复用户气泡。
 *
 * 参数：
 * - previousMessages：旧消息数组。
 * - userText：本轮用户输入。
 * - responseMessages：后端响应消息数组。
 *
 * 返回值：合并后的消息数组。
 * 可能抛出的异常：无。
 */
function mergeTurnMessages(previousMessages = [], userText = '', responseMessages = []) {
  const nextMessages = [...previousMessages];
  const cleanUserText = String(userText || '').trim();

  if (cleanUserText) {
    nextMessages.push({
      id: messageId('user'),
      role: 'user',
      content: cleanUserText,
      createdAt: new Date().toISOString(),
    });
  }

  for (const message of responseMessages) {
    if (message?.role === 'assistant') {
      nextMessages.push(message);
    }
  }

  return dedupeMessages(nextMessages);
}

function dedupeMessages(messages = []) {
  const seen = new Set();
  const result = [];
  for (const message of messages) {
    const key = message.id || `${message.role}:${message.createdAt}:${message.content}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(message);
  }
  return result;
}

function findLatestProcessMessageId(messages = []) {
  const processMessage = [...messages].reverse().find((message) => message?.activity || message?.process);
  return processMessage?.id || '';
}

function toStoredAgentResult(response = {}) {
  return {
    artifact: response.artifact,
    goal: response.goal,
    kind: response.kind,
    loop: response.loop,
    mode: response.mode,
    period: response.period,
    plan: response.plan,
    progress: response.progress,
    runId: response.runId,
    sessionId: response.sessionId,
    skillId: response.skillId,
    status: response.status,
    summary: response.summary,
    taskTitle: response.taskTitle || response.artifact?.workbookName || response.artifact?.name || '',
  };
}

/**
 * pickTaskTitle 为 session 选择可恢复的业务任务标题。
 *
 * 作用：
 * - 新对话刷新后仍要显示“开发信草稿 / 客户推进分析”等业务任务名。
 * - 优先使用本轮响应识别出的标题；没有新标题时沿用上一轮标题。
 * - 不使用 runId、skillId 或文件路径，避免把内部实现细节带到前台。
 *
 * 参数：
 * - response：本轮 Agent 响应。
 * - previous：上一版 session 状态。
 *
 * 返回值：业务任务标题字符串；没有可用标题时返回空字符串。
 * 可能抛出的异常：无。
 */
function pickTaskTitle(response = {}, previous = {}) {
  const responseTitle = isConfirmationOnlyTitle(response) ? '' : response.taskTitle;
  const previousTitle = isConfirmationOnlyTitle(previous) ? '' : previous.taskTitle;
  return (
    responseTitle ||
    response.context?.pendingTask?.skillName ||
    previous.skillAgentResult?.taskTitle ||
    previousTitle ||
    response.artifact?.workbookName ||
    response.artifact?.name ||
    previous.artifact?.workbookName ||
    previous.artifact?.name ||
    ''
  );
}

/**
 * isConfirmationOnlyTitle 判断一个标题是否只是确认卡标题。
 *
 * 作用：
 * - 保存、导出、外发、扣费确认可以临时显示为线程标题。
 * - 但一旦确认完成,session 应恢复业务任务标题,例如“客户推进分析”。
 * - 这个 helper 避免把“写入客户档案前需要确认”持久化成业务任务名。
 *
 * 参数：
 * - value：response 或 previous session。
 *
 * 返回值：boolean，true 表示 taskTitle 只是确认动作标题。
 * 可能抛出的异常：无。
 */
function isConfirmationOnlyTitle(value = {}) {
  const title = value.taskTitle || '';
  if (!title) {
    return false;
  }
  if (value.kind !== 'confirmation-required') {
    return false;
  }
  const confirmationTitle =
    value.context?.pendingConfirmation?.title ||
    [...(value.messages || [])].reverse().find((message) => message?.confirmation?.title)?.confirmation?.title ||
    '';
  return Boolean(confirmationTitle && title === confirmationTitle);
}

function messageId(role) {
  return `${role}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
