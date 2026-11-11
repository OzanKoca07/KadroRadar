import {BadRequestException,ConflictException,ForbiddenException,NotFoundException} from '@nestjs/common';
import {PrismaClient,Prisma} from '@prisma/client';
import {resolve} from 'node:path';
import {SourceRightsStore,sourceRights} from './source-rights';
import {careerPublicationDecision,careerDetailUrl,policyFingerprint} from './career-publication';
const registry=require(resolve(__dirname,'../../../packages/official-sources.json'));
const noticeId=(hash:string)=>'career-notice-'+hash;
// Separate metadata-only notices reuse the existing private source-document
// queue. No fake recruitment/position is created and no document body is stored.
export async function stageCareerNotices(db:PrismaClient,report:any,actor:string,automatic=false,transaction?:Prisma.TransactionClient){
 if(report?.sourceId!=='career'||!Array.isArray(report.rows)||report.rows.length>1000||!/^[a-f0-9]{64}$/.test(report.documentSha256||'')||report.unresolved?.length||report.rows.some((r:any)=>!/^[a-f0-9]{64}$/.test(r.guidHash||'')||!/^[a-f0-9]{64}$/.test(r.contentHash||'')||r.rawSourceReference?.documentSha256!==report.documentSha256)||!Array.isArray(report.missingGuids??[])||(report.missingGuids??[]).some((v:any)=>!/^[a-f0-9]{64}$/.test(v)))throw new BadRequestException('Complete career report required');
 const rows=(report.rows||[]).filter((r:any)=>r.categoryCode!=='PERSONNEL');
 const work=async (tx:Prisma.TransactionClient)=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('career-notices'))`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtext('source-policy:career'))`;
  const override=await new SourceRightsStore(tx as any).current('career'),now=new Date();
  let created=0,updated=0,duplicate=0,autoPublished=0,manualReview=0,rejected=0,missingReview=0;
  for(const raw of rows){
   const processing=careerPublicationDecision(raw,registry.career,override,now,automatic),id=noticeId(raw.guidHash);
   const old=await tx.sourceDocument.findUnique({where:{id}}),prior=old?.gazetteEvidence as any;
   if(prior?.contentHash===raw.contentHash&&prior.processing?.decision===processing.decision&&prior.status!=='MISSING_REVIEW'){duplicate++;continue;}
   if(prior?.status==='MISSING_REVIEW'||prior?.status==='PENDING_REVIEW'&&prior?.processing?.reasons?.includes('FEED_ITEM_DISAPPEARED_REVIEW')){processing.decision='MANUAL_REVIEW';processing.reasons.push('FEED_ITEM_DISAPPEARED_REVIEW');}
   const eligible=processing.decision==='AUTO_PUBLISH_ELIGIBLE';
   const envelope={kind:'CAREER_NOTICE',sourceId:'career',guidHash:raw.guidHash,contentHash:raw.contentHash,documentSha256:report.documentSha256,title:raw.title,sourceUrl:raw.sourceUrl,announcedAt:raw.announcedAt,categoryCode:raw.categoryCode,category:raw.category,organization:raw.organizationVerification==='VERIFIED'&&typeof raw.organization==='string'&&raw.organization.length<=500?raw.organization:null,summary:'',processing,status:eligible?'PUBLISHED':processing.decision==='REJECTED'?'REJECTED':'PENDING_REVIEW',reviewMode:eligible?'AUTO_VALIDATED':null,version:(prior?.version??0)+1,checkedAt:now.toISOString(),publishedAt:eligible?now.toISOString():null,policyFingerprint:policyFingerprint(registry.career,override)};
   await tx.sourceDocument.upsert({where:{id},create:{id,sha256:raw.contentHash,originalUrl:raw.sourceUrl,originalFilename:'career-notice-metadata',sourceOrganization:'Kariyer Kapısı',state:'CAREER_NOTICE',gazetteEvidence:envelope},update:{sha256:raw.contentHash,originalUrl:raw.sourceUrl,gazetteEvidence:envelope}});
   await tx.reviewAudit.create({data:{batchId:id,actor,action:JSON.stringify({event:eligible?'NOTICE_AUTO_PUBLISH':'NOTICE_REVIEW',version:envelope.version,contentHash:raw.contentHash,processing}),count:1}});
   old?updated++:created++;eligible?autoPublished++:processing.decision==='REJECTED'?rejected++:manualReview++;
  }
  const changedCategory=report.rows.filter((r:any)=>r.categoryCode==='PERSONNEL').map((r:any)=>r.guidHash);
  for(const hash of [...(report.missingGuids||[]),...changedCategory]){
   const id=noticeId(hash),old=await tx.sourceDocument.findUnique({where:{id}}),e=old?.gazetteEvidence as any;
   if(!e||e.status==='MISSING_REVIEW')continue;
   await tx.sourceDocument.update({where:{id},data:{gazetteEvidence:{...e,status:'MISSING_REVIEW',version:e.version+1,processing:{decision:'MANUAL_REVIEW',reasons:['FEED_ITEM_DISAPPEARED_REVIEW']}}}});
   await tx.reviewAudit.create({data:{batchId:id,actor,action:JSON.stringify({event:'NOTICE_DISAPPEARED_REVIEW',autoCancelled:false}),count:1}});missingReview++;
  }
  return {created,updated,duplicate,autoPublished,manualReview,rejected,missingReview};
 };return transaction?work(transaction):db.$transaction(work,{timeout:20000});
}
export async function listCareerNotices(db:PrismaClient){const rows=await db.sourceDocument.findMany({where:{state:'CAREER_NOTICE'},orderBy:[{createdAt:'desc'},{id:'desc'}],take:100});return Promise.all(rows.map(async r=>({id:r.id,...r.gazetteEvidence as any,audits:await db.reviewAudit.findMany({where:{batchId:r.id},orderBy:[{createdAt:'desc'},{id:'desc'}],take:20})})));}
export async function reviewCareerNotice(db:PrismaClient,id:string,body:any,actor:string){
 if(!/^career-notice-[a-f0-9]{64}$/.test(id)||!Number.isInteger(body?.version)||!['PUBLISH','REJECT','ARCHIVE'].includes(body.action)||typeof body.evidence!=='string'||body.evidence.trim().length<20||body.evidence.length>2000)throw new BadRequestException('Version, action and official evidence required');
 return db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('career-notices'))`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtext('source-policy:career'))`;
  const row=await tx.sourceDocument.findUnique({where:{id}}),e=row?.gazetteEvidence as any;
  if(!e||row?.state!=='CAREER_NOTICE')throw new NotFoundException();if(e.version!==body.version)throw new ConflictException();
  if(body.action==='PUBLISH'&&(e.processing?.decision==='REJECTED'||e.status==='MISSING_REVIEW'||!careerDetailUrl(e.sourceUrl)||!Number.isFinite(Date.parse(e.announcedAt))||Date.parse(e.announcedAt)>Date.now()||body.sourceVerified!==true))throw new BadRequestException('Official notice verification required');
  const policy=await new SourceRightsStore(tx as any).current('career');
  if(body.action==='PUBLISH'&&sourceRights(registry.career,policy)!=='LICENSE_VERIFIED')throw new ForbiddenException('Source rights review required');
  const summary=body.summary??e.summary??'';if(typeof summary!=='string'||summary.length>180||/[<>\r\n]/.test(summary))throw new BadRequestException('Short factual summary required');
  const next={...e,summary,status:body.action==='PUBLISH'?'PUBLISHED':body.action==='REJECT'?'REJECTED':'ARCHIVED',reviewMode:'MANUAL_REVIEWED',version:e.version+1,publishedAt:body.action==='PUBLISH'?new Date().toISOString():e.publishedAt,checkedAt:new Date().toISOString(),policyFingerprint:policyFingerprint(registry.career,policy)};
  await tx.sourceDocument.update({where:{id},data:{gazetteEvidence:next}});await tx.reviewAudit.create({data:{batchId:id,actor,action:JSON.stringify({event:'NOTICE_'+body.action,version:next.version,evidence:body.evidence}),count:1}});return {id,...next};
 });
}
export async function publicCareerNotices(db:PrismaClient){
 if(await new SourceRightsStore(db).status(registry.career)!=='LICENSE_VERIFIED')return [];
 const rows=await db.sourceDocument.findMany({where:{state:'CAREER_NOTICE',gazetteEvidence:{path:['status'],equals:'PUBLISHED'}},orderBy:[{createdAt:'desc'},{id:'desc'}],take:20});
 return rows.map(row=>({id:row.id,...row.gazetteEvidence as any})).filter(e=>careerDetailUrl(e.sourceUrl)&&Number.isFinite(Date.parse(e.announcedAt))&&Date.parse(e.announcedAt)<=Date.now()&&['AUTO_VALIDATED','MANUAL_REVIEWED'].includes(e.reviewMode)).map(e=>({id:e.id,title:e.title,organization:e.organization??null,sourceName:'Kariyer Kapısı',date:e.announcedAt,sourceUrl:e.sourceUrl,summary:e.summary||'',contentType:'CAREER_NOTICE',categoryCode:e.categoryCode,reviewMode:e.reviewMode}));
}
