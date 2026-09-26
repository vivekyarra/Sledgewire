import test from 'node:test';
import assert from 'node:assert/strict';
import {boundedInteger,publicBaseOrigin} from '../src/ops/config.mjs';

test('boundedInteger uses explicit defaults and rejects NaN/fractions/out-of-range values',()=>{
  assert.equal(boundedInteger(undefined,{name:'workers',defaultValue:64,min:4,max:256}),64);
  assert.equal(boundedInteger('128',{name:'workers',defaultValue:64,min:4,max:256}),128);
  for(const bad of ['nope','4.5','3','257',Infinity])assert.throws(()=>boundedInteger(bad,{name:'workers',defaultValue:64,min:4,max:256}),/invalid_workers/);
});

test('public production base must be a credential-free HTTPS origin',()=>{
  assert.equal(publicBaseOrigin('https://Sledgewire.Example/',{production:true}),'https://sledgewire.example');
  for(const bad of ['http://sledgewire.example','https://user:pass@sledgewire.example','https://sledgewire.example/mcp','https://sledgewire.example/?x=1','https://sledgewire.example/#x'])assert.throws(()=>publicBaseOrigin(bad,{production:true}));
});

test('development base remains HTTP-only to prevent accidental public-mode drift',()=>{
  assert.equal(publicBaseOrigin('http://127.0.0.1:8787',{production:false}),'http://127.0.0.1:8787');
  assert.throws(()=>publicBaseOrigin('https://sledgewire.example',{production:false}),/public_https_requires_node_env_production/);
});
