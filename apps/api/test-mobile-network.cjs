const assert=require('node:assert/strict'),{loadAccount}=require('../../infra/mobile-account-test-loader.cjs');
const fixture=loadAccount(),{accountRequest,saveSession,clearSession,hasSession,registrationPolicy}=fixture.api;
const setSession=async value=>value?saveSession({token:'a'.repeat(64),expiresAt:new Date(Date.now()+3600000).toISOString()}):clearSession();
(async()=>{const original=global.fetch,base=process.env.EXPO_PUBLIC_API_URL,timer=global.setTimeout;try{
 process.env.EXPO_PUBLIC_API_URL='https://api.example.test/api/v1';let calls=0;global.fetch=async()=>{calls++;throw Error('private-network-details')};await assert.rejects(accountRequest('/account/saved'),e=>e.code==='SESSION_REQUIRED');assert.equal(calls,0);
 await setSession(true);await assert.rejects(accountRequest('/account/profile'),/İnternet bağlantını kontrol et/);
 for(const [status,code,expected] of [[401,undefined,'INVALID_CREDENTIALS'],[403,'REGISTRATION_DISABLED','REGISTRATION_DISABLED'],[403,undefined,'ACCESS_DENIED'],[422,undefined,'INVALID_INPUT'],[429,undefined,'RATE_LIMITED'],[403,'AUTH_RATE_LIMITED','RATE_LIMITED'],[500,undefined,'SERVICE_UNAVAILABLE']]){global.fetch=async()=>({status,ok:false,json:async()=>({code,message:'PRIVATE_STACK_OR_SQL'})});await assert.rejects(accountRequest(code==='REGISTRATION_DISABLED'?'/account/register':'/account/login','POST',{}),e=>e.code===expected&&!/HTTP|401|403|422|429|500|PRIVATE/.test(e.message));}
 global.fetch=async()=>({status:401,ok:false,json:async()=>({})});await assert.rejects(accountRequest('/account/profile'),e=>e.code==='SESSION_REQUIRED');assert.equal(hasSession(),false);
 await setSession(true);const restarted=loadAccount(fixture.storage).api;assert.equal(restarted.hasSession(),false);await restarted.restoreSession();assert.equal(restarted.hasSession(),true);
 global.setTimeout=callback=>timer(callback,1);global.fetch=async(url,init)=>new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(Object.assign(Error(),{name:'AbortError'}))));await assert.rejects(accountRequest('/account/profile'),e=>e.code==='TIMEOUT');global.setTimeout=timer;
 for(const [value,expected] of [[true,'OPEN'],[false,'CLOSED'],[null,'UNKNOWN']]){global.fetch=async()=>({ok:true,json:async()=>({selfRegistration:value})});assert.equal(await registrationPolicy(),expected);}
 global.fetch=async()=>({status:404,ok:false,json:async()=>({})});assert.equal(await registrationPolicy(),'UNKNOWN');
 global.fetch=async()=>({ok:true,json:async()=>({items:[]})});assert.deepEqual(await accountRequest('/account/matches'),{items:[]});
 delete process.env.EXPO_PUBLIC_API_URL;await assert.rejects(accountRequest('/account/profile'),e=>e.code==='CONFIGURATION');
 console.log('PASS mobile auth: no-session skips fetch; 401/403/422/429/500, network/timeout, no raw messages, policy OPEN/CLOSED/UNKNOWN, secure restart session');
}finally{await clearSession();global.fetch=original;global.setTimeout=timer;if(base===undefined)delete process.env.EXPO_PUBLIC_API_URL;else process.env.EXPO_PUBLIC_API_URL=base;}})().catch(e=>{console.error(e);process.exitCode=1;});
