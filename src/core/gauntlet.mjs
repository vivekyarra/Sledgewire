import {smoke} from './smoke.mjs';
import {assay} from './assay.mjs';
import {invoke} from './invoke.mjs';
import {sealFromReports} from './seal.mjs';
import {sha256} from '../receipts/receipt.mjs';

export async function gauntlet(endpoint,{probe,request,...opts}={}){
  const smokeReport=await smoke(endpoint,{...opts,probe});
  const assayReport=await assay(endpoint,{...opts,probe});
  const conformance=sealFromReports(endpoint,smokeReport,assayReport);
  const execution=request?await invoke(endpoint,request,opts):{state:'UNKNOWN',reason:'invocation_not_requested'};
  const states=[smokeReport.state,assayReport.state,conformance.state,...(request?[execution.state]:[])];
  const state=states.includes('BLOCKED')?'BLOCKED':states.includes('INCOMPATIBLE')?'INCOMPATIBLE':states.includes('DEGRADED')?'DEGRADED':states.includes('UNKNOWN')?'UNKNOWN':'READY';
  const dossier={service:'sledgewire.gauntlet',profile:'sledgewire.gauntlet.v1',endpoint,state,smoke:smokeReport,assay:assayReport,conformance,execution};
  return {...dossier,dossier_sha256:sha256(dossier)};
}
