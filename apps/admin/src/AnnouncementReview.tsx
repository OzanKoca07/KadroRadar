import {readImportFile} from './manual-file.ts';
import {SourceStatus} from './SourceStatus.tsx';
import {HistoricalUpload} from './HistoricalUpload.tsx';
import React, {useState,useEffect} from 'react';
import {GazetteUpload} from './GazetteUpload.tsx';
const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';
export function AnnouncementReview({onSession}:{onSession?:(csrf:string)=>void}) {
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [draft, setDraft] = useState('');
  const [evidence, setEvidence] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [importText, setImportText] = useState('[]');
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[csrf,setCsrf]=useState('');
  const [positionDraft,setPositionDraft]=useState('{}');
  const [pdfReviewed,setPdfReviewed]=useState(false);
  const [storedPreview,setStoredPreview]=useState('');
  const [canonicalId,setCanonicalId]=useState('');
  function clearSession(){setCsrf('');onSession?.('');setRows([]);setSelected(null);setStoredPreview('');}
  async function logout(){try{await fetch(API+'/account/logout',{method:'POST',credentials:'include',headers:{'x-csrf-token':csrf}});}finally{clearSession();}}
  useEffect(()=>()=>{if(storedPreview)URL.revokeObjectURL(storedPreview);},[storedPreview]);
  async function showStoredPdf(){const response=await fetch(API+'/admin/gazette-documents/'+selected.sourceDocumentId+'/file',{credentials:'include'});if(!response.ok)throw new Error('PDF dosyası yüklenemedi');setStoredPreview(URL.createObjectURL(await response.blob()));}
  async function savePosition(){
    const response=await fetch(API+'/admin/announcements/'+selected.announcementId+'/positions',{method:'POST',credentials:'include',headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify({...JSON.parse(positionDraft),evidence})});
    if(!response.ok)throw new Error('Kadro doğrulaması başarısız: HTTP '+response.status);
    const result=await response.json();setPositionDraft(JSON.stringify(result,null,2));
  }
  async function login(){
    const response=await fetch(API+'/account/login',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})});
    if(!response.ok)throw new Error('Giriş başarısız');
    const result=await response.json();setPassword('');
    if(!['SYSTEM_ADMIN','CONTENT_EDITOR','REVIEWER'].includes(result.role)){await fetch(API+'/account/logout',{method:'POST',credentials:'include',headers:{'x-csrf-token':result.csrfToken}});throw new Error('Bu hesabın yönetim yetkisi yok.');}
    setCsrf(result.csrfToken);onSession?.(result.csrfToken);
  }
  async function request(path = '', body?: any, method?:string) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(API + '/admin/announcement-imports' + path, {credentials:'include',signal: controller.signal, method:method??(body ? 'POST' : 'GET'), headers: {'x-csrf-token':csrf, 'content-type': 'application/json'}, body: body ? JSON.stringify(body) : undefined});
      if(response.status===401){clearSession();throw new Error('Oturum süresi doldu. Yeniden giriş yapın.');}
      if (!response.ok) throw new Error(`İşlem başarısız: HTTP ${response.status}`);
      return response.json();
    } finally {clearTimeout(timer);}
  }
  async function load() {setRows(await request());}
  async function run(work: () => Promise<void>) {setBusy(true); try {await work(); setMessage('İşlem tamamlandı.');} catch(e) {setMessage(String(e));} finally {setBusy(false);}}
  async function action(value: string) {
    await request('/' + selected.id + '/review', {version: selected.version, action: value, fields: JSON.parse(draft), sourceVerified: value === 'APPROVE', evidence,documentVerified:pdfReviewed,positionsReviewed:pdfReviewed,resolvedIssues:pdfReviewed});
    setSelected(null); await load();
  }
  return <section style={{background:'white', padding:22, marginBottom:20, borderRadius:12}}>
    <h2>İlan inceleme kuyruğu</h2>
    <div><label>E-posta <input value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username"/></label><label>Parola <input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label><button disabled={busy} onClick={()=>run(login)}>Hesapla giriş yap</button></div>
    {csrf&&<button disabled={busy} onClick={()=>run(logout)}>Çıkış yap</button>}
    <button disabled={busy || !csrf} onClick={() => run(load)}>Kuyruğu getir</button>
    <p role="status">{message}</p>
    <HistoricalUpload csrf={csrf}/>
    <GazetteUpload csrf={csrf} onImported={load}/>
    <SourceStatus csrf={csrf}/>
    <details><summary>Manuel / JSON ilan aktarımı</summary>
      <input aria-label="CSV veya JSON dosyası" type="file" accept=".csv,.json" onChange={event=>{const file=event.target.files?.[0];if(file)void run(async()=>{if(file.size>1024*1024)throw Error('Dosya1MiB sınırını aşıyor');setImportText(JSON.stringify(readImportFile(await file.text(),file.name),null,2));});}}/>
      <p>Gerçek resmî kaynaktan kontrol edilen alanları girin. JSON dizi; title, organization ve sourceUrl zorunlu. Aktarılanlar yayımlanmaz, incelemeye alınır.</p>
      <textarea aria-label="İçe aktarılacak ilanlar JSON" rows={8} value={importText} onChange={e => setImportText(e.target.value)} style={{width:'100%'}} />
      <button disabled={busy || !csrf} onClick={() => run(async () => {await request('', {rows: JSON.parse(importText)}); await load();})}>İnceleme kuyruğuna aktar</button>
    </details>
    {rows.map(row => <p key={row.id}><button disabled={busy} onClick={() => {setSelected(row); setDraft(JSON.stringify(row.parsed, null, 2)); setEvidence('');setPdfReviewed(false);setStoredPreview('');}}>{row.parsed.title} · {row.status}</button></p>)}
    {selected && <div>
      <h3>{selected.parsed.title}</h3>
      <p role="note">Eksik alanlar: {['applicationStartAt','applicationEndAt','quota'].filter(key=>selected.parsed[key]==null).join(', ')||'Yok'} · Uyarılar: {JSON.stringify(selected.issues)}</p>
      <details><summary>Başka kaynaktaki aynı ilanla birleştir</summary><p>Yalnızca başlık benzerliği yeterli değildir. Kurum, başvuru dönemi, kadrolar ve kaynak kanıtlarını kontrol edin. Bu işlem yeni ilan yayımlamaz; mevcut ilana ikinci kaynak ekler.</p><input aria-label="Mevcut ilan kimliği" value={canonicalId} onChange={e=>setCanonicalId(e.target.value)}/><button disabled={busy||!canonicalId||!evidence} onClick={()=>run(async()=>{await request('/'+selected.id+'/link',{version:selected.version,announcementId:canonicalId,evidence,documentVerified:pdfReviewed||!selected.sourceDocumentId});setSelected(null);await load();})}>Doğrulanan kaynağı mevcut ilana bağla</button></details>
      {selected.sourceDocumentId&&<div><p>PDF kanıtı: {JSON.stringify(selected.parsed.sourceEvidence)}</p><button disabled={busy} onClick={()=>run(showStoredPdf)}>Orijinal PDF sayfalarını incele</button>{storedPreview&&<iframe title="Saklanan kaynak PDF" src={storedPreview+'#page='+(selected.parsed.sourceEvidence?.pageStart??1)} style={{width:'100%',height:650}}/>}<label><input type="checkbox" checked={pdfReviewed} onChange={e=>setPdfReviewed(e.target.checked)}/>Kaynak sayfalarını, tüm kadro satırlarını, OCR/metin uyarılarını ve eksik alanları tek tek kontrol ettim.</label><p>sourceEvidence değiştirilemez. Gereksinimlerde complete yalnızca tüm koşullar doğrulanmışsa true yapılmalıdır.</p></div>}
      {/^https:\/\/enerji\.gov\.tr\//.test(selected.sourceUrl) && <a href={selected.sourceUrl} target="_blank" rel="noopener noreferrer">Resmî kaynağı incele</a>}
      <p>Tarihleri saat dilimiyle girin: 2026-10-23T23:59:59+03:00. Eksik alanları uydurmayın.</p>
      <textarea aria-label="İlan alanları JSON" rows={18} style={{width:'100%'}} value={draft} onChange={e => setDraft(e.target.value)} />
      <button disabled={busy} onClick={()=>run(async()=>{await request('/'+selected.id,{version:selected.version,fields:JSON.parse(draft)},'PATCH');setSelected(null);await load();})}>Taslağı kaydet ve yeniden incelemeye gönder</button>
      <label>Kaynak kontrolü kanıtı ve notu <input value={evidence} onChange={e => setEvidence(e.target.value)} /></label>
      <div>{['REJECT', 'APPROVE', 'PUBLISH', 'ARCHIVE', 'WITHDRAW'].map(value => <button key={value} disabled={busy} onClick={() => run(() => action(value))}>{value}</button>)}</div>
      <h4>Denetim geçmişi</h4>{selected.audits.map((audit: any) => <p key={audit.id}>{audit.createdAt} · {audit.actor} · {audit.action}<br/>{JSON.stringify(audit.snapshot)}</p>)}
      {selected.announcementId && <details><summary>Kadro koşullarını doğrula</summary><p>title, sourceUrl ve requirements alanlarını girin. requirements: educationLevels, degreeCodes, degreeCodesVerified, kpssRequired, kpssScoreType, kpssMinimumScore, examYears, ydsMinimumScore, certificates, otherConditions. complete yalnızca tüm koşullar doğrulandığında true olmalıdır. Eşdeğer bölüm kodlarını tahmin etmeyin. Güncellemede id alanını koruyun.</p><textarea aria-label="Kadro koşulları JSON" rows={16} style={{width:'100%'}} value={positionDraft} onChange={e=>setPositionDraft(e.target.value)}/><button disabled={busy || !csrf} onClick={()=>run(savePosition)}>Kadro koşullarını doğrula ve kaydet</button></details>}
    </div>}
  </section>;
}
