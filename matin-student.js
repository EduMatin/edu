/* Student identity and enrollment UI. Privileges are checked by PostgreSQL, never user metadata. */
(() => {
 'use strict';
 const cfg=window.MATIN_CLOUD||{},base=String(cfg.supabaseUrl||'').replace(/\/+$/,''),key='matin_student_session_v1:'+base;
 let session=null,refreshing=null,state=null,hook=()=>{},classId=null,startupError='';
 let classBusy=false,navigationRevision=0;
 let view='home',joinDirty=false,classPage=1,classQuery='',classFilter='all';
 const views=['home','courses','tasks','classes'];
 let membership={owner:'',data:null,error:'',loading:false},membershipPromise=null,membershipOwner='';
 const membershipState=()=>membership.owner===session?.user?.id?membership:{data:null,error:'',loading:false};
 const membershipChanged=()=>window.dispatchEvent(new CustomEvent('matin-student-membership-changed'));
 const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const names={pending:'待教师审核',approved:'已加入',rejected:'申请未通过',removed:'已被移出',left:'已退出 / 已撤回'};
 function persist(v){session=v;try{v?sessionStorage.setItem(key,JSON.stringify(v)):sessionStorage.removeItem(key);}catch{}window.dispatchEvent(new CustomEvent('matin-student-auth-changed'));}
 async function auth(path,body,access,method){
  const r=await fetch(base+'/auth/v1/'+path,{method:method||(body?'POST':'GET'),headers:{apikey:cfg.publishableKey,'Content-Type':'application/json',...(access?{Authorization:'Bearer '+access}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok){let message=r.status===429?'请求较多，请稍后再试':path.startsWith('signup')?'注册未完成，请检查邮箱、密码要求或联系教师确认注册服务':r.status===400||r.status===401?'邮箱或密码不正确，或邮箱尚未确认':'账号服务暂不可用，请稍后重试';
   if(r.status!==429&&/^(recover|resend)/.test(path))message='邮件发送未完成，请检查邮箱地址后重试；若持续失败，请联系教师检查邮件服务。';
   if(method==='PUT')message=data.code==='same_password'?'新密码不能与原密码相同。':data.code==='weak_password'?'新密码不符合要求，请使用更长、更复杂的密码。':r.status===401||r.status===403?'重置会话已失效，请取消并重新发送重置密码邮件。':'密码更新未完成，请检查密码要求或重新发送重置邮件后再试。';
   const error=Error(message);error.status=r.status;throw error;
  }
  return data;
 }
 function adopt(d){if(!d.access_token||!d.refresh_token||!d.user?.id)throw Error('登录响应不完整');persist({...d,expires_at:d.expires_at||Date.now()/1000+(d.expires_in||3600)});}
 async function token(){if(!session)throw Error('请先登录学生账号');if(session.expires_at*1000<Date.now()+60000){if(!refreshing)refreshing=auth('token?grant_type=refresh_token',{refresh_token:session.refresh_token}).then(adopt).finally(()=>refreshing=null);await refreshing;}return session.access_token;}
 async function api(op,data={},action='membership'){
  const r=await fetch(base+'/functions/v1/matin-courses',{method:'POST',headers:{'Content-Type':'application/json',apikey:cfg.publishableKey,Authorization:'Bearer '+await token()},body:JSON.stringify({action,op,data}),signal:AbortSignal.timeout(25000)});
  const out=await r.json().catch(()=>({}));if(!r.ok||!out.ok){if(r.status===401){persist(null);location.replace(location.pathname+'#my');location.reload();}const error=Error(out.error||'班级服务暂不可用');error.status=r.status;error.code=out.code;throw error;}return out;
 }
 function mine(){return !new URLSearchParams(location.hash.slice(1)).has('teacher')&&!new URLSearchParams(location.hash.slice(1)).has('course');}
 function updateNavigation(){for(const [id,page] of [['student-home-open','home'],['student-my-courses','courses'],['student-my-tasks','tasks'],['student-my-classes','classes']]){const b=$(id);if(!b)continue;if(session&&mine()&&view===page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}}
 function selectView(section){navigationRevision++;view=views.includes(section)?section:'home';if(mine())history.replaceState(null,'',location.pathname+location.search+'#my'+(view==='home'?'':'&view='+view));updateNavigation();}
 async function changeView(section='home'){if(!session&&['tasks','classes'].includes(section))return showLogin();if(!mine()){location.hash='my'+(section==='home'?'':'&view='+section);return;}classId=null;selectView(section);await hook({navigate:true,refreshMembership:!!session});}
 function openClasses(){return changeView('classes');}
 async function viewClass(id,section='courses'){if(!membershipState().data?.classes.some(c=>c.id===id&&c.status==='approved'))return;if(!mine()){location.hash='my&view=courses';return;}classId=id;selectView(section);await hook({navigate:true});}
 function showLogin(){ $('student-auth-modal').classList.remove('hidden');$('student-auth-status').textContent='';$('student-email').focus(); }
 function build(){
  const style=document.createElement('style');style.textContent=`#student-bar{padding:12px 24px;background:#eef2ff;display:flex;align-items:center;flex-wrap:wrap;gap:10px}#student-bar span{margin-right:auto;overflow-wrap:anywhere}#student-classes{margin:0;padding:0;border:0;background:transparent}#student-classes input{padding:10px;border:1px solid #ccd5e7;border-radius:10px;max-width:100%;width:100%}#student-join-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}#student-join-form label{display:grid;gap:6px}#student-class-list article{border:1px solid #dce3f1}#student-class-list p{overflow-wrap:anywhere}#student-auth-status,#student-class-status{color:#75502e;line-height:1.7}#student-auth-form .modal-footer{justify-content:space-between}@media(max-width:650px){#student-join-form{grid-template-columns:1fr}#student-bar{padding:10px 12px}}`;
  document.head.append(style);
  style.textContent+='#student-bar .btn[aria-current="page"]{background:#435be2;border-color:#435be2;color:white;box-shadow:0 4px 12px #435be220}#student-bar .btn{white-space:nowrap}@media(max-width:650px){#student-bar{gap:7px}#student-bar>span{width:100%;font-size:12px}#student-bar .btn{font-size:12px;padding:8px 10px}}';
  const bar=document.createElement('nav');bar.id='student-bar';bar.setAttribute('aria-label','学生账号与班级');document.querySelector('header').after(bar);
  const panel=document.createElement('section');panel.id='student-classes';panel.className='hidden';panel.innerHTML=`<div class="student-section-heading"><div><h2>班级与审核</h2><p id="student-class-summary"></p></div><div class="student-page-actions"><button type="button" class="btn" id="student-class-refresh">刷新审核状态</button><button type="button" class="btn primary" id="student-add-class">加入新班级</button></div></div>
  <div class="student-page-filters"><label>搜索班级<input id="student-class-search" type="search" placeholder="班级名称、专业、年级…"></label><label>入班状态<select id="student-class-filter"><option value="all">全部状态</option><option value="approved">已加入</option><option value="pending">待审核</option><option value="history">未通过 / 已退出</option></select></label></div>
  <p id="student-class-status" role="status"></p><div id="student-class-list"></div><nav class="student-page-pagination" aria-label="班级分页"><span id="student-class-page"></span><button type="button" class="btn tiny" id="student-class-prev">上一页</button><button type="button" class="btn tiny" id="student-class-next">下一页</button></nav>
  <details id="student-join-panel"><summary>申请加入新班级</summary><p>输入教师提供的入班码，提交后等待教师确认。教师已导入名单的学生，验证名单中的邮箱后刷新即可关联。入班码与 AI 课堂访问码不同。</p><form id="student-join-form"><label>姓名<input id="student-name" maxlength="60" required autocomplete="name"></label><label>学号<input id="student-number" maxlength="60" required></label><label>入班码<input id="student-join-code" minlength="32" maxlength="32" required autocomplete="off" placeholder="向班级教师索取"></label><button class="btn primary" id="student-join" type="submit">申请加入班级</button></form><p id="student-join-status" role="status"></p></details>`;
  document.querySelector('#screen-courses .page-intro').after(panel);
  const modal=document.createElement('div');modal.id='student-auth-modal';modal.className='modal-layer hidden';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','student-auth-title');modal.innerHTML=`<form class="modal" id="student-auth-form"><h2 id="student-auth-title">学生登录 / 注册</h2><p>审核通过后，即可在“我的课程”查看班级授课内容。教师账号仍由管理员授权。</p><div class="field"><label for="student-email">邮箱</label><input id="student-email" type="email" required autocomplete="username"></div><div class="field"><label for="student-password">密码（注册至少8位）</label><input id="student-password" type="password" required autocomplete="current-password"></div><p id="student-auth-status" role="status"></p><div class="modal-footer"><button class="btn" type="button" id="student-auth-close">取消</button><button class="btn" type="submit" name="mode" value="signup">注册学生账号</button><button class="btn primary" type="submit" name="mode" value="login">登录</button></div><p>注册后请先完成邮箱验证再登录。未收到邮件或忘记密码，可使用下方入口。</p></form>`;document.body.append(modal);
  $('student-auth-close').onclick=()=>modal.classList.add('hidden');modal.addEventListener('keydown',e=>{if(e.key==='Escape')modal.classList.add('hidden');});
  $('student-auth-form').onsubmit=async e=>{e.preventDefault();const mode=e.submitter?.value||'login',email=$('student-email').value.trim(),password=$('student-password').value;
   if(mode==='signup'&&password.length<8){$('student-auth-status').textContent='注册密码至少8位';return;}
   const buttons=[...modal.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);$('student-auth-status').textContent='正在处理…';
   try{const d=await auth(mode==='signup'?'signup?redirect_to='+encodeURIComponent(location.origin+location.pathname):'token?grant_type=password',{email,password});$('student-password').value='';
    if(d.access_token){adopt(d);location.replace(location.pathname+'#my');location.reload();}else $('student-auth-status').textContent='请检查邮箱并完成确认后登录。如果未收到邮件，请稍后重试或联系管理员。';
   }catch(err){$('student-auth-status').textContent=err.message;}finally{buttons.forEach(b=>b.disabled=false);}
  };
  window.MatinStudentAccount?.install({auth,api,refresh,showLogin,getUser:()=>session?.user});
  $('student-join-form').onsubmit=async e=>{e.preventDefault();await task(async()=>{const r=await api('join',{code:$('student-join-code').value.trim().toLowerCase(),display_name:$('student-name').value.trim(),student_no:$('student-number').value.trim()});$('student-join-code').value='';joinDirty=false;await refresh();return r.status==='approved'?'你已是此班级成员':'申请已提交，等待教师审核。';});};
  $('student-class-refresh').onclick=()=>task(async()=>{await refresh();hook();return '审核状态已刷新';});
  $('student-join-form').addEventListener('input',()=>joinDirty=true);
  $('student-add-class').onclick=()=>{$('student-join-panel').open=true;$('student-join-panel').scrollIntoView({block:'nearest'});$('student-name').focus();};
  $('student-class-search').oninput=e=>{classQuery=e.target.value;classPage=1;renderClasses();};
  $('student-class-filter').onchange=e=>{classFilter=e.target.value;classPage=1;renderClasses();};
  for(const [id,step] of [['student-class-prev',-1],['student-class-next',1]])$(id).onclick=()=>{classPage+=step;renderClasses();$('student-class-list').scrollIntoView({block:'start'});};
 }
 function renderBar(){
  const bar=$('student-bar');bar.replaceChildren();const label=document.createElement('span');label.textContent=startupError|| (session?'当前账号：'+session.user.email:'登录后申请加入班级，查看我的课程');bar.append(label);
  function btn(text,id,fn){const b=document.createElement('button');b.className='btn tiny';b.id=id;b.textContent=text;b.onclick=fn;bar.append(b);}
  btn('学习首页','student-home-open',()=>changeView());
  btn('我的课程','student-my-courses',()=>changeView('courses'));
  btn('我的任务','student-my-tasks',()=>changeView('tasks'));
  btn('我的班级','student-my-classes',openClasses);
  if(session&&window.MatinStudentAccount)btn('个人资料','student-profile-open',()=>MatinStudentAccount.openProfile());
  if(!session)btn('登录 / 注册','student-login-open',showLogin);
  else btn('退出账号','student-logout',async()=>{if(window.MatinLearningSync?.hasPending()&&!await MatinLearningSync.flush()&&!confirm('学习记录尚未同步云端，本机副本已保留。仍要退出账号吗？'))return;const access=session.access_token;persist(null);document.querySelector('main').classList.add('hidden');try{await fetch(base+'/auth/v1/logout',{method:'POST',headers:{apikey:cfg.publishableKey,Authorization:'Bearer '+access},signal:AbortSignal.timeout(5000)});}catch{}location.replace(location.pathname+'#my');location.reload();});
  updateNavigation();window.dispatchEvent(new CustomEvent('matin-student-navigation-rendered'));
 }
 async function task(fn){if(classBusy)return;classBusy=true;const panel=$('student-classes');panel.querySelectorAll('button,input,select').forEach(x=>x.disabled=true);$('student-class-status').textContent='正在处理…';try{$('student-class-status').textContent=await fn();}catch(e){$('student-class-status').textContent=e.message;}finally{classBusy=false;panel.querySelectorAll('button,input,select').forEach(x=>x.disabled=false);$('student-join-status').textContent=$('student-class-status').textContent;renderClasses();}}
 function refresh(){
  const owner=session?.user?.id;if(!owner)return Promise.resolve(null);
  if(membershipPromise&&membershipOwner===owner)return membershipPromise;
  membershipOwner=owner;membership={owner,data:membershipState().data,error:'',loading:true};renderClasses();membershipChanged();
  const promise=(async()=>{try{
   const data=await api('me');if(owner!==session?.user?.id)return null;
   if(!Array.isArray(data.classes))throw Error('班级数据不完整，请刷新重试');
   state=data;membership={owner,data,error:'',loading:false};renderClasses();return data;
  }catch(e){if(owner===session?.user?.id)membership={owner,data:null,error:'审核状态读取失败：'+e.message,loading:false};throw e;
  }finally{if(owner===session?.user?.id){renderClasses();membershipChanged();}if(membershipPromise===promise)membershipPromise=null;}})();
  membershipPromise=promise;return promise;
 }
 function renderClasses(){
  const m=membershipState(),data=m.data;
  const list=$('student-class-list');if(!list)return;list.replaceChildren();
  const all=data?.classes||[],term=classQuery.trim().toLocaleLowerCase();
  $('student-class-summary').textContent=m.error?'审核状态暂不可用':m.loading?'正在同步班级…':all.filter(c=>c.status==='approved').length+' 个已加入 · '+all.filter(c=>c.status==='pending').length+' 个待审核';
  $('student-class-refresh').disabled=!!m.loading||classBusy;
  if(data&&!joinDirty){$('student-name').value=data.profile?.display_name||'';$('student-number').value=data.profile?.student_no||'';}
  $('student-join-panel').hidden=!!data?.is_teacher;$('student-add-class').hidden=!!data?.is_teacher;
  if(data&&!all.length&&!term&&classFilter==='all')$('student-join-panel').open=true;
  const rows=all.filter(c=>(classFilter==='all'||classFilter==='history'&&!['approved','pending'].includes(c.status)||c.status===classFilter)&&[c.name,c.major,c.grade].some(v=>String(v||'').toLocaleLowerCase().includes(term)));
  const pages=Math.max(1,Math.ceil(rows.length/6));classPage=Math.max(1,Math.min(classPage,pages));
  $('student-class-page').textContent=m.error||m.loading?'—':'共 '+rows.length+' 个班级 · '+classPage+' / '+pages+' 页';
  $('student-class-prev').disabled=classBusy||m.loading||!!m.error||classPage<=1;$('student-class-next').disabled=classBusy||m.loading||!!m.error||classPage>=pages;
  if(m.error||m.loading||!data||data.is_teacher||!rows.length){list.innerHTML='<p class="student-page-empty"></p>';list.firstChild.textContent=m.error|| (m.loading||!data?'正在读取班级…':data.is_teacher?'当前是教师账号。请使用单独的学生账号测试入班审核。':all.length?'没有匹配的班级，请调整搜索或状态。':'尚未加入班级，可使用下方表单申请；教师已导入名单时请先确认邮箱并刷新。');return;}
  const hints={pending:'教师审核后即可查看班级课程和任务。',rejected:'请核对入班资料，联系教师后可重新申请。',removed:'已失去此班级的课程和任务权限，如需恢复请联系教师。',left:'如需再次加入，请向教师确认入班码。'};
  for(const c of rows.slice((classPage-1)*6,classPage*6)){
   const card=document.createElement('article');card.dataset.classId=c.id;
   card.innerHTML='<span class="student-class-badge '+(c.status==='approved'?'approved':c.status==='pending'?'pending':'')+'">'+esc(c.class_ended_at?'已结束教学 · 只读':names[c.status]||'状态待确认')+'</span><h3>'+esc(c.name)+'</h3><p>'+esc([c.major,c.grade].filter(Boolean).join(' · '))+'</p><p>'+esc([c.display_name,c.student_no].filter(Boolean).join(' / '))+'</p>';
   if(hints[c.status]||c.class_ended_at){const hint=document.createElement('p');hint.textContent=c.class_ended_at?'教学已结束，班级资料与学习记录保留为只读档案。':hints[c.status];card.append(hint);}
   const actions=document.createElement('div');actions.className='student-page-actions';
   if(c.status==='approved'){for(const [label,section] of [['查看班级课程','courses'],['查看班级任务','tasks']]){const b=document.createElement('button');b.type='button';b.className='btn tiny'+(section==='courses'?' primary':'');b.textContent=c.class_ended_at&&section==='tasks'?'查看任务档案':label;b.onclick=()=>viewClass(c.id,section);actions.append(b);}}
   if(!c.class_ended_at&&['approved','pending'].includes(c.status)){const b=document.createElement('button');b.type='button';b.className='btn tiny student-leave';b.textContent=c.status==='pending'?'撤回申请':'退出班级';b.onclick=()=>{if(!confirm(c.status==='pending'?'撤回此入班申请？':'退出后将失去该班级课程入口，确认退出？'))return;task(async()=>{await api('leave',{class_id:c.id,revision:Number(c.revision)});await refresh();hook();return '已更新班级状态';});};actions.append(b);}
   actions.querySelectorAll('button').forEach(b=>b.disabled=classBusy);card.append(actions);list.append(card);
  }
 }
 async function ready(onChange){hook=onChange;if(!base)return;build();
  try{
   const params=new URLSearchParams(location.hash.slice(1));
   view=views.includes(params.get('view'))?params.get('view'):'home';
   if(params.has('error')){history.replaceState(null,'',location.pathname+'#my');persist(null);window.MatinStudentAccount?.clearRecovery();throw Error('邮件链接无效或已过期，请重新发送验证邮件或重置密码邮件。');}
   if(params.has('access_token')&&params.get('type')==='recovery'){
    const access=params.get('access_token'),refreshToken=params.get('refresh_token'),expiresIn=Number(params.get('expires_in')||3600);
    history.replaceState(null,'',location.pathname+'#my');persist(null);renderBar();
    if(window.MatinStudentAccount)await MatinStudentAccount.beginRecovery({access_token:access,refresh_token:refreshToken,expires_at:Date.now()/1000+expiresIn});
    else startupError='请更新账号自助服务文件后重新打开重置邮件。';
    return;
   }
   if(!params.has('access_token')&&window.MatinStudentAccount?.hasRecovery()){persist(null);renderBar();await MatinStudentAccount.beginRecovery();return;}
   if(params.has('access_token')){const access=params.get('access_token'),refreshToken=params.get('refresh_token');history.replaceState(null,'',location.pathname+'#my');window.MatinStudentAccount?.clearRecovery();const user=await auth('user',null,access);adopt({access_token:access,refresh_token:refreshToken,user,expires_in:Number(params.get('expires_in')||3600)});}
   else session=JSON.parse(sessionStorage.getItem(key)||'null');
   if(session){const user=await auth('user',null,await token());if(user.id!==session.user.id)throw Error('会话不匹配');session.user=user;}
  }catch(e){persist(null);startupError=e.message;}
  if(session){try{await refresh();}catch(e){startupError='班级服务加载失败：'+e.message;}}
  renderBar();
 }
 // Prevent browser back/forward cache from reviving another student's rendered conversations.
 window.addEventListener('pagehide',()=>{if(base)document.querySelector('main').classList.add('hidden');});
 window.addEventListener('pageshow',e=>{if(base&&e.persisted)location.reload();});
 window.MatinStudent={ready,api,taskApi:(op,data)=>api(op,data,'tasks'),mine,membershipState,refreshMembership:refresh,openClasses,viewClass,navigate:changeView,get navigationRevision(){return navigationRevision;},get view(){return view;},get userId(){return session?.user?.id||'guest';},get signedIn(){return !!session;},get classId(){return classId;}};
})();
