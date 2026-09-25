export function toolSafety(tool,probe={}){
  const ann=tool?.annotations??{};
  if(ann.destructiveHint===true && probe.authorizeDestructive!==true)return {ok:false,reason:'destructive_probe_not_authorized'};
  if(ann.readOnlyHint===true || ann.idempotentHint===true)return {ok:true,source:'tool_annotation'};
  if(probe.safe===true)return {ok:true,source:'caller_safe_probe_attestation'};
  return {ok:false,reason:'probe_safety_not_established'};
}
