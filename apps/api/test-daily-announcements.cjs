require('./test-source-fixtures.cjs').permitManualFixtures();
// HTTP integration with explicitly synthetic documents; never a live Gazette fetch.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{execFileSync}=require('node:child_process'),{randomBytes}=require('node:crypto');require('reflect-metadata');
if(!process.env.DATABASE_URL?.includes('/kadroradar_ingestion_test_'))throw Error('Isolated DB required');
process.env.NODE_ENV='production';process.env.NOTIFICATIONS_ENABLED='false';process.env.SOURCE_SYNC_ENABLED='false';process.env.PROCESS_ROLE='api';
const {NestFactory}=require('@nestjs/core'),{PrismaClient}=require('@prisma/client'),{AppModule}=require('./dist/module'),{passwordHash}=require('./dist/password'),{notificationPlan}=require('./dist/notification-plan');
(async()=>{
 const db=new PrismaClient(),suffix=randomBytes(6).toString('hex'),root=path.resolve(__dirname,'../..');process.env.GAZETTE_STORAGE_DIR=path.join(root,'.local/daily-test',suffix);await fs.mkdir(process.env.GAZETTE_STORAGE_DIR,{recursive:true});
 const app=await NestFactory.create(AppModule,{logger:false});app.setGlobalPrefix('api/v1');await app.listen(0,'127.0.0.1');const base=await app.getUrl()+'/api/v1';let token;
 async function request(route,body,status=200,method=body?'POST':'GET'){const r=await fetch(base+route,{method,headers:{'content-type':'application/json','x-client-platform':'mobile',...(token?{authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});const value=await r.json();assert.equal(r.status,status,JSON.stringify(value));return value;}
 async function form(route,bytes,fields,type,status=201){const data=new FormData();data.append('file',new Blob([bytes],{type}),type==='text/html'?'index.html':'gazette.pdf');for(const [k,v] of Object.entries(fields))data.append(k,v);const r=await fetch(base+route,{method:'POST',headers:token?{authorization:'Bearer '+token}:{},body:data});const value=await r.json();assert.equal(r.status,status,JSON.stringify(value));return value;}
 try{
  await request('/admin/gazette-documents/indexes',undefined,401);
  const email=`daily-${suffix}@example.test`,password=randomBytes(24).toString('hex');const user=await db.user.create({data:{email,passwordHash:await passwordHash(password),role:'CONTENT_EDITOR'}});token=(await request('/account/login',{email,password},201)).token;
  const pdf=path.join(process.env.GAZETTE_STORAGE_DIR,'fixture.pdf');execFileSync('python',[path.join(root,'services/ingest/fixtures/make_gazette_fixture.py'),pdf]);const bytes=await fs.readFile(pdf);
  const sourceUrl='https://www.resmigazete.gov.tr/eskiler/2026/10/20261001.pdf',indexUrl='https://www.resmigazete.gov.tr/';
  const html='<h2>1 Ekim 2026 Tarihli ve 99999 Sayılı Resmî Gazete</h2><a href="'+sourceUrl+'">PDF Görüntüle</a><a href="/ilanlar/fixture.htm">Çeşitli İlânlar</a>';
  await form('/admin/gazette-documents/indexes',html,{indexUrl:'https://127.0.0.1/'},'text/html',400);
  const index=await form('/admin/gazette-documents/indexes',html,{indexUrl},'text/html');const duplicateIndex=await form('/admin/gazette-documents/indexes',html,{indexUrl},'text/html');assert.equal(index.documentId,duplicateIndex.documentId);assert.equal(index.manifest.liveFetch,false);
  const indexPreview=await fetch(base+'/admin/gazette-documents/indexes/'+index.documentId+'/file',{headers:{authorization:'Bearer '+token}});assert.equal(indexPreview.headers.get('content-type'),'text/plain; charset=utf-8');assert.equal(await indexPreview.text(),html);
  await form('/admin/gazette-documents',bytes,{sourceUrl:sourceUrl.replace('20261001','20261002'),indexDocumentId:index.documentId},'application/pdf',400);
  const mismatch=await form('/admin/gazette-documents/indexes',html.replace('99999','99998'),{indexUrl},'text/html');await form('/admin/gazette-documents',bytes,{sourceUrl,indexDocumentId:mismatch.documentId},'application/pdf',400);
  const imported=await form('/admin/gazette-documents',bytes,{sourceUrl,indexDocumentId:index.documentId},'application/pdf');assert.ok(imported.created>0);assert.equal(imported.candidates[0].sourceEvidence.index.indexUrl,indexUrl);
  const twice=await form('/admin/gazette-documents',bytes,{sourceUrl,indexDocumentId:index.documentId},'application/pdf');assert.equal(twice.created,0);assert.equal(twice.duplicate,imported.candidates.length);
  const htmlNotice='<h3>Örnek Üniversitesi Rektörlüğünden:</h3><p>Personel alım ilanı</p><table><tr><th>Unvan</th><th>Kontenjan</th><th>Şartlar</th></tr><tr><td>Memur</td><td>1</td><td>Lisans KPSSP3 en az 70 puan</td></tr></table><script>window.DANGEROUS=true</script>';
  const notice=await form('/admin/gazette-documents',htmlNotice,{sourceUrl:'https://www.resmigazete.gov.tr/ilanlar/fixture.htm',indexDocumentId:index.documentId},'text/html');assert.equal(notice.created,1);assert.equal(notice.metrics.positionRows,1);
  const preview=await fetch(base+'/admin/gazette-documents/'+notice.documentId+'/file',{headers:{authorization:'Bearer '+token}});assert.equal(preview.headers.get('content-type'),'text/plain; charset=utf-8');assert.equal(await preview.text(),htmlNotice);
  if(process.env.CURRENT_REAL_DIR){
   const directory=path.resolve(process.env.CURRENT_REAL_DIR),crypto=require('node:crypto');
   async function verifiedFile(name,receiptName){const data=await fs.readFile(path.join(directory,name)),receipt=JSON.parse(await fs.readFile(path.join(directory,receiptName),'utf8'));assert.equal(receipt.downloaded,true);assert.equal(receipt.mode,'EXPLICIT_LIVE_READ');assert.equal(crypto.createHash('sha256').update(data).digest('hex'),receipt.sha256);return {data,receipt};}
   const rootIndex=await verifiedFile('gazette-index.html','gazette-probe.json');
   const realIndex=await form('/admin/gazette-documents/indexes',rootIndex.data,{indexUrl:rootIndex.receipt.url},'text/html');
   const section=await verifiedFile('gazette-notices.html','gazette-notices-probe.json');assert.ok(realIndex.manifest.links.some(l=>l.url===section.receipt.url));
   const sectionIndex=await form('/admin/gazette-documents/indexes',section.data,{indexUrl:section.receipt.url},'text/html');
   const document=await verifiedFile('gazette-real-notice.pdf','gazette-real-notice-probe.json');assert.ok(sectionIndex.manifest.links.some(l=>l.url===document.receipt.url));
   const real=await form('/admin/gazette-documents',document.data,{sourceUrl:document.receipt.url,indexDocumentId:sectionIndex.documentId},'application/pdf');
   assert.equal(real.created,2);assert.equal(real.metrics.positionRows,20);
   const repeated=await form('/admin/gazette-documents',document.data,{sourceUrl:document.receipt.url,indexDocumentId:sectionIndex.documentId},'application/pdf');assert.equal(repeated.created,0);assert.equal(repeated.duplicate,2);
   const rss=await fs.readFile(path.join(directory,'energy-complete.xml'));
   const feed=await form('/admin/gazette-documents/feed-reviews',rss,{},'text/xml');assert.equal(feed.announcementRowsCreated,0);assert.equal(feed.report.itemCount,100);assert.equal(feed.report.unresolved.length,1);assert.equal(feed.report.rows.length,0);
   const feedAgain=await form('/admin/gazette-documents/feed-reviews',rss,{},'text/xml');assert.equal(feedAgain.documentId,feed.documentId);
   const rawRss=await fetch(base+'/admin/gazette-documents/feed-reviews/'+feed.documentId+'/file',{headers:{authorization:'Bearer '+token}});assert.equal(rawRss.status,200);assert.deepEqual(Buffer.from(await rawRss.arrayBuffer()),rss);
   await form('/admin/gazette-documents/feed-reviews','<!DOCTYPE rss><rss/>',{},'text/xml',400);
   await db.user.update({where:{id:user.id},data:{role:'REVIEWER'}});
   await form('/admin/gazette-documents/feed-reviews',rss,{},'text/xml',403);
   let realRows=(await request('/admin/announcement-imports')).filter(row=>row.sourceDocumentId===real.documentId),published=0,publicPositions=0;
   for(let row of realRows){
    await request('/admin/announcement-imports/'+row.id+'/review',{version:row.version,action:'APPROVE',sourceVerified:true,documentVerified:true,positionsReviewed:true,resolvedIssues:true,evidence:'ISOLATED TEST approval of downloaded official document; no editorial or reuse permission asserted. Unknown dates and requirements retained.'},201);
    row=(await request('/admin/announcement-imports')).find(r=>r.id===row.id);
    const publication=await request('/admin/announcement-imports/'+row.id+'/review',{version:row.version,action:'PUBLISH'},201);
    const detail=await request('/announcements/'+publication.announcementId);assert.equal(detail.sourceUrl,document.receipt.url);assert.ok(detail.sourceCheckedAt);publicPositions+=detail.positions.length;published++;
    assert.ok(detail.positions.every(p=>p.requirements.complete===false&&p.requirements.degreeCodesVerified===false));
    assert.ok(!(await request('/announcements')).items.some(item=>item.id===detail.id));
    for(const level of ['LISANS','ONLISANS','ORTAOGRETIM'])assert.ok(!(await request('/announcements?educationLevel='+level)).items.some(item=>item.id===detail.id));
   }
   assert.equal(published,2);assert.equal(publicPositions,20);
   await db.user.update({where:{id:user.id},data:{role:'CONTENT_EDITOR'}});
   console.log(JSON.stringify({mode:'REAL_DOWNLOADED_DOCUMENT_ISOLATED_TEST',downloadedPdfs:1,parsedCandidates:2,parsedPositionRows:20,staged:real.created,duplicates:repeated.duplicate,testApproved:2,testPublished:published,publicApiPositions:publicPositions,openCurrent:0,rssReviewDocuments:1,rssUnresolved:1,permission:'UNVERIFIED',productionWrites:0,androidDeviceChecks:0}));
  }
  const now=new Date(),org='SYNTHETIC Daily '+suffix;
  const announcement=await db.announcement.create({data:{title:org,organization:org,city:'Ankara',status:'PUBLISHED',sourceUrl,publishedAt:now,sourceCheckedAt:now,applicationStartAt:new Date(Date.now()-86400000),applicationEndAt:new Date(Date.now()+86400000),positions:{create:[
   {title:'Memur',verifiedAt:now,city:'Ankara',requirements:{educationLevels:['LISANS'],kpssScoreType:'P3',kpssRequired:true,kpssMinimumScore:70,degreeCodes:['FIXTURE'],degreeCodesVerified:true,complete:false}},
   {title:'Tekniker',verifiedAt:now,city:'İzmir',requirements:{educationLevels:['ONLISANS'],kpssScoreType:'P93',kpssRequired:true,kpssMinimumScore:60}},
   {title:'Destek',verifiedAt:now,requirements:{educationLevels:['ORTAOGRETIM'],kpssScoreType:'P94',kpssRequired:true,kpssMinimumScore:60}}
  ]}}});
  async function filtered(query){return request('/announcements?organization='+encodeURIComponent(org)+'&'+query);}
  for(const [education,type] of [['LISANS','P3'],['ONLISANS','P93'],['ORTAOGRETIM','P94']])assert.equal((await filtered(`educationLevel=${education}&kpssScoreType=${type}&kpssScore=75`)).total,1);
  assert.equal((await filtered('educationLevel=LISANS&kpssScoreType=P93')).total,0);assert.equal((await filtered('educationLevel=LISANS&kpssScore=69')).total,0);
  assert.equal((await filtered('degreeCode=FIXTURE&positionTitle=Memur&city=Ankara')).total,1);assert.equal((await filtered('degreeCode=UNVERIFIED')).total,0);
  await request('/announcements?kpssScore=NaN',undefined,400);await request('/announcements?deadlineBefore=2026-02-31',undefined,400);await request('/announcements?educationLevel=UNKNOWN',undefined,400);
  await db.announcement.update({where:{id:announcement.id},data:{applicationEndAt:null}});assert.equal((await filtered('educationLevel=LISANS')).total,0);
  const oldEnd=new Date(Date.now()-86400000);await db.announcement.update({where:{id:announcement.id},data:{applicationEndAt:oldEnd}});assert.equal((await request('/announcements?view=archive&organization='+encodeURIComponent(org))).total,1);
  await request('/account/saved/'+announcement.id,{},200,'PUT');
  const doc=await db.sourceDocument.findUnique({where:{id:imported.documentId}});
  async function event(kind){return db.announcementImportRow.create({data:{sourceUrl:`urn:synthetic:event:${suffix}:${kind}`,contentHash:randomBytes(32).toString('hex'),sourceDocumentId:doc.id,raw:{eventType:kind,sourceEvidence:{pdfSha256:doc.sha256,pageStart:1,pageEnd:1}},parsed:{title:'Synthetic event',organization:org},issues:['SYNTHETIC_EVENT_REQUIRES_REVIEW']}});}
  const correction=await event('CORRECTION'),newEnd=new Date(Date.now()+7*86400000).toISOString();const payload={version:correction.version,announcementId:announcement.id,action:'EXTEND',applicationEndAt:newEnd,documentVerified:true,evidence:'Synthetic isolated source checked; no actual recruitment event.'};
  await request('/admin/announcement-imports/'+correction.id+'/apply-event',payload,403);await db.user.update({where:{id:user.id},data:{role:'REVIEWER'}});
  await request('/admin/announcement-imports/'+correction.id+'/apply-event',{...payload,documentVerified:false},400);await request('/admin/announcement-imports/'+correction.id+'/apply-event',payload,201);await request('/admin/announcement-imports/'+correction.id+'/apply-event',payload,409);
  let htmlRow=(await request('/admin/announcement-imports')).find(row=>row.sourceDocumentId===notice.documentId);
  await request('/admin/announcement-imports/'+htmlRow.id+'/review',{version:htmlRow.version,action:'APPROVE',sourceVerified:true,documentVerified:true,positionsReviewed:true,resolvedIssues:true,evidence:'SYNTHETIC HTML source checked in an isolated test; incomplete conditions stay unknown.'},201);
  htmlRow=(await request('/admin/announcement-imports')).find(row=>row.id===htmlRow.id);
  const htmlPublication=await request('/admin/announcement-imports/'+htmlRow.id+'/review',{version:htmlRow.version,action:'PUBLISH'},201);
  const htmlDetail=await request('/announcements/'+htmlPublication.announcementId);assert.equal(htmlDetail.sourceEvidence.format,'HTML');assert.equal(htmlDetail.positions.length,1);assert.equal(htmlDetail.sourceEvidence.documentSha256,notice.sha256);
  assert.ok(!(await request('/announcements')).items.some(item=>item.id===htmlDetail.id));
  let saved=await request('/account/saved');assert.equal(saved.find(s=>s.announcementId===announcement.id).announcement.applicationEndAt,newEnd);
  assert.equal(notificationPlan({notificationConsent:true},[],saved).find(e=>e.announcementId===announcement.id).kind,'EXTENDED');
  await db.announcement.update({where:{id:announcement.id},data:{sourceCheckedAt:null}});saved=await request('/account/saved');assert.equal(notificationPlan({notificationConsent:true},[],saved).filter(e=>e.announcementId===announcement.id).length,0);
  await db.announcement.update({where:{id:announcement.id},data:{sourceCheckedAt:new Date()}});
  const cancellation=await event('CANCELLATION');await request('/admin/announcement-imports/'+cancellation.id+'/apply-event',{...payload,version:cancellation.version,action:'WITHDRAW'},201);await request('/announcements/'+announcement.id,undefined,404);
  saved=await request('/account/saved');assert.equal(saved.find(s=>s.announcementId===announcement.id).announcement.status,'WITHDRAWN');assert.equal(notificationPlan({notificationConsent:true},[],saved).find(e=>e.announcementId===announcement.id).kind,'WITHDRAWN');
  console.log(JSON.stringify({status:'PASS',mode:'SYNTHETIC_OFFLINE',indexDeduplicated:true,sourceAndDateMismatchRejected:true,educationLevels:3,samePositionFiltering:true,extensionAndCancellation:true,unverifiedNotificationSuppressed:true,productionWrites:0,androidDeviceChecks:0}));
 }finally{await app.close();await db.$disconnect();}
})().catch(e=>{console.error(e);process.exitCode=1;});
