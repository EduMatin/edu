/* Teacher class invitation and membership review. No student identity comes from UI authority. */
(() => {'use strict';
 const labels={pending:'待审核',approved:'已加入',rejected:'已拒绝',removed:'已移出',left:'已退出 / 已撤回'};
 let active=null,busy=false,importSupported=false,batchSupported=false,roster=[],page=1,pageRows=[],totalPages=1;
 const selected=new Map();
 const root=document.createElement('div');root.className='modal-layer hidden';root.id='enrollment-modal';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','enrollment-title');
 root.innerHTML=`<div class="modal" style="max-width:850px;width:96vw;max-height:90vh;overflow:auto"><div class="actions"><h2 id="enrollment-title" style="margin-right:auto">学生与入班审核</h2><button type="button" class="btn" id="enrollment-close">关闭</button></div><p>学生可用入班码申请，由教师审核；也可由教师批量导入名单，学生验证名单中的邮箱并登录后自动加入班级。</p><p>原教师主页和项目分享链接仍独立有效。入班码不是 AI 课堂访问码。</p><div id="enrollment-invite"></div><div class="actions"><button type="button" class="btn" id="invite-create">生成入班码</button><button type="button" class="btn" id="invite-rotate">更换 / 重新启用入班码</button><button type="button" class="btn" id="invite-disable">关闭入班申请</button><button type="button" class="btn" id="enrollment-refresh">刷新名单</button><button type="button" class="btn primary" id="enrollment-import" disabled>批量导入学生</button></div><p id="enrollment-status" role="status"></p><p id="enrollment-summary"></p><div id="enrollment-list"></div></div>`;
 document.body.append(root);
 const inviteDetails=document.createElement('details');inviteDetails.id='enrollment-invite-details';inviteDetails.innerHTML='<summary>入班码与加入方式</summary><div class="actions" id="enrollment-invite-actions"></div>';
 for(const p of [...root.querySelectorAll('.modal>p')].slice(0,2))inviteDetails.append(p);
 inviteDetails.append(document.getElementById('enrollment-invite'));
 for(const id of ['invite-create','invite-rotate','invite-disable'])inviteDetails.querySelector('.actions').append(document.getElementById(id));
 document.getElementById('enrollment-status').before(inviteDetails);
 const controls=document.createElement('div');controls.id='enrollment-tools';controls.innerHTML=`<div class="enrollment-filters"><label>搜索学生<input type="search" id="enrollment-search" placeholder="姓名、学号或邮箱…"></label><label>成员状态<select id="enrollment-filter"><option value="all">全部状态</option><option value="pending">待审核</option><option value="approved">已加入</option><option value="awaiting_account">待账号关联</option><option value="history">已拒绝 / 已移出 / 已退出</option></select></label></div><div class="actions enrollment-batch"><label><input type="checkbox" id="enrollment-select-page"> 勾选本页待审核学生</label><span id="enrollment-selected" role="status"></span><button type="button" class="btn primary" id="enrollment-approve">批量通过</button><button type="button" class="btn" id="enrollment-reject">批量拒绝</button></div><p id="enrollment-batch-hint">只处理勾选的待审核学生；更换筛选或翻页会清空勾选。</p>`;
 document.getElementById('enrollment-list').before(controls);
 const pages=document.createElement('nav');pages.className='actions enrollment-pages';pages.setAttribute('aria-label','学生名单分页');pages.innerHTML='<span id="enrollment-page"></span><button type="button" class="btn" id="enrollment-prev">上一页</button><button type="button" class="btn" id="enrollment-next">下一页</button>';document.getElementById('enrollment-list').after(pages);
 const $=id=>document.getElementById(id),api=(op,data={})=>window.MatinAccount.api({action:'membership',op,data:{...data,class_id:active.id}}).then(result=>{if(['review','review_batch'].includes(op))window.dispatchEvent(new CustomEvent('matin-membership-reviewed'));return result;});
 const style=document.createElement('style');style.textContent='#enrollment-modal{z-index:120}#enrollment-modal p{line-height:1.7;overflow-wrap:anywhere}#enrollment-modal .actions{display:flex;gap:8px;flex-wrap:wrap}#enrollment-invite{padding:14px;background:#eef2ff;border-radius:12px;margin:12px 0;overflow-wrap:anywhere}#enrollment-list article{padding:14px;border:1px solid #dce3f1;border-radius:12px;margin:12px 0}#enrollment-status{color:#78502e;min-height:24px}';document.head.append(style);
 style.textContent+='#enrollment-modal .enrollment-filters{display:grid;grid-template-columns:2fr 1fr;gap:12px;margin:16px 0}#enrollment-modal .enrollment-filters label{display:grid;gap:6px}#enrollment-modal .enrollment-filters input,#enrollment-modal select{width:100%;min-width:0;padding:10px;border:1px solid #ccd5e7;border-radius:10px}#enrollment-modal input[type=checkbox]{width:18px;height:18px;vertical-align:middle}#enrollment-modal .enrollment-batch{align-items:center;padding:12px;background:#f1f4ff;border-radius:12px}#enrollment-batch-hint{font-size:13px;color:#627298}#enrollment-modal .enrollment-pages{align-items:center;justify-content:flex-end}#enrollment-page{margin-right:auto}#enrollment-list article>label{display:block;color:#435be2;margin-bottom:8px}@media(max-width:600px){#enrollment-modal .enrollment-filters{grid-template-columns:1fr}#enrollment-modal .modal{padding:20px}#enrollment-modal h2{font-size:22px}#enrollment-modal .btn{white-space:normal}}';
 style.textContent+='#enrollment-modal [hidden]{display:none!important}';
 function buttons(){
  root.querySelectorAll('button,input,select').forEach(b=>b.disabled=busy);
  for(const id of ['invite-create','invite-rotate','invite-disable','enrollment-import','enrollment-approve','enrollment-reject','enrollment-select-page'])$(id).hidden=!!active?.class_ended_at;
  $('enrollment-import').disabled=busy||!importSupported||!window.MatinRosterImport;
  const eligible=pageRows.filter(m=>m.status==='pending');
  $('enrollment-select-page').disabled=busy||!batchSupported||!eligible.length;
  $('enrollment-select-page').checked=!!eligible.length&&eligible.every(m=>selected.has(m.student_id));
  $('enrollment-select-page').indeterminate=selected.size>0&&!$('enrollment-select-page').checked;
  for(const id of ['enrollment-approve','enrollment-reject'])$(id).disabled=busy||!batchSupported||!selected.size;
  $('enrollment-prev').disabled=busy||page<=1;$('enrollment-next').disabled=busy||page>=totalPages;
  $('enrollment-selected').textContent='已勾选 '+selected.size+' 人';
  $('enrollment-batch-hint').textContent=active?.class_ended_at?'结课名单只读，停止入班、导入与审核。':batchSupported?'只处理勾选的待审核学生；更换筛选或翻页会清空勾选。':'批量审核尚未启用，请先完成学生账号自助服务的数据库和函数更新。';
 }
 async function task(fn){if(busy)return;busy=true;buttons();$('enrollment-status').textContent='正在处理…';try{const message=await fn();$('enrollment-status').textContent=message||'已加载最新班级成员状态'+(importSupported?'':'；批量导入尚未启用，请完成数据库和函数升级。');}catch(e){$('enrollment-status').textContent=e.message;}finally{busy=false;buttons();}}
 async function load(){const requestClass=active.id,data=await api('roster');if(active.id!==requestClass)return;active={...active,class_ended_at:data.class_ended_at};const inv=data.invite,box=$('enrollment-invite');box.replaceChildren();
  const info=document.createElement('p');info.textContent=active.class_ended_at?'已结束教学 · 只读名单（结课时的资料）。停止入班与审核。':!inv?'尚未生成入班码。':!inv.enabled?'入班申请已关闭。':new Date(inv.expires_at)<=new Date()?'入班码已过期，请更换。':'入班码：'+inv.code+'（有效期至 '+new Date(inv.expires_at).toLocaleDateString('zh-CN')+'）';box.append(info);
  if(inv?.enabled&&new Date(inv.expires_at)>new Date()){const b=document.createElement('button');b.className='btn';b.textContent='复制入班码';b.onclick=async()=>{try{await navigator.clipboard.writeText(inv.code);$('enrollment-status').textContent='入班码已复制，请提供给本班学生';}catch{$('enrollment-status').textContent='复制失败，请手动选中上方入班码复制';}};box.append(b);}
  importSupported=!active.class_ended_at&&data.import_supported===true;batchSupported=!active.class_ended_at&&data.batch_review_supported===true;
  const imports=Array.isArray(data.imports)?data.imports:[];
  $('enrollment-summary').textContent=(active.class_ended_at?'已结束教学 · 只读名单 · ':'')+'已加入 '+data.members.filter(m=>m.status==='approved').length+' 人 · 待审核 '+data.members.filter(m=>m.status==='pending').length+' 人 · 待账号关联 '+imports.filter(m=>m.status==='awaiting_account').length+' 人';
  const rank={pending:0,approved:1,awaiting_account:2};
  roster=[...data.members,...imports.map(m=>({...m,imported:true}))].sort((a,b)=>(rank[a.status]??3)-(rank[b.status]??3)||String(a.student_no).localeCompare(String(b.student_no),'zh-CN',{numeric:true})||String(a.student_id||a.id).localeCompare(String(b.student_id||b.id)));selected.clear();render();
 }
 function render(){
  const list=$('enrollment-list');list.replaceChildren();const query=$('enrollment-search').value.trim().toLocaleLowerCase(),filter=$('enrollment-filter').value;
  const rows=roster.filter(m=>[m.display_name,m.student_no,m.email].some(v=>String(v||'').toLocaleLowerCase().includes(query))&&(filter==='all'||m.status===filter||filter==='history'&&!['approved','pending','awaiting_account'].includes(m.status)));
  totalPages=Math.max(1,Math.ceil(rows.length/20));page=Math.max(1,Math.min(page,totalPages));pageRows=rows.slice((page-1)*20,page*20);
  $('enrollment-page').textContent='共 '+rows.length+' 人 · '+page+' / '+totalPages+' 页';
  if(!rows.length)list.textContent=roster.length?'没有匹配的学生，请调整搜索或筛选。':'暂无学生申请或导入名单。';
  for(const m of pageRows.filter(m=>!m.imported)){const a=document.createElement('article'),h=document.createElement('h3'),p=document.createElement('p'),actions=document.createElement('div');actions.className='actions';h.textContent=m.display_name+' · '+m.student_no;p.textContent=m.email+' · '+labels[m.status];a.append(h,p,actions);a.dataset.studentId=m.student_id;
   if(m.status==='pending'&&batchSupported){const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.dataset.selectStudent=m.student_id;check.checked=selected.has(m.student_id);check.onchange=()=>{check.checked?selected.set(m.student_id,{student_id:m.student_id,revision:Number(m.revision),display_name:m.display_name,student_no:m.student_no}):selected.delete(m.student_id);buttons();};label.append(check,document.createTextNode(' 勾选 '+m.display_name+'（'+m.student_no+'）'));a.prepend(label);}
   if(m.phone){const phone=document.createElement('p');phone.textContent='电话：'+m.phone;a.insertBefore(phone,actions);}
   const options=active.class_ended_at?[]:m.status==='pending'?[['approved','通过'],['rejected','拒绝']]:m.status==='approved'?[['removed','移出班级']]:m.status==='removed'?[['pending','允许重新审核']]:[];
   for(const [decision,title]of options){const b=document.createElement('button');b.className='btn';b.textContent=title;b.onclick=()=>{if(!confirm(title+'：'+m.display_name+'（'+m.student_no+'）？'))return;task(async()=>{await api('review',{student_id:m.student_id,revision:Number(m.revision),decision});await load();});};actions.append(b);}list.append(a);
  }
  for(const m of pageRows.filter(m=>m.imported)){
   const a=document.createElement('article'),h=document.createElement('h3'),p=document.createElement('p'),phone=document.createElement('p');h.textContent=m.display_name+' · '+m.student_no;
   p.textContent=m.email+' · '+(m.status==='awaiting_account'?(active.class_ended_at?'结课时尚未关联账号；结课期间不会自动入班':'待账号关联：学生验证此邮箱并登录后自动加入'):'原关联账号已删除，请联系管理员');
   phone.textContent='电话：'+(m.phone||'未填写');a.append(h,p,phone);
   if(m.status==='awaiting_account'&&!active.class_ended_at){
    const b=document.createElement('button');b.type='button';b.className='btn';b.textContent='撤销此导入';
    b.onclick=()=>{if(confirm('撤销 '+m.display_name+' 的待关联名单？撤销后，该邮箱不会通过这条导入自动入班。'))task(async()=>{await api('import_remove',{id:m.id,revision:Number(m.revision)});await load();});};a.append(b);
   }
   list.append(a);
  }
  buttons();
 }
 $('enrollment-search').oninput=$('enrollment-filter').onchange=()=>{page=1;selected.clear();render();};
 for(const [id,step] of [['enrollment-prev',-1],['enrollment-next',1]])$(id).onclick=()=>{page+=step;selected.clear();render();$('enrollment-tools').scrollIntoView({block:'start'});};
 $('enrollment-select-page').onchange=e=>{selected.clear();if(e.target.checked)for(const m of pageRows.filter(m=>m.status==='pending'))selected.set(m.student_id,{student_id:m.student_id,revision:Number(m.revision),display_name:m.display_name,student_no:m.student_no});render();};
 for(const [id,decision,title] of [['enrollment-approve','approved','通过'],['enrollment-reject','rejected','拒绝']])$(id).onclick=()=>{
  if(busy||!batchSupported||!selected.size)return;const members=[...selected.values()];
  if(!confirm('确认'+title+'以下 '+members.length+' 名学生加入“'+active.name+'”的申请？\n\n'+members.map(m=>m.display_name+'（'+m.student_no+'）').join('\n')))return;
  task(async()=>{await api('review_batch',{decision,members:members.map(({student_id,revision})=>({student_id,revision}))});for(const m of roster)if(selected.has(m.student_id)){m.status=decision;m.revision=Number(m.revision)+1;}selected.clear();render();try{await load();return '已'+title+' '+members.length+' 名学生的入班申请。';}catch{return '审核已完成，但名单刷新失败，请点击“刷新名单”。';}});
 };
 $('enrollment-close').onclick=()=>{if(!busy)root.classList.add('hidden');};root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();$('enrollment-close').click();}});
 for(const [id,op]of [['invite-create','invite_create'],['invite-rotate','invite_rotate'],['invite-disable','invite_disable']])$(id).onclick=()=>{if(op!=='invite_create'&&!confirm(op==='invite_disable'?'关闭新入班申请？现有成员不受影响。':'更换后旧入班码立即失效，现有成员不受影响，继续？'))return;task(async()=>{await api(op);await load();});};
 $('enrollment-refresh').onclick=()=>task(load);
 $('enrollment-import').onclick=()=>{
  if(busy||!importSupported||!window.MatinRosterImport)return;
  const row={id:active.id,name:active.name};
  window.MatinRosterImport.open(row,(op,data)=>window.MatinAccount.api({action:'membership',op,data:{...data,class_id:row.id}}),async()=>{if(active?.id===row.id)await load();});
 };
 window.MatinEnrollment={open(row){if(busy)return;active=row;importSupported=false;batchSupported=false;roster=[];page=1;selected.clear();$('enrollment-search').value='';$('enrollment-filter').value='all';render();$('enrollment-title').textContent=row.name+' · 学生与入班审核';$('enrollment-list').replaceChildren();$('enrollment-summary').textContent='';$('enrollment-invite').replaceChildren();root.classList.remove('hidden');task(load);}};
})();
