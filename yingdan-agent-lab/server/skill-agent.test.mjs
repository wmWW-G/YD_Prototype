import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAlibabaSkillAgentResponse, detectSkillCommand } from './skill-agent.mjs';

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
