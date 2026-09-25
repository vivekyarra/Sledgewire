import catalog from '../catalog.json' with {type:'json'};

const paid=Object.entries(catalog.services).filter(([,v])=>v.price>0);
const prices=Object.fromEntries(paid.map(([k,v])=>[k.split('.').at(-1),v.price]));
const scenarios={
  conservative:{smoke:.55,assay:.25,invoke:.12,fleet:.08,seal:.10,gauntlet:.08},
  strong:{smoke:.80,assay:.45,invoke:.25,fleet:.15,seal:.20,gauntlet:.18},
  aggressive:{smoke:.95,assay:.60,invoke:.35,fleet:.25,seal:.35,gauntlet:.30}
};
const peers=[6,8,10,12,15,20];
const rows=[];
for(const [name,rates] of Object.entries(scenarios)){
  const perPeer=Object.entries(rates).reduce((sum,[service,rate])=>sum+(prices[service]??0)*rate,0);
  for(const count of peers)rows.push({scenario:name,peers:count,modeled_credits:Number((perPeer*count).toFixed(1)),credits_per_peer:Number(perPeer.toFixed(2))});
}
const theoreticalPaidTotal=Object.values(prices).reduce((a,b)=>a+b,0);
const facts={
  prices,
  theoretical_paid_menu_total:theoreticalPaidTotal,
  max_single_purchase:Math.max(...Object.values(prices)),
  free_entry:['quote','selfcheck','verify'],
  note:'Scenario arithmetic is a sensitivity model, not a forecast or guarantee. Arena ranking depends on valid credits actually earned.'
};
console.log(JSON.stringify({facts,rows},null,2));
if(prices.smoke!==3||prices.gauntlet!==35||Math.max(...Object.values(prices))>35)process.exit(1);
