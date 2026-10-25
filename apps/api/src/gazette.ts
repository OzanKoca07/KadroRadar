import {Body,BadRequestException,CanActivate,ConflictException,Controller,Delete,Get,Injectable,Module,NestInterceptor,OnModuleDestroy,Param,Post,Req,Res,UploadedFile,UseGuards,UseInterceptors,ExecutionContext,CallHandler,HttpException} from '@nestjs/common';
import {FileInterceptor} from '@nestjs/platform-express';
import {CandidateAuth,CandidateModule} from './candidate';
import {IngestionDb} from './announcement-admin';
import {Prisma} from '@prisma/client';
import {createHash,randomUUID} from 'node:crypto';
import {resolve,basename,join} from 'node:path';
import {mkdir,writeFile,unlink,readFile,readdir,stat} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {finalize} from 'rxjs';

const MAX_BYTES=64*1024*1024;
const storage=()=>resolve(process.env.GAZETTE_STORAGE_DIR || resolve(__dirname,'../../../.local/gazette'));
@Injectable()
export class GazetteGuard implements CanActivate {
 constructor(private auth:CandidateAuth){}
 async canActivate(context:ExecutionContext){const req=context.switchToHttp().getRequest();req.gazetteActor=await this.auth.role(req,req.method==='DELETE'?['SYSTEM_ADMIN']:req.method==='POST'?['SYSTEM_ADMIN','CONTENT_EDITOR']:['SYSTEM_ADMIN','CONTENT_EDITOR','REVIEWER'],req.method!=='GET');if(req.method==='POST'&&process.env.DOCUMENT_UPLOADS_ENABLED==='false')throw new HttpException('Document processing disabled until persistent storage is configured',503);return true;}
}
@Injectable()
export class GazetteCapacity implements NestInterceptor {
 private static active=0;
 intercept(context:ExecutionContext,next:CallHandler){if(GazetteCapacity.active>=1)throw new HttpException('Another PDF is being processed',429);GazetteCapacity.active++;return next.handle().pipe(finalize(()=>GazetteCapacity.active--));}
}
function runParser(path:string,pages:number[]=[]):Promise<any>{return new Promise((resolveResult,reject)=>{
 execFile(process.env.INGEST_PYTHON||'python',[resolve(__dirname,'../../../services/ingest/official_gazette.py'),path,...(pages.length?['--ocr-pages',pages.join(',')]:[])],{timeout:pages.length?180000:60000,maxBuffer:16*1024*1024,windowsHide:true,env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,PYTHONIOENCODING:'utf-8',TESSERACT_CMD:process.env.TESSERACT_CMD,TESSDATA_PREFIX:process.env.TESSDATA_PREFIX,OMP_THREAD_LIMIT:'1'}},(error,stdout)=>{
   if(error)return reject(new BadRequestException('PDF parser failed or exceeded resource limit'));
   try{const result=JSON.parse(stdout);if(result.error||!Array.isArray(result.candidates))throw Error();resolveResult(result);}catch{reject(new BadRequestException('Invalid parser result'));}
 });
});}
@Controller('admin/gazette-documents')
@UseGuards(GazetteGuard)
export class GazetteController implements OnModuleDestroy {
 private cleanupTimer:NodeJS.Timeout;
 constructor(private db:IngestionDb){this.cleanupTimer=setInterval(()=>{void this.purge().catch(()=>console.error(JSON.stringify({event:'gazette_retention_failed'})));},6*3600000);this.cleanupTimer.unref();}
 onModuleDestroy(){clearInterval(this.cleanupTimer);}
 private retentionDays(){const days=Number(process.env.GAZETTE_RETENTION_DAYS||30);if(!Number.isInteger(days)||days<1||days>90)throw new BadRequestException('Retention must be 1–90 days');return days;}
 private async purge(){let entries:string[];try{entries=await readdir(storage());}catch(error:any){if(error.code==='ENOENT')return;throw error;}for(const name of entries){if(!/^[a-f0-9]{64}\.pdf$/.test(name)&&!/^[a-f0-9-]{36}\.tmp$/.test(name))continue;const path=join(storage(),name);const info=await stat(path);if(info.isFile()&&Date.now()-info.mtimeMs>(name.endsWith('.tmp')?3600000:this.retentionDays()*86400000))await unlink(path);}}
 @Get()
 list(){return this.db.sourceDocument.findMany({where:{state:'GAZETTE_UPLOADED'},take:100,orderBy:{createdAt:'desc'},select:{id:true,originalFilename:true,originalUrl:true,sha256:true,createdAt:true,_count:{select:{gazetteImports:true}}}});}
 @Post()
 @UseInterceptors(GazetteCapacity,FileInterceptor('file',{limits:{fileSize:MAX_BYTES,files:1,fields:1},fileFilter:(req:any,file:any,callback:any)=>callback(null,['application/pdf','application/octet-stream'].includes(file.mimetype))}))
 async upload(@UploadedFile() file:any,@Req() req:any){
  if(!file?.buffer || file.buffer.length>MAX_BYTES || file.buffer.subarray(0,5).toString()!=='%PDF-')throw new BadRequestException('Valid PDF required, maximum64MiB');
  this.retentionDays();
  await mkdir(storage(),{recursive:true,mode:0o700});
  await this.purge();
  let stored=0;for(const name of await readdir(storage())){if(/^[a-f0-9]{64}\.pdf$/.test(name))stored+=(await stat(join(storage(),name))).size;}
  if(stored+file.buffer.length>1024*1024*1024)throw new HttpException('PDF storage quota reached; admin retention cleanup required',413);
  const temporary=join(storage(),randomUUID()+'.tmp');
  await writeFile(temporary,file.buffer,{flag:'wx',mode:0o600});
  try{
   const parsed=await runParser(temporary);
   const sha=createHash('sha256').update(file.buffer).digest('hex');
   if(parsed.sha256!==sha || parsed.pageCount>600 || parsed.candidates.length>100)throw new BadRequestException('PDF consistency/size limit');
   const finalPath=join(storage(),sha+'.pdf');
   try{await writeFile(finalPath,file.buffer,{flag:'wx',mode:0o600});}catch(error:any){if(error.code!=='EEXIST')throw error;const stored=await readFile(finalPath);if(createHash('sha256').update(stored).digest('hex')!==sha)throw new ConflictException('Stored PDF integrity check failed');}
   const result=await this.db.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`gazette:${sha}`}))`;
    const document=await tx.sourceDocument.upsert({where:{sha256:sha},create:{sha256:sha,originalFilename:basename(file.originalname).slice(0,160),sourceOrganization:'T.C. Resmî Gazete',state:'GAZETTE_UPLOADED'},update:{}});
    if(document.state!=='GAZETTE_UPLOADED')throw new ConflictException('PDF already belongs to another import workflow');
    let created=0,duplicate=0,changed=0;
    for(const candidate of parsed.candidates){
     const identity=candidate.identity;
     const contentHash=createHash('sha256').update(JSON.stringify(candidate)).digest('hex');
     const old=await tx.announcementImportRow.findUnique({where:{sourceUrl:identity}});
     if(old?.contentHash===contentHash){duplicate++;continue;}
     if(old?.announcementId){await tx.announcement.update({where:{id:old.announcementId},data:{sourceCheckedAt:null}});await tx.announcementPosition.updateMany({where:{announcementId:old.announcementId},data:{verifiedAt:null}});}
     const data={sourceDocumentId:document.id,contentHash,raw:candidate as Prisma.InputJsonValue,parsed:candidate as Prisma.InputJsonValue,issues:[...candidate.issues,'PDF_SOURCE_REVIEW_REQUIRED'],status:'PENDING_REVIEW'};
     const row=old?await tx.announcementImportRow.update({where:{id:old.id},data:{...data,version:{increment:1}}}):await tx.announcementImportRow.create({data:{...data,sourceUrl:identity}});
     await tx.announcementReviewAudit.create({data:{rowId:row.id,actor:req.gazetteActor.id,action:'GAZETTE_IMPORTED',snapshot:{sha256:sha,sourceEvidence:candidate.sourceEvidence,parserVersion:parsed.parserVersion}}});
     old?changed++:created++;
    }
    return {documentId:document.id,created,changed,duplicate};
   },{timeout:20000});
   return {...result,sha256:sha,pageCount:parsed.pageCount,inspectedPages:parsed.inspectedPages,gazetteDate:parsed.gazetteDate,gazetteNumber:parsed.gazetteNumber,metrics:parsed.metrics,pageReports:parsed.pageReports,candidates:parsed.candidates};
  }finally{await unlink(temporary).catch(()=>{});}
 }
 private async document(id:string){const doc=await this.db.sourceDocument.findFirst({where:{id,state:'GAZETTE_UPLOADED'}});if(!doc || !/^[a-f0-9]{64}$/.test(doc.sha256))throw new BadRequestException('Document not found');return doc;}
 @Post(':id/ocr')
 @UseInterceptors(GazetteCapacity)
 async ocr(@Param('id') id:string,@Body() body:any,@Req() req:any){
  if(!Array.isArray(body?.pages)||body.pages.length<1||body.pages.length>5||body.pages.some((page:any)=>!Number.isInteger(page)||page<1||page>600)||new Set(body.pages).size!==body.pages.length)throw new BadRequestException('Choose 1–5 distinct flagged pages');
  const doc=await this.document(id),path=join(storage(),doc.sha256+'.pdf');
  const info=await stat(path).catch(()=>null);if(!info||Date.now()-info.mtimeMs>this.retentionDays()*86400000)throw new HttpException('Document expired or unavailable',410);
  const bytes=await readFile(path);if(createHash('sha256').update(bytes).digest('hex')!==doc.sha256)throw new ConflictException('Stored PDF integrity check failed');
  const result=await runParser(path,body.pages);
  const reports=result.pageReports.filter((page:any)=>body.pages.includes(page.page));
  if(reports.length!==body.pages.length||reports.some((page:any)=>!page.ocr))throw new BadRequestException('Only flagged pages can be OCR reviewed');
  const rows=await this.db.announcementImportRow.findMany({where:{sourceDocumentId:id},select:{id:true}});
  await this.db.$transaction(rows.map(row=>this.db.announcementReviewAudit.create({data:{rowId:row.id,actor:req.gazetteActor.id,action:'OCR_REVIEW_EVIDENCE',snapshot:{pages:reports,canonicalFieldsChanged:false} as Prisma.InputJsonValue}})));
  return {pageReports:reports,metrics:result.metrics,canonicalFieldsChanged:false};
 }
 @Get(':id/file')
 async file(@Param('id') id:string,@Res() response:any){const document=await this.document(id);const path=join(storage(),document.sha256+'.pdf');let bytes:Buffer;try{const info=await stat(path);if(Date.now()-info.mtimeMs>this.retentionDays()*86400000)throw Error('expired');bytes=await readFile(path);}catch{throw new HttpException('Document file expired or unavailable',410);}if(createHash('sha256').update(bytes).digest('hex')!==document.sha256)throw new ConflictException('Stored PDF integrity check failed');response.set({'Content-Type':'application/pdf','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",'Cache-Control':'no-store','Content-Disposition':'inline; filename="gazette.pdf"'});return response.send(bytes);}
 @Delete(':id/file')
 async remove(@Param('id') id:string){const document=await this.document(id);await unlink(join(storage(),document.sha256+'.pdf')).catch((error:any)=>{if(error.code!=='ENOENT')throw error;});return {fileDeleted:true,evidenceRetained:true};}
}
@Module({imports:[CandidateModule],controllers:[GazetteController],providers:[IngestionDb,GazetteGuard,GazetteCapacity]})
export class GazetteModule {}
