import fs from 'node:fs';
import path from 'node:path';
import catalog from '../../catalog.json' with {type:'json'};
import {ArenaStore} from '../store/arena-store.mjs';
import {PaymentGate,paymentMemo} from '../core/payment-gate.mjs';
import {SharedNetCli,parseWatchBatch,SEAT,ADDRESS} from './cli.mjs';
import {runPaidService} from '../sharedos/host.mjs';
import {loadSigningMaterial,signReceipt} from '../receipts/receipt.mjs';

const seat=process.env.SHAREDNET_SEAT??'';const room=process.env.SHAREDNET_ROOM_ID??'';const payee=process.env.SHAREDNET_PAYEE_ADDRESS??'';
if(!SEAT.test(seat)||!ADDRESS.test(payee)||!room.startsWith('rom_'))throw new Error('sharednet_environment_incomplete');
const dbPath=process.env.SLEDGEWIRE_DB??'.sledgewire/arena.db';fs.mkdirSync(path.dirname(path.resolve(dbPath)),{recursive:true});
const store=new ArenaStore(dbPath);const ledger=new SharedNetCli({seatId:seat,roomId:room});const prices=Object.fromEntries(Object.entries(catalog.services).map(([k,v])=>[k,v.price]));const gate=new PaymentGate({ledger,store,prices,payee});const signing=loadSigningMaterial({production:true});
const raw=await new Promise((resolve,reject)=>{let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>resolve(s));process.stdin.on('error',reject);});
const batch=parseWatchBatch(raw);const responses=[];
for(const message of batch.messages){let req;try{req=JSON.parse(message.content);}catch{continue;}if(req?.type!=='sledgewire.service.request.v1')continue;const buyer=message.sender?.member_id;if(!SEAT.test(buyer??''))continue;responses.push(await serve(req,buyer).catch(e=>({type:'sledgewire.service.response.v1',request_id:req?.request_id??null,state:'FAILED',error:String(e.message||e)})));}
if(responses.length===1)process.stdout.write(JSON.stringify(responses[0]));else if(responses.length>1)process.stdout.write(JSON.stringify({type:'sledgewire.batch.response.v1',responses}));

async function serve(req,buyerSeat){if(typeof req.request_id!=='string'||req.request_id.length<3||req.request_id.length>200)return failure(req,'invalid_request_id');if(!catalog.services[req.service]||catalog.services[req.service].price<=0)return failure(req,'unknown_or_free_service');if(!req.input||typeof req.input!=='object'||Array.isArray(req.input))return failure(req,'invalid_input');if(!req.payment_txn_id){const price=prices[req.service];const memo=paymentMemo(req.request_id,req.service);return {type:'sledgewire.payment_required.v1',request_id:req.request_id,service:req.service,price_credits:price,payee,memo,pay_command:`npx -y sharednet@latest pay ${payee} ${price} --memo ${JSON.stringify(memo)} --room`};}
  const auth=await gate.authorize({roomId:room,buyerSeat,requestId:req.request_id,service:req.service,input:req.input,txnId:req.payment_txn_id});if(!auth.ok)return failure(req,auth.reason,auth);if(auth.replay)return auth.cached;
  try{const result=await runPaidService({service:req.service,input:req.input,store,requestId:req.request_id,fingerprint:auth.fingerprint,buyerSeat});const receipt=signReceipt({...result,receipt_version:'sledgewire.receipt.v2',issued_at:new Date().toISOString(),payment:{txn_id:req.payment_txn_id,price_credits:auth.price,room_id:room}},signing.privateKeyPem);const response={type:'sledgewire.service.response.v1',request_id:req.request_id,service:req.service,state:'DELIVERED',trace_id:result.sharedos_trace_id,receipt};store.complete(req.request_id,auth.fingerprint,response);return response;}catch(e){store.fail(req.request_id,auth.fingerprint,{message:String(e.message||e)});return failure(req,'execution_failed',{detail:String(e.message||e)});}}
function failure(req,reason,extra={}){return {type:'sledgewire.service.response.v1',request_id:req?.request_id??null,service:req?.service??null,state:'FAILED',reason,...extra};}
