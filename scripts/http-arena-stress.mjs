import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {ArenaStore} from '../src/store/arena-store.mjs';
import {writeArenaDaemonHeartbeat} from '../src/ops/readiness.mjs';
import {generateSigningKeypair,verifyReceipt} from '../src/receipts/receipt.mjs';

const selfcheckN=Math.max(1,Math.min(64,Number(process.argv[2]??64)));
const paidRouteN=Math.max(1,Math.min(64,Number(process.argv[3]??32)));
const room='rom_ABCDEFGHIJ',host='sledgewire.example';
function freePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(e=>e?reject(e):resolve(p));});});}
function req(port,{path='/',method='GET',headers={},body=null}={}){
  return new Promise((resolve,reject)=>{
    const r=http.request({host:'127.0.0.1',port,path,method,headers:{Host:host,...headers}},res=>{
      const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text:Buffer.concat(chunks).toString('utf8')}));
    });r.once('error',reject);if(body!==null)r.write(body);r.end();
  });
}
async function waitReady(port,child){
  for(let i=0;i<80;i++){
    if(child.exitCode!==null)throw new Error(`http_child_exited:${child.exitCode}`);
    try{const r=await req(port,{path:'/health'});if(r.status===200)return;}catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  throw new Error('http_server_start_timeout');
}
function modernCall(name,args,id){
  const body=JSON.stringify({jsonrpc:'2.0',id,method:'tools/call',params:{name,arguments:args,_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28','io.modelcontextprotocol/clientCapabilities':{}}}});
  return {body,headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),'Mcp-Protocol-Version':'2026-07-28','Mcp-Method':'tools/call','Mcp-Name':name}};
}

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sledgewire-http-stress-')),db=path.join(dir,'arena.db'),kp=generateSigningKeypair(),port=await freePort();
const seed=new ArenaStore(db);writeArenaDaemonHeartbeat(seed,room,{instanceId:'i_ABCDEFGHIJ',bootId:'123e4567-e89b-42d3-a456-426614174000'});seed.db.close();
let stderr='';
const child=spawn(process.execPath,['src/server/http.mjs'],{cwd:process.cwd(),stdio:['ignore','ignore','pipe'],env:{...process.env,NODE_ENV:'production',PORT:String(port),PUBLIC_BASE_URL:'https://sledgewire.example',SLEDGEWIRE_DB:db,SLEDGEWIRE_PRIVATE_KEY_PEM:kp.privateKeyPem,SLEDGEWIRE_PUBLIC_KEY_PEM:kp.publicKeyPem,SHAREDNET_ARENA_ROOM_ID:room,SLEDGEWIRE_HTTP_CONCURRENCY:'64',SLEDGEWIRE_HTTP_MAX_CONNECTIONS:'256'}});
child.stderr.on('data',c=>{stderr=(stderr+c.toString()).slice(-20000);});
const started=Date.now();
try{
  await waitReady(port,child);
  const health=JSON.parse((await req(port,{path:'/health'})).text);if(health.ok!==true||health.version!=='0.3.13')throw new Error('health_contract_failed');
  const ready=await req(port,{path:'/ready'}),readyJson=JSON.parse(ready.text);if(ready.status!==200||readyJson.ready!==true)throw new Error('ready_contract_failed');
  const md=await req(port,{path:'/arena.md'});if(md.status!==200||!/30-second judge path/.test(md.text)||!/Fast buyer path/.test(md.text))throw new Error('arena_markdown_failed');
  const card=JSON.parse((await req(port,{path:'/arena.json'})).text);if(card.version!=='0.3.13'||card.payment?.native_sharednet_memo!=='Sledgewire')throw new Error('arena_card_failed');

  const sc=modernCall('sledgewire.selfcheck',{},1),t1=Date.now();
  const selfchecks=await Promise.all(Array.from({length:selfcheckN},(_,i)=>{const call=modernCall('sledgewire.selfcheck',{},i+1);return req(port,{path:'/mcp',method:'POST',headers:call.headers,body:call.body});}));
  const selfcheckMs=Date.now()-t1;
  for(const r of selfchecks){if(r.status!==200)throw new Error(`selfcheck_http_${r.status}`);const j=JSON.parse(r.text),receipt=j.result?.structuredContent;if(receipt?.verified!==true||verifyReceipt(receipt,kp.publicKeyPem).ok!==true)throw new Error('selfcheck_receipt_invalid');}

  const paid=modernCall('sledgewire.smoke',{endpoint:'https://target.example/mcp'},1000),t2=Date.now();
  const routes=await Promise.all(Array.from({length:paidRouteN},(_,i)=>{const call=modernCall('sledgewire.smoke',{endpoint:'https://target.example/mcp'},1000+i);return req(port,{path:'/mcp',method:'POST',headers:call.headers,body:call.body});}));
  const routeMs=Date.now()-t2;
  for(const r of routes){if(r.status!==200)throw new Error(`paid_route_http_${r.status}`);const x=JSON.parse(r.text).result?.structuredContent;if(x?.state!=='PAYMENT_REQUIRED'||x?.price_credits!==3||x?.arena_room_id!==room||verifyReceipt(x,kp.publicKeyPem).ok!==true)throw new Error('paid_route_invalid');}

  const badHost=await req(port,{path:'/mcp',method:'POST',headers:{...sc.headers,Host:'evil.example'},body:sc.body});if(badHost.status!==403)throw new Error('host_guard_failed');
  const badOrigin=await req(port,{path:'/mcp',method:'POST',headers:{...sc.headers,Origin:'https://evil.example'},body:sc.body});if(badOrigin.status!==403)throw new Error('origin_guard_failed');
  const malformed=await req(port,{path:'/mcp',method:'POST',headers:{'Content-Type':'application/json','Content-Length':'1'},body:'{'});if(malformed.status!==400)throw new Error(`malformed_json_expected_400_got_${malformed.status}`);
  const oversized=await req(port,{path:'/mcp',method:'POST',headers:{'Content-Type':'application/json','Content-Length':'1000001'}});if(oversized.status!==413)throw new Error(`oversized_expected_413_got_${oversized.status}`);

  const finalHealth=await req(port,{path:'/health'});if(finalHealth.status!==200)throw new Error('server_not_healthy_after_stress');
  console.log(JSON.stringify({type:'sledgewire.http.arena-stress.v1',version:'0.3.13',selfchecks:selfcheckN,selfcheck_ms:selfcheckMs,paid_routes:paidRouteN,paid_route_ms:routeMs,host_guard:true,origin_guard:true,oversized_early_reject:true,healthy_after_stress:true,total_ms:Date.now()-started},null,2));
}finally{
  child.kill('SIGTERM');await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);setTimeout(()=>{child.kill('SIGKILL');resolve();},3000).unref();});
  fs.rmSync(dir,{recursive:true,force:true});
  if(child.exitCode&&child.exitCode!==0)console.error(stderr);
}
