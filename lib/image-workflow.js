const { createSsePayloadParser } = require('./dify-api-client');
const BASE = 'https://api.dify.ai/v1';
const KINDS = ['main', 'set', 'listing', 'edit', 'similar'];
const VERSION = 'image-studio-302-v3-candidate';
const FILES = { main: ['product_image','style_image','logo_image'], set: ['product_image','style_image','logo_image'], listing: ['product_image','style_image','logo_image'], edit: ['source_image'], similar: ['product_image','source_image'] };
/** 创建可公开的错误，不把上游正文、凭据和素材写进提示或日志。 */
function fail(message, code='invalid_input', status=400) { return Object.assign(new Error(message), {public:true,code,status}); }
/** 校验标准化业务输入；body是浏览器数据，返回白名单kind/inputs，非法数据抛公开错误。 */
function validateRequest(body) {
  const kind=body?.kind, input=body?.inputs;
  if(!KINDS.includes(kind)||!input||typeof input!=='object'||Array.isArray(input))throw fail('作图请求格式不正确。');
  const fields=[...FILES[kind],'instruction','language','aspect_ratio',...(['main','set','listing'].includes(kind)?['visual_direction']:[]),...(kind==='main'?['image_text']:[]),...(['main','similar'].includes(kind)?['quantity']:[]),...(['set','listing'].includes(kind)?['slots_json','retry_slot_ids_json']:[])];
  if(Object.keys(input).some(key=>!fields.includes(key)))throw fail('作图请求包含不支持的选项。');
  const inputs={};
  for(const [key,value] of Object.entries(input)) {
    if(FILES[kind].includes(key)) {
      if(!value)continue;
      // 文件只能来自本服务上传，禁止让服务端代请求任意URL或接受其他应用文件引用。
      if(value.type!=='image'||value.transfer_method!=='local_file'||typeof value.upload_file_id!=='string'||! /^[a-zA-Z0-9-]{1,100}$/.test(value.upload_file_id))throw fail('请重新上传图片。');
      inputs[key]={type:'image',transfer_method:'local_file',upload_file_id:value.upload_file_id};
    } else if(key==='quantity') {
      if(!Number.isInteger(value)||value<1||value>10)throw fail('生成数量须为1–10的整数。'); inputs[key]=value;
    } else {
      const limit={language:40,visual_direction:100,image_text:2000,slots_json:12000,retry_slot_ids_json:2000}[key]||4000;
      if(typeof value!=='string'||value.length>limit)throw fail('文字格式不正确或超过长度限制。'); inputs[key]=value.trim();
    }
  }
  inputs.language ||= '英语'; inputs.aspect_ratio ||= kind==='edit'?'auto':'1:1';
  if(!['1:1','2:3','3:2','3:4','4:3','4:5','5:4','9:16','16:9',...(kind==='edit'?['auto']:[])].includes(inputs.aspect_ratio))throw fail('画面比例不支持。');
  if((kind==='edit'||(!inputs.product_image&&!inputs.source_image))&&!inputs.instruction)throw fail('请填写商品描述和画面要求。');
  if(kind==='main'&&inputs.visual_direction==='附带信息'&&!inputs.style_image&&!inputs.image_text)throw fail('请填写需要展示的文字。');
  if(['set','listing'].includes(kind)) {
    let slots;try{slots=JSON.parse(inputs.slots_json);}catch{throw fail('逐张内容格式不正确。');}
    if(!Array.isArray(slots)||slots.length<(kind==='set'?2:1)||slots.length>10)throw fail('请选择有效的整套图片内容。');
    const ids=new Set();
    for(const slot of slots){
      if(!slot||Object.keys(slot).sort().join(',')!=='brief,id,role'||typeof slot.id!=='string'||! /^[\w-]{1,80}$/.test(slot.id)||ids.has(slot.id)||typeof slot.role!=='string'||!slot.role.trim()||slot.role.length>100||typeof slot.brief!=='string'||slot.brief.length>500)throw fail('逐张内容格式不正确或图位重复。');
      ids.add(slot.id);
    }
    if(inputs.retry_slot_ids_json){let retry;try{retry=JSON.parse(inputs.retry_slot_ids_json);}catch{throw fail('重试内容格式不正确。');}
      if(!Array.isArray(retry)||!retry.length||new Set(retry).size!==retry.length||retry.some(id=>!ids.has(id)))throw fail('重试图位不属于当前方案。');}
  }
  return {kind,inputs};
}
/** 将base64图片转换为上传数据；只接受3种格式和10MiB以内的有效魔数，不处理远程URL。 */
function decodeUpload(body) {
  if(!KINDS.includes(body?.kind)||typeof body.data!=='string')throw fail('上传请求无效。');
  const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+=*)$/.exec(body.data);
  if(!match)throw fail('请选择PNG、JPG或WebP图片。');
  const bytes=Buffer.from(match[2],'base64');
  const valid=match[1]==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):match[1]==='image/jpeg'?bytes[0]===255&&bytes[1]===216:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  if(!valid||!bytes.length||bytes.length>10*1024*1024)throw fail('图片格式无效或超过10 MB。');
  return {bytes,mime:match[1],kind:body.kind};
}
/** 上传到对应Dify应用；apiKey仅在服务端使用，失败只返回状态分类。 */
async function uploadImage({body,apiKey,user,fetchImpl=fetch,signal}) {
  const {bytes,mime}=decodeUpload(body); const form=new FormData();
  form.append('file',new Blob([bytes],{type:mime}),'image.'+mime.split('/')[1]);form.append('user',user);
  const response=await fetchImpl(BASE+'/files/upload',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`},body:form,signal});
  if(!response.ok)throw fail(`图片上传失败（${response.status}），请检查作图服务配置。`,'upload_failed',502);
  const result=await response.json();if(typeof result.id!=='string')throw fail('图片上传未返回有效文件。','upload_failed',502);
  return {type:'image',transfer_method:'local_file',upload_file_id:result.id};
}
/** 验证业务结果与本次任务一致；保留partial/unknown，不用示例图填充缺失结果。 */
function validateOutput(outputs,kind,inputs) {
  const r=outputs?.result;
  if(!r||r.kind!==kind||r.contract_version!==VERSION||!['succeeded','partial','failed','unknown'].includes(r.status))throw fail('图片结果格式不正确，请核对任务记录。','invalid_output',502);
  const suite=['set','listing'].includes(kind);
  const slots=suite?JSON.parse(inputs.slots_json):[];
  const retry=inputs.retry_slot_ids_json?JSON.parse(inputs.retry_slot_ids_json):null;
  const expected=suite?slots.filter(x=>!retry||retry.includes(x.id)).length:(kind==='edit'?1:inputs.quantity||1);
  if(r.expected!==expected)throw fail('返回结果与请求数量不一致。','invalid_output',502);
  const rows=suite?r.items:[r]; if(!Array.isArray(rows)||suite&&rows.length!==expected)throw fail('图片结果不完整。','invalid_output',502);
  const selected=slots.filter(x=>!retry||retry.includes(x.id));
  rows.forEach((row,i)=>{
    if(!row||!Array.isArray(row.images)||!['succeeded','partial','failed','unknown'].includes(row.status)||suite&&row.slot_id!==selected[i].id)throw fail('图片图位不匹配。','invalid_output',502);
    for(const image of row.images){let url;try{url=new URL(image.url);}catch{throw fail('图片地址不正确。','invalid_output',502);}
      if(url.protocol!=='https:'||url.username||url.password||!Number.isInteger(image.index))throw fail('图片地址不正确。','invalid_output',502);}
  });
  return {result:r,plan:suite&&Array.isArray(outputs.plan)?outputs.plan:[]};
}
/** 执行真实Dify流式Workflow；仅转发阶段/运行ID及经验证结果，断流不自动重试。 */
async function runImageWorkflow({kind,inputs,apiKey,user,fetchImpl=fetch,signal,onEvent=()=>{}}) {
  const response=await fetchImpl(BASE+'/workflows/run',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({inputs,user,response_mode:'streaming'}),signal});
  if(!response.ok)throw fail(`作图服务拒绝请求（${response.status}），请检查应用是否已发布和配置。`,'upstream_rejected',502);
  if(!response.body)throw fail('未收到作图运行响应。','incomplete_stream',502);
  let result,runId='',bytes=0;const reader=response.body.getReader(),decoder=new TextDecoder();
  const parser=createSsePayloadParser(event=>{
    const data=event.data||{};
    if(event.workflow_run_id)runId=event.workflow_run_id;
    if(event.event==='workflow_started')onEvent({type:'progress',stage:'planning',runId});
    if(event.event==='node_started'&&data.node_type==='http-request')onEvent({type:'progress',stage:'generating',runId});
    if(event.event==='error')throw fail('作图执行异常，请核对任务记录后再重试。','workflow_failed',502);
    if(event.event==='workflow_finished'){
      if(!['succeeded','partial-succeeded'].includes(data.status))throw fail('作图未完成，请核对任务记录；不要连续重复提交。','workflow_failed',502);
      result={...validateOutput(data.outputs,kind,inputs),workflow_run_id:runId||data.id};
    }
  });
  try{while(!result){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>8*1024*1024)throw fail('作图响应超出限制。','invalid_output',502);parser.push(decoder.decode(chunk.value,{stream:true}));}
    parser.push(decoder.decode());parser.finish();if(!result)throw fail('连接中断，生成状态待确认，请先核对任务记录。','incomplete_stream',502);
    onEvent({type:'done',...result});return result;
  }finally{await reader.cancel().catch(()=>{});}
}
module.exports={KINDS,FILES,validateRequest,decodeUpload,uploadImage,validateOutput,runImageWorkflow};
