# RC1 Android doğrulama planı

25 Ekim2026. Kullanıcı önceki preview APK'nın gerçek telefonda açılıp test edildiğini bildirdi. Aşağıdaki RC1 değişiklikleri o binary'de doğrulanmış sayılmaz. Bu çalışmada gerçek cihaz koşusu0, yeni imzalı AAB0.

| Akış | Otomatik kanıt | Yeni native build / cihazda yapılacak |
| --- | --- | --- |
| Hesapsız güncel/geçmiş ilan, arama, sayfalama | Public HTTP/staging testleri; TypeScript ve Android JS export | Geri tuşu, pull-to-refresh, boş liste, yavaş ağ |
| Detay, resmî kaynak, dış başvuru | Public sözleşme, doğrulanmamış URL'nin uydurulmaması | Gerçek tarayıcı açılışı, uygulamaya dönüş |
| Hesap, profil, logout, silme | Gerçek izole PostgreSQL/HTTP; web silme browser testi | Android klavye, onay diyaloğu, oturumun kapanması |
| Uygun/belirsiz/uygun değil |9 saf motor kontrolü, API kadro gerekçeleri | Tüm nedenlerin ekranda okunması; erişilebilirlik |
| Kaydetme ve güncelleme/iptal | İdempotent favori ve durum yansıması | Detaydan kaydet→Kaydedilenler→kaldır |
| Bildirim ayarı, push, deep link |8 plan kontrolü; DB/mocked Expo worker | İzin ver/ret, Android kanal, gerçek FCM token/receipt/cihaz teslimi |
| ÖSYM lisans/önlisans/ortaöğretim |3 gerçek PDF→staging→onay→public sözleşme; eski504 GET regresyonu | Eğitim seçimi, dönem, puan farkı, detay ve geri tuşu |
| Ağ kesintisi |6 mobil istemci senaryosu: config yok, offline,500,401,timeout,boş | Uçak modu, yeniden bağlanma, tekrarlı dokunma |
| Gizlilik/destek/silme bağlantıları | Production config guard ve web browser testi | Gerçek yayımlanan HTTPS sayfalara erişim |

Oturum kararı: RC1 bearer tokenı yalnızca bellekte tutar; yeniden başlatmada giriş gerekir. Düz AsyncStorage kullanılmaz.8 saatlik sunucu oturumu ve401 iptali korunur. Kullanıcıya Hakkında ekranında bu davranış açıklanır. Kalıcı oturum bu sürümün gereği değildir; ileride eklenecekse Android Keystore destekli Expo SecureStore, cihaz bazlı iptal ve sunucu oturum süresiyle birlikte uygulanmalıdır. Şu an olmayan kalıcı oturum varmış gibi gösterilmez.

Kapalı testte Android sürümü, cihaz modeli, gerçek versionCode, build kimliği, API sürümü, senaryo sonucu ve hata kaydı tutulmalıdır. SDK54, RN0.81.5, paket ve EAS kimlikleri korunur. SDK36/cleartext kapatma ve izin engelleme config testinde doğrulanır; binary manifest incelemesi AAB üretildikten sonra yapılır. `RECORD_AUDIO`, `CAMERA`, eski storage izinleri engellendi; native izin listesi henüz gerçek yeni binary üzerinde doğrulanmadı.
