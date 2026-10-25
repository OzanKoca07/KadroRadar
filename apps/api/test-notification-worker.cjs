const assert=require('node:assert/strict');const {randomBytes}=require('node:crypto');
if(!process.env.DATABASE_URL?.includes('/kadroradar_ingestion_test_'))throw Error('Isolated DB required');
const {PrismaClient}=require('@prisma/client');const {NotificationService}=require('./dist/notifications');
(async()=>{
 const db=new PrismaClient(),service=new NotificationService();const original=global.fetch;const suffix=randomBytes(8).toString('hex');let user,announcement;
 try{
  user=await db.user.create({data:{email:`push-${suffix}@example.test`,passwordHash:'not-a-login',profile:{create:{notificationConsent:true,pushToken:'ExpoPushToken[synthetic_fixture_only]'}}}});
  announcement=await db.announcement.create({data:{title:'Synthetic push fixture',organization:'Fixture',sourceUrl:'https://enerji.gov.tr/fixture',status:'PUBLISHED',publishedAt:new Date(),sourceCheckedAt:new Date(),applicationStartAt:new Date(Date.now()-1000),applicationEndAt:new Date(Date.now()+3600000),positions:{create:{title:'Fixture',requirements:{complete:true,kpssRequired:false},verifiedAt:new Date(),sourceUrl:'https://enerji.gov.tr/fixture'}}}});
  let sends=0;global.fetch=async()=>{sends++;return {ok:true,json:async()=>({data:{status:'ok',id:'synthetic-ticket-'+sends}})}};
  await service.tick();assert.equal(sends,2);await service.tick();assert.equal(sends,2);
  assert.equal(await db.candidateNotification.count({where:{userId:user.id,status:'ACCEPTED'}}),2);
  const event=await db.candidateNotification.findFirst({where:{userId:user.id}});
  await db.candidateNotification.update({where:{id:event.id},data:{updatedAt:new Date(Date.now()-16*60000)}});
  global.fetch=async(url)=>{assert.ok(String(url).endsWith('getReceipts'));return {ok:true,json:async()=>({data:{[event.ticketId]:{status:'error',details:{error:'DeviceNotRegistered'}}}})}};
  await service.tick();assert.equal((await db.candidateProfile.findUnique({where:{userId:user.id}})).pushToken,null);
  await db.candidateProfile.update({where:{userId:user.id},data:{pushToken:'ExpoPushToken[rotated_synthetic_fixture]'}});
  const oldTicket=await db.candidateNotification.findFirst({where:{userId:user.id,status:'ACCEPTED'}});
  await db.candidateNotification.update({where:{id:oldTicket.id},data:{updatedAt:new Date(Date.now()-16*60000)}});
  global.fetch=async()=>({ok:true,json:async()=>({data:{[oldTicket.ticketId]:{status:'error',details:{error:'DeviceNotRegistered'}}}})});
  await service.tick();assert.equal((await db.candidateProfile.findUnique({where:{userId:user.id}})).pushToken,'ExpoPushToken[rotated_synthetic_fixture]');
  console.log('PASS: mocked Expo send, durable dedup, daily cap, receipt failure, invalid device revocation; no real push sent');
 }finally{
  global.fetch=original;
  if(user){await db.candidateNotification.deleteMany({where:{userId:user.id}});await db.candidateProfile.deleteMany({where:{userId:user.id}});await db.user.delete({where:{id:user.id}});}
  if(announcement)await db.announcement.delete({where:{id:announcement.id}});
  await service.onModuleDestroy();await db.$disconnect();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
