import fs from 'node:fs';
import path from 'node:path';
import {SharedNetApi,ROOM} from '../src/sharednet/api.mjs';
import {eventBudgetStatus,planArenaSpend,resolveArenaBudgetState} from '../src/sharednet/spend-plan.mjs';

function arg(name){const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:null;}
const init=process.argv.includes('--init');
const room=process.env.SHAREDNET_ARENA_ROOM_ID??'';
if(!ROOM.test(room))throw new Error('valid_SHAREDNET_ARENA_ROOM_ID_required');
const statePath=path.resolve(arg('--state')??process.env.SLEDGEWIRE_ARENA_BUDGET_STATE??'.sledgewire/arena-budget.json');
const offersPath=arg('--offers')??process.env.SLEDGEWIRE_ARENA_OFFERS_FILE??null;
const selfSeller=String(arg('--self-seller')??process.env.SLEDGEWIRE_ARENA_SELF_SELLER??'Sledgewire').trim();
const eventBudget=Number(arg('--budget')??process.env.SLEDGEWIRE_ARENA_EVENT_BUDGET??100);
if(!Number.isInteger(eventBudget)||eventBudget<1||eventBudget>1000)throw new Error('invalid_arena_event_budget');
const api=new SharedNetApi(),credits=await api.credits(),purse=credits?.credits??{};
for(const k of ['balance','sent','received','granted'])if(!Number.isFinite(Number(purse[k])))throw new Error(`credits_${k}_missing`);
fs.mkdirSync(path.dirname(statePath),{recursive:true,mode:0o700});
let existing=null;
try{
  const st=fs.lstatSync(statePath);if(st.isSymbolicLink()||!st.isFile())throw new Error('arena_budget_state_unsafe_path');
  const raw=fs.readFileSync(statePath,'utf8');try{existing=JSON.parse(raw);}catch{throw new Error('arena_budget_state_corrupt');}
}catch(e){if(e?.code!=='ENOENT')throw e;}
const resolved=resolveArenaBudgetState({existing,init,room,eventBudget,purse});
const state=resolved.state,initialization=resolved.initialization;
if(initialization==='initialized'){
  const tmp=statePath+`.tmp-${process.pid}`,payload=JSON.stringify(state,null,2)+'\n';
  let fd=null;
  try{
    fd=fs.openSync(tmp,'wx',0o600);fs.writeFileSync(fd,payload);fs.fsyncSync(fd);fs.closeSync(fd);fd=null;
    fs.renameSync(tmp,statePath);fs.chmodSync(statePath,0o600);
    const dirfd=fs.openSync(path.dirname(statePath),'r');try{fs.fsyncSync(dirfd);}finally{fs.closeSync(dirfd);}
  }finally{if(fd!==null)try{fs.closeSync(fd);}catch{};try{fs.unlinkSync(tmp);}catch{}}
}
const budget=eventBudgetStatus({event_budget:eventBudget,baseline_sent:state.baseline_sent,current_sent:Number(purse.sent)});
let plan=null;
if(offersPath){
  const offers=JSON.parse(fs.readFileSync(path.resolve(offersPath),'utf8'));
  plan=planArenaSpend({remaining_credits:budget.remaining_to_spend,offers,exclude_sellers:selfSeller?[selfSeller]:[]});
}
const result={
  type:'sledgewire.arena.budget.v1',
  room_id:room,
  event_budget:eventBudget,
  ...budget,
  initialization,
  baseline:{sent:Number(state.baseline_sent),received:Number(state.baseline_received),balance:Number(state.baseline_balance),granted:Number(state.baseline_granted??0),initialized_at:state.initialized_at},
  live_purse:{balance:Number(purse.balance),sent:Number(purse.sent),received:Number(purse.received),granted:Number(purse.granted)},
  sales_or_refunds_received_since_init:Math.max(0,Number(purse.received)-Number(state.baseline_received)),
  plan,
  self_seller_excluded:selfSeller||null,
  instruction:budget.overspent_credits>0?`Event allocation exceeded by ${budget.overspent_credits} credits. Stop spending merely to satisfy the event obligation.`:(budget.spent_all_event_credits?'Event allocation spent exactly or fully. Do not spend more merely to satisfy the floor.':'Continue buying genuinely worthwhile peer services until remaining_to_spend reaches 0 before round close.'),
  note:'Uses live SharedNet sent totals relative to the Arena baseline; refunds/paybacks do not erase the fact that event credits were sent. Organizer ranking is external and is not inferred from this file.'
};
console.log(JSON.stringify(result,null,2));
