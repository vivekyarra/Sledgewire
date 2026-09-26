import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ArenaStore} from '../src/store/arena-store.mjs';
import {DatabaseSync} from 'node:sqlite';

function tempDb(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sledgewire-'));
  return {dir,file:path.join(dir,'arena.db'),cleanup(){fs.rmSync(dir,{recursive:true,force:true});}};
}
test('paid claim and completed response survive close and reopen',()=>{
  const t=tempDb();try{
    const a=new ArenaStore(t.file),req={requestId:'req-restart',txnId:'txn-restart',fingerprint:'fp-restart',service:'sledgewire.smoke',buyerSeat:'i_BUYERAAAA'};
    assert.equal(a.claim(req).status,'claimed');a.complete(req.requestId,req.fingerprint,{delivered:true});a.db.close();
    const b=new ArenaStore(t.file),r=b.claim(req);assert.equal(r.status,'replay');assert.deepEqual(r.response,{delivered:true});b.db.close();
  }finally{t.cleanup();}
});
test('two SQLite connections cannot both own the same paid transaction',()=>{
  const t=tempDb();try{
    const a=new ArenaStore(t.file),b=new ArenaStore(t.file),req={requestId:'req-dual',txnId:'txn-dual',fingerprint:'fp-dual',service:'sledgewire.smoke'};
    assert.equal(a.claim(req).status,'claimed');assert.equal(b.claim(req).status,'inflight');
    a.complete(req.requestId,req.fingerprint,{ok:true});assert.equal(b.claim(req).status,'replay');a.db.close();b.db.close();
  }finally{t.cleanup();}
});
test('bounded SharedOS grant usage remains one-use across two database connections',async()=>{
  const t=tempDb();try{
    const a=new ArenaStore(t.file),b=new ArenaStore(t.file);
    const [x,y]=await Promise.all([a.tryConsume('n','g',1),b.tryConsume('n','g',1)]);
    assert.equal([x,y].filter(Boolean).length,1);a.db.close();b.db.close();
  }finally{t.cleanup();}
});

test('pre-v0.3.9 requests table migrates online and new paid claims persist buyer seat',()=>{
  const t=tempDb();try{
    const oldDb=new DatabaseSync(t.file);
    oldDb.exec("CREATE TABLE requests(request_id TEXT PRIMARY KEY,txn_id TEXT NOT NULL UNIQUE,fingerprint TEXT NOT NULL,service TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('inflight','completed','failed')),response_json TEXT,error_json TEXT,started_at TEXT NOT NULL,completed_at TEXT)");
    oldDb.prepare("INSERT INTO requests(request_id,txn_id,fingerprint,service,status,response_json,started_at,completed_at) VALUES('legacy','txn-legacy','fp-legacy','sledgewire.smoke','completed','{}','2026-09-25T00:00:00.000Z','2026-09-25T00:00:01.000Z')").run();
    oldDb.close();
    const s=new ArenaStore(t.file),cols=s.db.prepare('PRAGMA table_info(requests)').all().map(r=>r.name);
    assert.ok(cols.includes('buyer_seat'));assert.equal(s.db.prepare("SELECT buyer_seat FROM requests WHERE request_id='legacy'").get().buyer_seat,null);
    assert.equal(s.claim({requestId:'new',txnId:'txn-new',fingerprint:'fp-new',service:'sledgewire.assay',buyerSeat:'i_BUYERBBBB'}).status,'claimed');
    assert.equal(s.db.prepare("SELECT buyer_seat FROM requests WHERE request_id='new'").get().buyer_seat,'i_BUYERBBBB');s.db.close();
  }finally{t.cleanup();}
});
test('legacy paid row backfills buyer seat on exact retry without changing replay semantics',()=>{
  const s=new ArenaStore(':memory:');
  s.db.prepare("INSERT INTO requests(request_id,txn_id,fingerprint,service,buyer_seat,status,response_json,started_at,completed_at) VALUES('legacy-r','txn-r','fp-r','sledgewire.smoke',NULL,'completed','{\"ok\":true}','2026-09-25T00:00:00.000Z','2026-09-25T00:00:01.000Z')").run();
  const r=s.claim({requestId:'legacy-r',txnId:'txn-r',fingerprint:'fp-r',service:'sledgewire.smoke',buyerSeat:'i_BUYERCCCC'});
  assert.equal(r.status,'replay');assert.equal(s.db.prepare("SELECT buyer_seat FROM requests WHERE request_id='legacy-r'").get().buyer_seat,'i_BUYERCCCC');
});
