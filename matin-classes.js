/* Teacher-owned class management. Course associations do not authorize student access. */
(() => {
 'use strict';
 window.MatinClasses={init({account,getCourses,beforeOpen}){
  const button=document.getElementById('classes-open');
  const root=document.createElement('div');root.className='modal-layer hidden';root.id='classes-modal';
  root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','classes-title');
  root.innerHTML=`<div class="modal classes-panel">
   <div class="actions"><h2 id="classes-title" style="margin-right:auto">班级管理</h2><button type="button" class="btn" id="classes-close">关闭</button></div>
   <p>管理自己的专业、年级和班级。一个班级可关联多门课程，同一课程也可用于多个班级。</p>
   <p class="notice">审核通过的学生可在“我的课程”查看班级关联的已发布项目。原有教师主页和项目分享链接仍独立有效。</p>
   <p id="classes-context" class="notice" hidden></p>
   <p id="classes-status" role="status" aria-live="polite"></p>
   <div class="classes-layout"><section><div class="actions"><input id="classes-search" aria-label="搜索班级" placeholder="搜索专业、年级、班级"><button type="button" class="btn" id="classes-refresh">刷新列表</button><button type="button" class="btn" id="classes-new">新建班级</button></div><p id="classes-count"></p><div id="classes-list"></div></section>
   <form id="class-form"><h3 id="class-heading">新建班级</h3>
    <div class="field"><label for="class-name">班级名称（必填）</label><input id="class-name" maxlength="80" required placeholder="例如：光电1班"></div>
    <div class="form-grid"><div class="field"><label for="class-major">专业</label><input id="class-major" maxlength="80" placeholder="例如：光电信息科学与工程"></div><div class="field"><label for="class-grade">年级</label><input id="class-grade" maxlength="40" placeholder="例如：2026级"></div></div>
    <div class="field"><label for="class-notes">备注</label><textarea id="class-notes" maxlength="500" rows="2" placeholder="教学安排等备注"></textarea></div>
    <fieldset><legend>授课课程（可多选）</legend><p>选择课程后，其下现有和以后新增的项目均沿用该班级。</p><div id="class-courses"></div></fieldset><fieldset id="class-legacy-box" hidden><legend>旧版未归类项目关联</legend><p>这些项目尚未归入课程，暂时保留旧关联。请先在工作台把项目归入课程，再回来保存班级；取消勾选可移除旧关联。</p><div id="class-legacy"></div></fieldset>
    <div class="actions"><button type="submit" class="btn primary" id="class-save">保存班级</button><button type="button" class="btn" id="class-cancel">取消并关闭</button></div>
   </form></div></div>`;
  const style=document.createElement('style');style.textContent=`#classes-modal .classes-panel{width:min(1100px,96vw);max-width:1100px;max-height:90vh;overflow:auto}#classes-modal p{line-height:1.7}#classes-modal .classes-layout{display:grid;grid-template-columns:1fr 1fr;gap:24px}#classes-modal .actions{flex-wrap:wrap;gap:8px}#classes-search{min-width:120px;flex:1;padding:10px;border:1px solid #ccd5e7;border-radius:10px}#classes-list{max-height:55vh;overflow:auto}#classes-modal .class-card{padding:16px;margin:10px 0;border:1px solid #dce3f1;border-radius:14px;background:#f8faff;overflow-wrap:anywhere}#classes-modal fieldset{border:1px solid #dce3f1;border-radius:12px;margin:14px 0;padding:12px}#class-courses{max-height:210px;overflow:auto}#class-legacy label,#class-courses label{display:flex;gap:10px;align-items:flex-start;padding:8px}#class-legacy input,#class-courses input{width:auto;flex-shrink:0}#classes-status{min-height:26px;color:#4c539d}#classes-modal h3{margin:4px 0 12px}@media(max-width:760px){#classes-modal .classes-layout{grid-template-columns:1fr}#classes-list{max-height:220px}}`;
  document.head.append(style);document.body.append(root);
  const $=id=>document.getElementById(id);let rows=[],current=null,busy=false,changed=false,loaded=false,loadError='',courseContext=null,formOutlineRevision=0;
  const outline=()=>window.MatinCourseOutline.controller.snapshot();
  window.MatinClasses.state=()=>({rows:[...rows],loaded,error:loadError});
  const projectGroup=(id,layout)=>layout.members.find(m=>m.project_id===id&&layout.groups.some(g=>g.id===m.group_id))?.group_id;
  const groupLinks=(r,layout)=>new Set([...(r.course_group_ids||[]),...(r.matin_class_courses||[]).map(c=>projectGroup(c.course_id,layout)).filter(Boolean)]);
  const infoStyle=document.createElement('style');infoStyle.textContent=`.course-class-info{margin:14px 0;padding:12px;border:1px solid #e0e5f4;border-radius:12px;background:#f7f9ff;overflow-wrap:anywhere}.course-class-info strong{font-size:12px;color:#42547b}.course-class-info ul{padding-left:18px;margin:8px 0;font-size:12px;color:#566787;line-height:1.7}.course-class-info .class-message{font-size:12px;color:#697995;margin:8px 0}.course-class-info .btn{margin-top:6px}`;document.head.append(infoStyle);
  function renderCourseInfo(){
   let layout;try{layout=outline().layout;}catch{}
   document.querySelectorAll('[data-course-classes],[data-course-group-classes]').forEach(target=>{
    const id=target.dataset.courseClasses;target.classList.add('course-class-info');target.replaceChildren();
    const heading=document.createElement('strong');heading.textContent='授课班级';target.append(heading);
    const groupId=target.dataset.courseGroupClasses||(layout&&projectGroup(id,layout));
    const linked=rows.filter(r=>(groupId&&layout&&groupLinks(r,layout).has(groupId))||(!target.dataset.courseGroupClasses&&(r.matin_class_courses||[]).some(c=>c.course_id===id)));
    if(account&&loaded&&linked.length){const list=document.createElement('ul');for(const row of linked){const li=document.createElement('li');li.textContent=[row.major,row.grade,row.name].filter(Boolean).join(' · ');list.append(li);}target.append(list);}
    const note=document.createElement('div');note.className='class-message';note.textContent=!account?'登录云端教师账号后管理班级':loadError?'班级信息读取失败，请打开班级管理刷新'+(loaded?'（上方为上次加载结果）':''):!loaded?'正在加载班级…':!layout?'课程目录尚未加载，请打开班级管理刷新':!linked.length?'尚未关联班级':'已关联 '+linked.length+' 个班级';target.append(note);
    if(account){const manage=document.createElement('button');manage.type='button';manage.className='btn tiny';manage.textContent='管理授课班级';manage.onclick=()=>open(target.dataset.courseGroupClasses||id,!!target.dataset.courseGroupClasses);target.append(manage);}
   });
   window.MatinProjectTasks?.render?.();
  }
  window.MatinClasses.renderCourseInfo=renderCourseInfo;
  const oldCanLeave=window.MatinAccount.canLeave;
  window.MatinAccount.canLeave=()=>{if(busy){alert('班级操作正在处理中，请稍候。');return false;}return oldCanLeave()&&(!changed||confirm('班级资料尚未保存，确定离开？'));};
  window.addEventListener('beforeunload',e=>{if(changed||busy){e.preventDefault();e.returnValue='';}});
  const discard=()=>!changed||confirm('放弃尚未保存的班级修改？');
  function lock(value){busy=value;root.querySelectorAll('button,input,textarea').forEach(el=>el.disabled=value);$('class-save').disabled=value||!loaded;}
  function edit(row=null){
   current=row;changed=false;$('class-heading').textContent=row?'编辑班级':'新建班级';
   for(const key of ['name','major','grade','notes'])$('class-'+key).value=row?.[key]||'';
   const target=$('class-courses');target.replaceChildren();$('class-legacy').replaceChildren();$('class-legacy-box').hidden=true;
   let state;try{state=outline();}catch(e){target.textContent=e.message;return;}
   formOutlineRevision=state.revision;const layout=state.layout;
   const chosen=row?groupLinks(row,layout):new Set(courseContext?[courseContext]:[]);
   for(const g of layout.groups){
    const label=document.createElement('label'),input=document.createElement('input'),span=document.createElement('span');
    input.type='checkbox';input.value=g.id;input.checked=chosen.has(g.id);span.textContent=g.name+'（'+getCourses().filter(p=>projectGroup(p.id,layout)===g.id).length+' 个项目）';label.append(input,span);target.append(label);
   }
   if(!target.children.length)target.textContent='还没有课程目录。请先返回工作台点击“新建课程”，再将项目归入课程。';
   const unresolved=(row?.matin_class_courses||[]).filter(c=>!projectGroup(c.course_id,layout));
   for(const c of unresolved){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=c.course_id;input.checked=true;label.append(input,document.createTextNode(getCourses().find(p=>p.id===c.course_id)?.title||'已不可用项目'));$('class-legacy').append(label);}
   $('class-legacy-box').hidden=!unresolved.length;

  }
  function render(){
   renderCourseInfo();
   const q=$('classes-search').value.trim().toLowerCase();const visible=rows.filter(r=>[r.name,r.major,r.grade].join(' ').toLowerCase().includes(q));
   $('classes-count').textContent=`共 ${rows.length} 个班级 · 当前显示 ${visible.length} 个`;
   const list=$('classes-list');list.replaceChildren();
   if(!visible.length){list.textContent=rows.length?'没有匹配的班级。':'尚未创建班级，请填写右侧表单。';return;}
   let layout;try{layout=outline().layout;}catch{}
   const titles=new Map((layout?.groups||[]).map(g=>[g.id,g.name]));
   for(const r of visible){
    const card=document.createElement('article');card.className='class-card';const h=document.createElement('h3');h.textContent=r.name;
    const info=document.createElement('p');info.textContent=[r.major||'未填写专业',r.grade||'未填写年级'].join(' · ');
    const courses=document.createElement('p');courses.textContent='授课课程：'+(layout?([...groupLinks(r,layout)].filter(id=>titles.has(id)).map(id=>titles.get(id)).join('、')||'尚未关联'):'课程目录尚未加载');
    const legacy=(r.matin_class_courses||[]).filter(c=>!layout||!projectGroup(c.course_id,layout));if(legacy.length)courses.textContent+='；有 '+legacy.length+' 个旧版项目关联待归类';
    if(layout&&(r.course_group_ids||[]).some(id=>!titles.has(id)))courses.textContent+='；部分课程目录已删除，保存班级可清理关联';
    const actions=document.createElement('div');actions.className='actions';
    const e=document.createElement('button');e.type='button';e.className='btn';e.textContent='编辑';e.onclick=()=>{if(!busy&&discard())edit(r);};
    const d=document.createElement('button');d.type='button';d.className='btn';d.textContent='删除';d.onclick=async()=>{
     if(busy||!discard()||!confirm(`删除班级“${r.name}”？仅删除班级及课程关联，课程内容会保留。`))return;
     await request(async()=>{await window.MatinAccount.api({action:'class_delete',id:r.id,revision:Number(r.revision)});rows=rows.filter(x=>x.id!==r.id);edit();render();return '班级已删除，课程内容已保留。';});
    };
    const members=document.createElement('button');members.type='button';members.className='btn';members.textContent='学生与入班审核';members.onclick=()=>{if(!busy&&discard())window.MatinEnrollment.open(r);};
    const tasks=document.createElement('button');tasks.type='button';tasks.className='btn';tasks.textContent='任务管理';tasks.onclick=()=>{if(!busy&&discard())window.MatinTasks.open(r);};
    actions.append(e,d,members,tasks);card.append(h,info,courses,actions);list.append(card);
   }
  }
  async function request(fn){lock(true);$('classes-status').textContent='正在处理…';try{$('classes-status').textContent=await fn();}catch(e){$('classes-status').textContent=e.message;}finally{lock(false);}}
  async function refresh(){await request(async()=>{try{if(window.MatinCourseOutline.controller)await window.MatinCourseOutline.controller.reload();const data=await window.MatinAccount.api({action:'classes_list'});if(!Array.isArray(data.classes))throw Error('班级接口尚未升级');rows=data.classes;loaded=true;loadError='';edit();render();return '已加载此账号的云端班级。';}catch(e){loadError=e.message;renderCourseInfo();throw e;}});}
  async function open(courseId=null,isGroup=false){if(busy)return;if(!account){alert('班级管理需要登录云端教师账号，请使用线上教师端。');return;}if(beforeOpen&&!await beforeOpen())return;
   if(window.MatinCourseOutline.controller)await window.MatinCourseOutline.controller.reload();
   let layout;try{layout=outline().layout;}catch{}
   courseContext=isGroup?courseId:(layout&&projectGroup(courseId,layout));$('classes-context').hidden=!courseId;
   $('classes-context').textContent=courseContext?'当前课程：'+(layout?.groups.find(g=>g.id===courseContext)?.name||'课程')+'。选择课程后，该课程下所有项目沿用授课班级；新建班级时已预选该课程。':courseId?'当前项目尚未归入课程。请先返回工作台，将它归入课程，再选择授课课程。':'';
   $('classes-search').value='';root.classList.remove('hidden');if(!changed)await refresh();$('classes-close').focus();}
  window.MatinClasses.openCourse=id=>open(id,true);
  button.onclick=()=>open();
  function close(){if(busy||!discard())return;changed=false;current=null;root.classList.add('hidden');button.focus();}
  $('classes-close').onclick=close;
  root.addEventListener('keydown',e=>{
   if(e.key==='Escape')$('classes-close').click();
   if(e.key==='Tab'){
    const items=[...root.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled)')].filter(x=>x.getClientRects().length);
    if(!items.length){e.preventDefault();return;}
    if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1).focus();}
    else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0].focus();}
   }
  });
  $('classes-new').onclick=()=>{if(discard()){edit();$('class-name').focus();}};
  $('class-cancel').onclick=close;
  $('classes-refresh').onclick=()=>{if(discard())refresh();};
  $('classes-search').oninput=render;
  $('class-form').oninput=()=>{changed=true;};
  $('class-form').onsubmit=async e=>{
   e.preventDefault();if(busy||!loaded)return;
   const data={};for(const key of ['name','major','grade','notes'])data[key]=$('class-'+key).value.trim();
   if(!data.name){$('classes-status').textContent='请填写班级名称。';return;}
   try{outline();}catch(e){$('classes-status').textContent=e.message;return;}
   data.group_ids=Array.from($('class-courses').querySelectorAll('input:checked')).map(x=>x.value);
   data.course_ids=Array.from($('class-legacy').querySelectorAll('input:checked')).map(x=>x.value);
   await request(async()=>{
    const result=await window.MatinAccount.api({action:'class_group_save',id:current?.id||null,revision:Number(current?.revision||0),outline_revision:formOutlineRevision,data});
    const row={...result.class,course_group_ids:data.group_ids,matin_class_courses:data.course_ids.map(course_id=>({course_id}))};
    rows=rows.filter(x=>x.id!==row.id);rows.push(row);edit(row);render();return '班级已保存到云端。审核通过的学生可查看关联课程的已发布项目，草稿不会自动发布。';
   });
  };
  edit();lock(false);if(account)refresh();else renderCourseInfo();
 }};
})();
