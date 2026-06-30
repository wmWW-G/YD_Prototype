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
    return fallbackTitle;
  }

  return (
    sourceTitle ||
    source.skillAgentResult?.taskTitle ||
    source.context?.pendingTask?.skillName ||
    source.artifact?.workbookName ||
    source.artifact?.name ||
    source.skillAgentResult?.artifact?.workbookName ||
    source.skillAgentResult?.artifact?.name ||
    fallbackTitle ||
    latestConfirmationTitle ||
    ''
  );
}
