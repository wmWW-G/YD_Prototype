/* global YD_DIFY */
(function exposeOperationsWorkflow() {
  let request = null;
  let revision = 0;
  let currentReport = null;
  let currentName = '';
  let chatInputs = null;
  let chatRequest = null;
  let conversationId = '';
  let chatConfigured = false;

  /** 根据固定标签创建安全文本节点；text 不作为 HTML 执行，无主动异常。 */
  function element(tag, text = '', className = '') {
    const node = document.createElement(tag);
    node.textContent = text;
    node.className = className;
    return node;
  }

  /** 取消上一份报告请求并使过期回调失效；无参数、返回值及主动异常。 */
  function cancel() {
    revision += 1;
    request?.abort();
    request = null;
    currentReport = null;
    chatRequest?.abort();
    chatRequest = null;
    chatInputs = null;
    conversationId = '';
    chatConfigured = false;
    document.getElementById('aiChat')?.remove();
    const input = document.getElementById('aiChatInput');
    if (input) input.value = '';
    syncChatControls();
  }

  /** 根据报告、配置和请求状态更新原有追问控件；无参数、返回值及主动异常。 */
  function syncChatControls() {
    const input = document.getElementById('aiChatInput');
    const button = document.getElementById('aiChatSend');
    if (!input || !button) return;
    const ready = Boolean(currentReport && chatInputs && chatConfigured);
    input.disabled = !ready || Boolean(chatRequest);
    input.placeholder = !currentReport ? '报告生成后可继续追问' : !chatConfigured ? '报告追问暂不可用' : '针对这份报告继续追问…';
    input.setAttribute('aria-label', '报告追问');
    button.disabled = !ready;
    button.textContent = chatRequest ? '■' : '➤';
    button.setAttribute('aria-label', chatRequest ? '停止回复' : '发送追问');
    button.title = chatRequest ? '停止回复' : '发送追问';
  }

  /**
   * 在原稿 .ai-chat 区添加安全文本气泡，保留报告摘要和原来的双面板布局。
   * @param {string} role user 或 ai。
   * @param {string} text 本轮公开文本。
   * @returns {HTMLElement} 可继续填充流式文本的气泡，不解析模型 HTML。
   * @throws {Error} 无主动异常；必要 DOM 由当前页面提供。
   */
  function chatBubble(role, text) {
    let chat = document.getElementById('aiChat');
    if (!chat) {
      chat = element('div', '', 'ai-chat open'); chat.id = 'aiChat';
      const messages = element('div', '', 'ai-chat-msgs'); messages.id = 'aiChatMsgs';
      messages.setAttribute('role', 'log'); messages.setAttribute('aria-label', '报告追问记录');
      chat.append(messages); document.getElementById('aiContent').after(chat);
    }
    const row = element('div', '', `chat-msg ${role}`);
    const bubble = element('div', text, 'chat-bubble');
    row.append(element('span', role === 'user' ? '我' : '🤖', 'chat-avatar'), bubble);
    document.getElementById('aiChatMsgs').append(row);
    scrollChat();
    return bubble;
  }

  /** 将新回复滚动到原报告的对话区域；只调整内部滚动，不移动右侧面板，无主动异常。 */
  function scrollChat() {
    const messages = document.getElementById('aiChatMsgs');
    if (messages) messages.scrollTop = messages.scrollHeight;
    const body = document.querySelector('.ai-drawer-body');
    if (body) body.scrollTop = body.scrollHeight;
  }

  /**
   * 发送报告追问或停止当前回复。首次为空会话，后续沿用 Dify 返回的 conversation_id。
   * @returns {Promise<void>} 结果与错误写入原有气泡；问题、上下文只存于当前页面内存。
   * @throws {Error} 异常均转换为公开提示；关闭或切换报告后旧响应不能更新新报告。
   */
  async function sendChat() {
    if (chatRequest) { chatRequest.abort(); return; }
    const input = document.getElementById('aiChatInput');
    const query = input.value.trim();
    if (!query || !currentReport || !chatInputs || !chatConfigured) return;
    const reportId = currentReport.report_id;
    const version = revision;
    const controller = new AbortController();
    chatRequest = controller;
    chatBubble('user', query);
    const bubble = chatBubble('ai', '正在理解追问');
    input.value = '';
    syncChatControls();
    let reader, completed = false, answer = '';
    try {
      const response = await fetch('/api/operations-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ report_id: reportId, chat_inputs: chatInputs, query, conversation_id: conversationId, data_source: 'demo' })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw Object.assign(new Error(payload.message || '追问服务暂时无法连接。'), { public: true });
      }
      if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('invalid stream');
      const parser = YD_DIFY.createDifySseEventParser(event => {
        if (version !== revision || controller.signal.aborted) return;
        if (event.type === 'error') throw Object.assign(new Error(event.message), { public: true });
        if (event.type === 'session' && event.report_id === reportId) conversationId = event.conversation_id;
        if (event.type === 'progress' && !answer) bubble.textContent = event.message;
        if (event.type === 'answer_delta') { answer += event.delta; bubble.textContent = answer; }
        if (event.type === 'answer_replace') { answer = event.answer; bubble.textContent = answer; }
        if (event.type === 'done') {
          if (event.result.report_id !== reportId) throw new Error('report mismatch');
          conversationId = event.result.conversation_id;
          bubble.textContent = event.result.answer;
          completed = true;
        }
        scrollChat();
      });
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let bytes = 0;
      while (!completed) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 2 * 1024 * 1024) throw new Error('response too large');
        parser.push(decoder.decode(chunk.value, { stream: true }));
      }
      parser.push(decoder.decode()); parser.finish();
      if (!completed) throw new Error('incomplete stream');
    } catch (error) {
      if (version === revision) {
        bubble.textContent = controller.signal.aborted ? '本轮回复已停止。' :
          error.public ? error.message : '追问连接中断或回复不完整，请重试。';
        // 失败时恢复问题，避免重新输入；不把半条流式内容留作已完成的答案。
        if (!input.value) input.value = query;
      }
    } finally {
      await reader?.cancel().catch(() => {});
      if (version === revision) {
        chatRequest = null;
        syncChatControls();
        scrollChat();
      }
    }
  }

  /** 显示公开生成阶段；message 为文本，无返回值，必要 DOM 由当前页面提供。 */
  function showProgress(message) {
    document.querySelector('.ai-loading').style.display = 'flex';
    document.getElementById('aiProgress').textContent = message;
    document.getElementById('aiContent').style.display = 'none';
  }

  /**
   * 按原 HTML 的固定顺序填入四个结构化字段：name、sub、points、rows。
   * @param {object} report 服务端校验通过的报告，rows 已还原为二维字符串数组。
   * @returns {void} 更新原有报告区并启用下载；完整正文只保留在报告数据中。
   * @throws {Error} 无主动异常；不将模型提供的 HTML 插入页面。
   */
  function showReport(report) {
    currentReport = report;
    const content = document.getElementById('aiContent');
    content.replaceChildren();
    content.append(element('div', report.name, 'ai-name'));
    content.append(element('div', `${report.sub} · AI自动分析 · ${new Date().toLocaleString('zh-CN')} · 演示数据`, 'ai-sub'));
    report.points.forEach((point, index) => {
      const row = element('div', '', 'ai-point');
      const text = element('span', '', 'pt-text');
      // 原稿用 .em 标出要点开头。只识别短标题后的冒号，不解析任意 HTML/Markdown。
      const lead = point.match(/^([^：:\n]{1,16}[：:])(.*)$/s);
      if (lead) text.append(element('span', lead[1], 'em'), document.createTextNode(lead[2]));
      else text.textContent = point;
      row.append(element('span', String(index + 1), 'pt-dot'), text);
      content.append(row);
    });
    const wrap = element('div', '', 'ai-table-wrap');
    const table = element('table', '', 'report-table');
    report.rows.forEach((cells, index) => {
      // 原样式以 tr.report-th > td 定义表头，不另建 th 或新的报告组件。
      const row = element('tr', '', index === 0 ? 'report-th' : '');
      cells.forEach(cell => row.append(element('td', cell)));
      table.append(row);
    });
    wrap.append(table); content.append(wrap);
    document.querySelector('.ai-loading').style.display = 'none';
    content.style.display = 'block';
    document.getElementById('aiDownloadBtn').disabled = false;
  }

  /** 显示失败和重试入口；参数为公开消息及本次输入，清除旧报告，不主动抛出异常。 */
  function showError(message, name, context) {
    currentReport = null;
    document.querySelector('.ai-loading').style.display = 'none';
    const content = document.getElementById('aiContent');
    content.style.display = 'block';
    const error = element('div', '', 'ai-report-error');
    error.setAttribute('role', 'alert');
    error.append(element('h3', '暂未生成报告'), element('p', message));
    const retry = element('button', '重新生成', 'btn-mini primary');
    retry.addEventListener('click', () => generate(name, context));
    error.append(retry);
    content.replaceChildren(error);
    document.getElementById('aiDownloadBtn').disabled = true;
  }

  /**
   * 从当前模块提取原型演示资料。已有报表名称不是数据明细，明确告知诊断端不能推断其内容。
   * @returns {string} 最多 44000 字的页面演示文本，不读取账号、宿主页面或浏览器存储。
   * @throws {Error} 无主动异常。
   */
  function captureDemoContext() {
    const active = document.querySelector('.sub-view.active[id^="m-"]');
    return ('以下是当前模块的演示界面文本。功能描述和报表名称只是目录，并不表示已取得相应报表明细；未提供的数值、公司和产品信息不得推测。\n' + (active?.innerText || '当前没有提供店铺经营明细。')).slice(0, 44000);
  }

  /**
   * 发起一次诊断。相同功能生成中不重复扣费，切换功能会取消旧任务，旧响应不能覆盖新报告。
   * @param {string} name 用户点击的功能名称。
   * @param {string} context 当前页面的演示资料；重试保留原输入。
   * @returns {Promise<void>} 成功或错误已反映在面板内；取消不展示错误。
   * @throws {Error} 请求、流解析错误在本函数内转换成公开提示。
   */
  async function generate(name, context = captureDemoContext()) {
    if (request && currentName === name) return;
    cancel();
    currentName = name;
    const version = revision;
    const controller = new AbortController();
    request = controller;
    // 配置检查不携带凭据，并与报告生成并行；过期检查不能启用另一份报告的控件。
    fetch('/api/operations-chat', { signal: controller.signal }).then(response => response.ok ? response.json() : null)
      .then(config => { if (version === revision) { chatConfigured = Boolean(config?.configured); syncChatControls(); } })
      .catch(() => {});
    const content = document.getElementById('aiContent');
    content.replaceChildren();
    document.getElementById('aiTitle').textContent = `🤖 AI分析 · ${name}`;
    document.getElementById('aiDownloadBtn').disabled = true;
    showProgress('正在提交演示资料');
    let reader, completed = false;
    try {
      const response = await fetch('/api/operations-diagnosis', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ function_name: name, data_source: 'demo', business_context: context })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw Object.assign(new Error(payload.message || '诊断服务暂时无法连接，请稍后重试。'), { public: true });
      }
      if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('invalid stream');
      const parser = YD_DIFY.createDifySseEventParser(event => {
        if (version !== revision) return;
        if (event.type === 'progress') showProgress(event.message);
        if (event.type === 'error') throw Object.assign(new Error(event.message), { public: true });
        if (event.type === 'done') {
          chatInputs = event.result.chat_inputs;
          showReport(event.result.report); syncChatControls(); completed = true;
        }
      });
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let bytes = 0;
      while (!completed) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 2 * 1024 * 1024) throw new Error('response too large');
        parser.push(decoder.decode(chunk.value, { stream: true }));
      }
      parser.push(decoder.decode()); parser.finish();
      if (!completed && version === revision) throw new Error('incomplete stream');
    } catch (error) {
      if (!controller.signal.aborted && version === revision) {
        showError(error.public ? error.message : '诊断连接中断或结果不完整，请重新生成。', name, context);
      }
    } finally {
      await reader?.cancel().catch(() => {});
      if (version === revision) request = null;
    }
  }

  /** 下载已完成的真实报告为 Markdown；无参数、无返回值，没有有效报告时不执行。 */
  function download() {
    if (!currentReport) return;
    const report = currentReport;
    // 下载保留界面摘要及完整诊断。Markdown 的表格分隔符需要转义，避免内容错列。
    const rows = report.rows.map(row => '| ' + row.map(cell => cell.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')).join(' | ') + ' |');
    if (rows.length) rows.splice(1, 0, '| ' + report.rows[0].map(() => '---').join(' | ') + ' |');
    const sections = [
      `# ${report.name}`, '> 演示数据，仅用于验证诊断流程。', report.sub,
      '## 分析要点', report.points.map((point, index) => `${index + 1}. ${point}`).join('\n'), rows.join('\n'),
      '## 完整分析', report.conclusion, report.content_markdown,
      ...report.actions.map(action => `### ${action.priority} · ${action.target}\n\n${action.decision}\n\n${action.steps.map(item => '- ' + item).join('\n')}\n\n负责人：${action.owner}\n\n验收：${action.acceptance.join('；')}\n\n复盘：${action.review}\n\n依据：${action.evidence_ids.join('、') || '准备性建议'}`),
      '## 参考依据', report.evidence.map(item => `- ${item.id} · ${item.source}：${item.fact}`).join('\n'),
      '## 待补充资料', report.missing_data.map(item => '- ' + item).join('\n'),
      '## 后续确认', report.follow_up_questions.map(item => '- ' + item).join('\n')
    ];
    const text = sections.filter(Boolean).join('\n\n') + '\n';
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
    const link = element('a');
    link.href = url;
    link.download = `${report.name.replace(/[\\/:*?"<>|]/g, '-')}-${report.report_id.slice(-8)}.md`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  window.YD_OPERATIONS_WORKFLOW = { generate, cancel, download, sendChat };
  window.addEventListener('pagehide', cancel);
}());
