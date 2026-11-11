import {BadRequestException,ConflictException} from '@nestjs/common';
import {Prisma,PrismaClient} from '@prisma/client';
import {resolve} from 'node:path';
import {applicationDates,temporalStatus} from './application-dates';
import {SourceRightsStore} from './source-rights';
import {reconcilePublication,linkPublication,invalidatePublication} from './publication-reconciliation';
import {careerPublicationDecision,policyFingerprint} from './career-publication';
const registry=require(resolve(__dirname,'../../../packages/official-sources.json'));

export const careerRowId=(guidHash:string)=>'career-rss-'+guidHash;
export function careerEvidence(raw:any){return {kind:'CAREER_RSS_METADATA',sourceId:'career',categoryCode:raw.categoryCode,category:raw.category,guidHash:raw.guidHash,documentSha256:raw.rawSourceReference?.documentSha256,applicationDates:applicationDates(raw)};}
export async function stageCareerSnapshot(db:PrismaClient,report:any,actor:string,options:{automatic?:boolean;transaction?:Prisma.TransactionClient}={}){
 if(report?.sourceId!=='career'||!Array.isArray(report.rows)||report.rows.length>1000||!/^[a-f0-9]{64}$/.test(report.documentSha256||'')||report.unresolved?.length)throw new BadRequestException('Complete career metadata report required');
 const rows=report.rows;
 for(const row of rows){
  let valid=false;try{const u=new URL(row.sourceUrl);valid=u.protocol==='https:'&&u.hostname==='kariyerkapisi.gov.tr'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&!u.hash&&!['/','/rss'].includes(u.pathname.toLowerCase().replace(/\/$/,''));}catch{}
  if(!valid||row.sourceId!=='career'||!/^[a-f0-9]{64}$/.test(row.guidHash||'')||!/^[a-f0-9]{64}$/.test(row.contentHash||'')||row.rawSourceReference?.documentSha256!==report.documentSha256||typeof row.title!=='string'||!row.title.trim()||row.title.length>1000||!Array.isArray(row.issues))throw new BadRequestException('Invalid career candidate');
 }
 if(new Set(rows.map((r:any)=>r.guidHash)).size!==rows.length)throw new BadRequestException('Duplicate GUID');
 const missing=report.missingGuids??[];if(!Array.isArray(missing)||missing.length>1000||missing.some((h:any)=>typeof h!=='string'||!/^[a-f0-9]{64}$/.test(h)))throw new BadRequestException('Invalid disappearance hints');
 const work=async (tx:Prisma.TransactionClient)=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('career-stage'))`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtext('source-policy:career'))`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('automatic-publication'))`;
  const policy=await new SourceRightsStore(tx as any).current('career');
  let created=0,changed=0,duplicate=0,missingReview=0,queued=0,autoPublished=0,manualReview=0,rejected=0,linked=0;
  const now=new Date();
  for(const raw of rows){
   const processing=careerPublicationDecision(raw,registry.career,policy,now,options.automatic===true);
   const metadataProcessing=careerPublicationDecision(raw,registry.career,policy,now,options.automatic===true,true);
   const id=careerRowId(raw.guidHash),old=await tx.announcementImportRow.findUnique({where:{id}});
   if(old&&(Array.isArray(old.issues)&&old.issues.includes('FEED_ITEM_DISAPPEARED_REVIEW')||old.status==='PENDING_REVIEW'&&(old.raw as any)?.processing?.reasons?.includes('DISAPPEARANCE_REVIEW'))){processing.decision='MANUAL_REVIEW';processing.reasons.push('DISAPPEARANCE_REVIEW');}
   if(processing.reasons.includes('DISAPPEARANCE_REVIEW')){metadataProcessing.decision='MANUAL_REVIEW';metadataProcessing.reasons.push('DISAPPEARANCE_REVIEW');}
   if(old?.announcementId&&(old.parsed as any)?.sourceEvidence?.publicationMode!=='AUTO_VALIDATED'){processing.decision='MANUAL_REVIEW';processing.reasons.push('MANUAL_PUBLICATION_CHANGE_REVIEW');}
   if(old?.status==='LINKED'&&old.contentHash!==raw.contentHash){processing.decision='MANUAL_REVIEW';processing.reasons.push('LINKED_SOURCE_CHANGE_REVIEW');metadataProcessing.decision='MANUAL_REVIEW';metadataProcessing.reasons.push('LINKED_SOURCE_CHANGE_REVIEW');}
   // Non-personnel metadata stays in the document queue; a category change invalidates an old publication.
   if(raw.categoryCode!=='PERSONNEL'&&!old){queued++;continue;}
   if(old&&(!options.automatic||((old.raw as any)?.metadataPublication?.decision===metadataProcessing.decision&&(old.raw as any)?.metadataPublication?.policyFingerprint===policyFingerprint(registry.career,policy)))&&old.contentHash===raw.contentHash&&((old.raw as any)?.processing?.decision===processing.decision||!options.automatic)&&!(Array.isArray(old.issues)&&old.issues.includes('FEED_ITEM_DISAPPEARED_REVIEW'))){
    if((old.parsed as any)?.sourceEvidence?.publicationMode==='AUTO_VALIDATED'&&old.announcementId&&old.status==='PUBLISHED'&&['CLOSED','PAST_CALENDAR_DATE'].includes(temporalStatus(old.parsed,now))){await tx.announcement.update({where:{id:old.announcementId},data:{status:'ARCHIVED'}});await tx.announcementImportRow.update({where:{id},data:{status:'ARCHIVED',version:{increment:1}}});await tx.announcementReviewAudit.create({data:{rowId:id,actor,action:'AUTO_ARCHIVE',snapshot:{reason:'VERIFIED_DEADLINE_EXPIRED'}}});}
    duplicate++;continue;}
   const conflict=await tx.announcementImportRow.findUnique({where:{sourceUrl:raw.sourceUrl}});
   if(conflict&&conflict.id!==id)throw new ConflictException('Official URL already belongs to another identity; editor reconciliation required');
   if(old)await invalidatePublication(tx,old);
   let match:any={decision:'NEW'};
   if(processing.decision==='AUTO_PUBLISH_ELIGIBLE'&&!old?.announcementId){match=await reconcilePublication(tx,{...raw,sourceEvidence:careerEvidence(raw)},'career');if(['CONFLICT','POSSIBLE'].includes(match.decision)){processing.decision='MANUAL_REVIEW';processing.reasons.push('CROSS_SOURCE_'+match.decision);metadataProcessing.decision='MANUAL_REVIEW';metadataProcessing.reasons.push('CROSS_SOURCE_'+match.decision);}}
   const eligible=processing.decision==='AUTO_PUBLISH_ELIGIBLE'&&raw.categoryCode==='PERSONNEL';
   const parsed:any={title:raw.title,organization:null,sourceUrl:raw.sourceUrl,announcedAt:raw.announcedAt,applicationStartAt:null,applicationEndAt:null,applicationUrl:null,sourceEvidence:careerEvidence(raw)};
   let announcementId=old?.announcementId;
   if(eligible&&match.decision!=='EXACT'){
    Object.assign(parsed,{...(raw.quotaVerification==='VERIFIED'&&Number.isInteger(raw.quota)&&raw.quota>0&&raw.quota<=100000?{quota:raw.quota}:{}),organization:raw.organization,applicationStartAt:raw.applicationStartAt,applicationEndAt:raw.applicationEndAt,applicationUrl:raw.sourceUrl,sourceEvidence:{...careerEvidence(raw),publicationMode:'AUTO_VALIDATED',policyFingerprint:policyFingerprint(registry.career,policy)}});
    const data={...parsed,status:['CLOSED','PAST_CALENDAR_DATE'].includes(temporalStatus(raw,now))?'ARCHIVED':'PUBLISHED',sourceCheckedAt:now,publishedAt:now};
    const item=announcementId?await tx.announcement.update({where:{id:announcementId},data}):await tx.announcement.create({data:{id:'career-auto-'+raw.guidHash,...data}});announcementId=item.id;autoPublished++;
   }else if(raw.categoryCode==='PERSONNEL'){processing.decision==='REJECTED'?rejected++:manualReview++;}
   const data={raw:{...raw,processing,metadataPublication:{...metadataProcessing,mode:'METADATA_ONLY',checkedAt:now.toISOString(),contentHash:raw.contentHash,policyFingerprint:policyFingerprint(registry.career,policy)}},parsed,contentHash:raw.contentHash,status:eligible?(['CLOSED','PAST_CALENDAR_DATE'].includes(temporalStatus(raw,now))?'ARCHIVED':'PUBLISHED'):options.automatic&&processing.decision==='REJECTED'?'REJECTED':'PENDING_REVIEW',...(announcementId?{announcementId}:{}),sourceUrl:raw.sourceUrl,issues:[...raw.issues,...(processing.reasons.includes('DISAPPEARANCE_REVIEW')?['FEED_ITEM_DISAPPEARED_REVIEW']:[]),...(raw.categoryCode!=='PERSONNEL'?['NON_PERSONNEL_CATEGORY_REVIEW']:[])]};
   await tx.announcementImportRow.upsert({where:{id},create:{id,...data},update:{...data,version:{increment:1}}});
   if(match.decision==='EXACT'){await linkPublication(tx,id,match.announcementId,{...careerEvidence(raw),sourceUrl:raw.sourceUrl},actor);linked++;}
   await tx.announcementReviewAudit.create({data:{rowId:id,actor,action:eligible?'AUTO_PUBLISH':old?'SOURCE_CHANGED':'CAREER_RSS_IMPORTED',snapshot:{guidHash:raw.guidHash,documentSha256:report.documentSha256,eventType:raw.eventType,processing,metadataPublication:metadataProcessing,autoPublished:eligible,policyFingerprint:policyFingerprint(registry.career,policy)}}});
   old?changed++:created++;
  }
  for(const hash of missing){
   const row=await tx.announcementImportRow.findUnique({where:{id:careerRowId(hash)}});if(!row)continue;
   const issues=Array.isArray(row.issues)?row.issues:[];if(issues.includes('FEED_ITEM_DISAPPEARED_REVIEW'))continue;
   await invalidatePublication(tx,row);
   await tx.announcementImportRow.update({where:{id:row.id},data:{status:'PENDING_REVIEW',issues:[...issues,'FEED_ITEM_DISAPPEARED_REVIEW'],version:{increment:1}}});
   await tx.announcementReviewAudit.create({data:{rowId:row.id,actor,action:'FEED_ITEM_DISAPPEARED_REVIEW',snapshot:{guidHash:hash,autoCancelled:false}}});missingReview++;
  }
  return {created,changed,duplicate,missingReview,queued,autoPublished,manualReview,rejected,linked};
 };return options.transaction?work(options.transaction):db.$transaction(work,{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:20000});
}
