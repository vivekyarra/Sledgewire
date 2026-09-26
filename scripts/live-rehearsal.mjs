import fs from 'node:fs';
import path from 'node:path';
import {SharedNetApi,INSTANCE_TOKEN,ROOM,ADDRESS} from '../src/sharednet/api.mjs';
import {McpSession} from '../src/mcp/client.mjs';
import {runLiveSmokeRehearsal} from '../src/sharednet/live-rehearsal.mjs';

function readSecret(){
  const direct=process.env.SHAREDNET_BUYER_TOKEN?.trim();if(direct)return direct;
  const file=process.env.SHAREDNET_BUYER_TOKEN_FILE;if(!file)throw new Error('SHAREDNET_BUYER_TOKEN_FILE_required');
  const token=fs.readFileSync(file,'utf8').trim();return token;
}
async function readBounded(response,maxBytes){
  const declared=Number(response.headers.get('content-length'));if(Number.isFinite(declared)&&declared>maxBytes)throw new Error('public_probe_response_too_large');
  if(!response.body)return '';
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;if(value){size+=value.byteLength;if(size>maxBytes){await reader.cancel().catch(()=>{});throw new Error('public_probe_response_too_large');}chunks.push(Buffer.from(value));}}}
  finally{reader.releaseLock?.();}
  return Buffer.concat(chunks).toString('utf8');
}
async function fetchPublicKey(base){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new Error('public_key_timeout')),10_000);
  try{
    const r=await fetch(`${base.replace(/\/$/,'')}/public-key`,{signal:controller.signal,redirect:'error',headers:{accept:'text/plain'}});
    if(!r.ok)throw new Error(`public_key_http_${r.status}`);return await readBounded(r,16_384);
  }finally{clearTimeout(timer);}
}
async function fetchReadiness(base){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new Error('readiness_timeout')),10_000);
  try{
    const r=await fetch(`${base.replace(/\/$/,'')}/ready`,{signal:controller.signal,redirect:'error',headers:{accept:'application/json'}});
    const text=await readBounded(r,64_000);let body;try{body=JSON.parse(text);}catch{throw new Error('readiness_invalid_json');}
    if(!r.ok||body?.ready!==true)throw new Error(`provider_not_ready:${body?.arena_daemon?.status??r.status}`);
    if(typeof body?.arena_daemon?.boot_id!=='string'||!body.arena_daemon.boot_id)throw new Error('provider_boot_id_missing');
    return body;
  }finally{clearTimeout(timer);}
}
async function traceLookup(base,traceId){
  const s=new McpSession(`${base.replace(/\/$/,'')}/mcp`,{});
  await s.initialize();const out=await s.callTool('sledgewire.trace',{traceId});
  return out?.structuredContent??null;
}

const token=readSecret();if(!INSTANCE_TOKEN.test(token))throw new Error('invalid_SHAREDNET_BUYER_TOKEN');
const roomId=process.env.SHAREDNET_ARENA_ROOM_ID??'',payee=process.env.SHAREDNET_PAYEE_ADDRESS??'',publicBaseUrl=(process.env.PUBLIC_BASE_URL??'').replace(/\/$/,'');
if(!ROOM.test(roomId)||!ADDRESS.test(payee)||!publicBaseUrl.startsWith('https://'))throw new Error('live_rehearsal_environment_incomplete');
const targetEndpoint=process.env.SLEDGEWIRE_REHEARSAL_TARGET??`${publicBaseUrl}/mcp`;
const ready=await fetchReadiness(publicBaseUrl),providerBootId=ready.arena_daemon.boot_id;
const publicKeyPem=await fetchPublicKey(publicBaseUrl);
const api=new SharedNetApi({token});
const evidence=await runLiveSmokeRehearsal({api,roomId,payee,publicBaseUrl,targetEndpoint,publicKeyPem,providerBootId,lookupTrace:id=>traceLookup(publicBaseUrl,id)});
const outPath=process.env.SLEDGEWIRE_REHEARSAL_EVIDENCE??'.sledgewire/live-rehearsal.json';
fs.mkdirSync(path.dirname(path.resolve(outPath)),{recursive:true});fs.writeFileSync(outPath,JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({verified:evidence.verified,service:evidence.service,price_credits:evidence.price_credits,request_id:evidence.request_id,room_id:evidence.room_id,buyer_seat:evidence.buyer_seat,payment_txn_id:evidence.payment_txn_id,trace_id:evidence.trace_id,provider_boot_id:evidence.provider_boot_id,checks:evidence.checks,evidence_file:path.resolve(outPath)},null,2));
