# ÖSYM merkezi yerleştirme genişletmesi — 26 Ekim 2026

**18 gerçek sonuç PDF'si, 6 dönem, 7.692 yeni test kaydı. Production aktarımı0.** Resmî arşivden seçilmiş belgeler indirildi; API entegrasyonunda ağ taşıması aynı gerçek HTML/PDF byte'larının SHA doğrulamalı cache'iyle değiştirildi. Bu bir canlı production importu veya insan tarafından tamamlanmış editoryal onay değildir. Reviewer onayları izole testte simüle edildi.

Gerçek yerel PostgreSQL ve504 onaylı kayıt içeren volume'a bağlanılmadı; mevcut gerçek `infra-db-1` container'ı kapalı kaldı. Gerçek504 kayıtlı yedek yalnızca yeni `kadroradar-osym-expansion-20261026` test container'ındaki kopyalara restore edildi. Ana başarılı test DB'si `kadroradar_ingestion_test_osym_expansion_full_20261026`:504 eski +7.692 yeni =8.196 onaylı test kaydı. Eski504 satırın kimlik, puan, ham veri ve onay zamanı dahil alanları test boyunca aynı kaldı. Puan tipi genişletilmeden önceki test kopyası ile sonraki kopyanın504 satır snapshot SHA256 değerleri de aynı: `ae975792f44087a6e12c0ffcd81fbcc559855ecbea5bf23a4f5062c95884f963`. Başarılı8.196 kayıtlı test kopyası `.local/osym-expansion/integration-8196.dump` olarak dışa aktarıldı; Git dışındadır.

## Dönem ve eğitim düzeyi sonuçları

Duplicate sütunu aynı belgenin ikinci importunda yeniden oluşturulması engellenen **satır** sayısıdır; her belge için1 duplicate batch dönüşü vardır. Hata sütunu son parser sonucudur; ilk denemelerdeki düzeltilmiş parser/SQL sorunları aşağıda ayrıca açıklanır.

| Dönem | Eğitim | Resmî kaynak | Belge | Parse | Hata | Duplicate kayıt | Staging | Onaylanan test | Production |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026/1 | Lisans | [Duyuru](https://osym.gov.tr/kpss-20261-bazi-kamu-kurum-ve-kuruluslarin-kadro-ve-pozisyonlarina-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler) | [PDF](https://dokuman.osym.gov.tr/web/2026/7/kpss-20261-yerlestirme-sonuclarina-liskin-en-kucuk-ve-en-buyuk-puanlar-lsans-24q42vum.pdf) | 555 | 0 | 555 | 555 | 555 | 0 |
| 2026/1 | Önlisans | [Duyuru](https://osym.gov.tr/kpss-20261-bazi-kamu-kurum-ve-kuruluslarin-kadro-ve-pozisyonlarina-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler) | [PDF](https://dokuman.osym.gov.tr/web/2026/7/kpss-20261-yerlestirme-sonuclarina-liskin-en-kucuk-ve-en-buyuk-puanlar-on-lsans-24zbk8tg.pdf) | 410 | 0 | 410 | 410 | 410 | 0 |
| 2026/1 | Ortaöğretim | [Duyuru](https://osym.gov.tr/kpss-20261-bazi-kamu-kurum-ve-kuruluslarin-kadro-ve-pozisyonlarina-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler) | [PDF](https://dokuman.osym.gov.tr/web/2026/7/kpss-20261-yerlestirme-sonuclarina-liskin-en-kucuk-ve-en-buyuk-puanlar-ortaogretm-2477sk0t.pdf) | 141 | 0 | 141 | 141 | 141 | 0 |
| 2025/2 | Lisans | [Duyuru](https://osym.gov.tr/kpss20252-bazi-kamu-kurum-ve-kuruluslarin-kadro-ve-pozisyonlarina-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler) | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2025/KPSS/TERCIH2/minmaxlisans07012026.pdf) | 990 | 0 | 990 | 990 | 990 | 0 |
| 2025/2 | Önlisans | [Duyuru](https://osym.gov.tr/kpss20252-bazi-kamu-kurum-ve-kuruluslarin-kadro-ve-pozisyonlarina-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler) | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2025/KPSS/TERCIH2/minmaxonl07012026.pdf) | 570 | 0 | 570 | 570 | 570 | 0 |
| 2025/2 | Ortaöğretim | [Duyuru](https://osym.gov.tr/kpss20252-bazi-kamu-kurum-ve-kuruluslarin-kadro-ve-pozisyonlarina-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler) | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2025/KPSS/TERCIH2/minmaxort07012025.pdf) | 248 | 0 | 248 | 248 | 248 | 0 |
| 2025/1 | Lisans | [Duyuru](https://osym.gov.tr/kpss20251-bazi-kamu-kurum-ve-kuruluslarin-kadro-ve-pozisyonlarina-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler) | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2025/KPSS/TERCIH1/minmaxlisans23072025.pdf) | 798 | 0 | 798 | 798 | 798 | 0 |
| 2025/1 | Önlisans | [Duyuru](https://osym.gov.tr/kpss20251-bazi-kamu-kurum-ve-kuruluslarin-kadro-ve-pozisyonlarina-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler) | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2025/KPSS/TERCIH1/minmaxonl23072025.pdf) | 418 | 0 | 418 | 418 | 418 | 0 |
| 2025/1 | Ortaöğretim | [Duyuru](https://osym.gov.tr/kpss20251-bazi-kamu-kurum-ve-kuruluslarin-kadro-ve-pozisyonlarina-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler) | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2025/KPSS/TERCIH1/minmaxort23072025.pdf) | 175 | 0 | 175 | 175 | 175 | 0 |
| 2024/2 | Lisans | [Duyuru](https://osym.gov.tr/kpss20242-bazi-kamu-kurum-ve-kuruluslarin-kadro-ve-pozisyonlarina-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler) | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2024/KPSS/TERCIH2/minmaxlisans03012025.pdf) | 555 | 0 | 555 | 555 | 555 | 0 |
| 2024/2 | Önlisans | [Duyuru](https://osym.gov.tr/kpss20242-bazi-kamu-kurum-ve-kuruluslarin-kadro-ve-pozisyonlarina-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler) | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2024/KPSS/TERCIH2/minmaxonl03012025.pdf) | 268 | 0 | 268 | 268 | 268 | 0 |
| 2024/2 | Ortaöğretim | [Duyuru](https://osym.gov.tr/kpss20242-bazi-kamu-kurum-ve-kuruluslarin-kadro-ve-pozisyonlarina-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler) | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2024/KPSS/TERCIH2/minmaxort03012025.pdf) | 41 | 0 | 41 | 41 | 41 | 0 |
| 2023/2 | Lisans | [Duyuru](https://osym.gov.tr/kpss20232-bazi-kamu-kurum-ve-kuruluslarin-kadro-ve-pozisyonlarina-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler) | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2023/KPSS/TERCIH2/minmaxlsns08012024.pdf) | 836 | 0 | 836 | 836 | 836 | 0 |
| 2023/2 | Önlisans | [Duyuru](https://osym.gov.tr/kpss20232-bazi-kamu-kurum-ve-kuruluslarin-kadro-ve-pozisyonlarina-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler) | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2023/KPSS/TERCIH2/minmaxonl08012024.pdf) | 541 | 0 | 541 | 541 | 541 | 0 |
| 2023/2 | Ortaöğretim | [Duyuru](https://osym.gov.tr/kpss20232-bazi-kamu-kurum-ve-kuruluslarin-kadro-ve-pozisyonlarina-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler) | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2023/KPSS/TERCIH2/minmaxort08012024.pdf) | 110 | 0 | 110 | 110 | 110 | 0 |
| 2023/1 | Lisans | [Duyuru](https://osym.gov.tr/kpss20231-bazi-kamu-kurum-ve-kuruluslarin-kadro-ve-pozisyonlarina-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler) | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2023/KPSS/TERCIH1/minmaxlsns26072023dl.pdf) | 559 | 0 | 559 | 559 | 559 | 0 |
| 2023/1 | Önlisans | [Duyuru](https://osym.gov.tr/kpss20231-bazi-kamu-kurum-ve-kuruluslarin-kadro-ve-pozisyonlarina-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler) | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2023/KPSS/TERCIH1/minmaxonl26072023donl.pdf) | 421 | 0 | 421 | 421 | 421 | 0 |
| 2023/1 | Ortaöğretim | [Duyuru](https://osym.gov.tr/kpss20231-bazi-kamu-kurum-ve-kuruluslarin-kadro-ve-pozisyonlarina-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler) | [PDF](https://dokuman.osym.gov.tr/pdfdokuman/2023/KPSS/TERCIH1/minmaxort26072023do.pdf) | 56 | 0 | 56 | 56 | 56 | 0 |


## Kaynak, tarih ve SHA kanıtı

[Sonuç arşivi](https://osym.gov.tr/SinavGrubu/Menu/341) ve [tercih kılavuzu arşivi](https://www.osym.gov.tr/SinavGrubu/Menu/338) kullanıldı. Belge bağlantıları bu sayfalardan/duyurulardan gözlendi; dosya adı/URL tahmini yapılmadı. Öncelikli2026/1,2025/2,2025/1,2024/2 tamamlandı; ardından2023/2 ve2023/1 tamamlandı. Adaptör ayrıca20 eşleşen merkezi dönem duyurusu keşfetti; seçilmeyen daha eski dönemler indirilmiş/parse edilmiş sayılmaz.

`packages/osym-official-documents.json` her sonuç belgesinin duyuru/belge URL'sini, kaynaktaki yayın tarihini, dönem/eğitim düzeyini, indirme zamanını, SHA256'sını, parse sayısını ve ayrı izole-test sonuçlarını içerir. Nitelik kaynakları ayrı listededir. Ham PDF'ler, HTML cache ve test dump'ları `.local/osym-expansion/` altında Git dışında tutulur. SourceDocument üzerinde `originalUrl`, `sha256`, yeni `historicalEvidence` JSON'u saklanır; JSON dönem/eğitim, kaynak index hash'i, belge hash'i, tarih ve `qualificationCodesVerified:false` içerir.

Tarih dosya adından çıkarılmaz. Örneğin2025/2 ortaöğretim URL'sinin sonu `07012025.pdf` olsa da resmî link ve PDF başlığı2025/2'dir; arşiv tarihi7 Ocak2026 olarak ayrı saklanır. Kaynaktaki dosya adı değiştirilmedi. Yayın tarihi bilinmiyorsa null kalır; indirme zamanı yayın tarihi yerine kullanılmaz.

## Kod değişiklikleri

- `services/ingest/osym_web.py`: HTTPS/host sınırı, iç içe HTML etiketleri, bağımsız eğitim/dönem eşleştirmesi, gerçek arşiv keşfi, kaynak hash/tarih kanıtı, link ile belge başlığı uyuşmazlığında ret, DNS/TLS/403/429/redirect/timeout sınıfları. Redirect/TLS kontrolleri atlanmaz.
- `services/ingest/osym_archive.py`: operatörün açıkça seçtiği en fazla8 merkezi dönemi işleyen, SHA kontrollü cache/resume içeren toplu inceleme komutu. Scheduler ve otomatik publication yok.
- `services/ingest/import_historical.py`: birlikte/ayrı puan sütunları, beş ondalık basamak, Türkçe NFC, boş kadrolarda `--`→null, kota/yerleşen/boş bütünlüğü ve eğitim/kadro prefix kontrolü. Tüm18 belgenin bütün sayfalarında basılı9 haneli kadro kodu sayısı parse edilen satır sayısıyla aynı.
- `services/ingest/historical_tables.py`: HTML/XLSX tablo adaptörü; formül, çoklu worksheet belirsizliği, kaynak başlığı/puan hassasiyeti ve duplicate kontrolü. Bunlar sentetik format testleriyle doğrulandı; bu çalışmada gerçek kaynakların tamamı PDF'dir. **Eski binary XLS desteklenmez**, açık hatayla reddedilir; desteklenmiş gibi raporlanmaz.
- `apps/api/src/historical-import.ts`: mevcut PostgreSQL staging/reviewer akışını kullanır, kaynak kanıtını kalıcı tutar, metadatayı admin'e sunar, parse hatası varsa importu durdurur; manuel PDF/XLSX/HTML kaynağını destekler. İkinci import önceki batch'i döndürür, onaylı kayıtları ezmez.
- `apps/admin/src/HistoricalUpload.tsx`, `main.tsx`: resmî arşivden dönem seçimi, bağlantı keşfi, dönem/eğitim/SHA mesajı, kaynak URL ve provenance inceleme alanı. İnceleme ve tam satır-sayısı teyidi korunur.
- `apps/mobile/app/historical.tsx`: eğitimden bağımsız yıl seçimi, yıl içindeki dönem seçimi ve filtre değişince sayfa sıfırlama. Yeni dönemler yalnızca onaylı DB kayıtlarından gelir; static örnek veri eklenmedi. SDK54/paket kimliği değişmedi.
- Docker parser dosyaları ve14-migration readiness testi; CI'da yeni offline arşiv/format testleri eklendi.

## API endpoint'leri

| Endpoint | İşlev |
| --- | --- |
| POST `/api/v1/admin/historical-documents/archive` | `{archiveUrl}` ile yalnızca gözlenen merkezi sonuç dönemlerini listeler |
| POST `/api/v1/admin/historical-documents/web` | `{indexUrl}` ile belgeleri listeler; `{indexUrl,documentUrl,archiveUrl?}` ile kaynak kanıtlı staging |
| POST `/api/v1/admin/historical-documents` | Yetkili manuel PDF/XLSX/HTML dosyası; dönem kaynak içeriğinden doğrulanır |
| GET `/api/v1/admin/historical-documents/:batchId/metadata` | Kaynak URL, SHA ve JSON provenance; editör/reviewer/admin erişimi |
| GET `/api/v1/admin/historical-documents/:batchId/file` | Özel, SHA doğrulamalı kaynak dosyası |
| POST `/api/v1/admin/imports/:id/approve` | Mevcut reviewer/admin rolü ve tam satır teyidiyle onay |
| GET `/api/v1/historical/rounds` | Yalnızca onaylı dönemler |
| GET `/api/v1/historical/placements?educationLevel=&year=&round=` | Onaylı veride birleşik mobil filtreler |

Yazma endpoint'lerinde oturum/RBAC ve web CSRF denetimi korunur. Free plan `DOCUMENT_UPLOADS_ENABLED=false` iken import/arşiv POST'ları kapalıdır. `SOURCE_SYNC_ENABLED=false` ve registry izinleri UNVERIFIED/disabled kalır. Kamuya açık tek seferlik belge incelemesi, sürekli otomatik toplama veya yeniden yayın izni sayılmaz.

## Migration ve veri kaybı kontrolü

İki yeni SQL dosyası hazırlandı, **yalnızca izole test DB'lerine uygulandı**:

1. `202610260001_historical_evidence`: SourceDocument'e nullable JSONB kanıt sütunu.
2. `202610260002_historical_score_precision`: minScore/maxScore `DECIMAL(7,5)`→`DECIMAL(8,5)`. Beş kesir basamağı korunur. Gerçek100,00000 puanı eski tipte numeric overflow üretmişti; veri kırpılmadan düzeltilmiştir.2025/1 lisans301018641 (s.11),2024/2 ortaöğretim102010255 ve2023/1 lisans301017220 gibi gerçek örnekler testte saklanabildi.

Toplam migration14'tür.3 migration içeren gerçek yedek kopyasına11 bekleyen migration uygulandı; boş regresyon DB'sinde14'ü de geçti. Gerçek DB için kullanıcı onayı, SQL/yedek incelemesi ve ALTER TABLE kilit süresinin planlanması hâlâ gereklidir. Reset/drop/truncate yoktur.

## Nitelik kodları

Altı dönemin **18 ayrı nitelik PDF'si** de indirildi; dönem + eğitim + kaynak URL + SHA ile kataloglandı.2026/1 kaynaklarında2001 ortaöğretim,3001 önlisans,4001 lisans düzeyindeki genel mezuniyet koşullarıdır; bu dört haneli kodlar9 haneli kadro kodlarıyla karıştırılmaz. Kaynaklar: [ortaöğretim](https://dokuman.osym.gov.tr/pdfdokuman/2026/KPSS/TERCIH1/ortaogretim-nitelik_t1d03072026.pdf), [önlisans](https://dokuman.osym.gov.tr/pdfdokuman/2026/KPSS/TERCIH1/onlisans-nitelik_t1d03072026.pdf), [lisans](https://dokuman.osym.gov.tr/pdfdokuman/2026/KPSS/TERCIH1/lisans-nitelik_t1d03072026.pdf).

Belgenin bulunması, her tarihsel kadronun tercih tablosundaki bütün niteliklerinin doğrulandığı anlamına gelmez. Kadro→kod eşleşmesi ve bölüm eşdeğerliği henüz doğrulanmadı; `verifiedForMatching:false` / `qualificationCodesVerified:false` korunur. Tarihsel kayıttan kesin uygunluk veya atanma olasılığı üretilmez.

## Testler ve kanıt sınırları

- `test_osym_archive.py` / `test_osym_web.py`:13 test PASS; gerçek18 PDF için SHA, eğitim/dönem, toplam satır kapsamı; HTML/XLSX fixture; eski XLS ret; sahte dönem/link uyuşmazlığı ret.
- Son ana parser suite39 test:35 PASS/4 Gazete gerçek-PDF testi SKIP; eski tarihsel parser5 test PASS. Toplam40 PASS/4 SKIP. Gazete gerçek PDF/OCR bu görevde yeniden test edilmedi.
- `apps/api/test-osym-periods.cjs`: gerçek indirilen cache ile18 belge→staging→duplicate→403/400 rol/teyit sınırı→reviewer onayı→public list/detail→eğitim/yıl/dönem filtresi; restore edilen504 snapshot'ı korunur. Ağ **test cache'i**, PDF içerikleri **gerçektir**.
- `apps/api/test-historical-import.cjs`: ayrı DB'de eski504/346/69 =919 regresyonu PASS. `test-historical-formats.cjs`: sentetik HTML/XLSX için staging, özel kaynak byte bütünlüğü, duplicate, reviewer onayı ve100.00000 saklama PASS; canlı Excel/HTML kaynağı değildir.
- `apps/api/test-admin-browser.cjs`:21 Playwright/Edge kontrolü PASS, sentetik UI verisi. `test-candidate.cjs` oturum/CSRF/RBAC/uygunluk/favori/silme regresyonu PASS.
- Prisma generate/validate, API/admin build, mobil tsc PASS. Son Docker image `sha256:009c466f1cf553fd9988c70d01a48846a195455dfffb9be617dc7e733ed4196f`;14 migration'lı boş DB/health503/kapalı Free özellikleri testi PASS. Senkron Docker CLI komutlarının host test event-loop'unu durdurması sonrası bayat keep-alive socket yeniden kullanımını önlemek için yalnızca smoke test isteklerinde Connection:close kullanılır; production HTTP davranışı değiştirilmedi.

İlk bazı indirmeler TIMEOUT verdi; sınırlı operatör tekrarı ve cache ile36 belgenin tamamı elde edildi.403/429 veya erişim kontrolü atlanmadı. Test container'ları kanıt yedeği alındıktan sonra temizlendi; gerçek DB container'ı kapalı ve korunmuş durumda. Yeni mobil binary gerçek Android telefonda test edilmedi; mobil filtrelerin API sözleşmesi ve TypeScript derlemesi doğrulandı. Production/Render DB'ye0 kayıt yazıldı,0 migration uygulandı.

## Tekrar çalıştırma

```powershell
python services/ingest/osym_archive.py --archive https://osym.gov.tr/SinavGrubu/Menu/341 --period 2026/1 --period 2025/2 --period 2025/1 --period 2024/2 --period 2023/2 --period 2023/1 --destination .local/osym-expansion --download --guides-archive https://www.osym.gov.tr/SinavGrubu/Menu/338
$env:OSYM_REAL_CATALOG=(Resolve-Path .local/osym-expansion/catalog.json).Path
python -m unittest discover -s services/ingest -p 'test_osym*.py' -v
```

API entegrasyon testi `DATABASE_URL` için yalnızca `kadroradar_ingestion_test_` hedefini kabul eder. Gerçek DB URL'si vermeyin. Restore504 modu yalnızca gerçekten504 kaydı bulunan test kopyası için `OSYM_BASELINE_RESTORED=true` ile kullanılır; sıradan boş test DB'sinde test kendi504 referansını staging/onaydan geçirir. Production aktarımı ayrıca kullanıcı onayı ve gerçek editoryal kaynak incelemesi gerektirir.
