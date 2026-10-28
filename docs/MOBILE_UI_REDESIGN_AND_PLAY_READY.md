# KadroRadar mobil UI/UX revizyonu — 28 Ekim 2026

> Sonraki doğrulama ve onaylı yerel migration sonucu: [Android preview release readiness](ANDROID_PREVIEW_RELEASE_READINESS.md). Aşağıdaki metin önceki UI çalışmasının kaydıdır; güncel production GET kanıtları, yerel HTTP 500 çözümü ve kalan release engelleri yeni rapordadır.

## Kapsam ve veri güvenliği

Kırmızı-beyaz, açık nötr yüzeyler ve okunaklı sistem yazı tipleriyle eğitim/tercih planlama odaklı bir arayüz uygulandı. Backend kodu, API adresleri, Expo SDK 54, Android paket adı `com.kadroradar.app`, EAS projesi ve veri modelleri değiştirilmedi. Production bağlantısı, migration, reset, import, deployment, commit veya push yapılmadı. Önceden değiştirilmiş infra/admin/backup dosyaları ve kullanıcı ZIP yedeği korundu.

Kullanıcının bildirdiği production 8.611 kayıt / 4.797 lisans / 2.974 önlisans / 840 ortaöğretim bilgisi bağlam olarak kabul edildi; bu görevde production DB'den tekrar doğrulanmadı. Yerel API testinde görülen **504 lisans kaydı production toplamı değildir**. ÖSYM envanterine ve dump/makbuz dosyalarına dokunulmadı.

## Güncellenen ekranlar

| Dosya | Sonuç |
| --- | --- |
| apps/mobile/app/_layout.tsx | Mevcut Stack ve route/deep-link yolları korunarak beş öğeli alt gezinme; Türkçe ekran başlıkları; aktif konum; klavyede alt çubuğun gizlenmesi; azaltılmış hareket tercihi |
| apps/mobile/app/index.tsx | Karşılama, geçmiş atama odaklı ana kart, dört hızlı erişim, üç eğitim düzeyi kısayolu, kaynak/bağımsızlık açıklaması; örnek istatistik yok |
| apps/mobile/app/historical.tsx | Arama, Lisans/P3–Önlisans/P93–Ortaöğretim/P94 chip'leri, açılır filtreler, yıl/dönem/şehir/kurum/taban puan aralığı; isteğe bağlı karşılaştırma; taban/tavan/kontenjan kartları |
| apps/mobile/app/placement/[id].tsx | Türkçe eğitim düzeyi, düzenli bilgi satırları, puan karşılaştırması, nitelik doğrulama uyarısı ve güvenli resmî kaynak bağlantısı; timeout/yeniden deneme |
| apps/mobile/app/announcements.tsx | Güncel/yakında/arşiv seçimi, kadro filtreleri, kurum/unvan/tarih/durum/kaynak kartları, kontrollü boş durum; skeleton ve yeniden deneme |
| apps/mobile/app/announcement/[id].tsx | Başvuru tarihleri ve doğrulama zamanı, kadro bazında koşullar, kaydet/karşılaştır işlemleri, resmî duyuru/başvuru bağlantıları |
| apps/mobile/app/profile.tsx | Giriş/kayıt seçimi, görünür alan etiketleri, eğitim ve puan türü chip'leri, isteğe bağlı sınav/bölüm/şehir/belge bilgileri; mevcut çıkış/silme onayı/bildirim tercihleri |
| apps/mobile/app/matches.tsx | UYGUN/UYGUN DEĞİL/BELİRSİZ ayrımı ve nedenleri; profil yönlendirmesi; eksik kaynağın gösterilmemesi |
| apps/mobile/app/saved.tsx | Tarihe göre sunucudan gelen mevcut sıralama korunur; arşiv/iptal/son başvuru durumu, detay ve kaldırma işlemleri |
| apps/mobile/app/notifications.tsx | Bildirim kartları, tercihlere erişim, kaynak denetimi ve ortak yükleme/boş/hata durumları |
| apps/mobile/app/about.tsx | Bağımsızlık, gizlilik ve hesap kontrolü açıklamaları; mevcut yapılandırılmış web/destek bağlantıları; eksik adres uydurulmaz |

Projede ayrı onboarding ekranı bulunmadığından zorunlu bir onboarding veya yeni veri saklama akışı eklenmedi. Ana sayfa hesap açmadan keşfi açıklar. Son aramalar için sahte içerik eklenmedi.

## Çözülen eski UI sorunları

- Ana sayfadaki aynı görünümlü uzun bağlantı yığını, önem sırası belirgin ana kart ve hızlı erişimlere dönüştü.
- Sürekli açık uzun tarihsel filtre formu ve varsayılan örnek KPSS puanı kaldırıldı; filtreler isteğe bağlı panelde, sonuçlar daha erken görünür.
- Ekranlar arasındaki farklı mavi tonları, ham input'lar ve düzensiz kartlar ortak token/bileşenlere taşındı.
- İngilizce veri alanı etiketleri ve enum durumları yerine Türkçe etiketler, eğitim düzeyi ve başvuru durumu gösterilir.
- Yalnızca spinner veya tek cümlelik boş/hata yerine skeleton, açıklama, yeniden deneme ve ilgili ekrana yönlendirme bulunur.
- Kaynak URL'si yalnızca görünüşüne göre açılmaz; mevcut resmî host kontrolü ve kısıtlı kaynak reddi uygulanır.

## Mini tasarım sistemi ve ortak bileşenler

`apps/mobile/ui/theme.ts`: primary #B42335, beyaz surface, #F8F8F7 canvas, koyu metin, okunabilir muted metin, success/warning/error/info renkleri. Spacing 4/8/12/16/24/32, radius 10/16/22/pill; 28/20/15/13/12 tipografi ölçeği. Katmanlı gölge ve yarı saydam pahalı yüzey yerine ince sınırlar kullanılır.

`apps/mobile/ui/components.tsx`: Screen, Heading, Card, Button (primary/secondary/ghost/danger), Field, Chip, Badge, Notice, EmptyState, ErrorState, SkeletonCards, FilterPanel, Pagination, Fact, OfficialLink, Independence. Sistem güvenli alanı, en az 44–48 dp dokunma hedefleri, alan etiketleri, seçili/disabled/busy accessibility durumları ve canlı sonuç sayacı kullanılır. Font ölçekleme kapatılmadı.

`apps/mobile/lib/presentation.ts`: ortak tarih/puan/eğitim/durum gösterimi ve tipler. Tarihi eksik/geçersiz kayıtlar açık başvuru sayılmaz. `WITHDRAWN`, arşiv ve süre sonu ayrı gösterilir.

Tek ikon seti Ionicons kullanılır. Mevcut ekosistemde bulunan `@expo/vector-icons@15.1.1` doğrudan mobil bağımlılığına eklendi; pnpm lock değişikliği yalnızca bu importer girdisidir. Doğrudan Ionicons import'u diğer ikon fontlarını Android çıktısına taşımıyor. Yeni animasyon paketi yok.

## Hareket ve performans

- Stack ekran geçişlerinde hafif fade_from_bottom; sistem hareketi azaltıyorsa none.
- Buton basışında 90 ms / 0,98 ölçek; native driver.
- Skeleton pulse 700 ms; native driver, interaction listesine girmez; unmount'ta durur.
- Boş/hata ve filtre içeriğinde kısa 180 ms opacity geçişi.
- Filtre yerleşiminde LayoutAnimation; platform desteğine göre yerleşim davranışı değişebilir.
- Tek MotionProvider, tek sistem azaltılmış hareket aboneliği. Azaltılmış harekette sürekli pulse ve buton ölçeği kapalı.
- FlatList, kontrollü ilk render ve sunucu limit=20 korunur. Sayfa değişiminde liste başına dönülür; eğitim/arama/uygulanmış filtre değişiminde sayfa 1 olur. Eski istekler iptal edilir veya stale sonuçları ekrana yazılmaz.
- Kurum/şehir/unvan ve taban puan sınırları mevcut API parametrelerine bağlandı. Sunucuda ayrı puan türü alanı olmayan tarihsel kayıtlar için uydurma filtre eklenmedi; puan türü eğitim düzeyiyle birlikte seçilir. API'deki minScoreGte/minScoreLte tarihsel taban puan aralığıdır.

## Güncel ilan kaynak politikası

`apps/mobile/lib/source-policy.ts`: kısıtlanan alan adı, alt alan adları, kanonik/encoded hostlar, sourceId/provider ve nested evidence/references/positions/saved içindeki bilinen kısıtlı kaynak izi varsa **tüm kayıt** mobil görünümden çıkarılır. Yalnızca bağlantı saklayıp başlığı göstermeye devam edilmez.

`official.ts`: HTTPS, kimlik bilgisi/port, mevcut registry host allowlist kontrollerine ek olarak kısıtlı kaynak bağlantıları reddedilir. Kurum/resmî platform bağlantıları mevcut registry izinleriyle sınırlıdır; yeni host veya otomatik kaynak izni eklenmedi.

`announcement-api.ts`: liste yanıtı kaynak politikasından geçer; doğrudan detay/deep link, başlık/metin gösterilmeden denetlenir. Hesap matches/inbox yanıtı kaynak izi taşımadığı için ilgili public detay önce doğrulanır. Kontrol en fazla 4 eşzamanlı istek, çalıştırma başına ID tekilleştirme ve toplam 15 saniye sınırı kullanır. Kısıtlı veya 404 kayıt gösterilmez; ağ/500 hatası boş başarıya çevrilmez. Yeni scheduler veya arka plan taraması yoktur.

Server total/pages değiştirilmez ve izinli toplam diye sunulmaz. Kısıtlı kayıtların elendiği sunucu sayfası boş kalabilir; sırf boşluğu doldurmak için tüm sayfaları otomatik tarama eklenmedi. Mobil metinlerinde kısıtlı kaynağa tanıtım/link/alıntı eklenmedi.

**Sınır:** Bu bir mobil UI korumasıdır. Sunucu source registry, diğer istemciler ve OS tarafından arka planda gösterilen mevcut push payload'ları değiştirilmedi. Backend kaynak engellemesi ve push göndermeden önceki merkezi kaynak filtresi, yayın operasyonunda ayrıca doğrulanmalıdır. Mobil bir filtre, sunucu genelinde politika uygulandığı anlamına gelmez.

## Test ve kanıt

| Kontrol | Sonuç |
| --- | --- |
| pnpm --filter @kadro/mobile exec tsc --noEmit | PASS |
| Expo SDK 54 offline Android export | PASS; gerçek Hermes bundle, AAB/mağaza yayını değildir |
| Secret taraması / git diff --check | PASS; 0 secret bulgusu, yalnızca CRLF dönüşüm uyarıları |
| node infra/test-mobile-ui.cjs --local-api | 11 grup PASS: kaynak/host/provenance, bağlantı güvenliği, bilinmeyen tarihler, sayfalama korunması, deep-link reddi, lookup tekilleştirme, ağ/HTTP/bozuk yanıt/abort ve gerçek yerel historical API |
| Gerçek yerel GET /health | HTTP 200, database ready |
| Üç eğitim düzeyinde historical list/page/detail | GET testleri PASS; boş seviyeler veri varmış gibi doldurulmadı |
| Yerel GET /announcements?view=open | **HTTP 500**. Boş ilan başarısı olarak raporlanmadı; DB/migration değiştirilerek gizlenmedi |
| Android emülatör, Expo Go 54, API 35 | Ana sayfa kısayolu, alt gezinme, 504 tarihsel kayıt, Önlisans seçimi/0 kayıt, kadro detayı/taban-tavan puanı, Android geri tuşuyla listeye dönüş, filtre aç/kapat, giriş formu ve gerçek HTTP 500 hata görünümü gözlemlendi |
| Fiziksel Android cihaz | Bağlı cihaz yok; doğrulanmadı |

Emülatör geçici `-read-only -no-snapshot` oturumunda çalıştırıldı. Katlanabilir ekran/grafik sorununda yazılım çizicisiyle yeniden açıldı. Bu, düşük donanımlı fiziksel telefon performans ölçümü değildir. Expo Go remote push desteğinin bulunmadığını belirten geliştirme uyarısı gözlemlendi; push teslimatı testi sayılmadı ve uyarı kodda susturulmadı.

Yerel görsel inceleme çıktıları `.local/ui-review/` altında: `home-final.png`, `historical-empty.png`, `profile.png`, `announcements-error.png`, `placement-detail.png`, `historical-return.png`, `filters.png`, `filters-closed.png`. Bunlar emülatör görüntüleridir; üretim veya fiziksel cihaz kanıtı değildir. Geçiş sırasında alınan diğer debug görüntüleri doğrulama kanıtı olarak kullanılmamalıdır. Android export `.local/mobile-ui-android/` altında; son Hermes bundle 2,9 MB, 25 asset, tek Ionicons fontu. Export stderr dosyası boş.

## Google Play kapalı test öncesi kalanlar

- Güncel ilan API'sinin HTTP 500 yerel durumu ayrı backend/şema teşhisinde çözülmeli; bu UI görevi DB değişikliğine onay vermez. Production API aynı hata varmış gibi yorumlanmamalı.
- Fiziksel Android'de 360–430 dp genişlik, büyük font/TalkBack, klavye, geri tuşu ve process yeniden açma testi; düşük donanımda scroll/animasyon ölçümü.
- Gerçek veya izole test hesabıyla giriş/kayıt, profil güncelleme, kaydet/kaldır, silme onayı ve açıklanabilir sonuçların kullanıcı akışı. Bu görevde production hesabı oluşturulmadı veya silinmedi.
- Gerçek izinli ilan yayımlandığında detay/resmî başvuru bağlantısı; iptal/uzatma/favori güncellemeleri cihazdan kontrol edilmeli. Mock yanıtlar canlı ilan gibi sunulmamalı.
- Development/preview build üzerinde push izin/teslimat ve arka plan senaryoları; backend seviyesinde kaynak kısıtlaması.
- Son tasarımla fiziksel cihaz mağaza ekran görüntüleri, gizlilik/hesap silme/destek adreslerinin mevcut gerçek yapılandırması ve bağımsızlık açıklaması kontrolü.
- Kullanıcının onayladığı release sürecinde production EAS/AAB ve kapalı test yüklemesi. Bu çalışma Play-ready sertifikası veya mağazaya yükleme değildir.
