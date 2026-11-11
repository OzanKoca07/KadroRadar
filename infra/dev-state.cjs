const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
function fail(detail){const e=Error('DEV_STATE_INVALID');e.detail=detail;throw e;}
function sameRoot(a,b,platform=process.platform){
 if(typeof a!=='string'||typeof b!=='string')return false;
 const p=platform==='win32'?path.win32:path;
 if(!p.isAbsolute(a)||!p.isAbsolute(b))return false;
 // Windows paths are case-insensitive. Resolve symlinks/junctions before comparison.
 const canonical=s=>{try{return fs.realpathSync.native(s);}catch{return p.resolve(s);}};
 const x=canonical(a),y=canonical(b);return platform==='win32'?x.toLowerCase()===y.toLowerCase():x===y;
}
function parseState(text,root){let s;try{s=JSON.parse(text.replace(/^\uFEFF/,''));}catch{fail('JSON_INVALID');}
 if(!s||!sameRoot(s.root,root))fail('PROJECT_ROOT_MISMATCH');
 if(![1,2].includes(s.version)||!/^[a-f0-9]{32}$/.test(s.runId)||!Number.isSafeInteger(s.pid)||s.pid<=0||!Number.isFinite(Date.parse(s.startedAt)))fail('SCHEMA_INVALID');
 if(!Array.isArray(s.services)||s.services.length>3)fail('SERVICES_INVALID');
 const seen=new Set();for(const c of s.services){if(!c||!['api','admin','metro'].includes(c.name)||seen.has(c.name)||!Number.isSafeInteger(c.pid)||c.pid<=0||c.pid===s.pid||s.services.filter(x=>x?.pid===c.pid).length!==1)fail('SERVICES_INVALID');if(s.version===2&&!Number.isFinite(Date.parse(c.created)))fail('CHILD_TIME_INVALID');seen.add(c.name);}
 if(s.version===2&&!Number.isFinite(Date.parse(s.ownerCreated)))fail('OWNER_TIME_INVALID');return s;
}
function readState(file,root){try{return parseState(fs.readFileSync(file,'utf8'),root);}catch(e){if(e.code==='ENOENT')return null;if(e.message==='DEV_STATE_INVALID')throw e;fail('STATE_READ_FAILED');}}
function probe(root,pids){
 if(process.platform!=='win32')throw Error('DEV_IDENTITY_PLATFORM_UNSUPPORTED');
 const shell=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>k.toUpperCase()!=='PSMODULEPATH'));
 const result=cp.spawnSync(shell,['-NoProfile','-File',path.join(__dirname,'dev-process-identity.ps1'),'-ProjectRoot',root,'-ProcessIds',[...new Set(pids)].join(',')],{encoding:'utf8',windowsHide:true,timeout:10000,env});
 if(result.status!==0)throw Error('DEV_IDENTITY_PROBE_FAILED');try{const records=JSON.parse(result.stdout.trim());if(!Array.isArray(records))throw Error();return records;}catch{throw Error('DEV_IDENTITY_PROBE_FAILED');}
}
function verify(s,records){
 const owner=records.find(p=>p.pid===s.pid);
 if(!owner){if(records.some(p=>s.services.some(c=>c.pid===p.pid)))fail('ORPHAN_CHILD_PRESENT');return 'STALE';}
 if(owner.kind!=='owner')fail('OWNER_IDENTITY_MISMATCH');
 const created=Date.parse(owner.created),start=Date.parse(s.startedAt);
 if(!Number.isFinite(created)||(s.version===2?created!==Date.parse(s.ownerCreated):Math.abs(created-start)>2000))fail('OWNER_CREATION_MISMATCH');
 for(const c of s.services){const p=records.find(p=>p.pid===c.pid);if(!p||p.parent!==s.pid||p.kind!==c.name||!Number.isFinite(Date.parse(p.created))||Date.parse(p.created)<created||Date.parse(p.created)>start+30000||(s.version===2&&Date.parse(p.created)!==Date.parse(c.created)))fail('CHILD_IDENTITY_MISMATCH');}
 return 'ACTIVE';
}
module.exports={sameRoot,parseState,readState,probe,verify};
