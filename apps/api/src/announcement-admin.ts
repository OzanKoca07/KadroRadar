import { Body, Controller, Get, Post, Patch, Param, Headers, Req, Injectable, OnModuleDestroy, UnauthorizedException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { CandidateAuth } from './candidate';
import {newsSource,newsFingerprint,newsSourceRecord} from './home-news';
import {hardRestricted,SourceRightsStore} from './source-rights';
import {careerEvidence} from './career-staging';
import { PrismaClient, Prisma } from '@prisma/client';
import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
import { resolve } from 'node:path';
const registry: Record<string, {hosts: string[]}> = require(resolve(__dirname, '../../../packages/official-sources.json'));

@Injectable()
export class IngestionDb extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy() { await this.$disconnect(); }
}

// Short-lived signed credentials issued by a trusted operator/identity gateway.
// No shared review token, no client-supplied role trusted without signature.
export function authorize(header: string | undefined, roles: string[]) {
  if (process.env.NODE_ENV === 'production') throw new UnauthorizedException('Use account session');
  const key = process.env.ANNOUNCEMENT_AUTH_SECRET;
  if (!key || key.length < 48 || !header?.startsWith('Bearer ')) throw new UnauthorizedException();
  const [payload, signature, extra] = header.slice(7).split('.');
  if (!payload || !signature || extra) throw new UnauthorizedException();
  const expected = createHmac('sha256', key).update(payload).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new UnauthorizedException();
  let claims: any;
  try { claims = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { throw new UnauthorizedException(); }
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.sub !== 'string' || !claims.sub || !Number.isInteger(claims.exp) || !Number.isInteger(claims.iat) || claims.exp <= now || claims.iat > now || claims.exp - claims.iat > 3600 || claims.aud !== 'announcement-admin') throw new UnauthorizedException();
  if (!roles.includes(claims.role)) throw new ForbiddenException();
  return claims.sub as string;
}

function url(value: unknown, source = false): string {
  if (typeof value !== 'string') throw new BadRequestException('Official HTTPS URL required');
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443') || !Object.values(registry).some(entry => !hardRestricted(entry)&&entry.hosts.includes(u.hostname))) throw new Error();
    u.hash = ''; return u.toString();
  } catch { throw new BadRequestException('Unapproved URL'); }
}
function fields(input: any, gazette?:any) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException();
  const result: any = {};
  // Explicit null clears obsolete dates/links when a reviewed correction removes them.
  Object.assign(result,{applicationStartAt:null,applicationEndAt:null,applicationUrl:null});
  for (const key of ['title', 'organization', 'city', 'district', 'positionTitle', 'educationLevel', 'summary', 'requirements']) {
    if (input[key] != null) {
      if (typeof input[key] !== 'string' || input[key].length > 20000) throw new BadRequestException(key);
      result[key] = input[key].trim();
    }
  }
  if (!result.title || !result.organization) throw new BadRequestException('Title and organization required');
  result.sourceUrl = input.sourceUrl ? url(input.sourceUrl, true) : gazette ? null : url(input.sourceUrl,true);
  if(gazette){
    result.sourceEvidence=gazette.sourceEvidence;
    if(!Array.isArray(input.positions) || input.positions.length>100)throw new BadRequestException('PDF positions required');
    result.positions=input.positions.map((position:any)=>{
      let original=gazette.positions?.find((p:any)=>p.parserPositionKey===position.parserPositionKey);
      if(!original && typeof position.parserPositionKey==='string' && /^manual:[a-zA-Z0-9_-]{1,64}$/.test(position.parserPositionKey)){
        const evidence=position.sourceEvidence;
        if(!Number.isInteger(evidence?.page)||evidence.page<gazette.sourceEvidence.pageStart||evidence.page>gazette.sourceEvidence.pageEnd||typeof evidence.text!=='string'||evidence.text.trim().length<10||evidence.text.length>12000)throw new BadRequestException('Manual position needs in-range PDF page and source quotation');
        original={parserPositionKey:position.parserPositionKey,sourceEvidence:{page:evidence.page,text:evidence.text,manual:true}};
      }
      if(!original || typeof position.title!=='string' || !position.title.trim() || position.title.length>500 || !Number.isInteger(position.quota) || position.quota<1 || !position.requirements || typeof position.requirements!=='object' || Array.isArray(position.requirements))throw new BadRequestException('Invalid PDF position');
      const r=position.requirements;
      const allowed=['complete','educationLevels','degreeCodes','degreeCodesVerified','kpssRequired','kpssScoreType','kpssMinimumScore','examYears','ydsMinimumScore','certificates','otherConditions','employmentType'];
      if(r.employmentType!==undefined&&!['CIVIL_SERVANT','CONTRACTED','WORKER','ACADEMIC'].includes(r.employmentType))throw new BadRequestException('employmentType');
      if(Object.keys(r).some(key=>!allowed.includes(key)))throw new BadRequestException('Unknown PDF criterion');
      for(const key of ['complete','degreeCodesVerified','kpssRequired'])if(r[key]!==undefined && typeof r[key]!=='boolean')throw new BadRequestException(key);
      for(const key of ['educationLevels','degreeCodes','certificates','otherConditions'])if(r[key]!==undefined && (!Array.isArray(r[key])||r[key].length>100||r[key].some((v:any)=>typeof v!=='string'||v.length>20000)))throw new BadRequestException(key);
      for(const key of ['kpssMinimumScore','ydsMinimumScore'])if(r[key]!==undefined && (typeof r[key]!=='number'||!Number.isFinite(r[key])||r[key]<0||r[key]>100))throw new BadRequestException(key);
      if(r.kpssScoreType!==undefined && (typeof r.kpssScoreType!=='string'||r.kpssScoreType.length>50))throw new BadRequestException();
      if(r.examYears!==undefined && (!Array.isArray(r.examYears)||r.examYears.length>20||r.examYears.some((v:any)=>!Number.isInteger(v)||v<2000||v>2100)))throw new BadRequestException();
      if(position.city!=null&&(typeof position.city!=='string'||position.city.length>100))throw new BadRequestException('Position city');
      return {title:position.title,city:position.city?.trim()||null,quota:position.quota,requirements:r,parserPositionKey:original.parserPositionKey,sourceEvidence:original.sourceEvidence};
    });
    if(new Set(result.positions.map((p:any)=>p.parserPositionKey)).size!==result.positions.length)throw new BadRequestException('Duplicate PDF position identity');
    result.positionsReviewed=input.positionsReviewed===true;
  }
  if (input.applicationUrl) result.applicationUrl = url(input.applicationUrl);
  if (input.quota != null) {
    if (!Number.isSafeInteger(input.quota) || input.quota <= 0) throw new BadRequestException('quota');
    result.quota = input.quota;
  }
  if(gazette && result.positions.length && result.quota!==result.positions.reduce((sum:number,p:any)=>sum+p.quota,0))throw new BadRequestException('PDF quota must equal reviewed position rows');
  for (const key of ['applicationStartAt', 'applicationEndAt', 'announcedAt']) {
    if (input[key]) {
      if (typeof input[key] !== 'string' || !/(Z|[+-]\d\d:\d\d)$/.test(input[key]) || !Number.isFinite(Date.parse(input[key]))) throw new BadRequestException('Explicit timezone required');
      result[key] = new Date(input[key]).toISOString();
    }
  }
  if (result.applicationStartAt && result.applicationEndAt && result.applicationStartAt > result.applicationEndAt) throw new BadRequestException('Invalid date range');
  return result;
}

@Controller('admin/announcement-imports')
export class AnnouncementAdminController {
  constructor(private db: IngestionDb, private auth: CandidateAuth) {}

  @Post(':id/home-news')
  async homeNews(@Req() req:any,@Param('id') id:string,@Body() body:any){
    const user=await this.auth.role(req,['SYSTEM_ADMIN','REVIEWER'],true);
    if(typeof body?.enabled!=='boolean'||body.enabled&&(typeof body.editorSummary!=='string'||body.editorSummary.trim().length<10||body.editorSummary.length>180||/[<>\r\n]/.test(body.editorSummary))||!Number.isInteger(body.version)||typeof body.evidence!=='string'||body.evidence.trim().length<20||body.evidence.length>2000||body.enabled&&(body.indexPermissionReviewed!==true||body.sourceVerified!==true))throw new BadRequestException('Manual source and indexing review required');
    return this.db.$transaction(async tx=>{
      const row=await tx.announcementImportRow.findUnique({where:{id}});
      if(!row||row.version!==body.version||row.status!=='PUBLISHED'||!row.announcementId)throw new ConflictException();
      const item=await tx.announcement.findUnique({where:{id:row.announcementId}});
      if(!item||body.enabled&&(item.status!=='PUBLISHED'||!item.sourceCheckedAt||!item.publishedAt||!newsSource(item.sourceUrl)||!newsSource(row.sourceUrl)))throw new BadRequestException('Published official announcement required');
      if(body.enabled&&await new SourceRightsStore(tx as any).status(newsSourceRecord(item!.sourceUrl))!=='LICENSE_VERIFIED')throw new ForbiddenException('Source license review required');
      const changed=await tx.announcementImportRow.updateMany({where:{id,version:body.version},data:{version:{increment:1}}});if(!changed.count)throw new ConflictException();
      const previous=item.sourceEvidence&&typeof item.sourceEvidence==='object'&&!Array.isArray(item.sourceEvidence)?item.sourceEvidence as Record<string,any>:{};
      await tx.announcement.update({where:{id:item.id},data:{sourceEvidence:{...previous,homeNews:body.enabled?{mode:'MANUAL_REVIEWED',editorSummary:body.editorSummary.trim(),indexPermissionReviewed:true,reviewedAt:new Date().toISOString(),factsHash:newsFingerprint(item)}:null}}});
      await tx.announcementReviewAudit.create({data:{rowId:id,actor:user.id,action:body.enabled?'FEATURE_NEWS':'UNFEATURE_NEWS',snapshot:{announcementId:item.id,editorSummary:body.enabled?body.editorSummary.trim():null,evidence:body.evidence,indexPermissionReviewed:body.indexPermissionReviewed===true}}});
      return {updated:true};
    });
  }
  private async actor(req:any, roles:string[], mutate=false) {
    if(process.env.NODE_ENV !== 'production' && req.headers.authorization?.includes('.'))return authorize(req.headers.authorization,roles);
    return (await this.auth.role(req,roles,mutate)).id;
  }
  @Get()
  async list(@Req() req:any) {
    await this.actor(req, ['SYSTEM_ADMIN', 'CONTENT_EDITOR', 'REVIEWER']);
    return this.db.announcementImportRow.findMany({take: 100, orderBy: {updatedAt: 'desc'}, include: {sourceReference:true,audits: {orderBy: {createdAt: 'desc'}}}});
  }
  @Patch(':id')
  async draft(@Req() req:any,@Param('id') id:string,@Body() body:any){
    const actor=await this.actor(req,['SYSTEM_ADMIN','CONTENT_EDITOR','REVIEWER'],true);
    if(!Number.isInteger(body?.version))throw new BadRequestException('version');
    return this.db.$transaction(async tx=>{
      const row=await tx.announcementImportRow.findUnique({where:{id}});if(!row||row.version!==body.version)throw new ConflictException('Refresh draft');
      const parsed=fields(body.fields,row.sourceDocumentId?row.raw:undefined);if((row.raw as any)?.sourceId==='career')parsed.sourceEvidence=careerEvidence(row.raw);if(row.sourceDocumentId)parsed.positionsReviewed=false;
      if(!row.sourceDocumentId&&parsed.sourceUrl!==row.sourceUrl)throw new BadRequestException('Source identity');
      const updated=await tx.announcementImportRow.updateMany({where:{id,version:body.version},data:{parsed,status:'PENDING_REVIEW',version:{increment:1}}});if(!updated.count)throw new ConflictException();
      if(row.announcementId){await tx.announcement.update({where:{id:row.announcementId},data:{sourceCheckedAt:null}});await tx.announcementPosition.updateMany({where:{announcementId:row.announcementId},data:{verifiedAt:null}});}
      await tx.announcementReviewAudit.create({data:{rowId:id,actor,action:'DRAFT_EDITED',snapshot:parsed}});return {id,status:'PENDING_REVIEW'};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }
  @Get(':id/matches')
  async matches(@Req() req:any,@Param('id') id:string){
    await this.actor(req,['SYSTEM_ADMIN','REVIEWER','CONTENT_EDITOR']);
    const row=await this.db.announcementImportRow.findUnique({where:{id}});if(!row)throw new BadRequestException('Source row not found');
    const {sameOfficialNotice}=await import('./announcement-identity');
    const candidates=await this.db.announcementImportRow.findMany({where:{id:{not:id}},orderBy:{updatedAt:'desc'},take:500});
    const matches=candidates.flatMap(other=>{const reason=sameOfficialNotice(row,other);if(!reason)return [];const a=row.parsed as any,b=other.parsed as any;return [{rowId:other.id,announcementId:other.announcementId,sourceUrl:other.sourceUrl,reason,conflicts:['applicationStartAt','applicationEndAt','quota'].filter(key=>a[key]!=null&&b[key]!=null&&a[key]!==b[key]),reviewRequired:true}];});
    return {matches,automaticMerge:false,searchLimit:500};
  }
  @Post(':id/link')
  async link(@Req() req:any,@Param('id') id:string,@Body() body:any){
    const actor=await this.actor(req,['SYSTEM_ADMIN','REVIEWER'],true);
    if(!Number.isInteger(body?.version)||typeof body.announcementId!=='string'||body.documentVerified!==true||typeof body.evidence!=='string'||body.evidence.trim().length<10)throw new BadRequestException('Explicit source matching review required');
    return this.db.$transaction(async tx=>{
      const row=await tx.announcementImportRow.findUnique({where:{id}});
      const announcement=await tx.announcement.findFirst({where:{id:body.announcementId,status:{in:['PUBLISHED','ARCHIVED']}}});
      if(!row||row.version!==body.version||row.announcementId||!announcement)throw new ConflictException('Source identity/version or canonical announcement invalid');
      const previous=await tx.announcementSourceReference.findUnique({where:{importRowId:id}});
      if(previous&&previous.announcementId!==announcement.id)throw new ConflictException('Source already linked');
      const raw=row.raw as any;
      const reference=await tx.announcementSourceReference.upsert({where:{importRowId:id},create:{importRowId:id,announcementId:announcement.id,evidence:raw.sourceEvidence??{sourceUrl:row.sourceUrl}},update:{}});
      await tx.announcementImportRow.update({where:{id},data:{status:'LINKED',version:{increment:1}}});
      await tx.announcementReviewAudit.create({data:{rowId:id,actor,action:'LINK_EXISTING',snapshot:{announcementId:announcement.id,evidence:body.evidence,reference:reference.evidence}}});
      return {status:'LINKED',announcementId:announcement.id};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }
  @Post()
  async ingest(@Req() req:any, @Body() body: any) {
    const actor = await this.actor(req, ['SYSTEM_ADMIN', 'CONTENT_EDITOR'],true);
    return this.stageRecords(body,actor);
  }
  @Post(':id/apply-event')
  async applyEvent(@Req() req:any,@Param('id') id:string,@Body() body:any){
    const actor=await this.actor(req,['SYSTEM_ADMIN','REVIEWER'],true);
    if(!Number.isInteger(body?.version)||!['EXTEND','WITHDRAW'].includes(body.action)||typeof body.announcementId!=='string'||body.documentVerified!==true||typeof body.evidence!=='string'||body.evidence.trim().length<20)throw new BadRequestException('Explicit existing-announcement event review required');
    return this.db.$transaction(async tx=>{
      const row=await tx.announcementImportRow.findUnique({where:{id}});const original=row?.raw as any;
      if(!row||row.version!==body.version||row.status==='EVENT_APPLIED'||row.announcementId)throw new ConflictException('Refresh event source');
      if(!row.sourceDocumentId||!['CANCELLATION','CORRECTION'].includes(original.eventType)||(body.action==='WITHDRAW'&&original.eventType!=='CANCELLATION')||(body.action==='EXTEND'&&original.eventType!=='CORRECTION'))throw new BadRequestException('Event must match the reviewed source notice');
      const announcement=await tx.announcement.findFirst({where:{id:body.announcementId,status:{in:['PUBLISHED','ARCHIVED']},publishedAt:{not:null},sourceCheckedAt:{not:null}}});
      if(!announcement)throw new BadRequestException('Verified existing announcement required');
      let end:Date|undefined;
      if(body.action==='EXTEND'){
        if(typeof body.applicationEndAt!=='string'||!/(Z|[+-]\d\d:\d\d)$/.test(body.applicationEndAt)||!Number.isFinite(Date.parse(body.applicationEndAt)))throw new BadRequestException('Explicit verified deadline and timezone required');
        end=new Date(body.applicationEndAt);if(!announcement.applicationEndAt||end<=announcement.applicationEndAt)throw new BadRequestException('Extension must increase a known deadline');
      }
      const previous=await tx.announcementSourceReference.findUnique({where:{importRowId:id}});if(previous&&previous.announcementId!==announcement.id)throw new ConflictException('Source linked to another announcement');
      await tx.announcementSourceReference.upsert({where:{importRowId:id},create:{importRowId:id,announcementId:announcement.id,evidence:original.sourceEvidence},update:{}});
      await tx.announcement.update({where:{id:announcement.id},data:{status:body.action==='WITHDRAW'?'WITHDRAWN':'PUBLISHED',sourceCheckedAt:new Date(),...(end?{applicationEndAt:end}:{})}});
      const updated=await tx.announcementImportRow.updateMany({where:{id,version:body.version},data:{status:'EVENT_APPLIED',version:{increment:1}}});if(!updated.count)throw new ConflictException();
      await tx.announcementReviewAudit.create({data:{rowId:id,actor,action:body.action,snapshot:{announcementId:announcement.id,evidence:body.evidence,previousEndAt:announcement.applicationEndAt?.toISOString()??null,applicationEndAt:end?.toISOString()??null,sourceEvidence:original.sourceEvidence}}});
      return {status:'EVENT_APPLIED',announcementId:announcement.id};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }
  // Internal scheduler entry point. It can stage only; review/publication still require a user.
  async stageRecords(body:any,actor:string){
    if (!Array.isArray(body?.rows) || body.rows.length > 100) throw new BadRequestException('Maximum 100 rows');
    const records = body.rows.map((raw: any) => {
      const parsed = fields(raw);
      return {raw, parsed, hash: createHash('sha256').update(JSON.stringify(parsed)).digest('hex')};
    });
    return this.db.$transaction(async tx => {
      let created = 0, changed = 0, duplicate = 0;
      for (const r of records) {
        const old = await tx.announcementImportRow.findUnique({where: {sourceUrl: r.parsed.sourceUrl}});
        if (old?.contentHash === r.hash) { duplicate++; continue; }
        if(old?.announcementId){
          await tx.announcement.update({where:{id:old.announcementId},data:{sourceCheckedAt:null}});
          await tx.announcementPosition.updateMany({where:{announcementId:old.announcementId},data:{verifiedAt:null}});
        }
        const data = {contentHash: r.hash, raw: r.raw, parsed: r.parsed, issues: ['Human source verification required'], status: 'PENDING_REVIEW'};
        const row = old ? await tx.announcementImportRow.update({where: {id: old.id}, data: {...data, version: {increment: 1}}}) : await tx.announcementImportRow.create({data: {...data, sourceUrl: r.parsed.sourceUrl}});
        await tx.announcementReviewAudit.create({data: {rowId: row.id, actor, action: old ? 'SOURCE_CHANGED' : 'IMPORTED', snapshot: r.raw}});
        old ? changed++ : created++;
      }
      return {created, changed, duplicate};
    }, {isolationLevel: Prisma.TransactionIsolationLevel.Serializable});
  }
  @Post(':id/review')
  async review(@Param('id') id: string, @Req() req:any, @Body() body: any) {
    const actor = await this.actor(req, ['SYSTEM_ADMIN', 'REVIEWER'],true);
    if (!['APPROVE', 'REJECT', 'PUBLISH', 'ARCHIVE', 'WITHDRAW'].includes(body?.action) || !Number.isInteger(body.version)) throw new BadRequestException();
    return this.db.$transaction(async tx => {
      const row = await tx.announcementImportRow.findUnique({where: {id}});
      if (!row || row.version !== body.version) throw new ConflictException('Refresh record before reviewing');
      if(body.action==='REJECT'){const changed=await tx.announcementImportRow.updateMany({where:{id,version:body.version},data:{status:'REJECTED',version:{increment:1}}});if(!changed.count)throw new ConflictException();await tx.announcementReviewAudit.create({data:{rowId:id,actor,action:'REJECT',snapshot:{evidence:typeof body.evidence==='string'?body.evidence.slice(0,2000):null}}});return {id,status:'REJECTED',announcementId:row.announcementId};}
      if(['ARCHIVE','WITHDRAW'].includes(body.action)&&row.announcementId){const status=body.action==='ARCHIVE'?'ARCHIVED':'WITHDRAWN';await tx.announcement.update({where:{id:row.announcementId},data:{status}});const changed=await tx.announcementImportRow.updateMany({where:{id,version:body.version},data:{status,version:{increment:1}}});if(!changed.count)throw new ConflictException();await tx.announcementReviewAudit.create({data:{rowId:id,actor,action:body.action,snapshot:{announcementId:row.announcementId,evidence:typeof body.evidence==='string'?body.evidence.slice(0,2000):null}}});return {id,status,announcementId:row.announcementId};}
      const original=row.sourceDocumentId?row.raw as any:undefined;
      const parsed = fields(body.fields ?? row.parsed,original);
      const career=(row.raw as any)?.sourceId==='career'?row.raw as any:null;
      if(career)parsed.sourceEvidence=careerEvidence(career);
      if(career&&['APPROVE','PUBLISH'].includes(body.action)){
       if(career.categoryCode!=='PERSONNEL'||career.eventType!=='RECRUITMENT'||career.announcedAt&&Date.parse(career.announcedAt)>Date.now())throw new BadRequestException('Career category, future date or event requires separate review');
       if(!parsed.applicationStartAt||!parsed.applicationEndAt||body.action==='APPROVE'&&body.careerDetailsVerified!==true)throw new BadRequestException('Official employer and application dates must be explicitly verified');
      }
      if (!original && parsed.sourceUrl !== row.sourceUrl) throw new BadRequestException('Source identity cannot change');
      const action = body.action;
      if (action === 'APPROVE' && (body.sourceVerified !== true || typeof body.evidence !== 'string' || body.evidence.trim().length < 10)) throw new BadRequestException('Source verification evidence required');
      if(original && action==='APPROVE'){
        if(body.documentVerified!==true || body.positionsReviewed!==true || body.resolvedIssues!==true)throw new BadRequestException('PDF pages, positions and flagged issues must be explicitly reviewed');
        if(original.eventType!=='RECRUITMENT')throw new BadRequestException('Correction/cancellation requires existing-announcement review; not a new recruitment publication');
        parsed.positionsReviewed=true;
      }
      if (action === 'PUBLISH' && row.status !== 'APPROVED') throw new BadRequestException('Approval required');
      if(action==='PUBLISH' && await tx.announcementSourceReference.findUnique({where:{importRowId:id}}))throw new BadRequestException('This source is linked to an existing announcement; no duplicate publication allowed');
      const sorted=(value:any):any=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,sorted(value[k])])):value;
      const canonical = (value: any) => JSON.stringify(sorted(value));
      if (action === 'PUBLISH' && canonical(parsed) !== canonical(row.parsed)) throw new BadRequestException('Changed fields require approval');
      let announcementId = row.announcementId;
      if (action === 'PUBLISH') {
        const source=newsSourceRecord(parsed.sourceUrl)||(row.sourceDocumentId?registry.gazette:undefined);
        if(!source||await new SourceRightsStore(tx as any).status(source)!=='LICENSE_VERIFIED')throw new ForbiddenException('Source license review required');
        const {positions,positionsReviewed,...announcementFields}=parsed;
        const data = {...announcementFields, status: 'PUBLISHED', publishedAt: new Date(), sourceCheckedAt: row.updatedAt};
        const announcement = announcementId ? await tx.announcement.update({where: {id: announcementId}, data}) : await tx.announcement.create({data});
        announcementId = announcement.id;
        if(original){
          if(!positionsReviewed)throw new BadRequestException('PDF position review required');
          const currentIds=positions.map((position:any)=>createHash('sha256').update(`gazette-position:${announcementId}:${position.parserPositionKey}`).digest('hex'));
          await tx.announcementPosition.deleteMany({where:{announcementId,id:{notIn:currentIds}}});
          for(const position of positions){
            const id=createHash('sha256').update(`gazette-position:${announcementId}:${position.parserPositionKey}`).digest('hex');
            const positionData={announcementId,title:position.title,city:position.city,quota:position.quota,requirements:position.requirements,sourceUrl:parsed.sourceUrl,sourceEvidence:{...position.sourceEvidence,pdfSha256:original.sourceEvidence.pdfSha256,documentSha256:original.sourceEvidence.documentSha256??original.sourceEvidence.pdfSha256},verifiedAt:row.updatedAt};
            await tx.announcementPosition.upsert({where:{id},create:{id,...positionData},update:positionData});
          }
        }
      }
      if (['ARCHIVE', 'WITHDRAW'].includes(action) && announcementId) await tx.announcement.update({where: {id: announcementId}, data: {status: action === 'ARCHIVE' ? 'ARCHIVED' : 'WITHDRAWN'}});
      const status = ({APPROVE: 'APPROVED', REJECT: 'REJECTED', PUBLISH: 'PUBLISHED', ARCHIVE: 'ARCHIVED', WITHDRAW: 'WITHDRAWN'} as any)[action];
      const updated = await tx.announcementImportRow.updateMany({where: {id, version: body.version}, data: {parsed, status, announcementId, issues: [], version: {increment: 1}}});
      if (updated.count !== 1) throw new ConflictException();
      await tx.announcementReviewAudit.create({data: {rowId: id, actor, action, snapshot: {parsed, evidence: body.evidence ?? null}}});
      return {id, status, announcementId};
    }, {isolationLevel: Prisma.TransactionIsolationLevel.Serializable});
  }
}
