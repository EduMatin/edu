/* Private task reports: explicit student submission, versioned teacher feedback. */
(() => {'use strict';
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const btn=(text,fn,primary=false)=>{const b=el('button',text,'btn'+(primary?' primary':''));b.type='button';b.onclick=fn;return b;};
 const reviewLabel=v=>({pending_review:'待教师批阅',revision_required:'需修改重交',passed:'已通过'}[v]||'已提交');
 const scoreLabel=v=>v===null||v===undefined?'未评分':String(v)+' / 100';
 const time=v=>v?new Date(v).toLocaleString('zh-CN'):'—';
 const root=el('div',undefined,'tr-layer');root.id='task-reports-modal';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','tr-title');
 const panel=el('div',undefined,'tr-panel'),head=el('header'),heading=el('h2');heading.id='tr-title';
 const closeButton=btn('关闭',()=>close()),body=el('div',undefined,'tr-body'),foot=el('footer'),status=el('p',undefined,'tr-status');status.setAttribute('role','status');
 const reviewUpdate=el('div',undefined,'tr-note');reviewUpdate.id='student-report-update';reviewUpdate.hidden=true;
 const updateText=el('p'),updateButton=btn('查看最新批阅',()=>{const c=current;if(c&&!c.teacher&&canLeave())run(c,()=>readReport(c,null));});
 updateText.setAttribute('role','status');reviewUpdate.append(updateText,updateButton);
 head.append(heading,closeButton);panel.append(head,status,reviewUpdate,body,foot);root.append(panel);document.body.append(root);
 const css=el('style');css.textContent=`
 .tr-layer{position:fixed;inset:0;z-index:160;background:#101a3db8;display:flex;align-items:center;justify-content:center;padding:20px;color:#253555}
 .tr-layer[hidden]{display:none!important}.tr-panel{background:#fff;border-radius:24px;width:min(1150px,100%);max-height:94vh;display:flex;flex-direction:column;box-shadow:0 24px 100px #101a3d50;min-width:0}
 .tr-panel>header,.tr-panel>footer{padding:18px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;flex-shrink:0}.tr-panel h2{font-size:22px;margin:0}.tr-panel h3{margin:12px 0;font-size:18px}.tr-panel h4{margin:8px 0}.tr-panel p{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7;margin:8px 0}
 .tr-panel>header{border-bottom:1px solid #e4e9f4}.tr-panel>footer{border-top:1px solid #e4e9f4}.tr-panel>footer:empty{display:none}.tr-body{padding:4px 24px 24px;overflow:auto;min-height:0}.tr-status{padding:0 24px;color:#80521d;flex-shrink:0}.tr-muted{color:#697a97;font-size:13px}
 .tr-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}.tr-stat{padding:16px;background:#f3f5fe;border:1px solid #e1e6f5;border-radius:14px}.tr-stat strong{display:block;font-size:27px;color:#4b4ed1}
 .tr-toolbar,.tr-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.tr-toolbar{margin:18px 0}.tr-toolbar label{display:grid;gap:5px;font-size:13px}.tr-toolbar input{min-width:260px}
 .tr-layer input,.tr-layer select,.tr-layer textarea{font:inherit;color:inherit;background:#fff;padding:10px 12px;border:1px solid #ccd6e9;border-radius:10px;max-width:100%;box-sizing:border-box}.tr-layer textarea{width:100%;min-height:88px;resize:vertical}.tr-layer :focus-visible{outline:3px solid #bac6ff;outline-offset:2px}.tr-layer :disabled{opacity:.55;cursor:wait}
 .tr-table-wrap{overflow:auto}.tr-table{width:100%;border-collapse:collapse;font-size:14px}.tr-table th,.tr-table td{padding:13px 10px;border-bottom:1px solid #e5eaf4;text-align:left;vertical-align:top;overflow-wrap:anywhere}.tr-table th{background:#f6f8fd;color:#657594;white-space:nowrap}.tr-table small{display:block;margin-top:4px;color:#72829e}.tr-table .tr-status-label{font-weight:700;color:#3a4d71}.tr-table .tr-late{color:#ae561f}
 .tr-report-section,.tr-message{padding:16px;border:1px solid #dfe6f3;border-radius:12px;margin:12px 0;overflow-wrap:anywhere}.tr-message.user{border-left:4px solid #6c68e5}.tr-note{padding:12px 16px;border-radius:12px;background:#f3f5ff;line-height:1.7}.tr-feedback{border-left:4px solid #42a69b;padding:10px 14px;background:#f0faf7;margin:10px 0;white-space:pre-wrap;overflow-wrap:anywhere}.tr-report-section label{display:grid;gap:8px}
 @media(max-width:650px){.tr-layer{padding:8px}.tr-panel{max-height:96vh;border-radius:16px}.tr-panel>header,.tr-panel>footer{padding:14px}.tr-body{padding:0 14px 14px}.tr-status{padding:0 14px}.tr-summary{grid-template-columns:repeat(2,1fr)}.tr-toolbar input{min-width:0;width:100%}.tr-toolbar label{width:100%}.tr-table thead{display:none}.tr-table tr{display:block;border:1px solid #dfe6f3;border-radius:12px;padding:10px;margin:12px 0}.tr-table td{display:block;border:0;padding:5px 0}.tr-table td:before{content:attr(data-label)'：';color:#73829a}.tr-panel h2{font-size:19px}}
 `;document.head.append(css);
 css.textContent+='#student-report-update{margin:0 24px 8px;border-left:4px solid #c77a29;max-height:24vh;overflow:auto;flex-shrink:0;background:#fff6e8}#student-report-update[hidden]{display:none!important}';
 css.textContent+='.tr-sequence{border-left:4px solid #6461dd;margin:12px 0}.tr-sequence strong{display:block}.tr-panel>footer .tr-sequence-actions{display:flex;gap:8px;flex-wrap:wrap;width:100%;align-items:center}.tr-sequence-actions .tr-muted{flex:1;min-width:150px}.tr-panel>footer{max-height:34vh;overflow:auto}';
 let current=null;
 function reviewSignature(t){return [Number(t?.submission_version)||0,Number(t?.feedback_revision)||0,t?.review_status||''];}
 function updateReviewNotice(){
  const c=current;if(!c||c.teacher||!isCurrent(c)){reviewUpdate.hidden=true;return;}
  const task=window.MatinTasks?.studentState().tasks.find(t=>t.id===c.task.id),seen=c.reviewSeen||reviewSignature(c.task),now=reviewSignature(task);
  const newer=now[0]>seen[0]||now[0]===seen[0]&&(now[1]>seen[1]||now[1]===seen[1]&&now[2]!==seen[2]);
  reviewUpdate.hidden=!task||!newer||!['revision_required','passed'].includes(task.review_status);
  if(reviewUpdate.hidden)return;
  const message=task.review_status==='revision_required'?'教师已退回报告：'+task.revision_reason+'\n重交截止：'+time(task.resubmit_due_at):'教师已通过报告，可查看最新批阅结果。';
  const text=message+'\n下方保留上次读取的内容，点击“查看最新批阅”更新。'+(c.dirty?'\n当前输入已保留，查看最新批阅前请先处理尚未保存的内容。':'');
  if(updateText.textContent!==text)updateText.textContent=text;
  updateButton.disabled=!!c.busy;
 }
 window.addEventListener('matin-student-tasks-changed',updateReviewNotice);
 window.addEventListener('matin-student-auth-changed',updateReviewNotice);
 function isCurrent(c){return current===c&&c.owner===(c.teacher?window.MatinAccount?.userId:window.MatinStudent?.userId);}
 function releaseDraft(c){c?.draft?.dispose();if(c)c.draft=null;}
 function draftChanged(c){c.dirty=true;c.draft?.changed();}
 function canLeave(){return !current?.dirty||current.draft?.flush()||confirm('本机草稿未能保存。建议取消并导出草稿；仍要离开并放弃当前输入吗？');}
 function bindDraft(c,kind,baseline,read,apply,editable=true){
  if(!window.MatinReportDrafts||!c.owner||c.owner==='guest')return;
  c.draft=MatinReportDrafts.mount({container:body,scope:[String(window.MATIN_CLOUD?.supabaseUrl||'').replace(/\/+$/,''),c.owner,kind,c.task.id,c.teacher?c.student.student_id:c.owner],baseline,initial:read(),read,apply,editable,isOwner:()=>isCurrent(c),onDirty:value=>c.dirty=value});
 }
 window.addEventListener('beforeunload',e=>{if(current?.dirty&&!current.draft?.flush()){e.preventDefault();e.returnValue='';}});
 window.addEventListener('pagehide',()=>{current?.draft?.flush();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)current?.draft?.flush();});
 function close(){if(current?.busy&&current.writing){status.textContent='正在保存，请稍候。';return;}if(!canLeave())return;const c=current;releaseDraft(c);current=null;root.hidden=true;if(c?.under)c.under.inert=false;if(c?.opener?.isConnected)c.opener.focus();window.dispatchEvent(new CustomEvent('matin-report-closed'));}
 function begin(teacher,task){if(current?.busy||!canLeave())return null;releaseDraft(current);if(current?.under)current.under.inert=false;reviewUpdate.hidden=true;
  const under=[...document.querySelectorAll('.modal-layer:not(.hidden)')].filter(n=>n!==root&&n.getClientRects().length).at(-1);
  const c={teacher,task,owner:teacher?window.MatinAccount?.userId:window.MatinStudent?.userId,opener:document.activeElement,under,busy:false,dirty:false,rows:[],filter:'current',search:''};current=c;if(under)under.inert=true;root.hidden=false;body.replaceChildren();foot.replaceChildren();status.textContent='';heading.textContent=task.title;closeButton.focus();return c;
 }
 const api=(c,op,data={})=>c.teacher?MatinAccount.api({action:'task_review',op,data:{task_id:c.task.id,...data}}):MatinStudent.api(op,{task_id:c.task.id,...data},'task_review');
 async function run(c,fn,writing=false){if(!isCurrent(c)||c.busy)return;c.busy=true;c.writing=writing;root.setAttribute('aria-busy','true');status.textContent=writing?'正在保存…':'正在读取…';lock();try{await fn();}catch(e){if(isCurrent(c))status.textContent=e.message||'请求失败，请重试。';}finally{if(isCurrent(c)){c.busy=false;c.writing=false;root.setAttribute('aria-busy','false');lock();updateReviewNotice();if(!root.contains(document.activeElement))closeButton.focus();}}}
 function lock(){root.querySelectorAll('.rd-draft').forEach(e=>e.inert=!!current?.busy);root.querySelectorAll('button,input,textarea,select').forEach(e=>e.disabled=!!current?.busy||e.dataset.fixedDisabled==='true');closeButton.disabled=!!(current?.busy&&current.writing);}
 const label=r=>r.review_status==='revision_required'?'需修改重交'+(r.overdue?' · 已逾期':''):r.status==='submitted'?reviewLabel(r.review_status)+(r.late?' · 逾期补交':''):r.overdue?'逾期未交 · '+(r.status==='pending'?'未开始':'进行中'):r.status==='pending'?'未开始':'进行中';
 const filterRow=(c,r)=>{
  const match=c.filter==='all'||c.filter==='former'&&r.membership!=='approved'||r.membership==='approved'&&(
   c.filter===r.review_status||c.filter==='current'||c.filter==='overdue'&&r.overdue||c.filter==='late'&&r.late||c.filter==='pending'&&r.status==='pending'&&!r.overdue||c.filter==='started'&&r.status==='started'&&!r.overdue||c.filter==='submitted'&&r.status==='submitted');
  return match&&[r.display_name,r.student_no,r.email].join(' ').toLowerCase().includes(c.search.toLowerCase().trim());
 };
 async function roster(c){const d=await api(c,'roster');if(!isCurrent(c))return;if(!Array.isArray(d.rows))throw Error('明细读取失败，请确认数据库升级。');c.rows=d.rows;c.roster=d;c.task=d.task;showRoster(c);status.textContent='已读取最新完成明细';}
 function showRoster(c){releaseDraft(c);c.dirty=false;heading.textContent=c.roster.class_name+' · '+c.task.title;body.replaceChildren();foot.replaceChildren();if(c.task.class_ended_at)body.append(el('p','已结束教学 · 以下为只读完成明细，可查看报告与导出名单。','tr-note'));
  body.append(el('p','截至 '+time(new Date())+' · 截止时间 '+time(c.task.due_at)+(c.task.active?'':' · 任务已撤回'),'tr-muted'));
  const summary=el('div',undefined,'tr-summary'),members=c.rows.filter(r=>r.membership==='approved');
  for(const [name,count] of [['未开始',members.filter(r=>r.status==='pending'&&!r.overdue).length],['进行中',members.filter(r=>r.status==='started'&&!r.overdue).length],['待批阅',members.filter(r=>r.review_status==='pending_review'||!r.review_status&&r.status==='submitted').length],['需修改',members.filter(r=>r.review_status==='revision_required').length],['已通过',members.filter(r=>r.review_status==='passed').length],['逾期未交',members.filter(r=>r.overdue).length]]){const cell=el('div',name,'tr-stat');cell.append(el('strong',count));summary.append(cell);}body.append(summary);
  body.append(el('p',`统计当前已加入的 ${members.length} 名学生；待账号关联 ${c.roster.awaiting_accounts||0} 人。已退出或移出的提交记录可在筛选中查看。`,'tr-muted'));
  body.append(el('p','“已提交”表示已收到报告，不代表教师评分或通过。旧版自报完成、尚未提交报告的学生仍需提交。时间按当前设备时区显示。','tr-note'));
  const toolbar=el('div',undefined,'tr-toolbar'),searchLabel=el('label','搜索学生'),search=el('input');search.placeholder='姓名、学号或邮箱';search.value=c.search;search.type='search';searchLabel.append(search);
  const selectLabel=el('label','状态筛选'),select=el('select');for(const [v,l] of [['current','当前全班'],['pending','未开始'],['started','进行中'],['submitted','已提交'],['pending_review','待教师批阅'],['revision_required','需修改重交'],['passed','已通过'],['overdue','逾期未交'],['late','逾期补交'],['former','已退出 / 移出'],['all','全部（含历史成员）']]){const o=el('option',l);o.value=v;select.append(o);}select.value=c.filter;selectLabel.append(select);
  toolbar.append(searchLabel,selectLabel,btn('刷新明细',()=>run(c,()=>roster(c))),btn('导出当前筛选名单',()=>exportRoster(c)));body.append(toolbar);
  const count=el('p',undefined,'tr-muted'),wrap=el('div',undefined,'tr-table-wrap');body.append(count,wrap);
  function draw(){wrap.replaceChildren();const filtered=c.rows.filter(r=>filterRow(c,r));count.textContent='当前显示 '+filtered.length+' 人';if(!filtered.length){wrap.append(el('p','暂无符合条件的学生。'));return;}
   const table=el('table',undefined,'tr-table'),thead=el('thead'),tr=el('tr');const titles=['学生','状态','最近打开 / 提交','提交时间','报告与批阅'];titles.forEach(t=>tr.append(el('th',t)));thead.append(tr);table.append(thead);const tbody=el('tbody');
   for(const r of filtered){const row=el('tr');row.dataset.studentId=r.student_id;const cells=titles.map(t=>{const td=el('td');td.dataset.label=t;row.append(td);return td;});
    cells[0].append(el('strong',r.display_name),el('small','学号 '+r.student_no),el('small',r.email||''));if(r.membership!=='approved')cells[0].append(el('small','历史成员 · '+r.membership));
    cells[1].append(el('span',label(r),'tr-status-label'+(r.overdue||r.late?' tr-late':'')));if(r.resubmit_due_at)cells[1].append(el('small','重交截止 '+time(r.resubmit_due_at)));if(r.legacy_completed)cells[1].append(el('small','旧版自报完成 · 尚未提交报告'));
    if(c.roster.grading_version===1&&r.version)cells[1].append(el('small','教师评分：'+scoreLabel(r.teacher_score)));
    cells[2].textContent=time(r.updated_at);cells[3].textContent=time(r.submitted_at);
    if(r.version){cells[4].append(btn('查看报告 / 批注',()=>run(c,()=>startReport(c,r,{sequence:async()=>c.rows.filter(x=>x.version&&filterRow(c,x)).map(student=>({task:{...c.task},student})),sequenceLabel:'当前任务 · 按名单筛选'}))),el('small',r.reviewed_at?'已批注 · 第 '+r.version+' 版':'待批注 · 第 '+r.version+' 版'));}else cells[4].textContent='尚无已提交报告';tbody.append(row);
   }table.append(tbody);wrap.append(table);
  }
  search.oninput=()=>{c.search=search.value;draw();};select.onchange=()=>{c.filter=select.value;draw();};draw();
  foot.append(el('span','浏览器中的未提交对话不会自动发送给教师。','tr-muted'),btn('关闭明细',()=>close()));
 }
 function csvValue(value){let s=String(value??'');if(/^[\s]*[=+\-@]|^[\t\r\n]|^0\d/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
 function exportRoster(c){const rows=c.rows.filter(r=>filterRow(c,r)),headers=['班级','任务','姓名','学号','邮箱','成员状态','学习状态','旧版自报完成未交报告','截止时间','最近打开或提交','提交时间','报告版本','批注时间','批阅结果','修改要求','重交截止','教师评分（百分制）'];
  const data=[headers,...rows.map(r=>[c.roster.class_name,c.task.title,r.display_name,r.student_no,r.email,r.membership==='approved'?'在班':'历史成员',label(r),r.legacy_completed?'是':'否',time(c.task.due_at),time(r.updated_at),time(r.submitted_at),r.version||'',time(r.reviewed_at),r.review_status?reviewLabel(r.review_status):'',r.revision_reason||'',time(r.resubmit_due_at),r.teacher_score??'未评分'])];
  const blob=new Blob(['\ufeff'+data.map(row=>row.map(csvValue).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=(c.roster.class_name+'-'+c.task.title+'-任务明细').replace(/[\\/:*?"<>|]/g,'_').slice(0,90)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='已导出当前筛选的 '+rows.length+' 名学生（CSV UTF-8）。';
 }
 async function readReport(c,row,version){const d=await api(c,'report',{student_id:row?.student_id,version});if(!isCurrent(c))return;c.reportData=d;c.student=row;showReport(c,d);status.textContent='已读取第 '+d.submission.version+' 版报告';if(!c.teacher)window.dispatchEvent(new CustomEvent('matin-student-report-read',{detail:{task_id:c.task.id,version:d.submission.version}}));}
 const sameEntry=(e,c,row=c.student)=>e.task.id===c.task.id&&e.student.student_id===row?.student_id;
 async function startReport(c,row,options={}){
  c.sequence=null;c.sequenceIndex=0;
  c.sequenceLabel=options.sequenceLabel||'当前任务 · 全部已提交报告';
  c.sequenceSource=options.sequence||(async()=>{const d=await api(c,'roster');return d.rows.filter(r=>r.version).map(student=>({task:{...d.task,class_name:d.class_name},student}));});
  let warning='';try{await loadSequence(c,row);}catch(e){warning='连续队列暂未读取：'+e.message+'。可先批阅本份，或重试读取队列。';}
  if(!isCurrent(c))return;await readReport(c,row);if(warning&&isCurrent(c))status.textContent=warning;
 }
 async function loadSequence(c,row=c.student){const entries=await c.sequenceSource();if(!isCurrent(c))return;
  const seen=new Set();c.sequence=entries.filter(e=>{const key=e.task.id+':'+e.student.student_id;if(seen.has(key))return false;seen.add(key);return true;});
  let index=c.sequence.findIndex(e=>sameEntry(e,c,row));if(index<0){c.sequence.unshift({task:{...c.task},student:row});index=0;}c.sequenceIndex=index;
 }
 async function navigateReport(c,step,{saved=false}={}){
  const index=c.sequenceIndex+step,entry=c.sequence?.[index];if(!entry){status.textContent=saved?'本份已保存，已到本次队列末尾。':'已到本次队列边界。';return;}
  if(!canLeave())return;
  let d;try{d=await api(c,'report',{task_id:entry.task.id,student_id:entry.student.student_id});}catch(e){throw Error((saved?'本份已保存；':'')+'切换报告失败：'+e.message+'。当前报告和输入仍保留，可点击“下一份”重试。');}
  if(!isCurrent(c))return;
  releaseDraft(c);c.task={...entry.task};c.student=entry.student;c.sequenceIndex=index;c.annotationSignature=c.decisionSignature=null;c.annotationMutation=c.decisionMutation=null;
  showReport(c,d);body.scrollTop=0;heading.tabIndex=-1;heading.focus();
  status.textContent=(saved?'上一份已保存。':'')+'已读取 '+c.student.display_name+' 的第 '+d.submission.version+' 版报告'+(entry.student.version&&entry.student.version!==d.submission.version?'（学生已有新提交，已显示最新版）':'')+'。';
 }
 function reportBody(report,container,{annotations=[],editable=false,archive=false,onChange=()=>{}}={}){
  const nodes=new Map((report.nodes||[]).map(n=>[n.id,n.name]));
  container.append(el('p','项目：'+report.project_title+' · 当前阶段：'+(nodes.get(report.node_id)||report.node_id),'tr-muted'));
  container.append(el('p','学习路径：'+(report.visited||[]).map(id=>nodes.get(id)||id).join(' → '),'tr-muted'));
  container.append(el('p','路线状态：'+(report.completion?'学生已结束本次路线':'学习中')+(archive?'。内容来自云端已同步记录，AI 评价仅供参考。':'。报告内容来自学生提交的学习记录，AI 评价仅供参考。'),'tr-note'));
  if(report.summary){const summary=el('section',undefined,'tr-report-section');summary.append(el('h3','学生学习总结'),el('p',report.summary));container.append(summary);}
  function paged(items,size,draw,label){
   const section=el('section'),content=el('div'),nav=el('div',undefined,'tr-toolbar');let page=0;
   const count=el('span',undefined,'tr-muted'),prev=btn('上一页'+label,()=>{if(page>0){page--;render();}}),next=btn('下一页'+label,()=>{if((page+1)*size<items.length){page++;render();}});
   function render(){content.replaceChildren();items.slice(page*size,(page+1)*size).forEach((item,i)=>draw(item,page*size+i,content));count.textContent=label+' · 共 '+items.length+' 条 · '+(page+1)+' / '+Math.max(1,Math.ceil(items.length/size))+' 页';prev.disabled=page===0;next.disabled=(page+1)*size>=items.length;prev.dataset.fixedDisabled=String(prev.disabled);next.dataset.fixedDisabled=String(next.disabled);}
   nav.append(count);if(!archive||items.length>size)nav.append(prev,next);section.append(nav,content);container.append(section);render();
  }
  container.append(el('h3','阶段评价（AI 建议）'));
  paged(report.evaluations||[],10,(e,i,target)=>{const d=e.result||{},box=el('section',undefined,'tr-report-section');box.append(el('h4',(nodes.get(e.node_id)||e.node_id)+' · '+(d.score??'—')+' 分'),el('p',d.feedback||''));for(const k of Array.isArray(d.criteria)?d.criteria:[])box.append(el('p',(k.met?'✓ ':'△ ')+(k.name||'')+'：'+(k.comment||'')));box.append(el('p',d.nextStep||''));window.MatinLongContext?.renderEvidence(box,d,(report.messages||[]).filter(m=>m.node_id===e.node_id&&m.role==='user').map(m=>m.text));target.append(box);},'阶段评价');
  if(!report.evaluations?.length)container.append(el('p',archive?'尚无已同步阶段评价。':'未提交阶段评价。','tr-muted'));
  container.append(el('h3','完整学习对话'));
  // Keep edited notes for every page; only create DOM for the visible messages.
  const inputs=new Map(annotations.map(a=>[a.message_index,{value:a.text}]));
  paged(report.messages||[],30,(m,i,target)=>{
   const section=el('section',undefined,'tr-message '+m.role);section.append(el('h4',`${i+1}. ${m.role==='user'?'学生':m.sender||'导师'} · ${nodes.get(m.node_id)||m.node_id}`),el('p',m.text),el('small',m.at||'','tr-muted'));
   const existing=inputs.get(i)?.value||'';
   if(editable){const area=el('label','教师批注'),input=el('textarea'),toggle=btn('添加 / 编辑本条批注',()=>{area.hidden=!area.hidden;if(!area.hidden)input.focus();});input.maxLength=1000;input.value=existing;input.oninput=()=>{inputs.set(i,{value:input.value});onChange();};area.append(input);area.hidden=!existing;section.append(toggle,area);}else if(existing)section.append(el('div','教师批注：'+existing,'tr-feedback'));target.append(section);
  },'对话');return inputs;
 }

 function showReport(c,d,keepDecision){releaseDraft(c);c.reportData=d;c.dirty=false;heading.textContent=(c.teacher?c.student.display_name+' · ':'我的报告 · ')+c.task.title;body.replaceChildren();foot.replaceChildren();const s=d.submission,editable=c.teacher&&!d.class_ended_at;
  if(c.teacher&&c.sequence){const info=el('div',undefined,'tr-note tr-sequence');info.append(el('strong',c.sequenceLabel+' · 第 '+(c.sequenceIndex+1)+' / '+c.sequence.length+' 份'),el('span',[c.task.class_name||'',c.student.display_name,c.student.student_no?'学号 '+c.student.student_no:'',c.task.title].filter(Boolean).join(' · ')),el('p','按打开时的名单连续查看，切换时读取最新报告；新增提交可返回名单刷新。','tr-muted'));body.append(info);}
  else if(c.teacher&&c.sequenceSource)body.append(btn('重试读取连续队列',()=>run(c,async()=>{await loadSequence(c);if(isCurrent(c)){if(!canLeave())return;showReport(c,c.reportData);status.textContent='连续队列已读取。';}})));
  if(d.class_ended_at)body.append(el('p','班级已结束教学 · 只读档案。保留原评分、批注、结论及报告版本。','tr-note'));
  const newest=d.versions[0],historical=s.version!==newest.version;
  const known=window.MatinTasks?.studentState().tasks.find(t=>t.id===c.task.id&&Number(t.submission_version)===Number(newest.version));
  c.reviewSeen=[Number(newest.version),historical?Number(known?.feedback_revision)||0:Number(s.feedback_revision)||0,newest.review_status||''];reviewUpdate.hidden=true;
  body.append(el('p',historical?'历史版本 · 第 '+s.version+' 版当时的结果：'+reviewLabel(s.review_status):reviewLabel(s.review_status),'tr-note'));if(s.review_status==='revision_required')body.append(el('p',(historical?'本版本的修改要求：':'修改要求：')+s.revision_reason+'\n重交截止：'+time(s.resubmit_due_at),'tr-feedback'));
  body.append(el('p',`第 ${s.version} 版 · 提交于 ${time(s.submitted_at)}${d.late?' · 逾期补交':''}`,'tr-muted'));
  const tools=el('div',undefined,'tr-toolbar'),versionLabel=el('label','提交版本'),versions=el('select');for(const v of d.versions){const option=el('option','第 '+v.version+' 版 · '+time(v.submitted_at)+(v.review_status?' · '+reviewLabel(v.review_status):''));option.value=v.version;versions.append(option);}versions.value=s.version;versionLabel.append(versions);tools.append(versionLabel);
  versions.setAttribute('aria-label','提交版本');versions.onchange=()=>{if(!canLeave()){versions.value=s.version;return;}run(c,()=>readReport(c,c.student,Number(versions.value)));};
  if(c.teacher)tools.append(btn('返回完成明细',()=>{if(canLeave())run(c,()=>roster(c));}));body.append(tools);
  if(s.attachments?.length){const attachments=el('section');body.append(attachments);if(window.MatinReportFiles)MatinReportFiles.view(attachments,s.attachments,c.teacher);else attachments.append(el('p','本版有 '+s.attachments.length+' 个附件，但附件组件未加载，请刷新页面或联系教师补传网页文件。','tr-note'));}
  if(historical)body.prepend(el('p','正在查看历史版本；最新为第 '+newest.version+' 版，'+reviewLabel(newest.review_status)+'。'+(c.teacher?'这里的批注只保存到当前版本。请切换到最新版本作出批阅结论。':'请切换到最新版本查看当前批阅结果。'),'tr-note'));
  const feedbackSection=el('section',undefined,'tr-report-section');feedbackSection.append(el('h3','教师总评'));
  let feedback,grade,reason,due,reviewTools,nextAction,actionHint;
  function updateActionHint(){if(actionHint)actionHint.textContent=nextAction.value==='passed'?'确认后通过本份报告，并继续下一份。':nextAction.value==='revision_required'?'确认后发布修改要求与重交期限，并继续下一份。':'仅保存不会通过报告或发布退回要求。';}
  if(d.grading_version===1){
   const grading=el('section',undefined,'tr-report-section');grading.append(el('h3','教师评分'));
   if(editable){const gradeLabel=el('label','本版报告得分（0–100，选填）');grade=el('input');grade.type='text';grade.inputMode='decimal';grade.maxLength=8;grade.setAttribute('aria-label','教师评分');grade.placeholder='未评分';grade.value=s.teacher_score??'';grade.oninput=()=>draftChanged(c);gradeLabel.append(grade);grading.append(gradeLabel,el('p','最多1位小数；留空表示未评分。保存后学生可见。分数与通过／退回结论分别记录，AI建议分不会自动计入。','tr-muted'));}
   else grading.append(el('strong',scoreLabel(s.teacher_score)),el('p','教师对本版报告的评分，与AI阶段建议分分别记录。','tr-muted'));
   body.append(grading);
  }else if(editable)body.append(el('p','评分功能需要更新教师批阅提醒与评分 SQL；原报告仍可批注。','tr-muted'));
  function gradeData(){if(!grade)return {};const value=grade.value===''?null:Number(grade.value);if(grade.validity.badInput||value!==null&&(!Number.isFinite(value)||value<0||value>100||Math.round(value*10)/10!==value))throw Error('教师评分须为0至100，最多保留1位小数。');return {teacher_score:value};}
  if(editable){feedback=el('textarea');feedback.maxLength=5000;feedback.setAttribute('aria-label','教师总评');feedback.placeholder='填写总体反馈，或在具体对话下添加批注';feedback.value=s.feedback;feedback.oninput=()=>draftChanged(c);feedbackSection.append(feedback);}else feedbackSection.append(el('p',s.feedback||'教师尚未填写总评。','tr-feedback'));
  feedbackSection.append(el('p',s.reviewed_at?'批注更新于 '+time(s.reviewed_at):'尚未批注','tr-muted'));body.append(feedbackSection);
  const conversation=el('div');body.append(conversation);
  let inputs=reportBody(s.report,conversation,{annotations:s.annotations,editable,onChange:()=>draftChanged(c)});
  const annotations=()=>{const values=[...inputs].filter(([,input])=>input.value.trim()).map(([message_index,input])=>({message_index,text:input.value.trim()}));if(values.length>100)throw Error('每版报告最多批注100条对话。');return values;};
  if(editable){
   async function saveAnnotation(){
    const data={student_id:c.student.student_id,version:s.version,feedback_revision:s.feedback_revision,feedback:reviewTools?reviewTools.feedbackValue():feedback.value,annotations:annotations(),...gradeData()};
    const signature=JSON.stringify(data);if(c.annotationSignature!==signature){c.annotationSignature=signature;c.annotationMutation=crypto.randomUUID();}
    const pendingDecision=reason?{reason:reason.value,due:due.value}:null;const saved=await api(c,'annotate',{...data,mutation_id:c.annotationMutation});if(!isCurrent(c))return false;c.draft?.commit();c.dirty=false;showReport(c,saved,pendingDecision);status.textContent='评分与批注已保存；批阅结论请使用“通过报告”或“退回修改”。';
    window.dispatchEvent(new CustomEvent('matin-report-reviewed',{detail:{task_id:c.task.id}}));
    return true;
   }
   foot.append(btn(d.grading_version===1?'保存评分与批注':'保存批注',()=>run(c,saveAnnotation,true)));
   let decide;
   if(d.workflow_version===2&&s.version===d.versions[0].version&&c.task.active!==false){
    const decision=el('section',undefined,'tr-report-section'),reasonLabel=el('label','修改要求（退回时必填）'),dueLabel=el('label','重交截止时间');reason=el('textarea');due=el('input');
    reason.setAttribute('aria-label','修改要求');reason.maxLength=2000;reason.placeholder='明确说明需要补充或修改的内容';reason.value=s.revision_reason||'';reason.oninput=()=>draftChanged(c);reasonLabel.append(reason);
    due.type='datetime-local';due.setAttribute('aria-label','重交截止时间');if(s.resubmit_due_at){const dt=new Date(s.resubmit_due_at);due.value=new Date(dt.getTime()-dt.getTimezoneOffset()*60000).toISOString().slice(0,16);}due.oninput=()=>draftChanged(c);dueLabel.append(due);
    decision.append(el('h3','批阅结论'),el('p','通过后，学生保留查看入口；退回修改会重新进入学生待办，保留原学习进度。退回时请填写修改要求和未来的重交期限，该期限仅适用于这名学生。','tr-muted'),reasonLabel,dueLabel);feedbackSection.after(decision);
    decide=async value=>{
     const data={student_id:c.student.student_id,version:s.version,feedback_revision:s.feedback_revision,feedback:reviewTools?reviewTools.feedbackValue():feedback.value,annotations:annotations(),...gradeData(),review_status:value,revision_reason:value==='revision_required'?reason.value.trim():'',resubmit_due_at:value==='revision_required'&&due.value?new Date(due.value).toISOString():null};
     if(value==='revision_required'&&(!data.revision_reason||!data.resubmit_due_at||Date.parse(data.resubmit_due_at)<=Date.now()))throw Error('请填写修改要求，并设置未来的重交截止时间。');
     if(!confirm(value==='passed'?'确认通过这份报告？结论、评分与当前批注将一起保存。':'确认退回修改？学生将收到修改要求和重交期限，原报告与批注保留。'))return;
     const signature=JSON.stringify(data);if(c.decisionSignature!==signature){c.decisionSignature=signature;c.decisionMutation=crypto.randomUUID();}
     const saved=await api(c,'decide',{...data,mutation_id:c.decisionMutation});if(!isCurrent(c))return;c.draft?.commit();c.dirty=false;showReport(c,saved);status.textContent=value==='passed'?'报告已通过。':'已退回修改，学生待办将显示修改要求和重交期限。';
     window.dispatchEvent(new CustomEvent('matin-report-reviewed',{detail:{task_id:c.task.id}}));
     return true;
    };
    foot.append(btn('通过报告',()=>run(c,()=>decide('passed'),true),!c.sequence),btn('退回修改',()=>run(c,()=>decide('revision_required'),true)));
   }
   const helpers=el('div');feedbackSection.before(helpers);
   if(window.MatinReviewTools)reviewTools=MatinReviewTools.mount({container:helpers,grade,feedback,reason,scope:[String(window.MATIN_CLOUD?.supabaseUrl||'').replace(/\/+$/,''),c.owner],onChange:()=>draftChanged(c),onError:message=>status.textContent=message});
   if(c.sequence){
    const actions=el('div',undefined,'tr-sequence-actions'),selectLabel=el('label','保存并继续时：');nextAction=el('select');nextAction.setAttribute('aria-label','连续批阅操作');nextAction.append(new Option('仅保存评分与批注','annotate'));if(decide){nextAction.append(new Option('通过报告并保存','passed'),new Option('退回修改并保存','revision_required'));}selectLabel.append(nextAction);nextAction.onchange=()=>{updateActionHint();draftChanged(c);};actionHint=el('span',undefined,'tr-muted');updateActionHint();
    actions.append(selectLabel,btn(c.sequenceIndex===c.sequence.length-1?'保存本份（最后一份）':'保存并批阅下一份',()=>run(c,async()=>{const action=nextAction.value;const saved=action==='annotate'?await saveAnnotation():await decide(action);if(saved&&isCurrent(c))await navigateReport(c,1,{saved:true});},true),true),actionHint);foot.prepend(actions);
   }
   foot.append(btn('重新读取报告',()=>{if(canLeave())run(c,()=>readReport(c,c.student));}));
  }else if(!c.teacher&&!d.class_ended_at&&s.review_status==='revision_required'&&s.version===d.versions[0].version){
   foot.append(btn('继续修改',()=>{if(!canLeave())return;const id=c.task.id;close();window.MatinTasks.openStudent(id);},true));
  }
  if(d.history?.length){const history=el('details',undefined,'tr-report-section');history.append(el('summary','批阅记录（'+d.history.length+'）'));for(const e of d.history){const line=el('p','第 '+e.version+' 版 · '+time(e.changed_at)+' · '+(e.event_type==='annotate'?'保存评分与批注':reviewLabel(e.after.review_status))+(Object.hasOwn(e.after,'teacher_score')?' · 评分：'+scoreLabel(e.before?.teacher_score)+' → '+scoreLabel(e.after.teacher_score):'')+(e.after.revision_reason?'\n修改要求：'+e.after.revision_reason+'\n重交截止：'+time(e.after.resubmit_due_at):''));history.append(line);}body.append(history);}
  if(c.teacher){
   const read=()=>({grade:grade?grade.value:String(s.teacher_score??''),feedback:feedback?feedback.value:s.feedback||'',annotations:[...inputs].map(([message_index,input])=>({message_index,text:input.value})),reason:reason?reason.value:s.revision_reason||'',due:due?due.value:'',...(reviewTools?{rubric:reviewTools.read()}:{}),...(nextAction?{nextAction:nextAction.value}:{})});
   const apply=value=>{
    if(!editable)return;
    if(grade)grade.value=String(value.grade??'').slice(0,8);if(feedback)feedback.value=String(value.feedback??'').slice(0,5000);
    if(reason)reason.value=String(value.reason??'').slice(0,2000);if(due)due.value=String(value.due??'');
    if(reviewTools)reviewTools.apply(value.rubric||{enabled:false,items:reviewTools.read().items});if(nextAction){nextAction.value=[...nextAction.options].some(o=>o.value===value.nextAction)?value.nextAction:'annotate';updateActionHint();}
    const notes=(Array.isArray(value.annotations)?value.annotations:[]).filter(a=>a&&Number.isInteger(a.message_index)&&a.message_index>=0&&a.message_index<s.report.messages.length).map(a=>({message_index:a.message_index,text:String(a.text??'').slice(0,1000)}));
    conversation.replaceChildren();inputs=reportBody(s.report,conversation,{annotations:notes,editable,onChange:()=>draftChanged(c)});
   };
   bindDraft(c,'teacher-review',{version:s.version,feedback_revision:s.feedback_revision||0},read,apply,editable);
   if(keepDecision&&reason&&(reason.value!==keepDecision.reason||due.value!==keepDecision.due)){reason.value=keepDecision.reason;due.value=keepDecision.due;draftChanged(c);}
  }
  if(c.teacher&&c.sequence){const nav=el('div',undefined,'tr-sequence-actions'),previous=btn('上一份',()=>run(c,()=>navigateReport(c,-1))),next=btn('下一份',()=>run(c,()=>navigateReport(c,1)));
   for(const [button,disabled] of [[previous,c.sequenceIndex<=0],[next,c.sequenceIndex>=c.sequence.length-1]]){button.dataset.fixedDisabled=String(disabled);button.disabled=disabled;}
   nav.append(previous,el('span',(c.sequenceIndex+1)+' / '+c.sequence.length+' · 直接切换会保留本机草稿，不会正式保存。','tr-muted'),next);foot.prepend(nav);
  }
  foot.append(el('span','提交版本与批注分别保存，旧版本仍可查看。','tr-muted'),btn('关闭',()=>close()));
 }
 window.MatinTaskReports={
  learningArchive(task){const c=begin(false,task);if(!c)return;run(c,async()=>{
   const d=await MatinStudent.api('read',{task_id:task.id,project_id:task.project_id},'learning_sync');if(!isCurrent(c))return;
   heading.textContent=task.title+' · 学习档案';body.replaceChildren(el('p',d.class_ended_at?'已结束教学 · 只读。下方是结课前已同步的学习记录，未同步的本机内容不在此档案中。':'教学已重新开放。此处仍为记录预览，可关闭后刷新任务继续学习。','tr-note'));foot.replaceChildren();
   const r=d.record;if(r){let snapshot={};try{snapshot=JSON.parse(r.snapshot);}catch{}
    reportBody({project_title:snapshot.title||task.project_title||task.title,nodes:snapshot.nodes||[],node_id:r.nodeId,visited:r.visited,completion:r.completion,messages:r.messages.map(m=>({...m,node_id:m.nodeId})),evaluations:r.evaluations.map(e=>({...e,node_id:e.nodeId}))},body,{archive:true});
    if(r.draft)body.append(el('h3','已同步的未发送草稿'),el('p',r.draft,'tr-report-section'));
    foot.append(btn('导出学习档案',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({task,record:r,updated_at:d.updated_at},null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='Matin学习档案.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}));
   }else body.append(el('p','结课前尚无已同步学习记录。已提交报告可从任务卡片单独查看。'));
   status.textContent='已读取云端档案';window.dispatchEvent(new CustomEvent('matin-student-learning-archive-read',{detail:{task_id:task.id}}));
  });},
  teacherReport(task,row,options={}){const c=begin(true,task);if(c){foot.append(btn('重试读取',()=>run(c,()=>startReport(c,row,options))));run(c,()=>startReport(c,row,options));}},
  teacher(task,options={}){const c=begin(true,task);if(c){if(['overdue','current','pending_review','revision_required'].includes(options.filter))c.filter=options.filter;foot.append(btn('重试读取',()=>run(c,()=>roster(c))));run(c,()=>roster(c));}},
  student(task,options={}){const c=begin(false,task);if(c){foot.append(btn('重试读取',()=>run(c,()=>readReport(c,null,options.version))));run(c,()=>readReport(c,null,options.version));}},
  submit(task,report){const c=begin(false,task);if(!c)return;run(c,async()=>{
   const state=await MatinTasks.loadStudent();if(!isCurrent(c))return;
   const latest=state.tasks.find(t=>t.id===task.id&&t.available);if(!latest||!state.reports_version)throw Error('任务暂不可提交，请刷新任务并确认报告服务已升级。');
   if(latest.class_ended_at)throw Error('班级已结束教学，报告与学习记录保留为只读档案。如需补交，请联系教师重新开放教学。');
   if(latest.review_status==='passed')throw Error('报告已通过，可查看批阅结果；如需重交，请联系教师退回修改。');
   if(!report.messages?.some(m=>m.role==='user'&&m.text.trim()))throw Error('请先完成至少一次学生回答，再提交报告。');
   c.task=latest;heading.textContent='提交学习报告 · '+task.title;body.replaceChildren();foot.replaceChildren();
   body.append(el('p','确认后将把本页展示的当前节点、完整对话、阶段评价和学习总结发送给任课教师。提交后保留云端版本；之后修改本地记录不会自动改变已交报告。','tr-note'));
   if(latest.submission_version)body.append(el('p','你已提交 '+latest.submission_version+' 版，本次将新增一版，保留原报告和批注。','tr-muted'));
   const summaryLabel=el('label','学习总结（选填）'),summary=el('textarea');summary.maxLength=4000;summary.setAttribute('aria-label','学习总结');summary.placeholder='本次学习成果、遇到的问题或需要教师解答的内容';summary.oninput=()=>draftChanged(c);summaryLabel.append(summary);body.append(summaryLabel);
   if(!window.MatinReportFiles)throw Error('附件组件未加载，请刷新页面。');
   const attachments=el('section');body.append(attachments);
   const files=await MatinReportFiles.editor(attachments,task.id,()=>draftChanged(c));if(!isCurrent(c))return;
   reportBody(report,body);
   bindDraft(c,'student-summary',{version:Number(latest.submission_version)||0,feedback_revision:Number(latest.feedback_revision)||0},()=>({summary:summary.value,attachment_ids:files.ids()}),value=>{summary.value=String(value.summary??'').slice(0,4000);if(Array.isArray(value.attachment_ids))files.select(value.attachment_ids);});
   foot.append(btn(latest.submission_version?'确认提交新版本':'确认提交报告',()=>run(c,async()=>{
    const attachment_ids=files.validate();
    const payload={...report,summary:summary.value};delete payload.nodes;delete payload.project_title;
    if(new TextEncoder().encode(JSON.stringify(payload)).length>(state.workflow_version===2?2200000:150000))throw Error(state.workflow_version===2?'报告超过 2.2 MB，请先导出完整记录并联系教师。内容未丢失。':'报告较长，请先更新报告服务以支持完整提交。内容未丢失。');
    const signature=JSON.stringify({payload,attachment_ids});if(c.submitSignature!==signature){c.submitSignature=signature;c.submitMutation=crypto.randomUUID();}
    const result=await api(c,'submit',{expected_version:Number(latest.submission_version)||0,expected_feedback_revision:Number(latest.feedback_revision)||0,mutation_id:c.submitMutation,attachment_ids,report:payload});if(!isCurrent(c))return;
    c.draft?.commit();releaseDraft(c);c.dirty=false;
    // Submission is already confirmed. A subsequent list refresh must not invite another submission.
    try{await MatinTasks.loadStudent();}catch{}if(!isCurrent(c))return;
    body.replaceChildren(el('h3','报告已提交'),el('p','第 '+result.version+' 版 · '+time(result.submitted_at)+(result.late?' · 逾期补交':'')),el('p','报告进入待批阅。教师可通过或退回修改，原学习记录和历次报告继续保留。'));foot.replaceChildren(btn('查看已提交报告',()=>run(c,()=>readReport(c,null))),btn('关闭',()=>close()));status.textContent='提交成功';
   },true),true),btn('取消',()=>close()));status.textContent='请检查报告内容后确认提交。';
  });}
 };
 root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();e.preventDefault();close();}if(e.key==='Tab'){const items=[...root.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled)')].filter(e=>e.getClientRects().length);if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0]?.focus();}}});
})();
