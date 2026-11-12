import {recoveryConfiguration} from './account-mail';
import {scanIntervalHours,scanMode} from './announcement-scan';
export function validateEnvironment(env:NodeJS.ProcessEnv){
 if(env.SOURCE_INGEST_MODE==='staging-only'&&env.SOURCE_SYNC_ENABLED==='true')throw Error('Pilot cannot enable scheduler');
 if(env.SOURCE_INGEST_MODE!==undefined&&!['disabled','staging-only','automatic'].includes(env.SOURCE_INGEST_MODE))throw Error('Invalid source execution mode');
 if(env.SOURCE_AUTOMATION_APPROVED!==undefined&&!['true','false'].includes(env.SOURCE_AUTOMATION_APPROVED))throw Error('Invalid automation approval');
 if(env.SOURCE_REMOTE_INGEST_ENABLED!==undefined&&!['true','false'].includes(env.SOURCE_REMOTE_INGEST_ENABLED))throw Error('Invalid remote source flag');
 if(env.SOURCE_REMOTE_INGEST_ENABLED==='true')require(require('node:path').resolve(__dirname,'../../../packages/shared/source-ingest.cjs')).config(env.SOURCE_INGEST_ORIGIN,env.SOURCE_INGEST_HMAC_KEY);
 scanIntervalHours(env.ANNOUNCEMENT_SCAN_INTERVAL_HOURS);scanMode(env.ANNOUNCEMENT_SCAN_MODE);
 if(env.PROCESS_ROLE!==undefined&&!['api','source-worker','push-worker','combined'].includes(env.PROCESS_ROLE))throw Error('Invalid PROCESS_ROLE');
 if(env.ACCOUNT_RECOVERY_ENABLED!==undefined&&!['true','false'].includes(env.ACCOUNT_RECOVERY_ENABLED))throw Error('Invalid account recovery flag');
 if(env.ACCOUNT_RECOVERY_ENABLED==='true'&&!recoveryConfiguration(env))throw Error('Account recovery configuration incomplete');
 if(env.NODE_ENV!=='production')return;
 let database:URL;try{database=new URL(env.DATABASE_URL||'');}catch{throw Error('DATABASE_URL required');}
 if(!['postgres:','postgresql:'].includes(database.protocol)||!database.hostname||!database.pathname.slice(1))throw Error('PostgreSQL DATABASE_URL required');
 const origins=(env.CORS_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
 if(!origins.length)throw Error('CORS_ORIGINS required');
 if(env.ACCOUNT_RECOVERY_ENABLED==='true'&&!origins.includes(env.ACCOUNT_RECOVERY_ORIGIN!))throw Error('Recovery origin must be an allowed API origin');
 for(const origin of origins){let value:URL;try{value=new URL(origin);}catch{throw Error('Invalid CORS origin');}if(value.protocol!=='https:'||value.origin!==origin||value.username||value.password||value.hostname==='localhost'||value.hostname==='127.0.0.1')throw Error('Exact public HTTPS CORS origins required');}
 for(const key of ['NOTIFICATIONS_ENABLED','SOURCE_SYNC_ENABLED','SOURCE_WORKER_ONCE','ALLOW_SELF_REGISTRATION','DOCUMENT_UPLOADS_ENABLED'])if(env[key]!==undefined&&!['true','false'].includes(env[key]!))throw Error(key+' must be true or false');
 if(env.TRUST_PROXY_HOPS!==undefined&&!['0','1'].includes(env.TRUST_PROXY_HOPS))throw Error('TRUST_PROXY_HOPS must be 0 or 1');
 if(env.ADMIN_REVIEW_TOKEN)throw Error('Remove development ADMIN_REVIEW_TOKEN from production');
}
