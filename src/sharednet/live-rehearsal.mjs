import {idempotencyUuid,MESSAGE,SEAT,TXN,payeeBelongsToIdentity} from './api.mjs';
import {paymentMemo} from '../core/payment-gate.mjs';
import {verifyReceipt} from '../receipts/receipt.mjs';
import {publicBaseOrigin} from '../ops/config.mjs';

function sequenceOf(x){const n=Number(x?.sequence);return Number.isSafeInteger(n)&&n>=0?n:null;}
function parseJsonMessage(message){if(typeof message?.content!=='string')return null;try{return JSON.parse(message.content);}catch{return null;}}
function messageId(result){return result?.message?.id??result?.id??null;}
function messageSequence(result){return sequenceOf(result?.message??result);}
function buyerInstance(identity){return identity?.instance?.id??identity?.instance_id??null;}
function eqReceipt(a,b){return a?.proof?.signature&&a.proof.signature===b?.proof?.signature&&a?.proof?.body_sha256===b?.proof?.body_sha256;}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function assertPaymentQuote(body,{requestId,roomId,payee,service,price,buyerSeat,publicKeyPem}){
  if(body?.type!=='sledgewire.payment_required.v1')throw new Error('rehearsal_missing_payment_required');
  if(body.request_id!==requestId||body.service!==service)throw new Error('rehearsal_quote_request_mismatch');
  if(body.room_id!==roomId||body.payee!==payee)throw new Error('rehearsal_quote_destination_mismatch');
  if(body.buyer_seat!==buyerSeat)throw new Error('rehearsal_quote_buyer_mismatch');
  if(Number(body.price_credits)!==price)throw new Error('rehearsal_quote_price_mismatch');
  if(body.memo!==paymentMemo(requestId,service))throw new Error('rehearsal_quote_memo_mismatch');
  const verified=verifyReceipt(body,publicKeyPem);if(!verified.ok)throw new Error(`rehearsal_quote_signature_invalid:${verified.reason}`);
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

export async function runLiveSmokeRehearsal({api,roomId,payee,publicBaseUrl,targetEndpoint,publicKeyPem,lookupTrace,providerBootId=null,requestId=`rehearsal-${crypto.randomUUID()}`,timeoutMs=120_000}){
  const service='sledgewire.smoke',price=3;
  if(publicBaseOrigin(publicBaseUrl,{production:true})!==publicBaseUrl)throw new Error('rehearsal_public_base_not_canonical');
  if(typeof targetEndpoint!=='string'||!targetEndpoint.startsWith('https://'))throw new Error('rehearsal_target_https_required');
  if(providerBootId!==null&&!UUID.test(String(providerBootId)))throw new Error('rehearsal_provider_boot_id_invalid');
  const identity=await api.current();const buyerSeat=buyerInstance(identity);
  if(!SEAT.test(buyerSeat??''))throw new Error('rehearsal_buyer_identity_missing');
  if(payeeBelongsToIdentity(payee,identity))throw new Error('rehearsal_buyer_must_be_different_principal');
  await api.join(roomId);

  const startCursor=await api.latestSequence(roomId);
  const request={type:'sledgewire.service.request.v1',request_id:requestId,service,input:{endpoint:targetEndpoint}};
  const firstPost=await api.post(roomId,JSON.stringify(request),{idempotencyKey:idempotencyUuid(`rehearsal-request:${requestId}:quote`)});
  const firstId=messageId(firstPost);if(!MESSAGE.test(firstId??''))throw new Error('rehearsal_initial_message_id_missing');
  const quoteReply=await waitForArenaReply(api,roomId,{after:Math.max(startCursor,messageSequence(firstPost)??0),replyTo:firstId,requestId,buyerSeat,timeoutMs});
  assertPaymentQuote(quoteReply.body,{requestId,roomId,payee,service,price,buyerSeat,publicKeyPem});

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
    type:'sledgewire.live-rehearsal.v3',verified:true,service,price_credits:price,request_id:requestId,room_id:roomId,buyer_seat:buyerSeat,
    provider_boot_id:providerBootId,
    payment_txn_id:txnId,target_endpoint:targetEndpoint,public_base_url:publicBaseUrl,trace_id:delivered.body.trace_id,
    first_message_id:firstId,paid_message_id:paidId,retry_message_id:retryId,
    delivery_message_id:delivered.message.id,replay_message_id:replay.message.id,
    payment_quote:quoteReply.body,receipt:delivered.body.receipt,trace_proof:trace,
    checks:{payment_quote:true,signed_payment_quote:true,native_transfer:true,signed_delivery:deliveryVerification.ok,sharedos_trace:true,trace_signature:traceVerification.ok,exact_cached_retry:true},
    completed_at:new Date().toISOString()
  };
}


function assertPreviousEvidence(evidence,{roomId,buyerSeat,publicBaseUrl,publicKeyPem}){
  if(evidence?.type!=='sledgewire.live-rehearsal.v3'||evidence?.verified!==true)throw new Error('restart_proof_invalid_previous_evidence');
  if(evidence.room_id!==roomId||evidence.buyer_seat!==buyerSeat)throw new Error('restart_proof_scope_mismatch');
  if(evidence.public_base_url!==publicBaseUrl)throw new Error('restart_proof_public_base_mismatch');
  if(evidence.service!=='sledgewire.smoke'||Number(evidence.price_credits)!==3)throw new Error('restart_proof_service_mismatch');
  if(!TXN.test(evidence.payment_txn_id??''))throw new Error('restart_proof_transaction_invalid');
  if(!UUID.test(String(evidence.provider_boot_id??'')))throw new Error('restart_proof_previous_boot_id_missing');
  const oldVerified=verifyReceipt(evidence.receipt,publicKeyPem);if(!oldVerified.ok)throw new Error(`restart_proof_previous_receipt_invalid:${oldVerified.reason}`);
  if(evidence.receipt?.buyer_seat!==buyerSeat||evidence.receipt?.payment?.txn_id!==evidence.payment_txn_id||evidence.receipt?.payment?.room_id!==roomId)throw new Error('restart_proof_previous_receipt_scope_mismatch');
  if(evidence.receipt?.sharedos_trace_id!==evidence.trace_id)throw new Error('restart_proof_previous_trace_mismatch');
  return oldVerified;
}

export async function runRestartReplayProof({api,roomId,publicBaseUrl,publicKeyPem,previousEvidence,currentBootId,lookupTrace,timeoutMs=120_000}){
  if(!UUID.test(String(currentBootId??'')))throw new Error('restart_proof_current_boot_id_invalid');
  const identity=await api.current(),buyerSeat=buyerInstance(identity);
  if(!SEAT.test(buyerSeat??''))throw new Error('restart_proof_buyer_identity_missing');
  const previousVerification=assertPreviousEvidence(previousEvidence,{roomId,buyerSeat,publicBaseUrl,publicKeyPem});
  if(currentBootId===previousEvidence.provider_boot_id)throw new Error('provider_not_restarted_since_rehearsal');
  await api.join(roomId);

  const requestId=previousEvidence.request_id,service='sledgewire.smoke',price=3,txnId=previousEvidence.payment_txn_id,targetEndpoint=previousEvidence.target_endpoint;
  if(typeof targetEndpoint!=='string'||!targetEndpoint.startsWith('https://'))throw new Error('restart_proof_target_invalid');
  const paidRequest={type:'sledgewire.service.request.v1',request_id:requestId,service,input:{endpoint:targetEndpoint},payment_txn_id:txnId};
  const startCursor=await api.latestSequence(roomId);
  const post=await api.post(roomId,JSON.stringify(paidRequest),{idempotencyKey:idempotencyUuid(`rehearsal-restart:${requestId}:${currentBootId}`)});
  const postId=messageId(post);if(!MESSAGE.test(postId??''))throw new Error('restart_proof_message_id_missing');
  const replay=await waitForArenaReply(api,roomId,{after:Math.max(startCursor,messageSequence(post)??0),replyTo:postId,requestId,buyerSeat,timeoutMs});
  const deliveryVerification=assertDelivery(replay.body,{requestId,service,roomId,buyerSeat,txnId,price,publicKeyPem});
  if(!eqReceipt(previousEvidence.receipt,replay.body.receipt)||previousEvidence.trace_id!==replay.body.trace_id)throw new Error('restart_proof_not_cached_identical_delivery');

  const trace=await lookupTrace(previousEvidence.trace_id);
  if(trace?.service!=='sledgewire.trace'||trace.trace_id!==previousEvidence.trace_id||trace.state!=='READY')throw new Error(`restart_proof_trace_unavailable:${trace?.reason??trace?.state??'unknown'}`);
  const traceVerification=verifyReceipt(trace,publicKeyPem);if(!traceVerification.ok)throw new Error(`restart_proof_trace_signature_invalid:${traceVerification.reason}`);

  return {
    type:'sledgewire.restart-replay-proof.v2',verified:true,request_id:requestId,room_id:roomId,buyer_seat:buyerSeat,payment_txn_id:txnId,
    previous_boot_id:previousEvidence.provider_boot_id,current_boot_id:currentBootId,trace_id:previousEvidence.trace_id,
    replay_message_id:postId,delivery_message_id:replay.message.id,
    receipt:replay.body.receipt,trace_proof:trace,
    checks:{daemon_boot_changed:true,signing_key_persisted:previousVerification.ok,cached_delivery_identical:deliveryVerification.ok,shared_db_trace_persisted:traceVerification.ok,no_second_payment:true},
    completed_at:new Date().toISOString()
  };
}
