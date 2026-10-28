import {publicItems,restrictedSource} from './source-policy';
export async function announcementRequest(route:string,signal?:AbortSignal){
 const base=process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/,'');
 if(!base)throw Error('API adresi yapılandırılmamış.');
 const controller=new AbortController();let timedOut=false;
 const abort=()=>controller.abort();if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(()=>{timedOut=true;controller.abort();},15000);
 try{
  const response=await fetch(base+route,{signal:controller.signal});
  if(!response.ok)throw Error('İlanlar yüklenemedi: HTTP '+response.status);
  const value=await response.json();
  if(!Array.isArray(value.items)||!Number.isSafeInteger(value.pages)||value.pages<0||!Number.isSafeInteger(value.page)||value.page<1||!Number.isSafeInteger(value.total)||value.total<0||value.items.some((item:any)=>!item||typeof item.id!=='string'||typeof item.title!=='string'||typeof item.organization!=='string'))throw Error('Geçersiz ilan yanıtı.');
  return {...value,items:publicItems(value.items)};
 }catch(error){if(timedOut)throw Error('İstek zaman aşımına uğradı. Tekrar deneyin.');throw error;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
export async function announcementDetailRequest(id:string,signal?:AbortSignal){
 const base=process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/,'');if(!base)throw Error('API adresi yapılandırılmamış.');
 const controller=new AbortController(),abort=()=>controller.abort();if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(abort,15000);
 try{const response=await fetch(base+'/announcements/'+encodeURIComponent(id),{signal:controller.signal});if(!response.ok)throw Object.assign(Error('İlan bulunamadı veya erişilemiyor.'),response.status===404?{code:'ANNOUNCEMENT_UNAVAILABLE'}:{});const item=await response.json();if(!item||typeof item.id!=='string'||typeof item.title!=='string'||typeof item.organization!=='string')throw Error('Geçersiz ilan yanıtı.');if(restrictedSource(item))throw Object.assign(Error('Bu ilan mobil yayın politikasına uygun değil.'),{code:'SOURCE_RESTRICTED'});return item;}
 catch(error){if(controller.signal.aborted)throw Error('İstek kesildi veya zaman aşımına uğradı.');throw error;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
// Account matches/inbox omit provenance. Verify public details before rendering their text.
// Bounded concurrency, per-call cache; no scheduler or background collection.
export async function verifiedReferences<T>(items:T[],idOf:(item:T)=>string):Promise<T[]>{
 const ids=[...new Set(items.map(idOf))],allowed=new Set<string>(),controller=new AbortController();let cursor=0;
 const timer=setTimeout(()=>controller.abort(),15000);
 try{await Promise.all(Array.from({length:Math.min(4,ids.length)},async()=>{while(cursor<ids.length){if(controller.signal.aborted)throw Error('Kaynak kontrolü zaman aşımına uğradı.');const id=ids[cursor++];try{await announcementDetailRequest(id,controller.signal);allowed.add(id);}catch(error){const code=(error as {code?:string}).code;if(code!=='SOURCE_RESTRICTED'&&code!=='ANNOUNCEMENT_UNAVAILABLE')throw error;}}}));
  return publicItems(items).filter(item=>allowed.has(idOf(item)));
 }finally{clearTimeout(timer);controller.abort();}
}
