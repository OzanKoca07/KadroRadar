# Release blocker sonucu — 23 Ekim 2026

Son ekler: UTF-8 CSV/JSON dry-run ve batch aktarımı `services/ingest/manual_import.py` içinde; 3 manuel import ve 8 RSS testi geçti. Prisma validate başarılı. Çok aşamalı Dockerfile ve Caddy reverse proxy compose eklendi; compose yapısal doğrulaması exit 0. Docker imaj build'i tamamlanmış olarak doğrulanmadı. Gerçek kullanıcı session auth ve scheduler henüz eksik; canlı staging/yayın sayıları değişmedi. Ayrıntılı durumlar DEVELOPMENT_PROGRESS.md içindedir.

Ortak `packages/official-sources.json` Python ve Nest API tarafından kullanılır. Altı kaynağın hostname, format, feed ve izin durumu tanımlıdır. Hepsi otomatik senkronizasyon için pasiftir; bu registry adapter implementasyonu veya izin kanıtı değildir. API başvuru URL'lerinde genel gov.tr/edu.tr soneki kabulünü kaldırıp exact-host registry kontrolüne geçti. Python outbound DNS kontrolü private/loopback/link-local yanıtları reddeder, yönlendirmeler halen kapalıdır. DNS pinning yoktur; deployment egress koruması gerekir. Kaynak bazlı sağlık ve scheduler henüz uygulanmadı.

Admin paneline manuel JSON batch import eklendi; kayıtları mevcut sunucu doğrulamasıyla staging'e gönderir. CSV henüz desteklenmez. Operatör credential akışı tam login/session değildir.

`Dockerfile.api` frozen lockfile kurulum, Prisma generate, API build, non-root runtime ve healthcheck içerir. `.dockerignore` sırları, veritabanı yedeklerini ve yerel çıktıları dışlar. Container build ve production deployment henüz denenmedi. Dockerfile tek başına HTTPS, backup/restore veya dağıtık rate limiter sağlamaz.

## Canlı araştırma

- https://www.uab.gov.tr/duyurular/ okunabildi. 19 Ekim 2026 tarihli Kıyı Emniyeti alım detayına ulaşıldı: https://www.uab.gov.tr/duyurular/kiyi-emniyeti-genel-mueduerluegue-tuerkiye-is-kurumu-uezerinden-suerekli-isci-alim-duyurusu/ . Başvuru dönemi kaynakta 19–23 Ekim 2026; kesin kapanış saati verilmedi. Yeniden yayın/otomasyon izni doğrulanmadı. Staging veya yayın yapılmadı.
- ilan.gov.tr ve resmigazete.gov.tr araştırma aracı bu oturumda timeout verdi.
- Önceki Enerji RSS başarısı güncel ilan başarısı değildir: 2025 kaydı ve eksik detay URL'si nedeniyle yayımlanamaz.

Bu oturumda araştırılan kaynak: 3; okunabilen: 1; başlık/tarih/detay URL'siyle gerçek aday: 1; otomatik yeniden kullanım izni doğrulanan: 0; yeni canlı staging/onay/yayın: 0; mobil doğrulama: 0. Scheduler pasif; production authentication eksik; HTTPS backend dağıtılmadı; AAB denenmedi; Play hazır değil.

Parser testleri 8/8 geçti. API/admin build, mobil typecheck ve migrate status komutları ayrıca başlatıldı; tamamlanma sonuçları araç çıktılarından değerlendirilmelidir. Gerçek DB'ye migration uygulanmadı. Mevcut kullanıcı değişiklikleri korunuyor. Dış bağımlılıklar: kaynak kullanım izni, hosting/domain/SSL, kimlik sağlayıcısı veya admin hesap kurulumu, Play Console ve imzalama erişimi. Bunlara ek olarak scheduler/session/dağıtık limit kodları halen geliştirme işi olarak kalıyor.
