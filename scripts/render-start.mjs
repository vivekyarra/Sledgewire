import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';

const dataDir=path.resolve(process.env.SLEDGEWIRE_RENDER_DATA_DIR||'/var/data/sledgewire');
const keyDir=path.join(dataDir,'keys');
const sharednetDir=path.join(dataDir,'sharednet');
const evidenceDir=path.join(dataDir,'evidence');

for(const dir of [dataDir,keyDir,sharednetDir,evidenceDir])fs.mkdirSync(dir,{recursive:true,mode:0o700});

const privateKey=path.join(keyDir,'ed25519-private.pem');
const publicKey=path.join(keyDir,'ed25519-public.pem');
const inlinePrivate=Boolean(String(process.env.SLEDGEWIRE_PRIVATE_KEY_PEM||'').trim());
const inlinePublic=Boolean(String(process.env.SLEDGEWIRE_PUBLIC_KEY_PEM||'').trim());
if(inlinePrivate!==inlinePublic)throw new Error('inline_signing_keypair_incomplete');

if(!inlinePrivate){
  const privateExists=regularNonempty(privateKey);
  const publicExists=regularNonempty(publicKey);
  if(privateExists!==publicExists)throw new Error('persistent_signing_keypair_incomplete');
  if(!privateExists){
    const generated=spawnSync('npm',['run','keygen','--',keyDir],{stdio:'inherit',env:process.env});
    if(generated.status!==0)throw new Error(`persistent_keygen_failed_${generated.status??'signal'}`);
  }
  fs.chmodSync(privateKey,0o600);
  fs.chmodSync(publicKey,0o644);
}

process.env.NODE_ENV=process.env.NODE_ENV||'production';
process.env.SLEDGEWIRE_DB=process.env.SLEDGEWIRE_DB||path.join(dataDir,'sledgewire.db');
if(!inlinePrivate){
  process.env.SLEDGEWIRE_PRIVATE_KEY_FILE=process.env.SLEDGEWIRE_PRIVATE_KEY_FILE||privateKey;
  process.env.SLEDGEWIRE_PUBLIC_KEY_FILE=process.env.SLEDGEWIRE_PUBLIC_KEY_FILE||publicKey;
}
process.env.SHAREDNET_MEMBER_TOKEN_FILE=process.env.SHAREDNET_MEMBER_TOKEN_FILE||path.join(sharednetDir,'member-token');
process.env.SHAREDNET_ARENA_SEAT_FILE=process.env.SHAREDNET_ARENA_SEAT_FILE||path.join(sharednetDir,'arena-seat');
process.env.SHAREDNET_JOIN_STATE_FILE=process.env.SHAREDNET_JOIN_STATE_FILE||path.join(sharednetDir,'join-state.json');
process.env.SLEDGEWIRE_REHEARSAL_EVIDENCE=process.env.SLEDGEWIRE_REHEARSAL_EVIDENCE||path.join(evidenceDir,'live-rehearsal.json');
process.env.SLEDGEWIRE_RESTART_REPLAY_EVIDENCE=process.env.SLEDGEWIRE_RESTART_REPLAY_EVIDENCE||path.join(evidenceDir,'restart-replay.json');
process.env.SLEDGEWIRE_ARENA_BUDGET_STATE=process.env.SLEDGEWIRE_ARENA_BUDGET_STATE||path.join(evidenceDir,'arena-budget.json');

if(!process.env.PUBLIC_BASE_URL){
  if(process.env.RENDER_EXTERNAL_URL)process.env.PUBLIC_BASE_URL=process.env.RENDER_EXTERNAL_URL;
  else if(process.env.RENDER_EXTERNAL_HOSTNAME)process.env.PUBLIC_BASE_URL=`https://${process.env.RENDER_EXTERNAL_HOSTNAME}`;
}
if(process.env.NODE_ENV==='production'&&!process.env.PUBLIC_BASE_URL)throw new Error('PUBLIC_BASE_URL_or_Render_external_url_required');

const room=String(process.env.SHAREDNET_ARENA_ROOM_ID||'').trim();
const payee=String(process.env.SHAREDNET_PAYEE_ADDRESS||'').trim();
const invite=String(process.env.SHAREDNET_INVITE_TOKEN||'').trim();
const directMember=String(process.env.SHAREDNET_MEMBER_TOKEN||'').trim();
const memberFileReady=regularNonempty(process.env.SHAREDNET_MEMBER_TOKEN_FILE);
const seatFileReady=regularNonempty(process.env.SHAREDNET_ARENA_SEAT_FILE);
const hasIdentity=Boolean(directMember)||memberFileReady;
const arenaSignals=Boolean(room||payee||invite||directMember||memberFileReady||seatFileReady);
const canJoin=Boolean(room&&payee&&(hasIdentity||invite));

if(arenaSignals&&!canJoin)throw new Error('partial_arena_configuration_refused');

let mode='serve';
if(canJoin){
  if(!seatFileReady||!hasIdentity){
    const joined=spawnSync('npm',['run','arena:join'],{stdio:'inherit',env:process.env});
    if(joined.status!==0)throw new Error(`arena_join_failed_${joined.status??'signal'}`);
  }
  delete process.env.SHAREDNET_INVITE_TOKEN;
  mode='arena:all';
}

console.error(JSON.stringify({
  sledgewire:'render-start',
  mode,
  data_dir:dataDir,
  db:process.env.SLEDGEWIRE_DB,
  public_base_url:process.env.PUBLIC_BASE_URL,
  persistent_signing_key:true,
  signing_key_source:inlinePrivate?'environment':'disk',
  arena_identity_persisted:regularNonempty(process.env.SHAREDNET_MEMBER_TOKEN_FILE),
  arena_seat_persisted:regularNonempty(process.env.SHAREDNET_ARENA_SEAT_FILE)
}));

const child=spawn('npm',['run',mode],{stdio:'inherit',env:process.env});
for(const signal of ['SIGTERM','SIGINT']){
  process.once(signal,()=>{try{child.kill(signal);}catch{}});
}
child.once('error',error=>{console.error(`render-start-child:${error.message}`);process.exit(1);});
child.once('exit',(code,signal)=>{
  if(signal)console.error(`render-start child exited from ${signal}`);
  process.exit(Number.isInteger(code)?code:1);
});

function regularNonempty(file){
  if(!file)return false;
  try{
    const st=fs.lstatSync(file);
    if(st.isSymbolicLink())throw new Error('persistent_secret_symlink_forbidden');
    return st.isFile()&&st.size>0;
  }catch(error){
    if(error?.code==='ENOENT')return false;
    throw error;
  }
}
