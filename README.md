# KadroRadar

Bağımsız kamu ilanı ve ÖSYM geçmiş yerleştirme uygulaması. NestJS/Prisma/PostgreSQL API, React admin ve Expo SDK54 mobil uygulama içerir. Kamu kurumlarının resmî uygulaması değildir.

## Release belgeleri

- [Render kurulumu](docs/RENDER_DEPLOYMENT_SETUP.md)
- [Release teslimi ve testler](docs/RENDER_RELEASE_HANDOFF.md)
- [RC1 raporu](docs/RC1_RELEASE_REPORT.md)
- [Yedekleme ve deployment](docs/RC1_DEPLOYMENT_RUNBOOK.md)
- [Dış kurulum listesi](docs/RC1_EXTERNAL_SETUP_CHECKLIST.md)

`feature/announcements-core` release dalıdır. Schema zaten ilan, staging, audit, profil, oturum, kaydedilenler ve bildirim modellerini içerir. Eski `docs/prisma-addition.prisma` dosyasını schema'ya yeniden eklemeyin.

## Geliştirme

Node22, pnpm9.15.4, PostgreSQL16 ve Python3.11+ gerekir. `.env.example` yalnızca şablondur; gerçek değerleri Git dışında sağlayın.

```powershell
pnpm install --frozen-lockfile
pnpm --filter @kadro/api prisma:generate
pnpm --filter @kadro/api build
pnpm --filter @kadro/admin build
pnpm --filter @kadro/mobile exec tsc --noEmit
python -m pip install -r services/ingest/requirements.txt
```

Geliştirme komutları: `pnpm dev:api`, `pnpm dev:admin`, `pnpm dev:mobile`. Mobil API adresini kendi erişilebilir geliştirme ortamınıza göre yapılandırın.

Gerçek veritabanında migration/import otomatik çalışmaz. SQL incelemesi, güncel yedek/restore kontrolü ve ayrı kullanıcı onayı gerekir. Yazma yapan entegrasyon testleri yalnızca `kadroradar_ingestion_test_` önekli DB'yi kabul eder. `migrate reset` kullanmayın.

## Docker

```powershell
docker build -f Dockerfile.api -t kadroradar-api:rc1 .
python infra/check-release-secrets.py
```

Image aynı origin üzerinde `/admin/`, `/privacy`, `/delete-account` ve `/api/v1` sunar; `PORT` değerine öncelik verir. `/api/v1/health` DB readiness kontrolüdür. Render Free için belge işlemleri ve worker'lar kapalı tutulmalıdır.

RSS/CSV/JSON/PDF fixture testleri canlı aktarım değildir. Eksik başvuru tarihi açık ilan sayılmaz; nitelik kodları ve kadro koşulları doğrulanmadan kesin uygunluk üretilmez. Mevcut 504 yerel kayıt korunur; üç resmî PDF'nin toplam 919 kayıt testi ayrı DB'de yapılır.
