import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createSkillRuntime } from './skill-runner.mjs';
import { loadSkillRegistry, matchSkillForGoal } from './skill-registry.mjs';

const CODEX_BUNDLED_PYTHON =
  '/Users/garden/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';

async function withRegistryProject() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-skill-runtime-'));
  const registryDir = path.join(projectRoot, 'workbench', 'registry');
  const mockSkillDir = path.join(projectRoot, 'workbench', 'skills', 'supplier-brief');
  const coldEmailDir = path.join(projectRoot, 'workbench', 'skills', 'cold-email-draft');
  const followupDir = path.join(projectRoot, 'workbench', 'skills', 'customer-followup-plan');
  const inquiryReplyDir = path.join(projectRoot, 'workbench', 'skills', 'inquiry-reply-draft');
  const quotationDir = path.join(projectRoot, 'workbench', 'skills', 'quotation-sheet');

  await mkdir(registryDir, { recursive: true });
  await mkdir(mockSkillDir, { recursive: true });
  await mkdir(coldEmailDir, { recursive: true });
  await mkdir(followupDir, { recursive: true });
  await mkdir(inquiryReplyDir, { recursive: true });
  await mkdir(quotationDir, { recursive: true });
  await writeFile(
    path.join(registryDir, 'skills.json'),
    `${JSON.stringify(
      {
        skills: [
          {
            id: 'alibaba-inquiry-meeting',
            displayName: '国际站询盘分析会',
            adapter: 'alibaba-inquiry-meeting',
            artifactType: 'xlsx',
            goalMatchers: [
              {
                requiresAll: ['询盘'],
                requiresAny: ['分析会', '复盘会', '复盘', '会议', '开会'],
                periodHint: 'previous_full_week',
              },
            ],
            commandAliases: ['alibaba-inquiry-meeting'],
            policyActions: ['skill.read_external_package', 'alibaba.read_only_tool', 'artifact.write_xlsx', 'artifact.validate_xlsx'],
            requiredSheets: ['本次会议总览', '本周询盘概览'],
          },
        ],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  await writeFile(
    path.join(mockSkillDir, 'skill.json'),
    `${JSON.stringify(
      {
        id: 'supplier-brief',
        displayName: '供应商简报',
        description: '把供应商线索整理成业务员可读的简报。',
        adapter: 'mock-artifact',
        artifactType: 'markdown',
        commandAliases: ['supplier-brief'],
        goalMatchers: [{ requiresAll: ['供应商'], requiresAny: ['简报', '整理'] }],
        policyActions: ['skill.read_external_package', 'artifact.write_markdown'],
        plan: [
          { id: 'read_context', label: '读取资料', detail: '读取当前供应商线索。' },
          { id: 'write_brief', label: '生成简报', detail: '输出业务员可读的供应商简报。' },
        ],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  await writeFile(
    path.join(coldEmailDir, 'skill.json'),
    `${JSON.stringify(
      {
        id: 'cold-email-draft',
        displayName: '开发信草稿',
        description: '生成可检查的英文开发信草稿。',
        adapter: 'business-draft',
        artifactType: 'markdown',
        commandAliases: ['cold-email-draft'],
        goalMatchers: [
          { requiresAll: ['开发信'], requiresAny: ['准备', '生成', '写', '草稿'], confidence: 0.86 },
          { requiresAll: ['邮件'], requiresAny: ['开发', '跟进', '客户', '英文', '草稿'], confidence: 0.82 },
        ],
        policyActions: ['skill.read_external_package', 'artifact.write_markdown'],
        plan: [
          { id: 'check_context', label: '核对资料', detail: '核对客户和产品资料。' },
          { id: 'write_draft', label: '生成材料', detail: '生成开发信草稿。' },
        ],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  await writeFile(
    path.join(followupDir, 'skill.json'),
    `${JSON.stringify(
      {
        id: 'customer-followup-plan',
        displayName: '客户推进分析',
        description: '生成客户推进判断和下一步动作。',
        adapter: 'business-draft',
        artifactType: 'markdown',
        commandAliases: ['customer-followup-plan'],
        goalMatchers: [{ requiresAll: ['客户'], requiresAny: ['推进', '下一步', '跟进', '分析', '优先级', '机会', '判断'], confidence: 0.88 }],
        policyActions: ['skill.read_external_package', 'artifact.write_markdown'],
        plan: [
          { id: 'check_context', label: '核对资料', detail: '核对客户和询盘资料。' },
          { id: 'write_plan', label: '生成材料', detail: '生成客户推进分析。' },
        ],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  await writeFile(
    path.join(inquiryReplyDir, 'skill.json'),
    `${JSON.stringify(
      {
        id: 'inquiry-reply-draft',
        displayName: '询盘回复草稿',
        description: '生成可检查的询盘回复草稿。',
        adapter: 'business-draft',
        artifactType: 'markdown',
        commandAliases: ['inquiry-reply-draft'],
        goalMatchers: [
          { requiresAll: ['询盘'], requiresAny: ['回复', '回信', '草稿', '邮件'], confidence: 0.86 },
        ],
        policyActions: ['skill.read_external_package', 'artifact.write_markdown'],
        plan: [
          { id: 'check_context', label: '核对资料', detail: '核对询盘和产品资料。' },
          { id: 'write_reply', label: '生成材料', detail: '生成询盘回复草稿。' },
        ],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  await writeFile(
    path.join(quotationDir, 'skill.json'),
    `${JSON.stringify(
      {
        id: 'quotation-sheet',
        displayName: '报价单',
        description: '根据产品、数量、单价和贸易条款生成可检查的 XLSX 报价单。',
        adapter: 'quotation-sheet',
        artifactType: 'xlsx',
        commandAliases: ['quotation-sheet'],
        goalMatchers: [
          { requiresAll: ['报价单'], requiresAny: ['做', '生成', '整理', '报价'], confidence: 0.9 },
          { requiresAll: ['报价'], requiresAny: ['做', '生成', '整理', '报价给', '客户问', '客户要'], confidence: 0.87 },
          { requiresAll: ['PI'], requiresAny: ['做', '生成', '报价'], confidence: 0.88 },
        ],
        policyActions: ['skill.read_external_package', 'artifact.write_xlsx', 'artifact.validate_xlsx'],
        requiredSheets: ['报价单', '待确认项'],
        plan: [
          { id: 'check_context', label: '核对资料', detail: '核对产品、数量、单价和贸易条款。' },
          { id: 'write_quote', label: '生成材料', detail: '生成报价单 XLSX。' },
        ],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  return {
    projectRoot,
    async cleanup() {
      await rm(projectRoot, { recursive: true, force: true });
    },
  };
}

async function readJsonl(filePath) {
  const content = await readFile(filePath, 'utf8');
  return content
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function inspectXlsxWorkbook(inputPath) {
  const output = await runPythonTestScript(`
import json
from openpyxl import load_workbook

workbook = load_workbook(${JSON.stringify(inputPath)}, data_only=True)
values = []
for sheet_name in workbook.sheetnames:
    sheet = workbook[sheet_name]
    for row in sheet.iter_rows(values_only=True):
        for cell in row:
            if cell is not None:
                values.append(str(cell))
print(json.dumps({"sheets": workbook.sheetnames, "values": values}, ensure_ascii=False))
`);
  return JSON.parse(output);
}

function runPythonTestScript(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(CODEX_BUNDLED_PYTHON, ['-c', script], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (exitCode) => {
      if (exitCode === 0) {
        resolve(stdout.trim());
        return;
      }
      reject(new Error(stderr || stdout || `python test script failed with ${exitCode}`));
    });
  });
}

test('loadSkillRegistry merges registry skills with skill directories so a second Skill can be added by file', async () => {
  const fixture = await withRegistryProject();

  try {
    const registry = await loadSkillRegistry({ projectRoot: fixture.projectRoot });

    assert.deepEqual(
      registry.skills.map((skill) => skill.id).sort(),
      ['alibaba-inquiry-meeting', 'cold-email-draft', 'customer-followup-plan', 'inquiry-reply-draft', 'quotation-sheet', 'supplier-brief'],
    );
    assert.equal(registry.byId.get('supplier-brief').adapter, 'mock-artifact');
    assert.equal(registry.byId.get('supplier-brief').source.endsWith('workbench/skills/supplier-brief/skill.json'), true);
  } finally {
    await fixture.cleanup();
  }
});

test('matchSkillForGoal matches natural language and explicit commands from registry data', async () => {
  const fixture = await withRegistryProject();

  try {
    const registry = await loadSkillRegistry({ projectRoot: fixture.projectRoot });

    const natural = matchSkillForGoal({ registry, text: '帮我开上周询盘分析会' });
    assert.equal(natural.matched, true);
    assert.equal(natural.skill.id, 'alibaba-inquiry-meeting');
    assert.equal(natural.periodHint, 'previous_full_week');

    const command = matchSkillForGoal({ registry, text: '执行Skill：supplier-brief' });
    assert.equal(command.matched, true);
    assert.equal(command.skill.id, 'supplier-brief');
    assert.equal(command.trigger, 'skill_command');

    const email = matchSkillForGoal({ registry, text: '帮我准备一封跟进开发信' });
    assert.equal(email.matched, true);
    assert.equal(email.skill.id, 'cold-email-draft');
    assert.equal(email.trigger, 'natural_goal');

    const casualEmail = matchSkillForGoal({ registry, text: '写个 follow up 给德国客户，问 MOQ 和交期' });
    assert.equal(casualEmail.matched, true);
    assert.equal(casualEmail.skill.id, 'cold-email-draft');

    const customerFollowup = matchSkillForGoal({ registry, text: '帮我跟进这个德国客户，他问MOQ和交期，产品太阳能灯' });
    assert.equal(customerFollowup.matched, true);
    assert.equal(customerFollowup.skill.id, 'customer-followup-plan');

    const casualFollowup = matchSkillForGoal({ registry, text: '这个买家下一步咋办' });
    assert.equal(casualFollowup.matched, true);
    assert.equal(casualFollowup.skill.id, 'customer-followup-plan');

    const customerPriority = matchSkillForGoal({ registry, text: '帮我判断这个客户优先级' });
    assert.equal(customerPriority.matched, true);
    assert.equal(customerPriority.skill.id, 'customer-followup-plan');

    const mixedIntent = matchSkillForGoal({ registry, text: '客户是德国采购商，询盘问MOQ和交期，做下一步推进计划' });
    assert.equal(mixedIntent.matched, true);
    assert.equal(mixedIntent.skill.id, 'customer-followup-plan');

    const priceObjection = matchSkillForGoal({ registry, text: '客户说价格太高，帮我想下一步怎么谈，产品太阳能路灯' });
    assert.equal(priceObjection.matched, true);
    assert.equal(priceObjection.skill.id, 'customer-followup-plan');

    const casualReply = matchSkillForGoal({ registry, text: '客户发来价格和交期问题，帮我回一下，产品太阳能路灯' });
    assert.equal(casualReply.matched, true);
    assert.equal(casualReply.skill.id, 'inquiry-reply-draft');

    const replyEmail = matchSkillForGoal({ registry, text: '客户发来询盘，帮我回一封邮件，产品太阳能路灯' });
    assert.equal(replyEmail.matched, true);
    assert.equal(replyEmail.skill.id, 'inquiry-reply-draft');

    const quotationSheet = matchSkillForGoal({ registry, text: '客户问报价，产品太阳能路灯，数量500套，单价20美元，FOB深圳，帮我做一份报价单' });
    assert.equal(quotationSheet.matched, true);
    assert.equal(quotationSheet.skill.id, 'quotation-sheet');

    const casualQuotation = matchSkillForGoal({ registry, text: '客户问报价，产品太阳能路灯，数量500套，单价20美元，FOB深圳，帮我做报价' });
    assert.equal(casualQuotation.matched, true);
    assert.equal(casualQuotation.skill.id, 'quotation-sheet');

    const quoteForCustomer = matchSkillForGoal({ registry, text: '客户问报价，产品太阳能路灯，数量500套，单价20美元，FOB深圳，帮我报价给德国客户' });
    assert.equal(quoteForCustomer.matched, true);
    assert.equal(quoteForCustomer.skill.id, 'quotation-sheet');

    const generatedQuotation = matchSkillForGoal({ registry, text: '帮我生成报价，产品太阳能路灯，数量500套，单价20美元，FOB深圳' });
    assert.equal(generatedQuotation.matched, true);
    assert.equal(generatedQuotation.skill.id, 'quotation-sheet');

    const quotationEmail = matchSkillForGoal({ registry, text: '帮我写报价邮件，客户是德国采购商，产品太阳能路灯，数量500套，单价20美元，FOB深圳' });
    assert.equal(quotationEmail.matched, true);
    assert.equal(quotationEmail.skill.id, 'cold-email-draft');
  } finally {
    await fixture.cleanup();
  }
});

test('createSkillRuntime generates a real markdown business artifact for email drafts', async () => {
  const fixture = await withRegistryProject();

  try {
    const runtime = createSkillRuntime({
      projectRoot: fixture.projectRoot,
      checkPolicy: async () => ({ decision: 'allow', why: 'test allow' }),
    });

    const result = await runtime.runGoal({ text: '帮我准备一封跟进开发信，客户是德国采购商，关注MOQ和交期' });
    const content = await readFile(result.artifact.outputPath, 'utf8');

    assert.equal(result.ok, true);
    assert.equal(result.skill.id, 'cold-email-draft');
    assert.equal(result.artifact.type, 'markdown');
    assert.match(content, /英文开发信草稿/);
    assert.match(content, /Subject:/);
    assert.match(content, /客户是德国采购商/);
    assert.match(content, /German buyers/);
    assert.match(content, /MOQ and lead time/);
    assert.match(content, /已识别关注点: MOQ\/起订量、交期/);
    assert.match(content, /外发前再次确认/);
  } finally {
    await fixture.cleanup();
  }
});

test('createSkillRuntime carries product and sample intent into inquiry reply artifacts', async () => {
  const fixture = await withRegistryProject();

  try {
    const runtime = createSkillRuntime({
      projectRoot: fixture.projectRoot,
      checkPolicy: async () => ({ decision: 'allow', why: 'test allow' }),
    });

    const result = await runtime.runGoal({
      text: '客户发来询盘，帮我回一封邮件，产品太阳能路灯，问MOQ和交期，想下周先拿样品',
    });
    const content = await readFile(result.artifact.outputPath, 'utf8');

    assert.equal(result.ok, true);
    assert.equal(result.skill.id, 'inquiry-reply-draft');
    assert.match(content, /产品: 太阳能路灯/);
    assert.match(content, /solar street lights/);
    assert.match(content, /sample plan for next week/);
    assert.match(content, /客户关注点: MOQ\/起订量、交期、样品/);
  } finally {
    await fixture.cleanup();
  }
});

test('createSkillRuntime keeps sample wording out of extracted product names', async () => {
  const fixture = await withRegistryProject();

  try {
    const runtime = createSkillRuntime({
      projectRoot: fixture.projectRoot,
      checkPolicy: async () => ({ decision: 'allow', why: 'test allow' }),
    });

    const result = await runtime.runGoal({
      text: '客户发来询盘，帮我回一封邮件，产品太阳能路灯 想下周先拿样品，问MOQ和交期',
    });
    const content = await readFile(result.artifact.outputPath, 'utf8');

    assert.equal(result.ok, true);
    assert.equal(result.skill.id, 'inquiry-reply-draft');
    assert.match(content, /\n- 产品: 太阳能路灯\n/);
    assert.doesNotMatch(content, /产品: 太阳能路灯\s+想下周先拿样品/);
  } finally {
    await fixture.cleanup();
  }
});

test('createSkillRuntime carries negotiation pressure into customer follow-up artifacts', async () => {
  const fixture = await withRegistryProject();

  try {
    const runtime = createSkillRuntime({
      projectRoot: fixture.projectRoot,
      checkPolicy: async () => ({ decision: 'allow', why: 'test allow' }),
    });

    const result = await runtime.runGoal({
      text: '客户砍价，产品是家具，怎么谈',
    });
    const content = await readFile(result.artifact.outputPath, 'utf8');

    assert.equal(result.ok, true);
    assert.equal(result.skill.id, 'customer-followup-plan');
    assert.match(content, /产品: 家具/);
    assert.match(content, /客户关注点: 议价\/折扣压力/);
    assert.doesNotMatch(content, /客户关注点还需要从询盘原文里确认/);
  } finally {
    await fixture.cleanup();
  }
});

test('createSkillRuntime carries no-reply status into customer follow-up artifacts', async () => {
  const fixture = await withRegistryProject();

  try {
    const runtime = createSkillRuntime({
      projectRoot: fixture.projectRoot,
      checkPolicy: async () => ({ decision: 'allow', why: 'test allow' }),
    });

    const result = await runtime.runGoal({
      text: '客户已读不回，产品是家具，怎么跟',
    });
    const content = await readFile(result.artifact.outputPath, 'utf8');

    assert.equal(result.ok, true);
    assert.equal(result.skill.id, 'customer-followup-plan');
    assert.match(content, /产品: 家具/);
    assert.match(content, /客户关注点: 客户沉默\/未回复/);
    assert.match(content, /客户暂时未回复|客户处于沉默状态/);
    assert.doesNotMatch(content, /客户已经在问客户沉默\/未回复/);
    assert.doesNotMatch(content, /客户关注点还需要从询盘原文里确认/);
  } finally {
    await fixture.cleanup();
  }
});

test('createSkillRuntime turns a seven-day follow-up request into a day-by-day plan', async () => {
  const fixture = await withRegistryProject();

  try {
    const runtime = createSkillRuntime({
      projectRoot: fixture.projectRoot,
      checkPolicy: async () => ({ decision: 'allow', why: 'test allow' }),
    });

    const result = await runtime.runGoal({
      text: '客户已读不回，产品是家具，帮我做一个7天跟进计划',
    });

    assert.equal(result.ok, true);
    assert.equal(result.skill.id, 'customer-followup-plan');
    assert.equal(result.artifact?.name, '客户推进分析.md');
    const content = await readFile(result.artifact.outputPath, 'utf8');

    assert.match(content, /产品: 家具/);
    assert.match(content, /客户关注点: 客户沉默\/未回复/);
    assert.match(content, /7天跟进节奏|7 天跟进节奏/);
    assert.match(content, /第1天|第 1 天/);
    assert.match(content, /第3天|第 3 天/);
    assert.match(content, /第5天|第 5 天/);
    assert.match(content, /第7天|第 7 天/);
    assert.doesNotMatch(content, /客户关注点还需要从询盘原文里确认/);
  } finally {
    await fixture.cleanup();
  }
});

test('createSkillRuntime carries payment-term pressure into customer follow-up artifacts', async () => {
  const fixture = await withRegistryProject();

  try {
    const runtime = createSkillRuntime({
      projectRoot: fixture.projectRoot,
      checkPolicy: async () => ({ decision: 'allow', why: 'test allow' }),
    });

    const result = await runtime.runGoal({
      text: '客户要求60天账期，产品是设备，怎么处理',
    });

    assert.equal(result.ok, true);
    assert.equal(result.skill.id, 'customer-followup-plan');
    assert.equal(result.artifact?.name, '客户推进分析.md');
    const content = await readFile(result.artifact.outputPath, 'utf8');

    assert.match(content, /产品: 设备/);
    assert.match(content, /客户关注点: 付款\/账期压力/);
    assert.doesNotMatch(content, /客户关注点还需要从询盘原文里确认/);
  } finally {
    await fixture.cleanup();
  }
});

test('createSkillRuntime carries quality complaints into customer follow-up artifacts', async () => {
  const fixture = await withRegistryProject();

  try {
    const runtime = createSkillRuntime({
      projectRoot: fixture.projectRoot,
      checkPolicy: async () => ({ decision: 'allow', why: 'test allow' }),
    });

    const result = await runtime.runGoal({
      text: '客户抱怨质量不行，产品是灯具，怎么处理',
    });

    assert.equal(result.ok, true);
    assert.equal(result.skill.id, 'customer-followup-plan');
    assert.equal(result.artifact?.name, '客户推进分析.md');
    const content = await readFile(result.artifact.outputPath, 'utf8');

    assert.match(content, /产品: 灯具/);
    assert.match(content, /客户关注点: 质量\/售后风险/);
    assert.match(content, /质量|售后|证据/);
    assert.doesNotMatch(content, /客户关注点还需要从询盘原文里确认/);
  } finally {
    await fixture.cleanup();
  }
});

test('createSkillRuntime carries free sample pressure into customer follow-up artifacts', async () => {
  const fixture = await withRegistryProject();

  try {
    const runtime = createSkillRuntime({
      projectRoot: fixture.projectRoot,
      checkPolicy: async () => ({ decision: 'allow', why: 'test allow' }),
    });

    const result = await runtime.runGoal({
      text: '客户要免费样品，产品是灯具',
    });

    assert.equal(result.ok, true);
    assert.equal(result.skill.id, 'customer-followup-plan');
    assert.equal(result.artifact?.name, '客户推进分析.md');
    const content = await readFile(result.artifact.outputPath, 'utf8');

    assert.match(content, /产品: 灯具/);
    assert.match(content, /客户关注点: 样品\/费用压力/);
    assert.match(content, /样品成本|样品政策|客户意向/);
    assert.doesNotMatch(content, /客户关注点还需要从询盘原文里确认/);
  } finally {
    await fixture.cleanup();
  }
});

test('createSkillRuntime carries shipping cost objections into customer follow-up artifacts', async () => {
  const fixture = await withRegistryProject();

  try {
    const runtime = createSkillRuntime({
      projectRoot: fixture.projectRoot,
      checkPolicy: async () => ({ decision: 'allow', why: 'test allow' }),
    });

    const result = await runtime.runGoal({
      text: '客户嫌运费太贵，产品是灯具，怎么处理',
    });

    assert.equal(result.ok, true);
    assert.equal(result.skill.id, 'customer-followup-plan');
    assert.equal(result.artifact?.name, '客户推进分析.md');
    const content = await readFile(result.artifact.outputPath, 'utf8');

    assert.match(content, /产品: 灯具/);
    assert.match(content, /客户关注点: 物流\/运费压力/);
    assert.match(content, /运费|物流|运输方案/);
    assert.doesNotMatch(content, /客户关注点还需要从询盘原文里确认/);
  } finally {
    await fixture.cleanup();
  }
});

test('createSkillRuntime carries small trial order pressure into customer follow-up artifacts', async () => {
  const fixture = await withRegistryProject();

  try {
    const runtime = createSkillRuntime({
      projectRoot: fixture.projectRoot,
      checkPolicy: async () => ({ decision: 'allow', why: 'test allow' }),
    });

    const result = await runtime.runGoal({
      text: '客户只想小批量试单，产品是灯具，怎么处理',
    });

    assert.equal(result.ok, true);
    assert.equal(result.skill.id, 'customer-followup-plan');
    assert.equal(result.artifact?.name, '客户推进分析.md');
    const content = await readFile(result.artifact.outputPath, 'utf8');

    assert.match(content, /产品: 灯具/);
    assert.match(content, /客户关注点: 小单\/MOQ压力/);
    assert.match(content, /试单数量|MOQ|利润|客户意向/);
    assert.doesNotMatch(content, /客户关注点还需要从询盘原文里确认/);
  } finally {
    await fixture.cleanup();
  }
});

test('createSkillRuntime carries exclusive agency requests into customer follow-up artifacts', async () => {
  const fixture = await withRegistryProject();

  try {
    const runtime = createSkillRuntime({
      projectRoot: fixture.projectRoot,
      checkPolicy: async () => ({ decision: 'allow', why: 'test allow' }),
    });

    const result = await runtime.runGoal({
      text: '客户想做独家代理，产品是灯具，怎么谈',
    });

    assert.equal(result.ok, true);
    assert.equal(result.skill.id, 'customer-followup-plan');
    assert.equal(result.artifact?.name, '客户推进分析.md');
    const content = await readFile(result.artifact.outputPath, 'utf8');

    assert.match(content, /产品: 灯具/);
    assert.match(content, /客户关注点: 独家代理\/渠道合作/);
    assert.match(content, /区域|销量承诺|价格体系|试运行|渠道/);
    assert.doesNotMatch(content, /客户关注点还需要从询盘原文里确认/);
  } finally {
    await fixture.cleanup();
  }
});

test('createSkillRuntime generates a validated XLSX quotation sheet when quote terms are complete', async () => {
  const fixture = await withRegistryProject();

  try {
    const runtime = createSkillRuntime({
      projectRoot: fixture.projectRoot,
      checkPolicy: async () => ({ decision: 'allow', why: 'test allow' }),
    });

    const result = await runtime.runGoal({
      text: '客户问报价，产品太阳能路灯，数量500套，单价20美元，FOB深圳，帮我做一份报价单',
    });
    const workbook = await inspectXlsxWorkbook(result.artifact.outputPath);

    assert.equal(result.ok, true);
    assert.equal(result.skill.id, 'quotation-sheet');
    assert.equal(result.artifact.type, 'xlsx');
    assert.equal(result.artifact.name, '报价单.xlsx');
    assert.deepEqual(workbook.sheets, ['报价单', '待确认项']);
    assert.equal(workbook.values.some((value) => String(value).includes('太阳能路灯')), true);
    assert.equal(workbook.values.some((value) => String(value).includes('500套')), true);
    assert.equal(workbook.values.some((value) => String(value).includes('20美元')), true);
    assert.equal(workbook.values.some((value) => String(value).includes('FOB深圳')), true);
  } finally {
    await fixture.cleanup();
  }
});

test('createSkillRuntime executes a newly registered mock Skill without changing the main Runtime logic', async () => {
  const fixture = await withRegistryProject();
  const policyChecks = [];

  try {
    const runtime = createSkillRuntime({
      projectRoot: fixture.projectRoot,
      checkPolicy: async (action, context) => {
        policyChecks.push({ action, runId: context.runId });
        return { decision: 'allow', why: 'test allow' };
      },
      adapters: {
        'mock-artifact': {
          async load({ skill }) {
            return {
              displayName: skill.displayName,
              requiredFiles: ['skill.json'],
              hasExecutable: true,
            };
          },
          async execute({ runId, skill, outputRoot }) {
            const artifactPath = path.join(outputRoot, `${skill.id}-${runId}.md`);
            await writeFile(artifactPath, '# 供应商简报\n\n- 适合先做资质核对。\n', 'utf8');
            return {
              ok: true,
              mode: 'mock-artifact',
              runId,
              artifact: {
                type: 'markdown',
                outputPath: artifactPath,
                name: `${skill.displayName}.md`,
              },
              summary: { createdItems: 1 },
            };
          },
        },
      },
    });

    const result = await runtime.runGoal({ text: '帮我整理供应商简报' });

    assert.equal(result.ok, true);
    assert.equal(result.skill.id, 'supplier-brief');
    assert.equal(result.loop.status, 'completed');
    assert.equal(result.artifact.type, 'markdown');
    assert.match(await readFile(result.artifact.outputPath, 'utf8'), /供应商简报/);
    assert.deepEqual(policyChecks.map((item) => item.action), ['skill.read_external_package', 'artifact.write_markdown']);

    const events = await readJsonl(result.runLogPath);
    assert.deepEqual(
      events.map((event) => event.type),
      [
        'goal.received',
        'skill.matched',
        'skill.loaded',
        'plan.created',
        'policy.checked',
        'policy.checked',
        'action.executed',
        'observation.recorded',
        'artifact.verified',
        'run.completed',
      ],
    );
    assert.equal(events.find((event) => event.type === 'skill.matched').skillId, 'supplier-brief');
    assert.equal(events.find((event) => event.type === 'artifact.verified').status, 'complete');
  } finally {
    await fixture.cleanup();
  }
});

test('createSkillRuntime emits runtime events while it writes the run log', async () => {
  const fixture = await withRegistryProject();
  const streamedEvents = [];

  try {
    const runtime = createSkillRuntime({
      projectRoot: fixture.projectRoot,
      checkPolicy: async () => ({ decision: 'allow', why: 'test allow' }),
      onEvent: (event) => {
        streamedEvents.push(event);
      },
    });

    const result = await runtime.runGoal({ text: '帮我准备一封跟进开发信，客户是德国采购商，关注MOQ和交期' });

    assert.equal(result.ok, true);
    assert.equal(streamedEvents.length > 0, true);
    assert.deepEqual(
      streamedEvents.map((event) => event.type),
      [
        'goal.received',
        'skill.matched',
        'skill.loaded',
        'plan.created',
        'policy.checked',
        'policy.checked',
        'action.executed',
        'observation.recorded',
        'artifact.verified',
        'run.completed',
      ],
    );
    assert.equal(streamedEvents[0].runId, result.runId);
    assert.equal(streamedEvents.at(-1).status, 'completed');
  } finally {
    await fixture.cleanup();
  }
});

test('createSkillRuntime checkpoints policy ask and resumes from the same run after confirmation', async () => {
  const fixture = await withRegistryProject();
  const supplierSkillPath = path.join(fixture.projectRoot, 'workbench', 'skills', 'supplier-brief', 'skill.json');
  const policyChecks = [];
  let executeCount = 0;

  try {
    await writeFile(
      supplierSkillPath,
      `${JSON.stringify(
        {
          id: 'supplier-brief',
          displayName: '供应商简报',
          description: '把供应商线索整理成业务员可读的简报。',
          adapter: 'mock-artifact',
          artifactType: 'markdown',
          commandAliases: ['supplier-brief'],
          goalMatchers: [{ requiresAll: ['供应商'], requiresAny: ['简报', '整理'] }],
          policyActions: ['skill.read_external_package', 'paid_api.call', 'artifact.write_markdown'],
          plan: [
            { id: 'read_context', label: '读取资料', detail: '读取当前供应商线索。' },
            { id: 'write_brief', label: '生成简报', detail: '输出业务员可读的供应商简报。' },
          ],
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const runtime = createSkillRuntime({
      projectRoot: fixture.projectRoot,
      checkPolicy: async (action, context) => {
        policyChecks.push({ action, runId: context.runId });
        if (action === 'paid_api.call') {
          return { decision: 'ask', why: '付费 API 调用需用户确认' };
        }
        return { decision: 'allow', why: 'test allow' };
      },
      adapters: {
        'mock-artifact': {
          async load({ skill }) {
            return {
              displayName: skill.displayName,
              requiredFiles: ['skill.json'],
              hasExecutable: true,
            };
          },
          async execute({ runId, skill, outputRoot }) {
            executeCount += 1;
            const artifactPath = path.join(outputRoot, `${skill.id}-${runId}.md`);
            await writeFile(artifactPath, '# 供应商简报\n\n- 已确认后继续生成。\n', 'utf8');
            return {
              ok: true,
              mode: 'mock-artifact',
              runId,
              artifact: {
                type: 'markdown',
                outputPath: artifactPath,
                name: `${skill.displayName}.md`,
              },
              summary: { createdItems: 1 },
            };
          },
        },
      },
    });

    const waiting = await runtime.runGoal({ text: '帮我整理供应商简报' });
    const checkpoint = JSON.parse(await readFile(waiting.waiting.checkpointPath, 'utf8'));

    assert.equal(waiting.ok, true);
    assert.equal(waiting.loop.status, 'waiting');
    assert.equal(waiting.waiting.action, 'paid_api.call');
    assert.equal(checkpoint.status, 'waiting');
    assert.equal(checkpoint.pendingAction, 'paid_api.call');
    assert.equal(executeCount, 0);

    const resumed = await runtime.resumeGoal({ runId: waiting.runId });
    const events = await readJsonl(resumed.runLogPath);
    const completedCheckpoint = JSON.parse(await readFile(waiting.waiting.checkpointPath, 'utf8'));

    assert.equal(resumed.ok, true);
    assert.equal(resumed.loop.status, 'completed');
    assert.equal(resumed.runId, waiting.runId);
    assert.equal(completedCheckpoint.status, 'completed');
    assert.equal(executeCount, 1);
    assert.match(await readFile(resumed.artifact.outputPath, 'utf8'), /已确认后继续生成/);
    assert.equal(events.some((event) => event.type === 'run.checkpointed'), true);
    assert.equal(events.some((event) => event.type === 'run.waiting'), true);
    assert.equal(events.some((event) => event.type === 'run.resumed'), true);
    assert.deepEqual(policyChecks.map((item) => item.action), [
      'skill.read_external_package',
      'paid_api.call',
      'artifact.write_markdown',
    ]);
  } finally {
    await fixture.cleanup();
  }
});
