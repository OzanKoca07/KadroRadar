import {Injectable,OnModuleDestroy,OnModuleInit} from '@nestjs/common';
import {PrismaClient} from '@prisma/client';
import {notificationPlan} from './notification-plan';
import {createHash} from 'node:crypto';
@Injectable()
export class NotificationService implements OnModuleInit,OnModuleDestroy {
 private db=new PrismaClient();private timer?:NodeJS.Timeout;private running=false;
 onModuleInit(){if(process.env.NOTIFICATIONS_ENABLED==='true'){this.timer=setInterval(()=>{void this.tick().catch(()=>{console.error(JSON.stringify({event:'notification_tick_failed'}));});},15*60000);this.timer.unref();}}
 async onModuleDestroy(){if(this.timer)clearInterval(this.timer);await this.db.$disconnect();}
 async plan(userId:string){
  return this.db.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`notify:${userId}`}))`;
   const user=await tx.user.findUnique({where:{id:userId}});if(!user || user.deletedAt)return {queued:0};
   const profile=await tx.candidateProfile.findUnique({where:{userId}});if(!profile?.notificationConsent)return {queued:0};
   const now=new Date();
   const [announcements,saved]=await Promise.all([tx.announcement.findMany({where:{status:'PUBLISHED',publishedAt:{lte:now},applicationEndAt:{gte:now},OR:[{publishedAt:{gte:new Date(Date.now()-86400000)}},{applicationEndAt:{lte:new Date(Date.now()+3*86400000)}}]},include:{positions:true},take:200}),tx.savedAnnouncement.findMany({where:{userId},include:{announcement:true},take:100})]);
   let daily=await tx.candidateNotification.count({where:{userId,createdAt:{gte:new Date(Date.now()-86400000)}}});
   let weekly=await tx.candidateNotification.count({where:{userId,createdAt:{gte:new Date(Date.now()-7*86400000)}}});let queued=0;
   for(const event of notificationPlan(profile,announcements,saved,now)){
    if(daily>=2 || weekly>=7)break;
    const result=await tx.candidateNotification.createMany({data:[{userId,...event}],skipDuplicates:true});
    if(result.count && event.kind==='EXTENDED'){const record=saved.find(row=>row.announcementId===event.announcementId);if(record)await tx.savedAnnouncement.update({where:{userId_announcementId:{userId,announcementId:event.announcementId}},data:{lastKnownEndAt:record.announcement.applicationEndAt}});}
    queued+=result.count;daily+=result.count;weekly+=result.count;
   }
   return {queued};
  });
 }
 async tick(){
  if(this.running)return;this.running=true;
  try{
   const profiles:Awaited<ReturnType<typeof this.db.candidateProfile.findMany>>=[];
   let cursor:string|undefined;
   do{const batch=await this.db.candidateProfile.findMany({where:{notificationConsent:true,pushToken:{not:null},user:{deletedAt:null}},take:100,orderBy:{id:'asc'},...(cursor?{cursor:{id:cursor},skip:1}:{})});profiles.push(...batch);cursor=batch.length===100?batch[batch.length-1].id:undefined;}while(cursor);
   for(const p of profiles)await this.plan(p.userId);
   // Claim is committed before network send: uncertain results are never automatically retried.
   for(const p of profiles){
    const pending=await this.db.candidateNotification.findMany({where:{userId:p.userId,status:'PENDING'},take:2,orderBy:{createdAt:'asc'}});
    for(const event of pending){
     const current=await this.db.candidateProfile.findUnique({where:{userId:p.userId}});if(!current?.notificationConsent || !current.pushToken)continue;
     const announcement=await this.db.announcement.findUnique({where:{id:event.announcementId},include:{positions:true}});
     const saved=await this.db.savedAnnouncement.findMany({where:{userId:p.userId,announcementId:event.announcementId},include:{announcement:true}});
     const stillRelevant=announcement && notificationPlan(current,[announcement],saved).some(e=>e.eventKey===event.eventKey);
     if(!stillRelevant){await this.db.candidateNotification.updateMany({where:{id:event.id,status:'PENDING'},data:{status:'SUPPRESSED'}});continue;}
     const claimed=await this.db.candidateNotification.updateMany({where:{id:event.id,status:'PENDING'},data:{status:'SENDING',deviceTokenHash:createHash('sha256').update(current.pushToken).digest('hex')}});if(!claimed.count)continue;
     try{
      const response=await fetch('https://exp.host/--/api/v2/push/send',{method:'POST',headers:{'content-type':'application/json',...(process.env.EXPO_PUSH_ACCESS_TOKEN?{authorization:`Bearer ${process.env.EXPO_PUSH_ACCESS_TOKEN}`}:{})},body:JSON.stringify({to:current.pushToken,title:'KadroRadar',body:event.title,data:{announcementId:event.announcementId},sound:'default'}),signal:AbortSignal.timeout(15000)});
      const result:any=await response.json();const ticket=result.data;
      await this.db.candidateNotification.update({where:{id:event.id},data:{status:response.ok && ticket?.status==='ok'?'ACCEPTED':'FAILED',ticketId:ticket?.id??null}});
      if(ticket?.details?.error==='DeviceNotRegistered')await this.db.candidateProfile.updateMany({where:{userId:p.userId,pushToken:current.pushToken},data:{pushToken:null}});
     }catch{await this.db.candidateNotification.update({where:{id:event.id},data:{status:'UNKNOWN'}});}
    }
   }
   const tickets=await this.db.candidateNotification.findMany({where:{status:'ACCEPTED',ticketId:{not:null},updatedAt:{lte:new Date(Date.now()-15*60000)}},take:100});
   if(tickets.length){
    const response=await fetch('https://exp.host/--/api/v2/push/getReceipts',{method:'POST',headers:{'content-type':'application/json',...(process.env.EXPO_PUSH_ACCESS_TOKEN?{authorization:`Bearer ${process.env.EXPO_PUSH_ACCESS_TOKEN}`}:{})},body:JSON.stringify({ids:tickets.map(t=>t.ticketId)}),signal:AbortSignal.timeout(15000)});
    if(response.ok){const result:any=await response.json();for(const ticket of tickets){const receipt=result.data?.[ticket.ticketId!];if(!receipt)continue;await this.db.candidateNotification.update({where:{id:ticket.id},data:{status:receipt.status==='ok'?'PROVIDER_ACCEPTED':'FAILED'}});if(receipt.details?.error==='DeviceNotRegistered'){const profile=await this.db.candidateProfile.findUnique({where:{userId:ticket.userId}});if(profile?.pushToken && createHash('sha256').update(profile.pushToken).digest('hex')===ticket.deviceTokenHash)await this.db.candidateProfile.updateMany({where:{userId:ticket.userId,pushToken:profile.pushToken},data:{pushToken:null}});}}}
   }
  }finally{this.running=false;}
 }
}
