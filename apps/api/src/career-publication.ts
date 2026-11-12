import {createHash} from 'node:crypto';
import {applicationDates} from './application-dates';
import {sourceRights} from './source-rights';
export type ProcessingDecision='AUTO_PUBLISH_ELIGIBLE'|'MANUAL_REVIEW'|'REJECTED';
export const generalCareerCategories=['EXAM_PLACEMENT','INTERNAL','EDUCATION'];
export function careerDetailUrl(value:any){try{if(typeof value!=='string'||value.length>2048||/[\\\s\u0000-\u001f]/.test(value))return false;const u=new URL(value);return u.protocol==='https:'&&u.hostname==='kariyerkapisi.gov.tr'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&!u.hash&&u.pathname.toLowerCase()==='/ilandetay'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(u.searchParams.get('i')||'');}catch{return false;}}
const date=(v:any)=>{if(typeof v!=='string')return false;const m=/^(\d{4})-(\d{2})-(\d{2})T([0-2]\d):([0-5]\d):([0-5]\d)(?:\.\d{1,6})?(Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.exec(v);return !!m&&+m[2]>=1&&+m[2]<=12&&+m[3]>=1&&+m[3]<=new Date(Date.UTC(+m[1],+m[2],0)).getUTCDate()&&+m[4]<24&&Number.isFinite(Date.parse(v));};
// Adapter trust and legal rights are independent gates. Current RSS has no
// structured employer/deadline fields; it cannot qualify a recruitment alone.
export function careerPublicationDecision(raw:any,source:any,override?:any,now=new Date(),trustedAdapter=false,metadataOnly=false):{decision:ProcessingDecision;reasons:string[]}{
 const reasons:string[]=[];
 if(!Array.isArray(raw?.issues)||!careerDetailUrl(raw?.sourceUrl)||typeof raw?.title!=='string'||!raw.title.trim()||raw.title.length>1000||!/^[a-f0-9]{64}$/.test(raw.guidHash||'')||!/^[a-f0-9]{64}$/.test(raw.rawSourceReference?.documentSha256||''))return {decision:'REJECTED',reasons:['INVALID_OFFICIAL_METADATA']};
 if(sourceRights(source,override,now)!=='LICENSE_VERIFIED')reasons.push('SOURCE_PERMISSION_REVIEW');
 if(source?.enabled!==true||source?.indexingPolicy?.automatedAccess!=='ALLOWED')reasons.push('SOURCE_AUTOMATION_DISABLED');
 if(Array.isArray(raw.issues)&&raw.issues.some((v:any)=>!['APPLICATION_DATES_UNKNOWN','EMPLOYER_REQUIRES_EDITOR','CONDITIONS_UNKNOWN','DETAIL_TIMEZONE_OR_DATES_UNKNOWN'].includes(v)))reasons.push('UNRESOLVED_VALIDATION_ISSUES');
 if(raw.detailEvidence&&(!source?.rightsAssessment?.evidence?.scopes?.includes('AUTOMATED_CAREER_DETAIL_ACCESS')||override&&!override.evidence?.scopes?.includes('AUTOMATED_CAREER_DETAIL_ACCESS')))reasons.push('DETAIL_SCOPE_REVIEW');
 if(!trustedAdapter)reasons.push('TRUSTED_ADAPTER_REQUIRED');
 if(!date(raw.announcedAt)||Date.parse(raw.announcedAt)>+now)reasons.push('PUBLICATION_DATE_REVIEW');
 if(raw.categoryCode==='PERSONNEL'&&metadataOnly){
  if(raw.eventType!=='RECRUITMENT')reasons.push('EVENT_REVIEW');
 }else if(raw.categoryCode==='PERSONNEL'){
  if(raw.issues?.some((v:any)=>['APPLICATION_DATES_UNKNOWN','EMPLOYER_REQUIRES_EDITOR'].includes(v)))reasons.push('CONTRADICTORY_REQUIRED_FIELDS');
  if(raw.organizationVerification!=='VERIFIED'||typeof raw.organization!=='string'||!raw.organization.trim()||raw.organization.length>500)reasons.push('EMPLOYER_REVIEW');
  const dates=applicationDates(raw);if(!(raw.applicationDatesVerification==='VERIFIED'&&dates.mode==='INSTANT'||raw.applicationDatesVerification==='CALENDAR_VERIFIED'&&dates.mode==='CALENDAR'))reasons.push('APPLICATION_DATES_REVIEW');
  if(raw.eventType!=='RECRUITMENT')reasons.push('EVENT_REVIEW');
 }else if(!generalCareerCategories.includes(raw.categoryCode)||raw.eventType!=='RECRUITMENT')reasons.push('CATEGORY_OR_EVENT_REVIEW');
 return {decision:reasons.length?'MANUAL_REVIEW':'AUTO_PUBLISH_ELIGIBLE',reasons};
}
export function policyFingerprint(source:any,override:any){return createHash('sha256').update(JSON.stringify([source.rightsAssessment,override??null])).digest('hex');}
