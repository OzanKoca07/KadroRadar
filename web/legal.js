'use strict';
const configuration=window.KADRO_CONFIG||{};
const text=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value;};
const complete=configuration.operatorName&&configuration.supportEmail&&Number.isInteger(configuration.backupRetentionDays)&&Number.isInteger(configuration.auditRetentionDays);
text('configuration',complete?'İşletmeci bilgileri aşağıda yer almaktadır.':'Yayın öncesi yapılandırma eksik: işletmeci, destek adresi ve saklama süreleri henüz belirlenmedi.');
text('operator',configuration.operatorName?'İşletmeci: '+configuration.operatorName:'İşletmeci bilgisi henüz yapılandırılmadı.');
text('contact',configuration.supportEmail?'Destek ve veri talepleri: '+configuration.supportEmail:'Destek e-postası henüz yapılandırılmadı; adres uydurulmamıştır.');
if(complete)text('retention',`Yedek saklama süresi: ${configuration.backupRetentionDays} gün. İçerik audit saklama süresi: ${configuration.auditRetentionDays} gün. Bu süreler sunucu operasyonuyla uygulanmalıdır.`);
const form=document.getElementById('delete-form');
if(form)form.addEventListener('submit',async event=>{event.preventDefault();const button=form.querySelector('button'),password=form.elements.password.value,email=form.elements.email.value;let csrf='';button.disabled=true;
 try{const base=new URL(configuration.apiBase||'/api/v1',location.origin);if(base.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(base.hostname))throw Error('HTTPS API yapılandırması gerekli.');
 const login=await fetch(base.href.replace(/\/$/,'')+'/account/login',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({email,password}),signal:AbortSignal.timeout(15000)});form.elements.password.value='';if(!login.ok)throw Error('Giriş doğrulanamadı veya sunucuya erişilemiyor. Hesap silinmedi.');csrf=(await login.json()).csrfToken;
 const deleted=await fetch(base.href.replace(/\/$/,'')+'/account',{method:'DELETE',credentials:'include',headers:{'x-csrf-token':csrf},signal:AbortSignal.timeout(15000)});if(!deleted.ok)throw Error('Silme tamamlanamadı. Yeniden deneyin veya destek kanalını kullanın.');form.reset();text('status','Hesabınız ve ilişkili aktif veriler silindi.');
 }catch(error){text('status',error instanceof Error?error.message:'İşlem başarısız.');}finally{csrf='';button.disabled=false;}
});
