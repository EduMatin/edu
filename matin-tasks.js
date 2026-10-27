/* Class assignments. All authorization is enforced by matin_tasks RPC. */
(() => {'use strict';
 // Each opening owns its requests; a late response must not affect another class.
 let active=null;
 const root=document.createElement('div');root.id='tasks-modal';root.className='modal-layer hidden';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','tasks-title');
 root.innerHTML=`<div class="modal tasks-panel">
 <header class="tasks-header"><div><p id="tasks-breadcrumb">学习中心</p><h2 id="tasks-title">我的任务</h2></div><div class="actions"><button type="button" class="btn" id="tasks-refresh">刷新任务</button><button type="button" class="btn primary" id="tasks-new">新建任务</button><button type="button" class="btn" id="tasks-close">关闭</button></div></header>
 <div id="tasks-body">
 <section id="tasks-manager"><div id="tasks-summary" aria-live="polite"></div><div class="tasks-filters">
 <label>课程<select id="tasks-course"><option value="">全部课程</option></select></label>
 <label class="tasks-search-label">搜索任务<input id="tasks-search" type="search" placeholder="任务名称、项目名称…"></label>
 <label>任务状态<select id="tasks-state"><option value="active">有效任务</option><option value="upcoming">未截止</option><option value="overdue">已截止</option><option value="withdrawn">已撤回</option><option value="all">全部状态</option></select></label>
 <label>排序<select id="tasks-sort"><option value="newest">最近布置</option><option value="due">截止时间从早到晚</option><option value="name">任务名称</option></select></label></div>
 <p id="tasks-outline-warning" hidden></p><p class="tasks-hint">点击“完成明细”查看学生进度、报告、批注及导出名单。时间按当前设备时区显示；截止后仍可补交。</p></section>
 <section id="tasks-create" hidden><button type="button" class="btn" id="tasks-back">← 返回任务列表</button>
 <div id="tasks-project-notice"><p id="tasks-project-help" role="status"></p><button type="button" class="btn" id="tasks-return" hidden>返回班级检查课程</button></div>
 <form id="tasks-form"><label>选择课程项目<select id="tasks-project" aria-describedby="tasks-project-help tasks-project-state" required></select></label>
 <div id="tasks-project-state" role="status" hidden></div>
 <label>任务名称<input id="tasks-name" maxlength="120" required></label>
 <label>截止时间<input id="tasks-due" type="datetime-local" required></label>
 <label>学习要求<textarea id="tasks-instructions" maxlength="2000"></textarea></label>
 <div class="actions"><button class="btn primary" id="tasks-submit" type="submit">布置给本班</button><button type="button" class="btn" id="tasks-cancel-create">取消新建</button></div></form></section>
 <label id="tasks-filter-label"><input type="checkbox" id="tasks-pending" checked>只看待完成事项</label>
 <p id="tasks-student-hint" class="tasks-hint">截止时间按当前设备时区显示，逾期仍可补交。提交报告后教师可查看并批注，不代表教师评分。</p>
 <div id="tasks-list"></div></div><footer class="tasks-footer"><p id="tasks-status" role="status" aria-live="polite"></p><nav id="tasks-pages" aria-label="任务分页"><span id="tasks-page-info"></span><button type="button" class="btn" id="tasks-prev">上一页</button><button type="button" class="btn" id="tasks-next">下一页</button></nav></footer></div>`;
 document.body.append(root);const style=document.createElement('style');style.textContent='#tasks-modal{z-index:130}#tasks-modal .actions{display:flex;gap:10px;flex-wrap:wrap}#tasks-form{display:grid;gap:12px;margin:16px 0}#tasks-form label{display:grid;gap:6px}#tasks-form input,#tasks-form select,#tasks-form textarea{width:100%;min-width:0;padding:10px;border:1px solid #ccd5e7;border-radius:8px}#tasks-list article{padding:16px;border:1px solid #dce3f1;border-radius:12px;margin:12px 0;overflow-wrap:anywhere}#tasks-list p{white-space:pre-wrap}#tasks-status{color:#805221}#tasks-project-notice{margin-top:14px;padding:12px;background:#f3f6ff;border:1px solid #dce3f1;border-radius:12px;line-height:1.7}#tasks-project-help{margin:0 0 8px}#tasks-modal [hidden]{display:none!important}#tasks-modal :disabled{opacity:.6;cursor:not-allowed}';document.head.append(style);
 style.textContent+=`
 #tasks-modal .tasks-panel{width:min(1180px,96vw);max-width:1180px;max-height:92vh;max-height:92dvh;padding:0;display:flex;flex-direction:column;overflow:hidden}
 #tasks-modal:not(.teacher-tasks) .tasks-panel{max-width:850px}
 #tasks-modal .tasks-header{padding:24px 28px 18px;border-bottom:1px solid #e7ebf4;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-shrink:0}
 #tasks-modal h2{margin:0;font-size:23px;overflow-wrap:anywhere}#tasks-breadcrumb{font-size:12px;color:#70809b;margin:0 0 6px}
 #tasks-body{overflow:auto;overscroll-behavior:contain;padding:22px 28px;min-height:120px}
 #tasks-summary{display:flex;gap:24px;flex-wrap:wrap;margin-bottom:18px;color:#64748b;font-size:14px}#tasks-summary strong{color:#27395c;font-size:23px;margin-right:6px}
 .tasks-filters{display:flex;gap:12px;flex-wrap:wrap;align-items:end}.tasks-filters label{display:grid;gap:7px;font-size:13px;font-weight:600;min-width:130px;flex:1}.tasks-filters .tasks-search-label{flex:2}
 .tasks-filters input,.tasks-filters select{width:100%;min-width:0;border:1px solid #dce3f1;border-radius:10px;padding:11px;background:#fff;color:#26365c;font:inherit}
 #tasks-modal .tasks-hint{color:#71819b;font-size:13px;line-height:1.7;margin:14px 0}#tasks-outline-warning{color:#805221;font-size:13px}
 .tasks-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:14px}.tasks-table th{text-align:left;color:#71819b;background:#f6f8fc;font-size:12px;padding:12px 10px;font-weight:600}.tasks-table td{padding:15px 10px;border-bottom:1px solid #e8edf5;vertical-align:top;overflow-wrap:anywhere}
 .tasks-table th:nth-child(1){width:39%}.tasks-table th:nth-child(2){width:18%}.tasks-table th:nth-child(3){width:12%}.tasks-table th:nth-child(4){width:13%}.tasks-table th:nth-child(5){width:18%}
 #tasks-list .tasks-table h3{font-size:15px;margin:0 0 6px;line-height:1.5;color:#26365c}#tasks-list .tasks-table p{font-size:12px;line-height:1.6;margin:5px 0;color:#71819b}.tasks-table .tasks-detail-button{font-size:13px;padding:9px 12px;color:#4f46ce;white-space:nowrap}
 .tasks-badge{display:inline-block;border-radius:7px;padding:4px 8px;background:#eef3ff;color:#45618e;font-size:12px;white-space:nowrap}.tasks-badge.overdue{background:#fff3df;color:#95610f}.tasks-badge.withdrawn{background:#f0f1f4;color:#6c778b}
 #tasks-modal .tasks-extra{font-size:12px;line-height:1.7;margin-top:6px;padding:0;border:0;background:transparent;border-radius:0}.tasks-extra summary{color:#596b8a;cursor:pointer;font-weight:400}.tasks-extra .btn{margin-top:8px;font-size:12px;padding:6px 10px;color:#9b4343}#tasks-list .tasks-extra p{color:#53627b;white-space:pre-wrap}
 .tasks-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:16px 28px;border-top:1px solid #e7ebf4;background:#fff;flex-shrink:0}#tasks-status{font-size:13px;margin:0;overflow-wrap:anywhere}#tasks-pages{display:flex;align-items:center;gap:10px;flex-shrink:0;font-size:13px;color:#64748b}#tasks-pages .btn{padding:8px 12px}
 #tasks-create{max-width:760px;margin:auto}#tasks-form input,#tasks-form select,#tasks-form textarea{font:inherit}#tasks-instructions{min-height:100px}#tasks-form .actions{justify-content:flex-end;padding-top:12px}
 #tasks-modal :focus-visible{outline:3px solid #aebffe;outline-offset:2px}.tasks-empty{text-align:center;padding:36px 12px;color:#71819b}.tasks-table td:last-child .btn{margin:0 4px 6px 0}
 @media(max-width:700px){#tasks-modal .tasks-header{padding:16px;flex-wrap:wrap}#tasks-modal h2{font-size:19px}#tasks-modal .tasks-header .actions{gap:6px}#tasks-modal .tasks-header .btn{padding:9px 12px;font-size:13px}#tasks-body{padding:16px}#tasks-summary{gap:14px;font-size:12px}#tasks-summary strong{font-size:20px}.tasks-filters label{min-width:calc(50% - 12px)}.tasks-filters .tasks-search-label{flex:1}.tasks-table thead{display:none}.tasks-table,.tasks-table tbody{display:block}.tasks-table tr{display:grid;grid-template-columns:1fr 1fr;border:1px solid #e1e7f2;border-radius:12px;padding:12px;margin-bottom:12px;gap:10px}.tasks-table td{display:block;padding:0;border:0}.tasks-table td:first-child,.tasks-table td:last-child{grid-column:1/-1}.tasks-table td[data-label]::before{content:attr(data-label);display:block;font-size:11px;color:#71819b;margin-bottom:4px}.tasks-footer{padding:12px 16px;flex-wrap:wrap}#tasks-pages{width:100%;justify-content:flex-end;font-size:12px}#tasks-page-info{margin-right:auto}}
 `;
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
 let studentLoad=null;
 function loadStudent(options={}){
  const owner=studentOwner();
  if(studentLoad?.owner===owner&&studentLoad.request===studentRequest)return studentLoad.promise;
  const promise=readStudent(options),entry={owner,request:studentRequest,promise};studentLoad=entry;
  const finish=()=>{if(studentLoad===entry)studentLoad=null;};promise.then(finish,finish);return promise;
 }
 async function readStudent({background=false}={}){
  const owner=studentOwner();if(!owner)return {tasks:[],catalog_version:0};
  if(student.owner===owner&&student.busy)return student;
  const request=++studentRequest;
  student={...studentState(),owner,loading:true};if(!background)changed();
  try{
   const d=await MatinStudent.taskApi('list');
   if(request!==studentRequest||owner!==studentOwner())return studentState();
   if(!Array.isArray(d.tasks))throw Error('任务数据不完整，请刷新重试。');
   student={owner,tasks:d.tasks,catalog_version:d.catalog_version||0,reports_version:d.reports_version||0,workflow_version:d.workflow_version||0,error:'',message:'已同步云端任务',busy:false,loadedAt:Date.now()};
  }catch(e){
   if(request!==studentRequest||owner!==studentOwner())return studentState();
   const message='任务读取失败：'+(e.message||'请刷新重试');
   // Temporary background failures must not erase the last known review or interrupt learning.
   // Authorization failures still clear the list; every open/submit is checked by the server.
   student=background&&student.loadedAt&&e.status!==401&&e.status!==403
    ?{...student,loading:false,refreshError:message}
    :{owner,tasks:[],catalog_version:0,error:message,busy:false};
  }
  changed();return studentState();
 }
 async function studentAction(task,operation){
  const owner=studentOwner(),state=studentState(),navigationRevision=window.MatinStudent?.navigationRevision;
  if(!owner||state.busy||!state.tasks.some(t=>t.id===task.id&&t.available))return;
  if(task.class_ended_at){if(operation==='open')window.MatinTaskReports.learningArchive(task);return;}
  if(operation==='complete'&&!confirm('确认已完成此任务的学习要求？这将记录为学生自报完成。'))return;
  const request=++studentRequest,ctx=active&&!active.teacher?active:null;
  student.busy=true;student.error='';student.message='正在保存操作，请稍候…';
  if(ctx){ctx.busy=true;ctx.writing=true;syncControls(ctx);}changed();
  try{
   const d=await MatinStudent.taskApi(operation,{task_id:task.id});
   if(request!==studentRequest||owner!==studentOwner())return;
   task={...task,...d.latest_review};
   student.tasks=student.tasks.map(t=>t.id===task.id?{...t,...d.latest_review,updated_at:new Date().toISOString(),status:operation==='complete'?'completed':task.status==='revision_required'?'revision_required':['completed','submitted'].includes(task.status)?task.status:'started'}:t);
   student.message=operation==='complete'?'已标记完成，课程页与任务列表已同步。':'已打开任务，学习对话保存在当前浏览器。';
   if(operation==='open'&&navigationRevision===window.MatinStudent?.navigationRevision){
    const opened=await window.MatinTaskOpen(d.project,task);
    if(opened!==false){if(active===ctx)close(true,false);window.dispatchEvent(new CustomEvent('matin-student-task-opened',{detail:{task_id:task.id}}));}
   }
  }catch(e){
   if(e.status===423){student.busy=false;await loadStudent();const frozen=studentState().tasks.find(t=>t.id===task.id);if(frozen?.class_ended_at&&operation==='open'&&navigationRevision===window.MatinStudent?.navigationRevision)window.MatinTaskReports.learningArchive(frozen);return;}
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
 function studentChangeNotice(t){
  const change=t.latest_change;if(!t.available||!change||!Number.isSafeInteger(Number(change.revision))||Number(change.revision)<1)return null;
  const before=Date.parse(change.previous_due_at),due=Date.parse(t.due_at),dateChanged=Number.isFinite(before)&&Number.isFinite(due)&&before!==due;
  const earlier=dateChanged&&due<before,notice=document.createElement('div');notice.className='student-task-change'+(earlier?' deadline-earlier':'');
  const dateText=new Date(due).toLocaleString('zh-CN',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
  const parts=[];if(dateChanged)parts.push((earlier?'注意：截止时间已提前至 ':'截止时间已延长至 ')+dateText);
  if(change.instructions_changed)parts.push('学习要求已更新');
  const message=document.createElement('span');message.textContent=parts.join('；')||'任务安排已更新';notice.append(message);
  if(Number.isFinite(Date.parse(change.changed_at)))notice.title='最近修改：'+new Date(change.changed_at).toLocaleString('zh-CN');
  if(window.MatinTaskEdit){const details=document.createElement('button');details.type='button';details.className='student-task-change-link';details.textContent='查看变更';details.setAttribute('aria-label','查看变更：'+t.title);details.onclick=()=>MatinTaskEdit.history(t);notice.append(details);}
  return notice;
 }
 function renderStudent(container,tasks,{pendingOnly=false,compact=false}={}){
  container.replaceChildren();
  for(const t of tasks){
   const reports=studentState().reports_version===1;
   if(pendingOnly&&(t.class_ended_at||t.status==='submitted'||!reports&&t.status==='completed'))continue;
   const card=document.createElement('article');card.className='student-task-card'+(compact?' student-task-compact':'');card.dataset.taskId=t.id;
   const tag=document.createElement('span');tag.className='student-task-tag';tag.textContent=t.class_ended_at?'已结束教学 · 只读档案':'班级任务';
   const h=document.createElement('h3');h.textContent=t.title;
   const source=document.createElement('p');source.className='student-task-source';
   source.textContent=[t.course_name,t.project_title?'项目：'+t.project_title:'',t.class_name].filter(Boolean).join(' · ');
   const status=document.createElement('p');status.className='student-task-meta';
   const late=Date.parse(t.effective_due_at||t.due_at)<Date.now();
   status.textContent=new Date(t.effective_due_at||t.due_at).toLocaleString('zh-CN')+(t.review_status==='revision_required'?' 重交截止 · ':' 截止 · ')+(t.review_status==='revision_required'?'需修改重交'+(late?' · 已逾期':''):t.review_status==='passed'?'已通过':t.status==='submitted'?(t.review_status?'待教师批阅':'已提交')+(t.late_submission?' · 逾期补交':''):t.status==='completed'?(reports?(late?'逾期未交 · ':'')+'旧版自报完成 · 尚未提交报告':'已完成（自报）'):(late?'已逾期 · ':'')+(t.status==='started'?'进行中':'待开始'));
   if(t.class_ended_at)status.textContent='结课于 '+new Date(t.class_ended_at).toLocaleString('zh-CN')+' · 保留结课时的学习记录与批阅结果';
   const desc=document.createElement('p');desc.textContent=t.instructions;
   const note=document.createElement('p');note.className='student-task-source';
   note.textContent=t.delivery_mode==='class_snapshot'?'班级学习版本 · 内容以布置时保存的版本为准':'教师公开分享版本';
   card.append(tag,h,source,status);if(!t.class_ended_at&&t.review_status==='revision_required')card.append(Object.assign(document.createElement('p'),{className:'student-task-change deadline-earlier',textContent:'修改要求：'+t.revision_reason}));const change=studentChangeNotice(t);if(change)card.append(change);if(compact){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='学习要求与任务说明';details.append(summary,desc,note);card.append(details);}else card.append(desc,note);
   const actions=document.createElement('div');actions.className='student-task-actions';
   if(t.available){
    for(const [label,op] of [[t.class_ended_at?'查看学习档案':t.review_status==='revision_required'?'修改并重交':t.review_status==='passed'?'查看学习记录':t.status==='pending'?'开始学习':t.status==='completed'?'查看学习记录':'继续学习','open'],...(t.class_ended_at||reports||t.status==='completed'?[]:[['标记已完成','complete']])]){
     const b=document.createElement('button');b.type='button';b.className='btn'+(op==='open'?' primary':'');b.textContent=label;b.dataset.taskAction=op;
     b.disabled=studentState().busy;b.onclick=()=>studentAction(t,op);actions.append(b);
    }
   }else{const unavailable=document.createElement('p');unavailable.textContent='任务项目暂不可用，请联系教师。';actions.append(unavailable);}
   if(t.submission_version){const report=document.createElement('button');report.type='button';report.className='btn';report.textContent='查看已提交报告'+(t.reviewed_at?' · 有教师批注':'');report.disabled=studentState().busy;report.onclick=()=>window.MatinTaskReports.student(t);actions.append(report);}
   if(!t.class_ended_at&&!compact&&reports&&t.status!=='submitted'){const hint=document.createElement('p');hint.className='student-task-source';hint.textContent='进入学习后点击“提交学习报告”，教师即可查看你的报告。';card.append(hint);}
   card.append(actions);container.append(card);
  }
  if(!container.childElementCount){const p=document.createElement('p');p.className='help';p.textContent=pendingOnly?'暂无待完成任务，可取消“只看待完成事项”查看已完成任务。':'暂无符合条件的班级任务。';container.append(p);}
 }
 style.textContent+='.student-task-card{padding:22px;border:1px solid #dce3f1;border-radius:16px;background:#fff;overflow-wrap:anywhere}.student-task-card h3{margin:12px 0 8px;font-size:20px;color:#26365c}.student-task-card p{white-space:pre-wrap;line-height:1.7;margin:10px 0}.student-task-tag{display:inline-block;color:#494bc5;background:#efedff;padding:5px 10px;border-radius:8px;font-size:12px;font-weight:700}.student-task-source{font-size:13px;color:#71819b}.student-task-meta{font-weight:600;font-size:14px;color:#344c76}.student-task-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}.student-task-actions :disabled{opacity:.6;cursor:wait}';
 style.textContent+='.student-task-change{display:flex;align-items:center;flex-wrap:wrap;gap:4px 10px;margin:12px 0;padding:8px 12px;border-left:3px solid #adb9ee;border-radius:6px;background:#f3f5ff;color:#4c5d86;font-size:13px;line-height:1.7}.student-task-change.deadline-earlier{border-left-color:#ce7b17;background:#fff4df;color:#864b10}.student-task-change.deadline-earlier>span{font-weight:600}.student-task-change-link{appearance:none;border:0;background:transparent;color:inherit;font:inherit;text-decoration:underline;text-underline-offset:3px;cursor:pointer;padding:4px 0;min-height:32px;flex-shrink:0}.student-task-change-link:focus-visible{outline:3px solid #aebffe;outline-offset:3px;border-radius:3px}';
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
  summary.textContent=courseFor(ctx,p.id).name+' · '+(hasTasks?'已布置给本班（'+tasks.length+' 条有效任务）':'尚未布置给本班')+' · '+shareLabel(p);
  note.textContent=hasTasks?'再次布置会新增一条任务，已有任务保留原内容。可返回任务列表查看已有任务。':'填写任务信息后布置给本班，审核通过的学生从“我的任务”进入学习。';
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
   const unavailable=!!ctx.row?.class_ended_at||ctx.loadState!=='ready'||!ctx.projects.length;
   $('tasks-new').hidden=!!ctx.row?.class_ended_at||ctx.view==='create';
   $('tasks-form').querySelectorAll('button,input,select,textarea').forEach(e=>e.disabled=ctx.busy||unavailable);
   $('tasks-back').disabled=$('tasks-cancel-create').disabled=ctx.busy&&ctx.writing;
   $('tasks-prev').disabled=ctx.busy||ctx.page<=1;
   $('tasks-next').disabled=ctx.busy||ctx.page>=ctx.pages;
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
  const groups=new Map();
  for(const p of ctx.projects){const course=courseFor(ctx,p.id);let group=groups.get(course.id);if(!group){group=document.createElement('optgroup');group.label=course.name;groups.set(course.id,group);select.append(group);}const o=document.createElement('option');o.value=p.id;o.textContent=p.title+'（'+(assignedTasks(ctx,p.id).length?'已布置给本班':'尚未布置给本班')+' · '+shareLabel(p)+'）';group.append(o);}
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
  finally{if(active===ctx){ctx.busy=false;ctx.writing=false;syncControls(ctx);if(!root.contains(document.activeElement)||!document.activeElement.getClientRects().length)$('tasks-close').focus();}}
 }
 const button=(ctx,text,fn)=>{const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=text;b.onclick=()=>run(ctx,fn,true);return b;};
 async function load(ctx){
  const old=$('tasks-project').value;ctx.loadState='loading';
  try{
   let d;
   if(ctx.teacher){
    // Course names are optional organization metadata; their failure must not hide tasks.
    const [tasks,outline]=await Promise.allSettled([api(ctx,'teacher_list'),window.MatinAccount.api({action:'outline_get'})]);
    if(active!==ctx)return;
    if(tasks.status==='rejected')throw tasks.reason;
    d=tasks.value;
    const layout=d.class_outline||(outline.status==='fulfilled'?outline.value?.layout:null);
    ctx.layout=layout&&Array.isArray(layout.groups)&&Array.isArray(layout.members)?layout:null;
   }else d=await loadStudent();
   if(active!==ctx)return;
   if(!Array.isArray(d.tasks)||(ctx.teacher&&!Array.isArray(d.projects)))throw Error('任务数据不完整，请刷新重试。');
   if(d.error)throw Error(d.error);
   if(ctx.teacher&&d.assignment_mode!=='class_snapshot')throw Error('任务服务尚未更新，请联系管理员完成升级后刷新。');
   if(ctx.teacher){ctx.row.class_ended_at=d.class_ended_at;ctx.row.class_end_reason=d.class_end_reason;$('tasks-title').textContent=d.class_ended_at?'任务与报告档案 · 只读':'任务管理';root.querySelector('.tasks-hint').textContent=d.class_ended_at?'已结束教学。可查看任务、完成明细、历次报告与批阅记录，并导出名单；如需补交或补批，请在班级管理中重新开放教学。':'点击“完成明细”查看学生进度、报告、批注及导出名单。截止后仍可补交。';}
   ctx.projects=ctx.teacher?d.projects:[];ctx.tasks=d.tasks;ctx.reports=d.reports_version===1;ctx.loadState='ready';if(ctx.teacher){courseFilters(ctx);window.dispatchEvent(new CustomEvent('matin-teacher-tasks-changed',{detail:{classId:ctx.row.id,data:d}}));}projectNotice(ctx,old);renderTasks(ctx,d.tasks);
  }catch(e){
   if(active===ctx){ctx.projects=[];ctx.tasks=[];ctx.loadState='error';ctx.pages=1;projectNotice(ctx);$('tasks-list').textContent='任务读取失败，请刷新重试。';$('tasks-summary').replaceChildren();$('tasks-pages').hidden=true;if(ctx.teacher)window.dispatchEvent(new CustomEvent('matin-teacher-tasks-changed',{detail:{classId:ctx.row.id,error:e.message||'请刷新重试'}}));}
   throw e;
  }
 }
 const el=(tag,text,cls='')=>{const e=document.createElement(tag);e.textContent=text;e.className=cls;return e;};
 const courseFor=(ctx,id)=>{
  const member=ctx.layout?.members.find(m=>m.project_id===id),group=ctx.layout?.groups.find(g=>g.id===member?.group_id);
  return group||{id:'ungrouped',name:ctx.layout?'未归类 / 原课程已移除':'课程待确认'};
 };
 const taskProject=(ctx,t)=>t.class_ended_at?t.project_title||'任务项目':ctx.projects.find(p=>p.id===t.project_id)?.title||t.project_title||'原项目（'+t.project_id+'）';
 const taskStatus=t=>!t.active?'withdrawn':Date.parse(t.due_at)<(t.class_ended_at?Date.parse(t.class_ended_at):Date.now())?'overdue':'upcoming';
 const statusNames={withdrawn:'已撤回',overdue:'已截止',upcoming:'未截止'};
 function courseFilters(ctx){
  const courses=new Map();for(const p of [...ctx.projects,...ctx.tasks.map(t=>({id:t.project_id}))]){const c=courseFor(ctx,p.id);courses.set(c.id,c.name);}
  const select=$('tasks-course');select.replaceChildren(new Option('全部课程',''));
  for(const [id,name] of courses)select.append(new Option(name,id));
  if(ctx.filters.course&&!courses.has(ctx.filters.course))ctx.filters.course='';
  select.value=ctx.filters.course;
  $('tasks-outline-warning').hidden=!!ctx.layout;
  $('tasks-outline-warning').textContent='课程目录暂未读取成功，任务仍可查看。点击“刷新任务”可重试课程分类。';
 }
 function renderTasks(ctx,tasks){
  if(!ctx.teacher){renderStudent($('tasks-list'),tasks,{pendingOnly:$('tasks-pending').checked});return;}
  const f=ctx.filters,courseTasks=tasks.filter(t=>!f.course||courseFor(ctx,t.project_id).id===f.course);
  const summary=$('tasks-summary');summary.replaceChildren();
  for(const [name,n] of [['全部任务',courseTasks.length],['未截止',courseTasks.filter(t=>taskStatus(t)==='upcoming').length],['已截止',courseTasks.filter(t=>taskStatus(t)==='overdue').length],['已撤回',courseTasks.filter(t=>!t.active).length]]){const item=el('span','');item.append(el('strong',String(n)),document.createTextNode(name));summary.append(item);}
  const q=f.query.trim().toLocaleLowerCase();
  const visible=courseTasks.filter(t=>(f.state==='all'||(f.state==='active'?t.active:taskStatus(t)===f.state))&&[t.title,taskProject(ctx,t),courseFor(ctx,t.project_id).name].join(' ').toLocaleLowerCase().includes(q));
  visible.sort((a,b)=>(f.sort==='name'?String(a.title).localeCompare(String(b.title),'zh-CN'):f.sort==='due'?Date.parse(a.due_at)-Date.parse(b.due_at):(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0))||String(a.id).localeCompare(String(b.id)));
  ctx.pages=Math.max(1,Math.ceil(visible.length/10));ctx.page=Math.min(ctx.page,ctx.pages);
  const list=$('tasks-list');list.replaceChildren();
  const table=el('table','','tasks-table');table.setAttribute('aria-label','班级任务列表');
  const head=document.createElement('thead'),hr=document.createElement('tr');
  for(const name of ['任务 / 所属课程与项目','截止时间','任务状态',ctx.reports?'已提交报告':'自报完成','学生完成情况']){const h=el('th',name);h.scope='col';hr.append(h);}head.append(hr);table.append(head);
  const body=document.createElement('tbody');table.append(body);
  for(const t of visible.slice((ctx.page-1)*10,ctx.page*10)){
   const row=document.createElement('tr');row.dataset.taskId=t.id;
   const name=document.createElement('td');name.append(el('h3',t.title),el('p',courseFor(ctx,t.project_id).name+' · '+taskProject(ctx,t)));
   const more=document.createElement('details');more.className='tasks-extra';more.append(el('summary','任务要求与管理'),el('p',t.instructions||'未填写学习要求。'),el('p',t.delivery_mode==='class_snapshot'?'班级学习版本 · 内容以布置时保存的版本为准。':'旧版任务 · 使用公开分享版本。'));
   if(t.active&&!t.class_ended_at)more.append(button(ctx,'撤回任务',async()=>{if(!confirm('撤回“'+t.title+'”后，学生将不再看到此任务，确认？'))return;await api(ctx,'cancel',{task_id:t.id,revision:Number(t.revision)});try{await load(ctx);}catch{return '任务已撤回，列表刷新失败，请点击“刷新任务”确认。';}return '任务已撤回。';}));name.append(more);
   const date=el('td',new Date(t.due_at).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}));date.dataset.label='截止时间';
   const state=document.createElement('td'),status=taskStatus(t);state.dataset.label='任务状态';state.append(el('span',statusNames[status],'tasks-badge '+status));
   const count=el('td',(ctx.reports?(t.submitted_count||0):(t.completed_count||0))+' 人');count.dataset.label=ctx.reports?'已提交报告':'自报完成';
   if(t.review_counts)count.append(el('p','待批阅 '+t.review_counts.pending_review+' · 需修改 '+t.review_counts.revision_required+' · 已通过 '+t.review_counts.passed));
   const actions=document.createElement('td'),detail=el('button','完成明细','btn tasks-detail-button');detail.type='button';detail.onclick=()=>window.MatinTaskReports.teacher(t);actions.append(detail);
   if(window.MatinTaskEdit){if(t.active&&!t.class_ended_at){const edit=el('button','编辑 / 延期','btn tasks-detail-button');edit.type='button';edit.onclick=()=>MatinTaskEdit.edit(t,()=>load(ctx));actions.append(edit);}const history=el('button','修改记录','btn tasks-detail-button');history.type='button';history.onclick=()=>MatinTaskEdit.history(t,true);actions.append(history);}
   row.append(name,date,state,count,actions);body.append(row);
  }
  if(visible.length)list.append(table);else list.append(el('p',tasks.length?'没有符合条件的任务，请调整课程、状态或搜索条件。':'尚未布置任务，点击右上方“新建任务”开始。','tasks-empty'));
  $('tasks-page-info').textContent=visible.length?'共 '+visible.length+' 条 · 第 '+ctx.page+' / '+ctx.pages+' 页':'共 0 条';
  $('tasks-pages').hidden=ctx.view!=='list'||ctx.loadState!=='ready';syncControls(ctx);
 }
 function setView(ctx,view){
  ctx.view=view;const create=ctx.teacher&&view==='create';
  $('tasks-manager').hidden=!ctx.teacher||create;$('tasks-create').hidden=!create;$('tasks-list').hidden=create;
  $('tasks-new').hidden=!ctx.teacher||create;$('tasks-pages').hidden=!ctx.teacher||create||ctx.loadState!=='ready';
  $('tasks-filter-label').hidden=ctx.teacher;
  $('tasks-student-hint').hidden=ctx.teacher;
  $('tasks-title').textContent=ctx.teacher?(create?'新建班级任务':'任务管理'):'我的任务';
  $('tasks-breadcrumb').textContent=ctx.teacher?'班级管理 / '+ctx.row.name+(create?' / 任务管理':''):'学习中心';
  $('tasks-body').scrollTop=0;syncControls(ctx);
 }
 function discardCreate(ctx){return ctx.view!=='create'||!['tasks-name','tasks-due','tasks-instructions'].some(id=>$(id).value)||confirm('放弃尚未布置的任务内容？');}
 function close(force=false,restoreFocus=true){
  if(!active)return;
  if(active.busy&&active.writing&&!force){$('tasks-status').textContent='操作正在保存，请稍候再关闭。';return;}
  if(!force&&active.teacher&&!discardCreate(active))return;
  const opener=active.opener;if(active.underlay)active.underlay.inert=active.underlayInert;
  active=null;root.classList.add('hidden');root.setAttribute('aria-busy','false');
  if(restoreFocus&&opener?.isConnected)opener.focus();
 }
 $('tasks-close').onclick=()=>close();$('tasks-return').onclick=()=>close();
 root.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}
  if(e.key==='Tab'){
   const items=[...root.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary')].filter(e=>e.getClientRects().length);
   if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1)?.focus();}
   else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0]?.focus();}
  }
 });
 const refresh=()=>{const ctx=active;if(ctx)run(ctx,()=>load(ctx));};
 $('tasks-refresh').onclick=refresh;$('tasks-pending').onchange=refresh;
 for(const [id,key,event] of [['tasks-course','course','change'],['tasks-search','query','input'],['tasks-state','state','change'],['tasks-sort','sort','change']])$(id).addEventListener(event,()=>{
  const ctx=active;if(!ctx?.teacher||ctx.busy)return;ctx.filters[key]=$(id).value;ctx.page=1;renderTasks(ctx,ctx.tasks);
 });
 for(const [id,delta] of [['tasks-prev',-1],['tasks-next',1]])$(id).onclick=()=>{const ctx=active;if(!ctx?.teacher||ctx.busy)return;ctx.page=Math.max(1,Math.min(ctx.pages,ctx.page+delta));renderTasks(ctx,ctx.tasks);$('tasks-body').scrollTop=0;};
 $('tasks-new').onclick=()=>{
  const ctx=active;if(!ctx?.teacher||ctx.busy)return;
  $('tasks-form').reset();projectNotice(ctx);
  const project=ctx.projects.find(p=>!ctx.filters.course||courseFor(ctx,p.id).id===ctx.filters.course);
  if(project)$('tasks-project').value=project.id;
  else if(ctx.filters.course&&ctx.projects.length){$('tasks-project').prepend(new Option('当前课程暂无可布置项目，请选择其他课程的项目',''));$('tasks-project').value='';}
  selectedProjectState(ctx);
  ctx.listScroll=$('tasks-body').scrollTop;setView(ctx,'create');$('tasks-back').focus();
 };
 const backToList=()=>{const ctx=active;if(!ctx?.teacher||ctx.writing||!discardCreate(ctx))return;$('tasks-form').reset();setView(ctx,'list');$('tasks-body').scrollTop=ctx.listScroll||0;$('tasks-new').focus();};
 $('tasks-back').onclick=backToList;$('tasks-cancel-create').onclick=backToList;
 $('tasks-project').onchange=()=>{if(active)selectedProjectState(active);};
 $('tasks-form').onsubmit=e=>{
  e.preventDefault();const ctx=active;if(!ctx?.teacher||ctx.busy||ctx.row.class_ended_at)return;
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
   ctx.filters={...ctx.filters,course:courseFor(ctx,projectId).id,query:'',state:'active',sort:'newest'};ctx.page=1;
   $('tasks-search').value='';$('tasks-state').value='active';$('tasks-sort').value='newest';setView(ctx,'list');
   const success='已成功布置给'+ctx.row.name+'，审核通过的学生可在“我的任务”中查看。';
   try{await load(ctx);}catch{return success+' 列表刷新失败，请点击“刷新任务”确认。';}
   return success;
  },true);
 };
 window.addEventListener('matin-report-reviewed',()=>{const ctx=active;if(ctx?.teacher&&!ctx.busy)run(ctx,()=>load(ctx));});
 window.MatinTasks={loadStudent,studentState,renderStudent,studentChangeNotice,openStudent(id){const task=studentState().tasks.find(t=>t.id===id);if(task)return studentAction(task,'open');},open(row=null,options={}){
  if(!row&&window.MatinStudentPages&&window.MatinStudent?.navigate)return MatinStudent.navigate('tasks');
  if(studentState().busy)return;
  if(active?.busy&&active.writing)return;
  if(active?.teacher&&!discardCreate(active))return;
  if(active?.underlay)active.underlay.inert=active.underlayInert;
  const underlay=[...document.querySelectorAll('.modal-layer:not(.hidden)')].filter(e=>e!==root).at(-1);
  const ctx={teacher:!!row,row:row?{...row}:null,busy:false,writing:false,projects:[],tasks:[],layout:null,loadState:'loading',opener:document.activeElement,underlay,underlayInert:underlay?.inert,view:'list',page:1,pages:1,filters:{course:typeof options.courseId==='string'?options.courseId:'',query:'',state:'active',sort:'newest'}};
  active=ctx;
  if(underlay)underlay.inert=true;
  root.classList.toggle('teacher-tasks',ctx.teacher);$('tasks-search').value='';$('tasks-state').value='active';$('tasks-sort').value='newest';$('tasks-course').replaceChildren(new Option('全部课程',''));$('tasks-summary').replaceChildren();$('tasks-outline-warning').hidden=true;setView(ctx,'list');
  $('tasks-list').replaceChildren();$('tasks-form').reset();projectNotice(ctx);
  root.classList.remove('hidden');run(ctx,()=>load(ctx));$('tasks-close').focus();
 }};
})();
