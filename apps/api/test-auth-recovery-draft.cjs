// Verifies only the SQL security draft, not live email delivery or API routes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomBytes,createHash}=require('node:crypto');
let target;try{target=new URL(process.env.DATABASE_URL||'postgresql://invalid/invalid');}catch{throw Error('Isolated DB required');}
if(!['postgresql:','postgres:'].includes(target.protocol)||!['localhost','127.0.0.1','db','[::1]'].includes(target.hostname)||!/^\/kadroradar_ingestion_test_/.test(target.pathname))throw Error('Isolated DB required');
const {PrismaClient}=require('@prisma/client'),db=new PrismaClient(),hash=s=>createHash('sha256').update(s).digest('hex');
(async()=>{let user,checks=0;try{
 const draft=fs.readFileSync(path.resolve(__dirname,'../../infra/account-recovery.sql.example'),'utf8');
 for(const statement of draft.split(/;\s*(?:\r?\n|$)/).filter(s=>s.trim()))await db.$executeRawUnsafe(statement); // Static reviewed draft, guarded test DB only.
 user=await db.user.create({data:{email:'challenge-'+randomBytes(8).toString('hex')+'@example.test',passwordHash:'UNUSABLE_TEST_PASSWORD',role:'USER'}});
 const raw=randomBytes(32).toString('hex'),tokenHash=hash(raw),emailHash=hash(user.email),id=randomBytes(16).toString('hex');
 await db.$executeRaw`INSERT INTO "AccountChallengeDraft" ("id","userId","purpose","tokenHash","emailHash","expiresAt") VALUES (${id},${user.id},'RESET_PASSWORD',${tokenHash},${emailHash},CURRENT_TIMESTAMP+INTERVAL '15 minutes')`;
 const stored=await db.$queryRaw`SELECT * FROM "AccountChallengeDraft" WHERE "id"=${id}`;assert.equal(stored[0].tokenHash,tokenHash);assert.ok(!JSON.stringify(stored).includes(raw));checks++;
 const consume=purpose=>db.$executeRaw`UPDATE "AccountChallengeDraft" AS c SET "consumedAt"=CURRENT_TIMESTAMP WHERE c."tokenHash"=${tokenHash} AND c."purpose"=${purpose} AND c."emailHash"=${emailHash} AND c."consumedAt" IS NULL AND c."expiresAt">CURRENT_TIMESTAMP AND EXISTS(SELECT 1 FROM "User" AS u WHERE u.id=c."userId" AND u."deletedAt" IS NULL)`;
 assert.equal(await consume('VERIFY_EMAIL'),0);checks++;
 const race=await Promise.all([consume('RESET_PASSWORD'),consume('RESET_PASSWORD')]);assert.equal(race.reduce((a,b)=>a+b,0),1);checks++;assert.equal(await consume('RESET_PASSWORD'),0);checks++;
 const insert=(purpose,minutes)=>db.$executeRaw`INSERT INTO "AccountChallengeDraft" ("id","userId","purpose","tokenHash","emailHash","expiresAt") VALUES (${randomBytes(16).toString('hex')},${user.id},${purpose},${hash(randomBytes(32).toString('hex'))},${emailHash},CURRENT_TIMESTAMP+(${minutes}*INTERVAL '1 minute'))`;
 await assert.rejects(insert('RESET_PASSWORD',16));checks++;await assert.rejects(insert('VERIFY_EMAIL',1441));checks++;
 await insert('RESET_PASSWORD',1);await assert.rejects(insert('RESET_PASSWORD',1));checks++;
 await db.$executeRaw`UPDATE "AccountChallengeDraft" SET "createdAt"=CURRENT_TIMESTAMP-INTERVAL '2 minutes',"expiresAt"=CURRENT_TIMESTAMP-INTERVAL '1 minute' WHERE "consumedAt" IS NULL`;
 const expired=await db.$executeRaw`UPDATE "AccountChallengeDraft" SET "consumedAt"=CURRENT_TIMESTAMP WHERE "purpose"='RESET_PASSWORD' AND "consumedAt" IS NULL AND "expiresAt">CURRENT_TIMESTAMP`;assert.equal(expired,0);checks++;
 await db.$executeRaw`UPDATE "AccountChallengeDraft" SET "consumedAt"=CURRENT_TIMESTAMP WHERE "consumedAt" IS NULL`;
 await insert('VERIFY_EMAIL',10);await db.user.update({where:{id:user.id},data:{deletedAt:new Date()}});
 const deleted=await db.$executeRaw`UPDATE "AccountChallengeDraft" AS c SET "consumedAt"=CURRENT_TIMESTAMP WHERE c."purpose"='VERIFY_EMAIL' AND c."consumedAt" IS NULL AND c."expiresAt">CURRENT_TIMESTAMP AND EXISTS(SELECT 1 FROM "User" AS u WHERE u.id=c."userId" AND u."deletedAt" IS NULL)`;assert.equal(deleted,0);checks++;
 console.log(JSON.stringify({status:'PASS',test:'auth-recovery-draft',checks,emailDeliveryTested:false,productionMigration:false}));
}finally{await db.$executeRawUnsafe('DROP TABLE IF EXISTS "AccountChallengeDraft"');await db.$executeRawUnsafe('DROP TABLE IF EXISTS "AccountEmailVerificationDraft"');if(user)await db.user.delete({where:{id:user.id}});await db.$disconnect();}})().catch(e=>{console.error(JSON.stringify({status:'FAIL',test:'auth-recovery-draft',kind:e.name}));process.exitCode=1;});
