# Hesap kurtarma, e-posta ve Gazette release hazırlığı

31 Ekim 2026. Branch `feature/announcements-core`, HEAD `4e5b86c5de22210eef254b682df6890ba96c4bca`. Bu rapor yerel çalışma ağacını anlatır. Yeni commit, push, remote CI, Render deployment, EAS build veya production DB işlemi yapılmadı. Production 8.611 tarihsel kayıt ve SYSTEM_ADMIN bilgisi önceki doğrulanmış kullanıcı beyanıdır; bu görev production DB'ye bağlanmadı.

## 1. Auth ve çalışan kurtarma altyapısı

Mevcut salted scrypt-v2, 12–128 parola sınırı, USER rolü, CSRF, cookie güvenliği, 8 saat mutlak oturum, SecureStore, `{}` boş profil düzeltmesi, profil/favori/silme korunur. Production kayıt politikası değiştirilmedi. Kayıt kapalı olduğunda ret beklenen davranıştır; yeni mail özelliğini açmak kayıt politikasını açmaz.

Yeni endpoint'ler `/api/v1` altında:

| Endpoint | Davranış |
| --- | --- |
| GET `/account/capabilities` | Eski alanlar korunur; `emailVerification` ve `passwordReset` eklenir. Yapılandırma/flag yoksa false |
| GET `/account/security` | Yalnız hesabın sahibi: emailVerified/recoveryAvailable; hash/token/adres döndürmez |
| POST `/account/email-verification/request` | Oturum + USER rolü; cookie mutasyonunda CSRF; adres sunucudaki kullanıcıdan alınır |
| POST `/account/email-verification/confirm` | Token sahipliği, amaç, e-posta binding, TTL, tek kullanımlık atomik tüketim |
| POST `/account/password-reset/request` | Var/yok/silinmiş/yönetici/limitli adreslerde aynı 202 gövdesi; gerçek gönderim sözü verilmez |
| POST `/account/password-reset/confirm` | Token + 12–128 yeni parola; scrypt-v2; tüm oturumları ve push iznini iptal; otomatik giriş yok |

Mail yokken request/confirm 503 `RECOVERY_UNAVAILABLE`; sahte başarı veya production fake transport seçeneği yoktur. Kimliği doğrulanmış mutasyonlarda mevcut yetki/CSRF retleri ayrıca korunur. Public kurtarma USER ile sınırlıdır; SYSTEM_ADMIN erişimi veya parolası bu akışla değişmez. E-posta doğrulaması mevcut hesaplara veya yöneticilere zorunlu login kapısı olarak uygulanmadı; kayıt açılışı ve doğrulama zorunluluğu ayrı işletmeci kararıdır.

Token 32-byte CSPRNG, DB'de SHA-256; amaç ve mevcut normalize e-posta hash'ine bağlı. Reset 15 dakika, doğrulama 24 saat. Yeniden istek eski tokenı tüketilmiş yapar. User satır kilidi ve koşullu update aynı transaction içinde yalnız bir tüketiciye izin verir. Login de aynı user kilidi altında hash'i yeniden kontrol eder: resetten önce eski parolayı doğrulayan bir istek, resetten sonra yeni session oluşturamaz. Hesap silme challenge/verification/kullanıcıya bağlı recovery audit kayıtlarını siler.

Request limitleri DB-backed HMAC anahtarlarıyla IP/amaç 5/15 dakika, adres/amaç 3/saat ve 60 saniye cooldown; toplam 50/gün. Confirm IP/amaç 20/15 dakika. Limitlenen request de aynı 202'yi döndürür; confirm güvenli rate-limit hatası verir. Global bütçe bilinmeyen adreslerde de tüketilir; bu bilinçli muhafazakâr kötüye kullanım sınırıdır ve hizmet engelleme/sağlayıcı kotası açısından izlenmelidir. Request minimum 300ms bekler; sağlayıcının ağ süresi yanıta bağlanmaz. Bu, ağ koşullarında matematiksel sabit zaman garantisi değildir.

Gönderim en çok 8 bellek işi/süreç ile sınırlıdır; kalıcı plaintext outbox yoktur. Process crash/doluluk halinde gönderim garantisi yoktur: kullanıcı cooldown sonrasında tekrar isteyebilir, önceki token geçersizleşir. Resend çağrısı sabit HTTPS endpoint, TLS doğrulaması, 8 saniye timeout, redirect reddi, idempotency key ve otomatik retry olmadan çalışır. Provider response body, token/link, alıcı, parola ve ham exception loglanmaz. Hatalı gönderimde yalnız ilgili token geçersizleştirilir. `MAIL_PROVIDER_ACCEPTED` teslim edildi anlamına gelmez. Webhook/delivery/bounce otomasyonu bu sürümde yok; ilk aktivasyonda sağlayıcı dashboard'u ve manuel teslimat/bounce kontrolü gerekir.

Süresi dolmuş challenge'lar 7 gün, recovery audit 30 gün sonra sonraki gönderim sırasında temizlenir. Bu opportunistic temizliktir; trafik yokken çalışan retention scheduler'ı yoktur. Production açılışı öncesinde retention operasyonu karara bağlanmalıdır.

## 2. Sağlayıcı karşılaştırması

Resmî sayfalar 31 Ekim 2026 tarihinde kontrol edildi. Fiyatlar vergi/bölge farkları ve sonraki değişiklikler öncesindeki yayımlanmış değerlerdir; hesap açılmadı veya ödeme yapılmadı.

| Sağlayıcı | Ücretsiz/düşük maliyet; limit | Domain ve kimlik doğrulama | Entegrasyon / izleme |
| --- | --- | --- | --- |
| Resend — birincil öneri | Ücretsiz 3.000/ay, 100/gün; Pro $20/ay, 50.000/ay; ücretli planda günlük limit yok | Sahip olunan domain doğrulaması; SPF/DKIM; ayrıca DMARC kurulumu | REST API ve SMTP. NestJS Node fetch ile bağımlılıksız adaptör uygulandı. Dashboard/API logları, idempotency ve delivery insights |
| Brevo — alternatif | Ücretsiz 300/gün. Ayrı sabit aylık ücretsiz garanti bu incelemede doğrulanmadı; günlük kota aylık sözleşme diye sunulmaz. Ücretli tutar seçilen hacme bağlı | Gönderici domain; Brevo code/DKIM/DMARC; SPF/return-path hizalaması hesap ayarlarıyla doğrulanmalı | API/SMTP; transactional events/webhooks ve hata takibi. Bu görevde Brevo runtime adaptörü yazılmadı |
| Amazon SES | Standart outbound $0,10/1.000 + ek hizmet/veri ücretleri. Ücretsiz kredi koşulları doğrulanmadı. Sandbox 200/24s ve 1/sn; production kota hesap/bölgeye bağlı | Domain identity; DKIM/SPF/DMARC; sandbox'ta alıcı doğrulaması, production access başvurusu | API/SMTP; IAM ve bölge/izin yönetimi nedeniyle başlangıçta daha fazla kurulum. CloudWatch/events/bounce/complaint izleme |
| Postmark | Test için ücretsiz 100/ay; Basic $15/ay başlangıç (10.000 hacim seçimi). Ücretsiz plan için ayrıca günlük garanti doğrulanmadı | Gönderici/domain onayı ve DNS kayıtları aktivasyonda ayrıca doğrulanmalı | Fiyat sayfasında detaylı analytics ve teslim edilebilirlik; bu incelemede SMTP/domain ayrıntıları ayrıca doğrulanmadığı için karar girdisi olarak kesinleştirilmedi |

Resend düşük hacim, mevcut Node fetch altyapısı ve az kurulum nedeniyle önerilir; 100/gün yetmezse Brevo alternatifidir. **Türkiye'deki işletmeci hesabının kabulü, ödeme imkânı, tüm Türk alıcı domain'lerine teslimat ve veri aktarım sözleşmesi bu görevde doğrulanmadı.** API erişiminin bulunması gerçek hesap/teslimat garantisi değildir; dört sağlayıcı için de deneme ve işletmeci değerlendirmesi gerekir.

Resmî kaynaklar: [Resend fiyat](https://resend.com/pricing), [domain](https://resend.com/docs/dashboard/domains/introduction), [DMARC](https://resend.com/docs/dashboard/domains/dmarc), [gönderim/API/SMTP ve izleme](https://resend.com/docs/dashboard/emails/introduction); [Brevo plan/kota](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans), [API](https://developers.brevo.com/docs/send-a-transactional-email), [domain](https://developers.brevo.com/docs/domain-authentication-and-verification), [SMTP](https://help.brevo.com/hc/en-us/articles/115000188150-Troubleshooting-Issues-with-Brevo-SMTP); [SES fiyat](https://aws.amazon.com/ses/pricing/), [sandbox](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html), [auth](https://docs.aws.amazon.com/en_en/ses/latest/dg/email-authentication-methods.html), [izleme](https://docs.aws.amazon.com/ses/latest/dg/monitor-sending-activity.html); [Postmark fiyat](https://postmarkapp.com/pricing).

## 3. Mobil ve web UX

Profilde Şifremi unuttum ve doğrulama durumu/yeniden bağlantı yalnız server capabilities true ise görünür. Doğrudan kurtarma ekranına gidilse bile servis kapalıyken form yoktur. Yanlış parola, kapalı kayıt, yetkisiz işlem ve süresi dolmuş link teknik hata metni yerine kullanıcı dostu mesaj gösterir. SecureStore düz metin fallback olmadan korunur. Mobil istekler bearer token kullanır ve `credentials:omit` ile eski login cookie’lerini taşımaz; böylece oturumsuz kurtarma isteği eski cookie/CSRF durumuna takılmaz. Bu ağ sözleşmesi session ve mobil network testleriyle doğrulandı. Kayıt sonrası yeni hesabın doğrulaması, giriş yapınca Profil üzerinden istenir; otomatik mail gönderilmiş denmez.

Yeni `/account-recovery` web sayfası API ile aynı HTTPS origin'de sunulmak üzere hazırlandı. Token query/path yerine fragment'te gelir; script history'yi temizler. GET/mail tarayıcısı token tüketmez; açık POST onayı/yeni parola gerekir. Aynı sekmede ikinci fragment bağlantısının yüklenmemesi tarayıcı testinde bulundu ve hashchange yeniden yüklemesiyle düzeltildi. No-store/no-referrer/CSP/frame engeli, yalnız same-origin script/style/connect, analytics/üçüncü taraf olmaması korunur. Token saklanmaz; yeni parola başarıda temizlenir. Sahte domain/deep link eklenmedi; e-postadaki HTTPS sayfa tamamlanınca kullanıcı uygulamaya dönüp giriş yapar.

## 4. Prisma ve deployment sırası

Yeni migration: `apps/api/prisma/migrations/20261031000100_account_recovery/migration.sql`.

SQL incelendi: BEGIN/COMMIT içinde yalnız 4 yeni tablo (`AccountChallenge`, `AccountEmailVerification`, `AccountRecoveryRate`, `AccountRecoveryAudit`), indeksler, FK ve CHECK'ler. Drop/truncate/seed, mevcut User/HistoricalPlacement/CandidateSession kolon/rol değişikliği yok. TTL/hash/purpose CHECK ve user/purpose başına tek pending partial unique index Prisma dışında SQL ile korunur. Önceki 15 migration değiştirilmedi; izole kurulumda toplam16 uygulandı. Eski SQL Draft dosyası geçmiş kanıt olarak korunur; gerçek migration yerine çalıştırılmaz.

**Bu backend, recovery kapalı olsa bile hesap silme sırasında yeni tabloları kullanır. Migration uygulanmadan yeni backend deploy edilmemelidir.** Production migration yapılmadı ve ayrı kullanıcı onayı gerekir. Mevcut 15-migration varsayımı taşıyan operatör preflight araçları 16 migration ile ayrıca incelenmelidir; korunan 23 operatör dosyasına dokunulmadı. Mevcut production backup/restore kanıtı yeni migration onayı yerine geçmez.

Yerel Client üretimi mevcut Windows engine ile geçti. Linux engine indirme helper'ının Windows'ta kullanımı HTTP404 verdi; bu helper Linux build hedefi için hazırlanmıştı. TLS/versiyon kontrolü gevşetilmedi; mevcut kurulu Windows engine ile standart `prisma generate` kullanıldı. Gerçek DB'ye migration yapılmadı. Dockerfile'a eksik `gazette_download.py` COPY eklendi; bu görevde yeni temiz Docker image build/runtime doğrulaması yapılmadı, release öncesi tekrar gerekir.

## 5. Gerekli yapılandırma ve dış işler

Varsayılan `ACCOUNT_RECOVERY_ENABLED=false`; eksik/yanlış konfigürasyonda capabilities false, API unavailable; açık flag + eksik konfigürasyonda sunucu environment kontrolü reddeder. Fake transport yalnız guarded test içinde dependency injection ile bulunur.

| Değişken | Gerçek aktivasyondaki değer türü |
| --- | --- |
| ACCOUNT_RECOVERY_ENABLED | Ayrı aktivasyon onayından sonra true; şimdi false/eksik |
| ACCOUNT_MAIL_PROVIDER | Uygulanan adaptör için resend |
| RESEND_API_KEY | Gerçek sağlayıcı secret store anahtarı; sohbet/Git/mobil bundle'a konmaz |
| ACCOUNT_MAIL_FROM | Gerçek, doğrulanmış domain'de yalın gönderici e-posta adresi |
| ACCOUNT_RECOVERY_ORIGIN | Gerçek API/web HTTPS origin'i, path/trailing slash yok; CORS_ORIGINS içinde bulunmalı |
| ACCOUNT_RATE_HMAC_KEY | Sunucu secret store'unda en az32 karakter rastgele anahtar; kullanıcıdan sohbete istenmez |

Sender domain'inde SPF/DKIM/DMARC ve gerçek inbox testleri gerekir. Sağlayıcıda open/click tracking kapatılmalı; mail body/link retention, ekip erişimleri ve veri işleyen sözleşmesi incelenmeli. Provider dashboard'u işlem linki/alıcıyı tutabilir; uygulamanın hash-only DB'si sağlayıcının veri saklamasını ortadan kaldırmaz. Gerçek secret, sender, domain ve destek adresi üretilmedi.

## 6. Resmî Gazete erişimi, gerçek PDF ve worker

Mevcut parser/fihrist/HTML/staging/audit/48–96 saat worker korunur. Registry, kaynak hakları ve production flag'ler değiştirilmedi. Web aracıyla ana sayfa/robots/arşiv erişimi başarısız oldu. Ek olarak redirect takip etmeyen, TLS doğrulamalı, connect5s/total10s sınırlı curl teşhisi:

| İstek | DNS/TCP/TLS kümülatif saniye | Sonuç |
| --- | --- | --- |
| HEAD robots | .004628 /0 /0 | TCP tamamlanmadı; exit28, HTTP000 |
| GET robots | .007833 /0 /0 | TCP tamamlanmadı; exit28, HTTP000 |
| HEAD tarihli HTML | .004521 /.046800 /2.992750 | TLS tamamlandı; HTTP headers timeout, exit28 |
| HEAD tarihli PDF | .004648 /1.667246 /2.781798 | TLS tamamlandı; HTTP headers timeout, exit28 |

Güvenli ölçüm `.local/account-recovery-final/gazette-network.json`. HEAD/GET robots ikisi de başarısız; sitenin HEAD kabul edip etmediği veya GET'in PDF'de çalışacağı çıkarılamaz. 403/429/redirect/MIME/sertifika hatası gözlenmedi; bunlar yoktur diye kesin hüküm verilmez. Önceki HTTP-header timeout ile bu denemedeki bazı TCP timeout'ları ağın tutarlı olmadığını gösterir; erişim engelinin kesin kaynağı kanıtlanmadı. Proxy/IP değiştirme, TLS bypass veya otomatik PDF gövdesi indirme yapılmadı.

Tarihli yol önceki resmî belge bağlantısı/testinden gelir; güncel site HTML markup'ı, robots ve tam kullanım/telif koşulları yeniden doğrulanamadı. İndekslenmiş resmî footer telif/kullanım bildirimi gösterir; bu metne erişememek genel hukuki yasak veya izin kanıtı değildir. Olgusal indeksleme ve tam belge yeniden yayımı ayrı kalır. Mevcut REVIEW_REQUIRED korunur; canlı PDF indirme sayısı **0**.

Yerel gerçek PDF: 24 Eylül2026/sayı33380,140 sayfa, SHA-256 `050f756d5475090556dc4981709a760fd9776d1589584b902506de4486300dca`. Manuel parser/review testi6 aday, ikinci import6 duplicate,12 şüpheli sayfa, izole testte2 onay/yayın ve9 yayımlanmış kadro. Önceki parser kanıtı39 ayrıştırılmış kadro ve5 eksik bitiş tarihidir; bu görevde gerçek kaynakla tüm alanların editoryal doğruluğu yeniden onaylandı denmez. UNKNOWN/OCR/eksik tarih otomatik açık ilan sayılmaz.

Downloader→mock transport→gerçek yerel PDF→worker→staging testi6 aday/6 duplicate,21 kontrol PASS; `REAL_LOCAL_PDF_MOCK_TRANSPORT`, liveDownload=false. TCP/DNS/TLS/redirect/SSRF/MIME/boyut/SHA/304/bozuk cache/robots/deadline mock testleri canlı erişim başarısı değildir. İptal/uzatma/kaybolma senaryoları sentetik metadata ile review'a gider; otomatik yayımlanmaz.

48/96 saat, kaynak/policy lock, validator/cache, bounded retry, backlog, private preview ve audit, rollback, kota ve idempotence testleri geçti. Yeni scheduler yazılmadı. Mevcut3/5 günlük lookback, dispatch başına bir gün ve sınırlı belge bütçesi uzun kesintide eksiksiz backfill garantisi değildir; snapshot32 belge ve private cache/storage kotaları için operasyon gerekir. Render Free sürekli worker garantisi vermez. Kaynak kullanım kapsamı ve gerçek pilot doğrulanmadan worker açılmamalıdır.

## 7. Test kanıtları ve sınırlar

| Kontrol | Sonuç |
| --- | --- |
| API/admin build; mobil TypeScript | PASS |
| Android JS export | PASS;1.149 modül/25 asset; APK değildir |
| Auth readiness |73 kontrol; kayıt açık/kapalı, sınırlar, roller, profile{}, session, favori, logout/delete PASS |
| Yeni recovery API | Guarded izole PG16 + fake transport; request/confirm, purpose, expiry/reuse/reissue, concurrent consume, enumeration yanıtı, cooldown, CSRF/origin, mail failure, admin izolasyonu, e-posta binding, login/reset yarışı ve silme PASS |
| Recovery web / mail adaptörü | Playwright10 kontrol; provider11 mock kontrol PASS; gerçek SMTP/API teslimi yok |
| SecureStore |23 kontrol ve native backup/config introspection PASS; gerçek Android Keystore cihaz testi yok |
| Gazette downloader Python / PDF / Kariyer RSS |12 /21 /8 test PASS; gerçek yerel PDF dahil |
| PostgreSQL source/auth/admin/historical paketi |19/19 grup PASS; son sonuç `.local/account-recovery-final/full-results.json` |
| CI | Workflow yeni API/mail/browser testleriyle hazırlandı; remote yeni koşu yapılmadı. CI16 yalnız mevcut yayımlanmış HEAD'e aittir |

İlk birleşik recovery koşusunda önceki testlerden biriken login limitleri DELETE aşamasını etkiledi; yalnız disposable test DB başlangıç rate fixture'ı temizlendi, production limitleri gevşetilmedi. Tarayıcı testinin ikinci-link sorunu gerçek web düzeltmesine yol açtı. Özel PDF/XML ve test çıktıları yalnız `.local` altında; CI sentetik belge/transport ile bağımsızdır.

Tekrar çalıştırılabilir yerel kontroller (runner kendi rastgele PostgreSQL16 konteynerini oluşturup kaldırır; production URL kullanılmaz):

```powershell
node infra/test-official-sources-isolated.cjs --auth --admin-browser --auth-gazette --final-gazette --account-recovery
node apps/api/test-account-mail.cjs
node apps/api/test-recovery-browser.cjs
node infra/test-mobile-session.cjs
node infra/test-release-manifest.cjs
python infra/check-release-secrets.py
```

Gerçek belge kanıtları için gerçek PDF yolu ve özel RSS fixture yalnız operatörün yerel ortamında ayrıca verilmiştir; bu dosyalar komutlarla indirilemez ve CI’ye yüklenmez.

## 8. Release kapsamı, Play ve kullanıcı kararları

Yeni ana dosyalar: `apps/api/src/account-mail.ts`, `account-recovery.ts`, yeni migration/model; `test-account-recovery.cjs`, `test-account-mail.cjs`, `test-recovery-browser.cjs`; `apps/mobile/app/account-recovery.tsx`; `web/account-recovery.{html,js,css}`. Entegrasyonlar candidate/environment/main, mobil profile/account/layout, privacy, CI, izole test runner, Docker COPY ve manifest içindedir. Önceki auth/Gazette dosyaları ve23 operatör değişikliği korunur; operator hash kontrolü23/23 aynı.

Commit grubu önerisi: (1) önceki auth/SecureStore + eklemeli recovery migration/API/mail/mobile/web/test/CI; (2) mevcut Gazette downloader/worker/staging/Docker COPY + testler; (3) rapor/manifest. Bağımlı dosyalar eksik bırakılmaz; operatör dosyaları ayrı incelemede kalır. `git add .` kullanılmadı; index'e dosya alınmadı. Manifest PASS:123 candidate dosyası,23 ayrı operatör dosyası,184 göreli import ve0 kapsam dışı değişiklik. Secret scan PASS:821 nesne/dosya,0 bulgu; heuristic tarama manuel incelemenin yerine geçmez. Locked Prisma/SHA-512 sözleşmesi PASS.

Render öncesi: kullanıcı SQL/migration16 ve operatör uyumluluğunu inceler; onaylı backup/restore ve rollback planı gerekir. Sonra ayrı onayla commit/push/CI, temiz Docker build, migration ve release sırası kararlaştırılır. Bu rapor migration/deploy yetkisi vermez. Release sonrasında yalnız public GET health/SHA/historical8611/announcements/capabilities ve legal sayfalar kontrol edilir; bu görevde yeni production sonuç iddiası yoktur.

Play öncesi gerçek işletmeci/destek adresi, gizlilik/retention/sağlayıcı beyanı, web ve uygulama içi silme, hesap kurtarma, SDK veri işleme ve Data Safety tamamlanmalıdır. Google [hesap silme](https://support.google.com/googleplay/android-developer/answer/13327111) uygulama içi yol ve web kaynağı, [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469) gerçek SDK/sağlayıcı davranışının beyanını ister. Sayfa kodlarının varlığı mağaza kabulü değildir. Resmî kurumlarla bağlantısızlık ve kaynak linkleri korunur. Bildirim izni yalnız kullanıcı eylemiyle; notification worker kapalı. SecureStore backup hariç tutma doğrulandı. Token taşıyan custom-scheme deep link eklenmedi; HTTPS fragment kullanılır.

SDK54, `com.kadroradar.app`,1.0.1/code3 korunur. Son kapsamlı APK öncesi sağlayıcı/domain/DNS/gerçek teslimat, migration/deploy onayları, temiz Docker build/remote CI ve fiziksel Android cold-start/expiry/logout/reset-sonrası401/silme/offline/geri tuşu testleri gerekir. EAS/Play Console/signing/maliyet onayı ayrıca gerekir; bu görev build kotası kullanmadı.

Kullanıcıdan beklenen kararlar: Resend veya alternatif seçimi; gerçek domain/sender/destek ve veri işleyen sözleşmesi; migration16/operatör planı; kayıt açılışı/doğrulama politikası; ayrı push/deploy ve en son tek preview cihaz testi. Secrets sohbette paylaşılmamalı.

## A. TAMAMLANDI VE TEST EDİLDİ

Çalışan recovery backend, eklemeli izole migration, mail abstraction/Resend adaptörü, kapalı-feature davranışı, capability-gated mobil/web akışları, SecureStore ve auth güvenliği; mevcut Gazette kodu/gerçek yerel PDF/mock worker regresyonları. Tamamı yereldir.

## B. DIŞ SERVİS / İZİN / YAPILANDIRMA BEKLİYOR

Gerçek sağlayıcı hesabı, sender/domain DNS ve delivery/bounce deneyi, destek/retention/veri aktarım kararı, kaynak robots/kullanım kapsamı ve gerçek fihrist/PDF pilotu; production migration16 ve operatör uyumu; remote CI/clean Docker/Android cihaz/Play Console.

## C. PRODUCTION İÇİN HENÜZ AKTİF EDİLMEMELİ

E-posta recovery, kendiliğinden kayıt açılması, Kariyer Kapısı/Resmî Gazete canlı otomasyonu, ilan yayını ve push worker. `SOURCE_SYNC_ENABLED=false`, `DOCUMENT_UPLOADS_ENABLED=false`, `NOTIFICATIONS_ENABLED=false`, `PROCESS_ROLE=api` politikası korunur. Migration onayı olmadan bu yeni backend deploy edilmemelidir.
