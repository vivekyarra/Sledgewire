export function arenaDaemonHeartbeatKey(roomId){return `arena_daemon_heartbeat:${String(roomId??'')}`;}

export function writeArenaDaemonHeartbeat(store,roomId,{instanceId=null,status='running',at=new Date().toISOString()}={}){
  if(!store||typeof store.setMeta!=='function'||!roomId)throw new Error('arena_daemon_heartbeat_store_or_room_missing');
  const value={version:1,room_id:String(roomId),status:String(status),at,...(instanceId?{instance_id:String(instanceId)}:{})};
  store.setMeta(arenaDaemonHeartbeatKey(roomId),JSON.stringify(value));
  return value;
}

export function readArenaDaemonReadiness(store,roomId,{now=Date.now(),maxAgeMs=45_000}={}){
  if(!roomId)return {required:false,ready:true,status:'not_required',age_ms:null};
  if(!store||typeof store.getMeta!=='function')return {required:true,ready:false,status:'store_unavailable',age_ms:null};
  const raw=store.getMeta(arenaDaemonHeartbeatKey(roomId));
  if(!raw)return {required:true,ready:false,status:'missing',age_ms:null};
  let x;try{x=JSON.parse(raw);}catch{return {required:true,ready:false,status:'malformed',age_ms:null};}
  if(x?.room_id!==String(roomId))return {required:true,ready:false,status:'room_mismatch',age_ms:null};
  const at=Date.parse(x?.at);if(!Number.isFinite(at))return {required:true,ready:false,status:'invalid_time',age_ms:null};
  const age=Math.max(0,Number(now)-at),running=x?.status==='running';
  if(!running)return {required:true,ready:false,status:String(x?.status??'not_running'),age_ms:age};
  if(age>maxAgeMs)return {required:true,ready:false,status:'stale',age_ms:age};
  return {required:true,ready:true,status:'running',age_ms:age};
}
