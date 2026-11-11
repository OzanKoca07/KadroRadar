const assert=require('node:assert/strict');
const path=require('node:path');
const {spawn,execFileSync}=require('node:child_process');
const {randomBytes,createHash}=require('node:crypto');
const started=Date.now();let phase='TARGET_GUARD',viteProcess,childExit=null,childError=null,stderrClass='NONE';
function diagnostic(event,error){const frames=String(error?.stack||'').split('\n').slice(1).map(line=>line.match(/(?:[\\/])([a-zA-Z0-9_.-]+\.(?:cjs|js)):(\d+):(\d+)/)).filter(Boolean).slice(0,6).map(m=>({file:m[1],line:Number(m[2]),column:Number(m[3])}));console.log(JSON.stringify({event,phase,elapsedMs:Date.now()-started,pid:process.pid,parentPid:process.ppid,port:5179,childPid:viteProcess?.pid??null,childExit,childError,stderrClass,...(error?{kind:['Error','AssertionError','TimeoutError','PrismaClientInitializationError'].includes(error.name)?error.name:'OTHER',code:['EADDRINUSE','ENOENT','ECONNREFUSED','ETIMEDOUT'].includes(error.code)?error.code:undefined,frames}:{})}));}
let testTarget;try{testTarget=new URL(process.env.DATABASE_URL||'postgresql://invalid/invalid');}catch{throw Error('Isolated DB required');}
if(!['postgres:','postgresql:'].includes(testTarget.protocol)||!['localhost','127.0.0.1','db','[::1]'].includes(testTarget.hostname)||!/^\/kadroradar_ingestion_test_/.test(testTarget.pathname))throw Error('Isolated DB required');
process.env.NODE_ENV='test';process.env.NOTIFICATIONS_ENABLED='false';process.env.SOURCE_SYNC_ENABLED='false';process.env.DOCUMENT_UPLOADS_ENABLED='true';
require('reflect-metadata');
const {PrismaClient}=require('@prisma/client');
const {NestFactory}=require('@nestjs/core');
const {AppModule}=require('./dist/module');
const {passwordHash}=require('./dist/password');
const {chromium}=require('@playwright/test');
const registry=require('../../packages/official-sources.json'),{licensed}=require('./test-source-fixtures.cjs');
const originalEnergy=structuredClone(registry.energy);
(async()=>{
 phase='FIXTURE_CREATE';diagnostic('BROWSER_PHASE');const db=new PrismaClient(),suffix=randomBytes(6).toString('hex'),password=randomBytes(20).toString('hex'),email=`browser-${suffix}@example.test`;
 const user=await db.user.create({data:{email,passwordHash:await passwordHash(password),role:'SYSTEM_ADMIN'}});
 phase='API_START';diagnostic('BROWSER_PHASE');const app=await NestFactory.create(AppModule,{logger:false});app.enableCors({origin:'http://127.0.0.1:5179',credentials:true});app.setGlobalPrefix('api/v1');await app.listen(0,'127.0.0.1');
 const root=path.resolve(__dirname,'../..'),api=await app.getUrl()+'/api/v1';process.env.CORS_ORIGINS='http://127.0.0.1:5179';
 phase='VITE_SPAWN';const vite=spawn(process.execPath,[path.resolve(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5179','--strictPort'],{cwd:path.resolve(root,'apps/admin'),env:{...process.env,VITE_API_BASE_URL:api},stdio:['ignore','ignore','pipe'],windowsHide:true});viteProcess=vite;vite.stderr.on('data',b=>{const text=String(b);if(/already in use|EADDRINUSE/.test(text))stderrClass='PORT_IN_USE';else if(/Cannot find module|MODULE_NOT_FOUND/.test(text))stderrClass='MODULE_NOT_FOUND';else if(/error/i.test(text)&&stderrClass==='NONE')stderrClass='OTHER_ERROR';});vite.on('error',e=>{childError=['ENOENT','EACCES'].includes(e.code)?e.code:'SPAWN_ERROR';});vite.on('exit',(code,signal)=>{childExit={code,signal:['SIGTERM','SIGKILL','SIGINT'].includes(signal)?signal:null};});diagnostic('BROWSER_PHASE');
 const loginRateId=createHash('sha256').update('login:127.0.0.1').digest('hex'),sentinelRateId=createHash('sha256').update('unrelated-browser-fixture:'+suffix).digest('hex');
 let browser,page;let checks=0;
 try{
  phase='RATE_BOUNDARY';diagnostic('BROWSER_PHASE');
  // All suites share the disposable CI database and the loopback login key.
  // Establish this suite's fixture boundary, without disabling/changing rate().
  const until=new Date(Date.now()+15*60000);await db.authRateLimit.upsert({where:{id:loginRateId},create:{id:loginRateId,count:10,until},update:{count:10,until}});await db.authRateLimit.create({data:{id:sentinelRateId,count:7,until}});
  const limited=await fetch(api+'/account/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})});assert.equal(limited.status,403);assert.equal((await limited.json()).code,'AUTH_RATE_LIMITED');
  await db.authRateLimit.delete({where:{id:loginRateId}});assert.equal((await db.authRateLimit.findUniqueOrThrow({where:{id:sentinelRateId}})).count,7);checks+=3;
  phase='VITE_READY';diagnostic('BROWSER_PHASE');for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5179')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  phase='BROWSER_LAUNCH';diagnostic('BROWSER_PHASE');browser=await chromium.launch({...(process.platform==='win32'?{channel:'msedge'}:{}),headless:true});const context=await browser.newContext();page=await context.newPage();page.on('response',r=>{if(r.status()>=400){const u=new URL(r.url());console.log(JSON.stringify({event:'BROWSER_HTTP_FAILURE',method:r.request().method(),route:u.pathname.replace(/\/[a-z0-9]{20,}(?=\/|$)/g,'/:id'),status:r.status()}));}});page.on('console',message=>{if(message.type()==='error')diagnostic('BROWSER_CONSOLE_ERROR');});
  phase='NAVIGATE';diagnostic('BROWSER_PHASE');
  await page.goto('http://127.0.0.1:5179');
  const submitLogin=async()=>{const response=page.waitForResponse(r=>r.url()===api+'/account/login'&&r.request().method()==='POST');await page.getByLabel('E-posta',{exact:true}).fill(email);await page.getByLabel('Parola',{exact:true}).fill(password);await page.getByRole('button',{name:'Hesapla giriş yap'}).click();assert.equal((await response).status(),201,'Login must succeed before UI role/session assertions');};
  const login=async()=>{await submitLogin();await page.getByRole('button',{name:'Kuyruğu getir'}).waitFor({state:'visible'});await require('@playwright/test').expect(page.getByRole('button',{name:'Kuyruğu getir'})).toBeEnabled();};
  phase='ADMIN_LOGIN';diagnostic('BROWSER_PHASE');
  await login();checks++;
  const cookies=await context.cookies(api);assert.ok(cookies.some(c=>c.name==='kr_session'&&c.httpOnly));checks++;
  const csrfResponse=await page.evaluate(async api=>(await fetch(api+'/account/profile',{method:'PUT',credentials:'include',headers:{'content-type':'application/json'},body:'{}'})).status,api);assert.equal(csrfResponse,403);checks++;
  phase='MANUAL_IMPORT';diagnostic('BROWSER_PHASE');
  await page.getByText('Manuel / JSON ilan aktarımı',{exact:true}).click();
  const title='Browser synthetic '+suffix;
  await page.getByLabel('CSV veya JSON dosyası').setInputFiles({name:'synthetic.csv',mimeType:'text/csv',buffer:Buffer.from(`title;organization;sourceUrl\n${title};Synthetic fixture;https://enerji.gov.tr/browser-fixture-${suffix}\n${title} rejected;Fixture;https://enerji.gov.tr/browser-reject-${suffix}`)});
  await require('@playwright/test').expect(page.getByLabel('İçe aktarılacak ilanlar JSON')).toHaveValue(new RegExp(suffix));checks++;
  await page.getByRole('button',{name:'İnceleme kuyruğuna aktar',exact:true}).click();
  await page.getByRole('button',{name:title+' · PENDING_REVIEW',exact:true}).click();checks++;
  await page.getByText('Eksik alanlar:',{exact:false}).waitFor();checks++;
  const fields=JSON.parse(await page.getByLabel('İlan alanları JSON').inputValue());fields.quota=1;await page.getByLabel('İlan alanları JSON').fill(JSON.stringify(fields));await page.getByRole('button',{name:'Taslağı kaydet ve yeniden incelemeye gönder',exact:true}).click();await page.getByRole('button',{name:title+' · PENDING_REVIEW',exact:true}).click();checks++;
  await page.getByLabel('Kaynak kontrolü kanıtı ve notu').fill('Synthetic browser source review only');
  await page.getByRole('button',{name:'APPROVE',exact:true}).click();
  await page.getByRole('button',{name:title+' · APPROVED',exact:true}).click();
  const publishResponse=()=>page.waitForResponse(r=>r.url().includes('/admin/announcement-imports/')&&r.url().endsWith('/review')&&r.request().method()==='POST'&&r.request().postDataJSON()?.action==='PUBLISH');
  let publishing=publishResponse();await page.getByRole('button',{name:'PUBLISH',exact:true}).click();
  const denied=await publishing;assert.equal(denied.status(),403);assert.equal((await denied.json()).message,'Source license review required');
  const approvedRow=await db.announcementImportRow.findFirstOrThrow({where:{sourceUrl:'https://enerji.gov.tr/browser-fixture-'+suffix}});assert.equal(approvedRow.status,'APPROVED');assert.equal(approvedRow.announcementId,null);checks++;
  // Only this isolated process receives a synthetic fixture license. Auth, RBAC,
  // CSRF and the production registry file remain unchanged.
  Object.assign(registry.energy,licensed(registry.energy));
  publishing=publishResponse();await page.getByRole('button',{name:'PUBLISH',exact:true}).click();assert.equal((await publishing).status(),201);
  await page.getByRole('button',{name:title+' · PUBLISHED',exact:true}).click();
  await page.getByRole('heading',{name:'Denetim geçmişi'}).waitFor();checks+=3;
  await page.getByRole('button',{name:'ARCHIVE',exact:true}).click();await page.getByRole('button',{name:title+' · ARCHIVED',exact:true}).waitFor();checks++;
  await page.getByRole('button',{name:title+' rejected · PENDING_REVIEW',exact:true}).click();await page.getByRole('button',{name:'REJECT',exact:true}).click();await page.getByRole('button',{name:title+' rejected · REJECTED',exact:true}).waitFor();checks++;
  phase='GAZETTE';diagnostic('BROWSER_PHASE');
  await page.getByText('Resmî Gazete PDF içe aktarma',{exact:true}).click();
  await page.getByText('Günlük fihrist ve kaynak bağlantısı',{exact:true}).click();
  await page.getByLabel('Fihrist URL',{exact:true}).fill('https://www.resmigazete.gov.tr/');
  await page.getByLabel('Fihrist HTML',{exact:true}).setInputFiles({name:'synthetic-index.html',mimeType:'text/html',buffer:Buffer.from('<h2>1 Ekim 2026 Tarihli ve 99999 Sayılı Resmî Gazete</h2><a href="/eskiler/2026/10/20261001.pdf">SYNTHETIC PDF</a>')});
  await page.getByRole('button',{name:'Fihristi kaydet',exact:true}).click();await page.getByText(/Yerel HTML fihristi kaydedildi/).waitFor();
  await page.getByLabel('Fihrist PDF bağlantısı',{exact:true}).selectOption('https://www.resmigazete.gov.tr/eskiler/2026/10/20261001.pdf');checks+=3;
  const pdf=path.join(root,'tmp/pdfs/browser-'+suffix+'.pdf');execFileSync('python',[path.join(root,'services/ingest/fixtures/make_gazette_fixture.py'),pdf],{windowsHide:true});
  await page.getByLabel('Resmî Gazete PDF',{exact:true}).setInputFiles(pdf);
  await page.getByRole('button',{name:"PDF ayrıştır ve staging'e aktar",exact:true}).click();
  await page.getByText(/1 yeni, 0 değişen, 0 yinelenen/).waitFor();await page.getByTitle('Seçilen orijinal PDF',{exact:true}).waitFor();checks+=2;
  const pdfRow=await db.announcementImportRow.findFirst({where:{sourceDocumentId:{not:null},raw:{path:['sourceEvidence','pdfSha256'],equals:require('node:crypto').createHash('sha256').update(require('node:fs').readFileSync(pdf)).digest('hex')}},orderBy:{createdAt:'desc'}});
  assert.ok(pdfRow);await page.getByRole('button',{name:pdfRow.parsed.title+' · PENDING_REVIEW',exact:true}).first().click();
  await page.getByRole('button',{name:'Orijinal PDF sayfalarını incele',exact:true}).click();await page.getByTitle('Saklanan kaynak PDF',{exact:true}).waitFor();checks++;
  phase='HISTORICAL';diagnostic('BROWSER_PHASE');
  await page.getByText('ÖSYM lisans / önlisans / ortaöğretim aktarımı',{exact:true}).press('Enter');
  const historicalPdf=path.join(root,'tmp/pdfs','historical-browser-'+suffix+'.pdf');execFileSync('python',[path.join(root,'services/ingest/fixtures/make_historical_fixture.py'),historicalPdf,'BACHELOR',String(parseInt(suffix,16)%100000000)],{windowsHide:true});
  await require('@playwright/test').expect(page.getByLabel('ÖSYM sonuç PDF',{exact:true})).toBeVisible();await page.getByLabel('ÖSYM sonuç PDF',{exact:true}).setInputFiles(historicalPdf);await page.getByRole('button',{name:"ÖSYM PDF staging'e aktar",exact:true}).click();await page.getByText(/1 satır · 2024\/1 · BACHELOR/).waitFor();checks++;
  const historicalSha=require('node:crypto').createHash('sha256').update(require('node:fs').readFileSync(historicalPdf)).digest('hex');const batch=await db.importBatch.findFirst({where:{sourceSha256:historicalSha}});assert.ok(batch);
  await page.getByRole('button',{name:'ÖSYM partilerini getir',exact:true}).click();await page.getByRole('row').filter({hasText:historicalSha.slice(0,16)}).getByRole('button',{name:'İncele',exact:true}).click();await page.getByRole('button',{name:'ÖSYM kaynak PDF önizle',exact:true}).click();await page.getByTitle('ÖSYM kaynak PDF',{exact:true}).waitFor();checks++;
  await require('@playwright/test').expect(page.getByRole('button',{name:'İnceleme tamamlandı — toplu onay',exact:true})).toBeDisabled();await page.getByLabel('ÖSYM onay teyidi',{exact:true}).fill('1 KAYDI KONTROL ETTİM');const approvalResponse=page.waitForResponse(response=>response.url().endsWith('/admin/imports/'+batch.id+'/approve')&&response.request().method()==='POST');await page.getByRole('button',{name:'İnceleme tamamlandı — toplu onay',exact:true}).click();const approvedResponse=await approvalResponse;assert.equal(approvedResponse.status(),201,'Historical approval HTTP status');await require('@playwright/test').expect.poll(async()=>(await db.importBatch.findUnique({where:{id:batch.id}})).state).toBe('APPROVED');checks++;

  phase='SESSION_EXPIRY';diagnostic('BROWSER_PHASE');
  await db.candidateSession.updateMany({where:{userId:user.id},data:{expiresAt:new Date(0)}});
  await page.getByRole('button',{name:'Kuyruğu getir',exact:true}).click();await page.getByText(/Oturum süresi doldu/).waitFor();checks++;
  phase='LOGOUT';diagnostic('BROWSER_PHASE');
  await login();await page.getByRole('button',{name:'Çıkış yap',exact:true}).click();await require('@playwright/test').expect(page.getByRole('button',{name:'Kuyruğu getir'})).toBeDisabled();checks++;
  phase='USER_RBAC';diagnostic('BROWSER_PHASE');
  await db.user.update({where:{id:user.id},data:{role:'USER'}});await submitLogin();await page.getByText(/yönetim yetkisi yok/).waitFor();checks++;
  console.log(JSON.stringify({status:'PASS',browser:process.platform==='win32'?'installed Edge via Playwright':'Chromium via Playwright',checks,syntheticOnly:true,deviceChecks:0}));
 }catch(error){diagnostic('BROWSER_FAILURE',error);throw error;}finally{Object.assign(registry.energy,originalEnergy);phase='CLEANUP';diagnostic('BROWSER_PHASE');if(browser)await browser.close();vite.kill();await app.close();await db.authRateLimit.deleteMany({where:{id:{in:[loginRateId,sentinelRateId]}}});await db.candidateSession.deleteMany({where:{userId:user.id}});await db.user.delete({where:{id:user.id}});await db.$disconnect();}
})().catch(error=>{diagnostic('BROWSER_FATAL',error);process.exitCode=1;});
