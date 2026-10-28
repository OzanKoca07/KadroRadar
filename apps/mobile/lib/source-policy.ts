// Public mobile policy: blocked provenance excludes the whole record, not only its link.
export function restrictedSource(value: unknown): boolean {
 const seen=new WeakSet<object>();
 function inspect(item:unknown):boolean {
  if(typeof item==='string'){
   try{const host=new URL(item).hostname.replace(/\.$/,'');if(host==='ilan.gov.tr'||host.endsWith('.ilan.gov.tr'))return true;}catch{/* Text provenance may not be a URL. */}
   return /(?:^|[^a-z0-9-])(?:[a-z0-9-]+\.)*ilan\.gov\.tr(?:[^a-z0-9.-]|$)/i.test(item);
  }
  if(!item||typeof item!=='object'||seen.has(item))return false;
  seen.add(item);
  return Object.entries(item).some(([key,v])=>((['sourceId','sourceKey','provider','source'].includes(key)&&typeof v==='string'&&['ilan','bik','ilan.gov.tr'].includes(v.toLowerCase()))||inspect(v)));
 }
 return inspect(value);
}
export function publicItems<T>(items:T[]):T[]{return items.filter(item=>!restrictedSource(item));}
