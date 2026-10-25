import {BadRequestException,HttpException,Body,CanActivate,Controller,ExecutionContext,Get,Injectable,Module,Param,Post,Req,Res,UploadedFile,UseGuards,UseInterceptors} from '@nestjs/common';
import {FileInterceptor} from '@nestjs/platform-express';
import {CandidateAuth,CandidateModule} from './candidate';
import {IngestionDb} from './announcement-admin';
import {GazetteCapacity} from './gazette';
import {createHash,randomUUID} from 'node:crypto';
import {resolve,join} from 'node:path';
import {mkdir,readFile,unlink,writeFile,readdir,stat} from 'node:fs/promises';
import {execFile} from 'node:child_process';
const directory=()=>resolve(process.env.HISTORICAL_STORAGE_DIR||resolve(__dirname,'../../../.local/historical'));
async function python(script:string,args:string[]){return new Promise<any>((yes,no)=>execFile(process.env.INGEST_PYTHON||'python',[resolve(__dirname,'../../../services/ingest',script),...args],{timeout:60000,maxBuffer:16*1024*1024,windowsHide:true},(error,stdout)=>{if(error)return no(new BadRequestException('Official document retrieval/parser failed; no import performed'));try{yes(JSON.parse(stdout));}catch{no(new BadRequestException('Invalid parser result'));}}));}
@Injectable()class HistoricalGuard implements CanActivate{constructor(private auth:CandidateAuth){}async canActivate(context:ExecutionContext){const req=context.switchToHttp().getRequest();req.historicalActor=await this.auth.role(req,req.method==='GET'?['SYSTEM_ADMIN','CONTENT_EDITOR','REVIEWER']:['SYSTEM_ADMIN','CONTENT_EDITOR'],req.method!=='GET');if(req.method==='POST'&&process.env.DOCUMENT_UPLOADS_ENABLED==='false')throw new HttpException('Document processing disabled until persistent storage is configured',503);return true;}}
@Controller('admin/historical-documents')@UseGuards(HistoricalGuard)
class HistoricalImportController{
 constructor(private db:IngestionDb){}
 private async capacity(bytes:number){await mkdir(directory(),{recursive:true,mode:0o700});let total=0;for(const name of await readdir(directory())){if(!/^[a-f0-9]{64}\.pdf$/.test(name)&&!/^[a-f0-9-]{36}\.tmp$/.test(name))continue;const info=await stat(join(directory(),name));if(!info.isFile())continue;if(Date.now()-info.mtimeMs>(name.endsWith('.tmp')?3600000:30*86400000))await unlink(join(directory(),name));else total+=info.size;}if(total+bytes>1024*1024*1024)throw new BadRequestException('Historical storage quota reached');}
 @Post('web')@UseInterceptors(GazetteCapacity)
 async web(@Body() body:any,@Req() req:any){if(typeof body?.indexUrl!=='string'||body.indexUrl.length>2000||body.documentUrl&&typeof body.documentUrl!=='string')throw new BadRequestException();await mkdir(directory(),{recursive:true,mode:0o700});const temp=join(directory(),randomUUID()+'.tmp');try{const result=await python('osym_web.py',['--index',body.indexUrl,...(body.documentUrl?['--document',body.documentUrl,'--output',temp]:[])]);if(!body.documentUrl)return result;return this.stage({buffer:await readFile(temp),originalname:'osym-results.pdf'},req,body.documentUrl);}finally{await unlink(temp).catch(()=>{});}}
 @Post()@UseInterceptors(GazetteCapacity,FileInterceptor('file',{limits:{fileSize:64*1024*1024,files:1,fields:0}}))
 async upload(@UploadedFile() file:any,@Req() req:any){return this.stage(file,req);}
 private async stage(file:any,req:any,sourceUrl?:string){
  if(!file?.buffer||file.buffer.length>64*1024*1024||file.buffer.subarray(0,5).toString()!=='%PDF-')throw new BadRequestException('PDF required');
  await this.capacity(file.buffer.length);
  await mkdir(directory(),{recursive:true,mode:0o700});const temp=join(directory(),randomUUID()+'.tmp');await writeFile(temp,file.buffer,{flag:'wx',mode:0o600});
  try{const parsed=await python('import_historical.py',['--file',temp,'--parse-json']);if(parsed.errors.length||!parsed.rows.length||parsed.rows.length>10000)throw new BadRequestException('Unresolved historical rows; import blocked');const sha=createHash('sha256').update(file.buffer).digest('hex');
   const result=await this.db.$transaction(async tx=>{await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`historical:${sha}`}))`;const prior=await tx.importBatch.findFirst({where:{sourceSha256:sha}});if(prior){if(sourceUrl)await tx.sourceDocument.updateMany({where:{sha256:sha,originalUrl:null},data:{originalUrl:sourceUrl}});return {batchId:prior.id,duplicate:true,rows:prior.rowCount};}
    const source=await tx.sourceDocument.upsert({where:{sha256:sha},create:{sha256:sha,originalFilename:String(file.originalname).slice(0,160),originalUrl:sourceUrl,sourceOrganization:'ÖSYM',state:'DRAFT'},update:{}});if(source.state!=='DRAFT')throw new BadRequestException('Existing reviewed source cannot be overwritten');
    const m=parsed.metadata;const round=await tx.placementRound.upsert({where:{year_sequenceNo_educationLevel:{year:m.year,sequenceNo:m.round,educationLevel:m.education}},create:{year:m.year,sequenceNo:m.round,educationLevel:m.education},update:{}});
    const batch=await tx.importBatch.create({data:{sourceSha256:sha,rowCount:parsed.rows.length,errorCount:0}});
    for(const r of parsed.rows){if(await tx.historicalPlacement.findUnique({where:{roundId_positionCode:{roundId:round.id,positionCode:r.positionCode}}}))throw new BadRequestException('Existing placement conflict; original preserved');await tx.importRow.create({data:{batchId:batch.id,positionCode:r.positionCode,raw:r,issues:[],sourcePage:r.sourcePage}});const {rawRecord,...fields}=r;await tx.historicalPlacement.create({data:{...fields,rawRecord,roundId:round.id,sourceDocumentId:source.id}});}
    await tx.reviewAudit.create({data:{batchId:batch.id,actor:req.historicalActor.id,action:'STAGED',count:parsed.rows.length}});return {batchId:batch.id,duplicate:false,rows:parsed.rows.length};
   },{timeout:60000});await writeFile(join(directory(),sha+'.pdf'),file.buffer,{flag:'wx',mode:0o600}).catch((error:any)=>{if(error.code!=='EEXIST')throw error;});return {...result,metadata:parsed.metadata,sha256:sha};
  }finally{await unlink(temp).catch(()=>{});}
 }
 @Get(':batchId/file')async file(@Param('batchId') id:string,@Res() response:any){const batch=await this.db.importBatch.findUnique({where:{id}});if(!batch||!/^[a-f0-9]{64}$/.test(batch.sourceSha256))throw new BadRequestException();let bytes:Buffer;try{bytes=await readFile(join(directory(),batch.sourceSha256+'.pdf'));}catch{throw new BadRequestException('Source file unavailable; use verified original URL');}if(createHash('sha256').update(bytes).digest('hex')!==batch.sourceSha256)throw new BadRequestException('Source integrity error');response.set({'Content-Type':'application/pdf','Content-Security-Policy':"sandbox; default-src 'none'",'Cache-Control':'no-store'});return response.send(bytes);}
}
@Module({imports:[CandidateModule],controllers:[HistoricalImportController],providers:[IngestionDb,HistoricalGuard,GazetteCapacity]})export class HistoricalImportModule{}
