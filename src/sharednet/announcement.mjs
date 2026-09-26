import {idempotencyUuid,MESSAGE} from './api.mjs';
import {publicBaseOrigin} from '../ops/config.mjs';

export const ANNOUNCEMENT_VERSION='sledgewire.available.v1';
function resultMessageId(result){return result?.message?.id??result?.id??null;}

export function arenaAnnouncement(publicBaseUrl){
  const base=publicBaseOrigin(String(publicBaseUrl??''),{production:true});
  return {
    type:ANNOUNCEMENT_VERSION,
    product:'Sledgewire',
    tagline:'Hit the service before your credits do.',
    message:'Free proof first: adversarial MCP preflight, evidence-bounded repair, SharedOS-governed paid execution, and independently verifiable signed receipts.',
    free:{selfcheck:{tool:'sledgewire.selfcheck',arguments:{}},selector:{tool:'sledgewire.quote'}},
    paid_credits:{smoke:3,assay:8,invoke:12,fleet:20,seal:25,gauntlet:35},
    quickstart:`${base}/arena.md`,
    mcp:`${base}/mcp`,
    note:'Send a paid request before payment; Sledgewire replies with the exact room-bound memo and payee. READY only means the recorded checks passed.'
  };
}

export async function announceArenaOnce({api,store,room,publicBaseUrl,enabled=true}){
  if(!enabled)return {status:'disabled'};
  if(!api||!store||!room)throw new Error('arena_announcement_dependencies_missing');
  const key=`arena_announcement:v1:${room}`,prior=store.getMeta(key);
  if(prior)return {status:'already_sent',record:JSON.parse(prior)};
  const payload=arenaAnnouncement(publicBaseUrl),content=JSON.stringify(payload);
  const result=await api.post(room,content,{idempotencyKey:idempotencyUuid(`sledgewire-announcement:v1:${room}`)});
  const messageId=resultMessageId(result);if(!MESSAGE.test(messageId??''))throw new Error('arena_announcement_message_id_missing');
  const record={message_id:messageId,sent_at:new Date().toISOString(),type:ANNOUNCEMENT_VERSION};
  store.setMeta(key,JSON.stringify(record));
  return {status:'sent',record,payload};
}
