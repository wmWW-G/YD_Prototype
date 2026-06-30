import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * loadSkillRegistry 读取赢单 Runtime 的 Skill 注册表。
 *
 * 作用：
 * - 先读取 `workbench/registry/skills.json` 里的显式注册项。
 * - 再扫描 `workbench/skills/<skill>/skill.json`，把本地新增 Skill 合并进来。
 * - 返回数组和 Map 两种结构，方便 matcher 和 runner 使用。
 *
 * 参数：
 * - options.projectRoot：项目根目录，字符串。
 *
 * 返回值：Promise<{skills: object[], byId: Map<string, object>}>。
 * 可能抛出的异常：注册文件 JSON 格式错误时抛出；目录不存在时按空目录处理。
 */
export async function loadSkillRegistry(options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const workbenchRoot = path.join(projectRoot, 'workbench');
  const registryPath = path.join(workbenchRoot, 'registry', 'skills.json');
  const explicitSkills = await readSkillsJson(registryPath);
  const directorySkills = await readSkillDirectories(path.join(workbenchRoot, 'skills'));
  const byId = new Map();

  for (const skill of [...explicitSkills, ...directorySkills]) {
    if (!skill?.id) {
      continue;
    }
    const previous = byId.get(skill.id) || {};
    byId.set(skill.id, normalizeSkill({ ...previous, ...skill }));
  }

  return {
    skills: [...byId.values()],
    byId,
  };
}

/**
 * matchSkillForGoal 根据用户输入从注册表里匹配 Skill。
 *
 * 作用：
 * - 支持明确命令 `执行Skill：xxx`。
 * - 支持由注册表声明的自然语言关键词匹配。
 * - 只返回业务化匹配结果，不要求前端理解 schema 或工具细节。
 *
 * 参数：
 * - input.registry：loadSkillRegistry 返回的注册表。
 * - input.text：用户原始输入。
 *
 * 返回值：匹配结果对象；matched=true 时包含 skill、trigger、reason。
 * 可能抛出的异常：无。
 */
export function matchSkillForGoal(input = {}) {
  const registry = input.registry || { skills: [], byId: new Map() };
  const text = String(input.text || '').trim();
  const compactText = normalizeGoalText(text);
  const command = detectSkillCommand(text);

  if (command.skillId) {
    const skill = registry.byId.get(command.skillId) || registry.skills.find((item) => (item.commandAliases || []).includes(command.skillId));
    if (skill) {
      return {
        matched: true,
        skill,
        skillId: skill.id,
        trigger: 'skill_command',
        confidence: 1,
        periodHint: 'previous_full_week',
        reason: `用户明确要求执行 ${skill.id}。`,
      };
    }
  }

  let bestMatch = null;
  for (const skill of registry.skills) {
    for (const matcher of skill.goalMatchers || []) {
      if (matchesGoalMatcher(compactText, matcher)) {
        const candidate = {
          matched: true,
          skill,
          skillId: skill.id,
          trigger: 'natural_goal',
          confidence: scoreGoalMatcher({ matcher, skill, text }),
          periodHint: matcher.periodHint || '',
          reason: matcher.reason || `已按业务目标匹配 ${skill.displayName || skill.id}。`,
        };
        if (!bestMatch || candidate.confidence > bestMatch.confidence) {
          bestMatch = candidate;
        }
      }
    }
  }

  if (bestMatch) {
    return bestMatch;
  }

  return {
    matched: false,
    skill: null,
    skillId: '',
    trigger: '',
    confidence: 0,
    periodHint: '',
    reason: '',
  };
}

/**
 * detectSkillCommand 解析显式 Skill 执行命令。
 *
 * 参数：
 * - text：用户输入。
 *
 * 返回值：{skillId: string}。
 * 可能抛出的异常：无。
 */
export function detectSkillCommand(text) {
  const match = String(text || '').trim().match(/执行\s*Skill\s*[:：]\s*([A-Za-z0-9_-]+)/i);
  return { skillId: match?.[1] || '' };
}

async function readSkillsJson(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : parsed.skills || [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function readSkillDirectories(skillsRoot) {
  let entries = [];
  try {
    entries = await readdir(skillsRoot, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  const skills = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const skillPath = path.join(skillsRoot, entry.name, 'skill.json');
    try {
      const parsed = JSON.parse(await readFile(skillPath, 'utf8'));
      skills.push({ ...parsed, source: skillPath });
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }
  return skills;
}

function normalizeSkill(skill) {
  return {
    ...skill,
    adapter: skill.adapter || skill.runner || 'mock-artifact',
    artifactType: skill.artifactType || 'markdown',
    commandAliases: Array.isArray(skill.commandAliases) ? skill.commandAliases : [skill.id].filter(Boolean),
    goalMatchers: Array.isArray(skill.goalMatchers) ? skill.goalMatchers : [],
    policyActions: Array.isArray(skill.policyActions) ? skill.policyActions : [],
    source: skill.source || 'workbench/registry/skills.json',
  };
}

function matchesGoalMatcher(compactText, matcher) {
  const requiresAll = matcher.requiresAll || [];
  const requiresAny = matcher.requiresAny || [];
  const hasAll = requiresAll.every((keyword) => compactText.includes(String(keyword).replace(/\s+/g, '')));
  const hasAny = requiresAny.length === 0 || requiresAny.some((keyword) => compactText.includes(String(keyword).replace(/\s+/g, '')));
  return hasAll && hasAny;
}

/**
 * scoreGoalMatcher 给命中的 matcher 计算最终分数。
 *
 * 作用：
 * - registry 仍保持确定性匹配,但多个 Skill 同时命中时不能只看文件顺序。
 * - 用用户原文里的强意图词给更明确的业务产物加一点分。
 *
 * 参数：
 * - input.skill：当前 Skill。
 * - input.matcher：命中的 matcher。
 * - input.text：用户原始输入。
 *
 * 返回值：数字分数，越高越优先。
 * 可能抛出的异常：无。
 */
function scoreGoalMatcher(input = {}) {
  const skill = input.skill || {};
  const matcher = input.matcher || {};
  const text = String(input.text || '').toLowerCase();
  const hasEmailDraftIntent = /开发信|开发邮件|cold\s*email|首次开发|新客|写.*(?:邮件|email|follow\s*up|跟进)|准备.*(?:邮件|email|follow\s*up|跟进)|生成.*(?:邮件|email|follow\s*up|跟进)/.test(text);
  const hasReplyIntent = /怎么回|回复|回信|reply|回一下|回客户|帮.*回/.test(text);
  const hasEmailIntent = /邮件|email|mail/.test(text);
  const hasOutboundSendIntent = /发给|发送给|外发|send\s+to|send/.test(text);
  // 报价、报价邮件、回复客户、外发给客户是四个不同动作；这里只给“生成报价单”类说法加分。
  const hasQuotationSheetIntent =
    /报价单|做报价|生成报价|整理报价|报价给|客户问报价|客户要报价|pi|proforma/.test(text) &&
    !hasEmailIntent &&
    !hasReplyIntent &&
    !hasOutboundSendIntent;
  let score = matcher.confidence || 0.86;

  if (skill.id === 'cold-email-draft' && hasEmailDraftIntent) {
    score += 0.15;
  }
  if (skill.id === 'quotation-sheet' && hasQuotationSheetIntent) {
    score += 0.11;
  }
  if (skill.id === 'customer-followup-plan' && !hasEmailDraftIntent && /下一步|推进|怎么推进|咋办|怎么办|推进计划|跟进计划|跟进|回访|优先跟|客户分析|客户画像|优先级|机会|意向|判断/.test(text)) {
    score += 0.1;
  }
  if (skill.id === 'inquiry-reply-draft' && /询盘|回复|回信|怎么回|reply|回一下|回客户/.test(text)) {
    score += 0.12;
  }

  return score;
}

/**
 * normalizeGoalText 把用户随口说法补成 matcher 更容易理解的业务词。
 *
 * 作用：
 * - 第一版 registry 仍然用确定性关键词匹配，避免把普通聊天误触发成任务。
 * - 这里把常见中英混说、口语说法补成“开发信 / 客户 / 推进 / 询盘回复”等内部业务词。
 *
 * 参数：
 * - text：用户原始输入，字符串。
 *
 * 返回值：去掉空白后的归一化文本。
 * 可能抛出的异常：无。
 */
function normalizeGoalText(text = '') {
  const raw = String(text || '');
  const lower = raw.toLowerCase();
  const additions = [];

  const hasReplyIntent = /怎么回|回复|回信|reply|回一下|回客户|帮.*回/.test(lower);
  const hasExplicitDevelopmentIntent = /开发信|开发邮件|cold\s*email|开发客户|首次开发|新客/.test(lower);
  const hasFollowUpEmailIntent = /follow\s*up/.test(lower) && /写|准备|生成|草稿|邮件|email|mail|draft/.test(lower);
  if (hasExplicitDevelopmentIntent || hasFollowUpEmailIntent || (/email|mail|邮件/.test(lower) && !hasReplyIntent)) {
    additions.push('邮件开发信草稿');
  }
  if (/buyer|客户|买家|采购商|客人|对方/.test(lower)) {
    additions.push('客户');
  }
  if (/next step|下一步|咋办|怎么办|怎么处理|怎么推进|怎么谈|怎么跟|谈判|推进|跟下去|跟进|回访|优先跟|已读不回|没回复|未回复|不回复|不回消息|不回信|没回|砍价|压价|还价|议价|让价|降价|折扣|账期|赊账|月结|付款条件|付款方式|免费样品|样品费|样品费用|不想付样品|不付样品|小批量|小单|试单|小数量|少量试|低于\s*moq|moq\s*太高|起订量太高|free\s+sample|sample\s+fee|small\s+(?:trial\s+)?order|trial\s+order|payment\s+terms|credit\s+terms/.test(lower)) {
    additions.push('下一步推进分析');
  }
  if (/客户分析|客户画像|优先级|机会|意向|成交|判断/.test(lower)) {
    additions.push('客户推进分析');
  }
  // 只有出现明确“回复客户”的说法才补成询盘回复。
  // 不能把单独的“询盘”也算进来,否则“询盘分析会”会被误路由到回复草稿。
  if (hasReplyIntent) {
    additions.push('询盘回复草稿邮件');
  }
  if (/moq|起订量|交期|lead\s*time|delivery/.test(lower)) {
    additions.push('MOQ交期采购关注点');
  }

  return `${raw}${additions.join('')}`.replace(/\s+/g, '');
}
