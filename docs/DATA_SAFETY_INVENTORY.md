# Data Safety çalışma envanteri — 25 Ekim 2026

Bu dosya Play Console formunun gönderildiği anlamına gelmez. Son imzalı binary ve gerçek sunucu operasyonuyla karşılaştırılmalıdır.

| Veri | Amaç | Zorunluluk / silme |
| --- | --- | --- |
| E-posta ve parola özeti | Hesap doğrulama | Hesap kullanımı için; silmede anonimleştirme |
| Eğitim/bölüm/KPSS/YDS ve sertifika kodları | Açıklanabilir kadro karşılaştırması | İsteğe bağlı; hesap silmede kaldırılır |
| Tercih edilen iller | Kullanıcı tercihi | İsteğe bağlı, gerçek konum izni kullanılmaz |
| Favoriler | İlan takibi | Kullanıcı seçimi; tek tek veya hesapla silinir |
| Expo cihaz tokenı | İzinli bildirim | Kullanıcı izni; kapatma/logout/silmede kaldırılır |
| Bildirim olayları ve receipt | Tekilleştirme ve hata yönetimi | Hesap silmede kaldırılır; periyodik retention henüz tanımlanmadı |
| Hashlenmiş kısa süreli IP ve oturum özeti | Güvenlik/erişim limiti | Giriş limit kayıtları15dk; oturum8saat sonra geçersiz |
| Editör/reviewer aktör kimliği ve içerik audit'i | Veri kaynağı/yayın izlenebilirliği | Saklama/hukuki dayanak işletmeci tarafından tamamlanmalı |

Expo/FCM veri aktarımı, servis sağlayıcı rolleri ve ilgili beyanlar gerçek kurulumla değerlendirilmelidir. HTTPS, erişim kontrolü ve hesap silme kodu eklenmiş olması tek başına mevzuat veya mağaza uygunluğu kanıtı değildir. Firebase yapılandırması, destek iletişimi, yayımlanmış gizlilik/silme sayfaları, production API/AAB ve gerçek cihaz doğrulaması bekliyor.
