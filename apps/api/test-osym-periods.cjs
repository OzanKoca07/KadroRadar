// Real PDFs, isolated PostgreSQL and real API/review. Only HTTP transport is cached.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),cp=require('node:child_process'),{randomBytes,createHash}=require('node:crypto');
if(!process.env.DATABASE_URL?.includes('/kadroradar_ingestion_test_'))throw Error('Isolated DB required');
if(!process.env.OSYM_REAL_CATALOG)throw Error('OSYM_REAL_CATALOG required; no synthetic fallback');
const catalogFile=path.resolve(process.env.OSYM_REAL_CATALOG),catalog=JSON.parse(fs.readFileSync(catalogFile,'utf8')),root=path.resolve(__dirname,'../..');
const originalExec=cp.execFile;
cp.execFile=function(executable,args,options,callback){if(args?.[0]?.endsWith('osym_web.py')){args=[path.join(root,'services/ingest/fixtures/osym_cached_transport.py'),...args.slice(1)];options={...options,env:{...process.env,...options.env,OSYM_TEST_CACHE:path.join(path.dirname(catalogFile),'cache')}};}return originalExec.call(this,executable,args,options,callback);};
require('reflect-metadata');process.env.NODE_ENV='production';process.env.SOURCE_SYNC_ENABLED='false';process.env.NOTIFICATIONS_ENABLED='false';process.env.DOCUMENT_UPLOADS_ENABLED='true';
process.env.HISTORICAL_STORAGE_DIR=path.join(root,'.local/osym-periods-test',randomBytes(8).toString('hex'));
const {PrismaClient}=require('@prisma/client'),{NestFactory}=require('@nestjs/core'),{AppModule}=require('./dist/module'),{passwordHash}=require('./dist/password');
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
(async()=>{const db=new PrismaClient(),app=await NestFactory.create(AppModule,{logger:false});app.setGlobalPrefix('api/v1');await app.listen(0,'127.0.0.1');const base=await app.getUrl()+'/api/v1',results=[];let actor,token;
async function call(route,method='GET',body,expected=200){const response=await fetch(base+route,{method,headers:{...(token?{authorization:'Bearer '+token}:{}),...(body instanceof FormData?{}:{'content-type':'application/json'})},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body),signal:AbortSignal.timeout(120000)});const data=await response.json();assert.equal(response.status,expected,JSON.stringify(data));return data;}
async function review(batch,rows){await call('/admin/imports/'+batch+'/approve','POST',{confirmation:rows+' KAYDI KONTROL ETTİM'},403);await db.user.update({where:{id:actor.id},data:{role:'REVIEWER'}});await call('/admin/imports/'+batch+'/approve','POST',{confirmation:'unverified'},400);const approval=await call('/admin/imports/'+batch+'/approve','POST',{confirmation:rows+' KAYDI KONTROL ETTİM'},201);assert.equal(approval.approvedCount,rows);await db.user.update({where:{id:actor.id},data:{role:'CONTENT_EDITOR'}});}
try{
 const restored=process.env.OSYM_BASELINE_RESTORED==='true';assert.equal(await db.historicalPlacement.count(),restored?504:0,'Fresh isolated database or explicitly restored504 baseline required');
 const password=randomBytes(24).toString('hex');actor=await db.user.create({data:{email:'osym-'+randomBytes(8).toString('hex')+'@example.test',passwordHash:await passwordHash(password),role:'CONTENT_EDITOR'}});
 const login=await fetch(base+'/account/login',{method:'POST',headers:{'content-type':'application/json','x-client-platform':'mobile'},body:JSON.stringify({email:actor.email,password})});assert.equal(login.status,201);token=(await login.json()).token;
 if(!restored){const bytes=fs.readFileSync(path.join(root,'reference/minmaxlisans29072024.pdf')),body=new FormData();body.append('file',new Blob([bytes],{type:'application/pdf'}),'baseline.pdf');const baseline=await call('/admin/historical-documents','POST',body,201);assert.equal(baseline.rows,504);await review(baseline.batchId,504);}
 const baselineWhere={round:{year:2024,sequenceNo:1,educationLevel:'BACHELOR'}};const original=hash(await db.historicalPlacement.findMany({where:baselineWhere,orderBy:{positionCode:'asc'}}));
 const archive=await call('/admin/historical-documents/archive','POST',{archiveUrl:catalog.archiveUrl},201);assert.ok(archive.periods.some(p=>p.year===2026&&p.round===1));assert.ok(archive.periods.some(p=>p.year===2023&&p.round===1));
 const documents=catalog.documents.filter(d=>d.status==='PARSED');assert.equal(documents.length,18,'18 real parsed documents required');
 for(const document of documents){
  assert.equal(createHash('sha256').update(fs.readFileSync(document.file)).digest('hex'),document.documentSha256);
  const input={indexUrl:document.indexUrl,archiveUrl:catalog.archiveUrl,documentUrl:document.documentUrl};
  const staged=await call('/admin/historical-documents/web','POST',input,201);assert.equal(staged.rows,document.parsed);assert.equal(staged.metadata.year,document.year);assert.equal(staged.metadata.round,document.round);assert.equal(staged.metadata.education,document.education);
  const query='?educationLevel='+document.education+'&year='+document.year+'&round='+document.round;assert.equal((await call('/historical/placements'+query)).total,0);
  const preview=(await db.historicalPlacement.findFirst({where:{sourceDocumentId:(await db.sourceDocument.findUnique({where:{sha256:document.documentSha256}})).id}}));await call('/historical/placements/'+preview.id,'GET',undefined,404);
  const duplicate=await call('/admin/historical-documents/web','POST',input,201);assert.equal(duplicate.duplicate,true);assert.equal(duplicate.batchId,staged.batchId);
  const evidence=await call('/admin/historical-documents/'+staged.batchId+'/metadata');assert.equal(evidence.originalUrl,document.documentUrl);assert.equal(evidence.historicalEvidence.publishedAt,document.publishedAt);assert.equal(evidence.historicalEvidence.documentSha256,document.documentSha256);assert.equal(evidence.historicalEvidence.qualificationCodesVerified,false);
  await review(staged.batchId,staged.rows);
  const data=await call('/historical/placements'+query+'&limit=100');assert.equal(data.total,document.parsed);assert.ok(data.items.every(row=>row.round.year===document.year&&row.round.sequenceNo===document.round&&row.round.educationLevel===document.education));
  for(const row of data.items)for(const score of [row.minScore,row.maxScore])if(score!==null)assert.match(score,/^\d{1,3}(?:\.\d{1,5})?$/);
  const detail=await call('/historical/placements/'+data.items[0].id);assert.equal(detail.sourceDocument.originalUrl,document.documentUrl);assert.ok(detail.qualificationNote.includes('Nitelik'));
  results.push({period:document.period,education:document.education,indexUrl:document.indexUrl,documentUrl:document.documentUrl,publishedAt:document.publishedAt,sha256:document.documentSha256,parsed:document.parsed,errors:0,duplicate:document.parsed,staged:staged.rows,approvedTest:staged.rows,productionTransferred:0});console.log('PASS '+document.period+' '+document.education+' '+staged.rows);
 }
 assert.equal(hash(await db.historicalPlacement.findMany({where:baselineWhere,orderBy:{positionCode:'asc'}})),original,'Original 504 records unchanged');
 const rounds=await call('/historical/rounds');assert.equal(rounds.length,19);
 assert.ok(await db.historicalPlacement.count({where:{maxScore:'100.00000'}})>0,'Observed full100 score must retain precision');
 for(const education of ['BACHELOR','ASSOCIATE','HIGH_SCHOOL'])for(const year of [2023,2024,2025,2026]){const expected=results.filter(r=>r.education===education&&r.period.startsWith(year+'/')).reduce((n,r)=>n+r.approvedTest,education==='BACHELOR'&&year===2024?504:0);assert.equal((await call('/historical/placements?educationLevel='+education+'&year='+year)).total,expected);}
 const report={status:'PASS',network:'CACHED_REAL_OFFICIAL_DOCUMENTS',baseline504Preserved:true,results,totalApproved:await db.historicalPlacement.count({where:{approvedAt:{not:null}}}),productionTransferred:0,deviceChecks:0};fs.writeFileSync(path.join(path.dirname(catalogFile),'integration-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,documents:results.length,totalApproved:report.totalApproved,baseline504Preserved:true,productionTransferred:0}));
}finally{await app.close();if(actor){await db.candidateSession.deleteMany({where:{userId:actor.id}});await db.user.delete({where:{id:actor.id}});}await db.$disconnect();cp.execFile=originalExec;}})().catch(error=>{console.error(error);process.exitCode=1;});
