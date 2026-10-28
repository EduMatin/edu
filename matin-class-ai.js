/* Authenticated requests: persistent IDs, private result lookup and explicit regeneration. No quotas. */
(() => {'use strict';
 const prefix='matin_ai_request_v2:',clone=v=>JSON.parse(JSON.stringify(v)),flights=new Map();
 const labels={chat:'学习对话',evaluation:'阶段评价',hint:'补学提示',scenario:'生成剧本',preview:'教师预览',test:'连接检查'};
 const states={local:'准备发送',pending:'处理中',unknown:'结果待确认',missing:'服务器尚未受理',completed:'结果可查看',failed:'请求未成功',expired:'结果已过期'};
 const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
 const hash=async v=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(v)))),x=>x.toString(16).padStart(2,'0')).join('');
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const button=(text,fn)=>{const b=node('button',text);b.type='button';b.className='btn';b.onclick=fn;return b;};
 let client=null,dialog=null,entry=null,notice=null,content=null,pager=null,page=1,uiBusy=false;
 const identity=()=>client?.user()||'';
 const ownerPrefix=()=>prefix+encodeURIComponent(client?.base||'')+':'+encodeURIComponent(identity())+':';
 function records(){if(!identity())return [];const p=ownerPrefix(),rows=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k?.startsWith(p))continue;try{const r=JSON.parse(localStorage.getItem(k));if(r?.schema===2&&r.id&&r.payload&&r.hash)rows.push(r);}catch{}}return rows.sort((a,b)=>b.created-a.created);}
 function persist(r){if(r.owner!==identity())throw Error('账号已变化，原请求仍保留在原账号下。');try{localStorage.setItem(ownerPrefix()+r.id,JSON.stringify(r));}catch{throw Error('请求恢复记录无法保存，请检查浏览器存储或导出记录；为避免重复消耗，本次未继续发送。');}refresh();}
 function saved(r){try{return JSON.parse(localStorage.getItem(ownerPrefix()+r.id))||r;}catch{return r;}}
 function error(message,state){const e=Error(message);e.aiRecovery=true;e.state=state;return e;}
 function statusError(r){return error((r.result?.error||({pending:'原请求仍在处理，请稍后查询。',unknown:'原请求结果尚无法确认，请查询原请求；系统不会自动重新调用模型。',expired:'原请求结果已过期，无法恢复。',missing:'服务器尚未受理，可继续原请求。'}[r.state]||'原请求未成功。'))+' 可打开“AI 请求恢复”处理。',r.state);}
 async function send(body,signal,owner){
  if(!client||!owner||identity()!==owner)throw Error('请登录原账号后恢复请求。');const token=await client.token();if(identity()!==owner)throw Error('账号已变化。');
  const res=await fetch(client.base+'/functions/v1/matin-chat',{method:'POST',signal:signal||AbortSignal.timeout(45000),headers:{'Content-Type':'application/json',apikey:client.key,Authorization:'Bearer '+token},body:JSON.stringify(body)});
  const data=await res.json().catch(()=>null);if(identity()!==owner)throw Error('账号已变化，未显示原账号的回复。');
  if(!data)throw error('响应中断，原请求编号已保留，请查询恢复。','unknown');if(!res.ok&&!data.state)throw error(data.error||'请求服务暂不可用，请查询原请求。','unknown');return data;
 }
 function update(r,d){
  r={...saved(r),state:d.state||(d.reply?'completed':'unknown'),checked:Date.now()};
  if(d.result)r.result=d.result;else if(d.reply||d.error)r.result={reply:d.reply,error:d.error,model:d.model};
  if(d.expires_at)r.expires_at=d.expires_at;if(d.recovery_saved===false)r.cacheWarning='云端结果保存未确认，本机已保留收到的内容。';
  if(r.result?.reply)r.state='completed';
  try{persist(r);}catch(e){if(!r.result?.reply)throw e;window.dispatchEvent(new CustomEvent('matin-ai-recovery-warning',{detail:'AI 已回复，但本机恢复副本未保存。请先保留回复；原编号仍可用于云端查询。'}));}
  return r;
 }
 async function query(r,signal){return update(r,await send({action:'recover',request_id:r.id},signal,r.owner));}
 async function perform(r,signal,retry=false){
  try{
   if(signal?.aborted)throw error('请求已取消，原编号保留，可稍后查询。','unknown');
   if(retry){r=await query(r,signal);if(r.state==='completed')return r;if(r.state!=='missing')throw statusError(r);}
   r={...r,state:'pending'};persist(r);const result=await send({...r.payload,request_id:r.id},signal,r.owner);r=update(r,result);
   if(r.state!=='completed')throw statusError(r);if(result.usage_recorded===false)window.dispatchEvent(new CustomEvent('matin-ai-usage-pending'));return r;
  }catch(e){
   if(identity()===r.owner){try{r={...saved(r)};if(!['completed','failed','expired','pending'].includes(e.state))r.state='unknown';r.error=e.message;persist(r);}catch{}}
   if(e.aiRecovery)throw e;throw error('网络中断或请求已取消；原请求编号已保留，请打开“AI 请求恢复”查询。','unknown');
  }
 }
 async function exclusive(key,fn){
  if(flights.has(key))return flights.get(key);
  if(!navigator.locks?.request)throw Error('当前浏览器不支持安全请求恢复，请使用新版 Chrome 或 Edge。');
  const p=navigator.locks.request(key,fn);flights.set(key,p);try{return await p;}finally{flights.delete(key);}
 }
 async function request(payload,signal){
  const owner=identity();if(!owner||!client?.base||!client?.key)throw Error('请先登录已验证邮箱的账号。');
  const wire=clone({system:payload.system,messages:payload.messages,context:payload.context}),meta=clone(payload.recovery||{}),signature=await hash({wire,meta}),key=ownerPrefix()+signature;
  return exclusive(key,async()=>{
   if(identity()!==owner)throw Error('账号已变化。');let old;try{old=records().find(r=>r.hash===signature&&!r.superseded);}catch{throw Error('无法读取本机请求记录；未调用模型。请检查浏览器存储。');}
   if(old?.state==='completed'&&old.result?.reply)return old.result.reply;
   if(old?.cleared){old={...old,payload:wire,meta,cleared:false};persist(old);}
   const r=old||{schema:2,id:crypto.randomUUID(),owner,hash:signature,payload:wire,meta,created:Date.now(),state:'local'};
   if(!old)persist(r);const done=await perform(r,signal,!!old);return done.result.reply;
  });
 }
 function download(r){const url=URL.createObjectURL(new Blob([JSON.stringify({request_id:r.id,created_at:new Date(r.created).toISOString(),state:r.state,context:r.payload.context,purpose:labels[r.payload.context?.purpose],result:r.result||null,original_request:r.payload,metadata:r.meta},null,2)],{type:'application/json'})),a=node('a');a.href=url;a.download='Matin-AI请求-'+r.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function action(fn){if(uiBusy)return;uiBusy=true;notice.textContent='正在处理原请求…';render();try{notice.textContent=await fn()||'已更新原请求状态。';}catch(e){notice.textContent=e.message;}finally{uiBusy=false;render();}}
 async function regenerate(r){
  if(!confirm('这会创建一个新的 AI 请求，可能再次产生模型消耗。原请求若已被供应商处理，无法撤销其消耗。确定重新请求吗？'))return '已取消，未新建请求。';
  return exclusive(ownerPrefix()+r.hash,async()=>{
   const latest=records().find(x=>x.hash===r.hash&&!x.superseded);if(latest&&latest.id!==r.id)throw Error('另一窗口已建立新请求，请先查询那条请求。');
   const fresh={schema:2,id:crypto.randomUUID(),owner:r.owner,hash:r.hash,payload:r.payload,meta:r.meta,created:Date.now(),state:'local'};
   persist(fresh);persist({...saved(r),superseded:true});await perform(fresh);return '新请求已完成，可查看结果；原请求记录仍保留。';
  });
 }
 function render(){
  if(!dialog?.open)return;content.replaceChildren();let rows;try{rows=records();}catch{notice.textContent='本机请求记录无法读取。';return;}
  const total=rows.length;page=Math.min(page,Math.max(1,Math.ceil(total/8)));
  for(const r of rows.slice((page-1)*8,page*8)){
   const article=node('article'),ctx=r.payload.context||{};article.dataset.requestId=r.id;
   article.append(node('strong',(labels[ctx.purpose]||'AI 请求')+' · '+(r.meta.title||r.meta.nodeName||ctx.project_id||'当前教学内容')),node('p',new Date(r.created).toLocaleString('zh-CN')+' · '+(states[r.state]||r.state)+(r.superseded?' · 已另外新建请求':'')),node('small','请求编号：'+r.id));
   const detail=node('details');detail.append(node('summary','请求与结果'),node('p','原提问：'+String(r.payload.messages?.at(-1)?.content||'').slice(0,1600)));
   if(r.result?.reply)detail.append(node('pre',r.result.reply));else detail.append(node('p',r.result?.error||'暂未取得可显示结果。'));if(r.cacheWarning)detail.append(node('p',r.cacheWarning));article.append(detail);
   const actions=node('div');actions.className='air-actions';actions.append(button('查询原请求',()=>action(async()=>{const result=await query(r);return '原请求：'+states[result.state]+'。本次查询未调用模型。';})));
   if((r.state==='missing'||r.state==='local')&&r.payload.messages?.length)actions.append(button('继续原请求',()=>action(async()=>{await exclusive(ownerPrefix()+r.hash,()=>perform(saved(r),undefined,true));return '原请求已完成，编号保持不变。';})));
   if(r.result?.reply){actions.append(button('查看结果',()=>{detail.open=true;detail.scrollIntoView({block:'nearest'});}));if(typeof window.MatinAIRecoveryApply==='function')actions.append(button('使用此结果',()=>action(async()=>{const message=await window.MatinAIRecoveryApply(clone(r));persist({...saved(r),used:true});return message||'已恢复到当前学习。';})));}
   actions.append(button('导出记录',()=>download(r)));if(['completed','failed','unknown','expired'].includes(r.state)&&!r.superseded&&r.payload.messages?.length)actions.append(button('重新请求',()=>action(()=>regenerate(r))));
   if(['completed','failed','expired'].includes(r.state)&&!r.cleared)actions.append(button('清理本机内容',()=>{if(!confirm('清理本机保存的原提问和回复？请求编号仍保留用于防止重复调用，云端结果在有效期内仍可查询。建议先导出重要内容。'))return;try{persist({...r,payload:{context:r.payload.context},meta:{title:r.meta.title},result:null,cleared:true});notice.textContent='已清理本机内容并保留请求编号。';}catch(e){notice.textContent=e.message;}}));
   article.append(actions);content.append(article);
  }
  if(!total)content.append(node('p','当前账号没有保留的请求。网络中断后请在这里查询，无需再次发送问题。'));
  pager.replaceChildren(node('span','共 '+total+' 条 · 第 '+page+' / '+Math.max(1,Math.ceil(total/8))+' 页'));const prev=button('上一页',()=>{page--;render();}),next=button('下一页',()=>{page++;render();});prev.disabled=page<=1||uiBusy;next.disabled=page*8>=total||uiBusy;pager.append(prev,next);content.querySelectorAll('button').forEach(b=>b.disabled=uiBusy);
 }
 function refresh(){if(!entry)return;entry.hidden=!identity();let rows=[];try{rows=records();}catch{}const pending=rows.filter(r=>!r.superseded&&r.state!=='completed').length;entry.textContent='AI 请求恢复'+(pending?' · '+pending:'');if(!identity()&&dialog.open)dialog.close();render();}
 function open(){if(!identity())return;page=1;notice.textContent='查询原请求不会调用模型。云端结果可取回 24 小时；本机收到的结果与编号继续保留。';if(!dialog.open)dialog.showModal();render();}
 function setup(){
  if(entry)return;entry=button('AI 请求恢复',open);entry.id='ai-recovery-open';entry.hidden=true;
  dialog=node('dialog');dialog.id='ai-recovery-dialog';dialog.setAttribute('aria-labelledby','ai-recovery-title');const head=node('header'),title=node('h2','AI 请求恢复');title.id='ai-recovery-title';head.append(title,button('关闭',()=>dialog.close()));
  notice=node('p');notice.id='ai-recovery-status';notice.setAttribute('role','status');content=node('div');content.className='air-content';pager=node('footer');dialog.append(head,notice,content,pager);document.body.append(dialog);
  const css=node('style');css.textContent='#ai-recovery-open{white-space:nowrap}#ai-recovery-dialog{width:min(880px,calc(100vw - 32px));max-height:90vh;border:0;border-radius:20px;padding:0;color:#263858;background:#fff;box-shadow:0 24px 80px #10204055}#ai-recovery-dialog::backdrop{background:#18234499}#ai-recovery-dialog[open]{display:flex;flex-direction:column}#ai-recovery-dialog header,#ai-recovery-dialog footer{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:16px 22px;flex-shrink:0}#ai-recovery-dialog h2{margin:0;font-size:22px}#ai-recovery-status{margin:0;padding:10px 22px;background:#f3f5ff;line-height:1.65;overflow-wrap:anywhere}#ai-recovery-dialog .air-content{overflow:auto;padding:10px 22px;min-height:0}#ai-recovery-dialog article{padding:16px 0;border-bottom:1px solid #dfe5f3}#ai-recovery-dialog p{line-height:1.6;margin:8px 0;overflow-wrap:anywhere}#ai-recovery-dialog small{color:#62728e;overflow-wrap:anywhere}#ai-recovery-dialog pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;background:#f6f8ff;border-radius:10px;padding:12px;max-height:300px;overflow:auto}#ai-recovery-dialog summary{cursor:pointer;margin:10px 0;color:#4863b0}#ai-recovery-dialog .air-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}#ai-recovery-dialog .btn{font:inherit;font-size:13px;padding:8px 12px;border:1px solid #dce3f2;border-radius:10px;background:#fff;cursor:pointer}#ai-recovery-dialog :disabled{opacity:.5;cursor:wait}#ai-recovery-dialog :focus-visible{outline:3px solid #a7b7ff;outline-offset:2px}@media(max-width:600px){#ai-recovery-dialog header,#ai-recovery-dialog footer{padding:12px;flex-wrap:wrap}#ai-recovery-status{padding:10px 12px}#ai-recovery-dialog .air-content{padding:0 12px}}';document.head.append(css);
  const attach=()=>{const bar=document.getElementById('teacher-account-bar')||document.getElementById('student-bar');if(bar&&!entry.isConnected){bar.append(entry);refresh();}};new MutationObserver(attach).observe(document.body,{childList:true,subtree:true});attach();
  window.addEventListener('storage',e=>{if(e.key===null||e.key.startsWith(prefix))refresh();});window.addEventListener('matin-student-auth-changed',refresh);
 }
 window.MatinClassAI={client(options){client=options;setup();return {request,refresh,open};},refresh,open,
  hasUnresolved(context,text){try{return records().some(r=>!r.superseded&&r.state!=='completed'&&r.payload.context?.purpose===(context.purpose||'chat')&&r.payload.context.task_id===context.task_id&&(r.payload.context.project_id||r.meta.projectId)===context.project_id&&(r.payload.context.node_id||r.meta.nodeId)===context.node_id&&r.payload.messages?.at(-1)?.content===text);}catch{return false;}}
 };
})();
