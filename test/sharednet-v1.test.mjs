import test from 'node:test';
import assert from 'node:assert/strict';
import {SEAT,ADDRESS,ROOM,TXN,INSTANCE_TOKEN,normalizeTransfer,SharedNetApi,parseWatchBatch,senderInstance,payeeBelongsToIdentity,MAX_ARTIFACT_BYTES,MAX_SHAREDNET_JSON_BYTES,MAX_SHAREDNET_PAGE_BYTES} from '../src/sharednet/api.mjs';
import {ArenaStore} from '../src/store/arena-store.mjs';
import {createArenaHandler} from '../src/sharednet/handler.mjs';
import {generateSigningKeypair,verifyReceipt} from '../src/receipts/receipt.mjs';
import {paymentMemo,requestFingerprint} from '../src/core/payment-gate.mjs';

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
test('arena handler converts natural-language buyer needs into non-executing exact quotes',async()=>{
  const store=new ArenaStore(':memory:');const kp=generateSigningKeypair();let executions=0,reads=0;
  const handle=createArenaHandler({store,ledger:{async get(){reads++;return null;}},room:'rom_ABCDEFGHIJ',payee:'p_ABCDEFGHIJ',signing:{privateKeyPem:kp.privateKeyPem},publicBaseUrl:'https://sledgewire.example',runService:async()=>{executions++;throw new Error('must_not_execute');}});
  const pre=await handle({sender_instance_id:'i_ZYXWVUTSRQ',content:'@sledgewire preflight https://example.com/mcp'});
  assert.equal(pre.type,'sledgewire.quote.response.v1');assert.equal(pre.recommended_service,'sledgewire.smoke');assert.equal(pre.request_ready,true);
  const sec=await handle({sender_instance_id:'i_ZYXWVUTSRQ',content:'@sledgewire security https://example.com/mcp'});
  assert.equal(sec.recommended_service,'sledgewire.assay');assert.equal(sec.price_credits,8);
  const fleet=await handle({sender_instance_id:'i_ZYXWVUTSRQ',content:'@sledgewire compare https://a.example/mcp https://b.example/mcp'});
  assert.equal(fleet.recommended_service,'sledgewire.fleet');assert.equal(fleet.request_ready,true);
  assert.equal(executions,0);assert.equal(reads,0);
});
test('arena handler answers value authority verification scope and quickstart questions deterministically',async()=>{
  const store=new ArenaStore(':memory:');const kp=generateSigningKeypair();const handle=createArenaHandler({store,ledger:{get:async()=>null},room:'rom_ABCDEFGHIJ',payee:'p_ABCDEFGHIJ',signing:{privateKeyPem:kp.privateKeyPem},publicBaseUrl:'https://sledgewire.example'});
  for(const [text,kind] of [['@sledgewire why is this useful?','value'],['@sledgewire explain SharedOS grants','sharedos'],['@sledgewire how do I verify a trace?','verification'],['@sledgewire what are the limits and compatibility?','scope'],['@sledgewire how do I call it?','quickstart']]){
    const r=await handle({sender_instance_id:'i_ZYXWVUTSRQ',content:text});assert.equal(r.type,'sledgewire.info.v1');assert.equal(r.kind,kind);assert.equal(r.quickstart,'https://sledgewire.example/arena.md');
  }
});
test('arena typed quote accepts buyer-friendly aliases and malformed quote fails without poisoning handler',async()=>{
  const store=new ArenaStore(':memory:');const kp=generateSigningKeypair();const handle=createArenaHandler({store,ledger:{get:async()=>null},room:'rom_ABCDEFGHIJ',payee:'p_ABCDEFGHIJ',signing:{privateKeyPem:kp.privateKeyPem},publicBaseUrl:'https://sledgewire.example'});
  const ok=await handle({sender_instance_id:'i_ZYXWVUTSRQ',content:JSON.stringify({type:'sledgewire.quote.request.v1',request_id:'q1',intent:'dossier',endpoint:'https://example.com/mcp'})});
  assert.equal(ok.intent,'full_dossier');assert.equal(ok.recommended_service,'sledgewire.gauntlet');assert.equal(ok.price_credits,35);
  const bad=await handle({sender_instance_id:'i_ZYXWVUTSRQ',content:JSON.stringify({type:'sledgewire.quote.request.v1',request_id:'q2',intent:'nonsense',endpoint:'https://example.com/mcp'})});
  assert.equal(bad.state,'FAILED');assert.equal(bad.reason,'unsupported_quote_intent');
});
test('arena handler returns signed buyer-bound payment requirement before execution',async()=>{
  const store=new ArenaStore(':memory:');const kp=generateSigningKeypair();const handle=createArenaHandler({store,ledger:{get:async()=>null},room:'rom_ABCDEFGHIJ',payee:'p_ABCDEFGHIJ',signing:{privateKeyPem:kp.privateKeyPem},publicBaseUrl:'https://sledgewire.example'});
  const r=await handle({sender_instance_id:'i_ZYXWVUTSRQ',content:JSON.stringify({type:'sledgewire.service.request.v1',request_id:'req-abc',service:'sledgewire.smoke',input:{endpoint:'https://example.com/mcp'}})});
  const bound={roomId:'rom_ABCDEFGHIJ',buyerSeat:'i_ZYXWVUTSRQ',requestId:'req-abc',service:'sledgewire.smoke',input:{endpoint:'https://example.com/mcp'}};assert.equal(r.type,'sledgewire.payment_required.v1');assert.equal(r.price_credits,3);assert.match(r.deliverable,/smoke test/i);assert.equal(r.verification.exact_retry_no_reexecution,true);assert.equal(r.room_id,'rom_ABCDEFGHIJ');assert.equal(r.memo,paymentMemo(bound));assert.equal(r.request_fingerprint,requestFingerprint(bound));assert.equal(r.memo_version,'sledgewire.payment.v2');assert.equal(r.next_action.memo,r.memo);assert.equal(r.buyer_seat,'i_ZYXWVUTSRQ');assert.equal(verifyReceipt(r,kp.publicKeyPem).ok,true);
});
test('Room payment quote cannot authorize changed target input on first paid resend',async()=>{
  const store=new ArenaStore(':memory:'),kp=generateSigningKeypair();let executions=0,reads=0,quotedMemo=null;
  const ledger={async get(){reads++;return {id:'txn_ABCDEFGHIJ',buyer_instance_id:'i_ZYXWVUTSRQ',addressed_to:'p_ABCDEFGHIJ',payee_ok:true,amount:3,room_id:'rom_ABCDEFGHIJ',memo:quotedMemo};}};
  const handle=createArenaHandler({store,ledger,room:'rom_ABCDEFGHIJ',payee:'p_ABCDEFGHIJ',signing:{privateKeyPem:kp.privateKeyPem},publicBaseUrl:'https://sledgewire.example',runService:async()=>{executions++;return {service:'sledgewire.smoke',state:'READY'};}});
  const original={type:'sledgewire.service.request.v1',request_id:'req-bind',service:'sledgewire.smoke',input:{endpoint:'https://one.example/mcp'}};
  const quote=await handle({sender_instance_id:'i_ZYXWVUTSRQ',content:JSON.stringify(original)});quotedMemo=quote.memo;
  const altered={...original,input:{endpoint:'https://two.example/mcp'},payment_txn_id:'txn_ABCDEFGHIJ'};
  const r=await handle({sender_instance_id:'i_ZYXWVUTSRQ',content:JSON.stringify(altered)});
  assert.equal(r.state,'FAILED');assert.equal(r.reason,'wrong_memo');assert.equal(reads,1);assert.equal(executions,0);
});
test('paid execution failure is signed and exact retries replay it without ledger read or reexecution',async()=>{
  const store=new ArenaStore(':memory:'),kp=generateSigningKeypair();let executions=0,reads=0;
  const bound={roomId:'rom_ABCDEFGHIJ',buyerSeat:'i_ZYXWVUTSRQ',requestId:'req-fail',service:'sledgewire.smoke',input:{endpoint:'https://example.com/mcp'}};const ledger={async get(){reads++;return {id:'txn_ABCDEFGHIJ',buyer_instance_id:'i_ZYXWVUTSRQ',addressed_to:'p_ABCDEFGHIJ',payee_ok:true,amount:3,room_id:'rom_ABCDEFGHIJ',memo:paymentMemo(bound)};}};
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
