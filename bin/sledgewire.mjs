#!/usr/bin/env node
import fs from 'node:fs';
import {smoke} from '../src/core/smoke.mjs';
import {assay} from '../src/core/assay.mjs';
import {invoke} from '../src/core/invoke.mjs';
import {seal} from '../src/core/seal.mjs';
import {fleet} from '../src/core/fleet.mjs';
import {gauntlet} from '../src/core/gauntlet.mjs';
import {quote} from '../src/core/quote.mjs';
import {selfcheck} from '../src/core/selfcheck.mjs';
import {verifyReceipt,generateSigningKeypair,signReceipt} from '../src/receipts/receipt.mjs';

const [cmd,...rest]=process.argv.slice(2),json=x=>console.log(JSON.stringify(x,null,2));
if(cmd==='selfcheck'){
  const payload=await selfcheck(),kp=generateSigningKeypair(),receipt=signReceipt(payload,kp.privateKeyPem),v=verifyReceipt(receipt,kp.publicKeyPem);
  json({selfcheck:v.ok&&payload.verified?'VERIFIED':'FAILED',receipt_verified:v.ok,...payload});if(!v.ok||!payload.verified)process.exit(1);
}else if(cmd==='quote')json(quote({intent:rest[0]??'preflight',endpoint:rest[1]??null,tool:rest[2]??null}));
else if(cmd==='smoke'){
  const url=rest[0],tool=rest.find(x=>!x.startsWith('--')&&x!==url),safe=rest.includes('--safe'),authorizeDestructive=rest.includes('--authorize-destructive');
  if(tool&&!safe){console.error('refusing active probe: add --safe after independently confirming the tool is safe to call');process.exit(2);}
  json(await smoke(url,{probe:tool?{name:tool,arguments:{},safe,authorizeDestructive}:undefined}));
}else if(cmd==='assay')json(await assay(rest[0],{}));
else if(cmd==='seal')json(await seal(rest[0],{}));
else if(cmd==='gauntlet')json(await gauntlet(rest[0],{}));
else if(cmd==='invoke'){const req=JSON.parse(fs.readFileSync(rest[1],'utf8'));json(await invoke(rest[0],req));}
else if(cmd==='fleet'){const targets=JSON.parse(fs.readFileSync(rest[0],'utf8'));json(await fleet(targets));}
else if(cmd==='verify'){const r=JSON.parse(fs.readFileSync(rest[0],'utf8')),pub=fs.readFileSync(rest[1],'utf8');json(verifyReceipt(r,pub));}
else{console.error('usage: sledgewire <selfcheck|quote INTENT [URL] [TOOL]|smoke URL [TOOL --safe [--authorize-destructive]]|assay URL|seal URL|gauntlet URL|invoke URL REQUEST.json|fleet TARGETS.json|verify RECEIPT PUBLIC_KEY>');process.exit(2);}
