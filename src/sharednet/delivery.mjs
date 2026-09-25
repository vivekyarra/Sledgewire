import {idempotencyUuid,MAX_ARTIFACT_BYTES} from './api.mjs';
import {sha256} from '../receipts/receipt.mjs';

export const ROOM_MESSAGE_MAX_BYTES=32_768;
export const INLINE_DELIVERY_MAX_BYTES=28_000;

function safeName(requestId){return String(requestId??'delivery').replace(/[^A-Za-z0-9._-]/g,'_').slice(0,120)||'delivery';}

export async function prepareArenaResponse(api,roomId,response,{seed='standalone'}={}){
  const serialized=JSON.stringify(response),bytes=Buffer.byteLength(serialized);
  if(bytes<=INLINE_DELIVERY_MAX_BYTES)return {mode:'inline',bytes,text:serialized};
  if(bytes>MAX_ARTIFACT_BYTES)throw new Error('sledgewire_delivery_exceeds_sharednet_artifact_limit');
  const upload=await api.uploadArtifact(serialized,{filename:`sledgewire-${safeName(response?.request_id)}.json`,roomId,idempotencyKey:idempotencyUuid(`sledgewire-artifact:${seed}`)});
  const compact={
    type:'sledgewire.artifact.delivery.v1',
    request_id:response?.request_id??null,
    service:response?.service??null,
    state:response?.state??null,
    outcome_state:response?.outcome_state??null,
    trace_id:response?.trace_id??null,
    artifact_id:upload?.artifact?.id??null,
    artifact_url:upload?.url??null,
    content_sha256:sha256(serialized),
    bytes,
    note:'Full signed Sledgewire delivery is in the SharedNet artifact.'
  };
  const text=JSON.stringify(compact);
  if(Buffer.byteLength(text)>ROOM_MESSAGE_MAX_BYTES)throw new Error('compact_delivery_too_large');
  return {mode:'artifact',bytes,text,artifact_id:compact.artifact_id,url:compact.artifact_url};
}

export async function deliverArenaResponse(api,roomId,replyTo,response){
  const seed=`${roomId}:${replyTo??response?.request_id??'standalone'}`;
  const prepared=await prepareArenaResponse(api,roomId,response,{seed});
  await api.post(roomId,prepared.text,{replyTo,idempotencyKey:idempotencyUuid(`sledgewire-${prepared.mode==='inline'?'inline':'pointer'}:${seed}`)});
  return {mode:prepared.mode,bytes:prepared.bytes,...(prepared.mode==='artifact'?{artifact_id:prepared.artifact_id,url:prepared.url}:{})};
}
