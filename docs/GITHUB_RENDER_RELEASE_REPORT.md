# GitHub + Render release raporu

26 Ekim 2026, Türkiye saati. Bu belge release hazırlığı sırasında oluşturuldu; push/CI sonucu doğrulandıktan sonra güncellenecektir.

| Aşama | Durum |
|---|---|
| Başlangıç branch / SHA | feature/announcements-core / ef7c2771419ae4226a0291cf32e806236ef9066b |
| Yerel API/admin/mobile build | TESTED_LOCALLY |
| İzole PostgreSQL | TESTED_LOCALLY —17 grup,504 snapshot korundu |
| Python/ACL | TESTED_LOCALLY —58+5, katalog eksikliği için gerçek katalogla11 tekrar PASS; PS5.1/7 PASS |
| Docker image/readiness | TESTED_LOCALLY —image723af0c461b028e486c4c23f8ebff88dbc4ea3b23d1168feed207232a32f18b4 |
| GitHub push / yeni commit | NOT_TESTED — aşağıdaki release işleminin sonucu sonradan kaydedilir |
| Yeni GitHub Actions | NOT_TESTED — eski commit CI başarısızdı, pnpm setup sürümü packageManager9.15.4 ile eşitlendi |
| Render deployment / environment | BLOCKED — Render API credential yok; browser aracı sandbox başlatma hatası verdi |
| Gerçek kaynak otomasyonu | NOT_TESTED / ACTIVE değil; bütün registry enabled=false |
| ÖSYM production aktarımı | Kapsam dışı,0 |
| APK/AAB | Kapsam dışı,0 |

## Release kapsamı ve korunmuş veriler

Önceki dirty çalışma korunarak Windows DACL,21 gerçek ÖSYM kaynak envanteri/8611 hazırlık aracı, çok kaynaklı manuel adaptörler, olgusal public veri politikası, admin/mobil filtreler ve96/48 saatlik one-shot altyapısı release'e alınır. `.env`, `.local`, dump, secret, token, kişisel veri ve özel çalışma makbuzları Git/Docker dışında kalır. main değiştirilmez; force-push yok.

## Migration farkı — otomatik uygulama yok

Başlangıç GitHub commit'inde14 migration SQL dosyası vardı; çalışma ağacında önceki sprintten15. dosya `202610270001_gazette_index/migration.sql` bulunuyordu:

```sql
ALTER TABLE "SourceDocument" ADD COLUMN "gazetteEvidence" JSONB;
```

Eklemeli nullable metadata alanıdır; mevcut veriyi silmez. Bu sprint yeni migration tasarlamadı.15 migration yalnızca ayrı geçici PostgreSQL'de test edildi. Production'ın migration isim/checksum'ları DB/Dashboard erişimi olmadığından **NOT_TESTED**; kullanıcının bildirdiği15 migration bağımsız teyit sayılmaz. Pending/farklı migration varsa ayrıca inceleme/onay gerekir; burada migrate/reset/seed/truncate/import yapılmadı. Docker CMD yalnızca API başlatır; startup migration yok.

## Render erişimi ve güvenli dağıtım

Mevcut servis `https://kadroradar.onrender.com`; yeni servis/DB oluşturulmaz. Root build context `.`, Dockerfile `Dockerfile.api`, start command image varsayılanı `node apps/api/dist/main.js`, health path `/api/v1/health`. Source adapter dosyaları image'a eklendi; PORT önceliği test edildi.

Mevcut Render env ve production rollback sürümü okunamadığı için kod commit'i `[skip render]` ile push edilecektir. [Render'ın skip mekanizması](https://render.com/docs/deploys) otomatik dağıtımı engeller; GitHub push deployment başarısı olarak sunulmaz. Mevcut başarılı production deploy SHA'sı bilinmiyor; remote başlangıç SHA'sı otomatik olarak rollback SHA'sı kabul edilmez.

Kullanıcı için kısa Dashboard sırası:

1. Mevcut KadroRadar Web Service → Deploys/Events. Son başarılı live SHA'yı rollback hedefi olarak kaydedin. Yeni servis/DB açmayın.
2. Settings: bağlı repo OzanKoca07/KadroRadar, branch feature/announcements-core; Dockerfile/root context/start/health yukarıdakiyle eşleşsin. Pre-deploy veya start komutunda otomatik migration/seed/import varsa bu release için çalıştırmayın.
3. Environment: mevcut secret'ları koruyarak NODE_ENV/PORT/DATABASE_URL/CORS/TRUST_PROXY/PROCESS_ROLE ve kapalı bayrakların kullanıcı talebindeki production kurallarını sağladığını Dashboard'da kontrol edin. Değerleri sohbete veya Git'e kopyalamayın. Yeni interval96 ve scan mode scheduled tanımlanabilir; source sync/one-shot/notifications/uploads kapalı kalır.
4. Gerçek15 migration isim/checksum durumunu salt okunur kontrol edin. Fark varsa DUR; migration için ayrı onay gerekir. Bu işlem ÖSYM pilot/remaining import değildir.
5. Manual Deploy → Deploy a specific commit: GitHub'da doğrulanan **kod release SHA'sını** seçin. [Render specific commit](https://render.com/docs/deploys) akışı kullanılmalı; rastgele latest başka commit'e ilerlememeli.
6. Live olduktan sonra health.release.commit bu SHA ile eşleşsin. Render [RENDER_GIT_COMMIT](https://render.com/docs/environment-variables) bilgisini sağlar; uygulama yalnızca geçerli SHA'yı public health'e ekler.
7. Aşağıdaki GET kontrollerini yapın. Kaynak/worker aktivasyonu, gerçek migration ve8611 veri aktarımı bu release'e eklenmez.

Rollback: önce kaydedilen başarılı deploy'u mevcut servisin Deploys ekranından yeniden dağıtın. Eski kodun yeni şemayla uyumluluğunu kontrol edin; DB reverse migration/reset/restore çalıştırmayın. Bu görev production schema/verisine dokunmadığından burada geri alınacak production DB işlemi yoktur.

## Public test ve sınırlar

`node infra/observe-public-release.cjs <kod-SHA>` yalnızca GET yapar: health, historical/placements?limit=1, announcements?limit=1, /admin/, /privacy, /delete-account ve üç unauthenticated auth route'u. JSON biçimi, public toplam, release SHA ve varsa metin alanı sızıntısı kontrol edilir. Boş listede içerik testi NO_RECORDS_TO_EXAMINE; gerçek production kayıtlarla kanıt sayılmaz.

Production ortamındaki authenticated session/CSRF, DB tablo sayımları ve migration checksum NOT_TESTED; bunlar izole ortamda test edildi. Free uyku, başarısız deploy veya uygulama hatası yalnızca timeout'tan ayrıştırılamaz; Dashboard kanıtı olmadan neden uydurulmaz. Gerçek HTTP503/database error gözlemi ayrıca raporlanır. Salt okunur probe çıktısı `.local/release/public-observation.json`; GitHub makbuzu `.local/release/github-status.json`.

Deployment öncesi public kontrol,26 Ekim2026 20:34 Türkiye saati: health200/database ready; historical200/toplam0; announcements200/toplam0; admin/privacy/delete-account200; yetkisiz admin-source/imports/profile401. API JSON biçimi doğru. Eski health cevabında release.commit yok; yeni kodun deploy edildiği iddia edilmez. İlan listesi boş olduğundan public içerik kontrolü NO_RECORDS_TO_EXAMINE; tam metin sızıntısı izole gerçek/sentetik kayıtlarla test edildi. Ayrı curl ölçümünde DNS/TCP/TLS tamamlandı ve HTTP200 alındı. Bu kontrolde uyku/deploy hatası gözlenmedi; önceki timeout'un kesin nedeni Dashboard olmadan belirlenmedi. Production staging/DB tablo toplamları hâlâ bilinmiyor; public0 bunların sayımı değildir. DEPLOYED veya ACTIVE iddiası yoktur.
