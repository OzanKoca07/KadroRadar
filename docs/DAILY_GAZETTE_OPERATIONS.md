# Günlük Resmî Gazete ve yayın operasyonu

Güncel kapsam düzeltmesi: `ANNOUNCEMENT_INDEXING_POLICY.md`. Olgusal indeksleme ve resmî link gösterimi, tam PDF/HTML/metin yayımından ayrıdır. Scheduler artık iki VERIFIED izin aramaz; ayrı otomatik erişim değerlendirmesi + destekli adaptör + operatör aktivasyonu kullanır. REVIEW_REQUIRED yasak tespiti değildir. Public metin/alıntı yayımı kapalıdır; admin özel inceleme sürer. Aşağıdaki önceki araştırma/test sonuçları tarihsel kanıttır.

26 Ekim 2026. `feature/announcements-core` üzerinde gerçek yazılım geliştirmesi ve izole test teslimidir. Production deployment, canlı günlük toplama, insan editoryal onayı veya Android cihaz kabulü değildir. Başlangıç Git durumu temizdi; önceki release commit'i ve mevcut uygulama korundu.

## Gerçek kaynak araştırması ve izin sınırı

Resmî ana adres: https://www.resmigazete.gov.tr/ . Web aracının erişebildiği resmî fihrist görünümü https://resmigazete.gov.tr/:/ üzerinde **26 Ekim 2026 / 33412** başlığını ve aşağıdaki gerçek bağlantıları gösterdi:

- Günlük PDF: https://www.resmigazete.gov.tr/eskiler/2026/10/20261026.pdf
- Çeşitli İlânlar HTML: https://www.resmigazete.gov.tr/ilanlar/eskiilanlar/2026/10/20261026-4.htm
- Önceki sayı için gözlenen gezinme adresi: https://resmigazete.gov.tr/25.10.2026

Bu bağlantılar gözlenen örneklerdir; başka günler için URL üretilmez. PDF ve ilan HTML'si web aracında TIMEOUT verdi. Yerel makinede ana adres ve robots.txt HEAD denemeleri 15 saniyede, sıfır yanıt byte'ıyla curl28 TIMEOUT oldu. Bu sonuç **403/429 veya TLS sertifika hatası kanıtı değildir**; hangi alt ağ/TLS aşamasında takıldığı kesinleştirilemedi. Başka host, proxy, sahte tarayıcı kimliği veya sertifika kontrolünü kapatma yöntemiyle erişim engeli aşılmadı.

Son, sekiz saniyeyle sınırlı HEAD teşhisinde DNS=0,009s, TCP=0,103s, TLS=0,251s, HTTP=000 ve remote IP212.174.186.1 gözlendi. Dolayısıyla bu denemede DNS çözümlemesi, TCP ve TLS tamamlandı; **HTTP yanıtı beklenirken zaman aşımı** oldu. Sertifika doğrulama hatası veya HTTP403/429 gözlenmedi. Önceki genel timeout'un alt aşaması bu ek ölçümle netleştirildi.

Fihristin footer'ı tüm hakların saklı olduğunu ve gizlilik/kullanım/telif kurallarını belirtir. Otomatik erişim ve yeniden kullanım için açık izin metni doğrulanamadı. `packages/official-sources.json` içinde mevcut gazette `enabled=false` ve `UNVERIFIED` izinleri korundu; uygulama yalnızca manuel import sunar. Robot dosyasının okunamaması izin olarak yorumlanmadı. Gerçek bir mükerrer sayı belgesi bu görevde indirilmedi; açık başlıktaki mükerrer numarası ayrıştırması sentetik testle doğrulandı. Arama ekranındaki “Mükerrer” seçeneği sayı niteliği sayılmaz.

## Tamamlanan akış

1. Yetkili editör erişim hakkına sahip olduğu günlük fihrist HTML dosyasını, gerçek fihrist URL'siyle admin üzerinden yükler. Ağ isteği yapılmaz. Tarih/sayı, açık mükerrer numarası, fiilen bulunan HTTPS PDF/HTML bağlantıları ve ilan alt bölümleri çıkarılır. Metadata yoksa UNKNOWN/inceleme uyarısı kalır. Ham dosyanın SHA-256'sı ve özel kaynak kopyası tutulur; aynı byte'lar aynı SourceDocument kaydına gider.
2. Editör fihristte görülen belge URL'sini seçip yerel PDF veya UTF-8 HTML ilanını yükler. Tam host/HTTPS kontrolü, seçilen fihristte link bulunması ve her iki belgede mevcut tarih/sayıların uyuşması kontrol edilir. Dosya hiçbir durumda otomatik indirilmez. Fihristsiz yerel PDF yükleme korunmuştur; çevrimiçi kaynak yoksa resmî URL uydurulmaz. HTML ilanında resmî kaynak URL'si zorunludur.
3. PDF parser'ı tüm sayfaları inceler, çok sayfalı mevcut gruplamayı korur. HTML parser'ı kurum başlıklarına göre gruplar, script/style metinlerini ve dış kaynakları yok sayar; ihale/yargı içeriğini ayrı tutar. HTML tabloları da kadro satırlarına çevrilir. HTML'deki page1 mantıksal kaynak bölümü olup fiziksel PDF sayfası değildir; format ve konum türü kanıtta açıkça saklanır. HTML karakter kodlaması UTF-8 olmalıdır; hatalı çözümleme reddedilir.
4. KPSSP3 / KPSS P3 / P93 / P94 biçimleri desteklenir. Eğitim ve puan türü çelişkisi kesin uygunluğa dönüşmez. Eksik tarihler null/UNKNOWN kalır; yayın tarihi başvuru tarihi yerine kullanılmaz. Çelişen veya geçersiz başvuru tarihleri son görülen değerle ezilmez. Mezuniyet eşdeğerliği, eksik koşullar ve tablo kapsamı insan incelemesine bırakılır.
5. SHA ve aday kimliği mevcut staging/audit mekanizmasına yazılır. İkinci aynı import duplicate olur. Parser hiçbir ilanı otomatik onaylamaz veya yayımlamaz. OCR yalnızca açıkça seçilen işaretli PDF sayfalarında inceleme kanıtıdır; kanonik alanları değiştirmez. PDF başına ve tablo başına çıkarım eksikleri açık uyarılardır; tüm kamu ilan türleri için tam kapsam iddiası yoktur.
6. Reviewer belge/kadro/uyarı teyitleri ve kaynak notuyla onaylar, sonra ayrı adımda yayımlar. İçerik değişirse onay geçersizleşir. Yeniden yayımlamada kaldırılmış kadrolar temizlenir; kaldırılmış tarih ve başvuru URL'leri eski değerlerini korumaz. Aynı gerçek ilanın farklı belgelerindeki revizyonları başlık benzerliğiyle otomatik birleştirmek yerine mevcut manuel kaynak bağlama kullanılır.
7. Düzeltme/iptal adayı yeni işe alım ilanı olarak yayımlanamaz. Reviewer mevcut ilan kimliğiyle `apply-event` kullanır. İptal yalnızca cancellation; uzatma yalnızca correction kaynağıyla ve daha ileri, açık saat dilimli bitiş tarihiyle uygulanır. Kaynak teyidi, en az20 karakter not, sürüm kontrolü, kaynak referansı ve önceki/yeni tarih audit'i zorunludur. Yinelenen event reddedilir. Favoriler aynı ilan kaydını izlemeye devam eder.
8. Public API yalnızca yayımlanmış ve kaynaktan kontrol edilmiş ilanları sunar. Güncel görünümde başlangıç ve bitiş bilinmeli ve başvuru açık olmalıdır. Süresi bitenler sorgu anında arşiv görünümündedir; ayrı bir scheduler çalışmasına bağlı değildir. Tarihi bilinmeyen ilan detayda/all görünümünde bulunabilir, açık ilan sayılmaz.

Özel kaynaklar retention ile saklanır; süre varsayılan30, aralık1–90 gün. Toplam yerel kota1GiB; PDF64MiB/600 sayfa, HTML2MB. Ham HTML hiçbir zaman çalıştırılmaz: yetkili kaynak endpoint'i `text/plain`, `nosniff`, CSP sandbox ve no-store döndürür. Fihrist ve ilan SHA bütünlüğü kaynak görüntülemede tekrar kontrol edilir. HTML yerel blob'u admin iframe'inde çalıştırılmaz. Kaynak/audit kayıtları dosya retention'ı dolsa da korunur. Kotalar ve parser kapasitesi süreç bazlıdır; çok worker'lı belge işleme için ortak depolama/kuyruk kurulmadan yatay upload ölçeklemesi açılmamalıdır.

## API ve mobil

Başlıca değişen dosyalar:

| İşlev | Dosyalar |
|---|---|
| Yerel fihrist / HTML / PDF çıkarımı | `services/ingest/official_gazette.py`, `test_official_gazette.py` |
| Özel kaynak, SHA, staging | `apps/api/src/gazette.ts`, `apps/api/prisma/schema.prisma`, yeni migration |
| Onay, yayın, revizyon, iptal | `apps/api/src/announcement-admin.ts`, `apps/admin/src/AnnouncementReview.tsx`, `GazetteUpload.tsx` |
| Kadro filtreleri ve belirsizlik | `apps/api/src/announcement-filters.ts`, `announcements.controller.ts`, `eligibility.ts` |
| Mobil liste/detay | `apps/mobile/app/announcements.tsx`, `app/announcement/[id].tsx` |
| Worker ayrımı / retry / bildirim | `apps/api/src/worker.ts`, `process-role.ts`, `source-operations.ts`, `notification-plan.ts`, `notifications.ts`, `environment.ts` |
| Güvenlik / regresyon / işletim | `apps/api/test-daily-announcements.cjs`, genişletilen mevcut testler, `infra/test-daily-operation.cjs`, CI, Dockerfile, `.env.example`, Render belgesi |

Yeni/uzatılan rotalar:

- GET/POST `/api/v1/admin/gazette-documents/indexes`: yetkili fihrist listesi / multipart `file` + `indexUrl`.
- GET `/api/v1/admin/gazette-documents/indexes/:id/file`: özel, hash kontrollü ham HTML metni.
- POST `/api/v1/admin/gazette-documents`: multipart `file`, isteğe bağlı `sourceUrl`, `indexDocumentId`. HTML ilanında sourceUrl zorunlu. Mevcut PDF/OCR/özel kaynak rotaları korunur.
- POST `/api/v1/admin/announcement-imports/:id/apply-event`: `{version, announcementId, action:"EXTEND"|"WITHDRAW", documentVerified:true, evidence, applicationEndAt?}`. Yalnızca REVIEWER / SYSTEM_ADMIN; oturum, CSRF ve sunucu tarafı RBAC uygulanır.
- GET `/api/v1/announcements`: mevcut `view`, `city`, `organization`, `q`, `page`, `limit` yanına `educationLevel=LISANS|ONLISANS|ORTAOGRETIM`, `kpssScoreType=P3|P93|P94`, `kpssScore=0..100`, `degreeCode`, `positionTitle`, `deadlineBefore=YYYY-MM-DD` eklenir. Son tarih sınırı İstanbul gün sonudur.

Eğitim/puan/bölüm/kadro filtreleri **aynı verifiedAt dolu kadroda** birleşir; farklı satırların koşulları karıştırılmaz. Bölüm filtresi yalnızca `degreeCodesVerified=true` ve tam resmî bölüm koduyla çalışır; serbest bölüm adı veya tahmini eşdeğerlik eşleştirilmez. Puan filtresi, bilinen minimumu kullanıcı puanını aşmayan kadroları arar; koşulların tümü için kesin uygunluk kararı değildir.

Mobil Güncel İlanlar ekranında bu alanlar ve filtre uygula/temizle eklendi. Hata halinde filtreler düzenlenebilir; loading/eski veri karışması önlenir. Detayda resmî kaynak, son doğrulama zamanı, kaynak hash'i, HTML/PDF ayrımı ve allowlist'te bulunan resmî başvuru bağlantısı gösterilir. Kaynak registry'sinde bulunmayan kurum alan adı operatörce doğrulanmadan başvuru linki olarak kabul edilmez. SDK54 ve Android paket kimliği değiştirilmedi.

## Scheduler / push süreçleri

Varsayılan `PROCESS_ROLE=api`; HTTP servisi background timer başlatmaz. Açıkça `combined` seçilirse önceki tek süreç düzeni kullanılabilir. Kalıcı production ortamında ayrı süreçler:

| Süreç | PROCESS_ROLE | Açık olması gereken bayrak | Komut |
|---|---|---|---|
| HTTP | api | İhtiyaca göre upload; scheduler/push kapalı | `node apps/api/dist/main.js` |
| Kaynak worker | source-worker | SOURCE_SYNC_ENABLED=true | `node apps/api/dist/worker.js` |
| Push worker | push-worker | NOTIFICATIONS_ENABLED=true | `node apps/api/dist/worker.js` |

Ortak gerçek DATABASE_URL, NODE_ENV=production ve geçerli HTTPS CORS_ORIGINS dışarıdan sağlanır. Aynı DB'yi paylaşan source worker'lar PostgreSQL advisory lock ile çakışmaz. Registry'nin enabled + iki VERIFIED izni **ayrıca** gereklidir; bayrak açmak izin kapısını geçmez. Gazete için canlı adapter/scheduler bu izin belirsizliğinde etkinleştirilmemiştir; yalnızca manuel import hazırdır. Kaynak scheduler'ında mevcut desteklenen izinli RSS adapter'ı korunur.

Kaynak bazlı son deneme/başarı, exponential backoff (1 dakika–24 saat), hata kodu, ardışık hata, başarılı/başarısız tamamlanan çalışma sayıları DB'de tutulur. Kilit meşgul ve backoff nedeniyle atlanan çağrılar tamamlanan çalışma sayılmaz. `source_sync_error` yapılandırılmış log uyarısı üretir; haricî e-posta/Slack/monitor bildirimi bağlı değildir. Admin sağlık görünümü bu durumu gösterir. Sağlık yanıtındaki worker bayrakları sorgulanan sürecin rolünü belirtir; ayrı worker'ın varlığını HTTP sürecinde true olarak göstermez.

Push kullanıcı rızası, günlük2/haftalık7 sınırı, kalıcı eventKey unique, atomik PENDING→SENDING claim ve gönderim öncesi tekrar doğrulama kullanır. Kaynak kontrolü bekleyen favori bildirim üretmez. Uzatmanın lastKnownEndAt değeri artık kuyruğa alma sırasında değil sağlayıcı kabulünden sonra güncellenir; aksi halde bildirim kendi kendisini ilgisiz sayıyordu. Belirsiz eşleşmeye “uygun” push gönderilmez. Ağ sonucu belirsiz gönderimler UNKNOWN olur ve mükerrer göndermemek için otomatik yeniden denenmez; bu, teslim garantisi değildir.

Render Free üzerinde worker/scheduler'a güvenilmez. Dört Free bayrağı kapalı kalır: DOCUMENT_UPLOADS_ENABLED, SOURCE_SYNC_ENABLED, NOTIFICATIONS_ENABLED, ALLOW_SELF_REGISTRATION. Kalıcı özel depolama, kesintisiz worker, işletmeci kaynak izinleri, dış hata izleme ve Expo credential/gerçek cihaz testi ayrıca kurulmalıdır. Docker worker olarak çalıştırılırken HTTP sağlık kontrolü devre dışı bırakılmalı veya worker'a özgü heartbeat izlenmelidir; worker HTTP portu açmaz.

## Migration ve veri koruma

Yeni `202610270001_gazette_index/migration.sql` yalnızca `SourceDocument.gazetteEvidence JSONB` nullable sütununu ekler. SQL incelendi; veri silme, seed veya mevcut satır güncelleme yoktur. Toplam15 migration yalnızca yeni, rastgele adlı test container'ına uygulandı. Gerçek yerel PostgreSQL container'ı başlatılmadı. Gerçek DB migration'ı için ayrı kullanıcı onayı gerekir.

`infra/test-daily-operation.cjs` mevcut DATABASE_URL'yi kullanmaz; kendi yalnızca loopback portuna bağlı, tmpfs PostgreSQL'ini kurar. İsteğe bağlı özel yedek yalnızca test DB'ye restore edilir. Eski504 satırın bütün alanları/id/puan/onay bilgileri test öncesi/sonrası karşılaştırıldı ve yedek byte hash'i değişmedi. Test sonunda yalnızca kendisinin oluşturduğu doğrulanmış isimli container silinir.

## Kabul metrikleri: canlı, yerel gerçek ve sentetik ayrımı

| Metrik | Sonuç | Kanıtın kapsamı |
|---|---:|---|
| Araştırmada gözlenen gerçek günlük yayın | 1 | 26.10.2026 /33412 resmî web fihristi; production keşif koşusu değildir |
| Otomatik erişim / yeniden kullanım izni | UNVERIFIED / UNVERIFIED | Registry kapalı |
| Bu görevde canlı indirilen PDF | 0 | PDF/ilan HTML bağlantıları TIMEOUT |
| Kullanıcının gerçek yerel PDF'si | 1 | 24.09.2026 /33380,140 sayfa |
| Yerel gerçek PDF SHA-256 | 050f756d5475090556dc4981709a760fd9776d1589584b902506de4486300dca | Kaynak byte'ları |
| Ayrıştırılan gerçek yerel ilan adayı | 6 | Hepsi insan incelemesi gerektirir |
| Ayrıştırılan gerçek yerel kadro satırı | 12 | Tam pozisyon kapsamı otomatik doğrulanmış değildir |
| Gerçek yerel PDF'den staging | 6 | İzole PostgreSQL |
| Aynı PDF ikinci import | 6 duplicate,0 yeni | İzole PostgreSQL |
| Onaylanan / yayımlanan | 2 /2 | Niğde ve Atalan için **simüle test onayı**, insan editoryal kabulü değildir |
| Public mobil API sözleşmesinde okunan | 2 ilan /9 kadro | İzole HTTP list/detail; güncel açık ilan değildir |
| Bu gerçek PDF'den açık güncel ilan | 0 | Niğde süresi geçmiş arşiv; Atalan tarih/saat belirsiz |
| OCR denenen / başarılı | 1 /1 sayfa | Gerçek PDF'nin işaretli1.sayfası, Tesseract tur+eng; kanonik değişiklik0 |
| Gerçek günlük Gazete scheduler başarılı / başarısız | 0 /0 | Kapalı; timeout araştırmaları scheduler koşusu değildir |
| Scheduler mekanizma testi başarılı / başarısız | 2 /1 | Sentetik RSS adapter'ı; ayrıca BUSY/BACKOFF ve izin reddi |
| Production staging/onay/yayın | 0 /0 /0 | Production bağlantısı kurulmadı |
| Gerçek Android cihaz kontrolü | 0 | Fiziksel cihazda bu sürüm doğrulanmadı |

Sentetik HTML/PDF fihrist, normal/mükerrer başlık, yanlış kaynak/tarih, KPSS filtreleri, iptal ve uzatma testleri canlı veri toplama değildir. Expo gönderim/receipt testlerinde fetch taklittir; gerçek push sayısı0.

## Testler ve tekrar çalıştırma

- Python ana ingest suite43/43 ve eski tarihsel parser5/5: toplam48 PASS. Gerçek Gazete ve mevcut ÖSYM dosyalarıyla çalıştırıldı; skip0. Gazete alt kümesi19 testtir.
- İzole PostgreSQL'de `test-daily-announcements`, `test-gazette`, `test-source-operations`, `test-notification-plan`, `test-notification-worker`, `test-eligibility`, `test-candidate`, `test-environment`, `test-ingestion`, `test-mobile-network`, `test-admin-browser` PASS. Gerçek PDF ve sentetik kaynakların kapsamı yukarıdadır. İki push servis örneğiyle aynı uzatma için tek sağlayıcı gönderimi doğrulandı.
- Playwright/kurulu Edge:24 kontrol PASS; yeni fihrist kaydetme/bağlantı seçme, eski PDF inceleme ve geçmiş atama akışı korunur. Fiziksel Android testi değildir.
- API/admin build ve mobil TypeScript PASS. Secret taraması0 bulgu, diff whitespace kontrolü PASS. CI dosyasına yeni test eklendi; uzak GitHub Actions sonucu bu görevde doğrulanmadı.
- Docker build ve boş DB/15 migration/health testi PASS. Test edilen image `sha256:1ed91f965048f99ec01d718f07644405d8fe7ed965fa211ac4b8dbe0994f03ab`; PORT10000, kapalı Free bayrakları, admin/legal sayfalar, idempotent migration, provisioning, DB kesintisinde503 ve düzelince200 doğrulandı. Sonuç `.local/release/render-readiness.json` içinde tutulur; deployment kanıtı değildir.

```powershell
$env:GAZETTE_REAL_PDF='C:\path\resmi gazete.pdf'
$env:OSYM_REAL_CATALOG=(Resolve-Path .local/osym-expansion/catalog.json).Path
python -m unittest discover -s services/ingest -p 'test_*.py' -v
python -m unittest discover -s services/ingest/tests -v
pnpm --filter @kadro/api prisma:generate
pnpm --filter @kadro/api build
# İsteğe bağlı: yalnızca test kopyasına restore edilir, orijinal yedek korunur.
$env:DAILY_BASELINE_BACKUP='C:\path\private-local-backup.dump'
node infra/test-daily-operation.cjs
```

Özel test çıktıları `.local/daily-operation/test-report.json` ve `real-parser-ocr.json`; ham PDF/metin, yerel dosya yolları ve özel dump'lar Git'e eklenmez. Tüm kaynaklara erişildiği, günlük production yayının açıldığı veya bütün ilan türlerinin eksiksiz otomatik ayrıştırıldığı iddia edilmez.
