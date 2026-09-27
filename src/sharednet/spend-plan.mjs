export function normalizeArenaOffers(offers){
  if(!Array.isArray(offers))throw new Error('arena_offers_must_be_array');
  if(offers.length>5000)throw new Error('arena_offers_limit');
  return offers.map((x,i)=>{
    const id=String(x?.id??`offer-${i}`).trim();
    const seller=String(x?.seller??x?.product??'').trim();
    const service=String(x?.service??'').trim();
    const price=Number(x?.price_credits??x?.price);
    const utility=Number(x?.utility??1);
    const worthwhile=x?.worthwhile!==false;
    if(!id||id.length>160||!seller||seller.length>160||!service||service.length>160||!Number.isInteger(price)||price<1||price>1000||!Number.isFinite(utility)||Math.abs(utility)>1_000_000)throw new Error(`invalid_arena_offer:${i}`);
    return {id,seller,service,price_credits:price,utility,worthwhile};
  }).filter(x=>x.worthwhile);
}

function better(a,b){
  if(!a)return b;if(!b)return a;
  if(a.sellers.size!==b.sellers.size)return a.sellers.size>b.sellers.size?a:b;
  if(a.utility!==b.utility)return a.utility>b.utility?a:b;
  if(a.indices.length!==b.indices.length)return a.indices.length<b.indices.length?a:b;
  const ak=a.indices.join(','),bk=b.indices.join(',');return ak<=bk?a:b;
}

export function planArenaSpend({remaining_credits,offers}){
  const remaining=Number(remaining_credits);
  if(!Number.isInteger(remaining)||remaining<0||remaining>1000)throw new Error('invalid_remaining_credits');
  const normalized=normalizeArenaOffers(offers);
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
