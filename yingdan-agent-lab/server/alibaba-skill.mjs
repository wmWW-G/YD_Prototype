import { spawn } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const ALIBABA_INQUIRY_MEETING_SKILL_PATH =
  '/Users/garden/Coding_Project/SkillCreateSpace/AccioSkillCreate/skills-by-category/accio-alibaba/管理/会议与行动闭环/alibaba-inquiry-meeting';

export const INQUIRY_MEETING_REQUIRED_SHEETS = [
  '本次会议总览',
  '本周询盘概览',
  '业务员询盘复盘',
  '重点询盘逐条分析',
  '共性问题归因',
  '会议主持提问',
  '下周跟进行动表',
  '会后追踪项',
];

const CODEX_BUNDLED_PYTHON =
  '/Users/garden/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';

/**
 * createInquiryMeetingFixturePayload 生成 builder smoke 用的业务化样例 payload。
 *
 * 作用：
 * - 给本地 smoke 和测试提供一份不会冒充实时平台数据的主持材料 JSON。
 * - 覆盖 `alibaba-inquiry-meeting` 必需的八张工作簿 sheet。
 * - 避免写入 tool 名、网关、token、bridge 等内部实现词，因为 skill builder 会拦截这类泄漏。
 *
 * 参数：无。
 *
 * 返回值：标准化主持材料对象。
 * 可能抛出的异常：无。
 */
export function createInquiryMeetingFixturePayload() {
  return {
    period: { start: '2026-06-01', end: '2026-06-07', label: '上周完整自然周' },
    meeting: {
      audience: '老板 + 销售主管 + 管理团队',
      scope_note: '本次复盘只看 inquiry、IM 会话和业务员跟进动作',
      focus: '用已获取的询盘和会话证据判断跟进风险，形成下周整改动作。',
    },
    coverage: [
      {
        source: '历史真实复盘样例',
        range: '2026-06-01 ~ 2026-06-07',
        status: '部分',
        note: '本测试只验证外部 skill 的工作簿生成能力，不冒充实时平台数据采集。',
      },
    ],
    review_summary: [
      {
        topic: '重点客户跟进断点',
        finding: '部分高等级买家已经表达采购意向，但会话停在基础确认，缺少报价、样品或下一次沟通安排。',
        owner: '销售主管',
        management_action: '复核高等级买家的负责人分配，并要求每个重点询盘都有明确下一步。',
        review_metric: '下次复盘检查重点买家的报价、样品、跟进记录是否完整。',
        note: '证据不足的客户只列为待复查，不直接做人责定性。',
      },
    ],
    overview: [
      {
        metric: '重点询盘跟进完整度',
        general_value: '已获取样例覆盖',
        l1_value: '部分重点客户',
        industry_avg: '未返回',
        top20: '未返回',
        meeting_judgement: '本次重点不看行业均值，先看重点客户是否形成下一步。',
      },
    ],
    salespeople: [
      {
        rank: '1',
        name: '业务员A',
        performance: '接待量正常，但重点询盘连续跟进弱。',
        typical_inquiries: '美国买家询问批量采购，已确认产品方向，但缺少报价和样品安排。',
        meeting_comment: '问题更像优先级管理不足，需要主管确认重点客户是否由原负责人继续推进。',
        meeting_question: '这个买家是否已经进入报价或样品环节？如果没有，卡点在哪里？',
        next_week_action: '下次复盘前补齐重点买家的报价状态、样品状态和下一次沟通时间。',
      },
    ],
    priority_inquiries: [
      {
        priority: 'P0',
        buyer: 'Buyer A',
        level: 'L3',
        country: 'US',
        owner: '业务员A',
        issue: '高意向买家没有形成明确下一步。',
        evidence: '买家询问批量采购和交付条件，但会话里没有看到报价或样品推进安排。',
        meeting_confirm: '会上确认是否继续由业务员A跟进，还是转给更熟悉该品类的人接手。',
        suggested_next_step: '由销售主管当天确认负责人，并在下次复盘前检查报价和样品记录。',
      },
    ],
    common_issues: [
      {
        issue: '重点客户优先级不清',
        evidence: '高等级买家会话停留在基础确认，缺少明确推进动作。',
        root_cause: '主管没有把重点询盘和普通询盘分层追踪。',
        next_step: '建立重点询盘清单，每次复盘只检查是否有负责人、下一步和证据。',
      },
    ],
    review_questions: [
      {
        target: '销售主管',
        meeting_question: '本周所有重点询盘是否都有负责人和下一步？',
        basis: '重点询盘逐条分析里出现无报价、无样品或无下次沟通安排的客户。',
        expected_conclusion: '确认每个重点询盘的负责人、推进动作和复查证据。',
      },
    ],
    corrective_actions: [
      {
        priority: 'P0',
        action: '复核重点询盘负责人和下一步动作',
        owner: '销售主管',
        customer: 'Buyer A',
        deadline: '下次复盘前',
        verification: '检查报价记录、样品安排或下一次沟通记录。',
      },
    ],
    followup_items: [
      {
        check_item: '重点询盘是否形成闭环',
        verification: '下次会议逐条查看负责人、报价、样品和跟进记录。',
        status: '待复查',
      },
    ],
  };
}

/**
 * inspectAlibabaInquiryMeetingSkill 读取真实 Accio skill 包的元信息。
 *
 * 作用：
 * - 确认验收目标不是赢单内置 chatbot 场景，而是外部 Accio skill 包。
 * - 读取 `SKILL.md`、`agents/openai.yaml`、`evals/evals.json` 和 builder 脚本位置。
 * - 返回运行时需要展示或记录的最小元信息。
 *
 * 参数：
 * - skillPath：外部 skill 目录的绝对路径，字符串。
 *
 * 返回值：Promise<object>，包含 skill 名称、展示名、默认 prompt、eval 数量、builder 是否存在和必需 sheet。
 * 可能抛出的异常：skill 目录或关键文件不存在、evals JSON 解析失败时抛出。
 */
export async function inspectAlibabaInquiryMeetingSkill(skillPath = ALIBABA_INQUIRY_MEETING_SKILL_PATH) {
  const skillMdPath = path.join(skillPath, 'SKILL.md');
  const openaiYamlPath = path.join(skillPath, 'agents', 'openai.yaml');
  const evalsPath = path.join(skillPath, 'evals', 'evals.json');
  const builderPath = path.join(skillPath, 'scripts', 'build_inquiry_meeting_xlsx.py');

  const [skillMd, openaiYaml, evalsRaw] = await Promise.all([
    readFile(skillMdPath, 'utf8'),
    readFile(openaiYamlPath, 'utf8'),
    readFile(evalsPath, 'utf8'),
    stat(builderPath),
  ]);
  const evals = JSON.parse(evalsRaw);

  return {
    name: parseFrontmatterValue(skillMd, 'name') || 'alibaba-inquiry-meeting',
    description: parseFrontmatterDescription(skillMd),
    displayName: parseYamlString(openaiYaml, 'display_name') || '国际站询盘分析会主持',
    defaultPrompt: parseYamlString(openaiYaml, 'default_prompt') || '',
    evalCount: Array.isArray(evals.evals) ? evals.evals.length : 0,
    hasBuilderScript: true,
    builderPath,
    skillPath,
    requiredSheets: [...INQUIRY_MEETING_REQUIRED_SHEETS],
  };
}

/**
 * buildInquiryMeetingXlsx 调用 `alibaba-inquiry-meeting` 自带脚本生成 XLSX。
 *
 * 作用：
 * - 把已整理好的主持材料 JSON 写入输出目录。
 * - 使用 skill 自带 `scripts/build_inquiry_meeting_xlsx.py` 渲染并验证 XLSX。
 * - 记录 manifest；默认标记为 `builder-only-fixture`，真实执行器可显式传入 `real-bridge`。
 *
 * 参数：
 * - options.outputRoot：输出根目录，字符串。
 * - options.payload：标准化主持材料 JSON，对象。
 * - options.skillPath：可选外部 skill 路径，字符串；默认指向用户指定的真实路径。
 * - options.pythonBin：可选 Python 可执行文件路径；默认优先使用 Codex 自带 Python。
 * - options.manifestMode：可选 manifest 模式；真实桥执行传 `real-bridge`。
 * - options.validationNote：可选验证说明。
 * - options.manifestExtras：可选附加审计信息对象。
 *
 * 返回值：Promise<object>，包含 ok、输出文件、payload、manifest 和验证摘要。
 * 可能抛出的异常：builder 退出非 0、输出文件不存在、文件系统写入失败或 Python 缺依赖时抛出。
 */
export async function buildInquiryMeetingXlsx(options) {
  const outputRoot = options?.outputRoot;
  if (!outputRoot) {
    throw new Error('outputRoot is required');
  }

  const payload = options.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('payload object is required');
  }

  const skill = await inspectAlibabaInquiryMeetingSkill(options.skillPath || ALIBABA_INQUIRY_MEETING_SKILL_PATH);
  const pythonBin = options.pythonBin || process.env.YINGDAN_PYTHON_BIN || CODEX_BUNDLED_PYTHON;
  const manifestMode = options.manifestMode || 'builder-only-fixture';
  const runDir = path.join(outputRoot, 'alibaba-inquiry-meeting');
  const payloadPath = path.join(runDir, 'payload.json');
  const outputPath = path.join(runDir, defaultInquiryMeetingWorkbookName(payload));
  const manifestPath = path.join(runDir, 'manifest.json');

  await mkdir(runDir, { recursive: true });
  await writeFile(payloadPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const builder = await runCommand(pythonBin, [skill.builderPath, '--input', payloadPath, '--output', outputPath], {
    cwd: skill.skillPath,
  });

  if (builder.exitCode !== 0) {
    const error = new Error(`alibaba-inquiry-meeting builder failed with exit code ${builder.exitCode}`);
    error.stdout = builder.stdout;
    error.stderr = builder.stderr;
    throw error;
  }

  const outputStat = await stat(outputPath);
  const manifest = {
    skillName: skill.name,
    skillPath: skill.skillPath,
    mode: manifestMode,
    payloadPath,
    outputPath,
    workbookName: path.basename(outputPath),
    requiredSheets: skill.requiredSheets,
    validation: {
      mode: manifestMode,
      builderExitCode: builder.exitCode,
      workbookExists: outputStat.isFile(),
      workbookBytes: outputStat.size,
      note:
        options.validationNote ||
        'This verifies the external skill builder and XLSX safety flow only; real acceptance still requires live Accio/Alibaba read-only tool execution.',
    },
    ...(options.manifestExtras && typeof options.manifestExtras === 'object' ? { runtime: options.manifestExtras } : {}),
    builderStdout: builder.stdout.trim(),
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return {
    ok: true,
    skillName: skill.name,
    outputPath,
    workbookName: path.basename(outputPath),
    payloadPath,
    manifestPath,
    requiredSheets: skill.requiredSheets,
    validation: manifest.validation,
  };
}

/**
 * parseFrontmatterValue 从 Markdown frontmatter 里读取单行字段。
 *
 * 参数：
 * - markdown：Markdown 文本，字符串。
 * - key：frontmatter 字段名，字符串。
 *
 * 返回值：字段值字符串；找不到时返回空字符串。
 * 可能抛出的异常：无。
 */
function parseFrontmatterValue(markdown, key) {
  const match = markdown.match(new RegExp(`^${escapeRegExp(key)}:\\s*([^\\n]+)`, 'm'));
  return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : '';
}

/**
 * parseFrontmatterDescription 读取 skill 描述。
 *
 * 参数：
 * - markdown：Markdown 文本，字符串。
 *
 * 返回值：description 文本；找不到时返回空字符串。
 * 可能抛出的异常：无。
 */
function parseFrontmatterDescription(markdown) {
  const block = markdown.match(/^description:\s*\|\n([\s\S]*?)\n---/m);
  if (!block) {
    return parseFrontmatterValue(markdown, 'description');
  }
  return block[1]
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * parseYamlString 用轻量正则读取当前 YAML 里的字符串值。
 *
 * 参数：
 * - yaml：YAML 文本，字符串。
 * - key：字段名，字符串。
 *
 * 返回值：字段值字符串；找不到时返回空字符串。
 * 可能抛出的异常：无。
 */
function parseYamlString(yaml, key) {
  const match = yaml.match(new RegExp(`^\\s*${escapeRegExp(key)}:\\s*["']?([^"'\n]+)["']?`, 'm'));
  return match ? match[1].trim() : '';
}

/**
 * defaultInquiryMeetingWorkbookName 根据 payload 周期生成默认 XLSX 文件名。
 *
 * 参数：
 * - payload：标准化主持材料 JSON，对象。
 *
 * 返回值：文件名字符串，例如 `询盘分析会_2026-06-01_2026-06-07.xlsx`。
 * 可能抛出的异常：无。
 */
function defaultInquiryMeetingWorkbookName(payload) {
  const start = sanitizeDatePart(payload?.period?.start) || 'start';
  const end = sanitizeDatePart(payload?.period?.end) || 'end';
  return `询盘分析会_${start}_${end}.xlsx`;
}

/**
 * sanitizeDatePart 清理文件名中的日期片段。
 *
 * 参数：
 * - value：任意待清理值。
 *
 * 返回值：只包含数字、字母和横线的字符串。
 * 可能抛出的异常：无。
 */
function sanitizeDatePart(value) {
  return String(value || '').replace(/[^0-9A-Za-z-]/g, '');
}

/**
 * escapeRegExp 转义正则特殊字符。
 *
 * 参数：
 * - value：待转义字符串。
 *
 * 返回值：可安全放入 RegExp 的字符串。
 * 可能抛出的异常：无。
 */
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * runCommand 运行外部命令并收集输出。
 *
 * 参数：
 * - command：可执行文件路径，字符串。
 * - args：命令参数数组。
 * - options.cwd：工作目录，字符串。
 *
 * 返回值：Promise<object>，包含 exitCode、stdout、stderr。
 * 可能抛出的异常：进程无法启动或被系统终止时抛出。
 */
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });
  });
}
