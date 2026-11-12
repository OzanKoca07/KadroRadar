import {Controller,Get,Post,Param,Req,Body,Injectable,ForbiddenException,OnModuleDestroy,OnModuleInit} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {CandidateAuth} from './candidate';
import {AnnouncementAdminController,IngestionDb} from './announcement-admin';
import {resolve} from 'node:path';
import {mkdir,readFile,writeFile,stat,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,basename} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {runsWorker} from './process-role';
import {adapterStatus} from './source-adapter-contract';
import {automaticIndexingAllowed,indexingAssessment} from './source-indexing-policy';
import {scanIntervalHours,sourceScanIntervalHours,ScanMode,nextScanAt} from './announcement-scan';
import {SourceRightsStore,sourceRights} from './source-rights';
import {stageCareerSnapshot} from './career-staging';
import {stageCareerNotices,listCareerNotices,reviewCareerNotice} from './career-notices';
import {stageGazetteSnapshot} from './gazette-staging';
const registry=require(resolve(__dirname,'../../../packages/official-sources.json'));
function effectiveRights(source:any,override?:any){const status=sourceRights(source,override);return source?.id==='gazette'&&status==='LICENSE_VERIFIED'&&override&&!override.evidence?.scopes?.includes('AUTOMATED_GAZETTE_DOCUMENT_ACCESS')?'REVIEW_REQUIRED':status;}
export function sourceAllowed(source:any){return automaticIndexingAllowed(source)&&(source.id==='gazette'?source.rightsAssessment?.evidence?.scopes?.includes('AUTOMATED_GAZETTE_DOCUMENT_ACCESS'):source.format==='rss');}
export function sourceAutomationBlocked(env=process.env){return env.SOURCE_AUTOMATION_APPROVED==='false'||env.NODE_ENV==='production'&&env.SOURCE_AUTOMATION_APPROVED!=='true';}
export function backoff(failures:number){return Math.min(86400000,60000*2**Math.min(11,Math.max(0,failures-1)));}
@Injectable()
export class SourceOperations implements OnModuleInit,OnModuleDestroy{
 private timer?:NodeJS.Timeout;
 readonly rights:SourceRightsStore;
 constructor(private db:IngestionDb,private auth:CandidateAuth){this.rights=new SourceRightsStore(db);}
 onModuleInit(){if(!sourceAutomationBlocked()&&process.env.SOURCE_SYNC_ENABLED==='true'&&process.env.SOURCE_WORKER_ONCE!=='true'&&runsWorker('source')){this.timer=setInterval(()=>{void this.tick().catch(()=>console.error(JSON.stringify({event:'source_sync_failed'})));},60000);if(process.env.PROCESS_ROLE==='combined')this.timer.unref();}}
 onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
 async requestRun(id:string,actor:string){
  if(sourceAutomationBlocked())throw new ForbiddenException('Source automation not approved');
  if(!Object.hasOwn(registry,id)||!sourceAllowed(registry[id])||effectiveRights(registry[id],await this.rights.current(id))!=='LICENSE_VERIFIED')throw new ForbiddenException('Source disabled or permission unverified');
  return this.db.$transaction(async tx=>{await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'source-request:'+id}))`;const key='request:'+id,old=await tx.sourceSyncState.findUnique({where:{id:key}});if(old?.status==='REQUESTED')return {status:'QUEUED',requestId:(old.metrics as any)?.requestId};const requestId=randomUUID(),metrics={requestId,requestedAt:new Date().toISOString()};await tx.sourceSyncState.upsert({where:{id:key},create:{id:key,status:'REQUESTED',metrics},update:{status:'REQUESTED',metrics}});await tx.reviewAudit.create({data:{batchId:key,actor,action:JSON.stringify({event:'SOURCE_RUN_REQUESTED',requestId}),count:1}});return {status:'QUEUED',requestId};});
 }
 async tick(mode:ScanMode='scheduled'){
  if(sourceAutomationBlocked())return [];
  const results:any[]=[];
  for(const id of Object.keys(registry))if(sourceAllowed(registry[id])&&effectiveRights(registry[id],await this.rights.current(id))==='LICENSE_VERIFIED'){
   const request=await this.db.sourceSyncState.findUnique({where:{id:'request:'+id}});
   try{const result=await this.run(id,undefined,{mode:request?.status==='REQUESTED'?'manual':mode});results.push({sourceId:id,...result});if(request?.status==='REQUESTED'&&['OK','ERROR'].includes(result.status))await this.db.sourceSyncState.updateMany({where:{id:request.id,status:'REQUESTED',metrics:{path:['requestId'],equals:(request.metrics as any).requestId}},data:{status:result.status==='OK'?'COMPLETED':'FAILED'}});}
   catch{console.error(JSON.stringify({event:'source_dispatch_rejected',sourceId:id}));results.push({sourceId:id,status:'ERROR',errorCode:'DISPATCH_REJECTED'});}
  }
  return results;
 }
 async run(id:string,adapter?:()=>Promise<any>,context:{mode?:ScanMode;now?:()=>Date;externalRunId?:string;transaction?:Prisma.TransactionClient}={}){
  if(sourceAutomationBlocked())throw new ForbiddenException('Source automation not approved');
  if(!/^[a-z]+$/.test(id)||!sourceAllowed(registry[id]))throw new ForbiddenException('Source disabled or permission unverified');
  if(!['energy','career','gazette'].includes(id))throw new ForbiddenException('No supported adapter');
  if(id==='gazette'&&!adapter&&process.env.DOCUMENT_UPLOADS_ENABLED!=='true')throw new ForbiddenException('Gazette downloads require explicit private document processing');
  if(effectiveRights(registry[id],await this.rights.current(id))!=='LICENSE_VERIFIED')throw new ForbiddenException('Source rights revoked or unverified');
  const work=async(lock:Prisma.TransactionClient)=>{
   const rightsValid=async()=>{
    if(id!=='gazette')return await this.rights.status(registry[id])==='LICENSE_VERIFIED';
    const policy=await lock.sourceSyncState.findUnique({where:{id:'policy:'+id}}),override=(policy?.metrics as any)?.assessment;
    return sourceAllowed(registry[id])&&sourceRights(registry[id],override)==='LICENSE_VERIFIED'&&(!override||override.evidence?.scopes?.includes('AUTOMATED_GAZETTE_DOCUMENT_ACCESS'));
   };
   const rows=await lock.$queryRaw<Array<{locked:boolean}>>`SELECT pg_try_advisory_xact_lock(hashtext(${`source-sync:${id}`})) AS locked`;
   if(!rows[0].locked)return {status:'BUSY'};
   const external=await lock.sourceSyncState.findUnique({where:{id:'external:'+id}}),lease=external?.metrics as any;
   if(external?.status==='LEASED'&&Date.parse(lease?.expiresAt)>Date.now()&&lease.runId!==context.externalRunId)return {status:'BUSY'};
   const claimed=external?.status==='LEASED'&&Date.parse(lease?.expiresAt)>Date.now()&&lease.runId===context.externalRunId;
   if(id==='gazette')await lock.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtext(${`source-policy:${id}`}))`;
   const state=await lock.sourceSyncState.findUnique({where:{id}}),now=context.now?.()||new Date(),mode=context.mode||'scheduled';
   if(!['manual','scheduled'].includes(mode))throw new ForbiddenException('Invalid scan mode');
   const previous=(state?.metrics&&typeof state.metrics==='object'&&!Array.isArray(state.metrics)?state.metrics:{}) as Record<string,any>;
   if(!claimed&&state?.consecutiveFailures&&state.nextAttemptAt&&state.nextAttemptAt>now)return {status:'BACKOFF',nextAttemptAt:state.nextAttemptAt};
   const backlog=id==='gazette'&&Array.isArray(previous.transport?.pendingDates)&&previous.transport.pendingDates.length>0;
   const due=backlog?state?.nextAttemptAt:nextScanAt(state?.lastSuccessAt,indexingAssessment(registry[id]).minIntervalSeconds,sourceScanIntervalHours(registry[id]));
   if(!claimed&&due&&due>now)return {status:'NOT_DUE',nextAttemptAt:due};
   await lock.sourceSyncState.upsert({where:{id},create:{id,lastAttemptAt:now,status:'RUNNING'},update:{lastAttemptAt:now,status:'RUNNING'}});
   let staged=false;
   try{
    if(!await rightsValid())throw Error('SOURCE_PERMISSION_CHANGED');
    const output=await (adapter?adapter():id==='gazette'?this.fetchGazette(previous.transport,now):id==='career'?this.fetchCareer(previous.transport):this.fetchEnergy(previous.transport)),records=id==='gazette'?[]:Array.isArray(output)?output:output.rows;
    if(!Array.isArray(records))throw Error('INVALID_ADAPTER_CONTRACT');
    if(!await rightsValid())throw Error('SOURCE_PERMISSION_CHANGED');
    if(['career','gazette'].includes(id)){await lock.$executeRaw`SAVEPOINT source_batch`;staged=true;}
    let counts:{created:number;changed:number;duplicate:number;missingReview?:number;notices?:any}={created:0,changed:0,duplicate:0};
    const ingest=new AnnouncementAdminController(this.db,this.auth);
    if(id==='career'){const result=await stageCareerSnapshot(this.db,{...output,sourceId:'career',rows:records,unresolved:output.unresolved??[],documentSha256:output.documentSha256},'source-scheduler:career',{automatic:true,transaction:lock});counts={...result,notices:await stageCareerNotices(this.db,output,'source-scheduler:career',true,lock)};}
    if(id==='gazette'){
     await lock.$executeRaw`SAVEPOINT gazette_stage`;
     try{const result=await stageGazetteSnapshot(lock,output,previous.transport?.snapshot??{},'source-scheduler:gazette');if(!await rightsValid())throw Error('SOURCE_PERMISSION_CHANGED');counts={...result};delete (counts as any).snapshot;output.transport={...output.transport,snapshot:result.snapshot};await lock.$executeRaw`RELEASE SAVEPOINT gazette_stage`;}
     catch(error){await lock.$executeRaw`ROLLBACK TO SAVEPOINT gazette_stage`;throw error;}
    }
    for(let offset=0;!['career','gazette'].includes(id)&&offset<records.length;offset+=100){if(await this.rights.status(registry[id])!=='LICENSE_VERIFIED')throw Error('SOURCE_PERMISSION_CHANGED');const result=await ingest.stageRecords({rows:records.slice(offset,offset+100)},'source-scheduler:'+id);for(const key of ['created','changed','duplicate'] as const)counts[key]+=result[key];}
    if(!await rightsValid())throw Error('SOURCE_PERMISSION_CHANGED');
    let sourceReviewCreated=false;
    if(!Array.isArray(output)&&(output.unresolved?.length||id==='career'&&output.downloaded)){
     if(!/^[a-f0-9]{64}$/.test(output.documentSha256||''))throw Error('INVALID_SOURCE_HASH');
     const existing=await lock.sourceDocument.findUnique({where:{sha256:output.documentSha256}});
     if(!existing){await lock.sourceDocument.create({data:{sha256:output.documentSha256,originalUrl:registry[id].feed,originalFilename:id+'-rss-reference',sourceOrganization:registry[id].organization,state:'OFFICIAL_FEED_REVIEW',gazetteEvidence:{mode:context.externalRunId?'SIGNED_EXTERNAL_REPORT':adapter?'SYNTHETIC_ADAPTER':'LIVE_RSS_INDEX',liveFetch:context.externalRunId?output.liveFetch===true:!adapter,rawRetained:false,documentSha256:output.documentSha256,itemCount:output.itemCount??null,sourceId:id,rows:id==='career'?records:[],missingGuids:output.missingGuids??[],unresolved:output.unresolved??[]}}});sourceReviewCreated=true;}
    }
    const completed=context.now?.()||new Date(),receipt={at:completed.toISOString(),mode,provenance:id==='gazette'?(output.networkProvenance==='LIVE_HTTPS'?'LIVE_GAZETTE_REVIEW':'MOCK_GAZETTE_REVIEW'):context.externalRunId?'SIGNED_EXTERNAL_REPORT':adapter?'SYNTHETIC_ADAPTER':'LIVE_RSS_INDEX',...counts,sourceReviewCreated,documentSha256:output.documentSha256??null,downloaded:output.downloaded??false,unresolvedCount:output.unresolved?.length??0,detailMetrics:output.detailMetrics??null,transferMetrics:Object.fromEntries(['downloadBytes','pdfDownloads','htmlDownloads','notModified','ramDocuments','tempDocuments','persistentDocumentBytes'].filter(k=>Number.isSafeInteger(output.metrics?.[k])&&output.metrics[k]>=0&&output.metrics[k]<=1000000000).map(k=>[k,output.metrics[k]])),...(id==='gazette'?{issueDate:output.date,complete:output.complete===true,reviewIssues:output.issues??[],pendingDates:output.transport?.pendingDates??[]}:{})};
    const history=Array.isArray(previous.receipts)?previous.receipts.slice(-9):[];
    const pending=id==='gazette'&&Array.isArray(output.transport?.pendingDates)&&output.transport.pendingDates.length>0;
    await lock.sourceSyncState.update({where:{id},data:{lastSuccessAt:completed,nextAttemptAt:pending?new Date(completed.getTime()+indexingAssessment(registry[id]).minIntervalSeconds*1000):nextScanAt(completed,indexingAssessment(registry[id]).minIntervalSeconds,sourceScanIntervalHours(registry[id])),consecutiveFailures:0,errorCode:null,status:'OK',metrics:{...counts,sourceReviewCreated,transport:output.transport??previous.transport??null,successfulRuns:Number(previous.successfulRuns||0)+1,failedRuns:Number(previous.failedRuns||0),lastReceipt:receipt,receipts:[...history,receipt]}}});
    const alert=await lock.sourceSyncState.findUnique({where:{id:'alert:'+id}});if(alert?.status==='OPEN')await lock.sourceSyncState.update({where:{id:alert.id},data:{status:'RESOLVED'}});
    if(staged){await lock.$executeRaw`RELEASE SAVEPOINT source_batch`;staged=false;}
    return {status:'OK',...counts};
   }catch(error:any){if(staged)await lock.$executeRaw`ROLLBACK TO SAVEPOINT source_batch`;const failures=(state?.consecutiveFailures??0)+1;const code=['DNS','TLS','TIMEOUT','FORBIDDEN','RATE_LIMITED','REDIRECT','HTTP_ERROR','NETWORK','ROBOTS_DISALLOWED','ROBOTS_RATE_REQUIRES_REVIEW','ACCESS_REVIEW_REQUIRED','PARSE_OR_VALIDATION','INVALID_ADAPTER_CONTRACT','INVALID_SOURCE_HASH','ADAPTER_FAILURE','SOURCE_PERMISSION_CHANGED','INCOMPLETE_FEED_REVIEW_REQUIRED','CONFLICTING_GUID','UNSAFE_XML','RSS2_REQUIRED'].includes(error?.message)?error.message:'ADAPTER_OR_STAGING_ERROR';const failed=context.now?.()||new Date();await lock.sourceSyncState.update({where:{id},data:{status:'ERROR',errorCode:code,consecutiveFailures:failures,nextAttemptAt:new Date(failed.getTime()+Math.max(backoff(failures),indexingAssessment(registry[id]).minIntervalSeconds*1000,code==='RATE_LIMITED'&&Number.isInteger(error.retryAfterSeconds)&&error.retryAfterSeconds>=0&&error.retryAfterSeconds<=366*86400?error.retryAfterSeconds*1000:0)),metrics:{...previous,successfulRuns:Number(previous.successfulRuns||0),failedRuns:Number(previous.failedRuns||0)+1,lastFailure:{at:failed.toISOString(),mode,errorCode:code}}}});const alert=await lock.sourceSyncState.findUnique({where:{id:'alert:'+id}});if(alert?.status!=='OPEN'){await lock.sourceSyncState.upsert({where:{id:'alert:'+id},create:{id:'alert:'+id,status:'OPEN',metrics:{errorCode:code,openedAt:failed.toISOString()}},update:{status:'OPEN',metrics:{errorCode:code,openedAt:failed.toISOString()}}});console.error(JSON.stringify({event:'source_failure_alert_opened',sourceId:id,errorCode:code}));}console.error(JSON.stringify({event:'source_sync_error',sourceId:id,errorCode:code,consecutiveFailures:failures}));return {status:'ERROR',errorCode:code};}
  };
  return context.transaction?work(context.transaction):this.db.$transaction(work,{timeout:90000,maxWait:5000});
 }
 private async fetchEnergy(transport?:any){const dir=resolve(process.env.SOURCE_STATE_DIR||resolve(__dirname,'../../../.local/sources'));await mkdir(dir,{recursive:true,mode:0o700});const path=resolve(dir,'energy.json');
  if(transport&&typeof transport==='object'){const safeHeader=(v:any)=>typeof v==='string'&&v.length<=1024&&!/[\r\n]/.test(v)?v:null;await writeFile(path,JSON.stringify({rows:{},unresolved:[],etag:safeHeader(transport.etag),lastModified:safeHeader(transport.lastModified),documentSha256:/^[a-f0-9]{64}$/.test(transport.documentSha256||'')?transport.documentSha256:null,itemCount:Number.isSafeInteger(transport.itemCount)?transport.itemCount:0}),{mode:0o600});}
  const result:any=await new Promise((yes,no)=>execFile(process.env.INGEST_PYTHON||'python',[resolve(__dirname,'../../../services/ingest/official_rss.py'),'--output',path],{timeout:35000,maxBuffer:1024*1024,windowsHide:true},(error,stdout)=>{if(error){try{return no(Error(JSON.parse(stdout).status));}catch{return no(Error('ADAPTER_FAILURE'));}}try{yes(JSON.parse(stdout));}catch{no(Error('INVALID_ADAPTER_CONTRACT'));}}));
  const state=JSON.parse(await readFile(path,'utf-8'));return {rows:result.notModified?[]:Object.values(state.rows||{}),unresolved:result.notModified?[]:state.unresolved||[],documentSha256:state.documentSha256,itemCount:state.itemCount,downloaded:!result.notModified,transport:{etag:state.etag??null,lastModified:state.lastModified??null,documentSha256:state.documentSha256??null,itemCount:state.itemCount??0}};
 }
 private async fetchCareer(transport?:any){
  const dir=resolve(process.env.SOURCE_STATE_DIR||resolve(__dirname,'../../../.local/sources'));await mkdir(dir,{recursive:true,mode:0o700});const path=resolve(dir,'career.json');
  const detailPolicy=await this.rights.current('career');const detailEnabled=process.env.CAREER_DETAIL_ENRICHMENT_ENABLED==='true'&&registry.career.rightsAssessment?.evidence?.scopes?.includes('AUTOMATED_CAREER_DETAIL_ACCESS')&&(!detailPolicy||detailPolicy.evidence?.scopes?.includes('AUTOMATED_CAREER_DETAIL_ACCESS'));
  // DB metrics are authoritative; never reuse uncommitted validators after a failed staging run.
  const safe=(v:any)=>typeof v==='string'&&v.length<=1024&&!/[\r\n]/.test(v)?v:null;
  const state={transport:{detailCursor:Number.isInteger(transport?.detailCursor)&&transport.detailCursor>=0&&transport.detailCursor<1000?transport.detailCursor:0,etag:safe(transport?.etag),lastModified:safe(transport?.lastModified),documentSha256:/^[a-f0-9]{64}$/.test(transport?.documentSha256||'')?transport.documentSha256:null,knownGuids:Array.isArray(transport?.knownGuids)?transport.knownGuids.filter((v:any)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)).slice(0,1000):[]}};
  if(detailEnabled){const rows=await this.db.announcementImportRow.findMany({where:{id:{in:state.transport.knownGuids.map((hash:string)=>'career-rss-'+hash)}},take:1000,orderBy:{id:'asc'},select:{raw:true}});(state as any).detailRows=rows.map(r=>{const {processing,metadataPublication,...raw}=r.raw as any;return raw;});}
  await writeFile(path,JSON.stringify(state),{mode:0o600});
  const result:any=await new Promise((yes,no)=>execFile(process.env.INGEST_PYTHON||'python',[resolve(__dirname,'../../../services/ingest/career_rss.py'),'--output',path],{timeout:35000,maxBuffer:8*1024*1024,windowsHide:true,env:{...process.env,CAREER_DETAIL_ENRICHMENT_ENABLED:detailEnabled?'true':'false'}},(error,stdout)=>{try{const value=JSON.parse(stdout);error?no(Object.assign(Error(value.status||'ADAPTER_FAILURE'),{retryAfterSeconds:Number.isInteger(value.retryAfterSeconds)&&value.retryAfterSeconds>=0&&value.retryAfterSeconds<=366*86400?value.retryAfterSeconds:0})):yes(value);}catch{no(Error('INVALID_ADAPTER_CONTRACT'));}}));
  return {...result,documentSha256:result.documentSha256??state.transport.documentSha256,downloaded:result.notModified!==true};
 }
 private async fetchGazette(transport:any,now:Date){
  const workspace=await mkdtemp(resolve(tmpdir(),'kadroradar-source-local-'));
  const state=resolve(workspace,'state.json'),output=resolve(workspace,'report.json');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const days=Math.min(5,Math.ceil(sourceScanIntervalHours(registry.gazette)/24)+1);
  const pending=Array.isArray(transport?.pendingDates)&&transport.pendingDates.length?transport.pendingDates:Array.from({length:days},(_,i)=>new Date(Date.parse(today+'T00:00:00Z')-(days-1-i)*86400000).toISOString().slice(0,10));
  try{
   if(pending.length>5||pending.some((date:any)=>typeof date!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||date>today))throw Error('INVALID_ADAPTER_CONTRACT');
   const day=pending[0];await writeFile(state,JSON.stringify(transport||{}),{mode:0o600});
   await new Promise((yes,no)=>execFile(process.env.INGEST_PYTHON||'python',[resolve(__dirname,'../../../services/ingest/gazette_ephemeral.py'),'--date',day,'--state',state,'--output',output],{timeout:120000,maxBuffer:65536,windowsHide:true,env:{...process.env,TMPDIR:workspace,TEMP:workspace,TMP:workspace}},(error,stdout)=>{
    try{const value=JSON.parse(stdout);if(error||value.status!=='OK'){const codes:Record<string,string>={DNS_ERROR:'DNS',TLS_ERROR:'TLS',TIMEOUT:'TIMEOUT',FORBIDDEN:'FORBIDDEN',RATE_LIMITED:'RATE_LIMITED',REDIRECT:'REDIRECT',NETWORK_ERROR:'NETWORK'};return no(Error(codes[value.code]||'PARSE_OR_VALIDATION'));}yes(value);}catch{no(Error(error?'TIMEOUT':'INVALID_ADAPTER_CONTRACT'));}
   }));
   if((await stat(output)).size>7*1024*1024)throw Error('INVALID_ADAPTER_CONTRACT');
   const report=JSON.parse(await readFile(output,'utf8'));
   if(report.sourceId!=='gazette'||report.date!==day||!Array.isArray(report.documents)||report.documents.length>2||!Array.isArray(report.indexes)||report.indexes.length>2)throw Error('INVALID_ADAPTER_CONTRACT');
   report.transport={...report.transport,pendingDates:report.transport?.pendingDocumentDate===day?pending:pending.slice(1)};return report;
  }finally{if(dirname(resolve(workspace))!==resolve(tmpdir())||!basename(workspace).startsWith('kadroradar-source-local-'))throw Error('INVALID_ADAPTER_CONTRACT');await rm(workspace,{recursive:true,force:true});}
 }
 async notices(){return listCareerNotices(this.db);}
 async reviewNotice(id:string,body:any,actor:string){return reviewCareerNotice(this.db,id,body,actor);}
 async health(){const states=await this.db.sourceSyncState.findMany();return {externalIngestEnabled:process.env.SOURCE_REMOTE_INGEST_ENABLED==='true',scanIntervalHours:scanIntervalHours(),processRole:process.env.PROCESS_ROLE||'api',sourceWorkerEnabled:process.env.SOURCE_SYNC_ENABLED==='true'&&runsWorker('source'),notificationWorkerEnabled:process.env.NOTIFICATIONS_ENABLED==='true'&&runsWorker('push'),sources:Object.entries(registry).map(([id,source]:[string,any])=>{const override=(states.find(state=>state.id==='policy:'+id)?.metrics as any)?.assessment;const rightsStatus=effectiveRights(source,override);const external=states.find(s=>s.id==='external:'+id),lease=external?.metrics as any;return {id,externalLease:external?{status:external.status==='LEASED'&&Date.parse(lease?.expiresAt)<=Date.now()?'EXPIRED':external.status,runId:lease?.runId,expiresAt:lease?.expiresAt,result:lease?.result}:null,...adapterStatus(source),rightsStatus,status:rightsStatus==='RESTRICTED'?'DISABLED':rightsStatus!=='LICENSE_VERIFIED'?'REVIEW_REQUIRED':adapterStatus(source).status,policyReview:override??null,scanIntervalHours:sourceScanIntervalHours(source),enabled:sourceAllowed(source)&&rightsStatus==='LICENSE_VERIFIED',automationPermission:source.automationPermission,republicationPermission:source.republicationPermission,runRequest:states.find(state=>state.id==='request:'+id)??null,alert:states.find(state=>state.id==='alert:'+id)??null,state:states.find(state=>state.id===id)??null};})};}
}
@Controller('admin/source-operations')
export class SourceOperationsController{
 constructor(private operations:SourceOperations,private auth:CandidateAuth){}
 @Get()async health(@Req() req:any){await this.auth.role(req,['SYSTEM_ADMIN','REVIEWER','CONTENT_EDITOR']);return this.operations.health();}
 @Get('career/notices')async notices(@Req() req:any){await this.auth.role(req,['SYSTEM_ADMIN','REVIEWER','CONTENT_EDITOR']);return this.operations.notices();}
 @Post('career/notices/:noticeId/review')async noticeReview(@Param('noticeId') id:string,@Req() req:any,@Body() body:any){const actor=await this.auth.role(req,['SYSTEM_ADMIN','REVIEWER'],true);return this.operations.reviewNotice(id,body,actor.id);}
 @Get(':id/policy')async policy(@Param('id') id:string,@Req() req:any){await this.auth.role(req,['SYSTEM_ADMIN','REVIEWER']);if(!Object.hasOwn(registry,id))throw new ForbiddenException();return {registry:registry[id].rightsAssessment,current:await this.operations.rights.current(id),history:await this.operations.rights.history(id)};}
 @Post(':id/policy')async reviewPolicy(@Param('id') id:string,@Req() req:any,@Body() body:any){const actor=await this.auth.role(req,['SYSTEM_ADMIN'],true);if(!Object.hasOwn(registry,id))throw new ForbiddenException();return this.operations.rights.review(registry[id],body,actor.id);}
 @Post(':id/run')async run(@Param('id') id:string,@Req() req:any){const actor=await this.auth.role(req,['SYSTEM_ADMIN'],true);return this.operations.requestRun(id,actor.id);}
}
