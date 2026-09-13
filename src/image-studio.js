/* global window, document */
/**
 * AI 作图交互原型。以批图匠的选型、模板、逐张方案确认和结果预览为参考。
 * 全部处理只发生在浏览器内；不会上传素材、请求模型或扣除额度。
 */
window.YD_IMAGE_STUDIO = (() => {
  const ASSETS = 'assets/image-studio/';
  const TYPE = { main: ['主图', 1], set: ['套图', 6], listing: ['详情图', 8], poster: ['海报', 1] };
  // 每种产物有独立的路由与会话；类型由入口确定，避免切换菜单时串用设置或结果。
  const GENERATION_TYPES = { 'image-main': 'main', 'image-set': 'set', 'image-listing': 'listing', 'image-poster': 'poster' };
  const MODES = { 'image-main': '主图', 'image-set': '套图', 'image-listing': '详情图', 'image-poster': '海报', 'image-retouch': '批量AI修图', 'image-outfit': '批量模特换装' };
  const TITLES = ['正面主视觉', '手柄细节', '杯口细节', '居家场景', '办公场景', '组合展示'];
  const MUGS = ['mug-front.jpg', 'mug-handle.jpg', 'mug-rim.jpg', 'mug-home.jpg', 'mug-office.jpg', 'mug-combo.jpg'];
  const STUDIO_PHOTO = 'mug-studio-main.png';
  // 用跨行业的展示目的定义方向，避免用某一类商品的图片代表所有行业。
  const VISUAL_DIRECTIONS = [
    {name:'简洁展示', desc:'干净背景，完整突出商品外观'},
    {name:'场景应用', desc:'呈现商品的实际使用环境'},
    {name:'质感展示', desc:'突出材质、工艺与细节'},
    {name:'创意表达', desc:'运用色彩、道具增强吸引力'}
  ];
  const INFO_DIRECTION = {name:'附带信息', desc:'在商品画面中加入简短文字信息'};
  // 副图按展示用途定义；默认组合不依赖额外参数，规格图由用户主动选择并填写。
  const SET_ROLES = [
    {id:'main',name:'商品全貌',hint:'完整清楚地呈现商品主体',image:STUDIO_PHOTO},
    {id:'selling',name:'核心卖点',hint:'填写希望突出的特点或需要展示的文字',image:'mug-front.jpg'},
    {id:'detail',name:'细节展示',hint:'指定需要突出的材质、结构或工艺',image:'mug-handle.jpg'},
    {id:'scene',name:'应用场景',hint:'描述商品的使用环境或使用方式',image:'mug-home.jpg'},
    {id:'angle',name:'其他角度',hint:'补充希望展示的角度或部位',image:'mug-rim.jpg'},
    {id:'bundle',name:'组合展示',hint:'说明需要一起展示的商品或配件',image:'mug-combo.jpg'},
    {id:'spec',name:'规格信息',hint:'填写实际尺寸、容量等参数及单位',image:'mug-front.jpg'},
    {id:'packaging',name:'包装展示',hint:'补充需要展示的包装形式和信息',image:'mug-combo.jpg'}
  ];
  // 详情页按阅读顺序组织内容；规格只使用用户提供的数据，不从示例素材推断。
  const LISTING_ROLES = [
    {id:'intro',name:'产品介绍',hint:'介绍商品名称、用途及定位',image:STUDIO_PHOTO},
    {id:'detail',name:'结构与细节',hint:'指出需要展示的结构、材质或部位',image:'mug-handle.jpg'},
    {id:'selling',name:'核心卖点',hint:'填写希望突出的特点或需要展示的文字',image:'mug-front.jpg'},
    {id:'scene',name:'应用场景',hint:'说明商品的使用环境与使用方式',image:'mug-home.jpg'},
    {id:'spec',name:'规格选择',hint:'填写实际尺寸、容量、型号等参数及单位',image:'mug-rim.jpg'},
    {id:'craft',name:'工艺与定制',hint:'补充实际工艺或可提供的定制项目',image:'mug-handle.jpg'},
    {id:'quality',name:'品质保障',hint:'填写已确认的质检、认证或售后信息',image:'mug-front.jpg'},
    {id:'packaging',name:'包装与合作',hint:'说明实际包装方式与合作信息',image:'mug-combo.jpg'}
  ];
  const TEMPLATES = [
    { id: 'dense', name: '高信息量商品套图', tag: '高信息量', desc: '产品全景、细节、卖点、规格、工艺与包装，完整呈现采购信息。', count: 6 },
    { id: 'minimal', name: '极简质感商品套图', tag: '简约质感', desc: '干净背景与产品近景，突出材质、造型和使用体验。', count: 6 },
    { id: 'listing', name: 'B2B采购详情图', tag: '采购决策', desc: '从产品介绍、应用场景到品质与合作，建立完整采购信任。', count: 8 }
  ];
  const sessions = {};
  let root = null;
  let mode = 'image-main';
  let active = null;
  let toastTimer = 0;
  let recordSequence = 0;

  /** 转义用户文本。@param {unknown} value 文本。@returns {string} HTML 安全文本。不抛异常。 */
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char])); }
  /** 使用项目已有图标。@param {string} name 图标文件名。@returns {string} 图标 HTML。不抛异常。 */
  function icon(name = '16_yd_artifact') { return `<img class="studio-icon" src="assets/icons/${name}.svg" alt="">`; }
  /** 取得逐张内容标题。@param {string} type 图片类型。@returns {string[]} 对应的一版标题。不抛异常。 */
  function imageTitles(type) { return type==='listing'?['产品介绍','结构与细节','核心卖点','应用场景','规格选择','工艺与定制','品质保障','包装与合作']:type==='main'?['产品主图']:type==='poster'?['营销海报']:TITLES; }
  /** 判断是否共用整套工作台，显式参数用于异步任务，避免切换入口后串用设置。@param {string} selectedMode 入口 ID。@returns {boolean} 是否为套图或详情图。不抛异常。 */
  function isSuiteMode(selectedMode=mode) { return ['image-set','image-listing'].includes(selectedMode); }
  /** 取得当前图片类型可选的内容用途。@param {string} type 产物类型。@returns {object[]} 固定用途定义。不抛异常。 */
  function suiteRoles(type=active.type) { return type==='listing'?LISTING_ROLES:SET_ROLES; }
  /** 按业务类型标注图片，详情图使用阅读序号，套图区分主副图。@param {string} type 产物类型。@param {string} role 图位用途。@param {number} index 本套内零基序号，套图第 0 张为主图。@returns {string} 图片标记。不抛异常。 */
  function suiteImageLabel(type,role,index) { return type==='listing'?`详情 ${index+1}`:role==='main'?'主图':`副图 ${index}`; }
  /** 新建当前入口的会话。@returns {object} 类型、模板和示例张数与入口一致的状态。不抛异常。 */
  function initial() {
    const type=GENERATION_TYPES[mode]||'set';
    const titles=imageTitles(type);
    const generation=Boolean(GENERATION_TYPES[mode]);
    const session={ type, template:type==='listing'?'listing':'dense', visualStyle:'简洁展示', ratio:'1:1', quality:'中', model:'PTJ-1', quantity:1, prompt:generation?'米白背景，自然光，突出陶瓷质感':'', uploads:generation?[{name:'示例商品',url:ASSETS+STUDIO_PHOTO,sample:true}]:[], style:[], logo:[], outfit:[], retouch:'去水印', phase:'results', plans:[], dialog:null, settingsOpen:false, structureOpen:false, productInfoOpen:false, selected:0, history:[], results:titles.map((title,i)=>({image:resultImage(i),title})), resultMode:mode, resultType:type, resultRatio:'1:1', resultQuantity:1, resultModel:'PTJ-1', resultTime:'示例作品', resultCreatedAt:Date.now(), resultId:'sample-'+mode, progress:0 };
    session.attachedInfo='';
    if(isSuiteMode()) {
      session.setSlots=(type==='listing'?LISTING_ROLES:SET_ROLES.slice(0,6)).map((role,index)=>({id:type==='listing'?'detail-'+(index+1):index?'secondary-'+index:'main',role:role.id,brief:''}));
      session.setSlotSequence=session.setSlots.length;session.setContentOpen=false;session.setNotesOpen={};
      session.results=setExampleImages(session);
    }
    session.resultContext=copyGenerationContext(session);
    return session;
  }
  /** 读取当前模板。@returns {object} 固定模板。不抛异常。 */
  function template() { return TEMPLATES.find(item=>item.id===active.template) || TEMPLATES[0]; }
  /** 计算本次总张数；套图和详情图每次只生成一套，其他入口保留原数量规则。@returns {number} 本次输出张数。不抛异常。 */
  function count() { return isSuiteMode()?active.setSlots.length:(mode==='image-retouch'?Math.max(1,active.uploads.length):TYPE[active.type][1])*active.quantity; }
  /** 显示原型反馈。@param {string} message 提示。@returns {void} 无主动异常。 */
  function toast(message) { const el=root?.querySelector('.studio-toast'); if(!el)return; el.textContent=message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2600); }
  /** 渲染选项。@param {string} name 字段名。@param {string} label 标签。@param {Array} options 选项。@returns {string} HTML。不抛异常。 */
  function select(name,label,options) { return `<label class="studio-field">${label}<select data-field="${name}" aria-label="${label}">${options.map(value=>`<option ${String(active[name])===String(value)?'selected':''}>${value}</option>`).join('')}</select></label>`; }
  /** 渲染上传区。@param {string} field 素材分组。@param {string} label 标题。@param {number} limit 上限。@returns {string} HTML。不抛异常。 */
  function upload(field,label,limit) {
    const items=active[field];
    return `<div class="studio-upload" data-drop="${field}"><div class="studio-upload-label"><strong>${label}</strong><span>${items.length}/${limit}</span></div>
      ${items.length?`<div class="studio-upload-thumbs">${items.map((item,i)=>`<div><img src="${esc(item.url)}" alt="${esc(item.name)}"><button type="button" data-remove="${field}:${i}" aria-label="移除${esc(item.name)}">×</button></div>`).join('')}</div>`:''}
      <label class="studio-dropzone">${icon()}<span><strong>${items.length?(field==='style'?'更换参考图':'继续添加图片'):'拖拽图片到这里'}</strong><small>或点击选择 PNG、JPG、WebP</small></span><input type="file" accept="image/png,image/jpeg,image/webp" ${limit>1?'multiple':''} data-upload="${field}" aria-label="${label}"></label></div>`;
  }
  /** 渲染完整工作区。@returns {void} 无主动异常。 */
  function render() {
    if(!root?.isConnected)return;
    // 四个商品生图入口使用轻量工作台；修图和换装保留原来的独立流程。
    if(GENERATION_TYPES[mode])return renderCreative();
    const working=['planning','generating'].includes(active.phase);
    const formLocked=working||active.phase==='review';
    root.innerHTML=`<div class="studio"><header class="creative-topbar"><div class="studio-heading"><span>AI作图</span><b>/</b><strong>${MODES[mode]}</strong><small>原型体验</small></div><div class="studio-top-actions"><button type="button" data-action="history">生成记录${active.history.length?` · ${active.history.length}`:''}</button><button type="button" data-action="reset">新建任务</button></div></header>
      <nav class="studio-mobile-nav" aria-label="作图工具">${Object.entries(MODES).map(([id,label])=>`<a href="#/image-studio/${id.slice(6)}" ${mode===id?'aria-current="page"':''}>${label.replace('批量','')}</a>`).join('')}</nav><div class="studio-workspace"><section class="studio-form" aria-label="图片生成设置"><fieldset ${formLocked?'disabled':''}>
      ${mode==='image-outfit'?`<div class="studio-types" role="group" aria-label="图片类型">${Object.entries(TYPE).map(([id,[label,n]])=>`<button type="button" data-type="${id}" aria-pressed="${active.type===id}" class="${active.type===id?'selected':''}">${label}<small>${n}张 / 版</small></button>`).join('')}</div>`:mode==='image-retouch'?`<div class="studio-types retouch-types" role="group" aria-label="修图操作">${['去水印','改文案','抠图'].map(label=>`<button type="button" data-retouch="${label}" aria-pressed="${active.retouch===label}" class="${active.retouch===label?'selected':''}">${label}</button>`).join('')}</div>`:''}
      ${GENERATION_TYPES[mode]&&['set','listing'].includes(active.type)?`<div class="studio-section-head"><div><strong>生图模板</strong><small>预览整套图片的信息结构与视觉方向</small></div><button type="button" class="studio-text-btn" data-action="templates">更换模板</button></div><button type="button" class="studio-template-summary" data-action="templates"><div class="studio-template-strip">${[1,2,3].map(n=>`<img src="${ASSETS+template().id}-${n}.jpg" alt="${template().name}预览${n}">`).join('')}</div><div><strong>${template().name}</strong><span class="studio-tag">${template().tag}</span><small>${template().desc}</small></div></button><details class="studio-extra"><summary>补充模板信息（选填）</summary><label>商品名称<input data-field="product" value="${esc(active.product)}" placeholder="例如：陶瓷马克杯"></label><label>核心卖点<input data-field="selling" value="${esc(active.selling)}" placeholder="例如：哑光釉面、可定制 Logo"></label><label>目标客户<input data-field="buyers" value="${esc(active.buyers)}" placeholder="例如：礼品采购商、品牌商"></label></details>`:''}
      ${GENERATION_TYPES[mode]?upload('style','参考设计图',1):''}
      ${mode==='image-outfit'?upload('outfit','更换服装图',1):''}
      <div class="studio-section-head"><strong>${mode==='image-outfit'?'模特图片':mode==='image-retouch'?'待修改图片':'商品参考图'}</strong>${GENERATION_TYPES[mode]?'<button type="button" class="studio-text-btn" data-action="logo">添加 Logo</button>':''}</div>
      ${upload('uploads',mode==='image-outfit'?'上传模特图片':mode==='image-retouch'?'上传需要修改的图片':'上传商品参考图',10)}
      ${active.showLogo?upload('logo','品牌 Logo',1):''}
      <label class="studio-prompt">${mode==='image-retouch'?'修图指令':'补充文字要求（选填）'}<textarea data-field="prompt" maxlength="4000" aria-label="${mode==='image-retouch'?'修图指令':'补充文字要求'}" placeholder="${mode==='image-retouch'?'描述需要修改的区域或目标效果':mode==='image-outfit'?'保持模特姿势和五官，自然替换服装':'可补充：商品卖点、使用场景、画面风格，以及必须保留或避免的内容'}">${esc(active.prompt)}</textarea><small>图片保留在当前浏览器中</small></label>
      <div class="studio-params">${select('ratio','画面比例',['1:1','2:3','3:2','3:4','4:3','4:5','5:4','9:16','16:9'])}${select('model','生图模型',['PTJ-1','PTJ-2','PTJ-3'])}${select('quality','输出清晰度',['低','中','高'])}${select('quantity','完整方案数量',[1,2,3,4,5,6,7,8,9,10])}<p>每版 ${mode==='image-retouch'?Math.max(1,active.uploads.length):TYPE[active.type][1]} 张<strong>共 ${count()} 张</strong></p></div>
      <button type="button" class="studio-primary studio-submit" data-action="plan" ${working?'disabled':''}>${active.phase==='planning'?'正在整理逐张方案…':active.phase==='generating'?'正在生成…':'生成 Prompt'}</button><p class="studio-footnote">先确认逐张方案，再开始生成图片</p></fieldset></section>
      <section class="studio-output" aria-label="生成内容">${renderOutput()}</section></div><div class="studio-modal-root">${renderDialog()}</div><div class="studio-toast" role="status" aria-live="polite"></div></div>`;
    bind();
  }
  /** 使用本地 Tabler 图标。@param {string} name 已收录的图标名。@returns {string} HTML。不抛异常。 */
  function toolIcon(name) { return `<img class="studio-tool-icon" src="${ASSETS}icons/${name}.svg" alt="">`; }

  /** 渲染紧凑商品上传区。@returns {string} 缩略图和文件选择器。不抛异常。 */
  function renderProductUpload() {
    const single=mode==='image-main';
    const picker=`<input type="file" accept="image/png,image/jpeg,image/webp" ${single?'':'multiple'} data-upload="uploads" aria-label="${single&&active.uploads.length?'更换商品图片':'上传商品图片'}">`;
    return `<div class="studio-product-upload" data-drop="uploads"><h2>商品图片</h2><div class="studio-product-strip">
      ${active.uploads.map((item,i)=>`<div class="studio-product-thumb"><img src="${esc(item.url)}" alt="${esc(item.name)}">${item.sample?'<span>示例</span>':''}<button type="button" data-remove="uploads:${i}" aria-label="移除${esc(item.name)}">${toolIcon('x')}</button></div>`).join('')}
      ${single&&active.uploads.length?`<label class="studio-replace-image">更换图片${picker}</label>`:active.uploads.length<10?`<label class="studio-add-image">${toolIcon(active.uploads.length?'plus':'photo-up')}<span>${active.uploads.length?'添加':'上传商品图'}</span>${picker}</label>`:''}
      </div>${!active.uploads.length?`<p>${single?'上传或拖入 1 张商品图片':'支持拖入图片，最多 10 张'}</p>`:''}</div>`;
  }

  /** 在商品标题旁提供可选的单张 Logo 上传，避免增加整块表单。@returns {string} 上传、更换和移除控件 HTML。不抛异常。 */
  function renderMainLogoUpload() {
    const logo=active.logo[0];
    return `<div class="studio-logo-upload" data-drop="logo"><label title="品牌 Logo（选填）">${logo?`<img class="studio-logo-preview" src="${esc(logo.url)}" alt="${esc(logo.name)}">`:toolIcon('plus')}<span>${logo?'更换 Logo':'添加 Logo'}</span><input type="file" accept="image/png,image/jpeg,image/webp" data-upload="logo" aria-label="${logo?'更换品牌 Logo':'上传品牌 Logo'}"></label>${logo?`<button type="button" data-remove="logo:0" aria-label="移除品牌 Logo">${toolIcon('x')}</button>`:''}</div>`;
  }

  /** 主图、套图和详情图共用单张商品输入，整套要求带入每一张图。@returns {string} 已转义的输入区 HTML。不抛异常。 */
  function renderMainComposer() {
    const item=active.uploads[0];
    const suite=isSuiteMode();
    const label=item?'更换商品图片':'上传商品图片';
    // 文件交给共享 addFiles 校验；三个入口都始终不启用 multiple。
    return `<div class="studio-main-composer"><div class="studio-composer-head"><h2>商品图片</h2>${renderMainLogoUpload()}</div><div class="studio-composer-shell" data-drop="uploads">
      <div class="studio-composer-upload-row">
        ${item?`<div class="studio-product-thumb"><img src="${esc(item.url)}" alt="${esc(item.name)}">${item.sample?'<span>示例</span>':''}<button type="button" data-remove="uploads:0" aria-label="移除${esc(item.name)}">${toolIcon('x')}</button></div>`:''}
        <label class="studio-composer-picker">${item?'':`<span class="studio-composer-upload-icon">${toolIcon('photo-up')}</span>`}<span class="studio-composer-upload-copy"><strong>${label}</strong><small>${item?(suite?(active.type==='listing'?'以这张商品图生成整套详情图':'以这张商品图生成整套主副图'):'保留商品主体，重新设计画面'):'点击选择，也可粘贴或拖入'}</small></span><input type="file" accept="image/png,image/jpeg,image/webp" data-upload="uploads" aria-label="${label}"></label>
        <span class="studio-composer-count">${item?1:0}/1 张</span>
      </div>
      <label class="studio-composer-brief"><span>${suite?'整套统一要求':'想怎么拍？'}<small>选填</small></span><textarea data-field="prompt" aria-label="${suite?'整套统一要求':'想怎么拍'}" aria-describedby="studio-composer-hint" maxlength="4000" placeholder="${suite?'例如：整体暖色调、自然光，需要文字时使用英文…':'说说你想要的背景、光线或要突出的细节…'}">${esc(active.prompt)}</textarea></label>
      <p id="studio-composer-hint" class="studio-composer-hint">${toolIcon('sparkles')}${suite?'作用于整套图片，各张内容按所选用途生成。':'图片决定商品主体，文字补充画面要求'}</p>
    </div></div>`;
  }

  /** 渲染轻量输入和按日期排列的图片工作台。@returns {void} 无主动异常。 */
  function renderCreative() {
    if(isSuiteMode())return renderSetStudio();
    const working=['planning','generating'].includes(active.phase)||active.refining;
    // 上传或参数变化会重新渲染；保留左侧滚动位置，让内联选项仍停在用户正在操作的位置。
    const formScroll=root.querySelector('.studio-main-page .studio-form>fieldset')?.scrollTop;
    root.innerHTML=`<div class="studio studio-simple${mode==='image-main'?' studio-main-page':''}"><header class="creative-topbar"><div class="studio-heading"><span>AI作图</span><b>/</b><strong>${MODES[mode]}</strong></div><div class="studio-top-actions"><button type="button" data-action="history">${toolIcon('history')}生成记录${active.history.length?` · ${active.history.length}`:''}</button></div></header>
      <nav class="studio-mobile-nav" aria-label="作图工具">${Object.entries(MODES).map(([id,label])=>`<a href="#/image-studio/${id.slice(6)}" ${mode===id?'aria-current="page"':''}>${label.replace('批量','')}</a>`).join('')}</nav>
      <div class="studio-workspace"><section class="studio-form" aria-label="图片生成设置"><fieldset ${working?'disabled':''}>
        ${mode==='image-main'?renderMainComposer():`${renderProductUpload()}<label class="studio-brief">想怎么拍？<textarea data-field="prompt" aria-label="想怎么拍" maxlength="4000" placeholder="说说你想要的背景、光线或要突出的细节…">${esc(active.prompt)}</textarea></label>`}
        ${renderDirectionControl()}
        ${['set','listing'].includes(active.type)?`<details class="studio-content-structure" data-settings-section="structureOpen" ${active.structureOpen?'open':''}><summary>图片内容结构</summary><div class="studio-inline-styles">${renderInlineStyles()}</div></details>`:''}
        <button type="button" class="studio-primary studio-start" data-action="start">${working?'<span class="studio-spinner"></span>':toolIcon('sparkles')}${working?'正在作图…':'开始作图'}</button>
        ${mode==='image-main'?`<section id="studio-inline-settings" class="studio-inline-settings studio-main-options" aria-label="作图选项">${renderInlineSettings()}</section>`:`<button type="button" id="studio-settings-trigger" class="studio-settings-trigger" data-action="settings" aria-expanded="${active.settingsOpen}" aria-controls="studio-inline-settings">更多设置${toolIcon('chevron-down')}</button><section id="studio-inline-settings" class="studio-inline-settings" aria-labelledby="studio-settings-trigger" ${active.settingsOpen?'':'hidden'}>${renderInlineSettings()}</section>`}
      </fieldset></section><section class="studio-output${mode==='image-main'?' studio-gallery-surface':''}" aria-label="生成内容">${renderCanvas()}</section></div>
      <div class="studio-modal-root">${renderDialog()}</div><div class="studio-toast" role="status" aria-live="polite"></div></div>`;
    bind();
    if(formScroll!==undefined)root.querySelector('.studio-main-page .studio-form>fieldset').scrollTop=formScroll;
  }

  /** 复制作图输入，素材对象单独复制，避免左侧更换文件或后续任务改写历史。@param {object|null} source 会话或已保存的输入。@returns {object|null} 无会话状态的快照。不抛异常。 */
  function copyGenerationContext(source) {
    if(!source)return null;
    const context={};
    for(const field of ['type','template','visualStyle','ratio','quality','model','quantity','prompt','product','selling','buyers','retouch','attachedInfo','imageText'])context[field]=source[field];
    for(const field of ['uploads','style','logo','outfit'])context[field]=(source[field]||[]).map(item=>({...item}));
    if(source.setSlots)context.setSlots=source.setSlots.map(item=>({...item}));
    return context;
  }

  /** 取得图位用途，未知旧值回退为该类型的细节展示。@param {string} id 用途 ID。@param {string} type 产物类型，读取历史时显式传入。@returns {object} 固定用途定义。不抛异常。 */
  function setRole(id,type=active.type) { const roles=suiteRoles(type);return roles.find(item=>item.id===id)||roles.find(item=>item.id==='detail'); }

  /** 按当前图位生成示例图片及角色标签。@param {object} source 套图设置。@returns {object[]} 本地演示素材。不抛异常。 */
  function setExampleImages(source) {
    return source.setSlots.map((slot,index)=>({title:`${suiteImageLabel(source.type,slot.role,index)} · ${setRole(slot.role,source.type).name}`,image:ASSETS+setRole(slot.role,source.type).image,role:slot.role,slotId:slot.id,brief:slot.brief,variant:1}));
  }

  /** 渲染套图和详情图共用的工作台：共用输入及内容安排在左，完整示例和结果在右。@returns {void} 无主动异常。 */
  function renderSetStudio() {
    const listing=active.type==='listing';
    const working=['planning','generating'].includes(active.phase)||active.refining;
    const formScroll=root.querySelector('.studio-form>fieldset')?.scrollTop||0;
    const outputScroll=root.querySelector('.studio-output')?.scrollTop||0;
    root.innerHTML=`<div class="studio studio-simple studio-set-page"><header class="creative-topbar"><div class="studio-heading"><span>AI作图</span><b>/</b><strong>${listing?'商品详情图':'商品主副图'}</strong></div><div class="studio-top-actions"><button type="button" data-action="history">${toolIcon('history')}生成记录${active.history.length?` · ${active.history.length}`:''}</button></div></header>
      <nav class="studio-mobile-nav" aria-label="作图工具">${Object.entries(MODES).map(([id,label])=>`<a href="#/image-studio/${id.slice(6)}" ${mode===id?'aria-current="page"':''}>${label.replace('批量','')}</a>`).join('')}</nav>
      <div class="studio-workspace"><section class="studio-form" aria-label="${listing?'详情图':'套图'}生成设置"><fieldset ${working?'disabled':''}>${renderMainComposer()}${renderSetOptions()}<section class="studio-inline-settings studio-main-options" aria-label="${listing?'详情图':'套图'}选项"><div class="studio-drawer-fields">${select('ratio','画面比例',['1:1','2:3','3:2','3:4','4:3','4:5','5:4','9:16','16:9'])}</div></section><button type="button" class="studio-primary studio-start" data-action="start">${working?'<span class="studio-spinner"></span>':toolIcon('sparkles')}${working?'正在生成…':`生成整套 · ${count()} 张`}</button><button type="button" class="studio-new-task" data-action="reset">新建作图任务</button></fieldset></section><section class="studio-output studio-gallery-surface" aria-label="${listing?'整套详情图':'整套主副图'}">${renderSetCanvas()}</section></div><div class="studio-modal-root">${renderDialog()}</div><div class="studio-toast" role="status" aria-live="polite"></div></div>`;
    bind();
    root.querySelector('.studio-form>fieldset').scrollTop=formScroll;
    root.querySelector('.studio-output').scrollTop=outputScroll;
  }

  /** 保留单一下拉入口，展开后并排选择方向和逐张内容，参考图始终在下拉区外。@returns {string} 画面与内容设置。不抛异常。 */
  function renderSetOptions() {
    const listing=active.type==='listing';
    const direction=active.style.length?'使用参考图':active.visualStyle;
    return `<section class="studio-set-options" aria-label="画面与内容"><div class="studio-set-picker-row"><div><h2>画面与内容</h2><button type="button" class="studio-set-summary" data-action="set-content" aria-label="${listing?'选择画面方向与详情内容':'选择画面方向与副图'}" aria-expanded="${active.setContentOpen}" aria-controls="studio-set-content"><span><strong>${esc(direction)}</strong><small>${listing?`本套共 ${active.setSlots.length} 张详情图`:`1 张主图 ＋ ${active.setSlots.length-1} 张副图`}</small></span>${toolIcon('chevron-down')}</button></div>${renderReferenceTile()}</div>${renderSetContentEditor()}</section>`;
  }

  /** 在同一面板内选择方向和逐张内容；规格始终显示必填输入，其他说明按需显示。@returns {string} 内容编辑 HTML。不抛异常。 */
  function renderSetContentEditor() {
    const listing=active.type==='listing',minimum=listing?1:2;
    const slots=listing?active.setSlots:active.setSlots.slice(1);
    const options=suiteRoles().filter(role=>role.id!=='main');
    return `<div class="studio-set-content" id="studio-set-content" ${active.setContentOpen?'':'hidden'}><fieldset ${['planning','generating'].includes(active.phase)||active.refining?'disabled':''}><div class="studio-set-choice-grid">${renderDirectionSelect()}${slots.map((slot,index)=>{
      const notes=slot.role==='spec'||(active.setNotesOpen[slot.id]??Boolean(slot.brief));
      const noun=listing?'详情图':'副图',label=listing?`详情 ${index+1}`:`副图 ${index+1}`;
      return `<div class="studio-set-slot"><div class="studio-set-slot-head"><label for="studio-set-role-${slot.id}">${label}</label><button type="button" class="studio-slot-note" data-set-note="${slot.id}" aria-expanded="${Boolean(notes)}" ${slot.role==='spec'?'disabled':''}>${slot.role==='spec'?'必填':notes?'收起':'说明'}</button><button type="button" class="studio-slot-remove" data-set-remove="${slot.id}" aria-label="移除第${index+1}张${noun}" ${active.setSlots.length<=minimum?'disabled':''}>${toolIcon('x')}</button></div><select id="studio-set-role-${slot.id}" data-set-role="${slot.id}" aria-label="第${index+1}张${noun}用途">${options.map(role=>`<option value="${role.id}" ${role.id===slot.role?'selected':''}>${role.name}</option>`).join('')}</select>${notes?`<textarea data-set-brief="${slot.id}" aria-label="第${index+1}张${noun}补充说明" maxlength="500" placeholder="${setRole(slot.role).hint}${slot.role==='spec'?'（必填）':'（选填）'}">${esc(slot.brief)}</textarea>`:''}</div>`;
    }).join('')}</div><div class="studio-set-content-footer"><button type="button" class="studio-set-add-slot" data-action="add-set-slot" ${active.setSlots.length>=10?'disabled':''}>${toolIcon('plus')}${listing?'添加详情图':'添加副图'}</button><small>${listing?'每套 1–10 张':'固定 1 张主图 · 最多 10 张'}</small></div></fieldset></div>`;
  }

  /** 渲染整套内容概览和按日期保存的套图示例/结果。@returns {string} 输出区域 HTML。不抛异常。 */
  function renderSetCanvas() {
    const records=setGalleryRecords();
    const working=['planning','generating'].includes(active.phase)||active.refining;
    const sample=records.every(record=>record.resultTime==='示例作品');
    const shown=records;
    return `<header class="studio-set-intro"><h2>${sample?(active.type==='listing'?'详情图效果示例':'整套效果示例'):'生成结果'}</h2><p>${sample?'示例图片，仅供参考':'演示结果 · 最新生成在前'}</p></header>${working?`<div class="studio-gallery-progress" role="status"><span class="studio-spinner"></span><span>${active.refining?'正在重做这张图片…':active.phase==='planning'?'正在准备整套画面…':`正在生成 · ${active.progress} / ${active.plans.length} 张`}</span></div>`:''}${groupRecordsByDate(shown).map(group=>`<section class="studio-date-group" aria-label="${group.label}"><h3><time datetime="${group.key}">${group.label}</time></h3>${group.records.map(renderSetRecord).join('')}</section>`).join('')}`;
  }

  /** 展示每套结果及下载入口，示例和生成结果都可逐张调整、下载，生成结果另可重做。@param {object} record 固定输入和结果快照。@returns {string} 图片网格。不抛异常。 */
  function renderSetRecord(record) {
    const sample=record.resultTime==='示例作品';
    const variants=[...new Set(record.results.map(item=>item.variant||1))];
    const attr=`data-gallery-record="${esc(record.resultId)}"`;
    return `<div class="studio-gallery-batch"><div class="studio-batch-head"><span>${sample?'示例':new Date(record.resultCreatedAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false})} · ${variants.length} 套 · ${record.results.length} 张</span>${!sample?`<button type="button" ${attr} data-gallery-action="repeat-set">再生成一套</button>`:''}<button type="button" class="studio-set-download" ${attr} data-gallery-action="download" aria-label="下载整套">${toolIcon('download')}下载整套<span>${record.results.length} 张</span></button></div>${variants.map(variant=>`${variants.length>1?`<p class="studio-set-variant-label">第 ${variant} 套</p>`:''}<div class="studio-gallery-grid">${record.results.map((item,index)=>({item,index})).filter(({item})=>(item.variant||1)===variant).map(({item,index},position)=>`<article class="studio-gallery-card studio-set-card ${item.role==='main'?'is-primary':''}"><div class="studio-gallery-media"><button type="button" class="studio-hero-image" ${attr} data-gallery-index="${index}" data-gallery-action="preview" aria-label="放大${esc(item.title)}"><img src="${esc(item.image)}" alt="${esc(item.title)}" loading="lazy"></button>${renderImageInfo(record,index)}</div><p class="studio-gallery-title"><span>${suiteImageLabel(record.resultType,item.role,position)}</span>${esc(setRole(item.role,record.resultType).name)}</p><div class="studio-canvas-actions"><button type="button" ${attr} data-gallery-index="${index}" data-gallery-action="adjust">${toolIcon('wand')}调整</button><button type="button" ${attr} data-gallery-index="${index}" data-gallery-action="download-one">${toolIcon('download')}下载</button>${!sample?`<button type="button" class="studio-repeat-trigger" ${attr} data-gallery-index="${index}" data-gallery-action="redo-set-image">${toolIcon('sparkles')}重做这张</button>`:''}</div>${item.revision?'<small class="studio-set-updated">已重做 · 演示</small>':''}${item.note?`<p class="studio-result-note">${esc(item.note)}<small>调整已记录，图片仍为演示素材。</small></p>`:''}</article>`).join('')}</div>`).join('')}</div>`;
  }

  /** 更新仅用于展示的初始示例；历史任务始终保留自己的内容安排。@returns {void} 无主动异常。 */
  function refreshSetExample() {
    if(active.resultTime==='示例作品') {
      // 示例现已允许改单图；改变其他图位时，按稳定 ID 保留未换用途图片的调整记录。
      const previous=new Map(active.results.map(item=>[item.slotId,item]));
      active.results=setExampleImages(active).map(item=>{const old=previous.get(item.slotId);return old?.role===item.role?{...item,note:old.note,revision:old.revision}:item;});
      active.resultContext=copyGenerationContext(active);
    }
  }

  /** 添加或删除内容图：套图固定主图且最少两张，详情图最少一张，两者最多十张。@param {string|null} id 删除目标，null 表示添加。@returns {boolean} 是否修改。不抛异常。 */
  function changeSetSlots(id=null) {
    if(!isSuiteMode()||['planning','generating'].includes(active.phase)||active.refining)return false;
    if(id) {
      if(id==='main'||active.setSlots.length<=(active.type==='listing'?1:2)||!active.setSlots.some(slot=>slot.id===id))return false;
      active.setSlots=active.setSlots.filter(slot=>slot.id!==id);delete active.setNotesOpen[id];
    }else {
      if(active.setSlots.length>=10)return false;
      active.setSlots.push({id:'secondary-'+(++active.setSlotSequence),role:'detail',brief:''});
    }
    refreshSetExample();render();return true;
  }

  /** 更换某张副图用途，保留已输入说明以便继续编辑。@param {string} id 图位。@param {string} role 用途。@returns {boolean} 是否修改。不抛异常。 */
  function updateSetRole(id,role) {
    if(!isSuiteMode()||['planning','generating'].includes(active.phase)||active.refining)return false;
    const slot=active.setSlots.find(item=>item.id===id);
    if(!slot||slot.role==='main'||role==='main'||!suiteRoles().some(item=>item.id===role))return false;
    slot.role=role;refreshSetExample();render();return true;
  }

  /** 每次生成一套，逐张带入同一份共用要求，再添加各图用途和说明。@param {object} context 已冻结的输入。@returns {object[]} 带图位的演示方案。不抛异常。 */
  function buildSetPlans(context) {
    const name=context.type==='listing'?'详情图':'主副图';
    return context.setSlots.map((slot,index)=>{
      const role=setRole(slot.role,context.type);
      return {variant:1,role:slot.role,slotId:slot.id,brief:slot.brief,title:`${suiteImageLabel(context.type,slot.role,index)} · ${role.name}`,imageOverride:ASSETS+role.image,prompt:`围绕同一张商品图制作整套${name}，保持外观、颜色与视觉风格一致。此图用于${role.name}，${context.ratio}构图，${context.quality}清晰度。${directionGuidance(context)}\n整套统一要求：${context.prompt||'保持整套视觉一致。'}\n本图要求：${slot.brief||'根据商品素材呈现，不编造参数和产品特性。'}${context.type==='listing'?'只呈现用户已提供的信息，不编造认证、售后、定制和合作承诺。':''}`,edit:false,feedback:''};
    });
  }

  /** 使用历史套图的完整设置再生成一套，不改变当前左侧输入。@param {object} record 历史套图。@returns {boolean} 是否开始。不抛异常。 */
  function repeatSet(record) {
    if(!isSuiteMode()||record.resultMode!==mode||['planning','generating'].includes(active.phase)||active.refining||!record.results.length||!record.resultContext?.setSlots)return false;
    const context=copyGenerationContext(record.resultContext);
    context.quantity=1;context.quality='中';context.uploads=context.uploads.slice(0,1);
    context.style=[{name:context.type==='listing'?'详情图参考':'套图主图',url:record.results[0].image,sourceRecordId:record.resultId,sourceIndex:0}];
    if(!active.history.some(item=>item.resultId===record.resultId))active.history.push(resultSnapshot(record));
    active.plans=buildSetPlans(context);active.pendingContext=context;
    generate(active,mode,context);return true;
  }

  /** 演示重做一个图位，保持同组其他结果和该记录的生成参数。@param {object} record 记录。@param {number} index 图片索引。@returns {boolean} 是否开始。不抛异常。 */
  function redoSetImage(record,index) {
    if(!isSuiteMode()||record.resultMode!==mode||['planning','generating'].includes(active.phase)||active.refining||!record.results[index])return false;
    const session=active,updated={...record.results[index],revision:(record.results[index].revision||0)+1};
    session.refining=true;render();
    setTimeout(()=>{
      const saved=session.history.find(item=>item.resultId===record.resultId);
      if(saved)saved.results[index]={...updated};
      if(session.resultId===record.resultId)session.results[index]={...updated};
      session.refining=false;
      if(active===session){render();toast('已重做这张图片（演示）');}
      console.info('[yingdan-image-studio] 单张套图重做演示完成',{index});
    },650);
    return true;
  }

  /** 复制结果及时间元数据，避免预览旧任务时改写历史。@param {object} session 会话或记录。@returns {object} 独立结果快照。不抛异常。 */
  function resultSnapshot(session) {
    return {results:session.results.map(item=>({...item})),resultMode:session.resultMode,resultType:session.resultType,resultRatio:session.resultRatio,resultQuantity:session.resultQuantity,resultModel:session.resultModel,resultTime:session.resultTime,resultCreatedAt:session.resultCreatedAt,resultId:session.resultId,resultContext:copyGenerationContext(session.resultContext)};
  }

  /** 合并当前结果和历史，同一任务只出现一次。@returns {object[]} 按生成时间倒序的记录。不抛异常。 */
  function galleryRecords() {
    const records=[...active.history];
    if(active.results.length&&!records.some(record=>record.resultId===active.resultId))records.push(resultSnapshot(active));
    return records.sort((a,b)=>b.resultCreatedAt-a.resultCreatedAt);
  }

  /** 新任务也提供可预览的完整示例，渲染和点击使用同一数据来源。@returns {object[]} 套图记录或临时示例，不写入历史。不抛异常。 */
  function setGalleryRecords() {
    const records=galleryRecords();
    return records.length?records:[{...resultSnapshot(active),results:setExampleImages(active),resultContext:copyGenerationContext(active),resultTime:'示例作品',resultId:'sample-'+mode}];
  }

  /** 按浏览器本地日期分组，数值时间排序避免跨月、跨年字符串排序错误。@param {object[]} records 带毫秒时间戳的结果。@returns {object[]} 最新日期在前的分组。不抛异常。 */
  function groupRecordsByDate(records) {
    const groups=new Map();
    for(const record of [...records].sort((a,b)=>b.resultCreatedAt-a.resultCreatedAt)) {
      const date=new Date(record.resultCreatedAt);
      const key=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
      if(!groups.has(key))groups.set(key,{key,label:`${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日`,records:[]});
      groups.get(key).records.push(record);
    }
    return [...groups.values()];
  }

  /** 恢复指定任务供放大或调整使用，不改变左侧商品和生成设置。@param {object} record 结果快照。@param {number} index 图片索引。@returns {void} 无主动异常。 */
  function selectRecord(record,index=0) {
    Object.assign(active,resultSnapshot(record),{selected:Math.max(0,Math.min(index,record.results.length-1)),phase:'results',dialog:null});
  }

  /** 渲染图片左上角的小标与参数浮层，只读取该记录的快照。@param {object} record 结果记录。@param {number} index 图片索引。@returns {string} 信息控件 HTML。不抛异常。 */
  function renderImageInfo(record,index) {
    const context=record.resultContext;
    const reference=context?.style?.[0];
    const ratio=context?.ratio||record.resultRatio||'未记录';
    const infoId=`studio-info-${esc(record.resultId)}-${index}`;
    return `<div class="studio-image-info"><button type="button" class="studio-info-trigger" data-info-toggle aria-label="查看${esc(record.results[index].title)}生成信息" aria-expanded="false" aria-controls="${infoId}">${toolIcon('adjustments-horizontal')}<span>${esc(ratio)}</span></button><div class="studio-info-popover" id="${infoId}" hidden><strong>生成信息</strong><dl><div><dt>画面比例</dt><dd>${esc(ratio)}</dd></div>${reference?`<div><dt>风格来源</dt><dd>参考图</dd></div>`:`<div><dt>画面方向</dt><dd>${esc(context?.visualStyle||'未记录')}</dd></div>`}</dl>${reference?`<div class="studio-info-reference"><img src="${esc(reference.url)}" alt="当时使用的风格参考图"><span>${esc(reference.name)}</span></div>`:''}</div></div>`;
  }

  /** 开关单个信息浮层，鼠标、键盘和触屏共用同一可访问状态。@param {HTMLElement} container 小标容器。@param {boolean} open 是否展开。@returns {void} 无主动异常。 */
  function setImageInfoOpen(container,open) {
    container.querySelector('[data-info-toggle]').setAttribute('aria-expanded',String(open));
    container.querySelector('.studio-info-popover').hidden=!open;
  }

  /** 渲染一个任务的紧凑图片网格；原有大图弹层继续负责查看细节。@param {object} record 结果记录。@returns {string} 安全 HTML。不抛异常。 */
  function renderGalleryRecord(record) {
    const sample=record.resultTime==='示例作品';
    const date=new Date(record.resultCreatedAt);
    const recordAttr=`data-gallery-record="${esc(record.resultId)}"`;
    return `<div class="studio-gallery-batch"><div class="studio-batch-head"><span>${sample?'示例效果':`<time datetime="${date.toISOString()}">${date.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false})}</time>`}<span> · ${record.results.length} 张</span></span>${record.results.length>1?`<button type="button" ${recordAttr} data-gallery-action="download">下载这组</button>`:''}</div>
      <div class="studio-gallery-grid">${record.results.map((item,i)=>`<article class="studio-gallery-card">
        <div class="studio-gallery-media"><button type="button" class="studio-hero-image" ${recordAttr} data-gallery-index="${i}" data-gallery-action="preview" aria-label="放大${esc(item.title)}"><img src="${esc(item.image)}" alt="${esc(item.title)}" loading="lazy"></button>${renderImageInfo(record,i)}</div>
        <p class="studio-gallery-title">${esc(item.title)}</p>
        <div class="studio-canvas-actions"><button type="button" ${recordAttr} data-gallery-index="${i}" data-gallery-action="adjust">${toolIcon('wand')}调整</button><button type="button" ${recordAttr} data-gallery-index="${i}" data-gallery-action="download-one">${toolIcon('download')}下载</button><button type="button" class="studio-repeat-trigger" ${recordAttr} data-gallery-index="${i}" data-gallery-action="repeat">${toolIcon('sparkles')}批量生成同款</button></div>
        ${item.note?`<p class="studio-result-note">调整要求：${esc(item.note)}<small>已记录，当前仍为示例图片。</small></p>`:''}
      </article>`).join('')}</div></div>`;
  }

  /** 渲染按日期倒序的结果；新任务进行中仍保留已有图片。@returns {string} 结果或进度 HTML。不抛异常。 */
  function renderCanvas() {
    const records=galleryRecords();
    const working=['planning','generating'].includes(active.phase);
    const progress=working?`<div class="studio-gallery-progress" role="status"><span class="studio-spinner"></span><span>${active.phase==='planning'?'正在准备画面…':`正在生成图片 · ${active.progress} / ${active.plans.length} 张`}</span></div>`:'';
    if(!records.length)return progress||`<div class="studio-canvas-empty">${toolIcon('photo-up')}<h2>好图片，从你的商品开始</h2><p>添加商品图片，写下想法，就可以开始作图。</p><button type="button" class="studio-secondary" data-action="example">试试示例商品</button></div>`;
    const sample=records.every(record=>record.resultTime==='示例作品');
    return `<div class="studio-canvas"><header class="studio-canvas-head"><h2>${sample?'示例效果':'生成结果'}</h2><p>${sample?'AI 生成的示例图片，仅供参考':'演示结果 · 最新生成的图片在前'}</p></header>${progress}
      ${groupRecordsByDate(records).map(group=>`<section class="studio-date-group" aria-label="${group.label}"><h3><time datetime="${group.key}">${group.label}</time></h3>${group.records.map(renderGalleryRecord).join('')}</section>`).join('')}
      </div>`;
  }

  /** 渲染更多设置的原位内容；生图模型沿用默认值。@returns {string} 参数和选填信息 HTML。不抛异常。 */
  function renderInlineSettings() {
    const main=mode==='image-main';
    return `<div class="studio-drawer-fields">${select('ratio','画面比例',['1:1','2:3','3:2','3:4','4:3','4:5','5:4','9:16','16:9'])}${select('quantity','生成版数',[1,2,3,4,5,6,7,8,9,10])}${main?'':select('quality','输出清晰度',['低','中','高'])}</div><p class="studio-count-summary">每版 ${TYPE[active.type][1]} 张 · 共 ${count()} 张</p>${main?'':`<details class="studio-advanced" data-settings-section="productInfoOpen" ${active.productInfoOpen?'open':''}><summary>补充商品信息（选填）</summary>${[['product','商品名称'],['selling','核心卖点'],['buyers','目标客户']].map(([field,label])=>`<label>${label}<input data-field="${field}" value="${esc(active[field])}" maxlength="200"></label>`).join('')}${upload('logo','品牌 Logo（选填）',1)}</details>`}<button type="button" class="studio-new-task" data-action="reset">新建作图任务</button>`;
  }

  /** 在触发按钮下方展开或收起，保留表单焦点及滚动位置。@returns {void} 无主动异常。 */
  function toggleSettings() {
    if(mode==='image-main')return;
    active.settingsOpen=!active.settingsOpen;
    root.querySelector('.studio-settings-trigger')?.setAttribute('aria-expanded',String(active.settingsOpen));
    const panel=root.querySelector('#studio-inline-settings');
    if(panel)panel.hidden=!active.settingsOpen;
  }

  /** 在主图等入口中并排展示方向与参考图，套图分别复用两个控件。@returns {string} 方向及上传行。不抛异常。 */
  function renderDirectionControl() {
    return `<div class="studio-direction-row">${renderDirectionSelect()}${renderReferenceTile()}</div>`;
  }

  /** 渲染方向下拉框及浅色说明；参考图生效时禁用方向，保留之前的选择。@returns {string} 方向控件。不抛异常。 */
  function renderDirectionSelect() {
    const reference=active.style[0];
    const directions=mode==='image-main'?[...VISUAL_DIRECTIONS,INFO_DIRECTION]:VISUAL_DIRECTIONS;
    const direction=directions.find(item=>item.name===active.visualStyle)||VISUAL_DIRECTIONS[0];
    return `<div class="studio-direction-control"><label><span>画面方向</span><select data-direction aria-label="画面方向" aria-describedby="studio-direction-hint" ${reference?'disabled':''}>${directions.map(item=>`<option value="${item.name}" ${active.visualStyle===item.name?'selected':''}>${item.name}</option>`).join('')}</select></label><small id="studio-direction-hint" class="studio-direction-hint">${reference?'已使用参考图，移除后可选择方向':esc(direction.desc)}</small>${!reference&&active.visualStyle===INFO_DIRECTION.name?`<button type="button" class="studio-edit-info" data-action="attached-info">编辑信息</button>`:''}</div>`;
  }

  /** 独立渲染参考图拖拽块，沿用文件读取、更换和移除的绑定。@returns {string} 单图上传控件。不抛异常。 */
  function renderReferenceTile() {
    const reference=active.style[0];
    return `<div class="studio-reference-tile${reference?' has-image':''}" data-drop="style"><label>${reference?`<img class="studio-reference-preview" src="${esc(reference.url)}" alt="${esc(reference.name)}"><span class="studio-reference-caption">更换参考图</span>`:`${toolIcon('plus')}<strong>参考图</strong><small>点击或拖拽上传</small>`}<input type="file" accept="image/png,image/jpeg,image/webp" data-upload="style" aria-label="${reference?'更换风格参考图':'上传风格参考图'}"></label>${reference?`<button type="button" data-remove="style:0" aria-label="移除风格参考图">${toolIcon('x')}</button>`:''}</div>`;
  }

  /** 套图和详情图继续保留独立内容结构选项。@returns {string} 已转义的选项 HTML。不抛异常。 */
  function renderInlineStyles() {
    return `<div class="studio-structure-options">${TEMPLATES.filter(item=>active.type==='listing'?item.id==='listing':item.id!=='listing').map(item=>`<button type="button" data-structure="${item.id}" aria-pressed="${item.id===active.template}"><strong>${item.name}</strong><span>${item.desc}</span></button>`).join('')}</div>`;
  }

  /** 更新方向；附带信息需确认文字后才生效。@param {string} name 当前入口支持的方向。@returns {void} 无主动异常。 */
  function chooseDirection(name) {
    if(active.style.length||['planning','generating','review'].includes(active.phase)||active.refining)return;
    if(mode==='image-main'&&name===INFO_DIRECTION.name)return openAttachedInfo();
    if(!VISUAL_DIRECTIONS.some(item=>item.name===name))return;
    active.visualStyle=name;
    render();
    root?.querySelector('[data-direction]')?.focus();
  }

  /** 打开独立草稿，取消时不修改已选方向和已保存的文字。@returns {void} 无主动异常。 */
  function openAttachedInfo() {
    if(mode!=='image-main'||active.style.length||['planning','generating','review'].includes(active.phase)||active.refining)return;
    active.infoReturnFocus=active.visualStyle===INFO_DIRECTION.name?'[data-action="attached-info"]':'[data-direction]';
    active.attachedInfoDraft=active.attachedInfo||'';
    active.dialog='attached-info';
    render();
  }

  /** 渲染主图文字输入弹窗，只收集需要显示在画面上的信息。@returns {string} 安全 HTML。不抛异常。 */
  function renderAttachedInfoDialog() {
    return `<div class="studio-overlay"><form class="studio-info-dialog" data-attached-info-form role="dialog" aria-modal="true" aria-label="附带信息"><header><h2>附带信息</h2><button type="button" data-action="close" aria-label="关闭附带信息">${toolIcon('x')}</button></header><p id="studio-attached-info-help">输入需要展示在主图上的文字，例如商品名称、规格或一句卖点。</p><label>图片上的文字<textarea data-field="attachedInfoDraft" aria-label="图片上的文字" aria-describedby="studio-attached-info-help" maxlength="500" required placeholder="商品名称或标题&#10;核心卖点或关键规格&#10;其他需要展示的文字">${esc(active.attachedInfoDraft)}</textarea></label><small>建议简短清晰，可按行填写，最多 500 字。</small><footer><button type="button" class="studio-secondary" data-action="close">取消</button><button type="submit" class="studio-primary">确定</button></footer></form></div>`;
  }

  /** 校验并保存文字，同时启用附带信息方向。@returns {boolean} 是否保存成功，空白或超长输入不会覆盖旧值。不抛异常。 */
  function saveAttachedInfo() {
    if(active.dialog!=='attached-info'||mode!=='image-main'||active.style.length||['planning','generating','review'].includes(active.phase)||active.refining)return false;
    const text=String(active.attachedInfoDraft||'').trim();
    if(!text||text.length>500) {
      const message=text?'信息请控制在 500 字以内':'请填写需要展示在图片上的文字';
      const input=root?.querySelector('[data-field="attachedInfoDraft"]');
      input?.setCustomValidity(message);input?.reportValidity();toast(message);
      return false;
    }
    active.attachedInfo=text;
    active.visualStyle=INFO_DIRECTION.name;
    closeDialog();
    console.info('[yingdan-image-studio] 附带信息已保存',{characters:text.length});
    return true;
  }

  /** 生成互斥的画面要求，参考图生效时不带入已记住的方向。@param {object} session 入口会话。@returns {string} 用于本地演示方案的要求。不抛异常。 */
  function directionGuidance(session) {
    // imageText 是本次真正生效的文字；同款复用此快照，不读取左侧尚未提交的内容。
    const text=session.imageText?`在画面中清晰展示以下文字，合理排版且不要遮挡商品，不额外编造信息：\n${session.imageText}\n`:'';
    const branding=session.logo?.length?'在画面合适位置加入所提供的品牌 Logo，保持标识比例与内容，不遮挡商品。':'';
    if(session.style.length)return '参考上传图片的构图、光线和色调，商品主体以商品图片为准。'+text+branding;
    const direction=[...VISUAL_DIRECTIONS,INFO_DIRECTION].find(item=>item.name===session.visualStyle)||VISUAL_DIRECTIONS[0];
    return `画面方向：${direction.name}。${direction.desc}，具体表现根据商品类型和文字要求适配。${text}${branding}`;
  }

  /** 打开数量对话框，复制所点的历史图及参数，不切换左侧表单。@param {object} record 所选记录。@param {number} index 其中一张图片的索引。@returns {void} 无主动异常。 */
  function openRepeat(record,index) {
    if(['planning','generating'].includes(active.phase)||active.refining)return;
    if(!record.results[index]||!record.resultContext){toast('这张图片缺少原始参数，请重新作图后再试');return;}
    active.repeatSource={record:resultSnapshot(record),index};
    active.repeatQuantity=4;
    active.dialog='repeat';
    render();
  }

  /** 渲染同款数量输入，数量按张计，不乘以套图版数。@returns {string} 弹窗 HTML。不抛异常。 */
  function renderRepeatDialog() {
    const {record,index}=active.repeatSource;
    const item=record.results[index];
    return `<div class="studio-overlay"><form class="studio-repeat-dialog" data-repeat-form role="dialog" aria-modal="true" aria-label="批量生成同款"><header><h2>批量生成同款</h2><button type="button" data-action="close" aria-label="关闭批量生成同款">${toolIcon('x')}</button></header><div class="studio-repeat-source"><img src="${esc(item.image)}" alt="${esc(item.title)}"><div><strong>${esc(item.title)}</strong><p>沿用这张图的商品、比例和样式</p><span>${esc(record.resultContext.ratio)} · ${esc(record.resultContext.style.length?'参考图':record.resultContext.visualStyle)}</span></div></div><label class="studio-repeat-count">创建数量<input type="number" data-field="repeatQuantity" aria-label="创建数量" min="1" max="10" step="1" required value="${esc(active.repeatQuantity)}"><small>可创建 1–10 张图片</small></label><footer><button type="button" class="studio-secondary" data-action="close">取消</button><button type="submit" class="studio-primary">开始创建</button></footer></form></div>`;
  }

  /** 根据选中的作品创建指定张数；锁定历史快照并保留当前输入和原图。@returns {boolean} 是否已开始；输入不合法时返回 false，不抛异常。 */
  function createSimilar() {
    if(['planning','generating'].includes(active.phase)||active.refining)return false;
    const amount=Number(active.repeatQuantity),source=active.repeatSource;
    if(!Number.isInteger(amount)||amount<1||amount>10){toast('请输入 1–10 的整数');return false;}
    if(!source?.record.resultContext||!source.record.results[source.index])return false;
    const session=active,record=source.record,item=record.results[source.index];
    const context=copyGenerationContext(record.resultContext);
    if(record.resultMode==='image-main')context.quality='中';
    // 用所选结果图作为新任务的风格参考，商品和比例来自那张图生成时的输入。
    context.style=[{name:item.title,url:item.image,sourceRecordId:record.resultId,sourceIndex:source.index}];
    context.quantity=amount;
    if(!session.history.some(entry=>entry.resultId===record.resultId))session.history.push(resultSnapshot(record));
    session.plans=Array.from({length:amount},(_,i)=>({variant:i+1,title:item.title,imageOverride:item.image,prompt:`${context.prompt||''}保持商品主体一致，${context.ratio}构图。${directionGuidance(context)}${item.note||''}`,edit:false,feedback:''}));
    session.pendingContext=context;
    session.dialog=null;session.repeatSource=null;
    generate(session,record.resultMode,context);
    console.info('[yingdan-image-studio] 同款演示开始',{count:amount});
    return true;
  }

  /** 渲染单张图片的调整弹层。@returns {string} HTML。不抛异常。 */
  function renderCreativeDialog() {
    return `<div class="studio-overlay"><section class="studio-adjust-dialog" role="dialog" aria-modal="true" aria-label="调整这张"><header><h2>调整这张</h2><button type="button" data-action="close" aria-label="关闭调整">${toolIcon('x')}</button></header><img src="${esc(active.results[active.selected].image)}" alt="当前图片"><label>希望调整哪里？<textarea data-field="adjustment" maxlength="1000" placeholder="比如换成白色背景，保持商品颜色和形状不变">${esc(active.adjustment)}</textarea></label><p>只调整当前图片，其他结果会保留。</p><footer><button type="button" class="studio-secondary" data-action="close">取消</button><button type="button" class="studio-primary" data-action="apply-adjustment">应用调整</button></footer></section></div>`;
  }

  /** 保存一份结果快照，防止后续改单图影响历史。@param {object} session 入口会话。@returns {void} 无主动异常。 */
  function saveRecord(session) {
    // 数值时间用于排序，显示文本单独格式化；序号避免同一毫秒完成的任务重号。
    session.resultCreatedAt=Date.now();
    session.resultId=`${session.resultCreatedAt}-${++recordSequence}`;
    session.resultTime=new Date(session.resultCreatedAt).toLocaleString('zh-CN');
    session.history.unshift(resultSnapshot(session));
  }

  /** 演示单图调整；仅更新本张备注，明确图片并未经过真实模型处理。@returns {void} 无主动异常。 */
  function adjustImage() {
    if(!active.adjustment?.trim()){toast('请写下想调整的地方');return;}
    const session=active, index=active.selected, note=active.adjustment.trim();
    session.dialog=null;session.refining=true;render();
    setTimeout(()=>{
      session.results[index]={...session.results[index],note};
      session.refining=false;
      // 套图按同一组逐张维护，修改一张不会再复制整套占满结果区。
      if(isSuiteMode(session.resultMode)) {
        const saved=session.history.find(item=>item.resultId===session.resultId);
        if(saved)saved.results[index]={...session.results[index]};
      }else saveRecord(session);
      if(active===session){render();toast('调整要求已记录，当前展示的仍是示例图片');}
      console.info('[yingdan-image-studio] 单图调整演示完成',{index});
    },600);
  }

  /** 渲染右侧方案或结果。@returns {string} HTML。不抛异常。 */
  function renderOutput() {
    if(active.phase==='planning')return `<div class="studio-empty"><span class="studio-spinner"></span><h2>正在整理图片方案</h2><p>根据图片类型和补充要求，拆分每张图的内容。</p></div>`;
    if(active.phase==='review')return `<div class="studio-result-panel"><div class="studio-result-head"><div><span class="studio-eyebrow">PROMPT REVIEW</span><h2>确认每张图片的生成方案</h2><p>${active.quantity} 版 · 共 ${active.plans.length} 张，可以逐张修改</p></div></div><ol class="studio-plan-list">${active.plans.map((plan,i)=>`<li><div class="studio-plan-title"><span>${String(i+1).padStart(2,'0')}</span><strong>第 ${plan.variant} 版 · ${plan.title}</strong><button type="button" class="studio-text-btn" data-edit="${i}">${plan.edit?'收起':'修改方案'}</button></div><p>${esc(plan.prompt)}</p>${plan.edit?`<label class="studio-feedback">修改意见<textarea data-feedback="${i}" aria-label="第${i+1}张修改意见" placeholder="例如：背景改为浅灰色，增加材质特写">${esc(plan.feedback)}</textarea></label><button type="button" class="studio-secondary" data-refine="${i}">更新这一张方案</button>`:''}</li>`).join('')}</ol><div class="studio-review-footer"><button type="button" class="studio-secondary" data-action="back-settings">返回调整设置</button><button type="button" class="studio-primary" data-action="generate">确认方案，开始生成 ${active.plans.length} 张</button></div></div>`;
    if(active.phase==='generating')return `<div class="studio-result-panel"><div class="studio-result-head"><h2>正在生成图片</h2><span>${active.progress}/${active.plans.length}</span></div><div class="studio-progress"><span style="width:${active.progress/active.plans.length*100}%"></span></div><div class="studio-results">${active.plans.map((p,i)=>`<div class="studio-generating-tile">${i<active.progress?`<img src="${resultImage(i)}" alt="${p.title}">`:'<span class="studio-spinner"></span>'}<small>${p.title}</small></div>`).join('')}</div></div>`;
    if(!active.results.length)return `<div class="studio-empty">${icon()}<h2>把商品想法，变成一组好图</h2><p>添加素材或文字要求。<br>逐张确认后，图片会出现在这里。</p><button type="button" class="studio-secondary" data-action="example">查看示例作品</button></div>`;
    return `<div class="studio-result-panel"><div class="studio-result-head"><h2>生成记录</h2><span class="studio-success">${active.resultTime==='示例作品'?'示例作品':'已完成'}</span><span class="studio-demo-label">演示结果</span></div><div class="studio-result-info"><strong>${active.resultMode==='image-retouch'?active.retouch:TYPE[active.resultType][0]} · ${active.results.length} 张</strong><p>生成时间 <span>${active.resultTime}</span>　模型 <span>${active.resultModel}</span>　尺寸 <span>${active.resultRatio}</span></p></div><div class="studio-results">${active.results.map((item,i)=>`<button type="button" data-preview="${i}" aria-label="预览${item.title}"><img src="${esc(item.image)}" alt="${esc(item.title)}"><span>${esc(item.title)}</span></button>`).join('')}</div><div class="studio-result-footer"><button type="button" class="studio-primary" data-action="download">全部下载</button></div></div>`;
  }
  /** 渲染弹层。@returns {string} 模板、历史或大图。不抛异常。 */
  function renderDialog() {
    if(!active.dialog)return '';
    if(active.dialog==='attached-info')return renderAttachedInfoDialog();
    if(active.dialog==='repeat')return renderRepeatDialog();
    if(active.dialog==='adjust')return renderCreativeDialog();
    if(active.dialog==='preview') { const item=active.results[active.selected]; return `<div class="studio-overlay" data-dismiss="true"><section class="studio-lightbox" role="dialog" aria-modal="true" aria-label="图片预览"><header><strong>${esc(item.title)}</strong><button type="button" data-action="close" aria-label="关闭预览">×</button></header><img src="${esc(item.image)}" alt="${esc(item.title)}"><footer><button type="button" data-action="previous" aria-label="上一张">上一张</button><span>${active.selected+1} / ${active.results.length}</span><button type="button" data-action="next" aria-label="下一张">下一张</button><button type="button" class="studio-primary" data-action="download-one">下载图片</button></footer></section></div>`; }
    if(active.dialog==='history')return `<div class="studio-overlay" data-dismiss="true"><section class="studio-library" role="dialog" aria-modal="true" aria-label="生成记录"><header><div><h2>生成记录</h2><p>当前页面中的作图任务</p></div><button type="button" data-action="close" aria-label="关闭生成记录">×</button></header><div class="studio-history-list">${active.history.length?active.history.map((item,i)=>`<button type="button" data-history="${i}"><img src="${esc(item.results[0].image)}" alt=""><div><strong>${MODES[mode]} · ${item.results.length} 张</strong><small>${item.resultTime}</small></div><span>查看</span></button>`).join(''):'<p class="studio-history-empty">还没有生成记录，完成第一组图片后会保存在这里。</p>'}</div></section></div>`;
    return `<div class="studio-overlay" data-dismiss="true"><section class="studio-library" role="dialog" aria-modal="true" aria-label="选择生图模板"><header><div><h2>选择生图模板</h2><p>先看整套内容，再选择适合商品的表达方式</p></div><button type="button" data-action="close" aria-label="关闭模板选择">×</button></header><div class="studio-library-body">${TEMPLATES.filter(item=>active.type==='listing'?item.id==='listing':item.id!=='listing').map(item=>`<article><div class="studio-library-title"><div><h3>${item.name}</h3><p>${item.desc}</p></div><button type="button" class="${active.template===item.id?'studio-secondary':'studio-primary'}" data-template="${item.id}">${active.template===item.id?'使用当前模板':'使用此模板'}</button></div><div class="studio-template-grid">${Array.from({length:item.count},(_,i)=>`<img src="${ASSETS+item.id}-${i+1}.jpg" alt="${item.name}第${i+1}张">`).join('')}</div></article>`).join('')}</div></section></div>`;
  }
  /** 只读参考素材，不做生成请求。@param {number} i 结果序号。@returns {string} 本地图片地址。不抛异常。 */
  function resultImage(i, currentMode=mode) { return ASSETS+(currentMode==='image-retouch'?'cat-cutout.svg':currentMode==='image-outfit'?'outfit-result.svg':i===0?STUDIO_PHOTO:MUGS[i%MUGS.length]); }
  /** 拆分逐张演示方案。@param {boolean} direct 是否直接进入生成。@returns {void} 无主动异常。 */
  function plan(direct=false) {
    if(['planning','generating'].includes(active.phase)||active.refining)return;
    if(mode==='image-retouch'&&!active.uploads.length) { toast('请先添加需要修改的图片'); return; }
    if(mode==='image-outfit'&&(!active.uploads.length||!active.outfit.length)) { toast('请先添加服装图和模特图片'); return; }
    if(GENERATION_TYPES[mode]&&!active.uploads.length&&!active.prompt.trim()&&!active.product) { toast('请添加商品图片，或填写商品和画面要求'); root.querySelector('[data-field="prompt"]').focus(); return; }
    if(isSuiteMode()) {
      const missing=active.setSlots.find(slot=>slot.role==='spec'&&!slot.brief.trim());
      if(missing){active.setContentOpen=true;active.setNotesOpen[missing.id]=true;render();root?.querySelector(`[data-set-brief="${missing.id}"]`)?.focus();toast(active.type==='listing'?'请补充实际规格，或更换这张详情图的内容':'请补充规格信息，或选择其他副图用途');return;}
    }
    const session=active, currentMode=mode,context=copyGenerationContext(active);
    if(currentMode==='image-main') {
      context.quality='中';
      // 参考图优先；切换方向后仍记住文字供重选，但不会带入当前生成。
      context.imageText=!context.style.length&&context.visualStyle===INFO_DIRECTION.name?String(context.attachedInfo||'').trim():'';
      context.product='';context.selling='';context.buyers='';
    }
    if(isSuiteMode(currentMode)){context.quantity=1;context.uploads=context.uploads.slice(0,1);context.quality='中';context.product='';context.selling='';context.buyers='';}
    session.pendingContext=context;
    active.phase='planning'; render();
    setTimeout(()=> {
      const per=currentMode==='image-retouch'?Math.max(1,context.uploads.length):TYPE[context.type][1];
      const purpose=currentMode==='image-retouch'?`执行${context.retouch}，仅修改指定区域，保持其他画面不变。`:currentMode==='image-outfit'?'把服装参考图中的服装自然替换到模特身上，保持姿态、五官与背景一致。':'';
      const titles=imageTitles(context.type);
      const direction=GENERATION_TYPES[currentMode]?directionGuidance(context):'';
      session.plans=isSuiteMode(currentMode)?buildSetPlans(context):Array.from({length:per*context.quantity},(_,i)=>({variant:Math.floor(i/per)+1,title:currentMode==='image-retouch'?`${context.retouch} · 第 ${i%per+1} 张`:titles[i%titles.length],prompt:`${purpose}${context.product||'参考素材中的商品'}，${GENERATION_TYPES[currentMode]?titles[i%titles.length]:'保持原图构图'}。保持主体造型、颜色与材质一致，${context.ratio}构图，${context.quality}清晰度。${context.selling?'突出 '+context.selling+'。':''}${context.buyers?'面向 '+context.buyers+'。':''}${direction}${context.prompt||(GENERATION_TYPES[currentMode]?'':'使用自然光与干净背景，突出主体。')}`,edit:false,feedback:''}));
      // 轻量生图无需再确认技术提示词；保留异步开始时的会话，切换入口也不会串写。
      if(direct)generate(session,currentMode);
      else {session.phase='review';if(active===session)render();}
      console.info('[yingdan-image-studio] 逐张方案已就绪', {count:session.plans.length});
    },700);
  }
  /** 播放本地结果出现过程并保存固定参数。@param {object} session 所属会话。@param {string} currentMode 入口。@param {object} context 任务开始时的输入。@returns {void} 无主动异常。 */
  function generate(session=active,currentMode=mode,context=session.pendingContext||copyGenerationContext(session)) {
    session.phase='generating'; session.progress=0; if(active===session)render();
    const timer=setInterval(()=> {
      session.progress=Math.min(session.plans.length,session.progress+Math.max(1,Math.ceil(session.plans.length/6)));
      if(session.progress===session.plans.length) {
        clearInterval(timer);
        session.results=session.plans.map((item,i)=>({title:item.title,image:item.imageOverride||resultImage(i,currentMode),variant:item.variant,role:item.role,slotId:item.slotId,brief:item.brief}));
        session.resultMode=currentMode; session.resultType=context.type; session.resultRatio=context.ratio; session.resultQuantity=context.quantity; session.resultModel=context.model;
        session.resultContext=copyGenerationContext(context);session.pendingContext=null;
        session.phase='results';session.selected=0;
        saveRecord(session);
        console.info('[yingdan-image-studio] 演示任务完成', {count:session.results.length});
      }
      if(active===session)render();
    },350);
  }
  /** 导入本地素材。@param {string} field 素材分组。@param {FileList|Array<File>} files 图片。@returns {Promise<void>} 失败显示反馈，不传播异常。 */
  async function addFiles(field,files) {
    if(['planning','generating','review'].includes(active.phase)||active.refining){toast('当前任务完成后可以更换素材');return;}
    const session=active, singleProduct=['image-main','image-set','image-listing'].includes(mode)&&field==='uploads';
    const limit=field==='uploads'&&!singleProduct?10:1;
    const imageFiles=Array.from(files).filter(file=>['image/png','image/jpeg','image/webp'].includes(file.type));
    if(!imageFiles.length){toast('请选择 PNG、JPG 或 WebP 图片');return;}
    const replaceSingle=singleProduct||field==='style'||field==='logo';
    const selectedFiles=replaceSingle?imageFiles.slice(0,1):imageFiles;
    if(selectedFiles.some(file=>file.size>10*1024*1024)){toast('单张图片请控制在 10 MB 以内');return;}
    // 单图素材读取成功后再替换；每组独立计数，避免 Logo 和风格图互相取消。
    const revisionField=singleProduct?'productUploadRevision':`${field}UploadRevision`;
    const revision=replaceSingle?(session[revisionField]=(session[revisionField]||0)+1):0;
    if(limit===1&&!replaceSingle)session[field]=[];
    const available=replaceSingle?1:limit-session[field].filter(item=>field!=='uploads'||!item.sample).length;
    try {
      // 用户导入自己的图片时移除演示商品，避免真实素材和初始样例混用。
      if(!singleProduct&&field==='uploads'&&session.uploads.some(item=>item.sample))session.uploads=[];
      for(const file of selectedFiles.slice(0,available)) {
        const url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
        if(replaceSingle){
          if(session[revisionField]!==revision)return;
          session[field]=[{name:file.name,url}];
        }else session[field].push({name:file.name,url});
      }
      if(active===session) { render(); if(imageFiles.length>available)toast(singleProduct?'只保留 1 张商品图，已使用第一张':`最多保留 ${limit} 张图片`); }
    }catch(error){console.warn('[yingdan-image-studio] 本地图片读取失败');toast('图片读取失败，请重试');}
  }
  /** 弹层关闭并恢复焦点。@returns {void} 无主动异常。 */
  function closeDialog(){
    const previous=active.dialog,repeatSource=active.repeatSource,infoReturnFocus=active.infoReturnFocus;active.dialog=null;
    if(previous==='repeat')active.repeatSource=null;
    if(previous==='attached-info'){delete active.attachedInfoDraft;delete active.infoReturnFocus;}
    render();
    const selector=previous==='attached-info'?(infoReturnFocus||'[data-direction]'):previous==='repeat'&&repeatSource
      ?`[data-gallery-record="${repeatSource.record.resultId}"][data-gallery-index="${repeatSource.index}"][data-gallery-action="repeat"]`
      :GENERATION_TYPES[mode]&&['preview','adjust'].includes(previous)
      ?`[data-gallery-record="${active.resultId}"][data-gallery-index="${active.selected}"][data-gallery-action="${previous}"]`
      :previous==='preview'?`[data-preview="${active.selected}"]`:`[data-action="${previous==='history'?'history':'templates'}"]`;
    root?.querySelector(selector)?.focus();
  }
  /** 演示下载所点记录或单张图片，不读取左侧当前选项，也不触发真实文件下载。@param {object} record 所点图片记录。@param {number|null} index 单图索引，null 表示整组。@returns {number} 本次选中的图片数量，非法输入为 0。不抛异常。 */
  function downloadRecord(record,index=null) {
    if(!record?.results?.length)return 0;
    if(index!==null&&(!Number.isInteger(index)||index<0||index>=record.results.length))return 0;
    const amount=index===null?record.results.length:1;
    toast(index===null?`整套下载已演示，共 ${amount} 张示例图片`:'单张下载已演示，当前为示例图片');
    console.info('[yingdan-image-studio] 下载演示',{mode:record.resultMode,recordId:record.resultId,index,count:amount});
    return amount;
  }

  /** 按键及按钮动作分发。@param {string} action 固定动作标识。@returns {void} 无主动异常。 */
  function action(action) {
    if(action==='start')return plan(true);
    if(action==='plan')return plan();
    if(action==='generate')return generate();
    if(action==='close')return closeDialog();
    if(action==='attached-info')return openAttachedInfo();
    if(action==='set-content') {if(!isSuiteMode()||['planning','generating'].includes(active.phase)||active.refining)return;active.setContentOpen=!active.setContentOpen;render();root?.querySelector('[data-action="set-content"]')?.focus();return;}
    if(action==='add-set-slot') {if(changeSetSlots())root?.querySelector(`[data-set-role="${active.setSlots.at(-1).id}"]`)?.focus();return;}
    if(['reset','history','settings','adjust','example'].includes(action)&&(['planning','generating'].includes(active.phase)||active.refining))return toast('当前任务完成后可以操作');
    if(action==='reset'){const history=active.history;active=initial();active.results=[];active.uploads=[];active.prompt='';active.phase='empty';active.history=history;sessions[mode]=active;}
    if(action==='settings')return toggleSettings();
    if(action==='adjust'){active.adjustment=active.results[active.selected].note||'';active.dialog='adjust';}
    if(action==='apply-adjustment')return adjustImage();
    if(action==='back-settings')active.phase=active.results.length?'results':'empty';
    if(action==='templates')active.dialog='templates';
    if(action==='history')active.dialog='history';
    if(action==='logo')active.showLogo=!active.showLogo;
    if(action==='example'){const sample=initial();Object.assign(active,{results:sample.results,resultMode:sample.resultMode,resultType:sample.resultType,resultRatio:sample.resultRatio,resultModel:sample.resultModel,resultQuantity:sample.resultQuantity,resultTime:sample.resultTime,resultCreatedAt:sample.resultCreatedAt,resultId:sample.resultId,resultContext:copyGenerationContext(sample.resultContext),selected:0,phase:'results'});if(GENERATION_TYPES[mode]){active.uploads=sample.uploads;active.prompt=sample.prompt;}}
    if(action==='previous')active.selected=(active.selected-1+active.results.length)%active.results.length;
    if(action==='next')active.selected=(active.selected+1)%active.results.length;
    if(action==='download'||action==='download-one')return downloadRecord(resultSnapshot(active),action==='download-one'?active.selected:null);
    render();
  }
  /** 绑定当前渲染节点上的表单和弹层事件。@returns {void} 无主动异常。 */
  function bind() {
    root.querySelectorAll('[data-action]').forEach(el=>el.onclick=()=>action(el.dataset.action));
    // 保留内层折叠状态，修改参数或上传 Logo 触发重绘时不会把正在填写的内容收起。
    root.querySelectorAll('[data-settings-section]').forEach(el=>el.ontoggle=()=>{if(el.isConnected)active[el.dataset.settingsSection]=el.open;});
    root.querySelectorAll('[data-field]').forEach(el=>el.oninput=()=>{const field=el.dataset.field;active[field]=field==='quantity'?Number(el.value):el.value;if(field==='attachedInfoDraft')el.setCustomValidity('');if(el.tagName==='SELECT'){render();root.querySelector(`[data-field="${field}"]`)?.focus();}});
    root.querySelectorAll('[data-gallery-action]').forEach(el=>el.onclick=()=>{
      if(['planning','generating'].includes(active.phase)||active.refining)return toast('当前任务完成后可以操作');
      const record=(isSuiteMode()?setGalleryRecords():galleryRecords()).find(item=>item.resultId===el.dataset.galleryRecord);
      if(!record)return;
      const command=el.dataset.galleryAction;
      if(command==='download'||command==='download-one')return downloadRecord(record,command==='download-one'?Number(el.dataset.galleryIndex):null);
      if(command==='repeat-set')return repeatSet(record);
      if(command==='redo-set-image')return redoSetImage(record,Number(el.dataset.galleryIndex));
      if(command==='repeat')return openRepeat(record,Number(el.dataset.galleryIndex||0));
      selectRecord(record,Number(el.dataset.galleryIndex||0));
      if(command==='preview'){active.dialog='preview';render();}else action(command);
    });
    const repeatForm=root.querySelector('[data-repeat-form]');
    if(repeatForm)repeatForm.onsubmit=event=>{event.preventDefault();createSimilar();};
    const infoForm=root.querySelector('[data-attached-info-form]');
    if(infoForm)infoForm.onsubmit=event=>{event.preventDefault();saveAttachedInfo();};
    root.querySelectorAll('.studio-image-info').forEach(container=>{
      const trigger=container.querySelector('[data-info-toggle]');
      container.onmouseenter=()=>setImageInfoOpen(container,true);
      container.onmouseleave=()=>{if(!container.dataset.pinned)setImageInfoOpen(container,false);};
      trigger.onfocus=()=>setImageInfoOpen(container,true);
      container.onfocusout=event=>{if(!container.contains(event.relatedTarget)){delete container.dataset.pinned;setImageInfoOpen(container,false);}};
      trigger.onclick=()=>{const open=!container.dataset.pinned;if(open)container.dataset.pinned='true';else delete container.dataset.pinned;setImageInfoOpen(container,open);};
    });
    root.onclick=event=>{if(!event.target.closest('.studio-image-info'))root.querySelectorAll('.studio-image-info').forEach(container=>{delete container.dataset.pinned;setImageInfoOpen(container,false);});};
    root.querySelectorAll('[data-direction]').forEach(el=>el.onchange=()=>chooseDirection(el.value));

    root.querySelectorAll('[data-set-role]').forEach(el=>el.onchange=()=>{if(updateSetRole(el.dataset.setRole,el.value))root.querySelector(`[data-set-role="${el.dataset.setRole}"]`)?.focus();});
    root.querySelectorAll('[data-set-remove]').forEach(el=>el.onclick=()=>{if(changeSetSlots(el.dataset.setRemove))root.querySelector('[data-action="add-set-slot"]')?.focus();});
    root.querySelectorAll('[data-set-note]').forEach(el=>el.onclick=()=>{const id=el.dataset.setNote;active.setNotesOpen[id]=el.getAttribute('aria-expanded')!=='true';render();root.querySelector(`[data-set-note="${id}"]`)?.focus();});
    root.querySelectorAll('[data-set-brief]').forEach(el=>el.oninput=()=>{const slot=active.setSlots.find(item=>item.id===el.dataset.setBrief);if(slot)slot.brief=el.value;refreshSetExample();});
    root.querySelectorAll('[data-structure]').forEach(el=>el.onclick=()=>{active.template=el.dataset.structure;render();root.querySelector(`[data-structure="${active.template}"]`)?.focus();});
    root.querySelectorAll('[data-type]').forEach(el=>el.onclick=()=>{active.type=el.dataset.type;active.template=active.type==='listing'?'listing':active.template==='listing'?'dense':active.template;active.phase=active.results.length?'results':'empty';render();});
    root.querySelectorAll('[data-retouch]').forEach(el=>el.onclick=()=>{active.retouch=el.dataset.retouch;render();});
    root.querySelectorAll('[data-template]').forEach(el=>el.onclick=()=>{active.template=el.dataset.template;active.dialog=null;render();});
    root.querySelectorAll('[data-preview]').forEach(el=>el.onclick=()=>{active.selected=Number(el.dataset.preview);active.dialog='preview';render();});
    root.querySelectorAll('[data-edit]').forEach(el=>el.onclick=()=>{const plan=active.plans[Number(el.dataset.edit)];plan.edit=!plan.edit;render();});
    root.querySelectorAll('[data-feedback]').forEach(el=>el.oninput=()=>{active.plans[Number(el.dataset.feedback)].feedback=el.value;});
    root.querySelectorAll('[data-refine]').forEach(el=>el.onclick=()=>{const plan=active.plans[Number(el.dataset.refine)];if(!plan.feedback.trim())return toast('请填写这一张的修改意见');plan.prompt=plan.prompt.replace(/\n调整要求：[\s\S]*$/,'')+'\n调整要求：'+plan.feedback;plan.edit=false;render();toast('这一张的生成方案已更新');});
    root.querySelectorAll('[data-upload]').forEach(el=>el.onchange=()=>void addFiles(el.dataset.upload,el.files));
    root.querySelectorAll('[data-remove]').forEach(el=>el.onclick=()=>{const [field,i]=el.dataset.remove.split(':');if(['image-main','image-set','image-listing'].includes(mode)&&field==='uploads')active.productUploadRevision=(active.productUploadRevision||0)+1;if(field==='style'||field==='logo')active[`${field}UploadRevision`]=(active[`${field}UploadRevision`]||0)+1;active[field].splice(Number(i),1);render();});
    root.querySelectorAll('[data-drop]').forEach(el=>{el.ondragover=event=>{event.preventDefault();el.classList.add('drag-over');};el.ondragleave=()=>el.classList.remove('drag-over');el.ondrop=event=>{event.preventDefault();el.classList.remove('drag-over');void addFiles(el.dataset.drop,event.dataTransfer.files);};});
    root.querySelectorAll('[data-history]').forEach(el=>el.onclick=()=>{const record=active.history[Number(el.dataset.history)];selectRecord(record);render();root.querySelector(`[data-gallery-record="${record.resultId}"][data-gallery-action="preview"]`)?.focus();});
    const overlay=root.querySelector('.studio-overlay');if(overlay)overlay.onclick=event=>{if(event.target===overlay)closeDialog();};
    root.onpaste=event=>{if(event.clipboardData?.files.length){event.preventDefault();void addFiles('uploads',event.clipboardData.files);}};
    root.onkeydown=event=>{if(event.key==='Escape')root.querySelectorAll('.studio-image-info').forEach(container=>{delete container.dataset.pinned;setImageInfoOpen(container,false);});if(!active.dialog)return;if(event.key==='Escape')closeDialog();if(active.dialog==='preview'&&event.key==='ArrowLeft')action('previous');if(active.dialog==='preview'&&event.key==='ArrowRight')action('next');if(event.key==='Tab'){const targets=[...root.querySelectorAll('[role="dialog"] button, [role="dialog"] input, [role="dialog"] select, [role="dialog"] textarea, [role="dialog"] summary')].filter(el=>!el.disabled&&el.getClientRects().length);const first=targets[0],last=targets.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};
    if(active.dialog==='attached-info')root.querySelector('[data-field="attachedInfoDraft"]')?.focus();
    else if(active.dialog)root.querySelector('[role="dialog"] button')?.focus();
  }
  /** 挂载入口。@param {HTMLElement} element 宿主。@param {string} selectedMode 路由业务 ID。@returns {void} 缺少宿主时抛 Error。 */
  function mount(element,selectedMode){if(!element)throw new Error('缺少 AI 作图容器');root=element;mode=selectedMode;active=sessions[mode]||(sessions[mode]=initial());if(!GENERATION_TYPES[mode]&&active.resultTime==='示例作品'&&active.phase==='results'){active.results=[];active.phase='empty';}render();console.info('[yingdan-image-studio] 页面已加载',{mode});}
  return {mount};
})();
