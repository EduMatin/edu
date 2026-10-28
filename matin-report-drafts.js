/* Private, local report form drafts. Never sends or changes a teaching record. */
(() => {'use strict';
 const prefix='matin_report_draft_v1:',copy=v=>JSON.parse(JSON.stringify(v)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const button=(text,fn)=>{const n=node('button',text);n.type='button';n.className='btn';n.onclick=fn;return n;};
 const css=node('style');css.textContent='.rd-draft{border:1px solid #dbe3f6;border-left:4px solid #6970df;border-radius:12px;background:#f7f8ff;padding:12px 16px;margin:12px 0;font-size:14px}.rd-draft[data-error=true]{border-left-color:#b56821;background:#fff7eb}.rd-draft .rd-actions{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.rd-draft .btn{padding:7px 10px;font-size:13px}.rd-draft summary{cursor:pointer}.rd-draft article{border-top:1px solid #dce2ee;margin-top:10px;padding-top:8px}.rd-draft pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:180px;overflow:auto;font:inherit}.rd-draft p{margin:4px 0}.rd-draft small{color:#657594}';document.head.append(css);
 function mount({container,scope,baseline,initial,read,apply,isOwner,onDirty,editable=true}){
  const base=prefix+encodeURIComponent(JSON.stringify(scope))+':',box=node('section'),message=node('p'),help=node('small','仅本机当前浏览器、当前账号可恢复；不会自动提交或发布。清除浏览器数据会删除草稿。'),actions=node('div'),others=node('details'),list=node('div');
  let key=base+crypto.randomUUID();
  box.className='rd-draft';box.dataset.reportDraft='';message.setAttribute('role','status');actions.className='rd-actions';others.append(node('summary','查看保留草稿'),list);box.append(message,help,actions,others);container.prepend(box);
  let active=true,source=null,last=null,error='',restored=false,records=[],revision=0;
  const allowed=()=>active&&isOwner();
  function scan(){
   const found=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k?.startsWith(base))continue;
    try{const raw=localStorage.getItem(k),r=JSON.parse(raw);if(r?.schema===1&&r.data&&typeof r.data==='object'&&typeof r.at==='string'&&typeof r.token==='string'&&r.baseline&&raw.length<500000)found.push({...r,key:k});}catch{/* Ignore an invalid record without deleting it. */}
   }return found.sort((a,b)=>b.at.localeCompare(a.at));
  }
  function remove(record){if(!record)return;const now=JSON.parse(localStorage.getItem(record.key)||'null');if(now?.token===record.token)localStorage.removeItem(record.key);}
  function exportData(data,at=new Date().toISOString(),savedBaseline=baseline){
   if(!allowed())return;const url=URL.createObjectURL(new Blob([JSON.stringify({format:'Matin私有报告草稿',scope,baseline:savedBaseline,saved_at:at,data},null,2)],{type:'application/json'})),a=node('a');a.href=url;a.download='Matin报告草稿-'+at.slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function preview(data){return Object.entries(data).map(([k,v])=>({grade:'教师评分',feedback:'教师总评',reason:'退回修改要求',due:'重交截止时间',summary:'学习总结',annotations:'逐条批注',rubric:'评分量表',nextAction:'保存并继续操作'}[k]||k)+'：'+(k==='rubric'?(v?.enabled?'已启用':'未启用')+'\n'+(Array.isArray(v?.items)?v.items:[]).filter(i=>i&&typeof i==='object').map(i=>i.name+'：'+(i.score||'未填')+' / '+i.max+' · '+i.guide).join('\n'):k==='nextAction'?({annotate:'仅保存评分与批注',passed:'通过报告',revision_required:'退回修改'}[v]||'仅保存评分与批注'):Array.isArray(v)?v.filter(a=>a&&Number.isInteger(a.message_index)).map(a=>'第 '+(a.message_index+1)+' 条：'+a.text).join('\n'):String(v??''))).join('\n\n');}
  function paint(){
   if(!allowed())return;
   const dirty=!same(read(),initial);onDirty(dirty);
   box.dataset.error=String(!!error);
   message.textContent=error||(!editable?'此报告只读，保留的草稿仅供查看和导出。':last||source?(restored?'已恢复本机草稿':'本机草稿已自动保存')+' · '+new Date((last||source).at).toLocaleString('zh-CN')+' · 尚未正式保存或提交。':'输入时自动保存私有草稿；正式操作仍需点击下方保存或提交。');
   const external=records.filter(r=>r.key!==key&&r.key!==source?.key);
   others.hidden=external.length===0;others.firstChild.textContent='查看保留草稿（'+external.length+'）';list.replaceChildren();
   for(const r of external){
    const compatible=editable&&same(r.baseline,baseline),article=node('article'),detail=node('details'),row=node('div');row.className='rd-actions';
    article.append(node('p',new Date(r.at).toLocaleString('zh-CN')+' · '+(scope[2]==='student-summary'?'准备提交第 '+(Number(r.baseline.version)+1)+' 版':'报告第 '+r.baseline.version+' 版')+(compatible?' · 另一份草稿，当前输入不会被自动替换':' · 云端版本或批注已变化 / 当前只读，不自动恢复')));
    detail.append(node('summary','查看草稿内容'),node('pre',preview(r.data)));article.append(detail);
    if(compatible)row.append(button('恢复这份草稿',()=>{if(!allowed())return;if(!save())return;key=base+crypto.randomUUID();apply(copy(r.data));source=r;last=null;restored=true;paint();}));
    row.append(button('导出这份草稿',()=>exportData(r.data,r.at,r.baseline)),button('删除这份草稿',()=>{if(!allowed()||!confirm('只删除这份本机草稿？正式报告和其他草稿不会改变。'))return;try{remove(r);records=scan();error='';}catch{error='草稿删除失败，请检查浏览器存储。';}paint();}));article.append(row);list.append(article);
   }
   actions.replaceChildren();
   if(editable){
    if(error)actions.append(button('重试保存草稿',()=>save()));
    if(dirty||last||source)actions.append(button('导出当前草稿',()=>exportData(read())),button('放弃当前草稿',()=>{if(!allowed()||!confirm('放弃当前未正式保存的输入，恢复本次打开时的内容？'))return;try{remove(last);remove(source);last=source=null;apply(copy(initial));error='';restored=false;records=scan();}catch{error='无法删除草稿，当前输入仍保留。';}paint();}));
   }
  }
  function save(){
   if(!allowed())return false;if(!editable)return true;
   const data=copy(read());onDirty(!same(data,initial));
   try{
    if(same(data,initial)){remove(last);remove(source);last=source=null;records=scan();error='';paint();return true;}
    const cached=last||source,stored=cached&&JSON.parse(localStorage.getItem(cached.key)||'null');
    if(!cached||!same(cached.data,data)||stored?.token!==cached.token){
     const r={schema:1,baseline:copy(baseline),data,at:new Date().toISOString(),token:crypto.randomUUID(),revision:++revision};
     // Immutable writes: another tab may remove an old copy while we type,
     // but can never remove a newer edit by racing a read/remove on the same key.
     const raw=JSON.stringify(r),nextKey=base+r.token;if(raw.length>=500000)throw Error('draft too large');localStorage.setItem(nextKey,raw);
     const previous=last;key=nextKey;last={key,...r};remove(previous);remove(source);source=null;restored=false;
    }
    records=scan();error='';paint();return true;
   }catch{error='自动保存失败：浏览器存储不可用或空间不足。当前输入仍在，请正式保存/提交，或导出草稿后再关闭。';paint();return false;}
  }
  function changed(){if(allowed())save();}
  function storage(e){if(!allowed()||e.key!==null&&!e.key.startsWith(base))return;try{records=scan();paint();}catch{error='无法读取本机草稿，请保留当前窗口或导出输入。';paint();}}
  try{
   records=scan();const matches=records.filter(r=>same(r.baseline,baseline));
   // Multiple concurrent copies require an explicit choice; never combine grades or notes.
   if(editable&&matches.length===1){source=matches[0];apply(copy(source.data));restored=true;}
  }catch{error='无法读取本机草稿。输入后将重试保存；如仍失败，请导出输入后再关闭。';}
  paint();window.addEventListener('storage',storage);
  return {
   changed,flush:save,
   // Clear only this form's matching copy after the formal request is confirmed.
   commit(){if(!allowed())return;try{remove(last);remove(source);}catch{/* A later open treats this copy as stale by server revision. */}last=source=null;},
   dispose(){active=false;window.removeEventListener('storage',storage);box.remove();}
  };
 }
 window.MatinReportDrafts={mount};
})();
