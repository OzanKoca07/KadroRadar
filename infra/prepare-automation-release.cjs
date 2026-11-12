// Creates a private review snapshot, never a branch, Git index, commit or deployment.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/AUTOMATION_RELEASE_FILES.json'),'utf8'));
const git=(...args)=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function prepare(){
 assert.equal(git('rev-parse','HEAD').trim(),manifest.baseCommit,'BASE_COMMIT_CHANGED_REVIEW_REQUIRED');
 const parent=path.join(root,'.local','automation-release');fs.mkdirSync(parent,{recursive:true});
 const candidate=fs.mkdtempSync(path.join(parent,'candidate-')),archive=path.join(parent,path.basename(candidate)+'.tar');
 cp.execFileSync('git',['archive','--format=tar','--output='+archive,manifest.baseCommit],{cwd:root,windowsHide:true});
 cp.execFileSync('tar',['-xf',archive,'-C',candidate],{windowsHide:true});
 const copyFiles=[...manifest.copyFromWorkingTree,'infra/prepare-automation-release.cjs','docs/AUTOMATION_RELEASE_FILES.json'];
 for(const file of copyFiles){
  assert.ok(!path.isAbsolute(file)&&!file.split('/').includes('..')&&!/(^|\/)(\.local|\.env)|\.(dump|pem|key|zip|apk|aab)$/.test(file),'UNSAFE_CANDIDATE_PATH');
  assert.ok(!manifest.protectedOperators.includes(file),'PROTECTED_OPERATOR_SELECTED');
  fs.mkdirSync(path.dirname(path.join(candidate,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(candidate,file));
 }
 const baseBytes=file=>cp.execFileSync('git',['show',manifest.baseCommit+':'+file],{cwd:root,windowsHide:true});
 const base=file=>baseBytes(file).toString('utf8');
 // Whole-file staging from the dirty checkout would include an unrelated auth rule.
 // Start with the deployed contract and insert only source-ingest configuration checks.
 const envFile='apps/api/src/environment.ts',needle='export function validateEnvironment(env:NodeJS.ProcessEnv){';
 let env=base(envFile);assert.ok(env.includes(needle));
 env=env.replace(needle,needle+"\n if(env.SOURCE_AUTOMATION_APPROVED!==undefined&&!['true','false'].includes(env.SOURCE_AUTOMATION_APPROVED))throw Error('Invalid automation approval');\n if(env.SOURCE_REMOTE_INGEST_ENABLED!==undefined&&!['true','false'].includes(env.SOURCE_REMOTE_INGEST_ENABLED))throw Error('Invalid remote source flag');\n if(env.SOURCE_REMOTE_INGEST_ENABLED==='true')require(require('node:path').resolve(__dirname,'../../../packages/shared/source-ingest.cjs')).config(env.SOURCE_INGEST_ORIGIN,env.SOURCE_INGEST_HMAC_KEY);");
 fs.writeFileSync(path.join(candidate,envFile),env);
 // Retain every existing deployed CI/auth job. Add only automation contracts.
 let ci=base('.github/workflows/ci.yml');
 ci=ci.replace('      - run: node infra/test-render-readiness.cjs','      - run: node infra/test-render-readiness.cjs\n      - run: node infra/test-rss-runtime.cjs\n      - run: node infra/test-ephemeral-runtime.cjs\n      - run: node infra/test-source-storage.cjs\n      - run: node infra/test-source-ingest-runner.cjs\n      - run: node infra/test-r2-connection-pilot.cjs');
 const windows=/(      - run: [^\r\n]+test-release-http-smoke.ps1\r?\n        shell: powershell)/;
 assert.ok(windows.test(ci));ci=ci.replace(windows,m=>m+'\n'+m.replace('test-release-http-smoke.ps1','test-r2-connection-pilot-wrapper.ps1'));
 ci=ci.replace('      - run: python -m unittest discover -s services/ingest -p test_career_rss.py -v', '      - run: python -m unittest discover -s services/ingest -p test_career_rss.py -v\n      - run: python -m unittest discover -s services/ingest -p test_career_worker.py -v\n      - run: python -m unittest discover -s services/ingest -p test_career_detail.py -v\n      - run: python -m unittest discover -s services/ingest -p test_application_dates.py -v\n      - run: python -m unittest discover -s services/ingest -p test_gazette_ephemeral.py -v');
 const jobs=['test-career-publication','test-live-announcements','test-automation-activation','test-source-ingest','test-career-source-ingest','test-automation-auth-compat'];
 ci+='\n'+jobs.map(t=>'      - run: node apps/api/'+t+'.cjs').join('\n')+'\n';
 fs.writeFileSync(path.join(candidate,'.github/workflows/ci.yml'),ci);
 const releaseFiles=[...copyFiles,...manifest.derivedFromBase];
 const release={branch:'codex/automation-only-release',action:'PREPARED_NOT_STAGED_NO_PUSH_APPROVAL',coreCodeAndTests:releaseFiles.filter(f=>!f.startsWith('docs/')),documentationAndInactiveTemplates:releaseFiles.filter(f=>f.startsWith('docs/')),separateOperatorReviewPreserveUnchanged:manifest.protectedOperators,excluded:manifest.privateExcluded};
 fs.writeFileSync(path.join(candidate,'docs/RELEASE_CANDIDATE_FILES.json'),JSON.stringify(release,null,2)+'\n');
 // git archive on this Windows checkout applies CRLF conversion. Materialize
 // retained files from exact blob bytes before comparing (including binary assets).
 for(const file of manifest.retainBaseAuth)fs.writeFileSync(path.join(candidate,file),baseBytes(file));
 for(const tree of manifest.retainBaseTrees)for(const file of git('ls-tree','-r','--name-only',manifest.baseCommit,'--',tree).trim().split('\n').filter(file=>file&&!copyFiles.includes(file)))fs.writeFileSync(path.join(candidate,file),baseBytes(file));
 // Prove no local account/mobile/Prisma changes entered the snapshot.
 for(const file of manifest.retainBaseAuth)assert.equal(sha(fs.readFileSync(path.join(candidate,file))),sha(baseBytes(file)),file);
 for(const tree of manifest.retainBaseTrees)for(const file of git('ls-tree','-r','--name-only',manifest.baseCommit,'--',tree).trim().split('\n').filter(file=>file&&!copyFiles.includes(file)))assert.equal(sha(fs.readFileSync(path.join(candidate,file))),sha(baseBytes(file)),file);
 // Existing frozen-lockfile dependencies are reused only for local tests. Docker installs independently.
 for(const folder of ['','apps/api','apps/admin','apps/mobile']){
  const dependency=path.join(root,folder,'node_modules');if(fs.existsSync(dependency))fs.symlinkSync(dependency,path.join(candidate,folder,'node_modules'),'junction');
 }
 for(const folder of ['.local/release','.local/release-candidate'])fs.mkdirSync(path.join(candidate,folder),{recursive:true});
 const hashes=Object.fromEntries(releaseFiles.map(file=>[file,sha(fs.readFileSync(path.join(candidate,file)))]));
 const evidence={status:'PREPARED',candidate,baseCommit:manifest.baseCommit,authUnchanged:true,mobileAuthUnchanged:true,migrationsUnchanged:true,files:hashes,staged:false,committed:false};
 fs.writeFileSync(path.join(parent,'latest.json'),JSON.stringify(evidence,null,2)+'\n');
 console.log(JSON.stringify({status:'PREPARED',candidate,files:releaseFiles.length,authUnchanged:true,gitWrites:false}));return evidence;
}
module.exports={prepare};
if(require.main===module)try{prepare();}catch(error){console.error(JSON.stringify({status:'FAIL',phase:'CANDIDATE_PREPARATION',kind:error.name}));process.exitCode=1;}
