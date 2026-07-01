import { spawn } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { validateXlsxArtifact } from './artifact-validator.mjs';

const CODEX_BUNDLED_PYTHON =
  '/Users/garden/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';

const XLSX_REVISION_SCRIPT = `
import json
import sys
from datetime import datetime
from openpyxl import load_workbook
from openpyxl.styles import Alignment, Font, PatternFill

source_path = sys.argv[1]
target_path = sys.argv[2]
payload = json.loads(sys.argv[3])

workbook = load_workbook(source_path)
sheet_name = "本次追问"
if sheet_name in workbook.sheetnames:
    del workbook[sheet_name]

sheet = workbook.create_sheet(sheet_name, 0)
sheet.append(["项目", "内容"])
rows = [
    ("用户补充", payload.get("instruction") or "继续优化当前表格"),
    ("处理结果", payload.get("result") or "已基于上一份表格追加本次追问处理记录。"),
    ("交付提醒", "外发前仍需确认客户名称、产品规格、价格、交期、附件和收件渠道。"),
    ("生成时间", datetime.utcnow().isoformat() + "Z"),
]
for row in rows:
    sheet.append(row)

header_fill = PatternFill("solid", fgColor="D9EAF7")
for cell in sheet[1]:
    cell.font = Font(bold=True)
    cell.fill = header_fill
for row in sheet.iter_rows():
    for cell in row:
        cell.alignment = Alignment(vertical="top", wrap_text=True)

sheet.column_dimensions["A"].width = 18
sheet.column_dimensions["B"].width = 72
workbook.save(target_path)
print(json.dumps({"sheets": workbook.sheetnames}, ensure_ascii=False))
`;

/**
 * reviseMarkdownArtifactForFollowup 根据用户补充更新当前 Markdown 产物。
 *
 * 作用：
 * - 让新对话的同任务追问真正“接着做”,而不是只返回上一轮摘要。
 * - 只允许修改当前 session 绑定且位于 `workbench/artifacts/` 下的 Markdown 产物。
 * - 如果当前指针是导出副本,会回到 `exportedFrom` 指向的原始产物继续修改。
 * - 第一版采用安全追加方式,保留原产物内容,把本次补充、可替换段落和外发确认提醒追加到文末。
 *
 * 参数：
 * - input.projectRoot：项目根目录。
 * - input.session：agent-session-store 读出的 session。
 * - input.instruction：用户本次补充或修改要求。
 *
 * 返回值：Promise<object>,包含更新后的 artifact 和摘要。
 * 可能抛出的异常：没有产物、非 Markdown、路径越界或文件写入失败时抛出带 code/status 的错误。
 */
export async function reviseMarkdownArtifactForFollowup(input = {}) {
  const projectRoot = input.projectRoot || process.cwd();
  const session = input.session || {};
  const instruction = String(input.instruction || '').trim();
  const artifact = findLatestArtifact(session);

  if (!artifact?.outputPath) {
    throw createRevisionError('ARTIFACT_REVISION_NOT_FOUND', '这次任务还没有可继续修改的产物。', 404);
  }

  const editableArtifact = resolveEditableArtifact({ artifact, projectRoot });
  const sourcePath = resolveSafeMarkdownPath({ outputPath: editableArtifact.outputPath, projectRoot });
  const current = await readFile(sourcePath, 'utf8');
  const revision = buildFollowupRevisionSection({
    artifactName: editableArtifact.name || path.basename(sourcePath),
    currentContent: current,
    instruction,
  });
  const nextContent = `${current.replace(/\s+$/u, '')}\n\n${revision}\n`;

  await writeFile(sourcePath, nextContent, 'utf8');
  const fileStat = await stat(sourcePath);

  return {
    ok: true,
    artifact: {
      ...editableArtifact,
      outputPath: sourcePath,
      revisedAt: new Date().toISOString(),
      sizeBytes: fileStat.size,
      type: editableArtifact.type || 'markdown',
    },
    summary: `已按补充要求更新 ${editableArtifact.name || path.basename(sourcePath)}。`,
  };
}

/**
 * reviseXlsxArtifactForFollowup 根据用户补充生成一份修订版 XLSX。
 *
 * 作用：
 * - 让询盘分析会这类表格产物也能“接着做”,而不是只能返回文字说明。
 * - 不直接覆盖原始工作簿,而是在同一 `workbench/artifacts/` 目录下生成一份修订版。
 * - 如果当前指针是导出副本,会回到 `exportedFrom` 指向的原始工作簿生成修订版。
 * - 修订版保留原工作表,并新增 `本次追问` 工作表记录用户补充、处理结果和交付提醒。
 * - 生成后复用 Runtime XLSX 校验器,确认 zip、openpyxl、sheet 和残留扫描通过。
 *
 * 参数：
 * - input.projectRoot：项目根目录。
 * - input.session：agent-session-store 读出的 session。
 * - input.instruction：用户本次补充或修改要求。
 *
 * 返回值：Promise<object>,包含修订版 artifact、校验结果和摘要。
 * 可能抛出的异常：没有产物、非 XLSX、路径越界、Python 写入失败或 XLSX 校验失败时抛出。
 */
export async function reviseXlsxArtifactForFollowup(input = {}) {
  const projectRoot = input.projectRoot || process.cwd();
  const session = input.session || {};
  const instruction = String(input.instruction || '').trim() || '继续优化当前表格';
  const artifact = findLatestArtifact(session);

  if (!artifact?.outputPath) {
    throw createRevisionError('ARTIFACT_REVISION_NOT_FOUND', '这次任务还没有可继续修改的产物。', 404);
  }

  const editableArtifact = resolveEditableArtifact({ artifact, projectRoot });
  const sourcePath = resolveSafeArtifactPath({
    allowedExtensions: ['.xlsx'],
    outputPath: editableArtifact.outputPath,
    projectRoot,
  });
  const targetPath = buildRevisedXlsxPath(sourcePath);
  await mkdir(path.dirname(targetPath), { recursive: true });

  const pythonResult = await runPythonXlsxRevision({
    instruction,
    sourcePath,
    targetPath,
  });
  const sheets = Array.isArray(pythonResult.sheets) ? pythonResult.sheets : [];
  const validation = await validateXlsxArtifact({
    forbiddenSheets: ['数据质量检查'],
    outputPath: targetPath,
    requiredSheets: [...new Set([...sheets, '本次追问'])],
  });

  if (!validation.ok) {
    throw createRevisionError('XLSX_REVISION_VALIDATION_FAILED', validation.message || 'XLSX 修订版校验未通过。', 422);
  }

  const fileStat = await stat(targetPath);
  const revisedName = buildUserFacingRevisedXlsxName({
    originalName: editableArtifact.name,
    targetPath,
  });
  return {
    ok: true,
    artifact: {
      ...editableArtifact,
      name: revisedName,
      outputPath: targetPath,
      previousOutputPath: sourcePath,
      revisedAt: new Date().toISOString(),
      sizeBytes: fileStat.size,
      type: 'xlsx',
      validation,
    },
    summary: `已按补充要求生成修订版表格 ${revisedName}。`,
  };
}

function buildUserFacingRevisedXlsxName(input = {}) {
  const fallback = path.basename(input.targetPath || '表格-已续改.xlsx');
  const originalName = String(input.originalName || '').trim();
  const cleanBase = originalName
    ? originalName.replace(/\.[^.]+$/u, '')
    : '';
  const safeBase = cleanBase && !/skill-runtime|quotation-sheet|alibaba-inquiry-meeting|run-\d+/i.test(cleanBase)
    ? cleanBase
    : '表格';
  const timestamp = fallback.match(/已续改-([0-9]{14}-[a-z0-9]+)\.xlsx$/i)?.[1] || new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  return `${safeBase}-已续改-${timestamp}.xlsx`;
}

function findLatestArtifact(session = {}) {
  return session.context?.artifact || session.artifact || session.skillAgentResult?.artifact || null;
}

/**
 * resolveEditableArtifact 把导出副本还原成可继续编辑的原始产物。
 *
 * 作用：
 * - 用户确认“导出文件”后,session 当前 artifact 会指向 `workbench/exports` 下的副本。
 * - 但后续“再加一句 / 改一下”应该继续修改原始 `workbench/artifacts` 产物。
 * - 如果 `exportedFrom` 不存在或不安全,保持当前 artifact,由后续路径校验负责拦截。
 *
 * 参数：
 * - input.artifact：当前 session 绑定的产物摘要。
 * - input.projectRoot：项目根目录。
 *
 * 返回值：可继续编辑的产物摘要。
 * 可能抛出的异常：无；路径安全错误会留给后续 resolveSafeArtifactPath 抛出。
 */
function resolveEditableArtifact(input = {}) {
  const artifact = input.artifact || {};
  const exportedFrom = String(artifact.exportedFrom || '').trim();
  if (!exportedFrom) {
    return artifact;
  }

  try {
    const sourcePath = resolveSafeArtifactPath({
      allowedExtensions: ['.md', '.txt', '.xlsx'],
      outputPath: exportedFrom,
      projectRoot: input.projectRoot,
    });
    const { exportedFrom: _exportedFrom, ...artifactWithoutExportMarker } = artifact;
    return {
      ...artifactWithoutExportMarker,
      exportedCopyPath: artifact.outputPath,
      outputPath: sourcePath,
    };
  } catch {
    return artifact;
  }
}

function resolveSafeMarkdownPath(input = {}) {
  return resolveSafeArtifactPath({
    allowedExtensions: ['.md', '.txt'],
    outputPath: input.outputPath,
    projectRoot: input.projectRoot,
  });
}

function resolveSafeArtifactPath(input = {}) {
  const projectRoot = input.projectRoot || process.cwd();
  const rawOutputPath = String(input.outputPath || '').trim();
  const filePath = path.isAbsolute(rawOutputPath)
    ? path.resolve(rawOutputPath)
    : path.resolve(projectRoot, rawOutputPath);
  const allowedRoot = path.resolve(projectRoot, 'workbench', 'artifacts');
  const isAllowed = filePath === allowedRoot || filePath.startsWith(`${allowedRoot}${path.sep}`);
  const ext = path.extname(filePath).toLowerCase();
  const allowedExtensions = input.allowedExtensions || [];

  if (!isAllowed) {
    throw createRevisionError('ARTIFACT_REVISION_PATH_FORBIDDEN', '为了安全,只能继续修改当前任务生成的产物。', 403);
  }
  if (!allowedExtensions.includes(ext)) {
    throw createRevisionError('ARTIFACT_REVISION_UNSUPPORTED', '当前产物格式暂不支持继续修改。', 400);
  }

  return filePath;
}

function buildRevisedXlsxPath(sourcePath) {
  const directory = path.dirname(sourcePath);
  const baseName = path.basename(sourcePath, path.extname(sourcePath));
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 6);
  return path.join(directory, `${baseName}-已续改-${stamp}-${suffix}.xlsx`);
}

async function runPythonXlsxRevision(input = {}) {
  const payload = {
    instruction: input.instruction || '继续优化当前表格',
    result: buildXlsxFollowupResult(input.instruction || ''),
  };
  const command = process.env.YINGDAN_PYTHON_BIN || CODEX_BUNDLED_PYTHON;
  const run = await runCommand(command, [
    '-c',
    XLSX_REVISION_SCRIPT,
    input.sourcePath,
    input.targetPath,
    JSON.stringify(payload),
  ]);

  if (run.exitCode !== 0) {
    throw createRevisionError('XLSX_REVISION_WRITE_FAILED', run.stderr || run.stdout || 'XLSX 修订版写入失败。', 500);
  }

  try {
    return JSON.parse(run.stdout || '{}');
  } catch (error) {
    throw createRevisionError('XLSX_REVISION_WRITE_FAILED', `XLSX 修订脚本返回无效 JSON: ${error.message}`, 500);
  }
}

function buildXlsxFollowupResult(instruction = '') {
  const additions = buildSafeBusinessAdditions(instruction);
  return additions.map((item) => item.replace(/^-\s*/, '')).join('\n');
}

function buildFollowupRevisionSection(input = {}) {
  const instruction = sanitizeInstruction(input.instruction || '继续优化当前产物');
  const generatedAt = new Date().toISOString();
  const suggestions = buildSafeBusinessAdditions({
    currentContent: input.currentContent || '',
    instruction,
  });

  return [
    `## 本次补充优化（${generatedAt}）`,
    '',
    `### 用户补充`,
    '',
    instruction,
    '',
    '### 已更新内容',
    '',
    ...suggestions,
    '',
    '### 交付提醒',
    '',
    '- 外发前仍需确认客户名称、产品规格、价格、交期、附件和收件渠道。',
    '- 如果涉及保存客户档案、导出文件或外部发送,仍需再次确认。',
  ].join('\n');
}

function buildSafeBusinessAdditions(input = '') {
  const instruction = typeof input === 'string' ? input : String(input.instruction || '');
  const currentContent = typeof input === 'string' ? '' : String(input.currentContent || '');
  const lower = instruction.toLowerCase();
  const additions = [];
  additions.push(...buildChannelScriptAdditions({ currentContent, instruction }));

  if (/样品|sample/.test(lower)) {
    additions.push('- 可替换英文句: If helpful, we can arrange samples after confirming the specification, quantity, and shipping details.');
  }
  if (/礼貌|柔和|客气|polite/.test(lower)) {
    additions.push('- 语气调整: 使用更礼貌、合作式表达,避免催促或压迫客户。');
  }
  if (/强硬|坚定|firm/.test(lower)) {
    additions.push('- 语气调整: 保持专业但更明确边界,不要承诺未确认的价格、交期或库存。');
  }
  if (/简短|短一点|精简|brief|short/.test(lower)) {
    additions.push('- 结构调整: 保留问候、关键问题和下一步,删除解释性长句。');
  }
  if (/moq|起订/.test(lower)) {
    additions.push('- 询问重点: MOQ 需要结合规格、包装和目的市场确认,不要直接给固定承诺。');
  }
  if (/交期|lead\s*time|delivery/.test(lower)) {
    additions.push('- 询问重点: 交期需要在确认数量、包装和付款节点后再给正式版本。');
  }

  if (!additions.length) {
    additions.push('- 已把本次补充作为当前产物的修订要求记录下来,可继续基于这份产物修改。');
  }

  return additions;
}

function sanitizeInstruction(value = '') {
  const cleaned = String(value || '')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned || '继续优化当前产物';
}

/**
 * buildChannelScriptAdditions 为跟进计划生成渠道化英文话术。
 *
 * 作用：
 * - 用户对已有客户推进计划补一句“把第1天/第3天话术写成英文 WhatsApp 和邮件两版”时,
 *   直接把可用话术写回当前 Markdown,而不是只记录这句要求。
 * - 只生成草稿内容,不执行外发；外发仍由上层确认机制处理。
 *
 * 参数：
 * - currentContent：当前 Markdown 产物正文,用于提取产品等上下文。
 * - instruction：用户本次补充要求。
 *
 * 返回值：Markdown 行数组。
 * 可能抛出的异常：无。
 */
function buildChannelScriptAdditions({ currentContent = '', instruction = '' } = {}) {
  const lower = String(instruction || '').toLowerCase();
  const asksForWhatsApp = /whatsapp|wa|站内信|即时消息/.test(lower);
  const asksForEmail = /邮件|email|mail/.test(lower);
  const asksForEnglish = /英文|english/.test(lower);
  const mentionsScript = /话术|文案|script|copy|message/.test(lower);
  const requestedDays = extractRequestedFollowupDays(instruction);

  if (!requestedDays.length || !mentionsScript || (!asksForWhatsApp && !asksForEmail)) {
    return [];
  }

  const product = extractProductFromMarkdown(currentContent);
  const englishProduct = translateRevisionProduct(product);
  const channelLabel = [
    asksForWhatsApp ? 'WhatsApp' : '',
    asksForEmail ? 'Email' : '',
  ].filter(Boolean).join(' 和 ');
  const languageNote = asksForEnglish ? '英文' : '可直接改写';
  const additions = [
    `- 已根据当前客户推进计划补充${languageNote} ${channelLabel} 跟进话术草稿,仅作为草稿,不会自动外发。`,
  ];

  for (const day of requestedDays) {
    if (asksForWhatsApp) {
      additions.push(
        `#### Day ${day} WhatsApp`,
        buildWhatsAppScript({ day, englishProduct }),
      );
    }
    if (asksForEmail) {
      additions.push(
        `#### Day ${day} Email`,
        `Subject: Quick follow-up on ${englishProduct}`,
        '',
        'Hi {{Customer Name}},',
        '',
        buildEmailBody({ day, englishProduct }),
        '',
        'Best regards,',
        '{{Your Name}}',
      );
    }
  }

  return additions;
}

function extractRequestedFollowupDays(instruction = '') {
  const value = String(instruction || '');
  const days = [];
  const dayPattern = /第\s*(\d{1,2})\s*天|day\s*(\d{1,2})/gi;
  let match = dayPattern.exec(value);

  while (match) {
    const day = Number(match[1] || match[2]);
    if (Number.isInteger(day) && day > 0 && day <= 31) {
      days.push(day);
    }
    match = dayPattern.exec(value);
  }

  return [...new Set(days)].sort((a, b) => a - b);
}

function extractProductFromMarkdown(content = '') {
  const value = String(content || '');
  return value.match(/产品[:：]\s*([^\n\r]+)/u)?.[1]?.trim() || '该产品';
}

function translateRevisionProduct(product = '') {
  const value = String(product || '').trim();
  const dictionary = [
    [/家具/u, 'furniture'],
    [/灯具|灯/u, 'lighting products'],
    [/太阳能路灯/u, 'solar street lights'],
    [/设备|机器/u, 'equipment'],
  ];
  const translated = dictionary.find(([pattern]) => pattern.test(value))?.[1];
  return translated || value || 'the product';
}

function buildWhatsAppScript({ day, englishProduct }) {
  if (day === 1) {
    return `Hi {{Customer Name}}, just checking whether the ${englishProduct} options are still useful for your current sourcing plan. I can send a short specification summary if helpful.`;
  }
  if (day === 3) {
    return `Hi {{Customer Name}}, I wanted to share one more angle on the ${englishProduct}: we can compare specification, sample timing, and packing options before you decide whether to continue.`;
  }
  return `Hi {{Customer Name}}, I will keep this brief. If the ${englishProduct} project is still active, I can help confirm the next practical step.`;
}

function buildEmailBody({ day, englishProduct }) {
  if (day === 1) {
    return `I wanted to follow up briefly on the ${englishProduct} discussion. If this project is still active, I can prepare a concise summary covering suitable specifications, sample options, and the key details we should confirm before quotation.`;
  }
  if (day === 3) {
    return `I am following up with one more practical point on the ${englishProduct}. Before moving to pricing, it may help to compare the required specification, target quantity, packing preference, and sample timing, so we can avoid giving you an inaccurate recommendation.`;
  }
  return `I will keep this follow-up short. If the ${englishProduct} project is still on your list, I can help confirm the most useful next step and reduce any unnecessary back-and-forth.`;
}

function createRevisionError(code, message, status) {
  return Object.assign(new Error(message), { code, status });
}

function runCommand(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      resolve({ exitCode: 1, stdout, stderr: error.message });
    });
    child.on('close', (exitCode) => {
      resolve({ exitCode, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}
