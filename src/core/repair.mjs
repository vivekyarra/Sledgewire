import {validateSchemaValue} from './schema.mjs';

function coerce(value,spec){
  if(spec?.type==='number'&&typeof value==='string'&&/^-?(?:\d+\.?\d*|\.\d+)$/.test(value))return {changed:true,value:Number(value),op:'coerce_number'};
  if(spec?.type==='integer'&&typeof value==='string'&&/^-?\d+$/.test(value))return {changed:true,value:Number(value),op:'coerce_integer'};
  if(spec?.type==='boolean'&&typeof value==='string'&&['true','false'].includes(value.toLowerCase()))return {changed:true,value:value.toLowerCase()==='true',op:'coerce_boolean'};
  return {changed:false,value};
}
export function boundedRepair(args,schema,evidence={}){
  if(!schema||schema.type!=='object'||!args||typeof args!=='object'||Array.isArray(args))return {status:'cannot_repair',reason:'unsupported_schema_or_arguments',args};
  const out={...args};const actions=[];
  if(schema.additionalProperties===false){for(const k of Object.keys(out)){if(!Object.prototype.hasOwnProperty.call(schema.properties??{},k))return {status:'cannot_repair',reason:`unknown_field:${k}`,args};}}
  for(const req of schema.required??[]){if(out[req]===undefined){if(Object.prototype.hasOwnProperty.call(evidence,req)){out[req]=evidence[req];actions.push({op:'fill_required',field:req,source:'evidence'});}else return {status:'needs_information',reason:`missing_required:${req}`,args};}}
  for(const [k,v] of Object.entries(out)){const spec=schema.properties?.[k];if(!spec)continue;const c=coerce(v,spec);if(c.changed){out[k]=c.value;actions.push({op:c.op,field:k});}}
  const validation=validateSchemaValue(out,schema);if(!validation.ok)return {status:'cannot_repair',reason:`post_repair_invalid:${validation.reason}`,args:out,actions,validation};
  return {status:'repaired',args:out,actions,validation:{ok:true}};
}
export function inspectRepair(original,repair,schema,evidence={}){
  if(repair?.status!=='repaired')return {status:'fail',reason:'candidate_not_repaired'};
  const v=validateSchemaValue(repair.args,schema);if(!v.ok)return {status:'fail',reason:`schema_validation:${v.reason}`};
  const replay=boundedRepair(original,schema,evidence);if(replay.status!=='repaired')return {status:'fail',reason:`independent_repair:${replay.status}`};
  if(JSON.stringify(replay.args)!==JSON.stringify(repair.args)||JSON.stringify(replay.actions)!==JSON.stringify(repair.actions))return {status:'fail',reason:'repair_not_reproducible'};
  return {status:'pass',reason:null,actions:repair.actions.length};
}
