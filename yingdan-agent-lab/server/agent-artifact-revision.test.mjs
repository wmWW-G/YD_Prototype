import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { reviseMarkdownArtifactForFollowup, reviseXlsxArtifactForFollowup } from './agent-artifact-revision.mjs';

const CODEX_BUNDLED_PYTHON =
  '/Users/garden/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';

async function withRevisionProject() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-artifact-revision-'));
  const artifactRoot = path.join(projectRoot, 'workbench', 'artifacts', 'run-1');
  await mkdir(artifactRoot, { recursive: true });
  return {
    artifactRoot,
    projectRoot,
    async cleanup() {
      await rm(projectRoot, { recursive: true, force: true });
    },
  };
}

test('reviseMarkdownArtifactForFollowup appends a safe follow-up revision to the current markdown artifact', async () => {
  const fixture = await withRevisionProject();

  try {
    const artifactPath = path.join(fixture.artifactRoot, '开发信草稿.md');
    await writeFile(
      artifactPath,
      [
        '# 开发信草稿',
        '',
        '## 英文开发信草稿',
        '',
        'Hi {{Customer Name}},',
        '',
        'Could you confirm your MOQ and lead time requirement?',
      ].join('\n'),
      'utf8',
    );

    const result = await reviseMarkdownArtifactForFollowup({
      projectRoot: fixture.projectRoot,
      instruction: '语气更礼貌一点，加一句可以寄样品',
      session: {
        context: {
          artifact: {
            type: 'markdown',
            name: '开发信草稿.md',
            outputPath: artifactPath,
          },
        },
      },
    });
    const updated = await readFile(artifactPath, 'utf8');

    assert.equal(result.ok, true);
    assert.equal(result.artifact.outputPath, artifactPath);
    assert.match(result.summary, /已按补充要求更新/);
    assert.match(updated, /本次补充优化/);
    assert.match(updated, /语气更礼貌一点，加一句可以寄样品/);
    assert.match(updated, /sample/i);
    assert.match(updated, /外发前仍需确认/);
  } finally {
    await fixture.cleanup();
  }
});

test('reviseMarkdownArtifactForFollowup continues from the original artifact after export', async () => {
  const fixture = await withRevisionProject();

  try {
    const artifactPath = path.join(fixture.artifactRoot, '开发信草稿.md');
    const exportDir = path.join(fixture.projectRoot, 'workbench', 'exports', 'agent-session-20260701-exported');
    const exportPath = path.join(exportDir, '开发信草稿.md');
    await mkdir(exportDir, { recursive: true });
    await writeFile(artifactPath, '# 开发信草稿\n\nCould you confirm MOQ?\n', 'utf8');
    await writeFile(exportPath, '# 开发信草稿\n\nCould you confirm MOQ?\n', 'utf8');

    const result = await reviseMarkdownArtifactForFollowup({
      projectRoot: fixture.projectRoot,
      instruction: '语气更礼貌一点',
      session: {
        context: {
          artifact: {
            type: 'markdown',
            name: '开发信草稿.md',
            outputPath: exportPath,
            exportedFrom: artifactPath,
          },
        },
      },
    });
    const updatedOriginal = await readFile(artifactPath, 'utf8');
    const exportedCopy = await readFile(exportPath, 'utf8');

    assert.equal(result.ok, true);
    assert.equal(result.artifact.outputPath, artifactPath);
    assert.match(updatedOriginal, /本次补充优化/);
    assert.match(updatedOriginal, /语气更礼貌一点/);
    assert.doesNotMatch(exportedCopy, /本次补充优化/);
  } finally {
    await fixture.cleanup();
  }
});

test('reviseMarkdownArtifactForFollowup drafts day-specific WhatsApp and email follow-up scripts', async () => {
  const fixture = await withRevisionProject();

  try {
    const artifactPath = path.join(fixture.artifactRoot, '客户推进分析.md');
    await writeFile(
      artifactPath,
      [
        '# 客户推进分析',
        '',
        '## 依据',
        '',
        '- 产品: 家具',
        '- 客户关注点: 客户沉默/未回复',
        '',
        '## 7天跟进节奏',
        '',
        '- 第1天: 发一条轻量提醒,围绕家具补充一个有用信息点。',
        '- 第3天: 换一个触达理由,补充 1 个客户可能关心的规格、交期、案例或样品选项。',
      ].join('\n'),
      'utf8',
    );

    const result = await reviseMarkdownArtifactForFollowup({
      projectRoot: fixture.projectRoot,
      instruction: '把第1天/第3天话术写成英文 WhatsApp 和邮件两版',
      session: {
        context: {
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: artifactPath,
          },
        },
      },
    });
    const updated = await readFile(artifactPath, 'utf8');

    assert.equal(result.ok, true);
    assert.match(updated, /本次补充优化/);
    assert.match(updated, /第1天 WhatsApp|Day 1 WhatsApp/i);
    assert.match(updated, /第1天 Email|Day 1 Email/i);
    assert.match(updated, /第3天 WhatsApp|Day 3 WhatsApp/i);
    assert.match(updated, /第3天 Email|Day 3 Email/i);
    assert.match(updated, /Subject:/);
    assert.match(updated, /furniture/i);
    assert.match(updated, /外发前仍需确认/);
  } finally {
    await fixture.cleanup();
  }
});

test('reviseMarkdownArtifactForFollowup supports day five follow-up scripts', async () => {
  const fixture = await withRevisionProject();

  try {
    const artifactPath = path.join(fixture.artifactRoot, '客户推进分析.md');
    await writeFile(
      artifactPath,
      [
        '# 客户推进分析',
        '',
        '## 依据',
        '',
        '- 产品: 家具',
        '- 客户关注点: 客户沉默/未回复',
        '',
        '## 7天跟进节奏',
        '',
        '- 第5天: 给出两个清晰选项,例如继续看资料、确认数量、安排样品或暂缓跟进。',
      ].join('\n'),
      'utf8',
    );

    const result = await reviseMarkdownArtifactForFollowup({
      projectRoot: fixture.projectRoot,
      instruction: '把第5天话术写成英文 WhatsApp 和邮件两版',
      session: {
        context: {
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: artifactPath,
          },
        },
      },
    });
    const updated = await readFile(artifactPath, 'utf8');

    assert.equal(result.ok, true);
    assert.match(updated, /Day 5 WhatsApp/i);
    assert.match(updated, /Day 5 Email/i);
    assert.match(updated, /Subject:/);
    assert.match(updated, /furniture/i);
  } finally {
    await fixture.cleanup();
  }
});

test('reviseMarkdownArtifactForFollowup drafts a standalone WhatsApp follow-up message', async () => {
  const fixture = await withRevisionProject();

  try {
    const artifactPath = path.join(fixture.artifactRoot, '客户推进分析.md');
    await writeFile(
      artifactPath,
      [
        '# 客户推进分析',
        '',
        '## 依据',
        '',
        '- 产品: 家具',
        '- 客户关注点: 客户沉默/未回复',
        '',
        '## 7天跟进节奏',
        '',
        '- 第1天: 发一条轻量提醒,围绕家具补充一个有用信息点。',
      ].join('\n'),
      'utf8',
    );

    const result = await reviseMarkdownArtifactForFollowup({
      projectRoot: fixture.projectRoot,
      instruction: '写一条 WhatsApp 跟进消息，语气自然一点',
      session: {
        context: {
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: artifactPath,
          },
        },
      },
    });
    const updated = await readFile(artifactPath, 'utf8');

    assert.equal(result.ok, true);
    assert.match(updated, /WhatsApp Follow-up Message/i);
    assert.match(updated, /Hi \{\{Customer Name\}\}/);
    assert.match(updated, /furniture/i);
    assert.match(updated, /外发前仍需确认/);
  } finally {
    await fixture.cleanup();
  }
});

test('reviseMarkdownArtifactForFollowup does not infer WhatsApp from Taiwan in email requests', async () => {
  const fixture = await withRevisionProject();

  try {
    const artifactPath = path.join(fixture.artifactRoot, '客户推进分析.md');
    await writeFile(
      artifactPath,
      [
        '# 客户推进分析',
        '',
        '## 依据',
        '',
        '- 产品: 家具',
        '- 客户关注点: Taiwan 客户沉默/未回复',
      ].join('\n'),
      'utf8',
    );

    const result = await reviseMarkdownArtifactForFollowup({
      projectRoot: fixture.projectRoot,
      instruction: '写一条 Email 内容给 Taiwan 客户',
      session: {
        context: {
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: artifactPath,
          },
        },
      },
    });
    const updated = await readFile(artifactPath, 'utf8');

    assert.equal(result.ok, true);
    assert.doesNotMatch(updated, /WhatsApp Follow-up Message/i);
    assert.match(updated, /Email Follow-up Message/i);
    assert.match(updated, /Taiwan/i);
  } finally {
    await fixture.cleanup();
  }
});

test('reviseMarkdownArtifactForFollowup rejects artifacts outside generated artifact roots', async () => {
  const fixture = await withRevisionProject();

  try {
    const outsidePath = path.join(fixture.projectRoot, 'private.md');
    await writeFile(outsidePath, '# private', 'utf8');

    await assert.rejects(
      () => reviseMarkdownArtifactForFollowup({
        projectRoot: fixture.projectRoot,
        instruction: '继续优化',
        session: {
          context: {
            artifact: {
              type: 'markdown',
              name: 'private.md',
              outputPath: outsidePath,
            },
          },
        },
      }),
      (error) => error.code === 'ARTIFACT_REVISION_PATH_FORBIDDEN' && error.status === 403,
    );
  } finally {
    await fixture.cleanup();
  }
});

test('reviseXlsxArtifactForFollowup creates a validated revised workbook with a follow-up sheet', async () => {
  const fixture = await withRevisionProject();

  try {
    const artifactPath = path.join(fixture.artifactRoot, '询盘分析会.xlsx');
    await createWorkbookFixture(artifactPath);

    const result = await reviseXlsxArtifactForFollowup({
      projectRoot: fixture.projectRoot,
      instruction: '按负责人补一列下周动作',
      session: {
        context: {
          artifact: {
            type: 'xlsx',
            name: '询盘分析会.xlsx',
            outputPath: artifactPath,
          },
        },
      },
    });
    const original = await inspectWorkbookFixture(artifactPath);
    const revised = await inspectWorkbookFixture(result.artifact.outputPath);

    assert.equal(result.ok, true);
    assert.notEqual(result.artifact.outputPath, artifactPath);
    assert.equal(result.artifact.type, 'xlsx');
    assert.match(result.artifact.name, /已续改/);
    assert.equal(result.artifact.validation.ok, true);
    assert.equal(original.sheets.includes('本次追问'), false);
    assert.equal(revised.sheets.includes('本次会议总览'), true);
    assert.equal(revised.sheets.includes('本次追问'), true);
    assert.equal(revised.followupValues.some((value) => String(value).includes('按负责人补一列下周动作')), true);
    assert.equal(revised.followupValues.some((value) => String(value).includes('外发前仍需确认')), true);
  } finally {
    await fixture.cleanup();
  }
});

test('reviseXlsxArtifactForFollowup continues from the original workbook after export', async () => {
  const fixture = await withRevisionProject();

  try {
    const artifactPath = path.join(fixture.artifactRoot, '报价单.xlsx');
    const exportDir = path.join(fixture.projectRoot, 'workbench', 'exports', 'agent-session-20260701-exported-xlsx');
    const exportPath = path.join(exportDir, '报价单.xlsx');
    await mkdir(exportDir, { recursive: true });
    await createWorkbookFixture(artifactPath);
    await createWorkbookFixture(exportPath);

    const result = await reviseXlsxArtifactForFollowup({
      projectRoot: fixture.projectRoot,
      instruction: '加一列有效期30天',
      session: {
        context: {
          artifact: {
            type: 'xlsx',
            name: '报价单.xlsx',
            outputPath: exportPath,
            exportedFrom: artifactPath,
          },
        },
      },
    });
    const revised = await inspectWorkbookFixture(result.artifact.outputPath);

    assert.equal(result.ok, true);
    assert.match(result.artifact.outputPath, /workbench\/artifacts\/run-1/);
    assert.equal(result.artifact.previousOutputPath, artifactPath);
    assert.match(result.artifact.name, /^报价单-已续改-/);
    assert.equal(revised.sheets.includes('本次追问'), true);
    assert.equal(revised.followupValues.some((value) => String(value).includes('加一列有效期30天')), true);
  } finally {
    await fixture.cleanup();
  }
});

async function createWorkbookFixture(outputPath) {
  await runPythonFixture(`
from openpyxl import Workbook
from pathlib import Path

output_path = Path(${JSON.stringify(outputPath)})
output_path.parent.mkdir(parents=True, exist_ok=True)
workbook = Workbook()
sheet = workbook.active
sheet.title = "本次会议总览"
sheet.append(["客户", "负责人", "下一步"])
sheet.append(["Global Sourcing", "Ada", "确认 MOQ"])
second = workbook.create_sheet("本周询盘概览")
second.append(["国家", "询盘数"])
second.append(["德国", 3])
workbook.save(output_path)
`);
}

async function inspectWorkbookFixture(inputPath) {
  const output = await runPythonFixture(`
import json
from openpyxl import load_workbook

workbook = load_workbook(${JSON.stringify(inputPath)}, data_only=True)
values = []
if "本次追问" in workbook.sheetnames:
    sheet = workbook["本次追问"]
    for row in sheet.iter_rows(values_only=True):
        values.extend([cell for cell in row if cell is not None])
print(json.dumps({"sheets": workbook.sheetnames, "followupValues": values}, ensure_ascii=False))
`);
  return JSON.parse(output);
}

function runPythonFixture(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(CODEX_BUNDLED_PYTHON, ['-c', script], { stdio: ['ignore', 'pipe', 'pipe'] });
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
      reject(new Error(stderr || stdout || `python fixture failed with ${exitCode}`));
    });
  });
}
