# Çok kaynaklı güncel ilanlar — 26 Ekim 2026

## İndeksleme kapsamı düzeltmesi

`ANNOUNCEMENT_INDEXING_POLICY.md` sonraki kullanıcı talebini ve geçerli politikayı açıklar. Olgusal indeksleme ile tam belge yayımı ayrıldı; yeniden yayım izni scheduler ön şartı değildir. Enerji için açık RSS sunumu ve robots kuralları yalnızca feed okuma kapsamını destekler. Belirsiz kaynak REVIEW_REQUIRED kalır, otomatik yasaklı sayılmaz. Public API/favoriler artık ham metin ve alıntı döndürmez. Tüm kaynakların enabled=false durumu ve production onay kapısı korundu. Aşağıdaki önceki sprintin “iki izin birlikte” ifadeleri bu kapsam düzeltmesiyle geçersizdir; test/indirme sayımları tarihsel kanıttır.

## Sonuç ve kapsam

Beş bağımsız adaptör, manuel kaynak inceleme API/admin akışı, açıklanabilir ilan durumu, KPSS'siz/istihdam filtreleri, ihtiyatlı mükerrer önerileri ve bağımsız/tek seferlik worker geliştirildi. Production'a uygulanmadı. İzin belirsiz kaynakların tamamı kapalıdır. ÖSYM historical import ayrı kalır; 8.611 kaydın production aktarımı yapılmadı.

Başlangıç/son HEAD `ef7c277`, branch `feature/announcements-core`. Yeni commit/push/deployment yok. Başlangıçtaki tüm dirty dosyalar korundu; migration sayısı 15. Bu sprint yeni migration eklemedi. Mevcut untracked `202610270001_gazette_index` SQL'i nullable JSONB kanıt alanıdır; production'da uygulanmış varsayılmaz. Operatör migration checksum farkında durur.

Tüm tracked/untracked değişikliklerin yerel dökümü `.local/multisource/git-status.txt` içindedir; önceki sprintlerin değişikliklerini de içerir. Güncel sprintin ana dosyaları aşağıda ayrı listelenmiştir. ÖSYM `prepare-osym-production.py` ve21 kaynak envanteri değiştirilmedi; operatör PS/CJS dosyalarında yalnızca istenen DACL güvenlik kapısı geliştirildi.

## Kaynak erişimi ve kullanım

| Kaynak / kayıtlı domain | Okuma yöntemi / teknik gözlem | Auth | Otomasyon / yeniden yayın | Son durum |
|---|---|---|---|---|
| [Resmî Gazete](https://www.resmigazete.gov.tr/) / `www.resmigazete.gov.tr` | Günlük HTML → çeşitli ilanlar HTML → gözlenen PDF. Önceki tam indirmeler SHA ile yeniden işlendi; önceki aralıklı HTTP timeout TLS hatası değildi | Açık belge | İkisi de doğrulanamadı; altbilgide haklar saklı | REVIEW_REQUIRED, kapalı |
| [SBB](https://kamuilan.sbb.gov.tr/) / `kamuilan.sbb.gov.tr` | Bu kontrolde web erişimi 403 | 403 nedeniyle ilan/API auth yöntemi doğrulanamadı | İkisi de doğrulanamadı | REVIEW_REQUIRED, kapalı; engel aşılmadı |
| [Kariyer Kapısı](https://kariyerkapisi.gov.tr/isealim) / `kariyerkapisi.gov.tr` | Açık HTML filtre/liste kabuğu görüldü; belgelenmiş açık API bulunmadı | Liste açık; gerçek başvuru giriş akışı bu görevde yürütülmedi | İkisi de doğrulanamadı | REVIEW_REQUIRED, kapalı |
| [İŞKUR e-şube](https://esube.iskur.gov.tr/) ve [kurumsal site](https://www.iskur.gov.tr/) | Açık ana sayfalar görüldü; kayıt/giriş formları var. İş ilanı API sözleşmesi doğrulanmadı | İlan başvurusu üyelik akışı; giriş yapılmadı | İkisi de doğrulanamadı | REVIEW_REQUIRED, kapalı |
| [Enerji Bakanlığı RSS](https://enerji.gov.tr/rss) / `enerji.gov.tr` | Bakanlığın sunduğu XML; önceki tam 113888 baytlık gerçek indirme yeniden parse edildi | RSS açık | RSS takibi sunuluyor; yeniden yayın doğrulanmadı | RSS_READING_ONLY / UNVERIFIED, kapalı |
| Diğer kurumlar / mevcut UAB registry | Yeni canlı parser sözleşmesi veya kullanım izni doğrulanmadı | Bilinmiyor | Bilinmiyor | Desteksiz/kapalı; kurum adından izin üretilmez |

Rate limit tüm kaynaklarda **UNKNOWN**: yayınlanmış kota bulunamadı; sayısal limit uydurulmadı. Robots dosyaları araştırma aracında açılamadı; bu durum izin veya yasak kanıtı sayılmadı. 403/429/login/CAPTCHA/robots/TLS engeli aşılmaz. Bakanlık, üniversite, belediye ve genel müdürlükler için tek bir ortak erişim/yeniden yayın izni varsayılmaz. Yeni kurum için exact-host registry ve ayrı belge/izin incelemesi gerekir.

Güvenilirlik: kayıtlı resmî domain güçlü kaynak referansıdır; işveren kurum, ilan güncelliği veya başvuru şartları otomatik doğrulanmış olmaz. Toplayıcı platformun adı işveren kurum yapılmaz. Başvuru URL'si yalnızca belgede doğrulanmış ve mevcut resmî host güvenlik kontrolünden geçen dış bağlantıdır; uygulama başvuru kabul etmez.

## Adaptörler ve veri sözleşmesi

`services/ingest/source_adapters.py` beş sınıf içerir. Hiçbiri kendi kendine ağ isteği veya yayın başlatmaz:

| Adaptör | Gerçek kanıt / destek |
|---|---|
| OfficialGazetteAdapter | Önceki gerçek 4 sayfalık PDF ile yerel tekrar: 2 aday / 20 kadro. Mevcut 140 sayfalık parser ve testleri korunur |
| OfficialInstitutionRssAdapter | İlk registry kurumu Enerji Bakanlığı. Gerçek XML'de 100 kayıt, 1 personel adayı, detay linki yok. Başka kurum RSS formatları desteklenmiş sayılmaz |
| SbbPublicAnnouncementsAdapter | Yerel HTML'de aynı host personel bağlantısı keşfi. Detay/şart parser'ı ve canlı tarama desteklenmiyor |
| CareerGatewayAdapter | Yerel HTML bağlantı keşfi; dinamik/login/API kazıması yapılmaz |
| IskurPublicJobsAdapter | Yerel HTML bağlantı keşfi; üyelik oturumu veya iş ilanı API'si kullanılmaz |

SBB/Kariyer/İŞKUR testleri sentetiktir; gerçek ilan edinme başarısı değildir. Kaynak başına hata diğer belgeyi kesmez. Çıktıda kaynak URL, kaynak sahibi, SHA, encoding, adaptör/yetenek, provenance ve REVIEW_REQUIRED bulunur. Eksik işveren, tarih, ilçe, şart, nitelik kodu, KPSS, başvuru yöntemi null/eksik kalır. Link keşfi bir Announcement değildir.

## API, admin ve mobil

Yeni/gelişen dosyalar: `source_adapters.py`, `test_source_adapters.py`; API `source-adapter-contract.ts`, `gazette.ts`, `source-operations.ts`, `worker.ts`, `announcement-status.ts`, `announcement-identity.ts`, `announcement-filters.ts`, `announcement-admin.ts`, `announcements.controller.ts`, `candidate.ts`; admin `MultiSourceReview.tsx`, `SourceStatus.tsx`, `AnnouncementReview.tsx`; mobil `lib/announcement-api.ts`, `app/announcements.tsx`. ÖSYM kaynakları ve parser'ları silinmedi.

- `GET /api/v1/admin/source-operations`: izin, adaptör/yetenek, REVIEW_REQUIRED/DISABLED ve son worker durumu.
- `GET /api/v1/admin/gazette-documents/source-reviews`: manuel belge inceleme listesi.
- `POST /api/v1/admin/gazette-documents/source-reviews/:sourceId`: yerel belge + resmî sourceUrl; doğrulanmış ilan yaratmaz.
- `GET /api/v1/admin/gazette-documents/source-reviews/:id/file`: yetkili ham indirme; octet-stream, attachment, nosniff/CSP/no-store, SHA kontrolü.
- `GET /api/v1/admin/announcement-imports/:id/matches`: en son 500 staging satırında kesin kaynak kanıtı önerisi; sınır response'ta bildirilir. Tüm arşivde eksiksiz eşleşme garantisi yok.
- Mevcut `:id/link` yalnızca reviewer/admin tarafından ikinci kaynağı mevcut ilana bağlar ve audit yazar. Otomatik/fuzzy birleştirme yok. Aynı işveren + resmî ilan kimliği/tarih veya aynı SHA + aynı kaynak konumu aranır; tarih/kontenjan çelişkileri gösterilir. Salt benzer başlık yeterli değildir.
- Mevcut draft/review/publish/apply-event akışı, iptal/uzatma bağlantısı, session/RBAC/CSRF korunur. Yeni manuel kaynak belgeleri SourceDocument üzerinde tutulur; yalnızca yükleme/alınma kanıtıdır, admin ilan onay/audit'inin yerine geçmez.

API `applicationStatus`: UPCOMING / OPEN / CLOSED / DATE_UNVERIFIED / REVIEW_REQUIRED / ARCHIVED. Bu türetilmiş bir DTO alanıdır; DB yayın statüsü değiştirilmez. OPEN için kaynak kontrolü, yayın ve geçerli iki tarih gerekir. `view=upcoming|date-unverified` eklendi; mevcut open/archive/all korunur.

Mobil `kpssRequired=false` filtresi **yalnızca açıkça doğrulanmış false** şartını eşler; eksik KPSS bilgisi KPSS'siz sayılmaz. `employmentType=CIVIL_SERVANT|CONTRACTED|WORKER|ACADEMIC` aynı doğrulanmış kadronun JSON şartlarında saklanır. Yeni kolon gerekmedi. Eski kayıtta alan yoksa tür filtresinde görünmez; tahmin yapılmaz. Admin kadro editörü aynı enum'u doğrular. District ve timezone'lu announcedAt manuel staging alanları da desteklenir.

Üç eğitim, puan/tür, doğrulanmış bölüm kodu, il, kurum, unvan, bitiş, başvuru durumu ve istihdam filtreleri; stale veriyi temizleme, 15sn timeout/abort/retry, response/pagination doğrulama test edildi. Bölüm adı eşdeğerliği/nitelik kodu tahmin edilmez. Expo SDK54 ve paket adı korunur. Fiziksel Android testi yapılmadı.

## Worker deployment tasarımı

HTTP Free servis: `PROCESS_ROLE=api`, `SOURCE_SYNC_ENABLED=false`, `NOTIFICATIONS_ENABLED=false`, `DOCUMENT_UPLOADS_ENABLED=false`, `SOURCE_WORKER_ONCE=false`. Kaynakları açık tutmak için API'ye ping atma veya uyku engeli aşma yöntemi kullanılmaz.

Sürekli worker, ancak ayrı onay ve kalıcı ortamla: `node apps/api/dist/worker.js`, `PROCESS_ROLE=source-worker`, `SOURCE_SYNC_ENABLED=true`, `SOURCE_WORKER_ONCE=false`. Push worker ayrı PROCESS_ROLE ile çalışır. PostgreSQL advisory lock, kaynak bazlı backoff/last-success/hata metrikleri korunur; bir dispatcher hatası diğer kaynağı kesmez.

Dış scheduler/Render cron için aynı komutun `SOURCE_WORKER_ONCE=true` modu kaynak turunu bitirip process'i kapatır; ERROR halinde exit1. Registry yine kapalıysa 0 kaynak koşar. Sadece Enerji RSS'nin mevcut canlı worker yolu desteklidir; diğer adaptörler manuel belge işleme içindir. İzin verilmesi tek başına SBB/Kariyer/İŞKUR canlı adapter'ını var etmez. Her kaynakta hem teknik sözleşme hem izin hem ayrı aktivasyon gerekir.

[Render Free](https://render.com/docs/free) 15 dakika trafik yokluğunda uyur ve kalıcı disk sağlamaz; kritik tarama burada çalıştırılmaz. [Background workers](https://render.com/docs/background-workers) ayrı süreçlerdir. [Cron jobs](https://render.com/docs/cronjobs) biten komut gerektirir, UTC kullanır ve kalıcı diske erişmez. Bu yüzden belge makbuzlarının kalıcı depolanması cron deployment öncesi ayrıca çözülmelidir. Fiyat/hesap oluşturma veya servis aktivasyonu yapılmadı.

## Ölçüm ve test sonuçları

Bu sprint **yeni indirilen ilan PDF'si 0**. Önceki doğrudan indirilmiş 1 PDF + 2 HTML + RSS yeniden kullanıldı; yeni canlı toplama gibi sayılmaz. Gerçek belge izole testi: 2 ilan /20 kadro, staging2, test onayı2, test yayını2, API detayında20 kadro; tekrar0 yeni/2 duplicate; kesin tarih yok → açık0. RSS100 kayıt/1 bağlantısız aday → kaynak inceleme1/ilan staging0. Eski 140 sayfalık PDF ayrı regresyondur. Production yazımı/yayın0, gerçek scheduler koşusu0, gerçek push0, Android cihaz kontrolü0.

- Python: 56 ana +5 eski parser =61 PASS, skip yok. Önceki toplu test onay engeli bu sprintte kalktı ve testler çalıştırıldı.
- Günlük izole PostgreSQL: 15 test grubu PASS; gerçek PDF, eski504 snapshot, yeni çok kaynaklı manuel API, CSRF/RBAC, kaynak izolasyonu, status/filtre, mükerrer önerisi/manual audit, worker ve mobil ağ dahil.
- Son tarih/worker düzenlemeleri ayrıca odaklı izole suite ile kontrol edilir; rapor `focused-test-report.json`.
- ÖSYM:21 gerçek belge/8611 test onaylı kayıt, gerçek pg_dump/ayrı pg_restore, pilot504 korunması, yeniden import tam veri/audit eşitliği PASS. Negatif testsiz yedek ve bozuk dump girişimleri beklendiği gibi reddedildi.
- Windows ACL: PowerShell5.1.22621.6133 ve7.6.5 PASS; wrapper AST, özel DACL, owner/child/new-file erişimi, idempotence ve fail-closed. Production bağlantısı yok.
- API/admin build ve mobil tsc PASS; mevcut Edge browser24 kontrol PASS (sentetik, fiziksel cihaz değil). Yeni mobil/çok kaynaklı admin ekranlarına fiziksel cihaz testi iddia edilmez.
- Secret taraması0 bulgu, diff whitespace kontrolü PASS. CI'a yeni Node ve Windows matrix testleri eklendi; GitHub Actions koşusu bu görevde yapılmadı. Son Docker image yeniden build edilmedi/deploy edilmedi.

Özel kanıt: `.local/daily-operation/test-report.json`, `focused-test-report.json`, `.local/osym-production/isolated-test.json`, `.local/multisource/{gazette,energy}-adapter.json`.

Son production public GET gözlemi: 26 Ekim 2026 15:54:52 UTC, health/history/announcements üçü de20sn timeout. Mevcut production kayıt sayısı bu kontrolde **UNKNOWN**; önceki13:34 UTC gözlemindeki0 tarihsel kayıt yeni sonuç sayılmaz. Production DB staging/migration veya secret kontrolü yapılmadı.

## Kalan engeller

Kaynakların yazılı kullanım/yeniden yayın kanıtı, izinli platformların gerçek detay/API sözleşmeleri ve canlı adapter'ları; kalıcı belge depolama/backup ve sürekli worker planı; production public erişim/health tekrar kontrolü; release commit/push/deployment onayı; gerçek DB preflight/backup/aktarım onayı; yeni Android build/cihaz ve Google Play işlemleri. Güvenli operatör sırası ve onay kapıları `PRODUCTION_RELEASE_CHECKLIST.md` ve `RENDER_OSYM_DATA_IMPORT.md` içindedir.
