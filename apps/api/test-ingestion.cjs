require('./test-source-fixtures.cjs').permitManualFixtures();
const assert = require('node:assert/strict');
const {createHmac, randomBytes} = require('node:crypto');
const {execFileSync} = require('node:child_process');
require('reflect-metadata');
if (!process.env.DATABASE_URL?.includes('/kadroradar_ingestion_test_')) throw Error('Isolated test DB required');
process.env.ANNOUNCEMENT_AUTH_SECRET = randomBytes(48).toString('hex');
process.env.NOTIFICATIONS_ENABLED='false';
const {NestFactory} = require('@nestjs/core');
const {AppModule} = require('./dist/module');
const {PrismaClient} = require('@prisma/client');
function token(role) {
 const iat = Math.floor(Date.now()/1000);
 const payload = Buffer.from(JSON.stringify({sub:'fixture-test',role,aud:'announcement-admin',iat,exp:iat+600})).toString('base64url');
 return payload+'.'+createHmac('sha256',process.env.ANNOUNCEMENT_AUTH_SECRET).update(payload).digest('base64url');
}
(async () => {
 const db = new PrismaClient(); const app = await NestFactory.create(AppModule, {logger:false});
 app.setGlobalPrefix('api/v1'); await app.listen(0,'127.0.0.1');
 const base = await app.getUrl()+'/api/v1';
 async function request(path, body, role='SYSTEM_ADMIN', expected=200) {
   const response = await fetch(base+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+token(role),'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
   const value = await response.json(); assert.equal(response.status,expected,JSON.stringify(value)); return value;
 }
 try {
  const code = "import sys,json;sys.path.insert(0,'../../services/ingest');from official_rss import parse_feed;print(json.dumps(parse_feed(open('../../services/ingest/fixtures/energy-personnel.xml','rb').read())))";
  const rows = JSON.parse(execFileSync('python',['-c',code],{encoding:'utf8',cwd:__dirname}));
  const initialOpen=(await request('/announcements')).total;
  const initialArchive=(await request('/announcements/archive')).total;
  rows[0].sourceUrl += '-'+Date.now();
  const ingest = () => request('/admin/announcement-imports',{rows},'CONTENT_EDITOR',201);
  assert.equal((await ingest()).created,1); assert.equal((await ingest()).duplicate,1);
  await request('/admin/announcement-imports',{rows},'REVIEWER',403);
  let all = await request('/admin/announcement-imports'); let row=all.find(r=>r.sourceUrl===rows[0].sourceUrl);
  assert.equal((await request('/announcements')).total,initialOpen);
  const now = Date.now();
  const fields = {...row.parsed,applicationStartAt:new Date(now-3600000).toISOString(),applicationEndAt:new Date(now+3600000).toISOString(),applicationUrl:'https://enerji.gov.tr/test-fixture-only'};
  async function action(action,fieldsArg=fields) {
   row=(await request('/admin/announcement-imports')).find(r=>r.id===row.id);
   return request('/admin/announcement-imports/'+row.id+'/review',{version:row.version,action,fields:fieldsArg,sourceVerified:true,evidence:'Synthetic fixture verification only'},'REVIEWER',201);
  }
  await action('APPROVE'); const published=await action('PUBLISH');
  let page=await request('/announcements'); assert.equal(page.total,initialOpen+1); assert.ok(page.items.some(item=>item.id===published.announcementId));
  const detail=await request('/announcements/'+published.announcementId); assert.equal(detail.sourceUrl,rows[0].sourceUrl); assert.ok(detail.sourceCheckedAt);
  const checkedPosition=await db.announcementPosition.create({data:{announcementId:published.announcementId,title:'Synthetic verified position',requirements:{complete:true,kpssRequired:false},sourceUrl:rows[0].sourceUrl,verifiedAt:new Date()}});
  const change=await request('/admin/announcement-imports',{rows:[{...rows[0],title:rows[0].title+' changed'}]},'CONTENT_EDITOR',201);assert.equal(change.changed,1);
  assert.equal((await db.announcement.findUnique({where:{id:published.announcementId}})).sourceCheckedAt,null);
  assert.equal((await db.announcementPosition.findUnique({where:{id:checkedPosition.id}})).verifiedAt,null);
  await request('/announcements/'+published.announcementId,undefined,'SYSTEM_ADMIN',404);
  await action('APPROVE');await action('PUBLISH');
  await action('WITHDRAW'); assert.equal((await request('/announcements')).total,initialOpen);
  await request('/announcements/'+published.announcementId,undefined,'SYSTEM_ADMIN',404);
  await action('APPROVE',{...fields,applicationEndAt:new Date(now-1000).toISOString()});
  await action('PUBLISH',{...fields,applicationEndAt:new Date(now-1000).toISOString()});
  assert.equal((await request('/announcements/archive')).total,initialArchive+1);
  console.log('PASS: fixture parse → PostgreSQL staging → duplicate → RBAC → approval → publish → public list/detail → withdraw → archive');
 } finally {await app.close(); await db.$disconnect();}
})().catch(e=>{console.error(e);process.exitCode=1;});
