import {BadRequestException,ConflictException} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {createHash} from 'node:crypto';

const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export function gazetteUrl(value:any){
 try{const u=new URL(value);if(u.protocol!=='https:'||u.hostname!=='www.resmigazete.gov.tr'||u.username||u.password||u.search||u.hash||u.port&&u.port!=='443'||!/^\/(?:eskiler|ilanlar\/eskiilanlar)\/20\d{2}\/\d{2}\/20\d{6}(?:[-_]\d+)*\.(?:pdf|html?)$/i.test(u.pathname))throw Error();return u.toString();}
 catch{throw new BadRequestException('Official dated Gazette URL required');}
}
export async function stageGazetteSnapshot(tx:Prisma.TransactionClient,report:any,previous:any,actor:string){
 if(report?.sourceId!=='gazette'||!/^20\d{2}-\d{2}-\d{2}$/.test(report.date||'')||!Array.isArray(report.documents)||report.documents.length>2||!Array.isArray(report.indexes)||report.indexes.length>2)throw new BadRequestException('Bounded Gazette snapshot required');
 let created=0,changed=0,duplicate=0,missingReview=0;
 const snapshot:any={...previous,documents:{...(previous?.documents||{})}};
 const currentUrls=new Set<string>();
 const observedUrls=new Set<string>();for(const index of report.indexes){if(!Array.isArray(index.manifest?.links)||index.manifest.links.length>1000)throw new BadRequestException('Bounded index links required');for(const link of index.manifest.links)if(typeof link.url==='string')observedUrls.add(link.url);}
 const invalidate=async(row:any)=>{if(row.announcementId){await tx.announcement.update({where:{id:row.announcementId},data:{sourceCheckedAt:null}});await tx.announcementPosition.updateMany({where:{announcementId:row.announcementId},data:{verifiedAt:null}});}};
 const missing=async(rowId:string,why:string)=>{
  const row=await tx.announcementImportRow.findUnique({where:{id:rowId}});if(!row)return;
  const issues=Array.isArray(row.issues)?row.issues:[];if(issues.includes(why))return;
  await invalidate(row);await tx.announcementImportRow.update({where:{id:row.id},data:{status:'PENDING_REVIEW',issues:[...issues,why],version:{increment:1}}});
  await tx.announcementReviewAudit.create({data:{rowId:row.id,actor,action:why,snapshot:{date:report.date,autoCancelled:false}}});missingReview++;
 };
 for(const index of report.indexes){
  gazetteUrl(index.url);if(!/^[a-f0-9]{64}$/.test(index.sha256||'')||index.manifest?.indexUrl!==index.url)throw new BadRequestException('Invalid Gazette index evidence');
  const doc=await tx.sourceDocument.upsert({where:{sha256:index.sha256},create:{sha256:index.sha256,originalUrl:index.url,originalFilename:'gazette-live-index.html',sourceOrganization:'T.C. Resmî Gazete',state:'GAZETTE_INDEX',gazetteEvidence:{...index.manifest,htmlSha256:index.sha256,provenance:report.networkProvenance==='LIVE_HTTPS'?'DOWNLOADED_OFFICIAL_HTML':'MOCK_TRANSPORT_FIXTURE',liveFetch:report.networkProvenance==='LIVE_HTTPS',reviewRequired:true}},update:{}});
  if(doc.state!=='GAZETTE_INDEX')throw new ConflictException('Index hash belongs to another workflow');
 }
 for(const document of report.documents){
  const url=gazetteUrl(document.url),parsed=document.parsed;
  if(currentUrls.has(url)||!/^[a-f0-9]{64}$/.test(document.sha256||'')||!['pdf','html'].includes(document.format)||parsed?.sha256!==document.sha256||!Array.isArray(parsed.candidates)||parsed.candidates.length>100||parsed.gazetteDate&&parsed.gazetteDate!==report.date)throw new BadRequestException('Invalid Gazette document evidence');
  currentUrls.add(url);
  const doc=await tx.sourceDocument.upsert({where:{sha256:document.sha256},create:{sha256:document.sha256,originalUrl:url,originalFilename:'gazette-live.'+document.format,sourceOrganization:'T.C. Resmî Gazete',state:'GAZETTE_UPLOADED',gazetteEvidence:{format:document.format.toUpperCase(),gazetteDate:parsed.gazetteDate,gazetteNumber:parsed.gazetteNumber,metrics:parsed.metrics,liveFetch:report.networkProvenance==='LIVE_HTTPS',reviewRequired:true,autoPublished:false}},update:{}});
  if(doc.state!=='GAZETTE_UPLOADED')throw new ConflictException('Document hash belongs to another workflow');
  const oldRefs=previous?.documents?.[url]?.rowRefs||{},rowRefs:Record<string,string>={},occurrences=new Map<string,number>();
  for(const candidate of parsed.candidates){
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
   const contentHash=hash(JSON.stringify(candidate)),issues=[...candidate.issues,'PDF_SOURCE_REVIEW_REQUIRED'];
   if(old?.contentHash===contentHash&&!((old.issues as any[])||[]).some(issue=>typeof issue==='string'&&issue.includes('DISAPPEARED_REVIEW'))){duplicate++;rowRefs[key]=old.id;continue;}
   if(old)await invalidate(old);
   const data={sourceDocumentId:doc.id,contentHash,raw:candidate,parsed:candidate,issues,status:'PENDING_REVIEW'};
   const row=old?await tx.announcementImportRow.update({where:{id:old.id},data:{...data,version:{increment:1}}}):await tx.announcementImportRow.create({data:{...data,sourceUrl:candidate.identity}});
   rowRefs[key]=row.id;
   await tx.announcementReviewAudit.create({data:{rowId:row.id,actor,action:old?'GAZETTE_SOURCE_CHANGED':'GAZETTE_DOWNLOADED_IMPORTED',snapshot:{documentSha256:document.sha256,sourceUrl:url,date:report.date,autoPublished:false}}});
   old?changed++:created++;
  }
  if(report.complete===true)for(const [key,rowId]of Object.entries(oldRefs))if(!(key in rowRefs))await missing(rowId as string,'GAZETTE_ITEM_DISAPPEARED_REVIEW');
  snapshot.documents[url]={date:report.date,sha256:document.sha256,rowRefs:{...oldRefs,...rowRefs}};
 }
 // Only a complete same-day index/extraction can raise disappearance hints.
 // Empty/failed/truncated/OCR-uncertain snapshots never withdraw announcements.
 if(report.complete===true)for(const [url,old]of Object.entries(previous?.documents||{}) as [string,any][])if(old.date===report.date&&!currentUrls.has(url)&&!observedUrls.has(url))for(const id of Object.values(old.rowRefs||{}))await missing(id as string,'GAZETTE_DOCUMENT_DISAPPEARED_REVIEW');
 if(report.missingDocuments!==undefined){if(!Array.isArray(report.missingDocuments)||report.missingDocuments.length>2)throw new BadRequestException('Bounded missing-document proof required');for(const proof of report.missingDocuments){gazetteUrl(proof.url);const old=previous?.documents?.[proof.url];if(proof.httpStatus!==404||!old||old.date!==report.date||currentUrls.has(proof.url))throw new BadRequestException('Unconfirmed document disappearance');for(const id of Object.values(old.rowRefs||{}))await missing(id as string,'GAZETTE_DOCUMENT_DISAPPEARED_REVIEW');}}
 const keys=Object.keys(snapshot.documents);if(keys.length>32)throw new BadRequestException('Gazette snapshot retention review required');
 return {created,changed,duplicate,missingReview,snapshot};
}
