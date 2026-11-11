// Date precision is data. Never turn a local datetime/date into a UTC instant.
const UNKNOWN=raw=>({precision:'UNKNOWN',raw:typeof raw==='string'&&raw.length<=80?raw:null,date:null,instant:null});
function parseApplicationDate(raw){
 if(raw instanceof Date)raw=Number.isFinite(+raw)?raw.toISOString():null;
 if(typeof raw!=='string'||raw.length>80)return UNKNOWN(raw);
 const m=/^(20\d{2})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-]\d{2}:\d{2})?)?$/.exec(raw);
 if(!m||+m[2]<1||+m[2]>12||+m[3]<1||+m[3]>new Date(Date.UTC(+m[1],+m[2],0)).getUTCDate()||m[4]&&(+m[4]>23||+m[5]>59||+m[6]>59))return UNKNOWN(raw);
 if(m[7]&&m[7]!=='Z'){const [h,n]=m[7].slice(1).split(':').map(Number);if(h>14||n>59||h===14&&n!==0)return UNKNOWN(raw);}
 const precision=!m[4]?'DATE_ONLY':m[7]?'OFFSET_DATETIME':'LOCAL_DATETIME';
 if(precision==='OFFSET_DATETIME'&&!Number.isFinite(Date.parse(raw)))return UNKNOWN(raw);
 return {precision,raw,date:raw.slice(0,10),instant:precision==='OFFSET_DATETIME'?new Date(raw).toISOString():null};
}
function pair(start,end){
 const a=parseApplicationDate(start),b=parseApplicationDate(end),exact=a.precision==='OFFSET_DATETIME'&&b.precision==='OFFSET_DATETIME';
 const valid=!!a.date&&!!b.date&&(exact?Date.parse(a.instant)<=Date.parse(b.instant):a.precision!=='OFFSET_DATETIME'&&b.precision!=='OFFSET_DATETIME'&&a.date<=b.date);
 return {start:a,end:b,mode:valid?(exact?'INSTANT':'CALENDAR'):'UNKNOWN',calendarVerified:valid};
}
function applicationDates(item){
 const meta=item.applicationDates??item.sourceEvidence?.applicationDates;
 // An explicitly cleared timestamp must not resurrect an obsolete exact value.
 const raw=(side,column)=>item[column]!=null?item[column]:meta?.[side]?.precision!=='OFFSET_DATETIME'?meta?.[side]?.raw:null;
 return pair(raw('start','applicationStartAt'),raw('end','applicationEndAt'));
}
function calendarDay(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
function temporalStatus(item,now=new Date()){
 const dates=applicationDates(item);if(dates.mode==='UNKNOWN')return 'DATE_UNVERIFIED';
 if(dates.mode==='INSTANT'){if(+now>=Date.parse(dates.end.instant))return 'CLOSED';if(+now<Date.parse(dates.start.instant))return 'UPCOMING';return 'OPEN';}
 const today=calendarDay(now);if(dates.end.date<today)return 'PAST_CALENDAR_DATE';if(dates.start.date>today)return 'CALENDAR_UPCOMING';if(dates.end.date===today)return 'DEADLINE_DAY_UNVERIFIED';return 'CALENDAR_WINDOW';
}
function dateLabel(value){const d=parseApplicationDate(value);if(!d.date)return 'Doğrulanmamış';if(d.precision==='OFFSET_DATETIME')return new Date(d.instant).toLocaleDateString('tr-TR',{timeZone:'Europe/Istanbul',day:'numeric',month:'long',year:'numeric'});const [y,m,day]=d.date.split('-');return Number(day)+' '+['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'][Number(m)-1]+' '+y;}
module.exports={parseApplicationDate,pair,applicationDates,calendarDay,temporalStatus,dateLabel};
