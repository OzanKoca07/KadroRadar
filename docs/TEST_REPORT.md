# Doğrulama — 23 Ekim 2026

## Resmî Gazete gerçek PDF testi — 25 Ekim 2026

140 sayfalı33380 PDF okundu; SHA `050f756d5475090556dc4981709a760fd9776d1589584b902506de4486300dca`. Niğde85–89/29kontenjan/8satır ve Atalan90–92/1kontenjan/1satır kaynak tablosuyla doğrulandı. Parser6aday/12öneri satırı/16işaretli sayfa buldu; diğer adayların alanları tam doğrulanmış sayılmadı. İlk gerçek dosya multipart testi6created; ikinci6duplicate; iki hedefin simüle review/publish sonucu9publicPosition. Eksik tarihliAtalan OPEN değil; Niğde arşivde. Source private preview auth, USER403, bozuk dosya400, teyit ve nestedcriteria koruması, çapraz kaynak bağlantısında yeni ilan oluşturulmaması geçti. Aynı Node testinin sentetik2sayfa fixture modu da geçti; gerçek yayın/otomatik fetch olarak raporlanmadı.

İlk ham-metin kalite testi başarısız olup sıralı metnin bozuk glyph'leri gizlediğini gösterdi; raw+sorted kontrolüyle düzeltilip tekrar geçti. İlk64MiB öncesi20MiB sınırı gerçek38,5MB dosyayı reddetti; 64MiB sabit limit belirlendi. API/admin build, mobil tsc ve önceki candidate/ingestion/notification testleri geçti. Gerçek yerel tarihsel rounds/list/detail yalnızca GET ile test edildi,504onaylı kayıt doğrulandı. Prod migrationı/yazımı yoktur. Tam rapor: OFFICIAL_GAZETTE_INTEGRATION.md.

## 25 Ekim 2026 ek doğrulamaları

İlk migration denemesi Docker daemon kapalı olduğundan başarısız oldu; mevcut container başlatıldıktan sonra izole migration geçti. Ortak registry import'u eklendikten sonra Android export bir kez Metro watchFolders eksikliği nedeniyle başarısız oldu; packages dizini izlemeye eklendi ve son export 1107 modülle exit0 tamamlandı. Bu hatalar giderilmeden başarı raporlanmadı. Son cihaz-token hash bağlama migrationı dahil yeni migration sayısı5'tir.

API/admin build, mobil tsc, Prisma generate/validate: başarılı. İzole DB'de 4 aday/bildirim/auth migrationı uygulandı. `node test-eligibility.cjs`:9 kontrol; `node test-notification-plan.cjs`:8 kontrol; `node test-mobile-network.cjs`:eksik adres/offline/500/401/timeout/boş sonuç geçti. `node test-candidate.cjs`: gerçek HTTP session, cookie/CSRF, profil, rol, kadro, favori, bildirim tekilleştirme, export/silme, production session review/publish geçti. `node test-notification-worker.cjs`: taklit Expo send/receipt, günlük sınır, tekilleştirme, DeviceNotRegistered geçti; gerçek push gönderilmedi. Import regresyon testi kaynak değişikliğinde ilan ve kadro doğrulamasının kaldırılmasını da kapsıyor.

`node test-official-reference.cjs`: 1 gerçek resmî UAB referansı izole staging→simüle inceleme→yayın→arşiv başarılı; canlı production aktarımı değildir. Native cihaz doğrulaması yapılmadı. Android JS export başarılı; Expo Doctor18/18. Python RSS8 ve CSV/JSON3 test başarılı. Gerçek DB onaylı ÖSYM sayımı504; production DB migrationı uygulanmadı.

Bu sprintte çalıştırılan kontroller:

| Komut | Sonuç |
| --- | --- |
| pnpm --filter @kadro/api exec prisma migrate status | Başarılı; 3 migration, şema güncel |
| pnpm --filter @kadro/api build | Başarılı |
| pnpm --filter @kadro/mobile exec tsc --noEmit | Başarılı |
| pnpm --filter @kadro/admin build | Başarılı; Vite 6.4.5 |

Migration SQL incelendi: mevcut ilan migration'ı yalnızca Announcement tablosunu ve indekslerini oluşturuyor. Bu sprintte migration deploy veya veri değiştiren komut çalıştırılmadı.

504 tarihsel kaydın sayımı, gerçek HTTP endpoint testleri, ingestion testleri, yetkilendirme testleri, Android export, Expo Doctor ve cihaz testleri yapılmadı. Derleme sonuçları bu testlerin yerine geçmez. Önceki Prisma generate EPERM sorununun giderildiği henüz doğrulanmadı.
