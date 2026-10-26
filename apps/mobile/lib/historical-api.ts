export async function historicalRequest(route:string,signal?:AbortSignal){
 const base=process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/,'');
 if(!base)throw Error('API adresi yapılandırılmamış.');
 const controller=new AbortController();let timedOut=false;
 const abort=()=>controller.abort();
 if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(()=>{timedOut=true;controller.abort();},15000);
 try{
  const response=await fetch(base+route,{signal:controller.signal});
  if(!response.ok)throw Error('Veriler yüklenemedi: HTTP '+response.status);
  const value=await response.json();
  if(route==='/historical/rounds'){if(!Array.isArray(value))throw Error('Geçersiz dönem yanıtı.');}
  else if(!Array.isArray(value.items)||!Number.isSafeInteger(value.total)||!Number.isSafeInteger(value.pages))throw Error('Geçersiz yerleştirme yanıtı.');
  return value;
 }catch(error){if(timedOut)throw Error('İstek zaman aşımına uğradı. Tekrar deneyin.');throw error;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
