import {ArenaStore} from '../src/store/arena-store.mjs';
import {PaymentGate,paymentMemo} from '../src/core/payment-gate.mjs';

const groups=Math.max(1,Number(process.argv[2]??500)),fanout=Math.max(2,Number(process.argv[3]??12));
const room='rom_ABCDEFGHIJ',buyer='i_ABCDEFGHIJ',payee='p_ABCDEFGHIJ',service='sledgewire.smoke',price=3;
const store=new ArenaStore(':memory:');
let ledgerReads=0;
const ledger={async get(txnId){ledgerReads++;await Promise.resolve();const i=Number(txnId.split('_').at(-1));const requestId=`storm-${i}`;return {id:txnId,buyer_instance_id:buyer,payee_ok:true,amount:price,room_id:room,memo:paymentMemo(requestId,service)};}};
const gate=new PaymentGate({ledger,store,prices:{[service]:price},payee});
let uniqueClaims=0,inflightRefusals=0,cachedReplays=0,conflictRefusals=0;
const start=Date.now();

for(let i=0;i<groups;i++){
  const req={roomId:room,buyerSeat:buyer,requestId:`storm-${i}`,service,input:{endpoint:`https://example.com/${i}`},txnId:`txn_${i}`};
  const wave=await Promise.all(Array.from({length:fanout},()=>gate.authorize(req)));
  const claimed=wave.filter(x=>x.ok&&!x.replay);
  const inflight=wave.filter(x=>!x.ok&&x.reason==='request_already_inflight');
  if(claimed.length!==1||inflight.length!==fanout-1)throw new Error(`duplicate_claim_invariant_failed:${i}:claimed=${claimed.length}:inflight=${inflight.length}`);
  uniqueClaims++;inflightRefusals+=inflight.length;
  store.complete(claimed[0].storageKey,claimed[0].fingerprint,{delivered:true,i});

  const replayWave=await Promise.all(Array.from({length:fanout},()=>gate.authorize(req)));
  if(!replayWave.every(x=>x.ok&&x.replay&&x.cached?.i===i))throw new Error(`cached_replay_invariant_failed:${i}`);
  cachedReplays+=replayWave.length;

  const conflicting={...req,requestId:`other-${i}`};
  const bad=await gate.authorize(conflicting);
  if(bad.ok||!['wrong_memo','transaction_or_request_reused'].includes(bad.reason))throw new Error(`transaction_reuse_not_rejected:${i}:${bad.reason}`);
  conflictRefusals++;
}
const result={groups,fanout,authorization_attempts:groups*(fanout*2+1),unique_claims:uniqueClaims,inflight_duplicate_refusals:inflightRefusals,cached_replays:cachedReplays,transaction_reuse_refusals:conflictRefusals,ledger_reads:ledgerReads,duplicate_paid_authorizations:0,duration_ms:Date.now()-start};
console.log(JSON.stringify(result,null,2));
if(uniqueClaims!==groups||inflightRefusals!==groups*(fanout-1)||cachedReplays!==groups*fanout||conflictRefusals!==groups||ledgerReads!==groups)process.exit(1);
