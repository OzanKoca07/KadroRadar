// Destructive operations are restricted to uniquely named disposable containers.
// No external DATABASE_URL is read, no real PostgreSQL container is touched.
const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),{randomBytes}=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),suffix=randomBytes(6).toString('hex'),prefix='kadroradar-render-test-'+suffix;
const db=prefix+'-db',api=prefix+'-api',network=prefix+'-net',database='kadroradar_ingestion_test_render_'+suffix,password=randomBytes(24).toString('hex');
const image=process.env.RENDER_TEST_IMAGE||'kadroradar-api:rc1',url=`postgresql://fixture:${password}@db:5432/${database}?connect_timeout=2&pool_timeout=2&connection_limit=3`;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function docker(...args){return execFileSync('docker',args,{encoding:'utf8',timeout:120000,windowsHide:true}).trim();}
function sql(statement){return docker('exec',db,'psql','-U','fixture','-d',database,'-At','-c',statement);}
let base,phase='startup';
// Synchronous Docker CLI calls block the host event loop while the API can
// expire idle sockets. Avoid reusing those unobserved FINs in this harness.
async function request(route,init={}){try{return await fetch(base+route,{...init,headers:{connection:'close',...init.headers},signal:AbortSignal.timeout(8000)});}catch(error){throw Error(phase+' '+route+': '+error.message+' '+(error.cause?.code||''));}}
async function healthy(){for(let i=0;i<60;i++){try{if((await request('/api/v1/health')).ok)return;}catch{}await delay(500);}throw Error('Isolated API readiness timeout');}
async function cli(args,env=[]){return docker('exec',...env.flatMap(([key,value])=>['-e',key+'='+value]),api,'node',...args);}
(async()=>{const checks=[];try{
 assert.ok(database.startsWith('kadroradar_ingestion_test_'));
 docker('network','create',network);
 docker('run','-d','--name',db,'--network',network,'--network-alias','db','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_USER=fixture','-e','POSTGRES_DB='+database,'-e','POSTGRES_PASSWORD='+password,'postgres:16-alpine');
 for(let i=0;i<60;i++){try{docker('exec',db,'pg_isready','-h','127.0.0.1','-U','fixture','-d',database);break;}catch{}await delay(500);}
 assert.equal(sql("SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"),'0');
 docker('run','-d','--name',api,'--network',network,'-p','127.0.0.1::10000','-v',path.join(root,'infra')+':/app/infra:ro','-e','PORT=10000','-e','API_PORT=3999','-e','DATABASE_URL='+url,'-e','CORS_ORIGINS=https://admin.example.test','-e','TRUST_PROXY_HOPS=1',image);
 const binding=docker('port',api,'10000/tcp').split('\n')[0];base='http://'+binding;
 await healthy();assert.equal(sql("SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"),'0');assert.equal(sql('SELECT count(*) FROM pg_roles WHERE rolname=\'fixture\''),'1');
 checks.push('PORT10000 overrides API_PORT3999; 0.0.0.0 reachable; no startup migration/seed');
 const settings=JSON.parse(docker('exec',api,'node','-e',"console.log(JSON.stringify(Object.fromEntries(['NODE_ENV','DOCUMENT_UPLOADS_ENABLED','SOURCE_SYNC_ENABLED','NOTIFICATIONS_ENABLED','ALLOW_SELF_REGISTRATION'].map(k=>[k,process.env[k]]))))"));
 assert.equal(settings.NODE_ENV,'production');for(const flag of ['DOCUMENT_UPLOADS_ENABLED','SOURCE_SYNC_ENABLED','NOTIFICATIONS_ENABLED','ALLOW_SELF_REGISTRATION'])assert.equal(settings[flag],'false');
 checks.push('production image defaults: all four Free-sensitive features disabled');
 for(const route of ['/admin/','/privacy','/delete-account','/legal/legal.js','/legal/legal.css','/legal/public-config.js'])assert.equal((await request(route)).status,200,route);
 const admin=await(await request('/admin/')).text(),asset=admin.match(/src="([^"]+\.js)"/)?.[1];assert.ok(asset?.startsWith('/admin/assets/'));const bundle=await(await request(asset)).text();assert.ok(bundle.includes('/api/v1'));assert.ok(!bundle.includes('http://localhost:3000/api/v1'));
 checks.push('admin/legal pages and assets served; admin uses relative production API');
 phase='migration';
 const migration=['infra/render-database.cjs','migrate','db',database,'APPROVE'];
 await cli(migration);assert.equal(sql('SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL'),'15');
 await cli(['infra/render-database.cjs','status','db',database]);
 await cli(migration);assert.equal(sql('SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL'),'15');
 assert.equal(sql('SELECT count(*) FROM "User"'),'0');assert.equal(sql('SELECT count(*) FROM "HistoricalPlacement"'),'0');
 checks.push('15 explicit isolated migrations; second deploy idempotent; no default account or historical seed');
 phase='empty API';
 for(const route of ['/announcements','/announcements/archive','/announcements?view=all','/historical/placements','/historical/placements?educationLevel=BACHELOR','/historical/placements?educationLevel=ASSOCIATE','/historical/placements?educationLevel=HIGH_SCHOOL']){const response=await request('/api/v1'+route);assert.equal(response.status,200,route);const body=await response.json();assert.equal(body.total,0);assert.deepEqual(body.items,[]);}
 const rounds=await request('/api/v1/historical/rounds');assert.deepEqual(await rounds.json(),[]);
 const filters=await request('/api/v1/announcements/filters');assert.deepEqual(await filters.json(),{cities:[],organizations:[],educationLevels:[]});
 assert.equal((await request('/api/v1/announcements/missing')).status,404);
 assert.equal((await request('/api/v1/admin/announcement-imports')).status,401);
 assert.equal((await request('/api/v1/account/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'absent@example.test',password:randomBytes(24).toString('hex')})})).status,401);
 checks.push('empty public API contracts/education filters; missing404; unauthenticated admin401; no seeded login');
 phase='provisioning';
 const email='operator-'+suffix+'@example.test',adminPassword=randomBytes(24).toString('hex');
 await cli(['infra/render-database.cjs','create-admin','db',database,'APPROVE'],[['NEW_ADMIN_EMAIL',email],['NEW_ADMIN_PASSWORD',adminPassword],['NEW_ADMIN_ROLE','CONTENT_EDITOR']]);
 assert.equal(sql('SELECT count(*) FROM "User"'),'1');assert.equal(sql('SELECT role FROM "User"'),'CONTENT_EDITOR');
 assert.ok(sql('SELECT "passwordHash" FROM "User"').startsWith('scrypt-v2:'));
 assert.throws(()=>docker('exec','-e','NEW_ADMIN_EMAIL='+email,'-e','NEW_ADMIN_PASSWORD='+adminPassword,'-e','NEW_ADMIN_ROLE=SYSTEM_ADMIN',api,'node','apps/api/create-admin.cjs','--create'));
 assert.equal(sql('SELECT role FROM "User"'),'CONTENT_EDITOR');assert.equal(sql('SELECT count(*) FROM "User"'),'1');
 checks.push('explicit isolated operator provisioning; password hashed; duplicate cannot elevate role');
 console.log('PASS: empty database, explicit migration, static pages and provisioning');
 docker('stop',db);
 phase='database outage';
 const unavailable=await request('/api/v1/health');assert.equal(unavailable.status,503);const error=await unavailable.json();assert.equal(error.message,'Database unavailable');assert.ok(!JSON.stringify(error).includes(password));
 checks.push('stopped isolated PostgreSQL: health503, generic error, no connection secret leak');
 phase='database recovery';docker('start',db);await healthy();checks.push('PostgreSQL recovery: health200');
 const report={date:'2026-10-26',status:'PASS',image:docker('image','inspect',image,'--format','{{.Id}}'),checks,realDatabaseTouched:false,productionDeployed:false};
 fs.mkdirSync(path.join(root,'.local/release'),{recursive:true});fs.writeFileSync(path.join(root,'.local/release/render-readiness.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{
 for(const name of [api,db])try{docker('rm','-f',name);}catch{}
 try{docker('network','rm',network);}catch{}
}})().catch(error=>{console.error(error.message?.replaceAll(password,'[REDACTED]'));process.exitCode=1;});
