// Fixed public HTTPS origin, GET only. Never loads .env, credentials or DB URLs.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base='https://kadroradar.onrender.com/api/v1',checks=[],observations=[];
const strict=process.argv.includes('--require-release'),expected=process.argv.find(arg=>arg.startsWith('--expected-commit='))?.slice(18);
if(expected&&!/^[a-f0-9]{40}$/.test(expected))throw Error('Invalid expected commit');
async function get(route){
 if(!/^\/(health|historical\/(placements|rounds)|announcements)(?:[/?]|$)/.test(route))throw Error('Read-only route required');
 const response=await fetch(base+route,{method:'GET',signal:AbortSignal.timeout(90000),redirect:'error'});
 observations.push({route,status:response.status});if(response.status!==200)throw Error('PUBLIC_HTTP_'+response.status);
 return response.json();
}
const check=(label,condition)=>{assert.ok(condition,label);checks.push(label);console.log('PASS '+label);};
(async()=>{const report={base,at:new Date().toISOString(),method:'GET',productionWrites:0,checks,observations};try{
 const health=await get('/health');check('production health/database ready',health.database==='ready');report.releaseCommit=health.release?.commit||null;if(expected)check('production exact release commit',report.releaseCommit===expected);
 const first=await get('/historical/placements?limit=3');check('production historical total 8611',first.total===8611);report.total=first.total;
 report.education={};for(const [education,total] of [['BACHELOR',4797],['ASSOCIATE',2974],['HIGH_SCHOOL',840]]){const result=await get('/historical/placements?limit=2&educationLevel='+education);report.education[education]=result.total;check('production '+education+' count and rows',result.total===total&&result.items.every(row=>row.round.educationLevel===education));}
 const second=await get('/historical/placements?limit=3&page=2');check('server pagination disjoint pages',second.page===2&&second.items.length===3&&second.items.every(row=>!first.items.some(old=>old.id===row.id)));
 const rounds=await get('/historical/rounds');report.rounds=rounds.map(({year,sequenceNo,educationLevel})=>({year,round:sequenceNo,educationLevel}));check('official periods exposed without invented rounds',rounds.length>0);
 const row=first.items[0],params=new URLSearchParams({limit:'3',year:String(row.round.year),round:String(row.round.sequenceNo),educationLevel:row.round.educationLevel});
 const period=await get('/historical/placements?'+params);check('year/period/education filters',period.items.length>0&&period.items.every(r=>r.round.year===row.round.year&&r.round.sequenceNo===row.round.sequenceNo&&r.round.educationLevel===row.round.educationLevel));
 if(row.city){const city=await get('/historical/placements?limit=3&city='+encodeURIComponent(row.city));check('city filter',city.items.length>0&&city.items.every(r=>r.city?.toLocaleUpperCase('tr-TR').includes(row.city.toLocaleUpperCase('tr-TR'))));}
 const institution=await get('/historical/placements?limit=3&institution='+encodeURIComponent(row.institutionRawName));check('institution filter',institution.items.length>0&&institution.items.every(r=>r.institutionRawName.toLocaleUpperCase('tr-TR').includes(row.institutionRawName.toLocaleUpperCase('tr-TR'))));
 if(row.minScore!==null){const score=Number(row.minScore).toFixed(5);const result=await get('/historical/placements?limit=3&minScoreGte='+score+'&minScoreLte='+score);check('historical minimum-score range',result.items.length>0&&result.items.every(r=>Number(r.minScore)===Number(score)));}
 if(row.maxScore!==null){const score=Number(row.maxScore).toFixed(5);const result=await get('/historical/placements?limit=3&maxScoreGte='+score+'&maxScoreLte='+score);const correct=result.items.length>0&&result.items.every(r=>Number(r.maxScore)===Number(score));report.maximumScoreFilter=result.filterCapabilities?.maxScoreRange===true&&correct?'DECLARED_SUPPORTED':correct?'OBSERVED_ONLY_NOT_DECLARED':'UNSUPPORTED';if(strict)check('maximum score filter declared and actually applied',report.maximumScoreFilter==='DECLARED_SUPPORTED');}
 const detail=await get('/historical/placements/'+encodeURIComponent(row.id));const source=new URL(detail.sourceDocument.originalUrl);check('historical detail official HTTPS source',source.protocol==='https:'&&!source.username&&!source.password&&['osym.gov.tr','www.osym.gov.tr','dokuman.osym.gov.tr'].includes(source.hostname));
 const announcements=await get('/announcements?view=open&limit=2');report.openAnnouncements=announcements.total;check('announcement HTTP200/page contract',Array.isArray(announcements.items)&&Number.isSafeInteger(announcements.total)&&Number.isSafeInteger(announcements.pages)&&announcements.page===1);
 check('restricted source absent from sampled announcement payload',!JSON.stringify(announcements.items).includes('ilan.gov.tr'));
 const all=await get('/announcements?view=all&limit=2');report.allAnnouncements=all.total;
 if(strict||process.argv.includes('--all-historical')){
  const globalIds=new Set();let duplicates=0;
  const globalPages=strict?Math.ceil(first.total/100):4;
  for(let page=1;page<=globalPages;page++){const body=await get('/historical/placements?limit=100&page='+page);for(const row of body.items){if(globalIds.has(row.id))duplicates++;globalIds.add(row.id);}await new Promise(resolve=>setTimeout(resolve,500));}
  report.unfilteredPagination={checkedPages:globalPages,uniqueIds:globalIds.size,duplicateIds:duplicates,status:duplicates?'RELEASE_BLOCKER_DUPLICATE_IDS':strict?'FULL_DISJOINT':'SAMPLED_DISJOINT'};
  if(strict)check('all global pages contain 8611 distinct IDs without duplicates',duplicates===0&&globalIds.size===8611);
  const ids=new Set(),urls=new Set();let count=0,pageCount=0;
  for(const round of rounds){let pages=1;for(let page=1;page<=pages;page++){
   const query=new URLSearchParams({limit:'100',page:String(page),educationLevel:round.educationLevel,year:String(round.year),round:String(round.sequenceNo)});
   const body=await get('/historical/placements?'+query);pages=body.pages;pageCount++;
   for(const row of body.items){assert.ok(!ids.has(row.id),'PERIOD_PAGE_DUPLICATE');ids.add(row.id);count++;const url=new URL(row.sourceDocument.originalUrl);assert.ok(url.protocol==='https:'&&!url.username&&!url.password&&['www.osym.gov.tr','osym.gov.tr','dokuman.osym.gov.tr'].includes(url.hostname));urls.add(url.toString());}
   if(pageCount%10===0)console.log('READ_ONLY_PERIOD_PAGES '+pageCount+' records='+count);
   await new Promise(resolve=>setTimeout(resolve,350));
  }}
  report.fullHistorical={records:count,uniqueIds:ids.size,sourceDocuments:urls.size,pages:pageCount,method:'SERVER_PAGINATION_WITH_PERIOD_FILTER'};check('all 8611 historical rows read with period/server pagination and official source URLs',count===8611&&ids.size===8611);
 }
 report.status=report.unfilteredPagination?.duplicateIds?'PASS_WITH_RELEASE_BLOCKER':'PASS';
 }catch(error){report.status='INCOMPLETE';report.failure=/^PUBLIC_HTTP_\d+$/.test(error.message)?error.message:'PUBLIC_CHECK_FAILED';process.exitCode=1;}
 finally{const folder=path.resolve(__dirname,'../.local/preview-readiness');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'public-api.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
})();
