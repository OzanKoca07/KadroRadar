const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');const Module=require('node:module');
const filename=require('node:path').resolve(__dirname,'../mobile/lib/account.ts');
const compiled=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const loaded=new Module(filename,module);loaded._compile(compiled,filename);const {accountRequest,setSession,hasSession}=loaded.exports;
(async()=>{
 const original=global.fetch,base=process.env.EXPO_PUBLIC_API_URL,timer=global.setTimeout;
 try{
  delete process.env.EXPO_PUBLIC_API_URL;await assert.rejects(accountRequest('/account/profile'),/yapılandırılmamış/);
  process.env.EXPO_PUBLIC_API_URL='https://api.example.test/api/v1';
  global.fetch=async()=>{throw Error('offline')};await assert.rejects(accountRequest('/account/profile'),/offline/);
  global.fetch=async()=>({status:500,ok:false});await assert.rejects(accountRequest('/account/profile'),/500/);
  setSession('ephemeral-test-token');global.fetch=async()=>({status:401,ok:false});await assert.rejects(accountRequest('/account/profile'),/giriş/);assert.equal(hasSession(),false);
  setSession('ephemeral-test-token');const restarted=new Module(filename,module);restarted._compile(compiled,filename);assert.equal(restarted.exports.hasSession(),false);assert.equal(hasSession(),true);setSession(null);
  global.setTimeout=(callback)=>timer(callback,1);global.fetch=async(url,init)=>new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(Object.assign(Error(),{name:'AbortError'}))));await assert.rejects(accountRequest('/account/profile'),/zaman aşımına/);
  global.fetch=async()=>({status:200,ok:true,json:async()=>({items:[]})});assert.deepEqual(await accountRequest('/account/matches'),{items:[]});
  console.log('PASS: mobile API missing config, offline, HTTP 500, expired session, timeout, empty result');
 }finally{global.fetch=original;global.setTimeout=timer;if(base===undefined)delete process.env.EXPO_PUBLIC_API_URL;else process.env.EXPO_PUBLIC_API_URL=base;}
})().catch(e=>{console.error(e);process.exitCode=1;});
