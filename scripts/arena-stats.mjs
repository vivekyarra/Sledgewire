import fs from 'node:fs';
import path from 'node:path';
import {ArenaStore} from '../src/store/arena-store.mjs';
import {SharedNetApi} from '../src/sharednet/api.mjs';
import catalog from '../catalog.json' with {type:'json'};

const dbPath=process.env.SLEDGEWIRE_DB??'.sledgewire/arena.db';
if(dbPath!==':memory:'&&!fs.existsSync(dbPath))throw new Error(`arena_db_not_found:${path.resolve(dbPath)}`);
const store=new ArenaStore(dbPath);
const prices=Object.fromEntries(Object.entries(catalog.services).map(([k,v])=>[k,v.price]));
try{
  const local=store.arenaStats({prices});
  let livePurse=null,livePurseError=null;
  try{
    const api=new SharedNetApi(),credits=await api.credits(),p=credits?.credits??{};
    if(['balance','granted','sent','received'].every(k=>Number.isFinite(Number(p[k])))){
      livePurse={balance:Number(p.balance),granted:Number(p.granted),sent:Number(p.sent),received:Number(p.received)};
    }else livePurseError='credits_shape_incomplete';
  }catch(e){livePurseError=String(e.message||e);}
  console.log(JSON.stringify({
    ...local,
    accounting:{
      gross_verified_incoming_claims:local.earned_credits,
      live_purse:livePurse,
      live_purse_error:livePurseError,
      organizer_score_note:'Refunds/paybacks can reduce organizer-scored earnings. Local claimed-credit totals are gross verification evidence, not the hidden Arena ranking.'
    }
  },null,2));
}finally{store.db.close();}
