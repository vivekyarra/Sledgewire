import {startFixture} from '../../fixtures/server.mjs';
import {smoke} from './smoke.mjs';

const CASES=[
  ['clean','READY'],['modern','READY'],['injection','DEGRADED'],['description_injection','DEGRADED'],
  ['fake_success','INCOMPATIBLE'],['malformed','INCOMPATIBLE'],['oversized','INCOMPATIBLE'],
  ['destructive','BLOCKED'],['redirect','INCOMPATIBLE'],['huge_catalog','INCOMPATIBLE']
];
let cached=null,cachedAt=0,inflight=null;const TTL_MS=15_000;
async function run(){
  const cases=[];
  for(const [mode,expected] of CASES){
    const f=await startFixture({mode});
    try{
      const report=await smoke(f.url,{targetPolicy:{allowHttp:true,allowPrivate:true},maxBytes:100_000,timeoutMs:300,probe:{name:'safe_echo',arguments:{text:'hello'},safe:true}});
      cases.push({mode,expected,observed:report.state,ok:report.state===expected,checks:report.checks});
    }finally{await f.close();}
  }
  const ok=cases.every(x=>x.ok);return {service:'sledgewire.selfcheck',profile:'sledgewire.selfcheck.v4',state:ok?'READY':'DEGRADED',verified:ok,cases,non_claims:['global_security','semantic_truth','absence_of_vulnerabilities']};
}
export async function selfcheck(){if(cached&&Date.now()-cachedAt<TTL_MS)return cached;if(inflight)return inflight;inflight=run().then(x=>{cached=x;cachedAt=Date.now();return x;}).finally(()=>{inflight=null;});return inflight;}
