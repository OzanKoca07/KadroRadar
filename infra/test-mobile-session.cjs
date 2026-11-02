const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{loadAccount}=require('./mobile-account-test-loader.cjs');
const key='kadroradar.session.v1',valid=()=>({token:'a'.repeat(64),expiresAt:new Date(Date.now()+3600000).toISOString()}),response=(status,data={})=>({status,ok:status<400,json:async()=>data});
(async()=>{const originalFetch=global.fetch,originalBase=process.env.EXPO_PUBLIC_API_URL;let checks=0;
try{
 process.env.EXPO_PUBLIC_API_URL='https://api.example.test/api/v1';
 const {api,storage,controls}=loadAccount();await api.restoreSession();assert.equal(api.hasSession(),false);checks++;
 await api.saveSession(valid());assert.equal(api.hasSession(),true);assert.equal(controls.lastOptions.keychainAccessible,6);assert.deepEqual(Object.keys(JSON.parse(storage.get(key))).sort(),['apiBase','expiresAt','token','version']);checks++;
 const restarted=loadAccount(storage).api;assert.equal(restarted.hasSession(),false);await restarted.restoreSession();assert.equal(restarted.hasSession(),true);checks++;
 global.fetch=async(_url,options)=>{assert.equal(options.credentials,'omit');return response(200);};await restarted.accountRequest('/account/logout','POST',{});assert.equal(storage.size,0);assert.equal(restarted.hasSession(),false);checks++;
 await restarted.saveSession(valid());await restarted.accountRequest('/account','DELETE');assert.equal(storage.size,0);assert.equal(restarted.hasSession(),false);checks++;
 await api.saveSession(valid());global.fetch=async()=>response(401);await assert.rejects(api.accountRequest('/account/profile'),e=>e.code==='SESSION_REQUIRED');assert.equal(storage.size,0);assert.equal(api.hasSession(),false);checks++;
 await api.saveSession(valid());global.fetch=async()=>response(403);await assert.rejects(api.accountRequest('/account/profile'),e=>e.code==='ACCESS_DENIED');assert.equal(api.hasSession(),true);checks++;
 for(const raw of ['{',JSON.stringify({version:1,token:'bad'}),JSON.stringify({...JSON.parse(storage.get(key)),expiresAt:Date.now()-1})]){storage.set(key,raw);const app=loadAccount(storage).api;await app.restoreSession();assert.equal(app.hasSession(),false);assert.equal(storage.size,0);checks++;}
 await api.saveSession(valid());process.env.EXPO_PUBLIC_API_URL='https://other.example.test/api/v1';const other=loadAccount(storage).api;await other.restoreSession();assert.equal(other.hasSession(),false);assert.equal(storage.size,0);checks++;
 process.env.EXPO_PUBLIC_API_URL='https://api.example.test/api/v1';
 await assert.rejects(api.saveSession({token:'bad',expiresAt:valid().expiresAt}),e=>e.code==='INVALID_RESPONSE');checks++;
 await assert.rejects(api.saveSession({token:valid().token,expiresAt:new Date(Date.now()+10*3600000).toISOString()}),e=>e.code==='INVALID_RESPONSE');checks++;
 for(const control of [{available:false},{failRead:true}]){const app=loadAccount(new Map(),control).api;await assert.rejects(app.restoreSession(),e=>e.code==='SESSION_STORAGE'&&!e.message.includes('PRIVATE'));assert.equal(app.hasSession(),false);checks++;}
 const writeFailure=loadAccount(new Map(),{failWrite:true}).api;await assert.rejects(writeFailure.saveSession(valid()),e=>e.code==='SESSION_STORAGE');assert.equal(writeFailure.hasSession(),false);checks++;
 const failingDelete=loadAccount();await failingDelete.api.saveSession(valid());failingDelete.controls.failDelete=true;await assert.rejects(failingDelete.api.clearSession(),e=>e.code==='SESSION_STORAGE');assert.equal(failingDelete.api.hasSession(),false);checks++;
 const expiry=loadAccount();await expiry.api.saveSession(valid());const clock=Date.now;try{Date.now=()=>clock()+9*3600000;assert.equal(expiry.api.hasSession(),false);await expiry.api.restoreSession();assert.equal(expiry.storage.size,0);checks++;}finally{Date.now=clock;}
 const origin=process.env.EXPO_PUBLIC_API_URL;try{process.env.EXPO_PUBLIC_API_URL='http://untrusted.example.test/api/v1';await assert.rejects(loadAccount().api.saveSession(valid()),e=>e.code==='INVALID_RESPONSE');checks++;}finally{process.env.EXPO_PUBLIC_API_URL=origin;}
 let releaseRead;const gate=new Promise(r=>releaseRead=r),race=loadAccount(new Map([[key,JSON.stringify({version:1,token:valid().token,expiresAt:Date.now()+3600000,apiBase:process.env.EXPO_PUBLIC_API_URL})]]),{read:()=>gate});const restoring=race.api.restoreSession();const clearing=race.api.clearSession();releaseRead();await Promise.all([restoring,clearing]);assert.equal(race.api.hasSession(),false);assert.equal(race.storage.size,0);checks++;
 await api.saveSession(valid());let resolveOld;global.fetch=()=>new Promise(r=>resolveOld=r);const old=api.accountRequest('/account/profile');await new Promise(r=>setImmediate(r));await api.saveSession({...valid(),token:'b'.repeat(64)});resolveOld(response(401));await assert.rejects(old);assert.equal(api.hasSession(),true);checks++;
 let calls=0;const unsubscribe=api.subscribeSession(()=>calls++);await api.clearSession();unsubscribe();assert.ok(calls>0);checks++;
 const source=fs.readFileSync(path.resolve(__dirname,'../apps/mobile/lib/account.ts'),'utf8');assert.ok(!/AsyncStorage|localStorage|console\./.test(source));checks++;
 console.log(JSON.stringify({status:'PASS',test:'mobile-secure-session',checks,nativeKeyStoreDeviceTest:false}));
}finally{global.fetch=originalFetch;if(originalBase===undefined)delete process.env.EXPO_PUBLIC_API_URL;else process.env.EXPO_PUBLIC_API_URL=originalBase;}})().catch(e=>{console.error(JSON.stringify({status:'FAIL',test:'mobile-secure-session',kind:e.name}));process.exitCode=1;});
