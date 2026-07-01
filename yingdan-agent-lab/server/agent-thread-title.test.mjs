import assert from 'node:assert/strict';
import test from 'node:test';

import { deriveAgentThreadTaskTitle } from '../agent-thread-prototype/src/agentThreadTitle.js';

test('deriveAgentThreadTaskTitle keeps the business task title during a later confirmation pause', () => {
  const title = deriveAgentThreadTaskTitle(
    {
      kind: 'confirmation-required',
      taskTitle: '写入客户档案前需要确认',
      messages: [
        {
          role: 'assistant',
          confirmation: {
            title: '写入客户档案前需要确认',
          },
        },
      ],
    },
    '客户推进分析'
  );

  assert.equal(title, '客户推进分析');
});

test('deriveAgentThreadTaskTitle uses the confirmation title when the first message is only a confirmation pause', () => {
  const title = deriveAgentThreadTaskTitle({
    kind: 'confirmation-required',
    taskTitle: '外发前需要你确认',
    messages: [
      {
        role: 'assistant',
        confirmation: {
          title: '外发前需要你确认',
        },
      },
    ],
  });

  assert.equal(title, '外发前需要你确认');
});

test('deriveAgentThreadTaskTitle allows a new completed business task to replace the previous title', () => {
  const title = deriveAgentThreadTaskTitle(
    {
      kind: 'goal-run',
      taskTitle: '报价单',
      artifact: {
        name: '报价单.xlsx',
        workbookName: '报价单.xlsx',
      },
    },
    '客户推进分析'
  );

  assert.equal(title, '报价单');
});

test('deriveAgentThreadTaskTitle hides raw runtime task titles from the page heading', () => {
  const title = deriveAgentThreadTaskTitle({
    kind: 'goal-run',
    taskTitle: 'skill-runtime-20260630-raw runId outputPath schema tool_call',
    artifact: {
      name: 'quotation-sheet-skill-runtime-20260630-011458-s63f.xlsx',
      type: 'xlsx',
    },
  });

  assert.equal(title, '报价单.xlsx');
  assert.equal(title.includes('skill-runtime'), false);
  assert.equal(title.includes('tool_call'), false);
});

test('deriveAgentThreadTaskTitle keeps normal business titles that mention schema', () => {
  const title = deriveAgentThreadTaskTitle({
    kind: 'goal-run',
    taskTitle: '客户要求提供 schema 说明',
  });

  assert.equal(title, '客户要求提供 schema 说明');
});
