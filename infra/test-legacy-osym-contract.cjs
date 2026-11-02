// Pin the compatibility subject to the released Git object, never the operator
// worktree (which intentionally contains a separately reviewed local tool).
const cp=require('node:child_process'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const release='4e5b86c5de22210eef254b682df6890ba96c4bca',root=path.resolve(__dirname,'..');
function releasedOperator(){
 const source=cp.execFileSync('git',['show',release+':infra/osym-production.cjs'],{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});
 const filename=path.join(root,'infra','pinned-legacy-osym.cjs'),subject=new Module(filename,module);subject.filename=filename;subject.paths=Module._nodeModulePaths(path.dirname(filename));subject._compile(source,filename);return subject.exports;
}
async function verify(db){await assert.rejects(()=>releasedOperator().preflight(db,{database:'unused-for-legacy-manifest-check'}),e=>e.name==='AssertionError'&&e.code==='ERR_ASSERTION'&&e.actual===16&&e.expected===15&&e.operator==='strictEqual');}
module.exports={verify,release};
if(require.main===module)(async()=>{
 const localPath=require.resolve('./osym-production.cjs'),original=require.cache[localPath];let localCalls=0;require.cache[localPath]={id:localPath,filename:localPath,loaded:true,exports:{preflight(){localCalls++;throw Error('UNCOMMITTED_OPERATOR_USED');}}};
 try{let queries=0,readonly=false;const tx={$executeRawUnsafe:async sql=>{assert.equal(sql,'SET TRANSACTION READ ONLY');readonly=true;},$queryRaw:async()=>{assert.ok(readonly);queries++;return [{version:'160000'}];}};const db={$transaction:async work=>work(tx)};
  await verify(db);assert.equal(localCalls,0);assert.equal(queries,2);assert.equal(readonly,true);
  await assert.rejects(()=>verify({$transaction:async()=>{throw Object.assign(Error('SAFE_UNEXPECTED_FAILURE'),{code:'UNEXPECTED'});}}));
  console.log(JSON.stringify({status:'PASS',test:'pinned-legacy-osym-contract',checks:5,uncommittedOperatorUsed:false,productionAccess:false}));
 }finally{if(original)require.cache[localPath]=original;else delete require.cache[localPath];}
})().catch(e=>{console.error(JSON.stringify({status:'FAIL',test:'pinned-legacy-osym-contract',kind:e.name}));process.exitCode=1;});
