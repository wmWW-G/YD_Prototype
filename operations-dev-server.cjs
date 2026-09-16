const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createOperationsHandler } = require('./api/operations-diagnosis');
const { createImageStudioHandler } = require('./api/image-studio');
const { sendJson } = require('./lib/dify-http');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

/**
 * 读取一次钥匙串；凭据仅留在服务端进程内存。无凭据时仍可浏览原型。
 * @param {string} kind chat 读取追问凭据，其余读取首次诊断凭据。
 * @returns {string} 环境变量或 macOS 钥匙串中的 Key，未配置返回空串。
 * @throws {Error} 不向外抛出钥匙串错误，避免命令输出泄露凭据。
 */
function readOperationsKey(kind) {
  const isChat = kind === 'chat';
  const envKey = isChat ? 'DIFY_OPERATIONS_CHATFLOW_API_KEY' : 'DIFY_OPERATIONS_WORKFLOW_API_KEY';
  if (process.env[envKey]) return process.env[envKey];
  try {
    return execFileSync('/usr/bin/security', ['find-generic-password', '-a', isChat ? 'report-followup' : 'first-diagnosis', '-s', `com.yingdan.prototype.operations-advisor.${isChat ? 'chatflow' : 'workflow'}`, '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000 }).trim();
  } catch { return ''; }
}

/**
 * 创建只提供原型静态资源和运营诊断接口的本地服务器，不公开仓库及服务端源文件。
 * @param {object} options 根目录、监听端口、独立的 apiKey/chatApiKey、测试请求实现及安全日志器。
 * @returns {http.Server} 尚未监听的服务器，调用方负责 listen/close。
 * @throws {Error} 根目录无效时抛出；单次请求错误转换为安全响应。
 */
function createOperationsServer({ root = __dirname, port = 8895, apiKey = '', chatApiKey = '', fetchImpl = fetch, logger = console, imageEnv = process.env } = {}) {
  const realRoot = fs.realpathSync(root);
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const handlerOptions = { env: {
    DIFY_OPERATIONS_WORKFLOW_API_KEY: apiKey,
    DIFY_OPERATIONS_CHATFLOW_API_KEY: chatApiKey,
    OPERATIONS_ALLOWED_ORIGINS: `http://127.0.0.1:${port},http://localhost:${port}`
  }, fetchImpl, logger };
  const handler = createOperationsHandler(handlerOptions);
  const imageHandler = createImageStudioHandler({ env: { ...imageEnv, IMAGE_STUDIO_ALLOWED_ORIGINS: `http://127.0.0.1:${port},http://localhost:${port}` }, fetchImpl, logger });
  const chatHandler = createOperationsHandler({ ...handlerOptions, kind: 'chat' });
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!allowedHosts.has(req.headers.host)) { sendJson(res, 403, { message: '不允许此访问地址。' }); return; }
    try {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (['/api/operations-diagnosis', '/api/operations-chat', '/api/image-studio'].includes(urlPath)) {
        const isChat = urlPath === '/api/operations-chat';
        const isImage = urlPath === '/api/image-studio';
        if (req.method === 'POST') {
          if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) {
            sendJson(res, 415, { message: '请使用 JSON 提交诊断资料。' }); return;
          }
          const chunks = [];
          let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > (isImage ? 15*1024*1024 : isChat ? 400000 : 200000)) { sendJson(res, 413, { message: '诊断资料过大，请精简后重试。' }); return; }
            chunks.push(chunk);
          }
          try { req.body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
          catch { sendJson(res, 400, { message: '诊断资料格式无效。' }); return; }
        }
        await (isImage ? imageHandler : isChat ? chatHandler : handler)(req, res); return;
      }
      if (!['GET', 'HEAD'].includes(req.method)) { sendJson(res, 405, { message: '不支持此请求方式。' }); return; }
      const relative = urlPath === '/' ? 'index.html' : urlPath.slice(1);
      // 只公开页面依赖；.env、日志、API 源码和符号链接指向的外部文件均不可下载。
      const parts = relative.split('/');
      const permitted = relative === 'index.html' || /^(src|assets)\//.test(relative) || relative.startsWith('prototypes/operations-advisor/');
      const ext = path.extname(relative).toLowerCase();
      if (!permitted || parts.some(part => part.startsWith('.')) || !MIME[ext] || relative.includes('\\')) {
        sendJson(res, 404, { message: '页面不存在。' }); return;
      }
      const file = await fs.promises.realpath(path.join(realRoot, relative));
      if (!file.startsWith(realRoot + path.sep) || !(await fs.promises.stat(file)).isFile()) {
        sendJson(res, 404, { message: '页面不存在。' }); return;
      }
      const bytes = await fs.promises.readFile(file);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', MIME[ext] + (['.html', '.js', '.css', '.json'].includes(ext) ? '; charset=utf-8' : ''));
      res.setHeader('Content-Length', bytes.length);
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      if (!res.headersSent) sendJson(res, error.code === 'ENOENT' ? 404 : 400, { message: '无法读取此请求。' });
      else res.end();
    }
  });
}

if (require.main === module) {
  // 本地凭据仅由Node读取；静态白名单禁止下载.env。现有环境变量优先。
  const localEnv = path.join(__dirname, '.env.image-studio.local');
  if (fs.existsSync(localEnv)) {
    for (const [name, value] of Object.entries(require('node:util').parseEnv(fs.readFileSync(localEnv, 'utf8')))) {
      if (/^DIFY_IMAGE_(MAIN|SET|LISTING|EDIT|SIMILAR)_API_KEY$/.test(name) && !process.env[name]) process.env[name] = value;
    }
  }
  const port = Number(process.env.OPERATIONS_PORT || 8895);
  const directory = path.join(__dirname, 'output/operations-advisor');
  fs.mkdirSync(directory, { recursive: true });
  const logFile = path.join(directory, 'local-server.log');
  /** 记录阶段和错误分类，不记录用户资料或 Key；文件写入异常只提示日志不可用。 */
  const writeLog = (message, fields = {}) => {
    const line = JSON.stringify({ time: new Date().toISOString(), message, ...fields });
    console.info(line);
    try { fs.appendFileSync(logFile, line + '\n'); } catch { console.error('运营诊断日志暂时不可写入'); }
  };
  const server = createOperationsServer({ port, apiKey: readOperationsKey('workflow'), chatApiKey: readOperationsKey('chat'), logger: { info: writeLog, error: writeLog } });
  server.listen(port, '127.0.0.1', () => writeLog('运营顾问本地服务已启动', { port }));
  server.on('error', error => { writeLog('运营顾问本地服务启动失败', { code: error.code }); process.exitCode = 1; });
}

module.exports = { createOperationsServer };
