import {resolve} from 'node:path';
const registry=require(resolve(__dirname,'../../../packages/official-sources.json'));
function officialLink(value:any):string|null{
 try{if(typeof value!=='string')return null;const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&(!url.port||url.port==='443')&&Object.values(registry).some((s:any)=>s.hosts.includes(url.hostname))?url.toString():null;}catch{return null;}
}
function metadata(value:any):any{
 if(!value||typeof value!=='object')return null;
 const result:any={};
 for(const key of ['kind','format','gazetteDate','gazetteNumber','pdfSha256','documentSha256','htmlSha256','pageStart','pageEnd','page','advertisementId','sectionStartLine','pageLocator']){
  const v=value[key];if(v===null||typeof v==='number'&&Number.isFinite(v)||typeof v==='string'&&v.length<=200)result[key]=v;
 }
 for(const key of ['sourceUrl','indexUrl'])if(value[key])result[key]=officialLink(value[key]);
 if(value.index)result.index=metadata(value.index);
 return result;
}
function criteria(value:any){
 const result:any={};if(!value||typeof value!=='object')return result;
 for(const key of ['complete','degreeCodesVerified','kpssRequired'])if(typeof value[key]==='boolean')result[key]=value[key];
 for(const key of ['kpssMinimumScore','ydsMinimumScore'])if(typeof value[key]==='number'&&Number.isFinite(value[key]))result[key]=value[key];
 for(const key of ['kpssScoreType','employmentType'])if(typeof value[key]==='string'&&value[key].length<=50)result[key]=value[key];
 for(const key of ['educationLevels','degreeCodes','certificates'])if(Array.isArray(value[key]))result[key]=value[key].filter((v:any)=>typeof v==='string'&&v.length<=120).slice(0,100);
 if(Array.isArray(value.examYears))result.examYears=value.examYears.filter((v:any)=>Number.isInteger(v)&&v>=2000&&v<=2100);
 // Unstructured source conditions stay private; omission must not imply completeness.
 if(value.otherConditions?.length)result.complete=false;
 return result;
}
export function publicAnnouncement(item:any){
 const result:any={};
 for(const key of ['id','status','title','organization','city','district','positionTitle','quota','educationLevel','applicationStartAt','applicationEndAt','announcedAt','sourceCheckedAt','publishedAt','updatedAt','createdAt','applicationStatus'])if(item[key]!==undefined)result[key]=item[key];
 result.sourceUrl=officialLink(item.sourceUrl);result.applicationUrl=officialLink(item.applicationUrl);
 result.sourceEvidence=metadata(item.sourceEvidence);
 result.sourceReferences=(item.sourceReferences||[]).map((ref:any)=>({sourceUrl:officialLink(ref.importRow?.sourceUrl)||officialLink(ref.sourceUrl)||officialLink(ref.evidence?.sourceUrl),evidence:metadata(ref.evidence)}));
 result.positions=(item.positions||[]).map((position:any)=>({id:position.id,title:position.title,city:position.city,quota:position.quota,verifiedAt:position.verifiedAt,sourceUrl:officialLink(position.sourceUrl),requirements:criteria(position.requirements),sourceEvidence:metadata(position.sourceEvidence)}));
 result.contentMode='FACTS_AND_OFFICIAL_LINKS_ONLY';
 return result;
}
