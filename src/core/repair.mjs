import {analyzeSchemaSupport,validateSchema} from '../security/schema.mjs';
function supportedPrimitive(spec){return ['string','number','integer','boolean'].includes(spec?.type);}
export function boundedRepair(args,schema,evidence={}){
  const original=(args&&typeof args==='object'&&!Array.isArray(args))?args:{};
  const out={...original};const actions=[];
  if(!schema||schema.type!=='object')return {status:'cannot_repair',reason:'unsupported_schema',args:original,actions};
  const support=analyzeSchemaSupport(schema);
  if(!support.ok)return {status:'cannot_repair',reason:'unsupported_schema_keywords',unsupported:support.unsupported,args:original,actions};
  if(schema.additionalProperties===false){
    for(const key of Object.keys(out))if(!Object.prototype.hasOwnProperty.call(schema.properties??{},key))return {status:'cannot_repair',reason:`unexpected_field:${key}`,args:original,actions};
  }
  for(const req of schema.required??[]){
    if(out[req]===undefined){
      if(Object.prototype.hasOwnProperty.call(evidence,req)){out[req]=evidence[req];actions.push({op:'fill_required',field:req,source:'trusted_evidence'});}
      else return {status:'needs_information',reason:`missing_required:${req}`,args:original,actions};
    }
  }
  for(const [k,v] of Object.entries(out)){
    const spec=schema.properties?.[k];
    if(!spec||!supportedPrimitive(spec))continue;
    if(spec.type==='number'&&typeof v==='string'&&/^-?(?:\d+\.?\d*|\.\d+)$/.test(v)){out[k]=Number(v);actions.push({op:'coerce_number',field:k,from:'string'});}
    else if(spec.type==='integer'&&typeof v==='string'&&/^-?\d+$/.test(v)){out[k]=Number(v);actions.push({op:'coerce_integer',field:k,from:'string'});}
    else if(spec.type==='boolean'&&typeof v==='string'&&['true','false'].includes(v.toLowerCase())){out[k]=v.toLowerCase()==='true';actions.push({op:'coerce_boolean',field:k,from:'string'});}
  }
  const verdict=validateSchema(out,schema);
  if(!verdict.ok)return {status:'cannot_repair',reason:'post_repair_schema_invalid',errors:verdict.errors,args:original,candidate:out,actions};
  return {status:'repaired',args:out,actions,validation:verdict};
}
export function inspectRepair(candidate,schema){
  const support=analyzeSchemaSupport(schema);
  if(!support.ok)return {status:'fail',reason:'unsupported_schema_keywords',unsupported:support.unsupported};
  const verdict=validateSchema(candidate,schema);
  return {status:verdict.ok?'pass':'fail',errors:verdict.errors};
}
