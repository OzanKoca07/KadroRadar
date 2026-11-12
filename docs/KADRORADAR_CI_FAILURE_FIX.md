# KadroRadar CI #21 — fixture ve Linux runtime düzeltmesi

11 Kasım 2026. Branch: `codex/automation-only-release`. Çalışma yalnız `C:\projects\KadroRadar\.local\automation-release\worktree` içinde yapıldı. Ana dirty feature checkout değişiklikleri korunuyor.

## Doğrulanan kaynak ve CI

Fetch sonrasında yerel/uzak HEAD `5a0d45f77fcc6a4d497e8b308fb4b3577a926f4a`; bu boş retry commit'inin parent'ı `574cf222ca0a659a1f731519af3dc29edbb8268b`. CI #21/run43024215300 aynı5a0d45f SHA'sında failure: https://github.com/OzanKoca07/KadroRadar/actions/runs/43024215300. Bu görevde yeni GitHub CI başlatılmadı ve push yapılmadı.

## Hata1 — PDF_PARSE / fixtures

`test-live-announcements.cjs` inline Python'a `sys.path.insert(0,'../../services/ingest')` veriyordu. Bu yol script konumuna değil child'ın cwd'sine göre hesaplanır. Önceki yerel PG runner cwd=apps/api kullandığından import geçiyordu. CI `node apps/api/test-live-announcements.cjs` komutunu repo kökünde çağırıyor; burada aynı relative path repo dışına çıkar.

Düzeltme öncesi gerçek karşılaştırma: aynı Python import'u repo kökünde exit1/No module named fixtures, apps/api içinde exit0. Fixture `services/ingest/fixtures/make_gazette_fixture.py` zaten Git'te bulunan açık sentetik üreticidir. Özel/gitdışı fixture gerekmiyor; yeni gerçek PDF/XML veya fixture verisi eklenmedi.

Çözüm: __dirname tabanlı ingest ve çıktı dizinleri; Python'a import dizini ayrı argv olarak aktarılır. `INGEST_PYTHON` mevcut mimariyle uyumlu olarak desteklenir, yoksa python kullanılır. PDF_PARSE başarısızlığında ham stderr yerine allowlist modül/font/timeout kodu ve exitCode gösterilir. Test/assertion atlanmadı.

## Hata2 — Linux ephemeral test fixture izinleri

Eski harness host `os.tmpdir()` altında `fs.mkdtempSync` ile private700 dizin oluşturuyor ve read-only `/tests` bind mount yapıyordu. Container `USER node` UID1000 ile çalışıyor. Linux'ta host dizini başka UID'ye aitse700 izni nedeniyle container bu dizini okuyamaz; read-only bind mount Unix owner/permission sorununu çözmez. Windows bind-mount aynı POSIX owner koşulunu uygulamadığı için yerel test geçiyordu.

İzole Linux kanıtı: ayrı owner ile mode700 temp dizini oluşturuldu; Python UID1000 ile unittest discovery exit1/permission veya discovery failure verdi. Bu, eski harness'ın doğrulanmış Linux hata mekanizmasıdır. GitHub'ın önceki genel Error çıktısı alttaki stderr'i sakladığı için o koşunun tam OS errno kaydı elde edilmiş gibi sunulmuyor.

Çözüm: host temp bind mount kaldırıldı. Yalnız dört açık sentetik test/fixture dosyası whitelist ve256KiB sınırıyla Docker stdin'inden aktarılır. Image'ın kendi non-root kullanıcısı `/tmp` altında private dizini oluşturur; dosyaların sahibi aynıUID1000 olur. Network none ve image içindeki gerçek production parser modülleri korunur. Python testleri aynı26kontratı çalıştırır; finally geçici dosyaları kaldırır, container --rm ile biter. Kalıcı PDF saklama eklenmedi; host/private fixture yok.

Python import/access/font/discovery/assertion/timeout hataları güvenli sabit kodlara çevrilir. Ham stderr, traceback mesajı, response body veya secret basılmaz. Host120s timeout artırılmadı; iç Python110s sınırı cleanup için süre bırakır. Container root olarak çalıştırılmadı, dosya izinleri gevşetilmedi.

İki hatanın ortak kategorisi CI/host ortamı varsayımıdır; teknik kök nedenleri ayrıdır: cwd bağımlı import ve UID/permission bağımlı bind mount. Biri için yapılan düzeltme diğerini otomatik çözmez.

## Değişen dosyalar / explicit staging

1. apps/api/test-live-announcements.cjs
2. infra/test-ephemeral-runtime.cjs
3. docs/KADRORADAR_CI_FAILURE_FIX.md
4. docs/AUTOMATION_RELEASE_FILES.json
5. docs/RELEASE_CANDIDATE_FILES.json

Ayrı private staging manifesti `.local/automation-release/ci-fix-staging.json`; yeni rapor eklendiği için tam automation release listesi78yol oldu. İki test zaten önceki77yol içindeydi. Yalnız bu beş fix yolu stage edilebilir; git add . kullanılmaz. Runtime/business/auth kaynak kodu, workflow, Dockerfile, dependencies ve lockfile değişmez.

## Gerçek yerel sonuçlar

| Kontrol | Sonuç |
| --- | --- |
| Repo kökü ile apps/api eski import karşılaştırması | Önce ROOT FAIL/API PASS; hata yeniden üretildi |
| Linux owner/mode700 negatif koşul | Exit1; hata mekanizması yeniden üretildi |
| Düzeltilmiş Linux live-announcements | Repo kökü23/23PASS, apps/api23/23PASS; iki ayrı disposable PG16 |
| Aynı sıra PG16 toplu regresyon |24/24PASS; live-announcements artık CI gibi repo kökünden çalıştırıldı |
| Ek PostgreSQL CI grupları |11/11PASS |
| Linux ephemeral image kontratı |26/26PASS,UID1000,network none,cleanupPASS |
| Negatif harness testleri | Bozuk fixture seti ve Python exception nonzero; cleanup ve secret-sentinel güvenliği PASS |
| API/admin build, mobil TypeScript |PASS |
| Android export |PASS; APK/EAS veya gerçek cihaz testi değildir |
| Python |116test:111PASS+5özel fixture SKIP; temel parser5/5PASS |
| Worker/HMAC/workflow |50PASS; kapalı gate gerçek istek başlatmıyor |
| R2 fake transport/CLI |248PASS; gerçek R2 testi yapılmadı |
| Locked Prisma archive |PASS |
| Docker gerçek build |PASS; frozen lockfile ve mevcut build cache; --no-cache iddiası yok |
| Docker runtime readiness |13PASS, yalnız disposable PG16 |
| Python image importları / worker storage |PASS /8PASS |

Image: `sha256:c9fcfe3ccbc2355451b5142a91bdc3df863fa50accd03f73eebe6353c8b93c40`. Host testleri mevcut frozen-lockfile node_modules junction'larını kullandı; Docker Linux dependency kurulumunu kendi image'ında gerçekleştirdi.

Linux ek test runner'ının ilk migration hazırlık denemesi PostgreSQL TCP-ready olmadan durdu. Bu sonuç başarı sayılmadı. Readiness `pg_isready -h127.0.0.1` ile gerçek TCP listener'a bağlanınca hem ROOT hem API senaryosu geçti. Bu private runner düzeltmesi release koduna eklenmedi; migration/import production'da yapılmadı.

## Koruma ve karar

Son staged kapsam, secret ve hash kontrolleri tamamlanmadan commit yoktur.16migration/schema/lockfile, production auth baseline ve23operatör hash'leri yeniden doğrulanır. Migration16 beklenenSHA256:e706db2cb2241c09919c0a3c96abdc862227956b84c932b71bc2b36318a53ead.

SOURCE_AUTOMATION_APPROVED=false, SOURCE_REMOTE_INGEST_ENABLED=false, SOURCE_SYNC_ENABLED=false, R2_SOURCE_RECEIPTS_ENABLED=false kalır. Source registry ve yalnız workflow_dispatch otomasyonu değiştirilmez. Gerçek kaynak/DB/mail/R2 erişimi, PR/merge, Render deploy, EAS build ve yeni remote işlem yapılmadı (yalnız istenen fetch ve CI metadata GET'i kullanıldı).

Yerel fix commit SHA'sı commit içindeki belgeye döngüsel olarak yazılmaz; teslim mesajı ve Git dışındaki `.local/automation-release/ci-fix-commit.json` kanıtında kaydedilecektir. İki hata için yerel Linux/Windows doğrulaması PASS ise kontrollü push için koşullu GO; GitHub CI henüz bu yeni düzeltmeyi çalıştırmadığından uzak CI PASS veya merge/deploy GO iddia edilmez.

## Son commit öncesi kontrol

PASS:1045nesne/dosya secret taraması0bulgu; release manifesti78aday/159import/23ayrıoperatör/0kapsamsızdeğişiklik. Explicit fix kapsamı yalnız5yol.16migration/schema/lockfile ve auth dosyaları exact baseline hash'leriyle aynı;23operatör ve397önceki kullanıcı dosyası korundu. Registry/workflow checkout CRLF'si canonical içerik olarak aynı; bu dosyalar commit kapsamı dışında. Yerel kontrollü fix commit ve sonraki kullanıcı onaylı push için GO; uzak GitHub CI henüz bu fix'i çalıştırmadı.
