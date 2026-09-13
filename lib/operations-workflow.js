const { randomUUID } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { createSsePayloadParser } = require('./dify-api-client');
const ENTRY_MAP = require('./operations-entry-map.json');
const REPORT_SCHEMA = require('./operations-report-schema.json');
// 仅收录原 HTML 里 28 个 AI 报告入口的表头和摘要容量，不携带原稿虚构经营数字。
// 数据看板的日/周/月切换沿用原独立页面，不用 AI 报告模板替换它。
const REPORT_TEMPLATES = require('./operations-report-templates.json');
const API_BASE = 'https://api.dify.ai/v1';
const OUTPUT_PREFIXES = ['', 'repaired_', 'invalid_', 'failed_'];
const ALIASES = Object.freeze({
  '运营规划': '运营规划清单', '市场定位': '市场&客群定位', '市场定位SOP': '市场&客群定位',
  '公司定位SOP': '公司定位', '产品定位SOP': '产品定位', '关键词库': '一键整理关键词',
  '产品发布': '批量发品', '推广策略': '广告策略', '问鼎/顶展/聚量诊断': '品广诊断优化',
  '核心品资源跟进': '核心品跟进', '店铺诊断与落地规划': '老店运营诊断规划', '产品优化': '产品诊断'
});

/**
 * 创建同时供 API 和测试使用的业务错误；详情只写服务端日志，用户只看到公开提示。
 * @param {string} message 公开中文提示。
 * @param {string} code 稳定错误分类。
 * @param {number} status HTTP 状态码。
 * @returns {Error} 带分类的 Error，不主动抛出。
 */
function workflowError(message, code = 'workflow_failed', status = 502) {
  return Object.assign(new Error(message), { code, status, public: true });
}

/**
 * 根据白名单把原型入口转换为 Workflow 接受的板块和功能。
 * @param {unknown} name 原型中点击的功能名称。
 * @returns {{module:string,function_name:string}} 确定的路由。
 * @throws {Error} 不支持的名称被拒绝，不能由浏览器任意指定其他业务流程。
 */
function resolveEntry(name) {
  const functionName = typeof name === 'string' && Object.hasOwn(ALIASES, name) ? ALIASES[name] : name;
  for (const [module, names] of Object.entries(ENTRY_MAP)) {
    if (names.includes(functionName)) return { module, function_name: functionName };
  }
  throw workflowError('这个入口暂不支持生成诊断报告。', 'invalid_entry', 400);
}

/**
 * 建立带可信报告身份的请求。本轮只接入演示数据，避免将原型数字当成商家事实。
 * @param {object} body 浏览器提交的功能名和演示资料。
 * @returns {object} 四个 Dify 输入；report_id 只能由服务端生成。
 * @throws {Error} 资料类型、长度或来源标识不正确时拒绝请求。
 */
function buildInputs(body) {
  const entry = resolveEntry(body?.function_name);
  if (body?.data_source !== 'demo' || typeof body?.business_context !== 'string' ||
      !body.business_context.trim() || body.business_context.length > 44000) {
    throw workflowError('请提供当前页面的演示资料后再生成报告。', 'invalid_input', 400);
  }
  const template = REPORT_TEMPLATES[entry.function_name];
  const presentation = template ? [
    '\n报告展示要求（仅约束摘要排版，不是经营事实，不改变固定 JSON Schema）：',
    '界面只展示 name、sub、points、rows。其余完整分析、经营依据、对象明细仍放入原有 content_markdown/evidence/actions 等字段，不能遗漏实际成品。',
    'sub 用一句不超过 60 字的对象/范围/周期说明，未知写未提供。',
    `points 返回 1–${template.max_points} 条短要点，每条不超过 90 字，可用“短标题：内容”；不用 HTML、Markdown 标题或长篇正文。`,
    `rows 首行必须逐字采用原界面表头：${JSON.stringify(template.headers)}。只用这 ${template.headers.length} 列，表头后最多 ${template.max_data_rows} 行摘要，每格不超过 60 字；缺数据写“未提供”并给出待核动作，不编造数量。至少保留表头。`,
    '不要把展示要求作为证据，也不要在报告中解释接口、JSON、提示词或界面实现。'
  ].join('\n') : '';
  return {
    ...entry,
    report_id: `yd-operations-${randomUUID()}`,
    business_context: '资料来源：赢单原型的固定演示数据，全部为虚构示例，不是真实店铺事实。只用于验证运营诊断；区分可核验信息、演示案例和数据缺口，不补造数字。\n' + body.business_context + presentation
  };
}

/**
 * 递归检查 Workflow 报告结构，阻止错误类型和多余字段穿过接口边界。
 * @param {unknown} value 待检查的字段。
 * @param {object} rule 本项目固定 JSON Schema 的子规则。
 * @param {string} path 当前字段路径，只用于安全日志。
 * @returns {void} 校验成功无返回值。
 * @throws {Error} 不符合报告契约时抛出结构错误。
 */
function checkSchema(value, rule, path = 'report') {
  const fail = () => { throw workflowError('报告格式未通过校验，请重新生成。', 'invalid_report'); };
  if (rule.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
    if (rule.required.some(key => !Object.hasOwn(value, key))) fail();
    if (rule.additionalProperties === false && Object.keys(value).some(key => !Object.hasOwn(rule.properties, key))) fail();
    for (const [key, child] of Object.entries(rule.properties)) checkSchema(value[key], child, `${path}.${key}`);
  } else if (rule.type === 'array') {
    if (!Array.isArray(value) || value.length > 500) fail();
    value.forEach((item, index) => checkSchema(item, rule.items, `${path}[${index}]`));
  } else if (rule.type === 'string') {
    if (typeof value !== 'string' || value.length > 100000 || (rule.enum && !rule.enum.includes(value))) fail();
    // 内部思考内容不属于公开诊断报告，即使被模型放进 JSON 字段也不能转发。
    if (/<\/?(?:think|analysis)>/i.test(value)) fail();
  }
}

/**
 * 将四个互斥输出分支恢复为统一结果，并核对报告与追问上下文属于同一次请求。
 * @param {object} outputs Dify 最终输出，支持正常、修复、输入错误和失败前缀。
 * @param {object} inputs 当前服务端生成的请求身份。
 * @returns {{report:object,chat_inputs:object,branch:string}} 经过校验的公开报告。
 * @throws {Error} 无有效报告、多个冲突分支、身份不符或结构错误时拒绝结果。
 */
function normalizeOutputs(outputs, inputs) {
  const present = OUTPUT_PREFIXES.filter(prefix => Object.hasOwn(outputs || {}, `${prefix}status`));
  if (present.length !== 1) throw workflowError('诊断返回了不完整或冲突的结果，请重新生成。', 'invalid_outputs');
  const prefix = present[0];
  if (outputs[`${prefix}status`] !== 'ok') {
    throw workflowError(prefix === 'invalid_' ? '诊断资料未通过检查，请核对后重试。' : '报告校验未完成，请稍后重新生成。', 'report_rejected');
  }
  const rawReport = outputs[`${prefix}report`];
  const chatInputs = outputs[`${prefix}chat_inputs`];
  if (!rawReport || typeof rawReport !== 'object' || Array.isArray(rawReport) || JSON.stringify(rawReport).length > 200000) {
    throw workflowError('报告内容不完整。', 'invalid_report');
  }
  const report = { ...rawReport };
  // Dify 某些版本的 Code 输出检查会对二维数组调用 .items()。只在传输边界编码 rows，
  // 到本站后恢复数组并继续严格检查；诊断正文及 Chatflow 上下文仍使用原来的报告契约。
  if (typeof report.rows === 'string') {
    try { report.rows = JSON.parse(report.rows); }
    catch { throw workflowError('报告表格格式无效，请重新生成。', 'invalid_report'); }
  }
  const core = { ...report };
  for (const key of ['schema_version', 'module', 'function_name', 'report_id']) delete core[key];
  checkSchema(core, REPORT_SCHEMA);
  // 同步首次诊断的关键业务约束：空报告、错列以及无来源的证据引用不能显示为成功。
  const invalid = () => { throw workflowError('报告内容未通过校验，请重新生成。', 'invalid_report'); };
  if (![report.name, report.sub, report.conclusion, report.content_markdown].every(value => value.trim())) invalid();
  if (report.points.length > 5 || report.follow_up_questions.length > 3) invalid();
  for (const values of [report.points, report.missing_data, report.follow_up_questions]) {
    if (values.some(value => !value.trim())) invalid();
  }
  if (report.rows.some(row => !row.length || row.length !== report.rows[0].length) || report.rows[0]?.some(value => !value.trim())) invalid();
  const template = REPORT_TEMPLATES[inputs.function_name];
  // 校验原稿表头和摘要容量，禁止模型任意增加列或让长文再次挤占原来的固定布局。
  // 格式错误不做静默截断/猜测映射，完整报告与 Chatflow 交接仍必须保持一致。
  if (template && (!isDeepStrictEqual(report.rows[0], template.headers) ||
      report.sub.length > 60 || !report.points.length || report.points.length > template.max_points ||
      report.points.some(point => point.length > 90) || report.rows.length > template.max_data_rows + 1 ||
      report.rows.some(row => row.some(cell => cell.length > 60)))) {
    throw workflowError('报告未按当前功能的原有格式生成，请重新生成。', 'report_layout_mismatch');
  }
  const evidenceIds = new Set(report.evidence.map(item => item.id));
  if (evidenceIds.size !== report.evidence.length || report.evidence.some(item => ![item.id, item.source, item.fact].every(value => value.trim()))) invalid();
  if (report.data_status === 'sufficient' ? !report.evidence.length : !report.missing_data.length) invalid();
  if (new Set(report.actions.map(action => action.id)).size !== report.actions.length) invalid();
  for (const action of report.actions) {
    if (![action.id, action.target, action.decision, action.owner, action.review].every(value => value.trim())) invalid();
    if (![action.steps, action.acceptance].every(items => items.length && items.every(value => value.trim()))) invalid();
    if (new Set(action.evidence_ids).size !== action.evidence_ids.length || action.evidence_ids.some(id => !evidenceIds.has(id))) invalid();
  }
  if (report.report_id !== inputs.report_id || report.module !== inputs.module ||
      report.function_name !== inputs.function_name || report.name !== inputs.function_name || report.schema_version !== '1.0') {
    throw workflowError('报告与当前功能不匹配，请重新生成。', 'report_identity_mismatch');
  }
  if (!chatInputs || chatInputs.module !== inputs.module || chatInputs.business_context !== inputs.business_context ||
      typeof chatInputs.diagnosis_context !== 'string' || chatInputs.diagnosis_context.length > 64000) {
    throw workflowError('报告的追问资料不完整，请重新生成。', 'invalid_handoff');
  }
  let envelope;
  try { envelope = JSON.parse(chatInputs.diagnosis_context); }
  catch { throw workflowError('报告的追问资料格式无效。', 'invalid_handoff'); }
  if (!envelope || envelope.schema_version !== '1.0' || envelope.report_id !== inputs.report_id || envelope.module !== inputs.module ||
      envelope.function_name !== inputs.function_name || !isDeepStrictEqual(envelope.report, report)) {
    throw workflowError('报告与追问资料不一致，请重新生成。', 'invalid_handoff');
  }
  return { report, chat_inputs: chatInputs, branch: prefix || 'normal' };
}

/**
 * 执行一次真实 Dify Workflow；只输出公开阶段和最终报告，不向浏览器转发节点内容。
 * @param {object} options 包含 apiKey、inputs、onEvent、signal、可注入 fetchImpl 和 logger。
 * @returns {Promise<object>} 成功的公开结果。
 * @throws {Error} 鉴权、超时、流中断、Workflow 失败或报告校验失败时抛出。
 */
async function runWorkflow({ apiKey, inputs, onEvent, signal, fetchImpl = fetch, logger = console }) {
  if (!apiKey?.startsWith('app-')) throw workflowError('诊断服务尚未配置，请联系管理员。', 'not_configured', 409);
  const user = 'yingdan-operations-prototype';
  const timeoutSignal = AbortSignal.timeout(240000);
  const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  let taskId = '', runId = '', result = null, finished = false, lastStage = '', failedStage = '';
  const response = await fetchImpl(`${API_BASE}/workflows/run`, {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs, user, response_mode: 'streaming' }), signal: requestSignal
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw workflowError(response.status === 401 ? '诊断服务的授权已失效，请联系管理员。' :
      response.status === 429 ? '诊断服务繁忙，请稍后再试。' : '诊断服务暂时无法连接，请稍后再试。', 'upstream_http', response.status === 429 ? 429 : 502);
  }
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
    await response.body?.cancel();
    throw workflowError('诊断服务没有返回有效的进度信息。', 'invalid_stream');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = createSsePayloadParser(event => {
    const data = event.data || {};
    taskId = event.task_id || taskId;
    runId = event.workflow_run_id || runId;
    if (event.event === 'node_started') {
      const stage = data.node_id === 'knowledge' ? '正在查阅运营方法' :
        /validate|repair|report_gate/.test(data.node_id || '') ? '正在核验诊断报告' :
        /^advisor_/.test(data.node_id || '') ? '正在分析并生成报告' : '正在整理诊断资料';
      if (stage !== lastStage) { lastStage = stage; onEvent({ type: 'progress', message: stage }); }
    }
    if (event.event === 'node_finished' && ['failed', 'exception'].includes(data.status)) {
      if (!failedStage) failedStage = /validate|repair/.test(data.node_id || '') ? '报告校验' : '诊断处理';
      logger.error('[operations-workflow] node failed', {
        runId, nodeId: data.node_id, status: data.status,
        // 上游错误可能夹带模型输入；日志仅保留分类，原始文本不写入磁盘。
        errorType: /Unknown error/i.test(data.error || '') ? 'unknown_error' : 'node_execution_error'
      });
    }
    if (event.event === 'error') throw workflowError('诊断服务执行失败，请稍后再试。');
    if (event.event === 'workflow_finished') {
      finished = true;
      if (data.status !== 'succeeded') throw workflowError(`${failedStage || '诊断'}未完成，请稍后重新生成。`);
      result = { ...normalizeOutputs(data.outputs, inputs), workflow_run_id: runId || data.id, data_source: 'demo' };
    }
  });
  let bytes = 0;
  try {
    while (!finished) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 8 * 1024 * 1024) throw workflowError('诊断响应过大，请缩小资料范围后重试。');
      parser.push(decoder.decode(chunk.value, { stream: true }));
    }
    parser.push(decoder.decode()); parser.finish();
    if (!result) throw workflowError('诊断连接中断，未收到完整报告，请重新生成。', 'incomplete_stream');
    onEvent({ type: 'done', result });
    return result;
  } finally {
    await reader.cancel().catch(() => {});
    // 关闭面板/切换功能会断开本地请求；尽力停止上游任务，避免后台继续生成。
    if (!finished && taskId) {
      await fetchImpl(`${API_BASE}/workflows/tasks/${encodeURIComponent(taskId)}/stop`, {
        method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user }), signal: AbortSignal.timeout(5000)
      }).then(response => response.body?.cancel()).catch(() => {});
    }
  }
}

module.exports = { buildInputs, resolveEntry, normalizeOutputs, runWorkflow };
