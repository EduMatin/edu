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
  const open=node('button','教师管理');open.type='button';open.className='btn';open.id='teacher-admin-open';document.querySelector('.nav').append(open);
  const dialog=node('dialog');dialog.style.cssText='box-sizing:border-box;width:min(850px,calc(100vw - 24px));max-height:85vh;overflow:auto;border:1px solid #dce3f1;border-radius:18px;padding:24px;color:#253555';dialog.setAttribute('aria-label','教师管理');document.body.append(dialog);
  const head=node('div'),close=node('button','关闭');close.type='button';close.className='btn';close.onclick=()=>dialog.close();head.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px';head.append(node('h2','教师管理'),close);
  const help=node('p','每行一位教师：邮箱,姓名,专业。一次最多20位。现有学生账号请使用另一个邮箱。');
  const input=node('textarea');input.rows=4;input.style.width='100%';input.setAttribute('aria-label','邀请教师名单');input.placeholder='teacher@example.com,张老师,光学';
  const send=node('button','检查并邀请'),refresh=node('button','刷新状态'),status=node('p'),list=node('div');status.setAttribute('role','status');send.className=refresh.className='btn';dialog.append(head,help,input,send,refresh,status,list);
  let busy=false;
  const run=async fn=>{if(busy)return;busy=true;[...dialog.querySelectorAll('button')].forEach(b=>b.disabled=true);try{await fn();}catch(e){status.textContent=e.message;}finally{busy=false;[...dialog.querySelectorAll('button')].forEach(b=>b.disabled=false);}};
  async function load(){const r=await api('list');list.replaceChildren();for(const row of r.rows){const item=node('div');item.style.cssText='padding:14px 0;border-bottom:1px solid #ddd;overflow-wrap:anywhere';const expired=row.state==='pending'&&Date.parse(row.expires_at)<Date.now();item.append(node('strong',(row.display_name||'未填写姓名')+' · '+row.email),node('p',(row.department||'')+' · '+(expired?'邀请已过期':{pending:'待激活',active:'已激活',disabled:'已停用 / 邀请已取消'}[row.state])));const action=(label,op)=>{const b=node('button',label);b.className='btn';b.onclick=()=>run(async()=>{if(!confirm(label+'：'+row.email+'？'))return;const result=await api(op,{email:row.email,name:row.display_name,department:row.department});status.textContent=result.message||'操作完成。';await load();});item.append(b);};if(row.state==='pending'||(row.state==='disabled'&&!row.user_id))action('重新邀请','invite');if(row.state!=='disabled')action(row.state==='pending'?'取消邀请':'停用','disable');else if(row.user_id)action('恢复使用','enable');list.append(item);}}
  send.onclick=()=>run(async()=>{const lines=input.value.split(/\r?\n/).filter(x=>x.trim());if(!lines.length||lines.length>20)throw Error('每次请输入1至20位教师。');const rows=lines.map(x=>{const [email,name='',department='',...extra]=x.split(/[,，\t]/).map(v=>v.trim());if(extra.length||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||name.length>80||department.length>120)throw Error('请检查邮箱、姓名和专业格式。');return {email:email.toLowerCase(),name,department};});if(new Set(rows.map(x=>x.email)).size!==rows.length)throw Error('名单中有重复邮箱，请先删除重复行。');if(!confirm('将邀请以下教师：\n'+rows.map(r=>r.email).join('\n')))return;const results=[];for(const row of rows){try{await api('invite',row);results.push(row.email+'：邮件服务已接受请求');}catch(e){results.push(row.email+'：'+e.message);}status.textContent=results.join('\n');status.style.whiteSpace='pre-wrap';}await load();});
  refresh.onclick=()=>run(load);open.onclick=()=>{dialog.showModal();run(load);};
 }
 window.MatinTeacherAdmin={loginHelp,install};
})();
