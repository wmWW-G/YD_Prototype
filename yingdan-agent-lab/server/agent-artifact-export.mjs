import { copyFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

/**
 * exportAgentArtifact 把当前 Agent session 的最新产物导出到 workbench/exports。
 *
 * 作用：
 * - 高风险“导出文件”确认后,真的复制一个可交付文件,而不是只回复确认文案。
 * - 源文件必须来自当前 session 绑定的产物,并且位于 `workbench/artifacts/` 或 `workbench/exports/`。
 * - 导出目标固定在 `workbench/exports/<sessionId>/`,避免任意写本地路径。
 *
 * 参数：
 * - input.projectRoot：项目根目录。
 * - input.session：agent-session-store 读出的 session 对象。
 * - input.sessionId：当前任务线程 ID。
 *
 * 返回值：Promise<object>,包含导出的 artifact 摘要。
 * 可能抛出的异常：没有产物、路径越界或复制失败时抛出带 code/status 的错误。
 */
export async function exportAgentArtifact(input = {}) {
  const projectRoot = input.projectRoot || process.cwd();
  const session = input.session || {};
  const sessionId = normalizeSessionId(input.sessionId || session.sessionId);
  const artifact = findLatestArtifact(session);

  if (!sessionId) {
    throw createExportError('AGENT_SESSION_INVALID', '这次任务线程不可导出,可以重新交代任务。', 400);
  }
  if (!artifact?.outputPath) {
    throw createExportError('ARTIFACT_NOT_FOUND', '这次任务还没有可导出的产物。', 404);
  }

  const sourcePath = resolveSafeFilePath({
    outputPath: artifact.outputPath,
    projectRoot,
  });
  const sourceStat = await stat(sourcePath);
  const exportRoot = path.join(projectRoot, 'workbench', 'exports', sessionId);
  const exportName = safeFileName(artifact.name || path.basename(sourcePath));
  const exportPath = path.join(exportRoot, exportName);

  await mkdir(exportRoot, { recursive: true });
  await copyFile(sourcePath, exportPath);

  return {
    ok: true,
    artifact: {
      type: artifact.type || artifactTypeFromName(exportName),
      name: exportName,
      outputPath: exportPath,
      exportedFrom: sourcePath,
      sizeBytes: sourceStat.size,
    },
    exportPath,
    message: `已导出 ${exportName}。`,
  };
}

function findLatestArtifact(session = {}) {
  return session.context?.artifact || session.artifact || session.skillAgentResult?.artifact || null;
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
    throw createExportError('EXPORT_PATH_FORBIDDEN', '为了安全,只能导出当前任务生成的产物文件。', 403);
  }

  return filePath;
}

function normalizeSessionId(sessionId) {
  const value = String(sessionId || '').trim();
  if (!/^agent-session-[A-Za-z0-9T_-]+$/.test(value)) {
    return '';
  }
  return value;
}

function safeFileName(value = '') {
  const name = String(value || 'agent-artifact').replace(/[/:\\?%*"<>|]/g, '-').trim();
  return name || 'agent-artifact';
}

function artifactTypeFromName(name = '') {
  const ext = path.extname(name).toLowerCase();
  if (ext === '.md') {
    return 'markdown';
  }
  if (ext === '.xlsx') {
    return 'xlsx';
  }
  if (ext === '.txt') {
    return 'text';
  }
  return 'file';
}

function createExportError(code, message, status) {
  return Object.assign(new Error(message), { code, status });
}
