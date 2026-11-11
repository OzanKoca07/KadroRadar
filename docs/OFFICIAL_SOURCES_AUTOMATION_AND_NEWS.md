# Güncel resmî kaynaklar, otomasyon ve haberler

Sonraki Kariyer Kapısı bulguları ve kodu: [Kariyer Kapısı RSS hazırlığı](KARIYER_KAPISI_RSS_FINAL_READINESS.md). 29 Ekim'de `/RSS` için HTTP 200/XML başlıkları doğrulandı; aşağıdaki önceki araştırma matrisi tarihsel kayıttır. Kullanıcı yazılı izin bulunmadığını netleştirdi; kaynak hâlâ `REVIEW_REQUIRED` ve kapalıdır.

İnceleme: 28–29 Ekim 2026. Dal: `feature/announcements-core`; başlangıç HEAD: `0d7c0d0e3f8016a2bcf0fa58fb5a42d8d2d81147`. Çalışma ağacındaki önceki mobil UX/auth, admin ve ÖSYM/backup değişiklikleri korundu. Bu rapordaki yeni kod henüz commit edilmedi, gönderilmedi veya deploy edilmedi.

## 1. Mevcut otomasyonun gerçek durumu

Kaynak registry'sindeki bütün gerçek kaynaklar kapalıdır. Energy adaptörü canlı RSS taşıma koduna sahiptir; bu çalışmada bu kodla canlı ilan içeriği indirilmedi. Diğer kaynakların keşif/HTML/PDF adaptörleri çevrimdışı editör incelemesi içindir. Bir kaynak için parser bulunması, çalışan günlük veri toplama anlamına gelmez.

Mevcut worker; 48/96 saatlik kontrol kapısı, kaynak bazlı asgari aralık, PostgreSQL advisory lock, staging idempotence, son başarı/hata ve sınırlı receipt geçmişi içerir. API süreci kaynak worker'ı değildir. `PROCESS_ROLE=source-worker`, `SOURCE_SYNC_ENABLED=true` ve doğrulanmış/açık kaynak gerekir. Bu bayraklar production'da değiştirilmedi. Özel production worker ortamına erişilmedi; uzaktaki scheduler çalışmaları doğrulanmış değildir.

Eski `automatedAccess=ALLOWED` değerlendirmesi tek başına mobil/ticari kullanım kanıtı sayılmıyor. Kullanıcının bu sprintte istediği ürün politikası doğrultusunda `LICENSE_VERIFIED`, `REVIEW_REQUIRED`, `RESTRICTED` ayrımı eklendi. Bu, bütün kamu bilgilerinin indekslenmesinin hukuken her durumda önceden izin gerektirdiği iddiası değildir. Erişim kuralları, olgusal indeksleme ve tam belge yeniden yayımı ayrı değerlendirilir.

## 2. Kaynak bazlı erişim/lisans matrisi

Tablodaki “belirsiz”, yasak bulunduğu anlamına gelmez. Belirli uç noktanın otomatik erişim, mobil metadata ve ticari kullanım kapsamı doğrulanamadığı anlamına gelir. Araştırma, politika/keşif sayfalarıyla sınırlıdır; haber/ilan feed gövdeleri veya PDF'ler toplanmadı.

| Kaynak | Resmî bulgu / biçim | Erişim ve kullanım değerlendirmesi | Sonuç |
| --- | --- | --- | --- |
| Enerji Bakanlığı | [RSS tanıtımı](https://enerji.gov.tr/rss), RSS bağlantıları mevcut | RSS okuyucu daveti var; mobil/ticari yeniden kullanım kapsamı açıkça doğrulanmadı. [robots.txt](https://enerji.gov.tr/robots.txt) RSS yolunu yasaklamıyor; `/duyurular`, `/uploads`, `/file`, `/File` gibi yollar engelli. Feed erişimi detay belgesine erişim hakkı vermez. | `REVIEW_REQUIRED`, kapalı |
| SGK | [RSS hizmeti](https://sgk.gov.tr/Rss), kesin feed endpoint'i bu çalışmada doğrulanmadı | [Yasal uyarı](https://sgk.gov.tr/yasaluyari) yeniden kullanım için izin ve kaynak şartları içeriyor. Metadata indekslemenin kapsamı ayrıca teyit edilmeli. Robots erişimi doğrulanamadı. | `REVIEW_REQUIRED`, kapalı |
| SBB Kamu İlan | [Resmî portal](https://kamuilan.sbb.gov.tr/), HTML | Araştırma isteğinde HTTP 403. Alternatif hostname/kimlik veya erişim engeli aşılmadı; RSS/API ve mobil kullanım hakkı doğrulanmadı. | `REVIEW_REQUIRED`, kapalı |
| Kariyer Kapısı | [Resmî portal](https://kariyerkapisi.gov.tr/), kurum ilanları/başvuru sistemi | Bireysel başvuruların e-Devlet akışı otomatik veri API'si değildir. Herkese açık indeksleme endpoint'i ve kullanım kapsamı doğrulanmadı; login arkasına girilmedi. | `REVIEW_REQUIRED`, kapalı |
| İŞKUR | [Resmî site](https://www.iskur.gov.tr/) | Kamuya açık personel feed/API ve üçüncü taraf mobil kullanım kapsamı doğrulanmadı. | `REVIEW_REQUIRED`, kapalı |
| Resmî Gazete | [Resmî site](https://www.resmigazete.gov.tr/), mevcut çevrimdışı PDF/HTML parser'ı | Bu sprintte günlük fihrist/PDF için yeni başarılı canlı erişim veya kullanım hakkı kanıtı yok. Önceki gerçek 140 sayfalık PDF testi korunuyor; yeni canlı başarı olarak sayılmıyor. | `REVIEW_REQUIRED`, manuel yol korunuyor |
| UAB | [Duyurular](https://www.uab.gov.tr/duyurular/), HTML | Registry mevcut; doğrulanmış otomatik feed ve mobil/ticari lisans yok. | `REVIEW_REQUIRED`, kapalı |
| ÖSYM | [Resmî site](https://www.osym.gov.tr/), tarihsel PDF belgeleri ayrı sistem | Güncel ilan RSS/API bulunmadı. AİS/GİS kapsamlı kullanım şartları bütün tarihsel PDF'lere otomatik genellenmedi. 21 kaynak/8.611 tarihsel kayıt sistemi değiştirilmedi. | Güncel otomasyon `REVIEW_REQUIRED` |
| Karacadağ Kalkınma Ajansı | [Resmî site](https://www.karacadag.gov.tr/) RSS haber/duyuru etiketleri | Web araştırmasında RSS sunumu görüldü; CLI açılış isteği timeout. Kesin feed URL'si, robots ve mobil/ticari haklar doğrulanmadı. | `REVIEW_REQUIRED`, yeni çevrimdışı adaptör |
| Giresun Üniversitesi Eğitim Bilimleri | [Resmî RSS sayfası](https://ebb.giresun.edu.tr/rss) | Haber/duyuru RSS etiketleri var; arama çıktısında endpoint-etiket eşlemesi tutarsız. Endpoint ve kullanım kapsamı doğrulanmadan registry feed atanmadı. | `REVIEW_REQUIRED`, yeni çevrimdışı adaptör |
| SHGM | [Resmî RSS duyurusu](https://web.shgm.gov.tr/tr/genel-duyurular/7133-rss-feed-kullanimi-hakkinda) | HTTP RSS adresi ilan ediyor. HTTPS eşdeğeri uydurulmadı; mobil/ticari kullanım kapsamı doğrulanmadı. | Araştırma adayı; etkin adaptör değil |
| Gaziantep Açık Veri | [Lisans](https://acikveri.gaziantep.bel.tr/tr/license) | Kapsamındaki veri kümeleri için atıflı ticari/ticari olmayan kullanım izni var; üçüncü taraf ve kişisel veri istisnaları var. Güncel personel/kariyer duyurusu veri kümesi doğrulanmadı. | İlgisiz açık veri ile sahte ilan pilotu yapılmadı |
| Sağlık Açık Veri | [Resmî kullanım koşulları PDF](https://acikveri.saglik.gov.tr/app/doc/KullanimKosullari.pdf) | Belirlenen veri kümeleriyle sınırlı atıf/lisans şartları var. Bilimsel kullanım ifadesi ve kapsam nedeniyle bu uygulamanın ticari kullanımına kesin hak sonucu çıkarılmadı. Güncel ilan feed'i değil. | Güncel ilan adaptörü değil |
| ilan.gov.tr | Kullanıcının BİK yazılı kısıt bildirimine dayanan ürün kararı | Bu sprintte ilan içeriği toplanmadı. Yazının kopyası doğrulanmış gibi sunulmaz. Alan adı, alt alan ve kodlanmış/nested provenance kontrolleri korunur; özet/link üzerinden dolanılmaz. | `RESTRICTED`, değiştirilemez ret |

Tüm incelemeler 28–29 Ekim tarihli anlık bulgulardır. Açık veri lisansı başka kuruma veya aynı kurumun lisans kapsamı dışındaki içeriğine taşınamaz. Robots izni telif/kullanım lisansı yerine geçmez. Doğrulanmış bir kaynakta atıf metni, lisans URL'si, kapsam URL'si, kanıt SHA-256'sı ve geçerlilik tarihleri saklanmalıdır. Şimdilik hiçbir gerçek kaynağa doğrulanmış lisans atanmamıştır.

## 3. Gerçek RSS/API bulguları

Enerji Bakanlığının resmî tanıtım sayfasında şu bağlantılar bulundu:

- `https://enerji.gov.tr/RSS/15?t=1`: duyurular; mevcut ilk adaptör.
- `https://enerji.gov.tr/RSS/17?t=1`: haberler.
- `https://enerji.gov.tr/RSS/1080?t=2`: EİGM raporları; personel feed'i değildir.

Bu üç feed indirilmedi; bağlantı bulunması gövde biçiminin canlı doğrulandığı anlamına gelmez. RSS tanıtım sayfasının bu incelemedeki HTTP sonucu 200 ve SHA-256 değeri `400c62f57dd3bfe9ca2ab6784f9d5d088d0c4b772de12f8007b1c24d7ec295bf`. SGK RSS tanıtım sayfası HTTP 200, SHA-256 `c92b7f1afb5a41bc02ff41100b42db160040caa1c3a80804da28100f02827008`. Bunlar ilan belgesi hash'leri değildir. Yerel araştırma kaydı `.local/source-research/discovery.json` altındadır ve release'e eklenmez.

SGK, Karacadağ ve üniversite için `feed:null` bırakıldı. RSS sunumu olduğu bilinen ama kesin endpoint'i doğrulanmayan sayfalar üretim bağlantısı gibi sunulmuyor. DNS/TCP/TLS/HTTP probe ayrımı mevcut; yeni politika kapısı bu kaynaklarda ağ bağlantısından önce durur. Bu yüzden bu sprintte bu feed'lerin canlı TLS/DNS sağlığı hakkında sonuç yoktur.

## 4. Kısa özet + resmî bağlantı modeli

Personel ilanı için yalnızca doğrulanmış kurum, başlık, kadro, kontenjan, eğitim/KPSS koşulu, şehir, başvuru tarihi ve resmî bağlantı saklanmalı. Toplayıcı kurum ilan sahibi işveren sayılmaz. RSS yayın tarihi başvuru başlangıcı/bitişi değildir. Eksik şartlar `null`/UNKNOWN ve inceleme gerektiren durum olarak kalır.

Yeni genel feed parser'ı açıklama, tam metin, resim veya PDF gövdesini kayıt içine almaz. Belgenin hash'i ve satır referansı izlenebilirlik içindir; orijinal belgeyi mobilde yeniden yayımlama yetkisi değildir. Özgün tek cümlelik özet editörce yazılmalı ve doğrulanmış olgularla sınırlı olmalıdır. Başlıkta “iptal/uzatma” bulunması yalnızca inceleme sinyalidir; otomatik tarih veya iptal sonucu uygulanmaz.

Genel kamu kariyeri haberleri `Announcement` içine boş başvuru/kadro alanlarıyla zorlanmamalı. Öneri: ayrı `OfficialCareerNotice`, `OfficialCareerNoticeRevision` ve inceleme audit modeli. Alanlar: resmî kaynak/kurum, canonical URL, metadata hash'i, doğrulanmış yayın tarihi veya null, özgün editör özeti, kaynak lisans revizyonu, inceleme/yayın/arşiv durumu ve doğrulama zamanı. URL+metadata sürümü idempotent olmalı; tam metin/resim saklanmamalı. Bu model henüz uygulanmadı; yeni migration gerektirir. SQL tasarımı ve ayrı onay olmadan production'a taşınmaz.

## 5. Geliştirilen kod ve API

- `packages/official-sources.json`: kaynak bazlı hak durumu, kapalı SGK/ajans/üniversite araştırma kayıtları; ilan.gov.tr kesin ret.
- `apps/api/src/source-rights.ts`: kapsam/kanıt/hash/geçerlilik denetimi, statik registry ile runtime kararının birlikte doğrulanması. Runtime onayı doğrulanmamış registry'yi yükseltemez. Kaynak bazlı optimistic revision ve advisory lock ile audit tutulur.
- `GET /api/v1/admin/source-operations/:id/policy`: mevcut politika ve audit; mevcut REVIEWER/SYSTEM_ADMIN yetkileriyle.
- `POST /api/v1/admin/source-operations/:id/policy`: SYSTEM_ADMIN ve mevcut CSRF denetimiyle politika incelemesi. Etkinleştirme endpoint'i değildir. Ret/izin geri çekme gelecekteki worker dispatch ve staging/yayın işlemlerini durdurur.
- Audit için mevcut `SourceSyncState` içindeki `policy:<id>` namespace'i ve `ReviewAudit` kullanıldı. Prisma şeması veya migration eklenmedi. Yeni hesap oluşturulmadı; auth configuration değiştirilmedi.
- `source-operations.ts`, `announcement-scan.ts`: kaynak bazlı aralık; fetch sonrası ve staging chunk'ı öncesi hak kontrolü; bounded hata kodları; 304'te eski satırların yeniden staging'e gönderilmemesi. ETag/Last-Modified ve belge hash'i `SourceSyncState.metrics.transport` içinde korunur; yeni worker boş diskle başlasa da koşullu istek kurabilir. Payload/arşiv gövdesi bu taşıma alanına yazılmaz.
- `services/ingest/source_rights.py`, `official_rss.py`, `source_probe.py`: ağ öncesi hak kontrolü, robots yol/Crawl-delay kontrolü, redirect/403/429/TLS engellerini aşmama. Mevcut timeout ve conditional request korunur.
- `feed_metadata.py`, `source_adapters.py`: RSS/Atom/JSON metadata için çevrimdışı, boyut/satır sınırları olan parser; Türkçe encoding, DTD/ENTITY reddi, kaynak host sınırı ve SHA-256. SGK/ajans/üniversite kayıtları canlı fetch adaptörü değildir.
- `SourcePolicyReview.tsx`, `SourceStatus.tsx`, `MultiSourceReview.tsx`: admin politika/audit incelemesi, revizyon çakışması, yeni offline kaynak seçenekleri. API zorunlu yetkilendirmesi korunur.
- `announcement-admin.ts`, `home-news.ts`, `announcements.controller.ts`: yeni yayın ve slider etkinleştirme için doğrulanmış kaynak hakkı; slider okumasında runtime revokasyon kontrolü. Kısıtlı URL staging/yayına giremez.
- `Dockerfile.api`: yeni Python modülleri runtime imajına eklenir. Bu sprintte Docker imaj build/deploy testi yapılmadı.

Sınırlar: hak geri çekilmesi devam eden HTTP isteğini fiziksel olarak iptal etmez; sonuç staging öncesinde kontrol edilir. Birden çok staging chunk'ında önceden yazılmış pending satırlar geri silinmez. Önceden yayımlanmış sıradan Announcement kayıtları için toplu geriye dönük otomatik yayından kaldırma eklenmedi; slider ve yeni yayın guard'ları uygulanır. Böyle bir production veri dönüşümü ayrıca onay gerektirir. Mevcut production'da güncel ilan bulunmadığı önceki kontrolde bildirilmişti; bu sprintte ayrıcalıklı içerik denetimi yapılmadı.

## 6. İlk gerçek kaynak pilotu ve sınırları

İki farklı içerik amacı araştırıldı: Energy duyuruları (personel adayı) ve Energy/SGK/SHGM/üniversite RSS hizmetleri (resmî duyuru adayı). RSS sunumları gerçek; bu uygulama kapsamındaki hakları henüz kanıtlanmış değil. Kullanıcının bu sprintteki “izin doğrulanmamışsa içerik toplama” şartı nedeniyle canlı pilot yapılmadı. Açık lisanslı fakat personel/kariyer içeriği sunmayan veri kümeleri başarı göstermek için kullanılmadı.

| Metrik | Bu sprintte gerçek canlı içerik | İzole sentetik fixture |
| --- | ---: | ---: |
| İndirilen ilan/duyuru belgesi veya feed | 0 | RSS fixture 1 |
| Parse edilen personel adayı | 0 | 1 |
| Kaynaktan ayrıştırılan kadro satırı | 0 | 0; editörce sentetik kontenjan girildi |
| Yeni staging satırı | 0 | 1 |
| Tekrar import duplicate | 0 | 1 |
| Admin onayı | 0 | 1, açık test aktörü simülasyonu |
| Yayın | 0 | 1, izole test DB |
| Public HTTP + mobil sözleşme | 0 yeni canlı kayıt | 1 test kaydı |
| Gerçek Android cihaz | 0 | Test edilmedi |
| Production yazma / kullanıcı oluşturma | 0 | Kullanıcı/oturum sayısı değişmedi |

Admin testinde gerçek auth oturumu oluşturulmadı; controller yöntemleri açıkça test aktörüyle çağrıldı. Public API ise gerçek izole Nest HTTP sunucusundan okundu. Bu, yeni production RBAC veya gerçek admin tarayıcı oturumunun uçtan uca test edildiği anlamına gelmez.

İzin/kapsam teyidi için gönderilmemiş talep taslağı: “KadroRadar bağımsız kamu ilanı takip uygulamasıdır. Belirttiğiniz RSS/API uç noktasını 48/96 saatte bir ETag/Last-Modified ve robots kurallarıyla kontrol ederek yalnızca kurum, kısa başlık, doğrulanmış olgusal şartlar, tarih ve resmî bağlantıyı mobil uygulamada göstermek istiyoruz. Tam belge/metin, logo veya görseli yeniden yayımlamayacağız. Otomatik erişim, mobil metadata, ticari kullanım, gerekli atıf, oran sınırı, kapsam/sona erme ve izin geri çekme koşullarını yazılı veya kamuya açık lisans bağlantısıyla teyit edebilir misiniz?” Hiçbir kuruma mesaj gönderilmedi.

## 7. 48/96 saatlik scheduler hazırlığı

`infra/source-worker.workflow.example.yml` etkin workflow klasörünün dışındadır. Scheduler kurulmadı. Örnek; 6 saatte bir uyanıp DB'deki 48/96 saatlik due durumunu kontrol eder; tam saat garantisi değildir. Kaynak minimum süresi daha uzunsa o süre geçerlidir. Varsayılan 96 saattir. GitHub schedule yalnızca default branch'te çalışır, gecikebilir veya düşürülebilir; örnek default branch guard'ı kullanır. [GitHub schedule belgeleri](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

Gelecekte ayrı onayla: doğrulanmış kaynak ve release SHA, protected `source-automation` environment, maliyet/egress incelemesi, dar yetkili DB bağlantısı secret'ı ve `SOURCE_AUTOMATION_APPROVED=true` gerekir. Secret değeri örnekte yoktur. Örnek migration, bootstrap, otomatik yayın veya deploy çalıştırmaz. Worker DB staging yazdığı için salt okunur bir işlem değildir; bu sprintte production'da çalıştırılmadı.

Alternatif: sürekli çalışan ücretli worker veya yönetilen cron; aynı one-shot `source-worker` rolü ve DB lock/due kontrolü kullanılabilir. Push worker ayrı süreçtir. Render Free API'yi cron ile uyandırmak kesintisiz worker garantisi değildir; servis 15 dakika boşta kalınca uyur ve dosya sistemi kalıcı değildir. [Render Free belgeleri](https://render.com/docs/free).

Mevcut retry üstel ve sınırlıdır; robots minimumu korunur. 403/429/redirect aşılmaz, ani yeniden deneme yapılmaz. Sunucunun `Retry-After` başlığını özel olarak zamanlayıcıya aktarma bu sürümde uygulanmadı; ilgili kaynak etkinleştirilmeden oran/başlık davranışı gerçek izinli endpoint'te doğrulanmalı. Haricî hata uyarısı kanalı yapılandırılmadı; güvenli hata kodları ve admin health/audit mevcut.

## 8. Güncel ilan ve slider durumu

Önceki UX sprintinin kompakt, manuel kaydırılan, sayfa göstergeli slider'ı korundu. Doğrulanmış ve editörün ayrıca seçtiği personel ilanları içindir; genel haber deposu yapılmadı. Onaylı haber yoksa gizli kalır, örnek içerik üretmez. Kaynak revokasyonu slider'dan görünürlüğü keser. Yeni genel duyurular ayrı model ve review/publish sözleşmesi tamamlanmadan mobilde gösterilmez.

Başvuru tarihi belirsiz kayıt açık ilan sayılmaz. Kaynak olguları değişince eski kaynak doğrulaması ve haber seçimi geçersizleşir. İptal ve süre uzatma başlık ipuçları editör onayı olmadan kesin duruma dönüşmez. Önceki ana sayfa, oturumsuz gezinti, auth alan doğrulaması, hata mesajları ve kayıt politikası endpoint'i korunur.

## 9. Test sonuçları

- API Nest build: PASS. Admin TypeScript/Vite build: PASS. Mobil TypeScript: PASS.
- Android Expo export: bundle üretildi, 1.140 modül ve 25 asset; çıktı `.local/source-research/android-export`. EAS/APK build değildir; cihaz testi değildir.
- Python: RSS 12, ağ probe 6, kaynak adaptörü 3, metadata/haklar 7 = 28 test PASS. XML bozulması, DTD, encoding, yanlış host, bilinmeyen tarih, politika öncesi sıfır ağ erişimi, robots/403/429/redirect, timeout/TLS/DNS ve 304 kapsanır. Ağ hataları fixture/mocks ile üretilmiştir.
- İzole PostgreSQL 16: mevcut 15 migration yalnızca yeni geçici test DB'sine uygulandı. Altı grup PASS: indexing-policy, source-operations, announcement-scan, source-worker-process, historical-release, source-rights-flow. Son grup 7 kontrol içerir; runtime yükseltme reddi, revision/audit, fetch sırasında revokasyon, idempotence, admin simülasyonu → public HTTP → mobil sözleşme, kaynak değişikliği/iptal ve kullanıcı/oturum sayılarının korunması.
- Yeni worker validator testi: PASS; boş disk başlangıcında kalıcı ETag/Last-Modified, 304 ve eski satırların staging'e tekrar gönderilmemesi. Python veya gerçek ağ çalıştırmadan sentetik taşıma kullanır.
- Mobil kaynak politikası 10 kontrol, preview config 10 kontrol, UI kontrast/slider/auth saf fonksiyon kontrolleri: PASS. Auth kontrolleri kullanıcı oluşturmayan saf fonksiyon testleridir.
- `git diff --check`: PASS; yalnızca Git LF/CRLF bildirimleri var.
- Secret taraması: PASS; 661 dosya/Git nesnesi, 0 bulgu. Bilinen yerel/fixture kimlik bilgileri ayrı sayıldı. Bu sezgisel tarama tam güvenlik denetimi değildir.

Kanıtlar `.local/release/source-automation-regressions.json`, `.local/source-research/isolated-policy.json` içinde; bunlar özel yerel çıktıdır ve commit'e eklenmez. Önceki kullanıcı oluşturan auth/candidate testleri bu sprintte tekrar çalıştırılmadı. Tüm CI'nin GitHub üzerinde geçtiği iddia edilmez. Yeni fixture testleri mevcut CI'ye eklendi; push yapılmadığından uzakta çalışmadı.

## 10. Production öncesi kararlar

1. En az bir gerçek personel/duyuru kaynağının exact endpoint ve kullanım kapsamını doğrulamak; feed ve detay yollarının robots kurallarını ayrı kontrol etmek.
2. Kanıt, hash, kapsam, atıf ve geçerlilik sürelerini registry review ve admin audit'e geçirmek. Statik ve runtime izin birlikte gerekir; admin kararı kaynağı kendiliğinden açmaz.
3. İzinli canlı fixture/pilot indirmesi için ayrı çalışma yapmak; kaynak şartları ve rate davranışı doğrulanınca gerçek izole staging/admin/public/mobil testini tamamlamak.
4. Genel kariyer haberleri için önerilen ayrı modelin SQL/migration tasarımını ve UX'ini onaylamak. Bu çalışma henüz kodlanmış genel haber sistemi değildir.
5. Hak revokasyonu öncesinde yayımlanmış kayıtlar için geriye dönük kaldırma politikasını belirlemek; otomatik production veri dönüşümü yapmamak.
6. Worker barındırma/maliyet, hata uyarısı, secret yönetimi ve least privilege DB kullanıcısını belirlemek. Render Free sürekliliğine güvenmemek.
7. Gerçek cihaz ve gerçek admin tarayıcı testleri. Lisans kanıtı kullanıcı yüklemesiyle kabul edilse bile asıl belge içeriğinin doğruluğu editörce incelenmeli; SHA yalnızca bütünlük kanıtıdır.

## 11. GitHub/Render için sonraki işlemler

Bu sprintte commit/push/deploy, production migration/import/yayın, scheduler aktivasyonu veya EAS build yapılmadı. Release adayı mevcut dirty UX/auth ve operatör değişiklikleriyle birlikte incelenmeli; `.local`, dump, yedek, env, receipt, özel ZIP veya kaynak belge gövdeleri eklenmemeli. Ardından ayrı yetkilendirmeyle commit/SHA, CI ve Render release eşleştirilmelidir.

Prisma migration eklenmediğinden bu değişiklik için production migration adımı yoktur. Deploy kararı alınırsa önce bütün kaynaklar ve worker bayrakları kapalı tutulmalı; admin build ve Python dosyalarının imajda bulunduğu kontrol edilmeli. Sonrasında salt okunur health/current/historical kontrolleri yapılmalı. 8.611 ÖSYM kaydı ve eski kaynak/backup makbuzları bu geliştirmeye import girdisi olarak kullanılmadı veya değiştirilmedi.
