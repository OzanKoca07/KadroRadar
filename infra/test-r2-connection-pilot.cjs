const assert=require('node:assert/strict'),{randomBytes}=require('node:crypto'),{pilot}=require('./r2-connection-pilot.cjs');
const env={R2_BUCKET:'kadrooradar-source-cache',R2_ENDPOINT:'https://'+'a'.repeat(32)+'.r2.cloudflarestorage.com',R2_ACCESS_KEY_ID:randomBytes(16).toString('hex'),R2_SECRET_ACCESS_KEY:randomBytes(32).toString('hex'),R2_PILOT_APPROVED:'true',R2_PILOT_CONFIRMATION:'R2 kadrooradar-source-cache ONE OBJECT'};
(async()=>{let checks=0,calls=[],bytes,stored=false;const transport=async(url,init)=>{calls.push({url,method:init.method});if(init.method==='PUT'){bytes=init.body;stored=true;return new Response(null,{status:200});}if(init.method==='DELETE'){stored=false;return new Response(null,{status:204});}return new Response(stored?bytes:null,{status:stored?200:404});};
 for(const change of [{R2_PILOT_APPROVED:'false'},{R2_BUCKET:'other-bucket'},{DATABASE_URL:'FORBIDDEN_FIXTURE'}]){await assert.rejects(pilot({...env,...change},transport));assert.equal(calls.length,0);checks++;}
 let r=await pilot(env,transport);assert.equal(r.status,'PASS');assert.equal(r.readHashVerified,true);assert.equal(r.deletionVerified,true);assert.equal(r.cleanupOutstanding,false);assert.deepEqual(calls.map(c=>c.method),['PUT','GET','DELETE','GET']);assert.equal(new Set(calls.map(c=>c.url)).size,1);assert.ok(!bytes.includes('PDF'));checks+=7;
 calls=[];r=await pilot(env,async(url,init)=>init.method==='GET'&&stored?new Response('corrupt') :transport(url,init));assert.equal(r.status,'FAIL');assert.equal(r.deletionVerified,true);assert.equal(r.readHashVerified,false);checks+=3;
 calls=[];r=await pilot(env,async(url,init)=>init.method==='DELETE'?new Response(null,{status:403}):transport(url,init));assert.equal(r.status,'FAIL');assert.equal(r.cleanupOutstanding,true);assert.ok(r.objectKey.startsWith('pilots/r2-connection/'));checks+=3;
 // Local validation must never create an attempted request or outstanding object.
 const invalid=[
  [{R2_ENDPOINT:''},'R2_ENDPOINT_MISSING'],
  [{R2_ENDPOINT:'not-a-url'},'R2_ENDPOINT_URL_INVALID'],
  [{R2_ENDPOINT:env.R2_ENDPOINT+' '},'R2_ENDPOINT_WHITESPACE_OR_CONTROL'],
  [{R2_ENDPOINT:env.R2_ENDPOINT.replace('https:','http:')},'R2_ENDPOINT_HTTPS_REQUIRED'],
  [{R2_ENDPOINT:'https://user:password@'+new URL(env.R2_ENDPOINT).host},'R2_ENDPOINT_COMPONENTS_REJECTED'],
  [{R2_ENDPOINT:env.R2_ENDPOINT+':8443'},'R2_ENDPOINT_COMPONENTS_REJECTED'],
  [{R2_ENDPOINT:env.R2_ENDPOINT+'?token=NOT_LIVE'},'R2_ENDPOINT_COMPONENTS_REJECTED'],
  [{R2_ENDPOINT:env.R2_ENDPOINT+'#fragment'},'R2_ENDPOINT_COMPONENTS_REJECTED'],
  [{R2_ENDPOINT:'https://127.0.0.1'},'R2_ENDPOINT_HOST_REJECTED'],
  [{R2_ENDPOINT:env.R2_ENDPOINT+'.evil.test'},'R2_ENDPOINT_HOST_REJECTED'],
  [{R2_ENDPOINT:'https://not-an-account.r2.cloudflarestorage.com'},'R2_ENDPOINT_ACCOUNT_ID_INVALID'],
  [{R2_ENDPOINT:env.R2_ENDPOINT+'/bucket'},'R2_ENDPOINT_PATH_OR_FORMAT_REJECTED'],
  [{R2_ENDPOINT:env.R2_ENDPOINT+'//'},'R2_ENDPOINT_PATH_OR_FORMAT_REJECTED'],
  [{R2_ACCESS_KEY_ID:''},'R2_ACCESS_KEY_ID_MISSING'],
  [{R2_ACCESS_KEY_ID:'z'.repeat(32)},'R2_ACCESS_KEY_ID_FORMAT_INVALID'],
  [{R2_ACCESS_KEY_ID:env.R2_ACCESS_KEY_ID+'\n'},'R2_ACCESS_KEY_ID_WHITESPACE_OR_CONTROL'],
  [{R2_SECRET_ACCESS_KEY:''},'R2_SECRET_ACCESS_KEY_MISSING'],
  [{R2_SECRET_ACCESS_KEY:'not-an-s3-secret'},'R2_SECRET_ACCESS_KEY_FORMAT_INVALID'],
  [{R2_SECRET_ACCESS_KEY:' '+env.R2_SECRET_ACCESS_KEY},'R2_SECRET_ACCESS_KEY_WHITESPACE_OR_CONTROL']
 ];
 for(const [change,code] of invalid){calls=[];r=await pilot({...env,...change},transport);assert.equal(r.code,'R2_CONFIGURATION_INVALID');assert.equal(r.validationCode,code);assert.equal(r.phase,'CONFIGURATION');assert.equal(r.configurationValid,false);assert.equal(r.putAttempted,false);assert.equal(r.httpAttempts,0);assert.deepEqual(r.requests,[]);assert.equal(r.cleanupOutstanding,false);assert.equal(r.cleanupStatus,'NOT_REQUIRED');assert.equal(calls.length,0);assert.ok(!JSON.stringify(r).includes(env.R2_SECRET_ACCESS_KEY));checks+=11;}
 calls=[];r=await pilot({...env,R2_ENDPOINT:env.R2_ENDPOINT+'/'},transport);assert.equal(r.status,'PASS');assert.ok(calls.every(c=>!new URL(c.url).pathname.includes('//')));checks+=2;
 calls=[];r=await pilot({...env,R2_PILOT_APPROVED:'false'},transport,{validateOnly:true});assert.equal(r.configurationValid,true);assert.equal(r.status,'PASS');assert.equal(r.putAttempted,false);assert.equal(r.cleanupOutstanding,false);assert.equal(calls.length,0);checks+=5;
 calls=[];r=await pilot(env,async(url,init)=>{calls.push({url,method:init.method});throw Error('SYNTHETIC_AMBIGUOUS_PUT');});assert.equal(r.putAttempted,true);assert.equal(r.cleanupOutstanding,true);assert.equal(r.phase,'PUT');assert.deepEqual(calls.map(c=>c.method),['PUT','DELETE']);assert.equal(r.requests[0].status,null);checks+=5;
 const store=require('./r2-source-store.cjs'),id='00000000-0000-4000-8000-000000000000';
 assert.throws(()=>store.configuration({...env,R2_BUCKET:'invalid_bucket'}),e=>e.validationCode==='R2_BUCKET_FORMAT_INVALID');checks++;
 const req=store.signedObject(env,'PUT','pilots/r2-connection/'+id+'.json','{}',new Date('2026-11-11T00:00:00Z'));assert.ok(req.headers.authorization.includes('/20261111/auto/s3/aws4_request'));assert.ok(req.headers.authorization.startsWith('AWS4-HMAC-SHA256 '));assert.equal(req.headers['x-amz-date'],'20261111T000000Z');checks+=3;
 const cp=require('node:child_process'),path=require('node:path');const cli=cp.spawnSync(process.execPath,[path.join(__dirname,'r2-connection-pilot.cjs'),'--validate-only'],{env:{...env,R2_PILOT_APPROVED:'false'},encoding:'utf8',windowsHide:true});assert.equal(cli.status,0);assert.equal(JSON.parse(cli.stdout).configurationValid,true);assert.equal(JSON.parse(cli.stdout).httpAttempts,0);assert.ok(!cli.stdout.includes(env.R2_SECRET_ACCESS_KEY));checks+=4;
 const invalidCli=cp.spawnSync(process.execPath,[path.join(__dirname,'r2-connection-pilot.cjs'),'--validate-only'],{env:{...env,R2_SECRET_ACCESS_KEY:'not-an-s3-secret'},encoding:'utf8',windowsHide:true});assert.equal(invalidCli.status,1);assert.equal(JSON.parse(invalidCli.stdout).validationCode,'R2_SECRET_ACCESS_KEY_FORMAT_INVALID');assert.ok(!invalidCli.stdout.includes('not-an-s3-secret'));checks+=3;
 console.log(JSON.stringify({status:'PASS',checks,provider:'FAKE_TRANSPORT',realR2:false,productionDatabaseTouched:false}));
})().catch(e=>{console.error(JSON.stringify({status:'FAIL',test:'r2-pilot',kind:e.name}));process.exitCode=1;});
