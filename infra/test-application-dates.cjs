const assert=require('node:assert/strict'),d=require('../packages/shared/application-dates.cjs');let checks=0;
for(const v of ['2026-02-30','2026-11-06T24:00:00','2026-11-06T12:99:00','2026-11-06T12:00:00+14:30','2026-11-06T12:00:00+03:99','not-a-date']){assert.equal(d.parseApplicationDate(v).precision,'UNKNOWN');checks++;}
const local=d.parseApplicationDate('2026-11-06T17:00:00');assert.equal(local.precision,'LOCAL_DATETIME');assert.equal(local.instant,null);assert.equal(local.raw,'2026-11-06T17:00:00');assert.equal(d.dateLabel(local.raw),'6 Kasım 2026');checks+=4;
const make=(a,b)=>({applicationDates:d.pair(a,b)}),day=make('2026-11-01','2026-11-06');
for(const clock of ['2026-11-06T00:00:00+03:00','2026-11-06T23:59:59+03:00']){assert.equal(d.temporalStatus(day,new Date(clock)),'DEADLINE_DAY_UNVERIFIED');checks++;}
assert.equal(d.temporalStatus(day,new Date('2026-11-07T00:00:00+03:00')),'PAST_CALENDAR_DATE');assert.equal(d.temporalStatus(day,new Date('2026-11-05T12:00:00+03:00')),'CALENDAR_WINDOW');checks+=2;
const instant={applicationStartAt:'2026-11-05T09:00:00+03:00',applicationEndAt:'2026-11-06T23:59:00+03:00'};assert.equal(d.temporalStatus(instant,new Date('2026-11-06T23:58:59+03:00')),'OPEN');assert.equal(d.temporalStatus(instant,new Date(instant.applicationEndAt)),'CLOSED');assert.equal(d.temporalStatus(instant,new Date('2026-11-07T00:00:00+03:00')),'CLOSED');checks+=3;
assert.equal(d.temporalStatus(make('2026-11-05T09:00:00','2026-11-06T17:00:00'),new Date('2026-11-06T22:00:00+03:00')),'DEADLINE_DAY_UNVERIFIED');assert.equal(d.temporalStatus(make('2026-11-05','2026-11-08'),new Date('2026-11-07T12:00:00+03:00')),'CALENDAR_WINDOW');assert.equal(d.pair('2026-11-07','2026-11-06').mode,'UNKNOWN');assert.equal(d.parseApplicationDate('2026-11-06').instant,null);checks+=4;
require('./register-mobile-typescript.cjs');const m=require('../apps/mobile/lib/presentation.ts');assert.equal(m.dateText('2026-11-06T17:00:00'),'6 Kasım 2026');assert.equal(m.dateTimeText('2026-11-06T17:00:00'),'Kesin saat doğrulanmamış');assert.ok(!m.announcementStatus({...day,status:'PUBLISHED'}).includes('açık'));checks+=3;
const savedTz=process.env.TZ;
try{
 for(const zone of ['UTC','America/Los_Angeles','Asia/Tokyo']){
  process.env.TZ=zone;
  for(const raw of ['2026-11-06T00:30:00','2026-11-06T23:30:00']){assert.equal(m.dateText(raw),'6 Kasım 2026');checks++;}
 }
}finally{if(savedTz===undefined)delete process.env.TZ;else process.env.TZ=savedTz;}
assert.equal(m.dateTimeText('2026-11-06'),'Kesin saat doğrulanmamış');
assert.equal(m.dateText('2026-02-30'),'Doğrulanmamış');
assert.equal(m.dateTimeText('2026-11-06T24:00:00'),'Doğrulanmamış');
assert.equal(m.dateTimeText('2026-11-06T14:00:00Z'),m.dateTimeText('2026-11-06T17:00:00+03:00'));checks+=4;
const published={status:'PUBLISHED',...make('2026-11-05T09:00:00','2026-11-06T17:00:00')};
assert.equal(m.announcementStatus(published,new Date('2026-11-05T12:00:00+03:00')),'Kesin saat doğrulanmamış');
assert.equal(m.announcementStatus(published,new Date('2026-11-06T22:00:00+03:00')),'Son gün · Saat belirsiz');
assert.equal(m.announcementStatus({...instant,status:'PUBLISHED'},new Date(instant.applicationEndAt)),'Başvuru sona erdi');
assert.equal(m.announcementStatus({...instant,status:'PUBLISHED'},new Date('2026-11-06T23:58:59+03:00')),'Başvuru açık');
assert.equal(m.announcementStatus({...published,applicationDates:undefined,applicationStartAt:null,applicationEndAt:null,sourceEvidence:{applicationDates:d.pair(instant.applicationStartAt,instant.applicationEndAt)}},new Date('2026-11-06T12:00:00+03:00')),'Tarih doğrulanmamış');checks+=5;
console.log(JSON.stringify({status:'PASS',test:'date-precision',checks,sourceTimezoneAssumed:false,endOfDayInvented:false}));
