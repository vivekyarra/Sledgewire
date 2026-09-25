import fs from 'node:fs';
import path from 'node:path';
import {ArenaStore} from '../src/store/arena-store.mjs';
import catalog from '../catalog.json' with {type:'json'};

const dbPath=process.env.SLEDGEWIRE_DB??'.sledgewire/arena.db';
if(dbPath!==':memory:'&&!fs.existsSync(dbPath))throw new Error(`arena_db_not_found:${path.resolve(dbPath)}`);
const store=new ArenaStore(dbPath);
const prices=Object.fromEntries(Object.entries(catalog.services).map(([k,v])=>[k,v.price]));
try{console.log(JSON.stringify(store.arenaStats({prices}),null,2));}
finally{store.db.close();}
