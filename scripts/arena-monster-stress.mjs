import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ArenaStore} from '../src/store/arena-store.mjs';
import {PaymentGate} from '../src/core/payment-gate.mjs';
import {mapLimitFair} from '../src/sharednet/fair-map.mjs';

const room='rom_ABCDEFGHIJ',payee='p_ABCDEFGHIJ',service='sledgewire.smoke',prices={[service]:3};
const seat=i=>'i_'+Number(i).toString(36).toUpperCase().padStart(10,'0').slice(-10);
const txn=i=>'txn_'+Number(i).toString(36).toUpperCase().padStart(10,'0').slice(-10);

// 1) Sender fairness under a dominant producer.
const attacker=18_000,others=2000,otherSenders=200;
const items=[...Array.from({length:attacker},(_,i)=>({sender:seat(0),id:'A'+i})),...Array.from({length:others},(_,i)=>({sender:seat(1+(i%otherSenders)),id:'L'+i}))];
let globalActive=0,maxGlobal=0;const per=new Map(),maxPer=new Map(),completion=[];
const fairStarted=Date.now();
await mapLimitFair(items,8,x=>x.sender,async x=>{
  globalActive++;maxGlobal=Math.max(maxGlobal,globalActive);const n=(per.get(x.sender)??0)+1;per.set(x.sender,n);maxPer.set(x.sender,Math.max(maxPer.get(x.sender)??0,n));
  if((completion.length&255)===0)await new Promise(r=>setImmediate(r));
  completion.push(x.id);per.set(x.sender,(per.get(x.sender)??1)-1);globalActive--;return x.id;
});
const firstThousand=completion.slice(0,1000),legitEarly=firstThousand.filter(x=>x.startsWith('L')).length;
if(maxGlobal>8||[...maxPer.values()].some(x=>x>1)||legitEarly<100)throw new Error(`fair_scheduler_failed:${maxGlobal}:${legitEarly}`);

// 2) One abusive buyer exhausts the shared miss budget; fresh legitimate buyers must still verify.
const store2=new ArenaStore(':memory:');let ledgerReads=0;
const ledger2={async get(id){ledgerReads++;if(id.startsWith('txn_BAD'))return null;const i=parseInt(id.slice(4),36);if(!Number.isFinite(i))return null;return {id,buyer_instance_id:seat(i),addressed_to:payee,payee_ok:true,amount:3,room_id:room,memo:'Sledgewire'};}};
const gate2=new PaymentGate({ledger:ledger2,store:store2,prices,payee,ledgerMissPerBuyer:100,ledgerMissGlobal:5,ledgerMissReservedPerBuyer:2,ledgerMissWindowMs:60_000});
const bad={roomId:room,buyerSeat:seat(9999),requestId:'abusive-buyer',service,input:{endpoint:'https://bad.example/mcp'},txnId:null};gate2.issueQuote(bad);
for(let i=0;i<12;i++)await gate2.authorize({...bad,txnId:'txn_BAD'+String(i).padStart(7,'0')});
if(ledgerReads!==5)throw new Error('global_miss_budget_not_saturated:'+ledgerReads);
let legitVerified=0;
for(let i=1;i<=100;i++){
  const req={roomId:room,buyerSeat:seat(i),requestId:'legit-'+i,service,input:{endpoint:'https://target.example/'+i},txnId:txn(i)};gate2.issueQuote({...req,txnId:null});
  const a=await gate2.authorize(req);if(!a.ok||a.replay)throw new Error('fresh_buyer_starved:'+i+':'+a.reason);legitVerified++;store2.complete(a.storageKey,a.fingerprint,{ok:true,i});
}
if(legitVerified!==100||ledgerReads!==105)throw new Error(`payment_fairness_failed:${legitVerified}:${ledgerReads}`);

// 3) File-backed crash boundary: unstarted claims recover; started claims never reexecute.
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sledgewire-crash-boundary-')),file=path.join(dir,'arena.db'),recoverable=500,ambiguous=500,total=recoverable+ambiguous;
let initialReads=0;
try{
  let s=new ArenaStore(file);
  const ledger={async get(id){initialReads++;const i=parseInt(id.slice(4),36);return {id,buyer_instance_id:seat(i%50+300),addressed_to:payee,payee_ok:true,amount:3,room_id:room,memo:'Sledgewire'};}};
  const gate=new PaymentGate({ledger,store:s,prices,payee,unstartedRecoveryAfterMs:1,uncertainAfterMs:1});
  const records=[];
  for(let i=0;i<total;i++){
    const req={roomId:room,buyerSeat:seat(i%50+300),requestId:'crash-'+i,service,input:{endpoint:'https://crash.example/'+i},txnId:txn(i+1000)};gate.issueQuote({...req,txnId:null});
    const a=await gate.authorize(req);if(!a.ok||a.replay)throw new Error('initial_claim_failed:'+i+':'+a.reason);records.push({req,a});
    if(i>=recoverable){const started=s.markExecutionStarted(a.storageKey,a.fingerprint);if(started.status!=='started')throw new Error('execution_boundary_mark_failed:'+i);}
  }
  s.db.prepare("UPDATE requests SET started_at=? WHERE status='inflight'").run(new Date(Date.now()-60_000).toISOString());s.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');s.db.close();
  s=new ArenaStore(file);let recoveryLedgerReads=0;const recoveryGate=new PaymentGate({ledger:{async get(){recoveryLedgerReads++;throw new Error('recovery_must_not_touch_remote_ledger');}},store:s,prices,payee,unstartedRecoveryAfterMs:1,uncertainAfterMs:1});
  let recovered=0,unknown=0;
  for(let i=0;i<records.length;i++){const {req,a}=records[i],out=await recoveryGate.authorize(req);
    if(i<recoverable){if(!out.ok||!out.recovered_pre_execution)throw new Error('safe_recovery_failed:'+i+':'+out.reason);const mark=s.markExecutionStarted(a.storageKey,a.fingerprint);if(mark.status!=='started')throw new Error('recovered_start_mark_failed:'+i);recovered++;}
    else{if(out.ok||out.reason!=='execution_outcome_unknown_no_retry')throw new Error('ambiguous_reexecution_risk:'+i+':'+out.reason);unknown++;}
  }
  if(recoveryLedgerReads!==0||recovered!==recoverable||unknown!==ambiguous)throw new Error('crash_boundary_summary_failed');
  s.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');const integrity=s.db.prepare('PRAGMA integrity_check').get();if(String(integrity?.integrity_check).toLowerCase()!=='ok')throw new Error('crash_db_integrity_failed');s.db.close();
  console.log(JSON.stringify({type:'sledgewire.arena.monster.v1',fairness:{messages:items.length,dominant_sender_messages:attacker,other_senders:otherSenders,max_global_concurrency:maxGlobal,max_per_sender_concurrency:Math.max(...maxPer.values()),legitimate_messages_in_first_1000:legitEarly,duration_ms:Date.now()-fairStarted},payment_fairness:{attacker_remote_misses:5,fresh_legitimate_buyers_verified:legitVerified,total_remote_reads:ledgerReads},crash_boundary:{claims:total,initial_ledger_reads:initialReads,recovered_pre_execution:recovered,ambiguous_refused_reexecution:unknown,recovery_ledger_reads:recoveryLedgerReads,sqlite_integrity:'ok'}},null,2));
}finally{fs.rmSync(dir,{recursive:true,force:true});}
