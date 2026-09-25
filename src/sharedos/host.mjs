import {CapabilityAuthorizer,SharedOSKernel} from '@aicoo/sharedos';
import {smoke} from '../core/smoke.mjs';
import {assay} from '../core/assay.mjs';
import {seal} from '../core/seal.mjs';
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
function exactTargetPath(endpoint,kind,name){return ['targets',endpointHash(endpoint),kind,String(name??'discovery')];}
function toolTargetRequirement(context,call){return {resource:{namespace:NS,path:exactTargetPath(call.arguments.endpoint,'tool',call.arguments.name),owner:context.owner},action:'invoke'};}
function workflowRequirement(workflow){return (context,call)=>({resource:{namespace:NS,path:exactTargetPath(call.arguments.endpoint,'workflow',`${workflow}:${call.arguments.probe?.name??'discovery'}`),owner:context.owner},action:'invoke'});}

export function createKernel(store){
  const kernel=new SharedOSKernel({grantSource:store,authorizer:new CapabilityAuthorizer({usageStore:store}),audit:store});
  kernel.registerTool(handler({...def('sledgewire.target.smoke','Exact-target bounded Smoke workflow.',['targets']),requiredCapability:{resource:{namespace:NS,path:[]},action:'invoke'}},async a=>smoke(a.endpoint,{probe:a.probe}),workflowRequirement('smoke')));
  kernel.registerTool(handler({...def('sledgewire.target.assay','Exact-target adversarial Assay workflow.',['targets']),requiredCapability:{resource:{namespace:NS,path:[]},action:'invoke'}},async a=>assay(a.endpoint,{probe:a.probe}),workflowRequirement('assay')));
  kernel.registerTool(handler({...def('sledgewire.target.seal','Exact-target conformance Seal workflow.',['targets']),requiredCapability:{resource:{namespace:NS,path:[]},action:'invoke'}},async a=>seal(a.endpoint,{probe:a.probe}),workflowRequirement('seal')));
  kernel.registerTool(handler({...def('sledgewire.target.gauntlet','Exact-target Gauntlet dossier without real invocation.',['targets']),requiredCapability:{resource:{namespace:NS,path:[]},action:'invoke'}},async a=>gauntlet(a.endpoint,{probe:a.probe}),workflowRequirement('gauntlet')));
  kernel.registerTool(handler({...def('sledgewire.stage.scout','Discover one exact target tool.',['stage','scout']),requiredCapability:{resource:{namespace:NS,path:[]},action:'invoke'}},async a=>{
    const s=new McpSession(a.endpoint,{});await s.initialize();const tools=(await s.listTools()).tools,tool=tools.find(t=>t.name===a.name);
    if(!tool)return {state:'INCOMPATIBLE',reason:'tool_not_found'};
    const scan=scanUntrusted({description:tool.description,inputSchema:tool.inputSchema});
    return {state:'READY',tool:{name:tool.name,description:tool.description??'',inputSchema:tool.inputSchema??{},annotations:tool.annotations??{}},untrusted_metadata:scan.suspicious,markers:scan.hits};
  },toolTargetRequirement));
  kernel.registerTool(handler(def('sledgewire.stage.mechanic','Produce an evidence-bounded candidate repair.',['stage','mechanic'],'write'),async a=>boundedRepair(a.arguments??{},a.schema??{},a.evidence??{})));
  kernel.registerTool(handler(def('sledgewire.stage.inspector','Independently validate a candidate repair.',['stage','inspector']),async a=>inspectRepair(a.original??{},a.repair,a.schema??{},a.evidence??{})));
  kernel.registerTool(handler({...def('sledgewire.stage.breaker','Invoke one exact inspected target tool.',['stage','breaker'],'write'),requiredCapability:{resource:{namespace:NS,path:[]},action:'invoke'}},async a=>{
    const s=new McpSession(a.endpoint,{});await s.initialize();const result=await s.callTool(a.name,a.arguments??{}),scan=scanUntrusted(result);
    return {state:scan.suspicious?'DEGRADED':'READY',result,result_sha256:sha256(result),untrusted_content:scan.suspicious,markers:scan.hits};
  },toolTargetRequirement));
  return kernel;
}
function grant({id,subject,path,maxUses=1}){return {id,namespaceId:NS,subject,issuer:HOST,capabilities:[{resource:{namespace:NS,path,owner:HOST},actions:['invoke'],scope:'exact'}],constraints:{purposes:[PURPOSE],maxUses},issuedAt:new Date().toISOString()};}
function context(actor,traceId){return {namespaceId:NS,actor,authority:HOST,owner:HOST,purpose:PURPOSE,traceId,enabledToolNamespaces:[NS],now:new Date().toISOString()};}
async function invokeTool(kernel,ctx,tool,args){const result=await kernel.invokeTool(ctx,{id:crypto.randomUUID(),tool,arguments:args,traceId:ctx.traceId,requestedAt:new Date().toISOString()});if(result.status!=='succeeded')throw new Error(`sharedos_${result.status}:${result.error?.code??'unknown'}`);return result.output;}
function issue(store,g){store.storeGrant(NS,g);}
function worstState(...states){for(const s of ['BLOCKED','INCOMPATIBLE','DEGRADED','UNKNOWN'])if(states.includes(s))return s;return 'READY';}
function workflowPath(endpoint,workflow,probe){return exactTargetPath(endpoint,'workflow',`${workflow}:${probe?.name??'discovery'}`);}

async function stagedInvoke({kernel,store,requestId,traceId,endpoint,request,prefix='invoke'}){
  if(!endpoint||!request?.name)return {state:'INCOMPATIBLE',details:{reason:'invoke_requires_endpoint_and_request'}};
  issue(store,grant({id:`g-${requestId}-${prefix}-scout`,subject:ROLES.scout,path:exactTargetPath(endpoint,'tool',request.name)}));
  const scout=await invokeTool(kernel,context(ROLES.scout,traceId),'sledgewire.stage.scout',{endpoint,name:request.name});
  if(scout.state!=='READY')return {state:scout.state,details:{scout}};
  if(scout.tool.annotations?.destructiveHint===true&&request.authorizeDestructive!==true)return {state:'BLOCKED',details:{scout,reason:'destructive_tool_requires_explicit_authority'}};
  issue(store,grant({id:`g-${requestId}-${prefix}-mechanic`,subject:ROLES.mechanic,path:['stage','mechanic']}));
  const repair=await invokeTool(kernel,context(ROLES.mechanic,traceId),'sledgewire.stage.mechanic',{arguments:request.arguments??{},schema:scout.tool.inputSchema,evidence:request.evidence??{}});
  if(repair.status!=='repaired')return {state:'INCOMPATIBLE',details:{scout,repair}};
  issue(store,grant({id:`g-${requestId}-${prefix}-inspector`,subject:ROLES.inspector,path:['stage','inspector']}));
  const inspector=await invokeTool(kernel,context(ROLES.inspector,traceId),'sledgewire.stage.inspector',{original:request.arguments??{},repair,schema:scout.tool.inputSchema,evidence:request.evidence??{}});
  if(inspector.status!=='pass')return {state:'BLOCKED',details:{scout,repair,inspector}};
  issue(store,grant({id:`g-${requestId}-${prefix}-breaker`,subject:ROLES.breaker,path:exactTargetPath(endpoint,'tool',request.name)}));
  const execution=await invokeTool(kernel,context(ROLES.breaker,traceId),'sledgewire.stage.breaker',{endpoint,name:request.name,arguments:repair.args});
  return {state:worstState(scout.untrusted_metadata?'DEGRADED':'READY',execution.state),details:{scout,repair,inspector,execution}};
}
async function exactWorkflow({kernel,store,requestId,traceId,workflow,endpoint,probe,index=null}){
  if(!endpoint)return {service:`sledgewire.${workflow}`,endpoint,state:'INCOMPATIBLE',reason:'endpoint_required'};
  const suffix=index===null?workflow:`${workflow}-${index}`;
  issue(store,grant({id:`g-${requestId}-${suffix}-target`,subject:ROLES.breaker,path:workflowPath(endpoint,workflow,probe)}));
  return invokeTool(kernel,context(ROLES.breaker,traceId),`sledgewire.target.${workflow}`,{endpoint,probe});
}
async function exactFleet({kernel,store,requestId,traceId,targets}){
  if(!Array.isArray(targets)||targets.length<1||targets.length>6)throw new Error('fleet_targets_must_be_1_to_6');
  const reports=new Array(targets.length);let next=0;
  async function worker(){for(;;){const i=next++;if(i>=targets.length)return;const t=targets[i];try{reports[i]=await exactWorkflow({kernel,store,requestId,traceId,workflow:'smoke',endpoint:t.endpoint,probe:t.probe,index:i});}catch(e){reports[i]={service:'sledgewire.smoke',endpoint:t?.endpoint,state:'UNKNOWN',reason:String(e.message||e)};}}}
  await Promise.all(Array.from({length:Math.min(3,targets.length)},worker));
  return {service:'sledgewire.fleet',state:reports.every(r=>r.state==='READY')?'READY':'DEGRADED',reports};
}

export async function runPaidService({service,input,store,requestId,fingerprint,buyerSeat}){
  const kernel=createKernel(store),traceId=crypto.randomUUID();let output;
  if(service==='sledgewire.invoke'){
    const staged=await stagedInvoke({kernel,store,requestId,traceId,endpoint:input.endpoint,request:input.request});
    return {service,state:staged.state,result:staged.details,sharedos_trace_id:traceId,buyer_seat:buyerSeat,request_fingerprint:fingerprint};
  }
  if(service==='sledgewire.fleet')output=await exactFleet({kernel,store,requestId,traceId,targets:input.targets});
  else{
    const short=service.split('.').at(-1);if(!['smoke','assay','seal','gauntlet'].includes(short))throw new Error('unsupported_paid_service');
    output=await exactWorkflow({kernel,store,requestId,traceId,workflow:short,endpoint:input.endpoint,probe:input.probe});
    if(service==='sledgewire.gauntlet'&&input.request){
      const staged=await stagedInvoke({kernel,store,requestId,traceId,endpoint:input.endpoint,request:input.request,prefix:'gauntlet'});
      const {dossier_sha256:oldHash,...base}=output,rebuilt={...base,state:worstState(output.state,staged.state),execution:staged.details};
      output={...rebuilt,dossier_sha256:sha256(rebuilt)};
    }
  }
  return {service,state:output.state??'UNKNOWN',result:output,sharedos_trace_id:traceId,buyer_seat:buyerSeat,request_fingerprint:fingerprint};
}
