export function validateEnvironment(env:NodeJS.ProcessEnv){
 if(env.NODE_ENV!=='production')return;
 let database:URL;try{database=new URL(env.DATABASE_URL||'');}catch{throw Error('DATABASE_URL required');}
 if(!['postgres:','postgresql:'].includes(database.protocol)||!database.hostname||!database.pathname.slice(1))throw Error('PostgreSQL DATABASE_URL required');
 const origins=(env.CORS_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
 if(!origins.length)throw Error('CORS_ORIGINS required');
 for(const origin of origins){let value:URL;try{value=new URL(origin);}catch{throw Error('Invalid CORS origin');}if(value.protocol!=='https:'||value.origin!==origin||value.username||value.password||value.hostname==='localhost'||value.hostname==='127.0.0.1')throw Error('Exact public HTTPS CORS origins required');}
 for(const key of ['NOTIFICATIONS_ENABLED','SOURCE_SYNC_ENABLED','ALLOW_SELF_REGISTRATION','DOCUMENT_UPLOADS_ENABLED'])if(env[key]!==undefined&&!['true','false'].includes(env[key]!))throw Error(key+' must be true or false');
 if(env.TRUST_PROXY_HOPS!==undefined&&!['0','1'].includes(env.TRUST_PROXY_HOPS))throw Error('TRUST_PROXY_HOPS must be 0 or 1');
 if(env.ADMIN_REVIEW_TOKEN)throw Error('Remove development ADMIN_REVIEW_TOKEN from production');
}
