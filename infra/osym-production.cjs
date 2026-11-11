// Explicit operator tool. No .env loading, migrations, resets or approvedAt writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash,randomBytes}=require('node:crypto'),{execFileSync}=require('node:child_process');
const {PrismaClient,Prisma}=require('@prisma/client');
const root=path.resolve(__dirname,'..'),work=path.join(root,'.local/osym-production');
const hash=value=>createHash('sha256').update(value).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const tables=['HistoricalPlacement','PlacementRound','Announcement','SourceDocument','ImportBatch','ImportRow','ReviewAudit'];
function target(env,isolated=false){
 const u=new URL(env.OSYM_DATABASE_URL||'');
 if(!['postgres:','postgresql:'].includes(u.protocol)||!u.username||!u.password||u.hash||u.hostname!==env.OSYM_DATABASE_HOST||decodeURIComponent(u.pathname.slice(1))!==env.OSYM_DATABASE_NAME||(u.port||'5432')!==(env.OSYM_DATABASE_PORT||'5432'))throw Error('TARGET_MISMATCH');
 if(!/^[A-Za-z0-9_]{1,63}$/.test(env.OSYM_DATABASE_NAME||''))throw Error('INVALID_DATABASE_NAME');
 if(isolated){if(!['localhost','127.0.0.1'].includes(u.hostname)||!u.pathname.startsWith('/kadroradar_ingestion_test_'))throw Error('ISOLATED_TARGET_REQUIRED');}
 else{
  if(!u.hostname.startsWith('dpg-')||!u.hostname.endsWith('.render.com')||(u.port&&u.port!=='5432'))throw Error('RENDER_EXTERNAL_TARGET_REQUIRED');
  if(u.searchParams.has('host')||u.searchParams.get('sslaccept')==='accept_invalid_certs'||u.searchParams.get('schema')&&u.searchParams.get('schema')!=='public')throw Error('UNSAFE_DATABASE_OPTIONS');
  u.searchParams.set('sslmode','require');u.searchParams.set('sslaccept','strict');
 }
 return {url:u.toString(),host:u.hostname,port:u.port||'5432',database:decodeURIComponent(u.pathname.slice(1))};
}
function sources(){
 const local=read(path.join(work,'verified-sources.json')),official=read(path.join(root,'packages/osym-production-sources.json'));
 assert.equal(local.documents.length,21);assert.equal(official.documents.length,21);
 for(const d of local.documents){const expected=official.documents.find(p=>p.documentSha256===d.documentSha256);assert.ok(expected);for(const key of ['year','round','education','parsed','documentUrl','indexUrl','indexSha256'])assert.equal(d[key],expected[key]);assert.equal(hash(fs.readFileSync(d.file)),d.documentSha256);assert.equal(d.rows.length,d.parsed);}
 return local.documents;
}
function sqlSnapshot(){return 'SELECT jsonb_build_object('+tables.map(t=>`'${t}',(SELECT jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text COLLATE "C"),''))) FROM "${t}" t)`).join(',')+')::text AS snapshot';}
async function snapshot(db){return JSON.parse((await db.$queryRawUnsafe(sqlSnapshot()))[0].snapshot);}
async function preflight(db,t){return db.$transaction(async tx=>{
 await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
 const version=await tx.$queryRaw`SELECT current_setting('server_version_num') AS version`;
 assert.equal(Math.floor(Number(version[0].version)/10000),16,'PostgreSQL16 required');
 const applied=await tx.$queryRaw`SELECT migration_name,checksum,finished_at,rolled_back_at FROM "_prisma_migrations"`;
 const names=fs.readdirSync(path.join(root,'apps/api/prisma/migrations')).filter(n=>fs.existsSync(path.join(root,'apps/api/prisma/migrations',n,'migration.sql')));
 assert.equal(names.length,15);assert.equal(applied.filter(m=>m.finished_at&&!m.rolled_back_at).length,names.length,'Migration status not current');
 for(const name of names){const row=applied.find(m=>m.migration_name===name&&!m.rolled_back_at);assert.ok(row?.finished_at,'Pending migration: '+name);const sql=fs.readFileSync(path.join(root,'apps/api/prisma/migrations',name,'migration.sql'),'utf8');assert.ok([sql,sql.replace(/\r\n/g,'\n'),sql.replace(/\r?\n/g,'\r\n')].some(text=>hash(text)===row.checksum),'Migration checksum mismatch');}
 const precision=await tx.$queryRaw`SELECT numeric_precision,numeric_scale FROM information_schema.columns WHERE table_name='HistoricalPlacement' AND column_name='maxScore'`;
 assert.equal(precision[0].numeric_precision,8);assert.equal(precision[0].numeric_scale,5);
 return {target:{host:t.host,port:t.port,database:t.database},migrations:names.length,postgres:16,snapshot:await snapshot(tx),checkedAt:new Date().toISOString(),readOnly:true};
 });}
function parsed(d){
 const output=execFileSync(process.env.INGEST_PYTHON||'python',[path.join(root,'services/ingest/import_historical.py'),'--file',d.file,'--parse-json'],{encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024,windowsHide:true});const p=JSON.parse(output);
 assert.equal(p.errors.length,0);assert.equal(p.rows.length,d.parsed);for(const key of ['year','round','education'])assert.equal(p.metadata[key],d[key]);assert.deepEqual(p.rows,d.rows);return p.rows;
}
function samePlacement(p,r){
 for(const key of ['positionCode','institutionRawName','title','city','quota','placedCount','vacantCount','sourcePage'])assert.equal(p[key],r[key],key+' differs');
 for(const key of ['minScore','maxScore']){if(r[key]===null)assert.equal(p[key],null);else assert.ok(p[key]!==null&&new Prisma.Decimal(p[key]).equals(r[key]),key+' differs');}
 assert.deepEqual(p.rawRecord,r.rawRecord);
}
async function quality(db,d){
 const batches=await db.importBatch.findMany({where:{sourceSha256:d.documentSha256}});assert.ok(batches.length<=1,'Duplicate source batches');
 if(!batches.length)return null;
 const batch=batches[0],source=await db.sourceDocument.findUnique({where:{sha256:d.documentSha256}});assert.equal(source.originalUrl,d.documentUrl);assert.equal(source.historicalEvidence.documentSha256,d.documentSha256);assert.equal(batch.errorCount,0);assert.equal(batch.rowCount,d.parsed);
 assert.equal(source.state,batch.state==='APPROVED'?'APPROVED':'DRAFT');
 const placements=await db.historicalPlacement.findMany({where:{sourceDocumentId:source.id},include:{round:true}}),staging=await db.importRow.findMany({where:{batchId:batch.id}});
 assert.equal(placements.length,d.parsed);assert.equal(staging.length,d.parsed);
 for(const r of d.rows){const p=placements.find(p=>p.positionCode===r.positionCode),row=staging.find(p=>p.positionCode===r.positionCode);assert.ok(p&&row);samePlacement(p,r);for(const [key,value] of Object.entries({year:d.year,sequenceNo:d.round,educationLevel:d.education}))assert.equal(p.round[key],value);assert.deepEqual(row.raw,r);assert.deepEqual(row.issues,[]);assert.equal(row.sourcePage,r.sourcePage);}
 const approved=placements.filter(p=>p.approvedAt!==null).length;assert.equal(approved,batch.state==='APPROVED'?d.parsed:0);
 return {batchId:batch.id,state:batch.state,staged:placements.length,approved,duplicate:d.parsed};
}
async function dryRun(db,docs){const result=[];for(const d of docs){parsed(d);const prior=await quality(db,d);const round=await db.placementRound.findUnique({where:{year_sequenceNo_educationLevel:{year:d.year,sequenceNo:d.round,educationLevel:d.education}}});if(!prior&&round)assert.equal(await db.historicalPlacement.count({where:{roundId:round.id,positionCode:{in:d.rows.map(r=>r.positionCode)}}}),0,'Existing code conflict');result.push({period:d.period,education:d.education,expected:d.parsed,duplicate:prior?d.parsed:0,new:prior?0:d.parsed,errors:0,unknownScores:d.unknownScores,unknownCities:d.unknownCities,qualificationCodesVerified:false});}return result;}
function docker(args,env=process.env){return execFileSync('docker',args,{env,encoding:'utf8',timeout:180000,windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();}
async function backup(db,t,isolated,state=work){
 const before=await preflight(db,t),stamp=Date.now()+'-'+randomBytes(4).toString('hex'),filename='render-osym-'+stamp+'.dump',folder=path.join(state,'backups');fs.mkdirSync(folder,{recursive:true,mode:0o700});
 const u=new URL(t.url),env={...process.env,PGHOST:isolated?'host.docker.internal':t.host,PGPORT:t.port,PGDATABASE:t.database,PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGCONNECT_TIMEOUT:'15',PGSSLMODE:isolated?'disable':'verify-full',PGSSLROOTCERT:'/etc/ssl/certs/ca-certificates.crt'};
 docker(['run','--rm','-v',folder+':/backup',...['PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGCONNECT_TIMEOUT','PGSSLMODE','PGSSLROOTCERT'].flatMap(k=>['-e',k]),'postgres:16-alpine','pg_dump','--format=custom','--serializable-deferrable','--file=/backup/'+filename],env);
 const name='kadroradar-osym-restore-'+randomBytes(6).toString('hex'),localPassword=randomBytes(24).toString('hex');let restored;
 try{
  docker(['run','-d','--name',name,'--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_USER=fixture','-e','POSTGRES_DB=restore_check','-e','POSTGRES_PASSWORD='+localPassword,'-v',folder+':/backup:ro','postgres:16-alpine']);
  for(let i=0;i<60;i++){try{docker(['exec',name,'pg_isready','-U','fixture','-d','restore_check']);break;}catch{}await new Promise(r=>setTimeout(r,500));}
  docker(['exec',name,'pg_restore','--exit-on-error','--no-owner','--no-acl','-U','fixture','-d','restore_check','/backup/'+filename]);
  restored=JSON.parse(docker(['exec',name,'psql','-U','fixture','-d','restore_check','-At','-c',sqlSnapshot()]));assert.deepEqual(restored,before.snapshot);
  const migrationCount=docker(['exec',name,'psql','-U','fixture','-d','restore_check','-At','-c','SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL']);assert.equal(Number(migrationCount),before.migrations);
  assert.deepEqual((await preflight(db,t)).snapshot,before.snapshot,'Source changed during backup; retry before writing');
 }finally{if(!/^kadroradar-osym-restore-[a-f0-9]{12}$/.test(name))throw Error('Unsafe cleanup target');docker(['rm','-f',name]);}
 const file=path.join(folder,filename),receipt={verified:true,target:before.target,file,sha256:hash(fs.readFileSync(file)),verifiedAt:new Date().toISOString(),snapshot:restored};
 fs.writeFileSync(path.join(state,'backup-receipt.json'),JSON.stringify(receipt,null,2),{mode:0o600});return {verified:true,target:before.target,sha256:receipt.sha256,verifiedAt:receipt.verifiedAt};
}
function requireBackup(t,state=work){const r=read(path.join(state,'backup-receipt.json'));assert.equal(r.verified,true);assert.deepEqual(r.target,{host:t.host,port:t.port,database:t.database});assert.equal(hash(fs.readFileSync(r.file)),r.sha256);assert.ok(Date.now()-Date.parse(r.verifiedAt)<86400000,'Fresh restore-verified backup required');}
let lastHttp=0;
async function api(base,route,token,body){if(base==='https://kadroradar.onrender.com/api/v1'){await new Promise(r=>setTimeout(r,Math.max(0,650-(Date.now()-lastHttp))));lastHttp=Date.now();}const r=await fetch(base+route,{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(120000),headers:{'content-type':'application/json','x-client-platform':'mobile',...(token?{authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});if(!r.ok)throw Error('API_HTTP_'+r.status);return r.json();}
async function actor(db,base){
 const login=await api(base,'/account/login',null,{email:process.env.OSYM_ADMIN_EMAIL,password:process.env.OSYM_ADMIN_PASSWORD});assert.equal(login.role,'SYSTEM_ADMIN','Existing SYSTEM_ADMIN account required');assert.match(login.token,/^[a-f0-9]{64}$/);
 const session=await db.candidateSession.findUnique({where:{id:hash(login.token)},include:{user:true}});assert.ok(session&&session.expiresAt>new Date()&&!session.user.deletedAt&&session.user.role==='SYSTEM_ADMIN','API and database identity mismatch');return {id:session.userId,token:login.token};
}
async function stage(db,d,actorId){
 const rows=parsed(d);
 return db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`historical:${d.documentSha256}`}))`;
  const prior=await quality(tx,d);if(prior)return prior;
  assert.equal(await tx.sourceDocument.count({where:{sha256:d.documentSha256}}),0,'Existing source without import batch requires reconciliation');
  let round=await tx.placementRound.findUnique({where:{year_sequenceNo_educationLevel:{year:d.year,sequenceNo:d.round,educationLevel:d.education}}});
  if(round)assert.equal(await tx.historicalPlacement.count({where:{roundId:round.id,positionCode:{in:rows.map(r=>r.positionCode)}}}),0,'Existing records must not be changed');
  else round=await tx.placementRound.create({data:{year:d.year,sequenceNo:d.round,educationLevel:d.education}});
  const source=await tx.sourceDocument.create({data:{sha256:d.documentSha256,originalFilename:path.basename(new URL(d.documentUrl).pathname),originalUrl:d.documentUrl,sourceOrganization:'ÖSYM',state:'DRAFT',historicalEvidence:{indexUrl:d.indexUrl,indexSha256:d.indexSha256,documentUrl:d.documentUrl,documentSha256:d.documentSha256,publishedAt:d.publishedAt,year:d.year,round:d.round,education:d.education,qualificationCodesVerified:false}}});
  const batch=await tx.importBatch.create({data:{sourceSha256:d.documentSha256,rowCount:rows.length,errorCount:0}});
  await tx.importRow.createMany({data:rows.map(r=>({batchId:batch.id,positionCode:r.positionCode,sourcePage:r.sourcePage,raw:r,issues:[]}))});
  await tx.historicalPlacement.createMany({data:rows.map(r=>{const {rawRecord,...fields}=r;return {...fields,rawRecord,roundId:round.id,sourceDocumentId:source.id};})});
  await tx.reviewAudit.create({data:{batchId:batch.id,actor:actorId,action:'STAGED',count:rows.length}});
  return {batchId:batch.id,state:'STAGED',staged:rows.length,approved:0,duplicate:0};
 },{timeout:60000,isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}
async function verifyPublic(db,base,d){
 const q=new URLSearchParams({educationLevel:d.education,year:String(d.year),round:String(d.round),limit:'1'});const result=await api(base,'/historical/placements?'+q);const count=await db.historicalPlacement.count({where:{round:{year:d.year,sequenceNo:d.round,educationLevel:d.education},approvedAt:{not:null}}});assert.equal(result.total,count);assert.equal(result.total,d.parsed);assert.equal(result.items[0].sourceDocument.originalUrl,d.documentUrl);return count;
}
async function verifyFilters(base,d){
 const params=new URLSearchParams({educationLevel:d.education,year:String(d.year),round:String(d.round),limit:'1'}),initial=await api(base,'/historical/placements?'+params),row=initial.items[0];assert.ok(row);
 for(const [key,value] of [['positionCode',row.positionCode],['city',row.city],['institution',row.institutionRawName],['title',row.title]]){
  if(!value)continue;const q=new URLSearchParams(params);q.set(key,value);const result=await api(base,'/historical/placements?'+q);assert.ok(result.total>0);if(key==='positionCode'){assert.equal(result.total,1);assert.equal(result.items[0].positionCode,value);}
 }
 if(row.minScore!==null){const q=new URLSearchParams(params);q.set('minScoreGte',row.minScore);q.set('minScoreLte',row.minScore);const result=await api(base,'/historical/placements?'+q);assert.ok(result.total>0);assert.ok(result.items.every(item=>new Prisma.Decimal(item.minScore).equals(row.minScore)));}
 if(d.parsed>1){const q=new URLSearchParams(params);q.set('page','2');const second=await api(base,'/historical/placements?'+q);assert.equal(second.page,2);assert.notEqual(second.items[0].positionCode,row.positionCode);}
 return 'PASS';
}
async function publish(db,base,d,user){
 let q=await quality(db,d);assert.ok(q);if(q.state!=='APPROVED'){assert.equal(q.state,'STAGED');await api(base,'/admin/imports/'+q.batchId+'/approve',user.token,{confirmation:d.parsed+' KAYDI KONTROL ETTİM'});}
 q=await quality(db,d);assert.equal(q.approved,d.parsed);assert.equal(await db.reviewAudit.count({where:{batchId:q.batchId,action:'APPROVE'}}),1);return {...q,public:await verifyPublic(db,base,d)};
}
async function main(args=process.argv.slice(2)){
 const [action]=args,isolated=args.includes('--isolated');assert.ok(['preflight','backup','dry-run','pilot','publish-pilot','remaining','verify'].includes(action),'Unknown action');
 const t=target(process.env,isolated),base=process.env.OSYM_API_URL||'https://kadroradar.onrender.com/api/v1',apiTarget=new URL(base);
 if(!isolated)assert.equal(base,'https://kadroradar.onrender.com/api/v1');else assert.ok(['127.0.0.1','localhost'].includes(apiTarget.hostname));
 const state=isolated?path.join(root,'.local/osym-production-tests',t.database):work;
 if(!isolated&&process.platform==='win32'){
  // Also protect direct Node invocations, before journal or DB client creation.
  const ps=path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
  execFileSync(ps,['-NoProfile','-File',path.join(root,'infra/ensure-private-directory.ps1'),'-Path',state],{windowsHide:true,stdio:'pipe',timeout:30000,
   env:Object.fromEntries(['SystemRoot','PATH','TEMP','TMP','USERPROFILE','OS'].filter(key=>process.env[key]!==undefined).map(key=>[key,process.env[key]]))});
 }
 fs.mkdirSync(state,{recursive:true,mode:0o700});const db=new PrismaClient({datasources:{db:{url:t.url}}});
 const log=value=>{const entry={at:new Date().toISOString(),action,target:{host:t.host,port:t.port,database:t.database},...value};fs.appendFileSync(path.join(state,'operations.jsonl'),JSON.stringify(entry)+'\n',{mode:0o600});console.log(JSON.stringify(entry));};
 let activeSource;
 log({event:'START',write:['pilot','publish-pilot','remaining'].includes(action)});
 try{
  const before=await preflight(db,t);if(action==='preflight'){log(before);return;}
  if(action==='backup'){log(await backup(db,t,isolated,state));return;}
  const docs=sources(),pilot=docs.find(d=>d.period==='2024/1'&&d.education==='BACHELOR');assert.equal(pilot.parsed,504);
  const dry=await dryRun(db,docs);fs.writeFileSync(path.join(state,'dry-run.json'),JSON.stringify(dry,null,2));if(action==='dry-run'){log({readOnly:true,documents:dry,total:dry.reduce((n,r)=>n+r.expected,0)});return;}
  if(action==='verify'){for(const d of docs){activeSource=d.period+':'+d.education;const q=await quality(db,d);log({period:d.period,education:d.education,...q,public:q?.approved?await verifyPublic(db,base,d):0,filters:q?.approved?await verifyFilters(base,d):'NOT_PUBLISHED'});}return;}
  assert.equal(process.env.OSYM_IMPORT_APPROVAL,`${t.host}/${t.database} ADD VERIFIED OSYM`,'Explicit target-specific import confirmation required');requireBackup(t,state);
  const user=await actor(db,base);
  try{
   if(action==='pilot'){activeSource=pilot.period+':'+pilot.education;const q=await stage(db,pilot,user.id);await quality(db,pilot);log({period:pilot.period,education:pilot.education,...q,public:0});return;}
   if(action==='publish-pilot'){activeSource=pilot.period+':'+pilot.education;log({period:pilot.period,education:pilot.education,...await publish(db,base,pilot,user)});return;}
   assert.equal((await quality(db,pilot))?.approved,504,'Pilot must be approved first');await verifyPublic(db,base,pilot);
   for(const d of docs.filter(d=>d!==pilot)){activeSource=d.period+':'+d.education;const staged=await stage(db,d,user.id);const result=await publish(db,base,d,user);log({period:d.period,education:d.education,sha256:d.documentSha256,sourceUrl:d.documentUrl,duplicate:staged.duplicate,staged:result.staged,approved:result.approved,public:result.public,batchId:result.batchId,errors:0});}
  }finally{await db.candidateSession.deleteMany({where:{id:hash(user.token),userId:user.id}});}
  assert.equal(await db.announcement.count(),before.snapshot.Announcement.count,'Announcement changed unexpectedly');
 }catch(error){log({event:'FAILED_STOPPED',source:activeSource??null,errorType:error.name,automaticRetry:false});throw error;}finally{await db.$disconnect();}
}
module.exports={target,preflight,sources,dryRun,stage,quality,publish,verifyPublic,verifyFilters,backup,requireBackup,samePlacement,main};
if(require.main===module)main().catch(()=>{console.error('OSYM_OPERATION_FAILED: stopped; inspect private journal and read-only status before retry. Secrets and raw database errors suppressed.');process.exitCode=1;});
