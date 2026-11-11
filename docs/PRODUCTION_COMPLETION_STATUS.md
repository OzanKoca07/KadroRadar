# Production durumu — 23 Ekim 2026

## Canlı kaynak kanıtı

Enerji Bakanlığı https://enerji.gov.tr/RSS/15?t=1 akışından canlı XML okunabildi. Başlık filtresi 1 aday buldu: “T.C. Enerji ve Tabii Kaynaklar Bakanlığı Sözleşmeli Bilişim Personeli Giriş Sınavı İlanı”. Gerçek item alanları title, description ve PublishStartDate; link alanı bulunmuyor. PublishStartDate: 11/18/2025 12:45:00 PM. Açıklamada başvuruların 24/11/2025–05/12/2025 olduğu yazıyor. Güncel alım değildir.

İlk yerel JSON çıktısında boş link feed URL'sine dönüşmüştü. Bu gerçek parser hatası düzeltildi: detay bağlantısı olmayan aday artık doğrulama hatası üretir. `services/ingest/artifacts/energy-review.json` ilk hatalı denemenin çıktısıdır; staging veya yayın için kullanılmamalıdır. Bu dosya DB'ye aktarılmadı. Canlı staging/onay/yayın: 0. Android doğrulaması: 0. Scheduler pasif.

SBB bu oturumda 403 döndürdü; Kariyer Kapısı okunabilen sayfasında yalnızca tablo başlıkları sundu. Bu kaynaklarda otomatik kullanım izni doğrulanmadı. Enerji RSS takip için resmen sunuluyor, üçüncü taraf yeniden yayın izni ayrıca belirsiz.

## Uygulanan kod

- API CORS allowlist; production'da CORS_ORIGINS zorunlu.
- IP başına process içi 120/dakika sınırı, Retry-After, güvenlik başlıkları ve graceful shutdown hook.
- Android dinamik config: production HTTPS zorunlu, localhost/IPv4 reddi, cleartext kapalı, compile/target API 36. Preview ayarları korunuyor.
- CI mobil typecheck ve RSS testlerini içeriyor.
- RSS boş bağlantı regresyonu giderildi.

Kontroller: API build başarılı; production cleartext/HTTPS config kontrolü başarılı; Python parser 8/8 başarılı. Gerçek AAB oluşturulmadı. Docker/deployment, domain/SSL, session auth/SSO ve scheduler tamamlanmadı. Production'a dağıtım yapılmadı. Mevcut HMAC credential tam kullanıcı oturumu değildir. Process içi rate limiter dağıtık veya kalıcı brute-force koruması değildir.

## Release engelleri

Google'ın https://support.google.com/googleplay/android-developer/answer/11926878 politikasında 31 Ağustos 2026 sonrası yeni mobil uygulama/güncelleme için API 36 hedefleniyor. Config buna göre ayarlandı; gerçek native build uyumu henüz doğrulanmadı. Domain, hosting, HTTPS API adresi, Play Console, imzalama, gizlilik politikası, destek iletişimi, Data Safety ve cihaz testleri olmadan yayın hazır kabul edilemez.

Gerçek veritabanına bu görevde migration uygulanmadı. Önceki izole staging testleri canlı ilan kanıtı değildir. Production-ready kabul kriterleri karşılanmıyor.
