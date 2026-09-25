import test from 'node:test';
import assert from 'node:assert/strict';
import {exactPriceMap} from '../src/core/catalog-policy.mjs';

test('price-map comparison is order independent',()=>{
  assert.equal(exactPriceMap({b:2,a:1},{a:1,b:2}),true);
});
test('price-map comparison rejects missing, extra and wrong values',()=>{
  assert.equal(exactPriceMap({a:1},{a:1,b:2}),false);
  assert.equal(exactPriceMap({a:1,b:2,c:3},{a:1,b:2}),false);
  assert.equal(exactPriceMap({a:1,b:3},{a:1,b:2}),false);
});
