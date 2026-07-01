import assert from 'node:assert/strict';
import test from 'node:test';

import {
  sanitizeAgentActivityItemForDisplay,
  sanitizeAgentProcessStepForDisplay,
  scrubAgentArtifactDisplayName,
} from '../agent-thread-prototype/src/agentThreadDisplayText.js';

test('sanitizeAgentActivityItemForDisplay hides runtime action text from expanded activity', () => {
  const item = sanitizeAgentActivityItemForDisplay({
    kind: 'tool',
    phase: 'action.executed',
    title: 'tool_call query_customer skill-runtime-20260630',
    detail: 'output_path: workbench/artifacts/run-1/file.md',
    observation: 'run_id=skill-runtime-raw',
    nextAction: 'artifact.write_markdown',
    status: 'complete',
  });

  const publicText = JSON.stringify(item);
  assert.equal(publicText.includes('tool_call'), false);
  assert.equal(publicText.includes('output_path'), false);
  assert.equal(publicText.includes('skill-runtime'), false);
  assert.equal(publicText.includes('action.executed'), false);
  assert.equal(publicText.includes('artifact.write_markdown'), false);
  assert.equal(item.title, '处理任务');
  assert.equal(item.detail, '已隐藏内部执行细节。');
  assert.equal(item.observation, '已整理为业务结果');
  assert.equal(item.nextAction, '继续按当前任务处理');
});

test('sanitizeAgentProcessStepForDisplay hides runtime process text from restored steps', () => {
  const step = sanitizeAgentProcessStepForDisplay({
    phase: 'policy.checked',
    label: 'skill-runtime-20260630 runId',
    detail: 'manifestPath=/Users/garden/workbench/artifacts/manifest.json',
    status: 'running',
  });

  const publicText = JSON.stringify(step);
  assert.equal(publicText.includes('policy.checked'), false);
  assert.equal(publicText.includes('skill-runtime'), false);
  assert.equal(publicText.includes('manifestPath'), false);
  assert.equal(publicText.includes('/Users/garden'), false);
  assert.equal(step.phase, '处理');
  assert.equal(step.label, '处理任务');
  assert.equal(step.detail, '已隐藏内部执行细节。');
});

test('scrubAgentArtifactDisplayName keeps normal business artifact names', () => {
  assert.equal(scrubAgentArtifactDisplayName({ name: '客户推进分析.md', type: 'markdown' }), '客户推进分析.md');
  assert.equal(scrubAgentArtifactDisplayName({ name: '报价单.xlsx', type: 'xlsx' }), '报价单.xlsx');
});
