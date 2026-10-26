# Render ÖSYM tarihsel veri aktarımı

## Windows ACL ve son doğrulama güncellemesi

26 Ekim 2026 çok kaynaklı sprintinde `Set-Acl / SeSecurityPrivilege` hatası giderildi. `private-directory.ps1` Win32 API ile yalnızca protected DACL uygular; SACL/owner/group yazmaz. Mevcut kullanıcı SID, SYSTEM ve yerel Administrators dışında erişim kuralı kabul etmez; owner da izinli olmalıdır. Mevcut alt dosyalar, yeni dosya inheritance'ı, reparse reddi ve fail-closed doğrulanır. İşlem credentials prompt'undan ve DB bağlantısından önce yapılır. Doğrudan Node production çağrısı da aynı DACL kapısından geçer. Güvenlik sağlanamazsa sabit, secret içermeyen mesajla durur; ayrıcalık yükseltme veya güvenlik kontrolü kaldırma önerilmez.

`powershell.exe -NoProfile -File infra/test-private-directory.ps1` ve PowerShell7.6.5 karşılığı PASS: wrapper AST/sözdizimi, tekrar çalıştırma, mevcut/yeni dosya erişimi ve hatalı hedefte durma; DB bağlantısı0. Windows CI5.1/7 matrix eklendi, uzak Actions koşusu yapılmadı.

21 gerçek belge/8611 kayıt operatör testi yeniden PASS: gerçek pg_dump/ayrı restore, yedek yokken ve hash bozukken yazmayı reddetme,504 pilot/test API onayı, kalan20 belge, kaynak/filtre/audit ve yeniden import hash eşitliği. Production DB erişimi/yazımı hâlâ0. Aşağıdaki kaynak envanteri ve operatör sırası korundu; gerçek aktarım uygulanmadı.

**En yeni public durum:**15:54:52 UTC kontrolünde health/history/announcements20sn timeout verdi. Aşağıdaki13:34 gözlemi tarihsel kanıttır, güncel toplam iddiası değildir. Yeni production toplamı UNKNOWN. Güvenli sıralı onay kapıları `PRODUCTION_RELEASE_CHECKLIST.md` içindedir; bu belge production yazma onayı vermez.

26 Ekim 2026. **Production'a bu görevde aktarılan kayıt0; production staging/onay işlemi0.** Render External Database URL veya production admin parolası bu oturumda mevcut değildir. `.env` yalnızca yerel localhost veritabanını gösterir; bu hedefe bağlanılmadı. Secret, parola veya tam DB URL'si bu raporda/Git'te/loglarda tutulmaz.

## Mevcut gerçek durum

Repository `OzanKoca07/KadroRadar`, branch `feature/announcements-core`, başlangıç HEAD `ef7c277`. Önceki Gazete görevinden kalan commit edilmemiş dosyalar korundu. Bu görevde push veya Render deployment yapılmadı; yerel yeni filtre kodu production'da varsayılmamalıdır.

Production API https://kadroradar.onrender.com/api/v1 salt okunur olarak kontrol edildi:

- `/health`: HTTP200, `status=ok`, `database=ready`.
- `/historical/placements?limit=1`: HTTP200, `total=0`, `items=[]`.
- `/historical/rounds`: HTTP200, `[]`.
- BACHELOR / ASSOCIATE / HIGH_SCHOOL için ayrı public toplamlar0.
- `positionCode=invalid` HTTP200 döndü. Yeni katı kadro kodu doğrulamasının production'a ulaştığı teyit edilemedi; boş veriyle gerçek filtre doğruluğu kanıtlanamaz.

Özel kanıt `.local/osym-production/public-observation.json`; kontrol zamanı2026-10-26T13:34:51Z. Bunlar **public onaylı veri** sayımlarıdır. Veritabanındaki unapproved/staging satırları, doğrudan DB sayımları, 15 migration'ın gerçek checksum durumu ve production yedeği secret erişimi olmadığından bağımsız doğrulanmadı. Kullanıcının bildirdiği üç boş tablo ve15 migration, araç tarafından production DB'de kontrol edilmiş gibi sunulmaz.

## Sayım ve kaynak uzlaştırması

Önceki8.196 = altı dönemin7.692 kaydı +2024/1 lisans504. **2024/1 önlisans346 ve ortaöğretim69 bu toplamın dışındaydı.** Tam kaynak envanteri8.611 satır,7 dönem,21 eğitim/dönem kombinasyonudur:

| Eğitim | Hazır gerçek kaynak kaydı | Bu görevde production aktarımı | Şu an public API |
|---|---:|---:|---:|
| Lisans / BACHELOR | 4.797 | 0 | 0 |
| Önlisans / ASSOCIATE | 2.974 | 0 | 0 |
| Ortaöğretim / HIGH_SCHOOL | 840 | 0 | 0 |
| Toplam | 8.611 | 0 | 0 |

2024/1'in üç PDF'si resmî sonuç sayfasında gözlenen bağlantılardan yeniden indirildi ve yerel gerçek dosyalarla byte SHA-256 eşleşti. İlk okuma TIMEOUT sonrası en fazla iki deneme kullanıldı; erişim kontrolü/TLS doğrulaması aşılmadı. Diğer18 belge önceki gerçek resmî indirmelerin hash kontrollü önbelleğinden yeniden ayrıştırıldı;21 belgenin tamamı bu görevde canlı yeniden indirildiği iddia edilmez. Her belgenin resmî index cache hash'i, gözlenen linki, header dönem/eğitim bilgisi ve satır sayısı tekrar doğrulandı.

Tam URL/SHA/tarih ve belirsiz alan envanteri: [`packages/osym-production-sources.json`](../packages/osym-production-sources.json). Parser hata0; tüm kaynaklarda şehir boşluğu0. Kaynakta yerleşmeyen kadrolara ait20 satırda min/max puan bulunmaz; null korunur, sıfır veya tahmini puan üretilmez. Bu durum parse hatası değildir ve uygunluk kararı üretmez. Nitelik kodu eşleştirmesi doğrulanmış sayılmaz.

Aşağıdaki üretim sütunları **bu görevin yaptığı işlem miktarıdır**; erişilmeyen doğrudan staging envanteri değildir. Hata/duplicate0, production import denemesi yapılmadığı anlamındadır.

| Dönem | Eğitim | Resmî belge | SHA-256 (doğrulandı) | Beklenen | Prod staging | Onay | Public | Duplicate | Hata | Sonuç |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 2023/1 | Lisans | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2023/KPSS/TERCIH1/minmaxlsns26072023dl.pdf) | `5ee3dd5c95d6f7dcdfb9d6810f0979fb5385b02af7dd72025f76c6ec4b56d167` | 559 | 0 | 0 | 0 | 0 | 0 | ACCESS_BLOCKED |
| 2023/1 | Önlisans | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2023/KPSS/TERCIH1/minmaxonl26072023donl.pdf) | `a7a5a7dd1dedd8542d85bbe5dc3de9895bba7922a102302992cb00370f57e548` | 421 | 0 | 0 | 0 | 0 | 0 | ACCESS_BLOCKED |
| 2023/1 | Ortaöğretim | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2023/KPSS/TERCIH1/minmaxort26072023do.pdf) | `f7c86416bc5b92a0e9002169578fd20df012c2856448693b3b6f76a8c62ea477` | 56 | 0 | 0 | 0 | 0 | 0 | ACCESS_BLOCKED |
| 2023/2 | Lisans | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2023/KPSS/TERCIH2/minmaxlsns08012024.pdf) | `8d80a347f285ba393dfb2c9f58a224c13458179f078154bc1a7c98eaea3924fd` | 836 | 0 | 0 | 0 | 0 | 0 | ACCESS_BLOCKED |
| 2023/2 | Önlisans | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2023/KPSS/TERCIH2/minmaxonl08012024.pdf) | `a8731dd3c34b19d31379ffae15bb18d5147463dc155138054896c3b15b9d82c6` | 541 | 0 | 0 | 0 | 0 | 0 | ACCESS_BLOCKED |
| 2023/2 | Ortaöğretim | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2023/KPSS/TERCIH2/minmaxort08012024.pdf) | `f3c334c28211dad353849944472856946bf05019df0f1e17e1b7eecf52c0cc55` | 110 | 0 | 0 | 0 | 0 | 0 | ACCESS_BLOCKED |
| 2024/1 | Lisans | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2024/KPSS/TERCIH1/minmaxlisans29072024.pdf) | `4ede351e8e6791df475b13e1136b812ac3362c71e8453f18301b10ecb56b2e1e` | 504 | 0 | 0 | 0 | 0 | 0 | ACCESS_BLOCKED |
| 2024/1 | Önlisans | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2024/KPSS/TERCIH1/minmaxonl29072024.pdf) | `4a0eed2448f29e9d491461935d503688b9170ac469cc11f91cb6673c237abc93` | 346 | 0 | 0 | 0 | 0 | 0 | ACCESS_BLOCKED |
| 2024/1 | Ortaöğretim | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2024/KPSS/TERCIH1/minmaxort29072024.pdf) | `30f68e6811a5430530ba76223e70efbbf23ef4447da3735c1c0347638073261d` | 69 | 0 | 0 | 0 | 0 | 0 | ACCESS_BLOCKED |
| 2024/2 | Lisans | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2024/KPSS/TERCIH2/minmaxlisans03012025.pdf) | `86ff8a96ee049d854bfdb45dcb96b0ff3b67103ff8672a5c6720d9dd9d9c2e1f` | 555 | 0 | 0 | 0 | 0 | 0 | ACCESS_BLOCKED |
| 2024/2 | Önlisans | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2024/KPSS/TERCIH2/minmaxonl03012025.pdf) | `5267837b00aac47b23048a934dcfc2f6b97da05bfd2fc328787e663dbfc9cc63` | 268 | 0 | 0 | 0 | 0 | 0 | ACCESS_BLOCKED |
| 2024/2 | Ortaöğretim | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2024/KPSS/TERCIH2/minmaxort03012025.pdf) | `b3f612d4dd18a266cd03d1f1d2f7b80226591ce83cb3745834d50c01639a4832` | 41 | 0 | 0 | 0 | 0 | 0 | ACCESS_BLOCKED |
| 2025/1 | Lisans | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2025/KPSS/TERCIH1/minmaxlisans23072025.pdf) | `61f5312e925f22676fb22f970d1a8275d713c7602c3c515703a8d34e28720515` | 798 | 0 | 0 | 0 | 0 | 0 | ACCESS_BLOCKED |
| 2025/1 | Önlisans | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2025/KPSS/TERCIH1/minmaxonl23072025.pdf) | `96daaf8508b4ddbcf028f0a58f53d24c801a35893c516083668bbc48fa203d10` | 418 | 0 | 0 | 0 | 0 | 0 | ACCESS_BLOCKED |
| 2025/1 | Ortaöğretim | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2025/KPSS/TERCIH1/minmaxort23072025.pdf) | `0496e1c3222cddd8e97ed0ab90795e21ca8f983cb312bffff0e4f91754956dbc` | 175 | 0 | 0 | 0 | 0 | 0 | ACCESS_BLOCKED |
| 2025/2 | Lisans | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2025/KPSS/TERCIH2/minmaxlisans07012026.pdf) | `47ddb7205cdb24ba360333f0416e96ee7298428356bab3b42c5de5622e997970` | 990 | 0 | 0 | 0 | 0 | 0 | ACCESS_BLOCKED |
| 2025/2 | Önlisans | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2025/KPSS/TERCIH2/minmaxonl07012026.pdf) | `21c1ac61b2cd3fd743718977376d2030dfa0dcd16dc58d763f12f277381cd919` | 570 | 0 | 0 | 0 | 0 | 0 | ACCESS_BLOCKED |
| 2025/2 | Ortaöğretim | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2025/KPSS/TERCIH2/minmaxort07012025.pdf) | `8da522dfd7474030a6c1bac0251ecdc6209fb60f9d9600390eff08869e1ffc2b` | 248 | 0 | 0 | 0 | 0 | 0 | ACCESS_BLOCKED |
| 2026/1 | Lisans | [PDF](https://dokuman.osym.gov.tr/web/2026/7/kpss-20261-yerlestirme-sonuclarina-liskin-en-kucuk-ve-en-buyuk-puanlar-lsans-24q42vum.pdf) | `920a9597eb645a4a8fe96c79d21f3dc25baa36b9a4fea338ae6335df300efc8c` | 555 | 0 | 0 | 0 | 0 | 0 | ACCESS_BLOCKED |
| 2026/1 | Önlisans | [PDF](https://dokuman.osym.gov.tr/web/2026/7/kpss-20261-yerlestirme-sonuclarina-liskin-en-kucuk-ve-en-buyuk-puanlar-on-lsans-24zbk8tg.pdf) | `a3c1a300af32dc26b60c4c9ff2caf95a2738bb3ea2d8125ad8aacb54db4a36c1` | 410 | 0 | 0 | 0 | 0 | 0 | ACCESS_BLOCKED |
| 2026/1 | Ortaöğretim | [PDF](https://dokuman.osym.gov.tr/web/2026/7/kpss-20261-yerlestirme-sonuclarina-liskin-en-kucuk-ve-en-buyuk-puanlar-ortaogretm-2477sk0t.pdf) | `7082ee582542d31cfa3ff5a67c3cb1fceb5a1a1ea7d4b477b6b39fb0b35c0ae2` | 141 | 0 | 0 | 0 | 0 | 0 | ACCESS_BLOCKED |

## Güvenli operatör aracı

- `infra/prepare-osym-production.py`: DB'ye hiç bağlanmadan gerçek belgeleri tekrar parse eder, SHA/index/header/sayım doğrular. Özel satırlar ve dosya yolları `.local/osym-production/verified-sources.json` içinde kalır. Aynı kaynaklar tekrar hazırlanınca satır üretilmez/çoğaltılmaz. `--catalog` ayrı gerçek indirme kataloğunu destekler.
- `infra/osym-production.ps1`: URL ve admin parolasını `Read-Host -AsSecureString` ile ister. Host/port/database açıkça gösterilir; tam URL gösterilmez. Değerler sadece alt süreç ortamında kullanılır, sonunda önceki env geri yüklenir. Windows'ta özel çalışma/backup klasörünün ACL'si mevcut kullanıcıyla sınırlanır. Shell transkriptine veya sohbet çıktısına secret yapıştırmayın.
- `infra/osym-production.cjs`: `.env` fallback'i yoktur. Yalnızca açıkça verilen dpg-*.render.com External host,5432 ve aynı database hedefini kabul eder. Prisma TLS `sslmode=require&sslaccept=strict`; pg_dump `verify-full` ve CA doğrulaması kullanır. Cert hatasında kontrol kapatılmaz. `--isolated` yalnızca loopback ve `kadroradar_ingestion_test_*` DB'lerini kabul eder; production hedefini geçiremez.

Preflight SQL'leri READ ONLY transaction'dadır: PostgreSQL16,15 migration'ın bitiş/rollback/checksum bilgisi, Decimal(8,5), kaynak/staging/onay/ilan sayıları ve kritik tabloların hash'leri kontrol edilir. LF/CRLF dışında SQL değişikliğine tolerans verilmez. Pending/farklı migration varsa durur; migrate/reset/db push çalıştırmaz. Yeni migration bu görev için gerekmiyor. Önceki Gazete migration'ı dahil15 SQL'in gerçek hedefte farklı olması halinde **ayrı migration onayı** gerekir.

### Yedek ve geri yükleme

`backup` bütün DB'yi PostgreSQL16 pg_dump custom formatıyla **yerel özel klasöre** dışa aktarır. Ardından benzersiz adlı tmpfs PostgreSQL container'ına `pg_restore --no-owner --no-acl --exit-on-error` ile geri yükler. Kritik tabloların sayı/hash'leri ve migration sayısı kaynağın önceki/sonraki durumu ile eşleşmelidir. Kaynak değişmişse veya restore başarısızsa yazma yapılmaz. Yalnızca oluşturulan doğrulanmış isimli test container'ı kaldırılır; production'a restore, drop veya reset yapılmaz.

Doğrulanan dump SHA'sı/hedefi/zamanı özel `backup-receipt.json` dosyasına kaydedilir. Yazma öncesi hedef, dump hash'i ve24 saatlik geçerlilik yeniden kontrol edilir. Yanlış hedef, eksik yedek, bozuk dump veya eski doğrulama yazmayı engeller. DB parolası docker komut argümanına konmaz; isimle aktarılan geçici PG ortam değişkenlerindedir. Gerçek Render TLS/external bağlantısı bu oturumda denenmedi; local restore testi bunu kanıtlamaz.

Render Free PostgreSQL1GB ve30 gün sınırındadır; süreden sonra14 günlük yükseltme aralığı ardından veri silinir. Platform yedekleme desteği yoktur. Free web servisinde yerel dosyalar restart/deploy/uykuda kaybolur; dump orada saklanmaz. Bu bilgiler güncel [Render Free dokümanından](https://render.com/docs/free#free-postgres) kontrol edildi. Prisma6 TLS'nin strict seçeneği [resmî connector dokümanında](https://www.prisma.io/docs/orm/v6/overview/databases/postgresql#configuring-an-ssl-connection) açıklanır.

**Production yedeği alınmadı.** Docker, ağ, CA veya izin sorunu yüzünden gerçek yedek/restore doğrulanamıyorsa araç durur. Yedeksiz yazma için otomatik geçiş veya risk kabul bayrağı yoktur; kullanıcıdan bu somut risk için ayrı onay alınmadan devam edilmez. Dump hassas kullanıcı verileri içerebilir; Git'e/sohbete yüklenmez, ayrıca güvenli ikinci kopya ve saklama planı işletmeci tarafından belirlenir.

### Staging, pilot ve yayın

Yazma aşamalarında hedefe özgü `HOST/DATABASE ADD VERIFIED OSYM` teyidi ve **mevcut SYSTEM_ADMIN hesabı** gerekir. Varsayılan hesap/parola oluşturulmaz. Gerçek login API oturumu açılır; token'ın aynı DB'deki hash'li session kaydı ve rolü kontrol edilir. Sadece araca ait session sonunda kaldırılır; diğer oturumlar veya push rızası değiştirilmez.

`pilot` yalnızca504 lisans satırını mevcut SourceDocument/PlacementRound/ImportBatch/ImportRow/HistoricalPlacement/ReviewAudit modellerine ekler. `approvedAt` yazmaz. Üretim araç kodunda approvedAt güncellemesi yoktur. Kaynak SHA advisory lock'u, create-only kayıtlar, doğal unique constraint ve tam satır karşılaştırması kullanılır. Mevcut ilan/yerleştirme/kaynak güncellenmez; farklı bir belgeyle aynı kadro kodu varsa otomatik overwrite/merge yapılmadan durur.

`publish-pilot` kaynak, eğitim/dönem, tüm kadro kodları, kurum/unvan/şehir, kontenjan/yerleşen/boş, min/max Decimal ve raw satırları staging ile tekrar karşılaştırır. Başarılıysa **mevcut** `/admin/imports/:id/approve` endpoint'ine gerçek oturum ve504 teyidi gönderir. Onay/audit, API'nin mevcut transaction'ı tarafından yapılır. Sonrasında:

https://kadroradar.onrender.com/api/v1/historical/placements?educationLevel=BACHELOR&year=2024&round=1&limit=1

sorgusunun toplamı DB onaylı sayısı ve504 ile eşleşmelidir. Pilot geçmeden `remaining` çalışmaz. Kalan20 belge ayrı transaction ve admin onaylarıyla işlenir. Başarısız partide sonraki partilere geçilmez; tamamlananlar korunur. Tekrar çalıştırma SHA/batch/satır/audit karşılaştırması yapar; zaten onaylı partiyi yeniden onaylamaz. Belirsiz HTTP yazma yanıtı otomatik tekrarlanmaz; önce dry-run/kalite ile DB durumu okunur.

Her başlangıç/başarı/hata `.local/osym-production/operations.jsonl` içinde hedef, zaman, kaynak, batch, duplicate ve sayılarla kaydedilir; hata türü dışında ham DB hata/secret loglanmaz. Gerçek veritabanındaki STAGED/APPROVE audit kayıtları asıl kanıttır. Announcement akışına veri yazılmaz.

### Sıralı PowerShell komutları

Proje kökünde çalıştırın. Bu komutlar hazırlanmıştır; gerçek hedefte burada çalıştırılmadı. Secret her operatör adımında gizli prompt'tan alınır. Docker Desktop, Node22, pnpm ve mevcut Python parser bağımlılıkları gerekir.

```powershell
Set-Location C:\projects\KadroRadar
python infra/prepare-osym-production.py
pnpm --filter @kadro/api prisma:generate
pnpm --filter @kadro/api build
.\infra\osym-production.ps1 -Action preflight
.\infra\osym-production.ps1 -Action backup
.\infra\osym-production.ps1 -Action dry-run
.\infra\osym-production.ps1 -Action pilot
# Özel staging/dry-run raporunu kontrol edin; pilot henüz public değildir.
.\infra\osym-production.ps1 -Action dry-run
.\infra\osym-production.ps1 -Action publish-pilot
.\infra\osym-production.ps1 -Action remaining
.\infra\osym-production.ps1 -Action verify
```

`preflight` host/db/port ve migration durumunu gerçek bağlantıyla teyit etmeden sonraki aşamaya geçilmez. Source cache kaybolmuşsa sayısal hedef için veri üretmeyin; yedi dönemi mevcut `osym_archive.py` ile ayrı yerel destination'a resmî arşivden yeniden keşfedin/indirin, ardından `prepare-osym-production.py --catalog .../catalog.json` kullanın. Doğrulanmamış veya eksik kaynakta hazırlayıcı durur.

`verify`, her belge için public/DB sayı eşitliği, resmî kaynak URL'si, eğitim/yıl/dönem, kadro kodu, şehir, kurum, unvan, puan eşitliği filtresi ve ikinci sayfayı kontrol eder. Production HTTP istekleri650ms arayla yapılır;429 veya başka hata durumunda durur, kontrol aşılmaz. Backend'in yeni kadro kodu filtresi deploy edilmemişse doğrulama başarısız olabilir; yayımlanmış pilotu silerek düzeltme yapılmaz.

## Mobil sözleşme ve kod değişiklikleri

- `apps/api/src/module.ts`: tam9 haneli `positionCode` filtresi ve doğrulaması; `SECONDARY` sorgu alias'ı mevcut HIGH_SCHOOL değerine eşlenir. DB'deki eski kayıtların eğitim değeri değiştirilmez. Response HIGH_SCHOOL kalır; mevcut mobil bu değeri kullanır. Lisans/P3, önlisans/P93, ortaöğretim/P94 yalnızca bu merkezi tarihsel bağlamdadır; özel ilanlar için çıkarım yoktur.
- `apps/mobile/lib/historical-api.ts` ve `app/historical.tsx`: dönem/list isteklerine15sn timeout, abort temizliği, geçersiz response kontrolü ve açık API yapılandırma hatası eklendi. Loading/retry/boş liste/sayfalama sözleşmesi test edildi. SDK54 ve `com.kadroradar.app` korundu.
- `infra/prepare-osym-production.py`, `osym-production.cjs`, `osym-production.ps1`, `test-osym-production.cjs`;21 kaynak envanteri; mobil ağ testi ve CI kontrolü eklendi.

Gerçek Android cihaz testi0; EAS build/deployment0. Mevcut APK otomatik güncellenmedi. Yeni APK/AAB için gerçek production API env'iyle yeni EAS build gerekir. Gerçek gizlilik/hesap silme/destek env'leri mevcut release kurallarına göre sağlanmalıdır; uydurulmaz. API örneği:

```powershell
$env:EXPO_PUBLIC_API_URL='https://kadroradar.onrender.com/api/v1'
# Mevcut Expo/EAS kurulumu ve gerekli diğer gerçek release env'leriyle yeni build alın.
```

## İzole test sonucu — production değildir

`infra/test-osym-production.cjs` kendi tmpfs PostgreSQL16 container'ını ve loopback API'sini kurar; production env veya kullanıcı journal'ına erişmez.15 migration sadece bu yeni DB'ye uygulanır.

- 21 gerçek kaynak /8.611 satır; tam parse/metadata/SHA karşılaştırması.
- Dry-run0 DB yazımı; yedek yokken ve dump hash'i bozulduğunda pilot reddi.
- Gerçek pg_dump → ayrı container'da pg_restore → schema/kritik veri sayısı+hash doğrulaması PASS.
- 504 kayıt önce staging,0 onay; sonra gerçek test login/role ve mevcut API onayıyla504 public.
- Kalan20 belge sonrası8.611 onaylı test kaydı; lisans4.797, önlisans2.974, ortaöğretim840;21 round kombinasyonu.
- İlk504'ün id/puan/raw/onay dahil tüm alanları korunur. Yeniden importta kritik tablolarda **tam hash/sayı eşitliği**; mükerrer satır veya ek onay audit'i yok.
- 21 STAGED ve21 APPROVE audit; Announcement0 ve korunmuş.
- Üç eğitim/yıl/dönem, kurum/şehir/unvan, kadro kodu, puan karşılaştırması, kaynak URL ve SECONDARY alias kontrolleri PASS. Mobil ağ testleri ve TypeScript PASS.

Özel sonuç: `.local/osym-production/isolated-test.json`. Yerel test dump ve günlükleri `.local/osym-production-tests/` altındadır; gerçek production yedeği gibi kullanılamaz. Production migration/DB erişimi, production veri yazımı, production admin audit ve gerçek cihaz testi **0**.

## Kalan somut engeller

1. Render External bağlantısı ve mevcut admin hesabı bu ortamda yok. URL/parolayı sohbete göndermek yerine güvenli yerel betiğin prompt'larını kullanın.
2. Gerçek hedefte salt okunur preflight ve gerçek dump/restore doğrulaması yapılmalı;15 migration farklıysa yeni yazma öncesi ayrı migration onayı gerekir.
3. Yeni API kadro kodu/alias ve mobil timeout kodu henüz GitHub/Render/EAS'a gönderilmedi. Gazete değişiklikleri korunarak release hazırlığı yapılmalı; otomatik deployment yapılmadı.
4. Free DB'nin30 günlük ömrü ve platform yedekleme eksikliği için kalıcı hosting/bağımsız yedek planı gerekir.

Production aktarımının tamamlandığı iddia edilmez. Bu teslimat, doğrulanmış21 kaynak, gerçekten test edilmiş add-only import/onay/verification aracı ve mevcut canlı API'nin dürüst salt okunur durum raporudur.
