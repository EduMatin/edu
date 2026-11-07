/* Read-only teaching analytics, using the existing teacher-authorized matrix snapshot. */
(() => {'use strict';
 const scored=c=>Number.isFinite(c.teacher_score)&&c.teacher_score>=0&&c.teacher_score<=100&&Number.isInteger(c.version)&&c.version>0;
 const hasReport=c=>Number.isInteger(c.version)&&c.version>0;
 const rate=(n,d)=>d?n/d:null;
 function summarize(cells){
  const scores=cells.filter(scored).map(c=>c.teacher_score),n=cells.length;
  const reports=cells.filter(hasReport).length,passed=cells.filter(c=>c.status==='passed').length;
  return {total:n,reports,passed,review:cells.filter(c=>c.status==='pending_review').length,revision:cells.filter(c=>c.status==='revision_required').length,overdue:cells.filter(c=>c.overdue===true).length,ungraded:cells.filter(c=>c.status==='passed'&&!scored(c)).length,low:scores.filter(s=>s<60).length,scored:scores.length,average:scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:null,submissionRate:rate(reports,n),passRate:rate(passed,n),bins:[scores.filter(s=>s<60).length,scores.filter(s=>s>=60&&s<80).length,scores.filter(s=>s>=80&&s<90).length,scores.filter(s=>s>=90).length]};
 }
 function validate(d){
  if(d?.matrix_version!==1||![d.classes,d.courses,d.tasks,d.rows].every(Array.isArray))throw Error('教学分析接口不匹配，请先完成部署检查。');
  if(d.catalog_only)return d;
  if(d.tasks.length>200||d.rows.length>2000||d.tasks.length*d.rows.length>50000||new Set(d.tasks.map(t=>t.id)).size!==d.tasks.length||new Set(d.rows.map(r=>r.student_id)).size!==d.rows.length||d.rows.some(r=>!Array.isArray(r.cells)||r.cells.length!==d.tasks.length||r.cells.some((c,i)=>!c||c.task_id!==d.tasks[i].id||!['pending','started','pending_review','passed','revision_required'].includes(c.status)||(['pending_review','passed','revision_required'].includes(c.status)&&!hasReport(c))||(c.teacher_score!=null&&!scored(c)))))throw Error('分析数据不完整或格式异常，请刷新重试。');
  return d;
 }
 if(typeof module!=='undefined'&&module.exports){module.exports={summarize,validate};return;}
 const el=(tag,text,cls='')=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;n.className=cls;return n;};
 const button=(text,fn,cls='btn')=>{const b=el('button',text,cls);b.type='button';b.onclick=fn;return b;};
 const percent=n=>n===null?'—':(n*100).toFixed(1)+'%';
 const score=n=>n===null?'—':n.toFixed(1);
 const date=v=>v?new Date(v).toLocaleString('zh-CN',{hour12:false}):'—';
 window.MatinTeachingAnalytics={init({account,beforeOpen}){
  if(!account||document.getElementById('teaching-analytics-open'))return;
  let current=null,opening=false;
  const root=el('div',undefined,'tan-layer modal-layer');root.id='teaching-analytics-modal';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','tan-title');
  const panel=el('section',undefined,'tan-panel'),head=el('header',undefined,'tan-head'),title=el('h2','教学分析');title.id='tan-title';
  const refresh=button('刷新分析',()=>load(current)),close=button('关闭',dismiss),actions=el('div',undefined,'tan-actions');actions.append(refresh,close);head.append(title,actions);
  const body=el('div',undefined,'tan-body'),filters=el('div',undefined,'tan-filters'),classes=el('select'),courses=el('select');
  for(const [name,input]of [['班级',classes],['课程',courses]]){const label=el('label',name);input.setAttribute('aria-label',name);label.append(input);filters.append(label);}
  const status=el('p','','tan-muted');status.id='tan-status';status.setAttribute('role','status');
  const content=el('div');content.id='tan-content';body.append(filters,status,content);panel.append(head,body);root.append(panel);document.body.append(root);
  const nav=button('教学分析',()=>open());nav.id='teaching-analytics-open';document.querySelector('.nav').append(nav);
  function dismiss(){const c=current;if(!c)return;current=null;c.seq++;root.hidden=true;for(const [n,inert]of c.background)n.inert=inert;document.documentElement.style.overflow=c.overflow;c.opener?.isConnected&&c.opener.focus({preventScroll:true});}
  async function open(){
   if(current||opening)return;opening=true;try{if(beforeOpen&&!await beforeOpen())return;
    const c={classId:'',courseId:'',seq:0,data:null,page:1,reason:'all',query:'',opener:document.activeElement,overflow:document.documentElement.style.overflow};current=c;
    c.background=[...document.body.children].filter(n=>n!==root&&!['SCRIPT','STYLE'].includes(n.tagName)).map(n=>[n,n.inert]);for(const [n]of c.background)n.inert=true;document.documentElement.style.overflow='hidden';root.hidden=false;close.focus();classes.replaceChildren(new Option('正在读取…',''));courses.replaceChildren(new Option('全部课程',''));body.scrollTop=0;void load(c);
   }finally{opening=false;}
  }
  async function load(c){
   if(!c||c!==current)return;const seq=++c.seq;c.data=null;if(document.activeElement===refresh||content.contains(document.activeElement))close.focus({preventScroll:true});content.replaceChildren();status.textContent='正在读取教学分析…';status.classList.remove('tan-error');refresh.disabled=true;root.setAttribute('aria-busy','true');
   try{
    // One complete authorized snapshot. Server rejects oversized scopes instead of truncating.
    const d=validate(await window.MatinAccount.api({action:'course_matrix',data:{class_id:c.classId,course_id:c.courseId}}));if(c!==current||seq!==c.seq)return;
    c.data=d;c.classId=d.class?.id||'';c.courseId=d.course_id||'';classes.replaceChildren();for(const cl of d.classes)classes.add(new Option(cl.name+(cl.ended_at?'（已结课）':''),cl.id));if(!d.classes.length)classes.add(new Option('尚无班级',''));classes.value=c.classId;
    courses.replaceChildren(new Option('全部课程',''));for(const course of d.courses)courses.add(new Option(course.name,course.id));courses.value=c.courseId;
    status.textContent='已同步 '+date(d.as_of)+(d.class?.ended_at?' · 已结课，逾期按结课时点 '+date(d.status_at)+' 统计。':'');render(c);
   }catch(e){if(c!==current||seq!==c.seq)return;status.textContent=(e.message||'读取失败')+' 当前未展示统计，请刷新重试。';status.classList.add('tan-error');}
   finally{if(c===current&&seq===c.seq){refresh.disabled=false;root.setAttribute('aria-busy','false');}}
  }
  classes.onchange=()=>{if(!current)return;current.classId=classes.value;current.courseId='';current.query='';current.reason='all';courses.replaceChildren(new Option('全部课程',''));void load(current);};
  courses.onchange=()=>{if(!current)return;current.courseId=courses.value;void load(current);};
  function section(name){const s=el('section',undefined,'tan-section');s.append(el('h3',name));return s;}
  function table(headers){const wrap=el('div',undefined,'tan-table-wrap');wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label',headers.join('、')+'表格，可横向滚动');const t=el('table'),th=el('thead'),tr=el('tr'),tb=el('tbody');for(const h of headers){const cell=el('th',h);cell.scope='col';tr.append(cell);}th.append(tr);t.append(th,tb);wrap.append(t);return {wrap,tb};}
  function drill(c,fn){if(c!==current||!c.data)return;dismiss();fn();}
  function render(c){
   const d=c.data,s=summarize(d.rows.flatMap(r=>r.cells));content.replaceChildren();c.page=1;
   content.append(el('p',(d.class?.name||'尚无班级')+' · '+d.rows.length+' 名已加入学生 × '+d.tasks.length+' 项有效任务'+(d.awaiting_accounts?'；另有 '+d.awaiting_accounts+' 名导入学生待关联账号，暂未计入。':'。'),'tan-scope'));
   if(!d.class||!d.tasks.length||!d.rows.length){content.append(el('p',!d.class?'请先在班级管理中创建班级。':!d.tasks.length?'此范围暂无已布置的有效任务。':'此班级尚无已加入的学生。','tan-empty'));return;}
   const cards=el('div',undefined,'tan-cards');
   for(const [label,value,detail]of [['已有报告',percent(s.submissionRate),s.reports+' / '+s.total+' 人次，含退回'],['已通过',percent(s.passRate),s.passed+' / '+s.total+' 人次'],['待批阅',s.review,'最新报告待教师批阅'],['需修改重交',s.revision,'最新报告被退回'],['逾期未交',s.overdue,'含超过重交期限的报告'],['教师评分均值',score(s.average),s.scored+' 份最新报告有评分']]){const card=el('article');card.append(el('span',label),el('strong',String(value)),el('small',detail));cards.append(card);}content.append(cards);
   content.append(el('p','统计按学生与任务的人次计算，每项只取最新报告。未开始、未提交、未评分均不补为 0 分；已有教师评分的 0 分正常计入。评分包含待批阅、已通过、退回报告，不等于课程最终成绩，也不包含 AI 建议分。','tan-muted'));
   const distribution=section('教师任务评分分布');distribution.append(el('p','样本 '+s.scored+' 份；60 分仅作为此页面的跟进参考线，不改变报告通过状态。','tan-muted'));
   const chart=el('div',undefined,'tan-chart');for(const [i,label]of ['低于 60','60–不足 80','80–不足 90','90–100'].entries()){const row=el('div',undefined,'tan-bin'),track=el('span',undefined,'tan-track'),bar=el('span',undefined,'tan-bar');bar.style.width=(s.scored?s.bins[i]/s.scored*100:0)+'%';track.setAttribute('aria-hidden','true');track.append(bar);row.append(el('span',label),track,el('strong',s.bins[i]+' 份'));chart.append(row);}distribution.append(chart);if(!s.scored)distribution.append(el('p','暂无教师评分。','tan-muted'));content.append(distribution);
   const tasks=section('任务对比'),tt=table(['任务 / 课程','已有报告','已通过','待批阅','需修改','逾期','评分均值 / 样本']);
   for(const [i,t]of d.tasks.entries()){const ts=summarize(d.rows.map(r=>r.cells[i])),tr=el('tr'),name=el('td');const go=button(t.title,()=>drill(c,()=>window.MatinTaskReports.teacher({...t,class_id:d.class.id,active:true})),'tan-link');name.append(go,el('small',t.course_name||''));tr.append(name);for(const text of [ts.reports+'/'+ts.total,ts.passed+'/'+ts.total,ts.review,ts.revision,ts.overdue,score(ts.average)+' / '+ts.scored+' 份'])tr.append(el('td',String(text)));tt.tb.append(tr);}tasks.append(el('p','点击任务名称查看全班报告；各行分母均为当前已加入学生数。','tan-muted'),tt.wrap);content.append(tasks);
   const follow=section('待跟进名单'),controls=el('div',undefined,'tan-filters'),reason=el('select'),search=el('input');reason.setAttribute('aria-label','跟进原因');for(const [v,l]of [['all','全部待跟进'],['review','待批阅'],['revision','需修改重交'],['overdue','逾期未交'],['low','教师评分低于 60'],['ungraded','已通过但未评分']])reason.add(new Option(l,v));reason.value=c.reason;search.type='search';search.placeholder='查找姓名或学号';search.setAttribute('aria-label','查找姓名或学号');search.value=c.query;
   controls.append(reason,search);const list=el('div'),footer=el('div',undefined,'tan-actions'),count=el('span','','tan-muted'),prev=button('上一页',()=>{c.page--;renderFollow();}),next=button('下一页',()=>{c.page++;renderFollow();});footer.append(count,prev,next);follow.append(el('p','同一学生可能涉及多项任务；下方筛选仅影响名单，不改变上方统计。点击“查看报告”或“查看任务”进入现有批阅页面。','tan-muted'),controls,list,footer);content.append(follow);
   const items=[];for(const r of d.rows)for(const [i,cell]of r.cells.entries()){const tags=[];if(cell.status==='pending_review')tags.push(['review','待批阅']);if(cell.status==='revision_required')tags.push(['revision','需修改重交']);if(cell.overdue===true)tags.push(['overdue','逾期未交']);if(scored(cell)&&cell.teacher_score<60)tags.push(['low','教师评分低于 60']);if(cell.status==='passed'&&!scored(cell))tags.push(['ungraded','已通过但未评分']);if(tags.length)items.push({r,t:d.tasks[i],cell,tags});}
   function renderFollow(){
    const q=c.query.trim().toLowerCase(),found=items.filter(x=>(c.reason==='all'||x.tags.some(t=>t[0]===c.reason))&&[x.r.display_name,x.r.student_no].join(' ').toLowerCase().includes(q));const pages=Math.max(1,Math.ceil(found.length/25));c.page=Math.min(Math.max(1,c.page),pages);count.textContent=found.length+' 人次 · '+new Set(found.map(x=>x.r.student_id)).size+' 名学生 · 第 '+c.page+' / '+pages+' 页';prev.disabled=c.page===1;next.disabled=c.page===pages;list.replaceChildren();if(!found.length){list.append(el('p','当前筛选下暂无待跟进记录。','tan-empty'));return;}
    const ft=table(['学生 / 学号','任务','跟进原因','教师评分','操作']);for(const x of found.slice((c.page-1)*25,c.page*25)){const tr=el('tr'),name=el('td'),action=el('td');name.append(el('strong',x.r.display_name||'未填写姓名'),el('small',x.r.student_no||''));action.append(button(hasReport(x.cell)?'查看报告':'查看任务',()=>drill(c,()=>hasReport(x.cell)?window.MatinTaskReports.teacherReport({...x.t,class_id:d.class.id,active:true},{student_id:x.r.student_id,display_name:x.r.display_name}):window.MatinTaskReports.teacher({...x.t,class_id:d.class.id,active:true})),'tan-link'));tr.append(name,el('td',x.t.title),el('td',x.tags.map(t=>t[1]).join(' · ')),el('td',scored(x.cell)?String(x.cell.teacher_score):'未评分'),action);ft.tb.append(tr);}list.append(ft.wrap);
   }
   reason.onchange=()=>{c.reason=reason.value;c.page=1;renderFollow();};search.oninput=()=>{c.query=search.value;c.page=1;renderFollow();};renderFollow();
   const links=el('div',undefined,'tan-actions');links.append(button('查看学习进度',()=>drill(c,()=>window.MatinCourseMatrix.open({class_id:c.classId,course_id:c.courseId}))),button('打开课程成绩册',()=>drill(c,()=>window.MatinGradebook.open({class_id:c.classId,course_id:c.courseId}))));content.append(links);
  }
  root.addEventListener('keydown',e=>{if(root.inert)return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dismiss();}if(e.key==='Tab'){const ns=[...root.querySelectorAll('button:not(:disabled),input,select,[tabindex="0"]')].filter(n=>n.getClientRects().length);if(e.shiftKey&&document.activeElement===ns[0]){e.preventDefault();ns.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===ns.at(-1)){e.preventDefault();ns[0]?.focus();}}});
  for(const name of ['matin-report-reviewed','matin-membership-reviewed','matin-class-teaching-changed','matin-teacher-tasks-changed'])window.addEventListener(name,()=>{if(current)void load(current);});
  window.MatinTeachingAnalytics.open=open;
 }};
})();
