require('../../infra/register-mobile-typescript.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),Module=require('node:module');
const filename=path.resolve(__dirname,'../mobile/lib/announcement-api.ts'),loaded={exports:require(filename)};
const {announcementRequest}=loaded.exports;
(async()=>{const saved=global.fetch,base=process.env.EXPO_PUBLIC_API_URL,timer=global.setTimeout;try{
 delete process.env.EXPO_PUBLIC_API_URL;await assert.rejects(announcementRequest('/announcements'),/yapılandırılmamış/);process.env.EXPO_PUBLIC_API_URL='https://kadroradar.onrender.com/api/v1';
 global.fetch=async()=>{throw Error('offline')};await assert.rejects(announcementRequest('/announcements'),/offline/);
 global.fetch=async()=>({ok:false,status:503});await assert.rejects(announcementRequest('/announcements'),/503/);
 global.setTimeout=callback=>timer(callback,1);global.fetch=async(url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Object.assign(Error(),{name:'AbortError'}))));await assert.rejects(announcementRequest('/announcements'),/zaman aşımına/);global.setTimeout=timer;
 global.fetch=async()=>({ok:true,json:async()=>({items:[],pages:0,page:1,total:0})});assert.equal((await announcementRequest('/announcements')).total,0);
 global.fetch=async()=>({ok:true,json:async()=>({items:[{id:'test',title:'TEST',organization:'TEST'}],pages:2,page:2,total:21})});assert.equal((await announcementRequest('/announcements?page=2')).page,2);
 global.fetch=async()=>({ok:true,json:async()=>({items:[{}],pages:1,page:1,total:1})});await assert.rejects(announcementRequest('/announcements'),/Geçersiz/);
 console.log('PASS: announcements missing config, offline, HTTP503, timeout, retry, empty, pagination and malformed contract; fetch mocked, no device test');
}finally{global.fetch=saved;global.setTimeout=timer;if(base===undefined)delete process.env.EXPO_PUBLIC_API_URL;else process.env.EXPO_PUBLIC_API_URL=base;}})().catch(e=>{console.error(e);process.exitCode=1;});
