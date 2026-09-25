export function exactPriceMap(actual,expected){
  if(!actual||!expected||typeof actual!=='object'||typeof expected!=='object')return false;
  const actualKeys=Object.keys(actual),expectedKeys=Object.keys(expected);
  if(actualKeys.length!==expectedKeys.length)return false;
  return expectedKeys.every(k=>Object.prototype.hasOwnProperty.call(actual,k)&&actual[k]===expected[k]);
}
