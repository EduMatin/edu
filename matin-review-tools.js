/* Teacher-owned comment presets and transparent rubrics. Formal rubric details live
   in the versioned feedback text, so old student readers and archives retain them. */
(() => {'use strict';
 const el=(tag,text,cls='')=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;n.className=cls;return n;};
 const button=(text,fn)=>{const n=el('button',text,'btn');n.type='button';n.onclick=fn;return n;};
 const defaults=[['知识理解',30,'概念、原理与术语准确，能解释关键关系。'],['推导与方法',30,'步骤完整，方法合理，能说明依据。'],['证据与分析',25,'结合数据或学习证据分析结果、误差和局限。'],['总结与表达',15,'结论清晰，符号、单位及表达规范。']].map(([name,max,guide])=>({name,max:String(max),guide,score:''}));
 const comments=['核心概念理解准确，推导步骤清晰。','能结合数据解释结论，建议进一步讨论误差来源。','请补充关键推导步骤，并说明各物理量的含义及单位。','请补充原始数据、计算过程及误差分析。','请完成尚未覆盖的阶段，并在总结中说明学习收获。','请对照批注修改后重新提交。'];
 const copy=v=>JSON.parse(JSON.stringify(v));
 const number=v=>String(v).trim()!==''&&/^\d+(?:\.\d)?$/.test(String(v))?Number(v):NaN;
 function validate(items){
  if(!Array.isArray(items)||items.length<2||items.length>8)throw Error('评分量表需要2至8个维度。');
  let max=0,total=0;const names=new Set();
  for(const item of items){const name=String(item.name||'').trim(),m=number(item.max),s=number(item.score);
   if(!name||name.length>40||/[\r\n]/.test(name)||names.has(name))throw Error('量表维度名称须填写且不能重复（最多40字）。');names.add(name);
   if(!Number.isFinite(m)||m<=0||m>100)throw Error('各维度满分须大于0且不超过100，最多1位小数。');
   if(!Number.isFinite(s)||s<0||s>m)throw Error('请填写每个维度的得分，不能超过该项满分，最多1位小数。');
   if(String(item.guide||'').length>160||/[\r\n]/.test(item.guide||''))throw Error('评价要点最多160字，请使用单行文字。');
   max+=Math.round(m*10);total+=Math.round(s*10);
  }
  if(max!==1000)throw Error('评分量表各维度满分合计必须为100。');return total/10;
 }
 function format(items){const total=validate(items);return '【评分量表】\n'+items.map(i=>'- '+i.name.trim()+'：'+number(i.score)+' / '+number(i.max)+'\n  评价要点：'+String(i.guide||'').trim()).join('\n')+'\n量表合计：'+total+' / 100\n【评分量表结束】';}
 function parse(text){
  const start=text.lastIndexOf('【评分量表】');if(start<0)return null;const block=text.slice(start),items=[];
  for(const m of block.matchAll(/^- (.{1,40})：(\d+(?:\.\d)?) \/ (\d+(?:\.\d)?)\n  评价要点：([^\r\n]*)/gm))items.push({name:m[1],score:m[2],max:m[3],guide:m[4]});
  try{if(format(items)!==block)return null;return {text:text.slice(0,start).replace(/\n\n$/,''),items,total:validate(items)};}catch{return null;}
 }
 const style=el('style',`.rt-tools{margin:12px 0}.rt-tools summary{cursor:pointer;font-weight:600}.rt-tools .rt-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}.rt-tools .btn{padding:7px 10px;font-size:13px}.rt-tools label{display:grid;gap:5px;font-size:13px}.rt-tools .rt-check{display:flex;align-items:center;gap:8px}.rt-tools input[type=checkbox]{width:auto}.rt-tools .rt-chip{max-width:100%;text-align:left;white-space:normal}.rt-tools .rt-item{border-bottom:1px solid #e4e9f4;padding:10px 0;display:grid;grid-template-columns:minmax(100px,1fr) 85px 85px auto;gap:8px;align-items:end}.rt-item input{width:100%;min-width:0}.rt-tools .rt-guide{grid-column:1/-1}.rt-tools .rt-result{font-weight:600;color:#4b4ed1}.rt-tools [hidden]{display:none!important}@media(max-width:650px){.rt-tools .rt-item{grid-template-columns:1fr 1fr}.rt-tools .rt-item label:first-child{grid-column:1/-1}.rt-tools .rt-item .btn{grid-column:1/-1}}`);document.head.append(style);
 function mount({container,grade,feedback,reason,scope,onChange,onError}){
  const key='matin_review_presets_v1:'+encodeURIComponent(JSON.stringify(scope));let stored={};
  try{const value=JSON.parse(localStorage.getItem(key)||'{}');stored=value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{onError('无法读取本机常用设置；仍可填写并保存批阅。');}
  let personal=Array.isArray(stored.comments)?stored.comments.filter(s=>typeof s==='string'&&s.length<=500).slice(0,20):[];
  let items=copy(defaults),enabled=false;
  if(Array.isArray(stored.rubric)){try{validate(stored.rubric.map(i=>({...i,score:'0'})));items=stored.rubric.map(i=>({...i,score:''}));}catch{/* Invalid presets never affect a report. */}}
  const parsed=parse(feedback.value);if(parsed&&Number(grade?.value)===parsed.total&&grade?.value!==''){items=parsed.items;enabled=true;feedback.value=parsed.text;}
  const box=el('div',undefined,'rt-tools'),presets=el('details',undefined,'tr-report-section'),commentBody=el('div'),target=el('select');
  target.setAttribute('aria-label','常用评语填写位置');target.append(new Option('填入教师总评','feedback'));if(reason)target.append(new Option('填入修改要求','reason'));
  presets.append(el('summary','常用评语'),el('p','点击评语插入光标位置，保留已有文字；填写后仍可修改。个人评语只保存在本机当前账号。','tr-muted'),target,commentBody);box.append(presets);
  function savePresets(){try{localStorage.setItem(key,JSON.stringify({comments:personal,rubric:stored.rubric||null}));return true;}catch{onError('常用设置未能保存到本机；报告输入仍保留，请检查浏览器存储。');return false;}}
  function insert(text){const input=target.value==='reason'?reason:feedback;if(!input)return;
   const a=input.selectionStart??input.value.length,b=input.selectionEnd??a,before=input.value.slice(0,a),after=input.value.slice(b),part=(before&&!before.endsWith('\n')?'\n':'')+text+(after&&!after.startsWith('\n')?'\n':'');
   if(input.value.length-(b-a)+part.length>input.maxLength){onError('插入后超出字数上限，请先精简文字。');return;}input.setRangeText(part,a,b,'end');input.focus();onChange();
  }
  const personalInput=el('input');personalInput.maxLength=500;personalInput.placeholder='输入自己的常用评语';personalInput.setAttribute('aria-label','新增常用评语');
  const add=button('添加个人评语',()=>{const value=personalInput.value.trim();if(!value)return;if(personal.length>=20){onError('个人常用评语最多20条，请先移除不用的评语。');return;}if(!personal.includes(value))personal.push(value);if(savePresets())personalInput.value='';drawComments();});
  function drawComments(){commentBody.replaceChildren();for(const text of comments){const row=el('div',undefined,'rt-row');row.append(button(text,()=>insert(text)));row.firstChild.classList.add('rt-chip');commentBody.append(row);}
   for(const text of personal){const row=el('div',undefined,'rt-row'),remove=button('移除',()=>{personal=personal.filter(x=>x!==text);savePresets();drawComments();});remove.setAttribute('aria-label','移除评语：'+text);row.append(button(text,()=>insert(text)),remove);row.firstChild.classList.add('rt-chip');commentBody.append(row);}}
  drawComments();const personalRow=el('div',undefined,'rt-row');personalRow.append(personalInput,add);presets.append(personalRow);
  let toggle,rows,result;
  function update(){if(!grade)return;grade.readOnly=enabled;toggle.checked=enabled;rows.hidden=!enabled;
   if(!enabled){result.textContent='可直接填写教师评分。';return;}
   try{const total=validate(items);grade.value=String(total);result.textContent='合计 '+total+' / 100，正式保存时量表明细一并写入总评。';}catch(e){grade.value='';result.textContent=e.message;}
  }
  function changed(){update();onChange();}
  function draw(){if(!rows)return;rows.replaceChildren();items.forEach((item,i)=>{const row=el('div',undefined,'rt-item');
   for(const [key,title,limit] of [['name','维度名称',40],['max','满分',5],['score','得分',5],['guide','评价要点',160]]){const l=el('label',title),input=el('input');input.value=item[key]??'';input.maxLength=limit;input.setAttribute('aria-label','量表第'+(i+1)+'项'+title);if(key==='max'||key==='score')input.inputMode='decimal';if(key==='guide')l.className='rt-guide';input.oninput=()=>{item[key]=input.value;changed();};l.append(input);row.append(l);}
   const remove=button('删除维度',()=>{if(items.length<=2)return;items.splice(i,1);draw();changed();});remove.dataset.fixedDisabled=String(items.length<=2);remove.disabled=items.length<=2;row.children[3].before(remove);rows.append(row);
  });const actions=el('div',undefined,'rt-row'),addDimension=button('增加维度',()=>{if(items.length>=8)return;items.push({name:'',max:'',score:'',guide:''});draw();changed();});addDimension.dataset.fixedDisabled=String(items.length>=8);addDimension.disabled=items.length>=8;
   actions.append(addDimension,button('保存为我的常用量表',()=>{try{validate(items.map(i=>({...i,score:'0'})));stored.rubric=items.map(i=>({...i,score:''}));if(savePresets())result.textContent='常用量表已保存。下份报告复用维度与满分，得分需重新填写。';}catch(e){onError(e.message);}}));rows.append(actions);update();
  }
  if(grade){const rubric=el('section',undefined,'tr-report-section'),l=el('label','使用评分量表（满分100）','rt-check');toggle=el('input');toggle.type='checkbox';toggle.setAttribute('aria-label','使用评分量表');toggle.onchange=()=>{enabled=toggle.checked;changed();};l.prepend(toggle);rows=el('div');result=el('p',undefined,'rt-result');result.setAttribute('role','status');rubric.append(l,el('p','建议尺度：90%–100% 完整准确；75%–89% 主要掌握，有少量不足；60%–74% 部分掌握，需补充依据；低于60% 关键内容待完善。可按课程调整维度、满分与评价要点。','tr-muted'),rows,result);box.append(rubric);draw();}
  container.append(box);
  return {read:()=>({enabled,items:copy(items)}),apply:value=>{if(!grade||!value||!Array.isArray(value.items))return;enabled=!!value.enabled;items=value.items.filter(i=>i&&typeof i==='object').slice(0,8).map(i=>({name:String(i.name??'').slice(0,40),max:String(i.max??'').slice(0,5),score:String(i.score??'').slice(0,5),guide:String(i.guide??'').slice(0,160)}));draw();},feedbackValue:()=>{const text=feedback.value+(enabled?'\n\n'+format(items):'');if(text.length>5000)throw Error('总评与评分量表合计超过5000字，请精简后保存。');return text;}};
 }
 window.MatinReviewTools={mount,parse,format,validate};
})();
