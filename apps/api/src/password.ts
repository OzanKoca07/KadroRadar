import {randomBytes,scrypt,timingSafeEqual} from 'node:crypto';
import {HttpException} from '@nestjs/common';
let active=0;const queue:Array<()=>void>=[];
async function acquire(){if(active<2){active++;return;}if(queue.length>=8)throw new HttpException('Authentication capacity reached; retry later',429);await new Promise<void>(resolve=>queue.push(resolve));}
function release(){const next=queue.shift();if(next)next();else active--;}
async function derive(password:string,salt:string,modern:boolean){await acquire();try{return await new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,modern?{N:131072,r:8,p:1,maxmem:256*1024*1024}:{N:16384,r:8,p:1,maxmem:32*1024*1024},(error,key)=>error?reject(error):resolve(key)));}finally{release();}}
export async function passwordHash(password:string){const salt=randomBytes(16).toString('hex');return `scrypt-v2:${salt}:${(await derive(password,salt,true)).toString('hex')}`;}
export async function passwordMatches(password:string,stored?:string){const parts=stored?.split(':');const valid=!!parts && ['scrypt','scrypt-v2'].includes(parts[0]) && /^[a-f0-9]{32}$/.test(parts[1]) && /^[a-f0-9]{128}$/.test(parts[2]);const actual=await derive(password,valid?parts![1]:'dummy-verification-salt',valid?parts![0]==='scrypt-v2':true);const expected=Buffer.from(valid?parts![2]:'00'.repeat(64),'hex');return valid && timingSafeEqual(actual,expected);}
