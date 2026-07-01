import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildInquiryMeetingXlsx, createInquiryMeetingFixturePayload } from './alibaba-skill.mjs';
import { validateXlsxArtifact } from './artifact-validator.mjs';

const CODEX_BUNDLED_PYTHON =
  process.env.YINGDAN_PYTHON_BIN ||
  '/Users/garden/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';

test('validateXlsxArtifact verifies zip, openpyxl, required sheets, and residual table or drawing parts', async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-xlsx-validator-'));

  try {
    const built = await buildInquiryMeetingXlsx({
      outputRoot,
      payload: createInquiryMeetingFixturePayload(),
    });

    const result = await validateXlsxArtifact({
      outputPath: built.outputPath,
      requiredSheets: built.requiredSheets,
      forbiddenSheets: ['数据质量检查'],
    });

    assert.equal(result.ok, true);
    assert.equal(result.checks.libreOffice, true);
    assert.equal(result.checks.cleanup, true);
    assert.equal(result.checks.zip, true);
    assert.equal(result.checks.openpyxl, true);
    assert.equal(result.checks.requiredSheets, true);
    assert.equal(result.checks.noTableParts, true);
    assert.equal(result.checks.noDrawingParts, true);
    assert.deepEqual(result.missingSheets, []);

    const missingSheet = await validateXlsxArtifact({
      outputPath: built.outputPath,
      requiredSheets: [...built.requiredSheets, '不存在的工作表'],
    });
    assert.equal(missingSheet.ok, false);
    assert.deepEqual(missingSheet.missingSheets, ['不存在的工作表']);
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});

test('validateXlsxArtifact cleans table and drawing remnants before final inspection', async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-xlsx-cleanup-'));

  try {
    const built = await buildInquiryMeetingXlsx({
      outputRoot,
      payload: createInquiryMeetingFixturePayload(),
    });
    await injectXlsxResidualParts(built.outputPath);

    const dirtyResiduals = await collectXlsxResiduals(built.outputPath);
    assert.deepEqual(dirtyResiduals.tableParts, ['xl/tables/table1.xml']);
    assert.deepEqual(dirtyResiduals.drawingParts, ['xl/drawings/drawing1.xml']);
    assert.ok(dirtyResiduals.tableRelationships.includes('xl/worksheets/sheet1.xml'));
    assert.ok(dirtyResiduals.drawingRelationships.includes('xl/worksheets/_rels/sheet1.xml.rels'));

    const fakeSofficeBin = await writeFakeSoffice(outputRoot);
    const result = await validateXlsxArtifact({
      outputPath: built.outputPath,
      requiredSheets: built.requiredSheets,
      sofficeBin: fakeSofficeBin,
    });

    assert.equal(result.ok, true);
    assert.equal(result.checks.libreOffice, true);
    assert.equal(result.checks.cleanup, true);
    assert.equal(result.checks.noTableParts, true);
    assert.equal(result.checks.noDrawingParts, true);
    assert.deepEqual(result.residuals.tableParts, []);
    assert.deepEqual(result.residuals.drawingParts, []);
    assert.deepEqual(result.residuals.tableRelationships, []);
    assert.deepEqual(result.residuals.drawingRelationships, []);

    const cleanedResiduals = await collectXlsxResiduals(built.outputPath);
    assert.deepEqual(cleanedResiduals.tableParts, []);
    assert.deepEqual(cleanedResiduals.drawingParts, []);
    assert.deepEqual(cleanedResiduals.tableRelationships, []);
    assert.deepEqual(cleanedResiduals.drawingRelationships, []);
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});

test('validateXlsxArtifact fails closed when LibreOffice resave is unavailable', async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-xlsx-soffice-fail-'));
  const originalPath = process.env.PATH;

  try {
    const built = await buildInquiryMeetingXlsx({
      outputRoot,
      payload: createInquiryMeetingFixturePayload(),
    });
    const missingSofficeBin = path.join(outputRoot, 'missing-soffice');
    const downstreamPythonMarker = path.join(outputRoot, 'downstream-python-called');
    const downstreamUnzipMarker = path.join(outputRoot, 'downstream-unzip-called');
    const fakePythonBin = await writeMarkerCommand({
      outputRoot,
      name: 'fake-python',
      markerPath: downstreamPythonMarker,
      exitCode: 73,
    });
    await writeMarkerCommand({
      outputRoot,
      name: 'unzip',
      markerPath: downstreamUnzipMarker,
      exitCode: 0,
    });
    process.env.PATH = `${outputRoot}${path.delimiter}${originalPath || ''}`;

    const result = await validateXlsxArtifact({
      outputPath: built.outputPath,
      requiredSheets: built.requiredSheets,
      pythonBin: fakePythonBin,
      sofficeBin: missingSofficeBin,
    });

    assert.equal(result.ok, false);
    assert.equal(result.checks.exists, true);
    assert.equal(result.checks.libreOffice, false);
    assert.equal(result.checks.cleanup, false);
    assert.equal(result.checks.zip, false);
    assert.equal(result.checks.openpyxl, false);
    assert.match(result.message, /LibreOffice headless 重存失败/);
    assert.equal(await pathExists(downstreamPythonMarker), false);
    assert.equal(await pathExists(downstreamUnzipMarker), false);
  } finally {
    process.env.PATH = originalPath;
    await rm(outputRoot, { recursive: true, force: true });
  }
});

async function injectXlsxResidualParts(outputPath) {
  const script = `
import sys
import tempfile
import zipfile
from pathlib import Path

path = Path(sys.argv[1])
temp_path = Path(tempfile.mkstemp(suffix=".xlsx")[1])

sheet_xml_name = "xl/worksheets/sheet1.xml"
sheet_rels_name = "xl/worksheets/_rels/sheet1.xml.rels"
sheet_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId99" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table1.xml"/>
  <Relationship Id="rId100" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
</Relationships>""".encode("utf-8")

with zipfile.ZipFile(path, "r") as source, zipfile.ZipFile(temp_path, "w", zipfile.ZIP_DEFLATED) as target:
    seen = set()
    for item in source.infolist():
        name = item.filename
        if name in seen or name == sheet_rels_name:
            continue
        seen.add(name)
        data = source.read(name)
        if name == sheet_xml_name:
            text = data.decode("utf-8", "ignore")
            text = text.replace(
                "</worksheet>",
                '<drawing r:id="rId100"/><tableParts count="1"><tablePart r:id="rId99"/></tableParts></worksheet>',
            )
            data = text.encode("utf-8")
        target.writestr(item, data)
    target.writestr("xl/tables/table1.xml", b"<table id='1' name='DirtyTable'/>")
    target.writestr("xl/drawings/drawing1.xml", b"<xdr:wsDr xmlns:xdr='http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing'/>")
    target.writestr(sheet_rels_name, sheet_rels)

temp_path.replace(path)
`;
  await runPython(script, [outputPath]);
}

async function collectXlsxResiduals(outputPath) {
  const script = `
import json
import sys
import zipfile

path = sys.argv[1]
result = {
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
        text = archive.read(name).decode("utf-8", "ignore")
        if "tableParts" in text or "/tables/" in text or "tables/" in text:
            result["tableRelationships"].append(name)
        if "/drawings/" in text or "drawings/" in text:
            result["drawingRelationships"].append(name)
print(json.dumps(result, ensure_ascii=False))
`;
  const output = await runPython(script, [outputPath]);
  return JSON.parse(output);
}

async function writeFakeSoffice(outputRoot) {
  const fakeSofficeBin = path.join(outputRoot, 'fake-soffice');
  await writeFile(fakeSofficeBin, `#!/bin/sh
outdir=""
last=""
previous=""
for arg in "$@"; do
  if [ "$previous" = "--outdir" ]; then
    outdir="$arg"
  fi
  last="$arg"
  previous="$arg"
done
if [ -z "$outdir" ] || [ -z "$last" ]; then
  echo "missing outdir or input" >&2
  exit 1
fi
mkdir -p "$outdir"
cp "$last" "$outdir/$(basename "$last")"
`);
  await chmod(fakeSofficeBin, 0o755);
  return fakeSofficeBin;
}

async function writeMarkerCommand(input) {
  const commandPath = path.join(input.outputRoot, input.name);
  await writeFile(commandPath, `#!/bin/sh
echo called > "${input.markerPath}"
exit ${input.exitCode}
`);
  await chmod(commandPath, 0o755);
  return commandPath;
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function runPython(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(CODEX_BUNDLED_PYTHON, ['-c', script, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
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
      reject(new Error(stderr || stdout || `python test helper failed with ${exitCode}`));
    });
  });
}
