// Only this fixed HTTPS endpoint receives provider credentials. No redirects/retries.
export interface AccountMail {send(to:string,link:string,purpose:string,id:string):Promise<void>}
export function accountMailFrom(value:string|undefined){
 if(!value||value.length>254||/[\r\n\x00-\x1f\x7f]/.test(value))return null;
 const address='[^\\s<>@,;]+@[^\\s<>@,;]+\\.[^\\s<>@,;]+';
 if(new RegExp('^'+address+'$').test(value))return value;
 // One unquoted display name and one mailbox only; no header/address list syntax.
 if(new RegExp('^[\\p{L}\\p{N} ._-]{1,64} <'+address+'>$','u').test(value))return value;
 return null;
}
export function recoveryConfiguration(env:NodeJS.ProcessEnv=process.env){
 if(env.ACCOUNT_RECOVERY_ENABLED!=='true')return null;
 try{
  const origin=new URL(env.ACCOUNT_RECOVERY_ORIGIN||'');
  if(origin.protocol!=='https:'||origin.origin!==env.ACCOUNT_RECOVERY_ORIGIN||origin.username||origin.password||origin.hostname==='localhost'||/^[\d.:]+$/.test(origin.hostname))return null;
  if(env.ACCOUNT_MAIL_PROVIDER!=='resend'||!env.RESEND_API_KEY||env.RESEND_API_KEY.length<16||!accountMailFrom(env.ACCOUNT_MAIL_FROM)||!env.ACCOUNT_RATE_HMAC_KEY||env.ACCOUNT_RATE_HMAC_KEY.length<32)return null;
  return {origin:origin.origin,key:env.RESEND_API_KEY,from:env.ACCOUNT_MAIL_FROM!,rateKey:env.ACCOUNT_RATE_HMAC_KEY};
 }catch{return null;}
}
export class ResendAccountMail implements AccountMail {
 async send(to:string,link:string,purpose:string,id:string){
  const config=recoveryConfiguration();if(!config)throw Error('MAIL_UNAVAILABLE');
  const response=await fetch('https://api.resend.com/emails',{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),headers:{Authorization:'Bearer '+config.key,'Content-Type':'application/json','Idempotency-Key':id},body:JSON.stringify({from:config.from,to:[to],subject:purpose==='VERIFY_EMAIL'?'KadroRadar e-posta doğrulama':'KadroRadar parola sıfırlama',text:`Bu işlemi sen istediysen bağlantıyı aç:\n${link}\nİstemediysen bu e-postayı yok sayabilirsin.`})});
  // Neither provider response bodies nor recipient/link are logged or persisted.
  await response.body?.cancel();if(!response.ok)throw Error('MAIL_REJECTED');
 }
}
