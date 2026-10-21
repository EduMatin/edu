/* Class assignments. All authorization is enforced by matin_tasks RPC. */
(() => {'use strict';
 // Each opening owns its requests; a late response must not affect another class.
 let active=null;
 const root=document.createElement('div');root.id='tasks-modal';root.className='modal-layer hidden';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','班级学习任务');
 root.innerHTML=`<div class="modal" style="width:94vw;max-width:850px;max-height:90vh;overflow:auto">
 <div class="actions"><h2 id="tasks-title">我的任务</h2><button type="button" class="btn" id="tasks-close">关闭</button><button type="button" class="btn" id="tasks-refresh">刷新任务</button></div>
 <p>截止时间按当前设备时区显示。逾期仍可补做；完成状态为学生自报，不代表教师评分。</p>
 <div id="tasks-project-notice"><p id="tasks-project-help" role="status"></p><button type="button" class="btn" id="tasks-return" hidden>返回班级检查课程</button></div>
 <form id="tasks-form"><label>选择课程项目<select id="tasks-project" aria-describedby="tasks-project-help tasks-project-state" required></select></label>
 <div id="tasks-project-state" role="status" hidden></div>
 <label>任务名称<input id="tasks-name" maxlength="120" required></label>
 <label>截止时间<input id="tasks-due" type="datetime-local" required></label>
 <label>学习要求<textarea id="tasks-instructions" maxlength="2000"></textarea></label>
 <button class="btn primary" id="tasks-submit" type="submit">布置给本班</button></form>
 <label id="tasks-filter-label"><input type="checkbox" id="tasks-pending" checked>只看待完成事项</label>
 <p id="tasks-status" role="status"></p><div id="tasks-list"></div></div>`;
 document.body.append(root);const style=document.createElement('style');style.textContent='#tasks-modal{z-index:130}#tasks-modal .actions{display:flex;gap:10px;flex-wrap:wrap}#tasks-form{display:grid;gap:12px;margin:16px 0}#tasks-form label{display:grid;gap:6px}#tasks-form input,#tasks-form select,#tasks-form textarea{width:100%;min-width:0;padding:10px;border:1px solid #ccd5e7;border-radius:8px}#tasks-list article{padding:16px;border:1px solid #dce3f1;border-radius:12px;margin:12px 0;overflow-wrap:anywhere}#tasks-list p{white-space:pre-wrap}#tasks-status{color:#805221}#tasks-project-notice{margin-top:14px;padding:12px;background:#f3f6ff;border:1px solid #dce3f1;border-radius:12px;line-height:1.7}#tasks-project-help{margin:0 0 8px}#tasks-modal [hidden]{display:none!important}#tasks-modal :disabled{opacity:.6;cursor:not-allowed}';document.head.append(style);
 const $=id=>document.getElementById(id);
 // Both student entry points use this account-scoped list and the same task actions.
 let student={owner:'',tasks:[],catalog_version:0,error:'',message:'',busy:false},studentRequest=0;
 const studentOwner=()=>window.MatinStudent?.signedIn?MatinStudent.userId:'';
 const studentState=()=>student.owner===studentOwner()?student:{tasks:[],catalog_version:0,error:'',busy:false};
 const changed=()=>{
  window.dispatchEvent(new CustomEvent('matin-student-tasks-changed'));
  if(active&&!active.teacher){
   active.tasks=studentState().tasks;renderTasks(active,active.tasks);
   $('tasks-status').textContent=studentState().error||studentState().message||'已同步云端任务';
  }
 };
 async function loadStudent(){
  const owner=studentOwner();if(!owner)return {tasks:[],catalog_version:0};
  if(student.owner===owner&&student.busy)return student;
  const request=++studentRequest;
  try{
   const d=await MatinStudent.taskApi('list');
   if(request!==studentRequest||owner!==studentOwner())return studentState();
   if(!Array.isArray(d.tasks))throw Error('任务数据不完整，请刷新重试。');
   student={owner,tasks:d.tasks,catalog_version:d.catalog_version||0,error:'',message:'已同步云端任务',busy:false};
  }catch(e){
   if(request!==studentRequest||owner!==studentOwner())return studentState();
   student={owner,tasks:[],catalog_version:0,error:'任务读取失败：'+(e.message||'请刷新重试'),busy:false};
  }
  changed();return studentState();
 }
 async function studentAction(task,operation){
  const owner=studentOwner(),state=studentState();
  if(!owner||state.busy||!state.tasks.some(t=>t.id===task.id&&t.available))return;
  if(operation==='complete'&&!confirm('确认已完成此任务的学习要求？这将记录为学生自报完成。'))return;
  const request=++studentRequest,ctx=active&&!active.teacher?active:null;
  student.busy=true;student.error='';student.message='正在保存操作，请稍候…';
  if(ctx){ctx.busy=true;ctx.writing=true;syncControls(ctx);}changed();
  try{
   const d=await MatinStudent.taskApi(operation,{task_id:task.id});
   if(request!==studentRequest||owner!==studentOwner())return;
   student.tasks=student.tasks.map(t=>t.id===task.id?{...t,status:operation==='complete'?'completed':t.status==='completed'?'completed':'started'}:t);
   student.message=operation==='complete'?'已标记完成，课程页与任务列表已同步。':'已打开任务，学习对话保存在当前浏览器。';
   if(operation==='open'){
    const opened=window.MatinTaskOpen(d.project,task);
    if(opened!==false&&active===ctx)close(true,false);
   }
  }catch(e){
   if(request===studentRequest&&owner===studentOwner()){
    student.error='操作未完成：'+(e.message||'请刷新后重试');
    // An authorization failure must not leave an old card usable.
    student.tasks=[];student.catalog_version=0;
   }
  }finally{
   if(request===studentRequest&&owner===studentOwner()){
    student.busy=false;
    if(active===ctx&&ctx){ctx.busy=false;ctx.writing=false;syncControls(ctx);}changed();
   }
  }
 }
 function renderStudent(container,tasks,{pendingOnly=false}={}){
  container.replaceChildren();
  for(const t of tasks){
   if(pendingOnly&&t.status==='completed')continue;
   const card=document.createElement('article');card.className='student-task-card';card.dataset.taskId=t.id;
   const tag=document.createElement('span');tag.className='student-task-tag';tag.textContent='班级任务';
   const h=document.createElement('h3');h.textContent=t.title;
   const source=document.createElement('p');source.className='student-task-source';
   source.textContent=[t.course_name,t.project_title?'项目：'+t.project_title:'',t.class_name].filter(Boolean).join(' · ');
   const status=document.createElement('p');status.className='student-task-meta';
   const late=Date.parse(t.due_at)<Date.now();
   status.textContent=new Date(t.due_at).toLocaleString('zh-CN')+' 截止 · '+(t.status==='completed'?'已完成（自报）':(late?'已逾期 · ':'')+(t.status==='started'?'进行中':'待开始'));
   const desc=document.createElement('p');desc.textContent=t.instructions;
   const note=document.createElement('p');note.className='student-task-source';
   note.textContent=t.delivery_mode==='class_snapshot'?'班级学习版本 · 内容以布置时保存的版本为准':'教师公开分享版本';
   card.append(tag,h,source,status,desc,note);
   const actions=document.createElement('div');actions.className='student-task-actions';
   if(t.available){
    for(const [label,op] of [[t.status==='pending'?'开始学习':t.status==='completed'?'查看学习记录':'继续学习','open'],...(t.status==='completed'?[]:[['标记已完成','complete']])]){
     const b=document.createElement('button');b.type='button';b.className='btn'+(op==='open'?' primary':'');b.textContent=label;b.dataset.taskAction=op;
     b.disabled=studentState().busy;b.onclick=()=>studentAction(t,op);actions.append(b);
    }
   }else{const unavailable=document.createElement('p');unavailable.textContent='任务项目暂不可用，请联系教师。';actions.append(unavailable);}
   card.append(actions);container.append(card);
  }
  if(!container.childElementCount){const p=document.createElement('p');p.className='help';p.textContent=pendingOnly?'暂无待完成任务，可取消“只看待完成事项”查看已完成任务。':'暂无符合条件的班级任务。';container.append(p);}
 }
 style.textContent+='.student-task-card{padding:22px;border:1px solid #dce3f1;border-radius:16px;background:#fff;overflow-wrap:anywhere}.student-task-card h3{margin:12px 0 8px;font-size:20px;color:#26365c}.student-task-card p{white-space:pre-wrap;line-height:1.7;margin:10px 0}.student-task-tag{display:inline-block;color:#494bc5;background:#efedff;padding:5px 10px;border-radius:8px;font-size:12px;font-weight:700}.student-task-source{font-size:13px;color:#71819b}.student-task-meta{font-weight:600;font-size:14px;color:#344c76}.student-task-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}.student-task-actions :disabled{opacity:.6;cursor:wait}';
 style.textContent+='#tasks-project-state{padding:12px;background:#f3f6ff;border:1px solid #dce3f1;border-radius:12px;line-height:1.7;overflow-wrap:anywhere}#tasks-project-state strong{font-size:14px;color:#293c67}#tasks-project-state p{margin:6px 0 0;font-size:13px}';
 const api=(ctx,op,data={})=>ctx.teacher?window.MatinAccount.api({action:'tasks',op,data:{...data,class_id:ctx.row.id}}):window.MatinStudent.taskApi(op,data);
 const assignedTasks=(ctx,id)=>ctx.tasks.filter(t=>t.class_id===ctx.row.id&&t.project_id===id&&t.active===true);
 const shareLabel=p=>p.is_published?'已开启公开分享':'未开启公开分享';
 function selectedProjectState(ctx){
  if(active!==ctx||!ctx.teacher)return;
  const state=$('tasks-project-state'),p=ctx.projects.find(p=>p.id===$('tasks-project').value);
  state.replaceChildren();state.hidden=ctx.loadState!=='ready'||!p;
  $('tasks-submit').textContent='布置给本班';
  if(state.hidden)return;
  const tasks=assignedTasks(ctx,p.id),hasTasks=tasks.length>0;
  const summary=document.createElement('strong'),note=document.createElement('p');
  summary.textContent=(hasTasks?'已布置给本班（'+tasks.length+' 条有效任务）':'尚未布置给本班')+' · '+shareLabel(p);
  note.textContent=hasTasks?'本班任务见下方列表。再次布置会新增一条任务，已有任务保留原内容。':'填写任务信息后布置给本班，审核通过的学生从“我的任务”进入学习。';
  if(!p.is_published&&tasks.some(t=>t.delivery_mode==='published'))note.textContent+=' 其中有旧版任务依赖公开分享，当前学生无法打开；可撤回旧任务后重新布置班级学习版本。';
  state.append(summary,note);$('tasks-submit').textContent=hasTasks?'新增一条本班任务':'布置给本班';
 }
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
   ?'本班尚无可布置的项目。请检查：班级已勾选并保存授课课程，项目已归入该课程并保存到云端。无需提前发布给学生。'
   :failed?'项目加载失败，请点击“刷新任务”重试。':ready?'班级任务与公开分享分别管理，无需提前公开发布。布置给本班后，审核通过的学生从“我的任务”开始学习；任务内容以布置时保存的版本为准。':'正在读取本班课程项目，可以先关闭窗口稍后重试。';
  $('tasks-return').hidden=!empty;
  const select=$('tasks-project');select.replaceChildren();
  for(const p of ctx.projects){const o=document.createElement('option');o.value=p.id;o.textContent=p.title+'（'+(assignedTasks(ctx,p.id).length?'已布置给本班':'尚未布置给本班')+' · '+shareLabel(p)+'）';select.append(o);}
  if(!ctx.projects.length){const o=document.createElement('option');o.value='';o.textContent=empty?'暂无可布置项目':failed?'加载失败，请刷新重试':'正在加载项目…';select.append(o);}
  if(ctx.projects.some(p=>p.id===old))select.value=old;
  selectedProjectState(ctx);
 }
 async function run(ctx,fn,writing=false){
  if(active!==ctx||ctx.busy)return;
  ctx.busy=true;ctx.writing=writing;syncControls(ctx);
  $('tasks-status').textContent=writing?'正在保存操作，请稍候…':'正在加载…';
  try{const message=await fn();if(active===ctx)$('tasks-status').textContent=typeof message==='string'?message:'已同步云端任务';}
  catch(e){if(active===ctx)$('tasks-status').textContent=e.message||'任务请求失败，请重试。';}
  finally{if(active===ctx){ctx.busy=false;ctx.writing=false;syncControls(ctx);}}
 }
 const button=(ctx,text,fn)=>{const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=text;b.onclick=()=>run(ctx,fn,true);return b;};
 async function load(ctx){
  const old=$('tasks-project').value;ctx.loadState='loading';
  try{
   const d=ctx.teacher?await api(ctx,'teacher_list'):await loadStudent();
   if(active!==ctx)return;
   if(!Array.isArray(d.tasks)||(ctx.teacher&&!Array.isArray(d.projects)))throw Error('任务数据不完整，请刷新重试。');
   if(d.error)throw Error(d.error);
   if(ctx.teacher&&d.assignment_mode!=='class_snapshot')throw Error('任务服务尚未更新，请联系管理员完成升级后刷新。');
   ctx.projects=ctx.teacher?d.projects:[];ctx.tasks=d.tasks;ctx.loadState='ready';projectNotice(ctx,old);renderTasks(ctx,d.tasks);
  }catch(e){
   if(active===ctx){ctx.projects=[];ctx.tasks=[];ctx.loadState='error';projectNotice(ctx);$('tasks-list').textContent='任务读取失败，请刷新重试。';}
   throw e;
  }
 }
 function renderTasks(ctx,tasks){
  const teacher=ctx.teacher;
  if(!teacher){renderStudent($('tasks-list'),tasks,{pendingOnly:$('tasks-pending').checked});return;}
  const list=$('tasks-list');list.replaceChildren();let count=0;
  for(const t of tasks){if(!teacher&&$('tasks-pending').checked&&t.status==='completed')continue;count++;
   const a=document.createElement('article'),h=document.createElement('h3'),p=document.createElement('p'),desc=document.createElement('p');h.textContent=t.title;
   const late=Date.parse(t.due_at)<Date.now();p.textContent=(teacher?'':t.class_name+' · ')+new Date(t.due_at).toLocaleString('zh-CN')+' 截止 · '+(teacher?(t.active?'已布置给本班':'已撤回')+' · '+t.completed_count+' 人自报完成':t.status==='completed'?'已完成（自报）':(late?'已逾期 · ':'')+(t.status==='started'?'进行中':'待开始'));
   desc.textContent=t.instructions;a.append(h,p,desc);
   if(t.delivery_mode==='class_snapshot'){const version=document.createElement('p');version.textContent='班级学习版本 · 内容以布置时保存的版本为准'+(teacher?'。如需停止本次任务，请撤回任务。':'');a.append(version);}
   if(teacher&&t.active)a.append(button(ctx,'撤回任务',async()=>{if(!confirm('撤回后学生将不再看到此任务，确认？'))return;await api(ctx,'cancel',{task_id:t.id,revision:Number(t.revision)});await load(ctx);}));
   list.append(a);
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
 $('tasks-project').onchange=()=>{if(active)selectedProjectState(active);};
 $('tasks-form').onsubmit=e=>{
  e.preventDefault();const ctx=active;if(!ctx?.teacher||ctx.busy)return;
  const projectId=$('tasks-project').value,title=$('tasks-name').value.trim(),due=new Date($('tasks-due').value);
  const selected=ctx.projects.find(p=>p.id===projectId);
  if(ctx.loadState!=='ready'||!selected){$('tasks-status').textContent='本班暂无可选项目，请先检查课程关联和云端保存状态。';return;}
  if(!Number.isSafeInteger(Number(selected.revision))||Number(selected.revision)<1){$('tasks-status').textContent='项目版本未能读取，请刷新任务后重试。';return;}
  if(!title){$('tasks-status').textContent='请填写任务名称。';$('tasks-name').focus();return;}
  if(!Number.isFinite(+due)||due<=new Date()){$('tasks-status').textContent='请选择未来的截止时间';return;}
  const data={project_id:projectId,project_revision:Number(selected.revision),title,instructions:$('tasks-instructions').value,due_at:due.toISOString()};
  run(ctx,async()=>{
   await api(ctx,'create',data);if(active!==ctx)return;
   $('tasks-form').reset();$('tasks-project').value=projectId;
   const success='已成功布置给'+ctx.row.name+'，审核通过的学生可在“我的任务”中查看。';
   try{await load(ctx);}catch{return success+' 列表刷新失败，请点击“刷新任务”确认。';}
   return success;
  },true);
 };
 window.MatinTasks={loadStudent,studentState,renderStudent,open(row=null){
  if(studentState().busy)return;
  if(active?.busy&&active.writing)return;
  const ctx={teacher:!!row,row:row?{id:row.id,name:row.name}:null,busy:false,writing:false,projects:[],tasks:[],loadState:'loading',opener:document.activeElement};
  active=ctx;
  $('tasks-form').hidden=!ctx.teacher;$('tasks-form').style.display=ctx.teacher?'grid':'none';
  $('tasks-project-notice').hidden=!ctx.teacher;$('tasks-filter-label').hidden=ctx.teacher;
  $('tasks-title').textContent=ctx.teacher?ctx.row.name+' · 学习任务':'我的任务';
  $('tasks-list').replaceChildren();$('tasks-form').reset();projectNotice(ctx);
  root.classList.remove('hidden');run(ctx,()=>load(ctx));$('tasks-close').focus();
 }};
})();
