/* Shared authenticated transport. Credentials remain in the account module's session. */
(() => {
 'use strict';
 window.MatinClassAI={async request(base,key,token,payload,signal){
  if(!base||!key||!token)throw Error('请先登录已验证邮箱的账号。');
  const res=await fetch(base+'/functions/v1/matin-chat',{method:'POST',signal:signal||AbortSignal.timeout(45000),
   headers:{'Content-Type':'application/json',apikey:key,Authorization:'Bearer '+token},
   body:JSON.stringify({...payload,request_id:crypto.randomUUID()})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(data.error||'班级 AI 暂不可用，请稍后重试。');
  if(typeof data.reply!=='string'||!data.reply.trim())throw Error('班级 AI 没有返回回复。');
  // A successful paid response must not be lost or retried because usage recording failed.
  if(data.usage_recorded===false)window.dispatchEvent(new CustomEvent('matin-ai-usage-pending'));
  return data.reply;
 }};
})();
