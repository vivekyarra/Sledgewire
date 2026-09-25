import {createHash} from 'node:crypto';
import {idempotencyUuid} from './api.mjs';

const ROOM_TEXT_BUDGET=24_000;

export async function compactForRoom(api,room,messageId,response){
  const text=JSON.stringify(response);
  if(Buffer.byteLength(text,'utf8')<=ROOM_TEXT_BUDGET)return {text,artifact:null};
  const sha256=createHash('sha256').update(text).digest('hex');
  const filename=`sledgewire-${safe(response.request_id??messageId??'delivery')}.json`;
  const uploaded=await api.uploadArtifact(room,filename,Buffer.from(text),{contentType:'application/json',idempotencyKey:idempotencyUuid(`sledgewire-artifact:${room}:${messageId??sha256}`)});
  const artifactId=uploaded?.artifact?.id??null;
  const url=uploaded?.url??null;
  const compact={
    type:'sledgewire.artifact_delivery.v1',
    request_id:response.request_id??null,
    service:response.service??null,
    state:response.state??null,
    trace_id:response.trace_id??null,
    artifact_id:artifactId,
    artifact_url:url,
    sha256,
    bytes:Buffer.byteLength(text,'utf8'),
    note:'Full signed delivery exceeded the Room message budget and was uploaded as a SharedNet artifact addressed to this Room.'
  };
  return {text:JSON.stringify(compact),artifact:{id:artifactId,url,sha256,bytes:compact.bytes}};
}
function safe(x){return String(x).replace(/[^A-Za-z0-9._-]+/g,'_').slice(0,80);}
