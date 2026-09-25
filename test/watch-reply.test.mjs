import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareWatchReply} from '../src/sharednet/watch-reply.mjs';
import {INLINE_DELIVERY_MAX_BYTES,ROOM_MESSAGE_MAX_BYTES} from '../src/sharednet/delivery.mjs';

const room='rom_ABCDEFGHIJ',message={id:'msg_ABCDEFGHIJ',room_id:room,sender_instance_id:'i_ZYXWVUTSRQ',content:'x'};
function api(){
  const calls={uploads:[]};
  return {calls,async uploadArtifact(content,opts){calls.uploads.push({content,opts});return {artifact:{id:'art_ABCDEFGHIJ'},url:'https://www.sharednet.ai/api/v1/artifacts/art_ABCDEFGHIJ'};}};
}
test('watch reply emits one inline response for one event',async()=>{
  const a=api(),r=await prepareWatchReply(JSON.stringify({room_id:room,messages:[message]}),{expectedRoom:room,api:a,handle:async()=>({type:'ok',state:'DELIVERED'})});
  assert.equal(r.reply,true);assert.equal(r.mode,'inline');assert.equal(a.calls.uploads.length,0);assert.deepEqual(JSON.parse(r.text),{type:'ok',state:'DELIVERED'});
});
test('watch reply uploads oversized signed response and emits a compact pointer',async()=>{
  const a=api(),r=await prepareWatchReply(JSON.stringify({room_id:room,messages:[message]}),{expectedRoom:room,api:a,handle:async()=>({type:'sledgewire.service.response.v1',request_id:'req-watch',service:'sledgewire.gauntlet',state:'DELIVERED',outcome_state:'READY',receipt:{blob:'x'.repeat(INLINE_DELIVERY_MAX_BYTES+5000)}})});
  assert.equal(r.mode,'artifact');assert.equal(a.calls.uploads.length,1);assert.ok(Buffer.byteLength(r.text)<=ROOM_MESSAGE_MAX_BYTES);const p=JSON.parse(r.text);assert.equal(p.outcome_state,'READY');assert.equal(p.artifact_id,'art_ABCDEFGHIJ');
});
test('watch reply refuses ambiguous multi-message batches',async()=>{
  const a=api();await assert.rejects(()=>prepareWatchReply(JSON.stringify({room_id:room,messages:[message,{...message,id:'msg_ZYXWVUTSRQ'}]}),{expectedRoom:room,api:a,handle:async()=>({ok:true})}),/single_message/);
});
test('watch reply refuses message without a valid reply id',async()=>{
  const a=api();await assert.rejects(()=>prepareWatchReply(JSON.stringify({room_id:room,messages:[{...message,id:'bad'}]}),{expectedRoom:room,api:a,handle:async()=>({ok:true})}),/valid_id/);
});
