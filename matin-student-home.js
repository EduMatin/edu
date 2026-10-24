/* Student home: a view of the existing account-scoped task and membership stores. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const root=document.createElement('section');root.id='student-home';root.hidden=true;root.setAttribute('aria-label','学生首页待办');
 root.innerHTML=`<div class="home-heading"><div><h2>学习待办</h2><p id="home-scope"></p></div><div class="home-heading-actions"><button type="button" class="btn primary" id="home-courses">进入我的课程 →</button><button type="button" class="btn" id="home-refresh">刷新待办</button></div></div>
 <p id="home-status" role="status"></p><div id="home-counts" class="home-counts"></div>
 <div class="home-columns"><section class="home-panel" aria-labelledby="home-todo-title"><div class="home-panel-title"><h3 id="home-todo-title">待完成任务</h3><button type="button" class="home-link" id="home-all-tasks">全部任务与报告 ↗</button></div>
 <div class="home-filters" role="group" aria-label="待办筛选"><button type="button" data-home-filter="soon">未来 7 天</button><button type="button" data-home-filter="overdue">逾期待交</button><button type="button" data-home-filter="all">全部待办</button></div>
 <label class="home-search"><span class="home-sr-only">搜索首页待办</span><input id="home-search" type="search" placeholder="搜索任务、课程或班级…"></label>
 <div id="home-todos"></div><nav class="home-pagination" aria-label="首页待办分页"><span id="home-page-info"></span><button type="button" class="btn tiny" id="home-prev">上一页</button><button type="button" class="btn tiny" id="home-next">下一页</button></nav>
 <p class="home-footnote">时间按当前设备时区显示；逾期仍可补交，提交报告后移出待办。</p></section>
 <div class="home-aside"><section class="home-panel" aria-labelledby="home-continue-title"><h3 id="home-continue-title" tabindex="-1">继续学习</h3><p class="home-footnote">最近打开且尚未提交的班级任务</p><div id="home-continue"></div></section>
 <section class="home-panel" aria-labelledby="home-review-title"><div class="home-panel-title"><h3 id="home-review-title" tabindex="-1">入班审核</h3><button type="button" class="home-link" id="home-classes">管理班级 ↗</button></div><div id="home-reviews"></div><button type="button" class="home-link" id="home-more-reviews" hidden>展开全部班级</button></section></div></div>`;
 document.querySelector('#screen-courses .page-intro').after(root);
 const style=document.createElement('style');style.textContent=`
 #student-home[hidden]{display:none!important}#student-home{margin:0 0 26px;scroll-margin-top:92px}#student-home h2{font-size:23px;margin:0 0 5px}#student-home h3{font-size:17px;margin:0}#student-home p{line-height:1.65}#student-home button{font:inherit}#student-home button:disabled{cursor:not-allowed}
 .home-heading,.home-panel-title{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.home-heading-actions{display:flex;flex-wrap:wrap;gap:10px}.home-heading p{margin:0;color:#71809b;font-size:13px}#home-status{font-size:13px;color:#536b91;margin:10px 0;min-height:21px}#home-status.home-error{color:#944b13}
 .home-counts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:16px 0}.home-counts button{text-align:left;border:1px solid #e0e6f3;border-radius:15px;background:#fff;padding:17px 20px;color:#53647d}.home-counts strong{display:block;font-size:28px;color:#293d6d;margin:5px 0}.home-counts small{display:block;font-size:12px;color:#77859c}.home-counts .home-late{background:#fff8f2;border-color:#f2d5bf}.home-counts .home-late strong{color:#a34716}
 .home-columns{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(290px,1fr);gap:20px;align-items:start}.home-panel{min-width:0;padding:22px;background:#fff;border:1px solid #e1e7f2;border-radius:18px}.home-aside{display:grid;gap:18px}.home-link{border:0;background:transparent;padding:6px 0;color:#465fd1;cursor:pointer;font-size:12px!important;text-align:left;line-height:1.5}.home-link:hover{text-decoration:underline}
 .home-filters{display:flex;gap:6px;flex-wrap:wrap;margin:18px 0 12px}.home-filters button{border:0;background:#f2f5fa;border-radius:9px;color:#64728a;padding:9px 12px;font-size:13px!important}.home-filters [aria-pressed=true]{background:#e9eeff;color:#3c51c5;font-weight:700}.home-search input{width:100%;border:1px solid #dce3f0;border-radius:10px;padding:10px 12px;color:#26395d;background:#fff}
 .home-task-row{padding:17px 0;border-bottom:1px solid #edf0f6;display:flex;align-items:center;gap:15px;justify-content:space-between;overflow-wrap:anywhere}.home-task-copy{min-width:0;flex:1}.home-task-row h4,.home-resume h4,.home-review h4{margin:0 0 5px;font-size:14px;line-height:1.6;color:#263657;overflow-wrap:anywhere}.home-source{font-size:12px;color:#77859c;margin:0 0 6px}.home-due{margin:4px 0 0;font-size:12px;color:#4f617f}.home-due.overdue{color:#a44719;font-weight:600}.home-task-row>.btn{flex-shrink:0;font-size:12px!important}.home-task-row .student-task-change{font-size:12px;margin:8px 0 0;padding:8px 10px}.home-task-row .student-task-change-link{font-size:12px}
 .home-pagination{display:flex;align-items:center;gap:8px;margin-top:16px;font-size:12px;color:#77859c}.home-pagination span{margin-right:auto}.home-footnote{font-size:12px;color:#71809b;margin:12px 0 0}.home-empty{padding:25px 0;font-size:13px;line-height:1.8;color:#72819a}.home-resume{padding:16px 0;border-bottom:1px solid #edf0f6}.home-resume:last-child,.home-review:last-child{border-bottom:0;padding-bottom:0}.home-resume .btn{margin-top:6px}.home-review{padding:15px 0;border-bottom:1px solid #edf0f6;overflow-wrap:anywhere}.home-review p{font-size:12px;color:#71809b;margin:5px 0}.home-review .home-badge{display:inline-block;font-size:12px;padding:3px 8px;border-radius:6px;background:#eef2fb;color:#536d9d}.home-review .approved{background:#e8f7ef;color:#267453}.home-review .rejected,.home-review .removed{background:#fff1e8;color:#9c491c}.home-sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}#home-continue-title,#home-review-title,#course-title{scroll-margin-top:100px}
 @media(max-width:850px){.home-columns{grid-template-columns:1fr}.home-aside{grid-template-columns:1fr 1fr}}@media(max-width:550px){.home-counts{grid-template-columns:1fr 1fr;gap:8px}.home-counts button{padding:13px}.home-counts strong{font-size:25px}.home-aside{grid-template-columns:1fr}.home-panel{padding:16px}.home-task-row{align-items:flex-start;flex-wrap:wrap;gap:8px}.home-task-copy{flex-basis:100%}.home-pagination{flex-wrap:wrap}.home-filters button{padding:9px}.home-heading{align-items:flex-start}}
 `;document.head.append(style);
 let visible=false,refreshHook=async()=>{},refreshing=false,filter='soon',page=1,query='',moreReviews=false,owner='',scope='',initialized=false;
 const pageSize=5,week=7*24*60*60*1000;
 const date=value=>Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('zh-CN',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}):'截止时间待确认';
 const pending=(t,s)=>t.active!==false&&t.status!=='submitted'&&(s.reports_version===1||t.status!=='completed');
 function empty(container,text){container.innerHTML='<p class="home-empty">'+esc(text)+'</p>';}
 function openTask(id){if(!visible||!MatinStudent.mine()||!MatinStudent.signedIn)return;return MatinTasks.openStudent(id);}
 function render(){
  if(!visible||!window.MatinStudent?.signedIn||!MatinStudent.mine()){root.hidden=true;return;}root.hidden=false;
  const nextOwner=MatinStudent.userId,nextScope=MatinStudent.classId||'';
  if(owner!==nextOwner||scope!==nextScope){owner=nextOwner;scope=nextScope;filter='soon';page=1;query='';moreReviews=false;initialized=false;$('home-search').value='';}
  const s=MatinTasks.studentState(),membership=MatinStudent.membershipState(),m=membership.owner&&membership.owner!==nextOwner?{}:membership,now=Date.now(),all=s.tasks.filter(t=>!scope||t.class_id===scope),todo=all.filter(t=>pending(t,s));
  const overdue=todo.filter(t=>Date.parse(t.due_at)<=now),soon=todo.filter(t=>Date.parse(t.due_at)>now&&Date.parse(t.due_at)<=now+week);
  const resumes=todo.filter(t=>t.available&&['started','completed'].includes(t.status)).sort((a,b)=>(Date.parse(b.updated_at)||0)-(Date.parse(a.updated_at)||0)||String(a.id).localeCompare(String(b.id)));
  const classes=m.data?.classes||[],waiting=classes.filter(c=>c.status==='pending').length,taskUnknown=!!s.error||!!s.loading||!s.loadedAt;
  if(!initialized&&!taskUnknown){filter=overdue.length?'overdue':soon.length?'soon':'all';initialized=true;}
  const selected=classes.find(c=>c.id===scope);$('home-scope').textContent=(scope?(selected?.name||'当前班级'):'全部已加入班级')+' · 未来 7 天截止与逾期待交任务';
  const errors=[s.error,m.error].filter(Boolean);$('home-status').classList.toggle('home-error',!!errors.length);
  $('home-status').textContent=errors.join('；')||(refreshing||s.loading||m.loading?'正在同步最新安排…':s.loadedAt?'已同步 · '+new Date(s.loadedAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})+'，可点击“刷新待办”获取最新安排。':'正在加载待办…');
  $('home-refresh').disabled=refreshing||!!s.busy||!!s.loading||!!m.loading;
  const count=(value,unknown)=>unknown?'—':String(value);
  $('home-counts').innerHTML=[['soon','未来 7 天截止',count(soon.length,taskUnknown),'按最近截止时间排列',''],['overdue','逾期待交',count(overdue.length,taskUnknown),'提交报告后移出待办',overdue.length?'home-late':''],['continue','可继续学习',count(resumes.length,taskUnknown),'直接恢复原学习进度',''],['review','入班待审核',count(waiting,!!m.error||m.loading||!m.data),'下方查看审核结果','']].map(([id,title,n,help,cls])=>'<button type="button" data-home-summary="'+id+'" class="'+cls+'"><span>'+title+'</span><strong>'+n+'</strong><small>'+help+'</small></button>').join('');
  root.querySelectorAll('[data-home-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.homeFilter===filter)));
  const term=query.trim().toLocaleLowerCase(),rows=(filter==='soon'?soon:filter==='overdue'?overdue:todo).filter(t=>[t.title,t.course_name,t.class_name,t.project_title].some(x=>String(x||'').toLocaleLowerCase().includes(term))).sort((a,b)=>(Date.parse(a.due_at)||Infinity)-(Date.parse(b.due_at)||Infinity)||String(a.id).localeCompare(String(b.id)));
  const pages=Math.max(1,Math.ceil(rows.length/pageSize));page=Math.min(page,pages);
  const focused=document.activeElement,focusKey=root.contains(focused)?focused.dataset.homeTask:null,focusRegion=focused.closest('#home-todos,#home-continue');
  const list=$('home-todos');list.replaceChildren();
  if(s.error||s.loading||!s.loadedAt)empty(list,s.error?'任务暂时无法读取，请刷新重试。': '正在读取任务…');
  else if(!rows.length)empty(list,term?'没有匹配的任务，试试其他关键词。':filter==='soon'?'未来 7 天暂无到期任务，可查看“全部待办”。':filter==='overdue'?'暂无逾期待交任务。':todo.length?'暂无匹配任务。':'当前没有待完成任务。已提交报告可在“全部任务与报告”查看。');
  else for(const t of rows.slice((page-1)*pageSize,page*pageSize)){
   const row=document.createElement('article');row.className='home-task-row';row.dataset.homeTaskId=t.id;
   const late=Date.parse(t.due_at)<=now;
   row.innerHTML='<div class="home-task-copy"><h4>'+esc(t.title)+'</h4><p class="home-source">'+esc([t.course_name,t.class_name].filter(Boolean).join(' · '))+'</p><p class="home-due'+(late?' overdue':'')+'">'+esc(date(t.due_at))+' 截止 · '+(late?'逾期未交':t.status==='pending'?'待开始':'待提交报告')+'</p></div>';
   const notice=MatinTasks.studentChangeNotice(t);if(notice)row.firstChild.append(notice);
   if(t.available){const b=document.createElement('button');b.type='button';b.className='btn tiny';b.textContent=t.status==='pending'?'开始学习':'继续学习';b.dataset.homeTask=t.id;b.disabled=!!s.busy;b.onclick=()=>openTask(t.id);row.append(b);}
   else{const note=document.createElement('p');note.className='home-footnote';note.textContent='项目暂不可用，请联系教师';row.append(note);}list.append(row);
  }
  $('home-page-info').textContent=taskUnknown?'任务状态待同步':'共 '+rows.length+' 项 · '+page+' / '+pages+' 页';$('home-prev').disabled=taskUnknown||page===1;$('home-next').disabled=taskUnknown||page===pages;
  const continuation=$('home-continue');continuation.replaceChildren();
  if(taskUnknown)empty(continuation,s.error?'任务读取失败，暂不能确认可继续的任务。':'正在读取学习进度…');
  else if(!resumes.length)empty(continuation,'还没有进行中的班级任务。开始学习后，可从这里继续。');
  else for(const t of resumes.slice(0,3)){const card=document.createElement('article');card.className='home-resume';card.innerHTML='<h4>'+esc(t.title)+'</h4><p class="home-source">'+esc([t.course_name,t.class_name].filter(Boolean).join(' · '))+'</p><p class="home-due'+(Date.parse(t.due_at)<=now?' overdue':'')+'">'+esc(date(t.due_at))+' 截止'+(Date.parse(t.due_at)<=now?' · 逾期未交':'')+'</p>';const b=document.createElement('button');b.type='button';b.className='btn primary tiny';b.textContent='继续学习';b.dataset.homeTask=t.id;b.disabled=!!s.busy;b.onclick=()=>openTask(t.id);card.append(b);continuation.append(card);}
  if(resumes.length>3){const hint=document.createElement('p');hint.className='home-footnote';hint.textContent='显示最近 3 项，其余可在全部待办中查看。';continuation.append(hint);}
  const reviews=$('home-reviews');reviews.replaceChildren();const priority={rejected:0,removed:1,pending:2,approved:3,left:4};const ordered=classes.slice().sort((a,b)=>(priority[a.status]??5)-(priority[b.status]??5));
  $('home-more-reviews').hidden=ordered.length<=3||!!m.error||m.loading;
  $('home-more-reviews').textContent=moreReviews?'收起班级列表':'展开全部 '+ordered.length+' 个班级';
  if(m.error)empty(reviews,m.error+'。请点击“刷新待办”重试。');else if(m.loading||!m.data)empty(reviews,'正在读取审核状态…');
  else if(m.data.is_teacher)empty(reviews,'当前为教师账号，请使用学生账号查看入班审核。');
  else if(!ordered.length)empty(reviews,'尚未加入班级。点击“管理班级”，输入教师提供的入班码；导入名单的学生请使用名单邮箱验证并登录。');
  else for(const c of ordered.slice(0,moreReviews?ordered.length:3)){
   const labels={approved:['已通过 · 已加入','可以查看本班课程与任务。'],pending:['待教师审核','教师通过后，任务会出现在首页。'],rejected:['申请未通过','请联系教师核对姓名、学号及班级。'],removed:['已被移出班级','当前无法学习本班任务，如有疑问请联系教师。'],left:['已退出 / 已撤回','如需重新加入，请向教师确认入班码。']},label=labels[c.status]||['状态待确认','请刷新或联系教师。'];
   const card=document.createElement('article');card.className='home-review';card.innerHTML='<h4>'+esc(c.name)+'</h4><span class="home-badge '+esc(c.status)+'">'+label[0]+'</span><p>'+label[1]+'</p>';
   if(c.status==='approved'){const b=document.createElement('button');b.type='button';b.className='home-link';b.textContent='查看本班课程';b.onclick=()=>MatinStudent.viewClass(c.id);card.append(b);}reviews.append(card);
  }
  if(focusKey){const target=(focusRegion||root).querySelector('[data-home-task="'+CSS.escape(focusKey)+'"]');target?.focus({preventScroll:true});}
 }
 async function refresh(){if(refreshing||MatinTasks.studentState().busy)return;refreshing=true;render();try{await refreshHook();}finally{refreshing=false;render();}}
 function choose(value){filter=value;page=1;render();}
 root.addEventListener('click',e=>{const tab=e.target.closest('[data-home-filter]');if(tab)choose(tab.dataset.homeFilter);const summary=e.target.closest('[data-home-summary]');if(!summary)return;const value=summary.dataset.homeSummary;if(['soon','overdue'].includes(value)){choose(value);$('home-todo-title').scrollIntoView({block:'start'});}else{const target=$(value==='continue'?'home-continue-title':'home-review-title');target.focus();target.scrollIntoView({block:'start'});}});
 $('home-search').oninput=e=>{query=e.target.value;page=1;render();};$('home-prev').onclick=()=>{page--;render();};$('home-next').onclick=()=>{page++;render();};
 $('home-refresh').onclick=refresh;$('home-courses').onclick=()=>MatinStudent.navigate('courses');$('home-all-tasks').onclick=()=>MatinTasks.open();$('home-classes').onclick=()=>MatinStudent.openClasses();$('home-more-reviews').onclick=()=>{moreReviews=!moreReviews;render();};
 for(const event of ['matin-student-tasks-changed','matin-student-membership-changed'])window.addEventListener(event,render);
 // Reclassify deadlines locally; returning to a visible home refreshes stale server data.
 setInterval(()=>{if(!document.hidden&&!root.hidden&&$('screen-runtime').classList.contains('hidden'))render();},60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!root.hidden&&$('screen-runtime').classList.contains('hidden')&&!document.querySelector('.modal-layer:not(.hidden)')&&Date.now()-(MatinTasks.studentState().loadedAt||0)>60000)refresh();});
 window.MatinStudentHome={setView(value){visible=!!value;render();},configure(options){refreshHook=options.refresh;}};
})();
