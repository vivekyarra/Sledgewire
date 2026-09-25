import test from 'node:test';
import assert from 'node:assert/strict';
import {idempotencyUuid} from '../src/sharednet/api.mjs';
import {ArenaStore} from '../src/store/arena-store.mjs';

test('reply idempotency UUID is deterministic and v4-shaped',()=>{
  const a=idempotencyUuid('msg_ABCDEFGHIJ'),b=idempotencyUuid('msg_ABCDEFGHIJ'),c=idempotencyUuid('msg_ZYXWVUTSRQ');
  assert.equal(a,b);assert.notEqual(a,c);assert.match(a,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
test('room message claim is single-owner while inflight',()=>{const s=new ArenaStore(':memory:');assert.equal(s.claimRoomMessage('msg_1'),true);assert.equal(s.claimRoomMessage('msg_1'),false);s.markRoomMessage('msg_1','completed');assert.equal(s.roomMessageSeen('msg_1'),true);assert.equal(s.claimRoomMessage('msg_1'),false);});
test('failed room message can be reclaimed',()=>{const s=new ArenaStore(':memory:');assert.equal(s.claimRoomMessage('msg_2'),true);s.markRoomMessage('msg_2','failed','network');assert.equal(s.claimRoomMessage('msg_2'),true);});
