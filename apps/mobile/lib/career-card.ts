export const careerCategoryLabels:Record<string,string>={PERSONNEL:'Kamu personeli alımı',EXAM_PLACEMENT:'Sınav / merkezi yerleştirme',INTERNAL:'Kurum içi yükselme',EDUCATION:'Eğitim ilanı',OTHER:'Diğer duyuru'};
export function careerCardFacts(item:any){
 const e=item?.sourceEvidence;
 if(e?.sourceId!=='career'||e?.categoryCode!=='PERSONNEL')return null;
 const title=Array.from(String(item.title||''));
 return {title:title.length>100?title.slice(0,100).join('')+'...':title.join(''),fullTitle:String(item.title||''),category:careerCategoryLabels[e.categoryCode],organization:String(item.organization||''),announcedAt:item.announcedAt??null,deadline:item.sourceCheckedAt?item.applicationEndAt:null};
}
