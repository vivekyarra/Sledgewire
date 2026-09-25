import test from 'node:test';import assert from 'node:assert/strict';import {handleRpc,toolDefs} from '../src/server/protocol.mjs';
test('MCP initialize advertises current version',async()=>{const r=await handleRpc({jsonrpc:'2.0',id:1,method:'initialize',params:{}});assert.equal(r.result.serverInfo.version,'0.2.0');});
test('MCP tool list has six tools',async()=>{const r=await handleRpc({jsonrpc:'2.0',id:1,method:'tools/list',params:{}});assert.equal(r.result.tools.length,6);assert.equal(toolDefs.length,6);});
test('unknown method is -32601',async()=>{const r=await handleRpc({jsonrpc:'2.0',id:1,method:'nope'});assert.equal(r.error.code,-32601);});
test('initialized notification returns no response',async()=>assert.equal(await handleRpc({jsonrpc:'2.0',method:'notifications/initialized',params:{}}),null));
