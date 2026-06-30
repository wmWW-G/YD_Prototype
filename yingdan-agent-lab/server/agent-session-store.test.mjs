import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createAgentSessionStore } from './agent-session-store.mjs';

async function withSessionStore() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-agent-session-'));
  return {
    projectRoot,
    store: createAgentSessionStore({ projectRoot }),
    async cleanup() {
      await rm(projectRoot, { recursive: true, force: true });
    },
  };
}

test('agent session store persists pending confirmation context for backend resume', async () => {
  const fixture = await withSessionStore();

  try {
    const sessionId = 'agent-session-20260629T120000-test';
    await fixture.store.saveTurn({
      sessionId,
      userText: '帮我把这封开发信发给客户',
      response: {
        ok: true,
        kind: 'confirmation-required',
        sessionId,
        status: 'waiting',
        context: {
          pendingConfirmation: {
            type: 'external_send',
            title: '外发前需要你确认',
            originalText: '帮我把这封开发信发给客户',
          },
        },
        messages: [
          {
            id: 'assistant-confirm',
            role: 'assistant',
            content: '我先停一下,这一步需要你确认后再继续。',
            createdAt: '2026-06-29T12:00:00.000Z',
          },
        ],
      },
    });

    const session = await fixture.store.read(sessionId);

    assert.equal(session.sessionId, sessionId);
    assert.equal(session.status, 'waiting');
    assert.equal(session.context.pendingConfirmation.type, 'external_send');
    assert.equal(session.messages.length, 2);
    assert.equal(session.messages[0].role, 'user');
    assert.equal(session.messages[1].role, 'assistant');
  } finally {
    await fixture.cleanup();
  }
});

test('agent session store preserves prior context when follow-up response has no new context', async () => {
  const fixture = await withSessionStore();

  try {
    const sessionId = 'agent-session-20260629T120500-follow';
    await fixture.store.saveTurn({
      sessionId,
      userText: '帮我分析这个客户下一步怎么推进',
      response: {
        ok: true,
        kind: 'needs-input',
        sessionId,
        status: 'waiting',
        context: {
          pendingTask: {
            originalText: '帮我分析这个客户下一步怎么推进',
          },
        },
        messages: [
          {
            id: 'assistant-needs-input',
            role: 'assistant',
            content: '我需要更多业务资料才能继续。',
            createdAt: '2026-06-29T12:05:00.000Z',
          },
        ],
      },
    });

    await fixture.store.saveTurn({
      sessionId,
      userText: '再补一句',
      requestContext: {
        pendingTask: {
          originalText: '帮我分析这个客户下一步怎么推进',
        },
      },
      response: {
        ok: true,
        kind: 'followup',
        sessionId,
        status: 'completed',
        messages: [
          {
            id: 'assistant-followup',
            role: 'assistant',
            content: '我会接着这次任务处理。',
            createdAt: '2026-06-29T12:06:00.000Z',
          },
        ],
      },
    });

    const session = await fixture.store.read(sessionId);

    assert.equal(session.context.pendingTask.originalText, '帮我分析这个客户下一步怎么推进');
    assert.equal(session.messages.length, 4);
    assert.equal(session.messages[2].content, '再补一句');
  } finally {
    await fixture.cleanup();
  }
});

test('agent session store writes a readable JSON file with the latest artifact summary', async () => {
  const fixture = await withSessionStore();

  try {
    const sessionId = 'agent-session-20260629T121000-artifact';
    await fixture.store.saveTurn({
      sessionId,
      userText: '写个 follow up',
      response: {
        ok: true,
        kind: 'goal-run',
        sessionId,
        status: 'completed',
        summary: '产物：开发信草稿.md。',
        taskTitle: '开发信草稿',
        artifact: {
          type: 'markdown',
          name: '开发信草稿.md',
          outputPath: '/tmp/开发信草稿.md',
        },
        messages: [
          {
            id: 'assistant-artifact',
            role: 'assistant',
            content: '已生成开发信草稿。',
            createdAt: '2026-06-29T12:10:00.000Z',
            artifact: {
              type: 'markdown',
              name: '开发信草稿.md',
              outputPath: '/tmp/开发信草稿.md',
            },
          },
        ],
      },
    });

    const filePath = path.join(fixture.projectRoot, 'workbench', 'agent-sessions', `${sessionId}.json`);
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);

    assert.equal(parsed.artifact.name, '开发信草稿.md');
    assert.equal(parsed.skillAgentResult.artifact.name, '开发信草稿.md');
    assert.equal(parsed.taskTitle, '开发信草稿');
    assert.equal(parsed.skillAgentResult.taskTitle, '开发信草稿');
    assert.equal(parsed.summary, '产物：开发信草稿.md。');
  } finally {
    await fixture.cleanup();
  }
});

test('agent session store keeps business task title after a confirmation is accepted', async () => {
  const fixture = await withSessionStore();

  try {
    const sessionId = 'agent-session-20260629T121200-title-confirm';
    const artifact = {
      type: 'markdown',
      name: '客户推进分析.md',
      outputPath: '/tmp/客户推进分析.md',
    };

    await fixture.store.saveTurn({
      sessionId,
      userText: '客户已读不回，产品是家具，帮我做一个7天跟进计划',
      response: {
        ok: true,
        kind: 'goal-run',
        sessionId,
        status: 'completed',
        taskTitle: '客户推进分析',
        artifact,
        messages: [
          {
            id: 'assistant-followup-plan',
            role: 'assistant',
            content: '已生成客户推进分析。',
            createdAt: '2026-06-29T12:12:00.000Z',
            artifact,
          },
        ],
      },
    });

    await fixture.store.saveTurn({
      sessionId,
      userText: '保存到客户档案',
      response: {
        ok: true,
        kind: 'confirmation-required',
        sessionId,
        status: 'waiting',
        taskTitle: '写入客户档案前需要确认',
        context: {
          artifact,
          pendingConfirmation: {
            title: '写入客户档案前需要确认',
            type: 'customer_write',
          },
        },
        messages: [
          {
            id: 'assistant-save-confirm',
            role: 'assistant',
            content: '写入客户档案前需要确认。',
            createdAt: '2026-06-29T12:13:00.000Z',
          },
        ],
      },
    });

    await fixture.store.saveTurn({
      sessionId,
      userText: '确认写入',
      response: {
        ok: true,
        kind: 'confirmation-accepted',
        sessionId,
        status: 'completed',
        context: {
          artifact,
          customerSlug: 'global-sourcing-inc',
          lastCustomerSave: {
            customerSlug: 'global-sourcing-inc',
            savedSummary: '客户推进分析',
          },
        },
        messages: [
          {
            id: 'assistant-save-done',
            role: 'assistant',
            content: '已确认保存。',
            createdAt: '2026-06-29T12:14:00.000Z',
          },
        ],
      },
    });

    const session = await fixture.store.read(sessionId);

    assert.equal(session.taskTitle, '客户推进分析');
    assert.equal(session.skillAgentResult.taskTitle, '客户推进分析');
    assert.equal(session.context.lastCustomerSave.savedSummary, '客户推进分析');
  } finally {
    await fixture.cleanup();
  }
});

test('agent session store ignores stale pending confirmation after a completed confirmation turn', async () => {
  const fixture = await withSessionStore();

  try {
    const sessionId = 'agent-session-20260629T121500-stale';
    await fixture.store.saveTurn({
      sessionId,
      userText: '保存到客户档案',
      response: {
        ok: true,
        kind: 'confirmation-required',
        sessionId,
        status: 'waiting',
        context: {
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: '/tmp/客户推进分析.md',
          },
          pendingConfirmation: {
            type: 'customer_write',
            title: '写入客户档案前需要确认',
          },
        },
        messages: [
          {
            id: 'assistant-confirm-stale',
            role: 'assistant',
            content: '我先停一下。',
            createdAt: '2026-06-29T12:15:00.000Z',
          },
        ],
      },
    });

    await fixture.store.saveTurn({
      sessionId,
      userText: '确认写入',
      response: {
        ok: true,
        kind: 'confirmation-accepted',
        sessionId,
        status: 'completed',
        context: {
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: '/tmp/客户推进分析.md',
          },
          pendingConfirmation: {
            type: 'customer_write',
            title: '写入客户档案前需要确认',
          },
          lastCustomerSave: {
            savedSummary: '客户推进分析',
          },
        },
        messages: [
          {
            id: 'assistant-confirmed-stale',
            role: 'assistant',
            content: '已确认保存。',
            createdAt: '2026-06-29T12:16:00.000Z',
          },
        ],
      },
    });

    const session = await fixture.store.read(sessionId);

    assert.equal(Object.hasOwn(session.context, 'pendingConfirmation'), false);
    assert.equal(session.context.artifact.name, '客户推进分析.md');
    assert.equal(session.context.lastCustomerSave.savedSummary, '客户推进分析');
  } finally {
    await fixture.cleanup();
  }
});
