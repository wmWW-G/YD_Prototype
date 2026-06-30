import { appendFile, mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const MAX_ARTIFACT_SUMMARY_CHARS = 2600;

/**
 * saveAgentArtifactToCustomerMemory 把当前 Agent session 的产物摘要保存到客户记忆。
 *
 * 作用：
 * - 用户确认“保存到客户档案”后,把当前线程产物摘要写入客户 `memory.md`。
 * - 同时追加一条 `diary/agent-saves.jsonl`,方便后续恢复任务历史。
 * - 只读取当前 session 绑定的产物,并限制源文件必须来自 `workbench/artifacts/` 或 `workbench/exports/`。
 *
 * 参数：
 * - input.projectRoot：项目根目录。
 * - input.session：agent-session-store 读取的 session 对象。
 * - input.sessionId：当前任务线程 ID。
 * - input.customerSlug：客户目录 slug,默认 `global-sourcing-inc`。
 *
 * 返回值：Promise<object>,包含保存目标和写入摘要。
 * 可能抛出的异常：没有产物、路径越界、客户 slug 不合法或文件写入失败时抛出带 code/status 的错误。
 */
export async function saveAgentArtifactToCustomerMemory(input = {}) {
  const projectRoot = input.projectRoot || process.cwd();
  const session = input.session || {};
  const sessionId = normalizeSessionId(input.sessionId || session.sessionId);
  const customerSlug = normalizeCustomerSlug(input.customerSlug || session.customerSlug || session.context?.customerSlug || 'global-sourcing-inc');
  const artifact = findLatestArtifact(session);

  if (!sessionId) {
    throw createCustomerMemoryError('AGENT_SESSION_INVALID', '这次任务线程不可保存,可以重新交代任务。', 400);
  }
  if (!customerSlug) {
    throw createCustomerMemoryError('CUSTOMER_SLUG_INVALID', '客户标识不合法,不能写入客户档案。', 400);
  }
  if (!artifact?.outputPath) {
    throw createCustomerMemoryError('ARTIFACT_NOT_FOUND', '这次任务还没有可保存的产物。', 404);
  }

  const sourcePath = resolveSafeFilePath({ outputPath: artifact.outputPath, projectRoot });
  const artifactSummary = await summarizeArtifact({ artifact, sourcePath });
  const now = new Date().toISOString();
  const customerRoot = path.join(projectRoot, 'workbench', 'customers', customerSlug);
  const memoryPath = path.join(customerRoot, 'memory.md');
  const diaryRoot = path.join(customerRoot, 'diary');
  const diaryPath = path.join(diaryRoot, 'agent-saves.jsonl');
  const entry = buildMemoryEntry({
    artifact,
    artifactSummary,
    now,
    sessionId,
  });

  await mkdir(diaryRoot, { recursive: true });
  await appendFile(memoryPath, `\n${entry}\n`, 'utf8');
  await appendFile(
    diaryPath,
    `${JSON.stringify({
      at: now,
      artifactName: artifact.name || path.basename(sourcePath),
      artifactPath: sourcePath,
      customerSlug,
      sessionId,
      summary: artifactSummary.title,
      type: 'agent_artifact_saved',
    })}\n`,
    'utf8',
  );

  return {
    ok: true,
    customerSlug,
    diaryPath,
    memoryPath,
    message: `已保存到客户档案: ${customerSlug}`,
    savedSummary: artifactSummary.title,
  };
}

function findLatestArtifact(session = {}) {
  return session.context?.artifact || session.artifact || session.skillAgentResult?.artifact || null;
}

async function summarizeArtifact(input = {}) {
  const artifact = input.artifact || {};
  const sourcePath = input.sourcePath || '';
  const fileStat = await stat(sourcePath);
  const ext = path.extname(sourcePath).toLowerCase();
  const name = artifact.name || path.basename(sourcePath);

  if (artifact.type === 'markdown' || ext === '.md' || ext === '.txt') {
    const raw = await readFile(sourcePath, 'utf8');
    const lines = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith('> 生成时间:'));
    const title = cleanMarkdownText(lines.find((line) => /^#\s+/.test(line)) || name);
    const importantLines = lines
      .filter((line) => !/^#\s+/.test(line))
      .slice(0, 10)
      .map(cleanMarkdownText)
      .join('\n');
    return {
      body: importantLines.slice(0, MAX_ARTIFACT_SUMMARY_CHARS),
      sizeBytes: fileStat.size,
      title,
    };
  }

  return {
    body: `文件 ${name} 已生成,大小 ${fileStat.size} bytes。`,
    sizeBytes: fileStat.size,
    title: name,
  };
}

function buildMemoryEntry(input = {}) {
  const artifact = input.artifact || {};
  const summary = input.artifactSummary || {};
  const lines = [
    `## Agent 保存: ${summary.title || artifact.name || '任务产物'} (${input.now})`,
    '',
    `- 来源线程: ${input.sessionId}`,
    `- 产物: ${artifact.name || '未命名产物'}`,
    '- 保存类型: 用户确认后写入',
  ];

  if (summary.body) {
    lines.push('', '### 摘要', '', summary.body);
  }

  return lines.join('\n');
}

function resolveSafeFilePath(input = {}) {
  const projectRoot = input.projectRoot || process.cwd();
  const filePath = path.isAbsolute(input.outputPath || '')
    ? path.resolve(input.outputPath)
    : path.resolve(projectRoot, input.outputPath || '');
  const allowedRoots = [
    path.resolve(projectRoot, 'workbench', 'artifacts'),
    path.resolve(projectRoot, 'workbench', 'exports'),
  ];
  const isAllowed = allowedRoots.some((root) => filePath === root || filePath.startsWith(`${root}${path.sep}`));

  if (!isAllowed) {
    throw createCustomerMemoryError('CUSTOMER_MEMORY_PATH_FORBIDDEN', '为了安全,只能保存当前任务生成的产物摘要。', 403);
  }

  return filePath;
}

function cleanMarkdownText(value = '') {
  return String(value || '')
    .replace(/^#+\s*/, '')
    .replace(/^-\s*/, '')
    .replace(/^>\s*/, '')
    .trim();
}

function normalizeSessionId(sessionId) {
  const value = String(sessionId || '').trim();
  if (!/^agent-session-[A-Za-z0-9T_-]+$/.test(value)) {
    return '';
  }
  return value;
}

function normalizeCustomerSlug(customerSlug) {
  const value = String(customerSlug || '').trim();
  if (!/^[a-z0-9][a-z0-9_-]{0,80}$/i.test(value)) {
    return '';
  }
  return value;
}

function createCustomerMemoryError(code, message, status) {
  return Object.assign(new Error(message), { code, status });
}
