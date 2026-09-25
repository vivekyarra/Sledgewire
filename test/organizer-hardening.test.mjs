import test from 'node:test';
import assert from 'node:assert/strict';
import {joinWithInvite,SharedNetApi} from '../src/sharednet/api.mjs';
import {compactForRoom} from '../src/sharednet/delivery.mjs';
import {handleRpc} from '../src/server/protocol.mjs';

const memberToken='sni_'+ 'A'.repeat(43);
const inviteToken='rit_'+ 'B'.repeat(43);
const room='rom_'+ 'A'.repeat(26);

test('guest invite join sends runtime metadata and returns token without printing assumptions',async()=>{
  const calls=[];
  const fetchImpl=async(url,init)=>{
    calls.push({url,init});
    return new Response(JSON.stringify({
      member_token:memberToken,
      room:{id:room},
      membership:{room_id:room},
      history:{items:[{sequence:3},{sequence:7}]}
    }),{status:200,headers:{'content-type':'application/json'}});
  };
  const out=await joinWithInvite({roomId:room,inviteToken,idempotencyKey:'123e4567-e89b-42d3-a456-426614174000',fetchImpl});
  assert.equal(out.token,memberToken);
  assert.equal(out.lastSequence,7);
  assert.equal(calls.length,1);
  assert.match(calls[0].url,/\/join$/);
  assert.equal(calls[0].init.headers.authorization,`Bearer ${inviteToken}`);
  assert.equal(calls[0].init.headers['idempotency-key'],'123e4567-e89b-42d3-a456-426614174000');
  const body=JSON.parse(calls[0].init.body);
  assert.equal(body.name,'sledgewire');
  assert.equal(body.runtime.kind,'custom');
});

test('SharedNet wait uses only documented after and timeout query parameters',async()=>{
  let seen='';
  const fetchImpl=async(url)=>{seen=url;return new Response(JSON.stringify({items:[],next_cursor:null,has_more:false}),{status:200});};
  const api=new SharedNetApi({token:memberToken,fetchImpl});
  await api.wait(room,42);
  const u=new URL(seen);
  assert.equal(u.searchParams.get('after'),'42');
  assert.equal(u.searchParams.get('timeout'),'25');
  assert.equal(u.searchParams.has('limit'),false);
});

test('public production-style paid MCP call routes to payment instead of executing target',async()=>{
  const r=await handleRpc({
    jsonrpc:'2.0',id:9,method:'tools/call',
    params:{name:'sledgewire.smoke',arguments:{endpoint:'https://should-never-connect.invalid/mcp'}}
  },{publicArena:true,publicBaseUrl:'https://sledgewire.example',arenaRoomId:room});
  assert.equal(r.result.structuredContent.state,'PAYMENT_REQUIRED');
  assert.equal(r.result.structuredContent.price_credits,3);
  assert.equal(r.result.structuredContent.arena_room_id,room);
  assert.ok(r.result.structuredContent.proof?.signature);
});

test('oversized Room delivery is converted to a SharedNet artifact pointer',async()=>{
  const calls=[];
  const api={async uploadArtifact(roomId,filename,bytes,opts){calls.push({roomId,filename,bytes,opts});return {artifact:{id:'art_'+ 'A'.repeat(26)},url:'https://sharednet.ai/f/art_example?k=abc'};}};
  const response={type:'sledgewire.service.response.v1',request_id:'req-big',service:'sledgewire.gauntlet',state:'DELIVERED',trace_id:'trace-1',receipt:{blob:'x'.repeat(30_000)}};
  const out=await compactForRoom(api,room,'msg_'+ 'A'.repeat(26),response);
  const compact=JSON.parse(out.text);
  assert.equal(calls.length,1);
  assert.equal(compact.type,'sledgewire.artifact_delivery.v1');
  assert.equal(compact.request_id,'req-big');
  assert.equal(compact.artifact_id,'art_'+ 'A'.repeat(26));
  assert.ok(compact.bytes>24_000);
  assert.match(compact.sha256,/^[0-9a-f]{64}$/);
});

test('small Room delivery stays inline and does not upload',async()=>{
  const api={async uploadArtifact(){throw new Error('should_not_upload');}};
  const response={type:'sledgewire.info.v1',message:'hello'};
  const out=await compactForRoom(api,room,'msg_'+ 'B'.repeat(26),response);
  assert.equal(out.artifact,null);
  assert.deepEqual(JSON.parse(out.text),response);
});

test('artifact upload enforces SharedNet 4 MiB ceiling before network call',async()=>{
  let called=false;
  const api=new SharedNetApi({token:memberToken,fetchImpl:async()=>{called=true;throw new Error('network_should_not_run');}});
  await assert.rejects(()=>api.uploadArtifact(room,'report.json',Buffer.alloc(4_194_305)),/artifact_too_large/);
  assert.equal(called,false);
});
