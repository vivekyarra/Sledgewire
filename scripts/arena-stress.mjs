import {ArenaStore} from '../src/store/arena-store.mjs';
import {PaymentGate,paymentMemo} from '../src/core/payment-gate.mjs';

const n=Number(process.argv[2]??1000);
const room='rom_ABCDEFGHIJ',buyer='i_ABCDEFGHIJ',payee='p_ABCDEFGHIJ',service='sledgewire.smoke',price=3;
const store=new ArenaStore(':memory:');
const ledger={async get(txnId){const i=Number(txnId.split('_').at(-1));if(!Number.isInteger(i))return null;const requestId=`req-${i}`;return {id:txnId,buyer_instance_id:buyer,payee_ok:true,amount:price,room_id:room,memo:paymentMemo(requestId,service)};}};
const gate=new PaymentGate({ledger,store,prices:{[service]:price},payee});
const started=Date.now();let claimed=0,cached=0,rejected=0;
for(let i=0;i<n;i++){const req={roomId:room,buyerSeat:buyer,requestId:`req-${i}`,service,input:{endpoint:`https://example.com/${i}`},txnId:`txn_${i}`};const a=await gate.authorize(req);if(!a.ok||a.replay)throw new Error(`claim_failed_${i}:${a.reason}`);claimed++;store.complete(req.requestId,a.fingerprint,{ok:true,i});}
for(let i=0;i<n;i++){const req={roomId:room,buyerSeat:buyer,requestId:`req-${i}`,service,input:{endpoint:`https://example.com/${i}`},txnId:`txn_${i}`};const a=await gate.authorize(req);if(!a.ok||!a.replay||a.cached.i!==i)throw new Error(`replay_failed_${i}`);cached++;}
for(let i=0;i<Math.min(n,500);i++){const req={roomId:room,buyerSeat:'i_ZYXWVUTSRQ',requestId:`req-${i}`,service,input:{endpoint:`https://example.com/${i}`},txnId:`txn_${i}`};const a=await gate.authorize(req);if(a.ok||a.reason!=='wrong_buyer')throw new Error(`wrong_buyer_not_rejected_${i}`);rejected++;}
const result={requests:n,claimed,cached_retries:cached,wrong_buyer_rejected:rejected,duration_ms:Date.now()-started,duplicate_paid_executions:0};
console.log(JSON.stringify(result,null,2));
if(claimed!==n||cached!==n||rejected!==Math.min(n,500))process.exit(1);
