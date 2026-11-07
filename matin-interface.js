/* Presentation only: existing buttons and their action handlers are preserved. */
(() => {
 'use strict';
 function accountMenu(){
  const bar=document.getElementById('teacher-account-bar');if(!bar||bar.querySelector('#teacher-account-menu'))return;
  const menu=document.createElement('details');menu.className='ui-menu';menu.id='teacher-account-menu';
  const summary=document.createElement('summary');summary.textContent='账号与工具';
  const panel=document.createElement('div');panel.className='ui-menu-panel';menu.append(summary,panel);bar.append(menu);
  const move=()=>{for(const button of [...bar.children].filter(e=>e.tagName==='BUTTON'))panel.append(button);};move();
  new MutationObserver(move).observe(bar,{childList:true});
 }
 accountMenu();const observer=new MutationObserver(()=>{accountMenu();if(document.getElementById('teacher-account-menu'))observer.disconnect();});
 if(document.documentElement.dataset.matinUi==='teacher')observer.observe(document.body,{childList:true});
 document.addEventListener('click',e=>{for(const menu of document.querySelectorAll('.ui-menu[open]'))if(!menu.contains(e.target)||e.target.closest('.ui-menu-panel button'))menu.open=false;});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){const menu=e.target.closest('.ui-menu[open]');if(menu){menu.open=false;menu.querySelector('summary').focus();e.preventDefault();}}});
 // Zero is a valid result, distinct from the loading/error dash. Never disable its action.
 const dashboard=document.getElementById('view-dashboard');if(dashboard){const mark=()=>{for(const card of dashboard.querySelectorAll('.th-metric')){const empty=card.querySelector('strong')?.textContent.trim()==='0';card.classList.toggle('ui-zero',empty);}};new MutationObserver(mark).observe(dashboard,{childList:true,subtree:true,characterData:true});mark();}
})();
