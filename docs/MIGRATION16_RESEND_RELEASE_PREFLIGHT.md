# Migration 16 ve Resend release preflight

Backup geçişi için yeni yerel15/16 uyumlu araç: [Production backup ve release](MIGRATION16_PRODUCTION_BACKUP_AND_RELEASE.md). Bu, gerçek backup yapılmış veya eski23 operatörün yazma akışları güncellenmiş demek değildir.

Bağlantı hata sınıflandırması güncellemesi: [Migration16 connection diagnosis](MIGRATION16_PREFLIGHT_CONNECTION_DIAGNOSIS.md). Eski genel hata yerine aşama ve allowlist kodları kullanılır; önceki test/production sınırları değişmez.

2 Kasım 2026, Europe/Istanbul. Branch `feature/announcements-core`; HEAD ve kullanıcı tarafından bildirilen production release `4e5b86c5de22210eef254b682df6890ba96c4bca`. Yeni çalışmalar yereldir. Commit/push/deployment/EAS build, gerçek e-posta ve production DB bağlantısı/yazımı yapılmadı. Render secret değerleri okunmadı. Production15 migration/8.611 kayıt/SYSTEM_ADMIN ve Resend Verified bilgileri kullanıcı beyanıdır; bu görev bunları production erişimiyle yeniden doğrulamadı.

## Karar

**Yerel migration/restore ve kod testleri: GO. Production geçişi ve recovery aktivasyonu: NO-GO.** Kullanıcı migration onayı, yeni production backup+ayrı restore kanıtı, operatör geçiş planı, HTTPS web/domain doğrulaması, release CI/clean image ve ayrı mail testi henüz gerekir. Başarılı sentetik restore gerçek production yedeği değildir.

## Proje çalıştırma

Docker Desktop kullanıcı kurulumundan başlatıldı; mevcut `infra-db-1` açıldı. API3000/Admin5173/Metro8081, mevcut PowerShell wrapper ve tek-owner modeliyle başlatıldı. Üç port HTTP200; owner identity VERIFIED. Yerel GET capabilities: selfRegistration=false/passwordReset=false. Ana yerel DB'ye migration uygulanmadı; yeni recovery tablolarının yerel ana DB'de hazır olduğu iddia edilmez. Auth mutasyon testleri ayrı disposable DB'lerde yapıldı.

```powershell
Set-Location C:\projects\KadroRadar
.\infra\dev.ps1 -Action status
# İş bitince yalnız doğrulanan proje ağacını durdurmak için:
.\infra\dev.ps1 -Action stop
# Yeniden başlatma (foreground):
.\infra\dev.ps1 -Action start
```

Doğrudan göreli `node infra/dev.cjs start` çağrısı owner identity kontrolünde reddedildi. Tam dosya yolunu kullanan mevcut wrapper çalıştı; güvenlik doğrulaması kaldırılmadı ve süreç yöneticisi değiştirilmedi. Başka Node projelerine dokunulmadı.

## Migration denetimi

`apps/api/prisma/migrations/20261031000100_account_recovery/migration.sql` BEGIN/COMMIT içinde4 yeni tablo, FK, indeks ve CHECK ekler. Mevcut User/SYSTEM_ADMIN/HistoricalPlacement kolonları değişmez. DROP/TRUNCATE/DELETE DML veya veri güncellemesi yoktur. FK'nin `ON DELETE CASCADE` tanımı mevcut satırları silen bir komut değildir; gelecekteki fiziksel parent silmede yeni child kayıtların davranışını tanımlar. Uygulamanın hesap silmesi mevcut anonimleştirme sözleşmesini korur ve yeni recovery kayıtlarını temizler.

15 eski migration dosyası yayımlanmış SHA ile normalize LF üzerinden birebir karşılaştırıldı: değişmemiş. Yeni sabit `infra/migration16-manifest.json`16 isim ve SHA-256 içerir. Yerel SQL değişirse preflight checksum hatasıyla durur; manifesti körlemesine yeniden üretmek bir onay yöntemi değildir. Token hash/purpose/TTL/consumption CHECK'leri, user/purpose başına bir pending partial unique index, tokenHash unique, User FK ve expiry/rate/audit indeksleri incelendi. Prisma'da ifade edilemeyen CHECK/partial index SQL'de korunur.

Recovery kapalı olsa bile yeni backend'in hesap silme yolu yeni tablolara erişir. **Yeni backend deployment'ından önce migration16 gerekir.** Production migration bu görevde uygulanmadı. `migrate deploy` tekrarı16'yı ikinci kez çalıştırmaz; SQL dosyasını elle ikinci kez çalıştırmak desteklenmez/idempotent kabul edilmez.

## İzole dump → restore → migration kanıtı

`node infra/test-migration16-restore.cjs` iki ayrı rastgele adlı PostgreSQL16 konteyneri oluşturur; yalnız oluşturduğu konteynerleri temizler. `.env` yüklemez, loopback rastgele port ve kendisinin oluşturduğu kimlik bilgilerini kullanır. Kalıcı kanıt/dump yalnız `.local/migration16/<run>/` altında; Git'e girmez.

| Aşama | Sonuç |
| --- | --- |
| İlk15 migration, sentetik SYSTEM_ADMIN+USER ve mevcut session | PASS |
| HistoricalPlacement / ImportRow |8.611 /8.611 **sentetik** kayıt |
| Diğer başlangıç sayıları | User2, CandidateSession1, PlacementRound1, SourceDocument1, ImportBatch1, ReviewAudit1, Announcement0 |
| PG16 custom dump, PGDMP imzası ve pg_restore list | PASS; dump SHA-256 kaydedildi |
| Ayrı PG16'ya exit-on-error restore |9 tablonun count/aggregate hash değerleri aynı |
| Restore edilmiş15 üzerine Prisma deploy ile16 |9 tablo aynı;16 migration checksum doğrulandı |
| Yeniden migrate deploy | NO_OP;16 satır ve eski veri aynı |
| Constraint negatif testleri | Yanlış purpose/hash, TTL üst/alt sınırı, FK, duplicate pending/token reddi |
| Eski backend | Yayımlanmış4e5b86c… kaynak kodu ayrı klasörde derlendi; yeni şemada health/list8611 ve SYSTEM_ADMIN login/logout PASS; eski veriler aynı |
| Yeni backend | Auth readiness73 + recovery API senaryoları PASS; mail transport fake |
| Son historical/admin koruma | Historical aggregate aynı; başlangıç SYSTEM_ADMIN hash'i aynı |

Son test23 kontrol PASS. Veri aggregate hash'leri deterministik sıralı JSON üzerinden MD5; dump dosyası SHA-256 ile ayrıca doğrulanır. Bunlar sentetik bütünlük karşılaştırmalarıdır; production satırları veya parola hash'leri kopyalanmadı. Eski backend testi yayımlanmış kaynak + mevcut kurulu aynı bağımlılık ortamıdır; eski Render Docker image'ının birebir çalıştırıldığı iddia edilmez.

CI typescript işi bu testi içerir; eski release SHA'nın checkout'ta bulunması için fetch-depth0 gerekir. Remote CI çalıştırılmadı. Test başarısızsa yalnız phase/error kind/allowlist code yazılır; ham Prisma mesajı, SQL, bağlantı URL'si veya subprocess stderr yazılmaz. İlk test harness'ındaki config yolu hataları giderilip zincir yeniden baştan çalıştırıldı.

## Operatör uyumluluğu ve yeni salt okunur araç

Kesin engel `infra/osym-production.cjs` ortak preflight'ındaki `verify(names.length===15,'PF_LOCAL_MIGRATION_COUNT')` satırıdır. Admin status aynı preflight'ı kullanır. Bu16-dosyalı checkout'ta eski araç15'li production'a dahi yerel manifest aşamasında durur.16 sonrasında aynı araçları kullanmak da doğru değildir. İzole test gerçek eski preflight çağrısının bu kodla fail-closed durduğunu doğruladı.

Korunan23 operatör/diagnostik dosyasının hash'i değişmedi. Sabit15 kontrolü kaldırılmadı veya `>=15` yapılmadı. Yeni, dar kapsamlı `infra/migration16-preflight.cjs/.ps1` eski import/backup/admin işlemlerini çalıştırmaz:

- Exact Render host/database/port eşlemesi ve mevcut TLS strict hedef doğrulamasını kullanır; localhost'a fallback/.env yoktur.
- PostgreSQL16/public/expected database ve transaction_read_only=on kontrol eder.
- `before`: tam15 uygulanmış migration ve yalnız bilinen16 pending; `after`: tam16. Eksik/fazla/unknown/unfinished/rolled-back geçmiş ve checksum farkı reddedilir.
- Çıktı yalnız phase, migration/pending adı, historical ve aktif SYSTEM_ADMIN sayısı, write=false içerir. Historical8611 değilse veya aktif SYSTEM_ADMIN yoksa M16_RELEASE_DATA_COUNTS ile durur. Adres, hesap e-postası, parola/token/hash veya ham hata yoktur.
- Before/after, bilinmeyen migration, checksum ve unfinished durumları izole testte doğrulandı. Production'a karşı çalıştırılmadı.

Operatörün kendi terminalinde güvenli salt okunur kontrol:

```powershell
Set-Location C:\projects\KadroRadar
.\infra\migration16-preflight.ps1 -Phase before
# Yalnız ayrı onaylı migration SONRASI, yine read-only:
.\infra\migration16-preflight.ps1 -Phase after
```

Wrapper host/database ve URL'yi yerel operatörden ister; URL gizli girişlidir ve process environment eski haline döndürülür. Değerleri Codex'e/sohbete göndermeyin. Bu komut backup, admin creation/reset veya migration değildir; production hedefinde historical8611 ve aktif admin sayısını operatör değerlendirmelidir.

**Backup operasyonu hâlâ ayrı onaylı hazırlık gerektirir:** mevcut protected araçların16 uyumlu sürümü yoktur. Seçenekler: (a)15 migration manifestli, gözden geçirilmiş bağımsız operatör checkout/bundle ve mevcut doğrulanmış backup koduyla yeni15 yedeği; (b) ayrı kapsamda exact15/exact16 manifest desteği ve16 sonrasındaki recovery tablolarını da restore/hash kontrolüne alan operatör güncellemesi. Bundle'a eski23 yerel güvenlik düzeltmeleri eksiksiz dahil edilmelidir; yalnız eski Git SHA'ya dönmek bu uncommitted düzeltmeleri içermez. Bu task böyle bir production bundle'ı hazırlayıp gerçek backup almış gibi davranmaz. Yeni preflight, backup VERIFIED makbuzu yerine geçmez. Mevcut backup/makbuzlar değişmedi.

## Resend readiness ve düzeltme

Kullanıcı tarafından belirtilen mail domain'i `bildirim.kadrooradar.com`; Ireland/eu-west-1 ve DNS Verified bilgileri kullanıcı beyanıdır. Secret veya Dashboard okunmadı. Save only ile kaydedilmiş environment değerlerinin çalışan release'e geçtiği varsayılmaz.

Gerçek uyumsuzluk düzeltildi: önceki adapter yalnız yalın mailbox kabul ediyor ve istenen display-name biçimini reddediyordu. `accountMailFrom()` artık yalın tek adresi veya sınırlandırılmış tek `Name <mailbox>` biçimini kabul eder; CRLF/control karakter, adres listesi, trailing metin ve header injection reddedilir. Resend'in [resmî API sözleşmesi](https://resend.com/docs/api-reference/emails/send-email) display name biçimini destekler. Mail key/sender environment değeri okunmadan, yalnız görev metnindeki public biçimle test edildi.

Adapter testi18 kontrol PASS: from biçimi, injection negatifleri, sabit `https://api.resend.com/emails`, POST, idempotency key, redirect:error, bounded signal, non-2xx ret ve plaintext mail sözleşmesi. Region alanı URL'ye yanlış taşınmadı; sending region domain/provider hesabı ayarıdır. Gerçek key kullanılarak API isteği gönderilmedi.

Recovery özellikleri kayıt politikasından ayrıdır. Kayıt kapalıyken ayrı recovery aktivasyonu mevcut USER hesaplarında çalışabilir; kayıt otomatik açılmaz. SYSTEM_ADMIN public reset/verification kapsamına alınmaz. Token32-byte, hash-only DB, email/purpose binding,15 dakika/24 saat TTL, atomik tek tüketim, reissue invalidation, session revoke, CSRF/origin, enumeration-neutral202, rate/cooldown/global bütçe ve şifreli SecureStore korunur.

Mail işi bellekte sınırlı ve best-effort'tur; kalıcı outbox/teslim garantisi yoktur. Provider timeout8 saniye, redirect/retry yok. Non-2xx/network hatasında ilgili challenge iptal edilir; ham response loglanmaz. Sonradan bounce/complaint için webhook/suppression worker uygulanmış değildir; provider accepted teslim edildi anlamına gelmez. Ayrı onaylı pilotta dashboard delivery/bounce takibi ve erişim/retention politikası zorunludur; unattended operasyon için bu eksik karara bağlanmalıdır. Open/click tracking kapalı olmalı.

Yalnız yapılandırma şeması (hiçbir secret değeri okunmadı):

| İsim | Gereksinim |
| --- | --- |
| ACCOUNT_RECOVERY_ENABLED | Şimdi false; ayrı aktivasyon kararı |
| ACCOUNT_MAIL_PROVIDER | resend adaptör seçimi |
| ACCOUNT_MAIL_FROM | Doğrulanmış domain'de tek gönderici; display name desteklenir |
| RESEND_API_KEY | Yalnız Render secret; gönderim için gerekli scoped izin |
| ACCOUNT_RATE_HMAC_KEY | En az32 karakter server secret; Git/mobil bundle/sohbette bulunmaz |
| ACCOUNT_RECOVERY_ORIGIN | Hedef web/API aynı origin ve HTTPS; path/trailing slash yok |
| CORS_ORIGINS | Gerçek web origin'i ve gerekli mevcut admin origin'leri exact listede |

HMAC key ve origin'in hazır olduğu kullanıcı tarafından bildirilmedi; var kabul edilmez. Flag açık + eksik yapılandırmada backend startup reddeder. Mevcut production selfRegistration=false/recovery=false kalır.

## Domain, HTTPS ve web yayın planı

Hedef `https://kadrooradar.com/account-recovery`; kullanıcıdaki çift-o yazımı aynen korunur. Mail subdomain DNS doğrulaması apex web HTTPS'nin hazır olduğunu kanıtlamaz. URL'nin yayında olduğu test edilmedi veya varsayılmadı.

**Öneri mevcut Render Web Service'e custom domain eklemek.** `main.ts` `/account-recovery` route'unu ve Docker web COPY ile HTML/CSS/JS'yi hazır sunar; web fetch `/api/v1/account/...` aynı origin'i kullanır. Mevcut mobil API onrender adresinde kalabilir. Dashboard Settings→Custom Domains'te apex eklenir; DNS sağlayıcısında yalnız Render'ın o servis için verdiği kayıtlar uygulanır ve Verify/TLS sonucu kontrol edilir. Mail/DKIM/return-path kayıtları silinmez/değiştirilmez. `ACCOUNT_RECOVERY_ORIGIN` hedef apex origin'i olur, CORS listesine eklenir. Onrender subdomain kapatılmamalıdır; mobil istemci hâlâ onu kullanır.

Render [custom domain](https://render.com/docs/custom-domains) desteği ve [yönetilen TLS](https://render.com/docs/tls) sağlar; planın mevcut domain kotası kontrol edilmelidir. Ek ücretli hosting bu tasarım için gerekli görünmüyor. Hesap/plan kotası ve DNS ayarlarında bu görev değişiklik yapmadı.

| Seçenek | Değerlendirme |
| --- | --- |
| Mevcut Nest/Render origin | Mevcut relative API ve CSP self ile uyumlu; önerilen, az dağıtım noktası |
| Ayrı statik hosting | Salt dosya yüklemek yeterli değil: relative `/api` statik sunucuya gider. Onaylı reverse proxy `/api` routing veya ayrıca allowlist/CSP/CORS ile kontrollü API origin tasarımı gerekir. Bu seçenek için kod desteği tamamlanmış sayılmaz |

Fragment token, history temizliği, GET'te tüketmeme, explicit POST, no-referrer/no-store, CSP self ve frame engeli, analytics olmaması korunur. Web test11 kontrol PASS;393×851 mobil viewport/touch Chromium emülasyonu, yatay taşma yok, verification/reset ve disabled state, ikinci link aynı sekmede PASS. Bu gerçek Android Chrome cihaz testi değildir. Gerçek Chrome link açma, reload, süresi dolan/reused token, klavye/erişilebilirlik ve uygulamaya dönüş fiziksel preview kabulünde yapılmalı.

## Sıralı production kontrol listesi

Her adım ayrı GO şartını karşılamadan sonraki adıma geçilmez. Aşağıdaki yazma/deploy adımları bu görevde yetkilendirilmiş değildir.

| Sıra | Adım | GO | NO-GO |
| --- | --- | --- | --- |
|1| Git/diff/migration manifest |15 eski SQL sabit;16 incelendi; secrets/özel dosya yok | Beklenmeyen dosya/checksum/dependency |
|2| Yeni production backup | Gözden geçirilmiş15 uyumlu araç/bundle, açık backup yetkisi | Bu checkout'taki eski hardcoded15 araç veya stale receipt |
|3| Ayrı restore doğrulaması | Kaynakla aynı count/hash, dump SHA, admin/session dahil VERIFIED | Yalnız dosya oluşması veya sentetik test makbuzu |
|4| Read-only migration durumu | before PASS, pending yalnız16;8611 ve mevcut admin korunmuş | Başka pending/failed/checksum veya yanlış hedef |
|5| Kullanıcı onaylı migration deploy | SQL, hedef, backup ve release planı açık onaylı; mevcut eski backend açık kalabilir | Bu task onayı varmış gibi otomatik yazma |
|6| GitHub release push | Eksiksiz kaynak/migration/test manifesti ve kullanıcı push onayı | Özel dump/XML/env/key veya eski23 araç kontrolsüz staged |
|7| CI | Yeni SHA'nın tüm işleri, restore testi ve clean image PASS | Eski CI16 sonucunu yeni koda mal etmek |
|8| Render manual deploy | Migration after PASS; flags kapalı; doğru branch/SHA; yapılandırma tamam | Migration öncesi backend deploy veya Save only'yi deploy saymak |
|9| Health/8611 | Release SHA/health, historical8611/pagination, announcements/capabilities/legal ve HTTPS doğru | Sayı/rol/oturum regresyonu |
|10| Kontrollü Resend pilot | Açık mail/activation onayı; doğrulanmış sender/HTTPS link, tracking kapalı, test alıcısı onaylı | Şu anki kapsamda mail gönderimi/flag açılması |
|11| Verification/recovery | Onaylı test hesabı; delivery, expiry/reuse/concurrency, reset sonrası session revoke; bounce takibi | Sahte transport'u gerçek teslim sanmak |
|12| Kayıt politikası | Ayrı kullanıcı/ürün güvenlik kararı | Recovery testi nedeniyle ALLOW_SELF_REGISTRATION açmak |
|13| Android preview | Backend kabulü, destek/legal, cihaz planı, EAS maliyet/signing/build onayı | Otomatik EAS build veya eski APK'yı yeni SecureStore sürümü sanmak |

Adım5'in push/CI öncesinde yapılması yalnız eski backend ile eklemeli şema uyumluluğu test edildiği için teknik olarak mümkündür; CI için rollback planı olmadan erken production migration önerilmez. Yazma onayından önce migration-ready release, test/CI planı ve geri dönüş kararı ayrıca incelenmelidir. Backend rollback'te yeni tabloları DROP etmek gerekmez; yeni recovery kapalı tutularak eski uyumlu backend'e dönme planı değerlendirilir. Schema downgrade/reset otomatik değildir.

## Kullanıcı komutları ve teslim kapsamı

Güvenli yerel testler:

```powershell
Set-Location C:\projects\KadroRadar
node infra/test-migration16-restore.cjs
node apps/api/test-account-mail.cjs
node apps/api/test-recovery-browser.cjs
node infra/test-mobile-session.cjs
node infra/test-release-manifest.cjs
python infra/check-release-secrets.py
```

Production için şu anda önerilen tek yeni DB işlemi yukarıdaki **read-only before** komutudur. Migration/backup için mevcut checkout'tan uygulanacak komut verilmesi eski operatör engeli çözülmeden güvenli değildir. Açık migration onayı gelene kadar `prisma migrate deploy`, seed/import/bootstrap/reset çalıştırılmamalı; varsayılan DATABASE_URL ile migrate status production kontrolü sanılmamalıdır.

Yeni dosyalar: `infra/migration16-preflight.cjs/.ps1`, `infra/migration16-manifest.json`, `infra/test-migration16-restore.cjs` ve bu rapor. Değişenler: sender parser/unit testi, mock recovery hedef URL testi, mobil viewport web testi, CI ve release manifesti. Önceki SecureStore/web/Gazette/recovery geliştirmeleri korundu.23 operatör dosyası SHA kontrolüyle aynı; eski15 SQL aynı; Git index boş; commit/push yok. Yeni read-only operatör kodu ayrıca review edilmelidir; manifestte bulunması otomatik deployment/commit onayı değildir.

API/admin build, mobil TypeScript, SecureStore23, preview config10, mail18 ve mobile web11 testleri PASS. İzole migration/restore23 ve yeni backend auth testleri PASS. Yeni remote CI, temiz Docker image build ve gerçek telefon doğrulaması bu görevde yapılmadı. Release manifest PASS:128 candidate dosyası,23 ayrı operatör dosyası,188 göreli import,0 kapsam dışı değişiklik. Secret scan PASS:841 nesne/dosya ve0 bulgu; tarama heuristic olduğundan manuel review hâlâ gerekir. PowerShell5.1/7 wrapper syntax PASS; gerçek production bağlantısıyla test edilmedi.

SOURCE_SYNC_ENABLED, DOCUMENT_UPLOADS_ENABLED, NOTIFICATIONS_ENABLED ve Gazette/Kariyer policy değişmedi; otomasyon/yayın yok. Üretim SYSTEM_ADMIN,8.611 kayıt ve mevcut yedekler bu görev tarafından okunmadı/değiştirilmedi. Kalan kararlar: operatör/backup geçiş kapsamı; production migration ve push/deploy onayı; apex HTTPS; HMAC/origin yapılandırması; sonra ayrı kontrollü gerçek mail testi ve en son Android build onayı.
