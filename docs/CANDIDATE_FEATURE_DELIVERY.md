# Aday özellikleri teslimatı — 25 Ekim 2026

RC1 güncellemesi: admin browser, kaynak scheduler işletimi, scrypt kapasite sınırı, Docker runtime ve legal web akışı artık yerel testlerle doğrulandı; ayrıntılar [RC1_RELEASE_REPORT.md](RC1_RELEASE_REPORT.md). Aşağıdaki ilk teslimat anındaki eksikler bu son raporla birlikte okunmalıdır. Gerçek domain/AAB/FCM/cihaz kapıları sürmektedir.

## Kod ve davranış

Rakip araştırması `COMPETITOR_FEATURE_GAP.md` içindedir. Sayfaların yayıncı beyanları incelendi; rakip uygulama kurulmadı. Marka, kod veya tasarım kopyalanmadı.

| Özellik | Dosyalar | Durum ve kanıt |
| --- | --- | --- |
| Aday hesabı/profili | apps/api/src/candidate.ts, password.ts; mobile/app/profile.tsx | DONE_TESTED: gerçek izole PostgreSQL ve HTTP testinde register/login, profil validation, cookie/CSRF, rol kontrolü, veri export ve hesap silme geçti |
| Kadro koşulları | schema.prisma AnnouncementPosition; candidate.ts PositionController; admin/src/AnnouncementReview.tsx | DONE_TESTED: reviewer kadro oluşturma ve USER rolünün reddi; UI build geçti, tarayıcıda tıklama testi yapılmadı |
| Açıklanabilir eşleştirme | eligibility.ts; mobile/app/matches.tsx ve announcement/[id].tsx | DONE_TESTED: 9 motor kontrolü ve gerçek HTTP eşleşme sözleşmesi. Eksik koşul/profil/bölüm eşdeğerliği tahmin edilmez |
| Kaydetme | SavedAnnouncement; mobile/app/saved.tsx | DONE_TESTED: idempotent save, withdrawn durumunun kayıtlı ilana yansıması, silme ve hesap silme |
| Bildirim planı | notification-plan.ts, notifications.ts; mobile/lib/push.ts; app/notifications.tsx | DONE_TESTED: 8 karar kontrolü; gerçek DB ve taklit Expo send/receipt testi. Gerçek push teslimi BLOCKED_EXTERNAL |
| Android | app.config.js, _layout.tsx, lib/account.ts | Typecheck ve Android JS bundle export başarılı; Expo Doctor 18/18. Gerçek cihazda yeni akışlar doğrulanmadı |
| Gerçek resmî referans | test-official-reference.cjs; packages/official-sources.json | DONE_TESTED: 1 gerçek UAB referansı izole staging/simüle review/publish/archive. Süresi dolmuş; başlangıç/bitiş saatleri veya başvuru URL'si uydurulmadı. Sürekli otomatik toplama değildir |

## API

Hesapsız `GET /announcements`, `/announcements/:id`, `/announcements/archive`, `/historical/*` korunur. İlan detayında kadrolar da döner.

`/api/v1/account` altında:

- POST register, login, logout
- GET/PUT profile
- GET data (kişisel veri export)
- DELETE /account (profil, favori, bildirim ve oturum temizliği; hesap kaydı anonimleştirilir)
- GET saved; PUT/DELETE saved/:id
- GET matches (sayfalı); GET matches/:id (her kadro ve ayrı nedenler)
- PUT push (izin/cihaz token kaydı veya iptali)
- POST notifications/refresh; GET notifications

`GET/POST /api/v1/admin/announcements/:id/positions` kadro koşullarını yönetir. Yazım REVIEWER veya SYSTEM_ADMIN gerektirir; kaynak/evidence şarttır. Mevcut ilan import/review ve ÖSYM inceleme rotaları production'da kullanıcı session/RBAC kullanır. Eski operatör credential ve ADMIN_REVIEW_TOKEN production'da reddedilir.

## Migration ve veri koruması

Beş migration: `202610250001_candidate_features` (profil alanları, oturum, favori, kadro), `202610250002_notifications` (token ve bildirim kuyruğu), `202610250003_auth_rate_limit` (dağıtık giriş limiti ve session indeksleri), `202610250004_saved_deadline_tracking` (doğrulanmış süre uzatma takibi), `202610250005_notification_device_binding` (receipt'in doğru cihaz tokenına hash ile bağlanması). Yalnızca eklemeli; HistoricalPlacement verisi değiştirilmez. SQL incelendi ve yalnızca `kadroradar_ingestion_test_20261023` veritabanına uygulandı. Gerçek yerel DB'ye migration veya ilan yazımı yapılmadı. Salt okunur sayım: onaylı ÖSYM **504**.

## Oturum ve güvenlik

Parolalar rastgele salt ile asenkron scrypt-v2 (N=131072, r=8, p=1) kullanır. Session 8 saatliktir; DB'de tokenın SHA-256 özeti saklanır, her istekte kullanıcı rolü ve silinme durumu okunur. Web cookie HttpOnly/Secure(production)/SameSite Strict; yazımlarda CSRF token gerekir. Mobile bearer oturumu yalnızca bellekte tutulur; uygulama yeniden başlatılınca giriş gerekir. Logout tüm oturumları ve cihaz bildirim kaydını iptal eder. Self-register varsayılan kapalıdır; `ALLOW_SELF_REGISTRATION=true` açıkça etkinleştirir. Sadece USER rolü atanır.

Giriş/kayıt limiti PostgreSQL advisory lock ile IP başına 15 dakikada 10; limit kaydı kısa süreli hashed IP içerir. Reverse proxy ancak güvenilir tek-hop topolojide TRUST_PROXY_HOPS=1 olmalıdır. Genel API limiti halen process içidir. E-posta sahipliği doğrulama, parola sıfırlama, MFA, güvenlik penetrasyon testi ve kapsamlı erişilebilirlik denetimi tamamlanmadı; production-ready iddiası yoktur.

İlk admin: API build sonrası güvenilir operatör ortamında NEW_ADMIN_EMAIL, NEW_ADMIN_PASSWORD (en az16 karakter), NEW_ADMIN_ROLE tanımlanıp `node apps/api/create-admin.cjs --create` çalıştırılır. Parola/secret repoya veya EXPO_PUBLIC değişkenlerine konmaz. Script mevcut kullanıcıların rolünü yükseltmez. Bu görevde gerçek admin hesabı oluşturulmadı.

## Bildirim sınırları

Varsayılan kapalı: `NOTIFICATIONS_ENABLED=true` yalnızca FCM/EAS credentials ve kullanıcı izinleri doğrulandıktan sonra açılmalıdır. İzin aktifken 15 dakikalık worker; transaction lock ve unique event key ile plan tekilleştirme, atomik send claim, günde2/haftada7 yeni bildirim sınırı uygulanır. Gönderim öncesinde güncel izin ve eşleşme yeniden kontrol edilir. Belirsiz eşleşmede uygunluk bildirimi üretilmez. Kaydedilen ilanın değişimi/iptali ve değişen son tarihleri yeni olay anahtarlarıyla izlenir.

Expo ticket kabulü cihaz teslimi değildir; receipt kontrolü yapılır, DeviceNotRegistered tokenı kaldırılır. Ağ sonucu belirsizse UNKNOWN kalır ve mükerrer riskinden kaçınmak için otomatik tekrar gönderilmez; operatör incelemesi gerekir. Worker queue ve gönderim/receipt testlerinde fetch taklit edildi; dış ağa push atılmadı. Ayrı kaynak scraping scheduler'ı halen eksiktir ve izin belirsiz tüm kaynaklarda otomasyon pasiftir.

Android: GOOGLE_SERVICES_JSON isteğe bağlı EAS file env yolu; FCM v1 credential EAS üzerinde ayrıca kurulmalıdır. expo-notifications eklendi, Expo SDK54/React19/RN0.81 ve Android package/EAS id korundu. Yeni native build gerekir. Expo Go gerçek Android remote push testi yerine geçmez.

## PowerShell doğrulamaları

```powershell
pnpm --filter @kadro/api prisma:generate
pnpm --filter @kadro/api build
pnpm --filter @kadro/admin build
pnpm --filter @kadro/mobile exec tsc --noEmit
# Test URL mutlaka ayrı kadroradar_ingestion_test_* DB olmalı.
pnpm --filter @kadro/api exec prisma migrate deploy
Set-Location apps/api
node test-eligibility.cjs
node test-notification-plan.cjs
node test-mobile-network.cjs
node test-candidate.cjs
node test-notification-worker.cjs
node test-ingestion.cjs
```

Migration deploy komutu production URL ile kullanılmadan önce yedek ve açık onay gerekir. CI ayrı PostgreSQL servisinde bu testleri çalıştıracak biçimde genişletildi; GitHub üzerinde çalıştırıldığı iddia edilmiyor.

## Dış bağımlılıklar ve tamamlanmayanlar

İzinli güncel otomatik veri kaynağı ve production ilanları, gerçek production migration onayı/yedeği, HTTPS domain/hosting, EAS FCM credentials, gerçek Android cihaz testi, imzalı AAB ve Play Console hâlâ gereklidir. Bu görevde production'da yayımlanan ilan:0; Android'de yeni akışla doğrulanan:0. Gerçek referansın izole testte arşivlenmesi bu sayılara eklenmez. Privacy/Data Safety metinleri yeni profil ve push veri işleme kapsamına göre tamamlanıp gerçek işletmeci/destek bilgileriyle yayımlanmalıdır. Mevcut Docker/HTTPS hazırlığı gerçek deploy değildir.
