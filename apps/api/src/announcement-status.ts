import {temporalStatus} from './application-dates';
export function applicationStatus(item:any,now=new Date()){
 if(item.status==='ARCHIVED')return 'ARCHIVED';
 if(!item.sourceCheckedAt||!item.publishedAt||item.status!=='PUBLISHED'||new Date(item.publishedAt)>now)return 'REVIEW_REQUIRED';
 return temporalStatus(item,now);
}
