import {McpSession,MODERN_PROTOCOL_VERSION} from '../src/mcp/client.mjs';
import {keyId,verifyReceipt} from '../src/receipts/receipt.mjs';
import {publicBaseOrigin} from '../src/ops/config.mjs';
import {ROOM} from '../src/sharednet/api.mjs';

const args=process.argv.slice(2),arena=args.includes('--arena'),raw=args.find(x=>!x.startsWith('--'));
if(!raw){
  console.error('usage: npm run public:probe -- https://seller.example [--arena]');
  process.exit(2);
}
let base;
try{base=publicBaseOrigin(raw,{production:true});}
catch(e){console.error(String(e.message||e));process.exit(2);}

const checks=[];
const add=(name,ok,detail='')=>checks.push({name,ok:Boolean(ok),detail});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function boundedText(url,maxBytes,accept='application/json,text/plain;q=0.9'){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new Error('probe_timeout')),12_000);
  try{
    const r=await fetch(url,{signal:controller.signal,redirect:'error',headers:{accept}});
    const declared=Number(r.headers.get('content-length'));
    if(Number.isFinite(declared)&&declared>maxBytes)throw new Error('probe_response_too_large');
    if(!r.body)return {response:r,text:''};
    const reader=r.body.getReader(),chunks=[];let bytes=0;
    try{
      for(;;){
        const {done,value}=await reader.read();if(done)break;
        if(value){bytes+=value.byteLength;if(bytes>maxBytes){await reader.cancel().catch(()=>{});throw new Error('probe_response_too_large');}chunks.push(Buffer.from(value));}
      }
    }finally{reader.releaseLock?.();}
    return {response:r,text:Buffer.concat(chunks).toString('utf8')};
  }finally{clearTimeout(timer);}
}
async function boundedJson(url,maxBytes){
  const out=await boundedText(url,maxBytes);
  let json;try{json=JSON.parse(out.text);}catch{throw new Error('probe_invalid_json');}
  return {...out,json};
}

let publicKeyPem=null;
try{
  const health=await boundedJson(`${base}/health`,64_000);
  add('health',health.response.ok&&health.json?.ok===true,`status=${health.response.status};version=${health.json?.version??'unknown'}`);

  const ready=await boundedJson(`${base}/ready`,64_000);
  const daemon=ready.json?.arena_daemon;
  const readyOk=ready.response.ok&&ready.json?.ready===true;
  add('ready',readyOk,`status=${ready.response.status};daemon=${daemon?.status??'unknown'}`);
  if(arena){
    add('arena_daemon_required',daemon?.required===true,'configured Arena Room required');
    add('arena_daemon_fresh',daemon?.ready===true&&UUID.test(String(daemon?.boot_id??'')),`age_ms=${daemon?.age_ms??'unknown'};boot_id=${daemon?.boot_id??'missing'}`);
  }

  const card=await boundedText(`${base}/arena.md`,128_000,'text/markdown,text/plain;q=0.9');
  add('arena_card',card.response.ok&&card.text.includes(`${base}/mcp`)&&card.text.includes('sledgewire.selfcheck'),`status=${card.response.status};bytes=${Buffer.byteLength(card.text)}`);

  const pub=await boundedText(`${base}/public-key`,16_384,'text/plain');
  publicKeyPem=pub.text;
  let kid=null;try{kid=keyId(publicKeyPem);}catch{}
  add('public_key',pub.response.ok&&Boolean(kid),kid??'invalid public key');

  const session=new McpSession(`${base}/mcp`,{timeoutMs:20_000});
  const init=await session.initialize();
  add('modern_mcp',init.era==='modern'&&init.protocolVersion===MODERN_PROTOCOL_VERSION,`era=${init.era};version=${init.protocolVersion}`);

  const selfcheck=(await session.callTool('sledgewire.selfcheck',{}))?.structuredContent;
  const sig=publicKeyPem?verifyReceipt(selfcheck,publicKeyPem):{ok:false,reason:'missing_public_key'};
  add('signed_selfcheck',selfcheck?.verified===true&&selfcheck?.state==='READY'&&sig.ok,sig.ok?`key_id=${sig.key_id}`:String(sig.reason??'invalid selfcheck'));

  if(arena){
    const route=(await session.callTool('sledgewire.smoke',{endpoint:'https://example.com/mcp'}))?.structuredContent;
    const routeSig=publicKeyPem?verifyReceipt(route,publicKeyPem):{ok:false,reason:'missing_public_key'};
    const routeOk=route?.state==='PAYMENT_REQUIRED'&&Number(route?.price_credits)===3&&ROOM.test(route?.arena_room_id??'')&&routeSig.ok;
    add('signed_paid_route',routeOk,`state=${route?.state??'missing'};price=${route?.price_credits??'missing'};room=${route?.arena_room_id??'missing'};signature=${routeSig.ok?'ok':routeSig.reason}`);
  }
}catch(e){
  add('probe_exception',false,String(e.message||e));
}

const ready=checks.length>0&&checks.every(x=>x.ok);
console.log(JSON.stringify({ready,mode:arena?'arena':'public',base_url:base,checks},null,2));
if(!ready)process.exit(1);
