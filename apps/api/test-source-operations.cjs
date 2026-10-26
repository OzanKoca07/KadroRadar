const assert=require('node:assert/strict');
require('reflect-metadata');
if(!process.env.DATABASE_URL?.includes('/kadroradar_ingestion_test_'))throw Error('Isolated DB required');
const {PrismaClient}=require('@prisma/client');
const {SourceOperations,sourceAllowed,backoff}=require('./dist/source-operations');
const registry=require('../../packages/official-sources.json');
(async()=>{const db=new PrismaClient();const ops=new SourceOperations(db,{});const original={...registry.energy};let calls=0;
try{
 assert.equal(sourceAllowed(registry.energy),false);await assert.rejects(()=>ops.run('energy',async()=>{calls++;return []}));assert.equal(calls,0);
 assert.equal(sourceAllowed({...registry.energy,enabled:true,republicationPermission:'UNVERIFIED'}),true);
 assert.equal(sourceAllowed({...registry.energy,enabled:true,indexingPolicy:{automatedAccess:'REVIEW_REQUIRED'}}),false);
 assert.equal(sourceAllowed({...registry.energy,enabled:true,indexingPolicy:{automatedAccess:'DISALLOWED'}}),false);
 Object.assign(registry.energy,{enabled:true});
 await db.sourceSyncState.deleteMany({where:{id:'energy'}});
 const row={title:'Synthetic scheduler fixture',organization:'Fixture',sourceUrl:'https://enerji.gov.tr/scheduler-fixture-only'};
 let release,started;const wait=new Promise(r=>release=r),ready=new Promise(r=>started=r);
 const running=ops.run('energy',async()=>{started();await wait;return [row]});await ready;
 assert.equal((await ops.run('energy',async()=>{throw Error('must not run')})).status,'BUSY');release();assert.equal((await running).status,'OK');
 assert.equal((await ops.run('energy',async()=>[])).status,'NOT_DUE');
 await db.sourceSyncState.update({where:{id:'energy'},data:{nextAttemptAt:new Date(0),lastSuccessAt:new Date(Date.now()-97*3600000)}});
 assert.equal((await ops.run('energy',async()=>[row])).duplicate,1);
 await db.sourceSyncState.update({where:{id:'energy'},data:{nextAttemptAt:new Date(0),lastSuccessAt:new Date(Date.now()-97*3600000)}});
 assert.equal((await ops.run('energy',async()=>{throw Error('TLS')})).errorCode,'TLS');
 const state=await db.sourceSyncState.findUnique({where:{id:'energy'}});assert.equal(state.consecutiveFailures,1);assert.ok(state.lastSuccessAt);assert.ok(state.nextAttemptAt>Date.now());assert.equal(backoff(100),86400000);assert.equal(state.metrics.successfulRuns,2);assert.equal(state.metrics.failedRuns,1);
 const originalSbb={...registry.sbb},originalRun=ops.run;const dispatched=[];
 try{Object.assign(registry.sbb,{enabled:true,format:'rss',indexingPolicy:{automatedAccess:'ALLOWED'}});ops.run=async id=>{dispatched.push(id);if(id==='energy')throw Error('SYNTHETIC_DISPATCH_FAILURE');return {status:'OK'}};await ops.tick();assert.deepEqual(dispatched,['energy','sbb']);}
 finally{Object.assign(registry.sbb,originalSbb);ops.run=originalRun;}
 console.log('PASS: permission gates, PostgreSQL cross-worker lock, backoff, duplicate staging, durable health/error metrics, source dispatch isolation; adapters mocked, no source fetch');
}finally{Object.assign(registry.energy,original);ops.onModuleDestroy();await db.$disconnect();}})().catch(e=>{console.error(e);process.exitCode=1;});
