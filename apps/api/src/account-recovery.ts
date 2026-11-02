import {BadRequestException,ForbiddenException,ServiceUnavailableException} from '@nestjs/common';
import {PrismaClient} from '@prisma/client';
import {createHash,createHmac,randomBytes} from 'node:crypto';
import {AccountMail,ResendAccountMail,recoveryConfiguration} from './account-mail';
import {passwordHash} from './password';
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
type Purpose='VERIFY_EMAIL'|'RESET_PASSWORD';
const accepted={accepted:true,message:'Adres uygunsa işlem bağlantısı gönderilecektir.'};
export class AccountRecovery {
 private pending=0;
 constructor(private db:PrismaClient,private mail:AccountMail=new ResendAccountMail()){}
 available(){return !!recoveryConfiguration();}
 private config(){const c=recoveryConfiguration();if(!c)throw new ServiceUnavailableException({code:'RECOVERY_UNAVAILABLE'});return c;}
 origin(req:any){const origin=req.headers.origin;if(origin&&!(process.env.CORS_ORIGINS||'http://localhost:5173').split(',').map(x=>x.trim()).includes(origin))throw new ForbiddenException({code:'AUTH_ORIGIN_REJECTED'});}
 private async rate(ip:string,email:string,purpose:string){
  const c=this.config(),key=(s:string)=>createHmac('sha256',c.rateKey).update(s).digest('hex');
  const limits:[string,number,number][]=purpose.endsWith('_CONFIRM')?[[key('ip:'+ip+':'+purpose),20,900000]]:[[key('ip:'+ip+':'+purpose),5,900000],[key('email:'+email+':'+purpose),3,3600000],[key('cooldown:'+email+':'+purpose),1,60000],[key('global'),50,86400000]];
  return this.db.$transaction(async tx=>{
   const now=new Date();await tx.accountRecoveryRate.deleteMany({where:{until:{lt:now}}});
   let allowed=true;
   for(const [id,max,ttl] of limits.sort((a,b)=>a[0].localeCompare(b[0]))){
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
    const row=await tx.accountRecoveryRate.upsert({where:{id},create:{id,count:1,until:new Date(Date.now()+ttl)},update:{count:{increment:1}}});if(row.count>max)allowed=false;
   }return allowed;
  });
 }
 async status(user:{id:string;email:string}){const value=await this.db.accountEmailVerification.findUnique({where:{userId:user.id}});return {emailVerified:!!value&&value.emailHash===digest(user.email),recoveryAvailable:this.available()};}
 async request(purpose:Purpose,email:unknown,ip:string){
  this.config();const start=Date.now();
  const normalized=typeof email==='string'&&email.length<=254?email.trim().toLowerCase():'';
  // Same DB/rate/response path for absent, deleted, privileged and active users.
  const allowed=await this.rate(ip,normalized,purpose);
  if(allowed&&this.pending<8){this.pending++;setImmediate(()=>void this.deliver(purpose,normalized).catch(()=>{}).finally(()=>this.pending--));}
  await new Promise(r=>setTimeout(r,Math.max(0,300-(Date.now()-start))));return accepted;
 }
 private async deliver(purpose:Purpose,email:string){
  let challengeId:string|undefined;
  try{
   const config=this.config(),token=randomBytes(32).toString('hex');
   const challenge=await this.db.$transaction(async tx=>{
    await tx.accountChallenge.deleteMany({where:{expiresAt:{lt:new Date(Date.now()-7*86400000)}}});
    await tx.accountRecoveryAudit.deleteMany({where:{createdAt:{lt:new Date(Date.now()-30*86400000)}}});
    const user=await tx.user.findUnique({where:{email}});if(!user)return null;
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${user.id} FOR UPDATE`;
    const fresh=await tx.user.findUniqueOrThrow({where:{id:user.id}});if(fresh.deletedAt||fresh.role!=='USER'||fresh.email!==email)return null;
    const now=new Date();await tx.accountChallenge.updateMany({where:{userId:user.id,purpose,consumedAt:null},data:{consumedAt:now}});
    const row=await tx.accountChallenge.create({data:{userId:user.id,purpose,tokenHash:digest(token),emailHash:digest(email),createdAt:now,expiresAt:new Date(now.getTime()+(purpose==='RESET_PASSWORD'?900000:86400000))}});
    await tx.accountRecoveryAudit.create({data:{userId:user.id,action:purpose+'_REQUESTED'}});return row;
   });
   if(!challenge)return;challengeId=challenge.id;
   const link=config.origin+'/account-recovery#'+new URLSearchParams({purpose,token});
   await this.mail.send(email,link,purpose,challenge.id);
   await this.db.accountRecoveryAudit.create({data:{action:'MAIL_PROVIDER_ACCEPTED'}});
  }catch{
   if(challengeId)await this.db.$transaction(async tx=>{await tx.accountChallenge.updateMany({where:{id:challengeId,consumedAt:null},data:{consumedAt:new Date()}});await tx.accountRecoveryAudit.create({data:{action:'MAIL_DELIVERY_FAILED'}});}).catch(()=>{});
  }
 }
 async confirm(purpose:Purpose,token:unknown,password:unknown,ip:string){
  this.config();if(!await this.rate(ip,'confirm',purpose+'_CONFIRM'))throw new ForbiddenException({code:'AUTH_RATE_LIMITED'});
  const invalid=()=>new BadRequestException({code:'RECOVERY_LINK_INVALID'});
  if(typeof token!=='string'||! /^[a-f0-9]{64}$/.test(token))throw invalid();
  if(purpose==='RESET_PASSWORD'&&(typeof password!=='string'||password.length<12||password.length>128))throw new BadRequestException({code:'PASSWORD_INVALID'});
  // Validate before expensive scrypt, but recheck under the user row lock below.
  const candidate=await this.db.accountChallenge.findUnique({where:{tokenHash:digest(token)}});
  if(!candidate||candidate.purpose!==purpose||candidate.consumedAt||candidate.expiresAt<=new Date())throw invalid();
  const stored=purpose==='RESET_PASSWORD'?await passwordHash(password as string):null;
  await this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${candidate.userId} FOR UPDATE`;
   const user=await tx.user.findUnique({where:{id:candidate.userId}});
   if(!user||user.deletedAt||user.role!=='USER'||digest(user.email)!==candidate.emailHash)throw invalid();
   const consumed=await tx.accountChallenge.updateMany({where:{id:candidate.id,purpose,consumedAt:null,expiresAt:{gt:new Date()}},data:{consumedAt:new Date()}});if(consumed.count!==1)throw invalid();
   if(stored){await tx.user.update({where:{id:user.id},data:{passwordHash:stored}});await tx.candidateSession.deleteMany({where:{userId:user.id}});await tx.candidateProfile.updateMany({where:{userId:user.id},data:{pushToken:null,notificationConsent:false}});await tx.accountChallenge.updateMany({where:{userId:user.id,consumedAt:null},data:{consumedAt:new Date()}});}
   else await tx.accountEmailVerification.upsert({where:{userId:user.id},create:{userId:user.id,emailHash:candidate.emailHash},update:{emailHash:candidate.emailHash,verifiedAt:new Date()}});
   await tx.accountRecoveryAudit.create({data:{userId:user.id,action:purpose+'_CONFIRMED'}});
  });return {completed:true};
 }
}
