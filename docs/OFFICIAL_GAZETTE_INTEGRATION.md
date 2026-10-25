# Resmî Gazete PDF entegrasyonu — 25 Ekim 2026

RC1 güncellemesi: aşağıdaki ilk teslimatın OCR/browser/Docker sınırlamaları daha sonra giderildi. Gerçek motorla16sayfa OCR,21admin browser kontrolü ve production image/runtime testi için güncel kanıt [RC1_RELEASE_REPORT.md](RC1_RELEASE_REPORT.md) ve [işletim kılavuzu](RC1_DEPLOYMENT_RUNBOOK.md) içindedir. Canlı Gazette otomasyon izni ve gerçek cihaz sınırlamaları devam eder.

## Gerçek dosya ve sonuç

Kullanıcının verdiği `resmi gazete.pdf` doğrudan okundu; orijinal dosya değiştirilmedi. Dosya boyutu38.526.722 bayt; sayfa140; tarih24.09.2026; sayı33380. SHA-256: `050f756d5475090556dc4981709a760fd9776d1589584b902506de4486300dca`.

85 ve90. sayfalar render edilerek görsel incelendi. Parser140 sayfanın tamamını kontrol etti;6 personel ilanı adayı,12 öneri kadro satırı çıkardı. Bunların tamamının doğru olduğu iddia edilmiyor: hedef iki ilanda9 kadro satırı orijinal tabloyla karşılaştırıldı. Diğer adaylar ve eksik tablo kapsaması insan incelemesi gerektirir.

| Hedef | Kaynak | Doğrulanan alanlar |
| --- | --- | --- |
| Niğde Ömer Halisdemir Üniversitesi | Sayfa85–89 | 8 ayrı kadro satırı;20 destek+9 sağlık teknikeri=29;P94/P93;taban60;sınav2024. Kaynak metinde başvuru24.09.2026 09:00–09.10.2026 13:00 Türkiye saati; Kariyer Kapısı adresi açıkça basılı |
| Atalan Belediyesi | Sayfa90–92 | 1 tekniker;P93;en az60;önlisans bölüm adları ve B ehliyet koşulu. Bölüm eşdeğerlik kodları üretilmedi. Tarih aralığı23–27 Ekim kaynak önerisi olarak saklandı; elektronik ve şahsen başvuru saatleri farklı/belirsiz olduğundan kesin datetime veya HTTPS başvuru URL'si üretilmedi |

16 sayfa inceleme/OCR işaretli:1–8,21–23,62–63,72–73,140. İlk uygulama sadece sıralı metni kontrol ettiğinden4 sayfa işaretlemişti. Gerçek PDF testi ilk sayfadaki hatayı yakaladı; PyMuPDF sıralamasının gizlediği kontrol karakterleri ham metinde de denetlenerek düzeltildi. Bu önceki başarısız test rapordan saklanmadı.

## Veri akışı ve dosyalar

`services/ingest/official_gazette.py`: bounded yerel PDF parserı. PDF imzası, boyut64MiB, sayfa600 sınırı, şifreleme, tamir işareti, SHA, tarih/sayı konsensüsü, kurum başlığı, çok sayfalı birleştirme ve tablo hücreleri incelenir. Metin bozukluğu ve görüntü/OCR ihtiyacı sessizce atlanmaz. İhale/mahkeme sınıflandırması ve iptal/düzeltme işaretleri ayrı tutulur; genel şarttaki iptal hakkı cümlesi iptal duyurusu sayılmaz. Her pozisyonun table/row/page ve kaynak hücre metni saklanır. Güven puanı heuristiktir, olasılık değildir.

`discover_index` yalnızca sağlanan HTML'de fiilen görülen aynı-host HTTPS bağlantılarını çıkarır. Tarihli URL, PDF/HTML ve mükerrer etiketi gözlenen linkten okunur; endpoint veya yayınlanmayan gün uydurulmaz. Bu fonksiyon fetch veya izin kanıtı değildir.

`apps/api/src/gazette.ts`: production session/RBAC guard upload'dan önce çalışır; bir process'te aynı anda1 PDF; parser child process60sn/16MiB çıktı sınırı, shell kullanılmaz. Dosyalar SHA adıyla özel dizinde0600 moduyla tutulur; dosya adından path oluşturulmaz. Toplam1GiB yerel kota. Varsayılan30gün (1–90 arası) fiziksel retention;6saatlik ve yükleme öncesi temizlik, saatlik eski temp temizliği. Yalnızca bu modülün kontrollü isimlerindeki dosyalar silinir. Source/audit kanıtları dosya silinse de korunur; audit saklama politikasını işletmeci ayrıca belirlemelidir.

Mevcut SourceDocument kullanılır; yeni paralel ilan DB/API yoktur. SourceDocument ile AnnouncementImportRow ilişkisi kuruldu. SHA/kurum/ilan/sayfa kimliği aynı PDF'de idempotency sağlar. `sourceUrl` doğrulanmadığında public alanda null olabilir; URN staging kimliği resmî URL gibi sunulmaz. Yayın tarihinden başvuru başlangıcı türetilmez.

`announcement-admin.ts`: PDF onayı için belge, kadrolar ve uyarıların açık teyidi ile evidence gerekir. Kadro şartları eksik olduğu sürece complete=false ve bölüm kodları doğrulanmamış kalır; uygunluk UNKNOWN olur. İç içe koşulların onaydan sonra değiştirilmesi yayın sırasında reddedilir. Düzeltme/iptal adayları yeni işe alım ilanı olarak otomatik yayımlanamaz.

Çapraz kaynak: aynı ilan olduğu reviewer tarafından kanıtlarla teyit edilirse `/admin/announcement-imports/:id/link` ikinci kaynağı mevcut Announcement'a bağlar. Başlık benzerliğiyle otomatik birleştirme yapılmaz. Bağlanan satırın tekrar yeni ilan olarak yayımlanması engellenir. RSS ve kurum sitesiyle otomatik fuzzy eşleştirme yoktur. Eşleştirme mekanizması ayrı, açıkça sentetik bir ikinci-kaynak testiyle doğrulandı; gerçek ikinci site yayını bulunduğu iddia edilmiyor.

Admin bileşenleri `GazetteUpload.tsx` ve `AnnouncementReview.tsx`: seçme, yükleme, metrikler, sayfa önizleme, kaynak dosyasına yetkili erişim, alan/kadro JSON düzenleme, inceleme teyidi ve mevcut review/publish. UI build test edildi; tarayıcıda tıklama veya cihaz QA yapılmadı.

Mobil mevcut `/announcements` sözleşmesini kullanır; sayı/tarih/sayfa/SHA ve kesinleşmemiş tarih önerileri gösterilir. Doğrulanmış resmî bağlantı yoksa bağlantı uydurulmaz. Niğde süresi bitmiş arşiv kaydıdır. Atalan'ın datetime'ı bilinmediği için otomatik OPEN sayılmaz. Ekran metadata sözleşmesi HTTP testinde doğrulandı; Android cihazda yeni veriyi gösterme testi yapılmadı.

## Endpoint ve migration

- GET/POST `/api/v1/admin/gazette-documents`: liste / multipart `file` upload. Upload CONTENT_EDITOR veya SYSTEM_ADMIN; preview REVIEWER'a da açık.
- GET `/api/v1/admin/gazette-documents/:id/file`: özel PDF preview; halka açık dağıtım yok.
- DELETE aynı file rotası: SYSTEM_ADMIN, yalnızca dosyayı kaldırır.
- POST `/api/v1/admin/announcement-imports/:id/link`: reviewer'ın doğrulanmış çapraz kaynak bağlantısı.
- PATCH `/api/v1/admin/announcement-imports/:id`: version kontrollü editör taslak düzeltmesi; eski onayı geçersiz kılar. Parser'ın kaçırdığı satır `parserPositionKey=manual:benzersiz-kod`, belge sayfa aralığı içindeki sourceEvidence.page ve gerçek kaynak alıntısı ile eklenebilir. Kadro toplamı ile ilan kontenjanı tutarlı olmalıdır.
- Mevcut review/publish/public endpoint'ler kullanılır.

Migration `202610250006_gazette_evidence`: kaynak kanıtı JSON, staging→SourceDocument FK; Announcement/Position sourceUrl nullable. `202610250007_announcement_source_references`: mevcut ilana birden fazla kaynak kanıtı ilişkilendiren tablo. Eski ÖSYM tablolarını değiştirmez ve veri silmez. SQL incelendi ve yalnızca izole test DB'ye uygulandı. Gerçek DB migrationı/yazımı yapılmadı; önce doğrulanmış yedek ve açık izin gerekir.

## Test kanıtı

Gerçek PDF testi: `GAZETTE_REAL_PDF` gerçek dosya yoluyken Python testleri14/14 geçti (HTML keşfi, OCR hata yolu, şifreli/bozuk/boyut limitli PDF dahil). Node `test-gazette.cjs` gerçek multipart/Prisma/HTTP üzerinden140 sayfa,6 aday,ilk çalışmada6 yeni staging,ikinci çalışmada6 duplicate;2 hedefin simüle onay/yayını ve9 public kadro satırını doğruladı. Özel dosya endpoint'inin auth koruması, USER403, bozuk dosya400, reviewer teyidi, nested-condition değişikliğinin reddi, UNKNOWN uygunluk ve public mobil sözleşme kapsanır. İzole testin kaynak dosyası sonrasında kaldırılır; orijinal kullanıcı PDF'si korunur.

`test-gazette.cjs` gerçek dosya yolu verilmezse açıkça sentetik iki sayfalık PDF üretir. CI sentetik akışı çalıştırır; gerçek PDF repoya kopyalanmaz ve gerçek test yokken SKIPPED olarak ayrılır. OCR motoru/test cihazı mevcut değildir; OCR koşusu yapılmadı. CLI `--ocr-pages 1,2` yalnızca işaretli sayfaları ve en fazla10 sayfayı Tesseract tur+eng ile işler; motor yoksa OCR_UNAVAILABLE, varsa bile insan incelemesi zorunludur.

## Canlı kaynak ve production

https://www.resmigazete.gov.tr/ araştırma erişimi timeout verdi. Tarihli HTML ve robots.txt erişimi doğrulanamadı. Günlük resmî PDF linki, arşiv/ilan arama davranışı, mükerrer numaralama ve yayın yapılmayan gün protokolü bu oturumda resmî sayfa üzerinden doğrulanamadı. Belgelenmiş API, sürekli indirme ve yeniden dağıtma izni UNVERIFIED. Kaynak registry etkinleştirilmedi; canlı scheduler kapalı. Yerel dosyanın okunması canlı site indirme başarısı değildir.

Docker runtime'a Python venv/PyMuPDF ve kalıcı özel PDF volume eklendi; CPU/RAM/PID sınırları ve proxy body limiti hazırlandı. Bu yeni Dockerfile'ın image build/deploy doğrulaması yapılmadı. HTTPS domain/hosting, OCR motoru/dil dosyaları, gerçek cihaz ve AAB dış/ortam bağımlılıklarıdır.

## PowerShell

```powershell
$env:GAZETTE_REAL_PDF='C:\path\resmi gazete.pdf'
python services/ingest/official_gazette.py $env:GAZETTE_REAL_PDF
python -m unittest discover -s services/ingest -p test_official_gazette.py -v
# DATABASE_URL sadece ayrı kadroradar_ingestion_test_* DB olmalı
pnpm --filter @kadro/api exec prisma migrate deploy
pnpm --filter @kadro/api build
Set-Location apps/api
node test-gazette.cjs
```

Production yazımı0; gerçek siteden otomatik indirilen PDF0; yerel gerçek PDF1; gerçek cihaz doğrulaması0. Tamamlanmış sayılabilecek kısım yerel PDF→özel yükleme→staging→inceleme→public sözleşme kodu ve izole entegrasyon testidir.
