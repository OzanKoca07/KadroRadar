export function runsWorker(kind:'source'|'push'){
 const role=process.env.PROCESS_ROLE||'api';
 return role==='combined'||role===kind+'-worker';
}
