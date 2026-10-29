# CI #14 ve Windows süreç düzeltmesi

30 Ekim 2026, Europe/Istanbul. Başlangıç HEAD `308bd6dd179bbfaf286540bc2379a03ee4bc4191`; dal `feature/announcements-core`. CI #14 için kullanıcının verdiği hata çıktıları yerelde yeniden üretildi. Bu görevde GitHub push, Render deploy, EAS build veya production DB bağlantısı/yazımı yapılmadı.

## 1. Locked Prisma testinin kesin nedeni

`infra/test-locked-prisma.cjs`, bozuk-cache negatif testi için `.local/release-candidate/archive-negative-*` geçici klasörünü `mkdtempSync` ile açıyordu. Üst klasörün zaten var olduğunu varsayıyordu. `.local` Git dışında olduğundan temiz checkout'ta klasör yok: **ENOENT**, test henüz cache hash kontrolüne ulaşmadan başarısız oluyor. Yerel çalışma ağacında önceki testlerden kalan klasör hatayı gizliyordu.

Aynı Node22 tabanında yalnız lockfile ve iki test/build dosyasının kopyalandığı temiz Linux image'ında önce FAIL; doğrudan dosya sistemi denemesinde `phase=TEMP_DIRECTORY, code=ENOENT` yeniden üretildi. Düzeltmeden sonra aynı temiz image PASS.

Düzeltme: test kendi üst klasörünü recursive mkdir ile oluşturur. Güvenli catch artık hata türü ve kodunu verir; ham mesaj, URL veya secret yazdırmaz. Geçici klasör sınır kontrolü/temizliği, yanlış cache'te exit1, SHA-512 reddi, tam206/Content-Range/uzunluk, redirect/403/429 ve eksik/fazla gövde kontrolleri korundu. `fetch-locked-prisma.cjs`, Dockerfile, pnpm9.15.4, Prisma6.19.3 ve lockfile bütünlüğü değiştirilmedi.

## 2. Admin browser 403'ün kesin nedeni

Güvenli browser response gözlemi aşağıdaki iki farklı yanıtı ayırdı:

| İstek | Neden | Beklenti |
| --- | --- | --- |
| `PUT /api/v1/account/profile` | Test bilerek cookie ile fakat CSRF başlığı olmadan gönderiyor | 403; mevcut güvenlik negatif testi |
| `POST /api/v1/admin/announcement-imports/:id/review`, action=PUBLISH | Kaynağın registry hak durumu REVIEW_REQUIRED; yeni `SourceRightsStore` kontrolü `Source license review required` döndürüyor | Lisans doğrulanmamışsa 403 |

SYSTEM_ADMIN girişi, HttpOnly session cookie, staging, draft ve APPROVE başarılıydı. Başarısız PUBLISH sonrası DB satırı **APPROVED**, `announcementId=null` olarak kaldı. Sonraki Playwright locator PUBLISHED düğmesini aradığı için 30 saniyede timeout oluşuyordu. Bu auth yetkisi kaybı veya eksik admin rolü değildir; eski testin yeni kaynak izin sözleşmesini hazırlamamasıydı.

Düzeltilen browser senaryosu önce gerçek 403'ü ve DB'nin yayımlanmamış kalmasını assert eder. Ardından mevcut `test-source-fixtures.cjs` üzerinden **yalnız o izole test sürecinin belleğinde**, yalnız Energy fixture kaynağına SYNTHETIC lisans kanıtı verir. Gerçek SYSTEM_ADMIN cookie/CSRF/RBAC akışıyla tekrar PUBLISH isteğini gönderir, 201 ve PUBLISHED sonucunu doğrular. Registry nesnesi finally'de eski hâline döner; disk veya production kaynak izni değişmez. Fixture dosyaları için Python alt süreçleri gizli çalıştırılır. Browser testinin test DB host/isim kontrolü sıkılaştırıldı; PDF upload flag'i yalnız doğrulanmış test hedefinden sonra açıkça ayarlanır.

Windows Edge/Playwright üzerinde **25 kontrol PASS**: login, cookie, CSRF reddi, kaynak lisansı reddi, import/draft/approve/publish/archive/reject/audit, Gazete PDF, ÖSYM PDF ve onay, session expiry/logout, USER rolü reddi. İzin veya admin guard'ı kaldırılmadı; HTTP403 yok sayılmadı; locator timeout artırılmadı.

### Browser sonrası CI dizin sözleşmesi

Temiz Linux'ta browser adımı geçildikten sonra `test-source-rights-flow.cjs` ve `test-career-rss.cjs` için ek bir çalışma dizini varsayımı ortaya çıktı. Workflow bu dosyaları repo kökünden çağırıyor; testler ise `../../services` ve `../../.local` yollarını CWD'ye göre kuruyordu. Windows runner bunları apps/api içinden çalıştırdığı için sorun gizliydi. Python script/fixture ve çıktı yolları `__dirname` ile sabitlendi. Yetki, revokasyon, SHA veya uygunluk assert'leri değiştirilmedi. Bu, CI #14'te ilk görünen iki hatadan ayrı, devamındaki test sırasıyla ortaya çıkarılan test yolu düzeltmesidir.

## 3. Windows terminal çoğalması

İlk süreç incelemesinde eski Metro owner PID10680 altında **10** `KadroRadar/node_modules/jest-worker/.../processChild.js` Node süreci bulundu. API PID24696 düz Node, Vite PID26412 idi; Nest watch veya başka KadroRadar restart wrapper'ı gözlenmedi. Üç servis önceki başlatmadan kalan aynı parent altında çalışıyordu.

Kurulu Metro kodunda transformer ve file-map worker'ları jest-worker ile fork ediliyor; fork seçeneklerinde windowsHide yok. Parent CLI'yi gizli başlatmak child fork seçeneklerini değiştirmiyor. Bir gerçek worker kontrollü kapatıldı; 700ms sonra yeni PID ile sayının tekrar 10'a geldiği **canlı olarak gözlendi**. Jest worker restart kodu bu davranışla eşleşiyor. Görünen her pencerenin window handle'ı tek tek eşleştirilmedi; bütün bilgisayardaki her Node penceresi için kesinlik iddia edilmez. Kanıtlanan KadroRadar çoğalması Metro worker havuzu ve respawn'dır. VS Code task/launch dosyası bulunmadı; diğer projelerin süreçleri veya Windows startup ayarları değiştirilmedi.

Çözüm:

- `apps/mobile/metro.config.js`: yalnız Windows'ta maxWorkers=1. Kurulu Metro'da hem transform hem file-map işi bu durumda process içinden çalışır. Linux varsayılan paralelliği korunur. Paket/node_modules patch'i veya sürüm yükseltmesi yok; Windows'ta paralellik yerine sessiz ve öngörülebilir geliştirme seçildi.
- `infra/dev.cjs` ve `infra/dev.ps1`: tek foreground owner, üç doğrudan Node child, shell/detached/restart yok; hidden child süreçleri ve özel loglar. State lock ikinci start'ı reddeder; durum dosyası atomik güncellenir. Stop nonce ile yalnız owner'a iletilir; owner yalnız kendi child ağaçlarını durdurur. Dış PID listesi veya tüm node.exe'leri öldürme yok.
- Yerel API hedefi yalnız loopback `/kadroradar`; production URL reddedilir. Start migration/seed/import veya admin oluşturmaz. Source/push/upload/kayıt kapalı ve PROCESS_ROLE=api. Status env/DB okumaz ve açık logların ACL'sini değiştirmez.
- PowerShell wrapper kendi PSHOME güvenlik modülünü açık yoldan yükler; Windows PowerShell5.1'in miras kalan PowerShell7 modül yolundan yanlış Security modülünü seçmesi önlenir. Mevcut özel dizin/backup yardımcısı değiştirilmedi.

Yalnız doğrulanmış eski KadroRadar owner/child'ları durduruldu. Yeni owner altında API/admin/Metro var; sonraki süreç gözleminde **0 jest-worker child**. Ayrı sentetik ilgisiz Node sürecinin stop sırasında hayatta kaldığı test edildi. Önceden gözlenen diğer Codex Node süreçleri kapatılmadı.

Kullanım (tek terminal):

```powershell
Set-Location C:\projects\KadroRadar
.\infra\dev.ps1 start
# Ayrı terminalde salt okunur durum / kontrollü durdurma:
.\infra\dev.ps1 status
.\infra\dev.ps1 stop
```

Start terminalinde Ctrl+C de owner shutdown yoluna gider. API derlenmiş dist'ten çalışır; API kodu değişince build ve kontrollü stop/start gerekir. Bu araç Nest watch ile otomatik restart açmaz. Beklenmeyen child çıkışında diğer sahipli servisler durur. Hard-kill/power loss sonrasında state bozulursa araç fail-closed davranır; rastgele PID öldürmez. Telefon için loopback geliştirme URL'si ayrıca USB reverse/LAN ayarı gerektirir; EAS preview HTTPS ayarları değiştirilmedi.

## 4. Değiştirilen dosyalar

- `.github/workflows/ci.yml`: Windows Node22 ve bağımlılıksız Metro/iki-shell status kontrolü.
- `infra/test-locked-prisma.cjs`: eksik parent dizinini oluşturma ve güvenli hata kodu.
- `apps/api/test-admin-browser.cjs`: kaynak lisansı negatif/pozitif fixture sözleşmesi, test target/upload ayarı ve güvenli response route/status teşhisi.
- `apps/api/test-source-rights-flow.cjs`, `apps/api/test-career-rss.cjs`: repo kökü/apps/api CWD farkından bağımsız yollar.
- `apps/mobile/metro.config.js`: yalnız Windows inline worker.
- `infra/dev.cjs`, `infra/dev.ps1`, `infra/test-dev-process.cjs`: sahipli geliştirme süreçleri ve entegrasyon testleri.
- `infra/test-official-sources-isolated.cjs`: `--browser-only` / `--admin-browser` seçenekleri; yalnız yeni geçici PG16 hedefleri.
- `docs/RELEASE_CANDIDATE_FILES.json` ve bu rapor: ilgili dosyaların eksiksiz listesi.

23 ayrı operatör/diagnostik dosyanın başlangıç SHA-256 değerleri `.local/ci-process-fix/operator-hashes.json` ile karşılaştırılır; core commit'e eklenmez. Gerçek XML, .local çıktıları, env, dump, backup/receipt, signing veya credentials commit'e girmez. Yeni Prisma migration yok. Production 8.611 kayıt/SYSTEM_ADMIN doğrulanmak için bile sorgulanmadı. Kaynak registry'si, 15 migration ve Android 1.0.1 / code3 değişmedi.

## 5. Test sonuçları

| Kontrol | Sonuç |
| --- | --- |
| Locked Prisma Windows | PASS |
| Locked Prisma temiz Linux, .local olmayan başlangıç | Önce ENOENT/FAIL, düzeltme sonrası PASS |
| Admin browser Windows, ayrı PG16 | Önce PUBLISH403/APPROVED ile fail; sonra 25 kontrol PASS |
| İzole PG16 regresyon runner | 12 grup PASS; auth/capabilities/session/favoriler, source rights/revokasyon, Kariyer RSS, historical pagination/puanlar, browser ve gerçek XML offline staging |
| API/admin build / mobil TypeScript | PASS |
| Android export | PASS; 1.142 modül/25 asset; APK değil |
| Preview config / Kariyer Python | 10 config / 8 parser kontrolü PASS |
| PowerShell5.1/7 özel dizin testleri | PASS |
| PowerShell5.1/7 dev status/start/stop/duplicate/başka Node koruma | PASS |
| Asıl Dockerfile.api source build | PASS; cache kullanıldı; mevcut runtime image üzerine kod kopyalama değil |
| Yeni image Linux runtime | 9 kontrol + ağsız Python import PASS; DB kesintisi503/toparlanma200 dahil |
| Tam temiz Linux hoisted workspace | 1.003 paket frozen install PASS; Node22/pnpm9.15.4; host node_modules yok |
| Linux Chromium ve CI test sırası | **33 Node dosyası PASS**; browser öncesi/sonrası aynı CI sırası, legal browser ve kaynak/Kariyer/historical dahil |
| Linux mobil TypeScript / Android export | PASS; aynı temiz1003-paket ortamı |
| Release secrets / manifest | PASS; son staged içerik de commit öncesi taranır |

Tam Linux bağımlılık kurulumu 407 cache reuse ve 521 arşiv indirmesiyle 432,2 saniye'de tamamlandı. Docker güvenlik politikası gereği lifecycle script'ler kapalı; Prisma Client/engine üretimi ayrıca checksum doğrulanarak açıkça çalıştırıldı. GitHub'ın ana install adımı lifecycle script'lerini normal çalıştırır; ortamın bu farkı saklanmaz. Test binary/kilitli paket sürümleri aynıdır. İlk birleşik OS+Chromium kurulum denemesi 600 saniye'de download aşamasında durdu; Playwright locator/test timeout'una dokunulmadı. OS kurulum ve gereken headless browser indirmesi ayrı sınırlı katmanlara ayrıldı. Bu sadece yerel doğrulama image'ıdır; production Dockerfile değiştirilmedi.

Linux test image'ı fresh1003-paket bağımlılık kurulumundan oluşturuldu; güncel test/mobil kaynakları ayrı COPY katmanlarıyla tamamlandı, host node_modules veya env kopyalanmadı. Minimal Debian'da eksik mobil kaynaklar ve DejaVu fixture fontu ilk harness denemelerini durdurdu; bunlar GitHub CI uygulama hatası diye sunulmadı ve image kapsamı tamamlandı. Chromium141 / Playwright1.56.1 aynı kilitli browser revision'ının headless shell'iyle çalıştı. Host Windows SDK/TypeScript testleri buna ek doğrulamadır.

Yerel kanıtlar `.local/ci-process-fix/linux-ci-results.json`, Windows12-grup sonuçları `.local/ci-process-fix/windows-regressions.json`, son7-grup API-CWD sonuçları `.local/release/source-automation-regressions.json`; diğer yerel kanıtlar `.local/ci-process-fix/`, `.local/release/source-automation-regressions.json`, `.local/release/render-readiness.json`. Gerçek XML uyumluluğu offline'dır; canlı RSS başarısı değildir. Yeni GitHub CI çalışması/push olmadan remote job'ların yeşil olduğu iddia edilmez.

## 6. Git commit

İlgili düzeltmeler için istenen tek atomik mesaj:

`fix: restore release CI contracts and stabilize Windows processes [skip render]`

Bu raporu içeren fix commit'in tam SHA'sı:

```powershell
git log -1 --format=%H -- docs/CI_AND_WINDOWS_PROCESS_FIX.md
```

Tam SHA teslim mesajında ve `.local/ci-process-fix/commit.json` yerel makbuzunda ayrıca kaydedilir. Commit yalnız yukarıdaki ilgili dosyaları içerir; mevcut 23 operatör değişikliği ayrı kalır. `git add .` kullanılmaz.

## 7. GitHub push onayı

Kullanıcının ayrı push onayından sonra:

```powershell
git push origin feature/announcements-core
```

Bu komut çalıştırılmadı. `[skip render]` commit mesajı korunur; Render Dashboard auto-deploy ayarı push öncesi ayrıca gözden geçirilmelidir. Yeni CI sonucu doğrulanmadan deployment'a geçilmez.

## 8. Render öncesi kalanlar

- Push onayı ve sonraki remote CI'nin tüm job'ları.
- Mevcut Web Service/branch, doğru SHA ve health release.commit doğrulaması; SOURCE_SYNC/NOTIFICATIONS/DOCUMENT_UPLOADS=false, PROCESS_ROLE=api. Mevcut kayıt politikası değiştirilmez.
- Migration/import/seed/bootstrap komutu eklenmez; mevcut yedek ve rollback SHA korunur.
- Kariyer Kapısı REVIEW_REQUIRED/enabled=false kalır. İzin gelmeden otomasyon veya ilan yayını açılmaz; ilan.gov.tr kısıtları korunur.
- Render release, yeni APK/EAS ve fiziksel cihaz kabulü ayrı yetki ve işlem gerektirir. Bu görevde yapılmadı.
