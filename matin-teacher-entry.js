/* Editable teacher invitation queue. Import stays local until explicit confirmation. */
(() => {
 'use strict';
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const MAX=200;
 function mount(open,api){
  const dialog=el('dialog',undefined,'teacher-entry');dialog.id='teacher-admin-dialog';dialog.setAttribute('aria-label','教师管理');document.body.append(dialog);
  const head=el('header'),close=button('关闭',()=>dialog.close());head.append(el('h2','教师管理'),close);
  const intro=el('p','逐条填写教师信息，或从 Excel 批量导入。核对名单后发送邀请，老师通过邮件设置密码。','te-muted');
  const scope=el('p','平台管理员可管理教师账号；课程、班级和报告仍按各教师账号独立保存。','te-muted');
  const stats=el('div',undefined,'te-stats');stats.setAttribute('aria-label','教师账号统计');stats.setAttribute('aria-live','polite');stats.textContent='正在加载教师统计…';
  const statsHelp=el('p','总数包含管理员；待激活包含过期邀请，已停用包含已取消的邀请。','te-muted');
  const toolbar=el('div',undefined,'te-toolbar');
  const add=button('新增一行',()=>{if(rows.length>=MAX){status.textContent='每份名单最多200位，请分开录入。';return;}rows.push({email:'',name:'',department:''});render();queue.lastElementChild.querySelector('input').focus();});
  const template=button('下载 Excel 模板',()=>{try{const wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet([['邮箱','姓名','专业']]);ws['!cols']=[{wch:36},{wch:18},{wch:24}];XLSX.utils.book_append_sheet(wb,ws,'教师名单');XLSX.writeFile(wb,'教师录入模板.xlsx');}catch{status.textContent='模板生成失败，请刷新页面后重试。';}});
  const picker=el('input');picker.type='file';picker.accept='.xlsx,.xls';picker.setAttribute('aria-label','导入 Excel 教师名单');const pickLabel=el('label','导入 Excel');pickLabel.append(picker);
  const clear=button('清空录入名单',()=>{if(rows.some(hasData)&&!confirm('清空当前录入名单？已发送的邀请不会撤销。'))return;rows=[{email:'',name:'',department:''}];render();status.textContent='录入名单已清空。';});
  toolbar.append(add,template,pickLabel,clear);
  const help=el('p','Excel 首行需包含“邮箱、姓名、专业”三列（顺序不限），只读取第一个工作表；最多200位、文件不超过5MB。邮箱必填，姓名和专业可选。现有学生账号需另用教师邮箱。','te-muted');
  const queue=el('div',undefined,'te-queue'),summary=el('p',undefined,'te-summary'),status=el('p',undefined,'te-status');status.setAttribute('role','status');
  const send=button('发送邀请（每批最多20位）',()=>run(sendBatch));send.classList.add('te-primary');
  const check=button('检查名单',()=>{validate();status.textContent='已检查，请查看每行结果；可以直接修改错误信息。';});
  const actions=el('div',undefined,'te-toolbar');actions.append(check,send);
  const listHead=el('div',undefined,'te-list-head'),refresh=button('刷新教师状态',()=>run(load));listHead.append(el('h3','已有教师'),refresh);
  const list=el('div',undefined,'te-directory');dialog.append(head,scope,stats,statsHelp,intro,toolbar,help,queue,summary,actions,status,listHead,list);
  let rows=[{email:'',name:'',department:''}],directory=[],busy=false,loaded=false;
  function button(text,fn){const b=el('button',text,'te-button');b.type='button';b.onclick=fn;return b;}
  function hasData(row){return ['email','name','department'].some(k=>row[k].trim());}
  function validate(){
   const counts=new Map();for(const r of rows)if(hasData(r)){const mail=r.email.trim().toLowerCase();counts.set(mail,(counts.get(mail)||0)+1);}
   let valid=0,invalid=0,sent=0;
   for(const r of rows){r.error='';const mail=r.email.trim().toLowerCase();
    if(r.sent){sent++;}else if(hasData(r)){
     if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail))r.error='请填写正确的邮箱';
     else if(r.name.trim().length>80||r.department.trim().length>120)r.error='姓名最多80字，专业最多120字';
     else if(counts.get(mail)>1)r.error='邮箱重复，请删除或修改重复行';
     else if(!r.failed&&directory.some(x=>x.email.toLowerCase()===mail))r.error='已在教师目录中，请使用下方已有教师的操作';
     if(r.error)invalid++;else valid++;
    }
    if(r.feedback){r.feedback.textContent=r.sent?'邮件服务已接受请求，等待教师激活':r.error||r.failed|| (hasData(r)?'待发送':'待填写');r.feedback.className='te-row-status'+(r.error||r.failed?' te-error':r.sent?' te-success':'');}
   }
   summary.textContent=`待发送 ${valid} 位 · 需修改 ${invalid} 位 · 已发送 ${sent} 位`;
   return {valid,invalid};
  }
  function render(){queue.replaceChildren();rows.forEach((r,i)=>{
   const item=el('div',undefined,'te-row');item.append(el('strong',String(i+1),'te-number'));
   for(const [key,title] of [['email','邮箱'],['name','姓名'],['department','专业']]){const label=el('label',title+(key==='email'?' *':'')),input=el('input');input.value=r[key];input.type=key==='email'?'email':'text';input.autocomplete='off';input.setAttribute('aria-label',`第${i+1}位教师${title}`);input.disabled=!!r.sent;input.placeholder=key==='email'?'teacher@example.com':key==='name'?'如：张老师':'如：工程光学';input.oninput=()=>{r[key]=input.value;r.failed='';status.textContent='';validate();};label.append(input);item.append(label);}
   item.append(button('移除',()=>{rows.splice(i,1);render();}));r.feedback=el('p');r.feedback.setAttribute('aria-live','polite');item.append(r.feedback);queue.append(item);
  });validate();}
  function lock(){dialog.querySelectorAll('button,input').forEach(n=>n.disabled=busy);rows.filter(r=>r.sent).forEach(r=>r.feedback.closest('.te-row').querySelectorAll('input').forEach(n=>n.disabled=true));}
  async function run(fn){if(busy)return;busy=true;lock();try{await fn();}catch(e){status.textContent=e.message||'操作失败，请重试。';}finally{busy=false;lock();}}
  dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  async function load(){let result;try{result=await api('list');}catch(e){stats.textContent='教师统计刷新失败，请重试。';throw e;}directory=result.rows||[];loaded=true;list.replaceChildren();stats.replaceChildren();
   for(const [title,state]of [['教师总数',null],['已激活','active'],['待激活','pending'],['已停用','disabled']]){const card=el('div',undefined,'te-stat');card.append(el('span',title),el('strong',String(state?directory.filter(r=>r.state===state).length:directory.length)));stats.append(card);}
   if(!directory.length)list.append(el('p','暂无教师。'));
   for(const r of directory){const item=el('div',undefined,'te-person'),info=el('div');const expired=r.state==='pending'&&Date.parse(r.expires_at)<Date.now();info.append(el('strong',(r.display_name||'未填写姓名')+' · '+r.email),el('p',(r.department||'未填写专业')+' · '+(expired?'邀请已过期':{pending:'待激活',active:'已激活',disabled:'已停用 / 邀请已取消'}[r.state])));item.append(info);
    function action(label,op){item.append(button(label,()=>run(async()=>{if(!confirm(label+'：'+r.email+'？'))return;const result=await api(op,{email:r.email,name:r.display_name,department:r.department});status.textContent=result.message||'操作完成。';await load();})));}
    if(r.user_id&&r.user_id===window.MatinAccount?.userId){item.append(el('span','平台管理员 · 当前账号','te-admin-tag'));}
    else{if(r.state==='pending'||(r.state==='disabled'&&!r.user_id))action('重新邀请','invite');if(r.state!=='disabled')action(r.state==='pending'?'取消邀请':'停用','disable');else if(r.user_id)action('恢复使用','enable');}list.append(item);
   }validate();
  }
  async function sendBatch(){if(!loaded)await load();const {valid,invalid}=validate();if(invalid)throw Error('请先修改或移除标红的记录，再发送邀请。');if(!valid)throw Error('请先填写或导入教师名单。');
   const batch=rows.filter(r=>!r.sent&&hasData(r)&&!r.error).slice(0,20);
   if(!confirm(`本次向以下${batch.length}位教师发送邀请邮件（共${valid}位待发送）：\n`+batch.map(r=>r.email.trim()).join('\n')))return;
   let ok=0,fail=0;for(const r of batch){try{await api('invite',{email:r.email.trim().toLowerCase(),name:r.name.trim(),department:r.department.trim()});r.sent=true;r.failed='';ok++;}catch(e){r.failed='发送未完成：'+e.message+'（请等待至少60秒后重试）';fail++;}validate();status.textContent=`本批已处理 ${ok+fail}/${batch.length} 位，成功 ${ok} 位，失败 ${fail} 位。`;}
   status.textContent+= ' 已成功的记录不会重复发送；剩余名单请继续发送。发送成功不代表邮件已送达。';
   try{await load();}catch(e){status.textContent+=' 教师目录刷新失败：'+e.message;}
  }
  picker.onchange=()=>{const file=picker.files[0];if(!file)return;run(async()=>{
   try{if(!/\.(xlsx|xls)$/i.test(file.name)||file.size>5*1024*1024)throw Error('请选择不超过5MB的 .xlsx 或 .xls 文件。');
    const wb=XLSX.read(await file.arrayBuffer(),{type:'array',sheetRows:202,cellFormula:true});const sheet=wb.Sheets[wb.SheetNames[0]];if(!sheet||!sheet['!ref'])throw Error('第一个工作表为空。');
    const range=XLSX.utils.decode_range(sheet['!fullref']||sheet['!ref']);if(range.e.r>200||range.e.c>49)throw Error('工作表最多200条数据、50列，请使用模板整理后导入。');
    const data=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false,blankrows:true}),header=data[0].map(v=>String(v).trim());
    const cols=['邮箱','姓名','专业'].map(k=>{if(header.filter(x=>x===k).length!==1)throw Error('首行必须包含且只包含一列“'+k+'”，请使用模板。');return header.indexOf(k);});
    for(const address of Object.keys(sheet))if(!address.startsWith('!')&&sheet[address]?.f)throw Error('名单包含公式，请粘贴为纯文本值后导入。');
    const imported=data.slice(1).map(c=>({email:String(c[cols[0]]||'').trim(),name:String(c[cols[1]]||'').trim(),department:String(c[cols[2]]||'').trim()})).filter(hasData);
    if(!imported.length)throw Error('没有找到教师信息，请在模板第二行开始填写。');
    const previous=rows.filter(hasData);if(previous.length+imported.length>MAX)throw Error('加上现有录入名单超过200位，请分开导入。');
    rows=previous.concat(imported);render();lock();status.textContent=`已导入 ${imported.length} 位教师（工作表：${wb.SheetNames[0]}）。尚未发送邀请，请核对每行信息。`;
   }catch(e){throw Error('导入失败：'+(e.message||'文件无法读取，请使用模板。'));}finally{picker.value='';}
  });};
  open.onclick=()=>{dialog.showModal();run(load);};render();
 }
 window.MatinTeacherEntry={mount};
})();
