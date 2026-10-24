/* Private account resume state. CAS revisions prevent silent cross-device replacement. */
(() => {'use strict';
 const clone=v=>v==null?null:JSON.parse(JSON.stringify(v));
 const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
 const signature=r=>JSON.stringify(stable(r?{...r,at:0}:null));
 let current=null,previous=null,timer=null;
 const panel=document.createElement('section');panel.id='learning-cloud';panel.hidden=true;
 panel.innerHTML='<p role="status" id="learning-cloud-status"></p><p id="learning-cloud-compare" hidden></p><div><button type="button" class="btn tiny" id="learning-cloud-retry">立即同步</button> <button type="button" class="btn tiny" id="learning-cloud-export">导出本机备份</button> <button type="button" class="btn tiny" id="learning-cloud-use-remote" hidden>采用云端记录</button> <button type="button" class="btn tiny" id="learning-cloud-use-local" hidden>用本机记录更新云端</button></div>';
 const style=document.createElement('style');style.textContent='#learning-cloud{padding:10px 18px;background:#eef3ff;border-bottom:1px solid #d9e1f3;font-size:12px;overflow-wrap:anywhere}#learning-cloud[hidden]{display:none}#learning-cloud p{margin:3px 0 8px;line-height:1.6}#learning-cloud button{margin-bottom:5px}#learning-cloud button[hidden]{display:none}';document.head.append(style);
 const recovery=document.createElement('details');recovery.innerHTML='<summary>本机保留副本</summary><div></div>';panel.append(recovery);
 function download(record,name){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));a.href=url;a.download=name+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 recovery.ontoggle=()=>{if(!recovery.open||!current)return;const list=recovery.querySelector('div');list.replaceChildren();try{for(const key of Object.keys(localStorage).filter(k=>k.startsWith(current.key+':recovery:')).sort().reverse()){const r=JSON.parse(localStorage.getItem(key)),b=document.createElement('button');b.type='button';b.className='btn tiny';b.textContent=new Date(Number(key.split(':').at(-1))).toLocaleString('zh-CN')+' · '+describe(r)+' · 导出';b.onclick=()=>download(r,'Matin保留副本');list.append(b);}if(!list.childNodes.length)list.textContent='暂无保留副本。';}catch{list.textContent='副本读取失败，请检查浏览器存储。';}};
 const $=id=>document.getElementById('learning-cloud-'+id);
 function mount(){if(!panel.isConnected)document.getElementById('learning-save-status').after(panel);}
 function persist(c){try{localStorage.setItem(c.key+':cloud',JSON.stringify({revision:c.revision,dirty:c.dirty,record:c.record,write:c.write}));c.storageError=false;}catch{c.storageError=true;}}
 function backup(c,record,label){if(!record)return;try{localStorage.setItem(c.key+':recovery:'+label+':'+Date.now(),JSON.stringify(record));}catch{throw Error('本机备份空间不足，请先导出备份，暂未替换记录。');}}
 function describe(r){return r?(r.nodeName||r.nodeId)+' · '+r.messages.length+' 条对话 · '+r.evaluations.length+' 次评价':'尚无记录';}
 function paint(c=current){if(c!==current)return;mount();panel.hidden=!c;if(!c)return;
  $('status').textContent=c.writing?'正在同步学习记录…':c.conflict?'检测到多设备修改，自动上传已暂停。请选择要继续的版本。':c.error?'尚未同步：'+c.error:c.dirty?'学习记录待上传，关闭前请确认同步成功。':'✓ 学习记录已同步云端，可换设备继续学习';
  if(c.storageError)$('status').textContent+=' 本机缓存空间不足，请导出备份。';
  $('compare').hidden=!c.conflict;$('compare').textContent=c.conflict?'本机：'+describe(c.record)+'；云端：'+describe(c.remote?.record):'';
  $('use-remote').hidden=$('use-local').hidden=!c.conflict;
  $('retry').disabled=!!c.writing;$('use-remote').disabled=$('use-local').disabled=!!c.writing;
 }
 function payload(c){const h=new URLSearchParams(location.hash.slice(1));return {project_id:c.projectId,...(c.taskId?{task_id:c.taskId}:{}),...(h.has('teacher')?{teacher_token:h.get('teacher')}:{ }),...(h.has('course')?{course_token:h.get('course')}:{})};}
 async function api(c,op,extra={}){if(!MatinStudent.signedIn||MatinStudent.userId!==c.user)throw Error('账号已变化，请重新登录');return MatinStudent.api(op,{...payload(c),...extra},'learning_sync');}
 function validate(d){if(!Number.isSafeInteger(d.revision)||d.revision<0||!(d.record===null||d.record&&d.record.version===1&&Array.isArray(d.record.messages)&&Array.isArray(d.record.evaluations)))throw Error('云端学习记录服务尚未升级或返回数据无效');return d;}
 async function read(c){return validate(await api(c,'read'));}
 async function reconcile(c){const remote=await read(c);c.remote=remote;c.ready=true;c.error='';
  if(c.write&&remote.mutation_id===c.write.id&&signature(remote.record)===signature(c.write.record)){c.revision=remote.revision;c.write=null;c.dirty=signature(c.record)!==signature(remote.record);}
  if(c.revision===null&&!remote.record)c.revision=0;
  if(c.dirty){
   if(remote.revision!==c.revision){c.conflict=true;backup(c,c.record,'conflict-local');return;}
  }else if(c.record&&c.revision===null&&remote.record&&signature(c.record)!==signature(remote.record)){
   c.conflict=true;c.dirty=true;backup(c,c.record,'legacy-local');return;
  }else{c.record=remote.record||c.record;c.dirty=!remote.record&&!!c.record;}
  c.revision=remote.revision;c.conflict=false;persist(c);
 }
 async function flush(c=current){if(!c)return true;if(c.writing)return c.writing;if(c.ready&&!c.dirty)return true;if(c.ready&&c.conflict)return false;
  c.writing=(async()=>{try{
   if(!c.ready){await reconcile(c);if(c!==current)return false;}
   if(c.conflict)return false;
   while(c.dirty){
    if(!c.write){c.write={id:crypto.randomUUID(),record:clone(c.record)};persist(c);}
    const sent=c.write,d=await api(c,'write',{revision:c.revision,mutation_id:sent.id,record:sent.record});
    if(!Number.isSafeInteger(d.revision)||d.revision<1)throw Error('云端学习记录服务尚未升级');
    c.revision=d.revision;c.write=null;c.error='';c.dirty=signature(c.record)!==signature(sent.record);persist(c);
   }return true;
  }catch(e){c.error=e.message;if(e.status===409){c.conflict=true;try{c.remote=await read(c);backup(c,c.record,'conflict-local');}catch(err){c.error=err.message;}}return false;
  }finally{c.writing=null;paint(c);}})();paint(c);return c.writing;
 }
 async function prepare(options){clearTimeout(timer);if(current)await flush(current);
  if(!window.MatinStudent?.signedIn){current=null;paint();return {record:options.local||null};}
  const c={...options,user:MatinStudent.userId,record:clone(options.local),revision:null,dirty:false,ready:false,write:null,conflict:false,error:'',writing:null};
  try{const m=JSON.parse(localStorage.getItem(c.key+':cloud')||'null');if(m&&(m.revision===null||Number.isSafeInteger(m.revision)&&m.revision>=0)){c.revision=m.revision;c.dirty=!!m.dirty;c.write=m.write||null;if(m.dirty)c.record=m.record;else if(options.local&&signature(options.local)!==signature(m.record))c.dirty=true;}}
  catch{c.error='本机同步缓存无法读取';}
  previous=current;current=c;try{await reconcile(c);}catch(e){c.error=e.message;c.ready=false;}paint(c);return {record:clone(c.record)};
 }
 function queue(record){const c=current;if(!c)return;const changed=signature(record)!==signature(c.record);c.record=clone(record);if(changed)c.dirty=true;persist(c);paint(c);clearTimeout(timer);if(c.dirty&&c.ready&&!c.conflict&&!c.error)timer=setTimeout(()=>void flush(c),700);}
 async function retry(){const c=current;if(!c)return;
  if(!c.ready||c.conflict){try{await reconcile(c);if(!c.dirty&&c.record){localStorage.setItem(c.key,JSON.stringify(c.record));await c.reload();return;}}catch(e){c.error=e.message;paint(c);return;}}
  await flush(c);
 }
 mount();$('retry').onclick=retry;
 $('export').onclick=()=>{if(current?.record)download(current.record,'Matin学习记录备份');};
 $('use-remote').onclick=async()=>{const c=current;if(!c||!confirm('采用最新云端记录继续学习？当前本机版本会另存为本机恢复副本。'))return;
  try{const d=await read(c);backup(c,c.record,'before-remote');c.record=d.record;c.revision=d.revision;c.dirty=false;c.write=null;c.conflict=false;c.error='';persist(c);if(c.record)localStorage.setItem(c.key,JSON.stringify(c.record));else localStorage.removeItem(c.key);await c.reload();}catch(e){c.error=e.message;paint(c);}
 };
 $('use-local').onclick=async()=>{const c=current;if(!c)return;try{const d=await read(c);if(!confirm('用本机记录替换云端最新进度？\n本机：'+describe(c.record)+'\n云端：'+describe(d.record)+'\n云端原版本会另存为此浏览器的恢复副本。'))return;backup(c,d.record,'before-local');c.revision=d.revision;c.write=null;c.conflict=false;c.error='';c.dirty=true;persist(c);await flush(c);}catch(e){c.error=e.message;paint(c);}};
 window.addEventListener('online',()=>void retry());
 window.addEventListener('beforeunload',e=>{if(current?.dirty){e.preventDefault();e.returnValue='';}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)void flush();});
 window.MatinLearningSync={prepare,queue,flush,cancel:()=>{current=previous;previous=null;paint();},accept:()=>{previous=null;},hasConflict:()=>!!current?.conflict,hasPending:()=>!!current?.dirty};
})();
