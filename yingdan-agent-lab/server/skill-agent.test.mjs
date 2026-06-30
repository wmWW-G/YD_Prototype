import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildAgentFollowupResponse,
  buildSkillAgentResponse,
  detectAgentGoal,
  detectSkillCommand,
  runNewConversationAgent,
} from './skill-agent.mjs';

const CODEX_BUNDLED_PYTHON =
  '/Users/garden/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';

function createTestRegistry() {
  const alibabaSkill = {
    id: 'alibaba-inquiry-meeting',
    displayName: '国际站询盘分析会',
    adapter: 'alibaba-inquiry-meeting',
    artifactType: 'xlsx',
    commandAliases: ['alibaba-inquiry-meeting'],
    goalMatchers: [
      {
        requiresAll: ['询盘'],
        requiresAny: ['分析会', '复盘会', '复盘', '会议', '开会'],
        periodHint: 'previous_full_week',
      },
    ],
  };
  return {
    skills: [alibabaSkill],
    byId: new Map([[alibabaSkill.id, alibabaSkill]]),
  };
}

function createFollowupRegistry() {
  const followupSkill = {
    id: 'customer-followup-plan',
    displayName: '客户推进分析',
    adapter: 'business-draft',
    artifactType: 'markdown',
    commandAliases: ['customer-followup-plan'],
    goalMatchers: [
      {
        requiresAll: ['客户'],
        requiresAny: ['推进', '下一步', '跟进', '分析'],
        reason: '用户要分析客户推进动作，匹配客户推进分析任务。',
      },
    ],
  };
  return {
    skills: [followupSkill],
    byId: new Map([[followupSkill.id, followupSkill]]),
  };
}

function createEmailRegistry() {
  const emailSkill = {
    id: 'cold-email-draft',
    displayName: '开发信草稿',
    adapter: 'business-draft',
    artifactType: 'markdown',
    commandAliases: ['cold-email-draft'],
    goalMatchers: [
      {
        requiresAll: ['开发信'],
        requiresAny: ['写', '生成', '准备', '草稿'],
        reason: '用户要准备开发信,匹配开发信草稿任务。',
      },
    ],
  };
  return {
    skills: [emailSkill],
    byId: new Map([[emailSkill.id, emailSkill]]),
  };
}

function createInquiryReplyRegistry() {
  const inquiryReplySkill = {
    id: 'inquiry-reply-draft',
    displayName: '询盘回复草稿',
    adapter: 'business-draft',
    artifactType: 'markdown',
    commandAliases: ['inquiry-reply-draft'],
    goalMatchers: [
      {
        requiresAll: ['询盘'],
        requiresAny: ['回复', '回信', '草稿', '邮件'],
        reason: '用户要处理询盘回复，匹配询盘回复草稿任务。',
      },
    ],
  };
  return {
    skills: [inquiryReplySkill],
    byId: new Map([[inquiryReplySkill.id, inquiryReplySkill]]),
  };
}

async function writeInquiryReplySkillProject(projectRoot) {
  const skill = createInquiryReplyRegistry().skills[0];
  const registryDir = path.join(projectRoot, 'workbench', 'registry');
  const skillDir = path.join(projectRoot, 'workbench', 'skills', skill.id);
  await mkdir(registryDir, { recursive: true });
  await mkdir(skillDir, { recursive: true });
  await writeFile(
    path.join(registryDir, 'skills.json'),
    `${JSON.stringify({ skills: [skill] }, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    path.join(skillDir, 'skill.json'),
    `${JSON.stringify(skill, null, 2)}\n`,
    'utf8',
  );
}

function createEmailAndInquiryReplyRegistry() {
  const emailRegistry = createEmailRegistry();
  const inquiryReplyRegistry = createInquiryReplyRegistry();
  const skills = [...emailRegistry.skills, ...inquiryReplyRegistry.skills];
  return {
    skills,
    byId: new Map(skills.map((skill) => [skill.id, skill])),
  };
}

function createEmailAndFollowupRegistry() {
  const emailRegistry = createEmailRegistry();
  const followupRegistry = createFollowupRegistry();
  const skills = [...emailRegistry.skills, ...followupRegistry.skills];
  return {
    skills,
    byId: new Map(skills.map((skill) => [skill.id, skill])),
  };
}

function createQuotationRegistry() {
  const quotationSkill = {
    id: 'quotation-sheet',
    displayName: '报价单',
    adapter: 'quotation-sheet',
    artifactType: 'xlsx',
    commandAliases: ['quotation-sheet'],
    goalMatchers: [
      {
        requiresAll: ['报价单'],
        requiresAny: ['做', '生成', '整理', '客户问', '报价'],
        reason: '用户要生成报价单,匹配报价单任务。',
      },
      {
        requiresAll: ['PI'],
        requiresAny: ['做', '生成', '整理', '报价'],
        reason: '用户要生成 PI / 报价单,匹配报价单任务。',
      },
    ],
  };
  return {
    skills: [quotationSkill],
    byId: new Map([[quotationSkill.id, quotationSkill]]),
  };
}

function createRuntimeResult(overrides = {}) {
  const runId = overrides.runId || 'skill-runtime-20260628-111500-natr';
  return {
    ok: true,
    runId,
    runLogPath: overrides.runLogPath || '/tmp/skill-runtime.jsonl',
    goal: {
      matched: true,
      trigger: overrides.trigger || 'natural_goal',
      skillId: 'alibaba-inquiry-meeting',
      periodHint: 'previous_full_week',
      reason: '已按业务目标匹配国际站询盘分析会。',
    },
    skill: {
      id: 'alibaba-inquiry-meeting',
      displayName: '国际站询盘分析会',
      adapter: 'alibaba-inquiry-meeting',
      artifactType: 'xlsx',
    },
    plan: {
      title: '国际站询盘分析会执行计划',
      steps: [{ id: 'run_skill', label: '执行任务', detail: '生成复盘会产物。' }],
    },
    result: {
      ok: true,
      mode: 'real-bridge',
      runId: 'alibaba-meeting-20260628-111500-natr',
      period: { start: '2026-06-15', end: '2026-06-21', label: '上周完整自然周' },
      outputPath: '/tmp/询盘分析会_2026-06-15_2026-06-21.xlsx',
      manifestPath: '/tmp/manifest.json',
      runLogPath: '/tmp/alibaba-meeting-20260628-111500-natr.jsonl',
      workbookName: '询盘分析会_2026-06-15_2026-06-21.xlsx',
      validation: { mode: 'real-bridge', builderExitCode: 0, workbookExists: true, workbookBytes: 24734 },
      toolSummary: { attempted: 38, succeeded: 38, missing: 0, requiredSucceeded: 36 },
    },
    artifact: {
      type: 'xlsx',
      name: '询盘分析会_2026-06-15_2026-06-21.xlsx',
      outputPath: '/tmp/询盘分析会_2026-06-15_2026-06-21.xlsx',
      manifestPath: '/tmp/manifest.json',
      validation: { mode: 'real-bridge', builderExitCode: 0, workbookExists: true, workbookBytes: 24734 },
    },
    loop: {
      status: 'completed',
      steps: [
        { action: 'goal.classify', title: '收到目标', detail: '已识别询盘分析会目标。', observation: 'goal.matched', status: 'complete', nextAction: 'skill.match' },
        { action: 'skill.match', title: '匹配任务', detail: '选择国际站询盘分析会作为执行 Skill。', observation: 'skill.matched', status: 'complete', nextAction: 'skill.load' },
        { action: 'skill.load', title: '读取 Skill 定义', detail: '已读取 SKILL.md / agents/openai.yaml / evals/evals.json。', observation: 'skill.loaded', status: 'complete', nextAction: 'plan.create' },
        { action: 'plan.create', title: '国际站询盘分析会执行计划', detail: '理解目标 → 执行任务 → 校验产物', observation: 'plan.ready', status: 'complete', nextAction: 'action.execute' },
        { action: 'action.execute', title: '执行任务', detail: '已生成询盘分析会产物。', observation: 'action.executed', status: 'complete', nextAction: 'observation.record' },
        { action: 'observation.record', title: '记录观察', detail: '产物：询盘分析会_2026-06-15_2026-06-21.xlsx；只读采集：38/38', observation: 'observation.ready', status: 'complete', nextAction: 'artifact.verify' },
        { action: 'artifact.verify', title: '校验产物', detail: '产物已通过 Runtime 基础校验。', observation: 'artifact.ready', status: 'complete', nextAction: 'finish' },
        { action: 'finish', title: '完成', detail: '本轮目标已完成。', observation: 'run.completed', status: 'complete', nextAction: 'none' },
      ],
    },
  };
}

test('detectSkillCommand recognizes the New Conversation skill execution phrase without hardcoding adapter mode', () => {
  const command = detectSkillCommand('执行Skill：alibaba-inquiry-meeting');

  assert.deepEqual(command, {
    matched: true,
    skillId: 'alibaba-inquiry-meeting',
    mode: 'registry',
  });
});

test('detectAgentGoal maps a natural inquiry meeting goal through registry data', () => {
  const goal = detectAgentGoal('帮我开上周询盘分析会', createTestRegistry());

  assert.equal(goal.matched, true);
  assert.equal(goal.skillId, 'alibaba-inquiry-meeting');
  assert.equal(goal.periodHint, 'previous_full_week');
  assert.equal(goal.trigger, 'natural_goal');
  assert.equal(goal.mode, 'alibaba-inquiry-meeting');
});

test('buildSkillAgentResponse exposes generic progress, activity, and XLSX artifact for the frontend agent', () => {
  const response = buildSkillAgentResponse({
    result: createRuntimeResult(),
    userText: '帮我开上周询盘分析会',
  });

  assert.equal(response.ok, true);
  assert.equal(response.skillId, 'alibaba-inquiry-meeting');
  assert.equal(response.status, 'completed');
  assert.equal(response.taskTitle, '国际站询盘分析会');
  assert.equal(response.artifact.outputPath, '/tmp/询盘分析会_2026-06-15_2026-06-21.xlsx');
  assert.deepEqual(response.progress.map((item) => item.label), ['识别任务', '核对资料', '拆解任务', '生成材料', '检查结果']);
  assert.deepEqual(response.progress.map((item) => item.phase), ['识别', '核对资料', '拆步骤', '执行', '检查']);
  assert.match(response.summary, /38\/38 次只读采集/);
  assert.match(response.summary, /询盘分析会_2026-06-15_2026-06-21\.xlsx/);
  assert.equal(response.messages[1].activity.source, 'skill-runtime-loop');
  assert.equal(response.messages[1].activity.items.some((item) => item.observation === '已核对任务所需资料和规则'), true);
  assert.equal(response.messages[1].activity.items.some((item) => item.title === '匹配处理方式'), false);
  assert.equal(JSON.stringify(response.messages[1].activity).includes('SKILL.md'), false);
  assert.equal(JSON.stringify(response.messages[1].activity).includes('处理方式'), false);
});

test('runNewConversationAgent returns a session thread from the generic Skill Runtime', async () => {
  const response = await runNewConversationAgent({
    text: '执行Skill：alibaba-inquiry-meeting',
    sessionId: 'session-user-provided',
    registry: createTestRegistry(),
    skillRuntime: {
      async runGoal() {
        return createRuntimeResult({ trigger: 'skill_command' });
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.sessionId, 'session-user-provided');
  assert.equal(response.loop.steps.some((item) => item.action === 'skill.load'), true);
  assert.equal(response.messages[1].activity.items.some((item) => item.observation === '已核对任务所需资料和规则'), true);
  assert.equal(response.messages.length, 2);
  assert.equal(response.messages[0].role, 'user');
  assert.equal(response.messages[1].role, 'assistant');
  assert.equal(response.messages[1].process.expanded, false);
  assert.deepEqual(response.messages[1].process.steps.map((item) => item.label), ['识别任务', '核对资料', '拆解任务', '生成材料', '检查结果']);
  assert.equal(response.messages[1].artifact.outputPath, '/tmp/询盘分析会_2026-06-15_2026-06-21.xlsx');
});

test('runNewConversationAgent plans and executes a natural language goal with activity from real Runtime steps', async () => {
  const response = await runNewConversationAgent({
    text: '帮我开上周询盘分析会',
    registry: createTestRegistry(),
    skillRuntime: {
      async runGoal() {
        return createRuntimeResult();
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'goal-run');
  assert.equal(response.goal.matched, true);
  assert.equal(response.goal.skillId, 'alibaba-inquiry-meeting');
  assert.equal(response.loop.status, 'completed');
  assert.deepEqual(
    response.loop.steps.map((item) => item.action),
    ['goal.classify', 'skill.match', 'skill.load', 'plan.create', 'action.execute', 'observation.record', 'artifact.verify', 'finish'],
  );
  assert.equal(response.plan.steps.length, 1);
  assert.equal(response.messages.length, 2);
  assert.match(response.messages[1].content, /按「国际站询盘分析会」的方式推进/);
  assert.equal(response.messages[1].activity.source, 'skill-runtime-loop');
  assert.equal(response.messages[1].activity.items.some((item) => item.observation === '已核对任务所需资料和规则'), true);
  assert.equal(response.messages[1].activity.items.some((item) => item.nextAction === '检查结果'), true);
});

test('runNewConversationAgent asks for business context instead of failing on unsupported goals', async () => {
  const response = await runNewConversationAgent({
    text: '帮我分析这个客户怎么推进',
    registry: createTestRegistry(),
    skillRuntime: {
      async runGoal() {
        throw new Error('runtime should not run without a matched skill');
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'needs-input');
  assert.match(response.sessionId, /^agent-session-/);
  assert.equal(response.status, 'waiting');
  assert.equal(response.context.pendingTask.originalText, '帮我分析这个客户怎么推进');
  assert.equal(response.messages.length, 1);
  assert.match(response.messages[0].content, /需要更多业务资料/);
  assert.match(response.messages[0].content, /客户名称、询盘原文、产品资料/);
});

test('runNewConversationAgent asks for missing business context before generating a matched email draft', async () => {
  const progressEvents = [];
  const response = await runNewConversationAgent({
    text: '写一封开发信',
    registry: createEmailRegistry(),
    onRuntimeEvent: async (event) => {
      progressEvents.push(event.type);
    },
    skillRuntime: {
      async runGoal() {
        throw new Error('runtime should not run when a matched task lacks required business context');
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'needs-input');
  assert.equal(response.status, 'waiting');
  assert.equal(response.artifact, undefined);
  assert.equal(response.context.pendingTask.originalText, '写一封开发信');
  assert.equal(response.context.pendingTask.skillId, 'cold-email-draft');
  assert.deepEqual(response.messages[0].needsInput, {
    title: '开发信草稿需要补充资料',
    items: ['客户名称或客户类型', '产品或核心卖点', '目标市场或客户所在国家'],
    hint: '直接补一句话即可,我会接着这次任务继续。',
  });
  assert.match(response.messages[0].content, /开发信草稿/);
  assert.match(response.messages[0].content, /客户名称/);
  assert.match(response.messages[0].content, /产品/);
  assert.match(response.messages[0].content, /目标市场/);
  assert.deepEqual(response.progress.map((item) => item.label), ['识别任务', '核对资料', '等待补充']);
  assert.deepEqual(response.messages[0].process.steps.map((item) => item.label), ['识别任务', '核对资料', '等待补充']);
  assert.deepEqual(progressEvents, ['goal.received', 'skill.loaded', 'run.needs_input']);
});

test('runNewConversationAgent writes a runtime checkpoint when a matched task needs business input', async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-needs-input-checkpoint-'));

  try {
    const response = await runNewConversationAgent({
      text: '客户问MOQ和交期，帮我回一下',
      registry: createInquiryReplyRegistry(),
      projectRoot,
      skillRuntime: {
        async runGoal() {
          throw new Error('runtime should not execute before product context exists');
        },
      },
    });
    const runtime = response.context.pendingTask.runtime;
    const checkpointPath = path.join(projectRoot, 'workbench', 'runs', `${runtime.runId}.checkpoint.json`);
    const runLogPath = path.join(projectRoot, 'workbench', 'runs', `${runtime.runId}.jsonl`);
    const checkpoint = JSON.parse(await readFile(checkpointPath, 'utf8'));
    const runEvents = (await readFile(runLogPath, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));

    assert.equal(response.kind, 'needs-input');
    assert.equal(response.status, 'waiting');
    assert.equal(runtime.resumeFrom, 'needs-input:inquiry-reply-draft');
    assert.equal(checkpoint.status, 'waiting');
    assert.equal(checkpoint.resume_from, 'needs-input:inquiry-reply-draft');
    assert.equal(checkpoint.skillId, 'inquiry-reply-draft');
    assert.deepEqual(checkpoint.missing, ['产品资料或报价边界']);
    assert.deepEqual(runEvents.map((event) => event.type), [
      'goal.received',
      'skill.matched',
      'skill.loaded',
      'run.checkpointed',
      'run.needs_input',
    ]);
    assert.equal(runEvents.some((event) => event.type === 'action.executed'), false);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('runNewConversationAgent does not treat channel agent wording as product context for email drafts', async () => {
  const response = await runNewConversationAgent({
    text: '写一封开发信给德国渠道代理',
    registry: createEmailRegistry(),
    skillRuntime: {
      async runGoal() {
        throw new Error('runtime should not run when channel agent wording is missing product context');
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'needs-input');
  assert.equal(response.status, 'waiting');
  assert.equal(response.taskTitle, '开发信草稿');
  assert.equal(response.context.pendingTask.skillId, 'cold-email-draft');
  assert.deepEqual(response.messages[0].needsInput.items, ['产品或核心卖点']);
  assert.match(response.messages[0].content, /产品或核心卖点/);
});

test('runNewConversationAgent asks for concrete context before generic customer analysis', async () => {
  const response = await runNewConversationAgent({
    text: '客户是德国采购商，帮我做客户分析',
    registry: createFollowupRegistry(),
    skillRuntime: {
      async runGoal() {
        throw new Error('runtime should not run before customer analysis has a concrete issue or product context');
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'needs-input');
  assert.equal(response.status, 'waiting');
  assert.equal(response.taskTitle, '客户推进分析');
  assert.equal(response.context.pendingTask.skillId, 'customer-followup-plan');
  assert.deepEqual(response.messages[0].needsInput, {
    title: '客户推进分析需要补充资料',
    items: ['询盘、聊天记录或当前卡点'],
    hint: '直接补一句话即可,我会接着这次任务继续。',
  });
  assert.match(response.messages[0].content, /询盘、聊天记录或当前卡点/);
});

test('runNewConversationAgent does not treat a hollow inquiry mention as enough customer analysis context', async () => {
  const response = await runNewConversationAgent({
    text: '客户是德国采购商，有个询盘，帮我做客户分析',
    registry: createFollowupRegistry(),
    skillRuntime: {
      async runGoal() {
        throw new Error('runtime should not run before the inquiry has concrete details');
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'needs-input');
  assert.equal(response.status, 'waiting');
  assert.equal(response.taskTitle, '客户推进分析');
  assert.equal(response.context.pendingTask.skillId, 'customer-followup-plan');
  assert.deepEqual(response.messages[0].needsInput.items, ['询盘、聊天记录或当前卡点']);
});

test('runNewConversationAgent does not treat product-only customer context as enough customer analysis evidence', async () => {
  const response = await runNewConversationAgent({
    text: '客户是德国采购商，产品是太阳能灯，帮我做客户分析',
    registry: createFollowupRegistry(),
    skillRuntime: {
      async runGoal() {
        throw new Error('runtime should not run before customer analysis has a current issue or inquiry evidence');
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'needs-input');
  assert.equal(response.status, 'waiting');
  assert.equal(response.taskTitle, '客户推进分析');
  assert.equal(response.context.pendingTask.skillId, 'customer-followup-plan');
  assert.deepEqual(response.messages[0].needsInput.items, ['询盘、聊天记录或当前卡点']);
});

test('runNewConversationAgent does not treat a hollow demand mention as enough customer priority context', async () => {
  const response = await runNewConversationAgent({
    text: '客户是德国采购商，有需求，帮我分析优先级',
    registry: createFollowupRegistry(),
    skillRuntime: {
      async runGoal() {
        throw new Error('runtime should not run before the customer demand is concrete');
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'needs-input');
  assert.equal(response.status, 'waiting');
  assert.equal(response.taskTitle, '客户推进分析');
  assert.equal(response.context.pendingTask.skillId, 'customer-followup-plan');
  assert.deepEqual(response.messages[0].needsInput.items, ['询盘、聊天记录或当前卡点']);
});

test('runNewConversationAgent treats customer priority as customer analysis and waits for details', async () => {
  const response = await runNewConversationAgent({
    text: '帮我判断这个客户优先级',
    registry: createFollowupRegistry(),
    skillRuntime: {
      async runGoal() {
        throw new Error('runtime should not run before customer priority analysis has concrete context');
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'needs-input');
  assert.equal(response.status, 'waiting');
  assert.equal(response.taskTitle, '客户推进分析');
  assert.equal(response.context.pendingTask.skillId, 'customer-followup-plan');
  assert.deepEqual(response.messages[0].needsInput.items, ['客户名称或客户类型', '询盘、聊天记录或当前卡点']);
});

test('runNewConversationAgent resumes customer analysis after the user adds the current issue', async () => {
  const first = await runNewConversationAgent({
    text: '客户是德国采购商，帮我做客户分析',
    registry: createFollowupRegistry(),
  });
  let runtimeText = '';

  const second = await runNewConversationAgent({
    text: '他问MOQ和交期，产品是太阳能灯',
    sessionId: first.sessionId,
    context: first.context,
    registry: createFollowupRegistry(),
    skillRuntime: {
      async runGoal({ text }) {
        runtimeText = text;
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'customer-followup-plan',
            reason: '用户补充当前卡点后,匹配客户推进分析任务。',
          },
          skill: {
            id: 'customer-followup-plan',
            displayName: '客户推进分析',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/客户推进分析.md',
            artifactName: '客户推进分析.md',
          },
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: '/tmp/客户推进分析.md',
          },
        };
      },
    },
  });

  assert.equal(first.kind, 'needs-input');
  assert.equal(second.kind, 'goal-run');
  assert.equal(second.sessionId, first.sessionId);
  assert.equal(second.artifact.name, '客户推进分析.md');
  assert.match(runtimeText, /客户是德国采购商/);
  assert.match(runtimeText, /他问MOQ和交期/);
  assert.match(runtimeText, /产品是太阳能灯/);
});

test('runNewConversationAgent records runtime resume when a needs-input checkpoint gets enough supplement', async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-needs-input-resume-'));

  try {
    await writeInquiryReplySkillProject(projectRoot);
    const first = await runNewConversationAgent({
      text: '客户问MOQ和交期，帮我回一下',
      registry: createInquiryReplyRegistry(),
      projectRoot,
    });
    const runtime = first.context.pendingTask.runtime;
    const runLogPath = path.join(projectRoot, 'workbench', 'runs', `${runtime.runId}.jsonl`);
    const second = await runNewConversationAgent({
      text: '产品太阳能路灯',
      sessionId: first.sessionId,
      context: first.context,
      registry: createInquiryReplyRegistry(),
      projectRoot,
    });
    const runEvents = (await readFile(runLogPath, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));

    assert.equal(second.kind, 'goal-run');
    assert.equal(second.sessionId, first.sessionId);
    assert.equal(second.artifact.name, '询盘回复草稿.md');
    assert.ok(runEvents.some((event) => event.type === 'run.resumed' && event.resume_from === 'needs-input:inquiry-reply-draft'));
    assert.ok(runEvents.some((event) => event.type === 'action.executed'));
    assert.ok(runEvents.some((event) => event.type === 'artifact.verified'));
    assert.equal(Object.hasOwn(second.context, 'pendingTask'), false);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('runNewConversationAgent treats a concrete customer objection as enough follow-up context', async () => {
  let runtimeText = '';
  const response = await runNewConversationAgent({
    text: '客户说价格太高，帮我想下一步怎么谈，产品太阳能路灯',
    registry: createFollowupRegistry(),
    skillRuntime: {
      async runGoal({ text }) {
        runtimeText = text;
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'customer-followup-plan',
            reason: '用户给出客户价格异议和产品,匹配客户推进分析任务。',
          },
          skill: {
            id: 'customer-followup-plan',
            displayName: '客户推进分析',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/客户推进分析.md',
            artifactName: '客户推进分析.md',
          },
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: '/tmp/客户推进分析.md',
          },
        };
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'goal-run');
  assert.equal(response.taskTitle, '客户推进分析');
  assert.equal(response.artifact.name, '客户推进分析.md');
  assert.match(runtimeText, /客户说价格太高/);
  assert.match(runtimeText, /产品太阳能路灯/);
});

test('runNewConversationAgent treats buyer says expensive as a concrete follow-up issue', async () => {
  let runtimeText = '';
  const response = await runNewConversationAgent({
    text: '买家嫌贵，产品是家具，帮我想下一步怎么谈',
    registry: createFollowupRegistry(),
    skillRuntime: {
      async runGoal({ text }) {
        runtimeText = text;
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'customer-followup-plan',
            reason: '用户给出买家价格异议和产品,匹配客户推进分析任务。',
          },
          skill: {
            id: 'customer-followup-plan',
            displayName: '客户推进分析',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/客户推进分析.md',
            artifactName: '客户推进分析.md',
          },
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: '/tmp/客户推进分析.md',
          },
        };
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'goal-run');
  assert.equal(response.taskTitle, '客户推进分析');
  assert.equal(response.artifact.name, '客户推进分析.md');
  assert.match(runtimeText, /买家嫌贵/);
  assert.match(runtimeText, /产品是家具/);
});

test('runNewConversationAgent understands counterparty objection as customer follow-up intent', async () => {
  let runtimeText = '';
  const response = await runNewConversationAgent({
    text: '对方嫌贵，产品是家具，下一步怎么推进',
    registry: createFollowupRegistry(),
    skillRuntime: {
      async runGoal({ text }) {
        runtimeText = text;
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'customer-followup-plan',
            reason: '用户用对方代称描述价格异议,匹配客户推进分析任务。',
          },
          skill: {
            id: 'customer-followup-plan',
            displayName: '客户推进分析',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/客户推进分析.md',
            artifactName: '客户推进分析.md',
          },
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: '/tmp/客户推进分析.md',
          },
        };
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'goal-run');
  assert.equal(response.taskTitle, '客户推进分析');
  assert.equal(response.artifact.name, '客户推进分析.md');
  assert.match(runtimeText, /对方嫌贵/);
  assert.match(runtimeText, /产品是家具/);
});

test('runNewConversationAgent treats haggling as a concrete customer negotiation issue', async () => {
  let runtimeText = '';
  const response = await runNewConversationAgent({
    text: '客户砍价，产品是家具，怎么谈',
    registry: createFollowupRegistry(),
    skillRuntime: {
      async runGoal({ text }) {
        runtimeText = text;
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'customer-followup-plan',
            reason: '用户要处理客户砍价场景。',
          },
          skill: {
            id: 'customer-followup-plan',
            displayName: '客户推进分析',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/客户推进分析.md',
            artifactName: '客户推进分析.md',
          },
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: '/tmp/客户推进分析.md',
          },
        };
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'goal-run');
  assert.equal(response.taskTitle, '客户推进分析');
  assert.equal(response.artifact.name, '客户推进分析.md');
  assert.match(runtimeText, /客户砍价/);
  assert.match(runtimeText, /产品是家具/);
});

test('runNewConversationAgent treats discount pressure as a concrete customer negotiation issue', async () => {
  let runtimeText = '';
  const response = await runNewConversationAgent({
    text: '买家要折扣，产品是太阳能灯，怎么谈',
    registry: createFollowupRegistry(),
    skillRuntime: {
      async runGoal({ text }) {
        runtimeText = text;
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'customer-followup-plan',
            reason: '用户要处理买家折扣压力。',
          },
          skill: {
            id: 'customer-followup-plan',
            displayName: '客户推进分析',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/客户推进分析.md',
            artifactName: '客户推进分析.md',
          },
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: '/tmp/客户推进分析.md',
          },
        };
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'goal-run');
  assert.equal(response.taskTitle, '客户推进分析');
  assert.equal(response.artifact.name, '客户推进分析.md');
  assert.match(runtimeText, /买家要折扣/);
  assert.match(runtimeText, /产品是太阳能灯/);
});

test('runNewConversationAgent treats read-with-no-reply as a concrete customer follow-up issue', async () => {
  let runtimeText = '';
  const response = await runNewConversationAgent({
    text: '客户已读不回，产品是家具，怎么跟',
    registry: createFollowupRegistry(),
    skillRuntime: {
      async runGoal({ text }) {
        runtimeText = text;
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'customer-followup-plan',
            reason: '用户要处理客户已读不回的跟进场景。',
          },
          skill: {
            id: 'customer-followup-plan',
            displayName: '客户推进分析',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/客户推进分析.md',
            artifactName: '客户推进分析.md',
          },
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: '/tmp/客户推进分析.md',
          },
        };
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'goal-run');
  assert.equal(response.taskTitle, '客户推进分析');
  assert.equal(response.artifact.name, '客户推进分析.md');
  assert.match(runtimeText, /客户已读不回/);
  assert.match(runtimeText, /产品是家具/);
});

test('runNewConversationAgent treats no-reply wording as a concrete customer follow-up issue', async () => {
  let runtimeText = '';
  const response = await runNewConversationAgent({
    text: '买家一直没回复，产品太阳能灯，下一步怎么办',
    registry: createFollowupRegistry(),
    skillRuntime: {
      async runGoal({ text }) {
        runtimeText = text;
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'customer-followup-plan',
            reason: '用户要处理买家未回复的跟进场景。',
          },
          skill: {
            id: 'customer-followup-plan',
            displayName: '客户推进分析',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/客户推进分析.md',
            artifactName: '客户推进分析.md',
          },
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: '/tmp/客户推进分析.md',
          },
        };
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'goal-run');
  assert.equal(response.taskTitle, '客户推进分析');
  assert.equal(response.artifact.name, '客户推进分析.md');
  assert.match(runtimeText, /买家一直没回复/);
  assert.match(runtimeText, /产品太阳能灯/);
});

test('runNewConversationAgent treats payment-term pressure as a concrete customer follow-up issue', async () => {
  let runtimeText = '';
  const response = await runNewConversationAgent({
    text: '客户要求60天账期，产品是设备，怎么处理',
    registry: createFollowupRegistry(),
    skillRuntime: {
      async runGoal({ text }) {
        runtimeText = text;
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'customer-followup-plan',
            reason: '用户要处理客户账期压力的跟进场景。',
          },
          skill: {
            id: 'customer-followup-plan',
            displayName: '客户推进分析',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/客户推进分析.md',
            artifactName: '客户推进分析.md',
          },
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: '/tmp/客户推进分析.md',
          },
        };
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'goal-run');
  assert.equal(response.taskTitle, '客户推进分析');
  assert.equal(response.artifact.name, '客户推进分析.md');
  assert.match(runtimeText, /客户要求60天账期/);
  assert.match(runtimeText, /产品是设备/);
});

test('runNewConversationAgent treats quality complaints as a concrete customer follow-up issue', async () => {
  let runtimeText = '';
  const response = await runNewConversationAgent({
    text: '客户抱怨质量不行，产品是灯具，怎么处理',
    registry: createFollowupRegistry(),
    skillRuntime: {
      async runGoal({ text }) {
        runtimeText = text;
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'customer-followup-plan',
            reason: '用户要处理客户质量投诉的跟进场景。',
          },
          skill: {
            id: 'customer-followup-plan',
            displayName: '客户推进分析',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/客户推进分析.md',
            artifactName: '客户推进分析.md',
          },
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: '/tmp/客户推进分析.md',
          },
        };
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'goal-run');
  assert.equal(response.taskTitle, '客户推进分析');
  assert.equal(response.artifact.name, '客户推进分析.md');
  assert.match(runtimeText, /客户抱怨质量不行/);
  assert.match(runtimeText, /产品是灯具/);
});

test('runNewConversationAgent treats free sample requests as a concrete customer follow-up issue', async () => {
  let runtimeText = '';
  const response = await runNewConversationAgent({
    text: '客户要免费样品，产品是灯具',
    registry: createFollowupRegistry(),
    skillRuntime: {
      async runGoal({ text }) {
        runtimeText = text;
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'customer-followup-plan',
            reason: '用户要处理客户免费样品要求的跟进场景。',
          },
          skill: {
            id: 'customer-followup-plan',
            displayName: '客户推进分析',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/客户推进分析.md',
            artifactName: '客户推进分析.md',
          },
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: '/tmp/客户推进分析.md',
          },
        };
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'goal-run');
  assert.equal(response.taskTitle, '客户推进分析');
  assert.equal(response.artifact.name, '客户推进分析.md');
  assert.match(runtimeText, /客户要免费样品/);
  assert.match(runtimeText, /产品是灯具/);
});

test('runNewConversationAgent treats shipping cost objections as a concrete customer follow-up issue', async () => {
  let runtimeText = '';
  const response = await runNewConversationAgent({
    text: '客户嫌运费太贵，产品是灯具，怎么处理',
    registry: createFollowupRegistry(),
    skillRuntime: {
      async runGoal({ text }) {
        runtimeText = text;
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'customer-followup-plan',
            reason: '用户要处理客户运费异议的跟进场景。',
          },
          skill: {
            id: 'customer-followup-plan',
            displayName: '客户推进分析',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/客户推进分析.md',
            artifactName: '客户推进分析.md',
          },
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: '/tmp/客户推进分析.md',
          },
        };
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'goal-run');
  assert.equal(response.taskTitle, '客户推进分析');
  assert.equal(response.artifact.name, '客户推进分析.md');
  assert.match(runtimeText, /客户嫌运费太贵/);
  assert.match(runtimeText, /产品是灯具/);
});

test('runNewConversationAgent treats small trial orders as a concrete customer follow-up issue', async () => {
  let runtimeText = '';
  const response = await runNewConversationAgent({
    text: '客户只想小批量试单，产品是灯具，怎么处理',
    registry: createFollowupRegistry(),
    skillRuntime: {
      async runGoal({ text }) {
        runtimeText = text;
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'customer-followup-plan',
            reason: '用户要处理客户小批量试单的跟进场景。',
          },
          skill: {
            id: 'customer-followup-plan',
            displayName: '客户推进分析',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/客户推进分析.md',
            artifactName: '客户推进分析.md',
          },
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: '/tmp/客户推进分析.md',
          },
        };
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'goal-run');
  assert.equal(response.taskTitle, '客户推进分析');
  assert.equal(response.artifact.name, '客户推进分析.md');
  assert.match(runtimeText, /客户只想小批量试单/);
  assert.match(runtimeText, /产品是灯具/);
});

test('runNewConversationAgent treats exclusive agency requests as a concrete customer follow-up issue', async () => {
  let runtimeText = '';
  const response = await runNewConversationAgent({
    text: '客户想做独家代理，产品是灯具，怎么谈',
    registry: createFollowupRegistry(),
    skillRuntime: {
      async runGoal({ text }) {
        runtimeText = text;
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'customer-followup-plan',
            reason: '用户要处理客户独家代理的跟进场景。',
          },
          skill: {
            id: 'customer-followup-plan',
            displayName: '客户推进分析',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/客户推进分析.md',
            artifactName: '客户推进分析.md',
          },
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: '/tmp/客户推进分析.md',
          },
        };
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'goal-run');
  assert.equal(response.taskTitle, '客户推进分析');
  assert.equal(response.artifact.name, '客户推进分析.md');
  assert.match(runtimeText, /客户想做独家代理/);
  assert.match(runtimeText, /产品是灯具/);
});

test('runNewConversationAgent asks for product context before negotiating exclusive agency', async () => {
  const response = await runNewConversationAgent({
    text: '客户想做独家代理，怎么谈',
    registry: createFollowupRegistry(),
    skillRuntime: {
      async runGoal() {
        throw new Error('runtime should not run before exclusive agency product context is known');
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'needs-input');
  assert.equal(response.status, 'waiting');
  assert.equal(response.taskTitle, '客户推进分析');
  assert.equal(response.context.pendingTask.skillId, 'customer-followup-plan');
  assert.deepEqual(response.messages[0].needsInput.items, ['产品或核心卖点']);
  assert.match(response.messages[0].content, /产品或核心卖点/);
});

test('runNewConversationAgent asks for product context before a seven-day follow-up plan', async () => {
  const response = await runNewConversationAgent({
    text: '客户已读不回，帮我做一个7天跟进计划',
    registry: createFollowupRegistry(),
    skillRuntime: {
      async runGoal() {
        throw new Error('runtime should not run before seven-day follow-up product context is known');
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'needs-input');
  assert.equal(response.status, 'waiting');
  assert.equal(response.taskTitle, '客户推进分析');
  assert.equal(response.context.pendingTask.skillId, 'customer-followup-plan');
  assert.deepEqual(response.messages[0].needsInput.items, ['产品或核心卖点']);
  assert.match(response.messages[0].content, /产品或核心卖点/);
});

test('runNewConversationAgent resumes a seven-day follow-up plan after product context is added', async () => {
  const first = await runNewConversationAgent({
    text: '客户已读不回，帮我做一个7天跟进计划',
    registry: createFollowupRegistry(),
  });
  let runtimeText = '';

  const second = await runNewConversationAgent({
    text: '产品是家具',
    sessionId: first.sessionId,
    context: first.context,
    registry: createFollowupRegistry(),
    skillRuntime: {
      async runGoal({ text }) {
        runtimeText = text;
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'customer-followup-plan',
            reason: '用户补充产品后,匹配7天客户跟进计划任务。',
          },
          skill: {
            id: 'customer-followup-plan',
            displayName: '客户推进分析',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/客户推进分析.md',
            artifactName: '客户推进分析.md',
          },
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: '/tmp/客户推进分析.md',
          },
        };
      },
    },
  });

  assert.equal(first.kind, 'needs-input');
  assert.equal(second.ok, true);
  assert.equal(second.kind, 'goal-run');
  assert.equal(second.taskTitle, '客户推进分析');
  assert.equal(second.artifact.name, '客户推进分析.md');
  assert.match(runtimeText, /客户已读不回/);
  assert.match(runtimeText, /7天跟进计划/);
  assert.match(runtimeText, /产品是家具/);
});

test('runNewConversationAgent resumes exclusive agency negotiation after product context is added', async () => {
  const first = await runNewConversationAgent({
    text: '客户想做独家代理，怎么谈',
    registry: createFollowupRegistry(),
  });
  let runtimeText = '';

  const second = await runNewConversationAgent({
    text: '产品是灯具',
    sessionId: first.sessionId,
    context: first.context,
    registry: createFollowupRegistry(),
    skillRuntime: {
      async runGoal({ text }) {
        runtimeText = text;
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'customer-followup-plan',
            reason: '用户补充产品后,匹配独家代理客户推进分析任务。',
          },
          skill: {
            id: 'customer-followup-plan',
            displayName: '客户推进分析',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/客户推进分析.md',
            artifactName: '客户推进分析.md',
          },
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: '/tmp/客户推进分析.md',
          },
        };
      },
    },
  });

  assert.equal(first.kind, 'needs-input');
  assert.equal(second.ok, true);
  assert.equal(second.kind, 'goal-run');
  assert.equal(second.taskTitle, '客户推进分析');
  assert.equal(second.artifact.name, '客户推进分析.md');
  assert.match(runtimeText, /客户想做独家代理/);
  assert.match(runtimeText, /产品是灯具/);
});

test('runNewConversationAgent asks for unit price before generating a quotation sheet', async () => {
  const response = await runNewConversationAgent({
    text: '客户问报价，产品太阳能路灯，数量500套，帮我做一份报价单',
    registry: createQuotationRegistry(),
    skillRuntime: {
      async runGoal() {
        throw new Error('runtime should not generate a quotation sheet without unit price');
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'needs-input');
  assert.equal(response.status, 'waiting');
  assert.equal(response.taskTitle, '报价单');
  assert.equal(response.context.pendingTask.skillId, 'quotation-sheet');
  assert.deepEqual(response.messages[0].needsInput.items, ['单价或报价区间', '币种和贸易条款']);
});

test('runNewConversationAgent asks for product details before generating a quotation sheet', async () => {
  const response = await runNewConversationAgent({
    text: '客户要报价，帮我做报价单',
    registry: createQuotationRegistry(),
    skillRuntime: {
      async runGoal() {
        throw new Error('runtime should not generate a quotation sheet without product details');
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'needs-input');
  assert.equal(response.status, 'waiting');
  assert.equal(response.taskTitle, '报价单');
  assert.equal(response.context.pendingTask.skillId, 'quotation-sheet');
  assert.deepEqual(response.messages[0].needsInput.items, ['产品资料', '数量', '单价或报价区间', '币种和贸易条款']);
});

test('runNewConversationAgent asks for product context before replying to MOQ and lead time questions', async () => {
  const response = await runNewConversationAgent({
    text: '客户问MOQ和交期，帮我回一下',
    registry: createInquiryReplyRegistry(),
    skillRuntime: {
      async runGoal() {
        throw new Error('runtime should not write an inquiry reply before product context is available');
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'needs-input');
  assert.equal(response.status, 'waiting');
  assert.equal(response.taskTitle, '询盘回复草稿');
  assert.equal(response.context.pendingTask.skillId, 'inquiry-reply-draft');
  assert.deepEqual(response.messages[0].needsInput.items, ['产品资料或报价边界']);
});

test('runNewConversationAgent preserves a waiting inquiry task when the supplement asks to send externally', async () => {
  const first = await runNewConversationAgent({
    text: '客户问MOQ和交期，帮我回一下',
    registry: createInquiryReplyRegistry(),
  });

  const second = await runNewConversationAgent({
    text: '产品太阳能路灯，发给客户',
    sessionId: first.sessionId,
    context: first.context,
    registry: createInquiryReplyRegistry(),
    skillRuntime: {
      async runGoal() {
        throw new Error('runtime should stop for external send confirmation before generating a draft');
      },
    },
  });
  let runtimeText = '';

  const third = await runNewConversationAgent({
    text: '先生成草稿',
    sessionId: first.sessionId,
    context: second.context,
    registry: createInquiryReplyRegistry(),
    skillRuntime: {
      async runGoal({ text }) {
        runtimeText = text;
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'inquiry-reply-draft',
            reason: '用户补充产品并确认只生成询盘回复草稿。',
          },
          skill: {
            id: 'inquiry-reply-draft',
            displayName: '询盘回复草稿',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/询盘回复草稿.md',
            artifactName: '询盘回复草稿.md',
          },
          artifact: {
            type: 'markdown',
            name: '询盘回复草稿.md',
            outputPath: '/tmp/询盘回复草稿.md',
          },
        };
      },
    },
  });

  assert.equal(first.kind, 'needs-input');
  assert.equal(second.kind, 'confirmation-required');
  assert.equal(second.context.pendingTask.skillId, 'inquiry-reply-draft');
  assert.equal(second.context.pendingConfirmation.type, 'external_send');
  assert.equal(third.kind, 'confirmation-accepted');
  assert.equal(third.artifact.name, '询盘回复草稿.md');
  assert.match(runtimeText, /客户问MOQ和交期/);
  assert.match(runtimeText, /产品太阳能路灯/);
  assert.match(runtimeText, /询盘回复草稿/);
  assert.doesNotMatch(runtimeText, /跟进开发信/);
});

test('runNewConversationAgent generates a waiting task artifact before asking to save it', async () => {
  const first = await runNewConversationAgent({
    text: '客户问MOQ和交期，帮我回一下',
    registry: createInquiryReplyRegistry(),
  });
  let runtimeText = '';
  const progressEvents = [];

  const second = await runNewConversationAgent({
    text: '产品太阳能路灯，保存一下',
    sessionId: first.sessionId,
    context: first.context,
    registry: createInquiryReplyRegistry(),
    onRuntimeEvent: async (event) => {
      progressEvents.push(event.type);
    },
    skillRuntime: {
      async runGoal({ text, onRuntimeEvent }) {
        runtimeText = text;
        for (const event of [
          { type: 'goal.received', status: 'complete' },
          { type: 'skill.loaded', status: 'complete' },
          { type: 'plan.created', status: 'complete' },
          { type: 'action.executed', status: 'complete' },
          { type: 'artifact.verified', status: 'complete' },
          { type: 'run.completed', status: 'complete' },
        ]) {
          await onRuntimeEvent(event);
        }
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'inquiry-reply-draft',
            reason: '用户补充产品后,先生成询盘回复草稿。',
          },
          skill: {
            id: 'inquiry-reply-draft',
            displayName: '询盘回复草稿',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/询盘回复草稿.md',
            artifactName: '询盘回复草稿.md',
          },
          artifact: {
            type: 'markdown',
            name: '询盘回复草稿.md',
            outputPath: '/tmp/询盘回复草稿.md',
          },
        };
      },
    },
  });

  assert.equal(first.kind, 'needs-input');
  assert.equal(second.kind, 'confirmation-required');
  assert.equal(second.status, 'waiting');
  assert.equal(second.artifact.name, '询盘回复草稿.md');
  assert.equal(second.context.artifact.name, '询盘回复草稿.md');
  assert.equal(second.context.pendingConfirmation.type, 'customer_write');
  assert.equal(second.messages[1].confirmation.title, '写入客户档案前需要确认');
  assert.match(second.messages[1].content, /保存前需要你确认/);
  assert.deepEqual(second.progress.slice(-3).map((item) => item.label), ['检查结果', '核对权限', '等待确认']);
  assert.deepEqual(second.messages[1].process.steps.slice(-3).map((item) => item.label), ['检查结果', '核对权限', '等待确认']);
  assert.deepEqual(second.messages[1].activity.items.slice(-3).map((item) => item.title), ['检查结果', '核对权限', '等待确认']);
  assert.notEqual(second.messages[1].activity.items.at(-1).title, '完成');
  assert.deepEqual(progressEvents, [
    'goal.received',
    'skill.loaded',
    'plan.created',
    'action.executed',
    'artifact.verified',
    'policy.checked',
    'run.waiting',
  ]);
  assert.match(runtimeText, /客户问MOQ和交期/);
  assert.match(runtimeText, /产品太阳能路灯/);
  assert.match(runtimeText, /询盘回复草稿/);
});

test('runNewConversationAgent executes a matched email draft when business context is enough', async () => {
  let runtimeText = '';
  const response = await runNewConversationAgent({
    text: '写一封开发信给德国采购商，产品是太阳能路灯，重点问MOQ和交期',
    registry: createEmailRegistry(),
    skillRuntime: {
      async runGoal(input = {}) {
        runtimeText = input.text;
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'cold-email-draft',
            reason: '已按业务目标匹配开发信草稿。',
          },
          skill: {
            id: 'cold-email-draft',
            displayName: '开发信草稿',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/开发信草稿.md',
            artifactName: '开发信草稿.md',
          },
          artifact: {
            type: 'markdown',
            name: '开发信草稿.md',
            outputPath: '/tmp/开发信草稿.md',
          },
        };
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'goal-run');
  assert.equal(response.skillId, 'cold-email-draft');
  assert.equal(response.taskTitle, '开发信草稿');
  assert.equal(response.artifact.name, '开发信草稿.md');
  assert.equal(runtimeText, '写一封开发信给德国采购商，产品是太阳能路灯，重点问MOQ和交期');
});

test('runNewConversationAgent carries prior thread facts into a new matched task in the same session', async () => {
  const registry = createEmailAndFollowupRegistry();
  const firstText = '帮我准备一封跟进开发信，客户是德国采购商，产品太阳能路灯，重点问MOQ和交期';
  const first = await runNewConversationAgent({
    text: firstText,
    registry,
    skillRuntime: {
      async runGoal() {
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'cold-email-draft',
            reason: '用户要准备开发信草稿。',
          },
          skill: {
            id: 'cold-email-draft',
            displayName: '开发信草稿',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/开发信草稿.md',
            artifactName: '开发信草稿.md',
          },
          artifact: {
            type: 'markdown',
            name: '开发信草稿.md',
            outputPath: '/tmp/开发信草稿.md',
          },
        };
      },
    },
  });
  let runtimeText = '';

  const second = await runNewConversationAgent({
    text: '再做一个客户下一步推进计划',
    sessionId: first.sessionId,
    context: first.context,
    session: {
      context: first.context,
      messages: [
        { role: 'user', content: firstText },
        ...(first.messages || []).filter((message) => message.role === 'assistant'),
      ],
    },
    registry,
    skillRuntime: {
      async runGoal({ text }) {
        runtimeText = text;
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'customer-followup-plan',
            reason: '用户在同一线程里继续要求客户推进计划。',
          },
          skill: {
            id: 'customer-followup-plan',
            displayName: '客户推进分析',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/客户推进分析.md',
            artifactName: '客户推进分析.md',
          },
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: '/tmp/客户推进分析.md',
          },
        };
      },
    },
  });

  assert.equal(first.kind, 'goal-run');
  assert.equal(second.kind, 'goal-run');
  assert.equal(second.artifact.name, '客户推进分析.md');
  assert.match(runtimeText, /再做一个客户下一步推进计划/);
  assert.match(runtimeText, /德国采购商/);
  assert.match(runtimeText, /太阳能路灯/);
  assert.match(runtimeText, /MOQ和交期/);
  assert.doesNotMatch(runtimeText, /开发信/);
});

test('runNewConversationAgent does not carry prior customer facts when the user asks about another customer', async () => {
  const registry = createEmailAndFollowupRegistry();
  const firstText = '帮我准备一封跟进开发信，客户是德国采购商，产品太阳能路灯，重点问MOQ和交期';
  const first = await runNewConversationAgent({
    text: firstText,
    registry,
    skillRuntime: {
      async runGoal() {
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'cold-email-draft',
            reason: '用户要准备开发信草稿。',
          },
          skill: {
            id: 'cold-email-draft',
            displayName: '开发信草稿',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/开发信草稿.md',
            artifactName: '开发信草稿.md',
          },
          artifact: {
            type: 'markdown',
            name: '开发信草稿.md',
            outputPath: '/tmp/开发信草稿.md',
          },
        };
      },
    },
  });

  const second = await runNewConversationAgent({
    text: '再分析另一个客户怎么推进',
    sessionId: first.sessionId,
    context: first.context,
    session: {
      context: first.context,
      messages: [
        { role: 'user', content: firstText },
        ...(first.messages || []).filter((message) => message.role === 'assistant'),
      ],
    },
    registry,
    skillRuntime: {
      async runGoal() {
        throw new Error('runtime should not reuse the previous customer for a different customer');
      },
    },
  });

  assert.equal(first.kind, 'goal-run');
  assert.equal(second.kind, 'needs-input');
  assert.equal(second.status, 'waiting');
  assert.equal(second.taskTitle, '客户推进分析');
  assert.deepEqual(second.context.pendingTask.missing, ['客户名称或客户类型', '询盘、聊天记录或当前卡点']);
  assert.doesNotMatch(second.messages[0].content, /德国采购商|太阳能路灯|MOQ和交期/);
});

test('runNewConversationAgent does not carry prior facts when the user explicitly restarts the task', async () => {
  const registry = createEmailAndFollowupRegistry();
  const firstText = '帮我准备一封跟进开发信，客户是德国采购商，产品太阳能路灯，重点问MOQ和交期';
  const first = await runNewConversationAgent({
    text: firstText,
    registry,
    skillRuntime: {
      async runGoal() {
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'cold-email-draft',
            reason: '用户要准备开发信草稿。',
          },
          skill: {
            id: 'cold-email-draft',
            displayName: '开发信草稿',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/开发信草稿.md',
            artifactName: '开发信草稿.md',
          },
          artifact: {
            type: 'markdown',
            name: '开发信草稿.md',
            outputPath: '/tmp/开发信草稿.md',
          },
        };
      },
    },
  });

  const second = await runNewConversationAgent({
    text: '重新开始，帮我分析客户怎么推进',
    sessionId: first.sessionId,
    context: first.context,
    session: {
      context: first.context,
      messages: [
        { role: 'user', content: firstText },
        ...(first.messages || []).filter((message) => message.role === 'assistant'),
      ],
    },
    registry,
    skillRuntime: {
      async runGoal() {
        throw new Error('runtime should not reuse the previous task after an explicit restart');
      },
    },
  });

  assert.equal(first.kind, 'goal-run');
  assert.equal(second.kind, 'needs-input');
  assert.equal(second.status, 'waiting');
  assert.equal(second.taskTitle, '客户推进分析');
  assert.deepEqual(second.context.pendingTask.missing, ['客户名称或客户类型', '询盘、聊天记录或当前卡点']);
  assert.doesNotMatch(second.messages[0].content, /德国采购商|太阳能路灯|MOQ和交期/);
});

test('runNewConversationAgent ignores pending task facts when the user explicitly restarts from waiting state', async () => {
  const registry = createFollowupRegistry();
  const first = await runNewConversationAgent({
    text: '帮我分析这个客户怎么推进',
    registry,
  });
  const second = await runNewConversationAgent({
    text: '客户是德国采购商，产品是太阳能灯',
    sessionId: first.sessionId,
    context: first.context,
    registry,
  });
  let runtimeText = '';

  const third = await runNewConversationAgent({
    text: '重新开始，客户问价格太高，产品是家具，帮我分析客户怎么推进',
    sessionId: first.sessionId,
    context: second.context,
    registry,
    skillRuntime: {
      async runGoal({ text }) {
        runtimeText = text;
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'customer-followup-plan',
            reason: '用户重开后提供了新的客户推进背景。',
          },
          skill: {
            id: 'customer-followup-plan',
            displayName: '客户推进分析',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/客户推进分析.md',
            artifactName: '客户推进分析.md',
          },
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: '/tmp/客户推进分析.md',
          },
        };
      },
    },
  });

  assert.equal(first.kind, 'needs-input');
  assert.equal(second.kind, 'needs-input-followup');
  assert.equal(third.kind, 'goal-run');
  assert.equal(third.artifact.name, '客户推进分析.md');
  assert.match(runtimeText, /价格太高/);
  assert.match(runtimeText, /家具/);
  assert.doesNotMatch(runtimeText, /德国采购商|太阳能灯/);
  assert.equal(Object.hasOwn(third.context, 'pendingTask'), false);
});

test('runNewConversationAgent ignores pending confirmation when the user explicitly restarts with a new task', async () => {
  const registry = createEmailAndFollowupRegistry();
  const first = await runNewConversationAgent({
    text: '把这封开发信发给客户',
    registry,
  });
  const second = await runNewConversationAgent({
    text: '客户是德国采购商，产品是太阳能路灯',
    sessionId: first.sessionId,
    context: first.context,
    registry,
  });
  let runtimeText = '';

  const third = await runNewConversationAgent({
    text: '重新开始，客户问价格太高，产品是家具，帮我分析客户怎么推进',
    sessionId: first.sessionId,
    context: second.context,
    registry,
    skillRuntime: {
      async runGoal({ text }) {
        runtimeText = text;
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'customer-followup-plan',
            reason: '用户取消旧确认并重开客户推进任务。',
          },
          skill: {
            id: 'customer-followup-plan',
            displayName: '客户推进分析',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/客户推进分析.md',
            artifactName: '客户推进分析.md',
          },
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: '/tmp/客户推进分析.md',
          },
        };
      },
    },
  });

  assert.equal(first.kind, 'confirmation-required');
  assert.equal(second.kind, 'confirmation-required');
  assert.equal(third.kind, 'goal-run');
  assert.equal(third.artifact.name, '客户推进分析.md');
  assert.match(runtimeText, /价格太高/);
  assert.match(runtimeText, /家具/);
  assert.doesNotMatch(runtimeText, /德国采购商|太阳能路灯|开发信/);
  assert.equal(Object.hasOwn(third.context, 'pendingConfirmation'), false);
});

test('runNewConversationAgent keeps prior facts when the user says not to restart', async () => {
  const registry = createEmailAndFollowupRegistry();
  const firstText = '帮我准备一封跟进开发信，客户是德国采购商，产品太阳能路灯，重点问MOQ和交期';
  const first = await runNewConversationAgent({
    text: firstText,
    registry,
    skillRuntime: {
      async runGoal() {
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'cold-email-draft',
            reason: '用户要准备开发信草稿。',
          },
          skill: {
            id: 'cold-email-draft',
            displayName: '开发信草稿',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/开发信草稿.md',
            artifactName: '开发信草稿.md',
          },
          artifact: {
            type: 'markdown',
            name: '开发信草稿.md',
            outputPath: '/tmp/开发信草稿.md',
          },
        };
      },
    },
  });
  let runtimeText = '';

  const second = await runNewConversationAgent({
    text: '不要重新开始，再做一个客户下一步推进计划',
    sessionId: first.sessionId,
    context: first.context,
    session: {
      context: first.context,
      messages: [
        { role: 'user', content: firstText },
        ...(first.messages || []).filter((message) => message.role === 'assistant'),
      ],
    },
    registry,
    skillRuntime: {
      async runGoal({ text }) {
        runtimeText = text;
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'customer-followup-plan',
            reason: '用户明确要求不要重开,沿用当前线程事实。',
          },
          skill: {
            id: 'customer-followup-plan',
            displayName: '客户推进分析',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/客户推进分析.md',
            artifactName: '客户推进分析.md',
          },
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: '/tmp/客户推进分析.md',
          },
        };
      },
    },
  });

  assert.equal(first.kind, 'goal-run');
  assert.equal(second.kind, 'goal-run');
  assert.equal(second.artifact.name, '客户推进分析.md');
  assert.match(runtimeText, /德国采购商/);
  assert.match(runtimeText, /太阳能路灯/);
  assert.match(runtimeText, /MOQ和交期/);
});

test('runNewConversationAgent keeps waiting task context when the user adds one more sentence', async () => {
  const first = await runNewConversationAgent({
    text: '帮我分析这个客户怎么推进',
    registry: createTestRegistry(),
  });

  const second = await runNewConversationAgent({
    text: '客户是德国采购商，询盘里问了MOQ和交期',
    sessionId: first.sessionId,
    context: first.context,
    registry: createTestRegistry(),
  });

  assert.equal(second.ok, true);
  assert.equal(second.kind, 'needs-input-followup');
  assert.equal(second.sessionId, first.sessionId);
  assert.match(second.messages[0].content, /把这句补充并入/);
  assert.match(second.messages[0].content, /德国采购商/);
  assert.equal(second.context.pendingTask.originalText, '帮我分析这个客户怎么推进');
});

test('runNewConversationAgent resumes a waiting task when the supplement is enough to match a skill', async () => {
  const first = await runNewConversationAgent({
    text: '帮我处理一下',
    registry: createFollowupRegistry(),
  });
  const skillRuntime = {
    async runGoal({ text }) {
      assert.match(text, /帮我处理一下/);
      assert.match(text, /德国采购商/);
      assert.match(text, /下一步推进计划/);
      return {
        ok: true,
        runId: 'skill-runtime-20260629-130000-followup',
        runLogPath: '/tmp/followup.jsonl',
        goal: {
          matched: true,
          trigger: 'natural_goal',
          skillId: 'customer-followup-plan',
          reason: '用户要分析客户推进动作，匹配客户推进分析任务。',
        },
        skill: {
          id: 'customer-followup-plan',
          displayName: '客户推进分析',
          adapter: 'business-draft',
          artifactType: 'markdown',
        },
        plan: {
          title: '客户推进分析执行计划',
          steps: [{ id: 'write_plan', label: '生成材料', detail: '生成客户推进分析。' }],
        },
        result: {
          ok: true,
          mode: 'business-draft',
          runId: 'skill-runtime-20260629-130000-followup',
        },
        artifact: {
          type: 'markdown',
          name: '客户推进分析.md',
          outputPath: '/tmp/客户推进分析.md',
        },
        loop: {
          status: 'completed',
          steps: [
            { action: 'goal.classify', detail: '用户要分析客户推进动作，匹配客户推进分析任务。', observation: 'goal.matched', status: 'complete', nextAction: 'skill.match' },
            { action: 'skill.load', detail: '已读取 skill.json。', observation: 'skill.loaded', status: 'complete', nextAction: 'plan.create' },
            { action: 'plan.create', detail: '识别任务 → 核对资料 → 生成材料 → 检查结果', observation: 'plan.ready', status: 'complete', nextAction: 'action.execute' },
            { action: 'action.execute', detail: '已生成 客户推进分析.md。', observation: 'action.executed', status: 'complete', nextAction: 'artifact.verify' },
            { action: 'artifact.verify', detail: '产物已通过 Runtime 基础校验。', observation: 'artifact.ready', status: 'complete', nextAction: 'finish' },
          ],
        },
      };
    },
  };

  const second = await runNewConversationAgent({
    text: '客户是德国采购商，询盘问MOQ和交期，做下一步推进计划',
    sessionId: first.sessionId,
    context: first.context,
    registry: createFollowupRegistry(),
    skillRuntime,
  });

  assert.equal(first.kind, 'needs-input');
  assert.equal(second.ok, true);
  assert.equal(second.kind, 'goal-run');
  assert.equal(second.sessionId, first.sessionId);
  assert.equal(second.artifact.name, '客户推进分析.md');
  assert.equal(second.context.artifact.name, '客户推进分析.md');
});

test('runNewConversationAgent accumulates multiple waiting supplements before resuming', async () => {
  const first = await runNewConversationAgent({
    text: '帮我处理一下',
    registry: createFollowupRegistry(),
  });
  const second = await runNewConversationAgent({
    text: '客户是德国采购商',
    sessionId: first.sessionId,
    context: first.context,
    registry: createFollowupRegistry(),
  });
  const third = await runNewConversationAgent({
    text: '询盘问MOQ和交期',
    sessionId: first.sessionId,
    context: second.context,
    registry: createFollowupRegistry(),
  });

  const skillRuntime = {
    async runGoal({ text }) {
      assert.match(text, /帮我处理一下/);
      assert.match(text, /客户是德国采购商/);
      assert.match(text, /询盘问MOQ和交期/);
      assert.match(text, /做下一步推进计划/);
      return {
        ok: true,
        runId: 'skill-runtime-20260629-140000-multi',
        runLogPath: '/tmp/multi-followup.jsonl',
        goal: {
          matched: true,
          trigger: 'natural_goal',
          skillId: 'customer-followup-plan',
          reason: '用户多轮补充后,匹配客户推进分析任务。',
        },
        skill: {
          id: 'customer-followup-plan',
          displayName: '客户推进分析',
          adapter: 'business-draft',
          artifactType: 'markdown',
        },
        plan: {
          title: '客户推进分析执行计划',
          steps: [{ id: 'write_plan', label: '生成材料', detail: '生成客户推进分析。' }],
        },
        result: {
          ok: true,
          mode: 'business-draft',
          runId: 'skill-runtime-20260629-140000-multi',
        },
        artifact: {
          type: 'markdown',
          name: '客户推进分析.md',
          outputPath: '/tmp/客户推进分析.md',
        },
        loop: {
          status: 'completed',
          steps: [
            { action: 'goal.classify', detail: '用户要分析客户推进动作。', observation: 'goal.matched', status: 'complete', nextAction: 'skill.match' },
            { action: 'skill.load', detail: '已读取 skill.json。', observation: 'skill.loaded', status: 'complete', nextAction: 'plan.create' },
            { action: 'plan.create', detail: '识别任务 → 核对资料 → 生成材料 → 检查结果', observation: 'plan.ready', status: 'complete', nextAction: 'action.execute' },
            { action: 'action.execute', detail: '已生成 客户推进分析.md。', observation: 'action.executed', status: 'complete', nextAction: 'artifact.verify' },
            { action: 'artifact.verify', detail: '产物已通过 Runtime 基础校验。', observation: 'artifact.ready', status: 'complete', nextAction: 'finish' },
          ],
        },
      };
    },
  };

  const fourth = await runNewConversationAgent({
    text: '做下一步推进计划',
    sessionId: first.sessionId,
    context: third.context,
    registry: createFollowupRegistry(),
    skillRuntime,
  });

  assert.equal(first.kind, 'needs-input');
  assert.equal(second.kind, 'needs-input-followup');
  assert.equal(third.kind, 'needs-input-followup');
  assert.equal(fourth.kind, 'goal-run');
  assert.equal(fourth.sessionId, first.sessionId);
  assert.equal(fourth.artifact.name, '客户推进分析.md');
});

test('runNewConversationAgent stops and asks before risky external actions', async () => {
  const progressEvents = [];
  const response = await runNewConversationAgent({
    text: '把这封开发信发给客户',
    onRuntimeEvent: async (event) => {
      progressEvents.push(event.type);
    },
    registry: createTestRegistry(),
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'confirmation-required');
  assert.equal(response.status, 'waiting');
  assert.equal(response.taskTitle, '外发前需要你确认');
  assert.match(response.sessionId, /^agent-session-/);
  assert.deepEqual(response.progress.map((item) => item.label), ['识别任务', '核对权限', '等待确认']);
  assert.equal(response.context.pendingConfirmation.type, 'external_send');
  assert.match(response.messages[0].content, /先停一下/);
  assert.deepEqual(response.messages[0].process.steps.map((item) => item.label), ['识别任务', '核对权限', '等待确认']);
  assert.match(response.messages[0].confirmation.title, /外发前需要你确认/);
  assert.equal(response.messages[0].confirmation.confirmLabel, '先生成草稿');
  assert.deepEqual(progressEvents, ['goal.received', 'policy.checked', 'run.waiting']);
});

test('runNewConversationAgent treats sending to a described customer as an external action', async () => {
  const response = await runNewConversationAgent({
    text: '帮我写一封邮件发给德国客户，产品太阳能路灯，问MOQ和交期',
    registry: createEmailRegistry(),
    skillRuntime: {
      async runGoal() {
        throw new Error('runtime should not generate a draft before external sending is confirmed');
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'confirmation-required');
  assert.equal(response.status, 'waiting');
  assert.equal(response.taskTitle, '外发前需要你确认');
  assert.equal(response.context.pendingConfirmation.type, 'external_send');
  assert.match(response.messages[0].confirmation.title, /外发前需要你确认/);
  assert.equal(response.messages[0].confirmation.confirmLabel, '先生成草稿');
});

test('runNewConversationAgent treats channel script versions as current artifact follow-up, not external send', async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-channel-script-followup-'));
  const artifactDir = path.join(projectRoot, 'workbench', 'artifacts', 'run-1');
  const artifactPath = path.join(artifactDir, '客户推进分析.md');

  try {
    await mkdir(artifactDir, { recursive: true });
    await writeFile(
      artifactPath,
      [
        '# 客户推进分析',
        '',
        '## 依据',
        '',
        '- 产品: 家具',
        '- 客户关注点: 客户沉默/未回复',
        '',
        '## 7天跟进节奏',
        '',
        '- 第1天: 发一条轻量提醒。',
        '- 第3天: 换一个触达理由。',
      ].join('\n'),
      'utf8',
    );

    const response = await runNewConversationAgent({
      text: '把第1天/第3天话术写成英文 WhatsApp 和邮件两版',
      sessionId: 'agent-session-20260630T155500-channel-followup',
      context: {
        artifact: {
          type: 'markdown',
          name: '客户推进分析.md',
          outputPath: artifactPath,
        },
      },
      session: {
        context: {
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: artifactPath,
          },
        },
      },
      registry: createEmailAndFollowupRegistry(),
      projectRoot,
    });
    const updated = await readFile(artifactPath, 'utf8');

    assert.equal(response.ok, true);
    assert.equal(response.kind, 'followup');
    assert.equal(response.status, 'completed');
    assert.equal(response.context.pendingConfirmation, undefined);
    assert.equal(response.artifact.name, '客户推进分析.md');
    assert.match(updated, /Day 1 WhatsApp/);
    assert.match(updated, /Day 1 Email/);
    assert.match(updated, /Day 3 WhatsApp/);
    assert.match(updated, /Day 3 Email/);
    assert.match(updated, /Subject:/);
    assert.match(updated, /furniture/i);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('runNewConversationAgent still asks before sending drafted channel script versions', async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-channel-script-send-confirm-'));
  const artifactDir = path.join(projectRoot, 'workbench', 'artifacts', 'run-1');
  const artifactPath = path.join(artifactDir, '客户推进分析.md');
  const originalContent = [
    '# 客户推进分析',
    '',
    '## 依据',
    '',
    '- 产品: 家具',
    '- 客户关注点: 客户沉默/未回复',
    '',
    '## 7天跟进节奏',
    '',
    '- 第1天: 发一条轻量提醒。',
    '- 第3天: 换一个触达理由。',
  ].join('\n');
  const cases = [
    '把第1天/第3天话术写成英文 WhatsApp 和邮件两版，然后发送',
    '把第1天/第3天话术写成英文 WhatsApp 和邮件两版，然后发客户',
    '把第1天/第3天话术写成英文 WhatsApp 和邮件两版，send it',
    '把第1天/第3天话术写成英文 WhatsApp 和邮件两版，send now',
  ];

  try {
    await mkdir(artifactDir, { recursive: true });

    for (const [index, text] of cases.entries()) {
      await writeFile(artifactPath, originalContent, 'utf8');

      const response = await runNewConversationAgent({
        text,
        sessionId: `agent-session-20260630T162000-channel-send-${index}`,
        context: {
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: artifactPath,
          },
        },
        session: {
          context: {
            artifact: {
              type: 'markdown',
              name: '客户推进分析.md',
              outputPath: artifactPath,
            },
          },
        },
        registry: createEmailAndFollowupRegistry(),
        projectRoot,
      });
      const currentContent = await readFile(artifactPath, 'utf8');

      assert.equal(response.ok, true);
      assert.equal(response.kind, 'confirmation-required');
      assert.equal(response.status, 'waiting');
      assert.equal(response.context.pendingConfirmation.type, 'external_send');
      assert.equal(response.messages[0].confirmation.title, '外发前需要你确认');
      assert.equal(response.messages[0].confirmation.confirmLabel, '先生成草稿');
      assert.equal(currentContent, originalContent);
    }
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('runNewConversationAgent resumes current artifact after confirming draft-only channel scripts', async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-channel-script-confirm-resume-'));
  const artifactDir = path.join(projectRoot, 'workbench', 'artifacts', 'run-1');
  const artifactPath = path.join(artifactDir, '客户推进分析.md');
  const sessionId = 'agent-session-20260630T170000-channel-confirm-resume';
  const artifactContext = {
    type: 'markdown',
    name: '客户推进分析.md',
    outputPath: artifactPath,
  };

  try {
    await mkdir(artifactDir, { recursive: true });
    await writeFile(
      artifactPath,
      [
        '# 客户推进分析',
        '',
        '## 依据',
        '',
        '- 产品: 家具',
        '- 客户关注点: 客户沉默/未回复',
        '',
        '## 7天跟进节奏',
        '',
        '- 第1天: 发一条轻量提醒。',
      ].join('\n'),
      'utf8',
    );

    const first = await runNewConversationAgent({
      text: '把第1天话术写成英文 WhatsApp 和邮件两版，然后发送',
      sessionId,
      context: { artifact: artifactContext },
      session: { context: { artifact: artifactContext } },
      registry: createEmailAndFollowupRegistry(),
      projectRoot,
    });
    const afterWaiting = await readFile(artifactPath, 'utf8');

    const second = await runNewConversationAgent({
      text: '先生成草稿',
      sessionId,
      context: first.context,
      session: {
        context: first.context,
        kind: first.kind,
        messages: first.messages,
        skillAgentResult: {
          taskTitle: '客户推进分析',
        },
        taskTitle: first.taskTitle,
      },
      registry: createEmailAndFollowupRegistry(),
      projectRoot,
    });
    const updated = await readFile(artifactPath, 'utf8');

    assert.equal(first.ok, true);
    assert.equal(first.kind, 'confirmation-required');
    assert.equal(first.status, 'waiting');
    assert.equal(first.context.pendingConfirmation.type, 'external_send');
    assert.equal(afterWaiting.includes('Day 1 WhatsApp'), false);

    assert.equal(second.ok, true);
    assert.equal(second.kind, 'confirmation-accepted');
    assert.equal(second.status, 'completed');
    assert.equal(second.taskTitle, '客户推进分析');
    assert.equal(second.context.pendingConfirmation, undefined);
    assert.equal(second.artifact.name, '客户推进分析.md');
    assert.match(second.messages[0].content, /不会自动外发/);
    assert.match(updated, /Day 1 WhatsApp/);
    assert.match(updated, /Day 1 Email/);
    assert.match(updated, /furniture/i);
    assert.match(updated, /外发前仍需确认/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('runNewConversationAgent does not treat customer development wording as sending drafted channel scripts', async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-channel-script-customer-development-'));
  const artifactDir = path.join(projectRoot, 'workbench', 'artifacts', 'run-1');
  const artifactPath = path.join(artifactDir, '客户推进分析.md');

  try {
    await mkdir(artifactDir, { recursive: true });
    await writeFile(
      artifactPath,
      [
        '# 客户推进分析',
        '',
        '## 依据',
        '',
        '- 产品: 家具',
        '- 客户关注点: 客户沉默/未回复',
        '',
        '## 7天跟进节奏',
        '',
        '- 第1天: 发一条轻量提醒。',
      ].join('\n'),
      'utf8',
    );

    const response = await runNewConversationAgent({
      text: '把第1天话术写成英文 WhatsApp 和邮件两版，用于开发客户',
      sessionId: 'agent-session-20260630T163000-channel-development',
      context: {
        artifact: {
          type: 'markdown',
          name: '客户推进分析.md',
          outputPath: artifactPath,
        },
      },
      session: {
        context: {
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: artifactPath,
          },
        },
      },
      registry: createEmailAndFollowupRegistry(),
      projectRoot,
    });
    const updated = await readFile(artifactPath, 'utf8');

    assert.equal(response.ok, true);
    assert.equal(response.kind, 'followup');
    assert.equal(response.status, 'completed');
    assert.equal(response.context.pendingConfirmation, undefined);
    assert.match(updated, /Day 1 WhatsApp/);
    assert.match(updated, /Day 1 Email/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('runNewConversationAgent stops and asks before natural paid actions', async () => {
  const cases = [
    '调用付费数据帮我找客户，扣费也可以',
    '用收费接口查一下客户，花钱也可以',
    '消耗额度也行，帮我查这个客户',
    '调用会消耗积分的工具找客户',
  ];

  for (const [index, text] of cases.entries()) {
    const progressEvents = [];
    const response = await runNewConversationAgent({
      text,
      sessionId: `agent-session-20260630T120000-paid-${index}`,
      onRuntimeEvent: async (event) => {
        progressEvents.push(event.type);
      },
      registry: createTestRegistry(),
      skillRuntime: {
        async runGoal() {
          throw new Error('runtime should not run before paid action is confirmed');
        },
      },
    });

    assert.equal(response.ok, true);
    assert.equal(response.kind, 'confirmation-required');
    assert.equal(response.status, 'waiting');
    assert.equal(response.taskTitle, '付费能力需要你确认');
    assert.equal(response.context.pendingConfirmation.type, 'paid_call');
    assert.match(response.messages[0].confirmation.title, /付费能力需要你确认/);
    assert.equal(response.messages[0].confirmation.confirmLabel, '确认继续');
    assert.deepEqual(response.progress.map((item) => item.label), ['识别任务', '核对权限', '等待确认']);
    assert.deepEqual(progressEvents, ['goal.received', 'policy.checked', 'run.waiting']);
  }
});

test('runNewConversationAgent does not treat customer purchase intent as a paid platform action', async () => {
  const response = await runNewConversationAgent({
    text: '客户说想购买500套太阳能灯，帮我做下一步推进计划',
    registry: createFollowupRegistry(),
    skillRuntime: {
      async runGoal() {
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'customer-followup-plan',
            reason: '用户要分析客户采购意向后的推进动作。',
          },
          skill: {
            id: 'customer-followup-plan',
            displayName: '客户推进分析',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/客户推进分析.md',
            artifactName: '客户推进分析.md',
          },
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: '/tmp/客户推进分析.md',
          },
        };
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'goal-run');
  assert.equal(response.taskTitle, '客户推进分析');
  assert.equal(response.context.pendingConfirmation, undefined);
  assert.equal(response.artifact.name, '客户推进分析.md');
});

test('runNewConversationAgent continues the original business task after paid action confirmation', async () => {
  const first = await runNewConversationAgent({
    text: '客户是德国采购商，询盘问MOQ和交期，产品太阳能灯，调用收费接口也可以，做下一步推进计划',
    registry: createFollowupRegistry(),
    skillRuntime: {
      async runGoal() {
        throw new Error('runtime should not run before paid action confirmation');
      },
    },
  });
  let runtimeText = '';
  const second = await runNewConversationAgent({
    text: '确认继续',
    sessionId: first.sessionId,
    context: first.context,
    registry: createFollowupRegistry(),
    skillRuntime: {
      async runGoal({ text }) {
        runtimeText = text;
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'customer-followup-plan',
            reason: '用户确认后继续客户推进分析任务。',
          },
          skill: {
            id: 'customer-followup-plan',
            displayName: '客户推进分析',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/客户推进分析.md',
            artifactName: '客户推进分析.md',
          },
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: '/tmp/客户推进分析.md',
          },
        };
      },
    },
  });

  assert.equal(first.kind, 'confirmation-required');
  assert.equal(first.context.pendingConfirmation.type, 'paid_call');
  assert.equal(second.kind, 'confirmation-accepted');
  assert.equal(second.taskTitle, '客户推进分析');
  assert.equal(second.artifact.name, '客户推进分析.md');
  assert.equal(Object.hasOwn(second.context, 'pendingConfirmation'), false);
  assert.match(runtimeText, /客户是德国采购商/);
  assert.match(runtimeText, /询盘问MOQ和交期/);
  assert.match(runtimeText, /产品太阳能灯/);
});

test('runNewConversationAgent records supplements while still waiting for risky confirmation', async () => {
  const first = await runNewConversationAgent({
    text: '把这封开发信发给客户',
    registry: createTestRegistry(),
  });
  const second = await runNewConversationAgent({
    text: '客户是德国采购商，产品是太阳能路灯，重点问MOQ和交期',
    sessionId: first.sessionId,
    context: first.context,
    registry: createTestRegistry(),
    skillRuntime: {
      async runGoal() {
        throw new Error('runtime should not run before the risky action is confirmed');
      },
    },
  });
  const skillRuntime = {
    async runGoal({ text }) {
      assert.match(text, /把这封开发信发给客户/);
      assert.match(text, /德国采购商/);
      assert.match(text, /太阳能路灯/);
      assert.match(text, /MOQ/);
      return {
        ok: true,
        runId: 'skill-runtime-20260629-150000-confirm-supplement',
        runLogPath: '/tmp/confirm-supplement.jsonl',
        goal: {
          matched: true,
          trigger: 'natural_goal',
          skillId: 'cold-email-draft',
          reason: '用户确认后只生成可检查开发信草稿。',
        },
        skill: {
          id: 'cold-email-draft',
          displayName: '开发信草稿',
          adapter: 'business-draft',
          artifactType: 'markdown',
        },
        plan: {
          title: '开发信草稿执行计划',
          steps: [{ id: 'write_draft', label: '生成材料', detail: '生成开发信草稿。' }],
        },
        result: {
          ok: true,
          mode: 'business-draft',
          runId: 'skill-runtime-20260629-150000-confirm-supplement',
        },
        artifact: {
          type: 'markdown',
          name: '开发信草稿.md',
          outputPath: '/tmp/开发信草稿.md',
        },
        loop: {
          status: 'completed',
          steps: [
            { action: 'goal.classify', detail: '用户要准备开发信草稿。', observation: 'goal.matched', status: 'complete', nextAction: 'skill.match' },
            { action: 'skill.load', detail: '已读取 skill.json。', observation: 'skill.loaded', status: 'complete', nextAction: 'plan.create' },
            { action: 'plan.create', detail: '识别任务 → 核对资料 → 生成材料 → 检查结果', observation: 'plan.ready', status: 'complete', nextAction: 'action.execute' },
            { action: 'action.execute', detail: '已生成 开发信草稿.md。', observation: 'action.executed', status: 'complete', nextAction: 'artifact.verify' },
            { action: 'artifact.verify', detail: '产物已通过 Runtime 基础校验。', observation: 'artifact.ready', status: 'complete', nextAction: 'finish' },
          ],
        },
      };
    },
  };
  const third = await runNewConversationAgent({
    text: '先生成草稿',
    sessionId: first.sessionId,
    context: second.context,
    registry: createEmailRegistry(),
    skillRuntime,
  });

  assert.equal(first.kind, 'confirmation-required');
  assert.equal(second.kind, 'confirmation-required');
  assert.equal(second.status, 'waiting');
  assert.equal(second.context.pendingConfirmation.type, 'external_send');
  assert.deepEqual(second.context.pendingConfirmation.supplements, ['客户是德国采购商，产品是太阳能路灯，重点问MOQ和交期']);
  assert.match(second.messages[0].content, /已记录这句补充/);
  assert.equal(second.messages[0].confirmation.confirmLabel, '先生成草稿');
  assert.equal(third.kind, 'confirmation-accepted');
  assert.equal(third.artifact.name, '开发信草稿.md');
});

test('runNewConversationAgent asks what to export when no current artifact exists', async () => {
  const response = await runNewConversationAgent({
    text: '导出文件',
    registry: createTestRegistry(),
    skillRuntime: {
      async runGoal() {
        throw new Error('runtime should not run when export has no current artifact');
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'needs-input');
  assert.equal(response.status, 'waiting');
  assert.equal(response.context.pendingConfirmation, undefined);
  assert.equal(response.artifact, undefined);
  assert.match(response.messages[0].content, /还没有可导出的业务产物/);
  assert.match(response.messages[0].content, /先生成/);
  assert.deepEqual(response.messages[0].process.steps.map((item) => item.label), ['识别任务', '核对资料', '等待补充']);
});

test('runNewConversationAgent treats download file as export intent when no artifact exists', async () => {
  const response = await runNewConversationAgent({
    text: '下载文件',
    registry: createTestRegistry(),
    skillRuntime: {
      async runGoal() {
        throw new Error('runtime should not run when download has no current artifact');
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'needs-input');
  assert.equal(response.status, 'waiting');
  assert.equal(response.context.pendingConfirmation, undefined);
  assert.equal(response.artifact, undefined);
  assert.deepEqual(response.messages[0].needsInput.items, ['还没有可导出的业务产物', '请先生成或选择要导出的文件']);
});

test('runNewConversationAgent asks what to save when no current artifact exists', async () => {
  const response = await runNewConversationAgent({
    text: '保存到客户档案',
    registry: createTestRegistry(),
    skillRuntime: {
      async runGoal() {
        throw new Error('runtime should not run when save has no current artifact');
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'needs-input');
  assert.equal(response.status, 'waiting');
  assert.equal(response.context.pendingConfirmation, undefined);
  assert.equal(response.artifact, undefined);
  assert.match(response.messages[0].content, /还没有可保存到客户档案的业务产物/);
  assert.match(response.messages[0].content, /先生成/);
  assert.deepEqual(response.messages[0].process.steps.map((item) => item.label), ['识别任务', '核对资料', '等待补充']);
});

test('runNewConversationAgent treats casual save as customer memory intent when no artifact exists', async () => {
  const response = await runNewConversationAgent({
    text: '保存一下',
    registry: createTestRegistry(),
    skillRuntime: {
      async runGoal() {
        throw new Error('runtime should not run when casual save has no current artifact');
      },
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.kind, 'needs-input');
  assert.equal(response.status, 'waiting');
  assert.equal(response.context.pendingConfirmation, undefined);
  assert.equal(response.artifact, undefined);
  assert.deepEqual(response.messages[0].needsInput.items, ['还没有可保存到客户档案的业务产物', '请先生成客户分析、跟进计划或邮件草稿']);
});

test('runNewConversationAgent exports the current artifact only after confirmation', async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-export-confirm-'));
  const artifactDir = path.join(projectRoot, 'workbench', 'artifacts', 'run-1');
  const artifactPath = path.join(artifactDir, '客户推进分析.md');

  try {
    await mkdir(artifactDir, { recursive: true });
    await writeFile(artifactPath, '# 客户推进分析\n\n下一步跟进计划。\n', 'utf8');

    const first = await runNewConversationAgent({
      text: '导出文件',
      sessionId: 'agent-session-20260629T151500-export',
      context: {
        artifact: {
          type: 'markdown',
          name: '客户推进分析.md',
          outputPath: artifactPath,
        },
      },
      registry: createTestRegistry(),
      projectRoot,
    });

    const second = await runNewConversationAgent({
      text: '确认导出',
      sessionId: first.sessionId,
      context: first.context,
      session: {
        sessionId: first.sessionId,
        taskTitle: '客户推进分析',
        skillAgentResult: {
          taskTitle: '客户推进分析',
        },
        context: {
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: artifactPath,
          },
        },
      },
      registry: createTestRegistry(),
      projectRoot,
    });
    const exportedContent = await readFile(second.artifact.outputPath, 'utf8');

    assert.equal(first.kind, 'confirmation-required');
    assert.equal(first.context.pendingConfirmation.type, 'export_file');
    assert.equal(second.ok, true);
    assert.equal(second.kind, 'confirmation-accepted');
    assert.equal(second.artifact.name, '客户推进分析.md');
    assert.match(second.artifact.outputPath, /workbench\/exports\/agent-session-20260629T151500-export/);
    assert.equal(exportedContent, '# 客户推进分析\n\n下一步跟进计划。\n');
    assert.match(second.messages[0].content, /已确认导出/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('runNewConversationAgent asks before downloading the current artifact', async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-download-confirm-'));
  const artifactDir = path.join(projectRoot, 'workbench', 'artifacts', 'run-1');
  const artifactPath = path.join(artifactDir, '客户推进分析.md');

  try {
    await mkdir(artifactDir, { recursive: true });
    await writeFile(artifactPath, '# 客户推进分析\n\n下一步跟进计划。\n', 'utf8');

    const response = await runNewConversationAgent({
      text: '下载文件',
      sessionId: 'agent-session-20260630T101500-download',
      context: {
        artifact: {
          type: 'markdown',
          name: '客户推进分析.md',
          outputPath: artifactPath,
        },
      },
      registry: createTestRegistry(),
      projectRoot,
    });

    assert.equal(response.ok, true);
    assert.equal(response.kind, 'confirmation-required');
    assert.equal(response.status, 'waiting');
    assert.equal(response.context.pendingConfirmation.type, 'export_file');
    assert.equal(response.messages[0].confirmation.title, '导出文件前需要确认');
    assert.equal(response.messages[0].confirmation.confirmLabel, '确认导出');
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('runNewConversationAgent treats save-to-desktop wording as export before customer memory save', async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-save-to-desktop-confirm-'));
  const artifactDir = path.join(projectRoot, 'workbench', 'artifacts', 'run-1');
  const artifactPath = path.join(artifactDir, '客户推进分析.md');
  const cases = ['保存一下到桌面', '保存一下并下载文件', '保存当前文件到桌面'];

  try {
    await mkdir(artifactDir, { recursive: true });
    await writeFile(artifactPath, '# 客户推进分析\n\n下一步跟进计划。\n', 'utf8');

    for (const [index, text] of cases.entries()) {
      const response = await runNewConversationAgent({
        text,
        sessionId: `agent-session-20260630T104000-save-desktop-${index}`,
        context: {
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: artifactPath,
          },
        },
        registry: createTestRegistry(),
        projectRoot,
      });

      assert.equal(response.ok, true);
      assert.equal(response.kind, 'confirmation-required');
      assert.equal(response.status, 'waiting');
      assert.equal(response.context.pendingConfirmation.type, 'export_file');
      assert.equal(response.messages[0].confirmation.title, '导出文件前需要确认');
    }
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('runNewConversationAgent does not treat a follow-up edit as export confirmation', async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-export-not-confirm-'));
  const artifactDir = path.join(projectRoot, 'workbench', 'artifacts', 'run-1');
  const artifactPath = path.join(artifactDir, '开发信草稿.md');

  try {
    await mkdir(artifactDir, { recursive: true });
    await writeFile(artifactPath, '# 开发信草稿\n\nCould you confirm your MOQ and lead time?\n', 'utf8');

    const first = await runNewConversationAgent({
      text: '导出文件',
      sessionId: 'agent-session-20260629T151700-export-nope',
      context: {
        artifact: {
          type: 'markdown',
          name: '开发信草稿.md',
          outputPath: artifactPath,
        },
      },
      registry: createTestRegistry(),
      projectRoot,
    });
    const second = await runNewConversationAgent({
      text: '继续优化一下，语气更礼貌',
      sessionId: first.sessionId,
      context: first.context,
      session: {
        context: {
          artifact: {
            type: 'markdown',
            name: '开发信草稿.md',
            outputPath: artifactPath,
          },
        },
      },
      registry: createTestRegistry(),
      projectRoot,
    });
    const updated = await readFile(artifactPath, 'utf8');

    assert.equal(first.kind, 'confirmation-required');
    assert.equal(first.context.pendingConfirmation.type, 'export_file');
    assert.equal(second.kind, 'followup');
    assert.equal(second.artifact.outputPath, artifactPath);
    assert.equal(Object.hasOwn(second.context, 'pendingConfirmation'), false);
    assert.match(updated, /本次补充优化/);
    await assert.rejects(
      () => readFile(path.join(projectRoot, 'workbench', 'exports', first.sessionId, '开发信草稿.md'), 'utf8'),
      (error) => error.code === 'ENOENT',
    );
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('runNewConversationAgent keeps the current artifact after cancelling an export confirmation', async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-export-cancel-'));
  const artifactDir = path.join(projectRoot, 'workbench', 'artifacts', 'run-1');
  const artifactPath = path.join(artifactDir, '开发信草稿.md');

  try {
    await mkdir(artifactDir, { recursive: true });
    await writeFile(artifactPath, '# 开发信草稿\n\nCould you confirm your MOQ and lead time?\n', 'utf8');

    const first = await runNewConversationAgent({
      text: '导出文件',
      sessionId: 'agent-session-20260629T151900-export-cancel',
      context: {
        artifact: {
          type: 'markdown',
          name: '开发信草稿.md',
          outputPath: artifactPath,
        },
      },
      registry: createTestRegistry(),
      projectRoot,
    });
    const second = await runNewConversationAgent({
      text: '取消这一步',
      sessionId: first.sessionId,
      context: first.context,
      session: { context: first.context },
      registry: createTestRegistry(),
      projectRoot,
    });
    const third = await runNewConversationAgent({
      text: '继续优化一下，语气更礼貌',
      sessionId: second.sessionId,
      context: second.context,
      session: { context: second.context },
      registry: createTestRegistry(),
      projectRoot,
    });
    const updated = await readFile(artifactPath, 'utf8');

    assert.equal(first.kind, 'confirmation-required');
    assert.equal(second.kind, 'confirmation-cancelled');
    assert.equal(second.status, 'waiting');
    assert.equal(second.context.artifact.outputPath, artifactPath);
    assert.equal(Object.hasOwn(second.context, 'pendingConfirmation'), false);
    assert.equal(third.kind, 'followup');
    assert.equal(third.artifact.outputPath, artifactPath);
    assert.match(updated, /本次补充优化/);
    await assert.rejects(
      () => readFile(path.join(projectRoot, 'workbench', 'exports', first.sessionId, '开发信草稿.md'), 'utf8'),
      (error) => error.code === 'ENOENT',
    );
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('runNewConversationAgent saves current artifact summary to customer memory after confirmation', async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-save-confirm-'));
  const artifactDir = path.join(projectRoot, 'workbench', 'artifacts', 'run-1');
  const customerDir = path.join(projectRoot, 'workbench', 'customers', 'global-sourcing-inc');
  const artifactPath = path.join(artifactDir, '客户推进分析.md');
  const memoryPath = path.join(customerDir, 'memory.md');

  try {
    await mkdir(artifactDir, { recursive: true });
    await mkdir(customerDir, { recursive: true });
    await writeFile(memoryPath, '# Global Sourcing Inc. Memory\n\n- Existing memory.\n', 'utf8');
    await writeFile(artifactPath, '# 客户推进分析\n\n## 下一步跟进行动\n\n1. 先确认MOQ和交期。\n', 'utf8');

    const first = await runNewConversationAgent({
      text: '保存到客户档案',
      sessionId: 'agent-session-20260629T161500-save',
      context: {
        artifact: {
          type: 'markdown',
          name: '客户推进分析.md',
          outputPath: artifactPath,
        },
      },
      registry: createTestRegistry(),
      projectRoot,
    });

    const second = await runNewConversationAgent({
      text: '确认写入',
      sessionId: first.sessionId,
      context: first.context,
      session: {
        sessionId: first.sessionId,
        context: {
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: artifactPath,
          },
        },
      },
      registry: createTestRegistry(),
      projectRoot,
    });
    const memory = await readFile(memoryPath, 'utf8');

    assert.equal(first.kind, 'confirmation-required');
    assert.equal(first.context.pendingConfirmation.type, 'customer_write');
    assert.equal(second.ok, true);
    assert.equal(second.kind, 'confirmation-accepted');
    assert.equal(second.taskTitle, '客户推进分析');
    assert.equal(second.artifact.name, '客户推进分析.md');
    assert.equal(second.context.customerSlug, 'global-sourcing-inc');
    assert.equal(Object.hasOwn(second.context, 'pendingConfirmation'), false);
    assert.equal(second.context.artifact.name, '客户推进分析.md');
    assert.equal(second.messages[0].artifact.name, '客户推进分析.md');
    assert.match(second.messages[0].content, /已确认保存/);
    assert.match(memory, /Agent 保存: 客户推进分析/);
    assert.match(memory, /先确认MOQ和交期/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('runNewConversationAgent asks before casually saving the current artifact', async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-casual-save-confirm-'));
  const artifactDir = path.join(projectRoot, 'workbench', 'artifacts', 'run-1');
  const artifactPath = path.join(artifactDir, '客户推进分析.md');

  try {
    await mkdir(artifactDir, { recursive: true });
    await writeFile(artifactPath, '# 客户推进分析\n\n下一步跟进计划。\n', 'utf8');

    const response = await runNewConversationAgent({
      text: '保存一下',
      sessionId: 'agent-session-20260630T103000-casual-save',
      context: {
        artifact: {
          type: 'markdown',
          name: '客户推进分析.md',
          outputPath: artifactPath,
        },
      },
      registry: createTestRegistry(),
      projectRoot,
    });

    assert.equal(response.ok, true);
    assert.equal(response.kind, 'confirmation-required');
    assert.equal(response.status, 'waiting');
    assert.equal(response.context.pendingConfirmation.type, 'customer_write');
    assert.equal(response.messages[0].confirmation.title, '写入客户档案前需要确认');
    assert.equal(response.messages[0].confirmation.confirmLabel, '确认写入');
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('runNewConversationAgent keeps save-current-file wording as customer memory save', async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-save-current-file-confirm-'));
  const artifactDir = path.join(projectRoot, 'workbench', 'artifacts', 'run-1');
  const artifactPath = path.join(artifactDir, '客户推进分析.md');

  try {
    await mkdir(artifactDir, { recursive: true });
    await writeFile(artifactPath, '# 客户推进分析\n\n下一步跟进计划。\n', 'utf8');

    const response = await runNewConversationAgent({
      text: '保存当前文件',
      sessionId: 'agent-session-20260630T104500-save-current-file',
      context: {
        artifact: {
          type: 'markdown',
          name: '客户推进分析.md',
          outputPath: artifactPath,
        },
      },
      registry: createTestRegistry(),
      projectRoot,
    });

    assert.equal(response.ok, true);
    assert.equal(response.kind, 'confirmation-required');
    assert.equal(response.status, 'waiting');
    assert.equal(response.context.pendingConfirmation.type, 'customer_write');
    assert.equal(response.messages[0].confirmation.title, '写入客户档案前需要确认');
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('runNewConversationAgent keeps save-current wording as customer memory save', async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-save-current-confirm-'));
  const artifactDir = path.join(projectRoot, 'workbench', 'artifacts', 'run-1');
  const artifactPath = path.join(artifactDir, '客户推进分析.md');

  try {
    await mkdir(artifactDir, { recursive: true });
    await writeFile(artifactPath, '# 客户推进分析\n\n下一步跟进计划。\n', 'utf8');

    const response = await runNewConversationAgent({
      text: '保存当前',
      sessionId: 'agent-session-20260630T104700-save-current',
      context: {
        artifact: {
          type: 'markdown',
          name: '客户推进分析.md',
          outputPath: artifactPath,
        },
      },
      registry: createTestRegistry(),
      projectRoot,
    });

    assert.equal(response.ok, true);
    assert.equal(response.kind, 'confirmation-required');
    assert.equal(response.status, 'waiting');
    assert.equal(response.context.pendingConfirmation.type, 'customer_write');
    assert.equal(response.messages[0].confirmation.title, '写入客户档案前需要确认');
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('runNewConversationAgent does not treat a follow-up edit as customer memory confirmation', async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-save-not-confirm-'));
  const artifactDir = path.join(projectRoot, 'workbench', 'artifacts', 'run-1');
  const customerDir = path.join(projectRoot, 'workbench', 'customers', 'global-sourcing-inc');
  const artifactPath = path.join(artifactDir, '客户推进分析.md');
  const memoryPath = path.join(customerDir, 'memory.md');

  try {
    await mkdir(artifactDir, { recursive: true });
    await mkdir(customerDir, { recursive: true });
    await writeFile(memoryPath, '# Global Sourcing Inc. Memory\n\n- Existing memory.\n', 'utf8');
    await writeFile(artifactPath, '# 客户推进分析\n\n先确认 MOQ 和交期。\n', 'utf8');

    const first = await runNewConversationAgent({
      text: '保存到客户档案',
      sessionId: 'agent-session-20260629T161700-save-nope',
      context: {
        artifact: {
          type: 'markdown',
          name: '客户推进分析.md',
          outputPath: artifactPath,
        },
      },
      registry: createTestRegistry(),
      projectRoot,
    });
    const second = await runNewConversationAgent({
      text: '继续优化一下下一步动作',
      sessionId: first.sessionId,
      context: first.context,
      session: {
        context: {
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: artifactPath,
          },
        },
      },
      registry: createTestRegistry(),
      projectRoot,
    });
    const memory = await readFile(memoryPath, 'utf8');
    const updated = await readFile(artifactPath, 'utf8');

    assert.equal(first.kind, 'confirmation-required');
    assert.equal(first.context.pendingConfirmation.type, 'customer_write');
    assert.equal(second.kind, 'followup');
    assert.equal(Object.hasOwn(second.context, 'pendingConfirmation'), false);
    assert.doesNotMatch(memory, /Agent 保存/);
    assert.match(updated, /本次补充优化/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('runNewConversationAgent surfaces Runtime policy ask and resumes the checkpoint after confirmation', async () => {
  let resumeCalled = false;
  const skillRuntime = {
    async runGoal() {
      return {
        ok: true,
        runId: 'skill-runtime-20260629-170000-policy',
        runLogPath: '/tmp/runtime-policy.jsonl',
        goal: {
          matched: true,
          trigger: 'natural_goal',
          skillId: 'customer-followup-plan',
          reason: '用户要分析客户推进动作，匹配客户推进分析任务。',
        },
        skill: {
          id: 'customer-followup-plan',
          displayName: '客户推进分析',
          adapter: 'business-draft',
          artifactType: 'markdown',
        },
        plan: {
          title: '客户推进分析执行计划',
          steps: [{ id: 'write_plan', label: '生成材料', detail: '生成客户推进分析。' }],
        },
        waiting: {
          action: 'paid_api.call',
          checkpointPath: '/tmp/runtime-policy.checkpoint.json',
          reason: '付费 API 调用需用户确认',
          resumeFrom: 'policy:paid_api.call',
          runId: 'skill-runtime-20260629-170000-policy',
        },
        loop: {
          status: 'waiting',
          steps: [
            { action: 'goal.classify', detail: '用户要分析客户推进动作，匹配客户推进分析任务。', observation: 'goal.matched', status: 'complete', nextAction: 'skill.match' },
            { action: 'skill.load', detail: '已读取 skill.json。', observation: 'skill.loaded', status: 'complete', nextAction: 'plan.create' },
            { action: 'plan.create', detail: '识别任务 → 核对资料 → 生成材料 → 检查结果', observation: 'plan.ready', status: 'complete', nextAction: 'policy.confirm' },
            { action: 'policy.confirm', detail: '付费 API 调用需用户确认', observation: 'policy.ask', status: 'waiting', nextAction: 'resume_run' },
          ],
        },
      };
    },
    async resumeGoal({ runId }) {
      resumeCalled = true;
      assert.equal(runId, 'skill-runtime-20260629-170000-policy');
      return {
        ok: true,
        runId,
        runLogPath: '/tmp/runtime-policy.jsonl',
        goal: {
          matched: true,
          trigger: 'natural_goal',
          skillId: 'customer-followup-plan',
          reason: '用户要分析客户推进动作，匹配客户推进分析任务。',
        },
        skill: {
          id: 'customer-followup-plan',
          displayName: '客户推进分析',
          adapter: 'business-draft',
          artifactType: 'markdown',
        },
        plan: {
          title: '客户推进分析执行计划',
          steps: [{ id: 'write_plan', label: '生成材料', detail: '生成客户推进分析。' }],
        },
        result: {
          ok: true,
          mode: 'business-draft',
          runId,
        },
        artifact: {
          type: 'markdown',
          name: '客户推进分析.md',
          outputPath: '/tmp/客户推进分析.md',
        },
        loop: {
          status: 'completed',
          steps: [
            { action: 'goal.classify', detail: '用户要分析客户推进动作，匹配客户推进分析任务。', observation: 'goal.matched', status: 'complete', nextAction: 'skill.match' },
            { action: 'action.execute', detail: '已生成 客户推进分析.md。', observation: 'action.executed', status: 'complete', nextAction: 'artifact.verify' },
            { action: 'artifact.verify', detail: '产物已通过 Runtime 基础校验。', observation: 'artifact.ready', status: 'complete', nextAction: 'finish' },
          ],
        },
      };
    },
  };

  const first = await runNewConversationAgent({
    text: '客户是德国采购商，询盘问MOQ和交期，做下一步推进计划',
    registry: createFollowupRegistry(),
    skillRuntime,
  });
  const second = await runNewConversationAgent({
    text: '确认继续',
    sessionId: first.sessionId,
    context: first.context,
    registry: createFollowupRegistry(),
    skillRuntime,
  });

  assert.equal(first.kind, 'confirmation-required');
  assert.equal(first.status, 'waiting');
  assert.equal(first.context.pendingConfirmation.type, 'runtime_policy');
  assert.equal(first.context.pendingConfirmation.runtime.action, 'paid_api.call');
  assert.match(first.messages[1].confirmation.title, /付费能力需要你确认/);
  assert.equal(second.kind, 'confirmation-accepted');
  assert.equal(second.artifact.name, '客户推进分析.md');
  assert.equal(resumeCalled, true);
});

test('runNewConversationAgent preserves Runtime waiting artifact during policy confirmation', async () => {
  const runtimeArtifact = {
    type: 'markdown',
    name: '客户推进分析.md',
    outputPath: '/tmp/客户推进分析.md',
  };
  const skillRuntime = {
    async runGoal() {
      return {
        ok: true,
        runId: 'skill-runtime-20260630-110000-policy-artifact',
        runLogPath: '/tmp/runtime-policy-artifact.jsonl',
        goal: {
          matched: true,
          trigger: 'natural_goal',
          skillId: 'customer-followup-plan',
          reason: '用户要分析客户推进动作，匹配客户推进分析任务。',
        },
        skill: {
          id: 'customer-followup-plan',
          displayName: '客户推进分析',
          adapter: 'business-draft',
          artifactType: 'markdown',
        },
        plan: {
          title: '客户推进分析执行计划',
          steps: [{ id: 'write_plan', label: '生成材料', detail: '生成客户推进分析。' }],
        },
        artifact: runtimeArtifact,
        waiting: {
          action: 'customer.write_memory',
          checkpointPath: '/tmp/runtime-policy-artifact.checkpoint.json',
          reason: '写入客户档案前需要用户确认',
          resumeFrom: 'policy:customer.write_memory',
          runId: 'skill-runtime-20260630-110000-policy-artifact',
        },
        loop: {
          status: 'waiting',
          steps: [
            { action: 'goal.classify', detail: '用户要分析客户推进动作，匹配客户推进分析任务。', observation: 'goal.matched', status: 'complete', nextAction: 'skill.match' },
            { action: 'action.execute', detail: '已生成 客户推进分析.md。', observation: 'action.executed', status: 'complete', nextAction: 'policy.confirm' },
            { action: 'policy.confirm', detail: '写入客户档案前需要用户确认', observation: 'policy.ask', status: 'waiting', nextAction: 'resume_run' },
          ],
        },
      };
    },
  };

  const first = await runNewConversationAgent({
    text: '客户是德国采购商，询盘问MOQ和交期，做下一步推进计划并保存',
    registry: createFollowupRegistry(),
    skillRuntime,
  });
  const second = await runNewConversationAgent({
    text: '取消这一步',
    sessionId: first.sessionId,
    context: first.context,
    registry: createFollowupRegistry(),
    skillRuntime,
  });

  assert.equal(first.kind, 'confirmation-required');
  assert.equal(first.status, 'waiting');
  assert.equal(first.artifact.name, '客户推进分析.md');
  assert.equal(first.context.artifact.name, '客户推进分析.md');
  assert.equal(first.context.pendingConfirmation.type, 'runtime_policy');
  assert.equal(first.messages[1].artifact.name, '客户推进分析.md');
  assert.equal(second.kind, 'confirmation-cancelled');
  assert.equal(second.context.artifact.name, '客户推进分析.md');
  assert.equal(Object.hasOwn(second.context, 'pendingConfirmation'), false);
});

test('runNewConversationAgent asks for business context after confirming an external send without enough detail', async () => {
  const first = await runNewConversationAgent({
    text: '把这封开发信发给客户',
    registry: createTestRegistry(),
  });

  const second = await runNewConversationAgent({
    text: '先生成草稿',
    sessionId: first.sessionId,
    context: first.context,
    registry: createEmailRegistry(),
    skillRuntime: {
      async runGoal() {
        throw new Error('runtime should not run when external send confirmation still lacks business context');
      },
    },
  });

  assert.equal(first.kind, 'confirmation-required');
  assert.equal(second.ok, true);
  assert.equal(second.kind, 'needs-input');
  assert.equal(second.status, 'waiting');
  assert.equal(second.artifact, undefined);
  assert.equal(second.context.pendingTask.skillId, 'cold-email-draft');
  assert.match(second.messages[0].content, /已确认/);
  assert.match(second.messages[0].content, /不会自动外发/);
  assert.match(second.messages[0].content, /客户名称/);
  assert.match(second.messages[0].content, /产品/);
  assert.match(second.messages[0].content, /目标市场/);
});

test('runNewConversationAgent keeps inquiry reply intent after external send confirmation', async () => {
  const first = await runNewConversationAgent({
    text: '客户发来询盘，帮我回一封邮件发给客户，产品太阳能路灯',
    registry: createEmailAndInquiryReplyRegistry(),
  });
  let runtimeText = '';

  const second = await runNewConversationAgent({
    text: '先生成草稿',
    sessionId: first.sessionId,
    context: first.context,
    registry: createEmailAndInquiryReplyRegistry(),
    skillRuntime: {
      async runGoal({ text }) {
        runtimeText = text;
        assert.match(text, /询盘回复草稿/);
        assert.doesNotMatch(text, /跟进开发信/);
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'inquiry-reply-draft',
            reason: '用户要处理询盘回复，匹配询盘回复草稿任务。',
          },
          skill: {
            id: 'inquiry-reply-draft',
            displayName: '询盘回复草稿',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/询盘回复草稿.md',
            artifactName: '询盘回复草稿.md',
          },
          artifact: {
            type: 'markdown',
            name: '询盘回复草稿.md',
            outputPath: '/tmp/询盘回复草稿.md',
          },
        };
      },
    },
  });

  assert.equal(first.kind, 'confirmation-required');
  assert.equal(first.context.pendingConfirmation.type, 'external_send');
  assert.equal(second.kind, 'confirmation-accepted');
  assert.equal(second.artifact.name, '询盘回复草稿.md');
  assert.match(runtimeText, /客户发来询盘/);
  assert.match(runtimeText, /产品太阳能路灯/);
});

test('runNewConversationAgent accepts natural external-send confirmation wording', async () => {
  const first = await runNewConversationAgent({
    text: '客户发来询盘，帮我回一封邮件发给客户，产品太阳能路灯',
    registry: createEmailAndInquiryReplyRegistry(),
  });
  let runtimeText = '';

  const second = await runNewConversationAgent({
    text: '可以，先生成草稿',
    sessionId: first.sessionId,
    context: first.context,
    registry: createEmailAndInquiryReplyRegistry(),
    skillRuntime: {
      async runGoal({ text }) {
        runtimeText = text;
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'inquiry-reply-draft',
            reason: '用户自然确认后继续询盘回复草稿。',
          },
          skill: {
            id: 'inquiry-reply-draft',
            displayName: '询盘回复草稿',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/询盘回复草稿.md',
            artifactName: '询盘回复草稿.md',
          },
          artifact: {
            type: 'markdown',
            name: '询盘回复草稿.md',
            outputPath: '/tmp/询盘回复草稿.md',
          },
        };
      },
    },
  });

  assert.equal(first.kind, 'confirmation-required');
  assert.equal(second.kind, 'confirmation-accepted');
  assert.equal(second.artifact.name, '询盘回复草稿.md');
  assert.match(runtimeText, /客户发来询盘/);
});

test('runNewConversationAgent treats natural negative external-send wording as cancellation', async () => {
  const first = await runNewConversationAgent({
    text: '把这封开发信发给客户',
    registry: createEmailRegistry(),
  });

  const second = await runNewConversationAgent({
    text: '先不要生成草稿',
    sessionId: first.sessionId,
    context: first.context,
    registry: createEmailRegistry(),
    skillRuntime: {
      async runGoal() {
        throw new Error('runtime should not run after natural cancellation');
      },
    },
  });

  assert.equal(first.kind, 'confirmation-required');
  assert.equal(second.kind, 'confirmation-cancelled');
  assert.equal(second.status, 'waiting');
  assert.equal(Object.hasOwn(second.context, 'pendingConfirmation'), false);
  assert.match(second.messages[0].content, /已取消/);
});

test('runNewConversationAgent keeps wording edits as supplements during external-send confirmation', async () => {
  const first = await runNewConversationAgent({
    text: '客户发来询盘，帮我回一封邮件发给客户，产品太阳能路灯',
    registry: createEmailAndInquiryReplyRegistry(),
  });

  const second = await runNewConversationAgent({
    text: '不要写成草稿格式，正式一点',
    sessionId: first.sessionId,
    context: first.context,
    registry: createEmailAndInquiryReplyRegistry(),
    skillRuntime: {
      async runGoal() {
        throw new Error('runtime should not run for a wording supplement');
      },
    },
  });

  assert.equal(first.kind, 'confirmation-required');
  assert.equal(second.kind, 'confirmation-required');
  assert.equal(second.status, 'waiting');
  assert.equal(second.context.pendingConfirmation.type, 'external_send');
  assert.deepEqual(second.context.pendingConfirmation.supplements, ['不要写成草稿格式，正式一点']);
  assert.match(second.messages[0].content, /仍需要你确认/);
});

test('runNewConversationAgent does not treat tentative wording as external-send confirmation', async () => {
  const first = await runNewConversationAgent({
    text: '客户发来询盘，帮我回一封邮件发给客户，产品太阳能路灯',
    registry: createEmailAndInquiryReplyRegistry(),
  });

  const second = await runNewConversationAgent({
    text: '好像先生成草稿更合适',
    sessionId: first.sessionId,
    context: first.context,
    registry: createEmailAndInquiryReplyRegistry(),
    skillRuntime: {
      async runGoal() {
        throw new Error('runtime should not run for tentative wording');
      },
    },
  });

  assert.equal(first.kind, 'confirmation-required');
  assert.equal(second.kind, 'confirmation-required');
  assert.equal(second.status, 'waiting');
  assert.equal(second.context.pendingConfirmation.type, 'external_send');
  assert.match(second.messages[0].content, /仍需要你确认/);
});

test('runNewConversationAgent carries inline details from natural confirmation into the resumed draft', async () => {
  const first = await runNewConversationAgent({
    text: '客户发来询盘，帮我回一封邮件发给客户',
    registry: createEmailAndInquiryReplyRegistry(),
  });
  let runtimeText = '';

  const second = await runNewConversationAgent({
    text: '可以，产品是太阳能路灯，先生成草稿',
    sessionId: first.sessionId,
    context: first.context,
    registry: createEmailAndInquiryReplyRegistry(),
    skillRuntime: {
      async runGoal({ text }) {
        runtimeText = text;
        return {
          ...createRuntimeResult(),
          goal: {
            matched: true,
            trigger: 'natural_goal',
            skillId: 'inquiry-reply-draft',
            reason: '用户确认草稿并在同一句补充产品资料。',
          },
          skill: {
            id: 'inquiry-reply-draft',
            displayName: '询盘回复草稿',
            adapter: 'business-draft',
            artifactType: 'markdown',
          },
          result: {
            ok: true,
            mode: 'business-draft',
            outputPath: '/tmp/询盘回复草稿.md',
            artifactName: '询盘回复草稿.md',
          },
          artifact: {
            type: 'markdown',
            name: '询盘回复草稿.md',
            outputPath: '/tmp/询盘回复草稿.md',
          },
        };
      },
    },
  });

  assert.equal(first.kind, 'confirmation-required');
  assert.equal(second.kind, 'confirmation-accepted');
  assert.equal(second.artifact.name, '询盘回复草稿.md');
  assert.match(runtimeText, /客户发来询盘/);
  assert.match(runtimeText, /产品是太阳能路灯/);
});

test('runNewConversationAgent continues after the user confirms a risky action with enough detail', async () => {
  const first = await runNewConversationAgent({
    text: '把这封开发信发给客户，客户是德国采购商，产品是太阳能路灯，重点问MOQ和交期',
    registry: createTestRegistry(),
  });
  const skillRuntime = {
    async runGoal({ text }) {
      assert.match(text, /准备一封跟进开发信/);
      assert.match(text, /把这封开发信发给客户/);
      assert.match(text, /德国采购商/);
      assert.match(text, /太阳能路灯/);
      return {
        ok: true,
        runId: 'skill-runtime-20260629-120000-mail',
        runLogPath: '/tmp/mail.jsonl',
        goal: {
          matched: true,
          trigger: 'natural_goal',
          skillId: 'cold-email-draft',
          reason: '用户要准备开发信,匹配开发信草稿任务。',
        },
        skill: {
          id: 'cold-email-draft',
          displayName: '开发信草稿',
          adapter: 'business-draft',
          artifactType: 'markdown',
        },
        plan: {
          title: '开发信草稿执行计划',
          steps: [{ id: 'write_draft', label: '生成材料', detail: '生成英文开发信草稿。' }],
        },
        result: {
          ok: true,
          mode: 'business-draft',
          runId: 'skill-runtime-20260629-120000-mail',
        },
        artifact: {
          type: 'markdown',
          name: '开发信草稿.md',
          outputPath: '/tmp/开发信草稿.md',
        },
        loop: {
          status: 'completed',
          steps: [
            { action: 'goal.classify', detail: '用户要准备开发信,匹配开发信草稿任务。', observation: 'goal.matched', status: 'complete', nextAction: 'skill.match' },
            { action: 'skill.load', detail: '已读取 skill.json。', observation: 'skill.loaded', status: 'complete', nextAction: 'plan.create' },
            { action: 'plan.create', detail: '识别任务 → 核对资料 → 生成材料 → 检查结果', observation: 'plan.ready', status: 'complete', nextAction: 'action.execute' },
            { action: 'action.execute', detail: '已生成 开发信草稿.md。', observation: 'action.executed', status: 'complete', nextAction: 'artifact.verify' },
            { action: 'artifact.verify', detail: '产物已通过 Runtime 基础校验。', observation: 'artifact.ready', status: 'complete', nextAction: 'finish' },
          ],
        },
      };
    },
  };

  const second = await runNewConversationAgent({
    text: '先生成草稿',
    sessionId: first.sessionId,
    context: first.context,
    registry: createEmailRegistry(),
    skillRuntime,
  });

  assert.equal(second.ok, true);
  assert.equal(second.kind, 'confirmation-accepted');
  assert.equal(second.sessionId, first.sessionId);
  assert.equal(second.artifact.name, '开发信草稿.md');
  assert.equal(second.context.artifact.name, '开发信草稿.md');
  assert.match(second.messages[1].content, /已确认/);
  assert.match(second.messages[1].content, /不会自动外发/);
  assert.match(second.messages[1].content, /开发信草稿/);
});

test('buildAgentFollowupResponse reads prior manifest and run log instead of returning only a fixed prompt', async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-followup-'));
  const manifestPath = path.join(projectRoot, 'manifest.json');
  const runLogPath = path.join(projectRoot, 'run.jsonl');

  try {
    await mkdir(projectRoot, { recursive: true });
    await writeFile(
      manifestPath,
      `${JSON.stringify({
        requiredSheets: ['本次会议总览', '本周询盘概览', '业务员询盘复盘'],
        validation: { workbookBytes: 24734, builderExitCode: 0 },
      })}\n`,
      'utf8',
    );
    await writeFile(
      runLogPath,
      [
        { type: 'action.executed' },
        { type: 'artifact.verified' },
        { type: 'run.completed' },
      ].map((item) => JSON.stringify(item)).join('\n') + '\n',
      'utf8',
    );

    const response = await buildAgentFollowupResponse({
      sessionId: 'agent-session-20260628-101500-abcd',
      text: '把下周跟进行动表按负责人再总结一下',
      context: {
        artifact: {
          name: '询盘分析会_2026-06-15_2026-06-21.xlsx',
          manifestPath,
          runLogPath,
        },
        period: { start: '2026-06-15', end: '2026-06-21' },
      },
    });

    assert.equal(response.ok, true);
    assert.equal(response.kind, 'needs-input-followup');
    assert.equal(response.status, 'waiting');
    assert.equal(response.sessionId, 'agent-session-20260628-101500-abcd');
    assert.equal(response.messages.length, 1);
    assert.equal(response.messages[0].role, 'assistant');
    assert.match(response.messages[0].content, /接着这次任务处理/);
    assert.match(response.messages[0].content, /不会重新采集外部数据/);
    assert.match(response.messages[0].content, /询盘分析会_2026-06-15_2026-06-21\.xlsx/);
    assert.match(response.messages[0].content, /上一轮记录了 1 个执行动作/);
    assert.match(response.messages[0].content, /产物要求 3 个工作表/);
    assert.doesNotMatch(response.messages[0].content, /前端|日志|脚本|run log|manifest/i);
    assert.equal(response.progress.at(-1).status, 'waiting');
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('buildAgentFollowupResponse revises the current markdown artifact for same-task follow-up', async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-followup-artifact-'));
  const artifactDir = path.join(projectRoot, 'workbench', 'artifacts', 'run-1');
  const artifactPath = path.join(artifactDir, '开发信草稿.md');

  try {
    await mkdir(artifactDir, { recursive: true });
    await writeFile(
      artifactPath,
      [
        '# 开发信草稿',
        '',
        '## 英文开发信草稿',
        '',
        'Hi {{Customer Name}},',
        '',
        'Could you confirm your MOQ and lead time requirement?',
      ].join('\n'),
      'utf8',
    );

    const artifact = {
      type: 'markdown',
      name: '开发信草稿.md',
      outputPath: artifactPath,
    };
    const response = await buildAgentFollowupResponse({
      projectRoot,
      sessionId: 'agent-session-20260629-101500-followup',
      text: '语气更礼貌一点，加一句可以寄样品',
      context: { artifact },
      session: { context: { artifact } },
    });
    const updated = await readFile(artifactPath, 'utf8');

    assert.equal(response.ok, true);
    assert.equal(response.kind, 'followup');
    assert.equal(response.sessionId, 'agent-session-20260629-101500-followup');
    assert.equal(response.artifact.name, '开发信草稿.md');
    assert.equal(response.artifact.outputPath, artifactPath);
    assert.equal(response.context.artifact.outputPath, artifactPath);
    assert.equal(response.messages[0].artifact.outputPath, artifactPath);
    assert.deepEqual(response.progress.map((item) => item.label), ['识别任务', '核对资料', '拆解任务', '生成材料', '检查结果']);
    assert.deepEqual(response.messages[0].process.steps.map((item) => item.label), ['识别任务', '核对资料', '拆解任务', '生成材料', '检查结果']);
    assert.equal(response.messages[0].activity.title, '本次操作记录');
    assert.equal(response.messages[0].activity.items.some((item) => item.title === '生成材料'), true);
    assert.doesNotMatch(JSON.stringify(response.messages[0].activity), /session|前端|日志|脚本|run log|manifest/i);
    assert.match(response.summary, /已按补充要求更新/);
    assert.match(response.messages[0].content, /已按补充要求更新/);
    assert.doesNotMatch(response.messages[0].content, /前端|日志|脚本|run log|manifest/i);
    assert.match(updated, /本次补充优化/);
    assert.match(updated, /语气更礼貌一点，加一句可以寄样品/);
    assert.match(updated, /sample/i);
    assert.match(updated, /外发前仍需确认/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('buildAgentFollowupResponse revises the current xlsx artifact for same-task follow-up', async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-followup-xlsx-'));
  const artifactDir = path.join(projectRoot, 'workbench', 'artifacts', 'run-1');
  const artifactPath = path.join(artifactDir, '询盘分析会.xlsx');

  try {
    await mkdir(artifactDir, { recursive: true });
    await createXlsxFollowupFixture(artifactPath);

    const artifact = {
      type: 'xlsx',
      name: '询盘分析会.xlsx',
      outputPath: artifactPath,
    };
    const response = await buildAgentFollowupResponse({
      projectRoot,
      sessionId: 'agent-session-20260629-103000-xlsx',
      text: '按负责人补一列下周动作',
      context: { artifact },
      session: { context: { artifact } },
    });
    const revised = await inspectXlsxFollowupFixture(response.artifact.outputPath);

    assert.equal(response.ok, true);
    assert.equal(response.kind, 'followup');
    assert.equal(response.artifact.type, 'xlsx');
    assert.notEqual(response.artifact.outputPath, artifactPath);
    assert.match(response.artifact.name, /已续改/);
    assert.equal(response.context.artifact.outputPath, response.artifact.outputPath);
    assert.equal(response.messages[0].artifact.outputPath, response.artifact.outputPath);
    assert.deepEqual(response.progress.map((item) => item.label), ['识别任务', '核对资料', '拆解任务', '生成材料', '检查结果']);
    assert.deepEqual(response.messages[0].process.steps.map((item) => item.label), ['识别任务', '核对资料', '拆解任务', '生成材料', '检查结果']);
    assert.equal(response.messages[0].activity.items.some((item) => item.title === '检查结果'), true);
    assert.doesNotMatch(JSON.stringify(response.messages[0].activity), /session|前端|日志|脚本|run log|manifest/i);
    assert.match(response.messages[0].content, /已按补充要求生成修订版表格/);
    assert.equal(revised.sheets.includes('本次追问'), true);
    assert.equal(revised.followupValues.some((value) => String(value).includes('按负责人补一列下周动作')), true);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('buildAgentFollowupResponse keeps revised quotation xlsx names user-facing', async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-followup-quote-xlsx-'));
  const artifactDir = path.join(projectRoot, 'workbench', 'artifacts', 'run-quote');
  const artifactPath = path.join(artifactDir, 'quotation-sheet-skill-runtime-20260630-011458-s63f.xlsx');

  try {
    await mkdir(artifactDir, { recursive: true });
    await createXlsxFollowupFixture(artifactPath);

    const artifact = {
      type: 'xlsx',
      name: '报价单.xlsx',
      outputPath: artifactPath,
    };
    const response = await buildAgentFollowupResponse({
      projectRoot,
      sessionId: 'agent-session-20260630-quote-followup',
      text: '加一列有效期30天',
      context: { artifact },
      session: { context: { artifact } },
    });

    assert.equal(response.ok, true);
    assert.equal(response.kind, 'followup');
    assert.match(response.artifact.name, /^报价单-已续改-/);
    assert.doesNotMatch(response.artifact.name, /quotation-sheet|skill-runtime/);
    assert.doesNotMatch(response.messages[0].content, /quotation-sheet|skill-runtime/);
    assert.match(response.messages[0].content, /报价单-已续改-/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('buildAgentFollowupResponse waits instead of completing when the current artifact cannot be revised', async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-followup-unsupported-'));

  try {
    const response = await buildAgentFollowupResponse({
      projectRoot,
      sessionId: 'agent-session-20260629-105000-unsupported',
      text: '帮我改得更适合发客户',
      context: {
        artifact: {
          type: 'pdf',
          name: '产品资料.pdf',
          outputPath: '/tmp/产品资料.pdf',
        },
      },
      session: {
        context: {
          artifact: {
            type: 'pdf',
            name: '产品资料.pdf',
            outputPath: '/tmp/产品资料.pdf',
          },
        },
      },
    });

    assert.equal(response.ok, true);
    assert.equal(response.kind, 'needs-input-followup');
    assert.equal(response.status, 'waiting');
    assert.equal(response.artifact, null);
    assert.equal(response.progress.at(-1).status, 'waiting');
    assert.equal(response.messages[0].process.steps.at(-1).status, 'waiting');
    assert.equal(response.messages[0].activity.items.at(-1).status, 'waiting');
    assert.match(response.messages[0].content, /暂时不能直接改这类文件/);
    assert.doesNotMatch(response.messages[0].content, /已完成|前端|日志|脚本|run log|manifest/i);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('buildAgentFollowupResponse emits progress events while revising an xlsx artifact', async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-followup-xlsx-progress-'));
  const artifactDir = path.join(projectRoot, 'workbench', 'artifacts', 'run-1');
  const artifactPath = path.join(artifactDir, '询盘分析会.xlsx');
  const progressEvents = [];

  try {
    await mkdir(artifactDir, { recursive: true });
    await createXlsxFollowupFixture(artifactPath);

    const artifact = {
      type: 'xlsx',
      name: '询盘分析会.xlsx',
      outputPath: artifactPath,
    };
    await buildAgentFollowupResponse({
      projectRoot,
      sessionId: 'agent-session-20260629-104000-xlsx-progress',
      text: '按负责人补一列下周动作',
      context: { artifact },
      session: { context: { artifact } },
      onRuntimeEvent: async (event) => {
        progressEvents.push(event.type);
      },
    });

    assert.deepEqual(progressEvents, [
      'goal.received',
      'skill.loaded',
      'plan.created',
      'action.executed',
      'artifact.verified',
      'run.completed',
    ]);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

async function createXlsxFollowupFixture(outputPath) {
  await runPythonTestScript(`
from openpyxl import Workbook
from pathlib import Path

output_path = Path(${JSON.stringify(outputPath)})
output_path.parent.mkdir(parents=True, exist_ok=True)
workbook = Workbook()
sheet = workbook.active
sheet.title = "本次会议总览"
sheet.append(["客户", "负责人", "下一步"])
sheet.append(["Global Sourcing", "Ada", "确认 MOQ"])
workbook.create_sheet("本周询盘概览").append(["国家", "询盘数"])
workbook.save(output_path)
`);
}

async function inspectXlsxFollowupFixture(inputPath) {
  const output = await runPythonTestScript(`
import json
from openpyxl import load_workbook

workbook = load_workbook(${JSON.stringify(inputPath)}, data_only=True)
values = []
if "本次追问" in workbook.sheetnames:
    sheet = workbook["本次追问"]
    for row in sheet.iter_rows(values_only=True):
        values.extend([cell for cell in row if cell is not None])
print(json.dumps({"sheets": workbook.sheetnames, "followupValues": values}, ensure_ascii=False))
`);
  return JSON.parse(output);
}

function runPythonTestScript(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(CODEX_BUNDLED_PYTHON, ['-c', script], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (exitCode) => {
      if (exitCode === 0) {
        resolve(stdout.trim());
        return;
      }
      reject(new Error(stderr || stdout || `python test script failed with ${exitCode}`));
    });
  });
}
