import React,{useState} from 'react';
const API=import.meta.env.VITE_API_BASE_URL||'http://localhost:3000/api/v1';
export function SourceStatus({csrf}:{csrf:string}){const [result,setResult]=useState<any>(null),[message,setMessage]=useState('');
 async function load(){try{const response=await fetch(API+'/admin/source-operations',{credentials:'include',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Kaynak durumu HTTP '+response.status);setResult(await response.json());setMessage('');}catch(error){setMessage(String(error));}}
 return <details><summary>Kaynak ve worker sağlık durumu</summary><button disabled={!csrf} onClick={load}>Kaynak durumlarını yenile</button><p role="status">{message}</p>{result&&<><p>Kaynak worker: {String(result.sourceWorkerEnabled)} · Bildirim worker: {String(result.notificationWorkerEnabled)}</p>{result.sources.map((source:any)=><div key={source.id}><strong>{source.id} · {source.enabled?'Etkin':'Kapalı'}</strong><p>Otomasyon: {source.automationPermission} · Yeniden yayın: {source.republicationPermission}</p><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(source.state,null,2)}</pre></div>)}</>}</details>;
}
