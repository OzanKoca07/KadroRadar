// All output fields are fixed allowlisted codes. Messages are inspected only in
// memory only; no fragments/URLs/SQL escape here. No dependency on uncommitted
// protected operator helpers: this module ships with the core preflight.
const phases=new Set(['INPUT','LOCAL_MANIFEST','TARGET_VALIDATION','DNS_LOOKUP','CLIENT_CREATE','PRISMA_CONNECT','CONNECTION_PROBE','READ_ONLY_TRANSACTION','IDENTITY_CHECK','MIGRATION_QUERY','MIGRATION_VALIDATION','DATA_COUNTS','DISCONNECT']);
const validations=new Set(['M16_PHASE','M16_LOCAL_NAMES','M16_LOCAL_CHECKSUM','M16_LOCAL_COUNT','M16_LOCAL_READ_FAILURE','M16_APPLIED_COUNT','M16_UNFINISHED_OR_UNKNOWN','M16_DB_CHECKSUM','M16_TARGET_IDENTITY','M16_RELEASE_DATA_COUNTS','M16_PROBE_RESULT']);
const prisma=new Set(['P1000','P1001','P1002','P1003','P1008','P1009','P1010','P1011','P1012','P1013','P1014','P1015','P1016','P1017','P2024','P2010','P2021','P2022','P2028']);
const states=new Set(['28P01','28000','3D000','08000','08001','08003','08004','08006','08007','08P01','57P01','57P02','57P03','53300','53400','57014','42501','42P01','42703','25006']);
const systems={ENOTFOUND:'DNS_FAILURE',EAI_AGAIN:'DNS_FAILURE',ECONNREFUSED:'TCP_CONNECTION_FAILURE',ECONNRESET:'TCP_CONNECTION_FAILURE',EPIPE:'TCP_CONNECTION_FAILURE',ENETUNREACH:'TCP_CONNECTION_FAILURE',EHOSTUNREACH:'TCP_CONNECTION_FAILURE',ETIMEDOUT:'CONNECTION_TIMEOUT',CERT_HAS_EXPIRED:'TLS_FAILURE',DEPTH_ZERO_SELF_SIGNED_CERT:'TLS_FAILURE',SELF_SIGNED_CERT_IN_CHAIN:'TLS_FAILURE',UNABLE_TO_VERIFY_LEAF_SIGNATURE:'TLS_FAILURE',UNABLE_TO_GET_ISSUER_CERT_LOCALLY:'TLS_FAILURE',ERR_TLS_CERT_ALTNAME_INVALID:'TLS_FAILURE',ERR_SSL_WRONG_VERSION_NUMBER:'TLS_FAILURE'};
const kinds=new Set(['Error','TypeError','SyntaxError','RangeError','PrismaClientInitializationError','PrismaClientKnownRequestError','PrismaClientUnknownRequestError','PrismaClientValidationError','PrismaClientRustPanicError']);
function safeFailure(error,step,requestedPhase){
 const phase=phases.has(step)?step:'INPUT',chain=[];let item=error;for(let i=0;item&&i<4;i++,item=item.cause)chain.push(item);
 const prismaCode=chain.map(e=>prisma.has(e.errorCode)?e.errorCode:prisma.has(e.code)?e.code:undefined).find(Boolean);
 const sqlState=chain.map(e=>states.has(e.code)?e.code:states.has(e.meta?.code)?e.meta.code:undefined).find(Boolean);
 const system=chain.map(e=>Object.hasOwn(systems,e.code)?systems[e.code]:undefined).find(Boolean);
 const validationCode=validations.has(error?.validationCode)?error.validationCode:undefined;
 let code='UNKNOWN_OPERATION_FAILURE',evidence='UNCLASSIFIED';
 if(phase==='TARGET_VALIDATION'||validationCode==='M16_TARGET_IDENTITY'){code='TARGET_VALIDATION_FAILURE';evidence='TARGET_GUARD';}
 else if(validationCode&&validationCode!=='M16_PHASE'&&validationCode!=='M16_PROBE_RESULT'){code='MIGRATION_VALIDATION_FAILURE';evidence='VALIDATION_GUARD';}
 else if(system){code=system;evidence='SYSTEM_CODE';}
 else if(['28P01','28000'].includes(sqlState)){code='AUTHENTICATION_FAILURE';evidence='SQLSTATE';}
 else if(sqlState==='3D000'){code='DATABASE_NOT_FOUND';evidence='SQLSTATE';}
 else if(['08000','08001','08003','08004','08006','08007','08P01','57P01','57P02','57P03'].includes(sqlState)){code='TCP_CONNECTION_FAILURE';evidence='SQLSTATE';}
 else if(['42P01','42703'].includes(sqlState)){code='MIGRATION_VALIDATION_FAILURE';evidence='SQLSTATE';}
 else if(prismaCode==='P2028'&&error?.name==='PrismaClientKnownRequestError'&&/unable to start a transaction in the given time/i.test(typeof error.message==='string'?error.message.slice(0,16384):'')){code='CONNECTION_TIMEOUT';evidence='BOUNDED_PATTERN';}
 else if(prismaCode){code=({P1000:'AUTHENTICATION_FAILURE',P1010:'AUTHENTICATION_FAILURE',P1001:'TCP_CONNECTION_FAILURE',P1002:'CONNECTION_TIMEOUT',P1003:'DATABASE_NOT_FOUND',P1008:'CONNECTION_TIMEOUT',P1011:'TLS_FAILURE',P1017:'TCP_CONNECTION_FAILURE',P2024:'CONNECTION_TIMEOUT',P2021:'MIGRATION_VALIDATION_FAILURE',P2022:'MIGRATION_VALIDATION_FAILURE'})[prismaCode]||(['CLIENT_CREATE','PRISMA_CONNECT'].includes(phase)?'PRISMA_INITIALIZATION_FAILURE':'UNKNOWN_OPERATION_FAILURE');evidence='PRISMA_CODE';}
 else if(error?.name==='PrismaClientInitializationError'){
  const text=typeof error.message==='string'?error.message.slice(0,16384):'';
  const patterns=[[/certificate verify failed|invalid peer certificate|certificate.*(?:expired|unknown issuer|not valid for)|unknownissuer|invalidcertificate|error (?:opening|creating) a TLS connection|TLS handshake|SSL handshake/i,'TLS_FAILURE'],[/authentication failed|password authentication failed/i,'AUTHENTICATION_FAILURE'],[/could not (?:translate|resolve) host|name or service not known|temporary failure in name resolution|dns error/i,'DNS_FAILURE'],[/connection refused|server closed the connection|connection reset by peer|can.t reach database server/i,'TCP_CONNECTION_FAILURE'],[/connect(?:ion)? (?:timed out|timeout)|timed out (?:fetching|while connecting)/i,'CONNECTION_TIMEOUT']];
  const match=patterns.find(([pattern])=>pattern.test(text));code=match?match[1]:'PRISMA_INITIALIZATION_FAILURE';evidence=match?'BOUNDED_PATTERN':'INITIALIZATION_KIND';
 }
 if(evidence==='UNCLASSIFIED'&&sqlState)evidence='SQLSTATE';
 return {status:'FAIL',readOnly:true,write:false,...(['before','after'].includes(requestedPhase)?{requestedPhase}:{}),phase,code,evidence,errorKind:kinds.has(error?.name)?error.name:'UnclassifiedError',...(prismaCode?{prismaCode}:{}),...(sqlState?{sqlState}:{}),...(validationCode?{validationCode}:{})};
}
module.exports={safeFailure};
