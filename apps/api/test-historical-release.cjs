// Own fixtures only; never accepts a production/local application database.
require('reflect-metadata');
const assert=require('node:assert/strict'),{randomUUID,randomBytes}=require('node:crypto');
const {PrismaClient}=require('@prisma/client'),{NestFactory}=require('@nestjs/core');
const {AppModule}=require('./dist/module');
const target=new URL(process.env.DATABASE_URL||'postgresql://invalid/invalid');
if(!['localhost','127.0.0.1','[::1]','db'].includes(target.hostname)||!/^\/kadroradar_ingestion_test_[a-zA-Z0-9_]+$/.test(target.pathname))throw Error('Isolated test database required');
process.env.PROCESS_ROLE='api';process.env.SOURCE_SYNC_ENABLED='false';process.env.NOTIFICATIONS_ENABLED='false';
(async()=>{const db=new PrismaClient();let app,source;const rounds=[];
try{
 const before=await db.historicalPlacement.count(),marker=randomUUID();
 source=await db.sourceDocument.create({data:{originalFilename:'synthetic-release-test',sha256:randomBytes(32).toString('hex'),sourceOrganization:'ISOLATED TEST',originalUrl:'https://www.osym.gov.tr/'}});
 for(const sequenceNo of [98,99])rounds.push(await db.placementRound.create({data:{year:1998,sequenceNo,educationLevel:'BACHELOR'}}));
 for(let i=0;i<6;i++)await db.historicalPlacement.create({data:{id:marker+'-'+i,roundId:rounds[i%2].id,sourceDocumentId:source.id,positionCode:String(100+Math.floor(i/2)),institutionRawName:marker,title:'ISOLATED TEST',city:'ANKARA',quota:1,placedCount:1,vacantCount:0,minScore:String(60+i)+'.12345',maxScore:String(80+i)+'.54321',sourcePage:1,rawRecord:{fixture:true},approvedAt:new Date()}});
 app=await NestFactory.create(AppModule,{logger:false});app.setGlobalPrefix('api/v1');await app.listen(0,'127.0.0.1');const base=await app.getUrl()+'/api/v1/historical/placements';
 async function get(query,status=200){const response=await fetch(base+'?institution='+marker+'&'+query);assert.equal(response.status,status);return response.json();}
 const ids=[];for(let page=1;page<=3;page++){const body=await get('limit=2&page='+page);assert.equal(body.total,6);assert.equal(body.pages,3);assert.equal(body.filterCapabilities.maxScoreRange,true);ids.push(...body.items.map(row=>row.id));assert.deepEqual((await get('limit=2&page='+page)).items.map(row=>row.id),body.items.map(row=>row.id));}
 assert.equal(new Set(ids).size,6);assert.deepEqual(ids,[0,1,2,3,4,5].map(i=>marker+'-'+i));
 const filtered=await get('minScoreGte=61.12345&minScoreLte=64.12345&maxScoreGte=82.54321&maxScoreLte=83.54321');assert.equal(filtered.total,2);assert.deepEqual(filtered.items.map(row=>row.id),[marker+'-2',marker+'-3']);
 assert.equal((await get('maxScoreGte=99')).total,0);
 for(const query of ['maxScoreGte=bad','maxScoreLte=101','minScoreGte=-1','minScoreGte=90&minScoreLte=80','maxScoreGte=90&maxScoreLte=80'])await get(query,400);
 console.log('PASS historical release: cross-period duplicate codes, stable unique pagination, Decimal min/max bounds, capability and HTTP400');
 assert.equal(await db.historicalPlacement.count(),before+6);
}finally{
 if(app)await app.close();if(source){await db.historicalPlacement.deleteMany({where:{sourceDocumentId:source.id}});for(const round of rounds)await db.placementRound.delete({where:{id:round.id}});await db.sourceDocument.delete({where:{id:source.id}});}await db.$disconnect();
}})().catch(error=>{console.error(JSON.stringify({event:'HISTORICAL_RELEASE_TEST_FAILED',kind:error.name,prismaCode:/^P\d{4}$/.test(error.code)?error.code:undefined}));process.exitCode=1;});
