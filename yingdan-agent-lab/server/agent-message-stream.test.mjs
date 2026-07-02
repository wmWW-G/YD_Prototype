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

test('runtimeEventToStreamEvent turns typed evaluator failures into a check-result progress step', () => {
  const event = runtimeEventToStreamEvent({
    phase: 'validating',
    status: 'failed',
    type: 'artifact.typed_evaluated',
    reasons: ['XLSX 文件未通过存在性校验', 'evidence ledger 缺少分区:coverage'],
    checks: {
      hasManifestPath: false,
    },
    runId: 'skill-runtime-20260630-typed-failure',
  });

  assert.deepEqual(event, {
    event: 'progress',
    data: {
      detail: '检查结果没有通过,我已先停下,避免交付可能误导的材料。',
      label: '检查结果',
      phase: '检查',
      status: 'error',
    },
  });
  assert.equal(JSON.stringify(event).includes('artifact.typed_evaluated'), false);
  assert.equal(JSON.stringify(event).includes('skill-runtime-20260630-typed-failure'), false);
  assert.equal(JSON.stringify(event).includes('evidence ledger'), false);
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

test('createInitialAgentStreamProgress starts needs-input resumes with continue execution', () => {
  const progress = createInitialAgentStreamProgress({
    context: {
      pendingTask: {
        runtime: {
          resumeFrom: 'needs-input:inquiry-reply-draft',
          runId: 'skill-runtime-20260630-needs-input-resume',
        },
      },
    },
  });
  const payloadText = JSON.stringify(progress);

  assert.deepEqual(progress, {
    detail: '正在接着刚才暂停的外贸任务继续处理。',
    label: '继续执行',
    phase: '执行',
    status: 'running',
  });
  assert.equal(payloadText.includes('识别任务'), false);
  assert.equal(payloadText.includes('needs-input'), false);
  assert.equal(payloadText.includes('skill-runtime-20260630-needs-input-resume'), false);
});

test('createInitialAgentStreamProgress starts confirmation resumes with continue execution', () => {
  const progress = createInitialAgentStreamProgress({
    context: {
      pendingConfirmation: {
        runtime: {
          resumeFrom: 'policy:artifact.export_file',
          runId: 'skill-runtime-20260630-confirm-resume',
        },
      },
    },
  });

  assert.equal(progress.label, '继续执行');
  assert.equal(progress.phase, '执行');
  assert.equal(JSON.stringify(progress).includes('policy:'), false);
  assert.equal(JSON.stringify(progress).includes('skill-runtime-20260630-confirm-resume'), false);
});

test('createInitialAgentStreamProgress treats explicit restarts as a fresh task despite pending context', () => {
  const progress = createInitialAgentStreamProgress({
    context: {
      pendingTask: {
        runtime: {
          resumeFrom: 'needs-input:customer-followup-plan',
          runId: 'skill-runtime-old-pending-task',
        },
      },
    },
    text: '重新开始，客户问价格太高，产品是家具，帮我分析怎么推进',
  });
  const payloadText = JSON.stringify(progress);

  assert.equal(progress.label, '识别任务');
  assert.equal(progress.phase, '识别');
  assert.equal(payloadText.includes('继续执行'), false);
  assert.equal(payloadText.includes('skill-runtime-old-pending-task'), false);
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

test('buildRecoverableAgentErrorResult keeps resume failures in continue-execution language', async () => {
  const { buildRecoverableAgentErrorResult } = await import('./agent-message-stream.mjs');

  const result = buildRecoverableAgentErrorResult({
    error: new Error('Raw runtime stack: skill-runtime-resume failed at action.execute'),
    sessionId: 'agent-session-resume-failure',
    userText: '产品太阳能路灯',
    context: {
      pendingTask: {
        runtime: {
          resumeFrom: 'needs-input:inquiry-reply-draft',
          runId: 'skill-runtime-resume-failure',
        },
      },
    },
  });
  const publicResult = sanitizeAgentResultForFrontend(result);
  const payloadText = JSON.stringify(publicResult);

  assert.deepEqual(publicResult.progress.map((item) => item.label), ['继续执行', '处理卡住', '等待补充']);
  assert.deepEqual(publicResult.messages[0].process.steps.map((item) => item.label), ['继续执行', '处理卡住', '等待补充']);
  assert.deepEqual(publicResult.messages[0].activity.items.map((item) => item.title), ['继续执行', '处理卡住', '等待补充']);
  assert.equal(payloadText.includes('识别任务'), false);
  assert.equal(payloadText.includes('needs-input:'), false);
  assert.equal(payloadText.includes('inquiry-reply-draft'), false);
  assert.equal(payloadText.includes('skill-runtime-resume-failure'), false);
  assert.equal(payloadText.includes('action.execute'), false);
});

test('buildRecoverableAgentErrorResult preserves pending runtime checkpoint after resume failures', async () => {
  const { buildRecoverableAgentErrorResult } = await import('./agent-message-stream.mjs');

  const result = buildRecoverableAgentErrorResult({
    error: new Error('Raw runtime stack: resume failed after user supplement'),
    sessionId: 'agent-session-resume-checkpoint-preserved',
    userText: '产品太阳能路灯',
    context: {
      pendingTask: {
        missing: ['产品资料或报价边界'],
        originalText: '客户问MOQ和交期，帮我回一下',
        runtime: {
          checkpointPath: '/tmp/runtime.checkpoint.json',
          resumeFrom: 'needs-input:inquiry-reply-draft',
          runId: 'skill-runtime-resume-checkpoint',
        },
        skillId: 'inquiry-reply-draft',
        skillName: '询盘回复草稿',
        supplements: ['客户是德国采购商'],
      },
    },
  });
  const publicResult = sanitizeAgentResultForFrontend(result);
  const publicText = JSON.stringify(publicResult);

  assert.equal(result.context.pendingTask.originalText, '客户问MOQ和交期，帮我回一下');
  assert.equal(result.context.pendingTask.runtime.runId, 'skill-runtime-resume-checkpoint');
  assert.equal(result.context.pendingTask.runtime.resumeFrom, 'needs-input:inquiry-reply-draft');
  assert.deepEqual(result.context.pendingTask.supplements, ['客户是德国采购商', '产品太阳能路灯']);
  assert.equal(result.context.pendingTask.lastSupplement, '产品太阳能路灯');
  assert.deepEqual(publicResult.context.pendingTask.missing, ['更多业务资料或更明确的产物要求']);
  assert.equal(publicText.includes('skill-runtime-resume-checkpoint'), false);
  assert.equal(publicText.includes('needs-input:inquiry-reply-draft'), false);
  assert.equal(publicText.includes('/tmp/runtime.checkpoint.json'), false);
});

test('buildRecoverableAgentErrorResult treats explicit restart failures as fresh task failures', async () => {
  const { buildRecoverableAgentErrorResult } = await import('./agent-message-stream.mjs');

  const result = buildRecoverableAgentErrorResult({
    context: {
      pendingTask: {
        runtime: {
          resumeFrom: 'needs-input:customer-followup-plan',
          runId: 'skill-runtime-old-pending-task',
        },
      },
    },
    error: new Error('Raw runtime stack: fresh task failed'),
    sessionId: 'agent-session-restart-failure',
    userText: '重新开始，客户问价格太高，产品是家具，帮我分析怎么推进',
  });
  const publicResult = sanitizeAgentResultForFrontend(result);

  assert.deepEqual(publicResult.progress.map((item) => item.label), ['识别任务', '处理卡住', '等待补充']);
  assert.equal(publicResult.messages[0].process.steps.some((item) => item.label === '继续执行'), false);
  assert.equal(publicResult.messages[0].activity.items.some((item) => item.title === '继续执行'), false);
  assert.equal(JSON.stringify(publicResult).includes('skill-runtime-old-pending-task'), false);
});

test('buildRecoverableAgentErrorResult explains typed evaluator failures as a check-result pause', async () => {
  const { buildRecoverableAgentErrorResult } = await import('./agent-message-stream.mjs');

  const result = buildRecoverableAgentErrorResult({
    error: new Error('typed evaluator rejected alibaba-inquiry-meeting artifact: XLSX 文件未通过存在性校验; evidence ledger 缺少分区:coverage'),
    sessionId: 'agent-session-typed-evaluator',
    userText: '帮我开上周询盘分析会',
  });
  const publicResult = sanitizeAgentResultForFrontend(result);
  const payloadText = JSON.stringify(publicResult);

  assert.equal(publicResult.ok, true);
  assert.equal(publicResult.kind, 'needs-input');
  assert.equal(publicResult.status, 'waiting');
  assert.equal(publicResult.taskTitle, '检查结果需要处理');
  assert.deepEqual(publicResult.progress.map((item) => item.label), ['识别任务', '检查结果', '等待补充']);
  assert.deepEqual(publicResult.progress.map((item) => item.phase), ['识别', '检查', '检查']);
  assert.match(publicResult.messages[0].content, /检查结果没有通过/);
  assert.match(publicResult.messages[0].content, /没有继续交付/);
  assert.equal(payloadText.includes('typed evaluator'), false);
  assert.equal(payloadText.includes('alibaba-inquiry-meeting'), false);
  assert.equal(payloadText.includes('evidence ledger'), false);
});

test('buildRecoverableAgentErrorResult explains Alibaba tool connection failures as data-source waiting', async () => {
  const { buildRecoverableAgentErrorResult } = await import('./agent-message-stream.mjs');

  const error = Object.assign(
    new Error('No required Alibaba read-only tool succeeded; refusing to mark this as real-bridge acceptance.'),
    { code: 'NO_REQUIRED_ALIBABA_TOOL_SUCCEEDED' },
  );
  const result = buildRecoverableAgentErrorResult({
    error,
    sessionId: 'agent-session-alibaba-tool-wait',
    userText: '帮我开上周询盘分析会',
  });
  const publicResult = sanitizeAgentResultForFrontend(result);
  const payloadText = JSON.stringify(publicResult);

  assert.equal(publicResult.ok, true);
  assert.equal(publicResult.kind, 'needs-input');
  assert.equal(publicResult.status, 'waiting');
  assert.equal(publicResult.taskTitle, '需要连接 Alibaba 数据源');
  assert.deepEqual(publicResult.progress.map((item) => item.label), ['识别任务', '连接数据源', '等待处理']);
  assert.deepEqual(publicResult.progress.map((item) => item.phase), ['识别', '执行', '执行']);
  assert.match(publicResult.messages[0].content, /真实数据源暂时没有返回可用结果/);
  assert.match(publicResult.messages[0].content, /Alibaba bridge 已启动/);
  assert.match(publicResult.messages[0].content, /我已处理,继续/);
  assert.doesNotMatch(publicResult.messages[0].content, /更多业务资料/);
  assert.deepEqual(publicResult.context.pendingTask.missing, ['启动 Alibaba bridge', '确认账号已登录', '确认只读工具有数据权限']);
  assert.equal(payloadText.includes('NO_REQUIRED_ALIBABA_TOOL_SUCCEEDED'), false);
  assert.equal(payloadText.includes('read-only tool succeeded'), false);
  assert.equal(payloadText.includes('skill-runtime'), false);
});

test('buildRecoverableAgentErrorResult does not treat incidental typed evaluator mentions as check failures', async () => {
  const { buildRecoverableAgentErrorResult } = await import('./agent-message-stream.mjs');

  const result = buildRecoverableAgentErrorResult({
    error: new Error('stream parser failed while reading artifact.typed_evaluated event'),
    sessionId: 'agent-session-incidental-typed-event',
    userText: '帮我开上周询盘分析会',
  });
  const publicResult = sanitizeAgentResultForFrontend(result);

  assert.equal(publicResult.taskTitle, '本次外贸任务');
  assert.deepEqual(publicResult.progress.map((item) => item.label), ['识别任务', '处理卡住', '等待补充']);
  assert.match(publicResult.messages[0].content, /我这一步处理卡住了/);
  assert.doesNotMatch(publicResult.messages[0].content, /检查结果没有通过/);
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
    cancelActionText: '取消这一步',
    confirmLabel: '先生成草稿',
    confirmActionText: '先生成草稿',
    title: '外发前需要你确认',
  });
  assert.equal(JSON.stringify(result).includes('external_send'), false);
});

test('sanitizeAgentResultForFrontend keeps safe confirmation action text without exposing type', () => {
  const result = sanitizeAgentResultForFrontend({
    ok: true,
    kind: 'confirmation-required',
    sessionId: 'agent-session-20260630T010100-confirm',
    status: 'waiting',
    messages: [
      {
        role: 'assistant',
        content: '导出文件前需要你确认。',
        confirmation: {
          body: 'checkpointPath=/Users/garden/workbench/runs/run.checkpoint.json',
          cancelLabel: '取消 outputPath workbench/exports/file.xlsx',
          confirmLabel: 'tool_call artifact.export_file',
          title: 'policy.checked artifact.export_file run_id=skill-runtime-raw',
          type: 'export_file',
        },
      },
    ],
  });

  const confirmation = result.messages[0].confirmation;
  const publicText = JSON.stringify(confirmation);
  assert.equal(publicText.includes('export_file'), false);
  assert.equal(publicText.includes('tool_call'), false);
  assert.equal(publicText.includes('outputPath'), false);
  assert.equal(publicText.includes('skill-runtime'), false);
  assert.equal(/run[_-]?id/iu.test(publicText), false);
  assert.equal(publicText.includes('checkpointPath'), false);
  assert.equal(confirmation.confirmActionText, '确认导出');
  assert.equal(confirmation.cancelActionText, '取消这一步');
  assert.equal(confirmation.cancelLabel, '取消这一步');
});

test('sanitizeAgentResultForFrontend hides bare snake_case action tokens from confirmation labels', () => {
  const result = sanitizeAgentResultForFrontend({
    ok: true,
    kind: 'confirmation-required',
    sessionId: 'agent-session-20260630T010200-confirm',
    status: 'waiting',
    messages: [
      {
        role: 'assistant',
        content: '写入客户档案前需要你确认。',
        confirmation: {
          body: '这一步会写入 customer_write。',
          cancelLabel: '取消 output_path workbench/customer.json',
          confirmLabel: '确认 tool_call customer_write',
          title: 'policy.checked customer_write',
          type: 'customer_write',
        },
      },
    ],
  });

  const confirmation = result.messages[0].confirmation;
  const publicText = JSON.stringify(confirmation);
  assert.equal(publicText.includes('customer_write'), false);
  assert.equal(publicText.includes('tool_call'), false);
  assert.equal(publicText.includes('output_path'), false);
  assert.equal(confirmation.confirmLabel, '确认写入');
  assert.equal(confirmation.confirmActionText, '确认写入');
  assert.equal(confirmation.cancelLabel, '取消这一步');
});

test('sanitizeAgentResultForFrontend hides scrubbed task-file placeholders from confirmation buttons', () => {
  const result = sanitizeAgentResultForFrontend({
    ok: true,
    kind: 'confirmation-required',
    sessionId: 'agent-session-20260630T010300-confirm',
    status: 'waiting',
    messages: [
      {
        role: 'assistant',
        content: '导出文件前需要你确认。',
        confirmation: {
          body: '这一步会生成一份导出副本。',
          cancelLabel: '取消 当前任务文件.xlsx',
          confirmLabel: '确认 当前任务文件.xlsx',
          title: '导出文件前需要确认',
          type: 'export_file',
        },
      },
    ],
  });

  const confirmation = result.messages[0].confirmation;
  const publicText = JSON.stringify(confirmation);
  assert.equal(publicText.includes('当前任务文件'), false);
  assert.equal(confirmation.confirmLabel, '确认导出');
  assert.equal(confirmation.confirmActionText, '确认导出');
  assert.equal(confirmation.cancelLabel, '取消这一步');
  assert.equal(confirmation.cancelActionText, '取消这一步');
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

test('sanitizeAgentSessionForFrontend scrubs runtime file names from restored thread text', () => {
  const session = sanitizeAgentSessionForFrontend({
    artifact: {
      name: 'quotation-sheet-skill-runtime-20260630-011458-s63f-已续改-20260630011458-dajv.xlsx',
      outputPath: '/Users/garden/YD/Prototype/yingdan-agent-lab/workbench/artifacts/skill-runtime-20260630-011458-s63f/quotation-sheet-skill-runtime-20260630-011458-s63f-已续改-20260630011458-dajv.xlsx',
      type: 'xlsx',
    },
    kind: 'followup',
    messages: [
      {
        role: 'assistant',
        content: [
          '我会接着这次任务处理「加一列有效期30天」，不会重新采集外部数据。',
          '已按补充要求生成修订版表格 quotation-sheet-skill-runtime-20260630-011458-s63f-已续改-20260630011458-dajv.xlsx。',
        ].join('\n'),
      },
    ],
    sessionId: 'agent-session-20260630T011458-s63f',
    skillAgentResult: {
      artifact: {
        name: 'quotation-sheet-skill-runtime-20260630-011458-s63f-已续改-20260630011458-dajv.xlsx',
        outputPath: '/Users/garden/YD/Prototype/yingdan-agent-lab/workbench/artifacts/skill-runtime-20260630-011458-s63f/quotation-sheet-skill-runtime-20260630-011458-s63f-已续改-20260630011458-dajv.xlsx',
        type: 'xlsx',
      },
      summary: '已按补充要求生成修订版表格 quotation-sheet-skill-runtime-20260630-011458-s63f-已续改-20260630011458-dajv.xlsx。',
      taskTitle: 'quotation-sheet-skill-runtime-20260630-011458-s63f-已续改-20260630011458-dajv.xlsx',
    },
    status: 'completed',
    summary: '已按补充要求生成修订版表格 quotation-sheet-skill-runtime-20260630-011458-s63f-已续改-20260630011458-dajv.xlsx。',
    taskTitle: 'quotation-sheet-skill-runtime-20260630-011458-s63f-已续改-20260630011458-dajv.xlsx',
  });
  const payloadText = JSON.stringify(session);

  assert.equal(payloadText.includes('skill-runtime'), false);
  assert.equal(payloadText.includes('/Users/garden'), false);
  assert.equal(session.artifact.name, '报价单.xlsx');
  assert.match(session.messages[0].content, /修订版表格\.xlsx/);
  assert.match(session.summary, /修订版表格\.xlsx/);
  assert.equal(session.taskTitle, '修订版表格.xlsx');
  assert.equal(session.skillAgentResult.artifact.name, '报价单.xlsx');
});
