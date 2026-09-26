import fs from 'node:fs';
import path from 'node:path';
import {SharedNetApi,INSTANCE_TOKEN,ROOM} from '../src/sharednet/api.mjs';
import {McpSession} from '../src/mcp/client.mjs';
import {runRestartReplayProof} from '../src/sharednet/live-rehearsal.mjs';

function readSecret(){
  const direct=process.env.SHAREDNET_BUYER_TOKEN?.trim();if(direct)return direct;
  const file=process.env.SHAREDNET_BUYER_TOKEN_FILE;if(!file)throw new Error('SHAREDNET_BUYER_TOKEN_FILE_required');
  return fs.readFileSync(file,'utf8').trim();
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
  const r=await fetch(`${base}/public-key`,{signal:AbortSignal.timeout(10_000),redirect:'error',headers:{accept:'text/plain'}});
  if(!r.ok)throw new Error(`public_key_http_${r.status}`);return readBounded(r,16_384);
}
async function fetchReadiness(base){
  const r=await fetch(`${base}/ready`,{signal:AbortSignal.timeout(10_000),redirect:'error',headers:{accept:'application/json'}});
  const text=await readBounded(r,64_000);let body;try{body=JSON.parse(text);}catch{throw new Error('readiness_invalid_json');}
  if(!r.ok||body?.ready!==true)throw new Error(`provider_not_ready:${body?.arena_daemon?.status??r.status}`);
  if(typeof body?.arena_daemon?.boot_id!=='string'||!body.arena_daemon.boot_id)throw new Error('provider_boot_id_missing');return body;
}
async function traceLookup(base,traceId){
  const s=new McpSession(`${base}/mcp`,{});await s.initialize();const out=await s.callTool('sledgewire.trace',{traceId});return out?.structuredContent??null;
}

const evidencePath=process.env.SLEDGEWIRE_REHEARSAL_EVIDENCE??'.sledgewire/live-rehearsal.json';
const previous=JSON.parse(fs.readFileSync(evidencePath,'utf8'));
const publicBaseUrl=String(process.env.PUBLIC_BASE_URL??previous.public_base_url??'').replace(/\/$/,'');
if(!publicBaseUrl.startsWith('https://')||publicBaseUrl!==previous.public_base_url)throw new Error('restart_proof_public_base_environment_mismatch');
const roomId=process.env.SHAREDNET_ARENA_ROOM_ID??previous.room_id??'';if(!ROOM.test(roomId)||roomId!==previous.room_id)throw new Error('restart_proof_room_environment_mismatch');
const token=readSecret();if(!INSTANCE_TOKEN.test(token))throw new Error('invalid_SHAREDNET_BUYER_TOKEN');
const readiness=await fetchReadiness(publicBaseUrl),currentBootId=readiness.arena_daemon.boot_id;
const publicKeyPem=await fetchPublicKey(publicBaseUrl),api=new SharedNetApi({token});
const proof=await runRestartReplayProof({api,roomId,publicBaseUrl,publicKeyPem,previousEvidence:previous,currentBootId,lookupTrace:id=>traceLookup(publicBaseUrl,id)});
const outPath=process.env.SLEDGEWIRE_RESTART_REPLAY_EVIDENCE??'.sledgewire/restart-replay.json';
fs.mkdirSync(path.dirname(path.resolve(outPath)),{recursive:true});fs.writeFileSync(outPath,JSON.stringify(proof,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({...proof,evidence_file:path.resolve(outPath)},null,2));
