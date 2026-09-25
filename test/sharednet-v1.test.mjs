import test from 'node:test';
import assert from 'node:assert/strict';
import {SEAT,ADDRESS,ROOM,TXN,INSTANCE_TOKEN,normalizeTransfer,SharedNetApi,parseWatchBatch,senderInstance} from '../src/sharednet/api.mjs';
import {ArenaStore} from '../src/store/arena-store.mjs';
import {createArenaHandler} from '../src/sharednet/handler.mjs';
import {generateSigningKeypair} from '../src/receipts/receipt.mjs';

test('SharedNet live short identifier formats are accepted',()=>{
  assert.ok(SEAT.test('i_AbCdEfGhIj'));assert.ok(ADDRESS.test('p_AbCdEfGhIj'));assert.ok(ADDRESS.test('a_AbCdEfGhIj'));assert.ok(ROOM.test('rom_AbCdEfGhIj'));assert.ok(TXN.test('txn_AbCdEfGhIj'));assert.ok(INSTANCE_TOKEN.test('sni_'+ 'A'.repeat(43)));
});
test('future typed identifier forms are tolerated without weakening prefixes',()=>{
  assert.ok(SEAT.test('ins_'+ 'A'.repeat(26)));assert.ok(ADDRESS.test('pri_'+ 'A'.repeat(26)));assert.ok(ADDRESS.test('agt_'+ 'A'.repeat(26)));assert.ok(ROOM.test('rom_'+ 'A'.repeat(26)));assert.equal(SEAT.test('p_AbCdEfGhIj'),false);
});
test('legacy/current transfer shape normalizes incoming payment',()=>{
  const id={principal:{id:'p_ABCDEFGHIJ'},agent:{id:'a_ABCDEFGHIJ'},instance:{id:'i_ABCDEFGHIJ'}};
  const tx=normalizeTransfer({id:'txn_ABCDEFGHIJ',by_instance_id:'i_ZYXWVUTSRQ',addressed_to:'i_ABCDEFGHIJ',amount:8,room_id:'rom_ABCDEFGHIJ',memo:'m'},id);
  assert.equal(tx.buyer_instance_id,'i_ZYXWVUTSRQ');assert.equal(tx.payee_ok,true);assert.equal(tx.amount,8);
});
test('principal-recipient transfer shape verifies from caller perspective',()=>{
  const id={principal:{id:'p_ABCDEFGHIJ'},agent:null,instance:{id:'i_ABCDEFGHIJ'}};
  const tx=normalizeTransfer({id:'txn_ABCDEFGHIJ',sender_instance_id:'i_ZYXWVUTSRQ',recipient_principal_id:'p_ABCDEFGHIJ',amount:3,room_id:'rom_ABCDEFGHIJ',memo:'m'},id);
  assert.equal(tx.payee_ok,true);
});
test('outgoing transfer is never accepted as payee proof',()=>{
  const id={principal:{id:'p_ABCDEFGHIJ'},instance:{id:'i_ABCDEFGHIJ'}};
  const tx=normalizeTransfer({id:'txn_ABCDEFGHIJ',sender_instance_id:'i_ABCDEFGHIJ',recipient_principal_id:'p_ZYXWVUTSRQ',amount:3,room_id:'rom_ABCDEFGHIJ',memo:'m'},id);
  assert.equal(tx.payee_ok,false);
});
test('SharedNet API ledger lookup uses bearer token and caller identity',async()=>{
  const token='sni_'+ 'A'.repeat(43);const calls=[];
  const fetchImpl=async(url,init)=>{calls.push({url,auth:init.headers.authorization});
    if(url.endsWith('/api/v1/instances/current'))return new Response(JSON.stringify({principal:{id:'p_ABCDEFGHIJ'},instance:{id:'i_ABCDEFGHIJ'},agent:null}),{status:200});
    if(url.includes('/api/v1/credits/transfers'))return new Response(JSON.stringify({items:[{id:'txn_ABCDEFGHIJ',sender_instance_id:'i_ZYXWVUTSRQ',recipient_principal_id:'p_ABCDEFGHIJ',amount:3,room_id:'rom_ABCDEFGHIJ',memo:'m'}],has_more:false,next_cursor:null}),{status:200});
    throw new Error('unexpected_url');
  };
  const api=new SharedNetApi({token,fetchImpl});const tx=await api.get('txn_ABCDEFGHIJ');assert.equal(tx.payee_ok,true);assert.equal(tx.buyer_instance_id,'i_ZYXWVUTSRQ');assert.ok(calls.every(x=>x.auth===`Bearer ${token}`));
});
test('watch batch parses current SharedNet message fields',()=>{
  const raw=JSON.stringify({room_id:'rom_ABCDEFGHIJ',messages:[{id:'msg_ABCDEFGHIJ',room_id:'rom_ABCDEFGHIJ',sender_instance_id:'i_ZYXWVUTSRQ',content:'@sledgewire demo'}]});
  const b=parseWatchBatch(raw);assert.equal(b.messages.length,1);assert.equal(senderInstance(b.messages[0]),'i_ZYXWVUTSRQ');
});
test('watch batch refuses wrong-room mixed messages',()=>assert.throws(()=>parseWatchBatch(JSON.stringify({room_id:'rom_ABCDEFGHIJ',messages:[{room_id:'rom_ZYXWVUTSRQ',sender_instance_id:'i_ZYXWVUTSRQ',content:'x'}]})),/wrong|invalid/));
test('arena handler answers product demo questions without payment',async()=>{
  const store=new ArenaStore(':memory:');const kp=generateSigningKeypair();const handle=createArenaHandler({store,ledger:{get:async()=>null},room:'rom_ABCDEFGHIJ',payee:'p_ABCDEFGHIJ',signing:{privateKeyPem:kp.privateKeyPem},publicBaseUrl:'https://sledgewire.example'});
  const r=await handle({sender_instance_id:'i_ZYXWVUTSRQ',content:'@sledgewire show me a demo'});assert.equal(r.type,'sledgewire.info.v1');assert.match(r.message,/selfcheck/i);
});
test('arena handler returns exact payment requirement before execution',async()=>{
  const store=new ArenaStore(':memory:');const kp=generateSigningKeypair();const handle=createArenaHandler({store,ledger:{get:async()=>null},room:'rom_ABCDEFGHIJ',payee:'p_ABCDEFGHIJ',signing:{privateKeyPem:kp.privateKeyPem},publicBaseUrl:'https://sledgewire.example'});
  const r=await handle({sender_instance_id:'i_ZYXWVUTSRQ',content:JSON.stringify({type:'sledgewire.service.request.v1',request_id:'req-abc',service:'sledgewire.smoke',input:{endpoint:'https://example.com/mcp'}})});
  assert.equal(r.type,'sledgewire.payment_required.v1');assert.equal(r.price_credits,3);assert.equal(r.room_id,'rom_ABCDEFGHIJ');assert.equal(r.memo,'sledgewire:req-abc:sledgewire.smoke');
});
test('arena store remembers processed room messages and cursors',()=>{const s=new ArenaStore(':memory:');assert.equal(s.roomMessageSeen('msg_1'),false);s.markRoomMessage('msg_1');assert.equal(s.roomMessageSeen('msg_1'),true);s.setMeta('cursor','42');assert.equal(s.getMeta('cursor'),'42');});
