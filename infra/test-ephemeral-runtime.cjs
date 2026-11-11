// Send only public synthetic tests over stdin. The image's non-root user owns
// its private temp directory; host UID/mkdtemp permissions never enter Docker.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),image=process.env.RENDER_TEST_IMAGE||'kadroradar-api:rc1';
function containerContract(){
 const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
 const allowed=['test_gazette_ephemeral.py','test_gazette_download.py','fixtures/__init__.py','fixtures/make_gazette_fixture.py'];
 let input='',directory,phase='INPUT';
 const fail=code=>{throw Object.assign(Error('CONTRACT_FAILED'),{safeCode:code});};
 process.stdin.setEncoding('utf8');
 process.stdin.on('data',chunk=>{input+=chunk;if(Buffer.byteLength(input)>256*1024){input='';process.stdin.destroy();console.log(JSON.stringify({status:'FAIL',phase:'INPUT',code:'INPUT_TOO_LARGE'}));process.exitCode=1;}});
 process.stdin.on('end',()=>{
  try{
   const files=JSON.parse(input);input='';
   if(!files||Object.keys(files).sort().join('|')!==[...allowed].sort().join('|')||allowed.some(f=>typeof files[f]!=='string'))fail('INVALID_FIXTURE_SET');
   phase='TEMP_CREATE';directory=fs.mkdtempSync(path.join(os.tmpdir(),'kadroradar-linux-tests-'));
   fs.mkdirSync(path.join(directory,'fixtures'));
   for(const name of allowed)fs.writeFileSync(path.join(directory,name),files[name]);
   phase='PYTHON_CONTRACT';const result=cp.spawnSync('/opt/ingest/bin/python',['-m','unittest','discover','-s',directory,'-p','test_gazette*.py'],{encoding:'utf8',cwd:directory,timeout:110000,maxBuffer:1024*1024});
   const stderr=String(result.stderr||''),tests=Number(stderr.match(/Ran (\d+) tests?/)?.[1]||0);
   if(result.status!==0||tests!==26){
    const code=/Permission denied/.test(stderr)?'FIXTURE_ACCESS_DENIED':/No module named/.test(stderr)?'PYTHON_MODULE_MISSING':/Fixture font unavailable/.test(stderr)?'FIXTURE_FONT_MISSING':/not importable/.test(stderr)?'DISCOVERY_FAILED':/FAIL:/.test(stderr)?'ASSERTION_FAILED':result.error?.code==='ETIMEDOUT'?'PYTHON_TIMEOUT':'PYTHON_CONTRACT_FAILED';
    console.log(JSON.stringify({status:'FAIL',phase,code,exitCode:result.status,signal:['SIGTERM','SIGKILL'].includes(result.signal)?result.signal:null,tests,uid:process.getuid()}));process.exitCode=1;
   }else console.log(JSON.stringify({status:'PASS',test:'linux-ephemeral-contract',checks:tests,uid:process.getuid(),networkEnabled:false,productionWrites:0,fixtureOwnerMatches:true}));
  }catch(error){console.log(JSON.stringify({status:'FAIL',phase,code:error.safeCode||'CONTRACT_SETUP_FAILED',kind:['SyntaxError','TypeError','Error'].includes(error.name)?error.name:'OTHER'}));process.exitCode=1;}
  finally{if(directory){try{fs.rmSync(directory,{recursive:true,force:true});console.log(JSON.stringify({event:'EPHEMERAL_TEST_CLEANUP',status:fs.existsSync(directory)?'FAIL':'PASS'}));if(fs.existsSync(directory))process.exitCode=1;}catch{console.log(JSON.stringify({status:'FAIL',phase:'CLEANUP',code:'TEMP_CLEANUP_FAILED'}));process.exitCode=1;}}}
 });
}
function run(){
 let phase='READ_SYNTHETIC_FIXTURES';
 try{
  const files=Object.fromEntries(['test_gazette_ephemeral.py','test_gazette_download.py','fixtures/make_gazette_fixture.py'].map(name=>[name,fs.readFileSync(path.join(root,'services/ingest',name),'utf8')]));files['fixtures/__init__.py']='';
  phase='DOCKER_CONTRACT';const result=cp.spawnSync('docker',['run','--rm','-i','--network','none','-e','PYTHONPATH=/app/services/ingest','-e','PYTHONDONTWRITEBYTECODE=1',image,'node','-e','('+containerContract.toString()+')()'],{input:JSON.stringify(files),encoding:'utf8',timeout:120000,windowsHide:true,maxBuffer:1024*1024});
  const events=String(result.stdout||'').split(/\r?\n/).filter(Boolean).map(line=>{try{return JSON.parse(line);}catch{return null;}}).filter(Boolean);
  for(const value of events)console.log(JSON.stringify(value));
  if(result.status!==0||!events.some(v=>v.status==='PASS'&&v.test==='linux-ephemeral-contract'&&v.checks===26)||!events.some(v=>v.event==='EPHEMERAL_TEST_CLEANUP'&&v.status==='PASS')){
   console.error(JSON.stringify({status:'FAIL',test:'linux-ephemeral-contract',phase,code:result.error?.code==='ETIMEDOUT'?'DOCKER_TIMEOUT':result.error?.code==='ENOENT'?'DOCKER_UNAVAILABLE':'IMAGE_EPHEMERAL_CONTRACT_FAILED',exitCode:result.status,signal:['SIGTERM','SIGKILL'].includes(result.signal)?result.signal:null}));process.exitCode=1;
  }
 }catch(error){console.error(JSON.stringify({status:'FAIL',test:'linux-ephemeral-contract',phase,code:'HARNESS_SETUP_FAILED',kind:error.name==='Error'?'Error':'OTHER'}));process.exitCode=1;}
}
module.exports={containerContract,run};
if(require.main===module)run();
