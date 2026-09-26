export function auditSinkUrl(raw){
  if(typeof raw!=='string'||raw.length<8||raw.length>2048)throw new Error('invalid_sharedos_audit_url');
  let u;try{u=new URL(raw);}catch{throw new Error('invalid_sharedos_audit_url');}
  if(u.protocol!=='https:')throw new Error('sharedos_audit_url_https_required');
  if(!u.hostname)throw new Error('sharedos_audit_url_hostname_required');
  if(u.username||u.password)throw new Error('sharedos_audit_url_credentials_forbidden');
  if(u.hash)throw new Error('sharedos_audit_url_fragment_forbidden');
  return u.toString();
}

export async function postAuditEvent({url,key,event,fetchImpl=globalThis.fetch,timeoutMs=5000}={}){
  const endpoint=auditSinkUrl(url);
  if(typeof key!=='string'||!key.trim()||key.length>4096)throw new Error('invalid_sharedos_key');
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<100||timeoutMs>30_000)throw new Error('invalid_sharedos_audit_timeout');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new Error('sharedos_audit_timeout')),timeoutMs);
  try{
    const response=await fetchImpl(endpoint,{
      method:'POST',
      headers:{'content-type':'application/json',authorization:`Bearer ${key}`},
      body:JSON.stringify({events:[event]}),
      signal:controller.signal,
      redirect:'error'
    });
    try{await response.body?.cancel?.();}catch{}
    if(!response.ok)throw new Error(`sharedos_audit_http_${response.status}`);
    return {ok:true,status:response.status};
  }finally{clearTimeout(timer);}
}
