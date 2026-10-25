/* Teacher review queue: metadata only, scoped by the authenticated teacher. */
(() => {'use strict';
 const el=(tag,text,cls='')=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;n.className=cls;return n;};
 const button=(text,fn,primary=false)=>{const n=el('button',text,'btn'+(primary?' primary':''));n.type='button';n.onclick=fn;return n;};
 const label=s=>({pending_review:'待批阅',revision_required:'待学生修改',passed:'已通过'}[s]||'已提交');
 const time=v=>new Date(v).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
 window.MatinReviewInbox={init({account}){
  if(!account)return;
  const css=el('style',`
   .ri-home{background:white;border:1px solid #dce4f5;border-radius:20px;padding:18px 24px;margin:18px 0 24px;box-shadow:0 8px 28px #243a6c06}.ri-home>.ri-hint{margin-bottom:0}
   .ri-header,.ri-actions,.ri-row{display:flex;align-items:center;gap:12px;justify-content:space-between}.ri-header{flex-wrap:wrap}.ri-header h2{font-size:22px;margin:0}.ri-header strong{color:#5049d9}.ri-hint{font-size:13px;color:#70809c;line-height:1.7;margin:10px 0;white-space:pre-wrap}
   .ri-actions{justify-content:flex-start;flex-wrap:wrap}.ri-row{padding:12px 0;border-bottom:1px solid #edf0f7}.ri-row:last-child{border:0}.ri-row>div{min-width:0}.ri-row strong,.ri-row small{display:block;overflow-wrap:anywhere}.ri-row small{color:#72819a;margin-top:5px;font-size:13px;line-height:1.6}.ri-row .btn{flex-shrink:0}.ri-pill{font-size:12px;border-radius:8px;padding:4px 8px;background:#eeedff;color:#5149cd}
   .ri-layer{position:fixed;inset:0;z-index:150;background:#152241aa;display:flex;align-items:center;justify-content:center;padding:20px}.ri-layer[hidden]{display:none!important}.ri-panel{background:white;border-radius:22px;width:min(1120px,100%);max-height:94vh;display:flex;flex-direction:column;min-width:0;color:#253555}.ri-panel>header,.ri-panel>footer{padding:20px 24px;flex-shrink:0;border-bottom:1px solid #e3e9f3}.ri-panel>footer{border-bottom:0;border-top:1px solid #e3e9f3}.ri-body{padding:0 24px 22px;min-height:0;overflow:auto}.ri-panel h2{margin:0;font-size:23px}
   .ri-filters{display:grid;grid-template-columns:1fr 1fr 2fr auto;align-items:end;gap:12px;margin:16px 0}.ri-filters label{display:grid;gap:6px;font-size:13px;min-width:0}.ri-filters input,.ri-filters select{width:100%;font:inherit;padding:10px;border:1px solid #d7e0f2;border-radius:10px;background:white;color:inherit;box-sizing:border-box}.ri-panel :focus-visible{outline:3px solid #c3caff;outline-offset:2px}.ri-panel [disabled]{opacity:.55}.ri-pages{display:flex;align-items:center;gap:12px;justify-content:space-between;flex-wrap:wrap}
   @media(max-width:1200px){.topbar{flex-wrap:wrap}.topbar .nav{order:3;width:100%;margin:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}}
   @media(max-width:680px){.topbar .nav{grid-template-columns:repeat(2,minmax(0,1fr))}}
   @media(max-width:650px){.ri-layer{padding:8px}.ri-panel{max-height:96vh;border-radius:16px}.ri-home{padding:16px}.ri-panel>header,.ri-panel>footer{padding:14px}.ri-body{padding:0 14px 14px}.ri-filters{grid-template-columns:1fr 1fr}.ri-filters label:nth-child(3){grid-column:1/-1}.ri-row{align-items:flex-start;flex-wrap:wrap}.ri-row>.btn{margin-left:auto}.ri-header h2{font-size:19px}}
  `);document.head.append(css);
  const home=el('section',undefined,'ri-home');home.id='teacher-review-home';home.setAttribute('aria-label','报告批阅待办');
  const homeHead=el('div',undefined,'ri-header'),title=el('h2','待批阅报告 · 正在读取'),homeActions=el('div',undefined,'ri-actions');
  const refreshHome=button('刷新待批阅',()=>loadHome()),openCenter=button('进入批阅中心',()=>open(true),true);
  refreshHome.title='页面可见时每分钟更新，也可手动刷新';
  const homeStatus=el('p',undefined,'ri-hint');homeStatus.setAttribute('role','status');homeActions.append(refreshHome,openCenter);homeHead.append(title,homeActions);home.append(homeHead,homeStatus);
  document.querySelector('#view-dashboard .dashboard-hero').before(home);
  const nav=button('报告批阅 · …',()=>open());nav.id='teacher-review-open';document.querySelector('.nav').append(nav);
  const root=el('div',undefined,'ri-layer modal-layer');root.id='teacher-review-center';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','ri-title');
  const panel=el('section',undefined,'ri-panel'),head=el('header',undefined,'ri-header'),centerTitle=el('h2','报告批阅中心');centerTitle.id='ri-title';
  const dismiss=button('关闭',()=>close()),body=el('div',undefined,'ri-body'),foot=el('footer',undefined,'ri-pages');head.append(centerTitle,dismiss);
  const filters=el('div',undefined,'ri-filters'),classes=el('select'),states=el('select'),search=el('input'),apply=button('筛选',()=>{page=1;void loadCenter();});
  search.type='search';search.maxLength=100;search.placeholder='姓名、学号、任务或项目…';
  classes.append(new Option('全部班级',''));for(const [value,text] of [['pending_review','待批阅'],['revision_required','待学生修改'],['passed','已通过'],['all','全部已提交']])states.append(new Option(text,value));
  for(const [text,input] of [['班级',classes],['批阅状态',states],['搜索报告',search]]){const l=el('label',text);l.append(input);filters.append(l);}filters.append(apply);
  const summary=el('p',undefined,'ri-hint'),status=el('p',undefined,'ri-hint'),list=el('div');status.setAttribute('role','status');
  body.append(filters,summary,status,list);const count=el('span'),prev=button('上一页',()=>{page--;void loadCenter();}),next=button('下一页',()=>{page++;void loadCenter();}),refresh=button('刷新报告',()=>loadCenter());foot.append(count,prev,next,refresh);panel.append(head,body,foot);root.append(panel);document.body.append(root);
  let homeSeq=0,centerSeq=0,page=1,pages=1,opener=null,lastHome=0;
  function openReport(row){window.MatinTaskReports.teacherReport({id:row.task_id,title:row.title,class_id:row.class_id,active:true},{student_id:row.student_id,display_name:row.display_name});}
  function renderRows(target,rows){target.replaceChildren();for(const row of rows){const item=el('article',undefined,'ri-row');item.dataset.reviewStudent=row.student_id;item.dataset.reviewTask=row.task_id;
   const info=el('div');info.append(el('strong',row.display_name+' · '+row.title),el('small',row.class_name+(row.archived_at?'（已归档班级）':'')+' · 学号 '+row.student_no+' · '+row.project_title),el('small','第 '+row.version+' 版 · '+time(row.submitted_at)+' 提交 · '+label(row.review_status)+(row.teacher_score!=null?' · 教师评分 '+row.teacher_score+' / 100':'')));
   item.append(info,button(row.review_status==='pending_review'?'立即批阅':'查看报告',()=>openReport(row),row.review_status==='pending_review'));target.append(item);
  }}
  const fetchQueue=async data=>{const r=await MatinAccount.api({action:'review_inbox',data});if(r.inbox_version!==1||!Array.isArray(r.rows))throw Error('批阅中心尚未升级，请更新教师批阅提醒与评分 SQL 和 matin-courses。');return r;};
  async function loadHome(){const seq=++homeSeq;lastHome=Date.now();refreshHome.disabled=true;homeStatus.textContent='正在同步待批阅报告…';
   try{const r=await fetchQueue({status:'pending_review',page:1});if(seq!==homeSeq)return;title.textContent='待批阅报告 · '+r.global_pending+' 份';nav.textContent='报告批阅 · '+r.global_pending;
    homeStatus.textContent=(r.global_pending?'进入批阅中心查看名单，每页 20 份，可按班级、姓名或学号查找。':'当前没有待批阅报告。')+' 已同步 '+time(new Date())+'。';
   }catch(e){if(seq!==homeSeq)return;title.textContent='待批阅报告 · 暂未获取';nav.textContent='报告批阅 · !';homeStatus.textContent=e.message||'读取失败，请重试。';}
   finally{if(seq===homeSeq)refreshHome.disabled=false;}
  }
  async function loadCenter(){if(root.hidden)return;const seq=++centerSeq;const selected=classes.value;status.textContent='正在同步报告列表…';list.replaceChildren();summary.textContent='';count.textContent='';prev.disabled=next.disabled=true;
   try{const r=await fetchQueue({status:states.value,class_id:selected,search:search.value.trim(),page});if(seq!==centerSeq||root.hidden)return;
    classes.replaceChildren(new Option('全部班级',''));for(const c of r.classes)classes.append(new Option(c.name+(c.archived?'（已归档）':''),c.id));classes.value=selected;
    page=r.page;pages=r.pages;renderRows(list,r.rows);if(!r.rows.length)list.append(el('p','没有符合条件的已提交报告。','ri-hint'));
    summary.textContent='当前筛选范围：待批阅 '+r.counts.pending_review+' · 待学生修改 '+r.counts.revision_required+' · 已通过 '+r.counts.passed;
    status.textContent='每页 20 份，按提交时间从早到晚排列；每名学生、每条任务只列最新提交版本。历史版本在报告内查看，已撤回任务和历史成员请从任务完成明细查看。';
    count.textContent='共 '+r.total+' 份 · 第 '+page+' / '+pages+' 页';prev.disabled=page<=1;next.disabled=page>=pages;nav.textContent='报告批阅 · '+r.global_pending;
   }catch(e){if(seq===centerSeq&&!root.hidden){list.replaceChildren();status.textContent=e.message||'读取失败，请刷新重试。';}}
  }
  function open(pendingOnly=false){opener=document.activeElement;if(pendingOnly){states.value='pending_review';classes.value='';search.value='';page=1;}root.hidden=false;dismiss.focus();void loadCenter();}
  function close(){centerSeq++;root.hidden=true;if(opener?.isConnected)opener.focus();}
  classes.onchange=states.onchange=()=>{page=1;void loadCenter();};search.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();page=1;void loadCenter();}};
  root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}if(e.key==='Tab'){const a=[...root.querySelectorAll('button:not(:disabled),select,input')].filter(n=>n.getClientRects().length);if(e.shiftKey&&document.activeElement===a[0]){e.preventDefault();a.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===a.at(-1)){e.preventDefault();a[0].focus();}}});
  window.addEventListener('matin-report-reviewed',()=>{void loadHome();if(!root.hidden)void loadCenter();});
  window.addEventListener('matin-report-closed',()=>{if(document.activeElement===document.body){if(!root.hidden)dismiss.focus();else openCenter.focus();}});
  function refreshVisible(){if(document.visibilityState!=='visible'||Date.now()-lastHome<15000)return;if(home.getClientRects().length)void loadHome();if(!root.hidden&&!root.inert)void loadCenter();}
  window.addEventListener('focus',refreshVisible);document.addEventListener('visibilitychange',refreshVisible);setInterval(refreshVisible,60000);
  void loadHome();
 }};
})();
