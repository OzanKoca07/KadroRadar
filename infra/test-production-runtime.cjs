// Local isolated smoke test. Never migrates a database or publishes a public service.
const {execFileSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
if(!process.env.DATABASE_URL?.includes('/kadroradar_ingestion_test_'))throw Error('Isolated DATABASE_URL required');
const root=path.resolve(__dirname,'..'),suffix=Date.now().toString(36),network='kadroradar-rc1-'+suffix,api=network+'-api',proxy=network+'-proxy',volume=network+'-documents',pki=network+'-pki';
function docker(...args){return execFileSync('docker',args,{encoding:'utf8',timeout:120000,windowsHide:true}).trim();}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const nativeFetch=globalThis.fetch;
// A refused/restarting Docker port must not leave a smoke check hanging for
// Undici's default multi-minute headers timeout.
globalThis.fetch=(input,init={})=>nativeFetch(input,{...init,signal:init.signal||AbortSignal.timeout(5000)});
// Keep the CLI alive across external-container HTTP waits; completion must emit a report.
const keepAlive=setInterval(()=>{},1000);
async function ready(){for(let i=0;i<120;i++){try{if((await fetch('http://127.0.0.1:4317/api/v1/health')).ok)return;}catch{}await sleep(500);}throw Error('Container readiness timeout');}
(async()=>{let result={};try{
 docker('network','create',network);docker('volume','create',volume);docker('volume','create',pki);
 const database=new URL(process.env.DATABASE_URL);database.hostname='host.docker.internal';
 const args=['run','-d','--name',api,'--network',network,'--network-alias','api','--restart','unless-stopped','--memory','1g','--cpus','2','--pids-limit','128','--cap-drop','ALL','--security-opt','no-new-privileges:true','-p','127.0.0.1:4317:10000','-e','PORT=10000','-e','API_PORT=3999','-e','DOCUMENT_UPLOADS_ENABLED=false','-e','DATABASE_URL='+database.href,'-e','CORS_ORIGINS=https://admin.example.test,https://admin.example.test:4443','-e','SOURCE_SYNC_ENABLED=false','-e','NOTIFICATIONS_ENABLED=false','-e','ALLOW_SELF_REGISTRATION=false','-v',volume+':/app/.local/gazette'];
 if(process.env.GAZETTE_REAL_PDF)args.push('-v',process.env.GAZETTE_REAL_PDF+':/input/gazette.pdf:ro');
 args.push('-v',path.join(root,'services/ingest')+':/checks:ro','kadroradar-api:rc1');docker(...args);
 for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:4317/api/v1/health')).ok)break;}catch{}await sleep(500);}
 const health=await fetch('http://127.0.0.1:4317/api/v1/health');assert.equal(health.status,200);assert.equal((await health.json()).database,'ready');
 for(const [route,pattern] of [['/admin/',/\/admin\/assets\//],['/privacy',/KadroRadar Gizlilik/],['/delete-account',/KadroRadar/],['/legal/legal.js',/KADRO_CONFIG/]]) {const response=await fetch('http://127.0.0.1:4317'+route);assert.equal(response.status,200,route);assert.match(await response.text(),pattern);}
 console.log('PASS: initial Docker readiness and same-origin assets');
 const uid=docker('exec',api,'node','-e','console.log(process.getuid())');assert.notEqual(uid,'0');
 const python=docker('exec',api,'/opt/ingest/bin/python','-c','import fitz;print(fitz.VersionBind)');assert.equal(python,'1.27.2.3');
 const languages=docker('exec',api,'tesseract','--list-langs');assert.match(languages,/\btur\b/);assert.match(languages,/\beng\b/);
 docker('exec',api,'node','-e',"require('node:fs').writeFileSync('/app/.local/gazette/rc1-persistence-check','persistent')");docker('restart',api);for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:4317/api/v1/health')).ok)break;}catch{}await sleep(300);}
 assert.equal(docker('exec',api,'node','-e',"console.log(require('node:fs').readFileSync('/app/.local/gazette/rc1-persistence-check','utf8'));require('node:fs').unlinkSync('/app/.local/gazette/rc1-persistence-check')"),'persistent');
 const allowed=await fetch('http://127.0.0.1:4317/api/v1/health',{headers:{Origin:'https://admin.example.test'}});assert.equal(allowed.headers.get('access-control-allow-origin'),'https://admin.example.test');const denied=await fetch('http://127.0.0.1:4317/api/v1/health',{headers:{Origin:'https://untrusted.example.test'}});assert.equal(denied.headers.get('access-control-allow-origin'),null);
 let limited=false;for(let i=0;i<125;i++){const response=await fetch('http://127.0.0.1:4317/api/v1/health');if(response.status===429){assert.ok(response.headers.get('retry-after'));limited=true;break;}}assert.equal(limited,true);docker('restart',api);await ready();console.log('PASS: Docker PORT10000, static pages, CORS, limits, restart');
 const testCaddy=path.join(root,'.local/release/caddy-'+suffix);fs.mkdirSync(path.dirname(testCaddy),{recursive:true});fs.writeFileSync(testCaddy,'{\n local_certs\n}\n'+fs.readFileSync(path.join(root,'infra/Caddyfile'),'utf8').replace('{$API_DOMAIN}','localhost, admin.example.test'));
 docker('run','-d','--name',proxy,'--network',network,'-p','127.0.0.1:4443:443','-e','API_DOMAIN=localhost','-e','API_UPSTREAM=api:10000','-v',testCaddy+':/etc/caddy/Caddyfile:ro','-v',path.join(root,'web')+':/srv/kadroradar:ro','-v',pki+':/data','caddy:2-alpine');await sleep(2500);
 const certificates=path.join(root,'.local','certificates');fs.mkdirSync(certificates,{recursive:true});const certificate=path.join(certificates,'rc1-'+suffix+'.crt');docker('cp',proxy+':/data/caddy/pki/authorities/local/root.crt',certificate);
 const secureGet=(pathname,trust=true)=>new Promise((yes,no)=>{const request=require('node:https').get('https://localhost:4443'+pathname,{family:4,...(trust?{ca:fs.readFileSync(certificate)}:{})},response=>{let text='';response.setEncoding('utf8');response.on('data',chunk=>text+=chunk);response.on('end',()=>response.statusCode===200?yes(text):no(Error('HTTPS status '+response.statusCode)));});request.setTimeout(15000,()=>request.destroy(Error('HTTPS timeout')));request.on('error',no);});
 await assert.rejects(()=>secureGet('/api/v1/health',false));
 assert.equal(JSON.parse(await secureGet('/api/v1/health')).status,'ok');
 const privacy=await secureGet('/privacy');assert.match(privacy,/KadroRadar Gizlilik/);
 const {PrismaClient}=require('@prisma/client'),{passwordHash}=require('../apps/api/dist/password'),{chromium,expect}=require('@playwright/test');
 const db=new PrismaClient(),password=require('node:crypto').randomBytes(24).toString('hex');let browser,user;
 try {
  user=await db.user.create({data:{email:'render-'+suffix+'@example.test',passwordHash:await passwordHash(password),role:'SYSTEM_ADMIN'}});
  browser=await chromium.launch({...(process.platform==='win32'?{channel:'msedge'}:{}),headless:true,args:['--host-resolver-rules=MAP admin.example.test 127.0.0.1','--no-proxy-server']});
  const context=await browser.newContext({ignoreHTTPSErrors:true}),page=await context.newPage();
  await page.goto('https://admin.example.test:4443/admin/');
  await page.getByLabel('E-posta',{exact:true}).fill(user.email);await page.getByLabel('Parola',{exact:true}).fill(password);
  const login=page.waitForResponse(r=>r.url().endsWith('/account/login')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Hesapla giriş yap'}).click();const response=await login;assert.equal(response.status(),201);const {csrfToken}=await response.json();
  await expect(page.getByRole('button',{name:'Kuyruğu getir'})).toBeEnabled();
  const cookie=(await context.cookies()).find(c=>c.name==='kr_session');assert.ok(cookie?.secure&&cookie.httpOnly);assert.equal(cookie.sameSite,'Strict');
  for(const route of ['historical-documents','historical-documents/web','gazette-documents'])assert.equal(await page.evaluate(async({route,csrf})=>(await fetch('/api/v1/admin/'+route,{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf},body:'{}'})).status,{route,csrf:csrfToken}),503);
  await page.goto('https://admin.example.test:4443/delete-account');assert.equal(await page.locator('#delete-form').count(),1);
 } finally {if(browser)await browser.close();if(user){await db.candidateSession.deleteMany({where:{userId:user.id}});await db.user.delete({where:{id:user.id}});}await db.$disconnect();}
 const ocr=docker('exec','-e','PYTHONPATH=/app/services/ingest',...(process.env.GAZETTE_REAL_PDF?['-e','GAZETTE_REAL_PDF=/input/gazette.pdf']:[]),api,'/opt/ingest/bin/python','/checks/check_ocr_runtime.py');
 console.log('PASS: HTTPS admin cookie and disabled document endpoints');
 const report=JSON.parse(ocr);assert.equal(report.status,'PASS');
 result={status:'PASS',image:docker('image','inspect','kadroradar-api:rc1','--format','{{.Id}}'),uid,python,health:true,renderPort:10000,portOverridesApiPort:true,sameOriginAdminAndLegal:true,prismaDatabaseQuery:true,volumeRestartPersistence:true,cors:true,rateLimit:true,localHttpsVerifiedWithCa:true,legalPage:true,realOcrPages:report.realPdfOcrPages,productionPublished:false};console.log(JSON.stringify(result));fs.writeFileSync(path.join(root,'.local','rc1-container-report.json'),JSON.stringify(result,null,2));
}finally{for(const container of [proxy,api])try{docker('rm','-f',container);}catch{}try{docker('network','rm',network);}catch{}for(const name of [volume,pki])try{docker('volume','rm',name);}catch{}clearInterval(keepAlive);}})().catch(error=>{console.error(error.message);process.exitCode=1;});
