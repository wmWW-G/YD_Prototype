import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createRuntime, loadEnvFile } from './runtime.mjs';

async function withRuntime(options = {}) {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-runtime-'));
  const runtime = createRuntime({
    env: options.env || {},
    modelClient: options.modelClient,
    projectRoot,
  });

  await runtime.ensureWorkbench();

  return {
    projectRoot,
    runtime,
    async cleanup() {
      await rm(projectRoot, { recursive: true, force: true });
    },
  };
}

async function readJsonl(filePath) {
  const content = await readFile(filePath, 'utf8');
  return content
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test('analyzeInquiry returns MODEL_NOT_CONFIGURED without a DeepSeek key and does not fake results', async () => {
  const fixture = await withRuntime();

  try {
    const result = await fixture.runtime.analyzeInquiry({
      customerSlug: 'global-sourcing-inc',
      inquiryText: 'Please quote 50,000 pcs 500ml stainless steel bottles.',
      mode: 'fast',
    });

    assert.equal(result.ok, false);
    assert.equal(result.error, 'MODEL_NOT_CONFIGURED');
    assert.equal(result.demo, false);
    assert.equal(result.result, undefined);

    const runs = await readdir(path.join(fixture.projectRoot, 'workbench', 'runs'));
    assert.deepEqual(runs, []);
  } finally {
    await fixture.cleanup();
  }
});

test('analyzeInquiry uses customer memory, flash mode, policy, checkpoint, run log, and artifact', async () => {
  const modelCalls = [];
  const fixture = await withRuntime({
    env: { DEEPSEEK_API_KEY: 'test-key' },
    modelClient: async (request) => {
      modelCalls.push(request);

      const joinedMessages = request.messages.map((message) => message.content).join('\n');
      assert.match(joinedMessages, /Global Sourcing Inc\./);
      assert.match(joinedMessages, /United States/);
      assert.match(joinedMessages, /上次报价 \$2\.40/);

      if (request.purpose === 'analyze_inquiry') {
        return {
          content: JSON.stringify({
            intention: {
              level: '中高意向',
              score: 78,
              evidence: '因为客户提供了 50,000 pcs 数量、FOB Shanghai 条款和 Logo printing 定制需求。',
            },
            missingInfo: ['目标单价区间', '预期交期', 'Logo 文件', '包装方式', '是否需要样品'],
            risks: ['客户可能仍在比价，需要用上次报价 $2.40 的历史做锚点。'],
          }),
        };
      }

      if (request.purpose === 'draft_reply') {
        return {
          content: JSON.stringify({
            replyDraft:
              'Hi,\n\nThanks for your inquiry. Based on our previous quote of $2.40 and your 50,000 pcs requirement, we can support 500ml stainless steel bottles with logo printing. Could you please share your target price, delivery time, logo artwork, packaging requirement, and whether samples are needed?\n\nBest regards,',
          }),
        };
      }

      return {
        content: JSON.stringify({
          nextSteps: [
            '发送澄清问题并引用上次报价 $2.40',
            '客户回复后更新包装和交期信息',
            '准备正式报价单和样品方案',
          ],
        }),
      };
    },
  });

  try {
    const result = await fixture.runtime.analyzeInquiry({
      customerSlug: 'global-sourcing-inc',
      inquiryText:
        'Hi, we are looking for 50,000 pcs of 500ml stainless steel water bottles. Please share price for FOB Shanghai, lead time, and MOQ. Logo printing needed.',
      mode: 'fast',
    });

    assert.equal(result.ok, true);
    assert.equal(result.status, 'waiting');
    assert.match(result.runId, /^run-\d{8}-\d{6}-[a-z0-9]{4}$/);
    assert.equal(result.progress.length, 4);
    assert.equal(result.result.intention.level, '中高意向');
    assert.equal(result.result.missingInfo.length, 5);
    assert.equal(result.result.risks.length, 1);
    assert.match(result.result.replyDraft, /^Hi,/);
    assert.equal(result.result.nextSteps.length, 3);
    assert.equal(modelCalls.length, 3);
    assert.deepEqual(modelCalls.map((call) => call.model), [
      'deepseek-v4-flash',
      'deepseek-v4-flash',
      'deepseek-v4-flash',
    ]);

    const runDir = path.join(fixture.projectRoot, 'workbench');
    const runLogPath = path.join(runDir, 'runs', `${result.runId}.jsonl`);
    const checkpointPath = path.join(runDir, 'runs', `${result.runId}.checkpoint.json`);
    const artifactPath = path.join(runDir, 'artifacts', result.runId, 'reply-draft.md');

    const logEvents = await readJsonl(runLogPath);
    assert.deepEqual(
      logEvents.map((event) => event.type),
      [
        'run.started',
        'context.loaded',
        'runtime.tick',
        'model.called',
        'runtime.tick',
        'model.called',
        'artifact.written',
        'runtime.tick',
        'model.called',
        'policy.checked',
        'run.checkpointed',
        'run.waiting',
      ],
    );

    const checkpoint = JSON.parse(await readFile(checkpointPath, 'utf8'));
    assert.equal(checkpoint.status, 'waiting');
    assert.equal(checkpoint.resume_from, 'customer.write_memory');

    const artifact = await readFile(artifactPath, 'utf8');
    assert.match(artifact, /previous quote of \$2\.40/);
  } finally {
    await fixture.cleanup();
  }
});

test('confirmRun resumes from checkpoint, appends customer memory, and completes the run', async () => {
  const fixture = await withRuntime({
    env: { DEEPSEEK_API_KEY: 'test-key' },
    modelClient: async (request) => {
      if (request.purpose === 'analyze_inquiry') {
        return {
          content: JSON.stringify({
            intention: { level: '高意向', score: 86, evidence: '因为客户明确给出数量和 FOB 条款。' },
            missingInfo: ['目标单价区间'],
            risks: ['需要确认交期'],
          }),
        };
      }

      if (request.purpose === 'draft_reply') {
        return { content: JSON.stringify({ replyDraft: 'Hi,\n\nThanks for your inquiry.\n\nBest regards,' }) };
      }

      return { content: JSON.stringify({ nextSteps: ['确认交期', '准备报价'] }) };
    },
  });

  try {
    const analysis = await fixture.runtime.analyzeInquiry({
      customerSlug: 'global-sourcing-inc',
      inquiryText: 'Please quote 50,000 pcs.',
      mode: 'fast',
    });
    const memoryPath = path.join(fixture.projectRoot, 'workbench', 'customers', 'global-sourcing-inc', 'memory.md');
    const beforeMemory = await readFile(memoryPath, 'utf8');

    const confirmed = await fixture.runtime.confirmRun({ runId: analysis.runId });

    assert.equal(confirmed.ok, true);
    assert.equal(confirmed.status, 'completed');

    const afterMemory = await readFile(memoryPath, 'utf8');
    assert.ok(afterMemory.length > beforeMemory.length);
    assert.match(afterMemory, /高意向/);
    assert.match(afterMemory, /确认交期/);

    const logEvents = await readJsonl(path.join(fixture.projectRoot, 'workbench', 'runs', `${analysis.runId}.jsonl`));
    assert.ok(logEvents.some((event) => event.type === 'run.resumed'));
    assert.ok(logEvents.some((event) => event.type === 'memory.updated'));
    assert.equal(logEvents.at(-1).type, 'run.completed');
  } finally {
    await fixture.cleanup();
  }
});

test('checkPolicy denies outbound email actions and records the policy decision', async () => {
  const fixture = await withRuntime({ env: { DEEPSEEK_API_KEY: 'test-key' } });

  try {
    const runId = await fixture.runtime.createRunForTest();
    const decision = await fixture.runtime.checkPolicy('message.send_email', { runId });

    assert.equal(decision.decision, 'deny');
    assert.match(decision.why, /禁止自动外发邮件/);

    const logEvents = await readJsonl(path.join(fixture.projectRoot, 'workbench', 'runs', `${runId}.jsonl`));
    assert.equal(logEvents.at(-1).type, 'policy.checked');
    assert.equal(logEvents.at(-1).decision, 'deny');
    assert.equal(logEvents.at(-1).action, 'message.send_email');
  } finally {
    await fixture.cleanup();
  }
});

test('checkPolicy allows alibaba inquiry meeting read-only and XLSX artifact actions', async () => {
  const fixture = await withRuntime({ env: { DEEPSEEK_API_KEY: 'test-key' } });

  try {
    const runId = await fixture.runtime.createRunForTest();
    const decisions = await Promise.all([
      fixture.runtime.checkPolicy('skill.read_external_package', { runId }),
      fixture.runtime.checkPolicy('alibaba.read_only_tool', { runId }),
      fixture.runtime.checkPolicy('artifact.write_xlsx', { runId }),
      fixture.runtime.checkPolicy('artifact.validate_xlsx', { runId }),
      fixture.runtime.checkPolicy('alibaba.send_message', { runId }),
    ]);

    assert.deepEqual(
      decisions.map((decision) => decision.decision),
      ['allow', 'allow', 'allow', 'allow', 'deny'],
    );

    const logEvents = await readJsonl(path.join(fixture.projectRoot, 'workbench', 'runs', `${runId}.jsonl`));
    assert.equal(logEvents.filter((event) => event.type === 'policy.checked').length, 5);
    const deniedSendMessage = logEvents.find((event) => event.action === 'alibaba.send_message');
    assert.equal(deniedSendMessage?.decision, 'deny');
  } finally {
    await fixture.cleanup();
  }
});

test('loadEnvFile treats a bare DeepSeek key line as DEEPSEEK_API_KEY', async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-env-'));
  const envPath = path.join(projectRoot, '.env');

  try {
    await import('node:fs/promises').then((fs) => fs.writeFile(envPath, 'sk-test-bare-key\n', 'utf8'));
    const env = await loadEnvFile(envPath);

    assert.equal(env.DEEPSEEK_API_KEY, 'sk-test-bare-key');
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});
