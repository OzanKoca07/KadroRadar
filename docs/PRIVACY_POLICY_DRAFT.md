# KadroRadar gizlilik metni — yayımlanmadan önce tamamlanacak taslak

İşletmecinin adı, veri sorumlusu iletişimi, destek adresi, saklama süreleri ve geçerli aktarım/hukuki dayanak bilgileri henüz sağlanmadı. Bu taslak mağaza başvurusunda yayımlanmış politika yerine kullanılamaz.

KadroRadar bağımsız bir bilgilendirme uygulamasıdır. ÖSYM, Kariyer Kapısı veya herhangi bir kamu kurumunun resmî uygulaması değildir. Başvurular ilgili kurumların resmî platformlarında yapılır. İlanları görmek için hesap zorunlu değildir.

Hesap açıldığında e-posta ve parola özeti; isteğe bağlı profilde eğitim düzeyi, bölüm kodu, KPSS puan/tür/yıl, YDS puanı, tercih edilen iller ve beyan edilen sertifika kodları işlenir. Doğum tarihi, cinsiyet, konum takibi veya belge dosyası zorunlu değildir ve bu akışlarda toplanmaz. Favoriler ve bildirim tercihleri hesaba bağlı saklanır.

Parolalar geri çözülebilir olarak saklanmaz. Oturum belirteçlerinin özeti sunucuda; mobil oturum yalnızca uygulama belleğinde tutulur. Uygulama yeniden başlatıldığında yeniden giriş gerekebilir. Giriş kötüye kullanımını sınırlandırmak için kısa süreli hashlenmiş IP limit kayıtları tutulur.

Bildirimler kullanıcının işletim sistemi izni ve uygulama tercihiyle açılır. Expo Push Service ve Android bildirim sağlayıcısı FCM üzerinden cihaz tokenı, bildirim metni ve ilan kimliği iletilir. Genel bildirim metinlerine KPSS puanı, bölüm veya e-posta eklenmez. Bu projeye reklam ya da kullanım analitiği SDK'sı eklenmedi.

Profil ve Bildirimler ekranlarından tercihleri yönetebilirsiniz. Profil → Hesabımı ve profilimi sil işlemi oturumları, profil verilerini, favorileri, bildirim kayıtlarını ve cihaz tokenını kaldırır; hesap satırı anonimleştirilir. Güvenlik/içerik moderasyon kayıtlarının saklama politikası işletmeci tarafından açıklanmalıdır. Hesap veri özeti GET /api/v1/account/data endpoint'inden alınabilir; uygulama içi dosya indirme arayüzü henüz yoktur.

Google Play için ayrıca uygulama dışından erişilebilen hesap silme talep sayfası ve gerçek destek iletişimi yayımlanmalıdır. HTTPS production hizmeti ve silme talebinin kimlik doğrulaması kurulmadan metin tamamlanmış sayılmaz.
