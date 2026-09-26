import test from 'node:test';
import assert from 'node:assert/strict';
import {ArenaStore} from '../src/store/arena-store.mjs';
import {readArenaDaemonReadiness,writeArenaDaemonHeartbeat} from '../src/ops/readiness.mjs';

const room='rom_ABCDEFGHIJ';
test('readiness does not require a daemon when no Arena Room is configured',()=>{
  const s=new ArenaStore(':memory:');assert.deepEqual(readArenaDaemonReadiness(s,null),{required:false,ready:true,status:'not_required',age_ms:null,boot_id:null});
});
test('configured Arena Room fails readiness when daemon heartbeat is missing',()=>{
  const s=new ArenaStore(':memory:');const r=readArenaDaemonReadiness(s,room);assert.equal(r.required,true);assert.equal(r.ready,false);assert.equal(r.status,'missing');
});
test('fresh running daemon heartbeat is ready and stale heartbeat fails closed',()=>{
  const s=new ArenaStore(':memory:'),now=Date.now();writeArenaDaemonHeartbeat(s,room,{instanceId:'i_ABCDEFGHIJ',bootId:'123e4567-e89b-42d3-a456-426614174000',at:new Date(now-5000).toISOString()});
  let r=readArenaDaemonReadiness(s,room,{now,maxAgeMs:45_000});assert.equal(r.ready,true);assert.equal(r.status,'running');assert.equal(r.age_ms,5000);assert.equal(r.boot_id,'123e4567-e89b-42d3-a456-426614174000');
  r=readArenaDaemonReadiness(s,room,{now:now+60_000,maxAgeMs:45_000});assert.equal(r.ready,false);assert.equal(r.status,'stale');
});
test('stopped or malformed daemon heartbeat is not ready',()=>{
  const s=new ArenaStore(':memory:'),now=Date.now();writeArenaDaemonHeartbeat(s,room,{status:'stopped',at:new Date(now).toISOString()});
  assert.equal(readArenaDaemonReadiness(s,room,{now}).status,'stopped');
  s.setMeta('arena_daemon_heartbeat:'+room,'{bad');assert.equal(readArenaDaemonReadiness(s,room,{now}).status,'malformed');
});
