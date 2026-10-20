/* Class assignments. All authorization is enforced by matin_tasks RPC. */
(() => {'use strict';
 let teacher=false,cls=null,busy=false;
 const root=document.createElement('div');root.id='tasks-modal';root.className='modal-layer hidden';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','班级学习任务');
 root.innerHTML=`<div class="modal" style="width:94vw;max-width:850px;max-height:90vh;overflow:auto"><div class="actions"><h2 id="tasks-title">我的任务</h2><button class="btn" id="tasks-close">关闭</button><button class="btn" id="tasks-refresh">刷新任务</button></div><p>截止时间按当前设备时区显示。逾期仍可补做；完成状态为学生自报，不代表教师评分。</p><form id="tasks-form"><label>已发布项目<select id="tasks-project" required></select></label><label>任务名称<input id="tasks-name" maxlength="120" required></label><label>截止时间<input id="tasks-due" type="datetime-local" required></label><label>学习要求<textarea id="tasks-instructions" maxlength="2000"></textarea></label><button class="btn primary" type="submit">布置任务</button></form><label id="tasks-filter-label"><input type="checkbox" id="tasks-pending" checked>只看待完成事项</label><p id="tasks-status" role="status"></p><div id="tasks-list"></div></div>`;
 document.body.append(root);const style=document.createElement('style');style.textContent='#tasks-modal{z-index:130}#tasks-modal .actions{display:flex;gap:10px;flex-wrap:wrap}#tasks-form{display:grid;gap:12px;margin:16px 0}#tasks-form label{display:grid;gap:6px}#tasks-form input,#tasks-form select,#tasks-form textarea{width:100%;min-width:0;padding:10px;border:1px solid #ccd5e7;border-radius:8px}#tasks-list article{padding:16px;border:1px solid #dce3f1;border-radius:12px;margin:12px 0;overflow-wrap:anywhere}#tasks-list p{white-space:pre-wrap}#tasks-status{color:#805221}';document.head.append(style);
 const $=id=>document.getElementById(id);
 const api=(op,data={})=>teacher?window.MatinAccount.api({action:'tasks',op,data:{...data,class_id:cls.id}}):window.MatinStudent.taskApi(op,data);
 const button=(text,fn)=>{const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=text;b.onclick=()=>run(fn);return b;};
 async function run(fn){if(busy)return;busy=true;root.querySelectorAll('button,input,select,textarea').forEach(e=>e.disabled=true);$('tasks-status').textContent='正在加载…';try{await fn();$('tasks-status').textContent='已同步云端任务';}catch(e){$('tasks-status').textContent=e.message;}finally{busy=false;root.querySelectorAll('button,input,select,textarea').forEach(e=>e.disabled=false);}}
 async function load(){const d=await api(teacher?'teacher_list':'list');
  if(teacher){const select=$('tasks-project'),old=select.value;select.replaceChildren();for(const p of d.projects){const o=document.createElement('option');o.value=p.id;o.textContent=p.title;select.append(o);}if([...select.options].some(o=>o.value===old))select.value=old;}
  const list=$('tasks-list');list.replaceChildren();let count=0;
  for(const t of d.tasks){if(!teacher&&$('tasks-pending').checked&&t.status==='completed')continue;count++;
   const a=document.createElement('article'),h=document.createElement('h3'),p=document.createElement('p'),desc=document.createElement('p');h.textContent=t.title;
   const late=Date.parse(t.due_at)<Date.now();p.textContent=(teacher?'':t.class_name+' · ')+new Date(t.due_at).toLocaleString('zh-CN')+' 截止 · '+(teacher?(t.active?'已布置':'已撤回')+' · '+t.completed_count+' 人自报完成':t.status==='completed'?'已完成（自报）':(late?'已逾期 · ':'')+(t.status==='started'?'进行中':'待开始'));
   desc.textContent=t.instructions;a.append(h,p,desc);
   if(teacher&&t.active)a.append(button('撤回任务',async()=>{if(!confirm('撤回后学生将不再看到此任务，确认？'))return;await api('cancel',{task_id:t.id,revision:Number(t.revision)});await load();}));
   if(!teacher&&t.available){a.append(button(t.status==='pending'?'开始学习':'打开学习记录',async()=>{const d=await api('open',{task_id:t.id});window.MatinTaskOpen(d.project);root.classList.add('hidden');}));if(t.status!=='completed')a.append(button('标记已完成',async()=>{if(!confirm('确认已完成此任务的学习要求？这将记录为学生自报完成。'))return;await api('complete',{task_id:t.id});await load();}));}
   else if(!teacher){const n=document.createElement('p');n.textContent='项目已下架，请联系教师。';a.append(n);}list.append(a);
  }
  if(!count)list.textContent=teacher?'尚未布置任务。选择本班关联课程下的已发布项目后布置。':'暂无待显示的任务。可取消“只看待完成事项”或刷新任务。';
 }
 $('tasks-close').onclick=()=>{if(!busy)root.classList.add('hidden');};root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();$('tasks-close').click();}});
 $('tasks-refresh').onclick=()=>run(load);$('tasks-pending').onchange=()=>run(load);
 $('tasks-form').onsubmit=e=>{e.preventDefault();const due=new Date($('tasks-due').value);if(!Number.isFinite(+due)||due<=new Date()){$('tasks-status').textContent='请选择未来的截止时间';return;}
  run(async()=>{await api('create',{project_id:$('tasks-project').value,title:$('tasks-name').value.trim(),instructions:$('tasks-instructions').value,due_at:due.toISOString()});$('tasks-form').reset();await load();});};
 window.MatinTasks={open(row=null){if(busy)return;teacher=!!row;cls=row;$('tasks-form').hidden=!teacher;$('tasks-form').style.display=teacher?'grid':'none';$('tasks-filter-label').hidden=teacher;$('tasks-title').textContent=teacher?row.name+' · 学习任务':'我的任务';$('tasks-list').replaceChildren();$('tasks-form').reset();root.classList.remove('hidden');run(load);}};
})();
