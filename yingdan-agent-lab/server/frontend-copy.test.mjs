import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const appSourcePath = path.join(process.cwd(), 'agent-thread-prototype', 'src', 'App.jsx');
const appStylesPath = path.join(process.cwd(), 'agent-thread-prototype', 'src', 'styles.css');
const referenceMaterialsPath = path.join(process.cwd(), 'agent-thread-prototype', 'src', 'agentReferenceMaterials.js');

async function readNewConversationSource() {
  const source = await readFile(appSourcePath, 'utf8');
  const start = source.indexOf('function NewConversationView');
  const end = source.indexOf('function AgentThreadMessage');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

async function readFunctionSource(functionName) {
  const source = await readFile(appSourcePath, 'utf8');
  const start = source.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1);
  const nextIndentedComment = source.indexOf('\n  /**', start + 1);
  const nextTopLevelComment = source.indexOf('\n/**', start + 1);
  const candidates = [nextIndentedComment, nextTopLevelComment].filter((index) => index !== -1);
  const nextComment = Math.min(...candidates);
  assert.notEqual(nextComment, -1);
  return source.slice(start, nextComment);
}

async function readFunctionBlockSource(functionName, startNeedle, endNeedle) {
  const source = await readFunctionSource(functionName);
  const start = source.indexOf(startNeedle);
  assert.notEqual(start, -1);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('New Conversation empty state avoids explaining flow configuration to users', async () => {
  const source = await readNewConversationSource();

  assert.equal(source.includes('不用选流程'), false);
  assert.equal(source.includes('不用填配置'), false);
  assert.equal(source.includes('配置流程'), false);
});

test('New Conversation starts with an empty composer instead of a demo task', async () => {
  const source = await readFunctionSource('App');

  assert.equal(source.includes("useState(restoredAgentThread.draft || '帮我开上周询盘分析会')"), false);
  assert.equal(source.includes("useState(restoredAgentThread.draft || '')"), true);
});

test('New Conversation network failures stay in business language', async () => {
  const source = await readFunctionSource('handleRunNewConversationAgent');

  assert.equal(source.includes('本地后端'), false);
  assert.equal(source.includes('请求失败'), false);
  assert.equal(source.includes('error.message'), false);
});

test('New Conversation stream error events stay in business language', async () => {
  const source = await readFunctionSource('handleRunNewConversationAgent');

  assert.equal(source.includes('streamError.message'), false);
  assert.equal(source.includes('streamError.error'), false);
  assert.equal(source.includes('Agent 执行失败'), false);
});

test('New Conversation stream errors leave the thread ready for a supplement', async () => {
  const source = await readFunctionBlockSource('handleRunNewConversationAgent', 'if (streamError) {', 'if (!finalPayload) {');

  assert.equal(source.includes("setSkillAgentStatus('waiting')"), true);
  assert.equal(source.includes("setSkillAgentStatus('error')"), false);
  assert.equal(source.includes("setSkillAgentError('')"), true);
  assert.equal(source.includes('setSkillAgentError(message)'), false);
  assert.equal(source.includes("tone: 'error'"), false);
});

test('New Conversation network failures leave the thread ready for a supplement', async () => {
  const source = await readFunctionBlockSource('handleRunNewConversationAgent', '} catch (error) {', '} finally {');

  assert.equal(source.includes("setSkillAgentStatus('waiting')"), true);
  assert.equal(source.includes("setSkillAgentStatus('error')"), false);
  assert.equal(source.includes("setSkillAgentError('')"), true);
  assert.equal(source.includes('setSkillAgentError(message)'), false);
  assert.equal(source.includes("tone: 'error'"), false);
});

test('New Conversation recoverable failures keep the original task for the next supplement', async () => {
  const source = await readFunctionSource('handleRunNewConversationAgent');
  const streamBlock = await readFunctionBlockSource('handleRunNewConversationAgent', 'if (streamError) {', 'if (!finalPayload) {');
  const catchBlock = await readFunctionBlockSource('handleRunNewConversationAgent', '} catch (error) {', '} finally {');

  assert.equal(source.includes('buildRecoverablePendingTaskContext(currentDraft)'), true);
  assert.equal(source.includes('ensureRecoverableAgentSessionId()'), true);
  assert.equal(streamBlock.includes('setAgentTaskContext((currentContext)'), true);
  assert.equal(catchBlock.includes('setAgentTaskContext((currentContext)'), true);
  assert.equal(streamBlock.includes('pendingTask'), true);
  assert.equal(catchBlock.includes('pendingTask'), true);
});

test('New Conversation artifact preview failures stay in business language', async () => {
  const source = await readFunctionSource('handlePreviewAgentArtifact');

  assert.equal(source.includes('payload.error'), false);
  assert.equal(source.includes('error.message'), false);
  assert.equal(source.includes('文件预览失败：'), false);
});

test('New Conversation xlsx previews render workbook sheets as structured artifact content', async () => {
  const source = await readFile(appSourcePath, 'utf8');

  assert.equal(source.includes('function WorkbookArtifactPreview'), true);
  assert.equal(source.includes('WorkbookArtifactPreview'), true);
  assert.equal(source.includes('artifact.workbook'), true);
  assert.equal(source.includes('工作表摘要'), true);
  assert.equal(source.includes('行'), true);
  assert.equal(source.includes('列'), true);
});

test('New Conversation missing business inputs render as a checklist in the thread', async () => {
  const source = await readFile(appSourcePath, 'utf8');

  assert.equal(source.includes('function MissingInputChecklist'), true);
  assert.equal(source.includes('message.needsInput'), true);
  assert.equal(source.includes('缺少资料'), true);
  assert.equal(source.includes('直接补一句话'), true);
  assert.equal(source.includes('missing-input-checklist'), true);
});

test('New Conversation only keeps the latest confirmation card actionable', async () => {
  const source = await readFile(appSourcePath, 'utf8');
  const threadSource = await readNewConversationSource();
  const messageSource = await readFunctionSource('AgentThreadMessage');

  assert.equal(source.includes('latestMessageId'), true);
  assert.equal(threadSource.includes('isConfirmationActionable'), true);
  assert.equal(messageSource.includes('isConfirmationActionable'), true);
  assert.equal(messageSource.includes('confirmation-card-resolved'), true);
  assert.equal(messageSource.includes('这一步已处理'), true);
});

test('New Conversation labels pending confirmation as waiting for confirmation, not missing input', async () => {
  const threadSource = await readNewConversationSource();

  assert.equal(threadSource.includes('getNewConversationComposerState({'), true);
  assert.equal(threadSource.includes('hasActionableConfirmation'), true);
  assert.equal(threadSource.includes('statusChipLabel'), true);
});

test('New Conversation composer keeps pending confirmation in a confirmation context', async () => {
  const source = await readFile(appSourcePath, 'utf8');
  const threadSource = await readNewConversationSource();

  assert.equal(threadSource.includes('composerPlaceholder'), true);
  assert.equal(threadSource.includes('composerContextLabel'), true);
  assert.equal(threadSource.includes('sendButtonLabel'), true);
  assert.equal(threadSource.includes('placeholder={composerPlaceholder}'), true);
  assert.equal(threadSource.includes('composer-context-chip'), true);
  assert.equal(threadSource.includes('title={composerContextLabel}'), true);
  assert.equal(threadSource.includes('{sendButtonLabel}'), true);
  assert.equal(threadSource.includes('aria-label={sendButtonLabel}'), true);
  assert.equal(source.includes('currentArtifact={skillAgentResult?.artifact || agentTaskContext?.artifact || null}'), true);
});

test('New Conversation follows the latest thread activity while the agent works', async () => {
  const threadSource = await readNewConversationSource();

  assert.equal(threadSource.includes('threadEndRef'), true);
  assert.equal(threadSource.includes('scrollIntoView'), true);
  assert.equal(threadSource.includes('messages.length'), true);
  assert.equal(threadSource.includes('streamingProgressItems.length'), true);
  assert.equal(threadSource.includes('thread-scroll-anchor'), true);
});

test('New Conversation uses shared progress merging for repeated labels', async () => {
  const source = await readFile(appSourcePath, 'utf8');

  assert.equal(source.includes("import { mergeStreamingProgressItem } from './agentThreadProgress.js';"), true);
  assert.equal(source.includes('setStreamingProgressItems((items) => mergeStreamingProgressItem(items, data))'), true);
});

test('New Conversation keeps paid-action confirmation guidance visible while progress is streaming', async () => {
  const threadSource = await readNewConversationSource();
  const runningStart = threadSource.indexOf('{isRunning ? (');
  const progressBranch = threadSource.indexOf('streamingProgressItems.length ? (', runningStart);
  const runningPreamble = threadSource.slice(runningStart, progressBranch);

  assert.notEqual(runningStart, -1);
  assert.notEqual(progressBranch, -1);
  assert.equal(runningPreamble.includes('agent-safety-note'), true);
  assert.equal(runningPreamble.includes('导出、保存、外发、扣费'), true);
});

test('New Conversation reference material button imports text into the current task draft', async () => {
  const source = await readFile(appSourcePath, 'utf8');
  const referenceSource = await readFile(referenceMaterialsPath, 'utf8');
  const threadSource = await readNewConversationSource();

  assert.equal(threadSource.includes('referenceInputRef'), true);
  assert.equal(threadSource.includes('handleReferenceMaterialClick'), true);
  assert.equal(threadSource.includes('handleReferenceFilesChange'), true);
  assert.equal(threadSource.includes('type="file"'), true);
  assert.equal(threadSource.includes('reference-import-status'), true);
  assert.equal(source.includes("from './agentReferenceMaterials.js'"), true);
  assert.equal(source.includes('readReferenceFileText'), true);
  assert.equal(source.includes('referenceFileErrorMessage'), true);
  assert.equal(referenceSource.includes('引用资料：'), true);
});

test('New Conversation keeps the recognized business task title in the thread header', async () => {
  const source = await readFile(appSourcePath, 'utf8');
  const appSource = await readFunctionSource('App');
  const threadSource = await readNewConversationSource();

  assert.equal(appSource.includes('agentThreadTaskTitle'), true);
  assert.equal(appSource.includes('taskTitle: agentThreadTaskTitle'), true);
  assert.equal(appSource.includes('setAgentThreadTaskTitle'), true);
  assert.equal(source.includes('taskTitle={agentThreadTaskTitle}'), true);
  assert.equal(threadSource.includes('taskTitle,'), true);
  assert.equal(threadSource.includes("<h1>{taskTitle || '外贸任务'}</h1>"), true);
});

test('New Conversation uses a first confirmation title as the task title without replacing an existing task', async () => {
  const appSource = await readFile(appSourcePath, 'utf8');
  const runSource = await readFunctionSource('handleRunNewConversationAgent');

  assert.equal(appSource.includes("import { deriveAgentThreadTaskTitle } from './agentThreadTitle.js';"), true);
  assert.equal(runSource.includes('deriveAgentThreadTaskTitle(payload, agentThreadTaskTitle)'), true);
});

test('New Conversation can start a fresh business task without carrying the old session', async () => {
  const source = await readFile(appSourcePath, 'utf8');
  const startTaskSource = await readFunctionSource('handleStartNewConversationTask');
  const threadSource = await readNewConversationSource();

  assert.equal(startTaskSource.includes('function handleStartNewConversationTask()'), true);
  assert.equal(startTaskSource.includes("setAgentSessionId('')"), true);
  assert.equal(startTaskSource.includes('setAgentTaskContext({})'), true);
  assert.equal(startTaskSource.includes('setAgentThreadMessages([])'), true);
  assert.equal(startTaskSource.includes("setAgentThreadTaskTitle('')"), true);
  assert.equal(startTaskSource.includes("setSkillAgentStatus('idle')"), true);
  assert.equal(startTaskSource.includes('setSkillAgentResult(null)'), true);
  assert.equal(source.includes('onStartNewTask={handleStartNewConversationTask}'), true);
  assert.equal(threadSource.includes('onStartNewTask,'), true);
  assert.equal(threadSource.includes('onClick={onStartNewTask}'), true);
  assert.equal(threadSource.includes('新任务'), true);
});

test('New Conversation can reopen recent agent threads from history', async () => {
  const source = await readFile(appSourcePath, 'utf8');
  const historySource = await readFunctionSource('handleRefreshAgentSessionHistory');
  const openSource = await readFunctionSource('handleOpenAgentSessionFromHistory');
  const threadSource = await readNewConversationSource();

  assert.equal(source.includes('agentSessionHistory'), true);
  assert.equal(source.includes('setAgentSessionHistory'), true);
  assert.equal(historySource.includes('/api/agent/sessions'), true);
  assert.equal(openSource.includes('/api/agent/session/'), true);
  assert.equal(openSource.includes('setAgentSessionId(session.sessionId'), true);
  assert.equal(openSource.includes('setAgentThreadMessages(session.messages'), true);
  assert.equal(openSource.includes('deriveAgentThreadTaskTitle(session)'), true);
  assert.equal(source.includes('onOpenHistorySession={handleOpenAgentSessionFromHistory}'), true);
  assert.equal(threadSource.includes('agentSessionHistory = []'), true);
  assert.equal(threadSource.includes('onOpenHistorySession,'), true);
  assert.equal(threadSource.includes('thread-history-panel'), true);
  assert.equal(threadSource.includes('最近任务'), true);
});

test('New Conversation toast does not block header actions after a task finishes', async () => {
  const styles = await readFile(appStylesPath, 'utf8');
  const toastStart = styles.indexOf('.toast {');
  const toastEnd = styles.indexOf('.toast button', toastStart);
  assert.notEqual(toastStart, -1);
  assert.notEqual(toastEnd, -1);
  const toastBlock = styles.slice(toastStart, toastEnd);

  assert.equal(toastBlock.includes('top: 76px'), true);
  assert.equal(toastBlock.includes('pointer-events: none'), true);
});
