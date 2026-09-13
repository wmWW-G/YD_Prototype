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
function harness(FileReader) {
  const timeouts = new Map(), intervals = new Map();
  let sequence = 0;
  const sandbox = {
    window: {}, FileReader, console: {info() {}, warn() {}},
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

test('套图默认一主五副，每次固定一套，旧套数和多图输入不扩大本次任务', () => {
  const {api, session} = setHarness();
  assert.equal(session.setSlots.length, 6);
  assert.equal(session.setSlots[0].role, 'main');
  assert.equal(session.setSlots.filter(slot => slot.role === 'main').length, 1);
  session.quantity = 2;
  session.uploads.push({name:'旧补充图',url:'old-extra.jpg'});
  session.quality = '高';
  assert.equal(api.count(), 6);
  api.plan(true);
  assert.equal(session.phase, 'planning');
  assert.equal(api.changeSetSlots(), false, '生成期间不能添加副图');
  assert.equal(api.updateSetRole('secondary-1', 'detail'), false);
  api.runPending();
  assert.equal(session.results.length, 6);
  assert.ok(session.results.every(item => item.variant === 1));
  assert.equal(session.results.filter(item => item.role === 'main').length, 1);
  assert.equal(session.resultContext.quantity, 1);
  assert.equal(session.resultQuantity, 1);
  assert.equal(session.resultContext.uploads.length, 1);
  assert.equal(session.resultContext.quality, '中');
});

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

test('规格图需要明确参数，填写前阻止生成，说明中的用户内容安全转义', () => {
  const {api, session} = setHarness();
  api.updateSetRole('secondary-1', 'spec');
  api.plan(true);
  assert.equal(session.phase, 'results');
  assert.equal(session.setContentOpen, true);
  assert.equal(session.setNotesOpen['secondary-1'], true);
  assert.equal(session.history.length, 0);
  session.setSlots[1].brief = '容量 350 ml；<script>test</script>';
  assert.match(api.renderSetContentEditor(), /&lt;script&gt;test&lt;\/script&gt;/);
  assert.doesNotMatch(api.renderSetContentEditor(), /<script>/);
  api.plan(true);
  api.runPending();
  assert.match(session.plans[1].prompt, /容量 350 ml/);
  assert.equal(session.results[1].role, 'spec');
});

test('套图冻结逐图安排、素材和 Logo，跨入口生成及后续编辑不会串写', () => {
  const {api, session} = setHarness();
  session.setSlots[1].brief = '只展示已提供的特点';
  session.prompt = '整体暖色调、自然光，需要文字时使用英文';
  session.logo = [{name: '原 Logo', url: 'original-logo.png'}];
  session.ratio = '4:5';
  api.plan(true);
  session.setSlots[1].role = 'packaging';
  session.setSlots[1].brief = '后改说明';
  session.prompt = '后改统一要求';
  session.uploads[0].url = 'later-product.jpg';
  session.logo[0].url = 'later-logo.png';
  api.setActive(null, 'image-main');
  const main = api.initial();
  api.setActive(main);
  api.runPending();
  assert.equal(session.resultContext.setSlots[1].role, 'selling');
  assert.equal(session.results[1].brief, '只展示已提供的特点');
  assert.equal(session.resultContext.logo[0].url, 'original-logo.png');
  assert.notEqual(session.resultContext.uploads[0].url, 'later-product.jpg');
  assert.equal(session.resultRatio, '4:5');
  assert.match(session.plans[0].prompt, /品牌 Logo/);
  assert.ok(session.plans.every(item => item.prompt.includes('整套统一要求：整体暖色调、自然光，需要文字时使用英文')));
  assert.ok(session.plans.every(item => !item.prompt.includes('后改统一要求')));
  assert.match(session.plans[1].prompt, /本图要求：只展示已提供的特点/);
  assert.doesNotMatch(session.plans[0].prompt, /只展示已提供的特点/);
  assert.equal(main.history.length, 0);
  assert.equal(main.results.length, 1);
  const copy = api.resultSnapshot(session);
  copy.resultContext.setSlots[1].brief = '修改副本';
  assert.equal(session.history[0].resultContext.setSlots[1].brief, '只展示已提供的特点');
});

test('再生成一套沿用历史整套安排，保留旧结果与当前未提交的配置', () => {
  const {api, session} = setHarness();
  api.changeSetSlots('secondary-5');
  session.quantity = 2;
  session.setSlots[1].brief = '原卖点';
  session.logo = [{name: 'Logo', url: 'old-logo.png'}];
  api.plan(true);
  api.runPending();
  const record = api.resultSnapshot(session);
  session.setSlots[1].brief = '新卖点';
  api.changeSetSlots();
  session.quantity = 3;
  session.ratio = '9:16';
  const inputs = JSON.stringify(api.copyGenerationContext(session));
  assert.equal(api.repeatSet(record), true);
  assert.equal(api.repeatSet(record), false);
  api.runPending();
  assert.equal(session.results.length, 5);
  assert.ok(session.results.every(item => item.variant === 1));
  assert.equal(session.results[1].brief, '原卖点');
  assert.equal(session.resultContext.style[0].url, record.results[0].image);
  assert.equal(session.resultContext.logo[0].url, 'old-logo.png');
  assert.equal(session.resultRatio, '1:1');
  assert.equal(JSON.stringify(api.copyGenerationContext(session)), inputs);
  assert.equal(session.history.find(item => item.resultId === record.resultId).results.length, 5);
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

test('重做只更新所选记录的一张图，切换页面和重复点击不污染其他结果', () => {
  const {api, session} = setHarness();
  api.plan(true);
  api.runPending();
  const first = api.resultSnapshot(session);
  api.plan(true);
  api.runPending();
  const current = JSON.stringify(session.results);
  const unchanged = JSON.stringify(first.results[0]);
  assert.equal(api.redoSetImage(first, 2), true);
  assert.equal(api.redoSetImage(first, 2), false);
  api.setActive(null, 'image-main');
  const main = api.initial();
  api.setActive(main);
  api.runPending();
  const saved = session.history.find(item => item.resultId === first.resultId);
  assert.equal(saved.results[2].revision, 1);
  assert.equal(JSON.stringify(saved.results[0]), unchanged);
  assert.equal(JSON.stringify(session.results), current);
  assert.equal(main.refining, undefined);
  assert.equal(session.refining, false);
  assert.equal(session.history.length, 2);
});

test('套图单张调整在原组保存，不复制整套结果或改写其他图片', () => {
  const {api, session} = setHarness();
  api.plan(true);
  api.runPending();
  const originalId = session.resultId;
  const first = JSON.stringify(session.results[0]);
  session.selected = 2;
  session.adjustment = '提高背景亮度';
  api.adjustImage();
  api.runPending();
  assert.equal(session.resultId, originalId);
  assert.equal(session.history.length, 1);
  assert.equal(session.history[0].results[2].note, '提高背景亮度');
  assert.equal(JSON.stringify(session.results[0]), first);
  assert.equal(api.setGalleryRecords()[0].results.length, 6);
});

test('图片信息固定于生成时，左侧编辑与快照副本不会改变历史', () => {
  const api = harness(), session = api.initial();
  api.setActive(session);
  session.ratio = '4:5';
  session.visualStyle = '创意表达';
  session.style = [{name: '最初参考图', url: 'original-reference.jpg'}];
  api.plan(true);
  // 模拟异步过程中素材被替换，结果必须使用开始时的参数。
  session.style[0].url = 'later-reference.jpg';
  session.ratio = '16:9';
  session.uploads[0].name = '后来的商品';
  api.runPending();
  assert.equal(session.resultRatio, '4:5');
  assert.equal(session.resultContext.style[0].url, 'original-reference.jpg');
  assert.equal(session.resultContext.uploads[0].name, '示例商品');
  const snapshot = api.resultSnapshot(session);
  snapshot.resultContext.style[0].url = 'changed-copy.jpg';
  assert.equal(session.history[0].resultContext.style[0].url, 'original-reference.jpg');
  const info = api.renderImageInfo(session.history[0], 0);
  assert.match(info, /4:5/);
  assert.match(info, /original-reference.jpg/);
  assert.doesNotMatch(info, /later-reference|16:9|changed-copy/);
});

test('旧图生成同款按张计数，保留原图、原始商品和当前输入', () => {
  const api = harness();
  api.setActive(null, 'image-set');
  const session = api.initial();
  api.setActive(session, 'image-set');
  const original = api.resultSnapshot(session);
  session.ratio = '9:16';
  session.visualStyle = '场景应用';
  session.uploads = [{name: '另一个商品', url: 'new-product.jpg'}];
  session.style = [{name: '另一种风格', url: 'new-style.jpg'}];
  session.prompt = '暂时没有提交的要求';
  const currentInputs = JSON.stringify(api.copyGenerationContext(session));
  api.openRepeat(original, 3);
  session.repeatQuantity = '3';
  assert.equal(api.createSimilar(), true);
  assert.equal(api.createSimilar(), false, '重复提交不能启动第二次任务');
  api.runPending();
  assert.equal(session.results.length, 3, '套图同款不应乘以每版 6 张');
  assert.equal(session.resultContext.uploads[0].url, original.resultContext.uploads[0].url);
  assert.equal(session.resultContext.ratio, '1:1');
  assert.equal(session.resultContext.style[0].url, original.results[3].image);
  assert.equal(session.resultContext.style[0].sourceRecordId, original.resultId);
  assert.equal(session.resultContext.style[0].sourceIndex, 3);
  assert.ok(session.results.every(item => item.image === original.results[3].image));
  assert.equal(JSON.stringify(api.copyGenerationContext(session)), currentInputs);
  assert.equal(api.galleryRecords().length, 2);
  assert.equal(session.history.find(item => item.resultId === original.resultId).results.length, 6);
  assert.equal(original.resultContext.style.length, 0);
  assert.equal(api.galleryRecords()[0].resultId, session.resultId);
});

test('同款数量只接受 1–10 的整数，错误输入不会创建任务', () => {
  for (const quantity of ['', 0, -1, 2.5, 11, 'abc']) {
    const api = harness(), session = api.initial();
    api.setActive(session);
    api.openRepeat(api.resultSnapshot(session), 0);
    session.repeatQuantity = quantity;
    assert.equal(api.createSimilar(), false, String(quantity));
    assert.equal(session.phase, 'results');
    assert.equal(session.history.length, 0);
    assert.equal(session.dialog, 'repeat');
  }
  for (const quantity of [1, 10]) {
    const api = harness(), session = api.initial();
    api.setActive(session);
    api.openRepeat(api.resultSnapshot(session), 0);
    session.repeatQuantity = String(quantity);
    assert.equal(api.createSimilar(), true);
    api.runPending();
    assert.equal(session.results.length, quantity);
  }
});

test('同款生成期间切换入口，结果仍回到发起任务的会话', () => {
  const api = harness(), main = api.initial();
  api.setActive(main);
  api.openRepeat(api.resultSnapshot(main), 0);
  main.repeatQuantity = '2';
  api.createSimilar();
  api.setActive(null, 'image-poster');
  const poster = api.initial();
  api.setActive(poster, 'image-poster');
  api.runPending();
  assert.equal(main.resultMode, 'image-main');
  assert.equal(main.results.length, 2);
  assert.equal(poster.resultMode, 'image-poster');
  assert.equal(poster.history.length, 0);
  assert.equal(poster.resultTime, '示例作品');
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

test('文字按任务保存，后续编辑不改变历史，批量同款保留原文字', () => {
  const api = harness(), session = api.initial();
  api.setActive(session);
  api.chooseDirection('附带信息');
  session.attachedInfoDraft = '原始标题\n准确规格';
  api.saveAttachedInfo();
  api.plan(true);
  session.attachedInfo = '后改的文字';
  api.runPending();
  assert.equal(session.resultContext.imageText, '原始标题\n准确规格');
  assert.match(session.plans[0].prompt, /原始标题\n准确规格/);
  assert.doesNotMatch(session.plans[0].prompt, /后改的文字/);
  const record = api.resultSnapshot(session);
  api.chooseDirection('创意表达');
  api.openRepeat(record, 0);
  session.repeatQuantity = '2';
  api.createSimilar();
  api.runPending();
  assert.equal(session.resultContext.imageText, '原始标题\n准确规格');
  assert.match(session.plans[0].prompt, /原始标题\n准确规格/);
  assert.equal(session.visualStyle, '创意表达');
  assert.equal(session.attachedInfo, '后改的文字');
});

test('参考图和其他方向不会带入未启用的附带信息', () => {
  const api = harness(), session = api.initial();
  api.setActive(session);
  session.attachedInfo = '暂不展示的文字';
  api.plan(true);
  api.runPending();
  assert.equal(session.resultContext.imageText, '');
  assert.doesNotMatch(session.plans[0].prompt, /暂不展示/);
  session.visualStyle = '附带信息';
  session.style = [{name: '参考图', url: 'style.jpg'}];
  api.chooseDirection('附带信息');
  assert.equal(session.dialog, null);
  api.plan(true);
  api.runPending();
  assert.equal(session.resultContext.imageText, '');
  assert.doesNotMatch(session.plans[0].prompt, /暂不展示/);
  assert.equal(session.attachedInfo, '暂不展示的文字');
});

test('主图固定中等清晰度且不带入已移除字段，其他入口沿用原设置', () => {
  const api = harness(), session = api.initial();
  api.setActive(session);
  session.quality = '高';
  session.product = '旧商品名称';
  session.selling = '旧卖点';
  session.buyers = '旧客户';
  session.logo = [{name: '旧 Logo', url: 'old-logo.png'}];
  assert.doesNotMatch(api.renderInlineSettings(), /输出清晰度|补充商品信息|品牌 Logo/);
  assert.match(api.renderDirectionControl(), /value="附带信息"/);
  api.plan(true);
  api.runPending();
  assert.equal(session.resultContext.quality, '中');
  assert.equal(session.resultContext.logo[0].url, 'old-logo.png');
  assert.match(session.plans[0].prompt, /品牌 Logo/);
  assert.doesNotMatch(session.plans[0].prompt, /旧商品名称|旧卖点|旧客户|高清晰度/);
  const record = api.resultSnapshot(session);
  record.resultContext.quality = '高';
  api.openRepeat(record, 0);
  session.repeatQuantity = 1;
  api.createSimilar();
  api.runPending();
  assert.equal(session.resultContext.quality, '中');
  api.setActive(null, 'image-poster');
  const poster = api.initial();
  api.setActive(poster, 'image-poster');
  assert.match(api.renderInlineSettings(), /输出清晰度|补充商品信息/);
  assert.doesNotMatch(api.renderDirectionControl(), /value="附带信息"/);
  api.chooseDirection('附带信息');
  assert.equal(poster.dialog, null);
  poster.quality = '高';
  api.plan(true);
  api.runPending();
  assert.equal(poster.resultContext.quality, '高');
});

test('主图保留 Logo，图片生成和批量同款使用历史 Logo 而非当前更换的素材', () => {
  const api = harness(), session = api.initial();
  api.setActive(session);
  session.logo = [{name: '品牌标识', url: 'original-logo.png'}];
  api.plan(true);
  session.logo[0].url = 'later-logo.png';
  api.runPending();
  assert.equal(session.resultContext.logo[0].url, 'original-logo.png');
  assert.match(session.plans[0].prompt, /加入所提供的品牌 Logo/);
  const original = api.resultSnapshot(session);
  api.openRepeat(original, 0);
  session.repeatQuantity = 2;
  api.createSimilar();
  api.runPending();
  assert.equal(session.resultContext.logo[0].url, 'original-logo.png');
  assert.equal(session.logo[0].url, 'later-logo.png');
  assert.match(session.plans[0].prompt, /品牌 Logo/);
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


test('详情图默认八种内容，规格缺失时定位输入，统一要求与逐图内容冻结且跨入口不串写', () => {
  const {api, session} = setHarness('image-listing');
  assert.equal(session.setSlots.length, 8);
  assert.ok(session.setSlots.every(slot => slot.role !== 'main'));
  assert.equal(api.count(), 8);
  api.plan(true);
  assert.equal(session.phase, 'results');
  assert.equal(session.setContentOpen, true);
  assert.equal(session.setNotesOpen['detail-5'], true);
  session.setSlots[4].brief = '容量 350 ml';
  session.setSlots[0].brief = '仅用于介绍页的文字';
  session.prompt = '整套浅灰背景，文字用英文';
  session.quality = '高';
  session.quantity = 3;
  session.logo = [{name:'测试 Logo',url:'logo.png'}];
  api.plan(true);
  session.setSlots[0].brief = '后改文字';
  api.setActive(null, 'image-set');
  const other = api.initial();
  api.setActive(other, 'image-set');
  api.runPending();
  assert.equal(session.results.length, 8);
  assert.equal(session.resultMode, 'image-listing');
  assert.equal(session.resultContext.quality, '中');
  assert.equal(session.resultContext.quantity, 1);
  assert.ok(session.plans.every(item => item.title.startsWith('详情 ')));
  assert.ok(session.plans.every(item => item.prompt.includes('整套浅灰背景，文字用英文') && item.prompt.includes('品牌 Logo')));
  assert.match(session.plans[0].prompt, /仅用于介绍页的文字/);
  assert.ok(session.plans.slice(1).every(item => !item.prompt.includes('仅用于介绍页的文字')));
  assert.match(session.plans[5].title, /工艺与定制/);
  assert.match(session.plans[4].prompt, /容量 350 ml/);
  assert.equal(other.history.length, 0);
});

test('详情图首张可编辑和删除，按实际图位生成，最少一张最多十张', () => {
  const {api, session} = setHarness('image-listing');
  assert.equal(api.updateSetRole('detail-1', 'quality'), true);
  assert.equal(api.updateSetRole('detail-1', 'main'), false);
  assert.equal(api.changeSetSlots(), true);
  assert.equal(api.changeSetSlots(), true);
  assert.equal(api.changeSetSlots(), false);
  assert.equal(new Set(session.setSlots.map(item => item.id)).size, 10);
  assert.equal(api.changeSetSlots('detail-1'), true);
  while (session.setSlots.length > 1) api.changeSetSlots(session.setSlots[0].id);
  assert.equal(api.changeSetSlots(session.setSlots[0].id), false);
  assert.equal(api.count(), 1);
  session.results = [];
  const sample = api.setGalleryRecords()[0];
  assert.equal(sample.resultId, 'sample-image-listing');
  assert.equal(sample.results.length, 1);
  api.plan(true);api.runPending();
  assert.equal(session.results.length, 1);
  assert.equal(session.history.length, 1);
});

test('详情图再生成沿用历史内容，单张重做和调整不复制整组，拒绝套图记录', () => {
  const {api, session} = setHarness('image-listing');
  session.setSlots[4].brief = '容量 350 ml';
  api.plan(true);api.runPending();
  const first = api.resultSnapshot(session);
  session.setSlots[4].brief = '后改规格';
  assert.equal(api.repeatSet(first), true);api.runPending();
  assert.equal(session.resultContext.setSlots[4].brief, '容量 350 ml');
  assert.equal(session.resultMode, 'image-listing');
  assert.equal(session.results.length, 8);
  const current = api.resultSnapshot(session), count = session.history.length;
  assert.equal(api.redoSetImage(current, 1), true);api.runPending();
  assert.equal(session.results[1].revision, 1);
  assert.equal(session.results[0].revision, undefined);
  session.selected = 2;session.adjustment = '调整这张详情图';
  api.adjustImage();api.runPending();
  assert.equal(session.history.length, count);
  assert.equal(session.history.find(record=>record.resultId===session.resultId).results[2].note, '调整这张详情图');
  const wrong = {...current,resultMode:'image-set'};
  assert.equal(api.repeatSet(wrong), false);
  assert.equal(api.redoSetImage(wrong, 0), false);
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

test('整套下载使用所点历史记录的张数，单张下载只选择该图，不修改任务', () => {
  const {api, session} = setHarness();
  const original = api.resultSnapshot(session);
  api.changeSetSlots();
  const before = JSON.stringify(session);
  assert.equal(session.results.length, 7);
  assert.equal(api.downloadRecord(original), 6);
  assert.equal(api.downloadRecord(original, 3), 1);
  assert.equal(api.downloadRecord(original, -1), 0);
  assert.equal(api.downloadRecord(original, 6), 0);
  assert.equal(api.downloadRecord(original, 1.5), 0);
  assert.equal(JSON.stringify(session), before);
});

test('示例单张修改只更新当前图，更改其他图位不会清空该图调整', () => {
  for (const selectedMode of ['image-set','image-listing']) {
    const {api, session} = setHarness(selectedMode);
    const before = JSON.stringify(session.results[0]);
    session.selected = 1;session.adjustment = '背景改为浅灰，保留商品颜色';
    api.adjustImage();api.runPending();
    assert.equal(session.results[1].note, session.adjustment);
    assert.equal(JSON.stringify(session.results[0]), before);
    const selectedId=session.results[1].slotId;
    api.updateSetRole(session.setSlots.at(-1).id,'scene');
    assert.equal(session.results.find(item=>item.slotId===selectedId).note, session.adjustment);
    api.updateSetRole(selectedId,'spec');
    assert.equal(session.results.find(item=>item.slotId===selectedId).note, undefined);
  }
});
