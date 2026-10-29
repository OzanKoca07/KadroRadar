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
 if(process.argv.includes('--real-career-fixture'))tests.push('../../.local/kariyer/test-real-staging');
 for(const test of tests){try{cp.execFileSync(process.execPath,[test+'.cjs'],{cwd:path.join(root,'apps/api'),env,stdio:'pipe',timeout:180000,windowsHide:true,maxBuffer:8*1024*1024});results.push({test,status:'PASS'});}catch(error){results.push({test,status:'FAIL',kind:error.name,exitCode:error.status});}console.log(JSON.stringify(results.at(-1)));}
 }finally{try{docker(['rm','-f',name]);}catch{}fs.writeFileSync('.local/release/source-automation-regressions.json',JSON.stringify({productionWrites:0,results},null,2));if(results.some(r=>r.status!=='PASS')||!results.length)process.exitCode=1;}})().catch(e=>{console.error(JSON.stringify({kind:e.name,event:'ISOLATED_RUNNER_FAILED'}));process.exitCode=1;});
