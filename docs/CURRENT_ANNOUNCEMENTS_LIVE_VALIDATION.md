# Güncel ilanlar — gerçek kaynak doğrulaması, 26 Ekim 2026

Sonraki politika: `ANNOUNCEMENT_INDEXING_POLICY.md`. Kamuya açık olgusal bilgi indeksleme ve resmî link gösterimi tam belge yeniden yayımı değildir. Eski birleşik izin ön şartı kaldırıldı; otomatik erişim/site koşulları ayrı değerlendirilir. Enerji RSS okuma kapsamı ALLOWED, diğer belirsiz yöntemler REVIEW_REQUIRED; bu bir genel yasak tespiti değildir. Tam metin/alıntı public API'den çıkarıldı, admin özel belgeleri korundu. Production aktivasyonu yapılmadı.

## Sonraki çok kaynaklı sprint güncellemesi

`MULTISOURCE_ANNOUNCEMENTS_REPORT.md` ve `PRODUCTION_RELEASE_CHECKLIST.md` son durumu içerir. Beş manuel adaptör, admin kaynak kuyruğu, açıklanabilir statüler, KPSS'siz/istihdam filtreleri, ihtiyatlı kaynak eşleşmesi ve one-shot worker eklendi. Yeni migration/production yazımı/otomasyon/deployment yok. Bu sprint yeni PDF indirmedi: aşağıdaki gerçek indirme paketi yeni adaptörler ve izole PostgreSQL ile yeniden doğrulandı; 2 ilan/20 kadro ve0 yeni/2 duplicate korundu.

Önceki Python toplu test engeli bu sprintte giderildi:56+5=61 test PASS. Günlük izole suite15 grup, eski504 snapshot ve21 belge/8611 ÖSYM operatörü PASS. ACL5.1/7 PASS. Yeni mobil/helper sözleşmesi test edildi; fiziksel Android0. Son production public GET15:54:52 UTC'de üç endpoint için20sn timeout; mevcut canlı toplamlar UNKNOWN. Önceki sıfır sayımlarının güncel olduğu iddia edilmez. Kullanım/yeniden yayın izinleri hâlâ doğrulanmadı, kaynaklar kapalıdır.

ÖSYM historical import'tan bağımsızdır. 8.611 tarihsel kayıt production'a aktarılmış değildir. ÖSYM release belgesi, üç production betiği ve 21 kaynak envanteri değiştirilmedi. Bu görev yeni migration eklemez. Production DB yazımı, migration, deployment veya kaynak etkinleştirmesi yapılmadı.

## Erişim ve izin

[Resmî Gazete](https://www.resmigazete.gov.tr/) fihristi doğrudan indirilerek 26 Ekim 2026 / 33412 sayısı doğrulandı. İlk istekte DNS 0,005 s, TCP 0,370 s, TLS 1,351 s tamamlandı; 25 saniyede HTTP başlığı gelmedi. Bu DNS/TLS/403 hatası değildir. Sonraki kontrollü istek HTTP 200 ile tamamlandı; süreklilik garantisi değildir.

Gerçekte gözlenen bağlantı zinciri:

1. `https://www.resmigazete.gov.tr/`
2. `https://www.resmigazete.gov.tr/ilanlar/eskiilanlar/2026/10/20261026-4.htm`
3. `https://www.resmigazete.gov.tr/ilanlar/eskiilanlar/2026/10/20261026-4-1.pdf`

URL'ler tahmin edilmedi. İlan bölümünde altı PDF gözlendi; yalnızca biri indirildi. Canlı mükerrer sayı keşfedildiği iddia edilmez.

| İndirme | Bayt | SHA-256 |
|---|---:|---|
| Günlük fihrist | 199742 | `559067e1247b8b54bcb92e060eb15bb3325c251bbbc13ed2124dea3dbb929ae5` |
| Çeşitli ilanlar HTML | 57378 | `2626143d138233ce9fb18a1cb3ac056222b08f6e8e49c1a922c33ff4cf614504` |
| Dokuz Eylül Üniversitesi PDF, 4 sayfa | 104664 | `d788a9ef13e2e48afbf026b38b3084731ea8e0c56e80c0c9d09c6fa02d3467ce` |
| Enerji Bakanlığı RSS | 113888 | Ham dosyadan admin raporunda doğrulanır |

Gazete altbilgisi kullanım/telif bildirimine ve tüm hakların saklı olduğuna işaret ediyor. Otomasyon/yeniden yayın izni doğrulanamadı. [Enerji Bakanlığı RSS sayfası](https://enerji.gov.tr/rss) içerik takibini sunuyor, aynı sayfada tüm hakların saklı olduğunu belirtiyor. RSS okuma imkânı yeniden yayın izni sayılmadı. İzinli olduğu doğrulanmış başka resmî personel kaynağı bulunamadı. **Ana kabul kriterinin kullanım izni bölümü karşılanmış değildir.** Registry ve production otomasyonu kapalıdır.

## Geliştirmeler

- `services/ingest/source_probe.py`: açıkça verilen registry URL'sine tek istek; DNS/TCP/TLS/HTTP_HEADERS/HTTP_BODY ölçümü. Kamu IP'sine bağlanır, TLS'yi asıl hostname ile doğrular. Redirect izlenmez; 304/403/429 ayrıdır. Eksik veya 2MB üstü gövde önceki geçerli dosyayı değiştirmez. DNS dahil üst süreç zaman sınırı çağıranın sorumluluğudur. Scheduler veya DB yazıcısı değildir.
- `official_gazette.py`: bildirilen Windows-1254/ISO-8859-9 HTML desteği; katı çözümleme, sessiz karakter değiştirme yok. Alt PDF tarihleri gözlenen URL'den çıkarılır. Aynı sayfada başlayan ikinci ilan koordinatla ayrılır; devam tablosu önceki ilana aittir. `ADET` sütunu ve aynı ilan içindeki devam başlıkları desteklenir. Akademik yabancı dil puanı KPSS puanı yapılmaz.
- `official_rss.py`: gerçek `PublishStartDate`, dosya/item SHA ve ordinal kanıtı. Eksik linkli aday ayrı inceleme raporuna alınır; feed URL'si ilan URL'si yapılmaz. Eski katı `parse_feed` davranışı korunur; sync bağlı kayıtları işlerken eksik referansları ayrı saklar.
- `gazette.ts`: mevcut SourceDocument üzerinde özel ham RSS ve inceleme raporu; yeni şema yok. Session/RBAC/CSRF, upload kapatma bayrağı, SHA, boyut, kota ve retention uygulanır. Eksik kaynak ilan staging'ine veya yayına geçirilmez.
- `OfficialFeedReview.tsx` / `GazetteUpload.tsx`: RSS kaynak inceleme kuyruğu, eksik bağlantı, kaynak ve hash gösterimi. Mevcut fihrist/PDF/manual import/onay/yayın akışı korunur.
- `worker.ts` / `test-source-worker-process.cjs`: bağımsız worker başlangıç/kapanış, explicit flag ve HTTP dinleyicisi olmaması testi; registry kapalıdır.

Yeni API: `GET/POST /api/v1/admin/gazette-documents/feed-reviews`, `GET /api/v1/admin/gazette-documents/feed-reviews/:id/file`. Ham dosya text/plain + nosniff + CSP sandbox + no-store ile yalnızca yetkili kullanıcıya sunulur. POST yalnızca kaynak incelemesi oluşturur.

## Gerçek belge / izole PostgreSQL sonuçları

İndirme makbuzu SHA'ları dosyalarla karşılaştırıldı. Fihrist → bölüm → PDF → staging → reviewer test onayı → yayın → public API detayları geçti. Onaylar programatik test onayıdır; insan editoryal kabulü veya kullanım izni değildir.

| Metrik | Sonuç |
|---|---:|
| Gerçek günlük sayı | 1 |
| İndirilen fihrist / bölüm HTML | 1 / 1 |
| Gözlenen / indirilen PDF | 6 / 1 |
| Ayrıştırılan ilan / kadro / kontenjan | 2 / 20 / 20 |
| İlk ilan sayfa / kadro | 1–2 / 11 |
| İkinci ilan sayfa / kadro | 2–4 / 9 |
| Staging | 2 |
| Tekrar import yeni / duplicate | 0 / 2 |
| Test onayı / test yayını | 2 / 2 |
| Public API detayında ilan / kadro | 2 / 20 |
| Güncel açık ilan | 0 — tarihler kesin doğrulanmadı |
| Gerçek RSS kaydı / bağlantısız personel adayı | 100 / 1 |
| RSS inceleme belgesi / ilan staging | 1 / 0 |
| Gerçek canlı scheduler başarılı / başarısız koşu | 0 / 0 — kapalı |
| Production yazımı / yayın / fiziksel Android kontrolü | 0 / 0 / 0 |

PDF'nin ikinci sayfası görsel incelendi: önceki ilanın tablosu ile yeni ilan başlığı aynı sayfada. 20 satırın şartları complete=false, degreeCodesVerified=false kalır. Eğitim düzeyi/KPSS uydurulmaz. Üç eğitim filtresi eksik tarihli gerçek kayıtları Güncel İlanlar'a sokmaz. Üç KPSS seviyesinin pozitif eşleşme örnekleri ayrı sentetik regresyonlardır; akademik PDF bu seviyelerin gerçek pozitif örneği değildir.

Eski 140 sayfalık PDF testi korundu: 6 aday, tekrarında 6 duplicate, 2 test yayını, API'de 9 kadro. Bugünkü indirme sayısına eklenmez. Eski 504 ÖSYM kaydının tüm alan snapshot karşılaştırması geçti.

## Test kanıtı ve kullanım

RSS 10 ve ağ tanılama 6 birim testi geçti. Gazete'nin mevcut 19 testi gerçek eski PDF dahil gruplama düzeltmesiyle geçti. Ek encoding/ADET testleri eklendi; son toplu Python suite komutunun onayı reddedildi, tüm Python suite yeniden geçmiş gibi raporlanmaz. API/admin derlemeleri geçti.

İzole runner, gerçek belge testi dahil mevcut yayın, güvenlik, bildirim ve mobil ağ regresyonlarını çalıştırır. Bağımsız worker testi registry kapalıyken gerçek alt süreç başlatır; HTTP dinlemez. Lock/backoff ve push sağlayıcı testleri taklit adaptörlerdir; gerçek scheduler/push başarısı değildir.

```powershell
# Tek seferlik ağ tanılaması; DB yazmaz, izin veya otomasyon açmaz.
python services/ingest/source_probe.py --source gazette --url https://www.resmigazete.gov.tr/ --output .local/current-source-check/gazette-index.html --receipt .local/current-source-check/gazette-probe.json

# Gerçek indirmeler ve makbuzlar hazırken, yalnızca geçici DB:
$env:CURRENT_REAL_DIR=(Resolve-Path .local/current-source-check).Path
$env:GAZETTE_REAL_PDF='C:\path\resmi gazete.pdf'
$env:DAILY_BASELINE_BACKUP='C:\path\existing-private-backup.dump'
node infra/test-daily-operation.cjs
```

Özel dosyalar/makbuzlar `.local/current-source-check/`; test raporu `.local/daily-operation/test-report.json` içinde. Git'e eklenmez. Production'da bu geliştirmelerin deploy edildiği doğrulanmadı. Otomasyon için kullanım koşulları kanıtı ve ayrı kullanıcı onayı; production yazımı/deployment için ayrı onay gereklidir.
