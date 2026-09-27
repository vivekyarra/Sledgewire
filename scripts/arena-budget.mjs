import fs from 'node:fs';
import path from 'node:path';
import {SharedNetApi,ROOM} from '../src/sharednet/api.mjs';
import {eventBudgetStatus,planArenaSpend} from '../src/sharednet/spend-plan.mjs';

function arg(name){const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:null;}
const init=process.argv.includes('--init');
const room=process.env.SHAREDNET_ARENA_ROOM_ID??'';
if(!ROOM.test(room))throw new Error('valid_SHAREDNET_ARENA_ROOM_ID_required');
const statePath=path.resolve(arg('--state')??process.env.SLEDGEWIRE_ARENA_BUDGET_STATE??'.sledgewire/arena-budget.json');
const offersPath=arg('--offers')??process.env.SLEDGEWIRE_ARENA_OFFERS_FILE??null;
const eventBudget=Number(arg('--budget')??process.env.SLEDGEWIRE_ARENA_EVENT_BUDGET??100);
if(!Number.isInteger(eventBudget)||eventBudget<1||eventBudget>1000)throw new Error('invalid_arena_event_budget');
const api=new SharedNetApi(),credits=await api.credits(),purse=credits?.credits??{};
for(const k of ['balance','sent','received','granted'])if(!Number.isFinite(Number(purse[k])))throw new Error(`credits_${k}_missing`);
fs.mkdirSync(path.dirname(statePath),{recursive:true,mode:0o700});
let state=null;try{state=JSON.parse(fs.readFileSync(statePath,'utf8'));}catch{}
if(init||!state){
  state={version:1,room_id:room,event_budget:eventBudget,baseline_sent:Number(purse.sent),baseline_received:Number(purse.received),baseline_balance:Number(purse.balance),initialized_at:new Date().toISOString()};
  fs.writeFileSync(statePath,JSON.stringify(state,null,2)+'\n',{mode:0o600});fs.chmodSync(statePath,0o600);
}
if(state.room_id!==room||Number(state.event_budget)!==eventBudget)throw new Error('arena_budget_state_scope_mismatch');
const budget=eventBudgetStatus({event_budget:eventBudget,baseline_sent:state.baseline_sent,current_sent:Number(purse.sent)});
let plan=null;
if(offersPath){
  const offers=JSON.parse(fs.readFileSync(path.resolve(offersPath),'utf8'));
  plan=planArenaSpend({remaining_credits:budget.remaining_to_spend,offers});
}
const result={
  type:'sledgewire.arena.budget.v1',
  room_id:room,
  event_budget:eventBudget,
  ...budget,
  live_purse:{balance:Number(purse.balance),sent:Number(purse.sent),received:Number(purse.received),granted:Number(purse.granted)},
  sales_or_refunds_received_since_init:Math.max(0,Number(purse.received)-Number(state.baseline_received)),
  plan,
  instruction:budget.spent_all_event_credits?'Event allocation spent. Do not spend more merely to satisfy the floor.':'Continue buying genuinely worthwhile peer services until remaining_to_spend reaches 0 before round close.',
  note:'Uses live SharedNet sent totals relative to the Arena baseline; refunds/paybacks do not erase the fact that event credits were sent. Organizer ranking is external and is not inferred from this file.'
};
console.log(JSON.stringify(result,null,2));
