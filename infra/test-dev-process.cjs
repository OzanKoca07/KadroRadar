const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'apps/mobile/metro.config.js'),'utf8');
for(const platform of ['win32','linux']){const sandbox={__dirname:path.join(root,'apps/mobile'),process:{platform},module:{exports:{}},require:name=>name==='expo/metro-config'?{getDefaultConfig:()=>({watchFolders:[],maxWorkers:8})}:require(name)};vm.runInNewContext(source,sandbox);assert.equal(sandbox.module.exports.maxWorkers,platform==='win32'?1:8);}
console.log('PASS Metro: Windows in-process worker; Linux default preserved');
if(process.platform==='win32'){const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>key.toUpperCase()!=='PSMODULEPATH'));for(const shell of [path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),process.env.TEST_PWSH||'pwsh.exe']){const result=cp.spawnSync(shell,['-NoProfile','-File',path.join(root,'infra/dev.ps1'),'status'],{encoding:'utf8',windowsHide:true,timeout:15000,env});assert.equal(result.status,0,'read-only wrapper status');assert.ok(['RUNNING','STOPPED'].includes(JSON.parse(result.stdout.trim()).status));}console.log('PASS PowerShell5.1/7 wrapper status without DB access or process mutation');}
if(process.argv.includes('--integration')){
 if(process.platform!=='win32')throw Error('WINDOWS_INTEGRATION_REQUIRED');
 const stateFile=path.join(root,'.local/dev-process/state.json'),powershell=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),pwsh=process.env.TEST_PWSH||'pwsh.exe',wrapper=path.join(root,'infra/dev.ps1');
 // Do not pass PowerShell7 module paths into Windows PowerShell5.1.
 const shellEnv=Object.fromEntries(Object.entries(process.env).filter(([key])=>key.toUpperCase()!=='PSMODULEPATH'));
 const run=(shell,action)=>cp.execFileSync(shell,['-NoProfile','-File',wrapper,action],{encoding:'utf8',windowsHide:true,timeout:30000,stdio:'pipe',env:shellEnv});
 const unrelated=cp.spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{windowsHide:true,stdio:'ignore'});
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 async function start(shell){const child=cp.spawn(shell,['-NoProfile','-File',wrapper,'start'],{cwd:root,windowsHide:true,stdio:'ignore',env:shellEnv});for(let i=0;i<150;i++){if(fs.existsSync(stateFile)){const s=JSON.parse(fs.readFileSync(stateFile));if(s.services?.length===3){for(let j=0;j<100;j++){try{if((await fetch('http://127.0.0.1:8081/status',{signal:AbortSignal.timeout(2000)})).ok){child.unref();return {child,state:s};}}catch{}await pause(200);}break;}}if(child.exitCode!==null)break;await pause(200);}throw Error('DEV_INTEGRATION_START_FAILED');}
 let phase='INITIAL_STATE';
 (async()=>{try{
  assert.ok(fs.existsSync(stateFile),'Start managed development services first');
  phase='PS51_STATUS';const original=JSON.parse(fs.readFileSync(stateFile));assert.equal(JSON.parse(run(powershell,'status')).pid,original.pid);
  phase='DUPLICATE_START';const duplicate=cp.spawnSync(process.execPath,[path.join(root,'infra/dev.cjs'),'start'],{encoding:'utf8',windowsHide:true,timeout:10000});assert.equal(duplicate.status,1);assert.ok(duplicate.stderr.includes('DEV_ALREADY_RUNNING'));assert.equal(JSON.parse(fs.readFileSync(stateFile)).runId,original.runId);
  phase='PS51_STOP';run(powershell,'stop');assert.ok(!fs.existsSync(stateFile));assert.equal(unrelated.exitCode,null);process.kill(unrelated.pid,0);
  phase='PS7_START';const seven=await start(pwsh);assert.equal(JSON.parse(run(pwsh,'status')).pid,seven.state.pid);run(pwsh,'stop');assert.ok(!fs.existsSync(stateFile));assert.equal(unrelated.exitCode,null);
  phase='PS51_START';const five=await start(powershell);assert.equal(JSON.parse(run(powershell,'status')).pid,five.state.pid);assert.equal(unrelated.exitCode,null);process.kill(unrelated.pid,0);
  console.log(JSON.stringify({status:'PASS',shells:['Windows PowerShell5.1','PowerShell7'],duplicateRejected:true,unrelatedProcessPreserved:true,servicesLeftRunning:true}));
 }finally{unrelated.kill();}})().catch(error=>{console.error(JSON.stringify({status:'FAIL',phase,kind:error.name,code:error.code||null,exitCode:error.status||null}));process.exitCode=1;});
}
