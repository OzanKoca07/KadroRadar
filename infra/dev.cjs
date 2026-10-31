// One foreground owner for the three local development services. No shells,
// detached processes, automatic restarts, DB provisioning or migrations.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),net=require('node:net'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.local/dev-process'),stateFile=path.join(dir,'state.json'),stopFile=path.join(dir,'stop.json');
const identity=require('./dev-state.cjs');
const readState=()=>identity.readState(stateFile,root);
const ownership=s=>identity.verify(s,identity.probe(root,[s.pid,...s.services.map(c=>c.pid)]));
function localEnvironment(){const env={...process.env};for(const file of ['.env','apps/api/.env']){const p=path.join(root,file);if(!fs.existsSync(p))continue;for(const line of fs.readFileSync(p,'utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);if(m)env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');}}
 let u;try{u=new URL(env.DATABASE_URL);}catch{throw Error('DEV_LOCAL_DATABASE_REQUIRED');}if(!['postgres:','postgresql:'].includes(u.protocol)||!['localhost','127.0.0.1','[::1]'].includes(u.hostname)||u.pathname!=='/kadroradar')throw Error('DEV_LOCAL_DATABASE_REQUIRED');
 Object.assign(env,{NODE_ENV:'development',PROCESS_ROLE:'api',SOURCE_SYNC_ENABLED:'false',NOTIFICATIONS_ENABLED:'false',DOCUMENT_UPLOADS_ENABLED:'false',ALLOW_SELF_REGISTRATION:'false',PORT:'3000',API_PORT:'3000',EXPO_PUBLIC_API_URL:'http://localhost:3000/api/v1',EXPO_PUBLIC_CAREER_CARD_ENABLED:'false'});delete env.EAS_BUILD_PROFILE;return env;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function available(port){await new Promise((yes,no)=>{const s=net.createServer();s.once('error',()=>no(Error('DEV_PORT_IN_USE_'+port)));s.listen(port,'127.0.0.1',()=>s.close(yes));});}
async function start(){fs.mkdirSync(dir,{recursive:true});const previous=readState();if(previous){if(ownership(previous)==='ACTIVE')throw Error('DEV_ALREADY_RUNNING');fs.renameSync(stateFile,path.join(dir,'stale-'+previous.runId+'-'+Date.now()+'.json'));}
 const ownRecord=identity.probe(root,[process.pid]).find(p=>p.pid===process.pid&&p.kind==='owner');if(!ownRecord)throw Error('DEV_OWNER_IDENTITY_REQUIRED');
 const state={version:2,ownerCreated:ownRecord.created,root,runId:crypto.randomBytes(16).toString('hex'),pid:process.pid,startedAt:new Date().toISOString(),services:[]};
 const fd=fs.openSync(stateFile,'wx',0o600);fs.writeFileSync(fd,JSON.stringify(state));fs.closeSync(fd);
 const children=[];let stopping=false,timer,finished;const done=new Promise(r=>finished=r);
 const save=()=>{const pending=stateFile+'.'+state.runId+'.tmp';fs.writeFileSync(pending,JSON.stringify(state),{mode:0o600});fs.renameSync(pending,stateFile);};
 async function shutdown(){
  if(stopping)return;stopping=true;clearInterval(timer);let preserved=false;
  for(const child of children){
   if(child.exitCode!==null||child.signalCode)continue;
   try{const service=state.services.find(c=>c.pid===child.pid);if(!service)throw Error();const observed=identity.probe(root,[state.pid,child.pid]);if(!observed.some(p=>p.pid===child.pid))continue;identity.verify({...state,services:[service]},observed);}
   catch{preserved=true;console.error(JSON.stringify({status:'FAIL',code:'DEV_CHILD_IDENTITY_UNVERIFIED'}));continue;}
   const killed=cp.spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',timeout:10000});
   try{if(killed.status!==0&&identity.probe(root,[child.pid]).some(p=>p.pid===child.pid)){preserved=true;console.error(JSON.stringify({status:'FAIL',code:'DEV_CHILD_STOP_UNCONFIRMED'}));}}catch{preserved=true;}
  }
  if(!preserved){try{if(readState()?.runId===state.runId)fs.unlinkSync(stateFile);}catch{preserved=true;console.error(JSON.stringify({status:'FAIL',code:'DEV_STATE_INVALID',detail:'SHUTDOWN_STATE_PRESERVED'}));}}
  if(!preserved){try{const stop=JSON.parse(fs.readFileSync(stopFile));if(stop.runId===state.runId)fs.unlinkSync(stopFile);}catch{}}
  if(preserved)process.exitCode=1;finished();
 }
 process.once('SIGINT',()=>void shutdown());process.once('SIGTERM',()=>void shutdown());
 try{const env=localEnvironment();for(const port of [3000,5173,8081])await available(port);
  const specs=[['api','apps/api/dist/main.js',[],root],['admin','node_modules/vite/bin/vite.js',['--host','127.0.0.1','--port','5173','--strictPort'],path.join(root,'apps/admin')],['metro','node_modules/expo/bin/cli',['start','--port','8081','--max-workers','1'],path.join(root,'apps/mobile')]];
  for(const [name,script,args,cwd]of specs){
   const target=path.join(root,script);if(!fs.existsSync(target))throw Error('DEV_BUILD_REQUIRED_'+name);
   const out=fs.openSync(path.join(dir,state.runId+'-'+name+'.out.log'),'a',0o600),err=fs.openSync(path.join(dir,state.runId+'-'+name+'.err.log'),'a',0o600);
   const child=cp.spawn(process.execPath,[target,...args],{cwd,env,windowsHide:true,detached:false,stdio:['ignore',out,err]});fs.closeSync(out);fs.closeSync(err);children.push(child);
   child.once('error',()=>{process.exitCode=1;void shutdown();});child.once('exit',code=>{if(!stopping){console.error(JSON.stringify({event:'DEV_SERVICE_EXIT',service:name,code}));process.exitCode=1;void shutdown();}});
   const observed=identity.probe(root,[child.pid]).find(p=>p.pid===child.pid&&p.parent===state.pid&&p.kind===name);if(!observed)throw Error('DEV_CHILD_IDENTITY_REQUIRED');
   state.services.push({name,pid:child.pid,created:observed.created});save();
  }
  timer=setInterval(()=>{try{const stop=JSON.parse(fs.readFileSync(stopFile));if(stop.runId===state.runId)void shutdown();}catch{}},250);
  console.log(JSON.stringify({event:'DEV_STARTED',pid:process.pid,services:state.services,ports:[3000,5173,8081],restart:false}));await done;
 }finally{await shutdown();}}
async function main(action=process.argv[2]||'start'){
 if(action==='start')return start();
 if(!['status','stop','diagnose'].includes(action))throw Error('DEV_ACTION_INVALID');
 const state=readState();
 if(!state||ownership(state)==='STALE'){console.log(JSON.stringify({status:'STOPPED'}));return;}
 if(action==='status'||action==='diagnose'){console.log(JSON.stringify({status:'RUNNING',pid:state.pid,services:state.services.map(({name,pid,created})=>({name,pid,...(created?{created}:{})})),identity:'VERIFIED',stateVersion:state.version}));return;}
 fs.writeFileSync(stopFile,JSON.stringify({runId:state.runId}),{mode:0o600});
 for(let i=0;i<80;i++){const current=readState();if(!current){console.log(JSON.stringify({status:'STOPPED',scope:'OWNED_CHILDREN_ONLY'}));return;}if(current.runId!==state.runId)throw Error('DEV_STATE_CHANGED_DURING_STOP');await delay(250);}
 throw Error('DEV_STOP_TIMEOUT_NO_EXTERNAL_PROCESS_KILLED');
}
module.exports={localEnvironment};if(require.main===module)main().catch(error=>{console.error(JSON.stringify({status:'FAIL',code:/^DEV_[A-Z0-9_]+$/.test(error.message)?error.message:'DEV_OPERATION_FAILED',...(error.detail?{detail:error.detail}:{})}));process.exitCode=1;});
