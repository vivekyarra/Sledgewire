import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ArenaStore,PAYMENT_QUOTE_MAX_GLOBAL,PAYMENT_QUOTE_MAX_PER_BUYER} from '../src/store/arena-store.mjs';
import {PaymentGate} from '../src/core/payment-gate.mjs';
import {createArenaHandler} from '../src/sharednet/handler.mjs';
import {planArenaSpend,resolveArenaBudgetState,eventBudgetStatus} from '../src/sharednet/spend-plan.mjs';
import {generateSigningKeypair} from '../src/receipts/receipt.mjs';

function bounded(raw,{name,min,max,def}){const n=raw===undefined?def:Number(raw);if(!Number.isSafeInteger(n)||n<min||n>max)throw new Error(`invalid_${name}`);return n;}
const quoteFlood=bounded(process.argv[2],{name:'quote_flood',min:1000,max:250000,def:40000});
const oversizedFlood=bounded(process.argv[3],{name:'oversized_flood',min:100,max:100000,def:10000});
const room='rom_ABCDEFGHIJ',payee='p_ABCDEFGHIJ',service='sledgewire.smoke',price=3;
const seat=i=>'i_'+i.toString(36).toUpperCase().padStart(10,'0').slice(-10);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sledgewire-e2e-chaos-')),file=path.join(dir,'arena.db');
const store=new ArenaStore(file),prices={[service]:price};
let ledgerReads=0;
const paidIndex=0,paidBuyer=seat(0),paidRequestId='flood-0',paidTxn='txn_CHAOS00001';
const ledger={async get(id){ledgerReads++;if(id!==paidTxn)return null;return {id,buyer_instance_id:paidBuyer,addressed_to:payee,payee_ok:true,amount:3,room_id:room,memo:'Sledgewire'};}};
const gate=new PaymentGate({ledger,store,prices,payee});

const t0=Date.now();let issuedQuotes=0,quoteCapacityRejected=0;
for(let i=0;i<quoteFlood;i++){
  const req={roomId:room,buyerSeat:seat(i%256),requestId:`flood-${i}`,service,input:{endpoint:`https://target.example/mcp?case=${i}`},txnId:null};
  const q=gate.issueQuote(req);
  if(q.reason==='payment_quote_capacity_reached'){quoteCapacityRejected++;continue;}
  if(q.reason!=='payment_required'||q.memo!=='Sledgewire'||!q.quote_expires_at)throw new Error(`quote_failure:${i}:${q.reason}`);
  issuedQuotes++;
}
const quoteMs=Date.now()-t0,quoteStats=store.paymentQuoteStats();
if(quoteStats.total>PAYMENT_QUOTE_MAX_GLOBAL||quoteStats.max_per_buyer>PAYMENT_QUOTE_MAX_PER_BUYER)throw new Error(`quote_bounds_failed:${JSON.stringify(quoteStats)}`);
if(issuedQuotes!==quoteStats.total||quoteCapacityRejected!==quoteFlood-issuedQuotes)throw new Error('quote_capacity_accounting_failed');
if(!store.getPaymentQuote(requestStorageKey({roomId:room,buyerSeat:paidBuyer,requestId:paidRequestId,service,input:{endpoint:'https://target.example/mcp?case=0'}})))throw new Error('oldest_signed_quote_evicted');

let missingLedgerReads=0,rateLimited=0;
const missGate=new PaymentGate({ledger:{async get(){missingLedgerReads++;return null;}},store,prices,payee,ledgerMissPerBuyer:16,ledgerMissGlobal:64,ledgerMissWindowMs:60_000});
const missReq={roomId:room,buyerSeat:seat(999),requestId:'missing-ledger-storm',service,input:{endpoint:'https://missing.example/mcp'},txnId:null};
const missQuote=missGate.issueQuote(missReq);if(missQuote.reason!=='payment_required')throw new Error('missing_storm_quote_failed');
for(let i=0;i<100;i++){
  const out=await missGate.authorize({...missReq,txnId:`txn_${String(i).padStart(10,'0')}`});
  if(out.reason==='payment_verification_rate_limited')rateLimited++;
  else if(out.reason!=='transaction_not_found')throw new Error(`unexpected_missing_txn_result:${i}:${out.reason}`);
}
if(missingLedgerReads!==16||rateLimited!==84)throw new Error(`ledger_miss_breaker_failed:reads=${missingLedgerReads}:limited=${rateLimited}`);

const paidReq={roomId:room,buyerSeat:paidBuyer,requestId:paidRequestId,service,input:{endpoint:`https://target.example/mcp?case=${paidIndex}`},txnId:paidTxn};
const auth=await gate.authorize(paidReq);if(!auth.ok||auth.replay)throw new Error(`post_flood_payment_failed:${auth.reason}`);
store.complete(auth.storageKey,auth.fingerprint,{state:'DELIVERED',case:paidIndex});
if(store.getPaymentQuote(auth.storageKey)!==null)throw new Error('completed_quote_not_reclaimed');

const kp=generateSigningKeypair();let executions=0;
const handle=createArenaHandler({store,ledger:{async get(){throw new Error('oversized_message_must_not_hit_ledger');}},room,payee,signing:{privateKeyPem:kp.privateKeyPem},publicBaseUrl:'https://sledgewire.example',runService:async()=>{executions++;throw new Error('oversized_message_must_not_execute');}});
const huge='@sledgewire '+ 'X'.repeat(40_000),t1=Date.now();
for(let i=0;i<oversizedFlood;i++){
  const r=await handle({sender_instance_id:seat((i+77)%256),content:huge});
  if(r!==null)throw new Error(`oversized_message_not_dropped:${i}`);
}
const oversizedMs=Date.now()-t1;
if(executions!==0)throw new Error('oversized_message_execution');

const offers=Array.from({length:5000},(_,i)=>({id:`offer-${i}`,seller:`seller-${i}`,service:`svc-${i}`,price_credits:(i%35)+1,utility:(i%100)+1}));
const t2=Date.now(),plan=planArenaSpend({remaining_credits:100,offers}),plannerMs=Date.now()-t2;
if(!plan.exact||plan.planned_spend!==100||plan.unallocated_credits!==0)throw new Error('budget_exact_spend_plan_failed');
const first=resolveArenaBudgetState({existing:null,init:true,room,eventBudget:100,purse:{balance:100,sent:500,received:20,granted:100},now:'2026-09-27T12:00:00.000Z'});
const repeated=resolveArenaBudgetState({existing:first.state,init:true,room,eventBudget:100,purse:{balance:50,sent:550,received:20,granted:100},now:'2026-09-27T12:30:00.000Z'});
if(repeated.state.baseline_sent!==500||repeated.initialization!=='already_initialized')throw new Error('budget_baseline_moved');
const budget=eventBudgetStatus({event_budget:100,baseline_sent:500,current_sent:600});if(!budget.spent_all_event_credits||budget.remaining_to_spend!==0||budget.overspent_credits!==0)throw new Error('budget_status_failed');

store.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
store.db.close();
const reopened=new ArenaStore(file),replayGate=new PaymentGate({ledger:{async get(){throw new Error('durable_replay_must_not_read_ledger');}},store:reopened,prices,payee});
const replay=await replayGate.authorize(paidReq);
if(!replay.ok||!replay.replay||replay.cached?.case!==paidIndex)throw new Error(`restart_replay_failed:${replay.reason}`);
const postRestartQuotes=reopened.paymentQuoteStats();
reopened.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');reopened.db.close();

let dbBytes=0;for(const suffix of ['', '-wal','-shm']){try{dbBytes+=fs.statSync(file+suffix).size;}catch{}}
const result={
  type:'sledgewire.arena.e2e-chaos.v1',
  quote_flood:quoteFlood,
  quote_flood_ms:quoteMs,
  quotes_issued:issuedQuotes,
  quote_capacity_rejected:quoteCapacityRejected,
  bounded_quote_state:quoteStats,
  oversized_messages:oversizedFlood,
  oversized_message_ms:oversizedMs,
  oversized_ledger_reads:0,
  oversized_executions:executions,
  paid_after_quote_flood:true,
  payment_ledger_reads:ledgerReads,
  bogus_payment_attempts:100,
  bogus_payment_ledger_reads:missingLedgerReads,
  bogus_payment_rate_limited:rateLimited,
  durable_restart_replay:true,
  quotes_after_restart:postRestartQuotes,
  planner_offers:offers.length,
  planner_ms:plannerMs,
  exact_100_credit_plan:true,
  budget_baseline_one_shot:true,
  sqlite_bytes_after_checkpoint:dbBytes
};
console.log(JSON.stringify(result,null,2));
if(dbBytes>128*1024*1024)throw new Error(`arena_db_growth_excessive:${dbBytes}`);
fs.rmSync(dir,{recursive:true,force:true});
