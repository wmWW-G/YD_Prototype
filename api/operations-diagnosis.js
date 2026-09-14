const { buildInputs, runWorkflow } = require('../lib/operations-workflow');
const { buildChatRequest, runChat } = require('../lib/operations-chat');
const { sendJson, startSse, sendSseEvent } = require('../lib/dify-http');

/**
 * 创建运营诊断 API，供本地 Node 服务及后续受控部署复用。
 * @param {object} options 服务端环境变量、可注入请求实现、运维日志器；kind=chat 时处理报告追问。
 * @returns {Function} 接收 req/res 的异步处理函数。
 * @throws {Error} 创建不主动抛错；请求错误会转成安全 JSON/SSE。
 */
function createOperationsHandler({ env = process.env, fetchImpl = fetch, logger = console, kind = 'diagnosis' } = {}) {
  const isChat = kind === 'chat';
  const apiKey = isChat ? env.DIFY_OPERATIONS_CHATFLOW_API_KEY : env.DIFY_OPERATIONS_WORKFLOW_API_KEY;
  const label = isChat ? '报告追问' : '诊断';
  const logPrefix = isChat ? '[operations-chat]' : '[operations-workflow]';
  return async function operationsDiagnosis(req, res) {
    // 仅同源调用，防止其他网站借用本地已保存的 Key 发起付费请求。
    const origin = req.headers?.origin;
    const expected = new Set(String(env.OPERATIONS_ALLOWED_ORIGINS || '').split(',').filter(Boolean));
    if ((origin && !expected.has(origin)) || req.headers?.['sec-fetch-site'] === 'cross-site') {
      sendJson(res, 403, { message: '当前页面无权使用诊断服务。' }); return;
    }
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'GET') {
      sendJson(res, 200, { configured: Boolean(apiKey), data_source: 'demo' }); return;
    }
    if (req.method !== 'POST') { sendJson(res, 405, { message: '不支持此请求方式。' }); return; }
    const controller = new AbortController();
    const onClose = () => { if (!res.writableEnded) controller.abort(); };
    res.on?.('close', onClose);
    let streaming = false, heartbeat;
    try {
      const inputs = isChat ? buildChatRequest(req.body) : buildInputs(req.body);
      if (!apiKey) {
        sendJson(res, 409, { message: `${label}服务尚未配置，请联系管理员。` }); return;
      }
      logger.info(`${logPrefix} started`, { reportId: inputs.report_id, module: isChat ? inputs.inputs.module : inputs.module, function: inputs.function_name, continuation: isChat ? Boolean(inputs.conversation_id) : undefined });
      startSse(res); streaming = true;
      heartbeat = setInterval(() => { if (!res.destroyed && !res.writableEnded) res.write(': heartbeat\n\n'); }, 15000);
      const result = await (isChat ? runChat : runWorkflow)({
        apiKey, inputs, request: inputs, signal: controller.signal, fetchImpl, logger,
        onEvent: event => { if (!res.destroyed && !res.writableEnded) sendSseEvent(res, event); }
      });
      logger.info(`${logPrefix} completed`, { reportId: inputs.report_id, runId: result.workflow_run_id, conversationId: result.conversation_id, messageId: result.message_id });
    } catch (error) {
      logger.error(`${logPrefix} ended without result`, { code: error.code || error.name });
      if (!res.destroyed && !res.writableEnded) {
        const message = error.name === 'TimeoutError' ? `${label}等待超时，请稍后重试。` :
          error.public ? error.message : `${label}暂时无法完成，请稍后重试。`;
        if (streaming) sendSseEvent(res, { type: 'error', message });
        else sendJson(res, error.status || 502, { message });
      }
    } finally {
      clearInterval(heartbeat);
      res.off?.('close', onClose);
      if (!res.destroyed && !res.writableEnded) res.end();
    }
  };
}

module.exports = createOperationsHandler();
module.exports.createOperationsHandler = createOperationsHandler;
