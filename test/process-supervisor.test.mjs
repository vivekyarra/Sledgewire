import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {superviseProcesses} from '../src/ops/process-supervisor.mjs';

class FakeChild extends EventEmitter{
  constructor(name){super();this.name=name;this.kills=[];}
  kill(signal){this.kills.push(signal);return true;}
}
function harness({throwOn=0}={}){
  const signalHost=new EventEmitter(),children=[],calls=[];let exits=[];
  const spawnImpl=(execPath,args,opts)=>{
    calls.push({execPath,args,opts});
    if(throwOn&&calls.length===throwOn)throw new Error('spawn_failed');
    const child=new FakeChild(args.join(' '));children.push(child);return child;
  };
  const supervisor=()=>superviseProcesses({
    commands:[{name:'public',args:['public.mjs']},{name:'daemon',args:['daemon.mjs']}],
    spawnImpl,execPath:'/node',env:{TEST:'1'},signalHost,killTimeoutMs:100,
    onExit:code=>exits.push(code)
  });
  return {signalHost,children,calls,get exits(){return exits;},supervisor};
}

test('unexpected child exit terminates sibling and reports failing exit code',()=>{
  const h=harness(),s=h.supervisor();
  assert.equal(h.calls.length,2);
  h.children[0].emit('exit',7,null);
  assert.deepEqual(h.children[1].kills,['SIGTERM']);
  assert.deepEqual(h.exits,[]);
  h.children[1].emit('exit',0,'SIGTERM');
  assert.deepEqual(h.exits,[7]);
  s.dispose();
});

test('graceful SIGTERM is forwarded to both children and exits zero',()=>{
  const h=harness(),s=h.supervisor();
  h.signalHost.emit('SIGTERM');
  assert.deepEqual(h.children[0].kills,['SIGTERM']);
  assert.deepEqual(h.children[1].kills,['SIGTERM']);
  h.children[0].emit('exit',0,'SIGTERM');
  h.children[1].emit('exit',0,'SIGTERM');
  assert.deepEqual(h.exits,[0]);
  assert.equal(s.state.shutdownSignal,'SIGTERM');
  s.dispose();
});

test('per-command environment overrides keep child secrets scoped',()=>{
  const signalHost=new EventEmitter(),calls=[],children=[];
  const spawnImpl=(execPath,args,opts)=>{calls.push({execPath,args,opts});const child=new FakeChild(args[0]);children.push(child);return child;};
  const s=superviseProcesses({
    commands:[
      {name:'public',args:['public.mjs'],env:{ROLE:'public'}},
      {name:'daemon',args:['daemon.mjs'],env:{ROLE:'daemon',TOKEN:'secret'}}
    ],
    spawnImpl,execPath:'/node',env:{ROLE:'default'},signalHost,killTimeoutMs:100,onExit:()=>{}
  });
  assert.deepEqual(calls[0].opts.env,{ROLE:'public'});
  assert.deepEqual(calls[1].opts.env,{ROLE:'daemon',TOKEN:'secret'});
  s.shutdown('SIGTERM');for(const child of children)child.emit('exit',0,'SIGTERM');s.dispose();
});

test('invalid or duplicate command definitions fail before spawning',()=>{
  let calls=0;
  assert.throws(()=>superviseProcesses({
    commands:[{name:'x',args:['a']},{name:'x',args:['b']}],
    spawnImpl:()=>{calls++;return new FakeChild('x');},
    signalHost:new EventEmitter()
  }),/duplicate_supervisor_command_name/);
  assert.equal(calls,0);
});

test('synchronous second spawn failure terminates the already-started child',()=>{
  const h=harness({throwOn:2});
  assert.throws(()=>h.supervisor(),/spawn_failed/);
  assert.equal(h.children.length,1);
  assert.deepEqual(h.children[0].kills,['SIGTERM']);
});
