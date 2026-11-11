# Auth ve Resmî Gazete release hazırlığı

31 Ekim 2026, Europe/Istanbul. Dal `feature/announcements-core`; başlangıç ve mevcut yayımlanmış release `4e5b86c5de22210eef254b682df6890ba96c4bca`. Bu belgedeki yeni düzeltmeler yerel çalışma ağacındadır; commit, push, Render deployment veya EAS build yapılmadı. Production DB bağlantısı, migration veya veri yazımı yapılmadı.

## 1. Kayıt/giriş hatalarının nedeni

**Production kayıt reddi bir kod arızası değil, kapalı kayıt politikasıdır.** Salt okunur `GET /api/v1/account/capabilities` HTTP200 ile `selfRegistration=false`, parola sınırları12/128 döndürdü. Production'a register/login POST gönderilmedi. `ALLOW_SELF_REGISTRATION` değiştirilmedi.

İzole gerçek PostgreSQL16 testi ayrıca giriş sonrasında yaşanabilecek bir hata buldu: profil henüz oluşturulmadıysa `GET /account/profile` Prisma'dan null dönüyor, Nest bunu **boş HTTP200 gövdesi** olarak gönderiyordu. Mobil `response.json()` başarısız oluyordu. İlk test `PROFILE_AND_RBAC / EMPTY_JSON_BODY` ile bunu kanıtladı. Controller artık profil yokken `{}` döndürür. Güncelleme modeli ve kayıt politikası değişmedi; migration gerekmez. Bu düzeltme production'a henüz yayımlanmadı.

## 2. Kayıt açılması için gereken koşullar

- İşletmecinin ayrı kararıyla production kayıt politikası değerlendirilmelidir. Bu görev kayıt açmaz.
- Açılacaksa doğrulanmış backend release'i, HTTPS API, doğru CORS/origin ve proxy/IP ayarları, kalıcı PostgreSQL ve rate-limit davranışı korunmalıdır. USER varsayılan rolü sunucuda belirlenir; istemciden gönderilen SYSTEM_ADMIN rolü dikkate alınmaz.
- Sunucu12–128 karakter parola, e-posta biçimi/uzunluğu ve aynı normalize e-posta için ikinci kayıt reddini uygular. Parola salted scrypt-v2 ile saklanır; doğrulama timing-safe karşılaştırma kullanır. Hash iş kapasitesi sınırlıdır.
- Mevcut sistemde herkese açık e-posta doğrulama ve adayın unuttuğu parolayı e-posta ile sıfırlama akışı yoktur. Yeni özellik kapsamına alınmadı; kayıt açılışından önce sahiplik doğrulaması, kötüye kullanım ve hesap kurtarma politikası işletmeci tarafından karara bağlanmalıdır. Admin kurtarma operatör araçları adaylara açık parola sıfırlama hizmeti değildir.
- Gizlilik/hesap silme sayfalarındaki gerçek işletmeci, destek ve saklama bilgileri tamamlanmalıdır. Örnek destek adresi üretilmedi.

## 3. Mobil oturum kalıcılığı

Önceki sürümde token yalnız module-level bellekteydi; restart sonrası giriş kayboluyordu. SDK54'ün kendi `bundledNativeModules.json` eşlemesine uygun **expo-secure-store ~15.0.8** eklendi. Lockfile yalnız bu paketin importer/package/snapshot kayıtlarıyla12 satır büyüdü; mevcut sürümler yükseltilmedi.

- Cihazda yalnız token, mutlak bitiş zamanı, API adresi ve kayıt sürümü saklanır. E-posta, parola veya profil SecureStore kaydına yazılmaz. AsyncStorage/localStorage veya dosya tabanlı fallback yoktur.
- Android SecureStore şifreli depolama/Keystore mekanizmasını kullanır. Managed config plugin'i SecureStore shared preference kaydını hem eski Auto Backup hem yeni cloud/device-transfer yedeğinden hariç tutar. Native introspection ile üretilen manifest referansları ve SDK kaynak XML'leri doğrulandı. Biyometri/Face ID istenmez; yeni kamera/mikrofon/depolama izni eklenmedi.
- Uygulama açılırken secure kayıt okunur; geçersiz biçim, geçmiş tarih ve farklı API adresine ait kayıt silinir. Root navigator ilk render'da bağlı kalır; kısa başlangıç katmanı kullanılır. Vault okununca oturumsuz gezinme ağ kontrolünü beklemez; mevcut token ayrıca `/account/profile` ile doğrulanır.
- Sekiz saatlik **mutlak sunucu süresi uzatılmaz**. Refresh token veya süresiz kalıcı oturum eklenmedi; mevcut256-bit rastgele token ve DB'de SHA-256 özetli session modeli kullanılır. Süre bitince/uygulama yeniden öne gelince veya korumalı istekte oturum temizlenir ve yeniden giriş gerekir. Cihaz saati sunucuya göre bozuksa istemci fail-closed davranabilir; sunucu süresi her zaman yetkilendirmede belirleyicidir.
- 401 tokenı temizler; yanlış parolalı login için genel kimlik bilgisi mesajı gösterilir. 403 izin reddi oturumu sebepsiz silmez. Rate-limit/origin/ağ/timeout hataları ham sunucu mesajı içermez. Önceki oturumun geç kalan401 yanıtı yeni tokenı silemez.
- Logout ve başarılı hesap silme secure kaydı temizler. Logout ağ hatasında da yerel temizleme denenir; sunucunun o durumda iptal yaptığı iddia edilmez. Normal sunucu logout'u kullanıcının tüm session'larını iptal eder. SecureStore silme hatası varsa işlem tam başarı olarak gösterilmez; bellek temizlenir, güvenli storage hatası gösterilir. OS storage arızasında fiziksel silmenin gerçekleştiği garanti edilmez.
- Vault işlemleri sıralanır; restore/clear yarışı eski tokenı geri getirmez. Kaydedilenler, Bana Uygun, bildirimler ve ilan detayındaki oturum görünümü abonelikle güncellenir. Restore sonrası açık korumalı ekranın veri isteği tekrar çalışır. Profil ve Bilgi ekranındaki eski “yalnız bellekte” açıklaması ve web gizlilik metni güncellendi.

Expo'nun [SecureStore belgesi](https://docs.expo.dev/versions/latest/sdk/securestore/) Android depolama ve backup sınırlamalarını açıklar; gerçek SDK54 uyumu bu projede kurulu Expo54 paketi ve SecureStore15.0.8 plugin kaynaklarından ayrıca doğrulandı. Bu testler gerçek Android Keystore denemesi değildir.

## 4. Gerçek auth test sonuçları

`test-auth-readiness.cjs`, rastgele adlı, localhost'a bağlı **ayrı PostgreSQL16 test konteynerinde73 kontrol PASS**:

| Alan | Doğrulanan davranış |
| --- | --- |
| Kayıt kapalı | 403 REGISTRATION_DISABLED; kullanıcı sayısı değişmez |
| Kayıt açık | USER oluşturulur; normalize e-posta; istemci rolü yükseltemez |
| Geçersiz kayıt | Boş/yanlış e-posta, eksik/yanlış tip alan,11 ve129 karakter parola reddi |
| Sınır/duplicate |12 ve128 karakter kabul; aynı e-posta tekrarında400 |
| Login | Yanlış parola/e-posta ve boş giriş401; mobil token yalnız mobil yanıtta; web yanıtında bearer token yok |
| Session |64-hex rastgele token/CSRF ayrılığı; DB'de ham değer yok; no-store;8 saat TTL; expired session401 |
| Cookie | HttpOnly, Secure, SameSite=Strict; mevcut browser testlerinde CSRF negatif/pozitif akışı |
| Yetki | Oturumsuz/bozuk token401, USER admin erişimi403; başka kullanıcı profili/favorisi ayrı |
| Profil | İlk boş profil `{}`; oluşturma/güncelleme, puan sınırı, tekrar eden il temizliği |
| Favori | Ekleme idempotent; kaldırma idempotent; silme sonrası ilişkiler kaldırılır |
| Logout | Token iptali, kullanıcının tüm session'ları gider; diğer kullanıcı etkilenmez |
| Hesap silme | Profil/favori/session kaldırılır; hesap anonimleşir; eski bilgilerle yeniden login401 |
| Rate limit |15 dakikalık IP/scope penceresinde ilk10 deneme, sonraki denemede403 AUTH_RATE_LIMITED; hash kapasitesinde429 testi ayrıca PASS |

Rate-limit tabloları yalnız bu doğrulanmış disposable DB içinde senaryolar arasında temizlendi. Testlerin gerçek kullanıcı/production kayıtlarıyla ilişkisi yoktur.

`test-mobile-session.cjs`: **23 senaryo PASS**; restart/restore, mutlak expiry, logout/delete,401/403, bozuk kayıt, farklı API origin, güvensiz HTTP reddi, unavailable/read/write/delete storage hataları, restore/clear yarışı, geç kalan401 ve abonelik. Native SecureStore sınırı Node testlerinde taklit edilir; gerçek cihaz testi sayılmaz.

## 5. Resmî Gazete teknik denetimi

Mevcut parser/adaptörler silinmedi veya değiştirilmedi. Akış ve sınırlar:

| Aşama | Mevcut teknik durum |
| --- | --- |
| Günlük fihrist | Operatörün sağladığı HTML'den tarih/sayı/mükerrer, ilan HTML/PDF link keşfi ve SHA; canlı siteye otomatik istek değildir |
| Gerçek PDF indirme | Gazette için kayıtlı canlı downloader yok; yerel PDF yükleme mevcut. Genel RSS transport/probe altyapısı Gazette indirme entegrasyonu sayılmaz |
| HTML ilan | Yerel resmî HTML, güvenli encoding ve kaynak URL kontrolü; script metni aday içeriğine katılmaz |
| PDF metni | PyMuPDF, boyut/şifre/broken-encoding sınırları; sayfa kanıtı ve çok sayfalı ilan birleştirme |
| OCR | İsteğe bağlı Tesseract/Turkish dil kontrolü ve sınırlı kaynak kullanımı. OCR belirsizliği review sebebidir; otomatik yayın yok |
| Personel/kadro | İhale/mahkeme ayrımı, kurum başlıkları, tablo kadroları, P3/P93/P94 ve eksik şart işaretleri; kapsam tamamlığı otomatik kesinleştirilmez |
| Tarihler | Açık belge kanıtı olmayan tarihler null/UNKNOWN; tahmin canonical tarih olmaz. Eksik bitiş tarihi açık ilan olmaz |
| Staging | Belge SHA, satır kimliği/hash, private document ve provenance; tekrar import mükerrer kayıt üretmez |
| Admin/audit | Role/CSRF, version kontrolü, kaynak ve alan doğrulama, onay/yayın/arşiv/iptal/uzatma ve audit zinciri mevcut |
| Public API/mobil | Yalnız doğrulanmış/yayımlanmış veri; restricted kaynak koruması, resmî linkler ve UNKNOWN uygunluk davranışı |
|48/96 saat worker | Genel interval/due/lock/retry ve bağımsız source-worker mevcut; canlı run yalnız energy/career destekler. Gazette `liveSupported=false`, MANUAL_DOCUMENTS_ONLY; interval ayarı tek başına Gazette otomasyonu sağlamaz |

### Gerçek yerel PDF kanıtı

Kullanıcının önceden sağladığı38.526.722 byte dosya kullanıldı; bu denetimde internetten PDF indirilmedi. SHA-256:

`050f756d5475090556dc4981709a760fd9776d1589584b902506de4486300dca`

| Metrik | Sonuç |
| --- | --- |
| Gerçek yerel belge / incelenen sayfa |1 /140 |
| Belge |24 Eylül2026, sayı33380; bugünün yeni yayını değildir |
| Aday ilan / ayrıştırılan kadro satırı |6 /39 |
| Şüpheli sayfa / eksik bitiş tarihli aday |12 /5 |
| Review gereken aday / OCR denemesi |6 /0 |
| İzole staging oluşturulan / tekrar import duplicate |6 /6 |
| İzole onay ve yayın / yayımlanan kadro satırı |2 /9 |
| Canlı günlük keşif / indirme, bu görev |0 /0 |
| Production'a aktarım/yayın / fiziksel Android denemesi |0 /0 |

İki uçtan uca örnek Niğde Ömer Halisdemir ve Atalan ilanlarıdır. Niğde'nin8 kadro satırı/29 kontenjanı ve Atalan'ın1 satırı kaynakla parser testinde karşılaştırılır. Atalan'da kesin saat/tarih yoksa bitiş null kalır; tam uygunluk çıkarılmaz. Süresi geçmiş Niğde arşivde bulunur; açık ilan listesine girmez.

**İzole yayın testinde kaynak lisansı, mevcut test fixture mekanizmasıyla yalnız test süreci belleğinde hazırlanır. Bu gerçek kullanım izni veya production lisans onayı değildir.** Belgenin tamamı, gerçek XML veya ilan görselleri Git'e eklenmez.39 parser satırının tamamı doğrulanmış/yayımlanmış sayılmaz; yalnız9 satır uçtan uca örnek yayın kontrolünden geçti.

Python Gazette **21 test PASS**, buna gerçek140 sayfalık PDF üzerinde4 test dahil; skip0. HTML, mükerrer, OCR hata davranışı ve belirsiz tarihler diğer testlerle doğrulandı. Yerel kanıt `.local/auth-gazette/gazette-real-summary.json` altındadır.

## 6. Production'da doğrulananlar ve kapalı bileşenler

Yalnız herkese açık HTTP GET kullanıldı; connection string istenmedi veya okunmadı.

| Kontrol | Sonuç |
| --- | --- |
| `/api/v1/health` | İlk20s istekte timeout; sonraki istekte200, status=ok, database=ready |
| Release commit |4e5b86c5de22210eef254b682df6890ba96c4bca |
| `/historical/placements` |200, total8611 |
| `/announcements?view=open` |200, total0 |
| `/announcements/news` |200, items0 |
| `/account/capabilities` |200, selfRegistration=false,12/128 |
| `/privacy`, `/delete-account` |200 |

Render environment/özel admin operasyon endpoint'leri bu görevde incelenmedi. Bu nedenle gerçek runtime'da SOURCE_SYNC/NOTIFICATIONS/DOCUMENT_UPLOADS bayraklarının değerlerinin tekrar doğrulandığı iddia edilmez. Mevcut hedef deployment sözleşmesi `SOURCE_SYNC_ENABLED=false`, `NOTIFICATIONS_ENABLED=false`, `DOCUMENT_UPLOADS_ENABLED=false`, `PROCESS_ROLE=api` olarak korunur. Kayıt kapalı olduğu public capability ile doğrudan doğrulandı. Yerel registry'de Gazette ve Kariyer enabled=false/REVIEW_REQUIRED; Gazette canlı adaptörü ayrıca yoktur.

Upload kapalı olduğunda PDF POST503 verir; API içinde mevcut manuel inceleme işlevinin var olması production upload'un açık olduğu anlamına gelmez. Kalıcı storage ve yetkili işletmeci kararı olmadan bu bayrak açılmamalıdır. Render Free üzerinde kesintisiz worker varsayılmaz.

## 7. Kaynak politikası engelleri

Gazette automationPermission=UNVERIFIED, rightsAssessment=REVIEW_REQUIRED; Kariyer Kapısı da REVIEW_REQUIRED/enabled=false kalır. Bu denetim yeni bir izin değerlendirmesi veya yazılı izin elde etmedi. Önceki erişim teşhisleri güncel canlı indirme başarısı olarak aktarılmaz. Olgusal indeksleme ve tam belge yeniden yayımı ayrı kavramlardır; burada source-specific erişim/indeksleme kapsamı doğrulanmadan izin bayrağı değiştirilmedi. İlan.gov.tr kısıtları korundu. PDF/HTML yalnız private admin inceleme ve yerel test içindir; tam belge public yayını açılmadı.

## 8. Değişen dosyalar ve migration

- Backend: `apps/api/src/candidate.ts` boş profil JSON düzeltmesi; `apps/api/test-auth-readiness.cjs`, `test-mobile-network.cjs`.
- Mobil: `lib/account.ts`, yeni `lib/use-session.ts`; `_layout`, `profile`, `saved`, `matches`, `notifications`, `announcement/[id]`, `about` ekranları.
- Native bağımlılık/config: `apps/mobile/package.json`, `app.json`, `pnpm-lock.yaml`.
- Test/CI: `infra/mobile-account-test-loader.cjs`, `test-mobile-session.cjs`, `test-secure-store-config.cjs`, `test-official-sources-isolated.cjs`, `.github/workflows/ci.yml`.
- Metin/manifest: `web/privacy.html`, `docs/RELEASE_CANDIDATE_FILES.json`, bu rapor.

Yeni Prisma modeli/migration yok. Mevcut15 migration, kullanıcı rolleri ve kayıt politikası değişmedi. Önceki23 operatör/diagnostik değişikliği korunur; bu işe karıştırılmaz. API endpoint eklenmedi; mevcut `/account/profile`200 yanıtının boş gövde sorunu düzeltildi.

## 9. Regresyon ve CI

- API/admin build, mobil TypeScript ve Android export **PASS**. Android export1.148 modül/25 asset; native APK değildir.
- Ayrı PG16 üzerinde **16 grup PASS**: aday hesabı, policy/news, mobil ağ, indexing, source operations,48/96 scan, bağımsız worker, historical pagination/puan filtreleri, kaynak hakları/revokasyon, Kariyer RSS, admin browser/audit, auth73, auth kapasitesi, gerçek Gazette, iptal/uzatma/HTML günlük akış, gerçek RSS offline staging.
- Gizlilik ve gerçek cookie/CSRF web hesap silme için ayrı legal browser **PASS**.
- Mobil session23, native SecureStore config, preview10, mobil kaynak/UI10 ve güvenli Prisma hata sınıflandırması **PASS**. Locked Prisma/SHA-512 sözleşmesi **PASS**.
- Python: Gazette21; Kariyer8; geçmiş parser5; kaynak adaptörü3; manuel import3 **PASS**.
- CI workflow'a auth-readiness, mobile-session ve native-config testleri eklendi. Gerçek PDF/XML CI'ye taşınmaz; CI mevcut sentetik fixture'larla bağımsızdır.
- CI #16 başarısı yayımlanmış4e5b86c release'i için kullanıcı tarafından bildirildi. Yeni yerel değişiklikler için remote CI çalıştırılmadı; “yeni CI yeşil” iddiası yoktur. Docker clean build bu görevde tekrar çalıştırılmadı.
- Manifest **101 candidate dosya /23 ayrı operatör dosyası /163 göreli import /0 kapsam dışı değişiklik PASS**. Secret taraması769 nesne/dosyada **0 bulgu PASS** (heuristic kontrol, mutlak sızıntısızlık garantisi değildir). `git diff --check` PASS;23 operatör dosyasının önceki SHA-256 değerleri değişmedi. Private `.local` kanıtları Git dışında kalır. Ana16-grup kanıtı `.local/auth-gazette/isolated-results.json`; son ayrı legal test runner'ın genel çıktı dosyasını değiştirebilir.

## 10. Son Android APK öncesi kalanlar

1. İlgili değişikliklerin incelemesi, ayrı commit/push onayı ve yeni CI sonuçları; ardından ayrı backend deployment yetkisi. Bu görev bunları gerçekleştirmez.
2. SecureStore native modül içerdiğinden yeni APK gerekir; eski preview binary'de yalnız JS güncellemesi native modülü eklemez. Native modül yoksa plaintext fallback yapılmaz; giriş güvenli storage hatası verir, oturumsuz gezinti sürer.
3. Yetkili izole test hesabıyla fiziksel Android'de login → uygulamayı tamamen kapat/aç → profil/favoriler; expiry/401; logout → restart; hesap silme → restart; offline restore/logout ve ekran geri tuşu denenmelidir. Production gerçek kullanıcı hesabı bu görevde kullanılmadı.
4. Android Auto Backup/yeniden kurulumda token taşınmaması ve Keystore davranışı gerçek cihazda doğrulanmalıdır. Node native mock ve config introspection, bu cihaz kanıtının yerine geçmez.
5. Preview HTTPS API, SDK54, com.kadroradar.app, version1.0.1/code3 korunur. Mağazaya yeni yükleme için daha önce kullanılan versionCode durumu ayrıca kontrol edilmelidir; burada artırılmadı.

## 11. Google Play kapalı test hazırlığı

Gerçek destek/işletmeci/saklama bilgileri, Data Safety beyanı, hesap silme web yolu ve gizlilik metninin yayımlanmış sürümü işletmeci tarafından tamamlanmalıdır. Google Play Console/kapalı test tester kurulumu ve EAS signing/build onayı ayrı işlemdir. Bağımsız platform açıklaması ve resmî kaynak linkleri görünür kalır. SecureStore/biyometri izinleri config'te incelendi, ancak nihai APK izin dökümü ve fiziksel kabul yapılmadı. Bu belge mağaza veya production otomasyonu tamamlanmış gibi bir sonuç vermez.
