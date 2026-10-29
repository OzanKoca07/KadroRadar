require('../infra/register-mobile-typescript.cjs');
const assert=require('node:assert/strict');
const {validateAuth,loginDestination}=require('../apps/mobile/lib/auth-form.ts'),{reviewedNews,loadNews}=require('../apps/mobile/lib/news.ts');
assert.deepEqual(validateAuth('',''),Object.fromEntries([['email','E-posta adresini gir.'],['password','Şifreni gir.']]));assert.ok(validateAuth('bad','x').email);assert.ok(validateAuth('a@example.test','short',true).password);assert.deepEqual(validateAuth('a@example.test','x',false),{});assert.equal(loginDestination('https://evil.test'),null);assert.equal(loginDestination('/saved'),'/saved');
const item={id:'test-only',title:'Synthetic test announcement',organization:'Test institution',date:'2026-10-01T00:00:00Z',sourceUrl:'https://enerji.gov.tr/test-only',summary:'1 kontenjan',reviewMode:'MANUAL_REVIEWED'};
assert.deepEqual(reviewedNews({items:[]}),[]);assert.equal(reviewedNews({items:[item]}).length,1);
for(const changes of [{sourceUrl:'https://ilan.gov.tr/a'},{sourceUrl:'https://unverified.invalid/a'},{sourceUrl:'http://enerji.gov.tr/a'},{reviewMode:'AUTOMATIC'},{date:'unknown'},{summary:'x'.repeat(181)}])assert.equal(reviewedNews({items:[{...item,...changes}]}).length,0);
(async()=>{const original=global.fetch;process.env.EXPO_PUBLIC_API_URL='https://api.example.test/api/v1';try{global.fetch=async()=>({ok:false});assert.deepEqual(await loadNews(new AbortController().signal),[]);global.fetch=async()=>{throw Error('offline')};await assert.rejects(loadNews(new AbortController().signal));console.log('PASS auth validation/return route and news empty/reviewed/restricted/unavailable policy');}finally{global.fetch=original;}})();

// Check real palette contrast rather than a screenshot color approximation.
const fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),path=require('node:path');
const file=path.resolve(__dirname,'../apps/mobile/ui/theme.ts'),themeModule=new Module(file,module);themeModule.require=name=>name==='react-native'?{StyleSheet:{create:v=>v}}:require(name);themeModule._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,file);const colors=themeModule.exports.colors;
function luminance(hex){return hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);}
for(const [fg,bg] of [[colors.primary,colors.surface],[colors.muted,colors.canvas],[colors.error,colors.surface],[colors.info,colors.infoSoft]]){const a=luminance(fg),b=luminance(bg);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5);}
console.log('PASS real theme normal-text contrast >=4.5:1');
