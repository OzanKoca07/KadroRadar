# Migration16 production backup ve release

2 Kasım 2026, Europe/Istanbul. Dal `feature/announcements-core`; HEAD `4e5b86c5de22210eef254b682df6890ba96c4bca`. Yeni araç ve testler yereldir; commit/push/deployment/EAS yapılmadı. **Gerçek Render bağlantısı veya production backup/migration/yazma yapılmadı.** Kullanıcı, gerçek read-only before sonucunu PASS/applied15/pending16/historical8611/aktif SYSTEM_ADMIN1 olarak bildirdi. Bu, aşağıdaki yeni backup aracının production'da denenmiş olduğu anlamına gelmez.

## Karar

**Araç ve izole restore testleri: GO. Gerçek backup: kullanıcı onayı ve operatör uygulaması bekliyor. Production migration: henüz NO-GO.** Bu araçla alınmış yeni, gerçek ve restore-verified bir production makbuzu yoktur. Sentetik test makbuzları migration onayı veya gerçek yedek yerine kullanılamaz.

## Hazırlanan dosyalar

- `infra/migration16-backup.ps1`: PowerShell5.1/7 gizli giriş, exact hedef teyidi, özel deneme dizini ve environment temizliği.
- `infra/migration16-backup.cjs`:15/16 read-only kaynak doğrulaması, custom dump, bağımsız restore, tam uygulama verisi/schema karşılaştırması ve atomik makbuz.
- `infra/migration16-backup-contract.json`: pinned migration SQL'lerinden ayrı test DB'de türetilmiş before/after şema fingerprint ve tablo listeleri.
- `infra/test-migration16-backup.cjs`: gerçek PG16 dump/restore, sentetik data ve olumsuz durum testleri.
- CI ve `RELEASE_CANDIDATE_FILES.json` yeni dosyaları kapsar. Eski23 operatör/diagnostik dosyası değiştirilmedi. Önceki ÖSYM/backup/admin/SecureStore/Gazette geliştirmeleri korunur.

Yeni araç korunan eski ÖSYM operatör kodunu import etmez veya sabit15 kontrolünü gevşetmez. Mevcut migration16 preflight ve güvenli hata sınıflandırması core modüllerini kullanır. Production DATABASE_URL/.env fallback, app SYSTEM_ADMIN login, e-posta API key'i, migration/seed/reset/import/publish işlemi yoktur.

## Onay sonrası operatör komutu

Proje kökünde **yalnız ayrı gerçek backup onayından sonra**:

```powershell
.\infra\migration16-backup.ps1 -Action backup -Phase before
```

Bu görevde komut production hedefiyle çalıştırılmadı. Wrapper aşağıdakileri yerel terminalde ister:

1. Render external hostname ve database name; port5432 sabittir.
2. Exact `BACKUP <hostname>/<database> before` teyidi. Bu teyit yalnız backup içindir, migration yetkisi vermez.
3. External database URL, `Read-Host -AsSecureString` ile gizli giriş. URI/parolayı komut argümanına, env dosyasına, Git'e veya sohbete koymayın.

Şartlar: Windows PowerShell5.1/7, Node/Prisma bağımlılıkları, çalışan Docker Linux engine, **önceden edinilmiş onaylı `postgres:16-alpine` image**, yeterli yerel disk/Docker RAM ve tüm uygulama tablolarını okuyabilen DB rolü. `--pull=never` kullanılır; araç otomatik image indirme veya yeni major sürüme geçiş yapmaz. pg_dump ve pg_restore major16 doğrulanır; client ve restore aynı immutable local imageId ile başlatılır ve restore server_version_num ayrıca16 olmalıdır. Image yoksa işlem durur; image temini ayrı operatör hazırlığıdır.

Çıktıda yalnız güncel denemenin `status=PASS`, `verified=true`, `backupReceiptStatus=VERIFIED` sonucu başarıdır. `operationId` klasör kimliğidir:

```text
C:\projects\KadroRadar\.local\migration16-backups\<operationId>\
  attempt.json          başlangıç kaydı; tek başına başarı değildir
  database.dump         PG16 custom-format tam uygulama yedeği
  receipt.json          yalnız tüm kontrollerden sonra yayımlanan makbuz
```

Hatalı denemede `failure.json` ve/veya `source.partial` bulunabilir; `receipt.pending.json` başarı belgesi değildir. Her deneme ayrı UUID klasöründe; mevcut dolu klasör reddedilir, eski yedek/dump/makbuz değiştirilmez. Global “latest verified” pointer'ı yoktur: önceki makbuz yeni başarısız denemeyi başarılı gösteremez.

Yerel dosya kontrolü, **ağa veya veritabanına bağlanmadan**:

```powershell
$backupRunId = Read-Host 'PASS sonucundaki operationId'
.\infra\migration16-backup.ps1 -Action verify -OperationId $backupRunId
```

Bu mod SHA-256, boyut, operationId, makbuz/manifest/schema ilişkisi ve failure marker'ını kontrol eder. `restoreRerun=false`: daha önceki restore kanıtını okur, yeni restore yapmış gibi davranmaz. `freshForMigration` ancak yaşı0–24 saat aralığındaysa true olur. Eski yedeğin dosya bütünlüğü hâlâ verified olabilir; bu yeni migration için güncel olduğu anlamına gelmez. Hedef fingerprint, phase ve tarih ayrıca operatör tarafından gözden geçirilmelidir. Makbuz dijital imzalı bir üçüncü taraf sertifikası değildir; host ve yerel operatör güvenilir olmalıdır.

## Tutarlı dump → ayrı restore zinciri

1. Explicit tek Prisma bağlantısı/probe; mevcut exact Render hostname/database/port ve strict TLS kapıları. Beklenen PostgreSQL16/public/8611 ve aktif SYSTEM_ADMIN kontrolü. Phase before için tam15 + yalnız bilinen16 pending; after için tam16. İsim/checksum/unfinished/unknown farkı durdurur.
2. Kaynakta `REPEATABLE READ READ ONLY` transaction açılır. UTC/ISO/interval/float gösterimi sabitlenir. Pinned schema karşılaştırılır;8611 ve aktif SYSTEM_ADMIN şartı bu snapshot içinde tekrar aranır. Tüm beklenen tablolarda SELECT/USAGE gerekir. RLS veya beklenmeyen yapı sessizce atlanmaz.
3. **Tüm uygulama tabloları ve `_prisma_migrations`** için sayım ve deterministik sıralı tam JSON satırlarının SHA-256 aggregate hash'i alınır. Kullanıcı satırları/parola hash'leri terminale çıkarılmaz.
4. Aynı transaction `pg_export_snapshot()` üretir. PG16 pg_dump custom-format `--snapshot` ile **aynı MVCC görünümünü** kullanır; kaynakta DML/DDL çalıştırılmaz. Böylece sayım/hash ile dump farklı anların verisini karıştırmaz.
5. Dump, client container tmpfs'inden Node'un `wx` ile açtığı özel dosyaya binary stream ile aktarılır. Bellekte komple dump/terminal stdout yoktur. fsync, PGDMP imzası, pg_restore list ve SHA-256 kontrolü; ardından aynı klasörde `database.dump` adı.
6. Ayrı PostgreSQL16 restore konteyneri oluşturulur: network none, yayınlanmış port yok, data/tmp/socket tmpfs, read-only root filesystem, rastgele geçici DB parolası. Production parola/URL konteyner konfigürasyonuna yazılmaz. Dump stdin stream ile yalnız tmpfs'e alınır.
7. `pg_restore --exit-on-error --no-owner --no-acl`; schema fingerprint, bütün tablo count/hash'leri ve migration isim/checksum/durumları kaynakla eşit olmalıdır.
8. Kaynak yeni bir read-only snapshot ile tekrar okunur. Restore süresince application/session/rate-limit/audit verisi veya şema değişmişse **NOT_VERIFIED**; sessizce güncelmiş kabul edilmez. Bu muhafazakâr davranış nedeniyle sakin bakım penceresi gerekir: login, profil/favori değişikliği, admin içerik/import işlemleri dururken çalıştırın. Araç production politikasını veya bakım modunu kendisi değiştirmez.
9. Host dump SHA tekrar kontrol edilir; kaynak client bağlantısı kapatılır, yalnız bu denemede oluşturulmuş client/restore konteynerleri kaldırılır. Cleanup veya disconnect hatasında da VERIFIED verilmez.
10. fsync edilmiş pending makbuz aynı klasörde atomik rename ile `receipt.json` olur. Makbuz16/15 sayısı, phase, hedef fingerprint/private host-db-port metadata, manifest/schema SHA, dump SHA/boyut, tüm tablo count/hash'leri ve restore/source-recheck kanıtını içerir. DB kullanıcı adı, parola veya connection URL içermez.

İlk testlerde özel Windows ACL dizinine `docker cp` aktarımı hata verdi. İki yönlü aktarım özel file handle üzerinden stream'e çevrildi; izinler gevşetilmedi ve bu yol gerçek restore ile doğrulandı. Source dump/restore komutları bounded180s, kaynak snapshot transaction600s, kaynak recheck180s, statement120s ve lock10s sınırları kullanır. Hazır olma poll'u yalnız yeni restore konteyneri içindir; production bağlantısı/dump otomatik retry edilmez.

## TLS, credential ve şema güvenliği

Prisma kaynak bağlantısı sslmode=require/sslaccept=strict; libpq/pg_dump **PGSSLMODE=verify-full** ve image içindeki CA bundle ile hostname/sertifika doğrular. URI'deki SSL gevşetme seçeneği veya farklı host yönlendirmesi kullanılmaz. Password yalnız hidden terminal girişiyle desteklenen wrapper akışından alınır; URL yalnız child Node process environment'ında tutulur, işlem bitince eski environment geri yüklenir; BSTR sıfırlanır ve SecureString dispose edilir.

Production parolası Docker `-e PGPASSWORD=...`/argv veya bir credential dosyası olarak verilmez. POSIX güvenli quote uygulanmış shell stdin'inden sadece pg_dump child process environment'ına geçer. Shell xtrace/echo yok; stderr sadece bellekte sabit hata sınıfına çevrilir. Source credentials Docker container config'e/log'a veya yedek makbuzuna yazılmaz. Bellekte secret bulunması kaçınılmazdır; bu nedenle yerel host/Docker operatörü güvenilir olmalıdır.

Normal operator modunda localhost/test fallback veya `--isolated` CLI seçeneği yoktur. Test library girişi yalnız loopback+`kadroradar_ingestion_test_` DB+fixture container ve eşleşen port ile çalışır; host/hostaddr query override reddedilir. İzole fixture'daki normal loopback PostgreSQL bağlantıları production TLS yolu değildir; production verify-full seçeneğinin TLS'siz fixture'ı reddettiği ayrıca gerçek libpq ile test edildi.

Şema sözleşmesi yalnız pinned15 ve16 migration SQL'lerinin boş izole PG16'ya uygulanmasından türetilir. Production'daki şemayı otomatik “öğrenme/kabul etme” yoktur. İlişki ad/tür/persistence/RLS, column type/default/nullability/identity, FK/PK/unique/CHECK ve indeks tanımları, public policy/routine/type/trigger sayıları, user schema ve large object durumu kapsanır. Ek tablo/kolon/view/sequence/RLS veya beklenmeyen public nesne drift'i durdurur. Meşru bir extension/özelleştirme de engel çıkarabilir; gerçek Render profili bu yeni guard ile henüz test edilmedi. Çözüm guard'ı kapatmak veya canlı şemadan sözleşme üretmek değil, farkı ayrı inceleyip sürümlü bir profile bağlamaktır.

Dump tüm application tablolarını alır; veriyi filtreleyen `--enable-row-security` veya tablo seçimi yoktur. `--no-owner --no-acl`, cluster rollerini/production owner/GRANT kurulumunu yeniden oluşturmaz. Kapsam app User/SYSTEM_ADMIN, sessions ve bütün DB application verisi/schema'sıdır; Render cluster/global role veya managed servis konfigürasyonu yedeği değildir. Restore izolasyonundaki owner farklılığı bilinçlidir; schema karşılaştırması owner/ACL adlarını değil application yapısını kontrol eder. Gerçek felaket kurtarmada owner/GRANT/sağlayıcı kurulum planı ayrıca gerekir.

## 15 ve 16 kapsamı

| Phase | Migration | Snapshot tabloları | İzole veri kanıtı |
| --- | --- | --- | --- |
| before |15 uygulanmış;16 pending |19: tüm eski application tabloları + `_prisma_migrations` |8611 sentetik historical; USER/SYSTEM_ADMIN, session ve audit dahil bağımsız restore |
| after |16 uygulanmış |23: eski19 + AccountChallenge, AccountEmailVerification, AccountRecoveryRate, AccountRecoveryAudit |8611 historical +8611 ImportRow,2 User,1 session, profile/audit ve dört recovery tablosunda sentetik kayıtlar |

İsimlerin tam listesi contract JSON'dadır. HistoricalPlacement, SourceDocument, PlacementRound, staging/import, User/CandidateProfile/CandidateSession, ReviewAudit/AnnouncementReviewAudit, favori/bildirim/source state ve migration kayıtları count/hash zincirindedir. Phase before ile16'lı, phase after ile15'li kaynak açıkça reddedilir. Hatalı checksum veya eski makbuzla schema doğrulaması atlanamaz.

## Test sonuçları ve dürüst sınırlar

`node infra/test-migration16-backup.cjs`:23 kontrol; gerçek PG16 custom dump ve ayrı offline restore kullanır. Kaynak tamamen sentetiktir, gerçek ÖSYM belgeleri/production kullanıcıları kopyalanmadı. `--record-contract --contract-only` yalnız geliştirme sırasında izole SQL sözleşmesini üretmek için kullanıldı; normal test/operatör çalışması sözleşmeyi değiştirmez ve contract-only çıktısı `backupTested=false` olarak ayrılır.

-15→19 tablo ve16→23 tablo için gerçek restore/schema/count/SHA zinciri PASS.
- Yanlış phase/metadata hedefi, eski klasörü yeniden kullanma, checksum ve beklenmeyen schema drift fail-closed.
- Dump aşaması hatası, bozuk magic, gerçek pg_restore non-zero exit (çakışan restore tablosu), aynı sayıda fakat değiştirilmiş User içeriği, kaynak audit değişimi, cleanup ve receipt hatalarında final VERIFIED makbuzu yok.
- Başarısız yeni denemelerin önceki başarılı dump/makbuz baytlarını değiştirmediği; makbuzun farklı bir operationId için kullanılamadığı test edildi.
- Offline değiştirilmiş kopya reddi ve25 saatlik yedeğin `freshForMigration=false` sonucu PASS.
- Parolada apostrof/boşluk/backslash/özel karakterlerle gerçek dump PASS; üretim verify-full akışı TLS'siz PG16'yı reddeder, fallback yok.
- Windows PowerShell5.1 ve7: hidden input, yanlış Render hedefinde erken ret, tüm geçici env alanlarının eski haline dönmesi ve secret'ın stdout'a çıkmaması PASS.

Cleanup negatif testi hata sinyalini gerçek container removal sonrasında simüle eder; test konteyneri sızdırılmaz, yine de başarı verilmez. `cleanupRequired=true` gerçek operasyonda Docker geri gelince attempt.json'daki exact iki ismin incelenmesini gerektirir; rastgele/prefix bazlı container silinmez. Birincil hata yanında cleanup sayısı da korunur.

Yeni test CI'ye eklendi; remote CI çalıştırılmadı. Ayrıca mevcut migration16 bağlantı/preflight regresyonu28 kontrol PASS. Release manifest PASS:136 candidate dosyası,23 ayrı korunan operatör dosyası,195 göreli import,0 kapsam dışı değişiklik. Secret scan PASS:857 nesne/dosya,0 bulgu (heuristic tarama manuel inceleme yerine geçmez).23 korunan operatör dosyasının içeriği ve eski migration SQL'leri değiştirilmedi. Yerel source fixture/test restore'larının DDL/DML'si yalnız disposable ortamda gerçekleşti. Production bağlantısı/backup/migration, gerçek admin değişikliği, GitHub push/Render/EAS işlemi yoktur.

## Saklama, kopyalama ve güvenli temizlik

`.local` Git dışındadır; Windows yeni run klasöründe owner+SYSTEM+Administrators private DACL uygulanır ve doğrulanır. POSIX test dizinleri700/dosyalar600. PostgreSQL client/restore rootfs read-only; sensitive container dosyaları tmpfs'te ve restore ağı kapalıdır. Başarılı/başarısız host artefaktları otomatik silinmez. Eski yedekler ve doğrulanmış makbuzlar üzerine yazılmaz.

Dump **şifreli değildir**: parola hash'leri, oturum özetleri, e-posta/profil ve private staging/audit verileri içerir. Git/PR/sohbet/e-posta/otomatik bulut sync'e koymayın. İşletmecinin onaylı şifreli diski/backup ortamında saklayın; encryption anahtarını ayrı yönetin. `database.dump` ile `receipt.json` birlikte korunmalı; farklı ortama kopyalandığında decrypted dump SHA-256'sı makbuzla tekrar eşleşmelidir. Yalnızca yeni ve ayrı restore-verified şifreli kopya, rollback penceresi ve işletmeci retention/onayı varsa eski local kopya silinebilir. Güvenli silme garantisi SSD/snapshot/yedek katmanlarında verilmez; volume encryption ve retention politikası gerekir.

Yalnız operatörün ayrıca onayladığı **tek run klasörü** için aşağıdaki düz dosya temizliği kullanılabilir; bu görev çalıştırmadı. İçerik farklıysa veya bir junction/dizin varsa durur. Recursive/global delete veya başka proje Docker/Node süreçlerini kapatma yoktur:

```powershell
$backupRoot = [IO.Path]::GetFullPath('C:\projects\KadroRadar\.local\migration16-backups')
$backupRunId = Read-Host 'Silinmesi ayrıca onaylanmış operationId'
if($backupRunId -notmatch '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'){throw 'Geçersiz kimlik'}
$backupDirectory = [IO.Path]::GetFullPath((Join-Path $backupRoot $backupRunId))
if([IO.Path]::GetDirectoryName($backupDirectory) -ne $backupRoot){throw 'Dizin sınırı'}
$ancestor = $backupDirectory
while($ancestor){
 if((Get-Item -LiteralPath $ancestor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Link/junction reddedildi'}
 $ancestor = [IO.Path]::GetDirectoryName($ancestor)
}
$backupFiles = @(Get-ChildItem -LiteralPath $backupDirectory -Force)
$allowedFiles = @('attempt.json','source.partial','database.dump','receipt.pending.json','receipt.json','failure.json')
if(@($backupFiles | Where-Object {$_.PSIsContainer -or ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $_.Name -notin $allowedFiles}).Count){throw 'Beklenmeyen içerik'}
if((Read-Host "Kesin teyit: DELETE $backupRunId") -ne "DELETE $backupRunId"){throw 'İptal'}
foreach($backupFile in $backupFiles){Remove-Item -LiteralPath $backupFile.FullName}
Remove-Item -LiteralPath $backupDirectory
```

Bu prosedür sunucuya dokunmaz; fakat yerel veri siler ve bu yüzden ayrı insan kararı gerektirir. Cleanup başarısızlığında önce Docker durumu/attempt isimleri doğrulanır; kullanıcı onayı olmadan genel `docker prune`, `.local` silme veya eski backup reset yapılmamalıdır.

## Operatör release sırası ve kalan GO kapıları

| Adım | GO | NO-GO |
| --- | --- | --- |
| Kod/manifest/araç incelemesi | Bu yerel kaynak/testler ve image16 onaylı | Kapsam dışı değişiklik/secret veya bilinmeyen image |
| Kaynak preflight | Kullanıcının bildirdiği15/8611/aktif admin1; işlem anında araç yeniden doğrular | Checksum/identity/permission/schema farkı |
| Gerçek before backup | Ayrı kullanıcı onayı; sakin pencere; hidden input ve exact teyit | Bu geliştirme görevinin otomatik production yetkisi sayılması |
| Gerçek restore makbuzu | Güncel operationId için VERIFIED,19 tablo ve tüm hash'ler eşit; offline verify/fresh true | Sentetik, pending, failure veya eski/mismatched makbuz |
| Saklama/rollback | Onaylı şifreli kopya ve retention/geri dönüş planı | Tek kırılgan yerel kopyaya güvenme |
| Migration16 | SQL ve hedef için ayrıca açık kullanıcı migration onayı | Bu backup komutunun migration başlatması; böyle özellik yok |
| Sonraki read-only after |16/8611/aktif admin, doğru release ve API sözleşmesi | Sayı/checksum/rol regresyonu |
| İstenirse after backup | Ayrı backup kararıyla `-Phase after`;23 tablo restore/hash eşit | Eski before yedeğini after yedeği gibi raporlama |
| Backend/Resend/Android | Ayrı push/CI/deploy/HTTPS/mail ve EAS onayları | Backup başarısından otomatik yayın veya kayıt/RSS açılışı |

Onaylı migration sonrası read-only kontrol `migration16-preflight.ps1 -Phase after`; ayrı after yedeği için aynı backup wrapper `-Phase after` kullanılır. Bu görev migration komutunu çalıştırmadı veya yazma yetkisi istemedi. Yeni makbuz formatı eski `.local/osym-production/backup-receipt.json` değildir; eski araçları açmak için elle o konuma kopyalamayın. Yeni araç yalnız backup/restore doğrulamasını15/16 uyumlu yapar;23 korunan operatörün import/admin yazma akışlarını sessizce değiştirmez.

Son durum: kaynak kodu ve izole testler hazır; **gerçek production backup ve dolayısıyla migration16 öncesi yeni gerçek VERIFIED kanıtı hâlâ bekliyor.**
