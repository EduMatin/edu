/* Private MP4 originals: bounded local hashing and signed, resumable Storage uploads. */
(() => {
 'use strict';
 const MAX=500*1024*1024, CHUNK=6*1024*1024, memory=new Map();
 const vendor=new URL('./matin-upload-vendor.js'+new URL(document.currentScript.src).search,document.currentScript.src).href;
 let loading;
 function libraries(){return loading||(loading=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=vendor;s.onload=resolve;s.onerror=()=>{loading=null;s.remove();reject(Error('上传组件加载失败，请刷新后重试。'));};document.head.append(s);}));}
 async function hash(file,progress){
  const h=await hashwasm.createSHA256();h.init();
  for(let start=0;start<file.size;start+=CHUNK){h.update(new Uint8Array(await file.slice(start,start+CHUNK).arrayBuffer()));progress?.(0,'正在检查视频：'+Math.min(100,Math.round((start+CHUNK)/file.size*100))+'%');}
  return h.digest();
 }
 function pending(key){
  let item=memory.get(key);try{item=item||JSON.parse(localStorage.getItem(key));}catch{}
  if(!item||Date.now()-item.at>24*3600*1000||!/^[-a-f0-9]{36}$/.test(item.id))item={id:crypto.randomUUID(),at:Date.now()};
  memory.set(key,item);try{localStorage.setItem(key,JSON.stringify(item));}catch{}return item.id;
 }
 async function api(op,data){const r=await MatinAccount.fileRequest({scope:'teaching',op,data});return r.json();}
 function uploadError(e){
  const status=e?.originalResponse?.getStatus();
  if(status===413)return Error('存储服务拒绝文件大小。500MB视频需要支持该大小的Supabase方案，并将全局及教学资料桶的上限设为至少500MB。');
  if(status===401||status===403)return Error('视频上传授权已失效，请确认登录后重新选择同一文件续传。');
  return Error('视频上传中断，请保持网络连接，重新选择同一文件重试；已接收的分块可继续上传。');
 }
 async function upload(file,project,meta,onProgress){
  if(!file.size||file.size>MAX)throw Error('MP4视频单文件最大500MB。');
  await libraries();if(!window.tus?.isSupported)throw Error('当前浏览器不支持大文件上传，请用最新版Edge或Chrome。');
  if(new TextDecoder().decode(await file.slice(4,8).arrayBuffer())!=='ftyp')throw Error('文件不是有效的MP4，请重新导出。');
  const account=MatinAccount.userId,sha256=await hash(file,onProgress);
  const sameAccount=()=>{if(MatinAccount.userId!==account)throw Error('账号已切换，请在原账号下重试上传。');};sameAccount();
  if(project.teachingFiles?.some(f=>f.sha256===sha256))throw Error('这份原文件已经添加，无需重复上传。');
  const key=['matin-video-v1',location.origin,window.MATIN_CLOUD?.supabaseUrl||'',account,project.id,file.name,sha256].join(':'),id=pending(key);
  const data={attachment_id:id,project_id:project.id,name:file.name,mime:'video/mp4',bytes:file.size,sha256,duration:meta.duration,pages:0};
  onProgress?.(0,'正在获取视频上传授权…');let prepared=await api('video_prepare',data),signedAt=Date.now();
  if(!prepared.file){
   if(!prepared.token||!prepared.endpoint||!prepared.objectPath)throw Error('视频上传服务尚未升级，请联系管理员部署本版SQL和云函数。');
   await new Promise((resolve,reject)=>{
    const u=new tus.Upload(file,{
     endpoint:prepared.endpoint,chunkSize:CHUNK,uploadDataDuringCreation:true,
     retryDelays:[0,3000,5000,10000,20000],removeFingerprintOnSuccess:true,
     headers:{'x-upsert':'false'},
     metadata:{bucketName:'matin-teaching-files',objectName:prepared.objectPath,contentType:'video/mp4',cacheControl:'3600'},
     fingerprint:()=>Promise.resolve(key),
     onBeforeRequest:async req=>{
      sameAccount();
      if(Date.now()-signedAt>60*60*1000){const next=await api('video_prepare',data);if(next.token)prepared=next;signedAt=Date.now();}
      req.setHeader('x-signature',prepared.token);const xhr=req.getUnderlyingObject();if(xhr)xhr.timeout=180000;
     },
     onProgress:(sent,total)=>onProgress?.(Math.min(99,Math.floor(sent/total*100)),`视频上传中：${(sent/1048576).toFixed(1)} / ${(total/1048576).toFixed(1)} MB，请保留窗口`),
     onError:e=>reject(uploadError(e)),onSuccess:resolve
    });
    u.findPreviousUploads().then(items=>{if(items.length)u.resumeFromPreviousUpload(items[0]);u.start();}).catch(reject);
   });
   sameAccount();onProgress?.(99,'视频已传送，正在确认云端文件…');prepared=await api('video_finish',{attachment_id:id,project_id:project.id});
  }
  if(!prepared.ok||!prepared.file?.id)throw Error('视频已传送但确认未完成，请重新选择同一文件重试。');
  memory.delete(key);try{localStorage.removeItem(key);}catch{}onProgress?.(100,'视频已保存。');
  return {...prepared.file,text:'',readStatus:'视频原件已保存；AI暂不解析视频，请补充教学要点。'};
 }
 window.MatinVideoUpload={upload,MAX};
})();
