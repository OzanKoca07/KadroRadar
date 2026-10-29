// Build-only, bounded retrieval of the two large Prisma archives. All bytes must
// match the unchanged lockfile before pnpm is allowed to import them into CAFS.
const fs=require('node:fs'),https=require('node:https'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const controller=new AbortController(),signal=AbortSignal.any([controller.signal,AbortSignal.timeout(840000)]),sizeLimit=64*1024*1024,chunkSize=64*1024;
function request(url,start,end,total,transport=https){return new Promise((resolve,reject)=>{
 const req=transport.get(url,{headers:{Range:`bytes=${start}-${end}`},signal:AbortSignal.any([signal,AbortSignal.timeout(120000)])},res=>{
  if(res.statusCode!==206){res.resume();reject(Error('ARCHIVE_RANGE_HTTP_'+res.statusCode));return;}
  const match=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(res.headers['content-range']||'');
  if(!match||Number(match[1])!==start||Number(match[2])!==end||Number(match[3])<=end||Number(match[3])>sizeLimit||total&&Number(match[3])!==total){res.destroy();reject(Error('ARCHIVE_RANGE_INVALID'));return;}
  const chunks=[];let length=0;
  res.on('data',chunk=>{length+=chunk.length;if(length>end-start+1)res.destroy(Error('ARCHIVE_RANGE_OVERSIZE'));else chunks.push(chunk);});
  res.on('end',()=>length===end-start+1?resolve({body:Buffer.concat(chunks),total:Number(match[3])}):reject(Error('ARCHIVE_RANGE_INCOMPLETE')));
  res.on('error',reject);
 });req.on('error',reject);
});}
async function main(){
 const lock=fs.readFileSync(path.resolve(__dirname,'../pnpm-lock.yaml'),'utf8');
 const output=path.resolve(process.argv[2]||'/tmp/kadroradar-prisma-archives');fs.mkdirSync(output,{recursive:true});
 const jobs=[],packages=[],archives=[];
 for(const name of ['@prisma/client','prisma']){
  const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const matches=[...lock.matchAll(new RegExp('^  [\'\"]?'+escaped+'@([^:\'\"\\r\\n]+)[\'\"]?:\\r?\\n    resolution: \\{integrity: ([^}]+)\\}','gm'))];
  if(matches.length!==1||!/^\d+\.\d+\.\d+$/.test(matches[0][1])||!/^sha512-[A-Za-z0-9+/]+=*$/.test(matches[0][2]))throw Error('ARCHIVE_LOCK_AMBIGUOUS');
  const [,version,integrity]=matches[0],url=`https://registry.npmjs.org/${name}/-/${name.split('/').at(-1)}-${version}.tgz`;
  const destination=path.join(output,name.split('/').at(-1)+'-'+version+'.tgz');archives.push(destination);
  if(fs.existsSync(destination)){const archive=fs.readFileSync(destination);if('sha512-'+crypto.createHash('sha512').update(archive).digest('base64')!==integrity)throw Error('ARCHIVE_CACHE_INTEGRITY_MISMATCH');console.log(JSON.stringify({phase:'LOCKED_ARCHIVE_CACHE_VERIFIED',name,version,bytes:archive.length}));continue;}
  const first=await request(url,0,0),p={name,version,integrity,url,destination,buffer:Buffer.alloc(first.total),completed:0};packages.push(p);
  for(let start=0;start<first.total;start+=chunkSize){const end=Math.min(first.total-1,start+chunkSize-1);jobs.push(async()=>{const result=await request(url,start,end,first.total);result.body.copy(p.buffer,start);p.completed+=result.body.length;if(p.completed%(1024*1024)===0)console.log(JSON.stringify({phase:'ARCHIVE_PROGRESS',name:p.name,bytes:p.completed,total:first.total}));});}
 }
 let cursor=0;await Promise.all(Array.from({length:8},async()=>{while(cursor<jobs.length)await jobs[cursor++]();}));
 for(const p of packages){if(p.completed!==p.buffer.length||'sha512-'+crypto.createHash('sha512').update(p.buffer).digest('base64')!==p.integrity)throw Error('ARCHIVE_INTEGRITY_MISMATCH');fs.writeFileSync(p.destination+'.partial',p.buffer);fs.renameSync(p.destination+'.partial',p.destination);console.log(JSON.stringify({phase:'LOCKED_ARCHIVE_VERIFIED',name:p.name,version:p.version,bytes:p.buffer.length}));}
 if(process.argv.includes('--import-store'))execFileSync('pnpm',['--config.ignore-scripts=true','store','add',...archives,'--store-dir','/pnpm/store'],{timeout:120000,stdio:'inherit'});
}
module.exports={request};
if(require.main===module)main().catch(error=>{controller.abort();console.error(JSON.stringify({phase:'LOCKED_ARCHIVE_FAILURE',code:/^ARCHIVE_[A-Z0-9_]+$/.test(error.message)?error.message:/^[A-Z0-9_]{1,64}$/.test(error.code||'')?error.code:'TRANSFER_FAILED'}));process.exitCode=1;});
