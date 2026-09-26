import fs from 'node:fs';
import path from 'node:path';
import catalog from '../catalog.json' with {type:'json'};
import {loadSigningMaterial,keyId,verifyReceipt} from '../src/receipts/receipt.mjs';
import {exactPriceMap} from '../src/core/catalog-policy.mjs';
import {SharedNetApi,ROOM,ADDRESS,INSTANCE_TOKEN,payeeBelongsToIdentity,loadSharedNetToken} from '../src/sharednet/api.mjs';
import {McpSession,MODERN_PROTOCOL_VERSION} from '../src/mcp/client.mjs';
import {validateLiveRehearsalEvidence,validateRestartReplayEvidence} from '../src/ops/live-evidence.mjs';
import {publicBaseOrigin} from '../src/ops/config.mjs';
import {auditSinkUrl} from '../src/ops/audit-sink.mjs';

const live=process.argv.includes('--live'),submission=process.argv.includes('--submission'),checks=[];
const add=(name,ok,detail='')=>checks.push({name,ok,detail});
let localSigningKeyId=null;
const [major,minor]=process.versions.node.split('.').map(Number);
add('node>=22.18',major>22||(major===22&&minor>=18),process.versions.node);

const expected={'sledgewire.quote':0,'sledgewire.selfcheck':0,'sledgewire.smoke':3,'sledgewire.assay':8,'sledgewire.invoke':12,'sledgewire.fleet':20,'sledgewire.seal':25,'sledgewire.gauntlet':35,'sledgewire.trace':0,'sledgewire.verify':0};
const actual=Object.fromEntries(Object.entries(catalog.services).map(([k,v])=>[k,v.price]));
add('catalog_prices',exactPriceMap(actual,expected),JSON.stringify(actual));

try{const s=loadSigningMaterial({production:live||process.env.NODE_ENV==='production'});localSigningKeyId=s.keyId;add('signing_key',!live||!s.ephemeral,s.keyId);}
catch(e){add('signing_key',false,String(e.message||e));}

const db=process.env.SLEDGEWIRE_DB||'.sledgewire/arena.db';
try{const dir=path.dirname(path.resolve(db));fs.mkdirSync(dir,{recursive:true});fs.accessSync(dir,fs.constants.W_OK);add('durable_store_path',true,dir);}
catch(e){add('durable_store_path',false,String(e));}

const publicBase=process.env.PUBLIC_BASE_URL??'',productUrl=process.env.SLEDGEWIRE_PRODUCT_URL??(publicBase?`${publicBase.replace(/\/$/,'')}/arena.md`:''),paidBypass=process.env.SLEDGEWIRE_PUBLIC_PAID_EXECUTION==='1';
function isHttpsUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&Boolean(u.hostname)&&!u.username&&!u.password;}catch{return false;}}
function canonicalHttpsOrigin(value){try{return publicBaseOrigin(value,{production:true});}catch{return null;}}
function isHttpsOrigin(value){return canonicalHttpsOrigin(value)!==null;}
if(submission){
  add('public_product_link',isHttpsUrl(productUrl),productUrl||'missing');
}
if(live||submission){
  add('public_paid_bypass_disabled',!paidBypass,paidBypass?'SLEDGEWIRE_PUBLIC_PAID_EXECUTION=1 is forbidden':'disabled');
}
if(live)add('public_mcp_base',isHttpsOrigin(publicBase),publicBase||'missing');
if(live)add('node_env_production',process.env.NODE_ENV==='production',process.env.NODE_ENV??'missing');

const buildRoom=process.env.SHAREDNET_BUILD_ROOM_ID??'';
if(submission){
  add('development_sharednet_room',ROOM.test(buildRoom),buildRoom||'missing');
  add('participant_name',Boolean(process.env.SLEDGEWIRE_PARTICIPANT_NAME?.trim()),process.env.SLEDGEWIRE_PARTICIPANT_NAME??'missing');
  add('participant_contact',Boolean(process.env.SLEDGEWIRE_CONTACT?.trim()),process.env.SLEDGEWIRE_CONTACT?'present':'missing');
}
if(live){
  const room=process.env.SHAREDNET_ARENA_ROOM_ID??'',payee=process.env.SHAREDNET_PAYEE_ADDRESS??'',token=loadSharedNetToken();
  let normalizedBase=null;try{normalizedBase=publicBaseOrigin(publicBase,{production:true});}catch(e){add('public_base_origin',false,String(e.message||e));}
  let remotePublicKeyPem=null,currentBootId=null;
  if(normalizedBase){
    try{
      const health=await fetchJsonBounded(`${normalizedBase}/health`,64_000);
      add('public_health',health.response.ok&&health.json?.ok===true,`status=${health.response.status};version=${health.json?.version??'unknown'}`);

      const ready=await fetchJsonBounded(`${normalizedBase}/ready`,64_000);
      currentBootId=ready.json?.arena_daemon?.boot_id??null;
      add('public_ready',ready.response.ok&&ready.json?.ready===true,`status=${ready.response.status};daemon=${ready.json?.arena_daemon?.status??'unknown'}`);
      add('public_arena_daemon_fresh',ready.json?.arena_daemon?.required===true&&ready.json?.arena_daemon?.ready===true&&typeof currentBootId==='string',`age_ms=${ready.json?.arena_daemon?.age_ms??'unknown'};boot_id=${currentBootId??'missing'}`);

      const arena=await fetchTextBounded(`${normalizedBase}/arena.md`,128_000);
      add('public_arena_card',arena.response.ok&&arena.text.includes(`${normalizedBase}/mcp`)&&arena.text.includes('sledgewire.selfcheck'),`status=${arena.response.status};bytes=${Buffer.byteLength(arena.text)}`);

      const pub=await fetchTextBounded(`${normalizedBase}/public-key`,16_384);remotePublicKeyPem=pub.text;
      let remoteKeyId=null;try{remoteKeyId=keyId(pub.text);}catch{}
      add('public_signing_key_matches',Boolean(localSigningKeyId)&&remoteKeyId===localSigningKeyId,remoteKeyId??'invalid_remote_public_key');

      const mcp=new McpSession(`${normalizedBase}/mcp`,{}),init=await mcp.initialize();
      add('public_mcp_modern_protocol',init.era==='modern'&&init.protocolVersion===MODERN_PROTOCOL_VERSION,`era=${init.era};version=${init.protocolVersion}`);

      const selfcheck=(await mcp.callTool('sledgewire.selfcheck',{}))?.structuredContent;
      const selfSig=remotePublicKeyPem?verifyReceipt(selfcheck,remotePublicKeyPem):{ok:false,reason:'missing_public_key'};
      add('public_signed_selfcheck',selfcheck?.verified===true&&selfcheck?.state==='READY'&&selfSig.ok,selfSig.ok?'signed READY selfcheck':String(selfSig.reason??'invalid_selfcheck'));

      const route=(await mcp.callTool('sledgewire.smoke',{endpoint:'https://example.com/mcp'}))?.structuredContent;
      const routeSig=remotePublicKeyPem?verifyReceipt(route,remotePublicKeyPem):{ok:false,reason:'missing_public_key'};
      add('public_paid_mcp_route',route?.state==='PAYMENT_REQUIRED'&&Number(route?.price_credits)===3&&route?.arena_room_id===room&&routeSig.ok,`state=${route?.state??'missing'};price=${route?.price_credits??'missing'};room=${route?.arena_room_id??'missing'};signature=${routeSig.ok?'ok':routeSig.reason}`);
    }catch(e){add('public_live_surface',false,String(e.message||e));}
  }

  add('arena_room_is_separate_explicit_env',ROOM.test(room),room||'missing');
  if(ROOM.test(buildRoom))add('build_and_arena_rooms_are_distinct',buildRoom!==room,`build=${buildRoom};arena=${room}`);
  add('sharednet_payee',ADDRESS.test(payee),payee||'missing');
  add('sharednet_member_or_instance_token',INSTANCE_TOKEN.test(token),'present-but-redacted');
  if(INSTANCE_TOKEN.test(token)&&ROOM.test(room)){
    try{
      const api=new SharedNetApi({token}),identity=await api.current();
      add('sharednet_authenticated',Boolean(identity?.instance?.id??identity?.instance_id),'current Instance resolved');
      add('payee_owned_by_current_identity',payeeBelongsToIdentity(payee,identity),'must be current Principal/Agent/Instance');
      await api.join(room);
      const detail=await api.request(`/api/v1/rooms/${room}`);
      add('arena_room_membership',detail?.room?.id===room,'membership confirmed');
      const credits=await api.credits();
      add('credits_endpoint',Number.isFinite(Number(credits?.credits?.balance)),`balance=${credits?.credits?.balance??'unknown'}`);
    }catch(e){add('sharednet_live_api',false,String(e.message||e));}
  }

  const rehearsalPath=process.env.SLEDGEWIRE_REHEARSAL_EVIDENCE??'.sledgewire/live-rehearsal.json';
  let rehearsal=null;
  try{
    rehearsal=JSON.parse(fs.readFileSync(rehearsalPath,'utf8'));
    const proof=remotePublicKeyPem?validateLiveRehearsalEvidence(rehearsal,{roomId:room,payee,publicBaseUrl:normalizedBase,publicKeyPem:remotePublicKeyPem}):{ok:false,reason:'remote_public_key_unavailable'};
    add('external_paid_rehearsal_evidence',proof.ok,proof.ok?`txn=${proof.txn_id};buyer=${proof.buyer_seat}`:proof.reason);
  }catch(e){add('external_paid_rehearsal_evidence',false,`${rehearsalPath}:${String(e.message||e)}`);}

  const restartPath=process.env.SLEDGEWIRE_RESTART_REPLAY_EVIDENCE??'.sledgewire/restart-replay.json';
  try{
    const restart=JSON.parse(fs.readFileSync(restartPath,'utf8'));
    const proof=remotePublicKeyPem&&rehearsal?validateRestartReplayEvidence(restart,{roomId:room,rehearsal,publicKeyPem:remotePublicKeyPem,currentBootId}):{ok:false,reason:'live_rehearsal_or_public_key_unavailable'};
    add('restart_replay_evidence',proof.ok,proof.ok?`current_boot_id=${proof.current_boot_id}`:proof.reason);
  }catch(e){add('restart_replay_evidence',false,`${restartPath}:${String(e.message||e)}`);}

  if(process.env.SLEDGEWIRE_SHAREDOS_REQUIRED==='1'){
    let auditUrlOk=false,auditUrlDetail='missing';
    try{auditUrlDetail=auditSinkUrl(process.env.SHAREDOS_AUDIT_URL);auditUrlOk=true;}catch(e){auditUrlDetail=String(e.message||e);}
    add('sharedos_audit_url',auditUrlOk,auditUrlDetail);
    add('sharedos_key',Boolean(process.env.SHAREDOS_KEY?.trim()),process.env.SHAREDOS_KEY?'present':'missing');
    add('sharedos_audit_confirmed',process.env.SHAREDOS_AUDIT_CONFIRMED==='1','requires real visible trace');
  }
}
const ready=checks.every(x=>x.ok);
console.log(JSON.stringify({ready,mode:live?'live':submission?'submission':'static',checks},null,2));
if(!ready)process.exit(1);


async function fetchTextBounded(url,maxBytes){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new Error('public_probe_timeout')),10_000);
  try{
    const response=await fetch(url,{signal:controller.signal,redirect:'error',headers:{accept:'application/json,text/plain;q=0.9'}});
    const declared=Number(response.headers.get('content-length'));if(Number.isFinite(declared)&&declared>maxBytes)throw new Error('public_probe_response_too_large');
    if(!response.body)return {response,text:''};
    const reader=response.body.getReader(),chunks=[];let size=0;
    try{
      for(;;){const {done,value}=await reader.read();if(done)break;if(value){size+=value.byteLength;if(size>maxBytes){await reader.cancel().catch(()=>{});throw new Error('public_probe_response_too_large');}chunks.push(Buffer.from(value));}}
    }finally{reader.releaseLock?.();}
    return {response,text:Buffer.concat(chunks).toString('utf8')};
  }finally{clearTimeout(timer);}
}
async function fetchJsonBounded(url,maxBytes){
  const out=await fetchTextBounded(url,maxBytes);let json=null;try{json=JSON.parse(out.text);}catch{throw new Error('public_probe_invalid_json');}return {...out,json};
}
