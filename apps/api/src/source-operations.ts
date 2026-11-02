import {Controller,Get,Post,Param,Req,Body,Injectable,ForbiddenException,OnModuleDestroy,OnModuleInit} from '@nestjs/common';
import {CandidateAuth} from './candidate';
import {AnnouncementAdminController,IngestionDb} from './announcement-admin';
import {resolve} from 'node:path';
import {mkdir,readFile,writeFile,readdir,stat,unlink} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {runsWorker} from './process-role';
import {adapterStatus} from './source-adapter-contract';
import {automaticIndexingAllowed,indexingAssessment} from './source-indexing-policy';
import {scanIntervalHours,sourceScanIntervalHours,ScanMode,nextScanAt} from './announcement-scan';
import {SourceRightsStore,sourceRights} from './source-rights';
import {stageCareerSnapshot} from './career-staging';
import {stageGazetteSnapshot} from './gazette-staging';
const registry=require(resolve(__dirname,'../../../packages/official-sources.json'));
function effectiveRights(source:any,override?:any){const status=sourceRights(source,override);return source?.id==='gazette'&&status==='LICENSE_VERIFIED'&&override&&!override.evidence?.scopes?.includes('AUTOMATED_GAZETTE_DOCUMENT_ACCESS')?'REVIEW_REQUIRED':status;}
export function sourceAllowed(source:any){return automaticIndexingAllowed(source)&&(source.id==='gazette'?source.rightsAssessment?.evidence?.scopes?.includes('AUTOMATED_GAZETTE_DOCUMENT_ACCESS'):source.format==='rss');}
export function backoff(failures:number){return Math.min(86400000,60000*2**Math.min(11,Math.max(0,failures-1)));}
@Injectable()
export class SourceOperations implements OnModuleInit,OnModuleDestroy{
 private timer?:NodeJS.Timeout;
 readonly rights:SourceRightsStore;
 constructor(private db:IngestionDb,private auth:CandidateAuth){this.rights=new SourceRightsStore(db);}
 onModuleInit(){if(process.env.SOURCE_SYNC_ENABLED==='true'&&process.env.SOURCE_WORKER_ONCE!=='true'&&runsWorker('source')){this.timer=setInterval(()=>{void this.tick().catch(()=>console.error(JSON.stringify({event:'source_sync_failed'})));},60000);if(process.env.PROCESS_ROLE==='combined')this.timer.unref();}}
 onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
 async tick(mode:ScanMode='scheduled'){const results:any[]=[];for(const id of Object.keys(registry))if(sourceAllowed(registry[id])&&effectiveRights(registry[id],await this.rights.current(id))==='LICENSE_VERIFIED'){try{results.push({sourceId:id,...await this.run(id,undefined,{mode})});}catch{console.error(JSON.stringify({event:'source_dispatch_rejected',sourceId:id}));results.push({sourceId:id,status:'ERROR',errorCode:'DISPATCH_REJECTED'});}}return results;}
 async run(id:string,adapter?:()=>Promise<any>,context:{mode?:ScanMode;now?:()=>Date}={}){
  if(!/^[a-z]+$/.test(id)||!sourceAllowed(registry[id]))throw new ForbiddenException('Source disabled or permission unverified');
  if(!['energy','career','gazette'].includes(id))throw new ForbiddenException('No supported adapter');
  if(id==='gazette'&&!adapter&&process.env.DOCUMENT_UPLOADS_ENABLED!=='true')throw new ForbiddenException('Gazette downloads require explicit private document processing');
  if(effectiveRights(registry[id],await this.rights.current(id))!=='LICENSE_VERIFIED')throw new ForbiddenException('Source rights revoked or unverified');
  return this.db.$transaction(async lock=>{
   const rightsValid=async()=>{
    if(id!=='gazette')return await this.rights.status(registry[id])==='LICENSE_VERIFIED';
    const policy=await lock.sourceSyncState.findUnique({where:{id:'policy:'+id}}),override=(policy?.metrics as any)?.assessment;
    return sourceAllowed(registry[id])&&sourceRights(registry[id],override)==='LICENSE_VERIFIED'&&(!override||override.evidence?.scopes?.includes('AUTOMATED_GAZETTE_DOCUMENT_ACCESS'));
   };
   const rows=await lock.$queryRaw<Array<{locked:boolean}>>`SELECT pg_try_advisory_xact_lock(hashtext(${`source-sync:${id}`})) AS locked`;
   if(!rows[0].locked)return {status:'BUSY'};
   if(id==='gazette')await lock.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtext(${`source-policy:${id}`}))`;
   const state=await lock.sourceSyncState.findUnique({where:{id}}),now=context.now?.()||new Date(),mode=context.mode||'scheduled';
   if(!['manual','scheduled'].includes(mode))throw new ForbiddenException('Invalid scan mode');
   const previous=(state?.metrics&&typeof state.metrics==='object'&&!Array.isArray(state.metrics)?state.metrics:{}) as Record<string,any>;
   if(state?.consecutiveFailures&&state.nextAttemptAt&&state.nextAttemptAt>now)return {status:'BACKOFF',nextAttemptAt:state.nextAttemptAt};
   const backlog=id==='gazette'&&Array.isArray(previous.transport?.pendingDates)&&previous.transport.pendingDates.length>0;
   const due=backlog?state?.nextAttemptAt:nextScanAt(state?.lastSuccessAt,indexingAssessment(registry[id]).minIntervalSeconds,sourceScanIntervalHours(registry[id]));
   if(due&&due>now)return {status:'NOT_DUE',nextAttemptAt:due};
   await lock.sourceSyncState.upsert({where:{id},create:{id,lastAttemptAt:now,status:'RUNNING'},update:{lastAttemptAt:now,status:'RUNNING'}});
   try{
    if(!await rightsValid())throw Error('SOURCE_PERMISSION_CHANGED');
    const output=await (adapter?adapter():id==='gazette'?this.fetchGazette(previous.transport,now):id==='career'?this.fetchCareer(previous.transport):this.fetchEnergy(previous.transport)),records=id==='gazette'?[]:Array.isArray(output)?output:output.rows;
    if(!Array.isArray(records))throw Error('INVALID_ADAPTER_CONTRACT');
    if(!await rightsValid())throw Error('SOURCE_PERMISSION_CHANGED');
    let counts:{created:number;changed:number;duplicate:number;missingReview?:number}={created:0,changed:0,duplicate:0};
    const ingest=new AnnouncementAdminController(this.db,this.auth);
    if(id==='career'){const result=await stageCareerSnapshot(this.db,{...output,sourceId:'career',rows:records,unresolved:output.unresolved??[],documentSha256:output.documentSha256},'source-scheduler:career');counts=result;}
    if(id==='gazette'){
     await lock.$executeRaw`SAVEPOINT gazette_stage`;
     try{const result=await stageGazetteSnapshot(lock,output,previous.transport?.snapshot??{},'source-scheduler:gazette');if(!await rightsValid())throw Error('SOURCE_PERMISSION_CHANGED');counts={created:result.created,changed:result.changed,duplicate:result.duplicate,missingReview:result.missingReview};output.transport={...output.transport,snapshot:result.snapshot};await lock.$executeRaw`RELEASE SAVEPOINT gazette_stage`;}
     catch(error){await lock.$executeRaw`ROLLBACK TO SAVEPOINT gazette_stage`;throw error;}
    }
    for(let offset=0;!['career','gazette'].includes(id)&&offset<records.length;offset+=100){if(await this.rights.status(registry[id])!=='LICENSE_VERIFIED')throw Error('SOURCE_PERMISSION_CHANGED');const result=await ingest.stageRecords({rows:records.slice(offset,offset+100)},'source-scheduler:'+id);for(const key of ['created','changed','duplicate'] as const)counts[key]+=result[key];}
    if(!await rightsValid())throw Error('SOURCE_PERMISSION_CHANGED');
    let sourceReviewCreated=false;
    if(!Array.isArray(output)&&(output.unresolved?.length||id==='career'&&output.downloaded)){
     if(!/^[a-f0-9]{64}$/.test(output.documentSha256||''))throw Error('INVALID_SOURCE_HASH');
     const existing=await lock.sourceDocument.findUnique({where:{sha256:output.documentSha256}});
     if(!existing){await lock.sourceDocument.create({data:{sha256:output.documentSha256,originalUrl:registry[id].feed,originalFilename:id+'-rss-reference',sourceOrganization:registry[id].organization,state:'OFFICIAL_FEED_REVIEW',gazetteEvidence:{mode:adapter?'SYNTHETIC_ADAPTER':'LIVE_RSS_INDEX',liveFetch:!adapter,rawRetained:false,documentSha256:output.documentSha256,itemCount:output.itemCount??null,sourceId:id,rows:id==='career'?records:[],missingGuids:output.missingGuids??[],unresolved:output.unresolved??[]}}});sourceReviewCreated=true;}
    }
    const completed=context.now?.()||new Date(),receipt={at:completed.toISOString(),mode,provenance:id==='gazette'?(output.networkProvenance==='LIVE_HTTPS'?'LIVE_GAZETTE_REVIEW':'MOCK_GAZETTE_REVIEW'):adapter?'SYNTHETIC_ADAPTER':'LIVE_RSS_INDEX',...counts,sourceReviewCreated,documentSha256:output.documentSha256??null,downloaded:output.downloaded??false,unresolvedCount:output.unresolved?.length??0,...(id==='gazette'?{issueDate:output.date,complete:output.complete===true,reviewIssues:output.issues??[],pendingDates:output.transport?.pendingDates??[],autoPublished:false}:{})};
    const history=Array.isArray(previous.receipts)?previous.receipts.slice(-9):[];
    const pending=id==='gazette'&&Array.isArray(output.transport?.pendingDates)&&output.transport.pendingDates.length>0;
    await lock.sourceSyncState.update({where:{id},data:{lastSuccessAt:completed,nextAttemptAt:pending?new Date(completed.getTime()+indexingAssessment(registry[id]).minIntervalSeconds*1000):nextScanAt(completed,indexingAssessment(registry[id]).minIntervalSeconds,sourceScanIntervalHours(registry[id])),consecutiveFailures:0,errorCode:null,status:'OK',metrics:{...counts,sourceReviewCreated,transport:output.transport??previous.transport??null,successfulRuns:Number(previous.successfulRuns||0)+1,failedRuns:Number(previous.failedRuns||0),lastReceipt:receipt,receipts:[...history,receipt]}}});
    return {status:'OK',...counts};
   }catch(error:any){const failures=(state?.consecutiveFailures??0)+1;const code=['DNS','TLS','TIMEOUT','FORBIDDEN','RATE_LIMITED','REDIRECT','HTTP_ERROR','NETWORK','ROBOTS_DISALLOWED','ROBOTS_RATE_REQUIRES_REVIEW','ACCESS_REVIEW_REQUIRED','PARSE_OR_VALIDATION','INVALID_ADAPTER_CONTRACT','INVALID_SOURCE_HASH','ADAPTER_FAILURE','SOURCE_PERMISSION_CHANGED','INCOMPLETE_FEED_REVIEW_REQUIRED','CONFLICTING_GUID','UNSAFE_XML','RSS2_REQUIRED'].includes(error?.message)?error.message:'ADAPTER_OR_STAGING_ERROR';const failed=context.now?.()||new Date();await lock.sourceSyncState.update({where:{id},data:{status:'ERROR',errorCode:code,consecutiveFailures:failures,nextAttemptAt:new Date(failed.getTime()+Math.max(backoff(failures),indexingAssessment(registry[id]).minIntervalSeconds*1000)),metrics:{...previous,successfulRuns:Number(previous.successfulRuns||0),failedRuns:Number(previous.failedRuns||0)+1,lastFailure:{at:failed.toISOString(),mode,errorCode:code}}}});console.error(JSON.stringify({event:'source_sync_error',sourceId:id,errorCode:code,consecutiveFailures:failures}));return {status:'ERROR',errorCode:code};}
  },{timeout:90000,maxWait:5000});
 }
 private async fetchEnergy(transport?:any){const dir=resolve(process.env.SOURCE_STATE_DIR||resolve(__dirname,'../../../.local/sources'));await mkdir(dir,{recursive:true,mode:0o700});const path=resolve(dir,'energy.json');
  if(transport&&typeof transport==='object'){const safeHeader=(v:any)=>typeof v==='string'&&v.length<=1024&&!/[\r\n]/.test(v)?v:null;await writeFile(path,JSON.stringify({rows:{},unresolved:[],etag:safeHeader(transport.etag),lastModified:safeHeader(transport.lastModified),documentSha256:/^[a-f0-9]{64}$/.test(transport.documentSha256||'')?transport.documentSha256:null,itemCount:Number.isSafeInteger(transport.itemCount)?transport.itemCount:0}),{mode:0o600});}
  const result:any=await new Promise((yes,no)=>execFile(process.env.INGEST_PYTHON||'python',[resolve(__dirname,'../../../services/ingest/official_rss.py'),'--output',path],{timeout:35000,maxBuffer:1024*1024,windowsHide:true},(error,stdout)=>{if(error){try{return no(Error(JSON.parse(stdout).status));}catch{return no(Error('ADAPTER_FAILURE'));}}try{yes(JSON.parse(stdout));}catch{no(Error('INVALID_ADAPTER_CONTRACT'));}}));
  const state=JSON.parse(await readFile(path,'utf-8'));return {rows:result.notModified?[]:Object.values(state.rows||{}),unresolved:result.notModified?[]:state.unresolved||[],documentSha256:state.documentSha256,itemCount:state.itemCount,downloaded:!result.notModified,transport:{etag:state.etag??null,lastModified:state.lastModified??null,documentSha256:state.documentSha256??null,itemCount:state.itemCount??0}};
 }
 private async fetchCareer(transport?:any){
  const dir=resolve(process.env.SOURCE_STATE_DIR||resolve(__dirname,'../../../.local/sources'));await mkdir(dir,{recursive:true,mode:0o700});const path=resolve(dir,'career.json');
  // DB metrics are authoritative; never reuse uncommitted validators after a failed staging run.
  const safe=(v:any)=>typeof v==='string'&&v.length<=1024&&!/[\r\n]/.test(v)?v:null;
  const state={transport:{etag:safe(transport?.etag),lastModified:safe(transport?.lastModified),documentSha256:/^[a-f0-9]{64}$/.test(transport?.documentSha256||'')?transport.documentSha256:null,knownGuids:Array.isArray(transport?.knownGuids)?transport.knownGuids.filter((v:any)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)).slice(0,1000):[]}};
  await writeFile(path,JSON.stringify(state),{mode:0o600});
  const result:any=await new Promise((yes,no)=>execFile(process.env.INGEST_PYTHON||'python',[resolve(__dirname,'../../../services/ingest/career_rss.py'),'--output',path],{timeout:35000,maxBuffer:8*1024*1024,windowsHide:true},(error,stdout)=>{try{const value=JSON.parse(stdout);error?no(Error(value.status||'ADAPTER_FAILURE')):yes(value);}catch{no(Error('INVALID_ADAPTER_CONTRACT'));}}));
  return {...result,documentSha256:result.documentSha256??state.transport.documentSha256,downloaded:result.notModified!==true};
 }
 private async fetchGazette(transport:any,now:Date){
  const directory=resolve(process.env.SOURCE_STATE_DIR||resolve(__dirname,'../../../.local/sources'),'gazette');await mkdir(directory,{recursive:true,mode:0o700});
  const size=async(dir:string)=>{let total=0;for(const name of await readdir(dir))if(/^[a-f0-9]{64}\.(pdf|html)$/.test(name))total+=(await stat(resolve(dir,name))).size;return total;};
  if(await size(directory)>512*1024*1024)throw Error('ADAPTER_FAILURE');
  const run=randomUUID(),state=resolve(directory,run+'-state.json'),output=resolve(directory,run+'-report.json');
  await writeFile(state,JSON.stringify(transport||{}),{mode:0o600});
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const days=Math.min(5,Math.ceil(sourceScanIntervalHours(registry.gazette)/24)+1);
  const pending=Array.isArray(transport?.pendingDates)&&transport.pendingDates.length?transport.pendingDates:Array.from({length:days},(_,i)=>new Date(Date.parse(today+'T00:00:00Z')-(days-1-i)*86400000).toISOString().slice(0,10));
  if(pending.length>5||pending.some((date:any)=>typeof date!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||date>today))throw Error('INVALID_ADAPTER_CONTRACT');
  const day=pending[0];
  try{
   await new Promise((yes,no)=>execFile(process.env.INGEST_PYTHON||'python',[resolve(__dirname,'../../../services/ingest/gazette_download.py'),'--date',day,'--directory',directory,'--state',state,'--output',output,'--scheduled'],{timeout:50000,maxBuffer:1024*1024,windowsHide:true},(error,stdout)=>{
    try{const value=JSON.parse(stdout);if(error||value.status!=='OK'){const codes:Record<string,string>={DNS_ERROR:'DNS',TLS_ERROR:'TLS',TIMEOUT:'TIMEOUT',FORBIDDEN:'FORBIDDEN',RATE_LIMITED:'RATE_LIMITED',REDIRECT:'REDIRECT',HTTP_ERROR:'HTTP_ERROR',ROBOTS_DISALLOWED:'ROBOTS_DISALLOWED',ROBOTS_RATE_REQUIRES_REVIEW:'ROBOTS_RATE_REQUIRES_REVIEW',SOURCE_REVIEW_REQUIRED:'ACCESS_REVIEW_REQUIRED',SOURCE_LICENSE_INVALID:'ACCESS_REVIEW_REQUIRED',GAZETTE_DOCUMENT_SCOPE_REQUIRED:'ACCESS_REVIEW_REQUIRED'};return no(Error(codes[value.status]||'PARSE_OR_VALIDATION'));}yes(value);}catch{no(Error(error?'TIMEOUT':'INVALID_ADAPTER_CONTRACT'));}
   }));
   if((await stat(output)).size>16*1024*1024)throw Error('INVALID_ADAPTER_CONTRACT');
   const report=JSON.parse(await readFile(output,'utf8'));
   if(report.sourceId!=='gazette'||report.date!==day||!Array.isArray(report.documents)||report.documents.length>2||!Array.isArray(report.indexes)||report.indexes.length>2)throw Error('INVALID_ADAPTER_CONTRACT');
   const storage=resolve(process.env.GAZETTE_STORAGE_DIR||resolve(__dirname,'../../../.local/gazette-documents'));await mkdir(storage,{recursive:true,mode:0o700});
   for(const record of [...report.indexes.map((i:any)=>({...i,cacheName:i.sha256+'.html',index:true})),...report.documents]){
    if(!/^[a-f0-9]{64}$/.test(record.sha256||'')||!new RegExp('^'+record.sha256+'\\.(pdf|html)$').test(record.cacheName||''))throw Error('INVALID_SOURCE_HASH');
    const file=resolve(directory,record.cacheName);if((await stat(file)).size>64*1024*1024)throw Error('INVALID_SOURCE_HASH');
    const bytes=await readFile(file);if(createHash('sha256').update(bytes).digest('hex')!==record.sha256)throw Error('INVALID_SOURCE_HASH');
    const destination=resolve(storage,record.sha256+(record.index?'.html':'.pdf'));
    if(!await stat(destination).catch(()=>null)&&await size(storage)+bytes.length>1024*1024*1024)throw Error('ADAPTER_FAILURE');
    try{await writeFile(destination,bytes,{flag:'wx',mode:0o600});}catch(error:any){if(error.code!=='EEXIST'||createHash('sha256').update(await readFile(destination)).digest('hex')!==record.sha256)throw Error('INVALID_SOURCE_HASH');}
   }
   report.transport={...report.transport,pendingDates:pending.slice(1)};
   return report;
  }finally{await unlink(state).catch(()=>{});await unlink(output).catch(()=>{});}
 }
 async health(){const states=await this.db.sourceSyncState.findMany();return {scanIntervalHours:scanIntervalHours(),processRole:process.env.PROCESS_ROLE||'api',sourceWorkerEnabled:process.env.SOURCE_SYNC_ENABLED==='true'&&runsWorker('source'),notificationWorkerEnabled:process.env.NOTIFICATIONS_ENABLED==='true'&&runsWorker('push'),sources:Object.entries(registry).map(([id,source]:[string,any])=>{const override=(states.find(state=>state.id==='policy:'+id)?.metrics as any)?.assessment;const rightsStatus=effectiveRights(source,override);return {id,...adapterStatus(source),rightsStatus,status:rightsStatus==='RESTRICTED'?'DISABLED':rightsStatus!=='LICENSE_VERIFIED'?'REVIEW_REQUIRED':adapterStatus(source).status,policyReview:override??null,scanIntervalHours:sourceScanIntervalHours(source),enabled:sourceAllowed(source)&&rightsStatus==='LICENSE_VERIFIED',automationPermission:source.automationPermission,republicationPermission:source.republicationPermission,state:states.find(state=>state.id===id)??null};})};}
}
@Controller('admin/source-operations')
export class SourceOperationsController{
 constructor(private operations:SourceOperations,private auth:CandidateAuth){}
 @Get()async health(@Req() req:any){await this.auth.role(req,['SYSTEM_ADMIN','REVIEWER','CONTENT_EDITOR']);return this.operations.health();}
 @Get(':id/policy')async policy(@Param('id') id:string,@Req() req:any){await this.auth.role(req,['SYSTEM_ADMIN','REVIEWER']);if(!Object.hasOwn(registry,id))throw new ForbiddenException();return {registry:registry[id].rightsAssessment,current:await this.operations.rights.current(id),history:await this.operations.rights.history(id)};}
 @Post(':id/policy')async reviewPolicy(@Param('id') id:string,@Req() req:any,@Body() body:any){const actor=await this.auth.role(req,['SYSTEM_ADMIN'],true);if(!Object.hasOwn(registry,id))throw new ForbiddenException();return this.operations.rights.review(registry[id],body,actor.id);}
 @Post(':id/run')async run(@Param('id') id:string,@Req() req:any){await this.auth.role(req,['SYSTEM_ADMIN'],true);return this.operations.run(id,undefined,{mode:'manual'});}
}
