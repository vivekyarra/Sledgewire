import test from 'node:test';
import assert from 'node:assert/strict';
import {startFixture} from '../fixtures/server.mjs';
import {McpSession,MODERN_PROTOCOL_VERSION} from '../src/mcp/client.mjs';
import {encodeMcpHeaderValue} from '../src/mcp/header-codec.mjs';
import {handleRpc,validateHttpMcp,SUPPORTED_PROTOCOL_VERSIONS} from '../src/server/protocol.mjs';

const tp={allowHttp:true,allowPrivate:true};

test('client negotiates modern 2026-07-28 and sends required per-request metadata and headers',async()=>{
  const f=await startFixture({mode:'modern'});
  try{
    const s=new McpSession(f.url,{targetPolicy:tp}),init=await s.initialize();
    assert.equal(init.era,'modern');assert.equal(init.protocolVersion,MODERN_PROTOCOL_VERSION);
    assert.equal(init.serverInfo.name,'fixture-modern');
    const tools=await s.listTools();assert.equal(tools.tools[0].name,'safe_echo');
    const out=await s.callTool('safe_echo',{text:'hello'});assert.equal(out.content[0].text,'hello');
    const discover=f.seen.find(x=>x.method==='server/discover'),list=f.seen.find(x=>x.method==='tools/list'),call=f.seen.find(x=>x.method==='tools/call');
    for(const x of [discover,list,call]){
      assert.equal(x.headers.protocol,MODERN_PROTOCOL_VERSION);
      assert.equal(x.meta['io.modelcontextprotocol/protocolVersion'],MODERN_PROTOCOL_VERSION);
      assert.deepEqual(x.meta['io.modelcontextprotocol/clientCapabilities'],{});
      assert.equal(x.headers.session,null);
      assert.equal(x.headers.mcpMethod,x.method);
    }
    assert.equal(call.headers.mcpName,'safe_echo');
  }finally{await f.close();}
});
test('client falls back when legacy server returns method-not-found',async()=>{
  const f=await startFixture({mode:'clean'});try{const s=new McpSession(f.url,{targetPolicy:tp}),init=await s.initialize();assert.equal(init.era,'legacy');assert.equal(init.protocolVersion,'2025-06-18');await s.listTools();assert.ok(f.seen.some(x=>x.method==='server/discover'));assert.ok(f.seen.some(x=>x.method==='initialize'));assert.ok(f.seen.some(x=>x.method==='tools/list'&&x.headers.session==='fixture-session'));}finally{await f.close();}
});
test('client falls back when legacy HTTP rejects modern version with -32022',async()=>{
  const f=await startFixture({mode:'legacy_header_reject'});try{const s=new McpSession(f.url,{targetPolicy:tp}),init=await s.initialize();assert.equal(init.era,'legacy');assert.equal(init.protocolVersion,'2025-06-18');}finally{await f.close();}
});
test('client falls back when old endpoint returns plain HTTP 404 to discover probe',async()=>{
  const f=await startFixture({mode:'legacy_plain_404'});try{const s=new McpSession(f.url,{targetPolicy:tp}),init=await s.initialize();assert.equal(init.era,'legacy');assert.equal(init.protocolVersion,'2025-06-18');}finally{await f.close();}
});
test('server/discover advertises modern plus legacy and identity only in _meta',async()=>{
  const r=await handleRpc({jsonrpc:'2.0',id:'d1',method:'server/discover',params:{_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28','io.modelcontextprotocol/clientCapabilities':{},'io.modelcontextprotocol/clientInfo':{name:'test',version:'1'}}}});
  assert.equal(r.result.resultType,'complete');assert.equal(r.result.ttlMs,0);assert.equal(r.result.cacheScope,'private');assert.ok(r.result.supportedVersions.includes('2026-07-28'));assert.ok(r.result.supportedVersions.includes('2025-11-25'));assert.equal(r.result.serverInfo,undefined);assert.equal(r.result._meta['io.modelcontextprotocol/serverInfo'].version,'0.3.10');
});
test('modern tools/list wire result carries required result type and cache hints',async()=>{const r=await handleRpc({jsonrpc:'2.0',id:9,method:'tools/list',params:{_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28','io.modelcontextprotocol/clientCapabilities':{}}}});assert.equal(r.result.resultType,'complete');assert.equal(r.result.ttlMs,0);assert.equal(r.result.cacheScope,'private');});
test('modern requests reject missing or malformed required clientCapabilities with Invalid params',async()=>{
  for(const caps of [undefined,null,[],true,'nope']){
    const meta={'io.modelcontextprotocol/protocolVersion':'2026-07-28'};if(caps!==undefined)meta['io.modelcontextprotocol/clientCapabilities']=caps;
    const msg={jsonrpc:'2.0',id:10,method:'tools/list',params:{_meta:meta}};
    const h=validateHttpMcp(msg,{'mcp-protocol-version':'2026-07-28','mcp-method':'tools/list'});assert.equal(h.ok,false);assert.equal(h.status,400);assert.equal(h.body.error.code,-32602);
    const direct=await handleRpc(msg);assert.equal(direct.error.code,-32602);
  }
});
test('modern HTTP requires matching protocol and method headers',()=>{
  const msg={jsonrpc:'2.0',id:1,method:'tools/list',params:{_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28','io.modelcontextprotocol/clientCapabilities':{}}}};
  assert.equal(validateHttpMcp(msg,{'mcp-protocol-version':'2026-07-28','mcp-method':'tools/list'}).ok,true);
  for(const headers of [{},{'mcp-protocol-version':'2026-07-28'},{'mcp-protocol-version':'2025-11-25','mcp-method':'tools/list'}]){
    const r=validateHttpMcp(msg,headers);assert.equal(r.ok,false);assert.equal(r.body.error.code,-32020);
  }
});
test('modern HTTP rejects method name and removed session header mismatches',()=>{
  const msg={jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'sledgewire.selfcheck',arguments:{},_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28','io.modelcontextprotocol/clientCapabilities':{}}}};
  const base={'mcp-protocol-version':'2026-07-28'};
  assert.equal(validateHttpMcp(msg,{...base,'mcp-method':'tools/list','mcp-name':'sledgewire.selfcheck'}).body.error.code,-32020);
  assert.equal(validateHttpMcp(msg,{...base,'mcp-method':'tools/call'}).body.error.code,-32020);
  assert.equal(validateHttpMcp(msg,{...base,'mcp-method':'tools/call','mcp-name':'wrong'}).body.error.code,-32020);
  assert.equal(validateHttpMcp(msg,{...base,'mcp-method':'tools/call','mcp-name':'sledgewire.selfcheck','mcp-session-id':'legacy-session'}).body.error.code,-32020);
  assert.equal(validateHttpMcp(msg,{...base,'mcp-method':'tools/call','mcp-name':'sledgewire.selfcheck'}).ok,true);
});
test('modern HTTP decodes sentinel-encoded Mcp-Name',()=>{
  const name='工具/echo';
  const msg={jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:{},_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28','io.modelcontextprotocol/clientCapabilities':{}}}};
  const r=validateHttpMcp(msg,{'mcp-protocol-version':'2026-07-28','mcp-method':'tools/call','mcp-name':encodeMcpHeaderValue(name)});
  assert.equal(r.ok,true);
});
test('unsupported protocol version fails explicitly',()=>{
  const msg={jsonrpc:'2.0',id:1,method:'tools/list',params:{_meta:{'io.modelcontextprotocol/protocolVersion':'2099-01-01'}}},r=validateHttpMcp(msg,{'mcp-protocol-version':'2099-01-01','mcp-method':'tools/list'});
  assert.equal(r.ok,false);assert.equal(r.body.error.code,-32022);assert.deepEqual(r.body.error.data.supported,SUPPORTED_PROTOCOL_VERSIONS);
});
test('legacy initialize still accepts 2025-11-25',async()=>{
  const r=await handleRpc({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'legacy',version:'1'}}});
  assert.equal(r.result.protocolVersion,'2025-11-25');assert.equal(r.result.serverInfo.version,'0.3.10');
});

test('modern target client mirrors x-mcp-header tool arguments with sentinel encoding',async()=>{
  const f=await startFixture({mode:'x_mcp_header'});
  try{
    const s=new McpSession(f.url,{targetPolicy:tp});const init=await s.initialize();assert.equal(init.era,'modern');
    await s.listTools();const r=await s.callTool('safe_echo',{text:'hello',region:'東京'});assert.equal(r.content[0].text,'hello');
    const call=f.seen.find(x=>x.method==='tools/call');assert.ok(call.headers.paramRegion);assert.equal(call.headers.paramRegion.startsWith('=?base64?'),true);
  }finally{await f.close();}
});
