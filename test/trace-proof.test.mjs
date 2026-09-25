import test from 'node:test';
import assert from 'node:assert/strict';
import {ArenaStore} from '../src/store/arena-store.mjs';
import {traceProof} from '../src/sharedos/trace-proof.mjs';

const trace='123e4567-e89b-42d3-a456-426614174000';
test('trace proof is scoped, sanitized and hash-bound',async()=>{
  const s=new ArenaStore(':memory:');
  await s.record({version:'1',id:'evt-1',type:'authorization.checked',outcome:'allowed',at:new Date().toISOString(),traceId:trace,namespaceId:'sledgewire',
    actor:{kind:'agent',agentId:'sledgewire-breaker'},authority:{kind:'human',userId:'secret-host'},owner:{kind:'human',userId:'secret-host'},purpose:'sledgewire.test-repair-and-invoke-agent-services',
    resource:{namespace:'sledgewire',path:['targets','hash','tool','safe_echo'],owner:{kind:'human',userId:'secret-host'}},action:'invoke',grantId:'grant-1',consumed:true,
    metadata:{secret:'must-not-leak',arguments:{token:'secret'}}});
  const r=traceProof(s,trace);assert.equal(r.state,'READY');assert.equal(r.event_count,1);assert.match(r.events_sha256,/^[0-9a-f]{64}$/);
  assert.equal(r.events[0].metadata,undefined);assert.equal(r.events[0].authority,undefined);assert.equal(r.events[0].owner,undefined);assert.equal(r.events[0].resource.owner,undefined);
  assert.equal(JSON.stringify(r).includes('must-not-leak'),false);assert.equal(JSON.stringify(r).includes('secret-host'),false);
});
test('trace proof does not expose a global listing primitive',()=>{
  const s=new ArenaStore(':memory:');assert.equal(traceProof(s,'not-a-trace').reason,'invalid_trace_id');
});
test('unknown valid trace is explicit, not fabricated',()=>{
  const s=new ArenaStore(':memory:');const r=traceProof(s,trace);assert.equal(r.state,'UNKNOWN');assert.equal(r.reason,'trace_not_found');
});
