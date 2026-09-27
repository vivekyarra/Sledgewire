import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {ArenaStore} from '../src/store/arena-store.mjs';
import {mapLimitFair} from '../src/sharednet/fair-map.mjs';

test('fair scheduler preserves one in-flight task per sender while keeping other senders moving',async()=>{
  const items=[...Array.from({length:100},(_,i)=>({sender:'A',id:'A'+i})),...['B','C','D','E','F','G','H'].map(sender=>({sender,id:sender}))];
  let globalActive=0,maxGlobal=0;const per=new Map(),maxPer=new Map(),completed=[];
  const out=await mapLimitFair(items,4,x=>x.sender,async x=>{
    globalActive++;maxGlobal=Math.max(maxGlobal,globalActive);
    const n=(per.get(x.sender)??0)+1;per.set(x.sender,n);maxPer.set(x.sender,Math.max(maxPer.get(x.sender)??0,n));
    await new Promise(r=>setTimeout(r,x.sender==='A'?3:0));
    completed.push(x.id);per.set(x.sender,(per.get(x.sender)??1)-1);globalActive--;return x.id;
  });
  assert.equal(out.length,items.length);assert.ok(maxGlobal<=4);assert.equal(maxPer.get('A'),1);
  for(const k of ['B','C','D','E','F','G','H'])assert.equal(maxPer.get(k),1);
  const firstOther=Math.min(...['B','C','D','E','F','G','H'].map(k=>completed.indexOf(k)));
  assert.ok(firstOther>=0);assert.ok(completed.slice(0,firstOther+1).filter(x=>x.startsWith('A')).length<100);
});

test('v0.3.13 inflight rows migrate conservatively as execution-may-have-started',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sw-migrate-')),file=path.join(dir,'arena.db');
  try{
    const db=new DatabaseSync(file);
    db.exec("CREATE TABLE requests(request_id TEXT PRIMARY KEY,txn_id TEXT NOT NULL UNIQUE,fingerprint TEXT NOT NULL,service TEXT NOT NULL,buyer_seat TEXT,status TEXT NOT NULL,response_json TEXT,error_json TEXT,started_at TEXT NOT NULL,completed_at TEXT); CREATE TABLE room_messages(message_id TEXT PRIMARY KEY,status TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,error TEXT,processed_at TEXT NOT NULL); CREATE TABLE audit_outbox(event_id TEXT PRIMARY KEY,event_json TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,sent_at TEXT)");
    db.prepare("INSERT INTO requests(request_id,txn_id,fingerprint,service,buyer_seat,status,started_at) VALUES(?,?,?,?,?,'inflight',?)").run('rqk_old','txn_OLD0000001','fp','sledgewire.smoke','i_OLD0000001','2026-09-27T00:00:00.000Z');
    db.prepare("INSERT INTO room_messages(message_id,status,attempts,error,processed_at) VALUES('msg_OLD0000001','completed',1,NULL,'2026-09-27T00:00:00.000Z')").run();
    db.prepare("INSERT INTO audit_outbox(event_id,event_json,attempts,sent_at) VALUES('evt-old','{}',0,'2026-09-27T00:00:01.000Z')").run();
    db.close();
    const store=new ArenaStore(file),row=store.db.prepare('SELECT started_at,execution_started_at FROM requests WHERE request_id=?').get('rqk_old');
    assert.equal(row.execution_started_at,row.started_at);
    assert.ok(store.db.prepare("PRAGMA table_info(room_messages)").all().some(x=>x.name==='sequence'));
    assert.equal(store.db.prepare('SELECT COUNT(*) n FROM audit_outbox').get().n,0);
    assert.equal(store.pruneRoomMessages({throughSequence:10,retainSequences:0}),1);
    store.db.close();
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('execution start marker is single-winner and cannot be overwritten by a second worker',()=>{
  const s=new ArenaStore(':memory:');
  s.db.prepare("INSERT INTO requests(request_id,txn_id,fingerprint,service,buyer_seat,status,started_at) VALUES(?,?,?,?,?,'inflight',?)").run('rqk_x','txn_ABCDEFGHIJ','fp','sledgewire.smoke','i_ABCDEFGHIJ',new Date().toISOString());
  const first=s.markExecutionStarted('rqk_x','fp'),second=s.markExecutionStarted('rqk_x','fp');
  assert.equal(first.status,'started');assert.equal(second.status,'already_started');assert.equal(second.at,first.at);
});
