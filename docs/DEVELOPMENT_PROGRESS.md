# Sprint durumu — 23 Ekim 2026

## 25 Ekim 2026 — Resmî Gazete

`official_gazette.py`, yetkili özel PDF upload/preview/retention, mevcut SourceDocument→staging→review→Announcement/Position zinciri, ikinci kaynak kanıtı bağlantısı ve mobil kaynak metadata görünümü eklendi. Gerçek33380 PDF'de140/140 sayfa,16 işaretli sayfa,6 aday; hedef Niğde29 kontenjan/8satır ve Atalan1kontenjan/1satır doğrulandı. İlk çalışmada6 gerçek aday izole staging'e yazıldı; tekrar6duplicate.2 hedef simüle onay/yayınla API'de9kadro satırı olarak doğrulandı; üretim yazımı0. Kaynak dosya özel endpoint ve retention ile korunur; genel dağıtım yok. 006/007 migrationları yalnızca izole DB'de uygulandı. Ana ÖSYM HTTP GET regresyonu504 ile geçti. Ayrıntılı dosya/endpoint/kanıt raporu `OFFICIAL_GAZETTE_INTEGRATION.md` içindedir. Resmî canlı erişim/izin UNVERIFIED; otomasyon kapalı.

## 25 Ekim 2026 — aday özellikleri

Rakip karşılaştırması COMPETITOR_FEATURE_GAP.md içinde. Kullanıcı session/profil, kadro değerlendirme, favori, bildirim planı ve Expo adapter'ı eklendi. Üç migration yalnızca izole test DB'ye uygulandı. API/admin build, mobil typecheck, Prisma generate/validate, 9 uygunluk kontrolü, 7 bildirim kararı, hesap/favori/CSRF/RBAC, Expo taklit worker/receipt, import regresyonu ve mobil offline/500/timeout istemci testleri geçti. Android JS export başarılı; Expo Doctor18/18. Gerçek yerel ÖSYM sayımı504. Bir gerçek resmî referans yalnızca izole ortamda arşiv zincirinden geçti. Production ilanı0, gerçek cihazda yeni akış doğrulaması0. Ayrıntı: CANDIDATE_FEATURE_DELIVERY.md.

## Son yürütme

- DONE_TESTED: CSV/JSON UTF-8 başlık eşleştirme, dry-run ve satır hataları; `python -m unittest discover -s services/ingest -p test_manual_import.py` 3 test geçti.
- DONE_TESTED: RSS testleri 8/8; `prisma validate` başarılı.
- DONE_TESTED: `docker compose -f infra/compose.production.yml config --quiet` exit 0; placeholder değerlerle yapı doğrulaması, canlı TLS testi değildir.
- IMPLEMENTED_NOT_TESTED: CSV batch staging gönderimi; çok aşamalı Docker runtime ve Caddy HTTPS yapılandırması.
- BLOCKED_EXTERNAL: domain/hosting/TLS yayını, Play Console ve izinli sürekli kaynak yeniden kullanımı.
- NOT_STARTED: gerçek kullanıcı login/session sistemi, scheduler distributed lock, gerçek Android/AAB doğrulaması. Bunlar dış erişim engeliyle açıklanamaz; geliştirme olarak eksiktir.
- Docker build başlatıldı; temel imaj indirmesinde yavaş ağ görüldü. Başarılı build sonucu henüz yok; son Dockerfile değişikliği ayrıca yeniden build edilmelidir.

Dry-run: `python services/ingest/manual_import.py ilanlar.csv`. Yazım için açık `--stage-api http://localhost:3000/api/v1` ve ANNOUNCEMENT_INGEST_CREDENTIAL gerekir. Hatalı satır varsa batch gönderilmez. Gerçek DB migration uygulanmadı.

## Çalıştırıldı ve doğrulandı

Migration status, API build, admin build ve mobil typecheck başarılı.

## Kodlandı; davranış doğrulaması bekliyor

Mobil ilan listesi, arama, sayfalama, yenileme, arşiv görünümü, detay ve kısıtlı resmî outbound bağlantılar. Ana sayfa bağlantısı eklendi. API archive ve filters statik rotaları dinamik id rotasından önce eklendi. Public liste ve detayda sourceCheckedAt zorunlu tutuldu.

## Resmî erişim/izin gerektiriyor

SBB 403; Kariyer Kapısı okunabilen yanıtta kayıt sunmadı. Otomatik aktarım ve kaynak kullanım izinleri doğrulanmadı. Scraping etkinleştirilmedi.

## Henüz yapılmadı

İlan staging/import, normalizasyon, çoklu kadro modeli, deduplication, admin session/RBAC ve ilan yönetim ekranları, scheduler/kilit, revizyon/audit, kaynak sağlığı, favoriler, production hardening, bütünleşik testler ve Play release doğrulaması. Sprint tamamlanmış veya production hazır değildir.
