import fs from 'node:fs';
import path from 'node:path';
import catalog from '../catalog.json' with {type:'json'};
import {loadSigningMaterial,keyId} from '../src/receipts/receipt.mjs';
import {exactPriceMap} from '../src/core/catalog-policy.mjs';
import {SharedNetApi,ROOM,ADDRESS,INSTANCE_TOKEN,payeeBelongsToIdentity,loadSharedNetToken} from '../src/sharednet/api.mjs';

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

const publicBase=process.env.PUBLIC_BASE_URL??'',paidBypass=process.env.SLEDGEWIRE_PUBLIC_PAID_EXECUTION==='1';
if(live||submission){
  add('public_product_link',publicBase.startsWith('https://'),publicBase||'missing');
  add('public_paid_bypass_disabled',!paidBypass,paidBypass?'SLEDGEWIRE_PUBLIC_PAID_EXECUTION=1 is forbidden':'disabled');
}
if(live)add('node_env_production',process.env.NODE_ENV==='production',process.env.NODE_ENV??'missing');

const buildRoom=process.env.SHAREDNET_BUILD_ROOM_ID??'';
if(submission){
  add('development_sharednet_room',ROOM.test(buildRoom),buildRoom||'missing');
  add('participant_name',Boolean(process.env.SLEDGEWIRE_PARTICIPANT_NAME?.trim()),process.env.SLEDGEWIRE_PARTICIPANT_NAME??'missing');
  add('participant_contact',Boolean(process.env.SLEDGEWIRE_CONTACT?.trim()),process.env.SLEDGEWIRE_CONTACT?'present':'missing');
}
if(live){
  const room=process.env.SHAREDNET_ARENA_ROOM_ID??'',payee=process.env.SHAREDNET_PAYEE_ADDRESS??'',token=loadSharedNetToken();
  if(publicBase.startsWith('https://')){
    try{
      const ready=await fetchJsonBounded(`${publicBase.replace(/\/$/,'')}/ready`,64_000);
      add('public_ready',ready.response.ok&&ready.json?.ready===true,`status=${ready.response.status};daemon=${ready.json?.arena_daemon?.status??'unknown'}`);
      add('public_arena_daemon_fresh',ready.json?.arena_daemon?.ready===true,`age_ms=${ready.json?.arena_daemon?.age_ms??'unknown'}`);
      const pub=await fetchTextBounded(`${publicBase.replace(/\/$/,'')}/public-key`,16_384);
      let remoteKeyId=null;try{remoteKeyId=keyId(pub.text);}catch{}
      add('public_signing_key_matches',Boolean(localSigningKeyId)&&remoteKeyId===localSigningKeyId,remoteKeyId??'invalid_remote_public_key');
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
  add('external_call_confirmed',process.env.SHAREDNET_EXTERNAL_CALL_CONFIRMED==='1','requires real other-seat call');
  if(process.env.SLEDGEWIRE_SHAREDOS_REQUIRED==='1'){
    add('sharedos_audit_url',Boolean(process.env.SHAREDOS_AUDIT_URL),'required');
    add('sharedos_key',Boolean(process.env.SHAREDOS_KEY),'required');
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
