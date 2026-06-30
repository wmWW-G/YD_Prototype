import { isAgentThreadWaiting } from './agentThreadStatus.js';

/**
 * getNewConversationComposerState 把新对话运行态翻译成前台输入区状态。
 *
 * 作用：
 * - 统一区分“等待补资料”和“等待确认”。
 * - 避免 React 组件里散落多组三元判断,后续改 UI 时不小心把确认态写回补资料态。
 *
 * 参数：
 * - agentStatus：当前线程状态,例如 idle、running、waiting、completed。
 * - messages：当前线程消息数组,最新可操作确认卡必须在最后一条消息里。
 * - sessionId：当前任务 session id,只用于判断是否可以继续同一任务。
 * - taskTitle：当前识别出的业务任务标题,只用于判断是否显示“新任务”入口。
 * - currentArtifact：当前 session 绑定的产物摘要,用于提示“正在接着哪份材料改”。
 *
 * 返回值：
 * - isRunning：当前是否正在执行。
 * - isWaiting：当前是否等待用户输入。
 * - hasMessages：线程里是否已有消息。
 * - latestMessageId：最后一条消息 id,用于让旧确认卡失效。
 * - canStartFreshTask：是否应该显示“新任务”按钮。
 * - hasActionableConfirmation：最新消息是否带可操作确认卡。
 * - statusChipLabel：顶部状态 chip 文案。
 * - composerPlaceholder：输入框 placeholder。
 * - composerContextLabel：输入区里可见的当前任务/产物提示。
 * - sendButtonLabel：底部发送按钮文案。
 *
 * 可能抛出的异常：无。
 */
export function getNewConversationComposerState({
  agentStatus = 'idle',
  currentArtifact = null,
  messages = [],
  sessionId = '',
  taskTitle = '',
} = {}) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const isRunning = agentStatus === 'running';
  const isWaiting = isAgentThreadWaiting(agentStatus);
  const hasMessages = safeMessages.length > 0;
  const latestMessage = hasMessages ? safeMessages[safeMessages.length - 1] : null;
  const latestMessageId = latestMessage?.id || '';
  const canStartFreshTask = Boolean(sessionId || hasMessages || taskTitle);
  const hasActionableConfirmation = Boolean(latestMessage?.confirmation && isWaiting && !isRunning);
  const artifactName = artifactDisplayName(currentArtifact);
  const safeTaskTitle = safeInlineLabel(taskTitle);
  const continuationLabel = artifactName || safeTaskTitle;
  const statusChipLabel = isRunning
    ? '正在处理'
    : hasActionableConfirmation
      ? '等待确认'
      : isWaiting
        ? '等待补充'
        : sessionId
          ? '本次任务可继续'
          : '准备接任务';
  const composerPlaceholder = createComposerPlaceholder({
    artifactName,
    hasActionableConfirmation,
    safeTaskTitle,
    sessionId,
  });
  const composerContextLabel = sessionId && continuationLabel
    ? `${artifactName ? '正在接着' : '当前任务'}：${continuationLabel}`
    : '';
  const sendButtonLabel = isRunning
    ? '执行中'
    : hasActionableConfirmation
      ? '补充说明'
      : isWaiting
        ? '继续补充'
        : sessionId
          ? '继续追问'
          : '开始处理';

  return {
    canStartFreshTask,
    composerContextLabel,
    composerPlaceholder,
    hasActionableConfirmation,
    hasMessages,
    isRunning,
    isWaiting,
    latestMessageId,
    sendButtonLabel,
    statusChipLabel,
  };
}

/**
 * artifactDisplayName 提取产物在输入区里可展示的短名称。
 *
 * 参数：
 * - artifact：后端返回或本地恢复的产物摘要。
 *
 * 返回值：产物名称；没有可展示名称时返回空字符串。
 * 可能抛出的异常：无。
 */
function artifactDisplayName(artifact = null) {
  if (!artifact || typeof artifact !== 'object') {
    return '';
  }
  return safeInlineLabel(artifact.name || artifact.workbookName || artifact.fileName || '');
}

/**
 * createComposerPlaceholder 根据当前上下文生成输入框提示。
 *
 * 参数：
 * - artifactName：当前可续改产物名。
 * - hasActionableConfirmation：是否正在等待用户确认风险动作。
 * - safeTaskTitle：当前业务任务标题。
 * - sessionId：当前任务线程 ID。
 *
 * 返回值：输入框 placeholder 文案。
 * 可能抛出的异常：无。
 */
function createComposerPlaceholder({
  artifactName = '',
  hasActionableConfirmation = false,
  safeTaskTitle = '',
  sessionId = '',
} = {}) {
  if (hasActionableConfirmation) {
    return '补充确认信息，或直接点上方按钮处理这一步...';
  }
  if (artifactName) {
    return `继续修改 ${artifactName}，或补一句新的要求...`;
  }
  if (sessionId && safeTaskTitle) {
    return `继续补充 ${safeTaskTitle} 的要求，或追问这次任务...`;
  }
  if (sessionId) {
    return '继续补充要求，或追问这次任务...';
  }
  return '输入：帮我开上周询盘分析会';
}

/**
 * safeInlineLabel 清理输入区状态标签里的单行文本。
 *
 * 参数：
 * - value：任意待展示值。
 *
 * 返回值：去掉换行并限制长度后的文本。
 * 可能抛出的异常：无。
 */
function safeInlineLabel(value = '') {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= 28) {
    return text;
  }
  return `${text.slice(0, 27)}...`;
}
