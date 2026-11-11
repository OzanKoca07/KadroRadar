// Account-free isolated PG16 tests. Creates/destroys only its randomly named test container.
const cp=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');process.chdir(root);
const suffix=crypto.randomBytes(5).toString('hex'),name='kadroradar-source-test-'+suffix,database='kadroradar_ingestion_test_release_'+suffix,secret=crypto.randomBytes(20).toString('hex'),results=[];
const docker=args=>cp.execFileSync('docker',args,{encoding:'utf8',stdio:'pipe',windowsHide:true,timeout:120000});
(async()=>{try{
 docker(['run','-d','--name',name,'--tmpfs','/var/lib/postgresql/data','-p','127.0.0.1::5432','-e','POSTGRES_USER=fixture','-e','POSTGRES_PASSWORD='+secret,'-e','POSTGRES_DB='+database,'postgres:16-alpine']);
 for(let i=0;i<60;i++){try{docker(['exec',name,'pg_isready','-U','fixture','-d',database]);break;}catch{}await new Promise(r=>setTimeout(r,500));}
 const port=docker(['port',name,'5432/tcp']).trim().split(':').at(-1),env={...process.env,DATABASE_URL:'postgresql://fixture:'+secret+'@127.0.0.1:'+port+'/'+database,PROCESS_ROLE:'api',SOURCE_SYNC_ENABLED:'false',NOTIFICATIONS_ENABLED:'false',DOCUMENT_UPLOADS_ENABLED:'false',NODE_ENV:'development'};
 cp.execFileSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy','--schema','apps/api/prisma/schema.prisma'],{env,stdio:'pipe',timeout:120000,windowsHide:true});
 const tests=['test-indexing-policy','test-source-operations','test-announcement-scan','test-source-worker-process','test-historical-release','test-source-rights-flow','test-career-rss'];
 if(process.argv.includes('--browser-only'))tests.splice(0,tests.length,'test-admin-browser');
 if(process.argv.includes('--admin-browser'))tests.push('test-admin-browser');
 if(process.argv.includes('--auth'))tests.unshift('test-candidate','test-usability-auth-news','test-mobile-network');
 if(process.argv.includes('--auth-gazette'))tests.push('test-auth-readiness','test-auth-capacity','test-gazette','test-daily-announcements');
 if(process.argv.includes('--final-gazette'))tests.push('test-gazette-downloader','test-auth-recovery-draft');
 if(process.argv.includes('--downloader-only'))tests.splice(0,tests.length,'test-gazette-downloader','test-auth-recovery-draft');
 if(process.argv.includes('--account-recovery'))tests.push('test-account-recovery');
 if(process.argv.includes('--recovery-only'))tests.splice(0,tests.length,'test-account-recovery');
 if(process.argv.includes('--auth-readiness-only'))tests.splice(0,tests.length,'test-auth-readiness');
 if(process.argv.includes('--legal-browser-only'))tests.splice(0,tests.length,'test-legal-browser');
 if(process.argv.includes('--real-career-fixture'))tests.push('../../.local/kariyer/test-real-staging');
 for(const test of tests){
  try{
   const output=cp.execFileSync(process.execPath,[test+'.cjs'],{cwd:path.join(root,'apps/api'),env:{...env,...(['test-gazette','test-daily-announcements'].includes(test)?{DOCUMENT_UPLOADS_ENABLED:'true'}:{})},stdio:'pipe',timeout:180000,windowsHide:true,maxBuffer:8*1024*1024});
   let metrics;
   if(['test-gazette','test-auth-readiness','test-gazette-downloader','test-auth-recovery-draft'].includes(test)){
    const value=output.toString().split(/\r?\n/).filter(line=>line.startsWith('{')).map(line=>{try{return JSON.parse(line);}catch{return {};}}).find(value=>value.status==='PASS');
    if(value)metrics=Object.fromEntries((test==='test-auth-readiness'?['checks','sessionHours','productionWrites']:test==='test-gazette-downloader'?['checks','mode','candidates','duplicates','productionWrites','liveDownload']:test==='test-auth-recovery-draft'?['checks','emailDeliveryTested','productionMigration']:['mode','pageCount','inspectedPages','flaggedPages','candidates','created','duplicates','reviewedAndPublishedInIsolatedDb','publishedPositionRows','productionWrites','androidDeviceChecks']).map(key=>[key,value[key]]));
   }
   results.push({test,status:'PASS',...(metrics?{metrics}:{})});
  }catch(error){
   let phase,validationCode;
   if(['test-auth-readiness','test-gazette-downloader','test-account-recovery'].includes(test))for(const line of (String(error.stdout||'')+'\n'+String(error.stderr||'')).split(/\r?\n/)){try{const value=JSON.parse(line);if(['auth-readiness','gazette-downloader-worker','account-recovery'].includes(value.test)&&/^[A-Z_]{1,40}$/.test(value.phase))phase=value.phase;if(value.validationCode==='EMPTY_JSON_BODY')validationCode=value.validationCode;}catch{}}
   results.push({test,status:'FAIL',kind:error.name,exitCode:error.status,...(phase?{phase}:{}),...(validationCode?{validationCode}:{})});
  }
  console.log(JSON.stringify(results.at(-1)));
 }
 }finally{try{docker(['rm','-f',name]);}catch{}fs.writeFileSync('.local/release/source-automation-regressions.json',JSON.stringify({productionWrites:0,results},null,2));if(results.some(r=>r.status!=='PASS')||!results.length)process.exitCode=1;}})().catch(e=>{console.error(JSON.stringify({kind:e.name,event:'ISOLATED_RUNNER_FAILED'}));process.exitCode=1;});
