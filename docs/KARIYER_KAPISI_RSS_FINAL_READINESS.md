# Kariyer Kapısı RSS entegrasyonu ve release hazırlığı

Güncel Docker/release kontrolü: [RELEASE_DEPLOYMENT_FINAL_CHECK.md](RELEASE_DEPLOYMENT_FINAL_CHECK.md). Aşağıdaki sonuçlar önceki sprintin tarihsel kaydıdır.
Sonraki doğrulama: [Son release adayı](KADRORADAR_RELEASE_CANDIDATE_FINAL.md). Gerçek XML daha sonra sağlandı ve çevrimdışı/izole testleri geçti. Aşağıdaki dosya eksikliği ve Docker sonuçları önceki sprint anına aittir; güncel cold-build ve ayrı runtime testi sonucu yeni rapordadır.

29 Ekim 2026, Europe/Istanbul. Kaynak adaptörü, metadata staging, admin incelemesi ve mobil sunum kodu geliştirildi. **Gerçek XML dosyası sağlanmadığı ve mobil/otomatik/ticari kullanım kapsamı doğrulanmadığı için canlı içerik pilotu tamamlanmadı.** Aşağıdaki testler bu sınırı kaldırmaz.

## 1. Mevcut kod ve Git durumu

Dal `feature/announcements-core`, HEAD `0d7c0d0e3f8016a2bcf0fa58fb5a42d8d2d81147`. Önceki UX/auth, admin, backup, ÖSYM operatör ve source-policy değişiklikleri başlangıçta incelendi ve korundu. Yeni commit, push veya deployment yapılmadı. Çalışma ağacı önceki sprintleri de içerdiğinden tüm diff bu görevin ürünü değildir.

ÖSYM kaynak envanteri SHA-256 değişmedi: `537925DDC543BE424C2FFCFBACA4F3A8DDA9992373D02F152EC0661E354BA4AE`. Prisma şeması ve mevcut 15 migration değiştirilmedi. Yerel 504 kaydın bulunduğu veritabanına migration/import yapılmadı; production veritabanına bağlantı kurulmadı. Yalnızca public HTTPS GET kontrolleri yapıldı.

## 2. Gerçek XML bulguları

[Resmî RSS adresi](https://kariyerkapisi.gov.tr/RSS) için doğrulanmış ağ bulgusu: HTTP **200**, `Content-Type: application/xml; charset=utf-8`. Başlıklar okunduktan sonra bağlantı kapatıldı; XML gövdesi okunmadı/kaydedilmedi. TLS doğrulaması açık, redirect takibi kapalıydı. `/robots.txt` HTTP 404 döndü; bu bir lisans veya otomatik kullanım izni değildir.

Kullanıcının bahsettiği gerçek XML dosyası bu görevde eklenmedi ve sağlanan PDF ile aynı Masaüstü klasöründe `.xml`/`.rss` dosyası bulunmadı. Gerçek GUID biçimi, ilan link yolları, kurum adının hangi alanda yer aldığı, kategori dağılımı, ETag/Last-Modified desteği veya feed'in iptal davranışı doğrulanmış değildir. Bunları varsayımsal canlı bulgu olarak raporlamıyoruz.

`services/ingest/fixtures/career-synthetic.xml` açıkça **SYNTHETIC CONTRACT FIXTURE** olarak işaretlidir. Sözleşmeli personel, kurum içi yükselme, merkezi yerleştirme ve eğitim için dört sentetik item içerir; gerçek ilan değildir. Kullanıcının verdiği alan sözleşmesini sınar. Kurum adını başlık ayıracından veya serbest description metninden tahmin etmez.

## 3. Resmî RSS Tasarım Kılavuzu uyumu

Sağlanan dört sayfalık PDF'nin tamamı metin ve render görüntüleri üzerinden incelendi. SHA-256: `59d7533801849181fc28ee0c405e2e4837db78bd66173ebb51e447b540bee5de`. Kaynak: `C:/Users/ozan/OneDriveEge Üniversitesi/Masaüstü/Kariyer_Kapisi_RSS_Tasarim_Kilavuzu.pdf`.

| Kılavuz konusu | Uygulanan / bekleyen davranış |
| --- | --- |
| İlk sayfa: kurumların kendi resmî web siteleri | Bağımsız Android uygulaması için izin kanıtı sayılmadı. |
| Kamu İşe Alım İlanları başlığı | Ayrı kaynak kartında mevcut. |
| #0A79B4 / #064890 | Yalnızca kaynak kartının başlık/ayırıcı alanında; genel kırmızı-beyaz tema korunur. |
| Masaüstü 250×350 / 350×280, mobil responsive | Bunlar masaüstü referanslarıdır; mobil kart esnek genişlik ve doğal yüksekliği kullanır. Native dp/sp ile PDF px/pt bire bir ölçü olarak sunulmaz. |
| Kurum/birim/başlık hiyerarşisi | Doğrulanmış kurum kalın, başlık daha sade; RSS'ten güvenilir birim alanı doğrulanmadığı için birim uydurulmaz. |
| Başlıkta 100 karakter | Unicode karakterler üzerinden ilk 100 + `...`; ekran okuyucu tam başlığı alır. |
| Doğrulanmış son başvuru | Yalnızca kaynak kontrolü olan kaydın gerçek son başvuru tarihi; pubDate kullanılmaz. |
| Kariyer Kapısı ve kurum logoları, 80/100 px | Logo hakkı/asset doğrulanmadığından hiç logo eklenmedi, çıkarılmadı veya hotlink edilmedi. Bu nedenle tam markalı widget uyumu tamamlandı iddiası yoktur. |

Yeni `CareerSourceCard` varsayılan olarak kapalı `EXPO_PUBLIC_CAREER_CARD_ENABLED` altında hazırlanmıştır. Bu public sunum bayrağı veri erişimi/yayın izni vermez. Varsayılan kart, doğrulanmış personel ilanını genel KadroRadar tasarımında göstermeye devam edebilir. Bu sprintte kaynak kartı fiziksel cihazda görsel olarak test edilmedi.

## 4. Teknik erişim ile kullanım yetkisi

Kullanıcının ilk “izin çıktı” mesajı sonradan şu bilgiyle düzeltildi: yazılı yanıt yok; internette mobil RSS kullanımının sorun olmayacağı okunmuş. Registry'ye uygulamaya özel izin belgesi veya doğrulanmış lisans girilmedi. Kaynak `REVIEW_REQUIRED`, `enabled:false` ve otomatik erişim değerlendirmesi `REVIEW_REQUIRED` olarak kalır.

Bu ürünün mevcut policy sözleşmesi otomatik feed erişimi, mobil metadata ve ticari kullanım kapsamını ayrı kanıtlar. Resmî bir kamuya açık lisans da kanıt olabilir; mutlaka kişiye özel yazı olması gerektiği şeklinde genel hukuk kuralı ileri sürülmez. Genel internet yorumundan kaynağa özel yetki sonucu çıkarılmaz. Logo kapsamı ayrıca değerlendirilir.

| Aşama | Sonuç |
| --- | --- |
| A: Kullanıcıdan gelen gerçek XML, offline | Gerçek dosya eksik; sentetik sözleşme testleri tamamlandı. |
| B: Erişilebilirlik/kılavuz | HTTP başlıkları ve dört PDF sayfası doğrulandı; gövde toplanmadı. |
| C: Yetkili canlı çekim + izole staging | Kapsam doğrulanmadığı için yapılmadı. |
| D: Production otomasyonu/mobil yayın | Açılmadı; ayrıca release, admin ve kullanıcı aktivasyon kararı gerekir. |

## 5. Uygulanan RSS adaptörü

- `services/ingest/career_rss.py`: ayrı RSS 2.0 parser ve CLI. UTF-8/BOM, Windows-1254, ISO-8859-9 ve BOM'lu UTF-16; decode sonrasında DTD/ENTITY reddi; 2 MB/1.000 item sınırı. Yanlış RSS yapısı, bozuk XML ve çakışan GUID reddedilir.
- GUID metni SHA-256 kimliğine çevrilir. Aynı GUID + aynı metadata tek kayıt; aynı snapshot içinde aynı GUID + farklı metadata hata. URL canonicalizasyonu fragment ve `utm_*` alanlarını kaldırır, kalan query parametrelerini koruyup sıralar. GUID aynı kalıp gerçek URL değişirse staging kimliği korunur. Aynı URL'nin farklı GUID ile sahiplenilmesi otomatik birleştirilmez, editör uzlaştırmasına düşer.
- Kategoriler `PERSONNEL`, `EXAM_PLACEMENT`, `INTERNAL`, `EDUCATION`, `OTHER` olarak ayrılır. Çoklu/belirsiz kategori personel fırsatı sayılmaz. Yalnızca `PERSONNEL` metadata adayı AnnouncementImportRow'ya gider; diğerleri source-document kuyruğunda kalır.
- PubDate yalnızca `announcedAt`; bilinmeyen veya gelecekteki tarih inceleme sebebi. Başvuru tarihleri, kurum, kontenjan, şehir, KPSS ve kadrolar metadata'dan uydurulmaz. İlk kurum `null`/UNKNOWN; editör resmî detaydan doğrular.
- `description` ve `enclosure` saklanmaz, fetch edilmez; görsel/PDF gövdesi veya tam haber metni eklenmedi. Ham kaynak referansı belge hash'i + ordinal + GUID hash'i içerir.
- `rss_transport.py`: public DNS kontrolü ve seçilen IP'ye TCP bağlantısı, asıl hostname ile TLS sertifika doğrulaması, boyut/süre sınırları, incomplete body reddi. Redirect'ler takip edilmez; 403/429 hata olarak kalır. ETag/Last-Modified koşullu istekleri ve 304 desteklenir. Ham hata mesajı, URL secret'ı veya stderr loglanmaz.
- `source_adapters.py`: önceki offline HTML bağlantı keşfi korunarak kariyer RSS metadata yolu eklenir. Gerçek XML yapısı doğrulanana kadar uyumluluk sentetik RSS sözleşmesiyle sınırlıdır.

## 6. 48/96 saatlik otomasyon hazırlığı

İkinci scheduler eklenmedi. `SourceOperations` mevcut worker rolü, DB due kontrolü, PostgreSQL advisory lock, backoff ve kaynak revokasyon sözleşmesiyle Kariyer Kapısı'nı da destekler. Gerçek registry kapalı kaldığından bu worker kaynağa gitmez. ETag, Last-Modified, belge hash'i ve son GUID seti DB metrics içinde taşınır; yeni/ephemeral diskli worker eski koşullu istek bilgisini kullanır. Başarısız staging sonrasında yerel dosyadaki commit edilmemiş validators bir sonraki çalıştırmada DB metrics ile değiştirilir.

304'te staging, kaybolma sinyali veya yeni source-document oluşturulmaz. Tam ve geçerli 200 snapshot sonrasında eksilen GUID'ler **iptal** sayılmaz; `FEED_ITEM_DISAPPEARED_REVIEW` audit ve pending review oluşturur, önceki kaynak doğrulamasını geçersizleştirir. Geçersiz/eksik snapshot validators veya kaybolma setini ilerletmez. Tekrar görünen item yeniden inceleme gerektirir.

`infra/source-worker.workflow.example.yml` etkin `.github/workflows` klasörünün dışındadır. Protected environment/secret, concurrency, default-branch guard ve one-shot worker hazırlığı korunur. Gerçek kaynak yetkisi, dar DB rolü, maliyet/hosting ve release SHA kararı olmadan taşınmamalıdır. Render Free üzerinde sürekli worker garantisi verilmez. Haricî hata alarm kanalı yapılandırılmadı; güvenli log ve admin health/audit vardır. `Retry-After` başlığını scheduler'a özel aktarma henüz yoktur; gerçek rate sözleşmesi aktivasyondan önce doğrulanmalıdır.

## 7. Admin review ve slider

Yeni `career-staging.ts` mevcut AnnouncementImportRow/AnnouncementReviewAudit ve SourceDocument modellerini kullanır. Yeni migration yok. GUID tabanlı `career-rss-<hash>` satır kimliği gerçek source URL'den ayrıdır; sahte resmî URL oluşturulmaz. Kurum/tarih UNKNOWN kaydı staging'de incelenebilir ve reddedilebilir; açık ilan olarak yayımlanamaz.

Mevcut özel belge yükleme akışı: `POST /api/v1/admin/gazette-documents/source-reviews/career`. Sonra yeni `POST /api/v1/admin/gazette-documents/source-reviews/:id/stage-career` yalnızca tam RSS2 raporundaki personel metadata adaylarını staging'e alır. Mevcut GazetteGuard rol/CSRF/upload flag kontrolleri geçerlidir. Public upload yolu değildir. `DOCUMENT_UPLOADS_ENABLED=false` production'da değiştirilmedi; kapalıysa manuel yükleme route'u da 503 döner.

Admin panelinde Kariyer Kapısı RSS kuyruğuna staging düğmesi, kurum/tarih doğrulama checkbox'ı, kategori ve güvenli resmî link eklendi. Mevcut draft/APPROVE/PUBLISH/REJECT/ARCHIVE/WITHDRAW version+audit akışı korunur. Kariyer onayı için resmî detay teyidi ve gerçek iki başvuru tarihi gerekir; gelecekteki yayın, genel kategori veya sadece iptal/uzatma başlığı yeni personel ilanı gibi yayımlanamaz. Kaynak ortadan kalksa da editör mevcut ilanı açıkça arşivleyebilir/geri çekebilir. İptal/uzatma sinyali kendiliğinden tarih değişikliği değildir.

Slider artık yeni seçimlerde editörün **10–180 karakter özgün kısa açıklamasını** ister; ham HTML, satır sonu veya tam metin kabul edilmez. Özet sourceEvidence.homeNews ve audit içinde tutulur. Önceki metadata özetli seçimler okunabilir; yeni seçim API'si editör özeti ister. Mobil slider'ın manuel kaydırma, reduced-motion, sayfa göstergesi ve boşsa gizlenme davranışı korunur. Kaynak olguları değişince seçim hash'i geçersizleşir; izin revokasyonu görünürlüğü keser.

Genel haberler için `infra/official-career-notice.sql.example` tasarım taslağı eklendi: OfficialCareerNotice + Revision + ReviewAudit. Bu dosya Prisma migration değildir ve çalıştırılmadı. Genel haberleri sahte boş kadroyla Announcement'a ekleyen API oluşturulmadı; bu ayrı modelin gerçek CMS/public API'si sonraki onaylı iştir.

## 8. Güncel ilan ekranı

Oturumsuz liste, mevcut filtreler, pagination, kayıt/auth kuralları, güvenli dış tarayıcı bağlantısı ve kırmızı-beyaz tasarım korunur. Public sourceEvidence whitelist'ine yalnızca sourceId/categoryCode/category eklenir; özel kaynak veya editör notları sızmaz. Kariyer kaydında kategori ve yayın tarihi gösterilir; doğrulanmış source-card flag'i açılırsa ayrı kaynak sunumu kullanılabilir. Kartta resmî bağlantı ve ilan detayı vardır, başvuru uygulama içinde taklit edilmez.

Başvuru tarihi bilinmeyen RSS item'ları `view=open` listesine giremez. Kurum içi, eğitim ve merkezi yerleştirme metadata'sı genel kullanıcıya açık personel alımı gibi gösterilmez. ÖSYM historical sistemi bağımsızdır; RSS'te merkezi yerleştirme kategorisi görülmesi tarihsel puan importu başlatmaz.

## 9. Gerçek ve sentetik test sonuçları

| Kontrol | Sonuç ve kanıt sınırı |
| --- | --- |
| API build / admin build / mobile TypeScript | PASS |
| Parser testleri | Kariyer 8 + Energy 12 + kaynak adaptörü 3 + probe 6 + feed metadata 7 = **36 PASS**; sentetik/mocked ağ |
| İzole PostgreSQL 16 | **7 grup PASS**, yeni geçici DB ve mevcut 15 migration; production/local 504 DB kullanılmadı |
| Kariyer DB akışı | **8 kontrol PASS**: kapalı kaynak, 96 saat/dedupe/kategori, 304, eksik alan onayı reddi, gerçek public HTTP + mobil sözleşme, kaybolma/yeniden görünme, GUID+URL güncelleme ve manuel iptal, izin revokasyonu |
| 48 saat / lock / backoff | Mevcut announcement-scan/source-operations/source-worker-process regresyonları PASS; gerçek scheduler çalıştırılmadı |
| Slider / auth UI / kaynak politikası | Kullanıcı oluşturmayan saf fonksiyon, empty/full ve restricted-source kontrolleri PASS |
| Kaynak kartı | Unicode 100 karakter, doğrulanmamış tarih ve kategori ayrımı PASS; fiziksel ekran testi değil |
| Android export | PASS, 1.142 modül/25 asset, `.local/kariyer/android-export`; APK/EAS build değil |
| Secret taraması | PASS, 0 bulgu; sezgisel tarama, tam güvenlik denetimi değil |
| Git diff whitespace | PASS; yalnızca LF/CRLF bildirimleri |
| Docker API image | BLOCKED: npm `ERR_SOCKET_TIMEOUT`; mevcut 300 saniyelik dependency install limiti, exit 124. Nest/admin build veya yeni modüllerin image smoke testine ulaşılmadı. |

Hesap oluşturan eski auth/candidate testleri bu görevde çalıştırılmadı. Yeni admin akışında açık test aktörü simülasyonu kullanıldı; üretim CandidateAuth değiştirilmedi. Public API gerçek izole Nest HTTP sunucusundan okundu. İzole DB'de user/session sayıları değişmedi. Tüm GitHub CI çalıştı iddiası yok: yeni testler workflow'a eklendi, push yapılmadı.

Docker notu: ilk deneme paket indirme sırasında 300 saniyelik mevcut limitte durdu. İki daraltılmış workspace kurulum denemesinde de hoisted lockfile nedeniyle 1.003 paket kaldığı görüldü; bu denemeler iptal edilip etkisiz değişiklikler geri alındı. Dockerfile'ın kurulum ve timeout davranışı korunuyor; yalnızca yeni Python modülleri COPY listesine eklendi. Başarılı image build yapılmış gibi raporlanmaz. Registry erişimi uygun ortamda tam image build ve runtime import smoke testi release öncesi yeniden çalıştırılmalıdır; TLS/registry güvenliği gevşetilmedi.

Tekrarlama (yalnızca yerel Docker ve yeni geçici DB):

```powershell
Set-Location C:\projects\KadroRadar
pnpm --filter @kadro/api build
node .\infra\test-official-sources-isolated.cjs
python -m unittest discover -s services/ingest -p test_career_rss.py -v
node .\apps\api\test-career-card.cjs
```

Runner kendi rastgele adlı PostgreSQL 16 test konteynerini oluşturup kaldırır. Bağlantı ve test şifresini loglamaz; yalnızca o test DB'sine mevcut migration'ları uygular. `.local/release/source-automation-regressions.json` ve `.local/kariyer/isolated-flow.json` yerel kanıtlardır, commit'e eklenmemelidir.

## 10. Bilinen kısıtlar ve canlı metrikler

| Metrik | Gerçek canlı | Sentetik izole test |
| --- | ---: | ---: |
| İndirilen RSS gövdesi | 0 | 1 sözleşme fixture'ı |
| Parse edilen item | 0 | 4 |
| Personel adayı / kadro satırı | 0 / 0 | 1 / 0 |
| Yeni staging | 0 | 1 |
| Onaylanan / yayımlanan | 0 / 0 | 1 / 1 |
| Mobil sözleşmede görülen | 0 yeni kayıt | 1 |
| Gerçek cihaz | Test edilmedi | Test edilmedi |
| Production yazma / scheduler aktivasyonu | 0 / 0 | Uygulanmaz |

29 Ekim 2026 **11:37 Türkiye saati** public GET kontrolü: health HTTP 200/ok; historical total **8.611**; açık announcements total **0**; account/capabilities HTTP **404**. Canlı release SHA `f31306cc6c3f478ab17460583c5dd3573b931fbb`; yerel yeni kod değildir. Açık ilan sayısı 0, bütün arşiv tablosunun toplamı olarak sunulmaz.

Gerçek XML olmadan employer/category/link semantiği, endpoint rate limit'leri ve conditional header desteği canlı doğrulanmış değildir. Kaynak hakkı geri çekilince fetch sonucu staging öncesi kontrol edilir; devam eden HTTP isteği fiziksel olarak anında iptal edilmez. Önceki sprintin geriye dönük toplu yayın kaldırma sınırı korunur; yeni slider/yayın guard'ı ve kaynak değişiminde kaynak doğrulamasının düşmesi uygulanır.

## 11. Kayıt/giriş için production engelleri

`ALLOW_SELF_REGISTRATION`, mevcut oturum/auth configuration ve gerçek kullanıcı hesapları değiştirilmedi. Production capability GET 404 olduğundan kayıt politikasının açık/kapalı olduğu bu kontrolden belirlenemez. Yereldeki capability/hata/alan doğrulaması düzeltmeleri henüz canlı release'e taşınmadı. E-posta doğrulaması, parola kurtarma, destek kimliği ve hesap yaşam döngüsü kararları önceki raporlardaki ayrı engellerdir. Canlı register/login denemesi veya kullanıcı oluşturma yapılmadı.

## 12. GitHub/Render release planı

Commit oluşturulmadı. Önerilen mantıklı gruplar:

1. Önceki UX/auth + news/capability değişiklikleri ve bunların testleri; source-policy bağımlılıklarıyla birlikte incelenmeli.
2. Source policy/audit + RSS metadata/worker + Kariyer staging/admin/public sözleşmesi + Docker Python dosyaları + sentetik testler.
3. ÖSYM/admin-account/backup operatör teşhis değişiklikleri; ayrı güvenlik incelemesi, bu görevin release grubuna otomatik katılmaz.
4. Raporlar, ayrı SQL taslak ve etkin olmayan scheduler örneği.

`git add .` kullanılmamalı. Önceki source-policy dosyaları hâlâ untracked; yalnızca Kariyer dosyasını eklemek eksik release üretir. `.local`, environment, XML/PDF asılları, dump, verified receipt, özel ZIP ve secrets eklenmemeli. CI'ye Kariyer parser, DB flow ve mobile-card testleri eklendi; uzaktaki sonuç ancak ayrı push onayından sonra oluşur.

Kod review sonrası API/admin kodu kaynaklar kapalı ve `SOURCE_SYNC_ENABLED=false` kalacak şekilde release edilebilir; bunu bu sprintte yapmadık. `EXPO_PUBLIC_CAREER_CARD_ENABLED` varsayılan kapalı tutulmalı; logo/brand asset eklenmemeli. Genel notice SQL taslağı release migration listesine konmamalı. Yeni Prisma migration gerekmiyor. Render deploy, worker yetkisi ve mobil build ayrı kararlardır.

## 13. Google Play kapalı test öncesi

- Expo SDK 54, `com.kadroradar.app`, 1.0.1/versionCode 3 korunur; EAS hesabı/ayarları değiştirilmedi.
- Yeni doğrulanmış backend release ve gerçek kayıt politikasıyla fiziksel Android login/oturumsuz ilan/favori akışları sınanmalı; yeni gerçek test hesabı açılması ayrıca yetkilendirilmelidir.
- Gerekli destek kimliği, güncel gizlilik/hesap silme ve Data safety beyanları gerçek işleyişle eşleştirilmeli.
- Gerçek izinli RSS fixture/pilot ve source-card ekranı cihazda sınanmalı; eksik tarih, yanlış kategori, ağ hatası ve resmî dış link gözlenmeli.
- Maliyet ve hesap yetkisi kontrolünden sonra kullanıcı onayıyla EAS preview build; ardından Play kapalı test/store içerikleri. Bu görevde APK, AAB veya Play yüklemesi yapılmadı.

## 14. Kullanıcıdan beklenenler ve sonuç

Öncelikle eldeki gerçek XML dosyası veya tam yolu gerekir. Otomatik erişim ve bağımsız mobil/ticari metadata kullanımını açıkça kapsayan resmî şart/lisans veya yazılı yanıt doğrulanmalıdır. Logo kullanımının kapsamı ayrıca açık olmalıdır. Bu doğrulamalar kullanıcıdan production aktivasyon onayının yerine geçmez; activation için worker hedefi/DB yetkisi/hosting/release de belirlenmelidir.

**A. KOD OLARAK HAZIR:** RSS2 metadata parser/taşıma, GUID staging, kategori ayrımı, mevcut worker bağlantısı, admin incelemesi, editör özeti ve feature flag altındaki kaynak kartı; sentetik testlerle doğrulandı.

**B. TEKNİK TEST TAMAMLANDI, İZİN BEKLENİYOR:** Sentetik parser/izole DB/public API/mobil sözleşmesi tamamlandı. Gerçek endpoint'te yalnızca HTTP başlık testi tamamlandı. Gerçek XML uyumluluğu ve canlı içerik pilotu **henüz tamamlanmadı**; dosya ve kapsam doğrulaması bekleniyor.

**C. PRODUCTION AKTİVASYONU İÇİN EK KARAR GEREKİYOR:** Kaynak yetkisi, gerçek pilot, editör onayı, worker barındırma/rol/secret, release ve kullanıcı aktivasyon onayı. Production yazma/migration/yayın, scheduler aktivasyonu, push, deploy veya EAS build yapılmadı.
