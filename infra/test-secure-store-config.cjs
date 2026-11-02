const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),mobile=path.join(root,'apps/mobile');
try{
 const config=JSON.parse(fs.readFileSync(path.join(mobile,'app.json'))).expo,dependency=JSON.parse(fs.readFileSync(path.join(mobile,'package.json'))).dependencies['expo-secure-store'];
 assert.equal(dependency,require(path.join(root,'node_modules/expo/bundledNativeModules.json'))['expo-secure-store']);
 const plugin=config.plugins.find(p=>Array.isArray(p)&&p[0]==='expo-secure-store');assert.equal(plugin[1].configureAndroidBackup,true);assert.equal(plugin[1].faceIDPermission,false);
 const secureRoot=path.dirname(require.resolve('expo-secure-store/package.json',{paths:[mobile]}));
 for(const name of ['secure_store_backup_rules.xml','secure_store_data_extraction_rules.xml']){const xml=fs.readFileSync(path.join(secureRoot,'android/src/main/res/xml',name),'utf8');assert.match(xml,/<exclude domain="sharedpref" path="SecureStore"\s*\/>/);}
 const output=cp.execFileSync(process.execPath,[path.join(root,'node_modules/expo/bin/cli'),'config','--type','introspect','--json'],{cwd:mobile,env:{...process.env,EAS_BUILD_PROFILE:'preview',EXPO_PUBLIC_API_URL:'https://kadroradar.onrender.com/api/v1'},windowsHide:true,timeout:60000,stdio:'pipe',maxBuffer:8*1024*1024});
 const native=JSON.parse(output.toString()),manifest=native._internal.modResults.android.manifest.manifest,application=manifest.application[0].$;
 assert.equal(application['android:fullBackupContent'],'@xml/secure_store_backup_rules');assert.equal(application['android:dataExtractionRules'],'@xml/secure_store_data_extraction_rules');
 assert.equal(native.android.package,'com.kadroradar.app');assert.equal(native.android.versionCode,3);assert.equal(native.version,'1.0.1');
 assert.equal(native._internal.modResults.ios.infoPlist.NSFaceIDUsageDescription,undefined);
 console.log(JSON.stringify({status:'PASS',test:'secure-store-native-config',sdkAligned:true,backupExclusion:true,biometricsRequested:false,nativeBuildPerformed:false}));
}catch(e){console.error(JSON.stringify({status:'FAIL',test:'secure-store-native-config',kind:e.name}));process.exitCode=1;}
