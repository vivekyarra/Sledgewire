import {postJsonPinned} from './transport.mjs';
import {resolveTarget} from '../security/target-policy.mjs';

export class McpSession {
  constructor(endpoint,opts={}){this.endpoint=endpoint;this.opts=opts;this.sessionId=null;this.protocolVersion='2025-06-18';this.resolved=null;}
  async request(method,params={},extra={}){
    this.resolved ??= await resolveTarget(this.endpoint,this.opts.targetPolicy);
    const id = extra.notification ? undefined : (extra.id ?? crypto.randomUUID());
    const msg={jsonrpc:'2.0',...(id===undefined?{}:{id}),method,...(params===undefined?{}:{params})};
    const headers={...(this.sessionId?{'mcp-session-id':this.sessionId}:{}),...(this.protocolVersion?{'mcp-protocol-version':this.protocolVersion}:{}),...(extra.headers??{})};
    const wire=await postJsonPinned(this.endpoint,msg,{...this.opts,...extra,resolvedTarget:this.resolved,headers});
    const returnedSession=wire.headers['mcp-session-id']; if(returnedSession)this.sessionId=Array.isArray(returnedSession)?returnedSession[0]:returnedSession;
    if(extra.notification)return null;
    const obj=wire.result;
    if(!obj || typeof obj!=='object') throw new Error('invalid_mcp_response');
    if(obj.error) throw new Error(`mcp_error:${obj.error.code}:${obj.error.message}`);
    return obj.result;
  }
  async initialize(){const result=await this.request('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'sledgewire',version:'0.2.0'}});if(result?.protocolVersion)this.protocolVersion=result.protocolVersion;await this.request('notifications/initialized',{}, {notification:true}).catch(()=>null);return result;}
  async listTools(){let tools=[];let cursor=undefined;for(let page=0;page<10;page++){const r=await this.request('tools/list',cursor?{cursor}:{});const batch=Array.isArray(r?.tools)?r.tools:[];tools.push(...batch);if(tools.length>512)throw new Error('tool_catalog_too_large');cursor=r?.nextCursor;if(!cursor)break;}return {tools};}
  async callTool(name,args={},extra={}){const r=await this.request('tools/call',{name,arguments:args},extra);if(r?.isError===true)throw new Error(`target_tool_error:${extractText(r)}`);return r;}
}
function extractText(r){return Array.isArray(r?.content)?r.content.filter(x=>x?.type==='text').map(x=>x.text).join(' ').slice(0,500):'tool_reported_error';}
export async function initialize(endpoint,opts={}){const s=new McpSession(endpoint,opts);return s.initialize();}
export async function listTools(endpoint,opts={}){const s=new McpSession(endpoint,opts);await s.initialize();return s.listTools();}
export async function callTool(endpoint,name,args,opts={}){const s=new McpSession(endpoint,opts);await s.initialize();return s.callTool(name,args);}
export async function rpc(endpoint,method,params,opts={}){const s=new McpSession(endpoint,opts);if(method!=='initialize')await s.initialize();return s.request(method,params,{id:opts.id});}
