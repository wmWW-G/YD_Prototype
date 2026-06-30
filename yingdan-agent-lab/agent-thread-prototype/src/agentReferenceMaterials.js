const REFERENCE_TEXT_LIMIT = 6000;
const SUPPORTED_REFERENCE_EXTENSIONS = ['.txt', '.md', '.csv'];
const SUPPORTED_REFERENCE_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/x-markdown',
  'application/csv',
]);

/**
 * readReferenceFileText 读取用户主动选择的文本资料。
 *
 * 作用：
 * - 让“引用资料”真正把客户资料、询盘或产品说明带入当前任务输入。
 * - 第一阶段只读取文本类资料,避免在前端伪装 PDF/XLSX 解析能力。
 *
 * 参数：
 * - file：浏览器 File 对象,需要包含 name、type 和 text()。
 *
 * 返回值：Promise<object>,包含文件名和截断后的文本内容。
 * 可能抛出的异常：
 * - REFERENCE_FILE_UNSUPPORTED：文件类型不是 txt/md/csv。
 * - REFERENCE_FILE_EMPTY：文件没有可用文字。
 * - 浏览器读取失败时可能抛出原始异常。
 */
export async function readReferenceFileText(file) {
  if (!isSupportedReferenceFile(file)) {
    throw createReferenceFileError(
      'REFERENCE_FILE_UNSUPPORTED',
      '这类文件暂时不能直接引用。请先转成 txt、md 或 csv,也可以把关键内容粘贴到输入框。',
    );
  }

  const rawText = await file.text();
  const text = trimReferenceText(rawText);
  if (!text) {
    throw createReferenceFileError(
      'REFERENCE_FILE_EMPTY',
      '这份资料没有读到可用文字,可以换一份文件或直接粘贴关键内容。',
    );
  }

  return {
    name: safeReferenceFileName(file?.name || '未命名资料'),
    text,
  };
}

/**
 * isSupportedReferenceFile 判断文件是否属于当前前端可直接读取的文本资料。
 *
 * 作用：
 * - 浏览器 accept 只能限制文件选择体验,不能作为真实能力边界。
 * - 这里用后缀和 MIME 双重判断,防止 PDF/XLSX 被当成乱码文本塞进任务。
 *
 * 参数：
 * - file：浏览器 File 对象。
 *
 * 返回值：boolean,true 表示可以调用 file.text() 作为业务资料。
 * 可能抛出的异常：无。
 */
export function isSupportedReferenceFile(file = {}) {
  const name = String(file?.name || '').toLowerCase();
  const type = String(file?.type || '').toLowerCase();
  const hasSupportedExtension = SUPPORTED_REFERENCE_EXTENSIONS.some((extension) => name.endsWith(extension));
  const hasSupportedMimeType = type ? SUPPORTED_REFERENCE_MIME_TYPES.has(type) : false;
  return hasSupportedExtension || hasSupportedMimeType;
}

/**
 * buildReferenceDraftBlock 把多份引用资料拼成输入框里的业务上下文。
 *
 * 作用：
 * - 用户点击开始处理时,这些资料会随同自然语言任务一起发给后端。
 * - 文本格式保持人可读,不要求用户理解 schema 或 JSON。
 *
 * 参数：
 * - references：资料数组,每项包含 name 和 text。
 *
 * 返回值：可追加到输入框的字符串。
 * 可能抛出的异常：无。
 */
export function buildReferenceDraftBlock(references = []) {
  const blocks = references
    .filter((reference) => reference?.text)
    .map((reference) => `【${safeReferenceFileName(reference.name || '未命名资料')}】\n${reference.text}`);
  return ['引用资料：', ...blocks].join('\n\n');
}

/**
 * trimReferenceText 限制单份引用资料长度。
 *
 * 作用：
 * - 防止用户误选超长文件导致输入框和本地请求过大。
 * - 保留开头业务信息,并用自然语言提示内容已截断。
 *
 * 参数：
 * - text：原始文件文本。
 *
 * 返回值：截断后的文本。
 * 可能抛出的异常：无。
 */
export function trimReferenceText(text = '') {
  const normalized = String(text || '').trim();
  if (normalized.length <= REFERENCE_TEXT_LIMIT) {
    return normalized;
  }
  return `${normalized.slice(0, REFERENCE_TEXT_LIMIT)}\n\n[资料较长,这里只引用前 ${REFERENCE_TEXT_LIMIT} 个字符。]`;
}

/**
 * referenceFileErrorMessage 把引用资料读取错误转成用户可理解的提示。
 *
 * 参数：
 * - error：readReferenceFileText 抛出的异常。
 *
 * 返回值：业务化错误文案,不暴露浏览器或底层异常。
 * 可能抛出的异常：无。
 */
export function referenceFileErrorMessage(error = {}) {
  return error.userMessage || '资料读取失败,请直接粘贴到输入框。';
}

/**
 * safeReferenceFileName 清理资料名,避免多行文件名破坏输入框结构。
 *
 * 参数：
 * - value：文件名或资料名。
 *
 * 返回值：单行资料名。
 * 可能抛出的异常：无。
 */
function safeReferenceFileName(value = '') {
  const name = String(value || '').replace(/\s+/g, ' ').trim();
  return name || '未命名资料';
}

/**
 * createReferenceFileError 创建带错误码和用户文案的异常。
 *
 * 参数：
 * - code：错误码。
 * - userMessage：前台可以展示给用户的业务化文案。
 *
 * 返回值：Error 实例。
 * 可能抛出的异常：无。
 */
function createReferenceFileError(code, userMessage) {
  return Object.assign(new Error(userMessage), { code, userMessage });
}
