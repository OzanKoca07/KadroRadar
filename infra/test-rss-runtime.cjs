// Local image smoke only. No network, credentials, database or source content.
const {execFileSync}=require('node:child_process'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const image=process.env.RENDER_TEST_IMAGE||'kadroradar-api:rc1';
const program=[
 'import sys,json',
 "from pathlib import Path",
 "sys.path.insert(0,'/app/services/ingest')",
 'import fitz,career_rss,rss_transport,source_adapters,source_rights',
 "assert career_rss.REGISTRY['career']['enabled'] is False",
 "assert career_rss.REGISTRY['career']['rightsAssessment']['status']=='REVIEW_REQUIRED'",
 "assert not Path('/app/.local/kariyer/kariyer-kapisi-gercek.xml').exists()",
 "print(json.dumps({'status':'PASS','runtimeImports':True,'sourceDisabled':True,'realFixtureExcluded':True,'networkEnabled':False}))"
].join('\n');
try{
 const result=JSON.parse(execFileSync('docker',['run','--rm','--network','none','--entrypoint','/opt/ingest/bin/python',image,'-c',program],{encoding:'utf8',stdio:'pipe',windowsHide:true,timeout:30000}));
 assert.equal(result.status,'PASS');
 const dir=path.resolve(__dirname,'../.local/release-candidate');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'rss-runtime.json'),JSON.stringify({...result,image},null,2));console.log(JSON.stringify(result));
}catch(error){console.error(JSON.stringify({status:'FAIL',phase:'RSS_IMAGE_RUNTIME',kind:error.name,exitCode:error.status??null}));process.exitCode=1;}
