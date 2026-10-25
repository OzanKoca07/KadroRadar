import {Controller,Get,Post,Param,Req,Injectable,ForbiddenException,OnModuleDestroy,OnModuleInit} from '@nestjs/common';
import {CandidateAuth} from './candidate';
import {AnnouncementAdminController,IngestionDb} from './announcement-admin';
import {resolve} from 'node:path';
import {mkdir,readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
const registry=require(resolve(__dirname,'../../../packages/official-sources.json'));
export function sourceAllowed(source:any){return source?.enabled===true&&source.automationPermission==='VERIFIED'&&source.republicationPermission==='VERIFIED'&&source.format==='rss';}
export function backoff(failures:number){return Math.min(86400000,60000*2**Math.min(11,Math.max(0,failures-1)));}
@Injectable()
export class SourceOperations implements OnModuleInit,OnModuleDestroy{
 private timer?:NodeJS.Timeout;
 constructor(private db:IngestionDb,private auth:CandidateAuth){}
 onModuleInit(){if(process.env.SOURCE_SYNC_ENABLED==='true'){this.timer=setInterval(()=>{void this.tick().catch(()=>console.error(JSON.stringify({event:'source_sync_failed'})));},60000);this.timer.unref();}}
 onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
 async tick(){for(const id of Object.keys(registry))if(sourceAllowed(registry[id]))await this.run(id);}
 async run(id:string,adapter?:()=>Promise<any[]>){
  if(!/^[a-z]+$/.test(id)||!sourceAllowed(registry[id]))throw new ForbiddenException('Source disabled or permission unverified');
  if(id!=='energy')throw new ForbiddenException('No supported adapter');
  return this.db.$transaction(async lock=>{
   const rows=await lock.$queryRaw<Array<{locked:boolean}>>`SELECT pg_try_advisory_xact_lock(hashtext(${`source-sync:${id}`})) AS locked`;
   if(!rows[0].locked)return {status:'BUSY'};
   const state=await lock.sourceSyncState.findUnique({where:{id}}),now=new Date();
   if(state?.nextAttemptAt&&state.nextAttemptAt>now)return {status:'BACKOFF'};
   await lock.sourceSyncState.upsert({where:{id},create:{id,lastAttemptAt:now,status:'RUNNING'},update:{lastAttemptAt:now,status:'RUNNING'}});
   try{
    const records=await (adapter?adapter():this.fetchEnergy());
    let counts={created:0,changed:0,duplicate:0};
    const ingest=new AnnouncementAdminController(this.db,this.auth);
    for(let offset=0;offset<records.length;offset+=100){const result=await ingest.stageRecords({rows:records.slice(offset,offset+100)},'source-scheduler:'+id);for(const key of ['created','changed','duplicate'] as const)counts[key]+=result[key];}
    await lock.sourceSyncState.update({where:{id},data:{lastSuccessAt:new Date(),nextAttemptAt:new Date(Date.now()+3600000),consecutiveFailures:0,errorCode:null,status:'OK',metrics:counts}});
    return {status:'OK',...counts};
   }catch(error:any){const failures=(state?.consecutiveFailures??0)+1;const code=/^[A-Z_]+$/.test(error.message)?error.message:'ADAPTER_OR_STAGING_ERROR';await lock.sourceSyncState.update({where:{id},data:{status:'ERROR',errorCode:code,consecutiveFailures:failures,nextAttemptAt:new Date(Date.now()+backoff(failures))}});return {status:'ERROR',errorCode:code};}
  },{timeout:45000,maxWait:5000});
 }
 private async fetchEnergy(){const dir=resolve(process.env.SOURCE_STATE_DIR||resolve(__dirname,'../../../.local/sources'));await mkdir(dir,{recursive:true,mode:0o700});const path=resolve(dir,'energy.json');
  await new Promise<void>((yes,no)=>execFile(process.env.INGEST_PYTHON||'python',[resolve(__dirname,'../../../services/ingest/official_rss.py'),'--output',path],{timeout:25000,maxBuffer:1024*1024,windowsHide:true},(error,stdout)=>{if(error){try{return no(Error(JSON.parse(stdout).status));}catch{return no(Error('ADAPTER_FAILURE'));}}yes();}));
  return Object.values(JSON.parse(await readFile(path,'utf-8')).rows||{});
 }
 async health(){const states=await this.db.sourceSyncState.findMany();return {sourceWorkerEnabled:process.env.SOURCE_SYNC_ENABLED==='true',notificationWorkerEnabled:process.env.NOTIFICATIONS_ENABLED==='true',sources:Object.entries(registry).map(([id,source]:[string,any])=>({id,enabled:sourceAllowed(source),automationPermission:source.automationPermission,republicationPermission:source.republicationPermission,state:states.find(state=>state.id===id)??null}))};}
}
@Controller('admin/source-operations')
export class SourceOperationsController{
 constructor(private operations:SourceOperations,private auth:CandidateAuth){}
 @Get()async health(@Req() req:any){await this.auth.role(req,['SYSTEM_ADMIN','REVIEWER','CONTENT_EDITOR']);return this.operations.health();}
 @Post(':id/run')async run(@Param('id') id:string,@Req() req:any){await this.auth.role(req,['SYSTEM_ADMIN'],true);return this.operations.run(id);}
}
