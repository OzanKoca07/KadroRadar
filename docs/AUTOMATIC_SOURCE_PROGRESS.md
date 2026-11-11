# Otomatik kaynak çalışması — 23 Ekim 2026

Enerji Bakanlığı https://enerji.gov.tr/rss sayfasında otomatik takip için duyuru XML akışını resmen sunuyor: https://enerji.gov.tr/RSS/15?t=1 . RSS okuma amacı belgelenmiştir; üçüncü taraf uygulamada tam metin yeniden yayın lisansı doğrulanmamıştır.

`services/ingest/official_rss.py` gerçek RSS ayrıştırıcısıdır. Başlık ve kaynak bağlantısı üzerinden personel alım adaylarını seçer; sonuç/yerleşme duyurularını ayırır. Eksik başvuru tarihlerini uydurmaz. Çıktı yalnızca yerel inceleme kuyruğudur; PostgreSQL staging değildir.

Sabit HTTPS kaynak, yönlendirme reddi, 15 saniye socket timeout, 2 MB sınır, XML entity/DOCTYPE reddi, URL allowlist, içerik hash ve URL üzerinden yerel tekilleştirme uygulanmıştır. ETag/Last-Modified istek başlıkları vardır; 304 yönetimi, Retry-After/backoff, toplam süre sınırı ve dağıtık kilit henüz yoktur. Scheduler etkin değildir.

Canlı ilk çalışmada XML alındı ancak bağlantı doğrulaması başarısız oldu; sonraki inceleme isteği okuma timeout verdi. Göreli URL desteği eklendi. Başarılı staging aktarımı raporlanamaz.

SGK RSS sayfası https://www.sgk.gov.tr/Rss otomatik takibi açıklıyor; https://www.sgk.gov.tr/yasaluyari yeniden yayın için ön izin şartı içeriyor. Entegrasyon etkinleştirilmedi.

ilan.gov.tr ve resmigazete.gov.tr web araştırmasında timeout verdi. esube.iskur.gov.tr ana sayfası okunabildi; uygun ilan servisi ve yeniden kullanım koşulları doğrulanmadı. SBB/Kariyer Kapısı için önceki erişim sınırlamaları giderilmedi.

Gerçek ilan keşif sayısı güvenilir biçimde ölçülemedi. PostgreSQL staging: 0; bu görevde onaylanan: 0; mobilde doğrulanmış ilan sayısı: ölçülmedi. Canlı veritabanına yazılmadı; yedek doğrulaması yapılmadığından migration deploy uygulanmadı.

Test: `python -m unittest discover -s services/ingest -p test_official_rss.py` — 5/5 başarılı. Bu testler canlı aktarım veya uçtan uca yayın doğrulaması değildir. Admin inceleme/onay, PostgreSQL staging, scheduler ve mobil canlı veri testi tamamlanmadı.
