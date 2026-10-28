import { Module, Controller, Get, Param, Query, Injectable, OnModuleDestroy, NotFoundException, UnauthorizedException, BadRequestException, Headers, Post, Body, ServiceUnavailableException } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { AnnouncementsModule } from './announcements.controller';
import { CandidateModule, CandidateAuth } from './candidate';
import {GazetteModule} from './gazette';
import {HistoricalImportModule} from './historical-import';
import { Req } from '@nestjs/common';
import {APP_FILTER} from '@nestjs/core';
import {DatabaseErrorFilter} from './database-errors';

@Injectable()
class Db extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy() { await this.$disconnect(); }
}

function integerInRange(input: string | undefined, fallback: number, min: number, max: number): number {
  if (input === undefined || input.trim() === '') return fallback;
  const parsed = Number(input);
  return Number.isSafeInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}
function decimalOrUndefined(input?: string): Prisma.Decimal | undefined {
  if (!input || !/^\d{1,3}([.,]\d{1,5})?$/.test(input)) return undefined;
  return new Prisma.Decimal(input.replace(',', '.'));
}

// Compare decimal values numerically: 67.67600 and 67.676 are equivalent.
// Missing or malformed values must not silently pass validation.
function sameScore(stored: Prisma.Decimal | null, imported: unknown): boolean {
  if (stored === null || stored === undefined) return imported === null;
  if (typeof imported !== 'string' && typeof imported !== 'number') return false;
  try {
    const normalized = String(imported).replace(',', '.');
    if (!/^\d{1,3}(\.\d{1,5})?$/.test(normalized)) return false;
    return stored.equals(new Prisma.Decimal(normalized));
  } catch {
    return false;
  }
}

@Controller()
class ApiController {
  constructor(private readonly db: Db) {}

  @Get('health')
  async health() {try{await this.db.$queryRaw`SELECT 1`;const sha=process.env.RENDER_GIT_COMMIT;return {status:'ok',database:'ready',...(sha&&/^[a-f0-9]{40}$/.test(sha)?{release:{commit:sha}}:{})};}catch{throw new ServiceUnavailableException('Database unavailable');} }

  @Get('historical/rounds')
  rounds() {
    return this.db.placementRound.findMany({
      where: { placements: { some: { approvedAt: { not: null } } } },
      orderBy: [{ year: 'desc' }, { sequenceNo: 'desc' }],
      select: { id: true, year: true, sequenceNo: true, educationLevel: true },
    });
  }

  @Get('historical/placements')
  async placements(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('city') city?: string,
    @Query('title') title?: string,
    @Query('institution') institution?: string,
    @Query('year') year?: string,
    @Query('round') round?: string,
    @Query('educationLevel') educationLevel?: string,
    @Query('minScoreGte') minScoreGte?: string,
    @Query('minScoreLte') minScoreLte?: string,
    @Query('positionCode') positionCode?: string,
    @Query('maxScoreGte') maxScoreGte?: string,
    @Query('maxScoreLte') maxScoreLte?: string,
  ) {
    const p = integerInRange(page, 1, 1, 100000);
    const l = integerInRange(limit, 20, 1, 100);
    const period: Prisma.PlacementRoundWhereInput = {};
    if (year && /^\d{4}$/.test(year)) period.year = Number(year);
    if (round && /^\d+$/.test(round)) period.sequenceNo = Number(round);
    if (educationLevel?.trim()) period.educationLevel = educationLevel.trim()==='SECONDARY'?'HIGH_SCHOOL':educationLevel.trim();
    if(positionCode!==undefined&&!/^[123]\d{8}$/.test(positionCode))throw new BadRequestException('Invalid positionCode');
    const where: Prisma.HistoricalPlacementWhereInput = {
      approvedAt: { not: null },
      ...(positionCode?{positionCode}:{}),
      ...(city?.trim() ? { city: { contains: city.trim(), mode: 'insensitive' } } : {}),
      ...(title?.trim() ? { title: { contains: title.trim(), mode: 'insensitive' } } : {}),
      ...(institution?.trim() ? { institutionRawName: { contains: institution.trim(), mode: 'insensitive' } } : {}),
      ...(Object.keys(period).length ? { round: period } : {}),
    };
    const gte = decimalOrUndefined(minScoreGte);
    const lte = decimalOrUndefined(minScoreLte);
    if (gte || lte) where.minScore = { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
    const maxGte=decimalOrUndefined(maxScoreGte),maxLte=decimalOrUndefined(maxScoreLte);
    for(const [raw,value] of [[minScoreGte,gte],[minScoreLte,lte],[maxScoreGte,maxGte],[maxScoreLte,maxLte]] as const){
      if(raw!==undefined&&raw!==''&&(!value||value.lessThan(0)||value.greaterThan(100)))throw new BadRequestException('Score filter must be a decimal between 0 and 100');
    }
    if(gte&&lte&&gte.greaterThan(lte)||maxGte&&maxLte&&maxGte.greaterThan(maxLte))throw new BadRequestException('Invalid score range');
    if(maxGte||maxLte)where.maxScore={...(maxGte?{gte:maxGte}:{}),...(maxLte?{lte:maxLte}:{})};
    const [items, total] = await this.db.$transaction([
      this.db.historicalPlacement.findMany({
        where, skip: (p - 1) * l, take: l, orderBy: [{positionCode:'asc'},{id:'asc'}],
        select: {
          id: true, positionCode: true, institutionRawName: true, title: true,
          city: true, quota: true, placedCount: true, vacantCount: true,
          minScore: true, maxScore: true, sourcePage: true,
          round: { select: { year: true, sequenceNo: true, educationLevel: true } },
          sourceDocument: { select: { originalUrl: true, originalFilename: true, sourceOrganization: true } },
        },
      }),
      this.db.historicalPlacement.count({ where }),
    ]);
    return { items, total, page: p, limit: l, pages: Math.ceil(total / l),
      filterCapabilities:{minScoreRange:true,maxScoreRange:true},
      qualificationNote: 'Nitelik bilgisi doğrulanmadı: yalnızca tarihsel puan karşılaştırması' };
  }

  @Get('historical/placements/:id')
  async placement(@Param('id') id: string) {
    // Critical: detail must enforce the SAME publication gate as the list.
    const record = await this.db.historicalPlacement.findFirst({
      where: { id, approvedAt: { not: null } },
      select: {
        id: true, positionCode: true, institutionRawName: true, title: true,
        city: true, quota: true, placedCount: true, vacantCount: true,
        minScore: true, maxScore: true, sourcePage: true,
        round: { select: { year: true, sequenceNo: true, educationLevel: true } },
        sourceDocument: { select: { originalUrl: true, originalFilename: true, sourceOrganization: true } },
      },
    });
    if (!record) throw new NotFoundException('Onaylanmış yerleştirme kaydı bulunamadı');
    return { ...record, qualificationNote: 'Nitelik kodları doğrulanmadan uygunluk kararı üretilemez.' };
  }

}


// This review token is a LOCAL DEVELOPMENT credential, not production user authentication.
// Do not expose these endpoints publicly before replacing with authenticated RBAC.
function requireLocalReviewer(auth?: string): void {
  if (process.env.NODE_ENV === 'production') throw new UnauthorizedException('Account session required');
  const configured = process.env.ADMIN_REVIEW_TOKEN;
  if (!configured || configured.length < 32 || !auth?.startsWith('Bearer '))
    throw new UnauthorizedException('Local reviewer token required (minimum 32 characters)');
  const { timingSafeEqual } = require('node:crypto') as typeof import('node:crypto');
  const actual = Buffer.from(auth.substring(7));
  const expected = Buffer.from(configured);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new UnauthorizedException('Invalid reviewer token');
}

@Controller('admin/imports')
class ReviewController {
  constructor(private readonly db: Db, private readonly candidateAuth: CandidateAuth) {}
  private async reviewer(req:any, auth?:string) {
    if(process.env.NODE_ENV !== 'production' && auth && !/Bearer [a-f0-9]{64}$/.test(auth)) {requireLocalReviewer(auth);return 'LOCAL_REVIEW_TOKEN';}
    return (await this.candidateAuth.role(req,['SYSTEM_ADMIN','REVIEWER'],req.method!=='GET')).id;
  }

  @Get()
  async batches(@Req() req:any, @Headers('authorization') authorization?: string) {
    await this.reviewer(req,authorization);
    return this.db.importBatch.findMany({
      orderBy: { createdAt: 'desc' }, take: 100,
      select: { id: true, sourceSha256: true, state: true, rowCount: true, errorCount: true, createdAt: true,
        _count: { select: { rows: true } } },
    });
  }

  @Get(':id')
  async detail(@Param('id') id: string, @Headers('authorization') authorization?: string,
    @Query('page') page?: string, @Req() req?:any) {
    await this.reviewer(req,authorization);
    const batch = await this.db.importBatch.findUnique({ where: { id } });
    if (!batch) throw new NotFoundException('İçe aktarma partisi bulunamadı');
    const p = integerInRange(page, 1, 1, 100000);
    const rows = await this.db.importRow.findMany({ where: { batchId: id },
      orderBy: [{ sourcePage: 'asc' }, { positionCode: 'asc' }], skip: (p - 1) * 30, take: 30 });
    return { batch, items: rows, page: p, limit: 30 };
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string, @Headers('authorization') authorization?: string,
    @Body() body?: { confirmation?: string }, @Req() req?:any) {
    const actor = await this.reviewer(req,authorization);
    return this.db.$transaction(async (tx) => {
      const batch = await tx.importBatch.findUnique({ where: { id } });
      if (!batch) throw new NotFoundException('İçe aktarma partisi bulunamadı');
      if(body?.confirmation!==`${batch.rowCount} KAYDI KONTROL ETTİM`)throw new BadRequestException('Partinin gerçek satır sayısıyla açık teyit gerekiyor');
      if (batch.state !== 'STAGED' || batch.errorCount !== 0 || batch.rowCount <= 0)
        throw new BadRequestException('Parti onaya uygun değil');
      const source = await tx.sourceDocument.findUnique({ where: { sha256: batch.sourceSha256 } });
      if (!source || source.state !== 'DRAFT')
        throw new BadRequestException('Kaynak belge eksik veya durum geçersiz');
      const rows = await tx.importRow.findMany({ where: { batchId: id } });
      if (rows.length !== batch.rowCount || new Set(rows.map(r => r.positionCode)).size !== rows.length)
        throw new BadRequestException('Kayıt sayısı veya kadro kodları tutarsız');
      const codes = rows.map(r => r.positionCode).filter((v): v is string => !!v);
      if (codes.length !== rows.length || rows.some(r => !Array.isArray(r.issues) || (r.issues as unknown[]).length !== 0))
        throw new BadRequestException('Çözümlenmemiş satır hataları bulunuyor');
      const placements = await tx.historicalPlacement.findMany({
        where: { sourceDocumentId: source.id, positionCode: { in: codes } },
      });
      if (placements.length !== rows.length) throw new BadRequestException('Aktarılan yerleştirme satırları eksik');
      const placementByCode = new Map(placements.map(r => [r.positionCode, r]));
      for (const row of rows) {
        const raw = row.raw as Record<string, unknown>;
        const placement = placementByCode.get(row.positionCode!);
        if (!placement || placement.sourcePage !== row.sourcePage || placement.positionCode !== raw.positionCode ||
            placement.quota !== raw.quota || placement.placedCount !== raw.placedCount ||
            placement.vacantCount !== raw.vacantCount || placement.title !== raw.title ||
            placement.institutionRawName !== raw.institutionRawName ||
            !sameScore(placement.minScore, raw.minScore) ||
            !sameScore(placement.maxScore, raw.maxScore))
          throw new BadRequestException(`Kayıt uyuşmazlığı: ${row.positionCode}`);
      }
      // Prevent a second batch for the same SHA from being approved again.
      const duplicate = await tx.importBatch.findFirst({ where: { sourceSha256: batch.sourceSha256,
        state: 'APPROVED', id: { not: id } } });
      if (duplicate) throw new BadRequestException('Bu kaynak daha önce onaylandı');
      const updated = await tx.historicalPlacement.updateMany({
        where: { sourceDocumentId: source.id, positionCode: { in: codes }, approvedAt: null },
        data: { approvedAt: new Date() },
      });
      if (updated.count !== rows.length) throw new BadRequestException('Bazı kayıtlar önceden onaylanmış');
      await tx.importBatch.update({ where: { id }, data: { state: 'APPROVED' } });
      await tx.sourceDocument.update({ where: { id: source.id }, data: { state: 'APPROVED' } });
      await tx.reviewAudit.create({ data: { batchId: id, action: 'APPROVE', actor, count: updated.count } });
      return { state: 'APPROVED', approvedCount: updated.count };
    }, { timeout: 15000 });
  }
}

@Module({ imports: [AnnouncementsModule, CandidateModule, GazetteModule,HistoricalImportModule], controllers: [ApiController, ReviewController], providers: [Db,{provide:APP_FILTER,useClass:DatabaseErrorFilter}] })
export class AppModule {}
