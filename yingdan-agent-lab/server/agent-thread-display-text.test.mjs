import assert from 'node:assert/strict';
import test from 'node:test';

import {
  sanitizeAgentActivityItemForDisplay,
  sanitizeAgentConfirmationForDisplay,
  sanitizeAgentNeedsInputForDisplay,
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

test('sanitizeAgentNeedsInputForDisplay hides runtime text from missing input cards', () => {
  const needsInput = sanitizeAgentNeedsInputForDisplay({
    title: 'needs-input skill-runtime-20260630 runId',
    hint: 'resume from outputPath workbench/artifacts/run-1',
    items: [
      '客户官网',
      'tool_call query_customer',
      'manifestPath=/Users/garden/workbench/artifacts/manifest.json',
    ],
  });

  const publicText = JSON.stringify(needsInput);
  assert.equal(publicText.includes('skill-runtime'), false);
  assert.equal(publicText.includes('runId'), false);
  assert.equal(publicText.includes('tool_call'), false);
  assert.equal(publicText.includes('manifestPath'), false);
  assert.equal(publicText.includes('/Users/garden'), false);
  assert.deepEqual(needsInput.items, ['客户官网', '需要补充的业务资料', '需要补充的业务资料']);
  assert.equal(needsInput.title, '需要补充资料');
  assert.equal(needsInput.hint, '直接补一句话即可,我会接着这次任务继续。');
});

test('sanitizeAgentConfirmationForDisplay hides runtime text from confirmation cards', () => {
  const confirmation = sanitizeAgentConfirmationForDisplay({
    type: 'export_file',
    title: 'policy.checked artifact.export_file run_id=skill-runtime-raw',
    body: 'checkpointPath=/Users/garden/workbench/runs/run.checkpoint.json',
    confirmLabel: '确认 tool_call export_file',
    cancelLabel: '取消 output_path workbench/exports/file.xlsx',
  });

  const publicText = JSON.stringify(confirmation);
  assert.equal(publicText.includes('policy.checked'), false);
  assert.equal(publicText.includes('artifact.export_file'), false);
  assert.equal(publicText.includes('skill-runtime'), false);
  assert.equal(publicText.includes('checkpointPath'), false);
  assert.equal(publicText.includes('tool_call'), false);
  assert.equal(publicText.includes('output_path'), false);
  assert.equal(confirmation.title, '这一步需要确认');
  assert.equal(confirmation.body, '确认前不会保存、导出、外发或扣费。');
  assert.equal(confirmation.confirmLabel, '确认导出');
  assert.equal(confirmation.cancelLabel, '取消');
  assert.equal(confirmation.confirmActionText, '确认导出');
  assert.equal(confirmation.cancelActionText, '取消这一步');
});

test('sanitizeAgentConfirmationForDisplay hides scrubbed task-file placeholders from buttons', () => {
  const confirmation = sanitizeAgentConfirmationForDisplay({
    type: 'export_file',
    title: '导出文件前需要确认',
    body: '这一步会生成导出副本。',
    confirmLabel: '确认 当前任务文件.xlsx',
    cancelLabel: '取消 当前任务文件.xlsx',
  });

  const publicText = JSON.stringify(confirmation);
  assert.equal(publicText.includes('当前任务文件'), false);
  assert.equal(confirmation.confirmLabel, '确认导出');
  assert.equal(confirmation.cancelLabel, '取消');
  assert.equal(confirmation.confirmActionText, '确认导出');
  assert.equal(confirmation.cancelActionText, '取消这一步');
});

test('sanitizeAgentConfirmationForDisplay keeps safe display separate from backend confirmation text', () => {
  assert.equal(
    sanitizeAgentConfirmationForDisplay({ type: 'customer_write', confirmLabel: 'tool_call customer.write_memory' }).confirmActionText,
    '确认写入',
  );
  assert.equal(
    sanitizeAgentConfirmationForDisplay({ type: 'external_send', confirmLabel: 'outputPath workbench/mail.json' }).confirmActionText,
    '先生成草稿',
  );
  assert.equal(
    sanitizeAgentConfirmationForDisplay({ type: 'runtime_policy', confirmLabel: 'artifact.export_file' }).confirmActionText,
    '确认继续',
  );
  assert.equal(
    sanitizeAgentConfirmationForDisplay({ confirmLabel: 'tool_call export', confirmActionText: '确认导出' }).confirmActionText,
    '确认导出',
  );
});

test('sanitizeAgentConfirmationForDisplay hides bare snake_case action tokens', () => {
  const confirmation = sanitizeAgentConfirmationForDisplay({
    type: 'customer_write',
    body: '这一步会执行 customer_write。',
    confirmLabel: '确认 tool_call customer_write',
    title: 'policy.checked customer_write',
  });

  const publicText = JSON.stringify(confirmation);
  assert.equal(publicText.includes('customer_write'), false);
  assert.equal(publicText.includes('tool_call'), false);
  assert.equal(confirmation.confirmLabel, '确认写入');
  assert.equal(confirmation.confirmActionText, '确认写入');
});

test('scrubAgentArtifactDisplayName keeps normal business artifact names', () => {
  assert.equal(scrubAgentArtifactDisplayName({ name: '客户推进分析.md', type: 'markdown' }), '客户推进分析.md');
  assert.equal(scrubAgentArtifactDisplayName({ name: '报价单.xlsx', type: 'xlsx' }), '报价单.xlsx');
});
