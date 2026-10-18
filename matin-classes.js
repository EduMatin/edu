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
   <p class="notice">授课课程关联用于教师备课管理，暂不限制学生访问。现有教师主页仍展示全部已发布课程。</p>
   <p id="classes-context" class="notice" hidden></p>
   <p id="classes-status" role="status" aria-live="polite"></p>
   <div class="classes-layout"><section><div class="actions"><input id="classes-search" aria-label="搜索班级" placeholder="搜索专业、年级、班级"><button type="button" class="btn" id="classes-refresh">刷新列表</button><button type="button" class="btn" id="classes-new">新建班级</button></div><p id="classes-count"></p><div id="classes-list"></div></section>
   <form id="class-form"><h3 id="class-heading">新建班级</h3>
    <div class="field"><label for="class-name">班级名称（必填）</label><input id="class-name" maxlength="80" required placeholder="例如：光电1班"></div>
    <div class="form-grid"><div class="field"><label for="class-major">专业</label><input id="class-major" maxlength="80" placeholder="例如：光电信息科学与工程"></div><div class="field"><label for="class-grade">年级</label><input id="class-grade" maxlength="40" placeholder="例如：2026级"></div></div>
    <div class="field"><label for="class-notes">备注</label><textarea id="class-notes" maxlength="500" rows="2" placeholder="教学安排等备注"></textarea></div>
    <fieldset><legend>授课课程（可多选）</legend><div id="class-courses"></div></fieldset>
    <div class="actions"><button type="submit" class="btn primary" id="class-save">保存班级</button><button type="button" class="btn" id="class-cancel">取消编辑</button></div>
   </form></div></div>`;
  const style=document.createElement('style');style.textContent=`#classes-modal .classes-panel{width:min(1100px,96vw);max-width:1100px;max-height:90vh;overflow:auto}#classes-modal p{line-height:1.7}#classes-modal .classes-layout{display:grid;grid-template-columns:1fr 1fr;gap:24px}#classes-modal .actions{flex-wrap:wrap;gap:8px}#classes-search{min-width:120px;flex:1;padding:10px;border:1px solid #ccd5e7;border-radius:10px}#classes-list{max-height:55vh;overflow:auto}#classes-modal .class-card{padding:16px;margin:10px 0;border:1px solid #dce3f1;border-radius:14px;background:#f8faff;overflow-wrap:anywhere}#classes-modal fieldset{border:1px solid #dce3f1;border-radius:12px;margin:14px 0;padding:12px}#class-courses{max-height:210px;overflow:auto}#class-courses label{display:flex;gap:10px;align-items:flex-start;padding:8px}#class-courses input{width:auto;flex-shrink:0}#classes-status{min-height:26px;color:#4c539d}#classes-modal h3{margin:4px 0 12px}@media(max-width:760px){#classes-modal .classes-layout{grid-template-columns:1fr}#classes-list{max-height:220px}}`;
  document.head.append(style);document.body.append(root);
  const $=id=>document.getElementById(id);let rows=[],current=null,busy=false,changed=false,loaded=false,loadError='',courseContext=null;
  const infoStyle=document.createElement('style');infoStyle.textContent=`.course-class-info{margin:14px 0;padding:12px;border:1px solid #e0e5f4;border-radius:12px;background:#f7f9ff;overflow-wrap:anywhere}.course-class-info strong{font-size:12px;color:#42547b}.course-class-info ul{padding-left:18px;margin:8px 0;font-size:12px;color:#566787;line-height:1.7}.course-class-info .class-message{font-size:12px;color:#697995;margin:8px 0}.course-class-info .btn{margin-top:6px}`;document.head.append(infoStyle);
  function renderCourseInfo(){
   document.querySelectorAll('[data-course-classes]').forEach(target=>{
    const id=target.dataset.courseClasses;target.classList.add('course-class-info');target.replaceChildren();
    const heading=document.createElement('strong');heading.textContent='授课班级';target.append(heading);
    const linked=rows.filter(r=>(r.matin_class_courses||[]).some(c=>c.course_id===id));
    if(account&&loaded&&linked.length){const list=document.createElement('ul');for(const row of linked){const li=document.createElement('li');li.textContent=[row.major,row.grade,row.name].filter(Boolean).join(' · ');list.append(li);}target.append(list);}
    const note=document.createElement('div');note.className='class-message';note.textContent=!account?'登录云端教师账号后管理班级':loadError?'班级信息读取失败，请打开班级管理刷新'+(loaded?'（上方为上次加载结果）':''):!loaded?'正在加载班级…':!linked.length?'尚未关联班级':'已关联 '+linked.length+' 个班级';target.append(note);
    if(account){const manage=document.createElement('button');manage.type='button';manage.className='btn tiny';manage.textContent='管理授课班级';manage.onclick=()=>open(id);target.append(manage);}
   });
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
   const chosen=new Set(row?(row.matin_class_courses||[]).map(c=>c.course_id):(courseContext?[courseContext]:[]));const target=$('class-courses');target.replaceChildren();
   for(const p of getCourses()){
    const label=document.createElement('label'),input=document.createElement('input'),span=document.createElement('span');
    input.type='checkbox';input.value=p.id;input.checked=chosen.has(p.id);span.textContent=p.title;label.append(input,span);target.append(label);
   }
   if(!target.children.length)target.textContent='还没有课程。可以先保存班级，创建课程后再回来关联。';
  }
  function render(){
   renderCourseInfo();
   const q=$('classes-search').value.trim().toLowerCase();const visible=rows.filter(r=>[r.name,r.major,r.grade].join(' ').toLowerCase().includes(q));
   $('classes-count').textContent=`共 ${rows.length} 个班级 · 当前显示 ${visible.length} 个`;
   const list=$('classes-list');list.replaceChildren();
   if(!visible.length){list.textContent=rows.length?'没有匹配的班级。':'尚未创建班级，请填写右侧表单。';return;}
   const titles=new Map(getCourses().map(p=>[p.id,p.title]));
   for(const r of visible){
    const card=document.createElement('article');card.className='class-card';const h=document.createElement('h3');h.textContent=r.name;
    const info=document.createElement('p');info.textContent=[r.major||'未填写专业',r.grade||'未填写年级'].join(' · ');
    const courses=document.createElement('p');courses.textContent='授课课程：'+((r.matin_class_courses||[]).map(c=>titles.get(c.course_id)||'课程已变更，请重新加载云端').join('、')||'尚未关联');
    const actions=document.createElement('div');actions.className='actions';
    const e=document.createElement('button');e.type='button';e.className='btn';e.textContent='编辑';e.onclick=()=>{if(!busy&&discard())edit(r);};
    const d=document.createElement('button');d.type='button';d.className='btn';d.textContent='删除';d.onclick=async()=>{
     if(busy||!discard()||!confirm(`删除班级“${r.name}”？仅删除班级及课程关联，课程内容会保留。`))return;
     await request(async()=>{await window.MatinAccount.api({action:'class_delete',id:r.id,revision:Number(r.revision)});rows=rows.filter(x=>x.id!==r.id);edit();render();return '班级已删除，课程内容已保留。';});
    };
    actions.append(e,d);card.append(h,info,courses,actions);list.append(card);
   }
  }
  async function request(fn){lock(true);$('classes-status').textContent='正在处理…';try{$('classes-status').textContent=await fn();}catch(e){$('classes-status').textContent=e.message;}finally{lock(false);}}
  async function refresh(){await request(async()=>{try{const data=await window.MatinAccount.api({action:'classes_list'});if(!Array.isArray(data.classes))throw Error('班级接口尚未升级');rows=data.classes;loaded=true;loadError='';edit();render();return '已加载此账号的云端班级。';}catch(e){loadError=e.message;renderCourseInfo();throw e;}});}
  async function open(courseId=null){if(busy)return;if(!account){alert('班级管理需要登录云端教师账号，请使用线上教师端。');return;}if(beforeOpen&&!await beforeOpen())return;courseContext=courseId;$('classes-context').hidden=!courseId;$('classes-context').textContent=courseId?'当前课程：'+(getCourses().find(p=>p.id===courseId)?.title||'当前项目')+'。点击班级的“编辑”，勾选或取消该课程后保存；新建班级时已预选该课程。':'';$('classes-search').value='';root.classList.remove('hidden');if(!changed)await refresh();$('classes-close').focus();}
  button.onclick=()=>open();
  $('classes-close').onclick=()=>{if(!busy&&discard()){changed=false;root.classList.add('hidden');button.focus();}};
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
  $('class-cancel').onclick=()=>{if(discard())edit();};
  $('classes-refresh').onclick=()=>{if(discard())refresh();};
  $('classes-search').oninput=render;
  $('class-form').oninput=()=>{changed=true;};
  $('class-form').onsubmit=async e=>{
   e.preventDefault();if(busy||!loaded)return;
   const data={};for(const key of ['name','major','grade','notes'])data[key]=$('class-'+key).value.trim();
   if(!data.name){$('classes-status').textContent='请填写班级名称。';return;}
   data.course_ids=Array.from($('class-courses').querySelectorAll('input:checked')).map(x=>x.value);
   await request(async()=>{
    const result=await window.MatinAccount.api({action:'class_save',id:current?.id||null,revision:Number(current?.revision||0),data});
    const row={...result.class,matin_class_courses:data.course_ids.map(course_id=>({course_id}))};
    rows=rows.filter(x=>x.id!==row.id);rows.push(row);edit(row);render();return '班级已保存到云端。课程关联不会自动发布课程或限制学生访问。';
   });
  };
  edit();lock(false);if(account)refresh();else renderCourseInfo();
 }};
})();
