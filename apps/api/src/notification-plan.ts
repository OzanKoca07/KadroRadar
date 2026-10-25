import {evaluate, Profile, Requirements} from './eligibility';
export function notificationPlan(profile: Profile & {notificationConsent?:boolean}, announcements:any[], saved:any[], now=new Date()) {
  if(profile.notificationConsent !== true)return [];
  const events: {announcementId:string;eventKey:string;kind:string;title:string}[]=[];
  for(const a of announcements){
    const open=a.status==='PUBLISHED' && a.sourceCheckedAt && a.publishedAt && new Date(a.publishedAt)<=now && a.applicationStartAt && new Date(a.applicationStartAt)<=now && a.applicationEndAt && new Date(a.applicationEndAt)>=now;
    if(!open)continue;
    const eligible=(a.positions??[]).some((p:any)=>evaluate(profile,p.requirements as Requirements,!!p.verifiedAt).outcome==='ELIGIBLE');
    if(eligible && now.getTime()-new Date(a.publishedAt).getTime()<24*3600000) events.push({announcementId:a.id,eventKey:`NEW:${a.id}:${new Date(a.publishedAt).toISOString()}`,kind:'NEW_MATCH',title:'Profilinizle eşleşen yeni kadro yayımlandı.'});
    if(eligible && new Date(a.applicationEndAt).getTime()-now.getTime()<=3*86400000)events.push({announcementId:a.id,eventKey:`DEADLINE:${a.id}:${new Date(a.applicationEndAt).toISOString()}`,kind:'DEADLINE',title:'Eşleşen ilanın başvuru bitişi yaklaşıyor.'});
  }
  for(const s of saved){
    const a=s.announcement;
    const extended=a.sourceCheckedAt && s.lastKnownEndAt && a.applicationEndAt && new Date(a.applicationEndAt)>new Date(s.lastKnownEndAt);
    if(new Date(a.updatedAt)>new Date(s.createdAt))events.push({announcementId:a.id,eventKey:`CHANGE:${a.id}:${new Date(a.updatedAt).toISOString()}`,kind:a.status==='WITHDRAWN'?'WITHDRAWN':extended?'EXTENDED':'SAVED_CHANGE',title:a.status==='WITHDRAWN'?'Kaydettiğiniz ilan geri çekildi.':extended?'Kaydettiğiniz ilanın başvuru süresi uzatıldı.':'Kaydettiğiniz ilanın bilgileri değişti; resmî kaynağı kontrol edin.'});
    if(a.status==='PUBLISHED' && a.applicationEndAt && new Date(a.applicationEndAt)>now && new Date(a.applicationEndAt).getTime()-now.getTime()<=86400000)events.push({announcementId:a.id,eventKey:`SAVED_DEADLINE:${a.id}:${new Date(a.applicationEndAt).toISOString()}`,kind:'SAVED_DEADLINE',title:'Kaydettiğiniz ilanın son başvuru günü yaklaşıyor.'});
  }
  return events;
}
