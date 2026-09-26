import test from 'node:test';
import assert from 'node:assert/strict';
import {ArenaStore} from '../src/store/arena-store.mjs';
import {PaymentGate,paymentMemo,requestFingerprint,requestStorageKey} from '../src/core/payment-gate.mjs';

const base={roomId:'rom_ABCDEFGHIJ',buyerSeat:'i_ABCDEFGHIJ',requestId:'req-1',service:'sledgewire.smoke',input:{endpoint:'https://example.com/mcp'},txnId:'txn_ABCDEFGHIJ'};
const payee='p_ABCDEFGHIJ',prices={'sledgewire.smoke':3};
function ledger(overrides={}){return {async get(){return {id:base.txnId,buyer_instance_id:base.buyerSeat,payee_ok:true,addressed_to:payee,amount:3,room_id:base.roomId,memo:paymentMemo(base.requestId,base.service),...overrides};}};}

test('payment required returns exact memo',async()=>{
  const g=new PaymentGate({ledger:ledger(),store:new ArenaStore(),prices,payee}),r=await g.authorize({...base,txnId:null});
  assert.equal(r.reason,'payment_required');assert.equal(r.memo,paymentMemo(base.requestId,base.service));
});
test('valid payment claims once and returns buyer-scoped storage key',async()=>{
  const s=new ArenaStore(),g=new PaymentGate({ledger:ledger(),store:s,prices,payee}),r=await g.authorize(base);
  assert.equal(r.ok,true);assert.equal(r.replay,false);assert.equal(r.storageKey,requestStorageKey(base));
});
for(const [name,over,reason] of [
  ['buyer',{buyer_instance_id:'i_ZYXWVUTSRQ'},'wrong_buyer'],
  ['payee',{payee_ok:false,addressed_to:'p_ZYXWVUTSRQ'},'wrong_payee'],
  ['amount',{amount:4},'wrong_amount'],
  ['room',{room_id:'rom_ZYXWVUTSRQ'},'wrong_room'],
  ['memo',{memo:'bad'},'wrong_memo'],
  ['transaction id',{id:'txn_ZYXWVUTSRQ'},'wrong_transaction_id']
])test(`payment rejects wrong ${name}`,async()=>{
  const g=new PaymentGate({ledger:ledger(over),store:new ArenaStore(),prices,payee});
  assert.equal((await g.authorize(base)).reason,reason);
});
test('principal payee can be proven from caller identity when addressed_to is unavailable',async()=>{
  const g=new PaymentGate({ledger:ledger({addressed_to:null,payee_ok:true}),store:new ArenaStore(),prices,payee});
  assert.equal((await g.authorize(base)).ok,true);
});
test('agent or instance payee requires exact addressed_to proof',async()=>{
  for(const configured of ['a_ABCDEFGHIJ','i_ABCDEFGHIJ']){
    const g=new PaymentGate({ledger:ledger({addressed_to:null,payee_ok:true}),store:new ArenaStore(),prices,payee:configured});
    assert.equal((await g.authorize(base)).reason,'payee_address_unproven');
  }
});
test('completed exact retry returns cached response',async()=>{
  const s=new ArenaStore(),g=new PaymentGate({ledger:ledger(),store:s,prices,payee}),a=await g.authorize(base);
  s.complete(a.storageKey,a.fingerprint,{delivered:true});
  const b=await g.authorize(base);assert.equal(b.replay,true);assert.deepEqual(b.cached,{delivered:true});
});
test('completed exact retry survives gate restart even when transaction ages out of ledger history',async()=>{
  let reads=0;const s=new ArenaStore(),firstLedger={async get(){reads++;return ledger().get();}},g1=new PaymentGate({ledger:firstLedger,store:s,prices,payee});
  const a=await g1.authorize(base);s.complete(a.storageKey,a.fingerprint,{delivered:true,receipt:'stable'});
  const g2=new PaymentGate({ledger:{async get(){reads++;return null;}},store:s,prices,payee});
  const b=await g2.authorize(base);assert.equal(b.ok,true);assert.equal(b.replay,true);assert.deepEqual(b.cached,{delivered:true,receipt:'stable'});assert.equal(reads,1);
});
test('legacy unattributed completed row still requires ledger verification before replay and buyer backfill',async()=>{
  const s=new ArenaStore(),storageKey=requestStorageKey(base),fp=requestFingerprint(base);
  s.db.prepare("INSERT INTO requests(request_id,txn_id,fingerprint,service,buyer_seat,status,response_json,started_at,completed_at) VALUES(?,?,?,?,NULL,'completed',?,?,?)").run(storageKey,base.txnId,fp,base.service,JSON.stringify({delivered:true}),'2026-09-25T00:00:00.000Z','2026-09-25T00:00:01.000Z');
  let reads=0;const g=new PaymentGate({ledger:{async get(){reads++;return ledger().get();}},store:s,prices,payee});
  const r=await g.authorize(base);assert.equal(r.replay,true);assert.equal(reads,1);assert.equal(s.db.prepare('SELECT buyer_seat FROM requests WHERE request_id=?').get(storageKey).buyer_seat,base.buyerSeat);
});
test('fresh inflight exact retry does not reexecute',async()=>{
  const s=new ArenaStore(),g=new PaymentGate({ledger:ledger(),store:s,prices,payee,uncertainAfterMs:60_000});
  await g.authorize(base);const b=await g.authorize(base);assert.equal(b.reason,'request_already_inflight');
});
test('stale inflight paid request becomes explicit unknown outcome and is never blindly reexecuted',async()=>{
  const s=new ArenaStore(),g=new PaymentGate({ledger:ledger(),store:s,prices,payee,uncertainAfterMs:1}),a=await g.authorize(base);
  s.db.prepare('UPDATE requests SET started_at=? WHERE request_id=?').run(new Date(Date.now()-60_000).toISOString(),a.storageKey);
  const b=await g.authorize(base);assert.equal(b.ok,false);assert.equal(b.reason,'execution_outcome_unknown_no_retry');assert.equal(requestFingerprint(base),a.fingerprint);
});
test('same txn cannot buy different request and is rejected from durable binding without another ledger read',async()=>{
  let reads=0;const s=new ArenaStore(),l={async get(){reads++;return ledger().get();}},g=new PaymentGate({ledger:l,store:s,prices,payee});
  await g.authorize(base);const other={...base,requestId:'req-2'},r=await g.authorize(other);assert.equal(r.reason,'transaction_or_request_reused');assert.equal(reads,1);
});
test('same external request id is isolated by buyer seat',async()=>{
  const s=new ArenaStore(),txs={
    txn_BUYERAAAA:{buyer_instance_id:'i_BUYERAAAA',id:'txn_BUYERAAAA'},
    txn_BUYERBBBB:{buyer_instance_id:'i_BUYERBBBB',id:'txn_BUYERBBBB'}
  };
  const l={async get(id){const t=txs[id];return t?{...t,addressed_to:payee,payee_ok:true,amount:3,room_id:base.roomId,memo:paymentMemo('same-id',base.service)}:null;}};
  const g=new PaymentGate({ledger:l,store:s,prices,payee});
  const a=await g.authorize({...base,buyerSeat:'i_BUYERAAAA',requestId:'same-id',txnId:'txn_BUYERAAAA'});
  const b=await g.authorize({...base,buyerSeat:'i_BUYERBBBB',requestId:'same-id',txnId:'txn_BUYERBBBB'});
  assert.equal(a.ok,true);assert.equal(b.ok,true);assert.notEqual(a.storageKey,b.storageKey);assert.notEqual(a.fingerprint,b.fingerprint);
});
test('durable transaction binding rejects a different buyer without re-reading the ledger',async()=>{
  const s=new ArenaStore(),g1=new PaymentGate({ledger:ledger(),store:s,prices,payee}),a=await g1.authorize(base);s.complete(a.storageKey,a.fingerprint,{delivered:true});
  let reads=0;const g2=new PaymentGate({ledger:{async get(){reads++;throw new Error('ledger_should_not_be_called');}},store:s,prices,payee});
  const r=await g2.authorize({...base,buyerSeat:'i_ZYXWVUTSRQ'});assert.equal(r.reason,'wrong_buyer');assert.equal(reads,0);
});
test('fingerprint deterministic',()=>assert.equal(requestFingerprint(base),requestFingerprint(base)));
test('failed request never silently reexecutes',async()=>{
  const s=new ArenaStore(),g=new PaymentGate({ledger:ledger(),store:s,prices,payee}),a=await g.authorize(base);
  s.fail(a.storageKey,a.fingerprint,{message:'boom'});
  const b=await g.authorize(base);assert.equal(b.reason,'previous_attempt_failed');
});
test('bounded grant usage is atomically consumed once',async()=>{
  const s=new ArenaStore(),results=await Promise.all(Array.from({length:8},()=>s.tryConsume('n','g',1)));
  assert.equal(results.filter(Boolean).length,1);
});

test('buyer request storage key is also scoped by Arena room',()=>{
  const a=requestStorageKey({...base,roomId:'rom_ABCDEFGHIJ'}),b=requestStorageKey({...base,roomId:'rom_ZYXWVUTSRQ'});
  assert.notEqual(a,b);
});
test('duplicate authorization wave coalesces ledger lookups',async()=>{
  let reads=0;const s=new ArenaStore(),l={async get(){reads++;await new Promise(r=>setTimeout(r,5));return {id:base.txnId,buyer_instance_id:base.buyerSeat,addressed_to:payee,payee_ok:true,amount:3,room_id:base.roomId,memo:paymentMemo(base.requestId,base.service)};}};
  const g=new PaymentGate({ledger:l,store:s,prices,payee});
  const wave=await Promise.all(Array.from({length:25},()=>g.authorize(base)));
  assert.equal(reads,1);assert.equal(wave.filter(x=>x.ok&&!x.replay).length,1);assert.equal(wave.filter(x=>x.reason==='request_already_inflight').length,24);
});
test('short negative ledger cache collapses missing-transaction bursts',async()=>{
  let reads=0;const g=new PaymentGate({ledger:{async get(){reads++;return null;}},store:new ArenaStore(),prices,payee,ledgerNegativeTtlMs:1000});
  const wave=await Promise.all(Array.from({length:20},()=>g.authorize(base)));
  assert.equal(reads,1);assert.ok(wave.every(x=>x.reason==='transaction_not_found'));
});
