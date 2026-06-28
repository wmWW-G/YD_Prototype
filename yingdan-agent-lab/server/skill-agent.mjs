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
 * runNewConversationAgent 执行新对话 Agent 的一轮 Skill 命令。
 *
 * 作用：
 * - 先识别用户输入是否为可执行 Skill。
 * - 调用真实 runner 产出 XLSX。
 * - 把底层 run 结果包装成前端可读的 Agent 状态。
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
  if (!command.matched && options.sessionId) {
    return buildAgentFollowupResponse({
      sessionId: options.sessionId,
      text: options.text,
      context: options.context,
    });
  }

  if (!command.matched) {
    return {
      ok: false,
      error: 'UNSUPPORTED_AGENT_COMMAND',
      message: '当前新对话 Agent 只支持：执行Skill：alibaba-inquiry-meeting',
    };
  }

  const runner = options.runner || runAlibabaInquiryMeetingReal;
  const result = await runner({ projectRoot: options.projectRoot });
  return buildAlibabaSkillAgentResponse({
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
  const period = result.period || {};
  const toolSummary = result.toolSummary || {};
  const sheetCount = rowSummary.sheetCount || 8;
  const workbookBytes = rowSummary.workbookBytes || result.validation?.workbookBytes || 0;
  const sessionId = input.sessionId || createAgentSessionId(result.runId);
  const userText = input.userText || '执行Skill：alibaba-inquiry-meeting';
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
    `已完成 ${period.start || '未返回'} ~ ${period.end || '未返回'} 的询盘分析会。`,
    `本次执行 ${toolSummary.succeeded ?? 0}/${toolSummary.attempted ?? 0} 次只读采集。`,
    `工作簿包含 ${sheetCount} 张 sheet，大小 ${formatBytes(workbookBytes)}。`,
  ].join(' ');
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

  return {
    ok: true,
    kind: 'skill-run',
    sessionId,
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
