# Migration 16 kontrollü Git release commit handoff

Bu raporu içeren tek release commit'inin tam SHA'sı:

```powershell
git log -1 --format=%H -- docs/RELEASE_M16_GIT_COMMIT_HANDOFF.md
```

SHA, commit tamamlanınca terminal tesliminde ve Git dışındaki `.local/release-m16-commit/commit-receipt.json` dosyasında da kaydedilir. Bir commit kendi SHA'sını içeren metni aynı commit içinde sabitleyemez; burada başka bir commit'in SHA'sı release SHA'sı diye gösterilmez.

Branch: `feature/announcements-core`. Parent release: `4e5b86c5de22210eef254b682df6890ba96c4bca`. Commit kapsamı yalnız `docs/RELEASE_CANDIDATE_FILES.json` içindeki `coreCodeAndTests` ve `documentationAndInactiveTemplates` gruplarının değişen dosyalarıdır. Manifestte zaten HEAD ile aynı olan dosyalar yeniden değişmiş gibi sayılmaz. Commit mesajı: `release: prepare migration 16 recovery and Gazette backend [skip render]`.

## Kapsam ve hariç tutulanlar

Auth recovery/Resend, SecureStore ve mobil oturum, web recovery, schema/migration16, Gazette downloader/staging, Docker/CI, bunların testleri ve raporları tek atomik release kapsamındadır. Onaylı dosyalar yalnız açık path listesiyle stage edilir; `git add .` / `git add -A` kullanılmaz. Gerekli relative import, Docker COPY ve CI test dosyaları kontrol edilir.

Korunan 23 operatör dosyası baseline hash'leriyle eşittir ve staged değildir. Bunlar silinmez, sıfırlanmaz veya core commit'e katılmaz. `.local`, gerçek PDF/RSS XML, database.dump, receipt.json, credential/env, özel ZIP, imzalama anahtarları ve gerçek kullanıcı verisi hariç tutulur. Tam commit dosyaları için:

```powershell
$release = git log -1 --format=%H -- docs/RELEASE_M16_GIT_COMMIT_HANDOFF.md
git show --format=fuller --stat $release
git diff-tree --no-commit-id --name-only -r $release
git status --short
```

## Migration ve güvenlik

Production migration16 uygulaması ve AFTER PASS kullanıcı tarafından bildirildi: applied16, historical8611, activeSYSTEM_ADMIN1. Bu görev production DB'ye bağlanmaz. Onaylı SQL adı `20261031000100_account_recovery`, normalized-LF SHA-256 `e706db2cb2241c09919c0a3c96abdc862227956b84c932b71bc2b36318a53ead`. Stage edilmiş SQL blob'u ayrıca aynı SHA ile doğrulanır; eski15 migration değiştirilmez.

Bu tur migration komutu çalıştırılmaz. DB gerektiren testler yalnız daha önce oluşturulmuş sentetik 16-migration dump'ını yeni, rastgele isimli disposable PostgreSQL16'ya restore eder. Auth testlerinin oluşturduğu kullanıcılar/bayrak değişiklikleri yalnız bu izole fixture'a aittir; gerçek hesap oluşturulmaz, production kayıt/recovery politikası değişmez. Production backup/receipt veya bağlantı bilgileri kullanılmaz. Docker runtime smoke testinin migration/provisioning dalı bu tur çağrılmaz; fixture restore edilerek gerçek image başlangıcı ve kapalı özellikler test edilir.

Staged güvenlik incelemesi: manifest allowlist, korunan dosya disjoint kontrolü, private artifact path reddi, index/worktree normalize içerik eşitliği, `git diff --cached --check`, staged blob'ları da tarayan secret scan. Sezgisel tarama tek başına gizli bilgi yokluğunu matematiksel olarak kanıtlamaz; staged kaynak/config değişiklikleri ayrıca incelenir. Docker image daha önceki m16 release build'iyle aynı uygulama girdilerini kullanmalı; image ile commit arasındaki app/Docker/lockfile dosya hash'leri karşılaştırılır.

## Test sonuçları

Bu tur aşağıdaki kontroller yeniden çalıştırıldı. Yeni remote GitHub CI, push yapılmadığı için henüz yoktur.

<!-- TEST_RESULTS -->

| Kontrol | Bu tur sonuç |
| --- | --- |
| API / admin build, mobil TypeScript | PASS |
| Prisma validate / generate | PASS; çalışan API DLL kilidine dokunmamak için aynı schema ayrı özel output dizininde; DB bağlantısı yok |
| Restore edilmiş PG16 auth/admin/kaynak/historical/recovery grupları | 18/18 PASS |
| Restore + eski8611 hash + gerçek Linux runtime + outage | İzole runner toplam22/22 PASS; migration komutu0 |
| Resend adapter / web recovery browser | 18 / 11 kontrol PASS; gerçek e-posta yok |
| SecureStore session / native config | 23 kontrol PASS / PASS; fiziksel Android testi yok |
| Docker build | PASS; cache kullanıldı, temiz --no-cache build diye sunulmaz |
| Docker/staged içerik eşitliği | 22 backend/web/Python dosyasının normalize SHA-256 değeri eşit |
| Docker Python RSS/Gazette imports | PASS; network=none, özel XML image dışında |
| Locked Prisma, EAS preview config | PASS; APK/EAS build yok |
| Python Gazette downloader / Career RSS | 12 / 8 offline test PASS |
| Safe DB errors / mobil UI | PASS / 10 kontrol PASS |
| Staged diff --check / manifest / secrets | PASS / 142 aday,201 relative import /0 bulgu |
| Korunan operatör ve migration SQL | 23/23 hash aynı, staged0; migration16 staged SHA tam eşleşiyor |

Docker image kimliği: `sha256:71e386eda3812ccbea862298a8380a5323b526a746b3e6ac59ff8c26f62921ec`; bu bir Git SHA veya Render deployment değildir.

İlk özel toplu runner, admin browser testinin bilerek eklediği bir sentetik historical satırını toplamdan ayırmadığı için son assertion’da durdu. Uygulama testleri atlanmadı: fixture kontrolü her testte beklenen delta ve eski8611 satırın hash eşitliğini denetleyecek şekilde düzeltildi, zincirin tamamı yeniden PASS oldu. Bu düzeltme yalnız Git dışındaki test düzenindedir; production kaydı eklenmedi.



## GitHub push ve Render kararı

Tüm yerel testler ve staged kontroller PASS olduğunda GitHub push için **GO: ayrı kullanıcı onayı beklenir**. Push bu görevin kapsamı dışındadır. Render manual deployment için **NO-GO**: yeni SHA GitHub'da bulunmalı, o SHA'nın bütün CI işleri geçmeli, auto-deploy ayarı kontrol edilmeli ve ayrı deployment onayı alınmalı. `[skip render]` mesajı ek korumadır; Dashboard/auto-deploy durumunun yerini tutmaz.

Render'da mevcut Web Service, HTTPS API, PORT, database URL, proxy ve source izinleri korunmalı. `ACCOUNT_RECOVERY_ENABLED=false`, `ALLOW_SELF_REGISTRATION=false`, `SOURCE_SYNC_ENABLED=false`, `NOTIFICATIONS_ENABLED=false`, `DOCUMENT_UPLOADS_ENABLED=false`, `PROCESS_ROLE=api` kalmalı. Startup migrate/seed/import çalıştırmaz. Production migration16 zaten uygulanmış olduğundan yeniden migration planlanmaz. `kadrooradar.com` domain/TLS bağlantısı ve Resend gönderici doğrulaması önceki raporda henüz doğrulanmamıştır; bu görev bunları değiştirmez veya e-posta göndermez. Recovery aktivasyonu ayrı karar bekler.

## Push onayı ve CI sonrası operatör komutları

Önce mevcut commit'i ve remote adresini operatör kendi terminalinde incelemeli; CI için GitHub hesabı parolası/token'ı sohbete yazılmamalı. Aşağıdaki push komutu bu görevde çalıştırılmaz:

```powershell
$release = git log -1 --format=%H -- docs/RELEASE_M16_GIT_COMMIT_HANDOFF.md
git rev-parse HEAD
git status --short
# Yalnız ayrı push onayından ve auto-deploy kontrolünden sonra:
git push origin feature/announcements-core
git ls-remote origin refs/heads/feature/announcements-core
# GitHub CLI mevcut ve operatör oturumu açıksa:
gh run list --branch feature/announcements-core --commit $release --limit 10
# Yukarıdaki listeden gerçek CI run ID'sini kullan:
gh run view <RUN_ID> --exit-status
```

Remote branch SHA ve CI head SHA `$release` ile eşleşmeli. Başarısız CI varsa Render deploy yapılmamalı. CI PASS ve ayrı manual deploy onayından sonra Render release SHA eşleştirilmeli. Deployment sonrasında yalnız GET doğrulaması:

```powershell
$api = 'https://kadroradar.onrender.com/api/v1'
Invoke-RestMethod "$api/health"
(Invoke-RestMethod "$api/historical/placements?limit=1").total
Invoke-RestMethod "$api/account/capabilities"
(Invoke-RestMethod "$api/announcements?view=open").total
(Invoke-WebRequest -UseBasicParsing 'https://kadroradar.onrender.com/account-recovery').StatusCode
(Invoke-WebRequest -UseBasicParsing 'https://kadroradar.onrender.com/privacy').StatusCode
(Invoke-WebRequest -UseBasicParsing 'https://kadroradar.onrender.com/delete-account').StatusCode
```

Beklenen: health200 ready, historical8611, capabilities selfRegistration/emailVerification/passwordReset=false, mevcut ilan toplamı bu handoff'ta0, web sayfaları200. Domain hazır olduğunda aynı recovery/assets/header kontrolü `https://kadrooradar.com/account-recovery` için de yapılmalı. Fiziksel Android, EAS build ve Play Console bu görevin dışında kalır.

## Commit dosya listesi ve kalan yerel dosyalar

Commit **69 dosya** içerir; manifest142 path içerir, bunların HEAD ile aynı olanları commit değişikliği sayılmaz. Commit sonrası yalnız aşağıdaki23 korunan operatör dosyasının mevcut yerel değişiklikleri/untracked halleri kalmalıdır.

### Commit kapsamı

- `.github/workflows/ci.yml`
- `Dockerfile.api`
- `apps/api/prisma/migrations/20261031000100_account_recovery/migration.sql`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/account-mail.ts`
- `apps/api/src/account-recovery.ts`
- `apps/api/src/candidate.ts`
- `apps/api/src/environment.ts`
- `apps/api/src/gazette-staging.ts`
- `apps/api/src/main.ts`
- `apps/api/src/source-adapter-contract.ts`
- `apps/api/src/source-operations.ts`
- `apps/api/test-account-mail.cjs`
- `apps/api/test-account-recovery.cjs`
- `apps/api/test-auth-readiness.cjs`
- `apps/api/test-auth-recovery-draft.cjs`
- `apps/api/test-gazette-downloader.cjs`
- `apps/api/test-mobile-network.cjs`
- `apps/api/test-recovery-browser.cjs`
- `apps/mobile/app.json`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/app/about.tsx`
- `apps/mobile/app/account-recovery.tsx`
- `apps/mobile/app/announcement/[id].tsx`
- `apps/mobile/app/matches.tsx`
- `apps/mobile/app/notifications.tsx`
- `apps/mobile/app/profile.tsx`
- `apps/mobile/app/saved.tsx`
- `apps/mobile/lib/account.ts`
- `apps/mobile/lib/use-session.ts`
- `apps/mobile/package.json`
- `docs/ACCOUNT_RECOVERY_AND_GAZETTE_PRODUCTION_READINESS.md`
- `docs/AUTH_AND_GAZETTE_RELEASE_READINESS.md`
- `docs/AUTH_GAZETTE_FINAL_IMPLEMENTATION.md`
- `docs/MIGRATION16_POST_RELEASE_HANDOFF.md`
- `docs/MIGRATION16_PREFLIGHT_CONNECTION_DIAGNOSIS.md`
- `docs/MIGRATION16_PRODUCTION_BACKUP_AND_RELEASE.md`
- `docs/MIGRATION16_PRODUCTION_EXECUTION.md`
- `docs/MIGRATION16_RESEND_RELEASE_PREFLIGHT.md`
- `docs/RELEASE_CANDIDATE_FILES.json`
- `docs/RELEASE_M16_GIT_COMMIT_HANDOFF.md`
- `infra/account-recovery.sql.example`
- `infra/migration16-backup-contract.json`
- `infra/migration16-backup.cjs`
- `infra/migration16-backup.ps1`
- `infra/migration16-deploy.cjs`
- `infra/migration16-deploy.ps1`
- `infra/migration16-diagnostics.cjs`
- `infra/migration16-manifest.json`
- `infra/migration16-preflight.cjs`
- `infra/migration16-preflight.ps1`
- `infra/mobile-account-test-loader.cjs`
- `infra/test-migration16-backup.cjs`
- `infra/test-migration16-connection.cjs`
- `infra/test-migration16-deploy.cjs`
- `infra/test-migration16-restore.cjs`
- `infra/test-mobile-session.cjs`
- `infra/test-official-sources-isolated.cjs`
- `infra/test-render-readiness.cjs`
- `infra/test-rss-runtime.cjs`
- `infra/test-secure-store-config.cjs`
- `pnpm-lock.yaml`
- `services/ingest/fixtures/make_gazette_download_report.py`
- `services/ingest/gazette_download.py`
- `services/ingest/test_gazette_download.py`
- `web/account-recovery.css`
- `web/account-recovery.html`
- `web/account-recovery.js`
- `web/privacy.html`

### Stage edilmeyen ve korunan23 dosya

- `docs/ADMIN_STATUS_DIAGNOSIS.md`
- `docs/DIAGNOSE_BACKUP_VALIDATION.md`
- `docs/PILOT_BACKUP_DIAGNOSIS.md`
- `docs/PRISMA_CONNECTION_DIAGNOSIS.md`
- `docs/PRODUCTION_ADMIN_RECOVERY.md`
- `docs/PRODUCTION_BACKUP_DIAGNOSIS.md`
- `docs/PRODUCTION_RELEASE_CHECKLIST.md`
- `docs/RENDER_OSYM_DATA_IMPORT.md`
- `infra/admin-account.cjs`
- `infra/admin-account.ps1`
- `infra/local-api-schema.cjs`
- `infra/osym-production.cjs`
- `infra/osym-production.ps1`
- `infra/pg-dump-diagnostics.cjs`
- `infra/prisma-connection-diagnostics.cjs`
- `infra/test-admin-account-wrapper.ps1`
- `infra/test-admin-account.cjs`
- `infra/test-admin-status.cjs`
- `infra/test-diagnose-backup.cjs`
- `infra/test-osym-backup.cjs`
- `infra/test-osym-production.cjs`
- `infra/test-pilot-backup.cjs`
- `infra/test-prisma-connection.cjs`
