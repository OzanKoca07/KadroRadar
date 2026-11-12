# Staging-only pilot ve Android hazırlığı

Tarih: 12 Kasım 2026. Release branch: `codex/live-source-pilot-readiness`.
PR: https://github.com/OzanKoca07/KadroRadar/pull/3 (main hedefli; merge yapılmadı).
Production baseline: `e31776b5c687535b225f3fbd79cbd445a7f8c670`.
Önceki mobil tarih/Prisma düzeltmesi: `cc8c3dbd8a082efbb5f153b46821e844a374b551`.

## Tamamlanan teknik yol

`workflow_dispatch` yalnız `career` veya `gazette` seçer. Workflow sadece staging-only çalıştırır; `--all`, cron ve R2 credential aktarımı kaldırıldı. Onay kapısı false/eksik olduğunda checkout, Python kurulumu, kaynak isteği ve ingest başlamaz. Workflow yalnız varsayılan branch üzerinden çalışabilir. Bu PR'dan canlı pilot başlatılmadı.

Yeni `SOURCE_INGEST_MODE` yoksa/disabled ise imzalı ingest 503 ile kapanır. Eski otomatik protokol ancak açık `automatic` moduyla kullanılabilir; ilk pilot workflow'u bu modu seçemez. Staging-only, `SOURCE_SYNC_ENABLED=true` ile birlikte API başlangıcında reddedilir.

Sunucuda staging-only için zorunlu yapılandırma:

| Değişken | Gelecekteki onaylı pilot için anlamı |
|---|---|
| SOURCE_INGEST_MODE | staging-only |
| SOURCE_ID | Yalnız seçilen career veya gazette |
| SOURCE_PILOT_MAX_RECORDS | 1–25; ilk öneri 1 |
| SOURCE_PILOT_MAX_DOCUMENTS | 1–2; ilk öneri 1 |
| R2_SOURCE_RECEIPTS_ENABLED | false; eksik değer de reddedilir |
| RENDER_GIT_COMMIT | Render'ın gerçek 40 karakter release SHA'sı |
| SOURCE_INGEST_ORIGIN | Gerçek API origin'i; `/api/v1` eklenmez |
| SOURCE_INGEST_HMAC_KEY | Mevcut secret; değeri okunmadı |

`SOURCE_AUTOMATION_APPROVED` ve `SOURCE_REMOTE_INGEST_ENABLED` kapalı kaldı. Bu tablo aktivasyon yapılmış olduğu anlamına gelmez. GitHub `SOURCE_RELEASE_SHA`, ileride CI'dan geçmiş ve gerçekten deploy edilmiş aynı tam SHA olmalıdır; bu görevde değiştirilmedi.

Kaynak, mod, limitler ve release SHA imzalı claim/complete gövdesine bağlıdır; lease bunları saklar. Worker ve API birbirinden bağımsız limit kontrolü yapar. API'nin sunucu tavanından büyük limit, farklı kaynak/mod/release veya lease değişikliği reddedilir. HMAC origin/route/body/zaman/nonce kontrolleri korunur. Tamamlanmış aynı payload aynı makbuzu döndürür; ek satır/audit yazmaz. Yeni run aynı resmi kimliği tekrar getirirse mevcut kayıt değiştirilmeden duplicate sayılır.

## Yayın engeli ve yazım kapsamı

Staging-only `SourceOperations.run` veya otomatik yayın işlemcilerini çağırmaz. Aynı Prisma transaction içinde kullanılan capability proxy yalnız kaynak durumu, audit, inceleme satırı ve küçük kaynak metadata'sına erişim verir. Announcement, position, source reference, notification, nested announcement yazımı ve keyfi SQL erişimi engellenir. İzin verilen raw SQL yalnız tam biçimi doğrulanan advisory lock sorgusudur.

İzole PostgreSQL testi önce audit ekleyip ardından public yazımı dener: hata alınır ve audit de rollback olur. Metadata kartı enjekte etme ve nested write girişimleri de reddedilir. Bu bir uygulama transaction korumasıdır; ayrı bir PostgreSQL salt-staging kullanıcı rolü oluşturulmadı ve migration eklenmedi.

Yeni satırlar `PENDING_REVIEW`, `announcementId=null`, `raw.pilot.publicationBlocked=true` olarak kaydedilir. Kariyer RSS kurum/başvuru tarihleri null kalır; detail enrichment ilk pilotta kapalıdır. RSS public-card publication alanı worker payload'ından devralınmaz. Genel kariyer duyuruları da review satırıdır; public news oluşturulmaz. Gazette PDF/HTML body saklanmaz; yalnız resmi URL, SHA-256 ve küçük metadata `PILOT_SOURCE_METADATA` durumunda saklanır. Mevcut public kayıtlar güncellenmez veya geçersizleştirilmez.

Claim iki SourceSyncState upsert ve bir lease audit yazar (eski lease süresi dolmuşsa ayrıca expiration audit). Başarılı complete import başına bir satır/bir import audit, gerekli Gazette metadata belgeleri, iki state güncellemesi ve bir completion audit yazar. İstek kuyruğu varsa ayrıca request durumu güncellenir. Makbuz `writes`, `created`, `duplicate`, `autoPublished=0`, `newsPublished=0` alanlarını raporlar. Kaynak hatasında aday/public yazılmaz; hata state/audit'iyle kapanır. Pilot canonical başarılı tarama checkpoint'ini ilerletmez; eksik kaynakları iptal/arsivlemez. Böylece kısmi pilot tam tarama gibi işaretlenmez.

Kayıt limiti staging aday ilan sayısıdır; kadro sayısı değildir. PDF sayfa/boyut sınırları korunur. Gazette belge limiti indeks sayfalarını hariç tutar; HTML'den PDF fallback her iki belge isteğini tüketir. Limit 1 iken ikinci fallback isteği yapılmaz; pilot hata ile durabilir. RSS tek belge olarak sayılır; metadata çıkarımı mevcut bounded feed üzerinde yapılır, ilk N aday seçilir. Parsed/selected/truncated metrikleri ayrıdır.

Admin'in mevcut RBAC, alan doğrulama, kaynak izni ve ayrı APPROVE/PUBLISH akışı korunur. Pilot otomatik onay veya yayın yapmaz. Sonraki manuel yayın kararı bu görev kapsamı dışındadır.

## Yerel test kanıtları

- API/admin build ve mobil TypeScript: PASS.
- Disposable PostgreSQL 16, 16 migration: toplu 25/25 PASS. Staging pilot güvenlik kontrolleri, source rights, HMAC/replay, auth legacy compatibility, historical pagination/puan filtreleri, announcement/network sözleşmeleri dahildir.
- Pilot API: iki sentetik kaynak; publication/news=0; aynı imzalı complete idempotency; yeni run duplicate; izin iptali; release/limit/source reddi; transaction rollback/nested write/public card engeli.
- Pilot runner fake transport: 38 kontrol PASS; eski runner: 50 PASS; R2 fake: 248 PASS. Gerçek R2 veya kaynak isteği yok.
- Python: 120 test; 115 PASS, 5 mevcut koşullu gerçek-belge testi SKIP. Bunlar canlı erişim başarısı sayılmaz. Yeni 4 pilot testi sentetik XML/PDF kullanır.
- Docker gerçek Linux image build PASS; dependency/base cache kullanıldı, `--no-cache` iddiası yok. Resmi Prisma engine hash doğrulaması korundu. Non-root ephemeral contract 26, storage 8, offline runtime import ve disposable API readiness PASS.
- Android export PASS; SDK54, com.kadroradar.app, version 1.0.1/code3 korundu. EAS build başlatılmadı.
- Secret scan/manifest/git diff check PASS; gerçek XML/PDF, .local, env, dump ve signing dosyaları release'e alınmadı.
- 23 korunan operatör dosyasının orijinal checkout hash'leri aynı. Prisma şeması/lockfile/auth dosyaları baseline ile aynı. Migration16 canonical Git/LF SHA-256: `e706db2cb2241c09919c0a3c96abdc862227956b84c932b71bc2b36318a53ead`. Windows CRLF byte hash'i ayrı olabilir; SQL değiştirilmedi.

İlk toplu denemede yeni pilot testinin sentetik satırları sonraki teste sızdı. Yalnız o testin ürettiği kimlikleri temizleyen teardown eklendi; aynı toplu sıra tekrar PASS. Gerçek veritabanına işlem yapılmadı.

## GitHub kanıtı

Önceki cc8c3dbd commit'i gerçek GitHub CI 6/6 ve GitGuardian PASS. Yeni staging commit'i için sonuçlar, push sonrasında PR #3 kontrollerinden ayrıca doğrulanmalıdır; eski başarı yeni commit'in yerine geçmez. Son operasyon raporu yeni SHA ve gerçek CI bağlantısını içerir. Bu belgeye dayanarak PR merge veya production aktivasyonu yapılmaz.

## Android ve production GET durumu

Production GET health eski SHA e31776b5..., database ready; historical total 8611; sayfalar arası ID benzersiz; ilan/news 0; selfRegistration=false; oturumsuz profil/admin 401. Production'a POST veya doğrudan DB bağlantısı yapılmadı.

Mobil boş ekran “Şu anda yayımlanmış ilan bulunmuyor” ve geçmiş atamalara geçiş gösterir. Ağ hatası boş listeye dönüştürülmez. Favori/profil yetkilendirmesi ve SecureStore sözleşmesi regresyonlarla korundu; gerçek cihazda native keystore/uygulama yeniden açılışı bu görevde doğrulanmadı. İzin bekleyen ilanlar aktifmiş gibi gösterilmez.

Mevcut preview profilinin HTTPS Render API alias'ı korunuyor. Yeni APK için operatör, release/CI ve ayrı build onayı sonrasında:

```powershell
Set-Location <temiz-release-checkout>\apps\mobile
pnpm exec eas build --platform android --profile preview
```

Bu komut bu görevde çalıştırılmadı. Öncesinde EAS hesabı/proje ve kota/maliyet incelenmeli. Gerçek cihaz checklist: oturumsuz geçmiş atamalar; üç eğitim/yıl/dönem/şehir/kurum/taban-tavan filtreleri; sayfalama ve geri tuşu; sıfır ilan; ağ kesintisi/timeout/retry; mevcut test hesabıyla giriş/çıkış/oturum yeniden açma; favori ekleme/silme; resmi dış link; bağımsızlık açıklaması; ikon/splash ve erişilebilirlik. Production kayıt/recovery açılmayacak; hesap değiştiren testler ayrı staging adayıyla yapılmalı.

## Kurum izinlerine bağlı kalan işler ve önerilen sıra

Kullanıcı iki kuruma kapsam başvurusu yaptığını, cevap beklendiğini bildirdi. Bu bilgi izin verildiği anlamına gelmez. Kariyer/Gazette gerçek registry `REVIEW_REQUIRED`, bütün kaynaklar disabled kaldı. Kamuya açık resmi link/olgusal metadata gösterimi, otomatik erişim, geçici PDF işleme, ticari mobil kullanım ve logo/tam metin yeniden yayımı ayrı kapsam konularıdır. Bu sürüm belge tam metnini veya görselini yeniden yayımlamaz; mevcut evidence kontrolünü gevşetmez.

1. PR #3'ün yeni SHA'sında altı CI ve GitGuardian PASS doğrulansın; risk incelemesi sonrası ayrı merge onayı alınsın.
2. Kurum cevapları resmi URL/tarih/SHA-256 ve kapsam/süreyle kaynak bazında değerlendirilsin; yetersiz kapsamda kaynak kapalı kalsın.
3. Ayrı onaylı registry/evidence release'i ve kontrollü deployment yapılsın; auth rollout ve scheduler kapalı kalsın. Bu görev bunları yapmaz.
4. Health release SHA ile GitHub SOURCE_RELEASE_SHA eşleşmesi doğrulansın. Önce yalnız tek kaynak için staging-only ve 1 kayıt/1 belge sınırı ayrı aktivasyon onayıyla yapılandırılsın.
5. Manuel workflow yalnız bir kez çalıştırılsın. Run/lease/reportHash, kaynak URL/hash, UNKNOWN alanlar, staging/audit ve publication/news=0 kontrol edilsin. R2/cron kapalı kalsın.
6. Sorunda kaynak kapısı kapatılsın; otomatik retry/yayın yapılmasın. Başarılı pilot sonrası public yayın ve en son periyodik çalışma için ayrı karar alınsın.
7. Android build ve fiziksel test ayrı onaylı aşamada yapılsın; Google Play kapalı test için hesap/mağaza politikaları, destek kimliği, gizlilik/hesap silme ve cihaz test kanıtları tamamlansın.

Yerel teknik hazırlık GO; gerçek production pilot/yayın/deploy ve Android build NO-GO (kurum kapsamı ve açık aktivasyon/build onayı bekleniyor). Yeni migration gerekmiyor. HMAC/R2 secret değerleri okunmadı; hiçbir production activation bayrağı değiştirilmedi.
