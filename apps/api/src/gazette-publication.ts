import {applicationDates} from './application-dates';
import {sourceRights} from './source-rights';
import {gazetteUrl} from './gazette-staging';
import {ProcessingDecision} from './career-publication';
// Only minimal verified facts are published; table coverage and eligibility stay unknown.
export function gazettePublicationDecision(candidate:any,source:any,policy:any,now=new Date()):{decision:ProcessingDecision;reasons:string[]}{
 const reasons:string[]=[];
 try{gazetteUrl(candidate?.sourceUrl);}catch{return {decision:'REJECTED',reasons:['INVALID_GAZETTE_URL']};}
 const original=candidate?.sourceEvidence;const e=original&&{...original,gazetteDate:original.gazetteDate??original.index?.gazetteDate,gazetteNumber:original.gazetteNumber??original.index?.gazetteNumber};
 if(!e||e.kind!=='OFFICIAL_GAZETTE'||!(/^[a-f0-9]{64}$/).test(e.pdfSha256??e.documentSha256??'')||!Number.isInteger(e.pageStart)||!Number.isInteger(e.pageEnd)||e.pageStart<1||e.pageEnd<e.pageStart||e.pageEnd>600||typeof candidate.organization!=='string'||!candidate.organization.trim()||candidate.organization.length>500||typeof candidate.title!=='string'||!candidate.title.trim()||candidate.title.length>1000)return {decision:'REJECTED',reasons:['INVALID_GAZETTE_PROOF']};
 if(sourceRights(source,policy,now)!=='LICENSE_VERIFIED')reasons.push('SOURCE_PERMISSION_REVIEW');
 if(source.enabled!==true||source.indexingPolicy?.automatedAccess!=='ALLOWED'||!source.rightsAssessment?.evidence?.scopes?.includes('AUTOMATED_GAZETTE_DOCUMENT_ACCESS')||policy&&!policy.evidence?.scopes?.includes('AUTOMATED_GAZETTE_DOCUMENT_ACCESS'))reasons.push('DOCUMENT_AUTOMATION_DISABLED');
 if(!Array.isArray(candidate.issues)||candidate.issues.some((v:any)=>v!=='POSITION_COVERAGE_REQUIRES_REVIEW'))reasons.push('NATIVE_EXTRACTION_REVIEW');
 if(candidate.eventType!=='RECRUITMENT')reasons.push('EVENT_REVIEW');
 const stamp=(value:any)=>{if(typeof value!=='string'||!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:00\+03:00$/.test(value))return false;const d=new Date(value);return Number.isFinite(+d)&&new Date(+d+3*3600000).toISOString().slice(0,16)===value.slice(0,16);};
 const dates=applicationDates(candidate);if(dates.mode==='UNKNOWN')reasons.push('APPLICATION_DATES_REVIEW');
 const dateProof=(value:string)=>{const [date,time]=value.split('T'),[y,m,d]=date.split('-');return Array.isArray(e.dateEvidence)&&e.dateEvidence.some((p:any)=>Number.isInteger(p.page)&&p.page>=e.pageStart&&p.page<=e.pageEnd&&typeof p.text==='string'&&p.text.includes(d+'.'+m+'.'+y)&&(!time||p.text.includes(time.slice(0,5))||p.text.includes(time.slice(0,5).replace(':','.'))));};
 if(!reasons.includes('APPLICATION_DATES_REVIEW')&&(!dateProof(dates.start.raw)||!dateProof(dates.end.raw)))reasons.push('DATE_QUOTATION_REQUIRED');
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(e.gazetteDate||'')||!Number.isFinite(Date.parse(e.gazetteDate+'T00:00:00+03:00'))||new Date(Date.parse(e.gazetteDate+'T00:00:00+03:00')+3*3600000).toISOString().slice(0,10)!==e.gazetteDate||!/^\d{4,6}$/.test(e.gazetteNumber||'')||Date.parse(e.gazetteDate+'T00:00:00+03:00')>+now)reasons.push('ISSUE_IDENTITY_REVIEW');
 return {decision:reasons.length?'MANUAL_REVIEW':'AUTO_PUBLISH_ELIGIBLE',reasons};
}
