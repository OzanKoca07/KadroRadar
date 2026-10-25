const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');const {execFileSync}=require('node:child_process');const {randomBytes,createHash}=require('node:crypto');require('reflect-metadata');
if(!process.env.DATABASE_URL?.includes('/kadroradar_ingestion_test_'))throw Error('Isolated database required');
process.env.NOTIFICATIONS_ENABLED='false';process.env.NODE_ENV='production';
const {NestFactory}=require('@nestjs/core');const {PrismaClient}=require('@prisma/client');const {AppModule}=require('./dist/module');const {passwordHash}=require('./dist/password');
(async()=>{
 const suffix=randomBytes(8).toString('hex'),root=path.resolve(__dirname,'../..');
 process.env.GAZETTE_STORAGE_DIR=path.join(root,'.local','gazette-test',suffix);
 const db=new PrismaClient();const app=await NestFactory.create(AppModule,{logger:false});app.setGlobalPrefix('api/v1');await app.listen(0,'127.0.0.1');const base=await app.getUrl()+'/api/v1';
 async function request(route,{method='GET',token,body,status=200}={}){const response=await fetch(base+route,{method,headers:{'content-type':'application/json','x-client-platform':'mobile',...(token?{authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;}
 const real=!!process.env.GAZETTE_REAL_PDF;let pdf=process.env.GAZETTE_REAL_PDF;
 try{
  if(!pdf){await fs.mkdir(path.join(root,'tmp','pdfs'),{recursive:true});pdf=path.join(root,'tmp','pdfs','synthetic-gazette-'+suffix+'.pdf');execFileSync('python',[path.join(root,'services/ingest/fixtures/make_gazette_fixture.py'),pdf]);}
  const bytes=await fs.readFile(pdf),sha=createHash('sha256').update(bytes).digest('hex');
  const email=`gazette-${suffix}@example.test`,password=randomBytes(20).toString('hex');const user=await db.user.create({data:{email,passwordHash:await passwordHash(password),role:'CONTENT_EDITOR'}});
  const login=await request('/account/login',{method:'POST',body:{email,password},status:201});const token=login.token;
  async function upload(data=bytes,auth=token,expected=201){const form=new FormData();form.append('file',new Blob([data],{type:'application/pdf'}),'gazette.pdf');const response=await fetch(base+'/admin/gazette-documents',{method:'POST',headers:auth?{authorization:'Bearer '+auth}:{},body:form});const result=await response.json();assert.equal(response.status,expected,JSON.stringify(result));return result;}
  await upload(Buffer.from('not a pdf'),null,401);
  await db.user.update({where:{id:user.id},data:{role:'USER'}});
  await upload(Buffer.from('not a pdf'),token,403);
  await db.user.update({where:{id:user.id},data:{role:'CONTENT_EDITOR'}});
  await upload(Buffer.from('not a pdf'),token,400);
  const first=await upload();assert.equal(first.sha256,sha);assert.ok(first.candidates.length>0);
  const twice=await upload();assert.equal(twice.created,0);assert.equal(twice.duplicate,first.candidates.length);
  const privateResponse=await fetch(base+'/admin/gazette-documents/'+first.documentId+'/file');assert.equal(privateResponse.status,401);
  const preview=await fetch(base+'/admin/gazette-documents/'+first.documentId+'/file',{headers:{authorization:'Bearer '+token}});assert.equal(preview.status,200);assert.equal(createHash('sha256').update(Buffer.from(await preview.arrayBuffer())).digest('hex'),sha);
  const targets=real?first.candidates.filter(c=>/Niğde Ömer Halisdemir|Atalan/.test(c.organization)):first.candidates;
  if(real){assert.equal(first.pageCount,140);assert.equal(first.gazetteNumber,'33380');assert.equal(targets.length,2);}
  let published=0,positionRows=0;
  for(const target of targets){
   let row=(await request('/admin/announcement-imports',{token})).find(r=>r.sourceUrl===target.identity);
   await request('/admin/announcement-imports/'+row.id,{method:'PATCH',token,body:{version:row.version,fields:row.parsed},status:200});
   row=(await request('/admin/announcement-imports',{token})).find(r=>r.id===row.id);
   if(!real && row.parsed.positions.length){
    const manual=structuredClone(row.parsed);manual.positions.push({...manual.positions[0],parserPositionKey:'manual:test-extra',sourceEvidence:{page:manual.sourceEvidence.pageStart,text:'Synthetic source quotation for manual row test only.'}});manual.quota=manual.positions.reduce((total,p)=>total+p.quota,0);
    await request('/admin/announcement-imports/'+row.id,{method:'PATCH',token,body:{version:row.version,fields:manual},status:200});
    row=(await request('/admin/announcement-imports',{token})).find(r=>r.id===row.id);assert.equal(row.parsed.positions.length,target.positions.length+1);
    await request('/admin/announcement-imports/'+row.id,{method:'PATCH',token,body:{version:row.version,fields:target},status:200});row=(await request('/admin/announcement-imports',{token})).find(r=>r.id===row.id);
   }
   await request('/admin/announcement-imports/'+row.id+'/review',{method:'POST',token,body:{version:row.version,action:'APPROVE',sourceVerified:true,evidence:'Test only'},status:403});
   await db.user.update({where:{id:user.id},data:{role:'SYSTEM_ADMIN'}});
   await request('/admin/announcement-imports/'+row.id+'/review',{method:'POST',token,body:{version:row.version,action:'APPROVE',sourceVerified:true,evidence:'Missing explicit PDF checks'},status:400});
   await request('/admin/announcement-imports/'+row.id+'/review',{method:'POST',token,body:{version:row.version,action:'APPROVE',sourceVerified:true,documentVerified:true,positionsReviewed:true,resolvedIssues:true,evidence:real?'Isolated test: original PDF pages and table rows checked; unknown hours and degree equivalences remain unverified.':'Synthetic PDF fixture; no real recruitment.'},status:201});
   row=(await request('/admin/announcement-imports',{token})).find(r=>r.id===row.id);
   await request('/admin/announcement-imports/'+row.id+'/review',{method:'POST',token,body:{version:row.version-1,action:'PUBLISH'},status:409});
   if(row.parsed.positions.length){const changed=structuredClone(row.parsed);changed.positions[0].requirements.complete=true;await request('/admin/announcement-imports/'+row.id+'/review',{method:'POST',token,body:{version:row.version,action:'PUBLISH',fields:changed},status:400});}
   const publication=await request('/admin/announcement-imports/'+row.id+'/review',{method:'POST',token,body:{version:row.version,action:'PUBLISH'},status:201});
   const detail=await request('/announcements/'+publication.announcementId);assert.equal(detail.sourceEvidence.pdfSha256,sha);assert.equal(detail.sourceUrl,null);assert.equal(detail.positions.length,target.positions.length);assert.equal(detail.quota,target.quota);
   if(published===0){
    const alternateUrl='https://enerji.gov.tr/synthetic-cross-source-'+suffix;
    await request('/admin/announcement-imports',{method:'POST',token,body:{rows:[{title:'SYNTHETIC cross-source mapping test',organization:'Fixture only',sourceUrl:alternateUrl}]},status:201});
    let alternate=(await request('/admin/announcement-imports',{token})).find(r=>r.sourceUrl===alternateUrl);
    const countBefore=await db.announcement.count();
    await request('/admin/announcement-imports/'+alternate.id+'/link',{method:'POST',token,body:{version:alternate.version,announcementId:detail.id,documentVerified:true,evidence:'SYNTHETIC link mechanism test only; not a verified second real source.'},status:201});
    assert.equal(await db.announcement.count(),countBefore);
    alternate=(await request('/admin/announcement-imports',{token})).find(r=>r.id===alternate.id);
    await request('/admin/announcement-imports/'+alternate.id+'/review',{method:'POST',token,body:{version:alternate.version,action:'APPROVE',sourceVerified:true,evidence:'Synthetic secondary source publication must be blocked.'},status:201});
    alternate=(await request('/admin/announcement-imports',{token})).find(r=>r.id===alternate.id);
    await request('/admin/announcement-imports/'+alternate.id+'/review',{method:'POST',token,body:{version:alternate.version,action:'PUBLISH'},status:400});
   }
   assert.equal((await request('/account/matches/'+detail.id,{token})).items[0].outcome,'UNKNOWN');
   const open=await request('/announcements?q='+encodeURIComponent(target.organization));assert.ok(!open.items.some(i=>i.id===detail.id));
   if(real&&target.organization.includes('Niğde')){assert.equal(detail.quota,29);const archive=await request('/announcements?view=archive&q='+encodeURIComponent(target.organization));assert.ok(archive.items.some(i=>i.id===detail.id));}
   positionRows+=detail.positions.length;published++;
   await db.user.update({where:{id:user.id},data:{role:'CONTENT_EDITOR'}});
  }
  await db.user.update({where:{id:user.id},data:{role:'SYSTEM_ADMIN'}});
  await request('/admin/gazette-documents/'+first.documentId+'/file',{method:'DELETE',token});
  await request('/account',{method:'DELETE',token});
  console.log(JSON.stringify({status:'PASS',mode:real?'REAL_LOCAL_PDF':'SYNTHETIC_OFFLINE_FIXTURE',pageCount:first.pageCount,inspectedPages:first.inspectedPages,flaggedPages:first.metrics.flaggedPages,candidates:first.candidates.length,created:first.created,duplicates:twice.duplicate,reviewedAndPublishedInIsolatedDb:published,publishedPositionRows:positionRows,productionWrites:0,androidDeviceChecks:0}));
 }finally{await app.close();await db.$disconnect();if(!real&&pdf)await fs.unlink(pdf).catch(()=>{});}
})().catch(error=>{console.error(error);process.exitCode=1;});
