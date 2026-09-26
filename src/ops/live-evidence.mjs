import {MESSAGE,SEAT,TXN} from '../sharednet/api.mjs';
import {verifyReceipt} from '../receipts/receipt.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LIVE_CHECKS=['payment_quote','native_transfer','signed_delivery','sharedos_trace','trace_signature','exact_cached_retry'];
const RESTART_CHECKS=['daemon_boot_changed','signing_key_persisted','cached_delivery_identical','shared_db_trace_persisted','no_second_payment'];

function fail(reason){return {ok:false,reason};}
function checksAllTrue(value,names){return value&&names.every(name=>value[name]===true);}
function sameReceipt(a,b){return Boolean(a?.proof?.signature)&&a.proof.signature===b?.proof?.signature&&a?.proof?.body_sha256===b?.proof?.body_sha256;}
function signedTraceOk(trace,traceId,publicKeyPem){
  if(trace?.service!=='sledgewire.trace'||trace?.state!=='READY'||trace?.trace_id!==traceId||!Array.isArray(trace?.events)||trace.events.length<1)return false;
  return verifyReceipt(trace,publicKeyPem).ok;
}

export function validateLiveRehearsalEvidence(evidence,{roomId,publicBaseUrl,publicKeyPem}={}){
  if(evidence?.type!=='sledgewire.live-rehearsal.v2'||evidence?.verified!==true)return fail('invalid_live_rehearsal_type');
  if(evidence.room_id!==roomId)return fail('live_rehearsal_room_mismatch');
  if(evidence.public_base_url!==publicBaseUrl)return fail('live_rehearsal_public_base_mismatch');
  if(evidence.service!=='sledgewire.smoke'||Number(evidence.price_credits)!==3)return fail('live_rehearsal_service_or_price_mismatch');
  if(!SEAT.test(evidence.buyer_seat??''))return fail('live_rehearsal_buyer_invalid');
  if(!TXN.test(evidence.payment_txn_id??''))return fail('live_rehearsal_transaction_invalid');
  if(!UUID.test(String(evidence.provider_boot_id??'')))return fail('live_rehearsal_provider_boot_invalid');
  for(const name of ['first_message_id','paid_message_id','retry_message_id','delivery_message_id','replay_message_id']){
    if(!MESSAGE.test(evidence[name]??''))return fail(`live_rehearsal_${name}_invalid`);
  }
  if(!checksAllTrue(evidence.checks,LIVE_CHECKS))return fail('live_rehearsal_checks_incomplete');
  const receiptCheck=verifyReceipt(evidence.receipt,publicKeyPem);if(!receiptCheck.ok)return fail(`live_rehearsal_receipt_${receiptCheck.reason}`);
  if(evidence.receipt?.buyer_seat!==evidence.buyer_seat)return fail('live_rehearsal_receipt_buyer_mismatch');
  if(evidence.receipt?.payment?.txn_id!==evidence.payment_txn_id||evidence.receipt?.payment?.room_id!==roomId||Number(evidence.receipt?.payment?.price_credits)!==3)return fail('live_rehearsal_receipt_payment_mismatch');
  if(evidence.receipt?.sharedos_trace_id!==evidence.trace_id)return fail('live_rehearsal_trace_mismatch');
  if(!signedTraceOk(evidence.trace_proof,evidence.trace_id,publicKeyPem))return fail('live_rehearsal_trace_proof_invalid');
  return {ok:true,reason:null,request_id:evidence.request_id,buyer_seat:evidence.buyer_seat,txn_id:evidence.payment_txn_id,boot_id:evidence.provider_boot_id};
}

export function validateRestartReplayEvidence(evidence,{roomId,rehearsal,publicKeyPem,currentBootId=null}={}){
  if(evidence?.type!=='sledgewire.restart-replay-proof.v1'||evidence?.verified!==true)return fail('invalid_restart_replay_type');
  if(evidence.room_id!==roomId||evidence.room_id!==rehearsal?.room_id)return fail('restart_replay_room_mismatch');
  if(evidence.request_id!==rehearsal?.request_id||evidence.buyer_seat!==rehearsal?.buyer_seat||evidence.payment_txn_id!==rehearsal?.payment_txn_id||evidence.trace_id!==rehearsal?.trace_id)return fail('restart_replay_scope_mismatch');
  if(evidence.previous_boot_id!==rehearsal?.provider_boot_id||!UUID.test(String(evidence.previous_boot_id??''))||!UUID.test(String(evidence.current_boot_id??''))||evidence.current_boot_id===evidence.previous_boot_id)return fail('restart_replay_boot_mismatch');
  if(currentBootId!==null&&evidence.current_boot_id!==currentBootId)return fail('restart_replay_not_current_daemon_boot');
  if(!MESSAGE.test(evidence.replay_message_id??'')||!MESSAGE.test(evidence.delivery_message_id??''))return fail('restart_replay_message_invalid');
  if(!checksAllTrue(evidence.checks,RESTART_CHECKS))return fail('restart_replay_checks_incomplete');
  const receiptCheck=verifyReceipt(evidence.receipt,publicKeyPem);if(!receiptCheck.ok)return fail(`restart_replay_receipt_${receiptCheck.reason}`);
  if(!sameReceipt(evidence.receipt,rehearsal?.receipt))return fail('restart_replay_receipt_not_identical');
  if(!signedTraceOk(evidence.trace_proof,evidence.trace_id,publicKeyPem))return fail('restart_replay_trace_proof_invalid');
  return {ok:true,reason:null,current_boot_id:evidence.current_boot_id};
}
