import {BadRequestException, Body, Controller, Delete, Get, Headers, Injectable, Module, OnModuleDestroy, Param, Post, Put, Req, Res, UnauthorizedException, ForbiddenException} from '@nestjs/common';
import {PrismaClient} from '@prisma/client';
import {randomBytes, createHash} from 'node:crypto';
import {passwordHash,passwordMatches} from './password';
import {evaluate, Requirements} from './eligibility';
import {resolve} from 'node:path';
import {NotificationService} from './notifications';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
@Injectable()
export class CandidateDb extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy() {await this.$disconnect();}
}
@Injectable()
export class CandidateAuth {
  constructor(private db: CandidateDb) {}
  async user(req: any, mutate = false) {
    const cookie = (req.headers.cookie || '').split(';').map((v: string) => v.trim()).find((v: string) => v.startsWith('kr_session='))?.slice(11);
    const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined;
    const token = bearer || cookie;
    if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new UnauthorizedException();
    const session = await this.db.candidateSession.findUnique({where: {id: hash(token)}, include: {user: true}});
    if (!session || session.expiresAt <= new Date() || session.user.deletedAt) throw new UnauthorizedException();
    if (mutate && !bearer && hash(req.headers['x-csrf-token'] || '') !== session.csrfHash) throw new ForbiddenException('CSRF token required');
    return session.user;
  }
  async role(req: any, roles: string[], mutate = false) {
    const user = await this.user(req, mutate);
    if (!roles.includes(user.role)) throw new ForbiddenException();
    return user;
  }
}
@Controller('account')
export class CandidateController {
  constructor(private db: CandidateDb, private auth: CandidateAuth, private notifications:NotificationService) {}
  private async rate(req:any,scope:string,limit:number){
    const key=hash(`${scope}:${req.ip || req.socket.remoteAddress || 'unknown'}`);
    const accepted=await this.db.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      const now=new Date();await tx.authRateLimit.deleteMany({where:{until:{lt:now}}});
      const value=await tx.authRateLimit.upsert({where:{id:key},create:{id:key,count:1,until:new Date(Date.now()+15*60000)},update:{count:{increment:1}}});
      return value.count<=limit;
    });
    if(!accepted)throw new ForbiddenException('Too many authentication attempts');
  }
  @Post('register')
  async register(@Body() body: any,@Req() req:any) {
    await this.rate(req,'register',10);
    if (process.env.ALLOW_SELF_REGISTRATION !== 'true') throw new ForbiddenException('Registration disabled');
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128) throw new BadRequestException('Valid email and 12–128 character password required');
    const stored = await passwordHash(body.password);
    try {await this.db.user.create({data: {email, passwordHash:stored, role: 'USER'}});} catch {throw new BadRequestException('Account could not be created');}
    return {created: true};
  }
  @Post('login')
  async login(@Body() body: any, @Req() req: any, @Res({passthrough: true}) res: any) {
    const now = Date.now();
    await this.rate(req,'login',10);
    const origin=req.headers.origin;
    if(origin){const allowed=(process.env.CORS_ORIGINS||'http://localhost:5173').split(',').map(x=>x.trim());if(!allowed.includes(origin))throw new ForbiddenException('Origin rejected');}
    if (typeof body?.password !== 'string' || body.password.length > 128 || typeof body.email !== 'string') throw new UnauthorizedException();
    const user = await this.db.user.findUnique({where: {email: body.email.trim().toLowerCase()}});
    const valid=await passwordMatches(body.password,user?.passwordHash);
    if (!user || user.deletedAt || !valid) throw new UnauthorizedException();
    const token = randomBytes(32).toString('hex'), csrf = randomBytes(32).toString('hex');
    const expiresAt = new Date(now + 8 * 3600000);
    await this.db.candidateSession.create({data: {id: hash(token), userId: user.id, csrfHash: hash(csrf), expiresAt}});
    res.setHeader('Cache-Control','no-store');
    res.cookie('kr_session',token,{httpOnly:true,secure:process.env.NODE_ENV === 'production',sameSite:'strict',maxAge:8*3600000,path:'/api/v1'});
    return {csrfToken: csrf, expiresAt, role:user.role, ...(req.headers['x-client-platform'] === 'mobile' ? {token} : {})};
  }
  @Post('logout')
  async logout(@Req() req: any, @Res({passthrough:true}) res: any) {
    const user = await this.auth.user(req, true);
    await this.db.$transaction([this.db.candidateSession.deleteMany({where:{userId:user.id}}),this.db.candidateProfile.updateMany({where:{userId:user.id},data:{pushToken:null,notificationConsent:false}})]);
    res.clearCookie('kr_session',{path:'/api/v1'}); return {loggedOut:true};
  }
  @Get('profile')
  async profile(@Req() req: any) {const user = await this.auth.user(req); return this.db.candidateProfile.findUnique({where:{userId:user.id}});}
  @Get('data')
  async exportData(@Req() req:any){const user=await this.auth.user(req);return {account:{email:user.email,createdAt:user.createdAt},profile:await this.db.candidateProfile.findUnique({where:{userId:user.id},select:{educationLevel:true,exactDegreeProgramCode:true,kpssScore:true,kpssScoreType:true,examYear:true,preferredCities:true,ydsScore:true,certificates:true,notificationConsent:true}}),saved:await this.db.savedAnnouncement.findMany({where:{userId:user.id},select:{announcementId:true,createdAt:true}})};}
  @Put('push')
  async push(@Req() req:any,@Body() body:any){const user=await this.auth.user(req,true);if(typeof body?.enabled!=='boolean' || (body.enabled && (typeof body.token!=='string'||! /^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/.test(body.token))))throw new BadRequestException();return this.db.candidateProfile.upsert({where:{userId:user.id},create:{userId:user.id,notificationConsent:body.enabled,pushToken:body.enabled?body.token:null},update:{notificationConsent:body.enabled,pushToken:body.enabled?body.token:null}});}
  @Post('notifications/refresh')
  async refreshNotifications(@Req() req:any){const user=await this.auth.user(req,true);return this.notifications.plan(user.id);}
  @Get('notifications')
  async notificationList(@Req() req:any){const user=await this.auth.user(req);return this.db.candidateNotification.findMany({where:{userId:user.id},take:50,orderBy:{createdAt:'desc'},select:{id:true,announcementId:true,kind:true,title:true,status:true,createdAt:true}});}
  @Put('profile')
  async update(@Req() req: any, @Body() body: any) {
    const user = await this.auth.user(req,true); const data: any = {};
    for (const key of ['educationLevel','exactDegreeProgramCode','kpssScoreType']) {
      if (body[key] != null && (typeof body[key] !== 'string' || body[key].length > 100)) throw new BadRequestException(key);
      if (body[key] !== undefined) data[key] = body[key];
    }
    for (const key of ['kpssScore','ydsScore']) {if (body[key] != null && (typeof body[key] !== 'number' || !Number.isFinite(body[key]) || body[key]<0 || body[key]>100)) throw new BadRequestException(key); if(body[key] !== undefined) data[key]=body[key];}
    if(body.examYear != null && (!Number.isInteger(body.examYear) || body.examYear<2000 || body.examYear>new Date().getUTCFullYear())) throw new BadRequestException('examYear');
    if(body.examYear !== undefined) data.examYear=body.examYear;
    for(const key of ['preferredCities','certificates']) {if(body[key] !== undefined){if(!Array.isArray(body[key]) || body[key].length>100 || body[key].some((v:any)=>typeof v!=='string' || v.length>100))throw new BadRequestException(key);data[key]=[...new Set(body[key])];}}
    if(body.notificationConsent !== undefined){if(typeof body.notificationConsent !== 'boolean')throw new BadRequestException();data.notificationConsent=body.notificationConsent;}
    return this.db.candidateProfile.upsert({where:{userId:user.id},create:{userId:user.id,...data},update:data});
  }
  @Get('saved')
  async saved(@Req() req:any){const user=await this.auth.user(req);return this.db.savedAnnouncement.findMany({where:{userId:user.id},include:{announcement:true},orderBy:{announcement:{applicationEndAt:'asc'}},take:100});}
  @Put('saved/:id')
  async save(@Req() req:any,@Param('id') id:string){const user=await this.auth.user(req,true);const item=await this.db.announcement.findFirst({where:{id,status:{in:['PUBLISHED','ARCHIVED']},publishedAt:{lte:new Date()},sourceCheckedAt:{not:null}}});if(!item)throw new BadRequestException('Public announcement required');return this.db.savedAnnouncement.upsert({where:{userId_announcementId:{userId:user.id,announcementId:id}},create:{userId:user.id,announcementId:id,lastKnownEndAt:item.applicationEndAt},update:{}});}
  @Delete('saved/:id')
  async unsave(@Req() req:any,@Param('id') id:string){const user=await this.auth.user(req,true);await this.db.savedAnnouncement.deleteMany({where:{userId:user.id,announcementId:id}});return {removed:true};}
  @Get('matches/:id')
  async matches(@Req() req:any,@Param('id') id:string){const user=await this.auth.user(req);const profile=await this.db.candidateProfile.findUnique({where:{userId:user.id}});const item=await this.db.announcement.findFirst({where:{id,status:'PUBLISHED',publishedAt:{lte:new Date()},sourceCheckedAt:{not:null}},include:{positions:true}});if(!item)throw new BadRequestException('Public announcement required');return {items:item.positions.map(position=>({positionId:position.id,title:position.title,...evaluate(profile??{},position.requirements as Requirements,!!position.verifiedAt)})),emptyReason:item.positions.length?null:'Doğrulanmış kadro bilgisi henüz eklenmemiş.'};}
  @Get('matches')
  async matchingList(@Req() req:any){const user=await this.auth.user(req);const page=Number(req.query.page??1);if(!Number.isSafeInteger(page)||page<1||page>10000)throw new BadRequestException('page');const profile=await this.db.candidateProfile.findUnique({where:{userId:user.id}});const now=new Date();const where={status:'PUBLISHED',publishedAt:{lte:now},sourceCheckedAt:{not:null},applicationStartAt:{lte:now},applicationEndAt:{gte:now}};const [items,total]=await this.db.$transaction([this.db.announcement.findMany({where,include:{positions:true},skip:(page-1)*20,take:20,orderBy:[{applicationEndAt:'asc'},{id:'asc'}]}),this.db.announcement.count({where})]);return {items:items.map(item=>({id:item.id,title:item.title,organization:item.organization,positions:item.positions.map(p=>({id:p.id,title:p.title,...evaluate(profile??{},p.requirements as Requirements,!!p.verifiedAt)}))})),page,pages:Math.ceil(total/20),total};}
  @Delete()
  async remove(@Req() req:any){const user=await this.auth.user(req,true);await this.db.$transaction(async tx=>{await tx.candidateSession.deleteMany({where:{userId:user.id}});await tx.savedAnnouncement.deleteMany({where:{userId:user.id}});await tx.candidateNotification.deleteMany({where:{userId:user.id}});await tx.candidateProfile.deleteMany({where:{userId:user.id}});await tx.user.update({where:{id:user.id},data:{email:`deleted-${randomBytes(16).toString('hex')}@invalid.local`,passwordHash:'deleted',deletedAt:new Date()}});});return {deleted:true};}
}
@Controller('admin/announcements')
export class PositionController {
  constructor(private db: CandidateDb, private auth: CandidateAuth) {}
  @Get(':id/positions')
  async list(@Req() req:any,@Param('id') id:string){await this.auth.role(req,['SYSTEM_ADMIN','REVIEWER','CONTENT_EDITOR']);return this.db.announcementPosition.findMany({where:{announcementId:id},orderBy:{id:'asc'}});}
  @Post(':id/positions')
  async position(@Req() req:any, @Param('id') id:string, @Body() body:any) {
    const actor = await this.auth.role(req,['SYSTEM_ADMIN','REVIEWER'],true);
    if (!body || typeof body.title !== 'string' || !body.title.trim() || body.title.length>200 || typeof body.evidence !== 'string' || body.evidence.length<10 || !body.requirements || typeof body.requirements !== 'object' || Array.isArray(body.requirements)) throw new BadRequestException();
    const registry = require(resolve(__dirname,'../../../packages/official-sources.json'));
    let source:URL; try {source=new URL(body.sourceUrl);}catch{throw new BadRequestException('sourceUrl');}
    if(source.protocol!=='https:' || source.username || source.password || (source.port && source.port!=='443') || !Object.values(registry).some((s:any)=>s.hosts.includes(source.hostname))) throw new BadRequestException('sourceUrl');
    const r=body.requirements;
    const allowed=['complete','educationLevels','degreeCodes','degreeCodesVerified','kpssRequired','kpssScoreType','kpssMinimumScore','examYears','ydsMinimumScore','certificates','otherConditions'];
    if(Object.keys(r).some(key=>!allowed.includes(key)))throw new BadRequestException('Unknown criterion');
    for(const key of ['complete','degreeCodesVerified','kpssRequired'])if(r[key]!==undefined && typeof r[key]!=='boolean')throw new BadRequestException(key);
    for(const key of ['educationLevels','degreeCodes','certificates','otherConditions'])if(r[key]!==undefined && (!Array.isArray(r[key]) || r[key].length>100 || r[key].some((v:any)=>typeof v!=='string'|| !v || v.length>500)))throw new BadRequestException(key);
    for(const key of ['kpssMinimumScore','ydsMinimumScore'])if(r[key]!==undefined && (typeof r[key]!=='number'||!Number.isFinite(r[key])||r[key]<0||r[key]>100))throw new BadRequestException(key);
    if(r.kpssScoreType!==undefined && (typeof r.kpssScoreType!=='string'||r.kpssScoreType.length>50))throw new BadRequestException();
    if(r.examYears!==undefined && (!Array.isArray(r.examYears)||r.examYears.length>20||r.examYears.some((y:any)=>!Number.isInteger(y)||y<2000||y>2100)))throw new BadRequestException();
    if(body.quota!=null && (!Number.isInteger(body.quota)||body.quota<1))throw new BadRequestException('quota');
    if(body.city!=null && (typeof body.city!=='string'||body.city.length>100))throw new BadRequestException('city');
    return this.db.$transaction(async tx=>{
      const existing = body.id ? await tx.announcementPosition.findFirst({where:{id:body.id,announcementId:id}}) : null;
      if(body.id && !existing)throw new BadRequestException('Position identity');
      const data={announcementId:id,title:body.title,city:body.city??null,quota:body.quota??null,requirements:r,sourceUrl:source.toString(),verifiedAt:new Date()};
      const result=existing?await tx.announcementPosition.update({where:{id:existing.id},data}):await tx.announcementPosition.create({data});
      await tx.announcement.update({where:{id},data:{updatedAt:new Date()}});
      const row=await tx.announcementImportRow.findFirst({where:{announcementId:id}});
      if(row)await tx.announcementReviewAudit.create({data:{rowId:row.id,actor:actor.id,action:'POSITION_VERIFIED',snapshot:{positionId:result.id,requirements:r,evidence:body.evidence}}});
      return result;
    });
  }
}
@Module({controllers:[CandidateController,PositionController],providers:[CandidateDb,CandidateAuth,NotificationService],exports:[CandidateAuth,CandidateDb]})
export class CandidateModule {}
