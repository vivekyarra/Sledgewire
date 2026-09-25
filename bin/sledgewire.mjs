#!/usr/bin/env node
import fs from 'node:fs';import {smoke} from '../src/core/smoke.mjs';import {assay} from '../src/core/assay.mjs';import {invoke} from '../src/core/invoke.mjs';import {seal} from '../src/core/seal.mjs';import {fleet} from '../src/core/fleet.mjs';import {verifyReceipt,generateSigningKeypair,signReceipt} from '../src/receipts/receipt.mjs';import {startFixture} from '../fixtures/server.mjs';
const [cmd,...rest]=process.argv.slice(2);const json=x=>console.log(JSON.stringify(x,null,2));
if(cmd==='selfcheck'){const modes=['clean','injection','description_injection','fake_success','malformed','oversized','replay_sensitive','destructive','accepts_unknown','accepts_extra','divergent_replay','sse','redirect','slow','huge_catalog'];const out=[];for(const mode of modes){const f=await startFixture({mode});try{const r=await smoke(f.url,{targetPolicy:{allowHttp:true,allowPrivate:true},maxBytes:100_000,timeoutMs:250,probe:{name:'safe_echo',arguments:{text:'hello'},safe:true}});out.push({mode,state:r.state,checks:r.checks});}finally{await f.close();}}const kp=generateSigningKeypair();const receipt=signReceipt({selfcheck:true,cases:out},kp.privateKeyPem);const v=verifyReceipt(receipt,kp.publicKeyPem);json({selfcheck:v.ok?'VERIFIED':'FAILED',receipt_verified:v.ok,cases:out});if(!v.ok)process.exit(1);}
else if(cmd==='smoke')json(await smoke(rest[0],{probe:rest[1]?{name:rest[1],arguments:{},safe:true}:undefined}));
else if(cmd==='assay')json(await assay(rest[0],{}));
else if(cmd==='seal')json(await seal(rest[0],{}));
else if(cmd==='invoke'){const req=JSON.parse(fs.readFileSync(rest[1],'utf8'));json(await invoke(rest[0],req));}
else if(cmd==='fleet'){const targets=JSON.parse(fs.readFileSync(rest[0],'utf8'));json(await fleet(targets));}
else if(cmd==='verify'){const r=JSON.parse(fs.readFileSync(rest[0],'utf8'));const pub=fs.readFileSync(rest[1],'utf8');json(verifyReceipt(r,pub));}
else{console.error('usage: sledgewire <selfcheck|smoke URL [TOOL]|assay URL|seal URL|invoke URL REQUEST.json|fleet TARGETS.json|verify RECEIPT PUBLIC_KEY>');process.exit(2);}
