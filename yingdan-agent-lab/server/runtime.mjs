import { appendFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const WORKBENCH_DIRS = [
  'agents/inquiry-follow-up',
  'customers/global-sourcing-inc',
  'skills/inquiry-reply',
  'registry',
  'runs',
  'artifacts',
];

const DEFAULT_POLICY_RULES = [
  { action: 'customer.read_profile', decision: 'allow', why: '读取当前客户档案' },
  { action: 'customer.write_memory', decision: 'ask', why: '写入客户记忆需用户确认' },
  { action: 'skill.read_external_package', decision: 'allow', why: '读取用户指定的外部 Skill 包' },
  { action: 'artifact.write_xlsx', decision: 'allow', why: '写入本地 XLSX 产物' },
  { action: 'artifact.validate_xlsx', decision: 'allow', why: '执行交付前 XLSX 安全校验' },
  { action: 'artifact.export_file', decision: 'ask', why: '导出可能外泄底价或客户隐私' },
  { action: 'alibaba.read_only_tool', decision: 'allow', why: '只读采集询盘复盘需要的数据' },
  { action: 'alibaba.send_message', decision: 'deny', why: '询盘复盘只生成待人工确认动作' },
  { action: 'alibaba.update_config', decision: 'deny', why: '第一版禁止自动修改国际站配置' },
  { action: 'alibaba.publish_product', decision: 'deny', why: '第一版禁止自动发布或编辑商品' },
  { action: 'paid_api.call', decision: 'ask', why: '付费 API 调用需用户确认' },
  { action: 'message.send_email', decision: 'deny', why: '第一版禁止自动外发邮件' },
  { action: 'system.run_shell', decision: 'deny', why: '第一版禁止执行命令' },
  { action: 'system.run_unapproved_shell', decision: 'deny', why: '只允许白名单 builder 和校验命令' },
];

const DEFAULT_PROGRESS = [
  { label: '读取客户档案', detail: '已读取客户 profile 和 memory', status: 'complete' },
  { label: '分析询盘意向', detail: '已判断意向、缺口和风险', status: 'complete' },
  { label: '生成英文回复', detail: '已生成回复草稿和跟进计划', status: 'complete' },
  { label: '等待确认保存', detail: '保存到客户记忆前需要确认', status: 'pending', needsConfirmation: true },
];

/**
 * createRuntime 创建赢单第一刀 Runtime 对象。
 *
 * 作用：
 * - 把项目根目录、环境变量和可替换模型客户端封装成一个运行时实例。
 * - 暴露初始化 workbench、询盘分析、确认保存和 policy 检查等方法。
 *
 * 参数：
 * - options.projectRoot：项目根目录，字符串；默认使用当前进程目录。
 * - options.env：环境变量对象；默认使用 process.env。
 * - options.modelClient：可选模型客户端函数，测试时可注入，生产时默认调用 DeepSeek。
 *
 * 返回值：包含 Runtime 方法的对象。
 * 可能抛出的异常：本函数本身不主动抛异常；后续方法可能因文件权限、JSON 解析或网络请求失败抛异常。
 */
export function createRuntime(options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const env = options.env || process.env;
  const modelClient = options.modelClient || ((request) => callDeepSeek({ ...request, env }));
  const workbenchRoot = path.join(projectRoot, 'workbench');

  return {
    analyzeInquiry,
    checkPolicy,
    confirmRun,
    createRunForTest,
    ensureWorkbench,
    projectRoot,
    workbenchRoot,
  };

  /**
   * ensureWorkbench 初始化第一刀需要的文件事实源。
   *
   * 作用：
   * - 创建 workbench 的 agent、customer、skill、registry、runs、artifacts 目录。
   * - 写入默认 Agent 定义、示例客户档案、客户长期记忆、Skill 契约和 policy。
   * - 只在文件不存在时写入，避免覆盖用户后续积累的客户记忆。
   *
   * 参数：无。
   * 返回值：Promise<void>。
   * 可能抛出的异常：目录或文件写入失败时抛出系统文件异常。
   */
  async function ensureWorkbench() {
    await Promise.all(WORKBENCH_DIRS.map((dir) => mkdir(path.join(workbenchRoot, dir), { recursive: true })));

    await writeIfMissing(
      path.join(workbenchRoot, 'agents/inquiry-follow-up/persona.md'),
      [
        '# 询盘跟进 Agent',
        '',
        '你是赢单外贸业务员的询盘跟进顾问。',
        '你的目标是结合客户档案和客户记忆，判断询盘意向、找出信息缺口、生成英文回复和下一步动作。',
        '不要自动发送邮件，不要自动写入客户档案；写入前必须等待用户确认。',
        '',
      ].join('\n'),
    );

    await writeIfMissing(
      path.join(workbenchRoot, 'agents/inquiry-follow-up/playbook.md'),
      [
        '# 询盘跟进打法',
        '',
        '1. 先判断客户是否给出明确产品、数量、条款或定制需求。',
        '2. 再结合客户历史记忆判断是否是新询盘、比价、复购或样品推进。',
        '3. 输出必须说明判断依据，避免只给空泛建议。',
        '4. 英文回复先澄清关键缺口，再承接报价或样品动作。',
        '',
      ].join('\n'),
    );

    await writeIfMissing(
      path.join(workbenchRoot, 'customers/global-sourcing-inc/profile.md'),
      [
        '# Global Sourcing Inc.',
        '',
        '- 客户名称: Global Sourcing Inc.',
        '- 国家/地区: United States',
        '- 来源渠道: Alibaba.com 询盘',
        '- 当前阶段: 新询盘待回复',
        '- 重点产品: 500ml 不锈钢保温杯',
        '- 关注点: 价格、MOQ、交期、Logo printing、包装方式',
        '',
      ].join('\n'),
    );

    await writeIfMissing(
      path.join(workbenchRoot, 'customers/global-sourcing-inc/memory.md'),
      [
        '# Global Sourcing Inc. Memory',
        '',
        '- 客户来自 United States，过去询问过 500ml 不锈钢保温杯。',
        '- 上次报价 $2.40，客户关注 FOB Shanghai、MOQ、交期和 Logo printing。',
        '- 跟进时要避免直接降价，先确认包装、交期和样品需求。',
        '',
      ].join('\n'),
    );

    await writeIfMissing(
      path.join(workbenchRoot, 'skills/inquiry-reply/SKILL.md'),
      [
        '# 询盘分析回复',
        '',
        '用途: 判断客户询盘意向，识别信息缺口和风险，生成英文回复草稿与下一步跟进计划。',
        '输入: inquiryText、customerSlug。',
        '输出: intention、missingInfo、risks、replyDraft、nextSteps。',
        '风险: 保存到客户记忆前必须确认，禁止自动外发。',
        '',
      ].join('\n'),
    );

    await writeIfMissing(
      path.join(workbenchRoot, 'skills/inquiry-reply/skill.json'),
      JSON.stringify(
        {
          id: 'inquiry-reply',
          name: '询盘分析回复',
          allowedActions: ['analyze_inquiry', 'draft_reply', 'suggest_next_steps', 'write_artifact', 'finish'],
          riskPolicy: {
            'customer.write_memory': 'ask',
            'message.send_email': 'deny',
          },
        },
        null,
        2,
      ),
    );

    await writeIfMissing(
      path.join(workbenchRoot, 'skills/inquiry-reply/input.schema.json'),
      JSON.stringify(
        {
          type: 'object',
          required: ['customerSlug', 'inquiryText'],
          properties: {
            customerSlug: { type: 'string' },
            inquiryText: { type: 'string' },
          },
        },
        null,
        2,
      ),
    );

    await writeIfMissing(
      path.join(workbenchRoot, 'skills/inquiry-reply/output.schema.json'),
      JSON.stringify(
        {
          type: 'object',
          required: ['intention', 'missingInfo', 'risks', 'replyDraft', 'nextSteps'],
          properties: {
            intention: { type: 'object' },
            missingInfo: { type: 'array', items: { type: 'string' } },
            risks: { type: 'array', items: { type: 'string' } },
            replyDraft: { type: 'string' },
            nextSteps: { type: 'array', items: { type: 'string' } },
          },
        },
        null,
        2,
      ),
    );

    await writeIfMissing(
      path.join(workbenchRoot, 'registry/policy.jsonl'),
      `${DEFAULT_POLICY_RULES.map((rule) => JSON.stringify(rule)).join('\n')}\n`,
    );
  }

  /**
   * analyzeInquiry 执行第一刀询盘分析 Runtime。
   *
   * 作用：
   * - 读取当前 Agent、Skill、客户 profile 和 memory。
   * - 通过模型生成意向判断、信息缺口、风险、英文回复草稿和下一步动作。
   * - 写入 append-only run log、artifact 和 checkpoint。
   * - 在写客户 memory 前停到 waiting，等待用户确认。
   *
   * 参数：
   * - input.customerSlug：客户目录 slug，字符串。
   * - input.inquiryText：客户询盘原文，字符串。
   * - input.mode：模型模式，字符串；`fast` 全流程用 flash，`deep` 对分析和草稿用 pro。
   *
   * 返回值：Promise<object>，成功时包含 runId、status、progress、result；无 Key 时返回 MODEL_NOT_CONFIGURED。
   * 可能抛出的异常：文件读写失败、模型请求失败或模型 JSON 无法解析时抛异常，并尽量写入 run.failed。
   */
  async function analyzeInquiry(input) {
    await ensureWorkbench();

    if (!env.DEEPSEEK_API_KEY) {
      return { ok: false, error: 'MODEL_NOT_CONFIGURED', demo: false };
    }

    const customerSlug = input.customerSlug || 'global-sourcing-inc';
    const inquiryText = String(input.inquiryText || '').trim();
    const mode = input.mode === 'deep' ? 'deep' : 'fast';

    if (!inquiryText) {
      return { ok: false, error: 'INQUIRY_TEXT_REQUIRED', demo: false };
    }

    const runId = generateRunId();
    const runLogPath = getRunLogPath(runId);

    await appendRunEvent(runId, {
      type: 'run.started',
      status: 'running',
      customerSlug,
      skillId: 'inquiry-reply',
      mode,
    });

    try {
      const context = await loadRuntimeContext(customerSlug);

      await appendRunEvent(runId, {
        type: 'context.loaded',
        sources: context.sources,
        summary: `读取 ${customerSlug} 的 profile、memory、Agent 和 Skill`,
      });

      await appendRunEvent(runId, { type: 'runtime.tick', action: 'analyze_inquiry', allowedActions: context.allowedActions });
      const analysis = parseModelJson(
        await invokeModel({
          context,
          inquiryText,
          mode,
          purpose: 'analyze_inquiry',
          taskType: mode === 'deep' ? 'deep' : 'fast',
        }),
        'analyze_inquiry',
      );
      await appendRunEvent(runId, {
        type: 'model.called',
        model: resolveModelName(mode === 'deep' ? 'deep' : 'fast'),
        purpose: 'analyze_inquiry',
        taskType: mode === 'deep' ? 'deep' : 'fast',
        inputSummary: summarizeInquiry(inquiryText),
        outputSummary: analysis.intention?.level || '已生成意向判断',
      });

      await appendRunEvent(runId, { type: 'runtime.tick', action: 'draft_reply', allowedActions: context.allowedActions });
      const draft = parseModelJson(
        await invokeModel({
          context,
          inquiryText,
          mode,
          purpose: 'draft_reply',
          taskType: mode === 'deep' ? 'deep' : 'fast',
          previousResult: analysis,
        }),
        'draft_reply',
      );
      await appendRunEvent(runId, {
        type: 'model.called',
        model: resolveModelName(mode === 'deep' ? 'deep' : 'fast'),
        purpose: 'draft_reply',
        taskType: mode === 'deep' ? 'deep' : 'fast',
        inputSummary: '结合客户记忆生成英文回复草稿',
        outputSummary: '英文回复草稿已生成',
      });

      const resultAfterDraft = normalizeResult({ ...analysis, ...draft });
      const artifactPath = await writeReplyArtifact(runId, resultAfterDraft.replyDraft);
      await appendRunEvent(runId, {
        type: 'artifact.written',
        path: path.relative(workbenchRoot, artifactPath),
        summary: '英文回复草稿已写入 artifact',
      });

      await appendRunEvent(runId, { type: 'runtime.tick', action: 'suggest_next_steps', allowedActions: context.allowedActions });
      const nextSteps = parseModelJson(
        await invokeModel({
          context,
          inquiryText,
          mode: 'fast',
          purpose: 'suggest_next_steps',
          taskType: 'fast',
          previousResult: resultAfterDraft,
        }),
        'suggest_next_steps',
      );
      await appendRunEvent(runId, {
        type: 'model.called',
        model: resolveModelName('fast'),
        purpose: 'suggest_next_steps',
        taskType: 'fast',
        inputSummary: '生成下一步跟进动作',
        outputSummary: `${Array.isArray(nextSteps.nextSteps) ? nextSteps.nextSteps.length : 0} 个下一步动作`,
      });

      const result = normalizeResult({ ...resultAfterDraft, ...nextSteps });
      const policy = await checkPolicy('customer.write_memory', { runId });
      const checkpoint = {
        runId,
        status: 'waiting',
        resume_from: 'customer.write_memory',
        customerSlug,
        result,
        memoryEntry: buildMemoryEntry(result),
        artifactPath: path.relative(workbenchRoot, artifactPath),
        createdAt: new Date().toISOString(),
      };

      await writeCheckpoint(runId, checkpoint);
      await appendRunEvent(runId, {
        type: 'run.checkpointed',
        checkpoint: path.relative(workbenchRoot, getCheckpointPath(runId)),
        resume_from: checkpoint.resume_from,
      });
      await appendRunEvent(runId, {
        type: 'run.waiting',
        status: 'waiting',
        reason: policy.why,
        resume_from: checkpoint.resume_from,
      });

      return {
        ok: true,
        demo: false,
        runId,
        status: 'waiting',
        progress: DEFAULT_PROGRESS,
        result,
        runLogPath,
      };
    } catch (error) {
      await appendRunEvent(runId, {
        type: 'run.failed',
        status: 'failed',
        error: error.code || error.name || 'RUNTIME_ERROR',
        message: error.message,
      });
      throw error;
    }
  }

  /**
   * confirmRun 从 checkpoint 恢复并写入客户 memory。
   *
   * 作用：
   * - 读取 waiting checkpoint。
   * - 追加 run.resumed 事件。
   * - 在用户确认后把摘要和下一步动作追加到客户 memory.md。
   * - 追加 memory.updated 和 run.completed 事件。
   *
   * 参数：
   * - input.runId：要确认保存的运行 ID，字符串。
   *
   * 返回值：Promise<object>，成功时返回 ok=true 和 status=completed。
   * 可能抛出的异常：checkpoint 缺失、policy 拒绝、文件写入失败时抛异常。
   */
  async function confirmRun(input) {
    await ensureWorkbench();

    const runId = input.runId;
    const checkpointPath = getCheckpointPath(runId);
    const checkpoint = JSON.parse(await readFile(checkpointPath, 'utf8'));

    if (checkpoint.status !== 'waiting' || checkpoint.resume_from !== 'customer.write_memory') {
      throw Object.assign(new Error('Run checkpoint is not waiting for customer.write_memory'), { code: 'RUN_NOT_WAITING' });
    }

    await appendRunEvent(runId, {
      type: 'run.resumed',
      status: 'resuming',
      resume_from: checkpoint.resume_from,
    });

    const policy = await checkPolicy('customer.write_memory', { runId });
    if (policy.decision === 'deny') {
      throw Object.assign(new Error(policy.why), { code: 'POLICY_DENIED' });
    }

    const memoryPath = path.join(workbenchRoot, 'customers', checkpoint.customerSlug, 'memory.md');
    await appendFile(memoryPath, `\n${checkpoint.memoryEntry}\n`, 'utf8');

    await appendRunEvent(runId, {
      type: 'memory.updated',
      target: path.relative(workbenchRoot, memoryPath),
      summary: checkpoint.result.intention?.level || '已保存询盘摘要',
    });

    await writeCheckpoint(runId, { ...checkpoint, status: 'completed', completedAt: new Date().toISOString() });
    await appendRunEvent(runId, { type: 'run.completed', status: 'completed' });

    return { ok: true, runId, status: 'completed' };
  }

  /**
   * checkPolicy 查询并记录 policy 决策。
   *
   * 作用：
   * - 从 registry/policy.jsonl 读取硬执行规则。
   * - 找不到规则时默认 ask，避免未知动作直接放行。
   * - 如果传入 runId，就把 policy.checked 追加到对应 run log。
   *
   * 参数：
   * - action：动作名，字符串，例如 customer.write_memory。
   * - options.runId：可选 run ID，传入后会记录事件。
   *
   * 返回值：Promise<object>，包含 action、decision、why。
   * 可能抛出的异常：policy 文件读取或 JSON 解析失败时抛异常。
   */
  async function checkPolicy(action, options = {}) {
    await ensureWorkbench();

    const rules = await readPolicyRules();
    const decision = rules.find((rule) => rule.action === action) || {
      action,
      decision: 'ask',
      why: '未知动作默认需要用户确认',
    };

    if (options.runId) {
      await appendRunEvent(options.runId, {
        type: 'policy.checked',
        action,
        decision: decision.decision,
        why: decision.why,
      });
    }

    return decision;
  }

  /**
   * createRunForTest 创建测试用 run log。
   *
   * 作用：
   * - 给 policy 测试和本地诊断创建一个最小 run。
   * - 该函数不在前端暴露，只用于验证 append-only 日志行为。
   *
   * 参数：无。
   * 返回值：Promise<string>，新建 runId。
   * 可能抛出的异常：run log 写入失败时抛异常。
   */
  async function createRunForTest() {
    await ensureWorkbench();

    const runId = generateRunId();
    await appendRunEvent(runId, { type: 'run.started', status: 'running', test: true });
    return runId;
  }

  /**
   * loadRuntimeContext 读取一次 run 需要的上下文。
   *
   * 参数：
   * - customerSlug：客户目录 slug，字符串。
   *
   * 返回值：Promise<object>，包含 persona、playbook、skill、profile、memory、sources 和 allowedActions。
   * 可能抛出的异常：必要文件不存在或 JSON 文件无法解析时抛异常。
   */
  async function loadRuntimeContext(customerSlug) {
    const sources = [
      'agents/inquiry-follow-up/persona.md',
      'agents/inquiry-follow-up/playbook.md',
      `customers/${customerSlug}/profile.md`,
      `customers/${customerSlug}/memory.md`,
      'skills/inquiry-reply/SKILL.md',
      'skills/inquiry-reply/skill.json',
    ];

    const [persona, playbook, profile, memory, skillText, skillJsonText] = await Promise.all(
      sources.map((source) => readFile(path.join(workbenchRoot, source), 'utf8')),
    );
    const skill = JSON.parse(skillJsonText);

    return {
      allowedActions: [...skill.allowedActions],
      memory,
      persona,
      playbook,
      profile,
      skill,
      skillText,
      sources,
    };
  }

  /**
   * invokeModel 通过统一入口调用模型客户端。
   *
   * 参数：
   * - request.context：Runtime 上下文对象。
   * - request.inquiryText：询盘文本。
   * - request.mode：模型模式。
   * - request.purpose：本轮模型调用目的。
   * - request.taskType：fast 或 deep。
   * - request.previousResult：可选前一轮结果。
   *
   * 返回值：Promise<object>，模型客户端返回对象，至少含 content。
   * 可能抛出的异常：模型客户端网络失败或返回错误时抛异常。
   */
  async function invokeModel(request) {
    const taskType = request.taskType === 'deep' ? 'deep' : 'fast';
    const messages = buildMessages(request);
    const model = resolveModelName(taskType);

    return modelClient({
      messages,
      model,
      purpose: request.purpose,
      taskType,
    });
  }

  /**
   * buildMessages 组装发给模型的消息。
   *
   * 参数：
   * - request：包含上下文、询盘、目的和前序结果的对象。
   *
   * 返回值：消息数组，符合 OpenAI-compatible chat completions 格式。
   * 可能抛出的异常：不主动抛异常。
   */
  function buildMessages(request) {
    const outputInstruction = getOutputInstruction(request.purpose);
    const previous = request.previousResult ? `\n\n已生成的前序结果:\n${JSON.stringify(request.previousResult, null, 2)}` : '';

    return [
      {
        role: 'system',
        content: [
          request.context.persona,
          request.context.playbook,
          request.context.skillText,
          '你必须只输出 JSON，不要输出 Markdown，不要解释 JSON 外的内容。',
          outputInstruction,
        ].join('\n\n'),
      },
      {
        role: 'user',
        content: [
          '当前客户 profile:',
          request.context.profile,
          '当前客户 memory:',
          request.context.memory,
          '本次客户询盘:',
          request.inquiryText,
          previous,
        ].join('\n\n'),
      },
    ];
  }

  /**
   * getRunLogPath 获取 run log 的绝对路径。
   *
   * 参数：
   * - runId：运行 ID，字符串。
   *
   * 返回值：run log 绝对路径。
   * 可能抛出的异常：不主动抛异常。
   */
  function getRunLogPath(runId) {
    return path.join(workbenchRoot, 'runs', `${runId}.jsonl`);
  }

  /**
   * getCheckpointPath 获取 checkpoint 的绝对路径。
   *
   * 参数：
   * - runId：运行 ID，字符串。
   *
   * 返回值：checkpoint 绝对路径。
   * 可能抛出的异常：不主动抛异常。
   */
  function getCheckpointPath(runId) {
    return path.join(workbenchRoot, 'runs', `${runId}.checkpoint.json`);
  }

  /**
   * appendRunEvent 追加一条 append-only run 事件。
   *
   * 参数：
   * - runId：运行 ID，字符串。
   * - event：事件对象，至少包含 type。
   *
   * 返回值：Promise<void>。
   * 可能抛出的异常：目录创建或文件写入失败时抛异常。
   */
  async function appendRunEvent(runId, event) {
    await mkdir(path.join(workbenchRoot, 'runs'), { recursive: true });
    await appendFile(getRunLogPath(runId), `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`, 'utf8');
  }

  /**
   * writeCheckpoint 写入当前 run 的恢复快照。
   *
   * 参数：
   * - runId：运行 ID，字符串。
   * - checkpoint：checkpoint 对象。
   *
   * 返回值：Promise<void>。
   * 可能抛出的异常：文件写入失败时抛异常。
   */
  async function writeCheckpoint(runId, checkpoint) {
    await writeFile(getCheckpointPath(runId), `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8');
  }

  /**
   * writeReplyArtifact 写入英文回复草稿产物。
   *
   * 参数：
   * - runId：运行 ID，字符串。
   * - replyDraft：英文回复草稿，字符串。
   *
   * 返回值：Promise<string>，产物文件绝对路径。
   * 可能抛出的异常：目录创建或文件写入失败时抛异常。
   */
  async function writeReplyArtifact(runId, replyDraft) {
    const artifactDir = path.join(workbenchRoot, 'artifacts', runId);
    await mkdir(artifactDir, { recursive: true });

    const artifactPath = path.join(artifactDir, 'reply-draft.md');
    await writeFile(artifactPath, `${replyDraft.trim()}\n`, 'utf8');
    return artifactPath;
  }

  /**
   * readPolicyRules 读取 policy.jsonl。
   *
   * 参数：无。
   * 返回值：Promise<Array<object>>，policy 规则数组。
   * 可能抛出的异常：文件读取失败或 JSON 解析失败时抛异常。
   */
  async function readPolicyRules() {
    const content = await readFile(path.join(workbenchRoot, 'registry/policy.jsonl'), 'utf8');
    return content
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }
}

/**
 * callDeepSeek 调用 DeepSeek OpenAI-compatible Chat Completions。
 *
 * 作用：
 * - 所有真实模型调用统一经过这里，避免前端或业务代码散落 API 请求。
 * - 根据 taskType 选择 flash 或 pro；flash 不开 thinking，deep 开 thinking 和 max reasoning。
 * - 不记录、不返回 API Key，避免密钥泄露到日志或前端。
 *
 * 参数：
 * - request.env：环境变量对象，必须包含 DEEPSEEK_API_KEY。
 * - request.model：模型名，字符串。
 * - request.taskType：fast 或 deep。
 * - request.messages：Chat messages 数组。
 *
 * 返回值：Promise<object>，包含 content、model、usage 和 reasoningContent。
 * 可能抛出的异常：无 Key、HTTP 非 2xx、返回结构异常时抛出带 code 的 Error。
 */
export async function callDeepSeek(request) {
  const apiKey = request.env?.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error('DEEPSEEK_API_KEY is not configured'), { code: 'MODEL_NOT_CONFIGURED' });
  }

  const body = {
    model: request.model,
    messages: request.messages,
    response_format: { type: 'json_object' },
    stream: false,
  };

  if (request.taskType === 'deep') {
    body.thinking = { type: 'enabled' };
    body.reasoning_effort = 'max';
  }

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || text || `DeepSeek HTTP ${response.status}`;
    throw Object.assign(new Error(message), { code: `DEEPSEEK_HTTP_${response.status}`, status: response.status, payload });
  }

  const message = payload?.choices?.[0]?.message;
  if (!message?.content) {
    throw Object.assign(new Error('DeepSeek response did not contain choices[0].message.content'), {
      code: 'DEEPSEEK_EMPTY_CONTENT',
      payload,
    });
  }

  return {
    content: message.content,
    model: payload.model || request.model,
    reasoningContent: message.reasoning_content || '',
    usage: payload.usage || null,
  };
}

/**
 * loadEnvFile 读取简单 .env 文件。
 *
 * 作用：
 * - 让本地 Node 服务和 smoke 测试能从项目根目录读取 DEEPSEEK_API_KEY。
 * - 只支持常见 KEY=value 格式，足够覆盖当前第一刀。
 *
 * 参数：
 * - envPath：.env 文件路径，字符串。
 *
 * 返回值：Promise<object>，解析后的键值对象；文件不存在时返回空对象。
 * 可能抛出的异常：文件读取出现非 ENOENT 错误时抛异常。
 */
export async function loadEnvFile(envPath) {
  let content = '';
  try {
    content = await readFile(envPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {};
    }
    throw error;
  }

  return Object.fromEntries(
    content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=');
        if (index === -1) {
          if (/^sk[-_]/i.test(line)) {
            return ['DEEPSEEK_API_KEY', line];
          }
          return [line, ''];
        }
        const key = line.slice(0, index).trim();
        const rawValue = line.slice(index + 1).trim();
        return [key, rawValue.replace(/^["']|["']$/g, '')];
      }),
  );
}

/**
 * writeIfMissing 在文件不存在时写入内容。
 *
 * 参数：
 * - filePath：目标文件路径。
 * - content：要写入的文本内容。
 *
 * 返回值：Promise<void>。
 * 可能抛出的异常：stat 或 writeFile 遇到权限等非预期错误时抛异常。
 */
async function writeIfMissing(filePath, content) {
  try {
    await stat(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content, 'utf8');
  }
}

/**
 * generateRunId 生成不会按每日序号撞号的运行 ID。
 *
 * 参数：无。
 * 返回值：格式为 run-YYYYMMDD-HHMMSS-xxxx 的字符串。
 * 可能抛出的异常：不主动抛异常。
 */
function generateRunId() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  const stamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
  const random = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  return `run-${stamp}-${random}`;
}

/**
 * resolveModelName 按任务类型选择模型。
 *
 * 参数：
 * - taskType：fast 或 deep。
 *
 * 返回值：DeepSeek 模型名。
 * 可能抛出的异常：不主动抛异常。
 */
function resolveModelName(taskType) {
  return taskType === 'deep' ? 'deepseek-v4-pro' : 'deepseek-v4-flash';
}

/**
 * getOutputInstruction 返回当前模型调用必须输出的 JSON 契约。
 *
 * 参数：
 * - purpose：调用目的，字符串。
 *
 * 返回值：提示词片段。
 * 可能抛出的异常：不主动抛异常。
 */
function getOutputInstruction(purpose) {
  if (purpose === 'analyze_inquiry') {
    return [
      '输出 JSON 格式:',
      '{"intention":{"level":"中高意向","score":78,"evidence":"因为..."},"missingInfo":["..."],"risks":["..."]}',
      'evidence 和 risks 必须明确引用客户 profile 或 memory 中的具体事实。',
    ].join('\n');
  }

  if (purpose === 'draft_reply') {
    return [
      '输出 JSON 格式:',
      '{"replyDraft":"Hi,..."}',
      'replyDraft 必须是英文邮件草稿，并体现客户历史或当前客户事实。',
    ].join('\n');
  }

  return [
    '输出 JSON 格式:',
    '{"nextSteps":["..."]}',
    'nextSteps 必须是业务员可执行的后续动作，不要自动发送邮件。',
  ].join('\n');
}

/**
 * parseModelJson 从模型返回中解析 JSON。
 *
 * 参数：
 * - response：模型客户端返回对象或字符串。
 * - purpose：当前调用目的，用于错误信息。
 *
 * 返回值：解析后的对象。
 * 可能抛出的异常：无法找到或解析 JSON 时抛 MODEL_PARSE_FAILED。
 */
function parseModelJson(response, purpose) {
  const raw = typeof response === 'string' ? response : response?.content;
  const cleaned = String(raw || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start === -1 || end === -1 || end < start) {
    throw Object.assign(new Error(`Model response for ${purpose} did not contain JSON`), { code: 'MODEL_PARSE_FAILED' });
  }

  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch (error) {
    throw Object.assign(new Error(`Model response for ${purpose} was not valid JSON: ${error.message}`), {
      code: 'MODEL_PARSE_FAILED',
    });
  }
}

/**
 * normalizeResult 规整模型结果，保证前端和 artifact 始终拿到五块内容。
 *
 * 参数：
 * - partial：模型结果对象。
 *
 * 返回值：标准结果对象。
 * 可能抛出的异常：不主动抛异常。
 */
function normalizeResult(partial) {
  return {
    intention: partial.intention || { level: '待判断', score: 0, evidence: '模型未返回判断依据' },
    missingInfo: Array.isArray(partial.missingInfo) ? partial.missingInfo : [],
    nextSteps: Array.isArray(partial.nextSteps) ? partial.nextSteps : [],
    replyDraft: String(partial.replyDraft || ''),
    risks: Array.isArray(partial.risks) ? partial.risks : [],
  };
}

/**
 * buildMemoryEntry 生成确认后追加到客户 memory.md 的摘要。
 *
 * 参数：
 * - result：标准分析结果对象。
 *
 * 返回值：Markdown 文本。
 * 可能抛出的异常：不主动抛异常。
 */
function buildMemoryEntry(result) {
  const date = new Date().toISOString().slice(0, 10);
  return [
    `## ${date} 询盘分析`,
    '',
    `- 意向判断: ${result.intention.level}（${result.intention.score || '未评分'}）。${result.intention.evidence || ''}`,
    `- 信息缺口: ${result.missingInfo.join('、') || '暂无'}`,
    `- 风险提醒: ${result.risks.join('、') || '暂无'}`,
    `- 下一步动作: ${result.nextSteps.join('；') || '暂无'}`,
    '',
  ].join('\n');
}

/**
 * summarizeInquiry 生成 run log 里的输入摘要。
 *
 * 参数：
 * - inquiryText：询盘原文，字符串。
 *
 * 返回值：简短摘要字符串。
 * 可能抛出的异常：不主动抛异常。
 */
function summarizeInquiry(inquiryText) {
  const wordCount = inquiryText.split(/\s+/).filter(Boolean).length;
  return `英文询盘，约 ${wordCount} 词`;
}
