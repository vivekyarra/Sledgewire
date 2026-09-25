import fs from 'node:fs';
import path from 'node:path';
import {ArenaStore} from '../store/arena-store.mjs';
import {SharedNetApi,ROOM,ADDRESS,SEAT} from './api.mjs';
import {createArenaHandler} from './handler.mjs';
import {loadSigningMaterial} from '../receipts/receipt.mjs';

const room=process.env.SHAREDNET_ARENA_ROOM_ID??'';
const payee=process.env.SHAREDNET_PAYEE_ADDRESS??'';
const publicBaseUrl=process.env.PUBLIC_BASE_URL??'';
if(!ROOM.test(room)||!ADDRESS.test(payee)||!publicBaseUrl.startsWith('https://'))throw new Error('arena_environment_incomplete');
const dbPath=process.env.SLEDGEWIRE_DB??'.sledgewire/arena.db';fs.mkdirSync(path.dirname(path.resolve(dbPath)),{recursive:true});
const store=new ArenaStore(dbPath);const api=new SharedNetApi();const signing=loadSigningMaterial({production:true});const identity=await api.current();
const selfSeat=identity?.instance?.id??identity?.instance_id;if(!SEAT.test(selfSeat??''))throw new Error('sharednet_identity_missing_instance');
await api.join(room);
const handle=createArenaHandler({store,ledger:api,room,payee,signing,publicBaseUrl});
let cursor=Number(store.getMeta(`arena_cursor:${room}`)??0);let lastHeartbeat=0;
console.error(JSON.stringify({sledgewire:'arena-daemon',room,instance:selfSeat,cursor}));
for(;;){
  if(Date.now()-lastHeartbeat>20_000){await api.heartbeat().catch(e=>console.error(`heartbeat:${e.message}`));lastHeartbeat=Date.now();}
  const page=await api.wait(room,cursor);
  for(const message of page?.items??[]){
    cursor=Math.max(cursor,Number(message.sequence??cursor));store.setMeta(`arena_cursor:${room}`,String(cursor));
    if(message.sender_instance_id===selfSeat||store.roomMessageSeen(message.id))continue;
    try{
      const response=await handle(message);
      if(response)await api.post(room,JSON.stringify(response),{replyTo:message.id??null});
      store.markRoomMessage(message.id,'completed');
    }catch(e){store.markRoomMessage(message.id,'failed',String(e.message||e));console.error(`message ${message.id}: ${e.message}`);}
  }
}
