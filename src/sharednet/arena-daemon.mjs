import fs from 'node:fs';
import path from 'node:path';
import {ArenaStore} from '../store/arena-store.mjs';
import {SharedNetApi,ROOM,ADDRESS,SEAT,MESSAGE,payeeBelongsToIdentity} from './api.mjs';
import {createArenaHandler} from './handler.mjs';
import {deliverArenaResponse} from './delivery.mjs';
import {loadSigningMaterial} from '../receipts/receipt.mjs';

const room=process.env.SHAREDNET_ARENA_ROOM_ID??'',payee=process.env.SHAREDNET_PAYEE_ADDRESS??'',publicBaseUrl=process.env.PUBLIC_BASE_URL??'';
if(!ROOM.test(room)||!ADDRESS.test(payee)||!publicBaseUrl.startsWith('https://'))throw new Error('arena_environment_incomplete');
const dbPath=process.env.SLEDGEWIRE_DB??'.sledgewire/arena.db';fs.mkdirSync(path.dirname(path.resolve(dbPath)),{recursive:true});
const store=new ArenaStore(dbPath),api=new SharedNetApi(),signing=loadSigningMaterial({production:true}),identity=await api.current();
const selfSeat=identity?.instance?.id??identity?.instance_id;if(!SEAT.test(selfSeat??''))throw new Error('sharednet_identity_missing_instance');
if(!payeeBelongsToIdentity(payee,identity))throw new Error('configured_payee_not_owned_by_current_sharednet_identity');
await api.join(room);
const handle=createArenaHandler({store,ledger:api,room,payee,signing,publicBaseUrl});
const key=`arena_cursor:${room}`;let stored=store.getMeta(key);let cursor=stored===null?(process.env.SLEDGEWIRE_PROCESS_HISTORY==='1'?0:await api.latestSequence(room)):Number(stored);store.setMeta(key,String(cursor));
const concurrency=Math.max(1,Math.min(8,Number(process.env.SLEDGEWIRE_ARENA_CONCURRENCY??4)));
const heartbeat=setInterval(()=>api.heartbeat().catch(e=>console.error(`heartbeat:${e.message}`)),20_000);heartbeat.unref();
console.error(JSON.stringify({sledgewire:'arena-daemon',version:'0.3.2',room,instance:selfSeat,cursor,concurrency}));
let backoff=500;
for(;;){
  try{
    const page=await api.wait(room,cursor);backoff=500;const items=(page?.items??[]).sort((a,b)=>Number(a.sequence)-Number(b.sequence));
    await mapLimit(items,concurrency,async message=>{
      if(!MESSAGE.test(message?.id??'')){console.error('invalid_room_message_id');return {ok:false,message,reason:'invalid_message_id'};}
      if(message.sender_instance_id===selfSeat){store.markRoomMessage(message.id,'completed');return {ok:true,message};}
      if(store.roomMessageSeen(message.id))return {ok:true,message};
      if(!store.claimRoomMessage(message.id))return {ok:false,message,reason:'claimed_elsewhere'};
      try{
        const response=await handle(message);
        if(response)await deliverArenaResponse(api,room,message.id,response);
        store.markRoomMessage(message.id,'completed');return {ok:true,message};
      }catch(e){store.markRoomMessage(message.id,'failed',String(e.message||e));console.error(`message ${message.id}: ${e.message}`);return {ok:false,message,error:e};}
    });
    for(const message of items){if(MESSAGE.test(message?.id??'')&&store.roomMessageSeen(message.id)){cursor=Math.max(cursor,Number(message.sequence??cursor));store.setMeta(key,String(cursor));}else break;}
  }catch(e){console.error(`arena-loop:${e.message}`);await new Promise(r=>setTimeout(r,backoff));backoff=Math.min(backoff*2,10_000);}
}
async function mapLimit(items,limit,fn){const out=new Array(items.length);let next=0;async function worker(){for(;;){const i=next++;if(i>=items.length)return;out[i]=await fn(items[i]);}}await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));return out;}
