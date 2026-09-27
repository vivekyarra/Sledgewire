import catalog from '../../catalog.json' with {type:'json'};
import {validateServiceInput} from './service-input.mjs';

export const QUOTE_INTENTS=['preflight','adversarial','repair_execute','compare','certify','full_dossier'];
export const QUOTE_INTENT_ALIASES={
  preflight:'preflight',check:'preflight',test:'preflight',smoke:'preflight',
  adversarial:'adversarial',security:'adversarial',assay:'adversarial',attack:'adversarial',
  repair_execute:'repair_execute',repair:'repair_execute',invoke:'repair_execute',execute:'repair_execute',
  compare:'compare',fleet:'compare',choose:'compare',
  certify:'certify',seal:'certify',conformance:'certify',
  full_dossier:'full_dossier',dossier:'full_dossier',gauntlet:'full_dossier',review:'full_dossier'
};
const ROUTES={
  preflight:'sledgewire.smoke',
  adversarial:'sledgewire.assay',
  repair_execute:'sledgewire.invoke',
  compare:'sledgewire.fleet',
  certify:'sledgewire.seal',
  full_dossier:'sledgewire.gauntlet'
};

export function normalizeQuoteIntent(value='preflight'){
  const key=String(value??'preflight').trim().toLowerCase().replace(/[\s-]+/g,'_');
  const intent=QUOTE_INTENT_ALIASES[key];
  if(!intent)throw new Error('unsupported_quote_intent');
  return {requested_intent:key,intent};
}

export function quote({intent='preflight',endpoint=null,targets=null,tool=null}={}){
  const normalized=normalizeQuoteIntent(intent),canonicalIntent=normalized.intent;
  const service=ROUTES[canonicalIntent],price=catalog.services[service].price;
  let input;
  if(service==='sledgewire.fleet')input={targets:Array.isArray(targets)?targets:[]};
  else if(service==='sledgewire.invoke')input={endpoint,request:{name:tool??'<tool>',arguments:{},evidence:{}}};
  else if(service==='sledgewire.gauntlet')input={endpoint,probe:tool?{name:tool,arguments:{},safe:false}:undefined};
  else input={endpoint,...(tool?{probe:{name:tool,arguments:{},safe:false}}:{})};
  const missing_fields=[];
  if(service==='sledgewire.fleet'){if(!Array.isArray(targets)||targets.length<1)missing_fields.push('targets');}
  else{if(typeof endpoint!=='string'||!endpoint)missing_fields.push('endpoint');if(service==='sledgewire.invoke'&&(typeof tool!=='string'||!tool))missing_fields.push('tool');}
  const validation=missing_fields.length?{ok:false,reason:'missing_required_quote_context'}:validateServiceInput(service,input);
  return {
    service:'sledgewire.quote',
    requested_intent:normalized.requested_intent,
    intent:canonicalIntent,
    matched_rule:normalized.requested_intent===canonicalIntent?'canonical_intent':'intent_alias',
    recommended_service:service,
    price_credits:price,
    request_ready:validation.ok,
    missing_fields,
    input_validation:validation,
    reason:{
      preflight:'Lowest-cost check before trusting or paying a service.',
      adversarial:'Use when protocol, replay, malformed-input, or hostile-output behavior matters.',
      repair_execute:'Use when a real invocation is blocked by a structural schema mismatch and evidence is available.',
      compare:'Use when choosing among several candidate services.',
      certify:'Use when a seller wants a portable reproducible conformance packet.',
      full_dossier:'Use when a seller wants the strongest one-purchase dossier for peer review and buyer confidence.'
    }[canonicalIntent],
    value_proof:{signed_receipt:true,sharedos_trace:true,exact_retry_no_reexecution:true},
    request_template:{type:'sledgewire.service.request.v1',request_id:'<buyer-unique-id>',service,input}
  };
}
