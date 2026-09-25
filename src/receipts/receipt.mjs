import fs from 'node:fs';
import {createHash,createPrivateKey,createPublicKey,generateKeyPairSync,sign,verify} from 'node:crypto';

function canon(value){
  if(value===null)return 'null';
  if(typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'){if(!Number.isFinite(value))throw new TypeError('receipt_contains_non_finite_number');return JSON.stringify(value);}
  if(Array.isArray(value))return `[${value.map(canon).join(',')}]`;
  if(typeof value==='object'){
    const entries=[];for(const key of Object.keys(value).sort()){if(value[key]===undefined)throw new TypeError(`receipt_contains_undefined:${key}`);entries.push(`${JSON.stringify(key)}:${canon(value[key])}`);}
    return `{${entries.join(',')}}`;
  }
  throw new TypeError(`receipt_contains_unsupported_type:${typeof value}`);
}
export const stable=canon;
export function sha256(value){return createHash('sha256').update(typeof value==='string'?value:canon(value)).digest('hex');}
export function generateSigningKeypair(){const {publicKey,privateKey}=generateKeyPairSync('ed25519');return {publicKeyPem:publicKey.export({type:'spki',format:'pem'}),privateKeyPem:privateKey.export({type:'pkcs8',format:'pem'})};}
export function keyId(publicKeyPem){const der=createPublicKey(publicKeyPem).export({type:'spki',format:'der'});return `ed25519:${createHash('sha256').update(der).digest('hex').slice(0,24)}`;}
export function publicFromPrivate(privateKeyPem){return createPublicKey(createPrivateKey(privateKeyPem)).export({type:'spki',format:'pem'});}
export function loadSigningMaterial({production=process.env.NODE_ENV==='production'}={}){
  const privateFile=process.env.SLEDGEWIRE_PRIVATE_KEY_FILE,publicFile=process.env.SLEDGEWIRE_PUBLIC_KEY_FILE;
  const privateEnv=process.env.SLEDGEWIRE_PRIVATE_KEY_PEM?.replace(/\\n/g,'\n'),publicEnv=process.env.SLEDGEWIRE_PUBLIC_KEY_PEM?.replace(/\\n/g,'\n');
  let privateKeyPem=privateEnv||(privateFile?fs.readFileSync(privateFile,'utf8'):null),publicKeyPem=publicEnv||(publicFile?fs.readFileSync(publicFile,'utf8'):null),ephemeral=false;
  if(!privateKeyPem){if(production)throw new Error('production_signing_key_required');const kp=generateSigningKeypair();privateKeyPem=kp.privateKeyPem;publicKeyPem=kp.publicKeyPem;ephemeral=true;}
  const derived=publicFromPrivate(privateKeyPem);if(publicKeyPem&&keyId(publicKeyPem)!==keyId(derived))throw new Error('public_private_key_mismatch');publicKeyPem||=derived;
  return {privateKeyPem,publicKeyPem,keyId:keyId(publicKeyPem),ephemeral};
}
export function signReceipt(payload,privateKeyPem){
  const body=canon(payload),publicKeyPem=publicFromPrivate(privateKeyPem),signature=sign(null,Buffer.from(body),privateKeyPem).toString('base64url');
  return {...payload,proof:{alg:'Ed25519',key_id:keyId(publicKeyPem),body_sha256:sha256(body),signature}};
}
export function verifyReceipt(receipt,publicKeyPem){
  if(!receipt||typeof receipt!=='object'||!receipt.proof?.signature)return {ok:false,reason:'missing_signature'};
  const {proof,...payload}=receipt;if(proof.alg!=='Ed25519')return {ok:false,reason:'unsupported_signature_algorithm'};
  let publicId,body,signature;
  try{publicId=keyId(publicKeyPem);}catch{return {ok:false,reason:'invalid_public_key'};}
  try{body=canon(payload);}catch(error){return {ok:false,reason:String(error.message||error)};}
  if(sha256(body)!==proof.body_sha256)return {ok:false,reason:'body_hash_mismatch'};
  if(proof.key_id&&proof.key_id!==publicId)return {ok:false,reason:'key_id_mismatch'};
  try{signature=Buffer.from(String(proof.signature),'base64url');if(signature.length!==64)return {ok:false,reason:'invalid_signature_encoding'};}catch{return {ok:false,reason:'invalid_signature_encoding'};}
  try{const ok=verify(null,Buffer.from(body),publicKeyPem,signature);return {ok,reason:ok?null:'signature_invalid',key_id:publicId};}
  catch{return {ok:false,reason:'signature_verification_error',key_id:publicId};}
}
