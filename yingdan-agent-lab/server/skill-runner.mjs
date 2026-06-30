import { spawn } from 'node:child_process';
import { appendFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { validateXlsxArtifact } from './artifact-validator.mjs';
import { createAlibabaInquiryMeetingAdapter } from './skill-adapters/alibaba-inquiry-meeting.mjs';
import { loadSkillRegistry, matchSkillForGoal } from './skill-registry.mjs';

const CODEX_BUNDLED_PYTHON =
  '/Users/garden/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';

/**
 * createSkillRuntime 创建通用 Skill Runtime。
 *
 * 作用：
 * - 从 registry 匹配 Skill，而不是在对话入口硬编码某个 Skill。
 * - 统一执行 goal、skill.match、skill.load、plan、action、observation、artifact.verify、finish。
 * - 在真正执行适配器前先统一跑 policy。
 * - 写入 append-only run log，供前台活动流和后续追问复用。
 *
 * 参数：
 * - options.projectRoot：项目根目录，字符串。
 * - options.checkPolicy：可选 policy 函数，签名为 `(action, {runId, skill})`。
 * - options.adapters：可选 adapter 覆盖表，测试或新增 adapter 时使用。
 * - options.onEvent：可选 Runtime 事件回调,用于前台实时展示业务进度。
 *
 * 返回值：包含 runGoal 方法的 Runtime 对象。
 * 可能抛出的异常：注册表读取、adapter 执行、文件写入失败时抛出。
 */
export function createSkillRuntime(options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const workbenchRoot = path.join(projectRoot, 'workbench');
  const adapters = {
    'alibaba-inquiry-meeting': createAlibabaInquiryMeetingAdapter(),
    'business-draft': createBusinessDraftAdapter(),
    'mock-artifact': createMockArtifactAdapter(),
    'quotation-sheet': createQuotationSheetAdapter(),
    ...(options.adapters || {}),
  };
  const checkPolicy = options.checkPolicy || allowPolicy;
  const onEvent = typeof options.onEvent === 'function' ? options.onEvent : null;

  return {
    runGoal,
    resumeGoal,
    projectRoot,
    workbenchRoot,
  };

  /**
   * runGoal 执行一次通用 Skill 目标。
   *
   * 参数：
   * - input.text：用户输入。
   *
   * 返回值：Promise<object>，包含 loop、artifact、runLogPath 等。
   * 可能抛出的异常：当目标不支持、adapter 缺失或执行失败时抛出。
   */
  async function runGoal(input = {}) {
    const text = String(input.text || '').trim();
    const runId = input.runId || generateRunId('skill-runtime');
    const runLogPath = path.join(workbenchRoot, 'runs', `${runId}.jsonl`);
    const outputRoot = path.join(workbenchRoot, 'artifacts', runId);
    const resumeCheckpoint = input.resumeFromCheckpoint || null;
    const approvedPolicyActions = new Set(input.approvedPolicyActions || []);
    const loopSteps = [];
    const recordRunEvent = (event) => appendRunEvent(runLogPath, { runId, ...event }, onEvent);
    const state = {
      adapter: null,
      artifact: null,
      goal: null,
      loadedSkill: null,
      plan: null,
      result: null,
      skill: null,
      status: 'running',
    };

    await mkdir(path.dirname(runLogPath), { recursive: true });
    await mkdir(outputRoot, { recursive: true });

    if (resumeCheckpoint) {
      await recordRunEvent({
        type: 'run.resumed',
        status: 'resuming',
        resume_from: resumeCheckpoint.resume_from,
      });
    }

    const registry = await loadSkillRegistry({ projectRoot });

    state.goal = matchSkillForGoal({ registry, text });
    await recordRunEvent({ type: 'goal.received', status: state.goal.matched ? 'complete' : 'unsupported', text: summarizeText(text) });
    loopSteps.push(toLoopStep('goal.classify', '收到目标', state.goal.reason || '当前目标暂未命中可执行 Skill。', state.goal.matched ? 'goal.matched' : 'goal.unsupported', state.goal.matched ? 'complete' : 'error', state.goal.matched ? 'skill.match' : 'finish'));

    if (!state.goal.matched) {
      state.status = 'failed';
      await recordRunEvent({ type: 'run.failed', status: 'failed', reason: 'UNSUPPORTED_AGENT_GOAL' });
      return buildUnsupportedResult({ loopSteps, runId, runLogPath, text });
    }

    state.skill = state.goal.skill;
    state.adapter = adapters[state.skill.adapter];
    await recordRunEvent({
      type: 'skill.matched',
      status: state.adapter ? 'complete' : 'failed',
      skillId: state.skill.id,
      adapter: state.skill.adapter,
      trigger: state.goal.trigger,
    });
    loopSteps.push(toLoopStep('skill.match', '匹配任务', `选择 ${state.skill.displayName || state.skill.id} 作为执行 Skill。`, state.adapter ? 'skill.matched' : 'skill.adapter_missing', state.adapter ? 'complete' : 'error', state.adapter ? 'skill.load' : 'finish'));

    if (!state.adapter) {
      state.status = 'failed';
      await recordRunEvent({ type: 'run.failed', status: 'failed', reason: 'SKILL_ADAPTER_MISSING', skillId: state.skill.id });
      return buildFailedResult({ loopSteps, runId, runLogPath, state });
    }

    state.loadedSkill = await state.adapter.load({ projectRoot, runId, skill: state.skill });
    await recordRunEvent({
      type: 'skill.loaded',
      status: state.loadedSkill?.hasExecutable === false ? 'failed' : 'complete',
      skillId: state.skill.id,
      requiredFiles: state.loadedSkill?.requiredFiles || [],
    });
    loopSteps.push(toLoopStep('skill.load', '读取 Skill 定义', loadedSkillDetail(state), state.loadedSkill?.hasExecutable === false ? 'skill.load_failed' : 'skill.loaded', state.loadedSkill?.hasExecutable === false ? 'error' : 'complete', state.loadedSkill?.hasExecutable === false ? 'finish' : 'plan.create'));

    if (state.loadedSkill?.hasExecutable === false) {
      state.status = 'failed';
      await recordRunEvent({ type: 'run.failed', status: 'failed', reason: 'SKILL_NOT_EXECUTABLE', skillId: state.skill.id });
      return buildFailedResult({ loopSteps, runId, runLogPath, state });
    }

    state.plan = buildPlan(state.skill, state.goal);
    await recordRunEvent({
      type: 'plan.created',
      status: 'complete',
      skillId: state.skill.id,
      steps: state.plan.steps.map((step) => step.label),
    });
    loopSteps.push(toLoopStep('plan.create', state.plan.title, state.plan.steps.map((step) => step.label).join(' → '), 'plan.ready', 'complete', 'action.execute'));

    for (const [index, action] of (state.skill.policyActions || []).entries()) {
      const decision = approvedPolicyActions.has(action)
        ? { action, decision: 'allow', why: `用户已确认 ${action},本轮从 checkpoint 继续。` }
        : await checkPolicy(action, { runId, skill: state.skill });
      await recordRunEvent({
        type: 'policy.checked',
        action,
        decision: decision.decision,
        status: decision.decision === 'deny' ? 'denied' : decision.decision === 'ask' ? 'waiting' : 'complete',
        why: decision.why,
      });
      if (decision.decision === 'deny') {
        state.status = 'failed';
        await recordRunEvent({ type: 'run.failed', status: 'failed', reason: 'POLICY_DENIED', action });
        return buildFailedResult({ loopSteps, runId, runLogPath, state });
      }
      if (decision.decision === 'ask') {
        state.status = 'waiting';
        const checkpoint = {
          approvedActions: (state.skill.policyActions || []).slice(0, index),
          createdAt: new Date().toISOString(),
          pendingAction: action,
          resume_from: `policy:${action}`,
          runId,
          skillId: state.skill.id,
          status: 'waiting',
          text,
          why: decision.why,
        };
        const checkpointPath = await writeRuntimeCheckpoint({ checkpoint, runId, workbenchRoot });
        await recordRunEvent({
          type: 'run.checkpointed',
          checkpoint: path.relative(workbenchRoot, checkpointPath),
          resume_from: checkpoint.resume_from,
        });
        await recordRunEvent({
          type: 'run.waiting',
          action,
          reason: decision.why,
          resume_from: checkpoint.resume_from,
          status: 'waiting',
        });
        loopSteps.push(toLoopStep('policy.confirm', '等待确认', decision.why || '这一步需要你确认后继续。', 'policy.ask', 'waiting', 'resume_run'));
        return buildWaitingResult({
          action,
          checkpoint,
          checkpointPath,
          decision,
          loopSteps,
          runId,
          runLogPath,
          state,
        });
      }
    }

    state.result = await state.adapter.execute({
      goal: state.goal,
      loadedSkill: state.loadedSkill,
      outputRoot,
      projectRoot,
      runId,
      skill: state.skill,
      userText: text,
    });
    state.artifact = normalizeArtifact(state.result, state.skill);
    await recordRunEvent({
      type: 'action.executed',
      status: state.result?.ok === false ? 'failed' : 'complete',
      skillId: state.skill.id,
      artifactType: state.artifact?.type || state.skill.artifactType,
    });
    loopSteps.push(toLoopStep('action.execute', '执行任务', actionDetail(state), state.result?.ok === false ? 'action.failed' : 'action.executed', state.result?.ok === false ? 'error' : 'complete', 'observation.record'));

    await recordRunEvent({
      type: 'observation.recorded',
      status: state.result?.ok === false ? 'failed' : 'complete',
      observation: buildObservation(state),
    });
    loopSteps.push(toLoopStep('observation.record', '记录观察', buildObservation(state), state.result?.ok === false ? 'observation.failed' : 'observation.ready', state.result?.ok === false ? 'error' : 'complete', 'artifact.verify'));

    const artifactVerification = await verifyArtifact(state.artifact, state.skill, { userText: text });
    state.artifact = {
      ...state.artifact,
      validation: artifactVerification,
    };
    await recordRunEvent({
      type: 'artifact.verified',
      status: artifactVerification.ok ? 'complete' : 'failed',
      artifact: state.artifact,
      validation: artifactVerification,
    });
    loopSteps.push(toLoopStep('artifact.verify', '校验产物', artifactVerification.message || (artifactVerification.ok ? '产物已通过 Runtime 基础校验。' : '产物检查没有通过。'), artifactVerification.ok ? 'artifact.ready' : 'artifact.invalid', artifactVerification.ok ? 'complete' : 'error', 'finish'));

    state.status = artifactVerification.ok ? 'completed' : 'failed';
    await recordRunEvent({
      type: state.status === 'completed' ? 'run.completed' : 'run.failed',
      status: state.status,
      outputPath: state.artifact?.outputPath || '',
    });
    loopSteps.push(toLoopStep('finish', '完成', state.status === 'completed' ? '本轮目标已完成。' : '本轮目标未完成。', state.status === 'completed' ? 'run.completed' : 'run.failed', state.status === 'completed' ? 'complete' : 'error', 'none'));

    return {
      ok: state.status === 'completed',
      runId,
      runLogPath,
      goal: state.goal,
      skill: state.skill,
      loadedSkill: state.loadedSkill,
      plan: state.plan,
      result: state.result,
      artifact: state.artifact,
      loop: {
        maxSteps: 8,
        status: state.status,
        steps: loopSteps,
      },
    };
  }

  /**
   * resumeGoal 从通用 Runtime checkpoint 继续执行。
   *
   * 作用：
   * - 用户确认 Runtime 层 `policy.ask` 后,从同一个 runId 继续。
   * - 第一版 checkpoint 只停在 adapter 执行前,因此恢复时会重新做目标匹配和计划组装,
   *   但不会重跑已经完成的 adapter 执行动作。
   *
   * 参数：
   * - input.runId：等待确认的 runId。
   *
   * 返回值：Promise<object>,结构与 runGoal 相同。
   * 可能抛出的异常：checkpoint 不存在、格式不合法或恢复执行失败时抛出。
   */
  async function resumeGoal(input = {}) {
    const runId = String(input.runId || '').trim();
    const checkpointPath = getRuntimeCheckpointPath({ runId, workbenchRoot });
    const checkpoint = JSON.parse(await readFile(checkpointPath, 'utf8'));

    if (checkpoint.status !== 'waiting' || !checkpoint.pendingAction || !checkpoint.text) {
      throw Object.assign(new Error('Runtime checkpoint is not waiting for policy confirmation'), {
        code: 'SKILL_RUNTIME_NOT_WAITING',
        status: 400,
      });
    }

    const result = await runGoal({
      approvedPolicyActions: [...(checkpoint.approvedActions || []), checkpoint.pendingAction],
      resumeFromCheckpoint: checkpoint,
      runId,
      text: checkpoint.text,
    });

    if (result.loop?.status === 'completed') {
      await writeRuntimeCheckpoint({
        checkpoint: {
          ...checkpoint,
          completedAt: new Date().toISOString(),
          status: 'completed',
        },
        runId,
        workbenchRoot,
      });
    }

    return result;
  }
}

function createMockArtifactAdapter() {
  return {
    async load({ skill }) {
      return {
        displayName: skill.displayName,
        requiredFiles: ['skill.json'],
        hasExecutable: true,
      };
    },

    async execute({ outputRoot, runId, skill }) {
      const artifactPath = path.join(outputRoot, `${skill.id}-${runId}.md`);
      await writeFile(artifactPath, `# ${skill.displayName || skill.id}\n\n- 这是本地轻量 Skill 的执行产物。\n`, 'utf8');
      return {
        ok: true,
        mode: 'mock-artifact',
        runId,
        artifact: {
          type: 'markdown',
          name: `${skill.displayName || skill.id}.md`,
          outputPath: artifactPath,
        },
      };
    },
  };
}

function createBusinessDraftAdapter() {
  return {
    async load({ skill }) {
      return {
        displayName: skill.displayName,
        requiredFiles: ['skill.json'],
        hasExecutable: true,
      };
    },

    async execute({ outputRoot, runId, skill, userText }) {
      const artifactName = `${skill.id}-${runId}.md`;
      const artifactPath = path.join(outputRoot, artifactName);
      const content = buildBusinessDraftMarkdown({ skill, userText });
      await writeFile(artifactPath, content, 'utf8');
      return {
        ok: true,
        mode: 'business-draft',
        runId,
        artifact: {
          type: 'markdown',
          name: `${skill.displayName || skill.id}.md`,
          outputPath: artifactPath,
        },
        summary: { createdItems: countMarkdownSections(content) },
      };
    },
  };
}

/**
 * createQuotationSheetAdapter 创建报价单 XLSX 适配器。
 *
 * 作用：
 * - 把用户自然语言里的产品、数量、单价和贸易条款整理成可检查的工作簿。
 * - 只生成本地文件,不外发、不写客户档案、不承诺未经确认的价格。
 *
 * 参数：无。
 *
 * 返回值：Runtime adapter 对象,包含 load 和 execute。
 * 可能抛出的异常：Python/openpyxl 生成失败时由 execute 向上抛出。
 */
function createQuotationSheetAdapter() {
  return {
    async load({ skill }) {
      return {
        displayName: skill.displayName,
        requiredFiles: ['skill.json'],
        hasExecutable: true,
      };
    },

    async execute({ outputRoot, runId, skill, userText }) {
      const artifactPath = path.join(outputRoot, `${skill.id}-${runId}.xlsx`);
      const quote = extractQuotationFields(userText);
      await writeQuotationWorkbook({ outputPath: artifactPath, quote, userText });
      return {
        ok: true,
        mode: 'quotation-sheet',
        runId,
        artifact: {
          type: 'xlsx',
          name: `${skill.displayName || '报价单'}.xlsx`,
          outputPath: artifactPath,
        },
        summary: { createdItems: 2 },
      };
    },
  };
}

function buildBusinessDraftMarkdown({ skill, userText }) {
  const cleanInput = sanitizeBusinessVisibleInput(userText || '用户未补充具体资料');
  const generatedAt = new Date().toISOString();
  const title = skill.displayName || skill.id;
  const signals = extractBusinessSignals(userText);

  if (skill.id === 'cold-email-draft') {
    const subject = signals.concernsEnglish.length
      ? `${joinEnglishList(signals.concernsEnglish)} for your sourcing plan`
      : 'Quick idea for your next sourcing plan';
    const buyerLabel = signals.countryEnglish ? `${signals.countryEnglish} buyer` : 'buyer';
    const productLine = signals.productEnglish ? ` for ${signals.productEnglish}` : '';
    const concernLine = signals.concernsEnglish.length
      ? `I understand ${buyerLabel}s often need clear answers on ${joinEnglishList(signals.concernsEnglish)}${productLine} before moving a supplier discussion forward.`
      : 'I understand your team may be evaluating suppliers or product options for the next purchasing cycle.';
    const nextQuestion = signals.concernsEnglish.length
      ? `Would it be useful if I prepare a short option list covering ${joinEnglishList(signals.concernsEnglish)}, key specifications, and the questions we should confirm before quotation?`
      : 'Would it be useful if I send a short option list with MOQ, estimated lead time, and the key questions we need to confirm before quotation?';

    return [
      `# ${title}`,
      '',
      `> 任务来源: ${cleanInput}`,
      `> 生成时间: ${generatedAt}`,
      '',
      '## 英文开发信草稿',
      '',
      `Subject: ${subject}`,
      '',
      'Hi {{Customer Name}},',
      '',
      `${concernLine} Based on the information currently available, I prepared a concise first-touch note rather than a hard quotation.`,
      '',
      `We can support product discussion, sample planning${signals.concernsEnglish.includes('lead time') ? ', lead time confirmation' : ''}, packaging requirements, and quotation preparation once you share the target specification, quantity, and destination market.`,
      '',
      nextQuestion,
      '',
      'Best regards,',
      '{{Your Name}}',
      '',
      '## 依据',
      '',
      `- 用户目标: ${cleanInput}`,
      signals.productChinese ? `- 产品: ${signals.productChinese}` : '- 产品暂未明确。',
      signals.countryChinese ? `- 已识别客户/市场: ${signals.countryChinese}` : '- 客户国家暂未明确。',
      signals.concernsChinese.length ? `- 已识别关注点: ${signals.concernsChinese.join('、')}` : '- 关注点暂未明确。',
      '- 当前没有足够客户名称、产品规格、数量和目标市场,因此只生成可检查草稿,不承诺价格或交期。',
      '',
      '## 缺口',
      '',
      '- 客户名称 / 国家 / 公司背景',
      '- 产品规格、数量、包装要求',
      '- 目标价格、交期、贸易条款',
      '',
      '## 下一步',
      '',
      '- 补客户和产品信息后,把占位符替换成正式版本。',
      '- 外发前再次确认收件人、正文和附件。',
      '',
    ].join('\n');
  }

  if (skill.id === 'customer-followup-plan') {
    const signalSentence = signals.concernsChinese.length
      ? buildCustomerFollowupSignalSentence(signals.concernsChinese)
      : '当前信息足以先做推进框架,但不足以给出确定成交结论。应先把客户意向、采购约束和下一步动作拆开处理。';
    const cadenceSection = buildFollowupCadenceSection({ signals, userText });

    return [
      `# ${title}`,
      '',
      `> 任务来源: ${cleanInput}`,
      `> 生成时间: ${generatedAt}`,
      '',
      '## 客户推进判断',
      '',
      signalSentence,
      '',
      '## 依据',
      '',
      `- 用户补充: ${cleanInput}`,
      signals.productChinese ? `- 产品: ${signals.productChinese}` : '- 产品暂未明确。',
      signals.countryChinese ? `- 客户/市场: ${signals.countryChinese}` : '- 客户国家暂未明确。',
      signals.concernsChinese.length ? `- 客户关注点: ${signals.concernsChinese.join('、')}` : '- 客户关注点还需要从询盘原文里确认。',
      '- 已出现“客户推进 / 下一步 / 分析”类目标,说明任务重点是成交动作而不是泛泛问答。',
      '',
      '## 信息缺口',
      '',
      '- 客户国家、公司名、官网或平台来源',
      '- 询盘原文、关注产品、数量、交期、认证和付款条件',
      '- 我方价格底线、样品政策、可让步范围',
      '',
      '## 风险',
      '',
      '- 缺少询盘原文时,不能判断客户真实意向。',
      '- 缺少底价和交期时,不能建议直接报价。',
      '',
      '## 下一步跟进行动',
      '',
      '1. 先向客户确认用途、数量、交期和目标市场。',
      '2. 根据客户回复分成高意向、待澄清、低优先级三类。',
      '3. 高意向客户准备报价区间和样品方案;待澄清客户先发 3 个关键问题。',
      '4. 把确认后的摘要写入客户档案前,需要用户确认。',
      '',
      ...cadenceSection,
    ].join('\n');
  }

  const replyFocus = signals.concernsEnglish.length
    ? `To prepare an accurate reply on ${joinEnglishList(signals.concernsEnglish)}, could you please confirm the target quantity, required specification, destination country, packaging needs, and expected delivery time?`
    : 'To prepare a more accurate quotation, could you please confirm the target quantity, required specification, destination country, packaging needs, and expected delivery time?';
  const productIntro = signals.productEnglish ? ` about ${signals.productEnglish}` : '';
  const samplePlanSentence = signals.sampleTimingEnglish
    ? `If you need a ${signals.sampleTimingEnglish}, I can arrange the next step after we confirm the quantity, specification, and shipping details.`
    : '';

  return [
    `# ${title}`,
    '',
    `> 任务来源: ${cleanInput}`,
    `> 生成时间: ${generatedAt}`,
    '',
    '## 询盘判断',
    '',
    '当前可以先生成回复框架,但不能在资料不足时承诺价格、交期或库存。',
    '',
    '## 回复草稿',
    '',
    'Hi {{Customer Name}},',
    '',
    `Thank you for your inquiry${productIntro}. ${replyFocus}`,
    '',
    samplePlanSentence,
    '',
    'Once these details are confirmed, I can share the suitable options, estimated lead time, and next steps for sample or quotation.',
    '',
    'Best regards,',
    '{{Your Name}}',
    '',
    '## 依据',
    '',
    `- 用户目标: ${cleanInput}`,
    signals.productChinese ? `- 产品: ${signals.productChinese}` : '- 产品暂未明确。',
    signals.concernsChinese.length ? `- 客户关注点: ${signals.concernsChinese.join('、')}` : '- 客户关注点暂未明确。',
    '- 询盘回复任务需要先补齐关键采购信息。',
    '',
    '## 缺口',
    '',
    '- 数量、规格、目的港/国家、包装、认证、交期、付款条件',
    '',
    '## 下一步',
    '',
    '- 补齐询盘原文后,再生成更贴近客户语气的正式回复。',
    '',
  ].join('\n');
}

function buildCustomerFollowupSignalSentence(concerns = []) {
  if (concerns.includes('客户沉默/未回复')) {
    return '客户暂时未回复,这通常说明需要调整跟进节奏和触达理由;下一步应先补齐客户背景、上次沟通内容和可推进的低压力话题。';
  }
  if (concerns.includes('付款/账期压力')) {
    return '客户正在要求更宽松的付款或账期条件,这通常说明他在评估采购风险和现金流压力;下一步应先确认客户信用、订单规模和我方可接受的付款边界。';
  }
  if (concerns.includes('质量/售后风险')) {
    return '客户正在表达质量或售后不满,这通常说明当前重点不是继续推销,而是先稳定情绪、收集证据并判断责任边界。';
  }
  if (concerns.includes('样品/费用压力')) {
    return '客户正在要求免费样品或回避样品费用,这通常说明需要同时判断客户意向和控制样品成本;下一步应说明样品政策、可抵扣条件和正式订单后的费用处理方式。';
  }
  if (concerns.includes('物流/运费压力')) {
    return '客户正在质疑物流或运费成本,这通常说明需要把产品价格、运输方案和总到手成本拆开说明;下一步应比较不同运输方式、目的港费用和订单数量对运费摊薄的影响。';
  }
  if (concerns.includes('小单/MOQ压力')) {
    return '客户只想小批量试单或低于常规 MOQ,这通常说明需要同时判断客户意向、试单数量、利润和后续放量可能;下一步应说明可接受的起订量、样品或试单政策和升级到正式订单的条件。';
  }
  if (concerns.includes('独家代理/渠道合作')) {
    return '客户想做独家代理或渠道合作,这通常说明不能先口头承诺代理权;下一步应先确认区域边界、销量承诺、价格体系和试运行条件,再决定是否进入正式授权谈判。';
  }
  return `客户已经在问${concerns.join('、')},这通常说明他开始评估供应条件,下一步应先补齐采购约束,再决定是否报价。`;
}

/**
 * buildFollowupCadenceSection 根据用户是否明确要跟进节奏生成执行段落。
 *
 * 参数：
 * - signals：已从用户输入里提取出的业务信号对象。
 * - userText：用户原始输入文本。
 *
 * 返回值：Markdown 行数组；没有请求节奏时返回空数组。
 * 可能抛出的异常：无。
 */
function buildFollowupCadenceSection({ signals = {}, userText = '' } = {}) {
  const lower = String(userText || '').toLowerCase();
  const wantsSevenDayCadence = /7\s*天|七天|一周|1\s*周|7-day|seven[-\s]?day|weekly/.test(lower) &&
    /跟进|回访|节奏|计划|follow[-\s]?up/.test(lower);
  if (!wantsSevenDayCadence) {
    return [];
  }

  const product = signals.productChinese || '该产品';
  const lowPressureReason = signals.concernsChinese?.includes('客户沉默/未回复')
    ? '不追问是否下单,先用低压力理由重新打开对话。'
    : '先用低压力理由确认客户当前优先级。';

  return [
    '## 7天跟进节奏',
    '',
    `- 第1天: 发一条轻量提醒,围绕${product}补充一个有用信息点,${lowPressureReason}`,
    '- 第3天: 换一个触达理由,补充 1 个客户可能关心的规格、交期、案例或样品选项。',
    '- 第5天: 给出两个清晰选项,例如继续看资料、确认数量、安排样品或暂缓跟进。',
    '- 第7天: 做一次收口,说明后续会降低打扰频率,同时留下一个容易回复的问题。',
    '- 任一节点客户回复后,先记录客户原话,再决定是否报价、发样品或保存到客户档案。',
    '',
  ];
}

function extractBusinessSignals(userText = '') {
  const text = String(userText || '');
  const lower = text.toLowerCase();
  const concerns = [];

  const hasSmallOrderPressure = /小批量|小单|试单|小数量|少量试|低于\s*moq|moq\s*太高|起订量太高|small\s+(?:trial\s+)?order|trial\s+order/.test(lower);
  if (hasSmallOrderPressure) {
    concerns.push({ chinese: '小单/MOQ压力', english: 'small order/MOQ pressure' });
  } else if (/moq|起订量|最小起订|起订/.test(lower)) {
    concerns.push({ chinese: 'MOQ/起订量', english: 'MOQ' });
  }
  if (/独家代理|独代|代理权|区域代理|总代理|渠道代理|经销代理|分销代理|exclusive\s+(?:agent|agency|distributor)|distribution\s+rights/.test(lower)) {
    concerns.push({ chinese: '独家代理/渠道合作', english: 'exclusive agency/channel partnership' });
  }
  if (/交期|lead\s*time|delivery|发货时间/.test(lower)) {
    concerns.push({ chinese: '交期', english: 'lead time' });
  }
  if (/砍价|压价|还价|议价|让价|降价|折扣|discount|price\s+cut|price\s+reduction/.test(lower)) {
    concerns.push({ chinese: '议价/折扣压力', english: 'price negotiation pressure' });
  }
  if (/价格|报价|price|target price/.test(lower)) {
    concerns.push({ chinese: '价格/报价', english: 'pricing' });
  }
  if (/付款|账期|赊账|月结|付款条件|付款方式|payment\s+terms|credit\s+terms/.test(lower)) {
    concerns.push({ chinese: '付款/账期压力', english: 'payment terms pressure' });
  }
  if (/质量(?:不行|问题|投诉)?|货有问题|售后|抱怨|投诉|quality\s+(?:issue|complaint|problem)|after[-\s]?sales/.test(lower)) {
    concerns.push({ chinese: '质量/售后风险', english: 'quality/after-sales risk' });
  }
  const hasSampleCostPressure = /免费样品|样品费|样品费用|不想付样品|不付样品|免样品费|free\s+sample|sample\s+fee/.test(lower);
  if (hasSampleCostPressure) {
    concerns.push({ chinese: '样品/费用压力', english: 'sample cost pressure' });
  } else if (/样品|sample/.test(lower)) {
    concerns.push({ chinese: '样品', english: 'samples' });
  }
  if (/运费|物流|运输费|运输成本|海运费|空运费|freight|shipping\s+cost|logistics\s+cost/.test(lower)) {
    concerns.push({ chinese: '物流/运费压力', english: 'logistics/shipping cost pressure' });
  }
  if (/沉默|已读不回|没回复|未回复|不回复|不回消息|不回信|没回|no\s+reply|not\s+replying|no\s+response/.test(lower)) {
    concerns.push({ chinese: '客户沉默/未回复', english: 'customer silence/no reply' });
  }
  if (/认证|certification|certificate|ce|fda/.test(lower)) {
    concerns.push({ chinese: '认证', english: 'certification' });
  }

  const country = detectCountry(text);
  const productChinese = extractProductName(text);
  const sampleTiming = detectSampleTiming(text);
  return {
    countryChinese: country.chinese,
    countryEnglish: country.english,
    concernsChinese: [...new Set(concerns.map((item) => item.chinese))],
    concernsEnglish: [...new Set(concerns.map((item) => item.english))],
    productChinese,
    productEnglish: translateProductName(productChinese),
    sampleTimingChinese: sampleTiming.chinese,
    sampleTimingEnglish: sampleTiming.english,
  };
}

/**
 * extractQuotationFields 从自然语言报价任务里抽取报价单字段。
 *
 * 作用：
 * - 让报价单 XLSX 使用用户已经提供的事实,不编造价格、数量或贸易条款。
 * - 缺失字段会写成“待确认”,前置 gate 会尽量在执行前拦住关键缺口。
 *
 * 参数：
 * - userText：用户原始输入文本。
 *
 * 返回值：报价单字段对象。
 * 可能抛出的异常：无。
 */
function extractQuotationFields(userText = '') {
  const signals = extractBusinessSignals(userText);
  return {
    country: signals.countryChinese || '待确认',
    priceTerm: extractQuotationPrice(userText) || '待确认',
    product: signals.productChinese || '待确认',
    quantity: extractQuotationQuantity(userText) || '待确认',
    tradeTerm: extractQuotationTradeTerm(userText) || '待确认',
  };
}

/**
 * extractQuotationQuantity 抽取报价数量。
 *
 * 参数：
 * - text：用户输入。
 *
 * 返回值：数量文本,例如 `500套`;未识别时返回空字符串。
 * 可能抛出的异常：无。
 */
function extractQuotationQuantity(text = '') {
  const value = String(text || '');
  const explicit = value.match(/(?:数量|qty|quantity)\s*[:：]?\s*(\d+(?:\.\d+)?\s*(?:套|件|个|箱|台|pcs|pieces|units?|cartons?)?)/i);
  const fallback = value.match(/(\d+(?:\.\d+)?\s*(?:套|件|个|箱|台|pcs|pieces|units?|cartons?))/i);
  return (explicit?.[1] || fallback?.[1] || '').replace(/\s+/g, '').trim();
}

/**
 * extractQuotationPrice 抽取单价或报价区间。
 *
 * 参数：
 * - text：用户输入。
 *
 * 返回值：价格文本,例如 `20美元`;未识别时返回空字符串。
 * 可能抛出的异常：无。
 */
function extractQuotationPrice(text = '') {
  const value = String(text || '');
  const explicit = value.match(/(?:单价|底价|目标价|价格|报价)\s*(?:是|为|:|：)?\s*((?:usd|us\$|\$|rmb|¥|人民币|美元|美金)?\s*\d+(?:\.\d+)?\s*(?:usd|美元|美金|rmb|人民币|元)?)/i);
  const fallback = value.match(/((?:usd|us\$|\$|rmb|¥)\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*(?:usd|美元|美金|rmb|人民币|元))/i);
  return (explicit?.[1] || fallback?.[1] || '').replace(/\s+/g, '').trim();
}

/**
 * extractQuotationTradeTerm 抽取贸易条款和地点。
 *
 * 参数：
 * - text：用户输入。
 *
 * 返回值：贸易条款文本,例如 `FOB深圳`;未识别时返回空字符串。
 * 可能抛出的异常：无。
 */
function extractQuotationTradeTerm(text = '') {
  const value = String(text || '');
  const match = value.match(/\b(fob|cif|exw|ddp|dap|cfr)\s*([^，。；,;\n]*)/i);
  if (!match) {
    return '';
  }
  return `${match[1].toUpperCase()}${String(match[2] || '').trim()}`.trim();
}

/**
 * writeQuotationWorkbook 写入报价单 XLSX。
 *
 * 作用：
 * - 使用 openpyxl 生成真实工作簿,后续继续交给 Runtime XLSX 校验。
 * - 只写普通单元格和列宽,不创建 Excel table 或 drawing,避免校验残留。
 *
 * 参数：
 * - input.outputPath：输出 XLSX 路径。
 * - input.quote：报价字段对象。
 * - input.userText：用户原始任务文本。
 *
 * 返回值：Promise<void>。
 * 可能抛出的异常：Python 进程失败时抛出。
 */
async function writeQuotationWorkbook(input = {}) {
  const payload = {
    outputPath: input.outputPath,
    quote: input.quote || {},
    userText: String(input.userText || '').slice(0, 1200),
  };
  await runPythonScript(`
import json
import sys
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font

payload = json.loads(sys.argv[1])
output_path = Path(payload["outputPath"])
output_path.parent.mkdir(parents=True, exist_ok=True)
quote = payload.get("quote", {})
user_text = payload.get("userText", "")

workbook = Workbook()
sheet = workbook.active
sheet.title = "报价单"
sheet.append(["项目", "内容"])
rows = [
    ("客户/市场", quote.get("country") or "待确认"),
    ("产品", quote.get("product") or "待确认"),
    ("数量", quote.get("quantity") or "待确认"),
    ("单价/报价", quote.get("priceTerm") or "待确认"),
    ("贸易条款", quote.get("tradeTerm") or "待确认"),
    ("任务来源", user_text),
]
for row in rows:
    sheet.append(list(row))

todo = workbook.create_sheet("待确认项")
todo.append(["项目", "说明"])
todo_rows = [
    ("客户名称", "外发或正式报价前确认客户公司名和联系人。"),
    ("报价有效期", "正式发送前确认报价有效期。"),
    ("包装/认证/付款", "根据客户市场补齐包装、认证、付款方式。"),
    ("外发确认", "报价单只在本地生成,外发前必须再次确认。"),
]
for row in todo_rows:
    todo.append(list(row))

for ws in workbook.worksheets:
    for cell in ws[1]:
        cell.font = Font(bold=True)
    ws.column_dimensions["A"].width = 18
    ws.column_dimensions["B"].width = 72

workbook.save(output_path)
`, [JSON.stringify(payload)]);
}

function extractProductName(text = '') {
  const value = String(text || '').trim();
  const match = value.match(/产品(?:是|为|:|：)?\s*([^，。；,;\n]+)/);
  if (!match?.[1]) {
    return '';
  }
  return match[1]
    .replace(/^(是|为)\s*/, '')
    .split(/\s*(?:想|希望|下周|本周|这周|先拿|先要|需要|客户问|买家问|问|询问|咨询|重点|主要|moq|MOQ|起订|交期|lead\s*time|delivery|价格|报价|样品|sample)/i)[0]
    .replace(/\s*(重点|主要|客户|买家|采购商).*$/, '')
    .trim()
    .slice(0, 40);
}

function translateProductName(productName = '') {
  const value = String(productName || '').trim();
  if (!value) {
    return '';
  }
  const knownProducts = [
    { test: /太阳能路灯/, english: 'solar street lights' },
    { test: /太阳能灯/, english: 'solar lights' },
    { test: /LED\s*灯|led\s*灯/i, english: 'LED lights' },
  ];
  return knownProducts.find((item) => item.test.test(value))?.english || value;
}

function detectSampleTiming(text = '') {
  const lower = String(text || '').toLowerCase();
  if (/下周[^。；,，]*样品|样品[^。；,，]*下周|next\s+week[^.]*sample|sample[^.]*next\s+week/.test(lower)) {
    return { chinese: '下周样品计划', english: 'sample plan for next week' };
  }
  if (/样品|sample/.test(lower)) {
    return { chinese: '样品计划', english: 'sample plan' };
  }
  return { chinese: '', english: '' };
}

function detectCountry(text = '') {
  const lower = String(text || '').toLowerCase();
  const countries = [
    { test: /德国|germany|german/, chinese: '德国', english: 'German' },
    { test: /美国|usa|united states|american/, chinese: '美国', english: 'US' },
    { test: /英国|uk|britain|british/, chinese: '英国', english: 'UK' },
    { test: /法国|france|french/, chinese: '法国', english: 'French' },
    { test: /西班牙|spain|spanish/, chinese: '西班牙', english: 'Spanish' },
    { test: /意大利|italy|italian/, chinese: '意大利', english: 'Italian' },
    { test: /巴西|brazil|brazilian/, chinese: '巴西', english: 'Brazilian' },
    { test: /印度|india|indian/, chinese: '印度', english: 'Indian' },
  ];
  return countries.find((country) => country.test.test(lower)) || { chinese: '', english: '' };
}

function joinEnglishList(items = []) {
  const values = items.filter(Boolean);
  if (values.length <= 1) {
    return values[0] || '';
  }
  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }
  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
}

function sanitizeMarkdownText(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 1200);
}

/**
 * sanitizeBusinessVisibleInput 清理写进业务产物的用户输入摘要。
 *
 * 作用：
 * - Runtime 为了恢复 waiting / confirmation 会在内部拼接 `产出类型` 和 `补充资料`。
 * - 这些词属于系统恢复痕迹,不能出现在 Markdown 产物的「任务来源 / 用户目标」里。
 * - 这里只清理展示文本;业务信号提取仍然读取原始 userText,避免丢失产品、MOQ、交期等事实。
 *
 * 参数：
 * - value：Runtime 收到的原始任务文本,可能包含内部恢复标记。
 *
 * 返回值：用户能理解的业务输入摘要。
 * 可能抛出的异常：无。
 */
function sanitizeBusinessVisibleInput(value) {
  let text = sanitizeMarkdownText(value || '用户未补充具体资料');

  text = text
    .replace(/^帮我准备一封(?:询盘回复草稿|跟进开发信)。原始需求:\s*/u, '')
    .replace(/^产出类型\s*[:：]\s*[^；;。\n]+[；;]\s*/u, '')
    .replace(/(^|[；;]\s*)补充资料\s*[:：]\s*/gu, (match) => {
      const hasLeadingSeparator = /^[；;]/u.test(match.trimStart());
      return hasLeadingSeparator ? '；' : '';
    })
    .replace(/[；;]\s*[；;]+/gu, '；')
    .replace(/^[；;\s]+|[；;\s]+$/gu, '')
    .trim();

  return text || '用户未补充具体资料';
}

/**
 * runPythonScript 运行短 Python 脚本。
 *
 * 作用：
 * - 复用 bundled Python / openpyxl 生成 XLSX。
 * - 用户输入通过 argv 传递,不拼进脚本代码里。
 *
 * 参数：
 * - script：Python 脚本文本。
 * - args：附加命令行参数。
 *
 * 返回值：Promise<string>，stdout 文本。
 * 可能抛出的异常：Python 启动失败或退出码非 0。
 */
function runPythonScript(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(CODEX_BUNDLED_PYTHON, ['-c', script, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
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
      reject(new Error(stderr || stdout || `python script failed with ${exitCode}`));
    });
  });
}

function countMarkdownSections(content) {
  return String(content || '').split('\n').filter((line) => /^##\s+/.test(line)).length;
}

async function allowPolicy(action) {
  return { decision: 'allow', why: `默认允许 ${action}` };
}

function buildUnsupportedResult({ loopSteps, runId, runLogPath, text }) {
  return {
    ok: false,
    error: 'UNSUPPORTED_AGENT_GOAL',
    message: `当前新对话 Agent 暂不支持：${text || '空目标'}`,
    runId,
    runLogPath,
    loop: { maxSteps: 8, status: 'failed', steps: loopSteps },
  };
}

function buildFailedResult({ loopSteps, runId, runLogPath, state }) {
  return {
    ok: false,
    error: 'SKILL_RUNTIME_FAILED',
    runId,
    runLogPath,
    goal: state.goal,
    skill: state.skill,
    loop: { maxSteps: 8, status: 'failed', steps: loopSteps },
  };
}

function buildWaitingResult({ action, checkpoint, checkpointPath, decision, loopSteps, runId, runLogPath, state }) {
  return {
    ok: true,
    runId,
    runLogPath,
    goal: state.goal,
    skill: state.skill,
    loadedSkill: state.loadedSkill,
    plan: state.plan,
    waiting: {
      action,
      checkpointPath,
      decision: decision.decision,
      reason: decision.why,
      resumeFrom: checkpoint.resume_from,
      runId,
    },
    loop: {
      maxSteps: 8,
      status: 'waiting',
      steps: loopSteps,
    },
  };
}

function buildPlan(skill, goal) {
  if (Array.isArray(skill.plan) && skill.plan.length > 0) {
    return {
      title: `${skill.displayName || skill.id}执行计划`,
      steps: skill.plan,
    };
  }

  const periodText = goal.periodHint === 'previous_full_week' ? '上周完整自然周' : '当前目标周期';
  return {
    title: `${skill.displayName || skill.id}执行计划`,
    steps: [
      { id: 'understand_goal', label: '理解目标', detail: goal.reason },
      { id: 'load_skill', label: '读取Skill', detail: '读取当前 Skill 定义和产物要求。' },
      { id: 'resolve_period', label: '确定周期', detail: `按${periodText}准备执行。` },
      { id: 'run_skill', label: '执行任务', detail: '调用 Skill 适配器生成业务产物。' },
      { id: 'verify_artifact', label: '校验产物', detail: '确认产物可以交付。' },
    ],
  };
}

function toLoopStep(action, title, detail, observation, status, nextAction) {
  return {
    action,
    title,
    detail,
    observation,
    status,
    nextAction,
    nextActionReason: nextAction === 'none' ? '无后续动作。' : `根据 ${observation} 进入 ${nextAction}。`,
  };
}

function loadedSkillDetail(state) {
  const files = state.loadedSkill?.requiredFiles || [];
  if (files.length > 0) {
    return `已读取 ${files.join(' / ')}。`;
  }
  return `已读取 ${state.skill.displayName || state.skill.id} 的 Skill 定义。`;
}

function actionDetail(state) {
  if (state.artifact?.name) {
    return `已生成 ${state.artifact.name}。`;
  }
  return `已执行 ${state.skill.displayName || state.skill.id}。`;
}

function buildObservation(state) {
  const parts = [];
  if (state.artifact?.name) {
    parts.push(`产物：${state.artifact.name}`);
  }
  if (state.result?.toolSummary) {
    parts.push(`只读采集：${state.result.toolSummary.succeeded ?? 0}/${state.result.toolSummary.attempted ?? 0}`);
  }
  if (state.result?.summary?.createdItems) {
    parts.push(`生成条目：${state.result.summary.createdItems}`);
  }
  return parts.join('；') || '已返回可用结果。';
}

async function verifyArtifact(artifact, skill = {}, options = {}) {
  if (!artifact?.outputPath) {
    return { ok: false, message: '没有返回产物路径。' };
  }

  if (artifact.type === 'xlsx') {
    return validateXlsxArtifact({
      forbiddenSheets: skill.forbiddenSheets || ['数据质量检查'],
      outputPath: artifact.outputPath,
      requiredSheets: skill.requiredSheets || [],
    });
  }

  try {
    const fileStat = await stat(artifact.outputPath);
    if (isBusinessMarkdownArtifact({ artifact, skill })) {
      return await verifyBusinessMarkdownArtifact({
        artifact,
        fileStat,
        userText: options.userText,
      });
    }

    return {
      ok: fileStat.isFile() && fileStat.size > 0,
      message: fileStat.isFile() ? '产物存在。' : '产物路径不是文件。',
      bytes: fileStat.size,
    };
  } catch (error) {
    return {
      ok: false,
      message: error.code === 'ENOENT' ? '产物文件不存在。' : error.message,
    };
  }
}

/**
 * isBusinessMarkdownArtifact 判断产物是否需要业务依据质量门。
 *
 * 作用：
 * - 普通 mock markdown 只需要基础文件校验。
 * - 外贸业务草稿必须检查依据段和用户事实覆盖,避免“文件非空”就被当成交付成功。
 *
 * 参数：
 * - artifact：Runtime 规范化后的产物摘要。
 * - skill：当前匹配到的 Skill 定义。
 *
 * 返回值：需要业务依据校验时返回 true。
 * 可能抛出的异常：无。
 */
function isBusinessMarkdownArtifact({ artifact = {}, skill = {} } = {}) {
  const name = String(artifact.name || artifact.outputPath || '').toLowerCase();
  const isMarkdown = artifact.type === 'markdown' || name.endsWith('.md') || name.endsWith('.txt');
  return isMarkdown && skill.adapter === 'business-draft';
}

/**
 * verifyBusinessMarkdownArtifact 校验 Markdown 业务产物的依据覆盖。
 *
 * 作用：
 * - 确认产物不是只有一个非空文件,而是真的带了可回看的业务依据。
 * - 把用户输入里识别出的产品、国家/市场、客户关注点逐项核对到产物正文。
 * - 产出机器可读 evidence ledger,供 run log、测试和后续 evaluator 继续使用。
 *
 * 参数：
 * - artifact：Runtime 产物摘要,必须包含 outputPath。
 * - fileStat：fs.stat() 返回的文件状态。
 * - userText：本轮 Runtime 执行使用的用户输入。
 *
 * 返回值：Runtime artifact verification 对象。
 * 可能抛出的异常：readFile 失败时向上抛出,由 verifyArtifact 包装成失败结果。
 */
async function verifyBusinessMarkdownArtifact({ artifact = {}, fileStat = {}, userText = '' } = {}) {
  const content = await readFile(artifact.outputPath, 'utf8');
  const signals = extractBusinessSignals(userText);
  const missingFacts = [];
  const checkedFacts = [];
  const checks = {
    nonEmptyFile: fileStat.isFile() && fileStat.size > 0,
    hasEvidenceSection: /^##\s*依据\s*$/mu.test(content),
    hasUserSourceLine: /(?:任务来源|用户目标|用户补充)\s*:/u.test(content),
    noInternalResumeMarkers: !/(?:产出类型|补充资料|原始需求)/u.test(content),
  };

  if (!checks.hasEvidenceSection) {
    missingFacts.push('依据段');
  }
  if (!checks.hasUserSourceLine) {
    missingFacts.push('用户来源');
  }
  if (!checks.noInternalResumeMarkers) {
    missingFacts.push('去除内部恢复标记');
  }

  collectEvidenceFact({
    content,
    label: '产品',
    missingFacts,
    value: signals.productChinese,
    checkedFacts,
  });
  collectEvidenceFact({
    alternatives: [signals.countryEnglish],
    content,
    label: '客户/市场',
    missingFacts,
    value: signals.countryChinese,
    checkedFacts,
  });

  for (const concern of signals.concernsChinese || []) {
    collectEvidenceFact({
      content,
      label: '关注点',
      missingFacts,
      value: concern,
      checkedFacts,
    });
  }

  const ok = checks.nonEmptyFile && missingFacts.length === 0;
  return {
    ok,
    message: ok
      ? '业务依据检查通过: 产物已覆盖用户提供的关键事实。'
      : `业务依据检查未通过: 缺少 ${missingFacts.join('、')}。`,
    bytes: fileStat.size,
    checks,
    evidence: {
      checkedFacts,
      coverage: ok ? 'complete' : 'incomplete',
      missingFacts,
      source: '用户原始输入 + 产物依据段',
    },
  };
}

/**
 * collectEvidenceFact 把一个用户事实加入 evidence ledger 并检查正文覆盖。
 *
 * 作用：
 * - 没有识别到的事实不强行检查,避免凭空增加缺口。
 * - 识别到的事实必须在业务产物里出现,可以使用中文值或允许的英文替代表达。
 *
 * 参数：
 * - content：Markdown 产物正文。
 * - label：事实类别,例如 产品、客户/市场、关注点。
 * - value：事实值。
 * - alternatives：可接受的替代表达。
 * - checkedFacts：用于记录已检查事实的数组。
 * - missingFacts：用于记录未覆盖事实的数组。
 *
 * 返回值：无,直接修改 checkedFacts / missingFacts。
 * 可能抛出的异常：无。
 */
function collectEvidenceFact(input = {}) {
  const value = String(input.value || '').trim();
  if (!value) {
    return;
  }

  const fact = `${input.label}:${value}`;
  input.checkedFacts.push(fact);

  const candidates = [value, ...(input.alternatives || [])].filter(Boolean);
  if (!candidates.some((candidate) => containsBusinessText(input.content, candidate))) {
    input.missingFacts.push(fact);
  }
}

/**
 * containsBusinessText 判断正文是否包含某个业务事实。
 *
 * 作用：
 * - 中英文和空格大小写差异不应该导致 evidence check 误判。
 * - 保持规则简单透明,不引入模型判断,方便后续扩展 typed evaluator。
 *
 * 参数：
 * - content：待检查正文。
 * - expected：用户事实或替代表达。
 *
 * 返回值：包含时返回 true。
 * 可能抛出的异常：无。
 */
function containsBusinessText(content = '', expected = '') {
  const haystack = normalizeEvidenceText(content);
  const needle = normalizeEvidenceText(expected);
  return Boolean(needle) && haystack.includes(needle);
}

/**
 * normalizeEvidenceText 归一化 evidence 文本。
 *
 * 作用：
 * - 去掉空白并统一小写,让 `lead time` 和 `lead  time` 这类差异不影响校验。
 *
 * 参数：
 * - value：任意文本。
 *
 * 返回值：归一化后的字符串。
 * 可能抛出的异常：无。
 */
function normalizeEvidenceText(value = '') {
  return String(value || '').toLowerCase().replace(/\s+/g, '');
}

function normalizeArtifact(result, skill) {
  const artifact = result?.artifact || {};
  return {
    type: artifact.type || skill.artifactType || 'file',
    name: artifact.name || result?.workbookName || path.basename(artifact.outputPath || result?.outputPath || ''),
    outputPath: artifact.outputPath || result?.outputPath || '',
    manifestPath: artifact.manifestPath || result?.manifestPath || '',
    validation: artifact.validation || result?.validation || {},
  };
}

async function appendRunEvent(runLogPath, event, onEvent = null) {
  const record = { at: new Date().toISOString(), ...event };
  await appendFile(runLogPath, `${JSON.stringify(record)}\n`, 'utf8');
  if (onEvent) {
    await onEvent(record);
  }
}

function getRuntimeCheckpointPath({ runId, workbenchRoot }) {
  return path.join(workbenchRoot, 'runs', `${runId}.checkpoint.json`);
}

async function writeRuntimeCheckpoint({ checkpoint, runId, workbenchRoot }) {
  const checkpointPath = getRuntimeCheckpointPath({ runId, workbenchRoot });
  await writeFile(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8');
  return checkpointPath;
}

function generateRunId(prefix) {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
  const random = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  return `${prefix}-${stamp}-${random}`;
}

function summarizeText(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length > 120 ? `${value.slice(0, 117)}...` : value;
}
