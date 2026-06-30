import assert from 'node:assert/strict';
import test from 'node:test';

import {
  agentThreadStatusFromPayload,
  agentThreadStatusFromRestoredSession,
  isAgentThreadWaiting,
} from '../agent-thread-prototype/src/agentThreadStatus.js';

test('agentThreadStatusFromPayload keeps needs-input and confirmation threads waiting', () => {
  assert.equal(agentThreadStatusFromPayload({ kind: 'needs-input', status: 'waiting' }), 'waiting');
  assert.equal(agentThreadStatusFromPayload({ kind: 'needs-input-followup', status: 'waiting' }), 'waiting');
  assert.equal(agentThreadStatusFromPayload({ kind: 'confirmation-required', status: 'waiting' }), 'waiting');
});

test('agentThreadStatusFromPayload marks only completed task results as completed', () => {
  assert.equal(agentThreadStatusFromPayload({ kind: 'goal-run', status: 'completed' }), 'completed');
  assert.equal(agentThreadStatusFromPayload({ kind: 'followup', status: 'completed' }), 'completed');
  assert.equal(agentThreadStatusFromPayload({ ok: false, status: 'failed' }), 'error');
});

test('agentThreadStatusFromRestoredSession restores waiting sessions from server state', () => {
  assert.equal(agentThreadStatusFromRestoredSession({ kind: 'needs-input', status: 'waiting', messages: [{}] }), 'waiting');
  assert.equal(agentThreadStatusFromRestoredSession({ kind: 'confirmation-required', status: 'waiting', messages: [{}] }), 'waiting');
  assert.equal(agentThreadStatusFromRestoredSession({ status: 'completed', messages: [{}] }), 'completed');
  assert.equal(agentThreadStatusFromRestoredSession({ messages: [] }), 'idle');
  assert.equal(isAgentThreadWaiting('waiting'), true);
});
