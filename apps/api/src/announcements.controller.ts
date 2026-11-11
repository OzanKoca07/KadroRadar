import {SourceOperations,SourceOperationsController} from './source-operations';
import {SourceIngest,SourceIngestController} from './source-ingest';
import { BadRequestException, Controller, Get, Injectable, Module, NotFoundException, OnModuleDestroy, Param, Query } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { AnnouncementAdminController, IngestionDb } from './announcement-admin';
import {CandidateModule} from './candidate';
import {positionFilters} from './announcement-filters';
import {calendarDay} from './application-dates';
import {applicationStatus} from './announcement-status';
import {publicAnnouncement} from './public-announcement';
import {newsMetadata,newsSourceRecord,automaticNewsMetadata} from './home-news';
import {SourceRightsStore} from './source-rights';
import {publicCareerCards} from './career-cards';
import {publicCareerNotices} from './career-notices';
const registry=require(require('node:path').resolve(__dirname,'../../../packages/official-sources.json'));

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
  status:true,
  id: true, title: true, organization: true, city: true, district: true,
  positionTitle: true, quota: true, educationLevel: true,
  sourceUrl: true, applicationUrl: true,
  applicationStartAt: true, applicationEndAt: true, announcedAt: true,
  sourceCheckedAt: true, publishedAt: true,updatedAt:true,
  sourceEvidence:true,
  sourceReferences:{select:{evidence:true,importRow:{select:{sourceUrl:true}}}},
  positions: {select:{id:true,title:true,city:true,quota:true,requirements:true,sourceUrl:true,sourceEvidence:true,verifiedAt:true}},
} as const;

@Controller('announcements')
class AnnouncementsController {
  constructor(private readonly db: AnnouncementsDb) {}

  @Get('rss-cards')
  async rssCards(@Query('page') page?:string,@Query('limit') limit?:string){return publicCareerCards(this.db,intParam(page,1,100000),intParam(limit,20,50));}

  @Get('news')
  async news(){
    const now=new Date();
    const rows=await this.db.announcement.findMany({where:{status:'PUBLISHED',publishedAt:{lte:now},sourceCheckedAt:{not:null},applicationEndAt:{gte:now},sourceEvidence:{path:['homeNews','mode'],equals:'MANUAL_REVIEWED'}},select:publicFields,orderBy:[{publishedAt:'desc'},{id:'desc'}],take:20});
    const items:any[]=[],rights=new SourceRightsStore(this.db);
    for(const row of rows){const item=newsMetadata(row);if(item&&await rights.status(newsSourceRecord(row.sourceUrl))==='LICENSE_VERIFIED')items.push(item);if(items.length===5)break;}
    const automatic=await this.db.announcement.findMany({where:{status:'PUBLISHED',publishedAt:{lte:now},sourceCheckedAt:{not:null},applicationStartAt:{lte:now},applicationEndAt:{gte:now},sourceEvidence:{path:['publicationMode'],equals:'AUTO_VALIDATED'}},select:publicFields,orderBy:[{publishedAt:'desc'},{id:'desc'}],take:20});
    for(const row of automatic){const item=automaticNewsMetadata(row);if(item&&await rights.status(newsSourceRecord(row.sourceUrl))==='LICENSE_VERIFIED'&&!items.some(i=>i.id===item.id))items.push(item);}
    const notices=await publicCareerNotices(this.db);
    return {items:[...items,...notices].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)||a.id.localeCompare(b.id)).slice(0,5)};
  }

  @Get('archive')
  archive(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.list('archive', undefined, undefined, undefined, page, limit);
  }

  @Get('filters')
  async filters() {
    const allowed=await new SourceRightsStore(this.db).status(registry.career)==='LICENSE_VERIFIED';
    const gazetteAllowed=await new SourceRightsStore(this.db).status(registry.gazette)==='LICENSE_VERIFIED';
    const rows = await this.db.announcement.findMany({
      where: { ...(!gazetteAllowed?{AND:[{OR:[{sourceUrl:null},{NOT:{sourceUrl:{startsWith:'https://www.resmigazete.gov.tr/'}}}]}]}:{}),status: 'PUBLISHED', publishedAt: { lte: new Date() }, sourceCheckedAt: { not: null },...(!allowed?{OR:[{sourceUrl:null},{NOT:{sourceUrl:{startsWith:'https://kariyerkapisi.gov.tr/'}}}]}:{}) },
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
    @Query() options:Record<string,string|undefined> = {},
  ) {
    const page = intParam(pageArg, 1, 100000);
    const limit = intParam(limitArg, 20, 50);
    const now = new Date();
    const where: Prisma.AnnouncementWhereInput = {
      status: { in: ['PUBLISHED', 'ARCHIVED'] },
      publishedAt: { not: null, lte: now },
      sourceCheckedAt: { not: null },
    };
    const today=calendarDay(now),through=new Date(Date.parse(today+'T00:00:00Z')+3*86400000).toISOString().slice(0,10);
    const calendar=(end:any,start:any):any=>({applicationStartAt:null,applicationEndAt:null,AND:[{sourceEvidence:{path:['applicationDates','mode'],equals:'CALENDAR'}},{sourceEvidence:{path:['applicationDates','start','date'],...start}},{sourceEvidence:{path:['applicationDates','end','date'],...end}}]});
    const calendarCurrent=calendar({gte:today},{lte:today}),calendarPast:any={applicationEndAt:null,sourceEvidence:{path:['applicationDates','end','date'],lt:today}};
    const openOrFuture = { applicationStartAt: { lte: now }, applicationEndAt: { gt: now } };
    const closed = { applicationEndAt: { lte: now } };
    if (view === 'open') {
      where.AND = [{ status: 'PUBLISHED' },{OR:[openOrFuture,calendarCurrent]}];
    } else if (view === 'archive') {
      where.AND = [{ OR: [{ status: 'ARCHIVED' }, closed,calendarPast] }];
    } else if(view==='closing'){
      where.AND=[{status:'PUBLISHED'},{OR:[{...openOrFuture,applicationEndAt:{gt:now,lte:new Date(+now+3*86400000)}},calendar({gte:today,lte:through},{lte:today})]}];
    } else if(view==='upcoming'){
      where.AND=[{status:'PUBLISHED'},{OR:[{applicationStartAt:{gt:now},applicationEndAt:{gt:now}},calendar({gte:today},{gt:today})]}];
    } else if(view==='date-unverified'){
      where.AND=[{status:'PUBLISHED',OR:[{applicationStartAt:null},{applicationEndAt:null}]},{NOT:{applicationStartAt:null,applicationEndAt:null,sourceEvidence:{path:['applicationDates','mode'],equals:'CALENDAR'}}}];
    } else if (view !== 'all') {
      throw new BadRequestException('view must be open, upcoming, date-unverified, archive or all');
    }
    const c = clean(city), o = clean(organization), search = clean(q);
    if (c) where.OR = [{city:{contains:c,mode:'insensitive'}},{positions:{some:{verifiedAt:{not:null},city:{contains:c,mode:'insensitive'}}}}];
    if (o) where.organization = { contains: o, mode: 'insensitive' };
    if (search) {
      const and = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
      where.AND = [...and, { OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { organization: { contains: search, mode: 'insensitive' } },
        { positionTitle: { contains: search, mode: 'insensitive' } },
      ] }];
    }
    if(options.announcementType){if(options.announcementType.length>250)throw new BadRequestException('Invalid announcement type');const terms=Array.isArray(where.AND)?where.AND:where.AND?[where.AND]:[];where.AND=[...terms,{sourceEvidence:{path:['category'],equals:options.announcementType}}];}
    if(await new SourceRightsStore(this.db).status(registry.career)!=='LICENSE_VERIFIED'){const terms=Array.isArray(where.AND)?where.AND:where.AND?[where.AND]:[];where.AND=[...terms,{OR:[{sourceUrl:null},{NOT:{sourceUrl:{startsWith:'https://kariyerkapisi.gov.tr/'}}}]}];}
    if(await new SourceRightsStore(this.db).status(registry.gazette)!=='LICENSE_VERIFIED'){const terms=Array.isArray(where.AND)?where.AND:where.AND?[where.AND]:[];where.AND=[...terms,{OR:[{sourceUrl:null},{NOT:{sourceUrl:{startsWith:'https://www.resmigazete.gov.tr/'}}}]}];}
    const and=Array.isArray(where.AND)?where.AND:where.AND?[where.AND]:[];
    where.AND=[...and,...positionFilters(options)];
    const [items, total] = await this.db.$transaction([
      this.db.announcement.findMany({ where, select: publicFields,
        orderBy: [{ announcedAt: 'desc' }, { createdAt: 'desc' },{id:'desc'}],
        skip: (page - 1) * limit, take: limit }),
      this.db.announcement.count({ where }),
    ]);
    return { items:items.map(item=>publicAnnouncement({...item,applicationStatus:applicationStatus(item,now)})), page, limit, pages: Math.ceil(total / limit), total };
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    const item = await this.db.announcement.findFirst({
      where: { id, status: { in: ['PUBLISHED', 'ARCHIVED'] }, sourceCheckedAt: { not: null }, publishedAt: { not: null, lte: new Date() } },
      select: publicFields,
    });
    if(item?.sourceUrl?.startsWith('https://kariyerkapisi.gov.tr/')&&await new SourceRightsStore(this.db).status(registry.career)!=='LICENSE_VERIFIED')throw new NotFoundException('İlan bulunamadı');
    if(item?.sourceUrl?.startsWith('https://www.resmigazete.gov.tr/')&&await new SourceRightsStore(this.db).status(registry.gazette)!=='LICENSE_VERIFIED')throw new NotFoundException('İlan bulunamadı');
    if (!item) throw new NotFoundException('İlan bulunamadı');
    return publicAnnouncement({...item,applicationStatus:applicationStatus(item)});
  }
}

@Module({ imports:[CandidateModule], controllers: [AnnouncementsController, AnnouncementAdminController,SourceOperationsController,SourceIngestController], providers: [AnnouncementsDb, IngestionDb,SourceOperations,SourceIngest] })
export class AnnouncementsModule {}
