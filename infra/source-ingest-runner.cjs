// Ephemeral Actions -> signed HTTPS ingest -> PostgreSQL. Never accepts a DB URL.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),{randomUUID}=require('node:crypto');
const auth=require('../packages/shared/source-ingest.cjs'),{putReceipt}=require('./r2-source-store.cjs');
function sourceId(env){const id=env.SOURCE_ID||'gazette';if(!['career','gazette'].includes(id))throw Error('RUNNER_SOURCE_INVALID');return id;}
function configuration(env){
 if(env.DATABASE_URL)throw Error('RUNNER_DATABASE_URL_FORBIDDEN');
 if(env.SOURCE_AUTOMATION_APPROVED!=='true')throw Error('RUNNER_NOT_APPROVED');
 const url=new URL(env.SOURCE_INGEST_API_URL||'');if(url.protocol!=='https:'||url.pathname!=='/api/v1'||url.search||url.hash||url.username||url.password||require('node:net').isIP(url.hostname.replace(/[\[\]]/g,''))||/^(localhost)$|\.(localhost|local|internal)$/i.test(url.hostname))throw Error('RUNNER_TARGET_INVALID');auth.config(url.origin,env.SOURCE_INGEST_HMAC_KEY);return url;
}
async function call(env,action,body,transport=fetch){const base=configuration(env),route='/api/v1/source-ingest/'+sourceId(env)+'/'+action,serialized=JSON.stringify(body);if(Buffer.byteLength(serialized)>8*1024*1024)throw Error('REPORT_TOO_LARGE');
 const response=await transport(base.origin+route,{method:'POST',redirect:'error',headers:auth.headers(env.SOURCE_INGEST_HMAC_KEY,base.origin,route,body),body:serialized,signal:AbortSignal.timeout(110000)});
 if(!response.ok){await response.body?.cancel();throw Error('INGEST_HTTP_'+response.status);}
 let bytes=0,chunks=[];if(response.body){for await(const chunk of response.body){bytes+=chunk.length;if(bytes>8*1024*1024)throw Error('INGEST_RESPONSE_LIMIT');chunks.push(Buffer.from(chunk));}}else throw Error('INGEST_RESPONSE_MISSING');
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function parse(lease,directory,env){
 const state=path.join(directory,'state.json'),authorization=path.join(directory,'authorization.json'),output=path.join(directory,'report.json');
 fs.writeFileSync(state,JSON.stringify(sourceId(env)==='career'?{transport:lease.transport,detailRows:lease.detailRows||[]}:lease.transport),{mode:0o600});fs.writeFileSync(authorization,JSON.stringify(lease.source),{mode:0o600});
 const childEnv={PATH:env.PATH,Path:env.Path,SystemRoot:env.SystemRoot,TMP:directory,TEMP:directory,TMPDIR:directory,PYTHONUTF8:'1',CAREER_DETAIL_ENRICHMENT_ENABLED:lease.detailEnabled?'true':'false'};
 if(env.INGEST_INSTALL_DEPENDENCIES==='true'){const install=cp.spawnSync(env.INGEST_PYTHON||'python',['-m','pip','install','pymupdf==1.27.2.3'],{env:childEnv,encoding:'utf8',timeout:120000,maxBuffer:65536,windowsHide:true});if(install.status!==0)return {errorCode:'PARSE_OR_VALIDATION'};}
 const child=cp.spawnSync(env.INGEST_PYTHON||'python',[path.resolve(__dirname,'../services/ingest/'+(sourceId(env)==='career'?'career_worker.py':'gazette_ephemeral.py')),'--date',lease.date,'--state',state,'--authorization',authorization,'--output',output],{env:childEnv,encoding:'utf8',timeout:120000,maxBuffer:65536,windowsHide:true});
 if(child.status!==0){let result;try{result=JSON.parse(child.stdout);}catch{}const codes={DNS_ERROR:'DNS',TLS_ERROR:'TLS',TIMEOUT:'TIMEOUT',FORBIDDEN:'FORBIDDEN',RATE_LIMITED:'RATE_LIMITED',REDIRECT:'REDIRECT',NETWORK_ERROR:'NETWORK'};return {errorCode:codes[result?.code]||'PARSE_OR_VALIDATION'};}
 if(fs.statSync(output).size>7*1024*1024)return {errorCode:'PARSE_OR_VALIDATION'};
 return {report:JSON.parse(fs.readFileSync(output,'utf8'))};
}
function cleanup(directory){const parent=path.resolve(os.tmpdir());if(path.dirname(path.resolve(directory))!==parent||!path.basename(directory).startsWith('kadroradar-source-')||fs.realpathSync(directory)!==path.resolve(directory))throw Error('CLEANUP_TARGET_REJECTED');fs.rmSync(directory,{recursive:true,force:true});}
async function run(env=process.env,transport=fetch,parser=parse){
 configuration(env);const runId=randomUUID(),lease=await call(env,'claim',{runId},transport);if(lease.status!=='LEASED')return {status:lease.status,sourceRuns:0};
 if(lease.runId!==runId||!/^20\d{2}-\d{2}-\d{2}$/.test(lease.date||''))throw Error('LEASE_RESPONSE_INVALID');
 if(env.SOURCE_RELEASE_SHA&&lease.releaseSha!==env.SOURCE_RELEASE_SHA)throw Error('INGEST_RELEASE_MISMATCH');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kadroradar-source-'));fs.chmodSync(directory,0o700);
 try{
  let parsed;try{parsed=await parser(lease,directory,env);}catch{parsed={errorCode:'PARSE_OR_VALIDATION'};}
  const receipt=await call(env,'complete',{runId,...parsed},transport);
  if(['OK','ERROR'].includes(receipt.status)&&(receipt.runId!==runId||!/^[a-f0-9]{64}$/.test(receipt.reportHash||'')))throw Error('INGEST_RECEIPT_INVALID');
  // A failed optional R2 write never replays ingestion or downloads a PDF again.
  let r2={status:'DISABLED'};if(['OK','ERROR'].includes(receipt.status))try{r2=await putReceipt(env,runId,{...receipt,sourceId:sourceId(env)},transport);}catch{r2={status:'FAILED'};}
  return {status:receipt.status,sourceRuns:1,runId,reportHash:receipt.reportHash,created:receipt.created,changed:receipt.changed,duplicate:receipt.duplicate,autoPublished:receipt.autoPublished,r2:r2.status};
 }finally{cleanup(directory);}
}
async function runAll(env=process.env,transport=fetch,parser=parse){configuration(env);const results=[];for(const id of ['career','gazette']){try{results.push({sourceId:id,...await run({...env,SOURCE_ID:id},transport,parser)});}catch(error){results.push({sourceId:id,status:'FAIL',code:/^INGEST_HTTP_\d{3}$/.test(error.message)?error.message:'RUNNER_FAILURE'});}}return {status:results.some(r=>['FAIL','ERROR'].includes(r.status)||r.r2==='FAILED')?'FAIL':'PASS',results};}
module.exports={configuration,call,run,runAll,cleanup};
if(require.main===module)(process.argv.includes('--all')?runAll():run()).then(result=>{console.log(JSON.stringify(result));if(result.status==='FAIL'||result.status==='ERROR'||result.r2==='FAILED')process.exitCode=1;}).catch(error=>{const code=['RUNNER_DATABASE_URL_FORBIDDEN','RUNNER_NOT_APPROVED','RUNNER_TARGET_INVALID','INGEST_CONFIGURATION_INVALID','INGEST_RELEASE_MISMATCH','INGEST_RECEIPT_INVALID','R2_CONFIGURATION_INVALID','REPORT_TOO_LARGE','INGEST_RESPONSE_LIMIT','CLEANUP_TARGET_REJECTED'].includes(error.message)?error.message:/^INGEST_HTTP_\d{3}$/.test(error.message)?error.message:'RUNNER_FAILURE';console.error(JSON.stringify({status:'FAIL',code}));process.exitCode=1;});
