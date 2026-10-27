/* Read-only review checks for signed-in students. No report or learning data is auto-submitted. */
(() => {
 'use strict';
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const notice=el('section');notice.id='student-review-notice';notice.hidden=true;notice.setAttribute('aria-label','报告批阅提醒');
 const top=el('div'),title=el('strong'),toggle=el('button','查看修改要求'),retry=el('button','重新检查'),warning=el('p'),list=el('div');
 title.setAttribute('role','status');title.setAttribute('aria-live','polite');
 toggle.type=retry.type='button';toggle.className=retry.className='btn tiny';toggle.id='student-review-toggle';retry.id='student-review-refresh';
 list.id='student-review-items';list.hidden=true;toggle.setAttribute('aria-controls',list.id);toggle.setAttribute('aria-expanded','false');
 warning.id='student-review-warning';top.append(title,toggle,retry);notice.append(top,warning,list);
 const css=el('style');css.textContent=`
 #student-review-notice{position:sticky;top:var(--review-header-height,76px);z-index:19;padding:10px max(16px,calc((100vw - 1332px)/2));background:#fff6e8;border-bottom:1px solid #edc995;color:#744518;font-size:13px;box-shadow:0 4px 12px #5c38150a}
 #student-review-notice[hidden],#student-review-notice [hidden]{display:none!important}#student-review-notice>div:first-child{display:flex;align-items:center;gap:10px;flex-wrap:wrap}#student-review-notice strong{margin-right:auto}#student-review-warning{margin:6px 0 0;line-height:1.6}
 #student-review-items{max-height:35vh;overflow:auto;overscroll-behavior:contain;margin-top:10px}#student-review-items article{padding:12px;background:#fff;border:1px solid #ead5b7;border-radius:10px;margin:8px 0;overflow-wrap:anywhere}#student-review-items h3{font-size:14px;margin:0}#student-review-items p{line-height:1.7;white-space:pre-wrap;margin:5px 0}#student-review-items button{margin:5px 8px 0 0}#student-review-items small{display:block;margin:4px 0;color:#6b7081}
 #student-review-count{background:#a44816;color:#fff;border-radius:6px;padding:2px 6px;font-size:11px}#student-review-notice :focus-visible{outline:3px solid #8d9ff2;outline-offset:2px}
 @media(max-width:650px){#student-review-notice{padding:9px 12px}#student-review-notice strong{width:100%;font-size:13px}#student-review-items{max-height:32vh}}
 `;document.head.append(css);
 const header=document.querySelector('header');
 if(header){new ResizeObserver(()=>notice.style.setProperty('--review-header-height',header.getBoundingClientRect().height+'px')).observe(header);}
 let owner='',signature='',lastAttempt=0,checking=false;
 const identity=()=>window.MatinStudent?.signedIn?MatinStudent.userId:'';
 const eligible=()=>!!identity()&&window.MatinStudent.mine();
 const date=v=>Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('zh-CN'):'请查看报告';
 function render(){
  const next=identity(),bar=document.getElementById('student-bar'),nav=document.getElementById('student-my-tasks');
  if(owner!==next){owner=next;signature='';lastAttempt=0;list.replaceChildren();list.hidden=true;toggle.textContent='查看修改要求';toggle.setAttribute('aria-expanded','false');}
  if(!eligible()||window.MatinNotifications?.active){notice.hidden=true;document.getElementById('student-review-count')?.remove();return;}
  if(bar&&notice.previousElementSibling!==bar)bar.after(notice);
  const state=MatinTasks.studentState(),rows=state.tasks.filter(t=>!t.class_ended_at&&t.active!==false&&t.available!==false&&t.review_status==='revision_required').sort((a,b)=>Date.parse(a.resubmit_due_at)-Date.parse(b.resubmit_due_at)||String(a.id).localeCompare(String(b.id)));
  let badge=document.getElementById('student-review-count');
  if(rows.length&&nav){if(!badge){badge=el('span');badge.id='student-review-count';nav.append(badge);}badge.textContent='待修改 '+rows.length;}
  else badge?.remove();
  const stale=state.refreshError||state.error||(!navigator.onLine?'当前离线，批阅结果尚未更新。':'');
  notice.hidden=!rows.length&&!stale;
  const heading=rows.length?'教师退回了 '+rows.length+' 份报告，请修改后重交。':'批阅结果暂未更新';
  if(title.textContent!==heading)title.textContent=heading;
  warning.hidden=!stale;warning.textContent=stale?'批阅结果更新失败，'+(state.loadedAt?'暂显示上次读取的结果。':'请稍后重试。'):'';
  toggle.hidden=!rows.length;retry.disabled=checking||!!state.busy||!!state.loading;
  const nextSignature=JSON.stringify(rows.map(t=>[t.id,t.title,t.class_name,t.course_name,t.revision_reason,t.resubmit_due_at,t.submission_version,t.feedback_revision]));
  if(signature===nextSignature)return;signature=nextSignature;
  const focused=list.contains(document.activeElement)?document.activeElement.id:'',scroll=list.scrollTop;
  list.replaceChildren();
  for(const t of rows){const article=el('article'),report=el('button','查看教师批阅'),resume=el('button','继续修改');article.dataset.reviewTask=t.id;
   article.append(el('h3',t.title),el('small',[t.course_name,t.class_name,'第 '+t.submission_version+' 版报告'].filter(Boolean).join(' · ')),el('p','修改要求：'+(t.revision_reason||'请查看教师批阅。')),el('p','重交截止：'+date(t.resubmit_due_at)));
   for(const b of [report,resume]){b.type='button';b.className='btn tiny';}report.id='review-report-'+t.id;resume.id='review-resume-'+t.id;
   const actor=owner;report.onclick=()=>{if(actor===identity())MatinTaskReports.student(t);};resume.onclick=()=>{if(actor===identity())MatinTasks.openStudent(t.id);};article.append(report,resume);list.append(article);
  }
  list.scrollTop=scroll;if(focused)document.getElementById(focused)?.focus({preventScroll:true});
 }
 async function check(force=false){
  render();if(!eligible()||document.hidden||!navigator.onLine||checking||MatinTasks.studentState().busy)return;
  if(!force&&Date.now()-Math.max(lastAttempt,MatinTasks.studentState().loadedAt||0)<15000)return;
  const actor=identity();checking=true;lastAttempt=Date.now();render();
  try{await MatinTasks.loadStudent({background:true});}finally{checking=false;if(actor===identity())render();}
 }
 toggle.onclick=()=>{list.hidden=!list.hidden;toggle.textContent=list.hidden?'查看修改要求':'收起修改要求';toggle.setAttribute('aria-expanded',String(!list.hidden));};
 retry.onclick=()=>check(true);
 window.addEventListener('matin-student-tasks-changed',render);
 window.addEventListener('matin-student-membership-changed',render);
 window.addEventListener('matin-student-auth-changed',render);
 window.addEventListener('matin-notifications-changed',render);
 window.addEventListener('focus',()=>check());
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
 window.addEventListener('online',()=>check(true));window.addEventListener('offline',render);
 window.addEventListener('pagehide',()=>{notice.hidden=true;});
 setInterval(()=>check(),30000);
})();
