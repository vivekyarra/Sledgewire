import test from 'node:test';
import assert from 'node:assert/strict';
import {joinWithInvite,SharedNetApi,INSTANCE_TOKEN,INVITE_TOKEN} from '../src/sharednet/api.mjs';
import {handleRpc} from '../src/server/protocol.mjs';

const room='rom_'+ 'A'.repeat(26);
const invite='rit_'+ 'B'.repeat(43);
const member='sni_'+ 'C'.repeat(43);

test('current SharedNet guest invite path is accepted',async()=>{
  assert.equal(INVITE_TOKEN.test(invite),true);assert.equal(INSTANCE_TOKEN.test(member),true);
  const calls=[];
  const fetchImpl=async(url,init)=>{calls.push({url,init});return new Response(JSON.stringify({member_token:member,room:{id:room},membership:{room_id:room},history:{items:[{sequence:2},{sequence:9}]}}),{status:200});};
  const r=await joinWithInvite({roomId:room,inviteToken:invite,idempotencyKey:'123e4567-e89b-42d3-a456-426614174000',fetchImpl});
  assert.equal(r.token,member);assert.equal(r.lastSequence,9);assert.equal(calls.length,1);
  assert.equal(calls[0].init.headers.authorization,`Bearer ${invite}`);
  assert.equal(calls[0].init.headers['idempotency-key'],'123e4567-e89b-42d3-a456-426614174000');
  const body=JSON.parse(calls[0].init.body);assert.equal(body.name,'sledgewire');assert.equal(body.runtime.kind,'custom');
});

test('legacy room member token class remains accepted for event compatibility',()=>{
  assert.equal(INSTANCE_TOKEN.test('rmt_'+ 'D'.repeat(43)),true);
});

test('SharedNet wait sends only documented after and timeout params',async()=>{
  let seen='';
  const api=new SharedNetApi({token:member,fetchImpl:async(url)=>{seen=url;return new Response(JSON.stringify({items:[],next_cursor:null,has_more:false}),{status:200});}});
  await api.wait(room,42);const u=new URL(seen);
  assert.equal(u.searchParams.get('after'),'42');assert.equal(u.searchParams.get('timeout'),'25');assert.equal(u.searchParams.has('limit'),false);
});

test('production public MCP routes paid calls to SharedNet payment instead of free execution',async()=>{
  const r=await handleRpc({jsonrpc:'2.0',id:7,method:'tools/call',params:{name:'sledgewire.smoke',arguments:{endpoint:'https://never-connect.invalid/mcp'}}},{publicArena:true,publicBaseUrl:'https://sledgewire.example',arenaRoomId:room});
  const out=r.result.structuredContent;assert.equal(out.state,'PAYMENT_REQUIRED');assert.equal(out.price_credits,3);assert.equal(out.arena_room_id,room);assert.equal(out.request_template.service,'sledgewire.smoke');assert.ok(out.proof?.signature);
});

test('production public MCP refuses to route structurally invalid paid input to payment',async()=>{
  const r=await handleRpc({jsonrpc:'2.0',id:8,method:'tools/call',params:{name:'sledgewire.fleet',arguments:{targets:[]}}},{publicArena:true,publicBaseUrl:'https://sledgewire.example',arenaRoomId:room});
  const out=r.result.structuredContent;assert.equal(out.state,'INCOMPATIBLE');assert.equal(out.reason,'invalid_input');assert.ok(out.proof?.signature);
});
