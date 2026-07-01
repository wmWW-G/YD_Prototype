import assert from 'node:assert/strict';
import test from 'node:test';

import { getNewConversationComposerState } from '../agent-thread-prototype/src/agentThreadComposerState.js';

test('getNewConversationComposerState labels actionable confirmation as a confirmation pause', () => {
  const state = getNewConversationComposerState({
    agentStatus: 'waiting',
    currentArtifact: {
      name: '开发信草稿.md',
    },
    messages: [
      {
        id: 'm-confirm',
        confirmation: {
          title: '外发前需要你确认',
        },
      },
    ],
    sessionId: 'agent-session-1',
    taskTitle: '外发前需要你确认',
  });

  assert.equal(state.hasActionableConfirmation, true);
  assert.equal(state.statusChipLabel, '等待确认');
  assert.equal(state.composerPlaceholder, '补充确认信息，或直接点上方按钮处理这一步...');
  assert.equal(state.composerContextLabel, '正在接着：开发信草稿.md');
  assert.equal(state.sendButtonLabel, '补充说明');
  assert.equal(state.latestMessageId, 'm-confirm');
});

test('getNewConversationComposerState keeps missing-input waiting as supplement context', () => {
  const state = getNewConversationComposerState({
    agentStatus: 'waiting',
    messages: [
      {
        id: 'm-needs-input',
        needsInput: {
          items: ['客户是谁', '产品是什么'],
        },
      },
    ],
    sessionId: 'agent-session-2',
    taskTitle: '开发信草稿',
  });

  assert.equal(state.hasActionableConfirmation, false);
  assert.equal(state.statusChipLabel, '等待补充');
  assert.equal(state.composerPlaceholder, '继续补充 开发信草稿 的要求，或追问这次任务...');
  assert.equal(state.composerContextLabel, '当前任务：开发信草稿');
  assert.equal(state.sendButtonLabel, '继续补充');
});

test('getNewConversationComposerState does not keep an old confirmation actionable after a later message', () => {
  const state = getNewConversationComposerState({
    agentStatus: 'waiting',
    messages: [
      {
        id: 'm-old-confirm',
        confirmation: {
          title: '导出前需要你确认',
        },
      },
      {
        id: 'm-later',
        needsInput: {
          items: ['请先选择要导出的产物'],
        },
      },
    ],
    sessionId: 'agent-session-3',
    taskTitle: '询盘分析会',
  });

  assert.equal(state.hasActionableConfirmation, false);
  assert.equal(state.latestMessageId, 'm-later');
  assert.equal(state.statusChipLabel, '等待补充');
  assert.equal(state.sendButtonLabel, '继续补充');
});

test('getNewConversationComposerState turns completed sessions with artifacts into artifact follow-up mode', () => {
  const state = getNewConversationComposerState({
    agentStatus: 'completed',
    currentArtifact: {
      name: '客户推进分析.md',
    },
    messages: [
      {
        id: 'm-done',
        confirmation: {
          title: '这张旧确认卡不能再点',
        },
      },
    ],
    sessionId: 'agent-session-4',
    taskTitle: '客户推进分析',
  });

  assert.equal(state.hasActionableConfirmation, false);
  assert.equal(state.statusChipLabel, '本次任务可继续');
  assert.equal(state.composerPlaceholder, '继续修改 客户推进分析.md，或补一句新的要求...');
  assert.equal(state.composerContextLabel, '正在接着：客户推进分析.md');
  assert.equal(state.sendButtonLabel, '继续追问');
});

test('getNewConversationComposerState truncates long task labels for the composer context', () => {
  const state = getNewConversationComposerState({
    agentStatus: 'completed',
    messages: [{ id: 'm-done' }],
    sessionId: 'agent-session-5',
    taskTitle: '这是一个非常非常非常非常非常长的客户推进任务标题还要继续补充很多背景',
  });

  assert.equal(state.composerContextLabel.startsWith('当前任务：'), true);
  assert.equal(state.composerContextLabel.endsWith('...'), true);
  assert.equal(state.composerContextLabel.length <= 36, true);
  assert.match(state.composerPlaceholder, /^继续补充 .+\.{3} 的要求，或追问这次任务\.\.\.$/);
});

test('getNewConversationComposerState hides runtime artifact names from the composer', () => {
  const state = getNewConversationComposerState({
    agentStatus: 'completed',
    currentArtifact: {
      name: 'quotation-sheet-skill-runtime-20260630-011458-s63f-已续改-20260630011458-dajv.xlsx',
      type: 'xlsx',
    },
    messages: [{ id: 'm-done' }],
    sessionId: 'agent-session-runtime-name',
    taskTitle: '报价单',
  });

  assert.equal(state.composerContextLabel, '正在接着：报价单.xlsx');
  assert.equal(state.composerPlaceholder, '继续修改 报价单.xlsx，或补一句新的要求...');
  assert.equal(JSON.stringify(state).includes('skill-runtime'), false);
  assert.equal(JSON.stringify(state).includes('quotation-sheet'), false);
});

test('getNewConversationComposerState hides runtime task titles from the composer', () => {
  const state = getNewConversationComposerState({
    agentStatus: 'waiting',
    messages: [{ id: 'm-needs-input', needsInput: { items: ['产品资料'] } }],
    sessionId: 'agent-session-runtime-title',
    taskTitle: 'skill-runtime-20260630-raw runId outputPath schema tool_call',
  });

  assert.equal(state.composerContextLabel, '当前任务：本次任务');
  assert.equal(state.composerPlaceholder, '继续补充 本次任务 的要求，或追问这次任务...');
  assert.equal(JSON.stringify(state).includes('skill-runtime'), false);
  assert.equal(JSON.stringify(state).includes('tool_call'), false);
});

test('getNewConversationComposerState keeps normal business titles that mention schema', () => {
  const state = getNewConversationComposerState({
    agentStatus: 'waiting',
    messages: [{ id: 'm-needs-input', needsInput: { items: ['文件说明'] } }],
    sessionId: 'agent-session-normal-schema-title',
    taskTitle: '客户要求提供 schema 说明',
  });

  assert.equal(state.composerContextLabel, '当前任务：客户要求提供 schema 说明');
  assert.equal(state.composerPlaceholder, '继续补充 客户要求提供 schema 说明 的要求，或追问这次任务...');
});
