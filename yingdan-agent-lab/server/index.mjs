import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readAgentArtifactPreview } from './agent-artifact-preview.mjs';
import { parseAgentReferenceFile } from './agent-reference-parser.mjs';
import {
  createConsecutiveProgressDeduper,
  createInitialAgentStreamProgress,
  buildRecoverableAgentErrorResult,
  formatSseEvent,
  runtimeEventToStreamEvent,
  sanitizeAgentResultForFrontend,
  sanitizeAgentSessionForFrontend,
} from './agent-message-stream.mjs';
import { mergeAgentRequestContext } from './agent-request-context.mjs';
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

app.use((request, response, next) => {
  const origin = request.headers.origin || '';
  const isCorsAllowed = isAllowedCorsOrigin(origin);
  if (isCorsAllowed && origin) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
  }
  if (isCorsAllowed) {
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  }

  if (request.method === 'OPTIONS') {
    if (!isCorsAllowed) {
      response.status(403).end();
      return;
    }
    response.status(204).end();
    return;
  }

  next();
});

/**
 * isAllowedCorsOrigin 判断跨域请求是否来自本机原型页面。
 *
 * 作用：
 * - 这个后端会触发本机文件读取、XLSX 解析和 Agent 执行,不能把能力暴露给任意网页。
 * - 没有 Origin 的 curl/本机服务端请求继续允许;浏览器跨域只允许 localhost/127.0.0.1。
 *
 * 参数：
 * - origin：请求头里的 Origin。
 *
 * 返回值：boolean,true 表示允许继续响应 CORS。
 * 可能抛出的异常：无。
 */
function isAllowedCorsOrigin(origin = '') {
  if (!origin) {
    return true;
  }
  try {
    const parsed = new URL(origin);
    return ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

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
 * - 普通 JSON 接口和流式接口共用同一套合并 context、执行 Agent、保存回合逻辑。
 * - 流式接口可以先解析上下文再发第一条进度,避免续跑任务误显示“识别任务”。
 * - 可选 `onRuntimeEvent` 会接收 Runtime 真实事件,供 SSE 进度流使用。
 *
 * 参数：
 * - body：Express request.body。
 * - onRuntimeEvent：可选 Runtime 事件回调。
 * - resolvedRequest：可选的已解析请求上下文,避免同一轮重复读 session。
 *
 * 返回值：Promise<object>,即 runNewConversationAgent 的结果。
 * 可能抛出的异常：底层 Runtime、文件读写或 session 保存失败时抛出。
 */
async function executeAgentMessage(body = {}, onRuntimeEvent = null, resolvedRequest = null) {
  const resolved = resolvedRequest || await resolveAgentMessageRequest(body);
  const { requestContext, sessionId, storedSession } = resolved;
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
 * resolveAgentMessageRequest 读取已有 session 并合并本轮上下文。
 *
 * 作用：
 * - 让后端 session 里的 pendingTask / pendingConfirmation 成为续跑判断的权威来源。
 * - 流式接口在执行 Agent 前就能知道这是新任务还是 checkpoint 续跑。
 * - 前端传来的净化 context 仍可作为无 session 时的兜底。
 *
 * 参数：
 * - body：Express request.body。
 *
 * 返回值：包含 sessionId、storedSession 和 requestContext 的对象。
 * 可能抛出的异常：读取 session 文件失败时会抛出底层文件异常。
 */
async function resolveAgentMessageRequest(body = {}) {
  const sessionId = body?.sessionId || '';
  const storedSession = sessionId ? await agentSessionStore.read(sessionId) : null;
  const requestContext = mergeAgentRequestContext({
    clientContext: body?.context || {},
    serverContext: storedSession?.context || {},
  });

  return {
    requestContext,
    sessionId,
    storedSession,
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

app.post('/api/agent/reference/parse', express.json({ limit: '8mb' }), async (request, response) => {
  try {
    const reference = await parseAgentReferenceFile({
      dataBase64: request.body?.dataBase64 || '',
      mimeType: request.body?.type || request.body?.mimeType || '',
      name: request.body?.name || '',
    });
    response.json({ ok: true, reference });
  } catch (error) {
    sendError(response, error);
  }
});

app.use(express.json({ limit: '1mb' }));

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
    const resolvedRequest = await resolveAgentMessageRequest(request.body);
    const result = await executeAgentMessage(request.body, null, resolvedRequest);
    if (result.ok === false) {
      const recoverableResult = buildRecoverableAgentErrorResult({
        context: resolvedRequest.requestContext,
        error: result,
        sessionId: result.sessionId || request.body?.sessionId,
        userText: request.body?.message,
      });
      await agentSessionStore.saveTurn({
        requestContext: resolvedRequest.requestContext,
        response: recoverableResult,
        sessionId: recoverableResult.sessionId,
        userText: request.body?.message || '',
      });
      response.json(sanitizeAgentResultForFrontend(recoverableResult));
      return;
    }
    response.json(sanitizeAgentResultForFrontend(result));
  } catch (error) {
    let requestContext = request.body?.context || {};
    try {
      const storedSession = request.body?.sessionId ? await agentSessionStore.read(request.body.sessionId) : null;
      requestContext = mergeAgentRequestContext({
        clientContext: request.body?.context || {},
        serverContext: storedSession?.context || {},
      });
    } catch {
      requestContext = request.body?.context || {};
    }
    const result = buildRecoverableAgentErrorResult({
      context: requestContext,
      error,
      sessionId: request.body?.sessionId,
      userText: request.body?.message,
    });
    try {
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
  let resolvedRequest = null;

  try {
    resolvedRequest = await resolveAgentMessageRequest(request.body);
    writeSse(response, 'progress', createInitialAgentStreamProgress({
      context: resolvedRequest.requestContext,
      text: request.body?.message || '',
    }));

    const result = await executeAgentMessage(request.body, async (runtimeEvent) => {
      const streamEvent = dedupeProgressEvent(runtimeEventToStreamEvent(runtimeEvent));
      if (streamEvent) {
        writeSse(response, streamEvent.event, streamEvent.data);
      }
    }, resolvedRequest);

    if (result.ok === false) {
      const recoverableResult = buildRecoverableAgentErrorResult({
        context: resolvedRequest?.requestContext,
        error: result,
        sessionId: result.sessionId || request.body?.sessionId,
        userText: request.body?.message,
      });
      await agentSessionStore.saveTurn({
        requestContext: resolvedRequest?.requestContext || request.body?.context || {},
        response: recoverableResult,
        sessionId: recoverableResult.sessionId,
        userText: request.body?.message || '',
      });
      writeSse(response, 'result', sanitizeAgentResultForFrontend(recoverableResult));
      return;
    }

    writeSse(response, 'result', sanitizeAgentResultForFrontend(result));
  } catch (error) {
    let requestContext = resolvedRequest?.requestContext || request.body?.context || {};
    if (!resolvedRequest) {
      try {
        resolvedRequest = await resolveAgentMessageRequest(request.body);
        requestContext = resolvedRequest.requestContext;
      } catch {
        requestContext = request.body?.context || {};
      }
    }
    const result = buildRecoverableAgentErrorResult({
      context: requestContext,
      error,
      sessionId: request.body?.sessionId,
      userText: request.body?.message,
    });
    try {
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

app.get('/api/agent/sessions', async (request, response) => {
  try {
    const sessions = await agentSessionStore.list({ limit: request.query.limit });
    response.json({ ok: true, sessions });
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
    const preview = await readAgentArtifactPreview({
      messageId: request.query.messageId,
      projectRoot,
      session,
    });
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
