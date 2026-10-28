/* Teacher authentication and cloud API. No privileged key is used in this file. */
(() => {
  'use strict';
  const cfg=window.MATIN_CLOUD||{};
  const base=String(cfg.supabaseUrl||'').replace(/\/+$/,'');
  const enabled=!!base;
  const storageKey='matin_teacher_session_v1:'+base;
  let session=null, refreshing=null;
  // Do not restore a previous account's rendered workspace from browser history.
  window.addEventListener('pagehide',()=>{if(enabled)document.documentElement.classList.add('account-locked');});
  window.addEventListener('pageshow',e=>{if(enabled&&e.persisted)location.reload();});
  const status=()=>document.getElementById('account-status');
  function persist(value){session=value;try{if(value)sessionStorage.setItem(storageKey,JSON.stringify(value));else sessionStorage.removeItem(storageKey);}catch{}}
  async function auth(path,body,token){
    const res=await fetch(base+'/auth/v1/'+path,{method:body?'POST':'GET',headers:{apikey:cfg.publishableKey,
      'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw Error(res.status===400||res.status===401?'邮箱或密码不正确，或账号尚未确认':'登录服务暂不可用，请稍后重试');
    return data;
  }
  function adopt(data){if(!data.access_token||!data.refresh_token||!data.user?.id)throw Error('登录响应不完整');
    persist({...data,expires_at:data.expires_at||Math.floor(Date.now()/1000)+data.expires_in});}
  async function checkTeacher(){const data=await api({action:'membership',op:'me',data:{}});if(!data.is_teacher){persist(null);throw Error('此账号没有教师权限，请使用学生端或联系项目管理员。');}}
  async function token(){
    if(!session)throw Error('请重新登录');
    if(session.expires_at*1000<Date.now()+60000){
      if(!refreshing)refreshing=auth('token?grant_type=refresh_token',{refresh_token:session.refresh_token}).then(adopt).catch(e=>{persist(null);throw e;}).finally(()=>refreshing=null);
      await refreshing;
    }
    return session.access_token;
  }
  function panel(){
    document.documentElement.classList.add('account-locked');
    if(document.getElementById('account-screen'))return;
    const style=document.createElement('style');style.textContent=`.account-locked body>*:not(#account-screen):not(script):not(style){display:none!important}#account-screen{min-height:100vh;display:grid;place-items:center;background:#f3f6fb;padding:24px}#account-form{width:min(430px,100%);background:white;border:1px solid #dce3f1;border-radius:24px;padding:34px;box-shadow:0 20px 60px #24386512}#account-form h1{color:#203255;font-size:27px}#account-form label{display:block;margin:18px 0 8px}#account-form input{width:100%;padding:13px;border:1px solid #ccd5e7;border-radius:10px}#account-form button{margin-top:20px;width:100%;padding:13px;background:#4e55dc;color:white;border:0;border-radius:10px}#account-status{white-space:pre-wrap;color:#a43b42;line-height:1.7}#teacher-account-bar{margin-left:244px;display:flex;gap:12px;align-items:center;padding:10px 24px;background:#eef2ff;flex-wrap:wrap}@media(max-width:1200px){#teacher-account-bar{margin-left:0}}#teacher-account-bar button{padding:7px 12px;border:1px solid #cdd6f0;background:white;border-radius:8px}`;
    document.head.append(style);
    const root=document.createElement('div');root.id='account-screen';root.innerHTML=`<form id="account-form"><h1>登录教师工作台</h1><p>登录后查看和编辑自己的云端课程。</p><label for="teacher-email">邮箱</label><input id="teacher-email" type="email" autocomplete="username" required><label for="teacher-password">密码</label><input id="teacher-password" type="password" autocomplete="current-password" required><button id="teacher-login" type="submit">登录</button><p id="account-status" role="status"></p><small>账号由项目管理员创建。忘记密码请联系管理员重设。</small></form>`;document.body.append(root);
  }
  async function ready(){
    if(!enabled)return null;
    panel();
    if(!cfg.publishableKey){status().textContent='缺少公开连接配置，请先更新 matin-config.js。';document.getElementById('teacher-login').disabled=true;return new Promise(()=>{});}
    try{session=JSON.parse(sessionStorage.getItem(storageKey)||'null');if(session){const user=await auth('user',null,await token());if(user.id!==session.user.id)throw Error('会话不匹配');session.user=user;await checkTeacher();return unlock();}}catch(e){persist(null);status().textContent=e.message;}
    await new Promise(resolve=>{document.getElementById('account-form').onsubmit=async e=>{e.preventDefault();const button=document.getElementById('teacher-login');button.disabled=true;status().textContent='正在登录…';
      try{adopt(await auth('token?grant_type=password',{email:document.getElementById('teacher-email').value.trim(),password:document.getElementById('teacher-password').value}));await checkTeacher();document.getElementById('teacher-password').value='';resolve();}
      catch(e){status().textContent=e.message;}finally{button.disabled=false;}};});
    return unlock();
  }
  function unlock(){
    document.getElementById('account-screen').remove();document.documentElement.classList.remove('account-locked');
    const bar=document.createElement('div');bar.id='teacher-account-bar';
    const name=document.createElement('span');name.textContent='教师账号：'+session.user.email;
    const refresh=document.createElement('button');refresh.textContent='重新加载云端';refresh.onclick=()=>{if(window.MatinAccount.canLeave())location.reload();};
    const out=document.createElement('button');out.textContent='退出账号';out.onclick=async()=>{if(!window.MatinAccount.canLeave())return;out.disabled=true;
      const access=session?.access_token;persist(null);try{await fetch(base+'/auth/v1/logout',{method:'POST',headers:{apikey:cfg.publishableKey,Authorization:'Bearer '+access},signal:AbortSignal.timeout(5000)});}catch{}location.reload();};
    bar.append(name,refresh,out);document.body.prepend(bar);return session.user;
  }
  async function api(body){
    const access=await token();
    const res=await fetch(base+'/functions/v1/matin-courses',{method:body?'POST':'GET',headers:{'Content-Type':'application/json',apikey:cfg.publishableKey,Authorization:'Bearer '+access},
      ...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(25000)});
    const data=await res.json().catch(()=>({}));
    if(!res.ok||!data.ok){const error=Error(data.error||'云端请求失败');error.status=res.status;throw error;}
    return data;
  }
  function fatal(error){panel();document.getElementById('account-form').innerHTML='<h1>云端课程未能加载</h1><p id="account-status"></p><button type="button" id="account-retry">重试</button><button type="button" id="account-exit">退出账号</button>';status().textContent=error.message;
    document.getElementById('account-retry').onclick=()=>location.reload();document.getElementById('account-exit').onclick=()=>{persist(null);location.reload();};}
  window.MatinAccount={enabled,ready,api,get userId(){return session?.user?.id||'guest';},classAI:async(payload,signal)=>window.MatinClassAI.request(base,cfg.publishableKey,await token(),payload,signal),fatal,canLeave:()=>true};
})();
