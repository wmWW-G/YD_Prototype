import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { callDeepSeek, loadEnvFile } from './runtime.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const envFromFile = await loadEnvFile(path.join(projectRoot, '.env'));
const env = { ...envFromFile, ...process.env };

/**
 * runSmoke 使用 flash 模型做最小真实连通性测试。
 *
 * 参数：无。
 * 返回值：Promise<void>。
 * 可能抛出的异常：Key 缺失、模型名/参数错误、网络失败或 DeepSeek 返回异常时抛出。
 */
async function runSmoke() {
  const response = await callDeepSeek({
    env,
    messages: [
      { role: 'system', content: 'You are a strict JSON responder. Return only JSON.' },
      { role: 'user', content: 'Return {"ok":true,"model":"flash"} exactly as valid JSON.' },
    ],
    model: 'deepseek-v4-flash',
    purpose: 'smoke',
    taskType: 'fast',
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        contentLength: response.content.length,
        model: response.model,
        usage: response.usage,
      },
      null,
      2,
    ),
  );
}

await runSmoke();
