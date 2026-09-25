import test from 'node:test';
import assert from 'node:assert/strict';
import {ArenaStore} from '../src/store/arena-store.mjs';

function completed(store,{id,txn,service,buyer,price,start='2026-09-25T00:00:00.000Z',end='2026-09-25T00:00:01.000Z',outcome='READY'}){
  store.db.prepare("INSERT INTO requests(request_id,txn_id,fingerprint,service,status,response_json,started_at,completed_at) VALUES(?,?,?,?, 'completed',?,?,?)").run(id,txn,'fp-'+id,service,JSON.stringify({state:'DELIVERED',outcome_state:outcome,trace_id:'trace-'+id,receipt:{buyer_seat:buyer,sharedos_trace_id:'trace-'+id,payment:{txn_id:txn,price_credits:price},proof:{signature:'sig'}}}),start,end);
}
test('Arena stats aggregate credits buyers mix conversion latency and evidence without identities',()=>{
  const s=new ArenaStore(':memory:');
  completed(s,{id:'r1',txn:'t1',service:'sledgewire.smoke',buyer:'i_BUYERAAAA',price:3,end:'2026-09-25T00:00:01.000Z'});
  completed(s,{id:'r2',txn:'t2',service:'sledgewire.assay',buyer:'i_BUYERAAAA',price:8,end:'2026-09-25T00:00:02.000Z'});
  completed(s,{id:'r3',txn:'t3',service:'sledgewire.seal',buyer:'i_BUYERBBBB',price:25,end:'2026-09-25T00:00:03.000Z',outcome:'DEGRADED'});
  s.db.prepare("INSERT INTO requests(request_id,txn_id,fingerprint,service,status,error_json,started_at,completed_at) VALUES('rf','tf','fpf','sledgewire.smoke','failed','{}','2026-09-25T00:00:00.000Z','2026-09-25T00:00:01.000Z')").run();
  s.incrementCounter('arena.reject.wrong_buyer',2);const x=s.arenaStats({prices:{'sledgewire.smoke':3,'sledgewire.assay':8,'sledgewire.seal':25}});
  assert.equal(x.earned_credits,39);assert.equal(x.unique_buyers,2);assert.equal(x.paid_transactions,3);assert.equal(x.failed_requests,1);assert.equal(x.service_mix['sledgewire.smoke'],1);assert.equal(x.outcome_mix.DEGRADED,1);
  assert.equal(x.smoke_buyers,1);assert.equal(x.smoke_to_premium_buyers,1);assert.equal(x.smoke_to_premium_conversion,1);assert.equal(x.delivery_ms.p50,2000);assert.equal(x.delivery_ms.p95,3000);
  assert.equal(x.payment_rejections.wrong_buyer,2);assert.equal(x.integrity.signed_deliveries,3);assert.equal(x.integrity.trace_bound_deliveries,3);assert.equal(JSON.stringify(x).includes('i_BUYER'),false);
});
test('Arena stats are safe and zero-valued on an empty store',()=>{
  const x=new ArenaStore(':memory:').arenaStats({prices:{}});assert.equal(x.earned_credits,0);assert.equal(x.unique_buyers,0);assert.equal(x.delivery_ms.p95,null);assert.equal(x.smoke_to_premium_conversion,0);
});

test('Arena gross earned credits include verified paid claims that later fail execution',()=>{
  const s=new ArenaStore(':memory:');
  s.db.prepare("INSERT INTO requests(request_id,txn_id,fingerprint,service,status,error_json,started_at,completed_at) VALUES('rf2','tf2','fpf2','sledgewire.gauntlet','failed','{}','2026-09-25T00:00:00.000Z','2026-09-25T00:00:01.000Z')").run();
  const x=s.arenaStats({prices:{'sledgewire.gauntlet':35}});
  assert.equal(x.earned_credits,35);assert.equal(x.paid_transactions,1);assert.equal(x.failed_requests,1);assert.equal(x.integrity.unknown_price_claims,0);
});
test('Arena counters increment atomically',async()=>{
  const s=new ArenaStore(':memory:');await Promise.all(Array.from({length:50},async()=>s.incrementCounter('arena.reject.wrong_memo')));
  assert.equal(s.counterMap('arena.reject.')['arena.reject.wrong_memo'],50);
});
