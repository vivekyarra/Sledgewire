import test from 'node:test';
import assert from 'node:assert/strict';
import {ArenaStore,PAYMENT_QUOTE_MAX_GLOBAL,PAYMENT_QUOTE_MAX_PER_BUYER,PAYMENT_QUOTE_TTL_MS} from '../src/store/arena-store.mjs';
import {PaymentGate,requestStorageKey} from '../src/core/payment-gate.mjs';
import {planArenaSpend,eventBudgetStatus,resolveArenaBudgetState} from '../src/sharednet/spend-plan.mjs';
import {createArenaHandler} from '../src/sharednet/handler.mjs';
import {generateSigningKeypair} from '../src/receipts/receipt.mjs';

const room='rom_ABCDEFGHIJ',buyer='i_ABCDEFGHIJ',payee='p_ABCDEFGHIJ',service='sledgewire.smoke',prices={[service]:3};
const base={roomId:room,buyerSeat:buyer,requestId:'resilience-1',service,input:{endpoint:'https://example.com/mcp'},txnId:'txn_ABCDEFGHIJ'};

test('unpaid quote flood is bounded without evicting an already signed quote',()=>{
  const s=new ArenaStore(':memory:'),g=new PaymentGate({ledger:{get:async()=>null},store:s,prices,payee});
  const firstReq={...base,requestId:'flood-0',txnId:null},first=g.issueQuote(firstReq);assert.equal(first.reason,'payment_required');
  let limited=0;
  for(let i=1;i<PAYMENT_QUOTE_MAX_PER_BUYER+200;i++){
    const r=g.issueQuote({...base,requestId:`flood-${i}`,txnId:null});
    if(r.reason==='payment_quote_capacity_reached')limited++;else assert.equal(r.reason,'payment_required');
  }
  const stats=s.paymentQuoteStats();
  assert.equal(stats.max_per_buyer,PAYMENT_QUOTE_MAX_PER_BUYER);
  assert.equal(stats.total,PAYMENT_QUOTE_MAX_PER_BUYER);
  assert.equal(limited,200);
  assert.ok(s.getPaymentQuote(requestStorageKey(firstReq)));
  assert.equal(PAYMENT_QUOTE_MAX_GLOBAL>=PAYMENT_QUOTE_MAX_PER_BUYER,true);
});

test('expired quote is removed and the same request can be safely requoted',()=>{
  const s=new ArenaStore(':memory:'),g=new PaymentGate({ledger:{get:async()=>null},store:s,prices,payee});
  const q=g.issueQuote({...base,txnId:null});assert.equal(q.reason,'payment_required');
  const key=requestStorageKey(base);
  s.db.prepare('UPDATE payment_quotes SET issued_at=?,last_seen_at=? WHERE request_id=?').run(new Date(Date.now()-PAYMENT_QUOTE_TTL_MS-1000).toISOString(),new Date(Date.now()-PAYMENT_QUOTE_TTL_MS-1000).toISOString(),key);
  assert.equal(s.getPaymentQuote(key),null);
  const again=g.issueQuote({...base,txnId:null});assert.equal(again.reason,'payment_required');assert.ok(Date.parse(again.quote_expires_at)>Date.now());
});

test('completed purchase removes transient quote but durable replay remains',async()=>{
  const s=new ArenaStore(':memory:'),ledger={async get(){return {id:base.txnId,buyer_instance_id:buyer,addressed_to:payee,payee_ok:true,amount:3,room_id:room,memo:'Sledgewire'};}};
  const g=new PaymentGate({ledger,store:s,prices,payee});
  g.issueQuote({...base,txnId:null});const a=await g.authorize(base);assert.equal(a.ok,true);
  assert.equal(s.paymentQuoteStats().total,1);
  s.complete(a.storageKey,a.fingerprint,{delivered:true});
  assert.equal(s.paymentQuoteStats().total,0);
  const replay=await g.authorize(base);assert.equal(replay.ok,true);assert.equal(replay.replay,true);assert.deepEqual(replay.cached,{delivered:true});
});

test('Room handler drops oversized messages before parsing or execution',async()=>{
  const s=new ArenaStore(':memory:'),kp=generateSigningKeypair();let reads=0,execs=0;
  const handle=createArenaHandler({store:s,ledger:{async get(){reads++;return null;}},room,payee,signing:{privateKeyPem:kp.privateKeyPem},publicBaseUrl:'https://sledgewire.example',runService:async()=>{execs++;}});
  const huge='@sledgewire '+ 'x'.repeat(40_000);
  const r=await handle({sender_instance_id:buyer,content:huge});
  assert.equal(r,null);assert.equal(reads,0);assert.equal(execs,0);
  assert.equal(s.counterMap('arena.reject.')['arena.reject.message_too_large'],1);
});

test('Arena budget baseline is one-shot and repeated init never moves it',()=>{
  const purse={balance:100,sent:40,received:10,granted:100};
  const first=resolveArenaBudgetState({existing:null,init:true,room,eventBudget:100,purse,now:'2026-09-27T12:00:00.000Z'});
  assert.equal(first.initialization,'initialized');assert.equal(first.state.baseline_sent,40);
  const later=resolveArenaBudgetState({existing:first.state,init:true,room,eventBudget:100,purse:{...purse,sent:75,balance:65},now:'2026-09-27T12:10:00.000Z'});
  assert.equal(later.initialization,'already_initialized');assert.equal(later.state.baseline_sent,40);assert.equal(later.state.initialized_at,first.state.initialized_at);
  assert.throws(()=>resolveArenaBudgetState({existing:null,init:false,room,eventBudget:100,purse}),/not_initialized/);
});

test('Arena budget exposes overspend and planner bounds hostile offer files',()=>{
  assert.deepEqual(eventBudgetStatus({event_budget:100,baseline_sent:5,current_sent:108}),{event_budget:100,arena_sent_delta:103,remaining_to_spend:0,overspent_credits:3,spent_all_event_credits:true});
  assert.throws(()=>planArenaSpend({remaining_credits:100,offers:Array.from({length:5001},(_,i)=>({seller:`s${i}`,service:'x',price_credits:1}))}),/arena_offers_limit/);
});

test('bogus unique payment ids hit the ledger only up to the per-buyer miss budget',async()=>{
  const store=new ArenaStore(':memory:');let reads=0;
  const gate=new PaymentGate({ledger:{async get(){reads++;return null;}},store,prices,payee,ledgerMissPerBuyer:4,ledgerMissGlobal:100,ledgerMissWindowMs:60_000});
  const req={...base,requestId:'miss-budget',txnId:null};gate.issueQuote(req);
  const reasons=[];
  for(let i=0;i<10;i++)reasons.push((await gate.authorize({...req,txnId:`txn_${String(i).padStart(10,'0')}`})).reason);
  assert.equal(reads,4);
  assert.equal(reasons.filter(x=>x==='transaction_not_found').length,4);
  assert.equal(reasons.filter(x=>x==='payment_verification_rate_limited').length,6);
});

test('global bogus-payment breaker caps aggregate ledger misses across many seats',async()=>{
  const store=new ArenaStore(':memory:');let reads=0;
  const gate=new PaymentGate({ledger:{async get(){reads++;return null;}},store,prices,payee,ledgerMissPerBuyer:100,ledgerMissGlobal:5,ledgerMissWindowMs:60_000});
  const reasons=[];
  for(let i=0;i<12;i++){
    const buyerSeat='i_'+String(i).padStart(10,'0');
    const req={...base,buyerSeat,requestId:`global-miss-${i}`,txnId:null};gate.issueQuote(req);
    reasons.push((await gate.authorize({...req,txnId:`txn_${String(i).padStart(10,'0')}`})).reason);
  }
  assert.equal(reads,5);
  assert.equal(reasons.filter(x=>x==='transaction_not_found').length,5);
  assert.equal(reasons.filter(x=>x==='payment_verification_rate_limited').length,7);
});
