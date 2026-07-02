import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import { parseAgentReferenceFile } from './agent-reference-parser.mjs';

const execFileAsync = promisify(execFile);
const CODEX_BUNDLED_PYTHON =
  '/Users/garden/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const XLSX_FIXTURE_BUILDER = `
import sys
from openpyxl import Workbook

workbook = Workbook()
sheet = workbook.active
sheet.title = "报价单"
sheet.append(["产品", "数量", "单价", "贸易条款"])
sheet.append(["太阳能路灯", "500套", "USD 35", "FOB Shanghai"])
workbook.save(sys.argv[1])
`;
const XLSX_LONG_CELL_FIXTURE_BUILDER = `
import sys
from openpyxl import Workbook

workbook = Workbook()
sheet = workbook.active
sheet.title = "长文本"
sheet.append(["备注"])
sheet.append(["A" * 20000])
workbook.save(sys.argv[1])
`;

/**
 * createWorkbookBase64 创建测试用 XLSX 并转成 base64。
 *
 * 作用：
 * - 用真实 openpyxl 生成工作簿,避免测试只验证假字符串。
 * - 临时目录在读取后立即清理,不污染项目 workbench。
 *
 * 参数：无。
 * 返回值：Promise<string>,XLSX 文件的 base64 内容。
 * 可能抛出的异常：Python 或文件系统失败时抛出原始异常。
 */
async function createWorkbookBase64(builder = XLSX_FIXTURE_BUILDER) {
  const tempDirectory = await mkdtemp(path.join(tmpdir(), 'yingdan-reference-test-'));
  const workbookPath = path.join(tempDirectory, 'quote.xlsx');
  try {
    await execFileAsync(CODEX_BUNDLED_PYTHON, ['-c', builder, workbookPath]);
    const workbookBytes = await readFile(workbookPath);
    return workbookBytes.toString('base64');
  } finally {
    await rm(tempDirectory, { force: true, recursive: true });
  }
}

test('parseAgentReferenceFile extracts readable text from xlsx workbooks', async () => {
  const parsed = await parseAgentReferenceFile({
    dataBase64: await createWorkbookBase64(),
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    name: 'quote.xlsx',
  });

  assert.equal(parsed.name, 'quote.xlsx');
  assert.match(parsed.text, /工作表: 报价单/);
  assert.match(parsed.text, /太阳能路灯/);
  assert.match(parsed.text, /500套/);
  assert.match(parsed.text, /USD 35/);
  assert.match(parsed.text, /FOB Shanghai/);
  assert.doesNotMatch(parsed.text, /\/tmp|Users\/garden|workbench/);
});

test('parseAgentReferenceFile accepts xlsm references with the same readable extraction path', async () => {
  const parsed = await parseAgentReferenceFile({
    dataBase64: await createWorkbookBase64(),
    mimeType: 'application/vnd.ms-excel.sheet.macroenabled.12',
    name: 'quote.xlsm',
  });

  assert.equal(parsed.name, 'quote.xlsm');
  assert.match(parsed.text, /太阳能路灯/);
  assert.match(parsed.text, /FOB Shanghai/);
});

test('parseAgentReferenceFile keeps long cells and total text bounded on the backend', async () => {
  const parsed = await parseAgentReferenceFile({
    dataBase64: await createWorkbookBase64(XLSX_LONG_CELL_FIXTURE_BUILDER),
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    name: 'long-cell.xlsx',
  });

  assert.equal(parsed.text.length < 1200, true);
  assert.match(parsed.text, /单元格较长/);
  assert.doesNotMatch(parsed.text, /A{1000}/);
});

test('parseAgentReferenceFile rejects oversized xlsx uploads before parsing', async () => {
  await assert.rejects(
    () => parseAgentReferenceFile({
      dataBase64: Buffer.alloc((5 * 1024 * 1024) + 1).toString('base64'),
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      name: 'too-large.xlsx',
    }),
    (error) => error.code === 'REFERENCE_FILE_TOO_LARGE' && error.status === 413,
  );
});

test('parseAgentReferenceFile rejects unsupported reference files', async () => {
  await assert.rejects(
    () => parseAgentReferenceFile({
      dataBase64: Buffer.from('%PDF fake bytes').toString('base64'),
      mimeType: 'application/pdf',
      name: 'catalog.pdf',
    }),
    (error) => error.code === 'REFERENCE_FILE_UNSUPPORTED' && error.status === 400,
  );
});
