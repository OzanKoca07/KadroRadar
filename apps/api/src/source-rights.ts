import {BadRequestException,ConflictException} from '@nestjs/common';
import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
export type RightsStatus='LICENSE_VERIFIED'|'REVIEW_REQUIRED'|'RESTRICTED';
export function hardRestricted(source:any){return source?.id==='ilan'||source?.rightsAssessment?.status==='RESTRICTED'||source?.hosts?.some((host:string)=>/(^|\.)ilan\.gov\.tr$/i.test(host));}
function proofValid(assessment:any,now=new Date(),source?:any){
 const e=assessment?.evidence;
 if(assessment?.status!=='LICENSE_VERIFIED'||!e||!['LICENSE','WRITTEN_AUTHORIZATION'].includes(e.kind)||!/^[a-f0-9]{64}$/.test(e.sha256||'')||source&&(typeof source.feed!=='string'||e.scopeUrl!==source.feed))return false;
 try{const u=new URL(e.url);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)return false;}catch{return false;}
 return Array.isArray(e.scopes)&&e.scopes.length<=10&&['AUTOMATED_FEED_ACCESS','MOBILE_METADATA','COMMERCIAL_USE'].every(scope=>e.scopes.includes(scope))&&typeof e.attribution==='string'&&e.attribution.trim().length>0&&e.attribution.length<=1000&&e.url.length<=2048&&Number.isFinite(Date.parse(e.verifiedAt))&&new Date(e.verifiedAt)<=now&&Number.isFinite(Date.parse(e.validUntil))&&new Date(e.validUntil)>now;
}
export function sourceRights(source:any,override?:any,now=new Date()):RightsStatus{
 if(hardRestricted(source)||override?.status==='RESTRICTED')return 'RESTRICTED';
 // A runtime review may revoke permissions, but cannot elevate an unverified registry entry.
 if(!proofValid(source?.rightsAssessment,now,source)||override&&!proofValid(override,now,source))return 'REVIEW_REQUIRED';
 return 'LICENSE_VERIFIED';
}
export class SourceRightsStore{
 constructor(private db:PrismaClient){}
 async current(id:string){const row=await this.db.sourceSyncState.findUnique({where:{id:'policy:'+id}});return (row?.metrics as any)?.assessment??null;}
 async status(source:any,now=new Date()){return sourceRights(source,await this.current(source.id),now);}
 async review(source:any,body:any,actor:string){
  if(!['LICENSE_VERIFIED','REVIEW_REQUIRED','RESTRICTED'].includes(body?.status)||typeof body.reason!=='string'||body.reason.trim().length<20||body.reason.length>2000||body.expectedRevision!==null&&typeof body.expectedRevision!=='string')throw new BadRequestException('Policy status, reason and expectedRevision required');
  if(body.status==='LICENSE_VERIFIED'&&(hardRestricted(source)||!proofValid({status:body.status,evidence:body.evidence},new Date(),source)))throw new BadRequestException('Explicit bounded license proof required; restricted sources cannot be elevated');
  return this.db.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`source-policy:${source.id}`}))`;
   const id='policy:'+source.id,row=await tx.sourceSyncState.findUnique({where:{id}}),previous=(row?.metrics as any)?.assessment??null;
   if((previous?.revision??null)!==body.expectedRevision)throw new ConflictException('Refresh policy review');
   const evidence=body.status==='LICENSE_VERIFIED'?Object.fromEntries(['kind','url','sha256','scopeUrl','scopes','attribution','verifiedAt','validUntil'].map(key=>[key,body.evidence[key]])):null;
   const assessment={status:body.status,reason:body.reason.trim(),evidence,revision:randomUUID(),reviewedAt:new Date().toISOString()};
   const audit=await tx.reviewAudit.create({data:{batchId:id,actor,action:JSON.stringify({event:'SOURCE_POLICY_REVIEW',previousRevision:previous?.revision??null,assessment}),count:1}});
   await tx.sourceSyncState.upsert({where:{id},create:{id,status:'POLICY_'+assessment.status,metrics:{assessment,auditId:audit.id}},update:{status:'POLICY_'+assessment.status,metrics:{assessment,auditId:audit.id}}});
   return {assessment,effectiveStatus:sourceRights(source,assessment),automationActivated:false};
  });
 }
 async history(id:string){return this.db.reviewAudit.findMany({where:{batchId:'policy:'+id},orderBy:[{createdAt:'desc'},{id:'desc'}],take:100});}
}
