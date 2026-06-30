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
 * readAgentArtifactPreview 读取当前 Agent session 的最新产物预览。
 *
 * 作用：
 * - 给前端“查看文件”提供真实内容,让 Markdown 草稿和客户分析能在任务线程里打开。
 * - 只读取 session 里记录的最新产物,并且路径必须位于 `workbench/artifacts/` 或 `workbench/exports/` 下。
 * - 对 XLSX 等二进制产物只返回可读摘要,不把二进制内容塞进前端。
 *
 * 参数：
 * - input.projectRoot：项目根目录。
 * - input.session：agent-session-store 读出的 session 对象。
 *
 * 返回值：Promise<object>,包含 ok/name/type/content 等字段。
 * 可能抛出的异常：文件不存在、路径越界或读取失败时抛出带 code/status 的错误。
 */
export async function readAgentArtifactPreview(input = {}) {
  const projectRoot = input.projectRoot || process.cwd();
  const session = input.session || {};
  const artifact = findLatestArtifact(session);

  if (!artifact?.outputPath) {
    throw createPreviewError('ARTIFACT_NOT_FOUND', '这次任务还没有可预览的产物。', 404);
  }

  const filePath = resolveSafeArtifactPath({ outputPath: artifact.outputPath, projectRoot });
  const fileStat = await stat(filePath);
  const name = artifact.name || path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (artifact.type === 'markdown' || ext === '.md' || ext === '.txt') {
    const raw = await readFile(filePath, 'utf8');
    const content = raw.slice(0, MAX_TEXT_PREVIEW_CHARS);
    return {
      ok: true,
      content,
      name,
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
    sizeBytes: fileStat.size,
    truncated: false,
    type: artifact.type || ext.replace('.', '') || 'file',
  };
}

/**
 * findLatestArtifact 从 session 里取最新产物。
 *
 * 参数：
 * - session：agent-session-store 持久化的线程状态。
 *
 * 返回值：artifact 对象或 null。
 * 可能抛出的异常：无。
 */
function findLatestArtifact(session = {}) {
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
