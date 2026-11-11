// Conservative review suggestions only. Never merges or publishes records.
export function sameOfficialNotice(a:any,b:any):string|null{
 const institution=(value:any)=>typeof value==='string'?value.normalize('NFKC').trim().toLocaleLowerCase('tr-TR'):'';
 if(!institution(a.parsed?.organization)||institution(a.parsed.organization)!==institution(b.parsed?.organization))return null;
 const x=a.raw?.sourceEvidence,y=b.raw?.sourceEvidence;if(!x||!y)return null;
 if(x.advertisementId&&x.advertisementId===y.advertisementId&&x.gazetteDate&&x.gazetteDate===y.gazetteDate)return 'OFFICIAL_ADVERTISEMENT_ID_AND_DATE';
 const hash=(value:any)=>value.documentSha256||value.pdfSha256;
 if(!/^[a-f0-9]{64}$/.test(hash(x)||'')||hash(x)!==hash(y))return null;
 if(Number.isInteger(x.sectionStartLine)&&x.sectionStartLine===y.sectionStartLine)return 'SAME_DOCUMENT_SECTION';
 if(x.sectionStartLine||y.sectionStartLine)return null;
 if(Number.isInteger(x.pageStart)&&Number.isInteger(x.pageEnd)&&x.pageStart===y.pageStart&&x.pageEnd===y.pageEnd&&x.advertisementId===y.advertisementId)return 'SAME_DOCUMENT_PAGE_RANGE_REVIEW_REQUIRED';
 return null;
}
