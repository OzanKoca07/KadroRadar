# Kamu ilanı indeksleme politikası

26 Ekim 2026. Kullanıcının belirlediği kapsam: doğrulanmış olgusal alanlar ve orijinal resmî bağlantılar. Tam PDF/HTML/metin yayımı bu kapsamda değildir. İndeksleme ile belge yeniden yayımını eşitleyen önceki rapor ifadelerinin yerine bu değerlendirme geçer.

## Üç ayrı karar

1. **Erişim:** Kaynak hangi sayfa/feed/API için otomatik okumaya elverişli? Yayınlanmış şartlar, robots, auth, HTTP engelleri ve teknik sözleşme kaynak bazında değerlendirilir. Site herkese açık diye erişim koşulları atlanmaz; belirsiz diye yasak sonucu da çıkarılmaz.
2. **İndeksleme:** Kurum, başlık, kadro, kontenjan, şehir, eğitim/KPSS türü/puanı, tarih ve URL gibi kaynaktan doğrulanmış temel bilgiler sunulur. Genel bir ön izin zorunluluğu varsayılmaz. Kaynağın bu kullanıma ilişkin somut şartları varsa ayrıca değerlendirilir.
3. **Belge yayımı:** Ham PDF/HTML, uzun parser gövdesi, tam metin ve kaynak alıntıları otomatik halka açılmaz. Tam belge yeniden yayımının ayrı koşulları indekslemenin otomatik ön şartı yapılmaz.

`indexingPolicy.automatedAccess` ALLOWED / REVIEW_REQUIRED / DISALLOWED değerlerini ayırır. REVIEW_REQUIRED, eksik değerlendirmedir; hukuken yasak tespiti değildir. DISALLOWED ancak somut otomasyon kısıtını ifade eder. 403 teknik erişim engelidir, tüm olgusal bilginin kullanımına ilişkin genel hukuki sonuç değildir. Manuel editör incelemesi ve resmî link yolu korunur.

## Kaynak bazında güncel değerlendirme

| Kaynak | Erişim sonucu / kapsam | İndeksleme ve bağlantı | Tam belge |
|---|---|---|---|
| Enerji Bakanlığı | **ALLOWED — yalnızca ilan edilmiş RSS feed'i**. [RSS açıklaması](https://enerji.gov.tr/rss) içerik takibini açıkça sunuyor. [Robots](https://enerji.gov.tr/robots.txt) genel tarayıcı grubunda RSS yolunu dışlamıyor | Feed'deki doğrulanabilir temel alanlar + gerçek detay linki; link eksikse inceleme, feed URL'sini ilan URL'si yapma yok | Otomatik yayın kapalı |
| Resmî Gazete | REVIEW_REQUIRED. Önceki doğrudan gerçek indirmeler var; son web kontrolünde timeout. Site şartları/otomatik erişim yöntemi tam doğrulanmadı | Mevcut manuel belge → editör → olgusal kayıt/resmî link yolu | Otomatik yayın kapalı |
| SBB | REVIEW_REQUIRED; son açık sayfa kontrolü403. Engel aşılmadı | Yetkili/izinli manuel materyal ve resmî link. 403 nedeniyle genel kullanım yasağı varsayılmaz | Otomatik yayın kapalı |
| Kariyer Kapısı | REVIEW_REQUIRED. Açık liste/filtre kabuğu var; otomatik veri sözleşmesi/site koşulları henüz tam değerlendirilmedi | Resmî bağlantı + manuel inceleme; login/CAPTCHA aşılmaz | Otomatik yayın kapalı |
| İŞKUR | REVIEW_REQUIRED. Açık kurumsal/e-şube giriş sayfaları var; iş ilanı otomatik erişim sözleşmesi belirsiz | Resmî bağlantı + manuel inceleme; kullanıcı oturumu taklit edilmez | Otomatik yayın kapalı |
| Diğer kurumlar | Kaynak ve exact-host bazında ayrı değerlendirme | Kurum adı otomatik izin/yasak veya şart doğrulaması değildir | Otomatik yayın kapalı |

Enerji robots dosyası `/uploads`, `/File`, `/file`, `/duyurular` gibi yolları ayrıca dışlıyor. RSS için yapılan değerlendirme bu yollara veya keyfî detay belge taramasına genişletilmez. Robots bir içerik yeniden yayım lisansı değildir. RSS sunumu da tam metnin kopyalanmasına genel izin olarak yorumlanmaz. “Tüm hakları saklıdır” altbilgisi tek başına olgusal indeksleme yasağı diye yorumlanmaz; somut koşullar ayrı incelenir.

## Kodda uygulanan sınırlar

- `packages/official-sources.json`: ayrı indexingPolicy, dayanak URL ve kapsam. Legacy republicationPermission sadece tam belge değerlendirmesi olarak tutulur; scheduler şartı değildir. Tüm `enabled=false` değerleri korundu.
- `source-indexing-policy.ts` / `source-adapter-contract.ts`: erişim değerlendirmesi, desteklenen adaptör ve operatör aktivasyonu ayrıdır. Erişim uygun olsa bile teknik adaptör veya aktivasyon yoksa koşu başlamaz. RSS canlı yolu mevcut; diğer adaptörlerin manuel kapsamı değişmedi.
- `source-operations.ts`: kaynağa özel asgari kontrol aralığı. Şimdilik3600sn uygulama tercihi; kaynağın yayınladığı kota olduğu iddia edilmez. Hata backoff'u bu aralıktan kısa olmaz. Bir kaynak hatası diğerini durdurmaz.
- `official_rss.py`: her canlı RSS kontrolünden önce robots okunur. Disallow,403,429,redirect veya HTML challenge'da durur; aşma/alternatif agent/ani retry yok. Robots404, “yayımlanmış kural yok” olarak kaydedilir; ayrı site erişim değerlendirmesinin yerine geçmez. TLS ve registered-host kontrolleri korunur.
- `public-announcement.ts`: public liste/detay ve kullanıcı favorilerinde aynı olgusal çıktı. `summary`, uzun `requirements`, `dateEvidence/dateSuggestions.text`, kadro alıntıları ve serbest kaynak metinleri çıkartılır. Yapılandırılmış şartlar, doğrulama/hash/konum metadata'sı, ilan/başvuru ve ek resmî kaynak URL'leri korunur. Çıkarılan serbest koşul varsa tam uygunluk ima edilmez.
- Eşleştirme motoru ek koşulları UNKNOWN tutar ve ham metni cevaba kopyalamaz. Sonuç açıklaması kullanıcıyı asıl kaynağa yönlendirir. Uzatma/iptal bildirimleri için gereken `updatedAt` korunur.
- Admin ham belge dosyaları mevcut RBAC/session/CSRF, SHA, kota/retention altında özel kalır. Public dosya servisi eklenmedi.
- Mobil detay temel alanları gösterir; tam metin veya belirsiz tarih alıntısı basmaz. Orijinal duyuru/başvuru ve diğer resmî kaynak bağlantıları görünür; bağımsızlık açıklaması korunur.

## Doğrulama ve production sınırı

Yeni politika testi erişim değerlendirmesi ALLOWED ve operatör enabled olduğunda, tam belge yeniden yayımı UNVERIFIED olsa da olgusal indeksleme kapısının geçilebildiğini doğrular. Unknown kaynak REVIEW_REQUIRED kalır; açık yasak reddedilir. Bunlar izole testlerdir; dosyadaki hiçbir kaynak etkinleştirilmez.

Public liste, detay ve favorilere özel tam metin işareti enjekte edilerek çıktıda bulunmadığı test edildi; veritabanındaki ham/admin verisi silinmedi. SHA, resmî link, KPSS/kontenjan ve değişiklik zaman damgası korunur. İlk regresyon uzatma bildiriminin updatedAt alanını kaybettiğini yakaladı; alan korunarak düzeltildi.

RSS fixture testleri robots izin/yasak, HTML challenge ve403/429/redirect için durmayı kapsar; bu testler canlı indirme değildir. Önceki gerçek PDF2 ilan/20 kadro zinciri tekrar izole testtedir. Bu görevde production yazımı/migration/deployment/otomasyon aktivasyonu yok. 504 eski ÖSYM verisi ve21 belge/8611 kaynak envanteri korunur;8611 production'a aktarılmış değildir.

Gerçek günlük operasyonu açmak ayrı production aktivasyon onayına bağlı kalır. Bu onay, her kaynak için genel bir hukuki izin zorunluluğu olarak sunulmaz; kullanıcının mevcut operasyon güvenliği talebidir.

Son test sonucu:16 izole PostgreSQL test grubu PASS; eski504 kaydın tam snapshot'ı korundu. Gerçek Gazete2 ilan/20 kadro, duplicate, onay/public API, favoriler, uzatma/iptal, RBAC ve bağımsız worker regresyonları geçti. RSS12 ve adaptör3 birim testi PASS; API/admin build ve mobil TypeScript PASS. Secret taraması490 nesne/dosya,0 bulgu; diff whitespace kontrolü PASS. Kanıt `.local/daily-operation/test-report.json`. Bu görevde production aktarımı, canlı scheduler koşusu, yeni ilan PDF indirmesi ve gerçek cihaz testi0. Önceki ÖSYM21 kaynak envanteri ve operatör dosyaları bu politika düzeltmesinde değiştirilmedi.
