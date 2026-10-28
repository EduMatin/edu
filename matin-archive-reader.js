/* Add a self-contained, double-clickable reading copy without altering the raw archive. */
((root)=>{
 'use strict';
 const F=root.MatinArchiveFormat,enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
 const help='如何打开教学档案\n\n1. 将ZIP“全部解压”到一个文件夹。\n2. 双击“打开教学档案.html”，用Chrome或Edge浏览器查看。无需联网或登录。\n3. 通过中文目录、姓名/学号/任务搜索查看名单、报告各版本、分数和批注。\n\nrecords文件夹与manifest.json是机器恢复及校验所需的原始数据，不必逐个打开，请和ZIP一起保留。阅读页面内已包含本次档案的数据，移到其他电脑也可单独查看。\n\n旧版ZIP没有HTML入口：在教师端“教学档案 → 打开已有档案”选择原ZIP，校验后点击“下载可直接打开的档案ZIP”，即可补齐入口，无需重新访问云端。\n\n'+F.scopeNote;
 async function make(checked,files,uiInstall){
  if(typeof uiInstall!=='function')throw Error('阅读组件未加载，请刷新页面或补传网页文件。');
  const m={...checked.manifest};delete m.presentation;
  const payload=JSON.stringify({manifest:m,files:m.entries.map(e=>[e.path,F.toBase64(files.get(e.path))])}).replace(/</g,'\\u003c');
  // Original JSON bytes are base64 data, never executable code or unescaped HTML.
  const code='('+F.install.toString()+')(globalThis);('+uiInstall.toString()+')();'+`\n(async()=>{const status=document.getElementById('reader-status');try{const data=JSON.parse(document.getElementById('matin-archive-data').textContent);const checked=await MatinArchiveFormat.readEmbedded(data);status.textContent='校验通过 · '+checked.manifest.class_name+' · 本机只读档案';const open=()=>MatinTeachingArchive.openVerified(checked,checked.files);document.getElementById('reader-open').onclick=open;document.getElementById('reader-open').hidden=false;open();}catch(e){status.textContent='档案校验未通过：'+e.message+'。请保留原ZIP，回到教师端重新校验。';}})();`;
  const html='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; connect-src \'none\'; img-src data:; object-src \'none\'; base-uri \'none\'; form-action \'none\'"><title>Matin · 教学档案</title><style>body{margin:0;background:#f3f6fc;color:#243452;font:16px/1.7 system-ui,sans-serif}main{max-width:850px;margin:8vh auto;padding:30px;background:white;border:1px solid #dfe6f3;border-radius:20px}main button{background:#4e55e9;color:white;border:0;border-radius:10px;padding:12px 22px;font:inherit;cursor:pointer}main p{color:#61728e}</style></head><body><main><h1>教学档案</h1><p id="reader-status" role="status">正在校验内附档案…</p><button id="reader-open" hidden>打开档案目录</button><p>无需联网或登录。通过中文目录查看成员、任务、各版报告和批注。完整恢复数据仍保存在原ZIP中。</p><noscript>请使用允许JavaScript的Chrome或Edge打开本文件，或在教师端选择完整ZIP进行查看。</noscript></main><script id="matin-archive-data" type="application/json">'+payload+'</script><script>'+code.replace(/<\/script/gi,'<\\/script')+'</script></body></html>';
  const bytes=enc.encode(html);m.presentation={version:1,path:F.readerPath,bytes:bytes.length,sha256:await F.hash(bytes)};
  const zip=F.zip(new Map([[F.readerPath,bytes],['README.txt',help],['manifest.json',JSON.stringify(m,null,2)],...files]));
  if(zip.size>F.MAX_PACKAGE)throw Error('档案与阅读副本合计过大，无法完整打包。请保留原始ZIP。');
  return {zip,manifest:m};
 }
 async function readHTML(buffer){
  if(buffer.byteLength>F.MAX_PACKAGE)throw Error('阅读文件过大。');
  // Extract only the inert data element. Never insert/execute imported HTML or scripts.
  const text=dec.decode(buffer),matches=[...text.matchAll(/<script id="matin-archive-data" type="application\/json">([\s\S]*?)<\/script>/g)];
  if(matches.length!==1)throw Error('请选择平台生成的“打开教学档案.html”，或原始完整ZIP。');
  let payload;try{payload=JSON.parse(matches[0][1]);}catch{throw Error('阅读文件的数据无法解析。');}return F.readEmbedded(payload);
 }
 root.MatinArchiveReader={make,readHTML,help};if(typeof module==='object'&&module.exports)module.exports=root.MatinArchiveReader;
})(globalThis);
