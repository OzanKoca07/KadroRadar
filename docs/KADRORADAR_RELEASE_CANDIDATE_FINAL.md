# KadroRadar son release adayı

Güncel Docker/release kontrolü: [RELEASE_DEPLOYMENT_FINAL_CHECK.md](RELEASE_DEPLOYMENT_FINAL_CHECK.md). Aşağıdaki sonuçlar önceki sprintin tarihsel kaydıdır.
29 Ekim 2026, Europe/Istanbul. Önceki sprintlerin kodu ve commit edilmemiş değişiklikleri korundu. Bu görevde production DB yazımı, canlı RSS çekimi, scheduler aktivasyonu, gerçek ilan yayını, commit/push, Render deployment veya EAS build yapılmadı.

## 1. Gerçek RSS XML testi

Kullanıcının sağladığı `.local/kariyer/kariyer-kapisi-gercek.xml` **mevcut** ve çevrimdışı test edildi. SHA-256 `716e13db3daa3a4f1c73053ff9f74eac81c685eabb3bf99eb8719e8e87c19e93`, boyut 20.227 bayt. Bu dosya bu görevde internetten indirilmedi; eldeki dosyanın parser uyumluluğu, kaynağın o anki canlı durumu anlamına gelmez.

| İnceleme | Sonuç |
| --- | --- |
| XML | Geçerli RSS 2.0; 21 item |
| GUID | 21 URL biçimli, 21 benzersiz kimlik; hash tabanlı staging kimliğiyle uyumlu |
| Kaynak URL | 21 bağlantı kayıtlı `kariyerkapisi.gov.tr` HTTPS host'unda; yeni ağ isteği gönderilmedi |
| Kategori dağılımı | A grubu memur 5, sözleşmeli personel 13, merkezi yerleştirme 1, kurum içi yükselme 1, yurt dışı eğitim 1 |
| Uygulama sınıflandırması | PERSONNEL 18; EXAM_PLACEMENT / INTERNAL / EDUCATION birer kayıt |
| Tarihler | 21 pubDate ayrıştırıldı; beş gelecek yayın tarihi incelemeye işaretlendi |
| Türkçe | Unicode başlık/kategori ayrıştırması başarılı; replacement/demo metin üretilmedi |
| Duplicate | İkinci parse aynı metadata'yı verdi; aynı item'ların iki kat eklendiği snapshot yine 21 benzersiz kayıt üretti |
| Kurum | Ayrı, doğrulanmış kurum alanı yok; serbest başlık/description'dan işveren tahmini yapılmadı. 21 kayıt UNKNOWN |
| Başvuru tarihleri | 21 kayıt UNKNOWN. pubDate başlangıç/bitiş tarihi sayılmadı |
| Medya | description, enclosure ve namespaced medya alanları kayıt içine alınmadı; görsel/PDF indirilmedi veya hotlink edilmedi |
| Karantina | 0 yanlış URL/kimlik satırı; 0 ayrıştırma hatası |

Mevcut `career_rss.py` gerçek dosyayla uyumluydu; bu dosyayı geçirebilmek için parser/policy gevşetilmedi. Genel haber veya kurum içi kayıt personel başvurusu sayılmadı.

Gerçek dosyayla **ayrı geçici PostgreSQL 16** üzerinde manuel/offline staging testi: ilk aktarımda 18 personel adayı, ikinci aktarımda 18 duplicate ve 0 yeni kayıt. Üç genel duyuru AnnouncementImportRow'ya sokulmadı. Gerçek kayıtlarda onaylanan **0**, yayımlanan **0**; kurum ve başvuru alanları UNKNOWN kaldı. Test DB'si kendi geçici konteyneriyle kaldırıldı.

Ayrıntılı gerçek veri ve test çıktıları yalnızca `.local/kariyer/real-analysis.json`, `real-parsed.json`, `real-compatibility.json`, `real-staging.json` ve yerel test scriptlerinde. Gerçek XML, ilan başlıkları/kimlikleri/linkleri, description veya görseller GitHub dosya manifestine eklenmedi. `.gitignore` ve `.dockerignore` `.local` klasörünü dışlıyor. Bu rapor yalnızca toplu ölçümleri içerir.

## 2. Docker build ve runtime

Önceki kanıtlanan durma aşaması `pnpm install`: npm socket timeout'ları sonrasında `timeout 300s` exit **124**. Bu sonuç Nest/Prisma schema derleme hatası veya production veritabanı hatası değildi. Build context yaklaşık 9 KB son değişiklik transferi; gerçek XML/yedekler context dışında. `node-linker=hoisted` ve kilitli monorepo grafiği 1.003 paket kuruyor; önceki filtre denemelerinin kurulum sayısını azaltmadığı korunmuş raporda kayıtlı.

Bu görevde `Dockerfile.api` düzeltmesi:

- BuildKit cache mount: `/pnpm/store`, `id=kadroradar-pnpm9`.
- `pnpm install --store-dir /pnpm/store --frozen-lockfile --ignore-scripts`.
- Cold install süresi sınırlı olarak 900 saniyeye çıkarıldı; sonsuz retry yok.
- Aynı pnpm 9.15.4, aynı lockfile, aynı sürüm/checksum ve TLS kuralları. Registry mirror veya TLS bypass yok; dependency güncellemesi yapılmadı.

Cache aynı builder'da kesilen indirmelerin tekrar kullanılmasını sağlar; başka builder/hostta cache bulunacağı garanti edilmez. Render BuildKit kullandığını ve ara katmanları cache'lediğini belgeler; cache mount'larının her yeni builder'da korunacağı garanti edilmez. [Resmî Docker/Render belgesi](https://render.com/docs/docker). Yeni Python modüllerinin COPY listesi korunur.

**Temiz Dockerfile.api build: ENGELLİ.** İki süreyle sınırlı deneme de dependency install aşamasında exit **124** verdi. İlk deneme 991/1.003 pakete; cache'li deneme 999/1.003 pakete ulaştı. İkinci deneme 920 arşivi tekrar indirmeden kullandı; cache'in gerçekten çalıştığı gözlendi fakat tek başına süre sorununu çözmedi. Nest build, Prisma engine retrieval veya runtime aşamasına geçilmedi. Ağ ölçümünde aynı resmî npm arşivinin ilk 64 KB'si hostta yaklaşık 2,9 saniyede, Docker'da 7,4 saniyede geldi. Gecikme doğrulanmıştır; ISP, proxy, CDN veya paket yöneticisinden hangisinin asıl sebep olduğu kanıtlanmadı. Bu dosyanın temiz kurulumuyla üretilebilirlik hâlâ release engelidir.

**Ayrı Linux runtime test imajı: BAŞARILI.** Mevcut yerel `kadroradar-api:rc1` tabanı Node v22.23.4 / Prisma 6.19.3; içindeki Prisma şeması projeyle aynı SHA-256'ya sahip. Güncel derlenmiş API/admin, kaynak registry'si ve seçili Python modülleri yalnızca bunları içeren 41 dosyalık yerel context ile yeni `kadroradar-api:release-candidate-runtime-local` imajına alındı. İmaj ID: `sha256:695a12ed2432974eceef5347ca907c1b51f74085bee3d8dfd7ca364b865b2ebd`. Bu, eski uygulama kodunu test etmek değildir; güncel kodu mevcut bağımlılık tabanında test eder. **Temiz Dockerfile.api build'in yerine geçmez; tüm bağımlılık grafiği için yeni bir cold-install kanıtı değildir.** İmaj registry'ye gönderilmedi veya deploy edilmedi.

Bu imajda dokuz runtime kontrolü (account/capabilities 200 ve kayıt kapalı durumu dahil) ve ağsız Python importları ve gerçek XML'in imaj dışında kaldığı kontrolü PASS. Ayrı geçici PostgreSQL ile API başlangıcı, PORT10000/API_PORT3999 önceliği, dört güvenli default flag, statik admin/legal sayfaları, boş liste/filtre yanıtları, 15 açık izole migration/idempotence, test operatörü provisioning negatif kontrolleri, DB kesintisinde 503 ve toparlanmada 200 PASS. Gerçek/production DB'ye dokunulmadı. Kanıtlar `.local/release-candidate/rss-runtime.json`, `.local/release-candidate/runtime-readiness.json` ve `.local/release-candidate/runtime-content-hashes.json` içindedir.

Runtime harness düzeltmesi: önceki `test-render-readiness.cjs` bazı Node/Docker senaryolarında bekleyen fetch/AbortSignal dışında event-loop referansı kalmayınca rapor/finally çalışmadan exit 0 verebiliyordu. Eski tarihli rapor ve geride kalan yalnız bu teste ait konteynerlerle yeniden üretildi. Süreç canlı tutma guard'ı ve gerçek test tarihi eklendi; iki geçici test çifti hedefleri doğrulanarak kaldırıldı ve test tam çalıştırıldı. Başarı artık yeni tarihli rapor ve doğru imaj ID'siyle doğrulanıyor; eski rapor başarı kanıtı sayılmadı. Çıktıdaki beklenen `Admin creation failed` satırı sentetik duplicate-role-escalation negatif testine aittir.

## 3. RSS entegrasyonunun tamamlanan kısmı

RSS2 metadata, encoding/DTD güvenliği, canonical resmî URL, GUID kimliği, kategori ayrımı, bilinmeyen alanların korunması, update/dedupe, ETag/Last-Modified/304, robots ve kaynak politikası kapıları mevcut. Tek worker mimarisinde 48/96 saat due hesabı, advisory lock, hata/backoff, revokasyon ve audit korunur. Kaybolan GUID inceleme sinyalidir, otomatik iptal değildir. Tam ve güvenli snapshot olmadan validators/missing seti ilerlemez.

Admin yükleme → metadata incelemesi → personel staging → editör alan doğrulama → onay/yayın sözleşmesi kod olarak hazırdır. Gerçek kullanıcı/admin üretimi veya gerçek kaynak yayınlaması yapılmadı. Genel duyurular için ayrı model taslağı `infra/official-career-notice.sql.example` hâlâ uygulanmayan taslaktır; genel haber CMS'i tamamlandı iddiası yoktur.

Bu görevde ayrıca `test-career-rss.cjs` CI sırası regresyonu giderildi: test bütün veritabanının boş olduğunu varsaymıyor, kendi ilanını sorguluyor ve önceden var olan satırları koruyor. Auth testleri önce çalıştırılarak doğrulandı. `infra/test-official-sources-isolated.cjs` için `--auth` ve isteğe bağlı `--real-career-fixture` seçenekleri eklendi. Gerçek fixture test scripti ve sonuçları `.local` altında; CI gerçek dosyaya bağımlı değil. `infra/test-rss-runtime.cjs` ağsız import/source-disable testini CI'ye ekler; runtime harness'in sessiz erken çıkışı da giderilmiştir.

## 4. Kullanım izni bekleyen işlevler

Kariyer Kapısı **REVIEW_REQUIRED**, `enabled:false`; ağ otomasyonu kapalı. Kullanıcının önceki açıklamasına göre yazılı izin yok; genel bir internet yorumu kaynak kapsamını doğrulamaz. Mevcut kılavuzun kurumların resmî web siteleri kapsamı bağımsız/ticari mobil izin yerine kullanılmadı.

Canlı periyodik içerik çekimi, production staging/yayın, bağımsız mobil/ticari metadata kapsamı ve logo/kurumsal görseller için kaynak şartı/kanıtı ve ayrı aktivasyon kararı bekleniyor. Gerçek XML'in teknik olarak parse edilmesi bu kapıları açmaz. Kaynak kartı `EXPO_PUBLIC_CAREER_CARD_ENABLED` altında varsayılan kapalı; logo veya hotlink yok. Aynı şekilde notification worker, belge yükleme ve kayıt politikası kendiliğinden açılmadı.

## 5. Auth ve UX durumu / testler

İzole test hesapları `example.test` adresleri ve rastgele test parolalarıyla yalnızca geçici DB'de üretildi. Production hesap/kayıt politikası veya gerçek kullanıcı oturumları değiştirilmedi.

| Kontrol | Bu görevdeki sonuç |
| --- | --- |
| İzole PostgreSQL 16 | **11 grup PASS**, auth önce koşan CI benzeri sıra dahil |
| Register/login | Kapalı kayıt, capability OPEN/CLOSED, hatalı parola/origin, başarılı giriş PASS |
| Session / CSRF / RBAC | Secure/HttpOnly/SameSite cookie, token, yetkisiz erişim, kaynak review rolleri ve oturum iptali PASS |
| Profil/favoriler | Doğrulama, kaydetme idempotence, geri çekilen ilanın favoriye yansıması PASS |
| Hesap silme | Yalnızca sentetik izole hesap ve oturum kaldırılması PASS; production işlemi yok |
| Mobil oturumsuz kullanım | API çağrısı yapmadan giriş durumu, 401 temizliği, timeout/offline ve ham 403/SQL gizleme PASS |
| Slider | Boş/dolu, editör özeti, source-policy, version/audit, restricted source ve değişiklikte görünürlük düşmesi PASS |
| RSS / kaynak Python testleri | **36 PASS**, sentetik/mocked transport ve güvenlik senaryoları |
| Gerçek XML | Offline replay + izole staging PASS; canlı otomasyon testi değil |
| API/admin build / mobil TypeScript | PASS |
| Temiz Dockerfile.api build | ENGELLİ: iki install timeout/124; cold-build kanıtı yok |
| Ayrı güncel-kod Linux runtime imajı | PASS; mevcut bağımlılık tabanında, temiz build yerine geçmez |
| Android Expo export | PASS, 1.142 modül/25 asset; `.local/release-candidate/android-export` |
| Preview config / kaynak kartı / resmî link güvenliği | PASS; fiziksel cihaz ekran testi değil |
| Secret taraması | 0 bulgu; sezgisel tarama, güvenlik denetiminin tamamı değil |
| Release import bütünlüğü | Manifestte yeni relative import eksikliği yok |

Mevcut in-memory oturum tercihi değişmedi: uygulama süreci yeniden başlarsa yeniden giriş gerekir. Tam GitHub CI'nin uzaktan çalıştığı iddia edilmez; push yapılmadı. Fiziksel Android testi bu görevde yapılmadı. Production account/capabilities son önceki kontrolde 404'tü; bu görevde production kayıt politikasını açmak için istek gönderilmedi.

Yerel tekrar:

```powershell
Set-Location C:\projects\KadroRadar
pnpm --filter @kadro/api build
node .\infra\test-official-sources-isolated.cjs --auth
# Bu bilgisayardaki gerçek dosya ve yerel test scriptleriyle:
python .local/kariyer/test-real-rss.py
node .\infra\test-official-sources-isolated.cjs --auth --real-career-fixture
```

Runner dış DATABASE_URL'yi hedef olarak kullanmaz; kendi rastgele adlı loopback test DB'sini oluşturur ve sadece oraya mevcut 15 migration'ı uygular. Gerçek fixture seçeneği dosya yoksa test hatası verir; sentetik veriye sessizce dönmez.

## 6. GitHub'a gönderilecek dosyalar

Eksiksiz aday liste: [RELEASE_CANDIDATE_FILES.json](RELEASE_CANDIDATE_FILES.json). Bu bir **review manifesti**, git staging veya commit değildir.

- `coreCodeAndTests`: API/source policy/RSS/staging, admin, mobil UX/auth/news/card, registry, Python sentetik testleri, CI ve Dockerfile.
- `documentationAndInactiveTemplates`: hazırlık raporları, bu rapor/manifest, etkin olmayan scheduler örneği ve uygulanmayan SQL taslağı.
- `separateOperatorReviewPreserveUnchanged`: önceden var olan ÖSYM/admin/backup operatör ve teşhis değişiklikleri. Silinmez veya core release'e otomatik karıştırılmaz; ayrı inceleme gerektirir.

Özellikle untracked `source-rights.ts`, `home-news.ts`, `career-staging.ts`, yeni mobil modüller, `source_rights.py`, `feed_metadata.py`, `career_rss.py`, `rss_transport.py` ve fixture helper testleri unutulmamalı. Yalnız Dockerfile veya yalnız Kariyer parser'ı commit etmek eksik release üretir. Gerçek XML, `.local`, `.env`, dump, backup/receipt, özel ZIP ve signing credential kesinlikle liste dışındadır. Toplu `git add .` önerilmez.

## 7. Commit planı ve migration

Başlangıç/korunan HEAD: `0d7c0d0e3f8016a2bcf0fa58fb5a42d8d2d81147`, dal `feature/announcements-core`. Commit oluşturulmadığından yeni release SHA yok.

1. Backend/source-policy + metadata staging/admin + ilgili test helper'ları; home-news kaynağı ve candidate capability bağımlılıkları birlikte gözden geçirilir.
2. Mobil UX/auth ve source-card/news sözleşmesi, admin kısa özet UI'sı; birinci grubun API'siyle birlikte release edilir.
3. Docker cache/runtime Python listesi + CI testleri ve rapor/manifest. Her ara commit'in derlenebilirliği ayrıca kontrol edilmeli; parçalı diff staging gerekebilir.
4. ÖSYM/backup/admin-account operatör işleri ayrı commit ve ayrı güvenlik review'su; core release için doğrudan veri operasyonu yok.

Prisma schema/migration diff'i **boş**. Yeni production migration gerekmiyor. `official-career-notice.sql.example` migration klasörüne taşınmaz veya deploy sırasında çalıştırılmaz. pnpm-lock.yaml, app.json/eas.json sürüm/paket ayarları değişmedi. ÖSYM 21 kaynak envanter hash'i korunur: `537925DDC543BE424C2FFCFBACA4F3A8DDA9992373D02F152EC0661E354BA4AE`.

## 8. Render deployment öncesi

1. Manifest ve operatör grupları review; secret taraması ve tüm remote CI.
2. Onaylı release SHA'nın image/build SHA'sıyla eşleşmesi; build cache'in hedef ortamda gözlenmesi.
3. SOURCE_SYNC_ENABLED/NOTIFICATIONS_ENABLED/DOCUMENT_UPLOADS_ENABLED kapalı; PROCESS_ROLE=api. ALLOW_SELF_REGISTRATION mevcut production kararında kalır.
4. Gerçek DATABASE_URL, HTTPS CORS_ORIGINS, TRUST_PROXY_HOPS ve PORT Dashboard'da secrets paylaşmadan doğrulanır. Yeni migration/import/seed/bootstrap yok.
5. Mevcut doğrulanmış yedek ve rollback SHA korunur; release deployment için ayrı kullanıcı kararı alınır.
6. Sonrasında yalnız public GET: health/release SHA, 8.611 tarihsel kayıt, pagination/puan filtreleri, announcements, account/capabilities, /admin/, /privacy ve /delete-account.

Bu görevde Render'a deploy yapılmadı; burada verilen liste deploy başarısı değildir. Teknik kod release'iyle RSS otomasyonu aktivasyonu iki farklı karardır.

## 9. Yeni Android APK hazırlığı

Expo SDK 54, Android package `com.kadroradar.app`, version **1.0.1**, versionCode **3** ve mevcut EAS preview profili korundu. Production API `https://kadroradar.onrender.com/api/v1`; preview internal APK türünde. İkon/splash, gereksiz izinlerin bloklanması ve HTTPS kontrolü geçti.

Hazırlık (build başlatmaz):

```powershell
Set-Location C:\projects\KadroRadar
node infra/check-preview-config.cjs
pnpm --filter @kadro/mobile exec tsc --noEmit
python infra/check-release-secrets.py
```

Yalnız EAS oturum/proje, maliyet/limit ve signing review'su ile ayrı kullanıcı onayından sonra:

```powershell
Set-Location C:\projects\KadroRadar\apps\mobile
eas.cmd build --platform android --profile preview
```

Bu build komutu çalıştırılmadı. Yerel export APK değildir. Yeni preview önce oturumsuz liste, gerçek boş ilan durumu, kaynak linki, login formu, kapalı/belirsiz kayıt politikası, favoriler, geri tuşu, büyük yazı ve offline/retry akışlarında fiziksel telefonda test edilmelidir. RSS hakkı netleşmeden canlı içerik veya kaynak logosu açılmaz.

## 10. Google Play kapalı test engelleri ve teslim sınırı

- Doğrulanmış commit/push/CI ve onaylı Render deployment henüz yapılmadı.
- Gerçek production kayıt politikası, destek kimliği, gizlilik/hesap silme ve Data safety beyanları işletme kararıyla eşleştirilmeli.
- Temiz Dockerfile.api build npm indirme aşamasında hâlâ engelli. Ayrı runtime test imajının geçmesi bu engeli kaldırmaz; temiz build doğrulanmadan Render release hazır sayılmaz.
- EAS/signing, preview cihaz kabulü, AAB/Play Console ve kapalı test gereksinimleri tamamlanmalı; bu görevde dış hesaplarda işlem yok.
- Kaynağın bağımsız mobil/ticari metadata ve otomatik erişim hakkı bekleniyor; logo hakkı ayrı. Gerçek XML testi izin yerine geçmez.
- Genel career notice modeli hâlâ taslak; haricî scheduler alarm kanalı ve kaynak Retry-After sözleşmesi aktivasyon öncesi ayrı doğrulanmalı.

**Release kapsamı:** kaynaklar kapalı kalacak şekilde API/admin/mobil kod adayı hazırlanır. **RSS production aktivasyonu:** izin ve ayrıca operasyon/yayın onayı bekler. Gerçek XML'in testi tamamlandı; gerçek kayıt yayını yapılmadı.
