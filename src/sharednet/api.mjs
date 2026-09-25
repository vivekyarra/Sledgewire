import {createHash} from 'node:crypto';
const CROCKFORD='[0-9A-HJKMNP-TV-Z]';
export const SEAT=new RegExp(`^(?:i_[0-9A-Za-z]{10}|ins_${CROCKFORD}{26})$`);
export const ADDRESS=new RegExp(`^(?:(?:p|a|i)_[0-9A-Za-z]{10}|(?:pri|agt|ins)_${CROCKFORD}{26})$`);
export const ROOM=new RegExp(`^rom_(?:[0-9A-Za-z]{10}|${CROCKFORD}{26})$`);
export const TXN=new RegExp(`^txn_(?:[0-9A-Za-z]{10}|${CROCKFORD}{26})$`);
export const MESSAGE=new RegExp(`^msg_(?:[0-9A-Za-z]{10}|${CROCKFORD}{26})$`);
export const INSTANCE_TOKEN=/^sni_[A-Za-z0-9_-]{43}$/;

function safeBase(raw){const u=new URL(raw??'https://www.sharednet.ai');if(u.protocol!=='https:'&&u.hostname!=='127.0.0.1'&&u.hostname!=='localhost')throw new Error('sharednet_base_must_be_https');return u.toString().replace(/\/$/,'');}
function asId(x){return typeof x==='string'?x:null;}
function transferField(tx,names){for(const n of names)if(tx?.[n]!==undefined&&tx?.[n]!==null)return tx[n];return null;}
export function idempotencyUuid(seed){const b=createHash('sha256').update(String(seed)).digest().subarray(0,16);b[6]=(b[6]&0x0f)|0x40;b[8]=(b[8]&0x3f)|0x80;const h=b.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}

export function normalizeTransfer(tx,identity){
  if(!tx||typeof tx!=='object')return null;
  const principalId=identity?.principal?.id??identity?.principal_id??null;
  const instanceId=identity?.instance?.id??identity?.instance_id??null;
  const agentId=identity?.agent?.id??identity?.agent_id??null;
  const buyerInstance=asId(transferField(tx,['by_instance_id','sender_instance_id','from_instance_id','payer_instance_id','source_instance_id']));
  const senderPrincipal=asId(transferField(tx,['from_principal_id','sender_principal_id','payer_principal_id','source_principal_id']));
  const recipientPrincipal=asId(transferField(tx,['to_principal_id','recipient_principal_id','payee_principal_id','destination_principal_id']));
  const addressedTo=asId(transferField(tx,['addressed_to','to','recipient_address','payee']));
  const direction=asId(transferField(tx,['direction','flow']));
  const ourIds=new Set([principalId,instanceId,agentId].filter(Boolean));
  const incoming=(recipientPrincipal&&principalId&&recipientPrincipal===principalId)||(addressedTo&&ourIds.has(addressedTo))||direction==='received'||direction==='incoming';
  return {id:asId(tx.id),buyer_instance_id:buyerInstance,sender_principal_id:senderPrincipal,recipient_principal_id:recipientPrincipal,addressed_to:addressedTo,amount:Number(tx.amount),room_id:asId(tx.room_id),memo:typeof tx.memo==='string'?tx.memo:null,payee_ok:Boolean(incoming),raw_kind:asId(tx.kind??tx.type)};
}

export class SharedNetApi{
  constructor({token=process.env.SHAREDNET_INSTANCE_TOKEN,baseUrl=process.env.SHAREDNET_BASE_URL??'https://www.sharednet.ai',timeoutMs=10000,fetchImpl=globalThis.fetch}={}){
    if(!token||!INSTANCE_TOKEN.test(token))throw new Error('valid_sharednet_instance_token_required');
    this.token=token;this.base=safeBase(baseUrl);this.timeoutMs=timeoutMs;this.fetch=fetchImpl;this.identityCache=null;
  }
  async request(path,{method='GET',body=null,idempotencyKey=null,signal=null}={}){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(new Error('sharednet_deadline_exceeded')),this.timeoutMs);
    const relay=()=>controller.abort(signal.reason??new Error('aborted'));signal?.addEventListener('abort',relay,{once:true});
    try{
      const headers={authorization:`Bearer ${this.token}`,accept:'application/json'};if(body!==null)headers['content-type']='application/json';if(idempotencyKey)headers['idempotency-key']=idempotencyKey;
      const r=await this.fetch(`${this.base}${path}`,{method,headers,body:body===null?undefined:JSON.stringify(body),signal:controller.signal,redirect:'error'});
      const text=await r.text();let payload=null;try{payload=text?JSON.parse(text):null;}catch{throw new Error('sharednet_invalid_json');}
      if(!r.ok)throw new Error(`sharednet_http_${r.status}:${payload?.error?.code??'unknown'}`);return payload;
    }finally{clearTimeout(timer);signal?.removeEventListener('abort',relay);}
  }
  async current(signal){if(this.identityCache)return this.identityCache;const x=await this.request('/api/v1/instances/current',{signal});this.identityCache=x;return x;}
  async join(roomId,signal){if(!ROOM.test(roomId))throw new Error('invalid_sharednet_room');return this.request(`/api/v1/rooms/${roomId}/join`,{method:'POST',idempotencyKey:idempotencyUuid(`join:${roomId}`),signal});}
  async heartbeat(signal){return this.request('/api/v1/instances/current/heartbeat',{method:'POST',signal});}
  async credits(signal){return this.request('/api/v1/credits',{signal});}
  async get(txnId,signal){
    if(!TXN.test(txnId))return null;const identity=await this.current(signal);let before=null;
    for(let page=0;page<10;page++){const qs=new URLSearchParams({limit:'100'});if(before)qs.set('before',before);const x=await this.request(`/api/v1/credits/transfers?${qs}`,{signal});const item=(x?.items??[]).find(t=>t?.id===txnId);if(item)return normalizeTransfer(item,identity);if(!x?.has_more||!x?.next_cursor)break;before=x.next_cursor;}return null;
  }
  async messages(roomId,{after=null,order='asc',limit=100,signal=null}={}){
    if(!ROOM.test(roomId))throw new Error('invalid_sharednet_room');const qs=new URLSearchParams({limit:String(limit),order});if(after!==null)qs.set('after',String(after));return this.request(`/api/v1/rooms/${roomId}/messages?${qs}`,{signal});
  }
  async latestSequence(roomId,signal){const x=await this.messages(roomId,{order:'desc',limit:1,signal});return Number(x?.items?.[0]?.sequence??0);}
  async wait(roomId,after=0,signal){if(!ROOM.test(roomId))throw new Error('invalid_sharednet_room');const qs=new URLSearchParams({after:String(after),timeout:'25',limit:'100'});return this.request(`/api/v1/rooms/${roomId}/wait?${qs}`,{signal});}
  async post(roomId,content,{replyTo=null,signal=null,idempotencyKey=crypto.randomUUID()}={}){
    if(!ROOM.test(roomId))throw new Error('invalid_sharednet_room');const body={content:String(content),...(replyTo?{reply_to_message_id:replyTo}:{})};return this.request(`/api/v1/rooms/${roomId}/messages`,{method:'POST',body,idempotencyKey,signal});
  }
  async pay(to,amount,{memo=null,roomId=null,signal=null,idempotencyKey=crypto.randomUUID()}={}){
    if(!ADDRESS.test(to))throw new Error('invalid_sharednet_payee');if(!Number.isInteger(amount)||amount<1)throw new Error('invalid_credit_amount');if(roomId&&!ROOM.test(roomId))throw new Error('invalid_sharednet_room');
    return this.request('/api/v1/credits/transfers',{method:'POST',body:{to,amount,...(memo?{memo}:{}),...(roomId?{room_id:roomId}:{})},idempotencyKey,signal});
  }
}

export function senderInstance(message){return message?.sender_instance_id??message?.sender?.instance_id??message?.sender?.member_id??null;}
export function parseWatchBatch(text){const x=JSON.parse(text);const messages=Array.isArray(x)?x:(Array.isArray(x?.messages)?x.messages:(x?.message?[x.message]:[]));if(!messages.length)throw new Error('invalid_sharednet_watch_batch');const roomId=x?.room_id??messages[0]?.room_id;if(!ROOM.test(roomId??''))throw new Error('invalid_sharednet_watch_room');for(const m of messages){if(typeof m?.content!=='string'||(m.room_id&&m.room_id!==roomId)||!SEAT.test(senderInstance(m)??''))throw new Error('invalid_sharednet_watch_message');}return {room_id:roomId,messages};}
