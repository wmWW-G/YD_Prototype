import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildReferenceDraftBlock,
  readReferenceFileText,
  referenceFileErrorMessage,
  trimReferenceText,
} from '../agent-thread-prototype/src/agentReferenceMaterials.js';

function createFakeFile({ name, text, type = '' }) {
  return {
    name,
    type,
    async text() {
      return text;
    },
  };
}

test('readReferenceFileText imports supported text reference files', async () => {
  const reference = await readReferenceFileText(createFakeFile({
    name: 'buyer-notes.md',
    text: '客户问 MOQ 和交期，产品是太阳能路灯。',
    type: 'text/markdown',
  }));

  assert.deepEqual(reference, {
    name: 'buyer-notes.md',
    text: '客户问 MOQ 和交期，产品是太阳能路灯。',
  });
});

test('readReferenceFileText rejects unsupported binary-looking files instead of pretending to parse them', async () => {
  await assert.rejects(
    () => readReferenceFileText(createFakeFile({
      name: 'quote.xlsx',
      text: 'fake workbook bytes',
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })),
    (error) => error.code === 'REFERENCE_FILE_UNSUPPORTED' &&
      /txt、md 或 csv/.test(referenceFileErrorMessage(error)),
  );

  await assert.rejects(
    () => readReferenceFileText(createFakeFile({
      name: 'catalog.pdf',
      text: '%PDF fake bytes',
      type: 'application/pdf',
    })),
    (error) => error.code === 'REFERENCE_FILE_UNSUPPORTED',
  );
});

test('readReferenceFileText rejects empty reference files with a user-facing message', async () => {
  await assert.rejects(
    () => readReferenceFileText(createFakeFile({
      name: 'empty.txt',
      text: '   \n  ',
      type: 'text/plain',
    })),
    (error) => error.code === 'REFERENCE_FILE_EMPTY' &&
      /没有读到可用文字/.test(referenceFileErrorMessage(error)),
  );
});

test('buildReferenceDraftBlock appends readable reference context without schema or JSON', () => {
  const block = buildReferenceDraftBlock([
    { name: '客户聊天.md', text: '客户已读不回，问过样品。' },
    { name: '产品卖点.csv', text: '产品,家具\n卖点,可定制尺寸' },
  ]);

  assert.match(block, /^引用资料：/);
  assert.match(block, /【客户聊天\.md】\n客户已读不回/);
  assert.match(block, /【产品卖点\.csv】\n产品,家具/);
  assert.doesNotMatch(block, /schema|JSON|tool call/i);
});

test('trimReferenceText keeps long references bounded with a plain-language notice', () => {
  const text = trimReferenceText('a'.repeat(6005));

  assert.equal(text.length > 6000, true);
  assert.match(text, /资料较长/);
  assert.match(text, /前 6000 个字符/);
});
