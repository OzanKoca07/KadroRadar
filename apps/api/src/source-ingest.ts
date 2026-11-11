import {Controller,Post,Body,Req,Param,Injectable,UnauthorizedException,ServiceUnavailableException,BadRequestException,ConflictException,ForbiddenException} from '@nestjs/common';
import {resolve} from 'node:path';
import {IngestionDb} from './announcement-admin';
import {SourceOperations,sourceAllowed} from './source-operations';
import {SourceRightsStore,sourceRights} from './source-rights';
import {nextScanAt,sourceScanIntervalHours} from './announcement-scan';
import {indexingAssessment} from './source-indexing-policy';
import {gazetteUrl} from './gazette-staging';
import {policyFingerprint} from './career-publication';
const registry=require(resolve(__dirname,'../../../packages/official-sources.json'));
const auth=require(resolve(__dirname,'../../../packages/shared/source-ingest.cjs'));
const uuid=(s:any)=>typeof s==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(s);
const errorCodes=['DNS','TLS','TIMEOUT','FORBIDDEN','RATE_LIMITED','REDIRECT','PARSE_OR_VALIDATION','NETWORK'];
const dayAfter=(day:string)=>new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString().slice(0,10);
const todayDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function gazetteDates(transport:any,today:string,days:number):string[]{
 if(transport?.pendingDates?.length)return transport.pendingDates;
 const recent=new Date(Date.parse(today+'T00:00:00Z')-(days-1)*86400000).toISOString().slice(0,10);
 const checkpoint=transport?.lastCoveredDate?dayAfter(transport.lastCoveredDate):recent;
 const start=checkpoint<recent?checkpoint:recent,dates=[];for(let d=start;d<=today&&dates.length<days;d=dayAfter(d))dates.push(d);return dates;
}
@Injectable()
export class SourceIngest {
 constructor(private db:IngestionDb,private operations:SourceOperations){}
 private enabled(){if(process.env.SOURCE_AUTOMATION_APPROVED!=='true'||process.env.SOURCE_REMOTE_INGEST_ENABLED!=='true')throw new ServiceUnavailableException('Source automation disabled');}
 private async allowed(id:string){if(!['career','gazette'].includes(id))throw new ForbiddenException('Unsupported source');const source=registry[id],policy=await new SourceRightsStore(this.db).current(id);if(!sourceAllowed(source)||sourceRights(source,policy)!=='LICENSE_VERIFIED'||id==='gazette'&&policy&&!policy.evidence?.scopes?.includes('AUTOMATED_GAZETTE_DOCUMENT_ACCESS'))throw new ForbiddenException('Source permission unverified');return {source,policy};}
 async claim(body:any,id='gazette'){
  this.enabled();
  if(!uuid(body?.runId))throw new BadRequestException('Run identity required');
  const {source,policy}=await this.allowed(id);
  return this.db.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'source-sync:'+id}))`;
   const lease=await tx.sourceSyncState.findUnique({where:{id:`external:${id}`}}),m=lease?.metrics as any;
   if(lease?.status==='LEASED'&&Date.parse(m?.expiresAt)>Date.now())return m.runId===body.runId?{status:'LEASED',...m}: {status:'BUSY'};
   // Same UUID can never create a second logical run, even after a lost response.
   if(m?.runId===body.runId)return {status:lease?.status==='COMPLETED'?'ALREADY_COMPLETED':'EXPIRED'};
   const state=await tx.sourceSyncState.findUnique({where:{id}}),previous=(state?.metrics||{}) as any,now=new Date();
   if(lease?.status==='LEASED')await tx.reviewAudit.create({data:{batchId:`external:${id}`,actor:'source-ingest',action:JSON.stringify({event:'EXTERNAL_LEASE_EXPIRED',runId:m?.runId}),count:0}});
   const minimum=indexingAssessment(source).minIntervalSeconds*1000;
   if(state?.lastAttemptAt&&+now-+state.lastAttemptAt<minimum)return {status:'NOT_DUE',nextAttemptAt:new Date(+state.lastAttemptAt+minimum)};
   const backlog=id==='gazette'&&previous.transport?.pendingDates?.length;
   const due=state?.consecutiveFailures?state.nextAttemptAt:backlog?state?.nextAttemptAt:nextScanAt(state?.lastSuccessAt,indexingAssessment(source).minIntervalSeconds,sourceScanIntervalHours(source));
   if(due&&due>now)return {status:'NOT_DUE',nextAttemptAt:due};
   const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
   const days=Math.min(5,Math.ceil(sourceScanIntervalHours(source)/24)+1);
   const pendingDates=id==='gazette'?gazetteDates(previous.transport,today,days):[];
   if(pendingDates.length>5||pendingDates.some((d:string)=>!/^20\d{2}-\d{2}-\d{2}$/.test(d)||new Date(d+'T00:00:00Z').toISOString().slice(0,10)!==d||d>today))throw new BadRequestException('Invalid date checkpoint');
   const request=await tx.sourceSyncState.findUnique({where:{id:`request:${id}`}});
   const fingerprint=policyFingerprint(source,policy);
   const transport={...(previous.transport||{}),policyFingerprint:fingerprint,forceReparse:previous.transport?.policyFingerprint!==fingerprint};
   const sha=process.env.RENDER_GIT_COMMIT;
   const detailEnabled=id==='career'&&process.env.CAREER_DETAIL_ENRICHMENT_ENABLED==='true'&&source.rightsAssessment?.evidence?.scopes?.includes('AUTOMATED_CAREER_DETAIL_ACCESS')&&(!policy||policy.evidence?.scopes?.includes('AUTOMATED_CAREER_DETAIL_ACCESS'));
   const detailRows=detailEnabled?(await tx.announcementImportRow.findMany({where:{id:{in:(transport.knownGuids||[]).slice(0,1000).map((h:string)=>'career-rss-'+h)}},select:{raw:true},take:1000})).map(r=>{const {processing,metadataPublication,...raw}=r.raw as any;return raw;}):[];
   const metrics={sourceId:id,detailEnabled,detailRows,runId:body.runId,...(sha&&/^[a-f0-9]{40}$/.test(sha)?{releaseSha:sha}:{}),expiresAt:new Date(+now+15*60000).toISOString(),date:pendingDates[0]??today,pendingDates,requestId:request?.status==='REQUESTED'?(request.metrics as any)?.requestId??null:null,transport,source:{...source,rightsAssessment:policy??source.rightsAssessment}};
   await tx.sourceSyncState.upsert({where:{id:`external:${id}`},create:{id:`external:${id}`,status:'LEASED',metrics},update:{status:'LEASED',metrics}});
   await tx.sourceSyncState.upsert({where:{id},create:{id,status:'RUNNING_EXTERNAL',lastAttemptAt:now,nextAttemptAt:new Date(+now+minimum)},update:{status:'RUNNING_EXTERNAL',lastAttemptAt:now,nextAttemptAt:new Date(+now+minimum)}});
   await tx.reviewAudit.create({data:{batchId:`external:${id}`,actor:'source-ingest',action:JSON.stringify({event:'EXTERNAL_SOURCE_LEASE',runId:body.runId}),count:0}});
   return {status:'LEASED',...metrics};
  });
 }
 async complete(body:any,id='gazette'){
  this.enabled();
  if(!uuid(body?.runId)||(!body.report&&!errorCodes.includes(body.errorCode))||body.report&&body.errorCode)throw new BadRequestException('Bounded source result required');
  const reportHash=auth.digest(body);
  return this.db.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'external-result:'+id}))`;
   const row=await tx.sourceSyncState.findUnique({where:{id:`external:${id}`}}),lease=row?.metrics as any;
   if(lease?.runId!==body.runId)throw new ConflictException('Unknown lease');
   if(row?.status==='COMPLETED'){if(lease.reportHash!==reportHash)throw new ConflictException('Result changed');return lease.result;}
   if(row?.status!=='LEASED'||Date.parse(lease.expiresAt)<=Date.now())throw new ConflictException('Lease expired');
   await this.allowed(id);
   const report=body.report;
   if(report&&id==='gazette'){
    if(report.sourceId!=='gazette'||report.date!==lease.date||report.networkProvenance!=='LIVE_HTTPS'||!Array.isArray(report.documents)||report.documents.length>2||!Array.isArray(report.indexes)||report.indexes.length>2||!Array.isArray(report.unchangedDocuments)||report.unchangedDocuments.length>2||!report.transport||auth.canonical(report).length>7*1024*1024)throw new BadRequestException('Invalid Gazette result');
    if(report.documents.length+report.unchangedDocuments.length>2)throw new BadRequestException('Document batch budget');
    if(lease.transport?.forceReparse&&report.unchangedDocuments.length)throw new BadRequestException('Policy revalidation requires source read');
    const root=`https://www.resmigazete.gov.tr/eskiler/${lease.date.slice(0,4)}/${lease.date.slice(5,7)}/${lease.date.replaceAll('-','')}.htm`;
    if(report.indexes[0]?.url!==root)throw new BadRequestException('Dated official index required');
    const observed=new Set<string>();
    for(const [i,index]of report.indexes.entries()){if(i&&!observed.has(index.url))throw new BadRequestException('Unobserved index');observed.add(index.url);for(const link of index.manifest?.links||[])observed.add(link.url);}
    for(const document of report.documents){
     const p=new URL(gazetteUrl(document.url)).pathname;
     if(!new RegExp('^/(?:eskiler|ilanlar/eskiilanlar)/'+lease.date.slice(0,4)+'/'+lease.date.slice(5,7)+'/'+lease.date.replaceAll('-','')+'(?:[-_]\\d+)*\\.(pdf|html?)$','i').test(p))throw new BadRequestException('Document publication date mismatch');
     const proof=document.discovery;
     if(proof){if(!observed.has(proof.parentUrl)||!Array.isArray(proof.links)||proof.links.length>1000||!/^[a-f0-9]{64}$/.test(proof.parentSha256||'')||!proof.links.some((l:any)=>l.url===document.url))throw new BadRequestException('Invalid HTML fallback proof');gazetteUrl(proof.parentUrl);}
     if(!observed.has(document.url)&&!proof)throw new BadRequestException('Unobserved document');
    }
    for(const d of report.unchangedDocuments){gazetteUrl(d.url);const old=lease.transport?.documents?.[d.url];if(d.parsedAgain!==false||old?.parseStatus!=='PARSED'||old.sha256!==d.sha256)throw new BadRequestException('Unproven unchanged document');}
    // A 304 cannot invent a new validator, parsed row or manifest.
    const known=lease.transport?.documents||{},evidence=new Map([...report.indexes,...report.documents].map((d:any)=>[d.url,d.sha256]));
    for(const d of report.documents)if(d.discovery)evidence.set(d.discovery.parentUrl,d.discovery.parentSha256);
    if(Object.keys(report.transport.documents||{}).length>512)throw new BadRequestException('State budget');
    for(const [url,r] of Object.entries(report.transport.documents||{}) as [string,any][]){gazetteUrl(url);if(r.url!==url||!/^[a-f0-9]{64}$/.test(r.sha256||'')||!evidence.has(url)&&known[url]?.sha256!==r.sha256)throw new BadRequestException('Unproven document state');}
    const moreDocuments=report.transport.pendingDocumentDate===lease.date;
    let pendingDates=moreDocuments?lease.pendingDates:lease.pendingDates.slice(1);
    const lastCoveredDate=moreDocuments?lease.transport.lastCoveredDate:lease.transport.lastCoveredDate>lease.date?lease.transport.lastCoveredDate:lease.date;
    if(!pendingDates.length&&lastCoveredDate<todayDay()){for(let day=dayAfter(lastCoveredDate);day<=todayDay()&&pendingDates.length<5;day=dayAfter(day))pendingDates.push(day);}
    report.transport={...report.transport,policyFingerprint:lease.transport.policyFingerprint,forceReparse:false,pendingDates,...(lastCoveredDate?{lastCoveredDate}:{})};
   }
   if(report&&id==='career'){
    if(report.sourceId!=='career'||report.networkProvenance!=='LIVE_HTTPS'||!Array.isArray(report.rows)||report.rows.length>1000||!Array.isArray(report.unresolved)||report.unresolved.length||!/^[a-f0-9]{64}$/.test(report.documentSha256||'')||auth.canonical(report).length>7*1024*1024)throw new BadRequestException('Invalid career snapshot');
    const known=lease.transport?.knownGuids||[];
    if(report.rows.some((r:any)=>r.detailEvidence&&!lease.detailEnabled))throw new BadRequestException('Detail access not approved');
    if(report.notModified===true){if(lease.transport?.forceReparse||report.documentSha256!==lease.transport?.documentSha256||report.rows.some((r:any)=>!lease.detailEnabled||!known.includes(r.guidHash)))throw new BadRequestException('Unproven conditional RSS');report.missingGuids=[];}
    else {if(report.liveFetch!==true)throw new BadRequestException('Live RSS evidence required');const current=report.rows.map((r:any)=>r.guidHash);report.missingGuids=known.filter((h:string)=>!current.includes(h));}
    report.transport={...report.transport,knownGuids:report.notModified?known:report.rows.map((r:any)=>r.guidHash),documentSha256:report.documentSha256,policyFingerprint:lease.transport.policyFingerprint,forceReparse:false};report.downloaded=report.notModified!==true;
   }
   const result=await this.operations.run(id,async()=>{if(body.errorCode)throw Error(body.errorCode);return report;},{mode:'scheduled',externalRunId:body.runId,transaction:tx});
   // Do not consume a lease on BUSY/NOT_DUE; no publication success is claimed.
   if(!['OK','ERROR'].includes(result.status))return result;
   const receipt={sourceId:id,runId:body.runId,reportHash,...result};
   if(lease.requestId)await tx.sourceSyncState.updateMany({where:{id:`request:${id}`,status:'REQUESTED',metrics:{path:['requestId'],equals:lease.requestId}},data:{status:result.status==='OK'?'COMPLETED':'FAILED'}});
   const {transport,source,detailRows,...leaseProof}=lease;
   await tx.sourceSyncState.update({where:{id:row!.id},data:{status:'COMPLETED',metrics:{...leaseProof,reportHash,result:receipt}}});
   await tx.reviewAudit.create({data:{batchId:`external:${id}`,actor:'source-ingest',action:JSON.stringify({event:'EXTERNAL_SOURCE_COMPLETED',runId:body.runId,reportHash,status:result.status}),count:(result as any).created||0}});
   return receipt;
  },{timeout:95000,maxWait:5000});
 }
}
@Controller('source-ingest/:sourceId')
export class SourceIngestController {
 constructor(private ingest:SourceIngest){}
 private authorize(req:any,body:any,action:string,id:string){
  if(!['career','gazette'].includes(id))throw new ForbiddenException('Unsupported source');
  if(process.env.SOURCE_REMOTE_INGEST_ENABLED!=='true'||process.env.SOURCE_AUTOMATION_APPROVED!=='true')throw new ServiceUnavailableException('Source ingest disabled');
  if(process.env.NODE_ENV==='production'&&(!req.secure||req.get('host')!==new URL(process.env.SOURCE_INGEST_ORIGIN||'').host))throw new UnauthorizedException('Source ingest denied');
  if(!auth.verify(process.env.SOURCE_INGEST_HMAC_KEY,process.env.SOURCE_INGEST_ORIGIN,'/api/v1/source-ingest/'+id+'/'+action,body,req.headers))throw new UnauthorizedException('Source ingest denied');
 }
 @Post('claim')async claim(@Req() req:any,@Body() body:any,@Param('sourceId') id:string){this.authorize(req,body,'claim',id);return this.ingest.claim(body,id);}
 @Post('complete')async complete(@Req() req:any,@Body() body:any,@Param('sourceId') id:string){this.authorize(req,body,'complete',id);return this.ingest.complete(body,id);}
}
