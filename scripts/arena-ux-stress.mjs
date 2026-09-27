import {ArenaStore} from '../src/store/arena-store.mjs';
import {createArenaHandler} from '../src/sharednet/handler.mjs';
import {generateSigningKeypair,verifyReceipt} from '../src/receipts/receipt.mjs';

function boundedArg(raw,{name,min,max,defaultValue}){
  const n=raw===undefined?defaultValue:Number(raw);
  if(!Number.isInteger(n)||n<min||n>max)throw new Error(`invalid_${name}`);
  return n;
}
const n=boundedArg(process.argv[2],{name:'requests',min:100,max:500_000,defaultValue:50_000});
const concurrency=boundedArg(process.argv[3],{name:'concurrency',min:1,max:512,defaultValue:256});
const store=new ArenaStore(':memory:'),kp=generateSigningKeypair(),seat=i=>'i_'+String(i%64).padStart(10,'0');
let executions=0,ledgerReads=0,failures=0,handled=0,info=0,quotes=0,paymentQuotes=0,nulls=0,invalids=0;
const ledger={async get(){ledgerReads++;return null;}};
const handle=createArenaHandler({
  store,ledger,room:'rom_ABCDEFGHIJ',payee:'p_ABCDEFGHIJ',
  signing:{privateKeyPem:kp.privateKeyPem},publicBaseUrl:'https://sledgewire.example',
  runService:async()=>{executions++;throw new Error('ux_stress_must_never_execute');}
});

async function one(i){
  let content,check;
  switch(i%12){
    case 0:content='@sledgewire demo';check=r=>r?.type==='sledgewire.info.v1'&&r.kind==='demo';break;
    case 1:content='@sledgewire why should I use this?';check=r=>r?.type==='sledgewire.info.v1'&&r.kind==='value';break;
    case 2:content='@sledgewire explain SharedOS authority';check=r=>r?.type==='sledgewire.info.v1'&&r.kind==='sharedos';break;
    case 3:content='@sledgewire preflight https://example.com/mcp';check=r=>r?.type==='sledgewire.quote.response.v1'&&r.request_ready===true&&r.recommended_service==='sledgewire.smoke';break;
    case 4:content='@sledgewire security https://example.com/mcp';check=r=>r?.type==='sledgewire.quote.response.v1'&&r.request_ready===true&&r.recommended_service==='sledgewire.assay';break;
    case 5:content=JSON.stringify({type:'sledgewire.quote.request.v1',request_id:`q-${i}`,intent:'dossier',endpoint:'https://example.com/mcp'});check=r=>r?.type==='sledgewire.quote.response.v1'&&r.intent==='full_dossier'&&r.price_credits===35;break;
    case 6:content=JSON.stringify({type:'sledgewire.service.request.v1',request_id:`buy-${i}`,service:'sledgewire.smoke',input:{endpoint:'https://example.com/mcp'}});check=r=>r?.type==='sledgewire.payment_required.v1'&&r.price_credits===3&&r.memo==='Sledgewire'&&r.memo_version==='trial-zero-product-name.v1'&&r.request_binding==='signed_quote+durable_fingerprint.v1'&&typeof r.request_fingerprint==='string'&&r.request_fingerprint.length===64&&r.next_action?.memo===r.memo&&verifyReceipt(r,kp.publicKeyPem).ok===true&&r.verification?.exact_retry_no_reexecution===true;break;
    case 7:content=JSON.stringify({type:'sledgewire.service.request.v1',request_id:`bad-${i}`,service:'sledgewire.fleet',input:{targets:[]}});check=r=>r?.state==='FAILED'&&r.reason==='invalid_input';break;
    case 8:content='hello unrelated agent';check=r=>r===null;break;
    case 9:content='@sledgewire limits and compatibility';check=r=>r?.type==='sledgewire.info.v1'&&r.kind==='scope';break;
    case 10:content='@sledgewire verify a receipt trace';check=r=>r?.type==='sledgewire.info.v1'&&r.kind==='verification';break;
    default:content='@sledgewire compare https://a.example/mcp https://b.example/mcp';check=r=>r?.type==='sledgewire.quote.response.v1'&&r.recommended_service==='sledgewire.fleet'&&r.request_ready===true;break;
  }
  const r=await handle({sender_instance_id:seat(Math.floor(i/12)),content});
  handled++;
  if(!check(r))failures++;
  if(r?.type==='sledgewire.info.v1')info++;
  if(r?.type==='sledgewire.quote.response.v1')quotes++;
  if(r?.type==='sledgewire.payment_required.v1')paymentQuotes++;
  if(r===null)nulls++;
  if(r?.state==='FAILED')invalids++;
}
const started=Date.now(),workers=Array.from({length:Math.min(concurrency,n)},(_,w)=>(async()=>{for(let i=w;i<n;i+=concurrency)await one(i);})());
await Promise.all(workers);
const duration=Date.now()-started,stats=store.arenaStats({prices:{'sledgewire.smoke':3}});
const out={requests:n,concurrency,handled,failures,info_responses:info,quote_responses:quotes,signed_payment_quotes:paymentQuotes,null_irrelevant:nulls,invalid_requests:invalids,ledger_reads:ledgerReads,paid_service_executions:executions,duration_ms:duration,engagement:stats.engagement};
console.log(JSON.stringify(out,null,2));
if(failures!==0||handled!==n||ledgerReads!==0||executions!==0)process.exit(1);
