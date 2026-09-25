import test from 'node:test';
import assert from 'node:assert/strict';
import {startFixture} from '../fixtures/server.mjs';
import {McpSession,MODERN_PROTOCOL_VERSION} from '../src/mcp/client.mjs';
import {handleRpc,validateHttpMcp,SUPPORTED_PROTOCOL_VERSIONS} from '../src/server/protocol.mjs';

const tp={allowHttp:true,allowPrivate:true};

test('client negotiates modern 2026-07-28 and sends per-request metadata',async()=>{
  const f=await startFixture({mode:'modern'});
  try{
    const s=new McpSession(f.url,{targetPolicy:tp});
    const init=await s.initialize();
    assert.equal(init.era,'modern');
    assert.equal(init.protocolVersion,MODERN_PROTOCOL_VERSION);
    const tools=await s.listTools();
    assert.equal(tools.tools[0].name,'safe_echo');
    const out=await s.callTool('safe_echo',{text:'hello'});
    assert.equal(out.content[0].text,'hello');
    const discover=f.seen.find(x=>x.method==='server/discover');
    const list=f.seen.find(x=>x.method==='tools/list');
    const call=f.seen.find(x=>x.method==='tools/call');
    for(const x of [discover,list,call]){
      assert.equal(x.headers.protocol,MODERN_PROTOCOL_VERSION);
      assert.equal(x.meta['io.modelcontextprotocol/protocolVersion'],MODERN_PROTOCOL_VERSION);
      assert.deepEqual(x.meta['io.modelcontextprotocol/clientCapabilities'],{});
      assert.equal(x.headers.session,null);
    }
    assert.equal(call.headers.mcpMethod,'tools/call');
    assert.equal(call.headers.mcpName,'safe_echo');
  }finally{await f.close();}
});

test('client falls back cleanly to legacy initialize when discover is not supported',async()=>{
  const f=await startFixture({mode:'clean'});
  try{
    const s=new McpSession(f.url,{targetPolicy:tp});
    const init=await s.initialize();
    assert.equal(init.era,'legacy');
    assert.equal(init.protocolVersion,'2025-06-18');
    await s.listTools();
    assert.ok(f.seen.some(x=>x.method==='server/discover'));
    assert.ok(f.seen.some(x=>x.method==='initialize'));
    assert.ok(f.seen.some(x=>x.method==='tools/list'&&x.headers.session==='fixture-session'));
  }finally{await f.close();}
});

test('server/discover advertises modern plus legacy compatibility',async()=>{
  const r=await handleRpc({jsonrpc:'2.0',id:'d1',method:'server/discover',params:{_meta:{
    'io.modelcontextprotocol/protocolVersion':'2026-07-28',
    'io.modelcontextprotocol/clientCapabilities':{},
    'io.modelcontextprotocol/clientInfo':{name:'test',version:'1'}
  }}});
  assert.equal(r.result.resultType,'complete');
  assert.ok(r.result.supportedVersions.includes('2026-07-28'));
  assert.ok(r.result.supportedVersions.includes('2025-11-25'));
  assert.equal(r.result._meta['io.modelcontextprotocol/serverInfo'].version,'0.3.3');
});

test('modern HTTP requires matching MCP-Protocol-Version header and body metadata',()=>{
  const msg={jsonrpc:'2.0',id:1,method:'tools/list',params:{_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28','io.modelcontextprotocol/clientCapabilities':{}}}};
  assert.equal(validateHttpMcp(msg,{'mcp-protocol-version':'2026-07-28'}).ok,true);
  const missing=validateHttpMcp(msg,{});
  assert.equal(missing.ok,false);assert.equal(missing.status,400);assert.equal(missing.body.error.code,-32020);
  const mismatch=validateHttpMcp(msg,{'mcp-protocol-version':'2025-11-25'});
  assert.equal(mismatch.ok,false);assert.equal(mismatch.body.error.code,-32020);
});

test('unsupported protocol version fails explicitly',()=>{
  const msg={jsonrpc:'2.0',id:1,method:'tools/list',params:{_meta:{'io.modelcontextprotocol/protocolVersion':'2099-01-01'}}};
  const r=validateHttpMcp(msg,{'mcp-protocol-version':'2099-01-01'});
  assert.equal(r.ok,false);assert.equal(r.body.error.code,-32022);assert.deepEqual(r.body.error.data.supported,SUPPORTED_PROTOCOL_VERSIONS);
});

test('legacy initialize still accepts 2025-11-25',async()=>{
  const r=await handleRpc({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'legacy',version:'1'}}});
  assert.equal(r.result.protocolVersion,'2025-11-25');
  assert.equal(r.result.serverInfo.version,'0.3.3');
});
