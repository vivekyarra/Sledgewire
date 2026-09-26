import {McpSession} from '../mcp/client.mjs';
import {summarize} from './state.mjs';
import {scanUntrusted} from '../security/content-scan.mjs';
import {toolSafety} from './tool-safety.mjs';

function rpcCode(error){const n=Number(error?.rpcCode);return Number.isFinite(n)?n:null;}
function expectedProtocolRejection(error,codes){const code=rpcCode(error);return code!==null&&codes.includes(code);}
function explicitTargetRejection(error){return rpcCode(error)!==null||String(error?.message??error).startsWith('target_tool_error:');}

export async function assay(endpoint,opts={}){
  const checks={},started=Date.now();let tools=[];const s=new McpSession(endpoint,opts);
  try{await s.initialize();checks.initialize={status:'pass'};}catch(e){checks.initialize={status:'fail',reason:String(e.message||e)};return finish();}
  try{tools=(await s.listTools()).tools;const scan=scanUntrusted(tools);checks.discovery={status:scan.suspicious?'warn':'pass',tool_count:tools.length,untrusted_content:scan.suspicious,injection_markers:scan.hits};}
  catch(e){checks.discovery={status:'fail',reason:String(e.message||e)};return finish();}

  if(opts.probe?.authorizeUnknownToolProbe===true){
    try{
      await s.callTool('__sledgewire_nonexistent__',{});
      checks.unknown_tool={status:'fail',reason:'server_accepted_unknown_tool'};
    }catch(e){
      checks.unknown_tool=expectedProtocolRejection(e,[-32601,-32602])
        ?{status:'pass',reason:String(e.message||e)}
        :{status:'unknown',reason:`non_conclusive_error:${String(e.message||e)}`};
    }
  }else checks.unknown_tool={status:'unknown',reason:'unknown_tool_probe_not_authorized'};

  const candidate=opts.probe?.name?tools.find(t=>t.name===opts.probe.name):null;
  if(candidate){
    const safety=toolSafety(candidate,opts.probe);
    if(!safety.ok){
      checks.invalid_arguments={status:'security_block',reason:safety.reason};
      checks.replay={status:'security_block',reason:safety.reason};
    }else{
      if(candidate.inputSchema?.additionalProperties===false){
        try{
          await s.callTool(candidate.name,{...(opts.probe.arguments??{}),__unexpected_sledgewire_field__:true});
          checks.invalid_arguments={status:'warn',reason:'server_accepted_schema_forbidden_field'};
        }catch(e){
          checks.invalid_arguments=expectedProtocolRejection(e,[-32602])
            ?{status:'pass',reason:String(e.message||e)}
            :{status:'unknown',reason:`non_conclusive_error:${String(e.message||e)}`};
        }
      }else checks.invalid_arguments={status:'unknown',reason:'schema_does_not_forbid_extra_fields'};

      try{
        const a=await s.callTool(candidate.name,opts.probe.arguments??{},{id:'sledgewire-replay-probe'});
        const b=await s.callTool(candidate.name,opts.probe.arguments??{},{id:'sledgewire-replay-probe'});
        const same=JSON.stringify(a)===JSON.stringify(b);
        checks.replay={status:(candidate.annotations?.idempotentHint===true&&!same)?'warn':'pass',reason:same?'duplicate_is_stable':'duplicate_differs',same_result:same};
      }catch(e){
        checks.replay=explicitTargetRejection(e)
          ?{status:'pass',reason:`duplicate_refused:${String(e.message||e)}`}
          :{status:'unknown',reason:`non_conclusive_transport_error:${String(e.message||e)}`};
      }
    }
  }else{
    checks.invalid_arguments={status:'unknown',reason:'no_probe'};
    checks.replay={status:'unknown',reason:'no_probe'};
  }
  return finish();
  function finish(){return {service:'sledgewire.assay',endpoint,state:summarize(checks),duration_ms:Date.now()-started,checks};}
}
