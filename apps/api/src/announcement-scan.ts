export type ScanMode='manual'|'scheduled';
export function scanIntervalHours(value=process.env.ANNOUNCEMENT_SCAN_INTERVAL_HOURS){
 if(value===undefined||value==='')return 96;
 if(!/^\d+$/.test(value)||Number(value)<1||Number(value)>8760)throw Error('ANNOUNCEMENT_SCAN_INTERVAL_HOURS must be an integer from 1 to 8760');
 return Number(value);
}
export function scanMode(value=process.env.ANNOUNCEMENT_SCAN_MODE):ScanMode{
 if(value===undefined||value==='')return 'scheduled';
 if(value!=='manual'&&value!=='scheduled')throw Error('Invalid ANNOUNCEMENT_SCAN_MODE');
 return value;
}
export function nextScanAt(lastSuccessAt:Date|null|undefined,minIntervalSeconds=3600){
 return lastSuccessAt?new Date(lastSuccessAt.getTime()+Math.max(scanIntervalHours()*3600000,minIntervalSeconds*1000)):null;
}
