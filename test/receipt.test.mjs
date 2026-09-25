import test from 'node:test';import assert from 'node:assert/strict';import {generateSigningKeypair,keyId,signReceipt,verifyReceipt,stable,loadSigningMaterial} from '../src/receipts/receipt.mjs';
test('receipt verifies',()=>{const k=generateSigningKeypair(),r=signReceipt({x:1},k.privateKeyPem);assert.equal(verifyReceipt(r,k.publicKeyPem).ok,true);});
test('tamper fails',()=>{const k=generateSigningKeypair(),r=signReceipt({x:1},k.privateKeyPem);r.x=2;assert.equal(verifyReceipt(r,k.publicKeyPem).ok,false);});
test('wrong key fails',()=>{const a=generateSigningKeypair(),b=generateSigningKeypair(),r=signReceipt({x:1},a.privateKeyPem);assert.equal(verifyReceipt(r,b.publicKeyPem).ok,false);});
test('malformed public key fails closed without throwing',()=>{const k=generateSigningKeypair(),r=signReceipt({x:1},k.privateKeyPem),v=verifyReceipt(r,'definitely-not-a-key');assert.equal(v.ok,false);assert.equal(v.reason,'invalid_public_key');});
test('malformed signature encoding fails closed',()=>{const k=generateSigningKeypair(),r=signReceipt({x:1},k.privateKeyPem);r.proof.signature='AA';const v=verifyReceipt(r,k.publicKeyPem);assert.equal(v.ok,false);assert.equal(v.reason,'invalid_signature_encoding');});
test('key ids are stable',()=>{const k=generateSigningKeypair();assert.equal(keyId(k.publicKeyPem),keyId(k.publicKeyPem));});
test('canonical object key order stable',()=>assert.equal(stable({b:1,a:2}),stable({a:2,b:1})));
test('non finite receipt value rejected',()=>assert.throws(()=>stable({x:Infinity}),/non_finite/));
test('production without key fails closed',()=>{const old={...process.env};delete process.env.SLEDGEWIRE_PRIVATE_KEY_FILE;delete process.env.SLEDGEWIRE_PRIVATE_KEY_PEM;try{assert.throws(()=>loadSigningMaterial({production:true}),/production_signing_key_required/);}finally{process.env=old;}});

test('canonicalizer rejects malicious depth before stack exhaustion',()=>{
  let x={leaf:true};for(let i=0;i<200;i++)x={x};
  assert.throws(()=>stable(x),/canonical_depth_limit/);
});
test('canonicalizer rejects cycles deterministically',()=>{
  const x={};x.self=x;assert.throws(()=>stable(x),/canonical_cycle/);
});
