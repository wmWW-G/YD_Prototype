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
