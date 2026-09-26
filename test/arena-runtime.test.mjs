import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {prepareSingleContainerRuntime,scrubParentSecretCopies} from '../src/ops/arena-runtime.mjs';

test('single-container runtime hydrates root-only files and isolates public SharedNet secrets',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sledgewire-runtime-'));
  try{
    const priv=path.join(dir,'private.pem'),pub=path.join(dir,'public.pem'),token=path.join(dir,'seat');
    fs.writeFileSync(priv,'PRIVATE\n',{mode:0o600});
    fs.writeFileSync(pub,'PUBLIC\n',{mode:0o600});
    fs.writeFileSync(token,'sni_'+ 'A'.repeat(43)+'\n',{mode:0o600});
    const env={
      SLEDGEWIRE_DB:path.join(dir,'data','arena.db'),
      SLEDGEWIRE_PRIVATE_KEY_FILE:priv,
      SLEDGEWIRE_PUBLIC_KEY_FILE:pub,
      SHAREDNET_MEMBER_TOKEN_FILE:token,
      SHAREDNET_BUYER_TOKEN:'sni_'+ 'B'.repeat(43),
      SHAREDNET_BUYER_TOKEN_FILE:'/should/not/reach/public',
      SHAREDNET_PAYEE_ADDRESS:'p_ABCDEFGHIJ',
      SHAREDNET_INVITE_TOKEN:'rit_SECRET'
    };
    const processOps={getuid:()=>1000,getgid:()=>1000};
    const r=prepareSingleContainerRuntime({env,processOps});
    assert.equal(r.dropped,false);
    assert.equal(r.publicEnv.SLEDGEWIRE_PRIVATE_KEY_PEM,'PRIVATE');
    assert.equal(r.publicEnv.SLEDGEWIRE_PUBLIC_KEY_PEM,'PUBLIC');
    assert.equal(r.publicEnv.SHAREDNET_MEMBER_TOKEN,undefined);
    assert.equal(r.publicEnv.SHAREDNET_PAYEE_ADDRESS,undefined);
    assert.equal(r.publicEnv.SHAREDNET_BUYER_TOKEN,undefined);
    assert.equal(r.publicEnv.SHAREDNET_BUYER_TOKEN_FILE,undefined);
    assert.equal(r.publicEnv.SHAREDNET_INVITE_TOKEN,undefined);
    assert.equal(r.daemonEnv.SHAREDNET_MEMBER_TOKEN,'sni_'+ 'A'.repeat(43));
    assert.equal(r.daemonEnv.SHAREDNET_PAYEE_ADDRESS,'p_ABCDEFGHIJ');
    assert.equal(r.daemonEnv.SHAREDNET_INVITE_TOKEN,undefined);
    assert.equal(r.daemonEnv.SLEDGEWIRE_PRIVATE_KEY_FILE,undefined);
    assert.equal(r.daemonEnv.SLEDGEWIRE_PUBLIC_KEY_FILE,undefined);
    assert.equal(r.daemonEnv.SHAREDNET_MEMBER_TOKEN_FILE,undefined);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('supervisor secret copies are scrubbed after child spawn',()=>{
  const parentEnv={SLEDGEWIRE_PRIVATE_KEY_PEM:'PRIVATE',SHAREDNET_MEMBER_TOKEN:'sni_'+ 'A'.repeat(43),KEEP:'yes'};
  const runtime={
    publicEnv:{SLEDGEWIRE_PRIVATE_KEY_PEM:'PRIVATE',KEEP:'public'},
    daemonEnv:{SLEDGEWIRE_PRIVATE_KEY_PEM:'PRIVATE',SHAREDNET_MEMBER_TOKEN:'sni_'+ 'A'.repeat(43),KEEP:'daemon'}
  };
  scrubParentSecretCopies(runtime,{parentEnv});
  assert.equal(parentEnv.SLEDGEWIRE_PRIVATE_KEY_PEM,undefined);
  assert.equal(parentEnv.SHAREDNET_MEMBER_TOKEN,undefined);
  assert.equal(parentEnv.KEEP,'yes');
  assert.equal(runtime.publicEnv.SLEDGEWIRE_PRIVATE_KEY_PEM,undefined);
  assert.equal(runtime.daemonEnv.SHAREDNET_MEMBER_TOKEN,undefined);
  assert.equal(runtime.daemonEnv.KEEP,'daemon');
});

test('Railway system variables derive canonical public base and persistent database path',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sledgewire-railway-'));
  try{
    const processOps={getuid:()=>1000,getgid:()=>1000};
    const r=prepareSingleContainerRuntime({
      env:{RAILWAY_PUBLIC_DOMAIN:'seller.up.railway.app',RAILWAY_VOLUME_MOUNT_PATH:dir,SLEDGEWIRE_PRIVATE_KEY_PEM:'PRIVATE'},
      processOps
    });
    assert.equal(r.publicEnv.PUBLIC_BASE_URL,'https://seller.up.railway.app');
    assert.equal(r.daemonEnv.PUBLIC_BASE_URL,'https://seller.up.railway.app');
    assert.equal(r.dbPath,path.join(dir,'sledgewire.db'));
    assert.equal(r.daemonEnv.SLEDGEWIRE_DB,path.join(dir,'sledgewire.db'));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('root runtime chowns persistent database directory then drops groups gid and uid',()=>{
  const calls=[];let uid=0,gid=0;
  const fsImpl={
    constants:{R_OK:4,W_OK:2},
    mkdirSync:(p,o)=>calls.push(['mkdir',p,o]),
    lstatSync:p=>{
      if(p==='/persistent')return {isSymbolicLink:()=>false,isFile:()=>false};
      const e=new Error('missing');e.code='ENOENT';throw e;
    },
    chownSync:(...a)=>calls.push(['chown',...a]),
    chmodSync:(...a)=>calls.push(['chmod',...a]),
    accessSync:(...a)=>calls.push(['access',...a]),
    statSync:()=>{throw new Error('unexpected secret read');},
    readFileSync:()=>{throw new Error('unexpected secret read');}
  };
  const processOps={
    getuid:()=>uid,getgid:()=>gid,
    setgroups:v=>calls.push(['setgroups',v]),
    setgid:v=>{calls.push(['setgid',v]);gid=v;},
    setuid:v=>{calls.push(['setuid',v]);uid=v;}
  };
  const r=prepareSingleContainerRuntime({
    env:{
      SLEDGEWIRE_DB:'/persistent/arena.db',
      SLEDGEWIRE_PRIVATE_KEY_PEM:'PRIVATE',
      SHAREDNET_MEMBER_TOKEN:'sni_'+ 'A'.repeat(43),
      SLEDGEWIRE_RUNTIME_UID:'1000',
      SLEDGEWIRE_RUNTIME_GID:'1000'
    },
    fsImpl,processOps
  });
  assert.equal(r.dropped,true);
  assert.equal(r.runtimeUid,1000);
  assert.equal(r.runtimeGid,1000);
  assert.ok(calls.some(x=>x[0]==='chown'&&x[1]==='/persistent'&&x[2]===1000&&x[3]===1000));
  assert.deepEqual(calls.find(x=>x[0]==='setgroups'),['setgroups',[]]);
  assert.deepEqual(calls.find(x=>x[0]==='setgid'),['setgid',1000]);
  assert.deepEqual(calls.find(x=>x[0]==='setuid'),['setuid',1000]);
});

test('root runtime refuses a symlinked database directory',()=>{
  const fsImpl={
    constants:{R_OK:4,W_OK:2},
    mkdirSync:()=>{},
    lstatSync:()=>({isSymbolicLink:()=>true,isFile:()=>false}),
    statSync:()=>{throw new Error('unexpected');},
    readFileSync:()=>{throw new Error('unexpected');}
  };
  const processOps={getuid:()=>0,getgid:()=>0,setgroups:()=>{},setgid:()=>{},setuid:()=>{}};
  assert.throws(()=>prepareSingleContainerRuntime({
    env:{SLEDGEWIRE_DB:'/persistent/arena.db',SLEDGEWIRE_PRIVATE_KEY_PEM:'PRIVATE'},
    fsImpl,processOps
  }),/runtime_db_dir_symlink_forbidden/);
});
