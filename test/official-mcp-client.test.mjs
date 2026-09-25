import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {Client,StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
import {handleRpc,validateHttpMcp} from '../src/server/protocol.mjs';

test('official MCP v2 client negotiates 2026-07-28 and calls Sledgewire over Streamable HTTP',async()=>{
  const server=http.createServer(async(req,res)=>{
    if(req.method!=='POST'||req.url!=='/mcp'){res.statusCode=404;return res.end();}
    const chunks=[];for await(const c of req)chunks.push(Buffer.from(c));
    let msg;try{msg=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{res.statusCode=400;return res.end();}
    const v=validateHttpMcp(msg,req.headers);
    if(!v.ok){res.statusCode=v.status;res.setHeader('content-type','application/json');return res.end(JSON.stringify(v.body));}
    const out=await handleRpc(msg);
    if(out===null){res.statusCode=202;return res.end();}
    res.statusCode=200;res.setHeader('content-type','application/json');res.end(JSON.stringify(out));
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const {port}=server.address();
  const client=new Client({name:'sledgewire-official-client-test',version:'1.0.0'},{versionNegotiation:{mode:'auto'}});
  try{
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)));
    assert.equal(client.getNegotiatedProtocolVersion(),'2026-07-28');
    const listed=await client.listTools();assert.ok(listed.tools.some(t=>t.name==='sledgewire.selfcheck'));
    const called=await client.callTool({name:'sledgewire.selfcheck',arguments:{}});
    assert.equal(called.isError,false);
    assert.equal(called.structuredContent?.verified,true);
  }finally{
    await client.close().catch(()=>{});
    await new Promise(resolve=>server.close(resolve));
  }
});
