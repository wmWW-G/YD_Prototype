import { safeAgentInlineLabel, scrubAgentArtifactDisplayName } from './agentThreadDisplayText.js';

/**
 * deriveAgentThreadTaskTitle 从响应、session 或本地状态里提取业务任务标题。
 *
 * 作用：
 * - 新对话线程应该围绕正在做的业务任务展开，而不是围绕某个临时确认动作展开。
 * - 当用户已经在一个任务里继续操作时，保存、导出、外发或扣费确认不能抢掉原任务标题。
 * - 当用户第一句话就是风险动作、还没有业务任务标题时，确认卡标题可以作为兜底标题。
 *
 * 参数：
 * - source：后端响应、恢复 session 或本地缓存对象。
 * - fallbackTitle：当前线程已有标题；确认动作出现时优先沿用它。
 *
 * 返回值：业务任务标题字符串；没有可用标题时返回空字符串。
 * 可能抛出的异常：无。
 */
export function deriveAgentThreadTaskTitle(source = {}, fallbackTitle = '') {
  const latestConfirmationTitle = [...(source.messages || [])]
    .reverse()
    .find((message) => message.confirmation?.title)?.confirmation?.title || '';
  const sourceTitle = source.taskTitle || '';
  const isConfirmationTitle = Boolean(
    source.kind === 'confirmation-required' &&
    fallbackTitle &&
    latestConfirmationTitle &&
    sourceTitle === latestConfirmationTitle
  );

  if (isConfirmationTitle) {
    return safeTaskTitle(fallbackTitle);
  }

  return firstSafeTaskTitle([
    { value: sourceTitle },
    { value: source.skillAgentResult?.taskTitle },
    { value: source.context?.pendingTask?.skillName },
    { value: source.artifact?.workbookName || source.artifact?.name, artifact: source.artifact },
    {
      value: source.skillAgentResult?.artifact?.workbookName || source.skillAgentResult?.artifact?.name,
      artifact: source.skillAgentResult?.artifact,
    },
    { value: fallbackTitle },
    { value: latestConfirmationTitle },
  ]);
}

/**
 * firstSafeTaskTitle 从候选标题里选择第一个业务可读标题。
 *
 * 作用：
 * - 标题栏会直接显示这个值,所以必须防御旧缓存里的 runtime 信息。
 * - 内部 taskTitle 命中“本次任务”时,继续看后面是否有更具体的业务 artifact 名。
 *
 * 参数：
 * - candidates：候选标题数组,每项可带 artifact 摘要。
 *
 * 返回值：业务可读标题；没有候选时返回空字符串。
 * 可能抛出的异常：无。
 */
function firstSafeTaskTitle(candidates = []) {
  let internalFallback = '';
  for (const candidate of candidates) {
    if (!candidate?.value) {
      continue;
    }
    const safeTitle = candidate.artifact
      ? safeTaskTitle(scrubAgentArtifactDisplayName({
        name: candidate.value,
        type: candidate.artifact.type || '',
      }))
      : safeTaskTitle(candidate.value);

    if (safeTitle && safeTitle !== '本次任务') {
      return safeTitle;
    }
    if (safeTitle) {
      internalFallback = safeTitle;
    }
  }
  return internalFallback;
}

/**
 * safeTaskTitle 清理标题栏可展示文本。
 *
 * 参数：
 * - value：任意标题候选。
 *
 * 返回值：安全短标题。
 * 可能抛出的异常：无。
 */
function safeTaskTitle(value = '') {
  return safeAgentInlineLabel(value, { maxLength: 36 });
}
