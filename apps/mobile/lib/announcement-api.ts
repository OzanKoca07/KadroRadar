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
  return value;
 }catch(error){if(timedOut)throw Error('İstek zaman aşımına uğradı. Tekrar deneyin.');throw error;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
