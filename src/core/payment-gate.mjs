import {sha256} from '../receipts/receipt.mjs';
export function paymentMemo(requestId,service){return `sledgewire:${requestId}:${service}`;}
export function requestFingerprint({roomId,buyerSeat,requestId,service,input}){return sha256({roomId,buyerSeat,requestId,service,input});}
export class PaymentGate{
  constructor({ledger,store,prices,payee,uncertainAfterMs=120_000}){this.ledger=ledger;this.store=store;this.prices=prices;this.payee=payee;this.uncertainAfterMs=uncertainAfterMs;}
  async authorize(req,signal){
    const price=this.prices[req.service];if(!Number.isInteger(price)||price<=0)return {ok:false,reason:'unknown_or_free_service'};
    if(!req.txnId)return {ok:false,reason:'payment_required',price,memo:paymentMemo(req.requestId,req.service)};
    const tx=await this.ledger.get(req.txnId,signal);if(!tx)return {ok:false,reason:'transaction_not_found'};
    const memo=paymentMemo(req.requestId,req.service),buyer=tx.buyer_instance_id??tx.by_instance_id??tx.sender_instance_id??tx.from_instance_id;
    if(buyer!==req.buyerSeat)return {ok:false,reason:'wrong_buyer'};
    const addressed=tx.addressed_to??tx.to;if(tx.payee_ok!==true&&addressed!==this.payee)return {ok:false,reason:'wrong_payee'};
    if(Number(tx.amount)!==price)return {ok:false,reason:'wrong_amount'};
    if(tx.room_id!==req.roomId)return {ok:false,reason:'wrong_room'};
    if(tx.memo!==memo)return {ok:false,reason:'wrong_memo'};
    const fp=requestFingerprint(req),claim=this.store.claim({requestId:req.requestId,txnId:req.txnId,fingerprint:fp,service:req.service});
    if(claim.status==='conflict')return {ok:false,reason:'transaction_or_request_reused'};
    if(claim.status==='inflight'){
      if((claim.ageMs??0)>=this.uncertainAfterMs)return {ok:false,reason:'execution_outcome_unknown_no_retry',fingerprint:fp,started_at:claim.startedAt,age_ms:claim.ageMs};
      return {ok:false,reason:'request_already_inflight',fingerprint:fp,started_at:claim.startedAt,age_ms:claim.ageMs};
    }
    if(claim.status==='failed')return {ok:false,reason:'previous_attempt_failed',fingerprint:fp,error:claim.error};
    if(claim.status==='replay')return {ok:true,replay:true,fingerprint:fp,cached:claim.response,price};
    return {ok:true,replay:false,fingerprint:fp,price};
  }
}
