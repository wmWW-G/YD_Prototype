import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const MAX_TEXT_PREVIEW_CHARS = 16000;
const CODEX_BUNDLED_PYTHON =
  '/Users/garden/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const XLSX_PREVIEW_INSPECTOR = `
import json
import sys
from openpyxl import load_workbook

workbook = load_workbook(sys.argv[1], read_only=True, data_only=True)
sheets = []
for sheet in workbook.worksheets:
    sheets.append({
        "name": sheet.title,
        "rowCount": sheet.max_row or 0,
        "columnCount": sheet.max_column or 0,
    })
print(json.dumps({"sheetCount": len(sheets), "sheets": sheets}, ensure_ascii=False))
`;

/**
 * readAgentArtifactPreview 读取当前 Agent session 的产物预览。
 *
 * 作用：
 * - 给前端“查看文件”提供真实内容,让 Markdown 草稿和客户分析能在任务线程里打开。
 * - 默认读取 session 里记录的最新产物;传入 messageId 时读取该消息卡片绑定的产物。
 * - 路径必须位于 `workbench/artifacts/` 或 `workbench/exports/` 下。
 * - 对 XLSX 等二进制产物只返回可读摘要,不把二进制内容塞进前端。
 *
 * 参数：
 * - input.projectRoot：项目根目录。
 * - input.session：agent-session-store 读出的 session 对象。
 * - input.messageId：可选,点击历史消息产物卡时用于定位当时那份 artifact。
 *
 * 返回值：Promise<object>,包含 ok/name/type/content 等字段。
 * 可能抛出的异常：文件不存在、路径越界或读取失败时抛出带 code/status 的错误。
 */
export async function readAgentArtifactPreview(input = {}) {
  const projectRoot = input.projectRoot || process.cwd();
  const session = input.session || {};
  const artifact = findPreviewArtifact({ messageId: input.messageId, session });

  if (!artifact?.outputPath) {
    throw createPreviewError('ARTIFACT_NOT_FOUND', '这次任务还没有可预览的产物。', 404);
  }

  const filePath = resolveSafeArtifactPath({ outputPath: artifact.outputPath, projectRoot });
  const fileStat = await stat(filePath);
  const name = scrubPreviewArtifactName(artifact.name || artifact.workbookName || path.basename(filePath), artifact.type);
  const ext = path.extname(filePath).toLowerCase();

  if (artifact.type === 'markdown' || ext === '.md' || ext === '.txt') {
    const raw = await readFile(filePath, 'utf8');
    const content = raw.slice(0, MAX_TEXT_PREVIEW_CHARS);
    return {
      ok: true,
      content,
      name,
      quality: buildArtifactQualitySummary(artifact),
      sizeBytes: fileStat.size,
      truncated: raw.length > MAX_TEXT_PREVIEW_CHARS,
      type: artifact.type || (ext === '.md' ? 'markdown' : 'text'),
    };
  }

  if (artifact.type === 'xlsx' || ext === '.xlsx') {
    const workbook = await inspectXlsxWorkbook(filePath);
    return {
      ok: true,
      content: '',
      name,
      previewNote: buildXlsxPreviewNote(workbook),
      quality: buildArtifactQualitySummary(artifact),
      sizeBytes: fileStat.size,
      truncated: false,
      type: 'xlsx',
      workbook,
    };
  }

  return {
    ok: true,
    content: '',
    name,
    previewNote: '文件已生成,但当前原型还不支持这种格式的内联预览。',
    quality: buildArtifactQualitySummary(artifact),
    sizeBytes: fileStat.size,
    truncated: false,
    type: artifact.type || ext.replace('.', '') || 'file',
  };
}

/**
 * findPreviewArtifact 从 session 里取本次应预览的产物。
 *
 * 作用：
 * - 用户点击旧消息卡片时,用 messageId 找到该消息当时绑定的 artifact。
 * - 没传 messageId 时仍保持旧行为,读取当前 session 最新产物。
 * - 不接受前端直接传 outputPath,避免绕过 session 绑定关系读取任意文件。
 *
 * 参数：
 * - input.messageId：消息 ID,可为空。
 * - input.session：agent-session-store 持久化的线程状态。
 *
 * 返回值：artifact 对象或 null。
 * 可能抛出的异常：无。
 */
function findPreviewArtifact(input = {}) {
  const session = input.session || {};
  const messageId = String(input.messageId || '').trim();
  if (messageId) {
    const messages = Array.isArray(session.messages) ? session.messages : [];
    const matchedMessage = messages.find((message) => String(message?.id || '') === messageId);
    if (matchedMessage?.artifact) {
      return matchedMessage.artifact;
    }
    return null;
  }

  return session.context?.artifact || session.artifact || session.skillAgentResult?.artifact || null;
}

/**
 * resolveSafeArtifactPath 校验产物路径是否位于允许的 workbench 产物目录。
 *
 * 作用：
 * - 防止预览接口被滥用来读取项目外的任意文件。
 * - 允许 artifact.outputPath 是绝对路径或相对 projectRoot 的路径。
 *
 * 参数：
 * - input.projectRoot：项目根目录。
 * - input.outputPath：产物路径。
 *
 * 返回值：规范化后的绝对路径。
 * 可能抛出的异常：路径为空或越界时抛出 PREVIEW_PATH_FORBIDDEN。
 */
function resolveSafeArtifactPath(input = {}) {
  const projectRoot = input.projectRoot || process.cwd();
  const allowedRoots = [
    path.resolve(projectRoot, 'workbench', 'artifacts'),
    path.resolve(projectRoot, 'workbench', 'exports'),
  ];
  const rawOutputPath = String(input.outputPath || '').trim();
  if (!rawOutputPath) {
    throw createPreviewError('ARTIFACT_NOT_FOUND', '这次任务还没有可预览的产物。', 404);
  }

  const filePath = path.isAbsolute(rawOutputPath)
    ? path.resolve(rawOutputPath)
    : path.resolve(projectRoot, rawOutputPath);
  const isInsideAllowedRoot = allowedRoots.some((root) => filePath === root || filePath.startsWith(`${root}${path.sep}`));

  if (!isInsideAllowedRoot) {
    throw createPreviewError('PREVIEW_PATH_FORBIDDEN', '为了安全,只能预览当前任务生成的产物文件。', 403);
  }

  return filePath;
}

async function inspectXlsxWorkbook(filePath) {
  try {
    const output = await runPythonInspector(filePath);
    const workbook = JSON.parse(output || '{}');
    const sheets = Array.isArray(workbook.sheets) ? workbook.sheets : [];
    return {
      sheetCount: Number.isFinite(Number(workbook.sheetCount)) ? Number(workbook.sheetCount) : sheets.length,
      sheets: sheets.map((sheet) => ({
        columnCount: Number.isFinite(Number(sheet.columnCount)) ? Number(sheet.columnCount) : 0,
        name: String(sheet.name || '未命名工作表'),
        rowCount: Number.isFinite(Number(sheet.rowCount)) ? Number(sheet.rowCount) : 0,
      })),
    };
  } catch {
    return {
      sheetCount: 0,
      sheets: [],
    };
  }
}

function buildXlsxPreviewNote(workbook = {}) {
  const sheets = Array.isArray(workbook.sheets) ? workbook.sheets : [];
  if (!sheets.length) {
    return '表格文件已生成,当前线程先展示文件摘要。';
  }
  const sheetSummary = sheets
    .slice(0, 8)
    .map((sheet) => `${sheet.name}（${sheet.rowCount} 行 × ${sheet.columnCount} 列）`)
    .join('、');
  const extra = sheets.length > 8 ? `，另有 ${sheets.length - 8} 个工作表` : '';
  return `表格文件已生成,包含 ${sheets.length} 个工作表: ${sheetSummary}${extra}。`;
}

/**
 * scrubPreviewArtifactName 清理预览接口返回的产物名。
 *
 * 作用：
 * - session 内部可以保存真实文件名,例如 `quotation-sheet-skill-runtime-...xlsx`。
 * - 前台点击“查看文件”时只应该看到业务化名称,不能看到 runId 或本机路径。
 *
 * 参数：
 * - name：session 里的 artifact.name 或文件 basename。
 * - type：artifact 类型。
 *
 * 返回值：用户可见的安全产物名。
 * 可能抛出的异常：无。
 */
function scrubPreviewArtifactName(name = '', type = '') {
  const value = String(name || '').trim();
  if (!value) {
    return '';
  }
  if (!/skill-runtime|\/Users|\/tmp|workbench\//iu.test(value)) {
    return value;
  }
  if (/quotation-sheet/iu.test(value)) {
    return '报价单.xlsx';
  }
  if (/customer-followup-plan/iu.test(value)) {
    return '客户推进分析.md';
  }
  if (/inquiry-reply-draft/iu.test(value)) {
    return '询盘回复草稿.md';
  }
  if (/cold-email-draft/iu.test(value)) {
    return '开发信草稿.md';
  }
  if (type === 'xlsx' || /\.xlsx$/iu.test(value)) {
    return '修订版表格.xlsx';
  }
  if (type === 'markdown' || /\.(?:md|txt)$/iu.test(value)) {
    return '业务材料.md';
  }
  return '任务材料';
}

/**
 * buildArtifactQualitySummary 把 Runtime 内部 validation 转成前端可见的安全检查摘要。
 *
 * 作用：
 * - 让用户在产物预览里看到“检查结果”,知道材料不是空文件或瞎编内容。
 * - 只暴露业务事实覆盖结果,不暴露 outputPath、checkpoint、runId、tool call 等内部字段。
 *
 * 参数：
 * - artifact：session 中保存的产物对象,可能包含 validation.evidence。
 *
 * 返回值：quality 摘要对象或 undefined。
 * 可能抛出的异常：无。
 */
function buildArtifactQualitySummary(artifact = {}) {
  const evidence = artifact.validation?.evidence;
  if (!evidence || typeof evidence !== 'object') {
    return undefined;
  }

  const checkedFacts = safeEvidenceFactList(evidence.checkedFacts);
  const missingFacts = safeEvidenceFactList(evidence.missingFacts);
  const hasSafeBusinessFacts = checkedFacts.length > 0 || missingFacts.length > 0;
  const coverage = hasSafeBusinessFacts ? safeEvidenceCoverage(evidence.coverage) : 'unknown';
  const passed =
    artifact.validation?.ok !== false &&
    coverage === 'complete' &&
    checkedFacts.length > 0 &&
    missingFacts.length === 0;

  return {
    checkedFacts,
    coverage,
    label: '依据检查',
    missingFacts,
    status: passed ? 'passed' : 'needs-review',
    summary: passed
      ? '已核对产物里的业务依据和用户事实覆盖。'
      : '产物已生成,但仍有用户事实需要复核。',
  };
}

/**
 * safeEvidenceFactList 清理 evidence fact 列表,只保留能给业务用户看的强类型业务事实。
 *
 * 参数：
 * - values：Runtime evidence 中的 checkedFacts 或 missingFacts。
 *
 * 返回值：最多 12 条 `{ kind, label }` 事实对象。
 * 可能抛出的异常：无。
 */
function safeEvidenceFactList(values = []) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => String(value || '').trim())
    .map(parseSafeEvidenceFact)
    .filter(Boolean)
    .slice(0, 12);
}

/**
 * parseSafeEvidenceFact 把 Runtime 的字符串 fact 转成白名单业务结构。
 *
 * 作用：
 * - Runtime 内部可以记录更自由的 evidence 字符串。
 * - 前台只允许展示白名单业务事实,避免 tool_call、run_id 等变体漏出。
 *
 * 参数：
 * - value：待检查的事实文本。
 *
 * 返回值：安全 fact 对象或 null。
 * 可能抛出的异常：无。
 */
function parseSafeEvidenceFact(value = '') {
  if (!value || value.length > 96) {
    return null;
  }

  const matchers = [
    { kind: 'product', pattern: /^(?:产品|商品|品类)[:：]\s*(.+)$/u },
    { kind: 'market', pattern: /^(?:客户\/市场|市场|国家|地区|客户地区)[:：]\s*(.+)$/u },
    { kind: 'concern', pattern: /^(?:关注点|客户关注点|问题|客户问题|异议)[:：]\s*(.+)$/u },
    { kind: 'quantity', pattern: /^(?:数量|采购数量|目标数量)[:：]\s*(.+)$/u },
    { kind: 'price', pattern: /^(?:价格|报价|单价|目标价)[:：]\s*(.+)$/u },
    { kind: 'trade_term', pattern: /^(?:贸易条款|成交条款|交付条款)[:：]\s*(.+)$/u },
    { kind: 'payment', pattern: /^(?:付款条件|付款方式|账期)[:：]\s*(.+)$/u },
    { kind: 'sample', pattern: /^(?:样品|样品计划)[:：]\s*(.+)$/u },
    { kind: 'next_action', pattern: /^(?:下一步动作|下一步|跟进动作)[:：]\s*(.+)$/u },
  ];

  for (const matcher of matchers) {
    const match = value.match(matcher.pattern);
    if (!match) {
      continue;
    }
    const label = normalizeEvidenceFactLabel(match[1]);
    if (!isSafeEvidenceFactLabel(label)) {
      return null;
    }
    return { kind: matcher.kind, label };
  }

  return null;
}

/**
 * normalizeEvidenceFactLabel 规整业务 fact 标签。
 *
 * 参数：
 * - value：业务 fact 冒号后的标签。
 *
 * 返回值：去掉多余空白后的短文本。
 * 可能抛出的异常：无。
 */
function normalizeEvidenceFactLabel(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

/**
 * isSafeEvidenceFactLabel 判断 fact 标签是否不含内部实现词。
 *
 * 参数：
 * - label：已规整的业务标签。
 *
 * 返回值：true 表示可以展示。
 * 可能抛出的异常：无。
 */
function isSafeEvidenceFactLabel(label = '') {
  if (!label || label.length > 60) {
    return false;
  }

  return !/(?:\/Users\/|\/tmp\/|\/var\/|\\|workbench[\/\\]|output[_\s-]*path|manifest[_\s-]*path|checkpoint|run[_\s-]*id|session[_\s-]*id|tool[_\s-]*call|toolCall|schema|json|validation)/iu.test(label);
}

/**
 * safeEvidenceCoverage 规范化 evidence coverage 状态。
 *
 * 参数：
 * - value：Runtime 写入的 coverage 字段。
 *
 * 返回值：`complete`、`incomplete` 或 `unknown`。
 * 可能抛出的异常：无。
 */
function safeEvidenceCoverage(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'complete' || normalized === 'incomplete') {
    return normalized;
  }
  return 'unknown';
}

function runPythonInspector(filePath) {
  const pythonBin = process.env.YINGDAN_PYTHON_BIN || CODEX_BUNDLED_PYTHON;
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin, ['-c', XLSX_PREVIEW_INSPECTOR, filePath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
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
      reject(new Error(stderr || stdout || `xlsx preview inspector failed with ${exitCode}`));
    });
  });
}

function createPreviewError(code, message, status) {
  return Object.assign(new Error(message), { code, status });
}
