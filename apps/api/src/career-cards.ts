import {applicationDates,temporalStatus} from './application-dates';
import {PrismaClient} from '@prisma/client';
import {resolve} from 'node:path';
import {SourceRightsStore} from './source-rights';
import {careerPublicationDecision,policyFingerprint} from './career-publication';
const registry=require(resolve(__dirname,'../../../packages/official-sources.json'));
// Metadata is not an application, deadline, employer or eligibility assertion.
export function careerCard(row:any,source:any,policy:any,now=new Date()){
 const raw=row.raw,publication=raw?.metadataPublication;
 if(row.announcementId||row.status==='LINKED'||row.status==='REJECTED'||row.status==='ARCHIVED'||raw?.categoryCode!=='PERSONNEL'||publication?.mode!=='METADATA_ONLY'||publication.contentHash!==row.contentHash||publication.decision!=='AUTO_PUBLISH_ELIGIBLE'||!Number.isFinite(Date.parse(publication.checkedAt))||Date.parse(publication.checkedAt)>+now||!Array.isArray(row.issues)||row.issues.includes('FEED_ITEM_DISAPPEARED_REVIEW')||raw?.processing?.reasons?.includes('DISAPPEARANCE_REVIEW'))return null;
 if(typeof raw.category!=='string'||!raw.category.trim()||raw.category.length>250||publication.policyFingerprint!==policyFingerprint(source,policy))return null;
 if(careerPublicationDecision(raw,source,policy,now,true,true).decision!=='AUTO_PUBLISH_ELIGIBLE')return null;
 return {id:row.id,title:raw.title,category:raw.category,contentType:'PERSONNEL_METADATA',announcedAt:raw.announcedAt,sourceName:'Kariyer Kapısı',sourceUrl:raw.sourceUrl,organization:raw.organizationVerification==='VERIFIED'&&typeof raw.organization==='string'&&raw.organization.length<=500?raw.organization:null,applicationStartAt:null,applicationEndAt:null,organizationStatus:raw.organizationVerification==='VERIFIED'?'VERIFIED':'UNKNOWN',applicationDates:applicationDates(raw),applicationEndDate:applicationDates(raw).end.date,applicationStartDate:applicationDates(raw).start.date,applicationDatesStatus:applicationDates(raw).mode,applicationStatus:temporalStatus(raw,now)==='DATE_UNVERIFIED'?'UNKNOWN':temporalStatus(raw,now),eligibility:'UNKNOWN',sourceCheckedAt:publication.checkedAt};
}
export async function publicCareerCards(db:PrismaClient,page=1,limit=20){
 const policy=await new SourceRightsStore(db).current('career');
 // Maximum feed size is 1000. Filter before pagination so invalid rows cannot hide valid items.
 const rows=await db.announcementImportRow.findMany({where:{id:{startsWith:'career-rss-'},raw:{path:['metadataPublication','decision'],equals:'AUTO_PUBLISH_ELIGIBLE'}},orderBy:[{createdAt:'desc'},{id:'desc'}],take:1000});
 const items=rows.map(row=>careerCard(row,registry.career,policy)).filter(Boolean);
 return {items:items.slice((page-1)*limit,page*limit),total:items.length,page,limit,pages:Math.ceil(items.length/limit)};
}
