import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildInquiryMeetingXlsx, createInquiryMeetingFixturePayload } from './alibaba-skill.mjs';
import { validateXlsxArtifact } from './artifact-validator.mjs';

test('validateXlsxArtifact verifies zip, openpyxl, required sheets, and residual table or drawing parts', async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), 'yingdan-xlsx-validator-'));

  try {
    const built = await buildInquiryMeetingXlsx({
      outputRoot,
      payload: createInquiryMeetingFixturePayload(),
    });

    const result = await validateXlsxArtifact({
      outputPath: built.outputPath,
      requiredSheets: built.requiredSheets,
      forbiddenSheets: ['数据质量检查'],
    });

    assert.equal(result.ok, true);
    assert.equal(result.checks.zip, true);
    assert.equal(result.checks.openpyxl, true);
    assert.equal(result.checks.requiredSheets, true);
    assert.equal(result.checks.noTableParts, true);
    assert.equal(result.checks.noDrawingParts, true);
    assert.deepEqual(result.missingSheets, []);

    const missingSheet = await validateXlsxArtifact({
      outputPath: built.outputPath,
      requiredSheets: [...built.requiredSheets, '不存在的工作表'],
    });
    assert.equal(missingSheet.ok, false);
    assert.deepEqual(missingSheet.missingSheets, ['不存在的工作表']);
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});
