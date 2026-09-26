export function arenaDaemonHeartbeatKey(roomId){return `arena_daemon_heartbeat:${String(roomId??'')}`;}

function base(required,ready,status,ageMs=null,bootId=null){
  return {required,ready,status,age_ms:ageMs,boot_id:bootId};
}

export function writeArenaDaemonHeartbeat(store,roomId,{instanceId=null,bootId=null,status='running',at=new Date().toISOString()}={}){
  if(!store||typeof store.setMeta!=='function'||!roomId)throw new Error('arena_daemon_heartbeat_store_or_room_missing');
  const value={version:2,room_id:String(roomId),status:String(status),at,...(instanceId?{instance_id:String(instanceId)}:{}),...(bootId?{boot_id:String(bootId)}:{})};
  store.setMeta(arenaDaemonHeartbeatKey(roomId),JSON.stringify(value));
  return value;
}

export function readArenaDaemonReadiness(store,roomId,{now=Date.now(),maxAgeMs=45_000}={}){
  if(!roomId)return base(false,true,'not_required');
  if(!store||typeof store.getMeta!=='function')return base(true,false,'store_unavailable');
  const raw=store.getMeta(arenaDaemonHeartbeatKey(roomId));
  if(!raw)return base(true,false,'missing');
  let x;try{x=JSON.parse(raw);}catch{return base(true,false,'malformed');}
  const bootId=typeof x?.boot_id==='string'&&x.boot_id?x.boot_id:null;
  if(x?.room_id!==String(roomId))return base(true,false,'room_mismatch',null,bootId);
  const at=Date.parse(x?.at);if(!Number.isFinite(at))return base(true,false,'invalid_time',null,bootId);
  const age=Math.max(0,Number(now)-at),running=x?.status==='running';
  if(!running)return base(true,false,String(x?.status??'not_running'),age,bootId);
  if(age>maxAgeMs)return base(true,false,'stale',age,bootId);
  return base(true,true,'running',age,bootId);
}
