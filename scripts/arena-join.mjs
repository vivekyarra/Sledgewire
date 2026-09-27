import fs from 'node:fs';
import path from 'node:path';
import {joinWithInvite,SharedNetApi,ROOM,INVITE_TOKEN,INSTANCE_TOKEN,SEAT,idempotencyUuid,loadSharedNetToken} from '../src/sharednet/api.mjs';
import {writeArenaSeatBinding} from '../src/sharednet/seat-binding.mjs';

const room=process.env.SHAREDNET_ARENA_ROOM_ID??'';
const invite=process.env.SHAREDNET_INVITE_TOKEN??'';
const tokenFile=path.resolve(process.env.SHAREDNET_MEMBER_TOKEN_FILE??'.sharednet/sledgewire-arena-token');
const stateFile=path.resolve(process.env.SHAREDNET_JOIN_STATE_FILE??'.sharednet/sledgewire-arena-join.json');
const baseUrl=process.env.SHAREDNET_BASE_URL??'https://www.sharednet.ai';
if(!ROOM.test(room))throw new Error('valid_SHAREDNET_ARENA_ROOM_ID_required');

fs.mkdirSync(path.dirname(tokenFile),{recursive:true,mode:0o700});
fs.mkdirSync(path.dirname(stateFile),{recursive:true,mode:0o700});
let state={};try{state=JSON.parse(fs.readFileSync(stateFile,'utf8'));}catch{}

let token=loadSharedNetToken(),lastSequence=0,mode='existing-seat';
if(INSTANCE_TOKEN.test(token)){
  // Prefer the organizer/representative agent's existing seat. This avoids
  // accidentally creating a second bot seat when the official join command
  // has already authenticated the agent.
  const api=new SharedNetApi({token,baseUrl});
  await api.join(room);
  lastSequence=await api.latestSequence(room);
}else{
  if(!INVITE_TOKEN.test(invite))throw new Error('existing_SHAREDNET_member_token_or_valid_SHAREDNET_INVITE_TOKEN_required');
  mode='invite-join';
  const idempotencyKey=state.room_id===room&&state.idempotency_key
    ? state.idempotency_key
    : idempotencyUuid(`sledgewire-arena-join:${room}:${crypto.randomUUID()}`);
  fs.writeFileSync(stateFile,JSON.stringify({room_id:room,idempotency_key:idempotencyKey,started_at:state.started_at??new Date().toISOString()},null,2)+'\n',{mode:0o600});
  fs.chmodSync(stateFile,0o600);
  const joined=await joinWithInvite({roomId:room,inviteToken:invite,name:'Sledgewire',runtimeKind:'custom',idempotencyKey,baseUrl});
  token=joined.token;lastSequence=joined.lastSequence;
  fs.writeFileSync(tokenFile,token+'\n',{mode:0o600});fs.chmodSync(tokenFile,0o600);
  state.idempotency_key=idempotencyKey;
}

const api=new SharedNetApi({token,baseUrl}),identity=await api.current();
const seat=identity?.instance?.id??identity?.instance_id;if(!SEAT.test(seat??''))throw new Error('arena_join_identity_missing_instance');
const seatFile=writeArenaSeatBinding(seat);
const record={room_id:room,instance_id:seat,mode,idempotency_key:state.idempotency_key??null,joined_at:new Date().toISOString(),last_sequence:lastSequence,token_file:process.env.SHAREDNET_MEMBER_TOKEN?null:tokenFile,seat_file:seatFile};
fs.writeFileSync(stateFile,JSON.stringify(record,null,2)+'\n',{mode:0o600});fs.chmodSync(stateFile,0o600);

console.log(JSON.stringify({joined:true,mode,room_id:room,instance_id:seat,last_sequence:lastSequence,token_file:record.token_file,seat_file:seatFile,note:'single existing representative seat is preferred; secrets are intentionally not printed'},null,2));
