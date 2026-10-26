// Real21 documents, disposable PostgreSQL, actual authenticated review endpoints.
// Never reads the production connection or writes the production operation journal.
require('reflect-metadata');const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),{randomBytes}=require('node:crypto');
const root=path.resolve(__dirname,'..'),suffix=randomBytes(6).toString('hex'),container='kadroradar-osym-prod-test-'+suffix,database='kadroradar_ingestion_test_release_'+suffix,password=randomBytes(24).toString('hex');
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',timeout:120000,windowsHide:true}).trim();
(async()=>{let app,db;try{
 docker('run','-d','--name',container,'--tmpfs','/var/lib/postgresql/data','-p','127.0.0.1::5432','-e','POSTGRES_USER=fixture','-e','POSTGRES_DB='+database,'-e','POSTGRES_PASSWORD='+password,'postgres:16-alpine');
 for(let i=0;i<60;i++){try{docker('exec',container,'pg_isready','-h','127.0.0.1','-U','fixture','-d',database);break;}catch{}await new Promise(r=>setTimeout(r,500));}
 const port=docker('port',container,'5432/tcp').split('\n')[0].split(':').at(-1),url=`postgresql://fixture:${password}@127.0.0.1:${port}/${database}`;
 Object.assign(process.env,{DATABASE_URL:url,OSYM_DATABASE_URL:url,OSYM_DATABASE_HOST:'127.0.0.1',OSYM_DATABASE_NAME:database,OSYM_DATABASE_PORT:port,NODE_ENV:'production',DOCUMENT_UPLOADS_ENABLED:'false',SOURCE_SYNC_ENABLED:'false',NOTIFICATIONS_ENABLED:'false'});
 execFileSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy','--schema',path.join(root,'apps/api/prisma/schema.prisma')],{cwd:root,env:process.env,stdio:'pipe',timeout:120000,windowsHide:true});
 const {NestFactory}=require('@nestjs/core'),{PrismaClient}=require('@prisma/client'),{AppModule}=require('../apps/api/dist/module'),{passwordHash}=require('../apps/api/dist/password'),operator=require('./osym-production.cjs');
 db=new PrismaClient();app=await NestFactory.create(AppModule,{logger:false});app.setGlobalPrefix('api/v1');await app.listen(0,'127.0.0.1');process.env.OSYM_API_URL=await app.getUrl()+'/api/v1';
 const email='osym-release-'+suffix+'@example.test',adminPassword=randomBytes(24).toString('hex');await db.user.create({data:{email,passwordHash:await passwordHash(adminPassword),role:'SYSTEM_ADMIN'}});
 Object.assign(process.env,{OSYM_ADMIN_EMAIL:email,OSYM_ADMIN_PASSWORD:adminPassword,OSYM_IMPORT_APPROVAL:`127.0.0.1/${database} ADD VERIFIED OSYM`});
 assert.throws(()=>operator.target(process.env,false));assert.throws(()=>operator.target({...process.env,OSYM_DATABASE_HOST:'wrong'},true));
 const docs=operator.sources();assert.equal(docs.reduce((n,d)=>n+d.parsed,0),8611);
 const initial=await operator.preflight(db,operator.target(process.env,true));await operator.main(['dry-run','--isolated']);assert.equal(await db.historicalPlacement.count(),0);
 await assert.rejects(operator.main(['pilot','--isolated']));assert.equal(await db.historicalPlacement.count(),0);
 await operator.main(['backup','--isolated']);
 const state=path.join(root,'.local/osym-production-tests',database),receipt=path.join(state,'backup-receipt.json'),good=fs.readFileSync(receipt,'utf8');const tampered=JSON.parse(good);tampered.sha256='0'.repeat(64);fs.writeFileSync(receipt,JSON.stringify(tampered));await assert.rejects(operator.main(['pilot','--isolated']));assert.equal(await db.historicalPlacement.count(),0);fs.writeFileSync(receipt,good);
 await operator.main(['pilot','--isolated']);assert.equal(await db.historicalPlacement.count(),504);assert.equal(await db.historicalPlacement.count({where:{approvedAt:{not:null}}}),0);
 await operator.main(['publish-pilot','--isolated']);assert.equal(await db.historicalPlacement.count({where:{approvedAt:{not:null}}}),504);
 const original504=JSON.stringify(await db.historicalPlacement.findMany({orderBy:{positionCode:'asc'}}));
 await operator.main(['remaining','--isolated']);assert.equal(await db.historicalPlacement.count(),8611);assert.equal(await db.historicalPlacement.count({where:{approvedAt:{not:null}}}),8611);assert.equal(await db.placementRound.count(),21);assert.equal(await db.announcement.count(),0);
 const baseline=await db.historicalPlacement.findMany({where:{round:{year:2024,sequenceNo:1,educationLevel:'BACHELOR'}},orderBy:{positionCode:'asc'}});assert.equal(JSON.stringify(baseline),original504);
 for(const d of docs){const query=new URLSearchParams({educationLevel:d.education,year:String(d.year),round:String(d.round),limit:'1'}),data=await(await fetch(process.env.OSYM_API_URL+'/historical/placements?'+query)).json();assert.equal(data.total,d.parsed);const row=data.items[0];
  for(const [key,value] of [['positionCode',row.positionCode],['city',row.city],['institution',row.institutionRawName],['title',row.title]]){if(!value)continue;const q=new URLSearchParams(query);q.set(key,value);const filtered=await(await fetch(process.env.OSYM_API_URL+'/historical/placements?'+q)).json();assert.ok(filtered.total>0);if(key==='positionCode')assert.equal(filtered.total,1);}
  if(row.minScore!==null){const q=new URLSearchParams(query);q.set('minScoreGte',row.minScore);q.set('minScoreLte',row.minScore);const filtered=await(await fetch(process.env.OSYM_API_URL+'/historical/placements?'+q)).json();assert.ok(filtered.total>=1);assert.ok(filtered.items.every(r=>Number(r.minScore)===Number(row.minScore)));}
 }
 const alias=await(await fetch(process.env.OSYM_API_URL+'/historical/placements?educationLevel=SECONDARY&limit=1')).json();assert.equal(alias.total,840);
 await operator.verifyFilters(process.env.OSYM_API_URL,docs[0]);
 assert.equal((await fetch(process.env.OSYM_API_URL+'/historical/placements?positionCode=invalid')).status,400);
 const final=await operator.preflight(db,operator.target(process.env,true));await operator.main(['remaining','--isolated']);const repeat=await operator.preflight(db,operator.target(process.env,true));assert.deepEqual(repeat.snapshot,final.snapshot,'Idempotent rerun must not modify existing source/placement/audit records');
 assert.equal(await db.reviewAudit.count({where:{action:'STAGED'}}),21);assert.equal(await db.reviewAudit.count({where:{action:'APPROVE'}}),21);
 const report={status:'PASS',mode:'ISOLATED_REAL_DOCUMENTS',documents:21,approved:8611,levels:{BACHELOR:4797,ASSOCIATE:2974,HIGH_SCHOOL:840},restoreVerified:true,pilot504Preserved:true,idempotent:true,stageAudit:21,approvalAudit:21,apiFilters:true,productionWrites:0,productionDatabaseAccess:false,deviceChecks:0};fs.mkdirSync(path.join(root,'.local/osym-production'),{recursive:true});fs.writeFileSync(path.join(root,'.local/osym-production/isolated-test.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{if(app)await app.close();if(db)await db.$disconnect();if(!/^kadroradar-osym-prod-test-[a-f0-9]{12}$/.test(container))throw Error('Unsafe cleanup target');try{docker('rm','-f',container);}catch{}}
})().catch(error=>{console.error(String(error.message).replaceAll(password,'[REDACTED]'));process.exitCode=1;});
