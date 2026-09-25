import {idempotencyUuid,MESSAGE,SEAT,TXN,payeeBelongsToIdentity} from './api.mjs';
import {paymentMemo} from '../core/payment-gate.mjs';
import {verifyReceipt} from '../receipts/receipt.mjs';

function sequenceOf(x){const n=Number(x?.sequence);return Number.isSafeInteger(n)&&n>=0?n:null;}
function parseJsonMessage(message){if(typeof message?.content!=='string')return null;try{return JSON.parse(message.content);}catch{return null;}}
function messageId(result){return result?.message?.id??result?.id??null;}
function messageSequence(result){return sequenceOf(result?.message??result);}
function buyerInstance(identity){return identity?.instance?.id??identity?.instance_id??null;}
function eqReceipt(a,b){return a?.proof?.signature&&a.proof.signature===b?.proof?.signature&&a?.proof?.body_sha256===b?.proof?.body_sha256;}

export async function waitForArenaReply(api,roomId,{after,replyTo,requestId,buyerSeat,timeoutMs=90_000}){
  const deadline=Date.now()+timeoutMs;let cursor=Number(after)||0;
  while(Date.now()<deadline){
    const controller=new AbortController(),remaining=Math.max(1,deadline-Date.now()),timer=setTimeout(()=>controller.abort(new Error('rehearsal_reply_timeout')),remaining);
    let page;
    try{page=await api.wait(roomId,cursor,controller.signal);}finally{clearTimeout(timer);}
    const items=Array.isArray(page?.items)?page.items:[];
    for(const m of items){
      const seq=sequenceOf(m);if(seq!==null)cursor=Math.max(cursor,seq);
      if(m?.sender_instance_id===buyerSeat)continue;
      if(replyTo&&m?.reply_to_message_id!==replyTo)continue;
      const body=parseJsonMessage(m);
      if(body?.request_id===requestId)return {message:m,body,cursor};
    }
  }
  throw new Error('rehearsal_reply_timeout');
}

function assertPaymentQuote(body,{requestId,roomId,payee,service,price}){
  if(body?.type!=='sledgewire.payment_required.v1')throw new Error('rehearsal_missing_payment_required');
  if(body.request_id!==requestId||body.service!==service)throw new Error('rehearsal_quote_request_mismatch');
  if(body.room_id!==roomId||body.payee!==payee)throw new Error('rehearsal_quote_destination_mismatch');
  if(Number(body.price_credits)!==price)throw new Error('rehearsal_quote_price_mismatch');
  if(body.memo!==paymentMemo(requestId,service))throw new Error('rehearsal_quote_memo_mismatch');
}
function assertDelivery(body,{requestId,service,roomId,buyerSeat,txnId,price,publicKeyPem}){
  if(body?.type!=='sledgewire.service.response.v1'||body.state!=='DELIVERED')throw new Error(`rehearsal_delivery_failed:${body?.reason??body?.state??'unknown'}`);
  if(body.request_id!==requestId||body.service!==service)throw new Error('rehearsal_delivery_request_mismatch');
  if(!body.trace_id||body.trace_id!==body.receipt?.sharedos_trace_id)throw new Error('rehearsal_trace_id_mismatch');
  if(body.receipt?.buyer_seat!==buyerSeat)throw new Error('rehearsal_receipt_buyer_mismatch');
  if(body.receipt?.payment?.txn_id!==txnId||body.receipt?.payment?.room_id!==roomId||Number(body.receipt?.payment?.price_credits)!==price)throw new Error('rehearsal_receipt_payment_mismatch');
  const verified=verifyReceipt(body.receipt,publicKeyPem);if(!verified.ok)throw new Error(`rehearsal_receipt_signature_invalid:${verified.reason}`);
  return verified;
}

export async function runLiveSmokeRehearsal({api,roomId,payee,publicBaseUrl,targetEndpoint,publicKeyPem,lookupTrace,requestId=`rehearsal-${crypto.randomUUID()}`,timeoutMs=120_000}){
  const service='sledgewire.smoke',price=3;
  if(typeof publicBaseUrl!=='string'||!publicBaseUrl.startsWith('https://'))throw new Error('rehearsal_public_base_https_required');
  if(typeof targetEndpoint!=='string'||!targetEndpoint.startsWith('https://'))throw new Error('rehearsal_target_https_required');
  const identity=await api.current();const buyerSeat=buyerInstance(identity);
  if(!SEAT.test(buyerSeat??''))throw new Error('rehearsal_buyer_identity_missing');
  if(payeeBelongsToIdentity(payee,identity))throw new Error('rehearsal_buyer_must_be_different_principal');
  await api.join(roomId);

  const startCursor=await api.latestSequence(roomId);
  const request={type:'sledgewire.service.request.v1',request_id:requestId,service,input:{endpoint:targetEndpoint}};
  const firstPost=await api.post(roomId,JSON.stringify(request),{idempotencyKey:idempotencyUuid(`rehearsal-request:${requestId}:quote`)});
  const firstId=messageId(firstPost);if(!MESSAGE.test(firstId??''))throw new Error('rehearsal_initial_message_id_missing');
  const quoteReply=await waitForArenaReply(api,roomId,{after:Math.max(startCursor,messageSequence(firstPost)??0),replyTo:firstId,requestId,buyerSeat,timeoutMs});
  assertPaymentQuote(quoteReply.body,{requestId,roomId,payee,service,price});

  const payment=await api.pay(payee,price,{memo:quoteReply.body.memo,roomId,idempotencyKey:idempotencyUuid(`rehearsal-payment:${requestId}`)});
  const txnId=payment?.transfer?.id??payment?.id??null;if(!TXN.test(txnId??''))throw new Error('rehearsal_payment_transaction_missing');

  const paidRequest={...request,payment_txn_id:txnId};
  const paidPost=await api.post(roomId,JSON.stringify(paidRequest),{idempotencyKey:idempotencyUuid(`rehearsal-request:${requestId}:paid`)});
  const paidId=messageId(paidPost);if(!MESSAGE.test(paidId??''))throw new Error('rehearsal_paid_message_id_missing');
  const delivered=await waitForArenaReply(api,roomId,{after:Math.max(quoteReply.cursor,messageSequence(paidPost)??0),replyTo:paidId,requestId,buyerSeat,timeoutMs});
  const deliveryVerification=assertDelivery(delivered.body,{requestId,service,roomId,buyerSeat,txnId,price,publicKeyPem});

  const trace=await lookupTrace(delivered.body.trace_id);
  if(trace?.service!=='sledgewire.trace'||trace.trace_id!==delivered.body.trace_id||trace.state!=='READY')throw new Error(`rehearsal_trace_proof_unavailable:${trace?.reason??trace?.state??'unknown'}`);
  const traceVerification=verifyReceipt(trace,publicKeyPem);if(!traceVerification.ok)throw new Error(`rehearsal_trace_signature_invalid:${traceVerification.reason}`);
  if(!Array.isArray(trace.events)||trace.events.length<1)throw new Error('rehearsal_trace_has_no_events');

  const retryPost=await api.post(roomId,JSON.stringify(paidRequest),{idempotencyKey:idempotencyUuid(`rehearsal-request:${requestId}:retry`)});
  const retryId=messageId(retryPost);if(!MESSAGE.test(retryId??''))throw new Error('rehearsal_retry_message_id_missing');
  const replay=await waitForArenaReply(api,roomId,{after:Math.max(delivered.cursor,messageSequence(retryPost)??0),replyTo:retryId,requestId,buyerSeat,timeoutMs});
  assertDelivery(replay.body,{requestId,service,roomId,buyerSeat,txnId,price,publicKeyPem});
  if(!eqReceipt(delivered.body.receipt,replay.body.receipt)||delivered.body.trace_id!==replay.body.trace_id)throw new Error('rehearsal_retry_was_not_exact_cached_delivery');

  return {
    type:'sledgewire.live-rehearsal.v1',verified:true,service,price_credits:price,request_id:requestId,room_id:roomId,buyer_seat:buyerSeat,
    payment_txn_id:txnId,target_endpoint:targetEndpoint,public_base_url:publicBaseUrl,trace_id:delivered.body.trace_id,
    first_message_id:firstId,paid_message_id:paidId,retry_message_id:retryId,
    delivery_message_id:delivered.message.id,replay_message_id:replay.message.id,
    receipt:delivered.body.receipt,trace_proof:trace,
    checks:{payment_quote:true,native_transfer:true,signed_delivery:deliveryVerification.ok,sharedos_trace:true,trace_signature:traceVerification.ok,exact_cached_retry:true},
    completed_at:new Date().toISOString()
  };
}
