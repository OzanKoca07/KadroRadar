# Implementation status — 2026-10-22

## Tamamlandı (dosya üretildi)
- [x] MASTER_PROMPT.md ve 13 sayfalık referans PDF depoya eklendi.
- [x] pnpm monorepo, Compose PostgreSQL yapılandırması, NestJS API iskeleti.
- [x] Prisma şeması ve ilk SQL migration.
- [x] Expo Router başlangıç ekranı ve tarihsel veri listesi.
- [x] React/Vite yönetim paneli kabuğu (yetkilendirme yok).
- [x] PDF parser, dry-run staging ve DRAFT veritabanı aktarım kodu.
- [x] Gerçek PDF'den 504 kayıt ayrıştırıldı; 0 ayrıştırma sorunu.
- [x] 3 Python birim testi başarılı.

## Doğrulanamayan / engellenen
- [ ] PostgreSQL migration ve gerçek DB commit: Docker çalıştırma ortamı yok.
- [ ] Node/TypeScript build, Expo çalıştırma, API smoke: pnpm bu ortamda yok.
- [ ] Onaylı verilerin mobilde görüntülenmesi: yönetici inceleme/onay akışı henüz yok.
- [ ] Çok sayfalı görsel/manuel kaynak kontrolü ve resmî kaynak lisans incelemesi.
- [ ] Import idempotence entegrasyon testi (SQL ON CONFLICT mevcut).
- [ ] API auth, admin RBAC, veri düzenleme denetim kayıtları, OpenAPI.

## Henüz yapılmadı
- [ ] Profil ve çoklu KPSS sonuçları; güvenli oturum.
- [ ] AND/OR/NOT nitelik motoru ve resmî kılavuz eşleştirmesi.
- [ ] Gerçek ilan kaynağı, ilan yönetimi, favoriler, başvuru takibi.
- [ ] Bildirimler, tercih listeleri, analitik grafikler.
- [ ] Android E2E, Play Store sürüm hazırlığı.

## Sonraki somut adım
1. Yerel Docker PostgreSQL başlat, migration ve dry-run/commit çalıştır.
2. ImportRow admin önizleme, denetim ve onay uçlarını RBAC ile tamamla.
3. Örnek kaynak satırlarını görsel PDF karşılaştırmasıyla doğrula, onaylı kayıtlara yayın izni ver.
4. API ve mobil entegrasyon testleri, ardından aday profili ve uygunluk motoru.
