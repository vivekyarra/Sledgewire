const SUPPORTED=new Set(['$schema','$id','type','required','properties','additionalProperties','enum','const','minLength','maxLength','minimum','maximum','minItems','maxItems','items','description','title','default','examples','readOnly','writeOnly','deprecated','minProperties','maxProperties']);
const MAX_SCHEMA_DEPTH=64,MAX_SCHEMA_NODES=10_000;
function pathText(path){return path.length?path.join('.'):'$';}
function validate(value,schema,path,state,depth){
  if(depth>MAX_SCHEMA_DEPTH)return {ok:false,reason:'schema_depth_limit',path};
  if(++state.nodes>MAX_SCHEMA_NODES)return {ok:false,reason:'schema_node_limit',path};
  if(!schema||typeof schema!=='object'||Array.isArray(schema))return {ok:false,reason:`unsupported_schema:${pathText(path)}`};
  const unsupported=Object.keys(schema).filter(k=>!SUPPORTED.has(k));if(unsupported.length)return {ok:false,reason:`unsupported_schema_keyword:${unsupported[0]}`,path};
  if('const' in schema&&value!==schema.const)return {ok:false,reason:'const_mismatch',path};
  if(Array.isArray(schema.enum)&&!schema.enum.some(x=>Object.is(x,value)))return {ok:false,reason:'enum_mismatch',path};
  const type=schema.type;
  if(Array.isArray(type)){
    const failures=[];
    for(const candidate of type){
      const r=validate(value,{...schema,type:candidate},path,state,depth+1);
      if(r.ok)return r;
      if(r.reason==='schema_depth_limit'||r.reason==='schema_node_limit')return r;
      failures.push(r.reason);
    }
    return {ok:false,reason:`type_union_mismatch:${failures.join('|')}`,path};
  }
  if(type==='null')return value===null?{ok:true}:{ok:false,reason:'type_null_required',path};
  if(type==='object'){
    if(!value||typeof value!=='object'||Array.isArray(value))return {ok:false,reason:'type_object_required',path};
    const keys=Object.keys(value);if(schema.minProperties!==undefined&&keys.length<schema.minProperties)return {ok:false,reason:'min_properties',path};if(schema.maxProperties!==undefined&&keys.length>schema.maxProperties)return {ok:false,reason:'max_properties',path};
    const props=schema.properties??{};for(const req of schema.required??[]){if(!Object.prototype.hasOwnProperty.call(value,req))return {ok:false,reason:`missing_required:${req}`,path:[...path,req]};}
    for(const [k,v] of Object.entries(value)){
      if(props[k]){const r=validate(v,props[k],[...path,k],state,depth+1);if(!r.ok)return r;}
      else if(schema.additionalProperties===false)return {ok:false,reason:`additional_property:${k}`,path:[...path,k]};
      else if(schema.additionalProperties&&typeof schema.additionalProperties==='object'){const r=validate(v,schema.additionalProperties,[...path,k],state,depth+1);if(!r.ok)return r;}
    }
    return {ok:true};
  }
  if(type==='array'){
    if(!Array.isArray(value))return {ok:false,reason:'type_array_required',path};if(schema.minItems!==undefined&&value.length<schema.minItems)return {ok:false,reason:'min_items',path};if(schema.maxItems!==undefined&&value.length>schema.maxItems)return {ok:false,reason:'max_items',path};
    if(schema.items){for(let i=0;i<value.length;i++){const r=validate(value[i],schema.items,[...path,String(i)],state,depth+1);if(!r.ok)return r;}}
    return {ok:true};
  }
  if(type==='string'){if(typeof value!=='string')return {ok:false,reason:'type_string_required',path};if(schema.minLength!==undefined&&value.length<schema.minLength)return {ok:false,reason:'min_length',path};if(schema.maxLength!==undefined&&value.length>schema.maxLength)return {ok:false,reason:'max_length',path};return {ok:true};}
  if(type==='integer'){if(!Number.isInteger(value))return {ok:false,reason:'type_integer_required',path};}
  else if(type==='number'){if(typeof value!=='number'||!Number.isFinite(value))return {ok:false,reason:'type_number_required',path};}
  else if(type==='boolean'){if(typeof value!=='boolean')return {ok:false,reason:'type_boolean_required',path};}
  else if(type!==undefined)return {ok:false,reason:`unsupported_type:${type}`,path};
  if(typeof value==='number'){if(schema.minimum!==undefined&&value<schema.minimum)return {ok:false,reason:'minimum',path};if(schema.maximum!==undefined&&value>schema.maximum)return {ok:false,reason:'maximum',path};}
  return {ok:true};
}
export function validateSchemaValue(value,schema,path=[]){
  return validate(value,schema,path,{nodes:0},0);
}
