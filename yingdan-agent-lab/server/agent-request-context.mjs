/**
 * mergeAgentRequestContext 合并前端上下文和后端 session 上下文。
 *
 * 作用：
 * - 前端只拿到净化后的 artifact 摘要,不能覆盖后端保存的真实 outputPath。
 * - pendingConfirmation / pendingTask 这类暂停恢复状态必须以后端 session 为准。
 * - 没有后端 session context 时,才允许前端传入旧版本地 context 作为兜底。
 *
 * 参数：
 * - input.clientContext：前端请求体里的 context。
 * - input.serverContext：session store 里读出的 context。
 *
 * 返回值：用于本轮 runNewConversationAgent 的上下文。
 * 可能抛出的异常：无。
 */
export function mergeAgentRequestContext(input = {}) {
  const clientContext = input.clientContext || {};
  const serverContext = input.serverContext || {};
  const hasServerContext = Object.keys(serverContext).length > 0;

  if (!hasServerContext) {
    return clientContext;
  }

  return {
    ...clientContext,
    ...serverContext,
    artifact: serverContext.artifact || clientContext.artifact,
    pendingConfirmation: serverContext.pendingConfirmation,
    pendingTask: serverContext.pendingTask,
  };
}
