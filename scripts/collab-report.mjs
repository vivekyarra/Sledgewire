import {SharedNetApi,ROOM} from '../src/sharednet/api.mjs';

const room=process.env.SHAREDNET_BUILD_ROOM_ID??'';
if(!ROOM.test(room))throw new Error('valid_SHAREDNET_BUILD_ROOM_ID_required');
const api=new SharedNetApi();await api.join(room);
let after=0;const messages=[];
for(let page=0;page<100;page++){
  const x=await api.messages(room,{after,order:'asc',limit:100});
  const batch=x?.items??[];messages.push(...batch);
  if(batch.length)after=Math.max(after,...batch.map(m=>Number(m.sequence??0)));
  if(!x?.has_more||!x?.next_cursor)break;
  after=Number(x.next_cursor);
}
const bySender={};const handoffs=[];
for(const m of messages){
  const sender=m.sender_instance_id??'unknown';bySender[sender]=(bySender[sender]??0)+1;
  let parsed=null;try{parsed=JSON.parse(m.content);}catch{}
  if(parsed&&typeof parsed==='object'&&(parsed.artifact_id||parsed.requested_action||parsed.acceptance_tests)){
    handoffs.push({message_id:m.id,sequence:m.sequence,sender_instance_id:sender,reply_to_message_id:m.reply_to_message_id??null,artifact_id:parsed.artifact_id??null,owner_role:parsed.owner_role??null,requested_action:parsed.requested_action??null,status:parsed.status??null,result_hash:parsed.result_hash??null});
  }
}
console.log(JSON.stringify({room_id:room,message_count:messages.length,unique_senders:Object.keys(bySender).length,by_sender:bySender,structured_handoffs:handoffs,last_sequence:after},null,2));
