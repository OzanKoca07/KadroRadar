# KadroRadar — geliştirme başlangıcı

Bu depo **tamamlanmış ürün değildir**. Gerçek 2024/1 ÖSYM PDF'si, deterministik ayrıştırıcı, ilk PostgreSQL şeması, NestJS okuma API'si, Expo ekranı ve admin kabuğu içerir.

## Ön koşullar
Node.js 20+, pnpm 9, Python 3.11+, Docker Compose, Android emülatörü.

```bash
cp .env.example .env
docker compose -f infra/docker-compose.yml up -d
pnpm install
pnpm --filter @kadro/api prisma:generate
pnpm --filter @kadro/api db:migrate
python -m pip install -r services/ingest/requirements.txt
python -m unittest discover -s services/ingest/tests -v
pnpm data:import:historical --file reference/minmaxlisans29072024.pdf --year 2024 --round 1 --education BACHELOR --dry-run
pnpm data:import:historical --file reference/minmaxlisans29072024.pdf --year 2024 --round 1 --education BACHELOR --commit
pnpm dev:api
pnpm dev:mobile
pnpm dev:admin
```

**Dikkat:** `--commit` kayıtları yalnızca `DRAFT` olarak aktarır; yönetici onay mekanizması henüz uygulanmadığından mobil sorgular bunları göstermez. Bu güvenlik önlemidir. Veritabanı bağlantısı için `DATABASE_URL` ortam değişkeni ayarlanmalıdır.

API: `GET /api/v1/health`, `GET /api/v1/historical/rounds`, `GET /api/v1/historical/placements`, `GET /api/v1/historical/placements/:id`, `GET /api/v1/announcements`.

Kaynak: https://www.osym.gov.tr/kpss20241-bazi-kamu-kurum-ve-kuruluslarin-kadro-ve-pozisyonlarina-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler

KadroRadar bağımsızdır; ÖSYM veya diğer kamu kurumlarının resmî uygulaması değildir.
