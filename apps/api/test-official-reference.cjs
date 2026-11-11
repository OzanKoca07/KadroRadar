// One manually checked real reference, isolated DB only. No scheduled scraping.
const assert=require('node:assert/strict');const {randomBytes,createHmac}=require('node:crypto');require('reflect-metadata');
if(!process.env.DATABASE_URL?.includes('/kadroradar_ingestion_test_'))throw Error('Isolated DB required');
process.env.NODE_ENV='test';process.env.ANNOUNCEMENT_AUTH_SECRET=randomBytes(48).toString('hex');
process.env.NOTIFICATIONS_ENABLED='false';
const {NestFactory}=require('@nestjs/core');const {AppModule}=require('./dist/module');
const reference={title:'Kıyı Emniyeti Genel Müdürlüğü Türkiye İş Kurumu Üzerinden Sürekli İşçi Alım Duyurusu',organization:'Kıyı Emniyeti Genel Müdürlüğü',sourceUrl:'https://www.uab.gov.tr/duyurular/kiyi-emniyeti-genel-mueduerluegue-tuerkiye-is-kurumu-uezerinden-suerekli-isci-alim-duyurusu/'};
(async()=>{const app=await NestFactory.create(AppModule,{logger:false});app.setGlobalPrefix('api/v1');await app.listen(0,'127.0.0.1');const base=await app.getUrl()+'/api/v1';
 const iat=Math.floor(Date.now()/1000),payload=Buffer.from(JSON.stringify({sub:'isolated-reference-test',role:'SYSTEM_ADMIN',iat,exp:iat+600,aud:'announcement-admin'})).toString('base64url');const token=payload+'.'+createHmac('sha256',process.env.ANNOUNCEMENT_AUTH_SECRET).update(payload).digest('base64url');
 async function request(path,body){const response=await fetch(base+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});const value=await response.json();assert.ok(response.ok,JSON.stringify(value));return value;}
 try{
  const first=await request('/admin/announcement-imports',{rows:[reference]});assert.equal(first.created+first.duplicate+first.changed,1);
  assert.equal((await request('/admin/announcement-imports',{rows:[reference]})).duplicate,1);
  let row;for(const action of ['APPROVE','PUBLISH','ARCHIVE']){row=(await request('/admin/announcement-imports')).find(r=>r.sourceUrl===reference.sourceUrl);await request('/admin/announcement-imports/'+row.id+'/review',{version:row.version,action,sourceVerified:true,evidence:'Isolated reference test. Official page manually checked 2026-10-25; announced 2026-10-19, period 19–23 October has ended. Exact deadline hour and position conditions not inferred.'});}
  row=(await request('/admin/announcement-imports')).find(r=>r.sourceUrl===reference.sourceUrl);
  const item=await request('/announcements/'+row.announcementId);assert.equal(item.sourceUrl,reference.sourceUrl);assert.equal(item.applicationEndAt,null);assert.equal(item.applicationUrl,null);
  const open=await request('/announcements?q='+encodeURIComponent(reference.title));assert.ok(!open.items.some(r=>r.id===row.announcementId));
  const archive=await request('/announcements?view=archive&q='+encodeURIComponent(reference.title));assert.ok(archive.items.some(r=>r.id===row.announcementId));
  console.log('PASS: 1 real official reference → isolated staging → simulated review/publication → archive; no inferred dates/application URL, no production write, no native-device verification');
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
