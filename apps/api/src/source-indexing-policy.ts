// Access assessment, operator activation and content use are separate decisions.
// REVIEW_REQUIRED means unassessed/uncertain, never a finding of illegality.
export function indexingAssessment(source:any){
 const policy=source?.indexingPolicy;
 const valid=policy&&['ALLOWED','REVIEW_REQUIRED','DISALLOWED'].includes(policy.automatedAccess);
 return {automatedAccess:valid?policy.automatedAccess:'REVIEW_REQUIRED',
  scope:policy?.scope||'NOT_ASSESSED',basisUrl:policy?.basisUrl||null,
  factualContent:'FACTS_AND_OFFICIAL_LINKS_ONLY',fullDocumentPublication:'DISABLED',
  minIntervalSeconds:Number.isInteger(policy?.minIntervalSeconds)&&policy.minIntervalSeconds>=60?Math.min(policy.minIntervalSeconds,86400):3600};
}
export function automaticIndexingAllowed(source:any){
 return source?.enabled===true&&indexingAssessment(source).automatedAccess==='ALLOWED';
}
