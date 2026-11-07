/* Deployment information only: no model calls, business RPCs or private records. */
(() => {
 'use strict';
 const release=window.MatinRelease;if(!release)return;
 const el=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
 const style=el('style');style.textContent=`
 .matin-version-entry{font:inherit;font-size:12px;padding:8px 12px;margin-top:8px;border:1px solid #b7c5e1;border-radius:10px;background:transparent;color:inherit;cursor:pointer;white-space:normal}
 #teacher-sidebar .matin-version-entry{color:#d8e2ff;border-color:#ffffff35;text-align:left}
 #matin-release-dialog{box-sizing:border-box;width:min(740px,calc(100vw - 24px));max-height:90dvh;padding:0;border:1px solid #dce3ef;border-radius:18px;color:#253858;background:#fff}
 #matin-release-dialog::backdrop{background:#14223b99}
 #matin-release-dialog header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 22px;border-bottom:1px solid #e3e9f3;position:sticky;top:0;background:white;z-index:1}
 #matin-release-dialog h2{font-size:20px;margin:0} #matin-release-dialog .release-body{padding:20px 22px;line-height:1.7}
 #matin-release-dialog button{padding:9px 14px;border:1px solid #cbd5e8;border-radius:9px;background:#f4f6ff;color:#263b67;cursor:pointer;font:inherit}
 #matin-release-dialog button:disabled{opacity:.6;cursor:wait} #matin-release-dialog .release-actions{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}
 #matin-release-dialog ul{padding-left:22px} #matin-release-dialog li{margin:8px 0;overflow-wrap:anywhere}
 #matin-release-dialog .release-note{color:#64748b;font-size:13px} #matin-release-dialog .release-fail{color:#a13924}
 `;document.head.append(style);
 const entry=el('button','版本 '+release.version+' · 部署检查');entry.type='button';entry.className='matin-version-entry';entry.id='matin-version-open';
 const host=document.querySelector('#teacher-sidebar .topright')||document.querySelector('.student-foot');if(!host)return;host.append(entry);
 const dialog=el('dialog');dialog.id='matin-release-dialog';dialog.setAttribute('aria-labelledby','matin-release-title');
 const header=el('header'),title=el('h2','版本与部署检查');title.id='matin-release-title';const close=el('button','关闭');close.type='button';header.append(title,close);
 const body=el('div');body.className='release-body';body.append(el('p','当前页面版本：'+release.version));
 const note=el('p','此检查核对发布文件、云函数版本、必要配置和数据库关键能力。不会调用AI或读取教学内容。');note.className='release-note';body.append(note);
 const actions=el('div');actions.className='release-actions';const check=el('button','开始检查'),download=el('button','下载检查结果');check.type=download.type='button';download.hidden=true;actions.append(check,download);body.append(actions);
 const status=el('p','尚未检查');status.setAttribute('role','status');const list=el('ul');body.append(status,list);
 const limit=el('p','通过只表示当前检查范围匹配，不代表真实登录、AI响应、文件上传下载和权限隔离已全部验收。网页校验读取服务器当前文件；更新后请刷新页面再检查。');limit.className='release-note';body.append(limit);dialog.append(header,body);document.body.append(dialog);
 let controller,run=0,report=[],overflow='';
 entry.onclick=()=>{overflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.showModal();};close.onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{run++;controller?.abort();check.disabled=false;document.body.style.overflow=overflow;entry.focus();});
 const json=async(url,options={})=>{const r=await fetch(url,{...options,cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(12000)])});if(!r.ok)throw Error('HTTP '+r.status);return r.json();};
 const add=(label,ok,detail,target=list)=>{report.push({label,ok,detail});const li=el('li',(ok?'通过 · ':'待处理 · ')+label+'：'+detail);if(!ok)li.className='release-fail';target.append(li);};
 async function cloud(name,id){
  const base=(window.MATIN_CLOUD?.supabaseUrl||'').replace(/\/+$/,'');
  if(!base){if(id===run)add(name,false,'当前为本机离线配置，无法检查云端；发布时保留线上 matin-config.js。');return;}
  let d;
  try{d=await json(base+'/functions/v1/'+name+'?action=deployment_check',{headers:window.MATIN_CLOUD.publishableKey?{apikey:window.MATIN_CLOUD.publishableKey}:{}});}
  catch(e){if(id===run)add(name,false,'无法取得检查接口（'+e.message+'）。请检查网络、来源设置或是否已部署本版云函数。');return;}
  if(id!==run)return;
  const backendVersion=release.backendVersion||release.version;
  const match=d.service===name&&d.version===backendVersion&&d.protocol===release.protocol;
  add(name,match,match?'版本 '+d.version+' 匹配':'版本不匹配；本页需要后端 '+backendVersion+'，请按当前版本说明核对 '+name+'。');
  const expected=name==='matin-chat'?['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','GEMINI_API_KEY']:['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY'];
  const missing=expected.filter(n=>d.configuration?.[n]!==true);
  add(name+' 配置',!missing.length,missing.length?'未确认配置：'+missing.join('、'):'必要配置已存在（不验证密钥有效性）。');
  if(name!=='matin-courses')return;
  const db=d.database,versionOk=db?.version===backendVersion&&db?.protocol===release.protocol;
  add('数据库检查接口',versionOk,versionOk?'检查协议匹配；以下逐项核对实际对象。':db?.error==='probe_missing'?'尚未安装 deployment-check.sql，或数据库接口缓存未更新。':'未取得匹配的检查接口；核对 SQL、云函数配置及数据库连接。');
  if(!versionOk)return;
  const count=release.capabilities.filter(c=>db.checks?.[c.id]===true).length+(db.checks?.private_word_bucket===true?1:0)+(db.checks?.private_teaching_bucket===true?1:0),total=release.capabilities.length+2;
  const row=el('li'),details=el('details'),summary=el('summary','数据库关键能力：'+count+' / '+total+' 项匹配（展开查看）'),items=el('ul');details.open=count!==total;details.append(summary,items);row.append(details);list.append(row);
  for(const c of release.capabilities)add(c.label,db.checks?.[c.id]===true,db.checks?.[c.id]===true?'关键接口/版本特征已存在。':'缺失或版本特征不符；参照升级说明核对 '+c.sql+'，不要直接重跑旧SQL。',items);
  add('私有教学资料桶',db.checks?.private_teaching_bucket===true,db.checks?.private_teaching_bucket===true?'私有属性、20MB上限及PDF/TXT类型匹配。':'请运行 teaching-files.sql 并核对 Storage 设置。',items);
  add('私有Word附件桶',db.checks?.private_word_bucket===true,db.checks?.private_word_bucket===true?'私有属性、文件上限及Word类型匹配。':'核对 teacher-latest-report.sql 与 Storage 桶设置。',items);
 }
 check.onclick=async()=>{
  const id=++run;controller?.abort();controller=new AbortController();report=[];list.replaceChildren();download.hidden=true;check.disabled=true;status.textContent='正在检查，通常需要十几秒……';
  try{
   add('当前页面标识',document.querySelector('meta[name="matin-release"]')?.content===release.version,'页面和版本脚本应同为 '+release.version+'。');
   const jobs=release.functions.map(name=>cloud(name,id));
   jobs.push((async()=>{
    try{
     const manifest=await json(new URL('./release-manifest.json',location.href));if(id!==run)return;
     if(manifest.version!==release.version||(manifest.backendVersion||manifest.version)!==(release.backendVersion||release.version)||manifest.protocol!==release.protocol||!Array.isArray(manifest.files)||!manifest.files.length||manifest.files.length>100)throw Error('发布清单与当前页面版本不一致');
     const required=['teacher.html','index.html','teaching-archive.html','matin-release-info.js','matin-release.js'];
     if(required.some(p=>!manifest.files.some(f=>f.path===p)))throw Error('发布清单缺少必要入口');
     if(JSON.stringify(manifest.files.map(f=>f.path).sort())!==JSON.stringify(release.assets))throw Error('发布清单文件列表不完整或不匹配');
     const queue=[...manifest.files],failed=[];
     await Promise.all(Array.from({length:4},async()=>{while(queue.length&&id===run){const f=queue.shift();try{
      if(!/^(?:[a-z0-9-]+\.(?:html|js|css))$/.test(f.path)||!/^[a-f0-9]{64}$/.test(f.sha256))throw Error('清单格式错误');
      const r=await fetch(new URL('./'+f.path,location.href),{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(12000)])});if(!r.ok)throw Error('HTTP '+r.status);
      const bytes=await r.arrayBuffer();const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');if(hash!==f.sha256)throw Error('内容与清单不一致');
     }catch(e){failed.push(f.path+'（'+e.message+'）');}}}));
     if(id===run)add('网页文件完整性',!failed.length,failed.length?'缺失或混用版本：'+failed.join('、'):manifest.files.length+'个文件与本版 SHA256 清单一致。');
    }catch(e){if(id===run)add('网页文件完整性',false,e.message+'；请完整上传本版网页文件和 release-manifest.json。');}
   })());
   await Promise.all(jobs);
   if(id!==run)return;
   const failures=report.filter(r=>!r.ok).length;status.textContent=failures?'检查完成：'+failures+'项待处理。':'检查完成：本次检查范围全部匹配。';download.hidden=false;
  }finally{if(id===run)check.disabled=false;}
 };
 download.onclick=()=>{const blob=new Blob([JSON.stringify({version:release.version,checked_at:new Date().toISOString(),scope:'Deployment metadata and current server files only; no live teaching acceptance',results:report},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='Matin-'+release.version+'-部署检查.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
})();
