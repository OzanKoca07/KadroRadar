import {indexingAssessment} from './source-indexing-policy';
import {sourceRights} from './source-rights';
export const sourceAdapters:Record<string,{name:string;capability:string;liveSupported:boolean}>={
 gazette:{name:'OfficialGazetteAdapter',capability:'PDF_HTML_NOTICES_AND_INDEX',liveSupported:false},
 sbb:{name:'SbbPublicAnnouncementsAdapter',capability:'LINK_DISCOVERY_ONLY',liveSupported:false},
 career:{name:'CareerGatewayAdapter',capability:'RSS2_METADATA_REVIEW',liveSupported:true},
 iskur:{name:'IskurPublicJobsAdapter',capability:'LINK_DISCOVERY_ONLY',liveSupported:false},
 energy:{name:'OfficialInstitutionRssAdapter',capability:'RSS_CANDIDATES',liveSupported:true},
 sgk:{name:'SgkMetadataReviewAdapter',capability:'RSS_ATOM_JSON_METADATA_REVIEW_ONLY',liveSupported:false},
 karacadag:{name:'AgencyMetadataReviewAdapter',capability:'RSS_ATOM_JSON_METADATA_REVIEW_ONLY',liveSupported:false},
 giresun:{name:'UniversityMetadataReviewAdapter',capability:'RSS_ATOM_JSON_METADATA_REVIEW_ONLY',liveSupported:false},
};
export function adapterStatus(source:any){
 const adapter=sourceAdapters[source?.id];
 if(!adapter)return {status:'DISABLED',adapter:null,reason:'NO_SUPPORTED_ADAPTER'};
 const assessment=indexingAssessment(source),rightsStatus=sourceRights(source),permitted=assessment.automatedAccess==='ALLOWED'&&rightsStatus==='LICENSE_VERIFIED';
 if(rightsStatus==='RESTRICTED')return {status:'DISABLED',adapter,indexing:assessment,rightsStatus,reason:'SOURCE_RESTRICTED'};
 return {status:assessment.automatedAccess==='DISALLOWED'?'DISABLED':!permitted?'REVIEW_REQUIRED':source.enabled&&adapter.liveSupported?'READY':'DISABLED',adapter,indexing:assessment,rightsStatus,
  reason:assessment.automatedAccess==='DISALLOWED'?'AUTOMATED_ACCESS_DISALLOWED':!permitted?'ACCESS_ASSESSMENT_REQUIRED':!adapter.liveSupported?'MANUAL_DOCUMENTS_ONLY':!source.enabled?'OPERATOR_DISABLED':null};
}
