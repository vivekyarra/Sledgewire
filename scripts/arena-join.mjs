import fs from 'node:fs';
import path from 'node:path';
import {joinWithInvite,SharedNetApi,ROOM,INVITE_TOKEN,SEAT,idempotencyUuid} from '../src/sharednet/api.mjs';
import {writeArenaSeatBinding} from '../src/sharednet/seat-binding.mjs';

const room=process.env.SHAREDNET_ARENA_ROOM_ID??'';
const invite=process.env.SHAREDNET_INVITE_TOKEN??'';
const tokenFile=path.resolve(process.env.SHAREDNET_MEMBER_TOKEN_FILE??'.sharednet/sledgewire-arena-token');
const stateFile=path.resolve(process.env.SHAREDNET_JOIN_STATE_FILE??'.sharednet/sledgewire-arena-join.json');
if(!ROOM.test(room))throw new Error('valid_SHAREDNET_ARENA_ROOM_ID_required');
if(!INVITE_TOKEN.test(invite))throw new Error('valid_SHAREDNET_INVITE_TOKEN_required');

fs.mkdirSync(path.dirname(tokenFile),{recursive:true,mode:0o700});
fs.mkdirSync(path.dirname(stateFile),{recursive:true,mode:0o700});
let state={};try{state=JSON.parse(fs.readFileSync(stateFile,'utf8'));}catch{}
const idempotencyKey=state.room_id===room&&state.idempotency_key
  ? state.idempotency_key
  : idempotencyUuid(`sledgewire-arena-join:${room}:${crypto.randomUUID()}`);
fs.writeFileSync(stateFile,JSON.stringify({room_id:room,idempotency_key:idempotencyKey,started_at:state.started_at??new Date().toISOString()},null,2),{mode:0o600});

const baseUrl=process.env.SHAREDNET_BASE_URL??'https://www.sharednet.ai';
const joined=await joinWithInvite({roomId:room,inviteToken:invite,name:'Sledgewire',runtimeKind:'custom',idempotencyKey,baseUrl});
fs.writeFileSync(tokenFile,joined.token+'\n',{mode:0o600});
const joinedApi=new SharedNetApi({token:joined.token,baseUrl}),identity=await joinedApi.current();
const seat=identity?.instance?.id??identity?.instance_id;if(!SEAT.test(seat??''))throw new Error('arena_join_identity_missing_instance');
const seatFile=writeArenaSeatBinding(seat);
fs.writeFileSync(stateFile,JSON.stringify({room_id:room,instance_id:seat,idempotency_key:idempotencyKey,joined_at:new Date().toISOString(),last_sequence:joined.lastSequence,token_file:tokenFile,seat_file:seatFile},null,2),{mode:0o600});

console.log(JSON.stringify({joined:true,room_id:room,instance_id:seat,last_sequence:joined.lastSequence,token_file:tokenFile,seat_file:seatFile,note:'single Arena seat bound; member token stored owner-only and intentionally not printed'},null,2));
