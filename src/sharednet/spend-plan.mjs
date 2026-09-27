export function normalizeArenaOffers(offers){
  if(!Array.isArray(offers))throw new Error('arena_offers_must_be_array');
  if(offers.length>5000)throw new Error('arena_offers_limit');
  const byId=new Map(),normalized=[];
  for(let i=0;i<offers.length;i++){
    const x=offers[i],id=String(x?.id??`offer-${i}`).trim();
    const seller=String(x?.seller??x?.product??'').trim();
    const service=String(x?.service??'').trim();
    const price=Number(x?.price_credits??x?.price);
    const utility=Number(x?.utility??1);
    const worthwhile=x?.worthwhile!==false;
    if(!id||id.length>160||!seller||seller.length>160||!service||service.length>160||!Number.isInteger(price)||price<1||price>1000||!Number.isFinite(utility)||Math.abs(utility)>1_000_000)throw new Error(`invalid_arena_offer:${i}`);
    const offer={id,seller,service,price_credits:price,utility,worthwhile},prior=byId.get(id);
    if(prior){
      const same=prior.seller===seller&&prior.service===service&&prior.price_credits===price&&prior.utility===utility&&prior.worthwhile===worthwhile;
      if(!same)throw new Error(`arena_offer_id_conflict:${id}`);
      continue;
    }
    byId.set(id,offer);normalized.push(offer);
  }
  return normalized.filter(x=>x.worthwhile);
}

function better(a,b){
  if(!a)return b;if(!b)return a;
  if(a.sellers.size!==b.sellers.size)return a.sellers.size>b.sellers.size?a:b;
  if(a.utility!==b.utility)return a.utility>b.utility?a:b;
  if(a.indices.length!==b.indices.length)return a.indices.length<b.indices.length?a:b;
  const ak=a.indices.join(','),bk=b.indices.join(',');return ak<=bk?a:b;
}

export function planArenaSpend({remaining_credits,offers,exclude_sellers=[]}){
  const remaining=Number(remaining_credits);
  if(!Number.isInteger(remaining)||remaining<0||remaining>1000)throw new Error('invalid_remaining_credits');
  const excluded=new Set((Array.isArray(exclude_sellers)?exclude_sellers:[]).map(x=>String(x).trim()).filter(Boolean));
  const normalized=normalizeArenaOffers(offers).filter(x=>!excluded.has(x.seller));
  if(remaining===0)return {exact:true,remaining_credits:0,planned_spend:0,unallocated_credits:0,distinct_sellers:0,total_utility:0,purchases:[],needs_more_offers:false};
  const dp=new Array(remaining+1).fill(null);
  dp[0]={indices:[],sellers:new Set(),utility:0};
  normalized.forEach((offer,index)=>{
    for(let amount=remaining;amount>=offer.price_credits;amount--){
      const prev=dp[amount-offer.price_credits];if(!prev)continue;
      const cand={indices:[...prev.indices,index],sellers:new Set(prev.sellers),utility:prev.utility+offer.utility};
      cand.sellers.add(offer.seller);
      dp[amount]=better(dp[amount],cand);
    }
  });
  let spend=remaining;
  while(spend>0&&!dp[spend])spend--;
  const state=dp[spend]??dp[0],purchases=state.indices.map(i=>normalized[i]);
  return {exact:spend===remaining,remaining_credits:remaining,planned_spend:spend,unallocated_credits:remaining-spend,distinct_sellers:state.sellers.size,total_utility:state.utility,purchases,needs_more_offers:spend!==remaining};
}

export function eventBudgetStatus({event_budget=100,baseline_sent,current_sent}){
  const budget=Number(event_budget),base=Number(baseline_sent),sent=Number(current_sent);
  if(!Number.isInteger(budget)||budget<1||!Number.isFinite(base)||!Number.isFinite(sent)||sent<base)throw new Error('invalid_arena_budget_state');
  const spent=Math.max(0,Math.floor(sent-base)),remaining=Math.max(0,budget-spent),overspent=Math.max(0,spent-budget);
  return {event_budget:budget,arena_sent_delta:spent,remaining_to_spend:remaining,overspent_credits:overspent,spent_all_event_credits:remaining===0};
}

export function resolveArenaBudgetState({existing=null,init=false,room,eventBudget,purse,now=new Date().toISOString()}){
  if(typeof room!=='string'||!room)throw new Error('invalid_arena_budget_room');
  if(!Number.isInteger(Number(eventBudget))||Number(eventBudget)<1||Number(eventBudget)>1000)throw new Error('invalid_arena_event_budget');
  for(const k of ['balance','sent','received','granted'])if(!Number.isFinite(Number(purse?.[k])))throw new Error(`credits_${k}_missing`);
  if(existing){
    if(!existing||typeof existing!=='object'||Array.isArray(existing))throw new Error('arena_budget_state_corrupt');
    if(existing.room_id!==room||Number(existing.event_budget)!==Number(eventBudget))throw new Error('arena_budget_state_scope_mismatch');
    for(const k of ['baseline_sent','baseline_received','baseline_balance','baseline_granted'])if(!Number.isFinite(Number(existing[k])))throw new Error(`arena_budget_state_invalid_${k}`);
    if(typeof existing.initialized_at!=='string'||!Number.isFinite(Date.parse(existing.initialized_at)))throw new Error('arena_budget_state_invalid_initialized_at');
    return {state:existing,initialization:init?'already_initialized':'loaded'};
  }
  if(!init)throw new Error('arena_budget_not_initialized_use_--init_after_event_grant');
  return {initialization:'initialized',state:{
    version:2,room_id:room,event_budget:Number(eventBudget),
    baseline_sent:Number(purse.sent),baseline_received:Number(purse.received),
    baseline_balance:Number(purse.balance),baseline_granted:Number(purse.granted),
    initialized_at:now
  }};
}
