/* Sidebar presentation only. Move existing controls so their handlers and permissions survive. */
(() => {'use strict';
 const side=document.getElementById('teacher-sidebar'),nav=side?.querySelector('nav.nav');
 if(!nav)return;
 const make=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text)e.textContent=text;return e;};
 const paths={home:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',edit:'M4 20h4L20 8l-4-4L4 16v4z M13 7l4 4',plan:'M5 4h14v17H5z M8 2v4 M16 2v4 M8 11h8 M8 16h5',classes:'M3 5h18v16H3z M3 10h18 M8 5v16',review:'M5 3h14v18H5z M8 8h8 M8 13l2 2 5-5',chart:'M4 3v18h17 M8 16v-4 M13 16V8 M18 16V5',grade:'M5 3h14v18H5z M8 8h8 M8 12h8 M8 16h5',archive:'M3 4h18v5H3z M5 9v12h14V9 M9 13h6',settings:'M4 7h16 M4 17h16 M8 4v6 M16 14v6',usage:'M4 19V9 M10 19V5 M16 19v-7 M22 19V3',external:'M14 3h7v7 M21 3L10 14 M10 5H4v15h15v-6'};
 function icon(kind){const e=make('span','side-icon');e.setAttribute('aria-hidden','true');e.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="'+paths[kind]+'"/></svg>';return e;}
 const overview=make('div','side-overview');nav.prepend(overview);
 function group(title){const s=make('section','side-group'),h=make('h2','side-heading',title),list=make('div','side-items');s.setAttribute('aria-label',title);s.append(h,list);nav.append(s);return list;}
 const preparation=group('教学准备'),teaching=group('教学管理'),resources=group('资料与设置');
 const footer=side.querySelector('.topright');
 const toggle=make('button','side-toggle','导航');toggle.type='button';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','teacher-navigation teacher-side-tools');nav.id='teacher-navigation';footer.id='teacher-side-tools';side.querySelector('.brand-block').append(toggle);
 const compact=()=>matchMedia('(max-width:900px)').matches;
 function collapse(){side.classList.remove('side-expanded');toggle.setAttribute('aria-expanded','false');}
 toggle.onclick=()=>{const open=side.classList.toggle('side-expanded');toggle.setAttribute('aria-expanded',String(open));};
 side.addEventListener('keydown',e=>{if(e.key==='Escape'){if(compact()){collapse();toggle.focus();}}});
 const entries=[['[data-nav="dashboard"]',overview,'教师工作台','home'],['[data-nav="studio"]',preparation,'剧本编辑','edit'],['#teaching-plans-open',preparation,'教学计划','plan'],['#classes-open',teaching,'班级管理','classes'],['#teacher-review-open',teaching,'报告批阅','review'],['#course-matrix-open',teaching,'学习进度','chart'],['#course-gradebook-open',teaching,'课程成绩册','grade'],['#teaching-archive-open',resources,'教学档案','archive'],['#ai-usage-open',resources,'AI 使用量','usage'],['#settings-open',resources,'AI 模型设置','settings']];
 const dialogs=[['classes-modal','#classes-open'],['teaching-plans-modal','#teaching-plans-open'],['teacher-review-center','#teacher-review-open'],['course-matrix-modal','#course-matrix-open'],['course-gradebook-modal','#course-gradebook-open'],['teaching-archive-dialog','#teaching-archive-open'],['ai-usage-dialog','#ai-usage-open'],['settings-modal','#settings-open']];
 const visible=e=>e&&!e.hidden&&!e.classList.contains('hidden')&&(e.tagName!=='DIALOG'||e.open);
 function syncCurrent(){
  const opened=dialogs.filter(([id])=>visible(document.getElementById(id))).at(-1);
  const active=opened?side.querySelector(opened[1]):visible(document.getElementById('task-reports-modal'))?side.querySelector('#teacher-review-open'):side.querySelector('[data-nav].active');
  for(const [selector]of entries){const b=side.querySelector(selector);if(!b)continue;const current=b===active;if(b.classList.contains('side-current')!==current)b.classList.toggle('side-current',current);const aria=current?'page':null;if(b.getAttribute('aria-current')!==aria){if(aria)b.setAttribute('aria-current',aria);else b.removeAttribute('aria-current');}}
 }
 const watched=new WeakSet();let frame=0;
 const scheduleCurrent=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;syncCurrent();});};
 const stateObserver=new MutationObserver(scheduleCurrent);
 function watchStates(){for(const id of [...dialogs.map(x=>x[0]),'task-reports-modal','view-dashboard','view-studio','view-runtime']){const e=document.getElementById(id);if(e&&!watched.has(e)){watched.add(e);stateObserver.observe(e,{attributes:true,attributeFilter:['class','hidden','open','style']});}}scheduleCurrent();}
 new MutationObserver(watchStates).observe(document.body,{childList:true});
 watchStates();

 function decorate(b,label,kind){
   if(b.querySelector('.side-label'))return;
   const raw=b.textContent,badge=b.id==='teacher-review-open'?raw.split('·').pop().trim():null;
   b.replaceChildren(icon(kind),make('span','side-label',label));
   if(badge&&badge!=='0'&&/^\d+$/.test(badge)){const count=make('span','side-count',badge);count.setAttribute('aria-label',badge+' 份待批阅');b.append(count);}
   if(badge==='!'){b.append(make('span','side-warning','!'));b.title='待批阅数量读取失败，请打开后重试';}else if(b.id==='teacher-review-open')b.title='查看和批阅学生报告';
   b.classList.add('side-control');
 }
 function arrange(){
   for(const [selector,parent,label,kind]of entries){const b=side.querySelector(selector);if(!b)continue;if(b.parentElement!==parent)parent.append(b);decorate(b,label,kind);}
   // Stable order also when authenticated modules finish loading later.
   for(const parent of [overview,preparation,teaching,resources]){const ordered=entries.filter(x=>x[1]===parent).map(x=>side.querySelector(x[0])).filter(Boolean);ordered.forEach((b,i)=>{if(parent.children[i]!==b)parent.insertBefore(b,parent.children[i]||null);});}
   for(const parent of [preparation,teaching,resources])parent.parentElement.hidden=!parent.children.length;
   syncCurrent();
 }
 const student=side.querySelector('#student-entry');student.classList.add('side-control');student.replaceChildren(icon('external'),make('span','side-label','打开学生学习中心'));
 footer.prepend(student);
 // Modules update report counts with textContent; redecorate after those updates.
 new MutationObserver(arrange).observe(side,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});
 arrange();
 // Leave the menu expanded when launching dialogs: their existing focus return stays reachable.
 nav.addEventListener('click',e=>{if(compact()&&e.target.closest('[data-nav]')){collapse();toggle.focus();}});
})();
