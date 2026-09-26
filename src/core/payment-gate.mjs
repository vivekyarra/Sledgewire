import {sha256} from '../receipts/receipt.mjs';

export function paymentMemo(requestId,service){return `sledgewire:${requestId}:${service}`;}
export function requestFingerprint({roomId,buyerSeat,requestId,service,input}){return sha256({roomId,buyerSeat,requestId,service,input});}
export function requestStorageKey({roomId,buyerSeat,requestId}){return `rqk_${sha256({roomId,buyerSeat,requestId})}`;}
function principalAddress(x){return typeof x==='string'&&(x.startsWith('p_')||x.startsWith('pri_'));}

export class PaymentGate{
  constructor({ledger,store,prices,payee,uncertainAfterMs=120_000,ledgerPositiveTtlMs=30_000,ledgerNegativeTtlMs=500,ledgerCacheMax=2048}){
    this.ledger=ledger;this.store=store;this.prices=prices;this.payee=payee;this.uncertainAfterMs=uncertainAfterMs;
    this.ledgerPositiveTtlMs=ledgerPositiveTtlMs;this.ledgerNegativeTtlMs=ledgerNegativeTtlMs;this.ledgerCacheMax=ledgerCacheMax;
    this.txCache=new Map();this.txInflight=new Map();
  }
  async lookupTransaction(txnId,signal){
    const now=Date.now(),cached=this.txCache.get(txnId);
    if(cached&&cached.expiresAt>now){this.txCache.delete(txnId);this.txCache.set(txnId,cached);return cached.value;}
    if(cached)this.txCache.delete(txnId);
    if(this.txInflight.has(txnId))return this.txInflight.get(txnId);
    const pending=Promise.resolve().then(()=>this.ledger.get(txnId,signal)).then(value=>{
      const ttl=value?this.ledgerPositiveTtlMs:this.ledgerNegativeTtlMs;
      this.txCache.set(txnId,{value,expiresAt:Date.now()+ttl});
      while(this.txCache.size>this.ledgerCacheMax)this.txCache.delete(this.txCache.keys().next().value);
      return value;
    }).finally(()=>this.txInflight.delete(txnId));
    this.txInflight.set(txnId,pending);return pending;
  }
  async authorize(req,signal){
    const price=this.prices[req.service];
    if(!Number.isInteger(price)||price<=0)return {ok:false,reason:'unknown_or_free_service'};
    if(!req.txnId)return {ok:false,reason:'payment_required',price,memo:paymentMemo(req.requestId,req.service)};

    const fp=requestFingerprint(req),storageKey=requestStorageKey(req);
    const prior=this.store.inspectClaim?.({requestId:storageKey,txnId:req.txnId,fingerprint:fp,service:req.service,buyerSeat:req.buyerSeat});
    if(prior&&prior.status!=='missing'&&prior.status!=='unattributed'){
      if(prior.status==='conflict')return {ok:false,reason:'transaction_or_request_reused'};
      if(prior.status==='inflight'){
        if((prior.ageMs??0)>=this.uncertainAfterMs)return {ok:false,reason:'execution_outcome_unknown_no_retry',fingerprint:fp,storageKey,started_at:prior.startedAt,age_ms:prior.ageMs};
        return {ok:false,reason:'request_already_inflight',fingerprint:fp,storageKey,started_at:prior.startedAt,age_ms:prior.ageMs};
      }
      if(prior.status==='failed')return {ok:false,reason:'previous_attempt_failed',fingerprint:fp,storageKey,error:prior.error};
      if(prior.status==='replay')return {ok:true,replay:true,fingerprint:fp,storageKey,cached:prior.response,price};
    }

    const tx=await this.lookupTransaction(req.txnId,signal);
    if(!tx)return {ok:false,reason:'transaction_not_found'};
    if(tx.id!==undefined&&tx.id!==null&&tx.id!==req.txnId)return {ok:false,reason:'wrong_transaction_id'};

    const memo=paymentMemo(req.requestId,req.service);
    const buyer=tx.buyer_instance_id??tx.by_instance_id??tx.sender_instance_id??tx.from_instance_id;
    if(buyer!==req.buyerSeat)return {ok:false,reason:'wrong_buyer'};

    const addressed=tx.addressed_to??tx.to??null;
    if(addressed!==null){
      if(addressed!==this.payee)return {ok:false,reason:'wrong_payee'};
    }else if(!(principalAddress(this.payee)&&tx.payee_ok===true)){
      return {ok:false,reason:'payee_address_unproven'};
    }

    if(!Number.isInteger(Number(tx.amount))||Number(tx.amount)!==price)return {ok:false,reason:'wrong_amount'};
    if(tx.room_id!==req.roomId)return {ok:false,reason:'wrong_room'};
    if(tx.memo!==memo)return {ok:false,reason:'wrong_memo'};

    const claim=this.store.claim({requestId:storageKey,txnId:req.txnId,fingerprint:fp,service:req.service,buyerSeat:req.buyerSeat});
    if(claim.status==='conflict')return {ok:false,reason:'transaction_or_request_reused'};
    if(claim.status==='inflight'){
      if((claim.ageMs??0)>=this.uncertainAfterMs)return {ok:false,reason:'execution_outcome_unknown_no_retry',fingerprint:fp,storageKey,started_at:claim.startedAt,age_ms:claim.ageMs};
      return {ok:false,reason:'request_already_inflight',fingerprint:fp,storageKey,started_at:claim.startedAt,age_ms:claim.ageMs};
    }
    if(claim.status==='failed')return {ok:false,reason:'previous_attempt_failed',fingerprint:fp,storageKey,error:claim.error};
    if(claim.status==='replay')return {ok:true,replay:true,fingerprint:fp,storageKey,cached:claim.response,price};
    return {ok:true,replay:false,fingerprint:fp,storageKey,price};
  }
}
