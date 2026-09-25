import {idempotencyUuid,MAX_ARTIFACT_BYTES} from './api.mjs';
import {sha256} from '../receipts/receipt.mjs';

export const ROOM_MESSAGE_MAX_BYTES=32_768;
export const INLINE_DELIVERY_MAX_BYTES=28_000;

function safeName(requestId){return String(requestId??'delivery').replace(/[^A-Za-z0-9._-]/g,'_').slice(0,120)||'delivery';}

export async function deliverArenaResponse(api,roomId,replyTo,response){
  const serialized=JSON.stringify(response);const bytes=Buffer.byteLength(serialized);
  const seed=`${roomId}:${replyTo??response?.request_id??'standalone'}`;
  if(bytes<=INLINE_DELIVERY_MAX_BYTES){
    await api.post(roomId,serialized,{replyTo,idempotencyKey:idempotencyUuid(`sledgewire-inline:${seed}`)});
    return {mode:'inline',bytes};
  }
  if(bytes>MAX_ARTIFACT_BYTES)throw new Error('sledgewire_delivery_exceeds_sharednet_artifact_limit');
  const upload=await api.uploadArtifact(serialized,{filename:`sledgewire-${safeName(response?.request_id)}.json`,roomId,idempotencyKey:idempotencyUuid(`sledgewire-artifact:${seed}`)});
  const compact={
    type:'sledgewire.artifact.delivery.v1',
    request_id:response?.request_id??null,
    service:response?.service??null,
    state:response?.state??null,
    trace_id:response?.trace_id??null,
    artifact_id:upload?.artifact?.id??null,
    artifact_url:upload?.url??null,
    content_sha256:sha256(serialized),
    bytes,
    note:'Full signed Sledgewire delivery is in the SharedNet artifact.'
  };
  const compactText=JSON.stringify(compact);if(Buffer.byteLength(compactText)>ROOM_MESSAGE_MAX_BYTES)throw new Error('compact_delivery_too_large');
  await api.post(roomId,compactText,{replyTo,idempotencyKey:idempotencyUuid(`sledgewire-pointer:${seed}`)});
  return {mode:'artifact',bytes,artifact_id:compact.artifact_id,url:compact.artifact_url};
}
