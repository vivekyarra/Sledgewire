import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeMcpHeaderValue,decodeMcpHeaderValue,scanXMcpHeaderDeclarations,buildMcpParamHeaders} from '../src/mcp/header-codec.mjs';

test('MCP header codec preserves safe ASCII and sentinel-encodes unsafe values',()=>{
  assert.equal(encodeMcpHeaderValue('safe-name'),'safe-name');
  for(const value of [' 東京 ','工具','=?base64?YWJj?=']){
    const encoded=encodeMcpHeaderValue(value);assert.match(encoded,/^=\?base64\?/);assert.equal(decodeMcpHeaderValue(encoded),value);
  }
});
test('x-mcp-header scan and argument mirroring support nested reachable primitives',()=>{
  const schema={type:'object',properties:{route:{type:'object',properties:{region:{type:'string','x-mcp-header':'Region'}}}}};
  const scan=scanXMcpHeaderDeclarations(schema);assert.equal(scan.valid,true);
  const h=buildMcpParamHeaders(scan.declarations,{route:{region:'東京'}});
  assert.equal(decodeMcpHeaderValue(h['mcp-param-Region']),'東京');
});
test('x-mcp-header duplicate names are rejected case-insensitively',()=>{
  const s={type:'object',properties:{a:{type:'string','x-mcp-header':'Region'},b:{type:'string','x-mcp-header':'region'}}};
  assert.equal(scanXMcpHeaderDeclarations(s).valid,false);
});
test('x-mcp-header outside properties-only reachability is rejected',()=>{
  const s={type:'object',properties:{items:{type:'array',items:{type:'string','x-mcp-header':'Item'}}}};
  assert.equal(scanXMcpHeaderDeclarations(s).valid,false);
});
test('malformed base64 sentinel fails closed',()=>assert.equal(decodeMcpHeaderValue('=?base64?%%%?='),undefined));

test('x-mcp-header scan rejects pathological schema depth before stack exhaustion',()=>{
  let s={type:'string','x-mcp-header':'Leaf'};
  for(let i=0;i<80;i++)s={type:'object',properties:{x:s}};
  const r=scanXMcpHeaderDeclarations(s);assert.equal(r.valid,false);assert.equal(r.reason,'schema_depth_limit');
});
test('x-mcp-header scan rejects pathological schema node count',()=>{
  const properties={};
  for(let i=0;i<10_001;i++)properties['p'+i]={type:'string'};
  const r=scanXMcpHeaderDeclarations({type:'object',properties});
  assert.equal(r.valid,false);assert.equal(r.reason,'schema_node_limit');
});
