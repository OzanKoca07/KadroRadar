import React, { useEffect,useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnnouncementReview } from './AnnouncementReview.tsx';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';
type Batch = { id: string; sourceSha256: string; state: string; rowCount: number; errorCount: number; createdAt: string };
type ImportRow = { id: string; positionCode: string; sourcePage: number; raw: Record<string, unknown>; issues: unknown[] };
const cell: React.CSSProperties = { padding: '10px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'left', fontSize: 13 };
function App() {
  const [csrf, setCsrf] = useState('');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [chosen, setChosen] = useState<Batch | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sourcePreview,setSourcePreview]=useState('');
  const [confirmation,setConfirmation]=useState('');
  const [sourceMetadata,setSourceMetadata]=useState<any>(null);
  useEffect(()=>()=>{if(sourcePreview)URL.revokeObjectURL(sourcePreview);},[sourcePreview]);
  async function preview(){if(!chosen)return;try{const response=await fetch(API+'/admin/historical-documents/'+chosen.id+'/file',{credentials:'include'});if(!response.ok)throw Error('Kaynak PDF mevcut değil veya erişim reddedildi');setSourcePreview(URL.createObjectURL(await response.blob()));}catch(error){setMessage(String(error));}}
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const r = await fetch(API + path, { ...init, credentials:'include', headers: { 'x-csrf-token':csrf, 'content-type': 'application/json', ...(init.headers || {}) } });
    if(r.status===401){setCsrf('');setBatches([]);setChosen(null);setRows([]);throw new Error('Oturum süresi doldu. Yeniden giriş yapın.');}
    if (!r.ok) { const body = await r.text(); throw new Error(`HTTP ${r.status}: ${body}`); }
    return r.json();
  }
  async function loadBatches() {
    setBusy(true); try { setBatches(await request<Batch[]>('/admin/imports')); setMessage('Partiler yüklendi.'); }
    catch(e) { setMessage(String(e)); } finally { setBusy(false); }
  }
  async function openBatch(b: Batch, p = 1) {
    setSourcePreview('');
    setConfirmation('');
    setSourceMetadata(null);
    setBusy(true); try { const [d,source] = await Promise.all([request<{items: ImportRow[]}>('/admin/imports/' + encodeURIComponent(b.id) + '?page=' + p),request<any>('/admin/historical-documents/'+encodeURIComponent(b.id)+'/metadata')]); setSourceMetadata(source); setChosen(b); setRows(d.items); setPage(p); setMessage(''); }
    catch(e) { setMessage(String(e)); } finally { setBusy(false); }
  }
  async function approve() {
    if (!chosen || confirmation!==`${chosen.rowCount} KAYDI KONTROL ETTİM`) return;
    setBusy(true); try {
      const outcome = await request<{approvedCount:number}>('/admin/imports/' + chosen.id + '/approve', { method: 'POST', body: JSON.stringify({confirmation}) });
      setMessage(`${outcome.approvedCount} kayıt onaylandı.`); setChosen(null); setRows([]); await loadBatches();
    } catch(e) { setMessage(String(e)); } finally { setBusy(false); }
  }
  return <main style={{fontFamily:'system-ui,sans-serif',background:'#f5f7fb',minHeight:'100vh',color:'#122247',padding:'30px max(20px,5vw)'}}>
    <header style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h1>KadroRadar · Veri İnceleme</h1><small>Yetkili hesap · Kaynak doğrulama</small></header>
    <AnnouncementReview onSession={value=>{setCsrf(value);if(!value){setBatches([]);setChosen(null);setRows([]);setSourcePreview('');}}}/>
    <section style={{background:'white',padding:22,borderRadius:12,marginBottom:20}}>
      <button disabled={!csrf || busy} onClick={loadBatches} style={{marginLeft:12,padding:10}}>ÖSYM partilerini getir</button>
      <p role="status">{message}</p>
    </section>
    <section style={{background:'white',padding:22,borderRadius:12,marginBottom:20}}>
      <h2>İçe aktarma partileri</h2><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Oluşturma','Durum','Satır','Hata','Kaynak SHA','İşlem'].map(x=><th key={x} style={cell}>{x}</th>)}</tr></thead><tbody>
      {batches.map(b=><tr key={b.id}><td style={cell}>{new Date(b.createdAt).toLocaleString('tr-TR')}</td><td style={cell}>{b.state}</td><td style={cell}>{b.rowCount}</td><td style={cell}>{b.errorCount}</td><td style={cell}>{b.sourceSha256.slice(0,16)}...</td><td style={cell}><button onClick={()=>openBatch(b)}>İncele</button></td></tr>)}
      </tbody></table></div>
    </section>
    {chosen && <section style={{background:'white',padding:22,borderRadius:12}}>
      <h2>Parti inceleme · {chosen.state}</h2><p>Kaynak SHA-256: <code>{chosen.sourceSha256}</code></p>
      {sourceMetadata?.originalUrl&&<p>Resmî belge: <a href={sourceMetadata.originalUrl} target="_blank" rel="noopener noreferrer">{sourceMetadata.originalUrl}</a></p>}
      {sourceMetadata?.historicalEvidence&&<details><summary>Dönem, tarih ve kaynak doğrulama kanıtı</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(sourceMetadata.historicalEvidence,null,2)}</pre><p>Nitelik kodları kadroyla doğrulanmadıkça uygunluk hesaplanmaz.</p></details>}
      <button onClick={preview}>ÖSYM kaynak PDF önizle</button>{sourcePreview&&<iframe title="ÖSYM kaynak PDF" src={sourcePreview} style={{width:'100%',height:600}}/>}
      <p>Satırları kaynak PDF sayfasıyla karşılaştır. Otomatik bütünlük kontrolü, insan incelemesinin yerini tutmaz.</p>
      <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['PDF s.','Kadro kodu','Kurum','Unvan','Kontenjan','En küçük','En büyük','Hata'].map(x=><th key={x} style={cell}>{x}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.id}><td style={cell}>{r.sourcePage}</td><td style={cell}>{r.positionCode}</td><td style={cell}>{String(r.raw.institutionRawName??'')}</td><td style={cell}>{String(r.raw.title??'')}</td><td style={cell}>{String(r.raw.quota??'')}</td><td style={cell}>{String(r.raw.minScore??'-')}</td><td style={cell}>{String(r.raw.maxScore??'-')}</td><td style={cell}>{r.issues.length}</td></tr>)}</tbody></table></div>
      <nav style={{display:'flex',gap:10,marginTop:15,alignItems:'center'}}><button disabled={page<=1 || busy} onClick={()=>openBatch(chosen,page-1)}>Önceki</button><span>Sayfa {page}</span><button disabled={rows.length<30 || busy} onClick={()=>openBatch(chosen,page+1)}>Sonraki</button></nav>
      {chosen.state==='STAGED' && <div><p>Bu işlem kayıtları kamuya açar. Kaynak PDF ile karşılaştırmayı tamamladıysanız tam olarak <strong>{chosen.rowCount} KAYDI KONTROL ETTİM</strong> yazın.</p><label>ÖSYM onay teyidi <input value={confirmation} onChange={event=>setConfirmation(event.target.value)} autoComplete="off"/></label><button disabled={busy||confirmation!==`${chosen.rowCount} KAYDI KONTROL ETTİM`} onClick={approve} style={{marginTop:20,background:'#142655',color:'white',padding:12,border:0,borderRadius:8}}>İnceleme tamamlandı — toplu onay</button></div>}
    </section>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
