import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { callDeepSeek, loadEnvFile } from './runtime.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const env = await loadEnvFile(path.join(projectRoot, '.env'));

/**
 * runEnvOnlySmoke 只使用项目 `.env` 里的 Key 做 DeepSeek flash 连通性测试。
 *
 * 作用：
 * - 排除当前 shell 环境变量的影响，确认用户放进 `.env` 的 Key 本身是否有效。
 * - 输出只包含模型名、用量和响应长度，不打印 Key。
 *
 * 参数：无。
 * 返回值：Promise<void>。
 * 可能抛出的异常：`.env` 缺 Key、Key 无效、网络失败或 DeepSeek 返回异常时抛异常。
 */
async function runEnvOnlySmoke() {
  const response = await callDeepSeek({
    env,
    messages: [
      { role: 'system', content: 'You are a strict JSON responder. Return only JSON.' },
      { role: 'user', content: 'Return {"ok":true,"source":"env"} exactly as valid JSON.' },
    ],
    model: 'deepseek-v4-flash',
    purpose: 'env_only_smoke',
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

await runEnvOnlySmoke();
