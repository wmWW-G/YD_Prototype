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

  const sourcePath = resolveSafeMarkdownPath({ outputPath: artifact.outputPath, projectRoot });
  const current = await readFile(sourcePath, 'utf8');
  const revision = buildFollowupRevisionSection({
    artifactName: artifact.name || path.basename(sourcePath),
    instruction,
  });
  const nextContent = `${current.replace(/\s+$/u, '')}\n\n${revision}\n`;

  await writeFile(sourcePath, nextContent, 'utf8');
  const fileStat = await stat(sourcePath);

  return {
    ok: true,
    artifact: {
      ...artifact,
      outputPath: sourcePath,
      revisedAt: new Date().toISOString(),
      sizeBytes: fileStat.size,
      type: artifact.type || 'markdown',
    },
    summary: `已按补充要求更新 ${artifact.name || path.basename(sourcePath)}。`,
  };
}

/**
 * reviseXlsxArtifactForFollowup 根据用户补充生成一份修订版 XLSX。
 *
 * 作用：
 * - 让询盘分析会这类表格产物也能“接着做”,而不是只能返回文字说明。
 * - 不直接覆盖原始工作簿,而是在同一 `workbench/artifacts/` 目录下生成一份修订版。
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

  const sourcePath = resolveSafeArtifactPath({
    allowedExtensions: ['.xlsx'],
    outputPath: artifact.outputPath,
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
    originalName: artifact.name,
    targetPath,
  });
  return {
    ok: true,
    artifact: {
      ...artifact,
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
  const suggestions = buildSafeBusinessAdditions(instruction);

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

function buildSafeBusinessAdditions(instruction = '') {
  const lower = instruction.toLowerCase();
  const additions = [];

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
