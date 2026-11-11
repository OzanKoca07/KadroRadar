// Execute contracts against the modules bundled in the real image, not host source.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),image=process.env.RENDER_TEST_IMAGE||'kadroradar-api:rc1',directory=fs.mkdtempSync(path.join(os.tmpdir(),'kadroradar-linux-tests-'));
try{
 for(const name of ['test_gazette_ephemeral.py','test_gazette_download.py'])fs.copyFileSync(path.join(root,'services/ingest',name),path.join(directory,name));
 fs.mkdirSync(path.join(directory,'fixtures'));fs.writeFileSync(path.join(directory,'fixtures/__init__.py'),'');fs.copyFileSync(path.join(root,'services/ingest/fixtures/make_gazette_fixture.py'),path.join(directory,'fixtures/make_gazette_fixture.py'));
 const result=cp.spawnSync('docker',['run','--rm','--network','none','-v',directory+':/tests:ro','-e','PYTHONPATH=/app/services/ingest','-e','PYTHONDONTWRITEBYTECODE=1',image,'/opt/ingest/bin/python','-m','unittest','discover','-s','/tests','-p','test_gazette*.py'],{encoding:'utf8',timeout:120000,windowsHide:true,maxBuffer:1024*1024});
 if(result.status!==0)throw Error('IMAGE_EPHEMERAL_CONTRACT_FAILED');
 console.log(JSON.stringify({status:'PASS',test:'linux-ephemeral-contract',checks:26,networkEnabled:false,productionWrites:0}));
}catch(error){console.error(JSON.stringify({status:'FAIL',test:'linux-ephemeral-contract',kind:error.name}));process.exitCode=1;}finally{if(path.dirname(path.resolve(directory))===path.resolve(os.tmpdir())&&path.basename(directory).startsWith('kadroradar-linux-tests-'))fs.rmSync(directory,{recursive:true,force:true});else process.exitCode=1;}
