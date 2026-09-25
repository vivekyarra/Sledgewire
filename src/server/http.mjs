import http from 'node:http';
import {handleRpc,validateHttpMcp,PUBLIC,PUBLIC_KEY_ID,catalog,toolDefs} from './protocol.mjs';
import {arenaCard,arenaMarkdown} from './arena-card.mjs';
import {isJsonContentType} from './http-guards.mjs';
import {allowedHostSet,hostHeaderAllowed} from './host-guard.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {ArenaStore} from '../store/arena-store.mjs';
import {readArenaDaemonReadiness} from '../ops/readiness.mjs';

const port=Number(process.env.PORT||8787);
const base=process.env.PUBLIC_BASE_URL||`http://127.0.0.1:${port}`;
const production=process.env.NODE_ENV==='production',paidBypass=process.env.SLEDGEWIRE_PUBLIC_PAID_EXECUTION==='1';
if(production&&!base.startsWith('https://'))throw new Error('production_public_base_url_https_required');
if(base.startsWith('https://')&&!production)throw new Error('public_https_requires_node_env_production');
if(production&&paidBypass)throw new Error('production_paid_execution_bypass_forbidden');
let active=0;const maxActive=Math.max(4,Math.min(256,Number(process.env.SLEDGEWIRE_HTTP_CONCURRENCY??64)));
const publicArena=!paidBypass;
const arenaRoomId=process.env.SHAREDNET_ARENA_ROOM_ID??null;
const dbPath=process.env.SLEDGEWIRE_DB??'.sledgewire/arena.db';fs.mkdirSync(path.dirname(path.resolve(dbPath)),{recursive:true});const traceStore=new ArenaStore(dbPath);
const allowedOrigins=new Set([new URL(base).origin,...String(process.env.SLEDGEWIRE_ALLOWED_ORIGINS??'').split(',').map(x=>x.trim()).filter(Boolean)]);
const allowedHosts=allowedHostSet(base,process.env.SLEDGEWIRE_ALLOWED_HOSTS??'');

const server=http.createServer(async(req,res)=>{
  res.setHeader('x-content-type-options','nosniff');res.setHeader('referrer-policy','no-referrer');res.setHeader('cache-control','no-store');
  if(req.method==='GET'&&req.url==='/health'){
    const daemon=readArenaDaemonReadiness(traceStore,arenaRoomId);
    return json(res,200,{ok:true,name:'sledgewire',version:'0.3.7',key_id:PUBLIC_KEY_ID,active_requests:active,paid_execution:publicArena?'sharednet-payment-required':'direct-enabled',arena_daemon:daemon});
  }
  if(req.method==='GET'&&req.url==='/ready'){
    const daemon=readArenaDaemonReadiness(traceStore,arenaRoomId),ready=daemon.ready;
    return json(res,ready?200:503,{ready,name:'sledgewire',version:'0.3.7',key_id:PUBLIC_KEY_ID,paid_execution:publicArena?'sharednet-payment-required':'direct-enabled',arena_daemon:daemon});
  }
  if(req.method==='GET'&&req.url==='/catalog.json')return json(res,200,catalog);
  if(req.method==='GET'&&req.url==='/arena.json')return json(res,200,arenaCard(base));
  if(req.method==='GET'&&req.url==='/arena.md'){res.statusCode=200;res.setHeader('content-type','text/markdown; charset=utf-8');return res.end(arenaMarkdown(base));}
  if(req.method==='GET'&&req.url==='/public-key'){res.statusCode=200;res.setHeader('content-type','text/plain; charset=utf-8');return res.end(PUBLIC);}
  if(req.method==='GET'&&req.url==='/.well-known/agent.json'){const card=arenaCard(base);return json(res,200,{name:'Sledgewire',description:card.one_line,version:'0.3.7',mcp_url:card.mcp_url,quickstart_url:card.quickstart_url,catalog_url:card.catalog_url,public_key_url:card.public_key_url,fastest_demo:card.fastest_demo,tools:toolDefs.map(x=>x.name)});}
  if(req.method!=='POST'||req.url!=='/mcp'){res.statusCode=404;return res.end('not found');}
  if(production&&!hostHeaderAllowed(req.headers.host,allowedHosts))return json(res,403,{jsonrpc:'2.0',id:null,error:{code:-32000,message:'Host not allowed'}});
  const origin=String(req.headers.origin??'');if(origin&&!allowedOrigins.has(origin))return json(res,403,{jsonrpc:'2.0',id:null,error:{code:-32000,message:'Origin not allowed'}});
  if(active>=maxActive)return json(res,503,{error:'server_busy'});
  if(!isJsonContentType(req.headers['content-type']))return json(res,415,{error:'application_json_required'});
  active++;
  try{
    const chunks=[];let bytes=0;
    for await(const c of req){
      const b=Buffer.isBuffer(c)?c:Buffer.from(c);bytes+=b.length;
      if(bytes>1_000_000){req.resume();res.statusCode=413;return res.end();}
      chunks.push(b);
    }
    let msg;try{msg=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return json(res,400,{error:'invalid_json'});}
    const validation=validateHttpMcp(msg,req.headers);if(!validation.ok)return json(res,validation.status,validation.body);
    const out=await handleRpc(msg,{publicArena,publicBaseUrl:base,arenaRoomId,traceStore});if(out===null){res.statusCode=202;return res.end();}
    return json(res,200,out);
  }finally{active--;}
});
server.listen(port,()=>console.error(`sledgewire http listening on ${port}`));
function json(res,status,value){res.statusCode=status;res.setHeader('content-type','application/json');res.end(JSON.stringify(value));}
