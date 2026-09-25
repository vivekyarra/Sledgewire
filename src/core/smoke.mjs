import {McpSession} from '../mcp/client.mjs';
import {sha256} from '../receipts/receipt.mjs';
import {summarize} from './state.mjs';
import {scanUntrusted} from '../security/content-scan.mjs';
import {toolSafety} from './tool-safety.mjs';

export async function smoke(endpoint,opts={}){
  const checks={};const started=Date.now();let tools=[];const s=new McpSession(endpoint,opts);
  try{const init=await s.initialize();checks.initialize={status:'pass',protocolVersion:init?.protocolVersion??null,server: init?.serverInfo??null};}catch(e){checks.initialize={status:'fail',reason:String(e.message||e)};return finish();}
  try{const listed=await s.listTools();tools=listed.tools;const scan=scanUntrusted(tools.map(t=>({name:t.name,description:t.description,inputSchema:t.inputSchema})));checks.discovery={status:scan.suspicious?'warn':(tools.length?'pass':'warn'),tool_count:tools.length,catalog_sha256:sha256(tools),untrusted_content:scan.suspicious,injection_markers:scan.hits};}catch(e){checks.discovery={status:'fail',reason:String(e.message||e)};return finish();}
  if(opts.probe?.name){const t=tools.find(x=>x.name===opts.probe.name);if(!t)checks.safe_probe={status:'fail',reason:'tool_not_found'};else{const safety=toolSafety(t,opts.probe);if(!safety.ok)checks.safe_probe={status:'security_block',reason:safety.reason};else try{const out=await s.callTool(t.name,opts.probe.arguments??{});const scan=scanUntrusted(out);checks.safe_probe={status:scan.suspicious?'warn':'pass',safety_source:safety.source,output_sha256:sha256(out),untrusted_content:scan.suspicious,injection_markers:scan.hits};}catch(e){checks.safe_probe={status:'fail',reason:String(e.message||e)};}}}
  else checks.safe_probe={status:'warn',reason:'not_requested'};
  return finish();
  function finish(){return {service:'sledgewire.smoke',endpoint,state:summarize(checks),duration_ms:Date.now()-started,checks,tools:tools.map(t=>({name:t.name,description:t.description??'',inputSchema:t.inputSchema??{},annotations:t.annotations??{}}))};}
}
