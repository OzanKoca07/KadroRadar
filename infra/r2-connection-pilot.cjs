// Explicit operator-only single object probe. No ingest client or database imports.
const {randomUUID,createHash}=require('node:crypto'),{configuration,signedObject}=require('./r2-source-store.cjs');
const hash=b=>createHash('sha256').update(b).digest('hex');
const safeCodes=new Set(['R2_CONFIGURATION_INVALID','R2_OBJECT_REJECTED','R2_PILOT_NOT_APPROVED','R2_PILOT_TARGET_REJECTED','R2_PILOT_DATABASE_ENV_REJECTED','R2_PILOT_PUT_FAILED','R2_PILOT_GET_FAILED','R2_PILOT_READ_LIMIT','R2_PILOT_HASH_MISMATCH','R2_PILOT_DELETE_FAILED','R2_PILOT_DELETE_NOT_VERIFIED']);
const safeCode=(error,fallback)=>safeCodes.has(error?.message)?error.message:fallback;
async function pilot(env=process.env,transport=fetch,{validateOnly=false}={}){
 if(!validateOnly&&(env.R2_PILOT_APPROVED!=='true'||env.R2_PILOT_CONFIRMATION!=='R2 kadrooradar-source-cache ONE OBJECT'))throw Error('R2_PILOT_NOT_APPROVED');
 if(env.R2_BUCKET!=='kadrooradar-source-cache')throw Error('R2_PILOT_TARGET_REJECTED');
 if(env.DATABASE_URL)throw Error('R2_PILOT_DATABASE_ENV_REJECTED');
 const operationId=randomUUID(),objectKey='pilots/r2-connection/'+operationId+'.json',body=JSON.stringify({kind:'KADRORADAR_R2_CONNECTION_TEST',operationId,noSourceOrUserData:true}),digest=hash(body),requests=[];
 let configurationValid=false,putAttempted=false,deleted=false,verified=false,phase='CONFIGURATION',failure,failurePhase,diagnosis={};
 async function call(method){const request=signedObject(env,method,objectKey,method==='PUT'?body:'');const {url,body:payload,...init}=request;const attempt={method,status:null};requests.push(attempt);if(method==='PUT')putAttempted=true;const response=await transport(url,{...init,...(method==='PUT'?{body:payload}:{}),redirect:'error',signal:AbortSignal.timeout(20000)});const raw=response.headers?.get('cf-ray')||response.headers?.get('x-amz-request-id');attempt.status=response.status;if(typeof raw==='string'&&/^[a-zA-Z0-9:-]{1,128}$/.test(raw))attempt.requestId=raw;return response;}
 try{
  // A transport failure can occur after the provider accepted PUT. Always attempt
  // cleanup of this exact random key, never a prefix/list/bulk deletion.
  configuration(env);configurationValid=true;
  if(validateOnly)return {status:'PASS',phase:'CONFIGURATION',configurationValid:true,putAttempted:false,httpAttempts:0,requests:[],readHashVerified:false,deletionVerified:false,cleanupStatus:'NOT_REQUIRED',cleanupOutstanding:false,productionDatabaseTouched:false,sourceRequests:0};
  phase='PUT';let r=await call('PUT');await r.body?.cancel();if(!r.ok)throw Error('R2_PILOT_PUT_FAILED');
  phase='GET';r=await call('GET');if(!r.ok){await r.body?.cancel();throw Error('R2_PILOT_GET_FAILED');}
  const chunks=[];let size=0;for await(const chunk of r.body){size+=chunk.length;if(size>4096)throw Error('R2_PILOT_READ_LIMIT');chunks.push(Buffer.from(chunk));}
  if(hash(Buffer.concat(chunks))!==digest)throw Error('R2_PILOT_HASH_MISMATCH');verified=true;
 }catch(error){if(error.code==='R2_CONFIGURATION_INVALID'&&['R2_ENDPOINT','R2_BUCKET','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY'].includes(error.field)&&['MISSING','WHITESPACE_OR_CONTROL','URL_INVALID','HTTPS_REQUIRED','COMPONENTS_REJECTED','HOST_REJECTED','ACCOUNT_ID_INVALID','PATH_OR_FORMAT_REJECTED','FORMAT_INVALID'].includes(error.reason))diagnosis={validationCode:error.field+'_'+error.reason,field:error.field,reason:error.reason};failurePhase=phase;failure=safeCode(error,'R2_PILOT_TRANSPORT_FAILED');}
 finally{if(putAttempted){try{phase='DELETE';const r=await call('DELETE');await r.body?.cancel();if(!r.ok)throw Error();deleted=true;}catch{failurePhase=failurePhase||phase;failure=failure||'R2_PILOT_DELETE_FAILED';}}}
 if(deleted){try{phase='VERIFY_ABSENT';const r=await call('GET');await r.body?.cancel();if(r.status!==404){deleted=false;failure=failure||'R2_PILOT_DELETE_NOT_VERIFIED';}}catch{deleted=false;failure=failure||'R2_PILOT_DELETE_NOT_VERIFIED';}}
 return {status:verified&&deleted&&!failure?'PASS':'FAIL',operationId,bucket:env.R2_BUCKET,objectKey,sha256:digest,bytes:Buffer.byteLength(body),configurationValid,readHashVerified:verified,deletionVerified:deleted,putAttempted,httpAttempts:requests.length,cleanupStatus:!putAttempted?'NOT_REQUIRED':deleted?'VERIFIED_ABSENT':'REQUIRED',cleanupOutstanding:putAttempted&&!deleted,requests,...diagnosis,...(failure?{code:failure,phase:failurePhase||phase}:{}),productionDatabaseTouched:false,sourceRequests:0,privateBucketPolicyVerified:false};
}
module.exports={pilot};
if(require.main===module)pilot(process.env,fetch,{validateOnly:process.argv.includes('--validate-only')}).then(r=>{console.log(JSON.stringify(r));if(r.status!=='PASS')process.exitCode=1;}).catch(e=>{const code=safeCode(e,'R2_PILOT_FAILED');console.error(JSON.stringify({status:'FAIL',code,productionDatabaseTouched:false}));process.exitCode=1;});
