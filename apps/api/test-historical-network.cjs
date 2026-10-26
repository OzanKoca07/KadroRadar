const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),Module=require('node:module');
const filename=path.resolve(__dirname,'../mobile/lib/historical-api.ts'),code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const loaded=new Module(filename,module);loaded._compile(code,filename);const {historicalRequest}=loaded.exports;
(async()=>{const original=global.fetch,base=process.env.EXPO_PUBLIC_API_URL,timer=global.setTimeout;try{
 delete process.env.EXPO_PUBLIC_API_URL;await assert.rejects(historicalRequest('/historical/rounds'),/yapılandırılmamış/);process.env.EXPO_PUBLIC_API_URL='https://kadroradar.onrender.com/api/v1';
 global.fetch=async()=>{throw Error('offline')};await assert.rejects(historicalRequest('/historical/rounds'),/offline/);
 global.fetch=async()=>({ok:false,status:503});await assert.rejects(historicalRequest('/historical/rounds'),/503/);
 global.setTimeout=callback=>timer(callback,1);global.fetch=async(url,init)=>new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(Object.assign(Error(),{name:'AbortError'}))));await assert.rejects(historicalRequest('/historical/placements'),/zaman aşımına/);global.setTimeout=timer;
 global.fetch=async()=>({ok:true,json:async()=>[]});assert.deepEqual(await historicalRequest('/historical/rounds'),[]);
 global.fetch=async()=>({ok:true,json:async()=>({items:[],total:0,pages:0,page:1})});assert.equal((await historicalRequest('/historical/placements')).total,0);
 global.fetch=async()=>({ok:true,json:async()=>({items:'invalid'})});await assert.rejects(historicalRequest('/historical/placements'),/Geçersiz/);
 global.fetch=async()=>({ok:true,json:async()=>({items:[{id:'synthetic'}],total:21,pages:2,page:2})});assert.equal((await historicalRequest('/historical/placements?page=2')).page,2);
 console.log('PASS: historical mobile missing config, offline, HTTP503, timeout, retry success, empty, malformed response and pagination; no device test');
}finally{global.fetch=original;global.setTimeout=timer;if(base===undefined)delete process.env.EXPO_PUBLIC_API_URL;else process.env.EXPO_PUBLIC_API_URL=base;}})().catch(e=>{console.error(e);process.exitCode=1;});
