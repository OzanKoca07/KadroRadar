import {BadRequestException,ConflictException} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {createHash} from 'node:crypto';

import {applicationDates,temporalStatus} from './application-dates';
import {policyFingerprint} from './career-publication';
import {SourceRightsStore} from './source-rights';
import {gazettePublicationDecision} from './gazette-publication';
import {reconcilePublication,linkPublication,invalidatePublication} from './publication-reconciliation';
const registry=require(require('node:path').resolve(__dirname,'../../../packages/official-sources.json'));

const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export function gazetteUrl(value:any){
 try{const u=new URL(value);if(u.protocol!=='https:'||u.hostname!=='www.resmigazete.gov.tr'||u.username||u.password||u.search||u.hash||u.port&&u.port!=='443'||!/^\/(?:eskiler|ilanlar\/eskiilanlar)\/20\d{2}\/\d{2}\/20\d{6}(?:[-_]\d+)*\.(?:pdf|html?)$/i.test(u.pathname))throw Error();return u.toString();}
 catch{throw new BadRequestException('Official dated Gazette URL required');}
}
export async function stageGazetteSnapshot(tx:Prisma.TransactionClient,report:any,previous:any,actor:string,checkedAt=new Date()){
 if(report?.sourceId!=='gazette'||!/^20\d{2}-\d{2}-\d{2}$/.test(report.date||'')||!Array.isArray(report.documents)||report.documents.length>2||!Array.isArray(report.indexes)||report.indexes.length>2)throw new BadRequestException('Bounded Gazette snapshot required');
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('automatic-publication'))`;
 const policy=await new SourceRightsStore(tx as any).current('gazette');
 let created=0,changed=0,duplicate=0,missingReview=0,autoPublished=0,archived=0,manualReview=0,rejected=0,linked=0;
 const cutoff=new Date(Date.parse(report.date+'T00:00:00Z')-7*86400000).toISOString().slice(0,10);
 const snapshot:any={...previous,documents:Object.fromEntries(Object.entries(previous?.documents||{}).filter(([,v]:any)=>v.date>=cutoff))};
 const currentUrls=new Set<string>();
 const observedUrls=new Set<string>();for(const index of report.indexes){if(!Array.isArray(index.manifest?.links)||index.manifest.links.length>1000)throw new BadRequestException('Bounded index links required');for(const link of index.manifest.links)if(typeof link.url==='string')observedUrls.add(link.url);}
 const invalidate=async(row:any)=>invalidatePublication(tx,row);
 const missing=async(rowId:string,why:string)=>{
  const row=await tx.announcementImportRow.findUnique({where:{id:rowId}});if(!row)return;
  const issues=Array.isArray(row.issues)?row.issues:[];if(issues.includes(why))return;
  await invalidate(row);await tx.announcementImportRow.update({where:{id:row.id},data:{status:'PENDING_REVIEW',issues:[...issues,why],version:{increment:1}}});
  await tx.announcementReviewAudit.create({data:{rowId:row.id,actor,action:why,snapshot:{date:report.date,autoCancelled:false}}});missingReview++;
 };
 // A conditional check is not a new parse. Reuse only DB-committed row references.
 const unchanged=report.unchangedDocuments??[];
 if(!Array.isArray(unchanged)||unchanged.length+report.documents.length>2)throw new BadRequestException('Bounded unchanged proof required');
 for(const proof of unchanged){
  gazetteUrl(proof.url);const old=previous?.documents?.[proof.url];
  if(proof.parsedAgain!==false||!old||old.sha256!==proof.sha256)throw new BadRequestException('Uncommitted conditional proof');
  for(const rowId of Object.values(old.rowRefs||{}) as string[]){
   const row=await tx.announcementImportRow.findUnique({where:{id:rowId}});if(!row)throw new BadRequestException('Missing conditional row');
   duplicate++;
   if(!row.announcementId||gazettePublicationDecision(row.raw,registry.gazette,policy,checkedAt).decision!=='AUTO_PUBLISH_ELIGIBLE')continue;
   const item=await tx.announcement.findUnique({where:{id:row.announcementId}});
   if(!item||item.sourceUrl!==proof.url||(item.sourceEvidence as any)?.publicationMode!=='AUTO_VALIDATED'||item.status!=='PUBLISHED')continue;
   const expired=['CLOSED','PAST_CALENDAR_DATE'].includes(temporalStatus(item,checkedAt));
   await tx.announcement.update({where:{id:item.id},data:{sourceCheckedAt:checkedAt,...(expired?{status:'ARCHIVED'}:{})}});
   if(expired){await tx.announcementImportRow.update({where:{id:row.id},data:{status:'ARCHIVED',version:{increment:1}}});archived++;}
   await tx.announcementReviewAudit.create({data:{rowId:row.id,actor,action:expired?'AUTO_ARCHIVE':'CONDITIONAL_SOURCE_UNCHANGED',snapshot:{documentSha256:proof.sha256,parsedAgain:false,sourceUrl:proof.url}}});
  }
 }
 for(const index of report.indexes){
  gazetteUrl(index.url);if(!/^[a-f0-9]{64}$/.test(index.sha256||'')||index.manifest?.indexUrl!==index.url)throw new BadRequestException('Invalid Gazette index evidence');
  const doc=await tx.sourceDocument.upsert({where:{sha256:index.sha256},create:{sha256:index.sha256,originalUrl:index.url,originalFilename:'gazette-live-index.html',sourceOrganization:'T.C. Resmî Gazete',state:'GAZETTE_INDEX',gazetteEvidence:{...index.manifest,htmlSha256:index.sha256,provenance:report.networkProvenance==='LIVE_HTTPS'?'DOWNLOADED_OFFICIAL_HTML':'MOCK_TRANSPORT_FIXTURE',liveFetch:report.networkProvenance==='LIVE_HTTPS',reviewRequired:true}},update:{}});
  if(doc.state!=='GAZETTE_INDEX')throw new ConflictException('Index hash belongs to another workflow');
 }
 for(const document of report.documents){
  const url=gazetteUrl(document.url),parsed=document.parsed;
  if(currentUrls.has(url)||!/^[a-f0-9]{64}$/.test(document.sha256||'')||!['pdf','html'].includes(document.format)||parsed?.sha256!==document.sha256||!Array.isArray(parsed.candidates)||parsed.candidates.length>100||parsed.gazetteDate&&parsed.gazetteDate!==report.date)throw new BadRequestException('Invalid Gazette document evidence');
  currentUrls.add(url);
  const doc=await tx.sourceDocument.upsert({where:{sha256:document.sha256},create:{sha256:document.sha256,originalUrl:url,originalFilename:'gazette-live.'+document.format,sourceOrganization:'T.C. Resmî Gazete',state:'GAZETTE_UPLOADED',gazetteEvidence:{format:document.format.toUpperCase(),gazetteDate:parsed.gazetteDate,gazetteNumber:parsed.gazetteNumber,metrics:parsed.metrics,liveFetch:report.networkProvenance==='LIVE_HTTPS',reviewRequired:true}},update:{}});
  if(doc.state!=='GAZETTE_UPLOADED'&&!(document.format==='html'&&doc.state==='GAZETTE_INDEX'&&doc.originalUrl===url&&report.indexes.some((i:any)=>i.url===url&&i.sha256===document.sha256)))throw new ConflictException('Document hash belongs to another workflow');
  const oldRefs=previous?.documents?.[url]?.rowRefs||{},rowRefs:Record<string,string>={},occurrences=new Map<string,number>();
  for(const original of parsed.candidates){
   // Missing printed issue metadata can be supported by an observed index chain,
   // never by guessing from a document filename alone.
   const direct=report.indexes.find((i:any)=>i.manifest.links.some((l:any)=>l.url===url));
   const parent=direct&&report.indexes.find((i:any)=>i.manifest.gazetteDate===report.date&&/^\d{4,6}$/.test(i.manifest.gazetteNumber||'')&&(i.url===direct.url||i.manifest.links.some((l:any)=>l.url===direct.url)));
   const candidate=parent?{...original,sourceEvidence:{...original.sourceEvidence,index:{indexUrl:parent.url,htmlSha256:parent.sha256,gazetteDate:parent.manifest.gazetteDate,gazetteNumber:parent.manifest.gazetteNumber,observedDocumentUrl:url}},issues:original.issues.filter((i:any)=>i!=='MISSING_GAZETTE_METADATA')}:original;

   if(typeof candidate.identity!=='string'||!candidate.identity.startsWith('urn:kadroradar:gazette')||typeof candidate.organization!=='string'||!candidate.organization.trim()||candidate.sourceUrl!==url||(candidate.sourceEvidence?.pdfSha256??candidate.sourceEvidence?.documentSha256)!==document.sha256||!Array.isArray(candidate.issues))throw new BadRequestException('Candidate source proof required');
   const organization=candidate.organization.normalize('NFKC').trim(),ordinal=(occurrences.get(organization)||0)+1;occurrences.set(organization,ordinal);
   const key=hash(url+'\n'+organization+'\n'+(candidate.sourceEvidence.advertisementId||ordinal));
   if(key in rowRefs)throw new BadRequestException('Ambiguous Gazette notice identity requires review');
   // The parser's content-addressed identity interoperates with manual imports;
   // stable URL/organization refs reconcile later versions of that document.
   const priorId=oldRefs[key];let old=priorId?await tx.announcementImportRow.findUnique({where:{id:priorId}}):null;
   const sameContent=await tx.announcementImportRow.findUnique({where:{sourceUrl:candidate.identity}});
   if(old&&sameContent&&sameContent.id!==old.id)throw new ConflictException('Manual/live duplicate requires editor reconciliation');
   old=old||sameContent;
   if(old&&(old.raw as any)?.sourceUrl!==url&&old.sourceDocumentId!==doc.id)throw new ConflictException('Prior row belongs to a different source document');
   const publication=old?.announcementId?await tx.announcement.findUnique({where:{id:old.announcementId},select:{sourceUrl:true,sourceEvidence:true}}):null;
   const automatic=publication?.sourceUrl===url&&(publication?.sourceEvidence as any)?.publicationMode==='AUTO_VALIDATED';
   if(old?.announcementId&&!automatic&&old.contentHash===hash(JSON.stringify(candidate))){duplicate++;rowRefs[key]=old.id;continue;}
   const publicationPolicy=policyFingerprint(registry.gazette,policy);
   const contentHash=hash(JSON.stringify(candidate)),processing=gazettePublicationDecision(candidate,registry.gazette,policy),issues=[...candidate.issues];
   if(old&&((old.issues as any[])||[]).some((i:any)=>typeof i==='string'&&i.includes('DISAPPEARED_REVIEW'))){processing.decision='MANUAL_REVIEW';processing.reasons.push('DISAPPEARANCE_REVIEW');}
   if(old?.announcementId&&!automatic){processing.decision='MANUAL_REVIEW';processing.reasons.push('MANUAL_PUBLICATION_CHANGE_REVIEW');}
   if(old?.status==='LINKED'&&old.contentHash!==contentHash){processing.decision='MANUAL_REVIEW';processing.reasons.push('LINKED_SOURCE_CHANGE_REVIEW');}
   if(old?.contentHash===contentHash&&(old.raw as any)?.processing?.decision===processing.decision&&(old.raw as any)?.publicationPolicy===publicationPolicy&&!((old.issues as any[])||[]).some(issue=>typeof issue==='string'&&issue.includes('DISAPPEARED_REVIEW'))){if(processing.decision==='AUTO_PUBLISH_ELIGIBLE'&&old.announcementId&&old.status==='PUBLISHED'&&['CLOSED','PAST_CALENDAR_DATE'].includes(temporalStatus(candidate))){await tx.announcement.update({where:{id:old.announcementId},data:{status:'ARCHIVED'}});await tx.announcementImportRow.update({where:{id:old.id},data:{status:'ARCHIVED',version:{increment:1}}});await tx.announcementReviewAudit.create({data:{rowId:old.id,actor,action:'AUTO_ARCHIVE',snapshot:{reason:'VERIFIED_DEADLINE_EXPIRED'}}});archived++;}duplicate++;rowRefs[key]=old.id;continue;}
   if(old)await invalidate(old);
   const data={sourceDocumentId:doc.id,contentHash,raw:{...candidate,processing,publicationPolicy},parsed:candidate,issues:[...issues,...(processing.decision==='AUTO_PUBLISH_ELIGIBLE'?[]:['PDF_SOURCE_REVIEW_REQUIRED'])],status:'PENDING_REVIEW'};
   const row=old?await tx.announcementImportRow.update({where:{id:old.id},data:{...data,version:{increment:1}}}):await tx.announcementImportRow.create({data:{...data,sourceUrl:candidate.identity}});
   rowRefs[key]=row.id;
   if(candidate.eventType!=='RECRUITMENT')await reconcilePublication(tx,candidate,'gazette');
   if(processing.decision==='AUTO_PUBLISH_ELIGIBLE'){
    const match=old?.announcementId?{decision:'NEW'}:await reconcilePublication(tx,candidate,'gazette');
    if(match.decision==='EXACT'){await linkPublication(tx,row.id,(match as any).announcementId,{...candidate.sourceEvidence,sourceUrl:url},actor);linked++;}
    else if(['CONFLICT','POSSIBLE'].includes(match.decision)){processing.decision='MANUAL_REVIEW';processing.reasons.push('CROSS_SOURCE_'+match.decision);manualReview++;}
    else {
     const now=checkedAt,expired=['CLOSED','PAST_CALENDAR_DATE'].includes(temporalStatus(candidate,now));
     const facts={title:candidate.title,organization:candidate.organization,sourceUrl:url,applicationUrl:candidate.applicationUrl||url,applicationStartAt:candidate.applicationStartAt?new Date(candidate.applicationStartAt):null,applicationEndAt:candidate.applicationEndAt?new Date(candidate.applicationEndAt):null,sourceCheckedAt:now,publishedAt:now,status:expired?'ARCHIVED':'PUBLISHED',quota:null,sourceEvidence:{...candidate.sourceEvidence,applicationDates:applicationDates(candidate),sourceId:'gazette',publicationMode:'AUTO_VALIDATED',conditionsVerification:'UNKNOWN'}};
     const item=old?.announcementId?await tx.announcement.update({where:{id:old.announcementId},data:facts}):await tx.announcement.create({data:{id:'gazette-auto-'+row.id,...facts}});
     await tx.announcementImportRow.update({where:{id:row.id},data:{announcementId:item.id,status:facts.status,parsed:{...candidate,sourceEvidence:{...candidate.sourceEvidence,publicationMode:'AUTO_VALIDATED'}}}});
     autoPublished++;if(expired)archived++;
    }
   }else if(processing.decision==='REJECTED')rejected++;else manualReview++;
   await tx.announcementImportRow.update({where:{id:row.id},data:{raw:{...candidate,processing,publicationPolicy}}});
   await tx.announcementReviewAudit.create({data:{rowId:row.id,actor,action:old?'GAZETTE_SOURCE_CHANGED':'GAZETTE_DOWNLOADED_IMPORTED',snapshot:{documentSha256:document.sha256,sourceUrl:url,date:report.date,processing}}});
   old?changed++:created++;
  }
  if(report.complete===true)for(const [key,rowId]of Object.entries(oldRefs))if(!(key in rowRefs))await missing(rowId as string,'GAZETTE_ITEM_DISAPPEARED_REVIEW');
  snapshot.documents[url]={date:report.date,sha256:document.sha256,rowRefs:{...oldRefs,...rowRefs}};
 }
 // Only a complete same-day index/extraction can raise disappearance hints.
 // Empty/failed/truncated/OCR-uncertain snapshots never withdraw announcements.
 if(report.complete===true)for(const [url,old]of Object.entries(previous?.documents||{}) as [string,any][])if(old.date===report.date&&!currentUrls.has(url)&&!observedUrls.has(url))for(const id of Object.values(old.rowRefs||{}))await missing(id as string,'GAZETTE_DOCUMENT_DISAPPEARED_REVIEW');
 if(report.missingDocuments!==undefined){if(!Array.isArray(report.missingDocuments)||report.missingDocuments.length>2)throw new BadRequestException('Bounded missing-document proof required');for(const proof of report.missingDocuments){gazetteUrl(proof.url);const old=previous?.documents?.[proof.url];if(proof.httpStatus!==404||!old||old.date!==report.date||currentUrls.has(proof.url))throw new BadRequestException('Unconfirmed document disappearance');for(const id of Object.values(old.rowRefs||{}))await missing(id as string,'GAZETTE_DOCUMENT_DISAPPEARED_REVIEW');}}
 const keys=Object.keys(snapshot.documents);if(keys.length>128)throw new BadRequestException('Gazette snapshot retention review required');
 return {created,changed,duplicate,missingReview,autoPublished,archived,manualReview,rejected,linked,snapshot};
}
