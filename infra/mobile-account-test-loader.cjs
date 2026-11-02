// Native SecureStore boundary is mocked only in Node tests. No plaintext
// storage adapter or test switch is shipped by the application.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),Module=require('node:module');
const filename=path.resolve(__dirname,'../apps/mobile/lib/account.ts');
function loadAccount(storage=new Map(),controls={}){
 const loaded=new Module(filename,module);
 loaded.require=name=>name==='expo-secure-store'?{
  WHEN_UNLOCKED_THIS_DEVICE_ONLY:6,
  isAvailableAsync:async()=>controls.available!==false,
  getItemAsync:async key=>{if(controls.read)await controls.read();if(controls.failRead)throw Error('PRIVATE_NATIVE_ERROR');return storage.get(key)||null;},
  setItemAsync:async(key,value,options)=>{if(controls.write)await controls.write();if(controls.failWrite)throw Error('PRIVATE_NATIVE_ERROR');controls.lastOptions=options;storage.set(key,value);},
  deleteItemAsync:async key=>{if(controls.failDelete)throw Error('PRIVATE_NATIVE_ERROR');storage.delete(key);}
 }:Module.prototype.require.call(loaded,name);
 loaded._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
 return {api:loaded.exports,storage,controls};
}
module.exports={loadAccount};
