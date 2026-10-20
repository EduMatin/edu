/* Class roster import: parse locally, preview on the server, then commit an unchanged preview. */
(() => {
 'use strict';
 const columns=['姓名','学号','邮箱','电话'],fields=['display_name','student_no','email','phone'];
 function parse(text){
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
  const header=grid.shift();
  if(header.length!==4||columns.some(x=>!header.includes(x)))throw Error('表头须包含且仅包含：姓名、学号、邮箱、电话。');
  if(!grid.length||grid.length>200)throw Error('每次请导入1至200名学生。');
  return grid.map((r,i)=>{
   if(r.length!==4)throw Error('第'+(i+2)+'行不是四列，请核对空白单元格或 CSV 分隔符。');
   const out={};columns.forEach((name,n)=>out[fields[n]]=r[header.indexOf(name)]);
   out.email=out.email.toLowerCase();return out;
  });
 }
 let root=null,active=null,sequence=0;
 const $=id=>document.getElementById(id);
 function build(){
  if(root)return;
  root=document.createElement('div');root.id='roster-import-modal';root.className='modal-layer hidden';
  root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','roster-import-title');
  root.innerHTML=`<div class="modal" style="width:96vw;max-width:1000px;max-height:90vh;overflow:auto">
   <div class="actions"><h2 id="roster-import-title">批量导入学生</h2><button type="button" class="btn" id="roster-import-close">关闭</button></div>
   <p>教师确认导入即确认入班。学生须用名单中的邮箱注册、验证邮箱并登录，系统会自动关联班级；已登录的学生可在“我的班级”刷新。不会创建密码或发送邀请邮件。</p>
   <p>姓名、学号、邮箱必填，电话可留空。每批最多200人。学号和电话请在 Excel 中设为文本，保留前导零。</p>
   <div class="actions"><button type="button" class="btn" id="roster-template">下载 CSV 表头模板</button>
   <label class="btn" style="display:block;max-width:100%;min-width:0;white-space:normal">选择 CSV 文件<input id="roster-file" style="width:100%;min-width:0" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values"></label></div>
   <label for="roster-text">或从 Excel 复制四列（含表头）粘贴到这里</label>
   <textarea id="roster-text" rows="6" spellcheck="false" placeholder="姓名&#9;学号&#9;邮箱&#9;电话"></textarea>
   <div class="actions"><button type="button" class="btn" id="roster-preview">检查并预览</button><button type="button" class="btn primary" id="roster-commit" disabled>确认导入</button></div>
   <p id="roster-import-status" role="status"></p><div id="roster-preview-table"></div>
   </div>`;
  document.body.append(root);
  const style=document.createElement('style');style.textContent='#roster-import-modal{z-index:140}#roster-import-modal .actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:12px 0}#roster-import-modal h2{margin-right:auto}#roster-import-modal p{line-height:1.7}#roster-text{width:100%;padding:12px;border:1px solid #ccd5e7;border-radius:10px;resize:vertical}#roster-file{display:block;max-width:100%;margin-top:6px}#roster-preview-table{overflow:auto;max-height:350px}#roster-preview-table table{border-collapse:collapse;width:100%;font-size:14px}#roster-preview-table th,#roster-preview-table td{border:1px solid #dce3f1;padding:8px;text-align:left;overflow-wrap:anywhere;min-width:75px}#roster-preview-table tr[data-error=true]{background:#fff1f1}#roster-import-status{color:#765221}#roster-import-modal :disabled{opacity:.6;cursor:not-allowed}';document.head.append(style);
  $('roster-text').oninput=()=>invalidate('内容已改变，请重新检查并预览。');
  $('roster-file').onchange=async()=>{
   const ctx=active,file=$('roster-file').files[0],version=++sequence;if(!file)return;
   invalidate('正在读取文件…');ctx.busy=true;controls();
   try{
    if(file.size>500000)throw Error('文件过大，请按每批最多200名学生拆分。');
    if(!/\.(csv|tsv)$/i.test(file.name))throw Error('请选择 CSV UTF-8 文件，或从 Excel 直接复制粘贴。');
    const text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());
    if(active!==ctx||sequence!==version)return;
    $('roster-text').value=text;$('roster-import-status').textContent='文件已读取，请点击“检查并预览”。';
   }catch(e){if(active===ctx)$('roster-import-status').textContent=e instanceof TypeError?'文件编码不正确，请在 Excel 中另存为 CSV UTF-8。':e.message;}
   finally{if(active===ctx){ctx.busy=false;controls();}}
  };
  $('roster-template').onclick=()=>{
   const url=URL.createObjectURL(new Blob(['\uFEFF'+columns.join(',')+'\r\n'],{type:'text/csv;charset=utf-8'}));
   const link=document.createElement('a');link.href=url;link.download='学生名单导入模板.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  $('roster-preview').onclick=()=>run(false,async ctx=>{
   ctx.preview=null;ctx.rows=null;renderPreview([]);
   const rows=parse($('roster-text').value),d=await ctx.api('import_preview',{rows});
   if(active!==ctx)return;
   if(!Array.isArray(d.rows)||typeof d.preview_token!=='string')throw Error('导入服务尚未更新，请先完成数据库和函数升级。');
   ctx.rows=rows;ctx.preview=d;renderPreview(d.rows);
   return `共 ${rows.length} 人：新增 ${d.new_count}，更新 ${d.update_count}，错误 ${d.error_count}。`+(d.can_import?'核对班级和名单后，可确认导入。':'请修正错误后重新预览；本次尚未保存任何名单。');
  });
  $('roster-commit').onclick=()=>run(true,async ctx=>{
   if(!ctx.preview?.can_import)throw Error('请先检查并预览有效名单。');
   const data={rows:ctx.rows,preview_token:ctx.preview.preview_token};
   // A failed/uncertain write requires another preview instead of retrying a stale batch.
   ctx.preview=null;
   const d=await ctx.api('import_commit',data);if(active!==ctx)return;
   ctx.rows=null;$('roster-text').value='';$('roster-file').value='';renderPreview([]);
   const message=`已导入 ${d.imported_count} 名学生的信息。学生验证名单中的邮箱并登录后自动加入班级。`;
   try{await ctx.onSaved();}catch{return message+' 成员列表刷新失败，关闭后请点击“刷新名单”。';}
   return message;
  });
  $('roster-import-close').onclick=close;
  // Disabling a focused form control can move focus to the document body.
  // Keep keyboard dismissal/trapping active while this topmost dialog is open.
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
 function controls(){
  if(!active)return;
  root.querySelectorAll('button,input,textarea').forEach(x=>x.disabled=active.busy);
  $('roster-import-close').disabled=active.writing;
  $('roster-commit').disabled=active.busy||!active.preview?.can_import;
 }
 function invalidate(message){
  if(!active)return;active.preview=null;active.rows=null;renderPreview([]);
  $('roster-import-status').textContent=message;controls();
 }
 async function run(writing,fn){
  const ctx=active;if(!ctx||ctx.busy)return;
  ctx.busy=true;ctx.writing=writing;controls();$('roster-import-status').textContent=writing?'正在导入…':'正在检查…';
  try{const message=await fn(ctx);if(active===ctx)$('roster-import-status').textContent=message||'';}
  catch(e){if(active===ctx)$('roster-import-status').textContent=e.message+(writing?' 请重新预览核对名单后再操作。':'');}
  finally{if(active===ctx){ctx.busy=false;ctx.writing=false;controls();}}
 }
 function renderPreview(rows){
  const box=$('roster-preview-table');box.replaceChildren();if(!rows.length)return;
  const table=document.createElement('table'),head=document.createElement('thead'),tr=document.createElement('tr'),body=document.createElement('tbody');
  ['序号',...columns,'检查结果'].forEach(name=>{const th=document.createElement('th');th.textContent=name;tr.append(th);});head.append(tr);
  rows.forEach(row=>{
   const tr=document.createElement('tr');tr.dataset.error=String(row.status==='error');
   [row.row_number,...fields.map(k=>row[k]),row.status==='error'?row.message:row.status==='update'?'更新已有名单资料':'新增名单'].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});
   body.append(tr);
  });table.append(head,body);box.append(table);
 }
 function close(){
  if(!active||active.writing)return;
  const opener=active.opener;active=null;sequence++;root.classList.add('hidden');
  $('roster-text').value='';$('roster-file').value='';renderPreview([]);opener?.focus();
 }
 window.MatinRosterImport={parse,open(row,api,onSaved){
  if(active?.writing)return;build();sequence++;
  active={row:{id:row.id,name:row.name},api,onSaved,busy:false,writing:false,rows:null,preview:null,opener:document.activeElement};
  $('roster-import-title').textContent=row.name+' · 批量导入学生';$('roster-text').value='';$('roster-file').value='';
  invalidate('');root.classList.remove('hidden');$('roster-text').focus();
 }};
})();
