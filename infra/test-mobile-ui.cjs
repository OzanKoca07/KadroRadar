// Contract/policy tests run TS helpers in memory. No React Native mocks or production writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const root=path.resolve(__dirname,'..'),policy=require(path.join(root,'apps/mobile/lib/source-policy.ts'));
const {official}=require(path.join(root,'apps/mobile/lib/official.ts'));
const api=require(path.join(root,'apps/mobile/lib/announcement-api.ts'));
const {announcementStatus}=require(path.join(root,'apps/mobile/lib/presentation.ts'));
let checks=0;const pass=label=>{checks++;console.log('PASS '+label);};
const item={id:'test',title:'TEST ONLY',organization:'TEST ONLY',status:'PUBLISHED',sourceUrl:'https://enerji.gov.tr/test',applicationStartAt:null,applicationEndAt:null};
const response=value=>({ok:true,json:async()=>value});
(async()=>{const originalFetch=global.fetch,originalBase=process.env.EXPO_PUBLIC_API_URL;try{
 for(const value of ['https://ilan.gov.tr/a','https://www.ilan.gov.tr/a','https://ALT.ilan.gov.tr/a',{sourceEvidence:{index:{sourceUrl:'https://www.ilan.gov.tr/a'}}},{sourceReferences:[{sourceUrl:'https://www.ilan.gov.tr/a'}]},{positions:[{sourceUrl:'https://www.ilan.gov.tr/a'}]},{announcement:{sourceUrl:'https://www.ilan.gov.tr/a'}},{sourceId:'ilan'},{provider:'bik'}])assert.equal(policy.restrictedSource(value),true);
 assert.equal(policy.restrictedSource('https://www.%69lan.gov.tr/a'),true);assert.equal(policy.restrictedSource('https://www.ilan.gov.tr./a'),true);assert.equal(policy.restrictedSource(item),false);pass('blocked canonical/encoded host, subdomains and nested provenance excluded, including saved wrappers');
 assert.equal(official('https://www.ilan.gov.tr/a'),false);assert.equal(official('http://enerji.gov.tr/a'),false);assert.equal(official('https://user:password@enerji.gov.tr/a'),false);assert.equal(official('https://enerji.gov.tr.evil.example/a'),false);assert.equal(official(item.sourceUrl),true);pass('official links reject restricted hosts, credentials, HTTP and hostname spoofing');
 assert.equal(announcementStatus(item),'Tarih doğrulanmamış');assert.equal(announcementStatus({...item,applicationStartAt:'not-a-date',applicationEndAt:'not-a-date'}),'Tarih doğrulanmamış');assert.equal(announcementStatus({...item,status:'WITHDRAWN'}),'Geri çekildi');assert.equal(announcementStatus({...item,status:'ARCHIVED'}),'Arşiv');
 const start=new Date(Date.now()-86400000).toISOString(),end=new Date(Date.now()+86400000).toISOString();assert.equal(announcementStatus({...item,applicationStartAt:start,applicationEndAt:end}),'Başvuru açık');assert.equal(announcementStatus({...item,applicationStartAt:start,applicationEndAt:start}),'Başvuru sona erdi');pass('unknown dates never open; cancellation/archive/expiry remain visible states');
 process.env.EXPO_PUBLIC_API_URL='https://mobile-contract.example.test/api/v1';
 global.fetch=async()=>response({items:[item,{...item,id:'restricted',sourceUrl:'https://www.ilan.gov.tr/a'}],page:2,pages:4,total:70});
 const list=await api.announcementRequest('/announcements?page=2');assert.deepEqual(list.items,[item]);assert.deepEqual([list.page,list.pages,list.total],[2,4,70]);pass('policy filters page content without inventing server totals or changing pagination');
 global.fetch=async()=>response({...item,sourceReferences:[{sourceUrl:'https://www.ilan.gov.tr/a'}]});await assert.rejects(api.announcementDetailRequest('test'),/yayın politikasına/);pass('direct/deep-link detail rejects blocked provenance before rendering title');
 let calls=0;global.fetch=async()=>{calls++;return response(item);};const verified=await api.verifiedReferences([{id:'test'},{id:'test'}],row=>row.id);assert.equal(verified.length,2);assert.equal(calls,1);pass('matches/inbox provenance lookup deduplicates IDs per request');
 global.fetch=async()=>{throw Error('Test network failure');};await assert.rejects(api.verifiedReferences([{id:'test'}],row=>row.id),/network failure/);await assert.rejects(api.announcementRequest('/announcements'),/network failure/);pass('network failure propagates rather than becoming empty success; unverified text never returned');
 global.fetch=async()=>response({items:[],page:1,pages:0,total:0});assert.equal((await api.announcementRequest('/announcements')).items.length,0);pass('actual empty API contract accepted without demo data');
 global.fetch=async()=>response({items:[{id:3}],page:1,pages:1,total:1});await assert.rejects(api.announcementRequest('/announcements'),/Geçersiz/);
 global.fetch=async()=>({ok:false,status:503});await assert.rejects(api.announcementRequest('/announcements'),/503/);pass('malformed payload and HTTP failure remain errors, not empty success');
 global.fetch=async(_url,{signal})=>new Promise((_resolve,reject)=>{if(signal.aborted)reject(Error('Test aborted'));else signal.addEventListener('abort',()=>reject(Error('Test aborted')),{once:true});});const controller=new AbortController();const pending=api.announcementDetailRequest('test',controller.signal);controller.abort();await assert.rejects(pending,/kesildi/);pass('detail abort cancels request and reports bounded user-facing state');
 global.fetch=originalFetch;
 if(process.argv.includes('--local-api')){
  const base='http://127.0.0.1:3000/api/v1';const request=async route=>{const res=await fetch(base+route);assert.equal(res.status,200);return res.json();};
  const health=await request('/health');assert.equal(health.database,'ready');
  for(const education of ['BACHELOR','ASSOCIATE','HIGH_SCHOOL']){const first=await request('/historical/placements?limit=2&educationLevel='+education);assert.ok(Array.isArray(first.items));assert.ok(first.items.every(row=>row.round.educationLevel===education));if(first.pages>1){const next=await request('/historical/placements?limit=2&page=2&educationLevel='+education);assert.ok(next.items.every(row=>!first.items.some(old=>old.id===row.id)));}if(first.items[0]){const detail=await request('/historical/placements/'+first.items[0].id);assert.equal(detail.id,first.items[0].id);}}
  pass('real local API health, three education levels, server pagination and historical detail GET');
 }
 console.log(JSON.stringify({status:'PASS',checks,productionWrites:0,realAndroidDevice:false}));
 }finally{global.fetch=originalFetch;if(originalBase===undefined)delete process.env.EXPO_PUBLIC_API_URL;else process.env.EXPO_PUBLIC_API_URL=originalBase;}
})().catch(()=>{console.error('MOBILE_CONTRACT_TEST_FAILED');process.exitCode=1;});
