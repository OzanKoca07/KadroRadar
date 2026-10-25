# KadroRadar — Render kurulumu

25 Ekim 2026. Bu belge kurulum hazırlığıdır; servis, ücretli kaynak veya production veritabanı oluşturulmadı. Gerçek API adresi, DB parolası, destek e-postası ve işletmeci bilgileri henüz sağlanmadı. Önce `RENDER_RELEASE_HANDOFF.md` test sonuçlarını okuyun.

## Web Service alanları

Render → New → Web Service → bağlı GitHub repository:

| Alan | Girilecek değer |
| --- | --- |
| Repository | `OzanKoca07/KadroRadar` |
| Name | Kullanıcının seçeceği servis adı; URL tahmin etmeyin |
| Region | PostgreSQL ile aynı, kullanıcının seçeceği bölge |
| Branch | `feature/announcements-core` |
| Language / Runtime | `Docker` |
| Root Directory | **Boş** |
| Dockerfile Path | `./Dockerfile.api` |
| Docker Build Context | `.` |
| Docker Command / Start override | **Boş**; image CMD `node apps/api/dist/main.js` |
| Build Command | Docker runtime için ayrı komut yok |
| Pre-Deploy Command | **Boş**; migration otomatik çalışmaz |
| Instance Type | İlk sınırlı doğrulama için `Free` |
| Health Check Path | `/api/v1/health` |
| Auto-Deploy | İlk kurulum/migration tamamlanana kadar `Off`; sonra onayla `After CI Checks Pass` |

Uygulama `PORT → API_PORT → 3000` sırasıyla port seçer, `0.0.0.0` üzerinde dinler. Render `PORT` sağlar (varsayılan 10000); ayrıca API_PORT tanımlamayın. Docker `EXPOSE 3000` yerel varsayılanı anlatır, Render portunu sabitlemez; image healthcheck aynı ortam değişkenini kullanır. [Render port bağlantısı](https://render.com/docs/web-services#port-binding), [Docker runtime](https://render.com/docs/docker).

## Environment

| Değişken | Değer / kaynağı |
| --- | --- |
| `NODE_ENV` | `production` (image içinde de var) |
| `DATABASE_URL` | Aynı bölgedeki Render PostgreSQL **Internal Database URL**, dashboard'dan gizli değer olarak kopyalanır |
| `CORS_ORIGINS` | Oluşturulan servisin **gerçek HTTPS origin** adresi; `/api/v1` veya sondaki `/` eklenmez. Birden fazlaysa virgülle ayırın. `*`, localhost ve HTTP reddedilir |
| `PORT` | Render sağlar; elle secret üretmeyin |
| `TRUST_PROXY_HOPS` | `1`; yalnızca Render ingress arkasında, doğrudan uygulama portu internete açılmadan |
| `ALLOW_SELF_REGISTRATION` | İlk doğrulamada `false` |
| `SOURCE_SYNC_ENABLED` | `false`; registry izinleri ayrıca doğrulanmadan açmayın |
| `NOTIFICATIONS_ENABLED` | `false`; FCM/Expo gerçek cihaz kurulumu tamamlanmadı |
| `DOCUMENT_UPLOADS_ENABLED` | **Free için `false`**; yetkili PDF upload/web aktarımı/OCR endpoint'leri 503 verir |
| `GAZETTE_STORAGE_DIR` | `/app/.local/gazette` |
| `HISTORICAL_STORAGE_DIR` | `/app/.local/historical` |
| `SOURCE_STATE_DIR` | `/app/.local/sources` |
| `GAZETTE_RETENTION_DAYS` | `30` (izin verilen 1–90 gün) |
| `INGEST_PYTHON` | Image sağlar: `/opt/ingest/bin/python` |

`.env.example` yalnızca boş/zararsız şablondur; `.env` dosyasını GitHub'a veya Docker context'ine eklemeyin. Render URL'si belli olmadan sahte CORS adresiyle production açmayın. Eksik DB/CORS ile başlangıcın reddedilmesi beklenir. `ADMIN_REVIEW_TOKEN` tanımlamayın; production bunu reddeder. Uygulama JWT/session signing secret kullanmaz: kriptografik rastgele oturumların yalnızca hash'i PostgreSQL'de tutulur.

DB parolasını Render üretsin. Admin parolasını parola yöneticisinde 24+ rastgele karakterle üretin; Git, sohbet, log veya shell geçmişine yazmayın. DB bağlantısı TLS gereksinimleri için Render'ın verdiği URL ve [PostgreSQL bağlantı belgesini](https://render.com/docs/postgresql-creating-connecting) izleyin; dış bağlantıda TLS doğrulamasını kapatmayın.

## PostgreSQL ve açık migration adımı

İlk Free DB yalnızca test içindir. Veritabanı boşsa yerleştirme listesi de boştur; 504 mevcut yerel kayıt image'a gömülmez, kendiliğinden aktarılmaz. Production aktarımı ayrıca yedek/restore ve kullanıcı onayı gerektirir.

1. PostgreSQL hedefini ve DB adını teyit edin. Mevcut DB için tam yedek ve ayrı restore kontrolü alın.
2. `apps/api/prisma/migrations` içindeki 12 SQL'i inceleyin. Gerçek hedefe uygulama için **ayrı kullanıcı onayı** alın.
3. Free web servisinde shell, one-off job ve pre-deploy olmadığı için onaylı yerel makineden hedefin **External Database URL** değerini geçici ortam değişkenine güvenli şekilde alın. URL'yi komuta düz metin yazmayın. Render erişim listesini yalnızca operatör IP'siyle sınırlayın.
4. Aynı release checkout'unda aşağıdaki komutu, yalnızca onay verilmiş doğru hedefle çalıştırın. Bu görevde bu komut gerçek DB'ye çalıştırılmadı:

```powershell
# DATABASE_URL güvenli oturumda yüklenmiş olmalı; değerini yazdırmayın.
pnpm --filter @kadro/api exec prisma migrate status
pnpm --filter @kadro/api exec prisma migrate deploy
Remove-Item Env:DATABASE_URL
```

Alternatif: derlenmiş image içindeki Prisma CLI ile `node node_modules/prisma/build/index.js migrate deploy --schema apps/api/prisma/schema.prisma`; aynı hedef/onay kuralları geçerlidir. `migrate dev/reset`, drop veya truncate kullanmayın. Paid pre-deploy mümkün olsa da bu release otomatik migration tanımlamaz. [Render deployment adımları](https://render.com/docs/deploys#pre-deploy-command).

5. `/api/v1/health` 200 ve `database: ready`, migration status ve beklenen kayıt sayısını doğrulayın. DB yoksa readiness 503 döner; healthcheck migration uyumluluğunun yerine geçmez.

## Admin ve web sayfaları: aynı HTTPS origin

Docker image Vite admin build'ini `/admin/` altında, API'yi `/api/v1` altında, sayfaları `/privacy` ve `/delete-account`, script/stilleri `/legal/` altında sunar. Render'ın TLS sertifikasını kullanır; Render üzerinde Caddy container açmaya gerek yok. Admin derleme API adresi göreli `/api/v1` olur.

Admin hesabı oluşturmak için onaylı DB bağlantısıyla `node apps/api/create-admin.cjs --create` kullanılır. Geçici `NEW_ADMIN_EMAIL`, `NEW_ADMIN_PASSWORD`, `NEW_ADMIN_ROLE=SYSTEM_ADMIN` değerlerini parola yöneticisi/güvenli oturum üzerinden sağlayın; işlemden sonra bu değişkenleri kaldırın. Hesap oluşturma otomatik değildir; varsayılan hesap/parola yoktur. Free için yerel makineden dış DB bağlantısıyla çalıştırılır. Editör ve reviewer için ayrı en az yetkili hesaplar kullanın.

Cookie `HttpOnly; Secure; SameSite=Strict; Path=/api/v1`, 8 saat ömürlüdür; tarayıcı yazma istekleri CSRF token gerektirir, sunucu rolü DB'den denetler. Ayrı API ve admin `onrender.com` siteleri yerine bu aynı-origin düzenini kullanın. Cookie politikasını gevşetmeyin veya tarayıcıya admin token gömmeyin.

`web/public-config.js` içindeki işletmeci, gerçek destek e-postası, yedek/audit saklama süreleri kullanıcı tarafından tamamlanıp yeniden build edilmelidir. Boş alanlar görünür “yapılandırma eksik” uyarısı verir; mağaza yayınına hazır oldukları iddia edilmez. Web hesap silme formu gerçek aynı-origin login + CSRF + DELETE akışını kullanır. Ayrı Render Static Site ile yalnızca bilgilendirme metni sunulabilir; cross-site oturum gerektiren silme formunu ayrı domaine taşımayın.

Mobil EAS production ortamında gerçek `EXPO_PUBLIC_API_URL` (sonunda `/api/v1`), `EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_ACCOUNT_DELETION_URL`, `EXPO_PUBLIC_SUPPORT_EMAIL` girilir. Bunlar public konfigürasyondur; gizli anahtar eklemeyin. Expo SDK54, Android `com.kadroradar.app` ve EAS project kimliği korunur.

## Free sınırları ve production'a geçiş

Free: 15 dakika boşta uyur, uyanması yaklaşık bir dakika sürer; aylık 750 saat workspace içinde paylaşılır. Restart/deploy/uykuda yerel dosyalar kaybolur; kalıcı disk, shell ve one-off job yoktur. Free PostgreSQL 1 GB ile sınırlıdır, 30 gün sonra sona erer ve yedek sağlamaz. **Yalnızca sınırlı kurulum denemesi** yapın. [Render Free sınırları](https://render.com/docs/free).

Timer tabanlı kaynak/bildirim işleri uyuyan serviste zamanında çalışmaz. Background worker ve cron ayrı ücretli servis türleridir; bu image normalde HTTP API başlatır, özel worker/cron komutu henüz ayrıştırılmadı. Free üzerinde scheduler garantisi verilmez. [Background workers](https://render.com/docs/background-workers), [Cron jobs](https://render.com/docs/cronjobs).

Gerçek production: sürekli çalışan paid web instance, backup/restore politikası olan paid PostgreSQL ve belge saklamak için paid persistent disk gerekir. Tek instance için diski `/app/.local` üzerine bağlayın; UID1000'in alt klasörlerde yazabildiğini doğruladıktan sonra belge işlemlerini açın. Çok instance/ayrı worker için paylaşımlı object storage adaptörü ayrıca geliştirilmelidir. Mevcut yerel smoke testi 1GiB container sınırında geçti; Free belleğinde büyük PDF/OCR kapasitesi kanıtlanmış değildir. [Kalıcı diskler](https://render.com/docs/disks).

Kaynak ve bildirim worker'larını yalnızca izinler, kalıcı state, kaynak limitleri, gerçek cihaz teslimi ve yeniden başlatma testleri sonrası açın. Production URL, destek adresi, FCM ve Play kimlik incelemesi dış bağımlılıktır. Ücretli servis oluşturma ve deployment bu görev kapsamında yapılmadı.
