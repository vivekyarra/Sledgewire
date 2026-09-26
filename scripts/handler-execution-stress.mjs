import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {ArenaStore} from '../src/store/arena-store.mjs';
import {createArenaHandler} from '../src/sharednet/handler.mjs';
import {paymentMemo} from '../src/core/payment-gate.mjs';
import {generateSigningKeypair} from '../src/receipts/receipt.mjs';

function boundedArg(raw,{name,min,max,defaultValue}){
  const n=raw===undefined?defaultValue:Number(raw);
  if(!Number.isSafeInteger(n)||n<min||n>max)throw new Error(`invalid_${name}`);
  return n;
}
const groups=boundedArg(process.argv[2],{name:'groups',min:1,max:20_000,defaultValue:1000});
const fanout=boundedArg(process.argv[3],{name:'fanout',min:2,max:128,defaultValue:16});
const delayMs=boundedArg(process.argv[4],{name:'delay_ms',min:0,max:100,defaultValue:1});

const room='rom_ABCDEFGHIJ',buyer='i_ABCDEFGHIJ',payee='p_ABCDEFGHIJ',service='sledgewire.smoke',price=3;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sledgewire-handler-stress-'));
const file=path.join(dir,'arena.db');
const store=new ArenaStore(file),kp=generateSigningKeypair();
let ledgerReads=0,totalExecutions=0;
const executions=new Map();

const ledger={
  async get(txnId){
    ledgerReads++;
    const i=Number(String(txnId).split('_').at(-1));
    if(!Number.isSafeInteger(i)||i<0||i>=groups)return null;
    return {
      id:txnId,
      buyer_instance_id:buyer,
      addressed_to:payee,
      payee_ok:true,
      amount:price,
      room_id:room,
      memo:paymentMemo(`exec-${i}`,service)
    };
  }
};

const runService=async({service:actualService,fingerprint,buyerSeat})=>{
  if(actualService!==service||buyerSeat!==buyer)throw new Error('handler_stress_scope_mismatch');
  totalExecutions++;
  executions.set(fingerprint,(executions.get(fingerprint)??0)+1);
  if(delayMs)await new Promise(r=>setTimeout(r,delayMs));
  return {
    service,
    state:'READY',
    sharedos_trace_id:crypto.randomUUID(),
    buyer_seat:buyerSeat,
    request_fingerprint:fingerprint
  };
};

const handle=createArenaHandler({
  store,ledger,room,payee,
  signing:{privateKeyPem:kp.privateKeyPem},
  publicBaseUrl:'https://sledgewire.example',
  runService
});

let firstWaveInflight=0,firstWaveDelivered=0,cachedReplays=0,reuseRefusals=0;
const started=Date.now();
try{
  for(let i=0;i<groups;i++){
    const request={
      type:'sledgewire.service.request.v1',
      request_id:`exec-${i}`,
      service,
      input:{endpoint:`https://example.com/mcp?case=${i}`},
      payment_txn_id:`txn_${i}`
    };
    const message={sender_instance_id:buyer,content:JSON.stringify(request)};
    const wave=await Promise.all(Array.from({length:fanout},()=>handle(message)));
    const delivered=wave.filter(x=>x?.state==='DELIVERED');
    const inflight=wave.filter(x=>x?.state==='FAILED'&&x?.reason==='request_already_inflight');
    const unexpected=wave.filter(x=>x?.state!=='DELIVERED'&&!(x?.state==='FAILED'&&x?.reason==='request_already_inflight'));
    if(delivered.length<1||unexpected.length)throw new Error(`first_wave_invariant_failed:${i}:delivered=${delivered.length}:inflight=${inflight.length}:unexpected=${unexpected.length}`);
    firstWaveDelivered+=delivered.length;firstWaveInflight+=inflight.length;
    const signature=delivered[0]?.receipt?.proof?.signature;
    if(!signature)throw new Error(`missing_signed_delivery:${i}`);
    if(!delivered.every(x=>x.receipt?.proof?.signature===signature))throw new Error(`first_wave_replay_signature_mismatch:${i}`);

    const replayWave=await Promise.all(Array.from({length:fanout},()=>handle(message)));
    if(!replayWave.every(x=>x?.state==='DELIVERED'&&x.receipt?.proof?.signature===signature))throw new Error(`cached_replay_invariant_failed:${i}`);
    cachedReplays+=replayWave.length;

    const conflict={...request,request_id:`other-${i}`};
    const bad=await handle({sender_instance_id:buyer,content:JSON.stringify(conflict)});
    if(bad?.state!=='FAILED'||bad?.reason!=='transaction_or_request_reused')throw new Error(`transaction_reuse_not_rejected:${i}:${bad?.reason}`);
    reuseRefusals++;
  }

  const counts=[...executions.values()];
  const duplicateExecutions=counts.reduce((n,x)=>n+Math.max(0,x-1),0);
  const missingExecutions=groups-counts.length;
  const result={
    groups,fanout,delay_ms:delayMs,
    handler_requests:groups*(fanout*2+1),
    first_wave_delivered:firstWaveDelivered,
    first_wave_inflight_refusals:firstWaveInflight,
    cached_replays:cachedReplays,
    transaction_reuse_refusals:reuseRefusals,
    ledger_reads:ledgerReads,
    actual_service_executions:totalExecutions,
    duplicate_service_executions:duplicateExecutions,
    missing_service_executions:missingExecutions,
    sqlite:'file-backed-wal',
    duration_ms:Date.now()-started
  };
  console.log(JSON.stringify(result,null,2));
  if(totalExecutions!==groups||duplicateExecutions!==0||missingExecutions!==0||reuseRefusals!==groups||cachedReplays!==groups*fanout||ledgerReads!==groups)process.exitCode=1;
}finally{
  try{store.db.close();}catch{}
  fs.rmSync(dir,{recursive:true,force:true});
}
