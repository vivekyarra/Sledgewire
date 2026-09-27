import fs from 'node:fs';
import path from 'node:path';
import {SEAT} from './api.mjs';

export function arenaSeatFile(env=process.env,pathImpl=path){
  return pathImpl.resolve(env.SHAREDNET_ARENA_SEAT_FILE??'.sharednet/sledgewire-arena-seat');
}
export function readExpectedArenaSeat({env=process.env,fsImpl=fs,pathImpl=path,required=false}={}){
  const direct=String(env.SHAREDNET_ARENA_EXPECTED_SEAT??'').trim();
  if(direct){
    if(!SEAT.test(direct))throw new Error('invalid_SHAREDNET_ARENA_EXPECTED_SEAT');
    return direct;
  }
  const file=arenaSeatFile(env,pathImpl);
  let value='';try{value=fsImpl.readFileSync(file,'utf8').trim();}catch(e){if(e?.code!=='ENOENT')throw e;}
  if(!value){if(required)throw new Error('arena_expected_single_seat_required');return null;}
  if(!SEAT.test(value))throw new Error('invalid_arena_seat_file');
  return value;
}
export function writeArenaSeatBinding(seat,{env=process.env,fsImpl=fs,pathImpl=path}={}){
  if(!SEAT.test(seat??''))throw new Error('invalid_arena_seat');
  const file=arenaSeatFile(env,pathImpl);fsImpl.mkdirSync(pathImpl.dirname(file),{recursive:true,mode:0o700});
  fsImpl.writeFileSync(file,seat+'\n',{mode:0o600});
  return file;
}
