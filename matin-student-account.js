/* Student self service. Recovery credentials are never adopted as a normal learning session. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 let ctx,mailBusy=false,profileBusy=false,recoveryBusy=false,profileRevision=0,profileDirty=false,recovery=null,returnFocus=null;
 const cfg=window.MATIN_CLOUD||{},recoveryKey='matin_student_recovery_v1:'+cfg.supabaseUrl;
 const mailKey='matin_student_email_cooldown_v1:'+cfg.supabaseUrl;
 let emailMode='recover',cooldownUntil=0;
 const read=key=>{try{return JSON.parse(sessionStorage.getItem(key)||'null');}catch{return null;}};
 const store=(key,v)=>{try{v?sessionStorage.setItem(key,JSON.stringify(v)):sessionStorage.removeItem(key);}catch{}};
 function show(id,focus){returnFocus=document.activeElement;$(id).classList.remove('hidden');$(focus)?.focus();}
 function hide(id){$(id).classList.add('hidden');if(returnFocus?.isConnected)returnFocus.focus();}
 function modal(id,title,html){
  const el=document.createElement('div');el.id=id;el.className='modal-layer account-service hidden';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-labelledby',id+'-title');
  el.innerHTML='<div class="modal"><h2 id="'+id+'-title">'+title+'</h2>'+html+'</div>';document.body.append(el);
  el.addEventListener('keydown',e=>{
   if(e.key==='Escape'){e.preventDefault();e.stopPropagation();el.querySelector('[data-close]').click();}
   if(e.key==='Tab'){const nodes=[...el.querySelectorAll('button,input,textarea,a[href]')].filter(x=>!x.disabled&&x.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  });
 }
 function updateCooldown(){const remaining=Math.max(0,Math.ceil((cooldownUntil-Date.now())/1000)),button=$('student-email-send');if(!button)return;button.disabled=mailBusy||remaining>0;button.textContent=mailBusy?'正在发送…':remaining?remaining+' 秒后可重发':emailMode==='recover'?'发送重置密码邮件':'重发验证邮件';}
 function openEmail(mode){
  if(mailBusy)return;
  emailMode=mode;$('student-auth-modal').classList.add('hidden');
  $('student-email-help-title').textContent=mode==='recover'?'找回密码':'重发验证邮件';
  $('student-email-help-hint').textContent=mode==='recover'?'输入注册邮箱，通过邮件中的链接设置新密码。':'适用于已注册但尚未完成邮箱验证的学生。请使用注册时填写的邮箱。';
  $('student-help-email').value=$('student-email').value.trim()||ctx.getUser()?.email||'';
  $('student-email-help-status').textContent='';cooldownUntil=Number(read(mailKey))||0;updateCooldown();show('student-email-help','student-help-email');
 }
 async function fillProfile(){
  profileBusy=true;$('student-profile-save').disabled=true;$('student-profile-status').textContent='正在读取个人资料…';
  const inputs=[...$('student-profile-form').querySelectorAll('input')];inputs.forEach(x=>x.disabled=true);
  try{
   const data=await ctx.refresh();if(!data||!ctx.getUser())throw Error('请重新登录');
   if(!data.self_service_supported)throw Error('个人资料服务尚未升级，请联系教师完成本次更新。');
   if(data.is_teacher)throw Error('当前是教师账号，请使用学生账号修改个人资料。');
   const p=data.profile||{},fallback=data.classes?.[0]||{};
   $('student-profile-name').value=p.display_name||fallback.display_name||'';
   $('student-profile-number').value=p.student_no||fallback.student_no||'';
   $('student-profile-phone').value=p.phone||'';
   $('student-profile-email').value=ctx.getUser().email||'';
   profileRevision=Number(p.revision||0);profileDirty=false;$('student-profile-status').textContent='';$('student-profile-save').disabled=false;
  }catch(e){$('student-profile-status').textContent=e.message;}finally{profileBusy=false;inputs.forEach(x=>x.disabled=false);if(!$('student-profile-modal').classList.contains('hidden'))$('student-profile-name').focus();}
 }
 async function openProfile(){if(profileBusy)return;show('student-profile-modal','student-profile-name');await fillProfile();}
 function clearRecovery(){recovery=null;store(recoveryKey,null);$('student-reset-password').value='';$('student-reset-confirm').value='';}
 async function beginRecovery(value){
  // Reloading this page can resume the reset form, but never exposes authenticated course data.
  recovery=value||read(recoveryKey);
  if(!recovery)return false;
  try{
   if(!recovery.access_token||!recovery.refresh_token||!Number.isFinite(recovery.expires_at)||recovery.expires_at*1000<Date.now())throw Error('重置链接已失效，请重新发送重置密码邮件。');
   const user=await ctx.auth('user',null,recovery.access_token);
   if(!user?.id)throw Error('重置链接无效，请重新发送。');
   recovery.user=user;store(recoveryKey,recovery);
   $('student-reset-account').textContent='正在为 '+user.email+' 设置新密码';
   $('student-reset-status').textContent='';show('student-recovery-modal','student-reset-password');return true;
  }catch(e){clearRecovery();openEmail('recover');$('student-email-help-status').textContent=[401,403].includes(e.status)?'重置链接已失效，请重新发送重置密码邮件。':e.message;return true;}
 }
 function install(context){
  ctx=context;
  const style=document.createElement('style');style.textContent='.account-service{z-index:180}.account-service .modal{max-width:540px;max-height:90dvh;overflow:auto}.account-service p{line-height:1.7;overflow-wrap:anywhere}.account-service .field{margin:14px 0}.account-service input{width:100%;min-width:0}.account-service .modal-footer{display:flex;gap:10px;flex-wrap:wrap}.account-service [role=status]{color:#75502e;min-height:24px}.account-service .account-note{padding:12px;background:#f1f4ff;border-radius:12px;font-size:13px}#student-auth-help{display:flex;gap:12px;flex-wrap:wrap;margin-top:18px}#student-auth-help button{background:none;border:0;padding:6px 0;color:#435be2;text-decoration:underline;cursor:pointer}@media(max-width:600px){.account-service .modal{padding:22px;width:calc(100vw - 24px)}}';document.head.append(style);
  const help=document.createElement('div');help.id='student-auth-help';help.innerHTML='<button type="button" id="student-forgot-password">忘记密码</button><button type="button" id="student-resend-email">重发验证邮件</button>';$('student-auth-form').append(help);
  $('student-forgot-password').onclick=()=>openEmail('recover');$('student-resend-email').onclick=()=>openEmail('resend');
  modal('student-email-help','找回密码',`<p id="student-email-help-hint"></p><form id="student-email-help-form"><div class="field"><label for="student-help-email">注册邮箱</label><input id="student-help-email" type="email" required autocomplete="email" maxlength="254"></div><p role="status" id="student-email-help-status"></p><div class="modal-footer"><button type="button" class="btn" id="student-email-back" data-close>返回登录</button><button type="submit" class="btn primary" id="student-email-send">发送邮件</button></div></form>`);
  $('student-email-back').onclick=()=>{if(mailBusy)return;$('student-email').value=$('student-help-email').value;hide('student-email-help');ctx.showLogin();};
  $('student-email-help-form').onsubmit=async e=>{
   e.preventDefault();if(mailBusy||cooldownUntil>Date.now())return;
   mailBusy=true;updateCooldown();$('student-email-back').disabled=true;$('student-email-help-status').textContent='正在请求发送邮件…';
   try{
    const email=$('student-help-email').value.trim(),redirect=encodeURIComponent(location.origin+location.pathname);
    await ctx.auth(emailMode+'?redirect_to='+redirect,{email,...(emailMode==='resend'?{type:'signup'}:{})});
    cooldownUntil=Date.now()+60000;store(mailKey,cooldownUntil);
    $('student-email-help-status').textContent=emailMode==='recover'?'如果该邮箱已注册，将收到重置密码邮件。请检查收件箱及垃圾邮件，使用最新链接设置密码。':'如果该邮箱已注册且尚未验证，将收到验证邮件。请检查收件箱及垃圾邮件，验证后返回登录。';
   }catch(e){if(e.status===429){cooldownUntil=Date.now()+60000;store(mailKey,cooldownUntil);}$('student-email-help-status').textContent=e.message;}finally{mailBusy=false;$('student-email-back').disabled=false;updateCooldown();}
  };
  setInterval(updateCooldown,1000);
  modal('student-recovery-modal','设置新密码',`<p id="student-reset-account"></p><form id="student-reset-form"><div class="field"><label for="student-reset-password">新密码（至少8位）</label><input id="student-reset-password" type="password" required minlength="8" maxlength="128" autocomplete="new-password"></div><div class="field"><label for="student-reset-confirm">确认新密码</label><input id="student-reset-confirm" type="password" required minlength="8" maxlength="128" autocomplete="new-password"></div><p id="student-reset-status" role="status"></p><div class="modal-footer"><button class="btn" type="button" id="student-reset-cancel" data-close>取消并返回登录</button><button class="btn primary" type="submit" id="student-reset-save">保存新密码</button></div></form>`);
  $('student-reset-cancel').onclick=()=>{if(recoveryBusy)return;clearRecovery();hide('student-recovery-modal');ctx.showLogin();};
  $('student-reset-form').onsubmit=async e=>{
   e.preventDefault();if(recoveryBusy||!recovery)return;
   const password=$('student-reset-password').value;
   if(password!==$('student-reset-confirm').value){$('student-reset-status').textContent='两次输入的密码不一致。';return;}
   recoveryBusy=true;$('student-reset-save').disabled=true;$('student-reset-cancel').disabled=true;$('student-reset-status').textContent='正在保存…';
   try{
    if(recovery.expires_at*1000<Date.now()+60000){const d=await ctx.auth('token?grant_type=refresh_token',{refresh_token:recovery.refresh_token});if(!d.access_token||!d.refresh_token||d.user?.id!==recovery.user.id)throw Error('重置会话失效，请重新发送邮件。');recovery={...recovery,...d,expires_at:Date.now()/1000+(d.expires_in||3600)};store(recoveryKey,recovery);}
    await ctx.auth('user',{password},recovery.access_token,'PUT');
    const access=recovery.access_token,email=recovery.user.email;clearRecovery();
    // Re-enter with the new password; recovery grants do not become a learning session.
    await ctx.auth('logout?scope=local',{},access).catch(()=>{});
    hide('student-recovery-modal');$('student-email').value=email;ctx.showLogin();$('student-auth-status').textContent='密码已更新，请使用新密码登录。';
   }catch(e){$('student-reset-status').textContent=e.message;}finally{recoveryBusy=false;$('student-reset-save').disabled=false;$('student-reset-cancel').disabled=false;}
  };
  modal('student-profile-modal','个人资料',`<p>完善自己的账号资料，方便后续申请加入班级。</p><form id="student-profile-form"><div class="field"><label for="student-profile-email">登录邮箱</label><input id="student-profile-email" type="email" readonly></div><div class="field"><label for="student-profile-name">姓名</label><input id="student-profile-name" required maxlength="60" autocomplete="name"></div><div class="field"><label for="student-profile-number">学号</label><input id="student-profile-number" required maxlength="60" autocomplete="off"></div><div class="field"><label for="student-profile-phone">联系电话（选填）</label><input id="student-profile-phone" type="tel" maxlength="32" autocomplete="tel"></div><p class="account-note">姓名、学号用于今后的入班申请。已提交的班级名单保留原资料，如需更正请联系教师；联系电话更新后，所在班级教师可在成员名单中查看。登录邮箱在此只读。</p><p id="student-profile-status" role="status"></p><div class="modal-footer"><button class="btn" type="button" id="student-profile-close" data-close>关闭</button><button class="btn" type="button" id="student-profile-reload">重新读取</button><button class="btn primary" type="submit" id="student-profile-save" disabled>保存资料</button></div></form>`);
  $('student-profile-form').addEventListener('input',()=>profileDirty=true);
  $('student-profile-close').onclick=()=>{if(profileBusy)return;if(profileDirty&&!confirm('个人资料尚未保存，放弃本次修改？'))return;profileDirty=false;hide('student-profile-modal');};
  $('student-profile-reload').onclick=()=>{if(profileBusy)return;if(profileDirty&&!confirm('重新读取将替换当前未保存的资料，继续？'))return;fillProfile();};
  $('student-profile-form').onsubmit=async e=>{
   e.preventDefault();if(profileBusy)return;profileBusy=true;$('student-profile-save').disabled=true;
   const inputs=[...$('student-profile-form').querySelectorAll('input')];inputs.forEach(x=>x.disabled=true);
   $('student-profile-status').textContent='正在保存…';
   try{
    const r=await ctx.api('profile_save',{revision:profileRevision,display_name:$('student-profile-name').value.trim(),student_no:$('student-profile-number').value.trim(),phone:$('student-profile-phone').value.trim()});
    profileRevision=Number(r.profile.revision);profileDirty=false;$('student-profile-status').textContent='个人资料已保存。已提交的班级姓名和学号保持原资料。';
    try{await ctx.refresh();}catch{$('student-profile-status').textContent+=' 班级信息刷新失败，可稍后刷新。';}
   }catch(e){$('student-profile-status').textContent=e.status===409?'资料已在另一处修改。你的输入已保留，请核对后点击“重新读取”，再修改并保存。':e.message;}
   finally{profileBusy=false;inputs.forEach(x=>x.disabled=false);$('student-profile-save').disabled=false;}
  };
 }
 window.MatinStudentAccount={install,openProfile,beginRecovery,hasRecovery:()=>!!read(recoveryKey),clearRecovery,openEmail};
})();
