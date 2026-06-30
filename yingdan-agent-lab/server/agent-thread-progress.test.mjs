import assert from 'node:assert/strict';
import test from 'node:test';

import { mergeStreamingProgressItem } from '../agent-thread-prototype/src/agentThreadProgress.js';

test('mergeStreamingProgressItem updates only the latest same-label progress step', () => {
  let items = [];

  items = mergeStreamingProgressItem(items, {
    detail: '正在理解这次外贸任务要完成什么。',
    label: '识别任务',
    status: 'running',
  });
  items = mergeStreamingProgressItem(items, {
    detail: '已经理解这次外贸任务。',
    label: '识别任务',
    status: 'complete',
  });

  assert.deepEqual(items, [
    {
      detail: '已经理解这次外贸任务。',
      label: '识别任务',
      status: 'complete',
    },
  ]);

  items = mergeStreamingProgressItem(items, { detail: '已确认任务类型。', label: '确认任务类型', status: 'complete' });
  items = mergeStreamingProgressItem(items, { detail: '已检查产物生成权限。', label: '核对权限', status: 'complete' });
  items = mergeStreamingProgressItem(items, { detail: '已生成业务材料。', label: '生成材料', status: 'complete' });
  items = mergeStreamingProgressItem(items, { detail: '已检查结果。', label: '检查结果', status: 'complete' });
  items = mergeStreamingProgressItem(items, { detail: '保存前需要你确认。', label: '核对权限', status: 'complete' });
  items = mergeStreamingProgressItem(items, { detail: '等待你确认后继续。', label: '等待确认', status: 'waiting' });

  assert.deepEqual(items.map((item) => item.label), [
    '识别任务',
    '确认任务类型',
    '核对权限',
    '生成材料',
    '检查结果',
    '核对权限',
    '等待确认',
  ]);
  assert.equal(items.at(-1).status, 'pending');
});

test('mergeStreamingProgressItem preserves user-facing runtime phase labels', () => {
  const items = mergeStreamingProgressItem([], {
    detail: '已核对产物里的业务依据和用户事实覆盖。',
    label: '检查结果',
    phase: '检查',
    status: 'complete',
  });

  assert.deepEqual(items, [
    {
      detail: '已核对产物里的业务依据和用户事实覆盖。',
      label: '检查结果',
      phase: '检查',
      status: 'complete',
    },
  ]);
});
