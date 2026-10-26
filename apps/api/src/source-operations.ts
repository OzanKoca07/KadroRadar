import {Controller,Get,Post,Param,Req,Injectable,ForbiddenException,OnModuleDestroy,OnModuleInit} from '@nestjs/common';
import {CandidateAuth} from './candidate';
import {AnnouncementAdminController,IngestionDb} from './announcement-admin';
import {resolve} from 'node:path';
import {mkdir,readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {runsWorker} from './process-role';
import {adapterStatus} from './source-adapter-contract';
import {automaticIndexingAllowed,indexingAssessment} from './source-indexing-policy';
import {scanIntervalHours,ScanMode,nextScanAt} from './announcement-scan';
const registry=require(resolve(__dirname,'../../../packages/official-sources.json'));
export function sourceAllowed(source:any){return automaticIndexingAllowed(source)&&source.format==='rss';}
export function backoff(failures:number){return Math.min(86400000,60000*2**Math.min(11,Math.max(0,failures-1)));}
@Injectable()
export class SourceOperations implements OnModuleInit,OnModuleDestroy{
 private timer?:NodeJS.Timeout;
 constructor(private db:IngestionDb,private auth:CandidateAuth){}
 onModuleInit(){if(process.env.SOURCE_SYNC_ENABLED==='true'&&process.env.SOURCE_WORKER_ONCE!=='true'&&runsWorker('source')){this.timer=setInterval(()=>{void this.tick().catch(()=>console.error(JSON.stringify({event:'source_sync_failed'})));},60000);if(process.env.PROCESS_ROLE==='combined')this.timer.unref();}}
 onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
 async tick(mode:ScanMode='scheduled'){const results:any[]=[];for(const id of Object.keys(registry))if(sourceAllowed(registry[id])){try{results.push({sourceId:id,...await this.run(id,undefined,{mode})});}catch{console.error(JSON.stringify({event:'source_dispatch_rejected',sourceId:id}));results.push({sourceId:id,status:'ERROR',errorCode:'DISPATCH_REJECTED'});}}return results;}
 async run(id:string,adapter?:()=>Promise<any>,context:{mode?:ScanMode;now?:()=>Date}={}){
  if(!/^[a-z]+$/.test(id)||!sourceAllowed(registry[id]))throw new ForbiddenException('Source disabled or permission unverified');
  if(id!=='energy')throw new ForbiddenException('No supported adapter');
  return this.db.$transaction(async lock=>{
   const rows=await lock.$queryRaw<Array<{locked:boolean}>>`SELECT pg_try_advisory_xact_lock(hashtext(${`source-sync:${id}`})) AS locked`;
   if(!rows[0].locked)return {status:'BUSY'};
   const state=await lock.sourceSyncState.findUnique({where:{id}}),now=context.now?.()||new Date(),mode=context.mode||'scheduled';
   if(!['manual','scheduled'].includes(mode))throw new ForbiddenException('Invalid scan mode');
   const previous=(state?.metrics&&typeof state.metrics==='object'&&!Array.isArray(state.metrics)?state.metrics:{}) as Record<string,any>;
   if(state?.consecutiveFailures&&state.nextAttemptAt&&state.nextAttemptAt>now)return {status:'BACKOFF',nextAttemptAt:state.nextAttemptAt};
   const due=nextScanAt(state?.lastSuccessAt,indexingAssessment(registry[id]).minIntervalSeconds);
   if(due&&due>now)return {status:'NOT_DUE',nextAttemptAt:due};
   await lock.sourceSyncState.upsert({where:{id},create:{id,lastAttemptAt:now,status:'RUNNING'},update:{lastAttemptAt:now,status:'RUNNING'}});
   try{
    const output=await (adapter?adapter():this.fetchEnergy()),records=Array.isArray(output)?output:output.rows;
    if(!Array.isArray(records))throw Error('INVALID_ADAPTER_CONTRACT');
    let counts={created:0,changed:0,duplicate:0};
    const ingest=new AnnouncementAdminController(this.db,this.auth);
    for(let offset=0;offset<records.length;offset+=100){const result=await ingest.stageRecords({rows:records.slice(offset,offset+100)},'source-scheduler:'+id);for(const key of ['created','changed','duplicate'] as const)counts[key]+=result[key];}
    let sourceReviewCreated=false;
    if(!Array.isArray(output)&&output.unresolved?.length){
     if(!/^[a-f0-9]{64}$/.test(output.documentSha256||''))throw Error('INVALID_SOURCE_HASH');
     const existing=await lock.sourceDocument.findUnique({where:{sha256:output.documentSha256}});
     if(!existing){await lock.sourceDocument.create({data:{sha256:output.documentSha256,originalUrl:registry[id].feed,originalFilename:id+'-rss-reference',sourceOrganization:registry[id].organization,state:'OFFICIAL_FEED_REVIEW',gazetteEvidence:{mode:adapter?'SYNTHETIC_ADAPTER':'LIVE_RSS_INDEX',liveFetch:!adapter,rawRetained:false,documentSha256:output.documentSha256,itemCount:output.itemCount??null,rows:[],unresolved:output.unresolved}}});sourceReviewCreated=true;}
    }
    const completed=context.now?.()||new Date(),receipt={at:completed.toISOString(),mode,provenance:adapter?'SYNTHETIC_ADAPTER':'LIVE_RSS_INDEX',...counts,sourceReviewCreated,documentSha256:output.documentSha256??null,downloaded:output.downloaded??false,unresolvedCount:output.unresolved?.length??0};
    const history=Array.isArray(previous.receipts)?previous.receipts.slice(-9):[];
    await lock.sourceSyncState.update({where:{id},data:{lastSuccessAt:completed,nextAttemptAt:nextScanAt(completed,indexingAssessment(registry[id]).minIntervalSeconds),consecutiveFailures:0,errorCode:null,status:'OK',metrics:{...counts,sourceReviewCreated,successfulRuns:Number(previous.successfulRuns||0)+1,failedRuns:Number(previous.failedRuns||0),lastReceipt:receipt,receipts:[...history,receipt]}}});
    return {status:'OK',...counts};
   }catch(error:any){const failures=(state?.consecutiveFailures??0)+1;const code=/^[A-Z_]+$/.test(error.message)?error.message:'ADAPTER_OR_STAGING_ERROR';const failed=context.now?.()||new Date();await lock.sourceSyncState.update({where:{id},data:{status:'ERROR',errorCode:code,consecutiveFailures:failures,nextAttemptAt:new Date(failed.getTime()+Math.max(backoff(failures),indexingAssessment(registry[id]).minIntervalSeconds*1000)),metrics:{...previous,successfulRuns:Number(previous.successfulRuns||0),failedRuns:Number(previous.failedRuns||0)+1,lastFailure:{at:failed.toISOString(),mode,errorCode:code}}}});console.error(JSON.stringify({event:'source_sync_error',sourceId:id,errorCode:code,consecutiveFailures:failures}));return {status:'ERROR',errorCode:code};}
  },{timeout:45000,maxWait:5000});
 }
 private async fetchEnergy(){const dir=resolve(process.env.SOURCE_STATE_DIR||resolve(__dirname,'../../../.local/sources'));await mkdir(dir,{recursive:true,mode:0o700});const path=resolve(dir,'energy.json');
  const result:any=await new Promise((yes,no)=>execFile(process.env.INGEST_PYTHON||'python',[resolve(__dirname,'../../../services/ingest/official_rss.py'),'--output',path],{timeout:35000,maxBuffer:1024*1024,windowsHide:true},(error,stdout)=>{if(error){try{return no(Error(JSON.parse(stdout).status));}catch{return no(Error('ADAPTER_FAILURE'));}}try{yes(JSON.parse(stdout));}catch{no(Error('INVALID_ADAPTER_CONTRACT'));}}));
  const state=JSON.parse(await readFile(path,'utf-8'));return {rows:Object.values(state.rows||{}),unresolved:state.unresolved||[],documentSha256:state.documentSha256,itemCount:state.itemCount,downloaded:!result.notModified};
 }
 async health(){const states=await this.db.sourceSyncState.findMany();return {scanIntervalHours:scanIntervalHours(),processRole:process.env.PROCESS_ROLE||'api',sourceWorkerEnabled:process.env.SOURCE_SYNC_ENABLED==='true'&&runsWorker('source'),notificationWorkerEnabled:process.env.NOTIFICATIONS_ENABLED==='true'&&runsWorker('push'),sources:Object.entries(registry).map(([id,source]:[string,any])=>({id,...adapterStatus(source),enabled:sourceAllowed(source),automationPermission:source.automationPermission,republicationPermission:source.republicationPermission,state:states.find(state=>state.id===id)??null}))};}
}
@Controller('admin/source-operations')
export class SourceOperationsController{
 constructor(private operations:SourceOperations,private auth:CandidateAuth){}
 @Get()async health(@Req() req:any){await this.auth.role(req,['SYSTEM_ADMIN','REVIEWER','CONTENT_EDITOR']);return this.operations.health();}
 @Post(':id/run')async run(@Param('id') id:string,@Req() req:any){await this.auth.role(req,['SYSTEM_ADMIN'],true);return this.operations.run(id,undefined,{mode:'manual'});}
}
