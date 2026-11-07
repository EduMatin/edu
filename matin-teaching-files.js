/* Course originals are separate from report attachments and editable instructions. */
(() => {
 'use strict';
 const MAX=20*1024*1024, TEXT=16000, TOTAL=24000, retry=new Map();
 function normalize(list,reference=true){
  let remaining=TOTAL;const seen=new Set();
  return (Array.isArray(list)?list:[]).filter(f=>f&&/^[a-f0-9-]{36}$/i.test(f.id)&&!seen.has(f.id)&&seen.add(f.id)).slice(0,5).map(f=>{
   const item={id:f.id,name:String(f.name||'教学资料').slice(0,180),bytes:Math.max(0,Number(f.bytes)||0),sha256:String(f.sha256||''),mime:String(f.mime||'')};
   if(reference){item.text=String(f.text||'').slice(0,Math.min(TEXT,remaining));remaining-=item.text.length;item.readStatus=String(f.readStatus||'尚未读取文字').slice(0,400);}
   return item;
  });
 }
 async function extract(file){
  if(!/\.pdf$/i.test(file.name)) {const all=await file.text();return {text:all.slice(0,TEXT),readStatus:all.length>TEXT?'AI仅使用前16000字符；原文件完整保留':'AI已读取文字；原文件完整保留'};}
  const base='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/';
  const pdfjs=await import(base+'pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc=base+'pdf.worker.min.mjs';
  const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())});
  let timer;const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{task.destroy();reject(Error('PDF读取超时，请补充文字说明'));},60000);});
  try{return await Promise.race([timeout,(async()=>{
   const doc=await task.promise,parts=[];let pages=0,characters=0,hasText=false;
   for(let i=1;i<=Math.min(doc.numPages,15);i++){
    const page=await doc.getPage(i),content=await page.getTextContent();
    const text=content.items.map(x=>typeof x.str==='string'?x.str:'').join(' ');if(text.trim())hasText=true;
    parts.push(`【第${i}页】${text}`);characters+=parts.at(-1).length+1;pages=i;page.cleanup?.();if(characters>=TEXT)break;
   }
   if(!hasText)throw Error('未提取到文字，可能为扫描版；请在补充说明中填写要点');
   return {text:parts.join('\n').slice(0,TEXT),readStatus:`AI已读取文字：${pages}/${doc.numPages}页`+(pages<doc.numPages||characters>TEXT?'（部分内容，最多15页/16000字符）':'')+'；图表未解析，原PDF完整保留'};
  })()]);}finally{clearTimeout(timer);await task.destroy().catch(()=>{});}
 }
 async function upload(file,project){
  if(!file.size||file.size>MAX)throw Error('教学资料单文件应大于0且不超过20MB。');
  if(!/\.(pdf|txt|md|markdown)$/i.test(file.name))throw Error('请选择PDF、TXT或Markdown文件。');
  if(!window.MatinAccount?.enabled||!MatinAccount.userId||MatinAccount.userId==='guest')throw Error('请先登录教师账号，原文件需要保存到云端才能供学生下载。');
  if(normalize(project.teachingFiles).length>=5)throw Error('每个项目最多5份教学资料，请先移除不需要的资料。');
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(normalize(project.teachingFiles).some(f=>f.sha256===hash))throw Error('这份原文件已经添加，无需重复上传。');
  const key=MatinAccount.userId+':'+project.id+':'+file.name+':'+hash,id=retry.get(key)||crypto.randomUUID();retry.set(key,id);
  const data=new FormData();data.append('scope','teaching');data.append('project_id',project.id);data.append('attachment_id',id);data.append('file',file);
  const response=await MatinAccount.fileRequest(data),result=await response.json();
  if(!result.ok||!result.file?.id)throw Error('资料上传响应不完整，请重试。');
  retry.delete(key);return {...result.file,text:'',readStatus:'原件已上传，正在提取AI参考文字…'};
 }
 async function read(file){try{return await extract(file);}catch(e){return {text:'',readStatus:'原件可下载；AI未读取：'+e.message};}}
 function references(list){return normalize(list).map(f=>`【资料：${f.name}】\n${f.readStatus}\n${f.text||'没有可用文字，不可推测该文件内容。'}`).join('\n\n');}
 async function download(file,context={},teacher=false){
  const api=teacher?window.MatinAccount:window.MatinStudent;
  if(!teacher&&!api?.signedIn)throw Error('请先登录学生账号，再从班级任务或教师分享链接下载资料。');
  const params=new URLSearchParams(location.hash.slice(1)||location.search);
  const res=await api.fileRequest({scope:'teaching',op:'read',data:{attachment_id:file.id,project_id:context.project_id,task_id:context.task_id||undefined,teacher_token:params.get('teacher')||'',course_token:params.get('course')||''}});
  const url=URL.createObjectURL(await res.blob()),a=document.createElement('a');a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 }
 function render(container,files,{teacher=false,context={},onRemove,disabled=false}={}){
  const list=normalize(files,teacher);container.replaceChildren();container.hidden=!teacher&&!list.length;
  if(!list.length){if(teacher){const p=document.createElement('p');p.textContent='尚未添加资料。上传后自动保存到当前项目，布置班级任务或更新公开课程后学生可下载原件。';container.append(p);}return;}
  const heading=document.createElement('strong');heading.textContent='教学资料 · '+list.length+'份';container.append(heading);
  for(const f of list){const row=document.createElement('div');row.className='teaching-file';
   const title=document.createElement('div');title.textContent=f.name+' · '+(f.bytes/1024/1024).toFixed(2)+'MB';row.append(title);
   const state=document.createElement('p');state.className='help';state.setAttribute('role','status');state.textContent=teacher?f.readStatus:'下载教师提供的完整原文件';row.append(state);
   const button=document.createElement('button');button.type='button';button.className='btn tiny';button.textContent='下载原文件';button.disabled=disabled;
   button.onclick=async()=>{button.disabled=true;try{await download(f,context,teacher);}catch(e){state.textContent=e.message;}finally{button.disabled=false;}};row.append(button);
   if(teacher&&onRemove){const remove=document.createElement('button');remove.type='button';remove.className='btn tiny';remove.textContent='移除资料';remove.disabled=disabled;remove.onclick=()=>onRemove(f.id);row.append(remove);}
   if(teacher&&f.text){const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent='查看AI参考文字（'+f.text.length+'字符）';pre.textContent=f.text;details.append(summary,pre);row.append(details);}
   container.append(row);
  }
 }
 const style=document.createElement('style');style.textContent='.teaching-file{padding:12px 0;border-bottom:1px solid #e1e6f4;overflow-wrap:anywhere}.teaching-file .btn{margin:4px 6px 4px 0}.teaching-file pre{white-space:pre-wrap;max-height:180px;overflow:auto;font:inherit;font-size:12px}.teaching-file summary{cursor:pointer;font-size:12px;margin-top:8px}';document.head.append(style);
 window.MatinTeachingFiles={normalize,upload,read,references,render,download,TOTAL};
})();
