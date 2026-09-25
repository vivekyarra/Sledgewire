import fs from 'node:fs';
import {createHash} from 'node:crypto';

const CROCKFORD='[0-9A-HJKMNP-TV-Z]';
export const SEAT=new RegExp(`^(?:i_[0-9A-Za-z]{10}|ins_${CROCKFORD}{26})$`);
export const ADDRESS=new RegExp(`^(?:(?:p|a|i)_[0-9A-Za-z]{10}|(?:pri|agt|ins)_${CROCKFORD}{26})$`);
export const ROOM=new RegExp(`^rom_(?:[0-9A-Za-z]{10}|${CROCKFORD}{26})$`);
export const TXN=new RegExp(`^txn_(?:[0-9A-Za-z]{10}|${CROCKFORD}{26})$`);
export const MESSAGE=new RegExp(`^msg_(?:[0-9A-Za-z]{10}|${CROCKFORD}{26})$`);
export const ARTIFACT=new RegExp(`^art_(?:[0-9A-Za-z]{10}|${CROCKFORD}{26})$`);
export const INSTANCE_TOKEN=/^(?:sni|rmt)_[A-Za-z0-9_-]{20,128}$/;
export const INVITE_TOKEN=/^rit_[A-Za-z0-9_-]{20,128}$/;
export const MAX_ARTIFACT_BYTES=4_194_304;
export const MAX_SHAREDNET_JSON_BYTES=1_048_576;

function safeBase(raw){
  const u=new URL(raw??'https://www.sharednet.ai');
  if(u.protocol!=='https:'&&u.hostname!=='127.0.0.1'&&u.hostname!=='localhost')throw new Error('sharednet_base_must_be_https');
  if(u.username||u.password||u.search||u.hash)throw new Error('sharednet_base_must_not_include_credentials_query_or_fragment');
  if(u.pathname!=='/'&&u.pathname!=='')throw new Error('sharednet_base_must_be_origin_only');
  return u.origin;
}
function asId(x){return typeof x==='string'?x:null;}
function transferField(tx,names){for(const n of names)if(tx?.[n]!==undefined&&tx?.[n]!==null)return tx[n];return null;}
export function idempotencyUuid(seed){const b=createHash('sha256').update(String(seed)).digest().subarray(0,16);b[6]=(b[6]&0x0f)|0x40;b[8]=(b[8]&0x3f)|0x80;const h=b.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
export function payeeBelongsToIdentity(payee,identity){const ids=[identity?.principal?.id??identity?.principal_id,identity?.agent?.id??identity?.agent_id,identity?.instance?.id??identity?.instance_id].filter(Boolean);return ids.includes(payee);}
export function loadSharedNetToken(){
  const direct=process.env.SHAREDNET_MEMBER_TOKEN??process.env.SHAREDNET_INSTANCE_TOKEN;
  if(direct)return direct.trim();
  const file=process.env.SHAREDNET_MEMBER_TOKEN_FILE??'.sharednet/sledgewire-arena-token';
  try{return fs.readFileSync(file,'utf8').trim();}catch{return '';}
}
function delay(ms,signal){return new Promise((resolve,reject)=>{let done=false;const finish=(fn,v)=>{if(done)return;done=true;clearTimeout(t);signal?.removeEventListener('abort',abort);fn(v);};const abort=()=>finish(reject,signal?.reason??new Error('aborted'));const t=setTimeout(()=>finish(resolve),ms);if(signal){if(signal.aborted)return abort();signal.addEventListener('abort',abort,{once:true});}});}
function retryAfterMs(response,fallback){const raw=response.headers?.get?.('retry-after');const seconds=raw===null?NaN:Number(raw);return Number.isFinite(seconds)?Math.min(5000,Math.max(0,seconds*1000)):fallback;}
async function readTextBounded(response,maxBytes){
  const declared=Number(response.headers?.get?.('content-length'));if(Number.isFinite(declared)&&declared>maxBytes)throw new Error('sharednet_response_too_large');
  if(!response.body)return '';
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{
    for(;;){const {done,value}=await reader.read();if(done)break;if(value){size+=value.byteLength;if(size>maxBytes){await reader.cancel().catch(()=>{});throw new Error('sharednet_response_too_large');}chunks.push(Buffer.from(value));}}
  }finally{reader.releaseLock?.();}
  return Buffer.concat(chunks).toString('utf8');
}
function parseJsonResponse(text,ok){if(!text)return null;try{return JSON.parse(text);}catch{if(ok)throw new Error('sharednet_invalid_json');return null;}}
function validSequence(x){const n=Number(x);return Number.isSafeInteger(n)&&n>=0?n:null;}

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

async function guestJoinRequest({roomId,inviteToken,name,runtimeKind,idempotencyKey,baseUrl,fetchImpl,timeoutMs=10000,signal=null,retries=2,maxResponseBytes=MAX_SHAREDNET_JSON_BYTES}){
  const base=safeBase(baseUrl),body={name,runtime:{kind:runtimeKind}};
  for(let attempt=0;;attempt++){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new Error('sharednet_deadline_exceeded')),timeoutMs),relay=()=>controller.abort(signal.reason??new Error('aborted'));signal?.addEventListener('abort',relay,{once:true});
    try{
      const response=await fetchImpl(`${base}/api/v1/rooms/${roomId}/join`,{method:'POST',headers:{authorization:`Bearer ${inviteToken}`,accept:'application/json','content-type':'application/json','idempotency-key':idempotencyKey},body:JSON.stringify(body),signal:controller.signal,redirect:'error'});
      const text=await readTextBounded(response,maxResponseBytes),payload=parseJsonResponse(text,response.ok);
      if(!response.ok){
        if([429,502,503,504].includes(response.status)&&attempt<retries){await delay(retryAfterMs(response,250*(2**attempt)),signal);continue;}
        throw new Error(`sharednet_http_${response.status}:${payload?.error?.code??'unknown'}`);
      }
      return payload;
    }finally{clearTimeout(timer);signal?.removeEventListener('abort',relay);}
  }
}

export async function joinWithInvite({roomId,inviteToken,name='sledgewire',runtimeKind='custom',idempotencyKey=crypto.randomUUID(),baseUrl='https://www.sharednet.ai',fetchImpl=globalThis.fetch,signal=null}){
  if(!ROOM.test(roomId))throw new Error('invalid_sharednet_room');
  if(!INVITE_TOKEN.test(inviteToken))throw new Error('invalid_sharednet_invite_token');
  const result=await guestJoinRequest({roomId,inviteToken,name,runtimeKind,idempotencyKey,baseUrl,fetchImpl,signal});
  const token=result?.member_token??result?.token??result?.membership?.member_token??null;if(!INSTANCE_TOKEN.test(token??''))throw new Error('join_response_missing_member_token');
  const history=result?.history?.items??result?.history??[],seqs=Array.isArray(history)?history.map(m=>validSequence(m?.sequence)).filter(x=>x!==null):[];
  const lastSequence=seqs.length?Math.max(...seqs):0;
  return {token,room:result?.room??null,membership:result?.membership??null,history,lastSequence};
}

export class SharedNetApi{
  constructor({token=loadSharedNetToken(),baseUrl=process.env.SHAREDNET_BASE_URL??'https://www.sharednet.ai',timeoutMs=10000,retryBaseMs=250,fetchImpl=globalThis.fetch,maxResponseBytes=MAX_SHAREDNET_JSON_BYTES}={}){
    if(!token||!INSTANCE_TOKEN.test(token))throw new Error('valid_sharednet_member_or_instance_token_required');
    this.token=token;this.base=safeBase(baseUrl);this.timeoutMs=timeoutMs;this.retryBaseMs=retryBaseMs;this.fetch=fetchImpl;this.identityCache=null;this.maxResponseBytes=maxResponseBytes;
  }
  async request(path,{method='GET',body=null,rawBody=null,contentType=null,extraHeaders=null,idempotencyKey=null,signal=null,timeoutMs=this.timeoutMs,retries=2,maxResponseBytes=this.maxResponseBytes}={}){
    if(body!==null&&rawBody!==null)throw new Error('sharednet_body_mode_conflict');
    if(typeof path!=='string'||!path.startsWith('/api/v1/'))throw new Error('invalid_sharednet_api_path');
    for(let attempt=0;;attempt++){
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new Error('sharednet_deadline_exceeded')),timeoutMs),relay=()=>controller.abort(signal.reason??new Error('aborted'));signal?.addEventListener('abort',relay,{once:true});
      try{
        const headers={authorization:`Bearer ${this.token}`,accept:'application/json',...(extraHeaders??{})};let payloadBody;
        if(body!==null){headers['content-type']='application/json';payloadBody=JSON.stringify(body);}
        else if(rawBody!==null){headers['content-type']=contentType??'application/octet-stream';payloadBody=rawBody;}
        if(idempotencyKey)headers['idempotency-key']=idempotencyKey;
        const response=await this.fetch(`${this.base}${path}`,{method,headers,body:payloadBody,signal:controller.signal,redirect:'error'});
        const text=await readTextBounded(response,maxResponseBytes),payload=parseJsonResponse(text,response.ok);
        if(!response.ok){
          if([429,502,503,504].includes(response.status)&&attempt<retries){await delay(retryAfterMs(response,this.retryBaseMs*(2**attempt)),signal);continue;}
          throw new Error(`sharednet_http_${response.status}:${payload?.error?.code??'unknown'}`);
        }
        return payload;
      }finally{clearTimeout(timer);signal?.removeEventListener('abort',relay);}
    }
  }
  async current(signal){if(this.identityCache)return this.identityCache;const x=await this.request('/api/v1/instances/current',{signal});this.identityCache=x;return x;}
  async join(roomId,signal){if(!ROOM.test(roomId))throw new Error('invalid_sharednet_room');return this.request(`/api/v1/rooms/${roomId}/join`,{method:'POST',idempotencyKey:idempotencyUuid(`join:${roomId}`),signal});}
  async heartbeat(signal){return this.request('/api/v1/instances/current/heartbeat',{method:'POST',signal,retries:1});}
  async credits(signal){return this.request('/api/v1/credits',{signal});}
  async get(txnId,signal){
    if(!TXN.test(txnId))return null;const identity=await this.current(signal);let before=null;
    for(let page=0;page<10;page++){const qs=new URLSearchParams({limit:'100'});if(before)qs.set('before',before);const x=await this.request(`/api/v1/credits/transfers?${qs}`,{signal}),item=(x?.items??[]).find(t=>t?.id===txnId);if(item)return normalizeTransfer(item,identity);if(!x?.has_more||!x?.next_cursor)break;before=x.next_cursor;}return null;
  }
  async messages(roomId,{after=null,before=null,order='asc',limit=100,signal=null}={}){
    if(!ROOM.test(roomId))throw new Error('invalid_sharednet_room');if(after!==null&&(before!==null||order==='desc'))throw new Error('invalid_message_pagination');
    if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('invalid_sharednet_page_limit');if(!['asc','desc'].includes(order))throw new Error('invalid_sharednet_order');
    const qs=new URLSearchParams({limit:String(limit),order});if(after!==null)qs.set('after',String(after));if(before!==null)qs.set('before',String(before));return this.request(`/api/v1/rooms/${roomId}/messages?${qs}`,{signal});
  }
  async latestSequence(roomId,signal){const x=await this.messages(roomId,{order:'desc',limit:1,signal}),n=validSequence(x?.items?.[0]?.sequence);return n??0;}
  async wait(roomId,after=0,signal){if(!ROOM.test(roomId))throw new Error('invalid_sharednet_room');if(validSequence(after)===null)throw new Error('invalid_sharednet_wait_cursor');const qs=new URLSearchParams({after:String(after),timeout:'25'});return this.request(`/api/v1/rooms/${roomId}/wait?${qs}`,{signal,timeoutMs:30_000,retries:1});}
  async post(roomId,content,{replyTo=null,signal=null,idempotencyKey=crypto.randomUUID()}={}){
    if(!ROOM.test(roomId))throw new Error('invalid_sharednet_room');if(replyTo&&!MESSAGE.test(replyTo))throw new Error('invalid_sharednet_reply_message');if(Buffer.byteLength(String(content),'utf8')>32_768)throw new Error('sharednet_message_too_large');
    const body={content:String(content),...(replyTo?{reply_to_message_id:replyTo}:{})};return this.request(`/api/v1/rooms/${roomId}/messages`,{method:'POST',body,idempotencyKey,signal});
  }
  async uploadArtifact(content,{filename='sledgewire-delivery.json',roomId=null,signal=null,idempotencyKey=crypto.randomUUID()}={}){
    const bytes=Buffer.isBuffer(content)?content:Buffer.from(String(content));if(bytes.length>MAX_ARTIFACT_BYTES)throw new Error('sharednet_artifact_too_large_client_side');
    if(!/^[^/\\\u0000-\u001f\u007f]{1,240}$/.test(filename))throw new Error('invalid_artifact_filename');if(roomId&&!ROOM.test(roomId))throw new Error('invalid_sharednet_room');
    const extraHeaders={'x-sharednet-filename':filename,...(roomId?{'x-sharednet-room':roomId}:{})};
    const out=await this.request('/api/v1/artifacts',{method:'POST',rawBody:bytes,contentType:'application/json',extraHeaders,idempotencyKey,signal,timeoutMs:20_000});
    if(!ARTIFACT.test(out?.artifact?.id??'')||typeof out?.url!=='string')throw new Error('sharednet_artifact_response_invalid');
    let artifactUrl;try{artifactUrl=new URL(out.url,this.base);}catch{throw new Error('sharednet_artifact_response_invalid');}
    if(artifactUrl.protocol!=='https:')throw new Error('sharednet_artifact_response_invalid');
    return {...out,url:artifactUrl.toString()};
  }
  async pay(to,amount,{memo=null,roomId=null,signal=null,idempotencyKey=crypto.randomUUID()}={}){
    if(!ADDRESS.test(to))throw new Error('invalid_sharednet_payee');if(!Number.isInteger(amount)||amount<1)throw new Error('invalid_credit_amount');if(roomId&&!ROOM.test(roomId))throw new Error('invalid_sharednet_room');
    return this.request('/api/v1/credits/transfers',{method:'POST',body:{to,amount,...(memo?{memo}:{}),...(roomId?{room_id:roomId}:{})},idempotencyKey,signal});
  }
}
export function senderInstance(message){return message?.sender_instance_id??message?.sender?.instance_id??message?.sender?.member_id??null;}
export function parseWatchBatch(text){const x=JSON.parse(text),messages=Array.isArray(x)?x:(Array.isArray(x?.messages)?x.messages:(x?.message?[x.message]:[]));if(!messages.length)throw new Error('invalid_sharednet_watch_batch');const roomId=x?.room_id??messages[0]?.room_id;if(!ROOM.test(roomId??''))throw new Error('invalid_sharednet_watch_room');for(const m of messages){if(typeof m?.content!=='string'||(m.room_id&&m.room_id!==roomId)||!SEAT.test(senderInstance(m)??''))throw new Error('invalid_sharednet_watch_message');}return {room_id:roomId,messages};}
