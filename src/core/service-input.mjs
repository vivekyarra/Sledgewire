import net from 'node:net';
import {isBlockedIp} from '../security/target-policy.mjs';

const MAX_DEPTH=24,MAX_NODES=4096,MAX_STRING_BYTES=32768,MAX_CONTAINER_KEYS=256;
const PAID=new Set(['sledgewire.smoke','sledgewire.assay','sledgewire.invoke','sledgewire.fleet','sledgewire.seal','sledgewire.gauntlet']);

function plainObject(x){if(!x||typeof x!=='object'||Array.isArray(x))return false;const p=Object.getPrototypeOf(x);return p===Object.prototype||p===null;}
function onlyKeys(obj,allowed){return Object.keys(obj).every(k=>allowed.has(k));}
function bounds(value){
  const seen=new WeakSet(),stack=[{value,depth:0}];let nodes=0,stringBytes=0;
  while(stack.length){
    const {value:v,depth}=stack.pop();nodes++;if(nodes>MAX_NODES)return {ok:false,reason:'json_node_limit'};
    if(depth>MAX_DEPTH)return {ok:false,reason:'json_depth_limit'};
    if(typeof v==='string'){stringBytes+=Buffer.byteLength(v);if(stringBytes>MAX_STRING_BYTES)return {ok:false,reason:'json_string_budget'};continue;}
    if(v===null||typeof v==='number'||typeof v==='boolean')continue;
    if(typeof v!=='object')return {ok:false,reason:'json_value_type'};
    if(seen.has(v))return {ok:false,reason:'json_cycle'};seen.add(v);
    if(Array.isArray(v)){
      if(v.length>MAX_CONTAINER_KEYS)return {ok:false,reason:'json_array_limit'};
      for(let i=v.length-1;i>=0;i--)stack.push({value:v[i],depth:depth+1});
    }else{
      const keys=Object.keys(v);if(keys.length>MAX_CONTAINER_KEYS)return {ok:false,reason:'json_object_key_limit'};
      for(const k of keys){stringBytes+=Buffer.byteLength(k);if(stringBytes>MAX_STRING_BYTES)return {ok:false,reason:'json_string_budget'};stack.push({value:v[k],depth:depth+1});}
    }
  }
  return {ok:true};
}
function endpoint(value){
  if(typeof value!=='string'||value.length<8||value.length>2048)return {ok:false,reason:'endpoint_length'};
  let u;try{u=new URL(value);}catch{return {ok:false,reason:'endpoint_url'};}
  if(u.protocol!=='https:')return {ok:false,reason:'endpoint_https_required'};
  if(u.username||u.password)return {ok:false,reason:'endpoint_userinfo'};
  if(u.hash)return {ok:false,reason:'endpoint_fragment'};
  if(!u.hostname)return {ok:false,reason:'endpoint_hostname'};
  const host=u.hostname.replace(/^\[|\]$/g,'');
  if(host==='localhost'||host.endsWith('.localhost'))return {ok:false,reason:'endpoint_private'};
  if(net.isIP(host)&&isBlockedIp(host))return {ok:false,reason:'endpoint_private'};
  return {ok:true};
}
function probe(value){
  if(value===undefined)return {ok:true};
  if(!plainObject(value)||!onlyKeys(value,new Set(['name','arguments','safe','authorizeDestructive','authorizeUnknownToolProbe'])))return {ok:false,reason:'probe_shape'};
  if(value.name!==undefined&&(typeof value.name!=='string'||value.name.length<1||value.name.length>256))return {ok:false,reason:'probe_name'};
  if(value.arguments!==undefined&&!plainObject(value.arguments))return {ok:false,reason:'probe_arguments'};
  if(value.safe!==undefined&&typeof value.safe!=='boolean')return {ok:false,reason:'probe_safe'};
  if(value.authorizeDestructive!==undefined&&typeof value.authorizeDestructive!=='boolean')return {ok:false,reason:'probe_destructive_authority'};
  if(value.authorizeUnknownToolProbe!==undefined&&typeof value.authorizeUnknownToolProbe!=='boolean')return {ok:false,reason:'probe_unknown_tool_authority'};
  return {ok:true};
}
function invokeRequest(value){
  if(!plainObject(value)||!onlyKeys(value,new Set(['name','arguments','evidence','authorizeDestructive'])))return {ok:false,reason:'invoke_request_shape'};
  if(typeof value.name!=='string'||value.name.length<1||value.name.length>256)return {ok:false,reason:'invoke_tool_name'};
  if(value.arguments!==undefined&&!plainObject(value.arguments))return {ok:false,reason:'invoke_arguments'};
  if(value.evidence!==undefined&&!plainObject(value.evidence))return {ok:false,reason:'invoke_evidence'};
  if(value.authorizeDestructive!==undefined&&typeof value.authorizeDestructive!=='boolean')return {ok:false,reason:'invoke_destructive_authority'};
  return {ok:true};
}
function target(value){
  if(!plainObject(value)||!onlyKeys(value,new Set(['endpoint','probe'])))return {ok:false,reason:'fleet_target_shape'};
  const e=endpoint(value.endpoint);if(!e.ok)return e;return probe(value.probe);
}
export function validateServiceInput(service,input){
  if(!PAID.has(service))return {ok:false,reason:'unsupported_service'};
  if(!plainObject(input))return {ok:false,reason:'input_object_required'};
  const b=bounds(input);if(!b.ok)return b;
  if(service==='sledgewire.fleet'){
    if(!onlyKeys(input,new Set(['targets'])))return {ok:false,reason:'fleet_top_level_fields'};
    if(!Array.isArray(input.targets)||input.targets.length<1||input.targets.length>6)return {ok:false,reason:'fleet_targets_1_to_6'};
    for(const t of input.targets){const r=target(t);if(!r.ok)return r;}return {ok:true};
  }
  const allowed=service==='sledgewire.invoke'?new Set(['endpoint','request']):service==='sledgewire.gauntlet'?new Set(['endpoint','probe','request']):new Set(['endpoint','probe']);
  if(!onlyKeys(input,allowed))return {ok:false,reason:'unexpected_top_level_field'};
  const e=endpoint(input.endpoint);if(!e.ok)return e;
  if(service==='sledgewire.invoke')return invokeRequest(input.request);
  const p=probe(input.probe);if(!p.ok)return p;
  if(service==='sledgewire.gauntlet'&&input.request!==undefined)return invokeRequest(input.request);
  return {ok:true};
}
