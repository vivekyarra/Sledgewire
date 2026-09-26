import fs from 'node:fs';
import path from 'node:path';
import {ArenaStore} from '../store/arena-store.mjs';
import {SharedNetApi,ROOM,ADDRESS,SEAT,MESSAGE,payeeBelongsToIdentity} from './api.mjs';
import {createArenaHandler} from './handler.mjs';
import {deliverArenaResponse} from './delivery.mjs';
import {loadSigningMaterial} from '../receipts/receipt.mjs';
import {writeArenaDaemonHeartbeat} from '../ops/readiness.mjs';
import catalog from '../../catalog.json' with {type:'json'};
import {announceArenaOnce} from './announcement.mjs';

const room=process.env.SHAREDNET_ARENA_ROOM_ID??'',payee=process.env.SHAREDNET_PAYEE_ADDRESS??'',publicBaseUrl=process.env.PUBLIC_BASE_URL??'';
if(!ROOM.test(room)||!ADDRESS.test(payee)||!publicBaseUrl.startsWith('https://'))throw new Error('arena_environment_incomplete');
const dbPath=process.env.SLEDGEWIRE_DB??'.sledgewire/arena.db';fs.mkdirSync(path.dirname(path.resolve(dbPath)),{recursive:true});
const store=new ArenaStore(dbPath),api=new SharedNetApi(),signing=loadSigningMaterial({production:true}),identity=await api.current();
const selfSeat=identity?.instance?.id??identity?.instance_id;if(!SEAT.test(selfSeat??''))throw new Error('sharednet_identity_missing_instance');
if(!payeeBelongsToIdentity(payee,identity))throw new Error('configured_payee_not_owned_by_current_sharednet_identity');
await api.join(room);
const announceEnabled=process.env.SLEDGEWIRE_ARENA_ANNOUNCE!=='0';
try{const announcement=await announceArenaOnce({api,store,room,publicBaseUrl,enabled:announceEnabled});console.error(JSON.stringify({sledgewire:'arena-announcement',status:announcement.status,message_id:announcement.record?.message_id??null}));}
catch(e){console.error(`arena-announcement:${e.message}`);if(process.env.SLEDGEWIRE_ARENA_ANNOUNCE_REQUIRED==='1')throw e;}
const handle=createArenaHandler({store,ledger:api,room,payee,signing,publicBaseUrl});
const key=`arena_cursor:${room}`;let stored=store.getMeta(key),cursor=stored===null?(process.env.SLEDGEWIRE_PROCESS_HISTORY==='1'?0:await api.latestSequence(room)):Number(stored);store.setMeta(key,String(cursor));
const concurrency=Math.max(1,Math.min(8,Number(process.env.SLEDGEWIRE_ARENA_CONCURRENCY??4))),maxAttempts=Math.max(2,Math.min(10,Number(process.env.SLEDGEWIRE_MESSAGE_MAX_ATTEMPTS??5)));
const heartbeat=setInterval(()=>api.heartbeat().catch(e=>console.error(`heartbeat:${e.message}`)),20_000);heartbeat.unref();
const writeLocalHeartbeat=(status='running')=>{try{writeArenaDaemonHeartbeat(store,room,{instanceId:selfSeat,status});}catch(e){console.error(`local-heartbeat:${e.message}`);}};
writeLocalHeartbeat();
const localHeartbeat=setInterval(()=>writeLocalHeartbeat(),10_000);localHeartbeat.unref();
const arenaPrices=Object.fromEntries(Object.entries(catalog.services).map(([k,v])=>[k,v.price]));
const statsEvery=Math.max(60_000,Math.min(3_600_000,Number(process.env.SLEDGEWIRE_ARENA_STATS_INTERVAL_MS??300_000)));
const statsTimer=setInterval(()=>{try{console.error(JSON.stringify({sledgewire:'arena-stats',...store.arenaStats({prices:arenaPrices})}));}catch(e){console.error(`arena-stats:${e.message}`);}},statsEvery);statsTimer.unref();
const stop=signal=>{clearInterval(heartbeat);clearInterval(localHeartbeat);clearInterval(statsTimer);writeLocalHeartbeat('stopped');console.error(JSON.stringify({sledgewire:'arena-daemon',event:'stopping',signal}));try{store.db.close();}catch{}process.exit(0);};
process.once('SIGTERM',()=>stop('SIGTERM'));process.once('SIGINT',()=>stop('SIGINT'));
console.error(JSON.stringify({sledgewire:'arena-daemon',version:'0.3.9',room,instance:selfSeat,cursor,concurrency,maxAttempts}));
const sequenceOf=message=>{const n=Number(message?.sequence);return Number.isSafeInteger(n)&&n>=0?n:null;};
let backoff=500;
for(;;){
  try{
    const page=await api.wait(room,cursor);backoff=500;
    const items=(page?.items??[]).filter(x=>sequenceOf(x)!==null).sort((a,b)=>sequenceOf(a)-sequenceOf(b));
    await mapLimit(items,concurrency,async message=>{
      if(!MESSAGE.test(message?.id??'')){
        console.error(`protocol-invalid Room message id at sequence ${sequenceOf(message)}; advancing because no valid reply target exists`);
        return {ok:true,message,protocolInvalid:true};
      }
      if(message.sender_instance_id===selfSeat){store.markRoomMessage(message.id,'completed');return {ok:true,message};}
      if(store.roomMessageTerminal(message.id))return {ok:true,message};
      if(!store.claimRoomMessage(message.id,{maxAttempts}))return {ok:store.roomMessageTerminal(message.id),message,reason:'claimed_elsewhere_or_terminal'};
      try{
        const response=await handle(message);if(response)await deliverArenaResponse(api,room,message.id,response);
        store.markRoomMessage(message.id,'completed');return {ok:true,message};
      }catch(e){
        const failure=store.markRoomMessageFailed(message.id,String(e.message||e),{maxAttempts});
        console.error(`message ${message.id} attempt ${failure.attempts} -> ${failure.status}: ${e.message}`);
        return {ok:failure.status==='dead_letter',message,error:e,terminal:failure.status==='dead_letter'};
      }
    });
    for(const message of items){
      const seq=sequenceOf(message);if(seq===null)break;
      const terminal=!MESSAGE.test(message?.id??'')||store.roomMessageTerminal(message.id);
      if(terminal){cursor=Math.max(cursor,seq);store.setMeta(key,String(cursor));}else break;
    }
  }catch(e){console.error(`arena-loop:${e.message}`);await new Promise(r=>setTimeout(r,backoff));backoff=Math.min(backoff*2,10_000);}
}
async function mapLimit(items,limit,fn){const out=new Array(items.length);let next=0;async function worker(){for(;;){const i=next++;if(i>=items.length)return;out[i]=await fn(items[i]);}}await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));return out;}
