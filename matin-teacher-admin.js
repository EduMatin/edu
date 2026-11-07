/* Teacher onboarding. Privileged credentials stay in the Edge Function. */
(() => {'use strict';
 const cfg=window.MATIN_CLOUD||{},base=String(cfg.supabaseUrl||'').replace(/\/+$/,'');
 const fragment=new URLSearchParams(location.hash.slice(1));
 const callback=(['invite','recovery'].includes(fragment.get('type'))||fragment.has('error_description'))?{token:fragment.get('access_token'),error:fragment.get('error_description')}:null;
 if(callback||fragment.has('error_description'))history.replaceState(null,'',location.pathname+location.search);
 if(callback){try{sessionStorage.removeItem('matin_teacher_session_v1:'+base);}catch{}}
 window.addEventListener('hashchange',()=>{const h=new URLSearchParams(location.hash.slice(1));if(['invite','recovery'].includes(h.get('type'))||h.has('error_description'))location.reload();});
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 async function auth(path,data,token,method='POST'){
  const r=await fetch(base+'/auth/v1/'+path,{method,headers:{apikey:cfg.publishableKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw Error(r.status===429?'发送过于频繁，请稍后重试。':'操作未完成，链接可能失效或邮件服务不可用，请重新发送邮件。');return r.json().catch(()=>({}));
 }
 async function loginHelp(){
  const form=document.getElementById('account-form'),status=document.getElementById('account-status');
  const reset=node('button','忘记密码 / 重新获取激活邮件');reset.type='button';form.append(reset);
  reset.onclick=async()=>{const email=document.getElementById('teacher-email');if(!email.reportValidity()||!email.value)return;reset.disabled=true;try{await auth('recover?redirect_to='+encodeURIComponent(location.origin+location.pathname),{email:email.value.trim()});status.textContent='如果该邮箱已注册，将收到设置密码邮件。请查看收件箱与垃圾邮件。';}catch(e){status.textContent=e.message;}setTimeout(()=>reset.disabled=false,60000);};
  if(!callback)return;
  await new Promise(resolve=>{
   form.replaceChildren(node('h1','设置教师账号密码'));const info=node('p'),msg=node('p');msg.setAttribute('role','status');
   const pass=node('input'),confirm=node('input');for(const [n,label] of [[pass,'新密码（至少12位）'],[confirm,'再次输入密码']]){n.type='password';n.autocomplete='new-password';n.minLength=12;n.required=true;n.setAttribute('aria-label',label);const l=node('label',label);l.append(n);form.append(l);}
   const save=node('button','保存密码'),back=node('button','返回登录');back.type='button';back.onclick=()=>location.reload();form.append(info,save,back,msg);
   let user=null;if(!callback.token){msg.textContent='链接已失效，请返回登录重新获取邮件。';save.disabled=true;return;}auth('user',null,callback.token,'GET').then(u=>{user=u;info.textContent='账号：'+u.email;}).catch(e=>{msg.textContent=e.message;save.disabled=true;});
   form.onsubmit=async e=>{e.preventDefault();if(!user||!callback.token){msg.textContent='链接无效，请重新获取邮件。';return;}if(pass.value!==confirm.value){msg.textContent='两次密码不一致。';return;}save.disabled=true;try{await auth('user',{password:pass.value},callback.token,'PUT');pass.value=confirm.value='';msg.textContent='密码已保存。请返回登录，完成教师权限激活。';save.hidden=true;}catch(e){msg.textContent=e.message;save.disabled=false;}};
  });
 }
 async function install(){
  const api=(op,data={})=>window.MatinAccount.api({action:'teacher_admin',op,data});
  let me;try{me=await api('me');}catch{return;}if(!me.is_admin)return;
  const identity=document.getElementById('teacher-account-identity');if(identity){const email=identity.textContent.replace(/^教师 · /,'');identity.replaceChildren(node('strong','平台管理员'),document.createTextNode(' · '+email));identity.classList.add('account-admin-identity');}
  const open=node('button','教师管理');open.type='button';open.className='btn';open.id='teacher-admin-open';document.querySelector('.nav').append(open);
  // Keep the entry actionable even if a deployment omitted its UI dependency.
  open.onclick=()=>alert('教师管理文件未加载完整，请刷新页面；如仍失败，请运行部署检查并核对上传文件。');
  if(window.MatinTeacherEntry?.mount)window.MatinTeacherEntry.mount(open,api);
 }
 window.MatinTeacherAdmin={loginHelp,install};
})();
