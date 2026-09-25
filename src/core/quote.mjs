import catalog from '../../catalog.json' with {type:'json'};

const ROUTES={
  preflight:'sledgewire.smoke',
  adversarial:'sledgewire.assay',
  repair_execute:'sledgewire.invoke',
  compare:'sledgewire.fleet',
  certify:'sledgewire.seal',
  full_dossier:'sledgewire.gauntlet'
};

export function quote({intent='preflight',endpoint=null,targets=null,tool=null}={}){
  const service=ROUTES[intent];
  if(!service)throw new Error('unsupported_quote_intent');
  const price=catalog.services[service].price;
  let input;
  if(service==='sledgewire.fleet')input={targets:Array.isArray(targets)?targets:[]};
  else if(service==='sledgewire.invoke')input={endpoint,request:{name:tool??'<tool>',arguments:{},evidence:{}}};
  else if(service==='sledgewire.gauntlet')input={endpoint,probe:tool?{name:tool,arguments:{},safe:false}:undefined};
  else input={endpoint,...(tool?{probe:{name:tool,arguments:{},safe:false}}:{})};
  return {
    service:'sledgewire.quote',
    intent,
    recommended_service:service,
    price_credits:price,
    reason:{
      preflight:'Lowest-cost check before trusting or paying a service.',
      adversarial:'Use when protocol, replay, malformed-input, or hostile-output behavior matters.',
      repair_execute:'Use when a real invocation is blocked by a structural schema mismatch and evidence is available.',
      compare:'Use when choosing among several candidate services.',
      certify:'Use when a seller wants a portable reproducible conformance packet.',
      full_dossier:'Use when a seller wants the strongest one-purchase dossier for peer review and buyer confidence.'
    }[intent],
    request_template:{type:'sledgewire.service.request.v1',request_id:'<buyer-unique-id>',service,input}
  };
}
