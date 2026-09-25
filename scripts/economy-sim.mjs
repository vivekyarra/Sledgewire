import catalog from '../catalog.json' with {type:'json'};

const prices=Object.fromEntries(Object.entries(catalog.services).filter(([,v])=>v.price>0).map(([k,v])=>[k.split('.').at(-1),v.price]));
const scenarios={
  conservative:{smoke:.55,assay:.25,invoke:.12,fleet:.08,sellerSeal:.10,sellerGauntlet:.08},
  strong:{smoke:.80,assay:.45,invoke:.25,fleet:.15,sellerSeal:.20,sellerGauntlet:.18},
  aggressive:{smoke:.95,assay:.60,invoke:.35,fleet:.25,sellerSeal:.35,sellerGauntlet:.30}
};
const peers=[6,8,10,12,15,20];const rows=[];
for(const [name,r] of Object.entries(scenarios)){
  if(r.sellerSeal+r.sellerGauntlet>1)throw new Error('seller premium choices must be mutually exclusive');
  const perPeer=
    prices.smoke*r.smoke+
    prices.assay*r.assay+
    prices.invoke*r.invoke+
    prices.fleet*r.fleet+
    prices.seal*r.sellerSeal+
    prices.gauntlet*r.sellerGauntlet;
  for(const count of peers)rows.push({scenario:name,peers:count,modeled_credits:Number((perPeer*count).toFixed(1)),credits_per_peer:Number(perPeer.toFixed(2))});
}
console.log(JSON.stringify({
  facts:{
    prices,
    free_entry:Object.entries(catalog.services).filter(([,v])=>v.price===0).map(([k])=>k.split('.').at(-1)),
    seller_lane:'Seal and Gauntlet conversion shares are mutually exclusive because Gauntlet already includes conformance evidence.',
    note:'Sensitivity arithmetic only. It is not a forecast, probability, or finishing-position claim. Arena rank depends on valid credits actually earned.'
  },
  rows
},null,2));
if(prices.smoke!==3||prices.gauntlet!==35||Math.max(...Object.values(prices))>35)process.exit(1);
