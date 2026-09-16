/* global window */
/** 真实作图传输：文件逐一上传到对应Dify应用，再读取服务端脱敏SSE；不保存Key。 */
window.YD_IMAGE_CLIENT=(()=>{
  const endpoint='/api/image-studio';
  /** 将页面素材转换为上传数据；支持用户File和页面示例/结果URL，失败抛用户可读错误。 */
  async function dataURL(item){
    if(item.url?.startsWith('data:'))return item.url;
    let blob=item.file;
    if(!blob){const response=await fetch(item.url);if(!response.ok)throw new Error('无法读取这张素材，请重新上传图片。');blob=await response.blob();}
    return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('图片读取失败。'));reader.readAsDataURL(blob);});
  }
  /** 上传一个指定角色的文件；Dify文件ID不跨应用复用，历史操作重新上传。 */
  async function upload(kind,item){
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'upload',kind,data:await dataURL(item)})});
    const data=await response.json();if(!response.ok)throw new Error(data.message||'图片上传失败。');return data.file;
  }
  /** 顺序上传素材并执行Workflow；onProgress只接收真实上游阶段，返回完整业务输出。 */
  async function run(kind,inputs,files,onProgress=()=>{}){
    const check=await fetch(endpoint), config=await check.json();
    if(!check.ok||!config.configured?.[kind])throw new Error('这个作图服务尚未配置，请先完成应用配置。');
    const request={...inputs};onProgress({stage:'uploading'});
    for(const [name,item] of Object.entries(files))if(item)request[name]=await upload(kind,item);
    onProgress({stage:'planning'});
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,inputs:request})});
    if(!response.ok){const error=await response.json();throw new Error(error.message||'作图请求失败。');}
    if(!response.headers.get('content-type')?.includes('text/event-stream'))throw new Error('作图服务不可用，请通过本地服务打开页面。');
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',done;
    /** 分发一个完整的SSE块；错误直接中止，不发起自动重试。 */
    const parse=block=>{const raw=block.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5)).join('\n');if(!raw.trim())return;
      const event=JSON.parse(raw);if(event.type==='error')throw new Error(event.message);if(event.type==='progress')onProgress(event);if(event.type==='done')done=event;};
    try{while(!done){const chunk=await reader.read();if(chunk.done)break;buffer+=decoder.decode(chunk.value,{stream:true});const blocks=buffer.split(/\r?\n\r?\n/);buffer=blocks.pop();blocks.forEach(parse);}
      if(!done&&buffer.trim())parse(buffer);if(!done)throw new Error('连接已断开，生成状态待确认，请先核对任务记录。');return done;
    }finally{await reader.cancel().catch(()=>{});}
  }
  return {run};
})();
