import test from 'node:test';
import assert from 'node:assert/strict';
import {idempotencyUuid} from '../src/sharednet/api.mjs';
import {ArenaStore} from '../src/store/arena-store.mjs';

test('reply idempotency UUID is deterministic and v4-shaped',()=>{const a=idempotencyUuid('msg_ABCDEFGHIJ'),b=idempotencyUuid('msg_ABCDEFGHIJ'),c=idempotencyUuid('msg_ZYXWVUTSRQ');assert.equal(a,b);assert.notEqual(a,c);assert.match(a,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);});
test('room message claim is single-owner while inflight',()=>{const s=new ArenaStore(':memory:');assert.equal(s.claimRoomMessage('msg_1'),true);assert.equal(s.claimRoomMessage('msg_1'),false);s.markRoomMessage('msg_1','completed');assert.equal(s.roomMessageSeen('msg_1'),true);assert.equal(s.roomMessageTerminal('msg_1'),true);assert.equal(s.claimRoomMessage('msg_1'),false);});
test('failed room message can be reclaimed below retry ceiling',()=>{const s=new ArenaStore(':memory:');assert.equal(s.claimRoomMessage('msg_2'),true);assert.equal(s.markRoomMessageFailed('msg_2','network',{maxAttempts:3}).status,'failed');assert.equal(s.claimRoomMessage('msg_2',{maxAttempts:3}),true);});
test('poison room message becomes terminal dead letter and cannot head-of-line block forever',()=>{const s=new ArenaStore(':memory:');for(let i=1;i<=3;i++){assert.equal(s.claimRoomMessage('msg_poison',{maxAttempts:3}),true);const f=s.markRoomMessageFailed('msg_poison','deterministic failure',{maxAttempts:3});assert.equal(f.status,i===3?'dead_letter':'failed');}assert.equal(s.roomMessageTerminal('msg_poison'),true);assert.equal(s.roomMessageSeen('msg_poison'),false);assert.equal(s.claimRoomMessage('msg_poison',{maxAttempts:3}),false);});

test('terminal Room dedupe state is pruned only behind the durable cursor retention window',()=>{
  const s=new ArenaStore(':memory:');
  for(let i=1;i<=5000;i++){const id='msg_'+String(i).padStart(10,'0');assert.equal(s.claimRoomMessage(id,{sequence:i}),true);s.markRoomMessage(id,'completed');}
  const removed=s.pruneRoomMessages({throughSequence:5000,retainSequences:2000});
  assert.equal(removed,3000);
  assert.equal(s.db.prepare('SELECT COUNT(*) n FROM room_messages').get().n,2000);
  assert.equal(s.roomMessageTerminal('msg_0000001000'),false);
  assert.equal(s.roomMessageTerminal('msg_0000004000'),true);
});
test('successful external audit acknowledgement removes transient outbox row but keeps durable audit evidence',async()=>{
  const s=new ArenaStore(':memory:'),event={id:'evt-1',at:new Date().toISOString(),traceId:'trace-1',kind:'test'};
  await s.record(event);assert.equal(s.pendingAudit(10).length,1);assert.equal(s.auditCount(),1);
  s.markAuditSent('evt-1');assert.equal(s.pendingAudit(10).length,0);assert.equal(s.auditCount(),1);assert.equal(s.auditTrace('trace-1').length,1);
});
