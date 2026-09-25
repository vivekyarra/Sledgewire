import test from 'node:test';
import assert from 'node:assert/strict';
import {ArenaStore} from '../src/store/arena-store.mjs';
import {createKernel,HOST,PURPOSE,ROLES} from '../src/sharedos/host.mjs';

function ctx(actor){return {namespaceId:'sledgewire',actor,authority:HOST,owner:HOST,purpose:PURPOSE,traceId:crypto.randomUUID(),enabledToolNamespaces:['sledgewire'],now:new Date().toISOString()};}
test('dispatcher has no direct target workflow authority',async()=>{
  const store=new ArenaStore(':memory:'),kernel=createKernel(store);
  const result=await kernel.invokeTool(ctx(ROLES.dispatcher),{id:crypto.randomUUID(),tool:'sledgewire.target.smoke',arguments:{endpoint:'https://example.com/mcp'},traceId:crypto.randomUUID(),requestedAt:new Date().toISOString()});
  assert.equal(result.status,'denied');
});
test('mechanic cannot invoke target breaker workflow without exact target grant',async()=>{
  const store=new ArenaStore(':memory:'),kernel=createKernel(store);
  const result=await kernel.invokeTool(ctx(ROLES.mechanic),{id:crypto.randomUUID(),tool:'sledgewire.stage.breaker',arguments:{endpoint:'https://example.com/mcp',name:'danger',arguments:{}},traceId:crypto.randomUUID(),requestedAt:new Date().toISOString()});
  assert.equal(result.status,'denied');
});
