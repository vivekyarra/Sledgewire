import {ArenaStore} from '../src/store/arena-store.mjs';
import {postAuditEvent} from '../src/ops/audit-sink.mjs';

const url=process.env.SHAREDOS_AUDIT_URL,key=process.env.SHAREDOS_KEY;
if(!url||!key)throw new Error('SHAREDOS_AUDIT_URL_and_SHAREDOS_KEY_required');
const store=new ArenaStore(process.env.SLEDGEWIRE_DB??'.sledgewire/arena.db');let sent=0;
for(const row of store.pendingAudit(200)){
  try{
    await postAuditEvent({url,key,event:row.event});
    store.markAuditSent(row.event_id);sent++;
  }catch(e){
    store.bumpAuditAttempt(row.event_id);
    console.error(`audit ${row.event_id}: ${e.message}`);
  }
}
console.log(JSON.stringify({sent,pending:store.pendingAudit(1).length>0},null,2));
