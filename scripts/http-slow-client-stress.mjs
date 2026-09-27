import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {ArenaStore} from '../src/store/arena-store.mjs';
import {writeArenaDaemonHeartbeat} from '../src/ops/readiness.mjs';
import {generateSigningKeypair,verifyReceipt} from '../src/receipts/receipt.mjs';

const room='rom_ABCDEFGHIJ',host='sledgewire.example';
const partialHeaders=64,partialBodies=64,legitN=32;

function freePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(e=>e?reject(e):resolve(p));});});}
function request(port,{path='/',method='GET',headers={},body=null}={}){
  return new Promise((resolve,reject)=>{
    const r=http.request({host:'127.0.0.1',port,path,method,headers:{Host:host,...headers}},res=>{
      const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,text:Buffer.concat(chunks).toString('utf8')}));
    });
    r.once('error',reject);if(body!==null)r.write(body);r.end();
  });
}
async function waitHealth(port,child){
  for(let i=0;i<80;i++){
    if(child.exitCode!==null)throw new Error('slow_http_child_exited');
    try{const r=await request(port,{path:'/health'});if(r.status===200)return;}catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  throw new Error('slow_http_start_timeout');
}
function openSlow(port,kind){
  let resolveClosed;const closed=new Promise(r=>resolveClosed=r);
  return new Promise((resolve,reject)=>{
    const socket=net.createConnection({host:'127.0.0.1',port});
    let done=false;const finish=()=>{if(done)return;done=true;resolveClosed();};
    socket.once('error',e=>{finish();if(!socket.connecting)resolve({socket,closed});else reject(e);});
    socket.once('close',finish);
    socket.once('connect',()=>{
      if(kind==='headers')socket.write('POST /mcp HTTP/1.1\r\nHost: sledgewire.example\r\nContent-Type: application/json\r\n');
      else socket.write('POST /mcp HTTP/1.1\r\nHost: sledgewire.example\r\nContent-Type: application/json\r\nContent-Length: 1000\r\n\r\n{');
      resolve({socket,closed});
    });
  });
}
function selfcheckBody(id){return JSON.stringify({jsonrpc:'2.0',id,method:'tools/call',params:{name:'sledgewire.selfcheck',arguments:{},_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28','io.modelcontextprotocol/clientCapabilities':{}}}});}

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sledgewire-slow-http-')),db=path.join(dir,'arena.db'),kp=generateSigningKeypair(),port=await freePort();
const seed=new ArenaStore(db);writeArenaDaemonHeartbeat(seed,room,{instanceId:'i_ABCDEFGHIJ',bootId:'123e4567-e89b-42d3-a456-426614174000'});seed.db.close();
let stderr='';
const child=spawn(process.execPath,['src/server/http.mjs'],{
  cwd:process.cwd(),stdio:['ignore','ignore','pipe'],
  env:{...process.env,NODE_ENV:'production',PORT:String(port),PUBLIC_BASE_URL:'https://sledgewire.example',SLEDGEWIRE_DB:db,SLEDGEWIRE_PRIVATE_KEY_PEM:kp.privateKeyPem,SLEDGEWIRE_PUBLIC_KEY_PEM:kp.publicKeyPem,SHAREDNET_ARENA_ROOM_ID:room,SLEDGEWIRE_HTTP_CONCURRENCY:'64',SLEDGEWIRE_HTTP_MAX_CONNECTIONS:'256',SLEDGEWIRE_HTTP_REQUEST_TIMEOUT_MS:'2000',SLEDGEWIRE_HTTP_HEADERS_TIMEOUT_MS:'1000',SLEDGEWIRE_HTTP_SOCKET_IDLE_MS:'750'}
});
child.stderr.on('data',c=>{stderr=(stderr+c.toString()).slice(-20000);});
const started=Date.now(),slow=[];
try{
  await waitHealth(port,child);
  for(let i=0;i<partialHeaders;i++)slow.push(await openSlow(port,'headers'));
  for(let i=0;i<partialBodies;i++)slow.push(await openSlow(port,'body'));
  await new Promise(r=>setTimeout(r,50));
  const underAttack=JSON.parse((await request(port,{path:'/health'})).text);
  if(Number(underAttack.body_readers)<partialBodies||Number(underAttack.active_requests)!==0)throw new Error(`slow_body_isolation_failed:readers=${underAttack.body_readers}:active=${underAttack.active_requests}`);

  const t=Date.now();
  const legit=await Promise.all(Array.from({length:legitN},async(_,i)=>{
    const body=selfcheckBody(i+1),r=await request(port,{path:'/mcp',method:'POST',headers:{'Content-Type':'application/json','Mcp-Protocol-Version':'2026-07-28','Mcp-Method':'tools/call','Mcp-Name':'sledgewire.selfcheck'},body});
    if(r.status!==200)throw new Error(`legit_selfcheck_http_${r.status}`);
    const x=JSON.parse(r.text).result?.structuredContent;if(x?.verified!==true||verifyReceipt(x,kp.publicKeyPem).ok!==true)throw new Error('legit_selfcheck_invalid');
    return true;
  }));
  const legitMs=Date.now()-t;
  if(legit.length!==legitN)throw new Error('legit_selfcheck_count');

  await Promise.race([
    Promise.all(slow.map(x=>x.closed)),
    new Promise((_,reject)=>setTimeout(()=>reject(new Error('slow_connections_not_reclaimed')),4000))
  ]);
  const final=await request(port,{path:'/health'});if(final.status!==200)throw new Error('health_failed_after_slow_client_attack');
  console.log(JSON.stringify({type:'sledgewire.http.slow-client-stress.v1',partial_header_sockets:partialHeaders,partial_body_sockets:partialBodies,legitimate_selfchecks:legitN,legitimate_selfcheck_ms:legitMs,stalled_sockets_reclaimed:slow.length,body_readers_observed_under_attack:Number(underAttack.body_readers),rpc_slots_occupied_by_stalled_bodies:Number(underAttack.active_requests),healthy_after_attack:true,total_ms:Date.now()-started},null,2));
}finally{
  for(const x of slow)try{x.socket.destroy();}catch{}
  child.kill('SIGTERM');await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);setTimeout(()=>{child.kill('SIGKILL');resolve();},3000).unref();});
  fs.rmSync(dir,{recursive:true,force:true});
  if(child.exitCode&&child.exitCode!==0)console.error(stderr);
}
