import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRuntime, loadEnvFile } from './runtime.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const envFromFile = await loadEnvFile(path.join(projectRoot, '.env'));
const runtime = createRuntime({
  env: { ...envFromFile, ...process.env },
  projectRoot,
});

/**
 * assert 确认真实 E2E 验收条件。
 *
 * 参数：
 * - condition：布尔条件。
 * - message：失败时抛出的说明。
 *
 * 返回值：无。
 * 可能抛出的异常：condition 为 false 时抛异常。
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * runE2E 用 DeepSeek flash 跑完整询盘试金石流程。
 *
 * 参数：无。
 * 返回值：Promise<void>。
 * 可能抛出的异常：模型、解析、文件落盘或确认保存任一步失败时抛异常。
 */
async function runE2E() {
  await runtime.ensureWorkbench();
  const analysis = await runtime.analyzeInquiry({
    customerSlug: 'global-sourcing-inc',
    inquiryText:
      'Hi, we are looking for 50,000 pcs of 500ml stainless steel water bottles. Please share price for FOB Shanghai, lead time, and MOQ. Logo printing needed.',
    mode: 'fast',
  });

  assert(analysis.ok, 'analysis did not succeed');
  assert(analysis.status === 'waiting', 'analysis did not stop at waiting');
  assert(analysis.result?.intention?.level, 'missing intention');
  assert(analysis.result?.missingInfo?.length > 0, 'missing missingInfo');
  assert(analysis.result?.risks?.length > 0, 'missing risks');
  assert(/^(Hi|Dear|Hello)[,\s]/i.test(analysis.result?.replyDraft || ''), 'reply draft is not English email-like');
  assert(analysis.result?.nextSteps?.length > 0, 'missing nextSteps');

  const allOutput = JSON.stringify(analysis.result);
  assert(/Global Sourcing|United States|2\.40|FOB|Logo/i.test(allOutput), 'result does not show customer-context evidence');

  const confirmed = await runtime.confirmRun({ runId: analysis.runId });
  assert(confirmed.ok && confirmed.status === 'completed', 'confirm did not complete');

  console.log(
    JSON.stringify(
      {
        ok: true,
        runId: analysis.runId,
        status: confirmed.status,
        intention: analysis.result.intention.level,
        missingInfoCount: analysis.result.missingInfo.length,
        riskCount: analysis.result.risks.length,
        nextStepCount: analysis.result.nextSteps.length,
      },
      null,
      2,
    ),
  );
}

await runE2E();
