# KadroRadar — automation-only GitHub release hazırlığı

## Karar ve işlem sınırı

**Automation-only adayın yerel inceleme/commit planı için koşullu GO; mevcut kirli ağacın topluca release edilmesi ve production aktivasyonu için NO-GO.** Ayrı aday, mevcut production HEAD auth sözleşmesini korur. Commit, stage, branch değişimi, push, PR, merge, deploy veya production bağlantısı yapılmadı. Bir release commit SHA'sı henüz yoktur. Uzak GitHub CI çalıştırılmadı.

Kullanıcı kanıtı: R2 pilotu PASS; PUT200 → GET200 → DELETE204 → GET404; hash ve silme doğrulandı, cleanupOutstanding=false, productionDatabaseTouched=false. Bu sonuç burada yeniden çalıştırılmadı. Bucket'ın private/public erişim ayarları, IAM kapsamı ve lifecycle bu pilotla otomatik doğrulanmış değildir. `SOURCE_INGEST_HMAC_KEY` iki platforma eklendiği kullanıcı tarafından bildirildi; değerleri okunmadı, karşılaştırılmadı veya yeniden üretilmedi.

## Git durumu ve temel

- Aktif branch: `feature/announcements-core`.
- HEAD: `0b2b5d1d5a6010381910688b38a05911ff1566d9`.
- Yerel `main` ve yerel `origin/main`: `324b91c0a91186af202db3338743ccd40a680927`; ortak ata bu commit, HEAD22commit ileride. Fetch yapılmadığından gerçek uzak main'in güncel durumu ayrıca doğrulanmalıdır.
- Mevcut geniş manifest iki sprinti birlikte içeriyor; **automation-only staging listesi değildir**. Yeni özel kapsam: `docs/AUTOMATION_RELEASE_FILES.json`.
- Kullanıcının bütün önceki yerel değişiklikleri korundu.23operatör dosyasının yerel değişiklikleri ayrı tutuldu; bunlar seçilen yerel delta kapsamına dahil edilmedi.

## Auth uyumluluk riski ve çözümü

Yerel `CandidateAuth.candidate()` e-posta doğrulaması olmayan USER için profil/favori/uygunluk erişimini403 ile reddeder. Bu kontrol, registration/recovery kapalıyken de çalışır. Yeni `notifications.ts` de doğrulanmamış kullanıcıların bildirim planını dışlar. Bunları geniş release ile göndermek mevcut kullanıcıları kısıtlayabilir.

Çözüm güvenliği gevşetmek değildir: **yayımlanmış HEAD davranışını ayrı adayda aynen korumaktır**. Çalışma ağacındaki auth geliştirmeleri silinmedi veya tersine çevrilmedi.

- `candidate.ts`, `account-recovery.ts`, `notifications.ts`, mevcut auth testleri, web recovery HTML/CSS/JS ve mobil hesap/oturum/profil/favori ekranları HEAD blob içerikleriyle korunur.
- `environment.ts` karma dosyadır: yalnız üç source-automation doğrulaması HEAD üzerine eklenir. Yeni kayıt/mail zorunluluğu satırı bu release'e alınmaz. Registration/recovery zaten kapalı kalır.
- CI karma dosyadır: HEAD'in mevcut auth/recovery testleri korunur; sadece otomasyon/Python/R2/worker ve yeni uyumluluk testi eklenir. Henüz yayımlanmayacak auth senaryolarını zorlamak için test atlama veya güvenlik şartı kaldırma yapılmaz.
- Mobil tarafta yalnız bağımsız `lib/news.ts` ve `ui/news-slider.tsx` alınır; yeni duyuru veri sözleşmesi için gereklidir. Hesap/session koduna bağımlılıkları yoktur. Diğer mobil yerel değişiklikler ayrı tutulur.
- Yeni `test-automation-auth-compat.cjs`, normal mobil login/Bearer akışıyla **doğrulanmamış mevcut adayın** profil okuma/güncelleme, favori ekleme/silme ve logout işlemlerini test eder. Admin endpoint403, oturumsuz401, kayıt kapalı403 kontrolleri korunur. Gerçek kullanıcıya işlem yapılmadı.

## Hazırlanan kapalı aday

`infra/prepare-automation-release.cjs`, sabit HEAD'in `git archive` çıktısına açık manifest dosyalarını uygular; gerçek Git indexine veya dallara dokunmaz. Windows archive CRLF dönüşümü için korunan auth/mobile/Prisma dosyaları exact Git blob byte'larıyla materyalize edilip hash karşılaştırılır. Gerçek XML/PDF, `.local`, env veya backup kopyalanmaz.

Test edilen kopya: `.local/automation-release/candidate-kzjuNZ`.

Kanıtlar: `.local/automation-release/latest.json`, `pg23-results.json`, `docker-final-build.log`; adayın `.local/` altındaki test/export çıktıları. Yerel testler mevcut frozen-lockfile bağımlılıklarını junction üzerinden yeniden kullandı; temiz pnpm kurulumu yapılmış gibi raporlanmıyor. Docker ise kendi izole API/admin bağımlılık kurulumunu frozen lockfile ile gerçekleştirdi.

`latest.json` içindeki dosya hash'leri ve explicit `stagingPaths` yalnız **bu hazırlanmış aday içeriği** içindir. Özellikle `environment.ts`, `ci.yml` ve geniş release manifesti mevcut kirli ağaçtan whole-file stage edilmemelidir.

### Release'e uygun kapsam

Tam dosya listesi makineyle okunabilir manifestte bulunur; yolların hiçbiri wildcard veya `git add .` içermez:

- API: imzalı `/source-ingest/{career|gazette}/claim|complete`, onay kapıları, worker, staging, source rights/revocation, tarih hassasiyeti, duplicate, yayın doğrulaması, RSS metadata kartları ve genel duyurular.
- Parser: Career RSS/detail worker, Gazette HTML-first/ephemeral PDF, taşıma güvenliği ve ortak tarih modülleri.
- GitHub/R2: manuel workflow, imzalı runner, küçük JSON receipt writer, tek nesne pilotu ve inactive lifecycle/worker örnekleri.
- Admin: ilan inceleme ve kaynak/duyuru görünümü; mevcut rol/CSRF oturumu korunur.
- Docker, kaynak testleri, eski auth ile uyumluluk testi, ilgili CI eklemeleri ve iki bağımsız mobil haber gösterim dosyası.
- Bu rapor, explicit automation manifesti ve snapshot hazırlama aracı.

### Release dışında tutulacak yerel değişiklikler

Tam dışarıda kalan dirty path listesi manifestte `excludedWorkingTreeChanges` altında yer alır.

- `apps/api/src/candidate.ts`, `account-recovery.ts`, `notifications.ts` yerel deltaları; yeni account-system testleri ve henüz dağıtılmayacak auth test güncellemeleri.
- Mobil `lib/account.ts`, `lib/auth-form.ts`, profile/saved/account-recovery/root layout değişiklikleri ve diğer yeni filtre/UX değişiklikleri.
- Web account-recovery HTML/CSS/JS yerel deltaları; registration/mail kuralını ekleyen environment hunk'ı.
-23korunan backup/admin/ÖSYM operatör dosyasının yerel deltaları; bu scope'a karıştırılmaz.
- `.local`, gerçek RSS XML/PDF, env, dump, receipt, credential/signing dosyaları ve özel ZIP'ler.

## Workflow ve konfigürasyon denetimi

- `.github/workflows/source-automation.yml`: yalnız `workflow_dispatch`; `environment: source-automation`; schedule/cron yok.
- Varsayılan branch gate'i nedeniyle feature branch'ten başlatılan run kaynak işini çalıştırmaz. Default branch `main` olduğundan manuel keşif için dosya main'de bulunmalıdır. [GitHub workflow_dispatch belgesi](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch).
- Onay gate'i Environment kullanılabilir olduktan sonra step içinde çalışır. `SOURCE_AUTOMATION_APPROVED=false` veya eksik/yanlış değer → `AUTOMATION_DISABLED_NO_IO`; checkout, kurulum, parser, ingest ve R2 adımları atlanır. Gerçek kapı komutu ve runner'ın sıfır-I/O davranışı yerelde test edildi; uzakta run başlatılmadı.
- Render ayrıca `SOURCE_REMOTE_INGEST_ENABLED=true` **ve** `SOURCE_AUTOMATION_APPROVED=true` ister. Legacy worker/scheduler/direct run da production onayı olmadan başlamaz.
- `SOURCE_RELEASE_SHA`, gelecekte CI'dan geçen ve Render'a **gerçekten dağıtılan** full40hex commit ile aynı olmalıdır. Merge/squash sonrasında eski feature SHA kullanılmaz; final merge commit üzerinde CI yeniden doğrulanır.
- Render `SOURCE_INGEST_ORIGIN=https://kadrooradar.com`; GitHub `SOURCE_INGEST_API_URL=https://kadrooradar.com/api/v1`. Aynı isimli `SOURCE_INGEST_HMAC_KEY` secret'ı iki tarafta bulunmalı; bu görev değere erişmez.
- `SOURCE_AUTOMATION_APPROVED`, `R2_SOURCE_RECEIPTS_ENABLED`, `SOURCE_REMOTE_INGEST_ENABLED`, `SOURCE_SYNC_ENABLED` **false** kalır. Registration/recovery ve kaynak policy'leri değiştirilmez. Bildirim/document upload da kapalı kalmalıdır.
- Career/Gazette registry `REVIEW_REQUIRED`, enabled=false; izin aktivasyonu yapılmadı. R2 bağlantısının çalışması kaynak erişim/yayın izni değildir.
- R2 yalnız whitelisted küçük JSON makbuzları destekler; PDF/XML/HTML kalıcı yüklemesi yoktur. PDF gerektiğinde bounded RAM/temp işleminden sonra silinir.

## Yerel test sonuçları

Sonuçlar aşağıdaki tamamlanan kontrol tablosunda kaydedilir; fixture testi canlı toplama veya gerçek e-posta teslimatı değildir.

| Kontrol | Sonuç |
| --- | --- |
| Automation-only API / admin build | PASS |
| Mobil TypeScript ve Android export | PASS; EAS/APK/device testi değil |
| Seçilmiş PG16 suite | 23/23 grup PASS; legacy unverified-user erişimi, auth/session/recovery, worker, source permission, staging/yayın, duplicate, historical dahil |
| Ek PG16 CI grupları | 11/11 PASS |
| Admin browser | PASS |
| Python |116test:111PASS +5gerçek özel fixture olmadığı için SKIP; sentetik CI bağımsız çalışır |
| HMAC/runner/workflow gate |50PASS |
| R2 fake transport / local CLI |248PASS; gerçek R2 sonucu kullanıcı kanıtı olarak ayrı kaydedildi |
| Locked Prisma tarball sözleşmesi |PASS; SHA/TLS/redirect korumaları değişmedi |
| Windows wrapper CI sözleşmesi |PowerShell5.1 ve7'de12'şer kontrol PASS; sentetik girişler, gerçek istek0 |
| Legacy worker storage / temel parser |8storage kontrolü ve5temel parser testi PASS; yalnız disposable volume/konteyner |
| Docker | PASS; gerçek build +13NestJS/Prisma/admin/health kontrolü, Python importları ve26Linux ephemeral parser kontrolü |

Test edilen son imaj: `kadroradar-api:automation-only`, `sha256:76f8e7372ee27b58be9b1fa9f38e38bb6f51b607a61a3d1e78e1843d98c96d20`. Build frozen-lockfile ile tamamlandı; `--no-cache` build olduğu iddia edilmiyor. SQL migration yalnız disposable PG16'ya test için uygulandı. Runtime testi boş DB/16migration, admin RBAC/secure-cookie, kapalı ingest, DB kesilince health503 ve dönünce200 davranışlarını doğruladı. Beklenen negatif provisioning testindeki `Admin creation failed` satırı suite hatası değildir.

Bütünlük/secret sonuçları:76seçilmiş yol ve155gerçek AST import referansı kapalı;397önceden var olan dosyanın içeriği korundu (yalnız genel manifest bu görev için güncellendi).23protected operator hash'i ve exact HEAD auth hash'leri eşleşiyor. Schema/lockfile/16migration değişmedi; migration16 LF-normalized SHA-256 `e706db2cb2241c09919c0a3c96abdc862227956b84c932b71bc2b36318a53ead`. Genel manifest216aday/23operatör/0kapsamsız değişiklik PASS. History+worktree secret scan1065nesne/dosya,0bulgu; hazırlanmış76dosyanın ayrıca doğrudan taraması0bulgu. Bunlar heuristic kontrollerdir. `git diff --check` PASS; index boş, yeni commit yok.

Python'un5skip durumu yalnız özel gerçek fixture'ların izole adaya kopyalanmamasından kaynaklanır. Gerçek belge/ilanlar Git'e veya CI'ye taşınmadı. Secret taraması yalnız ana ağacın değil, farklı türetilmiş CI/environment/manifest içeriklerinin de byte'larını kapsadı. `.local/automation-release/integrity.json` ve `prepared-secret-scan.json` sonuçları içerir.

İlk hazırlama/test denemelerindeki hatalar başarı olarak sayılmadı: archive CRLF hash farkı exact blob materyalizasyonuyla düzeltildi; yeni testte favori endpoint'i PUT olarak düzeltildi ve mobil bearer almak için gerçek `x-client-platform: mobile` başlığı eklendi. Mevcut auth sözleşmesi bu testlere uydurulmadı. Mobil haber veri sözleşmesinin iki bağımsız dosyası kapalı kümeye eklenince Career publication regresyonu geçti.

## Branch / PR / commit planı — henüz uygulanmadı

1. Kullanıcı bu explicit kapsamı onaylar. Önce uzak main/feature SHA ve Render Auto-Deploy Off durumu yeniden doğrulanır; secret değerleri okunmaz.
2. Aktif dirty feature checkout'a dokunmadan ayrı temiz release checkout/branch'i `codex/automation-only-release` adıyla, incelenmiş production baseline `0b2b5d1...` üzerinden hazırlanır. Test edilmiş snapshot'ın yalnız `stagingPaths` dosyaları hash eşleşmesiyle bu checkout'a uygulanır. Auth/mobile/migration baseline hash'leri tekrar doğrulanır.
3. Commit planı: tek atomik `release: prepare disabled source automation without auth rollout [skip render]`. Parser/shared/API/controller/Docker/CI/workflow/required tests birlikte tutulur; aralarında çalışmayan ara commit oluşturulmaz.23operatör değişikliği ve auth sprinti ayrı kalır.
4. Main'in gerçek hali yerel referans gibi eskiyse **önce ayrı baseline-synchronization PR'ı** değerlendirilir: sadece mevcut committed/deployed baseline'a kadar, dirty çalışma dosyaları olmadan. Bunun commit kapsamı ayrıca incelenir;22commit'in güvenli olduğu otomatik varsayılmaz. Kullanıcı onayı ve CI olmadan merge yapılmaz.
5. Baseline PR sonucu tree'nin onaylı baseline ile eşleştiği doğrulanır. Automation-only branch için ayrı PR → main açılır. Bütün feature branch'in kirli geliştirmeleri main'e taşınmaz; yeni auth kısıtlamaları PR diff'inde bulunmamalıdır.
6. CI6job PASS, review ve açık merge onayı gerekir. Final main merge/squash SHA için CI tekrar PASS; tree/auth/migration farkı yeniden kontrol edilir. Uzak main beklenenden farklıysa plan durur, rebase/uyarlama sonrası testler tekrarlanır.
7. Render manual deploy ayrı kullanıcı onayıyla aynı final SHA'ya yapılır; bütün otomasyon bayrakları false. Bu görev deploy yetkisi vermez ve migration gerektirmez.
8. Deploy sonrası salt okunur smoke: health/database ready, historical total8611, admin/auth/capabilities ve disabled ingest503, release SHA eşleşmesi. Bundan sonra GitHub `SOURCE_RELEASE_SHA` aynı SHA olarak operatörce ayarlanır. Bayraklar açılmaz.
9. Main'de ilk workflow_dispatch yalnız false gate smoke'u olarak ayrıca onaylanabilir; kaynak/ingest/R2 işi başlamamalıdır. Kaynak policy ve production ingest/yayın aktivasyonu için ayrı kanıt ve onay gerekir.

### Explicit staging — yalnız gelecek temiz release checkout'ta

Aşağıdaki komutlar **çalıştırılmadı**. Dirty checkout'ta çalıştırmak özellikle karma dosyalarda yanlış auth deltalarını stage edebilir. Önce snapshot'ın dosyaları temiz release checkout'a uygulanmış ve hash'leri doğrulanmış olmalıdır.

```powershell
$releaseScope = Get-Content docs/AUTOMATION_RELEASE_FILES.json -Raw | ConvertFrom-Json
if ((git branch --show-current).Trim() -ne 'codex/automation-only-release') {
    throw 'Yalnız onaylı temiz automation-only release branch üzerinde uygulanabilir.'
}
if ((git rev-parse HEAD).Trim() -ne $releaseScope.baseCommit) {
    throw 'Baseline değişti: kapsam ve testler yeniden incelenmeli.'
}
$explicitPaths = @($releaseScope.stagingPaths)
git add -- $explicitPaths
git diff --cached --check
git diff --cached --name-only
# Secret/manifest, auth baseline, migration ve test kontrolleri PASS olmadan commit yok.
```

Yeni commit SHA bilinmediğinden `SOURCE_RELEASE_SHA` için uydurma bir değer önerilmiyor. Push/CI/PR/merge/deploy komutları bu aşamada otomatik uygulanmaz.

## Kalan engeller

- Seçilmiş aday kapsamı için kullanıcı onayı; ardından temiz branch/commit ve gerçek GitHub CI.
- Main baseline/PR incelemesi ve final merge SHA üzerinde doğrulama.
- Bucket privacy/lifecycle/IAM kapsamının operatörce ayrıca doğrulanması.
- Kaynak izin ve kalite kapıları; gerçek production ingestion/publication için ayrı onay.
- Yeni auth sprinti için doğrulama rollout/staging kararı; otomasyon release'inden ayrı kalır.
- Android APK öncesi mevcut preview EAS URL'leri hâlâ HEAD'deki Render HTTPS adreslerini kullanır; custom domain'e geçiş ayrı mobil release kapsamındadır. SDK54/package/version1.0.1/code3 korunur; kapsamlı fiziksel cihaz testi yapılmadı.

8611production kaydı ve SYSTEM_ADMIN kullanıcı kanıtı olarak kabul edildi; bu görevde DB sorgulanmadı/değiştirilmedi. Production secret'ları, gerçek mail gönderimi, source aktivasyonu, migration veya mağaza işlemi yoktur.

## 11 Kasım 2026 — son iki engelin yeniden değerlendirilmesi

Bu bölüm önceki PREPARED_NOT_STAGED ve76 dosyalı durumun sonrasındaki kontrollü yerel release çalışmasını kaydeder. Ayrı worktree branch'i `codex/automation-only-release`; baseline `0b2b5d1d5a6010381910688b38a05911ff1566d9`. Push/PR/merge/deploy yapılmadı.

Admin browser'ın önceki exit1 hatası yeniden üretilemedi; kesin ilk kök neden hâlâ bilinmiyor. Kullanıcının izin verdiği alternatif uygulandı: güvenli gözlemlenebilirlik ve aynı toplu test sırası. Browser testi artık sabit aşama, geçen süre, PID/parentPID/yalnız kendi Vite child PID'si, child exit/signal, allowlist stderr sınıfı ve stack'in yalnız dosya/satır/sütun bilgilerini verir. Ham stderr, error.message, HTTP body, cookie, token, parola ve ekran/body dökümleri yazdırılmaz. RBAC/CSRF/rate-limit/lisans kontrolleri ve timeout'lar değiştirilmedi. Önceki catch içindeki ekran/body dosyası yazımının asıl hatayı gölgeleme ihtimali kaldırıldı; bunun ilk olayın nedeni olduğu kanıtlanmış değildir.

Bu tanılama `apps/api/test-admin-browser.cjs` dosyasının explicit manifestte77. yol olarak eklenmesini gerektirdi. Eski snapshot'ın73 yolu exact byte olarak aynı; yalnız üç mevcut belge/manifest ve yeni browser testi bu görev kapsamında incelenerek değişti. environment.ts ve ci.yml test edilmiş snapshot ile aynıdır. Auth/mobile/session/profil/favori kaynakları baseline'da kalır.

68 unstaged stat işareti için her dosyanın raw byte SHA'sı index blob'u ile karşılaştırıldı ve eşit bulundu. Önce özel index kopyasında, sonra yalnız release index'inde `git -c core.autocrlf=false update-index --refresh -- <68 explicit paths>` kullanıldı. Staged tree hash'i değişmedi. core.autocrlf ayarı/global config değiştirilmedi; reset/clean/stash veya manifest dışı stage yapılmadı. Orijinal dirty checkout'a müdahale edilmedi.

Son toplu PG16 sıra24/24 PASS; browser aynı sırada, legacy unverified-user profil/favori sözleşmesi dahil. Ek PG grupları11/11 PASS. API/admin build, mobil TypeScript, Android export, Python111PASS+5özel fixture SKIP ve5temel parser, runner50, R2fake248, locked Prisma, Docker build ve13runtime+26ephemeral+8storage PASS. Fixture testleri canlı başarı değildir.

İlk tanılama runner'ına eklenen explicit SOURCE_AUTOMATION_APPROVED=false, lisanslı in-memory fixture'ların üç pozitif testini engelledi; bu kodda fail-closed davranışının çalıştığını gösterdi. Yerel fixture runner'ı önceki non-production unset onay sözleşmesine döndürülünce aynı24grup geçti. Production bayrağı, registry dosyası veya izinler değiştirilmedi. Kapalı production gate ayrıca runner/image testlerinde doğrulandı.

Yerel commit kararı, bundan sonra uygulanacak staged kapsam/hash/secret kontrollerinin PASS olmasına bağlıdır. SOURCE_AUTOMATION_APPROVED, SOURCE_REMOTE_INGEST_ENABLED, SOURCE_SYNC_ENABLED ve R2_SOURCE_RECEIPTS_ENABLED production için false kalır. Main baseline synchronization22commit ve ayrı automation PR sırası aynen geçerlidir; gerçek GitHub CI/push ve merge için sonraki kullanıcı onayı gerekir.
