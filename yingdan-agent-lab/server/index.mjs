import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readAgentArtifactPreview } from './agent-artifact-preview.mjs';
import {
  createConsecutiveProgressDeduper,
  createInitialAgentStreamProgress,
  buildRecoverableAgentErrorResult,
  formatSseEvent,
  runtimeEventToStreamEvent,
  sanitizeAgentResultForFrontend,
  sanitizeAgentSessionForFrontend,
} from './agent-message-stream.mjs';
import { createAgentSessionStore } from './agent-session-store.mjs';
import { createRuntime, loadEnvFile } from './runtime.mjs';
import { runNewConversationAgent } from './skill-agent.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const envFromFile = await loadEnvFile(path.join(projectRoot, '.env'));
const runtime = createRuntime({
  env: { ...envFromFile, ...process.env },
  projectRoot,
});
const agentSessionStore = createAgentSessionStore({ projectRoot });

await runtime.ensureWorkbench();

const app = express();
const port = Number(process.env.PORT || envFromFile.PORT || 8787);

app.use(express.json({ limit: '1mb' }));
app.use((request, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  next();
});

/**
 * sendError 把后端异常整理成前端可读的 JSON。
 *
 * 参数：
 * - response：Express response 对象。
 * - error：捕获到的异常对象。
 *
 * 返回值：无，直接写 HTTP 响应。
 * 可能抛出的异常：不主动抛异常。
 */
function sendError(response, error) {
  const status = error.status || (error.code === 'MODEL_NOT_CONFIGURED' ? 400 : 500);
  response.status(status).json({
    ok: false,
    error: error.code || 'SERVER_ERROR',
    message: error.message,
  });
}

/**
 * executeAgentMessage 执行一次新对话消息并保存 session。
 *
 * 作用：
 * - 普通 JSON 接口和流式接口共用同一套读取 session、合并 context、执行 Agent、保存回合逻辑。
 * - 可选 `onRuntimeEvent` 会接收 Runtime 真实事件,供 SSE 进度流使用。
 *
 * 参数：
 * - body：Express request.body。
 * - onRuntimeEvent：可选 Runtime 事件回调。
 *
 * 返回值：Promise<object>,即 runNewConversationAgent 的结果。
 * 可能抛出的异常：底层 Runtime、文件读写或 session 保存失败时抛出。
 */
async function executeAgentMessage(body = {}, onRuntimeEvent = null) {
  const sessionId = body?.sessionId || '';
  const storedSession = sessionId ? await agentSessionStore.read(sessionId) : null;
  const requestContext = mergeAgentRequestContext({
    clientContext: body?.context || {},
    serverContext: storedSession?.context || {},
  });
  const result = await runNewConversationAgent({
    checkPolicy: (action) => runtime.checkPolicy(action),
    text: body?.message || '',
    sessionId,
    context: requestContext,
    session: storedSession,
    projectRoot,
    onRuntimeEvent,
  });

  if (result.ok !== false && result.sessionId) {
    await agentSessionStore.saveTurn({
      requestContext,
      response: result,
      sessionId: result.sessionId,
      userText: body?.message || '',
    });
  }

  return result;
}

/**
 * mergeAgentRequestContext 合并前端上下文和后端 session 上下文。
 *
 * 作用：
 * - 前端只拿到净化后的 artifact 摘要,不能覆盖后端保存的真实 outputPath。
 * - pendingConfirmation / pendingTask 这类暂停恢复状态必须以后端 session 为准。
 * - 没有后端 session 时,仍允许前端传入旧版本地 context 作为兜底。
 *
 * 参数：
 * - input.clientContext：前端请求体里的 context。
 * - input.serverContext：session store 里读出的 context。
 *
 * 返回值：用于本轮 runNewConversationAgent 的上下文。
 * 可能抛出的异常：无。
 */
function mergeAgentRequestContext(input = {}) {
  const clientContext = input.clientContext || {};
  const serverContext = input.serverContext || {};
  const hasServerContext = Object.keys(serverContext).length > 0;

  if (!hasServerContext) {
    return clientContext;
  }

  return {
    ...clientContext,
    ...serverContext,
    artifact: serverContext.artifact || clientContext.artifact,
    pendingConfirmation: serverContext.pendingConfirmation,
    pendingTask: serverContext.pendingTask || clientContext.pendingTask,
  };
}

function writeSse(response, eventName, data = {}) {
  response.write(formatSseEvent(eventName, data));
}

app.get('/api/health', (request, response) => {
  response.json({
    ok: true,
    service: 'yingdan-agent-lab',
    modelConfigured: Boolean(envFromFile.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY),
  });
});

app.post('/api/inquiry/analyze', async (request, response) => {
  try {
    const result = await runtime.analyzeInquiry({
      customerSlug: request.body?.customerSlug || 'global-sourcing-inc',
      inquiryText: request.body?.inquiryText || '',
      mode: request.body?.mode || 'fast',
    });

    const status = result.ok === false ? 400 : 200;
    response.status(status).json(result);
  } catch (error) {
    sendError(response, error);
  }
});

app.post('/api/agent/message', async (request, response) => {
  try {
    const result = await executeAgentMessage(request.body);
    if (result.ok === false) {
      const recoverableResult = buildRecoverableAgentErrorResult({
        error: result,
        sessionId: result.sessionId || request.body?.sessionId,
        userText: request.body?.message,
      });
      await agentSessionStore.saveTurn({
        requestContext: request.body?.context || {},
        response: recoverableResult,
        sessionId: recoverableResult.sessionId,
        userText: request.body?.message || '',
      });
      response.json(sanitizeAgentResultForFrontend(recoverableResult));
      return;
    }
    response.json(sanitizeAgentResultForFrontend(result));
  } catch (error) {
    const result = buildRecoverableAgentErrorResult({
      error,
      sessionId: request.body?.sessionId,
      userText: request.body?.message,
    });
    try {
      const storedSession = request.body?.sessionId ? await agentSessionStore.read(request.body.sessionId) : null;
      const requestContext = mergeAgentRequestContext({
        clientContext: request.body?.context || {},
        serverContext: storedSession?.context || {},
      });
      await agentSessionStore.saveTurn({
        requestContext,
        response: result,
        sessionId: result.sessionId,
        userText: request.body?.message || '',
      });
    } catch {
      // 保存失败不能让前台退回技术错误;用户仍能看到可继续的 waiting 消息。
    }
    response.json(sanitizeAgentResultForFrontend(result));
  }
});

app.post('/api/agent/message/stream', async (request, response) => {
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  response.flushHeaders?.();
  const dedupeProgressEvent = createConsecutiveProgressDeduper();

  writeSse(response, 'progress', createInitialAgentStreamProgress());

  try {
    const result = await executeAgentMessage(request.body, async (runtimeEvent) => {
      const streamEvent = dedupeProgressEvent(runtimeEventToStreamEvent(runtimeEvent));
      if (streamEvent) {
        writeSse(response, streamEvent.event, streamEvent.data);
      }
    });

    if (result.ok === false) {
      const recoverableResult = buildRecoverableAgentErrorResult({
        error: result,
        sessionId: result.sessionId || request.body?.sessionId,
        userText: request.body?.message,
      });
      await agentSessionStore.saveTurn({
        requestContext: request.body?.context || {},
        response: recoverableResult,
        sessionId: recoverableResult.sessionId,
        userText: request.body?.message || '',
      });
      writeSse(response, 'result', sanitizeAgentResultForFrontend(recoverableResult));
      return;
    }

    writeSse(response, 'result', sanitizeAgentResultForFrontend(result));
  } catch (error) {
    const result = buildRecoverableAgentErrorResult({
      error,
      sessionId: request.body?.sessionId,
      userText: request.body?.message,
    });
    try {
      const storedSession = request.body?.sessionId ? await agentSessionStore.read(request.body.sessionId) : null;
      const requestContext = mergeAgentRequestContext({
        clientContext: request.body?.context || {},
        serverContext: storedSession?.context || {},
      });
      await agentSessionStore.saveTurn({
        requestContext,
        response: result,
        sessionId: result.sessionId,
        userText: request.body?.message || '',
      });
    } catch {
      // 保存失败不能阻断 SSE 收口;前台至少会得到一条可继续的助手消息。
    }
    writeSse(response, 'result', sanitizeAgentResultForFrontend(result));
  } finally {
    response.end();
  }
});

app.get('/api/agent/session/:sessionId', async (request, response) => {
  try {
    const session = await agentSessionStore.read(request.params.sessionId);
    if (!session) {
      response.status(404).json({
        ok: false,
        error: 'AGENT_SESSION_NOT_FOUND',
        message: '没有找到这次任务线程,可以重新交代任务。',
      });
      return;
    }
    response.json({ ok: true, session: sanitizeAgentSessionForFrontend(session) });
  } catch (error) {
    sendError(response, error);
  }
});

app.get('/api/agent/session/:sessionId/artifact', async (request, response) => {
  try {
    const session = await agentSessionStore.read(request.params.sessionId);
    if (!session) {
      response.status(404).json({
        ok: false,
        error: 'AGENT_SESSION_NOT_FOUND',
        message: '没有找到这次任务线程,可以重新交代任务。',
      });
      return;
    }
    const preview = await readAgentArtifactPreview({ projectRoot, session });
    response.json(preview);
  } catch (error) {
    sendError(response, error);
  }
});

app.post('/api/runs/:runId/confirm', async (request, response) => {
  try {
    const result = await runtime.confirmRun({ runId: request.params.runId });
    response.json(result);
  } catch (error) {
    sendError(response, error);
  }
});

app.post('/api/policy/check', async (request, response) => {
  try {
    const result = await runtime.checkPolicy(request.body?.action, { runId: request.body?.runId });
    response.json({ ok: true, ...result });
  } catch (error) {
    sendError(response, error);
  }
});

app.listen(port, '127.0.0.1', () => {
  console.log(`yingdan-agent-lab listening on 8787`);
});
