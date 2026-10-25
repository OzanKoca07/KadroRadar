// Run only in a trusted operator environment. Never distribute the signing secret.
const {createHmac} = require('node:crypto');
const [sub, role] = process.argv.slice(2);
const key = process.env.ANNOUNCEMENT_AUTH_SECRET;
if (!sub || !['SYSTEM_ADMIN','CONTENT_EDITOR','REVIEWER'].includes(role) || !key || key.length < 48) throw Error('Subject, role and >=48-character secret required');
const iat = Math.floor(Date.now()/1000);
const payload = Buffer.from(JSON.stringify({sub,role,aud:'announcement-admin',iat,exp:iat+1800})).toString('base64url');
process.stdout.write(payload+'.'+createHmac('sha256',key).update(payload).digest('base64url')+'\n');
