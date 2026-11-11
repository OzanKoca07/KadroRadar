# Migration 16 sonrası GitHub / Render release handoff

Tarih: 2 Kasım 2026. Bu rapor henüz yayımlanmamış çalışma ağacını değerlendirir. Production DB bağlantısı/yazması, migration, e-posta gönderimi, Git commit/push, Render deployment ve EAS build yapılmadı. Production kontrolleri yalnız herkese açık GET istekleridir.

## Git release kapsamı

Branch `feature/announcements-core`; HEAD ve bildirilen son production release aynı: `4e5b86c5de22210eef254b682df6890ba96c4bca`. Bu release ile HEAD arasında **0 yeni commit** var. Yeni backend/mobile/web/operator geliştirmeleri tracked değişiklikler ve untracked dosyalardan oluşuyor. Yeni release SHA henüz yoktur; eski SHA yeni kodun teslim kanıtı olarak kullanılmamalı.

| Sınıf | Release kapsamı |
| --- | --- |
| Auth recovery / Resend | account-recovery/account-mail servisleri; tek kullanımlık hash token, rate limit, provider timeout ve capabilities; auth/profile/account deletion entegrasyonu |
| SecureStore / mobil | Güvenli oturum geri yükleme ve temizleme; recovery ekranı, capabilities kapısı, oturumsuz istekler; Expo SDK54 / com.kadroradar.app / 1.0.1 code3 korunur |
| Migration 16 | Dört yeni recovery tablosu, manifest/preflight/backup/deploy araçları ve izole testler; eski migration SQL değişmez |
| Web recovery | Aynı backend origin'inde /account-recovery ve yerel CSS/JS; token fragment üzerinden, no-store/no-referrer/CSP, açık POST onayı |
| Gazette | Downloader→private belge cache→parser→staging→admin review; kaynak hakları ve otomasyon kapıları korunur |
| Release / CI | Docker Python downloader dosyası, regression testleri, release manifesti ve raporlar |
| Ayrı operatör kapsamı | Önceki 23 korunan dosya baseline hash'leriyle aynı; bu core release'e kontrolsüz eklenmez |

Tam dosya listesi aşağıdaki otomatik envanter bölümündedir. `.local`, gerçek PDF/XML, dump, receipt, env, anahtar ve imzalama dosyaları release manifestinde yoktur. `git add .` kullanılmamalı. Manifestin coreCodeAndTests + documentationAndInactiveTemplates grubu kendi import/CI bağımlılıklarıyla birlikte ele alınmalı; separateOperatorReviewPreserveUnchanged ayrı tutulmalı. Bu görev yalnız `infra/test-render-readiness.cjs`, `infra/test-rss-runtime.cjs`, release manifesti ve bu handoff raporunu değiştirdi; diğer değişiklikler önceki sprintlerden korundu.

## Migration uyumluluğu

Kullanıcının production uygulama sonucu SUCCEEDED / applied=16 / historicalPlacements=8611 / activeSystemAdmins=1 / CLI target+TLS proof=true. Son AFTER preflight PASS, pending=null. Bunlar kullanıcı tarafından gerçek terminalden bildirildi; bu görev production DB'ye yeniden bağlanmadı.

Yerel manifestte 16 migration checksum'u doğrulandı. Migration16 adı `20261031000100_account_recovery`; normalized-LF SQL SHA-256 `e706db2cb2241c09919c0a3c96abdc862227956b84c932b71bc2b36318a53ead`. Önceki 15 SQL'in production release ile eşitliği izole restore testinde doğrulandı. Yeni schema dört recovery modelini içerir; bu release için migration17 veya yeni SQL gerekmez. Deployment startup komutu yalnız `node apps/api/dist/main.js`; migration/seed çalıştırmaz.

İzole PG16 dump→restore→15→16 testi **23 kontrol PASS**: 8.611 sentetik historical kayıt ve kritik tablo hash/sayıları korunur, önceki backend 16 şemasıyla çalışır, yeni backend auth testi geçer, tekrar deploy NO_OP. Sentetik veriler gerçek production sayım/hash kanıtı olarak sunulmaz. Eski 15-migration varsayımlı operatörlerin gerektiğinde ayrı incelenmesi gerekir; burada korunan araçlar değiştirilmedi.

## Backend ve mobil testleri

| Kontrol | Yerel sonuç |
| --- | --- |
| API build / admin build / mobil TypeScript | PASS |
| Prisma generate | Çalışan yerel API'nin Windows engine DLL kilidi nedeniyle ana output EPERM; servis durdurulmadı. Aynı schema ayrı özel output dizininde generate PASS. Docker Linux generate ayrıca image build kanıtıyla değerlendirilir |
| İzole PG16 auth/admin/kaynak grubu | 18/18 test grubu PASS: candidate, usability-auth-news, mobile-network, indexing-policy, source-operations, announcement-scan, source-worker-process, historical-release, source-rights-flow, career-rss, admin-browser, auth-readiness, auth-capacity, gazette, daily-announcements, gazette-downloader, auth-recovery-draft, account-recovery |
| Auth readiness | 73 kontrol PASS; açık/kapalı kayıt, parola sınırları, login/session, profil/favori/silme; yalnız disposable DB |
| Resend adapter | 18 kontrol PASS; gerçek gönderen biçimi dahil, fetch mock; gerçek mail yok |
| Recovery browser | 11 kontrol PASS; fragment temizleme, açık reset/verify onayı, kapalı servis, mobil viewport; API yanıtları sentetik |
| SecureStore/session | 23 kontrol PASS + native config PASS; gerçek Android KeyStore cihaz testi yapılmadı |
| Android export / EAS preview config | PASS; yerel JS/assets export, APK/AAB veya EAS hesabı işlemi yok |
| Python downloader / Kariyer RSS / official RSS / source adapters | 12 / 8 / 12 / 3 test PASS, offline |
| Locked Prisma / Render target contract | PASS; SHA-512 ve TLS kontrolleri korunur |
| Mobil usability / UI / safe database errors | PASS; ağ hatası sahte boş listeye dönmez, kaynak URL kısıtları korunur |

Gazette gerçek PDF ve Docker sonuçları son doğrulama bölümünde ayrıca belirtilir. Test çıktıları `.local/post-m16-release/` ve mevcut test-specific `.local` klasörlerindedir; Git kapsamı dışındadır.

## Gerçek yerel Gazette belgesi ve kaynak sınırları

Gerçek 140 sayfalık yerel PDF ile Python parser **21/21 PASS**; aynı belgeyle izole PG16 zincirinde **13 test grubu PASS**. Gazette metriği: 140 sayfa incelendi, 12 sayfa işaretlendi, 6 aday / 6 staging kaydı / ikinci importta6 duplicate; 2 ilan ve9 kadro yalnız izole testte incelenip yayımlandı. Downloader bridge testi REAL_LOCAL_PDF_MOCK_TRANSPORT modunda21 kontrol PASS; liveDownload=false. Bu sonuç canlı resmî site erişimi/izin/indirme veya production yayını değildir. Kaynak registry/izinler değişmedi; Kariyer Kapısı REVIEW_REQUIRED ve enabled=false, Gazette policy kapısı ve ilan.gov.tr kısıtları korunur. Production otomasyonu açılmadı.

## Web hesap kurtarma ve domain

Hedef `https://kadrooradar.com/account-recovery`. `ACCOUNT_RECOVERY_ORIGIN` değeri path içermeyen `https://kadrooradar.com` olmalıdır; `/account-recovery` backend tarafından linke eklenir. HTML/JS relative `/api/v1/account/...` kullanır. Dolayısıyla bu domain aynı Render API servisine yönlendirilmelidir; sayfayı başka bir statik host'a taşımak mevcut same-origin sözleşmesini sağlamaz.

Backend production image `web/` klasörünü `/app/public/legal` altına kopyalar. `/account-recovery`, `/account-recovery.js`, `/account-recovery.css` aynı origin'de sunulur. Fragment token sunucu GET URL'sine gitmez ve history temizlenir. Sayfa açılması token tüketmez. Kayıt/recovery kapalıyken form capability yanıtına göre kapalıdır. Mobil SecureStore oturumu ayrı kalır; mail linki web'de tamamlanır, sonra uygulamadan tekrar giriş yapılır.

2 Kasım salt okunur production GET sonucu: health200 ready; historical total8611; announcements total0; privacy200; delete-account200; account capabilities selfRegistration=false ve parola sınırları12–128. Eski capabilities yanıtında yeni recovery alanları henüz yok, `/account-recovery`404: yeni backend/web henüz production'da değil. `kadrooradar.com` CNAME sorgusu ENODATA, HTTPS isteği başarısız oldu. Bu, domain'in boşta veya kesin yanlış yapılandırıldığı kanıtı değildir; A/ALIAS/Render domain sahipliği ve TLS bağlantısı doğrulanmadı. Çalışır domain veya sertifika varmış gibi raporlanmaz.

Production public pagination kontrolü de PASS: ilk iki sayfa arasında benzersiz ID, aynı sayfanın tekrarında kararlı sıralama, maxScoreRange=true, total8611; minScoreGte=70 / maxScoreLte=90 filtresi6852 sonuç ve dönen satırlarda doğru puan sınırları. Bu kontroller GET ile yapıldı.

## Docker production image ve son release doğrulaması

`docker build --progress=plain -f Dockerfile.api -t kadroradar-api:m16-release .` **PASS**. Bu build cache kullanımına izin verir; --no-cache çalışması olarak raporlanmaz. Base/runtime paket katmanları cache kullandı, API/admin dependency install ve Linux Prisma generate yeniden çalıştı. Lockfile değişmeden407 paket, Prisma/client6.19.3; büyük arşivlerin SHA-512 doğrulaması ve engine SHA-256 doğrulaması korundu. Yerel image/manifest kimliği: `sha256:c260d239a94c6e311f4905b69e3cb8b5af16ae5f9684b32e33574fe832cf8dad`. Bu bir Git release SHA veya Render deployment kanıtı değildir.

Image üzerinde `test-render-readiness.cjs` **11 kontrol PASS**: PORT önceliği, startup migration/seed olmaması, 16 explicit isolated migration/idempotency, boş public API, recovery sayfa/assets/CSP/no-store/no-referrer/frame koruması, kapalı registration/recovery, admin login/RBAC/HttpOnly+Secure cookie/logout, DB outage503 ve recovery200. Testteki beklenen duplicate admin oluşturma reddi yetki yükseltmesini önledi; gerçek admin hesabı kullanılmadı. Ağ kapalı image smoke testinde Linux Prisma recovery modelleri ve Resend modülü yüklenir; Python fitz/RSS/Gazette downloader/parser importları PASS, özel gerçek XML image içinde yoktur.

Release manifest **PASS**:141 aday dosya,23 ayrı operatör dosyası,201 relative import, kapsam dışı değişiklik0. Secret scan **PASS**:871 obje/dosya ve0 bulgu; son rapor içeriği de taramaya dahildir. Secret taraması sezgiseldir. Korunan23 dosya hashleri baseline ile eşit; migration checksumları16/16 PASS. GitHub remote CI çalıştırılmadı. Yerel testlerin hepsi başarılı olsa da yeni SHA/push/CI ve manual deployment ayrı aşamalardır.

## Render environment kontrol listesi

Gerçek Render environment değerleri okunmadı. Aşağıdakiler operatörün Dashboard'da kontrol edeceği değerlerdir; secret'lar gösterilmemeli veya rapora kopyalanmamalı.

| İsim | Bu release için karar |
| --- | --- |
| ACCOUNT_MAIL_PROVIDER | Uygulanan adaptör `resend`; recovery kapalıyken gönderim yapılmaz |
| ACCOUNT_MAIL_FROM | `KadroRadar <noreply@bildirim.kadrooradar.com>`; provider'da bu gönderici domain'inin doğrulanması ayrıca gerekli |
| RESEND_API_KEY | Yalnız Render secret store; mevcut anahtarı görüntülemeden varlık/yetki kontrolü. Bu görev anahtar üretmez/kullanmaz |
| ACCOUNT_RECOVERY_ORIGIN | `https://kadrooradar.com`, domain/TLS çalışır olduktan sonra; path/trailing slash yok |
| ACCOUNT_RECOVERY_ENABLED | **false kalmalı** |
| ALLOW_SELF_REGISTRATION | **false kalmalı** |
| ACCOUNT_RATE_HMAC_KEY | Ayrı server-side secret, en az32 karakter; mobil/web bundle'a konmaz; değeri raporlanmaz |
| CORS_ORIGINS | Gerçek HTTPS origin'leri; recovery açılmadan önce recovery origin listede bulunmalı; wildcard yok |
| NODE_ENV / PROCESS_ROLE | production / api |
| SOURCE_SYNC_ENABLED / NOTIFICATIONS_ENABLED / DOCUMENT_UPLOADS_ENABLED | false / false / false |
| DATABASE_URL / TRUST_PROXY_HOPS | Mevcut doğrulanmış Render hedefi ve proxy ayarı korunmalı; URL/credential görüntülenmez |

Resend teknik adaptörü hazırdır. SPF/DKIM/DMARC ve domain doğrulaması, gönderim yetkisi/kota, tracking kapalı olması, inbox/spam/bounce teslimat kontrolü ve sağlayıcı veri işleme/retention kararları burada doğrulanmadı. Provider mock başarısı gerçek e-posta teslimatı değildir. [Resend resmî domain kılavuzu](https://resend.com/docs/dashboard/domains/introduction) domain/subdomain doğrulaması ve transactional mail tracking ayarlarını açıklıyor. Recovery/kayıt açılışı bu release'den ayrı onay ve test gerektirir. Bayraklar kapalıyken `/account/capabilities` yeni alanları false döndürmeli; request/confirm RECOVERY_UNAVAILABLE ile kapalı kalmalı.

## GitHub / Render operatör sırası

1. Bu rapor ve manifest kapsamını incele; ayrı23 operatör dosyasını core commit'e katma. Secret scan ve manifest PASS sonucu korunmalı. Yerel bağımlılıklar frozen lockfile/Prisma6.19.3 ile kullanılmalı.
2. Ayrı onayla yalnız manifestteki core + dokümantasyon dosyalarını açık path listesiyle stage et; staged diff ve secret taramasını yeniden incele. Yeni migration SQL'in production'da uygulanan checksum'la eşit olduğunu tekrar kontrol et. Commit SHA henüz atanmadı.
3. Push öncesinde Render'ın istemeden deploy başlatmayacağı manual deploy/auto-deploy ayarını operatör doğrulasın; bu görev Dashboard ayarı değiştirmez. Push onayından sonra feature/announcements-core'a gönder; yeni SHA için tüm GitHub CI işleri geçmeden deployment yapma. Önceki CI16 başarısı bu yeni uncommitted kodun CI sonucu değildir. Bu görev remote CI başlatmadı.
4. Mevcut Render Web Service'i ve mobilin kullandığı `kadroradar.onrender.com` erişimini koru; Render subdomain'ini kapatma. Custom Domains kısmına `kadrooradar.com` ekleme/DNS işlemleri ayrı operatör işi: Render'ın gerçekten verdiği kayıtları kullan, IP/CNAME değeri uydurma; sahiplik ve TLS hazır olduğunda HTTPS erişimini kontrol et. Domain bağlantısı bu görevde değiştirilmedi. [Render resmî custom domain adımları](https://render.com/docs/custom-domains) Dashboard→DNS→Verify sırasını açıklıyor.
5. Environment checklist'i secrets göstermeden kontrol et. Kayıt/recovery ve kaynak flag'lerini kapalı bırak. Dockerfile.api / proje kökü context / `/api/v1/health` health path ve mevcut PORT davranışını koru. Startup'a migrate/seed/import ekleme.
6. Deployment onayından sonra yalnız doğrulanmış commit'i manual deploy et. Render release SHA'yı GitHub SHA ile eşleştir. Production migration16 zaten uygulanmış olduğundan yeni migration çalıştırma.
7. Deployment sonrası GET health200 ready, historical total8611/pagination/puan filtreleri, announcements0, privacy/delete-account/account-recovery200, assets ve güvenlik header'ları; capabilities selfRegistration=false/emailVerification=false/passwordReset=false olmalı. Kaynak hakları ve API role guard'ları korunmalı. Gerçek kullanıcıyla mutation veya mail testi ayrı onay gerektirir.
8. Backend/web doğrulaması bitince EAS preview için ayrı onay al. SDK54, package com.kadroradar.app, version1.0.1/code3 ve production HTTPS API korunur. Yeni native SecureStore bağımlılığı için yeni APK gerekir; bu görev yalnız export yaptı. Fiziksel cihazda reopen/expiry/logout/delete session temizleme ve linkten sonra giriş testleri yapılmalı.

GO/NO-GO: yerel testler ve image kanıtı tamamlandı; **commit/push incelemesine koşullu GO**; henüz yeni SHA ve remote CI yok. Domain/TLS ve gerçek mail doğrulaması tamamlanmadığından recovery/kayıt aktivasyonuna **NO-GO**. Render deploy ve EAS build ayrı onay bekler. Google Play için ayrıca gerçek destek kimliği, yayımlanmış politika/silme URL'leri, Data Safety beyanı, cihaz testi, Play Console ve kapalı test işlemleri gerekir.

<!-- FILE_INVENTORY -->

## Çalışma ağacı dosya envanteri

HEAD: `4e5b86c5de22210eef254b682df6890ba96c4bca`; 30 tracked değişiklik ve 61 untracked dosya. M/Yeni mevcut çalışma ağacını gösterir; bu görevde oluşturuldukları anlamına gelmez.

| Sınıf | Durum | Dosya |
| --- | --- | --- |
| Auth / recovery | Yeni | `apps/api/src/account-recovery.ts` |
| Auth / recovery | M | `apps/api/src/candidate.ts` |
| Auth / recovery | M | `apps/api/src/environment.ts` |
| Auth / recovery | M | `apps/api/src/main.ts` |
| Auth / recovery | Yeni | `apps/api/test-account-recovery.cjs` |
| Auth / recovery | Yeni | `apps/api/test-auth-readiness.cjs` |
| Auth / recovery | Yeni | `apps/api/test-auth-recovery-draft.cjs` |
| Auth / recovery | Yeni | `infra/account-recovery.sql.example` |
| Dokümantasyon | Yeni | `docs/ACCOUNT_RECOVERY_AND_GAZETTE_PRODUCTION_READINESS.md` |
| Dokümantasyon | Yeni | `docs/AUTH_AND_GAZETTE_RELEASE_READINESS.md` |
| Dokümantasyon | Yeni | `docs/AUTH_GAZETTE_FINAL_IMPLEMENTATION.md` |
| Dokümantasyon | Yeni | `docs/MIGRATION16_POST_RELEASE_HANDOFF.md` |
| Dokümantasyon | Yeni | `docs/MIGRATION16_PREFLIGHT_CONNECTION_DIAGNOSIS.md` |
| Dokümantasyon | Yeni | `docs/MIGRATION16_PRODUCTION_BACKUP_AND_RELEASE.md` |
| Dokümantasyon | Yeni | `docs/MIGRATION16_PRODUCTION_EXECUTION.md` |
| Dokümantasyon | Yeni | `docs/MIGRATION16_RESEND_RELEASE_PREFLIGHT.md` |
| Dokümantasyon | M | `docs/RELEASE_CANDIDATE_FILES.json` |
| Gazette / kaynak | Yeni | `apps/api/src/gazette-staging.ts` |
| Gazette / kaynak | M | `apps/api/src/source-adapter-contract.ts` |
| Gazette / kaynak | M | `apps/api/src/source-operations.ts` |
| Gazette / kaynak | Yeni | `apps/api/test-gazette-downloader.cjs` |
| Gazette / kaynak | Yeni | `services/ingest/fixtures/make_gazette_download_report.py` |
| Gazette / kaynak | Yeni | `services/ingest/gazette_download.py` |
| Gazette / kaynak | Yeni | `services/ingest/test_gazette_download.py` |
| Korunan ayrı operatör | Yeni | `docs/ADMIN_STATUS_DIAGNOSIS.md` |
| Korunan ayrı operatör | Yeni | `docs/DIAGNOSE_BACKUP_VALIDATION.md` |
| Korunan ayrı operatör | Yeni | `docs/PILOT_BACKUP_DIAGNOSIS.md` |
| Korunan ayrı operatör | Yeni | `docs/PRISMA_CONNECTION_DIAGNOSIS.md` |
| Korunan ayrı operatör | Yeni | `docs/PRODUCTION_ADMIN_RECOVERY.md` |
| Korunan ayrı operatör | Yeni | `docs/PRODUCTION_BACKUP_DIAGNOSIS.md` |
| Korunan ayrı operatör | M | `docs/PRODUCTION_RELEASE_CHECKLIST.md` |
| Korunan ayrı operatör | M | `docs/RENDER_OSYM_DATA_IMPORT.md` |
| Korunan ayrı operatör | Yeni | `infra/admin-account.cjs` |
| Korunan ayrı operatör | Yeni | `infra/admin-account.ps1` |
| Korunan ayrı operatör | Yeni | `infra/local-api-schema.cjs` |
| Korunan ayrı operatör | M | `infra/osym-production.cjs` |
| Korunan ayrı operatör | M | `infra/osym-production.ps1` |
| Korunan ayrı operatör | Yeni | `infra/pg-dump-diagnostics.cjs` |
| Korunan ayrı operatör | Yeni | `infra/prisma-connection-diagnostics.cjs` |
| Korunan ayrı operatör | Yeni | `infra/test-admin-account-wrapper.ps1` |
| Korunan ayrı operatör | Yeni | `infra/test-admin-account.cjs` |
| Korunan ayrı operatör | Yeni | `infra/test-admin-status.cjs` |
| Korunan ayrı operatör | Yeni | `infra/test-diagnose-backup.cjs` |
| Korunan ayrı operatör | Yeni | `infra/test-osym-backup.cjs` |
| Korunan ayrı operatör | M | `infra/test-osym-production.cjs` |
| Korunan ayrı operatör | Yeni | `infra/test-pilot-backup.cjs` |
| Korunan ayrı operatör | Yeni | `infra/test-prisma-connection.cjs` |
| Migration16 / şema | Yeni | `apps/api/prisma/migrations/20261031000100_account_recovery/migration.sql` |
| Migration16 / şema | M | `apps/api/prisma/schema.prisma` |
| Migration16 / şema | Yeni | `infra/migration16-backup-contract.json` |
| Migration16 / şema | Yeni | `infra/migration16-backup.cjs` |
| Migration16 / şema | Yeni | `infra/migration16-backup.ps1` |
| Migration16 / şema | Yeni | `infra/migration16-deploy.cjs` |
| Migration16 / şema | Yeni | `infra/migration16-deploy.ps1` |
| Migration16 / şema | Yeni | `infra/migration16-diagnostics.cjs` |
| Migration16 / şema | Yeni | `infra/migration16-manifest.json` |
| Migration16 / şema | Yeni | `infra/migration16-preflight.cjs` |
| Migration16 / şema | Yeni | `infra/migration16-preflight.ps1` |
| Migration16 / şema | Yeni | `infra/test-migration16-backup.cjs` |
| Migration16 / şema | Yeni | `infra/test-migration16-connection.cjs` |
| Migration16 / şema | Yeni | `infra/test-migration16-deploy.cjs` |
| Migration16 / şema | Yeni | `infra/test-migration16-restore.cjs` |
| Mobil / SecureStore | M | `apps/mobile/app.json` |
| Mobil / SecureStore | M | `apps/mobile/app/_layout.tsx` |
| Mobil / SecureStore | M | `apps/mobile/app/about.tsx` |
| Mobil / SecureStore | Yeni | `apps/mobile/app/account-recovery.tsx` |
| Mobil / SecureStore | M | `apps/mobile/app/announcement/[id].tsx` |
| Mobil / SecureStore | M | `apps/mobile/app/matches.tsx` |
| Mobil / SecureStore | M | `apps/mobile/app/notifications.tsx` |
| Mobil / SecureStore | M | `apps/mobile/app/profile.tsx` |
| Mobil / SecureStore | M | `apps/mobile/app/saved.tsx` |
| Mobil / SecureStore | M | `apps/mobile/lib/account.ts` |
| Mobil / SecureStore | Yeni | `apps/mobile/lib/use-session.ts` |
| Mobil / SecureStore | M | `apps/mobile/package.json` |
| Mobil / SecureStore | Yeni | `infra/mobile-account-test-loader.cjs` |
| Mobil / SecureStore | Yeni | `infra/test-mobile-session.cjs` |
| Mobil / SecureStore | Yeni | `infra/test-secure-store-config.cjs` |
| Release / test altyapısı | M | `.github/workflows/ci.yml` |
| Release / test altyapısı | M | `apps/api/test-mobile-network.cjs` |
| Release / test altyapısı | Yeni | `apps/api/test-recovery-browser.cjs` |
| Release / test altyapısı | M | `Dockerfile.api` |
| Release / test altyapısı | M | `infra/test-official-sources-isolated.cjs` |
| Release / test altyapısı | M | `infra/test-render-readiness.cjs` |
| Release / test altyapısı | M | `infra/test-rss-runtime.cjs` |
| Release / test altyapısı | M | `pnpm-lock.yaml` |
| Resend | Yeni | `apps/api/src/account-mail.ts` |
| Resend | Yeni | `apps/api/test-account-mail.cjs` |
| Web | Yeni | `web/account-recovery.css` |
| Web | Yeni | `web/account-recovery.html` |
| Web | Yeni | `web/account-recovery.js` |
| Web | M | `web/privacy.html` |
