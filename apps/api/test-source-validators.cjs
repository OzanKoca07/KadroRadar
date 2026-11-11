const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const original=cp.execFile,dir=fs.mkdtempSync(path.join(os.tmpdir(),'kadroradar-validators-')),old=process.env.SOURCE_STATE_DIR;
process.env.SOURCE_STATE_DIR=dir;
const {SourceOperations}=require('./dist/source-operations');
const transport={etag:'fixture-v1',lastModified:'Fri, 23 Oct 2026 10:00:00 GMT',documentSha256:'a'.repeat(64),itemCount:1};
let calls=0;
cp.execFile=(bin,args,options,callback)=>{calls++;const file=args[args.indexOf('--output')+1],state=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(state.etag,transport.etag);assert.equal(state.lastModified,transport.lastModified);assert.deepEqual(state.rows,{});callback(null,JSON.stringify({notModified:true}));};
(async()=>{try{const ops=new SourceOperations({},{});const result=await ops.fetchEnergy(transport);assert.equal(calls,1);assert.deepEqual(result.rows,[]);assert.deepEqual(result.unresolved,[]);assert.equal(result.downloaded,false);assert.deepEqual(result.transport,transport);console.log('PASS durable validators seed a fresh worker; 304 never restages cached rows; synthetic transport only');}finally{cp.execFile=original;if(old===undefined)delete process.env.SOURCE_STATE_DIR;else process.env.SOURCE_STATE_DIR=old;fs.rmSync(dir,{recursive:true,force:true});}})().catch(()=>{console.error('FAIL worker validator regression');process.exitCode=1;});
