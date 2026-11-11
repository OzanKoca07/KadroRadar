// Trusted operator provisioning only. No default credentials; never logs password/hash.
const {PrismaClient}=require('@prisma/client');const {passwordHash:makeHash}=require('./dist/password');
const email=process.env.NEW_ADMIN_EMAIL?.trim().toLowerCase(),password=process.env.NEW_ADMIN_PASSWORD,role=process.env.NEW_ADMIN_ROLE;
if(process.argv[2]!=='--create' || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length<16 || password.length>128 || !['SYSTEM_ADMIN','REVIEWER','CONTENT_EDITOR'].includes(role))throw Error('Explicit --create, valid NEW_ADMIN_EMAIL, 16+ character NEW_ADMIN_PASSWORD and NEW_ADMIN_ROLE required');
const db=new PrismaClient();makeHash(password).then(passwordHash=>db.user.create({data:{email,passwordHash,role}})).then(()=>console.log('Admin account created; existing accounts are never elevated.')).catch(()=>{console.error('Admin creation failed');process.exitCode=1;}).finally(()=>db.$disconnect());
