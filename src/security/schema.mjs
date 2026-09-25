const META_KEYS=new Set(['$schema','$id','title','description','default','examples','deprecated','readOnly','writeOnly']);
const VALIDATION_KEYS=new Set(['type','enum','const','required','properties','additionalProperties','items','minLength','maxLength','pattern','minimum','maximum','exclusiveMinimum','exclusiveMaximum','multipleOf','minItems','maxItems','uniqueItems','minProperties','maxProperties']);
const STRUCTURAL_KEYS=new Set([...META_KEYS,...VALIDATION_KEYS]);

function sameJson(a,b){try{return JSON.stringify(a)===JSON.stringify(b);}catch{return false;}}
function typeOk(value,type){if(type==='null')return value===null;if(type==='array')return Array.isArray(value);if(type==='object')return value!==null&&typeof value==='object'&&!Array.isArray(value);if(type==='integer')return Number.isInteger(value);if(type==='number')return typeof value==='number'&&Number.isFinite(value);return typeof value===type;}

export function analyzeSchemaSupport(schema,path='$',depth=0){
  const unsupported=[];
  if(depth>16)return {ok:false,unsupported:[`${path}:schema_depth_exceeded`]};
  if(typeof schema==='boolean')return {ok:true,unsupported};
  if(!schema||typeof schema!=='object'||Array.isArray(schema))return {ok:false,unsupported:[`${path}:schema_not_object_or_boolean`]};
  for(const key of Object.keys(schema)){
    if(!STRUCTURAL_KEYS.has(key))unsupported.push(`${path}:${key}`);
  }
  if(schema.properties!==undefined){
    if(!schema.properties||typeof schema.properties!=='object'||Array.isArray(schema.properties))unsupported.push(`${path}:invalid_properties`);
    else for(const [key,child] of Object.entries(schema.properties))unsupported.push(...analyzeSchemaSupport(child,`${path}.properties.${key}`,depth+1).unsupported);
  }
  if(schema.items!==undefined)unsupported.push(...analyzeSchemaSupport(schema.items,`${path}.items`,depth+1).unsupported);
  if(schema.additionalProperties!==undefined&&typeof schema.additionalProperties!=='boolean'){
    unsupported.push(...analyzeSchemaSupport(schema.additionalProperties,`${path}.additionalProperties`,depth+1).unsupported);
  }
  return {ok:unsupported.length===0,unsupported};
}

export function validateSchema(value,schema,path='$',depth=0){
  const errors=[];
  if(depth>16)return {ok:false,errors:[`${path}:schema_depth_exceeded`]};
  if(schema===true)return {ok:true,errors};
  if(schema===false)return {ok:false,errors:[`${path}:schema_false`]};
  if(!schema||typeof schema!=='object'||Array.isArray(schema))return {ok:false,errors:[`${path}:invalid_schema`]};
  const support=analyzeSchemaSupport(schema,path,depth);
  if(!support.ok)return {ok:false,errors:support.unsupported.map(x=>`${x}:unsupported_schema_keyword`)};
  if(Object.prototype.hasOwnProperty.call(schema,'const')&&!sameJson(value,schema.const))errors.push(`${path}:const`);
  if(schema.enum&&Array.isArray(schema.enum)&&!schema.enum.some(x=>sameJson(x,value)))errors.push(`${path}:not_in_enum`);
  if(schema.type){
    const types=Array.isArray(schema.type)?schema.type:[schema.type];
    if(!types.some(t=>typeOk(value,t)))return {ok:false,errors:[`${path}:expected_${types.join('_or_')}`]};
  }
  if(typeof value==='string'){
    if(Number.isInteger(schema.minLength)&&value.length<schema.minLength)errors.push(`${path}:minLength`);
    if(Number.isInteger(schema.maxLength)&&value.length>schema.maxLength)errors.push(`${path}:maxLength`);
    if(typeof schema.pattern==='string'){
      try{if(!new RegExp(schema.pattern,'u').test(value))errors.push(`${path}:pattern`);}catch{errors.push(`${path}:invalid_schema_pattern`);}
    }
  }
  if(typeof value==='number'&&Number.isFinite(value)){
    if(typeof schema.minimum==='number'&&value<schema.minimum)errors.push(`${path}:minimum`);
    if(typeof schema.maximum==='number'&&value>schema.maximum)errors.push(`${path}:maximum`);
    if(typeof schema.exclusiveMinimum==='number'&&value<=schema.exclusiveMinimum)errors.push(`${path}:exclusiveMinimum`);
    if(typeof schema.exclusiveMaximum==='number'&&value>=schema.exclusiveMaximum)errors.push(`${path}:exclusiveMaximum`);
    if(typeof schema.multipleOf==='number'&&schema.multipleOf>0){
      const ratio=value/schema.multipleOf;
      if(Math.abs(ratio-Math.round(ratio))>1e-10)errors.push(`${path}:multipleOf`);
    }
  }
  if(Array.isArray(value)){
    if(Number.isInteger(schema.minItems)&&value.length<schema.minItems)errors.push(`${path}:minItems`);
    if(Number.isInteger(schema.maxItems)&&value.length>schema.maxItems)errors.push(`${path}:maxItems`);
    if(schema.uniqueItems===true){
      const seen=new Set();
      for(const item of value){const key=JSON.stringify(item);if(seen.has(key)){errors.push(`${path}:uniqueItems`);break;}seen.add(key);}
    }
    if(schema.items!==undefined)value.forEach((v,i)=>errors.push(...validateSchema(v,schema.items,`${path}[${i}]`,depth+1).errors));
  }
  if(value&&typeof value==='object'&&!Array.isArray(value)){
    const props=schema.properties&&typeof schema.properties==='object'?schema.properties:{};
    const keys=Object.keys(value);
    if(Number.isInteger(schema.minProperties)&&keys.length<schema.minProperties)errors.push(`${path}:minProperties`);
    if(Number.isInteger(schema.maxProperties)&&keys.length>schema.maxProperties)errors.push(`${path}:maxProperties`);
    for(const key of schema.required??[])if(!Object.prototype.hasOwnProperty.call(value,key))errors.push(`${path}.${key}:required`);
    for(const [key,v] of Object.entries(value)){
      if(props[key])errors.push(...validateSchema(v,props[key],`${path}.${key}`,depth+1).errors);
      else if(schema.additionalProperties===false)errors.push(`${path}.${key}:additional_property`);
      else if(schema.additionalProperties&&typeof schema.additionalProperties==='object')errors.push(...validateSchema(v,schema.additionalProperties,`${path}.${key}`,depth+1).errors);
    }
  }
  return {ok:errors.length===0,errors};
}
