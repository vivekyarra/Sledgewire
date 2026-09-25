import catalog from '../../catalog.json' with {type:'json'};
import {smoke} from '../core/smoke.mjs';
import {assay} from '../core/assay.mjs';
import {invoke} from '../core/invoke.mjs';
import {seal} from '../core/seal.mjs';
import {fleet} from '../core/fleet.mjs';
import {gauntlet} from '../core/gauntlet.mjs';
import {quote} from '../core/quote.mjs';
import {selfcheck} from '../core/selfcheck.mjs';
import {loadSigningMaterial,signReceipt,verifyReceipt} from '../receipts/receipt.mjs';

export const MODERN_PROTOCOL_VERSION='2026-07-28';
export const LEGACY_PROTOCOL_VERSION='2025-11-25';
export const SUPPORTED_PROTOCOL_VERSIONS=[MODERN_PROTOCOL_VERSION,LEGACY_PROTOCOL_VERSION,'2025-06-18'];
const META_VERSION='io.modelcontextprotocol/protocolVersion';
const META_SERVER='io.modelcontextprotocol/serverInfo';
const SERVER_INFO={name:'sledgewire',version:'0.3.4'};

const signing=loadSigningMaterial();
export const PUBLIC=signing.publicKeyPem;
export const PUBLIC_KEY_ID=signing.keyId;
const schemaEndpoint={type:'string',minLength:8,maxLength:2048};
const schemaProbe={type:'object'};
const PAID=new Set(['sledgewire.smoke','sledgewire.assay','sledgewire.invoke','sledgewire.fleet','sledgewire.seal','sledgewire.gauntlet']);

export const toolDefs=[
 {name:'sledgewire.quote',description:'Free deterministic selector that returns the right Sledgewire service, exact price, and request template.',inputSchema:{type:'object',additionalProperties:false,required:['intent'],properties:{intent:{type:'string',enum:['preflight','adversarial','repair_execute','compare','certify','full_dossier']},endpoint:schemaEndpoint,targets:{type:'array',maxItems:6},tool:{type:'string'}}}},
 {name:'sledgewire.selfcheck',description:'Free hostile-fixture demonstration of Sledgewire fail-closed behavior with a signed receipt.',inputSchema:{type:'object',additionalProperties:false,properties:{}}},
 {name:'sledgewire.smoke',description:'Paid Arena service: discover and safely smoke-test a remote MCP endpoint.',inputSchema:{type:'object',additionalProperties:false,required:['endpoint'],properties:{endpoint:schemaEndpoint,probe:schemaProbe}}},
 {name:'sledgewire.assay',description:'Paid Arena service: run bounded adversarial MCP protocol checks.',inputSchema:{type:'object',additionalProperties:false,required:['endpoint'],properties:{endpoint:schemaEndpoint,probe:schemaProbe}}},
 {name:'sledgewire.invoke',description:'Paid Arena service: bounded schema repair, independent validation, then invocation.',inputSchema:{type:'object',additionalProperties:false,required:['endpoint','request'],properties:{endpoint:schemaEndpoint,request:{type:'object'}}}},
 {name:'sledgewire.fleet',description:'Paid Arena service: smoke-test up to six candidate MCP services.',inputSchema:{type:'object',additionalProperties:false,required:['targets'],properties:{targets:{type:'array',minItems:1,maxItems:6}}}},
 {name:'sledgewire.seal',description:'Paid Arena service: run the v3 conformance profile and return a portable signed packet.',inputSchema:{type:'object',additionalProperties:false,required:['endpoint'],properties:{endpoint:schemaEndpoint,probe:schemaProbe}}},
 {name:'sledgewire.gauntlet',description:'Paid Arena service: seller-grade dossier with smoke, assay, optional SharedOS-staged invocation, and conformance evidence.',inputSchema:{type:'object',additionalProperties:false,required:['endpoint'],properties:{endpoint:schemaEndpoint,probe:schemaProbe,request:{type:'object'}}}},
 {name:'sledgewire.verify',description:'Free: verify a Sledgewire Ed25519 receipt.',inputSchema:{type:'object',additionalProperties:false,required:['receipt','publicKeyPem'],properties:{receipt:{type:'object'},publicKeyPem:{type:'string'}}}}
];

export async function handleTool(name,args={},internalOpts={}){
  if(name==='sledgewire.verify')return verifyReceipt(args.receipt,args.publicKeyPem);
  if(internalOpts.publicArena===true&&PAID.has(name)){
    const price=catalog.services[name].price;
    return signReceipt({service:name,state:'PAYMENT_REQUIRED',price_credits:price,arena_room_id:internalOpts.arenaRoomId??null,
      quickstart_url:internalOpts.publicBaseUrl?`${String(internalOpts.publicBaseUrl).replace(/\/$/,'')}/arena.md`:null,
      request_template:{type:'sledgewire.service.request.v1',request_id:'<buyer-unique-id>',service:name,input:args},
      note:'Paid Arena services execute only after native SharedNet payment verification. Send this request in the official Arena Room first without payment; Sledgewire returns the exact request-bound memo and payee.'},signing.privateKeyPem);
  }
  const opts={...internalOpts,targetPolicy:internalOpts.targetPolicy??{allowHttp:false,allowPrivate:false}};
  let payload;
  if(name==='sledgewire.quote')payload=quote(args);
  else if(name==='sledgewire.selfcheck')payload=await selfcheck();
  else if(name==='sledgewire.smoke')payload=await smoke(args.endpoint,{...opts,probe:args.probe});
  else if(name==='sledgewire.assay')payload=await assay(args.endpoint,{...opts,probe:args.probe});
  else if(name==='sledgewire.invoke')payload=await invoke(args.endpoint,args.request,opts);
  else if(name==='sledgewire.fleet')payload=await fleet(args.targets,opts);
  else if(name==='sledgewire.seal')payload=await seal(args.endpoint,{...opts,probe:args.probe});
  else if(name==='sledgewire.gauntlet')payload=await gauntlet(args.endpoint,{...opts,probe:args.probe,request:args.request});
  else throw new Error('tool_not_found');
  return signReceipt({...payload,issued_at:new Date().toISOString(),receipt_version:'sledgewire.receipt.v3'},signing.privateKeyPem);
}
function modernResult(result){return {...result,_meta:{...(result?._meta??{}),[META_SERVER]:SERVER_INFO}};}
function rpcError(id,code,message,data){return {jsonrpc:'2.0',id:id??null,error:{code,message,...(data===undefined?{}:{data})}};}
function requestVersion(msg){return msg?.params?._meta?.[META_VERSION]??null;}
function headerValue(headers,name){const v=headers[name]??headers[name.toLowerCase()]??null;return Array.isArray(v)?v[0]:v;}
function requestPrincipalName(msg){
  if(msg?.method==='tools/call'||msg?.method==='prompts/get')return msg?.params?.name??null;
  if(msg?.method==='resources/read')return msg?.params?.uri??null;
  return null;
}

export function validateHttpMcp(msg,headers={}){
  const bodyVersion=requestVersion(msg),headerVersion=headerValue(headers,'mcp-protocol-version');
  const modern=bodyVersion===MODERN_PROTOCOL_VERSION||headerVersion===MODERN_PROTOCOL_VERSION;
  if(modern&&bodyVersion!==headerVersion)return {ok:false,status:400,body:rpcError(msg?.id,-32020,'HeaderMismatch',{header:'Mcp-Protocol-Version',wire:headerVersion??null,body:bodyVersion??null})};
  const requested=bodyVersion??headerVersion;
  if(requested&&!SUPPORTED_PROTOCOL_VERSIONS.includes(requested))return {ok:false,status:400,body:rpcError(msg?.id,-32022,'UnsupportedProtocolVersion',{requested,supported:SUPPORTED_PROTOCOL_VERSIONS})};
  if(modern){
    const session=headerValue(headers,'mcp-session-id');if(session)return {ok:false,status:400,body:rpcError(msg?.id,-32020,'HeaderMismatch',{header:'Mcp-Session-Id',reason:'removed_in_2026_07_28'})};
    const methodHeader=headerValue(headers,'mcp-method');if(methodHeader&&methodHeader!==msg?.method)return {ok:false,status:400,body:rpcError(msg?.id,-32020,'HeaderMismatch',{header:'Mcp-Method',wire:methodHeader,body:msg?.method??null})};
    const nameHeader=headerValue(headers,'mcp-name');const bodyName=requestPrincipalName(msg);
    if(nameHeader&&nameHeader!==bodyName)return {ok:false,status:400,body:rpcError(msg?.id,-32020,'HeaderMismatch',{header:'Mcp-Name',wire:nameHeader,body:bodyName})};
  }
  return {ok:true,status:200};
}

export async function handleRpc(msg,internalOpts={}){
  if(msg?.jsonrpc!=='2.0')return rpcError(msg?.id,-32600,'Invalid Request');
  const version=requestVersion(msg),modern=version===MODERN_PROTOCOL_VERSION;
  if(version&&!SUPPORTED_PROTOCOL_VERSIONS.includes(version))return rpcError(msg.id,-32022,'UnsupportedProtocolVersion',{requested:version,supported:SUPPORTED_PROTOCOL_VERSIONS});
  try{
    if(msg.method==='server/discover'){
      if(!modern)return rpcError(msg.id,-32602,'server/discover requires 2026-07-28 request metadata');
      return {jsonrpc:'2.0',id:msg.id,result:modernResult({resultType:'complete',supportedVersions:SUPPORTED_PROTOCOL_VERSIONS,capabilities:{tools:{}}})};
    }
    if(msg.method==='initialize'){
      if(modern)return rpcError(msg.id,-32601,'Method not found');
      const requested=msg.params?.protocolVersion,selected=SUPPORTED_PROTOCOL_VERSIONS.includes(requested)&&requested!==MODERN_PROTOCOL_VERSION?requested:LEGACY_PROTOCOL_VERSION;
      return {jsonrpc:'2.0',id:msg.id,result:{protocolVersion:selected,capabilities:{tools:{}},serverInfo:SERVER_INFO}};
    }
    if(msg.method==='notifications/initialized')return modern?rpcError(msg.id,-32601,'Method not found'):null;
    if(msg.method==='tools/list'){const result={tools:toolDefs};return {jsonrpc:'2.0',id:msg.id,result:modern?modernResult(result):result};}
    if(msg.method==='tools/call'){
      const result=await handleTool(msg.params?.name,msg.params?.arguments??{},internalOpts);
      const payload={content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result,isError:false};
      return {jsonrpc:'2.0',id:msg.id,result:modern?modernResult(payload):payload};
    }
    return rpcError(msg.id,-32601,'Method not found');
  }catch(e){return rpcError(msg.id,-32000,String(e.message||e));}
}
export {catalog};
