export async function mapLimitFair(items,limit,keyFn,fn){
  if(!Array.isArray(items))throw new Error('fair_map_items_required');
  if(!Number.isSafeInteger(limit)||limit<1||limit>1024)throw new Error('fair_map_invalid_limit');
  if(typeof keyFn!=='function'||typeof fn!=='function')throw new Error('fair_map_functions_required');
  if(items.length===0)return [];
  const queues=new Map(),ready=[];
  for(let i=0;i<items.length;i++){
    const raw=keyFn(items[i],i),key=raw===null||raw===undefined?'__item_'+i:String(raw);
    let q=queues.get(key);if(!q){q=[];queues.set(key,q);ready.push(key);}q.push(i);
  }
  const out=new Array(items.length);
  let active=0,remaining=items.length,resolved=false;
  return new Promise((resolve,reject)=>{
    const pump=()=>{
      if(resolved)return;
      if(remaining===0){resolved=true;return resolve(out);}
      while(active<limit&&ready.length){
        const key=ready.shift(),q=queues.get(key),index=q.shift();
        active++;
        Promise.resolve().then(()=>fn(items[index],index)).then(value=>{out[index]=value;}).catch(error=>{
          if(!resolved){resolved=true;reject(error);}
        }).finally(()=>{
          active--;remaining--;
          if(q.length)ready.push(key);
          if(!resolved)pump();
        });
      }
    };
    pump();
  });
}
