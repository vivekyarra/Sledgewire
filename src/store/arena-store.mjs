import {DatabaseSync} from 'node:sqlite';

export const PAYMENT_QUOTE_TTL_MS=4*60*60*1000;
export const PAYMENT_QUOTE_MAX_GLOBAL=20_000;
export const PAYMENT_QUOTE_MAX_PER_BUYER=256;

const SQLITE_BUSY_DELAYS_MS=[10,25,50,100,200,400,800,1200];
const SQLITE_BUSY_SLEEP=new Int32Array(new SharedArrayBuffer(4));
function sqliteBusy(error){
  const message=String(error?.message??'').toLowerCase();
  return error?.errcode===5||error?.errcode===6||message.includes('database is locked')||message.includes('database table is locked')||message.includes('database is busy');
}
function retrySqliteBusySync(fn){
  let last;
  for(let attempt=0;attempt<=SQLITE_BUSY_DELAYS_MS.length;attempt++){
    try{return fn();}
    catch(error){
      if(!sqliteBusy(error)||attempt===SQLITE_BUSY_DELAYS_MS.length)throw error;
      last=error;Atomics.wait(SQLITE_BUSY_SLEEP,0,0,SQLITE_BUSY_DELAYS_MS[attempt]);
    }
  }
  throw last;
}
function hasColumn(db,table,column){return retrySqliteBusySync(()=>db.prepare(`PRAGMA table_info(${table})`).all().some(r=>r.name===column));}
function ensureColumn(db,table,column,definition){
  if(hasColumn(db,table,column))return false;
  try{retrySqliteBusySync(()=>db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`));}
  catch(e){if(!hasColumn(db,table,column))throw e;return false;}
  return true;
}

export class ArenaStore{
  constructor(path=':memory:'){
    this.db=new DatabaseSync(path);
    // Install the connection wait policy before any operation that can need an
    // exclusive lock. Multiple production processes may cold-open the same
    // database at exactly the same time.
    this.db.exec('PRAGMA busy_timeout=5000');
    retrySqliteBusySync(()=>this.db.exec('PRAGMA journal_mode=WAL'));
    retrySqliteBusySync(()=>this.db.exec(`
      CREATE TABLE IF NOT EXISTS requests(request_id TEXT PRIMARY KEY,txn_id TEXT NOT NULL UNIQUE,fingerprint TEXT NOT NULL,service TEXT NOT NULL,buyer_seat TEXT,status TEXT NOT NULL CHECK(status IN ('inflight','completed','failed')),response_json TEXT,error_json TEXT,started_at TEXT NOT NULL,execution_started_at TEXT,completed_at TEXT);
      CREATE TABLE IF NOT EXISTS grants(namespace_id TEXT NOT NULL,grant_id TEXT NOT NULL,grant_json TEXT NOT NULL,revoked_at TEXT,PRIMARY KEY(namespace_id,grant_id));
      CREATE TABLE IF NOT EXISTS grant_usage(namespace_id TEXT NOT NULL,grant_id TEXT NOT NULL,used INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(namespace_id,grant_id));
      CREATE TABLE IF NOT EXISTS audit(event_id TEXT PRIMARY KEY,at TEXT NOT NULL,trace_id TEXT,event_json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_audit_trace ON audit(trace_id);
      CREATE TABLE IF NOT EXISTS audit_outbox(event_id TEXT PRIMARY KEY,event_json TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,sent_at TEXT);
      CREATE TABLE IF NOT EXISTS room_messages(message_id TEXT PRIMARY KEY,sequence INTEGER,status TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,error TEXT,processed_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS payment_quotes(request_id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,service TEXT NOT NULL,buyer_seat TEXT NOT NULL,price_credits INTEGER NOT NULL,memo TEXT NOT NULL,issued_at TEXT NOT NULL,last_seen_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_payment_quotes_buyer_seen ON payment_quotes(buyer_seat,last_seen_at);
      CREATE INDEX IF NOT EXISTS idx_payment_quotes_seen ON payment_quotes(last_seen_at);
      CREATE INDEX IF NOT EXISTS idx_payment_quotes_issued ON payment_quotes(issued_at);
      CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS counters(key TEXT PRIMARY KEY,value INTEGER NOT NULL DEFAULT 0);
    `));
    // Online migration for pre-v0.3.9 databases. Duplicate-column races are
    // accepted only after the column is visible on this connection.
    ensureColumn(this.db,'requests','buyer_seat','buyer_seat TEXT');
    const executionBoundaryAdded=ensureColumn(this.db,'requests','execution_started_at','execution_started_at TEXT');
    if(executionBoundaryAdded)retrySqliteBusySync(()=>this.db.prepare("UPDATE requests SET execution_started_at=started_at WHERE status='inflight' AND execution_started_at IS NULL").run());
    ensureColumn(this.db,'room_messages','sequence','sequence INTEGER');
    retrySqliteBusySync(()=>this.db.exec('CREATE INDEX IF NOT EXISTS idx_room_messages_sequence ON room_messages(sequence)'));
    retrySqliteBusySync(()=>this.db.prepare('DELETE FROM audit_outbox WHERE sent_at IS NOT NULL').run());
  }
  bindPaymentQuote({requestId,fingerprint,service,buyerSeat,price,memo}){
    const key=`payment_quote:${requestId}`,now=Date.now(),nowIso=new Date(now).toISOString(),expiresAt=new Date(now+PAYMENT_QUOTE_TTL_MS).toISOString();
    const exactRow=row=>row&&row.fingerprint===fingerprint&&row.service===service&&row.buyer_seat===buyerSeat&&Number(row.price_credits)===Number(price)&&row.memo===memo;
    this.db.exec('BEGIN IMMEDIATE');try{
      let existing=this.db.prepare('SELECT * FROM payment_quotes WHERE request_id=?').get(requestId)??null;
      if(!existing){
        const legacy=this.db.prepare('SELECT value FROM metadata WHERE key=?').get(key)?.value??null;
        if(legacy!==null){
          let parsed;try{parsed=JSON.parse(legacy);}catch{this.db.exec('COMMIT');return {status:'corrupt'};}
          if(!exactRow(parsed)){this.db.exec('COMMIT');return {status:'conflict',quote:parsed};}
          const issued=Number.isFinite(Date.parse(parsed.issued_at))?parsed.issued_at:nowIso;
          this.db.prepare('INSERT OR IGNORE INTO payment_quotes(request_id,fingerprint,service,buyer_seat,price_credits,memo,issued_at,last_seen_at) VALUES(?,?,?,?,?,?,?,?)').run(requestId,fingerprint,service,buyerSeat,Number(price),memo,issued,nowIso);
          this.db.prepare('DELETE FROM metadata WHERE key=?').run(key);
          existing=this.db.prepare('SELECT * FROM payment_quotes WHERE request_id=?').get(requestId)??null;
        }
      }
      if(existing&&(!Number.isFinite(Date.parse(existing.issued_at))||now>Date.parse(existing.issued_at)+PAYMENT_QUOTE_TTL_MS)){
        this.db.prepare('DELETE FROM payment_quotes WHERE request_id=?').run(requestId);existing=null;
      }
      if(existing){
        const exact=exactRow(existing);
        if(exact)this.db.prepare('UPDATE payment_quotes SET last_seen_at=? WHERE request_id=?').run(nowIso,requestId);
        this.db.exec('COMMIT');
        return exact?{status:'replay',quote:{version:2,...existing,request_id:existing.request_id,expires_at:new Date(Date.parse(existing.issued_at)+PAYMENT_QUOTE_TTL_MS).toISOString()}}:{status:'conflict',quote:existing};
      }

      const cutoff=new Date(now-PAYMENT_QUOTE_TTL_MS).toISOString();
      this.db.prepare('DELETE FROM payment_quotes WHERE issued_at<?').run(cutoff);
      const buyerCount=Number(this.db.prepare('SELECT COUNT(*) n FROM payment_quotes WHERE buyer_seat=?').get(buyerSeat)?.n??0);
      if(buyerCount>=PAYMENT_QUOTE_MAX_PER_BUYER){this.db.exec('COMMIT');return {status:'capacity',scope:'buyer',retry_after_ms:PAYMENT_QUOTE_TTL_MS};}
      const globalCount=Number(this.db.prepare('SELECT COUNT(*) n FROM payment_quotes').get()?.n??0);
      if(globalCount>=PAYMENT_QUOTE_MAX_GLOBAL){this.db.exec('COMMIT');return {status:'capacity',scope:'global',retry_after_ms:PAYMENT_QUOTE_TTL_MS};}
      this.db.prepare('INSERT INTO payment_quotes(request_id,fingerprint,service,buyer_seat,price_credits,memo,issued_at,last_seen_at) VALUES(?,?,?,?,?,?,?,?)').run(requestId,fingerprint,service,buyerSeat,Number(price),memo,nowIso,nowIso);
      this.db.exec('COMMIT');return {status:'bound',quote:{version:2,request_id:requestId,fingerprint,service,buyer_seat:buyerSeat,price_credits:Number(price),memo,issued_at:nowIso,expires_at:expiresAt}};
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  getPaymentQuote(requestId){
    const row=this.db.prepare('SELECT * FROM payment_quotes WHERE request_id=?').get(requestId);
    if(row){
      const expires=Date.parse(row.issued_at)+PAYMENT_QUOTE_TTL_MS;if(!Number.isFinite(expires)||Date.now()>expires){this.db.prepare('DELETE FROM payment_quotes WHERE request_id=?').run(requestId);return null;}
      return {version:2,...row,request_id:row.request_id,expires_at:new Date(expires).toISOString()};
    }
    const legacyKey=`payment_quote:${requestId}`,raw=this.getMeta(legacyKey);if(raw===null)return null;
    try{
      const parsed=JSON.parse(raw),issued=Date.parse(parsed?.issued_at);
      if(Number.isFinite(issued)&&Date.now()>issued+PAYMENT_QUOTE_TTL_MS){this.db.prepare('DELETE FROM metadata WHERE key=?').run(legacyKey);return null;}
      return parsed;
    }catch{return {corrupt:true};}
  }
  paymentQuoteStats(){
    const total=Number(this.db.prepare('SELECT COUNT(*) n FROM payment_quotes').get()?.n??0),maxPerBuyer=Number(this.db.prepare('SELECT COALESCE(MAX(n),0) n FROM (SELECT COUNT(*) n FROM payment_quotes GROUP BY buyer_seat)').get()?.n??0);
    return {total,max_per_buyer:maxPerBuyer,max_global:PAYMENT_QUOTE_MAX_GLOBAL,max_per_buyer_limit:PAYMENT_QUOTE_MAX_PER_BUYER,ttl_ms:PAYMENT_QUOTE_TTL_MS};
  }
  inspectClaim({requestId,txnId,fingerprint,service,buyerSeat=null}){
    const byReq=this.db.prepare('SELECT * FROM requests WHERE request_id=?').get(requestId),byTxn=this.db.prepare('SELECT * FROM requests WHERE txn_id=?').get(txnId),existing=byReq??byTxn;
    if(!existing)return {status:'missing'};
    const sameCore=existing.request_id===requestId&&existing.txn_id===txnId&&existing.fingerprint===fingerprint&&existing.service===service;
    if(existing.buyer_seat!==null&&buyerSeat!==null&&existing.buyer_seat!==buyerSeat&&byTxn?.txn_id===txnId)return {status:'wrong_buyer'};
    if(sameCore&&existing.buyer_seat===null)return {status:'unattributed'};
    if(!sameCore||buyerSeat===null||existing.buyer_seat!==buyerSeat)return {status:'conflict'};
    if(existing.status==='completed')return {status:'replay',response:JSON.parse(existing.response_json)};
    if(existing.status==='failed')return {status:'failed',error:existing.error_json?JSON.parse(existing.error_json):null};
    return {status:'inflight',startedAt:existing.started_at,executionStartedAt:existing.execution_started_at??null,ageMs:Math.max(0,Date.now()-Date.parse(existing.started_at))};
  }
  claim({requestId,txnId,fingerprint,service,buyerSeat=null}){
    this.db.exec('BEGIN IMMEDIATE');try{
      const byReq=this.db.prepare('SELECT * FROM requests WHERE request_id=?').get(requestId),byTxn=this.db.prepare('SELECT * FROM requests WHERE txn_id=?').get(txnId),existing=byReq??byTxn;
      if(existing){
        const buyerExact=existing.buyer_seat===null||buyerSeat===null||existing.buyer_seat===buyerSeat;
        const exact=existing.request_id===requestId&&existing.txn_id===txnId&&existing.fingerprint===fingerprint&&existing.service===service&&buyerExact;
        if(exact&&existing.buyer_seat===null&&buyerSeat!==null)this.db.prepare('UPDATE requests SET buyer_seat=? WHERE request_id=? AND buyer_seat IS NULL').run(buyerSeat,existing.request_id);
        this.db.exec('COMMIT');
        if(!exact)return {status:'conflict'};
        if(existing.status==='completed')return {status:'replay',response:JSON.parse(existing.response_json)};
        if(existing.status==='failed')return {status:'failed',error:existing.error_json?JSON.parse(existing.error_json):null};
        return {status:'inflight',startedAt:existing.started_at,executionStartedAt:existing.execution_started_at??null,ageMs:Math.max(0,Date.now()-Date.parse(existing.started_at))};
      }
      this.db.prepare(`INSERT INTO requests(request_id,txn_id,fingerprint,service,buyer_seat,status,started_at) VALUES(?,?,?,?,?, 'inflight',?)`).run(requestId,txnId,fingerprint,service,buyerSeat,new Date().toISOString());this.db.exec('COMMIT');return {status:'claimed'};
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  recoverUnstartedClaim({requestId,txnId,fingerprint,service,buyerSeat,staleMs=30_000}){
    const cutoff=new Date(Date.now()-Math.max(1,Number(staleMs)||30_000)).toISOString(),now=new Date().toISOString();
    this.db.exec('BEGIN IMMEDIATE');try{
      const row=this.db.prepare('SELECT * FROM requests WHERE request_id=?').get(requestId);
      if(!row){this.db.exec('COMMIT');return {status:'missing'};}
      const exact=row.request_id===requestId&&row.txn_id===txnId&&row.fingerprint===fingerprint&&row.service===service&&row.buyer_seat===buyerSeat;
      if(!exact){this.db.exec('COMMIT');return {status:'conflict'};}
      if(row.status!=='inflight'){this.db.exec('COMMIT');return {status:row.status};}
      if(row.execution_started_at){this.db.exec('COMMIT');return {status:'started',executionStartedAt:row.execution_started_at};}
      const r=this.db.prepare("UPDATE requests SET started_at=? WHERE request_id=? AND status='inflight' AND execution_started_at IS NULL AND started_at<=?").run(now,requestId,cutoff);
      this.db.exec('COMMIT');return r.changes===1?{status:'reclaimed',startedAt:now}:{status:'not_stale'};
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  markExecutionStarted(requestId,fingerprint){
    const at=new Date().toISOString(),r=this.db.prepare("UPDATE requests SET execution_started_at=? WHERE request_id=? AND fingerprint=? AND status='inflight' AND execution_started_at IS NULL").run(at,requestId,fingerprint);
    if(r.changes===1)return {status:'started',at};
    const row=this.db.prepare('SELECT status,execution_started_at FROM requests WHERE request_id=? AND fingerprint=?').get(requestId,fingerprint);
    if(row?.status==='inflight'&&row.execution_started_at)return {status:'already_started',at:row.execution_started_at};
    return {status:'not_inflight'};
  }
  complete(requestId,fingerprint,response){const r=this.db.prepare(`UPDATE requests SET status='completed',response_json=?,completed_at=? WHERE request_id=? AND fingerprint=? AND status='inflight'`).run(JSON.stringify(response),new Date().toISOString(),requestId,fingerprint);if(r.changes!==1)throw new Error('request_completion_conflict');this.db.prepare('DELETE FROM payment_quotes WHERE request_id=?').run(requestId);this.db.prepare('DELETE FROM metadata WHERE key=?').run(`payment_quote:${requestId}`);}
  fail(requestId,fingerprint,error){const r=this.db.prepare(`UPDATE requests SET status='failed',error_json=?,completed_at=? WHERE request_id=? AND fingerprint=? AND status='inflight'`).run(JSON.stringify(error),new Date().toISOString(),requestId,fingerprint);if(r.changes!==1)throw new Error('request_failure_conflict');this.db.prepare('DELETE FROM payment_quotes WHERE request_id=?').run(requestId);this.db.prepare('DELETE FROM metadata WHERE key=?').run(`payment_quote:${requestId}`);}
  storeGrant(namespaceId,grant){this.db.prepare(`INSERT INTO grants(namespace_id,grant_id,grant_json,revoked_at) VALUES(?,?,?,NULL) ON CONFLICT(namespace_id,grant_id) DO UPDATE SET grant_json=excluded.grant_json,revoked_at=NULL`).run(namespaceId,grant.id,JSON.stringify(grant));}
  revokeGrant(namespaceId,grantId){this.db.prepare('UPDATE grants SET revoked_at=? WHERE namespace_id=? AND grant_id=?').run(new Date().toISOString(),namespaceId,grantId);}
  async load(context,signal){signal?.throwIfAborted?.();const rows=this.db.prepare('SELECT grant_json FROM grants WHERE namespace_id=? AND revoked_at IS NULL').all(context.namespaceId),actor=JSON.stringify(context.actor),authority=JSON.stringify(context.authority);return rows.map(r=>JSON.parse(r.grant_json)).filter(g=>JSON.stringify(g.subject)===actor&&JSON.stringify(g.issuer)===authority);}
  async getUsage(namespaceId,grantId){return this.db.prepare('SELECT used FROM grant_usage WHERE namespace_id=? AND grant_id=?').get(namespaceId,grantId)?.used??0;}
  async tryConsume(namespaceId,grantId,maximumUses){const r=this.db.prepare(`INSERT INTO grant_usage(namespace_id,grant_id,used) VALUES(?,?,1) ON CONFLICT(namespace_id,grant_id) DO UPDATE SET used=used+1 WHERE grant_usage.used < ?`).run(namespaceId,grantId,maximumUses);return r.changes>0;}
  async record(event){this.db.exec('BEGIN IMMEDIATE');try{this.db.prepare('INSERT OR IGNORE INTO audit(event_id,at,trace_id,event_json) VALUES(?,?,?,?)').run(event.id,event.at,event.traceId??null,JSON.stringify(event));this.db.prepare('INSERT OR IGNORE INTO audit_outbox(event_id,event_json,attempts,sent_at) VALUES(?,?,0,NULL)').run(event.id,JSON.stringify(event));this.db.exec('COMMIT');}catch(e){this.db.exec('ROLLBACK');throw e;}}
  pendingAudit(limit=100){return this.db.prepare('SELECT event_id,event_json,attempts FROM audit_outbox WHERE sent_at IS NULL ORDER BY rowid ASC LIMIT ?').all(limit).map(r=>({...r,event:JSON.parse(r.event_json)}));}
  markAuditSent(id){this.db.prepare('DELETE FROM audit_outbox WHERE event_id=?').run(id);}
  bumpAuditAttempt(id){this.db.prepare('UPDATE audit_outbox SET attempts=attempts+1 WHERE event_id=?').run(id);}
  auditCount(){return this.db.prepare('SELECT COUNT(*) count FROM audit').get().count;}
  auditTrace(traceId,limit=100){const n=Math.max(1,Math.min(200,Number(limit)||100));return this.db.prepare('SELECT event_json FROM audit WHERE trace_id=? ORDER BY rowid ASC LIMIT ?').all(traceId,n+1).map(r=>JSON.parse(r.event_json));}
  roomMessageSeen(id){if(!id)return false;return this.db.prepare(`SELECT status FROM room_messages WHERE message_id=? AND status='completed'`).get(id)?.status==='completed';}
  roomMessageTerminal(id){if(!id)return false;const status=this.db.prepare('SELECT status FROM room_messages WHERE message_id=?').get(id)?.status;return status==='completed'||status==='dead_letter';}
  claimRoomMessage(id,{sequence=null,maxAttempts=5,staleMs=120_000}={}){
    if(!id)return true;this.db.exec('BEGIN IMMEDIATE');try{
      const row=this.db.prepare('SELECT status,attempts,processed_at FROM room_messages WHERE message_id=?').get(id),now=new Date();let ok=false;
      if(!row){this.db.prepare(`INSERT INTO room_messages(message_id,sequence,status,attempts,error,processed_at) VALUES(?,?,'inflight',1,NULL,?)`).run(id,Number.isSafeInteger(Number(sequence))?Number(sequence):null,now.toISOString());ok=true;}
      else if(row.status==='failed'&&row.attempts<maxAttempts){this.db.prepare(`UPDATE room_messages SET status='inflight',attempts=attempts+1,error=NULL,processed_at=? WHERE message_id=?`).run(now.toISOString(),id);ok=true;}
      else if(row.status==='inflight'&&row.attempts<maxAttempts&&now-Date.parse(row.processed_at)>staleMs){this.db.prepare(`UPDATE room_messages SET status='inflight',attempts=attempts+1,error=NULL,processed_at=? WHERE message_id=?`).run(now.toISOString(),id);ok=true;}
      this.db.exec('COMMIT');return ok;
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  pruneRoomMessages({throughSequence,retainSequences=2000}={}){
    const through=Number(throughSequence),retain=Math.max(0,Math.min(100_000,Number(retainSequences)||0));
    if(!Number.isSafeInteger(through)||through<0)throw new Error('invalid_room_prune_sequence');
    const cutoff=Math.max(0,through-retain);
    return this.db.prepare("DELETE FROM room_messages WHERE ((sequence IS NOT NULL AND sequence<=?) OR (sequence IS NULL AND ?>0)) AND status IN ('completed','dead_letter')").run(cutoff,through).changes;
  }
  markRoomMessage(id,status='completed',error=null){if(!id)return;this.db.prepare(`INSERT INTO room_messages(message_id,status,attempts,error,processed_at) VALUES(?,?,1,?,?) ON CONFLICT(message_id) DO UPDATE SET status=excluded.status,error=excluded.error,processed_at=excluded.processed_at`).run(id,status,error,new Date().toISOString());}
  markRoomMessageFailed(id,error,{maxAttempts=5}={}){
    if(!id)return {status:'ignored',attempts:0};const row=this.db.prepare('SELECT attempts FROM room_messages WHERE message_id=?').get(id),attempts=row?.attempts??1,status=attempts>=maxAttempts?'dead_letter':'failed';
    this.markRoomMessage(id,status,String(error??'unknown').slice(0,2000));return {status,attempts};
  }
  incrementCounter(key,amount=1){
    if(typeof key!=='string'||!key||key.length>160||!Number.isSafeInteger(amount))throw new Error('invalid_counter_update');
    this.db.prepare('INSERT INTO counters(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=value+excluded.value').run(key,amount);
  }
  counterMap(prefix=''){
    const rows=prefix?this.db.prepare('SELECT key,value FROM counters WHERE key LIKE ? ORDER BY key').all(`${prefix}%`):this.db.prepare('SELECT key,value FROM counters ORDER BY key').all();
    return Object.fromEntries(rows.map(r=>[r.key,Number(r.value)]));
  }
  arenaStats({prices={}}={}){
    const rows=this.db.prepare('SELECT service,txn_id,buyer_seat,status,response_json,started_at,completed_at FROM requests ORDER BY rowid ASC').all();
    const paidBuyers=new Set(),completedBuyers=new Set(),txns=new Set(),paidServiceMix={},serviceMix={},creditsByService={},outcomeMix={},latencies=[],smokeBuyers=new Set(),premiumBuyers=new Set();
    let earned=0,unknownPrice=0,legacyUnattributed=0,malformed=0,signedDeliveries=0,traceDeliveries=0,completed=0,failed=0,inflight=0;
    for(const row of rows){
      if(row.txn_id)txns.add(row.txn_id);
      paidServiceMix[row.service]=(paidServiceMix[row.service]??0)+1;
      let response=null,receipt=null;
      if(row.response_json){try{response=JSON.parse(row.response_json);receipt=response?.receipt??null;}catch{malformed++;}}
      const buyer=typeof row.buyer_seat==='string'&&row.buyer_seat?row.buyer_seat:(typeof receipt?.buyer_seat==='string'&&receipt.buyer_seat?receipt.buyer_seat:null);
      if(buyer){
        paidBuyers.add(buyer);
        if(row.service==='sledgewire.smoke')smokeBuyers.add(buyer);else premiumBuyers.add(buyer);
      }else legacyUnattributed++;
      const configuredPrice=Number(prices?.[row.service]),receiptPrice=Number(receipt?.payment?.price_credits);
      const price=Number.isInteger(configuredPrice)&&configuredPrice>0?configuredPrice:(Number.isInteger(receiptPrice)&&receiptPrice>0?receiptPrice:null);
      if(price===null)unknownPrice++;else{earned+=price;creditsByService[row.service]=(creditsByService[row.service]??0)+price;}
      if(row.status==='inflight'){inflight++;continue;}
      if(row.status==='failed'){failed++;continue;}
      if(row.status!=='completed')continue;
      completed++;serviceMix[row.service]=(serviceMix[row.service]??0)+1;
      if(buyer)completedBuyers.add(buyer);
      const start=Date.parse(row.started_at),end=Date.parse(row.completed_at);if(Number.isFinite(start)&&Number.isFinite(end)&&end>=start)latencies.push(end-start);
      if(!response)continue;
      const outcome=response?.outcome_state??receipt?.state??'UNKNOWN';
      outcomeMix[String(outcome)]=(outcomeMix[String(outcome)]??0)+1;
      if(receipt?.proof?.signature)signedDeliveries++;
      if(typeof response?.trace_id==='string'&&response.trace_id&&response.trace_id===receipt?.sharedos_trace_id)traceDeliveries++;
    }
    latencies.sort((a,b)=>a-b);const percentile=p=>latencies.length?latencies[Math.min(latencies.length-1,Math.max(0,Math.ceil(latencies.length*p)-1))]:null;
    let converted=0;for(const b of smokeBuyers)if(premiumBuyers.has(b))converted++;
    const rejects=this.counterMap('arena.reject.'),rejections={};for(const [k,v] of Object.entries(rejects))rejections[k.slice('arena.reject.'.length)]=v;
    const engagementRaw=this.counterMap('arena.'),engagement={};for(const [k,v] of Object.entries(engagementRaw))if(!k.startsWith('arena.reject.'))engagement[k.slice('arena.'.length)]=v;
    const revenueLeaders=Object.entries(creditsByService).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
    return {
      schema:'sledgewire.arena.stats.v2',
      earned_credits:earned,
      earned_credits_basis:'verified payment claims in local durable store; configured catalog price preferred',
      unique_buyers:paidBuyers.size,
      unique_completed_buyers:completedBuyers.size,
      paid_transactions:txns.size,
      completed_deliveries:completed,
      failed_requests:failed,
      inflight_requests:inflight,
      credits_per_unique_buyer:paidBuyers.size?Number((earned/paidBuyers.size).toFixed(2)):0,
      paid_service_mix:paidServiceMix,
      credits_by_service:creditsByService,
      top_revenue_service:revenueLeaders[0]?.[0]??null,
      service_mix:serviceMix,
      outcome_mix:outcomeMix,
      payment_rejections:rejections,
      delivery_ms:{p50:percentile(0.50),p95:percentile(0.95),max:latencies.length?latencies.at(-1):null},
      smoke_buyers:smokeBuyers.size,
      smoke_to_premium_buyers:converted,
      smoke_to_premium_conversion:smokeBuyers.size?Number((converted/smokeBuyers.size).toFixed(4)):0,
      delivery_success_rate:(completed+failed)?Number((completed/(completed+failed)).toFixed(4)):null,
      engagement,
      integrity:{signed_deliveries:signedDeliveries,trace_bound_deliveries:traceDeliveries,malformed_completed_rows:malformed,unknown_price_claims:unknownPrice,legacy_unattributed_claims:legacyUnattributed}
    };
  }
  getMeta(key){return this.db.prepare('SELECT value FROM metadata WHERE key=?').get(key)?.value??null;}
  setMeta(key,value){this.db.prepare(`INSERT INTO metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(key,String(value));}
}
