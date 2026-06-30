import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createConsecutiveProgressDeduper,
  createInitialAgentStreamProgress,
  formatSseEvent,
  runtimeEventToStreamEvent,
  sanitizeAgentResultForFrontend,
  sanitizeAgentSessionForFrontend,
} from './agent-message-stream.mjs';

test('formatSseEvent writes a standards-compatible SSE event', () => {
  const output = formatSseEvent('progress', {
    label: '识别任务',
    status: 'complete',
  });

  assert.equal(output, 'event: progress\ndata: {"label":"识别任务","status":"complete"}\n\n');
});

test('runtimeEventToStreamEvent turns Runtime events into business progress language', () => {
  const event = runtimeEventToStreamEvent({
    phase: 'preflight',
    type: 'goal.received',
    runId: 'skill-runtime-20260629-180000-stream',
    status: 'complete',
  });

  assert.deepEqual(event, {
    event: 'progress',
    data: {
      detail: '正在理解这次外贸任务要完成什么。',
      label: '识别任务',
      phase: '识别',
      status: 'complete',
    },
  });
});

test('runtimeEventToStreamEvent exposes user-facing phase labels instead of runtime phase keys', () => {
  const event = runtimeEventToStreamEvent({
    phase: 'validating',
    runId: 'skill-runtime-20260630-120000-phase',
    status: 'complete',
    type: 'artifact.verified',
    validation: {
      evidence: {
        coverage: 'complete',
      },
    },
  });

  assert.equal(event.event, 'progress');
  assert.equal(event.data.phase, '检查');
  assert.equal(JSON.stringify(event.data).includes('validating'), false);
  assert.equal(JSON.stringify(event.data).includes('skill-runtime-20260630-120000-phase'), false);
});

test('createInitialAgentStreamProgress starts the visible loop with task recognition', () => {
  const progress = createInitialAgentStreamProgress();

  assert.deepEqual(progress, {
    detail: '正在理解这次外贸任务要完成什么。',
    label: '识别任务',
    phase: '识别',
    status: 'running',
  });
  assert.equal(JSON.stringify(progress).includes('收到任务'), false);
});

test('runtimeEventToStreamEvent hides raw internal runtime names from the frontend event', () => {
  const event = runtimeEventToStreamEvent({
    action: 'artifact.write_markdown',
    decision: 'allow',
    runId: 'skill-runtime-20260629-180500-stream',
    status: 'complete',
    type: 'policy.checked',
  });

  assert.equal(event.event, 'progress');
  assert.equal(event.data.label, '核对权限');
  assert.equal(event.data.runId, undefined);
  assert.equal(JSON.stringify(event.data).includes('artifact.write_markdown'), false);
  assert.equal(JSON.stringify(event.data).includes('policy.checked'), false);
  assert.equal(JSON.stringify(event.data).includes('skill-runtime-20260629-180500-stream'), false);
});

test('runtimeEventToStreamEvent describes skill matching as task understanding, not process configuration', () => {
  const event = runtimeEventToStreamEvent({
    status: 'complete',
    type: 'skill.matched',
  });

  assert.equal(event.event, 'progress');
  assert.equal(event.data.label, '确认任务类型');
  assert.equal(event.data.detail.includes('处理方式'), false);
  assert.equal(event.data.detail.includes('配置'), false);
});

test('runtimeEventToStreamEvent turns missing input waits into a business progress step', () => {
  const event = runtimeEventToStreamEvent({
    missing: ['客户名称或客户类型', '产品或核心卖点'],
    status: 'waiting',
    type: 'run.needs_input',
  });

  assert.deepEqual(event, {
    event: 'progress',
    data: {
      detail: '还缺: 客户名称或客户类型、产品或核心卖点。请补充后我再继续。',
      label: '等待补充',
      phase: '执行',
      status: 'waiting',
    },
  });
});

test('runtimeEventToStreamEvent surfaces business evidence checks in result verification progress', () => {
  const event = runtimeEventToStreamEvent({
    status: 'complete',
    type: 'artifact.verified',
    validation: {
      evidence: {
        coverage: 'complete',
      },
    },
  });

  assert.deepEqual(event, {
    event: 'progress',
    data: {
      detail: '已核对产物里的业务依据和用户事实覆盖。',
      label: '检查结果',
      phase: '检查',
      status: 'complete',
    },
  });
});

test('createConsecutiveProgressDeduper removes repeated progress steps in one stream', () => {
  const dedupe = createConsecutiveProgressDeduper();
  const firstPermissionCheck = runtimeEventToStreamEvent({
    action: 'artifact.write_markdown',
    decision: 'allow',
    status: 'complete',
    type: 'policy.checked',
  });
  const secondPermissionCheck = runtimeEventToStreamEvent({
    action: 'artifact.verify',
    decision: 'allow',
    status: 'complete',
    type: 'policy.checked',
  });
  const confirmationRequired = runtimeEventToStreamEvent({
    action: 'customer.memory.write',
    decision: 'ask',
    status: 'waiting',
    type: 'policy.checked',
  });

  assert.deepEqual(dedupe(firstPermissionCheck), firstPermissionCheck);
  assert.equal(dedupe(secondPermissionCheck), null);
  assert.deepEqual(dedupe(confirmationRequired), confirmationRequired);
});

test('buildRecoverableAgentErrorResult turns stream failures into a waiting task thread', async () => {
  const { buildRecoverableAgentErrorResult } = await import('./agent-message-stream.mjs');

  assert.equal(typeof buildRecoverableAgentErrorResult, 'function');

  const result = buildRecoverableAgentErrorResult({
    error: new Error('Raw runtime stack: skill-runtime-20260629 broke at action.execute'),
    sessionId: '',
    userText: '帮我生成开发信',
  });
  const publicResult = sanitizeAgentResultForFrontend(result);
  const payloadText = JSON.stringify(publicResult);

  assert.equal(publicResult.ok, true);
  assert.equal(publicResult.kind, 'needs-input');
  assert.equal(publicResult.status, 'waiting');
  assert.match(publicResult.sessionId, /^agent-session-/);
  assert.deepEqual(publicResult.progress.map((item) => item.label), ['识别任务', '处理卡住', '等待补充']);
  assert.deepEqual(publicResult.progress.map((item) => item.phase), ['识别', '执行', '执行']);
  assert.deepEqual(publicResult.messages[0].process.steps.map((item) => item.phase), ['识别', '执行', '执行']);
  assert.deepEqual(publicResult.messages[0].activity.items.map((item) => item.phase), ['识别', '执行', '执行']);
  assert.equal(publicResult.messages.length, 1);
  assert.equal(publicResult.messages[0].role, 'assistant');
  assert.match(publicResult.messages[0].content, /我这一步处理卡住了/);
  assert.match(publicResult.messages[0].content, /可以直接补充资料/);
  assert.equal(payloadText.includes('skill-runtime-20260629'), false);
  assert.equal(payloadText.includes('action.execute'), false);
  assert.equal(payloadText.includes('Raw runtime stack'), false);
});

test('sanitizeAgentResultForFrontend removes raw runtime fields from public agent payloads', () => {
  const result = sanitizeAgentResultForFrontend({
    ok: true,
    kind: 'goal-run',
    sessionId: 'agent-session-20260629T180500-stream',
    status: 'completed',
    summary: '已生成开发信草稿。',
    goal: {
      matched: true,
      skillId: 'cold-email-draft',
      skill: { displayName: '开发信草稿' },
    },
    loop: {
      status: 'completed',
      steps: [{ action: 'goal.classify', observation: 'goal.matched' }],
    },
    plan: { title: '开发信草稿执行计划' },
    skillId: 'cold-email-draft',
    runId: 'skill-runtime-20260629-180500-stream',
    mode: 'business-draft',
    evidenceLedgerPath: '/Users/garden/YD/Prototype/yingdan-agent-lab/workbench/artifacts/skill-runtime-20260629-180500-stream/evidence-ledger.json',
    progress: [{ label: '生成材料', detail: '正在生成这次任务的业务材料。', phase: '执行', status: 'complete' }],
    artifact: {
      type: 'markdown',
      name: '开发信草稿.md',
      outputPath: '/Users/garden/YD/Prototype/yingdan-agent-lab/workbench/artifacts/skill-runtime-20260629-180500-stream/cold-email-draft-skill-runtime-20260629-180500-stream.md',
      manifestPath: '/Users/garden/YD/Prototype/yingdan-agent-lab/workbench/artifacts/skill-runtime-20260629-180500-stream/manifest.json',
      evidenceLedgerPath: '/Users/garden/YD/Prototype/yingdan-agent-lab/workbench/artifacts/skill-runtime-20260629-180500-stream/evidence-ledger.json',
      validation: { mode: 'runtime', builderExitCode: 0 },
    },
    context: {
      artifact: {
        type: 'markdown',
        name: '开发信草稿.md',
        outputPath: '/Users/garden/YD/Prototype/yingdan-agent-lab/workbench/artifacts/skill-runtime-20260629-180500-stream/cold-email-draft-skill-runtime-20260629-180500-stream.md',
      },
    },
    messages: [
      {
        role: 'assistant',
        content: '已生成开发信草稿。',
        activity: {
          source: 'skill-runtime-loop',
          items: [
            {
              kind: 'action',
              title: '生成材料',
              detail: '已生成开发信草稿。',
              phase: 'validating',
              observation: 'action.executed',
              nextAction: 'artifact.verify',
              status: 'complete',
            },
          ],
        },
      },
    ],
  });

  const payloadText = JSON.stringify(result);
  assert.equal(result.taskTitle, '开发信草稿');
  assert.equal(result.goal, undefined);
  assert.equal(result.loop, undefined);
  assert.equal(result.plan, undefined);
  assert.equal(result.skillId, undefined);
  assert.equal(result.runId, undefined);
  assert.equal(result.mode, undefined);
  assert.equal(result.evidenceLedgerPath, undefined);
  assert.equal(result.progress[0].phase, '执行');
  assert.equal(result.artifact.outputPath, undefined);
  assert.equal(result.artifact.manifestPath, undefined);
  assert.equal(result.artifact.evidenceLedgerPath, undefined);
  assert.equal(result.artifact.validation, undefined);
  assert.equal(result.context.artifact.outputPath, undefined);
  assert.equal(result.messages[0].activity.source, undefined);
  assert.equal(result.messages[0].activity.items[0].title, '生成材料');
  assert.equal(result.messages[0].activity.items[0].phase, '检查');
  assert.equal(payloadText.includes('goal.classify'), false);
  assert.equal(payloadText.includes('skill-runtime-loop'), false);
  assert.equal(payloadText.includes('skill-runtime-20260629-180500-stream'), false);
  assert.equal(payloadText.includes('evidence-ledger.json'), false);
  assert.equal(payloadText.includes('action.executed'), false);
  assert.equal(payloadText.includes('artifact.verify'), false);
  assert.equal(payloadText.includes('validating'), false);
});

test('sanitizeAgentResultForFrontend translates raw runtime phase keys before publishing progress', () => {
  const result = sanitizeAgentResultForFrontend({
    ok: true,
    kind: 'goal-run',
    status: 'completed',
    progress: [
      {
        detail: '正在检查产物是否可以交付。',
        label: '检查结果',
        phase: 'validating',
        status: 'complete',
      },
    ],
  });

  assert.equal(result.progress[0].phase, '检查');
  assert.equal(JSON.stringify(result).includes('validating'), false);
});

test('sanitizeAgentResultForFrontend hides confirmation machine types from public messages', () => {
  const result = sanitizeAgentResultForFrontend({
    ok: true,
    kind: 'confirmation-required',
    sessionId: 'agent-session-20260630T010000-confirm',
    status: 'waiting',
    messages: [
      {
        role: 'assistant',
        content: '外发前需要你确认。',
        confirmation: {
          body: '这一步会把内容发给客户。',
          cancelLabel: '取消这一步',
          confirmLabel: '先生成草稿',
          title: '外发前需要你确认',
          type: 'external_send',
        },
      },
    ],
  });

  assert.deepEqual(result.messages[0].confirmation, {
    body: '这一步会把内容发给客户。',
    cancelLabel: '取消这一步',
    confirmLabel: '先生成草稿',
    title: '外发前需要你确认',
  });
  assert.equal(JSON.stringify(result).includes('external_send'), false);
});

test('sanitizeAgentResultForFrontend keeps structured missing inputs for the agent thread', () => {
  const result = sanitizeAgentResultForFrontend({
    ok: true,
    kind: 'needs-input',
    sessionId: 'agent-session-20260629T211500-needs',
    status: 'waiting',
    context: {
      pendingTask: {
        skillId: 'cold-email-draft',
        skillName: '开发信草稿',
        originalText: '帮我准备一封跟进开发信',
        missing: ['客户名称或客户类型', '产品或核心卖点', '目标市场或客户所在国家'],
        runtime: {
          checkpointPath: '/Users/garden/YD/Prototype/yingdan-agent-lab/workbench/runs/skill-runtime-abc.checkpoint.json',
          resumeFrom: 'needs-input:cold-email-draft',
          runId: 'skill-runtime-abc',
          runLogPath: '/Users/garden/YD/Prototype/yingdan-agent-lab/workbench/runs/skill-runtime-abc.jsonl',
        },
        supplements: [],
      },
    },
    messages: [
      {
        role: 'assistant',
        content: '这件事我需要更多业务资料才能继续。',
        needsInput: {
          title: '开发信草稿需要补充资料',
          items: ['客户名称或客户类型', '产品或核心卖点', '目标市场或客户所在国家'],
          hint: '直接补一句话即可，我会接着这次任务继续。',
        },
      },
    ],
  });

  assert.deepEqual(result.context.pendingTask, {
    skillName: '开发信草稿',
    originalText: '帮我准备一封跟进开发信',
    missing: ['客户名称或客户类型', '产品或核心卖点', '目标市场或客户所在国家'],
  });
  assert.deepEqual(result.messages[0].needsInput, {
    title: '开发信草稿需要补充资料',
    items: ['客户名称或客户类型', '产品或核心卖点', '目标市场或客户所在国家'],
    hint: '直接补一句话即可，我会接着这次任务继续。',
  });
  assert.equal(JSON.stringify(result).includes('cold-email-draft'), false);
  assert.equal(JSON.stringify(result).includes('skill-runtime-abc'), false);
  assert.equal(JSON.stringify(result).includes('/Users/garden'), false);
});

test('sanitizeAgentResultForFrontend hides customer memory filesystem paths', () => {
  const result = sanitizeAgentResultForFrontend({
    ok: true,
    kind: 'confirmation-accepted',
    sessionId: 'agent-session-20260630T140000-save',
    status: 'completed',
    context: {
      customerSlug: 'global-sourcing-inc',
      lastCustomerSave: {
        customerSlug: 'global-sourcing-inc',
        diaryPath: '/Users/garden/YD/Prototype/yingdan-agent-lab/workbench/customers/global-sourcing-inc/diary/agent-saves.jsonl',
        memoryPath: '/Users/garden/YD/Prototype/yingdan-agent-lab/workbench/customers/global-sourcing-inc/memory.md',
        savedSummary: '客户推进分析',
      },
    },
  });

  assert.deepEqual(result.context.lastCustomerSave, {
    customerSlug: 'global-sourcing-inc',
    savedSummary: '客户推进分析',
  });
  assert.equal(JSON.stringify(result).includes('/Users/garden'), false);
  assert.equal(JSON.stringify(result).includes('memory.md'), false);
  assert.equal(JSON.stringify(result).includes('agent-saves.jsonl'), false);
});

test('sanitizeAgentResultForFrontend does not expose internal resumed user text in immediate results', () => {
  const result = sanitizeAgentResultForFrontend({
    ok: true,
    kind: 'confirmation-required',
    sessionId: 'agent-session-20260630T120000-post-artifact-confirm',
    status: 'waiting',
    messages: [
      {
        role: 'user',
        content: '产出类型: 询盘回复草稿；补充资料: 客户问MOQ和交期，帮我回一下；补充资料: 产品太阳能路灯，保存一下',
      },
      {
        role: 'assistant',
        content: '我已经理解这次任务，会按「询盘回复草稿」的方式推进。 产物：询盘回复草稿.md。\n保存前需要你确认。',
        confirmation: {
          body: '这一步会影响客户档案或历史跟进。',
          cancelLabel: '取消这一步',
          confirmLabel: '确认写入',
          title: '写入客户档案前需要确认',
          type: 'customer_write',
        },
      },
    ],
  });

  assert.equal(result.messages.length, 1);
  assert.equal(result.messages[0].role, 'assistant');
  assert.match(result.messages[0].content, /保存前需要你确认/);
  assert.equal(JSON.stringify(result).includes('产出类型'), false);
  assert.equal(JSON.stringify(result).includes('补充资料'), false);
  assert.equal(JSON.stringify(result).includes('customer_write'), false);
});

test('sanitizeAgentResultForFrontend removes terminal placeholder next actions from activity', () => {
  const result = sanitizeAgentResultForFrontend({
    ok: true,
    kind: 'goal-run',
    sessionId: 'agent-session-20260629T190500-terminal',
    status: 'completed',
    summary: '这次任务已完成。',
    messages: [
      {
        role: 'assistant',
        content: '这次任务已完成。',
        activity: {
          items: [
            {
              detail: '这次任务已处理到当前可交付状态。',
              kind: 'observation',
              nextAction: 'none',
              observation: '这次任务已完成',
              status: 'complete',
              title: '完成',
            },
          ],
        },
      },
    ],
  });

  assert.equal(result.messages[0].activity.items[0].title, '完成');
  assert.equal(result.messages[0].activity.items[0].nextAction, undefined);
  assert.equal(JSON.stringify(result).includes('none'), false);
});

test('sanitizeAgentSessionForFrontend removes raw session internals before restore payloads reach the UI', () => {
  const session = sanitizeAgentSessionForFrontend({
    sessionId: 'agent-session-20260629T181000-restore',
    status: 'completed',
    kind: 'goal-run',
    taskTitle: '开发信草稿',
    context: {
      artifact: {
        type: 'markdown',
        name: '开发信草稿.md',
        outputPath: '/Users/garden/YD/Prototype/yingdan-agent-lab/workbench/artifacts/skill-runtime-20260629-181000-restore/cold-email-draft-skill-runtime-20260629-181000-restore.md',
      },
      pendingConfirmation: {
        type: 'export_file',
        runtime: { runId: 'skill-runtime-20260629-181000-restore' },
      },
    },
    messages: [
      {
        role: 'assistant',
        content: '已生成开发信草稿。',
        activity: {
          source: 'skill-runtime-loop',
          items: [
            {
              kind: 'action',
              title: '生成材料',
              detail: '已生成开发信草稿。',
              observation: 'action.executed',
              nextAction: 'artifact.verify',
              status: 'complete',
            },
          ],
        },
      },
    ],
    skillAgentResult: {
      artifact: {
        type: 'markdown',
        name: '开发信草稿.md',
        outputPath: '/Users/garden/YD/Prototype/yingdan-agent-lab/workbench/artifacts/skill-runtime-20260629-181000-restore/cold-email-draft-skill-runtime-20260629-181000-restore.md',
      },
      goal: { skillId: 'cold-email-draft' },
      loop: { steps: [{ action: 'goal.classify' }] },
      mode: 'business-draft',
      plan: { title: '开发信草稿执行计划' },
      runId: 'skill-runtime-20260629-181000-restore',
      skillId: 'cold-email-draft',
      status: 'completed',
      summary: '产物：开发信草稿.md。',
      taskTitle: '开发信草稿',
    },
  });

  const payloadText = JSON.stringify(session);
  assert.equal(session.taskTitle, '开发信草稿');
  assert.equal(session.context.artifact.outputPath, undefined);
  assert.equal(session.context.pendingConfirmation, undefined);
  assert.equal(session.skillAgentResult.taskTitle, '开发信草稿');
  assert.equal(session.skillAgentResult.runId, undefined);
  assert.equal(session.skillAgentResult.skillId, undefined);
  assert.equal(session.skillAgentResult.loop, undefined);
  assert.equal(session.messages[0].activity.source, undefined);
  assert.equal(payloadText.includes('skill-runtime-20260629-181000-restore'), false);
  assert.equal(payloadText.includes('goal.classify'), false);
  assert.equal(payloadText.includes('action.executed'), false);
  assert.equal(payloadText.includes('artifact.verify'), false);
});
