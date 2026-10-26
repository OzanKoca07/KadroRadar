# Periyodik ilan kontrolü — 96/48 saat

26 Ekim 2026. **TESTED_LOCALLY**; **ACTIVE değil**. Production kaynak aktivasyonu, scheduler/ücretli servis oluşturma, ÖSYM aktarımı ve APK/AAB üretimi yapılmadı.

Kod GitHub'a gönderildi: `998deb00efc3540cac7f7c1ea18f5fb7d4d6aa3d`. [CI40376209466](https://github.com/OzanKoca07/KadroRadar/actions/runs/40376209466) altı job ile PASS. Bu GitHub testidir; Render DEPLOYED veya canlı scheduler ACTIVE olduğu anlamına gelmez. Deployment erişim engeli ve manuel adımlar `GITHUB_RENDER_RELEASE_REPORT.md` içindedir.

## Yapılandırma

| Değişken | Varsayılan / işlev |
|---|---|
| ANNOUNCEMENT_SCAN_INTERVAL_HOURS | 96; 48 yapılabilir. Pozitif tam sayı1–8760 |
| ANNOUNCEMENT_SCAN_MODE | scheduled; güvenilir one-shot operatör için manual da kabul edilir |
| PROCESS_ROLE | HTTP servisinde api; ayrı görevde source-worker |
| SOURCE_SYNC_ENABLED | HTTP/Free varsayılanı false |
| SOURCE_WORKER_ONCE | HTTP varsayılanı false; dış görev için true |

İki gün için yalnızca interval48 yapılır. PostgreSQL'deki lastSuccessAt üzerinden süre yeniden hesaplandığı için önceki96 saatlik nextAttemptAt değeri değişikliği engellemez. Kaynak asgari hız sınırı daha uzunsa o da korunur. Süre takvim günü değil geçen saattir; yeniden başlatma, ay sonu ve timezone değişikliği süreyi sıfırlamaz.

## Akış ve güvenlik

- Mevcut SourceSyncState kullanılır; **yeni migration yok**. lastAttemptAt, lastSuccessAt, hata/backoff ve PostgreSQL advisory lock korunur.
- manual: mevcut `POST /api/v1/admin/source-operations/:id/run`, SYSTEM_ADMIN + session/CSRF. Worker bayrağı kapalıyken bile route yetki ve kaynak aktivasyonu ister; bu sprint kaynaklar kapalıdır. Manual süre/hız kapısını zorla atlamaz.
- scheduled: dış ortamda `node apps/api/dist/worker.js`, açık source-worker rolü ve enable bayrağıyla one-shot. HTTP listener yok; public tetikleme URL'si eklenmedi. DB secret'ı yalnızca güvenilir runner secret deposundan alınır; komut argümanı/Git/loglara konmaz.
- Önce kapalı kaynak/erişim değerlendirmesi ve destekli adaptör kontrol edilir. Advisory lock alındıktan sonra due/backoff tekrar okunur. Süre dolmadıysa NOT_DUE; hata beklemesinde BACKOFF; ikinci worker BUSY döner, kaynağa gitmez.
- Başarılı kontrol sonrası sonraki uygun zaman lastSuccessAt+interval olarak kaydedilir. Hata lastSuccessAt'i değiştirmez; kaynak minimumu ve artan backoff uygulanır. Bir kaynak hatası diğerini durdurmaz.
- Aynı URL/içerik staging'de duplicate olur. Yeni kayıt PENDING_REVIEW kalır; onay, yayın veya OPEN otomatik üretilmez. Kaynaklar arası eşleşme mevcut ihtiyatlı öneri/reviewer ilişkilendirmesiyle sürer.
- Linki olmayan RSS adayları kaybolmaz: SourceDocument OFFICIAL_FEED_REVIEW içinde başlık, ham item referansı ve SHA ile kaynak incelemesine alınır. Aynı SHA yeniden belge oluşturmaz. Bu kayıt bir yayımlanmış Announcement değildir.
- Son10 başarılı makbuz ve son hata, sayımlar ve kaynak hash'i metrics JSON'da kalıcıdır. Full RSS/PDF içeriği PostgreSQL makbuzuna konmaz. Ham dosya saklanmadıysa rawRetained=false; admin dosya endpoint'i410 döndürebilir. Tam metin public API'ye çıkmaz.
- ETag/Last-Modified dosya cache'i kaybolabilir; esas due/idempotency kontrolü PostgreSQL'dedir. Kalıcı ham belge/cache gerekiyorsa ayrıca onaylı depolama planı gerekir.

## Kaynakların gerçek durumu

| Kaynak | Teknik destek | Aktivasyon / bu sprint gerçek koşu |
|---|---|---|
| Enerji RSS | Canlı okuma adapter'ı; robots/TLS/host kontrolleri. Advertised feed okuma kapsamı ALLOWED | enabled=false /0 |
| Gazete | Gerçek yerel PDF/HTML ve fihrist parser'ı | Canlı worker desteklenmiyor, REVIEW_REQUIRED /0 |
| SBB | Yerel HTML bağlantı keşfi; canlı erişim403 gözlemi | Scraper değildir /0 |
| Kariyer Kapısı | Yerel HTML bağlantı keşfi | Scraper değildir /0 |
| İŞKUR | Yerel HTML bağlantı keşfi | Scraper değildir /0 |

REVIEW_REQUIRED hukuki yasak tespiti değildir. `ANNOUNCEMENT_INDEXING_POLICY.md` uygulanır: olgusal bilgi/resmî link ile tam belge yayımı ayrıdır. Robots disallow, CAPTCHA, login,403/429 veya TLS engeli aşılmaz. Full belge yayım izni indekslemenin genel ön şartı değildir.

## Dış zamanlayıcı seçimi

[Render Cron](https://render.com/docs/cronjobs): yönetilen biten görev, UTC ve servis bazında tek koşu; kalıcı disk yok ve ücretlidir. Bu görevde oluşturulmadı. [Render Free](https://render.com/docs/free) HTTP servisi uyuduğu için günlük kontrol ona bağlanmaz.

Dış güvenilir runner: mevcut image/one-shot komutunu ayrı süreçte çalıştırabilir; ağ/secret yönetimi, retry ve gözlem runner sahibine aittir. HTTP admin endpoint'ine kimliksiz cron çağrısı tasarlanmadı. GitHub Actions kaynak tarama workflow'u bu sprintte eklenmedi/aktif edilmedi; mevcut CI yalnızca testtir.

96 saati `*/4` day-of-month cron ifadesiyle modellemeyin; ay sınırlarında96 saat değildir. Dış tetikleyici örneğin günde bir uyandırıp PostgreSQL due kapısına bırakılabilir; gerçek kaynak okuması96 saatte bir olur, çalıştırma gecikmesi tetikleme aralığı kadar olabilir. Kesin96 saat istendiğinde runner ardışık başarıdan96 saat sonra tetiklemelidir; yine DB kilidi/idempotency korunur.48 saate geçiş uygulama env'iyle yapılır. Bu seçeneklerin hiçbiri şu anda ACTIVE değildir.

## Test kanıtı

Yeni `test-announcement-scan.cjs`: sentetik saat ve izole PostgreSQL ile96/48 saat; aralık düşürme; manuel/scheduled makbuz; kaynak kapalı/erişim değerlendirmesi;95.saatte hiç çağrı olmaması;96.saatte duplicate/no-change;4 gün sonunda yeni PENDING_REVIEW; iki worker tek işlem;429 backoff; son başarının hata sırasında korunması; linki eksik kaynağın inceleme kuyruğu PASS.

Toplam17 izole test grubu PASS; eski16 grup korunur. One-shot kapanması, auth401/editor403, kaynak izolasyonu, public metin filtreleme, uzatma/iptal, favoriler, CSRF/session ve eski504 tam snapshot PASS. Sentetik adaptör/zaman başarıları canlı tarama değildir. Önceki gerçek indirme paketinin2 ilan/20 kadrosu ayrıca izole akıştan geçti; bu sprint yeni ilan PDF indirmedi.

API/admin/mobile derlemeleri PASS. Python58+5 test çalıştı; ilk çalışmada real catalog env eksik olduğundan1 test skip oldu, ardından gerçek katalogla11 arşiv testi yeniden çalıştırıldı ve skip0/PASS. ACL PowerShell5.1/7 PASS. Docker image/readiness PASS; ilk geçici DB başlangıç yarışı TCP readiness ile giderildi. Secret/whitespace kontrolü PASS.

Özel kanıtlar `.local/daily-operation/test-report.json`, `.local/daily-operation/focused-test-report.json`, `.local/release/render-readiness.json`. Production makbuzu/gerçek scheduler koşusu0.8611 ÖSYM production aktarımı yapılmadı.
