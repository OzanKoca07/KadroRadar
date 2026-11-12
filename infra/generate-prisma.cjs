// Bounded, checksum-verified official engine retrieval for repeatable container builds.
const fs=require('node:fs'),path=require('node:path'),https=require('node:https'),{createHash}=require('node:crypto'),{gunzipSync}=require('node:zlib'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),MAX_ARCHIVE=32*1024*1024,CHUNK=256*1024;
function configuredProxy(url){const host=new URL(url).hostname;const excluded=(process.env.NO_PROXY||process.env.no_proxy||'').split(',').map(value=>value.trim()).filter(Boolean);if(excluded.some(value=>value==='*'||host===value||host.endsWith(value.startsWith('.')?value:'.'+value)))return '';return process.env.HTTPS_PROXY||process.env.https_proxy||process.env.HTTP_PROXY||process.env.http_proxy||'';}
function options(url,signal,transport){const proxy=transport===https&&configuredProxy(url);return {family:4,signal,...(proxy?{agent:new (require('https-proxy-agent').HttpsProxyAgent)(proxy)}:{})};}
function engineUrl(value){const u=new URL(value);if(u.protocol!=='https:'||u.hostname!=='binaries.prisma.sh'||u.port||u.username||u.password||u.search||u.hash||!/^\/all_commits\/[a-f0-9]{40}\/[A-Za-z0-9_.-]+\/(?:schema-engine|libquery_engine\.so\.node)\.gz$/.test(u.pathname))throw Error('ENGINE_URL_REJECTED');return u;}
function requestRange(url,start,end,total,signal,transport=https){
 engineUrl(url);
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||end>=MAX_ARCHIVE||total!==undefined&&(!Number.isSafeInteger(total)||total<=end||total>MAX_ARCHIVE))throw Error('ENGINE_RANGE_ARGUMENT');
 return new Promise((resolve,reject)=>{
  const timed=AbortSignal.timeout(45000),bounded=signal?AbortSignal.any([signal,timed]):timed;
  const req=transport.get(url,{...options(url,bounded,transport),headers:{Range:`bytes=${start}-${end}`,'Accept-Encoding':'identity'}},res=>{
   if(res.statusCode!==206){res.destroy();reject(Error('ENGINE_RANGE_HTTP_'+res.statusCode));return;}
   const m=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(res.headers['content-range']||'');
   if(!m||Number(m[1])!==start||Number(m[2])!==end||Number(m[3])<=end||Number(m[3])>MAX_ARCHIVE||total!==undefined&&Number(m[3])!==total){res.destroy();reject(Error('ENGINE_RANGE_INVALID'));return;}
   const chunks=[];let length=0;
   res.on('data',chunk=>{length+=chunk.length;if(length>end-start+1)res.destroy(Error('ENGINE_RANGE_OVERSIZE'));else chunks.push(chunk);});
   res.on('end',()=>length===end-start+1?resolve({body:Buffer.concat(chunks),total:Number(m[3])}):reject(Error('ENGINE_RANGE_INCOMPLETE')));
   res.on('error',reject);
  });req.on('error',reject);
 });
}
async function retrieveArchive(url,transport=https,onProgress=()=>{}){
 const cancel=new AbortController(),signal=AbortSignal.any([cancel.signal,AbortSignal.timeout(360000)]);
 async function part(start,end,total){
  for(let attempt=0;attempt<2;attempt++)try{return await requestRange(url,start,end,total,signal,transport);}catch(error){
   if(signal.aborted||attempt===1||!['ABORT_ERR','ECONNRESET','ETIMEDOUT'].includes(error.code))throw error;
   console.log(JSON.stringify({phase:'engine-range-retry',file:new URL(url).pathname.split('/').pop(),attempt:attempt+1,code:error.code}));
   await new Promise(resolve=>setTimeout(resolve,1000));
  }
 }
 try{
  const first=await part(0,0,undefined),buffer=Buffer.alloc(first.total),jobs=[];
  for(let start=0;start<first.total;start+=CHUNK)jobs.push({start,end:Math.min(first.total-1,start+CHUNK-1)});
  let cursor=0,completed=0;
  await Promise.all(Array.from({length:Math.min(4,jobs.length)},async()=>{while(cursor<jobs.length){const job=jobs[cursor++],chunk=await part(job.start,job.end,first.total);chunk.body.copy(buffer,job.start);completed+=chunk.body.length;onProgress(completed,first.total);}}));
  if(completed!==buffer.length)throw Error('ENGINE_ARCHIVE_INCOMPLETE');return buffer;
 }catch(error){cancel.abort();throw error;}
}
async function retrieveChecksum(url){let last;for(let attempt=0;attempt<3;attempt++){try{return await new Promise((yes,no)=>{const req=https.get(url,options(url,AbortSignal.timeout(120000),https),response=>{if(response.statusCode!==200){response.destroy();return no(Error('ENGINE_CHECKSUM_HTTP_'+response.statusCode));}const chunks=[];let length=0;response.on('data',chunk=>{length+=chunk.length;if(length>1024)response.destroy(Error('ENGINE_CHECKSUM_LIMIT'));else chunks.push(chunk);});response.on('end',()=>yes(Buffer.concat(chunks)));response.on('error',no);});req.on('error',no);});}catch(error){last=error;console.log(JSON.stringify({phase:'engine-checksum-retry',attempt:attempt+1,error:error.code||error.name}));if(attempt<2)await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));}}throw last;}
function verifiedEngine(archive,checksum){const expected=checksum.toString('utf8').match(/^([a-f0-9]{64})\b/)?.[1];if(!expected||archive.length>MAX_ARCHIVE||createHash('sha256').update(archive).digest('hex')!==expected)throw Error('ENGINE_CHECKSUM_MISMATCH');return {bytes:gunzipSync(archive,{maxOutputLength:100*1024*1024}),sha256:expected};}
async function main(){
 const target=await require('@prisma/get-platform').getBinaryTargetForCurrentPlatform(),version=require('@prisma/engines-version').enginesVersion,dir=path.join(root,'node_modules/@prisma/engines'),binaries={};
 console.log(JSON.stringify({phase:'engine-retrieval',target,configuredProxy:!!configuredProxy('https://binaries.prisma.sh')}));
 for(const kind of ['schema-engine','libquery_engine.so.node']){
  const base=`https://binaries.prisma.sh/all_commits/${version}/${target}/${kind}.gz`;let progress=0;
  const [archive,checksum]=await Promise.all([retrieveArchive(base,https,(bytes,total)=>{if(bytes-progress>=1024*1024||bytes===total){progress=bytes;console.log(JSON.stringify({phase:'engine-range-progress',engine:kind,bytes,total}));}}),retrieveChecksum(base+'.sha256')]);
  const verified=verifiedEngine(archive,checksum),name=kind==='schema-engine'?'schema-engine-'+target:'libquery_engine-'+target+'.so.node',destination=path.join(dir,name);
  fs.writeFileSync(destination,verified.bytes,{mode:0o755});binaries[kind]=destination;console.log(JSON.stringify({engine:kind,target,version,archiveSha256:verified.sha256}));
 }
 execFileSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'generate','--schema',path.join(root,'apps/api/prisma/schema.prisma')],{cwd:root,timeout:60000,stdio:'inherit',env:{...process.env,PRISMA_SCHEMA_ENGINE_BINARY:binaries['schema-engine'],PRISMA_QUERY_ENGINE_LIBRARY:binaries['libquery_engine.so.node']}});
}
module.exports={requestRange,retrieveArchive,verifiedEngine};
if(require.main===module)main().catch(error=>{const code=/^ENGINE_[A-Z0-9_]+$/.test(error.message)?error.message:/^[A-Z0-9_]{1,64}$/.test(error.code||'')?error.code:'ENGINE_RETRIEVAL_FAILED';console.error(JSON.stringify({phase:'ENGINE_GENERATION',code}));process.exitCode=1;});
