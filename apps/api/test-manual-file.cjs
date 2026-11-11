const assert=require('node:assert/strict'),ts=require('typescript'),fs=require('node:fs'),vm=require('node:vm');
const output=ts.transpileModule(fs.readFileSync(require('node:path').resolve(__dirname,'../admin/src/manual-file.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const context={exports:{}};vm.runInNewContext(output,context);const read=context.exports.readImportFile;
assert.equal(read('başlık;kurum;kaynak;kontenjan\n"Alım; duyurusu";Kurum;https://enerji.gov.tr/a;2','a.csv')[0].quota,2);
assert.equal(read('title,organization,sourceUrl\n"A ""quoted""\nline",Kurum,https://enerji.gov.tr/a','a.csv')[0].title,'A "quoted"\nline');
assert.throws(()=>read('title,title\na,b','a.csv'));assert.throws(()=>read('title,quota\na,not-number','a.csv'));assert.throws(()=>read('title\n"broken','a.csv'));assert.throws(()=>read('{}','a.json'));assert.throws(()=>read(' '.repeat(1048577),'a.csv'));
console.log('PASS: 7 CSV/JSON Turkish headers, quoted multiline, validation and size cases');
