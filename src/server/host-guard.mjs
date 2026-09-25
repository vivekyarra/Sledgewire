function normalizeHost(value){
  if(typeof value!=='string')return null;
  const s=value.trim().toLowerCase();
  if(!s||s.includes(',')||/[\r\n\s]/.test(s))return null;
  try{
    const u=new URL(`http://${s}`);
    if(u.username||u.password||u.pathname!=='/'||u.search||u.hash)return null;
    return u.host.toLowerCase();
  }catch{return null;}
}
export function allowedHostSet(publicBaseUrl,extraCsv=''){
  const base=new URL(publicBaseUrl);
  const out=new Set([base.host.toLowerCase()]);
  for(const raw of String(extraCsv).split(',')){
    const h=normalizeHost(raw);
    if(h)out.add(h);
  }
  return out;
}
export function hostHeaderAllowed(hostHeader,allowedHosts){
  const h=normalizeHost(Array.isArray(hostHeader)?hostHeader[0]:hostHeader);
  return h!==null&&allowedHosts instanceof Set&&allowedHosts.has(h);
}
