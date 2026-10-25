import {SourceOperations,SourceOperationsController} from './source-operations';
import { BadRequestException, Controller, Get, Injectable, Module, NotFoundException, OnModuleDestroy, Param, Query } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { AnnouncementAdminController, IngestionDb } from './announcement-admin';
import {CandidateModule} from './candidate';

@Injectable()
class AnnouncementsDb extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy() { await this.$disconnect(); }
}

const intParam = (value: string | undefined, fallback: number, max: number) => {
  const n = Number(value);
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(n) || n < 1 || n > max)
    throw new BadRequestException('Invalid pagination parameter');
  return n;
};
const clean = (value: string | undefined, max = 100) => (value || '').trim().slice(0, max);
const publicFields = {
  id: true, title: true, organization: true, city: true, district: true,
  positionTitle: true, quota: true, educationLevel: true, summary: true,
  requirements: true, sourceUrl: true, applicationUrl: true,
  applicationStartAt: true, applicationEndAt: true, announcedAt: true,
  sourceCheckedAt: true, publishedAt: true,
  sourceEvidence:true,
  sourceReferences:{select:{evidence:true}},
  positions: {select:{id:true,title:true,city:true,quota:true,requirements:true,sourceUrl:true,sourceEvidence:true,verifiedAt:true}},
} as const;

@Controller('announcements')
class AnnouncementsController {
  constructor(private readonly db: AnnouncementsDb) {}

  @Get('archive')
  archive(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.list('archive', undefined, undefined, undefined, page, limit);
  }

  @Get('filters')
  async filters() {
    const rows = await this.db.announcement.findMany({
      where: { status: 'PUBLISHED', publishedAt: { lte: new Date() }, sourceCheckedAt: { not: null } },
      select: { city: true, organization: true, educationLevel: true },
      distinct: ['city', 'organization', 'educationLevel'],
    });
    const values = (key: keyof typeof rows[number]) => [...new Set(rows.map(row => row[key]).filter(Boolean))].sort();
    return { cities: values('city'), organizations: values('organization'), educationLevels: values('educationLevel') };
  }

  // /api/v1/announcements?view=open|archive|all&city=&organization=&q=&page=1&limit=20
  @Get()
  async list(
    @Query('view') view = 'open',
    @Query('city') city?: string,
    @Query('organization') organization?: string,
    @Query('q') q?: string,
    @Query('page') pageArg?: string,
    @Query('limit') limitArg?: string,
  ) {
    const page = intParam(pageArg, 1, 100000);
    const limit = intParam(limitArg, 20, 50);
    const now = new Date();
    const where: Prisma.AnnouncementWhereInput = {
      status: { in: ['PUBLISHED', 'ARCHIVED'] },
      publishedAt: { not: null, lte: now },
      sourceCheckedAt: { not: null },
    };
    const openOrFuture = { applicationStartAt: { lte: now }, applicationEndAt: { gte: now } };
    const closed = { applicationEndAt: { lt: now } };
    if (view === 'open') {
      where.AND = [{ status: 'PUBLISHED' }, openOrFuture];
    } else if (view === 'archive') {
      where.AND = [{ OR: [{ status: 'ARCHIVED' }, closed] }];
    } else if (view !== 'all') {
      throw new BadRequestException('view must be open, archive or all');
    }
    const c = clean(city), o = clean(organization), search = clean(q);
    if (c) where.city = { contains: c, mode: 'insensitive' };
    if (o) where.organization = { contains: o, mode: 'insensitive' };
    if (search) {
      const and = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
      where.AND = [...and, { OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { organization: { contains: search, mode: 'insensitive' } },
        { positionTitle: { contains: search, mode: 'insensitive' } },
      ] }];
    }
    const [items, total] = await this.db.$transaction([
      this.db.announcement.findMany({ where, select: publicFields,
        orderBy: [{ announcedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit, take: limit }),
      this.db.announcement.count({ where }),
    ]);
    return { items, page, limit, pages: Math.ceil(total / limit), total };
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    const item = await this.db.announcement.findFirst({
      where: { id, status: { in: ['PUBLISHED', 'ARCHIVED'] }, sourceCheckedAt: { not: null }, publishedAt: { not: null, lte: new Date() } },
      select: publicFields,
    });
    if (!item) throw new NotFoundException('İlan bulunamadı');
    return item;
  }
}

@Module({ imports:[CandidateModule], controllers: [AnnouncementsController, AnnouncementAdminController,SourceOperationsController], providers: [AnnouncementsDb, IngestionDb,SourceOperations] })
export class AnnouncementsModule {}
