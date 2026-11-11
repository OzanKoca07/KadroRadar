import {applicationDates} from './application-dates';
import {Prisma} from '@prisma/client';
import {careerDetailUrl} from './career-publication';
const normalized=(v:any)=>typeof v==='string'?v.normalize('NFKC').toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]+/gu,' ').trim():'';
const samePeriod=(a:any,b:any)=>{const x=applicationDates(a),y=applicationDates(b);return x.mode===y.mode&&(x.mode==='INSTANT'?x.start.instant===y.start.instant&&x.end.instant===y.end.instant:x.mode==='CALENDAR'&&x.start.date===y.start.date&&x.end.date===y.end.date);};
const equalDate=(a:any,b:any)=>a&&b&&Number.isFinite(Date.parse(a))&&+new Date(a)===+new Date(b);
export async function invalidatePublication(tx:Prisma.TransactionClient,row:any){
 const reference=await tx.announcementSourceReference.findUnique({where:{importRowId:row.id}});
 const ids=[row.announcementId,reference?.announcementId].filter(Boolean) as string[];
 if(ids.length){await tx.announcement.updateMany({where:{id:{in:ids}},data:{sourceCheckedAt:null}});await tx.announcementPosition.updateMany({where:{announcementId:{in:ids}},data:{verifiedAt:null}});}
}
export async function reconcilePublication(tx:Prisma.TransactionClient,candidate:any,sourceId:string){
 const links=[candidate.sourceUrl,...(Array.isArray(candidate.sourceEvidence?.relatedCareerDetailUrls)?candidate.sourceEvidence.relatedCareerDetailUrls:[])].filter(careerDetailUrl);
 if(links.length>1)return {decision:'POSSIBLE' as const};
 const exact=links.length?await tx.announcement.findMany({where:{sourceCheckedAt:{not:null},status:{in:['PUBLISHED','ARCHIVED']},OR:[{sourceUrl:{in:links}},{sourceEvidence:{path:['relatedCareerDetailUrls'],array_contains:links}}]},take:3}):[];
 const other=exact.filter(a=>(a.sourceEvidence as any)?.sourceId!==sourceId);
 if(other.length){
  const same=other.filter(a=>normalized(a.organization)===normalized(candidate.organization)&&samePeriod(a,candidate)&&(a.quota===null||candidate.quota==null||a.quota===candidate.quota)&&(!a.positionTitle||!candidate.positionTitle||normalized(a.positionTitle)===normalized(candidate.positionTitle)));
  if(same.length===1&&other.length===1)return {decision:'EXACT' as const,announcementId:same[0].id};
  for(const row of other){await tx.announcement.update({where:{id:row.id},data:{sourceCheckedAt:null}});await tx.announcementPosition.updateMany({where:{announcementId:row.id},data:{verifiedAt:null}});}
  return {decision:'CONFLICT' as const};
 }
 // Matching names are never sufficient identity proof; queue possible duplicates.
 if(candidate.organization&&candidate.applicationStartAt&&candidate.applicationEndAt){
  const possible=await tx.announcement.findFirst({where:{organization:{equals:candidate.organization,mode:'insensitive'},applicationStartAt:new Date(candidate.applicationStartAt),applicationEndAt:new Date(candidate.applicationEndAt),sourceCheckedAt:{not:null},status:{in:['PUBLISHED','ARCHIVED']},NOT:{sourceEvidence:{path:['sourceId'],equals:sourceId}}}});
  if(possible)return {decision:'POSSIBLE' as const};
 }
 return {decision:'NEW' as const};
}
export async function linkPublication(tx:Prisma.TransactionClient,rowId:string,announcementId:string,evidence:any,actor:string){
 await tx.announcementSourceReference.upsert({where:{importRowId:rowId},create:{importRowId:rowId,announcementId,evidence},update:{announcementId,evidence}});
 await tx.announcementImportRow.update({where:{id:rowId},data:{status:'LINKED'}});
 await tx.announcementReviewAudit.create({data:{rowId,actor,action:'AUTO_EXACT_SOURCE_LINK',snapshot:{announcementId,evidence}}});
}
