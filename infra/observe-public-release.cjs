// One-shot public GETs only; no DB connection, credentials, mutation or login.
const fs=require('node:fs'),path=require('node:path');
const origin='https://kadroradar.onrender.com';
const targets=['/api/v1/health','/api/v1/historical/placements?limit=1','/api/v1/announcements?limit=1','/admin/','/privacy','/delete-account','/api/v1/admin/source-operations','/api/v1/admin/announcement-imports','/api/v1/account/profile'];
function rawContent(value){if(!value||typeof value!=='object')return false;return Object.entries(value).some(([key,item])=>['text','dateEvidence','dateSuggestions','raw','html','pdfContent'].includes(key)||rawContent(item));}
(async()=>{
 const expected=process.argv[2];if(expected&&!/^[a-f0-9]{40}$/.test(expected))throw Error('Invalid expected commit');
 const observations=await Promise.all(targets.map(async route=>{
  try{const response=await fetch(origin+route,{signal:AbortSignal.timeout(45000),redirect:'error'}),contentType=response.headers.get('content-type')||'';
   const result={route,httpStatus:response.status,contentType};
   if(contentType.includes('application/json')){
    const value=await response.json();
    if(route==='/api/v1/health'){result.databaseReady=value.status==='ok'&&value.database==='ready';result.releaseCommit=/^[a-f0-9]{40}$/.test(value.release?.commit||'')?value.release.commit:null;result.expectedCommitMatches=expected?result.releaseCommit===expected:null;}
    if(route.includes('?limit=1')){result.validListShape=Array.isArray(value.items)&&Number.isSafeInteger(value.total)&&Number.isSafeInteger(value.pages);if(result.validListShape)result.total=value.total;}
    if(route.includes('/announcements?')&&Array.isArray(value.items))result.publicContentCheck=!value.items.length?'NO_RECORDS_TO_EXAMINE':value.items.some(item=>item.summary||item.requirements||rawContent(item))?'FAILED':'PASS';
   }else await response.arrayBuffer();
   return result;
  }catch(error){return {route,errorType:error.name,errorCode:error.cause?.code||null};}
 }));
 const result={checkedAt:new Date().toISOString(),mode:'PUBLIC_READ_ONLY',expectedCommit:expected||null,observations,productionWrites:0,authenticatedSessionCsrf:'NOT_TESTED'};
 const folder=path.resolve(__dirname,'../.local/release');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'public-observation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(error=>{console.error(JSON.stringify({status:'BLOCKED',errorType:error.name}));process.exitCode=1;});
