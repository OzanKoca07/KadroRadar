import {official} from './official';
import {restrictedSource} from './source-policy';
export type NewsItem={id:string;title:string;organization:string;date:string;summary:string;sourceUrl:string;reviewMode:'MANUAL_REVIEWED'};
export function reviewedNews(value:unknown):NewsItem[]{
 if(!value||!Array.isArray((value as any).items))return [];
 return (value as any).items.filter((item:any)=>item&&item.reviewMode==='MANUAL_REVIEWED'&&!restrictedSource(item)&&official(item.sourceUrl)&&['id','title','organization','date','summary'].every(key=>typeof item[key]==='string')&&item.title.length>0&&item.title.length<=500&&item.organization.length<=500&&item.summary.length<=180&&Number.isFinite(Date.parse(item.date))).slice(0,5);
}
export async function loadNews(signal:AbortSignal){
 const base=process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/,'');if(!base)return [];
 const response=await fetch(base+'/announcements/news',{method:'GET',signal});if(!response.ok)return [];
 return reviewedNews(await response.json());
}
