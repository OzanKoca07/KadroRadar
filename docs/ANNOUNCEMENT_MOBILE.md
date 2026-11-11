# Mobil ilan ekranları

Ana sayfa `/announcements` ekranına bağlanır. Liste backend `/announcements` endpoint'ini, arşiv `view=archive` sorgusunu ve detay `/announcements/:id` endpoint'ini kullanır.

EXPO_PUBLIC_API_URL `/api/v1` ile biten API kökü olmalıdır. Liste sayfalama, arama, yenileme, boş sonuç, hata ve 15 saniye timeout içerir. Ekrandan ayrılırken istek iptal edilir.

Detay ekranı yalnızca HTTPS, kimlik bilgisi içermeyen, standart portlu gov.tr/edu.tr bağlantılarını dış tarayıcıya aktarır. Bu alan adı kontrolü, içeriğin editöryal doğrulamasının yerine geçmez. Resmî olmayan uygulama açıklaması görünürdür.

Gerçek cihaz, erişilebilirlik ve Android tarayıcı davranışı henüz doğrulanmadı. Favoriler ve profil henüz uygulanmadı.
