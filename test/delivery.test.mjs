import test from 'node:test';
import assert from 'node:assert/strict';
import {deliverArenaResponse,INLINE_DELIVERY_MAX_BYTES,ROOM_MESSAGE_MAX_BYTES} from '../src/sharednet/delivery.mjs';

function fakeApi(){
  const calls={posts:[],uploads:[]};
  return {calls,
    async post(room,content,opts){calls.posts.push({room,content,opts});return {message:{id:'msg_ABCDEFGHIJ'}};},
    async uploadArtifact(content,opts){calls.uploads.push({content,opts});return {artifact:{id:'art_ABCDEFGHIJ'},url:'https://sharednet.ai/f/art_ABCDEFGHIJ?k=afk_test'};}
  };
}
test('small Arena delivery stays inline',async()=>{
  const api=fakeApi();const r=await deliverArenaResponse(api,'rom_ABCDEFGHIJ','msg_ABCDEFGHIJ',{type:'sledgewire.service.response.v1',request_id:'req-1',state:'DELIVERED',receipt:{proof:{signature:'x'}}});
  assert.equal(r.mode,'inline');assert.equal(api.calls.uploads.length,0);assert.equal(api.calls.posts.length,1);assert.ok(Buffer.byteLength(api.calls.posts[0].content)<=ROOM_MESSAGE_MAX_BYTES);
});
test('large signed Arena delivery becomes SharedNet artifact pointer',async()=>{
  const api=fakeApi();const response={type:'sledgewire.service.response.v1',request_id:'req-large',service:'sledgewire.gauntlet',state:'DELIVERED',trace_id:'trace-1',receipt:{blob:'x'.repeat(INLINE_DELIVERY_MAX_BYTES+5000)}};
  const r=await deliverArenaResponse(api,'rom_ABCDEFGHIJ','msg_ABCDEFGHIJ',response);
  assert.equal(r.mode,'artifact');assert.equal(api.calls.uploads.length,1);assert.equal(api.calls.posts.length,1);
  const pointer=JSON.parse(api.calls.posts[0].content);assert.equal(pointer.type,'sledgewire.artifact.delivery.v1');assert.equal(pointer.artifact_id,'art_ABCDEFGHIJ');assert.match(pointer.content_sha256,/^[0-9a-f]{64}$/);assert.ok(Buffer.byteLength(api.calls.posts[0].content)<=ROOM_MESSAGE_MAX_BYTES);
});
test('artifact filename is request-bound and sanitized',async()=>{
  const api=fakeApi();const response={request_id:'../bad/request',service:'sledgewire.gauntlet',state:'DELIVERED',receipt:{blob:'x'.repeat(INLINE_DELIVERY_MAX_BYTES+5000)}};
  await deliverArenaResponse(api,'rom_ABCDEFGHIJ','msg_ABCDEFGHIJ',response);assert.equal(api.calls.uploads[0].opts.filename.includes('/'),false);assert.match(api.calls.uploads[0].opts.filename,/^sledgewire-/);
});
