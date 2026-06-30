const WAITING_KINDS = new Set(['needs-input', 'needs-input-followup', 'confirmation-required']);
const ERROR_STATUSES = new Set(['error', 'failed']);

/**
 * agentThreadStatusFromPayload 根据后端本轮响应决定前台线程状态。
 *
 * 作用：
 * - 把后端 `needs-input`、`confirmation-required` 这类等待态保留下来。
 * - 避免前端把“等用户补资料 / 等用户确认”误显示成“已完成”。
 *
 * 参数：
 * - payload：`/api/agent/message/stream` 最终 result 数据对象。
 *
 * 返回值：`idle`、`running`、`waiting`、`completed` 或 `error`。
 * 可能抛出的异常：无。
 */
export function agentThreadStatusFromPayload(payload = {}) {
  if (!payload || typeof payload !== 'object') {
    return 'idle';
  }
  if (payload.ok === false || ERROR_STATUSES.has(payload.status)) {
    return 'error';
  }
  if (payload.status === 'waiting' || WAITING_KINDS.has(payload.kind)) {
    return 'waiting';
  }
  if (payload.status === 'running') {
    return 'running';
  }
  if (payload.status === 'completed' || payload.kind || payload.sessionId || (payload.messages || []).length > 0) {
    return 'completed';
  }
  return 'idle';
}

/**
 * agentThreadStatusFromRestoredSession 根据恢复出的本地或后端线程决定前台状态。
 *
 * 作用：
 * - 页面刷新后,如果后端 session 仍在等待补充或等待确认,前台继续显示等待态。
 * - 没有消息的空线程保持 idle。
 *
 * 参数：
 * - session：后端恢复接口或 localStorage 里的线程对象。
 *
 * 返回值：`idle`、`waiting`、`completed` 或 `error`。
 * 可能抛出的异常：无。
 */
export function agentThreadStatusFromRestoredSession(session = {}) {
  if (!session || typeof session !== 'object') {
    return 'idle';
  }
  if (session.ok === false || ERROR_STATUSES.has(session.status)) {
    return 'error';
  }
  if (session.status === 'waiting' || WAITING_KINDS.has(session.kind)) {
    return 'waiting';
  }
  if ((session.messages || []).length > 0 || session.sessionId || session.skillAgentResult) {
    return 'completed';
  }
  return 'idle';
}

/**
 * isAgentThreadWaiting 判断当前前台状态是否在等待用户输入。
 *
 * 参数：
 * - status：线程状态字符串。
 *
 * 返回值：等待用户补资料或确认时返回 true。
 * 可能抛出的异常：无。
 */
export function isAgentThreadWaiting(status = '') {
  return status === 'waiting';
}
