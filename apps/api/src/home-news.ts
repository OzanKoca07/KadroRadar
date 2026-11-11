import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {sourceRights,hardRestricted} from './source-rights';
const registry=require(resolve(__dirname,'../../../packages/official-sources.json'));
export function newsSourceRecord(value:any):any{try{const u=new URL(value);return Object.values(registry).find((source:any)=>!hardRestricted(source)&&source.hosts.includes(u.hostname));}catch{return undefined;}}
export function newsFingerprint(item:any){return createHash('sha256').update(JSON.stringify(['title','organization','positionTitle','quota','city','sourceUrl','announcedAt','publishedAt','sourceCheckedAt','applicationEndAt'].map(key=>item[key]??null))).digest('hex');}
export function newsSource(value:unknown):value is string{
 try{if(typeof value!=='string')return false;const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&!/(^|\.)ilan\.gov\.tr$/i.test(u.hostname)&&Object.values(registry).some((s:any)=>s.hosts.includes(u.hostname));}catch{return false;}
}
export function newsMetadata(item:any){
 const review=item.sourceEvidence?.homeNews;
 let provenance=JSON.stringify([item.sourceEvidence,item.sourceReferences]);for(let i=0;i<2;i++){try{provenance=decodeURIComponent(provenance);}catch{break;}}
 if(/ilan\.gov\.tr/i.test(provenance)||!newsSource(item.sourceUrl)||sourceRights(newsSourceRecord(item.sourceUrl))!=='LICENSE_VERIFIED'||review?.mode!=='MANUAL_REVIEWED'||review.indexPermissionReviewed!==true||review.factsHash!==newsFingerprint(item)||!Number.isFinite(Date.parse(review.reviewedAt)))return null;
 return {id:item.id,title:item.title,organization:item.organization,date:item.announcedAt??item.publishedAt,sourceUrl:item.sourceUrl,reviewMode:'MANUAL_REVIEWED',summary:typeof review.editorSummary==='string'&&review.editorSummary.trim().length>=10&&review.editorSummary.length<=180&&!/[<>\r\n]/.test(review.editorSummary)?review.editorSummary:[item.positionTitle,item.quota==null?null:`${item.quota} kontenjan`,item.city].filter(Boolean).join(' · ').slice(0,180)};
}
