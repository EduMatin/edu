/* Class assignments. All authorization is enforced by matin_tasks RPC. */
(() => {'use strict';
 // Each opening owns its requests; a late response must not affect another class.
 let active=null;
 const root=document.createElement('div');root.id='tasks-modal';root.className='modal-layer hidden';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','班级学习任务');
 root.innerHTML=`<div class="modal" style="width:94vw;max-width:850px;max-height:90vh;overflow:auto">
 <div class="actions"><h2 id="tasks-title">我的任务</h2><button type="button" class="btn" id="tasks-close">关闭</button><button type="button" class="btn" id="tasks-refresh">刷新任务</button></div>
 <p>截止时间按当前设备时区显示。逾期仍可补做；完成状态为学生自报，不代表教师评分。</p>
 <div id="tasks-project-notice"><p id="tasks-project-help" role="status"></p><button type="button" class="btn" id="tasks-return" hidden>返回班级检查课程</button></div>
 <form id="tasks-form"><label>已发布项目<select id="tasks-project" aria-describedby="tasks-project-help" required></select></label>
 <label>任务名称<input id="tasks-name" maxlength="120" required></label>
 <label>截止时间<input id="tasks-due" type="datetime-local" required></label>
 <label>学习要求<textarea id="tasks-instructions" maxlength="2000"></textarea></label>
 <button class="btn primary" id="tasks-submit" type="submit">布置任务</button></form>
 <label id="tasks-filter-label"><input type="checkbox" id="tasks-pending" checked>只看待完成事项</label>
 <p id="tasks-status" role="status"></p><div id="tasks-list"></div></div>`;
 document.body.append(root);const style=document.createElement('style');style.textContent='#tasks-modal{z-index:130}#tasks-modal .actions{display:flex;gap:10px;flex-wrap:wrap}#tasks-form{display:grid;gap:12px;margin:16px 0}#tasks-form label{display:grid;gap:6px}#tasks-form input,#tasks-form select,#tasks-form textarea{width:100%;min-width:0;padding:10px;border:1px solid #ccd5e7;border-radius:8px}#tasks-list article{padding:16px;border:1px solid #dce3f1;border-radius:12px;margin:12px 0;overflow-wrap:anywhere}#tasks-list p{white-space:pre-wrap}#tasks-status{color:#805221}#tasks-project-notice{margin-top:14px;padding:12px;background:#f3f6ff;border:1px solid #dce3f1;border-radius:12px;line-height:1.7}#tasks-project-help{margin:0 0 8px}#tasks-modal [hidden]{display:none!important}#tasks-modal :disabled{opacity:.6;cursor:not-allowed}';document.head.append(style);
 const $=id=>document.getElementById(id);
 const api=(ctx,op,data={})=>ctx.teacher?window.MatinAccount.api({action:'tasks',op,data:{...data,class_id:ctx.row.id}}):window.MatinStudent.taskApi(op,data);
 function syncControls(ctx){
  if(active!==ctx)return;
  root.setAttribute('aria-busy',String(ctx.busy));
  root.querySelectorAll('button,input,select,textarea').forEach(e=>e.disabled=ctx.busy);
  // Reading data must not trap the user inside the dialog.
  $('tasks-close').disabled=false;$('tasks-return').disabled=false;
  if(ctx.teacher){
   const unavailable=ctx.loadState!=='ready'||!ctx.projects.length;
   $('tasks-form').querySelectorAll('button,input,select,textarea').forEach(e=>e.disabled=ctx.busy||unavailable);
  }
  $('tasks-refresh').textContent=ctx.busy&&!ctx.writing?'加载中…':'刷新任务';
 }
 function projectNotice(ctx,old=''){
  if(!ctx.teacher)return;
  const ready=ctx.loadState==='ready',empty=ready&&!ctx.projects.length,failed=ctx.loadState==='error';
  $('tasks-project-help').textContent=empty
   ?'本班尚无可布置的已发布项目。请检查：班级已勾选并保存授课课程，且该课程内至少有一个项目已发布。旧版项目关联需先归入课程，再保存班级的授课课程。'
   :failed?'项目加载失败，请点击“刷新任务”重试。':ready?'可选择本班已关联课程下的已发布项目。':'正在读取本班已发布项目，可以先关闭窗口稍后重试。';
  $('tasks-return').hidden=!empty;
  const select=$('tasks-project');select.replaceChildren();
  for(const p of ctx.projects){const o=document.createElement('option');o.value=p.id;o.textContent=p.title;select.append(o);}
  if(!ctx.projects.length){const o=document.createElement('option');o.value='';o.textContent=empty?'暂无可布置项目':failed?'加载失败，请刷新重试':'正在加载项目…';select.append(o);}
  if(ctx.projects.some(p=>p.id===old))select.value=old;
 }
 async function run(ctx,fn,writing=false){
  if(active!==ctx||ctx.busy)return;
  ctx.busy=true;ctx.writing=writing;syncControls(ctx);
  $('tasks-status').textContent=writing?'正在保存操作，请稍候…':'正在加载…';
  try{await fn();if(active===ctx)$('tasks-status').textContent='已同步云端任务';}
  catch(e){if(active===ctx)$('tasks-status').textContent=e.message||'任务请求失败，请重试。';}
  finally{if(active===ctx){ctx.busy=false;ctx.writing=false;syncControls(ctx);}}
 }
 const button=(ctx,text,fn)=>{const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=text;b.onclick=()=>run(ctx,fn,true);return b;};
 async function load(ctx){
  const old=$('tasks-project').value;ctx.loadState='loading';
  try{
   const d=await api(ctx,ctx.teacher?'teacher_list':'list');
   if(active!==ctx)return;
   if(!Array.isArray(d.tasks)||(ctx.teacher&&!Array.isArray(d.projects)))throw Error('任务数据不完整，请刷新重试。');
   ctx.projects=ctx.teacher?d.projects:[];ctx.loadState='ready';projectNotice(ctx,old);renderTasks(ctx,d.tasks);
  }catch(e){
   if(active===ctx){ctx.projects=[];ctx.loadState='error';projectNotice(ctx);$('tasks-list').textContent='任务读取失败，请刷新重试。';}
   throw e;
  }
 }
 function renderTasks(ctx,tasks){
  const teacher=ctx.teacher;
  const list=$('tasks-list');list.replaceChildren();let count=0;
  for(const t of tasks){if(!teacher&&$('tasks-pending').checked&&t.status==='completed')continue;count++;
   const a=document.createElement('article'),h=document.createElement('h3'),p=document.createElement('p'),desc=document.createElement('p');h.textContent=t.title;
   const late=Date.parse(t.due_at)<Date.now();p.textContent=(teacher?'':t.class_name+' · ')+new Date(t.due_at).toLocaleString('zh-CN')+' 截止 · '+(teacher?(t.active?'已布置':'已撤回')+' · '+t.completed_count+' 人自报完成':t.status==='completed'?'已完成（自报）':(late?'已逾期 · ':'')+(t.status==='started'?'进行中':'待开始'));
   desc.textContent=t.instructions;a.append(h,p,desc);
   if(teacher&&t.active)a.append(button(ctx,'撤回任务',async()=>{if(!confirm('撤回后学生将不再看到此任务，确认？'))return;await api(ctx,'cancel',{task_id:t.id,revision:Number(t.revision)});await load(ctx);}));
   if(!teacher&&t.available){a.append(button(ctx,t.status==='pending'?'开始学习':'打开学习记录',async()=>{const d=await api(ctx,'open',{task_id:t.id});if(active!==ctx)return;window.MatinTaskOpen(d.project);close(true,false);}));if(t.status!=='completed')a.append(button(ctx,'标记已完成',async()=>{if(!confirm('确认已完成此任务的学习要求？这将记录为学生自报完成。'))return;await api(ctx,'complete',{task_id:t.id});await load(ctx);}));}
   else if(!teacher){const n=document.createElement('p');n.textContent='项目已下架，请联系教师。';a.append(n);}list.append(a);
  }
  if(!count)list.textContent=teacher?'尚未布置任务。':'暂无待显示的任务。可取消“只看待完成事项”或刷新任务。';
 }
 function close(force=false,restoreFocus=true){
  if(!active)return;
  if(active.busy&&active.writing&&!force){$('tasks-status').textContent='操作正在保存，请稍候再关闭。';return;}
  const opener=active.opener;active=null;root.classList.add('hidden');root.setAttribute('aria-busy','false');
  if(restoreFocus&&opener?.isConnected)opener.focus();
 }
 $('tasks-close').onclick=()=>close();$('tasks-return').onclick=()=>close();
 root.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}
  if(e.key==='Tab'){
   const items=[...root.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)')].filter(e=>e.getClientRects().length);
   if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1)?.focus();}
   else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0]?.focus();}
  }
 });
 const refresh=()=>{const ctx=active;if(ctx)run(ctx,()=>load(ctx));};
 $('tasks-refresh').onclick=refresh;$('tasks-pending').onchange=refresh;
 $('tasks-form').onsubmit=e=>{
  e.preventDefault();const ctx=active;if(!ctx?.teacher||ctx.busy)return;
  const projectId=$('tasks-project').value,title=$('tasks-name').value.trim(),due=new Date($('tasks-due').value);
  if(ctx.loadState!=='ready'||!ctx.projects.some(p=>p.id===projectId)){$('tasks-status').textContent='本班暂无可选项目，请先检查课程关联和发布状态。';return;}
  if(!title){$('tasks-status').textContent='请填写任务名称。';$('tasks-name').focus();return;}
  if(!Number.isFinite(+due)||due<=new Date()){$('tasks-status').textContent='请选择未来的截止时间';return;}
  const data={project_id:projectId,title,instructions:$('tasks-instructions').value,due_at:due.toISOString()};
  run(ctx,async()=>{await api(ctx,'create',data);if(active!==ctx)return;$('tasks-form').reset();await load(ctx);},true);
 };
 window.MatinTasks={open(row=null){
  if(active?.busy&&active.writing)return;
  const ctx={teacher:!!row,row:row?{id:row.id,name:row.name}:null,busy:false,writing:false,projects:[],loadState:'loading',opener:document.activeElement};
  active=ctx;
  $('tasks-form').hidden=!ctx.teacher;$('tasks-form').style.display=ctx.teacher?'grid':'none';
  $('tasks-project-notice').hidden=!ctx.teacher;$('tasks-filter-label').hidden=ctx.teacher;
  $('tasks-title').textContent=ctx.teacher?ctx.row.name+' · 学习任务':'我的任务';
  $('tasks-list').replaceChildren();$('tasks-form').reset();projectNotice(ctx);
  root.classList.remove('hidden');run(ctx,()=>load(ctx));$('tasks-close').focus();
 }};
})();
