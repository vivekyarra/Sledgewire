import {postJsonPinned} from './transport.mjs';
import {resolveTarget} from '../security/target-policy.mjs';
import {buildMcpParamHeaders,encodeMcpHeaderValue,scanXMcpHeaderDeclarations} from './header-codec.mjs';

export const MODERN_PROTOCOL_VERSION='2026-07-28';
export const LEGACY_PROTOCOL_VERSION='2025-11-25';
const HARD_MODERN_ERRORS=new Set([-32020,-32021]);
const LEGACY_DISCOVERY_ERRORS=new Set([-32601,-32602]);

class McpRpcError extends Error{
  constructor(error){super(`mcp_error:${error?.code}:${error?.message}`);this.name='McpRpcError';this.rpcCode=Number(error?.code);this.rpcData=error?.data;}
}

export class McpSession{
  constructor(endpoint,opts={}){
    this.endpoint=endpoint;this.opts=opts;this.sessionId=null;this.protocolVersion=null;this.era=null;this.resolved=null;
    this.clientInfo={name:'sledgewire',version:'0.3.9'};this.clientCapabilities={};this.serverInfo=null;this.toolDefinitions=new Map();this.catalogLoaded=false;
  }
  async request(method,params={},extra={}){
    this.resolved??=await resolveTarget(this.endpoint,this.opts.targetPolicy);
    const modern=extra.modern===true||this.era==='modern';
    const version=extra.protocolVersion??this.protocolVersion??(modern?MODERN_PROTOCOL_VERSION:LEGACY_PROTOCOL_VERSION);
    const id=extra.notification?undefined:(extra.id??crypto.randomUUID());
    let bodyParams=params===undefined?undefined:{...params};
    if(modern){
      bodyParams??={};
      bodyParams._meta={...(bodyParams._meta??{}),
        'io.modelcontextprotocol/protocolVersion':version,
        'io.modelcontextprotocol/clientInfo':this.clientInfo,
        'io.modelcontextprotocol/clientCapabilities':this.clientCapabilities};
    }
    const msg={jsonrpc:'2.0',...(id===undefined?{}:{id}),method,...(bodyParams===undefined?{}:{params:bodyParams})};
    const standardHeaders=modern?{
      'mcp-protocol-version':version,'mcp-method':method,
      ...(requestName(method,bodyParams)!==null?{'mcp-name':encodeMcpHeaderValue(String(requestName(method,bodyParams)))}:{})
    }:{
      ...(this.sessionId?{'mcp-session-id':this.sessionId}:{}),
      ...(version?{'mcp-protocol-version':version}:{})
    };
    // Standard MCP headers always win over caller-supplied extras.
    const headers={...(extra.headers??{}),...standardHeaders};
    const wire=await postJsonPinned(this.endpoint,msg,{...this.opts,...extra,resolvedTarget:this.resolved,headers});
    if(!modern){const returned=wire.headers['mcp-session-id'];if(returned)this.sessionId=Array.isArray(returned)?returned[0]:returned;}
    if(extra.notification)return null;
    const obj=wire.result;if(!obj||typeof obj!=='object')throw new Error('invalid_mcp_response');
    if(obj.error)throw new McpRpcError(obj.error);
    return obj.result;
  }
  async initialize(){
    if(this.era)return {protocolVersion:this.protocolVersion,serverInfo:this.serverInfo,era:this.era};
    try{
      const discovered=await this.request('server/discover',{}, {modern:true,protocolVersion:MODERN_PROTOCOL_VERSION});
      const supported=Array.isArray(discovered?.supportedVersions)?discovered.supportedVersions:[];
      if(!supported.includes(MODERN_PROTOCOL_VERSION)){
        if(supported.some(v=>String(v).startsWith('2025-')))throw Object.assign(new Error('legacy_only_discovery'),{legacyOnly:true});
        throw new Error('modern_version_not_advertised');
      }
      this.era='modern';this.protocolVersion=MODERN_PROTOCOL_VERSION;this.sessionId=null;
      this.serverInfo=discovered?._meta?.['io.modelcontextprotocol/serverInfo']??null;
      return {protocolVersion:this.protocolVersion,serverInfo:this.serverInfo,capabilities:discovered?.capabilities??{},era:this.era};
    }catch(error){
      if(Number.isFinite(error?.rpcCode)&&HARD_MODERN_ERRORS.has(error.rpcCode))throw error;
      if(Number(error?.rpcCode)===-32022){
        const supported=Array.isArray(error?.rpcData?.supported)?error.rpcData.supported:[];
        if(supported.includes(MODERN_PROTOCOL_VERSION))throw new Error('modern_negotiation_inconsistent');
        if(!supported.some(v=>String(v).startsWith('2025-')))throw error;
      }else if(!isLegacyFallbackSignal(error))throw error;
    }
    this.era='legacy';this.protocolVersion=LEGACY_PROTOCOL_VERSION;
    const result=await this.request('initialize',{protocolVersion:LEGACY_PROTOCOL_VERSION,capabilities:{},clientInfo:this.clientInfo});
    if(result?.protocolVersion)this.protocolVersion=result.protocolVersion;
    this.serverInfo=result?.serverInfo??null;
    await this.request('notifications/initialized',{}, {notification:true}).catch(()=>null);
    return {...result,protocolVersion:this.protocolVersion,serverInfo:this.serverInfo,era:this.era};
  }
  async listTools(){
    let tools=[],cursor;
    for(let page=0;page<10;page++){
      const r=await this.request('tools/list',cursor?{cursor}:{});
      const batch=Array.isArray(r?.tools)?r.tools:[];
      tools.push(...batch);
      if(tools.length>512)throw new Error('tool_catalog_too_large');
      cursor=r?.nextCursor;if(!cursor)break;
    }
    this.toolDefinitions=new Map(tools.filter(t=>typeof t?.name==='string').map(t=>[t.name,t]));
    this.catalogLoaded=true;
    return {tools};
  }
  async callTool(name,args={},extra={}){
    if(this.era==='modern'&&!this.catalogLoaded)await this.listTools();
    const headers={...(extra.headers??{})};
    if(this.era==='modern'){
      const def=this.toolDefinitions.get(name);
      if(def){
        const scan=scanXMcpHeaderDeclarations(def.inputSchema??{});
        if(!scan.valid)throw new Error(`invalid_x_mcp_header_declaration:${scan.reason}`);
        Object.assign(headers,buildMcpParamHeaders(scan.declarations,args));
      }
    }
    const r=await this.request('tools/call',{name,arguments:args},{...extra,headers});
    if(r?.isError===true)throw new Error(`target_tool_error:${extractText(r)}`);
    return r;
  }
}
function requestName(method,params){
  if(method==='tools/call'||method==='prompts/get')return params?.name??null;
  if(method==='resources/read')return params?.uri??null;
  return null;
}
function isLegacyFallbackSignal(error){
  if(error?.legacyOnly===true)return true;
  if(Number.isFinite(error?.rpcCode))return LEGACY_DISCOVERY_ERRORS.has(Number(error.rpcCode));
  if([404,405].includes(Number(error?.httpStatus)))return true;
  return /modern_version_not_advertised/.test(String(error?.message??error));
}
function extractText(r){return Array.isArray(r?.content)?r.content.filter(x=>x?.type==='text').map(x=>x.text).join(' ').slice(0,500):'tool_reported_error';}
export async function initialize(endpoint,opts={}){const s=new McpSession(endpoint,opts);return s.initialize();}
export async function listTools(endpoint,opts={}){const s=new McpSession(endpoint,opts);await s.initialize();return s.listTools();}
export async function callTool(endpoint,name,args,opts={}){const s=new McpSession(endpoint,opts);await s.initialize();return s.callTool(name,args);}
export async function rpc(endpoint,method,params,opts={}){const s=new McpSession(endpoint,opts);if(method!=='initialize'&&method!=='server/discover')await s.initialize();return s.request(method,params,{id:opts.id,modern:method==='server/discover',protocolVersion:method==='server/discover'?MODERN_PROTOCOL_VERSION:undefined});}
