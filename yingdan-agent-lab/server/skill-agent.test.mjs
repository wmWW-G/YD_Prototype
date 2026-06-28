import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAlibabaSkillAgentResponse,
  buildAgentFollowupResponse,
  detectSkillCommand,
  runNewConversationAgent,
} from './skill-agent.mjs';

test('detectSkillCommand recognizes the New Conversation skill execution phrase', () => {
  const command = detectSkillCommand('执行Skill：alibaba-inquiry-meeting');

  assert.deepEqual(command, {
    matched: true,
    skillId: 'alibaba-inquiry-meeting',
    mode: 'real-bridge',
  });
});

test('buildAlibabaSkillAgentResponse exposes business progress and XLSX artifact for the frontend agent', () => {
  const response = buildAlibabaSkillAgentResponse({
    result: {
      ok: true,
      mode: 'real-bridge',
      runId: 'alibaba-meeting-20260627-213031-tisb',
      period: { start: '2026-05-11', end: '2026-05-17', label: '上周完整自然周' },
      outputPath: '/tmp/询盘分析会_2026-05-11_2026-05-17.xlsx',
      manifestPath: '/tmp/manifest.json',
      workbookName: '询盘分析会_2026-05-11_2026-05-17.xlsx',
      validation: { mode: 'real-bridge', builderExitCode: 0, workbookExists: true },
      toolSummary: { attempted: 38, succeeded: 38, missing: 0, requiredSucceeded: 36 },
    },
    rowSummary: {
      workbookBytes: 34092,
      sheetCount: 8,
      rows: {
        本次会议总览: 15,
        本周询盘概览: 7,
        业务员询盘复盘: 10,
        重点询盘逐条分析: 14,
        共性问题归因: 6,
        会议主持提问: 8,
        下周跟进行动表: 18,
        会后追踪项: 10,
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.skillId, 'alibaba-inquiry-meeting');
  assert.equal(response.status, 'completed');
  assert.equal(response.artifact.outputPath, '/tmp/询盘分析会_2026-05-11_2026-05-17.xlsx');
  assert.deepEqual(
    response.progress.map((item) => item.label),
    ['读取Skill', '确定周期', '采集只读数据', '生成主持材料', '生成XLSX', '校验通过'],
  );
  assert.match(response.summary, /38 次只读采集/);
  assert.match(response.summary, /8 张 sheet/);
});

test('runNewConversationAgent returns a session thread with expandable execution process', async () => {
  const response = await runNewConversationAgent({
    text: '执行Skill：alibaba-inquiry-meeting',
    sessionId: 'session-user-provided',
    runner: async () => ({
      ok: true,
      mode: 'real-bridge',
      runId: 'alibaba-meeting-20260628-101500-abcd',
      period: { start: '2026-06-15', end: '2026-06-21', label: '上周完整自然周' },
      outputPath: '/tmp/询盘分析会_2026-06-15_2026-06-21.xlsx',
      manifestPath: '/tmp/manifest.json',
      runLogPath: '/tmp/alibaba-meeting-20260628-101500-abcd.jsonl',
      workbookName: '询盘分析会_2026-06-15_2026-06-21.xlsx',
      validation: { mode: 'real-bridge', builderExitCode: 0, workbookExists: true, workbookBytes: 24734 },
      toolSummary: { attempted: 38, succeeded: 38, missing: 0, requiredSucceeded: 36 },
    }),
  });

  assert.equal(response.ok, true);
  assert.equal(response.sessionId, 'session-user-provided');
  assert.equal(response.messages.length, 2);
  assert.equal(response.messages[0].role, 'user');
  assert.equal(response.messages[1].role, 'assistant');
  assert.equal(response.messages[1].process.expanded, false);
  assert.deepEqual(
    response.messages[1].process.steps.map((item) => item.label),
    ['读取Skill', '确定周期', '采集只读数据', '生成主持材料', '生成XLSX', '校验通过'],
  );
  assert.equal(response.messages[1].artifact.outputPath, '/tmp/询盘分析会_2026-06-15_2026-06-21.xlsx');
});

test('buildAgentFollowupResponse keeps the same session without rerunning the skill', () => {
  const response = buildAgentFollowupResponse({
    sessionId: 'agent-session-20260628-101500-abcd',
    text: '把下周跟进行动表按负责人再总结一下',
    context: {
      artifact: { workbookName: '询盘分析会_2026-06-15_2026-06-21.xlsx' },
      period: { start: '2026-06-15', end: '2026-06-21' },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'followup');
  assert.equal(response.sessionId, 'agent-session-20260628-101500-abcd');
  assert.equal(response.messages.length, 1);
  assert.equal(response.messages[0].role, 'assistant');
  assert.match(response.messages[0].content, /不会重新采集/);
  assert.match(response.messages[0].content, /询盘分析会_2026-06-15_2026-06-21.xlsx/);
});
