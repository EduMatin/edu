// Matin V7 Edge Function — public read, protected trial publish.
// Deploy with JWT verification disabled for this function; all POST requests
// are verified against a strong server-side secret, never a client-side key.
const projectUrl = (Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const publishToken = Deno.env.get('MATIN_PUBLISH_TOKEN') || '';
const allowedOrigin = (Deno.env.get('MATIN_ALLOWED_ORIGIN') || '').replace(/\/+$/, '');
const encoder = new TextEncoder();

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin && origin === allowedOrigin ? origin : (allowedOrigin || 'null'),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-matin-publish-token',
    'Access-Control-Max-Age': '3600',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
  };
}
function result(body, status, origin) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json; charset=utf-8' } });
}
function authorizedOrigin(origin) {
  // Requests without Origin may be used for CLI testing; browser cross-origin
  // requests must match the exact GitHub Pages origin.
  return !origin || (Boolean(allowedOrigin) && origin === allowedOrigin);
}
async function digestEqual(value, expected) {
  const a = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
  const b = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(expected)));
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
async function dbCall(path, method = 'GET', payload) {
  const response = await fetch(projectUrl + '/rest/v1/courses' + path, {
    method,
    headers: {
      'apikey': serviceKey,
      'Authorization': 'Bearer ' + serviceKey,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=representation',
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  const content = await response.text();
  if (!response.ok) throw Error('数据库请求失败 (' + response.status + '): ' + content.slice(0,180));
  return content ? JSON.parse(content) : [];
}
const clean = (v, size) => typeof v === 'string' ? v.slice(0, size).trim() : '';
const validId = id => typeof id === 'string' && /^[\w-]{1,100}$/.test(id);

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  if (!authorizedOrigin(origin)) return result({ ok:false, error:'此网站来源未被允许' }, 403, origin);
  if (req.method === 'OPTIONS') return new Response(null, { status:204, headers:cors(origin) });
  if (!projectUrl || !serviceKey) return result({ ok:false, error:'后台数据库密钥尚未配置' }, 503, origin);

  if (req.method === 'GET') {
    try {
      // Never return drafts: the project payload includes teachers' materials.
      const data = await dbCall('?select=id,title,category,description,project,is_published,updated_at&is_published=eq.true&order=updated_at.desc&limit=100');
      const projects = data.filter(x=>x.is_published===true && x.project && typeof x.project==='object').map(x=>({
        ...x.project, id:x.id, title:x.title, category:x.category, desc:x.description, published:true,
      }));
      return result({ ok:true, projects, count:projects.length }, 200, origin);
    } catch(e) { console.error('Matin read failed', e); return result({ ok:false, error:'云端课程暂时不可读取，请检查服务器日志' }, 503, origin); }
  }
  if (req.method !== 'POST') return result({ok:false,error:'不支持的请求方法'},405,origin);
  if (publishToken.length < 24) return result({ok:false,error:'请先设置至少 24 位的 MATIN_PUBLISH_TOKEN'},503,origin);
  const supplied=req.headers.get('x-matin-publish-token') || '';
  if (!supplied || supplied.length>512 || !(await digestEqual(supplied,publishToken))) return result({ok:false,error:'发布口令错误'},401,origin);
  try {
    if (Number(req.headers.get('content-length')) > 160000) return result({ok:false,error:'请求体太大'},413,origin);
    const content = await req.text();
    if (encoder.encode(content).length > 160000) return result({ok:false,error:'课程太大（上限 160 KB）'},413,origin);
    const body = JSON.parse(content);
    const action=body.action;
    if (!validId(body.id)) return result({ok:false,error:'课程 ID 不符合要求'},400,origin);
    if (action === 'unpublish') {
      await dbCall('?id=eq.'+encodeURIComponent(body.id),'PATCH',{is_published:false,updated_at:new Date().toISOString()});
      return result({ok:true,action,id:body.id},200,origin);
    }
    if(action!=='publish')return result({ok:false,error:'不支持的课程操作'},400,origin);
    const p=body.project;
    if(!p||typeof p!=='object'||p.id!==body.id)return result({ok:false,error:'剧本结构或 ID 错误'},400,origin);
    if(!Array.isArray(p.nodes)||p.nodes.length<1||p.nodes.length>50||!Array.isArray(p.edges)||p.edges.length>150)return result({ok:false,error:'任务节点或连线数量异常'},400,origin);
    if(!clean(p.title,200)||clean(p.title,200).length>150)return result({ok:false,error:'课程标题不正确'},400,origin);
    if(!p.nodes.every(n=>n&&typeof n==='object'&&validId(n.id)))return result({ok:false,error:'包含无效任务节点'},400,origin);
    const now=new Date().toISOString();
    await dbCall('?on_conflict=id','POST',[{
      id:body.id, title:clean(p.title,150), category:clean(p.category,90)||'未分类',
      description:clean(p.desc,1500), project:{...p,published:true},
      is_published:true,updated_at:now,
    }]);
    return result({ok:true,action:'publish',id:body.id,publishedAt:now},200,origin);
  }catch(e){console.error('Matin publish error',e);return result({ok:false,error:'服务器处理失败，请检查课程格式与 Edge Function 日志'},500,origin);}
});
