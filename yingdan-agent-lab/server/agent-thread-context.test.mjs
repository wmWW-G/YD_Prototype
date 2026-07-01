import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAgentRequestContext,
  buildRecoverableWaitingContext,
  getCurrentAgentArtifact,
  pickNextSkillAgentResult,
} from '../agent-thread-prototype/src/agentThreadContext.js';

test('buildAgentRequestContext does not attach a stale artifact while a fresh task is waiting', () => {
  const staleResult = {
    artifact: {
      name: '旧客户推进分析.md',
      type: 'markdown',
    },
    period: {
      from: '2026-06-01',
      to: '2026-06-07',
    },
  };
  const context = buildAgentRequestContext({
    pendingTask: {
      missing: ['产品或核心卖点'],
      originalText: '重新开始，写一封开发信',
    },
  }, staleResult);

  assert.deepEqual(context, {
    pendingTask: {
      missing: ['产品或核心卖点'],
      originalText: '重新开始，写一封开发信',
    },
  });
  assert.equal(JSON.stringify(context).includes('旧客户推进分析'), false);
});

test('buildAgentRequestContext keeps the latest artifact only when context has no active waiting state', () => {
  const context = buildAgentRequestContext({}, {
    artifact: {
      name: '报价单.xlsx',
      type: 'xlsx',
    },
    period: {
      from: '2026-07-01',
      to: '2026-07-01',
    },
  });

  assert.deepEqual(context, {
    artifact: {
      name: '报价单.xlsx',
      type: 'xlsx',
    },
    period: {
      from: '2026-07-01',
      to: '2026-07-01',
    },
  });
});

test('getCurrentAgentArtifact hides stale artifacts during a new waiting task', () => {
  const artifact = getCurrentAgentArtifact({
    pendingTask: {
      missing: ['产品或核心卖点'],
      originalText: '重新开始，写一封开发信',
    },
  }, {
    artifact: {
      name: '旧客户推进分析.md',
      type: 'markdown',
    },
  });

  assert.equal(artifact, null);
});

test('pickNextSkillAgentResult clears the current artifact when payload owns an artifact-free context', () => {
  const nextResult = pickNextSkillAgentResult({
    kind: 'needs-input',
    context: {
      pendingTask: {
        missing: ['产品或核心卖点'],
      },
    },
  }, {
    artifact: {
      name: '旧客户推进分析.md',
      type: 'markdown',
    },
  });

  assert.equal(nextResult, null);
});

test('pickNextSkillAgentResult keeps a new artifact payload as the current result', () => {
  const payload = {
    kind: 'goal-run',
    artifact: {
      name: '报价单.xlsx',
      type: 'xlsx',
    },
  };

  assert.equal(pickNextSkillAgentResult(payload, null), payload);
});

test('buildRecoverableWaitingContext removes stale artifact data from local waiting fallback', () => {
  const context = buildRecoverableWaitingContext({
    artifact: {
      name: '旧客户推进分析.md',
      type: 'markdown',
    },
    period: {
      from: '2026-06-01',
      to: '2026-06-07',
    },
  }, {
    pendingTask: {
      missing: ['产品或核心卖点'],
      originalText: '重新开始，写一封开发信',
    },
  });

  assert.deepEqual(context, {
    pendingTask: {
      missing: ['产品或核心卖点'],
      originalText: '重新开始，写一封开发信',
    },
  });
  assert.equal(JSON.stringify(context).includes('旧客户推进分析'), false);
});

test('buildRecoverableWaitingContext preserves an existing pending task but still clears artifact data', () => {
  const context = buildRecoverableWaitingContext({
    artifact: {
      name: '旧客户推进分析.md',
      type: 'markdown',
    },
    pendingTask: {
      missing: ['询盘原文'],
      originalText: '帮我回客户',
    },
    period: {
      from: '2026-06-01',
      to: '2026-06-07',
    },
  }, {
    pendingTask: {
      missing: ['产品或核心卖点'],
      originalText: '重新开始，写一封开发信',
    },
  });

  assert.deepEqual(context, {
    pendingTask: {
      missing: ['询盘原文'],
      originalText: '帮我回客户',
    },
  });
});
