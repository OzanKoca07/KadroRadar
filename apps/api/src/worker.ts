import 'reflect-metadata';
import {NestFactory} from '@nestjs/core';
import {AppModule} from './module';
import {validateEnvironment} from './environment';
import {SourceOperations} from './source-operations';
import {scanMode} from './announcement-scan';

async function bootstrap(){
 validateEnvironment(process.env);
 const role=process.env.PROCESS_ROLE;
 if(!['source-worker','push-worker'].includes(role||''))throw Error('Explicit worker PROCESS_ROLE required');
 if(process.env[role==='source-worker'?'SOURCE_SYNC_ENABLED':'NOTIFICATIONS_ENABLED']!=='true')throw Error('Explicit worker enable flag required');
 if(process.env.SOURCE_WORKER_ONCE==='true'&&role!=='source-worker')throw Error('One-shot requires source-worker');
 const app=await NestFactory.createApplicationContext(AppModule);
 app.enableShutdownHooks();
 console.log(JSON.stringify({event:'worker_started',processRole:role,httpListener:false}));
 if(process.env.SOURCE_WORKER_ONCE==='true'){
  try{if(role!=='source-worker')throw Error('One-shot requires source-worker');const results=await app.get(SourceOperations).tick(scanMode());console.log(JSON.stringify({event:'source_worker_completed',results,sourceRuns:results.length}));if(results.some(result=>result.status==='ERROR'))process.exitCode=1;}
  finally{await app.close();}
 }
 // Provider intervals keep this process alive. No HTTP listener or startup migration.
}
bootstrap().catch(()=>{console.error(JSON.stringify({event:'worker_start_failed'}));process.exitCode=1;});
