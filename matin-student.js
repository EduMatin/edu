/* Student identity and enrollment UI. Privileges are checked by PostgreSQL, never user metadata. */
(() => {
 'use strict';
 const cfg=window.MATIN_CLOUD||{},base=String(cfg.supabaseUrl||'').replace(/\/+$/,''),key='matin_student_session_v1:'+base;
 let session=null,refreshing=null,state=null,hook=()=>{},classId=null,startupError='';
 let membership={owner:'',data:null,error:'',loading:false},membershipPromise=null,membershipOwner='';
 const membershipState=()=>membership.owner===session?.user?.id?membership:{data:null,error:'',loading:false};
 const membershipChanged=()=>window.dispatchEvent(new CustomEvent('matin-student-membership-changed'));
 const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const names={pending:'待教师审核',approved:'已加入',rejected:'申请未通过',removed:'已被移出',left:'已退出 / 已撤回'};
 function persist(v){session=v;try{v?sessionStorage.setItem(key,JSON.stringify(v)):sessionStorage.removeItem(key);}catch{}}
 async function auth(path,body,access){
  const r=await fetch(base+'/auth/v1/'+path,{method:body?'POST':'GET',headers:{apikey:cfg.publishableKey,'Content-Type':'application/json',...(access?{Authorization:'Bearer '+access}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(r.status===429?'请求较多，请稍后再试':path.startsWith('signup')?'注册未完成，请检查邮箱、密码要求或联系教师确认注册服务':r.status===400||r.status===401?'邮箱或密码不正确，或邮箱尚未确认':'登录服务暂不可用，请稍后重试');
  return data;
 }
 function adopt(d){if(!d.access_token||!d.refresh_token||!d.user?.id)throw Error('登录响应不完整');persist({...d,expires_at:d.expires_at||Date.now()/1000+(d.expires_in||3600)});}
 async function token(){if(!session)throw Error('请先登录学生账号');if(session.expires_at*1000<Date.now()+60000){if(!refreshing)refreshing=auth('token?grant_type=refresh_token',{refresh_token:session.refresh_token}).then(adopt).finally(()=>refreshing=null);await refreshing;}return session.access_token;}
 async function api(op,data={},action='membership'){
  const r=await fetch(base+'/functions/v1/matin-courses',{method:'POST',headers:{'Content-Type':'application/json',apikey:cfg.publishableKey,Authorization:'Bearer '+await token()},body:JSON.stringify({action,op,data}),signal:AbortSignal.timeout(25000)});
  const out=await r.json().catch(()=>({}));if(!r.ok||!out.ok){if(r.status===401){persist(null);location.replace(location.pathname+'#my');location.reload();}const error=Error(out.error||'班级服务暂不可用');error.status=r.status;throw error;}return out;
 }
 function mine(){return !new URLSearchParams(location.hash.slice(1)).has('teacher')&&!new URLSearchParams(location.hash.slice(1)).has('course');}
 async function changeView(section='home'){$('student-classes').classList.add('hidden');if(!mine()){location.hash='my';return;}classId=null;if(session)await refresh().catch(()=>{});await hook();if(section==='courses')$('course-title').scrollIntoView({block:'start'});}
 function openClasses(){if(!session)return showLogin();$('student-classes').classList.remove('hidden');$('student-classes').scrollIntoView({block:'start'});return task(async()=>{await refresh();return '';});}
 async function viewClass(id){if(!membershipState().data?.classes.some(c=>c.id===id&&c.status==='approved'))return;if(!mine()){location.hash='my';return;}classId=id;$('student-classes').classList.add('hidden');await hook();}
 function showLogin(){ $('student-auth-modal').classList.remove('hidden');$('student-auth-status').textContent='';$('student-email').focus(); }
 function build(){
  const style=document.createElement('style');style.textContent=`#student-bar{padding:12px 24px;background:#eef2ff;display:flex;align-items:center;flex-wrap:wrap;gap:10px}#student-bar span{margin-right:auto;overflow-wrap:anywhere}#student-classes{margin:18px 0;padding:20px;background:white;border:1px solid #dce3f1;border-radius:18px}#student-classes input{padding:10px;border:1px solid #ccd5e7;border-radius:10px;max-width:100%;width:100%}#student-join-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}#student-join-form label{display:grid;gap:6px}#student-class-list article{padding:15px;margin:10px 0;border:1px solid #dce3f1;border-radius:12px}#student-class-list p{overflow-wrap:anywhere}#student-auth-status,#student-class-status{color:#75502e;line-height:1.7}#student-auth-form .modal-footer{justify-content:space-between}@media(max-width:650px){#student-join-form{grid-template-columns:1fr}#student-bar{padding:10px 12px}}`;
  document.head.append(style);
  const bar=document.createElement('nav');bar.id='student-bar';bar.setAttribute('aria-label','学生账号与班级');document.querySelector('header').after(bar);
  const panel=document.createElement('section');panel.id='student-classes';panel.className='hidden';panel.innerHTML=`<h2>我的班级</h2><p>输入教师提供的入班码，提交后等待教师确认。入班码与 AI 课堂访问码不同。</p><form id="student-join-form"><label>姓名<input id="student-name" maxlength="60" required autocomplete="name"></label><label>学号<input id="student-number" maxlength="60" required></label><label>入班码<input id="student-join-code" minlength="32" maxlength="32" required autocomplete="off" placeholder="向班级教师索取"></label><button class="btn primary" id="student-join" type="submit">申请加入班级</button></form><p id="student-class-status" role="status"></p><button class="btn" id="student-class-refresh">刷新审核状态</button><div id="student-class-list"></div>`;
  document.querySelector('main').prepend(panel);
  const modal=document.createElement('div');modal.id='student-auth-modal';modal.className='modal-layer hidden';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','student-auth-title');modal.innerHTML=`<form class="modal" id="student-auth-form"><h2 id="student-auth-title">学生登录 / 注册</h2><p>审核通过后，即可在“我的课程”查看班级授课内容。教师账号仍由管理员授权。</p><div class="field"><label for="student-email">邮箱</label><input id="student-email" type="email" required autocomplete="username"></div><div class="field"><label for="student-password">密码（注册至少8位）</label><input id="student-password" type="password" required autocomplete="current-password"></div><p id="student-auth-status" role="status"></p><div class="modal-footer"><button class="btn" type="button" id="student-auth-close">取消</button><button class="btn" type="submit" name="mode" value="signup">注册学生账号</button><button class="btn primary" type="submit" name="mode" value="login">登录</button></div><p>忘记密码请联系项目管理员重设。注册后若要求确认邮箱，请先完成邮件确认再登录。</p></form>`;document.body.append(modal);
  $('student-auth-close').onclick=()=>modal.classList.add('hidden');modal.addEventListener('keydown',e=>{if(e.key==='Escape')modal.classList.add('hidden');});
  $('student-auth-form').onsubmit=async e=>{e.preventDefault();const mode=e.submitter?.value||'login',email=$('student-email').value.trim(),password=$('student-password').value;
   if(mode==='signup'&&password.length<8){$('student-auth-status').textContent='注册密码至少8位';return;}
   const buttons=[...modal.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);$('student-auth-status').textContent='正在处理…';
   try{const d=await auth(mode==='signup'?'signup?redirect_to='+encodeURIComponent(location.origin+location.pathname):'token?grant_type=password',{email,password});$('student-password').value='';
    if(d.access_token){adopt(d);location.replace(location.pathname+'#my');location.reload();}else $('student-auth-status').textContent='请检查邮箱并完成确认后登录。如果未收到邮件，请稍后重试或联系管理员。';
   }catch(err){$('student-auth-status').textContent=err.message;}finally{buttons.forEach(b=>b.disabled=false);}
  };
  $('student-join-form').onsubmit=async e=>{e.preventDefault();await task(async()=>{const r=await api('join',{code:$('student-join-code').value.trim().toLowerCase(),display_name:$('student-name').value.trim(),student_no:$('student-number').value.trim()});$('student-join-code').value='';await refresh();return r.status==='approved'?'你已是此班级成员':'申请已提交，等待教师审核。';});};
  $('student-class-refresh').onclick=()=>task(async()=>{await refresh();hook();return '审核状态已刷新';});
 }
 function renderBar(){
  const bar=$('student-bar');bar.replaceChildren();const label=document.createElement('span');label.textContent=startupError|| (session?'当前账号：'+session.user.email:'登录后申请加入班级，查看我的课程');bar.append(label);
  function btn(text,id,fn){const b=document.createElement('button');b.className='btn tiny';b.id=id;b.textContent=text;b.onclick=fn;bar.append(b);}
  btn('学习首页','student-home-open',()=>changeView());
  btn('我的课程','student-my-courses',()=>changeView('courses'));
  btn('我的任务','student-my-tasks',()=>session?window.MatinTasks.open():showLogin());
  btn('我的班级','student-my-classes',()=>{if(!session)return showLogin();$('student-classes').classList.toggle('hidden');if(!$('student-classes').classList.contains('hidden'))task(async()=>{await refresh();return '';});});
  if(!session)btn('登录 / 注册','student-login-open',showLogin);
  else btn('退出账号','student-logout',async()=>{if(window.MatinLearningSync?.hasPending()&&!await MatinLearningSync.flush()&&!confirm('学习记录尚未同步云端，本机副本已保留。仍要退出账号吗？'))return;const access=session.access_token;persist(null);document.querySelector('main').classList.add('hidden');try{await fetch(base+'/auth/v1/logout',{method:'POST',headers:{apikey:cfg.publishableKey,Authorization:'Bearer '+access},signal:AbortSignal.timeout(5000)});}catch{}location.replace(location.pathname+'#my');location.reload();});
 }
 async function task(fn){const panel=$('student-classes');panel.querySelectorAll('button,input').forEach(x=>x.disabled=true);$('student-class-status').textContent='正在处理…';try{$('student-class-status').textContent=await fn();}catch(e){$('student-class-status').textContent=e.message;}finally{panel.querySelectorAll('button,input').forEach(x=>x.disabled=false);}}
 function refresh(){
  const owner=session?.user?.id;if(!owner)return Promise.resolve(null);
  if(membershipPromise&&membershipOwner===owner)return membershipPromise;
  membershipOwner=owner;membership={owner,data:membershipState().data,error:'',loading:true};membershipChanged();
  const promise=(async()=>{try{
   const data=await api('me');if(owner!==session?.user?.id)return null;
   if(!Array.isArray(data.classes))throw Error('班级数据不完整，请刷新重试');
   state=data;membership={owner,data,error:'',loading:false};renderClasses();return data;
  }catch(e){if(owner===session?.user?.id)membership={owner,data:null,error:'审核状态读取失败：'+e.message,loading:false};throw e;
  }finally{if(owner===session?.user?.id)membershipChanged();if(membershipPromise===promise)membershipPromise=null;}})();
  membershipPromise=promise;return promise;
 }
 function renderClasses(){
  $('student-name').value=state.profile?.display_name||'';$('student-number').value=state.profile?.student_no||'';$('student-join-form').classList.toggle('hidden',state.is_teacher);
  const list=$('student-class-list');list.replaceChildren();
  if(state.is_teacher){list.textContent='当前是教师账号。请使用单独的学生账号测试入班审核。';return;}
  if(!state.classes.length)list.textContent='尚未加入班级。若教师已导入名单，请使用名单中的邮箱注册、验证并登录后刷新；也可以向教师索取入班码。';
  for(const c of state.classes){const card=document.createElement('article');card.innerHTML=`<h3>${esc(c.name)}</h3><p>${esc(c.major)} · ${esc(c.grade)}</p><p>${esc(names[c.status])} · ${esc(c.display_name)} / ${esc(c.student_no)}</p>`;
   if(c.status==='approved'){const b=document.createElement('button');b.className='btn primary tiny';b.textContent='查看班级课程';b.onclick=()=>viewClass(c.id);card.append(b);}
   if(['approved','pending'].includes(c.status)){const b=document.createElement('button');b.className='btn tiny';b.textContent=c.status==='pending'?'撤回申请':'退出班级';b.onclick=()=>{if(!confirm(c.status==='pending'?'撤回此入班申请？':'退出后将失去该班级课程入口，确认退出？'))return;task(async()=>{await api('leave',{class_id:c.id,revision:Number(c.revision)});await refresh();hook();return '已更新班级状态';});};card.append(b);}
   list.append(card);
  }
 }
 async function ready(onChange){hook=onChange;if(!base)return;build();
  try{
   const params=new URLSearchParams(location.hash.slice(1));
   if(params.has('access_token')){const access=params.get('access_token'),refreshToken=params.get('refresh_token');history.replaceState(null,'',location.pathname+'#my');const user=await auth('user',null,access);adopt({access_token:access,refresh_token:refreshToken,user,expires_in:3600});}
   else session=JSON.parse(sessionStorage.getItem(key)||'null');
   if(session){const user=await auth('user',null,await token());if(user.id!==session.user.id)throw Error('会话不匹配');session.user=user;}
  }catch(e){persist(null);startupError=e.message;}
  if(session){try{await refresh();}catch(e){startupError='班级服务加载失败：'+e.message;}}
  renderBar();
 }
 // Prevent browser back/forward cache from reviving another student's rendered conversations.
 window.addEventListener('pagehide',()=>{if(base)document.querySelector('main').classList.add('hidden');});
 window.addEventListener('pageshow',e=>{if(base&&e.persisted)location.reload();});
 window.MatinStudent={ready,api,taskApi:(op,data)=>api(op,data,'tasks'),mine,membershipState,refreshMembership:refresh,openClasses,viewClass,get userId(){return session?.user?.id||'guest';},get signedIn(){return !!session;},get classId(){return classId;}};
})();
