import {MESSAGE,parseWatchBatch} from './api.mjs';
import {prepareArenaResponse} from './delivery.mjs';

export async function prepareWatchReply(raw,{expectedRoom,handle,api}){
  const batch=parseWatchBatch(raw);
  if(batch.room_id!==expectedRoom)throw new Error('watch_batch_wrong_arena_room');
  if(batch.messages.length!==1)throw new Error('watch_reply_requires_single_message');
  const message=batch.messages[0];
  if(!MESSAGE.test(message?.id??''))throw new Error('watch_message_missing_valid_id');
  const response=await handle(message);
  if(!response)return {reply:false,text:''};
  const prepared=await prepareArenaResponse(api,expectedRoom,response,{seed:`${expectedRoom}:${message.id}`});
  return {reply:true,text:prepared.text,mode:prepared.mode,bytes:prepared.bytes};
}
