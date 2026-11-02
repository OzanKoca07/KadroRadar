const assert=require('node:assert/strict'),{randomBytes}=require('node:crypto');
const {accountMailFrom,recoveryConfiguration,ResendAccountMail}=require('./dist/account-mail');
(async()=>{const original=global.fetch;try{
 const env={ACCOUNT_RECOVERY_ENABLED:'true',ACCOUNT_MAIL_PROVIDER:'resend',RESEND_API_KEY:randomBytes(24).toString('hex'),ACCOUNT_MAIL_FROM:'accounts@example.test',ACCOUNT_RATE_HMAC_KEY:randomBytes(32).toString('hex'),ACCOUNT_RECOVERY_ORIGIN:'https://example.test'};
 assert.ok(recoveryConfiguration(env));
 assert.equal(accountMailFrom('KadroRadar <noreply@bildirim.kadrooradar.com>'),'KadroRadar <noreply@bildirim.kadrooradar.com>');
 for(const invalid of ['KadroRadar <a@example.test>,b@example.test','A\r\nBcc: b@example.test <a@example.test>','<a@example.test>','A <a@example.test> trailing','a@example.test,b@example.test'])assert.equal(accountMailFrom(invalid),null);
 assert.ok(recoveryConfiguration({...env,ACCOUNT_MAIL_FROM:'KadroRadar <noreply@bildirim.kadrooradar.com>'}));for(const change of [{ACCOUNT_RECOVERY_ENABLED:'false'},{ACCOUNT_MAIL_PROVIDER:'fake'},{ACCOUNT_RECOVERY_ORIGIN:'http://example.test'},{ACCOUNT_RECOVERY_ORIGIN:'https://example.test/path'},{ACCOUNT_RECOVERY_ORIGIN:'https://user@example.test'},{ACCOUNT_RATE_HMAC_KEY:''},{RESEND_API_KEY:''},{ACCOUNT_MAIL_FROM:'bad\n@example.test'}])assert.equal(recoveryConfiguration({...env,...change}),null);
 Object.assign(process.env,{...env,ACCOUNT_MAIL_FROM:'KadroRadar <noreply@bildirim.kadrooradar.com>'});let cancelled=false;
 global.fetch=async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');assert.equal(options.redirect,'error');assert.equal(options.method,'POST');assert.ok(options.signal instanceof AbortSignal);assert.equal(options.headers.Authorization,'Bearer '+env.RESEND_API_KEY);assert.equal(options.headers['Idempotency-Key'],'synthetic-message-id');const body=JSON.parse(options.body);assert.equal(body.from,'KadroRadar <noreply@bildirim.kadrooradar.com>');assert.deepEqual(body.to,['recipient@example.test']);assert.equal(body.html,undefined);return {ok:true,body:{async cancel(){cancelled=true;}}};};
 await new ResendAccountMail().send('recipient@example.test','https://example.test/account-recovery#synthetic','VERIFY_EMAIL','synthetic-message-id');assert.ok(cancelled);
 global.fetch=async()=>({ok:false,body:{async cancel(){}}});await assert.rejects(()=>new ResendAccountMail().send('recipient@example.test','synthetic','RESET_PASSWORD','id'),{message:'MAIL_REJECTED'});
 console.log(JSON.stringify({status:'PASS',test:'account-mail',checks:18,realEmailDelivery:false}));
 }finally{global.fetch=original;}})().catch(e=>{console.error(JSON.stringify({status:'FAIL',test:'account-mail',kind:e.name}));process.exitCode=1;});
