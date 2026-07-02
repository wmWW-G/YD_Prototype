import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const indexSourcePath = path.join(process.cwd(), 'server', 'index.mjs');

async function readJsonAgentMessageRouteSource() {
  const source = await readFile(indexSourcePath, 'utf8');
  const start = source.indexOf("app.post('/api/agent/message',");
  const end = source.indexOf("app.post('/api/agent/message/stream'", start + 1);

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

async function readStreamAgentMessageRouteSource() {
  const source = await readFile(indexSourcePath, 'utf8');
  const start = source.indexOf("app.post('/api/agent/message/stream'");
  const end = source.indexOf("app.get('/api/agent/session/:sessionId'", start + 1);

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

async function readReferenceParserRouteSource() {
  const source = await readFile(indexSourcePath, 'utf8');
  const start = source.indexOf("app.post('/api/agent/reference/parse'");
  const end = source.indexOf("app.use(express.json({ limit: '1mb' }))", start + 1);

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('reference parser route uses a dedicated large body limit while normal APIs stay small', async () => {
  const source = await readFile(indexSourcePath, 'utf8');
  const routeSource = await readReferenceParserRouteSource();

  assert.equal(routeSource.includes("express.json({ limit: '8mb' })"), true);
  assert.equal(source.includes("app.use(express.json({ limit: '1mb' }))"), true);
  assert.equal(source.includes("app.use(express.json({ limit: '8mb' }))"), false);
});

test('API CORS only allows local browser origins', async () => {
  const source = await readFile(indexSourcePath, 'utf8');

  assert.equal(source.includes('function isAllowedCorsOrigin'), true);
  assert.equal(source.includes("['localhost', '127.0.0.1', '[::1]']"), true);
  assert.equal(source.includes("Access-Control-Allow-Origin', '*'"), false);
});

test('JSON agent message route uses merged request context for recoverable failures', async () => {
  const routeSource = await readJsonAgentMessageRouteSource();
  const okFalseStart = routeSource.indexOf('if (result.ok === false) {');
  const okFalseEnd = routeSource.indexOf('response.json(sanitizeAgentResultForFrontend(recoverableResult));', okFalseStart);
  const okFalseBlock = routeSource.slice(okFalseStart, okFalseEnd);

  assert.notEqual(okFalseStart, -1);
  assert.notEqual(okFalseEnd, -1);
  assert.equal(routeSource.includes('const resolvedRequest = await resolveAgentMessageRequest(request.body);'), true);
  assert.equal(routeSource.includes('executeAgentMessage(request.body, null, resolvedRequest)'), true);
  assert.equal(okFalseBlock.includes('context: resolvedRequest.requestContext'), true);
  assert.equal(okFalseBlock.includes('requestContext: resolvedRequest.requestContext'), true);
  assert.equal(okFalseBlock.includes('requestContext: request.body?.context || {}'), false);
});

test('SSE agent message route passes current text into initial progress selection', async () => {
  const routeSource = await readStreamAgentMessageRouteSource();
  const initialProgressStart = routeSource.indexOf("writeSse(response, 'progress', createInitialAgentStreamProgress({");
  const initialProgressEnd = routeSource.indexOf('}));', initialProgressStart);
  const initialProgressBlock = routeSource.slice(initialProgressStart, initialProgressEnd);

  assert.notEqual(initialProgressStart, -1);
  assert.notEqual(initialProgressEnd, -1);
  assert.equal(initialProgressBlock.includes('context: resolvedRequest.requestContext'), true);
  assert.equal(initialProgressBlock.includes("text: request.body?.message || ''"), true);
});
