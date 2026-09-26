import {superviseProcesses} from '../src/ops/process-supervisor.mjs';

const supervisor=superviseProcesses();
console.error(JSON.stringify({
  sledgewire:'arena-all',
  event:'started',
  processes:[...supervisor.children.keys()]
}));
