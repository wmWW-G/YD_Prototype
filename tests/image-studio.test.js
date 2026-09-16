const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../src/image-studio.js'), 'utf8');

/**
 * 独立执行作图状态逻辑，以可控时钟检查异步生成，不打开浏览器或调用模型。
 * @param {Function} [FileReader] 可选的受控文件读取器，用于测试读取成功、失败和并发替换。
 * @returns {object} 测试入口及 runPending 定时器推进函数。源码执行错误会直接抛出。
 */
function harness(FileReader, run = async () => { throw new Error("未配置"); }) {
  const timeouts = new Map(), intervals = new Map();
  let sequence = 0;
  const sandbox = {
    window: { YD_IMAGE_CLIENT: {run} }, FileReader, console: {info() {}, warn() {}},
    setTimeout(fn) { const id = ++sequence; timeouts.set(id, fn); return id; },
    clearTimeout(id) { timeouts.delete(id); },
    setInterval(fn) { const id = ++sequence; intervals.set(id, fn); return id; },
    clearInterval(id) { intervals.delete(id); }
  };
  // 仅在测试副本暴露私有状态；生产模块仍只有 mount 入口。
  vm.runInNewContext(source.replace('return {mount};', `return {
    initial, copyGenerationContext, resultSnapshot, galleryRecords, renderImageInfo,
    plan, openRepeat, createSimilar, chooseDirection, openAttachedInfo, saveAttachedInfo,
    closeDialog, renderDirectionControl, renderInlineSettings, addFiles,
    changeSetSlots, updateSetRole, buildSetPlans, repeatSet, redoSetImage,
    count, setGalleryRecords, renderSetContentEditor, renderSetRecord, downloadRecord, adjustImage,
    setActive(session, selectedMode = 'image-main') { active = session; mode = selectedMode; }
  };`), sandbox);
  return {
    ...sandbox.window.YD_IMAGE_STUDIO,
    /** 推进所有待执行回调，若逻辑无法结束则断言失败。@returns {void} */
    runPending() {
      for (let tick = 0; tick < 30 && (timeouts.size || intervals.size); tick++) {
        for (const [id, fn] of [...timeouts]) { timeouts.delete(id); fn(); }
        for (const fn of [...intervals.values()]) fn();
      }
      assert.equal(timeouts.size + intervals.size, 0, '本地任务应正常结束');
    }
  };
}

/** 创建独立整套会话，不依赖主图生成。@param {string} selectedMode 套图或详情图入口。@returns {object} 测试 API 和套图状态。不抛异常。 */
function setHarness(selectedMode = 'image-set') {
  const api = harness();
  api.setActive(null, selectedMode);
  const session = api.initial();
  api.setActive(session, selectedMode);
  return {api, session};
}

test('副图可增删和更换用途，主图固定，数量限制及新建后的示例可预览', () => {
  const {api, session} = setHarness();
  assert.equal(api.changeSetSlots('main'), false);
  assert.equal(api.updateSetRole('main', 'detail'), false);
  assert.equal(api.updateSetRole('secondary-1', 'main'), false);
  assert.equal(api.updateSetRole('secondary-1', 'unknown'), false);
  for (let i = 0; i < 4; i++) assert.equal(api.changeSetSlots(), true);
  assert.equal(api.changeSetSlots(), false);
  assert.equal(session.results.length, 10);
  assert.equal(new Set(session.setSlots.map(slot => slot.id)).size, 10);
  for (let i = 0; i < 8; i++) assert.equal(api.changeSetSlots(session.setSlots.at(-1).id), true);
  assert.equal(session.setSlots.length, 2);
  assert.equal(api.changeSetSlots(session.setSlots.at(-1).id), false);
  session.results = [];
  session.phase = 'empty';
  const sample = api.setGalleryRecords()[0];
  assert.equal(sample.results.length, 2);
  assert.equal(sample.resultId, 'sample-image-set');
  assert.equal(session.history.length, 0, '临时示例不冒充生成历史');
});

test('套图单图上传原子替换，多文件仅取第一张，失败和并发不覆盖正确图片', async () => {
  const readers = [];
  class Reader {
    /** 暂存读取器供测试决定顺序。@param {object} file 模拟文件。@returns {void} 不抛异常。 */
    readAsDataURL(file) {this.result=file.name;readers.push(this);}
  }
  const api=harness(Reader);
  api.setActive(null,'image-set');
  const session=api.initial();
  api.setActive(session,'image-set');
  /** 构造不涉及磁盘的模拟图片。@param {string} name 文件名。@returns {object} 图片输入。不抛异常。 */
  const file=name=>({name,type:'image/png',size:100});
  const first=api.addFiles('uploads',[file('first.png'),file('ignored.png')]);
  assert.equal(readers.length,1);
  readers[0].onload();await first;
  assert.equal(session.uploads.length,1);
  assert.equal(session.uploads[0].name,'first.png');
  const failed=api.addFiles('uploads',[file('bad.png')]);
  readers[1].onerror();await failed;
  assert.equal(session.uploads[0].name,'first.png');
  const earlier=api.addFiles('uploads',[file('earlier.png')]);
  const latest=api.addFiles('uploads',[file('latest.png')]);
  readers[3].onload();await latest;
  readers[2].onload();await earlier;
  assert.equal(session.uploads.length,1);
  assert.equal(session.uploads[0].name,'latest.png');
  await api.addFiles('uploads',[{...file('large.png'),size:11*1024*1024}]);
  assert.equal(session.uploads[0].name,'latest.png');
  api.setActive(null,'image-poster');
  const poster=api.initial();
  api.setActive(poster,'image-poster');
  const multiple=api.addFiles('uploads',[file('a.png'),file('b.png')]);
  readers[4].onload();await Promise.resolve();
  readers[5].onload();await multiple;
  assert.equal(poster.uploads.length,2,'海报仍允许多张素材');
});

test('信息小标使用原方向，参考图优先，缺失参数不套用当前输入', () => {
  const api = harness(), session = api.initial();
  api.setActive(session);
  session.visualStyle = '创意表达';
  assert.match(api.renderImageInfo(session, 0), /简洁展示/);
  assert.doesNotMatch(api.renderImageInfo(session, 0), /创意表达/);
  const record = api.resultSnapshot(session);
  record.resultContext.style = [{name: '<参考图>', url: 'reference.jpg'}];
  const info = api.renderImageInfo(record, 0);
  assert.match(info, /reference.jpg/);
  assert.match(info, /&lt;参考图&gt;/);
  assert.doesNotMatch(info, /画面方向|简洁展示/);
  record.resultContext = null;
  assert.match(api.renderImageInfo(record, 0), /未记录/);
  api.openRepeat(record, 0);
  assert.equal(session.dialog, null, '无法恢复原始输入时不静默使用左侧参数');
});

test('附带信息确认后才切换方向，取消初次填写或编辑均保留旧值', () => {
  const api = harness(), session = api.initial();
  api.setActive(session);
  api.chooseDirection('场景应用');
  api.chooseDirection('附带信息');
  assert.equal(session.dialog, 'attached-info');
  assert.equal(session.visualStyle, '场景应用');
  session.attachedInfoDraft = '未确认文字';
  api.closeDialog();
  assert.equal(session.visualStyle, '场景应用');
  assert.equal(session.attachedInfo, '');
  api.chooseDirection('附带信息');
  session.attachedInfoDraft = '  商品标题\n关键规格  ';
  assert.equal(api.saveAttachedInfo(), true);
  assert.equal(session.visualStyle, '附带信息');
  assert.equal(session.attachedInfo, '商品标题\n关键规格');
  assert.equal(session.dialog, null);
  api.openAttachedInfo();
  assert.equal(session.attachedInfoDraft, '商品标题\n关键规格');
  session.attachedInfoDraft = '本次修改不保存';
  api.closeDialog();
  assert.equal(session.attachedInfo, '商品标题\n关键规格');
  assert.equal(session.visualStyle, '附带信息');
});

test('附带信息拒绝空白和超长输入，保留草稿供修正', () => {
  const api = harness(), session = api.initial();
  api.setActive(session);
  api.chooseDirection('附带信息');
  for (const invalid of ['', ' \n\t ', '字'.repeat(501)]) {
    session.attachedInfoDraft = invalid;
    assert.equal(api.saveAttachedInfo(), false);
    assert.equal(session.dialog, 'attached-info');
    assert.equal(session.visualStyle, '简洁展示');
    assert.equal(session.attachedInfoDraft, invalid);
  }
  session.attachedInfoDraft = '字'.repeat(500);
  assert.equal(api.saveAttachedInfo(), true);
});

test('Logo 替换原子完成，失败保留旧图，并发采用最后选择且不影响风格参考图', async () => {
  const readers = [];
  class ControlledReader {
    /** 暂存读取器，由测试指定完成顺序。@param {object} file 测试文件。@returns {void} 不抛异常。 */
    readAsDataURL(file) { this.result = file.url; readers.push(this); }
  }
  const api = harness(ControlledReader), session = api.initial();
  api.setActive(session);
  session.logo = [{name: '旧标识', url: 'old-logo.png'}];
  /** 构造无真实文件读写的图片输入。@param {string} name 名称。@returns {object} 小体积 PNG 文件。不抛异常。 */
  const file = name => ({name, url: name, type: 'image/png', size: 100});
  const failed = api.addFiles('logo', [file('failed.png')]);
  readers[0].onerror(new Error('模拟读取失败'));
  await failed;
  assert.equal(session.logo[0].url, 'old-logo.png');
  const earlier = api.addFiles('logo', [file('earlier.png')]);
  const latest = api.addFiles('logo', [file('latest.png'), file('extra.png')]);
  const style = api.addFiles('style', [file('style.png')]);
  readers[2].onload();
  await latest;
  readers[3].onload();
  await style;
  readers[1].onload();
  await earlier;
  assert.equal(session.logo.length, 1);
  assert.equal(session.logo[0].url, 'latest.png');
  assert.equal(session.style[0].url, 'style.png');
});


test('详情图只保留一张商品图，读取失败和并发更换不会清空原图', async () => {
  const readers = [];
  class Reader {
    /** 保存模拟读取器，按测试指定次序完成。@param {object} file 图片文件。@returns {void} 不抛异常。 */
    readAsDataURL(file) {this.result=file.name;readers.push(this);}
  }
  const api = harness(Reader);
  api.setActive(null,'image-listing');const session=api.initial();api.setActive(session,'image-listing');
  /** 构造无需读取磁盘的测试图片。@param {string} name 文件名。@returns {object} 文件描述。不抛异常。 */
  const file = name => ({name,type:'image/png',size:100});
  const first=api.addFiles('uploads',[file('first.png'),file('ignored.png')]);
  assert.equal(readers.length,1);readers[0].onload();await first;
  assert.equal(session.uploads.length,1);
  const failed=api.addFiles('uploads',[file('bad.png')]);readers[1].onerror();await failed;
  assert.equal(session.uploads[0].name,'first.png');
  const old=api.addFiles('uploads',[file('old.png')]),latest=api.addFiles('uploads',[file('latest.png')]);
  readers[3].onload();await latest;readers[2].onload();await old;
  assert.equal(session.uploads[0].name,'latest.png');
  assert.equal(session.uploads.length,1);
});


test('套图和详情图示例也提供整套下载、单张调整与下载入口', () => {
  for (const selectedMode of ['image-set','image-listing']) {
    const {api, session} = setHarness(selectedMode);
    const record = api.resultSnapshot(session), markup = api.renderSetRecord(record);
    assert.equal((markup.match(/data-gallery-action="download"/g)||[]).length, 1);
    assert.equal((markup.match(/data-gallery-action="adjust"/g)||[]).length, record.results.length);
    assert.equal((markup.match(/data-gallery-action="download-one"/g)||[]).length, record.results.length);
    assert.match(markup, /class="studio-set-download"/);
    assert.match(markup, new RegExp(`<span>${record.results.length} 张</span>`));
  }
});

/** 可控网络桩，显式完成或拒绝，不依赖模拟计时器冒充生图。 */
function liveHarness(mode='image-main') {
 const calls=[];
 const api=harness(undefined,(kind,inputs,files,onProgress)=>new Promise((resolve,reject)=>calls.push({kind,inputs,files,onProgress,resolve,reject})));
 api.setActive(null,mode);const session=api.initial();api.setActive(session,mode);
 return {api,session,calls};
}
/** 等待已解决的网络Promise传回状态层。 */
async function settle(){for(let i=0;i<8;i++)await Promise.resolve();}
/** 构造真实结果结构，图片URL区别于所有示例素材。 */
function complete(call,status='succeeded') {
 const base={status,model:'gpt-image-2.5-flare'};
 const result=['set','listing'].includes(call.kind)?{...base,items:JSON.parse(call.inputs.slots_json).filter(x=>!call.inputs.retry_slot_ids_json||JSON.parse(call.inputs.retry_slot_ids_json).includes(x.id)).map((slot,index)=>({slot_id:slot.id,title:slot.role,status:'succeeded',images:[{index:0,url:'https://example.com/'+slot.id+'.png'}]}))}:{...base,images:Array.from({length:call.inputs.quantity||1},(_,index)=>({index,url:'https://example.com/new-'+index+'.png'}))};
 call.resolve({result,plan:[],workflow_run_id:'run-test'});
}
test('主图发送历史冻结的商品/Logo/语言/附带信息，成功才替换示例',async()=>{
 const {api,session,calls}=liveHarness();session.visualStyle='附带信息';session.attachedInfo='真实文案';session.logo=[{url:'logo.png'}];session.targetLanguage='中文';
 const old=session.results[0].image;api.plan(true);api.plan(true);assert.equal(calls.length,1);assert.equal(session.results[0].image,old);
 session.logo[0].url='changed.png';session.attachedInfo='later';
 assert.equal(calls[0].files.logo_image.url,'logo.png');assert.equal(calls[0].inputs.image_text,'真实文案');assert.equal(calls[0].inputs.language,'中文');
 complete(calls[0]);await settle();assert.equal(session.results[0].image,'https://example.com/new-0.png');assert.equal(session.resultContext.imageText,'真实文案');
});
test('套图/详情按选中图位顺序传语义名称，无数量参数，空规格说明允许',async()=>{
 for(const mode of ['image-set','image-listing']){
  const {api,session,calls}=liveHarness(mode);session.quantity=9;session.setSlots[1].role='spec';session.setSlots[1].brief='';session.uploads.push({url:'ignored.png'});
  api.plan(true);assert.equal(calls.length,1);assert.equal(calls[0].inputs.quantity,undefined);
  const slots=JSON.parse(calls[0].inputs.slots_json);assert.equal(slots.length,mode==='image-set'?6:8);assert.match(slots[1].role,/规格/);assert.equal(slots[1].brief,'');
  api.setActive(null,'image-main');const other=api.initial();api.setActive(other,'image-main');complete(calls[0]);await settle();
  assert.equal(session.results.length,slots.length);assert.equal(other.history.length,0);assert.equal(session.resultContext.quantity,1);
 }
});
test('错误保留原图且不伪造成功记录，partial保留已取得图片',async()=>{
 const {api,session,calls}=liveHarness();const before=JSON.stringify(session.results);api.plan(true);calls[0].reject(new Error('连接中断'));await settle();
 assert.equal(JSON.stringify(session.results),before);assert.equal(session.history.length,0);assert.equal(session.runError,'连接中断');
 api.plan(true);complete(calls[1],'partial');await settle();assert.equal(session.results[0].real,true);assert.match(session.runError,/部分/);
});
test('套图部分成功保留原图位序号，不把第一张成功副图编号为零',async()=>{
 const {api,session,calls}=liveHarness('image-set');api.plan(true);
 const slot=JSON.parse(calls[0].inputs.slots_json)[1];
 calls[0].resolve({result:{status:'partial',model:'gpt-image-2.5-flare',items:[{slot_id:slot.id,title:slot.role,images:[{url:'https://example.com/partial.png'}]}]},plan:[]});
 await settle();assert.equal(session.results.length,1);assert.equal(session.results[0].slotIndex,1);assert.match(session.runError,/部分/);
});
test('同款走独立流程，使用所选结果图与原商品，数量不乘套图张数',async()=>{
 const {api,session,calls}=liveHarness('image-set');const old=api.resultSnapshot(session);api.openRepeat(old,2);session.repeatQuantity=3;
 assert.equal(api.createSimilar(),true);assert.equal(calls[0].kind,'similar');assert.equal(calls[0].inputs.quantity,3);assert.equal(calls[0].files.source_image.url,old.results[2].image);
 session.uploads=[{url:'later.png'}];complete(calls[0]);await settle();assert.equal(session.results.length,3);assert.equal(session.resultContext.uploads[0].url,old.resultContext.uploads[0].url);
 for(const invalid of [0,11,2.5]){api.openRepeat(old,0);session.repeatQuantity=invalid;assert.equal(api.createSimilar(),false);}
});
test('单张调整调用edit且只替换选中图，失败不修改原图',async()=>{
 const {api,session,calls}=liveHarness('image-set');api.plan(true);complete(calls[0]);await settle();const first=session.results[0].image;
 session.selected=2;session.adjustment='换白背景';const work=api.adjustImage();assert.equal(calls[1].kind,'edit');assert.equal(calls[1].inputs.instruction,'换白背景');
 complete(calls[1]);await work;assert.equal(session.results[0].image,first);assert.equal(session.results[2].image,'https://example.com/new-0.png');
 session.adjustment='继续修改';const failed=api.adjustImage();calls[2].reject(new Error('失败'));await failed;assert.equal(session.results[2].image,'https://example.com/new-0.png');
});
test('整套重做指定图位传完整方案加retry，只更新该记录，拒绝跨入口记录',async()=>{
 const {api,session,calls}=liveHarness('image-listing');api.plan(true);complete(calls[0]);await settle();const record=api.resultSnapshot(session);
 const work=api.redoSetImage(record,2);assert.deepEqual(JSON.parse(calls[1].inputs.retry_slot_ids_json),[record.results[2].slotId]);assert.equal(JSON.parse(calls[1].inputs.slots_json).length,8);
 complete(calls[1]);await work;assert.equal(session.results[2].revision,1);assert.equal(session.results[0].revision,undefined);
 assert.equal(await api.redoSetImage({...record,resultMode:'image-set'},0),false);
});

// 防止新增选项意外增加默认张数，或提交时丢失每张对应的企业资料。
test('新增企业主题按语义传输，逐张补充资料与历史快照保持对应',async()=>{
 for(const mode of ['image-set','image-listing']){
  const {api,session,calls}=liveHarness(mode);
  assert.equal(session.setSlots.length,mode==='image-set'?6:8);
  api.updateSetRole(session.setSlots[1].id,'company');
  api.updateSetRole(session.setSlots[2].id,'manufacturing');
  session.setSlots[0].brief='主视觉说明';session.setSlots[1].brief='测试企业，十人团队';session.setSlots[2].brief='成型 → 烧制 → 检验';
  const html=api.renderSetContentEditor();assert.equal((html.match(/<textarea data-set-brief=/g)||[]).length,session.setSlots.length);
  api.plan(true);const slots=JSON.parse(calls[0].inputs.slots_json);
  assert.equal(slots[0].brief,'主视觉说明');assert.equal(slots[1].role,'公司实力');assert.equal(slots[2].role,'生产制造流程');assert.equal(slots[2].brief,'成型 → 烧制 → 检验');
  session.setSlots[2].brief='后续修改';complete(calls[0]);await settle();
  assert.equal(session.resultContext.setSlots[2].brief,'成型 → 烧制 → 检验');
 }
});
