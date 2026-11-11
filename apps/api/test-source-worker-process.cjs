// Real worker subprocess, disabled registry only; no external source fetch.
const assert=require('node:assert/strict'),{spawn}=require('node:child_process'),path=require('node:path');
if(!process.env.DATABASE_URL?.includes('/kadroradar_ingestion_test_'))throw Error('Disposable DB required');
assert.ok(Object.values(require('../../packages/official-sources.json')).every(source=>source.enabled===false));
async function launch(enabled){
 return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[path.resolve(__dirname,'dist/worker.js')],{env:{...process.env,NODE_ENV:'test',PROCESS_ROLE:'source-worker',SOURCE_SYNC_ENABLED:String(enabled),SOURCE_WORKER_ONCE:'false',NOTIFICATIONS_ENABLED:'false'},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='',settled=false;child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data);
  const timer=setTimeout(()=>{child.kill();reject(Error('Worker did not initialize'));},15000);
  child.on('error',reject);
  child.on('exit',code=>{clearTimeout(timer);if(settled)return;if(!enabled){assert.equal(code,1);assert.ok(output.includes('worker_start_failed'));resolve();}else reject(Error('Worker exited before initialization: '+output));});
  const check=setInterval(()=>{if(enabled&&output.includes('"event":"worker_started"')){clearInterval(check);clearTimeout(timer);settled=true;assert.ok(output.includes('"httpListener":false'));child.once('exit',()=>resolve());child.kill();}},100);
  child.once('exit',()=>clearInterval(check));
 });
}
(async()=>{await launch(false);await launch(true);const output=require('node:child_process').execFileSync(process.execPath,[path.resolve(__dirname,'dist/worker.js')],{env:{...process.env,NODE_ENV:'test',PROCESS_ROLE:'source-worker',SOURCE_SYNC_ENABLED:'true',SOURCE_WORKER_ONCE:'true',NOTIFICATIONS_ENABLED:'false'},encoding:'utf8',timeout:15000,windowsHide:true});assert.ok(output.includes('"event":"source_worker_completed"'));assert.ok(output.includes('"sourceRuns":0'));console.log('PASS: independent and one-shot source workers, startup/shutdown, explicit enable required; registry disabled, no HTTP listener, no live scheduler runs');})().catch(e=>{console.error(e);process.exitCode=1;});
