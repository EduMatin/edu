/* Teacher project cards show assignments for one explicitly selected class. */
(() => {'use strict';
 const el=(tag,text,cls='')=>{const e=document.createElement(tag);e.textContent=text;e.className=cls;return e;};
 window.MatinProjectTasks={init({account,beforeOpen}){
  const toolbar=el('section','','project-task-toolbar');toolbar.id='project-task-toolbar';toolbar.hidden=true;
  const title=el('strong','本课程项目与班级任务'),hint=el('p','先选择班级。下方项目卡片列出该班学生收到的任务名称；公开分享单独管理。');
  const controls=el('div','','actions'),label=el('label','查看班级 '),select=el('select');select.id='project-task-class';label.append(select);
  const refresh=el('button','刷新班级任务','btn'),manage=el('button','管理本班任务','btn primary');refresh.type=manage.type='button';controls.append(label,refresh,manage);
  const status=el('p','','project-task-status');status.setAttribute('role','status');toolbar.append(title,hint,controls,status);document.getElementById('category-chips').before(toolbar);
  const css=el('style',`#project-task-toolbar{margin:16px 0;padding:16px 18px;border:1px solid #dde5f5;border-radius:14px;background:#fff}#project-task-toolbar[hidden]{display:none}#project-task-toolbar p{font-size:12px;color:#697c98;line-height:1.7;margin:7px 0}#project-task-toolbar .actions{gap:10px;flex-wrap:wrap}#project-task-toolbar label{font-size:13px;color:#3b5075;display:flex;align-items:center;gap:10px;min-width:0}#project-task-class{max-width:380px;min-width:160px;padding:9px;border:1px solid #dce3f1;border-radius:9px;font:inherit;color:inherit;background:#fff}.project-assigned-tasks{margin-top:14px;border-top:1px solid #e5eaf3;padding-top:14px}.project-assigned-tasks h4{margin:0 0 8px;font-size:13px;color:#344d78}.project-assigned-tasks ul{list-style:none;padding:0;margin:0}.project-assigned-tasks li{border-bottom:1px solid #edf0f6;padding:10px 0;overflow-wrap:anywhere}.project-assigned-tasks li:last-child{border:0}.project-assigned-tasks strong{font-size:14px;color:#253b65}.project-assigned-tasks small{display:block;font-size:12px;color:#75839c;line-height:1.7;margin:5px 0}.project-assigned-tasks .btn{padding:6px 10px;font-size:12px}.project-assigned-tasks .project-task-note{font-size:12px;line-height:1.7;color:#6b7d98;margin:8px 0}@media(max-width:600px){#project-task-toolbar label{width:100%;display:grid}#project-task-class{max-width:100%;width:100%}}`);document.head.append(css);
  const cache=new Map(),chosen=new Map();let group=null,classes=[],classId='',outline=null;
  const getState=()=>window.MatinClasses.state?.()||{rows:[],loaded:false,error:''};
  function rowsFor(){return cache.get(classId)?.data?.tasks.filter(t=>t.class_id===classId&&t.active===true)||[];}
  function draw(){
   const state=cache.get(classId),row=classes.find(r=>r.id===classId),tasks=rowsFor();
   refresh.disabled=!row||state?.loading;manage.disabled=!row;
   status.textContent=!row?'选择一个班级查看已布置任务。':state?.loading?'正在读取'+row.name+'的任务…':state?.error?'班级任务读取失败：'+state.error:state?.data?'正在查看：'+row.name+'。任务名称与该班学生端一致。':'等待读取班级任务。';
   document.querySelectorAll('[data-project-tasks]').forEach(target=>{
    target.replaceChildren();target.className='project-assigned-tasks';
    const own=tasks.filter(t=>t.project_id===target.dataset.projectTasks).sort((a,b)=>(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0)||String(a.id).localeCompare(String(b.id)));
    target.append(el('h4',row?'班级任务 · '+row.name:'班级任务'));
    if(!row||state?.loading||state?.error||!state?.data){target.append(el('p',!row?'请在上方选择班级。':state?.loading?'正在读取…':state?.error?'读取失败，请点击上方“刷新班级任务”重试。':'等待读取…','project-task-note'));return;}
    if(!own.length){target.append(el('p','本班尚未布置此项目的任务。可从“管理本班任务”中新建。','project-task-note'));return;}
    target.append(el('p','已布置 '+own.length+' 条任务','project-task-note'));const list=el('ul','');
    for(const t of own.slice(0,3)){const item=el('li','');item.dataset.projectTaskId=t.id;item.append(el('strong',t.title),el('small',new Date(t.due_at).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})+' 截止 · '+(state.data.reports_version===1?(t.submitted_count||0)+' 人已交报告':(t.completed_count||0)+' 人自报完成')));
     const button=el('button','完成明细','btn');button.type='button';button.onclick=()=>window.MatinTaskReports.teacher(t);item.append(button);list.append(item);}
    target.append(list);if(own.length>3)target.append(el('p','另有 '+(own.length-3)+' 条，请进入任务管理查看。','project-task-note'));
   });
  }
  async function load(id){
   if(!classes.some(r=>r.id===id)||!account)return;
   const request={loading:true,data:null,error:''};cache.set(id,request);draw();
   try{const data=await MatinAccount.api({action:'tasks',op:'teacher_list',data:{class_id:id}});
    if(!Array.isArray(data.tasks)||data.assignment_mode!=='class_snapshot')throw Error('任务服务尚未升级，请联系管理员。');
    if(cache.get(id)!==request)return;request.data=data;
   }catch(e){if(cache.get(id)!==request)return;request.error=e.message||'请重试';}
   finally{if(cache.get(id)===request){request.loading=false;draw();}}
  }
  function render(){
   group=window.MatinCourseOutline.controller?.current();toolbar.hidden=!account||!group;
   if(toolbar.hidden)return;
   const state=getState();classes=state.rows;
   if(!state.loaded||state.error){classId='';select.replaceChildren(new Option(state.error?'班级读取失败，请在班级管理刷新':'正在读取班级…',''));select.disabled=true;draw();status.textContent=state.error?'班级读取失败，请打开“班级管理”刷新列表。':'正在读取班级…';return;}
   try{outline=MatinCourseOutline.controller.snapshot().layout;}catch{outline=null;}
   const linked=r=>(r.course_group_ids||[]).includes(group)||(r.matin_class_courses||[]).some(c=>outline?.members.some(m=>m.project_id===c.course_id&&m.group_id===group));
   classes=[...classes].sort((a,b)=>Number(linked(b))-Number(linked(a))||a.name.localeCompare(b.name,'zh-CN'));
   classId=chosen.has(group)?chosen.get(group):(classes.find(linked)?.id||'');if(!classes.some(r=>r.id===classId))classId='';
   select.replaceChildren(new Option(classes.length?'选择班级':'尚未创建班级',''));
   for(const row of classes)select.append(new Option((linked(row)?'':'其他班级 · ')+row.name,row.id));select.value=classId;select.disabled=!classes.length;
   for(const id of cache.keys())if(!classes.some(r=>r.id===id))cache.delete(id);
   draw();if(classId&&!cache.has(classId))void load(classId);
  }
  select.onchange=()=>{classId=select.value;chosen.set(group,classId);draw();if(classId&&!cache.has(classId))void load(classId);};
  refresh.onclick=()=>load(classId);
  manage.onclick=async()=>{const row=classes.find(r=>r.id===classId),courseId=group;if(!row)return;if(beforeOpen&&!await beforeOpen())return;window.MatinTasks.open(row,{courseId});};
  window.addEventListener('matin-teacher-tasks-changed',e=>{if(!account||!classes.some(r=>r.id===e.detail?.classId))return;cache.set(e.detail.classId,{loading:false,error:e.detail.error||'',data:e.detail.data||null});draw();});
  window.addEventListener('matin-teaching-plan-published',e=>{if(!account)return;const ids=e.detail?.classIds||[];for(const id of ids)cache.delete(id);if(group&&ids.includes(classId))void load(classId);});
  window.MatinProjectTasks.render=render;render();
 }};
})();
