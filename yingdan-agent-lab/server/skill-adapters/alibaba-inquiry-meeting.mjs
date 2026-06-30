import { inspectAlibabaInquiryMeetingSkill } from '../alibaba-skill.mjs';
import { runAlibabaInquiryMeetingReal } from '../alibaba-real-runner.mjs';

/**
 * createAlibabaInquiryMeetingAdapter 创建 alibaba-inquiry-meeting 的 Skill 适配器。
 *
 * 作用：
 * - 把已经跑通的 real-bridge 专线包成通用 Runtime adapter。
 * - 保持 Alibaba 只读采集和 XLSX builder 的真实能力不变。
 * - 让通用 runner 只关心 load/execute 的统一接口。
 *
 * 参数：无。
 * 返回值：包含 load 和 execute 的 adapter 对象。
 * 可能抛出的异常：读取外部 Skill 或真实 runner 失败时向上抛出。
 */
export function createAlibabaInquiryMeetingAdapter() {
  return {
    async load({ skill }) {
      const info = await inspectAlibabaInquiryMeetingSkill(skill.skillPath);
      return {
        ...info,
        requiredFiles: ['SKILL.md', 'agents/openai.yaml', 'evals/evals.json', 'scripts/build_inquiry_meeting_xlsx.py'],
        hasExecutable: info.hasBuilderScript,
      };
    },

    async execute({ projectRoot, skill }) {
      const result = await runAlibabaInquiryMeetingReal({
        projectRoot,
        skillPath: skill.skillPath,
      });

      return {
        ...result,
        artifact: {
          type: 'xlsx',
          name: result.workbookName,
          outputPath: result.outputPath,
          manifestPath: result.manifestPath,
          validation: result.validation,
        },
      };
    },
  };
}
