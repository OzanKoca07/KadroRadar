export type AuthErrors={email?:string;password?:string};
export function validateAuth(email:string,password:string,register=false):AuthErrors{
 const errors:AuthErrors={};
 if(!email.trim())errors.email='E-posta adresini gir.';
 else if(email.trim().length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))errors.email='Geçerli bir e-posta adresi gir.';
 if(!password)errors['password']='Şifreni gir.';
 else if(password.length>128||register&&password.length<12)errors['password']=register?'Şifren 12–128 karakter olmalı.':'Şifren en fazla 128 karakter olabilir.';
 return errors;
}
const destinations=['/saved','/matches','/notifications'] as const;
export function loginDestination(value:unknown):typeof destinations[number]|null{return destinations.includes(value as any)?value as typeof destinations[number]:null;}
