import assert from 'node:assert/strict';
import test from 'node:test';

import { mergeAgentRequestContext } from './agent-request-context.mjs';

test('mergeAgentRequestContext ignores stale client pending task when server context exists', () => {
  const context = mergeAgentRequestContext({
    clientContext: {
      pendingTask: {
        runtime: {
          resumeFrom: 'needs-input:stale-client-task',
          runId: 'skill-runtime-stale-client',
        },
      },
    },
    serverContext: {
      artifact: {
        name: '客户推进分析.md',
        type: 'markdown',
      },
    },
  });

  assert.equal(context.pendingTask, undefined);
  assert.deepEqual(context.artifact, {
    name: '客户推进分析.md',
    type: 'markdown',
  });
  assert.equal(JSON.stringify(context).includes('skill-runtime-stale-client'), false);
});

test('mergeAgentRequestContext uses client pending task only when there is no server context', () => {
  const context = mergeAgentRequestContext({
    clientContext: {
      pendingTask: {
        missing: ['产品或核心卖点'],
        originalText: '写一封开发信',
      },
    },
    serverContext: {},
  });

  assert.deepEqual(context.pendingTask, {
    missing: ['产品或核心卖点'],
    originalText: '写一封开发信',
  });
});

test('mergeAgentRequestContext prefers server pending confirmation over stale client confirmation', () => {
  const context = mergeAgentRequestContext({
    clientContext: {
      pendingConfirmation: {
        runtime: {
          resumeFrom: 'policy:stale-client-action',
          runId: 'skill-runtime-stale-confirmation',
        },
        title: '旧确认卡',
      },
    },
    serverContext: {
      pendingConfirmation: {
        runtime: {
          resumeFrom: 'policy:artifact.export_file',
          runId: 'skill-runtime-server-confirmation',
        },
        title: '导出文件前需要确认',
      },
    },
  });

  assert.equal(context.pendingConfirmation.title, '导出文件前需要确认');
  assert.equal(context.pendingConfirmation.runtime.resumeFrom, 'policy:artifact.export_file');
  assert.equal(JSON.stringify(context).includes('skill-runtime-stale-confirmation'), false);
});

test('mergeAgentRequestContext does not reattach stale client artifact to a fresh server waiting task', () => {
  const context = mergeAgentRequestContext({
    clientContext: {
      artifact: {
        name: '旧客户推进分析.md',
        type: 'markdown',
      },
      period: {
        from: '2026-06-01',
        to: '2026-06-07',
      },
    },
    serverContext: {
      pendingTask: {
        missing: ['产品或核心卖点'],
        originalText: '重新开始，写一封开发信',
      },
    },
  });

  assert.deepEqual(context.pendingTask, {
    missing: ['产品或核心卖点'],
    originalText: '重新开始，写一封开发信',
  });
  assert.equal(Object.prototype.hasOwnProperty.call(context, 'artifact'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(context, 'period'), false);
  assert.equal(JSON.stringify(context).includes('旧客户推进分析'), false);
});
