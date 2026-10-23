# KadroRadar - Mobil Geçmiş Atamalar Sprinti

## Kapsam
- Ana sayfa: ürün odağı ve tarihsel veri bağlantısı.
- Geçmiş Atamalar: API üzerinden onaylı kayıtları sorgulama, dönem, şehir, unvan filtreleri, 20'şer kayıtla sayfalama, yenileme, yükleniyor/boş/hata durumları.
- Kadro detayı: kurum, kadro kodu, yıl/dönem, kontenjan, yerleşen, boş, minimum/maksimum puan, kaynak dosyası ve PDF sayfası.
- Kullanıcı tarafından girilen puan ile salt tarihsel kıyaslama; tahmini yerleşme olasılığı veya uygunluk iddiası yok.

## Başlatma (Windows PowerShell)
1. API: `pnpm dev:api`
2. API doğrula: `Invoke-RestMethod http://localhost:3000/api/v1/historical/placements?limit=1`
3. Android emülatörü için `apps/mobile/.env` oluştur; `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/api/v1` yaz.
4. Fiziksel Android cihazda URL'yi `http://BILGISAYARIN_LAN_IP:3000/api/v1` ile değiştir; telefon ve bilgisayar aynı ağda olmalı. Yerel ağda erişim için güvenlik duvarı izni gerekebilir. Geliştirme URL'sini üretimde kullanma.
5. `pnpm dev:mobile` ve Expo Go / Android emülatör üzerinden aç.

## Kabul kontrolü
- Yönetici onayından sonra `GET /api/v1/historical/placements?limit=1` yanıtında `total > 0` olmalı.
- Kayıt detayına tıklayınca `GET /api/v1/historical/placements/:id` verisi görünmeli.
- Başlık araması, şehir filtresi, dönem seçimi, önceki/sonraki sayfa çalışmalı.
- Ağ kesilince hata ekranı, hiç sonuç olmayınca boş sonuç mesajı görünmeli.
- Tüm puanlar tarihsel olarak sunulmalı.

## Henüz yapılmayanlar
Kimlik doğrulama, profil saklama, gerçek zamanlı ilanlar, nitelik kodu motoru, bildirim, Google Play yayını.

## Doğrulama sınırı
Bu çalışma ortamında Node modülleri ve Android emülatörü olmadığı için mobil TypeScript derlemesi ve cihaz testi çalıştırılmadı. Bunları yerel bilgisayarda kontrol et.
