// Disposable named volume proves persistence across containers; no DB or network.
const assert=require('node:assert/strict'),cp=require('node:child_process'),{randomUUID}=require('node:crypto');
const image=process.env.RENDER_TEST_IMAGE||'kadroradar-api:rc1',volume='kadroradar-storage-test-'+randomUUID();const idle=volume+'-idle';
function docker(args){return cp.execFileSync('docker',args,{encoding:'utf8',windowsHide:true,timeout:30000,stdio:['ignore','pipe','pipe']}).trim();}
const env=['-e','PROCESS_ROLE=source-worker','-e','SOURCE_SYNC_ENABLED=true','-e','WORKER_DATA_DIR=/var/data','-e','SOURCE_STATE_DIR=/var/data/sources','-e','GAZETTE_STORAGE_DIR=/var/data/gazette'];
const run=(mount,command)=>docker(['run','--rm','--network','none',...env,...(mount?['-v',volume+':/var/data']:[]),image,'node','-e',command]);
try{
 docker(['volume','create',volume]);
 assert.throws(()=>run(false,"require('./infra/source-worker-start.cjs').storage()"));
 const first=run(true,"const fs=require('fs');require('./infra/source-worker-start.cjs').storage();fs.writeFileSync('/var/data/sources/etag','fixture-etag');fs.writeFileSync('/var/data/gazette/fixture.pdf','%PDF-fixture');console.log('WRITTEN')");assert.equal(first,'WRITTEN');
 const second=run(true,"const fs=require('fs');require('./infra/source-worker-start.cjs').storage();if(fs.readFileSync('/var/data/sources/etag','utf8')!=='fixture-etag'||fs.readFileSync('/var/data/gazette/fixture.pdf','utf8')!=='%PDF-fixture')process.exit(1);console.log('PERSISTED')");assert.equal(second,'PERSISTED');
 const gate=JSON.parse(docker(['run','--rm','--network','none',...env,'-v',volume+':/var/data',image,'node','infra/source-worker-start.cjs','--check-storage']));assert.equal(gate.persistentMount,true);
 const disabled=JSON.parse(docker(['run','--rm','--network','none',...env,'-e','SOURCE_SYNC_ENABLED=false','-v',volume+':/var/data',image,'node','infra/source-worker-start.cjs','--check-storage']));assert.equal(disabled.persistentMount,true);
 docker(['run','-d','--name',idle,'--network','none',...env,'-e','SOURCE_SYNC_ENABLED=false','-e','DATABASE_URL=invalid-not-used','-v',volume+':/var/data',image,'node','infra/source-worker-start.cjs']);
 let logs='';for(let i=0;i<20&&!logs.includes('source_worker_disabled');i++){logs=docker(['logs',idle]);if(!logs.includes('source_worker_disabled'))Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100);}
 assert.ok(logs.includes('source_worker_disabled'));assert.equal(docker(['inspect','-f','{{.State.Running}}',idle]),'true');docker(['stop','-t','2',idle]);
 assert.throws(()=>run(true,"const fs=require('fs');fs.symlinkSync('/tmp','/var/data/outside');require('./infra/source-worker-start.cjs').storage({...process.env,SOURCE_STATE_DIR:'/var/data/outside'})"));
 console.log(JSON.stringify({status:'PASS',checks:8,persistentAcrossContainers:true,disabledWorkerNoDatabase:true,productionWrites:0}));
}catch(error){console.error(JSON.stringify({status:'FAIL',test:'source-storage',kind:error.name}));process.exitCode=1;}finally{try{docker(['rm','-f',idle]);}catch{}try{docker(['volume','rm',volume]);}catch{process.exitCode=1;}}
