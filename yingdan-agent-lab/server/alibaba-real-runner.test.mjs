import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildHostMaterialPayload,
  createBridgeClient,
  resolvePreviousFullWeek,
  runAlibabaInquiryMeetingReal,
} from './alibaba-real-runner.mjs';

async function withTempProject() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-alibaba-real-'));
  return {
    projectRoot,
    async cleanup() {
      await rm(projectRoot, { recursive: true, force: true });
    },
  };
}

async function readJsonl(filePath) {
  const content = await readFile(filePath, 'utf8');
  return content
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test('resolvePreviousFullWeek returns the last complete Monday-Sunday period', () => {
  const period = resolvePreviousFullWeek(new Date('2026-06-27T12:00:00+08:00'));

  assert.deepEqual(period, {
    start: '2026-06-15',
    end: '2026-06-21',
    label: '上周完整自然周',
  });
});

test('createBridgeClient unwraps Accio gateway text content into business JSON data', async () => {
  const fixture = await withTempProject();
  const envPath = path.join(fixture.projectRoot, '.env');
  const toolsPath = path.join(fixture.projectRoot, 'tools.json');

  try {
    await writeFile(envPath, 'ACCIO_GATEWAY_TOKEN=test-token\nACCIO_AGENT_ID=test-agent\n', 'utf8');
    await writeFile(toolsPath, JSON.stringify({ tools: [{ name: 'subaccount_query' }] }), 'utf8');

    const client = await createBridgeClient({
      envPath,
      toolsPath,
      gatewayUrl: 'http://127.0.0.1:4097/mcp/proxy',
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            success: true,
            data: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    data: [{ firstName: 'Zhang', lastName: 'Vico', aliId: 123 }],
                  }),
                },
              ],
              isError: false,
            },
          });
        },
      }),
    });

    const result = await client.callTool('subaccount_query', {});

    assert.equal(result.ok, true);
    assert.deepEqual(result.data, {
      success: true,
      data: [{ firstName: 'Zhang', lastName: 'Vico', aliId: 123 }],
    });
    assert.equal(JSON.stringify(result.data).includes('content'), false);
  } finally {
    await fixture.cleanup();
  }
});

test('buildHostMaterialPayload turns real Alibaba observations into manager-grade workbook rows', () => {
  const payload = buildHostMaterialPayload({
    period: { start: '2026-05-11', end: '2026-05-17', label: '上周完整自然周' },
    discovery: [
      { name: 'subaccount_query', available: true, required: true },
      { name: 'query_seller_acct_dim_diag_data', available: true, required: true },
      { name: 'query_seller_shop_dim_diag_data', available: true, required: true },
      { name: 'query_seller_chat_quality_check_detail', available: true, required: true },
    ],
    observations: [
      {
        ok: true,
        required: true,
        businessSource: '业务员清单',
        data: {
          success: true,
          data: [
            { firstName: 'Zhang', lastName: 'Vico', aliId: 1 },
            { firstName: 'Ami', lastName: 'Song', aliId: 2 },
            { firstName: 'Susan', lastName: 'Su', aliId: 3 },
          ],
        },
      },
      {
        ok: true,
        required: true,
        businessSource: '业务员沟通诊断-大盘买家',
        data: {
          success: true,
          data: [
            { firstName: 'Zhang', lastName: 'Vico', newBuyerNum: 123, fiveMinReplyRate: 0.6775, replyTime: 1.22, buyerAb3Rate: 0.6829, buyerRnrRate: 0.08 },
            { firstName: 'Ami', lastName: 'Song', newBuyerNum: 67, fiveMinReplyRate: 0.6333, replyTime: 0.78, buyerAb3Rate: 0.5821, buyerRnrRate: 0.11 },
            { firstName: 'Susan', lastName: 'Su', newBuyerNum: 49, fiveMinReplyRate: 0.315, replyTime: 6.4, buyerAb3Rate: 0.33, buyerRnrRate: 0.41 },
          ],
        },
      },
      {
        ok: true,
        required: true,
        businessSource: '店铺询盘接待总览-大盘买家',
        data: {
          success: true,
          data: [
            { fiveMinReplyRate: 0.4475, fiveMinReplyRateAvg: 0.482, fiveMinReplyRate20th: 0.624, replyTime: 3.53, replyTimeAvg: 3.27, replyTime20th: 1.24, buyerAb3Rate: 0.4984, buyerAb3RateAvg: 0.471, buyerAb3Rate20th: 0.581, remindOpenAcctNum: 3 },
          ],
        },
      },
      {
        ok: true,
        required: true,
        businessSource: '聊天质检明细',
        date: '2026-05-13',
        data: {
          success: true,
          data: [
            {
              firstName: 'Susan',
              lastName: 'Su',
              buyerFirstName: 'Alex',
              buyerLastName: 'NordicSleep',
              buyerLevel: 'L3',
              replyOver12hMsgTime: '2026-05-13 22:30:00',
              buyerRnRMsgContent: '100 pcs trial order, need OEKO-TEX, REACH, DDP quote and label details.',
              l3l4Buyer: 1,
            },
            {
              firstName: 'Susan',
              lastName: 'Su',
              buyerFirstName: 'Anže',
              buyerLastName: 'Markelj',
              buyerLevel: 'L1',
              rcTooShortMsgContent: 'Need 12x16m tent technical data, wind resistance, waterproof level and DDP.',
              rcTooShort: 1,
            },
          ],
        },
      },
    ],
  });

  assert.equal(payload.salespeople.length, 3);
  assert.equal(payload.priority_inquiries.length, 2);
  assert.ok(payload.corrective_actions.length >= 3);
  assert.match(payload.overview[0].general_value, /44\.75%/);
  assert.match(payload.salespeople[0].name, /Zhang Vico/);
  assert.match(payload.priority_inquiries[0].buyer, /Alex/);
  assert.doesNotMatch(JSON.stringify(payload), /\[object Object\]|"text"|query_|subaccount_query|bridge|Gateway|localhost/i);
});

test('runAlibabaInquiryMeetingReal discovers tools, calls read-only Alibaba sources, and builds real-bridge XLSX payload', async () => {
  const fixture = await withTempProject();
  const calls = [];
  let builtPayload;

  const bridgeClient = {
    async listTools() {
      return [
        'subaccount_query',
        'query_seller_acct_dim_diag_data',
        'query_seller_shop_dim_diag_data',
        'query_seller_chat_quality_check_detail',
        'findCustomerShopInfo',
        'query_contact',
      ];
    },
    async callTool(name, args) {
      calls.push({ name, args });
      if (name === 'subaccount_query') {
        return {
          ok: true,
          data: {
            users: [
              { name: 'Alice', loginId: 'alice-demo' },
              { name: 'Bob', loginId: 'bob-demo' },
            ],
          },
          rawPath: `/tmp/${name}.json`,
        };
      }
      if (name === 'query_seller_chat_quality_check_detail') {
        return {
          ok: true,
          data: {
            details: [
              {
                buyer: 'US Retail Buyer',
                country: 'US',
                owner: 'Alice',
                level: 'L3',
                issue: '已读后没有形成下一步',
                evidence: '买家询问批量采购和交付条件，当前只看到基础确认。',
              },
            ],
          },
          rawPath: `/tmp/${name}.json`,
        };
      }
      return {
        ok: true,
        data: { summary: { inquiryCount: 3, replyRate: '64%' } },
        rawPath: `/tmp/${name}.json`,
      };
    },
  };

  try {
    const result = await runAlibabaInquiryMeetingReal({
      bridgeClient,
      buildXlsx: async ({ payload, manifestMode }) => {
        builtPayload = payload;
        return {
          ok: true,
          outputPath: path.join(fixture.projectRoot, 'workbench/artifacts/alibaba-inquiry-meeting-real/alibaba-inquiry-meeting/询盘分析会_2026-06-15_2026-06-21.xlsx'),
          manifestPath: path.join(fixture.projectRoot, 'workbench/artifacts/alibaba-inquiry-meeting-real/alibaba-inquiry-meeting/manifest.json'),
          workbookName: '询盘分析会_2026-06-15_2026-06-21.xlsx',
          validation: { mode: manifestMode, builderExitCode: 0, workbookExists: true },
        };
      },
      now: new Date('2026-06-27T12:00:00+08:00'),
      projectRoot: fixture.projectRoot,
    });

    assert.equal(result.ok, true);
    assert.equal(result.mode, 'real-bridge');
    assert.equal(result.period.start, '2026-06-15');
    assert.equal(result.period.end, '2026-06-21');
    assert.equal(result.validation.mode, 'real-bridge');

    assert.ok(calls.some((call) => call.name === 'subaccount_query'));
    assert.ok(calls.some((call) => call.name === 'query_seller_acct_dim_diag_data' && call.args.queryDate === '2026-06-15'));
    assert.ok(calls.some((call) => call.name === 'query_seller_shop_dim_diag_data' && call.args.buyerType === 1));
    assert.ok(calls.some((call) => call.name === 'query_seller_chat_quality_check_detail' && call.args.queryDate === '2026-06-21'));

    assert.equal(builtPayload.period.label, '上周完整自然周');
    assert.match(builtPayload.salespeople[0].name, /Alice/);
    assert.match(builtPayload.priority_inquiries[0].buyer, /US Retail Buyer/);
    assert.doesNotMatch(JSON.stringify(builtPayload), /query_|subaccount_query|bridge|Gateway|localhost/i);

    const events = await readJsonl(result.runLogPath);
    assert.deepEqual(events.at(0).type, 'run.started');
    assert.ok(events.some((event) => event.type === 'tool.discovery'));
    assert.ok(events.some((event) => event.type === 'tool.called'));
    assert.ok(events.some((event) => event.type === 'diagnosis.generated'));
    assert.equal(events.at(-1).type, 'run.completed');
  } finally {
    await fixture.cleanup();
  }
});
