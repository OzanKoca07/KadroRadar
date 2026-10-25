let token: string | null = null;
// Memory only: app restart requires login. Do not persist credentials in plaintext storage.
export function setSession(value: string | null) { token=value; }
export function hasSession() {return !!token;}
export async function accountRequest(path: string, method='GET', body?: unknown) {
  const base=process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/,'');
  if(!base)throw new Error('API adresi yapılandırılmamış.');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
  try {
    const response=await fetch(base+path,{method,signal:controller.signal,headers:{'content-type':'application/json','x-client-platform':'mobile',...(token?{authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    if(response.status===401){token=null;throw new Error('Lütfen profil ekranından giriş yapın.');}
    if(!response.ok)throw new Error(`İşlem başarısız (${response.status}).`);
    return await response.json();
  } catch(error:any) {if(error.name==='AbortError')throw new Error('İstek zaman aşımına uğradı.');throw error;} finally {clearTimeout(timer);}
}
