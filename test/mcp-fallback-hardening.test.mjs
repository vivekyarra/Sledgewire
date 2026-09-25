import test from 'node:test';
import assert from 'node:assert/strict';
import {startFixture} from '../fixtures/server.mjs';
import {McpSession} from '../src/mcp/client.mjs';
const tp={allowHttp:true,allowPrivate:true};
test('HTTP discover timeout is transport failure, not legacy evidence',async()=>{
  const f=await startFixture({mode:'slow'});try{const s=new McpSession(f.url,{targetPolicy:tp,timeoutMs:50});await assert.rejects(()=>s.initialize(),/deadline_exceeded/);assert.equal(f.seen.filter(x=>x.method==='initialize').length,0);}finally{await f.close();}
});
test('server internal error during discover is not hidden by legacy fallback',async()=>{
  const f=await startFixture({mode:'discover_internal_error'});try{const s=new McpSession(f.url,{targetPolicy:tp});await assert.rejects(()=>s.initialize(),/mcp_error:-32603/);assert.equal(f.seen.filter(x=>x.method==='initialize').length,0);}finally{await f.close();}
});
