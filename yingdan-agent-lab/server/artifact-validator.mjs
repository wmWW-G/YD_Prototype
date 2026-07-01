import { spawn } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CODEX_BUNDLED_PYTHON =
  '/Users/garden/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const CODEX_BUNDLED_SOFFICE =
  '/Users/garden/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/soffice';

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
const XLSX_CLEANUP = `
import re
import sys
import tempfile
import zipfile
from pathlib import Path

path = Path(sys.argv[1])
temp_path = Path(tempfile.mkstemp(suffix=".xlsx")[1])

def clean_xml(name, data):
    if not (name.endswith(".xml") or name.endswith(".rels")):
        return data
    text = data.decode("utf-8", "ignore")
    text = re.sub(r"<tableParts[^>]*>.*?</tableParts>", "", text, flags=re.S)
    text = re.sub(r"<drawing[^>]*/>", "", text)
    text = re.sub(r"<Relationship[^>]+Type=\\"[^\\"]*(?:/table|/drawing)[^\\"]*\\"[^>]*/>", "", text)
    return text.encode("utf-8")

with zipfile.ZipFile(path, "r") as source, zipfile.ZipFile(temp_path, "w", zipfile.ZIP_DEFLATED) as target:
    seen = set()
    for item in source.infolist():
        name = item.filename
        if name in seen:
            continue
        seen.add(name)
        if name.startswith("xl/tables/") or name.startswith("xl/drawings/"):
            continue
        if name in ("xl/tables/", "xl/drawings/"):
            continue
        data = source.read(name)
        target.writestr(item, clean_xml(name, data))

temp_path.replace(path)
print("cleaned")
`;

/**
 * validateXlsxArtifact 在 Runtime 层复核 XLSX 产物。
 *
 * 作用：
 * - 不只相信 builder 的返回值，而是重新检查实际文件。
 * - 先用 LibreOffice headless 重存一次,贴近真实交付前的固定 XLSX 流程。
 * - 重存后清理 Excel table/drawing 残留,再做最终扫描。
 * - 使用 `unzip -t` 确认压缩包结构可读。
 * - 使用 openpyxl 打开工作簿并检查必需 sheet。
 * - 扫描 `xl/tables/`、`xl/drawings/`、tableParts 和 drawing relationships 残留。
 *
 * 参数：
 * - options.outputPath：XLSX 文件路径。
 * - options.requiredSheets：必需工作表名称数组。
 * - options.forbiddenSheets：禁止出现的工作表名称数组。
 * - options.pythonBin：可选 Python 路径。
 * - options.sofficeBin：可选 LibreOffice / soffice 路径。
 *
 * 返回值：Promise<object>，ok=true 表示所有检查通过。
 * 可能抛出的异常：不主动抛出；外部命令失败会转成 ok=false。
 */
export async function validateXlsxArtifact(options = {}) {
  const outputPath = options.outputPath;
  const requiredSheets = Array.isArray(options.requiredSheets) ? options.requiredSheets : [];
  const forbiddenSheets = Array.isArray(options.forbiddenSheets) ? options.forbiddenSheets : [];
  const pythonBin = options.pythonBin || process.env.YINGDAN_PYTHON_BIN || CODEX_BUNDLED_PYTHON;
  const sofficeBin = options.sofficeBin || process.env.YINGDAN_SOFFICE_BIN || CODEX_BUNDLED_SOFFICE;

  const result = {
    ok: false,
    outputPath,
    checks: {
      exists: false,
      libreOffice: false,
      cleanup: false,
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

  const libreOfficeCheck = await resaveXlsxWithLibreOffice({ outputPath, sofficeBin });
  result.checks.libreOffice = libreOfficeCheck.ok;
  result.libreOffice = libreOfficeCheck;
  if (!result.checks.libreOffice) {
    return { ...result, message: `LibreOffice headless 重存失败：${libreOfficeCheck.message}` };
  }

  const cleanupCheck = await runCommand(pythonBin, ['-c', XLSX_CLEANUP, outputPath]);
  result.checks.cleanup = cleanupCheck.exitCode === 0;
  result.cleanup = {
    ok: result.checks.cleanup,
    message: cleanupCheck.exitCode === 0 ? 'XLSX table/drawing 残留清理完成。' : (cleanupCheck.stderr || cleanupCheck.stdout),
  };
  if (!result.checks.cleanup) {
    return { ...result, message: `XLSX table/drawing 残留清理失败：${cleanupCheck.stderr || cleanupCheck.stdout}` };
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

/**
 * resaveXlsxWithLibreOffice 用 LibreOffice headless 重存 XLSX。
 *
 * 作用：
 * - 让交付前的工作簿经过 LibreOffice 重新写包,提前暴露坏包或兼容性问题。
 * - 重存后的文件再进入 unzip/openpyxl/残留扫描,符合项目固定 XLSX 交付流程。
 *
 * 参数：
 * - input.outputPath：原始 XLSX 路径,会被重存后的文件覆盖。
 * - input.sofficeBin：LibreOffice/soffice 可执行文件路径。
 *
 * 返回值：{ ok, message }。
 * 可能抛出的异常：不向外抛出,失败会返回 ok=false。
 */
async function resaveXlsxWithLibreOffice(input = {}) {
  const outputPath = input.outputPath;
  const sofficeBin = input.sofficeBin;
  let tempRoot = '';

  try {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-libreoffice-xlsx-'));
    const inputDir = path.join(tempRoot, 'input');
    const outputDir = path.join(tempRoot, 'output');
    const profileDir = path.join(tempRoot, 'profile');
    await Promise.all([
      mkdir(inputDir, { recursive: true }),
      mkdir(outputDir, { recursive: true }),
      mkdir(profileDir, { recursive: true }),
    ]);

    const inputCopyPath = path.join(inputDir, path.basename(outputPath));
    const convertedPath = path.join(outputDir, path.basename(outputPath));
    await copyFile(outputPath, inputCopyPath);

    const command = await runCommand(sofficeBin, [
      '--headless',
      `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
      '--convert-to',
      'xlsx',
      '--outdir',
      outputDir,
      inputCopyPath,
    ]);
    if (command.exitCode !== 0) {
      return { ok: false, message: command.stderr || command.stdout || `soffice exited with ${command.exitCode}` };
    }

    await stat(convertedPath);
    await copyFile(convertedPath, outputPath);
    return { ok: true, message: 'LibreOffice headless 重存通过。' };
  } catch (error) {
    return { ok: false, message: error.message || 'LibreOffice headless 重存失败。' };
  } finally {
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }
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
