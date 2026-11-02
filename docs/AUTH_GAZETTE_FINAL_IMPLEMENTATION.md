# Auth tamamlama ve Gazette downloader

31 Ekim 2026, Europe/Istanbul. Dal `feature/announcements-core`; yayımlanmış/yerel HEAD `4e5b86c5de22210eef254b682df6890ba96c4bca`. Önceki auth/SecureStore çalışması üzerine devam edildi. Bu görev commit/push, Render deploy, EAS build veya production DB işlemi yapmadı.

## 1. Teslimatın kapsamı

| İş | Durum |
| --- | --- |
| Gazette HTTPS downloader ve tarihli fihrist/PDF/HTML akışı | Kodlandı; güvenlik ve offline transport testleri geçti |
| Worker, cache, staging, private preview, audit,48/96 saat sözleşmesi | Kodlandı; ayrı PG16 üzerinde test edildi |
| Yeni gerçek internet PDF indirmesi | **Başarılı değil**; erişim ve kaynak politikası engelleri aşağıda |
| Yerel gerçek140 sayfalık PDF ile downloader/staging sınır testi | Geçti; ağ katmanı açıkça MOCK |
| Kayıt/login/SecureStore/profil/favori/silme | Önceki uygulama korundu; auth73 ve session23 regresyonları geçti |
| E-posta doğrulama/parola kurtarma | **Güvenli uygulama planı + test edilmiş SQL taslağı**; çalışan mail/API özelliği değildir |
| Production otomasyonu/yayın/kayıt açılması | Yapılmadı; mevcut politika korundu |

E-posta sağlayıcısı/secrets olmadan gerçek e-posta akışı tamamlanmış gibi sunulmadı. Kullanıcının “tamamla veya güvenli uygulama planını hazırla” seçeneğinin bu kısmı plan/taslak olarak teslim edilir.

## 2. Gerçek teknik pilot ve kaynak şartları

İncelenen resmî giriş [Resmî Gazete](https://www.resmigazete.gov.tr/), robots ve istenen geçmiş arşiv rotalarıdır. Tarih şablonundan üretilen rota, HTTP200 ve belge doğrulaması olmadan “bulunmuş belge” sayılmaz.31 Ekim denetiminde web aracı erişimleri başarısız oldu; ayrıca üç ayrı, redirect takip etmeyen, TLS doğrulamalı,12 saniye ile sınırlı HEAD teşhisi yapıldı:

| İstek | DNS s | TCP s | TLS s | HTTP | curl |
| --- | --- | --- | --- | --- | --- |
| `/robots.txt` |1.516894 |2.784192 |3.856492 |000 |28 |
| `/eskiler/2026/09/20260924.htm` |0.006005 |0.159921 |2.004185 |000 |28 |
| `/eskiler/2026/09/20260924.pdf` |0.005247 |3.132551 |3.407002 |000 |28 |

Ölçümler curl'ün başlangıçtan itibaren kümülatif zamanlarıdır. **DNS, TCP ve TLS tamamlandı; HTTP başlıkları gelmeden toplam süre doldu.** Sertifika doğrulama hatası,403,429 veya CAPTCHA gözlenmedi. Ağın/site sahibinin kesin engelleme nedeni kanıtlanmadı. HEAD teşhisi PDF gövdesi indirmedi.

Yeni downloader'ın `--date 2026-09-24` pilotu gerçek registry ile çalıştırıldı: `SOURCE_REVIEW_REQUIRED`, `POLICY_OR_PARSE`, downloaded=false. **Politika kapısı ağdan önce reddetti.** Bu sonuç HTTP timeout teşhisinden ayrı bir engeldir; mevcut güvenlik kontrolünü aşmak için kaynak fixture lisansı gerçek ağ isteğine uygulanmadı.

Kaynak sitesinin güncel otomatik erişim/indeksleme kullanım kapsamı ve robots gövdesi doğrulanamadı. İndekslenmiş resmî sayfalar “Gizlilik, Kullanım ve Telif Hakları” bildirimine işaret ediyor; tam metnine bu denetimde erişilmedi. Başka uygulamaların davranışı izin kanıtı alınmadı. Kamuya açık olgusal indeksleme ile tam PDF yeniden yayımı ayrı tutulur; buradan genel bir hukuki yasak veya izin sonucu çıkarılmaz. Mevcut uygulama politikası REVIEW_REQUIRED/enabled=false olarak korundu.

Kanıt: `.local/auth-gazette-final/live-head-diagnostics.json`. **Bu görevde internetten indirilen gerçek PDF sayısı0'dır.** Kaynak kapsamı doğrulansa bile önce yeni, sınırlandırılmış pilot ve gerçek fihrist markup uyumluluğu gerekir.

## 3. Downloader ve worker uygulaması

`services/ingest/gazette_download.py` mevcut `official_gazette.py`, `index_manifest`, `parse_pdf`, `parse_notice_html` fonksiyonlarını kullanır; parser yeniden yazılmadı.

- Tarihli resmî arşiv HTML rotasını doğrular; yalnız HTML'de gözlenen PDF/ilan bağlantılarını alır. URL şablonundan PDF'nin var olduğu varsayılmaz. Gözlenen tam sayı PDF'si varsa aynı ilanı tek tek HTML/PDF kopyalarından ikinci defa üretmemek için tercih edilir. Ek PDF'ler veya bütçe dışı bağlantılar review sebebidir; sessiz kapsam tamlığı iddiası yoktur.
- HTTPS, tam domain, port443, tarih/yol kalıbı ve calendar kontrolü; credentials, query/fragment, percent-encoded yol, backslash ve farklı domain reddi. DNS yanıtlarının tamamı public olmalı; TCP doğrulanmış IP'ye pinlenir, SNI/Host resmî hostname olarak kalır. Ortam proxy'si veya TLS skip kullanılmaz.
- Redirect'ler aynı domain olsa bile otomatik izlenmez; review gerekir.403/429/TLS/SSRF doğrulama hataları retry edilmez. Yalnız transient DNS/TCP/network/timeout ve502/503/504 için bir kez, sınırlı retry vardır.
- DNS daemon çözümleyicisi, TCP, TLS ve HTTP aşamaları sınırlıdır. Header ve body'deki her receive toplam deadline'ı tekrar hesaplar; yavaş header akışı timeout'u uzatamaz. Tek request18 saniye; worker Python süreci50 saniye ile sınırlı. Python CLI'nin bir çalışmasındaki istek sayısı da sınırlıdır; worker'ın50 saniyelik toplam sınırı ayrı uygulanır.
- PDF64MiB/600 sayfa sınırı mevcut parser'da korunur; HTML2MB, robots256KB; MIME, signature, content-length ve identity encoding kontrolü. PDF/HTML türü uyuşmazlığı reddedilir. Parser hatasında yayın yapılmaz.
- Cache content-addressed SHA-256 dosyaları kullanır; eksik transfer kalıcı hedefe yazılmaz. Geçici dosya fsync ve atomik hard-link ile tamamlanır; mevcut hash dosyası değiştirilmez.304 sadece geçerli validator ve aynı URL/hash cache'iyle kabul edilir; kayıp/bozuk cache başarı sayılmaz. İstenirse bilinen SHA beklenen değerle karşılaştırılabilir; kaynaktan elde edilmemiş hash uydurulmaz.
- Robots bir çalışmada bir kez alınır ve her resource URL'sine uygulanır.404 robots yokluğu mevcut ağ/lisans kapısını açmaz. Disallow engellenir; özel crawl-delay/request-rate tespitinde desteklenmeyen hız koşulu review'a gider.
- Günlük çalışma en çok iki notice/PDF ve iki index işler. Başarılı çalışma bile eksik/taralı/OCR/metadata şüphesi varsa `complete=false` taşıyabilir. OCR sonucu otomatik doğrulanmış şart değildir.
- Worker gerçek registry'nin existing license/indexing kapılarını **ve** ek `AUTOMATED_GAZETTE_DOCUMENT_ACCESS` kapsamını ister. Runtime policy override kapsamı daraltırsa indirme durur. Bu yeni scope otomatik eklenmedi; registry dosyası değiştirilmedi. Gerçek worker için ayrıca `DOCUMENT_UPLOADS_ENABLED=true` ve private storage gereklidir; mevcut production false sözleşmesi korundu.

`SourceOperations.fetchGazette()` Node→Python bridge'ini, byte/hash tekrar kontrolünü ve mevcut private belge klasörünü kullanır. Dosyalar public static dizine konmaz. Admin fihrist ve private source-file görüntüleyicisi mevcut rollerle çalışır. Cache başlangıç kotası512MiB, private belge kotası1GiB'dir; kota dolarsa işlem durur. Cache ve metadata retention temizliği aktivasyon öncesi işletmeci planına bağlanmalıdır; sınırsız arşiv toplama yoktur. Snapshot geçmişi32 belge URL'siyle sınırlıdır; aşılırsa otomatik veri atılmaz, inceleme gerekir.

###48/96 saat ve arşiv aralığı

Yeni bir tarama çevrimi İstanbul tarihine göre48 saat için son3,96 saat için son5 günü (bir gün sınır örtüşmesiyle) kuyruğa alır. Her dispatch tek günü işler; kalan tarihler DB transport state'inde saklanır. Aynı çevrimin sonraki günü kaynak minimum aralığından önce çalışmaz (mevcut Gazette policy3600 saniye); kuyruk bitince normal48/96 saat beklenir. Böylece tek request'e çok gün/PDF yüklenmez. Yayımlanmamış gün,404 index, erişim veya belge sınırı otomatik “başarılı boş gün” olarak uydurulmaz; hata/review görünür.

Bu sınırlı pencere **uzun kesinti dönemlerinin eksiksiz backfill garantisi değildir**. Aktivasyon öncesi missed-day/backfill operasyonu ve kota izleme planlanmalıdır; CLI `--date` tek tarih için tekrar incelenebilir. Gerçek site markup/izinleri test edilemediği için sürekli günlük hizmet tamamlanmış sayılmaz.

## 4. Staging, değişiklik, kaybolma ve yayın güvenliği

`apps/api/src/gazette-staging.ts` mevcut SourceDocument/AnnouncementImportRow/AnnouncementReviewAudit modellerini kullanır; yeni Gazette migration'ı gerekmez.

- Kaynak URL'si, gerçek byte hash'i, kurum, kadro/şartlar, sayfa ve tarih kanıtları private staging'de kalır. İlk import parser'ın mevcut content identity'siyle manuel import ile uzlaşır; aynı belge ikinci kez satır oluşturmaz.
- Aynı resmî belge URL'sindeki sonraki sürümlerde kurum/ilan kimliği referansları tutulur. Değişiklik eski satırı versiyonlayıp PENDING_REVIEW'a döndürür; önceki yayının sourceCheckedAt/verifiedAt alanları geçersizleştirilir. Pozisyon/page kayması gibi kimlik belirsizliklerinde insan uzlaştırması gerekebilir; heuristik kesin eşleşme sayılmaz.
- Yalnız eksiksiz aynı-gün snapshot veya önceden bilinen belgedeki gerçek404 kanıtı kaybolma review'u oluşturur. Budget/encoding/OCR şüphesindeki eksik satır “iptal” değildir. Index'te hâlâ gözlenen ama bu dispatch'te indirilmeyen belge kaybolmuş sayılmaz.
- `GAZETTE_SOURCE_CHANGED`, `GAZETTE_ITEM_DISAPPEARED_REVIEW`, `GAZETTE_DOCUMENT_DISAPPEARED_REVIEW` audit'leri vardır. Source metadata değişikliği otomatik iptal veya başvuru süresi uzatma yetkisi vermez.
- PostgreSQL source advisory lock, policy shared lock ve staging savepoint kullanılır. Hatalı snapshot'ın önce işlediği satırlar rollback olur; başarısız staging sonrası yeni ETag/Last-Modified DB'ye başarılı state olarak kaydedilmez. Policy review ile aktif batch serialize edilir; revokasyon devam eden sınırlı batch kilidinin bitmesini bekleyebilir.
- Public API yalnız mevcut approve/publish zinciri sonrasında veri gösterir. Tam PDF/HTML, ham koşul metinleri ve raw provenance public API'ye konmaz; mevcut facts-only projection testleri korunur. Yeni downloader otomatik publish çağırmaz.

## 5. Gerçek belge ve fixture ayrımı

Yerel gerçek PDF:140 sayfa,24 Eylül2026/sayı33380; SHA-256 `050f756d5475090556dc4981709a760fd9776d1589584b902506de4486300dca`.6 aday/39 kadro satırı,12 şüpheli sayfa ve5 eksik bitiş tarihli aday önceki parser testleriyle doğrulandı.

| Deney | Sonuç | Canlı indirme mi? |
| --- | --- | --- |
| Resmî robots/arşiv/PDF HEAD | HTTP headers timeout | Hayır; gövde indirilmedi |
| Gerçek registry ile downloader CLI | SOURCE_REVIEW_REQUIRED | Hayır; ağdan önce ret |
| Yerel gerçek PDF → mock HTTP → downloader/parse → Node bridge → staging |6 aday; ikinci aktarım6 duplicate; private preview/audit PASS | **Hayır: REAL_LOCAL_PDF_MOCK_TRANSPORT** |
| Manuel gerçek PDF zinciri |2 test onay/yayın,9 kadro; arşiv/UNKNOWN kontrolleri PASS | Hayır; mevcut yerel belge |
| Değişiklik/kaybolma/403 kapsam daraltma/rollback senaryoları | Sentetik metadata değişimleri ve mock yanıtlarla PASS | Hayır; gerçek kaynağın iptal/uzatma kararı değildir |
| Production import/yayın / gerçek Android cihaz |0 /0 | İşlem yapılmadı |

Test fixture'ı kendi açık SYNTHETIC izin kanıtını ve index HTML'ini yalnız test belleğinde kullanır; bu resmî lisans/fihrist kanıtı değildir. DB `liveFetch=false`, receipt `MOCK_GAZETTE_REVIEW` olarak ayrılır. Gerçek PDF ve tam XML Git'e eklenmez; `.local/auth-gazette-final/` test kanıtları private kalır.

## 6. Auth: korunan uygulama ve güvenli kurtarma planı

Önceki SecureStore,8 saat mutlak session, `{}` profil yanıtı,12–128 parola sınırı, role/CSRF, favori/logout/silme korunur. `ALLOW_SELF_REGISTRATION` production'da değiştirilmedi. Yanlış parola ve kapalı kayıt mesajları mevcut kullanıcı dostu akışı kullanır.

Gerçek sağlayıcı hesabı, doğrulanmış sender, mail secret veya reset link public origin'i yoktur. Bu yüzden **yeni çalışan verification/reset endpoint'i veya yanıltıcı Şifremi Unuttum düğmesi eklenmedi**. Aşağıdaki plan, sonraki uygulama için güvenli ve somut sözleşmedir. OWASP'ın [Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) ve [Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) rehberlerindeki varlık ifşasını önleme, sınırlı token ve güvenli yeniden giriş ilkeleri referans alındı.

### Planlanan API ve tüketim işlemi

| Planlanan endpoint; şu an mevcut değil | Sözleşme |
| --- | --- |
| POST `/account/email-verification/request` | Authenticated kullanıcı için yeniden doğrulama isteği; adres DB'den alınır; cooldown/rate limit |
| POST `/account/email-verification/confirm` | Token hash+purpose+email binding+expiry+unused kontrolü; yalnız doğrulama kaydı; rol veya e-posta değiştirmez |
| POST `/account/password-reset/request` | Var/yok/silinmiş kullanıcı için aynı202 gövdesi; zamanlama ve mail gönderim farkı dışarı yansıtılmaz |
| POST `/account/password-reset/confirm` | Token ve12–128 yeni parola; atomik tek kullanımlık tüketim, mevcut scrypt-v2 ile yeni hash ve tüm session'ları iptal |

Token32-byte CSPRNG olmalı; DB'ye yalnız SHA-256 hash, userId, normalize e-posta binding hash'i, purpose, created/expires/consumed zamanları yazılmalı. Reset15 dakika, sahiplik doğrulama en çok24 saat; yeniden istek aynı user/purpose için önceki tokenı geçersiz kılmalı. Yanlış purpose, değiştirilmiş e-posta veya silinmiş hesap tokenı kullanamamalı. Reset otomatik login yapmamalı; yeni parola e-postaya yazılmamalı.

Tek kullanımlık tüketim `UPDATE ... WHERE consumedAt IS NULL AND expiresAt > now ... RETURNING` ve parola/session işlemleriyle **aynı DB transaction'ında** yapılmalı. İlgili User satırı kilitlenip güncel e-posta hash'i tekrar karşılaştırılmalı; yeniden token üretimi user/purpose bazında serialize edilmeli. Hash hesaplama mevcut sınırlı scrypt iş kuyruğunu kullanmalı. Başarılı reset kullanıcıya güvenli bildirim üretmeli; mevcut SYSTEM_ADMIN/operator kurtarma yolu public e-posta resetiyle devralınmamalı. Public recovery için ilk kapsam USER olmalı; yönetici hesaplarının politikası ayrıca onaylanmalı.

Link configured HTTPS origin'den üretilmeli; gelen Host/Forwarded header veya kullanıcı returnTo değeri link kaynağı olmamalı. Token fragment içinde taşınmalı; form okuduktan sonra URL history temizlenmeli. GET link ziyaretinde token tüketilmemeli (mail güvenlik tarayıcıları link açabilir); açık onay/yeni parola POST gerekir. Reset sayfasında analytics/third-party içerik olmamalı; no-store, no-referrer ve dar CSP uygulanmalı. Cookie temelli mutasyonlarda mevcut CSRF korunmalı.

Rate limit DB-backed IP + HMAC(normalized email) + global send budget ile sınırlanmalı. Doğrudan e-posta hash'i public log/metric'e yazılmamalı. Önerilen başlangıç kotası: IP başına5 istek/15 dakika, hesap anahtarı başına3/saat ve60 saniye cooldown; işletmeci tarafından sağlayıcı kotasıyla kararlaştırılacak değerlerdir, **şu an çalışan kod ayarı değildir**. Bilinmeyen kullanıcıya da aynı response/limit yolu uygulanmalı; hesap kilitleme veya e-posta varlığını response code ile açığa çıkarma yapılmamalı.

### Test edilmiş SQL taslağı

`infra/account-recovery.sql.example`: yalnız iki yeni Draft tablo ve indeksler; mevcut User/CandidateSession değiştirilmez. Token hash, amaç ayrımı, email binding, tek pending token ve TTL CHECK koşulları vardır. `test-auth-recovery-draft.cjs` izole PG16'da hash-only saklama, yanlış amaç, yarışan iki tüketimde yalnız bir başarı, tekrar kullanım reddi, expiry/üst TTL, tek pending ve silinmiş hesap engelini test etti. **9 kontrol PASS**.

Bu, Prisma migration'ı veya çalışan recovery API'si değildir. Sağlayıcı seçilince Prisma modelleri ve gerçek migration SQL'i ayrıca hazırlanıp incelenmeli; sonra ayrı kullanıcı migration onayı gerekir. Hesap silme transaction'ına yeni challenge/verification temizliği eklenmeli; mevcut hesaplar sessizce “verified” yapılmamalı. Doğrulama zorunluluğu açılacaksa eski hesaplar/SYSTEM_ADMIN için kilitlenmeyi önleyen geçiş planı gerekir. Bu task mevcut login politikasını değiştirmedi.

## 7. E-posta sağlayıcısı ve yapılandırma gereksinimleri

Aşağıdaki alanlar **gelecekteki entegrasyon gereksinimleridir**; runtime'ın şu an bu değişkenleri okuduğu veya dolduruldukları iddia edilmez:

| Karar/yapılandırma | Gereksinim |
| --- | --- |
| Provider/API veya SMTP | İşletmecinin mevcut/tercih ettiği sağlayıcı; bounded TLS, idempotency ve teslim durumları incelenmeli |
| Sender/reply-to | Gerçek doğrulanmış domain/adres; SPF/DKIM/DMARC işletmeci doğrulaması |
| API key / SMTP secret | Yalnız secret store/Render secret; Git, app bundle veya sohbet içine verilmez |
| Public auth origin | Gerçek HTTPS reset/verification sayfası; sahte URL varsayılanı yok |
| Rate HMAC key | İstemciye verilmez; rotasyon/saklama kararı gerekir |
| Signed webhook secret | Sağlayıcı kullanılıyorsa imza, replay ve event-id dedup kontrolü |
| Send budget/retention | Cooldown, tekrar istek, bounce/complaint ve audit saklama süreleri |

Provider yokken kayıt/verification/recovery açılmamalı; çalışan endpoint'ler daha sonra eklenirse disabled durum her kullanıcı için aynı unavailable cevabını vermeli. Ham token, URL, parola, alıcı veya mail gövdesi loglanmamalı. Kalıcı mail outbox kullanılacaksa ham token plaintext yazılmamalı; ayrı anahtarla şifrelenmiş payload ve rotasyon gereklidir. Alternatif, kısa ömürlü tokenı yalnız gönderim sırasında bellekte tutup başarısız gönderimde iptal etmektir. Retry/delivery garantisi sağlayıcı sözleşmesi seçilmeden uydurulmaz. Gerçek mail teslimi ve webhook bu görevde test edilmedi.

## 8. Regresyon, dosya kapsamı ve koruma

- API/admin build, mobil TypeScript ve Android export PASS. Android1.0.1/code3, com.kadroradar.app, Expo54 korunur; export1.148 modül/25 asset, APK değildir.
- Python downloader12 güvenlik grubu PASS; Gazette21 (gerçek140 sayfa dahil), Kariyer8, source adapters3, tarihsel parser5 PASS.
- Ayrı PG16 full runner18 grup PASS: önceki16 auth/source/admin/audit/historical grubu + downloader worker ve recovery SQL taslağı. Son bridge/scope/404 hedefli worker testi **21 kontrol PASS**, recovery SQL taslağı **9 kontrol PASS**; sonuçlar private kanıtlardadır.
- Auth73, mobile session23, native SecureStore/backup introspection ve preview10 korunur. Kaynak hakkı/revokasyon, private preview, rollback ve48/96/backlog testleri gerçek PG16 kullanır; internet erişimi mock'tur.
- CI'ye yeni Python downloader ve iki backend testi eklendi. Gerçek PDF/XML CI'de kullanılmaz; sentetik fixture bağımsızdır. Yeni remote CI koşusu yoktur. Docker clean build bu görevde tekrar yapılmadı.
- Yeni dosyalar: `services/ingest/gazette_download.py`, `test_gazette_download.py`, `fixtures/make_gazette_download_report.py`; `apps/api/src/gazette-staging.ts`, `test-gazette-downloader.cjs`, `test-auth-recovery-draft.cjs`; `infra/account-recovery.sql.example`; bu rapor.
- Değişen mevcut dosyalar: `apps/api/src/source-operations.ts`, `source-adapter-contract.ts`; `.github/workflows/ci.yml`, `infra/test-official-sources-isolated.cjs`, `docs/RELEASE_CANDIDATE_FILES.json`. Önceki auth/mobil değişiklikleri yeniden yazılmadı.
- Başlangıçtaki46 dirty dosyanın hash kaydı `.local/auth-gazette-final/baseline-hashes.json` altında. Önceki23 operatör dosyası ayrı tutulur; mevcut auth kodu ve gerçek kaynak dosyaları korunur. Gerçek Prisma schema/migration dizini, kaynak registry'si ve ALLOW_SELF_REGISTRATION değiştirilmez.
- Manifest **109 candidate /23 ayrı operatör /169 göreli import,0 kapsam dışı değişiklik PASS**. Secret scan800 nesne/dosyada **0 bulgu PASS**; heuristic tarama mutlak sızıntısızlık garantisi değildir. `git diff --check` PASS. Başlangıç hash karşılaştırmasında yalnız CI, release manifesti ve izole runner'a beklenen eklemeler var; önceki auth/mobil ve23 operatör dosyasının byte'ları değişmedi. `.local`, env, gerçek PDF/XML, dump/backup/signing/secrets Git'e alınmadı. Commit/push yapılmadı.

## 9. Üretim ve tek Android test sürümüne geçiş

Mevcut production verisine bu görev bağlanılmadı veya yazılmadı;8.611 ÖSYM kaydı ve SYSTEM_ADMIN'a işlem yok. Kaynak registry'sinde Gazette/Kariyer REVIEW_REQUIRED/enabled=false kalır. Production SOURCE_SYNC/NOTIFICATIONS/DOCUMENT_UPLOADS=false, PROCESS_ROLE=api hedefi değiştirilmedi; Render environment bu görevde açılıp düzenlenmedi. Kayıt kapalı politika korunur.

Aktivasyon öncesi kalan kararlar:

1. Kaynak kullanım kapsamı, belge erişimi, robots ve gerçek fihrist markup'ı doğrulanmalı; sonra ayrı yetkili kontrollü indirme pilotu. Bu rapor fixture başarısıyla bu engeli kapatmaz.
2. Sürekli worker için Free olmayan güvenilir süreç, persistent private/cache storage, kota/retention ve missed-day/backfill operasyonu kararlaştırılmalı. Kaynak-specific scope/evidence registry ve varsa runtime override'da ayrı doğrulanmalı; otomasyon/yayın açık onay olmadan açılmaz.
3. E-posta sağlayıcısı/sender/origin ve verification/recovery uygulaması kararlaştırılmalı; gerçek endpoint, email teslimi, enumeration/rate-limit ve yeni Prisma migration testleri tamamlanmalı. SQL taslağı doğrudan production'a uygulanmaz.
4. Son diff/manifest/secret incelemesi ve onaylı commit/push/CI; sonra ayrı backend deploy kararı. Bu görev bunları yapmaz.
5. **EAS build şimdi başlatılmamalı.** SecureStore native bağımlılığı için sonunda yeni APK gerekir; e-posta kurtarma UI'si de aynı sürümde isteniyorsa sağlayıcı/API kararı ve istemci akışı bitmeden tek “kapsamlı” build harcanmamalı. Alternatif kapsam mevcut auth + secure session ile sınırlı bir preview'dur; bu sınır kullanıcı tarafından seçilmelidir.
6. Fiziksel Android'de kapat/aç,8 saat expiry/401, logout/delete, offline davranış, guest/favoriler ve geri tuşu; Keystore/backup ve nihai APK izin dökümü test edilmeli. Bu görev cihaz kanıtı üretmedi.

Google Play öncesi gerçek destek/işletmeci bilgileri, privacy/delete-account yayını ve Data Safety beyanı tamamlanmalı. VersionCode'ın önceki mağaza kullanım durumu ayrıca kontrol edilmeli. Yeni production URL, e-posta veya credential uydurulmadı.
