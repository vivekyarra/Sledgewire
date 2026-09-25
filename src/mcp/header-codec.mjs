const TOKEN=/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const TYPES=new Set(['string','integer','boolean','number']);
const NONREACHABLE=['items','prefixItems','contains','additionalProperties','unevaluatedProperties','unevaluatedItems','propertyNames','patternProperties','dependentSchemas','oneOf','anyOf','allOf','not','if','then','else','$defs','definitions'];
const OBJECT_BRANCHES=new Set(['patternProperties','dependentSchemas','$defs','definitions']);
const PREFIX='=?base64?',SUFFIX='?=';

function pathName(path){return path.length?path.join('.'):'<root>';}
export function encodeMcpHeaderValue(value){
  const s=String(value),ambiguous=s.startsWith(PREFIX)&&s.endsWith(SUFFIX),trimmed=s===s.trim();
  let safe=s.length>0&&trimmed&&!ambiguous;
  for(let i=0;safe&&i<s.length;i++){const c=s.codePointAt(i);safe=c===9||(c>=32&&c<=126);if(c>0xffff)i++;}
  return safe?s:`${PREFIX}${Buffer.from(s,'utf8').toString('base64')}${SUFFIX}`;
}
export function decodeMcpHeaderValue(value){
  if(typeof value!=='string')return undefined;
  if(!(value.startsWith(PREFIX)&&value.endsWith(SUFFIX)))return value;
  const b64=value.slice(PREFIX.length,-SUFFIX.length);
  if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(b64))return undefined;
  try{
    const bytes=Buffer.from(b64,'base64');
    if(bytes.toString('base64')!==b64)return undefined;
    const s=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    return s;
  }catch{return undefined;}
}
export function scanXMcpHeaderDeclarations(schema){
  const declarations=[],seen=new Map();
  function visit(node,path,reachable){
    if(!node||typeof node!=='object'||Array.isArray(node))return null;
    if(Object.prototype.hasOwnProperty.call(node,'x-mcp-header')){
      if(!reachable||path.length===0)return `${pathName(path)}:x-mcp-header_unreachable`;
      const name=node['x-mcp-header'],type=node.type;
      if(typeof name!=='string'||!TOKEN.test(name))return `${pathName(path)}:x-mcp-header_invalid_name`;
      if(typeof type!=='string'||!TYPES.has(type))return `${pathName(path)}:x-mcp-header_invalid_type`;
      const lower=name.toLowerCase();if(seen.has(lower))return `x-mcp-header_duplicate:${name}`;seen.set(lower,name);
      declarations.push({path:[...path],headerName:name,type});
    }
    if(node.properties&&typeof node.properties==='object'&&!Array.isArray(node.properties)){
      for(const [k,v] of Object.entries(node.properties)){const e=visit(v,[...path,k],reachable);if(e)return e;}
    }
    for(const key of NONREACHABLE){
      const sub=node[key];if(sub===undefined)continue;
      const branches=Array.isArray(sub)?sub:(sub&&typeof sub==='object'&&OBJECT_BRANCHES.has(key)?Object.values(sub):[sub]);
      for(const branch of branches){const e=visit(branch,[...path,`<${key}>`],false);if(e)return e;}
    }
    return null;
  }
  const reason=visit(schema,[],true);
  return reason?{valid:false,reason}:{valid:true,declarations};
}
function at(root,path){let x=root;for(const k of path){if(!x||typeof x!=='object')return undefined;x=x[k];}return x;}
function primitive(v){
  if(typeof v==='string')return v;
  if(typeof v==='boolean')return v?'true':'false';
  if(typeof v==='number'&&Number.isFinite(v)&&(!Number.isInteger(v)||Number.isSafeInteger(v)))return String(v);
  return undefined;
}
export function buildMcpParamHeaders(declarations,args={}){
  const out={};
  for(const d of declarations){
    const raw=at(args,d.path);if(raw===undefined||raw===null)continue;
    const s=primitive(raw);if(s===undefined)continue;
    out[`mcp-param-${d.headerName}`]=encodeMcpHeaderValue(s);
  }
  return out;
}
