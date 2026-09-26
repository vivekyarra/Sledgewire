import {spawn} from 'node:child_process';

function normalizeExitCode(code,signal){
  if(Number.isInteger(code))return code;
  if(signal)return 1;
  return 1;
}

export function superviseProcesses({
  commands=[
    {name:'public',args:['src/server/http.mjs']},
    {name:'arena-daemon',args:['src/sharednet/arena-daemon.mjs']}
  ],
  spawnImpl=spawn,
  execPath=process.execPath,
  env=process.env,
  killTimeoutMs=5_000,
  onExit=code=>{process.exitCode=code;},
  signalHost=process
}={}){
  if(!Array.isArray(commands)||commands.length<2)throw new Error('supervisor_requires_multiple_processes');
  if(!Number.isSafeInteger(killTimeoutMs)||killTimeoutMs<100||killTimeoutMs>60_000)throw new Error('invalid_supervisor_kill_timeout');
  const names=new Set();
  for(const command of commands){
    if(!command||typeof command.name!=='string'||!command.name||!Array.isArray(command.args)||command.args.some(x=>typeof x!=='string')||(command.env!==undefined&&(command.env===null||typeof command.env!=='object'||Array.isArray(command.env))))throw new Error('invalid_supervisor_command');
    if(names.has(command.name))throw new Error('duplicate_supervisor_command_name');
    names.add(command.name);
  }

  const children=new Map();
  let stopping=false,shutdownSignal=null,finished=false,forceTimer=null;

  const alive=()=>[...children.values()].filter(x=>!x.exited);
  const send=(entry,signal)=>{
    if(entry.exited)return;
    try{entry.child.kill(signal);}catch{}
  };
  const maybeFinish=()=>{
    if(finished||alive().length!==0)return;
    finished=true;
    if(forceTimer){clearTimeout(forceTimer);forceTimer=null;}
    const unexpected=[...children.values()].find(x=>x.unexpected);
    onExit(stopping&&!unexpected?0:(unexpected?.exitCode??1));
  };
  const beginShutdown=(signal='SIGTERM',unexpected=null)=>{
    if(unexpected)unexpected.unexpected=true;
    if(!stopping){stopping=true;shutdownSignal=signal;}
    for(const entry of alive())if(entry!==unexpected)send(entry,signal);
    if(!forceTimer){
      forceTimer=setTimeout(()=>{
        for(const entry of alive())send(entry,'SIGKILL');
      },killTimeoutMs);
      forceTimer.unref?.();
    }
    maybeFinish();
  };

  for(const command of commands){
    let child;
    try{child=spawnImpl(execPath,command.args,{env:command.env??env,stdio:'inherit'});}catch(error){
      for(const entry of alive())send(entry,'SIGTERM');
      throw error;
    }
    const entry={name:command.name,child,exited:false,exitCode:null,unexpected:false};
    children.set(command.name,entry);
    child.once('error',error=>{
      if(entry.exited)return;
      entry.exited=true;entry.exitCode=1;entry.error=error;entry.unexpected=!stopping;
      if(!stopping)beginShutdown('SIGTERM',entry);
      maybeFinish();
    });
    child.once('exit',(code,signal)=>{
      if(entry.exited)return;
      entry.exited=true;entry.exitCode=normalizeExitCode(code,signal);
      if(!stopping){entry.unexpected=true;beginShutdown('SIGTERM',entry);}
      maybeFinish();
    });
  }

  const handlers=new Map();
  for(const signal of ['SIGTERM','SIGINT']){
    const handler=()=>beginShutdown(signal);
    handlers.set(signal,handler);
    signalHost.once(signal,handler);
  }

  const dispose=()=>{
    for(const [signal,handler] of handlers)signalHost.removeListener(signal,handler);
    if(forceTimer)clearTimeout(forceTimer);
  };

  return {children,shutdown:signal=>beginShutdown(signal),dispose,get state(){return {stopping,shutdownSignal,finished};}};
}
