import fs from 'node:fs';
import path from 'node:path';
import {joinWithInvite,ROOM,INVITE_TOKEN,idempotencyUuid} from '../src/sharednet/api.mjs';

const room=process.env.SHAREDNET_ARENA_ROOM_ID??'';
const invite=process.env.SHAREDNET_INVITE_TOKEN??'';
const tokenFile=path.resolve(process.env.SHAREDNET_MEMBER_TOKEN_FILE??'.sharednet/sledgewire-arena-token');
const stateFile=path.resolve(process.env.SHAREDNET_JOIN_STATE_FILE??'.sharednet/sledgewire-arena-join.json');
if(!ROOM.test(room))throw new Error('valid_SHAREDNET_ARENA_ROOM_ID_required');
if(!INVITE_TOKEN.test(invite))throw new Error('valid_SHAREDNET_INVITE_TOKEN_required');
fs.mkdirSync(path.dirname(tokenFile),{recursive:true,mode:0o700});
fs.mkdirSync(path.dirname(stateFile),{recursive:true,mode:0o700});
let state={};
try{state=JSON.parse(fs.readFileSync(stateFile,'utf8'));}catch{}
const idempotencyKey=state.room_id===room&&state.idempotency_key?state.idempotency_key:idempotencyUuid(`sledgewire-arena-join:${room}:${crypto.randomUUID()}`);
fs.writeFileSync(stateFile,JSON.stringify({room_id:room,idempotency_key:idempotencyKey,started_at:state.started_at??new Date().toISOString()},null,2),{mode:0o600});
const joined=await joinWithInvite({roomId:room,inviteToken:invite,name:'sledgewire',runtimeKind:'custom',idempotencyKey});
fs.writeFileSync(tokenFile,joined.token+'\n',{mode:0o600});
fs.writeFileSync(stateFile,JSON.stringify({room_id:room,idempotency_key:idempotencyKey,joined_at:new Date().toISOString(),last_sequence:joined.lastSequence,token_file:tokenFile},null,2),{mode:0o600});
console.log(JSON.stringify({joined:true,room_id:room,last_sequence:joined.lastSequence,token_file:tokenFile,note:'member token stored owner-only and intentionally not printed'},null,2));
