const {randomUUID}=require('node:crypto');
const {KINDS,validateRequest,uploadImage,runImageWorkflow}=require('../lib/image-workflow');
const {sendJson,startSse,sendSseEvent}=require('../lib/dify-http');
/** 创建同源生图代理。配置由服务端读取，不允许客户端指定Key或上游地址；日志仅记阶段和运行ID。 */
function createImageStudioHandler({env=process.env,fetchImpl=fetch,logger=console}={}) {
  const user='yd-image-studio-local';let busy=false;
  return async function imageStudio(req,res){
    const origin=req.headers.origin;
    const allowed=String(env.IMAGE_STUDIO_ALLOWED_ORIGINS||'').split(',');
    if((origin&&!allowed.includes(origin))||req.headers['sec-fetch-site']==='cross-site'){sendJson(res,403,{message:'当前页面无权调用作图服务。'});return;}
    res.setHeader('Cache-Control','no-store');
    const configured=Object.fromEntries(KINDS.map(k=>[k,Boolean(env[`DIFY_IMAGE_${k.toUpperCase()}_API_KEY`])]));
    if(req.method==='GET'){sendJson(res,200,{configured});return;}
    if(req.method!=='POST'){sendJson(res,405,{message:'不支持此请求方式。'});return;}
    const kind=req.body?.kind;
    if(!KINDS.includes(kind)){sendJson(res,400,{message:'不支持的生图入口。'});return;}
    const apiKey=env[`DIFY_IMAGE_${kind.toUpperCase()}_API_KEY`];
    if(!apiKey){sendJson(res,409,{message:'这个作图服务尚未配置，请先完成应用配置。'});return;}
    if(busy){sendJson(res,409,{message:'还有一个作图任务在运行，请完成后再提交。'});return;}
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12*60*1000);
    const close=()=>{if(!res.writableEnded)controller.abort();};res.on('close',close);
    let heartbeat,streaming=false;const requestId=randomUUID();
    busy=true;
    try{
      if(req.body.action==='upload'){
        const file=await uploadImage({body:req.body,apiKey,user,fetchImpl,signal:controller.signal});sendJson(res,200,{file});return;
      }
      const request=validateRequest(req.body);
      logger.info('[image-studio] started',{requestId,kind});startSse(res);streaming=true;
      heartbeat=setInterval(()=>{if(!res.destroyed)res.write(': heartbeat\n\n');},15000);
      const output=await runImageWorkflow({...request,apiKey,user,fetchImpl,signal:controller.signal,onEvent:event=>{if(!res.destroyed)sendSseEvent(res,event);}});
      logger.info('[image-studio] completed',{requestId,kind,runId:output.workflow_run_id,status:output.result.status});
    }catch(error){
      logger.error('[image-studio] failed',{requestId,kind,code:error.code||error.name});
      const message=error.public?error.message:'作图连接异常，执行状态待确认，请先核对任务记录再重试。';
      if(!res.destroyed){if(streaming)sendSseEvent(res,{type:'error',message});else sendJson(res,error.status||502,{message});}
    }finally{busy=false;clearTimeout(timeout);clearInterval(heartbeat);res.off('close',close);if(!res.writableEnded&&!res.destroyed)res.end();}
  };
}
module.exports=createImageStudioHandler();module.exports.createImageStudioHandler=createImageStudioHandler;
