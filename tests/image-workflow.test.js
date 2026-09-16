const {test}=require('node:test');const assert=require('node:assert/strict');
const {validateRequest,decodeUpload,validateOutput,runImageWorkflow}=require('../lib/image-workflow');
const {createOperationsServer}=require('../operations-dev-server.cjs');
const slots=[{id:'a',role:'核心卖点',brief:''},{id:'b',role:'新方向',brief:''}];
const version='image-studio-302-v3-candidate';
/** 构造候选契约的上游样例，不发起付费请求。 */
function output(kind){const base={kind,contract_version:version,model:'gpt-image-2.5-flare',status:'succeeded',expected:1,images:[{index:0,url:'https://example.com/result.png'}],error_code:'',retry_advice:'none'};return ['set','listing'].includes(kind)?{result:{...base,expected:2,items:slots.map((slot,index)=>({...base,slot_id:slot.id,index,role:slot.role,title:slot.role})),succeeded_count:2,failed_slot_ids:[]},plan:[]}: {result:base};}
test('五入口路由、空图描述、开放方向和重试图位',()=>{
 for(const kind of ['main','set','listing','edit','similar']){
  const inputs={instruction:'一个杯子',...(['set','listing'].includes(kind)?{slots_json:JSON.stringify(slots)}:{})};
  assert.equal(validateRequest({kind,inputs}).kind,kind);assert.doesNotThrow(()=>validateOutput(output(kind),kind,inputs));
 }
 assert.throws(()=>validateRequest({kind:'main',inputs:{}}));
 assert.throws(()=>validateRequest({kind:'main',inputs:{instruction:'x',quantity:1.5}}));
 assert.throws(()=>validateRequest({kind:'set',inputs:{instruction:'x',slots_json:JSON.stringify(slots),retry_slot_ids_json:'["missing"]'}}));
 assert.throws(()=>validateRequest({kind:'main',inputs:{instruction:'x',apiKey:'no'}}));
});
test('部分失败/未知结果不冒充成功，拒绝图位错序和危险URL',()=>{
 const x=output('set');x.result.status='partial';x.result.items[1]={slot_id:'b',status:'unknown',images:[]};
 assert.equal(validateOutput(x,'set',{slots_json:JSON.stringify(slots)}).result.status,'partial');
 x.result.items.reverse();assert.throws(()=>validateOutput(x,'set',{slots_json:JSON.stringify(slots)}));
 const y=output('main');y.result.images[0].url='javascript:alert(1)';assert.throws(()=>validateOutput(y,'main',{}));
});
test('上传拒绝伪装图片和任意远程URL',()=>{
 assert.throws(()=>decodeUpload({kind:'main',data:'https://127.0.0.1/private'}));
 assert.throws(()=>decodeUpload({kind:'main',data:'data:image/png;base64,aGVsbG8='}));
});
test('真实流协议分块解析，只转发阶段和最终业务输出',async()=>{
 const events=[{event:'workflow_started',workflow_run_id:'run-1'},{event:'node_started',data:{node_type:'llm',secret:'must-not-forward'}},{event:'node_started',data:{node_type:'http-request'}},{event:'workflow_finished',data:{status:'succeeded',outputs:output('main')}}];
 const raw=events.map(event=>'data: '+JSON.stringify(event)+'\n\n').join('');let called=0;const received=[];
 const result=await runImageWorkflow({kind:'main',inputs:{instruction:'x'},apiKey:'test',user:'test',onEvent:e=>received.push(e),fetchImpl:async(url,options)=>{called++;assert.equal(JSON.parse(options.body).response_mode,'streaming');return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(raw.slice(0,90)));c.enqueue(new TextEncoder().encode(raw.slice(90)));c.close();}}),{headers:{'Content-Type':'text/event-stream'}});}});
 assert.equal(called,1);assert.equal(result.workflow_run_id,'run-1');assert.equal(received.at(-1).type,'done');assert.ok(!JSON.stringify(received).includes('must-not-forward'));
});
test('断流不重试、不返回假结果',async()=>{
 let called=0;await assert.rejects(runImageWorkflow({kind:'main',inputs:{},apiKey:'test',user:'test',fetchImpl:async()=>{called++;return new Response('data: {"event":"workflow_started"}\n\n');}}),/连接中断/);assert.equal(called,1);
});
test('本地代理不暴露文件和密钥，未配置返回明确状态，跨站POST拒绝',async()=>{
 const probe=require('node:net').createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const server=createOperationsServer({port,imageEnv:{}});await new Promise(r=>server.listen(port,'127.0.0.1',r));
 try{
  const options={headers:{Host:`127.0.0.1:${port}`}};
  const status=await fetch(`http://127.0.0.1:${port}/api/image-studio`,options);assert.equal(status.status,200);assert.equal((await status.json()).configured.main,false);
  const deny=await fetch(`http://127.0.0.1:${port}/.env.image-studio.local`,options);assert.equal(deny.status,404);
  const blocked=await fetch(`http://127.0.0.1:${port}/api/image-studio`,{method:'POST',headers:{...options.headers,Origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify({kind:'main',inputs:{instruction:'x'}})});assert.equal(blocked.status,403);
 }finally{await new Promise(r=>server.close(r));}
});

test('Dify部分成功仍解析业务unknown结果，不误丢异常默认分支',async()=>{
 const value=output('main');value.result.status='unknown';value.result.images=[];value.result.error_code='TRANSPORT_OR_TIMEOUT';
 const result=await runImageWorkflow({kind:'main',inputs:{},apiKey:'test',user:'test',fetchImpl:async()=>new Response('data: '+JSON.stringify({event:'workflow_finished',data:{status:'partial-succeeded',outputs:value}})+'\n\n')});
 assert.equal(result.result.status,'unknown');assert.equal(result.result.images.length,0);
});
