import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runAlibabaInquiryMeetingReal } from './alibaba-real-runner.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

/**
 * runAcceptance 执行真实 alibaba-inquiry-meeting 验收。
 *
 * 作用：
 * - 通过 Accio 本地网关调用 Alibaba 只读工具。
 * - 把真实返回和缺口整理成主持材料 JSON。
 * - 调用外部 skill 自带 builder 生成并验证 XLSX。
 * - 在 stdout 只输出路径、周期和摘要，不输出 token 或原始客户数据。
 *
 * 参数：无。
 * 返回值：Promise<void>。
 * 可能抛出的异常：bridge 不可用、工具全部失败、XLSX 生成失败或文件写入失败时抛出。
 */
async function runAcceptance() {
  const result = await runAlibabaInquiryMeetingReal({ projectRoot });
  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        mode: result.mode,
        runId: result.runId,
        period: result.period,
        outputPath: result.outputPath,
        manifestPath: result.manifestPath,
        runLogPath: result.runLogPath,
        workbookName: result.workbookName,
        validation: result.validation,
        toolSummary: result.toolSummary,
      },
      null,
      2,
    ),
  );
}

await runAcceptance();
