/* Organization only: does not change project content, publication or student access. */
(() => {'use strict';
 window.MatinCourseOutline={init({account,getProjects,redraw,beforeWrite,notify}){
  let layout={groups:[],members:[]},revision=0,selected=null,ready=false,busy=false,error='',editing=null,returnFocus=null;
  const $=id=>document.getElementById(id),key='matin_course_outline_offline_v1',selectionKey='matin_course_selection:'+(account?.id||'offline');
  try{selected=sessionStorage.getItem(selectionKey)||null;}catch{}
  const root=document.createElement('div');root.id='course-folders';$('category-chips').before(root);
  const bar=document.createElement('div');bar.id='course-folder-bar';bar.className='actions';root.before(bar);
  const dialog=document.createElement('div');dialog.id='course-folder-modal';dialog.className='modal-layer hidden';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','course-folder-heading');
  dialog.innerHTML=`<form class="modal" id="course-folder-form"><h2 id="course-folder-heading">新建课程</h2><div class="field"><label for="course-folder-name">课程名称</label><input id="course-folder-name" required maxlength="150" placeholder="例如：工程光学"></div><p>勾选归入这门课程的实训项目。每个项目归属一门课程；从其他课程勾选的项目会移入此课程。</p><div id="course-folder-projects"></div><p id="course-folder-status" role="status"></p><div class="actions"><button class="btn primary" id="course-folder-save" type="submit">保存课程</button><button class="btn" id="course-folder-cancel" type="button">取消</button></div></form>`;document.body.append(dialog);
  const style=document.createElement('style');style.textContent=`#course-folders{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px;margin:20px 0}#course-folder-bar{margin:12px 0;flex-wrap:wrap;gap:8px}.course-folder-card{padding:24px;background:white;border:1px solid #e0e5f3;border-radius:20px;box-shadow:0 8px 24px #34457908;overflow-wrap:anywhere}.course-folder-card h3{font-size:22px;margin:12px 0;color:#283b68}.course-folder-card p{color:#697996;line-height:1.7}.course-folder-card .actions{flex-wrap:wrap;gap:8px;margin-top:18px}#course-folder-modal .modal{max-width:660px;max-height:90vh;overflow:auto}#course-folder-modal p{line-height:1.8;color:#64748b}#course-folder-projects{max-height:310px;overflow:auto;border:1px solid #e0e5f3;border-radius:12px;padding:8px}#course-folder-projects label{display:flex;gap:10px;align-items:flex-start;padding:10px;overflow-wrap:anywhere}#course-folder-projects input{width:auto;flex-shrink:0}.project-folder-info{font-size:12px;color:#64748b;margin:8px 0}`;document.head.append(style);
  const groupOf=id=>layout.members.find(m=>m.project_id===id)?.group_id||null;
  const belongs=(id,group)=>group==='ungrouped'?!layout.groups.some(g=>g.id===groupOf(id)):groupOf(id)===group;
  const groupName=id=>layout.groups.find(g=>g.id===groupOf(id))?.name||'未归类项目';
  function btn(text,fn){const b=document.createElement('button');b.className='btn';b.type='button';b.textContent=text;b.disabled=busy;b.onclick=fn;return b;}
  function update(){redraw();document.querySelectorAll('[data-project-folder]').forEach(el=>{el.textContent='所属课程：'+groupName(el.dataset.projectFolder);});}
  const previousCanLeave=window.MatinAccount.canLeave;
  window.MatinAccount.canLeave=()=>{if(busy){notify('课程目录正在保存或读取，请稍候。');return false;}return previousCanLeave()&&(dialog.classList.contains('hidden')||confirm('课程目录编辑尚未提交，确定离开？'));};
  window.addEventListener('beforeunload',e=>{if(busy||!dialog.classList.contains('hidden')){e.preventDefault();e.returnValue='';}});
  async function load(){if(busy)return;busy=true;error='';update();try{
   const data=account?await window.MatinAccount.api({action:'outline_get'}):JSON.parse(localStorage.getItem(key)||'null')||{layout:{groups:[],members:[]},revision:0};
   if(!data.layout||!Array.isArray(data.layout.groups)||!Array.isArray(data.layout.members))throw Error('课程目录响应不完整');layout=data.layout;revision=Number(data.revision);ready=true;
   if(selected&&selected!=='ungrouped'&&!layout.groups.some(g=>g.id===selected))selected=null;
  }catch(e){error=e.message;}finally{busy=false;update();}}
  async function save(next){
   if(busy||!ready)throw Error('请先读取课程目录');busy=true;
   dialog.querySelectorAll('button,input').forEach(e=>e.disabled=true);update();
   try{const alive=new Set(getProjects().map(p=>p.id));next.members=next.members.filter(m=>alive.has(m.project_id));
    const data=account?await window.MatinAccount.api({action:'outline_save',revision,layout:next}):{layout:next,revision:revision+1};
    if(!account)localStorage.setItem(key,JSON.stringify(data));layout=data.layout;revision=Number(data.revision);error='';
   }finally{busy=false;dialog.querySelectorAll('button,input').forEach(e=>e.disabled=false);update();}
  }
  function enter(id){selected=id;try{if(id)sessionStorage.setItem(selectionKey,id);else sessionStorage.removeItem(selectionKey);}catch{}redraw(true);}
  async function edit(group=null){if(busy||!ready){notify(error||'课程目录尚未加载，请稍候或刷新课程目录。');return;}if(beforeWrite&&!await beforeWrite())return;
   returnFocus=document.activeElement;editing=group;$('course-folder-heading').textContent=group?'编辑课程与项目':'新建课程';$('course-folder-name').value=group?.name||'';$('course-folder-status').textContent='';const list=$('course-folder-projects');list.replaceChildren();
   for(const p of getProjects()){const l=document.createElement('label'),c=document.createElement('input'),s=document.createElement('span');c.type='checkbox';c.value=p.id;c.checked=!!group&&groupOf(p.id)===group.id;s.textContent=p.title+'（'+groupName(p.id)+'）';l.append(c,s);list.append(l);}
   if(!list.children.length)list.textContent='还没有实训项目。保存课程后，可进入课程创建项目。';dialog.classList.remove('hidden');$('course-folder-name').focus();
  }
  function close(){if(busy)return;dialog.classList.add('hidden');returnFocus?.isConnected&&returnFocus.focus();}
  $('course-folder-cancel').onclick=close;
  dialog.addEventListener('keydown',e=>{if(e.key==='Escape')close();if(e.key==='Tab'){const a=[...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled)')];if(!a.length){e.preventDefault();return;}if(e.shiftKey&&document.activeElement===a[0]){e.preventDefault();a.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===a.at(-1)){e.preventDefault();a[0].focus();}}});
  $('course-folder-form').onsubmit=async e=>{e.preventDefault();if(busy)return;const name=$('course-folder-name').value.trim();if(!name)return;
   if(layout.groups.some(g=>g.id!==editing?.id&&g.name===name)){$('course-folder-status').textContent='已有同名课程，请换一个名称。';return;}
   if(!editing&&layout.groups.length>=200){$('course-folder-status').textContent='最多支持200门课程。';return;}
   const id=editing?.id||crypto.randomUUID();const chosen=new Set([...$('course-folder-projects').querySelectorAll('input:checked')].map(e=>e.value));
   const next=structuredClone(layout);next.groups=next.groups.filter(g=>g.id!==id);next.groups.push({id,name});next.members=next.members.filter(m=>m.group_id!==id&&!chosen.has(m.project_id));for(const project_id of chosen)next.members.push({project_id,group_id:id});
   try{await save(next);enter(id);close();update();notify('课程目录已保存。');}catch(e){$('course-folder-status').textContent=e.message;}
  };
  async function remove(group){if(busy||!confirm(`删除课程目录“${group.name}”？其中的项目会回到“未归类项目”，项目内容、班级关联和发布状态会保留。`))return;const next=structuredClone(layout);next.groups=next.groups.filter(g=>g.id!==group.id);next.members=next.members.filter(m=>m.group_id!==group.id);try{await save(next);selected=null;update();}catch(e){notify(e.message);}}
  const api={
   current:()=>selected,
   visible:p=>ready&&selected!==null&&belongs(p.id,selected),
   name:groupName,
   enter,
   async created(id,target){if(!target||target==='ungrouped')return true;try{const next=structuredClone(layout);if(!next.groups.some(g=>g.id===target))throw Error('课程目录已不存在');next.members=next.members.filter(m=>m.project_id!==id);next.members.push({project_id:id,group_id:target});await save(next);return true;}catch(e){notify('项目已保留在未归类项目中，归入课程失败：'+e.message);return false;}},
   render(needle=''){
    const isRoot=selected===null;root.classList.toggle('hidden',!isRoot);$('projects-grid').classList.toggle('hidden',isRoot);$('category-chips').classList.toggle('hidden',isRoot);$('new-project-button').classList.toggle('hidden',isRoot);$('new-course-button').classList.toggle('hidden',!isRoot);
    $('project-search').placeholder=isRoot?'搜索课程名称…':'搜索本课程中的项目…';$('project-search').setAttribute('aria-label',isRoot?'搜索课程':'搜索实训项目');
    $('library-title').textContent=isRoot?'我的课程':selected==='ungrouped'?'未归类项目':layout.groups.find(g=>g.id===selected)?.name||'课程';
    bar.replaceChildren();bar.append(btn('刷新课程目录',load));if(!isRoot){bar.prepend(btn('← 返回课程列表',()=>enter(null)));const group=layout.groups.find(g=>g.id===selected);if(group)bar.append(btn('编辑课程与项目',()=>edit(group)));else bar.append(btn('新建课程并归入项目',()=>edit()));}
    const status=document.createElement('span');status.setAttribute('role','status');status.textContent=error||(!ready?'正在加载课程目录…':isRoot?'先选择课程，再查看其中的实训项目。':'项目单独保存与发布；班级关联仍按项目管理。');bar.append(status);
    if(!isRoot)return;
    root.replaceChildren();if(!ready){$('library-count').textContent='—';return;}
    const groups=[...layout.groups,{id:'ungrouped',name:'未归类项目'}].filter(g=>g.name.toLocaleLowerCase().includes(needle.trim().toLocaleLowerCase()));$('library-count').textContent=String(layout.groups.length);
    for(const group of groups){const projects=getProjects().filter(p=>belongs(p.id,group.id));const card=document.createElement('article');card.className='course-folder-card';card.dataset.folder=group.id;const h=document.createElement('h3');h.textContent=group.name;const p=document.createElement('p');p.textContent=projects.length+' 个实训项目';const actions=document.createElement('div');actions.className='actions';const open=btn('进入课程 →',()=>enter(group.id));open.dataset.courseOpen=group.id;if(group.id==='ungrouped')open.textContent='整理未归类项目 →';actions.append(open);if(group.id!=='ungrouped')actions.append(btn('编辑',()=>edit(group)),btn('删除目录',()=>remove(group)));card.append(h,p,actions);root.append(card);}
    if(!groups.length)root.textContent='没有匹配的课程。';
   }
  };
  window.MatinCourseOutline.controller=api;$('new-course-button').onclick=()=>edit();load();return api;
 }};
})();
