# Production release kontrol listesi

26 Ekim 2026. Bu liste deployment veya production yazma onayı değildir. Branch `feature/announcements-core`, HEAD `ef7c277`; yerel dirty değişiklikler henüz commit/push/deploy edilmedi. Production'a bu görevde kayıt0; 8611 tarihsel kayıt yalnızca izole testte doğrulandı.

## Hazır olanlar

- [x] Beş manuel kaynak adaptörü ve kaynak inceleme/admin entegrasyonu.
- [x] Kesin olmayan tarihler için OPEN üretmeme; üç eğitim, doğrulanmış KPSS'siz ve istihdam filtreleri.
- [x] SHA/kimlik kanıtlı duplicate önerisi, reviewer bağlantısı ve audit; otomatik fuzzy merge yok.
- [x] Gerçek Gazete2 ilan/20 kadro izole staging → test onayı → public API; tekrar duplicate.
- [x] Eski504 snapshot ve 21 gerçek belge/8611 ÖSYM operatör regresyonu.
- [x] Windows5.1/7 güvenli DACL ve fail-closed testleri; SACL ayrıcalığı yok.
- [x] Kaynak worker ve biten one-shot süreç; registry hâlâ kapalı.
- [x] API/admin/mobile derleme, Python61, PostgreSQL15 grup ve browser regresyonları.

## Sıralı release kapıları

1. [ ] Yerel diff ve yeni dosyalar birlikte gözden geçirilsin. `.local`/dump/secret eklenmesin. Test kanıtı ve yeni bağımlılık/migration listesi incelensin. Ayrı release onayıyla commit/push/deploy edilsin; bu görevde yapılmadı.
2. [ ] Render HTTPS health erişimi doğrulansın. Son salt okunur kontrol20sn timeout verdi; önceki0 kayıt gözlemi güncel sayı değildir. Free uyku davranışı ihtimali doğrulanmadan arıza nedeni kesinleştirilmesin.
3. [ ] Gerçek DB16 ve15 migration checksum'u salt okunur preflight ile doğrulansın. Fark varsa **ayrı migration incelemesi/onayı**; otomatik migrate/reset yok.
4. [ ] Doğrulanmış gerçek backup + ayrı restore makbuzu alınsın. Free DB süresi, kalıcı hosting ve harici yedekleme planı tamamlansın. Dump/operations günlüğü yalnızca özel ACL klasöründe saklansın.
5. [ ] Kullanıcı açık onay verirse504 staging pilotu, mevcut SYSTEM_ADMIN ile API onayı, ardından kalan20 belge aktarımı yapılsın. Mevcut kayıtlar add-only korunsun. Kaynak başına verify ve public filtre kontrolü yapılsın.
6. [ ] Kaynak başına erişim yöntemi, site koşulları ve olgusal indeksleme kapsamı ayrı değerlendirilsin. Genel bir yazılı izin şartı veya belirsizlikten yasak sonucu çıkarılmasın. 403/login/CAPTCHA/robots/TLS engeli aşılmasın. Destekli canlı adapter, uygun erişim değerlendirmesi ve ayrı operasyon aktivasyon onayı olmadan registry enabled değiştirilmesin. Tam belge yayımı kapalı kalsın; yeniden yayım izni indekslemenin ön şartı yapılmasın. `ANNOUNCEMENT_INDEXING_POLICY.md` esas alınsın.
7. [ ] Kalıcı belge saklama ve veri minimizasyonu sağlanınca upload ayrı onayla açılsın. Free'de `DOCUMENT_UPLOADS_ENABLED=false` kalsın.
8. [ ] Sürekli kaynak/push worker veya dış scheduler ayrı servis olarak onaylansın. Free API'ye kritik arka plan görevi yüklenmesin. Cron one-shot kullanacaksa kalıcı makbuz/depolama çözümü hazır olsun.
9. [ ] Gerçek production API ile yeni Android preview/release build, cihazda filtre/liste/detay/geri/offline/timeout testi yapılsın. Mevcut APK bu yerel değişiklikleri içeriyor varsayılmasın. SDK54/paket adı korunsun.
10. [ ] Gerçek yayımlanmış `/privacy`, `/delete-account`, destek iletişimi ve mobile release env'leri doğrulansın; bilgi uydurulmasın. Play Console hesap/kimlik, Data Safety, hesap silme, içerik derecelendirmesi, bağımsızlık açıklaması, kaynaklar, hedef API/AAB ve imzalama kullanıcı hesabında kontrol edilsin. EAS/mağaza yayın işlemi ayrıca onaylansın.

Free varsayılanları: `PROCESS_ROLE=api`, `SOURCE_SYNC_ENABLED=false`, `SOURCE_WORKER_ONCE=false`, `NOTIFICATIONS_ENABLED=false`, `DOCUMENT_UPLOADS_ENABLED=false`. Production secrets yalnızca servis secret alanlarına; Git/sohbet/loglara değil.

## Kullanıcının güvenli yerel komutları

Önce kod incelemesi ve Docker Desktop/PostgreSQL16 araçları hazır olmalı. Aşağıdaki ACL testi DB'ye bağlanmaz:

```powershell
.\infra\test-private-directory.ps1
```

Mevcut güvenli prompt betiğiyle, gerçek External DB URL'si yalnızca gizli yerel prompt'a girilir:

```powershell
.\infra\osym-production.ps1 -Action preflight
.\infra\osym-production.ps1 -Action backup
# backup kendi içinde ayrı test DB'sine restore/hash doğrulaması yapar.
.\infra\osym-production.ps1 -Action dry-run
```

Burada DUR: preflight, gerçek backup/restore makbuzu ve dry-run incelenmeden ve **ayrı production veri yazma onayı** verilmeden aşağıdaki aşamalar çalıştırılmaz:

```powershell
.\infra\osym-production.ps1 -Action pilot
# 504 staging, henüz public değil. Sonuç ve kaynaklar gözden geçirilsin.
.\infra\osym-production.ps1 -Action dry-run
.\infra\osym-production.ps1 -Action publish-pilot
# Pilot public ve kaynak filtreleri doğrulandıktan sonra:
.\infra\osym-production.ps1 -Action remaining
.\infra\osym-production.ps1 -Action verify
```

Her yazma adımı hedefe özel açık teyit ve mevcut admin oturumu ister. Secret veya tam DB URL'si paylaşılmaz. Yedek yok/bozuk, migration farklı, hedef farklı veya ACL güvensiz ise işlem durur; güvenlik kontrolü kaldırılmaz. Gerçek production sırası henüz uygulanmadı; izole test karşılıkları geçti.
