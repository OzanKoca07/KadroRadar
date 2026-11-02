# CI17 düzeltmesi ve production handoff

## 1. Kanıtlanan hata

GitHub [CI17 / run41517159015](https://github.com/OzanKoca07/KadroRadar/actions/runs/41517159015), head `0d654fe58e7a2040d4c882608f6fa44d7c4a4c9b`: typescript job, step20 **node infra/test-migration16-restore.cjs**, exit1. Önceki auth-readiness, Gazette, account-recovery ve Resend adımları başarılıdır. Sonraki migration bağlantı/backup/deploy, SecureStore, Playwright, mobil TypeScript ve Android export adımları bu run'da skipped'dir; geçmiş kabul edilmez.

GitHub CLI kurulu değil. Public Actions API ile gerçek run/job/step sonuçları alındı; ham job log endpoint'i403 döndü ve erişim kontrolü aşılmadı. GitHub annotation yalnız Process completed with exit code1 veriyor. Ham CI exception metni görülmüş gibi raporlanmaz.

Temiz HEAD Git arşiviyle, korunan yerel operatör değişiklikleri olmadan hata yeniden üretildi: statusFAIL, phaseSEED_SYNTHETIC, kindAssertionError, exit1. Hatalı test `require('./osym-production.cjs')` üzerinden yerel, commit edilmemiş operatörün `PF_LOCAL_MIGRATION_COUNT` kodunu bekliyordu. Commit edilmiş legacy operatör aynı16 yerel migration'ı `assert.equal(names.length,15)` ile reddeder: ERR_ASSERTION, actual16, expected15, validationCode yoktur. Testin dış assertion'ı bu nedenle undefined yerine PF_LOCAL_MIGRATION_COUNT bekleyip başarısız olur. Yerel makinedeki korunan sürüm bu kodu taşıdığı için önceki testler yanlış çalışma ağacı sözleşmesine bağlanmıştı.

## 2. Düzeltme ve değişen dosyalar

- `infra/test-legacy-osym-contract.cjs`: compatibility subject'ini immutable release `4e5b86c5de22210eef254b682df6890ba96c4bca` Git nesnesinden yükler. Kaynak kod dönüşümü yoktur; module filename yalnız kök dosya yollarını doğru çözmek için sanaldır. Beklenen ret name/code/actual16/expected15/operator alanlarıyla tam doğrulanır. Yerel operatör cache'i kasıtlı zehirlenerek ona başvurulmadığı ve beklenmeyen hatanın reddedildiği test edilir.
- `infra/test-migration16-restore.cjs`: aynı legacy ret kontrolünü bu pinned helper üzerinden yapar; hata phase'i PINNED_LEGACY_OPERATOR olarak ayrılır. Eski ret testi kaldırılmaz, restore/hash/admin/auth kontrolleri korunur.
- `infra/release-http-smoke.ps1`: yalnız HTTPS GET; exact release SHA, health/db, historical8611, benzersiz/kararlı pagination, puan sınırları, capabilities/kapalı kayıt-recovery, ilan/news, legal/recovery/assets/header kontrolleri. Redirect reddi ve sınırlı timeout; ham hata/body/secret loglama yoktur.
- `infra/test-release-http-smoke.ps1`: PowerShell5.1/7 mock testleri; SHA yok/farklı, HTTP503, bozukJSON, açık flag, duplicateID, yanlış toplam/puan/contract, header eksikliği, asset404, ağ hatası ve credential URL reddi.
- `.github/workflows/ci.yml`: legacy unit regression ve her iki Windows shell'de smoke testleri eklenir. Hiçbir test kaldırılmaz/skip edilmez, timeout artırılmaz veya continue-on-error kullanılmaz.
- `docs/RELEASE_CANDIDATE_FILES.json` ve bu rapor: yeni dosyaları bağımlılıklarıyla birlikte core release'e dahil eder.

Önceki23 korunan operatör dosyasına dokunulmaz veya stage edilmez. İlk15 migration ve migration16 SQL aynıdır; normalized-LF migration16 SHA-256 `e706db2cb2241c09919c0a3c96abdc862227956b84c932b71bc2b36318a53ead`. .local/backup/env/receipt/dump/imzalama dosyaları release dışında kalır.

## 3. Yerel test kanıtı

| Kontrol | Sonuç |
| --- | --- |
| Temiz commit snapshot, önce | FAIL, yukarıdaki hata yeniden üretildi |
| Pinned legacy unit regression | 5/5 PASS |
| Temiz snapshot + düzeltme, gerçek disposable PG16 | restore regression23/23 PASS; 15→16, dump/restore, eski8611 hash, admin hash ve eski/yeni backend uyumluluğu |
| PG16 connection / backup / deploy | 28 /23 /21 kontrol PASS; production erişimi yok |
| API/admin build / mobil TypeScript | PASS |
| Auth/admin/historical/source/Gazette/recovery | restore edilmiş sentetik PG16 runner22/22 PASS; bunun18'i uygulama test grubu |
| Resend adapter / recovery browser / SecureStore | 18 /11 /23 kontrol PASS; gerçek mail/cihaz testi yok |
| Python downloader / Career RSS | 12 /8 offline test PASS |
| PowerShell GET smoke | 5.1 ve7 üzerinde15'er mock senaryo PASS; gerçek istek0 |
| Android export / EAS preview config | PASS; SDK54/package/version1.0.1/code3 korunur, EAS build yok |
| Docker build | PASS, cache kullanılır; temiz --no-cache build diye sunulmaz |
| Docker runtime / Python imports | 11 Linux runtime kontrolü PASS; ağsız Python imports PASS; deployment değildir |
| Prisma | CLI/client6.19.3; mevcut16 şema ve immutableSQL doğrulanır |

Test artifact'ları .local altında tutulur; gerçek production backup/receipt kullanılmaz. Testlerin sentetik kullanıcı/ilan/flag işlemleri yalnız disposable DB'ye aittir. Production'a migration/seed/dbpush/reset/mutation, gerçek e-posta veya kaynak taraması yapılmaz.

## 4. Commit, push ve yeni CI

Commit mesajı `fix: stabilize migration16 release CI [skip render]`. Bu raporu içeren commit'in tam SHA'sı ve yeni CI için:

```powershell
$release = git log -1 --format=%H -- docs/M16_CI_FIX_AND_PRODUCTION_HANDOFF.md
git show --stat $release
git ls-remote origin refs/heads/feature/announcements-core
gh run list --branch feature/announcements-core --commit $release
```

Commit kendi SHA'sını, daha sonra oluşacak push/CI sonucunu aynı içerikte sabitlemez. Gerçek tam SHA, push sonucu, runID ve sonuç nihai kullanıcı tesliminde ve `.local/ci17/release-result.json` içinde kaydedilir. Run head SHA ile branch SHA eşleşmeden CI başarılı denmez. Bu rapor için eski CI16 başarısı veya CI17'nin başka job başarıları yeterli değildir.

Auto-Deploy durumu bilgisayar yardımcısının sandbox başlangıç hatası nedeniyle doğrudan okunamadı. Kullanıcı bu görev sırasında Render Settings panelinden **Auto-Deploy Off** durumunu şimdi doğruladığını bildirdi. Bu şartla yalnız feature/announcements-core'a push yetkisi vardır. Main merge ve Render deployment yetkisi yoktur. Yeni CI başarısızsa aynı hata/test/commit/push döngüsü sürdürülür; tekrar eden dış erişim engeli ayrı raporlanır.

## 5. Render manual release kontrol listesi

- Mevcut Web Service korunur; branch feature/announcements-core, Auto-Deploy Off, Dockerfile.api, kök build context, health `/api/v1/health`.
- Yalnız yeni doğrulanmış SHA ve bütün CI işleri PASS olduktan sonra ayrı deployment onayı alınır. Bu görev deploy yapmaz.
- NODE_ENV=production; PROCESS_ROLE=api; ACCOUNT_MAIL_PROVIDER=resend; ACCOUNT_MAIL_FROM=`KadroRadar <noreply@bildirim.kadrooradar.com>`.
- RESEND_API_KEY Render'da kayıtlı olduğu kullanıcı tarafından bildirildi; değeri okunmadı/kullanılmadı. ACCOUNT_RATE_HMAC_KEY de server secret store'unda bulunmalı; değeri gösterilmez.
- ACCOUNT_RECOVERY_ENABLED=false; ALLOW_SELF_REGISTRATION=false; SOURCE_SYNC_ENABLED=false; NOTIFICATIONS_ENABLED=false; DOCUMENT_UPLOADS_ENABLED=false kalır.
- ACCOUNT_RECOVERY_ORIGIN hedefi `https://kadrooradar.com` (path yok). Recovery açılmadan önce CORS_ORIGINS içinde exact HTTPS origin bulunmalı; mevcut Render API origin'i korunmalı.
- Production migration16 kullanıcı tarafından uygulanıp AFTER PASS alınmıştır. Bu release için ek migration yok; startup yalnız node apps/api/dist/main.js, migrate/seed/import yoktur. DATABASE_URL ve SYSTEM_ADMIN değiştirilmez.

Render deployment için CI PASS olsa bile bu görevde **NO-GO: ayrı kullanıcı onayı gerekir**. Recovery aktivasyonu için domain/TLS/inbox testi ve ayrı onay gerekir.

## 6. Render → Natro domain eşleştirmesi

DNS veya domain bu görevde değiştirilmez. Kullanıcı şu sırayı izler:

1. Mevcut Natro DNS kayıtlarının listesini kendisi saklar; özellikle XMail MX, SPF/TXT, DKIM, DMARC ve Resend `bildirim` alt alanı kayıtları korunur. Bu kayıtlar sohbete/rapora kopyalanmaz.
2. Render Web Service → Settings → Custom Domains → Add Custom Domain: `kadrooradar.com`. Render'ın o servise gösterdiği DNS talimatlarını açar.
3. Natro alan adı DNS yönetiminde yalnız web hedefi için gerekli kaydı aşağıdaki şekilde eşleştirir. Bu tabloda panelden görülmeyen IP/değer uydurulmaz:

| Natro kayıt adı | Tür | Hedef |
| --- | --- | --- |
| @ / kadrooradar.com | Render paneli A istiyorsa A | Yalnız gerçek panelin verdiği IPv4; bu raporda sahte IP yok |
| @ | Panel ve sağlayıcı destekliyorsa ALIAS/ANAME alternatifi | Yalnız panelde gösterilen servis hedefi; Natro desteği varsayılmaz |
| www | Panel www kaydı istiyorsa CNAME | Mevcut servisin bilinen adresi kadroradar.onrender.com; panelle eşleştirilir |

Mevcut web A/CNAME veya apex AAAA çakışması varsa yalnız ilgili web kaydı panel talimatıyla incelenir; tüm DNS sıfırlanmaz ve mail alt alanları/kayıtları silinmez. Natro ekranında olmayan kayıt türü zorlanmaz. Panel değeri görülmeden DNS işlemi yapılmaz.

4. Render → Verify ile sahiplik/TLS hazır durumu doğrulanır. HTTPS sertifikası geçerli olmadan interstitial/TLS doğrulaması aşılmaz. Mobilin kullandığı kadroradar.onrender.com subdomain erişimi kapatılmaz.
5. `https://kadrooradar.com/account-recovery` aynı backend'den200 dönmeli; `/account-recovery.js`, CSS ve `/api/v1/account/capabilities` aynı domain'den çalışmalı. Ayrı statik host mevcut relative API sözleşmesini karşılamaz.

Resmî referanslar: [Render custom domain](https://render.com/docs/custom-domains), [diğer DNS sağlayıcıları](https://render.com/docs/configure-other-dns). Bu süreç planı panelden güncel değer okunduğu iddiası değildir.

## 7. Resend ve recovery hazırlığı

`bildirim.kadrooradar.com` Verified ve API key Render'da mevcut bilgileri kullanıcı beyanıdır; provider secrets görüntülenmedi. Display-name gönderen adaptörde doğrulanır. Doğrulama maili konusu KadroRadar e-posta doğrulama; reset konusu KadroRadar parola sıfırlama. Body yalnız kısa açıklama ve origin + `/account-recovery#purpose=...&token=...` linkidir; üçüncü taraf analytics yoktur.

32-byte rastgele token, DB'deSHA256; amaç/e-posta binding, tek kullanımlık transaction tüketimi; reset15dk, email verify24saat. Yeniden istek eski tokenı geçersizleştirir. USER-only recovery SYSTEM_ADMIN parolasını değiştirmez. IP/adres/cooldown/global ve confirm limitleri DB-backed HMAC anahtarlarıyla korunur; request202 var/yok kullanıcıyı açıklamaz. Provider timeout8s, sabitHTTPSendpoint, redirect yok, otomatik retry yok, idempotency key; provider body/token/link/parola loglanmaz. Token fragment history'den temizlenir; GET/mail scanner token tüketmez; kullanıcı açık POST onayı verir. Web/mobile hata metinleri teknik secret içermez.

Gerçek inbox/spam/bounce/delivery testi yapılmadı. [Resend domain kılavuzu](https://resend.com/docs/dashboard/domains/introduction) doğrulanmış subdomain ve transactional tracking ayarlarını açıklar. Gerçek test öncesinde tracking kapalı, gönderim yetkisi/kota ve SPF/DKIM/DMARC korunmuş olmalı. Recovery/registration bayrakları bu görevde açılmaz; hazır adaptör teslimat garantisi değildir.

## 8. Tek GET-only production smoke komutu

Yalnız manual deployment ve domain/TLS hazırlığından sonra, doğrulanmış release SHA ile operatör çalıştırır:

```powershell
$release = git log -1 --format=%H -- docs/M16_CI_FIX_AND_PRODUCTION_HANDOFF.md
.\infra\release-http-smoke.ps1 -ExpectedCommit $release
# Custom domain bağlanıp TLS hazır olduğunda:
.\infra\release-http-smoke.ps1 -ExpectedCommit $release -WebOrigin https://kadrooradar.com
```

İlk komut mevcut Render origin'inde, ikincisi web için custom domain'de kontrol eder. Beklenen SHA verilmesi zorunludur; health içindeki release.commit yok/farklıysa FAIL. API/page500/403/404/redirect/timeout, bozuk JSON, eksik header veya açık registration/recovery FAIL ve exit1 verir; hata sahte boş listeye çevrilmez. Çıktı yalnız güvenli phase/code/özet alanlarını içerir. HTTP metodu yalnız GET; kimlik doğrulama, cookie, parola veya provider key göndermez. Bu tur script mock testleri yapıldı; henüz dağıtılmamış yeni SHA için production PASS iddiası yoktur.

## 9. Kalan dış aşamalar

Yeni CI sonucunun doğrulanması; ayrı Render manual deploy onayı; panelden gerçek DNS değerleriyle Natro web kaydı eşleştirmesi; HTTPS doğrulaması; GET-only smoke; ayrı onayla gerçek e-posta teslimatı ve recovery aktivasyonu; fiziksel Android/tek preview build. Bu görev DNS, deployment, gerçek kullanıcı oluşturma, production DB, canlı RSS/Gazette veya EAS işlemi yapmaz.
