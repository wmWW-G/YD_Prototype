/**
 * hasOwnContextField 判断上下文对象是否显式携带某个字段。
 *
 * 作用：
 * - 区分“字段不存在”和“字段存在但值为空”。
 * - 新对话里这很重要：后端返回 `{ context: { pendingTask } }` 时，表示当前任务
 *   已经切到一个新的等待态，即使没有 artifact 字段，也不能再沿用前端旧产物。
 *
 * 参数：
 * - context：任务上下文对象，可能来自前端本地状态或后端响应。
 * - fieldName：要检查的字段名，字符串。
 *
 * 返回值：布尔值；字段是对象自有属性时返回 true。
 * 可能抛出的异常：无。
 */
function hasOwnContextField(context = {}, fieldName = '') {
  return Object.prototype.hasOwnProperty.call(context || {}, fieldName);
}

/**
 * contextOwnsRuntimeState 判断当前 context 是否已经接管了任务连续性。
 *
 * 作用：
 * - 有 artifact 时，context 明确声明“当前可续接产物”。
 * - 有 pendingTask / pendingConfirmation 时，context 明确声明“当前在等待补资料或确认”。
 * - 这些情况下，旧的 skillAgentResult 只能当历史消息，不应再作为当前产物发送。
 *
 * 参数：
 * - context：任务上下文对象。
 *
 * 返回值：布尔值；context 显式拥有产物、等待任务或确认态时为 true。
 * 可能抛出的异常：无。
 */
function contextOwnsRuntimeState(context = {}) {
  return Boolean(
    hasOwnContextField(context, 'artifact') ||
    context?.pendingTask ||
    context?.pendingConfirmation,
  );
}

/**
 * buildAgentRequestContext 生成发给后端的新对话上下文。
 *
 * 作用：
 * - 普通完成态里，前端可以把最近产物摘要作为兜底发给后端。
 * - 一旦当前 context 已经进入新的 waiting / confirmation / artifact 状态，就以 context
 *   为准，禁止把旧 skillAgentResult.artifact 重新塞回请求。
 *
 * 参数：
 * - context：当前新对话上下文对象。
 * - skillAgentResult：最近一次有产物的 Agent 响应对象。
 *
 * 返回值：可安全放进 `/api/agent/message/stream` 请求体的 context。
 * 可能抛出的异常：无。
 */
export function buildAgentRequestContext(context = {}, skillAgentResult = null) {
  const safeContext = context || {};

  if (contextOwnsRuntimeState(safeContext) || !skillAgentResult?.artifact) {
    return safeContext;
  }

  return {
    ...safeContext,
    artifact: skillAgentResult.artifact,
    period: skillAgentResult.period,
  };
}

/**
 * getCurrentAgentArtifact 返回前端输入区应展示的当前产物。
 *
 * 作用：
 * - 如果 context 明确携带 artifact，则它就是当前产物。
 * - 如果 context 只有新的 pendingTask / pendingConfirmation 且没有 artifact，说明旧产物
 *   只能留在历史消息里，输入区不能继续显示“正在接着旧文件”。
 * - 没有任何等待态时，才使用 skillAgentResult 作为本地兜底。
 *
 * 参数：
 * - context：当前任务上下文对象。
 * - skillAgentResult：最近一次有产物的 Agent 响应对象。
 *
 * 返回值：当前产物摘要对象；没有当前产物时返回 null。
 * 可能抛出的异常：无。
 */
export function getCurrentAgentArtifact(context = {}, skillAgentResult = null) {
  const safeContext = context || {};

  if (hasOwnContextField(safeContext, 'artifact')) {
    return safeContext.artifact || null;
  }

  if (safeContext.pendingTask || safeContext.pendingConfirmation) {
    return null;
  }

  return skillAgentResult?.artifact || null;
}

/**
 * pickNextSkillAgentResult 根据本轮后端 payload 更新最近产物状态。
 *
 * 作用：
 * - 有新 artifact 时，把本轮 payload 作为新的可续接结果。
 * - 后端显式返回 context 但没有 artifact 时，说明当前任务进入新的等待态，必须清掉
 *   旧 skillAgentResult，避免下一句保存/导出误绑旧文件。
 * - 老接口如果既没有 artifact 也没有 context，则保持上一轮结果不变。
 *
 * 参数：
 * - payload：后端本轮返回的公开 payload。
 * - previousResult：前端当前保存的最近产物结果。
 *
 * 返回值：新的 skillAgentResult；没有当前产物时返回 null。
 * 可能抛出的异常：无。
 */
export function pickNextSkillAgentResult(payload = {}, previousResult = null) {
  if (payload?.artifact) {
    return payload;
  }

  if (!hasOwnContextField(payload || {}, 'context')) {
    return previousResult || null;
  }

  if (payload.context?.artifact) {
    return {
      ...payload,
      artifact: payload.context.artifact,
      period: payload.context.period || payload.period,
    };
  }

  return null;
}

/**
 * buildRecoverableWaitingContext 生成前端异常兜底用的等待上下文。
 *
 * 作用：
 * - SSE 或网络失败时，前端仍要记住用户原始任务，让下一句补充能接着做。
 * - 这类本地兜底表示“还没有生成本轮业务材料”，所以必须主动移除旧 artifact / period。
 * - 如果之前已经有 pendingTask，则继续沿用原 pendingTask，避免异常时覆盖更早的真实任务。
 *
 * 参数：
 * - currentContext：前端当前任务上下文对象，可能包含旧产物。
 * - recoverableContext：由当前输入生成的兜底 pendingTask context。
 *
 * 返回值：新的等待上下文，只保留必要的等待信息。
 * 可能抛出的异常：无。
 */
export function buildRecoverableWaitingContext(currentContext = {}, recoverableContext = {}) {
  const nextContext = {
    ...(currentContext || {}),
    pendingTask: currentContext?.pendingTask || recoverableContext?.pendingTask,
  };

  delete nextContext.artifact;
  delete nextContext.period;

  return nextContext;
}
