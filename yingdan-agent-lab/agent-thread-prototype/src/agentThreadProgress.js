/**
 * normalizeStreamingProgressStatus 把后端实时状态转成前台步骤状态。
 *
 * 作用：
 * - 后端会发送 running / waiting / complete / error 等状态。
 * - 前台执行过程只需要 complete、error、pending 三类视觉状态。
 *
 * 参数：
 * - status：后端 progress.status 字符串。
 *
 * 返回值：前台 ExecutionProcess 可直接使用的状态字符串。
 * 可能抛出的异常：无。
 */
function normalizeStreamingProgressStatus(status = '') {
  if (status === 'complete') {
    return 'complete';
  }
  if (status === 'error') {
    return 'error';
  }
  return 'pending';
}

/**
 * mergeStreamingProgressItem 把一个实时进度事件合并到当前步骤列表。
 *
 * 作用：
 * - 连续同名步骤表示同一个步骤从 running 变成 complete,应更新最后一步。
 * - 非连续同名步骤表示同名动作在后续阶段再次发生,例如先核对产物权限,再核对保存权限。
 * - 这样既不会重复显示两个连续“识别任务”,也不会把后面的“核对权限”挪到前面旧位置。
 *
 * 参数：
 * - items：当前前台进度数组。
 * - data：后端 progress 事件数据,包含 label/detail/status。
 *
 * 返回值：新的进度数组。
 * 可能抛出的异常：无。
 */
export function mergeStreamingProgressItem(items = [], data = {}) {
  if (!data.label) {
    return items;
  }

  const nextItem = {
    detail: data.detail || '正在处理...',
    label: data.label,
    status: normalizeStreamingProgressStatus(data.status),
  };
  const lastIndex = items.length - 1;
  const shouldUpdateLastItem = lastIndex >= 0 && items[lastIndex].label === nextItem.label;

  if (!shouldUpdateLastItem) {
    return [...items, nextItem];
  }

  return items.map((item, itemIndex) => (itemIndex === lastIndex ? nextItem : item));
}
