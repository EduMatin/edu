/* Lossless teaching archive v1: UTF-8 JSON records, SHA-256 manifest, stored ZIP.
 * Parsing never executes archived content. No credentials or private drafts are accepted. */
(function archiveFormat(root){
 'use strict';
 const MAX=209715200,MAX_PACKAGE=MAX*3+33554432,MAX_ROWS=50000,enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
 const readerPath='打开教学档案.html';
 const kinds=['class','member','roster_import','student','class_course','outline','project','lifecycle','teaching_event','task','plan_source','progress','report','review_event','task_change','gradebook','gradebook_change','grade_release'];
 const labels={'class':'班级资料',member:'成员及审核状态',roster_import:'导入名单',student:'学生身份',class_course:'项目关联',outline:'课程目录',project:'教学项目',lifecycle:'结课快照',teaching_event:'结课与重开记录',task:'全部任务',plan_source:'教学计划来源',progress:'任务进度',report:'各版报告与批阅',review_event:'批注及评分历史',task_change:'任务修改历史',gradebook:'课程成绩权重',gradebook_change:'权重修改历史',grade_release:'总评发布历史'};
 function assert(v,s){if(!v)throw Error(s);}
 const hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof b==='string'?enc.encode(b):b)),x=>x.toString(16).padStart(2,'0')).join('');
 const rootText=m=>'matin-teaching-archive:1\n'+[m.export_id,m.owner_id,m.class_id,m.captured_at,m.expires_at].join('\n')+'\n'+m.entries.map(e=>[e.seq,e.kind,e.bytes,e.sha256].join('|')+'\n').join('');
 const keyOf=(k,d)=>({class:()=>d.id,member:()=>d.student_id,roster_import:()=>d.id,student:()=>d.id,class_course:()=>d.course_id,outline:()=>d.source,project:()=>d.id,lifecycle:()=>d.class_id,teaching_event:()=>d.id,task:()=>d.id,plan_source:()=>d.id,progress:()=>d.task_id+':'+d.student_id,report:()=>d.task_id+':'+d.student_id+':'+d.version,review_event:()=>d.id,task_change:()=>d.task_id+':'+d.revision,gradebook:()=>d.course_id,gradebook_change:()=>d.id,grade_release:()=>d.id}[k])();
 async function verify(manifest,files,onProgress=()=>{}){
  const m=manifest;
  assert(m?.format==='matin-teaching-archive'&&m.version===1,'不支持此档案格式或版本。');
  assert(Array.isArray(m.entries)&&m.entries.length===m.record_count&&m.record_count>0&&m.record_count<=MAX_ROWS,'档案记录数量不完整。');
  assert(Number.isSafeInteger(m.total_bytes)&&m.total_bytes>0&&m.total_bytes<=MAX,'档案大小超出支持范围。');
  assert(Number.isFinite(Date.parse(m.captured_at))&&Number.isFinite(Date.parse(m.expires_at)),'档案时间无效。');
  const rows=[],counts={},seen=new Set();let total=0;
  for(let i=0;i<m.entries.length;i++){
   const e=m.entries[i];assert(e.seq===i+1&&kinds.includes(e.kind)&&e.path===`records/${e.kind}/${e.seq}.json`,'档案目录或顺序无效。');
   assert(typeof e.key==='string'&&!seen.has(e.kind+':'+e.key),'档案存在重复记录。');seen.add(e.kind+':'+e.key);
   const b=files.get(e.path);assert(b instanceof Uint8Array&&b.byteLength===e.bytes,`文件缺失或长度不符：${e.path}`);
   assert(await hash(b)===e.sha256,`校验值不符，文件可能损坏：${e.path}`);
   let d;try{d=JSON.parse(dec.decode(b));}catch{throw Error('档案 JSON 无法读取：'+e.path);}
   assert(d&&typeof d==='object'&&!Array.isArray(d)&&String(keyOf(e.kind,d))===e.key,'记录编号与目录不一致：'+e.path);
   rows.push({kind:e.kind,key:e.key,data:d});counts[e.kind]=(counts[e.kind]||0)+1;total+=b.length;onProgress(i+1,m.entries.length);
  }
  assert(total===m.total_bytes,'档案总长度不一致。');
  assert(Object.keys(m.counts||{}).length===Object.keys(counts).length&&Object.entries(counts).every(([k,n])=>m.counts[k]===n),'分类记录数不一致。');
  assert(await hash(rootText(m))===m.root_sha256,'档案目录总校验值不符。');
  const grouped=Object.fromEntries(kinds.map(k=>[k,rows.filter(r=>r.kind===k).map(r=>r.data)])),warnings=[];
  const c=grouped.class[0];assert(grouped.class.length===1&&c.id===m.class_id&&c.owner_id===m.owner_id&&c.name===m.class_name&&c.revision===m.class_revision,'班级身份与档案目录不一致。');
  const students=new Set(grouped.student.map(s=>s.id)),tasks=new Map(grouped.task.map(t=>[t.id,t])),projects=new Set(grouped.project.map(p=>p.id)),plans=new Set(grouped.plan_source.map(p=>p.id)),reports=new Map(grouped.report.map(r=>[keyOf('report',r),r]));
  for(const k of ['class','student','task','project','roster_import','plan_source'])for(const d of grouped[k])assert(typeof d.id==='string'&&d.id.length>0,'记录缺少有效编号。');
  for(const d of grouped.member)assert(typeof d.student_id==='string'&&['pending','approved','rejected','removed','left'].includes(d.status),'成员身份或审核状态无效。');
  for(const k of ['member','roster_import','class_course','lifecycle','teaching_event','task','plan_source'])for(const d of grouped[k])assert(d.class_id===c.id,'档案混入其他班级记录。');
  for(const k of ['member','roster_import','progress','report'])for(const d of grouped[k])if(d.student_id)assert(students.has(d.student_id),'缺少学生身份记录。');
  for(const k of ['progress','report','review_event','task_change'])for(const d of grouped[k])assert(tasks.has(d.task_id),'记录关联的任务缺失。');
  for(const p of grouped.project)assert(p.owner_id===c.owner_id&&!('student_access_token' in p),'项目归属或隐私字段不正确。');
  for(const t of grouped.task){assert(projects.has(t.project_id),'任务关联的教学项目缺失。');assert(typeof t.title==='string'&&typeof t.active==='boolean','任务标题或状态无效。');if(t.teaching_plan_id)assert(plans.has(t.teaching_plan_id),'任务教学计划来源缺失。');if(!t.project_snapshot)warnings.push('任务“'+t.title+'”没有独立学习版本快照，请结合报告中的节点内容查阅。');}
  for(const l of grouped.class_course)assert(projects.has(l.course_id),'班级关联的教学项目缺失。');
  for(const o of grouped.outline){assert(Array.isArray(o.members)&&Array.isArray(o.groups),'课程目录格式不正确。');for(const a of o.members)assert(projects.has(a.project_id)&&o.groups.some(g=>g.id===a.group_id),'课程目录关联缺失。');}
  const versionGroups=new Map();
  function annotations(d,report){assert(Array.isArray(d.annotations),'批注格式无效。');for(const a of d.annotations)assert(Number.isInteger(a.message_index)&&a.message_index>=0&&a.message_index<(report.messages||[]).length&&typeof a.text==='string','批注无法对应报告中的回答。');}
  for(const r of grouped.report){
   assert(Number.isSafeInteger(r.version)&&r.version>0&&r.report?.project_id===tasks.get(r.task_id).project_id,'报告版本或关联项目无效。');
   assert(Array.isArray(r.report.messages)&&Array.isArray(r.report.evaluations)&&typeof r.report.summary==='string','报告缺少完整对话、评价或总结。');
   for(const message of r.report.messages)assert(message&&typeof message.text==='string'&&['user','assistant','system'].includes(message.role),'报告对话格式不正确。');
   assert(['pending_review','revision_required','passed'].includes(r.review_status),'报告批阅状态无效。');annotations(r,r.report);
   if(r.teacher_score!=null)assert(Number.isFinite(r.teacher_score)&&r.teacher_score>=0&&r.teacher_score<=100,'报告评分无效。');
   const k=r.task_id+':'+r.student_id;if(!versionGroups.has(k))versionGroups.set(k,[]);versionGroups.get(k).push(r.version);
  }
  for(const versions of versionGroups.values()){versions.sort((a,b)=>a-b);assert(versions.every((v,i)=>v===i+1),'报告版本不连续，无法确认完整恢复。');}
  for(const e of grouped.review_event){const r=reports.get(e.task_id+':'+e.student_id+':'+e.version);assert(r,'批阅历史关联的报告版本缺失。');for(const d of [e.before_data,e.after_data]){assert(d&&typeof d==='object','批阅历史内容缺失。');if(d.annotations)annotations(d,r.report);}}
  function weightsValid(ws){return Array.isArray(ws)&&ws.length>0&&new Set(ws.map(w=>w.task_id)).size===ws.length&&ws.every(w=>tasks.has(w.task_id)&&Number.isFinite(w.weight)&&w.weight>0&&w.weight<=100&&Math.abs(w.weight*10-Math.round(w.weight*10))<1e-8)&&Math.abs(ws.reduce((n,w)=>n+w.weight,0)-100)<1e-8;}
  for(const k of ['gradebook','gradebook_change','grade_release'])for(const d of grouped[k])assert(d.class_id===c.id,'成绩档案混入其他班级记录。');
  for(const d of grouped.gradebook){assert(weightsValid(d.weights),'课程权重或关联任务无效。');assert(grouped.gradebook_change.some(x=>x.course_id===d.course_id&&x.revision===d.revision),'缺少权重修改记录。');}
  for(const d of grouped.gradebook_change){assert(weightsValid(d.after_data?.weights)&&(!d.before_data||weightsValid(d.before_data.weights)),'历史权重无效。');}
  for(const d of grouped.grade_release){assert(students.has(d.student_id)&&Number.isFinite(d.final_score)&&d.final_score>=0&&d.final_score<=100,'总评学生身份或分数无效。');assert(weightsValid(d.calculation?.cells),'总评计分依据缺失。');const config=grouped.gradebook_change.find(x=>x.course_id===d.course_id&&x.revision===d.config_revision);assert(config&&config.after_data.weights.every(w=>d.calculation.cells.some(x=>x.task_id===w.task_id&&x.weight===w.weight))&&config.after_data.weights.length===d.calculation.cells.length,'总评与权重历史不一致。');for(const x of d.calculation.cells)assert(reports.has(x.task_id+':'+d.student_id+':'+x.version)&&Number.isFinite(x.score)&&x.score>=0&&x.score<=100&&x.status==='passed','总评关联的报告版本或评分依据缺失。');assert(Math.abs(Math.round(d.calculation.cells.reduce((n,x)=>n+x.score*x.weight/100,0)*10)/10-d.calculation.calculated_score)<1e-8,'课程总评计算依据不一致。');}
  return {manifest:m,rows,grouped,warnings:[...new Set(warnings)],counts};
 }
 const crcTable=Uint32Array.from({length:256},(_,i)=>{for(let k=0;k<8;k++)i=(i&1)?0xedb88320^(i>>>1):i>>>1;return i>>>0;});
 function crc(b){let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
 function header(size){const b=new Uint8Array(size);return [b,new DataView(b.buffer)];}
 function zip(files){
  assert(files.size<=MAX_ROWS+3,'文件数量过多。');const local=[],central=[];let offset=0,centralSize=0;
  for(const [path,data] of files){const name=enc.encode(path),b=typeof data==='string'?enc.encode(data):data;const sum=crc(b),[a,v]=header(30),[c,w]=header(46);
   v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,sum,true);v.setUint32(18,b.length,true);v.setUint32(22,b.length,true);v.setUint16(26,name.length,true);
   w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x800,true);w.setUint32(16,sum,true);w.setUint32(20,b.length,true);w.setUint32(24,b.length,true);w.setUint16(28,name.length,true);w.setUint32(42,offset,true);
   local.push(a,name,b);central.push(c,name);offset+=30+name.length+b.length;centralSize+=46+name.length;
  }
  const [end,v]=header(22);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.size,true);v.setUint16(10,files.size,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);
  return new Blob([...local,...central,end],{type:'application/zip'});
 }
 function unzip(buffer){
  const b=new Uint8Array(buffer),v=new DataView(b.buffer,b.byteOffset,b.byteLength),files=new Map();
  assert(b.length>=22&&b.length<=MAX_PACKAGE,'档案包大小无效或超出支持范围。');const end=b.length-22;
  assert(v.getUint32(end,true)===0x06054b50&&v.getUint16(end+4,true)===0&&v.getUint16(end+6,true)===0&&v.getUint16(end+20,true)===0,'仅支持平台导出的完整 ZIP 档案。');
  const n=v.getUint16(end+10,true),start=v.getUint32(end+16,true);assert(n===v.getUint16(end+8,true)&&n<=MAX_ROWS+3&&start+v.getUint32(end+12,true)===end,'ZIP 目录损坏。');
  let at=start,nextLocal=0,total=0;
  for(let i=0;i<n;i++){
   assert(at+46<=end&&v.getUint32(at,true)===0x02014b50,'ZIP 目录损坏。');
   const size=v.getUint32(at+24,true),nl=v.getUint16(at+28,true),extra=v.getUint16(at+30,true),comment=v.getUint16(at+32,true),off=v.getUint32(at+42,true),sum=v.getUint32(at+16,true);
   assert(at+46+nl+extra+comment<=end&&v.getUint16(at+8,true)===0x800&&v.getUint16(at+10,true)===0&&size===v.getUint32(at+20,true)&&v.getUint16(at+34,true)===0,'不支持加密、压缩或分卷档案。');
   const name=dec.decode(b.subarray(at+46,at+46+nl));assert((name===readerPath||/^(manifest\.json|README\.txt|records\/[a-z_]+\/[1-9][0-9]*\.json)$/.test(name))&&!files.has(name),'ZIP 包含不安全或重复路径。');
   assert(off===nextLocal&&off+30<=start&&v.getUint32(off,true)===0x04034b50&&v.getUint16(off+6,true)===0x800&&v.getUint16(off+8,true)===0&&v.getUint32(off+14,true)===sum&&v.getUint32(off+18,true)===size&&v.getUint32(off+22,true)===size&&v.getUint16(off+26,true)===nl&&v.getUint16(off+28,true)===0,'ZIP 文件头不一致。');
   const begin=off+30+nl;assert(begin+size<=start&&dec.decode(b.subarray(off+30,begin))===name,'ZIP 文件边界无效。');const data=b.subarray(begin,begin+size);assert(crc(data)===sum,'ZIP 文件损坏：'+name);files.set(name,data);
   total+=size;assert(total<=MAX_PACKAGE,'解包大小超出支持范围。');nextLocal=begin+size;at+=46+nl+extra+comment;
  }
  assert(at===end&&nextLocal===start&&files.has('manifest.json'),'ZIP 档案不完整。');return files;
 }
 const scopeNote='完整教学档案 v1\n包含班级、全部成员及导入名单、身份资料、项目与课程关联、全部任务及进度、各版已提交报告、当前批阅与历次批注评分、任务修改记录、结课冻结名单及操作历史，以及课程权重、权重修改历史和教师确认的各次总评发布依据。\n保留导出时云端已存在的正式记录；教学计划仅保留来源信息。未提交的私有对话/草稿、密码、密钥、入班码及分享访问码不包含在内。\n在教师端“教学档案”中选择“打开已有档案”可检查并只读查阅；不自动覆盖线上班级或创建学生登录账号。\nSHA-256 与 ZIP CRC 用于检测损坏；本地校验不证明来源，可登录原教师账号核对云端导出凭据。请妥善保管含学生个人资料的档案。\n';
 async function pack(manifest,files){await verify(manifest,files);return zip(new Map([['manifest.json',JSON.stringify(manifest,null,2)],['README.txt',scopeNote],...files]));}
 async function read(buffer,onProgress){const files=unzip(buffer);let m;try{m=JSON.parse(dec.decode(files.get('manifest.json')));}catch{throw Error('无法读取档案目录。');}
  const p=m.presentation;
  if(p){assert(p.version===1&&p.path===readerPath,'不支持此阅读文件格式。');const b=files.get(readerPath);assert(b&&b.length===p.bytes&&await hash(b)===p.sha256,'阅读文件缺失或已损坏。');}
  assert(files.size===m.entries?.length+2+(p?1:0)&&files.has('README.txt'),'档案含缺失或未登记的文件。');const checked=await verify(m,files,onProgress);checked.files=new Map(m.entries.map(e=>[e.path,files.get(e.path)]));return checked;
 }
 function toBase64(bytes){let text='';for(let i=0;i<bytes.length;i+=16384)text+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(text);}
 async function readEmbedded(payload){
  const m=payload?.manifest;assert(m&&Array.isArray(m.entries)&&m.entries.length<=MAX_ROWS&&Array.isArray(payload.files)&&payload.files.length===m.entries.length,'阅读文件的档案目录不完整。');
  assert(m.total_bytes<=MAX&&m.total_bytes>0,'阅读文件数据过大。');let total=0;const files=new Map();
  for(let i=0;i<m.entries.length;i++){const e=m.entries[i],p=payload.files[i];assert(Number.isSafeInteger(e.bytes)&&e.bytes>0&&Array.isArray(p)&&p[0]===e.path&&typeof p[1]==='string'&&p[1].length===Math.ceil(e.bytes/3)*4,'阅读文件的数据长度不符。');total+=e.bytes;assert(total<=MAX&&!files.has(e.path),'阅读文件重复或超过容量。');let raw;try{raw=atob(p[1]);}catch{throw Error('阅读文件的数据编码无效。');}files.set(e.path,Uint8Array.from(raw,c=>c.charCodeAt(0)));}
  const checked=await verify(m,files);checked.files=files;return checked;
 }
 const api={MAX,MAX_PACKAGE,readerPath,labels,kinds,hash,rootText,keyOf,verify,zip,unzip,pack,read,scopeNote,toBase64,readEmbedded,install:archiveFormat};root.MatinArchiveFormat=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
