# Mimari (ilk iterasyon)
pnpm workspace: `apps/api` NestJS/Prisma/PostgreSQL, `apps/mobile` Expo Router, `apps/admin` React/Vite, `services/ingest` PyMuPDF. `packages/ui` tema token'ları. PDF staging ve onaylı veri ayrıdır. Ayrıştırılan veriler otomatik doğrulanmış sayılmaz. Nitelik kodları ayrı resmî kılavuzla ilişkilendirilmeden uygunluk kararı üretilemez.

**Sınırlar:** Auth, admin yetki kontrolü, onaylama, profil, matching, bildirim ve uygulama takibi henüz uygulanmadı. Bu nedenle admin arayüzü salt statik kabuktur. Üretimde kullanıma hazır değildir.
