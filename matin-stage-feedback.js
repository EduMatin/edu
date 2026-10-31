/* Feedback at stage boundaries. Native dialog keeps keyboard focus in the decision. */
(() => {
 'use strict';
 const dialog=document.createElement('dialog');dialog.id='stage-feedback-dialog';dialog.setAttribute('aria-labelledby','stage-feedback-title');
 const style=document.createElement('style');style.textContent='#stage-feedback-dialog{box-sizing:border-box;width:min(620px,calc(100vw - 24px));max-height:90dvh;border:0;border-radius:20px;padding:24px;color:#27395c;overflow:auto;box-shadow:0 24px 80px #17234544}#stage-feedback-dialog::backdrop{background:#152241aa}#stage-feedback-dialog h2{margin:0 0 16px;font-size:22px}#stage-feedback-dialog p,#stage-feedback-dialog li{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7}#stage-feedback-dialog footer{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}#stage-feedback-dialog footer button{flex:1}#stage-feedback-dialog .sf-note{font-size:13px;color:#6c7891}';document.head.append(style);document.body.append(dialog);
 let resolveChoice=null;
 function cancel(){if(!resolveChoice)return;const done=resolveChoice;resolveChoice=null;if(dialog.open)dialog.close();done('stay');}
 function choose(value){const done=resolveChoice;resolveChoice=null;dialog.close();done?.(value);}
 const text=(tag,value)=>{const n=document.createElement(tag);n.textContent=value;return n;};
 function button(label,value,primary=false){const b=text('button',label);b.type='button';b.className='btn'+(primary?' primary':'');b.onclick=()=>choose(value);return b;}
 dialog.addEventListener('cancel',e=>{e.preventDefault();cancel();});
 window.MatinStageFeedback={cancel,show({node,result,error,allowed,finish,note}){
  cancel();dialog.replaceChildren();const title=text('h2',node+' · 学习反馈');title.id='stage-feedback-title';dialog.append(title);
  if(result){dialog.append(text('p','AI 建议分：'+result.score+' / 100'),text('p',result.feedback));const list=document.createElement('ul');for(const c of result.criteria)list.append(text('li',(c.met?'✓ ':'△ ')+c.name+'：'+c.comment));dialog.append(list,text('p','下一步：'+result.nextStep));}
  else dialog.append(text('p','暂未生成学习反馈：'+error),text('p','回答已保留。你可以重试反馈，或返回本阶段稍后处理。'+(allowed?'本次练习也可以先继续。':'考核路线仍需满足教师设置的条件。')));
  const hint=text('p',note);hint.className='sf-note';dialog.append(hint);const foot=document.createElement('footer');foot.append(button('留在本阶段','stay'));if(!result)foot.append(button('重试反馈','retry'));if(allowed)foot.append(button(finish?'结束本次学习':'继续下一阶段','continue',true));dialog.append(foot);
  return new Promise(resolve=>{resolveChoice=resolve;dialog.showModal();foot.querySelector('button').focus();});
 }};
})();
