// Disposable PostgreSQL only. Restores a private backup optionally; never starts
// or migrates the existing local/production service, and never inherits its URL.
const {execFileSync}=require('node:child_process'),{randomBytes,createHash}=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),suffix=randomBytes(6).toString('hex'),container='kadroradar-daily-test-'+suffix,database='kadroradar_ingestion_test_daily_'+suffix,password=randomBytes(24).toString('hex');
function docker(...args){return execFileSync('docker',args,{encoding:'utf8',timeout:120000,windowsHide:true}).trim();}
function sql(statement){return docker('exec',container,'psql','-U','fixture','-d',database,'-At','-c',statement);}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const tests=['test-announcement-scan.cjs','test-indexing-policy.cjs','test-announcement-contract.cjs','test-announcement-network.cjs','test-multisource.cjs','test-daily-announcements.cjs','test-gazette.cjs','test-source-operations.cjs','test-source-worker-process.cjs','test-notification-plan.cjs','test-notification-worker.cjs','test-eligibility.cjs','test-candidate.cjs','test-environment.cjs','test-ingestion.cjs','test-mobile-network.cjs','test-admin-browser.cjs'];
const selectedTests=process.env.DAILY_TESTS?process.env.DAILY_TESTS.split(','):tests;
if(!selectedTests.length||selectedTests.some(test=>!tests.includes(test)))throw Error('Unknown isolated test selection');
(async()=>{let baseline,baselineHash;const evidence=[];try{
 docker('run','-d','--name',container,'--tmpfs','/var/lib/postgresql/data','-p','127.0.0.1::5432','-e','POSTGRES_USER=fixture','-e','POSTGRES_DB='+database,'-e','POSTGRES_PASSWORD='+password,'postgres:16-alpine');
 for(let i=0;i<60;i++){try{docker('exec',container,'pg_isready','-h','127.0.0.1','-U','fixture','-d',database);break;}catch{}await pause(500);}
 const binding=docker('port',container,'5432/tcp').split('\n')[0],port=binding.split(':').at(-1);
 const env={...process.env,DATABASE_URL:`postgresql://fixture:${password}@127.0.0.1:${port}/${database}`,NOTIFICATIONS_ENABLED:'false',SOURCE_SYNC_ENABLED:'false',DOCUMENT_UPLOADS_ENABLED:'true',PROCESS_ROLE:'api'};
 assert.ok(new URL(env.DATABASE_URL).pathname.startsWith('/kadroradar_ingestion_test_'));
 if(process.env.DAILY_BASELINE_BACKUP){
  const backup=path.resolve(process.env.DAILY_BASELINE_BACKUP);baselineHash=createHash('sha256').update(fs.readFileSync(backup)).digest('hex');
  docker('cp',backup,container+':/tmp/baseline.dump');docker('exec',container,'pg_restore','--no-owner','--no-acl','-U','fixture','-d',database,'/tmp/baseline.dump');
  baseline=sql('SELECT coalesce(jsonb_agg(to_jsonb(h) ORDER BY id),\'[]\'::jsonb)::text FROM "HistoricalPlacement" h');assert.equal(JSON.parse(baseline).length,504);
 }
 const pnpm=process.platform==='win32'?'pnpm.cmd':'pnpm';
 execFileSync(pnpm,['--filter','@kadro/api','exec','prisma','migrate','deploy'],{cwd:root,env,stdio:'pipe',timeout:120000,shell:process.platform==='win32',windowsHide:true});
 for(const test of selectedTests){const output=execFileSync(process.execPath,[test],{cwd:path.join(root,'apps/api'),env,encoding:'utf8',timeout:240000,windowsHide:true});console.log(output.trim());evidence.push({test,status:'PASS',output:output.trim()});}
 if(baseline){const ids=new Set(JSON.parse(baseline).map(row=>row.id));const after=JSON.parse(sql('SELECT coalesce(jsonb_agg(to_jsonb(h) ORDER BY id),\'[]\'::jsonb)::text FROM "HistoricalPlacement" h'));assert.deepEqual(after.filter(row=>ids.has(row.id)),JSON.parse(baseline));assert.equal(createHash('sha256').update(fs.readFileSync(path.resolve(process.env.DAILY_BASELINE_BACKUP))).digest('hex'),baselineHash);}
 const report={status:'PASS',mode:'DISPOSABLE_POSTGRESQL',realLocalPdf:!!env.GAZETTE_REAL_PDF,tests:evidence,baseline504Preserved:baseline?true:null,baselineSnapshotSha256:baseline?createHash('sha256').update(baseline).digest('hex'):null,productionWrites:0,realDatabaseMigrated:false,androidDeviceChecks:0};
 fs.mkdirSync(path.join(root,'.local/daily-operation'),{recursive:true});fs.writeFileSync(path.join(root,'.local/daily-operation',process.env.DAILY_TESTS?'focused-test-report.json':'test-report.json'),JSON.stringify(report,null,2));console.log('PASS: disposable PostgreSQL integration; production untouched; baseline preserved='+!!baseline);
 }finally{if(!/^kadroradar-daily-test-[a-f0-9]{12}$/.test(container))throw Error('Unsafe cleanup target');try{docker('rm','-f',container);}catch{}}
})().catch(error=>{console.error(String(error.message).replaceAll(password,'[REDACTED]'));if(error.stdout)console.error(String(error.stdout).replaceAll(password,'[REDACTED]'));process.exitCode=1;});
