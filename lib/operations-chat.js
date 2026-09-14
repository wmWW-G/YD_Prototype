const { createHash } = require('node:crypto');
const { createSsePayloadParser, createThinkContentFilter } = require('./dify-api-client');
const { normalizeOutputs, resolveEntry } = require('./operations-workflow');
const API_BASE = 'https://api.dify.ai/v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 创建只含公开提示的追问错误；参数为中文提示、分类及 HTTP 状态，不主动抛出。 */
function chatError(message, code = 'chat_failed', status = 502) {
  return Object.assign(new Error(message), { public: true, code, status });
}

/**
 * 校验首次诊断交接字段，固定报告身份，并为每份报告隔离 Dify 会话归属。
 * @param {object} body 页面传入的 report_id、chat_inputs、query、conversation_id、data_source。
 * @returns {object} 可直接调用 Chatflow 的输入、问题、会话 ID、服务端 user 与报告 ID。
 * @throws {Error} 缺少报告、上下文错配、超长问题或无效会话 ID 时拒绝调用。
 */
function buildChatRequest(body) {
  const inputs = body?.chat_inputs;
  if (body?.data_source !== 'demo' || typeof body?.report_id !== 'string' ||
      !body.report_id.trim() || body.report_id.length > 120 ||
      !inputs || typeof inputs.business_context !== 'string' || !inputs.business_context.trim() ||
      inputs.business_context.length > 48000 || typeof inputs.diagnosis_context !== 'string' ||
      inputs.diagnosis_context.length > 64000) {
    throw chatError('请先生成当前功能的诊断报告，再继续追问。', 'invalid_handoff', 400);
  }
  let envelope;
  try { envelope = JSON.parse(inputs.diagnosis_context); }
  catch { throw chatError('报告追问资料格式无效，请重新生成报告。', 'invalid_handoff', 400); }
  if (!envelope || envelope.report_id !== body.report_id) {
    throw chatError('追问与当前报告不匹配，请重新打开报告。', 'report_identity_mismatch', 400);
  }
  const entry = resolveEntry(envelope.function_name);
  // 复用 Workflow 的同一套报告校验，避免在追问入口另建一套宽松字段规则。
  const checked = normalizeOutputs({ status: 'ok', report: envelope.report, chat_inputs: inputs }, {
    ...entry, report_id: body.report_id, business_context: inputs.business_context
  });
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  if (!query || query.length > 4000) throw chatError('请输入 1–4000 字的追问。', 'invalid_query', 400);
  const conversationId = body.conversation_id ?? '';
  if (typeof conversationId !== 'string' || (conversationId && !UUID.test(conversationId))) {
    throw chatError('追问会话无效，请重新打开报告。', 'invalid_conversation', 400);
  }
  // Dify 会按 user 检查 conversation_id 的归属。报告和上下文共同决定 user，
  // 切换报告后不能沿用另一份报告的会话；不接收浏览器自行指定的 user。
  const digest = createHash('sha256').update(JSON.stringify({
    report_id: body.report_id, module: entry.module,
    business_context: inputs.business_context, diagnosis_context: inputs.diagnosis_context
  })).digest('hex').slice(0, 32);
  return {
    inputs: {
      module: checked.chat_inputs.module,
      business_context: checked.chat_inputs.business_context,
      diagnosis_context: checked.chat_inputs.diagnosis_context
    },
    query, conversation_id: conversationId, user: `yd-operations-chat-${digest}`, report_id: body.report_id
  };
}

/**
 * 执行已发布的多轮 Chatflow，只转发公开阶段、过滤后的回复及会话标识。
 * @param {object} options 内存凭据、已校验请求、事件回调、取消信号、可注入 fetch 和日志器。
 * @returns {Promise<object>} 完整回复、报告 ID、会话 ID、消息 ID 和本轮运行 ID。
 * @throws {Error} 上游失败、缺失终态、超时或身份错误时抛出，不把半条回复当成成功。
 */
async function runChat({ apiKey, request, onEvent, signal, fetchImpl = fetch, logger = console }) {
  if (!apiKey?.startsWith('app-')) throw chatError('报告追问服务尚未配置，请联系管理员。', 'not_configured', 409);
  const timeout = AbortSignal.timeout(240000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const { inputs, query, conversation_id, user, report_id } = request;
  let reader, taskId = '', runId = '', conversationId = conversation_id, messageId = '';
  let ended = false, workflowEnded = false, announced = false, answer = '', lastStage = '';
  let filter = createThinkContentFilter();
  /** 追加已过滤的公开文本；超大回复抛出容量错误，空片段不发送。 */
  function append(delta) {
    if (!delta) return;
    answer += delta;
    if (answer.length > 100000) throw chatError('回复过长，请缩小问题范围后重试。', 'answer_too_large');
    onEvent({ type: 'answer_delta', delta });
  }
  try {
    const response = await fetchImpl(`${API_BASE}/chat-messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ inputs, query, conversation_id, user, response_mode: 'streaming', auto_generate_name: false }),
      signal: requestSignal
    });
    if (!response.ok) {
      await response.body?.cancel();
      const message = response.status === 401 ? '追问服务的授权已失效，请联系管理员。' :
        response.status === 429 ? '追问服务繁忙，请稍后再试。' :
        response.status === 404 ? '当前追问会话不可用，请重新打开报告。' : '追问服务暂时无法完成，请稍后重试。';
      throw chatError(message, 'upstream_http', response.status === 429 ? 429 : 502);
    }
    if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
      await response.body?.cancel();
      throw chatError('追问服务未返回有效响应。', 'invalid_stream');
    }
    reader = response.body.getReader();
    const parser = createSsePayloadParser(event => {
      if (ended) return;
      taskId = event.task_id || taskId;
      runId = event.workflow_run_id || runId;
      messageId = event.message_id || messageId;
      if (event.conversation_id) {
        if (!UUID.test(event.conversation_id) || (conversationId && conversationId !== event.conversation_id)) {
          throw chatError('追问返回了不匹配的会话。', 'conversation_mismatch');
        }
        conversationId = event.conversation_id;
        if (!announced) {
          announced = true;
          onEvent({ type: 'session', conversation_id: conversationId, report_id });
        }
      }
      if (event.event === 'node_started') {
        const nodeId = String(event.data?.node_id || '');
        const stage = nodeId === 'knowledge' ? '正在查阅运营方法' :
          /^advisor_/.test(nodeId) ? '正在结合报告回答' : '正在理解追问';
        if (stage !== lastStage) { lastStage = stage; onEvent({ type: 'progress', message: stage }); }
      }
      // 不消费节点输入输出、text_chunk、Agent 思考或成本元数据。
      if (event.event === 'message' && typeof event.answer === 'string') append(filter.push(event.answer));
      if (event.event === 'message_replace' && typeof event.answer === 'string') {
        filter = createThinkContentFilter();
        const replacement = filter.push(event.answer) + filter.finish();
        if (replacement.length > 100000) throw chatError('回复过长，请缩小问题范围后重试。', 'answer_too_large');
        answer = replacement;
        onEvent({ type: 'answer_replace', answer });
      }
      if (event.event === 'error') throw chatError('本轮追问未能完成，请稍后重试。');
      if (event.event === 'workflow_finished') {
        workflowEnded = true;
        runId = runId || event.data?.id || '';
        if (event.data?.status !== 'succeeded') {
          logger.error('[operations-chat] workflow failed', { runId, status: event.data?.status });
          throw chatError('本轮追问未能完成，请稍后重试。');
        }
      }
      if (event.event === 'message_end') {
        append(filter.finish());
        ended = true;
      }
    });
    const decoder = new TextDecoder();
    let bytes = 0;
    while (!ended) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 8 * 1024 * 1024) throw chatError('追问响应过大，请缩小问题范围。', 'stream_too_large');
      parser.push(decoder.decode(chunk.value, { stream: true }));
    }
    parser.push(decoder.decode()); parser.finish();
    if (!ended || !answer.trim() || !conversationId || !messageId) {
      throw chatError('追问连接中断或回复不完整，请重试。', 'incomplete_stream');
    }
    const result = { answer, conversation_id: conversationId, message_id: messageId, workflow_run_id: runId, report_id };
    onEvent({ type: 'done', result });
    return result;
  } finally {
    await reader?.cancel().catch(() => {});
    // 关闭面板、切换报告和停止按钮都会取消本地读取，同时尽力停止同一上游任务。
    if (!ended && !workflowEnded && taskId) {
      await fetchImpl(`${API_BASE}/chat-messages/${encodeURIComponent(taskId)}/stop`, {
        method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user }), signal: AbortSignal.timeout(5000)
      }).then(response => response.body?.cancel()).catch(() => {});
    }
  }
}

module.exports = { buildChatRequest, runChat };
