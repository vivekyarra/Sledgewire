import test from 'node:test';
import assert from 'node:assert/strict';
import {auditSinkUrl,postAuditEvent} from '../src/ops/audit-sink.mjs';

test('audit sink accepts credential-free HTTPS URL with path/query',()=>{
  assert.equal(auditSinkUrl('https://audit.example/v1/events?source=sledgewire'),'https://audit.example/v1/events?source=sledgewire');
});
test('audit sink rejects plaintext credentials fragments and malformed URLs before network',async()=>{
  for(const bad of ['http://audit.example/v1','https://u:p@audit.example/v1','https://audit.example/v1#secret','not-a-url']){
    let calls=0;
    await assert.rejects(()=>postAuditEvent({url:bad,key:'secret',event:{id:'e'},fetchImpl:async()=>{calls++;return new Response(null,{status:204});}}));
    assert.equal(calls,0);
  }
});
test('audit exporter refuses redirects and scopes bearer key to one explicit HTTPS request',async()=>{
  const calls=[];
  const fetchImpl=async(url,init)=>{calls.push({url,init});return new Response(null,{status:204});};
  const r=await postAuditEvent({url:'https://audit.example/v1/events',key:'top-secret',event:{id:'e1'},fetchImpl});
  assert.equal(r.ok,true);assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://audit.example/v1/events');
  assert.equal(calls[0].init.redirect,'error');
  assert.equal(calls[0].init.headers.authorization,'Bearer top-secret');
  assert.deepEqual(JSON.parse(calls[0].init.body),{events:[{id:'e1'}]});
});
test('audit exporter fails closed on non-success response',async()=>{
  await assert.rejects(
    ()=>postAuditEvent({url:'https://audit.example/v1/events',key:'secret',event:{id:'e'},fetchImpl:async()=>new Response(null,{status:503})}),
    /sharedos_audit_http_503/
  );
});
