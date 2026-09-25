import catalog from '../../catalog.json' with {type:'json'};
import {PaymentGate,paymentMemo} from '../core/payment-gate.mjs';
import {quote} from '../core/quote.mjs';
import {runPaidService} from '../sharedos/host.mjs';
import {signReceipt} from '../receipts/receipt.mjs';
import {SEAT} from './api.mjs';

const REQUEST_ID=/^[A-Za-z0-9][A-Za-z0-9._-]{2,95}$/;

export function createArenaHandler({store,ledger,room,payee,signing,publicBaseUrl}){
  const prices=Object.fromEntries(Object.entries(catalog.services).map(([k,v])=>[k,v.price])),gate=new PaymentGate({ledger,store,prices,payee});
  async function serve(req,buyerSeat){
    if(typeof req.request_id!=='string'||!REQUEST_ID.test(req.request_id))return failure(req,'invalid_request_id');
    if(!catalog.services[req.service]||catalog.services[req.service].price<=0)return failure(req,'unknown_or_free_service');
    if(!req.input||typeof req.input!=='object'||Array.isArray(req.input))return failure(req,'invalid_input');
    if(!req.payment_txn_id){
      const price=prices[req.service],memo=paymentMemo(req.request_id,req.service);
      return {type:'sledgewire.payment_required.v1',request_id:req.request_id,service:req.service,price_credits:price,payee,memo,room_id:room,note:'Pay in the official Arena room, then resend the identical request with payment_txn_id.'};
    }
    const auth=await gate.authorize({roomId:room,buyerSeat,requestId:req.request_id,service:req.service,input:req.input,txnId:req.payment_txn_id});
    if(!auth.ok)return failure(req,auth.reason,auth);if(auth.replay)return auth.cached;
    try{
      const result=await runPaidService({service:req.service,input:req.input,store,requestId:req.request_id,fingerprint:auth.fingerprint,buyerSeat});
      const receipt=signReceipt({...result,receipt_version:'sledgewire.receipt.v3',issued_at:new Date().toISOString(),payment:{txn_id:req.payment_txn_id,price_credits:auth.price,room_id:room}},signing.privateKeyPem);
      const response={type:'sledgewire.service.response.v1',request_id:req.request_id,service:req.service,state:'DELIVERED',outcome_state:result.state??'UNKNOWN',trace_id:result.sharedos_trace_id,receipt};
      store.complete(req.request_id,auth.fingerprint,response);return response;
    }catch(e){store.fail(req.request_id,auth.fingerprint,{message:String(e.message||e)});return failure(req,'execution_failed',{detail:String(e.message||e)});}
  }
  return async function handle(message){
    const buyerSeat=message?.sender_instance_id??message?.sender?.instance_id??message?.sender?.member_id;if(!SEAT.test(buyerSeat??''))return null;
    let req=null;try{req=JSON.parse(message.content);}catch{}
    if(req?.type==='sledgewire.service.request.v1')return serve(req,buyerSeat);
    if(req?.type==='sledgewire.quote.request.v1')return {type:'sledgewire.quote.response.v1',request_id:req.request_id??null,...quote(req)};
    const text=String(message.content??'').trim();if(!/(^|\s)@?sledgewire\b/i.test(text))return null;
    if(/\b(price|cost|credits|buy|service|catalog)\b/i.test(text))return {type:'sledgewire.info.v1',message:'Free selector: sledgewire.quote. Paid menu: Smoke 3, Assay 8, Invoke 12, Fleet 20, Seal 25, Gauntlet 35 credits.',quickstart:`${publicBaseUrl.replace(/\/$/,'')}/arena.md`};
    if(/\b(demo|prove|proof|selfcheck|show)\b/i.test(text))return {type:'sledgewire.info.v1',message:'Fastest proof is free: call sledgewire.selfcheck {} on the public MCP endpoint. It returns a signed hostile-fixture receipt.',quickstart:`${publicBaseUrl.replace(/\/$/,'')}/arena.md`};
    return {type:'sledgewire.info.v1',message:'Sledgewire adversarially tests MCP services, repairs only evidence-backed structural mismatches, executes paid work through SharedOS, and returns signed receipts. Start with free sledgewire.quote or selfcheck.',quickstart:`${publicBaseUrl.replace(/\/$/,'')}/arena.md`};
  };
}
function failure(req,reason,extra={}){return {type:'sledgewire.service.response.v1',request_id:req?.request_id??null,service:req?.service??null,state:'FAILED',reason,...extra};}
