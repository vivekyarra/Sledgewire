import catalog from '../../catalog.json' with {type:'json'};
import {PaymentGate} from '../core/payment-gate.mjs';
import {quote} from '../core/quote.mjs';
import {validateServiceInput} from '../core/service-input.mjs';
import {runPaidService} from '../sharedos/host.mjs';
import {signReceipt} from '../receipts/receipt.mjs';
import {SEAT} from './api.mjs';
import {PAYMENT_QUOTE_TTL_MS} from '../store/arena-store.mjs';

const REQUEST_ID=/^[A-Za-z0-9][A-Za-z0-9._-]{2,95}$/;
const ROOM_MESSAGE_MAX_BYTES=32_768;
const TOOL_TOKEN=/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function extractHttpsUrls(text){
  const found=String(text??'').match(/https:\/\/[^\s<>"'`]+/gi)??[];
  return [...new Set(found.map(x=>x.replace(/[),.;!?]+$/g,'')).filter(Boolean))].slice(0,6);
}
function requestedTool(text){
  const m=String(text??'').match(/\btool\s*(?:=|:)?\s*([A-Za-z0-9][A-Za-z0-9._-]{0,127})\b/i);
  return m&&TOOL_TOKEN.test(m[1])?m[1]:null;
}
function intentFromText(text,urlCount=0){
  const t=String(text??'');
  if(/\b(gauntlet|dossier|full[ -]?dossier|strongest)\b/i.test(t))return 'full_dossier';
  if(urlCount>1||/\b(compare|fleet|choose|multiple|several)\b/i.test(t))return 'compare';
  if(/\b(repair|invoke|execute|schema[ -]?mismatch|fix[ -]?and[ -]?run)\b/i.test(t))return 'repair_execute';
  if(/\b(assay|adversarial|security|attack|replay|hostile|malformed)\b/i.test(t))return 'adversarial';
  if(/\b(seal|certif(?:y|ication)|conformance|portable[ -]?proof)\b/i.test(t))return 'certify';
  if(/\b(smoke|preflight|check|test|validate)\b/i.test(t))return 'preflight';
  return null;
}
function compactQuoteFromText(text,urls){
  const intent=intentFromText(text,urls.length);
  if(!intent||urls.length===0)return null;
  if(intent==='compare')return quote({intent,targets:urls.map(endpoint=>({endpoint}))});
  return quote({intent,endpoint:urls[0],tool:requestedTool(text)});
}

export function createArenaHandler({store,ledger,room,payee,signing,publicBaseUrl,runService=runPaidService}){
  const prices=Object.fromEntries(Object.entries(catalog.services).map(([k,v])=>[k,v.price])),gate=new PaymentGate({ledger,store,prices,payee});
  const base=String(publicBaseUrl??'').replace(/\/$/,'');
  const quickstart=`${base}/arena.md`,mcp=`${base}/mcp`;

  function info(kind,message,extra={}){
    store.incrementCounter(`arena.info.${kind}`);
    return {type:'sledgewire.info.v1',kind,message,quickstart,mcp,...extra};
  }
  async function serve(req,buyerSeat){
    if(typeof req.request_id!=='string'||!REQUEST_ID.test(req.request_id)){store.incrementCounter('arena.reject.invalid_request_id');return failure(req,'invalid_request_id');}
    if(!catalog.services[req.service]||catalog.services[req.service].price<=0){store.incrementCounter('arena.reject.unknown_or_free_service');return failure(req,'unknown_or_free_service');}
    const validation=validateServiceInput(req.service,req.input);
    if(!validation.ok){store.incrementCounter('arena.reject.invalid_input');return failure(req,'invalid_input',{detail:validation.reason});}

    if(!req.payment_txn_id){
      const bound={roomId:room,buyerSeat,requestId:req.request_id,service:req.service,input:req.input};
      const q=gate.issueQuote(bound);
      if(q.reason!=='payment_required'){
        store.incrementCounter(`arena.reject.${String(q.reason).replace(/[^a-z0-9_.-]/gi,'_').slice(0,80)}`);
        return failure(req,q.reason,q);
      }
      store.incrementCounter('arena.payment_quote.issued');
      return signReceipt({
        type:'sledgewire.payment_required.v1',
        request_id:req.request_id,
        service:req.service,
        request_fingerprint:q.fingerprint,
        price_credits:q.price,
        deliverable:catalog.services[req.service].description,
        payee,
        memo:q.memo,
        memo_version:'trial-zero-product-name.v1',
        request_binding:'signed_quote+durable_fingerprint.v1',
        room_id:room,
        buyer_seat:buyerSeat,
        issued_at:q.quote_issued_at??new Date().toISOString(),
        expires_at:q.quote_expires_at??null,
        quote_ttl_seconds:Math.floor(PAYMENT_QUOTE_TTL_MS/1000),
        quickstart_url:quickstart,
        next_action:{type:'sharednet.credit.transfer',amount_credits:q.price,payee,room_id:room,memo:q.memo,after_payment:'resend identical request with payment_txn_id'},
        verification:{receipt_tool:'sledgewire.verify',trace_tool:'sledgewire.trace',exact_retry_no_reexecution:true,request_fingerprint:q.fingerprint},
        note:'Trial Zero native memo is the product name Sledgewire. The signed quote and durable quote binding separately lock Room, buyer, request id, service and exact input; altered paid resends are rejected.'
      },signing.privateKeyPem);
    }

    const auth=await gate.authorize({roomId:room,buyerSeat,requestId:req.request_id,service:req.service,input:req.input,txnId:req.payment_txn_id});
    if(!auth.ok){store.incrementCounter(`arena.reject.${String(auth.reason).replace(/[^a-z0-9_.-]/gi,'_').slice(0,80)}`);if(auth.reason==='previous_attempt_failed'&&auth.error?.response)return auth.error.response;return failure(req,auth.reason,auth);}
    if(auth.replay){store.incrementCounter('arena.delivery.replay');return auth.cached;}

    try{
      // SharedOS grant ids are derived from the request fingerprint, not the buyer-supplied
      // request_id, so two different buyers can safely choose the same request label.
      const result=await runService({service:req.service,input:req.input,store,requestId:auth.fingerprint,fingerprint:auth.fingerprint,buyerSeat});
      const outcome=result.state??'UNKNOWN';
      const receipt=signReceipt({...result,request_id:req.request_id,receipt_version:'sledgewire.receipt.v3',issued_at:new Date().toISOString(),payment:{txn_id:req.payment_txn_id,price_credits:auth.price,room_id:room}},signing.privateKeyPem);
      const response={
        type:'sledgewire.service.response.v1',
        request_id:req.request_id,
        service:req.service,
        state:'DELIVERED',
        outcome_state:outcome,
        trace_id:result.sharedos_trace_id,
        summary:{headline:`${req.service} completed with factual outcome ${outcome}`,signed_receipt:true,sharedos_trace:Boolean(result.sharedos_trace_id)},
        verification:{receipt_tool:'sledgewire.verify',trace_tool:result.sharedos_trace_id?'sledgewire.trace':null,exact_retry_no_reexecution:true},
        receipt
      };
      store.complete(auth.storageKey,auth.fingerprint,response);
      store.incrementCounter('arena.delivery.completed');
      return response;
    }catch(e){
      const detail=String(e.message||e);
      const receipt=signReceipt({service:req.service,state:'FAILED',reason:'execution_failed',detail,request_id:req.request_id,request_fingerprint:auth.fingerprint,buyer_seat:buyerSeat,receipt_version:'sledgewire.receipt.v3',issued_at:new Date().toISOString(),payment:{txn_id:req.payment_txn_id,price_credits:auth.price,room_id:room}},signing.privateKeyPem);
      const response={type:'sledgewire.service.response.v1',request_id:req.request_id,service:req.service,state:'FAILED',reason:'execution_failed',summary:{headline:`${req.service} failed during execution; the paid failure is signed and exact retries do not execute again`,signed_receipt:true},verification:{receipt_tool:'sledgewire.verify',exact_retry_no_reexecution:true},receipt};
      store.fail(auth.storageKey,auth.fingerprint,{message:detail,response});
      store.incrementCounter('arena.delivery.failed');
      return response;
    }
  }

  return async function handle(message){
    const content=typeof message?.content==='string'?message.content:'';
    if(Buffer.byteLength(content,'utf8')>ROOM_MESSAGE_MAX_BYTES){store.incrementCounter('arena.reject.message_too_large');return null;}
    const buyerSeat=message?.sender_instance_id??message?.sender?.instance_id??message?.sender?.member_id;
    if(!SEAT.test(buyerSeat??''))return null;

    let req=null;try{req=JSON.parse(content);}catch{}
    if(req?.type==='sledgewire.service.request.v1')return serve(req,buyerSeat);
    if(req?.type==='sledgewire.quote.request.v1'){
      store.incrementCounter('arena.quote.typed');
      try{return {type:'sledgewire.quote.response.v1',request_id:req.request_id??null,...quote(req)};}
      catch(e){return {type:'sledgewire.quote.response.v1',request_id:req.request_id??null,state:'FAILED',reason:String(e.message||e)};}
    }

    const text=content.trim();
    if(!/(^|\s)@?sledgewire\b/i.test(text))return null;

    const urls=extractHttpsUrls(text),naturalQuote=compactQuoteFromText(text,urls);
    if(naturalQuote){
      store.incrementCounter('arena.quote.natural');
      return {type:'sledgewire.quote.response.v1',request_id:null,source:'natural_language',...naturalQuote};
    }

    if(/\b(price|cost|credits|buy|service|catalog|menu|recommend|which)\b/i.test(text))return info('pricing','Free selector: sledgewire.quote. Paid menu: Smoke 3, Assay 8, Invoke 12, Fleet 20, Seal 25, Gauntlet 35 credits.',{call_now:{tool:'sledgewire.quote',arguments:{intent:'preflight',endpoint:'<target-mcp-url>'}},best_first_paid:{service:'sledgewire.smoke',credits:3}});
    if(/\b(demo|prove|proof|selfcheck|show)\b/i.test(text))return info('demo','Fastest proof is free: call sledgewire.selfcheck {}. It runs current-protocol plus hostile fixtures and returns a signed receipt.',{call_now:{tool:'sledgewire.selfcheck',arguments:{}},verification:'Verify the returned Ed25519 receipt; paid receipts also expose a SharedOS trace id.'});
    if(/\b(sharedos|permission|authority|grant|sandbox)\b/i.test(text))return info('sharedos','Paid target work uses deny-by-default, exact-scope, purpose-bound SharedOS grants. Dispatcher has no target execution grant; Scout, Mechanic, Inspector and Breaker have separated authority.',{authority_map:`${base}/arena.json`,trace_tool:'sledgewire.trace'});
    if(/\b(verify|receipt|signature|trace|audit)\b/i.test(text))return info('verification','Every delivery is signed. Use sledgewire.verify for the receipt; paid receipts carry sharedos_trace_id for free sledgewire.trace proof.',{receipt_tool:'sledgewire.verify',trace_tool:'sledgewire.trace',public_key:`${base}/public-key`});
    if(/\b(limit|scope|support|compatible|compatibility)\b/i.test(text))return info('scope','Sledgewire is intentionally focused on MCP services. READY means only the recorded checks passed for that target at that time; active/destructive actions require explicit authority.',{protocols:['2026-07-28','2025-11-25','2025-06-18'],states:['READY','DEGRADED','INCOMPATIBLE','BLOCKED','UNKNOWN']});
    if(/\b(why|value|trust|benefit|different|useful)\b/i.test(text))return info('value','Sledgewire gives an agent pre-spend evidence instead of a trust claim: real MCP checks, bounded repair, exact SharedOS authority, signed receipts, inspectable traces, and duplicate-safe paid retries.',{try_free:{tool:'sledgewire.selfcheck',arguments:{}},first_paid:{service:'sledgewire.smoke',credits:3}});
    if(/\b(help|how|call|start|quickstart|endpoint)\b/i.test(text))return info('quickstart','Open the one-link quickstart, call free selfcheck or quote, then send the returned paid request in the official Arena Room before paying.',{call_now:{tool:'sledgewire.selfcheck',arguments:{}},quote_example:{tool:'sledgewire.quote',arguments:{intent:'preflight',endpoint:'<target-mcp-url>'}}});
    return info('overview','Sledgewire adversarially tests MCP services before an agent trusts or buys them, repairs only evidence-backed structural mismatches, executes paid work through SharedOS, and returns signed receipts another agent can verify.',{try_free:{tool:'sledgewire.selfcheck',arguments:{}},best_first_paid:{service:'sledgewire.smoke',credits:3}});
  };
}
function failure(req,reason,extra={}){return {type:'sledgewire.service.response.v1',request_id:req?.request_id??null,service:req?.service??null,state:'FAILED',reason,...extra};}
