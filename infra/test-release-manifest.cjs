const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');process.chdir(root);
const manifest=JSON.parse(fs.readFileSync('docs/RELEASE_CANDIDATE_FILES.json','utf8'));
const candidate=[...manifest.coreCodeAndTests,...manifest.documentationAndInactiveTemplates];
const operators=manifest.separateOperatorReviewPreserveUnchanged;
assert.equal(new Set(candidate).size,candidate.length,'duplicate manifest entry');
assert.ok(!candidate.some(p=>operators.includes(p)),'operator code mixed into core');
for(const file of candidate){assert.ok(fs.existsSync(file),'missing candidate: '+file);assert.ok(!/(^|\/)(?:\.local|node_modules|\.env(?:\.|$))|\.(?:dump|backup|pem|key|pfx|p12|jks|keystore|zip|apk|aab)$/.test(file),'private candidate path');}
for(const file of candidate.filter(p=>p.endsWith('.xml'))){assert.equal(file,'services/ingest/fixtures/career-synthetic.xml','real XML cannot enter candidate');assert.ok(fs.readFileSync(file,'utf8').includes('SYNTHETIC CONTRACT FIXTURE'));}
const tracked=new Set(cp.execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0'));
const changed=cp.execFileSync('git',['-c','core.safecrlf=false','diff','--name-only','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const untracked=cp.execFileSync('git',['ls-files','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const uncovered=[...changed,...untracked].filter(p=>!candidate.includes(p)&&!operators.includes(p));assert.deepEqual(uncovered,[],'uncategorized changes');
let imports=0;
for(const file of candidate.filter(p=>/\.(?:ts|tsx|cjs)$/.test(p))){const text=fs.readFileSync(file,'utf8');for(const m of text.matchAll(/(?:from\s*|require\(\s*)['"](\.[^'"]+)['"]/g)){const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),m[1]));const alternatives=[target,...['.ts','.tsx','.cjs','.js','.json','/index.ts','/index.tsx'].map(e=>target+e)];let found=alternatives.find(p=>fs.existsSync(p));if(target.includes('/dist/')){const source=target.replace('/dist/','/src/').replace(/\.js$/,'.ts');found=[source,source+'.ts',source+'.tsx'].find(p=>fs.existsSync(p))||found;}if(!found)continue;assert.ok(tracked.has(found)||candidate.includes(found),'untracked import missing from candidate: '+found);imports++;}}
console.log(JSON.stringify({status:'PASS',candidateFiles:candidate.length,separateOperatorFiles:operators.length,relativeImports:imports,uncoveredChanges:0}));
