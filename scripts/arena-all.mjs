import {superviseProcesses} from '../src/ops/process-supervisor.mjs';
import {prepareSingleContainerRuntime,scrubParentSecretCopies} from '../src/ops/arena-runtime.mjs';

const runtime=prepareSingleContainerRuntime();
const supervisor=superviseProcesses({
  commands:[
    {name:'public',args:['src/server/http.mjs'],env:runtime.publicEnv},
    {name:'arena-daemon',args:['src/sharednet/arena-daemon.mjs'],env:runtime.daemonEnv}
  ]
});
scrubParentSecretCopies(runtime);
console.error(JSON.stringify({
  sledgewire:'arena-all',
  event:'started',
  processes:[...supervisor.children.keys()],
  db:runtime.dbPath,
  dropped_privileges:runtime.dropped,
  runtime_uid:runtime.runtimeUid,
  runtime_gid:runtime.runtimeGid
}));
