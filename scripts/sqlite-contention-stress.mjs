import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {ArenaStore} from '../src/store/arena-store.mjs';

const self=fileURLToPath(import.meta.url);
const mode=process.argv[2]??'parent';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

if(mode==='--worker'){
  const file=process.argv[3],worker=Number(process.argv[4]),ops=Number(process.argv[5]),total=Number(process.argv[6]),startAt=Number(process.argv[7]);
  if(!file||!Number.isInteger(worker)||!Number.isInteger(ops)||!Number.isInteger(total)||!Number.isFinite(startAt))throw new Error('invalid_contention_worker_args');
  if(Date.now()<startAt)await sleep(startAt-Date.now());
  const s=new ArenaStore(file),buyer='i_'+String(worker).padStart(10,'0');
  try{
    for(let i=0;i<ops;i++){
      const seq=worker*ops+i+1,id='msg_'+String(seq).padStart(10,'0');
      s.incrementCounter('contention.total');
      const consumed=await s.tryConsume('contention','shared-grant',total);if(!consumed)throw new Error('grant_usage_lost_capacity');
      if(!s.claimRoomMessage(id,{sequence:seq,maxAttempts:3}))throw new Error('room_claim_collision:'+id);
      s.markRoomMessage(id,'completed');
      if(i%10===0){
        const q=s.bindPaymentQuote({requestId:'rqk_'+worker+'_'+i,fingerprint:'fp_'+worker+'_'+i,service:'sledgewire.smoke',buyerSeat:buyer,price:3,memo:'Sledgewire'});
        if(q.status!=='bound')throw new Error('contention_quote_'+q.status);
      }
      if(i%50===0)await s.record({id:'evt-'+worker+'-'+i,at:new Date().toISOString(),traceId:'trace-'+worker,kind:'contention'});
    }
    console.log(JSON.stringify({worker,ops,ok:true}));
  }finally{s.db.close();}
  process.exit(0);
}

const workers=Math.max(2,Math.min(8,Number(process.argv[2]??6))),ops=Math.max(200,Math.min(5000,Number(process.argv[3]??1500)));
const total=workers*ops,dir=fs.mkdtempSync(path.join(os.tmpdir(),'sledgewire-sqlite-contention-')),file=path.join(dir,'arena.db'),startAt=Date.now()+600;
const children=[];let failed=null;
try{
  for(let w=0;w<workers;w++){
    const child=spawn(process.execPath,[self,'--worker',file,String(w),String(ops),String(total),String(startAt)],{stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';child.stdout.on('data',c=>stdout+=c);child.stderr.on('data',c=>stderr+=c);
    children.push({child,w,get stdout(){return stdout;},get stderr(){return stderr;}});
  }
  const timeout=setTimeout(()=>{for(const x of children)x.child.kill('SIGKILL');},90_000);timeout.unref?.();
  const results=await Promise.all(children.map(x=>new Promise(resolve=>x.child.once('exit',(code,signal)=>resolve({w:x.w,code,signal,stdout:x.stdout,stderr:x.stderr})))));
  clearTimeout(timeout);
  failed=results.find(x=>x.code!==0);if(failed)throw new Error('contention_worker_failed:'+JSON.stringify(failed));
  const s=new ArenaStore(file);
  try{
    const counter=s.counterMap()['contention.total']??0,usage=await s.getUsage('contention','shared-grant');
    const roomBefore=Number(s.db.prepare('SELECT COUNT(*) n FROM room_messages').get().n),quoteStats=s.paymentQuoteStats();
    const expectedQuotes=workers*Math.ceil(ops/10),expectedAudit=workers*Math.ceil(ops/50);
    if(counter!==total||usage!==total||roomBefore!==total)throw new Error(`atomic_count_mismatch:${counter}:${usage}:${roomBefore}:${total}`);
    if(quoteStats.total!==expectedQuotes||quoteStats.max_per_buyer>256)throw new Error('quote_contention_mismatch:'+JSON.stringify(quoteStats));
    if(s.auditCount()!==expectedAudit||s.pendingAudit(expectedAudit+1).length!==expectedAudit)throw new Error('audit_contention_mismatch');
    const removed=s.pruneRoomMessages({throughSequence:total,retainSequences:1000}),roomAfter=Number(s.db.prepare('SELECT COUNT(*) n FROM room_messages').get().n);
    if(roomAfter!==Math.min(total,1000)||removed!==Math.max(0,total-1000))throw new Error(`room_prune_mismatch:${removed}:${roomAfter}`);
    for(const row of s.pendingAudit(expectedAudit+1))s.markAuditSent(row.event_id);
    if(s.pendingAudit(1).length!==0||s.auditCount()!==expectedAudit)throw new Error('audit_outbox_reclaim_failed');
    s.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  }finally{s.db.close();}
  const reopened=new ArenaStore(file);const integrity=reopened.db.prepare('PRAGMA integrity_check').get();reopened.db.close();
  if(String(integrity?.integrity_check??'').toLowerCase()!=='ok')throw new Error('sqlite_integrity_check_failed:'+JSON.stringify(integrity));
  let bytes=0;for(const suffix of ['', '-wal','-shm']){try{bytes+=fs.statSync(file+suffix).size;}catch{}}
  console.log(JSON.stringify({type:'sledgewire.sqlite.contention.v1',workers,ops_per_worker:ops,total_operations:total,exact_counter:true,exact_grant_usage:true,room_rows_before_prune:total,room_rows_after_prune:Math.min(total,1000),quote_rows:workers*Math.ceil(ops/10),audit_events:workers*Math.ceil(ops/50),audit_outbox_after_ack:0,integrity_check:'ok',sqlite_bytes:bytes},null,2));
}finally{for(const x of children)if(x.child.exitCode===null)x.child.kill('SIGKILL');fs.rmSync(dir,{recursive:true,force:true});}
