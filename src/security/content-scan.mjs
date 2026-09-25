const patterns=[
  /ignore (all|any|the|previous|prior) instructions/i,
  /system\s*:/i,/developer\s*:/i,/read (process\.)?env/i,
  /(send|exfiltrate|upload).*(secret|token|credential|key)/i,
  /do not tell (the )?(user|caller)/i,/override.*(policy|permission|authorization)/i,
  /use .*credential/i
];
export function scanUntrusted(value){let text;try{text=typeof value==='string'?value:JSON.stringify(value);}catch{text='[unserializable]';}const hits=patterns.filter(r=>r.test(text??'')).map(r=>r.source);return {suspicious:hits.length>0,hits};}
