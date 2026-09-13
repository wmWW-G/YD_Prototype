/* global window, document */
/**
 * AI 作图交互原型。以批图匠的选型、模板、逐张方案确认和结果预览为参考。
 * 全部处理只发生在浏览器内；不会上传素材、请求模型或扣除额度。
 */
window.YD_IMAGE_STUDIO = (() => {
  const ASSETS = 'assets/image-studio/';
  const TYPE = { main: ['主图', 1], set: ['套图', 6], listing: ['详情图', 8], poster: ['海报', 1] };
  const MODES = { 'image-generate': '批量生图', 'image-retouch': '批量AI修图', 'image-outfit': '批量模特换装' };
  const TITLES = ['正面主视觉', '手柄细节', '杯口细节', '居家场景', '办公场景', '组合展示'];
  const MUGS = ['mug-front.jpg', 'mug-handle.jpg', 'mug-rim.jpg', 'mug-home.jpg', 'mug-office.jpg', 'mug-combo.jpg'];
  const TEMPLATES = [
    { id: 'dense', name: '高信息量商品套图', tag: '高信息量', desc: '产品全景、细节、卖点、规格、工艺与包装，完整呈现采购信息。', count: 6 },
    { id: 'minimal', name: '极简质感商品套图', tag: '简约质感', desc: '干净背景与产品近景，突出材质、造型和使用体验。', count: 6 },
    { id: 'listing', name: 'B2B采购详情图', tag: '采购决策', desc: '从产品介绍、应用场景到品质与合作，建立完整采购信任。', count: 8 }
  ];
  const sessions = {};
  let root = null;
  let mode = 'image-generate';
  let active = null;
  let toastTimer = 0;

  /** 转义用户文本。@param {unknown} value 文本。@returns {string} HTML 安全文本。不抛异常。 */
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char])); }
  /** 使用项目已有图标。@param {string} name 图标文件名。@returns {string} 图标 HTML。不抛异常。 */
  function icon(name = '16_yd_artifact') { return `<img class="studio-icon" src="assets/icons/${name}.svg" alt="">`; }
  /** 新建一个入口的会话状态。@returns {object} 可交互演示状态。不抛异常。 */
  function initial() { return { type:'set', template:'dense', ratio:'1:1', quality:'中', model:'PTJ-1', quantity:1, prompt:'', uploads:[], style:[], logo:[], outfit:[], retouch:'去水印', phase:'results', plans:[], dialog:null, selected:0, history:[], results:MUGS.map((image,i)=>({image:ASSETS+image,title:TITLES[i]})), resultMode:'image-generate', resultType:'set', resultRatio:'1:1', resultQuantity:1, resultModel:'PTJ-1', resultTime:'示例作品', progress:0 }; }
  /** 读取当前模板。@returns {object} 固定模板。不抛异常。 */
  function template() { return TEMPLATES.find(item=>item.id===active.template) || TEMPLATES[0]; }
  /** 计算本次总张数。@returns {number} 1–80 张。不抛异常。 */
  function count() { return (mode==='image-retouch' ? Math.max(1,active.uploads.length) : TYPE[active.type][1]) * active.quantity; }
  /** 显示原型反馈。@param {string} message 提示。@returns {void} 无主动异常。 */
  function toast(message) { const el=root?.querySelector('.studio-toast'); if(!el)return; el.textContent=message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2600); }
  /** 渲染选项。@param {string} name 字段名。@param {string} label 标签。@param {Array} options 选项。@returns {string} HTML。不抛异常。 */
  function select(name,label,options) { return `<label class="studio-field">${label}<select data-field="${name}" aria-label="${label}">${options.map(value=>`<option ${String(active[name])===String(value)?'selected':''}>${value}</option>`).join('')}</select></label>`; }
  /** 渲染上传区。@param {string} field 素材分组。@param {string} label 标题。@param {number} limit 上限。@returns {string} HTML。不抛异常。 */
  function upload(field,label,limit) {
    const items=active[field];
    return `<div class="studio-upload" data-drop="${field}"><div class="studio-upload-label"><strong>${label}</strong><span>${items.length}/${limit}</span></div>
      ${items.length?`<div class="studio-upload-thumbs">${items.map((item,i)=>`<div><img src="${esc(item.url)}" alt="${esc(item.name)}"><button type="button" data-remove="${field}:${i}" aria-label="移除${esc(item.name)}">×</button></div>`).join('')}</div>`:''}
      <label class="studio-dropzone">${icon()}<span><strong>${items.length?'继续添加图片':'拖拽图片到这里'}</strong><small>或点击选择 PNG、JPG、WebP</small></span><input type="file" accept="image/png,image/jpeg,image/webp" ${limit>1?'multiple':''} data-upload="${field}" aria-label="${label}"></label></div>`;
  }
  /** 渲染完整工作区。@returns {void} 无主动异常。 */
  function render() {
    if(!root?.isConnected)return;
    const working=['planning','generating'].includes(active.phase);
    const formLocked=working||active.phase==='review';
    root.innerHTML=`<div class="studio"><header class="creative-topbar"><div class="studio-heading"><span>AI作图</span><b>/</b><strong>${MODES[mode]}</strong><small>原型体验</small></div><div class="studio-top-actions"><button type="button" data-action="history">生成记录${active.history.length?` · ${active.history.length}`:''}</button><button type="button" data-action="reset">新建任务</button></div></header>
      <nav class="studio-mobile-nav" aria-label="作图工具"><a href="#/image-studio">批量生图</a><a href="#/image-studio/retouch">AI修图</a><a href="#/image-studio/outfit">模特换装</a></nav><div class="studio-workspace"><section class="studio-form" aria-label="图片生成设置"><fieldset ${formLocked?'disabled':''}>
      ${mode!=='image-retouch'?`<div class="studio-types" role="group" aria-label="图片类型">${Object.entries(TYPE).map(([id,[label,n]])=>`<button type="button" data-type="${id}" aria-pressed="${active.type===id}" class="${active.type===id?'selected':''}">${label}<small>${n}张 / 版</small></button>`).join('')}</div>`:`<div class="studio-types retouch-types" role="group" aria-label="修图操作">${['去水印','改文案','抠图'].map(label=>`<button type="button" data-retouch="${label}" aria-pressed="${active.retouch===label}" class="${active.retouch===label?'selected':''}">${label}</button>`).join('')}</div>`}
      ${mode==='image-generate'&&['set','listing'].includes(active.type)?`<div class="studio-section-head"><div><strong>生图模板</strong><small>预览整套图片的信息结构与视觉方向</small></div><button type="button" class="studio-text-btn" data-action="templates">更换模板</button></div><button type="button" class="studio-template-summary" data-action="templates"><div class="studio-template-strip">${[1,2,3].map(n=>`<img src="${ASSETS+template().id}-${n}.jpg" alt="${template().name}预览${n}">`).join('')}</div><div><strong>${template().name}</strong><span class="studio-tag">${template().tag}</span><small>${template().desc}</small></div></button><details class="studio-extra"><summary>补充模板信息（选填）</summary><label>商品名称<input data-field="product" value="${esc(active.product)}" placeholder="例如：陶瓷马克杯"></label><label>核心卖点<input data-field="selling" value="${esc(active.selling)}" placeholder="例如：哑光釉面、可定制 Logo"></label><label>目标客户<input data-field="buyers" value="${esc(active.buyers)}" placeholder="例如：礼品采购商、品牌商"></label></details>`:''}
      ${mode==='image-generate'?upload('style','参考设计图',1):''}
      ${mode==='image-outfit'?upload('outfit','更换服装图',1):''}
      <div class="studio-section-head"><strong>${mode==='image-outfit'?'模特图片':mode==='image-retouch'?'待修改图片':'商品参考图'}</strong>${mode==='image-generate'?'<button type="button" class="studio-text-btn" data-action="logo">添加 Logo</button>':''}</div>
      ${upload('uploads',mode==='image-outfit'?'上传模特图片':mode==='image-retouch'?'上传需要修改的图片':'上传商品参考图',10)}
      ${active.showLogo?upload('logo','品牌 Logo',1):''}
      <label class="studio-prompt">${mode==='image-retouch'?'修图指令':'补充文字要求（选填）'}<textarea data-field="prompt" maxlength="4000" aria-label="${mode==='image-retouch'?'修图指令':'补充文字要求'}" placeholder="${mode==='image-retouch'?'描述需要修改的区域或目标效果':mode==='image-outfit'?'保持模特姿势和五官，自然替换服装':'可补充：商品卖点、使用场景、画面风格，以及必须保留或避免的内容'}">${esc(active.prompt)}</textarea><small>图片保留在当前浏览器中</small></label>
      <div class="studio-params">${select('ratio','画面比例',['1:1','2:3','3:2','3:4','4:3','4:5','5:4','9:16','16:9'])}${select('model','生图模型',['PTJ-1','PTJ-2','PTJ-3'])}${select('quality','输出清晰度',['低','中','高'])}${select('quantity','完整方案数量',[1,2,3,4,5,6,7,8,9,10])}<p>每版 ${mode==='image-retouch'?Math.max(1,active.uploads.length):TYPE[active.type][1]} 张<strong>共 ${count()} 张</strong></p></div>
      <button type="button" class="studio-primary studio-submit" data-action="plan" ${working?'disabled':''}>${active.phase==='planning'?'正在整理逐张方案…':active.phase==='generating'?'正在生成…':'生成 Prompt'}</button><p class="studio-footnote">先确认逐张方案，再开始生成图片</p></fieldset></section>
      <section class="studio-output" aria-label="生成内容">${renderOutput()}</section></div><div class="studio-modal-root">${renderDialog()}</div><div class="studio-toast" role="status" aria-live="polite"></div></div>`;
    bind();
  }
  /** 渲染右侧方案或结果。@returns {string} HTML。不抛异常。 */
  function renderOutput() {
    if(active.phase==='planning')return `<div class="studio-empty"><span class="studio-spinner"></span><h2>正在整理图片方案</h2><p>根据图片类型和补充要求，拆分每张图的内容。</p></div>`;
    if(active.phase==='review')return `<div class="studio-result-panel"><div class="studio-result-head"><div><span class="studio-eyebrow">PROMPT REVIEW</span><h2>确认每张图片的生成方案</h2><p>${active.quantity} 版 · 共 ${active.plans.length} 张，可以逐张修改</p></div></div><ol class="studio-plan-list">${active.plans.map((plan,i)=>`<li><div class="studio-plan-title"><span>${String(i+1).padStart(2,'0')}</span><strong>第 ${plan.variant} 版 · ${plan.title}</strong><button type="button" class="studio-text-btn" data-edit="${i}">${plan.edit?'收起':'修改方案'}</button></div><p>${esc(plan.prompt)}</p>${plan.edit?`<label class="studio-feedback">修改意见<textarea data-feedback="${i}" aria-label="第${i+1}张修改意见" placeholder="例如：背景改为浅灰色，增加材质特写">${esc(plan.feedback)}</textarea></label><button type="button" class="studio-secondary" data-refine="${i}">更新这一张方案</button>`:''}</li>`).join('')}</ol><div class="studio-review-footer"><button type="button" class="studio-secondary" data-action="back-settings">返回调整设置</button><button type="button" class="studio-primary" data-action="generate">确认方案，开始生成 ${active.plans.length} 张</button></div></div>`;
    if(active.phase==='generating')return `<div class="studio-result-panel"><div class="studio-result-head"><h2>正在生成图片</h2><span>${active.progress}/${active.plans.length}</span></div><div class="studio-progress"><span style="width:${active.progress/active.plans.length*100}%"></span></div><div class="studio-results">${active.plans.map((p,i)=>`<div class="studio-generating-tile">${i<active.progress?`<img src="${resultImage(i)}" alt="${p.title}">`:'<span class="studio-spinner"></span>'}<small>${p.title}</small></div>`).join('')}</div></div>`;
    if(!active.results.length)return `<div class="studio-empty">${icon()}<h2>把商品想法，变成一组好图</h2><p>选择图片类型，添加素材或文字要求。<br>逐张确认后，图片会出现在这里。</p><button type="button" class="studio-secondary" data-action="example">查看示例作品</button></div>`;
    return `<div class="studio-result-panel"><div class="studio-result-head"><h2>生成记录</h2><span class="studio-success">${active.resultTime==='示例作品'?'示例作品':'已完成'}</span><span class="studio-demo-label">演示结果</span></div><div class="studio-result-info"><strong>${active.resultMode==='image-retouch'?active.retouch:TYPE[active.resultType][0]} · ${active.results.length} 张</strong><p>生成时间 <span>${active.resultTime}</span>　模型 <span>${active.resultModel}</span>　尺寸 <span>${active.resultRatio}</span></p></div><div class="studio-results">${active.results.map((item,i)=>`<button type="button" data-preview="${i}" aria-label="预览${item.title}"><img src="${esc(item.image)}" alt="${esc(item.title)}"><span>${esc(item.title)}</span></button>`).join('')}</div><div class="studio-result-footer"><button type="button" class="studio-primary" data-action="download">全部下载</button></div></div>`;
  }
  /** 渲染弹层。@returns {string} 模板、历史或大图。不抛异常。 */
  function renderDialog() {
    if(!active.dialog)return '';
    if(active.dialog==='preview') { const item=active.results[active.selected]; return `<div class="studio-overlay" data-dismiss="true"><section class="studio-lightbox" role="dialog" aria-modal="true" aria-label="图片预览"><header><strong>${esc(item.title)}</strong><button type="button" data-action="close" aria-label="关闭预览">×</button></header><img src="${esc(item.image)}" alt="${esc(item.title)}"><footer><button type="button" data-action="previous" aria-label="上一张">上一张</button><span>${active.selected+1} / ${active.results.length}</span><button type="button" data-action="next" aria-label="下一张">下一张</button><button type="button" class="studio-primary" data-action="download-one">下载图片</button></footer></section></div>`; }
    if(active.dialog==='history')return `<div class="studio-overlay" data-dismiss="true"><section class="studio-library" role="dialog" aria-modal="true" aria-label="生成记录"><header><div><h2>生成记录</h2><p>当前页面中的作图任务</p></div><button type="button" data-action="close" aria-label="关闭生成记录">×</button></header><div class="studio-history-list">${active.history.length?active.history.map((item,i)=>`<button type="button" data-history="${i}"><img src="${esc(item.results[0].image)}" alt=""><div><strong>${MODES[mode]} · ${item.results.length} 张</strong><small>${item.resultTime}</small></div><span>查看</span></button>`).join(''):'<p class="studio-history-empty">还没有生成记录，完成第一组图片后会保存在这里。</p>'}</div></section></div>`;
    return `<div class="studio-overlay" data-dismiss="true"><section class="studio-library" role="dialog" aria-modal="true" aria-label="选择生图模板"><header><div><h2>选择生图模板</h2><p>先看整套内容，再选择适合商品的表达方式</p></div><button type="button" data-action="close" aria-label="关闭模板选择">×</button></header><div class="studio-library-body">${TEMPLATES.filter(item=>active.type==='listing'?item.id==='listing':item.id!=='listing').map(item=>`<article><div class="studio-library-title"><div><h3>${item.name}</h3><p>${item.desc}</p></div><button type="button" class="${active.template===item.id?'studio-secondary':'studio-primary'}" data-template="${item.id}">${active.template===item.id?'使用当前模板':'使用此模板'}</button></div><div class="studio-template-grid">${Array.from({length:item.count},(_,i)=>`<img src="${ASSETS+item.id}-${i+1}.jpg" alt="${item.name}第${i+1}张">`).join('')}</div></article>`).join('')}</div></section></div>`;
  }
  /** 只读参考素材，不做生成请求。@param {number} i 结果序号。@returns {string} 本地图片地址。不抛异常。 */
  function resultImage(i, currentMode=mode) { return ASSETS+(currentMode==='image-retouch'?'cat-cutout.svg':currentMode==='image-outfit'?'outfit-result.svg':MUGS[i%MUGS.length]); }
  /** 拆分逐张演示方案。@returns {void} 无主动异常。 */
  function plan() {
    if(mode==='image-retouch'&&!active.uploads.length) { toast('请先添加需要修改的图片'); return; }
    if(mode==='image-outfit'&&(!active.uploads.length||!active.outfit.length)) { toast('请先添加服装图和模特图片'); return; }
    if(mode==='image-generate'&&!active.uploads.length&&!active.prompt.trim()&&!active.product) { toast('请添加商品图片，或填写商品和画面要求'); root.querySelector('[data-field="prompt"]').focus(); return; }
    const session=active, currentMode=mode;
    active.phase='planning'; render();
    setTimeout(()=> {
      const per=currentMode==='image-retouch'?Math.max(1,session.uploads.length):TYPE[session.type][1];
      const purpose=currentMode==='image-retouch'?`执行${session.retouch}，仅修改指定区域，保持其他画面不变。`:currentMode==='image-outfit'?'把服装参考图中的服装自然替换到模特身上，保持姿态、五官与背景一致。':'';
      const titles=session.type==='listing'?['产品介绍','结构与细节','核心卖点','应用场景','规格选择','工艺与定制','品质保障','包装与合作']:session.type==='main'?['产品主图']:session.type==='poster'?['营销海报']:TITLES;
      session.plans=Array.from({length:per*session.quantity},(_,i)=>({variant:Math.floor(i/per)+1,title:currentMode==='image-retouch'?`${session.retouch} · 第 ${i%per+1} 张`:titles[i%titles.length],prompt:`${purpose}${session.product||'参考素材中的商品'}，${currentMode==='image-generate'?titles[i%titles.length]:'保持原图构图'}。保持主体造型、颜色与材质一致，${session.ratio}构图，${session.quality}清晰度。${session.selling?'突出 '+session.selling+'。':''}${session.buyers?'面向 '+session.buyers+'。':''}${session.prompt||'使用自然光与干净背景，突出主体。'}`,edit:false,feedback:''}));
      session.phase='review'; if(active===session)render();
      console.info('[yingdan-image-studio] 逐张方案已就绪', {count:session.plans.length});
    },700);
  }
  /** 播放本地结果出现过程。@returns {void} 无主动异常。 */
  function generate() {
    const session=active, currentMode=mode;
    session.phase='generating'; session.progress=0; render();
    const timer=setInterval(()=> {
      session.progress=Math.min(session.plans.length,session.progress+Math.max(1,Math.ceil(session.plans.length/6)));
      if(session.progress===session.plans.length) {
        clearInterval(timer);
        session.results=session.plans.map((item,i)=>({title:item.title,image:resultImage(i,currentMode)}));
        session.resultMode=currentMode; session.resultType=session.type; session.resultRatio=session.ratio; session.resultQuantity=session.quantity; session.resultModel=session.model; session.resultTime=new Date().toLocaleString('zh-CN');
        session.phase='results';
        const record={results:session.results.map(item=>({...item})),resultMode:session.resultMode,resultType:session.resultType,resultRatio:session.resultRatio,resultQuantity:session.resultQuantity,resultModel:session.resultModel,resultTime:session.resultTime};
        session.history.unshift(record);
        console.info('[yingdan-image-studio] 演示任务完成', {count:session.results.length});
      }
      if(active===session)render();
    },350);
  }
  /** 导入本地素材。@param {string} field 素材分组。@param {FileList|Array<File>} files 图片。@returns {Promise<void>} 失败显示反馈，不传播异常。 */
  async function addFiles(field,files) {
    const session=active, limit=field==='uploads'?10:1;
    const imageFiles=Array.from(files).filter(file=>['image/png','image/jpeg','image/webp'].includes(file.type));
    if(!imageFiles.length){toast('请选择 PNG、JPG 或 WebP 图片');return;}
    if(imageFiles.some(file=>file.size>10*1024*1024)){toast('单张图片请控制在 10 MB 以内');return;}
    if(limit===1)session[field]=[];
    const available=limit-session[field].length;
    try {
      for(const file of imageFiles.slice(0,available)) {
        const url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
        session[field].push({name:file.name,url});
      }
      if(active===session) { render(); if(imageFiles.length>available)toast(`最多保留 ${limit} 张图片`); }
    }catch(error){console.warn('[yingdan-image-studio] 本地图片读取失败');toast('图片读取失败，请重试');}
  }
  /** 弹层关闭并恢复焦点。@returns {void} 无主动异常。 */
  function closeDialog(){const previous=active.dialog;active.dialog=null;render();root.querySelector(previous==='preview'?`[data-preview="${active.selected}"]`:previous==='history'?'[data-action="history"]':'[data-action="templates"]')?.focus();}
  /** 按键及按钮动作分发。@param {string} action 固定动作标识。@returns {void} 无主动异常。 */
  function action(action) {
    if(action==='plan')return plan();
    if(action==='generate')return generate();
    if(action==='close')return closeDialog();
    if(action==='reset'){if(['planning','generating'].includes(active.phase))return toast('当前任务完成后可以新建');const history=active.history;active=initial();active.results=[];active.phase='empty';active.history=history;sessions[mode]=active;}
    if(action==='back-settings')active.phase=active.results.length?'results':'empty';
    if(action==='templates')active.dialog='templates';
    if(action==='history')active.dialog='history';
    if(action==='logo')active.showLogo=!active.showLogo;
    if(action==='example'){active.results=initial().results;active.resultTime='示例作品';active.phase='results';}
    if(action==='previous')active.selected=(active.selected-1+active.results.length)%active.results.length;
    if(action==='next')active.selected=(active.selected+1)%active.results.length;
    if(action==='download'||action==='download-one')return toast('下载操作已演示，当前结果为示例图片');
    render();
  }
  /** 绑定当前渲染节点上的表单和弹层事件。@returns {void} 无主动异常。 */
  function bind() {
    root.querySelectorAll('[data-action]').forEach(el=>el.onclick=()=>action(el.dataset.action));
    root.querySelectorAll('[data-field]').forEach(el=>el.oninput=()=>{active[el.dataset.field]=el.dataset.field==='quantity'?Number(el.value):el.value;if(el.tagName==='SELECT')render();});
    root.querySelectorAll('[data-type]').forEach(el=>el.onclick=()=>{active.type=el.dataset.type;active.template=active.type==='listing'?'listing':active.template==='listing'?'dense':active.template;active.phase=active.results.length?'results':'empty';render();});
    root.querySelectorAll('[data-retouch]').forEach(el=>el.onclick=()=>{active.retouch=el.dataset.retouch;render();});
    root.querySelectorAll('[data-template]').forEach(el=>el.onclick=()=>{active.template=el.dataset.template;active.dialog=null;render();});
    root.querySelectorAll('[data-preview]').forEach(el=>el.onclick=()=>{active.selected=Number(el.dataset.preview);active.dialog='preview';render();});
    root.querySelectorAll('[data-edit]').forEach(el=>el.onclick=()=>{const plan=active.plans[Number(el.dataset.edit)];plan.edit=!plan.edit;render();});
    root.querySelectorAll('[data-feedback]').forEach(el=>el.oninput=()=>{active.plans[Number(el.dataset.feedback)].feedback=el.value;});
    root.querySelectorAll('[data-refine]').forEach(el=>el.onclick=()=>{const plan=active.plans[Number(el.dataset.refine)];if(!plan.feedback.trim())return toast('请填写这一张的修改意见');plan.prompt=plan.prompt.replace(/\n调整要求：[\s\S]*$/,'')+'\n调整要求：'+plan.feedback;plan.edit=false;render();toast('这一张的生成方案已更新');});
    root.querySelectorAll('[data-upload]').forEach(el=>el.onchange=()=>void addFiles(el.dataset.upload,el.files));
    root.querySelectorAll('[data-remove]').forEach(el=>el.onclick=()=>{const [field,i]=el.dataset.remove.split(':');active[field].splice(Number(i),1);render();});
    root.querySelectorAll('[data-drop]').forEach(el=>{el.ondragover=event=>{event.preventDefault();el.classList.add('drag-over');};el.ondragleave=()=>el.classList.remove('drag-over');el.ondrop=event=>{event.preventDefault();void addFiles(el.dataset.drop,event.dataTransfer.files);};});
    root.querySelectorAll('[data-history]').forEach(el=>el.onclick=()=>{Object.assign(active,active.history[Number(el.dataset.history)]);active.phase='results';active.dialog=null;render();});
    const overlay=root.querySelector('.studio-overlay');if(overlay)overlay.onclick=event=>{if(event.target===overlay)closeDialog();};
    root.onpaste=event=>{if(event.clipboardData?.files.length){event.preventDefault();void addFiles('uploads',event.clipboardData.files);}};
    root.onkeydown=event=>{if(!active.dialog)return;if(event.key==='Escape')closeDialog();if(active.dialog==='preview'&&event.key==='ArrowLeft')action('previous');if(active.dialog==='preview'&&event.key==='ArrowRight')action('next');if(event.key==='Tab'){const targets=[...root.querySelectorAll('[role="dialog"] button, [role="dialog"] input')];const first=targets[0],last=targets.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};
    if(active.dialog)root.querySelector('[role="dialog"] button')?.focus();
  }
  /** 挂载入口。@param {HTMLElement} element 宿主。@param {string} selectedMode 路由业务 ID。@returns {void} 缺少宿主时抛 Error。 */
  function mount(element,selectedMode){if(!element)throw new Error('缺少 AI 作图容器');root=element;mode=selectedMode;active=sessions[mode]||(sessions[mode]=initial());if(mode!=='image-generate'&&active.resultTime==='示例作品'&&active.phase==='results'){active.results=[];active.phase='empty';}render();console.info('[yingdan-image-studio] 页面已加载',{mode});}
  return {mount};
})();
