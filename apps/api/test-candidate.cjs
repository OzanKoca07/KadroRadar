require('./test-source-fixtures.cjs').permitManualFixtures();
const assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');
require('reflect-metadata');
if(!process.env.DATABASE_URL?.includes('/kadroradar_ingestion_test_'))throw Error('Isolated database required');
process.env.ALLOW_SELF_REGISTRATION='true';
process.env.NOTIFICATIONS_ENABLED='false';
process.env.NODE_ENV='production';
const {PrismaClient}=require('@prisma/client');
const {NestFactory}=require('@nestjs/core');
const {AppModule}=require('./dist/module');
(async()=>{
 const db=new PrismaClient();const app=await NestFactory.create(AppModule,{logger:false});app.setGlobalPrefix('api/v1');await app.listen(0,'127.0.0.1');const base=await app.getUrl()+'/api/v1';
 const suffix=randomBytes(8).toString('hex');const email=`candidate-${suffix}@example.test`,password=randomBytes(24).toString('hex');
 async function req(path,{method='GET',body,token,cookie,csrf,status=200}={}){const r=await fetch(base+path,{method,headers:{'content-type':'application/json','x-client-platform':'mobile',...(token?{authorization:'Bearer '+token}:{}),...(cookie?{cookie}:{}),...(csrf?{'x-csrf-token':csrf}:{})},body:body===undefined?undefined:JSON.stringify(body)});const value=await r.json();assert.equal(r.status,status,JSON.stringify(value));return {value,headers:r.headers};}
 try{
  await req('/account/profile',{status:401});
  await req('/account/register',{method:'POST',body:{email,password},status:201});
  const login=await req('/account/login',{method:'POST',body:{email,password},status:201});const token=login.value.token;
  assert.match(login.headers.get('set-cookie'),/HttpOnly/);assert.match(login.headers.get('set-cookie'),/Secure/);assert.match(login.headers.get('set-cookie'),/SameSite=Strict/);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  await req('/account/profile',{method:'PUT',cookie,body:{educationLevel:'LISANS'},status:403});
  await req('/account/profile',{method:'PUT',cookie,csrf:login.value.csrfToken,body:{educationLevel:'LISANS'},status:200});
  await req('/account/profile',{method:'PUT',token,body:{kpssScore:101},status:400});
  await req('/account/profile',{method:'PUT',token,body:{educationLevel:'LISANS',kpssScore:80,kpssScoreType:'P3',examYear:2024},status:200});
  await req('/admin/announcement-imports',{token,status:403});
  await req('/admin/announcement-imports',{token:'unsigned.payload',status:401});
  const announcement=await db.announcement.create({data:{title:'Synthetic candidate fixture',organization:'Fixture',sourceUrl:'https://enerji.gov.tr/test-fixture-only',status:'PUBLISHED',publishedAt:new Date(),sourceCheckedAt:new Date(),applicationStartAt:new Date(Date.now()-3600000),applicationEndAt:new Date(Date.now()+3600000)}});
  await req('/account/saved/'+announcement.id,{method:'PUT',token,body:{}});
  await req('/account/saved/'+announcement.id,{method:'PUT',token,body:{}});
  assert.equal((await req('/account/saved',{token})).value.length,1);
  const criteria={complete:true,educationLevels:['LISANS'],kpssRequired:true,kpssScoreType:'P3',kpssMinimumScore:70,examYears:[2024]};
  await req('/admin/announcements/'+announcement.id+'/positions',{method:'POST',token,body:{},status:403});
  // Test-only role grant; no production user or default admin created.
  await db.user.update({where:{email},data:{role:'REVIEWER'}});
  const position=(await req('/admin/announcements/'+announcement.id+'/positions',{method:'POST',token,body:{title:'Fixture position',requirements:criteria,sourceUrl:'https://enerji.gov.tr/test-fixture-only',evidence:'Synthetic fixture verification'},status:201})).value;
  const result=(await req('/account/matches/'+announcement.id,{token})).value;assert.equal(result.items[0].outcome,'ELIGIBLE');assert.equal(result.items[0].positionId,position.id);
  assert.ok((await req('/account/matches',{token})).value.items.some(item=>item.id===announcement.id));
  assert.equal((await req('/account/notifications/refresh',{method:'POST',token,body:{},status:201})).value.queued,0);
  await req('/account/profile',{method:'PUT',token,body:{notificationConsent:true}});
  assert.equal((await req('/account/notifications/refresh',{method:'POST',token,body:{},status:201})).value.queued,2);
  assert.equal((await req('/account/notifications/refresh',{method:'POST',token,body:{},status:201})).value.queued,0);
  assert.equal((await req('/account/notifications',{token})).value.length,2);
  const data=(await req('/account/data',{token})).value;assert.ok(data.account.email);assert.equal(data.account.passwordHash,undefined);
  await db.user.update({where:{email},data:{role:'SYSTEM_ADMIN'}});
  const sourceUrl='https://enerji.gov.tr/account-review-fixture-'+suffix;
  await req('/admin/announcement-imports',{method:'POST',token,body:{rows:[{title:'Synthetic session review',organization:'Fixture',sourceUrl}]},status:201});
  let importRow=(await req('/admin/announcement-imports',{token})).value.find(row=>row.sourceUrl===sourceUrl);
  await req('/admin/announcement-imports/'+importRow.id+'/review',{method:'POST',token,body:{version:importRow.version,action:'APPROVE',sourceVerified:true,evidence:'Synthetic session review fixture'},status:201});
  importRow=(await req('/admin/announcement-imports',{token})).value.find(row=>row.id===importRow.id);
  const publication=(await req('/admin/announcement-imports/'+importRow.id+'/review',{method:'POST',token,body:{version:importRow.version,action:'PUBLISH'},status:201})).value;
  const publicItem=(await req('/announcements/'+publication.announcementId)).value;assert.equal(publicItem.sourceUrl,sourceUrl);
  assert.ok(!(await req('/announcements')).value.items.some(item=>item.id===publication.announcementId)); // Missing dates never OPEN.
  await db.announcement.update({where:{id:announcement.id},data:{status:'WITHDRAWN'}});
  assert.equal((await req('/account/saved',{token})).value[0].announcement.status,'WITHDRAWN');
  await req('/account/matches/'+announcement.id,{token,status:400});
  await req('/account',{method:'DELETE',token});
  await req('/account/profile',{token,status:401});
  const stored=await db.user.findFirst({where:{email}});assert.equal(stored,null);
  console.log('PASS: account register/login, cookie flags, CSRF, profile validation, RBAC, position verification, explanations, idempotent saves, withdrawal propagation, account deletion/session revocation');
 }finally{await app.close();await db.$disconnect();}
})().catch(e=>{console.error(e);process.exitCode=1;});
