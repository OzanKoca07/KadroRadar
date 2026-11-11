# Kamu Kadro / KadroRadar karşılaştırması — 25 Ekim 2026

Kaynaklar: https://kamukadro.com/#ozellikler , https://kamukadro.com/terms , https://kamukadro.com/privacy , https://play.google.com/store/apps/details?id=com.kamukadro.app&hl=tr . Aşağıdakiler yayıncı beyanıdır; uygulama kurulup cihazda doğrulanmadı. Web ekranlarındaki örnek kurumlar ve sayılar gerçek ilan kanıtı değildir.

| İşlev | Kamu Kadro beyanı | İncelenen KadroRadar başlangıcı |
| --- | --- | --- |
| Hesapsız ilan görüntüleme | Var | Public liste/detay var |
| Profil | Eğitim, bölüm, sınav ve isteğe bağlı diğer bilgiler | CandidateProfile yalnızca eğitim/bölüm |
| Kadro bazlı değerlendirme | Koşul bazlı sonuç ve açıklama | Yok |
| Kaydetme | Var | Yok |
| Bildirim | Eşleşme, kapanış ve kayıt hatırlatması; sıklık sınırı | Yok |
| Kimlik | Google giriş | Süreli admin operatör credential; kullanıcı girişi yok |
| Veri | Kariyer Kapısı/ilan.gov.tr ağırlıklı derleme beyanı | RSS/JSON/CSV ve staging; canlı yayın doğrulanmadı |
| Tarihsel puanlar | Bu sayfalarda doğrulanmadı | ÖSYM geçmiş atama modülü var |
| Veri hakları | İndirme ve hesap silme beyanı | Henüz yok |

Kaynaklar arasında farklılıklar var: gizlilik sayfası 26 Mart 2026 tarihli ve satın alma olmadığını söylerken 17 Ekim 2026 koşulları ile Play metni isteğe bağlı reklamsız satın almayı anlatıyor. Bunlar KadroRadar için ürün veya hukuki gereklilik olarak kopyalanmayacak.

KadroRadar yaklaşımı: doğrulanmış kadro koşulları, üç durumlu açıklanabilir karar, asgari kişisel veri, doğum tarihi/cinsiyet/belge dosyası zorunluluğu yok. Bölüm kodu eşdeğerliği tahmin edilmeyecek. Rakibin kaynak beyanı bizim otomatik erişim iznimiz değildir. Kod, marka ve görsel tasarım kullanılmadı.

Uygulama sonrası: kullanıcı oturumu/profil, kadro kriterleri ve nedenli karar, kaydetme ve izinli bildirim kuyruğu kodlandı; izole DB/HTTP testleri geçti. Expo push adapter'ı ve mobil izin ekranı eklendi; gerçek teslim ve cihaz doğrulaması yapılmadı. Ayrıntılı API/migration/dosya listesi ve sınırlar `CANDIDATE_FEATURE_DELIVERY.md` içindedir.
