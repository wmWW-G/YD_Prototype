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
  return /skill-runtime|workbench[\\/]|\/Users\/|run[_\s-]?id|skill[_\s-]?id|output[_\s-]?path|manifest[_\s-]?path|checkpoint[_\s-]?path|run[_\s-]?log[_\s-]?path|tool[_\s-]?call|(?:goal|skill|policy|action|artifact)\.|(?:customer_write|export_file|external_send|paid_call|runtime_policy|risky_action)/iu.test(text);
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

/**
 * sanitizeAgentNeedsInputForDisplay 净化缺资料卡片的可见文本。
 *
 * 作用：
 * - 缺资料卡会直接告诉用户下一句该补什么,不能出现 runId、tool_call 或本地路径。
 * - 后端已做主净化,这里防御旧 session、旧 localStorage 或异常 payload。
 * - 只返回前端展示需要的字段,避免把内部恢复信息误带入 UI。
 *
 * 参数：
 * - needsInput：后端或本地恢复出的缺资料卡对象。
 *
 * 返回值：只包含 title、hint、items 的安全展示对象。
 * 可能抛出的异常：无。
 */
export function sanitizeAgentNeedsInputForDisplay(needsInput = {}) {
  const items = Array.isArray(needsInput.items) ? needsInput.items.filter(Boolean) : [];
  return {
    title: safeAgentInlineLabel(needsInput.title || '缺少资料', {
      fallback: '需要补充资料',
      maxLength: 32,
    }),
    hint: safeAgentInlineLabel(needsInput.hint || '直接补一句话即可,我会接着这次任务继续。', {
      fallback: '直接补一句话即可,我会接着这次任务继续。',
      maxLength: 72,
    }),
    items: items.map((item) => safeAgentInlineLabel(item, {
      fallback: '需要补充的业务资料',
      maxLength: 40,
    })),
  };
}

/**
 * sanitizeAgentConfirmationForDisplay 净化确认卡片的可见文本。
 *
 * 作用：
 * - 保存、导出、外发和扣费确认必须让用户看懂业务后果,不能露出 policy/action/runtime 字段。
 * - 按钮文案也要净化,因为按钮会被当作下一句确认文本传回 Agent。
 * - 只返回前端展示和按钮需要的字段,内部 runtime 继续留在后端 session context。
 *
 * 参数：
 * - confirmation：后端返回或历史恢复出的确认卡对象。
 *
 * 返回值：只包含 title、body、confirmLabel、cancelLabel 的安全展示对象。
 * 可能抛出的异常：无。
 */
export function sanitizeAgentConfirmationForDisplay(confirmation = {}) {
  const confirmActionText = safeAgentInlineLabel(
    confirmation.confirmActionText || confirmationActionTextForType(confirmation.type),
    {
      fallback: confirmationActionTextForType(confirmation.type),
      maxLength: 18,
    },
  );
  return {
    title: safeAgentInlineLabel(confirmation.title || '这一步需要确认', {
      fallback: '这一步需要确认',
      maxLength: 36,
    }),
    body: safeAgentInlineLabel(confirmation.body || '确认前不会保存、导出、外发或扣费。', {
      fallback: '确认前不会保存、导出、外发或扣费。',
      maxLength: 90,
    }),
    confirmLabel: safeAgentConfirmationButtonLabel(confirmation.confirmLabel || '确认继续', {
      fallback: confirmActionText,
      maxLength: 18,
    }),
    cancelLabel: safeAgentConfirmationButtonLabel(confirmation.cancelLabel || '取消', {
      fallback: '取消',
      maxLength: 18,
    }),
    confirmActionText,
    cancelActionText: '取消这一步',
  };
}

/**
 * safeAgentConfirmationButtonLabel 专门清理确认卡按钮文案。
 *
 * 作用：
 * - “当前任务文件”是后端把本地路径洗掉后的占位词,不应该出现在按钮里。
 * - 这个兜底只用于确认卡按钮,避免把普通业务说明里偶然出现的同样文字误伤。
 *
 * 参数：
 * - value：原始按钮文案。
 * - options：与 safeAgentInlineLabel 相同,包含 fallback 和 maxLength。
 *
 * 返回值：安全的确认卡按钮文案。
 * 可能抛出的异常：无。
 */
function safeAgentConfirmationButtonLabel(value = '', options = {}) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (/当前任务文件(?:\.[A-Za-z0-9]+)?/iu.test(text)) {
    return safeAgentInlineLabel(options.fallback || '确认继续', options);
  }
  return safeAgentInlineLabel(text, options);
}

/**
 * confirmationActionTextForType 返回点击确认按钮时传回 Agent 的稳定业务文案。
 *
 * 作用：
 * - 展示文案可以因为防泄漏被降级成“确认继续”,但导出/写入等后端确认逻辑需要更具体的业务词。
 * - 这里不返回任何后端 runtime 字段,只返回后端已经接受的自然业务确认词。
 *
 * 参数：
 * - type：确认卡类型,例如 export_file、customer_write、external_send。
 *
 * 返回值：用户点击确认按钮时传回同一条 Agent 线程的安全业务文案。
 * 可能抛出的异常：无。
 */
function confirmationActionTextForType(type = '') {
  const actionTextByType = {
    customer_write: '确认写入',
    export_file: '确认导出',
    external_send: '先生成草稿',
    paid_call: '确认继续',
    runtime_policy: '确认继续',
    risky_action: '确认继续',
  };
  return actionTextByType[type] || '确认继续';
}
