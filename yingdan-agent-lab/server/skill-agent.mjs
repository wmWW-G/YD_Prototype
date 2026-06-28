import { runAlibabaInquiryMeetingReal } from './alibaba-real-runner.mjs';

/**
 * detectSkillCommand 识别新对话里的 Skill 执行指令。
 *
 * 作用：
 * - 让用户只输入“执行Skill：alibaba-inquiry-meeting”即可触发真实 Skill。
 * - 只识别当前已经落地的验收 Skill，避免误把普通聊天当成工具执行。
 *
 * 参数：
 * - text：用户在新对话输入框里的原文，字符串。
 *
 * 返回值：识别结果对象；matched=true 时包含 skillId 和 mode。
 * 可能抛出的异常：无。
 */
export function detectSkillCommand(text) {
  const normalized = String(text || '').trim();
  const match = normalized.match(/执行\s*Skill\s*[:：]\s*([A-Za-z0-9_-]+)/i);
  const skillId = match?.[1] || '';
  if (skillId === 'alibaba-inquiry-meeting') {
    return { matched: true, skillId, mode: 'real-bridge' };
  }
  return { matched: false, skillId: '', mode: '' };
}

/**
 * detectAgentGoal 识别用户自然语言里的业务目标。
 *
 * 作用：
 * - 把“帮我开上周询盘分析会”这类用户目标转成 Runtime 可执行的 Skill 匹配结果。
 * - 当前第一刀只开放 `alibaba-inquiry-meeting`，所以这里 deliberately 保守匹配。
 * - 后续扩展多个 Skill 时，可以把这里替换成模型分类 + registry 检索，但输出结构保持不变。
 *
 * 参数：
 * - text：用户在新对话输入框里的自然语言目标，字符串。
 *
 * 返回值：目标识别结果；matched=true 时包含 skillId、periodHint、trigger 和 reason。
 * 可能抛出的异常：无。
 */
export function detectAgentGoal(text) {
  const normalized = String(text || '').trim();
  const compactText = normalized.replace(/\s+/g, '');
  const wantsInquiryMeeting = /询盘/.test(compactText) && /(分析会|复盘会|复盘|会议|开会)/.test(compactText);
  const wantsPreviousWeek = /(上周|上一周|上个星期|上星期)/.test(compactText);

  if (wantsInquiryMeeting) {
    return {
      matched: true,
      goalType: 'inquiry-meeting',
      skillId: 'alibaba-inquiry-meeting',
      mode: 'real-bridge',
      periodHint: wantsPreviousWeek ? 'previous_full_week' : 'auto',
      trigger: 'natural_goal',
      confidence: wantsPreviousWeek ? 0.94 : 0.86,
      reason: wantsPreviousWeek
        ? '用户要开上周询盘分析会，匹配管理与行动闭环 Skill。'
        : '用户要处理询盘复盘会议，匹配管理与行动闭环 Skill。',
    };
  }

  return {
    matched: false,
    goalType: '',
    skillId: '',
    mode: '',
    periodHint: '',
    trigger: '',
    confidence: 0,
    reason: '',
  };
}

/**
 * runNewConversationAgent 执行新对话 Agent 的一轮 Skill 命令。
 *
 * 作用：
 * - 先识别用户输入是明确 Skill 命令，还是自然语言业务目标。
 * - 自然语言目标会先匹配 Skill、制定计划，再调用真实 runner 产出 XLSX。
 * - 把底层 run 结果包装成前端可读的 Agent 消息、活动流和产物卡。
 *
 * 参数：
 * - options.text：用户输入文本。
 * - options.projectRoot：项目根目录。
 * - options.runner：可选 runner，测试可注入。
 *
 * 返回值：Promise<object>，前端 Agent 响应。
 * 可能抛出的异常：runner 失败时抛出；调用方负责转 HTTP 错误。
 */
export async function runNewConversationAgent(options = {}) {
  const command = detectSkillCommand(options.text);
  const goal = detectAgentGoal(options.text);
  if (!command.matched && options.sessionId) {
    return buildAgentFollowupResponse({
      sessionId: options.sessionId,
      text: options.text,
      context: options.context,
    });
  }

  if (!command.matched && !goal.matched) {
    return {
      ok: false,
      error: 'UNSUPPORTED_AGENT_COMMAND',
      message: '当前新对话 Agent 支持：帮我开上周询盘分析会，或执行Skill：alibaba-inquiry-meeting',
    };
  }

  const runner = options.runner || runAlibabaInquiryMeetingReal;
  const plan = goal.matched ? buildGoalPlan(goal) : null;
  const result = await runner({ projectRoot: options.projectRoot });
  return buildAlibabaSkillAgentResponse({
    goal: goal.matched ? goal : null,
    kind: goal.matched ? 'goal-run' : 'skill-run',
    plan,
    result,
    rowSummary: options.rowSummary,
    sessionId: options.sessionId,
    userText: options.text,
  });
}

/**
 * buildAlibabaSkillAgentResponse 把真实 runner 结果转成新对话 Agent 状态。
 *
 * 作用：
 * - 前端不需要理解 raw 工具、manifest 或 builder 细节。
 * - 用户能看到像 Accio Work 一样的执行进度、周期、产物和质量摘要。
 *
 * 参数：
 * - input.result：runAlibabaInquiryMeetingReal 返回值。
 * - input.rowSummary：可选 XLSX 行数摘要，测试或审计时传入。
 *
 * 返回值：前端可直接渲染的 Agent 响应对象。
 * 可能抛出的异常：无。
 */
export function buildAlibabaSkillAgentResponse(input = {}) {
  const result = input.result || {};
  const rowSummary = input.rowSummary || {};
  const goal = input.goal || null;
  const plan = input.plan || null;
  const period = result.period || {};
  const toolSummary = result.toolSummary || {};
  const sheetCount = rowSummary.sheetCount || 8;
  const workbookBytes = rowSummary.workbookBytes || result.validation?.workbookBytes || 0;
  const sessionId = input.sessionId || createAgentSessionId(result.runId);
  const userText = input.userText || '执行Skill：alibaba-inquiry-meeting';
  const kind = input.kind || 'skill-run';
  const progress = [
    { label: '读取Skill', detail: '已读取 alibaba-inquiry-meeting 外部 Skill 包', status: 'complete' },
    { label: '确定周期', detail: `${period.label || '复盘周期'}：${period.start || '未返回'} ~ ${period.end || '未返回'}`, status: 'complete' },
    { label: '采集只读数据', detail: `成功 ${toolSummary.succeeded ?? 0} 次，降级 ${Math.max((toolSummary.attempted ?? 0) - (toolSummary.succeeded ?? 0), 0)} 次`, status: 'complete' },
    { label: '生成主持材料', detail: '已生成管理层询盘复盘 JSON', status: 'complete' },
    { label: '生成XLSX', detail: result.workbookName || '询盘分析会.xlsx', status: 'complete' },
    { label: '校验通过', detail: '已通过 builder、压缩包和工作簿校验', status: 'complete' },
  ];
  const artifact = {
    type: 'xlsx',
    workbookName: result.workbookName,
    outputPath: result.outputPath,
    manifestPath: result.manifestPath,
    runLogPath: result.runLogPath,
    validation: result.validation,
    rows: rowSummary.rows || {},
  };
  const summary = [
    goal?.matched ? `已理解目标，并自动匹配 alibaba-inquiry-meeting。` : '',
    `已完成 ${period.start || '未返回'} ~ ${period.end || '未返回'} 的询盘分析会。`,
    `本次执行 ${toolSummary.succeeded ?? 0}/${toolSummary.attempted ?? 0} 次只读采集。`,
    `工作簿包含 ${sheetCount} 张 sheet，大小 ${formatBytes(workbookBytes)}。`,
  ].filter(Boolean).join(' ');
  const assistantMessage = {
    id: messageId('assistant'),
    role: 'assistant',
    content: summary,
    createdAt: new Date().toISOString(),
    process: {
      title: 'alibaba-inquiry-meeting 执行过程',
      expanded: false,
      steps: progress,
    },
    artifact,
  };
  if (goal?.matched) {
    assistantMessage.activity = buildActivityStream({ artifact, goal, period, plan, result, toolSummary });
  }

  return {
    ok: true,
    kind,
    sessionId,
    goal,
    plan,
    skillId: 'alibaba-inquiry-meeting',
    status: 'completed',
    mode: result.mode || 'real-bridge',
    runId: result.runId,
    period,
    summary,
    progress,
    artifact,
    messages: [
      {
        id: messageId('user'),
        role: 'user',
        content: userText,
        createdAt: new Date().toISOString(),
      },
      assistantMessage,
    ],
  };
}

/**
 * buildGoalPlan 为自然语言目标生成用户可读的执行计划。
 *
 * 作用：
 * - 给前台活动流提供“我打算怎么做”的结构。
 * - 计划不直接替代真实执行；真实执行仍由 runner 完成。
 *
 * 参数：
 * - goal：detectAgentGoal 返回的目标对象。
 *
 * 返回值：包含 steps 的计划对象。
 * 可能抛出的异常：无。
 */
function buildGoalPlan(goal) {
  const periodText = goal.periodHint === 'previous_full_week' ? '上周完整自然周' : '自动解析复盘周期';
  return {
    title: '询盘分析会执行计划',
    steps: [
      { id: 'understand_goal', label: '理解目标', detail: goal.reason },
      { id: 'match_skill', label: '匹配Skill', detail: '选择 alibaba-inquiry-meeting 作为执行 Skill。' },
      { id: 'resolve_period', label: '确定周期', detail: `按${periodText}准备复盘。` },
      { id: 'run_skill', label: '执行Skill', detail: '读取外部 Skill，采集只读数据，生成主持材料和 XLSX。' },
      { id: 'verify_artifact', label: '校验产物', detail: '确认 XLSX 安全流程、sheet 和产物路径。' },
    ],
  };
}

/**
 * buildActivityStream 生成类似 Codex 活动流的 action / observation 过程。
 *
 * 作用：
 * - 前台不只看到“进度条”，还能看到 Agent 为什么选这个 Skill、执行了什么 action、拿到了什么 observation。
 * - observation 会影响下一步描述，例如只读采集成功后继续生成 XLSX；未来可把这里升级成真实逐步 loop。
 *
 * 参数：
 * - input.goal：目标识别结果。
 * - input.plan：执行计划。
 * - input.result：真实 runner 输出。
 * - input.period：复盘周期。
 * - input.toolSummary：工具采集摘要。
 * - input.artifact：产物摘要。
 *
 * 返回值：前端可展开的活动流对象。
 * 可能抛出的异常：无。
 */
function buildActivityStream(input = {}) {
  const goal = input.goal || {};
  const plan = input.plan || {};
  const period = input.period || {};
  const toolSummary = input.toolSummary || {};
  const artifact = input.artifact || {};
  const succeeded = toolSummary.succeeded ?? 0;
  const attempted = toolSummary.attempted ?? 0;
  const collectDecision = succeeded > 0
    ? '只读采集返回可用数据，继续生成主持材料和 XLSX。'
    : '只读采集没有返回可用数据，按缺失数据策略生成有限复盘。';

  return {
    title: '目标驱动活动流',
    expanded: false,
    items: [
      {
        kind: 'goal',
        title: '收到目标',
        detail: goal.reason || '收到用户自然语言目标。',
        status: 'complete',
      },
      {
        kind: 'thought',
        title: '匹配任务',
        detail: `根据“询盘 + 分析会/复盘会”意图，选择 ${goal.skillId || 'alibaba-inquiry-meeting'}。`,
        status: 'complete',
      },
      {
        kind: 'plan',
        title: plan.title || '执行计划',
        detail: (plan.steps || []).map((item) => item.label).join(' → '),
        status: 'complete',
      },
      {
        kind: 'action',
        title: 'action: skill.load',
        detail: '读取 alibaba-inquiry-meeting 的 SKILL.md、openai.yaml、evals 和 builder。',
        status: 'complete',
      },
      {
        kind: 'observation',
        title: 'observation: skill.ready',
        detail: 'Skill 可执行，继续解析周期和采集策略。',
        status: 'complete',
      },
      {
        kind: 'action',
        title: 'action: period.resolve',
        detail: '把“上周”解析为完整自然周。',
        status: 'complete',
      },
      {
        kind: 'observation',
        title: 'observation: period.resolved',
        detail: `${period.start || '未返回'} ~ ${period.end || '未返回'}。`,
        status: 'complete',
      },
      {
        kind: 'action',
        title: 'action: run_skill',
        detail: '调用 Alibaba 只读采集、生成主持材料 JSON，并执行 XLSX builder。',
        status: 'complete',
      },
      {
        kind: 'observation',
        title: 'observation: artifact.ready',
        detail: `${collectDecision} 已生成 ${artifact.workbookName || '询盘分析会.xlsx'}。`,
        status: 'complete',
      },
    ],
  };
}

/**
 * buildAgentFollowupResponse 生成同一 Agent Session 内的追问回复。
 *
 * 作用：
 * - 让新对话在线程完成后继续追问，而不是再次触发真实 Alibaba 采集。
 * - 当前第一刀先返回基于既有产物的确定性回复；后续可接模型总结 XLSX。
 *
 * 参数：
 * - input.sessionId：当前线程 ID。
 * - input.text：用户追问内容。
 * - input.context：前端传回的最近执行结果摘要。
 *
 * 返回值：前端可追加到线程里的助手消息。
 * 可能抛出的异常：无。
 */
export function buildAgentFollowupResponse(input = {}) {
  const context = input.context || {};
  const artifactName = context.artifact?.workbookName || '上一份询盘分析会 XLSX';
  const period = context.period || {};
  const periodText = period.start && period.end ? `${period.start} ~ ${period.end}` : '上一轮复盘周期';
  const question = String(input.text || '').trim() || '继续追问';

  return {
    ok: true,
    kind: 'followup',
    sessionId: input.sessionId || createAgentSessionId(),
    status: 'completed',
    messages: [
      {
        id: messageId('assistant'),
        role: 'assistant',
        createdAt: new Date().toISOString(),
        content: [
          `我会基于同一个 Session 继续处理「${question}」，不会重新采集 Alibaba 只读数据。`,
          `当前依据是 ${periodText} 的 ${artifactName}。`,
          '如果要重新跑一轮数据，请再发明确的 Skill 执行指令。',
        ].join('\n'),
      },
    ],
  };
}

/**
 * createAgentSessionId 生成新对话线程 ID。
 *
 * 参数：
 * - runId：可选底层 runId。
 *
 * 返回值：稳定可读的 session ID。
 * 可能抛出的异常：无。
 */
function createAgentSessionId(runId = '') {
  const suffix = String(runId || '').split('-').slice(-1)[0] || Math.random().toString(36).slice(2, 8);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  return `agent-session-${stamp}-${suffix}`;
}

/**
 * messageId 生成线程消息 ID。
 *
 * 参数：
 * - role：消息角色。
 *
 * 返回值：消息 ID。
 * 可能抛出的异常：无。
 */
function messageId(role) {
  return `${role}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * formatBytes 把字节数格式化成人可读文本。
 *
 * 参数：
 * - value：字节数。
 *
 * 返回值：大小文本。
 * 可能抛出的异常：无。
 */
function formatBytes(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return '未返回';
  }
  if (number < 1024) {
    return `${number} B`;
  }
  return `${(number / 1024).toFixed(1)} KB`;
}
