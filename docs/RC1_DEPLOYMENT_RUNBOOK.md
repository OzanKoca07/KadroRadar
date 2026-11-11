# RC1 işletim ve deployment

Production yayını yapılmadı. Bu belge çalıştırılacak adımları açıklar; gerçek DB migration izni yerine geçmez.

## Veritabanı

Yerel salt okunur kontrol: gerçek `kadroradar` DB'de3 migration uygulanmış,9 migration bekliyor.12 migration boş `kadroradar_ingestion_test_rc1_final` DB'de başarıyla uygulandı. Tam gerçek DB dump'ı `.local/backups/kadroradar-rc1.dump`, SHA256 `d736bd2838f4920a444dbd4e74ea01e660efcac91b2eb6cf6661d0a884248145`; ayrı `kadroradar_ingestion_test_restore_rc1` DB'ye restore edildi. Restore önce/sonra504 onaylı yerleştirme korundu; dokuz bekleyen migration yalnızca bu restore kopyasında prova edildi.

`infra/backup-verify-local.ps1` yeni tarihli dump ve yeni restore DB oluşturur; mevcut DB'yi silmez/üzerine yazmaz/migrate etmez. Yedek kişisel veri içerebilir: `.local/` git ve Docker context dışında tutulur; erişimi sınırlı, şifreli off-site yedek ve test edilmiş saklama politikası operatör sorumluluğudur. Yerel dump alınması off-site felaket kurtarma değildir.

Gerçek migrate için: hedef DB/branch doğrula → yeni tam yedek+restore doğrula → SQL incele → kullanıcı açık onayı → yalnızca `prisma migrate deploy` → eski504 ve yeni endpoint health kontrolü. `migrate reset`, drop/truncate yok. Yeni değişiklik `202610250008_source_sync_state` yalnızca eklemeli operasyon tablosudur. Diğer pending SQL'lerde mevcut veri silme yok; Gazette sourceUrl NOT NULL kısıtı gevşetilir, sütun silinmez.

## API ve proxy

`docker build -f Dockerfile.api -t kadroradar-api:rc1 .` gerçek build komutudur. Önceki build Prisma postinstall/generate indirmelerinde takıldı. Frozen kurulum lifecycle scriptleri olmadan yapılır; `infra/generate-prisma.cjs` kilitli Prisma sürümünün resmî HTTPS engine arşivlerini IPv4/proxy uyumlu istemciyle,120sn istek/3 deneme ve SHA256 kontrolüyle alır; ardından explicit engine yollarıyla generate çalışır. TLS ve checksum doğrulaması kapatılmaz. Paket kurulumunda300sn, engine indirme/generate adımında840sn üst sınır var. Parser sürümü Windows/CI/Docker'da PyMuPDF1.27.2.3'e sabitlendi. Runtime Python/venv/Tesseract tur+eng içerir, node UID1000 çalışır. Image halen tüm workspace bağımlılıklarını içerir; image küçültme ve kapsamlı dependency/security taraması ayrıca yapılmalıdır.

`infra/compose.production.yml` Caddy HTTPS, non-root API,1GiB RAM/2CPU/128PID, cap_drop ve no-new-privileges ayarlarını içerir. PDF/source state named volume'ları kalıcıdır. Caddy API'ye tek güvenilir proxy'dir (`TRUST_PROXY_HOPS=1`); doğrudan API portunu internete açma. Origin listesine admin ve web silme sayfasının **gerçek HTTPS origin** değerlerini ekle. Health DB'de SELECT1 başarılı değilse503 döner; Caddy'nin upstream health'i ve Docker HEALTHCHECK ayrı mekanizmalardır.

`API_DOMAIN`, `DATABASE_URL`, `CORS_ORIGINS` işletmeci ortamından sağlanır. Örnek production URL/secret dosyası üretilmedi. `validateEnvironment` eksik/uygunsuz DB URL, HTTP/wildcard CORS, geçersiz boolean/proxy ve dev ADMIN_REVIEW_TOKEN varlığını reddeder. Production onay için HMAC development credential gerekmez. Named volume ilk oluşturulduğunda image'ın node sahipliğini kullanır; dış bind mount kullanılırsa UID1000 izinlerini operatör ayarlamalıdır.

Gizlilik `/privacy`, hesap silme `/delete-account`, statik dosyalar `/legal/*`: Caddy `web/` dizinini salt okunur sunar. Web silme formu API login cookie+CSRF→DELETE/account akışını kullanır; parola/token kalıcı browser storage'a yazılmaz. Başka origin'deki API seçilirse SameSite cookie ve CORS/topoloji yeniden değerlendirilmelidir; önerilen kurulum aynı origin'dir. `web/public-config.js` yalnızca public metadata içerir; secret ekleme. Doldurulmamış işletmeci/süreler sayfada açık uyarı üretir; bu alanlar yayın öncesi tamamlanmalıdır.

## OCR ve dosya operasyonları

Windows: `winget install --id UB-Mannheim.TesseractOCR --exact` desteklenen makine kurulumu için işletmeci yetkisi gerektirebilir; user scope bu makinede desteklenmedi. Bu oturumda installer SHA256 `c885fff6998e0608ba4bb8ab51436e1c6775c2bafc2559a19b423e18678b60c9` kontrol edildi; motor `C:/Program Files/Tesseract-OCR/tesseract.exe` altında bulundu. Türkçe fast dil verisi resmî tesseract-ocr/tessdata_fast deposundan `.local/tools/tessdata` içine alındı; SHA256 `7393381111e1152420fc4092cb44eef4237580d21b92bf30d7d221aad192c6b7`.

Windows ortamı: `TESSERACT_CMD` tam exe yolu; `TESSDATA_PREFIX` tur+eng traineddata dizini. Docker apt Tesseract/tur/eng paketlerini kurar. Motor/diller eksikse OCR_UNAVAILABLE açıkça döner. Admin POST `/admin/gazette-documents/:id/ocr`1–5 farklı işaretli sayfa; bir global PDF işlem slotu,200dpi/16Mpixel, sayfa30sn/OMP1, toplam child180sn/16MiB çıktı. CLI en fazla10 sayfa seçer. OCR yalnızca ayrı kanıt metni üretir; tablo/sayı/tarih otomatik kadroya yazılmaz. Windows ANSI stdout hatası UTF-8 output file kullanılarak giderildi.

Gazette64MiB/600 sayfa/1GiB storage/30gün(1–90 ayarlanabilir), upload+6saatlik temizleme korunur. ÖSYM64MiB/600sayfa/10000satır/1GiB storage, upload sırasında30gün PDF ve1saat temp temizliği uygular. Tarihsel PDF'ler yetkili endpoint'ten okunur; kullanıcı PDF dosyasına yazılmaz. Kalıcı retention ve yedeklerde silme tüm volume türlerinde operatörce izlenmelidir.

## Veri işçileri

`SOURCE_SYNC_ENABLED=false`, `NOTIFICATIONS_ENABLED=false`, `ALLOW_SELF_REGISTRATION=false` varsayılanları compose'da açıkça belirtilir. Kaynak registry enabled+VERIFIED otomasyon+VERIFIED yeniden yayın üç koşulu olmadan scheduler çalışmaz. Desteklenen otomatik adaptör şimdilik yalnızca mevcut Energy RSS; o da kapalıdır. Kaynak worker1dk tick/normal başarı1saat aralık; PostgreSQL advisory lock, idempotent staging,1dk→24saat backoff, kalıcı lastAttempt/lastSuccess/error/counts sağlar. `/admin/source-operations` yetkili sağlık ekranıdır; run endpoint'i SYSTEM_ADMIN+CSRF gerektirir ve kaynak izin kapısını atlayamaz.

Bildirim worker ayrı15dk döngüdür; DB plan kilidi/unique event ve atomik claim korunur. Sağlık ekranındaki enabled flag gerçek cihaz teslimi kanıtı değildir. UNKNOWN/askıda send olayları operatörce incelenir; mükerrer riskinden otomatik tekrar gönderilmez. Genel API rate limit process içidir; auth limiti PostgreSQL'dedir. Çok API replica'lı deployment için genel dağıtık limit/gateway ayarlanmalıdır.

ÖSYM web aktarımı günlük crawler değildir: editör resmî sonuç sayfasını sağlar, parser yalnızca sayfada fiilen bulunan resmî PDF'leri listeler, editör seçer, belge private staging'e alınır. Redirect/özel DNS/başka host/boyut aşımı reddedilir. Başlık dönem/eğitim bilgisi esas alınır. Kod+round conflict mevcut veriyi değiştirmez. Onay exact gerçek satır sayısıyla yapılır. Eski504 teyit metni aynı504 partisi için geçerlidir.
