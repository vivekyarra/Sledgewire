import test from 'node:test';
import assert from 'node:assert/strict';
import {generateSigningKeypair,signReceipt} from '../src/receipts/receipt.mjs';
import {runLiveSmokeRehearsal} from '../src/sharednet/live-rehearsal.mjs';

const room='rom_ABCDEFGHIJ',payee='p_ABCDEFGHIJ',buyer='i_ZYXWVUTSRQ',txn='txn_ABCDEFGHIJ';
function fakeApi(privateKeyPem){
  let seq=10,phase='idle',lastRequest=null,payCalls=0,posts=0;
  const reply=(to,body)=>({id:`msg_REPLY${String(++seq).padStart(5,'0')}`,room_id:room,sequence:seq,sender_instance_id:'i_SELLERABCD',reply_to_message_id:to,content:JSON.stringify(body)});
  return {
    stats:()=>({payCalls,posts}),
    async current(){return {principal:{id:'p_BUYERABCD'},instance:{id:buyer}};},
    async join(){return {};},
    async latestSequence(){return seq;},
    async post(_room,content){posts++;lastRequest=JSON.parse(content);const id=posts===1?'msg_REQUEST001':posts===2?'msg_REQUEST002':'msg_REQUEST003';seq++;phase=posts===1?'quote':posts===2?'delivery':'replay';return {message:{id,room_id:room,sequence:seq,sender_instance_id:buyer,content}};},
    async pay(to,amount,{memo,roomId}){assert.equal(to,payee);assert.equal(amount,3);assert.equal(roomId,room);assert.equal(memo,'sledgewire:rehearsal-fixed:sledgewire.smoke');payCalls++;return {transfer:{id:txn}};},
    async wait(){
      if(phase==='quote'){phase='idle';return {items:[reply('msg_REQUEST001',{type:'sledgewire.payment_required.v1',request_id:'rehearsal-fixed',service:'sledgewire.smoke',price_credits:3,payee,memo:'sledgewire:rehearsal-fixed:sledgewire.smoke',room_id:room})]};}
      const traceId='11111111-1111-4111-8111-111111111111';
      const receipt=signReceipt({service:'sledgewire.smoke',state:'READY',sharedos_trace_id:traceId,buyer_seat:buyer,request_fingerprint:'fp',request_id:'rehearsal-fixed',payment:{txn_id:txn,price_credits:3,room_id:room}},privateKeyPem);
      const body={type:'sledgewire.service.response.v1',request_id:'rehearsal-fixed',service:'sledgewire.smoke',state:'DELIVERED',outcome_state:'READY',trace_id:traceId,receipt};
      if(phase==='delivery'){phase='idle';return {items:[reply('msg_REQUEST002',body)]};}
      if(phase==='replay'){phase='idle';return {items:[reply('msg_REQUEST003',body)]};}
      return {items:[]};
    }
  };
}

test('live rehearsal core proves quote payment signed delivery trace and exact cached retry',async()=>{
  const kp=generateSigningKeypair(),api=fakeApi(kp.privateKeyPem),traceId='11111111-1111-4111-8111-111111111111';
  const trace=signReceipt({service:'sledgewire.trace',state:'READY',trace_id:traceId,events:[{event:'allow'}]},kp.privateKeyPem);
  const r=await runLiveSmokeRehearsal({api,roomId:room,payee,publicBaseUrl:'https://sledgewire.example',targetEndpoint:'https://target.example/mcp',publicKeyPem:kp.publicKeyPem,lookupTrace:async id=>{assert.equal(id,traceId);return trace;},requestId:'rehearsal-fixed',timeoutMs:1000});
  assert.equal(r.verified,true);assert.deepEqual(r.checks,{payment_quote:true,native_transfer:true,signed_delivery:true,sharedos_trace:true,trace_signature:true,exact_cached_retry:true});
  assert.equal(api.stats().payCalls,1);assert.equal(api.stats().posts,3);
});
