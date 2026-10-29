# KadroRadar release / deployment son kontrolü

29 Ekim 2026, Europe/Istanbul. Bu rapor yalnızca bu çalışmanın kanıtlarını içerir; önceki raporların Docker ve Git durumu tarihsel kayıt olarak korunur. Production veritabanı kullanılmadı; GitHub push, Render deploy, EAS build veya gerçek ilan yayını yapılmadı.

## 1. Docker timeout: kanıtlanan neden ve çözüm

Önceki `node-linker=hoisted` kurulumu API image'ına mobil workspace dahil 1.003 paket taşıyordu. Docker içinde API/admin seçimi ve `node-linker=isolated` ile sayı **407** oldu. Mobil geliştirme için kökteki `.npmrc` aynen korundu. Seçili grafikte mevcut root importları için public hoisting kullanılır; sürüm, lockfile, integrity ve lifecycle-script politikası değişmez.

407 paketlik ilk deneme 405 paketi tamamladıktan sonra yine 900 saniyede exit124 verdi. Cache indekslerinde `prisma@6.19.3` ve `@prisma/client@6.19.3` yoktu. `bytes@3.1.2` için görülen geçici socket timeout toparlandı. Ayrı, aynı resmî Prisma Client arşivi ölçümünde 90 saniyede yalnızca 769.227 bayt alındı. Büyük arşiv aktarımı darboğazı böylece pnpm extraction aşamasından ayrıldı.

DNS ve TLS tamamen bozuk değildi: hem host hem Docker public registry'ye doğrulanmış TLS ile HTTP 200 verdi. Ölçümler değişkendi. ISP/CDN/proxy kaynaklarından hangisinin sorumlu olduğu kesin olarak belirlenmedi. TLS doğrulaması kapatılmadı; secret, mirror veya dependency sürüm yükseltmesi kullanılmadı.

Npm'in aynı public HTTPS tarball URL'sinde standart Range desteği HTTP 206 ve doğru Content-Range ile doğrulandı. 512 KB ilk deneme parça timeout'u verdi; 64 KB parçalar, en fazla 8 eşzamanlı istek, istek başına120 saniye ve toplam840 saniye sınırıyla ilerleyen deneme kullanıldı. İlk hatada tüm aktif istekler iptal edilir; otomatik sınırsız retry yoktur. Büyük iki arşiv için süre/uzunluk/eşzamanlılık sınırı olan, tüm dosyayı mevcut lockfile SHA-512 ile karşılaştıran alternatif aktarım denendi. 403/429/redirect takip edilmez. Bütünlük doğrulanmadan dosya pnpm'e verilmez. `pnpm store add` yalnız store'u doldurur; proje/lockfile sürümlerini değiştirmez. [pnpm store belgesi](https://pnpm.io/cli/store). Son kurulum yine frozen lockfile ile yapılır.

Asıl Dockerfile build'inde iki arşiv 554,8 saniye içinde lockfile SHA-512 doğrulamasını geçti; pnpm store importu tamamlandı. Frozen kurulum **407 reused / 0 downloaded**, 2,6 saniye. İlk store komutundaki pnpm9 bayrak hatası desteklenen `--config.ignore-scripts=true` biçimiyle düzeltildi.

Daraltılmış grafiğin ortaya çıkardığı ek kod hatası: `generate-prisma.cjs`, proxy olmadığı halde koşulsuz `https-proxy-agent` yüklüyordu. Agent importu yalnız proxy tanımlıysa çalışır; doğrudan doğrulanmış TLS bağlantısı bu bağımlılığı istemez. Proxy dalı korunur; özel proxy ile bu görevde build testi yapılmadı.

İki aşamalı build/runtime ayrımı korunur. Saf prod-only prune uygulanmadı: mevcut güvenli operatör araçları root Prisma CLI ve aynı dizin yapısını kullanıyor. Mobil bağımlılıkları çıktı; seçili API/admin build araçları runtime node_modules içinde kalır. Ayrı CLI/tools image'ı ilerideki boyut optimizasyonudur; bu görevde operatör sözleşmesi değiştirilmedi.

## 2. Temiz Docker build sonucu

**PASS.** `docker build --progress=plain --metadata-file .local/release-candidate/clean-build-metadata.json --file Dockerfile.api --tag kadroradar-api:release-candidate-clean .` exit0.

Image config digest `sha256:da475e0e70ba71f7fbb1115d94183ddf214a4ec9c0d277ac5834f6d5bbe38348`; OCI manifest-list digest `sha256:a357f02390e5d6c81abf894b784c5cd0468ecc56d6e7509c08f5a14af49f254e`.

Bu image node22 resmî tabanından Dockerfile kaynaklarıyla oluşturuldu; eski rc1/runtime image'ı veya host node_modules kullanılmadı. Normal BuildKit/download cache kullanıldı; boş cache ile tek komutta süre garantisi verilmez. Bu görevde 407 paketlik seçili grafiğin 405 paketi npm üzerinden, iki büyük tarball yeni doğrulanmış aktarım yoluyla edinildi. Son build bağımlılık/OS katmanlarını cache'den kullandı; Prisma generation, Nest/admin compilation ve runtime COPY çalıştı.

Schema engine SHA-256 ve query engine SHA-256 resmî checksum'larıyla eşleşti; query engine iki 120 saniye timeout sonrasında mevcut üçüncü sınırlı denemede tamamlandı. Generation 348,5 saniye; Nest 4,3 saniye / admin 3,0 saniye. Bu da ağ gecikmesinin ortamda sürdüğünü gösterir; timeout'lar sınırsız yükseltilmedi.

## 3. Linux runtime smoke

**PASS.** Yeni `kadroradar-api:release-candidate-clean` üzerinde 9 runtime kontrolü ve ağsız Python smoke geçti. Docker image ID/runtime digest `sha256:a357f02390e5d6c81abf894b784c5cd0468ecc56d6e7509c08f5a14af49f254e`; boyut 1.230.339.888 bayt. Kanıt tarihi 29 Ekim 2026, 23:20 Türkiye saati.

PORT=10000 / API_PORT=3999 önceliği, Nest başlangıcı, dört flag kapalı, account/capabilities HTTP 200 ve registration=false, admin/legal assets HTTP 200, izole 15 migration ve idempotence, boş public API HTTP 200 ve format, eksik kayıt HTTP 404 / admin HTTP 401, yalnız sentetik test operatörü/rol yükseltme reddi, DB durunca health HTTP 503 ve toparlanınca HTTP 200 PASS. Test çıktısındaki `Admin creation failed` beklenen duplicate/role-escalation negatif kontrolüdür; production hesabı değildir.

`fitz`, `career_rss`, `rss_transport`, `source_adapters`, `source_rights` importları ağsız container'da PASS; kaynak kapalı ve gerçek XML image dışında. Geçici test container/network'leri temizlendi. Kanıtlar `.local/release/render-readiness.json`, `.local/release-candidate/rss-runtime.json`, `clean-build-metadata.json`, `clean-build.log`.

## 4. Manifest ve koruma

`docs/RELEASE_CANDIDATE_FILES.json` esas alınır. `infra/test-release-manifest.cjs` aday dosyaların varlığını, private dosya dışlamasını, relative import bağımlılıklarını ve tüm dirty/untracked değişikliklerin kategorisini denetler. Derlenmiş dist importları kaynak TS dosyalarıyla karşılaştırılır. Operatör grubu core grubuyla kesişmez.

23 önceki backup/admin-account/ÖSYM operatör dosyası korunur; hash'leri `.local/release-candidate/preserved-operator-hashes.json` altında karşılaştırılır. Bunlar core commit'e otomatik eklenmez. `.local`, gerçek XML/ilan çıktıları, env/dump/receipt/ZIP/signing dosyaları kapsam dışıdır. Toplu `git add .` kullanılmaz.

Yeni Prisma migration yok; schema ve 15 migration değişmedi. `pnpm-lock.yaml` SHA-256 `0fa4939b9f83ef2f8e0470caa8c0016b29c5b821dfac8ebc31e306acfeec7b31` değişmedi. SDK54, `com.kadroradar.app`, 1.0.1/versionCode 3 korundu.

## 5. API/auth ve mobil regresyonları

| Kontrol | Sonuç |
| --- | --- |
| API / admin build | PASS |
| Mobil TypeScript | PASS |
| Android export | PASS; 1.142 modül / 25 asset; APK değildir |
| İzole PG16 | 11 grup PASS; auth/capabilities/session/favoriler, policy/revokasyon, worker, historical pagination/puan filtreleri, Kariyer RSS ve gerçek XML staging dahil |
| Python | Toplam 78 test: 73 PASS, haricî belge gerektiren 5 SKIP |
| Gerçek RSS offline | 21 metadata; 18 personel staging; ikinci aktarım 18 duplicate; onay 0 / yayın 0 |
| Kaynak validators/card | PASS; sentetik transport ve kaynak kategori/tarih kuralları |
| Mobil UX/UI ve preview config | PASS; gerçek cihaz testi değildir |
| Build Range sözleşmesi | Doğru 206 kabul; 200/302/403/429, bozuk range, aşırı/eksik uzunluk reddi PASS |
| Secret taraması | PASS, 0 bulgu; sezgisel tarama, tam güvenlik denetimi değildir |
| Yerel servisler | API 3000 / admin 5173 / Metro 8081 HTTP 200; yerel HistoricalPlacement toplam 504 |

11 grup: `test-candidate`, `test-usability-auth-news`, `test-mobile-network`, `test-indexing-policy`, `test-source-operations`, `test-announcement-scan`, `test-source-worker-process`, `test-historical-release`, `test-source-rights-flow`, `test-career-rss`, yalnız `.local` altındaki gerçek staging testi.

Gerçek XML ve türetilen testler/çıktılar yalnız `.local/kariyer` altında. CI gerçek XML'e bağlı değildir. Gerçek kaynak çekimi veya ilan yayın başarısı iddia edilmez. Production 8.611 toplamı bu görevde yeniden sorgulanmadı; önceki doğrulanmış production durumudur. Hiçbir production DB yazımı yapılmadı.

## 6. Commit ve Git durumu

Başlangıç HEAD `0d7c0d0e3f8016a2bcf0fa58fb5a42d8d2d81147`, dal `feature/announcements-core`.

Bağlı API/admin/mobil/source-policy/build/CI dosyaları ve manifestin istediği dokümanlar tek atomik core commit grubudur: **71 kod/test + 8 doküman/taslak = 79 dosya**. Böylece ilk commit'in CI'si eksik manifest/rapor veya importla kalmaz. Core SHA commit sonrasında ayrı rapor güncellemesinde kaydedilir. 23 operatör dosyası ayrı dirty grupta kalır ve hash'leri korunur. Push için ayrıca kullanıcı onayı gerekir.

## 7. CI hazırlığı

Mevcut workflow sentetik parser ve kaynak fixture'ları, auth/UX, historical filtreler, Android export, Dockerfile build ve Linux runtime kontrollerini içerir. Gerçek XML Git'e ve CI'ye yüklenmez. Yerel sonuçlar uzaktaki GitHub CI sonucu değildir; push yapılmadığı için remote CI çalışmadı. Push sonrası GitHub CI aynı Dockerfile'ı checkout'tan bağımsız yeniden oluşturacak; remote sonuç ancak o zaman doğrulanabilir.

## 8. Render manual deployment

1. Ayrı push onayından sonra manifest/core commitlerini `feature/announcements-core` dalına gönderin ve GitHub CI'nin yeşil olmasını bekleyin.
2. Mevcut Render Web Service'i koruyun. Branch ve Dockerfile yolu `Dockerfile.api`; Docker context repository root. Yeni servis/DB oluşturmayın.
3. Dashboard'da `SOURCE_SYNC_ENABLED=false`, `NOTIFICATIONS_ENABLED=false`, `DOCUMENT_UPLOADS_ENABLED=false`, `PROCESS_ROLE=api` doğrulayın. `ALLOW_SELF_REGISTRATION` mevcut production kararı olarak korunur.
4. DATABASE_URL mevcut Render hedefi olarak Dashboard'da kalır; paylaşılmaz. `NODE_ENV=production`, mevcut HTTPS `CORS_ORIGINS`, `TRUST_PROXY_HOPS=1` doğrulanır. Render `PORT` önceliklidir. Pre-deploy migration/seed/import/bootstrap komutu eklemeyin.
5. Mevcut yedek ve önceki SHA rollback için korunur. Ayrı deployment onayından sonra Manual Deploy → Deploy a specific commit ile onaylı SHA seçilir.
6. Salt okunur GET: `/api/v1/health` içindeki `release.commit` Render commit'iyle karşılaştırılır; tarihsel toplam 8.611, sayfalar arası benzersiz kimlikler, taban/tavan filtreleri, announcements, account/capabilities, `/admin/`, `/privacy`, `/delete-account` kontrol edilir. Gerçek kullanıcı açılmaz veya policy değiştirilmez.

Bu adımlar uygulanmış deployment değildir. Bu görevde production bağlantı bilgisi kullanılmadı.

## 9. RSS neden kapalı

Kariyer Kapısı `REVIEW_REQUIRED` / `enabled=false`. Otomatik erişim ve bağımsız mobil/ticari metadata kullanım kapsamı için resmî yanıt henüz yok. Gerçek XML uyumluluğu izin yerine geçmez. Canlı otomasyon ve production ilan yayını kapalı kalır; logo/hotlink yoktur. İlan.gov.tr ve alt alan kısıtları korunur. Worker örneği `.github/workflows` dışındadır; aktifleştirilmez.

## 10. Android APK hazırlığı

API URL `https://kadroradar.onrender.com/api/v1`. Expo SDK 54/package/sürüm/profile/ikon/splash/izin kontrolleri geçti. Yeni backend release'in capability/news sözleşmesi ve gerçek production kayıt kararı önce doğrulanmalı.

```powershell
Set-Location C:\projects\KadroRadar
node infra/check-preview-config.cjs
pnpm --filter @kadro/mobile exec tsc --noEmit
python infra/check-release-secrets.py
```

EAS hesap/kota/maliyet/signing review'su ve ayrı kullanıcı onayından sonra (bu görevde çalıştırılmadı):

```powershell
Set-Location C:\projects\KadroRadar\apps\mobile
eas.cmd build --platform android --profile preview
```

Mevcut preview 1.0.1 / code 3 korundu; yeni artifact/store sürüm kodu kararı build öncesinde alınır. Export APK değildir. Telefonda oturumsuz ilan/geçmiş liste, gerçek boş veri, filtreler, login ve kapalı/belirsiz kayıt, favoriler, geri tuşu, offline/timeout/retry, büyük yazı, TalkBack, klavye/autofill ve kaynak dış linkleri sınanmalı.

## 11. Google Play kapalı test engelleri

- Onaylı push/CI ve Render release henüz yok.
- Temiz image ve runtime engeli kapandı; bu, onaylı Render deployment veya fiziksel cihaz kabulü yerine geçmez.
- EAS/signing/kota, yeni APK fiziksel cihaz kabulü, ardından AAB/Play Console işlemleri ayrı yetki ister.
- Destek kimliği, gizlilik/hesap silme ve Data safety gerçek veri akışıyla son kez eşleştirilmeli.
- Production kayıt politikası kararı, e-posta doğrulama/parola kurtarma ve hesap yaşam döngüsü sınırları önceki raporlardaki gibi açık kalır. Bellekteki oturum uygulama yeniden başlayınca yeniden giriş gerektirir.
- RSS kullanım hakkı ve ayrı aktivasyon kararı beklenir; kaynak kapalı release edilmesi bu hakkı veya canlı veri başarısını sağlamaz.
