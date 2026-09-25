export function toolSafety(tool,probe={}){
  const ann=tool?.annotations??{};
  if(probe.safe!==true)return {ok:false,reason:'explicit_safe_probe_attestation_required'};
  if(ann.destructiveHint===true&&probe.authorizeDestructive!==true)return {ok:false,reason:'destructive_probe_not_authorized'};
  if(ann.destructiveHint===true)return {ok:true,source:'caller_safe_and_destructive_authority'};
  if(ann.readOnlyHint===true)return {ok:true,source:'caller_safe_attestation_plus_readonly_hint'};
  if(ann.idempotentHint===true)return {ok:true,source:'caller_safe_attestation_plus_idempotent_hint'};
  return {ok:true,source:'caller_safe_probe_attestation'};
}
