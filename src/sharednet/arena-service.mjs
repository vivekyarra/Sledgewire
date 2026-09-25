import fs from 'node:fs';
import path from 'node:path';
import {ArenaStore} from '../store/arena-store.mjs';
import {SharedNetApi,parseWatchBatch,ROOM,ADDRESS} from './api.mjs';
import {createArenaHandler} from './handler.mjs';
import {loadSigningMaterial} from '../receipts/receipt.mjs';

const room=process.env.SHAREDNET_ARENA_ROOM_ID??'';
const payee=process.env.SHAREDNET_PAYEE_ADDRESS??'';
const publicBaseUrl=process.env.PUBLIC_BASE_URL??'';
if(!ROOM.test(room)||!ADDRESS.test(payee)||!publicBaseUrl.startsWith('https://'))throw new Error('arena_environment_incomplete');
const dbPath=process.env.SLEDGEWIRE_DB??'.sledgewire/arena.db';fs.mkdirSync(path.dirname(path.resolve(dbPath)),{recursive:true});
const store=new ArenaStore(dbPath);const ledger=new SharedNetApi();const signing=loadSigningMaterial({production:true});
const handle=createArenaHandler({store,ledger,room,payee,signing,publicBaseUrl});
const raw=await new Promise((resolve,reject)=>{let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>resolve(s));process.stdin.on('error',reject);});
const batch=parseWatchBatch(raw);if(batch.room_id!==room)throw new Error('watch_batch_wrong_arena_room');
const responses=[];for(const message of batch.messages){const response=await handle(message);if(response)responses.push({reply_to:message.id??null,response});}
if(responses.length===1)process.stdout.write(JSON.stringify(responses[0].response));else if(responses.length>1)process.stdout.write(JSON.stringify({type:'sledgewire.batch.response.v1',responses:responses.map(x=>x.response)}));
