# RSS → PostgreSQL → inceleme → yayın

Yeni migration yalnızca AnnouncementImportRow ve AnnouncementReviewAudit tablolarını ekler. SQL incelendi; HistoricalPlacement tablolarını değiştirmez. Migration yalnızca `kadroradar_ingestion_test_20261023` izole veritabanına uygulandı. Gerçek veritabanına deploy edilmedi; önce yedek ve onay gerekir.

## Çalıştırma

API ortamına en az 48 karakterlik rastgele `ANNOUNCEMENT_AUTH_SECRET` güvenli biçimde sağlayın. Depoya veya mobil ortama koymayın. Güvenilir operatör ortamında `node apps/api/issue-announcement-credential.cjs operator-id CONTENT_EDITOR` ile 30 dakikalık credential üretin; imzalama sırrını editöre vermeyin. REVIEWER kimliği ayrı düzenlenir. Bu, operatör tarafından verilen süreli credential akışıdır; kullanıcı login/SSO, merkezi iptal ve brute-force korumalı hesap yönetimi değildir. Üretim deployment için HTTPS ve güvenilir kimlik sağlayıcı entegrasyonu tamamlanmalıdır.

Parser ortamında `ANNOUNCEMENT_INGEST_CREDENTIAL` tanımlayın. Canlı RSS için:

```powershell
python services/ingest/official_rss.py --output services/ingest/artifacts/energy-review.json --stage-api http://localhost:3000/api/v1
```

Fixture yalnızca izole test ortamında `--fixture services/ingest/fixtures/energy-personnel.xml` ile kullanılır. Fixture gerçek ilan değildir.

Admin panelindeki RSS kuyruğu credential ister. Satırları inceleyin, JSON alanlarını düzenleyin, açık saat dilimli tarih ve resmî URL girin. Kaynak doğrulama notuyla APPROVE, ardından PUBLISH uygulayın. REJECT, ARCHIVE, WITHDRAW ve audit görünümü bulunur. Kaynak kimliği değiştirilemez; alan değişikliği yeniden onay gerektirir. Eski version ile işlem 409 döndürür.

`POST /api/v1/admin/announcement-imports` en fazla 100 satır alır. GET aynı rotada son 100 kaydı audit ile döndürür. `POST /api/v1/admin/announcement-imports/:id/review` durum geçişlerini yönetir. İmzalı rol kontrolü her işlemde sunucudadır. Import serializable transaction ve unique sourceUrl kullanır; yarış durumunda yeniden deneme gerekir. Kaynak değişiklikleri mevcut yayını sessizce değiştirmez.

Eksik başlangıç/bitiş tarihli yayınlar açık listeye girmez. İptal WITHDRAW ile public erişimden çıkar. Süresi dolan yayın arşive girer. Mobil mevcut API sözleşmesini kullanır.

## Gerçek doğrulamalar

- Prisma generate başarılı (standart runtime).
- API build başarılı; admin build başarılı; mobil typecheck başarılı.
- Python parser testleri: 7/7 başarılı. DNS/TLS/HTTP 403/429/redirect/timeout ayrımı ve koşullu ETag/Last-Modified/304 dahil.
- İzole gerçek PostgreSQL ve Nest HTTP testi başarılı: fixture Python parse → staging → ikinci aktarım duplicate → yanlış role 403 → approve → publish → public liste/detay → withdraw → archive.
- Testte ilk bulunan JSON anahtar sırası kaynaklı yanlış değişiklik algısı düzeltildi; test yeniden geçti.

Canlı RSS bu görevde tekrar doğrulanmadı. Önceki timeout ve URL doğrulama hataları halen canlı erişim engelleri olarak takip edilmeli. Canlı staging/onay/yayın sayısı bu görevde 0. Android gerçek cihaz görüntüleme yapılmadı. Kaynak yeniden yayın izni, tam kimlik sağlayıcı/session yönetimi, kaynak bazlı scheduler/backoff, çoklu kadro modeli ve kapsamlı regresyon halen eksik. Bu belge production hazır iddiası değildir.
