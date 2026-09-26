import test from 'node:test';
import assert from 'node:assert/strict';
import {SEAT,ADDRESS,ROOM,TXN,INSTANCE_TOKEN,normalizeTransfer,SharedNetApi,parseWatchBatch,senderInstance,payeeBelongsToIdentity,MAX_ARTIFACT_BYTES,MAX_SHAREDNET_JSON_BYTES,MAX_SHAREDNET_PAGE_BYTES} from '../src/sharednet/api.mjs';
import {ArenaStore} from '../src/store/arena-store.mjs';
import {createArenaHandler} from '../src/sharednet/handler.mjs';
import {generateSigningKeypair,verifyReceipt} from '../src/receipts/receipt.mjs';

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
test('arena handler returns signed buyer-bound payment requirement before execution',async()=>{
  const store=new ArenaStore(':memory:');const kp=generateSigningKeypair();const handle=createArenaHandler({store,ledger:{get:async()=>null},room:'rom_ABCDEFGHIJ',payee:'p_ABCDEFGHIJ',signing:{privateKeyPem:kp.privateKeyPem},publicBaseUrl:'https://sledgewire.example'});
  const r=await handle({sender_instance_id:'i_ZYXWVUTSRQ',content:JSON.stringify({type:'sledgewire.service.request.v1',request_id:'req-abc',service:'sledgewire.smoke',input:{endpoint:'https://example.com/mcp'}})});
  assert.equal(r.type,'sledgewire.payment_required.v1');assert.equal(r.price_credits,3);assert.equal(r.room_id,'rom_ABCDEFGHIJ');assert.equal(r.memo,'sledgewire:req-abc:sledgewire.smoke');assert.equal(r.buyer_seat,'i_ZYXWVUTSRQ');assert.equal(verifyReceipt(r,kp.publicKeyPem).ok,true);
});
test('structured Arena rejection is signed and scoped to buyer and Room',async()=>{
  const store=new ArenaStore(':memory:'),kp=generateSigningKeypair();
  const handle=createArenaHandler({store,ledger:{get:async()=>null},room:'rom_ABCDEFGHIJ',payee:'p_ABCDEFGHIJ',signing:{privateKeyPem:kp.privateKeyPem},publicBaseUrl:'https://sledgewire.example'});
  const r=await handle({sender_instance_id:'i_ZYXWVUTSRQ',content:JSON.stringify({type:'sledgewire.service.request.v1',request_id:'req-paid',service:'sledgewire.smoke',input:{endpoint:'https://example.com/mcp'},payment_txn_id:'txn_ABCDEFGHIJ'})});
  assert.equal(r.state,'FAILED');assert.equal(r.reason,'transaction_not_found');assert.equal(r.room_id,'rom_ABCDEFGHIJ');assert.equal(r.buyer_seat,'i_ZYXWVUTSRQ');assert.equal(r.payment_txn_id,'txn_ABCDEFGHIJ');assert.equal(verifyReceipt(r,kp.publicKeyPem).ok,true);
});
test('invalid pre-payment service request returns a signed bounded rejection',async()=>{
  const store=new ArenaStore(':memory:'),kp=generateSigningKeypair();
  const handle=createArenaHandler({store,ledger:{get:async()=>null},room:'rom_ABCDEFGHIJ',payee:'p_ABCDEFGHIJ',signing:{privateKeyPem:kp.privateKeyPem},publicBaseUrl:'https://sledgewire.example'});
  const r=await handle({sender_instance_id:'i_ZYXWVUTSRQ',content:JSON.stringify({type:'sledgewire.service.request.v1',request_id:'req-invalid',service:'sledgewire.fleet',input:{targets:[]}})});
  assert.equal(r.state,'FAILED');assert.equal(r.reason,'invalid_input');assert.equal(r.buyer_seat,'i_ZYXWVUTSRQ');assert.equal(verifyReceipt(r,kp.publicKeyPem).ok,true);
});
test('Room selector response and invalid selector rejection are signed',async()=>{
  const store=new ArenaStore(':memory:'),kp=generateSigningKeypair();
  const handle=createArenaHandler({store,ledger:{get:async()=>null},room:'rom_ABCDEFGHIJ',payee:'p_ABCDEFGHIJ',signing:{privateKeyPem:kp.privateKeyPem},publicBaseUrl:'https://sledgewire.example'});
  const ok=await handle({sender_instance_id:'i_ZYXWVUTSRQ',content:JSON.stringify({type:'sledgewire.quote.request.v1',request_id:'quote-ok',intent:'preflight',endpoint:'https://example.com/mcp'})});
  assert.equal(ok.type,'sledgewire.quote.response.v1');assert.equal(ok.buyer_seat,'i_ZYXWVUTSRQ');assert.equal(verifyReceipt(ok,kp.publicKeyPem).ok,true);
  const bad=await handle({sender_instance_id:'i_ZYXWVUTSRQ',content:JSON.stringify({type:'sledgewire.quote.request.v1',request_id:'quote-bad',intent:'magic'})});
  assert.equal(bad.state,'FAILED');assert.equal(bad.reason,'invalid_quote_request');assert.equal(verifyReceipt(bad,kp.publicKeyPem).ok,true);
});

test('paid execution failure is signed and exact retries replay it without ledger read or reexecution',async()=>{
  const store=new ArenaStore(':memory:'),kp=generateSigningKeypair();let executions=0,reads=0;
  const ledger={async get(){reads++;return {id:'txn_ABCDEFGHIJ',buyer_instance_id:'i_ZYXWVUTSRQ',addressed_to:'p_ABCDEFGHIJ',payee_ok:true,amount:3,room_id:'rom_ABCDEFGHIJ',memo:'sledgewire:req-fail:sledgewire.smoke'};}};
  const handle=createArenaHandler({store,ledger,room:'rom_ABCDEFGHIJ',payee:'p_ABCDEFGHIJ',signing:{privateKeyPem:kp.privateKeyPem},publicBaseUrl:'https://sledgewire.example',runService:async()=>{executions++;throw new Error('fixture_boom');}});
  const message={sender_instance_id:'i_ZYXWVUTSRQ',content:JSON.stringify({type:'sledgewire.service.request.v1',request_id:'req-fail',service:'sledgewire.smoke',input:{endpoint:'https://example.com/mcp'},payment_txn_id:'txn_ABCDEFGHIJ'})};
  const first=await handle(message);assert.equal(first.state,'FAILED');assert.equal(first.reason,'execution_failed');assert.equal(first.receipt.payment.txn_id,'txn_ABCDEFGHIJ');assert.equal(first.receipt.buyer_seat,'i_ZYXWVUTSRQ');assert.equal(verifyReceipt(first.receipt,kp.publicKeyPem).ok,true);
  const second=await handle(message);assert.equal(second.receipt.proof.signature,first.receipt.proof.signature);assert.equal(executions,1);assert.equal(reads,1);
});
test('arena store remembers processed room messages and cursors',()=>{const s=new ArenaStore(':memory:');assert.equal(s.roomMessageSeen('msg_1'),false);s.markRoomMessage('msg_1');assert.equal(s.roomMessageSeen('msg_1'),true);s.setMeta('cursor','42');assert.equal(s.getMeta('cursor'),'42');});


test('payee must belong to current SharedNet identity',()=>{
  const identity={principal:{id:'p_ABCDEFGHIJ'},agent:{id:'a_ABCDEFGHIJ'},instance:{id:'i_ABCDEFGHIJ'}};
  assert.equal(payeeBelongsToIdentity('p_ABCDEFGHIJ',identity),true);
  assert.equal(payeeBelongsToIdentity('a_ABCDEFGHIJ',identity),true);
  assert.equal(payeeBelongsToIdentity('i_ABCDEFGHIJ',identity),true);
  assert.equal(payeeBelongsToIdentity('p_ZYXWVUTSRQ',identity),false);
});
test('SharedNet API retries a transient 503 then succeeds',async()=>{
  const token='sni_'+ 'A'.repeat(43);let calls=0;
  const fetchImpl=async()=>{calls++;if(calls===1)return new Response(JSON.stringify({error:{code:'service_unavailable'}}),{status:503});return new Response(JSON.stringify({credits:{balance:100}}),{status:200});};
  const api=new SharedNetApi({token,fetchImpl,retryBaseMs:1});const r=await api.credits();assert.equal(r.credits.balance,100);assert.equal(calls,2);
});
test('artifact upload rejects content larger than SharedNet ceiling before network',async()=>{
  const token='sni_'+ 'A'.repeat(43);let calls=0;const api=new SharedNetApi({token,fetchImpl:async()=>{calls++;return new Response('{}',{status:201});}});
  await assert.rejects(()=>api.uploadArtifact(Buffer.alloc(MAX_ARTIFACT_BYTES+1),{roomId:'rom_ABCDEFGHIJ'}),/artifact_too_large/);assert.equal(calls,0);
});

test('SharedNet API bounds JSON responses before parsing',async()=>{
  const token='sni_'+ 'A'.repeat(43);
  const api=new SharedNetApi({token,maxResponseBytes:128,fetchImpl:async()=>new Response(JSON.stringify({padding:'x'.repeat(1000)}),{status:200})});
  await assert.rejects(()=>api.credits(),/sharednet_response_too_large/);
});
test('SharedNet base URL must be an origin and cannot smuggle credentials or a path',()=>{
  const token='sni_'+ 'A'.repeat(43);
  assert.throws(()=>new SharedNetApi({token,baseUrl:'https://www.sharednet.ai/api/v1'}),/origin_only/);
  assert.throws(()=>new SharedNetApi({token,baseUrl:'https://u:p@www.sharednet.ai'}),/credentials/);
});
test('SharedNet wait cursor rejects negative and non-integer values before network',async()=>{
  const token='sni_'+ 'A'.repeat(43);let calls=0;
  const api=new SharedNetApi({token,fetchImpl:async()=>{calls++;return new Response('{}',{status:200});}});
  await assert.rejects(()=>api.wait('rom_ABCDEFGHIJ',-1),/invalid_sharednet_wait_cursor/);
  await assert.rejects(()=>api.wait('rom_ABCDEFGHIJ',1.5),/invalid_sharednet_wait_cursor/);
  assert.equal(calls,0);
});
test('SharedNet artifact response is validated and relative trusted URLs are normalized',async()=>{
  const token='sni_'+ 'A'.repeat(43);let n=0;
  const api=new SharedNetApi({token,fetchImpl:async()=>{n++;return new Response(JSON.stringify(n===1?{artifact:{id:'art_ABCDEFGHIJ'},url:'/api/v1/artifacts/art_ABCDEFGHIJ'}:{}),{status:201});}});
  const ok=await api.uploadArtifact('x',{roomId:'rom_ABCDEFGHIJ'});assert.equal(ok.url,'https://www.sharednet.ai/api/v1/artifacts/art_ABCDEFGHIJ');
  await assert.rejects(()=>api.uploadArtifact('x',{roomId:'rom_ABCDEFGHIJ'}),/artifact_response_invalid/);
});

test('SharedNet transfer direction string alone cannot prove incoming payment',()=>{
  const id={principal:{id:'p_ABCDEFGHIJ'},instance:{id:'i_ABCDEFGHIJ'}};
  const tx=normalizeTransfer({id:'txn_ABCDEFGHIJ',sender_instance_id:'i_ZYXWVUTSRQ',direction:'received',amount:3,room_id:'rom_ABCDEFGHIJ',memo:'m'},id);
  assert.equal(tx.payee_ok,false);
});
test('SharedNet base rejects non-HTTP schemes even for localhost',()=>{
  const token='sni_'+ 'A'.repeat(43);
  assert.throws(()=>new SharedNetApi({token,baseUrl:'ftp://localhost'}),/must_be_https/);
});
test('SharedNet artifact URL must stay on configured origin',async()=>{
  const token='sni_'+ 'A'.repeat(43);
  const api=new SharedNetApi({token,fetchImpl:async()=>new Response(JSON.stringify({artifact:{id:'art_ABCDEFGHIJ'},url:'https://evil.example/file'}),{status:201})});
  await assert.rejects(()=>api.uploadArtifact('x',{roomId:'rom_ABCDEFGHIJ'}),/artifact_response_invalid/);
});
test('SharedNet message page can exceed generic JSON ceiling but remains bounded by page ceiling',async()=>{
  const token='sni_'+ 'A'.repeat(43),padding='x'.repeat(MAX_SHAREDNET_JSON_BYTES+100_000);
  const api=new SharedNetApi({token,fetchImpl:async()=>new Response(JSON.stringify({items:[{content:padding}],next_cursor:null,has_more:false}),{status:200})});
  const r=await api.messages('rom_ABCDEFGHIJ');assert.equal(r.items[0].content.length,padding.length);assert.ok(MAX_SHAREDNET_PAGE_BYTES>MAX_SHAREDNET_JSON_BYTES);
});
