export function applicationStatus(item:any,now=new Date()){
 if(item.status==='ARCHIVED')return 'ARCHIVED';
 if(!item.sourceCheckedAt||!item.publishedAt||item.status!=='PUBLISHED'||new Date(item.publishedAt)>now)return 'REVIEW_REQUIRED';
 const start=item.applicationStartAt?new Date(item.applicationStartAt):null,end=item.applicationEndAt?new Date(item.applicationEndAt):null;
 if(!start||!end||!Number.isFinite(+start)||!Number.isFinite(+end)||start>end)return 'DATE_UNVERIFIED';
 if(end<now)return 'CLOSED';
 if(start>now)return 'UPCOMING';
 return 'OPEN';
}
