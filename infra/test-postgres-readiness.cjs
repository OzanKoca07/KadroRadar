// Proves socket-ready != final TCP server during the official PG16 init phase.
// Only one uniquely named disposable container; never reads a DATABASE_URL.
const cp=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const suffix=crypto.randomBytes(6).toString('hex'),name='kr-pg-readiness-'+suffix,dir=fs.mkdtempSync(path.join(os.tmpdir(),'kr-pg-readiness-'));
const env={...process.env,POSTGRES_PASSWORD:crypto.randomBytes(24).toString('hex')};let created=false;
function docker(args){return cp.execFileSync('docker',args,{env,stdio:['ignore','pipe','pipe'],encoding:'utf8',windowsHide:true,timeout:30000});}
function ready(tcp){try{docker(['exec',name,'pg_isready',...(tcp?['-h','127.0.0.1']:[]),'-U','fixture','-d','synthetic_readiness']);return true;}catch{return false;}}
(async()=>{try{
 fs.chmodSync(dir,0o755);fs.writeFileSync(path.join(dir,'delay.sql'),'SELECT pg_sleep(6);\n',{mode:0o644});
 docker(['run','-d','--name',name,'--tmpfs','/var/lib/postgresql/data','-v',dir+':/docker-entrypoint-initdb.d:ro','-e','POSTGRES_USER=fixture','-e','POSTGRES_DB=synthetic_readiness','-e','POSTGRES_PASSWORD','postgres:16-alpine']);created=true;
 let premature=false,final=false;for(let i=0;i<80;i++){
  const tcp=ready(true);if(tcp){final=true;break;}
  if(ready(false))premature=true;
  await new Promise(r=>setTimeout(r,250));
 }
 assert.equal(premature,true);assert.equal(final,true);
 console.log(JSON.stringify({status:'PASS',test:'postgres-final-server-readiness',temporarySocketReadyObserved:true,tcpWaitedForFinalServer:true,productionWrites:0}));
 }catch(e){console.error(JSON.stringify({status:'FAIL',test:'postgres-final-server-readiness',kind:e.name}));process.exitCode=1;}finally{
 if(created&&/^kr-pg-readiness-[a-f0-9]{12}$/.test(name))docker(['rm','-f',name]);
 if(path.dirname(dir)===os.tmpdir()&&path.basename(dir).startsWith('kr-pg-readiness-'))fs.rmSync(dir,{recursive:true,force:true});
 }})();
