import fs from 'node:fs';
import path from 'node:path';
import catalog from '../catalog.json' with {type:'json'};
import {loadSigningMaterial} from '../src/receipts/receipt.mjs';
import {SharedNetApi,ROOM,ADDRESS,INSTANCE_TOKEN,loadSharedNetToken} from '../src/sharednet/api.mjs';

const live=process.argv.includes('--live');const submission=process.argv.includes('--submission');const checks=[];const add=(name,ok,detail='')=>checks.push({name,ok,detail});
const [major,minor]=process.versions.node.split('.').map(Number);add('node>=22.18',major>22||(major===22&&minor>=18),process.versions.node);
const expected={'sledgewire.quote':0,'sledgewire.selfcheck':0,'sledgewire.smoke':3,'sledgewire.assay':8,'sledgewire.invoke':12,'sledgewire.fleet':20,'sledgewire.seal':25,'sledgewire.gauntlet':35,'sledgewire.verify':0};
const actual=Object.fromEntries(Object.entries(catalog.services).map(([k,v])=>[k,v.price]));add('catalog_prices',JSON.stringify(actual)===JSON.stringify(expected),JSON.stringify(actual));
try{const s=loadSigningMaterial({production:live||process.env.NODE_ENV==='production'});add('signing_key',!live||!s.ephemeral,s.keyId);}catch(e){add('signing_key',false,String(e.message||e));}
const db=process.env.SLEDGEWIRE_DB||'.sledgewire/arena.db';try{const dir=path.dirname(path.resolve(db));fs.mkdirSync(dir,{recursive:true});fs.accessSync(dir,fs.constants.W_OK);add('durable_store_path',true,dir);}catch(e){add('durable_store_path',false,String(e));}
const publicBase=process.env.PUBLIC_BASE_URL??'';if(live||submission)add('public_product_link',publicBase.startsWith('https://'),publicBase||'missing');
if(submission){
  const buildRoom=process.env.SHAREDNET_BUILD_ROOM_ID??'';add('development_sharednet_room',ROOM.test(buildRoom),buildRoom||'missing');
  add('participant_name',Boolean(process.env.SLEDGEWIRE_PARTICIPANT_NAME?.trim()),process.env.SLEDGEWIRE_PARTICIPANT_NAME??'missing');
  add('participant_contact',Boolean(process.env.SLEDGEWIRE_CONTACT?.trim()),process.env.SLEDGEWIRE_CONTACT?'present':'missing');
}
if(live){
  const room=process.env.SHAREDNET_ARENA_ROOM_ID??'',payee=process.env.SHAREDNET_PAYEE_ADDRESS??'',token=loadSharedNetToken();
  add('arena_room_is_separate_explicit_env',ROOM.test(room),room||'missing');
  add('arena_room_differs_from_build_room',!process.env.SHAREDNET_BUILD_ROOM_ID||process.env.SHAREDNET_BUILD_ROOM_ID!==room,'build and Arena Room must be distinct');
  add('sharednet_payee',ADDRESS.test(payee),payee||'missing');
  add('sharednet_member_or_instance_token',INSTANCE_TOKEN.test(token),'present-but-redacted');
  if(INSTANCE_TOKEN.test(token)&&ROOM.test(room)){
    try{
      const api=new SharedNetApi({token});const identity=await api.current();const ids=[identity?.principal?.id,identity?.agent?.id,identity?.instance?.id].filter(Boolean);
      add('sharednet_authenticated',Boolean(identity?.instance?.id),'current Instance resolved');
      add('payee_matches_current_identity',ids.includes(payee),ids.length?'payee must be one of current Principal/Agent/Instance ids':'identity ids missing');
      const detail=await api.request(`/api/v1/rooms/${room}`);add('arena_room_membership',detail?.room?.id===room,'membership confirmed');
      const credits=await api.credits();add('credits_endpoint',Number.isFinite(Number(credits?.credits?.balance)),`balance=${credits?.credits?.balance??'unknown'}`);
    }catch(e){add('sharednet_live_api',false,String(e.message||e));}
  }
  add('external_call_confirmed',process.env.SHAREDNET_EXTERNAL_CALL_CONFIRMED==='1','requires real other-seat call');
  if(process.env.SLEDGEWIRE_SHAREDOS_REQUIRED==='1'){add('sharedos_audit_url',Boolean(process.env.SHAREDOS_AUDIT_URL),'required');add('sharedos_key',Boolean(process.env.SHAREDOS_KEY),'required');add('sharedos_audit_confirmed',process.env.SHAREDOS_AUDIT_CONFIRMED==='1','requires real visible trace');}
}
const ready=checks.every(x=>x.ok);console.log(JSON.stringify({ready,mode:live?'live':submission?'submission':'static',checks},null,2));if(!ready)process.exit(1);
