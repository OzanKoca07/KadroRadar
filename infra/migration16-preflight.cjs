// Read-only transition inspection, separate from protected import/admin operators.
// Never loads .env, runs migrations, changes backup receipts or prints credentials.
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..'),sha=s=>createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex');
function check(ok,code){if(!ok)throw Object.assign(Error('PREFLIGHT_STOPPED'),{validationCode:code});}
function localManifest(){const pinned=JSON.parse(fs.readFileSync(path.join(__dirname,'migration16-manifest.json'),'utf8')),folder=path.join(root,'apps/api/prisma/migrations');const names=fs.readdirSync(folder).filter(n=>fs.existsSync(path.join(folder,n,'migration.sql'))).sort();check(JSON.stringify(names)===JSON.stringify(pinned.map(x=>x.name)),'M16_LOCAL_NAMES');return pinned.map(row=>{const sql=fs.readFileSync(path.join(folder,row.name,'migration.sql'),'utf8');check(sha(sql)===row.sha256,'M16_LOCAL_CHECKSUM');return {...row,sql};});}
function validateApplied(applied,phase,manifest=localManifest()){
 check(['before','after'].includes(phase),'M16_PHASE');const expected=phase==='before'?manifest.slice(0,15):manifest;
 check(manifest.length===16,'M16_LOCAL_COUNT');check(applied.length===expected.length,'M16_APPLIED_COUNT');
 for(const item of expected){const rows=applied.filter(x=>x.migration_name===item.name);check(rows.length===1&&rows[0].finished_at&&!rows[0].rolled_back_at,'M16_UNFINISHED_OR_UNKNOWN');check([item.sql,item.sql.replace(/\r\n/g,'\n'),item.sql.replace(/\r?\n/g,'\r\n')].some(s=>createHash('sha256').update(s).digest('hex')===rows[0].checksum),'M16_DB_CHECKSUM');}
 return {applied:expected.length,pending:phase==='before'?manifest[15].name:null};
}
async function readOnlyCheck(db,database,phase,onPhase=()=>{}){onPhase('READ_ONLY_TRANSACTION');return db.$transaction(async tx=>{
 await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
 onPhase('IDENTITY_CHECK');
 const [identity]=await tx.$queryRaw`SELECT current_database() AS database,current_schema() AS schema,current_setting('transaction_read_only') AS readonly,current_setting('server_version_num') AS version`;
 check(identity.database===database&&identity.schema==='public'&&identity.readonly==='on'&&Math.floor(Number(identity.version)/10000)===16,'M16_TARGET_IDENTITY');
 onPhase('MIGRATION_QUERY');const applied=await tx.$queryRaw`SELECT migration_name,checksum,finished_at,rolled_back_at FROM public."_prisma_migrations"`;
 onPhase('MIGRATION_VALIDATION');
 const migrations=validateApplied(applied,phase);
 onPhase('DATA_COUNTS');const historical=await tx.historicalPlacement.count(),admins=await tx.user.count({where:{role:'SYSTEM_ADMIN',deletedAt:null}});
 check(historical===8611&&admins>0,'M16_RELEASE_DATA_COUNTS');
 return {status:'PASS',phase,...migrations,historicalPlacements:historical,activeSystemAdmins:admins,readOnly:true,write:false};
},{timeout:30000,maxWait:10000});}
async function deadline(operation,timeoutMs){let timer;try{return await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('CONNECTION_DEADLINE'),{code:'ETIMEDOUT'})),timeoutMs);})]);}finally{clearTimeout(timer);}}
async function connectionCheck(db,onPhase=()=>{},timeoutMs=12000){
 onPhase('PRISMA_CONNECT');await deadline(db.$connect(),timeoutMs);
 onPhase('CONNECTION_PROBE');const rows=await deadline(db.$queryRaw`SELECT 1::integer AS connected`,timeoutMs);
 check(Array.isArray(rows)&&rows.length===1&&rows[0].connected===1,'M16_PROBE_RESULT');
}
async function dnsCheck(host,lookup=require('node:dns').lookup,timeoutMs=5000){
 let timer;try{return await new Promise((resolve,reject)=>{
  timer=setTimeout(()=>reject(Object.assign(Error('DNS_DEADLINE'),{code:'ETIMEDOUT'})),timeoutMs);
  lookup(host,(error)=>error?reject(error):resolve());
 });}finally{clearTimeout(timer);}
}
function boundedTarget(env){
 // Same exact Render/metadata/TLS guards as the protected operator, kept local
 // so this core tool does not require that separate uncommitted operator bundle.
 const url=new URL(env.OSYM_DATABASE_URL||''),database=decodeURIComponent(url.pathname.slice(1));
 if(!['postgres:','postgresql:'].includes(url.protocol)||!url.username||!url.password||url.hash||url.hostname!==env.OSYM_DATABASE_HOST||database!==env.OSYM_DATABASE_NAME||(url.port||'5432')!==(env.OSYM_DATABASE_PORT||'5432'))throw Error('TARGET_MISMATCH');
 if(!/^[A-Za-z0-9_]{1,63}$/.test(database)||!url.hostname.startsWith('dpg-')||!url.hostname.endsWith('.render.com')||(url.port&&url.port!=='5432'))throw Error('RENDER_EXTERNAL_TARGET_REQUIRED');
 if(url.searchParams.has('host')||url.searchParams.get('sslaccept')==='accept_invalid_certs'||url.searchParams.get('schema')&&url.searchParams.get('schema')!=='public')throw Error('UNSAFE_DATABASE_OPTIONS');
 url.searchParams.set('sslmode','require');url.searchParams.set('sslaccept','strict');url.searchParams.set('connect_timeout','10');url.searchParams.set('pool_timeout','10');url.searchParams.set('connection_limit','1');
 return {url:url.toString(),host:url.hostname,port:url.port||'5432',database};
}
async function main(args=process.argv.slice(2),env=process.env){
 let db,result,phase='INPUT';const requestedPhase=args[0],onPhase=p=>{phase=p;};
 try{
  check(['before','after'].includes(requestedPhase)&&args.length===1,'M16_PHASE');
  phase='LOCAL_MANIFEST';try{localManifest();}catch(e){if(!e.validationCode)e.validationCode='M16_LOCAL_READ_FAILURE';throw e;}
  phase='TARGET_VALIDATION';const target=boundedTarget(env);
  phase='DNS_LOOKUP';await dnsCheck(target.host);
  phase='CLIENT_CREATE';const {PrismaClient}=require('@prisma/client');db=new PrismaClient({datasources:{db:{url:target.url}},log:[]});
  await connectionCheck(db,onPhase);
  result=await readOnlyCheck(db,target.database,requestedPhase,onPhase);
 }catch(e){result=require('./migration16-diagnostics.cjs').safeFailure(e,phase,requestedPhase);}
 finally{try{await db?.$disconnect();}catch(e){if(!result||result.status==='PASS')result=require('./migration16-diagnostics.cjs').safeFailure(e,'DISCONNECT',requestedPhase);}}
 return result;
}
module.exports={localManifest,validateApplied,readOnlyCheck,connectionCheck,dnsCheck,boundedTarget,main};
if(require.main===module)main().then(result=>{console.log(JSON.stringify(result));if(result.status!=='PASS')process.exitCode=1;}).catch(()=>{console.log(JSON.stringify({status:'FAIL',readOnly:true,write:false,phase:'INPUT',code:'UNKNOWN_OPERATION_FAILURE'}));process.exitCode=1;});
