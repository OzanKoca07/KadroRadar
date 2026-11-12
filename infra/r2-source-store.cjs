// Optional private receipt storage. Source documents are deliberately unsupported.
const {createHash,createHmac}=require('node:crypto');
const sha=s=>createHash('sha256').update(s).digest('hex'),hmac=(k,s)=>createHmac('sha256',k).update(s).digest();
function configurationError(field,reason){const error=Error('R2_CONFIGURATION_INVALID');error.code='R2_CONFIGURATION_INVALID';error.validationCode=field+'_'+reason;error.field=field;error.reason=reason;throw error;}
function configuration(env){
 const field=(name)=>{const value=env[name];if(typeof value!=='string'||!value)configurationError(name,'MISSING');if(value!==value.trim()||/[\s\x00-\x1f\x7f]/.test(value))configurationError(name,'WHITESPACE_OR_CONTROL');return value;};
 const endpoint=field('R2_ENDPOINT');
 let url;try{url=new URL(endpoint);}catch{configurationError('R2_ENDPOINT','URL_INVALID');}
 if(url.protocol!=='https:')configurationError('R2_ENDPOINT','HTTPS_REQUIRED');
 if(url.username||url.password||url.port||url.search||url.hash||!/^https:\/\//.test(endpoint))configurationError('R2_ENDPOINT','COMPONENTS_REJECTED');
 if(!/^[^.]+\.r2\.cloudflarestorage\.com$/.test(url.hostname))configurationError('R2_ENDPOINT','HOST_REJECTED');
 if(!/^[a-f0-9]{32}$/.test(url.hostname.split('.')[0]))configurationError('R2_ENDPOINT','ACCOUNT_ID_INVALID');
 // Accept only the exact S3 origin, optionally followed by its equivalent root slash.
 if(endpoint!==url.origin&&endpoint!==url.origin+'/')configurationError('R2_ENDPOINT','PATH_OR_FORMAT_REJECTED');
 const bucket=field('R2_BUCKET');if(!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket))configurationError('R2_BUCKET','FORMAT_INVALID');
 const accessKey=field('R2_ACCESS_KEY_ID');if(!/^[a-f0-9]{32}$/i.test(accessKey))configurationError('R2_ACCESS_KEY_ID','FORMAT_INVALID');
 const secretKey=field('R2_SECRET_ACCESS_KEY');if(!/^[a-f0-9]{64}$/i.test(secretKey))configurationError('R2_SECRET_ACCESS_KEY','FORMAT_INVALID');
 return {endpoint:url.origin,bucket,accessKey,secretKey};
}
function signedReceipt(env,runId,receipt,now=new Date()){
 if(env.R2_SOURCE_RECEIPTS_ENABLED!=='true')return null;
 configuration(env);
 if(!/^[a-f0-9-]{36}$/i.test(runId))throw Error('R2_RECEIPT_INVALID');
 // Whitelist small facts only; parsed text, PDF bytes, URLs and credentials are excluded.
 if(receipt.runId!==runId||!['OK','ERROR'].includes(receipt.status)||!/^[a-f0-9]{64}$/.test(receipt.reportHash||''))throw Error('R2_RECEIPT_INVALID');
 const safe={runId,status:receipt.status,reportHash:receipt.reportHash};for(const k of ['created','changed','duplicate','autoPublished','archived'])if(Number.isSafeInteger(receipt[k])&&receipt[k]>=0)safe[k]=receipt[k];
 const sourceId=receipt.sourceId||env.SOURCE_ID||'gazette';if(!['career','gazette'].includes(sourceId))throw Error('R2_SOURCE_INVALID');safe.sourceId=sourceId;
 const body=JSON.stringify(safe);if(Buffer.byteLength(body)>16384)throw Error('R2_RECEIPT_LIMIT');
 return signedObject(env,'PUT','receipts/'+sourceId+'/'+runId+'.json',body,now);
}
function signedObject(env,method,objectKey,body='',now=new Date()){
 if(!['PUT','GET','DELETE'].includes(method)||! /^(?:receipts\/(?:career|gazette)|pilots\/r2-connection)\/[a-f0-9-]{36}\.json$/i.test(objectKey||'')||Buffer.byteLength(body)>16384)throw Error('R2_OBJECT_REJECTED');
 const config=configuration(env);
 const url=config.endpoint+'/'+config.bucket+'/'+objectKey,u=new URL(url),stamp=now.toISOString().replace(/[:-]|\.\d{3}/g,''),day=stamp.slice(0,8),scope=day+'/auto/s3/aws4_request',digest=sha(body);
 const canonicalHeaders='content-type:application/json\nhost:'+u.host+'\nx-amz-content-sha256:'+digest+'\nx-amz-date:'+stamp+'\n',names='content-type;host;x-amz-content-sha256;x-amz-date';
 const canonical=[method,u.pathname,'',canonicalHeaders,names,digest].join('\n'),toSign=['AWS4-HMAC-SHA256',stamp,scope,sha(canonical)].join('\n');
 const key=hmac(hmac(hmac(hmac('AWS4'+config.secretKey,day),'auto'),'s3'),'aws4_request');
 return {url,method,body,headers:{'content-type':'application/json','x-amz-content-sha256':digest,'x-amz-date':stamp,authorization:'AWS4-HMAC-SHA256 Credential='+config.accessKey+'/'+scope+', SignedHeaders='+names+', Signature='+hmac(key,toSign).toString('hex')}};
}
async function putReceipt(env,runId,receipt,transport=fetch){const req=signedReceipt(env,runId,receipt);if(!req)return {status:'DISABLED'};const result=await transport(req.url,{...req,redirect:'error',signal:AbortSignal.timeout(20000)});await result.body?.cancel();if(!result.ok)throw Error('R2_RECEIPT_WRITE_FAILED');return {status:'STORED'};}
module.exports={configuration,signedReceipt,signedObject,putReceipt};
