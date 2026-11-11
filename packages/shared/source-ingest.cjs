// Scoped machine authentication, never a user/admin session credential.
const {createHash,createHmac,timingSafeEqual,randomUUID}=require('node:crypto');
const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(canonical).join(',')+']':'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
const digest=value=>createHash('sha256').update(canonical(value)).digest('hex');
function config(origin,key){try{const u=new URL(origin);if(u.protocol!=='https:'||u.origin!==origin||u.username||u.password||! /^[a-f0-9]{64}$/i.test(key||''))throw Error();}catch{throw Error('INGEST_CONFIGURATION_INVALID');}}
function signature(key,origin,route,bodyHash,timestamp,nonce){config(origin,key);if(!/^\/api\/v1\/source-ingest\/(?:gazette|career)\/(claim|complete)$/.test(route)||!/^[a-f0-9]{64}$/.test(bodyHash||''))throw Error('INGEST_ROUTE_INVALID');return createHmac('sha256',Buffer.from(key,'hex')).update(['KADRORADAR_SOURCE_V1',origin,'POST',route,timestamp,nonce,bodyHash].join('\n')).digest('hex');}
function headers(key,origin,route,body,now=Date.now(),nonce=randomUUID()){const timestamp=String(Math.floor(now/1000)),bodyHash=digest(body);return {'content-type':'application/json','x-source-time':timestamp,'x-source-nonce':nonce,'x-source-body-sha256':bodyHash,'x-source-signature':signature(key,origin,route,bodyHash,timestamp,nonce)};}
function verifyHeaders(key,origin,route,headers,now=Date.now()){
 try{const time=headers['x-source-time'],nonce=headers['x-source-nonce'],actual=headers['x-source-signature'];if(!/^\d{10}$/.test(time||'')||Math.abs(now-Number(time)*1000)>300000||! /^[a-f0-9-]{36}$/i.test(nonce||'')||! /^[a-f0-9]{64}$/i.test(actual||''))return false;return timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(signature(key,origin,route,headers['x-source-body-sha256'],time,nonce),'hex'));}catch{return false;}
}
function verify(key,origin,route,body,headers,now=Date.now()){try{return verifyHeaders(key,origin,route,headers,now)&&headers['x-source-body-sha256']===digest(body);}catch{return false;}}
module.exports={canonical,digest,headers,verify,verifyHeaders,config};
