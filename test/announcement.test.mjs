import test from 'node:test';
import assert from 'node:assert/strict';
import {ArenaStore} from '../src/store/arena-store.mjs';
import {announceArenaOnce,arenaAnnouncement} from '../src/sharednet/announcement.mjs';

const room='rom_ABCDEFGHIJ';
test('Arena availability announcement is concise and points to free proof first',()=>{
  const x=arenaAnnouncement('https://sledgewire.example/');
  assert.equal(x.type,'sledgewire.available.v1');assert.equal(x.free.selfcheck.tool,'sledgewire.selfcheck');assert.equal(x.paid_credits.smoke,3);assert.equal(x.quickstart,'https://sledgewire.example/arena.md');
  assert.ok(Buffer.byteLength(JSON.stringify(x))<2000);
});
test('Arena availability announcement is durable one-shot across daemon restarts',async()=>{
  const store=new ArenaStore(':memory:');let posts=0;
  const api={async post(_room,content,{idempotencyKey}){posts++;assert.ok(idempotencyKey);assert.equal(JSON.parse(content).type,'sledgewire.available.v1');return {message:{id:'msg_ABCDEFGHIJ'}};}};
  const a=await announceArenaOnce({api,store,room,publicBaseUrl:'https://sledgewire.example'}),b=await announceArenaOnce({api,store,room,publicBaseUrl:'https://sledgewire.example'});
  assert.equal(a.status,'sent');assert.equal(b.status,'already_sent');assert.equal(posts,1);assert.equal(a.record.message_id,'msg_ABCDEFGHIJ');
});
test('Arena announcement can be explicitly disabled',async()=>{
  const store=new ArenaStore(':memory:');const r=await announceArenaOnce({api:{async post(){throw new Error('should_not_post');}},store,room,publicBaseUrl:'https://sledgewire.example',enabled:false});assert.equal(r.status,'disabled');
});


test('Arena announcement rejects non-origin and credentialed public URLs',()=>{
  for(const bad of ['http://sledgewire.example','https://user:pass@sledgewire.example','https://sledgewire.example/path','https://sledgewire.example/?q=1']){
    assert.throws(()=>arenaAnnouncement(bad));
  }
});
