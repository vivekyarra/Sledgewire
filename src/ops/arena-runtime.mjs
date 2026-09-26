import fs from 'node:fs';
import path from 'node:path';
import {boundedInteger} from './config.mjs';

const MAX_SECRET_BYTES=64*1024;

const PARENT_SECRET_KEYS=[
  'SLEDGEWIRE_PRIVATE_KEY_PEM','SLEDGEWIRE_PRIVATE_KEY_FILE',
  'SHAREDNET_MEMBER_TOKEN','SHAREDNET_MEMBER_TOKEN_FILE','SHAREDNET_INSTANCE_TOKEN',
  'SHAREDNET_BUYER_TOKEN','SHAREDNET_BUYER_TOKEN_FILE','SHAREDNET_INVITE_TOKEN'
];

export function scrubParentSecretCopies(runtime,{parentEnv=process.env}={}){
  for(const key of PARENT_SECRET_KEYS){
    try{delete parentEnv[key];}catch{}
    if(runtime?.publicEnv)delete runtime.publicEnv[key];
    if(runtime?.daemonEnv)delete runtime.daemonEnv[key];
  }
}


function readSecretFile(file,{fsImpl=fs,maxBytes=MAX_SECRET_BYTES}={}){
  const stat=fsImpl.statSync(file);
  if(!stat.isFile()||stat.size<1||stat.size>maxBytes)throw new Error('invalid_secret_file');
  return fsImpl.readFileSync(file,'utf8').trim();
}
function chownIfRegular(file,uid,gid,{fsImpl=fs}={}){
  try{
    const st=fsImpl.lstatSync(file);
    if(st.isSymbolicLink())throw new Error('runtime_path_symlink_forbidden');
    if(st.isFile())fsImpl.chownSync(file,uid,gid);
  }catch(e){
    if(e?.code!=='ENOENT')throw e;
  }
}
function hydrateFileSecret(env,{valueKey,fileKey,maxBytes=MAX_SECRET_BYTES,trim=false},deps){
  if(env[valueKey])return;
  const file=env[fileKey];if(!file)return;
  const value=readSecretFile(file,{...deps,maxBytes});
  env[valueKey]=trim?value.trim():value;
  delete env[fileKey];
}
export function prepareSingleContainerRuntime({
  env=process.env,
  fsImpl=fs,
  pathImpl=path,
  processOps=process
}={}){
  const childEnv={...env};
  if(!childEnv.PUBLIC_BASE_URL&&childEnv.RAILWAY_PUBLIC_DOMAIN)childEnv.PUBLIC_BASE_URL=`https://${String(childEnv.RAILWAY_PUBLIC_DOMAIN).trim()}`;
  if(!childEnv.SLEDGEWIRE_DB&&childEnv.RAILWAY_VOLUME_MOUNT_PATH)childEnv.SLEDGEWIRE_DB=pathImpl.join(String(childEnv.RAILWAY_VOLUME_MOUNT_PATH), 'sledgewire.db');
  hydrateFileSecret(childEnv,{valueKey:'SLEDGEWIRE_PRIVATE_KEY_PEM',fileKey:'SLEDGEWIRE_PRIVATE_KEY_FILE'}, {fsImpl});
  hydrateFileSecret(childEnv,{valueKey:'SLEDGEWIRE_PUBLIC_KEY_PEM',fileKey:'SLEDGEWIRE_PUBLIC_KEY_FILE'}, {fsImpl});
  hydrateFileSecret(childEnv,{valueKey:'SHAREDNET_MEMBER_TOKEN',fileKey:'SHAREDNET_MEMBER_TOKEN_FILE',maxBytes:16*1024,trim:true}, {fsImpl});

  const dbPath=pathImpl.resolve(childEnv.SLEDGEWIRE_DB||'.sledgewire/arena.db');
  const dbDir=pathImpl.dirname(dbPath);
  fsImpl.mkdirSync(dbDir,{recursive:true,mode:0o700});

  let dropped=false,targetUid=null,targetGid=null;
  if(typeof processOps.getuid==='function'&&processOps.getuid()===0){
    targetUid=boundedInteger(childEnv.SLEDGEWIRE_RUNTIME_UID,{name:'runtime_uid',defaultValue:1000,min:1,max:65535});
    targetGid=boundedInteger(childEnv.SLEDGEWIRE_RUNTIME_GID,{name:'runtime_gid',defaultValue:1000,min:1,max:65535});
    const st=fsImpl.lstatSync(dbDir);if(st.isSymbolicLink())throw new Error('runtime_db_dir_symlink_forbidden');
    fsImpl.chownSync(dbDir,targetUid,targetGid);
    fsImpl.chmodSync(dbDir,0o700);
    for(const file of [dbPath,dbPath+'-wal',dbPath+'-shm'])chownIfRegular(file,targetUid,targetGid,{fsImpl});
    processOps.setgroups?.([]);
    processOps.setgid(targetGid);
    processOps.setuid(targetUid);
    dropped=true;
  }
  fsImpl.accessSync(dbDir,fsImpl.constants.R_OK|fsImpl.constants.W_OK);

  const publicEnv={...childEnv};
  for(const key of ['SHAREDNET_MEMBER_TOKEN','SHAREDNET_MEMBER_TOKEN_FILE','SHAREDNET_INSTANCE_TOKEN','SHAREDNET_BUYER_TOKEN','SHAREDNET_BUYER_TOKEN_FILE','SHAREDNET_INVITE_TOKEN','SHAREDNET_PAYEE_ADDRESS'])delete publicEnv[key];

  const daemonEnv={...childEnv};
  delete daemonEnv.SHAREDNET_INVITE_TOKEN;

  return {
    dbPath,dbDir,dropped,targetUid,targetGid,
    publicEnv,daemonEnv,
    runtimeUid:typeof processOps.getuid==='function'?processOps.getuid():null,
    runtimeGid:typeof processOps.getgid==='function'?processOps.getgid():null
  };
}
