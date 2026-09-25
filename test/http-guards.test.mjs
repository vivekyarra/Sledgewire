import test from 'node:test';
import assert from 'node:assert/strict';
import {isJsonContentType} from '../src/server/http-guards.mjs';

test('HTTP JSON guard accepts the exact JSON media type with parameters',()=>{
  assert.equal(isJsonContentType('application/json'),true);
  assert.equal(isJsonContentType('Application/JSON; charset=utf-8'),true);
});
test('HTTP JSON guard rejects media-type substring smuggling',()=>{
  assert.equal(isJsonContentType('text/plain; a=application/json'),false);
  assert.equal(isJsonContentType('application/json-patch+json'),false);
  assert.equal(isJsonContentType(undefined),false);
});
