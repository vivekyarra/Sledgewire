import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedHostSet,hostHeaderAllowed} from '../src/server/host-guard.mjs';

test('production host guard accepts exact public authority and explicit proxy authority',()=>{
  const s=allowedHostSet('https://Sledgewire.Example','internal-proxy:8787');
  assert.equal(hostHeaderAllowed('sledgewire.example',s),true);
  assert.equal(hostHeaderAllowed('internal-proxy:8787',s),true);
});
test('production host guard rejects missing, list-smuggled, whitespace and unlisted authorities',()=>{
  const s=allowedHostSet('https://sledgewire.example');
  for(const h of [undefined,'evil.example','sledgewire.example,evil.example',' sledgewire.example evil ','sledgewire.example\r\nx:x'])assert.equal(hostHeaderAllowed(h,s),false);
});
