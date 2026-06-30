import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { saveAgentArtifactToCustomerMemory } from './agent-customer-memory.mjs';

async function withCustomerMemoryProject() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-customer-memory-'));
  const customerRoot = path.join(projectRoot, 'workbench', 'customers', 'global-sourcing-inc');
  const artifactRoot = path.join(projectRoot, 'workbench', 'artifacts', 'run-1');
  await mkdir(customerRoot, { recursive: true });
  await mkdir(artifactRoot, { recursive: true });
  await writeFile(path.join(customerRoot, 'memory.md'), '# Global Sourcing Inc. Memory\n\n- Existing memory.\n', 'utf8');
  return {
    artifactRoot,
    customerRoot,
    projectRoot,
    async cleanup() {
      await rm(projectRoot, { recursive: true, force: true });
    },
  };
}

test('saveAgentArtifactToCustomerMemory appends a confirmed artifact summary to customer memory and diary', async () => {
  const fixture = await withCustomerMemoryProject();

  try {
    const artifactPath = path.join(fixture.artifactRoot, '客户推进分析.md');
    await writeFile(
      artifactPath,
      [
        '# 客户推进分析',
        '',
        '## 客户推进判断',
        '',
        '客户已经在问MOQ/起订量、交期。',
        '',
        '## 下一步跟进行动',
        '',
        '1. 先确认用途、数量、交期和目标市场。',
      ].join('\n'),
      'utf8',
    );

    const result = await saveAgentArtifactToCustomerMemory({
      projectRoot: fixture.projectRoot,
      sessionId: 'agent-session-20260629T160000-save',
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
    const memory = await readFile(path.join(fixture.customerRoot, 'memory.md'), 'utf8');
    const diary = await readFile(path.join(fixture.customerRoot, 'diary', 'agent-saves.jsonl'), 'utf8');

    assert.equal(result.ok, true);
    assert.equal(result.customerSlug, 'global-sourcing-inc');
    assert.match(memory, /Agent 保存: 客户推进分析/);
    assert.match(memory, /客户已经在问MOQ\/起订量、交期/);
    assert.match(memory, /来源线程: agent-session-20260629T160000-save/);
    assert.match(diary, /agent_artifact_saved/);
  } finally {
    await fixture.cleanup();
  }
});

test('saveAgentArtifactToCustomerMemory rejects artifacts outside generated artifact roots', async () => {
  const fixture = await withCustomerMemoryProject();

  try {
    const outsidePath = path.join(fixture.projectRoot, 'private.md');
    await writeFile(outsidePath, 'do not save me', 'utf8');

    await assert.rejects(
      () => saveAgentArtifactToCustomerMemory({
        projectRoot: fixture.projectRoot,
        sessionId: 'agent-session-20260629T160500-save',
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
      (error) => error.code === 'CUSTOMER_MEMORY_PATH_FORBIDDEN' && error.status === 403,
    );
  } finally {
    await fixture.cleanup();
  }
});
