import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  ALIBABA_INQUIRY_MEETING_SKILL_PATH,
  buildInquiryMeetingXlsx,
  createInquiryMeetingFixturePayload,
  inspectAlibabaInquiryMeetingSkill,
} from './alibaba-skill.mjs';

test('inspectAlibabaInquiryMeetingSkill reads the real external Accio skill package', async () => {
  const skill = await inspectAlibabaInquiryMeetingSkill(ALIBABA_INQUIRY_MEETING_SKILL_PATH);

  assert.equal(skill.name, 'alibaba-inquiry-meeting');
  assert.equal(skill.displayName, '国际站询盘分析会主持');
  assert.equal(skill.hasBuilderScript, true);
  assert.equal(skill.evalCount, 12);
  assert.ok(skill.requiredSheets.includes('本次会议总览'));
  assert.ok(skill.requiredSheets.includes('下周跟进行动表'));
  assert.match(skill.defaultPrompt, /alibaba-inquiry-meeting/);
});

test('buildInquiryMeetingXlsx executes the skill builder and produces a validated XLSX', async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-alibaba-skill-'));

  try {
    const result = await buildInquiryMeetingXlsx({
      outputRoot,
      payload: createInquiryMeetingFixturePayload(),
    });

    assert.equal(result.ok, true);
    assert.equal(result.skillName, 'alibaba-inquiry-meeting');
    assert.equal(result.workbookName, '询盘分析会_2026-06-01_2026-06-07.xlsx');
    assert.equal(result.requiredSheets.length, 8);

    const outputStat = await stat(result.outputPath);
    assert.ok(outputStat.size > 0);

    const manifest = JSON.parse(await readFile(result.manifestPath, 'utf8'));
    assert.equal(manifest.skillName, 'alibaba-inquiry-meeting');
    assert.equal(manifest.validation.builderExitCode, 0);
    assert.equal(manifest.validation.workbookExists, true);
    assert.equal(manifest.validation.mode, 'builder-only-fixture');
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});
