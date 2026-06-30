import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { exportAgentArtifact } from './agent-artifact-export.mjs';

async function withExportProject() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-artifact-export-'));
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

test('exportAgentArtifact copies the current session artifact into workbench exports', async () => {
  const fixture = await withExportProject();

  try {
    const sourcePath = path.join(fixture.artifactRoot, '开发信草稿.md');
    await writeFile(sourcePath, '# 开发信草稿\n\nHi customer.\n', 'utf8');

    const result = await exportAgentArtifact({
      projectRoot: fixture.projectRoot,
      sessionId: 'agent-session-20260629T150000-export',
      session: {
        context: {
          artifact: {
            type: 'markdown',
            name: '开发信草稿.md',
            outputPath: sourcePath,
          },
        },
      },
    });
    const exportedContent = await readFile(result.artifact.outputPath, 'utf8');

    assert.equal(result.ok, true);
    assert.equal(result.artifact.name, '开发信草稿.md');
    assert.match(result.artifact.outputPath, /workbench\/exports\/agent-session-20260629T150000-export/);
    assert.equal(exportedContent, '# 开发信草稿\n\nHi customer.\n');
  } finally {
    await fixture.cleanup();
  }
});

test('exportAgentArtifact rejects source paths outside generated artifact roots', async () => {
  const fixture = await withExportProject();

  try {
    const outsidePath = path.join(fixture.projectRoot, 'private.md');
    await writeFile(outsidePath, 'not an agent artifact', 'utf8');

    await assert.rejects(
      () => exportAgentArtifact({
        projectRoot: fixture.projectRoot,
        sessionId: 'agent-session-20260629T150500-export',
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
      (error) => error.code === 'EXPORT_PATH_FORBIDDEN' && error.status === 403,
    );
  } finally {
    await fixture.cleanup();
  }
});
