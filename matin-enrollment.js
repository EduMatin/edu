/* Teacher class invitation and membership review. No student identity comes from UI authority. */
(() => {'use strict';
 const labels={pending:'待审核',approved:'已加入',rejected:'已拒绝',removed:'已移出',left:'已退出 / 已撤回'};
 let active=null,busy=false,importSupported=false;
 const root=document.createElement('div');root.className='modal-layer hidden';root.id='enrollment-modal';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','enrollment-title');
 root.innerHTML=`<div class="modal" style="max-width:850px;width:96vw;max-height:90vh;overflow:auto"><div class="actions"><h2 id="enrollment-title" style="margin-right:auto">学生与入班审核</h2><button type="button" class="btn" id="enrollment-close">关闭</button></div><p>学生可用入班码申请，由教师审核；也可由教师批量导入名单，学生验证名单中的邮箱并登录后自动加入班级。</p><p>原教师主页和项目分享链接仍独立有效。入班码不是 AI 课堂访问码。</p><div id="enrollment-invite"></div><div class="actions"><button type="button" class="btn" id="invite-create">生成入班码</button><button type="button" class="btn" id="invite-rotate">更换 / 重新启用入班码</button><button type="button" class="btn" id="invite-disable">关闭入班申请</button><button type="button" class="btn" id="enrollment-refresh">刷新名单</button><button type="button" class="btn primary" id="enrollment-import" disabled>批量导入学生</button></div><p id="enrollment-status" role="status"></p><p id="enrollment-summary"></p><div id="enrollment-list"></div></div>`;
 document.body.append(root);
 const $=id=>document.getElementById(id),api=(op,data={})=>window.MatinAccount.api({action:'membership',op,data:{...data,class_id:active.id}});
 const style=document.createElement('style');style.textContent='#enrollment-modal{z-index:120}#enrollment-modal p{line-height:1.7;overflow-wrap:anywhere}#enrollment-modal .actions{display:flex;gap:8px;flex-wrap:wrap}#enrollment-invite{padding:14px;background:#eef2ff;border-radius:12px;margin:12px 0;overflow-wrap:anywhere}#enrollment-list article{padding:14px;border:1px solid #dce3f1;border-radius:12px;margin:12px 0}#enrollment-status{color:#78502e;min-height:24px}';document.head.append(style);
 async function task(fn){if(busy)return;busy=true;root.querySelectorAll('button').forEach(b=>b.disabled=true);$('enrollment-status').textContent='正在处理…';try{await fn();$('enrollment-status').textContent='已加载最新班级成员状态'+(importSupported?'':'；批量导入尚未启用，请完成数据库和函数升级。');}catch(e){$('enrollment-status').textContent=e.message;}finally{busy=false;root.querySelectorAll('button').forEach(b=>b.disabled=false);$('enrollment-import').disabled=!importSupported||!window.MatinRosterImport;}}
 async function load(){const data=await api('roster'),inv=data.invite,box=$('enrollment-invite');box.replaceChildren();
  const info=document.createElement('p');info.textContent=!inv?'尚未生成入班码。':!inv.enabled?'入班申请已关闭。':new Date(inv.expires_at)<=new Date()?'入班码已过期，请更换。':'入班码：'+inv.code+'（有效期至 '+new Date(inv.expires_at).toLocaleDateString('zh-CN')+'）';box.append(info);
  if(inv?.enabled&&new Date(inv.expires_at)>new Date()){const b=document.createElement('button');b.className='btn';b.textContent='复制入班码';b.onclick=async()=>{try{await navigator.clipboard.writeText(inv.code);$('enrollment-status').textContent='入班码已复制，请提供给本班学生';}catch{$('enrollment-status').textContent='复制失败，请手动选中上方入班码复制';}};box.append(b);}
  importSupported=data.import_supported===true;
  const imports=Array.isArray(data.imports)?data.imports:[],list=$('enrollment-list');list.replaceChildren();
  $('enrollment-summary').textContent='已加入 '+data.members.filter(m=>m.status==='approved').length+' 人 · 待审核 '+data.members.filter(m=>m.status==='pending').length+' 人 · 待账号关联 '+imports.filter(m=>m.status==='awaiting_account').length+' 人';
  if(!data.members.length&&!imports.length)list.textContent=importSupported?'暂无学生申请或导入名单。':'暂无学生申请。';
  for(const m of data.members){const a=document.createElement('article'),h=document.createElement('h3'),p=document.createElement('p'),actions=document.createElement('div');actions.className='actions';h.textContent=m.display_name+' · '+m.student_no;p.textContent=m.email+' · '+labels[m.status];a.append(h,p,actions);
   if(m.phone){const phone=document.createElement('p');phone.textContent='电话：'+m.phone;a.insertBefore(phone,actions);}
   const options=m.status==='pending'?[['approved','通过'],['rejected','拒绝']]:m.status==='approved'?[['removed','移出班级']]:m.status==='removed'?[['pending','允许重新审核']]:[];
   for(const [decision,title]of options){const b=document.createElement('button');b.className='btn';b.textContent=title;b.onclick=()=>{if(!confirm(title+'：'+m.display_name+'（'+m.student_no+'）？'))return;task(async()=>{await api('review',{student_id:m.student_id,revision:Number(m.revision),decision});await load();});};actions.append(b);}list.append(a);
  }
  for(const m of imports){
   const a=document.createElement('article'),h=document.createElement('h3'),p=document.createElement('p'),phone=document.createElement('p');h.textContent=m.display_name+' · '+m.student_no;
   p.textContent=m.email+' · '+(m.status==='awaiting_account'?'待账号关联：学生验证此邮箱并登录后自动加入':'原关联账号已删除，请联系管理员');
   phone.textContent='电话：'+(m.phone||'未填写');a.append(h,p,phone);
   if(m.status==='awaiting_account'){
    const b=document.createElement('button');b.type='button';b.className='btn';b.textContent='撤销此导入';
    b.onclick=()=>{if(confirm('撤销 '+m.display_name+' 的待关联名单？撤销后，该邮箱不会通过这条导入自动入班。'))task(async()=>{await api('import_remove',{id:m.id,revision:Number(m.revision)});await load();});};a.append(b);
   }
   list.append(a);
  }
 }
 $('enrollment-close').onclick=()=>{if(!busy)root.classList.add('hidden');};root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();$('enrollment-close').click();}});
 for(const [id,op]of [['invite-create','invite_create'],['invite-rotate','invite_rotate'],['invite-disable','invite_disable']])$(id).onclick=()=>{if(op!=='invite_create'&&!confirm(op==='invite_disable'?'关闭新入班申请？现有成员不受影响。':'更换后旧入班码立即失效，现有成员不受影响，继续？'))return;task(async()=>{await api(op);await load();});};
 $('enrollment-refresh').onclick=()=>task(load);
 $('enrollment-import').onclick=()=>{
  if(busy||!importSupported||!window.MatinRosterImport)return;
  const row={id:active.id,name:active.name};
  window.MatinRosterImport.open(row,(op,data)=>window.MatinAccount.api({action:'membership',op,data:{...data,class_id:row.id}}),async()=>{if(active?.id===row.id)await load();});
 };
 window.MatinEnrollment={open(row){if(busy)return;active=row;importSupported=false;$('enrollment-title').textContent=row.name+' · 学生与入班审核';$('enrollment-list').replaceChildren();$('enrollment-summary').textContent='';$('enrollment-invite').replaceChildren();root.classList.remove('hidden');task(load);}};
})();
