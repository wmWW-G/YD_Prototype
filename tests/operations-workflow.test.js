const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { buildInputs, resolveEntry, normalizeOutputs, runWorkflow } = require('../lib/operations-workflow');
const { createOperationsServer } = require('../operations-dev-server.cjs');
const templates = require('../lib/operations-report-templates.json');

const logger = { info() {}, error() {} };
const key = 'app-test-only-operations';

/** 创建独立虚构报告和对应追问输入；不读取真实凭据，不主动抛错。 */
function fixture(inputs, prefix = '') {
  const report = {
    name: inputs.function_name, sub: '测试范围：虚构演示', data_status: 'insufficient', conclusion: '没有提供产品明细。',
    points: ['需先核对商品清单'], rows: [templates[inputs.function_name].headers, ['未提供', '未提供', '未提供']], content_markdown: '## 下一步\n补充产品明细后再进行逐品诊断。',
    evidence: [], actions: [], missing_data: ['产品列表与经营指标'], follow_up_questions: [],
    schema_version: '1.0', module: inputs.module, function_name: inputs.function_name, report_id: inputs.report_id
  };
  const envelope = { schema_version: '1.0', report_id: inputs.report_id, module: inputs.module, function_name: inputs.function_name, report };
  return {
    [`${prefix}status`]: 'ok', [`${prefix}report`]: report, [`${prefix}error`]: '',
    [`${prefix}chat_inputs`]: { module: inputs.module, business_context: inputs.business_context, diagnosis_context: JSON.stringify(envelope) }
  };
}

/** 用任意字节边界模拟 SSE；返回 Response，可覆盖中文跨分块和缺失尾部的情况。 */
function stream(events, chunkSize = 13) {
  const bytes = new TextEncoder().encode(events.map(event => `data: ${JSON.stringify(event)}`).join('\r\n\r\n'));
  let offset = 0;
  return new Response(new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) { controller.close(); return; }
      controller.enqueue(bytes.slice(offset, offset + chunkSize)); offset += chunkSize;
    }
  }), { headers: { 'Content-Type': 'text/event-stream' } });
}

/** 构造当前入口请求，保证每次测试身份互相独立。 */
function input() { return buildInputs({ function_name: '产品诊断', data_source: 'demo', business_context: '仅有演示目录，没有真实店铺明细。' }); }

test('运营入口按八板块白名单映射，拒绝错误来源与超长资料', () => {
  assert.deepEqual(resolveEntry('产品发布'), { module: '运营基建', function_name: '批量发品' });
  assert.deepEqual(resolveEntry('市场定位SOP'), { module: '营销定位', function_name: '市场&客群定位' });
  for (const name of ['随意调用', '__proto__', {}, null]) assert.throws(() => resolveEntry(name), /不支持/);
  assert.match(input().business_context, /虚构示例/);
  assert.notEqual(input().report_id, input().report_id);
  assert.throws(() => buildInputs({ function_name: '产品诊断', data_source: 'real', business_context: '数据' }), /演示资料/);
  assert.throws(() => buildInputs({ function_name: '产品诊断', data_source: 'demo', business_context: '数'.repeat(44001) }), /演示资料/);
});

test('正常和修复分支均输出真实报告，输入错误及失败分支不显示成功', () => {
  const inputs = input();
  for (const prefix of ['', 'repaired_']) assert.equal(normalizeOutputs(fixture(inputs, prefix), inputs).report.report_id, inputs.report_id);
  for (const prefix of ['invalid_', 'failed_']) assert.throws(() => normalizeOutputs({ [`${prefix}status`]: 'invalid_output' }, inputs), /未完成|未通过/);
  assert.throws(() => normalizeOutputs({ ...fixture(inputs), repaired_status: 'ok' }, inputs), /冲突/);
  assert.throws(() => normalizeOutputs({}, inputs), /不完整/);
});

test('Dify 将二维表格编码为文本后恢复原表格，并与原始追问报告核对', () => {
  const inputs = input();
  const outputs = fixture(inputs);
  const rows = [['分层', '产品数', '询盘'], ['未提供', '未提供', '未提供']];
  outputs.report.rows = rows;
  const envelope = JSON.parse(outputs.chat_inputs.diagnosis_context);
  envelope.report.rows = rows;
  outputs.chat_inputs.diagnosis_context = JSON.stringify(envelope);
  outputs.report.rows = JSON.stringify(rows);
  assert.deepEqual(normalizeOutputs(outputs, inputs).report.rows, rows);
  outputs.report.rows = '{broken';
  assert.throws(() => normalizeOutputs(outputs, inputs), /表格格式/);
});

test('报告摘要使用原 HTML 表头和容量，拒绝自由扩列、长篇正文及空摘要', () => {
  const inputs = buildInputs({ function_name: '优爆品提升', data_source: 'demo', business_context: '测试资料' });
  assert.match(inputs.business_context, /\["分层","数量","策略"\]/);
  assert.equal(Object.keys(templates).length, 28);
  for (const mutate of [
    report => { report.rows[0] = ['商品', '数量', '策略']; },
    report => { report.rows = [['商品', '平台状态', '内部决策', '资源缺口']]; },
    report => { report.points = []; },
    report => { report.points = ['长'.repeat(91)]; },
    report => { report.sub = '长'.repeat(61); },
    report => { report.rows[1][0] = '长'.repeat(61); },
    report => { report.rows.push(...Array(4).fill(['未提供', '未提供', '未提供'])); }
  ]) {
    const outputs = fixture(inputs); mutate(outputs.report);
    assert.throws(() => normalizeOutputs(outputs, inputs), /原有格式/);
  }
});

test('错误身份、空报告、伪造证据引用、内部思考及追问上下文错配均被拒绝', () => {
  const inputs = input();
  for (const mutate of [
    outputs => { outputs.report.report_id = 'other-report'; },
    outputs => { outputs.report.conclusion = ''; },
    outputs => { outputs.report.content_markdown = '<think>private reasoning</think>'; },
    outputs => { outputs.report.data_status = 'sufficient'; },
    outputs => { outputs.report.rows = [['表头'], ['错列', '第二列']]; },
    outputs => { outputs.report.actions = [{ id: 'a', target: '商品', decision: '核对', owner: '运营', review: '明细齐全后复核', priority: 'P0', steps: ['核对'], acceptance: ['齐全'], evidence_ids: ['missing'] }]; },
    outputs => { outputs.chat_inputs.business_context = '另一份资料'; },
    outputs => { outputs.chat_inputs.diagnosis_context = 'null'; }
  ]) {
    const outputs = fixture(inputs); mutate(outputs);
    assert.throws(() => normalizeOutputs(outputs, inputs));
  }
  const valid = fixture(inputs);
  const envelope = JSON.parse(valid.chat_inputs.diagnosis_context);
  envelope.report = Object.fromEntries(Object.entries(envelope.report).reverse());
  valid.chat_inputs.diagnosis_context = JSON.stringify(envelope);
  assert.equal(normalizeOutputs(valid, inputs).report.name, inputs.function_name);
});

test('分块流只向页面发送公开阶段及终态报告，不泄露 Key、提示词或中间推理', async () => {
  const inputs = input(), events = [], calls = [];
  const result = await runWorkflow({ apiKey: key, inputs, logger, onEvent: event => events.push(event),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return stream([
        { event: 'workflow_started', task_id: 'task-1', workflow_run_id: 'run-1' },
        { event: 'node_started', data: { node_id: 'advisor_7', inputs: 'private prompt' } },
        { event: 'text_chunk', data: { text: '<think>private reasoning</think>' } },
        { event: 'workflow_finished', data: { status: 'succeeded', outputs: fixture(inputs) } }
      ]);
    }
  });
  assert.equal(result.workflow_run_id, 'run-1');
  assert.deepEqual(events.map(event => event.type), ['progress', 'done']);
  assert.doesNotMatch(JSON.stringify(events), /app-test|private prompt|private reasoning/);
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${key}`);
  assert.equal(JSON.parse(calls[0].options.body).response_mode, 'streaming');
  assert.equal(calls.length, 1);
});

test('上游失败及中断不回退成示例报告，中断后停止同一上游任务', async () => {
  const inputs = input(), calls = [], events = [], logs = [];
  await assert.rejects(() => runWorkflow({ apiKey: key, inputs, logger: { error: (...args) => logs.push(args) }, onEvent: event => events.push(event),
    fetchImpl: async () => stream([
      { event: 'node_finished', workflow_run_id: 'run-fail', data: { node_id: 'validate_report', status: 'exception', error: `Unknown error ${key} private prompt` } },
      { event: 'workflow_finished', data: { status: 'failed', outputs: {} } }
    ])
  }), /报告校验未完成/);
  assert.equal(events.length, 0);
  assert.doesNotMatch(JSON.stringify(logs), /app-test|private prompt/);
  await assert.rejects(() => runWorkflow({ apiKey: key, inputs, logger, onEvent: event => events.push(event),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return calls.length === 1 ? stream([{ event: 'workflow_started', task_id: 'task-aborted' }]) : new Response('{}');
    }
  }), /连接中断/);
  assert.match(calls[1].url, /tasks\/task-aborted\/stop$/);
  assert.equal(JSON.parse(calls[1].options.body).user, JSON.parse(calls[0].options.body).user);
  assert.equal(events.length, 0);
});

test('真实 HTTP 接口拒绝跨站、凭据文件及非法输入，并完成受控 SSE 往返', async t => {
  let callCount = 0;
  // 端口 0 交给操作系统分配，Host 仍按显式配置值校验，避免固定测试端口冲突。
  const server = createOperationsServer({ port: 0, apiKey: key, logger, fetchImpl: async (_url, options) => {
    callCount += 1;
    const { inputs } = JSON.parse(options.body);
    return stream([{ event: 'workflow_finished', workflow_run_id: 'http-test', data: { status: 'succeeded', outputs: fixture(inputs, 'repaired_') } }]);
  } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  /** 访问测试服务器；支持伪造 Host 来验证 DNS 重绑定防护，返回状态及响应文本。 */
  const send = (target, { method = 'GET', headers = {}, body = '' } = {}) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: target, method, headers: { Host: '127.0.0.1:0', ...headers } }, res => {
      let text = ''; res.setEncoding('utf8'); res.on('data', chunk => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on('error', reject); req.end(body);
  });
  assert.equal((await send('/')).status, 200);
  assert.equal((await send('/prototypes/operations-advisor/workflow-client.js')).status, 200);
  for (const path of ['/.env', '/api/operations-diagnosis.js', '/lib/operations-workflow.js', '/output/operations-advisor/local-server.log', '/src/%2e%2e/.env']) {
    assert.equal((await send(path)).status, 404);
  }
  assert.equal((await send('/', { headers: { Host: 'attacker.example' } })).status, 403);
  const request = { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:0' }, body: JSON.stringify({ function_name: '产品诊断', business_context: '演示', data_source: 'demo' }) };
  assert.equal((await send('/api/operations-diagnosis', { ...request, headers: { ...request.headers, Origin: 'https://attacker.example' } })).status, 403);
  assert.equal((await send('/api/operations-diagnosis', { ...request, body: '{invalid' })).status, 400);
  assert.equal((await send('/api/operations-diagnosis', { ...request, body: '{}' })).status, 400);
  assert.equal(callCount, 0);
  const status = await send('/api/operations-diagnosis');
  assert.deepEqual(JSON.parse(status.text), { configured: true, data_source: 'demo' });
  const result = await send('/api/operations-diagnosis', request);
  assert.equal(result.status, 200);
  assert.match(result.headers['content-type'], /text\/event-stream/);
  assert.match(result.text, /"type":"done"/);
  assert.doesNotMatch(result.text, /app-test/);
  assert.equal(callCount, 1);
});
