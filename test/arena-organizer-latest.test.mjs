import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {planArenaSpend,eventBudgetStatus} from '../src/sharednet/spend-plan.mjs';
import {readExpectedArenaSeat,writeArenaSeatBinding} from '../src/sharednet/seat-binding.mjs';

test('Arena spend planner can exhaust exactly 100 credits while preferring seller diversity',()=>{
  const offers=[
    {id:'a1',seller:'A',service:'x',price_credits:35,utility:5},
    {id:'b1',seller:'B',service:'x',price_credits:25,utility:4},
    {id:'c1',seller:'C',service:'x',price_credits:20,utility:4},
    {id:'d1',seller:'D',service:'x',price_credits:20,utility:3},
    {id:'a2',seller:'A',service:'y',price_credits:40,utility:10}
  ];
  const p=planArenaSpend({remaining_credits:100,offers});
  assert.equal(p.exact,true);assert.equal(p.planned_spend,100);assert.equal(p.unallocated_credits,0);assert.equal(p.distinct_sellers,4);
  assert.equal(p.purchases.reduce((n,x)=>n+x.price_credits,0),100);
});
test('Arena spend planner never invents an exact plan when discovered worthwhile offers cannot fill the balance',()=>{
  const p=planArenaSpend({remaining_credits:17,offers:[
    {seller:'A',service:'x',price_credits:10,utility:2},
    {seller:'B',service:'y',price_credits:6,utility:3}
  ]});
  assert.equal(p.exact,false);assert.equal(p.planned_spend,16);assert.equal(p.unallocated_credits,1);assert.equal(p.needs_more_offers,true);
});
test('Arena event budget is based on sent-total delta rather than current balance',()=>{
  const s=eventBudgetStatus({event_budget:100,baseline_sent:40,current_sent:140});
  assert.equal(s.arena_sent_delta,100);assert.equal(s.remaining_to_spend,0);assert.equal(s.spent_all_event_credits,true);
});
test('single Arena seat binding is owner-file backed and fail-closed when required',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sw-seat-'));
  try{
    const env={SHAREDNET_ARENA_SEAT_FILE:path.join(dir,'seat')};
    assert.equal(readExpectedArenaSeat({env,required:false}),null);
    assert.throws(()=>readExpectedArenaSeat({env,required:true}),/arena_expected_single_seat_required/);
    const file=writeArenaSeatBinding('i_ABCDEFGHIJ',{env});
    assert.equal(file,path.resolve(env.SHAREDNET_ARENA_SEAT_FILE));
    assert.equal(readExpectedArenaSeat({env,required:true}),'i_ABCDEFGHIJ');
    assert.equal((fs.statSync(file).mode&0o777),0o600);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
