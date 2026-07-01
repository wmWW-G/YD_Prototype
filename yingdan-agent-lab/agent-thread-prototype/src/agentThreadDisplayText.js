/**
 * looksLikeInternalRuntimeText 判断文本是否像内部运行信息。
 *
 * 作用：
 * - 统一给新对话标题、输入区 chip 和 placeholder 做最后一道前端净化。
 * - 后端仍是主要净化层,这里防御旧 localStorage、异常 payload 或旧 session 摘要。
 * - 只拦截高置信内部字段,避免把普通业务标题误伤成“本次任务”。
 *
 * 参数：
 * - value：待检查文本。
 *
 * 返回值：boolean,true 表示不适合直接展示给业务用户。
 * 可能抛出的异常：无。
 */
export function looksLikeInternalRuntimeText(value = '') {
  const text = String(value || '');
  return /skill-runtime|workbench[\\/]|\/Users\/|run[_\s-]?id|skill[_\s-]?id|output[_\s-]?path|manifest[_\s-]?path|checkpoint[_\s-]?path|run[_\s-]?log[_\s-]?path|tool[_\s-]?call|(?:goal|skill|policy|action|artifact)\./iu.test(text);
}

/**
 * scrubAgentArtifactDisplayName 把可能来自旧缓存的内部产物名转成业务名称。
 *
 * 作用：
 * - 输入区和标题栏只应该显示“报价单.xlsx / 客户推进分析.md”这类业务名称。
 * - 如果旧缓存里仍有 runtime basename,根据文件语义转成业务名称。
 * - 无法判断具体类型时,退成通用业务材料名称。
 *
 * 参数：
 * - input.name：原始产物名称。
 * - input.type：产物类型,例如 xlsx 或 markdown。
 *
 * 返回值：可展示的业务产物名称。
 * 可能抛出的异常：无。
 */
export function scrubAgentArtifactDisplayName(input = {}) {
  const rawName = String(input.name || '').trim();
  const type = String(input.type || '').toLowerCase();
  const baseName = rawName.split(/[\\/]/).filter(Boolean).pop() || rawName;

  if (!looksLikeInternalRuntimeText(baseName)) {
    return baseName;
  }

  const lowerName = baseName.toLowerCase();
  if (/quotation|quote|报价/u.test(lowerName)) {
    return '报价单.xlsx';
  }
  if (/customer-followup|followup|客户推进|跟进/u.test(lowerName)) {
    return '客户推进分析.md';
  }
  if (/inquiry-reply|询盘/u.test(lowerName)) {
    return '询盘回复草稿.md';
  }
  if (/cold-email|email|开发信/u.test(lowerName)) {
    return '开发信草稿.md';
  }
  if (type === 'xlsx' || /\.xlsx$/iu.test(baseName)) {
    return '修订版表格.xlsx';
  }
  if (/\.md$|\.txt$/iu.test(baseName)) {
    return '业务材料.md';
  }
  return '业务材料';
}

/**
 * scrubAgentInlineRuntimeText 清理单行展示文本中的内部运行信息。
 *
 * 作用：
 * - 任务标题、输入区 chip、placeholder 都会经过这里。
 * - 如果文本像内部运行字段,展示为业务用户能理解的兜底名称。
 *
 * 参数：
 * - value：单行文本。
 * - fallback：命中内部信息时使用的兜底文案。
 *
 * 返回值：清理后的单行文本。
 * 可能抛出的异常：无。
 */
export function scrubAgentInlineRuntimeText(value = '', fallback = '本次任务') {
  const text = String(value || '').trim();
  if (!looksLikeInternalRuntimeText(text)) {
    return text;
  }
  return fallback;
}

/**
 * safeAgentInlineLabel 清理并截断前端单行标签。
 *
 * 参数：
 * - value：任意待展示值。
 * - options.fallback：内部信息兜底文案。
 * - options.maxLength：最大字符数。
 *
 * 返回值：安全的短标签。
 * 可能抛出的异常：无。
 */
export function safeAgentInlineLabel(value = '', options = {}) {
  const fallback = options.fallback || '本次任务';
  const maxLength = Number.isFinite(options.maxLength) ? options.maxLength : 28;
  const text = scrubAgentInlineRuntimeText(String(value || '').replace(/\s+/g, ' ').trim(), fallback);
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 1))}...`;
}

/**
 * sanitizeAgentActivityItemForDisplay 净化活动流里的单个操作记录。
 *
 * 作用：
 * - 旧 localStorage 或异常 payload 可能保存 raw runtime action。
 * - 展开“本次操作记录”时也不能显示 tool_call、outputPath、action.executed 等内部字段。
 * - 保留 status/kind 等结构字段,只清理用户可见文本。
 *
 * 参数：
 * - item：活动项对象。
 *
 * 返回值：净化后的活动项对象。
 * 可能抛出的异常：无。
 */
export function sanitizeAgentActivityItemForDisplay(item = {}) {
  return {
    ...item,
    phase: safeAgentInlineLabel(item.phase || '', { fallback: '处理', maxLength: 16 }),
    title: safeAgentInlineLabel(item.title || '处理任务', { fallback: '处理任务', maxLength: 36 }),
    detail: safeAgentInlineLabel(item.detail || '继续处理这次任务。', {
      fallback: '已隐藏内部执行细节。',
      maxLength: 80,
    }),
    observation: item.observation
      ? safeAgentInlineLabel(item.observation, { fallback: '已整理为业务结果', maxLength: 60 })
      : '',
    nextAction: item.nextAction
      ? safeAgentInlineLabel(item.nextAction, { fallback: '继续按当前任务处理', maxLength: 60 })
      : '',
  };
}

/**
 * sanitizeAgentProcessStepForDisplay 净化执行过程里的单个步骤。
 *
 * 作用：
 * - 前台进度条可以恢复旧 process.steps。
 * - 如果旧数据里有 internal phase、label 或 detail,展示层要兜底转成业务语言。
 *
 * 参数：
 * - step：过程步骤对象。
 *
 * 返回值：净化后的步骤对象。
 * 可能抛出的异常：无。
 */
export function sanitizeAgentProcessStepForDisplay(step = {}) {
  return {
    ...step,
    phase: step.phase ? safeAgentInlineLabel(step.phase, { fallback: '处理', maxLength: 16 }) : '',
    label: safeAgentInlineLabel(step.label || '处理任务', { fallback: '处理任务', maxLength: 28 }),
    detail: safeAgentInlineLabel(step.detail || '继续处理这次任务。', {
      fallback: '已隐藏内部执行细节。',
      maxLength: 80,
    }),
  };
}
