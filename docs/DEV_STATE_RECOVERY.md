# Windows geliştirme owner/state kurtarması

31 Ekim 2026, Europe/Istanbul. Dal `feature/announcements-core`, başlangıç commit'i `6b7a01ccd21c99dc639751921d3e18b993215c94`. CI #15'in altı işinin başarılı olduğu kullanıcı tarafından bildirildi; bu görev yeni remote CI çalıştırmadı.

## Kanıtlanan hata ve belirsizliğin sınırı

Eski `readState()` proje yolunu `s.root !== root` ile karşılaştırıyordu. Windows'ta aynı klasör farklı harflerle çağrılabilir; Node `__dirname` üzerinden çağrıdaki harf biçimini taşıyabiliyor. Gerçek aktif state ile şu iki salt okunur çağrı farklı sonuç verdi:

```powershell
node C:\projects\KadroRadar\infra\dev.cjs status
# RUNNING, PID 11648
node c:\projects\kadroradar\infra\dev.cjs status
# FAIL, DEV_STATE_INVALID
```

Bu, **aynı aktif owner üzerinde yeniden üretilmiş yol karşılaştırması hatasıdır**. Kullanıcının hata aldığı önceki terminal oturumunun tam yol yazımı kaydedilmediğinden o oturumun kesin tetikleyicisinin de harf farkı olduğu ayrıca kanıtlanamaz. İnceleme sırasında normal yol ve iki PowerShell wrapper'ı çalışıyordu; hata çıktısı rastgele bastırılmadı.

İncelenen state 239 byte, geçerli UTF-8 JSON, BOM yok, version=1, beklenen proje yolu, geçerli 32-hex nonce ve üç doğru child kaydı içeriyordu. Yarım JSON, bozuk tarih, erişim reddi, rename artığı veya nonce uyuşmazlığına dair kanıt yoktu. `.tmp` artığı görülmedi. State ACL'si owner kullanıcıya aitti; status sırasında ACL değiştirilmedi. Nonce değeri rapora veya sohbet çıktısına yazılmadı.

## İlk gerçek süreç teşhisi

Komut satırları yalnız içeride eşleştirildi; ham komut satırı veya environment yazdırılmadı.

| PID | Parent | Doğrulanan iş | Creation time UTC |
| --- | --- | --- | --- |
| 26512 | 26244 | PowerShell `infra/dev.ps1` wrapper, hâlâ aktif | 2026-10-31T09:00:55.3157890Z |
| 11648 | 26512 | Node `infra/dev.cjs` owner | 2026-10-31T09:00:56.1149380Z |
| 16212 | 11648 | `apps/api/dist/main.js`, port3000 | 2026-10-31T09:00:56.2252220Z |
| 26196 | 11648 | Vite, port5173 | 2026-10-31T09:00:56.2368090Z |
| 26256 | 11648 | Expo Metro, port8081 | 2026-10-31T09:00:56.2520800Z |

State `startedAt=2026-10-31T09:00:56.166Z`; owner'dan yaklaşık 51ms sonra. Üç portun sahipleri state ile eşleşti. Owner'ın beklenmedik yeniden başlatıldığı gözlenmedi. Önceki çalıştırmanın başka bir PID'ye devredilmiş olması bu aktif ağaçta görülmedi.

## Düzeltmeler

- `infra/dev-state.cjs`: Windows'ta canonical/case-insensitive proje yolu karşılaştırması; Linux saf yol testlerinde case-sensitive karşılaştırma. JSON/schema, nonce biçimi, benzersiz child ad/PID, tarihler ve proje sınırı doğrulanır. UTF-8 BOM kabul edilir; bozuk JSON korunur. Genel `DEV_STATE_INVALID` yanında güvenli `detail` alanı hangi kontrolün başarısız olduğunu belirtir.
- `infra/dev-process-identity.ps1`: CIM ile yalnız istenen PID'lerin script kimliği, parent PID ve creation time bilgilerini döndürür. Komut satırı, URL, kullanıcı adı veya environment çıktısı yoktur. Yanlış proje/script `OTHER` olarak sınıflandırılır. Gizli ve sınırlı süreli PowerShell alt süreci kullanılır.
- `infra/dev.cjs`: status/stop/start artık yalnız PID'nin hayatta olmasına güvenmez. Owner script'i, creation time ve bütün mevcut child ilişkileri doğrulanır. PID reuse veya farklı child fail-closed reddedilir. Yeni version2 state owner/child creation time değerlerini kaydeder. Eski version1 state yalnız doğru script/parent ve 2 saniye içindeki owner başlangıcıyla kabul edilir; legacy timestamp kontrolü yeni version2'nin tam zaman eşitliğinden daha sınırlı kanıttır.
- Aktif owner için state/nonce yeniden üretilmez. İlk yol düzeltmesi PID11648 üzerinde kesintisiz doğrulandı. Sonra istenen yaşam döngüsü testleri için yalnız doğrulanan owner üzerinden stop yapıldı ve yeni kod yüklendi.
- Gerçek stale state yalnız owner ve kayıtlı child PID'ler yoksa arşivlenir; körlemesine silinmez. Başka süreçte yeniden kullanılmış PID, orphan child veya bozuk state otomatik temizlenmez.
- Stop nonce'u korunur. Yanlış nonce owner'ı durdurmaz. Stop sırasında farklı runId ortaya çıkarsa komut başarısız olur. Yeni owner child sonlandırmadan hemen önce kimlik/creation time kontrolünü tekrarlar; doğrulanamayan child'a sinyal göndermez, state'i korur. Windows yalnız sahip olunan PID ağacı için `taskkill /PID /T` kullanır; global Node sonlandırması yoktur. Probe ile sonlandırma arasında çok kısa bir işletim sistemi yarışı hâlâ mümkündür; Windows process handle üzerinden atomik terminate garantisi iddia edilmez.
- `infra/dev.ps1`: `diagnose` seçeneği eklendi. Status/diagnose DB veya env okumaz. Mevcut PS5.1/7 güvenlik modülü seçimi ve özel dizin davranışı korundu.
- `infra/test-dev-state.cjs`, `infra/test-dev-process.cjs`: deterministik state/kimlik negatif testleri ve gerçek iki-shell yaşam döngüsü. Mevcut Windows CI işi bunları mevcut test girişinden çalıştırır; workflow değiştirilmedi.
- `docs/RELEASE_CANDIDATE_FILES.json`: yeni modül/helper/test/rapor dahil edildi. Önceki 23 operatör dosyası ayrı kalır.

Süreç kimliği probe'u Windows CIM içindir. Desteklenmeyen platformda süreç yönetimi açık hata ile durur; bu görev Linux'ta dev servis yaşam döngüsü doğrulaması yapmadı. Linux'taki Metro paralellik ayarı değiştirilmedi.

## Güvenli kurtarma ve komutlar

```powershell
Set-Location C:\projects\KadroRadar
.\infra\dev.ps1 diagnose
.\infra\dev.ps1 status
# İhtiyaç olduğunda yalnız doğrulanmış owner üzerinden:
.\infra\dev.ps1 stop
.\infra\dev.ps1 start
```

Start foreground çalışır; status/stop için ayrı terminal kullanılabilir. PowerShell5.1 ve PowerShell7 desteklenir. Farklı harfli aynı Windows yolu artık hata üretmez. Mevcut çalışan servisler teslim sonunda açık bırakılır.

`DEV_STATE_INVALID` devam ederse `detail` alanını inceleyin:

| Detail | Güvenli davranış |
| --- | --- |
| JSON_INVALID / STATE_READ_FAILED | Dosyayı silmeyin; özel yerel kopyasını ve erişim durumunu operatör incelemesine bırakın |
| PROJECT_ROOT_MISMATCH | Başka proje state'i olabilir; dosyayı kopyalayarak yönetimi devralmayın |
| OWNER_IDENTITY_MISMATCH / OWNER_CREATION_MISMATCH | PID başka süreçte olabilir; PID'yi sonlandırmayın |
| CHILD_IDENTITY_MISMATCH / ORPHAN_CHILD_PRESENT | Child kimliği tekrar doğrulanmadan toplu stop veya state temizliği yapmayın |
| SCHEMA_INVALID / SERVICES_INVALID / CHILD_TIME_INVALID | Bozuk/uyumsuz state'i koruyun; yeni owner uydurmayın |

`DEV_IDENTITY_PROBE_FAILED` durumunda ham CIM/stderr paylaşmayın. Yetki veya probe erişimi düzeltilmeden owner yönetimini zorlamayın. Nonce gizli bir üretim kimlik bilgisi değildir; yine de loglanmaz. Yerel aynı kullanıcıya karşı tam bir güvenlik sınırı oluşturduğu iddia edilmez.

## Test sonuçları

- Aktif legacy owner PID11648: normal/farklı harfli yol, PS5.1 ve PS7 status/diagnose **PASS**; ilk düzeltmede servis kesintisi yok.
- Saf state/kimlik testleri: **23 kontrol PASS**. Bozuk JSON ve BOM; farklı proje; geçersiz nonce; duplicate/null child; stale kayıt; orphan; owner script uyuşmazlığı; owner PID reuse ve child parent/script/creation time uyuşmazlığı. PID reuse gerçek OS PID döngüsü zorlanarak değil, deterministik izole metadata fixture'larıyla test edildi.
- Gerçek Windows yaşam döngüsü: mevcut aktif owner stop; PS7 start/status/stop; PS5.1 tekrar start/status; duplicate start reddi; yanlış nonce'un yok sayılması; farklı harfli çağrı **PASS**. İlgisiz gerçek sentetik Node süreci probe'da OTHER olarak tanındı ve yaşam döngüsü boyunca korundu.
- Metro Windows inline worker / Linux varsayılan ayarı **PASS**. Port3000/5173/8081 HTTP200; son gözlemde Metro worker child sayısı **0**.
- API build, admin build, mobil TypeScript **PASS**.
- Rastgele adlı ayrı PostgreSQL16 test konteynerinde mevcut **12 regresyon grubu PASS**: auth/profile/session, mobil ağ, kaynak hakları/revokasyon, tarama/worker, historical pagination/puan filtreleri, Kariyer RSS, admin browser ve gerçek XML offline staging. Geçici test DB'de mevcut migration'lar test kurulumu için uygulandı; yerel ana DB veya production'a migration uygulanmadı.
- Gerçek XML offline fixture başarısı canlı RSS otomasyonu olarak sunulmaz. Güncel sonuçlar `.local/release/source-automation-regressions.json` altındadır; private XML commit'e girmez.
- PowerShell5.1/7 özel dizin/ACL testleri **PASS**. Kariyer RSS Python **8 test PASS**; locked Prisma/SHA-512 sözleşmesi, preview config **10**, mobil kaynak/UI sözleşmesi **10** ve güvenli Prisma hata sınıflandırması **PASS**.
- Yerel Android export **PASS**, 1.142 modül/25 asset; `.local/dev-state-android-export` altında. APK/EAS build değildir. Docker image yeniden build edilmedi; Dockerfile, lockfile ve API runtime kodu bu görevde değişmedi.
- Release manifesti **89 dosya**, 23 ayrı operatör dosyası ve 149 göreli import ile **PASS**. Operatör dosyalarının önceki SHA-256 değerleri değişmedi; commit öncesi staged secret taraması ayrıca uygulanır.

## Release etkisi

Yalnız yerel geliştirme yöneticisi, testleri ve manifest/rapor değişti. API iş mantığı, auth/kayıt politikası, Prisma şeması/15 migration, kaynak registry'si, Expo54 ve Android1.0.1/code3 değiştirilmedi. Kariyer Kapısı REVIEW_REQUIRED ve otomasyon kapalı kalır. Production8.611 kayıt ve SYSTEM_ADMIN sorgulanmadı veya değiştirilmedi.

Bu raporu içeren commit'in SHA'sı:

```powershell
git log -1 --format=%H -- docs/DEV_STATE_RECOVERY.md
```

Yalnız ilgili dosyalar commit edilir. GitHub push için kullanıcı onayı beklenir. Render deployment, EAS build ve production DB işlemleri yapılmaz. Yeni remote CI sonucu ancak onaylı push sonrası görülebilir; CI #15 başarısı yeni commit'in CI sonucu olarak sunulmaz.
