/* Course learning matrix. Read-only metadata; reports use the existing authorized review flow. */
(() => {'use strict';
 const el=(tag,text,cls='')=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;n.className=cls;return n;};
 const btn=(text,fn,cls='btn')=>{const b=el('button',text,cls);b.type='button';b.onclick=fn;return b;};
 const time=v=>v?new Date(v).toLocaleString('zh-CN',{hour12:false}):'—';
 const shortTime=v=>v?new Date(v).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'—';
 const stateName=c=>c.status==='revision_required'?'需修改重交'+(c.overdue?' · 逾期':''):c.status==='passed'?'已通过':c.status==='pending_review'?'已提交待批阅':c.overdue?'逾期未交':c.status==='started'?'进行中':'未开始';
 const submitted=c=>['pending_review','passed'].includes(c.status);
 const stats=cells=>({submitted:cells.filter(submitted).length,passed:cells.filter(c=>c.status==='passed').length,review:cells.filter(c=>c.status==='pending_review').length,revision:cells.filter(c=>c.status==='revision_required').length,overdue:cells.filter(c=>c.overdue).length});
 const csvValue=value=>{let s=String(value??'');if(/^[\s]*[=+\-@]|^[\t\r\n]|^0\d/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
 window.MatinCourseMatrix={init({account,beforeOpen}){
  if(!account)return;
  let current=null;
  const root=el('div',undefined,'cm-layer modal-layer');root.id='course-matrix-modal';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','cm-title');
  const panel=el('section',undefined,'cm-panel'),head=el('header',undefined,'cm-head'),heading=el('div'),title=el('h2','课程学习明细');title.id='cm-title';heading.append(el('p','学生 × 任务 · 全班学习汇总','cm-muted'),title);
  const actions=el('div',undefined,'cm-actions'),refresh=btn('刷新明细',()=>load(current)),download=btn('导出整表',()=>exportTable(current),'btn primary'),close=btn('关闭',()=>dismiss());download.title='导出所选班级和课程的全部学生与任务，包含其他页；不受姓名搜索影响';actions.append(refresh,download,close);head.append(heading,actions);
  const filters=el('div',undefined,'cm-filters'),classes=el('select'),courses=el('select'),search=el('input');search.type='search';search.maxLength=100;search.placeholder='姓名或学号';
  for(const [name,input] of [['班级',classes],['课程',courses],['查找学生',search]]){const l=el('label',name);input.setAttribute('aria-label',name);l.append(input);filters.append(l);}
  const status=el('p','','cm-muted');status.id='cm-status';status.setAttribute('role','status');
  const summary=el('p','','cm-summary'),hint=el('p','点击任务名称查看全班明细；点击报告状态查看报告与批阅。任务较多时横向滚动，学生姓名列保持可见。','cm-muted');
  const viewport=el('div',undefined,'cm-table-wrap');viewport.tabIndex=0;viewport.setAttribute('role','region');viewport.setAttribute('aria-label','学生与任务汇总表，可横向滚动');
  const footer=el('footer',undefined,'cm-footer'),count=el('span'),prev=btn('上一页',()=>{if(current){current.page--;viewport.scrollTop=0;render(current);}}),next=btn('下一页',()=>{if(current){current.page++;viewport.scrollTop=0;render(current);}});footer.append(count,prev,next);
  const top=el('div',undefined,'cm-top');top.append(filters,status,summary,hint);panel.append(head,top,viewport,footer);root.append(panel);document.body.append(root);
  const css=el('style',`
   .cm-layer{position:fixed;inset:0;z-index:145;display:flex;align-items:center;justify-content:center;padding:16px;background:#152241aa;color:#253555}.cm-layer[hidden]{display:none!important}.cm-panel{width:min(1500px,100%);height:92vh;height:92dvh;max-height:96dvh;display:flex;flex-direction:column;background:#fff;border-radius:20px;min-width:0;box-shadow:0 24px 90px #101a3d40}.cm-head,.cm-actions,.cm-footer{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.cm-head{justify-content:space-between;padding:16px 22px;border-bottom:1px solid #e1e7f3;flex-shrink:0}.cm-head h2{font-size:23px;margin:0}.cm-muted{font-size:12px;line-height:1.6;color:#70809b;margin:6px 0;overflow-wrap:anywhere}.cm-top{padding:8px 22px;flex-shrink:0}.cm-filters{display:flex;gap:12px;flex-wrap:wrap}.cm-filters label{display:grid;gap:5px;font-size:13px;flex:1;min-width:150px}.cm-filters input,.cm-filters select{font:inherit;color:inherit;padding:9px;border:1px solid #d7e0ee;border-radius:9px;background:white;width:100%;min-width:0;box-sizing:border-box}.cm-summary{font-size:13px;line-height:1.6;margin:8px 0;color:#43587c}.cm-footer{padding:14px 22px;border-top:1px solid #e1e7f3;flex-shrink:0;font-size:12px;color:#71809b}.cm-footer>span{margin-right:auto}.cm-table-wrap{overflow:auto;overscroll-behavior:contain;min-height:80px;flex:1;margin:0 22px 12px;border:1px solid #e1e7f3;border-radius:10px}.cm-table{border-collapse:separate;border-spacing:0;table-layout:fixed;font-size:12px;color:#3e5073;min-width:100%}.cm-table th,.cm-table td{box-sizing:border-box;border-right:1px solid #e8ecf4;border-bottom:1px solid #e8ecf4;padding:10px;text-align:center;vertical-align:middle;overflow-wrap:anywhere;width:155px;min-width:155px;background:white}.cm-table th{font-weight:600}.cm-table thead th{position:sticky;top:0;z-index:3;background:#f4f6fc;vertical-align:top}.cm-table .cm-student{position:sticky;left:0;z-index:2;text-align:left;width:165px;min-width:165px;background:#fff;box-shadow:2px 0 3px #24395909}.cm-table thead .cm-student{z-index:4;background:#f4f6fc}.cm-table small{display:block;color:#7a88a0;line-height:1.6;margin-top:5px;font-weight:400}.cm-table .cm-task{font:inherit;text-align:left;color:#4248b2;border:0;background:transparent;padding:0;cursor:pointer;line-height:1.6;white-space:normal}.cm-state{display:inline-block;font:inherit;line-height:1.6;border:1px solid transparent;border-radius:7px;background:#f0f2f7;color:#65748f;padding:5px 7px;max-width:100%;white-space:normal}.cm-state.pending_review{background:#eaf0ff;color:#4056a6}.cm-state.started{background:#f0edff;color:#6552ad}.cm-state.passed{background:#e7f6ef;color:#267758}.cm-state.revision_required{background:#fff3dc;color:#936222}.cm-state.overdue{background:#fff0e9;color:#a74d27}.cm-table button.cm-state{cursor:pointer;border-color:#dce3ef}.cm-table button:hover{text-decoration:underline}.cm-empty{padding:24px;color:#71809b;line-height:1.8}.cm-layer :disabled{opacity:.55;cursor:not-allowed}.cm-layer :focus-visible{outline:3px solid #b8c4ff;outline-offset:2px}.cm-error{color:#9b4f1b}.cm-footer .btn{font-size:12px;padding:8px 12px}
   @media(max-width:680px){.cm-layer{padding:6px}.cm-panel{height:96vh;height:96dvh;border-radius:14px}.cm-head{padding:12px}.cm-head h2{font-size:19px}.cm-actions{gap:6px}.cm-actions .btn{font-size:12px;padding:8px 10px}.cm-top{padding:6px 12px}.cm-filters{gap:8px}.cm-filters label{min-width:120px}.cm-filters label:last-child{flex-basis:100%}.cm-table-wrap{margin:0 12px 6px}.cm-footer{padding:10px 12px;gap:6px}.cm-table .cm-student{width:115px;min-width:115px}.cm-table th,.cm-table td{padding:8px;width:140px;min-width:140px}.cm-top>p{margin:5px 0}.cm-summary{font-size:12px}}
   @media(max-width:680px){.cm-table tr>:nth-child(2){display:none}.cm-footer>span{flex-basis:100%}.cm-footer button:first-of-type{margin-left:auto}}
  `);document.head.append(css);
  const nav=btn('课程学习明细',()=>open());nav.id='course-matrix-open';document.querySelector('.nav').append(nav);
  function lock(c){if(c!==current)return;const focused=document.activeElement;classes.disabled=c.exporting;courses.disabled=c.exporting;search.disabled=c.exporting;refresh.disabled=c.loading||c.exporting;download.disabled=c.loading||c.exporting||!c.data?.tasks.length||!c.data?.rows.length;prev.disabled=c.loading||c.exporting||c.page<=1;next.disabled=c.loading||c.exporting||c.page>=c.pages;root.setAttribute('aria-busy',String(c.loading||c.exporting));if(!root.inert&&root.contains(focused)&&focused.disabled)close.focus({preventScroll:true});}
  function message(text,error=false){status.textContent=text;status.classList.toggle('cm-error',error);}
  async function request(c,params){const r=await MatinAccount.api({action:'course_matrix',data:params});if(r.matrix_version!==1||![r.classes,r.courses,r.tasks,r.rows].every(Array.isArray))throw Error('课程学习明细尚未升级，请完成 SQL 和云函数更新。');if(!r.catalog_only&&r.rows.some(row=>!Array.isArray(row.cells)||row.cells.length!==r.tasks.length||row.cells.some((cell,i)=>cell.task_id!==r.tasks[i].id)))throw Error('汇总数据不完整，请刷新；本次不会导出部分记录。');return r;}
  function catalog(c,r){classes.replaceChildren();for(const cl of r.classes)classes.add(new Option(cl.name+(cl.ended_at?'（已结课）':'')+(cl.archived_at?'（已归档）':''),cl.id));if(!r.classes.length)classes.add(new Option('尚无班级',''));c.classId=r.class?.id||'';classes.value=c.classId;courses.replaceChildren(new Option('全部课程',''));for(const g of r.courses)courses.add(new Option(g.name+'（'+g.tasks+' 项任务）',g.id));courses.value=c.courseId;}
  async function load(c,{withCatalog=false,quiet=false}={}){
   if(c!==current||c.exporting)return;const seq=++c.seq;c.loading=true;message('正在读取课程学习明细…');lock(c);
   const params={class_id:c.classId,course_id:c.courseId};if(!quiet){c.data=null;viewport.replaceChildren(el('p','正在读取…','cm-empty'));summary.textContent='';count.textContent='';}
   try{
    if(withCatalog){const meta=await request(c,{class_id:params.class_id,catalog_only:true});if(c!==current||seq!==c.seq)return;catalog(c,meta);params.class_id=c.classId;}
    const r=await request(c,params);if(c!==current||seq!==c.seq)return;c.data=r;catalog(c,r);if(root.inert)c.pendingRender=true;else render(c);message('已同步 '+time(r.as_of)+'。导出整表包含全部学生与任务，不受姓名搜索或当前页码影响。');
   }catch(e){if(c!==current||seq!==c.seq)return;message((e.message||'读取失败，请刷新重试。')+(quiet&&c.data?' 当前为上次读取结果。':''),true);if(!c.data){viewport.replaceChildren(el('p','暂时无法读取，请选择班级、课程或点击“刷新明细”重试。','cm-empty'));count.textContent='状态待同步';}}
   finally{if(c===current&&seq===c.seq){c.loading=false;lock(c);}}
  }
  function render(c){
   if(c!==current||!c.data)return;const d=c.data,scroll={x:viewport.scrollLeft,y:viewport.scrollTop},focused=document.activeElement,key=viewport.contains(focused)?focused.dataset.cmKey:null;viewport.replaceChildren();
   const all=d.rows.flatMap(r=>r.cells),total=stats(all),q=c.query.toLowerCase().trim(),rows=d.rows.filter(r=>[r.display_name,r.student_no].join(' ').toLowerCase().includes(q));c.pages=Math.max(1,Math.ceil(rows.length/25));c.page=Math.min(Math.max(c.page,1),c.pages);
   summary.textContent=d.class?(d.class.name+(d.class.ended_at?' · 结课只读档案':'')+' · 全班 '+d.rows.length+' 名学生 × '+d.tasks.length+' 项任务 · 待批阅 '+total.review+' · 需修改 '+total.revision+' · 已通过 '+total.passed+' · 逾期未交 '+total.overdue+' 人次'+(d.awaiting_accounts?' · 另有 '+d.awaiting_accounts+' 名导入学生待账号关联':'')):'尚未创建班级，请先在班级管理中创建班级。';
   hint.textContent=(d.class?.ended_at?'按结课时姓名、课程归类及截止时点 '+time(d.status_at)+' 显示。':'仅统计已加入学生和有效任务；已提交不等于通过，旧版自报完成仍需交报告。')+' 点击任务名查看全班明细，点击报告状态查看批阅。可横向滚动查看其他任务。';
   count.textContent='显示 '+rows.length+' / '+d.rows.length+' 名学生 · 每页 25 人 · 第 '+c.page+' / '+c.pages+' 页';
   if(!d.tasks.length||!rows.length){viewport.append(el('p',!d.tasks.length?'此班级、课程下暂无有效学习任务。':q?'没有符合姓名或学号的学生。':'本班尚无已加入的学生。','cm-empty'));lock(c);return;}
   const table=el('table',undefined,'cm-table'),thead=el('thead'),hr=el('tr'),studentHead=el('th','学生 / 学号','cm-student'),progressHead=el('th','学习汇总');studentHead.scope=progressHead.scope='col';hr.append(studentHead,progressHead);
   for(const [i,t] of d.tasks.entries()){
    const th=el('th');th.scope='col';const b=btn((i+1)+'. '+t.title,()=>MatinTaskReports.teacher({...t,class_id:d.class.id,active:true}),'cm-task');b.dataset.cmKey='task:'+t.id;b.title='查看“'+t.title+'”的全班完成明细';th.append(b,el('small',t.course_name),el('small','截止 '+shortTime(t.due_at)),el('small','已交 '+d.rows.filter(r=>submitted(r.cells[i])).length+' / '+d.rows.length));hr.append(th);
   }
   thead.append(hr);table.append(thead);const tbody=el('tbody');
   for(const row of rows.slice((c.page-1)*25,c.page*25)){
    const tr=el('tr');tr.dataset.matrixStudent=row.student_id;const student=el('th',undefined,'cm-student');student.scope='row';student.append(el('strong',row.display_name),el('small',row.student_no));const summaryCell=el('td'),s=stats(row.cells);summaryCell.append(el('strong','已通过 '+s.passed+' / '+d.tasks.length),el('small','已交 '+s.submitted+' · 待交 '+(d.tasks.length-s.submitted)),el('small','逾期 '+s.overdue));tr.append(student,summaryCell);
    for(const [i,cell] of row.cells.entries()){
     const td=el('td'),label=stateName(cell),cls='cm-state '+(cell.overdue?'overdue':cell.status),task=d.tasks[i];const badge=cell.version?btn(label,()=>MatinTaskReports.teacherReport({...task,class_id:d.class.id,active:true},{student_id:row.student_id,display_name:row.display_name}),cls):el('span',label,cls);
     if(cell.version){badge.dataset.cmKey=row.student_id+':'+task.id;badge.setAttribute('aria-label',row.display_name+' · '+task.title+' · '+label+'，查看报告');}
     badge.title='截止 '+time(cell.effective_due_at)+(cell.submitted_at?'\n提交 '+time(cell.submitted_at)+' · 第 '+cell.version+' 版':'')+(cell.legacy_completed?'\n旧版自报完成，尚未提交报告':'');td.append(badge);
     if(cell.teacher_score!==null&&cell.teacher_score!==undefined)td.append(el('small','教师评分 '+cell.teacher_score));if(cell.status==='revision_required')td.append(el('small','重交 '+shortTime(cell.effective_due_at)));else if(cell.late)td.append(el('small','逾期补交'));else if(cell.overdue)td.append(el('small',cell.status==='started'?'进行中':'未开始'));tr.append(td);
    }tbody.append(tr);
   }
   table.append(tbody);viewport.append(table);viewport.scrollLeft=scroll.x;viewport.scrollTop=scroll.y;lock(c);if(key)(viewport.querySelector('[data-cm-key="'+CSS.escape(key)+'"]')||close).focus({preventScroll:true});
  }
  async function exportTable(c){
   if(c!==current||c.loading||c.exporting||!c.data)return;c.exporting=true;const seq=++c.seq;lock(c);message('正在重新同步并导出完整表格…');
   try{
    const d=await request(c,{class_id:c.classId,course_id:c.courseId});if(c!==current||seq!==c.seq)return;if(!d.tasks.length||!d.rows.length)throw Error('当前范围没有可导出的学生与任务，请重新选择。');
    c.data=d;catalog(c,d);render(c);const course=d.courses.find(g=>g.id===d.course_id)?.name||'全部课程';
    const headers=['班级','课程范围','数据读取时间','状态计算时点','姓名','学号','任务数','已提交待批阅','需修改重交','已通过','逾期未交人次',...d.tasks.map((t,i)=>(i+1)+'. '+t.title+' ['+t.id+'] · '+t.course_name+' · 截止 '+time(t.due_at))];
    const rows=d.rows.map(row=>{const s=stats(row.cells);return [d.class.name,course,time(d.as_of),time(d.status_at),row.display_name,row.student_no,d.tasks.length,s.review,s.revision,s.passed,s.overdue,...row.cells.map(cell=>stateName(cell)+(cell.teacher_score!==null&&cell.teacher_score!==undefined?'；教师评分 '+cell.teacher_score:'')+(cell.version?'；第 '+cell.version+' 版；提交 '+time(cell.submitted_at):'')+(cell.status==='revision_required'?'；重交截止 '+time(cell.effective_due_at):'')+(cell.late?'；逾期补交':'')+(cell.legacy_completed?'；旧版自报完成，未交报告':''))];});
    const url=URL.createObjectURL(new Blob(['\ufeff'+[headers,...rows].map(row=>row.map(csvValue).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'})),a=el('a');a.href=url;a.download=(d.class.name+'-'+course+'-学习汇总').replace(/[\\/:*?"<>|]/g,'_').slice(0,90)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('已导出整表：'+d.rows.length+' 名学生 × '+d.tasks.length+' 项任务（CSV，可用 Excel 打开）。');
   }catch(e){if(c===current&&seq===c.seq)message((e.message||'导出失败，请重试。')+' 未生成导出文件。',true);}
   finally{if(c===current&&seq===c.seq){c.exporting=false;lock(c);}}
  }
  function dismiss(){const c=current;if(!c||root.inert)return;current=null;c.seq++;root.hidden=true;for(const [n,inert] of c.background)n.inert=inert;document.documentElement.style.overflow=c.overflow;if(c.opener?.isConnected)c.opener.focus({preventScroll:true});}
  async function open(options={}){
   if(current)return;if(beforeOpen&&!await beforeOpen())return;if(current)return;
   const c={classId:options.class_id||'',courseId:options.course_id||'',query:'',page:1,pages:1,seq:0,loading:false,exporting:false,data:null,pendingRender:false,opener:document.activeElement,overflow:document.documentElement.style.overflow};current=c;
   c.background=[...document.body.children].filter(n=>n!==root&&!['SCRIPT','STYLE'].includes(n.tagName)&&n.id!=='task-reports-modal').map(n=>[n,n.inert]);for(const [n] of c.background)n.inert=true;document.documentElement.style.overflow='hidden';root.hidden=false;classes.replaceChildren(new Option('正在读取…',''));courses.replaceChildren(new Option('全部课程',''));search.value='';viewport.scrollLeft=viewport.scrollTop=0;close.focus();void load(c,{withCatalog:true});
  }
  classes.onchange=()=>{const c=current;if(!c)return;c.classId=classes.value;c.courseId='';c.query='';search.value='';c.page=1;void load(c,{withCatalog:true});};
  courses.onchange=()=>{const c=current;if(!c)return;c.courseId=courses.value;c.page=1;void load(c);};search.oninput=()=>{const c=current;if(!c)return;c.query=search.value;c.page=1;viewport.scrollTop=0;render(c);};
  root.addEventListener('keydown',e=>{if(root.inert)return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dismiss();}if(e.key==='Tab'){const ns=[...root.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(n=>n.getClientRects().length);if(e.shiftKey&&document.activeElement===ns[0]){e.preventDefault();ns.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===ns.at(-1)){e.preventDefault();ns[0]?.focus();}}});
  new MutationObserver(()=>{const c=current;if(!c||root.inert)return;if(c.pendingRender){c.pendingRender=false;render(c);}if(!root.contains(document.activeElement))close.focus({preventScroll:true});}).observe(root,{attributes:true,attributeFilter:['inert']});
  for(const name of ['matin-report-reviewed','matin-membership-reviewed','matin-class-teaching-changed','matin-teacher-tasks-changed'])window.addEventListener(name,()=>{if(current&&!current.exporting)void load(current,{quiet:true});});
  window.MatinCourseMatrix.open=open;
 }};
})();
