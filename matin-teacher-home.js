/* Cross-class teacher todo summaries. Lists and mutations remain owner-authorized on the server. */
(() => {
 'use strict';
 const el=(tag,text,cls='')=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;n.className=cls;return n;};
 const button=(text,fn,cls='btn')=>{const b=el('button',text,cls);b.type='button';b.onclick=fn;return b;};
 const time=v=>v?new Date(v).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'—';
 window.MatinTeacherHome={init({account,openReports,setReportCount}){
  if(!account)return;
  const root=el('section',undefined,'th-home');root.id='teacher-todo-home';root.setAttribute('aria-label','教师首页待办');
  const style=el('style',`
   .th-home{background:white;border:1px solid #dce4f5;border-radius:20px;padding:22px 24px;margin:18px 0 24px}.th-head,.th-actions,.th-pages,.th-item{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.th-head h2{font-size:22px;margin:0;color:#253555}.th-hint{font-size:13px;line-height:1.7;color:#71809b;margin:8px 0}.th-status{min-height:22px}.th-error{color:#9a4e16}.th-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:16px}.th-metric{padding:15px 16px;text-align:left;background:#f8faff;border:1px solid #e0e6f3;border-radius:13px;color:#3a4d72;font:inherit;cursor:pointer}.th-metric strong{display:block;margin:6px 0;font-size:28px;color:#354b9b}.th-metric small{display:block;font-size:12px;color:#71809b;line-height:1.6}.th-metric[aria-expanded=true]{border-color:#827bf2;background:#eeedff}.th-metric.th-urgent strong{color:#ad4f14}.th-metric.th-urgent{background:#fff8ef}.th-home :focus-visible{outline:3px solid #aeb9ff;outline-offset:3px}.th-home button:disabled{opacity:.55;cursor:not-allowed}.th-work[hidden]{display:none}.th-work{border-top:1px solid #e7ebf4;padding-top:18px;margin-top:18px}.th-work h3{margin:0;font-size:18px}.th-filters{display:flex;align-items:end;gap:10px;flex-wrap:wrap;margin:14px 0}.th-filters label{display:grid;gap:6px;min-width:150px;font-size:13px;color:#526582}.th-filters label:nth-child(2){flex:1}.th-filters input,.th-filters select{padding:10px;border:1px solid #d8e0ef;border-radius:9px;font:inherit;width:100%;min-width:0;color:#35466b;background:#fff}.th-item{padding:15px 0;border-bottom:1px solid #edf0f6;flex-wrap:nowrap}.th-item>div:first-child{min-width:0;flex:1;overflow-wrap:anywhere}.th-item h4{margin:0 0 5px;font-size:15px;line-height:1.6;color:#293959}.th-item p{margin:3px 0}.th-actions{justify-content:flex-start;flex-shrink:0}.th-item .btn{font-size:12px;padding:8px 12px}.th-pages{justify-content:flex-end;margin-top:14px}.th-pages span{margin-right:auto;font-size:13px;color:#71809b}.th-empty{padding:20px 0;color:#71809b;font-size:13px}.th-message{white-space:pre-wrap}.th-home .th-work :disabled{cursor:not-allowed}
   @media(max-width:800px){.th-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.th-item{align-items:flex-start;flex-wrap:wrap}.th-actions{flex-wrap:wrap}}@media(max-width:550px){.th-home{padding:16px}.th-metrics{gap:8px}.th-metric{padding:12px}.th-metric strong{font-size:25px}.th-item>div:first-child{flex-basis:100%}.th-filters label{min-width:100%}.th-head h2{font-size:20px}.th-head .btn{font-size:12px;padding:8px 10px}.th-pages{gap:8px}}
  `);document.head.append(style);
  const head=el('div',undefined,'th-head'),title=el('h2','教学待办'),refreshButton=button('刷新待办',()=>refresh({manual:true}));head.append(title,refreshButton);
  const hint=el('p','汇总教学中的全部班级，点击下方卡片处理。已结课记录可在班级档案查阅。','th-hint');
  const status=el('p','正在读取最新待办…','th-hint th-status');status.id='teacher-todo-status';status.setAttribute('role','status');
  const metrics=el('div',undefined,'th-metrics'),cards=new Map();
  for(const [key,name,unit,help] of [['pending_review','待批阅报告','份','进入批阅中心'],['admissions','待审核学生','条申请','跨班级审核入班申请'],['upcoming','近期截止任务','项','未来 7 天，含个人重交期限'],['overdue','逾期未交','人次','按学生 × 任务统计']]){
   const b=button('',()=>key==='pending_review'?openReports():openKind(key),'th-metric'),label=el('span',name),n=el('strong','—'),small=el('small',help);b.dataset.todoKind=key;b.append(label,n,small);b.setAttribute('aria-label',name+'：正在读取');if(key!=='pending_review'){b.setAttribute('aria-expanded','false');b.setAttribute('aria-controls','teacher-todo-work');}metrics.append(b);cards.set(key,{b,n,small,name,unit,help});
  }
  const work=el('div',undefined,'th-work');work.id='teacher-todo-work';work.hidden=true;
  const workHead=el('div',undefined,'th-head'),workTitle=el('h3'),collapse=button('收起列表',()=>{seq++;loading=false;const previous=kind;kind='summary';work.hidden=true;markKind();lock();cards.get(previous)?.b.focus();});workHead.append(workTitle,collapse);
  const filters=el('div',undefined,'th-filters'),classes=el('select'),search=el('input'),apply=button('查找',()=>{query=search.value.trim();page=1;void refresh({manual:true});});search.type='search';search.maxLength=100;
  for(const [text,input] of [['班级',classes],['搜索待办',search]]){const l=el('label',text);l.append(input);filters.append(l);}filters.append(apply);
  const message=el('p','','th-hint th-message');message.setAttribute('role','status');
  const list=el('div');list.id='teacher-todo-list';
  const pages=el('nav',undefined,'th-pages');pages.setAttribute('aria-label','教师待办分页');const count=el('span'),prev=button('上一页',()=>{page--;void refresh({manual:true});}),next=button('下一页',()=>{page++;void refresh({manual:true});});pages.append(count,prev,next);
  const footnote=el('p','','th-hint');work.append(workHead,filters,message,list,pages,footnote);root.append(head,hint,metrics,status,work);document.querySelector('#view-dashboard .dashboard-hero').before(root);
  let kind='summary',classId='',query='',page=1,seq=0,last=0,data=null,writing=false,loading=false;
  function markKind(){for(const [key,c] of cards)if(key!=='pending_review')c.b.setAttribute('aria-expanded',String(key===kind));}
  function displayCounts(r){for(const [key,c] of cards){const n=r?.counts[key];c.n.textContent=Number.isFinite(n)?String(n):'—';c.b.setAttribute('aria-label',c.name+'：'+(Number.isFinite(n)?n+' '+c.unit:'暂未获取'));c.b.classList.toggle('th-urgent',key==='overdue'&&n>0);c.small.textContent=key==='overdue'&&r?'按人次计 · 涉及 '+r.counts.overdue_tasks+' 项任务':c.help;}setReportCount(r?.counts.pending_review??null);}
  function lock(){root.querySelectorAll('button,input,select').forEach(n=>n.disabled=writing);refreshButton.disabled=writing||loading;prev.disabled=writing||loading||!data||page<=1;next.disabled=writing||loading||!data||page>=data.pages;}
  function openKind(value){if(writing)return;kind=value;classId='';query='';search.value='';message.textContent='';page=1;data=null;work.hidden=false;workTitle.textContent=cards.get(kind).name;search.placeholder=kind==='admissions'?'姓名、学号或班级…':'任务、课程、项目或班级…';markKind();void refresh({manual:true});}
  function draw(r){
   const focused=document.activeElement,key=list.contains(focused)?focused.dataset.todoAction:null;
   list.replaceChildren();
   for(const row of r.rows){const item=el('article',undefined,'th-item'),copy=el('div'),actions=el('div',undefined,'th-actions');item.dataset.todoRow=row.student_id?row.class_id+':'+row.student_id:row.id;
    if(kind==='admissions'){
     copy.append(el('h4',row.display_name+' · '+row.student_no),el('p',row.class_name+' · '+time(row.requested_at)+' 申请','th-hint'));
     for(const [decision,label,primary] of [['approved','通过',true],['rejected','拒绝',false]]){const b=button(label,()=>decide(row,decision),'btn'+(primary?' primary':''));b.dataset.todoAction=item.dataset.todoRow+':'+decision;actions.append(b);}
    }else{
     const overdue=kind==='overdue';copy.append(el('h4',row.title),el('p',row.class_name+' · '+row.course_name+' · '+row.project_title,'th-hint'));
     copy.append(el('p',overdue?'逾期未交 '+row.overdue+' 人次 · 最早截止 '+time(row.first_overdue_at):'最近截止 '+time(row.next_due_at)+(row.resubmissions_due?' · 含 '+row.resubmissions_due+' 人待重交':''),'th-hint'+(overdue?' th-error':'')));
     copy.append(el('p','当前在班 '+row.members+' 人 · 待交 '+row.unsubmitted+' 人 · 任务截止 '+time(row.due_at),'th-hint'));
     const detail=button(overdue?'查看未交名单':'查看完成明细',()=>MatinTaskReports.teacher({...row,active:true},{filter:overdue?'overdue':'current'}),'btn primary');detail.dataset.todoAction=row.id+':detail';actions.append(detail);
     const edit=button('编辑 / 延期',()=>MatinTaskEdit.edit({...row,active:true},()=>refresh({manual:true})));edit.dataset.todoAction=row.id+':edit';actions.append(edit);
    }
    item.append(copy,actions);list.append(item);
   }
   if(!r.rows.length)list.append(el('p',classId||query?'没有符合筛选条件的待办。':kind==='admissions'?'当前没有待审核申请。':kind==='upcoming'?'未来 7 天没有截止任务。':'当前没有逾期未交记录。','th-empty'));
   count.textContent='共 '+r.total+(kind==='admissions'?' 条申请':' 项任务')+' · 第 '+r.page+' / '+r.pages+' 页';
   footnote.textContent='每页 10 条。'+(kind==='admissions'?'审核前会确认姓名、学号及班级；导入名单中尚未关联账号的学生不属于待审核申请。':(kind==='upcoming'?'按最近截止时间排序，包括待重交学生的个人期限。同一任务只列一条；全部学生已交的近期任务仍可查看。':'同一学生有多项未交任务会分别计数；按个人重交期限判断，不把已提交待批阅或已通过报告计为未交。')+'任务延期不会改动已有的个人重交期限；如需调整，请从学生明细打开报告批阅。');
   if(key)list.querySelector('[data-todo-action="'+CSS.escape(key)+'"]')?.focus({preventScroll:true});
  }
  async function refresh({manual=false}={}){
   if(writing||(!manual&&loading))return;const request=++seq;loading=true;last=Date.now();status.textContent='正在同步最新待办…';status.classList.remove('th-error');lock();
   const requestedKind=kind,requestedClass=classId,requestedQuery=query;
   if(manual){data=null;list.replaceChildren();count.textContent='正在读取…';}
   try{
    const r=await MatinAccount.api({action:'teacher_todos',data:{kind:requestedKind,class_id:requestedClass,search:requestedQuery,page}});
    if(request!==seq)return;if(r.todo_version!==1||!Array.isArray(r.rows)||!Array.isArray(r.classes)||!r.counts)throw Error('教师首页待办尚未升级，请完成本次 SQL 和云函数更新。');
    data=r;displayCounts(r);page=r.page;
    classes.replaceChildren(new Option('全部教学班级',''));for(const c of r.classes)classes.add(new Option(c.name,c.id));
    if(requestedClass&&!r.classes.some(c=>c.id===requestedClass))classes.add(new Option('所选班级（已无教学待办）',requestedClass));classes.value=requestedClass;
    status.textContent='已同步 '+time(r.as_of)+' · 页面可见时每分钟检查，也可手动刷新。';if(requestedKind!=='summary')draw(r);
   }catch(e){if(request!==seq)return;status.classList.add('th-error');status.textContent=(e.message||'待办读取失败，请重试。')+(data?' 当前显示上次读取的结果。':'');if(!data){displayCounts(null);list.replaceChildren();if(kind!=='summary')list.append(el('p','暂时无法读取待办，请点击“刷新待办”重试。','th-empty'));count.textContent='状态待同步';}}
   finally{if(request===seq){loading=false;lock();}}
  }
  async function decide(row,decision){
   if(writing)return;const name=decision==='approved'?'通过':'拒绝';if(!confirm('确认'+name+' '+row.display_name+'（学号 '+row.student_no+'）加入“'+row.class_name+'”的申请？'))return;
   writing=true;seq++;loading=false;lock();message.textContent='正在审核…';let result;
   try{await MatinAccount.api({action:'membership',op:'review',data:{class_id:row.class_id,student_id:row.student_id,revision:Number(row.revision),decision}});result='已'+name+' '+row.display_name+' 的入班申请。';}
   catch(e){result=(e.message||'审核未完成，请刷新后重试。')+' 将重新读取申请状态。';}
   finally{writing=false;await refresh({manual:true});message.textContent=result;lock();}
  }
  classes.onchange=()=>{classId=classes.value;page=1;message.textContent='';void refresh({manual:true});};search.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();apply.click();}};
  function autoRefresh(){if(document.visibilityState==='visible'&&root.getClientRects().length&&Date.now()-last>15000&&!writing)void refresh();}
  window.addEventListener('focus',autoRefresh);document.addEventListener('visibilitychange',autoRefresh);setInterval(autoRefresh,60000);
  for(const event of ['matin-membership-reviewed','matin-teacher-tasks-changed'])window.addEventListener(event,()=>{if(!writing)void refresh();});
  void refresh();return {refresh};
 }};
})();
