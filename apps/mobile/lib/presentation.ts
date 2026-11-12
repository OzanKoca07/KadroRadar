const applicationDate=require('../../../packages/shared/application-dates.cjs');
export const educationOptions=[['BACHELOR','Lisans','P3'],['ASSOCIATE','Önlisans','P93'],['HIGH_SCHOOL','Ortaöğretim','P94']] as const;
export const educationLabel=(value:string)=>({BACHELOR:'Lisans',ASSOCIATE:'Önlisans',HIGH_SCHOOL:'Ortaöğretim',LISANS:'Lisans',ONLISANS:'Önlisans',ORTAOGRETIM:'Ortaöğretim'}[value]||value);
export const scoreText=(value:string|number|null|undefined)=>value==null?'Belirtilmemiş':Number(value).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:5});
export const dateText=(value:string|null|undefined):string=>applicationDate.dateLabel(value);
export const dateTimeText=(value:string|null|undefined):string=>{
 const parsed=applicationDate.parseApplicationDate(value);
 if(parsed.precision==='UNKNOWN')return 'Doğrulanmamış';
 if(parsed.precision!=='OFFSET_DATETIME')return 'Kesin saat doğrulanmamış';
 return new Date(parsed.instant).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul',dateStyle:'medium',timeStyle:'short'});
};
export const errorText=(value:unknown)=>{const message=value instanceof Error?value.message:'';if(/HTTP|İşlem başarısız|Prisma|SQL|stack|TypeError|Network request failed/i.test(message))return 'Bağlantı kurulamadı. Tekrar dene.';return message&&message.length<=240?message:'İşlem tamamlanamadı. Tekrar dene.';};
export type Placement={id:string;positionCode:string;title:string;institutionRawName:string;city:string|null;minScore:string|null;maxScore:string|null;quota:number;placedCount:number;vacantCount:number;sourcePage:number;round:{year:number;sequenceNo:number;educationLevel:string};sourceDocument:{originalUrl:string|null;originalFilename:string;sourceOrganization:string}};
export type Position={id:string;title:string;city:string|null;quota:number|null;verifiedAt:string|null;requirements:{educationLevels?:string[];kpssRequired?:boolean;kpssScoreType?:string;kpssMinimumScore?:number;degreeCodes?:string[];complete?:boolean}};
export type Announcement={announcedAt?:string|null;id:string;title:string;organization:string;status:string;city:string|null;positionTitle:string|null;quota:number|null;educationLevel:string|null;sourceUrl:string|null;applicationUrl:string|null;applicationStartAt:string|null;applicationEndAt:string|null;sourceCheckedAt:string|null;applicationDates?:Record<string,unknown>;sourceEvidence?:Record<string,unknown>;positions?:Position[];sourceReferences?:{sourceUrl:string|null}[]};
export function announcementStatus(item:Announcement,now:Date=new Date()):string {
 if(item.status==='WITHDRAWN')return 'Geri çekildi';
 if(item.status==='ARCHIVED')return 'Arşiv';
 const temporal=applicationDate.temporalStatus(item,now);
 if(temporal==='DATE_UNVERIFIED')return 'Tarih doğrulanmamış';
 if(temporal==='CLOSED'||temporal==='PAST_CALENDAR_DATE')return 'Başvuru sona erdi';
 if(temporal==='UPCOMING'||temporal==='CALENDAR_UPCOMING')return 'Yakında';
 if(temporal==='DEADLINE_DAY_UNVERIFIED')return 'Son gün · Saat belirsiz';
 if(temporal==='CALENDAR_WINDOW')return 'Kesin saat doğrulanmamış';
 return temporal==='OPEN'&&item.status==='PUBLISHED'?'Başvuru açık':'Durum doğrulanmamış';
}
