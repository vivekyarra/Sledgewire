import {DatabaseSync} from 'node:sqlite';

export class ArenaStore{
  constructor(path=':memory:'){
    this.db=new DatabaseSync(path);this.db.exec('PRAGMA journal_mode=WAL');this.db.exec('PRAGMA busy_timeout=5000');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS requests(request_id TEXT PRIMARY KEY,txn_id TEXT NOT NULL UNIQUE,fingerprint TEXT NOT NULL,service TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('inflight','completed','failed')),response_json TEXT,error_json TEXT,started_at TEXT NOT NULL,completed_at TEXT);
      CREATE TABLE IF NOT EXISTS grants(namespace_id TEXT NOT NULL,grant_id TEXT NOT NULL,grant_json TEXT NOT NULL,revoked_at TEXT,PRIMARY KEY(namespace_id,grant_id));
      CREATE TABLE IF NOT EXISTS grant_usage(namespace_id TEXT NOT NULL,grant_id TEXT NOT NULL,used INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(namespace_id,grant_id));
      CREATE TABLE IF NOT EXISTS audit(event_id TEXT PRIMARY KEY,at TEXT NOT NULL,trace_id TEXT,event_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit_outbox(event_id TEXT PRIMARY KEY,event_json TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,sent_at TEXT);
      CREATE TABLE IF NOT EXISTS room_messages(message_id TEXT PRIMARY KEY,status TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,error TEXT,processed_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    `);
  }
  claim({requestId,txnId,fingerprint,service}){
    this.db.exec('BEGIN IMMEDIATE');try{
      const byReq=this.db.prepare('SELECT * FROM requests WHERE request_id=?').get(requestId),byTxn=this.db.prepare('SELECT * FROM requests WHERE txn_id=?').get(txnId),existing=byReq??byTxn;
      if(existing){
        this.db.exec('COMMIT');const exact=existing.request_id===requestId&&existing.txn_id===txnId&&existing.fingerprint===fingerprint&&existing.service===service;
        if(!exact)return {status:'conflict'};
        if(existing.status==='completed')return {status:'replay',response:JSON.parse(existing.response_json)};
        if(existing.status==='failed')return {status:'failed',error:existing.error_json?JSON.parse(existing.error_json):null};
        return {status:'inflight',startedAt:existing.started_at,ageMs:Math.max(0,Date.now()-Date.parse(existing.started_at))};
      }
      this.db.prepare(`INSERT INTO requests(request_id,txn_id,fingerprint,service,status,started_at) VALUES(?,?,?,?, 'inflight',?)`).run(requestId,txnId,fingerprint,service,new Date().toISOString());this.db.exec('COMMIT');return {status:'claimed'};
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  complete(requestId,fingerprint,response){const r=this.db.prepare(`UPDATE requests SET status='completed',response_json=?,completed_at=? WHERE request_id=? AND fingerprint=? AND status='inflight'`).run(JSON.stringify(response),new Date().toISOString(),requestId,fingerprint);if(r.changes!==1)throw new Error('request_completion_conflict');}
  fail(requestId,fingerprint,error){const r=this.db.prepare(`UPDATE requests SET status='failed',error_json=?,completed_at=? WHERE request_id=? AND fingerprint=? AND status='inflight'`).run(JSON.stringify(error),new Date().toISOString(),requestId,fingerprint);if(r.changes!==1)throw new Error('request_failure_conflict');}
  storeGrant(namespaceId,grant){this.db.prepare(`INSERT INTO grants(namespace_id,grant_id,grant_json,revoked_at) VALUES(?,?,?,NULL) ON CONFLICT(namespace_id,grant_id) DO UPDATE SET grant_json=excluded.grant_json,revoked_at=NULL`).run(namespaceId,grant.id,JSON.stringify(grant));}
  revokeGrant(namespaceId,grantId){this.db.prepare('UPDATE grants SET revoked_at=? WHERE namespace_id=? AND grant_id=?').run(new Date().toISOString(),namespaceId,grantId);}
  async load(context,signal){signal?.throwIfAborted?.();const rows=this.db.prepare('SELECT grant_json FROM grants WHERE namespace_id=? AND revoked_at IS NULL').all(context.namespaceId),actor=JSON.stringify(context.actor),authority=JSON.stringify(context.authority);return rows.map(r=>JSON.parse(r.grant_json)).filter(g=>JSON.stringify(g.subject)===actor&&JSON.stringify(g.issuer)===authority);}
  async getUsage(namespaceId,grantId){return this.db.prepare('SELECT used FROM grant_usage WHERE namespace_id=? AND grant_id=?').get(namespaceId,grantId)?.used??0;}
  async tryConsume(namespaceId,grantId,maximumUses){const r=this.db.prepare(`INSERT INTO grant_usage(namespace_id,grant_id,used) VALUES(?,?,1) ON CONFLICT(namespace_id,grant_id) DO UPDATE SET used=used+1 WHERE grant_usage.used < ?`).run(namespaceId,grantId,maximumUses);return r.changes>0;}
  async record(event){this.db.exec('BEGIN IMMEDIATE');try{this.db.prepare('INSERT OR IGNORE INTO audit(event_id,at,trace_id,event_json) VALUES(?,?,?,?)').run(event.id,event.at,event.traceId??null,JSON.stringify(event));this.db.prepare('INSERT OR IGNORE INTO audit_outbox(event_id,event_json,attempts,sent_at) VALUES(?,?,0,NULL)').run(event.id,JSON.stringify(event));this.db.exec('COMMIT');}catch(e){this.db.exec('ROLLBACK');throw e;}}
  pendingAudit(limit=100){return this.db.prepare('SELECT event_id,event_json,attempts FROM audit_outbox WHERE sent_at IS NULL ORDER BY rowid ASC LIMIT ?').all(limit).map(r=>({...r,event:JSON.parse(r.event_json)}));}
  markAuditSent(id){this.db.prepare('UPDATE audit_outbox SET sent_at=? WHERE event_id=?').run(new Date().toISOString(),id);}
  bumpAuditAttempt(id){this.db.prepare('UPDATE audit_outbox SET attempts=attempts+1 WHERE event_id=?').run(id);}
  auditCount(){return this.db.prepare('SELECT COUNT(*) count FROM audit').get().count;}
  roomMessageSeen(id){if(!id)return false;return this.db.prepare(`SELECT status FROM room_messages WHERE message_id=? AND status='completed'`).get(id)?.status==='completed';}
  roomMessageTerminal(id){if(!id)return false;const status=this.db.prepare('SELECT status FROM room_messages WHERE message_id=?').get(id)?.status;return status==='completed'||status==='dead_letter';}
  claimRoomMessage(id,{maxAttempts=5,staleMs=120_000}={}){
    if(!id)return true;this.db.exec('BEGIN IMMEDIATE');try{
      const row=this.db.prepare('SELECT status,attempts,processed_at FROM room_messages WHERE message_id=?').get(id),now=new Date();let ok=false;
      if(!row){this.db.prepare(`INSERT INTO room_messages(message_id,status,attempts,error,processed_at) VALUES(?,'inflight',1,NULL,?)`).run(id,now.toISOString());ok=true;}
      else if(row.status==='failed'&&row.attempts<maxAttempts){this.db.prepare(`UPDATE room_messages SET status='inflight',attempts=attempts+1,error=NULL,processed_at=? WHERE message_id=?`).run(now.toISOString(),id);ok=true;}
      else if(row.status==='inflight'&&row.attempts<maxAttempts&&now-Date.parse(row.processed_at)>staleMs){this.db.prepare(`UPDATE room_messages SET status='inflight',attempts=attempts+1,error=NULL,processed_at=? WHERE message_id=?`).run(now.toISOString(),id);ok=true;}
      this.db.exec('COMMIT');return ok;
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  markRoomMessage(id,status='completed',error=null){if(!id)return;this.db.prepare(`INSERT INTO room_messages(message_id,status,attempts,error,processed_at) VALUES(?,?,1,?,?) ON CONFLICT(message_id) DO UPDATE SET status=excluded.status,error=excluded.error,processed_at=excluded.processed_at`).run(id,status,error,new Date().toISOString());}
  markRoomMessageFailed(id,error,{maxAttempts=5}={}){
    if(!id)return {status:'ignored',attempts:0};const row=this.db.prepare('SELECT attempts FROM room_messages WHERE message_id=?').get(id),attempts=row?.attempts??1,status=attempts>=maxAttempts?'dead_letter':'failed';
    this.markRoomMessage(id,status,String(error??'unknown').slice(0,2000));return {status,attempts};
  }
  getMeta(key){return this.db.prepare('SELECT value FROM metadata WHERE key=?').get(key)?.value??null;}
  setMeta(key,value){this.db.prepare(`INSERT INTO metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(key,String(value));}
}
