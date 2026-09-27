import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {readArenaBudgetStateFile,writeArenaBudgetStateFile} from '../src/sharednet/budget-state-file.mjs';
import {normalizeArenaOffers,planArenaSpend,resolveArenaBudgetState} from '../src/sharednet/spend-plan.mjs';

test('budget state file is atomic owner-only and round-trips exactly',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sw-budget-state-')),file=path.join(dir,'budget.json');
  try{
    const state={version:2,room_id:'rom_ABCDEFGHIJ',event_budget:100,baseline_sent:7,baseline_received:2,baseline_balance:100,baseline_granted:100,initialized_at:'2026-09-27T12:00:00.000Z'};
    writeArenaBudgetStateFile(file,state);
    assert.deepEqual(readArenaBudgetStateFile(file),state);
    assert.equal(fs.statSync(file).mode&0o777,0o600);
    assert.deepEqual(fs.readdirSync(dir).sort(),['budget.json']);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('corrupt budget state fails closed instead of looking missing',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sw-budget-corrupt-')),file=path.join(dir,'budget.json');
  try{fs.writeFileSync(file,'{"broken"');assert.throws(()=>readArenaBudgetStateFile(file),/arena_budget_state_corrupt/);}
  finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('budget state symlink is rejected and target is untouched',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sw-budget-link-')),target=path.join(dir,'target.json'),file=path.join(dir,'budget.json');
  try{
    fs.writeFileSync(target,'{"sentinel":true}\n');fs.symlinkSync(target,file);
    assert.throws(()=>readArenaBudgetStateFile(file),/arena_budget_state_unsafe_path/);
    assert.equal(fs.readFileSync(target,'utf8'),'{"sentinel":true}\n');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('existing budget state requires complete finite baseline and valid time',()=>{
  const purse={balance:100,sent:0,received:0,granted:100},base={version:2,room_id:'rom_ABCDEFGHIJ',event_budget:100,baseline_sent:0,baseline_received:0,baseline_balance:100,baseline_granted:100,initialized_at:'2026-09-27T12:00:00.000Z'};
  assert.equal(resolveArenaBudgetState({existing:base,init:true,room:base.room_id,eventBudget:100,purse}).initialization,'already_initialized');
  for(const key of ['baseline_sent','baseline_received','baseline_balance','baseline_granted'])assert.throws(()=>resolveArenaBudgetState({existing:{...base,[key]:'NaN'},room:base.room_id,eventBudget:100,purse}),new RegExp(key));
  assert.throws(()=>resolveArenaBudgetState({existing:{...base,initialized_at:'not-a-time'},room:base.room_id,eventBudget:100,purse}),/initialized_at/);
});

test('exact duplicate offer ids collapse while conflicting duplicate ids fail closed',()=>{
  const same={id:'o1',seller:'PeerA',service:'check',price_credits:25,utility:3};
  assert.equal(normalizeArenaOffers([same,{...same}]).length,1);
  assert.throws(()=>normalizeArenaOffers([same,{...same,price_credits:30}]),/arena_offer_id_conflict:o1/);
});

test('planner excludes Sledgewire self offers and still finds exact diverse spend',()=>{
  const p=planArenaSpend({remaining_credits:100,exclude_sellers:['Sledgewire'],offers:[
    {id:'self',seller:'Sledgewire',service:'smoke',price_credits:100,utility:999},
    {id:'a',seller:'PeerA',service:'x',price_credits:40,utility:5},
    {id:'b',seller:'PeerB',service:'y',price_credits:35,utility:4},
    {id:'c',seller:'PeerC',service:'z',price_credits:25,utility:3}
  ]});
  assert.equal(p.exact,true);assert.equal(p.planned_spend,100);assert.equal(p.distinct_sellers,3);assert.equal(p.purchases.some(x=>x.seller==='Sledgewire'),false);
});
