let token:string|null=null,expiresAt=0,restored=false,generation=0,sessionBase='';
let restoring:Promise<void>|null=null,queue:Promise<unknown>=Promise.resolve();
const SESSION_KEY='kadroradar.session.v1',MAX_SESSION_MS=8*3600000,listeners=new Set<()=>void>();
export function subscribeSession(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
function changed(){for(const listener of listeners)listener();}
function baseUrl(){
 const value=process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/,'')||'';
 try{const u=new URL(value),local=typeof __DEV__!=='undefined'&&__DEV__&&['localhost','127.0.0.1','[::1]'].includes(u.hostname);if((u.protocol!=='https:'&&!(u.protocol==='http:'&&local))||u.username||u.password||u.search||u.hash||u.pathname!=='/api/v1')return '';return value;}catch{return '';}
}
export function hasSession(){return !!token&&expiresAt>Date.now()&&sessionBase===baseUrl();}
export class AccountError extends Error{
 constructor(public code:string,message:string){super(message);this.name='AccountError';}
}
const storageError=()=>new AccountError('SESSION_STORAGE','Güvenli oturum saklama kullanılamıyor. Tekrar giriş yapmayı dene.');
function serial<T>(work:()=>Promise<T>):Promise<T>{const next=queue.then(work);queue=next.catch(()=>{});return next;}
async function store(){try{const secure=await import('expo-secure-store');if(!await secure.isAvailableAsync())throw Error();return secure;}catch{throw storageError();}}
function validSession(value:any){return value?.version===1&&typeof value.token==='string'&&/^[a-f0-9]{64}$/.test(value.token)&&typeof value.expiresAt==='number'&&value.expiresAt>Date.now()&&value.expiresAt<=Date.now()+MAX_SESSION_MS+60000&&value.apiBase===baseUrl();}
export async function clearSession(){
 ++generation;token=null;expiresAt=0;sessionBase='';restored=true;changed();
 await serial(async()=>{try{await(await store()).deleteItemAsync(SESSION_KEY);}catch{throw storageError();}});
}
export async function saveSession(value:{token:string;expiresAt:string}){
 const data={version:1,token:value?.token,expiresAt:Date.parse(value?.expiresAt),apiBase:baseUrl()};
 if(!data.apiBase||!validSession(data))throw new AccountError('INVALID_RESPONSE','Giriş doğrulanamadı. Tekrar dene.');
 const revision=++generation;
 await serial(async()=>{try{const secure=await store();await secure.setItemAsync(SESSION_KEY,JSON.stringify(data),{keychainAccessible:secure.WHEN_UNLOCKED_THIS_DEVICE_ONLY});}catch{throw storageError();}});
 if(revision!==generation)throw new AccountError('SESSION_CHANGED','Oturum değişti. Tekrar giriş yap.');
 token=data.token;expiresAt=data.expiresAt;sessionBase=data.apiBase;restored=true;changed();
}
export async function restoreSession(){
 if(restored){if(token&&!hasSession())await clearSession();return;}if(restoring)return restoring;
 const revision=generation;
 restoring=serial(async()=>{
  try{const secure=await store(),raw=await secure.getItemAsync(SESSION_KEY);let data;try{data=raw?JSON.parse(raw):null;}catch{}
   if(revision!==generation)return;
   if(raw&&!validSession(data)){await secure.deleteItemAsync(SESSION_KEY);data=null;}
   if(revision!==generation)return;
   if(data){token=data.token;expiresAt=data.expiresAt;sessionBase=data.apiBase;}
   restored=true;changed();
  }catch{throw storageError();}
 }).finally(()=>{restoring=null;});
 return restoring;
}
export function accountError(status:number,path:string,code?:string){
 if(code==='RECOVERY_LINK_INVALID')return new AccountError(code,'Bağlantının süresi dolmuş. Yeni bağlantı isteyebilirsin.');
 if(code==='RECOVERY_UNAVAILABLE')return new AccountError(code,'Hesap kurtarma şu anda kullanılamıyor.');
 if(code==='REGISTRATION_DISABLED')return new AccountError('REGISTRATION_DISABLED','Yeni hesap oluşturma şu anda kullanılamıyor.');
 if(status===429||code==='AUTH_RATE_LIMITED')return new AccountError('RATE_LIMITED','Çok fazla deneme yaptın. Bir süre sonra tekrar dene.');
 if(status===401)return new AccountError(path==='/account/login'?'INVALID_CREDENTIALS':'SESSION_REQUIRED',path==='/account/login'?'E-posta adresi veya şifre hatalı.':'Oturumun sona erdi. Devam etmek için giriş yap.');
 if(status===403)return new AccountError('ACCESS_DENIED','Bu işlem için yetkin bulunmuyor.');
 if(status===400||status===422)return new AccountError('INVALID_INPUT',path==='/account/register'?'Hesap oluşturulamadı. Bilgilerini kontrol et veya giriş yap.':'Bilgilerini kontrol edip tekrar dene.');
 return new AccountError('SERVICE_UNAVAILABLE','Bağlantı kurulamadı. Tekrar dene.');
}
export async function accountRequest(path:string,method='GET',body?:unknown){
 const base=baseUrl();
 if(!base)throw new AccountError('CONFIGURATION','Bağlantı kurulamadı. Tekrar dene.');
 const publicRoute=['/account/login','/account/register','/account/capabilities','/account/password-reset/request','/account/password-reset/confirm','/account/email-verification/confirm'].includes(path);
 if(!publicRoute){await restoreSession();if(!hasSession()){if(token)await clearSession();throw new AccountError('SESSION_REQUIRED','Devam etmek için giriş yap.');}}
 const requestToken=publicRoute?null:token;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch(base+path,{method,credentials:'omit',signal:controller.signal,headers:{'content-type':'application/json','x-client-platform':'mobile',...(requestToken?{authorization:`Bearer ${requestToken}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  if(!response.ok){let code:string|undefined;try{const value=await response.json();if(['REGISTRATION_DISABLED','AUTH_RATE_LIMITED','AUTH_ORIGIN_REJECTED','RECOVERY_UNAVAILABLE','RECOVERY_LINK_INVALID'].includes(value?.code))code=value.code;}catch{}
   if(response.status===401&&requestToken&&token===requestToken)await clearSession();throw accountError(response.status,path,code);
  }
  let result;try{result=await response.json();}catch{throw new AccountError('INVALID_RESPONSE','Bağlantı kurulamadı. Tekrar dene.');}
  if(path==='/account/logout'||path==='/account'&&method==='DELETE')await clearSession();
  return result;
 }catch(error){if(error instanceof AccountError)throw error;if(controller.signal.aborted)throw new AccountError('TIMEOUT','Bağlantı kurulamadı. Tekrar dene.');throw new AccountError('NETWORK','İnternet bağlantını kontrol et.');}
 finally{clearTimeout(timer);}
}
export async function registrationPolicy():Promise<'OPEN'|'CLOSED'|'UNKNOWN'>{
 try{const value=await accountRequest('/account/capabilities');return value.selfRegistration===true?'OPEN':value.selfRegistration===false?'CLOSED':'UNKNOWN';}catch{return 'UNKNOWN';}
}
