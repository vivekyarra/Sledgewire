export function isJsonContentType(value){
  const raw=Array.isArray(value)?value[0]:value;
  if(typeof raw!=='string')return false;
  return raw.split(';',1)[0].trim().toLowerCase()==='application/json';
}
