import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { readAgentArtifactPreview } from './agent-artifact-preview.mjs';

const CODEX_BUNDLED_PYTHON =
  '/Users/garden/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';

async function withPreviewProject() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-artifact-preview-'));
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

test('readAgentArtifactPreview returns markdown artifact content from the session', async () => {
  const fixture = await withPreviewProject();

  try {
    const artifactPath = path.join(fixture.artifactRoot, '开发信草稿.md');
    await writeFile(artifactPath, '# 开发信草稿\n\n## 英文开发信草稿\n\nHi customer.\n', 'utf8');

    const preview = await readAgentArtifactPreview({
      projectRoot: fixture.projectRoot,
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

    assert.equal(preview.ok, true);
    assert.equal(preview.name, '开发信草稿.md');
    assert.equal(preview.type, 'markdown');
    assert.equal(preview.outputPath, undefined);
    assert.match(preview.content, /英文开发信草稿/);
    assert.equal(preview.truncated, false);
  } finally {
    await fixture.cleanup();
  }
});

test('readAgentArtifactPreview returns safe evidence quality for markdown business artifacts', async () => {
  const fixture = await withPreviewProject();

  try {
    const artifactPath = path.join(fixture.artifactRoot, '询盘回复草稿.md');
    await writeFile(
      artifactPath,
      '# 询盘回复草稿\n\n## 依据\n\n- 任务来源: 客户问 MOQ 和交期。\n',
      'utf8',
    );

    const preview = await readAgentArtifactPreview({
      projectRoot: fixture.projectRoot,
      session: {
        context: {
          artifact: {
            type: 'markdown',
            name: '询盘回复草稿.md',
            outputPath: artifactPath,
            validation: {
              ok: true,
              evidence: {
                coverage: 'complete',
                checkedFacts: ['产品:太阳能路灯', '客户/市场:德国', '关注点:MOQ/起订量', 'local path:/tmp/secret'],
                missingFacts: [],
              },
            },
          },
        },
      },
    });

    assert.equal(preview.quality.status, 'passed');
    assert.equal(preview.quality.label, '依据检查');
    assert.equal(preview.quality.coverage, 'complete');
    assert.deepEqual(preview.quality.checkedFacts, [
      { kind: 'product', label: '太阳能路灯' },
      { kind: 'market', label: '德国' },
      { kind: 'concern', label: 'MOQ/起订量' },
    ]);
    assert.deepEqual(preview.quality.missingFacts, []);
    assert.equal(JSON.stringify(preview.quality).includes('/tmp/secret'), false);
    assert.equal(preview.quality.validation, undefined);
  } finally {
    await fixture.cleanup();
  }
});

test('readAgentArtifactPreview downgrades quality when evidence only contains internal-looking facts', async () => {
  const fixture = await withPreviewProject();

  try {
    const artifactPath = path.join(fixture.artifactRoot, '客户推进分析.md');
    await writeFile(artifactPath, '# 客户推进分析\n\n## 依据\n\n- 任务来源: 测试。\n', 'utf8');

    const preview = await readAgentArtifactPreview({
      projectRoot: fixture.projectRoot,
      session: {
        context: {
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: artifactPath,
            validation: {
              ok: true,
              evidence: {
                coverage: 'complete',
                checkedFacts: [
                  'run_id:skill-runtime-1',
                  'tool_call:query_customer',
                  'output_path:workbench/artifacts/run-1/file.md',
                  'toolCall:query_customer',
                  'workbench/artifacts/run-1/file.md',
                ],
                missingFacts: [],
              },
            },
          },
        },
      },
    });

    assert.equal(preview.quality.status, 'needs-review');
    assert.equal(preview.quality.coverage, 'unknown');
    assert.deepEqual(preview.quality.checkedFacts, []);
    assert.deepEqual(preview.quality.missingFacts, []);
    assert.match(preview.quality.summary, /需要复核/);
    assert.equal(/run_id|tool_call|output_path|toolCall|workbench\/artifacts/u.test(JSON.stringify(preview.quality)), false);
  } finally {
    await fixture.cleanup();
  }
});

test('readAgentArtifactPreview exposes typed purchasing evidence facts', async () => {
  const fixture = await withPreviewProject();

  try {
    const artifactPath = path.join(fixture.artifactRoot, '客户推进分析.md');
    await writeFile(artifactPath, '# 客户推进分析\n\n## 依据\n\n- 任务来源: 测试。\n', 'utf8');

    const preview = await readAgentArtifactPreview({
      projectRoot: fixture.projectRoot,
      session: {
        context: {
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: artifactPath,
            validation: {
              ok: true,
              evidence: {
                coverage: 'complete',
                checkedFacts: [
                  '产品:太阳能路灯',
                  '数量:500套',
                  '价格:20美元',
                  '贸易条款:FOB深圳',
                  '付款条件:60天账期',
                  '样品:下周样品计划',
                  '下一步动作:7天跟进计划',
                ],
                missingFacts: [],
              },
            },
          },
        },
      },
    });

    assert.equal(preview.quality.status, 'passed');
    assert.deepEqual(preview.quality.checkedFacts, [
      { kind: 'product', label: '太阳能路灯' },
      { kind: 'quantity', label: '500套' },
      { kind: 'price', label: '20美元' },
      { kind: 'trade_term', label: 'FOB深圳' },
      { kind: 'payment', label: '60天账期' },
      { kind: 'sample', label: '下周样品计划' },
      { kind: 'next_action', label: '7天跟进计划' },
    ]);
  } finally {
    await fixture.cleanup();
  }
});

test('readAgentArtifactPreview keeps sample and next-action facts when purchasing evidence is dense', async () => {
  const fixture = await withPreviewProject();

  try {
    const artifactPath = path.join(fixture.artifactRoot, '客户推进分析.md');
    await writeFile(artifactPath, '# 客户推进分析\n\n## 依据\n\n- 任务来源: 测试。\n', 'utf8');

    const preview = await readAgentArtifactPreview({
      projectRoot: fixture.projectRoot,
      session: {
        context: {
          artifact: {
            type: 'markdown',
            name: '客户推进分析.md',
            outputPath: artifactPath,
            validation: {
              ok: true,
              evidence: {
                coverage: 'complete',
                checkedFacts: [
                  '产品:太阳能路灯',
                  '客户/市场:德国',
                  '关注点:付款/账期压力',
                  '关注点:样品',
                  '数量:500套',
                  '价格:20美元',
                  '贸易条款:FOB深圳',
                  '付款条件:60天账期',
                  '样品:下周样品计划',
                  '下一步动作:7天跟进计划',
                ],
                missingFacts: [],
              },
            },
          },
        },
      },
    });

    assert.ok(preview.quality.checkedFacts.some((fact) => fact.kind === 'sample' && fact.label === '下周样品计划'));
    assert.ok(preview.quality.checkedFacts.some((fact) => fact.kind === 'next_action' && fact.label === '7天跟进计划'));
  } finally {
    await fixture.cleanup();
  }
});

test('readAgentArtifactPreview rejects paths outside workbench artifacts', async () => {
  const fixture = await withPreviewProject();

  try {
    const outsidePath = path.join(fixture.projectRoot, 'CONTEXT.md');
    await writeFile(outsidePath, 'secret-ish local context', 'utf8');

    await assert.rejects(
      () => readAgentArtifactPreview({
        projectRoot: fixture.projectRoot,
        session: {
          context: {
            artifact: {
              type: 'markdown',
              name: 'CONTEXT.md',
              outputPath: outsidePath,
            },
          },
        },
      }),
      (error) => error.code === 'PREVIEW_PATH_FORBIDDEN' && error.status === 403,
    );
  } finally {
    await fixture.cleanup();
  }
});

test('readAgentArtifactPreview returns a readable summary for xlsx artifacts', async () => {
  const fixture = await withPreviewProject();

  try {
    const artifactPath = path.join(fixture.artifactRoot, '询盘分析会.xlsx');
    await createWorkbookFixture(artifactPath);

    const preview = await readAgentArtifactPreview({
      projectRoot: fixture.projectRoot,
      session: {
        artifact: {
          type: 'xlsx',
          name: '询盘分析会.xlsx',
          outputPath: artifactPath,
        },
      },
    });

    assert.equal(preview.ok, true);
    assert.equal(preview.type, 'xlsx');
    assert.equal(preview.content, '');
    assert.equal(preview.outputPath, undefined);
    assert.match(preview.previewNote, /表格文件已生成/);
    assert.equal(preview.workbook.sheetCount, 2);
    assert.deepEqual(
      preview.workbook.sheets.map((sheet) => ({
        columnCount: sheet.columnCount,
        name: sheet.name,
        rowCount: sheet.rowCount,
      })),
      [
        { columnCount: 3, name: '本次会议总览', rowCount: 2 },
        { columnCount: 2, name: '本周询盘概览', rowCount: 2 },
      ],
    );
    assert.match(preview.previewNote, /本次会议总览/);
    assert.match(preview.previewNote, /本周询盘概览/);
    assert.equal(preview.sizeBytes > 0, true);
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
