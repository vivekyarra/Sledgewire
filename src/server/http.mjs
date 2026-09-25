import http from 'node:http';import {handleRpc,PUBLIC,PUBLIC_KEY_ID,catalog,toolDefs} from './protocol.mjs';
const port=Number(process.env.PORT||8787);const base=process.env.PUBLIC_BASE_URL||`http://127.0.0.1:${port}`;
const server=http.createServer(async(req,res)=>{res.setHeader('x-content-type-options','nosniff');res.setHeader('referrer-policy','no-referrer');res.setHeader('cache-control','no-store');
 if(req.method==='GET'&&req.url==='/health')return json(res,200,{ok:true,name:'sledgewire',version:'0.2.0',key_id:PUBLIC_KEY_ID});
 if(req.method==='GET'&&req.url==='/catalog.json')return json(res,200,catalog);
 if(req.method==='GET'&&req.url==='/public-key'){res.statusCode=200;res.setHeader('content-type','text/plain; charset=utf-8');return res.end(PUBLIC);}
 if(req.method==='GET'&&req.url==='/.well-known/agent.json')return json(res,200,{name:'Sledgewire',description:'Adversarial MCP preflight, bounded repair, SharedOS-governed Arena execution, signed receipts.',version:'0.2.0',mcp_url:`${base.replace(/\/$/,'')}/mcp`,catalog_url:`${base.replace(/\/$/,'')}/catalog.json`,public_key_url:`${base.replace(/\/$/,'')}/public-key`,tools:toolDefs.map(x=>x.name)});
 if(req.method!=='POST'||req.url!=='/mcp'){res.statusCode=404;return res.end('not found');}
 let body='';for await(const c of req){body+=c;if(Buffer.byteLength(body)>1_000_000){res.statusCode=413;return res.end();}}let msg;try{msg=JSON.parse(body);}catch{return json(res,400,{error:'invalid_json'});}const out=await handleRpc(msg);if(out===null){res.statusCode=202;return res.end();}return json(res,200,out);
});server.listen(port,()=>console.error(`sledgewire http listening on ${port}`));
function json(res,status,value){res.statusCode=status;res.setHeader('content-type','application/json');res.end(JSON.stringify(value));}
