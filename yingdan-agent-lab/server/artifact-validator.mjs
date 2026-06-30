import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';

const CODEX_BUNDLED_PYTHON =
  '/Users/garden/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';

const XLSX_INSPECTOR = `
import json
import sys
import zipfile
from openpyxl import load_workbook

path = sys.argv[1]
required = json.loads(sys.argv[2])
forbidden = json.loads(sys.argv[3])

result = {
    "openpyxl": False,
    "sheets": [],
    "missingSheets": [],
    "forbiddenPresent": [],
    "tableParts": [],
    "drawingParts": [],
    "tableRelationships": [],
    "drawingRelationships": [],
}

with zipfile.ZipFile(path) as archive:
    names = archive.namelist()
    result["tableParts"] = [name for name in names if name.startswith("xl/tables/")]
    result["drawingParts"] = [name for name in names if name.startswith("xl/drawings/")]

    for name in names:
        if not (name.endswith(".xml") or name.endswith(".rels")):
            continue
        try:
            text = archive.read(name).decode("utf-8", "ignore")
        except Exception:
            continue
        if "tableParts" in text or "/tables/" in text or "tables/" in text:
            result["tableRelationships"].append(name)
        if "/drawings/" in text or "drawings/" in text:
            result["drawingRelationships"].append(name)

workbook = load_workbook(path, read_only=True, data_only=True)
result["openpyxl"] = True
result["sheets"] = list(workbook.sheetnames)
result["missingSheets"] = [sheet for sheet in required if sheet not in result["sheets"]]
result["forbiddenPresent"] = [sheet for sheet in forbidden if sheet in result["sheets"]]

print(json.dumps(result, ensure_ascii=False))
`;

/**
 * validateXlsxArtifact 在 Runtime 层复核 XLSX 产物。
 *
 * 作用：
 * - 不只相信 builder 的返回值，而是重新检查实际文件。
 * - 使用 `unzip -t` 确认压缩包结构可读。
 * - 使用 openpyxl 打开工作簿并检查必需 sheet。
 * - 扫描 `xl/tables/`、`xl/drawings/`、tableParts 和 drawing relationships 残留。
 *
 * 参数：
 * - options.outputPath：XLSX 文件路径。
 * - options.requiredSheets：必需工作表名称数组。
 * - options.forbiddenSheets：禁止出现的工作表名称数组。
 * - options.pythonBin：可选 Python 路径。
 *
 * 返回值：Promise<object>，ok=true 表示所有检查通过。
 * 可能抛出的异常：不主动抛出；外部命令失败会转成 ok=false。
 */
export async function validateXlsxArtifact(options = {}) {
  const outputPath = options.outputPath;
  const requiredSheets = Array.isArray(options.requiredSheets) ? options.requiredSheets : [];
  const forbiddenSheets = Array.isArray(options.forbiddenSheets) ? options.forbiddenSheets : [];
  const pythonBin = options.pythonBin || process.env.YINGDAN_PYTHON_BIN || CODEX_BUNDLED_PYTHON;

  const result = {
    ok: false,
    outputPath,
    checks: {
      exists: false,
      zip: false,
      openpyxl: false,
      requiredSheets: false,
      forbiddenSheets: false,
      noTableParts: false,
      noDrawingParts: false,
    },
    sheets: [],
    missingSheets: [],
    forbiddenPresent: [],
    residuals: {
      tableParts: [],
      drawingParts: [],
      tableRelationships: [],
      drawingRelationships: [],
    },
    message: '',
  };

  if (!outputPath) {
    return { ...result, message: '缺少 XLSX 路径。' };
  }

  try {
    const fileStat = await stat(outputPath);
    result.checks.exists = fileStat.isFile() && fileStat.size > 0;
    result.bytes = fileStat.size;
  } catch (error) {
    return { ...result, message: error.code === 'ENOENT' ? 'XLSX 文件不存在。' : error.message };
  }

  const zipCheck = await runCommand('unzip', ['-t', outputPath]);
  result.checks.zip = zipCheck.exitCode === 0;
  if (!result.checks.zip) {
    return { ...result, message: `unzip -t 失败：${zipCheck.stderr || zipCheck.stdout}` };
  }

  const workbookCheck = await runCommand(pythonBin, ['-c', XLSX_INSPECTOR, outputPath, JSON.stringify(requiredSheets), JSON.stringify(forbiddenSheets)]);
  if (workbookCheck.exitCode !== 0) {
    return { ...result, message: `openpyxl 复核失败：${workbookCheck.stderr || workbookCheck.stdout}` };
  }

  const parsed = JSON.parse(workbookCheck.stdout || '{}');
  result.checks.openpyxl = Boolean(parsed.openpyxl);
  result.sheets = parsed.sheets || [];
  result.missingSheets = parsed.missingSheets || [];
  result.forbiddenPresent = parsed.forbiddenPresent || [];
  result.residuals = {
    tableParts: parsed.tableParts || [],
    drawingParts: parsed.drawingParts || [],
    tableRelationships: parsed.tableRelationships || [],
    drawingRelationships: parsed.drawingRelationships || [],
  };
  result.checks.requiredSheets = result.missingSheets.length === 0;
  result.checks.forbiddenSheets = result.forbiddenPresent.length === 0;
  result.checks.noTableParts = result.residuals.tableParts.length === 0 && result.residuals.tableRelationships.length === 0;
  result.checks.noDrawingParts = result.residuals.drawingParts.length === 0 && result.residuals.drawingRelationships.length === 0;
  result.ok = Object.values(result.checks).every(Boolean);
  result.message = result.ok ? 'XLSX Runtime 复核通过。' : 'XLSX Runtime 复核未通过。';

  return result;
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
      resolve({ exitCode, stdout, stderr });
    });
  });
}
