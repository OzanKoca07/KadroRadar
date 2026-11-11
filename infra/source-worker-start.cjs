// Runtime-only persistence gate; never provisions infrastructure or migrates a DB.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
function storage(env=process.env,mountInfo){
 if(env.PROCESS_ROLE!=='source-worker'||!['true','false'].includes(env.SOURCE_SYNC_ENABLED))throw Error('WORKER_NOT_APPROVED');
 const root=env.WORKER_DATA_DIR;if(!root||!path.isAbsolute(root)||root==='/'||root===process.cwd())throw Error('WORKER_STORAGE_TARGET_REQUIRED');
 const info=mountInfo??fs.readFileSync('/proc/self/mountinfo','utf8');
 const mounted=info.split('\n').some(line=>line.split(' ')[4]?.replace(/\\040/g,' ')===root);
 if(!mounted)throw Error('WORKER_PERSISTENT_MOUNT_REQUIRED');
 const real=fs.realpathSync(root),inside=value=>{const rel=path.relative(real,value);return rel!==''&&!rel.startsWith('..')&&!path.isAbsolute(rel);};
 const dirs=[env.SOURCE_STATE_DIR,env.GAZETTE_STORAGE_DIR];
 for(const dir of dirs){if(!dir||!path.isAbsolute(dir)||!inside(path.resolve(dir)))throw Error('WORKER_STORAGE_PATH_REJECTED');fs.mkdirSync(dir,{recursive:true,mode:0o700});if(!inside(fs.realpathSync(dir)))throw Error('WORKER_STORAGE_SYMLINK_REJECTED');}
 const marker=path.join(real,'.kadroradar-source-storage-v1');try{fs.writeFileSync(marker,'KADRORADAR_SOURCE_STORAGE_V1\n',{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw Error('WORKER_STORAGE_WRITE_FAILED');}
 if(fs.readFileSync(marker,'utf8')!=='KADRORADAR_SOURCE_STORAGE_V1\n')throw Error('WORKER_STORAGE_MARKER_INVALID');
 return {persistentMount:true,privateDirectories:2};
}
module.exports={storage};
if(require.main===module){try{
 const result=storage();console.log(JSON.stringify({event:'source_worker_storage_ready',...result}));
 if(!process.argv.includes('--check-storage')){
  if(process.env.SOURCE_SYNC_ENABLED==='false'){
   // Inert provisioning state: no Nest context, DB client, downloader or scheduler.
   console.log(JSON.stringify({event:'source_worker_disabled',sourceRuns:0}));
   const idle=setInterval(()=>{},60000);for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{clearInterval(idle);});
  }else{
   const child=cp.spawn(process.execPath,[path.resolve(__dirname,'../apps/api/dist/worker.js')],{stdio:'inherit',windowsHide:true});
   for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
   child.on('error',()=>{console.error(JSON.stringify({event:'source_worker_start_failed',code:'CHILD_START_FAILURE'}));process.exitCode=1;});
   child.on('exit',code=>{process.exitCode=code??1;});
  }
 }
}catch(error){const allowed=['WORKER_NOT_APPROVED','WORKER_STORAGE_TARGET_REQUIRED','WORKER_PERSISTENT_MOUNT_REQUIRED','WORKER_STORAGE_PATH_REJECTED','WORKER_STORAGE_SYMLINK_REJECTED','WORKER_STORAGE_WRITE_FAILED','WORKER_STORAGE_MARKER_INVALID'];console.error(JSON.stringify({event:'source_worker_start_failed',code:allowed.includes(error.message)?error.message:'WORKER_STORAGE_UNAVAILABLE'}));process.exitCode=1;}}
