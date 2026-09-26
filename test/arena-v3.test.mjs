import test from 'node:test';
import assert from 'node:assert/strict';
import {quote} from '../src/core/quote.mjs';
import {selfcheck} from '../src/core/selfcheck.mjs';
import {gauntlet} from '../src/core/gauntlet.mjs';
import {startFixture} from '../fixtures/server.mjs';
import {arenaCard,arenaMarkdown} from '../src/server/arena-card.mjs';

test('quote maps every intent to a priced service',()=>{const expected={preflight:['sledgewire.smoke',3],adversarial:['sledgewire.assay',8],repair_execute:['sledgewire.invoke',12],compare:['sledgewire.fleet',20],certify:['sledgewire.seal',25],full_dossier:['sledgewire.gauntlet',35]};for(const [intent,[service,price]] of Object.entries(expected)){const q=quote({intent,endpoint:'https://example.com/mcp'});assert.equal(q.recommended_service,service);assert.equal(q.price_credits,price);assert.equal(q.request_template.service,service);}});
test('quote rejects unknown intent',()=>assert.throws(()=>quote({intent:'magic'}),/unsupported_quote_intent/));
test('selfcheck covers modern and hostile fixture expectations',async()=>{const r=await selfcheck();assert.equal(r.verified,true);assert.equal(r.state,'READY');assert.equal(r.profile,'sledgewire.selfcheck.v4');assert.equal(r.cases.length,10);assert.ok(r.cases.some(x=>x.mode==='modern'&&x.ok));assert.ok(r.cases.every(x=>x.ok));});
test('gauntlet produces seller dossier on clean service',async()=>{const f=await startFixture();try{const r=await gauntlet(f.url,{targetPolicy:{allowHttp:true,allowPrivate:true},probe:{name:'safe_echo',arguments:{text:'hello'},safe:true}});assert.equal(r.state,'READY');assert.equal(r.profile,'sledgewire.gauntlet.v1');assert.ok(r.dossier_sha256);assert.equal(r.conformance.profile,'sledgewire.mcp-conformance.v3');}finally{await f.close();}});
test('arena card exposes one-link free demo, readiness and paid request template',()=>{const c=arenaCard('https://sledgewire.example');assert.equal(c.fastest_demo.tool,'sledgewire.selfcheck');assert.equal(c.free_selector.tool,'sledgewire.quote');assert.equal(c.readiness_url,'https://sledgewire.example/ready');assert.equal(c.paid_request_example.type,'sledgewire.service.request.v1');assert.equal(c.paid_request_example.service,'sledgewire.smoke');assert.equal(c.services['sledgewire.gauntlet'].price,35);});
test('arena markdown is single-link agent instruction surface',()=>{const m=arenaMarkdown('https://sledgewire.example');assert.match(m,/sledgewire\.selfcheck/);assert.match(m,/Gauntlet, 35/);assert.match(m,/https:\/\/sledgewire\.example\/mcp/);assert.match(m,/https:\/\/sledgewire\.example\/ready/);assert.match(m,/sledgewire\.service\.request\.v1/);});
