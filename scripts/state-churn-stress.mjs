import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ArenaStore} from '../src/store/arena-store.mjs';

const messages=Math.max(10_000,Math.min(100_000,Number(process.argv[2]??50_000)));
const audits=Math.max(1_000,Math.min(20_000,Number(process.argv[3]??5_000)));
const retain=2_000,dir=fs.mkdtempSync(path.join(os.tmpdir(),'sledgewire-state-churn-')),file=path.join(dir,'arena.db');
const started=Date.now();
try{
  let store=new ArenaStore(file);
  for(let i=1;i<=messages;i++){
    const id='msg_'+i.toString(36).toUpperCase().padStart(10,'0').slice(-10);
    if(!store.claimRoomMessage(id,{sequence:i,maxAttempts:3}))throw new Error('room_claim_failed:'+i);
    store.markRoomMessage(id,'completed');
    if((i%1000)===0)store.pruneRoomMessages({throughSequence:i,retainSequences:retain});
  }
  store.pruneRoomMessages({throughSequence:messages,retainSequences:retain});
  const roomRows=Number(store.db.prepare('SELECT COUNT(*) n FROM room_messages').get().n);
  if(roomRows>retain)throw new Error(`room_dedupe_unbounded:${roomRows}`);

  for(let i=0;i<audits;i++){
    const event={id:'evt_'+i,at:new Date(1_700_000_000_000+i).toISOString(),traceId:'trace_'+(i%100),type:'stress',i};
    await store.record(event);
  }
  const pendingBefore=store.pendingAudit(audits+10).length;if(pendingBefore!==audits)throw new Error(`audit_outbox_missing:${pendingBefore}`);
  for(const row of store.pendingAudit(audits+10))store.markAuditSent(row.event_id);
  const pendingAfter=store.pendingAudit(1).length;if(pendingAfter!==0)throw new Error('audit_outbox_not_reclaimed');
  if(Number(store.auditCount())!==audits)throw new Error('canonical_audit_lost');

  store.incrementCounter('arena.info.churn',messages);
  if(store.counterMap('arena.info.')['arena.info.churn']!==messages)throw new Error('counter_churn_mismatch');
  store.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  const integrity1=String(store.db.prepare('PRAGMA integrity_check').get()?.integrity_check??'').toLowerCase();if(integrity1!=='ok')throw new Error('integrity_before_reopen_failed');
  store.db.close();

  store=new ArenaStore(file);
  const roomRowsAfter=Number(store.db.prepare('SELECT COUNT(*) n FROM room_messages').get().n),auditRowsAfter=Number(store.auditCount()),outboxRowsAfter=Number(store.db.prepare('SELECT COUNT(*) n FROM audit_outbox').get().n);
  const integrity2=String(store.db.prepare('PRAGMA integrity_check').get()?.integrity_check??'').toLowerCase();
  if(roomRowsAfter>retain||auditRowsAfter!==audits||outboxRowsAfter!==0||integrity2!=='ok')throw new Error('reopen_state_invariant_failed');
  store.db.close();
  let bytes=0;for(const suffix of ['','-wal','-shm'])try{bytes+=fs.statSync(file+suffix).size;}catch{}
  console.log(JSON.stringify({type:'sledgewire.state.churn.v1',terminal_room_messages:messages,retained_room_dedupe_rows:roomRowsAfter,canonical_audit_events:auditRowsAfter,transient_audit_outbox_rows:outboxRowsAfter,sqlite_integrity:integrity2,sqlite_bytes:bytes,duration_ms:Date.now()-started},null,2));
}finally{fs.rmSync(dir,{recursive:true,force:true});}
