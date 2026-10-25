import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './module';
import {validateEnvironment} from './environment';
import {NestExpressApplication} from '@nestjs/platform-express';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
async function bootstrap(){
  validateEnvironment(process.env);
  const app=await NestFactory.create<NestExpressApplication>(AppModule, {bodyParser: true});
  if(process.env.TRUST_PROXY_HOPS==='1') app.getHttpAdapter().getInstance().set('trust proxy',1);
  const origins=(process.env.CORS_ORIGINS || '').split(',').map(x=>x.trim()).filter(Boolean);
  if(process.env.NODE_ENV === 'production' && !origins.length) throw new Error('CORS_ORIGINS required');
  app.enableCors({origin: origins.length ? origins : ['http://localhost:5173'], credentials: true});
  const buckets = new Map<string, {count:number; reset:number}>();
  const cleanup=setInterval(()=>{const now=Date.now(); for(const [key,bucket] of buckets) if(bucket.reset<=now) buckets.delete(key);},60000);
  cleanup.unref();
  app.use((req:any,res:any,next:()=>void)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Cache-Control','no-store');
    const key=req.ip || req.socket.remoteAddress || 'unknown';
    const now=Date.now(); let bucket=buckets.get(key);
    if(!bucket || bucket.reset<=now) {bucket={count:0,reset:now+60000};buckets.set(key,bucket);}
    if(++bucket.count>120) {res.setHeader('Retry-After',Math.ceil((bucket.reset-now)/1000));res.status(429).json({message:'Too many requests'});return;}
    next();
  });
  app.enableShutdownHooks();
  // Docker includes the admin and legal pages on the API origin so secure
  // SameSite=Strict session cookies also work without a custom domain.
  const publicRoot=join(__dirname,'../../../public');
  if(existsSync(publicRoot)) {
    app.useStaticAssets(join(publicRoot,'admin'),{prefix:'/admin/'});
    app.useStaticAssets(join(publicRoot,'legal'));
    app.useStaticAssets(join(publicRoot,'legal'),{prefix:'/legal/'});
    const server=app.getHttpAdapter().getInstance();
    server.get('/admin',(_req:any,res:any)=>res.redirect('/admin/'));
    for(const page of ['privacy','delete-account']) server.get('/'+page,(_req:any,res:any)=>res.sendFile(join(publicRoot,'legal',page+'.html')));
  }
  const port=Number(process.env.PORT||process.env.API_PORT||3000);
  if(!Number.isInteger(port)||port<1||port>65535) throw new Error('Invalid HTTP port');
  app.setGlobalPrefix('api/v1');await app.listen(port,'0.0.0.0');
}
bootstrap();
