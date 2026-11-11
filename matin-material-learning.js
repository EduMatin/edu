/* Node resources: task-scoped learning evidence, not an assertion of attention. */
(() => {
 'use strict';
 const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 const button=(text,fn)=>{const b=el('button',text,'btn tiny');b.type='button';b.onclick=fn;return b;};
 const normalize=list=>(Array.isArray(list)?list:[]).filter((r,i,a)=>r&&/^[a-f0-9-]{36}$/i.test(r.fileId)&&a.findIndex(x=>x?.fileId===r.fileId)===i).slice(0,5).map(r=>({fileId:r.fileId,required:r.required===true,percent:Math.max(50,Math.min(100,Number(r.percent)||90))}));
 const api=(op,data,teacher=false)=>teacher?MatinAccount.api({action:'material_learning',op,data}):MatinStudent.api(op,data,'material_learning');
 let pdfModule,openViewer=null;
 async function pdfjs(){if(!pdfModule){pdfModule=import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs').catch(e=>{pdfModule=null;throw e;});}const m=await pdfModule;m.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';return m;}
 async function metadata(file){
  if(/\.mp4$/i.test(file.name))return await new Promise((resolve,reject)=>{
   const v=el('video'),u=URL.createObjectURL(file);let timer;
   const end=(error)=>{clearTimeout(timer);const duration=v.duration;v.removeAttribute('src');v.load();URL.revokeObjectURL(u);error?reject(Error(error)):resolve({duration:Math.ceil(duration)});};
   timer=setTimeout(()=>end('读取视频超时，请重新导出为MP4后重试。'),15000);
   v.preload='metadata';v.onloadedmetadata=()=>end(Number.isFinite(v.duration)&&v.duration>=1&&v.duration<=7200?'':'视频时长须为1秒至2小时。');v.onerror=()=>end('浏览器无法播放此视频，请导出为H.264视频、AAC音频的MP4。');v.src=u;
  });
  if(/\.pdf$/i.test(file.name)){
   let task;try{const m=await pdfjs();task=m.getDocument({data:new Uint8Array(await file.arrayBuffer())});const d=await task.promise;return {pages:d.numPages};}catch{return {pages:0};}finally{await task?.destroy().catch(()=>{});}
  }
  return {};
 }
 async function url(f,context={},teacher=false){
  const q=new URLSearchParams(location.hash.slice(1)||location.search),client=teacher?MatinAccount:MatinStudent;
  const r=await client.fileRequest({scope:'teaching',op:'play',data:{attachment_id:f.id,...context,teacher_token:q.get('teacher')||'',course_token:q.get('course')||''}});
  const d=await r.json();if(!d.url)throw Error('未取得资料地址');return d.url;
 }
 function modal(title){
  const prior=document.activeElement,d=el('dialog',undefined,'material-dialog'),h=el('header'),body=el('div',undefined,'material-body'),status=el('p','','help');status.setAttribute('role','status');
  const close=button('关闭',()=>d.close());h.append(el('h2',title),close);d.append(h,body,status);document.body.append(d);d.showModal();
  d.addEventListener('close',()=>{d.remove();if(prior?.isConnected)prior.focus();});return {d,body,status};
 }
 async function viewer(f,context={},teacher=false,tracked=false){
  openViewer?.close();const {d,body,status}=modal(f.name);openViewer=d;
  const owner=teacher?MatinAccount.userId:MatinStudent.userId,valid=()=>d.isConnected&&owner===(teacher?MatinAccount.userId:MatinStudent.userId);
  let session,doc,timer,queue=Promise.resolve(),video,refreshed=false,closed=false;
  const data={task_id:context.task_id,node_id:context.node_id,file_id:f.id};
  function send(op,extra={}){if(!tracked)return Promise.resolve({});const work=queue.catch(()=>{}).then(async()=>{
   if(!valid())throw Error('资料窗口已关闭');const result=await api(op,{...data,session_id:session,...extra});if(!valid())return result;
   status.textContent=result.done?'已达到查看要求，进度已同步云端。':'学习进度已同步云端。';window.dispatchEvent(new CustomEvent('matin-material-progress'));return result;
  });queue=work;work.catch(e=>{if(valid())status.textContent='进度未同步：'+e.message+'。请恢复网络后继续学习或重新打开资料。';});return work;}
  d.addEventListener('close',()=>{closed=true;clearInterval(timer);video?.pause();if(video){video.removeAttribute('src');video.load();}doc?.destroy();if(openViewer===d)openViewer=null;});
  try{
   status.textContent='正在读取资料…';const address=await url(f,context,teacher);if(!valid())return;
   let initial={};if(tracked){initial=await api('begin',data);session=initial.session_id;if(!valid())return;}
   if(f.mime==='video/mp4'){
    video=el('video');video.controls=true;video.playsInline=true;video.preload='metadata';video.src=address;body.append(video,el('p','播放进度自动保存；拖动进度条不计入已观看部分。最高按2倍速记录。','help'));
    let lastPosition=Number(initial.position)||0,seeking=false,busy=false,wasPlaying=false;
    const tick=async(force=false)=>{if(!tracked||busy||closed||!valid()||!Number.isFinite(video.duration))return;
     const position=Math.min(f.duration,video.currentTime),playing=!force&&!seeking&&!document.hidden&&(!video.paused||wasPlaying)&&video.playbackRate<=2&&position>=lastPosition&&position-lastPosition<=12;
     busy=true;try{await send('tick',{position,playing});lastPosition=position;}catch{}finally{busy=false;}};
    video.addEventListener('loadedmetadata',()=>{if(!refreshed&&lastPosition>0)video.currentTime=Math.min(lastPosition,video.duration);});
    video.addEventListener('seeking',()=>{seeking=true;});video.addEventListener('seeked',()=>{tick(true).finally(()=>seeking=false);});
    video.addEventListener('play',()=>wasPlaying=true);video.addEventListener('pause',()=>tick().finally(()=>wasPlaying=false));video.addEventListener('ended',()=>tick().finally(()=>wasPlaying=false));
    const visibility=()=>{if(document.hidden)video.pause();};document.addEventListener('visibilitychange',visibility);d.addEventListener('close',()=>document.removeEventListener('visibilitychange',visibility));
    timer=setInterval(()=>tick(),3000);
    const retry=button('刷新播放地址 / 重试',async()=>{try{const at=video.currentTime;video.pause();video.src=await url(f,context,teacher);refreshed=true;video.addEventListener('loadedmetadata',()=>{video.currentTime=at;},{once:true});status.textContent='播放地址已刷新，请继续播放。';}catch(e){status.textContent=e.message;}});body.append(retry);
    video.addEventListener('error',()=>{status.textContent='视频播放失败或地址已过期，请刷新播放地址；仍失败请联系教师检查视频编码。';});
   }else if(f.mime==='application/pdf'){
    const m=await pdfjs();doc=await m.getDocument(address).promise;if(!valid()){doc.destroy();return;}
    let page=1,revision=0,reading=false;const canvas=el('canvas'),label=el('span'),nav=el('div',undefined,'material-controls');
    const prev=button('上一页',()=>show(page-1)),next=button('下一页',()=>show(page+1));nav.append(prev,label,next);body.append(nav,canvas);
    async function show(value){if(reading||value<1||value>doc.numPages||!valid())return;reading=true;const rev=++revision;page=value;prev.disabled=true;next.disabled=true;
     try{const p=await doc.getPage(page),vp=p.getViewport({scale:Math.min(1.5,900/p.getViewport({scale:1}).width)});canvas.width=vp.width;canvas.height=vp.height;await p.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;label.textContent=`第 ${page} / ${doc.numPages} 页`;
      setTimeout(()=>{if(valid()&&rev===revision&&!document.hidden)send('page',{page:value}).catch(()=>{});},1300);
     }finally{reading=false;prev.disabled=page===1;next.disabled=page===doc.numPages;}}
    await show(1);body.append(button('我已阅读，确认完成',()=>send('confirm').catch(()=>{})));
   }else{
    const response=await fetch(address);if(!response.ok)throw Error('资料读取失败');body.append(el('pre',(await response.text()).slice(0,200000)));
    body.append(button('我已阅读，确认完成',()=>send('confirm').catch(()=>{})));
   }
   const download=button('下载原文件',async()=>{try{await MatinTeachingFiles.download(f,context,teacher);await send('download');if(valid())status.textContent='已请求下载。下载记录不等于阅读完成。';}catch(e){status.textContent=e.message;}});body.append(download);
   status.textContent=tracked?'学习记录将保存到此班级任务。':'预览资料，不计入班级任务学习记录。';
  }catch(e){if(valid())status.textContent='资料打开失败：'+e.message;}
 }
 function editor(container,project,node,save){
  const box=el('section',undefined,'group material-editor');box.append(el('h3','本节点学习资料'));
  box.append(el('p','在下方添加资料，选择“必学”后，学生达到查看要求才能离开本节点。新规则在布置新任务后生效。','help'));
  const status=el('p','','help');status.setAttribute('role','status');
  let busy=false;
  async function persist(change){if(busy)return;busy=true;const old=structuredClone(node.materials||[]);change();box.querySelectorAll('input,select,button').forEach(e=>e.disabled=true);
   try{if(!await save())throw Error('云端保存失败');status.textContent='已保存到项目草稿。';}catch(e){node.materials=old;status.textContent=e.message+'，更改未保存。';}finally{busy=false;draw();}}
  const list=el('div');
  function draw(){list.replaceChildren();for(const f of MatinTeachingFiles.normalize(project.teachingFiles)){
   const r=normalize(node.materials).find(x=>x.fileId===f.id),row=el('div',undefined,'teaching-file'),label=el('label'),check=el('input');check.type='checkbox';check.checked=!!r;
   check.onchange=()=>persist(()=>{node.materials=normalize(node.materials).filter(x=>x.fileId!==f.id);if(check.checked)node.materials.push({fileId:f.id,required:false,percent:90});});label.append(check,document.createTextNode(' '+f.name));row.append(label);
   if(r){const required=el('input');required.type='checkbox';required.checked=r.required;const req=el('label');req.append(required,document.createTextNode(' 必学'));row.append(req);
    required.onchange=()=>persist(()=>{node.materials=normalize(node.materials).map(x=>x.fileId===f.id?{...x,required:required.checked}:x);});
    if(f.mime==='video/mp4'){const percent=el('select');percent.setAttribute('aria-label',f.name+'观看要求');for(const n of [50,75,90,100]){const o=el('option',n+'%');o.value=n;percent.append(o);}percent.value=r.percent;percent.onchange=()=>persist(()=>node.materials=normalize(node.materials).map(x=>x.fileId===f.id?{...x,percent:Number(percent.value)}:x));row.append(percent);}
    if(f.mime==='application/pdf'&&!f.pages){required.disabled=true;row.append(el('p','此旧文件缺少页数，请重新上传后设置必读。','help'));}
   }list.append(row);
  }}
  draw();const upload=el('input');upload.type='file';upload.accept='.pdf,.txt,.md,.markdown,.mp4';upload.setAttribute('aria-label','上传节点学习资料');
  upload.onchange=async()=>{const f=upload.files[0];if(!f||busy)return;busy=true;upload.disabled=true;status.textContent='正在上传资料，请保留窗口…';const pending=modal('正在保存教学资料');pending.d.querySelector('button').disabled=true;pending.d.addEventListener('cancel',e=>e.preventDefault());pending.status.textContent='正在上传原件并保存关联，请稍候…';
   try{if(!await save())throw Error('请先保存项目');const item=await MatinTeachingFiles.upload(f,project,(n,message)=>pending.status.textContent=message||(n<100?'上传中：'+n+'%':'文件已传送，正在校验并保存…'));project.teachingFiles=[...MatinTeachingFiles.normalize(project.teachingFiles),item];node.materials=[...normalize(node.materials),{fileId:item.id,required:false,percent:90}];
    if(!await save())throw Error('原件已上传，关联尚未保存，请保留页面并重试保存');Object.assign(item,await MatinTeachingFiles.read(f));if(!await save())throw Error('资料已关联，AI参考文字保存失败');status.textContent='已上传并关联本节点，可设置必学。';
   }catch(e){status.textContent=e.message;}finally{pending.d.close();busy=false;upload.disabled=false;upload.value='';draw();}};
  box.append(list,upload,el('p','PDF/文字最大20MB；MP4最大500MB、2小时。视频暂不用于AI自动解析。','help'),status);container.append(box);
 }
 function student(container,project,node,task){
  let box=document.getElementById('node-materials');if(!box){box=el('section',undefined,'slot');box.id='node-materials';container.prepend(box);}
  const key=[MatinStudent.userId,task?.id,project?.id,node?.id].join(':');if(box.dataset.key===key)return;box.dataset.key=key;box.replaceChildren();
  const rules=normalize(node?.materials);box.hidden=!rules.length;if(!rules.length)return;
  box.append(el('h3','本阶段学习资料'));const hint=el('p',task?'请完成必学资料后进入下一阶段。':'自主学习可查看资料，不记录班级考核。','help');box.append(hint);
  const labels=new Map();for(const r of rules){const f=project.teachingFiles?.find(x=>x.id===r.fileId);if(!f){box.append(el('p','资料已缺失，请联系教师。'));continue;}
   const row=el('div',undefined,'teaching-file'),status=el('p','正在读取进度…','help');labels.set(f.id,{status,f,r});row.append(el('strong',f.name+(r.required?' · 必学':' · 选读')),status,button(f.mime==='video/mp4'?'播放视频':'阅读资料',()=>viewer(f,{project_id:project.id,task_id:task?.id,node_id:node.id},false,!!task&&!task.class_ended_at)));box.append(row);}
  const refresh=async()=>{if(!task)return;try{const d=await api('status',{task_id:task.id,node_id:node.id});if(box.dataset.key!==key)return;for(const {status,f,r} of labels.values()){
   const p=d.rows.find(x=>x.file_id===f.id),count=p?.units?.length||0;status.textContent=(p?.done?'已达到查看要求':f.mime==='video/mp4'?`已观看 ${Math.min(100,Math.floor(count/Math.max(1,f.duration)*100))}% / 要求 ${r.percent}%`:f.mime==='application/pdf'?`已浏览 ${count} / ${f.pages||'?'} 页，阅读后需确认`:'阅读后请确认完成');}
  }catch(e){if(box.dataset.key===key)hint.textContent='进度加载失败：'+e.message;}};
  box._refresh=refresh;box.append(button('刷新学习进度',refresh));refresh();
 }
 async function gate(task_id,node_id){const d=await api('gate',{task_id,node_id});return d.allowed===true;}
 async function teacher(task){
  const {d,body,status}=modal(task.title+' · 资料学习情况');const owner=MatinAccount.userId;const valid=()=>d.isConnected&&MatinAccount.userId===owner;
  let rows=[],page=1;const query=el('input');query.placeholder='搜索姓名、学号、节点或资料';query.setAttribute('aria-label','搜索资料学习记录');const list=el('div'),pages=el('div',undefined,'material-controls');
  function draw(){list.replaceChildren();const selected=rows.filter(r=>[r.name,r.student_no,r.node_name,r.file_name].join(' ').includes(query.value.trim()));page=Math.min(page,Math.max(1,Math.ceil(selected.length/20)));
   for(const r of selected.slice((page-1)*20,page*20)){const row=el('div',undefined,'teaching-file');row.append(el('strong',r.name+' · '+r.student_no),el('p',r.node_name+' / '+r.file_name+(r.required?' · 必学':' · 选读')),el('p',r.done?'已完成查看要求'+(r.exempt_reason?'（教师放行：'+r.exempt_reason+'）':''):!r.opened_at?'未打开':'学习中 · '+r.percent+'%'));
    if(r.updated_at)row.append(el('small','最近记录：'+new Date(r.updated_at).toLocaleString()));if(r.downloaded_at)row.append(el('p','已记录下载请求'));
    if(!r.done&&task.active&&!task.class_ended_at)row.append(button('特殊情况放行',async()=>{const reason=prompt('请输入放行原因（至少2字，将保留记录）');if(!reason)return;try{await api('exempt',{task_id:task.id,node_id:r.node_id,file_id:r.file_id,student_id:r.student_id,reason},true);await load();}catch(e){status.textContent=e.message;}}));list.append(row);}
   pages.replaceChildren(button('上一页',()=>{if(page>1){page--;draw();}}),el('span',`第 ${page} 页 · 共 ${selected.length} 条`),button('下一页',()=>{if(page*20<selected.length){page++;draw();}}));
  }
  async function load(){status.textContent='正在读取…';try{const result=await api('teacher',{task_id:task.id},true);if(!valid())return;rows=result.rows;draw();status.textContent=rows.length?'记录用于跟进学习，不代表已经掌握知识。':'此任务没有节点资料要求或没有已加入学生。';}catch(e){if(valid())status.textContent=e.message;}}
  query.oninput=()=>{page=1;draw();};body.append(query,button('刷新',load),list,pages);await load();
 }
 window.addEventListener('matin-material-progress',()=>document.getElementById('node-materials')?._refresh?.());
 window.addEventListener('matin-student-auth-changed',()=>openViewer?.close());
 const style=el('style');style.textContent='.material-dialog{width:min(900px,94vw);max-height:90vh;border:1px solid #dfe4f2;border-radius:18px;padding:20px;color:#26365b}.material-dialog::backdrop{background:#17243b99}.material-dialog header,.material-controls{display:flex;align-items:center;justify-content:space-between;gap:12px}.material-dialog h2{font-size:20px}.material-body{max-height:68vh;overflow:auto}.material-body video,.material-body canvas{display:block;max-width:100%;height:auto;margin:auto}.material-body video{max-height:55vh;width:100%}.material-body pre{white-space:pre-wrap;overflow-wrap:anywhere}.material-editor label{display:inline-flex;align-items:center;gap:6px;margin:8px}.material-editor input[type=checkbox]{width:auto}.material-editor select{width:auto}.material-dialog .teaching-file{padding:12px 0;border-bottom:1px solid #ddd}';document.head.append(style);
 window.MatinMaterialLearning={normalize,metadata,url,viewer,editor,student,gate,teacher};
})();
