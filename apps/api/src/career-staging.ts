import {BadRequestException,ConflictException} from '@nestjs/common';
import {Prisma,PrismaClient} from '@prisma/client';

export const careerRowId=(guidHash:string)=>'career-rss-'+guidHash;
export function careerEvidence(raw:any){return {kind:'CAREER_RSS_METADATA',sourceId:'career',categoryCode:raw.categoryCode,category:raw.category,guidHash:raw.guidHash,documentSha256:raw.rawSourceReference?.documentSha256};}
export async function stageCareerSnapshot(db:PrismaClient,report:any,actor:string){
 if(report?.sourceId!=='career'||!Array.isArray(report.rows)||report.rows.length>1000||!/^[a-f0-9]{64}$/.test(report.documentSha256||'')||report.unresolved?.length)throw new BadRequestException('Complete career metadata report required');
 const rows=report.rows;
 for(const row of rows){
  let valid=false;try{const u=new URL(row.sourceUrl);valid=u.protocol==='https:'&&u.hostname==='kariyerkapisi.gov.tr'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&!u.hash&&!['/','/rss'].includes(u.pathname.toLowerCase().replace(/\/$/,''));}catch{}
  if(!valid||row.sourceId!=='career'||!/^[a-f0-9]{64}$/.test(row.guidHash||'')||!/^[a-f0-9]{64}$/.test(row.contentHash||'')||row.rawSourceReference?.documentSha256!==report.documentSha256||typeof row.title!=='string'||!row.title.trim()||row.title.length>1000||!Array.isArray(row.issues))throw new BadRequestException('Invalid career candidate');
 }
 if(new Set(rows.map((r:any)=>r.guidHash)).size!==rows.length)throw new BadRequestException('Duplicate GUID');
 const missing=report.missingGuids??[];if(!Array.isArray(missing)||missing.length>1000||missing.some((h:any)=>typeof h!=='string'||!/^[a-f0-9]{64}$/.test(h)))throw new BadRequestException('Invalid disappearance hints');
 return db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('career-stage'))`;
  let created=0,changed=0,duplicate=0,missingReview=0,queued=0;
  for(const raw of rows){
   const id=careerRowId(raw.guidHash),old=await tx.announcementImportRow.findUnique({where:{id}});
   // Non-personnel metadata stays in the document queue; a category change invalidates an old publication.
   if(raw.categoryCode!=='PERSONNEL'&&!old){queued++;continue;}
   if(old&&old.contentHash===raw.contentHash&&!(Array.isArray(old.issues)&&old.issues.includes('FEED_ITEM_DISAPPEARED_REVIEW'))){duplicate++;continue;}
   const conflict=await tx.announcementImportRow.findUnique({where:{sourceUrl:raw.sourceUrl}});
   if(conflict&&conflict.id!==id)throw new ConflictException('Official URL already belongs to another identity; editor reconciliation required');
   if(old?.announcementId){await tx.announcement.update({where:{id:old.announcementId},data:{sourceCheckedAt:null}});await tx.announcementPosition.updateMany({where:{announcementId:old.announcementId},data:{verifiedAt:null}});}
   const parsed={title:raw.title,organization:null,sourceUrl:raw.sourceUrl,announcedAt:raw.announcedAt,applicationStartAt:null,applicationEndAt:null,applicationUrl:null,sourceEvidence:careerEvidence(raw)};
   const data={raw,parsed,contentHash:raw.contentHash,status:'PENDING_REVIEW',sourceUrl:raw.sourceUrl,issues:[...raw.issues,...(raw.categoryCode!=='PERSONNEL'?['NON_PERSONNEL_CATEGORY_REVIEW']:[])]};
   await tx.announcementImportRow.upsert({where:{id},create:{id,...data},update:{...data,version:{increment:1}}});
   await tx.announcementReviewAudit.create({data:{rowId:id,actor,action:old?'SOURCE_CHANGED':'CAREER_RSS_IMPORTED',snapshot:{guidHash:raw.guidHash,documentSha256:report.documentSha256,eventType:raw.eventType,autoPublished:false}}});
   old?changed++:created++;
  }
  for(const hash of missing){
   const row=await tx.announcementImportRow.findUnique({where:{id:careerRowId(hash)}});if(!row)continue;
   const issues=Array.isArray(row.issues)?row.issues:[];if(issues.includes('FEED_ITEM_DISAPPEARED_REVIEW'))continue;
   if(row.announcementId){await tx.announcement.update({where:{id:row.announcementId},data:{sourceCheckedAt:null}});await tx.announcementPosition.updateMany({where:{announcementId:row.announcementId},data:{verifiedAt:null}});}
   await tx.announcementImportRow.update({where:{id:row.id},data:{status:'PENDING_REVIEW',issues:[...issues,'FEED_ITEM_DISAPPEARED_REVIEW'],version:{increment:1}}});
   await tx.announcementReviewAudit.create({data:{rowId:row.id,actor,action:'FEED_ITEM_DISAPPEARED_REVIEW',snapshot:{guidHash:hash,autoCancelled:false}}});missingReview++;
  }
  return {created,changed,duplicate,missingReview,queued};
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:20000});
}
