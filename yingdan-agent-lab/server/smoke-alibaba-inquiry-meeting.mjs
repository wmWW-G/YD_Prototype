import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildInquiryMeetingXlsx, createInquiryMeetingFixturePayload } from './alibaba-skill.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

/**
 * runSmoke 执行 `alibaba-inquiry-meeting` builder-only smoke。
 *
 * 作用：
 * - 用业务化 fixture payload 调用外部 Accio skill 自带 XLSX builder。
 * - 把输出保存在本项目 `workbench/artifacts/alibaba-inquiry-meeting-smoke/` 下。
 * - 明确标记为 builder-only，不冒充真实 Alibaba/Accio 只读工具采集。
 *
 * 参数：无。
 *
 * 返回值：Promise<void>。
 * 可能抛出的异常：外部 skill 缺失、Python 依赖缺失、LibreOffice 失败、XLSX 校验失败或写文件失败时抛出。
 */
async function runSmoke() {
  const outputRoot = path.join(projectRoot, 'workbench', 'artifacts', 'alibaba-inquiry-meeting-smoke');
  const result = await buildInquiryMeetingXlsx({
    outputRoot,
    payload: createInquiryMeetingFixturePayload(),
  });

  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        mode: result.validation.mode,
        skillName: result.skillName,
        outputPath: result.outputPath,
        manifestPath: result.manifestPath,
        workbookName: result.workbookName,
        note: 'builder-only smoke passed; final acceptance still requires live Accio/Alibaba read-only tool execution.',
      },
      null,
      2,
    ),
  );
}

await runSmoke();
