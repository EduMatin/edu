/* Class roster import: parse locally, preview on the server, then commit an unchanged preview. */
(() => {
 'use strict';
 const columns=['姓名','学号','邮箱','电话'],fields=['display_name','student_no','email','phone'];
 function parse(text,allowHeaderless=false){
  text=String(text).replace(/^\uFEFF/,'');
  if(text.length>500000)throw Error('内容过大，请按每批最多200名学生拆分。');
  const first=text.split(/\r?\n/,1)[0],sep=first.includes('\t')?'\t':',';
  const grid=[];let row=[],cell='',quoted=false,closed=false;
  const finishCell=()=>{row.push(cell.trim());cell='';closed=false;};
  const finishRow=()=>{finishCell();if(row.some(v=>v!==''))grid.push(row);row=[];};
  for(let i=0;i<text.length;i++){
   const c=text[i];
   if(quoted){
    if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}
    else cell+=c;
   }else if(c===sep)finishCell();
   else if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;finishRow();}
   else if(c==='"'&&cell===''&&!closed)quoted=true;
   else if(closed&&!/\s/.test(c))throw Error('CSV 引号格式有误，请重新导出为 CSV UTF-8。');
   else if(c==='"')throw Error('CSV 引号格式有误，请重新导出为 CSV UTF-8。');
   else cell+=c;
  }
  if(quoted)throw Error('CSV 中存在未闭合的引号。');
  finishRow();
  if(!grid.length)throw Error('请上传名单或粘贴包含表头的数据。');
  const hasHeader=grid[0].length===4&&columns.every(x=>grid[0].includes(x));
  if(!hasHeader&&(!allowHeaderless||grid[0].some(x=>columns.includes(x))))throw Error('表头须包含且仅包含：姓名、学号、邮箱、电话。');
  const header=hasHeader?grid.shift():columns;
  if(!grid.length||grid.length>200)throw Error('每次请导入1至200名学生。');
  return grid.map((r,i)=>{
   if(r.length!==4)throw Error('第'+(i+(hasHeader?2:1))+'行不是四列，请同时复制姓名、学号、邮箱、电话四列（电话可为空）。');
   const out={};columns.forEach((name,n)=>out[fields[n]]=r[header.indexOf(name)]);
   out.email=out.email.toLowerCase();return out;
  });
 }
 let root=null,active=null,sequence=0;
 const $=id=>document.getElementById(id);
 const blank=()=>Object.fromEntries(fields.map(k=>[k,'']));
 const filled=row=>fields.some(k=>row[k].trim()!=='');
 function status(message,tone='info'){
  $('roster-import-status').textContent=message;$('roster-import-status').dataset.tone=tone;
 }
 function build(){
  if(root)return;
  root=document.createElement('div');root.id='roster-import-modal';root.className='modal-layer hidden';
  root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','roster-import-title');
  root.innerHTML=`<div class="modal roster-shell">
   <header class="roster-header"><div><div class="roster-kicker">学生名单</div><h2 id="roster-import-title">批量导入学生</h2></div><button type="button" class="btn" id="roster-import-close">关闭</button></header>
   <div class="roster-body">
    <p class="roster-notice">导入即确认入班。学生验证名单中的邮箱并登录后自动加入；已登录学生可刷新“我的班级”。</p>
    <div class="roster-toolbar"><div class="roster-actions">
     <button type="button" class="btn soft" id="roster-paste-open" aria-expanded="false" aria-controls="roster-paste-panel">粘贴 Excel 名单</button>
     <button type="button" class="btn" id="roster-file-open">上传 CSV 文件</button>
     <button type="button" class="btn flat" id="roster-template">下载模板</button>
     <input id="roster-file" class="hidden" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" aria-label="选择学生名单文件">
    </div><span id="roster-source" class="roster-muted"></span></div>
    <section id="roster-paste-panel" class="hidden">
     <label for="roster-text">从 Excel 复制四列后粘贴</label>
     <p class="roster-muted" id="roster-paste-help">按“姓名、学号、邮箱、电话”的顺序复制，可含表头；电话为空也请复制该列。</p>
     <textarea id="roster-text" rows="4" spellcheck="false" aria-describedby="roster-paste-help" placeholder="在这里按 Ctrl+V 粘贴，点击“填入表格”后可逐项修改"></textarea>
     <div class="roster-actions"><button type="button" class="btn soft" id="roster-paste-apply">填入表格</button><button type="button" class="btn flat" id="roster-paste-cancel">取消粘贴</button></div>
    </section>
    <div class="roster-list-heading"><div><h3>填写学生信息</h3><p class="roster-muted">每行一名学生，空白行会自动忽略。姓名、学号、邮箱必填，电话选填。</p></div><span id="roster-count"></span></div>
    <div class="roster-table">
     <div class="roster-columns" aria-hidden="true"><span>序号</span><span>姓名 <b>*</b></span><span>学号 <b>*</b></span><span>邮箱 <b>*</b></span><span>电话 <small>选填</small></span><span>操作</span></div>
     <div id="roster-rows"></div>
    </div>
    <div class="roster-row-tools"><button type="button" class="btn" id="roster-add">＋ 添加一名学生</button><button type="button" class="btn flat" id="roster-clear">清空名单</button><span class="roster-muted">每批最多200人 · 学号和电话保留原文本</span></div>
   </div>
   <footer class="roster-footer"><div><p id="roster-import-status" role="status" aria-live="polite"></p><p class="roster-muted">先检查名单，再确认导入。不会创建密码或发送邀请邮件。</p></div><div class="roster-actions"><button type="button" class="btn" id="roster-preview">检查并预览</button><button type="button" class="btn primary" id="roster-commit" disabled>确认导入</button></div></footer>
   </div>`;
  document.body.append(root);
  const style=document.createElement('style');
  style.textContent=`
   #roster-import-modal{z-index:140}
   #roster-import-modal .roster-shell{width:min(1120px,100%);max-height:92vh;padding:0;overflow:hidden;display:flex;flex-direction:column}
   #roster-import-modal .roster-header{padding:24px 28px 18px;display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid #edf0f7}
   #roster-import-modal .roster-kicker{color:#777bc0;font-size:12px;font-weight:700;margin-bottom:6px}
   #roster-import-modal h2{font-size:22px;overflow-wrap:anywhere}
   #roster-import-modal h3{font-size:16px}
   #roster-import-modal .roster-body{padding:20px 28px;overflow:auto;min-height:0;overscroll-behavior:contain}
   #roster-import-modal p{line-height:1.65}
   #roster-import-modal .roster-muted{font-size:12px;color:#6b7890;line-height:1.65}
   #roster-import-modal .roster-notice{padding:12px 16px;background:#f2f4ff;color:#52628b;border-radius:12px;font-size:13px}
   #roster-import-modal .roster-toolbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:18px 0 22px}
   #roster-import-modal .roster-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
   #roster-source{overflow-wrap:anywhere;min-width:0}
   #roster-paste-panel{border:1px solid #d9e0fa;background:#f8f9ff;padding:16px;border-radius:12px;margin-bottom:20px}
   #roster-paste-panel>label{display:block;font-weight:700;margin-bottom:4px}
   #roster-text{display:block;width:100%;padding:12px;border:1px solid #cbd4e6;border-radius:9px;resize:vertical;font-family:inherit;font-size:14px;line-height:1.6;margin:12px 0;background:white}
   #roster-import-modal .roster-list-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
   #roster-import-modal .roster-list-heading p{margin-top:4px}
   #roster-count{flex-shrink:0;padding:5px 10px;border-radius:8px;background:#eeefff;color:#595dc2;font-size:12px;font-weight:700}
   #roster-import-modal .roster-table{border:1px solid #e0e5f0;border-radius:12px;overflow:hidden}
   #roster-import-modal .roster-columns,#roster-import-modal .roster-row{display:grid;grid-template-columns:36px minmax(85px,1fr) minmax(105px,1.05fr) minmax(175px,1.8fr) minmax(120px,1.2fr) 40px;column-gap:10px;padding:12px;align-items:center}
   #roster-import-modal .roster-columns{background:#f6f8fc;color:#52617b;font-size:12px;font-weight:700}
   #roster-import-modal .roster-columns b{color:#bb4056}
   #roster-import-modal .roster-columns small{font-weight:400;color:#8490a5}
   #roster-import-modal .roster-row{border-top:1px solid #edf0f6}
   #roster-import-modal .roster-row:nth-child(even){background:#fcfcff}
   #roster-import-modal .roster-row[data-state=error]{background:#fff7f6}
   #roster-import-modal .roster-row label{min-width:0}
   #roster-import-modal .roster-row label>span{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
   #roster-import-modal .roster-row input{width:100%;min-width:0;height:44px;border:1px solid #dce2ee;border-radius:8px;padding:10px;background:#fff;color:#263751;font-size:14px}
   #roster-import-modal .roster-row input::placeholder{color:#929cb0}
   #roster-import-modal .roster-row input:focus{outline:0;border-color:#6b70e7;box-shadow:0 0 0 3px #6b70e719}
   #roster-import-modal .roster-row input[aria-invalid=true]{border-color:#d66666}
   #roster-import-modal .roster-row-number{color:#8390a7;font-size:12px;text-align:center}
   #roster-import-modal .roster-remove{width:36px;height:36px;border:0;border-radius:8px;background:transparent;color:#8490a5;font-size:22px}
   #roster-import-modal .roster-remove:hover{background:#ffeded;color:#bb4056}
   #roster-import-modal .roster-result{grid-column:2/-2;margin-top:7px;font-size:12px;color:#238369;overflow-wrap:anywhere}
   #roster-import-modal .roster-result:empty{display:none}
   #roster-import-modal .roster-row[data-state=error] .roster-result{color:#b33a3a}
   #roster-import-modal .roster-row-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px}
   #roster-import-modal .roster-row-tools>span{margin-left:auto}
   #roster-import-modal .roster-footer{flex-shrink:0;padding:18px 28px;border-top:1px solid #e7ebf3;background:#fafbff;display:flex;align-items:center;justify-content:space-between;gap:18px}
   #roster-import-modal .roster-footer>div:first-child{min-width:0}
   #roster-import-modal .roster-footer .roster-actions{flex-shrink:0}
   #roster-import-status{color:#4d5f82;line-height:1.6;font-size:13px;margin-bottom:4px;overflow-wrap:anywhere}
   #roster-import-status[data-tone=error]{color:#b33a3a}
   #roster-import-status[data-tone=success]{color:#18785e}
   #roster-import-modal :disabled{opacity:.55;cursor:not-allowed}
   @media(max-width:800px){
    #roster-import-modal{padding:12px}
    #roster-import-modal .roster-shell{max-height:94vh}
    #roster-import-modal .roster-header{padding:18px}
    #roster-import-modal h2{font-size:18px}
    #roster-import-modal .roster-body{padding:16px}
    #roster-import-modal .roster-columns{display:none}
    #roster-import-modal .roster-table{border:0;overflow:visible}
    #roster-import-modal .roster-row{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:14px;border:1px solid #e0e5f0;border-radius:12px;margin-bottom:12px;position:relative}
    #roster-import-modal .roster-row-number{grid-column:1/-1;text-align:left;font-weight:700}
    #roster-import-modal .roster-row-number::before{content:'学生 '}
    #roster-import-modal .roster-row label>span{position:static;width:auto;height:auto;clip-path:none;display:block;font-size:12px;font-weight:600;color:#596780;margin-bottom:6px}
    #roster-import-modal .roster-row label[data-field=email],#roster-import-modal .roster-row label[data-field=phone]{grid-column:1/-1}
    #roster-import-modal .roster-row input{font-size:16px}
    #roster-import-modal .roster-remove{position:absolute;top:4px;right:8px}
    #roster-import-modal .roster-result{grid-column:1/-1;margin:0}
    #roster-import-modal .roster-list-heading{align-items:flex-start;flex-wrap:wrap}
    #roster-import-modal .roster-row-tools>span{margin-left:0;width:100%}
    #roster-import-modal .roster-footer{padding:12px 16px;flex-direction:column;align-items:stretch;gap:10px}
    #roster-import-modal .roster-footer .btn{flex:1}
    #roster-import-modal .roster-footer .roster-muted{display:none}
   }`;
  document.head.append(style);
  $('roster-add').onclick=()=>{
   if(!active||active.busy||active.entries.length>=200)return;
   active.entries.push(blank());renderRows();invalidate('已添加空白行，请填写学生信息。');
   $('roster-rows').lastElementChild.querySelector('input').focus();
  };
  $('roster-clear').onclick=()=>{
   if(active.entries.some(filled)&&!confirm('清空表格中尚未导入的名单？已导入的班级成员不受影响。'))return;
   active.entries=[blank(),blank(),blank()];resetPaste();$('roster-source').textContent='';renderRows();invalidate('名单已清空。');
  };
  $('roster-paste-open').onclick=()=>{
   if(!$('roster-paste-panel').classList.contains('hidden'))return cancelPaste();
   $('roster-paste-panel').classList.remove('hidden');$('roster-paste-open').setAttribute('aria-expanded','true');$('roster-text').focus();
  };
  $('roster-paste-cancel').onclick=cancelPaste;
  $('roster-text').oninput=()=>invalidate('请先点击“填入表格”，再检查名单。');
  $('roster-paste-apply').onclick=()=>{
   try{applyIncoming(parse($('roster-text').value,true),'来自 Excel 粘贴');}
   catch(e){status(e.message,'error');}
  };
  $('roster-file-open').onclick=()=>$('roster-file').click();
  $('roster-file').onchange=async()=>{
   const ctx=active,file=$('roster-file').files[0],version=++sequence;if(!file||!ctx)return;
   invalidate('正在读取文件…');ctx.busy=true;controls();
   try{
    if(file.size>500000)throw Error('文件过大，请按每批最多200名学生拆分。');
    if(!/\.(csv|tsv)$/i.test(file.name))throw Error('请选择 CSV UTF-8 文件，或从 Excel 直接复制粘贴。');
    const text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());
    if(active!==ctx||sequence!==version)return;
    applyIncoming(parse(text),'已读取：'+file.name);
   }catch(e){if(active===ctx)status((e instanceof TypeError?'文件编码不正确，请在 Excel 中另存为 CSV UTF-8。':e.message)+' 表格中的原有内容已保留。','error');}
   finally{if(active===ctx){$('roster-file').value='';ctx.busy=false;controls();}}
  };
  $('roster-template').onclick=()=>{
   const url=URL.createObjectURL(new Blob(['\uFEFF'+columns.join(',')+'\r\n'],{type:'text/csv;charset=utf-8'}));
   const link=document.createElement('a');link.href=url;link.download='学生名单导入模板.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  $('roster-preview').onclick=()=>run(false,async ctx=>{
   invalidate('正在检查…');
   const indices=[];ctx.entries.forEach((row,i)=>{if(filled(row))indices.push(i);});
   if(!indices.length)throw Error('请先填写至少一名学生的信息。');
   const rows=indices.map(i=>Object.fromEntries(fields.map(k=>[k,k==='email'?ctx.entries[i][k].trim().toLowerCase():ctx.entries[i][k].trim()])));
   const d=await ctx.api('import_preview',{rows});if(active!==ctx)return;
   if(!Array.isArray(d.rows)||d.rows.length!==rows.length||typeof d.preview_token!=='string')throw Error('导入服务尚未更新，请先完成数据库和函数升级。');
   ctx.rows=rows;ctx.preview=d;renderResults(d.rows,indices);
   status(`共 ${rows.length} 人：新增 ${d.new_count}，更新 ${d.update_count}，错误 ${d.error_count}。`+(d.can_import?'核对后可确认导入。':'请修改标红行后重新检查，本次尚未导入。'),d.can_import?'success':'error');
  });
  $('roster-commit').onclick=()=>run(true,async ctx=>{
   if(!ctx.preview?.can_import)throw Error('请先检查并预览有效名单。');
   const data={rows:ctx.rows,preview_token:ctx.preview.preview_token};
   // A failed/uncertain write requires another preview instead of retrying a stale batch.
   ctx.preview=null;
   const d=await ctx.api('import_commit',data);if(active!==ctx)return;
   ctx.rows=null;ctx.entries=[blank(),blank(),blank()];resetPaste();$('roster-source').textContent='';renderRows();
   const message=`已导入 ${d.imported_count} 名学生的信息。学生验证邮箱并登录后自动加入班级。`;
   try{await ctx.onSaved();status(message,'success');}
   catch{status(message+' 成员列表刷新失败，关闭后请点击“刷新名单”。','success');}
  });
  $('roster-import-close').onclick=close;
  // Disabled inputs can move focus to body; keep dismissal and Tab inside the top dialog.
  document.addEventListener('keydown',e=>{
   if(!active)return;
   if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}
   if(e.key==='Tab'){
    const items=[...root.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled)')].filter(x=>x.getClientRects().length);
    if(!root.contains(document.activeElement)){e.preventDefault();(e.shiftKey?items.at(-1):items[0])?.focus();}
    else if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1)?.focus();}
    else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0]?.focus();}
   }
  },true);
 }
 function resetPaste(){
  $('roster-text').value='';$('roster-file').value='';
  $('roster-paste-panel').classList.add('hidden');$('roster-paste-open').setAttribute('aria-expanded','false');
 }
 function cancelPaste(){resetPaste();invalidate('已取消粘贴，表格内容已保留。');$('roster-paste-open').focus();}
 function applyIncoming(rows,source){
  if(active.entries.some(filled)&&!confirm('用这份名单替换表格中尚未导入的内容？已导入的班级成员不受影响。')){
   status('已保留原表格内容。');return;
  }
  active.entries=rows;resetPaste();$('roster-source').textContent=source;renderRows();
  invalidate(`已填入 ${rows.length} 名学生，可直接修改表格，然后点击“检查并预览”。`);
  $('roster-rows').querySelector('input')?.focus();
 }
 function renderRows(){
  const box=$('roster-rows');box.replaceChildren();
  active.entries.forEach((row,i)=>{
   const section=document.createElement('div');section.className='roster-row';section.dataset.index=i;
   const number=document.createElement('span');number.className='roster-row-number';number.textContent=String(i+1).padStart(2,'0');section.append(number);
   fields.forEach((key,n)=>{
    const label=document.createElement('label'),caption=document.createElement('span'),input=document.createElement('input');
    label.dataset.field=key;caption.textContent=columns[n]+(key==='phone'?'（选填）':' *');
    input.value=row[key];input.dataset.field=key;input.type=key==='email'?'email':key==='phone'?'tel':'text';
    input.setAttribute('aria-label',`第 ${i+1} 行${columns[n]}`);input.setAttribute('aria-describedby','roster-result-'+i);
    if(key!=='phone')input.setAttribute('aria-required','true');
    input.autocomplete='off';input.spellcheck=false;input.placeholder=['如：张三','如：20260001','学生本人邮箱','选填'][n];
    input.oninput=()=>{if(!active||active.busy)return;active.entries[i][key]=input.value;invalidate('名单已修改，请重新检查并预览。');};
    input.addEventListener('paste',e=>{
     const text=e.clipboardData?.getData('text/plain')||'';
     if(active?.busy||(!text.includes('\t')&&!(/[\r\n]/.test(text)&&text.includes(','))))return;
     e.preventDefault();try{applyIncoming(parse(text,true),'来自 Excel 粘贴');}catch(err){status(err.message,'error');}
    });
    label.append(caption,input);section.append(label);
   });
   const remove=document.createElement('button');remove.type='button';remove.className='roster-remove';remove.textContent='×';
   remove.title='删除这一行';remove.setAttribute('aria-label',`删除第 ${i+1} 行`);
   remove.onclick=()=>{
    if(!active||active.busy)return;active.entries.splice(i,1);if(!active.entries.length)active.entries.push(blank());
    renderRows();invalidate('已删除该行，请重新检查名单。');
    $('roster-rows').children[Math.min(i,active.entries.length-1)].querySelector('input').focus();
   };
   const result=document.createElement('p');result.className='roster-result';result.id='roster-result-'+i;section.append(remove,result);box.append(section);
  });
  controls();
 }
 function renderResults(rows,indices){
  rows.forEach((row,n)=>{
   const section=$('roster-rows').children[indices[n]],error=row.status==='error';section.dataset.state=row.status;
   section.querySelector('.roster-result').textContent=error?'需修改：'+row.message:row.status==='update'?'✓ 将更新已有名单资料':'✓ 将新增学生';
   if(error){
    const targets=fields.filter((_,i)=>row.message.includes(columns[i]));
    section.querySelectorAll('input').forEach(input=>{if(!targets.length||targets.includes(input.dataset.field))input.setAttribute('aria-invalid','true');});
   }
  });
 }
 function controls(){
  if(!active)return;
  const count=active.entries.filter(filled).length,pastePending=$('roster-text').value.trim()!=='';
  root.querySelectorAll('button,input,textarea').forEach(x=>x.disabled=active.busy);
  $('roster-import-close').disabled=active.writing;
  $('roster-add').disabled=active.busy||active.entries.length>=200;
  $('roster-clear').disabled=active.busy||!count;
  $('roster-paste-apply').disabled=active.busy||!pastePending;
  $('roster-preview').disabled=active.busy||!count||pastePending;
  $('roster-commit').disabled=active.busy||!active.preview?.can_import||pastePending;
  $('roster-count').textContent=`已填写 ${count} / 200 人`;
 }
 function invalidate(message){
  if(!active)return;active.preview=null;active.rows=null;
  root.querySelectorAll('.roster-row').forEach(row=>{delete row.dataset.state;row.querySelector('.roster-result').textContent='';});
  root.querySelectorAll('[aria-invalid]').forEach(input=>input.removeAttribute('aria-invalid'));
  status(message);controls();
 }
 async function run(writing,fn){
  const ctx=active;if(!ctx||ctx.busy)return;
  ctx.busy=true;ctx.writing=writing;controls();status(writing?'正在导入…':'正在检查…');
  try{await fn(ctx);}
  catch(e){if(active===ctx)status(e.message+(writing?' 请重新预览核对名单后再操作。':''),'error');}
  finally{if(active===ctx){ctx.busy=false;ctx.writing=false;controls();}}
 }
 function close(){
  if(!active||active.writing)return;
  const opener=active.opener;active=null;sequence++;root.classList.add('hidden');resetPaste();$('roster-rows').replaceChildren();opener?.focus();
 }
 window.MatinRosterImport={parse,open(row,api,onSaved){
  if(active?.writing)return;build();sequence++;
  active={row:{id:row.id,name:row.name},api,onSaved,busy:false,writing:false,rows:null,preview:null,entries:[blank(),blank(),blank()],opener:document.activeElement};
  $('roster-import-title').textContent=row.name+' · 批量导入学生';resetPaste();$('roster-source').textContent='';
  renderRows();invalidate('可直接逐行填写，也可粘贴 Excel 或上传 CSV 名单。');root.classList.remove('hidden');
  root.querySelector('.roster-body').scrollTop=0;$('roster-rows').querySelector('input').focus();
 }};
})();
