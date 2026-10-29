let token:string|null=null;
export function setSession(value:string|null){token=value;}
export function hasSession(){return !!token;}
export class AccountError extends Error{
 constructor(public code:string,message:string){super(message);this.name='AccountError';}
}
export function accountError(status:number,path:string,code?:string){
 if(code==='REGISTRATION_DISABLED')return new AccountError('REGISTRATION_DISABLED','Yeni hesap oluşturma şu anda kullanılamıyor.');
 if(status===429||code==='AUTH_RATE_LIMITED')return new AccountError('RATE_LIMITED','Çok fazla deneme yaptın. Bir süre sonra tekrar dene.');
 if(status===401)return new AccountError(path==='/account/login'?'INVALID_CREDENTIALS':'SESSION_REQUIRED',path==='/account/login'?'E-posta adresi veya şifre hatalı.':'Devam etmek için giriş yap.');
 if(status===403)return new AccountError('ACCESS_DENIED','Bu işlem şu anda kullanılamıyor. Daha sonra tekrar dene.');
 if(status===400||status===422)return new AccountError('INVALID_INPUT',path==='/account/register'?'Hesap oluşturulamadı. Bilgilerini kontrol et veya giriş yap.':'Bilgilerini kontrol edip tekrar dene.');
 return new AccountError('SERVICE_UNAVAILABLE','Bağlantı kurulamadı. Tekrar dene.');
}
// Memory only. Process restart requires login. Never persists credentials.
export async function accountRequest(path:string,method='GET',body?:unknown){
 const base=process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/,'');
 if(!base)throw new AccountError('CONFIGURATION','Bağlantı kurulamadı. Tekrar dene.');
 const publicRoute=['/account/login','/account/register','/account/capabilities'].includes(path);
 if(!publicRoute&&!token)throw new AccountError('SESSION_REQUIRED','Devam etmek için giriş yap.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch(base+path,{method,signal:controller.signal,headers:{'content-type':'application/json','x-client-platform':'mobile',...(!publicRoute&&token?{authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  if(!response.ok){let code:string|undefined;try{const value=await response.json();if(['REGISTRATION_DISABLED','AUTH_RATE_LIMITED','AUTH_ORIGIN_REJECTED'].includes(value?.code))code=value.code;}catch{}
   if(response.status===401&&!publicRoute)token=null;throw accountError(response.status,path,code);
  }
  try{return await response.json();}catch{throw new AccountError('INVALID_RESPONSE','Bağlantı kurulamadı. Tekrar dene.');}
 }catch(error){if(error instanceof AccountError)throw error;if(controller.signal.aborted)throw new AccountError('TIMEOUT','Bağlantı kurulamadı. Tekrar dene.');throw new AccountError('NETWORK','İnternet bağlantını kontrol et.');}
 finally{clearTimeout(timer);}
}
export async function registrationPolicy():Promise<'OPEN'|'CLOSED'|'UNKNOWN'>{
 try{const value=await accountRequest('/account/capabilities');return value.selfRegistration===true?'OPEN':value.selfRegistration===false?'CLOSED':'UNKNOWN';}catch{return 'UNKNOWN';}
}
