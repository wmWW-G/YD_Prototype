import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRuntime, loadEnvFile } from './runtime.mjs';
import { runNewConversationAgent } from './skill-agent.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const envFromFile = await loadEnvFile(path.join(projectRoot, '.env'));
const runtime = createRuntime({
  env: { ...envFromFile, ...process.env },
  projectRoot,
});

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
    const result = await runNewConversationAgent({
      text: request.body?.message || '',
      projectRoot,
    });

    const status = result.ok === false ? 400 : 200;
    response.status(status).json(result);
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
