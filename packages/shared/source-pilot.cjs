// Explicit, signed pilot budgets. No implicit source or execution mode.
function settings(env){
 const mode=env.SOURCE_INGEST_MODE;
 if(!['automatic','staging-only'].includes(mode))throw Error('SOURCE_MODE_DISABLED');
 if(mode==='automatic')return {mode};
 const number=(value,max)=>{if(typeof value!=='string'||!/^\d+$/.test(value)||+value<1||+value>max)throw Error('PILOT_LIMIT_INVALID');return +value;};
 if(!['career','gazette'].includes(env.SOURCE_ID))throw Error('PILOT_SOURCE_INVALID');
 if(!/^[a-f0-9]{40}$/.test(env.SOURCE_RELEASE_SHA||env.RENDER_GIT_COMMIT||''))throw Error('PILOT_RELEASE_REQUIRED');
 if(env.R2_SOURCE_RECEIPTS_ENABLED!== 'false')throw Error('PILOT_R2_MUST_BE_DISABLED');
 return {mode,sourceId:env.SOURCE_ID,limits:{maxRecords:number(env.SOURCE_PILOT_MAX_RECORDS,25),maxDocuments:number(env.SOURCE_PILOT_MAX_DOCUMENTS,2)}};
}
module.exports={settings};
