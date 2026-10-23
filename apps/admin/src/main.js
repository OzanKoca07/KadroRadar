import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';
const cell = { padding: '10px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'left', fontSize: 13 };
function App() {
    const [token, setToken] = useState('');
    const [batches, setBatches] = useState([]);
    const [chosen, setChosen] = useState(null);
    const [rows, setRows] = useState([]);
    const [page, setPage] = useState(1);
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    async function request(path, init = {}) {
        const r = await fetch(API + path, { ...init, headers: { 'authorization': `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers || {}) } });
        if (!r.ok) {
            const body = await r.text();
            throw new Error(`HTTP ${r.status}: ${body}`);
        }
        return r.json();
    }
    async function loadBatches() {
        setBusy(true);
        try {
            setBatches(await request('/admin/imports'));
            setMessage('Partiler yüklendi.');
        }
        catch (e) {
            setMessage(String(e));
        }
        finally {
            setBusy(false);
        }
    }
    async function openBatch(b, p = 1) {
        setBusy(true);
        try {
            const d = await request('/admin/imports/' + encodeURIComponent(b.id) + '?page=' + p);
            setChosen(b);
            setRows(d.items);
            setPage(p);
            setMessage('');
        }
        catch (e) {
            setMessage(String(e));
        }
        finally {
            setBusy(false);
        }
    }
    async function approve() {
        if (!chosen || !window.confirm('Bu partinin kaynak PDF ile karşılaştırmasını gerçekten tamamladınız mı? Bu işlem kayıtları kamuya açar.'))
            return;
        const confirmation = window.prompt('Onaylamak için tam olarak şunu yazın: 504 KAYDI KONTROL ETTİM');
        if (!confirmation)
            return;
        setBusy(true);
        try {
            const outcome = await request('/admin/imports/' + chosen.id + '/approve', { method: 'POST', body: JSON.stringify({ confirmation }) });
            setMessage(`${outcome.approvedCount} kayıt onaylandı.`);
            setChosen(null);
            setRows([]);
            await loadBatches();
        }
        catch (e) {
            setMessage(String(e));
        }
        finally {
            setBusy(false);
        }
    }
    return _jsxs("main", { style: { fontFamily: 'system-ui,sans-serif', background: '#f5f7fb', minHeight: '100vh', color: '#122247', padding: '30px max(20px,5vw)' }, children: [_jsxs("header", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsx("h1", { children: "KadroRadar \u00B7 Veri \u0130nceleme" }), _jsx("small", { children: "Yerel geli\u015Ftirme arac\u0131 \u00B7 \u00DCretim i\u00E7in RBAC gerekli" })] }), _jsxs("section", { style: { background: 'white', padding: 22, borderRadius: 12, marginBottom: 20 }, children: [_jsxs("label", { children: ["Yerel inceleme anahtar\u0131 ", _jsx("input", { type: "password", value: token, onChange: e => setToken(e.target.value), placeholder: "ADMIN_REVIEW_TOKEN", style: { marginLeft: 12, padding: 10, minWidth: 270 } })] }), _jsx("button", { disabled: !token || busy, onClick: loadBatches, style: { marginLeft: 12, padding: 10 }, children: "Partileri getir" }), _jsx("p", { role: "status", children: message })] }), _jsxs("section", { style: { background: 'white', padding: 22, borderRadius: 12, marginBottom: 20 }, children: [_jsx("h2", { children: "\u0130\u00E7e aktarma partileri" }), _jsx("div", { style: { overflowX: 'auto' }, children: _jsxs("table", { style: { width: '100%', borderCollapse: 'collapse' }, children: [_jsx("thead", { children: _jsx("tr", { children: ['Oluşturma', 'Durum', 'Satır', 'Hata', 'Kaynak SHA', 'İşlem'].map(x => _jsx("th", { style: cell, children: x }, x)) }) }), _jsx("tbody", { children: batches.map(b => _jsxs("tr", { children: [_jsx("td", { style: cell, children: new Date(b.createdAt).toLocaleString('tr-TR') }), _jsx("td", { style: cell, children: b.state }), _jsx("td", { style: cell, children: b.rowCount }), _jsx("td", { style: cell, children: b.errorCount }), _jsxs("td", { style: cell, children: [b.sourceSha256.slice(0, 16), "..."] }), _jsx("td", { style: cell, children: _jsx("button", { onClick: () => openBatch(b), children: "\u0130ncele" }) })] }, b.id)) })] }) })] }), chosen && _jsxs("section", { style: { background: 'white', padding: 22, borderRadius: 12 }, children: [_jsxs("h2", { children: ["Parti inceleme \u00B7 ", chosen.state] }), _jsxs("p", { children: ["Kaynak SHA-256: ", _jsx("code", { children: chosen.sourceSha256 })] }), _jsx("p", { children: "Sat\u0131rlar\u0131 kaynak PDF sayfas\u0131yla kar\u015F\u0131la\u015Ft\u0131r. Otomatik b\u00FCt\u00FCnl\u00FCk kontrol\u00FC, insan incelemesinin yerini tutmaz." }), _jsx("div", { style: { overflowX: 'auto' }, children: _jsxs("table", { style: { width: '100%', borderCollapse: 'collapse' }, children: [_jsx("thead", { children: _jsx("tr", { children: ['PDF s.', 'Kadro kodu', 'Kurum', 'Unvan', 'Kontenjan', 'En küçük', 'En büyük', 'Hata'].map(x => _jsx("th", { style: cell, children: x }, x)) }) }), _jsx("tbody", { children: rows.map(r => _jsxs("tr", { children: [_jsx("td", { style: cell, children: r.sourcePage }), _jsx("td", { style: cell, children: r.positionCode }), _jsx("td", { style: cell, children: String(r.raw.institutionRawName ?? '') }), _jsx("td", { style: cell, children: String(r.raw.title ?? '') }), _jsx("td", { style: cell, children: String(r.raw.quota ?? '') }), _jsx("td", { style: cell, children: String(r.raw.minScore ?? '-') }), _jsx("td", { style: cell, children: String(r.raw.maxScore ?? '-') }), _jsx("td", { style: cell, children: r.issues.length })] }, r.id)) })] }) }), _jsxs("nav", { style: { display: 'flex', gap: 10, marginTop: 15, alignItems: 'center' }, children: [_jsx("button", { disabled: page <= 1 || busy, onClick: () => openBatch(chosen, page - 1), children: "\u00D6nceki" }), _jsxs("span", { children: ["Sayfa ", page] }), _jsx("button", { disabled: rows.length < 30 || busy, onClick: () => openBatch(chosen, page + 1), children: "Sonraki" })] }), chosen.state === 'STAGED' && _jsx("button", { disabled: busy, onClick: approve, style: { marginTop: 20, background: '#142655', color: 'white', padding: 12, border: 0, borderRadius: 8 }, children: "\u0130nceleme tamamland\u0131 \u2014 toplu onay" })] })] });
}
createRoot(document.getElementById('root')).render(_jsx(App, {}));
