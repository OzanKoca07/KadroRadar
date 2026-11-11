import {official} from './official';
import {restrictedSource} from './source-policy';
export type NewsItem={id:string;title:string;organization:string|null;sourceName?:string;contentType?:'PERSONNEL_RECRUITMENT'|'CAREER_NOTICE';categoryCode?:string;date:string;summary:string;sourceUrl:string;reviewMode:'MANUAL_REVIEWED'|'AUTO_VALIDATED'};
function autoCareerNotice(item:any){try{const u=new URL(item.sourceUrl);if(item.reviewMode==='AUTO_VALIDATED'&&item.contentType==='PERSONNEL_RECRUITMENT'&&item.applicationStatus==='OPEN'&&typeof item.organization==='string'&&item.organization.trim()){return item.sourceName==='Kariyer Kapısı'&&u.hostname==='kariyerkapisi.gov.tr'&&u.pathname.toLowerCase()==='/ilandetay'||item.sourceName==='Resmî Gazete'&&u.hostname==='www.resmigazete.gov.tr'&&/^\/(?:eskiler|ilanlar\/eskiilanlar)\/20\d{2}\/\d{2}\/20\d{6}(?:[-_]\d+)*\.(?:pdf|html?)$/i.test(u.pathname);}
 return item.reviewMode==='AUTO_VALIDATED'&&item.contentType==='CAREER_NOTICE'&&item.sourceName==='Kariyer Kapısı'&&u.hostname==='kariyerkapisi.gov.tr'&&u.pathname.toLowerCase()==='/ilandetay'&&['EXAM_PLACEMENT','INTERNAL','EDUCATION'].includes(item.categoryCode);}catch{return false;}}
export function reviewedNews(value:unknown):NewsItem[]{
 if(!value||!Array.isArray((value as any).items))return [];
 return (value as any).items.filter((item:any)=>item&&(item.reviewMode==='MANUAL_REVIEWED'||autoCareerNotice(item))&&!restrictedSource(item)&&official(item.sourceUrl)&&['id','title','date','summary'].every(key=>typeof item[key]==='string')&&item.title.length>0&&item.title.length<=500&&(typeof item.organization==='string'&&item.organization.length<=500||item.contentType==='CAREER_NOTICE'&&item.organization===null&&item.sourceName==='Kariyer Kapısı')&&item.summary.length<=180&&Number.isFinite(Date.parse(item.date))).slice(0,5);
}
export async function loadNews(signal:AbortSignal){
 const base=process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/,'');if(!base)return [];
 const response=await fetch(base+'/announcements/news',{method:'GET',signal});if(!response.ok)return [];
 return reviewedNews(await response.json());
}

export function newsTitle(title:string){const chars=Array.from(title);return chars.length>100?chars.slice(0,100).join('')+'...':title;}
