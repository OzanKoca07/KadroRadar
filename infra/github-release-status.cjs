// Read-only release checks. An existing GitHub credential stays in memory only.
const {execFileSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const sha=process.argv[2]||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();if(!/^[a-f0-9]{40}$/.test(sha))throw Error('Invalid SHA');
 let token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN;
 if(!token){try{const credential=execFileSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',timeout:10000,windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never'}});token=credential.split(/\r?\n/).find(line=>line.startsWith('password='))?.slice(9);}catch{}}
 const response=await fetch('https://api.github.com/repos/OzanKoca07/KadroRadar/actions/runs?head_sha='+sha+'&per_page=10',{headers:{accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(token?{authorization:'Bearer '+token}:{})},signal:AbortSignal.timeout(20000)});
 const value=response.ok?await response.json():null;
 const report={checkedAt:new Date().toISOString(),sha,httpStatus:response.status,status:!response.ok?'BLOCKED':!value.workflow_runs?.length?'PENDING':value.workflow_runs.every(run=>run.status==='completed')?(value.workflow_runs.every(run=>run.conclusion==='success')?'PASS':'FAILED'):'RUNNING',runs:(value?.workflow_runs||[]).map(run=>({id:run.id,name:run.name,status:run.status,conclusion:run.conclusion,headSha:run.head_sha,url:run.html_url}))};
 for(const run of report.runs){const jobs=await fetch('https://api.github.com/repos/OzanKoca07/KadroRadar/actions/runs/'+run.id+'/jobs?per_page=100',{headers:{accept:'application/vnd.github+json',...(token?{authorization:'Bearer '+token}:{})},signal:AbortSignal.timeout(20000)});if(jobs.ok){const data=await jobs.json();run.jobs=data.jobs.map(job=>({name:job.name,status:job.status,conclusion:job.conclusion,failedSteps:job.steps.filter(step=>step.conclusion==='failure').map(step=>step.name)}));}}
 const folder=path.resolve(__dirname,'../.local/release');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'github-status.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(error=>{console.error(JSON.stringify({status:'BLOCKED',errorType:error.name}));process.exitCode=1;});
