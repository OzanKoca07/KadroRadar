# Güvenli backend release ve Android preview — 28 Ekim 2026

Backend/mobil release adayı GitHub'a gönderildi. Render Dashboard/API yetkisi bulunmadığından deployment yapılmadı. Production'a doğrudan DB bağlantısı, migration, import, hesap değişikliği veya veri silme işlemi yapılmadı. EAS build başlatılmadı.

## GitHub ve release kimliği

- Branch: `feature/announcements-core`.
- Kod release SHA: `f31306cc6c3f478ab17460583c5dd3573b931fbb`.
- [Release commit](https://github.com/OzanKoca07/KadroRadar/commit/f31306cc6c3f478ab17460583c5dd3573b931fbb).
- Kod push'u başarılı; `git ls-remote` o aşamada aynı branch SHA'sını doğruladı. Bu teslimat raporu sonradan ayrı bir dokümantasyon commit'iyle gönderilir; deploy hedefi CI'den geçen yukarıdaki kod SHA'sıdır.
- Commit mesajında `[skip render]` var: CI sonucu bilinmeden otomatik deploy edilmesini önlemek için. Manuel deployment aşağıdaki **tam kod SHA'sıyla** yapılmalıdır.
- [GitHub CI](https://github.com/OzanKoca07/KadroRadar/actions/runs/40740190760): **PASS**, altı işin tamamı başarılı; headSha tam kod SHA'sıyla eşleşiyor. Sonuç 28 Ekim 2026 20:58 Türkiye saatinde doğrulandı: release-secrets, Windows powershell, Windows pwsh, typescript/API/Android export, parser ve render-runtime.

Önceki mobil UI çalışması release'e dahil edildi. Önceki admin, production backup ve ÖSYM operatör/teşhis değişiklikleri yerel çalışma ağacında korunarak bu release'in dışında bırakıldı; geniş kapsamlı `git add .` kullanılmadı. `.local`, environment, dump, özel yedek, imzalama dosyası veya kullanıcı ZIP'i commit'e alınmadı. Yeni migration/schema farkı yok.

## Backend davranışı

`apps/api/src/module.ts` içinde tarihsel liste artık `positionCode ASC, id ASC` sıralaması kullanır. Dönemler arasında aynı kadro kodu bulunması sayfaların belirsiz sıralanmasına neden olmaz. Mevcut pagination/response alanları korunur.

`GET /api/v1/historical/placements` için `maxScoreGte` ve `maxScoreLte` eklendi. Taban ve tavan filtreleri Prisma Decimal ile beş ondalık hassasiyette uygulanır; geçersiz, 0–100 dışı veya ters aralık HTTP 400 döndürür. Yanıta eklenen `filterCapabilities: { minScoreRange: true, maxScoreRange: true }` eski alanları değiştirmez. Mobil uygulama tavan filtresini yalnızca sunucu desteği açıkça bildiriliyorsa etkin gösterir.

Prisma şema/bağlantı hataları güvenli 503 kodlarıyla döner; SQL, connection URL veya ham hata mesajı yayımlanmaz. HTTP 500 mobil tarafta sahte boş listeye dönüştürülmez.

Yerel ilan HTTP 500 sorunu ve onaylı yerel yedek/migration işlemi önceki [hazırlık raporunda](ANDROID_PREVIEW_RELEASE_READINESS.md) kayıtlıdır. Bu release için mevcut 15 migration değiştirilmedi; production migration çalıştırılmayacak.

## Test kanıtları

| Kontrol | Sonuç |
| --- | --- |
| API build, admin build, mobil TypeScript | PASS |
| Android preview Expo export | PASS; `.local/backend-release-android`, APK değildir |
| Gerçek yerel 504 kayıtlı dump'ın izole PostgreSQL 16 kopyası | 17 grup PASS; orijinal 504 hash/sayı korundu |
| API regressions | 22 test grubu PASS; yalnızca yeni geçici PostgreSQL 16 üzerinde |
| Yeni historical release testi | Aynı kadro kodu/farklı dönem, benzersiz ve tekrarlanabilir pagination, Decimal taban/tavan sınırları, capability, HTTP 400 PASS |
| Auth/session | İzole register/login, yanlış parola, süre sonu, logout, profil, favoriler, hesap silme, CSRF/RBAC PASS |
| Mobil ağ testleri | Auth/historical/announcement offline, timeout, HTTP hata ve yeniden deneme PASS |
| Mobil kaynak/UI politikası | 11 grup PASS; bilinmeyen tarih/şart kesin uygunluk sayılmıyor |
| Güvenli Prisma hata filtresi | 5 senaryo PASS |
| Preview/native introspection | 12 kontrol PASS; manifest/SDK/izinler yeniden doğrulandı |
| Secret taraması | PASS, bulgu yok; heuristik taramadır |

Geniş yerel harness'in ilk çalıştırmasında belge yüklemeyi kapatan test ortamı ayarı nedeniyle gazette/daily/multisource testleri beklenen upload yerine 503 aldı. Yalnızca izole test konteynerinde yükleme açılarak bu üç test tekrar çalıştırıldı ve geçti. Production flag'leri değiştirilmedi. Bu fixture testleri canlı ilan toplama başarısı değildir.

CI'ye historical release regresyonu, güvenli hata/mobil kaynak/config kontrolleri ve Android export eklendi. Yeni CI testi kullanıcıya ait yerel yedeğe bağımlı değildir; yalnızca `kadroradar_ingestion_test_*` adlı loopback/CI veritabanını kabul eder.

## Production kontrolü: deployment öncesi gerçek durum

Yalnızca HTTPS GET kullanıldı. Production'ın bildirdiği SHA: `998deb00efc3540cac7f7c1ea18f5fb7d4d6aa3d`; yeni kod SHA'sıyla eşleşmiyor. **Deployment sonrası başarı iddiası yoktur.**

- Health HTTP 200, database ready.
- 8.611 benzersiz tarihsel kayıt; lisans 4.797, önlisans 2.974, ortaöğretim 840.
- 21 resmî kaynak belge, dönem/eğitim filtreli 97 sunucu sayfasından tamamı okundu; resmî HTTPS kaynak bağlantıları kontrol edildi.
- Güncel/tüm ilanlar HTTP 200, toplam 0. Örnek ilan eklenmedi.
- Eski production tavan puan filtresini desteklemiyor.
- Eski genel pagination dört sayfada 400 sonuç içinde 399 benzersiz ID/1 tekrar verdi. Bu bir API sıralama sorunu; veritabanında mükerrer kayıt bulunduğu sonucu çıkarılmaz.
- Son canlı GET kontrolünde `/admin/`, `/privacy` ve `/delete-account` HTTP 200; anonim admin operasyonları ve profil endpoint'i HTTP 401. Aşağıdaki deployment kontrolü bunları tekrar sorgular.

Kanıt dosyaları `.local/preview-readiness/public-api.json`, `.local/release/production-before.out.log`, `api-regressions.json` ve `api-document-regressions.json` içinde yerel tutulur; commit edilmez.

## Render Dashboard üzerinden deployment

Yeni Web Service/PostgreSQL oluşturmayın. Mevcut `kadroradar.onrender.com` servisini açın. [Render deployment belgesi](https://render.com/docs/deploys/) manuel ve belirli commit deployment seçeneklerini açıklar.

1. **Önce yukarıdaki kod SHA'sının CI sonucu tamamen başarılı olmalı.** Başarısız CI varken deploy etmeyin.
2. Settings → mevcut repository `OzanKoca07/KadroRadar`, branch `feature/announcements-core`, Dockerfile `./Dockerfile.api`, build context `.`; Root Directory boş. Mevcut region/DB bağlantısını koruyun.
3. Docker Command/Start override ve **Pre-Deploy Command boş** olmalı. Migration/seed/import çalıştıran özel komut varsa bu yönergeyle devam etmeyin. Image CMD yalnızca `node apps/api/dist/main.js`; başlangıç migration'ı yok.
4. Environment değerlerini secrets'ı sohbete kopyalamadan kontrol edin: `NODE_ENV=production`, `PROCESS_ROLE=api`, `TRUST_PROXY_HOPS=1`; mevcut `DATABASE_URL` ve gerçek `CORS_ORIGINS` korunsun. Render'ın sağladığı `PORT` kullanılır.
5. Render Free için `SOURCE_SYNC_ENABLED=false`, `NOTIFICATIONS_ENABLED=false`, `DOCUMENT_UPLOADS_ENABLED=false`, `ALLOW_SELF_REGISTRATION=false` korunsun. Scheduler/push worker açmayın. `ADMIN_REVIEW_TOKEN` production'da bulunmamalı.
6. Deploys → **Manual Deploy → Deploy a specific commit** → `f31306cc6c3f478ab17460583c5dd3573b931fbb`. Servisinizde commit seçeneği farklı görünüyorsa test edilmiş SHA'yı seçin; rastgele latest commit seçmeyin. Mevcut servisi silmeyin/recreate etmeyin.
7. Build/start başarılı, health ready ve Deploys ekranında tam SHA eşit olmalı. DB migration/operatör betiği çalıştırmayın.
8. Aşağıdaki GET-only kontrolleri çalıştırın. SHA eşleşmezse kontrol başarısız olmalı; hatayı eski/yeni sürüm farkını gizleyerek geçmeyin.

```powershell
Set-Location C:\projects\KadroRadar
$releaseSha = 'f31306cc6c3f478ab17460583c5dd3573b931fbb'
node infra/observe-public-release.cjs $releaseSha
node infra/check-preview-public-api.cjs --require-release "--expected-commit=$releaseSha"
```

İkinci komut doğru commit, gerçek taban/tavan filtreleri ve **87 genel sayfada 8.611 benzersiz ID** ile dönem bazlı 97 sayfanın tamamını kontrol eder. Sabit HTTPS origin, GET-only, makul aralık, timeout, redirect reddi kullanır; .env/DB URL/secrets yüklemez. Fixture veya production yazma yok. İlk komut health/listeler/admin/legal sayfaları ve anonim yetki reddini gözlemler; private auth/session testi yapmaz.

CI SHA, Dashboard deployment SHA ve health `release.commit` üçü eşleşmeden production düzeltmeleri tamamlandı sayılmamalı. Mevcut production yedeğini geri yükleme veya SYSTEM_ADMIN hesabını yeniden oluşturma gerekmiyor.

## Android preview: hesap, maliyet ve imzalama

- `com.kadroradar.app`, Expo SDK 54, version **1.0.1**, versionCode **3** doğrulandı.
- Preview internal APK; production HTTPS API ve gerçek privacy/delete-account adresleri `eas.json` içinde.
- Özgün ikon/splash, cleartext kapalı, SDK 36, kamera/mikrofon/depolama/reklam kimliği/overlay kaldırma kontrolleri geçti.
- EAS oturumu mevcut; desteklenen `eas project:info` ile yapılandırılmış proje UUID eşleşmesi ve read erişimi doğrulandı. İlk JSON flag denemeleri CLI tarafından desteklenmedi; bunlar proje erişim problemi olarak yorumlanmadı.
- Son Android build listesinde eski 1.0.0/code 2 production build **ERRORED** göründü. Bu yeni 1.0.1 preview build sonucu değildir. Önceki hata/log ve signing durumu operatörce incelenmelidir.
- EAS write/build rolü, kalan build kotası ve mevcut Android keystore/FCM sağlayıcı durumu bu sorgularla kesin doğrulanamaz. Credentials indirilmedi, oluşturulmadı veya değişmedi.
- [Expo fiyat sayfası](https://expo.dev/pricing) 28 Ekim 2026 kontrolünde Free için aylık 15 Android/15 iOS düşük öncelikli build bildiriyor. Bu hesabın Free planda veya kotasının müsait olduğu anlamına gelmez. Kesin ek maliyet Dashboard Billing/Usage ve seçili worker/plan üzerinden build öncesi kontrol edilmelidir; **ücretsiz olacağı garanti edilmez**.

APK build öncesi operatör adımları: EAS Dashboard'da doğru hesap/proje → Billing/Usage kotası → Android credentials/signing mevcut ve package eşleşiyor → eski errored build nedeni → backend yeni SHA doğrulanmış → kaynak arşivinde private dosya bulunmadığının son kontrolü. Yeni anahtar üretme/rotasyon veya hesap değişikliği bu görevin parçası değildir.

Kesin PowerShell komutları; ilk grup salt okunur/yapılandırma kontrolüdür:

```powershell
Set-Location C:\projects\KadroRadar
node infra/check-preview-config.cjs
pnpm --filter @kadro/mobile exec tsc --noEmit
python infra/check-release-secrets.py
Set-Location C:\projects\KadroRadar\apps\mobile
eas.cmd whoami
eas.cmd project:info
eas.cmd build:list --platform android --limit 3 --json --non-interactive
```

**Yalnızca maliyet/yetki/imzalama kontrolünden ve kullanıcının build onayından sonra:**

```powershell
Set-Location C:\projects\KadroRadar\apps\mobile
eas.cmd build --platform android --profile preview
```

Bu build komutu burada çalıştırılmadı. `eas credentials` yönetim komutu salt okunur garanti etmediğinden otomatik kullanılmadı. `.easignore`/`.gitignore` özel dosyaları dışarıda tutar; gerçek upload arşivi henüz oluşturulmadı. Oturum mevcut tasarımda bellekte; uygulama süreci yeniden başlayınca tekrar giriş gerekir.

## Fiziksel telefon test listesi ve Play engelleri

1. Yeni APK temiz kurulum/güncelleme, 1.0.1/code 3, ikon/splash ve izin istemleri.
2. Production SHA eşitliği sonrası üç eğitim düzeyi, yıl/dönem/şehir/kurum, taban/tavan filtreleri ve ardışık sayfalarda tekrarsız kayıt.
3. Gerçek boş ilan ekranı; ağ yok/timeout/yeniden deneme, geri tuşu, klavye, büyük yazı ve küçük ekran.
4. Resmî kaynak linklerinin güvenli dış tarayıcıda açılması; tam belge yeniden yayımı veya uygulama içi başvuru olmaması.
5. Ayrı izole test hesabıyla giriş/profil/favori/hesap silme. Production kullanıcı verisini değiştiren test için ayrıca izin alınmalı.
6. FCM/EAS signing kurulumu doğrulandıktan sonra bildirim izni ve fiziksel push; Expo Go emülatör kontrolü yeterli değildir.

Kalan engeller: Render deployment ve deployment sonrası GET kabul testleri, fiziksel APK/push testi, destek e-postası/mağaza işletmeci bilgileri, AAB/signing, Play Console kapalı test ve Data Safety/hesap silme beyanları. Mobil kaynak guard testleri geçti; sıfır canlı ilan varken dolu production kaynak/push politikası doğrulanmış sayılmaz. Bu görevde Play Console işlemi yapılmadı.

Önceki iki production dump'ın SHA-256 değerleri tekrar kontrol edilerek değişmediği doğrulandı. `packages/osym-production-sources.json` SHA-256 `537925DDC543BE424C2FFCFBACA4F3A8DDA9992373D02F152EC0661E354BA4AE` olarak korundu. SYSTEM_ADMIN/oturumlarına hiçbir yazma yapılmadı.
