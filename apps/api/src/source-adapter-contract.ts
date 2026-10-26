import {indexingAssessment} from './source-indexing-policy';
export const sourceAdapters:Record<string,{name:string;capability:string;liveSupported:boolean}>={
 gazette:{name:'OfficialGazetteAdapter',capability:'PDF_HTML_NOTICES_AND_INDEX',liveSupported:false},
 sbb:{name:'SbbPublicAnnouncementsAdapter',capability:'LINK_DISCOVERY_ONLY',liveSupported:false},
 career:{name:'CareerGatewayAdapter',capability:'LINK_DISCOVERY_ONLY',liveSupported:false},
 iskur:{name:'IskurPublicJobsAdapter',capability:'LINK_DISCOVERY_ONLY',liveSupported:false},
 energy:{name:'OfficialInstitutionRssAdapter',capability:'RSS_CANDIDATES',liveSupported:true},
};
export function adapterStatus(source:any){
 const adapter=sourceAdapters[source?.id];
 if(!adapter)return {status:'DISABLED',adapter:null,reason:'NO_SUPPORTED_ADAPTER'};
 const assessment=indexingAssessment(source),permitted=assessment.automatedAccess==='ALLOWED';
 return {status:assessment.automatedAccess==='DISALLOWED'?'DISABLED':!permitted?'REVIEW_REQUIRED':source.enabled&&adapter.liveSupported?'READY':'DISABLED',adapter,indexing:assessment,
  reason:assessment.automatedAccess==='DISALLOWED'?'AUTOMATED_ACCESS_DISALLOWED':!permitted?'ACCESS_ASSESSMENT_REQUIRED':!adapter.liveSupported?'MANUAL_DOCUMENTS_ONLY':!source.enabled?'OPERATOR_DISABLED':null};
}
