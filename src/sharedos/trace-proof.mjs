import {sha256} from '../receipts/receipt.mjs';

const TRACE=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function safeAddress(x){
  if(!x||typeof x!=='object')return null;
  if(x.kind==='agent'&&typeof x.agentId==='string')return {kind:'agent',agentId:x.agentId};
  if(x.kind==='human'&&typeof x.userId==='string')return {kind:'human',userId:x.userId};
  if(x.kind==='group'&&typeof x.groupId==='string')return {kind:'group',groupId:x.groupId};
  return null;
}
function safeResource(x){
  if(!x||typeof x!=='object')return null;
  return {namespace:typeof x.namespace==='string'?x.namespace:null,path:Array.isArray(x.path)?x.path.map(v=>String(v)).slice(0,16):[]};
}
function sanitize(e){
  const out={
    id:e.id??null,type:e.type??null,outcome:e.outcome??null,at:e.at??null,traceId:e.traceId??null,
    namespaceId:e.namespaceId??null,actor:safeAddress(e.actor),purpose:e.purpose??null,
    resource:safeResource(e.resource),action:e.action??null,grantId:e.grantId??null,
    authorityHash:e.authorityHash??null,operationId:e.operationId??null,tool:e.tool??null,
    reason:e.reason??null,source:e.source??null,cause:e.cause??null,failClosed:e.failClosed??null,
    consumed:e.consumed??null,endedBy:e.endedBy??null
  };
  return Object.fromEntries(Object.entries(out).filter(([,v])=>v!==null));
}
export function traceProof(store,traceId,{limit=100}={}){
  if(!TRACE.test(String(traceId??'')))return {service:'sledgewire.trace',state:'INCOMPATIBLE',reason:'invalid_trace_id'};
  if(!store||typeof store.auditTrace!=='function')return {service:'sledgewire.trace',state:'UNKNOWN',reason:'trace_store_unavailable',trace_id:traceId};
  const raw=store.auditTrace(traceId,limit),truncated=raw.length>limit,events=raw.slice(0,limit).map(sanitize);
  if(!events.length)return {service:'sledgewire.trace',state:'UNKNOWN',reason:'trace_not_found',trace_id:traceId};
  return {service:'sledgewire.trace',state:'READY',trace_id:traceId,event_count:events.length,truncated,events,events_sha256:sha256(events),
    non_claims:['target_semantic_truth','global_security','absence_of_vulnerabilities']};
}
