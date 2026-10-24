/* Private task reports: explicit student submission, versioned teacher feedback. */
(() => {'use strict';
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const btn=(text,fn,primary=false)=>{const b=el('button',text,'btn'+(primary?' primary':''));b.type='button';b.onclick=fn;return b;};
 const reviewLabel=v=>({pending_review:'待教师批阅',revision_required:'需修改重交',passed:'已通过'}[v]||'已提交');
 const time=v=>v?new Date(v).toLocaleString('zh-CN'):'—';
 const root=el('div',undefined,'tr-layer');root.id='task-reports-modal';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','tr-title');
 const panel=el('div',undefined,'tr-panel'),head=el('header'),heading=el('h2');heading.id='tr-title';
 const closeButton=btn('关闭',()=>close()),body=el('div',undefined,'tr-body'),foot=el('footer'),status=el('p',undefined,'tr-status');status.setAttribute('role','status');
 head.append(heading,closeButton);panel.append(head,status,body,foot);root.append(panel);document.body.append(root);
 const css=el('style');css.textContent=`
 .tr-layer{position:fixed;inset:0;z-index:160;background:#101a3db8;display:flex;align-items:center;justify-content:center;padding:20px;color:#253555}
 .tr-layer[hidden]{display:none!important}.tr-panel{background:#fff;border-radius:24px;width:min(1150px,100%);max-height:94vh;display:flex;flex-direction:column;box-shadow:0 24px 100px #101a3d50;min-width:0}
 .tr-panel>header,.tr-panel>footer{padding:18px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;flex-shrink:0}.tr-panel h2{font-size:22px;margin:0}.tr-panel h3{margin:12px 0;font-size:18px}.tr-panel h4{margin:8px 0}.tr-panel p{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7;margin:8px 0}
 .tr-panel>header{border-bottom:1px solid #e4e9f4}.tr-panel>footer{border-top:1px solid #e4e9f4}.tr-body{padding:4px 24px 24px;overflow:auto;min-height:0}.tr-status{padding:0 24px;color:#80521d;flex-shrink:0}.tr-muted{color:#697a97;font-size:13px}
 .tr-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}.tr-stat{padding:16px;background:#f3f5fe;border:1px solid #e1e6f5;border-radius:14px}.tr-stat strong{display:block;font-size:27px;color:#4b4ed1}
 .tr-toolbar,.tr-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.tr-toolbar{margin:18px 0}.tr-toolbar label{display:grid;gap:5px;font-size:13px}.tr-toolbar input{min-width:260px}
 .tr-layer input,.tr-layer select,.tr-layer textarea{font:inherit;color:inherit;background:#fff;padding:10px 12px;border:1px solid #ccd6e9;border-radius:10px;max-width:100%;box-sizing:border-box}.tr-layer textarea{width:100%;min-height:88px;resize:vertical}.tr-layer :focus-visible{outline:3px solid #bac6ff;outline-offset:2px}.tr-layer :disabled{opacity:.55;cursor:wait}
 .tr-table-wrap{overflow:auto}.tr-table{width:100%;border-collapse:collapse;font-size:14px}.tr-table th,.tr-table td{padding:13px 10px;border-bottom:1px solid #e5eaf4;text-align:left;vertical-align:top;overflow-wrap:anywhere}.tr-table th{background:#f6f8fd;color:#657594;white-space:nowrap}.tr-table small{display:block;margin-top:4px;color:#72829e}.tr-table .tr-status-label{font-weight:700;color:#3a4d71}.tr-table .tr-late{color:#ae561f}
 .tr-report-section,.tr-message{padding:16px;border:1px solid #dfe6f3;border-radius:12px;margin:12px 0;overflow-wrap:anywhere}.tr-message.user{border-left:4px solid #6c68e5}.tr-note{padding:12px 16px;border-radius:12px;background:#f3f5ff;line-height:1.7}.tr-feedback{border-left:4px solid #42a69b;padding:10px 14px;background:#f0faf7;margin:10px 0;white-space:pre-wrap;overflow-wrap:anywhere}.tr-report-section label{display:grid;gap:8px}
 @media(max-width:650px){.tr-layer{padding:8px}.tr-panel{max-height:96vh;border-radius:16px}.tr-panel>header,.tr-panel>footer{padding:14px}.tr-body{padding:0 14px 14px}.tr-status{padding:0 14px}.tr-summary{grid-template-columns:repeat(2,1fr)}.tr-toolbar input{min-width:0;width:100%}.tr-toolbar label{width:100%}.tr-table thead{display:none}.tr-table tr{display:block;border:1px solid #dfe6f3;border-radius:12px;padding:10px;margin:12px 0}.tr-table td{display:block;border:0;padding:5px 0}.tr-table td:before{content:attr(data-label)'：';color:#73829a}.tr-panel h2{font-size:19px}}
 `;document.head.append(css);
 let current=null;
 function isCurrent(c){return current===c&&(!c.owner||c.owner===window.MatinStudent?.userId);}
 function canLeave(){return !current?.dirty||confirm('批注或学习总结尚未保存，确认放弃这些修改？');}
 function close(){if(current?.busy&&current.writing){status.textContent='正在保存，请稍候。';return;}if(!canLeave())return;const c=current;current=null;root.hidden=true;if(c?.under)c.under.inert=false;if(c?.opener?.isConnected)c.opener.focus();}
 function begin(teacher,task){if(current?.busy||!canLeave())return null;if(current?.under)current.under.inert=false;
  const under=[...document.querySelectorAll('.modal-layer:not(.hidden)')].filter(n=>n!==root&&n.getClientRects().length).at(-1);
  const c={teacher,task,owner:teacher?'':window.MatinStudent?.userId,opener:document.activeElement,under,busy:false,dirty:false,rows:[],filter:'current',search:''};current=c;if(under)under.inert=true;root.hidden=false;body.replaceChildren();foot.replaceChildren();status.textContent='';heading.textContent=task.title;closeButton.focus();return c;
 }
 const api=(c,op,data={})=>c.teacher?MatinAccount.api({action:'task_review',op,data:{task_id:c.task.id,...data}}):MatinStudent.api(op,{task_id:c.task.id,...data},'task_review');
 async function run(c,fn,writing=false){if(!isCurrent(c)||c.busy)return;c.busy=true;c.writing=writing;root.setAttribute('aria-busy','true');status.textContent=writing?'正在保存…':'正在读取…';lock();try{await fn();}catch(e){if(isCurrent(c))status.textContent=e.message||'请求失败，请重试。';}finally{if(isCurrent(c)){c.busy=false;c.writing=false;root.setAttribute('aria-busy','false');lock();if(!root.contains(document.activeElement))closeButton.focus();}}}
 function lock(){root.querySelectorAll('button,input,textarea,select').forEach(e=>e.disabled=!!current?.busy||e.dataset.fixedDisabled==='true');closeButton.disabled=!!(current?.busy&&current.writing);}
 const label=r=>r.review_status==='revision_required'?'需修改重交'+(r.overdue?' · 已逾期':''):r.status==='submitted'?reviewLabel(r.review_status)+(r.late?' · 逾期补交':''):r.overdue?'逾期未交 · '+(r.status==='pending'?'未开始':'进行中'):r.status==='pending'?'未开始':'进行中';
 const filterRow=(c,r)=>{
  const match=c.filter==='all'||c.filter==='former'&&r.membership!=='approved'||r.membership==='approved'&&(
   c.filter===r.review_status||c.filter==='current'||c.filter==='overdue'&&r.overdue||c.filter==='late'&&r.late||c.filter==='pending'&&r.status==='pending'&&!r.overdue||c.filter==='started'&&r.status==='started'&&!r.overdue||c.filter==='submitted'&&r.status==='submitted');
  return match&&[r.display_name,r.student_no,r.email].join(' ').toLowerCase().includes(c.search.toLowerCase().trim());
 };
 async function roster(c){const d=await api(c,'roster');if(!isCurrent(c))return;if(!Array.isArray(d.rows))throw Error('明细读取失败，请确认数据库升级。');c.rows=d.rows;c.roster=d;c.task=d.task;showRoster(c);status.textContent='已读取最新完成明细';}
 function showRoster(c){c.dirty=false;heading.textContent=c.roster.class_name+' · '+c.task.title;body.replaceChildren();foot.replaceChildren();
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
    cells[2].textContent=time(r.updated_at);cells[3].textContent=time(r.submitted_at);
    if(r.version){cells[4].append(btn('查看报告 / 批注',()=>run(c,()=>readReport(c,r))),el('small',r.reviewed_at?'已批注 · 第 '+r.version+' 版':'待批注 · 第 '+r.version+' 版'));}else cells[4].textContent='尚无已提交报告';tbody.append(row);
   }table.append(tbody);wrap.append(table);
  }
  search.oninput=()=>{c.search=search.value;draw();};select.onchange=()=>{c.filter=select.value;draw();};draw();
  foot.append(el('span','浏览器中的未提交对话不会自动发送给教师。','tr-muted'),btn('关闭明细',()=>close()));
 }
 function csvValue(value){let s=String(value??'');if(/^[\s]*[=+\-@]|^[\t\r\n]|^0\d/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
 function exportRoster(c){const rows=c.rows.filter(r=>filterRow(c,r)),headers=['班级','任务','姓名','学号','邮箱','成员状态','学习状态','旧版自报完成未交报告','截止时间','最近打开或提交','提交时间','报告版本','批注时间','批阅结果','修改要求','重交截止'];
  const data=[headers,...rows.map(r=>[c.roster.class_name,c.task.title,r.display_name,r.student_no,r.email,r.membership==='approved'?'在班':'历史成员',label(r),r.legacy_completed?'是':'否',time(c.task.due_at),time(r.updated_at),time(r.submitted_at),r.version||'',time(r.reviewed_at),r.review_status?reviewLabel(r.review_status):'',r.revision_reason||'',time(r.resubmit_due_at)])];
  const blob=new Blob(['\ufeff'+data.map(row=>row.map(csvValue).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=(c.roster.class_name+'-'+c.task.title+'-任务明细').replace(/[\\/:*?"<>|]/g,'_').slice(0,90)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='已导出当前筛选的 '+rows.length+' 名学生（CSV UTF-8）。';
 }
 async function readReport(c,row,version){const d=await api(c,'report',{student_id:row?.student_id,version});if(!isCurrent(c))return;c.reportData=d;c.student=row;showReport(c,d);status.textContent='已读取第 '+d.submission.version+' 版报告';}
 function reportBody(report,container,{annotations=[],editable=false,onChange=()=>{}}={}){
  const nodes=new Map((report.nodes||[]).map(n=>[n.id,n.name]));
  container.append(el('p','项目：'+report.project_title+' · 当前阶段：'+(nodes.get(report.node_id)||report.node_id),'tr-muted'));
  container.append(el('p','学习路径：'+(report.visited||[]).map(id=>nodes.get(id)||id).join(' → '),'tr-muted'));
  container.append(el('p','路线状态：'+(report.completion?'学生已结束本次路线':'学习中')+'。报告内容来自学生提交的学习记录，AI 评价仅供参考。','tr-note'));
  if(report.summary){const summary=el('section',undefined,'tr-report-section');summary.append(el('h3','学生学习总结'),el('p',report.summary));container.append(summary);}
  function paged(items,size,draw,label){
   const section=el('section'),content=el('div'),nav=el('div',undefined,'tr-toolbar');let page=0;
   const count=el('span',undefined,'tr-muted'),prev=btn('上一页'+label,()=>{if(page>0){page--;render();}}),next=btn('下一页'+label,()=>{if((page+1)*size<items.length){page++;render();}});
   function render(){content.replaceChildren();items.slice(page*size,(page+1)*size).forEach((item,i)=>draw(item,page*size+i,content));count.textContent=label+' · 共 '+items.length+' 条 · '+(page+1)+' / '+Math.max(1,Math.ceil(items.length/size))+' 页';prev.disabled=page===0;next.disabled=(page+1)*size>=items.length;prev.dataset.fixedDisabled=String(prev.disabled);next.dataset.fixedDisabled=String(next.disabled);}
   nav.append(count,prev,next);section.append(nav,content);container.append(section);render();
  }
  container.append(el('h3','阶段评价（AI 建议）'));
  paged(report.evaluations||[],10,(e,i,target)=>{const d=e.result||{},box=el('section',undefined,'tr-report-section');box.append(el('h4',(nodes.get(e.node_id)||e.node_id)+' · '+(d.score??'—')+' 分'),el('p',d.feedback||''));for(const k of Array.isArray(d.criteria)?d.criteria:[])box.append(el('p',(k.met?'✓ ':'△ ')+(k.name||'')+'：'+(k.comment||'')));box.append(el('p',d.nextStep||''));target.append(box);},'阶段评价');
  if(!report.evaluations?.length)container.append(el('p','未提交阶段评价。','tr-muted'));
  container.append(el('h3','完整学习对话'));
  // Keep edited notes for every page; only create DOM for the visible messages.
  const inputs=new Map(annotations.map(a=>[a.message_index,{value:a.text}]));
  paged(report.messages||[],30,(m,i,target)=>{
   const section=el('section',undefined,'tr-message '+m.role);section.append(el('h4',`${i+1}. ${m.role==='user'?'学生':m.sender||'导师'} · ${nodes.get(m.node_id)||m.node_id}`),el('p',m.text),el('small',m.at||'','tr-muted'));
   const existing=inputs.get(i)?.value||'';
   if(editable){const area=el('label','教师批注'),input=el('textarea'),toggle=btn('添加 / 编辑本条批注',()=>{area.hidden=!area.hidden;if(!area.hidden)input.focus();});input.maxLength=1000;input.value=existing;input.oninput=()=>{inputs.set(i,{value:input.value});onChange();};area.append(input);area.hidden=!existing;section.append(toggle,area);}else if(existing)section.append(el('div','教师批注：'+existing,'tr-feedback'));target.append(section);
  },'对话');return inputs;
 }

 function showReport(c,d){c.dirty=false;heading.textContent=(c.teacher?c.student.display_name+' · ':'我的报告 · ')+c.task.title;body.replaceChildren();foot.replaceChildren();const s=d.submission;
  const newest=d.versions[0],historical=s.version!==newest.version;
  body.append(el('p',historical?'历史版本 · 第 '+s.version+' 版当时的结果：'+reviewLabel(s.review_status):reviewLabel(s.review_status),'tr-note'));if(s.review_status==='revision_required')body.append(el('p',(historical?'本版本的修改要求：':'修改要求：')+s.revision_reason+'\n重交截止：'+time(s.resubmit_due_at),'tr-feedback'));
  body.append(el('p',`第 ${s.version} 版 · 提交于 ${time(s.submitted_at)}${d.late?' · 逾期补交':''}`,'tr-muted'));
  const tools=el('div',undefined,'tr-toolbar'),versionLabel=el('label','提交版本'),versions=el('select');for(const v of d.versions){const option=el('option','第 '+v.version+' 版 · '+time(v.submitted_at)+(v.review_status?' · '+reviewLabel(v.review_status):''));option.value=v.version;versions.append(option);}versions.value=s.version;versionLabel.append(versions);tools.append(versionLabel);
  versions.onchange=()=>{if(!canLeave()){versions.value=s.version;return;}run(c,()=>readReport(c,c.student,Number(versions.value)));};
  if(c.teacher)tools.append(btn('返回完成明细',()=>{if(canLeave())run(c,()=>roster(c));}));body.append(tools);
  if(historical)body.prepend(el('p','正在查看历史版本；最新为第 '+newest.version+' 版，'+reviewLabel(newest.review_status)+'。'+(c.teacher?'这里的批注只保存到当前版本。请切换到最新版本作出批阅结论。':'请切换到最新版本查看当前批阅结果。'),'tr-note'));
  const feedbackSection=el('section',undefined,'tr-report-section');feedbackSection.append(el('h3','教师总评'));
  let feedback;
  if(c.teacher){feedback=el('textarea');feedback.maxLength=5000;feedback.setAttribute('aria-label','教师总评');feedback.placeholder='填写总体反馈，或在具体对话下添加批注';feedback.value=s.feedback;feedback.oninput=()=>c.dirty=true;feedbackSection.append(feedback);}else feedbackSection.append(el('p',s.feedback||'教师尚未填写总评。','tr-feedback'));
  feedbackSection.append(el('p',s.reviewed_at?'批注更新于 '+time(s.reviewed_at):'尚未批注','tr-muted'));body.append(feedbackSection);
  const inputs=reportBody(s.report,body,{annotations:s.annotations,editable:c.teacher,onChange:()=>c.dirty=true});
  const annotations=()=>{const values=[...inputs].filter(([,input])=>input.value.trim()).map(([message_index,input])=>({message_index,text:input.value.trim()}));if(values.length>100)throw Error('每版报告最多批注100条对话。');return values;};
  if(c.teacher){
   foot.append(btn('保存批注',()=>run(c,async()=>{
    const saved=await api(c,'annotate',{student_id:c.student.student_id,version:s.version,feedback_revision:s.feedback_revision,feedback:feedback.value,annotations:annotations()});if(!isCurrent(c))return;c.dirty=false;showReport(c,saved);status.textContent='批注已保存；批阅结论请使用“通过报告”或“退回修改”。';
   },true)));
   if(d.workflow_version===2&&s.version===d.versions[0].version&&c.task.active!==false){
    const decision=el('section',undefined,'tr-report-section'),reasonLabel=el('label','修改要求（退回时必填）'),reason=el('textarea'),dueLabel=el('label','重交截止时间'),due=el('input');
    reason.setAttribute('aria-label','修改要求');reason.maxLength=2000;reason.placeholder='明确说明需要补充或修改的内容';reason.value=s.revision_reason||'';reason.oninput=()=>c.dirty=true;reasonLabel.append(reason);
    due.type='datetime-local';due.setAttribute('aria-label','重交截止时间');if(s.resubmit_due_at){const dt=new Date(s.resubmit_due_at);due.value=new Date(dt.getTime()-dt.getTimezoneOffset()*60000).toISOString().slice(0,16);}due.oninput=()=>c.dirty=true;dueLabel.append(due);
    decision.append(el('h3','批阅结论'),el('p','通过后，学生保留查看入口；退回修改会重新进入学生待办，保留原学习进度。退回时请填写修改要求和未来的重交期限，该期限仅适用于这名学生。','tr-muted'),reasonLabel,dueLabel);feedbackSection.after(decision);
    async function decide(value){
     const data={student_id:c.student.student_id,version:s.version,feedback_revision:s.feedback_revision,feedback:feedback.value,annotations:annotations(),review_status:value,revision_reason:value==='revision_required'?reason.value.trim():'',resubmit_due_at:value==='revision_required'&&due.value?new Date(due.value).toISOString():null};
     if(value==='revision_required'&&(!data.revision_reason||!data.resubmit_due_at||Date.parse(data.resubmit_due_at)<=Date.now()))throw Error('请填写修改要求，并设置未来的重交截止时间。');
     if(!confirm(value==='passed'?'确认通过这份报告？结论与当前批注将一起保存。':'确认退回修改？学生将收到修改要求和重交期限，原报告与批注保留。'))return;
     const signature=JSON.stringify(data);if(c.decisionSignature!==signature){c.decisionSignature=signature;c.decisionMutation=crypto.randomUUID();}
     const saved=await api(c,'decide',{...data,mutation_id:c.decisionMutation});if(!isCurrent(c))return;c.dirty=false;showReport(c,saved);status.textContent=value==='passed'?'报告已通过。':'已退回修改，学生待办将显示修改要求和重交期限。';
     window.dispatchEvent(new CustomEvent('matin-report-reviewed',{detail:{task_id:c.task.id}}));
    }
    foot.append(btn('通过报告',()=>run(c,()=>decide('passed'),true),true),btn('退回修改',()=>run(c,()=>decide('revision_required'),true)));
   }
   foot.append(btn('重新读取报告',()=>{if(canLeave())run(c,()=>readReport(c,c.student));}));
  }else if(s.review_status==='revision_required'&&s.version===d.versions[0].version){
   foot.append(btn('继续修改',()=>{if(!canLeave())return;const id=c.task.id;close();window.MatinTasks.openStudent(id);},true));
  }
  if(d.history?.length){const history=el('details',undefined,'tr-report-section');history.append(el('summary','批阅记录（'+d.history.length+'）'));for(const e of d.history){const line=el('p','第 '+e.version+' 版 · '+time(e.changed_at)+' · '+reviewLabel(e.after.review_status)+(e.after.revision_reason?'\n修改要求：'+e.after.revision_reason+'\n重交截止：'+time(e.after.resubmit_due_at):''));history.append(line);}body.append(history);}
  foot.append(el('span','提交版本与批注分别保存，旧版本仍可查看。','tr-muted'),btn('关闭',()=>close()));
 }
 window.MatinTaskReports={
  teacher(task){const c=begin(true,task);if(c){foot.append(btn('重试读取',()=>run(c,()=>roster(c))));run(c,()=>roster(c));}},
  student(task){const c=begin(false,task);if(c){foot.append(btn('重试读取',()=>run(c,()=>readReport(c,null))));run(c,()=>readReport(c,null));}},
  submit(task,report){const c=begin(false,task);if(!c)return;run(c,async()=>{
   const state=await MatinTasks.loadStudent();if(!isCurrent(c))return;
   const latest=state.tasks.find(t=>t.id===task.id&&t.available);if(!latest||!state.reports_version)throw Error('任务暂不可提交，请刷新任务并确认报告服务已升级。');
   if(latest.review_status==='passed')throw Error('报告已通过，可查看批阅结果；如需重交，请联系教师退回修改。');
   if(!report.messages?.some(m=>m.role==='user'&&m.text.trim()))throw Error('请先完成至少一次学生回答，再提交报告。');
   c.task=latest;heading.textContent='提交学习报告 · '+task.title;body.replaceChildren();foot.replaceChildren();
   body.append(el('p','确认后将把本页展示的当前节点、完整对话、阶段评价和学习总结发送给任课教师。提交后保留云端版本；之后修改本地记录不会自动改变已交报告。','tr-note'));
   if(latest.submission_version)body.append(el('p','你已提交 '+latest.submission_version+' 版，本次将新增一版，保留原报告和批注。','tr-muted'));
   const summaryLabel=el('label','学习总结（选填）'),summary=el('textarea');summary.maxLength=4000;summary.setAttribute('aria-label','学习总结');summary.placeholder='本次学习成果、遇到的问题或需要教师解答的内容';summary.oninput=()=>c.dirty=true;summaryLabel.append(summary);body.append(summaryLabel);
   reportBody(report,body);
   foot.append(btn(latest.submission_version?'确认提交新版本':'确认提交报告',()=>run(c,async()=>{
    const payload={...report,summary:summary.value};delete payload.nodes;delete payload.project_title;
    if(new TextEncoder().encode(JSON.stringify(payload)).length>(state.workflow_version===2?2200000:150000))throw Error(state.workflow_version===2?'报告超过 2.2 MB，请先导出完整记录并联系教师。内容未丢失。':'报告较长，请先更新报告服务以支持完整提交。内容未丢失。');
    const signature=JSON.stringify(payload);if(c.submitSignature!==signature){c.submitSignature=signature;c.submitMutation=crypto.randomUUID();}
    const result=await api(c,'submit',{expected_version:Number(latest.submission_version)||0,expected_feedback_revision:Number(latest.feedback_revision)||0,mutation_id:c.submitMutation,report:payload});if(!isCurrent(c))return;
    c.dirty=false;await MatinTasks.loadStudent();if(!isCurrent(c))return;
    body.replaceChildren(el('h3','报告已提交'),el('p','第 '+result.version+' 版 · '+time(result.submitted_at)+(result.late?' · 逾期补交':'')),el('p','报告进入待批阅。教师可通过或退回修改，原学习记录和历次报告继续保留。'));foot.replaceChildren(btn('查看已提交报告',()=>run(c,()=>readReport(c,null))),btn('关闭',()=>close()));status.textContent='提交成功';
   },true),true),btn('取消',()=>close()));status.textContent='请检查报告内容后确认提交。';
  });}
 };
 root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();e.preventDefault();close();}if(e.key==='Tab'){const items=[...root.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled)')].filter(e=>e.getClientRects().length);if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0]?.focus();}}});
})();
