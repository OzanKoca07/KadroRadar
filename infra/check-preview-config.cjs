// Local config evaluation only. Never invokes EAS, account APIs, signing or builds.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),mobile=path.join(root,'apps/mobile');
const manifest=require(path.join(mobile,'app.json')).expo,eas=require(path.join(mobile,'eas.json')),pkg=require(path.join(mobile,'package.json'));
const configure=require(path.join(mobile,'app.config.js')),keys=['EAS_BUILD_PROFILE','EXPO_PUBLIC_API_URL','EXPO_PUBLIC_PRIVACY_URL','EXPO_PUBLIC_ACCOUNT_DELETION_URL','EXPO_PUBLIC_SUPPORT_EMAIL'];
const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]])),checks=[];
const check=(label,condition)=>{assert.ok(condition,label);checks.push(label);console.log('PASS '+label);};
try{
 Object.assign(process.env,eas.build.preview.env,{EAS_BUILD_PROFILE:'preview'});delete process.env.EXPO_PUBLIC_SUPPORT_EMAIL;
 const resolved=configure({config:structuredClone(manifest)}),build=resolved.plugins.find(p=>Array.isArray(p)&&p[0]==='expo-build-properties')[1].android;
 check('preview internal APK without account changes',eas.build.preview.distribution==='internal'&&eas.build.preview.android.buildType==='apk');
 check('fixed production HTTPS API in preview',process.env.EXPO_PUBLIC_API_URL==='https://kadroradar.onrender.com/api/v1');
 check('SDK54/package/project identity preserved',pkg.dependencies.expo.startsWith('~54.')&&resolved.android.package==='com.kadroradar.app'&&resolved.extra.eas.projectId==='44bbc3b8-3306-4b9a-91c6-74a2eb2e0877');
 check('version 1.0.1/code3 and HTTPS-only Android',resolved.version==='1.0.1'&&resolved.android.versionCode===3&&build.usesCleartextTraffic===false&&build.targetSdkVersion===36&&build.compileSdkVersion===36);
 check('microphone/camera/storage/advertising permissions blocked', ['android.permission.RECORD_AUDIO','android.permission.CAMERA','android.permission.READ_EXTERNAL_STORAGE','android.permission.WRITE_EXTERNAL_STORAGE','com.google.android.gms.permission.AD_ID','android.permission.SYSTEM_ALERT_WINDOW'].every(p=>resolved.android.blockedPermissions.includes(p)));
 for(const file of ['icon.png','adaptive-foreground.png','splash.png']){const data=fs.readFileSync(path.join(mobile,'assets',file));assert.equal(data.subarray(1,4).toString(),'PNG');assert.equal(data.readUInt32BE(16),1024);assert.equal(data.readUInt32BE(20),1024);if(file==='icon.png')assert.equal(data[25],2);}
 check('original PNG assets valid 1024px, opaque app icon',resolved.icon==='./assets/icon.png');
 check('SDK-aligned splash plugin configured',resolved.plugins.some(p=>Array.isArray(p)&&p[0]==='expo-splash-screen')&&pkg.dependencies['expo-splash-screen']==='~31.0.13');
 for(const url of ['http://localhost:3000/api/v1','http://kadroradar.onrender.com/api/v1','https://fixture:placeholder@api.example.test/api/v1','https://127.0.0.1/api/v1','https://[::1]/api/v1','https://kadroradar.onrender.com:8443/api/v1','https://kadroradar.onrender.com/wrong','https://kadroradar.onrender.com/api/v1?token=not-a-real-secret']){process.env.EXPO_PUBLIC_API_URL=url;assert.throws(()=>configure({config:structuredClone(manifest)}));}
 check('preview rejects HTTP/loopback/credential/query endpoints',true);
 Object.assign(process.env,eas.build.preview.env,{EAS_BUILD_PROFILE:'production'});assert.throws(()=>configure({config:structuredClone(manifest)}),/SUPPORT_EMAIL/);check('production missing support identity still fails closed',true);
 const ignore=require('ignore')().add(fs.readFileSync(path.join(root,'.easignore'),'utf8'));
 for(const file of ['.local/local-api-backups/example.dump','.local/osym-production/backups/example.dump','kadroradar.zip','apps/mobile/.env','apps/mobile/credentials.json','apps/mobile/google-services.json','example.keystore'])assert.equal(ignore.ignores(file),true);
 for(const file of ['apps/mobile/app/index.tsx','apps/mobile/assets/icon.png','apps/mobile/eas.json','apps/mobile/package.json','pnpm-lock.yaml','packages/official-sources.json'])assert.equal(ignore.ignores(file),false);
 check('EAS archive excludes backup/env/signing files while keeping app and shared registry',true);
 if(process.argv.includes('--introspection')){
  const result=JSON.parse(fs.readFileSync(path.join(root,'.local/preview-readiness/preview-introspect.json'),'utf8').replace(/^\uFEFF/,'')),mods=result._internal.modResults.android;
  assert.equal(mods.manifest.manifest.application[0].$['android:usesCleartextTraffic'],'false');assert.ok(mods.gradleProperties.some(p=>p.key==='android.targetSdkVersion'&&p.value==='36'));
  check('native manifest/Gradle introspection enforces HTTPS and target36',true);
  for(const permission of resolved.android.blockedPermissions)assert.ok(mods.manifest.manifest['uses-permission'].some(p=>p.$['android:name']===permission&&p.$['tools:node']==='remove'));
  check('native manifest explicitly removes all blocked permissions',true);
 }
 const report={status:'PASS',checks,productionApi:eas.build.preview.env.EXPO_PUBLIC_API_URL,version:resolved.version,versionCode:resolved.android.versionCode,easBuildStarted:false,easAccountChanges:0,playUpload:false};
 const folder=path.join(root,'.local/preview-readiness');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'preview-config.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{for(const key of keys){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}}
