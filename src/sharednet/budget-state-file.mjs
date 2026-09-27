import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

export function readArenaBudgetStateFile(file,{fsImpl=fs}={}){
  try{
    const st=fsImpl.lstatSync(file);
    if(st.isSymbolicLink()||!st.isFile())throw new Error('arena_budget_state_unsafe_path');
    const raw=fsImpl.readFileSync(file,'utf8');
    try{return JSON.parse(raw);}catch{throw new Error('arena_budget_state_corrupt');}
  }catch(e){
    if(e?.code==='ENOENT')return null;
    throw e;
  }
}

export function writeArenaBudgetStateFile(file,state,{fsImpl=fs,pathImpl=path,uuid=randomUUID}={}){
  const dir=pathImpl.dirname(file);
  fsImpl.mkdirSync(dir,{recursive:true,mode:0o700});
  const tmp=`${file}.tmp-${process.pid}-${uuid()}`,payload=JSON.stringify(state,null,2)+'\n';
  let fd=null;
  try{
    fd=fsImpl.openSync(tmp,'wx',0o600);
    fsImpl.writeFileSync(fd,payload);
    fsImpl.fsyncSync(fd);
    fsImpl.closeSync(fd);fd=null;
    fsImpl.renameSync(tmp,file);
    fsImpl.chmodSync(file,0o600);
    let dirfd=null;
    try{dirfd=fsImpl.openSync(dir,'r');fsImpl.fsyncSync(dirfd);}finally{if(dirfd!==null)fsImpl.closeSync(dirfd);}
  }finally{
    if(fd!==null)try{fsImpl.closeSync(fd);}catch{}
    try{fsImpl.unlinkSync(tmp);}catch{}
  }
  return file;
}
