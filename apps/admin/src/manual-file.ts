// Bounded RFC4180-style CSV reader; cells remain text except the explicitly numeric quota.
export function readImportFile(text:string,name:string):any[]{
 if(text.length>1024*1024)throw Error('Dosya en fazla1MiB olmalı');
 text=text.replace(/^\uFEFF/,'');
 if(name.toLowerCase().endsWith('.json')){const rows=JSON.parse(text);if(!Array.isArray(rows)||rows.length>100)throw Error('En fazla100 ilan içeren JSON dizi gerekli');return rows;}
 const first=text.split(/\r?\n/)[0],separator=first.includes(';')?';':first.includes('\t')?'\t':',';
 const rows:string[][]=[];let row:string[]=[],value='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===separator&&!quoted){row.push(value);value='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(v=>v.trim()))rows.push(row);row=[];value='';}else value+=c;}
 if(quoted)throw Error('CSV tırnakları kapanmamış');row.push(value);if(row.some(v=>v.trim()))rows.push(row);
 if(rows.length<2||rows.length>101)throw Error('CSV1–100 veri satırı içermeli');
 const aliases:Record<string,string>={'başlık':'title','kurum':'organization','kaynak':'sourceUrl','şehir':'city','kadro':'positionTitle','kontenjan':'quota','başlangıç':'applicationStartAt','bitiş':'applicationEndAt','başvuru':'applicationUrl'};
 const headers=rows.shift()!.map(h=>aliases[h.trim().toLocaleLowerCase('tr-TR')]||h.trim());
 if(new Set(headers).size!==headers.length||headers.some(h=>['__proto__','constructor','prototype'].includes(h)))throw Error('Geçersiz CSV başlıkları');
 return rows.map(cells=>{if(cells.length!==headers.length)throw Error('CSV sütun sayısı tutarsız');const result:any=Object.fromEntries(headers.map((h,i)=>[h,cells[i].trim()]));if(result.quota){if(!/^\d+$/.test(result.quota))throw Error('Kontenjan tam sayı olmalı');result.quota=Number(result.quota);}else delete result.quota;return result;});
}
