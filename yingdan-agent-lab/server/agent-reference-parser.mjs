import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CODEX_BUNDLED_PYTHON =
  '/Users/garden/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const MAX_REFERENCE_FILE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_XLSX_EXTENSIONS = new Set(['.xlsx', '.xlsm']);
const SUPPORTED_XLSX_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroenabled.12',
]);
const XLSX_REFERENCE_EXTRACTOR = `
import datetime
import json
import sys
from openpyxl import load_workbook

MAX_SHEETS = 3
MAX_ROWS_PER_SHEET = 24
MAX_COLUMNS_PER_ROW = 10
MAX_CELL_CHARS = 320
MAX_TEXT_CHARS = 9000

def clean_cell(value):
    if value is None:
        return ""
    if isinstance(value, (datetime.datetime, datetime.date)):
        text = value.isoformat()
    else:
        text = str(value).strip()
    if len(text) > MAX_CELL_CHARS:
        return text[:MAX_CELL_CHARS] + f"[单元格较长,已截断到 {MAX_CELL_CHARS} 字]"
    return text

workbook = load_workbook(sys.argv[1], read_only=True, data_only=True)
lines = []
sheet_count = len(workbook.worksheets)
for sheet in workbook.worksheets[:MAX_SHEETS]:
    lines.append(f"工作表: {sheet.title}")
    row_count = 0
    for row in sheet.iter_rows(values_only=True):
        values = [clean_cell(cell) for cell in row[:MAX_COLUMNS_PER_ROW]]
        while values and not values[-1]:
            values.pop()
        if not values:
            continue
        lines.append(" | ".join(values))
        row_count += 1
        if row_count >= MAX_ROWS_PER_SHEET:
            break
    if row_count == 0:
        lines.append("（空工作表）")
    elif (sheet.max_row or 0) > row_count:
        lines.append(f"[仅引用前 {MAX_ROWS_PER_SHEET} 行]")
    lines.append("")
if sheet_count > MAX_SHEETS:
    lines.append(f"[另有 {sheet_count - MAX_SHEETS} 个工作表未展开]")
text = "\\n".join(lines).strip()
if len(text) > MAX_TEXT_CHARS:
    text = text[:MAX_TEXT_CHARS].rstrip() + "\\n\\n[资料较长,后续内容已省略]"
print(json.dumps({"text": text}, ensure_ascii=False))
`;

/**
 * parseAgentReferenceFile 把用户上传的 XLSX 引用资料解析成可读文本。
 *
 * 作用：
 * - 新对话的“引用资料”按钮可以吃报价表、产品表和客户清单这类真实外贸表格。
 * - 返回结果是自然文本,后续仍走用户普通任务输入,不要求用户理解 schema 或 JSON。
 * - 解析只发生在临时目录,完成后立即清理,不会把用户文件写入客户档案或 workbench。
 *
 * 参数：
 * - input.name：文件名,用于校验扩展名和返回展示名。
 * - input.mimeType：浏览器传来的 MIME 类型。
 * - input.dataBase64：文件内容的 base64 字符串。
 *
 * 返回值：Promise<object>,包含 name 和 text。
 * 可能抛出的异常：
 * - REFERENCE_FILE_UNSUPPORTED：不是支持的 XLSX/XLSM 文件。
 * - REFERENCE_FILE_TOO_LARGE：文件超过当前原型解析上限。
 * - REFERENCE_FILE_EMPTY：文件为空或没有抽取到文本。
 * - REFERENCE_FILE_PARSE_FAILED：openpyxl 解析失败。
 */
export async function parseAgentReferenceFile(input = {}) {
  assertSupportedReferenceWorkbook(input);
  const workbookBytes = decodeReferenceBase64(input.dataBase64);
  if (workbookBytes.length > MAX_REFERENCE_FILE_BYTES) {
    throw createReferenceParserError(
      'REFERENCE_FILE_TOO_LARGE',
      '这份表格太大了,请先保留关键 sheet 或把关键内容粘贴到输入框。',
      413,
    );
  }

  const extension = referenceWorkbookExtension(input);
  const safeName = safeReferenceName(input.name || `引用资料${extension}`);
  const tempDirectory = await mkdtemp(path.join(tmpdir(), 'yingdan-reference-'));
  const tempFilePath = path.join(tempDirectory, `reference${extension}`);

  try {
    await writeFile(tempFilePath, workbookBytes);
    const output = await runXlsxReferenceExtractor(tempFilePath);
    const parsed = JSON.parse(output || '{}');
    const text = String(parsed.text || '').trim();
    if (!text) {
      throw createReferenceParserError(
        'REFERENCE_FILE_EMPTY',
        '这份表格没有读到可用文字,可以换一份文件或直接粘贴关键内容。',
        400,
      );
    }
    return {
      name: safeName,
      text,
    };
  } catch (error) {
    if (error.code?.startsWith?.('REFERENCE_FILE_')) {
      throw error;
    }
    throw createReferenceParserError(
      'REFERENCE_FILE_PARSE_FAILED',
      '这份表格暂时解析失败,可以先复制关键内容到输入框。',
      400,
      error,
    );
  } finally {
    await rm(tempDirectory, { force: true, recursive: true });
  }
}

/**
 * assertSupportedReferenceWorkbook 校验文件名或 MIME 是否属于可解析工作簿。
 *
 * 作用：
 * - 后端不能相信前端 accept,必须再次校验上传内容的声明格式。
 * - 当前只开放 XLSX/XLSM,PDF 仍走“不支持”提示。
 *
 * 参数：
 * - input.name：文件名。
 * - input.mimeType：MIME 类型。
 *
 * 返回值：无。
 * 可能抛出的异常：不支持时抛出 REFERENCE_FILE_UNSUPPORTED。
 */
function assertSupportedReferenceWorkbook(input = {}) {
  const extension = declaredReferenceExtension(input);
  const mimeType = String(input.mimeType || '').toLowerCase();
  if (!SUPPORTED_XLSX_EXTENSIONS.has(extension) && !SUPPORTED_XLSX_MIME_TYPES.has(mimeType)) {
    throw createReferenceParserError(
      'REFERENCE_FILE_UNSUPPORTED',
      '这类文件暂时不能直接引用。请先转成 txt、md、csv 或 xlsx,也可以把关键内容粘贴到输入框。',
      400,
    );
  }
}

/**
 * declaredReferenceExtension 读取用户文件声明的原始扩展名。
 *
 * 作用：
 * - 支持性判断必须看真实文件名,不能把 `.pdf` 默认改成 `.xlsx` 后放行。
 *
 * 参数：
 * - input.name：文件名。
 *
 * 返回值：小写扩展名,没有扩展名时返回空字符串。
 * 可能抛出的异常：无。
 */
function declaredReferenceExtension(input = {}) {
  return path.extname(String(input.name || '')).toLowerCase();
}

/**
 * referenceWorkbookExtension 取得安全工作簿扩展名。
 *
 * 作用：
 * - 临时文件只使用白名单扩展名,避免把原始文件名里的路径片段带进临时目录。
 * - 如果浏览器只传 MIME 没有扩展名,默认按 .xlsx 写入。
 *
 * 参数：
 * - input.name：文件名。
 * - input.mimeType：MIME 类型。
 *
 * 返回值：`.xlsx` 或 `.xlsm`。
 * 可能抛出的异常：无。
 */
function referenceWorkbookExtension(input = {}) {
  const extension = path.extname(String(input.name || '')).toLowerCase();
  if (SUPPORTED_XLSX_EXTENSIONS.has(extension)) {
    return extension;
  }
  return '.xlsx';
}

/**
 * decodeReferenceBase64 把前端传来的 base64 文件体转为 Buffer。
 *
 * 作用：
 * - 支持纯 base64,也兼容浏览器未来可能传来的 data URL 形式。
 * - 空文件直接在这里失败,不要把空 Buffer 交给 openpyxl。
 *
 * 参数：
 * - dataBase64：base64 字符串。
 *
 * 返回值：Buffer。
 * 可能抛出的异常：为空或无效时抛出 REFERENCE_FILE_EMPTY。
 */
function decodeReferenceBase64(dataBase64 = '') {
  const normalized = String(dataBase64 || '').replace(/^data:.*?;base64,/iu, '').trim();
  const buffer = Buffer.from(normalized, 'base64');
  if (!buffer.length) {
    throw createReferenceParserError(
      'REFERENCE_FILE_EMPTY',
      '这份资料没有读到可用文字,可以换一份文件或直接粘贴关键内容。',
      400,
    );
  }
  return buffer;
}

/**
 * runXlsxReferenceExtractor 调用 openpyxl 抽取表格前几行内容。
 *
 * 作用：
 * - Node 不直接解析 XLSX,复用本机 bundled Python 的 openpyxl。
 * - 子进程带超时,避免异常工作簿让解析请求长时间挂住。
 *
 * 参数：
 * - filePath：临时 XLSX 文件路径。
 *
 * 返回值：Promise<string>,Python 输出的 JSON 字符串。
 * 可能抛出的异常：Python 启动、超时或解析失败时抛出普通 Error。
 */
function runXlsxReferenceExtractor(filePath) {
  return new Promise((resolve, reject) => {
    const child = spawn(CODEX_BUNDLED_PYTHON, ['-c', XLSX_REFERENCE_EXTRACTOR, filePath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('XLSX reference parsing timed out'));
    }, 10_000);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(stderr.trim() || `XLSX reference parser exited with ${code}`));
    });
  });
}

/**
 * safeReferenceName 清理返回给前台展示的资料名。
 *
 * 作用：
 * - 用户只需要看到自己选的文件名,不能看到本机临时路径。
 *
 * 参数：
 * - value：原始文件名。
 *
 * 返回值：单行安全文件名。
 * 可能抛出的异常：无。
 */
function safeReferenceName(value = '') {
  const basename = path.basename(String(value || '')).replace(/\s+/g, ' ').trim();
  return basename || '引用资料.xlsx';
}

/**
 * createReferenceParserError 创建解析器专用异常。
 *
 * 参数：
 * - code：错误码。
 * - message：用户可理解的错误提示。
 * - status：HTTP 状态码。
 * - cause：可选底层异常,只留给服务端排查。
 *
 * 返回值：Error 实例。
 * 可能抛出的异常：无。
 */
function createReferenceParserError(code, message, status = 400, cause = null) {
  return Object.assign(new Error(message), { cause, code, status });
}
