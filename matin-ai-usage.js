/* Teacher-only usage window. Read-only, no quota controls. */
(() => {
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const date=d=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
 const number=v=>Number(v||0).toLocaleString();let page=1,revision=0,busy=false;
 const style=document.createElement('style');style.textContent=`#ai-usage-dialog{border:1px solid #dce4f3;border-radius:22px;padding:0;width:min(1120px,94vw);max-height:90vh;color:#203255;background:white}#ai-usage-dialog::backdrop{background:#15213a99}#ai-usage-dialog header,#ai-usage-dialog footer{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:20px 24px;background:#fff}#ai-usage-dialog header{border-bottom:1px solid #e4e9f3}#ai-usage-dialog h2{margin:0;flex:1}#ai-usage-body{padding:0 24px;max-height:65vh;overflow:auto}#ai-usage-form{display:flex;gap:12px;flex-wrap:wrap;padding:18px 0}#ai-usage-form label{display:grid;gap:6px;flex:1;min-width:150px}#ai-usage-dialog input,#ai-usage-dialog select{padding:10px;border:1px solid #dce4f3;border-radius:10px;width:100%;background:white;color:inherit}#ai-usage-summary{display:flex;gap:12px;flex-wrap:wrap}#ai-usage-summary>div{flex:1;min-width:130px;background:#f3f5ff;padding:16px;border-radius:14px}#ai-usage-summary strong{display:block;font-size:26px;margin-top:6px}#ai-usage-table{overflow:auto;margin-top:16px}#ai-usage-table table{width:100%;min-width:730px;border-collapse:collapse}#ai-usage-table td,#ai-usage-table th{padding:13px 10px;text-align:left;border-bottom:1px solid #edf0f6}#ai-usage-table th{background:#f5f7fc}#ai-usage-dialog small,#ai-usage-note{color:#627592}#ai-usage-note{line-height:1.7}#ai-usage-status{min-height:24px;line-height:1.7;color:#74532e}#ai-usage-page{margin-right:auto}@media(max-width:600px){#ai-usage-body{padding:0 14px}#ai-usage-dialog header,#ai-usage-dialog footer{padding:14px}#ai-usage-dialog h2{font-size:20px}}`;
 document.head.append(style);
 const dialog=document.createElement('dialog');dialog.id='ai-usage-dialog';dialog.setAttribute('aria-labelledby','ai-usage-title');
 dialog.innerHTML=`<header><h2 id="ai-usage-title">班级 AI 使用量</h2><button class="btn" data-close>关闭</button></header><div id="ai-usage-body"><form id="ai-usage-form"><label>班级<select id="ai-usage-class"><option value="">全部班级及教师备课</option></select></label><label>使用者<select id="ai-usage-scope"><option value="all">全部</option><option value="student">学生学习</option><option value="teacher">教师备课</option></select></label><label>开始日期<input type="date" id="ai-usage-since" required></label><label>结束日期<input type="date" id="ai-usage-until" required></label><button class="btn primary" type="submit">查询 / 刷新</button></form><p id="ai-usage-status" role="status" aria-live="polite"></p><div id="ai-usage-summary"></div><div id="ai-usage-table"></div><p id="ai-usage-note">审核通过的学生从班级任务自动接入，无需访问码或个人密钥。这里只统计平台统一 AI，从本次升级后开始记录。个人密钥、独立旧版访问码服务的用量不计入。<br>Token 为模型返回的实际用量，不是费用；未返回用量的调用单独列出。处理中或结果未确认可能包括中断的请求，不能当作零消耗。结课前的历史仍可查询。每页20名使用者。</p></div><footer><span id="ai-usage-page"></span><button class="btn" id="ai-usage-prev">上一页</button><button class="btn" id="ai-usage-next">下一页</button></footer>`;
 document.body.append(dialog);const $=id=>dialog.querySelector('#ai-usage-'+id);
 for(const [id,label] of [['class','班级'],['scope','使用者'],['since','开始日期'],['until','结束日期']])$(id).setAttribute('aria-label',label);
 const today=new Date();$('until').value=date(today);$('since').value=date(new Date(today.getTime()-29*86400000));
 function lock(value){busy=value;dialog.setAttribute('aria-busy',String(value));for(const el of dialog.querySelectorAll('input,select,button:not([data-close])'))el.disabled=value;}
 async function load(){
  if(busy)return;const rev=++revision;lock(true);$('status').textContent='正在读取使用量…';
  try{
   const since=new Date($('since').value+'T00:00:00'),until=new Date($('until').value+'T00:00:00');until.setDate(until.getDate()+1);
   if(!Number.isFinite(+since)||!Number.isFinite(+until)||until<=since||until-since>366*86400000)throw Error('请选择有效日期，查询范围最多366天。');
   const selected=$('class').value,r=await MatinAccount.api({action:'class_ai',op:'usage',data:{class_id:selected||null,scope:$('scope').value,since:since.toISOString(),until:until.toISOString(),page}});
   if(rev!==revision)return;
   $('class').innerHTML='<option value="">全部班级及教师备课</option>'+r.classes.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');$('class').value=selected;
   const s=r.summary;page=r.page;
   $('summary').innerHTML=[['调用请求',s.calls],['成功回复',s.success],['失败',s.errors],['处理中 / 未确认',s.pending],['已知 Token',s.tokens]].map(([k,v])=>`<div>${k}<strong>${number(v)}</strong></div>`).join('');
   $('table').innerHTML=r.rows.length?`<table><thead><tr><th>使用者 / 学号</th><th>班级</th><th>请求</th><th>成功 / 失败 / 未确认</th><th>已知 Token</th><th>最近使用</th></tr></thead><tbody>${r.rows.map(v=>`<tr><td>${esc(v.student_name)}<br><small>${esc(v.student_no)}</small></td><td>${esc(v.class_name||'教师备课')}</td><td>${number(v.calls)}</td><td>${number(v.success)} / ${number(v.errors)} / ${number(v.pending)}</td><td>${number(v.tokens)}<br><small>${number(v.tokens_unknown)} 次用量未返回</small></td><td>${esc(new Date(v.last_used).toLocaleString())}</td></tr>`).join('')}</tbody></table>`:'<p>所选范围暂无平台 AI 使用记录。</p>';
   $('status').textContent=`已同步 · ${number(s.tokens_unknown)} 次请求尚无 Token 数据。`; $('page').textContent=`共 ${r.total} 名班级使用者 · 第 ${page} / ${Math.max(1,Math.ceil(r.total/20))} 页`;
   lock(false);$('prev').disabled=page<=1;$('next').disabled=page*20>=r.total;
  }catch(e){if(rev===revision){$('status').textContent='读取失败：'+e.message+' 已显示的数据不会更新为零。';lock(false);$('prev').disabled=true;$('next').disabled=true;}}
 }
 $('form').onsubmit=e=>{e.preventDefault();page=1;load();};$('prev').onclick=()=>{page--;load();};$('next').onclick=()=>{page++;load();};
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{revision++;lock(false);document.body.style.overflow=dialog.dataset.previousOverflow||'';});
 function open(){if(dialog.open)return;page=1;dialog.dataset.previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.showModal();load();}
 const entry=document.createElement('button');entry.type='button';entry.id='ai-usage-open';entry.className='nav-btn';entry.textContent='AI 使用量';entry.onclick=open;
 const nav=document.querySelector('nav.nav');
 if(nav)nav.append(entry);window.MatinAIUsage={open};
})();
