import {McpSession} from '../mcp/client.mjs';
import {boundedRepair,inspectRepair} from './repair.mjs';
import {sha256} from '../receipts/receipt.mjs';
import {scanUntrusted} from '../security/content-scan.mjs';

export async function prepareInvoke(endpoint,request,opts={}){
  const s=new McpSession(endpoint,opts);await s.initialize();const tools=(await s.listTools()).tools;const tool=tools.find(t=>t.name===request.name);if(!tool)return {state:'INCOMPATIBLE',reason:'tool_not_found'};
  const scan=scanUntrusted({description:tool.description,inputSchema:tool.inputSchema});
  if(tool.annotations?.destructiveHint===true&&request.authorizeDestructive!==true)return {state:'BLOCKED',reason:'destructive_tool_requires_explicit_authority',tool};
  const repair=boundedRepair(request.arguments??{},tool.inputSchema??{},request.evidence??{});if(repair.status!=='repaired')return {state:'INCOMPATIBLE',reason:'repair_unavailable',repair,tool};
  const inspector=inspectRepair(request.arguments??{},repair,tool.inputSchema??{},request.evidence??{});if(inspector.status!=='pass')return {state:'BLOCKED',reason:'independent_inspection_failed',repair,inspector,tool};
  return {state:'READY',session:s,tool,repair,inspector,untrusted_tool_metadata:scan.suspicious,metadata_markers:scan.hits};
}
export async function invoke(endpoint,request,opts={}){
  const prepared=await prepareInvoke(endpoint,request,opts);if(prepared.state!=='READY')return {service:'sledgewire.invoke',...prepared,session:undefined};
  let result;try{result=await prepared.session.callTool(prepared.tool.name,prepared.repair.args);}catch(e){return {service:'sledgewire.invoke',state:'INCOMPATIBLE',repair:prepared.repair,inspector:prepared.inspector,reason:String(e.message||e)};}
  const scan=scanUntrusted(result);
  const degraded=prepared.untrusted_tool_metadata||scan.suspicious;
  return {service:'sledgewire.invoke',state:degraded?'DEGRADED':'READY',repair:prepared.repair,inspector:prepared.inspector,untrusted_tool_metadata:prepared.untrusted_tool_metadata,metadata_markers:prepared.metadata_markers,result_untrusted_content:scan.suspicious,result_markers:scan.hits,result,result_sha256:sha256(result)};
}
