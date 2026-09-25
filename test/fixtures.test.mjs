import test from 'node:test';
import assert from 'node:assert/strict';
import {startFixture} from '../fixtures/server.mjs';
import {smoke} from '../src/core/smoke.mjs';
const tp={allowHttp:true,allowPrivate:true};

test('hostile tool output is treated as untrusted/degraded',async()=>{const f=await startFixture({mode:'injection'});try{const r=await smoke(f.url,{targetPolicy:tp,probe:{name:'safe_echo',arguments:{text:'x'}}});assert.equal(r.state,'DEGRADED');assert.equal(r.checks.safe_probe.untrusted_content,true);}finally{await f.close();}});
test('oversized response fails closed',async()=>{const f=await startFixture({mode:'oversized'});try{const r=await smoke(f.url,{targetPolicy:tp,probe:{name:'safe_echo',arguments:{text:'x'}},maxBytes:100_000});assert.equal(r.state,'INCOMPATIBLE');}finally{await f.close();}});
test('malformed json fails closed',async()=>{const f=await startFixture({mode:'malformed'});try{const r=await smoke(f.url,{targetPolicy:tp,probe:{name:'safe_echo',arguments:{text:'x'}}});assert.equal(r.state,'INCOMPATIBLE');}finally{await f.close();}});
