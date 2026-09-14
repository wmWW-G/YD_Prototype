const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const http = require('node:http');
const { buildInputs } = require('../lib/operations-workflow');
const { buildChatRequest, runChat } = require('../lib/operations-chat');
const { createOperationsServer } = require('../operations-dev-server.cjs');
const entries = require('../lib/operations-entry-map.json');
const templates = require('../lib/operations-report-templates.json');
const logger = { info() {}, error() {} };
const key = 'app-test-only-chatflow';
const cid = '11111111-1111-4111-8111-111111111111';
const mid = '22222222-2222-4222-8222-222222222222';

/** 创建指定功能的虚构结构化报告，作为 Workflow → Chatflow 的离线交接，不读取真实数据。 */
function body(name = '优爆品提升') {
  const inputs = buildInputs({ function_name: name, business_context: '测试目录；未提供经营明细。', data_source: 'demo' });
  const report = {
    schema_version: '1.0', module: inputs.module, function_name: name, report_id: inputs.report_id,
    name, sub: '虚构测试资料', data_status: 'insufficient', conclusion: '先补充商品明细。',
    points: ['先核对商品目录'], rows: [templates[name]?.headers || ['项目', '状态']],
    content_markdown: '待补充经营明细。', evidence: [], actions: [], missing_data: ['商品明细'], follow_up_questions: []
  };
  return { report_id: inputs.report_id, data_source: 'demo', query: '先补充哪项资料？', conversation_id: '', chat_inputs: {
    module: inputs.module, business_context: inputs.business_context,
    diagnosis_context: JSON.stringify({ schema_version: '1.0', report_id: inputs.report_id, module: inputs.module, function_name: name, report })
  } };
}

/** 将 SSE 切成单字节分块，验证中文及 think 标签跨分块时不会泄漏或丢字。 */
function stream(events) {
  const bytes = new TextEncoder().encode(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(''));
  let offset = 0;
  return new Response(new ReadableStream({ pull(controller) {
    if (offset === bytes.length) controller.close();
    else controller.enqueue(bytes.slice(offset, ++offset));
  } }), { headers: { 'Content-Type': 'text/event-stream' } });
}

/** 当前 Chatflow 的一次正常消息序列；节点内容刻意包含不可转发的测试标记。 */
function events() {
  return [
    { event: 'workflow_started', task_id: 'task-chat', workflow_run_id: 'run-chat' },
    { event: 'node_started', data: { node_id: 'advisor_6', inputs: 'private-input' } },
    { event: 'text_chunk', data: { text: 'private-rewrite' } },
    { event: 'message', conversation_id: cid, message_id: mid, answer: '<thi' },
    { event: 'message', answer: 'nk>private-thinking</think>先核对' },
    { event: 'message', answer: '商品明细。' },
    { event: 'workflow_finished', data: { status: 'succeeded', outputs: { answer: 'private-output' } } },
    { event: 'message_end', conversation_id: cid, message_id: mid }
  ];
}

test('32 个 function 共用三个 Chatflow 输入，保持报告身份并隔离新报告会话', () => {
  const users = new Set();
  for (const name of Object.values(entries).flat()) {
    const b = body(name), first = buildChatRequest(b);
    assert.deepEqual(Object.keys(first.inputs), ['module', 'business_context', 'diagnosis_context']);
    assert.equal(first.conversation_id, '');
    assert.equal(first.report_id, b.report_id);
    const next = buildChatRequest({ ...b, query: '上一项怎么验收？', conversation_id: cid, user: 'browser-cannot-override' });
    assert.equal(next.user, first.user);
    assert.equal(next.conversation_id, cid);
    assert.notEqual(next.user, 'browser-cannot-override');
    assert.notEqual(buildChatRequest(body(name)).user, first.user);
    users.add(first.user);
  }
  assert.equal(users.size, 32);
});

test('没有报告、错配上下文、非法会话和超长问题在调用前拒绝', () => {
  for (const mutate of [
    b => { b.report_id = 'another-report'; },
    b => { b.chat_inputs.module = '商机转化'; },
    b => { b.chat_inputs.diagnosis_context = 'null'; },
    b => { b.chat_inputs.business_context = '字'.repeat(48001); },
    b => { b.query = ' '; }, b => { b.query = '字'.repeat(4001); },
    b => { b.conversation_id = '../unexpected'; }, b => { b.data_source = 'real'; }
  ]) {
    const b = body(); mutate(b); assert.throws(() => buildChatRequest(b));
  }
});

test('流式回复只输出公开文字，首次和续问正确传 conversation_id 与同一 user', async () => {
  const b = body(), publicEvents = [], calls = [];
  for (const conversation_id of ['', cid]) {
    const request = buildChatRequest({ ...b, conversation_id });
    const result = await runChat({ apiKey: key, request, logger, onEvent: event => publicEvents.push(event),
      fetchImpl: async (url, options) => { calls.push({ url, options }); return stream(events()); } });
    assert.equal(result.answer, '先核对商品明细。');
    assert.equal(result.report_id, b.report_id);
    assert.equal(result.conversation_id, cid);
    assert.equal(result.workflow_run_id, 'run-chat');
  }
  const payloads = calls.map(call => JSON.parse(call.options.body));
  assert.equal(payloads[0].conversation_id, ''); assert.equal(payloads[1].conversation_id, cid);
  assert.equal(payloads[0].user, payloads[1].user);
  assert.equal(payloads[0].response_mode, 'streaming');
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${key}`);
  assert.doesNotMatch(JSON.stringify(publicEvents), /private-|app-test/);
  assert.equal(publicEvents.filter(event => event.type === 'done').length, 2);
});

test('审核替换答案覆盖旧文本，过滤替换内容的隐藏思考', async () => {
  const data = events();
  data.splice(-1, 0, { event: 'message_replace', answer: '<think>private-thinking</think>改为核验资料来源。' });
  const result = await runChat({ apiKey: key, request: buildChatRequest(body()), onEvent() {}, logger, fetchImpl: async () => stream(data) });
  assert.equal(result.answer, '改为核验资料来源。');
});

test('缺失终态或失败不返回成功，流中断会停止同一任务', async () => {
  const calls = [], out = [], request = buildChatRequest(body());
  await assert.rejects(runChat({ apiKey: key, request, logger, onEvent: event => out.push(event),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return calls.length === 1 ? stream(events().slice(0, 6)) : new Response('{}');
    }
  }), /不完整/);
  assert.equal(out.some(event => event.type === 'done'), false);
  assert.match(calls[1].url, /chat-messages\/task-chat\/stop$/);
  assert.equal(JSON.parse(calls[1].options.body).user, request.user);
  for (const failure of [
    { event: 'error', message: `${key} private-input` },
    { event: 'workflow_finished', data: { status: 'failed', error: 'private-input' } }
  ]) {
    await assert.rejects(runChat({ apiKey: key, request, logger, onEvent() {}, fetchImpl: async () => stream([failure]) }), /未能完成/);
  }
});

test('取消信号传给上游读取，并停止已启动的同一任务', async () => {
  const controller = new AbortController(), calls = [], request = buildChatRequest(body());
  let receivedSignal;
  await assert.rejects(runChat({ apiKey: key, request, logger, signal: controller.signal, onEvent() {},
    fetchImpl: async (url, options) => {
      calls.push(url);
      if (url.endsWith('/stop')) return new Response('{}');
      receivedSignal = options.signal;
      let sent = false;
      return new Response(new ReadableStream({ pull(streamController) {
        if (!sent) { sent = true; streamController.enqueue(new TextEncoder().encode('data: {"event":"workflow_started","task_id":"cancel-me"}\n\n')); return; }
        controller.abort(); streamController.error(options.signal.reason);
      } }), { headers: { 'Content-Type': 'text/event-stream' } });
    }
  }), { name: 'AbortError' });
  assert.equal(receivedSignal.aborted, true);
  assert.match(calls[1], /cancel-me\/stop$/);
});

test('HTTP 追问接口独立配置，拒绝跨站与缺报告，完成首问和续问', async t => {
  const requests = [];
  const server = createOperationsServer({ port: 0, chatApiKey: key, logger,
    fetchImpl: async (_url, options) => { requests.push(JSON.parse(options.body)); return stream(events()); } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}/api/operations-chat`;
  /** 原生 HTTP 保留测试 Host；Node fetch 会重写 Host，因此不用于这项来源校验。 */
  const send = ({ method = 'GET', headers = {}, body = '' } = {}) => new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers }, res => {
      let text = ''; res.setEncoding('utf8'); res.on('data', chunk => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, text }));
    });
    req.on('error', reject); req.end(body);
  });
  const headers = { Host: '127.0.0.1:0', Origin: 'http://127.0.0.1:0', 'Content-Type': 'application/json' };
  const config = JSON.parse((await send({ headers })).text);
  assert.deepEqual(config, { configured: true, data_source: 'demo' });
  assert.equal((await send({ method: 'POST', headers: { ...headers, Origin: 'https://evil.example' }, body: '{}' })).status, 403);
  assert.equal((await send({ method: 'POST', headers, body: '{}' })).status, 400);
  assert.equal(requests.length, 0);
  const b = body();
  for (const conversation_id of ['', cid]) {
    const response = await send({ method: 'POST', headers, body: JSON.stringify({ ...b, conversation_id }) });
    const content = response.text;
    assert.equal(response.status, 200); assert.match(content, /"type":"done"/);
    assert.doesNotMatch(content, /private-|app-test/);
  }
  assert.equal(requests[1].conversation_id, cid);
  assert.equal(requests[0].user, requests[1].user);
});
