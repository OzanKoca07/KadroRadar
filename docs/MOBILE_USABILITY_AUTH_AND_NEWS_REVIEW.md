# Mobil kullanılabilirlik, auth ve duyuru incelemesi — 28 Ekim 2026

Mevcut kırmızı-beyaz tasarım korunarak ana sayfa, ilan ekranı, formlar ve oturumsuz akış sadeleştirildi. Yeni kod yereldir; bu görevde production migration/veri yazımı, release, GitHub commit/push veya EAS build yapılmadı.

## 1. Gerçek cihaz geri bildirimi ve kanıt sınırı

Samsung Android 1.0.1 preview için kullanıcı raporundaki sorunlar: fazla slogan/açıklama, kayıt sırasında ham 403, oturumsuz Kaydedilenler'de birbiriyle çelişen hata/tekrar dene/giriş seçenekleri, dikey alanı fazla kullanan filtreler. Bu mesajda yeni Samsung ekran görüntüleri sağlanmadı; görüntü incelenmiş gibi raporlanmamaktadır. Metin geri bildirimi ve mevcut kod esas alındı.

Bu çalışmada ayrı Android emülatöründe 360 dp giriş/oturumsuz durum ve 430 dp/1,3 yazı ölçeğiyle tarihsel liste incelendi. Bunlar fiziksel Samsung üzerinde yeni APK testi değildir. Expo Go'nun push desteği uyarısı geliştirme katmanında görüldü; uygulama hatası olarak gizlenmedi ve push başarısı sayılmadı.

## 2. Ekran ve akış değişiklikleri

- Ana sayfa: kompakt marka/bildirim simgesi, Geçmiş Atamalar ana erişimi, üç hızlı erişim, kısa eğitim bağlantıları. Selamlama/sloganlar, yinelenen bilgi paragrafları ve dekoratif istatistikler kaldırıldı.
- Güncel İlanlar: tek ekran başlığı, Güncel/Yakında/Arşiv, arama/filtre ve liste. Gerçek boş durumda “Şu anda yayımlanmış ilan bulunmuyor.” ve “Geçmiş atamaları incele”. Arşiv ve yakında için ayrı doğru boş metinler var; örnek ilan yok.
- Geçmiş Atamalar: yinelenen başlık kaldırıldı; eğitim ve yıl/dönem satırları yatay kaydırılır. Yıl değişince dönem sıfırlanır; dönem seçimi kendi yılını da ayarlar, eğitim değişince filtreler sıfırlanır. Kurum adı kartta öncelikli ve çok satır okunur. Alanlar ortak minimum 48 dp yüksekliği kullanır; sonuç sayısı, server pagination, taban/tavan filtreleri ve resmî kaynaklar korunur.
- Kaydedilenler/Bana Uygun/Bildirimler: oturum yoksa API çağrısı yapılmaz, tek açıklama ve tek “Giriş yap” düğmesi gösterilir. Giriş sonrası hedef ekran yalnızca izin verilen yerel route listesinden seçilir. Süresi bitmiş 401 oturumu temizler ve aynı giriş durumu görünür; tekrar dene sadece gerçek hata halinde vardır.
- İlan detayı: oturumsuz kaydet/karşılaştır yerine tek giriş aksiyonu; güvenli ilan kimliğiyle giriş sonrası aynı detaya dönülür. Giriş yapmak otomatik kaydetme/başvuru yapmaz.
- Detaylarda bağımsızlık, resmî kaynak ve belirsiz uygunluk uyarıları korunup kısaltıldı. Tam belge yeniden yayımı eklenmedi.

Formlarda boş/yanlış e-posta, boş/uzun/kısa şifre alan altında açıklanır; ilk hatalı input'a odaklanılır. Kayıt şifresi mevcut sunucu kuralıyla 12–128 karakterdir; girişte eski hesapları dışlamamak için 12 karakter altı parolalar istemcide reddedilmez. Aynı anda çift gönderim ref kilidi ve disabled/busy ile engellenir. Şifre göster/gizle, e-posta klavyesi, next/go, autofill ve KeyboardAvoidingView kullanılır. Sunucu hatası form düğmesinin yanında duyurulur.

## 3. 403: kanıtlanan kod yolu ve canlı belirsizlik

Önceki mobil `accountRequest`, bütün başarısız yanıtları `İşlem başarısız (HTTP durumu)` biçiminde gösteriyordu. Sunucudaki register kodu `ALLOW_SELF_REGISTRATION !== 'true'` olduğunda **403 Registration disabled** döndürüyor. Ayrıca auth rate limit'i 403 üretebilir. Login için origin kontrolü de ayrı 403 kaynağıdır. Register route'unda oturum/CSRF guard yoktur; mobil native fetch browser CORS kısıtlamasıyla aynı değildir.

Production'a yalnızca GET gönderildi. Health, çalışan kod SHA'sını `f31306cc6c3f478ab17460583c5dd3573b931fbb` olarak bildiriyor. Ancak **`GET /account/capabilities` HTTP 404**, yani canlı kayıt politikası kamuya açık GET ile görülemiyor. Yönetim environment erişimi veya asıl 403 response body'si bulunmadığından kullanıcının hatasının kesin olarak kapalı kayıt/rate limit/proxy kaynaklarından hangisi olduğu **kanıtlanamadı**. Yeni gerçek kullanıcı oluşturma, login denemesi veya register POST'u production'da yapılmadı.

Yeni sunucu sözleşmesi:

- `GET /api/v1/account/capabilities` → `{ selfRegistration, passwordMinLength: 12, passwordMaxLength: 128 }`; environment politikasını okur, DB sorgusu/yazımı yapmaz.
- Kapalı kayıt → 403 + allowlist edilmiş `REGISTRATION_DISABLED`. Bu kontrol rate-limit DB işleminden önce yapılır; kapalı kayıt isteği auth sayaçlarına bile yazmaz.
- Mevcut auth limit statüsü 403 korunarak `AUTH_RATE_LIMITED` koduyla ayrılır. İstemci 429'u da aynı anlaşılır sınıfa eşler.
- Origin reddi ayrı `AUTH_ORIGIN_REJECTED` kodu alır. Güvenlik kontrolü kaldırılmadı.

Mobil politika OPEN/CLOSED/UNKNOWN olarak ayrılır. Sadece OPEN kesin olarak doğrulanırsa kayıt sekmesi görünür. CLOSED: “Yeni hesap oluşturma şu anda kullanılamıyor.” UNKNOWN/404/ağ hatası: “Hesap oluşturma durumu doğrulanamadı.”; mevcut hesap girişi kullanılabilir. Belirsizlik kapalı politika gibi kesin sunulmaz.

401 girişte “E-posta adresi veya şifre hatalı.”; 403 yetki için güvenli genel mesaj; 400/422 bilgileri kontrol et; 429/rate limit bekle; ağ kesintisi interneti kontrol et; timeout/5xx bağlantıyı tekrar dene. Sunucunun ham message/SQL/stack alanları gösterilmez; hesap varlığını açıklayan ayrıntı eklenmedi.

## 4. Production kayıt politikası kararı

Bu görevde `ALLOW_SELF_REGISTRATION` değiştirilmedi. Operatör gerçek Render environment değerini secrets paylaşmadan Dashboard'dan kontrol etmelidir. Kapalıysa açmak ayrı bir güvenlik/yayın kararıdır: abuse/rate limit, TLS/CORS/trust proxy, hesap yaşam döngüsü, gizlilik/hesap silme, destek kanalı ve fiziksel cihaz testi birlikte değerlendirilmelidir. Capability API ve mobil düzeltmeler yayımlanmadan eski uygulama kayıt ekranı çalışıyor sayılmaz. E-posta doğrulaması/parola kurtarma bu görevde eklenmedi; hazırmış gibi sunulmamalı.

Yerel API yeni kodla yeniden başlatıldı; mevcut yerel `ALLOW_SELF_REGISTRATION=false` ve kapalı source/push/upload ayarları korundu. Yerel capability CLOSED ve news boş liste yanıtı production politikasının kanıtı değildir. Yerel 504 kayıt ve ÖSYM envanter hash'i tekrar doğrulandı.

## 5. Manuel resmî duyuru slider'ı

Yeni generic haber tablosu yerine mevcut **Announcement + AnnouncementImportRow + AnnouncementReviewAudit** kullanıldı; yeni migration yok. İlk sürüm yalnızca mevcut inceleme/yayın zincirindeki kamu personel ilanlarını kısa duyuru olarak öne çıkarır; genel haber CMS'i değildir.

- Admin panelinde yayımlanmış satır için kaynak/metadata indeksleme koşulları teyidi ve en az 20 karakter inceleme notu gerekir.
- `POST /api/v1/admin/announcement-imports/:id/home-news`: gerçek REVIEWER/SYSTEM_ADMIN oturumu ve cookie kullanımında CSRF; satır version kontrolü; enable/disable için audit. İçerik yazma yalnızca izole testte gerçekleştirildi.
- Açık kaynak erişimi/indeksleme değerlendirmesi editörün ayrı teyididir. Registry'de host bulunması tek başına lisans/izin olarak yorumlanmaz. Otomasyon/RSS/scheduler eklenmedi veya açılmadı.
- JSON `sourceEvidence.homeNews` altında `MANUAL_REVIEWED`, inceleme zamanı, indeksleme teyidi ve temel alanların hash'i saklanır. Temel ilan bilgisi değişirse eski hash geçersiz olur, yeniden incelemeye kadar slider'dan düşer. Ham kaynak metni ve özel inceleme notu public yanıta çıkmaz.
- `GET /api/v1/announcements/news`: yayımlanmış, kaynak kontrolü yapılmış, süresi dolmamış, manuel seçilmiş en fazla beş kayıt. Başlık/kurum/tarih/resmî URL ve kadro-kontenjan-şehirden üretilen kısa metadata özeti. Tam haber/PDF/HTML/görsel yok.
- `ilan.gov.tr`, alt alanları, belirsiz/registry dışı veya HTTP bağlantılar elenir; iç kaynak referanslarında kısıtlı kaynak bulunması da slider'ı engeller.
- Mobil slider elle kaydırılır; sayfa düğmeleri ve seçili durum/ekran okuyucu etiketleri var. Otomatik kaydırma yok; reduced motion açıkken programatik geçiş animasyonsuz. Sabit dar yükseklikle büyük yazı kesilmez.
- Gerçek onaylı veri yoksa, endpoint yoksa veya istek başarısızsa alan tamamen gizlenir. Production'da news GET şu an 404; bu nedenle yeni alan canlı içerik sunuyor sayılmaz. Demo içerik üretim yoluna eklenmedi.

## 6. Test sonuçları ve sınırlar

| Kontrol | Sonuç |
| --- | --- |
| API build ve admin build | PASS |
| Mobil TypeScript | PASS |
| SDK 54 Android export | PASS, `.local/usability-android-final`; APK değildir |
| İzole PostgreSQL 16 / HTTP auth-news | PASS: OPEN/CLOSED, kapalı kayıt DB yazmaz, yanlış giriş/origin, RBAC, CSRF, version, audit, öne çıkar/kaldır, kısıtlı kaynak ve yalnız metadata |
| Bilgi değişince eski slider onayı | PASS; değişen kontenjan eski hash'i geçersiz kılar |
| Mevcut candidate/auth, historical pagination/filter, üç ağ regresyonu | 6 izole grup PASS |
| Form/politika ağ testleri | 401/403/422/429/500, timeout/ağ, boş/yanlış alan, kayıt OPEN/CLOSED/UNKNOWN, oturumsuz fetch yapılmaması PASS |
| Slider boş/dolu/kısıtlı/erişilemeyen API | Metadata/policy ve izole HTTP testleri PASS; harici kaynak sitelerine otomatik erişim eklenmedi |
| Mobil kaynak politikası/yerel API | 11 grup PASS |
| Kontrast | Gerçek palette normal metin için dört temel çift en az 4,5:1 PASS |
| 360 dp emülatör | Tek giriş durumu; inline boş form hataları ve e-posta input focused=true doğrulandı |
| 430 dp, font scale 1,3 | Gerçek API'den 4.797 lisans sayısı ve uzun kurum adının çok satır okunması görüldü |

Emülatör XML/PNG kanıtları `.local/ui-review/usability-*`, izole sonuçlar `.local/release/usability-regressions.json`, `usability-news-final.json` içinde. Fixture slider testi gerçek yayın değildir. Fiziksel Samsung, gerçek TalkBack sesli gezinme, autofill sağlayıcısı ve yeni APK üzerinde push bu çalışmada doğrulanmadı. Erişilebilirlik etiketleri/touch hedefleri/reduced-motion kodu ve kontrast denetlendi; tam erişilebilirlik sertifikası iddia edilmez.

Yaklaşım [Nielsen ilkeleri](https://www.nngroup.com/articles/ten-usability-heuristics/) doğrultusunda hata önleme, açık durum ve az bilgi; [Android erişilebilirlik rehberi](https://developer.android.com/guide/topics/ui/accessibility/apps) doğrultusunda en az 48 dp hedefler, anlamlı etiketler ve okunur kontrast üzerine kuruldu.

## 7. Değişen dosyalar ve sonraki APK

Backend: `candidate.ts`, `announcement-admin.ts`, `announcements.controller.ts`, yeni `home-news.ts`. Admin: `AnnouncementReview.tsx`. Mobil: `index`, `historical`, `announcements`, `profile`, `saved`, `matches`, `notifications`, iki detay ekranı; `account.ts`, `auth-form.ts`, `news.ts`, `presentation.ts`, ortak `components.tsx` ve `news-slider.tsx`. Testler: `test-mobile-network.cjs`, yeni `test-usability-auth-news.cjs`, `test-mobile-usability.cjs`; mevcut CI dosyasına test adımları eklendi ancak GitHub'a gönderilmedi.

Sonraki aşama ayrı onayla kod inceleme/release ve capability/news endpoint'lerinin deployment'ıdır. Önce production GET ile kayıt politikası ve yeni sözleşme doğrulanmalı. Ardından doğru EAS hesap/kota/signing kontrolü ve benzersiz sürüm kodu kararıyla yeni preview APK hazırlanmalı. Package `com.kadroradar.app`, Expo SDK 54, mevcut ikon/splash/HTTPS preview ayarları korunmuştur. Bu görevde sürüm artırılmadı ve build komutu çalıştırılmadı.

## 8. Play kapalı test öncesi kalanlar

- Yeni kodun ayrı onaylı deployment ve gerçek Samsung APK regresyonu.
- Gerçek kayıt politikası kararı; açık kayıt seçilirse güvenlik ve hesap yaşam döngüsü kontrolleri.
- Fiziksel TalkBack, büyük yazı/klavye/geri tuşu, autofill ve bildirim izni/push testi.
- Gerçek destek e-postası/mağaza kimliği, Data Safety ve hesap silme beyanlarının son kontrolü.
- AAB/signing, Play Console ve kapalı test gereksinimleri.
- Mevcut oturum token'ı yalnızca bellekte: uygulama yeniden başlayınca giriş gerekir; güvenli kalıcı oturum eklenmiş gibi sunulmadı.

Mevcut production SYSTEM_ADMIN ve 8.611 ÖSYM kaydına yazma yapılmadı; özel yedek/operatör geliştirmeleri korunmuştur. Yeni migration yok ve mevcut migration'lar çalıştırılmadı.
