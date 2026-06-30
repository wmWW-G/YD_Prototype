/**
 * formatSseEvent 把事件名和 JSON 数据编码成 SSE 文本块。
 *
 * 作用：
 * - 让 `/api/agent/message/stream` 可以持续把进度推给前端。
 * - 数据仍是机器可读 JSON,但只包含前台可展示的业务语言。
 *
 * 参数：
 * - eventName：SSE 事件名,例如 progress / result / error。
 * - data：要写入 data 行的 JSON 对象。
 *
 * 返回值：符合 text/event-stream 格式的字符串。
 * 可能抛出的异常：当 data 中包含不能 JSON 序列化的值时,JSON.stringify 会抛异常。
 */
export function formatSseEvent(eventName, data = {}) {
  return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * createInitialAgentStreamProgress 生成新对话流式响应的第一条可见进度。
 *
 * 作用：
 * - 让前台一开始就看到“识别任务”,像 agent 正在理解目标。
 * - 避免展示“收到任务”这类通知式文案,降低 Codex / Claude Code 式执行感。
 * - 后续 Runtime 的 `goal.received` 事件会更新同一个步骤为完成态。
 *
 * 参数：无。
 *
 * 返回值：前端可直接渲染的 progress 数据。
 * 可能抛出的异常：无。
 */
export function createInitialAgentStreamProgress() {
  return {
    detail: '正在理解这次外贸任务要完成什么。',
    label: '识别任务',
    status: 'running',
  };
}

/**
 * runtimeEventToStreamEvent 把 Runtime 内部事件翻译成前台进度事件。
 *
 * 作用：
 * - Runtime 仍可以记录 `goal.received`、`policy.checked` 这类内部事件。
 * - 前台只看到“识别任务 / 核对资料 / 生成材料 / 检查结果”等业务进度。
 * - 避免把 action、tool、schema、policy 名称直接展示给业务用户。
 *
 * 参数：
 * - event：Runtime 写入 run log 的事件对象。
 *
 * 返回值：{event, data}；不需要推给前台的事件返回 null。
 * 可能抛出的异常：无。
 */
export function runtimeEventToStreamEvent(event = {}) {
  const mapped = progressMap[event.type];
  if (!mapped) {
    return null;
  }

  const status = event.status || (event.decision === 'deny' ? 'error' : 'complete');
  return {
    event: 'progress',
    data: {
      detail: detailForEvent(event, mapped.detail),
      label: mapped.label,
      status: normalizeProgressStatus(status),
    },
  };
}

/**
 * createConsecutiveProgressDeduper 创建单条 SSE 流内的连续进度去重器。
 *
 * 作用：
 * - Runtime 可以为了审计记录多次相同内部事件。
 * - 前台不应该连续看到两条完全一样的“核对权限”或“检查结果”,那会像机器日志。
 * - 只去掉连续且展示内容一致的 progress;如果状态、详情或标签变化,仍然发给前台。
 *
 * 参数：无。
 *
 * 返回值：一个函数,接收 streamEvent,返回原事件或 null。
 * 可能抛出的异常：无。
 */
export function createConsecutiveProgressDeduper() {
  let lastProgressKey = '';

  return function dedupeConsecutiveProgress(streamEvent = null) {
    if (!streamEvent || streamEvent.event !== 'progress') {
      return streamEvent;
    }

    const data = streamEvent.data || {};
    const progressKey = [data.label || '', data.detail || '', data.status || ''].join('\u0000');
    if (progressKey === lastProgressKey) {
      return null;
    }

    lastProgressKey = progressKey;
    return streamEvent;
  };
}

/**
 * sanitizeAgentResultForFrontend 把 Agent 内部执行结果整理成前台可见对象。
 *
 * 作用：
 * - 后端可以保留 goal / loop / plan / runId 等调试信息,方便 session 和日志排查。
 * - 前台只拿到 Codex/Claude Code 风格的线程信息:状态、进度、人话消息、产物和上下文。
 * - 避免把 `goal.classify`、`skillId`、`tool call`、schema 或 raw runtime action 泄露到 UI 层。
 *
 * 参数：
 * - result：runNewConversationAgent 返回的完整结果对象。
 *
 * 返回值：适合 HTTP / SSE 返回给前端的浅净化对象。
 * 可能抛出的异常：无。
 */
export function sanitizeAgentResultForFrontend(result = {}) {
  const taskTitle = result.taskTitle ||
    result.goal?.skill?.displayName ||
    result.skill?.displayName ||
    result.artifact?.workbookName ||
    result.artifact?.name ||
    '本次外贸任务';
  return compactObject({
    ok: result.ok,
    error: result.error,
    message: result.message,
    kind: result.kind,
    sessionId: result.sessionId,
    status: result.status,
    taskTitle,
    summary: result.summary,
    period: result.period,
    progress: sanitizeProgressItems(result.progress),
    artifact: sanitizeArtifact(result.artifact),
    context: sanitizeContext(result.context),
    messages: sanitizeImmediateResultMessages(result.messages),
  });
}

/**
 * sanitizeAgentSessionForFrontend 把后端 session 文件整理成前端恢复 UI 可用的安全形态。
 *
 * 作用：
 * - session 文件里可以保存真实路径、runId、loop 和 pendingConfirmation,供后端继续预览、导出和恢复。
 * - `/api/agent/session/:sessionId` 只返回前台需要的消息、产物摘要和 UI 状态。
 * - 确认卡本身已在 messages 里,前端刷新后无需看到 pendingConfirmation 的内部执行信息。
 *
 * 参数：
 * - session：agent-session-store 读出的完整 session 对象。
 *
 * 返回值：前端可恢复的 session 摘要。
 * 可能抛出的异常：无。
 */
export function sanitizeAgentSessionForFrontend(session = {}) {
  return compactObject({
    artifact: sanitizeArtifact(session.artifact),
    context: sanitizeContext(session.context),
    createdAt: session.createdAt,
    expandedProcessMessageId: session.expandedProcessMessageId,
    kind: session.kind,
    messages: sanitizeMessages(session.messages),
    period: session.period,
    sessionId: session.sessionId,
    skillAgentResult: sanitizeStoredAgentResult(session.skillAgentResult),
    status: session.status,
    summary: session.summary,
    taskTitle: safeDisplayText(
      session.taskTitle ||
        session.skillAgentResult?.taskTitle ||
        session.context?.pendingTask?.skillName ||
        session.artifact?.workbookName ||
        session.artifact?.name
    ),
    updatedAt: session.updatedAt,
  });
}

/**
 * buildRecoverableAgentErrorResult 把后端执行异常整理成可继续的任务线程。
 *
 * 作用：
 * - 新对话要像 Codex / Claude Code 一样,即使某一步卡住,也应该落成一条助手消息。
 * - 前台收到的是 waiting result,可以继续补充资料或换一种说法,而不是看到 raw runtime error。
 * - 原始异常只用于后端日志排查;这里不把 stack、runId、action 名或底层工具名暴露给业务用户。
 *
 * 参数：
 * - input.error：捕获到的异常对象,只用于判断是否存在异常,不会直接展示给前台。
 * - input.sessionId：已有任务线程 ID；为空时创建新的安全 ID。
 * - input.userText：用户本轮输入,用于后端 session 保存 pending task。
 *
 * 返回值：runNewConversationAgent 兼容的 waiting 响应对象。
 * 可能抛出的异常：无。
 */
export function buildRecoverableAgentErrorResult(input = {}) {
  const sessionId = normalizeAgentSessionId(input.sessionId) || createAgentSessionId();
  const userText = String(input.userText || '').trim();
  const createdAt = new Date().toISOString();
  const progress = [
    {
      detail: '已收到这次外贸任务。',
      label: '识别任务',
      status: 'complete',
    },
    {
      detail: '执行过程中有一步没有完成,我先停下来避免继续编造结果。',
      label: '处理卡住',
      status: 'error',
    },
    {
      detail: '可以直接补充资料、换一种说法,或指定要生成的产物。',
      label: '等待补充',
      status: 'waiting',
    },
  ];
  const content = [
    '我这一步处理卡住了,所以没有继续编造结果。',
    '可以直接补充资料、换一种说法,或告诉我要生成邮件草稿、客户分析、跟进计划还是表格,我会接着这次任务继续处理。',
  ].join(' ');

  return {
    ok: true,
    kind: 'needs-input',
    sessionId,
    status: 'waiting',
    summary: content,
    taskTitle: '本次外贸任务',
    progress,
    context: {
      pendingTask: {
        missing: ['更多业务资料或更明确的产物要求'],
        originalText: userText,
        reason: 'agent_recoverable_error',
      },
    },
    messages: [
      {
        id: messageId('assistant'),
        role: 'assistant',
        content,
        createdAt,
        tone: 'warning',
        process: {
          expanded: false,
          title: '任务处理过程',
          steps: progress,
        },
        activity: {
          expanded: false,
          title: '本次操作记录',
          items: [
            {
              detail: '已记录用户交代的任务。',
              status: 'complete',
              title: '识别任务',
            },
            {
              detail: '没有继续执行可能产生误导结果的步骤。',
              status: 'error',
              title: '处理卡住',
            },
            {
              detail: '等待用户补充资料后继续同一次任务。',
              status: 'waiting',
              title: '等待补充',
            },
          ],
        },
      },
    ],
  };
}

const progressMap = {
  'goal.received': {
    label: '识别任务',
    detail: '正在理解这次外贸任务要完成什么。',
  },
  'skill.matched': {
    label: '确认任务类型',
    detail: '已判断这次任务要产出的业务材料。',
  },
  'skill.loaded': {
    label: '核对资料',
    detail: '正在核对任务资料、规则和产物要求。',
  },
  'plan.created': {
    label: '拆解任务',
    detail: '正在把任务拆成可执行步骤。',
  },
  'policy.checked': {
    label: '核对权限',
    detail: '正在检查这一步是否需要你确认。',
  },
  'run.checkpointed': {
    label: '保存进度',
    detail: '已保存当前进度,等待你确认后可继续。',
  },
  'run.waiting': {
    label: '等待确认',
    detail: '这一步需要你确认后再继续。',
  },
  'run.needs_input': {
    label: '等待补充',
    detail: '还缺关键业务资料,请补充后我再继续。',
  },
  'run.resumed': {
    label: '继续执行',
    detail: '已从刚才暂停的位置继续。',
  },
  'action.executed': {
    label: '生成材料',
    detail: '正在生成这次任务的业务材料。',
  },
  'observation.recorded': {
    label: '整理发现',
    detail: '正在整理关键发现和下一步。',
  },
  'artifact.verified': {
    label: '检查结果',
    detail: '正在检查产物是否可以交付。',
  },
  'run.completed': {
    label: '完成',
    detail: '这次任务已经处理到可交付状态。',
  },
  'run.failed': {
    label: '处理卡住',
    detail: '这次任务没有完成,需要检查资料或执行方式。',
  },
};

function detailForEvent(event = {}, fallback = '') {
  if (event.type === 'policy.checked') {
    if (event.decision === 'ask') {
      return '这一步需要你确认,我会先停下来。';
    }
    if (event.decision === 'deny') {
      return '这一步不允许自动执行。';
    }
  }
  if (event.type === 'artifact.verified' && event.status === 'failed') {
    return '产物检查没有通过,需要修正后才能交付。';
  }
  if (event.type === 'run.needs_input' && Array.isArray(event.missing) && event.missing.length > 0) {
    return `还缺: ${event.missing.join('、')}。请补充后我再继续。`;
  }
  return fallback;
}

function normalizeProgressStatus(status) {
  if (status === 'waiting') {
    return 'waiting';
  }
  if (status === 'failed' || status === 'denied' || status === 'error') {
    return 'error';
  }
  if (status === 'unsupported') {
    return 'error';
  }
  return 'complete';
}

function sanitizeMessages(messages = []) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages.map((message) => compactObject({
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    tone: message.tone,
    confirmation: sanitizeConfirmation(message.confirmation),
    needsInput: sanitizeNeedsInput(message.needsInput),
    process: sanitizeProcess(message.process),
    activity: sanitizeActivity(message.activity),
    artifact: sanitizeArtifact(message.artifact),
  }));
}

/**
 * sanitizeImmediateResultMessages 净化单轮 Agent result 里的消息。
 *
 * 作用：
 * - 前端在发送请求时已经本地追加了用户气泡,即时 result 只需要返回助手消息。
 * - 某些续接路径会把“原始任务 + 补充资料 + 产出类型”拼成内部 userText 交给 Runtime。
 * - 这些内部恢复文本不能进入公开 payload,否则用户会看到“产出类型 / 补充资料”这类系统拼接味道。
 *
 * 参数：
 * - messages：runNewConversationAgent 返回的原始 messages 数组。
 *
 * 返回值：只包含助手消息的净化数组。
 * 可能抛出的异常：无。
 */
function sanitizeImmediateResultMessages(messages = []) {
  return sanitizeMessages(messages).filter((message) => message.role === 'assistant');
}

function sanitizeProgressItems(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => compactObject({
    detail: scrubInternalToken(item.detail),
    label: scrubInternalToken(item.label),
    status: normalizeProgressStatus(item.status),
  }));
}

function sanitizeProcess(process = null) {
  if (!process || typeof process !== 'object') {
    return undefined;
  }

  return compactObject({
    expanded: Boolean(process.expanded),
    steps: sanitizeProgressItems(process.steps),
    title: scrubInternalToken(process.title),
  });
}

function sanitizeActivity(activity = null) {
  if (!activity || typeof activity !== 'object') {
    return undefined;
  }

  return compactObject({
    expanded: Boolean(activity.expanded),
    items: Array.isArray(activity.items) ? activity.items.map(sanitizeActivityItem) : [],
    title: scrubInternalToken(activity.title),
  });
}

function sanitizeActivityItem(item = {}) {
  const observation = scrubInternalToken(item.observation);
  const nextAction = scrubTerminalPlaceholder(scrubInternalToken(item.nextAction));
  return compactObject({
    detail: scrubInternalToken(item.detail),
    kind: scrubInternalToken(item.kind),
    nextAction: nextAction && nextAction !== item.nextAction ? nextAction : safeDisplayText(nextAction),
    observation: observation && observation !== item.observation ? observation : safeDisplayText(observation),
    status: normalizeProgressStatus(item.status),
    title: scrubInternalToken(item.title),
  });
}

function scrubTerminalPlaceholder(value = '') {
  if (typeof value !== 'string') {
    return value;
  }
  return /^(?:none|null|undefined|finish|done|end)$/iu.test(value.trim()) ? '' : value;
}

function sanitizeArtifact(artifact = null) {
  if (!artifact || typeof artifact !== 'object') {
    return artifact === null ? null : undefined;
  }

  return compactObject({
    exportedFrom: artifact.exportedFrom ? 'previous-artifact' : undefined,
    name: artifact.name,
    revisedAt: artifact.revisedAt,
    sizeBytes: artifact.sizeBytes,
    type: artifact.type,
    workbookName: artifact.workbookName || artifact.name,
  });
}

function sanitizeContext(context = null) {
  if (!context || typeof context !== 'object') {
    return {};
  }

  return compactObject({
    artifact: sanitizeArtifact(context.artifact),
    customerSlug: context.customerSlug,
    lastCustomerSave: context.lastCustomerSave,
    pendingTask: sanitizePendingTask(context.pendingTask),
    period: context.period,
  });
}

function sanitizeStoredAgentResult(result = null) {
  if (!result || typeof result !== 'object') {
    return null;
  }

  return compactObject({
    artifact: sanitizeArtifact(result.artifact),
    kind: result.kind,
    period: result.period,
    progress: sanitizeProgressItems(result.progress),
    sessionId: result.sessionId,
    status: result.status,
    summary: result.summary,
    taskTitle: result.taskTitle || result.artifact?.workbookName || result.artifact?.name,
  });
}

function sanitizeConfirmation(confirmation = null) {
  if (!confirmation || typeof confirmation !== 'object') {
    return undefined;
  }

  return compactObject({
    body: scrubInternalToken(confirmation.body),
    cancelLabel: scrubInternalToken(confirmation.cancelLabel),
    confirmLabel: scrubInternalToken(confirmation.confirmLabel),
    title: scrubInternalToken(confirmation.title),
  });
}

/**
 * sanitizeNeedsInput 保留前台要展示的缺资料清单。
 *
 * 作用：
 * - needsInput 是用户可见的等待态卡片,应该保留 title、items 和 hint。
 * - 清单项只走业务文案,不允许内部 runtime/action/schema 名称穿透到 UI。
 *
 * 参数：
 * - needsInput：后端消息里的缺资料卡片对象。
 *
 * 返回值：净化后的缺资料卡片；没有有效 items 时返回 undefined。
 * 可能抛出的异常：无。
 */
function sanitizeNeedsInput(needsInput = null) {
  if (!needsInput || typeof needsInput !== 'object') {
    return undefined;
  }

  const items = Array.isArray(needsInput.items)
    ? needsInput.items.map(scrubInternalToken).filter(Boolean)
    : [];
  if (!items.length) {
    return undefined;
  }

  return compactObject({
    hint: scrubInternalToken(needsInput.hint),
    items,
    title: scrubInternalToken(needsInput.title),
  });
}

/**
 * sanitizePendingTask 保留前台续接任务所需的安全摘要。
 *
 * 作用：
 * - 前台需要知道同一个线程还在等资料,才能把下一句话按“继续补充”处理。
 * - 只保留任务名、原始诉求和缺失项,不暴露 skillId、runId、路径或内部工具字段。
 *
 * 参数：
 * - pendingTask：后端 context 中的待补充任务对象。
 *
 * 返回值：净化后的 pendingTask；没有有效缺失项时返回 undefined。
 * 可能抛出的异常：无。
 */
function sanitizePendingTask(pendingTask = null) {
  if (!pendingTask || typeof pendingTask !== 'object') {
    return undefined;
  }

  const missing = Array.isArray(pendingTask.missing)
    ? pendingTask.missing.map(scrubInternalToken).filter(Boolean)
    : [];
  if (!missing.length) {
    return undefined;
  }

  return compactObject({
    missing,
    originalText: scrubInternalToken(pendingTask.originalText),
    skillName: scrubInternalToken(pendingTask.skillName),
  });
}

function scrubInternalToken(value = '') {
  if (typeof value !== 'string') {
    return value;
  }
  if (looksLikeInternalRuntimeName(value)) {
    return '';
  }
  return value;
}

function safeDisplayText(value = '') {
  if (!value || looksLikeInternalRuntimeName(value)) {
    return undefined;
  }
  return value;
}

function looksLikeInternalRuntimeName(value = '') {
  return /\b(?:goal|skill|plan|policy|action|artifact|observation|run)\.[A-Za-z0-9_.-]+\b/u.test(String(value || '')) ||
    /skill-runtime-loop/u.test(String(value || ''));
}

function createAgentSessionId() {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `agent-session-${stamp}-${suffix}`;
}

function normalizeAgentSessionId(sessionId) {
  const value = String(sessionId || '').trim();
  return /^agent-session-[A-Za-z0-9T_-]+$/.test(value) ? value : '';
}

function messageId(role) {
  return `${role}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function compactObject(value = {}) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== ''),
  );
}
