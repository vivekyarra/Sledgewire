import test from 'node:test';
import assert from 'node:assert/strict';
import {validateServiceInput} from '../src/core/service-input.mjs';
import {ArenaStore} from '../src/store/arena-store.mjs';
import {createArenaHandler} from '../src/sharednet/handler.mjs';
import {generateSigningKeypair} from '../src/receipts/receipt.mjs';

test('valid paid smoke input passes structural prepayment validation',()=>{
  assert.deepEqual(validateServiceInput('sledgewire.smoke',{endpoint:'https://example.com/mcp'}),{ok:true});
});
for(const endpoint of ['http://example.com/mcp','https://127.0.0.1/mcp','https://169.254.169.254/latest','https://user:pass@example.com/mcp','https://example.com/mcp#fragment'])
  test(`unsafe endpoint rejected before payment: ${endpoint}`,()=>assert.equal(validateServiceInput('sledgewire.smoke',{endpoint}).ok,false));
test('unknown-tool protocol mutation authority must be an explicit boolean',()=>{
  assert.equal(validateServiceInput('sledgewire.assay',{endpoint:'https://example.com/mcp',probe:{authorizeUnknownToolProbe:true}}).ok,true);
  assert.equal(validateServiceInput('sledgewire.assay',{endpoint:'https://example.com/mcp',probe:{authorizeUnknownToolProbe:'yes'}}).reason,'probe_unknown_tool_authority');
});
test('fleet over six targets is rejected',()=>{
  const targets=Array.from({length:7},(_,i)=>({endpoint:`https://example.com/${i}`}));
  assert.equal(validateServiceInput('sledgewire.fleet',{targets}).reason,'fleet_targets_1_to_6');
});
test('invoke requires an explicit tool name',()=>{
  assert.equal(validateServiceInput('sledgewire.invoke',{endpoint:'https://example.com/mcp',request:{arguments:{}}}).reason,'invoke_tool_name');
});
test('unknown paid input fields are rejected',()=>{
  assert.equal(validateServiceInput('sledgewire.smoke',{endpoint:'https://example.com/mcp',surprise:true}).reason,'unexpected_top_level_field');
});
test('deep paid input is rejected without recursive stack risk',()=>{
  let x={};let cursor=x;for(let i=0;i<30;i++){cursor.n={};cursor=cursor.n;}
  const r=validateServiceInput('sledgewire.invoke',{endpoint:'https://example.com/mcp',request:{name:'x',arguments:{},evidence:x}});
  assert.equal(r.ok,false);assert.equal(r.reason,'json_depth_limit');
});
test('invalid paid input fails before payment or ledger lookup',async()=>{
  let ledgerReads=0;const kp=generateSigningKeypair();
  const handle=createArenaHandler({store:new ArenaStore(':memory:'),ledger:{async get(){ledgerReads++;return null;}},room:'rom_ABCDEFGHIJ',payee:'p_ABCDEFGHIJ',signing:{privateKeyPem:kp.privateKeyPem},publicBaseUrl:'https://sledgewire.example'});
  const r=await handle({sender_instance_id:'i_ZYXWVUTSRQ',content:JSON.stringify({type:'sledgewire.service.request.v1',request_id:'req-invalid',service:'sledgewire.fleet',input:{targets:[]}})});
  assert.equal(r.state,'FAILED');assert.equal(r.reason,'invalid_input');assert.equal(ledgerReads,0);
});
