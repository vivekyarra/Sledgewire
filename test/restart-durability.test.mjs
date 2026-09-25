import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ArenaStore} from '../src/store/arena-store.mjs';

function tempDb(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sledgewire-'));
  return {dir,file:path.join(dir,'arena.db'),cleanup(){fs.rmSync(dir,{recursive:true,force:true});}};
}
test('paid claim and completed response survive close and reopen',()=>{
  const t=tempDb();try{
    const a=new ArenaStore(t.file),req={requestId:'req-restart',txnId:'txn-restart',fingerprint:'fp-restart',service:'sledgewire.smoke'};
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
