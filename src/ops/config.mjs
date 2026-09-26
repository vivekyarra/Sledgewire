export function boundedInteger(raw,{name='value',defaultValue,min=0,max=Number.MAX_SAFE_INTEGER}={}){
  const value=raw===undefined||raw===null||raw===''?defaultValue:Number(raw);
  if(!Number.isSafeInteger(value)||value<min||value>max)throw new Error(`invalid_${name}`);
  return value;
}

export function publicBaseOrigin(raw,{production=false}={}){
  let url;try{url=new URL(raw);}catch{throw new Error('invalid_public_base_url');}
  if(!url.hostname||url.username||url.password||url.search||url.hash||(url.pathname!==''&&url.pathname!=='/'))throw new Error('public_base_url_must_be_origin_only');
  if(production&&url.protocol!=='https:')throw new Error('production_public_base_url_https_required');
  if(!production&&url.protocol==='https:')throw new Error('public_https_requires_node_env_production');
  if(!['http:','https:'].includes(url.protocol))throw new Error('unsupported_public_base_url_scheme');
  return url.origin;
}
