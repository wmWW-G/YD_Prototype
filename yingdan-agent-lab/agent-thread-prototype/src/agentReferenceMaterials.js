const REFERENCE_TEXT_LIMIT = 6000;
const DIRECT_TEXT_REFERENCE_EXTENSIONS = ['.txt', '.md', '.csv'];
const DIRECT_TEXT_REFERENCE_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/x-markdown',
  'application/csv',
]);
const BACKEND_PARSED_REFERENCE_EXTENSIONS = ['.xlsx', '.xlsm'];
const BACKEND_PARSED_REFERENCE_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroenabled.12',
]);

/**
 * readReferenceFileText 读取用户主动选择的业务资料。
 *
 * 作用：
 * - 让“引用资料”真正把客户资料、询盘、报价表或产品说明带入当前任务输入。
 * - txt/md/csv 直接在浏览器读取;XLSX 交给后端解析成可读表格文本。
 * - PDF 仍不伪装支持,避免把二进制乱码塞进 Agent 上下文。
 *
 * 参数：
 * - file：浏览器 File 对象,需要包含 name、type 和 text()。
 * - options.parseBinaryReferenceFile：可选函数,用于把 XLSX 交给后端解析。
 *
 * 返回值：Promise<object>,包含文件名和截断后的文本内容。
 * 可能抛出的异常：
 * - REFERENCE_FILE_UNSUPPORTED：文件类型不是 txt/md/csv/xlsx,或缺少 XLSX 后端解析器。
 * - REFERENCE_FILE_EMPTY：文件没有可用文字。
 * - 浏览器读取或后端解析失败时可能抛出原始异常。
 */
export async function readReferenceFileText(file, options = {}) {
  if (isDirectTextReferenceFile(file)) {
    return buildReferenceFromText({
      name: file?.name,
      rawText: await file.text(),
    });
  }

  if (isBackendParsedReferenceFile(file)) {
    if (typeof options.parseBinaryReferenceFile !== 'function') {
      throw createUnsupportedReferenceFileError();
    }

    const parsedReference = await options.parseBinaryReferenceFile(file);
    return buildReferenceFromText({
      emptyMessage: '这份表格没有读到可用文字,可以换一份文件或直接粘贴关键内容。',
      name: parsedReference?.name || file?.name,
      rawText: parsedReference?.text || '',
    });
  }

  throw createUnsupportedReferenceFileError();
}

/**
 * isSupportedReferenceFile 判断文件是否属于当前引用资料支持范围。
 *
 * 作用：
 * - 浏览器 accept 只能限制文件选择体验,不能作为真实能力边界。
 * - 这里用后缀和 MIME 双重判断,让前端知道哪些资料可以尝试导入。
 *
 * 参数：
 * - file：浏览器 File 对象。
 *
 * 返回值：boolean,true 表示可以作为引用资料处理。
 * 可能抛出的异常：无。
 */
export function isSupportedReferenceFile(file = {}) {
  return isDirectTextReferenceFile(file) || isBackendParsedReferenceFile(file);
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
 * isDirectTextReferenceFile 判断文件是否可以直接用浏览器文本 API 读取。
 *
 * 作用：
 * - txt/md/csv 本身就是文本资料,可以直接进入任务输入。
 * - 把 XLSX/PDF 这类二进制文件排除在外,避免用户拿到乱码上下文。
 *
 * 参数：
 * - file：浏览器 File 对象。
 *
 * 返回值：boolean,true 表示可以调用 file.text()。
 * 可能抛出的异常：无。
 */
function isDirectTextReferenceFile(file = {}) {
  const name = String(file?.name || '').toLowerCase();
  const type = String(file?.type || '').toLowerCase();
  const hasSupportedExtension = DIRECT_TEXT_REFERENCE_EXTENSIONS.some((extension) => name.endsWith(extension));
  const hasSupportedMimeType = type ? DIRECT_TEXT_REFERENCE_MIME_TYPES.has(type) : false;
  return hasSupportedExtension || hasSupportedMimeType;
}

/**
 * isBackendParsedReferenceFile 判断文件是否需要交给后端解析。
 *
 * 作用：
 * - XLSX 是外贸报价、产品表、客户清单里的高频资料格式。
 * - 后端用 openpyxl 抽取表格文本,前端只接收已经整理过的人类可读内容。
 *
 * 参数：
 * - file：浏览器 File 对象。
 *
 * 返回值：boolean,true 表示需要调用后端解析器。
 * 可能抛出的异常：无。
 */
function isBackendParsedReferenceFile(file = {}) {
  const name = String(file?.name || '').toLowerCase();
  const type = String(file?.type || '').toLowerCase();
  const hasSupportedExtension = BACKEND_PARSED_REFERENCE_EXTENSIONS.some((extension) => name.endsWith(extension));
  const hasSupportedMimeType = type ? BACKEND_PARSED_REFERENCE_MIME_TYPES.has(type) : false;
  return hasSupportedExtension || hasSupportedMimeType;
}

/**
 * buildReferenceFromText 把原始文本整理成安全引用资料。
 *
 * 作用：
 * - 文本文件和表格解析结果共用同一套空内容检查、截断和文件名清理。
 * - 这样前端输入框里只会出现业务资料,不会出现浏览器异常或解析器细节。
 *
 * 参数：
 * - input.name：资料名。
 * - input.rawText：原始文本或后端解析出的文本。
 * - input.emptyMessage：可选的空内容提示。
 *
 * 返回值：包含 name 和 text 的引用资料对象。
 * 可能抛出的异常：内容为空时抛出 REFERENCE_FILE_EMPTY。
 */
function buildReferenceFromText(input = {}) {
  const text = trimReferenceText(input.rawText || '');
  if (!text) {
    throw createReferenceFileError(
      'REFERENCE_FILE_EMPTY',
      input.emptyMessage || '这份资料没有读到可用文字,可以换一份文件或直接粘贴关键内容。',
    );
  }

  return {
    name: safeReferenceFileName(input.name || '未命名资料'),
    text,
  };
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
 * createUnsupportedReferenceFileError 创建不支持文件类型的统一异常。
 *
 * 参数：无。
 * 返回值：Error 实例。
 * 可能抛出的异常：无。
 */
function createUnsupportedReferenceFileError() {
  return createReferenceFileError(
    'REFERENCE_FILE_UNSUPPORTED',
    '这类文件暂时不能直接引用。请先转成 txt、md、csv 或 xlsx,也可以把关键内容粘贴到输入框。',
  );
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
