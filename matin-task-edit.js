/* Edit assignment scheduling only; task identity, learning snapshots and reports stay intact. */
(() => {'use strict';
 const el=(tag,text,cls='')=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;n.className=cls;return n;};
 const btn=(label,fn)=>{const b=el('button',label,'btn');b.type='button';b.onclick=fn;return b;};
 const time=v=>new Date(v).toLocaleString('zh-CN');
 const local=v=>{const d=new Date(v);return new Date(d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
 const root=el('div',undefined,'te-layer');root.id='task-edit-modal';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','te-title');
 const panel=el('div',undefined,'te-panel'),header=el('header'),title=el('h2'),closeButton=btn('返回',()=>close()),status=el('p',undefined,'te-status'),body=el('div',undefined,'te-body'),footer=el('footer');title.id='te-title';status.setAttribute('role','status');header.append(title,closeButton);panel.append(header,status,body,footer);root.append(panel);document.body.append(root);
 const css=el('style');css.textContent=`.te-layer{position:fixed;inset:0;z-index:170;background:#101a3db8;display:flex;align-items:center;justify-content:center;padding:16px;color:#27395c}.te-layer[hidden]{display:none!important}.te-panel{background:white;border-radius:22px;width:min(800px,100%);max-height:94vh;max-height:94dvh;display:flex;flex-direction:column;min-width:0;box-shadow:0 24px 90px #101a3d40}.te-panel header,.te-panel footer{padding:18px 24px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between;flex-shrink:0}.te-panel header{border-bottom:1px solid #e3e9f4}.te-panel h2{font-size:21px;margin:0;overflow-wrap:anywhere}.te-status{padding:0 24px;color:#805221;margin:12px 0;overflow-wrap:anywhere}.te-body{padding:0 24px 20px;overflow:auto;min-height:0}.te-body p{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7}.te-body label{display:grid;gap:8px;margin:18px 0;font-weight:600}.te-body input,.te-body textarea{box-sizing:border-box;width:100%;min-width:0;border:1px solid #ccd5e7;padding:12px;border-radius:10px;font:inherit;color:inherit;background:white}.te-body textarea{min-height:130px;resize:vertical}.te-note{padding:12px 16px;background:#f2f5ff;border-radius:12px;font-size:13px}.te-row{display:flex;gap:8px;flex-wrap:wrap}.te-history{border:1px solid #e1e7f2;padding:14px;border-radius:12px;margin:14px 0;font-size:14px}.te-history h3{margin:0;font-size:15px}.te-history details{margin-top:10px}.te-panel :disabled{opacity:.55;cursor:not-allowed}.te-panel :focus-visible{outline:3px solid #b7c6ff;outline-offset:2px}@media(max-width:600px){.te-layer{padding:8px}.te-panel header,.te-panel footer{padding:14px}.te-body{padding:0 14px 14px}.te-status{padding:0 14px}.te-panel h2{font-size:18px}}`;document.head.append(css);
 let current=null;
 const valid=c=>c===current&&(!c.owner||c.owner===window.MatinStudent?.userId);
 function close(){const c=current;if(!c)return;if(c.busy&&c.writing)return;if(c.dirty&&!confirm('放弃尚未保存的任务修改？'))return;current=null;root.hidden=true;if(c.under)c.under.inert=c.underInert;if(c.opener?.isConnected)c.opener.focus();}
 function lock(c){if(!valid(c))return;root.querySelectorAll('button,input,textarea').forEach(n=>n.disabled=c.busy||c.saved);closeButton.disabled=c.busy&&c.writing;root.setAttribute('aria-busy',String(c.busy));}
 async function run(c,fn,writing=false){if(!valid(c)||c.busy)return;c.busy=true;c.writing=writing;status.textContent=writing?'正在保存…':'正在读取…';lock(c);try{await fn();}catch(e){if(valid(c)){status.textContent=e.message||'请求失败，请重试。';}}finally{if(valid(c)){c.busy=false;c.writing=false;lock(c);}}}
 const api=async(c,op,data={})=>{const input={task_id:c.id,...data};const d=c.teacher?await MatinAccount.api({action:'task_edit',op,data:input}):await MatinStudent.api(op,input,'task_edit');if(d.edit_version!==1)throw Error('任务修改服务尚未升级，请完成 SQL 和函数更新。');return d;};
 function begin(task,teacher,onSaved){if(current)return;const under=[...document.querySelectorAll('.modal-layer:not(.hidden)')].filter(n=>n.getClientRects().length&&!n.inert).at(-1);const c={id:task.id,task,teacher,onSaved,owner:teacher?'':window.MatinStudent?.userId,opener:document.activeElement,under,underInert:under?.inert,busy:false,dirty:false,saved:false,history:[]};current=c;if(under)under.inert=true;root.hidden=false;body.replaceChildren();footer.replaceChildren();title.textContent=task.title;closeButton.focus();return c;}
 async function loadEdit(c){const d=await api(c,'get');if(!valid(c))return;c.task=d.task;c.dirty=false;c.write=null;drawEdit(c);status.textContent='已读取最新安排。延期或补充说明不会重置学生进度。';}
 function drawEdit(c){body.replaceChildren();footer.replaceChildren();title.textContent='编辑任务 · '+c.task.title;
  body.append(el('p','只修改截止时间和学习要求。原项目学习版本、学生对话、阶段评价、已提交报告及批注均保留。时间按当前设备时区显示。','te-note'));
  const form=el('form');form.id='te-form';const dueLabel=el('label','截止时间'),due=el('input');due.type='datetime-local';due.required=true;due.step='60';due.id='te-due';due.value=local(c.task.due_at);c.initialDue=due.value;dueLabel.append(due);
  const quick=el('div',undefined,'te-row');for(const days of [1,7])quick.append(btn('延长 '+days+' 天',()=>{const d=new Date(due.value);if(!Number.isFinite(+d))return;d.setDate(d.getDate()+days);due.value=local(d);update();}));
  const noteLabel=el('label','学习要求 / 补充说明'),note=el('textarea');note.id='te-instructions';note.maxLength=2000;note.value=c.task.instructions;noteLabel.append(note);
  const whyLabel=el('label','修改原因（选填，师生均可见）'),why=el('input');why.id='te-reason';why.maxLength=300;why.placeholder='例如：实验室调整，延长提交时间';whyLabel.append(why);
  const preview=el('p',undefined,'te-note');preview.id='te-preview';
  function update(){c.dirty=due.value!==c.initialDue||note.value!==c.task.instructions||!!why.value;preview.textContent='原截止：'+time(c.task.due_at)+(due.value&&Number.isFinite(+new Date(due.value))?'\n新截止：'+time(new Date(due.value)):'\n请选择有效截止时间')+'\n逾期状态按新截止时间重新计算，原提交时间保留。';}
  form.oninput=update;update();form.append(dueLabel,quick,noteLabel,whyLabel,preview);body.append(form);
  const save=el('button','保存修改','btn primary');save.type='submit';save.setAttribute('form','te-form');save.id='te-save';
  const reload=btn('重新载入最新内容',()=>{if(c.dirty&&!confirm('重新载入会放弃当前输入，是否继续？'))return;run(c,()=>loadEdit(c));});reload.id='te-reload';
  const backup=btn('导出当前输入',()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify({task:c.task.title,due_at:due.value,instructions:note.value,reason:why.value},null,2)],{type:'application/json'}));a.href=url;a.download='任务修改草稿.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});footer.append(reload,backup,save);
  form.onsubmit=e=>{e.preventDefault();if(c.busy||c.saved)return;const date=new Date(due.value);const dueISO=due.value===c.initialDue?c.task.due_at:Number.isFinite(+date)?date.toISOString():'';
   if(!dueISO||due.value!==c.initialDue&&date<=new Date()){status.textContent='修改后的截止时间须晚于当前时间；仅补充说明可保留原截止时间。';return;}
   if(due.value!==c.initialDue&&+date<+new Date(c.task.due_at)&&!confirm('截止时间将提前到 '+time(date)+'，可能使部分学生变为逾期。确认保存？'))return;
   const data={revision:Number(c.task.revision),due_at:dueISO,instructions:note.value,reason:why.value.trim()},signature=JSON.stringify(data);
   if(!c.write||c.write.signature!==signature)c.write={signature,data:{...data,mutation_id:crypto.randomUUID()}};
   run(c,async()=>{const result=await api(c,'save',c.write.data);if(!valid(c))return;c.dirty=false;c.saved=true;status.textContent=result.unchanged?'内容没有变化，无需保存。':'修改已保存，原任务和学生进度已保留。';if(c.onSaved){try{await c.onSaved();}catch{if(valid(c))status.textContent+=' 列表刷新失败，返回后请刷新任务。';}}},true);
  };
 }
 async function history(c,more=false){const last=c.history.at(-1);const d=await api(c,'history',more&&last?{before_revision:last.revision}:{});if(!valid(c))return;c.task=d.task;c.history=more?[...c.history,...d.history]:d.history;body.replaceChildren();footer.replaceChildren();title.textContent=(c.teacher?'修改记录':'任务变更')+' · '+c.task.title;
  body.append(el('p','当前截止：'+time(c.task.due_at)+'\n截止时间与学习要求可以调整，项目学习版本和学生进度保持不变。逾期状态按当前截止时间计算。','te-note'));
  if(!c.history.length)body.append(el('p','尚无修改记录。此处记录启用本功能后的任务修改。'));
  for(const h of c.history){const card=el('article',undefined,'te-history');card.append(el('h3',time(h.changed_at)+' · '+h.actor+' · 任务版本 '+h.revision));
   if(h.before_data.due_at!==h.after_data.due_at)card.append(el('p','截止时间：'+time(h.before_data.due_at)+' → '+time(h.after_data.due_at)));
   if(h.before_data.instructions!==h.after_data.instructions){const details=el('details');details.append(el('summary','学习要求已修改 · 查看前后内容'),el('p','修改前：\n'+(h.before_data.instructions||'（空）')),el('p','修改后：\n'+(h.after_data.instructions||'（空）')));card.append(details);}
   if(h.reason)card.append(el('p','原因：'+h.reason));body.append(card);
  }
  footer.append(btn('刷新修改记录',()=>run(c,()=>history(c))));if(d.has_more)footer.append(btn('加载更早记录',()=>run(c,()=>history(c,true))));status.textContent='已读取 '+c.history.length+' 条修改记录';
 }
 root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}if(e.key==='Tab'){const ns=[...root.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),summary')].filter(n=>n.getClientRects().length);if(e.shiftKey&&document.activeElement===ns[0]){e.preventDefault();ns.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===ns.at(-1)){e.preventDefault();ns[0]?.focus();}}});
 window.MatinTaskEdit={edit(task,onSaved){const c=begin(task,true,onSaved);if(c){footer.append(btn('重试读取',()=>run(c,()=>loadEdit(c))));run(c,()=>loadEdit(c));}},history(task,teacher=false){const c=begin(task,teacher);if(c){footer.append(btn('重试读取',()=>run(c,()=>history(c))));run(c,()=>history(c));}}};
})();
