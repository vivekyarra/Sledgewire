import {CapabilityAuthorizer,SharedOSKernel} from '@aicoo/sharedos';
import {smoke} from '../core/smoke.mjs';
import {assay} from '../core/assay.mjs';
import {seal} from '../core/seal.mjs';
import {fleet} from '../core/fleet.mjs';
import {gauntlet} from '../core/gauntlet.mjs';
import {McpSession} from '../mcp/client.mjs';
import {boundedRepair,inspectRepair} from '../core/repair.mjs';
import {scanUntrusted} from '../security/content-scan.mjs';
import {sha256} from '../receipts/receipt.mjs';

export const PURPOSE='sledgewire.test-repair-and-invoke-agent-services';
export const HOST={kind:'human',userId:'sledgewire-host'};
export const ROLES=Object.freeze({
  dispatcher:{kind:'agent',agentId:'sledgewire-dispatcher'},
  scout:{kind:'agent',agentId:'sledgewire-scout'},
  breaker:{kind:'agent',agentId:'sledgewire-breaker'},
  mechanic:{kind:'agent',agentId:'sledgewire-mechanic'},
  inspector:{kind:'agent',agentId:'sledgewire-inspector'}
});
const NS='sledgewire';
function ok(call,output){return {callId:call.id,tool:call.tool,status:'succeeded',output,completedAt:new Date().toISOString()};}
function def(name,description,path,readWrite='read'){return {name,description,namespace:NS,source:'native',readWrite,inputSchema:{type:'object'},requiredCapability:{resource:{namespace:NS,path},action:'invoke'},annotations:{readOnly:readWrite==='read'}};}
function handler(definition,fn,resolveRequirement){return {definition,parseArguments:a=>a,...(resolveRequirement?{resolveRequirement}:{}),async invoke(context,call,signal){return ok(call,await fn(call.arguments,{signal,context}));}};}
function endpointHash(endpoint){return sha256(String(endpoint)).slice(0,32);}
function targetRequirement(context,call){const endpoint=String(call.arguments.endpoint??'');const tool=String(call.arguments.name??'discovery');return {resource:{namespace:NS,path:['targets',endpointHash(endpoint),tool],owner:context.owner},action:'invoke'};}

export function createKernel(store){
  const kernel=new SharedOSKernel({grantSource:store,authorizer:new CapabilityAuthorizer({usageStore:store}),audit:store});
  kernel.registerTool(handler(def('sledgewire.paid.smoke','Paid bounded Smoke workflow.',['services','smoke']),async a=>smoke(a.endpoint,{probe:a.probe})));
  kernel.registerTool(handler(def('sledgewire.paid.assay','Paid adversarial Assay workflow.',['services','assay']),async a=>assay(a.endpoint,{probe:a.probe})));
  kernel.registerTool(handler(def('sledgewire.paid.seal','Paid profile-versioned Seal workflow.',['services','seal']),async a=>seal(a.endpoint,{probe:a.probe})));
  kernel.registerTool(handler(def('sledgewire.paid.fleet','Paid bounded Fleet workflow.',['services','fleet']),async a=>fleet(a.targets??[],{})));
  kernel.registerTool(handler(def('sledgewire.paid.gauntlet','Paid full seller-grade dossier.',['services','gauntlet']),async a=>gauntlet(a.endpoint,{probe:a.probe,request:a.request})));
  kernel.registerTool(handler({...def('sledgewire.stage.scout','Discover one exact target tool.',['stage','scout']),requiredCapability:{resource:{namespace:NS,path:[]},action:'invoke'}},async a=>{const s=new McpSession(a.endpoint,{});await s.initialize();const tools=(await s.listTools()).tools;const tool=tools.find(t=>t.name===a.name);if(!tool)return {state:'INCOMPATIBLE',reason:'tool_not_found'};const scan=scanUntrusted({description:tool.description,inputSchema:tool.inputSchema});return {state:'READY',tool:{name:tool.name,description:tool.description??'',inputSchema:tool.inputSchema??{},annotations:tool.annotations??{}},untrusted_metadata:scan.suspicious,markers:scan.hits};},targetRequirement));
  kernel.registerTool(handler(def('sledgewire.stage.mechanic','Produce an evidence-bounded candidate repair.',['stage','mechanic'],'write'),async a=>boundedRepair(a.arguments??{},a.schema??{},a.evidence??{})));
  kernel.registerTool(handler(def('sledgewire.stage.inspector','Independently validate a candidate repair.',['stage','inspector']),async a=>inspectRepair(a.original??{},a.repair,a.schema??{},a.evidence??{})));
  kernel.registerTool(handler({...def('sledgewire.stage.breaker','Invoke one exact inspected target tool.',['stage','breaker'],'write'),requiredCapability:{resource:{namespace:NS,path:[]},action:'invoke'}},async a=>{const s=new McpSession(a.endpoint,{});await s.initialize();const result=await s.callTool(a.name,a.arguments??{});const scan=scanUntrusted(result);return {state:scan.suspicious?'DEGRADED':'READY',result,result_sha256:sha256(result),untrusted_content:scan.suspicious,markers:scan.hits};},targetRequirement));
  return kernel;
}
function grant({id,subject,path,maxUses=1}){return {id,namespaceId:NS,subject,issuer:HOST,capabilities:[{resource:{namespace:NS,path,owner:HOST},actions:['invoke'],scope:'exact'}],constraints:{purposes:[PURPOSE],maxUses},issuedAt:new Date().toISOString()};}
function context(actor,traceId){return {namespaceId:NS,actor,authority:HOST,owner:HOST,purpose:PURPOSE,traceId,enabledToolNamespaces:[NS],now:new Date().toISOString()};}
async function invokeTool(kernel,ctx,tool,args){const result=await kernel.invokeTool(ctx,{id:crypto.randomUUID(),tool,arguments:args,traceId:ctx.traceId,requestedAt:new Date().toISOString()});if(result.status!=='succeeded')throw new Error(`sharedos_${result.status}:${result.error?.code??'unknown'}`);return result.output;}
function issue(store,g){store.storeGrant(NS,g);}
export async function runPaidService({service,input,store,requestId,fingerprint,buyerSeat}){
  const kernel=createKernel(store);const traceId=crypto.randomUUID();
  if(service!=='sledgewire.invoke'){
    const short=service.split('.').at(-1);const allowed=new Set(['smoke','assay','seal','fleet','gauntlet']);if(!allowed.has(short))throw new Error('unsupported_paid_service');
    const tool=`sledgewire.paid.${short}`;issue(store,grant({id:`g-${requestId}-dispatcher`,subject:ROLES.dispatcher,path:['services',short]}));const output=await invokeTool(kernel,context(ROLES.dispatcher,traceId),tool,input);
    return {service,state:output.state??'UNKNOWN',result:output,sharedos_trace_id:traceId,buyer_seat:buyerSeat,request_fingerprint:fingerprint};
  }
  const endpoint=input.endpoint;const request=input.request;if(!endpoint||!request?.name)throw new Error('invoke_requires_endpoint_and_request');const h=endpointHash(endpoint);
  issue(store,grant({id:`g-${requestId}-scout`,subject:ROLES.scout,path:['targets',h,request.name]}));const scout=await invokeTool(kernel,context(ROLES.scout,traceId),'sledgewire.stage.scout',{endpoint,name:request.name});if(scout.state!=='READY')return {service,state:scout.state,result:{scout},sharedos_trace_id:traceId,request_fingerprint:fingerprint};
  issue(store,grant({id:`g-${requestId}-mechanic`,subject:ROLES.mechanic,path:['stage','mechanic']}));const repair=await invokeTool(kernel,context(ROLES.mechanic,traceId),'sledgewire.stage.mechanic',{arguments:request.arguments??{},schema:scout.tool.inputSchema,evidence:request.evidence??{}});if(repair.status!=='repaired')return {service,state:'INCOMPATIBLE',result:{scout,repair},sharedos_trace_id:traceId,request_fingerprint:fingerprint};
  issue(store,grant({id:`g-${requestId}-inspector`,subject:ROLES.inspector,path:['stage','inspector']}));const inspector=await invokeTool(kernel,context(ROLES.inspector,traceId),'sledgewire.stage.inspector',{original:request.arguments??{},repair,schema:scout.tool.inputSchema,evidence:request.evidence??{}});if(inspector.status!=='pass')return {service,state:'BLOCKED',result:{scout,repair,inspector},sharedos_trace_id:traceId,request_fingerprint:fingerprint};
  issue(store,grant({id:`g-${requestId}-breaker`,subject:ROLES.breaker,path:['targets',h,request.name]}));const execution=await invokeTool(kernel,context(ROLES.breaker,traceId),'sledgewire.stage.breaker',{endpoint,name:request.name,arguments:repair.args});
  return {service,state:execution.state,result:{scout,repair,inspector,execution},sharedos_trace_id:traceId,request_fingerprint:fingerprint};
}
