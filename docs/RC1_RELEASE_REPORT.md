# KadroRadar RC1 —25 Ekim2026

Bu rapor yerel yazılım/test kanıtını deployment, mağaza dağıtımı ve gerçek cihaz kanıtından ayırır. Git başlangıç durumu incelendi; mevcut karma kullanıcı değişiklikleri resetlenmedi, commit/push yapılmadı. SDK54, RN0.81.5, React19, Android `com.kadroradar.app`, EAS project `44bbc3b8-3306-4b9a-91c6-74a2eb2e0877` korundu.

## Kabul tablosu

| Alan | Durum | Kanıt / sınır |
| --- | --- | --- |
| Prisma generate/validate; API/admin build; mobile TypeScript | DONE_TESTED | Yerel komutlar başarılı; gerçek DB migrate edilmedi |
| Expo Doctor / Android JS export | DONE_TESTED |18/18;1108modül,2.79MB Hermes bundle `.expo/rc1-delivery`; AAB değildir |
| Parser regresyonları | DONE_TESTED |28 RSS/manual/Gazette/ÖSYM testi +5 eski tarihsel test =33 Python testi |
| Gerçek Gazette | DONE_TESTED |1 gerçek yerel PDF,140/140sayfa;6 aday,12 öneri kadro; yalnızca2 ilan/9 satır/30 kontenjan kaynakla doğrulandı |
| Kontrollü OCR | DONE_TESTED |16/16 gerçek işaretli sayfa +1 taranmış sentetik Türkçe sayfa; Windows ve Docker gerçek motor; sayı/metin çakışmaları işaretli; otomatik tablo/doğruluk onayı yok |
| Aday/uygunluk/favori/bildirim kuyruğu | DONE_TESTED |9 uygunluk,8 bildirim plan kontrolü; gerçek PostgreSQL/HTTP candidate/worker/import testleri. Expo send/receipt taklit; cihaz teslimi değil |
| Mobil ağ sözleşmesi | DONE_TESTED |6 senaryo: config yok/offline/500/401/timeout/boş yanıt; render/geri tuşu cihaz testi değil |
| Manuel CSV/JSON | DONE_TESTED |7 dosya okuyucu kontrolü; Türkçe başlık/quoted multiline/bozuk sütun/boyut; admin CSV→staging browser akışı |
| Admin browser | DONE_TESTED |21 Playwright/Edge kontrolü: login/logout, session expiry, cookie/CSRF, rol reddi, CSV, edit/ret/onay/yayın/arşiv/audit, PDF upload ve özel preview, ÖSYM yükleme/özel preview/satır teyidiyle onay |
| ÖSYM yeni admin browser upload/onay | DONE_TESTED |Yeni boş browser DB'de sentetik PDF staging→özel kaynak preview→tam satır-sayısı teyidi→APPROVED; Türkçe klavye erişimi dahil |
| ÖSYM lisans/önlisans/ortaöğretim | DONE_TESTED |Resmî2024/1 PDF'leri504/346/69=919 satır; ayrı DB'de parse→staging→duplicate/RBAC→insan onayı→public filtre/sözleşme. Yerel gerçek DB hâlâ504 |
| ÖSYM webden editör kontrollü aktarım | DONE_TESTED |Resmî sonuç sayfasında3 gerçek PDF bağlantısı; gözlenen tek önlisans PDF'sinin ağdan API→staging aktarımı/duplicate/sourceURL teyidi. Sürekli crawler değildir |
| Kaynak scheduler işletimi | DONE_TESTED |PG advisory lock, izin kapısı, backoff, duplicate, kalıcı health/error/lastSuccess; adaptör ağ kısmı testte taklit edildi.8 kaynağın tümü kapalı |
| Migration / backup restore | DONE_TESTED |12 migration boş test DB'de; gerçek dump ayrı restore DB'de504korundu ve pending migration provası geçti |
| Gerçek DB migration / ilan yazımı | BLOCKED_EXTERNAL |9 migration bekliyor; açık kullanıcı onayı olmadan uygulanmadı; production yazımı0 |
| Docker production image / runtime | DONE_TESTED |Gerçek build; UID1000,PyMuPDF1.27.2.3,Tesseract tur+eng,Prisma DB query, health, kalıcı volume+restart, CORS,429, yerel CA HTTPS, privacy endpoint, Docker16sayfa OCR |
| Production domain / kamuya açık HTTPS | BLOCKED_EXTERNAL |Kullanıcı henüz hosting/domain kurmadığını bildirdi. Yerel CA testi public sertifika/deploy değildir |
| Privacy / hesap silme web yazılımı | DONE_TESTED |`web/` statik sayfalar; gerçek izole cookie/CSRF login→DELETE/account browser testi; profil/session kaldırma ve anonimleştirme |
| Privacy işletmeci/destek/süreler ve yayın | BLOCKED_EXTERNAL |Gerçek bilgiler kullanıcı tarafından daha sonra sağlanacak. Boş alanlar açık uyarı; uydurulmadı |
| EAS production config | DONE_TESTED |SDK36,cleartext kapalı,kimlikler,izin engelleme,HTTPS/legal URL/e-posta config guard; `autoIncrement:true` |
| İmzalı production AAB / Play App Signing | BLOCKED_EXTERNAL |Üretilmedi; gerçek production API/legal metadata/credential ve Play Console kurulumu yok |
| Yeni RC1 gerçek cihaz / FCM teslimi | BLOCKED_EXTERNAL |Bu çalışmada0. Kullanıcı önceki preview APK'yı telefonda test ettiğini bildirdi; yeni RC1 akışlarına eklenmedi |
| Bağımsızlık / kaynak açıklaması | DONE_TESTED |Mobil Hakkında/liste/detay ve legal sayfa; ilgili public API kanıtları. Yeni native ekranlar cihazda görülmedi |
| E-posta sahipliği/parola kurtarma/MFA | NOT_STARTED |Bu RC1'e eklenmedi. Self-registration varsayılan kapalı; gerçek e-posta hizmeti ve kapsam kararı gerekir |
| Kapsamlı penetrasyon/erişilebilirlik/mağaza incelemesi | NOT_STARTED |İşlevsel güvenlik testleri bunların yerine geçmez |

## Gerçek Gazette ve OCR kapsamı

Gerçek PDF: sayı33380,24.09.2026,38.526.722bayt,SHA256 `050f756d5475090556dc4981709a760fd9776d1589584b902506de4486300dca`. Orijinal kullanıcı dosyası değiştirilmedi.

| Aday | PDF sayfaları | Parser satırı | Doğrulama |
| --- | --- | --- | --- |
| Niğde Ömer Halisdemir Üniversitesi |85–89|8/29kontenjan|Kaynakla karşılaştırılmış;24.09.2026 09:00–09.10.2026 13:00+03; süresi geçmiş |
| Atalan Belediyesi |90–92|1/1kontenjan|Kaynakla karşılaştırılmış; global kesin saat belirsiz; OPEN yapılmaz |
| Erzurum Teknik Üniversitesi |64–69|1öneri|Tam kadro kapsamı doğrulanmadı |
| Hatay Mustafa Kemal Üniversitesi |74–79|0|Tablo ayrıştırılmadı, metin truncation ve tarih incelemesi gerekli |
| Kocaeli Üniversitesi |80–84|0|Tablo ayrıştırılmadı, metin truncation ve tarih incelemesi gerekli |
| Kapadokya Üniversitesi |113|2öneri|Tam kadro kapsamı doğrulanmadı |

OCR sayfaları1–8,21–23,62–63,72–73,140.14sayfada sayısal token farklılığı işareti;72–73'te de OCR/table review zorunlu. OCR sonucu native metin ve onaylı kadro/tarih/kontenjan üzerine yazılmaz. Sentetik taranmış sayfada Niğde/üniversitesi/sağlık/P93/29/30 metin kontrolleri geçti; OCR tablo hücresi doğruluğu otomatik ölçülmüş sayılmaz. UNKNOWN ve insan incelemesi korunur.

İlk gerçek OCR koşusu Windows stdout kodlaması ve çok kurumlu sayfa kapsamı hatalarını yakaladı. UTF-8 output file ve çok kurumlu işaretlerin seçimiyle düzeltildi. Sentetik ÖSYM fixture testinde NBSP/yumuşak tire ve hata yolunda açık PDF handle sorunu yakalandı; normalize/handle yaşamı düzeltildi. Bunlar başarıdan önceki gerçek başarısızlıklardır; fixture sonuçları canlı kaynak aktarımı olarak gösterilmedi.

Browser genişletmesinde Türkçe test locator/teyit metninin PowerShell→Python yazımında bozulması ve uzun PDF preview sonrası bölüm açılma kararsızlığı yakalandı. UTF-8 patch, kontrollü bölüm açılması, üstte birlikte gruplanan upload araçları ve inline açık satır-sayısı teyidiyle21kontrol geçti. Çok sayıda yeniden çalıştırma gerçek auth limitini tetikledi; production limiti değiştirilmeden yeni izole DB'de nihai koşu yapıldı. Beklenen CSRF403/session401 browser console kayıtları testin kontrollü negatif senaryolarıdır.

## Değişen dosyalar ve endpoint'ler

- OCR: `services/ingest/official_gazette.py`, `check_ocr_runtime.py`, test dosyaları; API `gazette.ts`; admin `OcrReview.tsx`, `GazetteUpload.tsx`. POST `/api/v1/admin/gazette-documents/:id/ocr`; role+CSRF guard upload'dan önce; OCR kanıtı audit'e yazılır, canonical alanlar değiştirilmez.
- Kaynak operasyonu: `source-operations.ts`, registry, schema ve `202610250008_source_sync_state/migration.sql`; admin `SourceStatus.tsx`. GET `/admin/source-operations`, SYSTEM_ADMIN POST `/:id/run`; izin kapısı endpoint üzerinden aşılamaz.
- Admin hardening: `main.tsx`, `AnnouncementReview.tsx`, `manual-file.ts`, `HistoricalUpload.tsx`, tsconfig/package/lock. Eski token arayüzü kaldırıldı; eski üretilmiş JS'nin güncel TSX'i gölgelemesi explicit TS imports/noEmit ile önlendi. ÖSYM teyidi gerçek batch.rowCount kullanır; eski504partisi için aynı504metni korunur.
- ÖSYM: `import_historical.py`, `osym_web.py`, `historical-import.ts`, fixture/tests, mobile `historical.tsx`. POST `/admin/historical-documents` multipart; POST `/admin/historical-documents/web` gözlenen resmî bağlantı listesi/seçili PDF; GET `/:batchId/file` özel preview. Mevcut `/admin/imports/:id/approve` ve public historical API kullanılır; paralel tarihsel DB yok.
- Runtime/güvenlik: `environment.ts`, `main.ts`, `module.ts`, `password.ts`, Dockerfile, compose/Caddy, `.dockerignore`, `infra/backup-verify-local.ps1`, `test-production-runtime.cjs`. Health DB readiness; auth2işlem+8bekleyen limiti/429 ile scrypt bellek tüketimi sınırlanır. Dev token production'da reddedilir.
- Mobil/legal: `about.tsx`, `index.tsx`, `app.config.js`, `eas.json`; `web/privacy.html`, `delete-account.html`, `legal.js/css`, `public-config.js`. Profil silme mevcut API kullanır; bearer düz storage'a yazılmaz. Oturum bellekte kalır.
- Testler: `test-auth-capacity.cjs`, `test-admin-browser.cjs`, `test-legal-browser.cjs`, `test-historical-import.cjs`, `test-environment.cjs`, `test-manual-file.cjs`, `test-source-operations.cjs`; mevcut CWD bağımlı test yolları düzeltildi. CI yeni testleri kapsar; uzaktaki CI'nın çalıştırıldığı iddia edilmiyor.

## Veritabanı kanıtı

Gerçek DB'de3 uygulanmış/9 bekleyen migration;504 onaylı kayıt. `kadroradar_ingestion_test_rc1_final` sıfırdan12/12. `kadroradar_ingestion_test_osym_rc1` gerçek üç PDF için ayrıdır. Restore DB'de gerçek yedek→9pendingmigration→504 sayımı doğrulandı. SQL mevcut veriyi silmez; Gazette'de sourceUrl NOT NULL kaldırılması alanı nullable yapar, kolon silinmez. Tam dump hash ve prosedür `RC1_DEPLOYMENT_RUNBOOK.md` içindedir. Production migrate/import0; kullanıcı açık onayı alınmadan değişmez.

## Docker kanıtı ve sınırlamalar

Son doğrulanmış image kimliği `sha256:8662e0a892addcab0a51ef67a05c1e756896beec72a31375bc441bbb3f08ba60`. `.local/rc1-container-report.json` yerel sonuçları içerir. Test container'ları yalnızca127.0.0.1 portlarına bağlandı ve sonrasında kaldırıldı. HTTPS CA trust ve hostname doğrulaması aktiftir; varsayılan trust store'un özel CA'yı reddettiği ayrıca test edildi. Windows curl özel CA için revocation-status hatası verdi; doğrulama kapatılmadan Node HTTPS+explicit CA ile test düzeltildi. Public ACME sertifikası veya internette deployment yoktur.

Image build'in yalnızca `compose config` çıktısı olmadığı doğrulandı. İlk Prisma lifecycle script takılması süre sınırlı explicit generate ile giderildi. Image tüm workspace bağımlılıkları nedeniyle büyüktür; minimal runtime image/dependency audit iyileştirmesi tamamlanmadı. Genel API rate limit process içidir; çok replica için gateway/dağıtık limit gerekir. Private dosya/source audit retention, off-site backup ve gerçek operasyon alarmları işletmeci tarafından uygulanmalıdır.

Kredi kesintisi sonrası son build düzeltmesi: `infra/generate-prisma.cjs` eksik `proxy-from-env` bağımlılığından arındırıldı. Resmî engine indirmesi IPv4, yapılandırılmış proxy desteği, istek zaman aşımı/3deneme ve arşiv SHA256 doğrulamasıyla tamamlandı; explicit engine yollarıyla Prisma generate ve API build geçti. Yeni image yeniden runtime testinden geçti. Runtime test CLI'sinin son rapor üretmeden erken kapanmasına karşı süreç yaşamı korundu; son koşu açık PASS raporu üretti ve test container/volume'larını kaldırdı. Bu düzeltmeler gerçek DB migration'ı gerektirmedi.

## Çalıştırma ve yayın kapısı

Test komutları: `python -m unittest discover -s services/ingest -p 'test_*.py'`; eski parser için ayrıca `python -m unittest discover -s services/ingest/tests`. Gerçek Gazette testleri yalnızca `GAZETTE_REAL_PDF` verilirse çalışır. ÖSYM gerçek E2E için `OSYM_ASSOCIATE_PDF` ve `OSYM_HIGH_SCHOOL_PDF`; isteğe bağlı `OSYM_LIVE_INDEX` resmî sayfada gözlenen tek PDF web yolunu test eder. Bu env'ler yoksa fixture modları açıkça SENTETİK/SKIPPED ayrılır. DB testlerinde URL `/kadroradar_ingestion_test_` içermeden test başlamaz.

Android açılış/navigasyon/geri tuşu/bildirim teslimi gerçek cihaz testi bu çalışmada yapılmadı. AAB üretilmedi. Domain, API, e-posta ve Play bilgisi uydurulmadı. Kullanıcının bildirdiği eski preview APK başarısı yeni RC1 native sürümü için kabul kanıtı değildir.

Sonraki dış adımlar ve güncel resmî Google Play referansları: `RC1_EXTERNAL_SETUP_CHECKLIST.md`; Android senaryoları: `RC1_ANDROID_TEST_PLAN.md`; işletim: `RC1_DEPLOYMENT_RUNBOOK.md`. Gerçek yayın için bu kapılar tamamlanmalıdır. Yazılım testlerinin geçmesi, mağaza onayı veya tüm adayların gerçek/uygun olduğunun garantisi değildir.
