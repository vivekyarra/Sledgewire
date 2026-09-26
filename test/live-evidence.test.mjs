import test from 'node:test';
import assert from 'node:assert/strict';
import {generateSigningKeypair,signReceipt} from '../src/receipts/receipt.mjs';
import {validateLiveRehearsalEvidence,validateRestartReplayEvidence} from '../src/ops/live-evidence.mjs';

const room='rom_ABCDEFGHIJ',buyer='i_ZYXWVUTSRQ',txn='txn_ABCDEFGHIJ';
const oldBoot='123e4567-e89b-42d3-a456-426614174000',newBoot='223e4567-e89b-42d3-a456-426614174001';
const traceId='11111111-1111-4111-8111-111111111111',base='https://sledgewire.example';

function evidence(){
  const kp=generateSigningKeypair();
  const quote=signReceipt({type:'sledgewire.payment_required.v1',request_id:'rehearsal-fixed',service:'sledgewire.smoke',price_credits:3,payee:'p_ABCDEFGHIJ',memo:'sledgewire:rehearsal-fixed:sledgewire.smoke',room_id:room,buyer_seat:buyer,issued_at:'2026-09-26T00:00:00.000Z'},kp.privateKeyPem);
  const receipt=signReceipt({service:'sledgewire.smoke',state:'READY',sharedos_trace_id:traceId,buyer_seat:buyer,request_id:'rehearsal-fixed',payment:{txn_id:txn,price_credits:3,room_id:room}},kp.privateKeyPem);
  const trace=signReceipt({service:'sledgewire.trace',state:'READY',trace_id:traceId,events:[{type:'tool',outcome:'allowed'}]},kp.privateKeyPem);
  const live={type:'sledgewire.live-rehearsal.v3',verified:true,service:'sledgewire.smoke',price_credits:3,request_id:'rehearsal-fixed',room_id:room,buyer_seat:buyer,provider_boot_id:oldBoot,payment_txn_id:txn,target_endpoint:'https://target.example/mcp',public_base_url:base,trace_id:traceId,first_message_id:'msg_ABCDEFGHIJ',paid_message_id:'msg_BCDEFGHIJK',retry_message_id:'msg_CDEFGHIJKL',delivery_message_id:'msg_DEFGHIJKLM',replay_message_id:'msg_EFGHIJKLMN',payment_quote:quote,receipt,trace_proof:trace,checks:{payment_quote:true,signed_payment_quote:true,native_transfer:true,signed_delivery:true,sharedos_trace:true,trace_signature:true,exact_cached_retry:true}};
  const restart={type:'sledgewire.restart-replay-proof.v2',verified:true,request_id:live.request_id,room_id:room,buyer_seat:buyer,payment_txn_id:txn,previous_boot_id:oldBoot,current_boot_id:newBoot,trace_id:traceId,replay_message_id:'msg_FGHIJKLMNO',delivery_message_id:'msg_GHIJKLMNOP',receipt,trace_proof:trace,checks:{daemon_boot_changed:true,signing_key_persisted:true,cached_delivery_identical:true,shared_db_trace_persisted:true,no_second_payment:true}};
  return {kp,live,restart};
}

test('live evidence validator requires signed request-scoped payment and trace proof',()=>{
  const {kp,live}=evidence();
  const r=validateLiveRehearsalEvidence(live,{roomId:room,payee:'p_ABCDEFGHIJ',publicBaseUrl:base,publicKeyPem:kp.publicKeyPem});
  assert.equal(r.ok,true);
  const tampered=structuredClone(live);tampered.receipt.payment.price_credits=35;
  assert.equal(validateLiveRehearsalEvidence(tampered,{roomId:room,payee:'p_ABCDEFGHIJ',publicBaseUrl:base,publicKeyPem:kp.publicKeyPem}).ok,false);
  const badQuote=structuredClone(live);badQuote.payment_quote.payee='p_ZYXWVUTSRQ';
  assert.equal(validateLiveRehearsalEvidence(badQuote,{roomId:room,payee:'p_ABCDEFGHIJ',publicBaseUrl:base,publicKeyPem:kp.publicKeyPem}).ok,false);
});

test('restart evidence must carry the identical signed receipt and match the current daemon boot',()=>{
  const {kp,live,restart}=evidence();
  assert.equal(validateRestartReplayEvidence(restart,{roomId:room,rehearsal:live,publicKeyPem:kp.publicKeyPem,currentBootId:newBoot}).ok,true);
  assert.equal(validateRestartReplayEvidence(restart,{roomId:room,rehearsal:live,publicKeyPem:kp.publicKeyPem,currentBootId:'323e4567-e89b-42d3-a456-426614174002'}).reason,'restart_replay_not_current_daemon_boot');
  const changed=structuredClone(restart);const {proof:_,...receiptBody}=live.receipt;changed.receipt=signReceipt({...receiptBody,issued_at:'different'},kp.privateKeyPem);
  assert.equal(validateRestartReplayEvidence(changed,{roomId:room,rehearsal:live,publicKeyPem:kp.publicKeyPem,currentBootId:newBoot}).reason,'restart_replay_receipt_not_identical');
});
