# KadroRadar — Render release teslimi

25 Ekim 2026. Kod GitHub'a gönderildi; Render deployment, gerçek DB migration, ücretli servis oluşturma, production ilan yayını veya Play upload yapılmadı.

## Release kimliği ve Git

- Dal: `feature/announcements-core`; upstream: `origin/feature/announcements-core`.
- Repository: [OzanKoca07/KadroRadar](https://github.com/OzanKoca07/KadroRadar/tree/feature/announcements-core).
- Uygulama/veri akışı commit'i: `b785f2b69d1a884297adf822833c9a53a5dd386b`.
- Son test edilmiş release kodu/altyapı commit'i: `b78fa7f723fc17da54828325e34484f414b6a854`.
- `git push -u origin feature/announcements-core` **başarılı**; yukarıdaki release SHA'sı `git ls-remote` ile doğrulandı. Bu teslim kaydı ayrı belge commit'iyle gönderilir; onun kesin hash'i `git log -1 --format=%H -- docs/RENDER_RELEASE_HANDOFF.md`, nihai HEAD `git rev-parse HEAD` ile alınır.
- Normal push kullanıldı; force push, main değişikliği veya PR oluşturma yapılmadı. GitHub Actions'ın uzaktaki sonucu ayrıca izlenmelidir; yerel başarı uzaktaki CI başarı beyanı değildir.
- Başlangıçtaki kullanıcı değişiklikleri korundu. Git diff'in yerel kopyası `.local/release/pre-release.patch`; yeni dosyalar Git commit'lerinde korunuyor. Üretilmiş admin `main.js` yalnızca index'ten çıkarıldı, diskte duruyor. Cache/build/secret dosyaları ignore edildi.

## Gizli bilgi ve veri kontrolü

`infra/check-release-secrets.py` çalışma dosyalarını, staged blob içeriklerini ve tüm erişilebilir Git geçmişindeki blob'ları taradı: **engelleyici eşleşme 0**. Özel anahtar, gerçek API token'ı, production DB credential'ı, dump veya gerçek kullanıcı verisi release'e eklenmedi. `.env.example` boş değerli şablondur; gerçek `.env`, `.local`, yedekler, APK/AAB, signing key ve build çıktıları Git/Docker context dışındadır. CI ayrıca geçmiş taraması yapar.

Bu tarama regex tabanlıdır; bağımsız güvenlik denetimi değildir. Git geçmişinde ve yerel compose/fixture'larda bilinen geliştirme/test parolaları vardır (`infra/docker-compose.yml`, CI, parser/environment testleri). **Production'da kullanılmışlarsa ilgili parolalar döndürülmelidir.** Gerçek production anahtarı bulunmadığından anahtar rotasyonu veya geçmişi yeniden yazma yapılmadı. Yerel compose'un gelecekte oluşturacağı DB yalnızca 127.0.0.1'e bind edilir; mevcut çalışan DB container'ı yeniden oluşturulmadı ve parolası değiştirilmedi.

## Yeniden çalıştırılan kontroller

| Kontrol | Sonuç / kapsam |
| --- | --- |
| `git diff --check`, staged kontrol ve secret gate | PASS |
| Prisma generate / validate | PASS, Prisma6.19.3 |
| API / admin build; mobil `tsc --noEmit` | PASS; SDK54 ve Android paket kimliği korundu |
| Python parser'lar | **28 + 5 = 33 PASS**; gerçek yerel Gazete PDF'sine ilişkin 4 test dahil |
| Uygunluk / bildirim planı / mobil ağ / manuel dosya | 9 / 8 / 6 / 7 kontrol PASS |
| Environment / auth kapasitesi | 11 server ortam kontrolü ve mobil production ayarları; 2 aktif/8 kuyruk ve 429 kapasite testi PASS |
| Candidate / notification worker / ingestion / Gazette / source operations / resmî referans | PostgreSQL/HTTP testleri PASS; oturum, CSRF, RBAC, mükerrerlik, staging→inceleme→yayın→public API ve arşiv/iptal dahil |
| ÖSYM üç düzey | Üç gerçek resmî PDF, **504 / 346 / 69**, toplam **919**; upload, duplicate, reviewer onayı ve public eğitim filtreleri PASS |
| Belge işlemlerini kapatma | Üç yetkili PDF/web import endpoint'i `DOCUMENT_UPLOADS_ENABLED=false` iken 503; yetki denetimi korunuyor |
| Admin browser | Playwright/Edge, 21 kontrol PASS; fixture verisi ve izole hesaplar |
| Privacy / hesap silme browser | Cookie+CSRF üzerinden gerçek test hesabı silme, profil/oturum kaldırma PASS |
| Docker production build | Monorepo kökünden PASS; frozen lock, checksum/TLS doğrulamalı Prisma engine, non-root UID1000 |
| Son imaj | `sha256:242a1945baadaef2a17ac7d80e4fa43fe201b337bbd68a1bbaf885cef76f0d4c` |
| Container / Render port | `PORT=10000` ve farklı `API_PORT=3999` ile doğru port, 0.0.0.0 erişimi ve DB health PASS |
| Container güvenlik / web | CORS allow/deny, 429, named-volume restart, aynı-origin admin/statik legal sayfalar, Secure/HttpOnly/Strict cookie PASS |
| Yerel HTTPS / gerçek OCR | Yerel CA'yı açıkça doğrulayan HTTPS kontrolü; gerçek Gazete PDF'sinde **16 sayfa** Docker OCR PASS; production TLS yayını değildir |

İlk engine indirmesinde 30 saniye toplam sınır büyük arşivi kesiyordu. Küçük checksum isteği HTTP200 verdi; süre 120 saniye/istek, üç deneme ve 840 saniye toplam generate sınırıyla build geçti. Engine arşivi yaklaşık46 saniyede alındı; TLS/checksum devre dışı bırakılmadı. Engine katmanı kaynak kopyasından ayrıldı, sonraki kod build'inde indirme cache'den kullanıldı. Smoke test HTTP istekleri artık 5 saniyeyle sınırlı; restart sonrası readiness beklenir.

Son imajın kabul testi 1GiB bellek sınırında yapıldı. Free planında büyük PDF/OCR kapasitesi veya gerçek cihaz teslimi kanıtlanmış değildir. Chromium yerel test CA'sı için yalnızca test browser context'inde sertifika istisnası kullanır; ayrıca Node HTTPS kontrolü güvenilmeyen CA'yı reddedip verilen CA'yı doğrular. Production TLS ayarları gevşetilmedi.

## Migration ve 504 kaydın korunması

12 SQL migration kronolojik incelendi. Veri/table/column silme yok; yeni tablolar/sütunlar ve iki `sourceUrl` NOT NULL kısıtının gevşetilmesi var. Gerçek DB'ye migration uygulanmadı.

| Hedef | Sonuç |
| --- | --- |
| Gerçek yerel `kadroradar` | Salt okunur son kontrol: **504** onaylı kayıt; **3 uygulanmış / 9 bekleyen** migration |
| Yeni boş `kadroradar_ingestion_test_release_20261025` | 12 migration PASS; uygulama ve 919 ÖSYM regresyonları burada |
| Yeni restore `kadroradar_ingestion_test_restore_20261025211927` | Gerçek yedek restore edildi, 504 teyit edildi; 9 bekleyen migration yalnızca burada uygulandı; GET rounds/list/detail sonrası hâlâ504 |

Yeni yedek `.local/backups/kadroradar-20261025211927.dump`; SHA256 `3867a643fb83aefd6a2ecd6d0ff736aeb2cbefb606b9651db5f096e19d42e488`. Yedek ve test DB'leri inceleme için saklandı, Git'e eklenmedi. Test container/network/volume'ları kaldırıldı; çalışan gerçek DB container'ı korundu.

## Render'a girilecek alanlar

| Alan | Değer |
| --- | --- |
| Repository / Branch | `OzanKoca07/KadroRadar` / `feature/announcements-core` |
| Runtime | Docker |
| Root Directory | Boş |
| Dockerfile / Build Context | `./Dockerfile.api` / `.` |
| Docker Command / Pre-Deploy | İkisi de boş; migration startup'ta yok |
| Container Port | Render'ın `PORT` değeri, varsayılan10000; API_PORT tanımlamayın |
| Health | `/api/v1/health` |
| Plan / Auto-Deploy | İlk sınırlı doğrulama Free / kurulum tamamlanana kadar Off |

Environment isimleri: `NODE_ENV`, `DATABASE_URL`, `CORS_ORIGINS`, `TRUST_PROXY_HOPS`, `SOURCE_SYNC_ENABLED`, `NOTIFICATIONS_ENABLED`, `ALLOW_SELF_REGISTRATION`, `DOCUMENT_UPLOADS_ENABLED`, `GAZETTE_STORAGE_DIR`, `HISTORICAL_STORAGE_DIR`, `SOURCE_STATE_DIR`, `GAZETTE_RETENTION_DAYS`. `PORT` Render, `INGEST_PYTHON` image tarafından sağlanır. Admin provisioning için yalnızca geçici `NEW_ADMIN_EMAIL`, `NEW_ADMIN_PASSWORD`, `NEW_ADMIN_ROLE` gerekir. Değerlerin kaynakları ve migration komutu [Render kurulum belgesinde](RENDER_DEPLOYMENT_SETUP.md).

## Kullanıcının sonraki işlemleri

1. Render'da test PostgreSQL ve Web Service'i aynı bölgede oluşturun; ücret/plan tercihi kullanıcıya aittir. Gerçek URL ve Internal DB URL belli olunca doğru env değerlerini girin. Bu görevde servis oluşturulmadı.
2. Gerçek hedef DB migration'ı için ayrı onay verin. Free shell/pre-deploy yok: onaylı operatör makinesinden external URL ile açık migration adımı çalıştırılır; DB parolası komut geçmişine yazılmaz.
3. Health/API ve `/admin/` erişimini doğrulayın, gerçek yönetici hesabını güvenli yerel provisioning ile oluşturun. Free üzerinde document/source/notification işleri kapalı kalsın.
4. Kalıcı disk ve yedekli paid PostgreSQL sağlanmadan gerçek belge/kullanıcı üretim kullanımına geçmeyin. Disk UID1000 erişimini doğrulamadan belge kapısını açmayın.
5. Gerçek işletmeci, destek e-postası ve saklama sürelerini `web/public-config.js` içinde tamamlayıp legal sayfaları yayımlayın. Henüz hukuken/yayın açısından tamamlandıkları iddia edilmiyor.
6. EAS production public API/privacy/delete/support değerleri, FCM ve gerçek cihaz testleri tamamlanmalı. Play geliştirici hesabı var; **kimlik incelemesi sürüyor**. AAB/mağaza yüklemesi bu görevde yapılmadı.

RSS uçtan uca testi fixture kullanır; bu turda yeni canlı RSS aktarımı yapılmadı. Kaynak izinleri otomatik varsayılmadı; registry'deki kaynaklar kapalı. ÖSYM919 ve Gazete/OCR testlerinde yereldeki gerçek resmî PDF'ler kullanıldı; test ilanları production'a yayımlanmadı. Mobil API sözleşmesi/typecheck testleri gerçek Android ekran, geri tuşu veya push teslim testinin yerine geçmez.
