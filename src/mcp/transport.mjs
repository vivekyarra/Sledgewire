import http from 'node:http';
import https from 'node:https';
import {resolveTarget} from '../security/target-policy.mjs';

function parseSse(text){
  const events=[];let data=[];
  for(const line of text.split(/\r?\n/)){
    if(line===''){if(data.length){events.push(data.join('\n'));data=[];}continue;}
    if(line.startsWith('data:'))data.push(line.slice(5).trimStart());
  }
  if(data.length)events.push(data.join('\n'));
  const parsed=events.filter(Boolean).map(x=>JSON.parse(x));
  if(!parsed.length)throw new Error('invalid_sse_response');
  return parsed.at(-1);
}

export class HttpMcpError extends Error{
  constructor(status,obj=null,raw=''){
    super(obj?.error?`http_${status}:mcp_error:${obj.error.code}:${obj.error.message}`:`http_${status}`);
    this.name='HttpMcpError';this.httpStatus=status;this.rpcCode=Number(obj?.error?.code);this.rpcData=obj?.error?.data;this.raw=String(raw).slice(0,512);
  }
}

export async function postJsonPinned(endpoint,body,opts={}){
  const resolved=opts.resolvedTarget??await resolveTarget(endpoint,opts.targetPolicy);
  const maxBytes=opts.maxBytes??1_000_000;
  const timeoutMs=opts.timeoutMs??8_000;
  const payload=Buffer.from(JSON.stringify(body));
  const lib=resolved.url.protocol==='https:'?https:http;
  const headers={'content-type':'application/json','accept':'application/json, text/event-stream','content-length':String(payload.length),...(opts.headers??{})};
  return await new Promise((resolve,reject)=>{
    let settled=false;let timer;
    const done=(fn,v)=>{if(settled)return;settled=true;clearTimeout(timer);fn(v);};
    const request=lib.request({
      protocol:resolved.url.protocol,hostname:resolved.url.hostname,port:resolved.url.port||undefined,
      path:`${resolved.url.pathname}${resolved.url.search}`,method:'POST',headers,
      servername:resolved.url.protocol==='https:'&&!resolved.url.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)?resolved.url.hostname:undefined,
      lookup:(_hostname,_options,cb)=>cb(null,resolved.address,resolved.family)
    },res=>{
      if(res.statusCode>=300&&res.statusCode<400){res.resume();return done(reject,new Error('redirect_refused'));}
      const chunks=[];let size=0;
      res.on('data',chunk=>{size+=chunk.length;if(size>maxBytes){request.destroy(new Error('response_too_large'));return;}chunks.push(chunk);});
      res.on('end',()=>{
        if(settled)return;
        const status=res.statusCode??500;
        const text=Buffer.concat(chunks).toString('utf8');
        try{
          let obj=null;
          if(text.trim()){
            const ct=String(res.headers['content-type']??'');
            if(ct.includes('text/event-stream'))obj=parseSse(text);
            else {try{obj=JSON.parse(text);}catch(error){if(status>=200&&status<300)throw error;}}
          }
          if(status<200||status>=300)return done(reject,new HttpMcpError(status,obj,text));
          done(resolve,{result:obj,headers:res.headers,statusCode:status});
        }catch(e){done(reject,e);}
      });
    });
    request.on('error',e=>done(reject,e));
    timer=setTimeout(()=>request.destroy(new Error('deadline_exceeded')),timeoutMs);
    if(opts.signal){if(opts.signal.aborted)request.destroy(opts.signal.reason??new Error('aborted'));else opts.signal.addEventListener('abort',()=>request.destroy(opts.signal.reason??new Error('aborted')),{once:true});}
    request.end(payload);
  });
}
