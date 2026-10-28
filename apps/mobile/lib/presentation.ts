export const educationOptions=[['BACHELOR','Lisans','P3'],['ASSOCIATE','Önlisans','P93'],['HIGH_SCHOOL','Ortaöğretim','P94']] as const;
export const educationLabel=(value:string)=>({BACHELOR:'Lisans',ASSOCIATE:'Önlisans',HIGH_SCHOOL:'Ortaöğretim',LISANS:'Lisans',ONLISANS:'Önlisans',ORTAOGRETIM:'Ortaöğretim'}[value]||value);
export const scoreText=(value:string|number|null|undefined)=>value==null?'Belirtilmemiş':Number(value).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:5});
export const dateText=(value:string|null|undefined)=>value&&!Number.isNaN(Date.parse(value))?new Date(value).toLocaleDateString('tr-TR',{timeZone:'Europe/Istanbul',day:'numeric',month:'long',year:'numeric'}):'Doğrulanmamış';
export const dateTimeText=(value:string|null|undefined)=>value&&!Number.isNaN(Date.parse(value))?new Date(value).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul',dateStyle:'medium',timeStyle:'short'}):'Doğrulanmamış';
export const errorText=(value:unknown)=>value instanceof Error?value.message:'İşlem tamamlanamadı. Lütfen tekrar deneyin.';
export type Placement={id:string;positionCode:string;title:string;institutionRawName:string;city:string|null;minScore:string|null;maxScore:string|null;quota:number;placedCount:number;vacantCount:number;sourcePage:number;round:{year:number;sequenceNo:number;educationLevel:string};sourceDocument:{originalUrl:string|null;originalFilename:string;sourceOrganization:string}};
export type Position={id:string;title:string;city:string|null;quota:number|null;verifiedAt:string|null;requirements:{educationLevels?:string[];kpssRequired?:boolean;kpssScoreType?:string;kpssMinimumScore?:number;degreeCodes?:string[];complete?:boolean}};
export type Announcement={id:string;title:string;organization:string;status:string;city:string|null;positionTitle:string|null;quota:number|null;educationLevel:string|null;sourceUrl:string|null;applicationUrl:string|null;applicationStartAt:string|null;applicationEndAt:string|null;sourceCheckedAt:string|null;sourceEvidence?:Record<string,unknown>;positions?:Position[];sourceReferences?:{sourceUrl:string|null}[]};
export function announcementStatus(item:Announcement):string {
 if(item.status==='WITHDRAWN')return 'Geri çekildi';
 if(item.status==='ARCHIVED')return 'Arşiv';
 if(!item.applicationEndAt||!item.applicationStartAt||!Number.isFinite(Date.parse(item.applicationEndAt))||!Number.isFinite(Date.parse(item.applicationStartAt)))return 'Tarih doğrulanmamış';
 if(Date.parse(item.applicationStartAt)>Date.parse(item.applicationEndAt))return 'Tarih doğrulanmamış';
 const now=Date.now();if(Date.parse(item.applicationEndAt)<now)return 'Başvuru sona erdi';if(Date.parse(item.applicationStartAt)>now)return 'Yakında';
 return item.status==='PUBLISHED'?'Başvuru açık':'Durum doğrulanmamış';
}
