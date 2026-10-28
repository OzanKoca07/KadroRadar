# Android preview doğrulaması — 28 Ekim 2026

Yerel ilan API hatası giderildi; preview yapılandırması ve Android JavaScript/Hermes export doğrulandı. APK oluşturulmadı. Production backend için aşağıdaki iki düzeltme henüz yayımlanmadığından sürüm koşulsuz hazır değildir.

## 1. Yerel HTTP 500: kanıtlanan neden ve onaylı çözüm

`infra-db-1/kadroradar` üzerinde repository'deki 15 migration'ın yalnızca ilk üçü uygulanmıştı. `Announcement.sourceEvidence` kolonu eksikti; güncel Prisma sorgusu P2022 üretiyordu. Gerçek yerel dump, izole PostgreSQL 16'ya geri yüklenerek aynı HTTP 500 yeniden üretildi. Bu durum production migration sorunu değildir.

Kullanıcının **“Yerel yedek + migration onaylıyorum”** onayından sonra yalnızca bu yerel veritabanına mevcut 12 SQL migration uygulandı. Öncesinde ayrı custom-format dump alındı, başka PostgreSQL 16'ya restore edildi ve bütün özgün tabloların özgün kolonları hash/sayı ile karşılaştırıldı. Migration sonrasında aynı karşılaştırma geçti. Reset, db push, veri silme veya production bağlantısı yapılmadı.

- Yedek: `.local/local-api-backups/local-schema-1793194081224-e2fa0e1df2f7.dump`
- SHA-256: `9dea52d8b52a37b78462c08111ac4e041d34ac018fa72b74c5319538f9c38212`
- Makbuz: aynı dizindeki `local-schema-e2fa0e1df2f7.json`; restoreVerified ve originalDataPreserved true.
- Sonuç: 15 uygulanmış migration, 0 bekleyen; HistoricalPlacement 504, ImportRow 504, ImportBatch 1, ReviewAudit 1, Announcement 0 korundu.
- Yerel güncel/yakında/arşiv dahil beş ilan görünümü gerçek HTTP 200 ve `items: [], total: 0, pages: 0, page: 1` döndürüyor.

## 2. Kod düzeltmeleri ve değişen dosyalar

| Dosya/grup | Değişiklik |
| --- | --- |
| `apps/api/src/database-errors.ts`, `module.ts` | Prisma şema hatalarında güvenli 503 DATABASE_SCHEMA_NOT_READY; bağlantı hatalarında DATABASE_UNAVAILABLE. Ham SQL/mesaj/secrets loglanmaz. Hatalar sahte boş listeye çevrilmez. |
| `apps/api/src/module.ts` | Historical maksimum puan aralığı, dört puan sınırı için 0–100/aralık doğrulaması, filterCapabilities ve positionCode ardından benzersiz id sıralaması. |
| `apps/mobile/app/historical.tsx` | Tavan puan aralığı; API capability bildirmiyorsa desteklenmediği açıklanır. Sunucu sayfalaması korunur. |
| `infra/local-api-schema.cjs` | Sabit yerel Docker hedefi, salt okunur status, açık onay gerektiren restore-doğrulamalı yerel migration aracı. |
| `infra/test-preview-api.cjs`, `test-safe-database-errors.cjs` | İzole gerçek PostgreSQL/API ve güvenli hata regresyonları. |
| `infra/check-preview-public-api.cjs`, `check-preview-config.cjs` | GET-only production kontrolü ve yerel/native preview config denetimi. |
| `apps/api/test-announcement-network.cjs`, `test-mobile-network.cjs`, `infra/register-mobile-typescript.cjs` | TypeScript bağımlılığı yükleyen test harness ve oturum/ağ regresyonları. |
| `apps/mobile/app.config.js`, `app.json`, `eas.json`, `package.json`, `pnpm-lock.yaml` | HTTPS/izinler, sürüm ve splash yapılandırması. |
| `apps/mobile/assets/`, `infra/generate-mobile-brand.py` | Özgün kitap/radar SVG ve 1024px PNG ikon/splash. |
| `.gitignore`, `.easignore` | Yerel dump, environment, imzalama dosyaları ve kullanıcı ZIP'inin upload dışında tutulması. Bu görevde ZIP silme işlemi yapılmadı; son kontrolde repository içinde ZIP bulunmadı. |

Yeni Prisma modeli/migration eklenmedi. Önceden mevcut mobil tasarım, auth ve infra geliştirmeleri korunmuştur.

## 3. İzole test sonuçları

| Kontrol | Sonuç |
| --- | --- |
| PostgreSQL 16 + gerçek 504 kayıtlı yerel dump + HTTP testleri | 16 grup PASS |
| Eksik kolon/orijinal 500/güvenli 503/tam şemada gerçek boş 200 | PASS |
| 12 mevcut migration sonrası özgün veri hash/sayı eşitliği | PASS |
| Maksimum puan filtresi, geçersiz aralık 400, aynı kadro kodunda kararlı sayfalama | PASS |
| Register/login, yanlış parola, profil create/update | İzole hesapta PASS |
| Eksik/doğrulanmamış şartlarda UNKNOWN ve nedenleri | PASS |
| Kaydet/kaldır/idempotence, süre uzatma/iptalin favoriye yansıması | PASS |
| Oturum süresi, logout, hesap silme, CSRF ve admin RBAC | İzole ortamda PASS |
| Güvenli Prisma hata sınıflandırması | 5 senaryo PASS |
| Mobil UI/kaynak politikası/gerçek yerel API sözleşmesi | 11 grup PASS |
| Auth, announcement, historical ağ/timeout testleri | PASS |
| API build, mobil TypeScript | PASS |
| Android Expo export | PASS; APK değildir |
| Preview config + gerçek Expo native introspection | 12 grup PASS |

Kanıtlar `.local/preview-readiness/` altındaki `isolated-api.json`, `preview-config.json`, `public-api.json` ve çalışma loglarında. İzole test dosyaları production'a yazmaz. Oturum token'ı mevcut tasarımda yalnızca bellekte tutulur: uygulama süreci yeniden başlayınca giriş gerekir. Bu davranış test edildi; kalıcı güvenli oturum depolaması uygulanmış gibi raporlanmamaktadır.

## 4. Production salt okunur kontroller

Yalnızca `https://kadroradar.onrender.com/api/v1` GET endpoint'leri kullanıldı; production veritabanına doğrudan bağlanılmadı.

- Toplam **8.611 benzersiz kayıt**, **21 kaynak belge**; dönem/eğitim filtreli 97 sayfadan tamamı okundu.
- Lisans 4.797, önlisans 2.974, ortaöğretim 840.
- Eğitim, yıl, dönem, şehir, kurum ve taban puan aralığı, detay ve resmî HTTPS ÖSYM bağlantıları doğrulandı.
- Güncel ve tüm ilanlar: HTTP 200, toplam 0. Bu gerçek boş durumdur; fixture canlı ilan olarak sunulmadı.
- `/privacy` ve `/delete-account` gerçek HTTPS sayfaları HTTP 200.

**Yayımlanması gereken iki backend düzeltmesi:**

1. Production genel dönem filtresiz sayfalama dört sayfada 400 sonuç içinde 399 benzersiz ID verdi. Kadro kodu dönemler arasında tekrar ettiği için yalnızca positionCode sıralaması yeterli değildir. Yerelde id tie-break eklendi ve izole regresyon geçti. Bu, veritabanında mükerrer kayıt bulunduğunu kanıtlamaz.
2. Production maksimum puan parametrelerini desteklemiyor; 200 dönmesine rağmen filtre uygulanmıyor. Yerel backend desteği/capability eklendi; mobil eski API'de bu alanı etkin göstermiyor.

Bu düzeltmeler **production'a deploy edilmedi**. Sıfır ilan nedeniyle gerçek production ilan detay/kısıtlı kaynak akışının dolu veriyle doğrulandığı iddia edilmez. Mobil URL/kaynak guard testleri geçti; merkezi backend/push kaynak politikasının kapsamı ayrıca gözden geçirilmelidir.

## 5. Preview APK hazırlığı

- Expo SDK 54; Android package `com.kadroradar.app`; mevcut EAS proje kimliği korundu.
- Sürüm 1.0.1, versionCode 3; preview internal distribution / APK.
- Preview API: `https://kadroradar.onrender.com/api/v1`.
- Gizlilik: `https://kadroradar.onrender.com/privacy`; hesap silme: `https://kadroradar.onrender.com/delete-account`.
- Native introspection: cleartext false, compileSdk/targetSdk 36.
- Kamera, mikrofon, harici depolama, reklam kimliği ve overlay izinleri manifest'te açıkça kaldırılıyor. Bildirim titreşim izni korunuyor.
- Özgün ikon/splash eklendi; 1024px opak uygulama ikonu ve transparan adaptive/splash doğrulandı.
- Preview URL kontrolü HTTP, loopback/IP, credentials, query/hash ve beklenmeyen port/path değerlerini reddeder.
- Destek e-postası uydurulmadı. Production yapılandırması eksik destek kimliğinde fail-closed kalır.
- EAS build/credentials/account değişikliği, ücretli işlem ve Play upload yapılmadı. İmzalama/FCM hesabı hazır kabul edilmedi.

`.easignore` Git repository kökünde mevcut ignore kurallarını da içerir; yerel testte gerekli uygulama/shared dosyaları kalırken dump/env/anahtar/ZIP dosyaları dışarıda kaldı. Gerçek EAS archive upload yapılmadı. [Expo ignore belgesi](https://docs.expo.dev/build-reference/easignore/) ve [monorepo belgesi](https://docs.expo.dev/build-reference/build-with-monorepos/) esas alındı.

Yalnızca ayrı build onayı ve hesap/kredi kontrolü sonrasında operatörün çalıştıracağı hazırlanmış komut:

```powershell
Set-Location C:\projects\KadroRadar\apps\mobile
eas build --platform android --profile preview
```

## 6. Android cihaz kontrolleri

Pixel Fold API 35 emülatöründe SDK 54 Expo Go ile production GET bağlantılı Güncel İlanlar ekranı yüklendi; gerçek boş durum, filtre ve gezinme öğeleri görüldü. Bu kontrol standalone APK veya fiziksel telefon testi değildir. Expo Go, uzak push desteğinin bulunmadığına dair uyarı gösterir; push doğrulanmış sayılmadı.

Gerçek telefonda oluşturulacak APK ile yapılacaklar:

- Temiz kurulum, ikon/splash, geri tuşu, klavye, küçük ekran ve yazı büyütme.
- Üç eğitim düzeyi, dönem/şehir/kurum/puan filtreleri ve sayfalama; backend düzeltmelerinden sonra tekrar kontrol.
- Uçak modu, timeout, tekrar deneme ve gerçek boş ilan durumu.
- İlan detayından güvenli resmî URL açılması; uygulama içinden başvuru yapılmaması.
- Ayrı izole test ortamındaki hesapla giriş, oturum, profil, kaydetme ve hesap silme. Production kullanıcı verisini değiştiren testler ayrıca onay gerektirir.
- FCM/EAS kurulumu doğrulandıktan sonra bildirim izni ve gerçek push; Expo Go sonucu yeterli değildir.

## 7. GitHub push öncesi

Çalışma ağacında bu görevden önce kalmış mobil tasarım ve admin/backup/ÖSYM teşhis değişiklikleri vardır. Toplu `git add .` yerine dosya bazlı inceleme gerekir. Bu görevde commit/push yapılmadı. Eski production dump/makbuzlarına ve kaynak envanterine dokunulmadı; envanter SHA-256 değeri değişmedi. Bu görevde kullanıcı ZIP dosyalarına silme/değiştirme işlemi yapılmadı; son kontrolde repository içinde ZIP bulunmadığından ZIP varlığı doğrulanmış sayılmaz.

Yerel yeniden kontrol komutları:

```powershell
Set-Location C:\projects\KadroRadar
node infra/local-api-schema.cjs status
node infra/check-preview-config.cjs --introspection
pnpm --filter @kadro/mobile exec tsc --noEmit
node infra/test-mobile-ui.cjs --local-api
python infra/check-release-secrets.py
git diff --check
```

## 8. Google Play kapalı test öncesi engeller

- Production backend sayfalama ve maksimum puan düzeltmelerinin ayrı onayla release/deploy edilmesi.
- Fiziksel Android APK testi, ardından production AAB ve imza doğrulaması.
- Gerçek destek e-postası, mağaza bilgileri, veri güvenliği/hesap silme beyanlarının son kontrolü.
- FCM, bildirim teslimi ve merkezi kaynak politikasının doğrulanması.
- Play Console kapalı test kurulumu ve geçerli hesap gereksinimleri; bunlar bu görevde yürütülmedi.

Production migration/import/deployment, GitHub push, EAS build ve mağaza yüklemesi yapılmamıştır. Yerel migration yalnızca açık kullanıcı onayıyla uygulanmıştır.
