import {BadRequestException,ConflictException} from '@nestjs/common';
import {createHash} from 'node:crypto';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
// Capability-limited transaction: no public models, no arbitrary raw SQL. The
// original Prisma transaction owns commit/rollback; this cannot start a new one.
export function pilotTransaction(tx:any):any{
 const models:any={sourceSyncState:['findUnique','upsert','update','updateMany'],reviewAudit:['create'],announcementImportRow:['findUnique','create'],announcementReviewAudit:['create'],sourceDocument:['findUnique','create']};
 return new Proxy(tx,{get(target,key:string){
  if(key==='$executeRaw')return (strings:TemplateStringsArray,...values:any[])=>{
   const sql=Array.from(strings).join('?');
   if(!/^SELECT pg_advisory_xact_lock(?:_shared)?\(hashtext\(\?\)\)$/.test(sql)||values.length!==1||typeof values[0]!=='string'||! /^(external-result:|source-sync:|source-policy:|pilot-stage:)/.test(values[0]))throw Error('PILOT_PUBLICATION_BLOCKED');
   return target.$executeRaw(strings,...values);
  };
  if(!(key in models))throw Error('PILOT_PUBLICATION_BLOCKED');
  return new Proxy(target[key],{get(model,operation:string){
   if(!models[key].includes(operation))throw Error('PILOT_PUBLICATION_BLOCKED');
   return (args:any)=>{
    if(key==='sourceDocument'&&operation==='create'&&(args?.data?.state!=='PILOT_SOURCE_METADATA'||Object.keys(args.data).some(k=>!['sha256','originalUrl','originalFilename','sourceOrganization','state','gazetteEvidence'].includes(k))))throw Error('PILOT_PUBLICATION_BLOCKED');
    if(key==='announcementImportRow'&&operation==='create'&&(args?.data?.status!=='PENDING_REVIEW'||args?.data?.raw?.metadataPublication||args?.data?.raw?.pilot?.publicationBlocked!==true||Object.keys(args.data).some(k=>!['id','sourceUrl','contentHash','raw','parsed','issues','status','sourceDocumentId'].includes(k))))throw Error('PILOT_PUBLICATION_BLOCKED');
    return model[operation](args);
   };
  }});
 }});
}
export async function stagePilot(tx:any,id:string,report:any,limits:any,runId:string){
 const rows=id==='career'?report.rows:report.documents.flatMap((d:any)=>(d.parsed?.candidates||[]).map((candidate:any)=>({candidate,document:d})));
 if(rows.length>limits.maxRecords||(id==='career'?1:report.documents.length+report.unchangedDocuments.length)>limits.maxDocuments)throw new BadRequestException('Pilot budget exceeded');
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'pilot-stage:'+id}))`;
 let created=0,duplicate=0,metadataDocuments=0;const docs=new Map();
 for(const item of rows){
  let sourceUrl:string,raw:any,parsed:any,contentHash:string,sourceDocumentId:string|undefined;
  if(id==='career'){
   const {metadataPublication,pilot:untrustedPilot,processing:untrustedProcessing,...r}=item;let valid=false;try{const u=new URL(r.sourceUrl);valid=u.protocol==='https:'&&u.hostname==='kariyerkapisi.gov.tr'&&!u.username&&!u.password&&!u.hash&&(!u.port||u.port==='443')&&!['/','/rss'].includes(u.pathname.toLowerCase().replace(/\/$/,''));}catch{}
   if(!valid||r.sourceId!=='career'||!/^[a-f0-9]{64}$/.test(r.guidHash||'')||!/^[a-f0-9]{64}$/.test(r.contentHash||'')||r.rawSourceReference?.documentSha256!==report.documentSha256||typeof r.title!=='string'||!r.title.trim()||r.title.length>1000||!Array.isArray(r.issues)||!['PERSONNEL','EXAM_PLACEMENT','INTERNAL','EDUCATION'].includes(r.categoryCode))throw new BadRequestException('Invalid pilot career candidate');
   sourceUrl=r.sourceUrl;contentHash=r.contentHash;raw={...r,processing:{decision:'MANUAL_REVIEW',reasons:['STAGING_ONLY_PILOT']},pilot:{runId,publicationBlocked:true}};
   // RSS metadata never establishes employer/deadlines. Detail enrichment has a
   // separate permission contract and is deliberately disabled for first pilots.
   parsed={title:r.title,organization:null,sourceUrl,announcedAt:r.announcedAt,applicationStartAt:null,applicationEndAt:null,applicationUrl:null,sourceEvidence:{kind:'CAREER_RSS_METADATA',sourceId:id,categoryCode:r.categoryCode,guidHash:r.guidHash,documentSha256:report.documentSha256}};
  }else{
   const {metadataPublication,pilot:untrustedPilot,processing:untrustedProcessing,...r}=item.candidate,d=item.document;
   if(!/^[a-f0-9]{64}$/.test(d.sha256||'')||d.parsed?.sha256!==d.sha256||!['html','pdf'].includes(d.format))throw new BadRequestException('Invalid pilot document');
   if(typeof r.identity!=='string'||!r.identity.startsWith('urn:kadroradar:gazette:')||r.sourceUrl!==d.url||(r.sourceEvidence?.pdfSha256??r.sourceEvidence?.documentSha256)!==d.sha256||!Array.isArray(r.issues)||typeof r.organization!=='string'||!r.organization.trim()||!Array.isArray(r.positions))throw new BadRequestException('Invalid pilot Gazette candidate');
   sourceUrl=r.identity;contentHash=hash(JSON.stringify(r));raw={...r,processing:{decision:'MANUAL_REVIEW',reasons:['STAGING_ONLY_PILOT']},pilot:{runId,publicationBlocked:true}};parsed=r;
   if(!docs.has(d.sha256)){
    const old=await tx.sourceDocument.findUnique({where:{sha256:d.sha256}});
    const doc=old||await tx.sourceDocument.create({data:{sha256:d.sha256,originalUrl:d.url,originalFilename:'pilot-source.'+d.format,sourceOrganization:'T.C. Resmî Gazete',state:'PILOT_SOURCE_METADATA',gazetteEvidence:{sourceId:id,runId,format:d.format,liveFetch:true,publicationBlocked:true}}});if(!old)metadataDocuments++;docs.set(d.sha256,doc.id);
   }sourceDocumentId=docs.get(d.sha256);
  }
  const old=await tx.announcementImportRow.findUnique({where:{sourceUrl}});
  if(old){duplicate++;continue;} // Never invalidate/edit a prior publication.
  const row=await tx.announcementImportRow.create({data:{...(id==='career'?{id:'career-rss-'+item.guidHash}:{}),sourceUrl,contentHash,raw,parsed,issues:[...raw.issues,'STAGING_ONLY_PILOT'],status:'PENDING_REVIEW',...(sourceDocumentId?{sourceDocumentId}:{})}});
  await tx.announcementReviewAudit.create({data:{rowId:row.id,actor:'source-ingest',action:'PILOT_STAGED',snapshot:{runId,sourceId:id,publicationBlocked:true}}});created++;
 }
 return {status:'OK',mode:'staging-only',created,duplicate,changed:0,autoPublished:0,newsPublished:0,reviewRequired:true,documents:id==='career'?1:report.documents.length,rows:rows.length,writes:{importRows:created,importAudits:created,sourceDocuments:metadataDocuments,completionStateUpdates:2,completionAudit:1}};
}
