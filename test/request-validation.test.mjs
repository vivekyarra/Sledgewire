import test from 'node:test';
import assert from 'node:assert/strict';
import {ArenaStore} from '../src/store/arena-store.mjs';
import {createArenaHandler} from '../src/sharednet/handler.mjs';
import {generateSigningKeypair} from '../src/receipts/receipt.mjs';

function handler(){const kp=generateSigningKeypair();return createArenaHandler({store:new ArenaStore(':memory:'),ledger:{get:async()=>null},room:'rom_ABCDEFGHIJ',payee:'p_ABCDEFGHIJ',signing:{privateKeyPem:kp.privateKeyPem},publicBaseUrl:'https://sledgewire.example'});}
test('arena request id accepts compact machine-safe identifiers',async()=>{const r=await handler()({sender_instance_id:'i_ZYXWVUTSRQ',content:JSON.stringify({type:'sledgewire.service.request.v1',request_id:'req_2026-09.abc',service:'sledgewire.smoke',input:{endpoint:'https://example.com/mcp'}})});assert.equal(r.type,'sledgewire.payment_required.v1');});
for(const bad of ['ab','bad:id','bad id','bad\nline','x'.repeat(97)])test(`arena request id rejects unsafe form ${JSON.stringify(bad).slice(0,24)}`,async()=>{const r=await handler()({sender_instance_id:'i_ZYXWVUTSRQ',content:JSON.stringify({type:'sledgewire.service.request.v1',request_id:bad,service:'sledgewire.smoke',input:{endpoint:'https://example.com/mcp'}})});assert.equal(r.state,'FAILED');assert.equal(r.reason,'invalid_request_id');});
