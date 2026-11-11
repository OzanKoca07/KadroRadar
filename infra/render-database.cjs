// Explicit operator action only. No .env fallback and no startup migrations.
const path=require('node:path'),{spawnSync}=require('node:child_process');
function validateTarget(env,host,database){
 let target;try{target=new URL(env.DATABASE_URL||'');}catch{throw Error('Explicit DATABASE_URL required; no .env fallback');}
 if(!['postgres:','postgresql:'].includes(target.protocol)||!target.username||!target.password||target.hash||!host||!database||target.hostname!==host||decodeURIComponent(target.pathname.slice(1))!==database)throw Error('Database target does not match explicit host/database');
 return host+'/'+database;
}
function redact(output,env){
 const parsed=new URL(env.DATABASE_URL);
 for(const secret of [env.DATABASE_URL,parsed.password,decodeURIComponent(parsed.password),env.NEW_ADMIN_PASSWORD].filter(Boolean))output=output.split(secret).join('[REDACTED]');
 return output;
}
function main(args=process.argv.slice(2),env=process.env){
 const [action,host,database,approval]=args;
 if(!['status','migrate','create-admin'].includes(action)||args.length>4)throw Error('Usage: node infra/render-database.cjs status|migrate|create-admin HOST DATABASE [APPROVE]');
 const target=validateTarget(env,host,database);
 if(action!=='status'&&approval!=='APPROVE')throw Error('Write requires separate user approval and literal APPROVE argument');
 const root=path.resolve(__dirname,'..');
 const command=action==='create-admin'?[path.join(root,'apps/api/create-admin.cjs'),'--create']:[path.join(root,'node_modules/prisma/build/index.js'),'migrate',action==='status'?'status':'deploy','--schema',path.join(root,'apps/api/prisma/schema.prisma')];
 console.log(JSON.stringify({action,target,write:action!=='status'}));
 const result=spawnSync(process.execPath,command,{cwd:root,env:{...env},encoding:'utf8',windowsHide:true,timeout:300000,maxBuffer:4*1024*1024});
 process.stdout.write(redact((result.stdout||'')+(result.stderr||''),env));
 if(result.error)throw Error('Operator command could not complete; inspect target/status before retrying');
 return result.status??1;
}
module.exports={validateTarget,main,redact};
if(require.main===module){try{process.exitCode=main();}catch(error){console.error(error.message);process.exitCode=1;}}
